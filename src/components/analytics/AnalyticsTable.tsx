'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { exportCsv } from '@/lib/export';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconAlert, IconChevronDown, IconFilter, IconDocument } from '@/components/ui/icons';

// The financial table for every analytics surface — top-level panels and drill
// drawers. 44px rows, sunken sticky header, no zebra, cream row hover, tabular
// right-aligned numbers, negatives in rust with a leading minus. Sortable
// headers, optional frozen first column, CSV export, and the three (four) states.
export type CellType = 'money' | 'date' | 'rate' | 'age' | 'text';

export type AnalyticsColumn<T> = {
  key: string;
  header: string;
  type?: CellType;
  align?: 'left' | 'right';
  sticky?: boolean;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
};

export type TableState = 'ready' | 'loading' | 'error';

function formatCell(value: unknown, type?: CellType): { text: string; negative: boolean } {
  if (value == null || value === '') return { text: '—', negative: false };
  switch (type) {
    case 'money': {
      const n = Number(value);
      return { text: formatCurrency(n), negative: n < 0 };
    }
    case 'rate':
      return { text: `${(Number(value) * 100).toFixed(1)}%`, negative: false };
    case 'age':
      return { text: `${Number(value)} days`, negative: false };
    case 'date':
      return { text: formatDate(value as string), negative: false };
    default:
      return { text: String(value), negative: false };
  }
}

export function AnalyticsTable<T extends Record<string, unknown>>({
  columns,
  rows,
  getRowId,
  state = 'ready',
  onRetry,
  onRowClick,
  empty,
  filteredEmpty,
  isFiltered = false,
  exportName,
  caption,
  initialSort,
  toolbarExtra,
}: {
  columns: AnalyticsColumn<T>[];
  rows: T[];
  getRowId?: (row: T, i: number) => string;
  state?: TableState;
  onRetry?: () => void;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  filteredEmpty?: ReactNode;
  isFiltered?: boolean;
  exportName: string;
  caption: string;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  toolbarExtra?: ReactNode;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(initialSort ?? null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      let cmp: number;
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
      else cmp = String(av ?? '').localeCompare(String(bv ?? ''));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [rows, sort, columns]);

  function toggleSort(key: string) {
    setSort((s) =>
      s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' },
    );
  }

  function doExport() {
    const cols = columns.filter((c) => c.header);
    exportCsv(
      exportName,
      cols.map((c) => ({ key: c.key, header: c.header })),
      sorted.map((r) =>
        cols.reduce((acc, c) => {
          acc[c.key] = formatCell(r[c.key], c.type).text;
          return acc;
        }, {} as Record<string, string>),
      ),
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-end gap-2">
        {toolbarExtra}
        <Button variant="ghost" size="sm" onClick={doExport} disabled={sorted.length === 0}>
          Export CSV
        </Button>
      </div>

      <div className="overflow-hidden rounded-card border border-border-subtle bg-surface-card">
        <div className="overflow-x-auto">
          {state === 'loading' ? (
            <LoadingRows cols={columns.length} />
          ) : state === 'error' ? (
            <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-unfavorable-tint text-unfavorable">
                <IconAlert width={20} height={20} />
              </span>
              <p className="text-[15px] text-ink">We couldn&apos;t load this. This is on us — try again.</p>
              {onRetry && (
                <Button variant="secondary" size="sm" onClick={onRetry}>
                  Retry
                </Button>
              )}
            </div>
          ) : sorted.length === 0 ? (
            <div>
              {isFiltered
                ? (filteredEmpty ?? (
                    <EmptyState
                      icon={<IconFilter width={22} height={22} />}
                      title="Nothing matches these filters"
                      body="Try widening the filters to see more."
                    />
                  ))
                : (empty ?? (
                    <EmptyState
                      icon={<IconDocument width={22} height={22} />}
                      title="No data yet"
                      body="This panel will populate once the linked systems sync."
                    />
                  ))}
            </div>
          ) : (
            <table className="w-full border-collapse text-[14px]">
              <caption className="sr-only">{caption}</caption>
              <thead>
                <tr className="bg-surface-sunken">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      scope="col"
                      aria-sort={
                        sort?.key === col.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined
                      }
                      className={cn(
                        'whitespace-nowrap px-4 py-3 text-[13px] font-semibold uppercase tracking-header text-ink-tertiary',
                        col.align === 'right' ? 'text-right' : 'text-left',
                        col.sticky && 'sticky left-0 z-10 bg-surface-sunken',
                      )}
                    >
                      {col.sortable ? (
                        <button
                          onClick={() => toggleSort(col.key)}
                          className={cn(
                            'inline-flex items-center gap-1 uppercase tracking-header hover:text-ink',
                            col.align === 'right' && 'flex-row-reverse',
                          )}
                        >
                          {col.header}
                          <IconChevronDown
                            width={12}
                            height={12}
                            className={cn(
                              'transition-transform',
                              sort?.key === col.key && sort.dir === 'asc' && 'rotate-180',
                              sort?.key !== col.key && 'opacity-30',
                            )}
                          />
                        </button>
                      ) : (
                        col.header
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row, i) => (
                  <tr
                    key={getRowId?.(row, i) ?? i}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      'border-b border-border-subtle transition-colors duration-fast ease-standard hover:bg-surface-cream',
                      onRowClick && 'cursor-pointer',
                    )}
                  >
                    {columns.map((col) => {
                      if (col.render) {
                        return (
                          <td
                            key={col.key}
                            className={cn(
                              'h-11 px-4 py-3 text-ink',
                              col.align === 'right' ? 'text-right' : 'text-left',
                              col.sticky && 'sticky left-0 bg-surface-card',
                            )}
                          >
                            {col.render(row)}
                          </td>
                        );
                      }
                      const { text, negative } = formatCell(row[col.key], col.type);
                      const numeric = col.type === 'money' || col.type === 'rate' || col.type === 'age';
                      return (
                        <td
                          key={col.key}
                          className={cn(
                            'h-11 px-4 py-3 text-ink',
                            col.align === 'right' || numeric ? 'text-right tnum' : 'text-left',
                            negative && 'text-unfavorable',
                            col.sticky && 'sticky left-0 bg-surface-card font-semibold',
                          )}
                        >
                          {text}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingRows({ cols }: { cols: number }) {
  return (
    <div className="flex flex-col" role="status" aria-label="Loading">
      {Array.from({ length: 6 }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-border-subtle px-4 py-3">
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className={cn('h-4 rounded-input bg-surface-sunken', c === 0 ? 'w-1/4' : 'flex-1')}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
