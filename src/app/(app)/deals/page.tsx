import { requirePermission } from '@/lib/context';
import { PageHeader } from '@/components/shell/PageHeader';
import { Pill } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconDocument } from '@/components/ui/icons';
import { formatDate } from '@/lib/utils';

// Broker-facing deal & diligence tracker. Deal stage is a workflow state, not a
// data-health signal, so it renders as a neutral pill — never the teal/rust/gold
// semantics.
export default async function DealsPage() {
  const ctx = await requirePermission('deals.view');

  const deals = await ctx.db.deal.findMany({ orderBy: { updatedAt: 'desc' } });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Diligence"
        title="Deals"
        description="Track diligence across your active deals."
      />

      {deals.length === 0 ? (
        <div className="rounded-card border border-border-subtle bg-surface-card">
          <EmptyState
            icon={<IconDocument width={22} height={22} />}
            title="No deals yet"
            body="Deals you're running diligence on will appear here."
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-border-subtle bg-surface-card">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="bg-surface-sunken">
                <th className="px-4 py-3 text-left text-[13px] font-semibold uppercase tracking-header text-ink-tertiary">
                  Deal
                </th>
                <th className="px-4 py-3 text-left text-[13px] font-semibold uppercase tracking-header text-ink-tertiary">
                  Target
                </th>
                <th className="px-4 py-3 text-left text-[13px] font-semibold uppercase tracking-header text-ink-tertiary">
                  Stage
                </th>
                <th className="px-4 py-3 text-left text-[13px] font-semibold uppercase tracking-header text-ink-tertiary">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => (
                <tr key={d.id} className="border-b border-border-subtle hover:bg-surface-cream">
                  <td className="h-11 px-4 py-3 font-semibold text-ink">{d.name}</td>
                  <td className="h-11 px-4 py-3 text-ink">{d.targetName ?? '—'}</td>
                  <td className="h-11 px-4 py-3">
                    <Pill>{d.stage.replace(/_/g, ' ')}</Pill>
                  </td>
                  <td className="h-11 px-4 py-3 text-ink-secondary">{formatDate(d.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
