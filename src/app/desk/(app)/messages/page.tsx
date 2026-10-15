import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireDeskUser } from '@/lib/desk/auth';
import { chatClientIdsFor, staffUnreadByClient } from '@/lib/chat';
import { cn } from '@/lib/utils';

// Desk inbox for client chat: every conversation you can see, newest first,
// unread ones flagged. Opening one goes to that client's portal view.
export const dynamic = 'force-dynamic';

export default async function DeskMessagesPage() {
  const me = await requireDeskUser();
  const ids = await chatClientIdsFor({ id: me.id, role: me.role });
  const [clients, unread] = await Promise.all([
    prisma.deskClient.findMany({
      where: { id: { in: ids }, messages: { some: {} } },
      select: { id: true, name: true, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    }),
    staffUnreadByClient(ids),
  ]);
  const rows = clients
    .map((c) => ({ id: c.id, name: c.name, last: c.messages[0], unread: unread.get(c.id) ?? 0 }))
    .sort((a, b) => b.last.createdAt.getTime() - a.last.createdAt.getTime());

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="eyebrow">Clients</span>
        <h1 className="font-heading text-page-title text-ink">Client messages</h1>
        <p className="max-w-2xl text-[15px] text-ink-secondary">
          Conversations with your clients from their portal. You’re emailed and notified for every new message; replies are emailed to the client.
        </p>
      </div>

      <div className="overflow-hidden rounded-card border border-border-subtle bg-surface-card">
        {rows.length === 0 ? (
          <p className="px-6 py-12 text-center text-[14px] text-ink-tertiary">
            No client messages yet. They appear here when a client writes from their portal, or open any client’s portal view and use Messages to start one.
          </p>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/desk/clients/${r.id}/portal/messages`}
                  className="flex items-start gap-4 px-5 py-4 hover:bg-surface-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-secondary"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className={cn('text-[15px] text-ink', r.unread > 0 && 'font-semibold')}>{r.name}</span>
                    <span className="truncate text-[13.5px] text-ink-secondary">
                      {r.last.fromClient ? `${r.last.authorName}: ` : 'You: '}
                      {r.last.body}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[12px] text-ink-tertiary">
                      {r.last.createdAt.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {r.unread > 0 && (
                      <span className="rounded-pill bg-accent-alert px-2 text-[12px] font-semibold leading-5 text-white tabular-nums">{r.unread} new</span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
