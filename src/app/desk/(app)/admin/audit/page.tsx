import { requireDeskRole } from '@/lib/desk/auth';
import { prisma } from '@/lib/prisma';
import { AdminFrame } from '@/components/desk/AdminFrame';
import { cn } from '@/lib/utils';

// Owner: one audit trail across the service desk (desk_audit_log) and the client
// portal (audit_log). Filters are plain query params (?source=desk|portal&q=…)
// so a filtered view is linkable and works without JavaScript.
export const dynamic = 'force-dynamic';

const LIMIT = 300;

const DESK_LABEL: Record<string, string> = {
  login: 'Signed in',
  login_failed: 'Failed sign-in',
  logout: 'Signed out',
  invite_sent: 'Staff invite sent',
  invite_resent: 'Staff invite resent',
  invite_revoked: 'Staff invite revoked',
  invite_accepted: 'Staff invite accepted',
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
  'financials.upload': 'Financials uploaded',
  'portal.link': 'Portal link changed',
  'portal.create': 'Portal account created',
  'portal.invite': 'Portal invite sent',
  'portal.invite_resent': 'Portal link resent',
  'portal.invite_cancelled': 'Portal link cancelled',
  'portal.invite_accepted': 'Portal invite accepted',
  'portal.revoke': 'Portal access removed',
  'portal.reset_sent': 'Portal password reset sent',
  'portal.password_reset': 'Portal password reset',
};

const PORTAL_LABEL: Record<string, string> = {
  login: 'Signed in',
  logout: 'Signed out',
  login_failed: 'Failed sign-in',
  permission_change: 'Access or password change',
  member_invited: 'Invited',
  member_joined: 'Joined',
  member_removed: 'Access removed',
  payment_initiated: 'Payment started',
  payment_succeeded: 'Payment succeeded',
  payment_failed: 'Payment failed',
  document_access: 'Opened a document',
  document_upload: 'Uploaded a document',
  system_link_connected: 'System connected',
  system_link_revoked: 'System disconnected',
  impersonation_start: 'Staff view started',
  impersonation_end: 'Staff view ended',
};

type Row = { id: string; at: Date; source: 'desk' | 'portal'; who: string; action: string; where: string | null; detail: string };

export default async function AdminAuditPage({ searchParams }: { searchParams: { source?: string; q?: string } }) {
  await requireDeskRole(['owner']);
  const source = searchParams.source === 'desk' || searchParams.source === 'portal' ? searchParams.source : 'all';
  const q = (searchParams.q ?? '').trim().toLowerCase();

  const [desk, portal] = await Promise.all([
    source === 'portal' ? [] : prisma.deskAuditLog.findMany({ orderBy: { at: 'desc' }, take: LIMIT }),
    source === 'desk'
      ? []
      : prisma.auditLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: LIMIT,
          include: { actor: { select: { email: true } }, org: { select: { name: true } } },
        }),
  ]);

  let rows: Row[] = [
    ...desk.map((r) => {
      const diff = r.diff as Record<string, unknown> | null;
      const fields = diff ? Object.keys(diff) : [];
      return {
        id: `d-${r.id}`,
        at: r.at,
        source: 'desk' as const,
        who: r.actorEmail ?? '—',
        action: DESK_LABEL[r.action] ?? r.action,
        where: r.board,
        detail: [r.summary, fields.length ? `Fields: ${fields.slice(0, 4).join(', ')}${fields.length > 4 ? '…' : ''}` : null].filter(Boolean).join(' · ') || '—',
      };
    }),
    ...portal.map((r) => ({
      id: `p-${r.id}`,
      at: r.createdAt,
      source: 'portal' as const,
      who: r.actor?.email ?? (r.action === 'login_failed' ? r.target ?? '—' : '—'),
      action: PORTAL_LABEL[r.action] ?? r.action,
      where: r.org?.name ?? null,
      detail: r.target ?? '—',
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  if (q) rows = rows.filter((r) => [r.who, r.action, r.where ?? '', r.detail].some((v) => v.toLowerCase().includes(q)));
  rows = rows.slice(0, LIMIT);

  const tab = (key: string, label: string) => {
    const params = new URLSearchParams();
    if (key !== 'all') params.set('source', key);
    if (q) params.set('q', q);
    const qs = params.toString();
    return (
      <a
        key={key}
        href={`/desk/admin/audit${qs ? `?${qs}` : ''}`}
        aria-current={source === key ? 'page' : undefined}
        className={cn(
          'rounded-pill border px-3 py-1.5 text-[13px] font-semibold',
          source === key ? 'border-accent-primary bg-surface-cream text-ink' : 'border-border-subtle bg-surface-card text-ink-secondary hover:bg-surface-sunken',
        )}
      >
        {label}
      </a>
    );
  };

  return (
    <AdminFrame active="audit">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {tab('all', 'Everything')}
          {tab('desk', 'Service desk')}
          {tab('portal', 'Client portal')}
        </div>
        <form method="get" className="flex items-center gap-2">
          {source !== 'all' && <input type="hidden" name="source" value={source} />}
          <label htmlFor="audit-q" className="sr-only">
            Search the audit log
          </label>
          <input
            id="audit-q"
            name="q"
            defaultValue={searchParams.q ?? ''}
            placeholder="Search person, action or detail"
            className="h-10 w-64 rounded-input border border-border-default bg-surface-card px-3 text-[14px] text-ink"
          />
          <button type="submit" className="h-10 rounded-pill border border-border-default bg-surface-card px-4 font-heading text-[14px] font-semibold text-ink hover:bg-surface-cream">
            Search
          </button>
        </form>
      </div>
      <p className="text-[13px] text-ink-tertiary">
        The most recent {LIMIT} events{source === 'all' ? ' from each source' : ''}, newest first.
      </p>

      <div className="overflow-hidden rounded-card border border-border-subtle bg-surface-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-[13.5px]">
            <thead>
              <tr className="bg-surface-sunken text-left text-[12px] uppercase tracking-header text-ink-tertiary">
                <th className="px-4 py-2.5">When</th>
                <th className="px-4 py-2.5">Where</th>
                <th className="px-4 py-2.5">Who</th>
                <th className="px-4 py-2.5">Action</th>
                <th className="px-4 py-2.5">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-ink-tertiary">
                    {q ? 'Nothing matches that search.' : 'No activity recorded yet.'}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-border-subtle align-top">
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-ink-secondary">
                      {r.at.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-ink-secondary">
                      {r.source === 'desk' ? 'Service desk' : 'Client portal'}
                      {r.where ? <span className="block text-[12.5px] text-ink-tertiary">{r.where}</span> : null}
                    </td>
                    <td className="px-4 py-2.5 text-ink">{r.who}</td>
                    <td className="px-4 py-2.5 font-semibold text-ink">{r.action}</td>
                    <td className="px-4 py-2.5 text-ink-secondary">{r.detail}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminFrame>
  );
}
