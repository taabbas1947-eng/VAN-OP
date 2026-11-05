-- =============================================================================
-- C2M migration 011: Labour and FOH as named rates, Low and High (Tahir and Yawar, 5 Nov 2026, R17 to R20, D-150).
-- Creates 2 new c2m_ tables and 4 rows, and nothing else. It changes no existing table and no O2S, C2L or platform table.
-- Safe to run twice (CREATE TABLE IF NOT EXISTS; the 4 rows are added only when none exist).
--   c2m_lf_rate   a named labour or FOH rate, Rs per kg or L, from a date. A change is a new row; the newest row on or before a
--                 date is the rate in force. Rs per kg NULL means "not filled".
--   c2m_lf_pick   the named rate each client product uses for labour and for FOH, from a date. No row = Low.
-- The switch is the day this runs (Tahir, 5 Nov 2026: "switch it from today and let the FOH and labour stand not filled"):
-- from then C2M costs labour and FOH from these tables, the old rates (c2m_conversion_rule) stay in the record unused, and every
-- product is on Low. Until Yawar types the 4 figures, today's cost of every pack shows "no labour rate" and "no FOH rate";
-- approved costs, prices and Margin do not change. Until this is run C2M keeps working exactly as before.
-- Documentation: apps/c2m/docs/04-database-schema.md, docs/06-decisions.md (D-150), docs/09-formulas-and-rules.md (F-33)
-- =============================================================================
CREATE TABLE IF NOT EXISTS c2m_lf_rate (
  id INT AUTO_INCREMENT PRIMARY KEY,
  kind VARCHAR(10) NOT NULL,                    -- labour, foh
  name VARCHAR(40) NOT NULL,                    -- Low, High; more can be added (e.g. Average)
  rs_per_kg DECIMAL(12,4) NULL,                 -- NULL: not filled
  valid_from DATE NOT NULL,                     -- in force from this day (the 4 rows below: the 1st of the month this runs in)
  source VARCHAR(200) NULL,
  set_by VARCHAR(64) NOT NULL,
  set_at DATETIME NOT NULL,
  KEY kind_name (kind, name, valid_from)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS c2m_lf_pick (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_product_id INT NOT NULL,               -- c2m_client_product.id
  kind VARCHAR(10) NOT NULL,                    -- labour, foh
  rate_name VARCHAR(40) NOT NULL,               -- the named rate it uses
  valid_from DATE NOT NULL,                     -- in force from this day
  set_by VARCHAR(64) NOT NULL,
  set_at DATETIME NOT NULL,
  KEY cp_kind (client_product_id, kind, valid_from)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO c2m_lf_rate (kind, name, rs_per_kg, valid_from, source, set_by, set_at)
SELECT x.kind, x.name, NULL, DATE_FORMAT(CURDATE(), '%Y-%m-01'), 'Switch to Low and High (migration 011): not filled yet', 'migration', NOW()
FROM (SELECT 'labour' kind, 'Low' name UNION ALL SELECT 'labour', 'High' UNION ALL SELECT 'foh', 'Low' UNION ALL SELECT 'foh', 'High') x
WHERE NOT EXISTS (SELECT 1 FROM c2m_lf_rate);
