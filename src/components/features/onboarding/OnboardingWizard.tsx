'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { IconCheck } from '@/components/ui/icons';

// Invite-based onboarding. Numbered circular markers, one task per step, a
// persistent progress indicator, skippable + resumable (last step remembered),
// and an explicit "what happens next" summary at the end. Never traps the user.

type Step = { title: string; body: string; primary: string };

const STEPS: Step[] = [
  {
    title: 'Welcome to GCO Partners',
    body: 'We’ll get your workspace ready in a few short steps. You can skip any step and come back to it later.',
    primary: 'Get started',
  },
  {
    title: 'Confirm your practice',
    body: 'Check that your practice details are right so we scope everything to the correct entity.',
    primary: 'Looks right',
  },
  {
    title: 'Connect your systems',
    body: 'Link QuickBooks or Xero and your bank feed. You authorise each in the provider’s own secure flow — we never see your login.',
    primary: 'Connect later',
  },
  {
    title: 'Add your first documents',
    body: 'Upload the latest bank statements so your GCO team can start the close.',
    primary: 'Upload later',
  },
];

const STORAGE_KEY = 'gco:onboarding:step';

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) setStep(Math.min(Number(saved), STEPS.length - 1));
    } catch {
      /* ignore */
    }
  }, []);

  function go(next: number) {
    if (next >= STEPS.length) {
      setDone(true);
      return;
    }
    setStep(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      /* ignore */
    }
  }

  if (done) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-card bg-surface-card p-8 text-center shadow-md">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-favorable-tint text-favorable">
          <IconCheck width={26} height={26} />
        </span>
        <h1 className="font-heading text-section-title text-ink">You’re set up</h1>
        <div className="flex flex-col gap-2 text-left text-[15px] text-ink-secondary">
          <p className="font-semibold text-ink">What happens next</p>
          <p>1. Your GCO team reviews your practice and connected systems.</p>
          <p>2. We reconcile your latest period and flag anything we need from you.</p>
          <p>3. You’ll see your first close summary on the dashboard within a few business days.</p>
        </div>
        <Button className="w-full" onClick={() => router.push('/dashboard')}>
          Go to dashboard
        </Button>
      </div>
    );
  }

  const current = STEPS[step];

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 rounded-card bg-surface-card p-8 shadow-md">
      {/* Progress markers */}
      <ol className="flex items-center justify-center gap-2">
        {STEPS.map((_, i) => (
          <li key={i} className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold',
                i < step
                  ? 'bg-accent-primary text-white'
                  : i === step
                    ? 'bg-surface-cream text-accent-primary ring-2 ring-accent-primary'
                    : 'bg-surface-sunken text-ink-tertiary',
              )}
            >
              {i < step ? <IconCheck width={14} height={14} /> : i + 1}
            </span>
            {i < STEPS.length - 1 && <span className="h-px w-6 bg-border-subtle" />}
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-2 text-center">
        <span className="eyebrow">Step {step + 1} of {STEPS.length}</span>
        <h1 className="font-heading text-section-title text-ink">{current.title}</h1>
        <p className="text-[15px] text-ink-secondary">{current.body}</p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => go(step + 1)}>
          Skip
        </Button>
        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="secondary" onClick={() => go(step - 1)}>
              Back
            </Button>
          )}
          <Button onClick={() => go(step + 1)}>{current.primary}</Button>
        </div>
      </div>
    </div>
  );
}
