import { describe, it, expect } from 'vitest';
import { attention, recordWarnings, pendingCycleReviews, type DeskData } from './insights';

const empty: DeskData = { intake: [], clients: [], engagements: [], cycles: [], queries: [], deliverables: [], deals: [], pnl: [], users: [] };

describe('pendingCycleReviews', () => {
  it('waits on the accountant to capture once the month is being closed', () => {
    expect(pendingCycleReviews({ stage: 'Capture', capture: false })).toEqual(['capture']);
  });
  it('does not expect capture while still Awaiting Close', () => {
    expect(pendingCycleReviews({ stage: 'Awaiting Close', capture: false })).toEqual([]);
  });
  it('moves to bookkeeper review once capture is done', () => {
    expect(pendingCycleReviews({ stage: 'Reconciliation', capture: true, bkReview: false })).toEqual(['bk-review']);
  });
  it('adds controller review at the Review stage', () => {
    expect(pendingCycleReviews({ stage: 'Review', capture: true, bkReview: true, ctrlReview: false })).toEqual(['ctrl-review']);
  });
  it('is empty once the cycle is delivered/closed', () => {
    expect(pendingCycleReviews({ stage: 'Delivered', capture: false, ctrlReview: false })).toEqual([]);
  });
});

describe('attention', () => {
  it('flags a breached cycle as bad', () => {
    const data: DeskData = { ...empty, cycles: [{ id: 'c1', name: 'March close', slaStatus: 'Breached', slaDue: '2026-03-05', stage: 'Review' }] };
    const out = attention(data);
    expect(out[0]).toMatchObject({ sev: 'bad', b: 'cycles', id: 'c1' });
  });
  it('flags a finalized deal that is unpaid', () => {
    const data: DeskData = { ...empty, deals: [{ id: 'd1', name: 'Deal', stage: 'LqE finalized', payment: 'Billed' }] };
    expect(attention(data).some((a) => a.b === 'deals' && a.id === 'd1')).toBe(true);
  });
  it('ranks bad before warn before info', () => {
    const data: DeskData = {
      ...empty,
      cycles: [{ id: 'c1', name: 'c', slaStatus: 'Breached' }],
      engagements: [{ id: 'e1', name: 'e', service: 'Managed Bookkeeping', status: 'Active', slaDelivery: 5 }],
    };
    const sevs = attention(data).map((a) => a.sev);
    expect(sevs[0]).toBe('bad');
  });
});

describe('recordWarnings', () => {
  it('warns on a deliverable with no QC sign-off', () => {
    const w = recordWarnings('deliverables', { id: 'x', name: 'Pack' }, empty);
    expect(w.join(' ')).toMatch(/QC sign-off/i);
  });
  it('warns on a PHI deal', () => {
    const w = recordWarnings('deals', { id: 'x', name: 'Deal', posture: 'PHI' }, empty);
    expect(w.join(' ')).toMatch(/BAA/);
  });
});
