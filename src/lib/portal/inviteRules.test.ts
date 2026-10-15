import { describe, expect, it } from 'vitest';
import {
  INVITE_TTL_MS,
  confirmationMatches,
  inviteState,
  normalizeEmail,
  planAccept,
} from './inviteRules';

const now = new Date('2026-10-15T12:00:00Z');
const row = (o: Partial<{ acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date }> = {}) => ({
  acceptedAt: null,
  revokedAt: null,
  expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
  ...o,
});

describe('inviteState', () => {
  it('is valid until it expires, is used, or is revoked', () => {
    expect(inviteState(row(), now)).toBe('valid');
    expect(inviteState(null, now)).toBe('missing');
    expect(inviteState(row({ acceptedAt: now }), now)).toBe('used');
    expect(inviteState(row({ revokedAt: now }), now)).toBe('revoked');
    expect(inviteState(row({ expiresAt: now }), now)).toBe('expired');
  });

  it('treats a used invite as used even after it would have expired', () => {
    expect(inviteState(row({ acceptedAt: now, expiresAt: new Date(0) }), now)).toBe('used');
  });

  it('expires 72 hours after sending', () => {
    const sent = row({ expiresAt: new Date(now.getTime() + INVITE_TTL_MS) });
    expect(inviteState(sent, new Date(now.getTime() + INVITE_TTL_MS - 1))).toBe('valid');
    expect(inviteState(sent, new Date(now.getTime() + INVITE_TTL_MS))).toBe('expired');
  });
});

describe('planAccept', () => {
  it('creates a new client user with the chosen password', () => {
    expect(planAccept({ existing: null, alreadyMember: false, password: 'a-long-passphrase' })).toEqual({
      ok: true,
      createUser: true,
      setPassword: true,
      addMembership: true,
    });
  });

  it('requires a password for a brand-new user', () => {
    const r = planAccept({ existing: null, alreadyMember: false, password: null });
    expect(r.ok).toBe(false);
  });

  it('reuses an existing user and never overwrites their password', () => {
    const existing = { id: 'u1', role: 'client' as const, passwordHash: 'hash' };
    expect(planAccept({ existing, alreadyMember: false, password: 'ignored-new-password' })).toEqual({
      ok: true,
      createUser: false,
      setPassword: false,
      addMembership: true,
    });
  });

  it('sets a password for an existing user who has none (OAuth-only)', () => {
    const existing = { id: 'u1', role: 'client' as const, passwordHash: null };
    const r = planAccept({ existing, alreadyMember: false, password: 'a-long-passphrase' });
    expect(r).toMatchObject({ ok: true, createUser: false, setPassword: true });
    expect(planAccept({ existing, alreadyMember: false, password: null }).ok).toBe(false);
  });

  it('is a no-op on membership when they already belong to the org', () => {
    const existing = { id: 'u1', role: 'gco_staff' as const, passwordHash: 'hash' };
    expect(planAccept({ existing, alreadyMember: true, password: null })).toMatchObject({ ok: true, addMembership: false });
  });
});

describe('helpers', () => {
  it('normalizes emails so invites match existing users', () => {
    expect(normalizeEmail('  Dana@Practice.COM ')).toBe('dana@practice.com');
  });

  it('confirms revocation only on the exact name (case/space-insensitive), or email when unnamed', () => {
    expect(confirmationMatches(' dana  okafor ', { name: 'Dana Okafor', email: 'd@x.com' })).toBe(true);
    expect(confirmationMatches('Dana', { name: 'Dana Okafor', email: 'd@x.com' })).toBe(false);
    expect(confirmationMatches('d@x.com', { name: null, email: 'd@x.com' })).toBe(true);
  });
});
