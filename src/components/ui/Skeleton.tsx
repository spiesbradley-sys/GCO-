import { cn } from '@/lib/utils';

// Skeletons match the shape of what's coming. Static sunken fill — the house
// style forbids shimmer (the source decks have no motion). Never a full-page
// spinner on navigation.
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('rounded-input bg-surface-sunken', className)}
      aria-hidden="true"
    />
  );
}

/** Skeleton rows sized to a table body. */
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="flex flex-col" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-border-subtle px-4 py-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn('h-4', c === 0 ? 'w-1/3' : 'flex-1')} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function KpiSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-card bg-surface-card p-6 shadow-sm">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-9 w-32" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}
