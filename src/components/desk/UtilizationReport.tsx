import Link from 'next/link';
import { cn } from '@/lib/utils';
import { DESK_ROLE_LABEL } from '@/desk/roles';
import { DEFAULT_MONTHLY_HOURS, fmtHours, type Assignment, type ClientLine, type UtilBand, type UtilRow, type Utilization } from '@/desk/utilization';
import { IconChevronRight } from '@/components/ui/icons';

const BAND: Record<UtilBand, { label: string; chip: string; bar: string }> = {
  idle: { label: 'Spare capacity', chip: 'bg-surface-sunken text-ink-tertiary', bar: 'bg-ink-tertiary' },
  under: { label: 'Light', chip: 'bg-surface-sunken text-ink-secondary', bar: 'bg-ink-secondary' },
  healthy: { label: 'Healthy', chip: 'bg-favorable-tint text-favorable', bar: 'bg-favorable' },
  high: { label: 'At capacity', chip: 'bg-watch-tint text-watch', bar: 'bg-watch' },
  over: { label: 'Over capacity', chip: 'bg-unfavorable-tint text-unfavorable', bar: 'bg-unfavorable' },
};

const h = (n: number) => `${fmtHours(n)} h`;
const engHref = (id: string) => `/desk/boards/engagements?open=${id}`;

export function UtilizationReport({
  data,
  scope,
  viewerId,
  canSetCapacity,
}: {
  data: Utilization;
  scope: 'self' | 'team' | 'all';
  viewerId: string;
  canSetCapacity: boolean;
}) {
  const { summary, rows, clients, missing } = data;
  const heading = scope === 'all' ? 'Team utilization' : scope === 'team' ? 'Your team’s utilization' : 'Your utilization';

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="eyebrow">Service desk · utilization</span>
        <h1 className="font-heading text-page-title text-ink">{heading}</h1>
        <p className="text-[15px] text-ink-secondary">
          Each month: {h(summary.used)} required by engagements of {h(summary.capacity)} available.
          {scope !== 'self' && summary.over > 0 && <span className="text-ink"> {summary.over} over capacity.</span>}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-b border-border-subtle pb-4 sm:flex sm:flex-wrap sm:gap-x-8 sm:gap-y-3">
        <Stat value={`${summary.pct}%`} label={scope === 'self' ? 'Utilization' : 'Team utilization'} />
        <Stat value={fmtHours(summary.used)} label="Hours used" divide />
        <Stat value={fmtHours(summary.capacity)} label="Hours available" divide />
        <Stat value={fmtHours(summary.spare)} label={summary.spare < 0 ? 'Hours over' : 'Hours spare'} tone={summary.spare < 0 ? 'bad' : undefined} divide />
        {scope !== 'self' && <Stat value={summary.over} label="Over capacity" tone={summary.over ? 'bad' : undefined} divide />}
      </div>

      {missing.length > 0 && <Missing missing={missing} />}

      <section className="flex flex-col gap-2">
        <div>
          <span className="eyebrow">By person</span>
          <h2 className="font-heading text-[20px] font-bold text-ink">Hours used against hours available</h2>
        </div>
        {rows.length === 0 ? (
          <p className="rounded-input bg-surface-sunken px-3 py-2.5 text-[13.5px] text-ink-secondary">No one to show yet.</p>
        ) : (
          <div className="flex flex-col">
            <div className="hidden grid-cols-[minmax(0,220px)_1fr_auto] gap-x-6 pb-1 text-[12px] font-semibold uppercase tracking-header text-ink-tertiary md:grid">
              <span>Person</span>
              <span>Hours used of available</span>
              <span className="text-right">Status</span>
            </div>
            {rows.map((r) => (
              <Row key={r.id} r={r} you={r.id === viewerId} canOpenDay={scope === 'all'} />
            ))}
          </div>
        )}
      </section>

      {scope === 'all' && (
        <section className="flex flex-col gap-2">
          <div>
            <span className="eyebrow">By client</span>
            <h2 className="font-heading text-[20px] font-bold text-ink">Where the hours go</h2>
            <p className="text-[14px] text-ink-secondary">White-label clients include the end clients we work on for them.</p>
          </div>
          <ClientTable clients={clients} totalUsed={summary.used} />
        </section>
      )}

      <details className="text-[13px] text-ink-secondary">
        <summary className="cursor-pointer font-semibold text-ink">How utilization is calculated</summary>
        <p className="mt-2 max-w-prose">
          Each engagement sets the accountant hours and controller hours it needs per month. A person’s hours used are the accountant hours on every engagement
          they are the accountant for, plus the controller hours on every engagement they control. Paused and ended engagements don’t count. Utilization is
          hours used divided by hours available, which default to {DEFAULT_MONTHLY_HOURS.accountant} for {DESK_ROLE_LABEL.accountant.toLowerCase()}s and{' '}
          {DEFAULT_MONTHLY_HOURS.controller} for {DESK_ROLE_LABEL.controller.toLowerCase()}s
          {canSetCapacity ? (
            <>
              {' '}and can be set per person in{' '}
              <Link href="/desk/admin/staff" className="font-semibold text-accent-secondary">
                Owner Admin → Staff
              </Link>
              .
            </>
          ) : (
            <> and can be set per person by the owner.</>
          )}
        </p>
      </details>
    </div>
  );
}

