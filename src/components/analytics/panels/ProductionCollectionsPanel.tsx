'use client';

import { ChartCard } from '../ChartCard';
import { AnalyticsTable, type AnalyticsColumn } from '../AnalyticsTable';
import { TrendLine } from '../charts/TrendLine';
import { GLOSSARY } from '../TermTooltip';
import { encodeDrill } from '@/lib/analytics/drill';
import type { ProviderRow, TrendPoint } from '@/lib/analytics/types';

type Row = ProviderRow & Record<string, unknown>;

export function ProductionCollectionsPanel({
  trend,
  providers,
  gloss,
  onDrill,
}: {
  trend: TrendPoint[];
  providers: ProviderRow[];
  gloss: boolean;
  onDrill: (token: string) => void;
}) {
  const columns: AnalyticsColumn<Row>[] = [
    { key: 'provider', header: 'Provider', align: 'left', sticky: true, sortable: true },
    { key: 'productionCents', header: 'Production', type: 'money', align: 'right', sortable: true },
    { key: 'collectionsCents', header: 'Collections', type: 'money', align: 'right', sortable: true },
    { key: 'collectionRate', header: 'Coll. rate', type: 'rate', align: 'right', sortable: true },
    { key: 'adjustmentsCents', header: 'Adjustments', type: 'money', align: 'right', sortable: true },
  ];

  return (
    <div className="flex flex-col gap-4">
      <ChartCard
        title="Collection rate over time"
        glossTerm={gloss ? 'Collection rate' : undefined}
        glossDefinition={gloss ? GLOSSARY['Collection rate'] : undefined}
        subtitle="Collections as a share of production, by month."
        caption="Higher is better; the group targets 95%+."
      >
        <TrendLine points={trend} kind="percent" label="Collection rate" />
      </ChartCard>

      <div className="flex flex-col gap-3">
        <h3 className="font-heading text-card-title text-ink">Production by provider</h3>
        <AnalyticsTable<Row>
          columns={columns}
          rows={providers as Row[]}
          exportName="production-by-provider"
          caption="Production and collections by provider"
          getRowId={(r) => r.providerId}
          initialSort={{ key: 'productionCents', dir: 'desc' }}
          onRowClick={(r) => onDrill(encodeDrill({ t: 'provider', providerId: r.providerId }))}
        />
      </div>
    </div>
  );
}
