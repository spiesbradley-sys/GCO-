'use server';

import { prisma } from '@/lib/prisma';
import { requireDeskUserAction } from '@/lib/desk/auth';
import { canTouchRecord } from '@/lib/desk/db';
import { cleanBody, clearChatNotifications, loadThread, markRead, postFromStaff, type ChatMessage } from '@/lib/chat';
import type { DeskRole } from '@/desk/roles';

// Desk side of the client ↔ GCO chat. Anyone who can see the client on the desk
// can read and reply (accountants: only clients of engagements assigned to them).

async function visibleClient(clientId: string) {
  const me = await requireDeskUserAction();
  const ok = await canTouchRecord({ id: me.id, role: me.role as DeskRole }, 'clients', clientId);
  const client = ok ? await prisma.deskClient.findUnique({ where: { id: clientId }, select: { id: true, portalOrgId: true } }) : null;
  return { me, client };
}

export async function getStaffChat(clientId: string): Promise<{ ok: true; messages: ChatMessage[] } | { ok: false; error: string }> {
  const { me, client } = await visibleClient(clientId);
  if (!client) return { ok: false, error: 'Client not found.' };
  await markRead(client.id, 'staff');
  await clearChatNotifications(me.id, client.id);
  return { ok: true, messages: await loadThread(client.id) };
}

export async function sendStaffMessage(clientId: string, raw: string): Promise<{ ok: true; messages: ChatMessage[] } | { ok: false; error: string }> {
  const { me, client } = await visibleClient(clientId);
  if (!client) return { ok: false, error: 'Client not found.' };
  if (!client.portalOrgId)
    return { ok: false, error: 'This client has no portal account yet, so they can’t read replies. Link one and invite them from the client record first.' };
  const body = cleanBody(raw);
  if (!body) return { ok: false, error: 'Type a message first.' };
  await postFromStaff({ clientId: client.id, portalOrgId: client.portalOrgId, deskUserId: me.id, authorName: me.name ?? me.email, body });
  return { ok: true, messages: await loadThread(client.id) };
}
