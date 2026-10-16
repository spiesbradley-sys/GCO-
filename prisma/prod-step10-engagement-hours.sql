-- STEP 10 — hours required per month on each engagement, split into
-- controller and accountant time. Additive and idempotent: safe to run before
-- the deploy and safe to re-run. Nothing existing is altered.
ALTER TABLE "desk_engagements"
  ADD COLUMN IF NOT EXISTS "controllerHours" INTEGER,
  ADD COLUMN IF NOT EXISTS "accountantHours" INTEGER;

-- Verify: expect 2 rows (accountantHours, controllerHours).
SELECT column_name FROM information_schema.columns
WHERE table_name = 'desk_engagements'
  AND column_name IN ('controllerHours', 'accountantHours')
ORDER BY column_name;
