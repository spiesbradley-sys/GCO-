'use client';

import { cn } from '@/lib/utils';
import { KpiStat } from '../KpiStat';
import { encodeDrill } from '@/lib/analytics/drill';
import type { Kpi } from '@/lib/analytics/types';

// Free-floating KPI row — no boxes. Hairline dividers separate the figures on
// wide screens; on narrow screens they wrap into a clean grid.
export function KpiStrip({ kpis, onDrill }: { kpis: Kpi[]; onDrill: (token: string) => void }) {
  return (
    <section
      aria-label="Key metrics"
      className="grid grid-cols-2 gap-x-8 gap-y-7 py-2 sm:grid-cols-3 xl:flex xl:gap-0"
    >
      {kpis.map((kpi, i) => (
        <div
          key={kpi.key}
          className={cn('xl:flex-1', i > 0 && 'xl:border-l xl:border-border-subtle xl:pl-6', i > 0 && 'xl:ml-6')}
        >
          <KpiStat kpi={kpi} onDrill={(metric) => onDrill(encodeDrill({ t: 'kpi', metric }))} />
        </div>
      ))}
    </section>
  );
}
