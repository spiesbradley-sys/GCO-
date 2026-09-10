import { requirePermission } from '@/lib/context';
import { PageHeader } from '@/components/shell/PageHeader';
import { KpiCard } from '@/components/ui/KpiCard';
import { Card, CardTitle } from '@/components/ui/Card';
import { StatusBadge, CONNECTION_STATUS } from '@/components/ui/Badge';
import { Banner } from '@/components/ui/Banner';
import { formatCurrencyWhole } from '@/lib/utils';

// Client dashboard. Scopes to the active tenant first (ctx.db is tenant-locked),
// then respects the period selector. Data reads happen server-side under the
// tenant guard.
export default async function DashboardPage() {
  const ctx = await requirePermission('dashboard.view');
  const db = ctx.db;

  const [outstanding, connections, unreadMessages, activeEngagements] = await Promise.all([
    db.invoice.aggregate({
      where: { status: { in: ['sent', 'overdue'] } },
      _sum: { amountCents: true },
      _count: true,
    }),
    db.connection.findMany({ orderBy: { provider: 'asc' } }),
    db.thread.count({ where: { messages: { some: { readAt: null } } } }),
    db.engagement.count({ where: { status: 'active' } }),
  ]);

  const outstandingCents = outstanding._sum.amountCents ?? 0;
  const connectedCount = connections.filter((c) => c.status === 'connected').length;
  const needsAttention = connections.some((c) => c.status !== 'connected');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={ctx.activeOrg.orgName}
        title="Dashboard"
        description="Where your engagement stands this period, at a glance."
      />

      {needsAttention && (
        <Banner tone="watch">
          One or more system links need attention. Reconnect them so we can keep your books current.
        </Banner>
      )}

      <section
        aria-label="Key metrics"
        className="grid grid-cols-2 gap-x-8 gap-y-7 py-2 sm:grid-cols-4 xl:flex xl:gap-0"
      >
        {[
          <KpiCard
            key="outstanding"
            label="Outstanding"
            value={formatCurrencyWhole(outstandingCents)}
            sub={`${outstanding._count} open invoice${outstanding._count === 1 ? '' : 's'}`}
          />,
          <KpiCard
            key="linked"
            label="Linked systems"
            value={`${connectedCount}/${connections.length || 0}`}
            sub="Accounting & banking"
          />,
          <KpiCard key="unread" label="Unread messages" value={unreadMessages} sub="Across your threads" />,
          <KpiCard key="active" label="Active engagements" value={activeEngagements} sub="In progress" />,
        ].map((card, i) => (
          <div
            key={card.key}
            className={i > 0 ? 'xl:ml-8 xl:flex-1 xl:border-l xl:border-border-subtle xl:pl-8' : 'xl:flex-1'}
          >
            {card}
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle className="mb-4">Linked systems</CardTitle>
          {connections.length === 0 ? (
            <p className="text-[15px] text-ink-secondary">
              No systems linked yet. Connect QuickBooks, Xero, or your bank to start the close.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border-subtle">
              {connections.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-3">
                  <span className="text-[15px] capitalize text-ink">{c.provider}</span>
                  <StatusBadge tone={CONNECTION_STATUS[c.status].tone}>
                    {CONNECTION_STATUS[c.status].label}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle className="mb-4">Engagement status</CardTitle>
          <p className="text-[15px] text-ink-secondary">
            {activeEngagements > 0
              ? `${activeEngagements} engagement${activeEngagements === 1 ? '' : 's'} active. Your GCO team is on track for this period's close.`
              : 'No active engagements. Your GCO team will reach out to kick things off.'}
          </p>
        </Card>
      </section>
    </div>
  );
}
