'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Role } from '@prisma/client';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ImpersonationBanner } from './ImpersonationBanner';
import { ToastProvider } from '@/components/ui/Toast';
import type { SessionMembership } from '@/types/next-auth';

// Client wrapper holding sidebar collapse / mobile-sheet state. Server layout
// resolves the tenant context and passes the resolved, permission-safe props in.
export function AppShell({
  role,
  memberships,
  activeOrgId,
  activeOrgName,
  user,
  isImpersonating,
  children,
}: {
  role: Role;
  memberships: SessionMembership[];
  activeOrgId: string;
  activeOrgName: string;
  user: { name?: string | null; email?: string | null };
  isImpersonating: boolean;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-surface-page">
        <Sidebar
          role={role}
          orgName={activeOrgName}
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          {isImpersonating && <ImpersonationBanner orgName={activeOrgName} />}
          <Topbar
            memberships={memberships}
            activeOrgId={activeOrgId}
            user={user}
            onToggleMobile={() => setMobileOpen((o) => !o)}
            onToggleCollapse={() => setCollapsed((c) => !c)}
          />
          <main className="flex-1 overflow-x-hidden">
            <div className="mx-auto w-full max-w-content px-4 py-6 md:px-8 md:py-8">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
