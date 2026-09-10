'use client';

import { useRouter } from 'next/navigation';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { AnalyticsTable, type AnalyticsColumn } from './AnalyticsTable';
import { TrendLine } from './charts/TrendLine';
import { cn } from '@/lib/utils';
import { encodeDrill } from '@/lib/analytics/drill';
import type { DrillContent } from '@/lib/analytics/service';

// One reusable drawer for every panel's drill-down. Content is resolved
// server-side (after auth + tenant checks) and passed in; this only renders it.
// A second drill (an invoice row) opens in place with a back affordance. The one
// action that changes top-level scope (location → full dashboard) is surfaced in
// the footer and handled by the parent.
export function DrillDrawer({
  open,
  content,
  pending,
  hasBack,
  onClose,
  onBack,
  onDrill,
  onScopeChange,
}: {
  open: boolean;
  content: DrillContent | null;
  pending: boolean;
  hasBack: boolean;
  onClose: () => void;
  onBack: () => void;
  onDrill: (token: string) => void;
  onScopeChange: (locationId: string, href: string) => void;
}) {
  const router = useRouter();

  // No-access / not-found — uniform, never leaks whether the target exists.
  if (open && !content && !pending) {
    return (
      <Drawer open={open} onClose={onClose} title="Not available" eyebrow="Drill-down">
        <Banner tone="watch">
          You don&apos;t have access to this, or it&apos;s no longer available.
        </Banner>
      </Drawer>
    );
  }

  if (!open) return null;

  const footer =
    content?.openRecord || content?.scopeChange ? (
      <>
        {content.openRecord && (
          <Button variant="secondary" onClick={() => router.push(content.openRecord!.href)}>
            {content.openRecord.label}
          </Button>
        )}
        {content.scopeChange && (
          <Button onClick={() => onScopeChange(content.scopeChange!.locationId, content.scopeChange!.href)}>
            {content.scopeChange.label}
          </Button>
        )}
      </>
    ) : undefined;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      onBack={hasBack ? onBack : undefined}
      eyebrow={content?.eyebrow}
      title={content?.title ?? 'Loading…'}
      width="lg"
      footer={footer}
    >
      <div className="flex flex-col gap-5">
        {content?.scopeSummary && (
          <p className="text-[13px] text-ink-tertiary">Scope: {content.scopeSummary}</p>
        )}

        {content?.summary && content.summary.length > 0 && (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
            {content.summary.map((s) => (
              <div key={s.label} className="flex flex-col gap-0.5">
                <dt className="text-[13px] text-ink-tertiary">{s.label}</dt>
                <dd
                  className={cn(
                    'font-numeric text-[18px] font-semibold tnum',
                    s.tone === 'favorable' && 'text-favorable',
                    s.tone === 'unfavorable' && 'text-unfavorable',
                    s.tone === 'watch' && 'text-watch',
                    !s.tone && 'text-ink',
                  )}
                >
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {content?.trend && content.trend.length > 0 && (
          <div>
            <p className="mb-1 text-[13px] font-semibold text-ink-tertiary">Trend</p>
            <TrendLine points={content.trend} kind="percent" height={180} label="Rate" />
          </div>
        )}

        {content?.table && (
          <DrillTableView table={content.table} pending={pending} onDrill={onDrill} />
        )}

        {content?.note && <p className="text-[13px] text-ink-tertiary">{content.note}</p>}
      </div>
    </Drawer>
  );
}

type Row = Record<string, string | number | null>;

function DrillTableView({
  table,
  pending,
  onDrill,
}: {
  table: NonNullable<DrillContent['table']>;
  pending: boolean;
  onDrill: (token: string) => void;
}) {
  const columns: AnalyticsColumn<Row>[] = table.columns.map((c) => {
    // The AR invoice list carries a per-row "drill" token → invoice detail.
    if (c.key === 'drill') {
      return {
        key: 'drill',
        header: '',
        align: 'right',
        render: (row: Row) =>
          row.drill ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDrill(encodeDrill({ t: 'invoice', invoiceId: String(row.drill) }));
              }}
            >
              Open
            </Button>
          ) : null,
      };
    }
    return { key: c.key, header: c.header, type: c.type, align: c.align };
  });

  return (
    <AnalyticsTable<Row>
      columns={columns}
      rows={table.rows as Row[]}
      state={pending ? 'loading' : 'ready'}
      exportName={table.exportName}
      caption={table.caption}
      getRowId={(r, i) => String(r.id ?? i)}
    />
  );
}
