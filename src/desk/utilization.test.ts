import { describe, it, expect } from 'vitest';
import type { DeskData } from './insights';
import { utilization, utilBand, personLoad, assignmentsFor, clientRollup, visiblePeople, capacityFor, isLive, DEFAULT_MONTHLY_HOURS } from './utilization';
import type { Rec } from './compute';

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
    { id: 'e1', name: 'Northside — managed', client: 'std', status: 'Active', bookkeeper: 'a1', controller: 'c1', accountantHours: 60, controllerHours: 10 },
    { id: 'e2', name: 'Pilot', client: 'std', status: 'Pilot', bookkeeper: 'a2', controller: 'c2', accountantHours: 30, controllerHours: null },
    { id: 'w1', name: 'Acme (via Vincere)', client: 'vin', endClient: 'Acme Dental', status: 'Active', bookkeeper: 'a1', controller: 'c1', accountantHours: 20, controllerHours: 4 },
    { id: 'w2', name: 'Bright (via Vincere)', client: 'vin', endClient: 'Bright Smiles', status: 'Active', bookkeeper: 'a1', controller: 'c1', accountantHours: 10, controllerHours: 2 },
    { id: 'p1', name: 'Paused', client: 'std', status: 'Paused', bookkeeper: 'a1', controller: 'c1', accountantHours: 99, controllerHours: 99 },
    { id: 'z1', name: 'Ended', client: 'std', status: 'Ended', bookkeeper: 'a2', controller: 'c2', accountantHours: 99, controllerHours: 99 },
  ],
  cycles: [],
  queries: [],
};

const ann = users[0];
const cy = users[2];

describe('utilBand', () => {
  it('maps percentages to bands at the edges', () => {
    expect(utilBand(0)).toBe('idle');
    expect(utilBand(24)).toBe('idle');
    expect(utilBand(25)).toBe('under');
    expect(utilBand(60)).toBe('healthy');
    expect(utilBand(90)).toBe('healthy');
    expect(utilBand(91)).toBe('high');
    expect(utilBand(110)).toBe('high');
    expect(utilBand(111)).toBe('over');
  });
});

describe('capacity', () => {
  it('gives accountants and controllers 165 hours by default', () => {
    expect(DEFAULT_MONTHLY_HOURS.accountant).toBe(165);
    expect(DEFAULT_MONTHLY_HOURS.controller).toBe(165);
    expect(capacityFor('controller', null)).toEqual({ capacity: 165, isDefault: true });
  });
  it('uses the person’s own hours when set, ignoring zero', () => {
    expect(capacityFor('accountant', 100)).toEqual({ capacity: 100, isDefault: false });
    expect(capacityFor('accountant', 0).isDefault).toBe(true);
  });
});

describe('assignments', () => {
  it('skips paused and ended engagements', () => {
    expect(isLive({ status: 'Active' })).toBe(true);
    expect(isLive({ status: 'Pilot' })).toBe(true);
    expect(isLive({})).toBe(true);
    expect(isLive({ status: 'Paused' })).toBe(false);
    expect(isLive({ status: 'Ended' })).toBe(false);
  });

  it('takes accountant hours for the accountant and controller hours for the controller', () => {
    expect(assignmentsFor(data, 'a1').map((a) => [a.engagement, a.as, a.hours])).toEqual([
      ['e1', 'accountant', 60],
      ['w1', 'accountant', 20],
      ['w2', 'accountant', 10],
    ]);
    expect(assignmentsFor(data, 'c1').map((a) => [a.engagement, a.as, a.hours])).toEqual([
      ['e1', 'controller', 10],
      ['w1', 'controller', 4],
      ['w2', 'controller', 2],
    ]);
  });

  it('counts both roles when one person holds both on an engagement', () => {
    const d = { ...data, engagements: [{ id: 'b', name: 'Both', status: 'Active', bookkeeper: 'm1', controller: 'm1', accountantHours: 5, controllerHours: 3 }] };
    expect(personLoad(d, users[4], null).used).toBe(8);
  });
});

