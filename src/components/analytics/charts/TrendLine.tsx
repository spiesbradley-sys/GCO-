'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TrendPoint } from '@/lib/analytics/types';
import { CHART, axisCurrency, axisPercent } from './theme';
import { rechartsTooltip } from './ChartTooltip';

// Small trend line for a rate or currency series (collection rate over time, a
// location's mini trend inside a drawer).
export function TrendLine({
  points,
  kind = 'percent',
  height = 200,
  label = 'Value',
}: {
  points: TrendPoint[];
  kind?: 'percent' | 'money';
  height?: number;
  label?: string;
}) {
  const data = points.map((p) => ({
    label: p.label,
    [label]: kind === 'percent' ? (p.rate ?? 0) : (p.valueCents ?? 0),
  }));

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={CHART.gridline} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: CHART.axisText, fontSize: 12 }} tickLine={false} axisLine={{ stroke: CHART.gridline }} />
          <YAxis
            tickFormatter={kind === 'percent' ? axisPercent : axisCurrency}
            tick={{ fill: CHART.axisText, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={48}
            domain={kind === 'percent' ? [0.8, 1] : undefined}
          />
          <Tooltip content={rechartsTooltip(kind)} />
          <Line type="monotone" dataKey={label} stroke={CHART.favorable} strokeWidth={2} dot={{ r: 2, fill: CHART.favorable }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
