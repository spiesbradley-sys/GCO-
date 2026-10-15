import 'server-only';
import { prisma } from '@/lib/prisma';
import { notifyUsers } from '@/lib/desk/notify';
import { deliverPortalMessageEmail } from '@/lib/desk/email';
import { deskBaseUrl } from '@/lib/desk/url';
import { INTERNAL_ROLES } from '@/lib/portal/inviteRules';

// Client ↔ GCO chat, one conversation per desk client. Callers (the portal and
// desk server actions) do the access checks; this module stores messages, keeps
// the per-side read markers, and notifies the other side of every message:
//   client → staff: desk bell + email to the client's assigned accountant and
//                   controller (owners/management if no one is assigned)
//   staff → client: email to everyone with access to the client's portal

export const MAX_MESSAGE = 4000;

export type ChatMessage = { id: string; fromClient: boolean; authorName: string; body: string; createdAt: string };

export async function loadThread(clientId: string): Promise<ChatMessage[]> {
  const rows = await prisma.clientMessage.findMany({ where: { client: clientId }, orderBy: { createdAt: 'asc' }, take: 500 });
  return rows.map((m) => ({ id: m.id, fromClient: m.fromClient, authorName: m.authorName, body: m.body, createdAt: m.createdAt.toISOString() }));
}

export async function markRead(clientId: string, side: 'staff' | 'client'): Promise<void> {
  await prisma.deskClient.update({
    where: { id: clientId },
    data: side === 'staff' ? { chatStaffReadAt: new Date() } : { chatClientReadAt: new Date() },
  });
}

/** Opening a conversation clears that staff member's bell notifications for it. */
export async function clearChatNotifications(deskUserId: string, clientId: string): Promise<void> {
  await prisma.deskNotification
    .updateMany({ where: { userId: deskUserId, kind: 'chat', recordId: clientId, readAt: null }, data: { readAt: new Date() } })
    .catch(() => undefined);
}

/** Clean and bound a message body; null when there's nothing to send. */
export function cleanBody(raw: string): string | null {
  const body = String(raw ?? '').replace(/\r\n/g, '\n').trim();
  if (!body) return null;
  return body.slice(0, MAX_MESSAGE);
}

const preview = (body: string) => (body.length > 280 ? `${body.slice(0, 277)}…` : body);

/** Desk users who should hear about this client's messages. */
async function staffFor(clientId: string): Promise<string[]> {
  const engagements = await prisma.deskEngagement.findMany({ where: { client: clientId }, select: { bookkeeper: true, controller: true } });
  const assigned = engagements.flatMap((e) => [e.bookkeeper, e.controller]).filter((x): x is string => Boolean(x));
  if (assigned.length) return assigned;
  const leads = await prisma.deskUser.findMany({ where: { isActive: true, role: { in: ['owner', 'management'] } }, select: { id: true } });
  return leads.map((u) => u.id);
}

export async function postFromClient(opts: { clientId: string; clientName: string; userId: string; authorName: string; body: string }) {
  const msg = await prisma.clientMessage.create({
    data: { client: opts.clientId, fromClient: true, authorUserId: opts.userId, authorName: opts.authorName, body: opts.body },
  });
  // The sender has obviously read the thread up to their own message.
  await markRead(opts.clientId, 'client');
  await notifyUsers({
    userIds: await staffFor(opts.clientId),
    kind: 'chat',
    board: 'clients',
    recordId: opts.clientId,
    title: `New message from ${opts.clientName}`,
    body: `${opts.authorName}: ${preview(opts.body)}`,
    path: `/desk/clients/${opts.clientId}/portal/messages`,
  });
  return msg;
}

export async function postFromStaff(opts: { clientId: string; portalOrgId: string; deskUserId: string; authorName: string; body: string }) {
  const msg = await prisma.clientMessage.create({
    data: { client: opts.clientId, fromClient: false, authorDeskUserId: opts.deskUserId, authorName: opts.authorName, body: opts.body },
  });
  await markRead(opts.clientId, 'staff');
  try {
    const people = await prisma.membership.findMany({
      where: { orgId: opts.portalOrgId, user: { role: { notIn: INTERNAL_ROLES } } },
      select: { user: { select: { email: true, name: true } } },
    });
    const link = `${deskBaseUrl()}/chat`;
    await Promise.all(
      people.map((p) => deliverPortalMessageEmail(p.user.email, { name: p.user.name, fromName: opts.authorName, preview: preview(opts.body), link })),
    );
  } catch (err) {
    console.error('[chat] client email failed', err);
  }
  return msg;
}

/** Desk clients this staff member may chat with: all of them, or for an
 * accountant only clients of engagements assigned to them (same rule as the desk). */
export async function chatClientIdsFor(viewer: { id: string; role: string }): Promise<string[]> {
  if (viewer.role !== 'accountant') return (await prisma.deskClient.findMany({ select: { id: true } })).map((c) => c.id);
  const engs = await prisma.deskEngagement.findMany({
    where: { OR: [{ bookkeeper: viewer.id }, { controller: viewer.id }], client: { not: null } },
    select: { client: true },
  });
  return [...new Set(engs.map((e) => e.client as string))];
}

/** Unread client messages for staff, per client id (only clients with any). */
export async function staffUnreadByClient(clientIds: string[]): Promise<Map<string, number>> {
  if (!clientIds.length) return new Map();
  const clients = await prisma.deskClient.findMany({ where: { id: { in: clientIds } }, select: { id: true, chatStaffReadAt: true } });
  const out = new Map<string, number>();
  await Promise.all(
    clients.map(async (c) => {
      const n = await prisma.clientMessage.count({
        where: { client: c.id, fromClient: true, ...(c.chatStaffReadAt ? { createdAt: { gt: c.chatStaffReadAt } } : {}) },
      });
      if (n) out.set(c.id, n);
    }),
  );
  return out;
}

/** Unread GCO messages for a portal account (across its linked desk clients). */
export async function clientUnreadForOrg(orgId: string): Promise<number> {
  const clients = await prisma.deskClient.findMany({ where: { portalOrgId: orgId }, select: { id: true, chatClientReadAt: true } });
  let total = 0;
  for (const c of clients) {
    total += await prisma.clientMessage.count({
      where: { client: c.id, fromClient: false, ...(c.chatClientReadAt ? { createdAt: { gt: c.chatClientReadAt } } : {}) },
    });
  }
  return total;
}
