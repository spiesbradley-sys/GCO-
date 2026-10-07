import 'server-only';
import { randomBytes, createHash, createHmac } from 'crypto';

function secret(): string {
  return process.env.DESK_TOKEN_SECRET || process.env.AUTH_SECRET || 'dev-insecure-desk-secret';
}

/** Stateless HMAC-signed token (used for public per-prospect intake links). */
export function signPayload(obj: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
  const mac = createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

export function verifyPayload<T = Record<string, unknown>>(token: string): T | null {
  const [body, mac] = (token || '').split('.');
  if (!body || !mac) return null;
  const expect = createHmac('sha256', secret()).update(body).digest('base64url');
  if (mac.length !== expect.length || mac !== expect) return null;
  try {
    const obj = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T & { exp?: number };
    if (obj.exp && Date.now() > obj.exp) return null;
    return obj;
  } catch {
    return null;
  }
}

// Opaque single-use tokens for invites, password resets and sessions. The raw
// token goes in the URL/cookie; only its SHA-256 hash is stored in the DB, so a
// DB leak never yields usable tokens. (Equivalent in effect to a signed token
// whose secret is the DB row.)

export function newToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
