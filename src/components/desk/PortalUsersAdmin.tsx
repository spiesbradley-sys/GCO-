'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { Pill } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { formatDate } from '@/lib/utils';
import { invitePortalUser } from '@/desk/actions/portal';
import { sendPortalPasswordReset, resendPortalInvite, cancelPortalLink, removePortalMembership } from '@/desk/actions/admin';
import { confirmationMatches, confirmationTarget } from '@/lib/portal/inviteRules';

export type PortalUserRow = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  hasPassword: boolean;
  lastLoginAt: string | null;
  accounts: { orgId: string; orgName: string; deskClients: string[] }[];
};
export type PendingLinkRow = { id: string; purpose: 'invite' | 'reset'; name: string | null; email: string; orgName: string; sentAt: string; expired: boolean };
export type LinkedClientOption = { id: string; name: string };

const inputCls = 'h-10 rounded-input border border-border-default bg-surface-card px-3 text-[14px] text-ink';

export function PortalUsersAdmin({ users, pending, linkedClients }: { users: PortalUserRow[]; pending: PendingLinkRow[]; linkedClients: LinkedClientOption[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pendingTx, start] = useTransition();
  const [q, setQ] = useState('');
  const [clientId, setClientId] = useState(linkedClients[0]?.id ?? '');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [removing, setRemoving] = useState<{ userId: string; orgId: string } | null>(null);
  const [typed, setTyped] = useState('');
  const [removeError, setRemoveError] = useState<string | null>(null);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter((u) =>
      [u.name ?? '', u.email, ...u.accounts.flatMap((a) => [a.orgName, ...a.deskClients])].some((v) => v.toLowerCase().includes(s)),
    );
  }, [q, users]);

  function act(fn: () => Promise<{ ok: boolean; error?: string; link?: string }>, okMsg: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) return toast.error(res.error ?? 'Something went wrong.');
      if (res.link) setLastLink(res.link);
      toast.success(okMsg);
      router.refresh();
    });
  }

  function invite(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    start(async () => {
      const res = await invitePortalUser({ clientId, name, email });
      if (!res.ok) return setFormError(res.error ?? 'Could not send the invite.');
      setLastLink(res.link ?? null);
      toast.success(`Invite sent to ${email.trim().toLowerCase()}.`);
      setName('');
      setEmail('');
      router.refresh();
    });
  }

  function remove(u: PortalUserRow, orgId: string) {
    setRemoveError(null);
    start(async () => {
      const res = await removePortalMembership({ userId: u.id, orgId, confirm: typed });
      if (!res.ok) return setRemoveError(res.error ?? 'Could not remove access.');
      toast.success('Access removed.');
      setRemoving(null);
      setTyped('');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {lastLink && (
        <Banner
          tone="info"
          action={
            <button
              onClick={() => navigator.clipboard?.writeText(lastLink).then(() => toast.success('Link copied.'))}
              className="text-[13px] font-semibold text-accent-secondary"
            >
              Copy link
            </button>
          }
        >
          Link emailed. If it doesn’t arrive, send them this one yourself. It works once and expires in 72 hours.
        </Banner>
      )}

      {/* Invite */}
      <section className="flex flex-col gap-3 rounded-card bg-surface-card p-5 shadow-sm">
        <div>
          <h2 className="font-heading text-card-title text-ink">Invite someone to a client portal</h2>
          <p className="text-[13px] text-ink-tertiary">They get an email with a link to set a password. Only clients linked to a portal account are listed.</p>
        </div>
        {linkedClients.length === 0 ? (
          <p className="text-[14px] text-ink-secondary">No clients are linked to a portal account yet. Link one on the Portal accounts tab first.</p>
        ) : (
          <form onSubmit={invite} className="flex flex-col gap-3" noValidate>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex flex-col gap-1 text-[13px] font-semibold text-ink">
                Client
                <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputCls}>
                  {linkedClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[13px] font-semibold text-ink">
                Name
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dana Okafor" autoComplete="off" className={inputCls} />
              </label>
              <label className="flex flex-col gap-1 text-[13px] font-semibold text-ink">
                Email
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="dana@practice.com" autoComplete="off" className={inputCls} />
              </label>
            </div>
            {formError && <p role="alert" className="text-[13px] text-unfavorable">{formError}</p>}
            <div className="flex justify-end">
              <Button type="submit" loading={pendingTx} disabled={!clientId || !name.trim() || !email.trim()}>
                Send invite
              </Button>
            </div>
          </form>
        )}
      </section>

      {/* People */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-heading text-card-title text-ink">People with portal access · {users.length}</h2>
            <p className="text-[13px] text-ink-tertiary">GCO staff accounts aren’t listed here; manage staff on the Staff tab.</p>
          </div>
          <label className="flex flex-col gap-1 text-[13px] font-semibold text-ink">
            <span className="sr-only">Search people</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or client" className={`${inputCls} w-64`} />
          </label>
        </div>
        <div className="overflow-hidden rounded-card border border-border-subtle bg-surface-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[14px]">
              <thead>
                <tr className="bg-surface-sunken text-left text-[12px] uppercase tracking-header text-ink-tertiary">
                  <th className="px-4 py-2.5 font-semibold">Person</th>
                  <th className="px-4 py-2.5 font-semibold">Client accounts</th>
                  <th className="px-4 py-2.5 font-semibold">Last sign-in</th>
                  <th className="px-4 py-2.5 text-right font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-ink-tertiary">
                      {users.length === 0 ? 'No one has portal access yet. Invite someone above.' : 'No one matches that search.'}
                    </td>
                  </tr>
                ) : (
                  shown.map((u) => (
                    <tr key={u.id} className="border-t border-border-subtle align-top hover:bg-surface-cream">
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-semibold text-ink">{u.name ?? u.email}</span>
                          {u.name && <span className="text-[13px] text-ink-tertiary">{u.email}</span>}
                          <span className="mt-1 flex flex-wrap gap-1">
                            <Pill>{u.role === 'client' ? 'Client' : u.role === 'accountant' ? 'Accountant' : u.role === 'broker' ? 'Broker' : u.role}</Pill>
                            {!u.hasPassword && <Pill>No password set</Pill>}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {u.accounts.length === 0 ? (
                          <span className="text-[13px] text-ink-tertiary">No access</span>
                        ) : (
                          <ul className="flex flex-col gap-2">
                            {u.accounts.map((a) => {
                              const open = removing?.userId === u.id && removing.orgId === a.orgId;
                              const target = confirmationTarget(u);
                              return (
                                <li key={a.orgId} className="flex flex-col gap-1.5">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-ink">{a.orgName}</span>
                                    {a.deskClients.length > 0 && <span className="text-[12.5px] text-ink-tertiary">desk: {a.deskClients.join(', ')}</span>}
                                    {!open && (
                                      <button
                                        onClick={() => {
                                          setRemoving({ userId: u.id, orgId: a.orgId });
                                          setTyped('');
                                          setRemoveError(null);
                                        }}
                                        className="text-[12.5px] font-semibold text-unfavorable hover:underline"
                                      >
                                        Remove
                                      </button>
                                    )}
                                  </div>
                                  {open && (
                                    <div className="flex max-w-md flex-col gap-2 rounded-input bg-unfavorable-tint px-3 py-2">
                                      <p className="text-[12.5px] text-ink">
                                        Removing {target} ends their access to {a.orgName} immediately. Type <strong>{target}</strong> to confirm.
                                      </p>
                                      <label className="sr-only" htmlFor={`rm-${u.id}-${a.orgId}`}>
                                        Type {target} to confirm
                                      </label>
                                      <input
                                        id={`rm-${u.id}-${a.orgId}`}
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
                                        <Button size="sm" variant="destructive" loading={pendingTx} disabled={!confirmationMatches(typed, u)} onClick={() => remove(u, a.orgId)}>
                                          Remove access
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[13px] text-ink-secondary">{u.lastLoginAt ? formatDate(u.lastLoginAt) : 'Never'}</td>
                      <td className="px-4 py-3 text-right">
                        {u.accounts.length > 0 && (
                          <Button size="sm" variant="secondary" disabled={pendingTx} onClick={() => act(() => sendPortalPasswordReset({ userId: u.id }), `Reset link sent to ${u.email}.`)}>
                            Send password reset
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pending links */}
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-card-title text-ink">Pending invites and reset links · {pending.length}</h2>
        {pending.length === 0 ? (
          <p className="text-[14px] text-ink-tertiary">Nothing pending. Every invite and reset link has been used or cancelled.</p>
        ) : (
          <div className="overflow-hidden rounded-card border border-border-subtle bg-surface-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-[14px]">
                <thead>
                  <tr className="bg-surface-sunken text-left text-[12px] uppercase tracking-header text-ink-tertiary">
                    <th className="px-4 py-2.5 font-semibold">Person</th>
                    <th className="px-4 py-2.5 font-semibold">Type</th>
                    <th className="px-4 py-2.5 font-semibold">Account</th>
                    <th className="px-4 py-2.5 font-semibold">Sent</th>
                    <th className="px-4 py-2.5 text-right font-semibold">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((p) => (
                    <tr key={p.id} className="border-t border-border-subtle">
                      <td className="px-4 py-3">
                        <span className="text-ink">{p.name ?? p.email}</span>
                        {p.name && <span className="block text-[13px] text-ink-tertiary">{p.email}</span>}
                      </td>
                      <td className="px-4 py-3 text-ink-secondary">{p.purpose === 'reset' ? 'Password reset' : 'Invite'}</td>
                      <td className="px-4 py-3 text-ink-secondary">{p.orgName}</td>
                      <td className={p.expired ? 'px-4 py-3 text-[13px] text-unfavorable' : 'px-4 py-3 text-[13px] text-ink-secondary'}>
                        {formatDate(p.sentAt)}
                        {p.expired ? ' · expired' : ''}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Button size="sm" variant="ghost" disabled={pendingTx} onClick={() => act(() => resendPortalInvite({ inviteId: p.id }), `New link sent to ${p.email}.`)}>
                          Resend
                        </Button>
                        <Button size="sm" variant="ghost" disabled={pendingTx} onClick={() => act(() => cancelPortalLink({ inviteId: p.id }), 'Link cancelled. It no longer works.')}>
                          Cancel
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
