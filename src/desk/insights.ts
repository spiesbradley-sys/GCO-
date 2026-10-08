// Pure business logic shared by the dashboard (server) and the record drawer
// (client): record warnings, the ranked attention list, and the full Overview
// aggregation. Ported from the reference liveBits()/attention()/renderHome().
// Money is in cents; callers format.

import {
  businessDays,
  cycleSev,
  dealClockUsed,
  margin,
  openBlockers,
  rack,
  todayISO,
  CYCLE_DONE,
  DEAL_DONE,
  type Rec,
} from './compute';
import { BOARDS } from './boards';
import type { BoardKey } from './roles';

export type DeskData = {
  intake: Rec[];
  clients: Rec[];
  engagements: Rec[];
  cycles: Rec[];
  queries: Rec[];
  deliverables: Rec[];
  deals: Rec[];
  pnl: Rec[];
  users: { id: string; name: string | null; email: string; role: string; isActive: boolean }[];
};

const rec = (data: DeskData, b: BoardKey, id: unknown) => (data[b] as Rec[]).find((r) => r.id === id);
const money0 = (v: unknown) => Number(v) || 0;

// ── Record warnings (drawer) ──────────────────────────────────────────────────
export function recordWarnings(board: BoardKey, r: Rec, data: DeskData): string[] {
  const w: string[] = [];
  const t = todayISO();
  if (board === 'cycles') {
    const e = rec(data, 'engagements', r.engagement);
    const c = e && rec(data, 'clients', e.client);
    if (c && c.access !== 'Full access live')
      w.push(`${c.name} systems access is "${c.access || 'not recorded'}". A cycle should never start against that.`);
    if (r.stage === 'Closed' && !(data.deliverables as Rec[]).some((d) => d.cycle === r.id))
      w.push('Closed without a filed deliverable. File the pack before closing.');
    if (CYCLE_DONE.includes(r.stage as string) && !(r.capture && r.bkReview && r.ctrlReview))
      w.push('Delivered before all three review gates were ticked.');
    if (r.slaDue && r.slaStatus !== 'Met') {
      const n = businessDays(t, r.slaDue as string);
      w.push(n >= 0 ? `SLA due in ${n} business day${n === 1 ? '' : 's'}.` : `SLA due date passed ${-n} business day${n === -1 ? '' : 's'} ago.`);
    }
  }
  if (board === 'engagements' && r.service === 'Managed Bookkeeping' && (r.slaDelivery == null || r.slaDelivery === ''))
    w.push('No SLA terms set. Standard is 5 / 5 / 1 business days.');
  if (board === 'deliverables' && !r.qc) w.push('No QC sign-off name yet. Nothing reaches a client without one.');
  if (board === 'deals' && r.posture === 'PHI')
    w.push('PHI deal: signed BAA before any data moves, and de-identify exports before analysis.');
  if (board === 'deals') {
    const x = rack(r.locations as number);
    if (x && r.fee && money0(r.fee) < x.feeCents)
      w.push(`Billed below rack rate for ${r.locations} location${(r.locations as number) > 1 ? 's' : ''}. Scope and clock still hold.`);
  }
  return w;
}

// ── Needs attention (dashboard) ───────────────────────────────────────────────
export type Attn = { sev: 'bad' | 'warn' | 'info'; b: BoardKey; id: string; t: string; d: string };