function Missing({ missing }: { missing: Utilization['missing'] }) {
  return (
    <details className="group rounded-card bg-watch-tint px-4 py-3 text-[13.5px] text-ink">
      <summary className="flex cursor-pointer select-none list-none items-center gap-1 font-semibold">
        <IconChevronRight width={14} height={14} className="transition-transform duration-fast group-open:rotate-90" />
        {missing.length} {missing.length === 1 ? 'engagement needs' : 'engagements need'} hours set
        <span className="font-normal text-ink-secondary"> · they count as 0 until set</span>
      </summary>
      <ul className="mt-2 flex flex-col gap-1 pl-5">
        {missing.map((m) => (
          <li key={m.id}>
            <Link href={engHref(m.id)} className="font-semibold text-accent-secondary">
              {m.name}
            </Link>
            <span className="text-ink-secondary"> · {m.roles.map((r) => DESK_ROLE_LABEL[r].toLowerCase()).join(' and ')} hours</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function Row({ r, you, canOpenDay }: { r: UtilRow; you: boolean; canOpenDay: boolean }) {
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
            aria-valuetext={`${r.pct}% — ${fmtHours(r.used)} of ${fmtHours(r.capacity)} hours, ${b.label}`}
          >
            <div className={cn('h-full rounded-pill', b.bar)} style={{ width: `${Math.min(r.pct, 100)}%` }} />
          </div>
          <span className="w-12 text-right font-numeric text-[15px] font-bold tnum text-ink">{r.pct}%</span>
        </div>
        <div className="mt-1 text-[12.5px] text-ink-secondary tnum">
          {fmtHours(r.used)} of {fmtHours(r.capacity)} h{r.capacityIsDefault && ' (role default)'} ·{' '}
          {r.spare < 0 ? <span className="text-unfavorable">{fmtHours(-r.spare)} h over</span> : `${fmtHours(r.spare)} h spare`}
          {r.unset > 0 && <span className="text-watch"> · {r.unset} without hours set</span>}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className={cn('whitespace-nowrap rounded-pill px-2.5 py-0.5 text-[12px] font-semibold', b.chip)}>{b.label}</span>
        {canOpenDay && (
          <Link href={`/desk/my-day?as=${r.id}`} className="text-[13px] font-semibold text-accent-secondary" aria-label={`Open ${r.name}’s day`}>
            Day →
          </Link>
        )}
      </div>

      {r.assignments.length > 0 && (
        <details className="group col-span-full md:col-span-3">
          <summary className="flex cursor-pointer select-none list-none items-center gap-1 text-[13px] font-semibold text-accent-secondary">
            <IconChevronRight width={14} height={14} className="transition-transform duration-fast group-open:rotate-90" />
            Engagements ({r.assignments.length})
          </summary>
          <div className="mt-2 rounded-input border border-border-subtle px-3 py-1">
            <Assignments list={r.assignments} />
          </div>
        </details>
      )}
    </div>
  );
}

function Assignments({ list }: { list: Assignment[] }) {
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="text-left text-[11.5px] uppercase tracking-header text-ink-tertiary">
          <th className="py-1.5 font-semibold">Engagement</th>
          <th className="py-1.5 font-semibold">As</th>
          <th className="py-1.5 text-right font-semibold">Hours / month</th>
        </tr>
      </thead>
      <tbody>
        {list.map((a) => (
          <tr key={`${a.engagement}-${a.as}`} className="border-t border-border-subtle">
            <td className="py-1.5">
              <Link href={engHref(a.engagement)} className="text-ink hover:text-accent-secondary">
                {a.name}
              </Link>
              {a.whiteLabel && <span className="ml-2 rounded-pill bg-surface-sunken px-2 py-0.5 text-[11.5px] font-semibold text-ink-secondary">White label</span>}
            </td>
            <td className="py-1.5 text-ink-secondary">{DESK_ROLE_LABEL[a.as]}</td>
            <td className="py-1.5 text-right tnum">{a.hours == null ? <span className="text-watch">Not set</span> : <span className="text-ink">{fmtHours(a.hours)}</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ClientTable({ clients, totalUsed }: { clients: ClientLine[]; totalUsed: number }) {
  if (clients.length === 0) {
    return <p className="rounded-input bg-surface-sunken px-3 py-2.5 text-[13.5px] text-ink-secondary">No live engagements assigned yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-card bg-surface-card shadow-sm">
      <table className="w-full min-w-[560px] text-[14px]">
        <thead>
          <tr className="bg-surface-sunken text-left text-[12px] uppercase tracking-header text-ink-tertiary">
            <th className="px-4 py-2.5 font-semibold">Client</th>
            <th className="px-4 py-2.5 text-right font-semibold">Accountant h</th>
            <th className="px-4 py-2.5 text-right font-semibold">Controller h</th>
            <th className="px-4 py-2.5 text-right font-semibold">Total h</th>
            <th className="px-4 py-2.5 text-right font-semibold">Share</th>
            <th className="px-4 py-2.5 text-right font-semibold">Engagements</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => (
            <ClientRows key={c.key} c={c} totalUsed={totalUsed} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClientRows({ c, totalUsed }: { c: ClientLine; totalUsed: number }) {
  const share = totalUsed ? Math.round((c.total / totalUsed) * 100) : 0;
  return (
    <>
      <tr className="border-t border-border-subtle hover:bg-surface-cream">
        <td className="px-4 py-3 font-semibold text-ink">
          {c.label}
          {c.whiteLabel && <span className="ml-2 rounded-pill bg-surface-sunken px-2 py-0.5 text-[11.5px] font-semibold text-ink-secondary">White label</span>}
        </td>
        <td className="px-4 py-3 text-right font-numeric tnum text-ink">{fmtHours(c.accountant)}</td>
        <td className="px-4 py-3 text-right font-numeric tnum text-ink">{fmtHours(c.controller)}</td>
        <td className="px-4 py-3 text-right font-numeric tnum font-semibold text-ink">{fmtHours(c.total)}</td>
        <td className="px-4 py-3 text-right font-numeric tnum text-ink-secondary">{share}%</td>
        <td className="px-4 py-3 text-right font-numeric tnum text-ink-secondary">{c.engagements}</td>
      </tr>
      {c.endClients.map((e) => (
        <tr key={e.label} className="text-[13px]">
          <td className="py-1.5 pl-9 pr-4 text-ink-secondary">{e.label}</td>
          <td className="px-4 py-1.5" colSpan={2} />
          <td className="px-4 py-1.5 text-right font-numeric tnum text-ink-secondary">{fmtHours(e.total)}</td>
          <td className="px-4 py-1.5" colSpan={2} />
        </tr>
      ))}
    </>
  );
}

function Stat({ value, label, tone, divide }: { value: number | string; label: string; tone?: 'bad'; divide?: boolean }) {
  return (
    <div className={cn(divide && 'sm:border-l sm:border-border-subtle sm:pl-8')}>
      <div className={cn('font-numeric text-[30px] font-bold leading-none tnum', tone === 'bad' ? 'text-unfavorable' : 'text-ink')}>{value}</div>
      <div className="mt-1 text-[12.5px] text-ink-secondary">{label}</div>
    </div>
  );
}
