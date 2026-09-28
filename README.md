# VAN Systems — the VAN Operations Platform

One sign-in and one server for Vital Agri Nutrients' operations apps.
**Code and data are separate**: the code lives here (GitHub → Render); the
team's live data lives in an external **MySQL database on HostGator** that
survives every deploy.

**Before changing anything, read `CLAUDE.md`.** It says which files belong to
which app, the standing rules, and where things stand today (§3.0).

## What is in here

| Path | What it is |
|---|---|
| `server.js` | The Node/Express server. Sign-in, `/api/me`, People and access (`/api/platform/*`), O2S's routes, and it mounts PD. |
| `launcher.html` | The front door at `/`: sign-in, a tile per app, and **People and access** (every person, their details, their role in each app, who holds what). |
| `o2s/` | **O2S — Order to Ship.** `o2s.html` is the whole app. Live and in daily use. Tests in `o2s/tests/`. |
| `pd/` | **PD — Product Development.** `pd.html`, `pd-routes.js` (every `/api/pd/*` route), `pd-lib.js`, `drop.html` (public drop box), `migrations/`, `tests/`. Built, not yet opened to users. |
| `platform/migrations/` | Database migrations for the platform (P001: people and the access log). |
| `tests/platform/` | Platform tests. Run only against a throwaway database copy. |
| `docs/` | `platform/` (access model and design), `pd-model/` (PD's model and rulings), `security-register/`, O2S manuals and specs. |
| `OP-HANDOFF-*.md` | The running log per app: what was done, what is next. Start at the last "RESUME HERE" entry. |

Not in this repo: **HRMS** (a separate Django app with its own login; the
launcher links to it) and **Nigehbaan** (the compliance app, being built in
its own folder, to join this server as a module).

## How access works (short version)

- A **person** (`platform_people`) is separate from a **login** (`auth_users`).
- Each login holds **1 role per app** (`user_module_roles`), set only on
  People and access. Each app decides what its roles may do.
- Every change to people, logins and roles is written to an append-only
  **access log** (`platform_access_log`).
- Full description: `docs/platform/ACCESS-MODEL.md`.

## Run locally

1. XAMPP with MySQL/MariaDB running and a database called `van_platform`.
2. A `.env` file in this folder (never committed) with
   `DATABASE_URL=mysql://root:@127.0.0.1:3306/van_platform` and a fixed
   `SESSION_SECRET`.
3. `npm install`, then `npm start` → http://localhost:3000

Without `DATABASE_URL` the server falls back to a local file store; PD and
People and access need the database.

## Database changes

Migrations run on the **local database first**; production is applied by
hand later, when Tahir chooses (`CLAUDE.md` §2). HostGator's phpMyAdmin SQL
tab stays on `information_schema`, so every production statement names the
database (`jodilkah_vanop_db.<table>`); each migration has a `.PRODUCTION.sql`
or schema-qualified copy for that.

## Deploy

Commit and push with GitHub Desktop → Render deploys `main` automatically.
The data is untouched by a deploy. Render needs 2 environment variables:
`DATABASE_URL` (the HostGator MySQL) and `SESSION_SECRET` (a fixed long
random string, so sign-ins survive restarts). In HostGator cPanel → Remote
MySQL, Render's outbound host must be allowed.
