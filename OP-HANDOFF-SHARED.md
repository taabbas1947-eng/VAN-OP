# Shared / cross-module — OP Handoff

*Entries that touched more than one module, or the platform. Split out of
`OP-HANDOFF.md` on 23 September 2026. Original order, unedited.*

*An entry only belongs here when it genuinely spans modules. The repo rule is
still: never edit two modules in one change.*

> ## The rule for this file
>
> **One file per module.** Cross-module work is recorded here. O2S goes in
> `OP-HANDOFF-O2S.md`, PD in `OP-HANDOFF-PD.md`. Anything genuinely spanning both goes in
> `OP-HANDOFF-SHARED.md`, and should be rare — the module rule already says
> never edit two modules in one change.
>
> **Never rewrite this file from a copy you have been holding.** On
> 23 September 2026 the same entry was lost three times that way: a session
> read the file, worked for a while, then wrote back a whole-file rebuild from
> its stale copy, silently deleting everything another session had appended in
> between.
>
> Before every write:
> 1. **Re-read this file from disk immediately before writing.** Not a copy
>    read earlier in the session.
> 2. **Append only.** New entries go at the end. Never regenerate the file.
> 3. **Assert that your new text begins with the exact bytes you just read.**
>    If it does not, stop and re-read.
> 4. **Read it back after writing** and confirm both the previous last heading
>    and your new heading are present.
>
> A correction to an old entry is a single exact string replacement on freshly
> read content, with the target asserted to occur exactly once. **Never delete
> an entry** — corrections are appended and cross-referenced.

---

## 2026-08-17 · PD + PLATFORM · pre-launch fixes applied

**Module:** PD, and PLATFORM (the patches cross the boundary — `server.js` sign-in and
error handling, `launcher.html` escaping and role labels, `render.yaml`). Flagged and
authorised before applying.

**Branch:** `prelaunch-fixes`, cut from `df3ce60`. **NOT committed, NOT pushed.**
Review the diff in GitHub Desktop and commit there.

**Applied, in this order:**
1. `pd/reviews/VAN_PD_fixpack.patch` — 13 pre-launch faults (A1, A2, B1, B2, B5, C1, C2,
   C3, C5, C8, D10, D12, E9)
2. `pd/reviews/VAN_PD_02_intake.patch` — idea form to 3 fields, draft saving, calmer
   duplicate check, drop box linked from Home (D1–D5)
3. `pd/reviews/VAN_PD_03_queues.patch` — G3–G6 into My Work, Agronomy trial lifecycle,
   Production feasibility queue, next step on the Board (D6, D7, D9)

**Also changed:** `render.yaml` — `plan: free` → `plan: starter`, added the `disk` block
and `PD_LIBRARY_DIR`. Backup at `render.yaml.bak`. `.gitignore` — added `~$*`.
Untracked the stray Word lock file.

**Verified:** all 21 fix markers present; gate-order, blank-record and login-throttle
guards confirmed by their user-facing text; `server.js`, `pd-routes.js`, `pd-lib.js` and
both inline scripts parse. The four patched files are byte-for-byte identical (sha256)
to the build that was booted against MariaDB and driven through a browser as each role.

**Still to do before anyone signs in:**
- Change every seeded password. Confirm `van@2026` is not live, especially on `admin`.
- Confirm the Render instance really is Starter, and that a disk is attached at `/var/data`.
- Confirm `SESSION_SECRET` is set to a fixed value.

**Next:** notification layer (one G1-decision email to the submitter, plus a daily My Work
digest — no other events). Blocked on the mail transport decision. Then the DAP-parity
calculation, blocked on VAN margin + freight + dealer margin. NP 5-40 seeding deferred.

**Note:** commit `df3ce60 "FIXES ON PD"` added review documents only — no code changed in it.

---

## 2026-09-11 — PD 002 migration to PRODUCTION (done) + local verify · O2S docs

**Re-recording this session's ops history — it was lost when the working-tree
OP-HANDOFF was reset during the merge, and is not in HEAD.**

**`002_pd_core_rebuild` applied to PRODUCTION** (`jodilkah_vanop_db`), by hand in
HostGator phpMyAdmin, 2026-09-09 — after `ca934d4` confirmed live on Render (the
migration-retired server.js, so no boot-loop recreate risk). Pre-flight guard
first ABORTED on 2 stray pilot rows (killed test hypothesis "DAP replacement" +
its G1 kill decision) — data-safety mechanism confirmed, tested on local first.
Cleared the 2 rows, re-imported: **96 queries**. Verified read-only: **15/15 new
core tables present, 17/17 old dropped**, `pd_materials`/`library`/`dropbox`
kept. **O2S intact** — app_state rev 6737, **54 orders, 86 batches**, 15 users.
Every prod write done by Tahir in phpMyAdmin; Claude read-only only.

**Local `van_platform` migrated to `002`** the same way, 2026-09-11, then
boot-tested locally (port 3001): clean boot, `/` `/o2s` `/pd` all 200,
`/api/me` = `o2s:COO`+`pd:coo`, PD routes (`/api/pd/library`, `/api/pd/dropbox`)
200 on the new schema, `/api/state` 54 orders. **All green.**

