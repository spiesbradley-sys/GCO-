import { requireDeskUser } from '@/lib/desk/auth';
import { loadDeskDataForUser } from '@/lib/desk/db';
import { myDay, myDayForMembers } from '@/desk/insights';
import { MyDay } from '@/components/desk/MyDay';
import { canViewAnyDay, DESK_ROLES, DESK_ROLE_LABEL, type DeskRole } from '@/desk/roles';

export default async function MyDayPage({ searchParams }: { searchParams: { as?: string; team?: string } }) {
  const user = await requireDeskUser();
  const role = user.role as DeskRole;
  const oversee = canViewAnyDay(role);
  // Overseers load the whole desk (so they can view anyone); everyone else is
  // scoped to themselves. myDay() narrows to the target's own assignments.
  const data = await loadDeskDataForUser({ id: user.id, role });

  const asId = oversee ? searchParams.as : undefined;
  const teamRole = oversee && searchParams.team && (DESK_ROLES as string[]).includes(searchParams.team) ? (searchParams.team as DeskRole) : undefined;

  let dash;
  let viewing: { label: string; self: boolean } = { label: '', self: true };
  if (asId) {
    const u = data.users.find((x) => x.id === asId);
    const target = u ?? { id: user.id, name: user.name, email: user.email };
    dash = myDay(data, { id: target.id, name: target.name, email: target.email });
    viewing = { label: u ? `${u.name ?? u.email} · ${DESK_ROLE_LABEL[u.role as DeskRole]}` : '', self: !u || u.id === user.id };
  } else if (teamRole) {
    const members = data.users.filter((u) => u.isActive && u.role === teamRole);
    const plural = teamRole === 'management' ? 'management' : `${DESK_ROLE_LABEL[teamRole].toLowerCase()}s`;
    dash = myDayForMembers(data, members, `All ${plural}`);
    viewing = { label: `All ${plural} · ${members.length}`, self: false };
  } else {
    dash = myDay(data, { id: user.id, name: user.name, email: user.email });
  }

  const oversight = oversee
    ? {
        users: data.users
          .filter((u) => u.isActive)
          .map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role }))
          .sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email)),
        roles: DESK_ROLES.map((r) => ({ value: r, label: DESK_ROLE_LABEL[r] })),
        selection: asId ? `as:${asId}` : teamRole ? `team:${teamRole}` : 'self',
      }
    : undefined;

  return <MyDay data={dash} oversight={oversight} viewing={viewing} />;
}
