'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/context';
import { cleanBody, loadThread, markRead, postFromClient, type ChatMessage } from '@/lib/chat';

// Portal side of the client ↔ GCO chat. Every call re-resolves the signed-in
// user's active portal account and only touches desk clients linked to it.

async function myClient(clientId: string) {
  const ctx = await requirePermission('chat.use');
  const client = await prisma.deskClient.findFirst({ where: { id: clientId, portalOrgId: ctx.orgId }, select: { id: true, name: true } });
  return { ctx, client };
}

/** Messages for one of my clients; opening (or polling) the thread marks it read. */
export async function getMyChat(clientId: string): Promise<{ ok: true; messages: ChatMessage[] } | { ok: false; error: string }> {
  const { client } = await myClient(clientId);
  if (!client) return { ok: false, error: 'This conversation isn’t available.' };
  await markRead(client.id, 'client');
  return { ok: true, messages: await loadThread(client.id) };
}

export async function sendMyMessage(clientId: string, raw: string): Promise<{ ok: true; messages: ChatMessage[] } | { ok: false; error: string }> {
  const { ctx, client } = await myClient(clientId);
  if (!client) return { ok: false, error: 'This conversation isn’t available.' };
  const body = cleanBody(raw);
  if (!body) return { ok: false, error: 'Type a message first.' };
  await postFromClient({
    clientId: client.id,
    clientName: client.name,
    userId: ctx.user.id,
    authorName: ctx.user.name ?? ctx.user.email ?? 'Client',
    body,
  });
  return { ok: true, messages: await loadThread(client.id) };
}
