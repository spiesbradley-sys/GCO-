'use client';

import { ChartCard } from '../ChartCard';
import { AnalyticsTable, type AnalyticsColumn } from '../AnalyticsTable';
import { Waterfall } from '../charts/Waterfall';
import { VarianceCell } from '../VarianceCell';
import { GLOSSARY } from '../TermTooltip';
import { encodeDrill } from '@/lib/analytics/drill';
import type { PnlRow, WaterfallStep } from '@/lib/analytics/types';

type Row = PnlRow & Record<string, unknown>;

export function PnlEbitdaPanel({
  rows,
  waterfall,
  gloss,
  onDrill,
}: {
  rows: PnlRow[];
  waterfall: WaterfallStep[];
  gloss: boolean;
  onDrill: (token: string) => void;
}) {
  const columns: AnalyticsColumn<Row>[] = [
    { key: 'account', header: 'Account', align: 'left', sticky: true },
    { key: 'actualCents', header: 'Actual', type: 'money', align: 'right', sortable: true },
    { key: 'budgetCents', header: 'Budget', type: 'money', align: 'right', sortable: true },
    {
      key: 'varianceCents',
      header: 'Variance',
      align: 'right',
      sortable: true,
      render: (r) => (
        <VarianceCell cents={r.varianceCents} favorable={r.varianceCents >= 0 === r.positiveIsFavorable} />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <h3 className="font-heading text-card-title text-ink">P&amp;L — actual vs budget</h3>
        <AnalyticsTable<Row>
          columns={columns}
          rows={rows as Row[]}
          exportName="pnl-actual-vs-budget"
          caption="P&L actual vs budget with variance"
          getRowId={(r) => r.lineId}
          onRowClick={(r) => onDrill(encodeDrill({ t: 'pnl-line', lineId: r.lineId }))}
        />
      </div>

      <ChartCard
        title="Adjusted EBITDA bridge"
        glossTerm={gloss ? 'Adjusted EBITDA' : undefined}
        glossDefinition={gloss ? GLOSSARY['Adjusted EBITDA'] : undefined}
        subtitle="Reported EBITDA plus add-backs. Click an add-back to see its supporting entries."
        caption="Positive add-backs increase adjusted EBITDA (teal); negative adjustments reduce it (rust)."
      >
        <Waterfall steps={waterfall} onStepClick={(stepId) => onDrill(encodeDrill({ t: 'addback', stepId }))} />
      </ChartCard>
    </div>
  );
}
