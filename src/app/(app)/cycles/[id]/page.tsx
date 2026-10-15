import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/context';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/shell/PageHeader';
import { Card } from '@/components/ui/Card';
import { Banner } from '@/components/ui/Banner';
import { StatusBadge, type Tone } from '@/components/ui/Badge';
import { CycleSteps, stepStatus } from '@/components/portal/CycleSteps';
import { FinancialsDashboard } from '@/components/portal/FinancialsDashboard';
import { getPortalCycle } from '@/lib/portal/cycles';
import { formatDate } from '@/lib/utils';

// One close cycle: progress, key dates, what we need from the client, what we
// delivered, the open review items, and — once delivered — the dashboard.
export const dynamic = 'force-dynamic';

const REQUEST_TONE: Record<string, Tone> = { Open: 'unfavorable', 'Awaiting client': 'watch', Resolved: 'favorable' };

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <Card as="section" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-[12px] font-semibold uppercase tracking-eyebrow text-ink-tertiary">{eyebrow}</span>
        <h2 className="font-heading text-card-title text-ink">{title}</h2>
      </div>
      {children}
    </Card>
  );
}

export default async function CyclePage({ params }: { params: { id: string } }) {
  const ctx = await requirePermission('cycles.view');
  const cycle = await getPortalCycle(ctx, params.id);
  if (!cycle) notFound();

  const open = cycle.requests.filter((r) => r.status !== 'Resolved');
  const resolved = cycle.requests.filter((r) => r.status === 'Resolved');
  const fin = cycle.financials;
  const stillOpen = fin?.openItems.filter((i) => /open/i.test(i.group)) ?? [];
  const otherItems = fin?.openItems.filter((i) => !/open/i.test(i.group)) ?? [];

  const dates: [string, string | null][] = [
    ['Close date', cycle.closeDate],
    ['Delivered', cycle.delivered],
    ['Review meeting', cycle.meeting],
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/cycles" className="text-[13px] font-semibold text-accent-secondary hover:text-accent-primary-hover">
          All cycles
        </Link>
        <PageHeader eyebrow={cycle.engagement} title={`${cycle.periodLabel} close`} description={stepStatus(cycle.steps)} />
      </div>

      {open.length > 0 && (
        <Banner tone="watch">
          We need {open.length === 1 ? 'one thing' : `${open.length} things`} from you to finish this close. See requests below, or reply in Messages.
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

      <div className="grid gap-6 xl:grid-cols-2">
        <Section eyebrow="Requests" title={open.length ? 'What we need from you' : 'Requests'}>
          {cycle.requests.length === 0 ? (
            <p className="text-[14px] text-ink-tertiary">Nothing needed from you for this close.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border-subtle">
              {[...open, ...resolved].map((r) => (
                <li key={r.id} className="flex flex-col gap-1 py-3 first:pt-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-ink">{r.title}</span>
                    <StatusBadge tone={REQUEST_TONE[r.status ?? 'Open'] ?? 'neutral'}>{r.status ?? 'Open'}</StatusBadge>
                  </div>
                  {r.details && <p className="text-[14px] text-ink-secondary">{r.details}</p>}
                  <span className="text-[12.5px] text-ink-tertiary">
                    {r.type}
                    {r.raised ? ` · raised ${formatDate(r.raised)}` : ''}
                    {r.resolved ? ` · resolved ${formatDate(r.resolved)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section eyebrow="Deliverables" title="What we’ve delivered">
          {cycle.deliverables.length === 0 ? (
            <p className="text-[14px] text-ink-tertiary">Your financials and reports appear here once this close is delivered.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border-subtle">
              {cycle.deliverables.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0">
                  <span className="text-ink">{d.title}</span>
                  <span className="text-[13px] text-ink-tertiary">
                    {d.type ?? 'Deliverable'}
                    {d.delivered ? ` · ${formatDate(d.delivered)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {(stillOpen.length > 0 || otherItems.length > 0) && (
        <Section eyebrow="Review" title="Open items and adjustments">
          <ul className="flex flex-col divide-y divide-border-subtle">
            {[...stillOpen, ...otherItems].map((i, n) => (
              <li key={n} className="grid gap-1 py-3 first:pt-0 md:grid-cols-[1fr_2fr_auto] md:gap-4">
                <span className="font-semibold text-ink">{i.item}</span>
                <span className="text-[14px] text-ink-secondary">{i.note}</span>
                <span className="md:text-right">
                  <StatusBadge tone={/open/i.test(i.group) ? 'watch' : /confirm|posted|resolved/i.test(i.group) ? 'favorable' : 'neutral'}>
                    {i.group}
                  </StatusBadge>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {fin && can(ctx.effectiveRole, 'analytics.view') ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold uppercase tracking-eyebrow text-ink-tertiary">Financials</span>
            <h2 className="font-heading text-section-title text-ink">Cashflow and revenue, {fin.periodLabel ?? cycle.periodLabel}</h2>
          </div>
          <FinancialsDashboard data={fin} updatedAt={cycle.financialsUpdatedAt} />
        </section>
      ) : (
        !cycle.hasFinancials && (
          <p className="text-[14px] text-ink-tertiary">Your financials dashboard for this period appears here once the close is delivered.</p>
        )
      )}
    </div>
  );
}
