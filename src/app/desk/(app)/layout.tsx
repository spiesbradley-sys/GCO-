import { prisma } from '@/lib/prisma';
import { requireDeskUser } from '@/lib/desk/auth';
import { deskCountsForUser } from '@/lib/desk/db';
import { DeskShell } from '@/components/desk/DeskShell';
import type { DeskRole } from '@/desk/roles';

export const dynamic = 'force-dynamic';

export default async function DeskAppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireDeskUser();
  const role = user.role as DeskRole;
  // Counts mirror each user's own scope, so the sidebar never advertises rows
  // they can't open.
  const counts = await deskCountsForUser({ id: user.id, role });
  // Never let the badge query take the whole desk down (e.g. table not yet pushed).
  const unread = await prisma.deskNotification.count({ where: { userId: user.id, readAt: null } }).catch(() => 0);

  return (
    <DeskShell user={{ name: user.name, email: user.email, role }} counts={counts} unread={unread}>
      {children}
    </DeskShell>
  );
}
