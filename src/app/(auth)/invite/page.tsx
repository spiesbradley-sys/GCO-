import Link from 'next/link';
import { Banner } from '@/components/ui/Banner';
import { lookupInvite } from '@/actions/invite';
import { AcceptInviteForm } from './AcceptInviteForm';

// Landing page for a client-portal invite link (/invite?token=…). New users choose
// a password and are signed straight in; people who already have a portal login
// just confirm, then sign in as usual.
export const dynamic = 'force-dynamic';

export default async function InvitePage({ searchParams }: { searchParams: { token?: string } }) {
  const token = typeof searchParams.token === 'string' ? searchParams.token : '';
  const invite = await lookupInvite(token);

  if (!invite.ok) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="font-heading text-[20px] font-bold text-ink">Set up your login</h1>
        <Banner tone="unfavorable">{invite.error}</Banner>
        <Link href="/login" className="text-[14px] font-semibold text-accent-secondary hover:text-accent-primary-hover">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <span className="text-[12px] font-semibold uppercase tracking-eyebrow text-ink-tertiary">{invite.orgName}</span>
        <h1 className="font-heading text-[20px] font-bold text-ink">
          {invite.needsPassword ? 'Set up your login' : 'Accept your invite'}
        </h1>
        <p className="text-[14px] text-ink-secondary">
          {invite.needsPassword
            ? 'Choose a password for your client portal. You’ll use it with this email from now on.'
            : 'You already have a portal login. Accept to add this account to it, then sign in with your usual password.'}
        </p>
      </div>
      <AcceptInviteForm token={token} email={invite.email} needsPassword={invite.needsPassword} />
    </div>
  );
}
