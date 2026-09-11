-- ===========================================================================
-- PD · 006 — the role list, matched to VAN's actual org chart
--
-- Written 10 September 2026, from Tahir's rulings that day.
--
-- WHY THIS EXISTS. The `pd_role` list was written before anyone had decided
-- who would actually use PD. When the eight pilot users were named, three
-- things did not match:
--
--   1. `rta` was labelled "Plant Manager (RTA)". Himmayat holds it and he is
--      the R&D Manager — and there is a SEPARATE role, `production`, which is
--      what the real Plant Manager holds. So the label named the wrong job and
--      collided with another role. A compliance audit had also found that RTA
--      is never expanded anywhere in the system, so nobody could learn what it
--      meant from the software. Tahir's ruling: it reads "R&D Manager".
--   2. Agronomy was ONE role covering the whole function, so the system could
--      not tell the lead from the people who work to her. Now three:
--      `agronomy` (Agronomy Lead — Maleeha), `field_agronomy` (Field
--      Agronomist — Nadeem, whose job is checking agronomy claims against
--      field trials), and `associate_agronomy` (Associate Agronomist — Erum).
--   3. Majid holds `production` (Production Manager). Unchanged, listed here
--      so the whole picture is in one place.
--
-- WHAT IT DOES. Extends the `auth_users.pd_role` ENUM by two values and
-- nothing else. **No existing row changes.** The two labels that changed —
-- "Plant Manager (RTA)" → "R&D Manager", "Agronomy" → "Agronomy Lead" — are
-- display strings in `pd/pd-lib.js`, not data, so nobody's access moves when
-- this runs. Maleeha stays exactly where she is; Nadeem and Erum are given
-- their roles by hand in Manage Access afterwards, like every other user.
--
-- The ENUM is extended rather than replaced so the statement is safe to run
-- against the live database with people signed in: adding values at the end of
-- an ENUM is metadata-only in MariaDB and rewrites no rows.
--
-- BOTH new roles are LEADS (`pd/pd-lib.js` LEAD_ROLES), on Tahir's ruling.
-- A lead may name someone else the owner of a Question, Bet or Run, settle a
-- Question, and close work that is not their own. That is the whole of what
-- "lead" means — everybody with any PD role can already write and record
-- freely ("open to write, restricted to assign").
--
-- RUN THIS BY HAND against DATABASE_URL, after 005. It is idempotent in
-- effect: running it twice sets the same ENUM definition again.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Pre-flight. Nothing here can lose data, but say what is about to change.
-- ---------------------------------------------------------------------------
SELECT 'BEFORE — current pd_role definition' AS step;
SELECT COLUMN_TYPE
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME   = 'auth_users'
   AND COLUMN_NAME  = 'pd_role';

SELECT 'BEFORE — who currently holds a PD role' AS step;
SELECT pd_role, COUNT(*) AS people
  FROM auth_users
 WHERE pd_role IS NOT NULL
 GROUP BY pd_role
 ORDER BY pd_role;

-- ---------------------------------------------------------------------------
-- The change. Two values appended; every existing value kept in its original
-- position, so no stored row is reinterpreted.
-- ---------------------------------------------------------------------------
ALTER TABLE auth_users
  MODIFY COLUMN pd_role ENUM(
    'coo',                 -- COO (chair)
    'ceo',                 -- CEO (advisor)
    'qc_head',             -- QC Head
    'rta',                 -- R&D Manager  (label changed 10 Sept 2026; key kept)
    'production',          -- Production Manager
    'agronomy',            -- Agronomy Lead (label changed 10 Sept 2026; key kept)
    'custodian',           -- Data Custodian
    'registrar',           -- Registrar
    'member',              -- Team member
    'lab_tech',            -- Lab Technician
    'consultant',          -- Outside Reviewer (consultant)
    'field_agronomy',      -- NEW: Field Agronomist
    'associate_agronomy'   -- NEW: Associate Agronomist
  ) NULL;

-- ---------------------------------------------------------------------------
-- After. The two new values should be present and every count unchanged.
-- ---------------------------------------------------------------------------
SELECT 'AFTER — new pd_role definition' AS step;
SELECT COLUMN_TYPE
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME   = 'auth_users'
   AND COLUMN_NAME  = 'pd_role';

SELECT 'AFTER — who holds a PD role (should be identical to BEFORE)' AS step;
SELECT pd_role, COUNT(*) AS people
  FROM auth_users
 WHERE pd_role IS NOT NULL
 GROUP BY pd_role
 ORDER BY pd_role;

SELECT 'Done. Now give Nadeem field_agronomy and Erum associate_agronomy in Manage Access.' AS next_step;
