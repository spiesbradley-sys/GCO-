'use client';

import type { ReactNode } from 'react';
import { formatCurrency } from '@/lib/utils';

// House tooltip: white card, shadow-md, 8px radius, 12px padding, one row per
// series with a color dot, series name and full-precision value.
type Row = { name: string; value: number; color: string; kind?: 'money' | 'percent' };

export function TooltipCard({ label, rows }: { label?: ReactNode; rows: Row[] }) {
  return (
    <div className="rounded-input bg-surface-card p-3 shadow-md">
      {label != null && <p className="mb-1.5 text-[13px] font-semibold text-ink">{label}</p>}
      <div className="flex flex-col gap-1">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center gap-2 text-[13px]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.color }} />
            <span className="text-ink-secondary">{r.name}</span>
            <span className="ml-auto pl-4 font-semibold tabular-nums text-ink">
              {r.kind === 'percent' ? `${(r.value * 100).toFixed(1)}%` : formatCurrency(r.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Recharts content adapter — pass `kind` for percent vs money.
export function rechartsTooltip(kind: 'money' | 'percent' = 'money') {
  return function Content(props: {
    active?: boolean;
    label?: ReactNode;
    payload?: Array<{ name?: string; value?: number; color?: string; stroke?: string; fill?: string }>;
  }) {
    if (!props.active || !props.payload?.length) return null;
    return (
      <TooltipCard
        label={props.label}
        rows={props.payload.map((p) => ({
          name: String(p.name ?? ''),
          value: Number(p.value ?? 0),
          color: p.color || p.stroke || p.fill || '#251c1a',
          kind,
        }))}
      />
    );
  };
}
