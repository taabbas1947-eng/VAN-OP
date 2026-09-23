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

