import { cn, formatCurrency } from '@/lib/utils';
import { IconArrowUp, IconArrowDown } from '@/components/ui/icons';

// Variance = color + arrow + sign, never color alone. `favorable` says whether
// the movement is good (a positive P&L expense variance may be unfavorable).
export function VarianceCell({
  cents,
  favorable,
}: {
  cents: number;
  favorable?: boolean;
}) {
  const up = cents >= 0;
  const good = favorable ?? up;
  return (
    <span
      className={cn(
        'inline-flex items-center justify-end gap-1 tnum font-semibold',
        good ? 'text-favorable' : 'text-unfavorable',
      )}
    >
      {up ? <IconArrowUp width={12} height={12} /> : <IconArrowDown width={12} height={12} />}
      {formatCurrency(cents)}
    </span>
  );
}
