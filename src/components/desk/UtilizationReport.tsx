import Link from 'next/link';
import { cn } from '@/lib/utils';
import { DESK_ROLE_LABEL } from '@/desk/roles';
import { CAPACITY, CONTROLLER_SHARE, WEIGHTS, WHITE_LABEL_DEFAULT, type UtilBand, type UtilRow, type Utilization } from '@/desk/utilization';
import { EngagementLines } from './EngagementLines';

const BAND: Record<UtilBand, { label: string; chip: string; bar: string }> = {
  idle: { label: 'Spare capacity', chip: 'bg-surface-sunken text-ink-tertiary', bar: 'bg-ink-tertiary' },
  under: { label: 'Light', chip: 'bg-surface-sunken text-ink-secondary', bar: 'bg-ink-secondary' },
  healthy: { label: 'Healthy', chip: 'bg-favorable-tint text-favorable', bar: 'bg-favorable' },
  high: { label: 'At capacity', chip: 'bg-watch-tint text-watch', bar: 'bg-watch' },
  over: { label: 'Over capacity', chip: 'bg-unfavorable-tint text-unfavorable', bar: 'bg-unfavorable' },
};

export function UtilizationReport({
  data,
  scope,
  viewerId,
  canEditCapacity,
}: {
  data: Utilization;
  scope: 'self' | 'team' | 'all';
  viewerId: string;
  canEditCapacity: boolean;
}) {
  const { summary, rows } = data;
  const heading = scope === 'all' ? 'Team utilization' : scope === 'team' ? 'Your team’s utilization' : 'Your utilization';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="eyebrow">Service desk · utilization</span>
        <h1 className="font-heading text-page-title text-ink">{heading}</h1>
        <p className="text-[15px] text-ink-secondary">
          {today} · live from current assignments.
          {scope !== 'self' && (
            <>
              {' '}
              <span className="text-ink">
                {summary.over} over capacity
              </span>
              , {summary.high} at capacity, {summary.idle} with spare capacity.
            </>
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-3 border-b border-border-subtle pb-4">
        {scope !== 'self' && <Stat value={`${summary.avgPct}%`} label="Average utilization" />}
        {scope !== 'self' && <Stat value={summary.people} label="People" divide />}
        <Stat value={summary.overdue} label="Overdue cycles" tone={summary.overdue ? 'bad' : undefined} divide={scope !== 'self'} />
        {scope !== 'self' && <Stat value={summary.over} label="Over capacity" tone={summary.over ? 'bad' : undefined} divide />}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-input bg-surface-sunken px-3 py-2.5 text-[13.5px] text-ink-secondary">No one to show yet — assign engagements to see utilization.</p>
      ) : (
        <div className="flex flex-col">
          {rows.map((r) => (
            <Row key={r.id} r={r} you={r.id === viewerId} canOpenDay={scope === 'all'} canEdit={canEditCapacity} />
          ))}
        </div>
      )}

      <details className="text-[13px] text-ink-secondary">
        <summary className="cursor-pointer font-semibold text-ink">How utilization is calculated</summary>
        <p className="mt-2 max-w-prose">
          Each person’s open work is converted to load points: {WEIGHTS.engagement} per active engagement, {WEIGHTS.cycle} per in-flight cycle,{' '}
          {WEIGHTS.review} per review waiting on them, {WEIGHTS.query} per open query they own, and +{WEIGHTS.overdue} for each overdue cycle. Utilization is
          points divided by capacity ({Object.entries(CAPACITY)
            .filter(([k]) => k === 'accountant' || k === 'controller')
            .map(([k, v]) => `${DESK_ROLE_LABEL[k as keyof typeof DESK_ROLE_LABEL].toLowerCase()} ${v}`)
            .join(', ')}). Based on assignments, not logged hours.
        </p>
        <p className="mt-2 max-w-prose">
          Each engagement can have its own capacity number (open a person’s engagements to set it). When set, it replaces the default engagement and cycle points
          for that engagement; reviews, queries and overdue cycles still add on top. Engagements under a white-label client count {WHITE_LABEL_DEFAULT} point each
          unless you set a number, and are grouped under that client. A controller carries {Math.round(CONTROLLER_SHARE * 100)}% of an engagement’s standing load when
          they aren’t also its accountant; reviews, queries and overdue cycles count in full.
        </p>
      </details>
    </div>
  );
}

function Row({ r, you, canOpenDay, canEdit }: { r: UtilRow; you: boolean; canOpenDay: boolean; canEdit: boolean }) {
  const b = BAND[r.band];
  return (
    <div className="grid grid-cols-1 items-center gap-x-6 gap-y-2 border-t border-border-subtle py-3 md:grid-cols-[minmax(0,220px)_1fr_auto]">
      <div className="min-w-0">
        <div className="truncate font-semibold text-ink">
          {r.name}
          {you && <span className="ml-2 text-[12px] font-normal text-ink-tertiary">you</span>}
        </div>
        <div className="text-[12.5px] text-ink-secondary">{DESK_ROLE_LABEL[r.role]}</div>
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <div
            className="h-2 flex-1 overflow-hidden rounded-pill bg-surface-sunken"
            role="meter"
            aria-label={`${r.name} utilization`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(r.pct, 100)}
            aria-valuetext={`${r.pct}% — ${b.label}`}
          >
            <div className={cn('h-full rounded-pill', b.bar)} style={{ width: `${Math.min(r.pct, 100)}%` }} />
          </div>
          <span className="w-12 text-right font-numeric text-[15px] font-bold tnum text-ink">{r.pct}%</span>
        </div>
        <div className="mt-1 text-[12.5px] text-ink-secondary">
          {r.engagements} engagement{r.engagements === 1 ? '' : 's'} · {r.cycles} cycle{r.cycles === 1 ? '' : 's'} · {r.reviews} review{r.reviews === 1 ? '' : 's'} ·{' '}
          {r.queries} quer{r.queries === 1 ? 'y' : 'ies'}
          {r.dueSoon > 0 && ` · ${r.dueSoon} due this week`}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {r.overdue > 0 && (
          <span className="whitespace-nowrap rounded-pill bg-unfavorable-tint px-2.5 py-0.5 text-[12px] font-semibold text-unfavorable">{r.overdue} overdue</span>
        )}
        <span className={cn('whitespace-nowrap rounded-pill px-2.5 py-0.5 text-[12px] font-semibold', b.chip)}>{b.label}</span>
        {canOpenDay && (
          <Link href={`/desk/my-day?as=${r.id}`} className="text-[13px] font-semibold text-accent-secondary" aria-label={`Open ${r.name}’s day`}>
            Day →
          </Link>
        )}
      </div>

      <details className="group col-span-full md:col-span-3">
        <summary className="cursor-pointer select-none text-[13px] font-semibold text-accent-secondary">
          Engagements &amp; capacity ({r.engagements})
        </summary>
        <div className="mt-2 rounded-input border border-border-subtle px-3 py-2">
          <EngagementLines groups={r.groups} otherQueries={r.otherQueries} canEdit={canEdit} />
        </div>
      </details>
    </div>
  );
}

function Stat({ value, label, tone, divide }: { value: number | string; label: string; tone?: 'bad'; divide?: boolean }) {
  return (
    <div className={cn(divide && 'border-l border-border-subtle pl-8')}>
      <div className={cn('font-numeric text-[30px] font-bold leading-none tnum', tone === 'bad' ? 'text-unfavorable' : 'text-ink')}>{value}</div>
      <div className="mt-1 text-[12.5px] text-ink-secondary">{label}</div>
    </div>
  );
}
