import type { ReactNode } from 'react';

// Centered empty state: one flat glyph in a cream circle, a heading line, one
// sentence, one primary action. No illustrations or mascots. Distinguish a
// filtered-empty ("nothing matches these filters") from a true-empty.
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-cream text-accent-primary">
        {icon}
      </div>
      <h3 className="font-heading text-[16px] font-semibold text-ink">{title}</h3>
      <p className="max-w-sm text-[15px] text-ink-secondary">{body}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
