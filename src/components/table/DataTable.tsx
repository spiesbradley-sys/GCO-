'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconAlert } from '@/components/ui/icons';

// The house table. Balanced density (44px rows), sunken sticky header, no zebra,
// row hover tints cream, tabular right-aligned numbers. Every table renders one
// of three designed states: loading (skeleton), empty, error (retry).

export type Column<T> = {
  key: string;
  header: string;
  align?: 'left' | 'right';
  /** Custom cell renderer; defaults to String(row[key]). */
  render?: (row: T) => ReactNode;
  /** Freeze this column (first column when >8 columns). */
  sticky?: boolean;
  width?: string;
};

export type TableState = 'ready' | 'loading' | 'error';

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  state = 'ready',
  onRetry,
  empty,
  filteredEmpty,
  isFiltered = false,
  onRowClick,
  toolbar,
  pills,
  footer,
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  state?: TableState;
  onRetry?: () => void;
  /** True-empty state (no data at all). */
  empty: ReactNode;
  /** Filtered-empty state (data exists but nothing matches). */
  filteredEmpty?: ReactNode;
  isFiltered?: boolean;
  onRowClick?: (row: T) => void;
  toolbar?: ReactNode;
  pills?: ReactNode;
  footer?: ReactNode;
  caption?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      {toolbar}
      {pills}

      <div className="overflow-hidden rounded-card border border-border-subtle bg-surface-card">
        <div className="overflow-x-auto">
          {state === 'loading' ? (
            <TableSkeleton rows={6} cols={columns.length} />
          ) : state === 'error' ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-unfavorable-tint text-unfavorable">
                <IconAlert width={22} height={22} />
              </span>
              <p className="text-[15px] text-ink">
                We couldn&apos;t load this data. This is on us — try again.
              </p>
              {onRetry && (
                <Button variant="secondary" size="sm" onClick={onRetry}>
                  Retry
                </Button>
              )}
            </div>
          ) : rows.length === 0 ? (
            <div>{isFiltered ? (filteredEmpty ?? empty) : empty}</div>
          ) : (
            <table className="w-full border-collapse text-[14px]">
              {caption && <caption className="sr-only">{caption}</caption>}
              <thead>
                <tr className="sticky top-0 z-10 bg-surface-sunken">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      scope="col"
                      style={{ width: col.width }}
                      className={cn(
                        'whitespace-nowrap px-4 py-3 text-[13px] font-semibold uppercase tracking-header text-ink-tertiary',
                        col.align === 'right' ? 'text-right' : 'text-left',
                        col.sticky && 'sticky left-0 z-20 bg-surface-sunken',
                      )}
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      'border-b border-border-subtle transition-colors duration-fast ease-standard',
                      'hover:bg-surface-cream',
                      onRowClick && 'cursor-pointer',
                    )}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          'h-11 px-4 py-3 text-ink',
                          col.align === 'right' ? 'text-right tnum' : 'text-left',
                          col.sticky && 'sticky left-0 bg-surface-card',
                        )}
                      >
                        {col.render ? col.render(row) : (row as Record<string, ReactNode>)[col.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {footer}
    </div>
  );
}

/** A negative money value rendered per spec: rust, leading minus (not parens). */
export function Money({ cents, format }: { cents: number; format: (c: number) => string }) {
  const negative = cents < 0;
  return <span className={cn('tnum', negative && 'text-unfavorable')}>{format(cents)}</span>;
}
