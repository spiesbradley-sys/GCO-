'use client';

import { cn } from '@/lib/utils';
import { initials } from '@/lib/utils';
import { ContextSwitcher } from './ContextSwitcher';
import { Popover } from '@/components/table/Popover';
import { IconMenu, IconSearch, IconBell } from '@/components/ui/icons';
import type { SessionMembership } from '@/types/next-auth';

// 64px topbar: menu (mobile) + page title left, context switcher beside it,
// search, notifications, avatar menu right.
export function Topbar({
  memberships,
  activeOrgId,
  user,
  onToggleMobile,
  onToggleCollapse,
}: {
  memberships: SessionMembership[];
  activeOrgId: string;
  user: { name?: string | null; email?: string | null };
  onToggleMobile: () => void;
  onToggleCollapse: () => void;
}) {
  return (
    <header className="flex h-16 items-center gap-3 border-b border-border-subtle bg-surface-card px-4 md:px-6">
      <button
        onClick={onToggleMobile}
        aria-label="Open menu"
        className="rounded-input p-2 text-ink-secondary hover:bg-surface-sunken md:hidden"
      >
        <IconMenu width={20} height={20} />
      </button>
      <button
        onClick={onToggleCollapse}
        aria-label="Toggle sidebar"
        className="hidden rounded-input p-2 text-ink-secondary hover:bg-surface-sunken md:inline-flex"
      >
        <IconMenu width={20} height={20} />
      </button>

      <ContextSwitcher memberships={memberships} activeOrgId={activeOrgId} />

      <div className="ml-auto flex items-center gap-1.5">
        <label className="relative hidden items-center sm:flex">
          <span className="pointer-events-none absolute left-2.5 text-ink-tertiary">
            <IconSearch width={16} height={16} />
          </span>
          <input
            type="search"
            placeholder="Search"
            aria-label="Search"
            className="h-9 w-48 rounded-input border border-border-default bg-surface-card pl-8 pr-3 text-[14px] text-ink placeholder:text-ink-tertiary focus:outline-none focus-visible:border-accent-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-secondary"
          />
        </label>

        <button
          aria-label="Notifications"
          className="rounded-input p-2 text-ink-secondary hover:bg-surface-sunken"
        >
          <IconBell width={18} height={18} />
        </button>

        <Popover
          align="right"
          trigger={({ toggle }) => (
            <button
              onClick={toggle}
              aria-label="Account menu"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-primary text-[13px] font-semibold text-white"
            >
              {initials(user.name, user.email)}
            </button>
          )}
        >
          <div className="flex flex-col">
            <div className="border-b border-border-subtle px-3 py-2">
              <p className="text-[14px] font-semibold text-ink">{user.name ?? 'Account'}</p>
              <p className="truncate text-[13px] text-ink-tertiary">{user.email}</p>
            </div>
            <MenuLink href="/settings">Settings</MenuLink>
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="w-full rounded-input px-3 py-2 text-left text-[14px] text-ink hover:bg-surface-sunken"
              >
                Sign out
              </button>
            </form>
          </div>
        </Popover>
      </div>
    </header>
  );
}

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className={cn('rounded-input px-3 py-2 text-[14px] text-ink hover:bg-surface-sunken')}
    >
      {children}
    </a>
  );
}