export function attention(data: DeskData): Attn[] {
  const out: Attn[] = [];
  const t = todayISO();
  const fd = (d: unknown) => (d ? d : 'not set');

  (data.cycles as Rec[]).forEach((c) => {
    const s = cycleSev(c, t);
    if (s) out.push({ sev: s, b: 'cycles', id: c.id as string, t: c.name as string, d: `SLA ${c.slaStatus || 'open'} · due ${fd(c.slaDue)}` });
  });
  (data.queries as Rec[])
    .filter((q) => q.status !== 'Resolved')
    .forEach((q) => {
      const age = q.raised ? businessDays(q.raised as string, t) : 0;
      out.push({
        sev: age > 1 ? 'bad' : 'warn',
        b: 'queries',
        id: q.id as string,
        t: q.name as string,
        d: `${q.status || 'Open'} · raised ${q.raised || 'undated'}${age > 1 ? ' · past 1 BD response' : ''}${q.blocks ? ' · pausing clock' : ''}`,
      });
    });
  (data.clients as Rec[])
    .filter((c) => c.letter && c.status !== 'Offboarded' && c.access !== 'Full access live')
    .forEach((c) => out.push({ sev: 'warn', b: 'clients', id: c.id as string, t: c.name as string, d: `Letter signed, systems access ${c.access ? String(c.access).toLowerCase() : 'not recorded'}. No cycle should start against this.` }));
  (data.engagements as Rec[])
    .filter((e) => e.service === 'Managed Bookkeeping' && ['Active', 'Pilot'].includes(e.status as string) && (e.slaDelivery == null || e.slaDelivery === ''))
    .forEach((e) => out.push({ sev: 'warn', b: 'engagements', id: e.id as string, t: e.name as string, d: 'Active managed engagement with no SLA terms set.' }));
  (data.engagements as Rec[])
    .filter((e) => e.service === 'Managed Bookkeeping' && e.status === 'Active' && !(data.cycles as Rec[]).some((c) => c.engagement === e.id))
    .forEach((e) => out.push({ sev: 'info', b: 'engagements', id: e.id as string, t: e.name as string, d: 'Active, but no monthly cycle has been opened yet.' }));
  (data.deals as Rec[])
    .filter((d) => DEAL_DONE.includes(d.stage as string) && d.payment !== 'Paid')
    .forEach((d) => out.push({ sev: 'warn', b: 'deals', id: d.id as string, t: d.name as string, d: `Finalized, payment ${String(d.payment || 'not billed').toLowerCase()}. Terms are 7 days from invoice.` }));
  (data.deals as Rec[])
    .filter((d) => d.dataReceived && !d.finalized)
    .forEach((d) => {
      const x = rack(d.locations as number);
      const used = dealClockUsed(d, t) ?? 0;
      if (x && used > x.days) out.push({ sev: 'bad', b: 'deals', id: d.id as string, t: d.name as string, d: `Draft clock at ${used} BD against a ${x.days} BD target.` });
    });

  const rank = { bad: 0, warn: 1, info: 2 };
  return out.sort((a, b) => rank[a.sev] - rank[b.sev]);
}

// ── My Day (personal to-do dashboard) ─────────────────────────────────────────
export type MyDayAction = 'review-capture' | 'review-bk' | 'review-ctrl' | 'open-cycle' | 'resolve-query';
export type MyDayItem = {
  b: BoardKey;
  id: string; // record to open / act on (engagement id for open-cycle)
  title: string;
  sub: string;
  chipText?: string;
  chipTone?: 'danger' | 'warning' | 'neutral';
  action?: MyDayAction;
  who?: string; // whose item this is, in a team/role roll-up view
};
export type MyDay = {
  name: string;
  counts: { dueToday: number; overdue: number; queries: number; inFlight: number };
  dueAndOverdue: MyDayItem[];
  waiting: MyDayItem[];
  queries: MyDayItem[];
  thisWeek: MyDayItem[];
};

/** Personal, assignment-scoped to-do list for one desk user. Works for any role:
 * it looks only at engagements where the user is the accountant or controller. */
