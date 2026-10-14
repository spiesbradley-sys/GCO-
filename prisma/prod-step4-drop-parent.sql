-- STEP 4 (optional cleanup) — run ONLY AFTER the new code is deployed and step 3 has run.
-- The old model linked "end client" records to Vincere through desk_clients.parent. The new
-- model does not use it, and the schema no longer lists it. Dropping it is safe once nothing
-- references it; the guard below refuses to drop it while any value is still set.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'desk_clients' AND column_name = 'parent') THEN
    IF (SELECT count(*) FROM desk_clients WHERE parent IS NOT NULL) > 0 THEN
      RAISE EXCEPTION 'desk_clients.parent still has values — run step 3 first';
    END IF;
    ALTER TABLE desk_clients DROP COLUMN parent;
  END IF;
END
$$;
