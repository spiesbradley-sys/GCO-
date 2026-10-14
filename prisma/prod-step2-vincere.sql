-- STEP 2 of 2 — Vincere end clients, engagements and cycles. Run AFTER step 1.
-- One DO block = one transaction: if anything is wrong it raises and NOTHING is written.
-- Idempotent: matches by name/parent, so re-running adds nothing. It never touches
-- existing clients/engagements/cycles other than ticking "White label" on Vincere.
--
-- People are matched by email (names are blank on invited users):
--   accountant = the one active user whose email starts "prosper."
--   controller = the one active user whose email starts "hillary."
-- Cycle due dates are 8 business days after period end (white label):
--   Sep 2026 / Q3 2026 -> 2026-10-12, Oct 2026 -> 2026-11-11.
DO $$
DECLARE
  v_bk text; v_ctrl text; v_parent text; v_cid text; v_eid text;
  r record; c record;
BEGIN
  SELECT id INTO STRICT v_bk   FROM desk_users WHERE "isActive" AND email ILIKE 'prosper.%';
  SELECT id INTO STRICT v_ctrl FROM desk_users WHERE "isActive" AND email ILIKE 'hillary.%';

  -- White-label parent
  SELECT id INTO v_parent FROM desk_clients WHERE name ILIKE '%vincere%' AND parent IS NULL ORDER BY "createdAt" LIMIT 1;
  IF v_parent IS NULL THEN
    v_parent := 'imp_' || replace(gen_random_uuid()::text, '-', '');
    INSERT INTO desk_clients (id, name, status, "whiteLabel", "createdBy", "updatedBy", "updatedAt")
    VALUES (v_parent, 'Vincere Tax', 'Ongoing', true, 'import', 'import', now());
  ELSE
    UPDATE desk_clients SET "whiteLabel" = true, "updatedBy" = 'import', "updatedAt" = now()
    WHERE id = v_parent AND NOT "whiteLabel";
  END IF;

  -- Recurring end clients: Managed Bookkeeping + cycles that follow the frequency
  FOR r IN
    SELECT * FROM (VALUES
      ('Fur Feather Friends Vet Hospital', 'Monthly',   'B'),
      ('TV Retreats LLC',                  'Monthly',   'C'),
      ('EKMA Holdings',                    'Monthly',   'C'),
      ('Top Suite',                        'Monthly',   'C'),
      ('Knight Street Apartments',         'Monthly',   'C'),
      ('Nishant Memphis',                  'Monthly',   'C'),
      ('Rampar LLC',                       'Quarterly', 'C'),
      ('360 Aviation Advisors',            'Quarterly', 'C'),
      ('Silicon Valley Ventures',          'Quarterly', 'C'),
      ('Swet Seminole',                    'Monthly',   'B'),
      ('Swet St Pete',                     'Monthly',   'B'),
      ('We Swet LLC',                      'Monthly',   'B'),
      ('NJS Holdings',                     'Monthly',   'B')
    ) AS t(cname, freq, prio)
  LOOP
    v_cid := NULL; v_eid := NULL;
    SELECT id INTO v_cid FROM desk_clients WHERE lower(name) = lower(r.cname) AND parent = v_parent LIMIT 1;
    IF v_cid IS NULL THEN
      v_cid := 'imp_' || replace(gen_random_uuid()::text, '-', '');
      INSERT INTO desk_clients (id, name, status, parent, "createdBy", "updatedBy", "updatedAt")
      VALUES (v_cid, r.cname, 'Ongoing', v_parent, 'import', 'import', now());
      INSERT INTO desk_audit_log (id, action, "actorEmail", board, "recordId", summary)
      VALUES ('imp_' || replace(gen_random_uuid()::text, '-', ''), 'record_created', 'import-vincere', 'clients', v_cid, r.cname);
    END IF;

    SELECT id INTO v_eid FROM desk_engagements WHERE client = v_cid AND service = 'Managed Bookkeeping' LIMIT 1;
    IF v_eid IS NULL THEN
      v_eid := 'imp_' || replace(gen_random_uuid()::text, '-', '');
      INSERT INTO desk_engagements
        (id, name, client, service, status, frequency, bookkeeper, controller, "start", scope, "createdBy", "updatedBy", "updatedAt")
      VALUES
        (v_eid, r.cname || ' — Managed Bookkeeping', v_cid, 'Managed Bookkeeping', 'Active', r.freq, v_bk, v_ctrl,
         '2026-09-01', 'White label (Vincere Tax). Priority ' || r.prio || '.', 'import', 'import', now());
      INSERT INTO desk_audit_log (id, action, "actorEmail", board, "recordId", summary)
      VALUES ('imp_' || replace(gen_random_uuid()::text, '-', ''), 'record_created', 'import-vincere', 'engagements', v_eid, r.cname || ' — Managed Bookkeeping');
    END IF;

    -- Monthly: Sep + Oct. Quarterly: only quarter-end months (Sep => Q3 2026).
    FOR c IN
      SELECT * FROM (VALUES
        ('2026-09', 'Capture',        '2026-10-12', 'Sep 2026', 'Q3 2026'),
        ('2026-10', 'Awaiting Close', '2026-11-11', 'Oct 2026', 'Q4 2026')
      ) AS p(mk, stg, due, mlabel, qlabel)
    LOOP
      IF (r.freq = 'Monthly' OR (substr(c.mk, 6, 2)::int % 3) = 0)
         AND NOT EXISTS (SELECT 1 FROM desk_cycles WHERE engagement = v_eid AND left(period, 7) = c.mk) THEN
        INSERT INTO desk_cycles (id, name, engagement, period, stage, "slaDue", "createdBy", "updatedBy", "updatedAt")
        VALUES ('imp_' || replace(gen_random_uuid()::text, '-', ''),
                r.cname || ' — ' || CASE WHEN r.freq = 'Quarterly' THEN c.qlabel ELSE c.mlabel END,
                v_eid, c.mk || '-01', c.stg, c.due, 'import', 'import', now());
      END IF;
    END LOOP;
  END LOOP;

  -- One-off clean-up we are doing for Vincere (no recurring cycles)
  v_cid := NULL; v_eid := NULL;
  SELECT id INTO v_cid FROM desk_clients WHERE lower(name) = 'martin monroe' AND parent = v_parent LIMIT 1;
  IF v_cid IS NULL THEN
    v_cid := 'imp_' || replace(gen_random_uuid()::text, '-', '');
    INSERT INTO desk_clients (id, name, status, parent, "createdBy", "updatedBy", "updatedAt")
    VALUES (v_cid, 'Martin Monroe', 'Ongoing', v_parent, 'import', 'import', now());
  END IF;
  SELECT id INTO v_eid FROM desk_engagements WHERE client = v_cid AND service = 'Cleanup/Catch-up' LIMIT 1;
  IF v_eid IS NULL THEN
    INSERT INTO desk_engagements
      (id, name, client, service, status, bookkeeper, controller, "start", scope, "createdBy", "updatedBy", "updatedAt")
    VALUES
      ('imp_' || replace(gen_random_uuid()::text, '-', ''), 'Martin Monroe — Clean-up', v_cid, 'Cleanup/Catch-up', 'Active', v_bk, v_ctrl,
       '2026-09-28', 'Clean-up job we are doing for Vincere Tax. One-off, so no recurring cycles.', 'import', 'import', now());
  END IF;
END
$$;

-- Verify. Expect (first time): 14 end clients under Vincere, 14 import engagements, 23 import cycles.
SELECT
  (SELECT count(*) FROM desk_clients      WHERE "createdBy" = 'import' AND parent IS NOT NULL) AS end_clients,
  (SELECT count(*) FROM desk_engagements  WHERE "createdBy" = 'import') AS engagements,
  (SELECT count(*) FROM desk_cycles       WHERE "createdBy" = 'import') AS cycles,
  (SELECT "whiteLabel" FROM desk_clients  WHERE name ILIKE '%vincere%' AND parent IS NULL LIMIT 1) AS vincere_white_label;