export function myDay(data: DeskData, viewer: { id: string; name: string | null; email: string }): MyDay {
  const t = todayISO();
  const mine = (data.engagements as Rec[]).filter((e) => e.bookkeeper === viewer.id || e.controller === viewer.id);
  const myIds = new Set(mine.map((e) => e.id));
  const asAccountant = new Set(mine.filter((e) => e.bookkeeper === viewer.id).map((e) => e.id));
  const asController = new Set(mine.filter((e) => e.controller === viewer.id).map((e) => e.id));

  const partyOf = (engId: unknown): string => {
    const e = rec(data, 'engagements', engId);
    const c = e && rec(data, 'clients', (e as Rec).client);
    return ((c as Rec | undefined)?.name as string) || ((e as Rec | undefined)?.name as string) || 'Unassigned';
  };

  const cycles = (data.cycles as Rec[]).filter((c) => myIds.has(c.engagement));
  const inFlight = cycles.filter((c) => !CYCLE_DONE.includes(c.stage as string) && c.stage !== 'Closed');

  // Due today & overdue
  const dueAndOverdue: MyDayItem[] = inFlight
    .filter((c) => c.slaDue && (c.slaDue as string) <= t)
    .sort((a, b) => String(a.slaDue).localeCompare(String(b.slaDue)))
    .map((c) => {
      const overdue = (c.slaDue as string) < t;
      const late = overdue ? businessDays(c.slaDue as string, t) : 0;
      return {
        b: 'cycles' as BoardKey,
        id: c.id as string,
        title: c.name as string,
        sub: `${partyOf(c.engagement)} · ${(c.stage as string) || 'No stage'}`,
        chipText: overdue ? `${late} BD late` : 'Due today',
        chipTone: overdue ? ('danger' as const) : ('warning' as const),
      };
    });

  // Waiting on you — review gates + engagements with no open cycle
  const waiting: MyDayItem[] = [];
  inFlight.forEach((c) => {
    const base = { b: 'cycles' as BoardKey, id: c.id as string, title: c.name as string };
    if (asAccountant.has(c.engagement)) {
      if (!c.capture && c.stage !== 'Awaiting Close') waiting.push({ ...base, sub: `${partyOf(c.engagement)} · capture not done`, action: 'review-capture' });
      else if (c.capture && !c.bkReview) waiting.push({ ...base, sub: `${partyOf(c.engagement)} · bookkeeper review not ticked`, action: 'review-bk' });
    }
    if (asController.has(c.engagement) && !c.ctrlReview && ['Review', 'Dashboard Prep'].includes(c.stage as string)) {
      waiting.push({ ...base, sub: `${partyOf(c.engagement)} · controller review pending`, action: 'review-ctrl' });
    }
  });
  mine
    .filter((e) => e.service === 'Managed Bookkeeping' && ['Active', 'Pilot'].includes(e.status as string))
    .filter((e) => !(data.cycles as Rec[]).some((c) => c.engagement === e.id && c.stage !== 'Closed'))
    .forEach((e) => waiting.push({ b: 'engagements', id: e.id as string, title: e.name as string, sub: `${partyOf(e.id)} · no cycle opened yet`, action: 'open-cycle' }));

  // Open queries on my engagements (or that I own)
  const myCycleIds = new Set(cycles.map((c) => c.id));
  const queries: MyDayItem[] = (data.queries as Rec[])
    .filter((q) => q.status !== 'Resolved' && (q.owner === viewer.id || myCycleIds.has(q.cycle)))
    .map((q) => {
      const age = q.raised ? businessDays(q.raised as string, t) : 0;
      const cyc = rec(data, 'cycles', q.cycle);
      return {
        item: {
          b: 'queries' as BoardKey,
          id: q.id as string,
          title: q.name as string,
          sub: `${cyc ? partyOf((cyc as Rec).engagement) : 'No cycle'} · ${(q.status as string) || 'Open'}`,
          chipText: age > 1 ? `${age} BD · past SLA` : `${age} BD`,
          chipTone: age > 1 ? ('danger' as const) : ('warning' as const),
          action: 'resolve-query' as MyDayAction,
        },
        age,
      };
    })
    .sort((a, b) => b.age - a.age)
    .map((x) => x.item);

  // Coming up — due within the next 5 business days
  const thisWeek: MyDayItem[] = inFlight
    .filter((c) => c.slaDue && (c.slaDue as string) > t && businessDays(t, c.slaDue as string) <= 5)
    .sort((a, b) => String(a.slaDue).localeCompare(String(b.slaDue)))
    .map((c) => {
      const n = businessDays(t, c.slaDue as string);
      return { b: 'cycles' as BoardKey, id: c.id as string, title: c.name as string, sub: `${partyOf(c.engagement)} · ${(c.stage as string) || 'No stage'}`, chipText: `in ${n} BD`, chipTone: 'neutral' as const };
    });

  return {
    name: viewer.name || viewer.email,
    counts: {
      dueToday: dueAndOverdue.filter((i) => i.chipText === 'Due today').length,
      overdue: dueAndOverdue.filter((i) => i.chipTone === 'danger').length,
      queries: queries.length,
      inFlight: inFlight.length,
    },
    dueAndOverdue,
    waiting,
    queries,
    thisWeek,
  };
}

/** Combined My Day across several people (a whole role, for a department head).
 * Each item is tagged with whose it is. */
