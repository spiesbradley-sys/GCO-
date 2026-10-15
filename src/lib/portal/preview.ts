import 'server-only';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireDeskUser } from '@/lib/desk/auth';
import { canTouchRecord } from '@/lib/desk/db';
import type { DeskRole } from '@/desk/roles';

// Staff preview of a client's portal, opened from the desk. Read-only, desk-auth
// only: no portal session is created and nothing is impersonated. A staff member
// may preview exactly the clients they can see on the desk (accountants: only
// clients of engagements assigned to them). Call from EVERY preview page — a
// layout doesn't re-run on client-side navigation.

export type PreviewClient = { id: string; name: string; portalOrgName: string | null };

export async function requireClientPreview(clientId: string): Promise<PreviewClient> {
  const me = await requireDeskUser();
  const client = await prisma.deskClient.findUnique({ where: { id: clientId }, select: { id: true, name: true, portalOrgId: true } });
  // Same 404 for "missing" and "not yours" so ids can't be probed.
  if (!client || !(await canTouchRecord({ id: me.id, role: me.role as DeskRole }, 'clients', clientId))) notFound();
  const org = client.portalOrgId
    ? await prisma.org.findUnique({ where: { id: client.portalOrgId }, select: { name: true } })
    : null;
  return { id: client.id, name: client.name, portalOrgName: org?.name ?? null };
}

export const previewBase = (clientId: string) => `/desk/clients/${clientId}/portal`;
