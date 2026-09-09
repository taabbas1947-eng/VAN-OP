-- VAN Operations Platform — PD (Product Development) CORE REBUILD migration
-- ============================================================================
-- Implements the nine-object model in docs/pd-model/MODEL.md (§A of
-- PENDING-DECISIONS.md fully settled 1 Sept 2026) plus the Combination Bank
-- (docs/pd-model/combination-bank/RULES.md) and the reclassification audit
-- trail (docs/pd-model/RECLASSIFICATION-RULES.md, PENDING-DECISIONS.md B13).
--
-- SCOPE OF THIS MILESTONE: schema only. No routes, no screens yet — Tahir's
-- own sequencing choice, 9 Sept 2026 session. Nothing in this file has been
-- run against the live database. Run ONCE against the database your
-- DATABASE_URL points at, same convention as 001_pd_foundation.sql.
--
-- PREREQUISITE: this file only ALTERs pd_materials / pd_comments /
-- pd_library_pins / auth_users — it never CREATEs them. It assumes
-- 001_pd_foundation.sql has already run at least once against this database
-- (true for the real production database today). server.js no longer
-- auto-applies 001 on every boot as of this same session (that auto-apply is
-- what this migration needed retired — see server.js's runPdMigration()), so
-- a brand-new database that never had 001 applied would now fail at the
-- first ALTER TABLE pd_materials with "unknown table." Run 001 by hand first
-- on any such database (a fresh dev/staging DB, a disaster-recovery
-- restore) before running this file. Data-safety review finding, 9 Sept
-- 2026 — disclosed, not fixed, since it does not affect the real database.
--
-- WHAT THIS FILE DOES
--   1. Drops every OLD PD table that is NOT on REUSE-RULES.md §2's whitelist —
--      the gate/hypothesis/candidate spine (pd_problems, pd_products,
--      pd_product_gates, pd_projects, pd_hypotheses, pd_dev_records,
--      pd_samples, pd_lab_tests, pd_field_trials, pd_field_obs,
--      pd_gate_decisions, pd_material_conflicts, pd_route_screens,
--      pd_candidates, pd_candidate_lines, pd_comments, pd_formulations,
--      pd_learnings, pd_regulatory). Safe: "PD holds no real data" is
--      confirmed (PENDING-DECISIONS.md §D, 18 Aug 2026) — there is nothing to
--      migrate out of these tables, only seed/test rows.
--   2. Keeps every whitelisted table's SHAPE untouched: pd_materials (#4),
--      pd_library_items + pd_library_pins + pd_comments (#2 — the Library
--      and its comment feature), pd_dropbox (#3), pd_audit_log (written by
--      the whitelisted pdAuditLogger, #5) — then ALTERs pd_materials
--      additively (new nullable columns only) to carry the assay fields the
--      Combination Bank needs (RULES.md §4.3) and this week's real returned
--      data (HA/Cu/Fe/Mn/B/Ca/Mg/Moisture/OM/pH), which the old table never
--      had room for, and narrows pd_comments.target_type and
--      pd_library_pins.target_type now that their 'hypothesis'/'project'
--      members are dead (see section 0/1 below). A pre-flight check (right
--      after SET NAMES) counts rows across everything section 0 is about to
--      DROP or narrow away, and refuses to continue if it finds any — added
--      after the data-safety review, 9 Sept 2026, rather than trusting "PD
--      holds no real data" without checking it against the real database.
--   3. Creates the new nine-object schema: Problem, Question, Bet, Run
--      (+ Run readings, for B6's "at each stage, not at the end"), Claim,
--      Challenge, Observation, Request, Constraint (+ delivery-context
--      register, seeded with its six named values per MODEL.md §3). Every
--      object except Claim (which has its own claim_number/version scheme,
--      §2 below) gets a permanent human-facing number column (p_number,
--      q_number, bet_number, run_number, challenge_number,
--      observation_number, request_number) — MODEL.md §4 / PENDING-
--      DECISIONS.md: "killed/parked things keep their number and reason
--      forever." pd_problems reuses the exact p_number name the OLD table
--      already had, so the whitelisted Library pin code (REUSE-RULES §2
--      item 2) needs no renaming to keep working.
--   4. Creates the Combination Bank register beneath Bet/Run (A2 — settled,
--      not a tenth object): the combination header, its material lines, the
--      material-request queue (RULES.md §5.4), the "not a duplicate"
--      permanent-dismissal table (§7.7), and EMPTY controlled-vocabulary
--      tables for crop/soil/problem tags (B4 — the real values are Tahir's;
--      the template is out with him; these start empty, nothing invented).
--   5. Creates pd_reclassifications — the permanent, append-only audit trail
--      B13 requires (what it was, who filed it, what it became, who moved it,
--      why — the model's OWN definition, never the mover's prose). Every one
--      of the nine object tables gets converted_to_type / converted_to_id so
--      a record that became something else still resolves and points at the
--      survivor (the same pattern the Combination Bank already uses for a
--      merged record, RULES.md §8.3/§8.5).
--      NOTE: the field-by-field "carry the content across" logic for a given
--      (from-type, to-type) pair is application code, not something a
--      relational schema can do generically. This file gives the audit trail
--      and the pointer mechanics; the conversion logic itself is a
--      screens/routes-milestone task — called out here so it is never
--      quietly assumed to already exist.
--
-- WHAT THIS FILE DELIBERATELY DOES NOT DO
--   - No cost fields anywhere. A3 is settled: cost is OUT of PD, platform-
--     wide, no exception (PENDING-DECISIONS.md §D, 1 Sept 2026). pd_materials
--     still carries its OLD cost_per_tonne / cost_basis / cost_updated
--     columns from before that ruling. This migration does not use, read or
--     populate them anywhere — but it does not drop them either. Dropping a
--     column is a master-data-shape decision, and this migration was built
--     to make additive, reversible changes only. FLAG FOR TAHIR: confirm
--     whether pd_materials.cost_per_tonne / cost_basis / cost_updated should
--     be dropped in a follow-up migration, now that A3 is settled.
--   - No hardcoded values for crop tags, soil tags or problem tags (B4). The
--     tables exist; the rows do not, until Tahir's controlled-vocabulary
--     template comes back. Form and Route (combination-bank/RULES.md §4.1)
--     ARE hardcoded as ENUMs — those were already given, not flagged
--     unconfirmed, in the original 18 Aug design.
--   - No routes, no screens, no permission wiring beyond what already exists
--     (pdAuth / pdSurface / pdAuditLogger, REUSE-RULES.md §2 item 5). The
--     'registrar' pd_role is added (combination-bank/RULES.md §8.2 and
--     RECLASSIFICATION-RULES.md §10 both name "Custodian, Registrar and COO"
--     as the starting moderator group, and 'registrar' did not exist in the
--     001 migration's enum) — nothing is granted to it yet; that is a
--     screens-milestone decision (who actually gets pd_role='registrar').
--   - FLAG FOR TAHIR, raised by the data-safety review, 9 Sept 2026: there is
--     no field-VALUE snapshot anywhere in this schema. pd_reclassifications
--     records that a record was refiled from one type to another (and who,
--     and when, and the model's own definition of the new type), but only as
--     a pointer back to the still-live original row — not a copy of what that
--     row's fields said at the moment of filing. RECLASSIFICATION-RULES.md §4
--     and combination-bank/RULES.md §8.5 both promise an original is never
--     lost, but nothing here stops an ordinary edit (fixing a title, a
--     statement, a combination's inclusion percentage) from silently
--     overwriting history with no before-value kept, on any of the nine
--     objects or the Combination Bank. pd_claims is the one exception — it
--     already has real version/is_current columns. Whether the rest need the
--     same treatment, a generic history table, or something else is a design
--     decision for Tahir before the screens that write to these tables are
--     built — not decided or assumed here.
--
-- Split into separate statements, same convention as 001, so a retry after a
-- partial failure is safe: MySQL error 1060/1061/1091 (column/key/table
-- already exists) on an individual statement should be treated as "already
-- applied" by whoever is running this by hand, not as a reason to stop.

SET NAMES utf8mb4;

-- ============================================================================
-- PRE-FLIGHT SAFETY CHECK — self-added after the data-safety review, 9 Sept
-- 2026. An earlier draft dropped section 0's tables purely on the strength of
-- "PD holds no real data" (PENDING-DECISIONS.md, settled 18 Aug 2026), with
-- nothing in the file actually checking that against this database before
-- doing something irreversible. This does: it counts rows across every table
-- section 0 is about to DROP, plus the 'hypothesis' pd_comments rows and the
-- 'hypothesis'/'project' pd_library_pins rows section 1 is about to narrow
-- away, and refuses to continue if the total is not zero. There is no SIGNAL
-- outside a stored routine in plain MySQL, so the abort is forced by calling
-- a procedure that does not exist — its name carries the row count and the
-- instruction, so whoever runs this by hand sees exactly what stopped it and
-- why, in the error text itself, instead of the DROP just proceeding.
-- ============================================================================

SET SESSION group_concat_max_len = 8192;
-- Headroom for @union_sql below (today's list runs ~890 chars against a
-- 1024-char default) — so a future addition to @at_risk_tables truncates
-- loudly (a syntax error from a cut-off UNION) rather than silently
-- undercounting rows. Data-safety review finding, 9 Sept 2026.
SET @at_risk_tables := 'pd_formulations,pd_regulatory,pd_learnings,pd_candidate_lines,pd_candidates,pd_route_screens,pd_material_conflicts,pd_gate_decisions,pd_field_obs,pd_field_trials,pd_lab_tests,pd_samples,pd_dev_records,pd_hypotheses,pd_projects,pd_product_gates,pd_products,pd_problems';

SET @union_sql := (
  SELECT GROUP_CONCAT(CONCAT('SELECT COUNT(*) c FROM `', TABLE_NAME, '`') SEPARATOR ' UNION ALL ')
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND FIND_IN_SET(TABLE_NAME, @at_risk_tables)
);
-- If none of the at-risk tables exist any more (this migration already ran
-- once), @union_sql is NULL — nothing to check, nothing to sum.
SET @dropped_rows := 0;
SET @sum_sql := IF(@union_sql IS NOT NULL,
  CONCAT('SELECT COALESCE(SUM(c),0) INTO @dropped_rows FROM (', @union_sql, ') x'),
  'DO 0');
PREPARE stmt FROM @sum_sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @comment_rows := 0;
SET @cs := (
  SELECT IF(COUNT(*) > 0, "SELECT COUNT(*) INTO @comment_rows FROM pd_comments WHERE target_type='hypothesis'", 'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pd_comments' AND COLUMN_NAME = 'target_type'
);
PREPARE stmt FROM @cs; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @pin_rows := 0;
SET @ps := (
  SELECT IF(COUNT(*) > 0, "SELECT COUNT(*) INTO @pin_rows FROM pd_library_pins WHERE target_type IN ('hypothesis','project')", 'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pd_library_pins' AND COLUMN_NAME = 'target_type'
);
PREPARE stmt FROM @ps; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @total_at_risk := COALESCE(@dropped_rows,0) + COALESCE(@comment_rows,0) + COALESCE(@pin_rows,0);
-- MySQL caps stored-routine identifiers at 64 characters. Keep the fixed text
-- on both sides short enough that even a very large row count still fits —
-- 46 fixed characters leaves 18 free for digits, far more than needed.
SET @abort_sql := IF(@total_at_risk > 0,
  CONCAT('CALL PD_MIGRATION_ABORT_', @total_at_risk, '_ROWS_FOUND_STOP_TELL_TAHIR()'),
  'DO 0');
PREPARE stmt FROM @abort_sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================================
-- 0. RETIRE THE OLD GATE-BASED SPINE
-- ----------------------------------------------------------------------------
-- Everything below is NOT on REUSE-RULES.md §2's whitelist. Tahir ruled
-- 9 Sept 2026: take the old /pd app down now rather than run it alongside the
-- rebuild. "PD holds no real data" (settled 18 Aug 2026) is what makes this
-- safe — there is nothing here but seed/test rows.
--
-- Order matters: child tables (foreign keys pointing at a parent) drop before
-- their parent, or MySQL refuses the DROP.
-- ============================================================================

DROP TABLE IF EXISTS pd_formulations;        -- FK -> pd_products, pd_hypotheses, pd_dev_records
DROP TABLE IF EXISTS pd_regulatory;          -- FK -> pd_products
DROP TABLE IF EXISTS pd_learnings;           -- FK -> pd_hypotheses
-- pd_comments is KEPT, not dropped. Self-caught error: an earlier draft of this
-- migration dropped it as "old-app-only," but the whitelisted Library comment
-- feature (REUSE-RULES §2 item 2 — GET/POST /api/pd/library/:id/comment) reads
-- and writes it with target_type='library'. Only its 'hypothesis' ENUM member
-- (used by the now-deleted idea-comment route) is dead; narrowed below in
-- section 1, alongside the other additive/narrowing ALTERs on whitelisted
-- tables, now that "PD holds no real data" (18 Aug 2026) makes it safe.
DROP TABLE IF EXISTS pd_candidate_lines;     -- FK -> pd_candidates, pd_materials
DROP TABLE IF EXISTS pd_candidates;          -- FK -> pd_hypotheses, pd_samples
DROP TABLE IF EXISTS pd_route_screens;       -- FK -> pd_hypotheses
DROP TABLE IF EXISTS pd_material_conflicts;  -- FK -> pd_materials (whitelisted table stays; this join table goes)
DROP TABLE IF EXISTS pd_gate_decisions;      -- FK -> pd_product_gates, pd_hypotheses (or similar — old gate log)
DROP TABLE IF EXISTS pd_field_obs;           -- FK -> pd_field_trials
DROP TABLE IF EXISTS pd_field_trials;        -- FK -> pd_hypotheses
DROP TABLE IF EXISTS pd_lab_tests;           -- FK -> pd_samples
DROP TABLE IF EXISTS pd_samples;             -- FK -> pd_hypotheses
DROP TABLE IF EXISTS pd_dev_records;         -- FK -> pd_products / pd_hypotheses

-- pd_dropbox (whitelisted, #3 — stays) has a FOREIGN KEY on
-- converted_hypothesis_id pointing at pd_hypotheses. That FK must be
-- detached BEFORE pd_hypotheses is dropped below, or the DROP TABLE fails
-- outright. The constraint's auto-generated name is not safe to hardcode
-- (depends on declaration order, not guaranteed across MySQL versions/
-- installs) — look it up and drop it dynamically instead of guessing.
SET @fk_name := (
  SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pd_dropbox'
    AND COLUMN_NAME = 'converted_hypothesis_id' AND REFERENCED_TABLE_NAME = 'pd_hypotheses'
  LIMIT 1
);
SET @drop_fk_sql := IF(@fk_name IS NOT NULL,
  CONCAT('ALTER TABLE pd_dropbox DROP FOREIGN KEY ', @fk_name),
  'DO 0');
PREPARE stmt FROM @drop_fk_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE pd_dropbox CHANGE COLUMN converted_hypothesis_id converted_to_id INT NULL;
ALTER TABLE pd_dropbox ADD COLUMN converted_to_type VARCHAR(20) NULL AFTER converted_to_id;
-- converted_to_type is left NULL for any pre-existing row (old app had no
-- other target type to convert a dropbox item into); the routes milestone
-- sets it going forward whenever a dropbox item is converted.

DROP TABLE IF EXISTS pd_hypotheses;          -- FK -> pd_projects / pd_products — dropbox's FK detached above, now safe
DROP TABLE IF EXISTS pd_projects;            -- FK -> pd_products
DROP TABLE IF EXISTS pd_product_gates;       -- FK -> pd_products
DROP TABLE IF EXISTS pd_products;            -- FK -> pd_problems
DROP TABLE IF EXISTS pd_problems;            -- old shape (open/being_addressed/solved/retired, no `kind`) — rebuilt below

-- ============================================================================
-- 1. pd_materials — ALTER ONLY, additive. Whitelisted table (REUSE-RULES §2.4).
-- ----------------------------------------------------------------------------
-- New nullable assay columns for what RULES.md §4.3 needs to compute analysis
-- and what this week's real B2/B3 return actually gave: HA, Cu, Fe, Mn, B,
-- Ca, Mg, Moisture, OM, pH. N/P2O5/K2O/S/Zn already existed and are untouched.
-- Also: `substance` (the two-step picker's first step, §4.1 — "MAP", not
-- "MAP 11-52"; existing `name` stays as the full grade label), `grade_label`
-- for a human-readable grade spec distinct from `name`, `grade_pending` for
-- §5.5's "grade not yet decided" placeholder state as a real flag rather than
-- an overloaded text convention, and `too_common_to_signal` for B16's
-- drafted (not confirmed) moderator opt-out on the cross-product signal.
-- ============================================================================

ALTER TABLE pd_materials ADD COLUMN substance VARCHAR(120) NULL AFTER name;
ALTER TABLE pd_materials ADD COLUMN grade_label VARCHAR(120) NULL AFTER substance;
ALTER TABLE pd_materials ADD COLUMN grade_pending TINYINT(1) NOT NULL DEFAULT 0 AFTER grade_label;
ALTER TABLE pd_materials ADD COLUMN ha_pct DECIMAL(6,3) NULL AFTER zn_pct;
ALTER TABLE pd_materials ADD COLUMN cu_pct DECIMAL(6,3) NULL AFTER ha_pct;
ALTER TABLE pd_materials ADD COLUMN fe_pct DECIMAL(6,3) NULL AFTER cu_pct;
ALTER TABLE pd_materials ADD COLUMN mn_pct DECIMAL(6,3) NULL AFTER fe_pct;
ALTER TABLE pd_materials ADD COLUMN b_pct DECIMAL(6,3) NULL AFTER mn_pct;
ALTER TABLE pd_materials ADD COLUMN ca_pct DECIMAL(6,3) NULL AFTER b_pct;
ALTER TABLE pd_materials ADD COLUMN mg_pct DECIMAL(6,3) NULL AFTER ca_pct;
ALTER TABLE pd_materials ADD COLUMN moisture_pct DECIMAL(6,3) NULL AFTER mg_pct;
ALTER TABLE pd_materials ADD COLUMN om_pct DECIMAL(6,3) NULL AFTER moisture_pct;
ALTER TABLE pd_materials ADD COLUMN ph_value DECIMAL(5,2) NULL AFTER om_pct;
ALTER TABLE pd_materials ADD COLUMN too_common_to_signal TINYINT(1) NOT NULL DEFAULT 0 AFTER active;

-- 'registrar' joins the moderator-eligible roles (combination-bank/RULES.md
-- §8.2, RECLASSIFICATION-RULES.md §10: "Custodian, Registrar and COO to
-- start"). Nobody is assigned it by this migration.
ALTER TABLE auth_users MODIFY COLUMN pd_role ENUM('coo','ceo','qc_head','rta','production','agronomy','custodian','registrar','member','lab_tech','consultant') NULL;

-- pd_comments (whitelisted dependency of the Library, see the note in section 0
-- above): narrow its target_type ENUM now that the 'hypothesis' target no
-- longer exists. Safe and additive-in-spirit — "PD holds no real data"
-- (18 Aug 2026), so there are no existing rows using the removed member. The
-- pre-flight check above aborts instead of trusting that blindly.
ALTER TABLE pd_comments MODIFY COLUMN target_type ENUM('library') NOT NULL;

-- pd_library_pins (whitelisted, part of the Library — REUSE-RULES §2 item 2):
-- same narrowing, same reason. Self-caught in code review: the rewritten
-- pinTargets()/resolvePin() in pd-routes.js only ever create/expect 'problem'
-- pins now that 'hypothesis' and 'project' have nowhere to point; narrowing
-- the schema itself (not just the application code) is what actually closes
-- this, rather than trusting every caller to remember the new rule.
ALTER TABLE pd_library_pins MODIFY COLUMN target_type ENUM('problem') NOT NULL;

-- ============================================================================
-- 2. THE SPINE — Problem, Question, Bet, Run (+ readings)
-- ============================================================================

CREATE TABLE IF NOT EXISTS pd_problems (
  id INT AUTO_INCREMENT PRIMARY KEY,
  p_number INT NOT NULL,
  -- MODEL.md §4 / PENDING-DECISIONS.md line ~422-424: "killed/parked things
  -- keep their number and reason forever" — every object gets a permanent
  -- human-facing number, not just an auto-increment id. Same column name and
  -- fmt_p() format the OLD pd_problems already used (pd-lib.js), kept
  -- identical on purpose so the whitelisted Library pin code (REUSE-RULES §2
  -- item 2) needs no renaming to compile against this table.
  title VARCHAR(200) NOT NULL,
  statement TEXT NOT NULL,
  context TEXT,
  kind ENUM('field_problem','product_concept') NOT NULL DEFAULT 'field_problem',
  -- MODEL.md §3, A4 (settled 1 Sept 2026): a stated product concept is a
  -- first-class Problem, not a fabricated field pain forced on top of it.
  status ENUM('open','addressed','retired') NOT NULL DEFAULT 'open',
  added_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_reason TEXT NULL,
  -- MODEL.md §4: "Every object: owner, state, and a written reason on close."
  -- Covers whichever way this closes (addressed or retired) — one column, not
  -- an addressed_reason/retired_reason pair, matching how pd_requests already
  -- uses a single closed_reason for its own two terminal states.
  converted_to_type VARCHAR(20) NULL,
  converted_to_id INT NULL,
  UNIQUE KEY uq_p_number (p_number),
  FOREIGN KEY (added_by) REFERENCES auth_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  q_number INT NOT NULL,
  -- permanent human-facing number (MODEL.md §4 memory-moat rule) — see the
  -- p_number comment on pd_problems above.
  problem_id INT NOT NULL,
  -- Question --belongs_to--> Problem, mandatory (MODEL.md §4). Covers both a
  -- field_problem and a product_concept parent — no nullable-parent hack.
  title VARCHAR(200) NOT NULL,
  text TEXT NOT NULL,
  nature ENUM('agronomy','chemistry','production','commercial','regulatory') NOT NULL,
  owner_id INT NOT NULL,
  state ENUM('open','contested','settled') NOT NULL DEFAULT 'open',
  due_date DATE NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  settled_at TIMESTAMP NULL,
  settled_reason TEXT NULL,
  converted_to_type VARCHAR(20) NULL,
  converted_to_id INT NULL,
  FOREIGN KEY (problem_id) REFERENCES pd_problems(id),
  FOREIGN KEY (owner_id) REFERENCES auth_users(id),
  FOREIGN KEY (created_by) REFERENCES auth_users(id),
  UNIQUE KEY uq_q_number (q_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_delivery_contexts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(60) NOT NULL UNIQUE
  -- MODEL.md §3: "a small register of delivery contexts... defined once;
  -- every product aimed through it inherits its constraints." Seeded below
  -- with the six named values — this register does not grow by user entry,
  -- only by Tahir's sign-off, the same as the nine-object count itself.
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO pd_delivery_contexts (name) VALUES
  ('soil broadcast'), ('side-dress band'), ('fertigation'),
  ('foliar'), ('ULV drone'), ('seed treatment');

CREATE TABLE IF NOT EXISTS pd_constraints (
  id INT AUTO_INCREMENT PRIMARY KEY,
  delivery_context_id INT NOT NULL,
  kind ENUM('blending','storage_crh','logistics_freight','regulatory','plant_capability') NOT NULL,
  rule_text TEXT NOT NULL,
  added_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  active TINYINT(1) NOT NULL DEFAULT 1,
  retired_reason TEXT NULL,
  FOREIGN KEY (delivery_context_id) REFERENCES pd_delivery_contexts(id),
  FOREIGN KEY (added_by) REFERENCES auth_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_bets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bet_number INT NOT NULL,
  -- permanent human-facing number (MODEL.md §4 memory-moat rule).
  question_id INT NOT NULL,
  -- Bet --tests--> Question (MODEL.md §4).
  delivery_context_id INT NULL,
  -- "a Bet is a product aimed through a context and inherits both" chemistry
  -- + constraints (MODEL.md §3). Nullable: an idea-stage Bet may not have
  -- picked a context yet — same "never force a fictional early answer"
  -- posture as the material register's grade_pending (§5.5).
  approach TEXT NOT NULL,
  kill_criterion TEXT NOT NULL,
  -- "the one result that would kill it, written before any bench work"
  -- (MODEL.md §3). Mandatory at the DB level because it is mandatory in the
  -- model — there is no Bet without one.
  status ENUM('active','killed','advanced') NOT NULL DEFAULT 'active',
  -- Report screen KPI wording, PENDING-DECISIONS.md B19: "Bets active /
  -- killed / advanced."
  owner_id INT NOT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closing_claim_id INT NULL,
  -- Hard rule 2 (MODEL.md §0): "Nothing gets closed until we have written the
  -- result." Enforcing "status <> 'active' implies closing_claim_id IS NOT
  -- NULL" is an application-layer rule (MySQL CHECK constraints are not a
  -- reliable place to put a cross-table requirement) — flagged here so it is
  -- not silently skipped when the routes get built.
  closed_at TIMESTAMP NULL,
  converted_to_type VARCHAR(20) NULL,
  converted_to_id INT NULL,
  FOREIGN KEY (question_id) REFERENCES pd_questions(id),
  FOREIGN KEY (delivery_context_id) REFERENCES pd_delivery_contexts(id),
  FOREIGN KEY (owner_id) REFERENCES auth_users(id),
  FOREIGN KEY (created_by) REFERENCES auth_users(id),
  UNIQUE KEY uq_bet_number (bet_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_runs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  run_number INT NOT NULL,
  -- permanent human-facing number (MODEL.md §4 memory-moat rule).
  bet_id INT NOT NULL,
  -- Run --under--> Bet (MODEL.md §4).
  combination_id INT NULL,
  -- "one recipe made and measured" — the recipe is the Combination Bank
  -- register beneath this Run (A2). Nullable only until the combination
  -- record for this specific run is entered; a Run without one is a data
  -- gap to close, not a valid permanent state, but the DB does not block on
  -- ordering of entry.
  expected TEXT NOT NULL,
  actual TEXT NULL,
  status ENUM('running','abnormal_investigation','closed') NOT NULL DEFAULT 'running',
  -- B15: "abnormality found -> investigation open" is a real state the old
  -- model did not have. Not "passed", not "failed", not "still running."
  replaces_run_id INT NULL,
  replaces_reason TEXT NULL,
  -- B14: "a Run must name the Run it replaced, and why" — SOP -> KOH ->
  -- potassium carbonate is one line of investigation, not three unrelated
  -- trials, only if this link exists.
  owner_id INT NOT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closing_claim_id INT NULL,
  closed_at TIMESTAMP NULL,
  converted_to_type VARCHAR(20) NULL,
  converted_to_id INT NULL,
  FOREIGN KEY (bet_id) REFERENCES pd_bets(id),
  FOREIGN KEY (replaces_run_id) REFERENCES pd_runs(id),
  FOREIGN KEY (owner_id) REFERENCES auth_users(id),
  FOREIGN KEY (created_by) REFERENCES auth_users(id),
  UNIQUE KEY uq_run_number (run_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_run_readings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  run_id INT NOT NULL,
  reading_date DATE NOT NULL,
  parameters_checked TEXT NULL,
  physical_observation TEXT NULL,
  -- "or explicitly none seen" (B6) — NULL/blank IS a valid recorded reading,
  -- not a missing one, as long as the row itself exists for that date.
  analytical_result TEXT NULL,
  verdict ENUM('normal','abnormal') NOT NULL,
  next_observation_date DATE NULL,
  -- B6: "the reading schedule moves... a live owned commitment, not a
  -- calendar set on day one." Each reading sets its own next date.
  recorded_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (run_id) REFERENCES pd_runs(id),
  FOREIGN KEY (recorded_by) REFERENCES auth_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Application logic (not this migration): a reading with verdict='abnormal'
-- should flip the parent pd_runs.status to 'abnormal_investigation' (B15).
-- A MySQL trigger could do this instead of app code; left as an explicit
-- choice for the routes milestone rather than decided here.

CREATE TABLE IF NOT EXISTS pd_claims (
  id INT AUTO_INCREMENT PRIMARY KEY,
  claim_number INT NOT NULL,
  -- Permanent identity across versions (MODEL.md §6: "versioned; never
  -- overwrite in place"). Several rows can share one claim_number; only the
  -- current version has is_current = 1.
  version INT NOT NULL DEFAULT 1,
  is_current TINYINT(1) NOT NULL DEFAULT 1,
  subject_type ENUM('question','problem') NOT NULL,
  -- Claim --answers/attaches_to--> Question (MODEL.md §4) is the normal
  -- case; B17 additionally requires a Claim directly against a Problem for a
  -- falsified belief that outlives one trial ("fermentation should not occur
  -- at such a low pH" — a general fact, not a Run's footnote).
  subject_id INT NOT NULL,
  text TEXT NOT NULL,
  owner_id INT NOT NULL,
  grade ENUM('proven','contested','believed') NOT NULL,
  challenges_claim_id INT NULL,
  -- Claim --challenges--> Claim (MODEL.md §4). Self-referential; anyone may
  -- challenge a Claim, per MODEL.md §3's "atom" definition.
  source_ref VARCHAR(500) NULL,
  -- C5 (settled 1 Sept 2026): "light native + link" — a pointer to the deep
  -- source material (e.g. a path under E:\NP), not a duplicate of it.
  run_id INT NULL,
  -- set when this Claim is the one that closes a Run (pd_runs.closing_claim_id
  -- points back here) — nullable because a Claim can also close a Bet
  -- directly, or stand alone against a Problem (B17).
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  superseded_by_claim_id INT NULL,
  converted_to_type VARCHAR(20) NULL,
  converted_to_id INT NULL,
  FOREIGN KEY (challenges_claim_id) REFERENCES pd_claims(id),
  FOREIGN KEY (run_id) REFERENCES pd_runs(id),
  FOREIGN KEY (owner_id) REFERENCES auth_users(id),
  FOREIGN KEY (created_by) REFERENCES auth_users(id),
  KEY k_claim_number (claim_number),
  KEY k_subject (subject_type, subject_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Now that pd_claims exists, wire the closing_claim_id FKs on Bet and Run.
ALTER TABLE pd_bets ADD CONSTRAINT fk_bet_closing_claim FOREIGN KEY (closing_claim_id) REFERENCES pd_claims(id);
ALTER TABLE pd_runs ADD CONSTRAINT fk_run_closing_claim FOREIGN KEY (closing_claim_id) REFERENCES pd_claims(id);

-- ============================================================================
-- 3. THE THREE DOORS — Challenge, Observation, Request
-- ----------------------------------------------------------------------------
-- RECLASSIFICATION-RULES.md §3: "Anything entered from the door is unsorted
-- by default... not a backlog of mistakes. It is the normal front of the
-- system." All three start status='unsorted'; triage sets problem_id and
-- moves status forward.
-- ============================================================================

CREATE TABLE IF NOT EXISTS pd_challenges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  challenge_number INT NOT NULL,
  -- permanent human-facing number (MODEL.md §4 memory-moat rule).
  product_ref VARCHAR(120) NOT NULL,
  -- "a complaint on a product we already sell" (MODEL.md §3) — free text
  -- naming the product; PD has no product master of its own in this model
  -- (VAN sells use-efficiency, not a PD-tracked SKU list), so this stays a
  -- label rather than a foreign key.
  complaint_text TEXT NOT NULL,
  buried_claim_text TEXT NULL,
  -- "usually carries a buried, unverified claim that must be made measurable
  -- first" (MODEL.md §3) — captured as its own field so it is visible before
  -- anyone tries to answer the surface complaint.
  reported_by_name VARCHAR(120) NULL,
  reported_by_contact VARCHAR(120) NULL,
  source ENUM('team','farmer','dealer','regulator','consultant','management','other') NOT NULL DEFAULT 'team',
  status ENUM('unsorted','triaged') NOT NULL DEFAULT 'unsorted',
  problem_id INT NULL,
  owner_id INT NULL,
  logged_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  triaged_by INT NULL,
  triaged_at TIMESTAMP NULL,
  converted_to_type VARCHAR(20) NULL,
  converted_to_id INT NULL,
  FOREIGN KEY (problem_id) REFERENCES pd_problems(id),
  FOREIGN KEY (owner_id) REFERENCES auth_users(id),
  FOREIGN KEY (logged_by) REFERENCES auth_users(id),
  FOREIGN KEY (triaged_by) REFERENCES auth_users(id),
  UNIQUE KEY uq_challenge_number (challenge_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_observations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  observation_number INT NOT NULL,
  -- permanent human-facing number (MODEL.md §4 memory-moat rule).
  text TEXT NOT NULL,
  origin ENUM('door','arose_in_run','system_signal') NOT NULL DEFAULT 'door',
  -- 'door': the ordinary intake case (MODEL.md §3 — "a result or material
  --   that arrived; not a complaint, not an idea").
  -- 'arose_in_run': B18 — "an Observation can arise INSIDE a Run" (settling,
  --   ammonia formation, seal swelling — generated by a Run, not from
  --   outside), so run_id is set.
  -- 'system_signal': B16's cross-product signal, system-authored rather than
  --   person-authored (RULES.md §9.3) — is_system_generated is also set for
  --   an explicit, un-missable flag alongside this.
  run_id INT NULL,
  is_system_generated TINYINT(1) NOT NULL DEFAULT 0,
  signal_source_type VARCHAR(20) NULL,
  signal_source_id INT NULL,
  -- B16 draft: "a pointer back to the event that raised it, so the recipient
  -- can see why they were told." Points at the Challenge/Observation/Claim/
  -- Run whose material tag triggered this row.
  reported_by_name VARCHAR(120) NULL,
  status ENUM('unsorted','triaged') NOT NULL DEFAULT 'unsorted',
  problem_id INT NULL,
  owner_id INT NULL,
  logged_by INT NULL,
  -- nullable: a system-generated Observation (B16) has no human logger.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  triaged_by INT NULL,
  triaged_at TIMESTAMP NULL,
  converted_to_type VARCHAR(20) NULL,
  converted_to_id INT NULL,
  FOREIGN KEY (run_id) REFERENCES pd_runs(id),
  FOREIGN KEY (problem_id) REFERENCES pd_problems(id),
  FOREIGN KEY (owner_id) REFERENCES auth_users(id),
  FOREIGN KEY (logged_by) REFERENCES auth_users(id),
  FOREIGN KEY (triaged_by) REFERENCES auth_users(id),
  UNIQUE KEY uq_observation_number (observation_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_number INT NOT NULL,
  -- permanent human-facing number (MODEL.md §4 memory-moat rule).
  requester VARCHAR(120) NOT NULL,
  purpose TEXT NOT NULL,
  recipient VARCHAR(120) NOT NULL,
  dispatch_date DATE NULL,
  return_by DATE NULL,
  -- "requester, purpose, recipient, dispatch date, owner, return-by...
  -- the Rudolf/customer-sample fix" (MODEL.md §3).
  status ENUM('unsorted','open','fulfilled','declined') NOT NULL DEFAULT 'unsorted',
  problem_id INT NULL,
  owner_id INT NULL,
  logged_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  triaged_by INT NULL,
  triaged_at TIMESTAMP NULL,
  closed_reason TEXT NULL,
  closed_at TIMESTAMP NULL,
  converted_to_type VARCHAR(20) NULL,
  converted_to_id INT NULL,
  FOREIGN KEY (problem_id) REFERENCES pd_problems(id),
  FOREIGN KEY (owner_id) REFERENCES auth_users(id),
  FOREIGN KEY (logged_by) REFERENCES auth_users(id),
  FOREIGN KEY (triaged_by) REFERENCES auth_users(id),
  UNIQUE KEY uq_request_number (request_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- 4. THE COMBINATION BANK — register beneath Bet/Run (A2, settled)
-- ============================================================================

CREATE TABLE IF NOT EXISTS pd_crop_tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE
  -- B4: real crop list is still open (Tahir's controlled-vocabulary
  -- template). Empty on purpose.
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_soil_tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_problem_tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE
  -- NOTE: distinct from pd_problems (the object). This is the Combination
  -- Bank's own tag vocabulary (RULES.md §4.1 "Problem tags — required, from
  -- the controlled list"), which may reference a Problem loosely by theme
  -- even when the combination is not formally linked to one Problem row yet.
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_combinations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(60) NOT NULL,
  name VARCHAR(200) NOT NULL,
  status ENUM('idea','screened','selected','bench','formulation','parked','killed','external') NOT NULL DEFAULT 'idea',
  origin ENUM('internal','ai_session','competitor','literature','dropbox') NOT NULL,
  against_type ENUM('problem','idea','product','project','none') NOT NULL DEFAULT 'none',
  against_problem_id INT NULL,
  against_ref_text VARCHAR(200) NULL,
  -- "Thought up against — required. problem · idea · product · project ·
  -- none — plus the specific thing named" (RULES.md §4.1). A real Problem
  -- row is linked when against_type='problem'; the other cases (idea,
  -- product, project) are named in free text since PD has no separate
  -- registers for those.
  bet_id INT NULL,
  -- "an un-run combination is a Bet that never got a Run" (RULES.md §2) —
  -- nullable until a Bet actually exists for it.
  project_ref VARCHAR(120) NULL,
  form ENUM('granular','liquid','SC','powder','coated') NOT NULL,
  route ENUM('soil','foliar','fertigation','seed treatment') NOT NULL,
  technique ENUM('blended','co-granulated','fused','coated','layered','impregnated','reacted') NULL,
  -- B9: drafted 1 Sept 2026, included now per Tahir (9 Sept 2026 session) —
  -- nullable so an old-style / not-yet-tagged idea does not block on it, but
  -- required in application logic going forward per RULES.md §4.1.
  mechanism_intent ENUM('compete_ca_sites','delay_release','acidulate_micro_zone','chelate','protect_from_volatilisation') NULL,
  -- B11: optional by design (RULES.md §9.1) — "not every idea has a named
  -- mechanism yet."
  rationale TEXT NOT NULL,
  source VARCHAR(200) NOT NULL,
  recorded_by INT NOT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  review_state ENUM('confirmed','pending_review') NOT NULL DEFAULT 'confirmed',
  duplicate_band ENUM('identical','variant','related','clear') NULL,
  sibling_of_combination_id INT NULL,
  repeat_of_combination_id INT NULL,
  -- RULES.md §7.3: an "Identical" band does not save as a new record — it
  -- saves as a repeat run of the original, linked here, with its own date
  -- and reason (recorded_at / rationale on this same row cover that).
  merged_into_combination_id INT NULL,
  -- RULES.md §8.3 "Merge into...": folds into an existing combination; kept
  -- as its own row (never deleted) with this pointer so its number still
  -- resolves and points at the survivor.
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_combo_code (code),
  FOREIGN KEY (against_problem_id) REFERENCES pd_problems(id),
  FOREIGN KEY (bet_id) REFERENCES pd_bets(id),
  FOREIGN KEY (sibling_of_combination_id) REFERENCES pd_combinations(id),
  FOREIGN KEY (repeat_of_combination_id) REFERENCES pd_combinations(id),
  FOREIGN KEY (merged_into_combination_id) REFERENCES pd_combinations(id),
  FOREIGN KEY (recorded_by) REFERENCES auth_users(id),
  FULLTEXT ft_combo (code, name, rationale, against_ref_text, project_ref)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Now that pd_combinations exists, wire pd_runs.combination_id.
ALTER TABLE pd_runs ADD CONSTRAINT fk_run_combination FOREIGN KEY (combination_id) REFERENCES pd_combinations(id);

CREATE TABLE IF NOT EXISTS pd_combination_crop_tags (
  combination_id INT NOT NULL,
  crop_tag_id INT NOT NULL,
  PRIMARY KEY (combination_id, crop_tag_id),
  FOREIGN KEY (combination_id) REFERENCES pd_combinations(id),
  FOREIGN KEY (crop_tag_id) REFERENCES pd_crop_tags(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_combination_soil_tags (
  combination_id INT NOT NULL,
  soil_tag_id INT NOT NULL,
  PRIMARY KEY (combination_id, soil_tag_id),
  FOREIGN KEY (combination_id) REFERENCES pd_combinations(id),
  FOREIGN KEY (soil_tag_id) REFERENCES pd_soil_tags(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_combination_problem_tags (
  combination_id INT NOT NULL,
  problem_tag_id INT NOT NULL,
  PRIMARY KEY (combination_id, problem_tag_id),
  FOREIGN KEY (combination_id) REFERENCES pd_combinations(id),
  FOREIGN KEY (problem_tag_id) REFERENCES pd_problem_tags(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_combination_lines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  combination_id INT NOT NULL,
  material_id INT NOT NULL,
  inclusion_pct DECIMAL(7,3) NOT NULL,
  role ENUM('fast_release_p','slow_release_p','competing_anion','coating','binder','carrier','filler') NOT NULL,
  -- B10: required (RULES.md §4.2).
  phase ENUM('core','shell','interlayer','matrix') NOT NULL DEFAULT 'matrix',
  -- B10: required only in application logic when the parent combination's
  -- technique is layered/coated/fused; defaults to matrix (single-phase)
  -- otherwise so a plain blend is never forced into a false structure.
  line_note VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (combination_id) REFERENCES pd_combinations(id),
  FOREIGN KEY (material_id) REFERENCES pd_materials(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Application logic (not this migration): reject a save unless the
-- combination's lines sum to 99.5-100.5% inclusion (RULES.md §4.2).

CREATE TABLE IF NOT EXISTS pd_combination_not_duplicates (
  combination_a_id INT NOT NULL,
  combination_b_id INT NOT NULL,
  dismissed_by INT NOT NULL,
  dismissed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- RULES.md §7.7: "Dismissing a pair records a permanent not-a-duplicate
  -- link... never raised again, for anyone."
  PRIMARY KEY (combination_a_id, combination_b_id),
  FOREIGN KEY (combination_a_id) REFERENCES pd_combinations(id),
  FOREIGN KEY (combination_b_id) REFERENCES pd_combinations(id),
  FOREIGN KEY (dismissed_by) REFERENCES auth_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_material_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  requested_text TEXT NOT NULL,
  -- RULES.md §5.4: "describing what they mean in free text — that text never
  -- becomes a material name." Held here only, never copied into
  -- pd_materials.name/substance directly by anything but a moderator action.
  requested_by INT NOT NULL,
  combination_id INT NULL,
  -- the combination that was saved, flagged, while waiting on this request.
  status ENUM('pending','added','mapped','declined') NOT NULL DEFAULT 'pending',
  resolved_material_id INT NULL,
  resolved_by INT NULL,
  resolved_at TIMESTAMP NULL,
  decline_reason TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (requested_by) REFERENCES auth_users(id),
  FOREIGN KEY (combination_id) REFERENCES pd_combinations(id),
  FOREIGN KEY (resolved_material_id) REFERENCES pd_materials(id),
  FOREIGN KEY (resolved_by) REFERENCES auth_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --- B16 cross-product signal: material tags on Challenge / Observation / Claim ---
-- (RULES.md §9.3 — drafted, not confirmed; included now per Tahir, 9 Sept
-- 2026, "as optional." A Run does not get its own material tag — it is tied
-- to its combination's material lines already, via pd_runs.combination_id.)

CREATE TABLE IF NOT EXISTS pd_challenge_materials (
  challenge_id INT NOT NULL,
  material_id INT NOT NULL,
  PRIMARY KEY (challenge_id, material_id),
  FOREIGN KEY (challenge_id) REFERENCES pd_challenges(id),
  FOREIGN KEY (material_id) REFERENCES pd_materials(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_observation_materials (
  observation_id INT NOT NULL,
  material_id INT NOT NULL,
  PRIMARY KEY (observation_id, material_id),
  FOREIGN KEY (observation_id) REFERENCES pd_observations(id),
  FOREIGN KEY (material_id) REFERENCES pd_materials(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_claim_materials (
  claim_id INT NOT NULL,
  material_id INT NOT NULL,
  PRIMARY KEY (claim_id, material_id),
  FOREIGN KEY (claim_id) REFERENCES pd_claims(id),
  FOREIGN KEY (material_id) REFERENCES pd_materials(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- 5. RECLASSIFICATION AUDIT TRAIL (B13 / RECLASSIFICATION-RULES.md)
-- ============================================================================

CREATE TABLE IF NOT EXISTS pd_reclassifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  from_type VARCHAR(20) NOT NULL,
  from_id INT NOT NULL,
  original_author_id INT NOT NULL,
  original_filed_at TIMESTAMP NOT NULL,
  to_type VARCHAR(20) NOT NULL,
  to_id INT NOT NULL,
  moved_by INT NOT NULL,
  moved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  definition_text TEXT NOT NULL,
  -- RECLASSIFICATION-RULES.md §2: "the model's own definition of the new
  -- type," generated by the application from MODEL.md's own glossary at the
  -- moment of the move — never the mover's free prose. This column holds
  -- that generated sentence, exactly as shown to the original author.
  free_note TEXT NULL,
  -- "A free note is available and always optional... never demanded."
  reversed TINYINT(1) NOT NULL DEFAULT 0,
  reversed_by INT NULL,
  reversed_at TIMESTAMP NULL,
  FOREIGN KEY (original_author_id) REFERENCES auth_users(id),
  FOREIGN KEY (moved_by) REFERENCES auth_users(id),
  FOREIGN KEY (reversed_by) REFERENCES auth_users(id),
  KEY k_from (from_type, from_id),
  KEY k_to (to_type, to_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Deliberately no foreign keys from from_id/to_id into the nine object
-- tables: from_type/to_type range over nine different tables, and MySQL has
-- no polymorphic FK. Referential integrity for this table is an application
-- responsibility, same trade-off pd_audit_log's free-text `detail` column
-- already accepts.

-- ============================================================================
-- End of 002_pd_core_rebuild.sql
-- ============================================================================
