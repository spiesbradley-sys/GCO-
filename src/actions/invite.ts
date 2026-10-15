'use server';

import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { recordDeskAudit } from '@/lib/desk/audit';
import { hashToken } from '@/lib/desk/tokens';
import { hashPassword, validatePasswordStrength } from '@/lib/desk/password';
import { rateLimit, clientKey } from '@/lib/desk/ratelimit';
import { INVITE_UNUSABLE, inviteState, planAccept } from '@/lib/portal/inviteRules';

// Public side of client-portal invites (sent by staff from the desk). The token
// in the link is the only credential: we look it up by hash, and every unusable
// state gets the same message so a link reveals nothing beyond "doesn't work".

export type InviteLookup =
  | { ok: false; error: string }
  | { ok: true; orgName: string; email: string; name: string | null; needsPassword: boolean };

async function findInvite(token: string) {
  if (!token || token.length < 20) return null;
  return prisma.portalInvite.findUnique({ where: { tokenHash: hashToken(token) }, include: { org: { select: { name: true } } } });
}

/** For the accept page: is this link usable, and does the person need to choose a password? */
export async function lookupInvite(token: string): Promise<InviteLookup> {
  const invite = await findInvite(token);
  if (inviteState(invite) !== 'valid' || !invite) return { ok: false, error: INVITE_UNUSABLE };
  const user = await prisma.user.findUnique({ where: { email: invite.email }, select: { passwordHash: true } });
  return { ok: true, orgName: invite.org.name, email: invite.email, name: invite.name, needsPassword: !user?.passwordHash };
}

const acceptSchema = z.object({ token: z.string().min(20), password: z.string().nullable() });

/**
 * Accept: create or reuse the User (by email) and add a client Membership in the
 * invite's org. Returns the email so the page can sign straight in with the
 * password just chosen (or send an existing user to /login).
 */
export async function acceptInvite(input: { token: string; password: string | null }): Promise<
  { ok: false; error: string } | { ok: true; email: string; passwordSet: boolean }
> {
  if (!rateLimit(clientKey('portal-invite'), 20, 10 * 60 * 1000)) {
    return { ok: false, error: 'Too many attempts. Wait a few minutes and try again.' };
  }
  const parsed = acceptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVITE_UNUSABLE };

  const invite = await findInvite(parsed.data.token);
  if (inviteState(invite) !== 'valid' || !invite) return { ok: false, error: INVITE_UNUSABLE };

  const existing = await prisma.user.findUnique({
    where: { email: invite.email },
    select: { id: true, role: true, passwordHash: true },
  });
  const alreadyMember = existing
    ? !!(await prisma.membership.findUnique({ where: { userId_orgId: { userId: existing.id, orgId: invite.orgId } } }))
    : false;
  const plan = planAccept({ existing, alreadyMember, password: parsed.data.password });
  if (!plan.ok) return plan;

  let passwordHash: string | undefined;
  if (plan.setPassword) {
    const weak = validatePasswordStrength(parsed.data.password ?? '');
    if (weak) return { ok: false, error: weak };
    passwordHash = await hashPassword(parsed.data.password as string);
  }

  const userId = await prisma.$transaction(async (tx) => {
    // Claim the invite first so two tabs can't both accept it.
    const claimed = await tx.portalInvite.updateMany({
      where: { id: invite.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { acceptedAt: new Date() },
    });
    if (claimed.count !== 1) return null;

    const user = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: { ...(passwordHash ? { passwordHash } : {}), emailVerified: new Date() },
        })
      : await tx.user.create({
          data: { email: invite.email, name: invite.name, role: 'client', passwordHash, emailVerified: new Date() },
        });
    if (plan.addMembership) await tx.membership.create({ data: { userId: user.id, orgId: invite.orgId, role: 'client' } });
    return user.id;
  });
  if (!userId) return { ok: false, error: INVITE_UNUSABLE };

  await recordAudit({ action: 'member_joined', orgId: invite.orgId, actorId: userId, target: invite.email, metadata: { inviteId: invite.id } });
  await recordDeskAudit({
    action: 'portal.invite_accepted',
    actorEmail: invite.email,
    summary: `${invite.email} accepted their invite to ${invite.org.name}'s client portal`,
  });

  return { ok: true, email: invite.email, passwordSet: plan.setPassword };
}
