-- PRODUCTION variant of 015_c2m_basis_density.sql for HostGator phpMyAdmin (SQL tab). Same content; keep both in step.
-- Run once, by hand. Tables are written with their database name, because the SQL tab there stays on information_schema.
-- =============================================================================
-- C2M migration 015: % w/w and % w/v, and densities (Tahir, 10 Nov 2026, R70 to R73, D-164).
-- Adds 1 column (measure) to c2m_grade_nutrient and to c2m_declared_grade, and creates c2m_density. Changes nothing else; no O2S,
-- C2L or platform table is touched. Needs 014 first.
-- Run once. A second run stops at the first line with "Duplicate column name": harmless, nothing changes.
-- Every value already entered becomes w/w (w/v where the nutrient list already said w/v), which is what C2M has assumed so far,
-- so no figure of a material bought in kg moves until the QC Head marks a value w/v. A material dosed in L (none on 10 Nov 2026)
-- with a w/w value needs its density from then on.
-- A declared grade of a product sold per L starts as w/v (there were none on 10 Nov 2026).
--   measure     w/w (kg per 100 kg) or w/v (kg per 100 L, g per 100 mL), as the certificate or the label states it.
--   c2m_density 1 density per material grade (kind grade, entered by the QC Head) or per product (kind product, entered by the
--               Production Manager): kg per L at 20 °C, with its source and date.
-- Until it is run C2M works as after 014: every value counts as typed and no density is asked.
-- Documentation: apps/c2m/docs/04-database-schema.md 4.21, docs/06-decisions.md D-164
-- =============================================================================
ALTER TABLE jodilkah_vanop_db.c2m_grade_nutrient ADD COLUMN measure VARCHAR(4) NOT NULL DEFAULT 'w/w' AFTER pct;
ALTER TABLE jodilkah_vanop_db.c2m_declared_grade ADD COLUMN measure VARCHAR(4) NOT NULL DEFAULT 'w/w' AFTER pct;
-- A nutrient the list already marked w/v (7a) passes that to its values (none was on 10 Nov 2026).
UPDATE jodilkah_vanop_db.c2m_grade_nutrient gn JOIN jodilkah_vanop_db.c2m_nutrient n ON n.id = gn.nutrient_id SET gn.measure = 'w/v' WHERE n.measure = 'w/v';
UPDATE jodilkah_vanop_db.c2m_declared_grade d JOIN jodilkah_vanop_db.c2m_client_product p ON p.id = d.client_product_id SET d.measure = 'w/v' WHERE p.sold_per = 'L';
CREATE TABLE IF NOT EXISTS jodilkah_vanop_db.c2m_density (
  kind VARCHAR(10) NOT NULL,                    -- grade (a material grade) or product (a client product)
  ref_id INT NOT NULL,                          -- c2m_material_grade.id or c2m_client_product.id
  kg_per_l DECIMAL(8,4) NOT NULL,               -- kg per L at 20 °C
  source VARCHAR(120) NULL,                     -- lab report, supplier certificate
  src_date DATE NULL,
  by_user VARCHAR(64) NOT NULL,
  at DATETIME NOT NULL,
  PRIMARY KEY (kind, ref_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;
