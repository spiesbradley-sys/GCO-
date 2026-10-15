import { requireClientPreview, previewBase } from '@/lib/portal/preview';
import { listPortalCycles } from '@/lib/portal/cycles';
import { PortalPreviewFrame } from '@/components/portal/PortalPreviewFrame';
import { CyclesListView } from '@/components/portal/CyclesListView';

// Staff preview: the client's Cycles page, exactly as their portal renders it.
export const dynamic = 'force-dynamic';

export default async function PreviewCyclesPage({ params }: { params: { id: string } }) {
  const client = await requireClientPreview(params.id);
  const cycles = await listPortalCycles({ deskClientId: client.id });
  return (
    <PortalPreviewFrame client={client} active="cycles">
      <CyclesListView
        cycles={cycles}
        base={`${previewBase(client.id)}/cycles`}
        emptyBody="This client has no cycles yet. They appear here once an engagement's first close is opened."
      />
    </PortalPreviewFrame>
  );
}
