-- STEP 1 — add the columns the white-label model needs. Additive and idempotent
-- (safe to run any number of times; columns that already exist are skipped).
-- The currently deployed code ignores columns it does not know, so this is safe first.
ALTER TABLE desk_clients
  ADD COLUMN IF NOT EXISTS "whiteLabel" boolean NOT NULL DEFAULT false;

ALTER TABLE desk_engagements
  ADD COLUMN IF NOT EXISTS "capacity" integer,
  ADD COLUMN IF NOT EXISTS "frequency" text,
  ADD COLUMN IF NOT EXISTS "endClient" text;

-- Verify: expect 4 rows (whiteLabel, capacity, frequency, endClient).
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name IN ('desk_clients', 'desk_engagements')
  AND column_name IN ('whiteLabel', 'capacity', 'frequency', 'endClient')
ORDER BY 1, 2;
