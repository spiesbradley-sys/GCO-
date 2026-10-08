import { notFound, redirect } from 'next/navigation';
import { requireDeskUser } from '@/lib/desk/auth';
import { loadDeskDataForUser } from '@/lib/desk/db';
import { BoardView } from '@/components/desk/BoardView';
import { IntakeLinkButton } from '@/components/desk/IntakeLinkButton';
import { GenerateCyclesButton } from '@/components/desk/GenerateCyclesButton';
import { BOARDS } from '@/desk/boards';
import { canReadBoard, canWriteBoard, canCreateBoard, canViewAnyDay, type BoardKey, type DeskRole } from '@/desk/roles';

const VALID = new Set(Object.keys(BOARDS));

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: { board: string };
  searchParams: { open?: string };
}) {
  const user = await requireDeskUser();
  const board = params.board as BoardKey;
  if (!VALID.has(board)) notFound();

  const role = user.role as DeskRole;
  // Resolve permission before rendering — never render then error.
  if (!canReadBoard(role, board)) redirect('/desk/403');

  const data = await loadDeskDataForUser({ id: user.id, role });
  return (
    <BoardView
      board={board}
      data={data}
      role={role}
      canWrite={canWriteBoard(role, board)}
      canCreate={canCreateBoard(role, board)}
      initialOpenId={searchParams.open}
      headerExtra={board === 'intake' ? <IntakeLinkButton /> : board === 'cycles' && canViewAnyDay(role) ? <GenerateCyclesButton /> : undefined}
    />
  );
}
