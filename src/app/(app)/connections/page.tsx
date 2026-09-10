import { requirePermission } from '@/lib/context';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/shell/PageHeader';
import {
  ConnectionsView,
  type ConnectionCard,
} from '@/components/features/connections/ConnectionsView';
import { formatDate } from '@/lib/utils';

const PROVIDERS = ['quickbooks', 'xero', 'plaid'] as const;

export default async function ConnectionsPage() {
  const ctx = await requirePermission('connections.view');

  const existing = await ctx.db.connection.findMany();
  const byProvider = new Map(existing.map((c) => [c.provider, c]));

  // Always show all three providers; unlinked ones read "disconnected".
  const cards: ConnectionCard[] = PROVIDERS.map((provider) => {
    const c = byProvider.get(provider);
    return {
      provider,
      status: (c?.status ?? 'disconnected') as ConnectionCard['status'],
      lastSync: c?.lastSyncAt ? formatDate(c.lastSyncAt) : null,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Close"
        title="Connections"
        description="Link your accounting system and bank feed so we can keep your books current. You authorise each connection in the provider's own secure flow — we never see your login."
      />
      <ConnectionsView cards={cards} canManage={can(ctx.effectiveRole, 'connections.manage')} />
    </div>
  );
}
