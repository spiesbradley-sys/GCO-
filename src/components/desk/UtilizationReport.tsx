import Link from 'next/link';
import { cn } from '@/lib/utils';
import { DESK_ROLE_LABEL } from '@/desk/roles';
import { DEFAULT_MONTHLY_HOURS, fmtHours, monthLabel, shiftMonth, type HoursLine, type UtilBand, type UtilRow, type Utilization } from '@/desk/utilization';
import { IconChevronRight } from '@/components/ui/icons';
import { TimeLog, type MyEntry } from './TimeLog';

const BAND: Record<UtilBand, { label: string; chip: string; bar: string }> = {
  idle: { label: 'Spare capacity', chip: 'bg-surface-sunken text-ink-tertiary', bar: 'bg-ink-tertiary' },
  under: { label: 'Light', chip: 'bg-surface-sunken text-ink-secondary', bar: 'bg-ink-secondary' },
  healthy: { label: 'Healthy', chip: 'bg-favorable-tint text-favorable', bar: 'bg-favorable' },
  high: { label: 'At capacity', chip: 'bg-watch-tint text-watch', bar: 'bg-watch' },
  over: { label: 'Over capacity', chip: 'bg-unfavorable-tint text-unfavorable', bar: 'bg-unfavorable' },
};

const h = (n: number) => `${fmtHours(n)} h`;
const shortMonth = (m: string) => monthLabel(m).replace(/^(\w{3})\w*/, '$1');

export function UtilizationReport({
  data,
  scope,
  viewerId,
  currentMonth,
  defaultDate,
  engagements,
  myEntries,
  canSetCapacity,
}: {
  data: Utilization;
  scope: 'self' | 'team' | 'all';
  viewerId: string;
  currentMonth: string;
  defaultDate: string;
  engagements: { id: string; name: string }[];
  myEntries: MyEntry[];
  canSetCapacity: boolean;
}) {
  const { summary, rows, clients, month } = data;
  const heading = scope === 'all' ? 'Team utilization' : scope === 'team' ? 'Your team’s utilization' : 'Your utilization';
  const isCurrent = month === currentMonth;
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const canNext = next <= currentMonth;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Service desk · utilization</span>
          <h1 className="font-heading text-page-title text-ink">{heading}</h1>
          <p className="text-[15px] text-ink-secondary">
            {monthLabel(month)}{isCurrent && ' to date'}: {h(summary.billable)} billable of {h(summary.capacity)} available.
            {scope !== 'self' && summary.over > 0 && <span className="text-ink"> {summary.over} over capacity.</span>}
          </p>
        </div>
        <nav aria-label="Month" className="flex items-center gap-1">
          <Link href={`/desk/utilization?month=${prev}`} className="rounded-pill px-3 py-1.5 text-[13.5px] font-semibold text-accent-secondary hover:bg-surface-sunken">
            ← {shortMonth(prev)}
          </Link>
          <span className="px-2 font-heading text-[15px] font-bold text-ink" aria-current="page">
            {monthLabel(month)}
          </span>
          {canNext ? (
            <Link href={`/desk/utilization?month=${next}`} className="rounded-pill px-3 py-1.5 text-[13.5px] font-semibold text-accent-secondary hover:bg-surface-sunken">
              {shortMonth(next)} →
            </Link>
          ) : (
            <span className="px-3 py-1.5 text-[13.5px] font-semibold text-ink-tertiary opacity-50" aria-disabled="true">
              {shortMonth(next)} →
            </span>
          )}
          {!isCurrent && (
            <Link href="/desk/utilization" className="ml-2 rounded-pill px-3 py-1.5 text-[13.5px] font-semibold text-accent-secondary hover:bg-surface-sunken">
              This month
            </Link>
          )}
        </nav>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-b border-border-subtle pb-4 sm:flex sm:flex-wrap sm:gap-x-8 sm:gap-y-3">
        <Stat value={`${summary.pct}%`} label={scope === 'self' ? 'Utilization' : 'Team utilization'} />
        <Stat value={fmtHours(summary.billable)} label="Billable hours" divide />
        <Stat value={fmtHours(summary.nonBillable)} label="Non-billable hours" divide />
        <Stat value={fmtHours(summary.capacity)} label="Hours available" divide />
        {scope !== 'self' && <Stat value={summary.over} label="Over capacity" tone={summary.over ? 'bad' : undefined} divide />}
      </div>

      <TimeLog key={month} month={month} defaultDate={defaultDate} engagements={engagements} entries={myEntries} />

      <section className="flex flex-col gap-2">
        <div>
          <span className="eyebrow">By person</span>
          <h2 className="font-heading text-[20px] font-bold text-ink">Hours against capacity</h2>
        </div>
        {rows.length === 0 ? (
          <p className="rounded-input bg-surface-sunken px-3 py-2.5 text-[13.5px] text-ink-secondary">No one to show for this month.</p>
        ) : (
          <div className="flex flex-col">
            <div className="hidden grid-cols-[minmax(0,220px)_1fr_auto] gap-x-6 pb-1 text-[12px] font-semibold uppercase tracking-header text-ink-tertiary md:grid">
              <span>Person</span>
              <span>Billable hours of capacity</span>
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
            <h2 className="font-heading text-[20px] font-bold text-ink">Where the hours went</h2>
            <p className="text-[14px] text-ink-secondary">White-label clients include the end clients we work on for them.</p>
          </div>
          <ClientTable clients={clients} totalBillable={summary.billable} />
        </section>
      )}

      <details className="text-[13px] text-ink-secondary">
        <summary className="cursor-pointer font-semibold text-ink">How utilization is calculated</summary>
        <p className="mt-2 max-w-prose">
          Utilization is billable hours logged in the month divided by the hours that person has available. Time logged on an engagement counts as billable unless
          it is marked otherwise; internal time (admin, training) never does. Available hours default by role ({DESK_ROLE_LABEL.accountant.toLowerCase()}{' '}
          {DEFAULT_MONTHLY_HOURS.accountant}, {DESK_ROLE_LABEL.controller.toLowerCase()} {DEFAULT_MONTHLY_HOURS.controller},{' '}
          {DESK_ROLE_LABEL.management.toLowerCase()} {DEFAULT_MONTHLY_HOURS.management}, {DESK_ROLE_LABEL.owner.toLowerCase()} {DEFAULT_MONTHLY_HOURS.owner})
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
            aria-valuetext={`${r.pct}% — ${fmtHours(r.billable)} of ${fmtHours(r.capacity)} hours, ${b.label}`}
          >
            <div className={cn('h-full rounded-pill', b.bar)} style={{ width: `${Math.min(r.pct, 100)}%` }} />
          </div>
          <span className="w-12 text-right font-numeric text-[15px] font-bold tnum text-ink">{r.pct}%</span>
        </div>
        <div className="mt-1 text-[12.5px] text-ink-secondary tnum">
          {fmtHours(r.billable)} of {fmtHours(r.capacity)} h billable{r.capacityIsDefault && ' (role default)'} · {fmtHours(r.nonBillable)} h non-billable ·{' '}
          {fmtHours(r.total)} h total
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

      {r.clients.length > 0 && (
        <details className="group col-span-full md:col-span-3">
          <summary className="flex cursor-pointer select-none list-none items-center gap-1 text-[13px] font-semibold text-accent-secondary">
            <IconChevronRight width={14} height={14} className="transition-transform duration-fast group-open:rotate-90" />
            Hours by client ({r.clients.length})
          </summary>
          <div className="mt-2 rounded-input border border-border-subtle px-3 py-1">
            <HoursLines lines={r.clients} />
          </div>
        </details>
      )}
    </div>
  );
}

