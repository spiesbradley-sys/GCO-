'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { deskLogin } from '@/desk/actions/auth';

export default function DeskLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await deskLogin({ email, password });
      if (res.ok) {
        router.push('/desk');
        router.refresh();
      } else setError(res.error ?? 'Email or password is incorrect.');
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-heading text-[20px] font-bold text-ink">Sign in to the desk</h1>
        <p className="text-[14px] text-ink-secondary">Use your GCO desk email and password.</p>
      </div>
      {error && <Banner tone="unfavorable">{error}</Banner>}
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <div className="flex justify-end">
          <Link href="/desk/forgot" className="text-[13px] font-semibold text-accent-secondary">Forgot password?</Link>
        </div>
        <Button type="submit" loading={pending} className="w-full">Sign in</Button>
      </form>
    </div>
  );
}