describe('personLoad', () => {
  it('sums required hours against capacity', () => {
    const r = personLoad(data, ann, null);
    expect(r).toMatchObject({ used: 90, capacity: 165, capacityIsDefault: true, spare: 75, pct: 55, band: 'under', unset: 0 });
  });

  it('uses a set capacity and goes negative spare when over', () => {
    const r = personLoad(data, ann, 60);
    expect(r).toMatchObject({ used: 90, capacity: 60, spare: -30, pct: 150, band: 'over' });
  });

  it('counts an unset engagement as 0 and flags it', () => {
    const r = personLoad(data, users[3], null); // Cora: controller on e2, hours not set
    expect(r).toMatchObject({ used: 0, unset: 1, band: 'idle' });
    expect(r.assignments[0].hours).toBeNull();
  });
});

describe('clientRollup', () => {
  it('splits accountant and controller hours and nests white-label end clients', () => {
    const lines = clientRollup(data, (data.engagements as Rec[]).filter(isLive));
    expect(lines.map((l) => [l.label, l.accountant, l.controller, l.total, l.engagements])).toEqual([
      ['Northside Dental', 90, 10, 100, 2],
      ['Vincere Tax', 30, 6, 36, 2],
    ]);
    expect(lines[1].endClients).toEqual([
      { label: 'Acme Dental', total: 24 },
      { label: 'Bright Smiles', total: 12 },
    ]);
    expect(lines[0].endClients).toEqual([]);
  });
});

describe('visiblePeople', () => {
  it('scopes accountants to themselves, controllers to their accountants', () => {
    expect(visiblePeople(data, { id: 'a1', role: 'accountant' }).map((p) => p.id)).toEqual(['a1']);
    expect(visiblePeople(data, { id: 'c1', role: 'controller' }).map((p) => p.id)).toEqual(['a1', 'c1']);
    expect(visiblePeople(data, { id: 'm1', role: 'management' }).map((p) => p.id)).toEqual(['a1', 'a2', 'c1', 'c2', 'm1']);
  });
});

describe('utilization', () => {
  it('sorts busiest first and totals against summed capacity', () => {
    const u = utilization(data, { id: 'm1', role: 'management' }, {});
    expect(u.rows.map((r) => r.id)).toEqual(['a1', 'a2', 'c1', 'c2', 'm1']);
    expect(u.summary.used).toBe(90 + 30 + 16);
    expect(u.summary.capacity).toBe(165 * 4 + DEFAULT_MONTHLY_HOURS.management);
    expect(u.summary.pct).toBe(Math.round((u.summary.used / u.summary.capacity) * 100));
  });

  it('lists live engagements missing hours for an assigned role', () => {
    const u = utilization(data, { id: 'm1', role: 'management' }, {});
    expect(u.missing).toEqual([{ id: 'e2', name: 'Pilot', roles: ['controller'] }]);
  });

  it('limits a controller to their team and their engagements', () => {
    const u = utilization(data, { id: 'c1', role: 'controller' }, { a1: 100 });
    expect(u.rows.map((r) => r.id)).toEqual(['a1', 'c1']);
    expect(u.rows[0]).toMatchObject({ capacity: 100, capacityIsDefault: false, pct: 90 });
    expect(u.clients.map((c) => c.label)).toEqual(['Northside Dental', 'Vincere Tax']);
    expect(u.missing).toEqual([]);
  });

  it('shows an accountant only themselves', () => {
    const u = utilization(data, { id: 'a2', role: 'accountant' }, {});
    expect(u.rows.map((r) => r.id)).toEqual(['a2']);
    expect(u.summary).toMatchObject({ used: 30, capacity: 165 });
  });

  it('leaves out management with no engagements unless they are the viewer', () => {
    const u = utilization(data, { id: 'c1', role: 'controller' }, {});
    expect(u.rows.some((r) => r.id === 'm1')).toBe(false);
  });
});
