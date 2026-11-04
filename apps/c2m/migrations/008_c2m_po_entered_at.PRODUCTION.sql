-- PRODUCTION variant of 008_c2m_po_entered_at.sql for HostGator phpMyAdmin (SQL tab). Same content; keep both in step.
-- Run once, by hand. The table is written with its database name, because the SQL tab there stays on information_schema.
-- =============================================================================
-- C2M migration 008: when each O2S PO came in (Tahir, 4 Nov 2026, D-145: "PO checked by its time").
-- Adds 1 column to c2m_o2s_po_line and changes nothing else. No O2S, PD or platform table is touched.
-- Run once. A second run stops with "Duplicate column name": harmless, nothing changes.
-- Until it is run C2M works as before, except that a price approved on a PO's own date is not used to check that PO
-- (it is checked against the price before). After it is run, the next O2S pull (daily, or Pull now) fills the column.
-- =============================================================================
ALTER TABLE jodilkah_vanop_db.c2m_o2s_po_line ADD COLUMN entered_at DATETIME NULL AFTER received;
