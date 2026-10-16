'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { IconAlert } from '@/components/ui/icons';
import { fmtDate } from '@/desk/format';
import { fmtHours, monthLabel, monthRange, MAX_ENTRY_HOURS } from '@/desk/utilization';
import { deleteTimeEntry, logTime } from '@/desk/actions/time';

export type MyEntry = { id: string; date: string; hours: number; billable: boolean; note: string | null; engagement: string };

const INTERNAL = '__internal';
const field =
  'h-10 w-full rounded-input border border-border-default bg-surface-card px-3 text-[15px] text-ink focus:border-accent-secondary focus:outline-none';

/** Log your own time, and see / remove what you logged in the month on screen. */
export function TimeLog({
  month,
  defaultDate,
  engagements,
  entries,
}: {
  month: string;
  defaultDate: string;
  engagements: { id: string; name: string }[];
  entries: MyEntry[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [date, setDate] = useState(defaultDate);
  const [hours, setHours] = useState('');
  const [engagement, setEngagement] = useState(engagements[0]?.id ?? INTERNAL);
  const [billable, setBillable] = useState(true);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const { first, last } = monthRange(month);
  const internal = engagement === INTERNAL;
  const mine = entries.reduce((a, e) => a + e.hours, 0);
  const shown = showAll ? entries : entries.slice(0, 8);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(hours);
    if (!date) return setError('Pick the day you worked.');
    if (!hours || !Number.isFinite(n) || n <= 0 || n > MAX_ENTRY_HOURS) return setError(`Enter between 0.25 and ${MAX_ENTRY_HOURS} hours.`);
    setError(null);
    start(async () => {
      const res = await logTime({ date, hours: n, engagement: internal ? null : engagement, billable: internal ? false : billable, note });
      if (!res.ok) return setError(res.error ?? 'That time could not be saved.');
      toast.success(`${fmtHours(Math.round(n * 4) / 4)} h logged for ${fmtDate(date)}.`);
      setHours('');
      setNote('');
      router.refresh();
    });
  }

  function remove(id: string) {
    start(async () => {
      const res = await deleteTimeEntry({ id });
      if (!res.ok) return toast.error(res.error ?? 'That entry could not be removed.');
      toast.success('Entry removed.');
      router.refresh();
    });
  }

  return (
    <section className="rounded-card bg-surface-card p-5 shadow-sm">
      <div className="mb-3">
        <span className="eyebrow">Your time</span>
        <h2 className="font-heading text-[16px] font-bold text-ink">Log hours</h2>
        <p className="text-[13.5px] text-ink-secondary">
          You have logged {fmtHours(mine)} h in {monthLabel(month)}. Log time daily so utilization stays current.
        </p>
      </div>

      <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-3 sm:grid-cols-[150px_110px_minmax(0,1fr)] lg:grid-cols-[150px_110px_minmax(0,1.2fr)_minmax(0,1fr)_auto] lg:items-end">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink">Date</span>
          <input type="date" value={date} min={first} max={last} onChange={(e) => setDate(e.target.value)} className={field} required />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink">Hours</span>
          <input
            type="number"
            inputMode="decimal"
            min={0.25}
            max={MAX_ENTRY_HOURS}
            step={0.25}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="1.5"
            className={`${field} text-right tnum`}
            aria-invalid={!!error}
            aria-describedby={error ? 'timelog-error' : undefined}
            required
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink">Engagement</span>
          <select value={engagement} onChange={(e) => setEngagement(e.target.value)} className={field}>
            {engagements.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
            <option value={INTERNAL}>Internal (admin, training): non-billable</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
          <span className="text-[13px] font-semibold text-ink">
            Note <span className="font-normal text-ink-tertiary">(optional)</span>
          </span>
          <input type="text" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Bank recs, Sept close" className={field} />
        </label>
        <div className="flex items-center gap-4 sm:col-span-3 lg:col-span-1">
          <label className={`flex items-center gap-2 text-[14px] ${internal ? 'text-ink-tertiary opacity-50' : 'text-ink'}`}>
            <input
              type="checkbox"
              checked={internal ? false : billable}
              disabled={internal}
              onChange={(e) => setBillable(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent-secondary)]"
            />
            Billable
          </label>
          <Button type="submit" loading={pending}>
            Log time
          </Button>
        </div>
      </form>
      {error && (
        <p id="timelog-error" role="alert" className="mt-2 flex items-center gap-1.5 text-[13px] text-unfavorable">
          <IconAlert width={14} height={14} /> {error}
        </p>
      )}

      {entries.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[520px] text-[14px]">
            <caption className="sr-only">Your time entries in {monthLabel(month)}</caption>
            <thead>
              <tr className="bg-surface-sunken text-left text-[12px] uppercase tracking-header text-ink-tertiary">
                <th className="px-3 py-2 font-semibold">Date</th>
                <th className="px-3 py-2 font-semibold">Engagement</th>
                <th className="px-3 py-2 font-semibold">Note</th>
                <th className="px-3 py-2 text-right font-semibold">Hours</th>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => (
                <tr key={e.id} className="border-t border-border-subtle hover:bg-surface-cream">
                  <td className="whitespace-nowrap px-3 py-2 text-ink-secondary">{fmtDate(e.date)}</td>
                  <td className="px-3 py-2 text-ink">{e.engagement}</td>
                  <td className="max-w-[260px] truncate px-3 py-2 text-ink-secondary">{e.note || '—'}</td>
                  <td className="px-3 py-2 text-right font-numeric tnum text-ink">{fmtHours(e.hours)}</td>
                  <td className="px-3 py-2 text-[13px] text-ink-secondary">{e.billable ? 'Billable' : 'Non-billable'}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => remove(e.id)} aria-label={`Remove ${fmtHours(e.hours)} h on ${fmtDate(e.date)}`}>
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries.length > 8 && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 text-[13px] font-semibold text-accent-secondary">
              {showAll ? 'Show fewer' : `Show all ${entries.length} entries`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
