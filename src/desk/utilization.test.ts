import { describe, it, expect } from 'vitest';
import type { DeskData } from './insights';
import { utilization, utilBand, personUtilization, visiblePeople, WEIGHTS, CAPACITY, WHITE_LABEL_DEFAULT, CONTROLLER_SHARE } from './utilization';

const TODAY = '2026-10-14'; // a Wednesday

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
  clients: [],
  deliverables: [],
  deals: [],
  pnl: [],
  users,
  engagements: [
    { id: 'e1', status: 'Active', bookkeeper: 'a1', controller: 'c1' },
    { id: 'e2', status: 'Pilot', bookkeeper: 'a2', controller: 'c2' },
    { id: 'e3', status: 'Ended', bookkeeper: 'a1', controller: 'c1' }, // not counted
  ],
  cycles: [
    // e1: capture not done → one accountant review; overdue
    { id: 'cy1', engagement: 'e1', stage: 'Capture', capture: false, slaDue: '2026-10-10', slaStatus: 'At risk' },
    // e1: at Review with both prior gates done → controller review only; due in 2 BD
    { id: 'cy2', engagement: 'e1', stage: 'Review', capture: true, bkReview: true, ctrlReview: false, slaDue: '2026-10-16' },
    // closed → ignored
    { id: 'cy3', engagement: 'e1', stage: 'Closed', slaDue: '2026-09-10' },
  ],
  queries: [
    { id: 'q1', owner: 'a1', status: 'Open' },
    { id: 'q2', owner: 'a1', status: 'Resolved' },
  ],
};

describe('utilBand', () => {
  it('bands by percentage', () => {
    expect([0, 24, 25, 59, 60, 90, 91, 110, 111].map(utilBand)).toEqual(['idle', 'idle', 'under', 'under', 'healthy', 'healthy', 'high', 'high', 'over']);
  });
});

describe('personUtilization', () => {
  it('weights engagements, cycles, reviews, queries and overdue for an accountant', () => {
    const r = personUtilization(data, users[0], TODAY);
    expect(r).toMatchObject({ engagements: 1, cycles: 2, reviews: 1, queries: 1, overdue: 1, dueSoon: 1 });
    const pts = 1 * WEIGHTS.engagement + 2 * WEIGHTS.cycle + 1 * WEIGHTS.review + 1 * WEIGHTS.query + 1 * WEIGHTS.overdue;
    expect(r.points).toBe(pts);
    expect(r.pct).toBe(Math.round((pts / CAPACITY.accountant) * 100));
  });
  it('gives the controller review to the controller, not the accountant', () => {
    expect(personUtilization(data, users[2], TODAY).reviews).toBe(1);
  });
  it('is idle with no assignments', () => {
    const r = personUtilization({ ...data, engagements: [], queries: [] }, users[0], TODAY);
    expect(r.points).toBe(0);
    expect(r.band).toBe('idle');
  });
});

describe('engagement capacity', () => {
  it('replaces the default engagement + cycle weights when set; reviews/overdue still add', () => {
    const d: DeskData = { ...data, engagements: data.engagements.map((e) => (e.id === 'e1' ? { ...e, capacity: 10 } : e)) };
    const line = personUtilization(d, users[0], TODAY).groups[0].lines[0];
    expect(line).toMatchObject({ capacity: 10, baseline: 10, usingDefault: false });
    // 10 baseline + 1 review + 2 overdue (cycles no longer add 3 each)
    expect(line.points).toBe(10 + WEIGHTS.review + WEIGHTS.overdue);
  });
  it('treats a blank or negative capacity as unset', () => {
    const d: DeskData = { ...data, engagements: data.engagements.map((e) => (e.id === 'e1' ? { ...e, capacity: -3 } : e)) };
    expect(personUtilization(d, users[0], TODAY).groups[0].lines[0].usingDefault).toBe(true);
  });
  it('counts a query once: on its engagement, not again as "other"', () => {
    const d: DeskData = { ...data, queries: [{ id: 'q9', owner: 'a1', status: 'Open', cycle: 'cy1' }] };
    const r = personUtilization(d, users[0], TODAY);
    expect(r.queries).toBe(1);
    expect(r.otherQueries).toBe(0);
    expect(r.groups[0].lines[0].queries).toBe(1);
  });
});

