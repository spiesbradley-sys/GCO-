import type { Role } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// Role-based access control
//
// Permissions are resolved BEFORE a route renders (see requirePermission and the
// route guards) — never render-then-error. Keep this map as the single source of
// truth for "who can do what".
// ─────────────────────────────────────────────────────────────────────────────

export type Permission =
  | 'dashboard.view'
  | 'analytics.view'
  | 'invoices.view'
  | 'invoices.pay'
  | 'invoices.manage'
  | 'connections.view'
  | 'connections.manage'
  | 'messages.view'
  | 'messages.send'
  | 'documents.view'
  | 'documents.upload'
  | 'members.invite'
  | 'members.manage'
  | 'deals.view'
  | 'org.impersonate'
  | 'audit.view';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  client: [
    'dashboard.view',
    'analytics.view',
    'invoices.view',
    'invoices.pay',
    'connections.view',
    'connections.manage',
    'messages.view',
    'messages.send',
    'documents.view',
    'documents.upload',
  ],
  accountant: [
    'dashboard.view',
    'analytics.view',
    'invoices.view',
    'invoices.manage',
    'connections.view',
    'messages.view',
    'messages.send',
    'documents.view',
    'documents.upload',
    'members.invite',
  ],
  broker: [
    'dashboard.view',
    'deals.view',
    'messages.view',
    'messages.send',
    'documents.view',
    'documents.upload',
  ],
  gco_staff: [
    'dashboard.view',
    'analytics.view',
    'invoices.view',
    'invoices.manage',
    'connections.view',
    'connections.manage',
    'messages.view',
    'messages.send',
    'documents.view',
    'documents.upload',
    'deals.view',
    'members.invite',
    'members.manage',
    'org.impersonate',
    'audit.view',
  ],
  admin: [
    'dashboard.view',
    'analytics.view',
    'invoices.view',
    'invoices.pay',
    'invoices.manage',
    'connections.view',
    'connections.manage',
    'messages.view',
    'messages.send',
    'documents.view',
    'documents.upload',
    'deals.view',
    'members.invite',
    'members.manage',
    'org.impersonate',
    'audit.view',
  ],
};

/** True if `role` is granted `permission`. */
export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** All permissions for a role — handy for shaping nav before render. */
export function permissionsFor(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export const ROLE_LABELS: Record<Role, string> = {
  client: 'Client',
  accountant: 'Accountant',
  broker: 'Broker',
  gco_staff: 'GCO staff',
  admin: 'Admin',
};
