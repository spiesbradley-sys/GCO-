'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { createCheckoutSession } from '@/actions/payments';

// Kicks off provider-hosted Stripe Checkout. The card form lives in Stripe's UI —
// this button only redirects there.
export function PayButton({ invoiceId }: { invoiceId: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [, setError] = useState<string | null>(null);

  return (
    <Button
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await createCheckoutSession(invoiceId);
          if ('url' in res) window.location.href = res.url;
          else {
            setError(res.error);
            toast.error(res.error);
          }
        })
      }
    >
      Pay invoice
    </Button>
  );
}
