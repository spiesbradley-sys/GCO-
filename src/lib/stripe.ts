import 'server-only';
import Stripe from 'stripe';

// Server-side Stripe client. The app uses provider-hosted flows only (Checkout /
// Payment Element) — it NEVER collects, transmits, or stores card or bank
// numbers. We persist Stripe references (customer / payment intent / checkout
// session ids) and statuses, nothing more.
//
// TODO: set STRIPE_SECRET_KEY in .env. Kept lazily instantiated so the app can
// build without the key present.
let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set — configure Stripe before taking payments.');
  }
  if (!client) {
    // apiVersion intentionally omitted — use the account default and avoid a
    // version-literal mismatch across stripe package upgrades.
    client = new Stripe(process.env.STRIPE_SECRET_KEY, { typescript: true });
  }
  return client;
}
