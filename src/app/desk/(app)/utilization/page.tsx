import { requireDeskUser } from '@/lib/desk/auth';
import { loadAllDeskData } from '@/lib/desk/db';
import { prisma } from '@/lib/prisma';
import { todayISO, type Rec } from '@/desk/compute';
import { loggableEngagements, monthOf, monthRange, parseMonth, utilization, visiblePeople } from '@/desk/utilization';
import { utilizationScope, type DeskRole } from '@/desk/roles';
import { UtilizationReport } from '@/components/desk/UtilizationReport';

// Always live: derived from logged time on every request.
export const dynamic = 'force-dynamic';

export default async function UtilizationPage({ searchParams }: { searchParams: { month?: string } }) {
  const user = await requireDeskUser();
  const role = user.role as DeskRole;
  const viewer = { id: user.id, role };
  const today = todayISO();
  const currentMonth = monthOf(today);
  const month = parseMonth(searchParams.month, currentMonth);
  const { first, last } = monthRange(month);

  // Every engagement/client is needed to label other people's hours; who is
  // visible is enforced by visiblePeople() before any time is loaded.
  const data = await loadAllDeskData();
  const people = visiblePeople(data, viewer).map((p) => p.id);
  const [entries, capacities] = await Promise.all([
    prisma.deskTimeEntry.findMany({
      where: { user: { in: people }, date: { gte: first, lte: last } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.deskUser.findMany({ where: { id: { in: people } }, select: { id: true, monthlyHours: true } }),
  ]);
  const monthlyHours = Object.fromEntries(capacities.map((c) => [c.id, c.monthlyHours]));
  const report = utilization(data, viewer, month, entries, monthlyHours);

  const engName = new Map((data.engagements as Rec[]).map((e) => [e.id as string, (e.name as string) || 'Untitled']));
  const myEntries = entries
    .filter((t) => t.user === user.id)
    .map((t) => ({ id: t.id, date: t.date, hours: t.hours, billable: t.engagement ? t.billable : false, note: t.note, engagement: t.engagement ? engName.get(t.engagement) ?? 'Removed engagement' : 'Internal' }));
  const engagements = loggableEngagements(data, viewer).map((e) => ({ id: e.id as string, name: (e.name as string) || 'Untitled' }));

  return (
    <UtilizationReport
      data={report}
      scope={utilizationScope(role)}
      viewerId={user.id}
      currentMonth={currentMonth}
      // Default the log form to today, or the 1st when browsing another month.
      defaultDate={month === currentMonth ? today : first}
      engagements={engagements}
      myEntries={myEntries}
      canSetCapacity={role === 'owner'}
    />
  );
}
