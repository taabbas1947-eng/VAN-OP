-- C2M migration 006: correct 3 material names spelled wrong (Tahir, 26 Oct 2026: "correct it"). Only the misspelled word changes:
--   Ferrous Sulfatte Hepta -> Ferrous Sulfate Hepta; Magnisium Sulfate -> Magnesium Sulfate; Magnisium Sulfate Hepta Hydrate -> Magnesium Sulfate Hepta Hydrate.
-- Matched by the whole name, so no other material is touched. A name is left as it is when the right spelling is already taken by another
-- material (names are unique); the last query then lists it, so the two can be merged by hand. Adds 1 audit line for each name changed.
-- Recipes keep their lines: they point to the material by its number, not its name. No O2S, PD or platform table is touched.
-- Run once. A second run changes nothing (the wrong names are gone): harmless.
-- Documentation: apps/c2m/docs/06-decisions.md (D-133)

INSERT INTO c2m_audit (at, by_user, entity, entity_id, action, old_value, new_value, why)
SELECT NOW(), 'migration 006', 'material', CAST(id AS CHAR), 'rename', JSON_QUOTE(name), JSON_QUOTE('Ferrous Sulfate Hepta'), 'Spelling of the material name (migration 006)'
FROM c2m_raw_material WHERE name='Ferrous Sulfatte Hepta' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM c2m_raw_material) t WHERE t.name='Ferrous Sulfate Hepta');
UPDATE c2m_raw_material SET name='Ferrous Sulfate Hepta' WHERE name='Ferrous Sulfatte Hepta' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM c2m_raw_material) t WHERE t.name='Ferrous Sulfate Hepta');

INSERT INTO c2m_audit (at, by_user, entity, entity_id, action, old_value, new_value, why)
SELECT NOW(), 'migration 006', 'material', CAST(id AS CHAR), 'rename', JSON_QUOTE(name), JSON_QUOTE('Magnesium Sulfate'), 'Spelling of the material name (migration 006)'
FROM c2m_raw_material WHERE name='Magnisium Sulfate' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM c2m_raw_material) t WHERE t.name='Magnesium Sulfate');
UPDATE c2m_raw_material SET name='Magnesium Sulfate' WHERE name='Magnisium Sulfate' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM c2m_raw_material) t WHERE t.name='Magnesium Sulfate');

INSERT INTO c2m_audit (at, by_user, entity, entity_id, action, old_value, new_value, why)
SELECT NOW(), 'migration 006', 'material', CAST(id AS CHAR), 'rename', JSON_QUOTE(name), JSON_QUOTE('Magnesium Sulfate Hepta Hydrate'), 'Spelling of the material name (migration 006)'
FROM c2m_raw_material WHERE name='Magnisium Sulfate Hepta Hydrate' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM c2m_raw_material) t WHERE t.name='Magnesium Sulfate Hepta Hydrate');
UPDATE c2m_raw_material SET name='Magnesium Sulfate Hepta Hydrate' WHERE name='Magnisium Sulfate Hepta Hydrate' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM c2m_raw_material) t WHERE t.name='Magnesium Sulfate Hepta Hydrate');

-- Left as they were (should show no rows):
SELECT id, name, 'right spelling already taken: merge by hand' AS note FROM c2m_raw_material
WHERE name IN ('Ferrous Sulfatte Hepta','Magnisium Sulfate','Magnisium Sulfate Hepta Hydrate');
