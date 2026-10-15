import { requireDeskRole } from '@/lib/desk/auth';
import { prisma } from '@/lib/prisma';
import { AdminFrame } from '@/components/desk/AdminFrame';
import { PortalAccountsAdmin, type AccountRow } from '@/components/desk/PortalAccountsAdmin';
import { INTERNAL_ROLES } from '@/lib/portal/inviteRules';

// Owner: every desk client and the client-portal account it's linked to, in one
// table, with link / unlink / create and a jump into the staff preview.
export const dynamic = 'force-dynamic';

export default async function AdminPortalAccountsPage() {
  await requireDeskRole(['owner']);

  const [clients, orgs, memberCounts, inviteCounts] = await Promise.all([
    prisma.deskClient.findMany({ select: { id: true, name: true, status: true, whiteLabel: true, portalOrgId: true }, orderBy: { name: 'asc' } }),
    prisma.org.findMany({ where: { type: { in: ['practice', 'firm'] } }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.membership.groupBy({ by: ['orgId'], where: { user: { role: { notIn: INTERNAL_ROLES } } }, _count: { _all: true } }),
    prisma.portalInvite.groupBy({ by: ['orgId'], where: { purpose: 'invite', acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, _count: { _all: true } }),
  ]);

  const members = new Map(memberCounts.map((m) => [m.orgId, m._count._all]));
  const invites = new Map(inviteCounts.map((m) => [m.orgId, m._count._all]));
  const rows: AccountRow[] = clients.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    whiteLabel: c.whiteLabel,
    portalOrgId: c.portalOrgId,
    people: c.portalOrgId ? members.get(c.portalOrgId) ?? 0 : 0,
    pendingInvites: c.portalOrgId ? invites.get(c.portalOrgId) ?? 0 : 0,
  }));

  return (
    <AdminFrame active="portal-accounts">
      <PortalAccountsAdmin rows={rows} orgs={orgs} />
    </AdminFrame>
  );
}
