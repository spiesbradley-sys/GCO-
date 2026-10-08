import 'server-only';
import { prisma } from '@/lib/prisma';
import { monthlyCloseDate } from '@/desk/compute';
import { recordDeskAudit } from '@/lib/desk/audit';

// Automatic monthly cycle generation. For every live managed-accounting
// engagement we make sure a monthly cycle exists — the cron ensures the current
// month going forward; a manual run can backfill missed months. Idempotent:
// a cycle is only created when none exists for that engagement + month.

const BACKFILL_CAP_MONTHS = 18;

function ym(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function labelOfKey(mk: string): string {
  const [y, m] = mk.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function monthsBetween(startKey: string, endKey: string): string[] {
  const out: string[] = [];
  let [y, m] = startKey.split('-').map(Number);
  const [ey, em] = endKey.split('-').map(Number);
  let guard = 0;
  while ((y < ey || (y === ey && m <= em)) && guard++ < 240) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    if (++m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

/** The earliest month to backfill: the engagement's start month, clamped to at
 * most BACKFILL_CAP_MONTHS before now, and never after the current month. */
function backfillStartKey(startDate: string | null | undefined, now: Date): string {
  const cur = ym(now);
  const cap = ym(new Date(now.getFullYear(), now.getMonth() - BACKFILL_CAP_MONTHS, 1));
  let s = cur;
  if (startDate) {
    const k = startDate.slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(k)) s = k;
  }
  if (s < cap) s = cap;
  if (s > cur) s = cur;
  return s;
}

export type EnsureOpts = { backfill?: boolean; now?: Date };
export type GeneratedCycle = { id: string; name: string; period: string };

/**
 * Ensure monthly cycles exist for all live managed-accounting engagements.
 * `backfill` fills every month from the engagement's start (capped) up to the
 * current month; otherwise only the current month is ensured. The engagement's
 * accountant and controller carry through via the cycle's engagement link.
 */
export async function ensureMonthlyCycles(actor: { id: string; email: string }, opts: EnsureOpts = {}): Promise<GeneratedCycle[]> {
  const now = opts.now ?? new Date();
  const cur = ym(now);
  const engagements = await prisma.deskEngagement.findMany({
    where: { service: 'Managed Bookkeeping', status: { in: ['Active', 'Pilot'] } },
    select: { id: true, name: true, client: true, start: true },
  });

  const created: GeneratedCycle[] = [];
  for (const e of engagements) {
    const months = opts.backfill ? monthsBetween(backfillStartKey(e.start, now), cur) : [cur];
    const existing = await prisma.deskCycle.findMany({ where: { engagement: e.id }, select: { period: true } });
    const have = new Set(existing.map((c) => (c.period ?? '').slice(0, 7)));
    let clientName: string | undefined;
    if (e.client) {
      const c = await prisma.deskClient.findUnique({ where: { id: e.client }, select: { name: true } });
      clientName = c?.name ?? undefined;
    }

    for (const mk of months) {
      if (have.has(mk)) continue;
      const period = `${mk}-01`;
      const name = `${clientName ?? e.name} — ${labelOfKey(mk)}`;
      const row = await prisma.deskCycle.create({
        data: { name, engagement: e.id, period, stage: 'Awaiting Close', slaDue: monthlyCloseDate(period), createdBy: actor.id, updatedBy: actor.id },
      });
      await recordDeskAudit({ action: 'record_created', actorId: actor.id, actorEmail: actor.email, board: 'cycles', recordId: row.id, summary: `${name} (auto-generated)` });
      created.push({ id: row.id, name, period });
      have.add(mk);
    }
  }
  return created;
}
