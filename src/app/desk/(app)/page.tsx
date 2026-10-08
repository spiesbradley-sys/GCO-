import { requireDeskUser } from '@/lib/desk/auth';
import { loadDeskDataForUser } from '@/lib/desk/db';
import { deskDashboard } from '@/desk/insights';
import { can, type DeskRole } from '@/desk/roles';
import { Overview } from '@/components/desk/Overview';

export default async function DeskOverviewPage() {
  const user = await requireDeskUser();
  const role = user.role as DeskRole;
  // Scoped per user: an accountant's dashboard only counts their own cycles,
  // queries and clients; the commercial half is gated by canViewCommercial.
  const data = await loadDeskDataForUser({ id: user.id, role });
  const dash = deskDashboard(data);
  return <Overview dash={dash} canViewCommercial={can(role, 'commercial.view')} />;
}
