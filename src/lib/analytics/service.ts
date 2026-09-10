import 'server-only';
import type { TenantContext } from '@/lib/context';
import { can } from '@/lib/rbac';
import { formatCurrency, formatCurrencyWhole } from '@/lib/utils';
import type { DrillRef } from './drill';
import {
  AR_BUCKETS,
  AR_BUCKET_LABEL,
  type ArBucketKey,
  type ArRow,
  type CfoDashboardData,
  type Kpi,
  type KpiKey,
  type LocationRef,
  type LocationRow,
  type ProviderRef,
  type TrendPoint,
} from './types';
import {
  fallbackLocations,
  fallbackProviders,
  genCashflow,
  genCollectionTrend,
  genEbitdaWaterfall,
  genLocationMetric,
  genPnl,
  genProviderProduction,
} from './mock';

// ─────────────────────────────────────────────────────────────────────────────
// CFO dashboard service
//
// getDashboard() assembles every panel for the active tenant + filters. AR aging
// is derived from REAL invoices (tenant-guarded); all other metrics come from the
// deterministic mock layer for now (see mock.ts TODOs). resolveDrill() turns an
// opaque drill token into content AFTER re-running auth + tenant checks, and
// returns null uniformly for "not permitted" and "does not exist" so a shared
// link never leaks whether a target exists.
// ─────────────────────────────────────────────────────────────────────────────

export type Filters = { period: string; locationId: string | null; scope: 'group' | 'location' };

const DAY = 86_400_000;

