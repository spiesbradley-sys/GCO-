'use client';

import { ChartCard } from '../ChartCard';
import { AnalyticsTable, type AnalyticsColumn } from '../AnalyticsTable';
import { CashflowChart } from '../charts/CashflowChart';
import { encodeDrill } from '@/lib/analytics/drill';
import type { CashflowPoint } from '@/lib/analytics/types';

type Row = CashflowPoint & Record<string, unknown>;

export function CashflowPanel({
  points,
  onDrill,
}: {
  points: CashflowPoint[];
  onDrill: (token: string) => void;
}) {
  const columns: AnalyticsColumn<Row>[] = [
    { key: 'label', header: 'Period', align: 'left', sticky: true },
    { key: 'cashInCents', header: 'Cash in', type: 'money', align: 'right' },
    { key: 'cashOutCents', header: 'Cash out', type: 'money', align: 'right' },
    { key: 'cashOnHandCents', header: 'Cash on hand', type: 'money', align: 'right' },
    { key: 'budgetNetCents', header: 'Budget net', type: 'money', align: 'right' },
  ];

  return (
    <ChartCard
      title="Cashflow"
      subtitle="Cash in vs cash out, with cash-on-hand runway. Actual solid, budget dashed."
      dataTable={
        <AnalyticsTable<Row>
          columns={columns}
          rows={points as Row[]}
          exportName="cashflow"
          caption="Cashflow by period"
          getRowId={(r) => r.bucketId}
          onRowClick={(r) => onDrill(encodeDrill({ t: 'cashflow', bucketId: r.bucketId }))}
        />
      }
    >
      <CashflowChart points={points} onSelect={(bucketId) => onDrill(encodeDrill({ t: 'cashflow', bucketId }))} />
    </ChartCard>
  );
}
