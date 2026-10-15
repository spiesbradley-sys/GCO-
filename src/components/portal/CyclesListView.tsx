import Link from 'next/link';
import { PageHeader } from '@/components/shell/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/Badge';
import { IconDocument } from '@/components/ui/icons';
import { CycleSteps, stepStatus } from '@/components/portal/CycleSteps';
import type { PortalCycleSummary } from '@/lib/portal/cycles';
import { formatDate } from '@/lib/utils';

// The client's list of close cycles. Shared by the portal (/cycles) and the desk's
// staff preview; `base` is where cycle links point (e.g. "/cycles").
export function CyclesListView({ cycles, base, emptyBody }: { cycles: PortalCycleSummary[]; base: string; emptyBody: string }) {
  const waiting = cycles.reduce((n, c) => n + c.openRequests, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Month-end close"
        title="Cycles"
        description={
          waiting
            ? `${waiting} open ${waiting === 1 ? 'request needs' : 'requests need'} your input before we can finish a close.`
            : 'Each period we close your books, review them, and deliver your financials.'
        }
      />

      {cycles.length === 0 ? (
        <Card>
          <EmptyState icon={<IconDocument width={22} height={22} />} title="No cycles yet" body={emptyBody} />
        </Card>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-border-subtle">
            {cycles.map((c) => (
              <li key={c.id}>
                <Link
                  href={`${base}/${c.id}`}
                  className="grid gap-3 px-6 py-4 hover:bg-surface-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-secondary md:grid-cols-[1.2fr_1.6fr_1fr] md:items-center"
                >
                  <div className="flex flex-col">
                    <span className="font-heading text-[16px] font-semibold text-ink">{c.periodLabel}</span>
                    <span className="text-[13px] text-ink-tertiary">{c.engagement}</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <CycleSteps steps={c.steps} compact />
                    <span className="text-[13px] text-ink-secondary">{stepStatus(c.steps)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    {c.openRequests > 0 && <StatusBadge tone="unfavorable">{c.openRequests} needs you</StatusBadge>}
                    {c.hasFinancials && <StatusBadge tone="favorable">Financials ready</StatusBadge>}
                    <span className="text-[13px] text-ink-tertiary">
                      {c.delivered ? `Delivered ${formatDate(c.delivered)}` : c.closeDate ? `Due ${formatDate(c.closeDate)}` : ''}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
