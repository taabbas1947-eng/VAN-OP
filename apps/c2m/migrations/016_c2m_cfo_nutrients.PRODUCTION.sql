-- PRODUCTION variant of 016_c2m_cfo_nutrients.sql for HostGator phpMyAdmin (SQL tab). Same content; keep both in step.
-- Run once, by hand. The table is written with its database name, because the SQL tab there stays on information_schema.
-- =============================================================================
-- C2M migration 016: the CFO no longer enters nutrients (Tahir, 10 Nov 2026, D-167).
-- Takes the action nutrient.edit off the C2M role CFO, so only the QC Head (and the COO) enter a material's nutrients, its
-- w/w or w/v and its density. The CFO still reads them. Changes nothing else; no O2S, C2L or platform table is touched.
-- Safe to run twice: a role that no longer holds the action is left as it is.
-- For Ahmer: run once in phpMyAdmin. The same can be done by hand on the launcher (People and access, Roles by app, C2M, CFO).
-- The last query is a check: an empty result means done. If it lists the CFO, tell Claude before anything else: the list of
-- actions was stored with spaces and needs fixing by hand on the launcher.
-- Documentation: apps/c2m/docs/06-decisions.md (D-167), docs/11-access-and-roles.md
-- =============================================================================
UPDATE jodilkah_vanop_db.c2m_role SET actions_json = REPLACE(REPLACE(REPLACE(actions_json, '"nutrient.edit",', ''), ',"nutrient.edit"', ''), '"nutrient.edit"', '')
  WHERE role_key = 'cfo' AND actions_json LIKE '%"nutrient.edit"%';

SELECT role_key, 'nutrient.edit still held, or its list is no longer valid' AS note FROM jodilkah_vanop_db.c2m_role WHERE role_key = 'cfo' AND (actions_json LIKE '%"nutrient.edit"%' OR NOT JSON_VALID(actions_json));
