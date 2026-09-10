'use client';

import { useMemo } from 'react';
import type { WaterfallStep } from '@/lib/analytics/types';
import { cn, formatCurrencyAbbrev } from '@/lib/utils';

// Reusable bridge / waterfall (add-backs → adjusted EBITDA). Start and end bars
// ink, positive steps teal, negative steps rust, 1px border-default connectors,
// each step labelled. Built with positioned divs (not recharts) so the anchors,
// signed steps and connectors match the house spec exactly. Click a delta step
// to drill into that adjustment.
export function Waterfall({
  steps,
  height = 300,
  onStepClick,
}: {
  steps: WaterfallStep[];
  height?: number;
  onStepClick?: (stepId: string) => void;
}) {
  const layout = useMemo(() => computeLayout(steps), [steps]);
  const plot = height - 44; // reserve space for value + category labels

  return (
    <div className="w-full overflow-x-auto">
      <div className="relative min-w-[520px]" style={{ height }}>
        <div className="relative" style={{ height: plot }}>
          {/* connectors */}
          {layout.connectors.map((c, i) => (
            <div
              key={`c${i}`}
              className="absolute border-t border-border-default"
              style={{
                left: `${c.left}%`,
                width: `${c.width}%`,
                top: (1 - c.level / layout.max) * plot,
              }}
            />
          ))}
          {/* bars */}
          {layout.bars.map((b) => {
            const top = (1 - b.top / layout.max) * plot;
            const barH = Math.max(2, ((b.top - b.bottom) / layout.max) * plot);
            const color =
              b.kind === 'start' || b.kind === 'end'
                ? 'bg-ink'
                : b.signed >= 0
                  ? 'bg-favorable'
                  : 'bg-unfavorable';
            const clickable = b.kind === 'delta' && !!onStepClick;
            return (
              <div key={b.stepId} className="absolute" style={{ left: `${b.left}%`, width: `${b.width}%` }}>
                <span
                  className="absolute -translate-y-full pb-1 text-center text-[13px] font-semibold text-ink font-heading tabular-nums"
                  style={{ top, width: '100%' }}
                >
                  {b.kind === 'delta'
                    ? `${b.signed >= 0 ? '+' : ''}${formatCurrencyAbbrev(b.signed)}`
                    : formatCurrencyAbbrev(b.top)}
                </span>
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={clickable ? () => onStepClick!(b.stepId) : undefined}
                  aria-label={clickable ? `Drill into ${b.label}` : b.label}
                  className={cn('absolute rounded-[3px]', color, clickable && 'cursor-pointer hover:opacity-90')}
                  style={{ top, height: barH, width: '100%' }}
                />
              </div>
            );
          })}
        </div>
        {/* category labels */}
        <div className="relative mt-2" style={{ height: 32 }}>
          {layout.bars.map((b) => (
            <span
              key={`l${b.stepId}`}
              className="absolute text-center text-[12px] leading-tight text-ink-tertiary"
              style={{ left: `${b.left}%`, width: `${b.width}%` }}
            >
              {b.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function computeLayout(steps: WaterfallStep[]) {
  const n = steps.length;
  const colW = 100 / n;
  const barW = colW * 0.62;
  const pad = (colW - barW) / 2;

  let running = 0;
  const bars = steps.map((s, i) => {
    let bottom = 0;
    let top = 0;
    if (s.kind === 'start' || s.kind === 'end') {
      bottom = 0;
      top = s.amountCents;
      running = s.amountCents;
    } else {
      const before = running;
      const after = running + s.amountCents;
      running = after;
      bottom = Math.min(before, after);
      top = Math.max(before, after);
    }
    return {
      stepId: s.stepId,
      label: s.label,
      kind: s.kind,
      signed: s.amountCents,
      bottom,
      top,
      left: i * colW + pad,
      width: barW,
    };
  });

  const max = Math.max(...bars.map((b) => b.top), 1);

  // connectors sit at the running level after each step, spanning to the next bar
  let run = 0;
  const connectors = steps.slice(0, -1).map((s, i) => {
    if (s.kind === 'delta') run += s.amountCents;
    else run = s.amountCents;
    return {
      level: run,
      left: i * colW + pad + barW,
      width: colW - barW,
    };
  });

  return { bars, connectors, max };
}
