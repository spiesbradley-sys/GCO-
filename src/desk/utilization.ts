// Monthly utilization for desk staff, measured in hours. Derived on read from
// logged time entries (desk_time_entries) and NEVER stored — same philosophy
// as compute.ts.
//
//   utilization % = billable hours logged in the month / monthly capacity
//
// Capacity is each person's `monthlyHours` (editable in Owner Admin → Staff),
// falling back to DEFAULT_MONTHLY_HOURS for their role. Time on an engagement
// is billable unless marked otherwise; internal time (no engagement) never is.
// Hours also roll up by client; a white-label client's (Vincere's) end clients
// sit under it.

import type { Rec } from './compute';
import type { DeskData } from './insights';
import type { DeskRole } from './roles';

/** Hours a person is available per month when Owner Admin hasn't set one. */
export const DEFAULT_MONTHLY_HOURS: Record<DeskRole, number> = {
  accountant: 140,
  controller: 120,
  management: 80,
  owner: 40,
};

/** Largest single entry we accept (one day). */
export const MAX_ENTRY_HOURS = 24;

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

// ── Months ────────────────────────────────────────────────────────────────

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** 'YYYY-MM' of an ISO date ('YYYY-MM-DD'). */
export const monthOf = (isoDate: string): string => isoDate.slice(0, 7);

/** A valid 'YYYY-MM', or the fallback. */
export function parseMonth(raw: string | undefined | null, fallback: string): string {
  return raw && MONTH_RE.test(raw) ? raw : fallback;
}

/** Move a 'YYYY-MM' by n months. */
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

/** First and last ISO date of a month (inclusive). */
export function monthRange(month: string): { first: string; last: string } {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { first: `${month}-01`, last: `${month}-${String(days).padStart(2, '0')}` };
}

/** "October 2026". */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// ── Report ────────────────────────────────────────────────────────────────

export type TimeEntry = {
  id: string;
  user: string;
  engagement: string | null;
  date: string;
  hours: number;
  billable: boolean;
  note?: string | null;
};

/** Hours on one client (or Internal) within a person's month or the client rollup. */
export type HoursLine = {
  key: string; // client id, or 'internal' / 'unknown'
  label: string;
  whiteLabel: boolean;
  billable: number;
  nonBillable: number;
  total: number;
  people: number; // distinct people who logged time here
  /** White label only: hours per end client (the business we do the work for). */
  endClients: { label: string; total: number }[];
};

export type UtilRow = {
  id: string;
  name: string;
  role: DeskRole;
  billable: number;
  nonBillable: number;
  total: number;
  capacity: number;
  capacityIsDefault: boolean;
  pct: number; // billable / capacity, whole number; may exceed 100
  band: UtilBand;
  entries: number;
  clients: HoursLine[]; // busiest first
};

export type Utilization = {
  month: string;
  rows: UtilRow[]; // busiest first
  clients: HoursLine[]; // busiest first, across the visible people
  summary: { people: number; billable: number; nonBillable: number; total: number; capacity: number; pct: number; over: number; idle: number };
};

type Person = { id: string; name: string | null; email: string; role: string };

const INTERNAL = { key: 'internal', label: 'Internal', whiteLabel: false };

/** Which client bucket an entry belongs to. */
function bucketFor(entry: TimeEntry, engById: Map<string, Rec>, clientById: Map<string, Rec>) {
  if (!entry.engagement) return { ...INTERNAL, endClient: '' };
  const e = engById.get(entry.engagement);
  const c = e?.client ? clientById.get(e.client as string) : undefined;
  if (!e || !c) return { key: 'unknown', label: (e?.name as string) || 'Unassigned engagement', whiteLabel: false, endClient: '' };
  const whiteLabel = Boolean(c.whiteLabel);
  return {
    key: c.id as string,
    label: (c.name as string) || 'Untitled client',
    whiteLabel,
    endClient: whiteLabel ? ((e.endClient as string) || (e.name as string) || 'Unnamed end client') : '',
  };
}

