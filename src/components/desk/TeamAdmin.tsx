'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Banner } from '@/components/ui/Banner';
import { Pill } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { fmtDate } from '@/desk/format';
import { DESK_ROLE_LABEL, type DeskRole } from '@/desk/roles';
import { inviteUser, resendInvite, revokeInvite, changeRole, setUserActive } from '@/desk/actions/team';

type UserRow = { id: string; name: string | null; email: string; role: DeskRole; isActive: boolean; lastLoginAt: string | null; hasPassword: boolean };
type InviteRow = { id: string; email: string; role: DeskRole; invitedByEmail: string; expiresAt: string; createdAt: string };

export function TeamAdmin({ me, users, invites }: { me: string; users: UserRow[]; invites: InviteRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [, start] = useTransition();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<DeskRole>('accountant');
  const [lastLink, setLastLink] = useState<string | null>(null);

  function act(fn: () => Promise<{ ok: boolean; error?: string; link?: string }>, okMsg?: string) {
    start(async () => {
      const res = await fn();
      if (res.ok) {
        if (res.link) setLastLink(res.link);
        if (okMsg) toast.success(okMsg);
        router.refresh();
      } else toast.error(res.error ?? 'Something went wrong.');
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="eyebrow">Owner</span>
        <h1 className="font-heading text-page-title text-ink">Team</h1>
        <p className="max-w-2xl text-[15px] text-ink-secondary">Invite GCO staff, set their role, and manage access. Only you can see this screen.</p>
      </div>

      {lastLink && (
        <Banner tone="info" action={<button onClick={() => { navigator.clipboard?.writeText(lastLink); toast.success('Copied.'); }} className="text-[13px] font-semibold text-accent-secondary">Copy</button>}>
          Invite link (also emailed; shown here while email is in dev mode): <span className="break-all font-mono text-[12px]">{lastLink}</span>
        </Banner>
      )}

      {/* Invite */}
      <section className="rounded-card bg-surface-card p-5 shadow-sm">
        <h2 className="mb-3 font-heading text-[16px] font-bold text-ink">Invite a person</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@gcopartners.com" />
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink">Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value as DeskRole)} className="h-10 rounded-input border border-border-default bg-surface-card px-3 text-[15px] text-ink focus:border-accent-secondary focus:outline-none">
              <option value="management">Management</option>
              <option value="controller">Controller</option>
              <option value="accountant">Accountant</option>
            </select>
          </label>
          <Button onClick={() => { if (!email) return toast.error('Enter an email.'); act(() => inviteUser({ email, role }), 'Invite created.'); setEmail(''); }}>
            Send invite
          </Button>
        </div>
      </section>

      {/* Pending invites */}
      <section className="rounded-card bg-surface-card p-5 shadow-sm">
        <h2 className="mb-3 font-heading text-[16px] font-bold text-ink">Pending invites</h2>
        {invites.length === 0 ? (
          <p className="text-[14px] text-ink-tertiary">No invites awaiting acceptance.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border-subtle">
            {invites.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="font-semibold text-ink">{i.email}</span>
                <Pill>{DESK_ROLE_LABEL[i.role]}</Pill>
                <span className="text-[12.5px] text-ink-tertiary">expires {fmtDate(i.expiresAt.slice(0, 10))}</span>
                <span className="flex-1" />
                <Button size="sm" variant="ghost" onClick={() => act(() => resendInvite({ inviteId: i.id }), 'New link generated.')}>Resend</Button>
                <Button size="sm" variant="ghost" onClick={() => act(() => revokeInvite({ inviteId: i.id }), 'Invite revoked.')}>Revoke</Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Users */}
      <section className="rounded-card bg-surface-card p-5 shadow-sm">
        <h2 className="mb-3 font-heading text-[16px] font-bold text-ink">Active &amp; inactive users</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="bg-surface-sunken text-left text-[12px] uppercase tracking-header text-ink-tertiary">
                <th className="px-3 py-2">Person</th><th className="px-3 py-2">Role</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Last login</th><th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-border-subtle">
                  <td className="px-3 py-2">
                    <div className="font-semibold text-ink">{u.name ?? '—'}</div>
                    <div className="text-[12.5px] text-ink-tertiary">{u.email}</div>
                  </td>
                  <td className="px-3 py-2">
                    {u.id === me || u.role === 'owner' ? (
                      <Pill>{DESK_ROLE_LABEL[u.role]}</Pill>
                    ) : (
                      <select defaultValue={u.role} onChange={(e) => act(() => changeRole({ userId: u.id, role: e.target.value as DeskRole }), 'Role updated.')} className="rounded-input border border-border-default bg-surface-card px-2 py-1 text-[13px]">
                        {(['management', 'controller', 'accountant'] as DeskRole[]).map((r) => (
                          <option key={r} value={r}>{DESK_ROLE_LABEL[r]}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {u.isActive ? (
                      <span className="inline-flex items-center gap-1.5 text-[13px] text-favorable"><span className="h-2 w-2 rounded-full bg-favorable" />{u.hasPassword ? 'Active' : 'Invited'}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-tertiary"><span className="h-2 w-2 rounded-full bg-border-default" />Inactive</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[13px] text-ink-secondary">{u.lastLoginAt ? fmtDate(u.lastLoginAt.slice(0, 10)) : '—'}</td>
                  <td className="px-3 py-2 text-right">
                    {u.id !== me && (
                      <Button size="sm" variant="ghost" onClick={() => act(() => setUserActive({ userId: u.id, active: !u.isActive }), u.isActive ? 'Deactivated.' : 'Reactivated.')}>
                        {u.isActive ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
