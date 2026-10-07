import 'server-only';

// Transactional email for the desk. When RESEND_API_KEY is set, invites and
// resets are emailed via Resend's REST API; otherwise the link is logged (and,
// for invites, shown to the owner in the Team screen). Swapping providers only
// touches this file.

function emailHtml(heading: string, intro: string, link: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f2f2f2;font-family:'Open Sans',Arial,sans-serif;color:#251c1a">
  <div style="max-width:480px;margin:0 auto;padding:32px 16px">
    <div style="font-family:Montserrat,Arial,sans-serif;font-weight:800;color:#9c7804;font-size:18px;margin-bottom:4px">GCO Partners</div>
    <div style="color:#6f6a62;font-size:13px;margin-bottom:24px">Service Desk</div>
    <div style="background:#ffffff;border-radius:12px;padding:28px">
      <h1 style="font-family:Montserrat,Arial,sans-serif;font-size:20px;margin:0 0 10px">${heading}</h1>
      <p style="font-size:15px;line-height:1.5;color:#5c5250;margin:0 0 20px">${intro}</p>
      <a href="${link}" style="display:inline-block;background:#9c7804;color:#ffffff;text-decoration:none;font-family:Montserrat,Arial,sans-serif;font-weight:700;font-size:15px;padding:11px 20px;border-radius:999px">Open the link</a>
      <p style="font-size:12.5px;color:#6f6a62;margin:20px 0 0;word-break:break-all">Or paste this into your browser:<br>${link}</p>
    </div>
    <p style="color:#6f6a62;font-size:12px;margin-top:20px">If you weren't expecting this, you can ignore it.</p>
  </div></body></html>`;
}

type Kind = 'invite' | 'reset';

export async function deliverDeskEmail(to: string, subject: string, link: string, kind: Kind = 'invite'): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`\n[desk-email] To: ${to}\n[desk-email] Subject: ${subject}\n[desk-email] Link: ${link}\n`);
    return;
  }
  const from = process.env.DESK_EMAIL_FROM || 'GCO Service Desk <onboarding@resend.dev>';
  const heading = kind === 'reset' ? 'Reset your password' : 'You are invited to the GCO Service Desk';
  const intro =
    kind === 'reset'
      ? 'Use the button below to choose a new password. This link expires in one hour.'
      : 'You have been invited to the GCO Partners Service Desk. Use the button below to set your password and sign in. This link expires in 72 hours.';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html: emailHtml(heading, intro, link) }),
    });
    if (!res.ok) {
      console.error('[desk-email] Resend failed', res.status, await res.text().catch(() => ''));
    }
  } catch (err) {
    console.error('[desk-email] send error', err);
  }
}
