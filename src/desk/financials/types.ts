// The figures a client dashboard needs, parsed from the GCO monthly financials
// workbook. All money is integer cents; percentages are fractions (0.152 = 15.2%).
// Stored as JSON on DeskFinancials.data, so keep additions optional/back-compatible.

export type NamedAmount = { name: string; cents: number };

export type FinancialsData = {
  version: 1;
  /** Business name as the workbook titles it, e.g. "Clear Aligner Advisor". */
  entity: string | null;
  /** Month labels in column order, e.g. ["Jan", ..., "Aug"]. */
  months: string[];
  /** Human period, e.g. "Jan to Aug 2026". */
  periodLabel: string | null;

  kpis: {
    netRevenue: number | null;
    netIncome: number | null;
    netMargin: number | null;
    operatingProfit: number | null;
    /** Draws less contributions, as the workbook reports it (a positive number is cash out). */
    ownerCashOut: number | null;
    cashOnHand: number | null;
    availableCredit: number | null;
    /** Cash on hand plus unused credit. */
    cashAvailable: number | null;
    totalDebt: number | null;
    /** Cash less total short-term debt. */
    netLiquidity: number | null;
  };

  /** Year-to-date gross revenue by product line, largest first. */
  revenueByProduct: NamedAmount[];
  grossRevenue: number | null;
  refunds: number | null;

  /** Monthly revenue split by stream (Product / Service / Media / Other ...). */
  revenueByStream: { name: string; values: number[] }[];
  grossRevenueMonthly: number[];
  netIncomeMonthly: number[];

  cash: {
    cashIn: number[];
    /** Positive numbers: money that left. */
    cashOut: number[];
    netChange: number[];
    /** Short commentary from the workbook, if any. */
    story: string | null;
  };

  /** Year-to-date spend by category, largest first. */
  expensesByCategory: NamedAmount[];

  receivables: {
    asOf: string | null;
    totalCents: number | null;
    buckets: NamedAmount[];
    open: { invoice: string; customer: string; date: string | null; cents: number; note: string | null }[];
  } | null;

  /** Commentary bullets from Solvency & Liquidity ("The read"). */
  liquidityNotes: string[];

  /** Review & Open Items, grouped as the workbook groups them. */
  openItems: { group: string; item: string; note: string | null }[];
};
