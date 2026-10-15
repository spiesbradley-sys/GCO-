'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireDeskUserAction } from '@/lib/desk/auth';
import { recordDeskAudit } from '@/lib/desk/audit';
import type { DeskRole } from '@/desk/roles';

// Link a desk client to its client-portal account (Org). The portal shows a
// client its cycles and financials dashboard through DeskClient.portalOrgId, so
// this link IS the access grant — only controllers and above may change it.

const MANAGERS: DeskRole[] = ['controller', 'management', 'owner'];

type Result = { ok: boolean; error?: string };

export type PortalOrgOption = { id: string; name: string };

/** Client-portal accounts a desk client can be linked to (practices and firms). */
export async function listPortalOrgs(): Promise<PortalOrgOption[]> {
  await requireDeskUserAction();
  return prisma.org.findMany({
    where: { type: { in: ['practice', 'firm'] } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

async function guardManager() {
  const me = await requireDeskUserAction();
  if (!MANAGERS.includes(me.role as DeskRole)) return { me, error: 'Only controllers and management can change portal access.' };
  return { me, error: null };
}

export async function linkPortalOrg(input: { clientId: string; orgId: string | null }): Promise<Result> {
  const { me, error } = await guardManager();
  if (error) return { ok: false, error };
  const client = await prisma.deskClient.findUnique({ where: { id: input.clientId }, select: { id: true, name: true, portalOrgId: true } });
  if (!client) return { ok: false, error: 'Client not found.' };
  if (input.orgId) {
    const org = await prisma.org.findUnique({ where: { id: input.orgId }, select: { id: true } });
    if (!org) return { ok: false, error: 'That portal account no longer exists.' };
  }
  await prisma.deskClient.update({ where: { id: client.id }, data: { portalOrgId: input.orgId, updatedBy: me.id } });
  await recordDeskAudit({
    action: 'portal.link',
    actorId: me.id,
    actorEmail: me.email,
    board: 'clients',
    recordId: client.id,
    summary: input.orgId ? `Linked ${client.name} to a client-portal account` : `Removed ${client.name}'s client-portal link`,
    diff: { portalOrgId: { from: client.portalOrgId, to: input.orgId } },
  });
  revalidatePath('/desk', 'layout');
  return { ok: true };
}

/** Create a portal account named after the client and link it in one step. */
export async function createPortalOrg(input: { clientId: string }): Promise<Result & { orgId?: string }> {
  const { me, error } = await guardManager();
  if (error) return { ok: false, error };
  const client = await prisma.deskClient.findUnique({ where: { id: input.clientId }, select: { id: true, name: true, portalOrgId: true } });
  if (!client) return { ok: false, error: 'Client not found.' };
  if (client.portalOrgId) return { ok: false, error: 'This client already has a portal account.' };

  const base = client.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'client';
  let slug = base;
  for (let i = 2; await prisma.org.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${base}-${i}`;

  const org = await prisma.org.create({ data: { name: client.name, slug, type: 'practice' } });
  await prisma.deskClient.update({ where: { id: client.id }, data: { portalOrgId: org.id, updatedBy: me.id } });
  await recordDeskAudit({
    action: 'portal.create',
    actorId: me.id,
    actorEmail: me.email,
    board: 'clients',
    recordId: client.id,
    summary: `Created a client-portal account for ${client.name}`,
  });
  revalidatePath('/desk', 'layout');
  return { ok: true, orgId: org.id };
}
