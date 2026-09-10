'use client';

import { cn } from '@/lib/utils';
import { IconArrowUp, IconArrowDown } from '@/components/ui/icons';
import type { Kpi } from '@/lib/analytics/types';

// Free-floating KPI: label, figure and variance sit directly on the page — no
// card, no fill, no shadow. Variance is color + arrow, never color alone. The
// whole stat is a quiet link that drills into the metric (figure underlines on
// hover).
export function KpiStat({ kpi, onDrill }: { kpi: Kpi; onDrill?: (metric: Kpi['key']) => void }) {
  const v = kpi.variance;
  return (
    <button
      type="button"
      onClick={onDrill ? () => onDrill(kpi.key) : undefined}
      className={cn(
        'group flex w-full flex-col items-start gap-1 text-left',
        onDrill && 'cursor-pointer',
      )}
    >
      <span className="text-[12px] font-semibold uppercase tracking-eyebrow text-ink-tertiary">
        {kpi.label}
      </span>
      <span
        className={cn(
          'font-numeric text-[26px] font-bold leading-none tnum text-ink',
          onDrill && 'decoration-2 decoration-border-default underline-offset-[6px] group-hover:underline',
        )}
      >
        {kpi.display}
      </span>
      {v ? (
        <span
          className={cn(
            'inline-flex items-center gap-1 text-[12px] font-semibold',
            v.favorable ? 'text-favorable' : 'text-unfavorable',
          )}
        >
          {v.direction === 'up' ? <IconArrowUp width={12} height={12} /> : <IconArrowDown width={12} height={12} />}
          {v.text}
        </span>
      ) : (
        <span className="text-[12px] text-ink-tertiary">No prior period</span>
      )}
    </button>
  );
}
