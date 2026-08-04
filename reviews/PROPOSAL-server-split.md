# Proposal — remove the O2S/PD seam in `server.js`

_Written 2026-08-04 for Tahir. **Nothing has been changed.** This is a plan for
you and Ahmer to review before any code moves._

---

## The problem in one line

`server.js` is 2,028 lines and is the **only** file where O2S and PD physically
touch. Everything else is already cleanly separated (`index.html` = O2S,
`pd/` = PD). Two people editing two modules in one file is where a merge
conflict — or a silent wrong-module edit — will eventually come from.

## The good news: the file is already almost split

I mapped every route registration. The layout is far cleaner than the line
count suggests:

| Lines | Contents | Owner |
|---|---|---|
| 1 – 308 | requires, config, DB pool, password/token helpers, `auth`, `admin`, `pdAuth`, `pdSurface`, `pdAuditLogger`, migrations | **shared / platform** |
| 309 – 410 | `/api/health`, `/api/login`, `/api/me`, `/api/platform/*` | **platform** |
| 413 – 460 | `/api/state`, `/api/rev`, `/api/users*` | **O2S** |
| **465 – 1996** | **all 81 `/api/pd/*` routes + their PD-only helpers** | **PD** |
| 1998 – 2006 | static + `/`, `/drop`, `/pd`, catch-all `*` | **platform** |

**The PD block is one contiguous run of ~1,530 lines.** That is roughly 75% of
the file, and it does not interleave with O2S at any point.

## The proposed change

Move lines **465–1996** into a new file `pd/pd-routes.js`, exported as an
Express router-mounting function:

```js
// pd/pd-routes.js
module.exports = function mountPdRoutes(app, deps) {
  const { pdq, auth, admin, pdAuth, pdSurface, pd, path, fs, crypto } = deps;
  // …the 81 /api/pd/* handlers and their PD-only helpers, unchanged…
};
```

`server.js` then keeps one line where 1,530 used to be:

```js
require('./pd/pd-routes')(app, { pdq, auth, admin, pdAuth, pdSurface, pd, path, fs, crypto });
```

**Result:** `server.js` drops to roughly **500 lines** of platform + O2S. PD
work never opens it again. The seam is gone.

## What moves with it

These helpers are defined inside the PD block and are used only by PD — they
travel to `pd/pd-routes.js` unchanged:

`pdRouteSettings` · `pdRescreenCandidate` · `pdParticipants` · `REG_STATUS` ·
`LIBRARY_DIR` · `libDirReady` · `libTotalBytes` · `libMayUpload` ·
`libStoreUpload` · `pinTargets` · `resolvePin` · `pdCurrentVersion` ·
`pdNextStep`

## The one real entanglement (must be handled, not assumed)

`_NOCACHE` is defined at **line 1995 — inside the PD block** — but is used by
the **static/platform routes at lines 2000–2006**, which stay behind.

If the block is moved naïvely, `server.js` throws `ReferenceError: _NOCACHE is
not defined` at startup and **the whole platform fails to boot** — O2S included.

**Fix:** hoist `const _NOCACHE = 'no-store, no-cache, must-revalidate';` up into
the shared header (near line 30) *before* moving anything. One line, done first,
verified separately.

## Risk assessment

**Low, but not zero — and the timing matters.**

- It is a **pure move**: no logic changes, no route-order changes, no schema
  changes, no data touched. Every line lands in `pd/pd-routes.js` byte-identical
  apart from indentation.
- **Route order is preserved by construction** — `mountPdRoutes(app, …)` is
  called at the same point in the file where the PD block sits today, so
  `/api/pd/*` still registers before the `/pd` and `*` catch-alls. This matters:
  `PORTING_STATUS.md` records that getting this order wrong once made `/pd`
  silently serve the O2S app.
- ⚠️ **Timing conflict.** Ahmer pushed **+1,625 lines into `server.js` on 3 Aug**.
  If he has more `server.js` work in flight, this move will conflict badly with
  it — a 1,530-line relocation is the worst possible thing to merge against.
  **Ask him before doing this**, and do it on a day he is not in that file.

## Recommended sequence

1. **Agree with Ahmer** that `server.js` is frozen for the duration.
2. Hoist `_NOCACHE` to the shared header. Start the server. Confirm all three
   URLs still load. Commit that alone.
3. Move lines 465–1996 into `pd/pd-routes.js` with the dependency-injection
   signature above.
4. Verify locally before anything is pushed:
   - server starts with no `ReferenceError`
   - `/`, `/o2s`, `/pd`, `/pd/drop` all load
   - `/api/me` returns the module list
   - spot-check one PD route per surface — ideas, records, gates, samples,
     candidates, trials, registers, library, dropbox
5. **Do not push.** Leave it "ready to push (not pushed)" per
   `MODELING-GROUND-RULES.md` §1. Tahir pushes via GitHub Desktop.

## Should you do it now?

**My read: not this week.** PD has zero live data and Ahmer's `server.js` work
is one day old — the merge risk is currently higher than the benefit. The
`CLAUDE.md` boundary rule handles the collision risk in the meantime at zero
cost. The right moment is after Ahmer's PD UI work settles and before a second
person starts writing PD backend code.

---

_Verified against `server.js` @ commit `3b8014b`, 2026-08-04. Line numbers are
from that commit and will drift if the file changes._
