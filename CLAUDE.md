# CLAUDE.md — VAN Systems repo: how to work here

_Read this first, every session, before touching any file._

This repo holds **one platform with several modules**, not one project. The
single most common way to cause damage here is to edit the wrong module's
files because the session never established which module it was in.

---

## 0. THE DECLARATION RULE (do this before anything else)

**Claude has no memory between sessions.** A new Cowork session starts blank —
it does not remember yesterday's module, decision, or half-finished change.
So the module cannot be remembered; it must be **declared and echoed** each time.

**Tahir opens every working session with one line:**

```
MODULE: PD
```
or
```
MODULE: O2S
```
or
```
MODULE: PLATFORM        (launcher, login, /api/me, access matrix)
```

**Claude must reply, before its first edit, with:**

1. the module it is working in,
2. the exact file list it is allowed to touch for that module,
3. the file list it must NOT touch,
4. `git status` + current branch.

If Tahir has not declared a module, **Claude asks — it does not guess.**
If a request would cross the boundary, Claude **stops and says so** rather than
quietly editing both sides.

---

## 1. Module map — which files belong to whom

| Module | Owns these paths | Live at |
|---|---|---|
| **O2S** (Order to Ship) | `index.html` · the O2S route/API block in `server.js` · `data/state.json` | `/o2s` |
| **PD** (Product Development) | **everything under `pd/`** — `pd.html`, `pd-lib.js`, `drop.html`, `migrations/`, `PORTING_STATUS.md` · the `/api/pd/*` block in `server.js` | `/pd`, `/pd/drop` |
| **PLATFORM** (shared) | `launcher.html` · login / `van_token` / `GET /api/me` · `auth_users`, `user_module_roles` · `package.json`, `render.yaml`, `assets/`, `Logo/` | `/` |
| **HRMS** | launcher card only — **no backend exists yet** (0 references in `server.js`) | card says LIVE, nothing behind it |
| **QMS, CRMS** | not built | "Coming soon" cards |

### The one genuinely shared file: `server.js`

`server.js` (~2,030 lines) serves **both** apps — this is deliberate ("one
codebase, one login, one deploy" — see `VAN-Systems-Platform-Design.md` §1).
It is the only place the modules physically touch.

Rules for `server.js`:

- PD work may only edit inside the **`/api/pd/*` handlers** (81 of them) and
  `require('./pd/pd-lib')`.
- O2S work may only edit **outside** those handlers.
- Neither module edits the auth block, `/api/login`, or `/api/me` — that is
  PLATFORM work and needs an explicit `MODULE: PLATFORM` declaration.
- **Route order matters**: `/pd` must stay registered *before* O2S's catch-all,
  or `/pd` silently serves the O2S app. Do not reorder route registration.

**Known trap:** the `/pd` handler is a catch-all — `/pd/pd-lib.js` returns
`pd.html`, not JavaScript. That is fine today because `pd-lib.js` is a
**server-side Node module**, never fetched by the browser (`pd.html` contains no
`<script src=…>` at all). Do not "fix" this by adding a browser-side import of
`pd-lib.js` without adding a real static route first.

---

## 2. Standing rules that still apply

`MODELING-GROUND-RULES.md` (Tahir, 2026-06-17 / 2026-07-28) is **permanent** —
never push, ask before master-data changes, no false alerts, read-only by
default, no invented rates.

⚠️ **Scoping correction needed.** Ground-rule 0 says *"this system does NOT
manage cost."* That rule was written for **O2S** and is correct there. **PD is
different by design** — its candidate screen deliberately computes ex-works
cost `(RM + conversion) / (1 − loss)` and ranks by **rupees per kg of P₂O₅**
(see `pd/PORTING_STATUS.md`). Read ground-rule 0 as **O2S-scoped**. It does not
forbid PD's costing arithmetic. Confirm with Tahir before extending cost
features in *either* module.

**Never push.** Build and verify locally, then say "ready to push (not pushed)".
Tahir pushes with GitHub Desktop.

---

## 3. Verified state (checked 2026-08-04)

- Folder: `E:\VAN-OP` — **correct folder**, this is the live repo.
- Remote: `https://github.com/taabbas1947-eng/VAN-OP.git`
- Branch: `main` @ `3b8014b`, working tree **clean**, nothing uncommitted.
- Other branch: `dashboard-intervention-view` @ `759342e` — stale, behind main.
- Last push: **AhmerVG, 2026-08-03** — *"VAN platform branding, launcher
  redesign & PD module UI"* (13 files: launcher redesign, VAN logo/branding
  assets, `pd/pd.html` +1,672 lines, `pd/pd-lib.js` +140, `server.js` +1,625).
  Before that, Tahir's own 2026-07-31 *"DILIVERY AND ROLE"*.
- **Live site is byte-for-byte identical to this working copy** — SHA-256 of
  `launcher.html`, `index.html`, `pd/pd.html`, `pd/drop.html` all match what
  `van-control-tower.onrender.com` serves. What you see live is what you have.
- Live auth confirmed working: `/api/me` → `tahir` / COO, modules `o2s:COO` +
  `pd:coo`. `GET /api/pd/home` returns `{"total":0}` — **PD has no real data
  yet** (empty pilot, as intended).
- `_to_delete/` holds **stale duplicate copies** of `pd.html`, `pd-lib.js`,
  `migrations/`, `PORTING_STATUS.md`. It is gitignored. **Never open, edit, or
  read these as source** — they are the old versions and will mislead.

---

## 4. Session-close rule

End every working session by appending to `OP-HANDOFF.md`:
module worked in · files changed · pushed or not-pushed · what's next.
That file, not Claude's memory, is the continuity between sessions.
