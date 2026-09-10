// Deterministic mock metric generator for the CFO dashboard. Same inputs always
// produce the same numbers, so the UI is stable across renders and shareable
// links resolve identically. Real feeds replace these functions; the shapes in
// types.ts stay the same.
//
// TODO(feeds): replace gen* with queries against location_metrics / pnl_lines /
// provider_production / cashflow_entries once the accounting-system sync lands.

import type {
  CashflowPoint,
  PnlRow,
  ProviderRow,
  TrendPoint,
  WaterfallStep,
} from './types';

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded RNG bound to a string key. */
export function rng(key: string) {
  const r = mulberry32(hash(key));
  return {
    next: r,
    between: (min: number, max: number) => min + r() * (max - min),
    intBetween: (min: number, max: number) => Math.round(min + r() * (max - min)),
  };
}

const dollars = (n: number) => Math.round(n) * 100;

/** Core monthly metrics for one location (or the whole group when id = 'group'). */
export function genLocationMetric(orgId: string, locationId: string, period: string) {
  const r = rng(`${orgId}:${locationId}:${period}`);
  const revenue = r.between(190_000, 480_000);
  const production = revenue * r.between(1.02, 1.14);
  const collectionRate = r.between(0.9, 0.98);
  const collections = production * collectionRate;
  const ar = revenue * r.between(0.28, 0.62);
  const budgetRevenue = revenue * r.between(0.9, 1.12);
  return {
    revenueCents: dollars(revenue),
    productionCents: dollars(production),
    collectionsCents: dollars(collections),
    collectionRate,
    arCents: dollars(ar),
    budgetRevenueCents: dollars(budgetRevenue),
  };
}

export function genCashflow(orgId: string, locationId: string, period: string): CashflowPoint[] {
  const r = rng(`${orgId}:${locationId}:${period}:cash`);
  let cashOnHand = r.between(320_000, 780_000);
  const weeks = 8;
  const out: CashflowPoint[] = [];
  for (let i = 0; i < weeks; i++) {
    const cashIn = r.between(38_000, 96_000);
    const cashOut = r.between(34_000, 88_000);
    cashOnHand += cashIn - cashOut;
    const budgetNet = r.between(2_000, 14_000);
    out.push({
      bucketId: `${period}-w${i + 1}`,
      label: `Wk ${i + 1}`,
      cashInCents: dollars(cashIn),
      cashOutCents: dollars(cashOut),
      cashOnHandCents: dollars(cashOnHand),
      budgetNetCents: dollars(budgetNet),
    });
  }
  return out;
}

export function genPnl(orgId: string, locationId: string, period: string): PnlRow[] {
  const r = rng(`${orgId}:${locationId}:${period}:pnl`);
  const revenue = r.between(190_000, 480_000);
  const def: Array<[string, PnlRow['category'], number, boolean]> = [
    ['Patient revenue', 'revenue', revenue, true],
    ['Insurance revenue', 'revenue', revenue * 0.45, true],
    ['Clinical supplies', 'cogs', -revenue * 0.11, false],
    ['Lab fees', 'cogs', -revenue * 0.07, false],
    ['Provider compensation', 'opex', -revenue * 0.28, false],
    ['Staff wages', 'opex', -revenue * 0.19, false],
    ['Facilities & rent', 'opex', -revenue * 0.08, false],
    ['Marketing', 'opex', -revenue * 0.04, false],
    ['Software & admin', 'opex', -revenue * 0.05, false],
  ];
  return def.map(([account, category, base, positiveIsFavorable], i) => {
    const actual = base;
    const budget = base * r.between(0.9, 1.12);
    return {
      lineId: `${period}-pnl-${i}`,
      account,
      category,
      actualCents: dollars(actual),
      budgetCents: dollars(budget),
      varianceCents: dollars(actual - budget),
      positiveIsFavorable,
    };
  });
}

/** Adjusted-EBITDA bridge: reported EBITDA + add-backs → adjusted EBITDA. */
export function genEbitdaWaterfall(orgId: string, locationId: string, period: string): WaterfallStep[] {
  const r = rng(`${orgId}:${locationId}:${period}:ebitda`);
  const reported = r.between(70_000, 160_000);
  const addbacks: Array<[string, number]> = [
    ['Owner compensation normalization', r.between(18_000, 42_000)],
    ['One-time legal', r.between(4_000, 12_000)],
    ['Non-recurring equipment', r.between(6_000, 16_000)],
    ['Personal travel', r.between(2_000, 7_000)],
    ['Rent to market', -r.between(3_000, 9_000)],
  ];
  const steps: WaterfallStep[] = [
    { stepId: `${period}-wf-start`, label: 'Reported EBITDA', kind: 'start', amountCents: dollars(reported) },
  ];
  let running = reported;
  addbacks.forEach(([label, amt], i) => {
    running += amt;
    steps.push({
      stepId: `${period}-wf-${i}`,
      label,
      kind: 'delta',
      amountCents: dollars(amt),
    });
  });
  steps.push({ stepId: `${period}-wf-end`, label: 'Adjusted EBITDA', kind: 'end', amountCents: dollars(running) });
  return steps;
}

export function genProviderProduction(orgId: string, providerId: string, period: string) {
  const r = rng(`${orgId}:${providerId}:${period}:prod`);
  const production = r.between(52_000, 138_000);
  const rate = r.between(0.88, 0.97);
  const collections = production * rate;
  const adjustments = production * r.between(0.03, 0.11);
  return {
    productionCents: dollars(production),
    collectionsCents: dollars(collections),
    collectionRate: rate,
    adjustmentsCents: dollars(adjustments),
  };
}

export function genCollectionTrend(orgId: string, locationId: string, period: string): TrendPoint[] {
  const r = rng(`${orgId}:${locationId}:${period}:trend`);
  const months = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  return months.map((m) => ({ label: m, rate: r.between(0.9, 0.98) }));
}

// Fallback locations/providers so the dashboard renders even before seed data
// exists. Ids are stable per org. Real rows (from the DB) take precedence.
const LOCATION_NAMES = ['Downtown', 'Riverside', 'Northgate', 'Lakeshore', 'Eastside'];
const PROVIDER_NAMES = ['Dr. A. Mensah', 'Dr. L. Petrova', 'Dr. R. Okonkwo', 'Dr. S. Yamamoto', 'Dr. J. Alvarez'];

export function fallbackLocations(orgId: string) {
  const short = hash(orgId).toString(36).slice(0, 6);
  return LOCATION_NAMES.slice(0, 4).map((n, i) => ({ id: `loc_${short}_${i}`, name: `Logic Dental — ${n}` }));
}
export function fallbackProviders(orgId: string) {
  const short = hash(orgId).toString(36).slice(0, 6);
  return PROVIDER_NAMES.map((n, i) => ({ id: `prv_${short}_${i}`, name: n }));
}
