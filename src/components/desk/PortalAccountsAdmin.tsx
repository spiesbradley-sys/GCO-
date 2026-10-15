'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { linkPortalOrg, createPortalOrg } from '@/desk/actions/portal';

export type AccountRow = {
  id: string;
  name: string;
  status: string | null;
  whiteLabel: boolean;
  portalOrgId: string | null;
  people: number;
  pendingInvites: number;
};

export function PortalAccountsAdmin({ rows, orgs }: { rows: AccountRow[]; orgs: { id: string; name: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const linked = rows.filter((r) => r.portalOrgId).length;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? 'Could not save.');
      else {
        toast.success(okMsg);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[14px] text-ink-secondary">
        {linked} of {rows.length} clients are linked. People in a linked portal account see that client’s cycles and, once a cycle is delivered, its financials.
      </p>
      <div className="overflow-hidden rounded-card border border-border-subtle bg-surface-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-[14px]">
            <thead>
              <tr className="bg-surface-sunken text-left text-[12px] uppercase tracking-header text-ink-tertiary">
                <th className="px-4 py-2.5 font-semibold">Desk client</th>
                <th className="px-4 py-2.5 font-semibold">Portal account</th>
                <th className="px-4 py-2.5 text-right font-semibold">People</th>
                <th className="px-4 py-2.5 text-right font-semibold">Pending invites</th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-ink-tertiary">
                    No desk clients yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-border-subtle align-middle hover:bg-surface-cream">
                    <td className="px-4 py-3">
                      <span className="font-semibold text-ink">{r.name}</span>
                      <span className="block text-[12.5px] text-ink-tertiary">
                        {[r.status, r.whiteLabel ? 'White label' : null].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <label htmlFor={`acct-${r.id}`} className="sr-only">
                          Portal account for {r.name}
                        </label>
                        <select
                          id={`acct-${r.id}`}
                          value={r.portalOrgId ?? ''}
                          disabled={pending}
                          onChange={(e) => run(() => linkPortalOrg({ clientId: r.id, orgId: e.target.value || null }), `${r.name}: portal link updated.`)}
                          className="h-9 min-w-[200px] rounded-input border border-border-default bg-surface-card px-2 text-[13px] text-ink"
                        >
                          <option value="">Not linked</option>
                          {orgs.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                        </select>
                        {!r.portalOrgId && (
                          <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => createPortalOrg({ clientId: r.id }), `Portal account created for ${r.name}.`)}>
                            Create account
                          </Button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink">
                      {r.portalOrgId ? r.people : '—'}
                      {r.portalOrgId && r.people === 0 && (
                        <span className="ml-2">
                          <StatusBadge tone="watch">No one yet</StatusBadge>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink">{r.portalOrgId ? r.pendingInvites : '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link
                        href={`/desk/clients/${r.id}/portal/financials`}
                        className="mr-3 text-[13px] font-semibold text-accent-secondary hover:text-accent-primary-hover"
                      >
                        View portal
                      </Link>
                      <Link href={`/desk/boards/clients?open=${r.id}`} className="text-[13px] font-semibold text-accent-secondary hover:text-accent-primary-hover">
                        Open client
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
