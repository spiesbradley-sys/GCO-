'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requirePermission } from '@/lib/context';
import { recordAudit } from '@/lib/audit';

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const ACCEPTED = ['application/pdf', 'text/csv', 'image/png', 'image/jpeg', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];

const schema = z.object({
  name: z.string().trim().min(1).max(255),
  mimeType: z.string(),
  sizeBytes: z.number().int().positive().max(MAX_BYTES),
  type: z.string().optional(),
  period: z.string().optional(),
});

// Registers a document's METADATA and returns where to upload the bytes.
//
// Real flow (TODO): generate a short-lived, authenticated presigned PUT URL to
// the object store and return it; the browser uploads bytes directly to storage,
// then calls a confirm action. Bytes never pass through this server, and we never
// expose an unauthenticated preview URL. For now this creates the row with a
// placeholder storageKey.
export async function registerDocument(input: {
  name: string;
  mimeType: string;
  sizeBytes: number;
  type?: string;
  period?: string;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'That file is invalid or over 25 MB.' };
  }
  if (!ACCEPTED.includes(parsed.data.mimeType)) {
    return { ok: false, error: 'That file type isn’t accepted. Use PDF, CSV, XLSX, or an image.' };
  }

  const ctx = await requirePermission('documents.upload');

  const doc = await ctx.db.document.create({
    data: {
      // orgId is also enforced by the tenant client at runtime; passed here so
      // the compile-time Prisma type is satisfied (query extensions don't change
      // input types).
      orgId: ctx.orgId,
      name: parsed.data.name,
      mimeType: parsed.data.mimeType,
      sizeBytes: parsed.data.sizeBytes,
      type: parsed.data.type,
      period: parsed.data.period,
      uploadedById: ctx.user.id,
      status: 'received',
      // TODO: replace with the real object-store key once presigned upload lands.
      storageKey: `pending/${ctx.orgId}/${crypto.randomUUID()}`,
    },
  });

  await recordAudit({
    action: 'document_upload',
    orgId: ctx.orgId,
    actorId: ctx.user.id,
    // Do NOT put the document name or a client identifier anywhere that leaves
    // the app — the audit log is internal, so the id is fine here.
    targetId: doc.id,
    metadata: { sizeBytes: parsed.data.sizeBytes, mimeType: parsed.data.mimeType },
  });

  revalidatePath('/documents');
  return { ok: true, id: doc.id };
}
