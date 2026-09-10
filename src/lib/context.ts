import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Role } from '@prisma/client';
import { auth } from './auth';
import { getTenantDb } from './tenant';
import { can, type Permission } from './rbac';
import type { SessionMembership } from '@/types/next-auth';

// ─────────────────────────────────────────────────────────────────────────────
// Request context & route guards
//
// These resolve the signed-in user, the ACTIVE tenant (from the context-switcher
// cookie, validated against the user's memberships), and permissions — and they
// redirect BEFORE a protected route renders. Never render-then-error.
// ─────────────────────────────────────────────────────────────────────────────

export const ACTIVE_ORG_COOKIE = 'gco_active_org';

export type TenantContext = {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role: Role;
    memberships: SessionMembership[];
  };
  orgId: string;
  activeOrg: SessionMembership;
  /** Effective role in the active org (platform role wins for GCO staff/admin). */
  effectiveRole: Role;
  /** GCO staff/admin viewing a non-GCO org — surface the persistent gold banner. */
  isImpersonating: boolean;
  /** Tenant-scoped Prisma client — every query is forced to this orgId. */
  db: ReturnType<typeof getTenantDb>;
};

/** Session user or null. Does not redirect. */
export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

/** Require a signed-in user or redirect to /login. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

function effectiveRoleFor(platformRole: Role, membershipRole: Role): Role {
  if (platformRole === 'admin' || platformRole === 'gco_staff') return platformRole;
  return membershipRole;
}

/**
 * Resolve the active tenant context. Redirects to /login if unauthenticated and
 * to /onboarding if the user has no memberships yet. The active org is read from
 * a cookie and MUST match one of the user's memberships — otherwise we fall back
 * to the first membership (never trust the cookie blindly).
 */
export async function requireTenantContext(): Promise<TenantContext> {
  const user = await requireUser();
  const memberships = user.memberships ?? [];
  if (memberships.length === 0) redirect('/onboarding');

  const requested = cookies().get(ACTIVE_ORG_COOKIE)?.value;
  const activeOrg =
    memberships.find((m) => m.orgId === requested) ?? memberships[0];

  const effectiveRole = effectiveRoleFor(user.role, activeOrg.role);
  const isImpersonating =
    (user.role === 'gco_staff' || user.role === 'admin') && activeOrg.orgType !== 'gco';

  return {
    user,
    orgId: activeOrg.orgId,
    activeOrg,
    effectiveRole,
    isImpersonating,
    db: getTenantDb(activeOrg.orgId),
  };
}

/**
 * Require a permission in the active tenant context. Redirects to /403 if the
 * effective role lacks it — resolved before the route body runs.
 */
export async function requirePermission(permission: Permission): Promise<TenantContext> {
  const ctx = await requireTenantContext();
  if (!can(ctx.effectiveRole, permission)) redirect('/403');
  return ctx;
}
