import { redirect } from 'next/navigation';

// Team moved into the owner Admin area.
export default function TeamPage() {
  redirect('/desk/admin/staff');
}
