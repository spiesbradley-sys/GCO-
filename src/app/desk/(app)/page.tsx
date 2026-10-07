import { requireDeskUser } from '@/lib/desk/auth';
import { loadAllDeskData } from '@/lib/desk/db';
import { deskDashboard } from '@/desk/insights';
import { can, type DeskRole } from '@/desk/roles';
import { Overview } from '@/components/desk/Overview';

export default async function DeskOverviewPage() {
  const user = await requireDeskUser();
  const data = await loadAllDeskData();
  const dash = deskDashboard(data);
  return <Overview dash={dash} canViewCommercial={can(user.role as DeskRole, 'commercial.view')} />;
}
