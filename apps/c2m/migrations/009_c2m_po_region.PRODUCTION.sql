-- PRODUCTION variant of 009_c2m_po_region.sql for HostGator phpMyAdmin (SQL tab). Same content; keep both in step.
-- Run once, by hand. The table is written with its database name, because the SQL tab there stays on information_schema.
-- =============================================================================
-- C2M migration 009: the customer's region on each O2S PO line (Tahir, 4 Nov 2026, D-146: VAN brand PO price check).
-- Adds 1 column to c2m_o2s_po_line and changes nothing else. No O2S, PD or platform table is touched.
-- Run once. A second run stops with "Duplicate column name": harmless, nothing changes.
-- Until it is run C2M works as before; the price check then reads a dealer's region from his C2M customer record and
-- marks a farmer PO "region not known" (not compared). After it is run, the next O2S pull (daily, or Pull now) fills the column.
-- =============================================================================
ALTER TABLE jodilkah_vanop_db.c2m_o2s_po_line ADD COLUMN region VARCHAR(40) NULL AFTER payment_terms;