export function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function periodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(y, (m ?? 1) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
function priorPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(y, (m ?? 1) - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

async function loadLocations(ctx: TenantContext): Promise<LocationRef[]> {
  const rows = await ctx.db.location.findMany({ orderBy: { name: 'asc' } });
  if (rows.length > 0) return rows.map((l) => ({ id: l.id, name: l.name }));
  return fallbackLocations(ctx.orgId); // renders even before seed data exists
}
async function loadProviders(ctx: TenantContext): Promise<ProviderRef[]> {
  const rows = await ctx.db.provider.findMany({ orderBy: { name: 'asc' } });
  if (rows.length > 0) return rows.map((p) => ({ id: p.id, name: p.name }));
  return fallbackProviders(ctx.orgId);
}

/** Sum a metric across the locations in scope. */
function scopeLocations(all: LocationRef[], locationId: string | null): LocationRef[] {
  if (!locationId) return all;
  return all.filter((l) => l.id === locationId);
}

function buildKpi(
  key: KpiKey,
  label: string,
  display: string,
  current: number,
  prior: number,
  upIsFavorable: boolean,
  priorLabel: string,
): Kpi {
  if (!prior) return { key, label, display, variance: null };
  const delta = (current - prior) / prior;
  const direction: 'up' | 'down' = delta >= 0 ? 'up' : 'down';
  const favorable = upIsFavorable ? delta >= 0 : delta < 0;
  return {
    key,
    label,
    display,
    variance: {
      direction,
      favorable,
      text: `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}% vs ${priorLabel}`,
    },
  };
}

type EmptyByBucket = Record<ArBucketKey, number>;
const emptyBuckets = (): EmptyByBucket =>
  AR_BUCKETS.reduce((acc, b) => ({ ...acc, [b]: 0 }), {} as EmptyByBucket);

function bucketForAge(days: number): ArBucketKey {
  if (days <= 0) return 'current';
  if (days <= 30) return 'd1_30';
  if (days <= 60) return 'd31_60';
  if (days <= 90) return 'd61_90';
  return 'd90_plus';
}

/** Stable opaque id for a payer name (never expose the name in a URL). */
function payerId(name: string): string {
  let h = 5381;
  for (let i = 0; i < name.length; i++) h = (h * 33) ^ name.charCodeAt(i);
  return `pay_${(h >>> 0).toString(36)}`;
}

type OpenInvoice = {
  id: string;
  number: string;
  patientOrPayer: string;
  payer: string;
  locationId: string | null;
  locationName: string;
  ageDays: number;
  bucket: ArBucketKey;
  amountCents: number;
};

async function loadOpenInvoices(
  ctx: TenantContext,
  locations: LocationRef[],
  locationId: string | null,
): Promise<OpenInvoice[]> {
  const nameById = new Map(locations.map((l) => [l.id, l.name]));
  const invoices = await ctx.db.invoice.findMany({
    where: {
      status: { in: ['sent', 'overdue'] },
      ...(locationId ? { locationId } : {}),
    },
    orderBy: { dueDate: 'asc' },
  });
  const now = Date.now();
  return invoices.map((inv) => {
    const ref = inv.dueDate ?? inv.issueDate;
    const ageDays = Math.floor((now - new Date(ref).getTime()) / DAY);
    const payer = inv.payer ?? 'Self-pay';
    return {
      id: inv.id,
      number: inv.number,
      patientOrPayer: inv.patient ?? inv.payer ?? '—',
      payer,
      locationId: inv.locationId,
      locationName: (inv.locationId && nameById.get(inv.locationId)) || 'Unassigned',
      ageDays,
      bucket: bucketForAge(ageDays),
      amountCents: inv.amountCents,
    };
  });
}

export async function getDashboard(ctx: TenantContext, filters: Filters): Promise<CfoDashboardData> {
  const { period, locationId } = filters;
  const prior = priorPeriod(period);
  const allLocations = await loadLocations(ctx);
  const providers = await loadProviders(ctx);
  const inScope = scopeLocations(allLocations, locationId);
  const scopeName = locationId ? (allLocations.find((l) => l.id === locationId)?.name ?? null) : null;

  // ── Location rows + KPI aggregates (mock) ──
  const locationRows: LocationRow[] = inScope.map((l) => {
    const m = genLocationMetric(ctx.orgId, l.id, period);
    return {
      locationId: l.id,
      location: l.name,
      revenueCents: m.revenueCents,
      productionCents: m.productionCents,
      collectionsCents: m.collectionsCents,
      collectionRate: m.collectionRate,
      arCents: m.arCents,
      budgetRevenueCents: m.budgetRevenueCents,
      varianceCents: m.revenueCents - m.budgetRevenueCents,
    };
  });

  const sum = (f: (r: LocationRow) => number) => locationRows.reduce((a, r) => a + f(r), 0);
  const collections = sum((r) => r.collectionsCents);
  const production = sum((r) => r.productionCents);
  const collectionRate = production ? collections / production : 0;

  const priorRows = inScope.map((l) => genLocationMetric(ctx.orgId, l.id, prior));
  const priorCollections = priorRows.reduce((a, m) => a + m.collectionsCents, 0);
  const priorProduction = priorRows.reduce((a, m) => a + m.productionCents, 0);
  const priorRate = priorProduction ? priorCollections / priorProduction : 0;

  // ── Cashflow (mock) ──
  const scopeKey = locationId ?? 'group';
  const cashflow = genCashflow(ctx.orgId, scopeKey, period);
  const cashOnHand = cashflow.at(-1)?.cashOnHandCents ?? 0;
  const priorCashOnHand = genCashflow(ctx.orgId, scopeKey, prior).at(-1)?.cashOnHandCents ?? 0;

  // ── AR aging (REAL invoices) ──
  const open = await loadOpenInvoices(ctx, allLocations, locationId);
  const buckets = AR_BUCKETS.map((bucket) => {
    const rows = open.filter((o) => o.bucket === bucket);
    return {
      bucket,
      amountCents: rows.reduce((a, o) => a + o.amountCents, 0),
      invoiceCount: rows.length,
    };
  });
  const totalAr = buckets.reduce((a, b) => a + b.amountCents, 0);
  const arOver90 = buckets.find((b) => b.bucket === 'd90_plus')?.amountCents ?? 0;

  const groupBy = (keyFn: (o: OpenInvoice) => { refId: string; label: string }): ArRow[] => {
    const map = new Map<string, ArRow>();
    for (const o of open) {
      const { refId, label } = keyFn(o);
      let row = map.get(refId);
      if (!row) {
        row = { refId, label, byBucket: emptyBuckets(), totalCents: 0 };
        map.set(refId, row);
      }
      row.byBucket[o.bucket] += o.amountCents;
      row.totalCents += o.amountCents;
    }
    return [...map.values()].sort((a, b) => b.totalCents - a.totalCents);
  };
  const byLocation = groupBy((o) => ({ refId: o.locationId ?? 'unassigned', label: o.locationName }));
  const byPayer = groupBy((o) => ({ refId: payerId(o.payer), label: o.payer }));

  // Prior AR (deterministic mock, since we have no historical snapshot yet).
  const priorArFactor = 0.94 + ((totalAr % 13) / 100);
  const priorTotalAr = Math.round(totalAr * priorArFactor) || 1;
  const priorArOver90 = Math.round(arOver90 * priorArFactor) || 1;

  const priorLbl = periodLabel(prior);
  const kpis: Kpi[] = [
    buildKpi('collections', 'Total collections', formatCurrencyWhole(collections), collections, priorCollections, true, priorLbl),
    buildKpi('production', 'Total production', formatCurrencyWhole(production), production, priorProduction, true, priorLbl),
    buildKpi('collectionRate', 'Collection rate', pct(collectionRate), collectionRate, priorRate, true, priorLbl),
    buildKpi('cashOnHand', 'Cash on hand', formatCurrencyWhole(cashOnHand), cashOnHand, priorCashOnHand, true, priorLbl),
    buildKpi('totalAr', 'Total AR', formatCurrencyWhole(totalAr), totalAr, priorTotalAr, false, priorLbl),
    buildKpi('arOver90', 'AR over 90 days', formatCurrencyWhole(arOver90), arOver90, priorArOver90, false, priorLbl),
  ];

  // ── P&L + EBITDA bridge (mock) ──
  const pnlRows = genPnl(ctx.orgId, scopeKey, period);
  const ebitdaWaterfall = genEbitdaWaterfall(ctx.orgId, scopeKey, period);

  // ── Provider production (mock) ──
  const providerRows = providers.map((p) => {
    const m = genProviderProduction(ctx.orgId, p.id, period);
    return {
      providerId: p.id,
      provider: p.name,
      productionCents: m.productionCents,
      collectionsCents: m.collectionsCents,
      collectionRate: m.collectionRate,
      adjustmentsCents: m.adjustmentsCents,
    };
  });

  return {
    period,
    periodLabel: periodLabel(period),
    priorLabel: priorLbl,
    scope: {
      level: locationId ? filters.scope : 'group',
      locationId,
      locationName: scopeName,
    },
    locations: allLocations,
    kpis,
    cashflow,
    ar: { buckets, byLocation, byPayer, totalCents: totalAr },
    locationRows,
    pnl: { rows: pnlRows, ebitdaWaterfall },
    providerRows,
    collectionRateTrend: genCollectionTrend(ctx.orgId, scopeKey, period),
  };
  // Note: scope.level reflects the `scope` filter (a location *filter* composes as
  // 'group'; only the full-dashboard drill sets 'location'), while the data above
  // is scoped by locationId in both cases.
}

// ── Drill resolution ────────────────────────────────────────────────────────

export type DrillColumn = {
  key: string;
  header: string;
  type?: 'money' | 'date' | 'rate' | 'text' | 'age';
  align?: 'left' | 'right';
};
export type DrillTable = {
  columns: DrillColumn[];
  rows: Record<string, string | number | null>[];
  exportName: string;
  caption: string;
};
export type DrillContent = {
  eyebrow: string;
  title: string;
  scopeSummary: string;
  note?: string;
  summary?: { label: string; value: string; tone?: 'favorable' | 'unfavorable' | 'watch' | 'neutral' }[];
  trend?: TrendPoint[];
  table?: DrillTable;
  /** "Open full record" — navigates out of the dashboard. */
  openRecord?: { label: string; href: string };
  /** Location → full dashboard: the one drill that changes top-level scope. */
  scopeChange?: { label: string; href: string; locationId: string };
};

function scopeSummary(data: Pick<CfoDashboardData, 'periodLabel' | 'scope'>): string {
  const where = data.scope.locationName ?? 'All locations';
  return `${where} · ${data.periodLabel}`;
}

export async function resolveDrill(
  ctx: TenantContext,
  ref: DrillRef,
  filters: Filters,
): Promise<DrillContent | null> {
  // Permission gate (uniform null on failure — never leak existence).
  if (!can(ctx.effectiveRole, 'analytics.view')) return null;

  const data = await getDashboard(ctx, filters);
  const scope = scopeSummary(data);

  switch (ref.t) {
    case 'kpi': {
      const kpi = data.kpis.find((k) => k.key === ref.metric);
      if (!kpi) return null;
      // Contributing breakdown by location for the metric.
      const table: DrillTable = {
        exportName: `${ref.metric}-by-location`,
        caption: `${kpi.label} by location`,
        columns: [
          { key: 'location', header: 'Location', align: 'left' },
          { key: 'value', header: kpi.label, type: 'money', align: 'right' },
        ],
        rows: data.locationRows.map((r) => ({
          location: r.location,
          value:
            ref.metric === 'production'
              ? r.productionCents
              : ref.metric === 'totalAr' || ref.metric === 'arOver90'
                ? r.arCents
                : r.collectionsCents,
        })),
      };
      return {
        eyebrow: 'KPI',
        title: kpi.label,
        scopeSummary: scope,
        summary: [{ label: data.periodLabel, value: kpi.display }],
        trend: data.collectionRateTrend.map((t) => ({ label: t.label, valueCents: undefined, rate: t.rate })),
        table,
      };
    }

    case 'cashflow': {
      const point = data.cashflow.find((p) => p.bucketId === ref.bucketId);
      if (!point) return null;
      return {
        eyebrow: 'Cashflow',
        title: point.label,
        scopeSummary: scope,
        summary: [
          { label: 'Cash in', value: formatCurrency(point.cashInCents), tone: 'favorable' },
          { label: 'Cash out', value: formatCurrency(point.cashOutCents), tone: 'unfavorable' },
          { label: 'Cash on hand', value: formatCurrency(point.cashOnHandCents) },
        ],
        table: {
          exportName: `cash-movements-${point.bucketId}`,
          caption: `Cash movements · ${point.label}`,
          columns: [
            { key: 'description', header: 'Movement', align: 'left' },
            { key: 'amount', header: 'Amount', type: 'money', align: 'right' },
          ],
          // TODO(feeds): real cash movements for this bucket.
          rows: [
            { description: 'Patient & insurance receipts', amount: point.cashInCents },
            { description: 'Payroll', amount: -Math.round(point.cashOutCents * 0.55) },
            { description: 'Clinical supplies & lab', amount: -Math.round(point.cashOutCents * 0.28) },
            { description: 'Rent & facilities', amount: -Math.round(point.cashOutCents * 0.17) },
          ],
        },
      };
    }

    case 'ar-bucket':
    case 'ar-loc':
    case 'ar-payer': {
      const all = await loadInvoicesForArDrill(ctx, data.locations, filters, ref);
      if (!all) return null;
      const eyebrow =
        ref.t === 'ar-bucket'
          ? `AR aging · ${AR_BUCKET_LABEL[ref.bucket]} days`
          : ref.t === 'ar-loc'
            ? 'AR aging · location'
            : 'AR aging · payer';
      return {
        eyebrow,
        title: all.title,
        scopeSummary: scope,
        note: 'Read-only. Open an invoice to see the full record.',
        table: {
          exportName: `ar-${all.slug}`,
          caption: `Outstanding invoices · ${all.title}`,
          columns: [
            { key: 'number', header: 'Invoice', align: 'left' },
            { key: 'patientOrPayer', header: 'Patient / payer', align: 'left' },
            { key: 'location', header: 'Location', align: 'left' },
            { key: 'age', header: 'Age', type: 'age', align: 'right' },
            { key: 'amount', header: 'Amount', type: 'money', align: 'right' },
            { key: 'drill', header: '', align: 'right' },
          ],
          rows: all.rows,
        },
      };
    }

    case 'invoice': {
      // Tenant-guarded fetch — null (no-access) if not in this org.
      const inv = await ctx.db.invoice.findFirst({ where: { id: ref.invoiceId } });
      if (!inv) return null;
      return {
        eyebrow: 'AR aging · invoice',
        title: inv.number,
        scopeSummary: scope,
        summary: [
          { label: 'Amount', value: formatCurrency(inv.amountCents, inv.currency) },
          { label: 'Patient / payer', value: inv.patient ?? inv.payer ?? '—' },
          { label: 'Status', value: inv.status },
        ],
        openRecord: { label: 'Open full invoice', href: `/invoices/${inv.id}` },
      };
    }

    case 'location': {
      const loc = data.locations.find((l) => l.id === ref.locationId);
      const row = data.locationRows.find((r) => r.locationId === ref.locationId);
      if (!loc) return null;
      const m = row ?? {
        revenueCents: 0,
        productionCents: 0,
        collectionsCents: 0,
        collectionRate: 0,
        arCents: 0,
        varianceCents: 0,
      };
      return {
        eyebrow: 'Location performance',
        title: loc.name,
        scopeSummary: scope,
        summary: [
          { label: 'Revenue', value: formatCurrency(m.revenueCents) },
          { label: 'Production', value: formatCurrency(m.productionCents) },
          { label: 'Collections', value: formatCurrency(m.collectionsCents) },
          { label: 'Collection rate', value: pct(m.collectionRate) },
          { label: 'AR', value: formatCurrency(m.arCents) },
          {
            label: 'Variance vs budget',
            value: formatCurrency(m.varianceCents),
            tone: m.varianceCents >= 0 ? 'favorable' : 'unfavorable',
          },
        ],
        trend: data.collectionRateTrend,
        scopeChange: {
          label: `View ${loc.name} as full dashboard`,
          href: `/dashboard/cfo?period=${filters.period}&location=${loc.id}&scope=location`,
          locationId: loc.id,
        },
      };
    }

    case 'pnl-line': {
      const line = data.pnl.rows.find((r) => r.lineId === ref.lineId);
      if (!line) return null;
      return {
        eyebrow: 'P&L',
        title: line.account,
        scopeSummary: scope,
        summary: [
          { label: 'Actual', value: formatCurrency(line.actualCents) },
          { label: 'Budget', value: formatCurrency(line.budgetCents) },
          {
            label: 'Variance',
            value: formatCurrency(line.varianceCents),
            tone: (line.varianceCents >= 0) === line.positiveIsFavorable ? 'favorable' : 'unfavorable',
          },
        ],
        table: {
          exportName: `pnl-${line.lineId}`,
          caption: `Transactions rolling into ${line.account}`,
          columns: [
            { key: 'date', header: 'Date', type: 'date', align: 'left' },
            { key: 'description', header: 'Description', align: 'left' },
            { key: 'amount', header: 'Amount', type: 'money', align: 'right' },
          ],
          // TODO(feeds): real sub-account transactions for this line.
          rows: mockTxns(ctx.orgId, line.lineId, line.actualCents),
        },
      };
    }

    case 'addback': {
      const step = data.pnl.ebitdaWaterfall.find((s) => s.stepId === ref.stepId);
      if (!step || step.kind !== 'delta') return null;
      return {
        eyebrow: 'Adjusted EBITDA · add-back',
        title: step.label,
        scopeSummary: scope,
        summary: [
          {
            label: 'Adjustment',
            value: formatCurrency(step.amountCents),
            tone: step.amountCents >= 0 ? 'favorable' : 'unfavorable',
          },
        ],
        table: {
          exportName: `addback-${step.stepId}`,
          caption: `Supporting entries · ${step.label}`,
          columns: [
            { key: 'date', header: 'Date', type: 'date', align: 'left' },
            { key: 'description', header: 'Description', align: 'left' },
            { key: 'amount', header: 'Amount', type: 'money', align: 'right' },
          ],
          rows: mockTxns(ctx.orgId, step.stepId, step.amountCents),
        },
      };
    }

    case 'provider': {
      const row = data.providerRows.find((p) => p.providerId === ref.providerId);
      if (!row) return null;
      return {
        eyebrow: 'Production & collections · provider',
        title: row.provider,
        scopeSummary: scope,
        summary: [
          { label: 'Production', value: formatCurrency(row.productionCents) },
          { label: 'Collections', value: formatCurrency(row.collectionsCents) },
          { label: 'Collection rate', value: pct(row.collectionRate) },
          { label: 'Adjustments', value: formatCurrency(row.adjustmentsCents) },
        ],
        table: {
          exportName: `provider-${row.providerId}`,
          caption: `Production detail · ${row.provider}`,
          columns: [
            { key: 'date', header: 'Date', type: 'date', align: 'left' },
            { key: 'description', header: 'Procedure', align: 'left' },
            { key: 'amount', header: 'Production', type: 'money', align: 'right' },
          ],
          rows: mockTxns(ctx.orgId, row.providerId, row.productionCents),
        },
      };
    }

    default:
      return null;
  }
}

async function loadInvoicesForArDrill(
  ctx: TenantContext,
  locations: LocationRef[],
  filters: Filters,
  ref: Extract<DrillRef, { t: 'ar-bucket' | 'ar-loc' | 'ar-payer' }>,
): Promise<{ title: string; slug: string; rows: Record<string, string | number>[] } | null> {
  const open = await loadOpenInvoices(ctx, locations, filters.locationId);
  let filtered = open;
  let title = 'All open invoices';
  let slug = 'all';

  if (ref.t === 'ar-bucket') {
    filtered = open.filter((o) => o.bucket === ref.bucket);
    title = `${AR_BUCKET_LABEL[ref.bucket]} days`;
    slug = ref.bucket;
  } else if (ref.t === 'ar-loc') {
    filtered = open.filter((o) => (o.locationId ?? 'unassigned') === ref.locationId);
    if (ref.bucket) filtered = filtered.filter((o) => o.bucket === ref.bucket);
    title = filtered[0]?.locationName ?? 'Location';
    slug = `loc-${ref.locationId}`;
  } else {
    // ar-payer
    filtered = open.filter((o) => payerIdLocal(o.payer) === ref.payerId);
    if (ref.bucket) filtered = filtered.filter((o) => o.bucket === ref.bucket);
    title = filtered[0]?.payer ?? 'Payer';
    slug = `payer-${ref.payerId}`;
  }

  return {
    title,
    slug,
    rows: filtered.map((o) => ({
      id: o.id,
      number: o.number,
      patientOrPayer: o.patientOrPayer,
      location: o.locationName,
      age: o.ageDays,
      amount: o.amountCents,
      // Row-level drill token to invoice detail (opaque).
      drill: o.id,
    })),
  };
}

function payerIdLocal(name: string): string {
  let h = 5381;
  for (let i = 0; i < name.length; i++) h = (h * 33) ^ name.charCodeAt(i);
  return `pay_${(h >>> 0).toString(36)}`;
}

function mockTxns(orgId: string, key: string, totalCents: number): Record<string, string | number>[] {
  // Deterministic filler until real ledger detail is wired.
  const n = 5;
  const base = new Date();
  const rows: Record<string, string | number>[] = [];
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  for (let i = 0; i < n; i++) {
    h = Math.imul(h ^ (h >>> 13), 16777619);
    const frac = ((h >>> 0) % 1000) / 1000;
    const d = new Date(base.getFullYear(), base.getMonth(), 2 + i * 5);
    rows.push({
      date: d.toISOString(),
      description: ['Procedure batch', 'Adjustment', 'Supplier invoice', 'Payroll run', 'Reclass entry'][i % 5],
      amount: Math.round((totalCents / n) * (0.6 + frac * 0.8)),
    });
  }
  return rows;
}
