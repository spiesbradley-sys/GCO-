import { PrismaClient } from '@prisma/client';

// Single PrismaClient instance across hot-reloads in dev.
//
// IMPORTANT: prefer the tenant-scoped client from `src/lib/tenant.ts` for any
// tenant-scoped table. Use this raw client only for identity/auth tables
// (User, Account, Session) and for writing the audit log.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
