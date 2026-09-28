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

---

## 26 September 2026 — PLATFORM (opened as PD) — the access model explained, and 6 rulings

Opened as PD; Tahir asked first to understand the access model ("who gets
access from where"), before any PD work. **Nothing was edited in code.** This
entry only records what was found and ruled. The build is PLATFORM work and
waits for a `platform` declaration.

### What the code does today (read 26 Sept, server.js / launcher.html / o2s.html / pd-lib.js)

- 3 questions, 3 layers: who the person is (`auth_users`), which app and role
  (`user_module_roles`, written only by `setModuleRole()`), what the role may
  do (inside each app).
- Each app answers the third question differently. O2S: roles are data in its
  own store (`masters.roles`), permissions from the screen access matrix, the
  rights table (`roleRights`), and at least 167 `state.role==='…'` checks in
  code. PD: 13 roles fixed in `pd-lib.js` plus the `pd_role` ENUM, gates fixed
  in code. Platform: 1 role, `admin`, fixed in code. Titles (`USER_TITLE` in
  O2S) are per-person labels, not roles.
- People are managed in 2 places. Launcher Manage access: create (no role),
  grant or remove a role in any app, app admin. It cannot rename, reset a
  password or delete. O2S Users & Access: create (with an O2S role, KAM if
  none), rename, reset password, delete, O2S role only. Its list is every
  `auth_users` row, so PD-only people show there with a blank role.
- Deleting a person in O2S deletes their login and every app's rows. PD
  tables hold foreign keys to `auth_users(id)`, so deleting someone who owns
  PD records should fail with a database error (not tested).
- `auth_users.active` exists and PD checks it, but `/api/login` does not, and
  `getUser()` does not read it. Setting `active=0` today does NOT stop a
  person signing in.
- O2S takes the role from the login token, so a role changed in Manage access
  only reaches O2S after that person signs out and in again.
- Renaming a custom O2S role changes only O2S's store; holders keep the old
  name in `auth_users.role` and `user_module_roles`.

### Tahir's rulings, 26 Sept 2026

1. **People are managed on the launcher only.** Create, rename, reset
   password, deactivate, and every app's role. O2S Users & Access becomes a
   view of O2S people and their O2S role (O2S role can still be changed
   there); it stops creating, renaming and deleting people.
2. **Leavers are deactivated, never deleted.** They cannot sign in and drop
   out of pick lists; their name stays on every record in O2S and PD.
3. **A role renamed in O2S carries through** to everyone who holds it on the
   platform.
4. **Titles move to the platform, per person** — a label, not a role, grants
   nothing (this is the step 6 already ruled on 25 Sept).
5. **The new app already signs in with the platform login.** It joins by the
   2-point contract in `docs/platform/ACCESS-MODEL.md`: publish a role
   catalogue, read `/api/me`.
6. The standing rule is confirmed: the platform holds people and
   person → app → role; each app holds its own role list and what each role
   may do.

### Build plan (not started)

- **Step 1, PLATFORM:** login and `getUser()` honour `active`; launcher gains
  rename, reset password, deactivate/reactivate and title per person;
  deactivated people drop out of the catalogue's holders and of `/api/me`;
  a server route that renames an O2S role for its holders through
  `setModuleRole()`; update `docs/platform/ACCESS-MODEL.md`.
- **Step 2, O2S (its own session):** Users & Access loses create, rename and
  delete, and points to the launcher; `renameRole()` calls the Step 1 route;
  titles read from the platform instead of `USER_TITLE`; Guide and
  `guide.test.js` updated in the same change.
- Open, not yet ruled: whether O2S admins keep password reset (Tahir chose
  "launcher only", so no, unless he says otherwise); whether a role change
  should take effect without signing in again.

Files changed: this entry only. Pushed: no.

**Next:** Tahir declares `platform` to start Step 1. PD's own open items
(Fahim's PD role, PD access per role) are unchanged and follow after.

### Standing condition for this build — Tahir, 26 Sept 2026

"Don't build anything which leaves any of the O2S accounts stopped working."
Every step above must keep every existing O2S account signing in and doing
exactly what it does today. How Step 1 keeps to it:

- Before login checks `active`, a read-only query on local (and on
  production, before that deploy) must show every account with an O2S role
  at `active=1`. If any shows 0, stop and ask; do not ship. (The 11 Sept
  dump `van_platform.sql` shows all 15 accounts at 1, and the column is
  `NOT NULL DEFAULT 1`, but that dump is old.)
- Only an explicit Deactivate on the launcher ever sets `active=0`. It
  refuses the last platform admin, the last O2S COO, and yourself.
- Tokens already issued keep working; nobody is signed out by the release.
- Step 2 (O2S) removes buttons only. It changes no account, no role and no
  right.
- The O2S role rename carry-through moves holders to the new name in the
  same request, and is tested on local with a throwaway role first.
- After Step 1 on local: check every O2S account against the new login gate
  with a script, and Tahir signs in as himself, one O2S user and one PD user.

Also this session: a `git status` run from the Cowork shell left a stale
`.git/index.lock` (the shell may not delete files). It was moved to
`_to_delete/index.lock.stale-2026-09-26` so GitHub Desktop is not blocked.
Do not run git commands that write the index from that shell.

### Later the same session — Nigehbaan's 3 questions, ruled

Nigehbaan (the new app) asked 3 questions before designing. Checked in code:
`user_module_roles` has PRIMARY KEY (username, module), so 1 role per person
per app is enforced by the database; `auth_users` holds no phone or email;
`/api/platform/users` sits behind `accessAdmin` (platform admin or an app
admin only).

Tahir's rulings: 1 role per person per app stays, extra duties are the app's
own data; WhatsApp and email live on the platform per person beside the
title; "who holds role X" is answered to the app's server only, for its own
roles; Nigehbaan joins inside the VAN-OP server as a module. Written into
`docs/platform/ACCESS-MODEL.md`, section "Rulings of 26 September 2026".

Step 1 (PLATFORM) grows by 2 items: contact fields (WhatsApp, email) on the
person, edited on the launcher; and a server-side holders function
`(module, role) -> active holders with name, title, WhatsApp, email`. Both
are additive columns and a new function; neither touches how O2S signs in.

Files changed: `docs/platform/ACCESS-MODEL.md` (section appended), this
entry. Pushed: no.

### 27 September 2026 — Nigehbaan's 4 follow-up questions (answers and what is open)

Nigehbaan asked 4 more (their HANDOFF.md §6f). Checked in code and answered:

- **Table:** Nigehbaan uses `user_module_roles` only (role is VARCHAR(64)
  text). `auth_users.role` and `pd_role` are mirrors for O2S and PD only
  (`LEGACY_COL`). A new Nigehbaan role needs no database change. Joining
  does need platform code: `validModuleRole()` refuses any module but o2s,
  pd and platform; `REAL_MODULES` and `MODULE_LIST` must list it.
- **Publishing today:** `roleCatalogue()` asks each module live; nothing is
  copied. PD: fixed keys in code, names free to change. O2S: admin screen,
  name is the key. A held role that leaves a list stays held, shown
  "Not filed", not flagged.
- **Default access today:** none. A new person holds no role; the launcher
  shows a tile locked unless the person holds a role in that module.
- **Empty roles:** noted. The holders function returns an empty list for a
  vacant role, never an error, and excludes deactivated people.

Tahir, 27 Sept: **Speak up must be open to everyone, even without an
account — like a hotline**, possibly a form separate from the app.
Precedent in the repo: PD's drop box `/pd/drop` is public, no login,
honeypot plus 5 per hour per IP, and it stores the sender's IP.

**Open, Tahir to ask Nigehbaan, then rule:** how roles are published (code
or admin screen), what happens when a held role is removed, whether
Policies is also public or sign-in only, how Speak up protects anonymity,
and whether Committee Chair is a platform role or a Nigehbaan seat (Tahir:
"we have to discuss this"). Question list given to Tahir in chat.

Files changed: this entry. Pushed: no.

---

## 27 September 2026 — PLATFORM — People and access, phase 1 built and through gate 1

**Module:** PLATFORM (declared by Tahir). O2S and PD code not touched. The
VAN Compliance System folder was read only; nothing written there.

**Tahir's rulings today:** build the access panel and backend so they carry
future apps, even an ERP; no haste; test before deploy. A person is separate
from a login; an access log from day 1; company recorded for information,
grants company-wide for now; 3 test gates. Full design:
`docs/platform/PLATFORM-DESIGN.md`. What was built:
`docs/platform/ACCESS-MODEL.md`, section "People and access, phase 1".

**Files changed:** `server.js` (platform parts only: `auth()`, `/api/login`,
`/api/me`, `setModuleRole`/`clearModuleRole`, `/api/platform/*`, boot chain),
`launcher.html` (People and access page), `CLAUDE.md` (PLATFORM row of the
module map). **New:** `platform/migrations/P001_people_and_access_log.sql`,
its `.PRODUCTION.sql` copy, `P001-CHECK.sql`,
`tests/platform/people-access.test.js`, `docs/platform/PLATFORM-DESIGN.md`.
**Pushed:** no.

**Gate 1 (done, in the cloud workspace, on a throwaway MariaDB built from
`van_platform.sql` of 11 Sept plus PD 007 and 008):**
- Every one of the 15 accounts was recorded before the change (sign-in,
  `/api/me`, `/api/state`, PD library, and the platform and O2S admin reads,
  plus every row of `auth_users` and `user_module_roles`) and again after,
  with the new code both **without** P001 and **with** P001. All identical
  apart from the new fields added on purpose.
- P001 ran twice cleanly; the production copy ran with `information_schema`
  selected; both triggers refuse edits and deletes; deleting a login through
  O2S still works and leaves the person with no login.
- `people-access.test.js`: 19 of 19 passed (switch off and on, open session
  stops, restart keeps it, other accounts unaffected, own-login and last-COO
  guards, password reset, details checks, logging with before and after,
  O2S Users & Access still works and is logged, who holds what, grants
  unchanged at the end).
- `holdersOf` and `contactsFor` run against the copy: vacant role returns
  [], a switched-off holder drops out and returns when switched back on.
- The page driven in Chromium as `tahir` and as `saad`: list, search,
  Details, save, switch off and back on, history, who holds what, locked
  tile for a non-admin, no horizontal scroll at phone width, no console
  errors.
- Files in `E:\VAN-OP` are byte-identical (sha256) to the tested ones.

**Not tested:** a live XAMPP or HostGator database (gates 2 and 3); the
last-platform-administrator guard (unreachable in practice, because the
person switching someone off is themselves an administrator and cannot
switch themselves off).

**Gate 2, Tahir's (local XAMPP):**
1. In phpMyAdmin select `van_platform`, run `platform/migrations/P001-CHECK.sql`
   and keep the result. Every `active` must be 1.
2. Paste `P001_people_and_access_log.sql`. The last result must show
   logins = people_with_login, logins_without_person = 0, switched_off = 0.
3. Restart the local server (`npm start`). The boot log should say
   "Platform: 0 switched-off login(s)."
4. Run P001-CHECK again and compare: same roles, every `has_person` = 1.
5. Sign in as yourself, 1 O2S user and 1 PD user. Open People and access,
   add your title, look at Who holds what.

**Gate 3:** production only when Tahir chooses: P001-CHECK (schema-qualified)
first, then `P001_people_and_access_log.PRODUCTION.sql`, then push, then the
check again.

**Next after the gates:** the O2S piece (Users & Access becomes a view;
username rename moves to the platform; `renameRole()` carries holders
through), then Nigehbaan's open rulings (open-to-all flag for Policies,
Chairman and Board accounts, the harassment seal versus the COO's admin
rights, how Nigehbaan reads payroll now that HRMS is separate). PD's own
open items (Fahim's PD role, PD access per role) are unchanged.

### 27 September 2026 (later) — the repo folder renamed to `E:\VAN Systems`

Tahir renamed `E:\VAN-OP` to `E:\VAN Systems`. Checked afterwards: HEAD still
`e4e0100`; every change from the entry above is present, and `server.js` and
`launcher.html` are byte-identical (sha256) to the tested files. `CLAUDE.md`
§3 and §3.1 now name the new folder. GitHub Desktop must be pointed at the new
folder (Locate). The GitHub repository keeps its name, VAN-OP.

**Not from this session:** `VAN Ops Design System.zip` changed at 20:20 UTC
the same evening (233,008 → 229,609 bytes). The only difference is that
`redesign/VAN Ops - Control Tower (Redesign).html` is missing from the zip.
Tahir to decide whether that was meant; if not, discard that change in
GitHub Desktop before committing.

---

## RESUME HERE — PLATFORM — state at 27 Sep 2026, end of session

**Module:** PLATFORM. Next session opens with `platform`.

### What this session did (26–27 Sept 2026)

1. **Explained the access model** as the code has it: 3 layers (person, which
   app and role, what the role may do); O2S roles are data, PD roles are code,
   the platform has 1 role; titles are labels, not roles.
2. **Rulings taken** (all written in `docs/platform/ACCESS-MODEL.md` and
   `PLATFORM-DESIGN.md`): people are managed on the launcher only; leavers are
   switched off, never deleted; an O2S role rename carries through to holders;
   title, WhatsApp and email live on the platform per person; 1 role per
   person per app, extra duties are the app's own data; "who holds role X" is
   answered to an app's server only; Nigehbaan joins inside this server; a
   person is separate from a login; an access log from day 1; company is
   information only for now; 3 test gates before anything is live.
   Standing condition: nothing may leave any O2S account unable to work.
3. **Nigehbaan (VAN Compliance System)** read, never written. Its questions
   answered and its answers checked against the platform (see the Nigehbaan
   entries above).
4. **Built People and access, phase 1** (`server.js` platform parts,
   `launcher.html`, `platform/migrations/P001*`, `tests/platform/`).
5. **Gate 1 passed** on a throwaway copy of the 11 Sept backup: every
   account identical before and after, with and without P001; 19 of 19 tests.
6. **Security register:** S-06 added (the backup `van_platform.sql` with
   password hashes is committed to GitHub).
7. **Folder renamed** by Tahir to `E:\VAN Systems`; checked intact.

### Where things stand

- Git: HEAD `e4e0100`. All of the above uncommitted, not pushed.
- `VAN Ops Design System.zip` shows as changed but not by this session (1
  file missing inside it). Discard unless Tahir meant it.
- Local database: P001 not applied. Production: P001 not applied.
- **Code without P001 behaves exactly as today**, except for 1 thing: sign-in
  now refuses any login whose `auth_users.active` is 0. O2S ignored that
  column until now (only PD read it). So before this code goes live, the
  target database must have no O2S login at `active = 0`.

### Tahir's asks, in order

1. **Before pushing:** run this read-only query on production (HostGator
   phpMyAdmin, SQL tab) and expect **0 rows**:
   `SELECT username, name, role, active FROM jodilkah_vanop_db.auth_users WHERE active = 0;`
   If it returns anyone, stop and bring the names here; do not push.
2. **Push** (GitHub Desktop, repo at `E:\VAN Systems`): commit everything
   listed as changed except the zip (discard it unless intended).
3. **After the deploy:** the Render log should say
   "Platform: 0 switched-off login(s)." Sign in as yourself and 1 O2S user.
   People and access opens with the note that the migration is waiting.
4. **Real-data test (gate 1 again):** export production and local
   (phpMyAdmin → Export → Quick → SQL) into `E:\VAN DB Exports` (outside
   the repo) and connect that folder here.
5. **Gate 2 (local):** P001-CHECK, then P001, restart, P001-CHECK again,
   3 sign-ins. **Gate 3 (production):** the same, with the `.PRODUCTION.sql`
   copy, when Tahir chooses.

### Next, after the gates

The O2S piece (Users & Access becomes a view; username rename moves to the
platform; `renameRole()` carries holders), in its own O2S session. Then
Nigehbaan's open rulings: the open-to-every-active-person flag for Policies,
Chairman and Board accounts, the harassment seal versus the COO's admin
rights, how Nigehbaan gets payroll now that HRMS is separate. PD's own open
items (Fahim's PD role, PD access per role) are unchanged.

**28 Sept 2026 — pre-push check done.** Tahir ran the read-only query on
production (`SELECT … FROM jodilkah_vanop_db.auth_users WHERE active = 0`):
**0 rows.** No O2S login is switched off, so the new sign-in check affects
nobody on deploy. Cleared to push; P001 stays for later.

---

## 28 September 2026 — PLATFORM: where it stands (written for a new coder)

This entry supersedes the two "RESUME HERE" blocks above (25 Sept access
management, 27 Sept platform) as the place to start. Nothing above is
deleted; the detail and the reasons stay there.

### The platform in 1 paragraph

1 Node/Express server (`server.js`) serves the launcher (`/`), O2S (`/o2s`)
and PD (`/pd`) with 1 sign-in (token in `localStorage` as `van_token`). The
platform owns **people, logins, and who holds which role in each app**; each
app owns **its role list and what each role may do**. Rules and tables:
`docs/platform/ACCESS-MODEL.md`. The long-term design (built to grow into an
ERP): `docs/platform/PLATFORM-DESIGN.md`.

| Layer | Table | Written by |
|---|---|---|
| Person | `platform_people` (P001) | People and access |
| Login | `auth_users` (unchanged; `active = 0` means switched off) | People and access; O2S Users & Access until the O2S piece |
| Role per app | `user_module_roles` (1 row per person per app) + mirror columns `auth_users.role` (O2S) and `pd_role` (PD) | only `setModuleRole()` / `clearModuleRole()` |
| History | `platform_access_log` (P001, append-only by trigger) | only `logAccess()` |

### Rulings in force (26–27 Sept, Tahir)

People are managed on the launcher only. Leavers are switched off, never
deleted. A role renamed in O2S carries through to its holders. Title,
WhatsApp and email live on the platform per person (a title grants nothing).
1 role per person per app; extra duties are the app's own data. "Who holds
role X" is answered to an app's server only (`platformServices.holdersOf`,
`contactsFor`). A person is separate from a login. An access log from day 1.
Company is recorded for information only. 3 test gates before anything is
live. **Standing condition: nothing built may leave any O2S account unable to
work.**

### What is live, and what is not

- **Pushed 28 Sept** (`b807e01`, then `9bb3877`): People and access, phase 1.
  Render deploys on push. **Not yet confirmed here:** the Render log line
  "Platform: 0 switched-off login(s)." and a sign-in by Tahir after deploy.
- Before pushing, production was checked: 0 logins at `active = 0`, so the
  new sign-in check affects nobody.
- **P001 is applied to neither database.** Until it is, the server works
  exactly as before and People and access shows "the migration is waiting";
  details, contacts and history appear after P001. Role changes and "Who
  holds what" already work.
- Gate 1 passed on a throwaway copy of the **11 Sept** backup (every account
  identical before and after; 19 of 19 tests). **Gate 1 on the real data is
  still to run** (Tahir, 27 Sept: the real copy is production, with more
  accounts and platform-only roles such as the Agronomy roles).

### Next, in order

1. Tahir confirms the deploy (Render log line; sign in as himself and 1 O2S
   user; open People and access).
2. Tahir exports production and local (phpMyAdmin → Export → Quick → SQL)
   into `E:\VAN DB Exports`, outside the repo, and connects the folder. Claude
   re-runs gate 1 on both in a throwaway database, then deletes the copies.
3. Gate 2, local: `platform/migrations/P001-CHECK.sql`, then
   `P001_people_and_access_log.sql`, restart, P001-CHECK again, 3 sign-ins.
4. Gate 3, production, when Tahir chooses: the same with the
   `.PRODUCTION.sql` copy.
5. **The O2S piece**, in an O2S session: Users & Access becomes a view (no
   create, rename or delete of people); username rename moves to the
   platform; `renameRole()` in O2S calls a platform route so holders follow;
   the Guide updated in the same change.
6. **Nigehbaan joining** (compliance app, `E:\VAN Compliance System`, read
   only from this repo). Its answers are in its own
   `PLATFORM-ANSWERS-2026-09-27.md`. Still to rule: an "open to every active
   person" flag so everyone can read Policies; whether the Chairman and Board
   get accounts; the harassment committee's seal versus the COO being
   administrator of every app; how Nigehbaan gets payroll now that HRMS is a
   separate app with its own login. Then: Nigehbaan in `MODULE_LIST`,
   `validModuleRole()` and `REAL_MODULES`; `platformServices` handed to its
   routes.

### The 25 Sept open items, now

- Fahim's PD role: **open** (PD; see `OP-HANDOFF-PD.md`, 28 Sept).
- "System Administrator": **ruled 26 Sept** — a title per person on the
  platform, not a role. Stored in `platform_people.title` once P001 is in.
- PD access per role: **open** (PD).
- Accounts for Muhammad Ali (`mali`) and Muhammad Irfan (`irfan`): not
  confirmed as created. Create them on People and access.

### Things a new coder will trip on

- `/api/users` (O2S's Users & Access) still creates, renames and deletes
  logins; it writes roles through `setModuleRole()`, so the log records them
  as `via = o2s-users`. It closes in the O2S piece.
- Renaming a **username** is not on People and access on purpose: O2S's
  records point at usernames.
- Production SQL must name the database on every table
  (`jodilkah_vanop_db.<table>`): HostGator's SQL tab stays on
  `information_schema`.
- Never run `git status` or other index-writing git commands from the Cowork
  shell: it cannot delete the lock file it leaves. Use
  `git --no-optional-locks status`.
- `tests/platform/people-access.test.js` resets passwords; it refuses any
  database not marked as a throwaway copy.

Files changed in this entry's session: `CLAUDE.md` (§1 module map
corrected, "New to this repo" line, §3.0 current state), `README.md`
(rewritten for the platform), `OP-HANDOFF.md` (a "Start here" table),
`OP-HANDOFF-PD.md` (28 Sept entry), this entry. Pushed: no.
