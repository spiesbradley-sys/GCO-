import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { RecurringRevenue as RRData } from '@/desk/insights';

const m = (c: number) => '$' + Math.round(c / 100).toLocaleString('en-US');

export function RecurringRevenue({ data }: { data: RRData }) {
  const { rows, liveCents, pendingCents, signedCount } = data;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="eyebrow">Commercials</span>
        <h1 className="font-heading text-page-title text-ink">Recurring revenue</h1>
        <p className="max-w-2xl text-[15px] text-ink-secondary">
          One row per recurring client, by monthly fee. A client counts as live once its engagement letter is signed — that&apos;s when work and billing start. This is the number the Overview uses.
        </p>
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-3 border-b border-border-subtle pb-4">
        <Stat value={`${m(liveCents)}/mo`} label={`Live MRR · ${signedCount} signed`} />
        <Stat value={m(liveCents * 12)} label="Annual run-rate" divide />
        {pendingCents > 0 && <Stat value={`${m(pendingCents)}/mo`} label="Awaiting letter" divide />}
      </div>

      {rows.length === 0 ? (
        <p className="text-[13.5px] text-ink-tertiary">No recurring clients yet. Recurring (monthly) rows in the P&amp;L appear here, one per client.</p>
      ) : (
        <div className="overflow-hidden rounded-card border border-border-subtle bg-surface-card">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
              <thead>
                <tr className="bg-surface-sunken">
                  <Th>Client</Th>
                  <Th>Service</Th>
                  <Th>Status</Th>
                  <Th right>Monthly fee</Th>
                  <Th right>Annual run-rate</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border-subtle hover:bg-surface-cream">
                    <td className="px-4 py-2.5 font-semibold text-ink">
                      <Link href={`/desk/boards/pnl?open=${r.id}`} className="text-ink hover:text-accent-secondary">
                        {r.client}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-ink-secondary">{r.service || '—'}</td>
                    <td className="px-4 py-2.5">
                      <StatusChip status={r.status} />
                    </td>
                    <td className="px-4 py-2.5 text-right tnum text-ink">{m(r.feeCents)}</td>
                    <td className="px-4 py-2.5 text-right tnum text-ink-secondary">{m(r.annualCents)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border-default">
                  <td className="px-4 py-2.5 font-semibold text-ink" colSpan={3}>
                    Live total · {signedCount} signed
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tnum text-ink">{m(liveCents)}/mo</td>
                  <td className="px-4 py-2.5 text-right font-semibold tnum text-ink">{m(liveCents * 12)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ value, label, divide }: { value: string; label: string; divide?: boolean }) {
  return (
    <div className={cn(divide && 'border-l border-border-subtle pl-8')}>
      <div className="font-numeric text-[26px] font-bold leading-none tnum text-ink">{value}</div>
      <div className="mt-1 text-[12.5px] text-ink-secondary">{label}</div>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={cn('whitespace-nowrap px-4 py-2.5 text-[12px] font-semibold uppercase tracking-header text-ink-tertiary', right ? 'text-right' : 'text-left')}>
      {children}
    </th>
  );
}

function StatusChip({ status }: { status: string }) {
  const tone =
    status === 'Letter signed'
      ? 'bg-favorable-tint text-favorable'
      : status === 'Letter pending'
        ? 'bg-watch-tint text-watch'
        : 'bg-surface-sunken text-ink-tertiary';
  return <span className={cn('inline-flex rounded-pill px-2.5 py-0.5 text-[12px] font-semibold', tone)}>{status || '—'}</span>;
}
