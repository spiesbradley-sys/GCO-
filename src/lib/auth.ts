import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from './prisma';
import { recordAudit } from './audit';

// ─────────────────────────────────────────────────────────────────────────────
// Auth.js (NextAuth v5) configuration
//
// Strategy: JWT session cookie (required for the Credentials provider). The
// Prisma adapter still links OAuth accounts. The session is enriched with the
// user's platform role and org memberships so route guards can resolve
// permissions BEFORE render.
//
// Login errors are intentionally generic ("Email or password is incorrect") —
// never disclose which field was wrong.
// ─────────────────────────────────────────────────────────────────────────────

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: false,
    }),
    // TODO: add an Email (magic-link) provider once SMTP is configured.
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({ where: { email } });
        // Generic failure — no distinction between "no user" and "bad password".
        if (!user?.passwordHash) {
          await recordAudit({ action: 'login_failed', target: email });
          return null;
        }
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          await recordAudit({ action: 'login_failed', actorId: user.id, target: email });
          return null;
        }
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  callbacks: {
    // Put role + memberships on the token so downstream reads never hit the DB
    // just to resolve permissions.
    async jwt({ token, user }) {
      if (user?.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          include: { memberships: { include: { org: true } } },
        });
        if (dbUser) {
          token.uid = dbUser.id;
          token.role = dbUser.role;
          token.memberships = dbUser.memberships.map((m) => ({
            orgId: m.orgId,
            orgName: m.org.name,
            orgType: m.org.type,
            role: m.role,
          }));
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) ?? session.user.id;
        session.user.role = token.role as never;
        session.user.memberships = (token.memberships as never) ?? [];
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      await recordAudit({ action: 'login', actorId: user.id ?? null, target: user.email ?? null });
    },
    async signOut(message) {
      const token = 'token' in message ? message.token : null;
      await recordAudit({ action: 'logout', actorId: (token?.uid as string) ?? null });
    },
  },
});
