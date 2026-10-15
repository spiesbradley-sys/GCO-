import { requirePermission } from '@/lib/context';
import { FinancialsView } from '@/components/portal/FinancialsView';
import { getPortalFinancials } from '@/lib/portal/cycles';

// The client's cashflow & revenue dashboard: the latest delivered cycle by
// default, with earlier delivered periods one click away (?cycle=<id>).
export const dynamic = 'force-dynamic';

export default async function FinancialsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const ctx = await requirePermission('analytics.view');
  const requested = typeof searchParams.cycle === 'string' ? searchParams.cycle : null;
  const result = await getPortalFinancials(ctx, requested);
  return <FinancialsView result={result} fallbackEyebrow={ctx.activeOrg.orgName} financialsHref="/financials" cyclesHref="/cycles" />;
}
