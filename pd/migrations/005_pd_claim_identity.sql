-- ============================================================================
-- 005_pd_claim_identity.sql — make a Claim's number mean one thing
--
-- WRITTEN 9 Sept 2026, from a review finding, confirmed live: two people
-- writing a claim at the same instant were BOTH told their claim was C-003,
-- and the database held two rows with that number. Four collisions in twelve
-- concurrent pairs.
--
-- WHY IT HAPPENED. Every other object in 002 carries a UNIQUE key on its
-- permanent number (uq_q_number, uq_bet_number, uq_run_number, ...), and the
-- numbering helper in pd-lib.js is safe ONLY because of them: it reads
-- MAX(number)+1, tries the insert, and retries when MySQL answers "duplicate
-- key" (errno 1062). pd_claims was given a plain, non-unique KEY instead —
-- deliberately, because a claim keeps ONE number across every version of
-- itself (MODEL.md §6, "versioned; never overwrite in place"), so the number
-- alone cannot be unique. But with nothing unique at all, the duplicate-key
-- error never fires, the retry never happens, and the read-then-write race is
-- wide open.
--
-- THE FIX. Unique on the PAIR. (claim_number, version) is exactly the
-- identity the model describes: one number for the life of a claim, one row
-- per version of it. A second writer racing for the same number now collides
-- on version 1 and retries, and two people revising the same claim at once
-- collide on version 2 — which is the second half of the same bug, since
-- revise had forked a claim into three competing "version 2" rows, all
-- flagged current.
--
-- MODEL.md §4 calls the permanent number the memory moat: "killed and parked
-- things keep their number and reason forever." A number that answers to two
-- different claims is not a moat.
--
-- RUN BY HAND, BY TAHIR, ONLY. Run it after 003 and 004. It will refuse to
-- apply if duplicates already exist — see the check below, which is there so
-- the failure is a sentence rather than a bare MySQL error.
-- ============================================================================

SET NAMES utf8mb4;

-- Refuses loudly rather than half-applying, on the same pattern 002 used for
-- its own pre-flight check. On a database with no duplicate claim numbers
-- (any database this has not already bitten) it does nothing at all.
SELECT COUNT(*) INTO @dupes FROM (
  SELECT claim_number, version FROM pd_claims GROUP BY claim_number, version HAVING COUNT(*) > 1
) d;

SET @msg = IF(@dupes > 0,
  'STOP: pd_claims already holds more than one row with the same claim_number and version. Resolve those by hand before applying this index — renumbering a claim is a decision, not a migration.',
  'ok');
SELECT @msg AS preflight;

-- If the line above says STOP, do not run the rest of this file.

ALTER TABLE pd_claims ADD UNIQUE KEY uq_claim_number_version (claim_number, version);

-- ============================================================================
-- End of 005_pd_claim_identity.sql
-- ============================================================================
