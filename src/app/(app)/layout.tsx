import { requireTenantContext } from '@/lib/context';
import { AppShell } from '@/components/shell/AppShell';
import { can } from '@/lib/rbac';
import { clientUnreadForOrg } from '@/lib/chat';

// Protected app layout. Resolves the signed-in user, the active tenant, and the
// impersonation state BEFORE rendering any page. Unauthenticated users are
// redirected inside requireTenantContext (to /login or /onboarding).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireTenantContext();
  // Unread GCO replies light up Messages in the menu. Never let it take the shell down.
  const chatUnread = can(ctx.effectiveRole, 'chat.use') ? await clientUnreadForOrg(ctx.orgId).catch(() => 0) : 0;

  return (
    <AppShell
      role={ctx.effectiveRole}
      memberships={ctx.user.memberships}
      activeOrgId={ctx.orgId}
      activeOrgName={ctx.activeOrg.orgName}
      user={{ name: ctx.user.name, email: ctx.user.email }}
      isImpersonating={ctx.isImpersonating}
      badges={{ '/chat': chatUnread }}
    >
      {children}
    </AppShell>
  );
}
