'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Role } from '@prisma/client';
import { cn } from '@/lib/utils';
import { can } from '@/lib/rbac';
import { NAV } from './nav';
import { BrandLogo } from './BrandLogo';
import {
  IconMenu,
  IconDocument,
  IconBell,
  IconChevronRight,
} from '@/components/ui/icons';

// 240px left sidebar, white on fog, subtle right border. Collapses to a 64px
// icon rail; becomes an off-canvas sheet under 768px (toggled by the topbar
// menu button via the `mobileOpen` prop). Active item = cream fill + inner 2px
// gold indicator.

function NavGlyph({ name }: { name: string }) {
  // Minimal filled glyphs; swap for a proper icon set later. Kept filled per spec.
  const common = { width: 18, height: 18 };
  switch (name) {
    case 'invoice':
    case 'document':
      return <IconDocument {...common} />;
    case 'message':
      return <IconBell {...common} />;
    default:
      return <IconMenu {...common} />;
  }
}

export function Sidebar({
  role,
  orgName,
  collapsed,
  mobileOpen,
  onCloseMobile,
}: {
  role: Role;
  orgName: string;
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();

  const content = (
    <nav
      className={cn(
        'flex h-full flex-col gap-6 border-r border-border-subtle bg-surface-card py-5',
        collapsed ? 'w-16 px-2' : 'w-60 px-3',
      )}
      aria-label="Primary"
    >
      <div className={cn('flex items-center px-2', collapsed && 'justify-center px-0')}>
        <Link href="/dashboard" aria-label="GCO Partners home" className="flex items-center">
          <BrandLogo compact={collapsed} />
        </Link>
      </div>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto">
        {NAV.map((group) => {
          const items = group.items.filter((i) => can(role, i.permission));
          if (items.length === 0) return null;
          return (
            <div key={group.label} className="flex flex-col gap-1">
              {!collapsed && (
                <p className="px-2 pb-1 text-[13px] font-semibold uppercase tracking-eyebrow text-ink-tertiary">
                  {group.label}
                </p>
              )}
              {items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onCloseMobile}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative flex h-10 items-center gap-3 rounded-input px-3 text-[15px] transition-colors duration-fast ease-standard',
                      collapsed && 'justify-center px-0',
                      active
                        ? 'bg-surface-cream font-semibold text-ink'
                        : 'text-ink-secondary hover:bg-surface-sunken',
                    )}
                  >
                    {active && (
                      <span className="absolute left-1 h-5 w-0.5 rounded-full bg-accent-primary" />
                    )}
                    <NavGlyph name={item.icon} />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>

      {!collapsed && (
        <p className="px-2 text-[12px] text-ink-tertiary">
          <span className="inline-flex items-center gap-1">
            <IconChevronRight width={12} height={12} /> {orgName}
          </span>
        </p>
      )}
    </nav>
  );

  return (
    <>
      {/* Desktop / rail */}
      <div className="hidden md:block">{content}</div>

      {/* Mobile off-canvas sheet */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="h-full">{content}</div>
          <button
            aria-label="Close menu"
            className="flex-1 bg-scrim"
            onClick={onCloseMobile}
          />
        </div>
      )}
    </>
  );
}
