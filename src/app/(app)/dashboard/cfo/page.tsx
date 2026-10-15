import { requirePermission } from '@/lib/context';
import { FinancialsView } from '@/components/portal/FinancialsView';
import { getPortalFinancials, listPortalCycles } from '@/lib/portal/cycles';

// The client's CFO dashboard: this month's close progress, then the figures from
// the financials workbook the accountant uploaded on the desk (latest period by
// default, earlier ones via ?cycle=<id>).
export const dynamic = 'force-dynamic';

export default async function CfoDashboardPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const ctx = await requirePermission('analytics.view');
  const requested = typeof searchParams.cycle === 'string' ? searchParams.cycle : null;
  const [result, cycles] = await Promise.all([getPortalFinancials(ctx, requested), listPortalCycles(ctx)]);
  return (
    <FinancialsView
      result={result}
      latestClose={cycles[0] ?? null}
      fallbackEyebrow={ctx.activeOrg.orgName}
      dashboardHref="/dashboard/cfo"
      cyclesHref="/cycles"
    />
  );
}
