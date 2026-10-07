import 'server-only';
import bcrypt from 'bcryptjs';

// Password hashing behind a small interface so argon2id can swap in on a server
// that supports the native build. Here we use bcrypt (pure JS) at cost 12 — the
// prompt permits this when argon2 is unavailable, which it is in this portable,
// no-native-build environment.
const BCRYPT_COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

// A small bundled list of the most common / breached passwords. A production
// deployment should swap this for a HaveIBeenPwned k-anonymity lookup; bundled
// here so the check works offline / on the tunnel.
const COMMON = new Set(
  [
    'password',
    'password1',
    'password123',
    'passw0rd',
    '123456',
    '12345678',
    '123456789',
    '1234567890',
    'qwerty',
    'qwerty123',
    'letmein',
    'welcome',
    'welcome1',
    'admin',
    'administrator',
    'iloveyou',
    'monkey',
    'dragon',
    'abc123',
    'football',
    'baseball',
    'sunshine',
    'princess',
    'trustno1',
    'changeme',
    'changeme123',
    'login',
    'starwars',
    'whatever',
    'superman',
    'gcopartners',
    'gcopartners1',
    'servicedesk',
  ].map((p) => p.toLowerCase()),
);

/** Returns an error message if the password is unacceptable, else null. */
export function validatePasswordStrength(plain: string): string | null {
  if (!plain || plain.length < 12) return 'Use at least 12 characters.';
  if (plain.length > 200) return 'That password is too long.';
  const lower = plain.toLowerCase();
  if (COMMON.has(lower)) return 'That password is too common. Choose something harder to guess.';
  // Reject trivial repeats / sequences.
  if (/^(.)\1+$/.test(plain)) return 'That password is too simple.';
  return null;
}
