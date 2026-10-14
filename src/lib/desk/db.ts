import 'server-only';
import { prisma } from '@/lib/prisma';
import { scopesToAssignedEngagements, type BoardKey, type DeskRole } from '@/desk/roles';
import type { Rec } from '@/desk/compute';
import { enrichRows as enrich } from '@/desk/enrich';

// Board key → Prisma delegate. Field keys == column names, so a patch of field
// values maps straight onto the delegate.
export function delegate(board: BoardKey) {
  const map: Record<BoardKey, unknown> = {
    intake: prisma.deskIntake,
    clients: prisma.deskClient,
    engagements: prisma.deskEngagement,
    cycles: prisma.deskCycle,
    queries: prisma.deskQuery,
    deliverables: prisma.deskDeliverable,
    deals: prisma.deskDeal,
    pnl: prisma.deskPnlRow,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return map[board] as any;
}

function serializeRow(row: Record<string, unknown>): Rec {
  const out: Rec = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = v instanceof Date ? v.toISOString() : v;
  }
  return out;
}

export type DeskUserLite = { id: string; name: string | null; email: string; role: string; isActive: boolean };

export type DeskData = {
  intake: Rec[];
  clients: Rec[];
  engagements: Rec[];
  cycles: Rec[];
  queries: Rec[];
  deliverables: Rec[];
  deals: Rec[];
  pnl: Rec[];
  users: DeskUserLite[];
};

/** Load every board + desk users in one pass (dashboard + rel resolution). */
export async function loadAllDeskData(): Promise<DeskData> {
  const [intake, clients, engagements, cycles, queries, deliverables, deals, pnl, users] =
    await Promise.all([
      prisma.deskIntake.findMany({ orderBy: { name: 'asc' } }),
      prisma.deskClient.findMany({ orderBy: { name: 'asc' } }),
      prisma.deskEngagement.findMany({ orderBy: { name: 'asc' } }),
      prisma.deskCycle.findMany({ orderBy: { name: 'asc' } }),
      prisma.deskQuery.findMany({ orderBy: { name: 'asc' } }),
      prisma.deskDeliverable.findMany({ orderBy: { name: 'asc' } }),
      prisma.deskDeal.findMany({ orderBy: { name: 'asc' } }),
      prisma.deskPnlRow.findMany({ orderBy: { name: 'asc' } }),
      prisma.deskUser.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, email: true, role: true, isActive: true } }),
    ]);
  return {
    intake: intake.map(serializeRow),
    clients: clients.map(serializeRow),
    engagements: engagements.map(serializeRow),
    cycles: cycles.map(serializeRow),
    queries: queries.map(serializeRow),
    deliverables: deliverables.map(serializeRow),
    deals: deals.map(serializeRow),
    pnl: pnl.map(serializeRow),
    users,
  };
}

export type DeskViewer = { id: string; role: DeskRole };

/** An engagement is "assigned" to a user when they are its accountant
 * (the `bookkeeper` column) or its financial controller. */
function isAssignedTo(engagement: Rec, userId: string): boolean {
  return engagement.bookkeeper === userId || engagement.controller === userId;
}

/**
 * Narrow a full DeskData set to what `viewer` is allowed to see. Roles that see
 * the whole desk get the data untouched. An accountant is scoped to the
 * engagements assigned to them and everything that rolls up to those: the
 * client (and its onboarding form), the monthly cycles, and the queries and
 * deliverables filed against those cycles. The commercial boards (QoE pipeline
 * and the P&L) are removed entirely. `users` is always kept so person names
 * resolve in the UI.
 */
export function scopeDeskData(data: DeskData, viewer: DeskViewer): DeskData {
  if (!scopesToAssignedEngagements(viewer.role)) return data;

  const engagements = data.engagements.filter((e) => isAssignedTo(e, viewer.id));
  const engIds = new Set(engagements.map((e) => e.id));
  const clientIds = new Set(engagements.map((e) => e.client).filter(Boolean));
  const clients = data.clients.filter((c) => clientIds.has(c.id));
  const intakeIds = new Set(clients.map((c) => c.intake).filter(Boolean));
  const cycles = data.cycles.filter((cy) => engIds.has(cy.engagement));
  const cycleIds = new Set(cycles.map((cy) => cy.id));

  return {
    intake: data.intake.filter((i) => intakeIds.has(i.id)),
    clients,
    engagements,
    cycles,
    queries: data.queries.filter((q) => cycleIds.has(q.cycle)),
    deliverables: data.deliverables.filter((d) => cycleIds.has(d.cycle)),
    deals: [],
    pnl: [],
    users: data.users,
  };
}

/** Load every board, scoped to what the signed-in desk user may see. */
export async function loadDeskDataForUser(viewer: DeskViewer): Promise<DeskData> {
  return scopeDeskData(await loadAllDeskData(), viewer);
}

/** Per-board record counts for the signed-in user (drives the sidebar). */
export async function deskCountsForUser(viewer: DeskViewer): Promise<Record<BoardKey, number>> {
  const data = await loadDeskDataForUser(viewer);
  return {
    intake: data.intake.length,
    clients: data.clients.length,
    engagements: data.engagements.length,
    cycles: data.cycles.length,
    queries: data.queries.length,
    deliverables: data.deliverables.length,
    deals: data.deals.length,
    pnl: data.pnl.length,
  };
}

/** Write-side guard: is this record within the user's visible scope? Used by
 * the server actions so an accountant can never mutate a record they can't see,
 * even by crafting an id directly. Non-scoped roles always pass. */
export async function canTouchRecord(viewer: DeskViewer, board: BoardKey, recordId: string): Promise<boolean> {
  if (!scopesToAssignedEngagements(viewer.role)) return true;
  const scoped = await loadDeskDataForUser(viewer);
  return (scoped[board] as Rec[]).some((r) => r.id === recordId);
}

/** Write-side guard for child creates: may this user add a child under `parentId`
 * of `parentBoard`? (Accountants may only attach to a parent they can see.) */
export async function canTouchParent(viewer: DeskViewer, parentBoard: BoardKey, parentId: string): Promise<boolean> {
  return canTouchRecord(viewer, parentBoard, parentId);
}

/** Attach server-computed calc fields to a board's rows (never stored). */
export function enrichRows(board: BoardKey, rows: Rec[], data: DeskData): Rec[] {
  return enrich(board, rows, { queries: data.queries });
}

/** Single record, serialized + enriched. */
export async function getRecord(board: BoardKey, id: string, data?: DeskData): Promise<Rec | null> {
  const row = await delegate(board).findUnique({ where: { id } });
  if (!row) return null;
  const all = data ?? (await loadAllDeskData());
  return enrichRows(board, [serializeRow(row)], all)[0];
}
