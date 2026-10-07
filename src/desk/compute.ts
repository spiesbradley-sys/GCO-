// Shared, pure, unit-tested computed values for the desk. These are calculated
// server-side on read and NEVER stored. Money is in integer cents throughout.
//
// Records are passed as plain objects (Record<string, unknown>) so these stay
// decoupled from Prisma types and trivially testable.

export type Rec = Record<string, unknown>;

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Business days between two ISO dates ('YYYY-MM-DD'), excluding Sat/Sun.
 * Signed: negative when b is before a. Mirrors the reference `bdays`.
 */
export function businessDays(aISO: string, bISO: string): number {
  if (!aISO || !bISO) return 0;
  let d = new Date(aISO + 'T00:00:00');
  let e = new Date(bISO + 'T00:00:00');
  if (isNaN(d.getTime()) || isNaN(e.getTime())) return 0;
  let sign = 1;
  if (e < d) {
    [d, e] = [e, d];
    sign = -1;
  }
  let n = 0;
  while (d < e) {
    d.setDate(d.getDate() + 1);
    const w = d.getDay();
    if (w && w < 6) n++;
  }
  return n * sign;
}

export type RackResult = { feeCents: number; days: number };

/** Rack rate (cents) and draft-clock target (business days) by location count. */
export function rack(locations: number | null | undefined): RackResult | null {
  const n = Number(locations);
  if (!n) return null;
  if (n <= 1) return { feeCents: 100_000, days: 3 };
  if (n <= 4) return { feeCents: 150_000, days: 5 };
  if (n <= 7) return { feeCents: 200_000, days: 7 };
  if (n <= 10) return { feeCents: 250_000, days: 10 };
  return { feeCents: 250_000 + 15_000 * (n - 10), days: 10 + (n - 10) };
}

/** Draft-clock status string for a deal. */
export function dealClock(deal: Rec): string {
  const x = rack(deal.locations as number);
  const dataReceived = deal.dataReceived as string | undefined;
  const finalized = deal.finalized as string | undefined;
  if (!dataReceived) return x ? `Not started · target ${x.days} BD` : '';
  const end = finalized || todayISO();
  const used = businessDays(dataReceived, end);
  return `${used} BD${x ? ' of ' + x.days : ''}${finalized ? ' (final)' : ' running'}`;
}

/** Business days used on a deal's draft clock (for comparisons). */
export function dealClockUsed(deal: Rec, today = todayISO()): number | null {
  const dataReceived = deal.dataReceived as string | undefined;
  if (!dataReceived) return null;
  const end = (deal.finalized as string | undefined) || today;
  return businessDays(dataReceived, end);
}

/** Gross margin in cents = revenue - delivery - commission - other. */
export function margin(row: Rec): number {
  const num = (v: unknown) => Number(v) || 0;
  return num(row.revenue) - num(row.delivery) - num(row.commission) - num(row.other);
}

/** Margin as a whole-number percentage, or null when revenue is 0. */
export function marginPct(row: Rec): number | null {
  const rev = Number(row.revenue) || 0;
  if (!rev) return null;
  return Math.round((margin(row) / rev) * 100);
}

/** Query age in business days while unresolved; null once resolved. */
export function queryAge(query: Rec, today = todayISO()): number | null {
  if (query.status === 'Resolved') return null;
  const raised = query.raised as string | undefined;
  return raised ? businessDays(raised, today) : null;
}

/** Open (not resolved) blockers for a cycle, from a list of queries. */
export function openBlockers(queries: Rec[], cycleId: string): Rec[] {
  return queries.filter((q) => q.cycle === cycleId && q.status !== 'Resolved');
}

export const CYCLE_DONE = ['Delivered', 'Meeting Held', 'Closed'];
export const DEAL_DONE = ['LqE finalized', 'Delivered'];

/** Severity for a cycle row: 'bad' | 'warn' | ''. */
export function cycleSev(cycle: Rec, today = todayISO()): 'bad' | 'warn' | '' {
  if (cycle.slaStatus === 'Breached') return 'bad';
  if (cycle.slaStatus === 'At risk') return 'warn';
  const slaDue = cycle.slaDue as string | undefined;
  if (
    slaDue &&
    cycle.slaStatus !== 'Met' &&
    !CYCLE_DONE.includes(cycle.stage as string) &&
    slaDue < today
  ) {
    return 'bad';
  }
  return '';
}
