import 'server-only';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';

// Append-only desk audit trail. Records logins, invites, role changes,
// deactivations and every record create/update/delete with a field-level diff.

export type DeskAuditInput = {
  action: string;
  actorId?: string | null;
  actorEmail?: string | null;
  board?: string | null;
  recordId?: string | null;
  summary?: string | null;
  diff?: Record<string, { from: unknown; to: unknown }> | null;
};

export async function recordDeskAudit(input: DeskAuditInput): Promise<void> {
  try {
    const ip = headers().get('x-forwarded-for')?.split(',')[0]?.trim() || null;
    await prisma.deskAuditLog.create({
      data: {
        action: input.action,
        actorId: input.actorId ?? null,
        actorEmail: input.actorEmail ?? null,
        board: input.board ?? null,
        recordId: input.recordId ?? null,
        summary: input.summary ?? null,
        diff: (input.diff ?? undefined) as never,
        ip,
      },
    });
  } catch (err) {
    console.error('[desk-audit] failed', input.action, err);
  }
}

/** Field-level diff between two records, for the audit log (skips noise). */
export function diffRecords(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { from: unknown; to: unknown }> {
  const skip = new Set(['updatedAt', 'createdAt', 'updatedBy', 'createdBy']);
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of Object.keys(after)) {
    if (skip.has(k)) continue;
    const a = before[k];
    const b = after[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) out[k] = { from: a ?? null, to: b ?? null };
  }
  return out;
}
