import { requireClientPreview, previewBase } from '@/lib/portal/preview';
import { getPortalFinancials } from '@/lib/portal/cycles';
import { PortalPreviewFrame } from '@/components/portal/PortalPreviewFrame';
import { FinancialsView } from '@/components/portal/FinancialsView';

// Staff preview: the client's Financials page (latest delivered period, or ?cycle=).
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
  const result = await getPortalFinancials({ deskClientId: client.id }, requested);
  const base = previewBase(client.id);
  return (
    <PortalPreviewFrame client={client} active="financials">
      <FinancialsView result={result} fallbackEyebrow={client.name} financialsHref={`${base}/financials`} cyclesHref={`${base}/cycles`} />
    </PortalPreviewFrame>
  );
}
