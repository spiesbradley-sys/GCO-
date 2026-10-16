'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireDeskUserAction } from '@/lib/desk/auth';
import { recordDeskAudit } from '@/lib/desk/audit';
import { loadAllDeskData } from '@/lib/desk/db';
import { loggableEngagements, MAX_ENTRY_HOURS } from '@/desk/utilization';
import type { DeskRole } from '@/desk/roles';

type Result = { ok: boolean; error?: string };

const logSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hours: z.number().positive().max(MAX_ENTRY_HOURS),
  engagement: z.string().min(1).nullable(),
  billable: z.boolean(),
  note: z.string().max(500).optional(),
});

/** Log the signed-in person's own time. Internal time (no engagement) is
 * always stored as non-billable. */
export async function logTime(input: z.input<typeof logSchema>): Promise<Result> {
  let me;
  try {
    me = await requireDeskUserAction();
  } catch {
    return { ok: false, error: 'Sign in to the desk to log time.' };
  }
  const parsed = logSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: `Enter a date and between 0.25 and ${MAX_ENTRY_HOURS} hours.` };
  const { date, engagement, note } = parsed.data;
  // Quarter-hour precision.
  const hours = Math.round(parsed.data.hours * 4) / 4;
  if (hours <= 0) return { ok: false, error: 'Enter at least 0.25 hours.' };
  if (Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return { ok: false, error: 'Enter a valid date.' };

  if (engagement) {
    const allowed = loggableEngagements(await loadAllDeskData(), { id: me.id, role: me.role as DeskRole });
    if (!allowed.some((e) => e.id === engagement)) return { ok: false, error: 'You can only log time on an active engagement you work on.' };
  }

  const entry = await prisma.deskTimeEntry.create({
    data: { user: me.id, engagement, date, hours, billable: engagement ? parsed.data.billable : false, note: note?.trim() || null, createdBy: me.email },
  });
  await recordDeskAudit({ action: 'time_logged', actorId: me.id, actorEmail: me.email, board: 'time', recordId: entry.id, summary: `${hours}h on ${date}` });
  revalidatePath('/desk/utilization');
  return { ok: true };
}

/** Remove a time entry: your own, or anyone's if you are the owner. */
export async function deleteTimeEntry(input: { id: string }): Promise<Result> {
  let me;
  try {
    me = await requireDeskUserAction();
  } catch {
    return { ok: false, error: 'Sign in to the desk to edit time.' };
  }
  const entry = await prisma.deskTimeEntry.findUnique({ where: { id: input.id } });
  if (!entry) return { ok: false, error: 'That entry no longer exists.' };
  if (entry.user !== me.id && me.role !== 'owner') return { ok: false, error: 'You can only remove your own time.' };
  await prisma.deskTimeEntry.delete({ where: { id: entry.id } });
  await recordDeskAudit({ action: 'time_deleted', actorId: me.id, actorEmail: me.email, board: 'time', recordId: entry.id, summary: `${entry.hours}h on ${entry.date}` });
  revalidatePath('/desk/utilization');
  return { ok: true };
}
