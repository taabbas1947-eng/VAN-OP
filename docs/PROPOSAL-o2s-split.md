# Proposal — give O2S its own folder too, and finish the separation

_Written 2026-08-05 for Tahir. **Nothing has been changed.** This is the
companion to [`PROPOSAL-server-split.md`](PROPOSAL-server-split.md) (which covers
PD). Read both before any code moves._

---

## The idea in one line

PD is already getting its own home (front-end in `pd/`, routes moving to
`pd/pd-routes.js`). This plan does the equivalent for **O2S** so the repo ends up
symmetric: **one platform (`server.js`) + two subsystems, each fully inside its
own folder.**

## Two moves for O2S (they are separate — do them separately)

### Move A — the front-end (the one that matters)
O2S's substance is its front-end: `index.html` at the repo root. Give it a folder
like PD:

```
index.html  →  o2s/o2s.html      (git mv, preserves history)
```

Then one line changes in `server.js` — the catch-all that serves it
(**line 2063** today):

```js
// was: sendFile(path.join(__dirname, 'index.html'))
app.get('*', (req, res) => { res.set('Cache-Control', _NOCACHE); res.sendFile(path.join(__dirname, 'o2s', 'o2s.html')); });
```

O2S fetches everything by absolute path (`/api/…`, `/assets/…`), so moving the
file changes **nothing** about how it behaves. This is where the O2S developer
actually works, so this is the move that gives O2S a real "own room."

### Move B — the server routes (small; symmetry only)
O2S's own server routes are just **~40 lines** (`/api/state`, `/api/rev`,
`POST /api/state`, and the legacy `/api/users*`) at **lines 470–506** today. They
move into `o2s/o2s-routes.js` with the same dependency-injection pattern PD uses:

```js
// o2s/o2s-routes.js
module.exports = function mountO2sRoutes(app, deps) {
  const { store, auth, admin, hashPw, stripUsers } = deps;
  // …the /api/state, /api/rev, /api/users handlers, unchanged…
};
```

```js
// server.js — one line where ~40 used to be
require('./o2s/o2s-routes')(app, { store, auth, admin, hashPw, stripUsers });
```

## The one thing that does NOT move (and why)

The **`store`** (the `app_state` read/write layer O2S syncs through) **stays in
`server.js`.** It is a shared platform primitive — platform code uses it too:

- boot-time user seeding (`migrateAuth`, ~line 255),
- the access-control roles dropdown (`/api/platform/users`, ~line 386).

So `store` belongs to the core and gets **injected** into the O2S routes. Only the
thin handlers relocate. This is why Move B barely shrinks `server.js` (unlike the
PD split, which removes ~75% of the file). It's for tidiness/symmetry, not size.

## A decision to make during Move B

Legacy `/api/users*` (O2S's own user CRUD) overlaps with the newer
`/api/platform/users` access admin. When the O2S routes move, decide whether O2S
keeps its own user CRUD or defers to platform user management, so we don't carry
two parallel user-admin paths forward. **Not required for the move** — but the
right moment to settle it.

## The end-state (all moves done)

| Location | Contents |
|---|---|
| `server.js` | Platform only: auth, `/api/login`, `/api/me`, access control, launcher, static, the shared `store`, migrations |
| `o2s/` | `o2s.html` + `o2s-routes.js` |
| `pd/` | `pd.html` + `pd-lib.js` + `pd-routes.js` |

`server.js` becomes the main app / platform; each subsystem lives fully in its
own folder. Symmetric and easy to reason about.

## Risk assessment

**Low, but the ordering and coordination matter.**

- **Move A (front-end rename)** is behaviour-neutral (absolute paths) — but it is
  a **file rename**, and the other contributor edits `index.html` directly. A
  rename against their in-flight edits merges badly (git sees "they changed a file
  we deleted"). **This is the highest-friction step. Do it only when they've
  pushed and are not in that file, and tell them O2S now lives at `o2s/o2s.html`.**
- **Move B (routes)** is a pure move with dependency injection, no logic change.
  Route order is preserved by mounting at the same point in the file.
- Neither move touches PD, the launcher, the database, or any data.

## Recommended sequence (all three structural moves)

Do them **one at a time, each on a committed baseline**, verifying boot + pages
after each. Suggested order (biggest, cleanest win first; highest-friction rename
when the contributor is clear):

1. **PD routes extraction** — `server.js` → `pd/pd-routes.js` (the PD proposal).
   Hoist `_NOCACHE` to the shared header first, commit that alone, then move.
2. **O2S front-end move** — `index.html` → `o2s/o2s.html` (Move A). Coordinate
   the rename with the contributor.
3. **O2S routes extraction** — `server.js` → `o2s/o2s-routes.js` (Move B).
   Optional symmetry; smallest payoff.

After each move, verify locally and **do not push** — leave it "ready to push"
for Tahir to push via GitHub Desktop (per `MODELING-GROUND-RULES.md` §1).

### Verification checklist (run after every move)
- server starts with no `ReferenceError`
- `/`, `/o2s`, `/pd`, `/pd/drop` all load
- `/api/me` returns the module list; the launcher tiles render
- sign in, open the **Access** tile (COO), confirm the grid loads
- for a routes move: spot-check one route from the moved file

## Should you do it now?

**No — not this week.** `server.js` was just changed for the access-control
feature (commit `b6f43d0`), so it needs a stable, settled baseline first, and the
contributor's O2S work should land before any `index.html` rename. The
`CLAUDE.md` module-boundary rule keeps the collision risk near zero in the
meantime. The right window is a quiet day when both `server.js` and `index.html`
are committed and nobody is mid-change in either.

---

_Verified against `server.js` @ commit `0c95b25`, 2026-08-05. Line numbers
(2063, 470–506, 255, 386) are from that commit and will drift if the file
changes — re-map before executing._
