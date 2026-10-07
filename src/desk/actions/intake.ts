'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireDeskUserAction } from '@/lib/desk/auth';
import { signPayload, verifyPayload } from '@/lib/desk/tokens';
import { recordDeskAudit } from '@/lib/desk/audit';
import { rateLimit, clientKey } from '@/lib/desk/ratelimit';

type Result = { ok: boolean; error?: string; link?: string };

function baseUrl(): string {
  const h = headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`;
}

/** Desk user generates a per-prospect onboarding link (valid 30 days). */
export async function generateIntakeLink(input: { company?: string; email?: string }): Promise<Result> {
  const me = await requireDeskUserAction();
  const token = signPayload({
    k: 'intake',
    company: input.company ?? '',
    email: input.email ?? '',
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
  });
  await recordDeskAudit({ action: 'intake_link_generated', actorId: me.id, actorEmail: me.email, summary: input.company || input.email || '' });
  return { ok: true, link: `${baseUrl()}/desk/intake/${token}` };
}

// Public submission — token-gated, no desk session. This is the only
// desk-related write reachable without login, and it only writes the intake row.
const submitSchema = z.object({
  token: z.string().min(10),
  name: z.string().trim().min(1).max(200),
  email: z.string().email().optional().or(z.literal('')),
  accounting: z.array(z.string()).optional(),
  payments: z.array(z.string()).optional(),
  access: z.string().optional(),
  goodMonth: z.string().max(5000).optional(),
  structure: z.string().max(5000).optional(),
  clarity: z.string().max(5000).optional(),
  buyJourney: z.string().max(5000).optional(),
  monday: z.string().max(5000).optional(),
  firstWin: z.string().max(5000).optional(),
  tools: z.string().max(5000).optional(),
  extra: z.string().max(5000).optional(),
});

export async function submitIntake(input: z.input<typeof submitSchema>): Promise<Result> {
  if (!rateLimit(clientKey('desk-intake'), 10, 60 * 60 * 1000)) {
    return { ok: false, error: 'Too many submissions. Please try again later.' };
  }
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Please complete the required fields.' };

  const payload = verifyPayload<{ k?: string }>(parsed.data.token);
  if (!payload || payload.k !== 'intake') {
    return { ok: false, error: 'This onboarding link is invalid or has expired. Ask your GCO contact for a new one.' };
  }

  const d = parsed.data;
  const row = await prisma.deskIntake.create({
    data: {
      name: d.name,
      email: d.email || null,
      accounting: d.accounting ?? [],
      payments: d.payments ?? [],
      access: d.access || null,
      goodMonth: d.goodMonth || null,
      structure: d.structure || null,
      clarity: d.clarity || null,
      buyJourney: d.buyJourney || null,
      monday: d.monday || null,
      firstWin: d.firstWin || null,
      tools: d.tools || null,
      extra: d.extra || null,
    },
  });
  await recordDeskAudit({ action: 'intake_submitted', actorEmail: d.email || null, board: 'intake', recordId: row.id, summary: d.name });
  return { ok: true };
}
