# o2s/tests — how the O2S checks are run

These exist because three session notes in a row reported passing suites
(266 -> 313 -> 376 checks) that were never on disk. Nothing could be re-run, so
nothing could be trusted the next morning.

## Run them

```
node o2s/tests/spec06.test.js       #  53 - which price goes on the pack
node o2s/tests/backlog.test.js      #  33 - the print-decision backlog screen
node o2s/tests/batchclose.test.js   # 182 - closing and reopening a batch
node o2s/tests/qagate.test.js      #  16 - the pre-shipment inspection gate
node o2s/tests/buildid.test.js     #  12 - BUILD_ID vs the changelog
node o2s/tests/rmqty.test.js       #  22 - raw-material quantity entry
node o2s/tests/psi.test.js         # 123 - the pre-shipment inspection report,
                                   #       and what may go on a customer's copy
node o2s/tests/qagate.test.js      #  16 - the pre-shipment inspection cut-over
node o2s/tests/focprice.test.js    #  24 - FOC samples and price-on-pack
node o2s/tests/gatepassqa.test.js  #  14 - a Gate Pass needs the inspection
```

**479 checks in the suites listed above.** Running every `*.test.js` in this
folder together, with `data/state.json` and both `_before-*.html` fixtures in
place, gives **7,280**. Exit code 0 means all passing. No dependencies, no build step,
Node only.

## How they work

`harness.js` pulls the **real function source out of `o2s/o2s.html`** by name and
runs it in a sandbox with minimal stubs. There is no second copy of the logic in
here. If a check passes, it passed against the file that ships.

`backlog.test.js`, `batchclose.test.js` and `psi.test.js` also run against the
real `data/state.json`, so the counts they print are the counts that snapshot
actually produces.

`qagate.test.js` exists because the pre-shipment inspection had never once run.
Measured on live data on 22 Sept 2026: **215 of 215 shipments carried
`qa:{pass:true,closed:true}` and not one carried a real inspection** — both
dispatch paths wrote that stub at creation, so QA was never asked (the task
needs `qa === null`), and the release gate added on 21 Aug had never blocked a
truck because the stub satisfied it. On the same data **80 of 108 trucks left
before the material on them had been inspected at all**. From the 23 September
cut-over a new shipment starts genuinely pending; anything dated earlier keeps
its old status so nothing on the road is dragged back. This suite pins the
cut-over date, both dispatch paths, and every gate keyed off `qa`.

`buildid.test.js` exists because a whole day's work shipped with `BUILD_ID`
still reading `2026-09-04a`. An open tab polls the served file and raises the
"A newer version is available" banner only when that value differs from the one
it loaded with — so an un-bumped BUILD_ID means a tab left open across a push
keeps running the old code and nobody is told. Every behavioural change that day
was pinned by a test; the one line deciding whether anyone found out was pinned
by nothing. **Bump BUILD_ID with every deploy and keep it equal to the newest
CHANGELOG `ver`** — this suite fails if they drift.

`rmqty.test.js` covers the quantity boxes on RM Check and Confirm RM received —
the "it says add 1 every time" complaint. The widths and the lost focus were
measured in a browser, because that is where they live; what the suite holds is
the arithmetic (a typed 30,000 is 30,000; a negative can never be stored; a
top-up can never clear more than was ordered), that "% of order" is a percentage
of the **ordered** quantity and that the top-up dialog now says so in the option
itself, and that the markup which collapsed the box to 26px is gone.

`psi.test.js` renders finished documents **as strings** and reads them, so it
checks the output rather than the source. It covers three rulings, each of which
cost a real defect to find:

- **Scope.** A consignment certifies the material on that truck. The join key is
  the batch number printed on the bag; matching on PO+product, or on the internal
  batch, each put another consignment's material on a customer's certificate.
  Reverting the key fails the suite with 34 leaks.
- **What may appear on a customer's copy** (Tahir, 22 Sept 2026): no price in any
  form — including the figure the inspector reads off the bag, which the pack-price
  check records as a number — no internal production batch on the Delivery Challan,
  Gate Pass, PO Confirmation or the report, and no dispatch approver.
- **How the paper divides.** The report is the first document here that runs past
  one page. A4, headings that travel with their content, column headings repeated
  on a split table, rows never cut in half, and a running footer identifying every
  sheet. Where the breaks land was settled by rendering a real PDF and looking at
  it; the suite holds the rules that produced it.

- **Which document is which.** Both `printInspect` and `printPSI` are titled
  "PRE-SHIPMENT INSPECTION REPORT" and both are exactly that; they differ by
  **content**. `printInspect` is the inspection history of a whole PO and
  nothing else. `printPSI` is the per-consignment copy that stitches in the
  certificates of analysis, the closing certification block and a customer
  signature line. The suite fails if the PO-level record starts stitching, or
  if the consignment copy stops.
- **What goes on the customer copy** (Tahir's rulings, 22 Sept 2026): full lab
  results including specifications; every inspection check listed rather than
  summarised; mfg and expiry per line; vehicle and seal. **Not** the inspector's
  free-text remarks — written for the floor, unreviewed — which stay on the
  PO-level record. Plus a complaint line carrying the report reference and VAN's
  published contacts.
- **No rupee figure on any printed inspection sheet.** SPEC-01 rule 6 still puts
  what the pack was *required* to carry on the PO-level sheet — that is what
  makes it evidence of a comparison — but as a rule ("a price was required",
  "no price should appear"), never as an amount, and the reading the inspector
  took off the bag prints as "recorded". `qcExpect()` is unchanged: the two
  capture screens still show the inspector the figure to check against.
  **This supersedes the SPEC-06 check "the dossier prints a number instead of an
  em dash"**, whose intent — a recorded reading must not look like nothing was
  read — is kept and still enforced.

Matching on batch numbers is **token-exact** on purpose: pack batch `VMG10412`
*contains* internal batch `MG10412`, and a substring search calls that a leak
when it is not.

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

**A crash is not a pass.** Running the suites in a loop and reading the last line
of each hid six crashed files behind a total that looked healthy — missing
fixtures, not real failures, but the tally reported 274 where the truth was
7,242. Match on the `N passed, M failed` line wherever it appears, count anything
without one as a crash, and report crashes separately. A suite that cannot run is
not a suite that passed.

**Run the new suite against the unmodified file first.** `focprice.test.js`
crashes on the pre-change `o2s.html` because the function it tests does not exist
yet. That is the proof the test discriminates. A new test that passes before the
change tests nothing.
