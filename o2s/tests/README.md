# o2s/tests — how the O2S checks are run

These exist because three session notes in a row reported passing suites
(266 -> 313 -> 376 checks) that were never on disk. Nothing could be re-run, so
nothing could be trusted the next morning.

## Run them

```
node o2s/tests/spec06.test.js     # 52 checks - which price goes on the pack
node o2s/tests/backlog.test.js    # 33 checks - the print-decision backlog screen
```

**85 checks.** Exit code 0 means all passing. No dependencies, no build step,
Node only.

## How they work

`harness.js` pulls the **real function source out of `o2s/o2s.html`** by name
and runs it in a sandbox with minimal stubs. There is no second copy of the
logic in here. If a check passes, it passed against the file that ships.

`backlog.test.js` also runs against the real `data/state.json`, so the backlog
count it prints is the count that snapshot actually produces.

## Two rules these were written under

> When a test fails, look at the real thing before deciding the test is at fault.

Both directions have happened. Two checks failed because the test was written to
document old behaviour on purpose; two failed because the code was wrong. Only
looking settles it.

> A passing test is not a review.

85 green checks did not stop a shipment change from double-counting delivered
quantities. See `docs/o2s/parked-shipment-edit/WHAT-WENT-WRONG.md`. Tests check
what you thought to check. An independent reviewer checks what you did not.

## One trap worth knowing about

`matchBlock()` in `harness.js` skips **comments** as well as strings. An earlier
version did not, and an ordinary apostrophe inside a comment ("Tahir's rule")
opened a string that never closed. The depth count went out of step, the
extracted source came back truncated, and it surfaced as a syntax error hundreds
of lines from the comment that caused it.

Prose in `o2s.html` is not code. The extractor has to know that.
