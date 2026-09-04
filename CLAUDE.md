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

### 0.1 The shorthand — Tahir does not have to type "MODULE:"

Tahir works fast and types short. **The bare word is the declaration.** These
are all the same instruction and Claude treats them as binding:

| What Tahir types | What it means |
|---|---|
| `pd` · `PD` · "lets do pd" · "pd app" · "working on pd" | `MODULE: PD` |
| `o2s` · `O2S` · "the 2nd app" · "order to ship" | `MODULE: O2S` |
| `platform` · "launcher" · "login" · "the access matrix" | `MODULE: PLATFORM` |

The declaration **holds for the whole session** until Tahir names a different
one. He does not have to repeat it every message. Claude does not ask again
mid-session for something already declared.

**Claude must reply, before its first edit, with:**

1. the module it is working in,
2. the exact file list it is allowed to touch for that module,
3. the file list it must NOT touch,
4. `git status` + current branch.

If Tahir has not declared a module, **Claude asks — it does not guess.**
If a request would cross the boundary, Claude **stops and says so** rather than
quietly editing both sides.

### 0.2 Switching modules mid-session

Saying the other module's name switches modules. When that happens Claude must,
**before the next edit**:

1. state that the module changed, PD → O2S or the reverse,
2. report anything left unfinished in the module being left,
3. re-echo the new module's allowed and forbidden file lists.

**Never edit both modules in one change.** If a job genuinely needs both sides,
Claude splits it into two declared pieces and does them one after the other —
it does not quietly touch both and call it one task.

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

**Cost — settled 2026-09-01, Tahir ruled: cost is OUT of PD.** Ground-rule 0
(*"this system does NOT manage cost"*) applies platform-wide — no PD exception.
The old candidate-screen cost engine (ex-works `(RM + conversion)/(1 − loss)`,
ranking by rupees per kg of P₂O₅ — `pd/pd-lib.js:188–232`) does **not** carry
into the PD rebuild; it is removed from `docs/pd-model/REUSE-RULES.md` §2's
whitelist. Record: `docs/pd-model/PENDING-DECISIONS.md` §D.

**Never push.** Build and verify locally, then say "ready to push (not pushed)".
Tahir pushes with GitHub Desktop.

---

## 2A. Security and access control are NOT Tahir's job

**Ownership.** Security, authentication, passwords, access control and
infrastructure hardening belong to a **different department**. They are not
Tahir's work and they are not a gate on Tahir's work. Tahir's job is the
**application** — features, correctness, usability, and getting changes live.

**So the rule is:**

1. When Claude finds a security defect, it **records it and moves on.** It does
   not stop the session, does not put it at the top of the reply, and does not
   ask Tahir to fix it.
2. Every finding goes into **`docs/security-register/SECURITY-REGISTER.md`** —
   one row, dated, with what it is, how it was confirmed, and what it lets an
   attacker do. That file is the standing letter to the other department.
3. Claude mentions security **once, briefly, at the end of a session** — a
   pointer to the register, not a lecture. If nothing new was found, it says
   nothing at all.
4. Claude **never blocks a release** on a security item, and never writes
   "before you launch you must…" about one. It ships the app.
5. If Tahir explicitly says *"do the security work"*, that is a
   `MODULE: PLATFORM` declaration and the normal rules apply. Only then.

**What Claude still does without asking:** it will not *introduce* a new
security hole, and it will not remove an existing protection. Writing safe code
is part of writing code. Fixing the department's backlog is not.

**Delivery is the priority.** When Claude has to choose between a perfect change
and a live one, it ships the live one and writes the remainder down.

---

## 3. Verified state (checked 2026-08-16)

- Folder: `E:\VAN-OP` — **correct folder**, this is the live repo.
- Remote: `https://github.com/taabbas1947-eng/VAN-OP.git`
- Branch: `main` @ `bad0680` *"real pd major chnages"* — working tree clean,
  in sync with `origin/main`.
- **This commit is confirmed deployed and running.** Proof is the migration
  statement count in the Render log: the migration file gained exactly one
  statement (the A6 `ALTER`), and the log moved `25 statements applied` →
  `26 statements applied` in step. No failed-statement line, no aborted boot.
- Structure changed on 2026-08-15: PD routes now live in **`pd/pd-routes.js`**
  (~1,550 lines), O2S under **`o2s/`**. `server.js` is down to ~556 lines and is
  now genuinely PLATFORM-only — auth, login, `/api/me`, mounting the two
  modules. **Section 1's "one shared file" note is now much narrower than it
  was: the modules barely touch.**
- Other branches: `dashboard-intervention-view` @ `759342e` (stale) and
  `prelaunch-fixes` @ `6134503` — **redundant, its changes are inside `main`.**
  Safe to delete.
- Live auth confirmed working: `/api/me` → `tahir` / COO, modules `o2s:COO` +
  `pd:coo`. **PD has no real data yet** (empty pilot, as intended).
- `_to_delete/` holds **stale duplicate copies** of `pd.html`, `pd-lib.js`,
  `migrations/`, `PORTING_STATUS.md`. It is gitignored. **Never open, edit, or
  read these as source** — they are the old versions and will mislead.

### 3.1 How changes reach the working tree — no patch files, ever

Four commits in a row committed `.patch` **files** instead of applying them:
435 lines of patch text, zero lines of changed code. In GitHub Desktop,
committing a patch and applying one look identical. That was a **method**
failure, not a carelessness failure, so the method changed:

- **Claude writes finished files directly into `E:\VAN-OP`.** No `.patch` files
  are produced, handed over, or stored. Ever.
- **Tahir's whole job is: commit and push what GitHub Desktop shows.** No apply
  step. No merge step. No branch step.
- Claude still **never pushes** (§2).

If Claude ever finds itself about to write a `.patch` file, that is the bug.

---

## 4. Session-close rule

End every working session by appending to `OP-HANDOFF.md`:
module worked in · files changed · pushed or not-pushed · what's next.
That file, not Claude's memory, is the continuity between sessions.
