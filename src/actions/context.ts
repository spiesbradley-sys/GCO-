'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/context';
import { ACTIVE_ORG_COOKIE } from '@/lib/context';

// Switch the active tenant. Validates that the target org is one the user
// actually belongs to (never trust a client-supplied orgId), sets the cookie,
// and revalidates so every scoped view re-renders under the new tenant.
export async function setActiveOrg(orgId: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };

  const belongs = user.memberships.some((m) => m.orgId === orgId);
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
