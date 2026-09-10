'use server';

import { headers } from 'next/headers';
import { requirePermission } from '@/lib/context';
import { getStripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';

// Start a provider-hosted Stripe Checkout session for an invoice. Card entry
// happens entirely in Stripe's UI — this app never sees card/bank numbers. We
// store only the resulting Stripe references; invoice status is reconciled later
// by the webhook (see /api/stripe/webhook).
export async function createCheckoutSession(
  invoiceId: string,
): Promise<{ url: string } | { error: string }> {
  const ctx = await requirePermission('invoices.pay');

  // Tenant-guarded read — cannot fetch another org's invoice.
  const invoice = await ctx.db.invoice.findFirst({ where: { id: invoiceId } });
  if (!invoice) return { error: 'Invoice not found.' };
  if (invoice.status === 'paid') return { error: 'This invoice is already paid.' };

  const origin = headers().get('origin') ?? process.env.AUTH_URL ?? 'http://localhost:3000';

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // We pass an amount, never card data.
      line_items: [
        {
          price_data: {
            currency: invoice.currency,
            unit_amount: invoice.amountCents,
            product_data: { name: `Invoice ${invoice.number}` },
          },
          quantity: 1,
        },
      ],
      // Reconciliation keys — read back in the webhook, validated against orgId.
      metadata: { invoiceId: invoice.id, orgId: ctx.orgId },
      success_url: `${origin}/invoices/${invoice.id}?paid=1`,
      cancel_url: `${origin}/invoices/${invoice.id}`,
    });

    // Record the attempt with Stripe references only.
    await prisma.payment.create({
      data: {
        orgId: ctx.orgId,
        invoiceId: invoice.id,
        amountCents: invoice.amountCents,
        currency: invoice.currency,
        status: 'pending',
        stripeCheckoutSessionId: session.id,
      },
    });

    await recordAudit({
      action: 'payment_initiated',
      orgId: ctx.orgId,
      actorId: ctx.user.id,
      target: `Invoice ${invoice.number}`,
      targetId: invoice.id,
      metadata: { checkoutSessionId: session.id, amountCents: invoice.amountCents },
    });

    if (!session.url) return { error: 'Could not start checkout. Try again.' };
    return { url: session.url };
  } catch (err) {
    console.error('[payments] checkout failed', err);
    return { error: 'Payments are not configured yet. Add your Stripe keys to continue.' };
  }
}
