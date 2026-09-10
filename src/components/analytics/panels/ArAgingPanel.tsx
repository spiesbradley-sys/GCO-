'use client';

import { ChartCard } from '../ChartCard';
import { AnalyticsTable, type AnalyticsColumn } from '../AnalyticsTable';
import { ArAgingBars } from '../charts/ArAgingBars';
import { GLOSSARY } from '../TermTooltip';
import { encodeDrill } from '@/lib/analytics/drill';
import { AR_BUCKETS, AR_BUCKET_LABEL, type ArBucketDatum, type ArRow } from '@/lib/analytics/types';

type FlatRow = { id: string; label: string; total: number } & Record<string, number | string>;

function flatten(rows: ArRow[]): FlatRow[] {
  return rows.map((r) => {
    const base: FlatRow = { id: r.refId, label: r.label, total: r.totalCents };
    for (const b of AR_BUCKETS) base[b] = r.byBucket[b];
    return base;
  });
}

const bucketColumns: AnalyticsColumn<FlatRow>[] = AR_BUCKETS.map((b) => ({
  key: b,
  header: AR_BUCKET_LABEL[b],
  type: 'money' as const,
  align: 'right' as const,
  sortable: true,
}));

export function ArAgingPanel({
  buckets,
  byLocation,
  byPayer,
  gloss,
  onDrill,
}: {
  buckets: ArBucketDatum[];
  byLocation: ArRow[];
  byPayer: ArRow[];
  gloss: boolean;
  onDrill: (token: string) => void;
}) {
  const bucketTable = (
    <AnalyticsTable
      columns={[
        { key: 'label', header: 'Bucket', align: 'left', sticky: true },
        { key: 'amountCents', header: 'Amount', type: 'money', align: 'right' },
        { key: 'invoiceCount', header: 'Invoices', align: 'right' },
      ]}
      rows={buckets.map((b) => ({ id: b.bucket, label: AR_BUCKET_LABEL[b.bucket], amountCents: b.amountCents, invoiceCount: b.invoiceCount }))}
      exportName="ar-aging-buckets"
      caption="AR by aging bucket"
      getRowId={(r) => String(r.id)}
      onRowClick={(r) => onDrill(encodeDrill({ t: 'ar-bucket', bucket: r.id as never }))}
    />
  );

  const locColumns: AnalyticsColumn<FlatRow>[] = [
    { key: 'label', header: 'Location', align: 'left', sticky: true, sortable: true },
    ...bucketColumns,
    { key: 'total', header: 'Total', type: 'money', align: 'right', sortable: true },
  ];
  const payerColumns: AnalyticsColumn<FlatRow>[] = [
    { key: 'label', header: 'Payer', align: 'left', sticky: true, sortable: true },
    ...bucketColumns,
    { key: 'total', header: 'Total', type: 'money', align: 'right', sortable: true },
  ];

  return (
    <div className="flex flex-col gap-4">
      <ChartCard
        title="AR aging"
        glossTerm={gloss ? 'AR aging' : undefined}
        glossDefinition={gloss ? GLOSSARY['AR aging'] : undefined}
        subtitle="Outstanding receivables by age. The 90+ bucket is flagged as risk."
        dataTable={bucketTable}
      >
        <ArAgingBars buckets={buckets} onSelect={(bucket) => onDrill(encodeDrill({ t: 'ar-bucket', bucket }))} />
      </ChartCard>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <div className="flex flex-col gap-3">
          <h3 className="font-heading text-card-title text-ink">AR by location</h3>
          <AnalyticsTable<FlatRow>
            columns={locColumns}
            rows={flatten(byLocation)}
            exportName="ar-by-location"
            caption="AR by location and bucket"
            getRowId={(r) => r.id}
            initialSort={{ key: 'total', dir: 'desc' }}
            onRowClick={(r) => onDrill(encodeDrill({ t: 'ar-loc', locationId: r.id }))}
          />
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="font-heading text-card-title text-ink">AR by payer</h3>
          <AnalyticsTable<FlatRow>
            columns={payerColumns}
            rows={flatten(byPayer)}
            exportName="ar-by-payer"
            caption="AR by payer and bucket"
            getRowId={(r) => r.id}
            initialSort={{ key: 'total', dir: 'desc' }}
            onRowClick={(r) => onDrill(encodeDrill({ t: 'ar-payer', payerId: r.id }))}
          />
        </div>
      </div>
    </div>
  );
}
