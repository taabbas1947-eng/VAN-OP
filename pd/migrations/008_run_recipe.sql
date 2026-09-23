-- ===========================================================================
-- PD · 008_run_recipe.sql — the recipe box on the Run
--
-- Written 23 September 2026, on Tahir's ruling the same day (Council
-- finding 05: "Recipe box on the Run").
--
-- WHY THIS EXISTS. A Run is one recipe made and measured. Until now the Run
-- recorded what was expected and what happened, and the recipe itself lived
-- in the lab notebook, or in a chemist's head, or in a future Combination
-- Bank code (pd_runs.combination_id) that nobody has filled in yet. A year
-- later the result is on the screen and the thing that produced it is not.
--
-- WHAT IT DOES. Adds ONE nullable free-text column to pd_runs. The chemist
-- writes what was mixed in their own words: ingredients, amounts, order,
-- temperature, time. Optional, because a Run may be opened before the recipe
-- is final, and it can be written or changed later through the edit route
-- (history kept, as for every other edited field). combination_id stays, for
-- the day the Combination Bank exists; the report counts a Run as "without
-- recipe" only when BOTH are empty.
--
-- SAFE TO RUN ONCE. Re-running it fails with "Duplicate column name
-- 'recipe_text'", which is harmless: it means the column is already there.
-- STATE-CHECK.sql reports whether it has been applied.
--
-- Applied: LOCAL van_platform 23 Sept 2026. PRODUCTION: not yet — by hand,
-- later, per the standing rule in CLAUDE.md.
-- ===========================================================================

ALTER TABLE pd_runs
  ADD COLUMN recipe_text TEXT NULL AFTER combination_id;

-- After: expect one row, DATA_TYPE = text, IS_NULLABLE = YES.
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pd_runs' AND COLUMN_NAME = 'recipe_text';
