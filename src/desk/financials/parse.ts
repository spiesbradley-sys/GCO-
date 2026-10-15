import type { FinancialsData, NamedAmount } from './types';

// Parses the GCO monthly financials workbook (the "GCO-<client>_Financials" book:
// Overview, P&L - Monthly, Cash - Monthly, Solvency & Liquidity, AR - Open
// Receivables, Review & Open Items) into FinancialsData.
//
// Everything is located by LABEL, not by cell address, so inserted rows, an extra
// revenue stream or a moved column don't break it. Anything that can't be found is
// left null/empty and reported in `warnings` (desk-only) rather than guessed.
//
// Pure: works on plain grids so it is testable without a real .xlsx — see
// readWorkbook.ts for the ExcelJS adapter.

export type Cell = string | number | boolean | null;
/** One sheet as rows of cells, 0-based. */
export type Grid = { name: string; rows: Cell[][] };

export type ParseResult = { data: FinancialsData; warnings: string[] };

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const norm = (v: Cell): string =>
  typeof v === 'string' ? v.replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim().toLowerCase() : '';
const text = (v: Cell): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s === '' ? null : s;
};
const isNum = (v: Cell): v is number => typeof v === 'number' && Number.isFinite(v);
const cents = (v: Cell): number | null => (isNum(v) ? Math.round(v * 100) : null);

function findSheet(grids: Grid[], ...names: string[]): Grid | null {
  const wanted = names.map((n) => norm(n));
  return grids.find((g) => wanted.includes(norm(g.name))) ?? null;
}

type Hit = { r: number; c: number };

/** First row (from `from`) whose first few cells hold text matching `label`. */
function findRow(g: Grid, label: string | RegExp, from = 0, to = g.rows.length): Hit | null {
  for (let r = from; r < Math.min(to, g.rows.length); r++) {
    const row = g.rows[r] ?? [];
    for (let c = 0; c < Math.min(row.length, 4); c++) {
      const s = norm(row[c]);
      if (!s) continue;
      if (typeof label === 'string' ? s.startsWith(label.toLowerCase()) : label.test(s)) return { r, c };
    }
  }
  return null;
}

/** First number to the right of the label. */
function numRight(g: Grid, hit: Hit | null): number | null {
  if (!hit) return null;
  const row = g.rows[hit.r] ?? [];
  for (let c = hit.c + 1; c < row.length; c++) if (isNum(row[c])) return cents(row[c]);
  return null;
}

/** Locate the month header row: returns its index and the month columns (stops at "Total"). */
function monthHeader(g: Grid): { r: number; cols: number[]; labels: string[] } | null {
  for (let r = 0; r < Math.min(g.rows.length, 15); r++) {
    const row = g.rows[r] ?? [];
    const cols: number[] = [];
    const labels: string[] = [];
    for (let c = 0; c < row.length; c++) {
      const s = norm(row[c]);
      if (MONTHS.includes(s.slice(0, 3)) && s.length <= 9) {
        cols.push(c);
        labels.push(String(row[c]).trim().slice(0, 3));
      } else if (s === 'total' && cols.length) break;
    }
    if (cols.length >= 1) return { r, cols, labels };
  }
  return null;
}

const monthly = (g: Grid, r: number, cols: number[]): number[] =>
  cols.map((c) => cents((g.rows[r] ?? [])[c] ?? null) ?? 0);

/** Name/amount rows between a section header and its total row. */
function namedList(g: Grid, header: string, total: string): NamedAmount[] {
  const h = findRow(g, header);
  if (!h) return [];
  const end = findRow(g, total, h.r + 1);
  const out: NamedAmount[] = [];
  for (let r = h.r + 1; r < (end ? end.r : g.rows.length); r++) {
    const row = g.rows[r] ?? [];
    const name = text(row[h.c] ?? null);
    const v = row[h.c + 1];
    if (name && isNum(v)) out.push({ name, cents: Math.round(v * 100) });
  }
  return out.sort((a, b) => b.cents - a.cents);
}

/** "Clear Aligner Advisor · Jan-Aug 2026 · cash basis" → entity + year. */
function subtitleParts(g: Grid | null): { entity: string | null; year: string | null } {
  if (!g) return { entity: null, year: null };
  for (let r = 0; r < 5; r++) {
    for (const v of g.rows[r] ?? []) {
      const s = text(v);
      if (s && s.includes('·')) {
        const entity = s.split('·')[0].trim() || null;
        const year = s.match(/20\d\d/)?.[0] ?? null;
        return { entity, year };
      }
    }
  }
  return { entity: null, year: null };
}

