-- STEP 9 — monthly utilization in hours. Adds desk_time_entries and a monthly
-- capacity on desk_users. Additive and idempotent: safe to run before the
-- deploy and safe to re-run. Nothing existing is altered.
ALTER TABLE "desk_users" ADD COLUMN IF NOT EXISTS "monthlyHours" INTEGER;

CREATE TABLE IF NOT EXISTS "desk_time_entries" (
    "id" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "engagement" TEXT,
    "date" TEXT NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    CONSTRAINT "desk_time_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "desk_time_entries_date_idx" ON "desk_time_entries"("date");
CREATE INDEX IF NOT EXISTS "desk_time_entries_user_date_idx" ON "desk_time_entries"("user", "date");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'desk_time_entries_user_fkey') THEN
    ALTER TABLE "desk_time_entries" ADD CONSTRAINT "desk_time_entries_user_fkey"
      FOREIGN KEY ("user") REFERENCES "desk_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Verify: expect 1 row, then 1 row.
SELECT table_name FROM information_schema.tables WHERE table_name = 'desk_time_entries';
SELECT column_name FROM information_schema.columns WHERE table_name = 'desk_users' AND column_name = 'monthlyHours';
