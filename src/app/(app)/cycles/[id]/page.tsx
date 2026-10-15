import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/context';
import { CycleDetailView } from '@/components/portal/CycleDetailView';
import { getPortalCycle } from '@/lib/portal/cycles';

export const dynamic = 'force-dynamic';

export default async function CyclePage({ params }: { params: { id: string } }) {
  const ctx = await requirePermission('cycles.view');
  const cycle = await getPortalCycle(ctx, params.id);
  if (!cycle) notFound();
  return <CycleDetailView cycle={cycle} cyclesHref="/cycles" dashboardHref="/dashboard/cfo" />;
}
