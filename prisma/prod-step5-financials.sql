-- STEP 5 — client portal financials. Adds desk_financials (one row per workbook
-- uploaded on a cycle). Additive and idempotent: safe to run before or after the
-- deploy, and safe to re-run. Nothing existing is altered.
CREATE TABLE IF NOT EXISTS "desk_financials" (
    "id" TEXT NOT NULL,
    "cycle" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "desk_financials_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "desk_financials_cycle_createdAt_idx" ON "desk_financials"("cycle", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'desk_financials_cycle_fkey') THEN
    ALTER TABLE "desk_financials" ADD CONSTRAINT "desk_financials_cycle_fkey"
      FOREIGN KEY ("cycle") REFERENCES "desk_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Verify: expect 1 row.
SELECT table_name FROM information_schema.tables WHERE table_name = 'desk_financials';
