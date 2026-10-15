import { redirect } from 'next/navigation';
import { previewBase, requireClientPreview } from '@/lib/portal/preview';

export const dynamic = 'force-dynamic';

export default async function PortalPreviewIndex({ params }: { params: { id: string } }) {
  await requireClientPreview(params.id);
  redirect(`${previewBase(params.id)}/financials`);
}
