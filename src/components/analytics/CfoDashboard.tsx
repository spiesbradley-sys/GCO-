'use client';

import { useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/shell/PageHeader';
import { Banner } from '@/components/ui/Banner';
import { KpiStrip } from './panels/KpiStrip';
import { CashflowPanel } from './panels/CashflowPanel';
import { ArAgingPanel } from './panels/ArAgingPanel';
import { LocationPerformancePanel } from './panels/LocationPerformancePanel';
import { PnlEbitdaPanel } from './panels/PnlEbitdaPanel';
import { ProductionCollectionsPanel } from './panels/ProductionCollectionsPanel';
import { DrillDrawer } from './DrillDrawer';
import { IconChevronRight } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import type { CfoDashboardData } from '@/lib/analytics/types';
import type { DrillContent } from '@/lib/analytics/service';

// Orchestrates the CFO dashboard: period + location filters and drill state all
// live in the URL (shareable, bookmarkable). Filter changes and drills re-render
// via a server round trip (so drill content is re-checked for auth + tenant);
// panels show skeletons on a filter change, the drawer shows a loading table on a
// drill — never a full-page spinner.
export function CfoDashboard({
  data,
  drillContent,
  gloss,
}: {
  data: CfoDashboardData;
  drillContent: DrillContent | null;
  gloss: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [pendingMode, setPendingMode] = useState<'filter' | 'drill' | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(!!sp.get('drill'));

  const drillParam = sp.get('drill');
  const backParam = sp.get('back');

  function buildUrl(next: Record<string, string | null>): string {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v == null) params.delete(k);
      else params.set(k, v);
    }
    return `${pathname}?${params.toString()}`;
  }

  function navigate(url: string, mode: 'filter' | 'drill') {
    setPendingMode(mode);
    startTransition(() => {
      router.push(url, { scroll: false });
    });
  }

  // ── Filters ──
  const months = lastMonths(6);
  function setPeriod(period: string) {
    navigate(buildUrl({ period, drill: null, back: null }), 'filter');
  }
  function setLocation(locationId: string) {
    navigate(
      buildUrl({
        location: locationId === 'all' ? null : locationId,
        scope: locationId === 'all' ? null : 'group',
        drill: null,
        back: null,
      }),
      'filter',
    );
  }
  function backToGroup() {
    navigate(buildUrl({ location: null, scope: null, drill: null, back: null }), 'filter');
  }

  // ── Drills ──
  function onDrill(token: string) {
    setDrawerOpen(true);
    // Drilling deeper keeps the current drill as the back target.
    navigate(buildUrl({ drill: token, back: drillParam ?? null }), 'drill');
  }
  function onBack() {
    if (backParam) navigate(buildUrl({ drill: backParam, back: null }), 'drill');
    else onClose();
  }
  function onClose() {
    setDrawerOpen(false);
    navigate(buildUrl({ drill: null, back: null }), 'drill');
  }
  function onScopeChange(locationId: string) {
    // The one drill that changes top-level scope. Close the drawer, re-scope,
    // and make it obvious via the breadcrumb + banner.
    setDrawerOpen(false);
    navigate(
      buildUrl({ location: locationId, scope: 'location', drill: null, back: null }),
      'filter',
    );
  }

  const filtersPending = isPending && pendingMode === 'filter';
  const drillPending = isPending && pendingMode === 'drill';
  const scopedToLocation = data.scope.level === 'location';

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb when scoped to a location */}
      {data.scope.locationName && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[13px] text-ink-tertiary">
          <button onClick={backToGroup} className="font-semibold text-accent-secondary hover:underline">
            {data.locations.length ? 'Group' : 'Dashboard'}
          </button>
          <IconChevronRight width={12} height={12} />
          <span className="text-ink">{data.scope.locationName}</span>
        </nav>
      )}

      <PageHeader
        eyebrow="Financial analytics"
        title="CFO dashboard"
        description={
          scopedToLocation
            ? `${data.scope.locationName} · ${data.periodLabel}`
            : `Group performance for ${data.periodLabel}.`
        }
        action={
          <div className="flex items-center gap-2">
            <Select
              label="Period"
              value={data.period}
              onChange={setPeriod}
              options={months.map((m) => ({ value: m.value, label: m.label }))}
            />
            <Select
              label="Location"
              value={data.scope.locationId ?? 'all'}
              onChange={setLocation}
              options={[
                { value: 'all', label: 'All locations' },
                ...data.locations.map((l) => ({ value: l.id, label: l.name })),
              ]}
            />
          </div>
        }
      />

      {scopedToLocation && (
        <Banner tone="info" action={
          <button onClick={backToGroup} className="text-[13px] font-semibold text-accent-secondary hover:underline">
            Back to group
          </button>
        }>
          Viewing {data.scope.locationName} as a full dashboard, scoped from the group.
        </Banner>
      )}

      {filtersPending ? (
        <PanelsSkeleton />
      ) : (
        <>
          <KpiStrip kpis={data.kpis} onDrill={onDrill} />
          <div className="flex flex-col gap-12">
            <Section>
              <CashflowPanel points={data.cashflow} onDrill={onDrill} />
            </Section>
            <Section>
              <ArAgingPanel
                buckets={data.ar.buckets}
                byLocation={data.ar.byLocation}
                byPayer={data.ar.byPayer}
                gloss={gloss}
                onDrill={onDrill}
              />
            </Section>
            <Section>
              <LocationPerformancePanel rows={data.locationRows} onDrill={onDrill} />
            </Section>
            <Section>
              <PnlEbitdaPanel
                rows={data.pnl.rows}
                waterfall={data.pnl.ebitdaWaterfall}
                gloss={gloss}
                onDrill={onDrill}
              />
            </Section>
            <Section>
              <ProductionCollectionsPanel
                trend={data.collectionRateTrend}
                providers={data.providerRows}
                gloss={gloss}
                onDrill={onDrill}
              />
            </Section>
          </div>
        </>
      )}

      <DrillDrawer
        open={drawerOpen || !!drillParam}
        content={drillContent}
        pending={drillPending}
        hasBack={!!backParam}
        onClose={onClose}
        onBack={onBack}
        onDrill={onDrill}
        onScopeChange={(locationId) => onScopeChange(locationId)}
      />
    </div>
  );
}

// Each panel is a section separated from the next by a hairline rule — no cards.
function Section({ children }: { children: React.ReactNode }) {
  return <section className="border-t border-border-subtle pt-8">{children}</section>;
}

// ── Small styled native select (accessible, house-styled) ──
function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-10 rounded-input border border-border-default bg-surface-card px-3 pr-8 text-[14px] font-semibold text-ink',
          'focus:outline-none focus-visible:border-accent-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary',
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PanelsSkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Updating">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[104px] rounded-card bg-surface-sunken" />
        ))}
      </div>
      <div className="h-[340px] rounded-card bg-surface-sunken" />
      <div className="h-[320px] rounded-card bg-surface-sunken" />
      <div className="h-[360px] rounded-card bg-surface-sunken" />
    </div>
  );
}

function lastMonths(n: number): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push({
      value: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`,
      label: dt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    });
  }
  return out;
}
