'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import { updateRecord } from '@/desk/actions/records';
import { fmtPts, type UtilGroup, type UtilLine } from '@/desk/utilization';

/** Per-engagement line items under a person, with an inline capacity number.
 * White-label clients roll up into one expandable group. */
export function EngagementLines({ groups, otherQueries, canEdit }: { groups: UtilGroup[]; otherQueries: number; canEdit: boolean }) {
  if (groups.length === 0 && otherQueries === 0) {
    return <p className="py-2 text-[13px] text-ink-secondary">No active engagements assigned.</p>;
  }
  return (
    <div className="flex flex-col">
      <div className="hidden grid-cols-[minmax(0,1fr)_96px_64px] gap-3 pb-1 text-[11px] font-semibold uppercase tracking-eyebrow text-ink-tertiary sm:grid">
        <span>Engagement</span>
        <span className="text-right">Capacity</span>
        <span className="text-right">Load</span>
      </div>
      {groups.map((g) => (g.whiteLabel ? <WhiteLabelGroup key={g.key} g={g} canEdit={canEdit} /> : <Line key={g.key} l={g.lines[0]} canEdit={canEdit} />))}
      {otherQueries > 0 && (
        <div className="grid grid-cols-[minmax(0,1fr)_64px] gap-3 border-t border-border-subtle py-2 text-[13px] text-ink-secondary">
          <span>Open queries not on one of their engagements ({otherQueries})</span>
          <span className="text-right tnum">{otherQueries}</span>
        </div>
      )}
    </div>
  );
}

function WhiteLabelGroup({ g, canEdit }: { g: UtilGroup; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-border-subtle">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="grid w-full grid-cols-[minmax(0,1fr)_64px] items-center gap-3 py-2 text-left sm:grid-cols-[minmax(0,1fr)_96px_64px]"
      >
        <span className="min-w-0 truncate">
          <span className="mr-1.5 inline-block w-3 text-ink-tertiary">{open ? '▾' : '▸'}</span>
          <span className="font-semibold text-ink">{g.label}</span>
          <span className="ml-2 rounded-pill bg-surface-sunken px-2 py-0.5 text-[11.5px] font-semibold text-ink-secondary">
            White label · {g.lines.length} engagement{g.lines.length === 1 ? '' : 's'} for their clients
          </span>
        </span>
        <span className="hidden text-right text-[12.5px] text-ink-tertiary sm:block">{g.lines.reduce((a, l) => a + l.baseline, 0)}</span>
        <span className="text-right font-numeric text-[14px] font-bold tnum text-ink">{fmtPts(g.points)}</span>
      </button>
      {open && (
        <div className="mb-2 ml-5 flex flex-col border-l border-border-subtle pl-3">
          {g.lines.map((l) => (
            <Line key={l.id} l={l} canEdit={canEdit} nested />
          ))}
        </div>
      )}
    </div>
  );
}

function Line({ l, canEdit, nested }: { l: UtilLine; canEdit: boolean; nested?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();

  function save(raw: string) {
    const next = raw.trim() === '' ? null : Math.round(Number(raw));
    if (next !== null && (!Number.isFinite(next) || next < 0)) {
      toast.error('Enter a whole number of 0 or more, or leave blank for the default.');
      return;
    }
    if (next === l.capacity) return;
    start(async () => {
      const res = await updateRecord({ board: 'engagements', id: l.id, patch: { capacity: next } });
      if (!res.ok) {
        toast.error(res.error ?? 'Could not update capacity.');
        return;
      }
      toast.success(next === null ? 'Capacity reset to default.' : 'Capacity updated.');
      router.refresh();
    });
  }

  const detail = [
    l.share !== 1 ? `controller · ${Math.round(l.share * 100)}% of standing load` : '',
    l.cycles ? `${l.cycles} cycle${l.cycles === 1 ? '' : 's'}` : '',
    l.reviews ? `${l.reviews} review${l.reviews === 1 ? '' : 's'}` : '',
    l.queries ? `${l.queries} quer${l.queries === 1 ? 'y' : 'ies'}` : '',
    l.overdue ? `${l.overdue} overdue` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={cn('grid grid-cols-[minmax(0,1fr)_auto_64px] items-center gap-3 py-2 sm:grid-cols-[minmax(0,1fr)_96px_64px]', !nested && 'border-t border-border-subtle')}>
      <Link href={`/desk/boards/engagements?open=${l.id}`} className="min-w-0 hover:[&_.t]:text-accent-secondary">
        <div className="t truncate font-semibold text-ink">{l.whiteLabel && l.endClient ? l.endClient : l.name}</div>
        <div className="truncate text-[12.5px] text-ink-secondary">
          {l.whiteLabel ? <span className="font-semibold text-accent-secondary">White label via {l.client || 'client'} · </span> : l.client && l.client !== l.name ? `${l.client} · ` : ''}
          {detail || 'No open work'}
          {l.overdue > 0 && <span className="sr-only"> — overdue</span>}
        </div>
      </Link>
      {canEdit ? (
        <input
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          defaultValue={l.capacity ?? ''}
          placeholder={String(l.baseline)}
          disabled={pending}
          aria-label={`Capacity for ${l.name}${l.usingDefault ? ` (default ${l.baseline})` : ''}`}
          onBlur={(e) => save(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="h-8 w-20 justify-self-end rounded-input border border-border-default bg-surface-card px-2 text-right text-[13.5px] tnum text-ink placeholder:text-ink-tertiary focus:border-accent-secondary focus:outline-none disabled:opacity-60"
        />
      ) : (
        <span className={cn('justify-self-end text-right text-[13.5px] tnum', l.usingDefault ? 'text-ink-tertiary' : 'text-ink')}>
          {l.baseline}
          {l.usingDefault && <span className="sr-only"> (default)</span>}
        </span>
      )}
      <span className="text-right font-numeric text-[14px] font-bold tnum text-ink">{fmtPts(l.points)}</span>
    </div>
  );
}