function bulletsAfter(g: Grid, label: string): string[] {
  const h = findRow(g, label);
  if (!h) return [];
  const out: string[] = [];
  for (let r = h.r + 1; r < g.rows.length; r++) {
    const s = text((g.rows[r] ?? [])[h.c] ?? null);
    if (!s) {
      if (out.length) break;
      continue;
    }
    if (!s.startsWith('•')) break;
    out.push(s.replace(/^•\s*/, ''));
  }
  return out;
}

export function parseFinancials(grids: Grid[]): ParseResult {
  const warnings: string[] = [];
  const need = (g: Grid | null, name: string) => {
    if (!g) warnings.push(`Sheet "${name}" not found — its panels will be empty.`);
    return g;
  };

  const overview = need(findSheet(grids, 'Overview'), 'Overview');
  const pl = need(findSheet(grids, 'P&L - Monthly'), 'P&L - Monthly');
  const cashSheet = need(findSheet(grids, 'Cash - Monthly'), 'Cash - Monthly');
  const solv = need(findSheet(grids, 'Solvency & Liquidity'), 'Solvency & Liquidity');
  const ar = findSheet(grids, 'AR - Open Receivables');
  const review = findSheet(grids, 'Review & Open Items');

  const data: FinancialsData = {
    version: 1,
    entity: null,
    months: [],
    periodLabel: null,
    kpis: {
      netRevenue: null,
      netIncome: null,
      netMargin: null,
      operatingProfit: null,
      ownerCashOut: null,
      cashOnHand: null,
      availableCredit: null,
      cashAvailable: null,
      totalDebt: null,
      netLiquidity: null,
    },
    revenueByProduct: [],
    grossRevenue: null,
    refunds: null,
    revenueByStream: [],
    grossRevenueMonthly: [],
    netIncomeMonthly: [],
    cash: { cashIn: [], cashOut: [], netChange: [], story: null },
    expensesByCategory: [],
    receivables: null,
    liquidityNotes: [],
    openItems: [],
  };

  // ── Overview: headline KPIs + revenue/expense breakdowns ──────────────────
  if (overview) {
    const h = findRow(overview, 'net revenue');
    if (h) {
      const head = overview.rows[h.r] ?? [];
      const vals = overview.rows[h.r + 1] ?? [];
      const at = (label: string) => {
        const c = head.findIndex((v) => norm(v).startsWith(label));
        return c >= 0 ? vals[c] ?? null : null;
      };
      data.kpis.netRevenue = cents(at('net revenue'));
      data.kpis.netIncome = cents(at('net income'));
      const margin = at('net margin');
      data.kpis.netMargin = isNum(margin) ? margin : null;
      data.kpis.operatingProfit = cents(at('operating profit'));
      const owner = cents(at('net owner cash'));
      data.kpis.ownerCashOut = owner === null ? null : -owner;
    } else warnings.push('Overview: KPI row ("Net revenue", "Net income", ...) not found.');

    data.revenueByProduct = namedList(overview, 'revenue by stream', 'gross revenue');
    data.grossRevenue = numRight(overview, findRow(overview, 'gross revenue'));
    data.refunds = numRight(overview, findRow(overview, /^less: ?refunds/));
    data.expensesByCategory = namedList(overview, 'expenses by category', 'total expenses');
    if (!data.revenueByProduct.length) warnings.push('Overview: "Revenue by stream" list not found.');
    if (!data.expensesByCategory.length) warnings.push('Overview: "Expenses by category" list not found.');
  }

  // ── P&L - Monthly: months, revenue by stream, net income trend ────────────
  const sub = subtitleParts(pl ?? cashSheet);
  data.entity = sub.entity;
  if (pl) {
    const mh = monthHeader(pl);
    if (!mh) warnings.push('P&L - Monthly: month header row not found.');
    else {
      data.months = mh.labels;
      const rev = findRow(pl, 'revenue', mh.r + 1);
      const gross = findRow(pl, 'gross revenue', mh.r + 1);
      if (rev && gross) {
        for (let r = rev.r + 1; r < gross.r; r++) {
          const name = text((pl.rows[r] ?? [])[rev.c] ?? null);
          if (name) data.revenueByStream.push({ name, values: monthly(pl, r, mh.cols) });
        }
        data.grossRevenueMonthly = monthly(pl, gross.r, mh.cols);
      } else warnings.push('P&L - Monthly: REVENUE / Gross revenue rows not found.');
      const ni = findRow(pl, 'net income', mh.r + 1);
      if (ni) data.netIncomeMonthly = monthly(pl, ni.r, mh.cols);
      else warnings.push('P&L - Monthly: NET INCOME row not found.');
    }
  }
  if (data.months.length) {
    const first = data.months[0];
    const last = data.months[data.months.length - 1];
    data.periodLabel = `${first}${first === last ? '' : ` to ${last}`}${sub.year ? ` ${sub.year}` : ''}`;
  }

  // ── Cash - Monthly: in / out / net by month ───────────────────────────────
  if (cashSheet) {
    const mh = monthHeader(cashSheet);
    const inRow = findRow(cashSheet, 'cash in');
    const outRow = findRow(cashSheet, 'cash out');
    const net = findRow(cashSheet, 'net cash change');
    if (!mh || !inRow || !outRow || !net) warnings.push('Cash - Monthly: expected Cash in / Cash out / Net cash change rows.');
    else {
      const zero = mh.cols.map(() => 0);
      const sumRows = (from: number, to: number) => {
        const acc = [...zero];
        for (let r = from; r < to; r++) monthly(cashSheet, r, mh.cols).forEach((v, i) => (acc[i] += v));
        return acc;
      };
      data.cash.cashIn = sumRows(inRow.r, outRow.r);
      data.cash.cashOut = sumRows(outRow.r + 1, net.r).map((v) => -v);
      data.cash.netChange = monthly(cashSheet, net.r, mh.cols);
      if (!data.months.length) data.months = mh.labels;
    }
    const story = findRow(cashSheet, 'the cash story');
    if (story) data.cash.story = text((cashSheet.rows[story.r + 1] ?? [])[story.c] ?? null);
  }

  // ── Solvency & Liquidity ──────────────────────────────────────────────────
  if (solv) {
    data.kpis.cashOnHand = numRight(solv, findRow(solv, 'cash on hand'));
    data.kpis.totalDebt = numRight(solv, findRow(solv, 'total short-term debt'));
    data.kpis.netLiquidity = numRight(solv, findRow(solv, 'net cash position'));
    data.kpis.availableCredit = numRight(solv, findRow(solv, 'available credit'));
    if (data.kpis.cashOnHand !== null)
      data.kpis.cashAvailable = data.kpis.cashOnHand + (data.kpis.availableCredit ?? 0);
    if (data.kpis.cashOnHand === null) warnings.push('Solvency & Liquidity: "Cash on hand" not found.');
    data.liquidityNotes = bulletsAfter(solv, 'the read');
  }

  // ── AR - Open Receivables ─────────────────────────────────────────────────
  if (ar) {
    const h = findRow(ar, 'invoice #');
    if (h) {
      const head = (ar.rows[h.r] ?? []).map(norm);
      const col = (p: string) => head.findIndex((s) => s.startsWith(p));
      const cInv = col('invoice'), cCust = col('customer'), cDate = col('inv. date'), cAmt = col('amount');
      const cColl = col('collected'), cNote = col('note');
      const open: NonNullable<FinancialsData['receivables']>['open'] = [];
      let seen = false;
      for (let r = h.r + 1; r < ar.rows.length; r++) {
        const row = ar.rows[r] ?? [];
        if (!text(row[cCust] ?? null) || !isNum(row[cAmt])) {
          if (seen) break; // the blank row before the totals block ends the invoice list
          continue;
        }
        seen = true;
        // Open = billed by period end and not collected by it ("No"); "n/a" is post-period.
        if (norm(row[cColl] ?? null) !== 'no') continue;
        open.push({
          invoice: text(row[cInv] ?? null) ?? '',
          customer: text(row[cCust] ?? null) ?? '',
          date: text(row[cDate] ?? null),
          cents: Math.round((row[cAmt] as number) * 100),
          note: cNote >= 0 ? text(row[cNote] ?? null) : null,
        });
      }
      const tot = findRow(ar, /^a\/r outstanding/);
      const buckets: NamedAmount[] = [];
      if (tot) {
        for (let r = tot.r + 1; r < ar.rows.length; r++) {
          const row = ar.rows[r] ?? [];
          const raw = row[tot.c];
          if (typeof raw !== 'string' || !/^\s/.test(raw)) break; // buckets are indented
          const v = numRight(ar, { r, c: tot.c });
          if (v !== null) buckets.push({ name: raw.trim(), cents: v });
        }
      }
      const asOfLabel = tot ? text((ar.rows[tot.r] ?? [])[tot.c] ?? null) : null;
      data.receivables = {
        asOf: asOfLabel?.match(/as of (.+)$/i)?.[1] ?? null,
        totalCents: numRight(ar, tot) ?? open.reduce((s, o) => s + o.cents, 0),
        buckets,
        open,
      };
    }
  }

  // ── Review & Open Items ───────────────────────────────────────────────────
  if (review) {
    const h = findRow(review, /^#$/);
    if (h) {
      let group = 'Open items';
      for (let r = h.r + 1; r < review.rows.length; r++) {
        const row = review.rows[r] ?? [];
        const num = row[h.c];
        const item = text(row[h.c + 1] ?? null);
        if (isNum(num) && item) data.openItems.push({ group, item, note: text(row[h.c + 2] ?? null) });
        else if (text(num) && !isNum(num)) group = text(num) as string;
      }
    }
  }

  return { data, warnings };
}
