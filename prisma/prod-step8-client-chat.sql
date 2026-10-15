-- STEP 8 — client ↔ GCO chat. Adds client_messages and two read markers on
-- desk_clients. Additive and idempotent: safe to run before the deploy and safe
-- to re-run. Nothing existing is altered.
ALTER TABLE "desk_clients" ADD COLUMN IF NOT EXISTS "chatStaffReadAt" TIMESTAMP(3);
ALTER TABLE "desk_clients" ADD COLUMN IF NOT EXISTS "chatClientReadAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "client_messages" (
    "id" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "fromClient" BOOLEAN NOT NULL,
    "authorUserId" TEXT,
    "authorDeskUserId" TEXT,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "client_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "client_messages_client_createdAt_idx" ON "client_messages"("client", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_messages_client_fkey') THEN
    ALTER TABLE "client_messages" ADD CONSTRAINT "client_messages_client_fkey"
      FOREIGN KEY ("client") REFERENCES "desk_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Verify: expect 1 row, then 2 rows.
SELECT table_name FROM information_schema.tables WHERE table_name = 'client_messages';
SELECT column_name FROM information_schema.columns WHERE table_name = 'desk_clients' AND column_name IN ('chatStaffReadAt', 'chatClientReadAt');
