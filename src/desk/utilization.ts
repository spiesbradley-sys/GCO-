// Monthly utilization for desk staff, in hours. Derived on read from the
// engagements board and NEVER stored — same philosophy as compute.ts.
//
//   hours used    = for every live engagement a person is assigned to:
//                   its accountant hours (if they are the accountant)
//                 + its controller hours (if they are the controller)
//   utilization % = hours used / hours available
//
// Hours available is each person's `monthlyHours` (editable in Owner Admin →
// Staff), falling back to DEFAULT_MONTHLY_HOURS for their role. Paused and
// ended engagements don't count. Hours also roll up by client; a white-label
// client's (Vincere's) end clients sit under it.

import type { Rec } from './compute';
import type { DeskData } from './insights';
import type { DeskRole } from './roles';

/** Hours a person is available per month when Owner Admin hasn't set one. */
export const DEFAULT_MONTHLY_HOURS: Record<DeskRole, number> = {
  accountant: 165,
  controller: 165,
  management: 80,
  owner: 40,
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

/** Round hours for display: whole numbers stay whole, otherwise one decimal. */
export const fmtHours = (n: number): string => String(Math.round(n * 10) / 10);

/** Engagements that load people: everything except paused or ended. */
export const isLive = (e: Rec): boolean => !['Paused', 'Ended'].includes(e.status as string);

const hoursOf = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);

// ── Report ────────────────────────────────────────────────────────────────

/** One engagement's load on one person. */
export type Assignment = {
  engagement: string;
  name: string;
  client: string;
  whiteLabel: boolean;
  as: 'accountant' | 'controller';
  hours: number | null; // null = not set on the engagement yet
};

/** Required hours on one client, across its live engagements. */
export type ClientLine = {
  key: string; // client id, or 'unknown'
  label: string;
  whiteLabel: boolean;
  accountant: number;
  controller: number;
  total: number;
  engagements: number;
  /** White label only: hours per end client (the business we do the work for). */
  endClients: { label: string; total: number }[];
};

export type UtilRow = {
  id: string;
  name: string;
  role: DeskRole;
  used: number;
  capacity: number;
  capacityIsDefault: boolean;
  spare: number; // capacity - used; negative when over
  pct: number; // used / capacity, whole number; may exceed 100
  band: UtilBand;
  assignments: Assignment[]; // most hours first
  unset: number; // assignments whose hours aren't set yet
};

export type Utilization = {
  rows: UtilRow[]; // busiest first
  clients: ClientLine[]; // most hours first
  /** Live engagements with a role assigned but its hours not set. */
  missing: { id: string; name: string; roles: ('accountant' | 'controller')[] }[];
  summary: { people: number; used: number; capacity: number; spare: number; pct: number; over: number; idle: number };
};

type Person = { id: string; name: string | null; email: string; role: string };

/** A person's capacity: their own monthly hours, else the role default. */
export function capacityFor(role: DeskRole, monthlyHours: number | null | undefined): { capacity: number; isDefault: boolean } {
  if (typeof monthlyHours === 'number' && Number.isFinite(monthlyHours) && monthlyHours > 0) return { capacity: monthlyHours, isDefault: false };
  return { capacity: DEFAULT_MONTHLY_HOURS[role] ?? DEFAULT_MONTHLY_HOURS.accountant, isDefault: true };
}

function clientInfo(e: Rec, clientById: Map<string, Rec>) {
  const c = e.client ? clientById.get(e.client as string) : undefined;
  return { key: (c?.id as string) ?? 'unknown', label: (c?.name as string) || 'No client', whiteLabel: Boolean(c?.whiteLabel) };
}

/** Every live engagement that loads this person, with the hours it needs from them. */
export function assignmentsFor(data: DeskData, personId: string): Assignment[] {
  const clientById = new Map((data.clients as Rec[]).map((c) => [c.id as string, c]));
  const out: Assignment[] = [];
  for (const e of (data.engagements as Rec[]).filter(isLive)) {
    const c = clientInfo(e, clientById);
    const base = { engagement: e.id as string, name: (e.name as string) || 'Untitled', client: c.label, whiteLabel: c.whiteLabel };
    if (e.bookkeeper === personId) out.push({ ...base, as: 'accountant', hours: hoursOf(e.accountantHours) });
    if (e.controller === personId) out.push({ ...base, as: 'controller', hours: hoursOf(e.controllerHours) });
  }
  return out.sort((a, b) => (b.hours ?? -1) - (a.hours ?? -1) || a.name.localeCompare(b.name));
}

