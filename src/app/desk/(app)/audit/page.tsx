import { redirect } from 'next/navigation';

// The audit log moved into the owner Admin area, where it also covers the client portal.
export default function AuditPage() {
  redirect('/desk/admin/audit?source=desk');
}
