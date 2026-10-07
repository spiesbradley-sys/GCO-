import { requireDeskUser } from '@/lib/desk/auth';
import { prisma } from '@/lib/prisma';
import { DeskShell } from '@/components/desk/DeskShell';
import type { DeskRole } from '@/desk/roles';

export const dynamic = 'force-dynamic';

export default async function DeskAppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireDeskUser();

  const [intake, clients, engagements, cycles, queries, deliverables, deals, pnl] = await Promise.all([
    prisma.deskIntake.count(),
    prisma.deskClient.count(),
    prisma.deskEngagement.count(),
    prisma.deskCycle.count(),
    prisma.deskQuery.count(),
    prisma.deskDeliverable.count(),
    prisma.deskDeal.count(),
    prisma.deskPnlRow.count(),
  ]);

  return (
    <DeskShell
      user={{ name: user.name, email: user.email, role: user.role as DeskRole }}
      counts={{ intake, clients, engagements, cycles, queries, deliverables, deals, pnl }}
    >
      {children}
    </DeskShell>
  );
}
