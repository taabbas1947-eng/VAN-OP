-- =============================================================================
-- C2M migration 012: O2S production by day, for Month end (Tahir and Yawar, 6 Nov 2026, R10, R43, D-154).
-- Creates 1 new c2m_ table and nothing else. It changes no existing table and no O2S, C2L or platform table.
-- Safe to run twice (CREATE TABLE IF NOT EXISTS).
--   c2m_o2s_production  a read-only copy of O2S's production log (kg made each day, the base product, and the PO and brand
--                       it was made for when O2S records them). Refilled on every O2S pull. Month end charges labour and FOH
--                       on these kg: each kg at the rate its product is on that day; stock made for no brand at its base
--                       product's rate, or Low when that base's products are on different rates.
-- Until this is run, Month end says "needs migration 012" for step 2 and everything else works as before.
-- Documentation: apps/c2m/docs/04-database-schema.md, docs/06-decisions.md (D-154)
-- =============================================================================
CREATE TABLE IF NOT EXISTS c2m_o2s_production (
  id VARCHAR(60) PRIMARY KEY,                   -- O2S's id for the entry (a made-up one for old entries O2S keeps without an id)
  made_on DATE NOT NULL,
  base VARCHAR(120) NOT NULL,
  brand VARCHAR(120) NULL,                      -- the brand it was made for, when O2S records it
  po VARCHAR(60) NULL,                          -- the PO it was made for, when O2S records it
  kg DECIMAL(14,3) NOT NULL,
  sync_id INT NOT NULL,
  KEY ix_prod_day (made_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;
