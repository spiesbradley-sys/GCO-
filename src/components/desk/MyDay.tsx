'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import type { MyDay as MyDayData, MyDayItem } from '@/desk/insights';
import { updateRecord, createRecord } from '@/desk/actions/records';

const ACTION_LABEL: Record<string, string> = {
  'review-capture': 'Mark done',
  'review-bk': 'Mark done',
  'review-ctrl': 'Mark done',
  'resolve-query': 'Resolve',
  'open-cycle': 'Open cycle',
};

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export function MyDay({ data }: { data: MyDayData }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();

  const first = (data.name || '').split(' ')[0] || data.name;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
  const { dueToday, overdue, queries, inFlight } = data.counts;

  function run(fn: () => Promise<{ ok: boolean; error?: string; id?: string }>, okMsg: string, after?: (id?: string) => void) {
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error ?? 'Could not update.');
        return;
      }
      toast.success(okMsg);
      router.refresh();
      after?.(res.id);
    });
  }

  function act(i: MyDayItem) {
    switch (i.action) {
      case 'review-capture':
        return run(() => updateRecord({ board: 'cycles', id: i.id, patch: { capture: true } }), 'Capture marked done.');
      case 'review-bk':
        return run(() => updateRecord({ board: 'cycles', id: i.id, patch: { bkReview: true } }), 'Review marked done.');
      case 'review-ctrl':
        return run(() => updateRecord({ board: 'cycles', id: i.id, patch: { ctrlReview: true } }), 'Controller review done.');
      case 'resolve-query':
        return run(() => updateRecord({ board: 'queries', id: i.id, patch: { status: 'Resolved' } }), 'Query resolved.');
      case 'open-cycle': {
        const n = new Date();
        const period = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`;
        return run(() => createRecord({ board: 'cycles', extra: { engagement: i.id, period } }), 'Cycle opened.', (id) => {
          if (id) router.push(`/desk/boards/cycles?open=${id}`);
        });
      }
    }
  }

  const empty = !data.dueAndOverdue.length && !data.waiting.length && !data.queries.length && !data.thisWeek.length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="eyebrow">Service desk · my day</span>
        <h1 className="font-heading text-page-title text-ink">
          {greeting()}, {first}
        </h1>
        <p className="text-[15px] text-ink-secondary">
          {today} · you have <span className="text-ink">{dueToday} due today</span>, {overdue} overdue, and {queries} quer{queries === 1 ? 'y' : 'ies'} waiting.
        </p>
      </div>

      {/* free-floating counts */}
      <div className="flex flex-wrap gap-x-8 gap-y-3 border-b border-border-subtle pb-4">
        <Stat value={dueToday} label="Due today" />
        <Stat value={overdue} label="Overdue" tone={overdue ? 'bad' : undefined} divide />
        <Stat value={queries} label="Queries waiting" divide />
        <Stat value={inFlight} label="Cycles in flight" divide />
      </div>

      {empty ? (
        <p className="rounded-input bg-favorable-tint px-3 py-2.5 text-[13.5px] text-favorable">
          Nothing on your plate right now — every cycle you own is on track and no query is waiting.
        </p>
      ) : (
        <>
          <Section title="Due today & overdue" items={data.dueAndOverdue} onAct={act} pending={pending} />
          <Section title="Waiting on you" items={data.waiting} onAct={act} pending={pending} />
          <Section title="Open queries" items={data.queries} onAct={act} pending={pending} />
          <Section title="Later this week" items={data.thisWeek} onAct={act} pending={pending} />
        </>
      )}
    </div>
  );
}

function Stat({ value, label, tone, divide }: { value: number; label: string; tone?: 'bad'; divide?: boolean }) {
  return (
    <div className={cn(divide && 'border-l border-border-subtle pl-8')}>
      <div className={cn('font-numeric text-[30px] font-bold leading-none tnum', tone === 'bad' ? 'text-unfavorable' : 'text-ink')}>{value}</div>
      <div className="mt-1 text-[12.5px] text-ink-secondary">{label}</div>
    </div>
  );
}

function Section({ title, items, onAct, pending }: { title: string; items: MyDayItem[]; onAct: (i: MyDayItem) => void; pending: boolean }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-eyebrow text-ink-tertiary">{title}</p>
      {items.map((i, idx) => {
        const href = i.action === 'open-cycle' ? `/desk/boards/engagements?open=${i.id}` : `/desk/boards/${i.b}?open=${i.id}`;
        return (
          <div key={`${i.b}:${i.id}:${idx}`} className="grid grid-cols-[1fr_auto] items-center gap-3 border-t border-border-subtle py-3">
            <Link href={href} className="min-w-0 hover:[&_.t]:text-accent-secondary">
              <div className="t truncate font-semibold text-ink">{i.title}</div>
              <div className="truncate text-[12.5px] text-ink-secondary">{i.sub}</div>
            </Link>
            {i.action ? (
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => onAct(i)}>
                {ACTION_LABEL[i.action]}
              </Button>
            ) : i.chipText ? (
              <span
                className={cn(
                  'whitespace-nowrap rounded-pill px-2.5 py-0.5 text-[12px] font-semibold',
                  i.chipTone === 'danger'
                    ? 'bg-unfavorable-tint text-unfavorable'
                    : i.chipTone === 'warning'
                      ? 'bg-watch-tint text-watch'
                      : 'text-ink-tertiary',
                )}
              >
                {i.chipText}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
