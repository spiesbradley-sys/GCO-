'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') ?? '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await signIn('credentials', { email, password, redirect: false });
      // Generic message — never disclose which field was wrong.
      if (!res || res.error) setError('Email or password is incorrect.');
      else router.push(callbackUrl);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-[20px] font-bold text-ink">Sign in</h1>
        <p className="text-[14px] text-ink-secondary">Welcome back. Sign in to your workspace.</p>
      </div>

      {error && <Banner tone="unfavorable">{error}</Banner>}

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
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <div className="flex justify-end">
          <Link href="/reset" className="text-[13px] font-semibold text-accent-secondary">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" loading={pending} className="w-full">
          Sign in
        </Button>
      </form>

      <div className="flex items-center gap-3 text-[12px] text-ink-tertiary">
        <span className="h-px flex-1 bg-border-subtle" />
        or
        <span className="h-px flex-1 bg-border-subtle" />
      </div>

      <Button
        variant="secondary"
        className="w-full"
        onClick={() => signIn('google', { callbackUrl })}
      >
        Continue with Google
      </Button>
    </div>
  );
}
