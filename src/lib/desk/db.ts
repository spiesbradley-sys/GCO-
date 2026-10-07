import 'server-only';
import { prisma } from '@/lib/prisma';
import type { BoardKey } from '@/desk/roles';
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
