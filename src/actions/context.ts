'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/context';
import { ACTIVE_ORG_COOKIE } from '@/lib/context';
import { prisma } from '@/lib/prisma';

// Switch the active tenant. Validates that the target org is one the user
// actually belongs to (never trust a client-supplied orgId), sets the cookie,
// and revalidates so every scoped view re-renders under the new tenant.
export async function setActiveOrg(orgId: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };

  // Checked against the DB, not the JWT, so a just-accepted invite is switchable
  // and a revoked membership is not (same rule as requireTenantContext).
  const belongs = await prisma.membership.findUnique({ where: { userId_orgId: { userId: user.id, orgId } }, select: { id: true } });
  if (!belongs) return { ok: false };

  cookies().set(ACTIVE_ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  revalidatePath('/', 'layout');
  return { ok: true };
}
