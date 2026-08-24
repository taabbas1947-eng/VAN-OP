# The save retry — built, refused, reverted

22 August 2026. The change is NOT in the app. The test is parked here beside this
note. Read this before anyone tries again.

## The defect it was meant to fix (still live, still real)

`_savePending` means "this browser holds a change the server has not confirmed",
and `startSync()` refuses to pull while it is true — so a background refresh can
never overwrite an unsaved edit. That guard is right.

But `_savePending=false` is set **only** inside `if(r.ok)`. A network drop, a
500, a 413, a 401, an unusable 409 body, or a sixth conflict all leave it true
with nothing scheduled to try again. **That tab then stops receiving the team's
changes for the rest of the day, silently, behind a "synced" toast.** One Wi-Fi
blip on a plant tablet does it.

**This is still true. Nothing has been fixed.**

## What was built

A retry on every failing exit — `_saveRetryLater()` with backoff
2s/5s/15s/30s/60s, capped, called from the five failing exits, plus `_saveOK()`
on success. `_savePending` deliberately NOT cleared on failure.

The reasoning for not clearing it was checked and is **sound**: clearing it lets
`startSync` pull, and the sync ends with `_snapBase()`, pinning the merge
baseline to a state containing the unsent edit. The next 409 then sees
`local === base` and takes the server's older value. That is the 30 July
gate-pass revert. Keep the flag.

## Why it was refused

### 1. It made a data-loss path WORSE — the reason it must not ship

`saveNow`'s 409 handler calls `_snapBase()` on the **merged local** state — a
state holding the edit the server never received. That is exactly the condition
`firstsave.test.js` already asserts as "BUG 1". Measured with the real `merge3`:

```
start             gatePass = "GP-77"
after conflict 1  gatePass = "GP-77"   baseline now poisoned
after conflict 2  gatePass = ""        gone from the screen
```

Before the change the loop stopped after six conflicts, leaving the edit
stuck-but-visible. The retry made it unbounded, so every further round can wipe
it. **"Stuck but visible" became "silently reverted"** — the very bug the change
cites as its reason to exist.

### 2. The 401 path was not fixed, it only looked fixed

`setSession('',null)` clears `_token`; `saveNow` begins `if(!_token) return;`.
So the retry fires two seconds later on the login screen, makes no request, and
schedules nothing. The chain is dead and `_savePending` is stuck true again.
The comment written into the file claimed the opposite of the measured behaviour.

### 3. A success can cancel another request's retry

Two saves overlap (the 400ms debounce plus a retry is enough). The newer one —
carrying the Gate Pass — fails and arms a retry. The older one succeeds,
`_saveOK()` fires, clears `_savePending` and cancels the retry. The Gate Pass
exists only on that screen and will never be re-sent. Measured.

### 4. Conflict pressure was counted as connectivity failure

Six conflicts is normal when several tablets are on one order. The operator would
see "Synced with the team's latest changes" and "cannot reach the server" back to
back, while the server was fine.

### 5. Two 1.9-second toasts cannot carry an all-day warning

No recovery message either — someone who saw "not reached the server" is left
believing work was lost when it landed. And there is no `beforeunload` guard, so
closing the tab the toast begged them to keep open destroys the work silently.

### 6. A 413 or 400 retries for ever and can never succeed

No retryable/non-retryable split.

## And my test hid two of these

- **`setSession: () => {}`** meant `_token` stayed set in the sandbox, so the 401
  assertions passed while the real retry is a no-op. The most misleading stub.
- **`merge3: (b,l,s) => l`** hid finding 1 completely — the real function returns
  the SERVER's value when `base === local`, which is what the 409 handler sets up.
- **The fake timer fired the newest timer, not the soonest**, so the harness
  structurally could not reach the overlap that produces finding 3.

Third time in one day that a stub made a test prove nothing. The pattern is
always the same: stub the thing the bug lives in.

## What a correct version needs

1. **Per-request retry ownership** — an in-flight guard or a request token, so a
   success can only clear the state for the body it actually sent. Add
   `_rev = Math.max(_rev, j.rev)`.
2. **Fix the 409 baseline first.** Pin `_baseSnapshot` to the server's `j.data`,
   not to the merged state. This is the root of finding 1 and it is a defect in
   its own right, retry or no retry. **Do this one on its own, first.**
3. **Make the 401 retry real** — arm it on successful re-login, or set an
   explicit auth-blocked flag and drop the false toast.
4. **Separate conflict pressure from connectivity failure** — different counter,
   different words.
5. **A persistent indicator, not toasts**, driven by `_savePending`; a recovery
   message when a failed save later lands; a `beforeunload` guard while unsaved.
6. **Split retryable from non-retryable statuses.**
7. **Repair the test**: realistic `setSession`, the real `merge3`, soonest-first
   timers, and new cases for the three findings above.

## Recommended order next time

**Do not start with the retry.** Start with item 2 — the 409 baseline. It is
smaller, it is a live data-loss bug on its own, and until it is fixed any retry
makes things worse rather than better.
