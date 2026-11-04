-- =============================================================================
-- C2M migration 008: when each O2S PO came in (Tahir, 4 Nov 2026, D-145: "PO checked by its time").
-- Adds 1 column to c2m_o2s_po_line and changes nothing else. No O2S, PD or platform table is touched.
-- Run once. A second run stops with "Duplicate column name": harmless, nothing changes.
-- Until it is run C2M works as before, except that a price approved on a PO's own date is not used to check that PO
-- (it is checked against the price before). After it is run, the next O2S pull (daily, or Pull now) fills the column.
-- Documentation: apps/c2m/docs/04-database-schema.md, docs/06-decisions.md (D-145), docs/09-formulas-and-rules.md (F-20, F-30)
-- =============================================================================
ALTER TABLE c2m_o2s_po_line ADD COLUMN entered_at DATETIME NULL AFTER received;
