# o2s/tests — how the O2S checks are run

These exist because three session notes in a row reported passing suites
(266 → 313 → 376 checks) that were never on disk. Nothing could be re-run, so
nothing could be trusted the next morning.

## Run them

```
node o2s/tests/spec06.test.js     # SPEC-06 — which price goes on the pack
node o2s/tests/backlog.test.js    # the print-decision backlog screen
```

Exit code 0 = all passing. No dependencies, no build step, Node only.

## How they work

`harness.js` pulls the **real function source out of `o2s/o2s.html`** by name
(brace-matched) and runs it in a `vm` sandbox with minimal stubs. There is no
second copy of the logic anywhere in here — if a check passes, it passed against
the file that ships.

`backlog.test.js` also runs against the real `data/state.json` snapshot, so the
backlog count it prints is the count that snapshot actually produces.

## The rule these were written under

> When a test fails, look at the artefact before blaming the test.

Two of the SPEC-06 checks failed on 22 Aug because the *test* encoded the old
broken behaviour on purpose, and two failed because the *code* was wrong. The
only way to tell them apart was to go and read the file.

## Paths

Both files resolve `o2s/o2s.html` and `data/state.json` from their own location
(`o2s/tests/`), so they run from anywhere:

```
cd E:\VAN-OP && node o2s/tests/spec06.test.js
```

Nothing to configure. If the tests move, the two constants at the top of
`harness.js` are the only thing to change.
