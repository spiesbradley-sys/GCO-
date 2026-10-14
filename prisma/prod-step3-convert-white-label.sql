-- STEP 3 — convert the Vincere data to the correct model. Run AFTER step 1.
--
-- WHY: Vincere Tax is our ONE client (white label). The businesses we do the work for are
-- NOT GCO clients, so they must not exist as client records. This:
--   1. re-points each end-client engagement to Vincere Tax and puts the business in "End client",
--   2. renames those engagements and their cycles "<Business> (via Vincere Tax) ...",
--   3. deletes the end-client client records (only ones the import created, only once unused).
-- One DO block = one transaction: if anything is wrong it raises and NOTHING changes.
-- Idempotent: after it has run once, re-running changes nothing.
-- Compatible with the currently deployed code (it just sees engagements held directly on Vincere).
DO $$
DECLARE
  v_parent text; v_name text;
BEGIN
  -- Vincere itself: the older, top-level record.
  SELECT id, name INTO STRICT v_parent, v_name
  FROM desk_clients WHERE name ILIKE '%vincere%' AND parent IS NULL;

  UPDATE desk_clients SET "whiteLabel" = true, "updatedBy" = 'import', "updatedAt" = now()
  WHERE id = v_parent AND NOT "whiteLabel";

  -- 1 + 2a. Engagements: end client -> Vincere, with the business named on the engagement.
  UPDATE desk_engagements e
  SET "endClient" = c.name,
      client      = v_parent,
      name        = CASE WHEN e.service = 'Cleanup/Catch-up'
                         THEN c.name || ' (via ' || v_name || ') — Clean-up'
                         ELSE c.name || ' (via ' || v_name || ')' END,
      scope       = replace(coalesce(e.scope, ''), 'White label (' || v_name || ')', 'White label via ' || v_name),
      "updatedBy" = 'import',
      "updatedAt" = now()
  FROM desk_clients c
  WHERE e.client = c.id AND c.parent = v_parent;

  -- 2b. Cycles: "<Business> — Sep 2026"  ->  "<Business> (via Vincere Tax) — Sep 2026".
  UPDATE desk_cycles cy
  SET name = e."endClient" || ' (via ' || v_name || ') — ' || substring(cy.name from position(' — ' in cy.name) + 3),
      "updatedBy" = 'import',
      "updatedAt" = now()
  FROM desk_engagements e
  WHERE cy.engagement = e.id
    AND e.client = v_parent
    AND e."endClient" IS NOT NULL
    AND cy.name NOT LIKE '%(via %'
    AND position(' — ' in cy.name) > 0;

  -- 3. Delete the end-client records the import created, but only if nothing points at them any more.
  DELETE FROM desk_clients c
  WHERE c.parent = v_parent
    AND c."createdBy" = 'import'
    AND NOT EXISTS (SELECT 1 FROM desk_engagements e WHERE e.client = c.id);
END
$$;

-- Verify. Expect: 0 end-client records left, 14 engagements under Vincere with an end client,
-- 23 cycles named "(via Vincere Tax)", Vincere flagged white label.
SELECT
  (SELECT count(*) FROM desk_clients WHERE parent IS NOT NULL)                                              AS end_client_records_left,
  (SELECT count(*) FROM desk_engagements e JOIN desk_clients c ON c.id = e.client
     WHERE c."whiteLabel" AND e."endClient" IS NOT NULL)                                                    AS white_label_engagements,
  (SELECT count(*) FROM desk_cycles WHERE name LIKE '%(via %')                                              AS via_cycles,
  (SELECT "whiteLabel" FROM desk_clients WHERE name ILIKE '%vincere%' AND parent IS NULL)                   AS vincere_white_label,
  (SELECT count(*) FROM desk_clients)                                                                       AS total_clients;
