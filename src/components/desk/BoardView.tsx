'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { IconSearch, IconDocument } from '@/components/ui/icons';
import { BOARDS, field, type View } from '@/desk/boards';
import type { BoardKey } from '@/desk/roles';
import { enrichRows } from '@/desk/enrich';
import { cycleSev, type Rec } from '@/desk/compute';
import type { DeskData } from '@/desk/insights';
import { ValueCell, OptionChip, formatCalc, isRight, type CellCtx } from './ui';
import { RecordDrawer, type OpenTarget } from './RecordDrawer';
import { createRecord, updateRecord } from '@/desk/actions/records';

export function BoardView({
  board,
  data,
  canWrite,
  initialOpenId,
  headerExtra,
}: {
  board: BoardKey;
  data: DeskData;
  canWrite: boolean;
  initialOpenId?: string;
  headerExtra?: React.ReactNode;
}) {
  const B = BOARDS[board];
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [viewIdx, setViewIdx] = useState(0);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<OpenTarget | null>(
    initialOpenId && (data[board] as Rec[]).some((r) => r.id === initialOpenId) ? { board, id: initialOpenId } : null,
  );

  useEffect(() => {
    try {
      const v = localStorage.getItem(`desk:view:${board}`);
      if (v != null) setViewIdx(Math.min(Number(v), B.views.length - 1));
    } catch {
      /* ignore */
    }
  }, [board, B.views.length]);

  function selectView(i: number) {
    setViewIdx(i);
    try {
      localStorage.setItem(`desk:view:${board}`, String(i));
    } catch {
      /* ignore */
    }
  }

  const usersById = useMemo(() => new Map(data.users.map((u) => [u.id, u.name ?? u.email])), [data.users]);
  const ctx: CellCtx = { data: data as unknown as Record<string, Rec[]>, usersById };

  const view = B.views[viewIdx];
  const rows = useMemo(() => {
    let rs = enrichRows(board, data[board] as Rec[], { queries: data.queries });
    if (view.filter === 'openQueries') rs = rs.filter((r) => r.status !== 'Resolved');
    if (view.filter === 'slaWatch') rs = rs.filter((r) => r.slaStatus !== 'Met' && r.stage !== 'Closed');
    if (q.trim()) {
      const needle = q.toLowerCase();
      rs = rs.filter((r) => JSON.stringify(r).toLowerCase().includes(needle));
    }
    rs.sort((a, b) => {
      if (view.sort === 'raisedAsc') return String(a.raised ?? '9').localeCompare(String(b.raised ?? '9'));
      if (view.sort === 'slaDueAsc') return String(a.slaDue ?? '9').localeCompare(String(b.slaDue ?? '9'));
      return String(a.name ?? '').localeCompare(String(b.name ?? ''));
    });
    return rs;
  }, [board, data, view, q]);

  function openRecord(t: OpenTarget) {
    setOpen(t);
  }

  function newRecord() {
    startTransition(async () => {
      const res = await createRecord({ board });
      if (res.ok && res.id) {
        router.refresh();
        setOpen({ board, id: res.id });
      } else toast.error(res.error ?? 'Could not create.');
    });
  }

  const openRow = open
    ? enrichRows(open.board, (data[open.board] as Rec[]).filter((r) => r.id === open.id), { queries: data.queries })[0]
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          {B.step ? <span className="font-numeric text-[13px] text-ink-tertiary">{B.step}/6</span> : null}
          <h1 className="font-heading text-page-title text-ink">{B.label}</h1>
        </div>
        <p className="max-w-2xl text-[15px] text-ink-secondary">{B.blurb}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-input bg-surface-sunken p-1">
          {B.views.map((v, i) => (
            <button
              key={v.n}
              onClick={() => selectView(i)}
              className={cn('rounded-[6px] px-3 py-1 text-[13px] font-semibold', i === viewIdx ? 'bg-surface-card text-ink shadow-sm' : 'text-ink-tertiary hover:text-ink')}
            >
              {v.n}
            </button>
          ))}
        </div>
        <label className="relative flex items-center">
          <span className="pointer-events-none absolute left-2.5 text-ink-tertiary">
            <IconSearch width={15} height={15} />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            type="search"
            placeholder={`Search ${B.label.toLowerCase()}`}
            className="h-9 w-56 rounded-input border border-border-default bg-surface-card pl-8 pr-3 text-[14px] text-ink placeholder:text-ink-tertiary focus:border-accent-secondary focus:outline-none"
          />
        </label>
        <span className="flex-1" />
        {headerExtra}
        {canWrite && (
          <Button size="sm" onClick={newRecord}>
            New {B.singular.toLowerCase()}
          </Button>
        )}
      </div>

      {view.type === 'table' ? (
        <BoardTable board={board} view={view} rows={rows} ctx={ctx} onOpen={openRecord} />
      ) : (
        <BoardKanban board={board} view={view} rows={rows} ctx={ctx} canWrite={canWrite} onOpen={openRecord} onRefresh={() => router.refresh()} />
      )}

      {open && openRow && (
        <RecordDrawer
          board={open.board}
          record={openRow}
          data={data}
          users={data.users}
          canWrite={canWrite}
          onClose={() => setOpen(null)}
          onOpen={openRecord}
        />
      )}
    </div>
  );
}

