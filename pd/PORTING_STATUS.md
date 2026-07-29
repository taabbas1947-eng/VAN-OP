# PD-in-O2S porting status

_Last updated: 2026-07-29. Written after the first working slice was built and tested against a local MariaDB instance (login → idea intake → G1 screen → gate log, all role-gated), then re-verified by driving a real headless browser through the same flow._

**Browser run found one real bug, now fixed**: signing out raced with the hash-change router — `location.hash=''` fires its event handler *after* the synchronous sign-out code runs, so the old session's home page could briefly repaint over the login form. Fixed in `pd.html` (`route()` now bails out if `me` is null, and sign-out clears `me` before touching the hash). Worth remembering: the curl-only testing earlier did not catch this — it's a client-side timing bug, invisible to API tests. Browser-level checks should stay part of testing each new piece, not just API calls.

## Why this file exists

The original `E:\VAN-R&D` PHP app (`van-rd-app` v2.2, 182 passing assertions) was built by accident in the wrong working directory. The actual goal is for Product Development (PD) to live *inside* O2S — one codebase, one login, one deploy — not as a second system to keep in sync. This port treats the PHP app as a **tested functional spec**, not code to keep running. It has no real user data in it (only seed/test accounts), so there is nothing to migrate — just logic to carry over faithfully.

You chose "full port in one go" (don't put PD in front of users until it's complete) over shipping a slice at a time. This file exists so that promise is checkable rather than taken on faith: it is the honest, current gap between "what the PHP app does" and "what's built in O2S so far," updated as each piece lands.

## Folder structure

Everything PD-specific lives under this `pd/` folder, kept apart from the O2S files in the repo root — the whole reason this port exists is that the two got mixed up once already (the standalone PHP app built in the wrong directory). The only PD-aware code outside this folder is a few lines in the shared `server.js` (it has to be — one Express server serves both apps) and the PD card in `launcher.html`; everything else PD owns lives here:

```
VAN-OP/
  server.js          <- shared O2S + PD server (routes, auth, both apps' APIs)
  index.html          <- O2S frontend (untouched by this port)
  launcher.html        <- shared front door (O2S card + PD card)
  package.json, render.yaml, etc.  <- O2S/deploy infra (untouched)
  pd/                 <- everything Product Development
    pd.html            <- PD frontend
    pd-lib.js           <- PD business rules (lanes, gates, roles) ported from the PHP app
    PORTING_STATUS.md    <- this file
    migrations/
      001_pd_foundation.sql  <- PD's database schema (additive, same DB as O2S)
```

## What's built and verified (this session)

- **Shared foundation**: `migrations/001_pd_foundation.sql` adds PD's tables to the *same* MySQL database O2S already uses (not the `app_state` JSON blob), plus a `pd_role` column on `auth_users` — no second user table, no second login. Verified: 29 statements apply cleanly on a fresh database and are safe to re-run.
- **Routing**: `/pd` now serves a real PD app (`pd.html`), fixed to route *before* O2S's catch-all — previously any path that wasn't `/` or `/launcher` silently served the O2S app, which would have swallowed `/pd` silently once the launcher card pointed at it.
- **Auth**: PD uses the exact same login (`POST /api/login`) and the exact same `van_token` in `localStorage` that O2S's `index.html` already uses. Signing into one signs you into both — this is the "one login" goal, achieved by construction rather than bridged.
- **Idea intake** (`POST /api/pd/ideas`): H-number allocation, lane set automatically from the kind of idea (submitter never sees or picks a lane) — ported from `lane_for()`/`HEAVY_TYPES` in `inc/db.php`.
- **G1 screening** (`POST /api/pd/ideas/:id/screen`): role- and lane-gated (`may_screen`), deputy screens correctly flagged `provisional` (`screens_as_deputy`), a written reason is required, a second screen on the same idea is rejected (409). **Correction made during testing**: the screening vocabulary is `log/park/kill/merge` (matching `hypothesis.php`'s actual form and `schema.sql`'s ENUM), not the `advance/park/kill/reclassify` labels in `db.php`'s `GATE_OUTCOMES.G1` constant — the original PHP app has that inconsistency between a constant and the live form; this port follows the form, since that's what's actually enforced. Documented in `pd-lib.js`.
- **Gate log** (`GET /api/pd/gatelog`) and **My Work** (`GET /api/pd/mywork`) — read-only views, role-gated the same way `inc/auth.php`'s `allowed_pages()` gated the PHP router.
- **Role assignment** (`PUT /api/pd/users/:username/role`, COO/admin only) — the bridge between an existing O2S account and PD access. Nobody has a `pd_role` until explicitly given one.

All of the above was tested against a real MariaDB instance in this session: idea submission, heavy-lane screening by a COO, light-lane deputy screening by a Plant Manager (correctly provisional), a blocked double-screen, a 403 for an account with no PD role, and the `/pd` vs `/launcher` vs `/o2s` routing.

## Not yet ported (the rest of the "full port")

Ordered roughly the way the PHP app itself depends on these pieces:

1. **Records & G2** (`record.php`, `dev_records` table) — the Development Record with its five sections, the RTA technical review + completeness check pre-checks, delegated G2 sign-off and COO ratification.
2. **G3 beaker gate, samples, lab tests** (`samples.php`, `tests.php`) — including the rule that a sample cannot be logged before a G3 ADVANCE exists (this was the specific discipline the NP 5-40 trial lacked, per the PHP app's own notes).
3. **Pre-bench candidate screen** (`candidates.php`, `materials.php`) — the mass-balance arithmetic, the cost-per-kg-P₂O₅ ranking, the "PROVISIONAL — a shape, not a costing" stamp, and the material-compatibility FAIL/advisory logic.
4. **G4–G6** and **field trials** (`trials.php`).
5. **Projects / Briefs** (`projects.php`, `project.php`) — the layer above a route.
6. **The Library** (`library.php`, `libitem.php`, `file.php`) — including its file-security model (stored outside the web folder, randomised filenames, content-sniffed uploads) — this needs real design thought before porting, not a quick translation.
7. **Problems register, drop box, similar-idea duplicate check** (`problems.php`, `problem_new.php`, `dropbox.php`, `similar.php`).
8. **Users admin, audit log, regulatory, learnings, formulations** (`users.php`, `audit.php`, `regulatory.php`, `learnings.php`, `formulations.php`).
9. **Email notifications** (`inc/notify.php`) — the PHP app already ships with these off by default (`MAIL_FROM=''`); O2S has no notification system at all today, so this is a net-new decision, not a straight port.
10. **The COO's 7-day light-lane reversal window** — noted in `hypothesis.php` (`action=reverse`) but not yet built into `/api/pd`.

## What to check before this goes anywhere near real users

- Run the equivalent of the PHP app's 182 assertions against the new endpoints — none of that test suite carries over automatically.
- Decide what happens to `E:\VAN-R&D` once parity is reached (freeze it now, retire it later — see the earlier consolidation-plan doc for the reasoning).
- `pd.html` is currently a light hand-built shell, not using O2S's existing UI component patterns from `index.html` — worth a design pass once more of PD is real, so PD and O2S don't feel like two different apps wearing one login.
