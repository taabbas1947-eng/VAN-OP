# o2s/tests — how the O2S checks are run

These exist because three session notes in a row reported passing suites
(266 -> 313 -> 376 checks) that were never on disk. Nothing could be re-run, so
nothing could be trusted the next morning.

## Run them

```
node o2s/tests/spec06.test.js       #  52 - which price goes on the pack
node o2s/tests/backlog.test.js      #  33 - the print-decision backlog screen
node o2s/tests/batchclose.test.js   # 182 - closing and reopening a batch
```

**267 checks.** Exit code 0 means all passing. No dependencies, no build step,
Node only.

## How they work

`harness.js` pulls the **real function source out of `o2s/o2s.html`** by name and
runs it in a sandbox with minimal stubs. There is no second copy of the logic in
here. If a check passes, it passed against the file that ships.

`backlog.test.js` and `batchclose.test.js` also run against the real
`data/state.json`, so the counts they print are the counts that snapshot actually
produces.

## Three rules these were written under

> When a test fails, look at the real thing before deciding the test is at fault.

Both directions have happened many times. Some checks failed because the test
encoded old behaviour on purpose; others because the code was wrong. Only looking
settles it.

> A passing test is not a review.

The batch work passed 76 checks and was refused by review four times. Tests check
what you thought to check. A reviewer checks what you did not. See
`docs/o2s/parked-shipment-edit/WHAT-WENT-WRONG.md`.

> Do not stub a function into a no-op and then test what it was supposed to do.

`_pe` escapes HTML. It was stubbed here as `String()`, which meant every escaping
check in this file proved nothing at all while reading as though it proved
something. If a stub removes the behaviour under test, the test is decoration.

## Two traps worth knowing about

**`matchBlock()` skips comments as well as strings.** An earlier version did not,
and an apostrophe inside a comment ("Tahir's rule") opened a string that never
closed. The extracted source came back truncated and failed as a syntax error
hundreds of lines from the cause. Prose in `o2s.html` is not code.

**Searching the file for a button is not proof the button appears.** Three
separate changes were built onto screens that do not render, and each time a
check that grepped the source passed. Trace the route a person takes instead.
