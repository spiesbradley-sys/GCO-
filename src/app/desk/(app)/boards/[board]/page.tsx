import { notFound, redirect } from 'next/navigation';
import { requireDeskUser } from '@/lib/desk/auth';
import { loadAllDeskData } from '@/lib/desk/db';
import { BoardView } from '@/components/desk/BoardView';
import { IntakeLinkButton } from '@/components/desk/IntakeLinkButton';
import { BOARDS } from '@/desk/boards';
import { canReadBoard, canWriteBoard, type BoardKey, type DeskRole } from '@/desk/roles';

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

  const data = await loadAllDeskData();
  return (
    <BoardView
      board={board}
      data={data}
      canWrite={canWriteBoard(role, board)}
      initialOpenId={searchParams.open}
      headerExtra={board === 'intake' ? <IntakeLinkButton /> : undefined}
    />
  );
}
