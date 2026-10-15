import 'server-only';
import { prisma } from '@/lib/prisma';
import type { TenantContext } from '@/lib/context';
import type { FinancialsData } from '@/desk/financials/types';

// ─────────────────────────────────────────────────────────────────────────────
// Client-portal view of the service desk
//
// The desk tables have no orgId, so they can't go through getTenantDb. Instead
// every read here starts from DeskClient.portalOrgId = ctx.orgId (the active,
// membership-validated tenant) and only walks DOWN from those clients — a cycle
// id from the URL is only honoured if it resolves back to one of them.
//
// GCO staff previewing a client from the desk use a { deskClientId } scope
// instead; the desk route checks that staff member can see that client first.
//
// Only client-safe fields leave this module: no internal notes, people, review
// checkboxes, internal questions or parser warnings.
// ─────────────────────────────────────────────────────────────────────────────

/** Query types a client is asked about. "Internal question" never leaves the desk. */
const CLIENT_QUERY_TYPES = ['Client query', 'Missing documentation', 'Access issue', 'Bank feed disconnected'];

export type PortalStep = { key: string; label: string; state: 'done' | 'current' | 'upcoming' };

/** The desk's eight stages, folded into five steps a client understands. */
export function clientSteps(stage: string | null): PortalStep[] {
  const steps = [
    { key: 'close', label: 'Month closes', stages: ['Awaiting Close'] },
    { key: 'books', label: 'Books updated', stages: ['Capture', 'Reconciliation'] },
    { key: 'review', label: 'GCO review', stages: ['Review', 'Dashboard Prep'] },
    { key: 'delivered', label: 'Delivered', stages: [] },
    // Once delivered, the step in play is the review meeting.
    { key: 'meeting', label: 'Review meeting', stages: ['Delivered', 'Meeting Held', 'Closed'] },
  ];
  const at = Math.max(0, steps.findIndex((s) => s.stages.includes(stage ?? 'Awaiting Close')));
  const finished = stage === 'Meeting Held' || stage === 'Closed';
  return steps.map((s, i) => ({
    key: s.key,
    label: s.label,
    state: i < at || (finished && i === at) ? 'done' : i === at ? 'current' : 'upcoming',
  }));
}

export type PortalCycleSummary = {
  id: string;
  period: string | null;
  periodLabel: string;
  engagement: string;
  service: string | null;
  stage: string | null;
  steps: PortalStep[];
  closeDate: string | null;
  delivered: string | null;
  meeting: string | null;
  openRequests: number;
  hasFinancials: boolean;
};

export type PortalCycleDetail = PortalCycleSummary & {
  requests: { id: string; title: string; type: string | null; status: string | null; raised: string | null; resolved: string | null; details: string | null }[];
};

function monthLabel(period: string | null, fallback: string): string {
  if (!period || !/^\d{4}-\d{2}/.test(period)) return fallback;
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

const isOpen = (status: string | null) => status !== 'Resolved';

/** Whose portal: a signed-in client's tenant (TenantContext fits), or one desk client for a staff preview. */
export type PortalScope = { orgId: string } | { deskClientId: string };

async function clientEngagements(scope: PortalScope) {
  const clients = await prisma.deskClient.findMany({
    where: 'orgId' in scope ? { portalOrgId: scope.orgId } : { id: scope.deskClientId },
    select: { id: true },
  });
  if (!clients.length) return [];
  return prisma.deskEngagement.findMany({
    where: { client: { in: clients.map((c) => c.id) } },
    select: { id: true, name: true, service: true },
  });
}

/** Is this org linked to any desk client at all? (Drives the empty state copy.) */
export async function isLinkedToDesk(ctx: TenantContext): Promise<boolean> {
  return (await prisma.deskClient.count({ where: { portalOrgId: ctx.orgId } })) > 0;
}

export async function listPortalCycles(scope: PortalScope): Promise<PortalCycleSummary[]> {
  const engagements = await clientEngagements(scope);
  if (!engagements.length) return [];
  const byId = new Map(engagements.map((e) => [e.id, e]));
  const cycles = await prisma.deskCycle.findMany({
    where: { engagement: { in: [...byId.keys()] } },
    select: {
      id: true, name: true, engagement: true, period: true, stage: true, slaDue: true, delivered: true, meeting: true,
      queries: { select: { type: true, status: true } },
      financials: { select: { id: true }, take: 1 },
    },
  });
  return cycles
    .map((c) => {
      const eng = byId.get(c.engagement as string)!;
      return {
        id: c.id,
        period: c.period,
        periodLabel: monthLabel(c.period, c.name),
        engagement: eng.name,
        service: eng.service,
        stage: c.stage,
        steps: clientSteps(c.stage),
        closeDate: c.slaDue,
        delivered: c.delivered,
        meeting: c.meeting,
        openRequests: c.queries.filter((q) => CLIENT_QUERY_TYPES.includes(q.type ?? '') && isOpen(q.status)).length,
        // Live as soon as the accountant uploads the workbook on the desk.
        hasFinancials: c.financials.length > 0,
      };
    })
    .sort((a, b) => (b.period ?? '').localeCompare(a.period ?? ''));
}

export async function getPortalCycle(scope: PortalScope, cycleId: string): Promise<PortalCycleDetail | null> {
  const summaries = await listPortalCycles(scope);
  const summary = summaries.find((s) => s.id === cycleId);
  if (!summary) return null; // not this tenant's, or doesn't exist — same answer

  const queries = await prisma.deskQuery.findMany({
    where: { cycle: cycleId, type: { in: CLIENT_QUERY_TYPES } },
    select: { id: true, name: true, type: true, status: true, raised: true, resolved: true, details: true },
    orderBy: { raised: 'desc' },
  });

  return {
    ...summary,
    requests: queries.map((q) => ({ id: q.id, title: q.name, type: q.type, status: q.status, raised: q.raised, resolved: q.resolved, details: q.details })),
  };
}

/** Cycles with an uploaded workbook, newest first, plus the chosen one's dashboard data. */
export async function getPortalFinancials(scope: PortalScope, cycleId?: string | null) {
  const published = (await listPortalCycles(scope)).filter((c) => c.hasFinancials);
  const chosen = published.find((c) => c.id === cycleId) ?? published[0] ?? null;
  if (!chosen) return { published, chosen: null, data: null, updatedAt: null };
  const fin = await prisma.deskFinancials.findFirst({
    where: { cycle: chosen.id },
    orderBy: { createdAt: 'desc' },
    select: { data: true, createdAt: true },
  });
  return { published, chosen, data: (fin?.data as FinancialsData | undefined) ?? null, updatedAt: fin?.createdAt.toISOString() ?? null };
}
