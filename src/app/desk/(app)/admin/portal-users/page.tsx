import { requireDeskRole } from '@/lib/desk/auth';
import { prisma } from '@/lib/prisma';
import { AdminFrame } from '@/components/desk/AdminFrame';
import { PortalUsersAdmin, type PortalUserRow, type PendingLinkRow, type LinkedClientOption } from '@/components/desk/PortalUsersAdmin';
import { INTERNAL_ROLES } from '@/lib/portal/inviteRules';

// Owner: every client-portal login across every client, pending invites and
// reset links, and the actions to invite, reset, and remove access.
export const dynamic = 'force-dynamic';

export default async function AdminPortalUsersPage() {
  await requireDeskRole(['owner']);

  const [users, lastLogins, links, deskClients] = await Promise.all([
    prisma.user.findMany({
      where: { role: { notIn: INTERNAL_ROLES } },
      include: { memberships: { include: { org: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' } } },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
    }),
    prisma.auditLog.groupBy({ by: ['actorId'], where: { action: 'login', actorId: { not: null } }, _max: { createdAt: true } }),
    prisma.portalInvite.findMany({
      where: { acceptedAt: null, revokedAt: null },
      include: { org: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.deskClient.findMany({ select: { id: true, name: true, portalOrgId: true }, orderBy: { name: 'asc' } }),
  ]);

  const lastLoginBy = new Map(lastLogins.map((l) => [l.actorId as string, l._max.createdAt?.toISOString() ?? null]));
  const clientsByOrg = new Map<string, string[]>();
  for (const c of deskClients) if (c.portalOrgId) clientsByOrg.set(c.portalOrgId, [...(clientsByOrg.get(c.portalOrgId) ?? []), c.name]);
  const now = Date.now();

  const rows: PortalUserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    hasPassword: !!u.passwordHash,
    lastLoginAt: lastLoginBy.get(u.id) ?? null,
    accounts: u.memberships.map((m) => ({ orgId: m.org.id, orgName: m.org.name, deskClients: clientsByOrg.get(m.org.id) ?? [] })),
  }));
  const pending: PendingLinkRow[] = links.map((l) => ({
    id: l.id,
    purpose: l.purpose === 'reset' ? 'reset' : 'invite',
    name: l.name,
    email: l.email,
    orgName: l.org.name,
    sentAt: l.createdAt.toISOString(),
    expired: l.expiresAt.getTime() <= now,
  }));
  const linkedClients: LinkedClientOption[] = deskClients
    .filter((c) => c.portalOrgId)
    .map((c) => ({ id: c.id, name: c.name }));

  return (
    <AdminFrame active="portal-users">
      <PortalUsersAdmin users={rows} pending={pending} linkedClients={linkedClients} />
    </AdminFrame>
  );
}
