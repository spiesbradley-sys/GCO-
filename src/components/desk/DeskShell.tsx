'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn, initials } from '@/lib/utils';
import { ToastProvider } from '@/components/ui/Toast';
import { IconMenu } from '@/components/ui/icons';
import { BrandLogo } from '@/components/shell/BrandLogo';
import { MANAGED_ORDER, BOARDS } from '@/desk/boards';
import { DESK_ROLE_LABEL, canReadBoard, type DeskRole } from '@/desk/roles';
import { deskLogout } from '@/desk/actions/auth';

type Counts = Record<string, number>;

export function DeskShell({
  user,
  counts,
  children,
}: {
  user: { name: string | null; email: string; role: DeskRole };
  counts: Counts;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) => pathname === href;

  async function signOut() {
    await deskLogout();
    router.push('/desk/login');
    router.refresh();
  }

  const rail = (
    <nav className="flex h-full w-60 flex-col gap-5 overflow-y-auto border-r border-border-subtle bg-surface-card px-3 py-5" aria-label="Desk">
      <div className="px-2">
        <Link href="/desk" aria-label="GCO Service Desk home" className="flex flex-col items-start gap-1">
          <BrandLogo />
          <span className="text-[12px] text-ink-tertiary">Service Desk</span>
        </Link>
      </div>

      <Group label="Desk">
        <NavItem href="/desk/my-day" label="My Day" active={isActive('/desk/my-day')} onNav={() => setOpen(false)} />
        <NavItem href="/desk" label="Overview" active={isActive('/desk')} onNav={() => setOpen(false)} />
        <NavItem href="/desk/guide" label="How the desk runs" active={isActive('/desk/guide')} onNav={() => setOpen(false)} />
      </Group>

      <Group label="Managed Accounting">
        {MANAGED_ORDER.map((b) => (
          <NavItem
            key={b}
            href={`/desk/boards/${b}`}
            label={BOARDS[b].short}
            step={BOARDS[b].step}
            count={counts[b]}
            active={isActive(`/desk/boards/${b}`)}
            onNav={() => setOpen(false)}
          />
        ))}
      </Group>

      {canReadBoard(user.role, 'deals') && (
        <Group label="QofE Lite">
          <NavItem href="/desk/boards/deals" label="Deal Pipeline" count={counts.deals} active={isActive('/desk/boards/deals')} onNav={() => setOpen(false)} />
        </Group>
      )}

      {canReadBoard(user.role, 'pnl') && (
        <Group label="Commercials">
          <NavItem href="/desk/recurring" label="Recurring Revenue" active={isActive('/desk/recurring')} onNav={() => setOpen(false)} />
          <NavItem href="/desk/boards/pnl" label="Dental P&L" count={counts.pnl} active={isActive('/desk/boards/pnl')} onNav={() => setOpen(false)} />
        </Group>
      )}

      {user.role === 'owner' && (
        <Group label="Owner">
          <NavItem href="/desk/team" label="Team" active={isActive('/desk/team')} onNav={() => setOpen(false)} />
          <NavItem href="/desk/audit" label="Audit log" active={isActive('/desk/audit')} onNav={() => setOpen(false)} />
        </Group>
      )}

      <div className="mt-auto border-t border-border-subtle px-2 pt-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-primary text-[12px] font-semibold text-white">
            {initials(user.name, user.email)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-ink">{user.name ?? user.email}</p>
            <p className="text-[11px] uppercase tracking-header text-ink-tertiary">{DESK_ROLE_LABEL[user.role]}</p>
          </div>
        </div>
        <button onClick={signOut} className="mt-2 w-full rounded-input px-2 py-1.5 text-left text-[13px] text-ink-secondary hover:bg-surface-sunken">
          Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <ToastProvider>
    <div className="flex min-h-screen bg-surface-page">
      <div className="hidden md:block">{rail}</div>
      {open && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="h-screen">{rail}</div>
          <button aria-label="Close menu" className="flex-1 bg-scrim" onClick={() => setOpen(false)} />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 px-4 py-3 md:hidden">
          <Link href="/desk" aria-label="GCO Service Desk home" className="shrink-0">
            <BrandLogo compact />
          </Link>
          <button onClick={() => setOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded-input border border-border-default bg-surface-card px-3 py-2 text-[13px]">
            <IconMenu width={16} height={16} /> Boards
          </button>
        </div>
        <main className="flex-1 overflow-x-hidden px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-content">{children}</div>
        </main>
      </div>
    </div>
    </ToastProvider>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-eyebrow text-ink-tertiary">{label}</p>
      {children}
    </div>
  );
}

function NavItem({
  href,
  label,
  step,
  count,
  active,
  onNav,
}: {
  href: string;
  label: string;
  step?: number;
  count?: number;
  active: boolean;
  onNav: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNav}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex h-9 items-center gap-2 rounded-input px-2 text-[13.5px] transition-colors duration-fast ease-standard',
        active ? 'bg-surface-cream font-semibold text-ink' : 'text-ink-secondary hover:bg-surface-sunken',
      )}
    >
      {active && <span className="absolute left-0.5 h-5 w-0.5 rounded-full bg-accent-primary" />}
      {step != null && <span className="w-3.5 text-right font-numeric text-[10.5px] text-ink-tertiary">{step}</span>}
      <span className="truncate">{label}</span>
      {count != null && <span className="ml-auto font-numeric text-[11px] text-ink-tertiary">{count}</span>}
    </Link>
  );
}
