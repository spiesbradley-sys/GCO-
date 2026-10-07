import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { IconCheck } from '@/components/ui/icons';
import type { Field } from '@/desk/boards';
import type { BoardKey } from '@/desk/roles';
import { optColor } from '@/desk/boards';
import { chipTone, CHIP_TONE_CLASS, money, fmtDate } from '@/desk/format';

export type Rec = Record<string, unknown>;
export type CellCtx = { data: Record<string, Rec[]>; usersById: Map<string, string> };

// Status/tag chip — GCO-toned (favorable/watch/unfavorable/neutral).
export function Chip({ color, children }: { color: string; children: ReactNode }) {
  const tone = chipTone(color as never);
  return (
    <span className={cn('inline-flex items-center rounded-pill px-2.5 py-0.5 text-[12px] font-semibold', CHIP_TONE_CLASS[tone])}>
      {children}
    </span>
  );
}

export function OptionChip({ field, value }: { field: Field; value: string }) {
  if (!value) return null;
  return <Chip color={optColor(field, value)}>{value}</Chip>;
}

export function Tick({ on }: { on: boolean }) {
  return (
    <span
      aria-label={on ? 'Yes' : 'No'}
      className={cn(
        'inline-grid h-4 w-4 place-items-center rounded-[4px] border',
        on ? 'border-accent-primary bg-accent-primary text-white' : 'border-border-default text-transparent',
      )}
    >
      {on ? <IconCheck width={11} height={11} /> : null}
    </span>
  );
}

/** Display-ready string for a calc field value. */
export function formatCalc(field: Field, value: unknown): ReactNode {
  switch (field.calc) {
    case 'margin':
      return money(value as number);
    case 'marginPct':
      return value == null ? '' : `${value}%`;
    case 'queryAge':
      return value == null ? '' : `${value} BD`;
    case 'blockers':
      return value ? String(value) : '';
    default:
      return (value as string) || '';
  }
}

export function titleOf(data: Record<string, Rec[]>, board: BoardKey, id: string): string {
  const r = (data[board] || []).find((x) => x.id === id);
  return r ? ((r.name as string) || 'Untitled') : '(missing)';
}

/** Render one field's value as a table/card cell. */
export function ValueCell({ field, row, ctx }: { field: Field; row: Rec; ctx: CellCtx }) {
  const v = row[field.k];
  switch (field.t) {
    case 'title':
      return <>{(v as string) || 'Untitled'}</>;
    case 'select':
      return v ? <OptionChip field={field} value={v as string} /> : null;
    case 'multi':
      return Array.isArray(v) && v.length ? (
        <span className="flex flex-wrap gap-1">
          {(v as string[]).map((x) => (
            <OptionChip key={x} field={field} value={x} />
          ))}
        </span>
      ) : null;
    case 'check':
      return <Tick on={Boolean(v)} />;
    case 'money':
      return <span className="tnum">{money(v as number)}</span>;
    case 'num':
      return v == null || v === '' ? null : <span className="tnum">{String(v)}</span>;
    case 'date':
      return v ? <span className="tnum">{fmtDate(v as string)}</span> : null;
    case 'rel':
      return v ? <span className="text-ink">{titleOf(ctx.data, field.to as BoardKey, v as string)}</span> : null;
    case 'person':
      return v ? <>{ctx.usersById.get(v as string) ?? '—'}</> : null;
    case 'url':
      return v ? (
        <a href={v as string} target="_blank" rel="noopener noreferrer" className="text-accent-secondary">
          Open
        </a>
      ) : null;
    case 'long':
      return v ? <span className="line-clamp-2 text-[13px] text-ink-secondary">{v as string}</span> : null;
    case 'calc':
      return <span className={field.num || field.money ? 'tnum' : undefined}>{formatCalc(field, v)}</span>;
    default:
      return <>{(v as string) ?? ''}</>;
  }
}

export const isRight = (f: Field) => ['money', 'num'].includes(f.t) || (f.t === 'calc' && (f.num || f.money));
