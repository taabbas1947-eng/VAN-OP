-- =============================================================================
-- C2M migration 009: the customer's region on each O2S PO line (Tahir, 4 Nov 2026, D-146: VAN brand PO price check).
-- Adds 1 column to c2m_o2s_po_line and changes nothing else. No O2S, PD or platform table is touched.
-- Run once. A second run stops with "Duplicate column name": harmless, nothing changes.
-- Until it is run C2M works as before; the price check then reads a dealer's region from his C2M customer record and
-- marks a farmer PO "region not known" (not compared). After it is run, the next O2S pull (daily, or Pull now) fills the column.
-- Documentation: apps/c2m/docs/04-database-schema.md, docs/06-decisions.md (D-146), docs/09-formulas-and-rules.md (F-32)
-- =============================================================================
ALTER TABLE c2m_o2s_po_line ADD COLUMN region VARCHAR(40) NULL AFTER payment_terms;
