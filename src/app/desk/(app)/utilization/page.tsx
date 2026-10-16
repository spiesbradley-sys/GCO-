import { requireDeskUser } from '@/lib/desk/auth';
import { loadAllDeskData } from '@/lib/desk/db';
import { prisma } from '@/lib/prisma';
import { utilization, visiblePeople } from '@/desk/utilization';
import { utilizationScope, type DeskRole } from '@/desk/roles';
import { UtilizationReport } from '@/components/desk/UtilizationReport';

// Always live: derived from the engagements board on every request.
export const dynamic = 'force-dynamic';

export default async function UtilizationPage() {
  const user = await requireDeskUser();
  const role = user.role as DeskRole;
  const viewer = { id: user.id, role };

  // Every engagement/client is needed to load other people; who is visible is
  // enforced by visiblePeople() inside utilization().
  const data = await loadAllDeskData();
  const people = visiblePeople(data, viewer).map((p) => p.id);
  const capacities = await prisma.deskUser.findMany({ where: { id: { in: people } }, select: { id: true, monthlyHours: true } });
  const monthlyHours = Object.fromEntries(capacities.map((c) => [c.id, c.monthlyHours]));

  return <UtilizationReport data={utilization(data, viewer, monthlyHours)} scope={utilizationScope(role)} viewerId={user.id} canSetCapacity={role === 'owner'} />;
}
