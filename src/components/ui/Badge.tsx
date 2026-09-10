import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { IconCheck, IconAlert, IconClock, IconInfo } from './icons';

// Status is meaning, not decoration. Tone maps to the FIXED data semantics and
// always pairs the color with a glyph + text label — never color alone.

export type Tone = 'favorable' | 'unfavorable' | 'watch' | 'neutral';

const toneStyles: Record<Tone, string> = {
  favorable: 'bg-favorable-tint text-favorable',
  unfavorable: 'bg-unfavorable-tint text-unfavorable',
  watch: 'bg-watch-tint text-watch',
  neutral: 'bg-neutral-tint text-ink-secondary',
};

const toneIcon: Record<Tone, ReactNode> = {
  favorable: <IconCheck width={12} height={12} />,
  unfavorable: <IconAlert width={12} height={12} />,
  watch: <IconClock width={12} height={12} />,
  neutral: <IconInfo width={12} height={12} />,
};

export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-[12px] font-semibold',
        toneStyles[tone],
      )}
    >
      {toneIcon[tone]}
      {children}
    </span>
  );
}

/** Neutral pill for non-semantic labels (roles, tags). Never color-coded. */
export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill bg-surface-sunken px-2.5 py-1 text-[12px] font-semibold text-ink-secondary',
        className,
      )}
    >
      {children}
    </span>
  );
}

// ── Domain status → (tone, label) mappings. Single source per domain so the
//    fixed semantics can't drift screen to screen. ──

export const INVOICE_STATUS: Record<string, { tone: Tone; label: string }> = {
  draft: { tone: 'neutral', label: 'Draft' },
  sent: { tone: 'watch', label: 'Sent' },
  paid: { tone: 'favorable', label: 'Paid' },
  overdue: { tone: 'unfavorable', label: 'Overdue' },
  void: { tone: 'neutral', label: 'Void' },
};

export const CONNECTION_STATUS: Record<string, { tone: Tone; label: string }> = {
  connected: { tone: 'favorable', label: 'Connected' },
  needs_reauth: { tone: 'watch', label: 'Needs reauth' },
  disconnected: { tone: 'unfavorable', label: 'Disconnected' },
};

export const DOCUMENT_STATUS: Record<string, { tone: Tone; label: string }> = {
  received: { tone: 'favorable', label: 'Received' },
  reconciled: { tone: 'favorable', label: 'Reconciled' },
  pending_review: { tone: 'watch', label: 'Pending review' },
  missing: { tone: 'unfavorable', label: 'Missing' },
  rejected: { tone: 'unfavorable', label: 'Rejected' },
};

export const PAYMENT_STATUS: Record<string, { tone: Tone; label: string }> = {
  pending: { tone: 'watch', label: 'Pending' },
  succeeded: { tone: 'favorable', label: 'Succeeded' },
  failed: { tone: 'unfavorable', label: 'Failed' },
  refunded: { tone: 'neutral', label: 'Refunded' },
};
