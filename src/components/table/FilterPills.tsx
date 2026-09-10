'use client';

import { cn } from '@/lib/utils';
import { IconClose } from '@/components/ui/icons';

export type ActiveFilter = { key: string; label: string };

// Active filters render as removable pills below the toolbar. A "Clear all"
// ghost action appears when more than one is set.
export function FilterPills({
  filters,
  onRemove,
  onClear,
  className,
}: {
  filters: ActiveFilter[];
  onRemove: (key: string) => void;
  onClear?: () => void;
  className?: string;
}) {
  if (filters.length === 0) return null;
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {filters.map((f) => (
        <span
          key={f.key}
          className="inline-flex items-center gap-1.5 rounded-pill bg-surface-cream py-1 pl-3 pr-1.5 text-[13px] text-ink"
        >
          {f.label}
          <button
            onClick={() => onRemove(f.key)}
            aria-label={`Remove filter ${f.label}`}
            className="rounded-full p-0.5 text-ink-tertiary hover:bg-surface-sunken"
          >
            <IconClose width={12} height={12} />
          </button>
        </span>
      ))}
      {filters.length > 1 && onClear && (
        <button
          onClick={onClear}
          className="rounded-pill px-2 py-1 text-[13px] font-semibold text-accent-secondary hover:bg-surface-sunken"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