export function myDayForMembers(
  data: DeskData,
  members: { id: string; name: string | null; email: string }[],
  label: string,
): MyDay {
  const merged: MyDay = {
    name: label,
    counts: { dueToday: 0, overdue: 0, queries: 0, inFlight: 0 },
    dueAndOverdue: [],
    waiting: [],
    queries: [],
    thisWeek: [],
  };
  for (const m of members) {
    const d = myDay(data, m);
    const who = (m.name || m.email).split(' ')[0] || (m.name ?? m.email);
    const tag = (items: MyDayItem[]) => items.map((i) => ({ ...i, who }));
    merged.dueAndOverdue.push(...tag(d.dueAndOverdue));
    merged.waiting.push(...tag(d.waiting));
    merged.queries.push(...tag(d.queries));
    merged.thisWeek.push(...tag(d.thisWeek));
    merged.counts.dueToday += d.counts.dueToday;
    merged.counts.overdue += d.counts.overdue;
    merged.counts.queries += d.counts.queries;
    merged.counts.inFlight += d.counts.inFlight;
  }
  return merged;
}

// ── Recurring revenue ─────────────────────────────────────────────────────────
export type RecurringRow = { id: string; name: string; client: string; feeCents: number; status: string; start: string; annualCents: number };
export type RecurringRevenue = { rows: RecurringRow[]; liveCents: number; pilotCents: number; pausedCents: number; activeCount: number };

/** Canonical recurring revenue: one row per managed-accounting engagement (the
 * accounting clients), using the engagement's monthly fee — NOT the month-by-
 * month P&L rows, which double-count a client that has several monthly rows. */
export function recurringRevenue(data: DeskData): RecurringRevenue {
  const clientName = (id: unknown) => (data.clients as Rec[]).find((c) => c.id === id)?.name as string | undefined;
  const rows: RecurringRow[] = (data.engagements as Rec[])
    .filter((e) => e.service === 'Managed Bookkeeping' && ['Active', 'Pilot', 'Paused'].includes(e.status as string))
    .map((e) => {
      const fee = money0(e.fee);
      return { id: e.id as string, name: e.name as string, client: clientName(e.client) ?? '', feeCents: fee, status: (e.status as string) || '', start: (e.start as string) || '', annualCents: fee * 12 };
    })
    .sort((a, b) => b.feeCents - a.feeCents);
  const sumBy = (s: string) => rows.filter((r) => r.status === s).reduce((a, r) => a + r.feeCents, 0);
  return { rows, liveCents: sumBy('Active'), pilotCents: sumBy('Pilot'), pausedCents: sumBy('Paused'), activeCount: rows.filter((r) => r.status === 'Active').length };
}

