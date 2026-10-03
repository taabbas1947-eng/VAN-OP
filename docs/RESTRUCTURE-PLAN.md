# VAN Systems platform · restructure plan (the platform and its apps)

Draft for Tahir's review, 30 September 2026. Rewritten 2 October 2026 after
phase 1 was built: §8 now describes the layout as it is on disk, and the word
"Core" is gone. **The platform** is the one name for the base.

Tahir's brief: one foundation that controls every app (O2S, PD, QMS, CRMS,
Nigehbaan and any app built later), a strong backbone for any number of apps.

**Tahir's ruling, 1 October 2026: the VAN-OP repo is the platform.** The
platform is not an app beside O2S and PD. It is the base every app runs on:
sign-in, the launcher, people and access, roles, the server and the deploy.
Everything at the repo root belongs to the platform; every app lives in its own
folder under `apps/`.

This plan extends `PLATFORM-DESIGN.md` (people and access) and does not replace
it. That document's §2 "the contract" still holds; this one turns it into a
folder layout, a file format and a loader.

Out of scope: **HRMS** and the **VAN website**. Both are hosted separately and
stay separate.

---

## 1. Decisions taken (conversation of 28 to 30 September 2026)

| # | Decision | Why |
|---|---|---|
| D1 | **One paid Render service** runs the platform and every app. No separate deploy per app for now. | Separate services cost about $7 per app per month and add a gateway. The interruption they were meant to prevent has a cheaper cure (D2). |
| D2 | **Make deploys zero-downtime** instead of splitting: take the persistent disk off the service and add a health check. | Render cannot run old and new copies side by side while a disk is attached, so every deploy today has a gap in which the app is down (see §5). |
| D3 | **Deploy at a quiet hour until D2 is done.** Render deploys on every push, so pushing late at night means deploying late at night. | Stopgap only. First check whether anyone uses O2S at night (dispatch, gate). |
| D4 | **Keep hosting on Render.** Railway, a VPS with Coolify/Dokploy, Render Private Services and free-tier apps were all looked at (§7). None is needed while D1 holds. | Least change; no server for anyone to own. |
| D5 | **Build every app to one contract (§3)**, so an app can later move to its own service with no rewrite. | Keeps the split option open at no cost. |

---

## 2. The shape

```
            van-control-tower.onrender.com   (one address, one Render service)
                              │
               ┌──────────────▼───────────────┐
               │ THE PLATFORM (repo root)     │ sign-in, van_token, /api/me,
               │  loader reads apps/*/app.json│ launcher, People & access,
               └──┬─────────┬─────────┬───────┘ role catalogue, access log
                  │ /o2s    │ /pd     │ /qms …
             ┌────▼───┐ ┌───▼────┐ ┌──▼─────┐
             │ apps/  │ │ apps/  │ │ apps/  │   each app: own folder, own routes,
             │ o2s    │ │ pd     │ │ qms    │   own tables, own migrations, own tests
             └────┬───┘ └───┬────┘ └──┬─────┘
                  └─────────┴─────────┴──────►  one MySQL database
```

**The platform controls, apps plug in.** The platform owns the only login,
knows which apps exist by reading their `app.json` (phase 2), builds the
launcher cards and the access matrix from them, and mounts each app under its
own address prefix. Adding an app means adding a folder under `apps/`. No
platform code changes.

---

## 3. The app contract

### 3.1 Folder

Every app has the same shape. Today O2S and PD already have their own folder,
`docs/`, `tests/` and handoff log; `app.json`, the `server.js` entry and `ui/`
arrive in phase 2.

```
apps/<key>/
  app.json               who the app is (§3.2)                    phase 2
  server.js              what the app does on the server (§3.3)   phase 2
  ui/                    the app's pages                          phase 2 (today the page sits in the app folder)
  migrations/            the app's own database changes
  tests/                 the app's own tests
  docs/                  the app's design documents
  OP-HANDOFF-<KEY>.md    the app's session log, append-only (CLAUDE.md §4 rules)
  README.md              what the app is and who owns it
```

### 3.2 `app.json`

