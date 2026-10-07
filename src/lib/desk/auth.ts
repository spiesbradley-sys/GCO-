import 'server-only';
import { redirect } from 'next/navigation';
import type { DeskUser } from '@prisma/client';
import { getDeskSessionUser } from './session';
import type { DeskRole } from '@/desk/roles';

export type { DeskUser };

/** Current desk user or null. Never throws. */
export async function getDeskUser(): Promise<DeskUser | null> {
  return getDeskSessionUser();
}

/** Require a desk session or redirect to the desk login. For pages/layouts. */
export async function requireDeskUser(): Promise<DeskUser> {
  const user = await getDeskUser();
  if (!user) redirect('/desk/login');
  return user;
}

/** Require one of the given roles, or redirect to the desk forbidden page. */
export async function requireDeskRole(roles: DeskRole[]): Promise<DeskUser> {
  const user = await requireDeskUser();
  if (!roles.includes(user.role)) redirect('/desk/403');
  return user;
}

/** For server actions: return the user or throw (no redirect). */
export async function requireDeskUserAction(): Promise<DeskUser> {
  const user = await getDeskUser();
  if (!user) throw new Error('Not signed in to the desk.');
  return user;
}
