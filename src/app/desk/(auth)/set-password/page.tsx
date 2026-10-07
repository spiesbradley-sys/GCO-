'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { deskSetPassword } from '@/desk/actions/auth';

export default function SetPasswordPage() {
  const router = useRouter();
  const params = useSearchParams();
  const kind = params.get('kind') === 'reset' ? 'reset' : 'invite';
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const title = kind === 'reset' ? 'Choose a new password' : 'Set your password';

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Those passwords do not match.');
      return;
    }
    start(async () => {
      const res = await deskSetPassword({ kind, token, password });
      if (res.ok) {
        router.push('/desk');
        router.refresh();
      } else setError(res.error ?? 'This link is invalid.');
    });
  }

  if (!token) {
    return <Banner tone="unfavorable">This link is missing its token. Ask the owner for a new one.</Banner>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-heading text-[20px] font-bold text-ink">{title}</h1>
        <p className="text-[14px] text-ink-secondary">At least 12 characters. Avoid common passwords.</p>
      </div>
      {error && <Banner tone="unfavorable">{error}</Banner>}
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Input label="Confirm password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        <Button type="submit" loading={pending} className="w-full">Set password and sign in</Button>
      </form>
    </div>
  );
}
