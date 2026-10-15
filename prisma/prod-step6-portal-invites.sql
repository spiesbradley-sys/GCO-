-- STEP 6 — client-portal invites. Adds portal_invites and the member_joined audit
-- action. Additive and idempotent: safe to run before or after the deploy, and
-- safe to re-run. Nothing existing is altered.
-- (ADD VALUE can't run inside a transaction block on older Postgres; run this file
-- as plain statements, e.g. psql -f, not wrapped in BEGIN/COMMIT.)
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'member_joined' AFTER 'member_invited';

CREATE TABLE IF NOT EXISTS "portal_invites" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "tokenHash" TEXT NOT NULL,
    "invitedBy" TEXT,
    "invitedByEmail" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "portal_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "portal_invites_tokenHash_key" ON "portal_invites"("tokenHash");
CREATE INDEX IF NOT EXISTS "portal_invites_orgId_email_idx" ON "portal_invites"("orgId", "email");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'portal_invites_orgId_fkey') THEN
    ALTER TABLE "portal_invites" ADD CONSTRAINT "portal_invites_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Verify: expect 1 row each.
SELECT table_name FROM information_schema.tables WHERE table_name = 'portal_invites';
SELECT enumlabel FROM pg_enum WHERE enumlabel = 'member_joined';