describe('white-label client', () => {
  const wl: DeskData = {
    ...data,
    clients: [
      { id: 'vin', name: 'Vincere Tax', whiteLabel: true },
      { id: 'std', name: 'Standard Co', whiteLabel: false },
    ],
    engagements: [
      { id: 'w1', name: 'Vincere — Alpha', client: 'vin', status: 'Active', bookkeeper: 'a1', controller: 'c1' },
      { id: 'w2', name: 'Vincere — Beta', client: 'vin', status: 'Active', bookkeeper: 'a1', controller: 'c1', capacity: 3 },
      { id: 's1', name: 'Standard', client: 'std', status: 'Active', bookkeeper: 'a1', controller: 'c1' },
    ],
    cycles: [
      { id: 'wc1', engagement: 'w1', stage: 'Capture', capture: true, bkReview: true },
      { id: 'wc2', engagement: 'w2', stage: 'Capture', capture: true, bkReview: true },
    ],
    queries: [],
  };

  it('defaults an end-client engagement to WHITE_LABEL_DEFAULT and ignores per-cycle weight', () => {
    const lines = personUtilization(wl, users[0], TODAY).groups.flatMap((g) => g.lines);
    const alpha = lines.find((l) => l.id === 'w1')!;
    expect(alpha).toMatchObject({ baseline: WHITE_LABEL_DEFAULT, usingDefault: true, whiteLabel: true });
    expect(alpha.points).toBe(WHITE_LABEL_DEFAULT);
  });
  it('honours an explicit capacity on a white-label engagement', () => {
    const lines = personUtilization(wl, users[0], TODAY).groups.flatMap((g) => g.lines);
    expect(lines.find((l) => l.id === 'w2')!.baseline).toBe(3);
  });
  it('rolls end-client engagements into one group, leaving standard clients separate', () => {
    const groups = personUtilization(wl, users[0], TODAY).groups;
    const g = groups.find((x) => x.whiteLabel)!;
    expect(g.label).toBe('Vincere Tax');
    expect(g.lines).toHaveLength(2);
    expect(g.points).toBe(WHITE_LABEL_DEFAULT + 3);
    expect(groups.filter((x) => !x.whiteLabel)).toHaveLength(1);
  });
  it('keeps the person total equal to the sum of their groups', () => {
    const r = personUtilization(wl, users[0], TODAY);
    expect(r.points).toBe(r.groups.reduce((a, g) => a + g.points, 0) + r.otherQueries);
  });
});

describe('white-label engagements name their end client, which is not a client record', () => {
  const wl: DeskData = {
    ...data,
    clients: [
      { id: 'vin', name: 'Vincere Tax', whiteLabel: true },
      { id: 'std', name: 'Standard Co' },
    ],
    engagements: [
      { id: 'w1', name: 'Acme Dental (via Vincere Tax)', client: 'vin', endClient: 'Acme Dental', status: 'Active', bookkeeper: 'a1', controller: 'c1' },
      { id: 'w2', name: 'Bright Smiles (via Vincere Tax)', client: 'vin', endClient: 'Bright Smiles', status: 'Active', bookkeeper: 'a1', controller: 'c1' },
      { id: 's1', name: 'Standard', client: 'std', endClient: 'Ignored', status: 'Active', bookkeeper: 'a1', controller: 'c1' },
    ],
    cycles: [],
    queries: [],
  };

  it('carries the client (Vincere) and the end client on each white-label line', () => {
    const lines = personUtilization(wl, users[0], TODAY).groups.flatMap((g) => g.lines);
    expect(lines.find((l) => l.id === 'w1')).toMatchObject({ whiteLabel: true, client: 'Vincere Tax', endClient: 'Acme Dental' });
  });
  it('ignores an end client set on a non-white-label engagement', () => {
    const lines = personUtilization(wl, users[0], TODAY).groups.flatMap((g) => g.lines);
    expect(lines.find((l) => l.id === 's1')).toMatchObject({ whiteLabel: false, endClient: '' });
  });
  it('groups every engagement under the white-label client, labelled with that client', () => {
    const groups = personUtilization(wl, users[0], TODAY).groups;
    const g = groups.filter((x) => x.whiteLabel);
    expect(g).toHaveLength(1);
    expect(g[0].label).toBe('Vincere Tax');
    expect(g[0].lines.map((l) => l.id).sort()).toEqual(['w1', 'w2']);
  });
});

describe('controller share', () => {
  it('a controller-only person carries CONTROLLER_SHARE of the standing load', () => {
    const acc = personUtilization(data, users[0], TODAY).groups[0].lines[0]; // accountant, full share
    const ctrl = personUtilization(data, users[2], TODAY).groups[0].lines[0]; // controller
    expect(acc.share).toBe(1);
    expect(ctrl.share).toBe(CONTROLLER_SHARE);
    // same engagement: baseline identical, standing load scaled for the controller
    expect(ctrl.baseline).toBe(acc.baseline);
    expect(ctrl.points).toBe(acc.baseline * CONTROLLER_SHARE + ctrl.reviews * WEIGHTS.review + ctrl.queries * WEIGHTS.query + ctrl.overdue * WEIGHTS.overdue);
  });
  it('leaves reviews and overdue at full weight for the controller', () => {
    const ctrl = personUtilization(data, users[2], TODAY).groups[0].lines[0];
    expect(ctrl.reviews).toBe(1);
    expect(ctrl.overdue).toBe(1);
  });
  it('someone who is both accountant and controller carries the full load', () => {
    const d: DeskData = { ...data, engagements: [{ id: 'e1', status: 'Active', bookkeeper: 'c1', controller: 'c1' }] };
    expect(personUtilization(d, users[2], TODAY).groups[0].lines[0].share).toBe(1);
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
  it('sorts busiest first and summarizes', () => {
    const u = utilization(data, { id: 'm1', role: 'management' }, TODAY);
    expect(u.rows[0].id).toBe('a1');
    expect(u.summary.people).toBe(u.rows.length);
    expect(u.summary.overdue).toBe(u.rows.reduce((a, r) => a + r.overdue, 0));
  });
  it('omits management with nothing assigned, but keeps idle delivery staff', () => {
    const ids = utilization(data, { id: 'c1', role: 'controller' }, TODAY).rows.map((r) => r.id);
    expect(ids).toContain('a1');
    const all = utilization(data, { id: 'm1', role: 'management' }, TODAY).rows.map((r) => r.id);
    expect(all).toContain('m1'); // the viewer is always shown
    expect(utilization(data, { id: 'c1', role: 'controller' }, TODAY).rows.map((r) => r.id)).not.toContain('m1');
  });
});
