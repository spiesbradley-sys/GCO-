'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireDeskUserAction } from '@/lib/desk/auth';
import { newToken, hashToken } from '@/lib/desk/tokens';
import { revokeAllSessions } from '@/lib/desk/session';
import { recordDeskAudit } from '@/lib/desk/audit';
import { deliverDeskEmail } from '@/lib/desk/email';
import { DESK_ROLES, type DeskRole } from '@/desk/roles';

type Result = { ok: boolean; error?: string; link?: string };

function baseUrl(): string {
  const h = headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`;
}

async function requireOwner() {
  const me = await requireDeskUserAction();
  if (me.role !== 'owner') throw new Error('Only the owner can manage the team.');
  return me;
}

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['management', 'controller', 'accountant']),
});

export async function inviteUser(input: { email: string; role: DeskRole }): Promise<Result> {
  let me;
  try {
    me = await requireOwner();
  } catch {
    return { ok: false, error: 'Only the owner can invite people.' };
  }
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Enter a valid email and role.' };
  const email = parsed.data.email.toLowerCase().trim();

  const existing = await prisma.deskUser.findUnique({ where: { email } });
  if (existing && existing.isActive && existing.passwordHash) {
    return { ok: false, error: 'That person already has an active desk account.' };
  }

  const token = newToken();
  await prisma.deskInvite.create({
    data: {
      email,
      role: parsed.data.role,
      tokenHash: hashToken(token),
      invitedByEmail: me.email,
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
    },
  });
  const link = `${baseUrl()}/desk/set-password?kind=invite&token=${token}`;
  await deliverDeskEmail(email, 'You are invited to the GCO Service Desk', link);
  await recordDeskAudit({ action: 'invite_sent', actorId: me.id, actorEmail: me.email, summary: `${email} as ${parsed.data.role}` });
  revalidatePath('/desk/team');
  return { ok: true, link };
}

export async function resendInvite(input: { inviteId: string }): Promise<Result> {
  let me;
  try {
    me = await requireOwner();
  } catch {
    return { ok: false, error: 'Only the owner can resend invites.' };
  }
  const invite = await prisma.deskInvite.findUnique({ where: { id: input.inviteId } });
  if (!invite || invite.acceptedAt) return { ok: false, error: 'That invite is no longer pending.' };
  const token = newToken();
  await prisma.deskInvite.update({
    where: { id: invite.id },
    data: { tokenHash: hashToken(token), revokedAt: null, expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000) },
  });
  const link = `${baseUrl()}/desk/set-password?kind=invite&token=${token}`;
  await deliverDeskEmail(invite.email, 'Your GCO Service Desk invite', link);
  await recordDeskAudit({ action: 'invite_resent', actorId: me.id, actorEmail: me.email, summary: invite.email });
  revalidatePath('/desk/team');
  return { ok: true, link };
}

export async function revokeInvite(input: { inviteId: string }): Promise<Result> {
  let me;
  try {
    me = await requireOwner();
  } catch {
    return { ok: false, error: 'Only the owner can revoke invites.' };
  }
  await prisma.deskInvite.update({ where: { id: input.inviteId }, data: { revokedAt: new Date() } });
  await recordDeskAudit({ action: 'invite_revoked', actorId: me.id, actorEmail: me.email, recordId: input.inviteId });
  revalidatePath('/desk/team');
  return { ok: true };
}

export async function changeRole(input: { userId: string; role: DeskRole }): Promise<Result> {
  let me;
  try {
    me = await requireOwner();
  } catch {
    return { ok: false, error: 'Only the owner can change roles.' };
  }
  if (!DESK_ROLES.includes(input.role)) return { ok: false, error: 'Unknown role.' };
  if (input.userId === me.id) return { ok: false, error: 'You cannot change your own role.' };

  const target = await prisma.deskUser.findUnique({ where: { id: input.userId } });
  if (!target) return { ok: false, error: 'User not found.' };
  if (target.role === 'owner' && input.role !== 'owner') {
    const owners = await prisma.deskUser.count({ where: { role: 'owner', isActive: true } });
    if (owners <= 1) return { ok: false, error: 'There must be at least one active owner.' };
  }
  await prisma.deskUser.update({ where: { id: input.userId }, data: { role: input.role } });
  await recordDeskAudit({
    action: 'role_changed',
    actorId: me.id,
    actorEmail: me.email,
    recordId: input.userId,
    summary: `${target.email}: ${target.role} → ${input.role}`,
  });
  revalidatePath('/desk/team');
  return { ok: true };
}

export async function setUserActive(input: { userId: string; active: boolean }): Promise<Result> {
  let me;
  try {
    me = await requireOwner();
  } catch {
    return { ok: false, error: 'Only the owner can deactivate people.' };
  }
  if (input.userId === me.id) return { ok: false, error: 'You cannot deactivate your own account.' };
  const target = await prisma.deskUser.findUnique({ where: { id: input.userId } });
  if (!target) return { ok: false, error: 'User not found.' };
  if (!input.active && target.role === 'owner') {
    const owners = await prisma.deskUser.count({ where: { role: 'owner', isActive: true } });
    if (owners <= 1) return { ok: false, error: 'There must be at least one active owner.' };
  }
  await prisma.deskUser.update({ where: { id: input.userId }, data: { isActive: input.active } });
  if (!input.active) await revokeAllSessions(input.userId); // logout everywhere
  await recordDeskAudit({
    action: input.active ? 'reactivated' : 'deactivated',
    actorId: me.id,
    actorEmail: me.email,
    recordId: input.userId,
    summary: target.email,
  });
  revalidatePath('/desk/team');
  return { ok: true };
}
