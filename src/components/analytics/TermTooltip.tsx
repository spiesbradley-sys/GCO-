'use client';

import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Glosses a financial term (EBITDA, AR aging, add-back) with a definition on
// practice-owner surfaces. On broker/analyst surfaces, pass `gloss={false}` to
// render the term plain and unglossed. Accessible: the definition is linked via
// aria-describedby and shown on hover and keyboard focus.
export function TermTooltip({
  term,
  definition,
  gloss = true,
  children,
}: {
  term: string;
  definition: string;
  gloss?: boolean;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const content = children ?? term;

  if (!gloss) return <>{content}</>;

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-describedby={id}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="cursor-help border-b border-dotted border-ink-tertiary text-left"
      >
        {content}
      </button>
      <span
        role="tooltip"
        id={id}
        className={cn(
          'absolute bottom-full left-0 z-30 mb-2 w-64 rounded-input bg-surface-card p-3 text-left text-[13px] font-normal normal-case tracking-normal text-ink-secondary shadow-md',
          open ? 'block' : 'hidden',
        )}
      >
        <span className="mb-0.5 block font-semibold text-ink">{term}</span>
        {definition}
      </span>
    </span>
  );
}

// Central glossary so definitions stay consistent across surfaces.
export const GLOSSARY: Record<string, string> = {
  EBITDA:
    'Earnings before interest, taxes, depreciation and amortization — a measure of core operating profit.',
  'Adjusted EBITDA':
    'EBITDA with owner-specific and one-time items normalised, to show sustainable earnings for a buyer.',
  'AR aging':
    'Outstanding receivables grouped by how long they have been unpaid (current, 1–30, 31–60, 61–90, 90+ days).',
  'Add-back':
    'A one-time or owner-specific expense added back to earnings to reflect normalised, ongoing profit.',
  'Collection rate':
    'Collections as a percentage of production — how much of the work billed you actually collected.',
};