**O2S docs added this session** (docs only, no app code): `docs/ACCESS-ROLES.md`,
`docs/ACCESS-ROLES-O2S.md`, `docs/o2s-access-matrix.html`,
`docs/o2s-order-flow.html`.

**Migrations 003, 004, 005 applied to PRODUCTION 2026-09-11** (by Tahir, phpMyAdmin
Import, in order), after read-only review confirmed all three are non-destructive
(no DROP/DELETE/TRUNCATE; only touch `pd_*` tables + read-only FKs to `auth_users`;
O2S untouched). Reviewed each first:
- `003_pd_history_and_notices` — creates `pd_field_history` (append-only + 2
  triggers) and `pd_notices`; adds `pd_observations.door_chosen`.
- `004_material_grade_load` — widens `pd_materials` (assay cols nullable,
  +`physical_form`/`grade_source`); soft-deactivates the 10 old placeholder seed
  rows (kept, `active=0`); `INSERT IGNORE` the ~58 real grades from Tahir's
  returned worksheet.
- `005_pd_claim_identity` — adds UNIQUE `(claim_number, version)` on `pd_claims`
  (fixes the duplicate claim-number race).

**Verified applied by fingerprint** (no schema_migrations ledger — checked
information_schema): has_003_history/notices/door_chosen = 1/1/1, has_004
column+data = 1/1, has_005 index = 2. `pd_materials` = **68 total / 58 active**
(10 placeholders deactivated + 58 new grades). Prod schema now matches the
`f11162f` "PD Live" code. Every prod write done by Tahir; Claude read-only only.

**Migration 006 (`006_pd_roles`) also applied to PRODUCTION 2026-09-11** — appended
`field_agronomy` + `associate_agronomy` to the `auth_users.pd_role` ENUM. This is
the one migration that touches the shared `auth_users` table — PD-scoped
(`pd_role` column only), O2S untouched, no rows changed. Pre-checked the ENUM held
exactly the expected 11 values before applying; confirmed both new values present
after. Applied as a schema-qualified `ALTER jodilkah_vanop_db.auth_users …` because
phpMyAdmin's SQL context was stuck on `information_schema` (the file's unqualified
`auth_users` / `DATABASE()` fails unless the app DB is the selected one).

**ROLE ASSIGNMENT DEFERRED — Tahir onboards via the front end.** The PD pilot
people are not in `auth_users` yet (no `nadeem` / `erum` / `maleeha` / `himmayat`
accounts; `abdul.majid` may be Majid but has `pd_role = NULL`). `006` added the
role *options* only — you can't assign a role to an account that doesn't exist.
As each person is onboarded in Manage Access, assign: Himmayat → `rta` (R&D
Manager), Majid → `production`, Maleeha → `agronomy` (Lead), Nadeem →
`field_agronomy`, Erum → `associate_agronomy`. No rush — the roles sit available
until then; nothing is broken.

**Local `van_platform` migrated 003 → 004 → 005 → 006 on 2026-09-11** — now level
with prod. Both databases are on the full 002→006 set. Nothing outstanding on the
schema.

---


## 25 September 2026 — PLATFORM — the access model: one writer for roles, the catalogue, the platform administrator

Tahir's rulings the same day, taken on the "VAN Systems Access Model" page
(claude.ai). Built on local, pushed by Tahir in commits 364cb02 and b92d5bc.
Full write-up: `docs/platform/ACCESS-MODEL.md`.

### The rule

The platform owns identity and who holds which role. Each module owns what
its roles are and what they may do. Rulings: the platform is the only writer
of roles, on 3 conditions (no glitch or access issue in O2S, nothing changes
for an O2S user, no update goes to O2S); the platform administrator is a
grant of its own, seeded from the COO; a person's HR title moves to the
platform later (step 6, not needed for PD); no shared function logins exist
(dummy accounts only); a role belongs to its module, so a PD-only role such
as agronomy is neither removed nor flagged on the platform. Claude only
identifies roles that look like the same role under 2 names.

### Built

- `server.js`: `setModuleRole()` / `clearModuleRole()` are the only code that
  writes `user_module_roles` and the mirror columns. `/api/platform/access`
  and the `/api/users` routes O2S's Users & Access already calls both use
  them; a rename carries the person's rows with them (and `renameUser` is now
  an UPDATE, so `auth_users.id`, which PD's owner_id points at, no longer
  changes); a delete removes the rows. `GET /api/platform/catalogue` returns
  every module's roles in its own words (O2S from its store with departments;
  PD from pd-lib; QMS and ComPha not live; Platform). The platform
  administrator is `user_module_roles (module 'platform', role 'admin')`,
  seeded at boot from the O2S COO rows; the `admin` gate and Manage access
  read it, and the COO role still works during the changeover.
- `launcher.html`: Manage access draws 1 column per module from the
  catalogue, grouped by each module's departments; QMS and ComPha show "not
  live"; a Platform column for the administrator.
- `pd/pd-lib.js`: `PD_ROLE_INFO` (department and lead per role). Keys and
  gates unchanged; lead flags checked against `LEAD_ROLES`.
