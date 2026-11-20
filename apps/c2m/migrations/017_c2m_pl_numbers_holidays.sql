-- =============================================================================
-- C2M migration 017 (push 10e, 20 Nov 2026; Tahir's answers to the audit, D-176):
--   1. The list of public holidays the COO keeps (audit C-35): working days on Approvals (how long a job is stuck) skip these days.
--   2. A price list number (VAN/PL/year/nnn) can be used once only: UNIQUE key on c2m_price_doc.ref (audit C-33).
--      C2M now takes the next number from a counter (setting pl_seq_<year>), never from a count of documents.
-- Changes nothing else; no O2S, C2L or platform table is touched. Safe to run twice: step 1 creates the table only when it is
-- missing, step 2 is skipped when the key exists.
-- Run on the local database first (van_platform). Production later, by hand, with 017_c2m_pl_numbers_holidays.PRODUCTION.sql.
-- The first query is a check. If it lists any number, 2 documents share it: the holiday table is still made, but the key
-- cannot be added (the ALTER fails). Tell Claude; nothing else breaks meanwhile.
-- Documentation: apps/c2m/docs/04-database-schema.md (4.24), 06-decisions.md (D-176), 10-data-dictionary.md (10.30)
-- =============================================================================
SELECT ref, COUNT(*) AS documents FROM c2m_price_doc GROUP BY ref HAVING COUNT(*) > 1;

CREATE TABLE IF NOT EXISTS c2m_holiday (          -- public holidays, kept by the COO (D-176)
  day DATE PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  added_by VARCHAR(64) NOT NULL,
  added_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

SET @has_key := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'c2m_price_doc' AND index_name = 'uq_price_doc_ref');
SET @sql := IF(@has_key = 0, 'ALTER TABLE c2m_price_doc ADD UNIQUE KEY uq_price_doc_ref (ref)', 'SELECT ''uq_price_doc_ref already there'' AS note');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;
