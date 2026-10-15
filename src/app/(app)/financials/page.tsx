import Link from 'next/link';
import { requirePermission } from '@/lib/context';
import { PageHeader } from '@/components/shell/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconDocument } from '@/components/ui/icons';
import { FinancialsDashboard } from '@/components/portal/FinancialsDashboard';
import { getPortalFinancials } from '@/lib/portal/cycles';
import { cn } from '@/lib/utils';

// The client's cashflow & revenue dashboard: the latest delivered cycle by
// default, with earlier delivered periods one click away (?cycle=<id>).
export const dynamic = 'force-dynamic';

export default async function FinancialsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const ctx = await requirePermission('analytics.view');
  const requested = typeof searchParams.cycle === 'string' ? searchParams.cycle : null;
  const { published, chosen, data, updatedAt } = await getPortalFinancials(ctx, requested);

  if (!chosen || !data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader eyebrow={ctx.activeOrg.orgName} title="Cashflow & revenue" description="Your management financials, month by month." />
        <Card>
          <EmptyState
            icon={<IconDocument width={22} height={22} />}
            title="No financials published yet"
            body="Your dashboard appears here when we deliver your first close."
            action={
              <Link href="/cycles" className="text-[14px] font-semibold text-accent-secondary hover:text-accent-primary-hover">
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
        eyebrow={data.entity ?? ctx.activeOrg.orgName}
        title="Cashflow & revenue"
        description={`${data.periodLabel ?? chosen.periodLabel} · from your ${chosen.periodLabel} close`}
        action={
          <Link href={`/cycles/${chosen.id}`} className="text-[14px] font-semibold text-accent-secondary hover:text-accent-primary-hover">
            View the close
          </Link>
        }
      />

      {published.length > 1 && (
        <nav aria-label="Period" className="flex flex-wrap gap-2">
          {published.map((p) => (
            <Link
              key={p.id}
              href={`/financials?cycle=${p.id}`}
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
