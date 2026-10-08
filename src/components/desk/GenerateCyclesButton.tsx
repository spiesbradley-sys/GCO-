'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { generateMonthlyCycles } from '@/desk/actions/cycles';

export function GenerateCyclesButton() {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();

  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await generateMonthlyCycles();
          if (!res.ok) {
            toast.error(res.error ?? 'Could not generate cycles.');
            return;
          }
          toast.success(res.created ? `Created ${res.created} cycle${res.created === 1 ? '' : 's'}.` : 'Every month is already covered.');
          router.refresh();
        })
      }
    >
      {pending ? 'Generating…' : 'Generate monthly cycles'}
    </Button>
  );
}