```json
{
  "key": "pd",
  "name": "Product Development",
  "live": true,
  "mount": "/pd",
  "api": "/api/pd",
  "tables": "pd_",
  "access": "role-holders",
  "launcher": { "order": 20, "icon": "flask", "blurb": "Ideas to proven products" }
}
```

| Field | Meaning |
|---|---|
| `key` | Never changes, never reused. The same key as in `user_module_roles.module`. |
| `live` | `false` shows a "Coming soon" card and mounts nothing. |
| `mount` / `api` | The only addresses the app may answer on. |
| `tables` | The table prefix the app owns. It may create and change only these. |
| `access` | `role-holders` (only people holding a role in this app) or `all-active` (every switched-on account). |
| `launcher` | Card order, icon and one-line description. |

### 3.3 `server.js`: what an app exports

```js
module.exports = {
  roles:    async (sdk) => [ { key, name, department, archived } ],  // its role list, in its own words
  migrate:  async (sdk) => {},                                        // optional: boot-time schema check
  register: (router, sdk) => { router.get('/things', sdk.auth, ...) } // its routes, mounted under `api`
};
```

### 3.4 `sdk`: the only thing an app receives from the platform

| Provided | What it is | Today |
|---|---|---|
| `sdk.db` | The shared MySQL pool | `pdq` |
| `sdk.auth` | Middleware: signed-in and switched on | `auth` |
| `sdk.role(req)` | This person's role in *this* app | read from `/api/me` today |
| `sdk.requireRole(...roles)` | Middleware: only these roles | `pdAuth`, `admin` |
| `sdk.audit(action, detail)` | Write to the app's audit trail | `pdAuditLogger` |
| `sdk.holdersOf(role)` / `sdk.contactsFor(users)` | Who holds a role, and their contact details (server side only) | `platformServices` |
| `sdk.log` | Logging with the app key attached | `console.log` |

### 3.5 Rules

1. **No app keeps users or passwords.** Sign-in is the platform's (unchanged from `PLATFORM-DESIGN.md` §2).
2. **No app writes platform tables:** `auth_users`, `user_module_roles`, `platform_*`.
3. **No app touches another app's tables or requires another app's files.** If 2 apps need to share something, it goes into `sdk` as a platform service.
4. **An app answers only on its own `mount` and `api`.** Route order between apps stops mattering.
5. **An app that fails to start takes down only itself.** The loader catches the failure and serves a "this app is unavailable" page on that app's addresses. Every other app and the launcher keep working.
6. **Each app's tests run on their own** (`npm test -- apps/pd`).
7. **Each app is deployable alone later** (D5). Nothing in the app may assume it shares a process with another app.

---

## 4. Database: one MySQL, owned in parts

| Owner | Tables | Migrations folder |
|---|---|---|
| The platform | `auth_users`, `user_module_roles`, `platform_people`, `platform_access_log` | `migrations/` at the repo root |
| O2S | `app_state` (and `o2s_*` for anything new) | `apps/o2s/migrations/` (none yet) |
| PD | `pd_*` | `apps/pd/migrations/` |
| QMS, CRMS, Nigehbaan | `qms_*`, `crms_*`, `ngb_*` | each app's folder |

The standing rule is unchanged: **every migration is applied locally first
(`van_platform` on XAMPP), and to production by hand, later, when Tahir
chooses.**

Foreign keys from an app to the platform are allowed only to `auth_users(id)`
(PD has 36 of these today). Nothing points from the platform to an app.

---

## 5. Deploying without interrupting anyone (D2)

**Why a deploy interrupts people today:**
- `render.yaml` attaches a 1 GB persistent disk (`pd-library`, mounted at `/var/data`) for PD Library uploads.
- A Render disk attaches to one running copy at a time. So Render stops the old version before starting the new one, instead of swapping them with no gap.
- The new version also runs database setup and migrations before it starts answering (`server.js`, last line), which lengthens the gap.
- This is Render's documented behaviour; confirm it in the deploy log on the first deploy after the change.

**Logins are not the problem.** Sessions are signed with `SESSION_SECRET` and
nothing is kept in memory, so a deploy logs nobody out as long as that secret
is set in Render.

**The fix, as 2 small changes:**

