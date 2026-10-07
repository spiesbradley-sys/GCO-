import 'server-only';
import { headers } from 'next/headers';

// Lightweight in-memory fixed-window rate limiter for login / reset / invite
// accept. Per-process only (fine for a single-instance prototype). For
// production, back this with Redis or a durable store.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}

export function clientKey(suffix = ''): string {
  const ip = headers().get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  return `${ip}:${suffix}`;
}
