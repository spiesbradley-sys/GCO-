'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireDeskUserAction } from '@/lib/desk/auth';
import { recordDeskAudit } from '@/lib/desk/audit';
import { recordAudit } from '@/lib/audit';
import { newToken, hashToken } from '@/lib/desk/tokens';
import { deliverPortalInviteEmail, deliverPortalResetEmail } from '@/lib/desk/email';
import { deskBaseUrl } from '@/lib/desk/url';
import { INVITE_TTL_MS, INTERNAL_ROLES, confirmationMatches } from '@/lib/portal/inviteRules';

// Owner-only actions behind the desk Admin area (/desk/admin): client-portal
// users across every account. Per-client invite/link actions live in
// src/desk/actions/portal.ts and are reused by the admin screens.

type Result = { ok: boolean; error?: string; link?: string };

async function requireOwner() {
  const me = await requireDeskUserAction();
  if (me.role !== 'owner') throw new Error('Only the owner can use the admin panel.');
  return me;
}

/** Email a single-use link that lets an existing portal user choose a new password. */
export async function sendPortalPasswordReset(input: { userId: string }): Promise<Result> {
  const me = await requireOwner();
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, name: true, role: true, memberships: { select: { orgId: true }, take: 1 } },
  });
  if (!user || INTERNAL_ROLES.includes(user.role)) return { ok: false, error: 'That portal user no longer exists.' };
  const orgId = user.memberships[0]?.orgId;
  if (!orgId) return { ok: false, error: 'This person has no portal access left, so there is nothing to reset. Invite them again instead.' };

  const token = newToken();
  await prisma.$transaction([
    // Only the newest reset link works.
    prisma.portalInvite.updateMany({
      where: { email: user.email, purpose: 'reset', acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.portalInvite.create({
      data: {
        orgId,
        email: user.email,
        name: user.name,
        purpose: 'reset',
        tokenHash: hashToken(token),
        invitedBy: me.id,
        invitedByEmail: me.email,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    }),
  ]);
  const link = `${deskBaseUrl()}/invite?token=${token}`;
  await deliverPortalResetEmail(user.email, { name: user.name, link });
  await recordDeskAudit({ action: 'portal.reset_sent', actorId: me.id, actorEmail: me.email, summary: `Sent a client-portal password reset to ${user.email}` });
  await recordAudit({ action: 'permission_change', orgId, targetId: user.id, target: user.email, metadata: { by: me.email, event: 'password_reset_sent' } });
  revalidatePath('/desk/admin', 'layout');
  return { ok: true, link };
}

/** Send a fresh link for a pending invite (the old link stops working). */
export async function resendPortalInvite(input: { inviteId: string }): Promise<Result> {
  const me = await requireOwner();
  const invite = await prisma.portalInvite.findUnique({ where: { id: input.inviteId }, include: { org: { select: { name: true } } } });
  if (!invite || invite.acceptedAt || invite.revokedAt) return { ok: false, error: 'That invite has already been used or cancelled.' };
  const token = newToken();
  await prisma.portalInvite.update({
    where: { id: invite.id },
    data: { tokenHash: hashToken(token), expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
  });
  const link = `${deskBaseUrl()}/invite?token=${token}`;
  if (invite.purpose === 'reset') await deliverPortalResetEmail(invite.email, { name: invite.name, link });
  else await deliverPortalInviteEmail(invite.email, { name: invite.name, orgName: invite.org.name, link });
  await recordDeskAudit({ action: 'portal.invite_resent', actorId: me.id, actorEmail: me.email, summary: `Resent the ${invite.org.name} portal ${invite.purpose} to ${invite.email}` });
  revalidatePath('/desk/admin', 'layout');
  return { ok: true, link };
}

/** Cancel any pending invite or reset link. */
export async function cancelPortalLink(input: { inviteId: string }): Promise<Result> {
  const me = await requireOwner();
  const res = await prisma.portalInvite.updateMany({
    where: { id: input.inviteId, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (res.count === 0) return { ok: false, error: 'That link has already been used or cancelled.' };
  await recordDeskAudit({ action: 'portal.invite_cancelled', actorId: me.id, actorEmail: me.email, summary: 'Cancelled a pending client-portal link from the admin panel' });
  revalidatePath('/desk/admin', 'layout');
  return { ok: true };
}

/** Remove one person's access to one portal account (typed-name confirmation). */
export async function removePortalMembership(input: { userId: string; orgId: string; confirm: string }): Promise<Result> {
  const me = await requireOwner();
  const member = await prisma.membership.findUnique({
    where: { userId_orgId: { userId: input.userId, orgId: input.orgId } },
    include: { user: { select: { name: true, email: true, role: true } }, org: { select: { name: true } } },
  });
  if (!member || INTERNAL_ROLES.includes(member.user.role)) return { ok: false, error: 'That person doesn’t have access to this account.' };
  if (!confirmationMatches(input.confirm, member.user))
    return { ok: false, error: 'The name you typed doesn’t match. Type it exactly as shown to confirm.' };
  await prisma.membership.delete({ where: { id: member.id } });
  await recordDeskAudit({
    action: 'portal.revoke',
    actorId: me.id,
    actorEmail: me.email,
    summary: `Removed ${member.user.email}'s access to the ${member.org.name} client portal`,
  });
  await recordAudit({ action: 'member_removed', orgId: input.orgId, targetId: input.userId, target: member.user.email, metadata: { by: me.email, via: 'desk-admin' } });
  revalidatePath('/desk/admin', 'layout');
  return { ok: true };
}
