-- ===========================================================================
-- PD · STATE-CHECK.sql — which migrations are actually applied?
--
-- Written 11 September 2026. READ-ONLY. It creates nothing, changes nothing
-- and locks nothing. Safe to run on the live database with people signed in.
--
-- WHY IT EXISTS. 003, 004, 005 and 006 are run by hand, one at a time, in
-- phpMyAdmin. There is no migrations table, so a week later nobody can say
-- from the repo which of them reached the database. This file asks the
-- database itself and answers in sentences.
--
-- AMENDED 11 September 2026 — 007 added to PART 1.
--
-- HOW TO USE IT. phpMyAdmin → the PD database → SQL tab → paste PART 1 →
-- Go. Read the `verdict` column. Then run PART 2 only where PART 1 says a
-- column or table exists; PART 2 reads columns that do not exist until their
-- migration has run, so running it early gives a MySQL error rather than an
-- answer.
-- ===========================================================================


-- ===========================================================================
-- PART 1 — structure. Always safe. Reads information_schema only, so nothing
-- here can error because a table or column is missing — that IS the answer.
-- ===========================================================================

SELECT '003 (a)' AS migration, 'pd_field_history table' AS checks,
       IF(COUNT(*) > 0, 'APPLIED', 'NOT APPLIED') AS verdict,
       CONCAT(COUNT(*), ' table') AS detail
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pd_field_history'

UNION ALL
SELECT '003 (a)', 'append-only triggers on pd_field_history',
       CASE COUNT(*) WHEN 2 THEN 'APPLIED' WHEN 0 THEN 'NOT APPLIED'
            ELSE 'PARTIAL - LOOK AT THIS' END,
       CONCAT(COUNT(*), ' of 2 triggers (expect no_update + no_delete)')
  FROM information_schema.TRIGGERS
 WHERE TRIGGER_SCHEMA = DATABASE()
   AND EVENT_OBJECT_TABLE = 'pd_field_history'

UNION ALL
SELECT '003 (b)', 'pd_notices table',
       IF(COUNT(*) > 0, 'APPLIED', 'NOT APPLIED'), CONCAT(COUNT(*), ' table')
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pd_notices'

UNION ALL
SELECT '003 (c)', 'pd_observations.door_chosen column',
       IF(COUNT(*) > 0, 'APPLIED', 'NOT APPLIED'), CONCAT(COUNT(*), ' column')
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pd_observations'
   AND COLUMN_NAME = 'door_chosen'

UNION ALL
SELECT '004 (1a)', 'pd_materials assay columns made nullable',
       CASE COUNT(*) WHEN 5 THEN 'APPLIED' WHEN 0 THEN 'NOT APPLIED'
            ELSE 'PARTIAL - LOOK AT THIS' END,
       CONCAT(COUNT(*), ' of 5 nullable (n, p2o5, k2o, s, zn)')
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pd_materials'
   AND COLUMN_NAME IN ('n_pct','p2o5_pct','k2o_pct','s_pct','zn_pct')
   AND IS_NULLABLE = 'YES'

UNION ALL
SELECT '004 (1b/1c)', 'pd_materials.physical_form + grade_source columns',
       CASE COUNT(*) WHEN 2 THEN 'APPLIED' WHEN 0 THEN 'NOT APPLIED'
            ELSE 'PARTIAL - LOOK AT THIS' END,
       CONCAT(COUNT(*), ' of 2 columns')
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pd_materials'
   AND COLUMN_NAME IN ('physical_form','grade_source')

UNION ALL
SELECT '005', 'UNIQUE (claim_number, version) on pd_claims',
       IF(COUNT(*) > 0, 'APPLIED', 'NOT APPLIED'),
       CONCAT(COUNT(*), ' index named uq_claim_number_version')
  FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pd_claims'
   AND INDEX_NAME = 'uq_claim_number_version' AND SEQ_IN_INDEX = 1

