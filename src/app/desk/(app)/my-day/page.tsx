import { requireDeskUser } from '@/lib/desk/auth';
import { loadDeskDataForUser } from '@/lib/desk/db';
import { myDay } from '@/desk/insights';
import { MyDay } from '@/components/desk/MyDay';
import type { DeskRole } from '@/desk/roles';

export default async function MyDayPage() {
  const user = await requireDeskUser();
  const role = user.role as DeskRole;
  // Scoped per user; myDay() further narrows to engagements they're assigned to.
  const data = await loadDeskDataForUser({ id: user.id, role });
  const dash = myDay(data, { id: user.id, name: user.name, email: user.email });
  return <MyDay data={dash} />;
}
