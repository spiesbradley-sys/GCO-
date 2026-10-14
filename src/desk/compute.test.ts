import { describe, it, expect } from 'vitest';
import { businessDays, rack, dealClock, margin, marginPct, queryAge, cycleSev, endOfMonthISO, addBusinessDays, monthlyCloseDate } from './compute';

describe('monthly close date', () => {
  it('finds the last calendar day of the month', () => {
    expect(endOfMonthISO('2026-07-15')).toBe('2026-07-31');
    expect(endOfMonthISO('2026-02-10')).toBe('2026-02-28'); // 2026 is not a leap year
  });
  it('adds business days, skipping weekends', () => {
    expect(addBusinessDays('2026-08-07', 1)).toBe('2026-08-10'); // Fri -> Mon
    expect(addBusinessDays('2026-08-10', 0)).toBe('2026-08-10');
  });
  it('is 5 business days after month-end (matches the seed: Jul period -> 7 Aug)', () => {
    expect(monthlyCloseDate('2026-07-01')).toBe('2026-08-07');
  });
});

describe('businessDays', () => {
  it('counts weekdays only, exclusive of start', () => {
    // 2026-03-02 is a Monday, 2026-03-09 the next Monday.
    expect(businessDays('2026-03-02', '2026-03-09')).toBe(5);
  });
  it('is signed', () => {
    expect(businessDays('2026-03-09', '2026-03-02')).toBe(-5);
  });
  it('ignores weekends', () => {
    expect(businessDays('2026-03-07', '2026-03-08')).toBe(0); // Sat → Sun
  });
});

describe('rack', () => {
  it('maps location bands to fee (cents) and clock', () => {
    expect(rack(1)).toEqual({ feeCents: 100_000, days: 3 });
    expect(rack(3)).toEqual({ feeCents: 150_000, days: 5 });
    expect(rack(7)).toEqual({ feeCents: 200_000, days: 7 });
    expect(rack(10)).toEqual({ feeCents: 250_000, days: 10 });
    expect(rack(12)).toEqual({ feeCents: 280_000, days: 12 });
    expect(rack(0)).toBeNull();
  });
});

describe('dealClock', () => {
  it('reports target when not started', () => {
    expect(dealClock({ locations: 1 })).toBe('Not started · target 3 BD');
  });
  it('reports used vs target when finalized', () => {
    expect(dealClock({ locations: 1, dataReceived: '2026-03-02', finalized: '2026-03-05' })).toBe('3 BD of 3 (final)');
  });
});

describe('margin', () => {
  it('subtracts all costs (cents)', () => {
    expect(margin({ revenue: 100_000, delivery: 40_000, commission: 5_000, other: 0 })).toBe(55_000);
  });
  it('marginPct is a whole percent', () => {
    expect(marginPct({ revenue: 100_000, delivery: 40_000, commission: 5_000 })).toBe(55);
    expect(marginPct({ revenue: 0 })).toBeNull();
  });
});

describe('queryAge', () => {
  it('is null once resolved', () => {
    expect(queryAge({ status: 'Resolved', raised: '2026-03-02' })).toBeNull();
  });
  it('counts business days while open', () => {
    expect(queryAge({ status: 'Open', raised: '2026-03-02' }, '2026-03-09')).toBe(5);
  });
});

describe('cycleSev', () => {
  it('flags breached and at-risk', () => {
    expect(cycleSev({ slaStatus: 'Breached' })).toBe('bad');
    expect(cycleSev({ slaStatus: 'At risk' })).toBe('warn');
    expect(cycleSev({ slaStatus: 'On track' })).toBe('');
  });
  it('flags a passed due date on an open cycle', () => {
    expect(cycleSev({ slaStatus: 'On track', stage: 'Capture', slaDue: '2026-03-01' }, '2026-03-10')).toBe('bad');
  });
});

import { frequencyOf, isCloseMonth, closeMonthsBetween, periodLabel, needsCycleNow, monthlyCloseDate as closeDate, WHITE_LABEL_CLOSE_BD } from './compute';

describe('delivery frequency', () => {
  it('defaults to Monthly', () => {
    expect(frequencyOf({})).toBe('Monthly');
    expect(frequencyOf({ frequency: 'Quarterly' })).toBe('Quarterly');
  });
  it('quarterly closes only in Mar, Jun, Sep, Dec', () => {
    const months = Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`);
    expect(months.filter((m) => isCloseMonth('Quarterly', m))).toEqual(['2026-03', '2026-06', '2026-09', '2026-12']);
    expect(months.every((m) => isCloseMonth('Monthly', m))).toBe(true);
  });
  it('lists close months across a year boundary', () => {
    expect(closeMonthsBetween('Monthly', '2026-09', '2026-11')).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(closeMonthsBetween('Quarterly', '2026-09', '2027-03')).toEqual(['2026-09', '2026-12', '2027-03']);
    expect(closeMonthsBetween('Quarterly', '2026-10', '2026-11')).toEqual([]);
  });
  it('labels periods', () => {
    expect(periodLabel('Quarterly', '2026-09')).toBe('Q3 2026');
    expect(periodLabel('Quarterly', '2026-12')).toBe('Q4 2026');
    expect(periodLabel('Monthly', '2026-09')).toBe('Sep 2026');
  });
  it('only expects a quarterly cycle in a quarter-end month', () => {
    expect(needsCycleNow({ frequency: 'Quarterly' }, '2026-10-14')).toBe(false);
    expect(needsCycleNow({ frequency: 'Quarterly' }, '2026-12-01')).toBe(true);
    expect(needsCycleNow({}, '2026-10-14')).toBe(true);
  });
  it('white-label closes 8 business days after month-end, not 5', () => {
    expect(closeDate('2026-09-01')).toBe('2026-10-07');
    expect(closeDate('2026-09-01', WHITE_LABEL_CLOSE_BD)).toBe('2026-10-12');
  });
});
