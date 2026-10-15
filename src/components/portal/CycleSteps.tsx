import { cn } from '@/lib/utils';
import { IconCheck } from '@/components/ui/icons';
import type { PortalStep } from '@/lib/portal/cycles';

// Five-step close tracker. State is carried by the glyph and the word, not color
// alone: done = teal check, current = gold numbered marker + "In progress".
export function CycleSteps({ steps, compact = false }: { steps: PortalStep[]; compact?: boolean }) {
  return (
    <ol className={cn('flex w-full', compact ? 'gap-1' : 'gap-2')} aria-label="Close progress">
      {steps.map((s, i) => (
        <li key={s.key} className="flex flex-1 flex-col gap-1.5">
          <span
            className={cn(
              'h-1.5 rounded-pill',
              s.state === 'done' ? 'bg-favorable' : s.state === 'current' ? 'bg-watch' : 'bg-surface-sunken',
            )}
            aria-hidden
          />
          {!compact && (
            <span className="flex items-center gap-1.5 text-[12.5px]">
              {s.state === 'done' ? (
                <IconCheck width={12} height={12} className="text-favorable" />
              ) : (
                <span
                  className={cn(
                    'flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold',
                    s.state === 'current' ? 'bg-watch text-white' : 'bg-surface-sunken text-ink-tertiary',
                  )}
                >
                  {i + 1}
                </span>
              )}
              <span className={s.state === 'upcoming' ? 'text-ink-tertiary' : 'font-semibold text-ink'}>{s.label}</span>
            </span>
          )}
          <span className="sr-only">
            {s.label}: {s.state === 'done' ? 'done' : s.state === 'current' ? 'in progress' : 'not started'}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** One-line status for a cycle, from its current step. */
export function stepStatus(steps: PortalStep[]): string {
  const current = steps.find((s) => s.state === 'current');
  if (!current) return 'Complete';
  if (current.key === 'close') return 'Waiting for month-end';
  if (current.key === 'meeting') return 'Delivered · review meeting next';
  return current.label;
}
