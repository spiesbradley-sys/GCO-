'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { acceptInvite } from '@/actions/invite';

export function AcceptInviteForm({ token, email, needsPassword }: { token: string; email: string; needsPassword: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (needsPassword && password !== confirm) {
      setError('Those passwords don’t match.');
      return;
    }
    start(async () => {
      const res = await acceptInvite({ token, password: needsPassword ? password : null });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (!res.passwordSet) {
        router.push(`/login?callbackUrl=${encodeURIComponent('/cycles')}`);
        return;
      }
      const signedIn = await signIn('credentials', { email: res.email, password, redirect: false });
      if (!signedIn || signedIn.error) router.push('/login');
      else {
        router.push('/cycles');
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {error && <Banner tone="unfavorable">{error}</Banner>}
      <Input label="Email" type="email" value={email} readOnly disabled />
      {needsPassword && (
        <>
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            help="At least 12 characters. Avoid common passwords."
            required
          />
          <Input
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </>
      )}
      <Button type="submit" loading={pending} className="w-full">
        {needsPassword ? 'Set password and sign in' : 'Accept invite'}
      </Button>
    </form>
  );
}
