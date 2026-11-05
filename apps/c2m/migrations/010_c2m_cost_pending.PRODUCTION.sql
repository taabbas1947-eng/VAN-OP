-- PRODUCTION variant of 010_c2m_cost_pending.sql for HostGator phpMyAdmin (SQL tab). Same content; keep both in step.
-- Run once, by hand. The table is written with its database name, because the SQL tab there stays on information_schema.
-- =============================================================================
-- C2M migration 010: Next week's costs (Tahir and Yawar, 5 Nov 2026, R11 as ruled that evening, D-149: Monday is cost day).
-- Creates 1 new c2m_ table and nothing else. It changes no existing table and no O2S, C2L or platform table.
-- Safe to run twice (CREATE TABLE IF NOT EXISTS).
--   c2m_cost_pending   a material, packing price, packing bill or freight change saved Tuesday to Sunday. It waits here and goes in
--                      at Monday 00:00 (Pakistan time), or at once when Tahir approves it as urgent. Changed or dropped until then.
-- Until this is run C2M keeps working exactly as before: every cost change goes in when saved.
-- Documentation: apps/c2m/docs/04-database-schema.md, docs/06-decisions.md (D-149), docs/09-formulas-and-rules.md (B-40)
-- =============================================================================
CREATE TABLE IF NOT EXISTS jodilkah_vanop_db.c2m_cost_pending (
  id INT AUTO_INCREMENT PRIMARY KEY,
  kind VARCHAR(20) NOT NULL,                    -- rate (material), packing_rate, packing_bill, freight
  target VARCHAR(80) NOT NULL,                  -- grade id, packing item id, packing bill id, or "Dealer|Sindh"
  label VARCHAR(200) NOT NULL,                  -- what changes, in words
  body_json TEXT NOT NULL,                      -- the save as typed; it is run as is when it goes in
  now_value DECIMAL(14,4) NULL,                 -- today's figure (Rs), when it is a figure
  new_value DECIMAL(14,4) NULL,                 -- the figure from Monday (Rs), when it is a figure
  effect_json TEXT NULL,                        -- packs that move more than the re-approval %, worked out when saved
  apply_on DATE NOT NULL,                       -- the Monday it goes in
  urgent TINYINT NOT NULL DEFAULT 0,            -- 1: asked to go in now, waits for Tahir
  reason VARCHAR(300) NULL,                     -- why it is urgent
  status VARCHAR(12) NOT NULL DEFAULT 'waiting',-- waiting, applied, dropped, replaced, failed
  saved_by VARCHAR(64) NOT NULL,
  saved_at DATETIME NOT NULL,
  decided_by VARCHAR(64) NULL,                  -- who approved it as urgent, dropped it, or "monday"
  decided_at DATETIME NULL,
  result_text VARCHAR(400) NULL,                -- what happened when it went in, or why it failed
  waiting_key VARCHAR(110) NULL,               -- kind|target while waiting, else NULL: at most 1 waiting change per item
  UNIQUE KEY one_waiting (waiting_key),
  KEY status_apply (status, apply_on),
  KEY kind_target (kind, target, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
