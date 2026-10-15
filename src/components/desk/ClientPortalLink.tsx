'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { listPortalOrgs, linkPortalOrg, createPortalOrg, type PortalOrgOption } from '@/desk/actions/portal';
import type { DeskRole } from '@/desk/roles';

// "Client portal" section of a client's drawer: which portal account sees this
// client's cycles and financials. Controllers and above can change it.

const MANAGERS: DeskRole[] = ['controller', 'management', 'owner'];

export function ClientPortalLink({ clientId, portalOrgId, role }: { clientId: string; portalOrgId: string | null; role: DeskRole }) {
  const router = useRouter();
  const toast = useToast();
  const [orgs, setOrgs] = useState<PortalOrgOption[] | null>(null);
  const [pending, start] = useTransition();
  const canEdit = MANAGERS.includes(role);

  useEffect(() => {
    listPortalOrgs().then(setOrgs).catch(() => setOrgs([]));
  }, []);

  const current = orgs?.find((o) => o.id === portalOrgId);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? 'Could not save.');
      else {
        toast.success(done);
        setOrgs(await listPortalOrgs());
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border-subtle pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-header text-ink-tertiary">Client portal</p>
      <p className="text-[12.5px] text-ink-tertiary">
        People in the linked portal account see this client’s cycles and, once a cycle is delivered, its financials dashboard.
      </p>
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={`portal-${clientId}`} className="sr-only">
            Portal account
          </label>
          <select
            id={`portal-${clientId}`}
            disabled={pending || orgs === null}
            value={portalOrgId ?? ''}
            onChange={(e) => run(() => linkPortalOrg({ clientId, orgId: e.target.value || null }), 'Portal access updated.')}
            className="h-9 min-w-[220px] rounded-input border border-border-default bg-surface-card px-2 text-[13px] text-ink"
          >
            <option value="">Not linked</option>
            {(orgs ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          {!portalOrgId && (
            <Button size="sm" variant="secondary" loading={pending} onClick={() => run(() => createPortalOrg({ clientId }), 'Portal account created and linked.')}>
              Create portal account
            </Button>
          )}
        </div>
      ) : (
        <p className="text-[13px] text-ink">{portalOrgId ? current?.name ?? 'Linked' : 'Not linked'}</p>
      )}
    </div>
  );
}
