import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';

// Transactional email for the desk. One transport, chosen by env:
//   1. SMTP  — send from your own mailbox (Microsoft 365, Google Workspace…).
//      Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS. From = DESK_EMAIL_FROM
//      (or SMTP_USER). This is what makes mail come from bradley.spies@gcopartners.com.
//   2. Resend — set RESEND_API_KEY (used if SMTP isn't configured, or as a
//      fallback if an SMTP send throws).
//   3. Neither — the message is logged (and invite links are also shown to the
//      owner in the Team screen), so local dev still works.
// Swapping or adding providers only touches this file.

const FROM_DEFAULT = 'GCO Service Desk <onboarding@resend.dev>';
function fromAddress(): string {
  return process.env.DESK_EMAIL_FROM || process.env.SMTP_USER || FROM_DEFAULT;
}

let _smtp: Transporter | null = null;
function smtpTransport(): Transporter {
  if (_smtp) return _smtp;
  const port = Number(process.env.SMTP_PORT || 587);
  _smtp = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
    requireTLS: port !== 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return _smtp;
}

/**
 * Central send. Prefers SMTP (your own mailbox) when configured, then Resend,
 * else logs. Never throws — a delivery failure must not break the desk action
 * that triggered it. `logHint` (e.g. a link) is printed when no transport is set.
 */
async function sendEmail(to: string, subject: string, html: string, logHint?: string): Promise<void> {
  const from = fromAddress();

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      await smtpTransport().sendMail({ from, to, subject, html });
      return;
    } catch (err) {
      console.error('[desk-email] SMTP send error', err);
      // fall through to Resend if that is also configured
    }
  }

  const key = process.env.RESEND_API_KEY;
  if (key) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, subject, html }),
      });
      if (!res.ok) console.error('[desk-email] Resend failed', res.status, await res.text().catch(() => ''));
    } catch (err) {
      console.error('[desk-email] Resend error', err);
    }
    return;
  }

  console.log(`\n[desk-email] (no transport) To: ${to}\n[desk-email] Subject: ${subject}${logHint ? `\n[desk-email] ${logHint}` : ''}\n`);
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function shell(inner: string, maxWidth = 480): string {
  return `<!doctype html><html><body style="margin:0;background:#f2f2f2;font-family:'Open Sans',Arial,sans-serif;color:#251c1a">
  <div style="max-width:${maxWidth}px;margin:0 auto;padding:32px 16px">
    <div style="font-family:Montserrat,Arial,sans-serif;font-weight:800;color:#9c7804;font-size:18px;margin-bottom:4px">GCO Partners</div>
    <div style="color:#6f6a62;font-size:13px;margin-bottom:24px">Service Desk</div>
    ${inner}
  </div></body></html>`;
}

const button = (link: string, label: string) =>
  `<a href="${link}" style="display:inline-block;background:#9c7804;color:#ffffff;text-decoration:none;font-family:Montserrat,Arial,sans-serif;font-weight:700;font-size:15px;padding:11px 20px;border-radius:999px">${label}</a>`;

function emailHtml(heading: string, intro: string, link: string, cta = 'Open the link'): string {
  return shell(`<div style="background:#ffffff;border-radius:12px;padding:28px">
      <h1 style="font-family:Montserrat,Arial,sans-serif;font-size:20px;margin:0 0 10px">${heading}</h1>
      <p style="font-size:15px;line-height:1.5;color:#5c5250;margin:0 0 20px">${intro}</p>
      ${button(link, cta)}
      <p style="font-size:12.5px;color:#6f6a62;margin:20px 0 0;word-break:break-all">Or paste this into your browser:<br>${link}</p>
    </div>
    <p style="color:#6f6a62;font-size:12px;margin-top:20px">You're receiving this because you're on the GCO Service Desk.</p>`);
}

type Kind = 'invite' | 'reset';

