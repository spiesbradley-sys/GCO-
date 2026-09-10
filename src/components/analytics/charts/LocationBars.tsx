'use client';

import { Bar, BarChart, Cell, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { LocationRow } from '@/lib/analytics/types';
import { CHART, SERIES, axisCurrency } from './theme';
import { rechartsTooltip } from './ChartTooltip';

// Headline metric (revenue) compared across locations, series colors in the
// fixed order. Beyond six locations we aggregate the tail into "Other" rather
// than adding colors. Click a bar to drill into the location.
export function LocationBars({
  rows,
  onSelect,
}: {
  rows: LocationRow[];
  onSelect?: (locationId: string) => void;
}) {
  const head = rows.slice(0, 6);
  const tail = rows.slice(6);
  const data = head.map((r) => ({ label: r.location, Revenue: r.revenueCents, locationId: r.locationId }));
  if (tail.length) {
    data.push({
      label: 'Other',
      Revenue: tail.reduce((a, r) => a + r.revenueCents, 0),
      locationId: '',
    });
  }

  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={CHART.gridline} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: CHART.axisText, fontSize: 12 }} tickLine={false} axisLine={{ stroke: CHART.gridline }} />
          <YAxis tickFormatter={axisCurrency} tick={{ fill: CHART.axisText, fontSize: 12 }} tickLine={false} axisLine={false} width={56} />
          <Tooltip content={rechartsTooltip('money')} cursor={{ fill: 'rgba(37,28,26,0.04)' }} />
          <Bar
            dataKey="Revenue"
            radius={[3, 3, 0, 0]}
            maxBarSize={48}
            onClick={(_, i) => data[i].locationId && onSelect?.(data[i].locationId)}
            cursor={onSelect ? 'pointer' : undefined}
          >
            {data.map((d, i) => (
              <Cell key={d.label} fill={SERIES[i % SERIES.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
