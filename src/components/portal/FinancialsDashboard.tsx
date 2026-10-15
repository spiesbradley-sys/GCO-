'use client';

import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import { ChartCard } from '@/components/analytics/ChartCard';
import { CHART, SERIES, axisCurrency } from '@/components/analytics/charts/theme';
import { rechartsTooltip } from '@/components/analytics/charts/ChartTooltip';
import { cn, formatCurrencyWhole, formatDate } from '@/lib/utils';
import type { FinancialsData, NamedAmount } from '@/desk/financials/types';

// Client financials dashboard, built from the workbook uploaded on the cycle.
// Layout follows the GCO cashflow & revenue dashboard: KPI strip → revenue by
// product + revenue by stream → cash in/out + expenses → receivables → the read.

const money = (c: number | null | undefined) => (c == null ? '—' : formatCurrencyWhole(c));
const pct = (f: number | null | undefined) => (f == null ? null : `${(f * 100).toFixed(1)}% margin`);

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className="text-[12px] font-semibold uppercase tracking-eyebrow text-ink-tertiary">{children}</span>;
}

/** Ranked horizontal bars with direct value labels (no legend, no axis). */
function RankedBars({ items, tone }: { items: NamedAmount[]; tone: 'chart-1' | 'chart-4' }) {
  const max = Math.max(1, ...items.map((i) => Math.abs(i.cents)));
  return (
    <ul className="flex flex-col gap-2">
      {items.map((i) => (
        <li key={i.name} className="grid grid-cols-[minmax(110px,38%)_1fr] items-center gap-3 text-[13px]">
          <span className="truncate text-right text-ink-secondary" title={i.name}>
            {i.name}
          </span>
          <span className="flex min-w-0 items-center gap-2">
            {/* Bars share whatever is left after a ~96px value label, so the top bar never pushes its label out. */}
            <span
              className={cn('h-4 shrink-0 rounded-sm', tone === 'chart-1' ? 'bg-chart-1' : 'bg-chart-4')}
              style={{ width: `max(4px, calc((100% - 96px) * ${Math.abs(i.cents) / max}))` }}
              aria-hidden
            />
            <span className="whitespace-nowrap font-heading font-semibold tabular-nums text-ink">{money(i.cents)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function MonthTable({ months, rows }: { months: string[]; rows: { name: string; values: number[] }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-surface-sunken text-left text-[12px] uppercase tracking-header text-ink-tertiary">
            <th className="px-3 py-2 font-semibold">Month</th>
            {rows.map((r) => (
              <th key={r.name} className="px-3 py-2 text-right font-semibold">
                {r.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {months.map((m, i) => (
            <tr key={m} className="border-b border-border-subtle">
              <td className="px-3 py-2 text-ink">{m}</td>
              {rows.map((r) => (
                <td key={r.name} className={cn('px-3 py-2 text-right tabular-nums', (r.values[i] ?? 0) < 0 ? 'text-unfavorable' : 'text-ink')}>
                  {money(r.values[i] ?? 0)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FinancialsDashboard({ data, updatedAt }: { data: FinancialsData; updatedAt: string | null }) {
  const { kpis, months } = data;

  // Headline: the strongest month by gross revenue, and its net cash change.
  let best = -1;
  data.grossRevenueMonthly.forEach((v, i) => {
    if (best < 0 || v > data.grossRevenueMonthly[best]) best = i;
  });
  const headline =
    best >= 0
      ? `Strongest month was ${months[best]} at ${money(data.grossRevenueMonthly[best])} gross revenue${
          data.cash.netChange[best] != null ? `, with net cash of ${money(data.cash.netChange[best])}` : ''
        }.`
      : null;

  const streamRows = months.map((m, i) => {
    const row: Record<string, string | number> = { month: m };
    data.revenueByStream.forEach((s) => (row[s.name] = s.values[i] ?? 0));
    return row;
  });
  const cashRows = months.map((m, i) => ({
    month: m,
    'Cash in': data.cash.cashIn[i] ?? 0,
    'Cash out': data.cash.cashOut[i] ?? 0,
    'Net change': data.cash.netChange[i] ?? 0,
  }));
  const ar = data.receivables;

  return (
    <div className="flex flex-col gap-6">
      {headline && <p className="text-[15px] text-ink-secondary">{headline}</p>}

      <Card as="section" className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3 xl:grid-cols-5" >
        <KpiCard label="Net revenue" value={money(kpis.netRevenue)} sub={`${data.periodLabel ?? 'Year to date'}, net of refunds`} />
        <KpiCard label="Net income" value={money(kpis.netIncome)} sub={pct(kpis.netMargin) ?? undefined} />
        <KpiCard label="Cash available" value={money(kpis.cashAvailable)} sub="Bank balances plus unused credit" />
        <KpiCard label="Net liquidity" value={money(kpis.netLiquidity)} sub="Cash less total short-term debt" />
        <KpiCard label="Owner cash out" value={money(kpis.ownerCashOut)} sub="Draws less contributions" />
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <ChartCard title="Every product, year to date" subtitle="Gross revenue by product line">
            {data.revenueByProduct.length ? (
              <RankedBars items={data.revenueByProduct} tone="chart-1" />
            ) : (
              <p className="text-[13px] text-ink-tertiary">No product breakdown in this period’s workbook.</p>
            )}
          </ChartCard>
        </Card>

        <Card>
          <ChartCard
            title="Revenue by stream, monthly"
            subtitle="Which streams drive a good month"
            dataTable={<MonthTable months={months} rows={data.revenueByStream} />}
          >
            <Legend names={data.revenueByStream.map((s) => s.name)} />
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={streamRows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid stroke={CHART.gridline} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: CHART.axisText, fontSize: 12 }} tickLine={false} axisLine={{ stroke: CHART.gridline }} />
                  <YAxis tickFormatter={axisCurrency} tick={{ fill: CHART.axisText, fontSize: 12 }} tickLine={false} axisLine={false} width={56} />
                  <Tooltip content={rechartsTooltip('money')} cursor={{ fill: 'rgba(37,28,26,0.04)' }} />
                  {data.revenueByStream.map((s, i) => (
                    <Bar key={s.name} dataKey={s.name} stackId="rev" fill={SERIES[i % SERIES.length]} maxBarSize={44} isAnimationActive={false} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </Card>

        <Card>
          <ChartCard
            title="Cash in vs out, by month"
            subtitle="Bars are flows, the line is the net change"
            dataTable={
              <MonthTable
                months={months}
                rows={[
                  { name: 'Cash in', values: data.cash.cashIn },
                  { name: 'Cash out', values: data.cash.cashOut },
                  { name: 'Net change', values: data.cash.netChange },
                ]}
              />
            }
            caption={data.cash.story ?? undefined}
          >
            <Legend names={['Cash in', 'Cash out', 'Net change']} colors={[CHART.favorable, CHART.unfavorable, CHART.watch]} />
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={cashRows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid stroke={CHART.gridline} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: CHART.axisText, fontSize: 12 }} tickLine={false} axisLine={{ stroke: CHART.gridline }} />
                  <YAxis tickFormatter={axisCurrency} tick={{ fill: CHART.axisText, fontSize: 12 }} tickLine={false} axisLine={false} width={56} />
                  <Tooltip content={rechartsTooltip('money')} cursor={{ fill: 'rgba(37,28,26,0.04)' }} />
                  <Bar dataKey="Cash in" fill={CHART.favorable} maxBarSize={22} isAnimationActive={false} />
                  <Bar dataKey="Cash out" fill={CHART.unfavorable} maxBarSize={22} isAnimationActive={false} />
                  <Line dataKey="Net change" stroke={CHART.watch} strokeWidth={2} dot={{ r: 3, fill: CHART.watch }} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </Card>

        <Card>
          <ChartCard title="Where it goes, by category" subtitle={`${data.periodLabel ?? 'Year to date'} spend`}>
            {data.expensesByCategory.length ? (
              <RankedBars items={data.expensesByCategory} tone="chart-4" />
            ) : (
              <p className="text-[13px] text-ink-tertiary">No expense breakdown in this period’s workbook.</p>
            )}
          </ChartCard>
        </Card>
      </div>

      {ar && (
        <Card as="section" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Eyebrow>Receivables</Eyebrow>
            <h3 className="font-heading text-card-title text-ink">Open invoices{ar.asOf ? ` at ${ar.asOf}` : ''}</h3>
            <p className="text-[13px] text-ink-tertiary">Billed by period end and not yet collected. {money(ar.totalCents)} in total.</p>
          </div>
          {ar.buckets.length > 0 && (
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              {ar.buckets.map((b) => (
                <KpiCard key={b.name} label={b.name.replace(/\s*\(.*\)$/, '')} value={money(b.cents)} />
              ))}
            </div>
          )}
          {ar.open.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-[14px]">
                <thead>
                  <tr className="bg-surface-sunken text-left text-[12px] uppercase tracking-header text-ink-tertiary">
                    <th className="px-4 py-3 font-semibold">Invoice</th>
                    <th className="px-4 py-3 font-semibold">Customer</th>
                    <th className="px-4 py-3 font-semibold">Billed</th>
                    <th className="px-4 py-3 text-right font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {ar.open.map((o) => (
                    <tr key={o.invoice + o.customer} className="border-b border-border-subtle hover:bg-surface-cream">
                      <td className="px-4 py-3 tabular-nums text-ink">{o.invoice}</td>
                      <td className="px-4 py-3 text-ink">{o.customer}</td>
                      <td className="px-4 py-3 text-ink-secondary">{o.date ? formatDate(o.date) : '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-ink">{money(o.cents)}</td>
                      <td className="px-4 py-3 text-[13px] text-ink-secondary">{o.note ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[13px] text-ink-tertiary">Nothing open at period end.</p>
          )}
        </Card>
      )}

      {data.liquidityNotes.length > 0 && (
        <Card as="section" className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Eyebrow>Solvency &amp; liquidity</Eyebrow>
            <h3 className="font-heading text-card-title text-ink">The read</h3>
          </div>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[14px] text-ink-secondary">
            {data.liquidityNotes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-card bg-ink px-5 py-3 text-[14px] text-white">
        <span className="font-heading text-[12px] font-semibold uppercase tracking-eyebrow text-[color:var(--chart-6)]">Cash reality</span>
        <span>Cash available {money(kpis.cashAvailable)}</span>
        <span>Net liquidity {money(kpis.netLiquidity)}</span>
        <span>Net income {money(kpis.netIncome)}</span>
      </div>
      <p className="text-[13px] text-ink-tertiary">
        Figures from your GCO management financials for {data.periodLabel ?? 'this period'}
        {updatedAt ? `, published ${formatDate(updatedAt)}` : ''}. Cash basis.
      </p>
    </div>
  );
}

function Legend({ names, colors }: { names: string[]; colors?: string[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-secondary">
      {names.map((n, i) => (
        <span key={n} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors?.[i] ?? SERIES[i % SERIES.length] }} aria-hidden />
          {n}
        </span>
      ))}
    </div>
  );
}
