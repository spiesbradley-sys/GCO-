import 'server-only';
import { prisma } from '@/lib/prisma';
import { deliverDeskNotificationEmail } from '@/lib/desk/email';
import { deskBaseUrl } from '@/lib/desk/url';
import type { BoardKey } from '@/desk/roles';

/**
 * Notify specific desk users of an event: an in-app notification plus an email
 * to the address they were added with. Targets the users given (deduped, the
 * actor removed), so callers only pass people who should legitimately see the
 * row. Active accounts are included whether or not they've set a password yet,
 * so a newly-added teammate still gets emailed. Never throws — notifications
 * must never break the action that triggered them.
 */
export async function notifyUsers(opts: {
  userIds: (string | null | undefined)[];
  excludeUserId?: string;
  kind: string;
  board: BoardKey;
  recordId: string;
  title: string;
  body: string;
  actorEmail?: string | null;
}): Promise<void> {
  try {
    const ids = [...new Set(opts.userIds.filter((x): x is string => Boolean(x)))].filter((id) => id !== opts.excludeUserId);
    if (!ids.length) return;

    const people = await prisma.deskUser.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true, email: true },
    });
    if (!people.length) return;

    const link = `${deskBaseUrl()}/desk/boards/${opts.board}?open=${encodeURIComponent(opts.recordId)}`;

    // In-app first: it must land even if email delivery is unconfigured or fails.
    await prisma.deskNotification
      .createMany({
        data: people.map((p) => ({
          userId: p.id,
          kind: opts.kind,
          board: opts.board,
          recordId: opts.recordId,
          title: opts.title,
          body: opts.body,
          actorEmail: opts.actorEmail ?? null,
        })),
      })
      .catch((err) => console.error('[desk-notify] in-app failed', err));

    await Promise.all(
      people.map((p) =>
        deliverDeskNotificationEmail(p.email, { subject: opts.title, heading: opts.title, intro: opts.body, link }),
      ),
    );
  } catch (err) {
    console.error('[desk-notify] failed', err);
  }
}