/** One person's month. */
export function personLoad(data: DeskData, person: Person, monthlyHours: number | null | undefined): UtilRow {
  const role = person.role as DeskRole;
  const assignments = assignmentsFor(data, person.id);
  const used = assignments.reduce((a, x) => a + (x.hours ?? 0), 0);
  const { capacity, isDefault } = capacityFor(role, monthlyHours);
  const pct = Math.round((used / capacity) * 100);
  return {
    id: person.id,
    name: person.name || person.email,
    role,
    used,
    capacity,
    capacityIsDefault: isDefault,
    spare: capacity - used,
    pct,
    band: utilBand(pct),
    assignments,
    unset: assignments.filter((x) => x.hours == null).length,
  };
}

/** Required hours by client across the given engagements, most first. */
export function clientRollup(data: DeskData, engagements: Rec[]): ClientLine[] {
  const clientById = new Map((data.clients as Rec[]).map((c) => [c.id as string, c]));
  const lines = new Map<string, ClientLine & { ends: Map<string, number> }>();
  for (const e of engagements) {
    const c = clientInfo(e, clientById);
    let l = lines.get(c.key);
    if (!l) {
      l = { ...c, accountant: 0, controller: 0, total: 0, engagements: 0, endClients: [], ends: new Map() };
      lines.set(c.key, l);
    }
    const acc = hoursOf(e.accountantHours) ?? 0;
    const ctl = hoursOf(e.controllerHours) ?? 0;
    l.accountant += acc;
    l.controller += ctl;
    l.total += acc + ctl;
    l.engagements += 1;
    if (c.whiteLabel) {
      const end = (e.endClient as string) || (e.name as string) || 'Unnamed end client';
      l.ends.set(end, (l.ends.get(end) ?? 0) + acc + ctl);
    }
  }
  return [...lines.values()]
    .map(({ ends, ...l }) => ({
      ...l,
      endClients: [...ends.entries()].map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
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

/**
 * The report for a viewer. Delivery staff (accountants, controllers) and the
 * viewer always appear, so spare capacity is visible; owner and management
 * appear only when an engagement loads them.
 */
export function utilization(data: DeskData, viewer: { id: string; role: DeskRole }, monthlyHours: Record<string, number | null>): Utilization {
  const rows = visiblePeople(data, viewer)
    .map((p) => personLoad(data, p, monthlyHours[p.id]))
    .filter((r) => r.used > 0 || r.assignments.length > 0 || r.role === 'accountant' || r.role === 'controller' || r.id === viewer.id)
    .sort((a, b) => b.pct - a.pct || b.used - a.used || a.name.localeCompare(b.name));

  // Clients and gaps cover the engagements that load someone shown here.
  const shown = new Set(rows.map((r) => r.id));
  const counted = (data.engagements as Rec[]).filter(
    (e) => isLive(e) && (shown.has(e.bookkeeper as string) || shown.has(e.controller as string)),
  );
  const missing = counted
    .map((e) => ({
      id: e.id as string,
      name: (e.name as string) || 'Untitled',
      roles: [
        ...(e.bookkeeper && hoursOf(e.accountantHours) == null ? (['accountant'] as const) : []),
        ...(e.controller && hoursOf(e.controllerHours) == null ? (['controller'] as const) : []),
      ],
    }))
    .filter((m) => m.roles.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const used = rows.reduce((a, r) => a + r.used, 0);
  const capacity = rows.reduce((a, r) => a + r.capacity, 0);
  return {
    rows,
    clients: clientRollup(data, counted),
    missing,
    summary: {
      people: rows.length,
      used,
      capacity,
      spare: capacity - used,
      pct: capacity ? Math.round((used / capacity) * 100) : 0,
      over: rows.filter((r) => r.band === 'over').length,
      idle: rows.filter((r) => r.band === 'idle').length,
    },
  };
}
