import 'server-only';

// Dev-stub email delivery. Generates the real links but "delivers" them to the
// server log. Invite links are additionally surfaced to the owner in the Team
// screen (returned from the invite action). Swap this for a real transactional
// provider (Resend/SMTP) via env vars for production — the call sites won't change.
export async function deliverDeskEmail(to: string, subject: string, bodyLink: string): Promise<void> {
  // TODO(email): wire a real provider. For now, log so the flow is testable.
  console.log(`\n[desk-email] To: ${to}\n[desk-email] Subject: ${subject}\n[desk-email] Link: ${bodyLink}\n`);
}
