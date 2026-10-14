import 'server-only';
import { prisma } from '@/lib/prisma';
import { monthlyCloseDate, closeMonthsBetween, frequencyOf, periodLabel, CLOSE_SLA_BD, WHITE_LABEL_CLOSE_BD } from '@/desk/compute';
import { recordDeskAudit } from '@/lib/desk/audit';
import { notifyUsers } from '@/lib/desk/notify';

// Automatic cycle generation. For every live managed-accounting engagement we
// make sure a cycle exists for each close period its frequency calls for — every
// month for Monthly engagements, only quarter-end months (Mar/Jun/Sep/Dec) for
// Quarterly ones. The cron ensures the current period going forward; a manual
// run can backfill missed ones. Idempotent: a cycle is only created when none
// exists for that engagement + month.

const BACKFILL_CAP_MONTHS = 18;

function ym(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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

/** Business days after month-end an engagement's books must be closed: 8 for a
 * white-label client (or an end client of one), 5 otherwise. */
export async function closeBdFor(engagementId: unknown): Promise<number> {
  if (!engagementId) return CLOSE_SLA_BD;
  const e = await prisma.deskEngagement.findUnique({ where: { id: String(engagementId) }, select: { client: true } });
  if (!e?.client) return CLOSE_SLA_BD;
  const c = await prisma.deskClient.findUnique({ where: { id: e.client }, select: { whiteLabel: true, parent: true } });
  if (c?.whiteLabel) return WHITE_LABEL_CLOSE_BD;
  if (c?.parent) {
    const p = await prisma.deskClient.findUnique({ where: { id: c.parent }, select: { whiteLabel: true } });
    if (p?.whiteLabel) return WHITE_LABEL_CLOSE_BD;
  }
  return CLOSE_SLA_BD;
}

export type EnsureOpts = { backfill?: boolean; now?: Date };
export type GeneratedCycle = { id: string; name: string; period: string };

/**
 * Ensure cycles exist for all live managed-accounting engagements.
 * `backfill` fills every close period from the engagement's start (capped) up to
 * the current month; otherwise only the current month is ensured (which, for a
 * quarterly engagement, means nothing outside a quarter-end month). The
 * engagement's accountant and controller carry through via the cycle's
 * engagement link.
 */
export async function ensureMonthlyCycles(actor: { id: string; email: string }, opts: EnsureOpts = {}): Promise<GeneratedCycle[]> {
  const now = opts.now ?? new Date();
  const cur = ym(now);
  const engagements = await prisma.deskEngagement.findMany({
    where: { service: 'Managed Bookkeeping', status: { in: ['Active', 'Pilot'] } },
    select: { id: true, name: true, client: true, start: true, bookkeeper: true, controller: true, frequency: true },
  });

  const created: GeneratedCycle[] = [];
  for (const e of engagements) {
    const freq = frequencyOf(e);
    const months = closeMonthsBetween(freq, opts.backfill ? backfillStartKey(e.start, now) : cur, cur);
    if (months.length === 0) continue;
    const existing = await prisma.deskCycle.findMany({ where: { engagement: e.id }, select: { period: true } });
    const have = new Set(existing.map((c) => (c.period ?? '').slice(0, 7)));
    let clientName: string | undefined;
    if (e.client) {
      const c = await prisma.deskClient.findUnique({ where: { id: e.client }, select: { name: true } });
      clientName = c?.name ?? undefined;
    }
    const bd = await closeBdFor(e.id);

    for (const mk of months) {
      if (have.has(mk)) continue;
      const period = `${mk}-01`;
      const name = `${clientName ?? e.name} — ${periodLabel(freq, mk)}`;
      const due = monthlyCloseDate(period, bd);
      const row = await prisma.deskCycle.create({
        data: { name, engagement: e.id, period, stage: 'Awaiting Close', slaDue: due, createdBy: actor.id, updatedBy: actor.id },
      });
      await recordDeskAudit({ action: 'record_created', actorId: actor.id, actorEmail: actor.email, board: 'cycles', recordId: row.id, summary: `${name} (auto-generated)` });
      // Tell the engagement's accountant and controller a new cycle is open.
      await notifyUsers({
        userIds: [e.bookkeeper, e.controller],
        kind: 'cycle',
        board: 'cycles',
        recordId: row.id,
        title: `New ${freq === 'Quarterly' ? 'quarterly' : 'monthly'} cycle: ${name}`,
        body: `A cycle has been opened for ${name}. Capture and close it by the SLA date (${due}).`,
      });
      created.push({ id: row.id, name, period });
      have.add(mk);
    }
  }
  return created;
}
