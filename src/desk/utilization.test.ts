import { describe, it, expect } from 'vitest';
import type { DeskData } from './insights';
import {
  utilization,
  utilBand,
  personMonth,
  visiblePeople,
  capacityFor,
  isBillable,
  shiftMonth,
  monthRange,
  parseMonth,
  monthLabel,
  loggableEngagements,
  DEFAULT_MONTHLY_HOURS,
  type TimeEntry,
} from './utilization';

const MONTH = '2026-10';

const users = [
  { id: 'a1', name: 'Ann', email: 'ann@x.co', role: 'accountant', isActive: true },
  { id: 'a2', name: 'Abe', email: 'abe@x.co', role: 'accountant', isActive: true },
  { id: 'c1', name: 'Cy', email: 'cy@x.co', role: 'controller', isActive: true },
  { id: 'c2', name: 'Cora', email: 'cora@x.co', role: 'controller', isActive: true },
  { id: 'm1', name: 'Max', email: 'max@x.co', role: 'management', isActive: true },
  { id: 'x1', name: 'Gone', email: 'gone@x.co', role: 'accountant', isActive: false },
];

const data: DeskData = {
  intake: [],
  clients: [
    { id: 'std', name: 'Northside Dental' },
    { id: 'vin', name: 'Vincere Tax', whiteLabel: true },
  ],
  deliverables: [],
  deals: [],
  pnl: [],
  users,
  engagements: [
    { id: 'e1', name: 'Northside — managed', client: 'std', status: 'Active', bookkeeper: 'a1', controller: 'c1' },
    { id: 'e2', name: 'Pilot', client: 'std', status: 'Pilot', bookkeeper: 'a2', controller: 'c2' },
    { id: 'w1', name: 'Acme (via Vincere)', client: 'vin', endClient: 'Acme Dental', status: 'Active', bookkeeper: 'a1', controller: 'c1' },
    { id: 'w2', name: 'Bright (via Vincere)', client: 'vin', endClient: 'Bright Smiles', status: 'Active', bookkeeper: 'a1', controller: 'c1' },
  ],
  cycles: [],
  queries: [],
};

const t = (id: string, user: string, engagement: string | null, date: string, hours: number, billable = true): TimeEntry => ({ id, user, engagement, date, hours, billable });

const entries: TimeEntry[] = [
  t('t1', 'a1', 'e1', '2026-10-01', 60),
  t('t2', 'a1', 'w1', '2026-10-15', 20),
  t('t3', 'a1', 'w2', '2026-10-31', 10),
  t('t4', 'a1', null, '2026-10-02', 8), // internal, flag ignored
  t('t5', 'a1', 'e1', '2026-10-03', 4, false), // non-billable client time
  t('t6', 'a1', 'e1', '2026-09-30', 99), // previous month
  t('t7', 'a1', 'e1', '2026-11-01', 99), // next month
  t('t8', 'c1', 'e1', '2026-10-05', 12),
  t('t9', 'a2', 'e2', '2026-10-05', 30),
];

describe('months', () => {
  it('shifts across year ends', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-10', 0)).toBe('2026-10');
  });
  it('knows the last day, including leap February', () => {
    expect(monthRange('2026-10')).toEqual({ first: '2026-10-01', last: '2026-10-31' });
    expect(monthRange('2028-02').last).toBe('2028-02-29');
  });
  it('rejects malformed months', () => {
    expect(parseMonth('2026-13', MONTH)).toBe(MONTH);
    expect(parseMonth('oct', MONTH)).toBe(MONTH);
    expect(parseMonth(undefined, MONTH)).toBe(MONTH);
    expect(parseMonth('2026-09', MONTH)).toBe('2026-09');
  });
  it('labels a month', () => {
    expect(monthLabel('2026-10')).toBe('October 2026');
  });
});

describe('utilBand', () => {
  it('bands by percentage', () => {
    expect([0, 24, 25, 59, 60, 90, 91, 110, 111].map(utilBand)).toEqual(['idle', 'idle', 'under', 'under', 'healthy', 'healthy', 'high', 'high', 'over']);
  });
});

describe('capacity', () => {
  it('uses the person’s monthly hours when set', () => {
    expect(capacityFor('accountant', 100)).toEqual({ capacity: 100, isDefault: false });
  });
  it('falls back to the role default when blank or zero', () => {
    expect(capacityFor('controller', null)).toEqual({ capacity: DEFAULT_MONTHLY_HOURS.controller, isDefault: true });
    expect(capacityFor('controller', 0).isDefault).toBe(true);
  });
});

describe('billable', () => {
  it('internal time is never billable', () => {
    expect(isBillable(t('x', 'a1', null, '2026-10-01', 1, true))).toBe(false);
    expect(isBillable(t('x', 'a1', 'e1', '2026-10-01', 1, true))).toBe(true);
    expect(isBillable(t('x', 'a1', 'e1', '2026-10-01', 1, false))).toBe(false);
  });
});

