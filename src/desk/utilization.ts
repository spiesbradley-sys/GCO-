// Live workload utilization for desk staff. Derived on read from current
// assignments (engagements, in-flight cycles, review gates, open queries) and
// NEVER stored — same philosophy as compute.ts. There is no time tracking, so
// "utilization" = weighted open workload / a per-role capacity.
//
// Each engagement can carry its own `capacity` (load points per month). When
// set it REPLACES the default engagement + cycle weights for that engagement;
// reviews, queries and overdue cycles still add on top so the report stays live.
// Engagements under a white-label client (we do the work for THEIR clients,
// e.g. Vincere) default to WHITE_LABEL_DEFAULT instead, and roll up in groups.
//
// Tune WEIGHTS, CAPACITY and WHITE_LABEL_DEFAULT below; everything else follows.

import { businessDays, todayISO, CYCLE_DONE, type Rec } from './compute';
import { pendingCycleReviews, REVIEW_OWNER, type DeskData } from './insights';
import type { DeskRole } from './roles';

/** Load points each kind of open work contributes. */
export const WEIGHTS = {
  engagement: 2, // standing relationship: active/pilot engagement you are assigned to
  cycle: 3, // an in-flight monthly cycle on one of your engagements
  review: 1, // a review gate waiting on you
  query: 1, // an open query you own
  overdue: 2, // extra on top of `cycle` when its SLA date has passed
} as const;

/** Monthly load of one end-client engagement under a white-label client when
 * no explicit capacity is set (Vincere: ~5 hrs/client vs ~5 pts for a standard
 * managed engagement). */
export const WHITE_LABEL_DEFAULT = 1;

/** Share of an engagement's standing load a controller carries when they are its
 * controller but not its accountant (the accountant does the production work).
 * Applies to the standing load only; reviews, queries and overdue count in full. */
export const CONTROLLER_SHARE = 0.5;

/** Round a points figure for display (shares can be fractional). */
export const fmtPts = (n: number): string => String(Math.round(n * 10) / 10);

/** Load points a person can carry at 100% utilization, by role. */
export const CAPACITY: Record<DeskRole, number> = {
  accountant: 24,
  controller: 30,
  management: 20,
  owner: 12,
};

export type UtilBand = 'idle' | 'under' | 'healthy' | 'high' | 'over';

/** <25% idle · <60% under · 60–90% healthy · 90–110% high · >110% over. */
export function utilBand(pct: number): UtilBand {
  if (pct < 25) return 'idle';
  if (pct < 60) return 'under';
  if (pct <= 90) return 'healthy';
  if (pct <= 110) return 'high';
  return 'over';
}

/** One engagement's contribution to a person's load. */
export type UtilLine = {
  id: string; // engagement id
  name: string;
  client: string; // the engagement's client; for a white-label engagement, the end client
  whiteLabel: boolean;
  parentId: string | null; // the white-label parent of `client`, when it is an end client
  parentName: string;
  capacity: number | null; // explicit value on the engagement, if any
  baseline: number; // the ENGAGEMENT's standing load: explicit capacity, white-label default, or engagement + cycles
  usingDefault: boolean; // true when no explicit capacity is set
  share: number; // fraction of the baseline this person carries (1, or CONTROLLER_SHARE as controller-only)
  cycles: number;
  reviews: number;
  queries: number;
  overdue: number;
  points: number;
};

/** A white-label client's end-client engagements roll up into one group; any
 * other engagement is its own single-line group. */
export type UtilGroup = { key: string; label: string; whiteLabel: boolean; lines: UtilLine[]; points: number };

export type UtilRow = {
  id: string;
  name: string;
  role: DeskRole;
  engagements: number;
  cycles: number;
  reviews: number;
  queries: number;
  overdue: number;
  dueSoon: number; // in-flight cycles with an SLA date within 5 business days
  groups: UtilGroup[];
  otherQueries: number; // queries they own that aren't on one of their engagements
  points: number;
  capacity: number;
  pct: number; // whole-number percentage; may exceed 100
  band: UtilBand;
};

export type Utilization = {
  rows: UtilRow[]; // sorted busiest first
  summary: { people: number; avgPct: number; over: number; high: number; idle: number; overdue: number };
};

type Person = { id: string; name: string | null; email: string; role: string };

const wholeOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** Utilization for one person, from the data as loaded. */
export function personUtilization(data: DeskData, person: Person, today = todayISO()): UtilRow {
  const role = person.role as DeskRole;
  const clientById = new Map((data.clients as Rec[]).map((c) => [c.id, c]));
  const engagements = (data.engagements as Rec[]).filter(
    (e) => (e.bookkeeper === person.id || e.controller === person.id) && ['Active', 'Pilot'].includes(e.status as string),
  );
  const cycles = data.cycles as Rec[];
  const openQueries = (data.queries as Rec[]).filter((q) => q.owner === person.id && q.status !== 'Resolved');

  const lines: UtilLine[] = engagements.map((e) => {
    const client = clientById.get(e.client) as Rec | undefined;
    // An end client's parent (e.g. Vincere) is what carries the white-label flag.
    const parent = client?.parent ? (clientById.get(client.parent) as Rec | undefined) : undefined;
    const whiteLabel = Boolean(client?.whiteLabel || parent?.whiteLabel);
    const isBk = e.bookkeeper === person.id;
    const isCtrl = e.controller === person.id;
    const share = isCtrl && !isBk ? CONTROLLER_SHARE : 1;

    const inFlight = cycles.filter((c) => c.engagement === e.id && !CYCLE_DONE.includes(c.stage as string) && c.stage !== 'Closed');
    let reviews = 0;
    for (const c of inFlight) {
      for (const gate of pendingCycleReviews(c)) {
        const owner = REVIEW_OWNER[gate];
        if ((owner === 'accountant' && isBk) || (owner === 'controller' && isCtrl)) reviews++;
      }
    }
    const overdue = inFlight.filter((c) => c.slaDue && c.slaStatus !== 'Met' && (c.slaDue as string) < today).length;
    const cycleIds = new Set(cycles.filter((c) => c.engagement === e.id).map((c) => c.id));
    const queries = openQueries.filter((q) => cycleIds.has(q.cycle)).length;

    const explicit = wholeOrNull(e.capacity);
    const baseline = explicit ?? (whiteLabel ? WHITE_LABEL_DEFAULT : WEIGHTS.engagement + inFlight.length * WEIGHTS.cycle);

    return {
      id: e.id as string,
      name: (e.name as string) || 'Untitled',
      client: ((client?.name as string) || '') as string,
      whiteLabel,
      capacity: explicit,
      baseline,
      usingDefault: explicit === null,
      share,
      cycles: inFlight.length,
      reviews,
      queries,
      overdue,
      points: baseline * share + reviews * WEIGHTS.review + queries * WEIGHTS.query + overdue * WEIGHTS.overdue,
      parentId: (parent?.id as string) ?? null,
      parentName: ((parent?.name as string) ?? '') as string,
    };
  });

  // Queries they own that don't sit on one of their engagements still count.
  const counted = new Set(lines.flatMap((l) => cycles.filter((c) => c.engagement === l.id).map((c) => c.id)));
  const otherQueries = openQueries.filter((q) => !counted.has(q.cycle)).length;

  // Group white-label end-client engagements under their client.
  const groups: UtilGroup[] = [];
  const byClient = new Map<string, UtilGroup>();
  for (const l of lines) {
    const e = engagements.find((x) => x.id === l.id) as Rec;
    if (l.whiteLabel && e.client) {
      // End clients group under their white-label parent; an engagement held
      // directly on the white-label client groups under that client.
      const key = `wl:${l.parentId ?? e.client}`;
      let g = byClient.get(key);
      if (!g) {
        g = { key, label: l.parentName || l.client || 'White-label client', whiteLabel: true, lines: [], points: 0 };
        byClient.set(key, g);
        groups.push(g);
      }
      g.lines.push(l);
      g.points += l.points;
    } else {
      groups.push({ key: l.id, label: l.name, whiteLabel: false, lines: [l], points: l.points });
    }
  }
  groups.sort((a, b) => b.points - a.points || a.label.localeCompare(b.label));

  const dueSoon = engagements.reduce((n, e) => {
    return (
      n +
      cycles.filter((c) => {
        if (c.engagement !== e.id || CYCLE_DONE.includes(c.stage as string) || c.stage === 'Closed') return false;
        if (!c.slaDue || c.slaStatus === 'Met' || (c.slaDue as string) < today) return false;
        return businessDays(today, c.slaDue as string) <= 5;
      }).length
    );
  }, 0);

  const points = lines.reduce((a, l) => a + l.points, 0) + otherQueries * WEIGHTS.query;
  const capacity = CAPACITY[role] ?? CAPACITY.accountant;
  const pct = Math.round((points / capacity) * 100);

  return {
    id: person.id,
    name: person.name || person.email,
    role,
    engagements: lines.length,
    cycles: lines.reduce((a, l) => a + l.cycles, 0),
    reviews: lines.reduce((a, l) => a + l.reviews, 0),
    queries: openQueries.length,
    overdue: lines.reduce((a, l) => a + l.overdue, 0),
    dueSoon,
    groups,
    otherQueries,
    points,
    capacity,
    pct,
    band: utilBand(pct),
  };
}

/**
 * Who a viewer may see in the report. Accountants: only themselves.
 * Controllers: themselves plus the accountants on engagements they control.
 * Owner / management: every active person.
 */
export function visiblePeople(data: DeskData, viewer: { id: string; role: DeskRole }): Person[] {
  const active = data.users.filter((u) => u.isActive);
  if (viewer.role === 'owner' || viewer.role === 'management') return active;
  if (viewer.role === 'controller') {
    const reports = new Set(
      (data.engagements as Rec[])
        .filter((e) => e.controller === viewer.id && e.bookkeeper)
        .map((e) => e.bookkeeper as string),
    );
    return active.filter((u) => u.id === viewer.id || reports.has(u.id));
  }
  return active.filter((u) => u.id === viewer.id);
}

/** The live report for a viewer. People with no assignments and no capacity
 * pressure are kept (so spare capacity is visible) except owner/management
 * with nothing assigned, who are not part of delivery. */
export function utilization(data: DeskData, viewer: { id: string; role: DeskRole }, today = todayISO()): Utilization {
  const rows = visiblePeople(data, viewer)
    .map((p) => personUtilization(data, p, today))
    .filter((r) => r.points > 0 || r.role === 'accountant' || r.role === 'controller' || r.id === viewer.id)
    .sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name));

  const n = rows.length;
  return {
    rows,
    summary: {
      people: n,
      avgPct: n ? Math.round(rows.reduce((a, r) => a + r.pct, 0) / n) : 0,
      over: rows.filter((r) => r.band === 'over').length,
      high: rows.filter((r) => r.band === 'high').length,
      idle: rows.filter((r) => r.band === 'idle').length,
      overdue: rows.reduce((a, r) => a + r.overdue, 0),
    },
  };
}
