import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { IconCheck, IconAlert, IconClock, IconInfo } from './icons';

// Inline banner for page-level conditions (period locked, data awaiting client
// input). Tinted panel in the matching semantic tint with a filled glyph and one
// optional action link. No colored left-border strip.

type BannerTone = 'favorable' | 'unfavorable' | 'watch' | 'info';

const styles: Record<BannerTone, string> = {
  favorable: 'bg-favorable-tint text-favorable',
  unfavorable: 'bg-unfavorable-tint text-unfavorable',
  watch: 'bg-watch-tint text-watch',
  info: 'bg-surface-sunken text-ink-secondary',
};

const icons: Record<BannerTone, ReactNode> = {
  favorable: <IconCheck width={16} height={16} />,
  unfavorable: <IconAlert width={16} height={16} />,
  watch: <IconClock width={16} height={16} />,
  info: <IconInfo width={16} height={16} />,
};

export function Banner({
  tone = 'info',
  children,
  action,
}: {
  tone?: BannerTone;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={cn('flex items-start gap-2.5 rounded-card px-4 py-3', styles[tone])}>
      <span className="mt-0.5 shrink-0">{icons[tone]}</span>
      <div className="flex-1 text-[14px] text-ink">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