- `docs/platform/RECONCILE-2026-09-25.sql`: read-only report of where the 2
  stores disagree, plus the 2 corrections ruled (ismaeel is Finance Desk
  Officer; the `ali` and `majid` rows had no account behind them). Applied
  on local by Tahir. Verified live on local: catalogue, grouped dropdowns,
  platform-admin rows for tahir and ahmer, and the O2S write path landing in
  both stores.
- `o2s.html`: not touched. 0 lines.

### Findings on the way

- O2S's store has both "Finance Desk Officer" (id `finance`) and "Finance"
  (id `finance-2`): a rename history. Tahir: both are real roles under
  Finance (Invoicing Officer, Procurement Accountant). Nothing to change.
- HostGator's phpMyAdmin SQL tab stays on `information_schema` and `USE`
  does not move it (seen 11 Sept and again today). Every production
  statement must write `jodilkah_vanop_db.<table>`.
  `pd/migrations/STATE-CHECK-PRODUCTION.sql` is the schema-qualified copy of
  the check; regenerate it from STATE-CHECK.sql, do not edit by hand.

### Production, checked today

STATE-CHECK on `jodilkah_vanop_db`: 003 to 006 APPLIED, 007 and 008 NOT
APPLIED. The pushed code reads both, so PD in production fails on any Run,
the dossier and the Report until 007 and 008 go in. Nobody uses PD there
yet. Schema-qualified versions of both were given to Tahir to paste when he
chooses. The access model needs no migration on production; the platform
rows seed at boot. After the deploy, run RECONCILE PART 1 there.

### Next

Tahir creates `mali` (Muhammad Ali) and `irfan` (Muhammad Irfan) in Manage
access (a password is typed, so his); then O2S KAM for both, PD Team member
for Muhammad Ali, Irfan's PD role still to be ruled. Then the PD roster. For
QMS and ComPha: publish a catalogue and read `/api/me`; nothing else.

## RESUME HERE — access management and roles, state at 25 Sep 2026, end of session

**Git:** commits 364cb02 (access model) and b92d5bc (STATE-CHECK-PRODUCTION)
are on origin/main. The 2 handoff files above are the only uncommitted change.
**Local:** server restarted, RECONCILE PART 2 applied, Manage access verified
live. **Production:** 003 to 006 applied, 007 and 008 not yet; the access
model needs no production migration.

**Tahir's 3 open confusions, to work through next, in this order. Nothing is
to be built until each is ruled; each is a ruling, not a bug.**

1. **"I cannot see Fahim's role in PD."** Fahim is Plant Manager in O2S and
   holds no PD role, so PD shows nothing for him. PD has no role called Plant
   Manager. PD's `production` role is labelled "Production Manager", is a
   lead, and the 11 Sept plan put Abdul Majid on it. Question for Tahir: does
   Fahim get PD at all; if yes, as `production` beside Majid (2 people may
   hold the same role), or does PD get a role of its own for the Plant
   Manager? PD_ROLE_INFO and the pd_role ENUM (migration) would both change
   for a new role.

2. **"I cannot see a System Administrator role; Ahmer is still COO."** There
   is no such role anywhere. In O2S, "System Administrator" is Ahmer's
   per-person TITLE (`USER_TITLE`), his role is COO (Tahir, 24 Sept: keeps
   COO rights, shown with that title). On the platform he now holds the
   `platform` / `admin` grant, shown as "Platform administrator". The
   platform catalogue has exactly 1 role today. Tahir wants to talk about
   adding platform-level roles: what they are, what each may do on the
   launcher and in Manage access, and whether "System Administrator" should
   be a platform role, an O2S role, or stay a title. Note that any O2S change
   is the O2S session's.

3. **PD's access level per role, before go-live and handover.** As coded
   today, from pd-lib.js and pd-routes.js:
   - No PD role: no PD at all.
   - Every PD role: read the library; write through the door; open a
     Question, Approach or Run; record readings and Claims; own what they
     opened and close their own; search; dossier; My desk; the Report.
   - Triage (file and move entries, undo a reclassification, close a
     Problem, replies): custodian, registrar, coo.
   - Lead (name someone else the owner, settle a Question, close another's
     Approach, Run or Claim, edit another's, write or retire a Constraint):
     qc_head, rta, production, agronomy, field_agronomy, associate_agronomy,
     custodian, coo.
   - Pin library reading to a Problem: qc_head, rta, production, agronomy,
     custodian, lab_tech, coo. Archive or restore a library item: custodian,
     coo.
   - Combination Bank moderation (10 Sept ruling): custodian, registrar, coo.
   - member, ceo, consultant, registrar, lab_tech otherwise: the "every PD
     role" line only.
   Tahir wants to go through this per role and rule before handover. Put it
   in front of him as a table, role by role, and take the rulings.

**Also pending:** create `mali` and `irfan` in Manage access (Tahir types
the password); O2S KAM for both; PD Team member for Muhammad Ali; Irfan's PD
role to be ruled. Then the PD roster. Then 007 and 008 on production, then
RECONCILE PART 1 there, both schema-qualified.
