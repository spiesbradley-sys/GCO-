import { requirePermission } from '@/lib/context';
import { CyclesListView } from '@/components/portal/CyclesListView';
import { listPortalCycles, isLinkedToDesk } from '@/lib/portal/cycles';

// Every close cycle GCO runs for the active client: where it stands, when it is
// due, and whether we are waiting on them.
export const dynamic = 'force-dynamic';

export default async function CyclesPage() {
  const ctx = await requirePermission('cycles.view');
  const cycles = await listPortalCycles(ctx);
  const emptyBody =
    cycles.length === 0 && !(await isLinkedToDesk(ctx))
      ? 'Your account isn’t connected to a GCO engagement yet. Your controller will link it once your engagement starts.'
      : 'Your first close starts at month-end. It will appear here as soon as we open it.';
  return <CyclesListView cycles={cycles} base="/cycles" emptyBody={emptyBody} />;
}
