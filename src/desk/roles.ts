// Desk roles and the permission matrix. Enforced on the SERVER (see
// src/lib/desk/auth.ts guards and the server actions) — the UI only mirrors it.

export type DeskRole = 'owner' | 'management' | 'controller' | 'accountant';

export const DESK_ROLES: DeskRole[] = ['owner', 'management', 'controller', 'accountant'];

export const DESK_ROLE_LABEL: Record<DeskRole, string> = {
  owner: 'Owner',
  management: 'Management',
  controller: 'Controller',
  accountant: 'Accountant',
};

// Board keys used across the desk.
export type BoardKey =
  | 'intake'
  | 'clients'
  | 'engagements'
  | 'cycles'
  | 'queries'
  | 'deliverables'
  | 'deals'
  | 'pnl';

export type DeskAction =
  | 'board.read'
  | 'board.write'
  | 'pnl.read'
  | 'pnl.write'
  | 'commercial.view' // dashboard Commercial section
  | 'team.manage' // invite, roles, deactivate
  | 'audit.view';

// Boards every non-P&L role may read and write.
const CORE_BOARDS: BoardKey[] = [
  'intake',
  'clients',
  'engagements',
  'cycles',
  'queries',
  'deliverables',
  'deals',
];

/** Can this role read the given board? */
export function canReadBoard(role: DeskRole, board: BoardKey): boolean {
  if (board === 'pnl') return can(role, 'pnl.read');
  return true; // all roles read the core boards + deals
}

/** Can this role write (create/update/delete) the given board? */
export function canWriteBoard(role: DeskRole, board: BoardKey): boolean {
  if (board === 'pnl') return can(role, 'pnl.write');
  return CORE_BOARDS.includes(board); // all roles write core boards + deals
}

/** General capability check. */
export function can(role: DeskRole, action: DeskAction): boolean {
  switch (action) {
    case 'board.read':
    case 'board.write':
      return true; // gated per-board by canReadBoard/canWriteBoard
    case 'pnl.read':
      return role === 'owner' || role === 'management' || role === 'controller';
    case 'pnl.write':
      return role === 'owner' || role === 'management';
    case 'commercial.view':
      // The dashboard's Commercial section is hidden for accountants.
      return role !== 'accountant';
    case 'team.manage':
      return role === 'owner';
    case 'audit.view':
      return role === 'owner';
    default:
      return false;
  }
}
