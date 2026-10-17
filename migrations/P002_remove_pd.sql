-- ===========================================================================
-- PLATFORM · P002_remove_pd.sql — remove PD (Product Development)
--
-- Tahir, 17 Oct 2026: "lets remove PD today"; PD is replaced by the collaborator's C2L, and
-- "delete everything" (PD held no data that is kept). The PD code, page and Render disk were removed
-- in the same change (server.js, launcher.html, render.yaml; apps/pd/ deleted; git history keeps it).
--
-- WHAT IT DOES (in this order)
--   1. Writes 1 access-log row per PD role still held (action role.revoke, via 'migration'), so the
--      history says who held which PD role before it went.
--   2. Deletes every PD row from user_module_roles.
--   3. Drops all 33 pd_* tables (their 2 triggers go with pd_field_history).
--   4. LAST: drops the pd_role column from auth_users (nothing reads or writes it any more).
--
-- WHAT IT DOES NOT TOUCH
--   O2S (app_state, o2s_*), C2M (c2m_*), auth_users rows, passwords, user_module_roles rows of any other
--   app, platform_people, earlier platform_access_log rows.
--
-- BACKUP FIRST. It cannot be undone: export the database (phpMyAdmin → Export → Quick → SQL) and keep
-- the file outside the repo and shared folders (it holds password hashes).
-- Safe to run twice: steps 1 to 3 find nothing the second time (IF EXISTS on the table drops). Step 4 is
-- the very last statement, so on a second run its error ("Can't DROP 'pd_role'") comes after everything
-- else has run; only then can it be ignored. (Review, 17 Oct: it used to sit before the table drops.)
-- ===========================================================================

-- FIRST run P002-CHECK.sql on its own: it shows what is deleted for good (drop-box messages,
-- Library items, PD materials). It is a separate file because its counts fail once the tables are gone, and
-- phpMyAdmin stops at the first error; this file must be able to run again to finish an interrupted run.
-- BEFORE (cannot fail on a second run):
SELECT (SELECT COUNT(*) FROM user_module_roles WHERE module='pd' AND is_admin=1) AS pd_admins,
       (SELECT COUNT(*) FROM user_module_roles WHERE module='pd') AS pd_role_grants,
       (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name LIKE 'pd_%') AS pd_tables;

-- 1 and 2 run as one step, with the PD grants locked, so a double "Go" cannot log them twice (review, 17 Oct).
START TRANSACTION;
SELECT COUNT(*) AS pd_grants_locked FROM user_module_roles WHERE module='pd' FOR UPDATE;
-- 1. history first
INSERT INTO platform_access_log (actor, action, subject, module, before_val, after_val, via)
SELECT 'system', 'admin.revoke', username, 'pd', '1', '0', 'migration' FROM user_module_roles WHERE module='pd' AND is_admin=1;
INSERT INTO platform_access_log (actor, action, subject, module, before_val, after_val, via)
SELECT 'system', 'role.revoke', username, 'pd', role, NULL, 'migration' FROM user_module_roles WHERE module='pd';

-- 2. the grants
DELETE FROM user_module_roles WHERE module='pd';
COMMIT;

-- 3. the tables
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS pd_audit_log;
DROP TABLE IF EXISTS pd_bets;
DROP TABLE IF EXISTS pd_challenge_materials;
DROP TABLE IF EXISTS pd_challenges;
DROP TABLE IF EXISTS pd_claim_materials;
DROP TABLE IF EXISTS pd_claims;
DROP TABLE IF EXISTS pd_combination_crop_tags;
DROP TABLE IF EXISTS pd_combination_lines;
DROP TABLE IF EXISTS pd_combination_not_duplicates;
DROP TABLE IF EXISTS pd_combination_problem_tags;
DROP TABLE IF EXISTS pd_combination_soil_tags;
DROP TABLE IF EXISTS pd_combinations;
DROP TABLE IF EXISTS pd_comments;
DROP TABLE IF EXISTS pd_constraints;
DROP TABLE IF EXISTS pd_crop_tags;
DROP TABLE IF EXISTS pd_delivery_contexts;
DROP TABLE IF EXISTS pd_dropbox;
DROP TABLE IF EXISTS pd_field_history;
DROP TABLE IF EXISTS pd_library_items;
DROP TABLE IF EXISTS pd_library_pins;
DROP TABLE IF EXISTS pd_material_requests;
DROP TABLE IF EXISTS pd_materials;
DROP TABLE IF EXISTS pd_notices;
DROP TABLE IF EXISTS pd_observation_materials;
DROP TABLE IF EXISTS pd_observations;
DROP TABLE IF EXISTS pd_problem_tags;
DROP TABLE IF EXISTS pd_problems;
DROP TABLE IF EXISTS pd_questions;
DROP TABLE IF EXISTS pd_reclassifications;
DROP TABLE IF EXISTS pd_requests;
DROP TABLE IF EXISTS pd_run_readings;
DROP TABLE IF EXISTS pd_runs;
DROP TABLE IF EXISTS pd_soil_tags;
SET FOREIGN_KEY_CHECKS = 1;

-- 4. LAST: the old PD column on logins
ALTER TABLE auth_users DROP COLUMN pd_role;

-- AFTER: expect 0, 0, 0. Then a list of logins left with no access to any system (switch them off on
-- People and access if they should go; an empty result means everyone still has a system).
SELECT (SELECT COUNT(*) FROM user_module_roles WHERE module='pd') AS pd_role_grants_left,
       (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name LIKE 'pd_%') AS pd_tables_left,
       (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='auth_users' AND column_name='pd_role') AS pd_role_column_left;
SELECT a.username, a.name FROM auth_users a
 WHERE NOT EXISTS (SELECT 1 FROM user_module_roles r WHERE r.username = a.username)
 ORDER BY a.username;
