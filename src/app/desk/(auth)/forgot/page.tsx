'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { deskRequestReset } from '@/desk/actions/auth';

export default function ForgotPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      await deskRequestReset({ email });
      setSent(true);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-heading text-[20px] font-bold text-ink">Reset your password</h1>
        <p className="text-[14px] text-ink-secondary">Enter your desk email and we&apos;ll send a reset link.</p>
      </div>
      {sent ? (
        <Banner tone="favorable">If that email belongs to an active account, a reset link is on its way. In dev mode the link is printed to the server log.</Banner>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Button type="submit" loading={pending} className="w-full">Send reset link</Button>
        </form>
      )}
      <Link href="/desk/login" className="text-center text-[13px] font-semibold text-accent-secondary">Back to sign in</Link>
    </div>
  );
}
