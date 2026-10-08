import { cn } from '@/lib/utils';

export function BrandLogo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <img
      src="/brand/gco-partners-logo.png"
      alt="GCO Partners"
      className={cn(
        compact
          ? 'h-9 w-9 object-cover object-left'
          : 'h-11 w-full max-w-[216px] object-contain object-left',
        className,
      )}
    />
  );
}