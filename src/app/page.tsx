import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/context';

// Root: send signed-in users to their dashboard, everyone else to sign-in.
export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? '/dashboard' : '/login');
}
