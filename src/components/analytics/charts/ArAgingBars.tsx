'use client';

import { Bar, BarChart, Cell, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AR_BUCKET_LABEL, type ArBucketDatum, type ArBucketKey } from '@/lib/analytics/types';
import { CHART, axisCurrency } from './theme';
import { rechartsTooltip } from './ChartTooltip';

// AR by aging bucket. 90+ flagged rust (risk); the rest use a neutral warm ramp
// so the risk bucket reads unambiguously. Click a bar to drill into that bucket.
const BUCKET_COLOR: Record<ArBucketKey, string> = {
  current: '#52b0b3',
  d1_30: '#9c7d33',
  d31_60: '#c9a769',
  d61_90: '#c0a24a',
  d90_plus: CHART.unfavorable,
};

export function ArAgingBars({
  buckets,
  onSelect,
}: {
  buckets: ArBucketDatum[];
  onSelect?: (bucket: ArBucketKey) => void;
}) {
  const data = buckets.map((b) => ({
    label: AR_BUCKET_LABEL[b.bucket],
    Amount: b.amountCents,
    bucket: b.bucket,
  }));

  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={CHART.gridline} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: CHART.axisText, fontSize: 12 }} tickLine={false} axisLine={{ stroke: CHART.gridline }} />
          <YAxis tickFormatter={axisCurrency} tick={{ fill: CHART.axisText, fontSize: 12 }} tickLine={false} axisLine={false} width={56} />
          <Tooltip content={rechartsTooltip('money')} cursor={{ fill: 'rgba(37,28,26,0.04)' }} />
          <Bar
            dataKey="Amount"
            radius={[3, 3, 0, 0]}
            maxBarSize={56}
            onClick={(_, i) => onSelect?.(data[i].bucket)}
            cursor={onSelect ? 'pointer' : undefined}
          >
            {data.map((d) => (
              <Cell key={d.bucket} fill={BUCKET_COLOR[d.bucket]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
