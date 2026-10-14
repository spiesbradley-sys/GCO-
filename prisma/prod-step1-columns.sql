-- STEP 1 of 2 — add four columns. Additive and idempotent (safe to run twice).
-- Equivalent to what `prisma db push` would do for the current schema.prisma.
-- The currently deployed code ignores these columns, so running this first is safe.
ALTER TABLE desk_clients
  ADD COLUMN IF NOT EXISTS "whiteLabel" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "parent" text;

ALTER TABLE desk_engagements
  ADD COLUMN IF NOT EXISTS "capacity" integer,
  ADD COLUMN IF NOT EXISTS "frequency" text;

-- Verify: expect 4 rows.
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name IN ('desk_clients', 'desk_engagements')
  AND column_name IN ('whiteLabel', 'parent', 'capacity', 'frequency')
ORDER BY 1, 2;
