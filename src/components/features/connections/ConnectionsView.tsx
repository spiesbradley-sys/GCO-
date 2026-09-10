'use client';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge, CONNECTION_STATUS } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';

type ProviderKey = 'quickbooks' | 'xero' | 'plaid';

export type ConnectionCard = {
  provider: ProviderKey;
  status: keyof typeof CONNECTION_STATUS;
  lastSync: string | null;
};

const META: Record<ProviderKey, { name: string; blurb: string }> = {
  quickbooks: { name: 'QuickBooks Online', blurb: 'Accounting ledger and reports' },
  xero: { name: 'Xero', blurb: 'Accounting ledger and reports' },
  plaid: { name: 'Bank feed (Plaid)', blurb: 'Bank and card transactions' },
};

export function ConnectionsView({
  cards,
  canManage,
}: {
  cards: ConnectionCard[];
  canManage: boolean;
}) {
  const toast = useToast();

  function connect(provider: ProviderKey) {
    // Client authorises in the provider's OWN hosted flow. We only ever receive
    // and store provider tokens + metadata — never the client's provider login.
    // TODO: replace the stub start route with the real OAuth/Link initiation.
    toast.info(`Redirecting to ${META[provider].name} to authorise…`);
    window.location.href = `/api/connections/${provider}/start`;
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((c) => {
        const status = CONNECTION_STATUS[c.status];
        return (
          <Card key={c.provider} className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col">
                <h3 className="font-heading text-card-title">{META[c.provider].name}</h3>
                <p className="text-[13px] text-ink-tertiary">{META[c.provider].blurb}</p>
              </div>
              <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
            </div>

            <p className="text-[13px] text-ink-tertiary">
              {c.lastSync ? `Last synced ${c.lastSync}` : 'Not yet synced'}
            </p>

            {canManage && (
              <div className="mt-auto">
                {c.status === 'connected' ? (
                  <Button variant="secondary" size="sm" onClick={() => connect(c.provider)}>
                    Manage connection
                  </Button>
                ) : c.status === 'needs_reauth' ? (
                  <Button size="sm" onClick={() => connect(c.provider)}>
                    Reconnect
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => connect(c.provider)}>
                    Connect {META[c.provider].name.split(' ')[0]}
                  </Button>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