UNION ALL
SELECT '006', 'pd_role ENUM carries the two new roles',
       CASE WHEN MAX(COLUMN_TYPE) LIKE '%field_agronomy%'
             AND MAX(COLUMN_TYPE) LIKE '%associate_agronomy%' THEN 'APPLIED'
            WHEN MAX(COLUMN_TYPE) LIKE '%field_agronomy%'
              OR MAX(COLUMN_TYPE) LIKE '%associate_agronomy%'
                 THEN 'PARTIAL - LOOK AT THIS'
            ELSE 'NOT APPLIED' END,
       LEFT(MAX(COLUMN_TYPE), 200)
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'auth_users'
   AND COLUMN_NAME = 'pd_role'

UNION ALL
SELECT '007', 'the plant-wide context exists (id 90)',
       IF(COUNT(*) > 0, 'APPLIED', 'NOT APPLIED'),
       CONCAT(COUNT(*), ' row — without it a plant-capability rule has nowhere to live')
  FROM pd_delivery_contexts
 WHERE id = 90 AND name = 'plant-wide — what we can actually make';


-- ===========================================================================
-- PART 2 — content. Run each block only if PART 1 says its structure exists.
-- ===========================================================================

-- 2.1 · 004, the grade register. Expect 58 grades from the returned worksheet.
--      Run only if PART 1 shows physical_form + grade_source APPLIED.
--      `Elemental Sulfur 200 Mesh` is deliberately NOT loaded (the sheet calls
--      it an example row), so 58 is the whole of it and 59 would be wrong.
SELECT 'grades loaded by 004' AS checks,
       COUNT(*) AS rows_found, 58 AS rows_expected,
       IF(COUNT(*) >= 58, 'LOOKS LOADED', 'NOT LOADED / PARTIAL') AS verdict
  FROM pd_materials
 WHERE physical_form IS NOT NULL;

-- 2.2 · 004, the ten pre-rebuild placeholder seeds. They are deactivated, not
--      deleted. 0 rows here is a normal, healthy answer if the old seed never
--      reached this database — do not read it as a failure.
SELECT 'placeholder seeds still active' AS checks,
       COUNT(*) AS still_active,
       IF(COUNT(*) = 0, 'CLEAR', 'SECTION 2 OF 004 HAS NOT RUN') AS verdict
  FROM pd_materials
 WHERE code IN ('PA54','H2SO4','ROCK28','MAP','AS','AMHUM','ZNSO4','SULPH','BINDER','FILLER')
   AND substance IS NULL AND active = 1;

-- 2.3 · 005 pre-flight. If this returns any row, 005 CANNOT be applied until
--      the duplicates are resolved by hand — renumbering a claim is a
--      decision, not a migration.
SELECT claim_number, version, COUNT(*) AS copies
  FROM pd_claims
 GROUP BY claim_number, version
HAVING COUNT(*) > 1;

-- 2.4 · Who can actually sign in to PD. Anyone with pd_role NULL cannot reach
--      /pd at all, which is intended. Expect the eight pilot users, and expect
--      Nadeem on field_agronomy and Erum on associate_agronomy once they have
--      been granted in Manage Access.
SELECT * FROM auth_users WHERE pd_role IS NOT NULL ORDER BY pd_role;

-- 2.5 · How much is written down so far. All nine objects. On the day the
--      pilot opens every number here should be 0 except pd_materials (58).
SELECT 'pd_problems' AS t, COUNT(*) AS n FROM pd_problems
UNION ALL SELECT 'pd_questions',    COUNT(*) FROM pd_questions
UNION ALL SELECT 'pd_bets',         COUNT(*) FROM pd_bets
UNION ALL SELECT 'pd_runs',         COUNT(*) FROM pd_runs
UNION ALL SELECT 'pd_claims',       COUNT(*) FROM pd_claims
UNION ALL SELECT 'pd_challenges',   COUNT(*) FROM pd_challenges
UNION ALL SELECT 'pd_observations', COUNT(*) FROM pd_observations
UNION ALL SELECT 'pd_requests',     COUNT(*) FROM pd_requests
UNION ALL SELECT 'pd_constraints',  COUNT(*) FROM pd_constraints
UNION ALL SELECT 'pd_run_readings', COUNT(*) FROM pd_run_readings
UNION ALL SELECT 'pd_materials',    COUNT(*) FROM pd_materials;

-- ===========================================================================
-- End of STATE-CHECK.sql
-- ===========================================================================
