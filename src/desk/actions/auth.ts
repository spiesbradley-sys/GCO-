'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword, validatePasswordStrength } from '@/lib/desk/password';
import { hashToken } from '@/lib/desk/tokens';
import { createDeskSession, destroyCurrentDeskSession, revokeAllSessions } from '@/lib/desk/session';
import { recordDeskAudit } from '@/lib/desk/audit';
import { rateLimit, clientKey } from '@/lib/desk/ratelimit';
import { deliverDeskEmail } from '@/lib/desk/email';

type Result = { ok: boolean; error?: string; message?: string };

function baseUrl(): string {
  const h = headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`;
}

// ── Login ────────────────────────────────────────────────────────────────────
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function deskLogin(input: { email: string; password: string }): Promise<Result> {
  if (!rateLimit(clientKey('desk-login'), 10, 5 * 60 * 1000)) {
    return { ok: false, error: 'Too many attempts. Wait a few minutes and try again.' };
  }
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Email or password is incorrect.' };
  const email = parsed.data.email.toLowerCase().trim();

  const user = await prisma.deskUser.findUnique({ where: { email } });
  const GENERIC = 'Email or password is incorrect.';
  if (!user || !user.isActive || !user.passwordHash) {
    await recordDeskAudit({ action: 'login_failed', actorEmail: email });
    return { ok: false, error: GENERIC };
  }
  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    await recordDeskAudit({ action: 'login_failed', actorId: user.id, actorEmail: email });
    return { ok: false, error: GENERIC };
  }

  await createDeskSession(user.id); // fresh session on login (rotation)
  await prisma.deskUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await recordDeskAudit({ action: 'login', actorId: user.id, actorEmail: email });
  return { ok: true };
}

export async function deskLogout(): Promise<void> {
  await destroyCurrentDeskSession();
}

// ── Set password (accept invite OR complete a reset) ──────────────────────────
const setPwSchema = z.object({
  kind: z.enum(['invite', 'reset']),
  token: z.string().min(10),
  password: z.string(),
});

export async function deskSetPassword(input: {
  kind: 'invite' | 'reset';
  token: string;
  password: string;
}): Promise<Result> {
  if (!rateLimit(clientKey('desk-setpw'), 20, 10 * 60 * 1000)) {
    return { ok: false, error: 'Too many attempts. Wait a few minutes and try again.' };
  }
  const parsed = setPwSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'This link is invalid.' };

  const strengthError = validatePasswordStrength(parsed.data.password);
  if (strengthError) return { ok: false, error: strengthError };

  const tokenHash = hashToken(parsed.data.token);
  const hash = await hashPassword(parsed.data.password);

  if (parsed.data.kind === 'invite') {
    const invite = await prisma.deskInvite.findUnique({ where: { tokenHash } });
    if (!invite || invite.revokedAt || invite.acceptedAt || invite.expiresAt < new Date()) {
      return { ok: false, error: 'This invite link has expired or already been used.' };
    }
    const email = invite.email.toLowerCase();
    const user = await prisma.deskUser.upsert({
      where: { email },
      update: { passwordHash: hash, passwordChangedAt: new Date(), isActive: true, role: invite.role },
      create: { email, role: invite.role, passwordHash: hash, passwordChangedAt: new Date(), invitedByEmail: invite.invitedByEmail },
    });
    await prisma.deskInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
    await revokeAllSessions(user.id);
    await createDeskSession(user.id);
    await recordDeskAudit({ action: 'invite_accepted', actorId: user.id, actorEmail: email });
    return { ok: true };
  }

  // reset
  const reset = await prisma.deskPasswordReset.findUnique({ where: { tokenHash } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    return { ok: false, error: 'This reset link has expired or already been used.' };
  }
  const user = await prisma.deskUser.update({
    where: { id: reset.userId },
    data: { passwordHash: hash, passwordChangedAt: new Date() },
  });
  await prisma.deskPasswordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } });
  await revokeAllSessions(user.id); // logout everywhere on password change
  await createDeskSession(user.id);
  await recordDeskAudit({ action: 'password_reset', actorId: user.id, actorEmail: user.email });
  return { ok: true };
}

// ── Forgot password ───────────────────────────────────────────────────────────
export async function deskRequestReset(input: { email: string }): Promise<Result> {
  const IDENTICAL = { ok: true, message: 'If that email belongs to an active account, a reset link is on its way.' };
  if (!rateLimit(clientKey('desk-reset'), 5, 10 * 60 * 1000)) return IDENTICAL;

  const email = String(input.email || '').toLowerCase().trim();
  if (!z.string().email().safeParse(email).success) return IDENTICAL;

  const user = await prisma.deskUser.findUnique({ where: { email } });
  if (user && user.isActive && user.passwordHash) {
    const { newToken } = await import('@/lib/desk/tokens');
    const token = newToken();
    await prisma.deskPasswordReset.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    await deliverDeskEmail(email, 'Reset your GCO Service Desk password', `${baseUrl()}/desk/set-password?kind=reset&token=${token}`, 'reset');
  }
  return IDENTICAL;
}
