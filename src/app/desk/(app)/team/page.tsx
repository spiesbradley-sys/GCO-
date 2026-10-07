import { requireDeskRole } from '@/lib/desk/auth';
import { prisma } from '@/lib/prisma';
import { TeamAdmin } from '@/components/desk/TeamAdmin';
import type { DeskRole } from '@/desk/roles';

export default async function TeamPage() {
  const me = await requireDeskRole(['owner']);

  const [users, invites] = await Promise.all([
    prisma.deskUser.findMany({ orderBy: [{ isActive: 'desc' }, { name: 'asc' }] }),
    prisma.deskInvite.findMany({ where: { acceptedAt: null, revokedAt: null }, orderBy: { createdAt: 'desc' } }),
  ]);

  return (
    <TeamAdmin
      me={me.id}
      users={users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role as DeskRole,
        isActive: u.isActive,
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        hasPassword: !!u.passwordHash,
      }))}
      invites={invites.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role as DeskRole,
        invitedByEmail: i.invitedByEmail,
        expiresAt: i.expiresAt.toISOString(),
        createdAt: i.createdAt.toISOString(),
      }))}
    />
  );
}
