'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { setActiveOrg } from '@/actions/context';
import { Popover } from '@/components/table/Popover';
import { IconChevronDown, IconCheck } from '@/components/ui/icons';
import type { SessionMembership } from '@/types/next-auth';

// First-class control. Portal users belong to multiple practices; brokers to
// multiple deals. Always shows the current entity, scopes every data view, and
// re-renders with a brief loading state on change — never silently.
export function ContextSwitcher({
  memberships,
  activeOrgId,
}: {
  memberships: SessionMembership[];
  activeOrgId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [switching, setSwitching] = useState<string | null>(null);
  const active = memberships.find((m) => m.orgId === activeOrgId) ?? memberships[0];

  function choose(orgId: string, close: () => void) {
    if (orgId === activeOrgId) return close();
    setSwitching(orgId);
    startTransition(async () => {
      await setActiveOrg(orgId);
      router.refresh();
      setSwitching(null);
      close();
    });
  }

  return (
    <Popover
      trigger={({ open, toggle }) => (
        <button
          onClick={toggle}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            'flex h-9 items-center gap-2 rounded-input border border-border-default bg-surface-card px-3 text-[14px] font-semibold text-ink',
            'transition-colors duration-fast ease-standard hover:bg-surface-cream',
          )}
        >
          <span className="max-w-[180px] truncate">
            {pending ? 'Switching…' : active?.orgName ?? 'Select'}
          </span>
          <IconChevronDown width={14} height={14} className="text-ink-tertiary" />
        </button>
      )}
    >
      <ContextList
        memberships={memberships}
        activeOrgId={activeOrgId}
        switching={switching}
        onChoose={choose}
      />
    </Popover>
  );
}

function ContextList({
  memberships,
  activeOrgId,
  switching,
  onChoose,
}: {
  memberships: SessionMembership[];
  activeOrgId: string;
  switching: string | null;
  onChoose: (orgId: string, close: () => void) => void;
}) {
  return (
    <ul role="listbox" className="flex flex-col">
      {memberships.map((m) => {
        const isActive = m.orgId === activeOrgId;
        return (
          <li key={m.orgId}>
            <button
              role="option"
              aria-selected={isActive}
              onClick={() => onChoose(m.orgId, () => {})}
              className={cn(
                'flex w-full items-center justify-between gap-3 rounded-input px-3 py-2 text-left text-[14px]',
                'transition-colors duration-fast ease-standard hover:bg-surface-sunken',
                isActive && 'bg-surface-cream',
              )}
            >
              <span className="flex flex-col">
                <span className="font-semibold text-ink">{m.orgName}</span>
                <span className="text-[12px] uppercase tracking-header text-ink-tertiary">
                  {m.orgType}
                </span>
              </span>
              {isActive && <IconCheck width={16} height={16} className="text-accent-primary" />}
              {switching === m.orgId && (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-tertiary border-t-transparent" />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
