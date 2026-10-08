'use server';

import { revalidatePath } from 'next/cache';
import { requireDeskUserAction } from '@/lib/desk/auth';
import { ensureMonthlyCycles } from '@/lib/desk/cycles';
import { canViewAnyDay, type DeskRole } from '@/desk/roles';

type Result = { ok: boolean; error?: string; created?: number };

/** Owner/management: create the current month's cycle for every live managed
 * engagement and backfill any missed months. Idempotent — safe to re-run. */
export async function generateMonthlyCycles(): Promise<Result> {
  const me = await requireDeskUserAction();
  if (!canViewAnyDay(me.role as DeskRole)) return { ok: false, error: 'Only management and owners can generate cycles.' };

  const created = await ensureMonthlyCycles({ id: me.id, email: me.email }, { backfill: true });
  revalidatePath('/desk');
  revalidatePath('/desk/boards/cycles');
  revalidatePath('/desk/my-day');
  return { ok: true, created: created.length };
}
