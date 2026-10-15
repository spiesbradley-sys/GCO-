import Link from 'next/link';
import { requirePermission } from '@/lib/context';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shell/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconBell } from '@/components/ui/icons';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { getMyChat, sendMyMessage } from '@/actions/chat';
import { loadThread, markRead } from '@/lib/chat';
import { cn } from '@/lib/utils';

// Client ↔ GCO chat, client side. One conversation per GCO client linked to the
// active portal account (almost always one; a picker appears if there are more).
export const dynamic = 'force-dynamic';

export default async function ChatPage({ searchParams }: { searchParams: { client?: string } }) {
  const ctx = await requirePermission('chat.use');
  const clients = await prisma.deskClient.findMany({ where: { portalOrgId: ctx.orgId }, select: { id: true, name: true }, orderBy: { name: 'asc' } });

  if (!clients.length) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader eyebrow="Your GCO team" title="Messages" description="Ask your accountant anything about your books or your dashboard." />
        <Card>
          <EmptyState
            icon={<IconBell width={22} height={22} />}
            title="Messages aren’t set up yet"
            body="They open as soon as your GCO engagement is connected to this account."
          />
        </Card>
      </div>
    );
  }

  const client = clients.find((c) => c.id === searchParams.client) ?? clients[0];
  await markRead(client.id, 'client');
  const messages = await loadThread(client.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Your GCO team"
        title="Messages"
        description="Ask your accountant anything about your books or your dashboard. We’re notified the moment you send."
      />
      {clients.length > 1 && (
        <nav aria-label="Business" className="flex flex-wrap gap-2">
          {clients.map((c) => (
            <Link
              key={c.id}
              href={`/chat?client=${c.id}`}
              aria-current={c.id === client.id ? 'page' : undefined}
              className={cn(
                'rounded-pill border px-3 py-1.5 text-[13px] font-semibold',
                c.id === client.id ? 'border-accent-primary bg-surface-cream text-ink' : 'border-border-subtle bg-surface-card text-ink-secondary hover:bg-surface-sunken',
              )}
            >
              {c.name}
            </Link>
          ))}
        </nav>
      )}
      <ChatPanel
        key={client.id}
        initial={messages}
        side="client"
        load={getMyChat.bind(null, client.id)}
        send={sendMyMessage.bind(null, client.id)}
        emptyText="No messages yet. Say hello, or ask about anything on your CFO dashboard or monthly close."
        placeholder="Write a message to your GCO team…"
      />
    </div>
  );
}
