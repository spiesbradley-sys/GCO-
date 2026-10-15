import Link from 'next/link';
import { PageHeader } from '@/components/shell/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/Badge';
import { IconDocument } from '@/components/ui/icons';
import { FinancialsDashboard } from '@/components/portal/FinancialsDashboard';
import { CycleSteps, stepStatus } from '@/components/portal/CycleSteps';
import type { getPortalFinancials, PortalCycleSummary } from '@/lib/portal/cycles';
import { cn, formatDate } from '@/lib/utils';

// The client's CFO dashboard: where this month's close stands, then the dashboard
// built from the financials workbook the accountant uploaded. Shared by the portal
// (/dashboard/cfo) and the desk's staff preview; links are built from the
// `dashboardHref` (period picker) and `cyclesHref` (monthly close) prefixes.
export function FinancialsView({
  result,
  latestClose,
  fallbackEyebrow,
  dashboardHref,
  cyclesHref,
}: {
  result: Awaited<ReturnType<typeof getPortalFinancials>>;
  latestClose: PortalCycleSummary | null;
  fallbackEyebrow: string;
  dashboardHref: string;
  cyclesHref: string;
}) {
  const { published, chosen, data, updatedAt } = result;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={data?.entity ?? fallbackEyebrow}
        title="CFO dashboard"
        description={data ? `${data.periodLabel ?? chosen?.periodLabel} · cash basis` : 'Your management financials, month by month.'}
      />

      {latestClose && (
        <Card as="section" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="flex flex-col">
              <span className="text-[12px] font-semibold uppercase tracking-eyebrow text-ink-tertiary">Monthly close</span>
              <h2 className="font-heading text-card-title text-ink">
                {latestClose.periodLabel} · {stepStatus(latestClose.steps)}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {latestClose.openRequests > 0 && <StatusBadge tone="unfavorable">{latestClose.openRequests} needs you</StatusBadge>}
              <span className="text-[13px] text-ink-tertiary">
                {latestClose.delivered
                  ? `Delivered ${formatDate(latestClose.delivered)}`
                  : latestClose.closeDate
                    ? `Due ${formatDate(latestClose.closeDate)}`
                    : ''}
              </span>
              <Link href={`${cyclesHref}/${latestClose.id}`} className="text-[14px] font-semibold text-accent-secondary hover:text-accent-primary-hover">
                Details
              </Link>
            </div>
          </div>
          <CycleSteps steps={latestClose.steps} />
        </Card>
      )}

      {!chosen || !data ? (
        <Card>
          <EmptyState
            icon={<IconDocument width={22} height={22} />}
            title="No dashboard yet"
            body="It appears here as soon as we upload your management financials for the month."
          />
        </Card>
      ) : (
        <>
          {published.length > 1 && (
            <nav aria-label="Period" className="flex flex-wrap gap-2">
              {published.map((p) => (
                <Link
                  key={p.id}
                  href={`${dashboardHref}?cycle=${p.id}`}
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
        </>
      )}
    </div>
  );
}