/** A person's hours by client: compact, no people column. */
function HoursLines({ lines }: { lines: HoursLine[] }) {
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="text-left text-[11.5px] uppercase tracking-header text-ink-tertiary">
          <th className="py-1.5 font-semibold">Client</th>
          <th className="py-1.5 text-right font-semibold">Billable</th>
          <th className="py-1.5 text-right font-semibold">Non-billable</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => (
          <LinesRows key={l.key} l={l} />
        ))}
      </tbody>
    </table>
  );
}

function LinesRows({ l }: { l: HoursLine }) {
  return (
    <>
      <tr className="border-t border-border-subtle">
        <td className="py-1.5 text-ink">
          {l.label}
          {l.whiteLabel && <span className="ml-2 rounded-pill bg-surface-sunken px-2 py-0.5 text-[11.5px] font-semibold text-ink-secondary">White label</span>}
        </td>
        <td className="py-1.5 text-right tnum text-ink">{fmtHours(l.billable)}</td>
        <td className="py-1.5 text-right tnum text-ink-secondary">{fmtHours(l.nonBillable)}</td>
      </tr>
      {l.endClients.map((e) => (
        <tr key={e.label}>
          <td className="py-1 pl-5 text-ink-secondary">{e.label}</td>
          <td className="py-1 text-right tnum text-ink-secondary" colSpan={2}>
            {fmtHours(e.total)} h
          </td>
        </tr>
      ))}
    </>
  );
}

function ClientTable({ clients, totalBillable }: { clients: HoursLine[]; totalBillable: number }) {
  if (clients.length === 0) {
    return <p className="rounded-input bg-surface-sunken px-3 py-2.5 text-[13.5px] text-ink-secondary">No time logged this month yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-card bg-surface-card shadow-sm">
      <table className="w-full min-w-[560px] text-[14px]">
        <thead>
          <tr className="bg-surface-sunken text-left text-[12px] uppercase tracking-header text-ink-tertiary">
            <th className="px-4 py-2.5 font-semibold">Client</th>
            <th className="px-4 py-2.5 text-right font-semibold">Billable</th>
            <th className="px-4 py-2.5 text-right font-semibold">Non-billable</th>
            <th className="px-4 py-2.5 text-right font-semibold">Total</th>
            <th className="px-4 py-2.5 text-right font-semibold">Share of billable</th>
            <th className="px-4 py-2.5 text-right font-semibold">People</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => (
            <ClientRows key={c.key} c={c} totalBillable={totalBillable} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClientRows({ c, totalBillable }: { c: HoursLine; totalBillable: number }) {
  const share = totalBillable ? Math.round((c.billable / totalBillable) * 100) : 0;
  return (
    <>
      <tr className="border-t border-border-subtle hover:bg-surface-cream">
        <td className="px-4 py-3 font-semibold text-ink">
          {c.label}
          {c.whiteLabel && <span className="ml-2 rounded-pill bg-surface-sunken px-2 py-0.5 text-[11.5px] font-semibold text-ink-secondary">White label</span>}
        </td>
        <td className="px-4 py-3 text-right font-numeric tnum text-ink">{fmtHours(c.billable)}</td>
        <td className="px-4 py-3 text-right font-numeric tnum text-ink-secondary">{fmtHours(c.nonBillable)}</td>
        <td className="px-4 py-3 text-right font-numeric tnum text-ink">{fmtHours(c.total)}</td>
        <td className="px-4 py-3 text-right font-numeric tnum text-ink-secondary">{c.key === 'internal' ? '—' : `${share}%`}</td>
        <td className="px-4 py-3 text-right font-numeric tnum text-ink-secondary">{c.people}</td>
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
