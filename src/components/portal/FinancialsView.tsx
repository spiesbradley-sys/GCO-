import Link from 'next/link';
import { PageHeader } from '@/components/shell/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconDocument } from '@/components/ui/icons';
import { FinancialsDashboard } from '@/components/portal/FinancialsDashboard';
import type { getPortalFinancials } from '@/lib/portal/cycles';
import { cn } from '@/lib/utils';

// The client's cashflow & revenue dashboard with its period picker. Shared by the
// portal (/financials) and the desk's staff preview; links are built from the
// `financialsHref` (period picker) and `cyclesHref` (cycle links) prefixes.
export function FinancialsView({
  result,
  fallbackEyebrow,
  financialsHref,
  cyclesHref,
}: {
  result: Awaited<ReturnType<typeof getPortalFinancials>>;
  fallbackEyebrow: string;
  financialsHref: string;
  cyclesHref: string;
}) {
  const { published, chosen, data, updatedAt } = result;

  if (!chosen || !data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader eyebrow={fallbackEyebrow} title="Cashflow & revenue" description="Your management financials, month by month." />
        <Card>
          <EmptyState
            icon={<IconDocument width={22} height={22} />}
            title="No financials published yet"
            body="Your dashboard appears here when we deliver your first close."
            action={
              <Link href={cyclesHref} className="text-[14px] font-semibold text-accent-secondary hover:text-accent-primary-hover">
                See where your close stands
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={data.entity ?? fallbackEyebrow}
        title="Cashflow & revenue"
        description={`${data.periodLabel ?? chosen.periodLabel} · from your ${chosen.periodLabel} close`}
        action={
          <Link href={`${cyclesHref}/${chosen.id}`} className="text-[14px] font-semibold text-accent-secondary hover:text-accent-primary-hover">
            View the close
          </Link>
        }
      />

      {published.length > 1 && (
        <nav aria-label="Period" className="flex flex-wrap gap-2">
          {published.map((p) => (
            <Link
              key={p.id}
              href={`${financialsHref}?cycle=${p.id}`}
              aria-current={p.id === chosen.id ? 'page' : undefined}
              className={cn(
                'rounded-pill border px-3 py-1.5 text-[13px] font-semibold',
                p.id === chosen.id ? 'border-accent-primary bg-surface-cream text-ink' : 'border-border-subtle bg-surface-card text-ink-secondary hover:bg-surface-sunken',
              )}
            >
              {p.periodLabel}
            </Link>
          ))}
        </nav>
      )}

      <FinancialsDashboard data={data} updatedAt={updatedAt} />
    </div>
  );
}
