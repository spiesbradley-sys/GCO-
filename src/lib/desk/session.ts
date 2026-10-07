import 'server-only';
import { cookies, headers } from 'next/headers';
import type { DeskUser } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { newToken, hashToken } from './tokens';

export const DESK_COOKIE = 'desk_session';
const IDLE_MS = 12 * 60 * 60 * 1000; // 12-hour idle timeout

function clientMeta() {
  const h = headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null;
  const userAgent = h.get('user-agent') || null;
  return { ip, userAgent };
}

/** Create a fresh session and set the cookie. Call from an action/route only. */
export async function createDeskSession(userId: string): Promise<void> {
  const token = newToken();
  const { ip, userAgent } = clientMeta();
  const expiresAt = new Date(Date.now() + IDLE_MS);
  await prisma.deskSession.create({
    data: { userId, tokenHash: hashToken(token), ip, userAgent, expiresAt },
  });
  cookies().set(DESK_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // cookie lifetime; DB expiresAt is the real idle control
  });
}

/**
 * Resolve the current desk user from the session cookie, or null. Enforces idle
 * timeout, revocation, deactivation and password-change invalidation, and slides
 * the idle window on each authenticated request.
 */
export async function getDeskSessionUser(): Promise<DeskUser | null> {
  const token = cookies().get(DESK_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.deskSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.revokedAt) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;

  const user = session.user;
  if (!user.isActive || !user.passwordHash) return null;
  // Logout-everywhere on password change: sessions older than the change are dead.
  if (user.passwordChangedAt && session.createdAt < user.passwordChangedAt) return null;

  // Slide the idle window (DB write is the authority; no cookie re-set needed).
  await prisma.deskSession.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + IDLE_MS) },
  });

  return user;
}

/** Revoke the current session and clear the cookie. */
export async function destroyCurrentDeskSession(): Promise<void> {
  const token = cookies().get(DESK_COOKIE)?.value;
  if (token) {
    await prisma.deskSession.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  cookies().delete(DESK_COOKIE);
}

/** Revoke every active session for a user (deactivate / password change). */
export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.deskSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
