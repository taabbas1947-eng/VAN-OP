-- =============================================================================
-- C2M migration 014: the nutrient list, nutrients per material, checked materials and declared grades
-- (Tahir, 9 Nov 2026, R60 to R62 and R66, D-162).
-- Creates 4 new c2m_ tables and adds 3 actions to the C2M roles QC Head, Production Manager and CFO (and the COO when its
-- actions are ticked one by one). It changes no other table and no O2S, C2L or platform table.
-- Safe to run twice (CREATE TABLE IF NOT EXISTS; each role update adds an action only when it is not there yet).
-- For Ahmer: run once in phpMyAdmin, after 013. Nothing else needs doing. The first time anyone opens C2M after it,
-- C2M copies every class field and every % already entered into the new tables by itself; nothing is lost and the old
-- columns are left as they were.
--   c2m_nutrient        the 1 list of nutrients, kept by the QC Head: a name, what it is shown as (N, P2O5, K2O, Amino acids),
--                       its basis (Total N, as K2O, free amino acids) and whether it is % weight in weight or weight in volume.
--                       A nutrient in use is hidden, never deleted. 1 "shown as" once.
--   c2m_grade_nutrient  the % of each nutrient in a material grade, with the certificate it came from and its date.
--   c2m_grade_check     a material grade whose nutrients the QC Head has saved: a nutrient not listed for it counts as 0 in a
--                       recipe. A grade that carries nutrients and has no row here is "to enter".
--   c2m_declared_grade  what a product's label promises, nutrient by nutrient, with the tolerance below it the QC Head allows.
-- New actions: nutrient.list (keep the nutrient list and material classes: QC Head), grade.declare (enter a product's declared
-- grade: QC Head), material.add (add a material without a rate: QC Head, Production Manager, CFO). The Production Manager
-- also gets see.materials, so he sees Inputs, Materials and nutrients (read only, plus Add a material).
-- Until this is run, C2M works as before: Inputs shows the old materials table; the new tabs, Guide rows and "what changed" lines are not shown.
-- The last query is a check: it lists any C2M role that did not get its new actions (an empty result means all done). A role
-- a System Administrator changed so that it no longer holds nutrient.edit, recipe.start or material.save is skipped on purpose;
-- if it is listed, give it the action on the launcher's Roles by app screen.
-- Documentation: apps/c2m/docs/04-database-schema.md, docs/06-decisions.md (D-162), docs/10-data-dictionary.md, docs/11-access-and-roles.md
-- =============================================================================
CREATE TABLE IF NOT EXISTS c2m_nutrient (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(60) NOT NULL,                    -- e.g. Potassium
  label VARCHAR(24) NOT NULL,                   -- what it is shown as, e.g. K2O; the key a recipe's analysis adds up by
  basis VARCHAR(60) NOT NULL DEFAULT '',        -- e.g. as K2O, Total N, free amino acids; empty when not stated
  measure VARCHAR(4) NOT NULL DEFAULT 'w/w',    -- w/w (% weight in weight) or w/v (% weight in volume)
  hidden TINYINT(1) NOT NULL DEFAULT 0,         -- 1: kept for the record, not offered for new entries
  created_by VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL,
  UNIQUE KEY uq_nutrient_label (label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS c2m_grade_nutrient (
  grade_id INT NOT NULL,                        -- c2m_material_grade.id
  nutrient_id INT NOT NULL,                     -- c2m_nutrient.id
  pct DECIMAL(9,4) NOT NULL,                    -- % in the material, 0 to 100
  cert VARCHAR(120) NULL,                       -- where the figure comes from: lab report, supplier certificate
  cert_date DATE NULL,
  by_user VARCHAR(64) NOT NULL,
  at DATETIME NOT NULL,
  PRIMARY KEY (grade_id, nutrient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS c2m_grade_check (
  grade_id INT PRIMARY KEY,                     -- c2m_material_grade.id
  by_user VARCHAR(64) NOT NULL,
  at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS c2m_declared_grade (
  client_product_id INT NOT NULL,               -- c2m_client_product.id
  nutrient_id INT NOT NULL,                     -- c2m_nutrient.id
  pct DECIMAL(9,4) NOT NULL,                    -- the % the label promises
  tol DECIMAL(7,4) NOT NULL DEFAULT 0,          -- points below the label still taken as meeting it (0 = none)
  by_user VARCHAR(64) NOT NULL,
  at DATETIME NOT NULL,
  PRIMARY KEY (client_product_id, nutrient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

-- QC Head: keep the nutrient list and classes, enter declared grades, add a material without a rate.
UPDATE c2m_role SET actions_json = REPLACE(actions_json, '"nutrient.edit"', '"nutrient.edit","nutrient.list"')
  WHERE role_key = 'qc' AND actions_json LIKE '%"nutrient.edit"%' AND actions_json NOT LIKE '%"nutrient.list"%';
UPDATE c2m_role SET actions_json = REPLACE(actions_json, '"nutrient.edit"', '"nutrient.edit","grade.declare"')
  WHERE role_key = 'qc' AND actions_json LIKE '%"nutrient.edit"%' AND actions_json NOT LIKE '%"grade.declare"%';
UPDATE c2m_role SET actions_json = REPLACE(actions_json, '"nutrient.edit"', '"nutrient.edit","material.add"')
  WHERE role_key = 'qc' AND actions_json LIKE '%"nutrient.edit"%' AND actions_json NOT LIKE '%"material.add"%';
-- Production Manager: add a material without a rate, and see materials and nutrients.
UPDATE c2m_role SET actions_json = REPLACE(actions_json, '"recipe.start"', '"recipe.start","material.add"')
  WHERE role_key = 'production' AND actions_json LIKE '%"recipe.start"%' AND actions_json NOT LIKE '%"material.add"%';
UPDATE c2m_role SET actions_json = REPLACE(actions_json, '"recipe.start"', '"recipe.start","see.materials"')
  WHERE role_key = 'production' AND actions_json LIKE '%"recipe.start"%' AND actions_json NOT LIKE '%"see.materials"%';
-- CFO: add a material without a rate (he keeps Add with a rate, and adding classes).
UPDATE c2m_role SET actions_json = REPLACE(actions_json, '"material.save"', '"material.save","material.add"')
  WHERE role_key = 'cfo' AND actions_json LIKE '%"material.save"%' AND actions_json NOT LIKE '%"material.add"%';
-- COO: when his actions are ticked one by one (an empty list means every action), add the 3 new ones.
UPDATE c2m_role SET actions_json = REPLACE(actions_json, '"nutrient.edit"', '"nutrient.edit","nutrient.list","grade.declare","material.add"')
  WHERE role_key = 'coo' AND actions_json LIKE '%"nutrient.edit"%' AND actions_json NOT LIKE '%"nutrient.list"%';

-- Check (read only): an empty result means every role got its new actions.
SELECT role_key, 'nutrient.list, grade.declare or material.add missing' AS note FROM c2m_role
  WHERE role_key = 'qc' AND (actions_json NOT LIKE '%"nutrient.list"%' OR actions_json NOT LIKE '%"grade.declare"%' OR actions_json NOT LIKE '%"material.add"%')
UNION ALL
SELECT role_key, 'material.add or see.materials missing' FROM c2m_role
  WHERE role_key = 'production' AND (actions_json NOT LIKE '%"material.add"%' OR actions_json NOT LIKE '%"see.materials"%')
UNION ALL
SELECT role_key, 'material.add missing' FROM c2m_role
  WHERE role_key = 'cfo' AND actions_json NOT LIKE '%"material.add"%';
