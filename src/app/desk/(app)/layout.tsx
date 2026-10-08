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

  return (
    <DeskShell user={{ name: user.name, email: user.email, role }} counts={counts}>
      {children}
    </DeskShell>
  );
}
