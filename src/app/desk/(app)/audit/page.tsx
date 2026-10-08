import { requireDeskRole } from '@/lib/desk/auth';
import { prisma } from '@/lib/prisma';

const ACTION_LABEL: Record<string, string> = {
  login: 'Signed in',
  login_failed: 'Failed sign-in',
  logout: 'Signed out',
  invite_sent: 'Invite sent',
  invite_resent: 'Invite resent',
  invite_revoked: 'Invite revoked',
  invite_accepted: 'Invite accepted',
  password_reset: 'Password reset',
  role_changed: 'Role changed',
  deactivated: 'Deactivated user',
  reactivated: 'Reactivated user',
  record_created: 'Created',
  comment_added: 'Commented',
  comment_deleted: 'Comment deleted',
  record_updated: 'Updated',
  record_deleted: 'Deleted',
  intake_link_generated: 'Onboarding link',
  intake_submitted: 'Onboarding submitted',
};

export default async function AuditPage() {
  await requireDeskRole(['owner']);
  const rows = await prisma.deskAuditLog.findMany({ orderBy: { at: 'desc' }, take: 300 });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="eyebrow">Owner</span>
        <h1 className="font-heading text-page-title text-ink">Audit log</h1>
        <p className="max-w-2xl text-[15px] text-ink-secondary">Who did what, and when. The most recent 300 events.</p>
      </div>

      <div className="overflow-hidden rounded-card border border-border-subtle bg-surface-card">
        <div className="overflow-x-auto">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="bg-surface-sunken text-left text-[12px] uppercase tracking-header text-ink-tertiary">
                <th className="px-4 py-2.5">When</th><th className="px-4 py-2.5">Who</th><th className="px-4 py-2.5">Action</th><th className="px-4 py-2.5">Target</th><th className="px-4 py-2.5">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-ink-tertiary">No activity recorded yet.</td></tr>
              ) : (
                rows.map((r) => {
                  const diff = r.diff as Record<string, { from: unknown; to: unknown }> | null;
                  return (
                    <tr key={r.id} className="border-t border-border-subtle align-top">
                      <td className="whitespace-nowrap px-4 py-2.5 tnum text-ink-secondary">{r.at.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="px-4 py-2.5 text-ink">{r.actorEmail ?? '—'}</td>
                      <td className="px-4 py-2.5"><span className="font-semibold text-ink">{ACTION_LABEL[r.action] ?? r.action}</span>{r.board ? <span className="text-ink-tertiary"> · {r.board}</span> : null}</td>
                      <td className="px-4 py-2.5 text-ink-secondary">{r.summary ?? '—'}</td>
                      <td className="px-4 py-2.5 text-ink-tertiary">
                        {diff && Object.keys(diff).length ? (
                          <span className="text-[12.5px]">{Object.keys(diff).slice(0, 4).join(', ')}{Object.keys(diff).length > 4 ? '…' : ''}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
