# VAN Operations Platform — Architecture & Access Model

> One platform, several subsystems, one sign-in. This document is the reference
> for how the app is structured and how access is managed. It marks what is
> **Current** today vs **Planned** (agreed design, not yet built).

---

## 1. The big picture

**VAN Operations Platform** is a **modular monolith**: a single Node/Express
application (`server.js`) that serves one launcher and several **subsystems**.
Each subsystem is a self-contained area of the business, but they share one
identity, one sign-in, and one access model.

| Subsystem | Code | Status | What it does |
|-----------|------|--------|--------------|
| Order to Ship | **O2S** | Live | Orders → production → packing → shipment → delivery |
| Product Development | **PD** | Live | R&D pipeline: idea intake → gates G3–G6 → records |
| Human Resources | **HRMS** | Live (external) | People, attendance, leave, payroll — a separate Django app; linked from the launcher |
| Quality Management | **QMS** | Planned | SOPs, deviations, CAPA, audit readiness |
| Compliance & Risk | **CRMS** | Planned | Regulatory compliance, risk registers, controls |

Everyone lands on the **launcher** (`/`), which shows every subsystem as a tile
and unlocks the ones the signed-in person is allowed to enter.

---

## 2. Repository structure

The intent: anyone opening the repo should immediately see **one main app** with
**O2S and PD as subsystems inside it**.

```
VAN-OP/
├─ server.js              The "main app": auth, sessions, platform access,
│                         the shared data store, and the mount points for each subsystem
├─ launcher.html          Front door (the platform launcher)
├─ assets/                Shared brand assets (logo, emblem, favicon)
│   ├─ van-logo.png
│   ├─ van-emblem.png
│   └─ favicon.png
├─ o2s/                   Order to Ship subsystem
│   └─ o2s.html           O2S single-page app (was index.html at repo root)
├─ pd/                    Product Development subsystem
│   ├─ pd.html            PD single-page app
│   ├─ pd-lib.js          PD business logic (roles, surfaces, gate/screen engine)
│   ├─ pd-routes.js       All /api/pd/* routes (mounted by server.js)
│   ├─ drop.html          Public "drop box" page (no login)
│   └─ migrations/        PD schema (001_pd_foundation.sql)
├─ docs/
│   └─ ARCHITECTURE.md    This file
└─ Logo/                  Source brand PDFs
```

> **Done 2026-08-05:** O2S moved from root `index.html` → `o2s/o2s.html`, and PD's
> ~1,530 lines of `/api/pd/*` routes moved out of `server.js` into `pd/pd-routes.js`
> (mounted via `require('./pd/pd-routes')(app, {…deps})`). `server.js` dropped from
> ~2,088 to ~557 lines — platform + a thin O2S sync layer. Both were pure moves
> (behaviour-neutral); O2S's few server routes (`/api/state`, `/api/users`) still
> live in `server.js` (the deferred, optional O2S-routes split — see
> [`PROPOSAL-o2s-split.md`](PROPOSAL-o2s-split.md)).

### How a subsystem plugs in (the repeatable pattern)

A subsystem = **a front-end page + an API namespace + its own tables + a role set**:

1. A page served by a route (`/o2s`, `/pd`, later `/qms`, `/crms`).
2. An `/api/<name>/…` namespace in `server.js` (optionally its own routes file).
3. Its own tables (O2S uses `app_state`; PD uses `pd_*`).
4. A role set and a permission model (see §5).
5. A tile on the launcher, gated by the person's grants.

---

## 3. Serving & routing (Current)

`server.js` resolves requests in this order:

| Route | Serves |
|-------|--------|
| `/assets/*` | Shared brand assets (static, cacheable) |
| `/`, `/launcher` | `launcher.html` (front door) |
| `/drop`, `/pd/drop` | `pd/drop.html` (public, no login) |
| `/pd`, `/pd/*` | `pd/pd.html` (PD app) |
| `*` (any other path) | O2S (`index.html` → planned `o2s/o2s.html`) |

APIs live under `/api/…` (`/api/login`, `/api/me`, `/api/platform/*`, `/api/pd/*`).

---

## 4. Identity & sign-in (Current)

- **One login per person**, stored in `auth_users` (`username`, `name`,
  `pass_hash`, `active`, `role` = O2S role, `pd_role` = PD role).
- Sign-in (`/api/login`) issues a signed token held in the browser
  (`van_token` in `localStorage`); every subsystem reads the same token — **one
  sign-in covers the whole platform**.
- Passwords are salted + hashed (scrypt). Never stored in plain text.

---

## 5. Access model

### 5.1 Source of truth (Current)

`user_module_roles` is the **authoritative table for access** — "who may enter
which subsystem, and with what role":

| username | module | role | *is_admin (planned)* |
|----------|--------|------|----------------------|
| ahmed | o2s | Production | 0 |
| sara  | pd  | qc_head | 1 |
| … | … | … | … |

`/api/me` reads this table and returns the person's `modules[]`; the launcher
uses it to unlock tiles. Grants are **dual-written**: `user_module_roles` plus the
legacy `auth_users.role` / `auth_users.pd_role` columns, so O2S and PD keep
reading their own columns unchanged.

### 5.2 Per-subsystem roles (Current)

Each subsystem keeps its own role vocabulary and permission style:

- **O2S** — screen-owner roles: `KAM`, `Supply Chain`, `Production`, `Lab Rep`,
  `AQCM`, `QCM`, `QA Inspector`, `Plant Manager`, `CFO`, `COO`. Edit rights are
  per screen.
