import type { Permission } from '@/lib/rbac';

// Nav grouped under uppercase eyebrow labels. Each item declares the permission
// it needs; the sidebar hides items the active role can't use (resolved before
// render — never render-then-error).
export type NavItem = {
  label: string;
  href: string;
  permission: Permission;
  icon: 'grid' | 'invoice' | 'link' | 'message' | 'document' | 'deal';
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', href: '/dashboard', permission: 'dashboard.view', icon: 'grid' },
      { label: 'CFO dashboard', href: '/dashboard/cfo', permission: 'analytics.view', icon: 'grid' },
    ],
  },
  {
    label: 'Close',
    items: [
      { label: 'Invoices', href: '/invoices', permission: 'invoices.view', icon: 'invoice' },
      { label: 'Connections', href: '/connections', permission: 'connections.view', icon: 'link' },
    ],
  },
  {
    label: 'Diligence',
    items: [{ label: 'Deals', href: '/deals', permission: 'deals.view', icon: 'deal' }],
  },
  {
    label: 'Workspace',
    items: [
      { label: 'Messages', href: '/messages', permission: 'messages.view', icon: 'message' },
      { label: 'Documents', href: '/documents', permission: 'documents.view', icon: 'document' },
    ],
  },
];
