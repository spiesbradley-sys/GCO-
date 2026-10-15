import type { Role } from '@prisma/client';

// Pure rules for client-portal invites, kept free of DB/framework imports so they
// are unit-tested directly (inviteRules.test.ts). The server actions in
// src/desk/actions/portal.ts and src/actions/invite.ts apply them.

export const INVITE_TTL_MS = 72 * 60 * 60 * 1000;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type InviteRow = { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date };
export type InviteState = 'valid' | 'missing' | 'used' | 'revoked' | 'expired';

export function inviteState(invite: InviteRow | null, now = new Date()): InviteState {
  if (!invite) return 'missing';
  if (invite.acceptedAt) return 'used';
  if (invite.revokedAt) return 'revoked';
  if (invite.expiresAt.getTime() <= now.getTime()) return 'expired';
  return 'valid';
}

/** Same words for every unusable state, so a link never reveals more than "doesn't work". */
export const INVITE_UNUSABLE = 'This invite link has expired or has already been used. Ask your GCO controller to send a new one.';

export type ExistingUser = { id: string; role: Role; passwordHash: string | null } | null;

export type AcceptPlan =
  | { ok: false; error: string }
  | {
      ok: true;
      /** Create a new User with platform role `client`. */
      createUser: boolean;
      /** Store the submitted password (new users, or existing users who have none). */
      setPassword: boolean;
      /** False when the user already belongs to the org (accept is then a no-op). */
      addMembership: boolean;
    };

/**
 * What accepting an invite does for this person.
 * - New email → create a client user with the chosen password.
 * - Existing user WITH a password → keep their password (the invite link proves
 *   the inbox, not that they want their login changed); just add the membership.
 * - Existing user WITHOUT a password (e.g. Google-only) → set the chosen password.
 * The platform role of an existing user is never changed, so a GCO staff account
 * accepting an invite stays staff.
 */
export function planAccept(input: { existing: ExistingUser; alreadyMember: boolean; password: string | null }): AcceptPlan {
  const { existing, alreadyMember, password } = input;
  const needsPassword = !existing || !existing.passwordHash;
  if (needsPassword && !password) return { ok: false, error: 'Choose a password to finish setting up your login.' };
  return {
    ok: true,
    createUser: !existing,
    setPassword: needsPassword,
    addMembership: !alreadyMember,
  };
}

/** Typed confirmation for revoking access: the person's name (or email), case-insensitive. */
export function confirmationTarget(person: { name: string | null; email: string }): string {
  return person.name?.trim() || person.email;
}

export function confirmationMatches(typed: string, person: { name: string | null; email: string }): boolean {
  return typed.trim().replace(/\s+/g, ' ').toLowerCase() === confirmationTarget(person).replace(/\s+/g, ' ').toLowerCase();
}

/** Platform roles that are GCO-internal; their memberships aren't managed from a client's portal list. */
export const INTERNAL_ROLES: Role[] = ['gco_staff', 'admin'];