| # | Change | Module | What it needs |
|---|---|---|---|
| Z1 | Move PD Library files off the disk, then remove `disk:` from `render.yaml` | PD (files), then PLATFORM (`render.yaml`) | Choose where the files go: **in MySQL** (simplest; fine at current volumes, but check HostGator's size limit) or **Cloudflare R2** (free tier; keeps the database small). Existing files are copied across first. |
| Z2 | Add `healthCheckPath: /api/health` to `render.yaml` | PLATFORM | The route already exists. Render then switches traffic only once the new version answers. |

After Z1 and Z2, a deploy at any hour goes unnoticed. The remaining risk is a
**bad** deploy, which is covered by the loader's isolation (§3.5 rule 5),
testing locally against a production copy, and Render's one-click rollback.

---

## 6. Build order

Every phase goes through the 3 gates in `PLATFORM-DESIGN.md` §5: automated on
a throwaway copy, then local XAMPP, then production when Tahir chooses.

| Phase | What | Risk to O2S | Status |
|---|---|---|---|
| **0** | Z1 + Z2: zero-downtime deploys | none (PD and config only) | not started |
| **1** | **Folder organisation** (§8): the repo root is the platform, O2S and PD under `apps/`, each with its own docs, tests and log. Files moved **without changing behaviour** | low: moves only | **built 1 Oct 2026, checked 2 Oct, not yet committed** |
| **2** | The platform's `sdk` and loader. `MODULE_LIST` and `roleCatalogue()` are read from each app's `app.json` and `roles()`. `compha` becomes `nigehbaan` | medium: touches sign-in wiring | not started |
| **3** | **PD goes onto the contract** first (`app.json`, `server.js` entry), as it is not yet open to users | none | not started |
| **4** | **O2S goes onto the contract**: its routes (`/api/state`, `/api/rev`, `/api/users`) leave the platform's `server.js`. The old addresses keep working as aliases, because `o2s.html` calls them | the careful one: live every day | not started |
| **5** | New apps (QMS, CRMS, Nigehbaan) built straight onto the contract | none | not started |

---

## 7. Hosting options looked at (for the record)

| Option | Per-app deploys | Rough monthly cost | Verdict |
|---|---|---|---|
| Render, one service (**chosen**, D1) | no, but zero-downtime after Z1/Z2 | ~$7 | Chosen |
| Render, the platform public + apps as Private Services | yes; users still see one address | ~$7 per service | If per-app deploys are ever needed |
| Render, paid platform + free apps | yes | ~$7 to $14 | Free apps sleep after 15 minutes (30 to 60 seconds to wake), share one pool of 750 hours a month, and need public addresses. **Only for apps still being built.** |
| Railway | yes, plus private network and MySQL next to the apps | ~$20 to $40, usage-based | Best managed alternative |
| VPS + Coolify/Dokploy | yes | ~$6 to $20 for everything | Cheapest and fastest, but someone must own the server. That is the infrastructure department's call (CLAUDE.md §2A). |
| HostGator cPanel Node, or a server at the plant | none | none | Not for a backbone |

Prices are approximate; check current rates before any move.

**When to revisit D1:** an app needs its own scaling, an app's deploys must be
independent for a business reason, or the infrastructure department takes
ownership of a server. Rule 7 of the contract makes the move a configuration
change, not a rewrite.

---

## 8. Folder organisation (phase 1): as built, 1 October 2026

**Tahir's rulings, 1 October 2026:**
- The repo is the platform. Everything at the root is the platform's; each app
  lives under `apps/`.
- App keys are `nigehbaan`, `qms` and `crms`. `compha` in `MODULE_LIST`
  becomes `nigehbaan` in phase 2. Nobody holds a `compha` role, because it was
  never live.
- The repo keeps the name `VAN-OP`.
- Each app carries its own handoff log in its folder. The platform's log stays
  at the root as `OP-HANDOFF-PLATFORM.md` (renamed from `OP-HANDOFF-SHARED.md`).
- Deliverables (spreadsheets, decks, screenshots, zips) live outside the repo,
  in `VAN Platform\Deliverables\`, and later in the one shared drive.

### 8.1 On disk

```
E:\VAN\VAN Systems\
├── HRM\                     separate (own hosting)
├── Old Versions\
└── VAN Platform\
    ├── VAN-OP\              the platform repo, with every app inside apps/
    ├── VAN-Website\         separate repo (own hosting)
    ├── Deliverables\        outside Git: Claude outputs (O2S, PD, Platform), the O2S design zip
    ├── Nigehbaan-demo.html
    └── نگہبان Nigehbaan.docx
```

### 8.2 The repo

```
VAN-OP/                          THE PLATFORM
├── server.js                    sign-in, /api/me, /api/platform/*, mounts the apps
├── launcher.html                the front door at /
├── migrations/                  P001 (+ CHECK, PRODUCTION copy), RECONCILE-2026-09-25.sql
├── tests/                       people-access.test.js (throwaway database only)
├── docs/                        platform design, access model, architecture, this plan,
│                                ACCESS-ROLES, SECURITY-REGISTER, the handoff archive,
│                                VAN-Systems-Platform-Design.md
├── assets/                      shared logo, emblem, favicon, served at /assets
├── .claude/                     launch.json for Claude Code's preview
├── OP-HANDOFF.md                index of all session logs
├── OP-HANDOFF-PLATFORM.md       the platform's own log
├── CLAUDE.md  README.md  MODELING-GROUND-RULES.md
├── package.json  package-lock.json  render.yaml  .gitignore  .gitattributes
└── apps/
    ├── o2s/                     o2s.html, tests/, docs/ (specs, manual, parked work),
    │                            3 O2S standards (customer codes, org list, PO short-close),
    │                            OP-HANDOFF-O2S.md
    └── pd/                      pd.html, drop.html, pd-lib.js, pd-routes.js, migrations/,
                                 tests/, docs/model/, docs/audit/, OP-HANDOFF-PD.md
```

`server.js` stays at the root: it is the platform's server. QMS, CRMS and
Nigehbaan get their folders under `apps/` when they are built.

### 8.3 What changed in code (paths only)

| Where | Change |
|---|---|
| `server.js` | `require('./apps/pd/pd-lib')`, `require('./apps/pd/pd-routes')`; `sendFile` for `apps/pd/drop.html`, `apps/pd/pd.html` and `apps/o2s/o2s.html`; comments |
| `apps/pd/pd-routes.js` | Local `LIBRARY_DIR` fallback one `..` deeper, so it still resolves to `<repo>/van_library_files`. Render is unaffected: it sets `PD_LIBRARY_DIR`. |
| `apps/o2s/tests/` | `harness.js`, `instructions`, `recon` and `whatsnew` read `data/state.json` one `..` deeper. `manual.test.js` reads `../docs/`. |
| `tests/people-access.test.js` | `ROOT` is now 1 level up |
| Docs and comments | About 190 path mentions re-pointed. Migrations, `o2s.html`, `pd.html`, frozen test baselines, the parked `WORK-IN-PROGRESS` copy and old handoff entries were not edited. |

### 8.4 How it was checked (2 October 2026)

- The server started against local `van_platform`: `/`, `/pd`, `/pd/drop`, `/drop`, `/o2s` and `/api/health` all answer 200 with the right page.
- PD API suites, each on its own throwaway copy of `van_platform` (dropped afterwards): screens 64 of 64, spine 123 of 123, intake 132 of 134. The 2 intake failures expect Problem numbers `P-01` where PD gives `P-001`; the numbering code was not touched by the move, so this mismatch was there before (a PD item).
- O2S suite: 37 pass; 27 stop only because `data/state.json` does not exist on this machine.
- No file's encoding (byte-order mark) differs from the last commit; all relative doc links resolve.

---

## 9. Still open

1. **Old O2S addresses.** Today *any* unknown address serves O2S (the `*` route). Keep that as a fallback for old bookmarks, or send unknown addresses to the launcher? (Decide by phase 2.)
2. **Where Library files go (Z1):** MySQL or Cloudflare R2?
3. **Night use of O2S:** does anyone work in O2S at night? This sets the deploy hour until Z1/Z2 are done.
4. **One shared drive** for deliverables: Dropbox or OneDrive.
5. **O2S test data:** a command that exports the O2S state from local MySQL into `data/state.json`, so the 27 O2S tests that need it can run.
