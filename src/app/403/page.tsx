import Link from 'next/link';
import { Button } from '@/components/ui/Button';

// Shown when a role lacks permission. Guards resolve permissions BEFORE render
// and redirect here — we never render a forbidden page and then error inside it.
export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-page px-4 text-center">
      <span className="eyebrow">Access</span>
      <h1 className="font-heading text-page-title text-ink">You don’t have access to this</h1>
      <p className="max-w-md text-[15px] text-ink-secondary">
        Your role doesn’t include this area. If you think that’s wrong, ask an account owner to
        update your access.
      </p>
      <Link href="/dashboard">
        <Button variant="secondary">Back to dashboard</Button>
      </Link>
    </div>
  );
}
