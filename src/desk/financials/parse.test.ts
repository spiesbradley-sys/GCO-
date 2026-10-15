import { describe, expect, it } from 'vitest';
import { parseFinancials, type Cell, type Grid } from './parse';

// A cut-down copy of the GCO monthly book's layout (labels in column B, figures to
// the right), with deliberate drift: extra blank rows and a third month.
const g = (name: string, rows: Cell[][]): Grid => ({ name, rows });
const _ = null;

const overview = g('Overview', [
  ['GCO PARTNERS'],
  ['Management Overview - Acme CE'],
  [],
  [_, 'Net revenue', 'Net income', 'Net margin', 'Operating profit', 'Net owner cash out', 'Net cash position'],
  [_, 900, 100, 0.111, 150, -50, 20],
  [],
  [_, 'Revenue by stream', _, '% of gross'],
  [_, 'Courses', 600, 0.6],
  [_, 'Sponsorships', 400, 0.4],
  [_, 'Gross revenue', 1000, 1],
  [_, 'Less: refunds', -100],
  [_, 'Net revenue', 900],
  [],
  [_, 'Expenses by category', _, '% of total'],
  [_, 'Rent', 300],
  [_, 'Payroll', 500],
  [_, 'Total expenses', 800],
]);

const pl = g('P&amp;L - Monthly', [
  ['GCO PARTNERS'],
  ['Profit & Loss - month on month'],
  ['Acme CE · Jan-Mar 2026 · cash basis'],
  [],
  [_, '$', 'Jan', 'Feb', 'Mar', 'Total'],
  [_, 'REVENUE'],
  [_, 'Product income', 100, 200, 300, 600],
  [_, 'Media & sponsorships', 0, 0, 400, 400],
  [_, 'Gross revenue', 100, 200, 700, 1000],
  [_, 'NET INCOME', -10, 20, 90, 100],
]);

const cash = g('Cash - Monthly', [
  [],
  [],
  [],
  [_, '$', 'Jan', 'Feb', 'Mar', 'Total'],
  [_, 'Cash in (collections & deposits)', 100, 200, 300],
  [_, '   Owner contributions', 0, 50, 0],
  [_, 'Cash out'],
  [_, '   Operating payments', -80, -100, -120],
  [_, '   Owner distributions (draws)', -10, 0, -40],
  [_, 'Net cash change', 10, 150, 140],
  [],
  [_, 'The cash story'],
  [_, 'Cash grew with sponsorships.'],
]);

const solv = g('Solvency & Liquidity', [
  [],
  [_, 'Cash on hand (all bank accounts)', 320],
  [_, 'Total short-term debt', 265],
  [_, 'Net cash position (cash − total debt)', 55],
  [_, 'Available credit (limit − balance)', 164],
  [],
  [_, 'The read'],
  [_, '•  Cash covers debt.'],
  [_, '•  Collect the open A/R.'],
]);

const ar = g('AR - Open Receivables', [
  ['A/R - Open Receivables'],
  [],
  ['Invoice #', 'Customer', 'Inv. date', 'Amount', 'Collected by 8/31?', 'Note'],
  [1064, 'CareCredit', '2026-05-21', 25, 'No', 'Follow up.'],
  [1069, 'NADG', '2026-06-22', 54, 'Yes', 'Collected.'],
  [1060, 'Misael', '2026-09-01', 50, 'n/a', 'After period end.'],
  [],
  [_, 'A/R outstanding as of 8/31/2026', _, 25],
  [_, '   60+ days (pre-Jul)', _, 25],
  [_, 'New billings after 8/31', _, 50],
]);

const review = g('Review & Open Items', [
  ['Review & Open Items'],
  [],
  [_, '#', 'Item', 'Status / note'],
  [_, 'Still open', 'Still open', 'Still open'],
  [_, 1, 'Amex reconciliation', 'Waiting on statements'],
  [_, 'Confirmed & posted', 'Confirmed & posted', 'Confirmed & posted'],
  [_, 2, 'Hertz → personal', 'Moved to draws'],
]);

describe('parseFinancials', () => {
  const { data, warnings } = parseFinancials([overview, pl, cash, solv, ar, review]);

  it('reads the period and entity from the P&L subtitle', () => {
    expect(warnings).toEqual([]);
    expect(data.entity).toBe('Acme CE');
    expect(data.months).toEqual(['Jan', 'Feb', 'Mar']);
    expect(data.periodLabel).toBe('Jan to Mar 2026');
  });

  it('reads headline KPIs in cents and flips owner cash to "out"', () => {
    expect(data.kpis.netRevenue).toBe(90000);
    expect(data.kpis.netIncome).toBe(10000);
    expect(data.kpis.netMargin).toBeCloseTo(0.111);
    expect(data.kpis.ownerCashOut).toBe(5000);
    expect(data.kpis.cashAvailable).toBe(32000 + 16400);
    expect(data.kpis.netLiquidity).toBe(5500);
  });

  it('lists revenue and expenses largest first, excluding totals', () => {
    expect(data.revenueByProduct.map((r) => r.name)).toEqual(['Courses', 'Sponsorships']);
    expect(data.expensesByCategory.map((r) => r.name)).toEqual(['Payroll', 'Rent']);
    expect(data.grossRevenue).toBe(100000);
    expect(data.refunds).toBe(-10000);
  });

  it('splits monthly revenue by stream and stops before the Total column', () => {
    expect(data.revenueByStream).toEqual([
      { name: 'Product income', values: [10000, 20000, 30000] },
      { name: 'Media & sponsorships', values: [0, 0, 40000] },
    ]);
    expect(data.netIncomeMonthly).toEqual([-1000, 2000, 9000]);
  });

  it('sums cash in (incl. contributions) and cash out as positives', () => {
    expect(data.cash.cashIn).toEqual([10000, 25000, 30000]);
    expect(data.cash.cashOut).toEqual([9000, 10000, 16000]);
    expect(data.cash.netChange).toEqual([1000, 15000, 14000]);
    expect(data.cash.story).toBe('Cash grew with sponsorships.');
  });

  it('keeps only receivables still uncollected at period end', () => {
    expect(data.receivables?.open.map((o) => o.customer)).toEqual(['CareCredit']);
    expect(data.receivables?.asOf).toBe('8/31/2026');
    expect(data.receivables?.totalCents).toBe(2500);
    expect(data.receivables?.buckets).toEqual([{ name: '60+ days (pre-Jul)', cents: 2500 }]);
  });

  it('groups review items and reads liquidity bullets', () => {
    expect(data.openItems).toEqual([
      { group: 'Still open', item: 'Amex reconciliation', note: 'Waiting on statements' },
      { group: 'Confirmed & posted', item: 'Hertz → personal', note: 'Moved to draws' },
    ]);
    expect(data.liquidityNotes).toEqual(['Cash covers debt.', 'Collect the open A/R.']);
  });

  it('warns instead of guessing when sheets are missing', () => {
    const r = parseFinancials([overview]);
    expect(r.warnings.some((w) => w.includes('Cash - Monthly'))).toBe(true);
    expect(r.data.cash.cashIn).toEqual([]);
    expect(r.data.kpis.netRevenue).toBe(90000);
  });
});
