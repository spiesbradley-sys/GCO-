import { requirePermission } from '@/lib/context';
import { PageHeader } from '@/components/shell/PageHeader';
import { MessagesView, type ThreadItem } from '@/components/features/messages/MessagesView';
import { formatDate } from '@/lib/utils';

export default async function MessagesPage() {
  const ctx = await requirePermission('messages.view');

  // Tenant-guarded threads with their messages.
  const threads = await ctx.db.thread.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        include: { sender: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  const items: ThreadItem[] = threads.map((t) => ({
    id: t.id,
    subject: t.subject,
    unread: t.messages.filter((m) => !m.readAt && m.senderId !== ctx.user.id).length,
    messages: t.messages.map((m) => ({
      id: m.id,
      body: m.body,
      senderName: m.sender.name ?? m.sender.email ?? 'Unknown',
      senderRole: m.senderRole,
      createdAt: formatDate(m.createdAt),
      isOwn: m.senderId === ctx.user.id,
    })),
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Workspace"
        title="Messages"
        description="Talk to your GCO team about the close, documents, or anything on your books."
      />
      <MessagesView threads={items} />
    </div>
  );
}
