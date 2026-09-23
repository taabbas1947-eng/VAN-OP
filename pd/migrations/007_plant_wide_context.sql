-- ===========================================================================
-- PD · 007_plant_wide_context.sql — somewhere to write down what the plant
-- can actually make
--
-- Written 11 September 2026, on Tahir's ruling the same day ("B2", with the
-- second register "B1" considered and dropped).
--
-- WHY THIS EXISTS. MODEL.md §3 lists `plant_capability` — "what the plant can
-- do" — as one of the five kinds of Constraint, and 002 wrote it into the
-- pd_constraints ENUM. But 002 also made `delivery_context_id` NOT NULL, the
-- create route refuses a constraint that names no context, and both read paths
-- inner-join the context table. So a rule about the PLANT ITSELF — "we cannot
-- crystallise at scale", "the granulator will not take material finer than X
-- mesh" — had nowhere to live. Filed under fertigation it is wrong there and
-- invisible to the other five contexts; filed six times it is precisely the
-- duplication this register exists to prevent. MODEL.md's own sentence gives
-- it away: the register is "the no-duplication mechanism on the DELIVERY
-- side." There was no plant side.
--
-- The case that exposed it: recovering potash from bio-boiler fly ash. That
-- work is chemistry and production, no agronomy in it at all, and the fact
-- that decides it — whether the plant can reproduce what the bench did —
-- could not be written down anywhere in PD.
--
-- WHAT IT DOES. Adds ONE row to the existing register. No schema change, no
-- new table, no column. The id is pinned at 90 rather than left to
-- AUTO_INCREMENT so that pd-lib.js (PLANT_WIDE_CONTEXT_ID) can name it without
-- matching on a string somebody may later rewrite; 002 seeded the six real
-- contexts without explicit ids, so they hold 1-6 and 90 cannot collide.
--
-- THIS ROW IS PERMANENT, NOT A STOPGAP. A separate plant-side register was
-- designed and deliberately not built, so this is the only place a
-- plant-capability rule belongs. It is a full member of the vocabulary.
--
-- TWO RULES GO WITH IT, both enforced in pd/pd-routes.js, not here:
--   · Every Bet inherits the plant-wide constraints in addition to those of
--     the context it is aimed through. What the plant can make binds a product
--     however it is delivered.
--   · A Bet may NOT be "aimed through" plant-wide. It is not a way of
--     delivering anything. The screen leaves it out of the list and the route
--     refuses it with a sentence.
--
-- NAME SIMPLIFIED 23 September 2026, when this was actually applied. The row
-- was going to be called 'plant-wide — what we can actually make', with an em
-- dash. It is now simply 'plant-wide'. The reason is practical: the row has to
-- be typed into phpMyAdmin, and a non-ASCII character typed through a browser
-- is one more thing that can silently arrive wrong — at which point the row
-- looks right on screen while STATE-CHECK, which matches the name exactly,
-- reports 007 NOT APPLIED. Nothing in the code reads the name: pd-lib.js
-- matches on PLANT_WIDE_CONTEXT_ID (90), so the id is the identity and the
-- name is only a label on a screen. Shorter is also better in the two places
-- it shows: the constraint form's picker and the group heading on the
-- Constraints card.
--
-- RUN BY HAND, BY TAHIR, ONLY. After 006. Safe to re-run: INSERT IGNORE, and
-- `name` is UNIQUE, so a second run inserts nothing.
-- ===========================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- Pre-flight. Nothing here can lose data; this just says what is about to
-- change. If id 90 is already taken by something else, STOP and say so rather
-- than letting INSERT IGNORE swallow it.
-- ---------------------------------------------------------------------------
SELECT 'BEFORE — the register as it stands' AS step;
SELECT id, name FROM pd_delivery_contexts ORDER BY id;

SELECT IF(COUNT(*) = 0, 'ok',
  'STOP: id 90 already exists and is not the plant-wide row. Do not run the INSERT — tell Claude, and the id gets chosen again.') AS preflight
  FROM pd_delivery_contexts
 WHERE id = 90 AND name <> 'plant-wide';

-- ---------------------------------------------------------------------------
-- The change. One row.
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO pd_delivery_contexts (id, name)
VALUES (90, 'plant-wide');

-- ---------------------------------------------------------------------------
-- After. Seven rows: the six real delivery contexts, and the plant.
-- ---------------------------------------------------------------------------
SELECT 'AFTER — the register now' AS step;
SELECT id, name FROM pd_delivery_contexts ORDER BY id;

SELECT 'Done. A plant-capability rule now has somewhere to live, and every Bet inherits it.' AS next_step;

-- ===========================================================================
-- End of 007_plant_wide_context.sql
-- ===========================================================================
