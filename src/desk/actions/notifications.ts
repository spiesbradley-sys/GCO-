'use server';

import { prisma } from '@/lib/prisma';
import { requireDeskUserAction } from '@/lib/desk/auth';

export type NotificationDTO = {
  id: string;
  kind: string;
  board: string;
  recordId: string;
  title: string;
  body: string;
  actorEmail: string | null;
  createdAt: string;
  read: boolean;
};

/** The signed-in user's latest notifications plus their total unread count. */
export async function listNotifications(): Promise<{ items: NotificationDTO[]; unread: number }> {
  const me = await requireDeskUserAction();
  const [rows, unread] = await Promise.all([
    prisma.deskNotification.findMany({ where: { userId: me.id }, orderBy: { createdAt: 'desc' }, take: 30 }),
    prisma.deskNotification.count({ where: { userId: me.id, readAt: null } }),
  ]);
  return {
    unread,
    items: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      board: r.board,
      recordId: r.recordId,
      title: r.title,
      body: r.body,
      actorEmail: r.actorEmail,
      createdAt: r.createdAt.toISOString(),
      read: r.readAt !== null,
    })),
  };
}

/** Mark one notification read. Scoped to the caller, so ids can't touch others'. */
export async function markNotificationRead(input: { id: string }): Promise<{ ok: boolean }> {
  const me = await requireDeskUserAction();
  await prisma.deskNotification.updateMany({ where: { id: input.id, userId: me.id, readAt: null }, data: { readAt: new Date() } });
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<{ ok: boolean }> {
  const me = await requireDeskUserAction();
  await prisma.deskNotification.updateMany({ where: { userId: me.id, readAt: null }, data: { readAt: new Date() } });
  return { ok: true };
}
