import { requireTenantContext } from '@/lib/context';
import { AppShell } from '@/components/shell/AppShell';

// Protected app layout. Resolves the signed-in user, the active tenant, and the
// impersonation state BEFORE rendering any page. Unauthenticated users are
// redirected inside requireTenantContext (to /login or /onboarding).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireTenantContext();

  return (
    <AppShell
      role={ctx.effectiveRole}
      memberships={ctx.user.memberships}
      activeOrgId={ctx.orgId}
      activeOrgName={ctx.activeOrg.orgName}
      user={{ name: ctx.user.name, email: ctx.user.email }}
      isImpersonating={ctx.isImpersonating}
    >
      {children}
    </AppShell>
  );
}