describe('personMonth', () => {
  const inMonth = entries.filter((e) => e.date.startsWith(MONTH));
  it('splits billable from non-billable and derives % from billable / capacity', () => {
    const r = personMonth(data, users[0], inMonth, 120);
    expect(r).toMatchObject({ billable: 90, nonBillable: 12, total: 102, capacity: 120, capacityIsDefault: false, pct: 75, band: 'healthy', entries: 5 });
  });
  it('rolls a white-label client’s engagements into one line with end clients, Internal last', () => {
    const r = personMonth(data, users[0], inMonth, null);
    expect(r.clients.map((c) => c.label)).toEqual(['Northside Dental', 'Vincere Tax', 'Internal']);
    const vin = r.clients.find((c) => c.key === 'vin')!;
    expect(vin).toMatchObject({ whiteLabel: true, billable: 30, total: 30 });
    expect(vin.endClients).toEqual([
      { label: 'Acme Dental', total: 20 },
      { label: 'Bright Smiles', total: 10 },
    ]);
    expect(r.clients.find((c) => c.key === 'internal')).toMatchObject({ billable: 0, nonBillable: 8 });
  });
  it('is idle with no time logged', () => {
    const r = personMonth(data, users[1], [], null);
    expect(r).toMatchObject({ total: 0, pct: 0, band: 'idle', capacity: DEFAULT_MONTHLY_HOURS.accountant });
  });
});

describe('visiblePeople', () => {
  it('accountants see only themselves', () => {
    expect(visiblePeople(data, { id: 'a1', role: 'accountant' }).map((u) => u.id)).toEqual(['a1']);
  });
  it('controllers see themselves and the accountants on their engagements', () => {
    expect(visiblePeople(data, { id: 'c1', role: 'controller' }).map((u) => u.id).sort()).toEqual(['a1', 'c1']);
  });
  it('owner and management see every active person', () => {
    const ids = visiblePeople(data, { id: 'm1', role: 'management' }).map((u) => u.id);
    expect(ids).toHaveLength(5);
    expect(ids).not.toContain('x1');
  });
});

describe('utilization', () => {
  const caps = { a1: 120 };

  it('counts only entries inside the month', () => {
    const u = utilization(data, { id: 'a1', role: 'accountant' }, MONTH, entries, caps);
    expect(u.rows[0].total).toBe(102);
    const sept = utilization(data, { id: 'a1', role: 'accountant' }, '2026-09', entries, caps);
    expect(sept.rows[0].total).toBe(99);
  });
  it('sorts busiest first and totals the team against summed capacity', () => {
    const u = utilization(data, { id: 'm1', role: 'management' }, MONTH, entries, caps);
    expect(u.rows[0].id).toBe('a1');
    expect(u.summary.billable).toBe(90 + 12 + 30);
    expect(u.summary.capacity).toBe(u.rows.reduce((a, r) => a + r.capacity, 0));
    expect(u.summary.pct).toBe(Math.round((u.summary.billable / u.summary.capacity) * 100));
  });
  it('rolls hours up by client across people', () => {
    const u = utilization(data, { id: 'm1', role: 'management' }, MONTH, entries, caps);
    const north = u.clients.find((c) => c.key === 'std')!;
    expect(north).toMatchObject({ billable: 60 + 12 + 30, nonBillable: 4, people: 3 });
  });
  it('never leaks hours of people the viewer cannot see', () => {
    const u = utilization(data, { id: 'c1', role: 'controller' }, MONTH, entries, caps);
    expect(u.rows.map((r) => r.id).sort()).toEqual(['a1', 'c1']);
    expect(u.clients.find((c) => c.key === 'std')!.people).toBe(2); // a2's pilot hours excluded
  });
  it('omits management with no time, but keeps idle delivery staff and the viewer', () => {
    const ids = utilization(data, { id: 'c1', role: 'controller' }, MONTH, [], {}).rows.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining(['a1', 'c1']));
    const all = utilization(data, { id: 'c2', role: 'controller' }, MONTH, [], {}).rows.map((r) => r.id);
    expect(all).not.toContain('m1');
    expect(utilization(data, { id: 'm1', role: 'management' }, MONTH, [], {}).rows.map((r) => r.id)).toContain('m1');
  });
});

describe('loggableEngagements', () => {
  const withEnded: DeskData = { ...data, engagements: [...data.engagements, { id: 'old', status: 'Ended', bookkeeper: 'a1' }] };
  it('accountants log only against active engagements assigned to them', () => {
    expect(loggableEngagements(withEnded, { id: 'a2', role: 'accountant' }).map((e) => e.id)).toEqual(['e2']);
  });
  it('other roles can log against any active or pilot engagement', () => {
    expect(loggableEngagements(withEnded, { id: 'c1', role: 'controller' }).map((e) => e.id)).toEqual(['e1', 'e2', 'w1', 'w2']);
  });
});
