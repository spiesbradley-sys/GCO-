'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireDeskUserAction } from '@/lib/desk/auth';
import { recordDeskAudit, diffRecords } from '@/lib/desk/audit';
import { delegate } from '@/lib/desk/db';
import { BOARDS } from '@/desk/boards';
import { canWriteBoard, type BoardKey } from '@/desk/roles';
import { todayISO } from '@/desk/compute';

type Result = { ok: boolean; error?: string; id?: string };

/** Coerce a patch to valid, typed column values for the board (drops calc/unknown keys). */
function sanitizePatch(board: BoardKey, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of BOARDS[board].fields) {
    if (f.t === 'calc') continue;
    if (!(f.k in patch)) continue;
    const v = patch[f.k];
    switch (f.t) {
      case 'num':
      case 'money': {
        out[f.k] = v === '' || v == null ? null : Math.round(Number(v));
        if (Number.isNaN(out[f.k] as number)) out[f.k] = null;
        break;
      }
      case 'check':
        out[f.k] = Boolean(v);
        break;
      case 'multi':
        out[f.k] = Array.isArray(v) ? v.map(String) : [];
        break;
      default:
        out[f.k] = v === '' || v == null ? null : String(v);
    }
  }
  return out;
}

export async function createRecord(input: { board: BoardKey; extra?: Record<string, unknown> }): Promise<Result> {
  const me = await requireDeskUserAction();
  if (!canWriteBoard(me.role, input.board)) return { ok: false, error: 'You do not have access to create this.' };

  const data: Record<string, unknown> = { name: 'Untitled', createdBy: me.id, updatedBy: me.id, ...sanitizePatch(input.board, input.extra ?? {}) };
  if (input.board === 'deals' && !data.created) data.created = todayISO();

  const row = await delegate(input.board).create({ data });
  await recordDeskAudit({ action: 'record_created', actorId: me.id, actorEmail: me.email, board: input.board, recordId: row.id, summary: row.name });
  revalidatePath('/desk');
  revalidatePath(`/desk/boards/${input.board}`);
  return { ok: true, id: row.id };
}

export async function updateRecord(input: { board: BoardKey; id: string; patch: Record<string, unknown> }): Promise<Result> {
  const me = await requireDeskUserAction();
  if (!canWriteBoard(me.role, input.board)) return { ok: false, error: 'You do not have access to edit this.' };

  const before = await delegate(input.board).findUnique({ where: { id: input.id } });
  if (!before) return { ok: false, error: 'That record no longer exists.' };

  const patch = sanitizePatch(input.board, input.patch);

  // Auto-fill rules (keep the dated trail honest).
  if (input.board === 'queries' && patch.status === 'Resolved' && !before.resolved && !('resolved' in patch)) {
    patch.resolved = todayISO();
  }
  if (input.board === 'deals' && patch.stage === 'Data received' && !before.dataReceived && !('dataReceived' in patch)) {
    patch.dataReceived = todayISO();
  }
  if (input.board === 'deals' && patch.stage === 'LqE finalized' && !before.finalized && !('finalized' in patch)) {
    patch.finalized = todayISO();
  }

  patch.updatedBy = me.id;
  const after = await delegate(input.board).update({ where: { id: input.id }, data: patch });

  const diff = diffRecords(before, after);
  if (Object.keys(diff).length) {
    await recordDeskAudit({ action: 'record_updated', actorId: me.id, actorEmail: me.email, board: input.board, recordId: input.id, summary: after.name, diff });
  }
  revalidatePath('/desk');
  revalidatePath(`/desk/boards/${input.board}`);
  return { ok: true, id: input.id };
}

export async function deleteRecord(input: { board: BoardKey; id: string }): Promise<Result> {
  const me = await requireDeskUserAction();
  if (!canWriteBoard(me.role, input.board)) return { ok: false, error: 'You do not have access to delete this.' };

  const before = await delegate(input.board).findUnique({ where: { id: input.id } });
  if (!before) return { ok: false, error: 'That record no longer exists.' };

  await delegate(input.board).delete({ where: { id: input.id } });
  await recordDeskAudit({ action: 'record_deleted', actorId: me.id, actorEmail: me.email, board: input.board, recordId: input.id, summary: before.name });
  revalidatePath('/desk');
  revalidatePath(`/desk/boards/${input.board}`);
  return { ok: true };
}
