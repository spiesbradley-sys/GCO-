import Link from 'next/link';
import { PageHeader } from '@/components/shell/PageHeader';
import { Card } from '@/components/ui/Card';
import { Banner } from '@/components/ui/Banner';
import { StatusBadge, type Tone } from '@/components/ui/Badge';
import { CycleSteps, stepStatus } from '@/components/portal/CycleSteps';
import type { PortalCycleDetail } from '@/lib/portal/cycles';
import { formatDate } from '@/lib/utils';

// One month's close: where it stands, the key dates, and anything we're waiting on
// the client for. Shared by the portal (/cycles/[id]) and the desk's staff preview.

const REQUEST_TONE: Record<string, Tone> = { Open: 'unfavorable', 'Awaiting client': 'watch', Resolved: 'favorable' };

export function CycleDetailView({
  cycle,
  cyclesHref,
  dashboardHref,
}: {
  cycle: PortalCycleDetail;
  cyclesHref: string;
  /** Where this month's CFO dashboard lives (only linked once figures are uploaded). */
  dashboardHref: string;
}) {
  const open = cycle.requests.filter((r) => r.status !== 'Resolved');
  const dates: [string, string | null][] = [
    ['Close date', cycle.closeDate],
    ['Delivered', cycle.delivered],
    ['Review meeting', cycle.meeting],
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href={cyclesHref} className="text-[13px] font-semibold text-accent-secondary hover:text-accent-primary-hover">
          All months
        </Link>
        <PageHeader
          eyebrow="Monthly close"
          title={cycle.periodLabel}
          description={stepStatus(cycle.steps)}
          action={
            cycle.hasFinancials ? (
              <Link href={`${dashboardHref}?cycle=${cycle.id}`} className="text-[14px] font-semibold text-accent-secondary hover:text-accent-primary-hover">
                Open the CFO dashboard
              </Link>
            ) : undefined
          }
        />
      </div>

      {open.length > 0 && (
        <Banner tone="watch">
          We need {open.length === 1 ? 'one thing' : `${open.length} things`} from you to finish this close.
        </Banner>
      )}

      <Card as="section" className="flex flex-col gap-5">
        <CycleSteps steps={cycle.steps} />
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {dates.map(([label, v]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <dt className="text-[12px] font-semibold uppercase tracking-header text-ink-tertiary">{label}</dt>
              <dd className="text-[15px] text-ink">{v ? formatDate(v) : 'Not yet'}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {open.length > 0 && (
        <Card as="section" className="flex flex-col gap-4">
          <h2 className="font-heading text-card-title text-ink">What we need from you</h2>
          <ul className="flex flex-col divide-y divide-border-subtle">
            {open.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 py-3 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-ink">{r.title}</span>
                  <StatusBadge tone={REQUEST_TONE[r.status ?? 'Open'] ?? 'neutral'}>{r.status ?? 'Open'}</StatusBadge>
                </div>
                {r.details && <p className="text-[14px] text-ink-secondary">{r.details}</p>}
                {r.raised && <span className="text-[12.5px] text-ink-tertiary">Asked {formatDate(r.raised)}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
