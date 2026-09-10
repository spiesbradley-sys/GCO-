'use client';

import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TermTooltip } from './TermTooltip';

// Card wrapper for a chart panel. Carries the title, an optional gloss term, an
// actions slot, the chart body, and the required text alternative: a "View data"
// toggle that reveals the underlying table (or a summarising caption).
export function ChartCard({
  title,
  glossTerm,
  glossDefinition,
  subtitle,
  actions,
  children,
  dataTable,
  caption,
  className,
}: {
  title: string;
  glossTerm?: string;
  glossDefinition?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** Text alternative: the underlying table, revealed by "View data". */
  dataTable?: ReactNode;
  /** Or a one-line summarising caption when a full table is overkill. */
  caption?: string;
  className?: string;
}) {
  const [showData, setShowData] = useState(false);
  const regionId = useId();

  return (
    <section className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col">
          <h3 className="font-heading text-card-title text-ink">
            {glossTerm && glossDefinition ? (
              <TermTooltip term={glossTerm} definition={glossDefinition}>
                {title}
              </TermTooltip>
            ) : (
              title
            )}
          </h3>
          {subtitle && <p className="text-[13px] text-ink-tertiary">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {dataTable && (
            <button
              onClick={() => setShowData((s) => !s)}
              aria-expanded={showData}
              aria-controls={regionId}
              className="rounded-pill px-3 py-1.5 text-[13px] font-semibold text-accent-secondary hover:bg-surface-sunken"
            >
              {showData ? 'Hide data' : 'View data'}
            </button>
          )}
        </div>
      </div>

      {showData && dataTable ? (
        <div id={regionId}>{dataTable}</div>
      ) : (
        <>
          {children}
          {caption && <p className="text-[13px] text-ink-tertiary">{caption}</p>}
        </>
      )}
    </section>
  );
}
