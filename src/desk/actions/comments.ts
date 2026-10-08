'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireDeskUserAction } from '@/lib/desk/auth';
import { delegate, canTouchRecord } from '@/lib/desk/db';
import { recordDeskAudit } from '@/lib/desk/audit';
import { deliverCommentEmail } from '@/lib/desk/email';
import { BOARDS } from '@/desk/boards';
import { canReadBoard, scopesToAssignedEngagements, type BoardKey, type DeskRole } from '@/desk/roles';

export type CommentDTO = { id: string; authorId: string; authorEmail: string; body: string; createdAt: string };
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// Roles notified of every new comment (management is not on the list by design).
const NOTIFY_ROLES: DeskRole[] = ['owner', 'controller', 'accountant'];
const MAX_BODY = 4000;

const refSchema = z.object({
  board: z.enum(Object.keys(BOARDS) as [BoardKey, ...BoardKey[]]),
  id: z.string().min(1),
});

/** Can this user read (and so discuss) this row? Same rules as the boards. */
async function canAccess(user: { id: string; role: DeskRole }, board: BoardKey, id: string): Promise<boolean> {
  if (!canReadBoard(user.role, board)) return false;
  if (scopesToAssignedEngagements(user.role)) return canTouchRecord(user, board, id);
  return true;
}

export async function listComments(input: { board: BoardKey; id: string }): Promise<Result<{ comments: CommentDTO[]; viewerId: string }>> {
  const me = await requireDeskUserAction();
  const ref = refSchema.safeParse(input);
  if (!ref.success) return { ok: false, error: 'Unknown record.' };
  if (!(await canAccess({ id: me.id, role: me.role as DeskRole }, ref.data.board, ref.data.id)))
    return { ok: false, error: 'You do not have access to this discussion.' };
  const rows = await prisma.deskComment.findMany({
    where: { board: ref.data.board, recordId: ref.data.id },
    orderBy: { createdAt: 'asc' },
  });
  return {
    ok: true,
    viewerId: me.id,
    comments: rows.map((r) => ({
      id: r.id,
      authorId: r.authorId,
      authorEmail: r.authorEmail,
      body: r.body,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export async function addComment(input: { board: BoardKey; id: string; body: string }): Promise<Result<{ comment: CommentDTO }>> {
  const me = await requireDeskUserAction();
  const role = me.role as DeskRole;
  const ref = refSchema.safeParse(input);
  const body = (input.body ?? '').trim();
  if (!ref.success) return { ok: false, error: 'Unknown record.' };
  if (!body) return { ok: false, error: 'Write something first.' };
  if (body.length > MAX_BODY) return { ok: false, error: `Keep comments under ${MAX_BODY} characters.` };
  const { board, id } = ref.data;
  if (!(await canAccess({ id: me.id, role }, board, id))) return { ok: false, error: 'You do not have access to this discussion.' };

  const record = await delegate(board).findUnique({ where: { id } });
  if (!record) return { ok: false, error: 'That record no longer exists.' };

  const row = await prisma.deskComment.create({
    data: { board, recordId: id, authorId: me.id, authorEmail: me.email, body },
  });
  const recordName = (record.name as string) || 'Untitled';
  await recordDeskAudit({ action: 'comment_added', actorId: me.id, actorEmail: me.email, board, recordId: id, summary: recordName });

  await notifyTeam({ author: { id: me.id, name: me.name ?? me.email }, board, recordId: id, recordName, body });

  return {
    ok: true,
    comment: { id: row.id, authorId: row.authorId, authorEmail: row.authorEmail, body: row.body, createdAt: row.createdAt.toISOString() },
  };
}

export async function deleteComment(input: { commentId: string }): Promise<Result> {
  const me = await requireDeskUserAction();
  const c = await prisma.deskComment.findUnique({ where: { id: input.commentId } });
  if (!c) return { ok: true };
  if (c.authorId !== me.id && me.role !== 'owner') return { ok: false, error: 'You can only delete your own comments.' };
  await prisma.deskComment.delete({ where: { id: c.id } });
  await recordDeskAudit({ action: 'comment_deleted', actorId: me.id, actorEmail: me.email, board: c.board, recordId: c.recordId });
  return { ok: true };
}

/**
 * Email every active owner, controller and accountant (except the author) who is
 * allowed to see the row, so a comment never leaks a row someone can't open: an
 * accountant is only told about rows under their assigned engagements, and P&L
 * comments only reach roles that can read the P&L.
 */
async function notifyTeam(c: {
  author: { id: string; name: string };
  board: BoardKey;
  recordId: string;
  recordName: string;
  body: string;
}) {
  try {
    const people = await prisma.deskUser.findMany({
      where: { isActive: true, role: { in: NOTIFY_ROLES }, NOT: { id: c.author.id }, passwordHash: { not: null } },
      select: { id: true, email: true, role: true },
    });
    const h = headers();
    const base = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host') ?? 'localhost:3000'}`;
    const link = `${base}/desk/boards/${c.board}?open=${encodeURIComponent(c.recordId)}`;
    const eligible: typeof people = [];
    for (const p of people) {
      if (await canAccess({ id: p.id, role: p.role as DeskRole }, c.board, c.recordId)) eligible.push(p);
    }
    await Promise.all(
      eligible.map((p) =>
        deliverCommentEmail(p.email, {
          author: c.author.name,
          boardLabel: BOARDS[c.board].singular,
          recordName: c.recordName,
          body: c.body,
          link,
        }),
      ),
    );
  } catch (err) {
    console.error('[desk-comments] notify failed', err);
  }
}