- **PD** — surface-based roles: `coo`, `ceo`, `qc_head`, `rta`, `production`,
  `agronomy`, `custodian`, `member`, `lab_tech`, `consultant`. A role maps to a
  set of allowed *surfaces* (`pd-lib.js`).

Launcher behaviour: **all subsystem tiles are always shown**; the ones a person
is granted open, the rest are **locked** (dimmed, "Access not granted"). HRMS is
an external link open to all; QMS/CRMS show as "coming soon".

### 5.3 Two-tier administration (Built)

Access is administered at **two levels**:

| Tier | Who | Can do | Cannot do |
|------|-----|--------|-----------|
| **Platform admin** | The **COO** (O2S role `COO`) | Everything: create/deactivate logins, reset passwords, **appoint subsystem admins**, grant/revoke any role in any subsystem | — |
| **Subsystem admin** | Anyone the COO marks `is_admin` on a module | Assign/remove **functional roles within that module** for people who already have a login | Create/deactivate logins, reset passwords, appoint admins, or touch any other module |

**Identity stays central:** only the platform admin (COO) creates or deactivates a
login. Subsystem admins manage *roles*, not *accounts* — this guarantees one
identity per person across the whole platform.

**A person can be a subsystem admin of more than one subsystem.** Because the
admin flag lives on each `(user, module)` grant, one person can hold `is_admin=1`
on several modules at once. Example:

| username | module | role | is_admin |
|----------|--------|------|----------|
| bilal | o2s | Plant Manager | 1 |
| bilal | pd  | custodian | 1 |

Here **Bilal administers both O2S and PD** — he can assign O2S roles *and* PD
roles, but only within those two modules, and he still can't create logins or
appoint other admins. Each admin grant is independent, so the COO can mix and
match (e.g. one person admins O2S + QMS, another admins PD only).

### 5.4 How it's enforced (Built)

- One additive column: `user_module_roles.is_admin TINYINT(1) NOT NULL DEFAULT 0`
  (idempotent migration in `runPlatformMigration`, no data loss).
- `accessAdmin` middleware loads the caller's caps fresh from the DB
  (`{isCOO, adminModules}`). A grant/revoke on module *M* via
  `/api/platform/access` is permitted only if the caller **is the COO** **or**
  has `is_admin = 1` on module *M*. A subsystem admin can set only functional
  roles — never the O2S `COO` role, never a COO's grant, never another module.
- `POST /api/platform/admin` (COO-only) sets/clears `is_admin`; the person must
  already hold a role in that module. `POST /api/platform/users` (create login)
  stays COO-only.
- `/api/me` returns `adminModules[]` so the launcher knows whose Access screen to
  show.

### 5.5 Where each admin works (Built)

Both tiers use the launcher's **Access tile** — the screen is scoped by who opens it:

- **COO** → all subsystem columns, an "admin" checkbox per person/module to
  appoint subsystem admins, and the "Add user" card.
- **Subsystem admin** → the tile unlocks for them too, but the grid shows only
  the module(s) they administer, with role dropdowns only (no admin checkboxes,
  no "Add user"). O2S role options hide `COO`.

*Future:* once O2S moves into `o2s/`, each subsystem can also expose an in-app
**Access** entry point that opens this same scoped screen.

---

## 6. Data stores

| Store | Owner | Contents |
|-------|-------|----------|
| `app_state` (single JSON row) | O2S | All O2S operational data (orders, production, shipments, batches, logs) |
| `pd_*` tables | PD | Ideas, gate decisions, samples, trials, candidates, materials, audit log |
| `auth_users` | Platform | Logins, names, hashed passwords, legacy role columns |
| `user_module_roles` | Platform | Authoritative access grants (+ `is_admin`, planned) |

Schema is created/updated automatically on boot by additive, idempotent
migrations (`CREATE TABLE IF NOT EXISTS`, `ALTER … ADD COLUMN`, `INSERT IGNORE`).
No migration drops or overwrites existing data.

---

## 7. Backups

Code lives in Git; **data does not**. Production data (`app_state`, `pd_*`,
`auth_users`, `user_module_roles`) is in one MySQL database and must be backed up
independently:

- **Full DB backup** — a nightly `mysqldump` (cPanel cron) with rotation, copied
  off the host weekly. This is the complete disaster-recovery net (O2S + PD +
  users). *This is the source of truth for recovery.*
- **O2S Data Fix snapshot** — an in-app JSON export of O2S data, downloaded by the
  COO; a handy application-level restore point **for O2S only** (does not include
  PD or the access tables). Complementary to, not a replacement for, the full DB
  backup.
- **Before every deploy/migration**, take a manual snapshot.

---

## 8. Build roadmap for the access work

1. **Repo restructure** — move O2S into `o2s/o2s.html` *(deferred; coordinate with contributor)*.
2. ✅ **Migration** — `user_module_roles.is_admin` added.
3. ✅ **Enforcement** — `accessAdmin` gate; scoped `/api/platform/access`;
   COO-only `/api/platform/admin` appoint/revoke; `adminModules[]` in `/api/me`.
4. ✅ **UI** — launcher Access screen scoped by role, with COO appoint-admin toggles.
5. **Audit** — log every access change (who granted/revoked what, when) *(pending)*.

---

*Last updated: 2026-08-04.*
