'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requirePermission } from '@/lib/context';

const schema = z.object({
  threadId: z.string().min(1),
  body: z.string().trim().min(1).max(5000),
});

// Send a message into a thread. The thread is fetched under the tenant guard, so
// a user can only post into their own org's threads.
export async function sendMessage(input: {
  threadId: string;
  body: string;
}): Promise<{ ok: boolean; error?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Message cannot be empty.' };

  const ctx = await requirePermission('messages.send');

  const thread = await ctx.db.thread.findFirst({ where: { id: parsed.data.threadId } });
  if (!thread) return { ok: false, error: 'Thread not found.' };

  // Message is written on the raw client (it has no orgId of its own; the parent
  // thread is already tenant-verified above).
  const { prisma } = await import('@/lib/prisma');
  await prisma.message.create({
    data: {
      threadId: thread.id,
      senderId: ctx.user.id,
      senderRole: ctx.effectiveRole,
      body: parsed.data.body,
    },
  });

  revalidatePath('/messages');
  return { ok: true };
}
