import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';

// Stripe webhook: reconciles invoice/payment status from provider events. The
// signature is ALWAYS verified against STRIPE_WEBHOOK_SECRET — unsigned or
// mismatched requests are rejected. We read Stripe references from the event and
// scope every DB write by the orgId we stamped into metadata at checkout.
//
// Raw body is required for signature verification — do not parse as JSON first.
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get('stripe-signature');
  if (!secret || !signature) {
    return NextResponse.json({ error: 'Missing webhook secret or signature' }, { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    console.error('[stripe] signature verification failed', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await reconcilePayment({
          checkoutSessionId: session.id,
          paymentIntentId:
            typeof session.payment_intent === 'string' ? session.payment_intent : undefined,
          customerId: typeof session.customer === 'string' ? session.customer : undefined,
          status: 'succeeded',
          invoiceId: session.metadata?.invoiceId,
          orgId: session.metadata?.orgId,
        });
        break;
      }
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await reconcilePayment({
          paymentIntentId: pi.id,
          customerId: typeof pi.customer === 'string' ? pi.customer : undefined,
          status: 'succeeded',
          invoiceId: pi.metadata?.invoiceId,
          orgId: pi.metadata?.orgId,
        });
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await reconcilePayment({
          paymentIntentId: pi.id,
          status: 'failed',
          invoiceId: pi.metadata?.invoiceId,
          orgId: pi.metadata?.orgId,
        });
        break;
      }
      default:
        // Unhandled event types are acknowledged so Stripe stops retrying.
        break;
    }
  } catch (err) {
    console.error('[stripe] handler error', event.type, err);
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function reconcilePayment(input: {
  checkoutSessionId?: string;
  paymentIntentId?: string;
  customerId?: string;
  status: 'succeeded' | 'failed';
  invoiceId?: string;
  orgId?: string;
}) {
  if (!input.invoiceId || !input.orgId) return;

  // Update the payment row (matched by whichever Stripe reference we have).
  const where = input.checkoutSessionId
    ? { stripeCheckoutSessionId: input.checkoutSessionId }
    : input.paymentIntentId
      ? { stripePaymentIntentId: input.paymentIntentId }
      : null;

  if (where) {
    await prisma.payment.updateMany({
      where: { ...where, orgId: input.orgId },
      data: {
        status: input.status,
        stripePaymentIntentId: input.paymentIntentId,
        stripeCustomerId: input.customerId,
      },
    });
  }

  if (input.status === 'succeeded') {
    await prisma.invoice.updateMany({
      where: { id: input.invoiceId, orgId: input.orgId },
      data: { status: 'paid' },
    });
    await recordAudit({
      action: 'payment_succeeded',
      orgId: input.orgId,
      targetId: input.invoiceId,
      metadata: { paymentIntentId: input.paymentIntentId },
    });
  } else {
    await recordAudit({
      action: 'payment_failed',
      orgId: input.orgId,
      targetId: input.invoiceId,
      metadata: { paymentIntentId: input.paymentIntentId },
    });
  }
}
