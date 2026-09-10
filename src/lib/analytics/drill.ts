import type { ArBucketKey, KpiKey } from './types';

// Drill targets are encoded into the URL as an OPAQUE token — a base64url blob of
// a structured ref that contains only ids and enum tags. Never a patient/payer
// name, client/practice name, or invoice number. The drawer resolves the token
// to content server-side after auth + tenant checks (service.resolveDrill).
//
// NOTE: base64url is opaque (not human-readable) but reversible; the ids inside
// are themselves opaque (cuids / synthetic ids). For stronger guarantees, swap
// encode/decode for a server-signed token later — the call sites won't change.

export type DrillRef =
  | { t: 'kpi'; metric: KpiKey }
  | { t: 'cashflow'; bucketId: string }
  | { t: 'ar-bucket'; bucket: ArBucketKey }
  | { t: 'ar-loc'; locationId: string; bucket?: ArBucketKey }
  | { t: 'ar-payer'; payerId: string; bucket?: ArBucketKey }
  | { t: 'invoice'; invoiceId: string }
  | { t: 'location'; locationId: string }
  | { t: 'pnl-line'; lineId: string }
  | { t: 'addback'; stepId: string }
  | { t: 'provider'; providerId: string };

// Isomorphic base64 (server: Buffer, browser: btoa/atob). Refs contain only
// ASCII ids and enum tags, so plain base64 is safe.
function b64encode(s: string): string {
  return typeof window === 'undefined'
    ? Buffer.from(s, 'utf8').toString('base64')
    : window.btoa(s);
}
function b64decode(s: string): string {
  return typeof window === 'undefined'
    ? Buffer.from(s, 'base64').toString('utf8')
    : window.atob(s);
}

export function encodeDrill(ref: DrillRef): string {
  const json = JSON.stringify(ref);
  return b64encode(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeDrill(token: string | null | undefined): DrillRef | null {
  if (!token) return null;
  try {
    const b64 = token.replace(/-/g, '+').replace(/_/g, '/');
    const json = b64decode(b64);
    const ref = JSON.parse(json) as DrillRef;
    if (!ref || typeof ref !== 'object' || typeof (ref as { t?: unknown }).t !== 'string') {
      return null;
    }
    return ref;
  } catch {
    return null;
  }
}
