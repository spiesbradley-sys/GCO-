'use client';

import { useState, useTransition } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { BOARDS } from '@/desk/boards';
import { submitIntake } from '@/desk/actions/intake';

type State = Record<string, string | string[]>;

export function PublicIntakeForm({ token, company, email }: { token: string; company: string; email: string }) {
  const fields = BOARDS.intake.fields;
  const [state, setState] = useState<State>({ name: company, email });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  function set(k: string, v: string | string[]) {
    setState((s) => ({ ...s, [k]: v }));
  }
  function toggle(k: string, opt: string) {
    const arr = Array.isArray(state[k]) ? (state[k] as string[]) : [];
    set(k, arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt]);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!String(state.name || '').trim()) {
      setError('Please enter your company name.');
      return;
    }
    start(async () => {
      const res = await submitIntake({ token, ...state } as never);
      if (res.ok) setDone(true);
      else setError(res.error ?? 'Something went wrong. Please try again.');
    });
  }

  if (done) {
    return (
      <div className="rounded-card bg-surface-card p-8 text-center shadow-sm">
        <h1 className="font-heading text-[22px] font-bold text-ink">Thank you</h1>
        <p className="mt-2 text-[15px] text-ink-secondary">
          Your answers are in. Your GCO contact will use them to shape your chart of accounts and your first dashboard, and will be in touch about next steps.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="eyebrow">Client onboarding</span>
        <h1 className="font-heading text-[26px] font-bold text-ink">Tell us how your business works</h1>
        <p className="mt-1 text-[15px] text-ink-secondary">
          A few questions so we can set your books up around how you actually run. Takes about ten minutes. There are no wrong answers.
        </p>
      </div>

      {error && <Banner tone="unfavorable">{error}</Banner>}

      <form onSubmit={submit} className="flex flex-col gap-5 rounded-card bg-surface-card p-6 shadow-sm">
        {fields.map((f) => {
          if (f.t === 'title') {
            return <Input key={f.k} label="Company name" value={(state.name as string) ?? ''} onChange={(e) => set('name', e.target.value)} required />;
          }
          if (f.t === 'text') {
            return <Input key={f.k} label={f.l} type="email" value={(state[f.k] as string) ?? ''} onChange={(e) => set(f.k, e.target.value)} />;
          }
          if (f.t === 'select') {
            return (
              <label key={f.k} className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-ink">{f.l}</span>
                <select value={(state[f.k] as string) ?? ''} onChange={(e) => set(f.k, e.target.value)} className="h-10 rounded-input border border-border-default bg-surface-card px-3 text-[15px] text-ink focus:border-accent-secondary focus:outline-none">
                  <option value="">—</option>
                  {f.o!.map((o) => (
                    <option key={o.name} value={o.name}>{o.name}</option>
                  ))}
                </select>
              </label>
            );
          }
          if (f.t === 'multi') {
            const arr = Array.isArray(state[f.k]) ? (state[f.k] as string[]) : [];
            return (
              <div key={f.k} className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-ink">{f.l}</span>
                <div className="flex flex-wrap gap-1.5">
                  {f.o!.map((o) => {
                    const on = arr.includes(o.name);
                    return (
                      <button type="button" key={o.name} onClick={() => toggle(f.k, o.name)} className={cn('rounded-pill px-3 py-1 text-[13px] font-semibold', on ? 'bg-surface-cream text-ink ring-1 ring-accent-primary' : 'bg-surface-sunken text-ink-tertiary')}>
                        {o.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          }
          // long
          return (
            <label key={f.k} className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-ink">{f.l}</span>
              {f.hint && <span className="text-[12.5px] text-ink-tertiary">{f.hint}</span>}
              <textarea value={(state[f.k] as string) ?? ''} onChange={(e) => set(f.k, e.target.value)} rows={3} className="min-h-[76px] resize-y rounded-input border border-border-default bg-surface-card px-3 py-2 text-[15px] leading-relaxed text-ink focus:border-accent-secondary focus:outline-none" />
            </label>
          );
        })}

        <div className="flex justify-end">
          <Button type="submit" loading={pending}>Send my answers</Button>
        </div>
      </form>
    </div>
  );
}
