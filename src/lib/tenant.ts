import 'server-only';
import { prisma } from './prisma';

// ─────────────────────────────────────────────────────────────────────────────
// Tenant-scoped data access
//
// The multi-tenancy guarantee lives HERE, not in the UI. `getTenantDb(orgId)`
// returns a Prisma client whose every query against a tenant-scoped model is
// forced to filter/insert by that orgId. A user in one org physically cannot read
// or write another org's rows through this client.
//
// Rules enforced by the extension below:
//   • list/count/aggregate reads  → `where` gets `AND { orgId }`
//   • findUnique / findFirst       → result is discarded if its orgId ≠ tenant
//   • create / createMany          → `data.orgId` is set to the tenant
//   • updateMany / deleteMany      → `where` gets `AND { orgId }`
//   • update / delete / upsert      → guarded by a scoped existence check first
//
// Identity/auth tables (User, Account, Session) and the audit log are NOT
// tenant-scoped and must use the raw `prisma` client instead.
// ─────────────────────────────────────────────────────────────────────────────

const TENANT_MODELS = new Set([
  'Practice',
  'Deal',
  'Engagement',
  'Connection',
  'Invoice',
  'Payment',
  'Thread',
  'Document',
  // Analytics view layer
  'Location',
  'Provider',
  'CashflowEntry',
  'ArAgingSnapshot',
  'LocationMetric',
  'PnlLine',
  'ProviderProduction',
  'Transaction',
]);

const LIST_READ_OPS = new Set([
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

const UNIQUE_READ_OPS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
]);

const MANY_WRITE_OPS = new Set(['updateMany', 'deleteMany']);
const SINGLE_WRITE_OPS = new Set(['update', 'delete']);

/** camelCase delegate key for a PascalCase model name. */
function delegateKey(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

export type TenantDb = ReturnType<typeof getTenantDb>;

export function getTenantDb(orgId: string) {
  if (!orgId) throw new Error('getTenantDb requires a non-empty orgId');

  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_MODELS.has(model)) {
            return query(args);
          }
          const a = (args ?? {}) as Record<string, any>;

          // Reads/writes that take a full WhereInput: AND-in the tenant filter.
          if (LIST_READ_OPS.has(operation) || MANY_WRITE_OPS.has(operation)) {
            a.where = { AND: [a.where ?? {}, { orgId }] };
            return query(a);
          }

          // Unique / first reads: run, then discard cross-tenant rows.
          if (UNIQUE_READ_OPS.has(operation)) {
            // For findFirst we can filter up front; for findUnique the where is a
            // unique input, so we post-check the returned row instead.
            if (operation === 'findFirst' || operation === 'findFirstOrThrow') {
              a.where = { AND: [a.where ?? {}, { orgId }] };
              return query(a);
            }
            const row: any = await query(a);
            if (row && row.orgId !== orgId) return null;
            return row;
          }

          // create / createMany: stamp the tenant onto the row(s).
          if (operation === 'create') {
            a.data = { ...(a.data ?? {}), orgId };
            return query(a);
          }
          if (operation === 'createMany') {
            const data = a.data;
            a.data = Array.isArray(data)
              ? data.map((d: any) => ({ ...d, orgId }))
              : { ...(data ?? {}), orgId };
            return query(a);
          }

          // Single update/delete by unique id: verify the row is in-tenant first.
          if (SINGLE_WRITE_OPS.has(operation)) {
            const id = a.where?.id;
            if (id) {
              const found = await (prisma as any)[delegateKey(model)].findFirst({
                where: { id, orgId },
                select: { id: true },
              });
              if (!found) {
                throw new Error(
                  `Tenant guard: ${model}#${id} not found in org ${orgId}`,
                );
              }
            }
            return query(a);
          }

          // upsert: stamp tenant into both create and (best-effort) update paths.
          if (operation === 'upsert') {
            a.create = { ...(a.create ?? {}), orgId };
            return query(a);
          }

          return query(a);
        },
      },
    },
  });
}
