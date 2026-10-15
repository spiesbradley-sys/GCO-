import { prisma } from '@/lib/prisma';
import { requireClientPreview } from '@/lib/portal/preview';
import { requireDeskUser } from '@/lib/desk/auth';
import { clearChatNotifications, loadThread, markRead } from '@/lib/chat';
import { PortalPreviewFrame } from '@/components/portal/PortalPreviewFrame';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { getStaffChat, sendStaffMessage } from '@/desk/actions/chat';

// Staff side of the client chat, inside the client's portal view so the
// accountant can flip to the CFO dashboard or monthly close the client is asking about.
export const dynamic = 'force-dynamic';

export default async function PreviewMessagesPage({ params }: { params: { id: string } }) {
  const client = await requireClientPreview(params.id);
  const me = await requireDeskUser();
  await markRead(client.id, 'staff');
  await clearChatNotifications(me.id, client.id);
  const [messages, linked] = await Promise.all([
    loadThread(client.id),
    prisma.deskClient.findUnique({ where: { id: client.id }, select: { portalOrgId: true } }),
  ]);
  return (
    <PortalPreviewFrame client={client} active="messages">
      <ChatPanel
        initial={messages}
        side="staff"
        load={getStaffChat.bind(null, client.id)}
        send={sendStaffMessage.bind(null, client.id)}
        emptyText={`No messages with ${client.name} yet. Anything you send is emailed to everyone with access to their portal.`}
        placeholder={`Reply to ${client.name}…`}
        disabledReason={
          linked?.portalOrgId
            ? null
            : 'This client has no portal account yet, so they can’t read replies. Link one and invite them from the client record first.'
        }
      />
    </PortalPreviewFrame>
  );
}
