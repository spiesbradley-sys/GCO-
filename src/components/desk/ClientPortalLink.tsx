'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import {
  listPortalOrgs,
  linkPortalOrg,
  createPortalOrg,
  listPortalAccess,
  invitePortalUser,
  cancelPortalInvite,
  revokePortalAccess,
  type PortalOrgOption,
  type PortalAccess,
} from '@/desk/actions/portal';
import { confirmationMatches, confirmationTarget } from '@/lib/portal/inviteRules';
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
      {portalOrgId && <PortalPeople key={portalOrgId} clientId={clientId} canEdit={canEdit} />}
    </div>
  );
}

// ── People with access ───────────────────────────────────────────────────────
// Who can sign in to the linked portal account, pending invites, an invite form,
// and remove-access with typed-name confirmation (inline, so no modal stacks on
// the drawer).

function PortalPeople({ clientId, canEdit }: { clientId: string; canEdit: boolean }) {
  const toast = useToast();
  const [access, setAccess] = useState<PortalAccess | null | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);
  const [pending, start] = useTransition();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [removeError, setRemoveError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoadError(false);
    listPortalAccess(clientId)
      .then(setAccess)
      .catch(() => setLoadError(true));
  }, [clientId]);
  useEffect(load, [load]);

  function invite(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    start(async () => {
      const res = await invitePortalUser({ clientId, name, email });
      if (!res.ok) return setFormError(res.error ?? 'Could not send the invite.');
      toast.success(`Invite sent to ${email.trim().toLowerCase()}.`);
      setLastLink(res.link ?? null);
      setName('');
      setEmail('');
      load();
    });
  }

  function cancel(inviteId: string) {
    start(async () => {
      const res = await cancelPortalInvite({ clientId, inviteId });
      if (!res.ok) toast.error(res.error ?? 'Could not cancel the invite.');
      else toast.success('Invite cancelled. Its link no longer works.');
      load();
    });
  }

  function revoke(userId: string) {
    setRemoveError(null);
    start(async () => {
      const res = await revokePortalAccess({ clientId, userId, confirm: typed });
      if (!res.ok) return setRemoveError(res.error ?? 'Could not remove access.');
      toast.success('Access removed.');
      setRemoving(null);
      setTyped('');
      load();
    });
  }

  if (loadError)
    return (
      <p className="text-[12.5px] text-unfavorable">
        Couldn’t load who has access.{' '}
        <button onClick={load} className="font-semibold underline">
          Retry
        </button>
      </p>
    );
  if (access === undefined) return <div className="h-16 rounded-input bg-surface-sunken" aria-hidden />;
  if (access === null) return null;

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="mt-1 flex flex-col gap-2">
      <p className="text-[12.5px] font-semibold text-ink">People with access · {access.members.length}</p>
      {access.members.length === 0 && access.invites.length === 0 && (
        <p className="text-[12.5px] text-ink-tertiary">No one can sign in yet. Invite the client’s owner or office manager below.</p>
      )}
      <ul className="flex flex-col divide-y divide-border-subtle rounded-input border border-border-subtle">
        {access.members.map((m) => {
          const target = confirmationTarget(m);
          return (
            <li key={m.userId} className="flex flex-col gap-2 px-3 py-2 text-[13px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex flex-col">
                  <span className="font-semibold text-ink">{m.name ?? m.email}</span>
                  <span className="text-[12px] text-ink-tertiary">
                    {m.name ? `${m.email} · ` : ''}since {fmt(m.since)}
                  </span>
                </span>
                {canEdit && removing !== m.userId && (
                  <Button size="sm" variant="ghost" onClick={() => { setRemoving(m.userId); setTyped(''); setRemoveError(null); }}>
                    Remove access
                  </Button>
                )}
              </div>
              {removing === m.userId && (
                <div className="flex flex-col gap-2 rounded-input bg-unfavorable-tint px-3 py-2">
                  <p className="text-[12.5px] text-ink">
                    Removing {target} ends their access to this client’s portal immediately. Type <strong>{target}</strong> to confirm.
                  </p>
                  <label htmlFor={`confirm-${m.userId}`} className="sr-only">
                    Type {target} to confirm
                  </label>
                  <input
                    id={`confirm-${m.userId}`}
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    autoComplete="off"
                    className="h-9 rounded-input border border-border-default bg-surface-card px-2 text-[13px] text-ink"
                  />
                  {removeError && <p role="alert" className="text-[12.5px] text-unfavorable">{removeError}</p>}
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setRemoving(null)}>
                      Keep access
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      loading={pending}
                      disabled={!confirmationMatches(typed, m)}
                      onClick={() => revoke(m.userId)}
                    >
                      Remove access
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
        {access.invites.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[13px]">
            <span className="flex flex-col">
              <span className="text-ink">{i.name ?? i.email}</span>
              <span className={i.expired ? 'text-[12px] text-unfavorable' : 'text-[12px] text-watch'}>
                {i.name ? `${i.email} · ` : ''}
                {i.expired ? `Invite expired ${fmt(i.expiresAt)}` : `Invited ${fmt(i.sentAt)}, not yet accepted`}
              </span>
            </span>
            {canEdit && (
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => cancel(i.id)}>
                Cancel invite
              </Button>
            )}
          </li>
        ))}
      </ul>

      {canEdit && (
        <form onSubmit={invite} className="flex flex-col gap-2" noValidate>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor={`inv-name-${clientId}`} className="text-[12.5px] font-semibold text-ink">
                Name
              </label>
              <input
                id={`inv-name-${clientId}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
                placeholder="Dana Okafor"
                className="h-9 rounded-input border border-border-default bg-surface-card px-2 text-[13px] text-ink"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={`inv-email-${clientId}`} className="text-[12.5px] font-semibold text-ink">
                Email
              </label>
              <input
                id={`inv-email-${clientId}`}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
                placeholder="dana@practice.com"
                className="h-9 rounded-input border border-border-default bg-surface-card px-2 text-[13px] text-ink"
              />
            </div>
          </div>
          {formError && <p role="alert" className="text-[12.5px] text-unfavorable">{formError}</p>}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] text-ink-tertiary">We email a link to set a password. It expires in 72 hours.</span>
            <Button size="sm" type="submit" loading={pending} disabled={!name.trim() || !email.trim()}>
              Send invite
            </Button>
          </div>
          {lastLink && (
            <p className="text-[12px] text-ink-tertiary">
              If the email doesn’t arrive, send them this link yourself:{' '}
              <button
                type="button"
                className="font-semibold text-accent-secondary underline"
                onClick={() => navigator.clipboard?.writeText(lastLink).then(() => toast.success('Invite link copied.'))}
              >
                Copy invite link
              </button>
            </p>
          )}
        </form>
      )}
    </div>
  );
}
