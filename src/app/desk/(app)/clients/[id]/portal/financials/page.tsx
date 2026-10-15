import { requireClientPreview, previewBase } from '@/lib/portal/preview';
import { getPortalFinancials, listPortalCycles } from '@/lib/portal/cycles';
import { PortalPreviewFrame } from '@/components/portal/PortalPreviewFrame';
import { FinancialsView } from '@/components/portal/FinancialsView';

// Staff preview: the client's CFO dashboard (latest period, or ?cycle=).
export const dynamic = 'force-dynamic';

export default async function PreviewFinancialsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const client = await requireClientPreview(params.id);
  const requested = typeof searchParams.cycle === 'string' ? searchParams.cycle : null;
  const scope = { deskClientId: client.id };
  const [result, cycles] = await Promise.all([getPortalFinancials(scope, requested), listPortalCycles(scope)]);
  const base = previewBase(client.id);
  return (
    <PortalPreviewFrame client={client} active="financials">
      <FinancialsView
        result={result}
        latestClose={cycles[0] ?? null}
        fallbackEyebrow={client.name}
        dashboardHref={`${base}/financials`}
        cyclesHref={`${base}/cycles`}
      />
    </PortalPreviewFrame>
  );
}
