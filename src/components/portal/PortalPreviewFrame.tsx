import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { IconInfo } from '@/components/ui/icons';
import { previewBase, type PreviewClient } from '@/lib/portal/preview';

// Chrome around the desk's client-portal preview: the persistent gold "viewing as
// GCO staff" banner (house style §15), the portal's two sections as tabs, and a
// way back to the client record.
export function PortalPreviewFrame({ client, active, children }: { client: PreviewClient; active: 'cycles' | 'financials'; children: ReactNode }) {
  const base = previewBase(client.id);
  const tabs = [
    { key: 'financials', label: 'CFO dashboard', href: `${base}/financials` },
    { key: 'cycles', label: 'Monthly close', href: `${base}/cycles` },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start gap-3 rounded-card bg-watch-tint px-4 py-3 text-[14px] text-ink">
        <IconInfo width={16} height={16} className="mt-0.5 shrink-0 text-watch" />
        <div className="flex flex-1 flex-col gap-0.5">
          <span>
            Viewing <strong>{client.name}</strong>’s client portal as GCO staff. Read-only: this is exactly what their people see.
          </span>
          <span className="text-[13px] text-ink-secondary">
            {client.portalOrgName
              ? `Linked to the portal account “${client.portalOrgName}”.`
              : 'Not linked to a portal account yet, so no one at the client can see this. Link one and invite people from the client record.'}
          </span>
        </div>
        <Link
          href={`/desk/boards/clients?open=${client.id}`}
          className="shrink-0 text-[13px] font-semibold text-accent-secondary hover:text-accent-primary-hover"
        >
          Back to client record
        </Link>
      </div>

      <nav aria-label="Client portal sections" className="flex gap-2 border-b border-border-subtle">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={active === t.key ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3 pb-2 text-[14px] font-semibold',
              active === t.key ? 'border-accent-primary text-ink' : 'border-transparent text-ink-tertiary hover:text-ink',
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
