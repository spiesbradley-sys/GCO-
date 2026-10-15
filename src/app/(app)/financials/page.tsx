import { redirect } from 'next/navigation';

// The financials dashboard is the CFO dashboard now.
export default function FinancialsPage({ searchParams }: { searchParams: { cycle?: string } }) {
  redirect(searchParams.cycle ? `/dashboard/cfo?cycle=${encodeURIComponent(searchParams.cycle)}` : '/dashboard/cfo');
}
