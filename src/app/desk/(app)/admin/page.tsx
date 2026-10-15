import { redirect } from 'next/navigation';
import { requireDeskRole } from '@/lib/desk/auth';

export default async function AdminIndex() {
  await requireDeskRole(['owner']);
  redirect('/desk/admin/staff');
}
