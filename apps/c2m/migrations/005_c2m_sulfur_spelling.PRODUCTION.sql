-- PRODUCTION variant of 005_c2m_sulfur_spelling.sql for HostGator phpMyAdmin (SQL tab). Same content; keep both in step.
-- Run once, by hand.
USE jodilkah_vanop_db;

-- C2M migration 005: spell Sulfur with an f (Tahir, 23 Oct 2026). Changes 5 product descriptions and 3 material names, by id, and only where the old text is still there. Adds one audit line for each. No O2S, PD or platform table is touched.
-- Run once. A second run changes nothing (the old text is gone): harmless.
-- Left as they are: Magnesium sulphate (V-Mg Essential), Sodium Lignosulphonate and the material class names "Sulphur source" and "Calcium and sulphur source" (not named in the request).
-- Documentation: apps/c2m/docs/06-decisions.md (D-118)

INSERT INTO c2m_audit (at, by_user, entity, entity_id, action, old_value, new_value, why)
SELECT NOW(), 'migration 005', 'product_name', CAST(id AS CHAR), 'spec', spec, REPLACE(spec,'Sulphur','Sulfur'), 'Sulfur spelling (migration 005)'
FROM c2m_client_product WHERE id IN (4,14,16,47,54) AND spec LIKE 'Sulphur%';
UPDATE c2m_client_product SET spec=REPLACE(spec,'Sulphur','Sulfur') WHERE id IN (4,14,16,47,54) AND spec LIKE 'Sulphur%';

INSERT INTO c2m_audit (at, by_user, entity, entity_id, action, old_value, new_value, why)
SELECT NOW(), 'migration 005', 'material', CAST(id AS CHAR), 'rename', name, REPLACE(name,'Sulphur','Sulfur'), 'Sulfur spelling (migration 005)'
FROM c2m_raw_material WHERE id IN (6,28,63) AND name LIKE 'Sulphur%';
UPDATE c2m_raw_material SET name=REPLACE(name,'Sulphur','Sulfur') WHERE id IN (6,28,63) AND name LIKE 'Sulphur%';

