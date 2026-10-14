import { requireDeskUser } from '@/lib/desk/auth';
import { loadAllDeskData } from '@/lib/desk/db';
import { utilization } from '@/desk/utilization';
import { utilizationScope, type DeskRole } from '@/desk/roles';
import { UtilizationReport } from '@/components/desk/UtilizationReport';

// Always live: derived from current assignments on every request.
export const dynamic = 'force-dynamic';

export default async function UtilizationPage() {
  const user = await requireDeskUser();
  const role = user.role as DeskRole;
  // Utilization needs every engagement/cycle to see a controller's reports, so
  // load the whole desk; visibility is enforced in utilization() by role.
  const data = await loadAllDeskData();
  const report = utilization(data, { id: user.id, role });
  return <UtilizationReport data={report} scope={utilizationScope(role)} viewerId={user.id} canEditCapacity={role !== 'accountant'} />;
}
