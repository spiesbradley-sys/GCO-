import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Owner-only Admin area on the service desk: one place for staff logins, client
// portal logins, portal account links, and the combined audit trail.

export type AdminTab = 'staff' | 'portal-users' | 'portal-accounts' | 'audit';

const TABS: { key: AdminTab; label: string; description: string }[] = [
  { key: 'staff', label: 'Staff', description: 'Invite GCO staff to the service desk, set their role, and manage access.' },
  { key: 'portal-users', label: 'Client portal users', description: 'Everyone who can sign in to a client portal, across every client.' },
  { key: 'portal-accounts', label: 'Portal accounts', description: 'Which portal account each desk client is linked to. The link decides who sees what.' },
  { key: 'audit', label: 'Audit log', description: 'Who did what, and when, across the service desk and the client portal.' },
];

export function AdminFrame({ active, children }: { active: AdminTab; children: ReactNode }) {
  const tab = TABS.find((t) => t.key === active)!;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="eyebrow">Owner</span>
        <h1 className="font-heading text-page-title text-ink">Admin</h1>
        <p className="max-w-2xl text-[15px] text-ink-secondary">{tab.description} Only owners can see this area.</p>
      </div>
      <nav aria-label="Admin sections" className="flex flex-wrap gap-x-2 border-b border-border-subtle">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/desk/admin/${t.key}`}
            aria-current={t.key === active ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3 pb-2 text-[14px] font-semibold',
              t.key === active ? 'border-accent-primary text-ink' : 'border-transparent text-ink-tertiary hover:text-ink',
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
