-- =============================================================================
-- C2M migration 004: the name a client's price list prints (Tahir, 22 Oct 2026, D-109).
-- Adds 1 column to c2m_customer and changes nothing else. No O2S, PD or platform table is touched.
-- Run once. A second run stops with "Duplicate column name": harmless, nothing changes.
-- Until it is run C2M works as before: price lists print the C2M name, and the Name on price lists box shows a plain notice.
-- Documentation: apps/c2m/docs/04-database-schema.md, docs/06-decisions.md (D-109)
-- =============================================================================
ALTER TABLE c2m_customer ADD COLUMN print_name VARCHAR(160) NULL AFTER name;