function BoardTable({
  board,
  view,
  rows,
  ctx,
  onOpen,
}: {
  board: BoardKey;
  view: View;
  rows: Rec[];
  ctx: CellCtx;
  onOpen: (t: OpenTarget) => void;
}) {
  const cols = (view.cols ?? []).map((k) => field(board, k)!).filter(Boolean);
  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-border-subtle bg-surface-card">
        <EmptyState icon={<IconDocument width={22} height={22} />} title="Nothing here yet" body="Create the first record, or widen your search." />
      </div>
    );
  }

  const totals =
    view.totals &&
    cols.map((f) => {
      if (f.t === 'money' || (f.t === 'calc' && f.money)) {
        const sum = rows.reduce((a, r) => a + (Number(r[f.k]) || 0), 0);
        return { k: f.k, v: sum, money: true };
      }
      return null;
    });

  return (
    <div className="overflow-hidden rounded-card border border-border-subtle bg-surface-card">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr className="bg-surface-sunken">
              {cols.map((f) => (
                <th key={f.k} className={cn('whitespace-nowrap px-4 py-2.5 text-[12px] font-semibold uppercase tracking-header text-ink-tertiary', isRight(f) ? 'text-right' : 'text-left')}>
                  {f.l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id as string} onClick={() => onOpen({ board, id: r.id as string })} className="cursor-pointer border-b border-border-subtle hover:bg-surface-cream">
                {cols.map((f) => (
                  <td key={f.k} className={cn('px-4 py-2.5 align-top text-ink', isRight(f) ? 'text-right tnum' : 'text-left', f.t === 'title' && 'font-semibold')}>
                    <ValueCell field={f} row={r} ctx={ctx} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {totals && (
            <tfoot>
              <tr className="border-t border-border-default">
                {cols.map((f, i) => {
                  if (i === 0) return <td key={f.k} className="px-4 py-2.5 font-semibold">Total · {rows.length} rows</td>;
                  if (f.k === 'marginPct') {
                    const rev = rows.reduce((a, r) => a + (Number(r.revenue) || 0), 0);
                    const m = rows.reduce((a, r) => a + (Number(r.margin) || 0), 0);
                    return <td key={f.k} className="px-4 py-2.5 text-right font-semibold tnum">{rev ? Math.round((m / rev) * 100) + '%' : ''}</td>;
                  }
                  const tot = totals.find((t) => t && t.k === f.k);
                  return (
                    <td key={f.k} className="px-4 py-2.5 text-right font-semibold tnum">
                      {tot ? '$' + Math.round((tot.v as number) / 100).toLocaleString('en-US') : ''}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function BoardKanban({
  board,
  view,
  rows,
  ctx,
  canWrite,
  onOpen,
  onRefresh,
}: {
  board: BoardKey;
  view: View;
  rows: Rec[];
  ctx: CellCtx;
  canWrite: boolean;
  onOpen: (t: OpenTarget) => void;
  onRefresh: () => void;
}) {
  const toast = useToast();
  const g = field(board, view.group!)!;
  const [dragId, setDragId] = useState<string | null>(null);
  const groups = [...(g.o ?? []).map((o) => o.name), ''];

  function drop(colValue: string) {
    if (!dragId) return;
    const r = rows.find((x) => x.id === dragId);
    setDragId(null);
    if (!r || (r[g.k] ?? '') === colValue) return;
    updateRecord({ board, id: dragId, patch: { [g.k]: colValue || null } }).then((res) => {
      if (res.ok) onRefresh();
      else toast.error(res.error ?? 'Could not move.');
    });
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-border-subtle bg-surface-card">
        <EmptyState icon={<IconDocument width={22} height={22} />} title="Nothing here yet" body="Create the first record, or widen your search." />
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 overflow-x-auto pb-3">
      {groups.map((name) => {
        const items = rows.filter((r) => (r[g.k] ?? '') === name);
        if (items.length === 0 && (view.hideEmpty || name === '')) return null;
        return (
          <section
            key={name || '__none'}
            onDragOver={(e) => canWrite && e.preventDefault()}
            onDrop={() => canWrite && drop(name)}
            className="flex w-64 shrink-0 flex-col gap-2 rounded-card bg-surface-sunken p-2.5"
            aria-label={name || 'No value'}
          >
            <div className="flex items-center gap-2 px-1">
              {name ? <OptionChip field={g} value={name} /> : <span className="text-[12px] text-ink-tertiary">No {g.l.toLowerCase()}</span>}
              <span className="ml-auto font-numeric text-[11px] text-ink-tertiary">{items.length}</span>
            </div>
            {items.map((r) => {
              const sev = view.sev === 'cycle' ? cycleSev(r) : '';
              return (
                <article
                  key={r.id as string}
                  draggable={canWrite}
                  onDragStart={() => setDragId(r.id as string)}
                  onDragEnd={() => setDragId(null)}
                  onClick={() => onOpen({ board, id: r.id as string })}
                  className="flex cursor-pointer flex-col gap-1.5 rounded-input border border-border-subtle bg-surface-card p-2.5 hover:border-border-default"
                >
                  <div className="flex items-center gap-1.5">
                    {sev && <span className={cn('h-2 w-2 shrink-0 rounded-full', sev === 'bad' ? 'bg-unfavorable' : 'bg-watch')} />}
                    <span className="font-semibold leading-tight text-ink">{(r.name as string) || 'Untitled'}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-ink-secondary">
                    {(view.cardMeta ?? []).map((k) => {
                      const f = field(board, k)!;
                      if (k === 'blockers') {
                        const n = Number(r.blockers) || 0;
                        return n ? (
                          <span key={k} className="inline-flex items-center rounded-pill bg-unfavorable-tint px-2 py-0.5 text-[11px] font-semibold text-unfavorable">
                            {n} open blocker{n > 1 ? 's' : ''}
                          </span>
                        ) : null;
                      }
                      const val = <ValueCell field={f} row={r} ctx={ctx} />;
                      return (
                        <span key={k} title={f.l}>
                          {f.t === 'calc' ? formatCalc(f, r[k]) : val}
                        </span>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
