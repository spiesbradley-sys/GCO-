import type { ReactNode } from 'react';

// The brand rhythm carried into product: eyebrow → title → one-line description
// on the left, one primary action on the right.
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="font-heading text-page-title text-ink">{title}</h1>
        {description && <p className="max-w-2xl text-[15px] text-ink-secondary">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
