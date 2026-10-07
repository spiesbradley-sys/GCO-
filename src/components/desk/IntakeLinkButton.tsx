'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { generateIntakeLink } from '@/desk/actions/intake';

// Generates a per-prospect onboarding link (dev-stub: shown here to copy, also
// logged). The public form it points to is the only desk page without a login.
export function IntakeLinkButton() {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [link, setLink] = useState<string | null>(null);

  function make() {
    start(async () => {
      const res = await generateIntakeLink({});
      if (res.ok && res.link) {
        setLink(res.link);
        try {
          await navigator.clipboard.writeText(res.link);
          toast.success('Onboarding link copied to clipboard.');
        } catch {
          toast.info('Onboarding link ready. Copy it below.');
        }
      } else toast.error(res.error ?? 'Could not generate a link.');
    });
  }

  return (
    <div className="flex items-center gap-2">
      {link && (
        <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="hidden w-72 rounded-input border border-border-default bg-surface-card px-2 py-1 text-[12px] text-ink sm:block" />
      )}
      <Button size="sm" variant="secondary" loading={pending} onClick={make}>
        New onboarding link
      </Button>
    </div>
  );
}
