'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import { IconAlert } from '@/components/ui/icons';
import { BOARDS, type Field } from '@/desk/boards';
import { canCreateChild, canDeleteBoard, type BoardKey, type DeskRole } from '@/desk/roles';
import { centsToDollars, dollarsToCents } from '@/desk/format';
import { recordWarnings, type DeskData } from '@/desk/insights';
import { OptionChip } from './ui';
import { Discussion } from './Discussion';
import { formatCalc } from './ui';
import { updateRecord, createRecord, deleteRecord } from '@/desk/actions/records';
import type { Rec } from '@/desk/compute';

export type OpenTarget = { board: BoardKey; id: string };

export function RecordDrawer({
  board,
  record,
  data,
  users,
  role,
  canWrite,
  onClose,
  onOpen,
}: {
  board: BoardKey;
  record: Rec;
  data: DeskData;
  users: { id: string; name: string | null; email: string; role?: string }[];
  role: DeskRole;
  canWrite: boolean;
  onClose: () => void;
  onOpen: (t: OpenTarget) => void;
}) {
  const B = BOARDS[board];
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [armed, setArmed] = useState(false);

  const nameField = B.fields.find((f) => f.t === 'title')!;
  const shortFields = B.fields.filter((f) => f.t !== 'title' && f.t !== 'long');
  const longFields = B.fields.filter((f) => f.t === 'long');
  const warnings = recordWarnings(board, record, data);
  const stamp = String(record.updatedAt ?? '');

  function patch(p: Rec) {
    startTransition(async () => {
      const res = await updateRecord({ board, id: record.id as string, patch: p });
      if (!res.ok) toast.error(res.error ?? 'Could not save.');
      else router.refresh();
    });
  }

  function addChild(childBoard: BoardKey, fk: string) {
    startTransition(async () => {
      const res = await createRecord({ board: childBoard, extra: { [fk]: record.id } });
      if (res.ok && res.id) {
        router.refresh();
        onOpen({ board: childBoard, id: res.id });
      } else toast.error(res.error ?? 'Could not add.');
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteRecord({ board, id: record.id as string });
      if (res.ok) {
        toast.success('Deleted.');
        onClose();
        router.refresh();
      } else toast.error(res.error ?? 'Could not delete.');
    });
  }

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow={B.singular}
      title={(record.name as string) || 'Untitled'}
      width="md"
      footer={
        canWrite && canDeleteBoard(role, board) ? (
          <Button
            variant={armed ? 'destructive' : 'secondary'}
            onClick={() => {
              if (!armed) {
                setArmed(true);
                setTimeout(() => setArmed(false), 4000);
              } else remove();
            }}
          >
            {armed ? 'Confirm delete' : 'Delete'}
          </Button>
        ) : undefined
      }
    >
      <div key={stamp} className="flex flex-col gap-5">
        {/* title */}
        <DeskField field={nameField} record={record} data={data} users={users} role={role} canWrite={canWrite} onPatch={patch} onOpen={onOpen} prominent />

        {/* short fields */}
        <div className="grid grid-cols-[140px_1fr] items-start gap-x-3 gap-y-2.5">
          {shortFields.map((f) => (
            <DeskRow key={f.k} field={f} record={record} data={data} users={users} role={role} canWrite={canWrite} onPatch={patch} onOpen={onOpen} />
          ))}
        </div>

        {/* long fields */}
        {longFields.length > 0 && (
          <div className="flex flex-col gap-3">
            {longFields.map((f) => (
              <div key={f.k} className="flex flex-col gap-1">
                <label htmlFor={`f-${f.k}`} className="text-[12.5px] text-ink-tertiary">
                  {f.l}
                  {f.hint ? <span className="text-ink-tertiary"> · {f.hint}</span> : null}
                </label>
                <DeskField field={f} record={record} data={data} users={users} role={role} canWrite={canWrite} onPatch={patch} onOpen={onOpen} />
              </div>
            ))}
          </div>
        )}

        {/* team pulled through from the engagement (read-only) */}
        {board === 'cycles' &&
          (() => {
            const eng = (data.engagements as Rec[]).find((e) => e.id === record.engagement);
            if (!eng) return null;
            const nameOf = (uid: unknown) => {
              const u = users.find((x) => x.id === uid);
              return u ? u.name ?? u.email : null;
            };
            return (
              <div className="flex flex-col gap-1.5 border-t border-border-subtle pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-header text-ink-tertiary">Team · from engagement</p>
                <div className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-1 text-[13px]">
                  <span className="text-ink-tertiary">Accountant</span>
                  <span className="text-ink">{nameOf(eng.bookkeeper) ?? '—'}</span>
                  <span className="text-ink-tertiary">Financial Controller</span>
                  <span className="text-ink">{nameOf(eng.controller) ?? '—'}</span>
                </div>
              </div>
            );
          })()}

        {/* warnings */}
        {warnings.map((w, i) => (
          <div key={i} className="flex items-start gap-2 rounded-input bg-watch-tint px-3 py-2 text-[12.5px] text-watch">
            <IconAlert width={14} height={14} className="mt-0.5 shrink-0" />
            <span>{w}</span>
          </div>
        ))}

        {/* back-linked children */}
        {(B.back ?? []).map((bk) => {
          const items = (data[bk.b] as Rec[]).filter((x) => x[bk.k] === record.id);
          const selField = BOARDS[bk.b].fields.find((f) => f.t === 'select');
          return (
            <div key={bk.b} className="flex flex-col gap-2 border-t border-border-subtle pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-header text-ink-tertiary">
                {bk.l} · {items.length}
              </p>
              {items.length === 0 && <p className="text-[13px] text-ink-tertiary">None linked yet.</p>}
              {items.map((x) => (
                <div key={x.id as string} className="flex items-center gap-2">
                  <button onClick={() => onOpen({ board: bk.b, id: x.id as string })} className="rounded-input border border-border-subtle px-2 py-0.5 text-[12px] text-ink hover:border-accent-secondary hover:text-accent-secondary">
                    {(x.name as string) || 'Untitled'}
                  </button>
                  {selField && x[selField.k] ? <OptionChip field={selField} value={x[selField.k] as string} /> : null}
                </div>
              ))}
              {canWrite && canCreateChild(role, bk.b) && (
                <div>
                  <Button size="sm" variant="ghost" onClick={() => addChild(bk.b, bk.k)}>
                    Add {BOARDS[bk.b].singular.toLowerCase()}
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        <Discussion board={board} recordId={record.id as string} users={users} role={role} />
      </div>
    </Drawer>
  );
}

function DeskRow(props: Parameters<typeof DeskField>[0]) {
  return (
    <>
      <label htmlFor={`f-${props.field.k}`} className="pt-1.5 text-[12.5px] text-ink-tertiary">
        {props.field.l}
      </label>
      <div className="min-w-0">
        <DeskField {...props} />
        {props.field.hint && <p className="mt-1 text-[11.5px] leading-snug text-ink-tertiary">{props.field.hint}</p>}
      </div>
    </>
  );
}

const inputCls =
  'w-full rounded-input border border-transparent bg-surface-sunken px-2 py-1.5 text-[14px] text-ink hover:border-border-subtle focus:border-accent-secondary focus:bg-surface-card focus:outline-none';

function DeskField({
  field: f,
  record: r,
  data,
  users,
  role,
  canWrite,
  onPatch,
  onOpen,
  prominent,
}: {
  field: Field;
  record: Rec;
  data: DeskData;
  users: { id: string; name: string | null; email: string; role?: string }[];
  role: DeskRole;
  canWrite: boolean;
  onPatch: (p: Rec) => void;
  onOpen: (t: OpenTarget) => void;
  prominent?: boolean;
}) {
  const v = r[f.k];
  const id = `f-${f.k}`;
  // A field is editable only if the user can write the board AND (when the field
  // is locked) their role is on its allow-list.
  const dis = !canWrite || (f.lock ? !f.lock.includes(role) : false);

  switch (f.t) {
    case 'title':
      return (
        <input
          id={id}
          defaultValue={(v as string) ?? ''}
          disabled={dis}
          placeholder="Untitled"
          onBlur={(e) => e.target.value !== (v ?? '') && onPatch({ [f.k]: e.target.value })}
          className={cn(prominent ? 'w-full border-0 bg-transparent px-0 py-1 font-heading text-[22px] font-bold text-ink focus:outline-none' : inputCls)}
        />
      );
    case 'text':
    case 'url':
      return <input id={id} type={f.t === 'url' ? 'url' : 'text'} defaultValue={(v as string) ?? ''} disabled={dis} onBlur={(e) => e.target.value !== (v ?? '') && onPatch({ [f.k]: e.target.value })} className={inputCls} />;
    case 'long':
      return <textarea id={id} defaultValue={(v as string) ?? ''} disabled={dis} placeholder={f.hint ?? ''} rows={3} onBlur={(e) => e.target.value !== (v ?? '') && onPatch({ [f.k]: e.target.value })} className={cn(inputCls, 'min-h-[76px] resize-y leading-relaxed')} />;
    case 'num':
      return <input id={id} type="number" step="any" defaultValue={(v as number) ?? ''} disabled={dis} onBlur={(e) => onPatch({ [f.k]: e.target.value === '' ? null : Number(e.target.value) })} className={cn(inputCls, 'tnum')} />;
    case 'money':
      return <input id={id} type="number" step="any" inputMode="decimal" defaultValue={centsToDollars(v as number) ?? ''} disabled={dis} onBlur={(e) => onPatch({ [f.k]: dollarsToCents(e.target.value) })} className={cn(inputCls, 'tnum')} />;
    case 'date':
      return <input id={id} type="date" defaultValue={(v as string) ?? ''} disabled={dis} onChange={(e) => onPatch({ [f.k]: e.target.value || null })} className={cn(inputCls, 'tnum')} />;
    case 'check':
      return (
        <label className="flex items-center gap-2 pt-1 text-[13px]">
          <input type="checkbox" defaultChecked={Boolean(v)} disabled={dis} onChange={(e) => onPatch({ [f.k]: e.target.checked })} className="h-4 w-4 accent-accent-primary" />
          <span>{v ? 'Yes' : 'No'}</span>
        </label>
      );
    case 'select':
      return (
        <select id={id} defaultValue={(v as string) ?? ''} disabled={dis} onChange={(e) => onPatch({ [f.k]: e.target.value || null })} className={inputCls}>
          <option value="">—</option>
          {f.o!.map((o) => (
            <option key={o.name} value={o.name}>
              {o.name}
            </option>
          ))}
        </select>
      );
    case 'person': {
      // Restrict the picker to the field's allowed roles, but always keep the
      // current assignee selectable even if their role falls outside the list.
      const allowed = f.pr
        ? users.filter((u) => u.id === v || !u.role || f.pr!.includes(u.role as DeskRole))
        : users;
      return (
        <select id={id} defaultValue={(v as string) ?? ''} disabled={dis} onChange={(e) => onPatch({ [f.k]: e.target.value || null })} className={inputCls}>
          <option value="">—</option>
          {allowed.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name ?? u.email}
            </option>
          ))}
        </select>
      );
    }
    case 'multi': {
      const arr = Array.isArray(v) ? (v as string[]) : [];
      return (
        <div className="flex flex-wrap gap-1 pt-1">
          {f.o!.map((o) => {
            const on = arr.includes(o.name);
            return (
              <label key={o.name} className="cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only"
                  defaultChecked={on}
                  disabled={dis}
                  onChange={(e) => {
                    const next = e.target.checked ? [...arr, o.name] : arr.filter((x) => x !== o.name);
                    onPatch({ [f.k]: next });
                  }}
                />
                <span className={cn('inline-flex items-center rounded-pill px-2.5 py-0.5 text-[12px] font-semibold', on ? 'bg-surface-cream text-ink ring-1 ring-accent-primary' : 'bg-surface-sunken text-ink-tertiary')}>
                  {o.name}
                </span>
              </label>
            );
          })}
        </div>
      );
    }
    case 'rel': {
      const opts = (data[f.to!] as Rec[]).slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));
      return (
        <div className="flex items-center gap-2">
          <select id={id} defaultValue={(v as string) ?? ''} disabled={dis} onChange={(e) => onPatch({ [f.k]: e.target.value || null })} className={cn(inputCls, 'flex-1')}>
            <option value="">—</option>
            {opts.map((o) => (
              <option key={o.id as string} value={o.id as string}>
                {(o.name as string) || 'Untitled'}
              </option>
            ))}
          </select>
          {v ? (
            <Button size="sm" variant="ghost" onClick={() => onOpen({ board: f.to!, id: v as string })}>
              Open
            </Button>
          ) : null}
        </div>
      );
    }
    case 'calc':
      return <div className={cn('py-1.5 font-semibold', f.num || f.money ? 'tnum' : '')}>{formatCalc(f, v) || <span className="text-ink-tertiary">—</span>}</div>;
    default:
      return null;
  }
}
