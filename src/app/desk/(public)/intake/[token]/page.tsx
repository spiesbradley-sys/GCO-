import { verifyPayload } from '@/lib/desk/tokens';
import { PublicIntakeForm } from '@/components/desk/PublicIntakeForm';

export const dynamic = 'force-dynamic';

export default function PublicIntakePage({ params }: { params: { token: string } }) {
  const payload = verifyPayload<{ k?: string; company?: string; email?: string }>(params.token);
  const valid = payload && payload.k === 'intake';

  if (!valid) {
    return (
      <div className="rounded-card bg-surface-card p-8 text-center shadow-sm">
        <h1 className="font-heading text-[20px] font-bold text-ink">This link isn&apos;t valid</h1>
        <p className="mt-2 text-[15px] text-ink-secondary">
          Your onboarding link has expired or is incorrect. Ask your GCO contact for a fresh link.
        </p>
      </div>
    );
  }

  return <PublicIntakeForm token={params.token} company={payload!.company ?? ''} email={payload!.email ?? ''} />;
}
