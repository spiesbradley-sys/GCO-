'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';

export default function ResetPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // Always show the same confirmation regardless of whether the email exists —
    // never disclose account existence.
    // TODO: wire the password-reset email (VerificationToken + email provider).
    setSent(true);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-[20px] font-bold text-ink">Reset password</h1>
        <p className="text-[14px] text-ink-secondary">
          Enter your email and we&apos;ll send a reset link.
        </p>
      </div>

      {sent ? (
        <Banner tone="favorable">
          If an account exists for that email, a reset link is on its way. Check your inbox.
        </Banner>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@practice.com"
            required
          />
          <Button type="submit" className="w-full">
            Send reset link
          </Button>
        </form>
      )}

      <Link href="/login" className="text-center text-[13px] font-semibold text-accent-secondary">
        Back to sign in
      </Link>
    </div>
  );
}