/** Sum entries into client lines, busiest first, Internal last. */
function rollUp(entries: TimeEntry[], data: DeskData): HoursLine[] {
  const engById = new Map((data.engagements as Rec[]).map((e) => [e.id as string, e]));
  const clientById = new Map((data.clients as Rec[]).map((c) => [c.id as string, c]));
  const lines = new Map<string, HoursLine & { ends: Map<string, number>; users: Set<string> }>();
  for (const t of entries) {
    const b = bucketFor(t, engById, clientById);
    let l = lines.get(b.key);
    if (!l) {
      l = { key: b.key, label: b.label, whiteLabel: b.whiteLabel, billable: 0, nonBillable: 0, total: 0, people: 0, endClients: [], ends: new Map(), users: new Set() };
      lines.set(b.key, l);
    }
    const billable = isBillable(t);
    if (billable) l.billable += t.hours;
    else l.nonBillable += t.hours;
    l.total += t.hours;
    l.users.add(t.user);
    if (b.endClient) l.ends.set(b.endClient, (l.ends.get(b.endClient) ?? 0) + t.hours);
  }
  return [...lines.values()]
    .map(({ ends, users, ...l }) => ({
      ...l,
      people: users.size,
      endClients: [...ends.entries()].map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => Number(a.key === 'internal') - Number(b.key === 'internal') || b.total - a.total || a.label.localeCompare(b.label));
}

/** Internal time is never billable, whatever the flag says. */
export const isBillable = (t: TimeEntry): boolean => Boolean(t.engagement) && t.billable;

/** A person's capacity: their own monthly hours, else the role default. */
export function capacityFor(role: DeskRole, monthlyHours: number | null | undefined): { capacity: number; isDefault: boolean } {
  if (typeof monthlyHours === 'number' && Number.isFinite(monthlyHours) && monthlyHours > 0) return { capacity: monthlyHours, isDefault: false };
  return { capacity: DEFAULT_MONTHLY_HOURS[role] ?? DEFAULT_MONTHLY_HOURS.accountant, isDefault: true };
}

/** One person's month, from entries already limited to that month. */
export function personMonth(data: DeskData, person: Person, entries: TimeEntry[], monthlyHours: number | null | undefined): UtilRow {
  const role = person.role as DeskRole;
  const mine = entries.filter((t) => t.user === person.id);
  const billable = mine.filter(isBillable).reduce((a, t) => a + t.hours, 0);
  const total = mine.reduce((a, t) => a + t.hours, 0);
  const { capacity, isDefault } = capacityFor(role, monthlyHours);
  const pct = Math.round((billable / capacity) * 100);
  return {
    id: person.id,
    name: person.name || person.email,
    role,
    billable,
    nonBillable: total - billable,
    total,
    capacity,
    capacityIsDefault: isDefault,
    pct,
    band: utilBand(pct),
    entries: mine.length,
    clients: rollUp(mine, data),
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

/**
 * The month's report for a viewer. `entries` may span more than the month;
 * only those dated inside it count. Delivery staff (accountants, controllers)
 * and the viewer always appear, so unused capacity is visible; owner and
 * management appear only when they logged time.
 */
export function utilization(
  data: DeskData,
  viewer: { id: string; role: DeskRole },
  month: string,
  entries: TimeEntry[],
  monthlyHours: Record<string, number | null>,
): Utilization {
  const { first, last } = monthRange(month);
  const inMonth = entries.filter((t) => t.date >= first && t.date <= last);
  const people = visiblePeople(data, viewer);
  const visible = new Set(people.map((p) => p.id));
  const seen = inMonth.filter((t) => visible.has(t.user));

  const rows = people
    .map((p) => personMonth(data, p, seen, monthlyHours[p.id]))
    .filter((r) => r.total > 0 || r.role === 'accountant' || r.role === 'controller' || r.id === viewer.id)
    .sort((a, b) => b.pct - a.pct || b.total - a.total || a.name.localeCompare(b.name));

  const shown = new Set(rows.map((r) => r.id));
  const counted = seen.filter((t) => shown.has(t.user));
  const clients = rollUp(counted, data);

  const billable = rows.reduce((a, r) => a + r.billable, 0);
  const total = rows.reduce((a, r) => a + r.total, 0);
  const capacity = rows.reduce((a, r) => a + r.capacity, 0);
  return {
    month,
    rows,
    clients,
    summary: {
      people: rows.length,
      billable,
      nonBillable: total - billable,
      total,
      capacity,
      pct: capacity ? Math.round((billable / capacity) * 100) : 0,
      over: rows.filter((r) => r.band === 'over').length,
      idle: rows.filter((r) => r.band === 'idle').length,
    },
  };
}

/** Engagements a person can log time against: active or pilot, and for an
 * accountant only the ones assigned to them (same scope as the boards). */
export function loggableEngagements(data: DeskData, viewer: { id: string; role: DeskRole }): Rec[] {
  return (data.engagements as Rec[]).filter(
    (e) =>
      ['Active', 'Pilot'].includes(e.status as string) &&
      (viewer.role !== 'accountant' || e.bookkeeper === viewer.id || e.controller === viewer.id),
  );
}
