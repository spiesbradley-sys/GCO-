'use client';

import { ChartCard } from '../ChartCard';
import { AnalyticsTable, type AnalyticsColumn } from '../AnalyticsTable';
import { LocationBars } from '../charts/LocationBars';
import { VarianceCell } from '../VarianceCell';
import { encodeDrill } from '@/lib/analytics/drill';
import type { LocationRow } from '@/lib/analytics/types';

type Row = LocationRow & Record<string, unknown>;

export function LocationPerformancePanel({
  rows,
  onDrill,
}: {
  rows: LocationRow[];
  onDrill: (token: string) => void;
}) {
  const columns: AnalyticsColumn<Row>[] = [
    { key: 'location', header: 'Location', align: 'left', sticky: true, sortable: true },
    { key: 'revenueCents', header: 'Revenue', type: 'money', align: 'right', sortable: true },
    { key: 'productionCents', header: 'Production', type: 'money', align: 'right', sortable: true },
    { key: 'collectionsCents', header: 'Collections', type: 'money', align: 'right', sortable: true },
    { key: 'collectionRate', header: 'Coll. rate', type: 'rate', align: 'right', sortable: true },
    { key: 'arCents', header: 'AR', type: 'money', align: 'right', sortable: true },
    {
      key: 'varianceCents',
      header: 'Var. vs budget',
      align: 'right',
      sortable: true,
      render: (r) => <VarianceCell cents={r.varianceCents} favorable={r.varianceCents >= 0} />,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <h3 className="font-heading text-card-title text-ink">Location performance</h3>
        <AnalyticsTable<Row>
          columns={columns}
          rows={rows as Row[]}
          exportName="location-performance"
          caption="Performance by location"
          getRowId={(r) => r.locationId}
          initialSort={{ key: 'revenueCents', dir: 'desc' }}
          onRowClick={(r) => onDrill(encodeDrill({ t: 'location', locationId: r.locationId }))}
        />
      </div>
      <ChartCard title="Revenue by location" subtitle="Headline metric compared across locations.">
        <LocationBars rows={rows} onSelect={(locationId) => onDrill(encodeDrill({ t: 'location', locationId }))} />
      </ChartCard>
    </div>
  );
}