export async function deliverDeskEmail(to: string, subject: string, link: string, kind: Kind = 'invite'): Promise<void> {
  const heading = kind === 'reset' ? 'Reset your password' : 'You are invited to the GCO Service Desk';
  const intro =
    kind === 'reset'
      ? 'Use the button below to choose a new password. This link expires in one hour.'
      : 'You have been invited to the GCO Partners Service Desk. Use the button below to set your password and sign in. This link expires in 72 hours.';
  await sendEmail(to, subject, emailHtml(heading, intro, link), `Link: ${link}`);
}

/** Generic desk notification email (assignment, new cycle, query, review…).
 * Shares the invite/reset template. Never throws. */
export async function deliverDeskNotificationEmail(
  to: string,
  opts: { subject: string; heading: string; intro: string; link: string; cta?: string },
): Promise<void> {
  await sendEmail(to, opts.subject, emailHtml(opts.heading, opts.intro, opts.link, opts.cta ?? 'Open the desk'), `Link: ${opts.link}`);
}

/** Daily "My Day" digest: a short list of what's on someone's plate. Never throws. */
export async function deliverDigestEmail(
  to: string,
  opts: { name: string; link: string; groups: { label: string; items: string[] }[] },
): Promise<void> {
  const subject = 'Your desk — what needs you today';
  const first = (opts.name || '').split(' ')[0] || opts.name;
  const groupsHtml = opts.groups
    .filter((g) => g.items.length)
    .map(
      (g) => `<div style="margin:0 0 18px">
        <div style="font-family:Montserrat,Arial,sans-serif;font-weight:700;font-size:13px;color:#9c7804;text-transform:uppercase;letter-spacing:.04em;margin:0 0 8px">${esc(g.label)}</div>
        ${g.items
          .map(
            (it) =>
              `<div style="font-size:14px;line-height:1.45;color:#251c1a;padding:8px 12px;background:#f7f5f0;border-radius:8px;margin:0 0 6px">${esc(it)}</div>`,
          )
          .join('')}
      </div>`,
    )
    .join('');
  const html = shell(
    `<div style="background:#ffffff;border-radius:12px;padding:28px">
      <h1 style="font-family:Montserrat,Arial,sans-serif;font-size:20px;margin:0 0 6px">Good morning, ${esc(first)}</h1>
      <p style="font-size:14px;line-height:1.5;color:#6f6a62;margin:0 0 20px">Here's what's waiting on you today.</p>
      ${groupsHtml}
      ${button(opts.link, 'Open My Day')}
    </div>
    <p style="color:#6f6a62;font-size:12px;margin-top:20px">You only get this on days something needs you.</p>`,
    520,
  );
  await sendEmail(to, subject, html, `Link: ${opts.link}`);
}

/** Notify a desk user of a new comment on a row. Never throws. */
export async function deliverCommentEmail(
  to: string,
  opts: { author: string; boardLabel: string; recordName: string; body: string; link: string },
): Promise<void> {
  const subject = `${opts.author} commented on ${opts.recordName}`;
  const excerpt = esc(opts.body.length > 400 ? `${opts.body.slice(0, 400)}…` : opts.body).replace(/\n/g, '<br>');
  const html = shell(`<div style="background:#ffffff;border-radius:12px;padding:28px">
      <h1 style="font-family:Montserrat,Arial,sans-serif;font-size:18px;margin:0 0 6px">${esc(opts.author)} commented</h1>
      <p style="font-size:13px;color:#6f6a62;margin:0 0 16px">${esc(opts.boardLabel)} · ${esc(opts.recordName)}</p>
      <p style="font-size:15px;line-height:1.5;color:#251c1a;background:#f7f5f0;border-radius:8px;padding:12px 14px;margin:0 0 20px">${excerpt}</p>
      ${button(opts.link, 'Open the discussion')}
    </div>`);
  await sendEmail(to, subject, html, `Link: ${opts.link}`);
}