// ── Dashboard aggregation ─────────────────────────────────────────────────────
function monthKey(s: unknown): number | null {
  if (!s) return null;
  const d = new Date('1 ' + String(s));
  return isNaN(d.getTime()) ? null : d.getFullYear() * 12 + d.getMonth();
}
export function monthLabel(k: number): string {
  return new Date(Math.floor(k / 12), k % 12, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

export type Kpi = { label: string; value: string; sub: string; flag?: boolean };

export function deskDashboard(data: DeskData) {
  const P = data.pnl, D = data.deals, Q = data.queries, C = data.cycles, CL = data.clients, E = data.engagements;
  const t = todayISO();

  // Recurring revenue comes from the engagements (one per client), not the
  // month-by-month P&L rows — see recurringRevenue().
  const rr = recurringRevenue(data);
  const live = rr.liveCents;
  const soon = rr.pilotCents;
  const rev = P.reduce((a, r) => a + money0(r.revenue), 0);
  const costed = P.filter((r) => r.delivery != null && r.delivery !== '');
  const costedRev = costed.reduce((a, r) => a + money0(r.revenue), 0);
  const costedGm = costed.reduce((a, r) => a + margin(r), 0);
  const nowKey = monthKey(new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
  const thisMonth = P.filter((r) => monthKey(r.month) === nowKey).reduce((a, r) => a + money0(r.revenue), 0);
  const unpaid = D.filter((d) => d.payment !== 'Paid' && (DEAL_DONE.includes(d.stage as string) || d.payment === 'Billed' || d.payment === 'Delayed'));
  const inflight = D.filter((d) => !DEAL_DONE.includes(d.stage as string));
  const openQ = Q.filter((q) => q.status !== 'Resolved');
  const pausing = openQ.filter((q) => q.blocks).length;
  const activeCycles = C.filter((c) => c.stage !== 'Closed');
  const withDates = C.filter((c) => c.delivered && c.slaDue);
  const onTime = withDates.filter((c) => (c.delivered as string) <= (c.slaDue as string)).length;
  const dueSoon = C.filter((c) => c.slaDue && c.slaStatus !== 'Met' && !CYCLE_DONE.includes(c.stage as string))
    .map((c) => ({ c, n: businessDays(t, c.slaDue as string) }))
    .filter((x) => x.n <= 10)
    .sort((a, b) => a.n - b.n);
  const activeMB = E.filter((e) => e.service === 'Managed Bookkeeping' && ['Active', 'Pilot'].includes(e.status as string));
  const noCycle = activeMB.filter((e) => !C.some((c) => c.engagement === e.id && c.stage !== 'Closed'));

  const fmtMoney = (c: number) => '$' + Math.round(c / 100).toLocaleString('en-US');

  const commercialKpis: Kpi[] = [
    { label: 'Recurring revenue live', value: `${fmtMoney(live)}/mo`, sub: `${fmtMoney(live * 12)} annual run-rate${soon ? ` · +${fmtMoney(soon)}/mo in pilot` : ''}` },
    { label: 'Booked this month', value: fmtMoney(thisMonth), sub: `${fmtMoney(rev)} across all ${P.length} P&L rows` },
    { label: 'Gross margin (costed rows)', value: `${costedRev ? Math.round((costedGm / costedRev) * 100) : 0}%`, sub: `${fmtMoney(costedGm)} on ${fmtMoney(costedRev)}${costed.length < P.length ? ` · ${P.length - costed.length} uncosted excluded` : ''}`, flag: costed.length < P.length },
    { label: 'QoE fees awaiting payment', value: fmtMoney(unpaid.reduce((a, d) => a + money0(d.fee), 0)), sub: `${unpaid.length} deal${unpaid.length === 1 ? '' : 's'} · ${inflight.length} in flight worth ${fmtMoney(inflight.reduce((a, d) => a + money0(d.fee), 0))}`, flag: unpaid.length > 0 },
  ];
  const deliveryKpis: Kpi[] = [
    { label: 'Cycles in production', value: String(activeCycles.length), sub: `${activeMB.length} live managed engagement${activeMB.length === 1 ? '' : 's'}${noCycle.length ? ` · ${noCycle.length} with no open cycle` : ''}` },
    { label: 'SLA due in 10 business days', value: String(dueSoon.length), sub: `${dueSoon.filter((x) => x.n < 0).length} overdue`, flag: dueSoon.some((x) => x.n < 0) },
    { label: 'Open queries & blockers', value: String(openQ.length), sub: `${pausing} pausing an SLA clock`, flag: openQ.length > 0 },
    { label: 'Delivered on SLA date', value: withDates.length ? `${Math.round((onTime / withDates.length) * 100)}%` : '—', sub: `${onTime} of ${withDates.length} cycles with both dates` },
  ];

  // Delivery panels
  const stageField = BOARDS.cycles.fields.find((f) => f.k === 'stage')!;
  const stageCounts = stageField.o!.map((o) => ({ name: o.name, n: C.filter((c) => c.stage === o.name).length }));
  const dueList = dueSoon.map(({ c, n }) => ({ id: c.id as string, name: c.name as string, n, stage: (c.stage as string) || 'No stage', slaDue: c.slaDue as string, blockers: openBlockers(Q, c.id as string).length }));
  const ageBuckets = [[0, 0, 'Today'], [1, 2, '1–2 BD'], [3, 5, '3–5 BD'], [6, 1e9, 'Over 5 BD']].map(([a, b, l]) => ({
    l: l as string,
    n: openQ.filter((q) => { const x = q.raised ? businessDays(q.raised as string, t) : 0; return x >= (a as number) && x <= (b as number); }).length,
  }));
  const typeField = BOARDS.queries.fields.find((f) => f.k === 'type')!;
  const queryTypes = typeField.o!.map((o) => ({ name: o.name, n: openQ.filter((q) => q.type === o.name).length })).filter((x) => x.n);
  const workload = data.users
    .filter((u) => u.isActive)
    .map((u) => ({
      name: u.name || u.email,
      deals: D.filter((d) => d.owner === u.id && !DEAL_DONE.includes(d.stage as string)).length,
      reviews: D.filter((d) => d.reviewer === u.id && !DEAL_DONE.includes(d.stage as string)).length,
      cycles: activeCycles.filter((c) => { const e = rec(data, 'engagements', c.engagement); return e && (e.bookkeeper === u.id || e.controller === u.id); }).length,
      queries: openQ.filter((q) => q.owner === u.id).length,
    }))
    .filter((x) => x.deals + x.reviews + x.cycles + x.queries);
  const clientReadiness = CL.filter((c) => c.status !== 'Offboarded')
    .map((c) => {
      const engs = E.filter((e) => e.client === c.id).map((e) => e.id);
      const bl = openQ.filter((q) => { const cy = rec(data, 'cycles', q.cycle); return cy && engs.includes(cy.engagement); }).length;
      return { id: c.id as string, name: c.name as string, status: (c.status as string) || '', letter: Boolean(c.letter), access: (c.access as string) || '', bank: (c.bank as string) || '', onboarding: (c.onboarding as string) || '', feeCents: money0(c.fee), blockers: bl };
    });

  // Commercial panels
  const keys = P.map((r) => monthKey(r.month)).filter((x): x is number => x != null);
  let revenueByMonth: { k: number; label: string; recurring: number; oneoff: number }[] = [];
  if (keys.length) {
    const lo = Math.min(...keys), hi = Math.max(...keys);
    for (let m = lo; m <= hi; m++) {
      const rs = P.filter((r) => monthKey(r.month) === m);
      revenueByMonth.push({
        k: m,
        label: monthLabel(m),
        recurring: rs.filter((r) => r.revType === 'Recurring (monthly)').reduce((a, r) => a + money0(r.revenue), 0),
        oneoff: rs.filter((r) => r.revType !== 'Recurring (monthly)').reduce((a, r) => a + money0(r.revenue), 0),
      });
    }
  }
  const marginByEngagement = P.map((r) => ({ name: r.name as string, m: margin(r), pct: money0(r.revenue) ? (margin(r) / money0(r.revenue)) * 100 : 0, costed: r.delivery != null && r.delivery !== '' }))
    .sort((a, b) => Number(b.costed) - Number(a.costed) || a.pct - b.pct);
  const svcField = BOARDS.pnl.fields.find((f) => f.k === 'service')!;
  const revenueMix = svcField.o!.map((o) => ({ name: o.name, v: P.filter((r) => r.service === o.name).reduce((a, r) => a + money0(r.revenue), 0) })).filter((x) => x.v).sort((a, b) => b.v - a.v);
  const phaseDefs: [string, string[]][] = [
    ['Intro & LoE', ['Intro', 'LoE sent', 'LoE signed by dentist', 'LoE counter-signed by GCO Partners']],
    ['Data & analysis', ['Data received', 'Analysis Started - Info Outstanding', 'Analysis - Outstanding Info received', 'Analysis (Hillary)']],
    ['Review & feedback', ['Review (Bradley)', 'LqE sent to broker - awaiting feedback']],
    ['Finalized', DEAL_DONE],
  ];
  const pipelinePhases = phaseDefs.map(([l, s]) => { const ds = D.filter((d) => s.includes(d.stage as string)); return { l, n: ds.length, v: ds.reduce((a, d) => a + money0(d.fee), 0) }; });
  const turnaround = D.filter((d) => d.dataReceived && d.finalized && rack(d.locations as number))
    .map((d) => ({ name: (d.name as string).split('—').pop()!.trim(), used: businessDays(d.dataReceived as string, d.finalized as string), target: rack(d.locations as number)!.days }));
  const concMap: Record<string, number> = {};
  D.forEach((d) => { const k = d.source === 'Direct' ? 'Direct' : (d.broker as string) || 'Unknown broker'; concMap[k] = (concMap[k] || 0) + money0(d.fee); });
  const concentration = Object.entries(concMap).map(([name, v]) => ({ name, v })).sort((a, b) => b.v - a.v);
  const clientFees = CL.filter((c) => ['Ongoing', 'Pilot'].includes(c.status as string) && c.fee).map((c) => ({ name: c.name as string, v: money0(c.fee) })).sort((a, b) => b.v - a.v);

  return {
    commercialKpis,
    deliveryKpis,
    attention: attention(data),
    delivery: { stageCounts, dueList, ageBuckets, queryTypes, workload, clientReadiness, noCycleCount: noCycle.length },
    commercial: { revenueByMonth, marginByEngagement, revenueMix, pipelinePhases, turnaround, concentration, clientFees, rev },
  };
}
