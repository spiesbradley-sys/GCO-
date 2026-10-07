import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function DeskForbiddenPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <span className="eyebrow">Access</span>
      <h1 className="font-heading text-page-title text-ink">You don&apos;t have access to this</h1>
      <p className="max-w-md text-[15px] text-ink-secondary">
        Your desk role doesn&apos;t include this area. If that looks wrong, ask the owner to update your role.
      </p>
      <Link href="/desk">
        <Button variant="secondary">Back to overview</Button>
      </Link>
    </div>
  );
}
