import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { IconArrowUp, IconArrowDown } from './icons';

// Free-floating KPI — label, figure and trend sit directly on the page, no card
// or shadow. Figure is 26px Montserrat, tabular numerals. Trend uses the fixed
// data semantics AND an arrow — never color alone.
export function KpiCard({
  label,
  value,
  sub,
  trend,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  trend?: { direction: 'up' | 'down'; favorable: boolean; text: string };
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[12px] font-semibold uppercase tracking-eyebrow text-ink-tertiary">
        {label}
      </span>
      <span className="font-numeric text-[26px] font-bold leading-none tnum text-ink">{value}</span>
      {trend ? (
        <span
          className={cn(
            'inline-flex items-center gap-1 text-[12px] font-semibold',
            trend.favorable ? 'text-favorable' : 'text-unfavorable',
          )}
        >
          {trend.direction === 'up' ? (
            <IconArrowUp width={12} height={12} />
          ) : (
            <IconArrowDown width={12} height={12} />
          )}
          {trend.text}
        </span>
      ) : (
        sub && <span className="text-[12px] text-ink-tertiary">{sub}</span>
      )}
    </div>
  );
}
