import { requirePermission } from '@/lib/context';
import { CfoDashboard } from '@/components/analytics/CfoDashboard';
import { getDashboard, resolveDrill, currentPeriod, type Filters } from '@/lib/analytics/service';
import { decodeDrill } from '@/lib/analytics/drill';

// Dental-group CFO dashboard. Scopes to the active tenant (the dental group) and
// composes a period selector + location filter. Filters and drill state are read
// from the URL so a view is shareable — and every drill is re-resolved here,
// server-side, after the permission + tenant checks below.
export const dynamic = 'force-dynamic';

export default async function CfoDashboardPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const ctx = await requirePermission('analytics.view');

  const period = typeof searchParams.period === 'string' ? searchParams.period : currentPeriod();
  const locationId = typeof searchParams.location === 'string' ? searchParams.location : null;
  const scope: Filters['scope'] = searchParams.scope === 'location' ? 'location' : 'group';
  const filters: Filters = { period, locationId, scope };

  const data = await getDashboard(ctx, filters);

  // Resolve the drill target (if any) server-side. resolveDrill re-runs the
  // permission + tenant checks and returns null uniformly for "not permitted" and
  // "does not exist" — a shared link never leaks whether a target exists.
  const drillToken = typeof searchParams.drill === 'string' ? searchParams.drill : null;
  const ref = decodeDrill(drillToken);
  const drillContent = ref ? await resolveDrill(ctx, ref, filters) : null;

  // Practice-owner surfaces gloss financial terms; analyst/broker surfaces don't.
  const gloss = ctx.effectiveRole === 'client';

  return <CfoDashboard data={data} drillContent={drillContent} gloss={gloss} />;
}
