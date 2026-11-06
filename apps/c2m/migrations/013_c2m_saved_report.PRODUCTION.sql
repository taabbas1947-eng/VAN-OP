-- =============================================================================
-- C2M migration 013: saved reports, for Your own report (Tahir, 6 Nov 2026, R52 to R54, D-158).
-- Creates 1 new c2m_ table and nothing else. It changes no existing table and no O2S, C2L or platform table.
-- Safe to run twice (CREATE TABLE IF NOT EXISTS).
-- For Ahmer: run once in phpMyAdmin, after 012. Nothing else needs doing; C2M finds the table by itself within a minute.
--   c2m_saved_report  a report a person made in Reports, Your own report, and saved with a name: its recipe only (the data set,
--                     the dates, the columns in order, the filters, each row or totals by group), never its figures. Opening it
--                     builds the report again on today's data. Kept for the person who made it (owner = the platform username);
--                     only they see, open, rename or delete it. 1 name once per person.
-- Until this is run, Your own report works but cannot be saved: Save says "needs migration 013" and everything else works as before.
-- Documentation: apps/c2m/docs/04-database-schema.md, docs/06-decisions.md (D-158), docs/10-data-dictionary.md
-- =============================================================================
CREATE TABLE IF NOT EXISTS c2m_saved_report (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner VARCHAR(60) NOT NULL,                   -- the platform username of the person who saved it
  name VARCHAR(120) NOT NULL,                   -- the name they gave it, 1 to 120 letters
  spec_json TEXT NOT NULL,                      -- the recipe: {set, period, cols, filters, show, groupBy}; under 20 KB
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_saved_owner_name (owner, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;
