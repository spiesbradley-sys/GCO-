import { redirect } from 'next/navigation';
import { requireDeskUser } from '@/lib/desk/auth';
import { loadDeskDataForUser } from '@/lib/desk/db';
import { recurringRevenue } from '@/desk/insights';
import { canReadBoard, type DeskRole } from '@/desk/roles';
import { RecurringRevenue } from '@/components/desk/RecurringRevenue';

export default async function RecurringPage() {
  const user = await requireDeskUser();
  const role = user.role as DeskRole;
  if (!canReadBoard(role, 'pnl')) redirect('/desk/403'); // commercials: owner/management
  const data = await loadDeskDataForUser({ id: user.id, role });
  return <RecurringRevenue data={recurringRevenue(data)} />;
}
