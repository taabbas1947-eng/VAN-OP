-- ============================================================================
-- 003_pd_history_and_notices.sql
--   (a) pd_field_history — the append-only record of what a field used to say
--   (b) pd_notices       — the one message an author sees when their entry is
--                          refiled (RECLASSIFICATION-RULES.md §7)
--   (c) pd_observations.door_chosen — did the person pick a door, or did we
--                          file it as an Observation because they did not have
--                          to (MODEL.md §5.1 / RECLASSIFICATION-RULES.md §3)
--
-- WRITTEN 9 Sept 2026. Tahir's ruling this session, on the gap 002's own
-- header disclosed: "no field-VALUE snapshot anywhere yet — an ordinary edit
-- can still silently overwrite history on any of the nine objects." He chose
-- the append-only snapshot table over locking records or deferring edits.
--
-- RUN BY HAND, BY TAHIR, ONLY. Requires 001 and 002.
--
-- SAFE TO RE-RUN. The CREATEs are IF NOT EXISTS, the ADD COLUMN fails only
-- with MySQL 1060 (duplicate column), the triggers are dropped before being
-- created, and section (c) no longer contains an UPDATE at all.
--
-- AMENDED 11 September 2026 — section (c) only. The file previously claimed
-- to be safe to re-run while ending on an unguarded UPDATE that set
-- door_chosen = 0 on every row created before NOW(). On a second run that
-- statement resets EVERY observation to 0, including the ones where a person
-- really did choose a door — erasing the exact distinction the column was
-- added to hold, with nothing anywhere to restore it from (a migration writes
-- no pd_field_history rows). The backfill is now done by the column default
-- instead, so it cannot happen twice. Behaviour on a fresh database is
-- identical to the original; on a database where the original already ran,
-- this file changes nothing.
--
-- ---------------------------------------------------------------------------
-- WHY A TABLE AND NOT A COLUMN. Every one of the nine objects is editable
-- (RECLASSIFICATION-RULES.md §4: "Content is editable. The record of what it
-- was is not"). Putting a "previous value" column on each object holds one
-- generation of one field; this holds every generation of every field, for
-- every object type, in one place a screen can read.
--
-- WHY APPEND-ONLY IS ENFORCED IN THE DATABASE. A rule that lives only in
-- application code is a rule until the next person writes an UPDATE. The two
-- triggers below make MySQL itself refuse to change or remove a history row,
-- so "the record of what it was is not editable" is true of the storage and
-- not merely of the current routes.
--
-- WHAT MUST NEVER BE BUILT ON TOP OF THIS. RECLASSIFICATION-RULES.md §8.1:
-- "No per-person error count. Not on a dashboard, not in a report, not
-- derivable from the audit log by any screen the system offers." This table
-- names a person on every row because a reader needs to know who to ask —
-- never so anyone can be counted. No screen may group it by person.
-- ============================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- (a) The append-only field history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pd_field_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  object_type VARCHAR(24) NOT NULL,
  -- One of the nine (problem, question, bet, run, claim, challenge,
  -- observation, request, constraint) or a register row beneath them
  -- (combination, combination_line, material, run_reading). Deliberately no
  -- foreign key and no ENUM: the same polymorphic-target trade-off
  -- pd_reclassifications already accepts, for the same reason — MySQL has no
  -- polymorphic FK, and an ENUM here would need altering every time the model
  -- gains a register.
  object_id INT NOT NULL,
  field VARCHAR(64) NOT NULL,
  old_value MEDIUMTEXT NULL,
  new_value MEDIUMTEXT NULL,
  -- NULL means the field was empty, not that it is unknown. An 'edit' row
  -- always carries both sides; a 'snapshot_on_move' row carries only
  -- old_value, because it is a copy of what the record said at the moment it
  -- was refiled, not a change to it.
  change_kind ENUM('edit','snapshot_on_move','undo','not_applied') NOT NULL DEFAULT 'edit',
  -- 'not_applied' is the compensating row. A history row is written BEFORE the
  -- record is changed, so that nothing can change without its history; but
  -- these two writes are not one transaction (the PD routes are handed a
  -- pooled query function, not a connection, so they cannot open one). If the
  -- change itself is then refused by the database, the route appends a
  -- 'not_applied' row rather than trying to remove the first one — which the
  -- triggers below correctly forbid. The screen renders such a pair as "this
  -- change did not go through", so the log stays true instead of quietly
  -- claiming a change that never happened.
  changed_by INT NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  free_note TEXT NULL,
  -- Always optional, never demanded, its absence never shown
  -- (RECLASSIFICATION-RULES.md §2).
  reclassification_id INT NULL,
  -- Set on the rows written by a type move, so the snapshot and the move that
  -- caused it read as one event.
  KEY k_object (object_type, object_id, id),
  KEY k_when (changed_at),
  KEY k_recl (reclassification_id),
  FOREIGN KEY (changed_by) REFERENCES auth_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TRIGGER IF EXISTS pd_field_history_no_update;
DROP TRIGGER IF EXISTS pd_field_history_no_delete;

CREATE TRIGGER pd_field_history_no_update BEFORE UPDATE ON pd_field_history
FOR EACH ROW SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'pd_field_history is append-only: a record of what something used to say cannot be changed.';

CREATE TRIGGER pd_field_history_no_delete BEFORE DELETE ON pd_field_history
FOR EACH ROW SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'pd_field_history is append-only: a record of what something used to say cannot be removed.';

-- ---------------------------------------------------------------------------
-- (b) The author's notice
-- ---------------------------------------------------------------------------
-- RECLASSIFICATION-RULES.md §7 specifies this message exactly: three parts and
-- nothing else — what it became (with a link), the one-line definition of the
-- new type, and who moved it. The definition is generated from the model's own
-- glossary (pd-lib.js OBJECT_DEFINITIONS), never typed by the mover, and is
-- stored here as sent so that editing the glossary later never rewrites a
-- message somebody already read.
--
-- The reply — "I meant something else" — is one column, because §7 says the
-- author must be able to answer back: "correction that cannot be answered is
-- authority, not teaching." It returns to the mover as a question.
--
-- What this table must never become: a digest of entries that "needed
-- correction" (§8.5), or anything countable per person (§8.1). One notice per
-- author per move, and for a bulk refiling one summary notice, never thirty
-- (§10, Bulk).
CREATE TABLE IF NOT EXISTS pd_notices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recipient_id INT NOT NULL,
  headline VARCHAR(200) NOT NULL,          -- "Your entry is now Request REQ-004."
  definition_text TEXT NOT NULL,           -- the glossary line for the new type
  moved_by INT NOT NULL,
  link_type VARCHAR(24) NULL,              -- where "open it" goes
  link_id INT NULL,
  reclassification_id INT NULL,
  seen_at TIMESTAMP NULL,
  reply_text TEXT NULL,                    -- "I meant something else" — a question, not a complaint
  replied_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY k_recipient (recipient_id, seen_at),
  FOREIGN KEY (recipient_id) REFERENCES auth_users(id),
  FOREIGN KEY (moved_by) REFERENCES auth_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- (c) Did the person choose a door?
-- ---------------------------------------------------------------------------
-- MODEL.md §5.1: the intake screen saves with "no need to classify before it
-- saves — triage classifies." RECLASSIFICATION-RULES.md §3: "anything entered
-- from the door is unsorted by default... if a person cannot choose a type, a
-- person cannot choose wrongly."
--
-- An entry where nobody picked a door has to be stored as something, and an
-- Observation is the honest default: "a result or material that arrived. Not a
-- complaint, not an idea" (MODEL.md §3) is the only one of the three whose
-- required fields the intake form can always fill. But triage must be able to
-- tell "the author said this is an Observation" from "the author did not have
-- to say, so it was filed here" — otherwise the type-pair signal in
-- RECLASSIFICATION-RULES.md §9 reads a default as a choice, and the intake
-- form's own wording can never be judged from the data.
-- HOW THE BACKFILL IS DONE, AND WHY IT IS NOT AN UPDATE.
-- Every Observation that existed BEFORE this migration came from drop-box
-- triage (pd-routes.js, the convert route), where the person who wrote the
-- entry never saw a type at all. Those rows must read 0: leaving them at 1
-- would record a choice nobody made.
--
-- From here on an Observation row is normally one somebody chose, so the
-- standing default is 1.
--
-- Both are true at once, so the column is added with DEFAULT 0 — which is
-- what every existing row is given, by MySQL, in the ADD COLUMN itself — and
-- the default is then moved to 1 for everything written afterwards. There is
-- no UPDATE, so nothing here can be applied a second time to rows it has
-- already touched. Re-running this file gives error 1060 on the first
-- statement (harmless, phpMyAdmin reports it) and a no-op on the second.
--
-- The default is belt-and-braces in any case: all three INSERT sites in
-- pd-routes.js (lines 697, 969, 1867) name door_chosen explicitly, so no PD
-- route relies on it.

ALTER TABLE pd_observations
  ADD COLUMN door_chosen TINYINT(1) NOT NULL DEFAULT 0 AFTER origin;

ALTER TABLE pd_observations
  ALTER COLUMN door_chosen SET DEFAULT 1;

-- ============================================================================
-- End of 003_pd_history_and_notices.sql
-- ============================================================================
