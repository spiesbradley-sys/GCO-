import 'server-only';
import { headers } from 'next/headers';

/**
 * Canonical origin for links in desk emails and notifications.
 *
 * Order matters: we prefer an explicitly configured URL, then Vercel's
 * production domain, and only then the request host. This guarantees links in
 * invites, resets and notifications always point at the canonical production
 * site — never at a preview/deployment-specific URL that runs against a
 * different database (the cause of "I set my password but can't log in").
 * Falls back to localhost for local dev, and works outside a request (cron).
 */
export function deskBaseUrl(): string {
  const configured = process.env.DESK_BASE_URL?.replace(/\/+$/, '');
  if (configured) return configured;

  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProd) return `https://${vercelProd.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;

  try {
    const h = headers();
    const host = h.get('host');
    if (host) return `${h.get('x-forwarded-proto') ?? 'http'}://${host}`;
  } catch {
    // No request context (e.g. a cron invocation) — fall through to the default.
  }

  return process.env.NODE_ENV === 'production' ? 'https://gco-seven.vercel.app' : 'http://localhost:3000';
}
