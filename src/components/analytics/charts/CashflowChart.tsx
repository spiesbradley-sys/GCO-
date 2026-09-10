'use client';

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CashflowPoint } from '@/lib/analytics/types';
import { CHART, axisCurrency } from './theme';
import { rechartsTooltip } from './ChartTooltip';

// Cash in vs cash out bars + a solid cash-on-hand line and a dashed budget-net
// line. Horizontal grid only, abbreviated axis, full precision in the tooltip.
// Click a bar to drill into that bucket's movements.
export function CashflowChart({
  points,
  onSelect,
}: {
  points: CashflowPoint[];
  onSelect?: (bucketId: string) => void;
}) {
  const data = points.map((p) => ({
    label: p.label,
    'Cash in': p.cashInCents,
    'Cash out': p.cashOutCents,
    'Cash on hand': p.cashOnHandCents,
    Budget: p.budgetNetCents,
    bucketId: p.bucketId,
  }));

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={CHART.gridline} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: CHART.axisText, fontSize: 12 }} tickLine={false} axisLine={{ stroke: CHART.gridline }} />
          <YAxis
            tickFormatter={axisCurrency}
            tick={{ fill: CHART.axisText, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip content={rechartsTooltip('money')} cursor={{ fill: 'rgba(37,28,26,0.04)' }} />
          <Bar
            dataKey="Cash in"
            fill={CHART.favorable}
            radius={[3, 3, 0, 0]}
            maxBarSize={22}
            onClick={(_, i) => onSelect?.(data[i].bucketId)}
            cursor={onSelect ? 'pointer' : undefined}
          />
          <Bar
            dataKey="Cash out"
            fill={CHART.unfavorable}
            radius={[3, 3, 0, 0]}
            maxBarSize={22}
            onClick={(_, i) => onSelect?.(data[i].bucketId)}
            cursor={onSelect ? 'pointer' : undefined}
          />
          <Line type="monotone" dataKey="Cash on hand" stroke={CHART.ink} strokeWidth={2} dot={false} />
          <Line
            type="monotone"
            dataKey="Budget"
            stroke={CHART.axisDash}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
