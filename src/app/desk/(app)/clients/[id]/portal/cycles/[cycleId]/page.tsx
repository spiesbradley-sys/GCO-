import { notFound } from 'next/navigation';
import { requireClientPreview, previewBase } from '@/lib/portal/preview';
import { getPortalCycle } from '@/lib/portal/cycles';
import { PortalPreviewFrame } from '@/components/portal/PortalPreviewFrame';
import { CycleDetailView } from '@/components/portal/CycleDetailView';

// Staff preview: one cycle as the client sees it.
export const dynamic = 'force-dynamic';

export default async function PreviewCyclePage({ params }: { params: { id: string; cycleId: string } }) {
  const client = await requireClientPreview(params.id);
  const cycle = await getPortalCycle({ deskClientId: client.id }, params.cycleId);
  if (!cycle) notFound();
  return (
    <PortalPreviewFrame client={client} active="cycles">
      <CycleDetailView cycle={cycle} cyclesHref={`${previewBase(client.id)}/cycles`} showFinancials />
    </PortalPreviewFrame>
  );
}
