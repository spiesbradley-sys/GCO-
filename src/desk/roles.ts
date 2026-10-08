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

// Boards an accountant may create children on (only ever reached from a parent
// record they can already see — the scope check lives in the server action).
const ACCOUNTANT_CHILD_BOARDS: BoardKey[] = ['cycles', 'queries', 'deliverables'];

/** True when this role sees only the engagements it is assigned to (plus what
 * rolls up to them). Everyone else sees the whole desk. */
export function scopesToAssignedEngagements(role: DeskRole): boolean {
  return role === 'accountant';
}

/** Can this role read the given board at all? (Accountants still only see the
 * rows that roll up to their engagements — row scoping is applied separately.) */
export function canReadBoard(role: DeskRole, board: BoardKey): boolean {
  if (board === 'pnl') return can(role, 'pnl.read');
  if (board === 'deals') return role !== 'accountant'; // QoE pipeline is commercial
  return true; // all other roles read the core boards
}

/** Can this role update/delete records on the given board? (For accountants the
 * record must also be in scope — enforced in the server action.) */
export function canWriteBoard(role: DeskRole, board: BoardKey): boolean {
  if (board === 'pnl') return can(role, 'pnl.write');
  if (board === 'deals') return role !== 'accountant';
  return CORE_BOARDS.includes(board);
}

/** Can this role create a new top-level record on the given board? Accountants
 * never create top-level rows — they only add children under a visible parent
 * (see canCreateChild), so a stray row can never fall outside their scope. */
export function canCreateBoard(role: DeskRole, board: BoardKey): boolean {
  if (role === 'accountant') return false;
  if (board === 'pnl') return can(role, 'pnl.write');
  return CORE_BOARDS.includes(board);
}

/** Can this role add a child record (cycle/query/deliverable) under a parent it
 * can see? This is the one create path open to accountants. */
export function canCreateChild(role: DeskRole, childBoard: BoardKey): boolean {
  if (role === 'accountant') return ACCOUNTANT_CHILD_BOARDS.includes(childBoard);
  return canCreateBoard(role, childBoard);
}

/** Can this role delete a record on the given board? Accountants may clear their
 * own operational children but never a setup record (client/engagement). */
export function canDeleteBoard(role: DeskRole, board: BoardKey): boolean {
  if (role === 'accountant') return ACCOUNTANT_CHILD_BOARDS.includes(board);
  return canWriteBoard(role, board);
}

/** The parent board + foreign key for each child board (child creates attach
 * here; used to scope-check an accountant's additions). */
export const CHILD_LINK: Partial<Record<BoardKey, { parentBoard: BoardKey; fk: string }>> = {
  cycles: { parentBoard: 'engagements', fk: 'engagement' },
  queries: { parentBoard: 'cycles', fk: 'cycle' },
  deliverables: { parentBoard: 'cycles', fk: 'cycle' },
};

/** Can this role view other people's (and whole roles') personal day? The admin
 * (owner) and department heads (management) oversee everyone's workload. */
export function canViewAnyDay(role: DeskRole): boolean {
  return role === 'owner' || role === 'management';
}

/** General capability check. */
export function can(role: DeskRole, action: DeskAction): boolean {
  switch (action) {
    case 'board.read':
    case 'board.write':
      return true; // gated per-board by canReadBoard/canWriteBoard
    case 'pnl.read':
      // Commercials are management-only (owner included).
      return role === 'owner' || role === 'management';
    case 'pnl.write':
      return role === 'owner' || role === 'management';
    case 'commercial.view':
      // The dashboard's Commercial section is management-only (owner included).
      return role === 'owner' || role === 'management';
    case 'team.manage':
      return role === 'owner';
    case 'audit.view':
      return role === 'owner';
    default:
      return false;
  }
}
