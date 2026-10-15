-- STEP 7 — owner admin panel: staff-sent client-portal password resets reuse
-- portal_invites with purpose = 'reset'. Run AFTER step 6. Additive and
-- idempotent; existing rows become 'invite', which is what they are.
ALTER TABLE "portal_invites" ADD COLUMN IF NOT EXISTS "purpose" TEXT NOT NULL DEFAULT 'invite';

-- Verify: expect 1 row.
SELECT column_name, column_default FROM information_schema.columns
WHERE table_name = 'portal_invites' AND column_name = 'purpose';
