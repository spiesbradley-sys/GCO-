'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireDeskUserAction } from '@/lib/desk/auth';
import { recordDeskAudit } from '@/lib/desk/audit';
import { recordAudit } from '@/lib/audit';
import { newToken, hashToken } from '@/lib/desk/tokens';
import { deliverPortalInviteEmail } from '@/lib/desk/email';
import { deskBaseUrl } from '@/lib/desk/url';
import { INVITE_TTL_MS, INTERNAL_ROLES, confirmationMatches, normalizeEmail } from '@/lib/portal/inviteRules';
import type { DeskRole } from '@/desk/roles';

// Link a desk client to its client-portal account (Org). The portal shows a
// client its cycles and financials dashboard through DeskClient.portalOrgId, so
// this link IS the access grant — only controllers and above may change it.

const MANAGERS: DeskRole[] = ['controller', 'management', 'owner'];

type Result = { ok: boolean; error?: string };

export type PortalOrgOption = { id: string; name: string };

/** Client-portal accounts a desk client can be linked to (practices and firms). */
export async function listPortalOrgs(): Promise<PortalOrgOption[]> {
  await requireDeskUserAction();
  return prisma.org.findMany({
    where: { type: { in: ['practice', 'firm'] } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

async function guardManager() {
  const me = await requireDeskUserAction();
  if (!MANAGERS.includes(me.role as DeskRole)) return { me, error: 'Only controllers and management can change portal access.' };
  return { me, error: null };
}

export async function linkPortalOrg(input: { clientId: string; orgId: string | null }): Promise<Result> {
  const { me, error } = await guardManager();
  if (error) return { ok: false, error };
  const client = await prisma.deskClient.findUnique({ where: { id: input.clientId }, select: { id: true, name: true, portalOrgId: true } });
  if (!client) return { ok: false, error: 'Client not found.' };
  if (input.orgId) {
    const org = await prisma.org.findUnique({ where: { id: input.orgId }, select: { id: true } });
    if (!org) return { ok: false, error: 'That portal account no longer exists.' };
  }
  await prisma.deskClient.update({ where: { id: client.id }, data: { portalOrgId: input.orgId, updatedBy: me.id } });
  await recordDeskAudit({
    action: 'portal.link',
    actorId: me.id,
    actorEmail: me.email,
    board: 'clients',
    recordId: client.id,
    summary: input.orgId ? `Linked ${client.name} to a client-portal account` : `Removed ${client.name}'s client-portal link`,
    diff: { portalOrgId: { from: client.portalOrgId, to: input.orgId } },
  });
  revalidatePath('/desk', 'layout');
  return { ok: true };
}

/** Create a portal account named after the client and link it in one step. */
export async function createPortalOrg(input: { clientId: string }): Promise<Result & { orgId?: string }> {
  const { me, error } = await guardManager();
  if (error) return { ok: false, error };
  const client = await prisma.deskClient.findUnique({ where: { id: input.clientId }, select: { id: true, name: true, portalOrgId: true } });
  if (!client) return { ok: false, error: 'Client not found.' };
  if (client.portalOrgId) return { ok: false, error: 'This client already has a portal account.' };

  const base = client.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'client';
  let slug = base;
  for (let i = 2; await prisma.org.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${base}-${i}`;

  const org = await prisma.org.create({ data: { name: client.name, slug, type: 'practice' } });
  await prisma.deskClient.update({ where: { id: client.id }, data: { portalOrgId: org.id, updatedBy: me.id } });
  await recordDeskAudit({
    action: 'portal.create',
    actorId: me.id,
    actorEmail: me.email,
    board: 'clients',
    recordId: client.id,
    summary: `Created a client-portal account for ${client.name}`,
  });
  revalidatePath('/desk', 'layout');
  return { ok: true, orgId: org.id };
}

// ── People with access ───────────────────────────────────────────────────────
// Staff invite a client's people into the linked portal account from the desk.
// The invite email carries a single-use set-password link (/invite?token=…);
// accepting it is src/actions/invite.ts. Every invite, accept and revoke is
// written to both the desk audit and the portal (org) audit.

export type PortalAccess = {
  members: { userId: string; name: string | null; email: string; role: string; since: string }[];
  invites: { id: string; name: string | null; email: string; sentAt: string; expiresAt: string; expired: boolean }[];
};

async function linkedOrg(clientId: string) {
  const client = await prisma.deskClient.findUnique({ where: { id: clientId }, select: { id: true, name: true, portalOrgId: true } });
  if (!client?.portalOrgId) return null;
  const org = await prisma.org.findUnique({ where: { id: client.portalOrgId }, select: { id: true, name: true } });
  return org ? { client, org } : null;
}

/** Who can sign in to this client's portal account, plus invites not yet accepted. */
export async function listPortalAccess(clientId: string): Promise<PortalAccess | null> {
  await requireDeskUserAction();
  const linked = await linkedOrg(clientId);
  if (!linked) return null;
  const [memberships, invites] = await Promise.all([
    prisma.membership.findMany({
      where: { orgId: linked.org.id, user: { role: { notIn: INTERNAL_ROLES } } },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.portalInvite.findMany({
      where: { orgId: linked.org.id, purpose: 'invite', acceptedAt: null, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  const now = Date.now();
  return {
    members: memberships.map((m) => ({
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      since: m.createdAt.toISOString(),
    })),
    invites: invites.map((i) => ({
      id: i.id,
      name: i.name,
      email: i.email,
      sentAt: i.createdAt.toISOString(),
      expiresAt: i.expiresAt.toISOString(),
      expired: i.expiresAt.getTime() <= now,
    })),
  };
}

const inviteSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().trim().min(1, 'Enter their name.').max(120),
  email: z.string().trim().email('Enter a valid email address.').max(254),
});

/** Email a set-password link into the client's portal account. Re-inviting replaces any earlier pending invite. */
export async function invitePortalUser(input: { clientId: string; name: string; email: string }): Promise<Result & { link?: string }> {
  const { me, error } = await guardManager();
  if (error) return { ok: false, error };
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the name and email.' };
  const linked = await linkedOrg(parsed.data.clientId);
  if (!linked) return { ok: false, error: 'Link this client to a portal account first.' };

  const email = normalizeEmail(parsed.data.email);
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    const member = await prisma.membership.findUnique({ where: { userId_orgId: { userId: existing.id, orgId: linked.org.id } } });
    if (member) return { ok: false, error: `${email} already has access to this portal account.` };
  }

  const token = newToken();
  await prisma.$transaction([
    prisma.portalInvite.updateMany({
      where: { orgId: linked.org.id, email, purpose: 'invite', acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.portalInvite.create({
      data: {
        orgId: linked.org.id,
        email,
        name: parsed.data.name,
        tokenHash: hashToken(token),
        invitedBy: me.id,
        invitedByEmail: me.email,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    }),
  ]);

  const link = `${deskBaseUrl()}/invite?token=${token}`;
  await deliverPortalInviteEmail(email, { name: parsed.data.name, orgName: linked.org.name, link });

  await recordDeskAudit({
    action: 'portal.invite',
    actorId: me.id,
    actorEmail: me.email,
    board: 'clients',
    recordId: linked.client.id,
    summary: `Invited ${email} to ${linked.client.name}'s client portal`,
  });
  await recordAudit({ action: 'member_invited', orgId: linked.org.id, target: email, metadata: { by: me.email, via: 'desk' } });

  revalidatePath('/desk', 'layout');
  return { ok: true, link };
}

/** Withdraw a pending invite so its link stops working. */
export async function cancelPortalInvite(input: { clientId: string; inviteId: string }): Promise<Result> {
  const { me, error } = await guardManager();
  if (error) return { ok: false, error };
  const linked = await linkedOrg(input.clientId);
  if (!linked) return { ok: false, error: 'This client isn’t linked to a portal account.' };
  const res = await prisma.portalInvite.updateMany({
    where: { id: input.inviteId, orgId: linked.org.id, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (res.count === 0) return { ok: false, error: 'That invite has already been used or cancelled.' };
  await recordDeskAudit({
    action: 'portal.invite_cancelled',
    actorId: me.id,
    actorEmail: me.email,
    board: 'clients',
    recordId: linked.client.id,
    summary: `Cancelled a pending portal invite for ${linked.client.name}`,
  });
  revalidatePath('/desk', 'layout');
  return { ok: true };
}

/**
 * Remove a person's access to the client's portal account. Requires their name
 * (or email, if unnamed) typed back. Takes effect on their next request: the
 * portal guard re-reads memberships from the DB (src/lib/context.ts).
 */
export async function revokePortalAccess(input: { clientId: string; userId: string; confirm: string }): Promise<Result> {
  const { me, error } = await guardManager();
  if (error) return { ok: false, error };
  const linked = await linkedOrg(input.clientId);
  if (!linked) return { ok: false, error: 'This client isn’t linked to a portal account.' };
  const member = await prisma.membership.findUnique({
    where: { userId_orgId: { userId: input.userId, orgId: linked.org.id } },
    include: { user: { select: { name: true, email: true, role: true } } },
  });
  if (!member || INTERNAL_ROLES.includes(member.user.role)) return { ok: false, error: 'That person doesn’t have access to this account.' };
  if (!confirmationMatches(input.confirm, member.user))
    return { ok: false, error: 'The name you typed doesn’t match. Type it exactly as shown to confirm.' };

  await prisma.membership.delete({ where: { id: member.id } });
  await recordDeskAudit({
    action: 'portal.revoke',
    actorId: me.id,
    actorEmail: me.email,
    board: 'clients',
    recordId: linked.client.id,
    summary: `Removed ${member.user.email}'s access to ${linked.client.name}'s client portal`,
  });
  await recordAudit({
    action: 'member_removed',
    orgId: linked.org.id,
    targetId: input.userId,
    target: member.user.email,
    metadata: { by: me.email, via: 'desk' },
  });
  revalidatePath('/desk', 'layout');
  return { ok: true };
}
