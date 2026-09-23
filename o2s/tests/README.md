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
node o2s/tests/shortclose.test.js  #  39 - short-closing a PO line
node o2s/tests/shortcloseactions.test.js
                                   #  44 - request, approve, reject, reopen, and the UI
node o2s/tests/rolemodel.test.js   #  84 - role names as the join key, and the
                                   #       built-in lock that keeps them stable
node o2s/tests/closedshortbucket.test.js
                                   #  71 - Closed short as the eighth stage, and
                                   #       what "open" means once it exists
node o2s/tests/shortclosereport.test.js
                                   #  68 - shortfall by reason and by month
node o2s/tests/roletitles.test.js  #  54 - job titles, and that a title is never
                                   #       allowed to become a join key
node o2s/tests/warehousesplit.test.js
                                   #  43 - Supply Chain splits three ways, and
                                   #       what step two has still to remove
node o2s/tests/dispatchgrants.test.js
                                   # 128 - dispatch by grant, not by which screen
                                   #       you happen to be standing on
node o2s/tests/dispatchauthority.test.js
                                   #  32 - Saad approves dispatch; the Plant
                                   #       Manager is no longer cover
```

**1,042 checks in the suites listed above.** Running every `*.test.js` in this
folder together, with `data/state.json` and both `_before-*.html` fixtures in
place, gives **8,081**. Exit code 0 means all passing. No dependencies, no build step,
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

**Test the reach of a guard, not just its logic.** `shortclose.test.js` asserts
which functions call `shortCloseRefusal()` **and which must not** — the shift log
and Data Fix are named as deliberately unguarded, because blocking an honest
record of work that physically happened teaches people not to record it. Four
faults in `o2s.html` have been the same shape: one rule applied in two places and
not a third. A guard with no reach test is the fifth waiting to happen.

**Default parameters silently swallow an `undefined` case.** A check written as
`shortCloseAgainstUs(closed(undefined))` fired the fixture's own default and
tested `customer_cancelled` instead of the no-reason case it was named after. It
passed, for the wrong reason. Build the awkward case by hand.

**Account for the whole delta, not just your own suite.** Adding three rights
moved the total by 88 while the new suite was only 28: `authmodel.test.js` loops
every role against every right, so a new right adds checks there too
(5,471 -> 5,531). That is explainable, and it was checked rather than assumed —
an unexplained delta is the only signal that something else moved.

**A new right has to be declared, not just added.** `authmodel.test.js` crashed
until the three short-close codes were registered in `NEW_RIGHTS` (with proof
their handlers had no caller in `_before-lot.html`) and pinned in `WANT`. That is
the freeze doing its job: a right cannot enter the catalogue without somebody
writing down what it replaces, or stating that it replaces nothing.

**Assert the route a person takes, not the presence of a string.** Three separate
changes in `o2s.html` have been built onto a screen that does not render, and
each time a check that grepped the whole file passed. The short-close UI checks
pull `actionItems`, `openShortClose`, `openShortCloseReview` and
`renderShortClose` out by name and assert inside each one — that My Actions
raises it to the Plant Manager, that a decided close raises nothing, and that the
review modal hides Approve from the person who asked for it.

**Confine a spelling check to the field that carries the name.** The first run of
`rolemodel.test.js` read every quoted string inside `RIGHTS` and reported
`dept:'production'` and `dept:'supply-chain'` as misspelled roles. They are
department ids — a different namespace that squashes to the same letters. A check
that cries wolf on correct code is switched off within a week, so it now reads
only the values inside `roles:[…]`, `owners:[…]` and `FIELD_OWNER`.

**Prove a new tripwire can go red.** `rolemodel.test.js` guards a failure with no
symptom: a misspelled role name never matches, raises nothing, and shows up
months later as a person saying "I can't see that screen". Three mutations were
run against a scratch copy before it was trusted — misspelling a name in a
screen's owners (4 failures), adding an unfiled role to live state (4), and
removing the built-in rename lock (2). A tripwire nobody has seen fire is a
guess.

**Write down what a lock costs.** The ten built-in role names are spelled out as
**523 string literals** in `o2s.html`, across `SCREENS.owners`,
`RIGHTS[].legacy`, `FIELD_OWNER` and hundreds of inline gates. That number is why
`renameRole` and `archiveRole` refuse a built-in, and why HR's job titles have to
arrive as new roles rather than as renames of the old ones. The check is a floor,
not an exact count, so unrelated edits do not make it lie.

**Name the functions, do not count the occurrences.** "Open" was spelled
`b!=='Delivered'` in about twenty places. A reach test that counted how many were
left would have gone green on the wrong twenty. `closedshortbucket.test.js`
instead names the functions that must ask `bucketOpen`/`orderOpen`, names the
line-level lists that must skip a closed line, **and names the one list that must
stay short-close blind** — cleared stock, because a closed line's already-packed
stock still ships. The check that something must NOT change is the one that stops
a later "fix".

**A derived constant is pulled by its line, not by brace matching.**
`PIPELINE_BUCKETS` is `BUCKETS.filter(...)`, not a literal, so `grabTopVar` cannot
see it. That is deliberate in `o2s.html` — a derived list cannot drift out of step
with the one it comes from — so the test reads the whole line instead. The first
run crashed with "not found: PIPELINE_BUCKETS", which is also the proof the suite
discriminates: it cannot pass against a file that has not had the change.

**Check the fixture before blaming the app.** Two checks expected a closed line to
fall through to `Production`. The fixture had 60 of 100 already dispatched, so the
true answer was `Shipment`. The app was right both times. A failing expectation is
a question, not a verdict.

**`matchBlock` slices from the index it is GIVEN, not from the brace it finds.**
`grabTopVar` depends on that — it is what keeps `var NAME =` in front of the
block. Pulling one entry out of `RB_DATASETS` the same way therefore hands back
`shortclose:{…}`, and the sandbox dies on the colon trying to evaluate a labelled
statement. Slice from the first `{` when you want the value rather than the
declaration.

**A report belongs in the dataset registry, not in a new screen.** "Shortfall by
reason and by month" looks like two reports and is actually two dimensions.
`RB_DATASETS` already supplies grouping, the period bar, summarise, chart and
export, so the whole feature is one entry of about sixty lines — and the day
somebody wants it by client instead, there is nothing to write.

**Make the default view the honest one.** A reopened short close is still a row,
but its quantity sits in a separate `reopened` measure and its `shortfall` is
zero. That way summing the shortfall column with no filter applied is correct.
A report whose headline number is only right once you remember to exclude
something is a report that will be quoted wrong.

**Assert a literal's absence across the whole file, not a window.** The check
that the COA had stopped printing `AQCM` read 1400 characters from the first
`<div class="signs">`. There are **five** signature blocks in `o2s.html` and two
of them render a COA — the printed document and the on-screen form. The window
saw one, so the form kept the old literals and the suite went green on half the
change. A string that should exist nowhere is asserted nowhere.

**Test that the new thing cannot become an authority.** `roletitles.test.js`
spends its last section proving a negative: no gate consults a title, and the
title functions cannot grant anything. The layer's whole safety rests on titles
being display-only, and that is not something the feature's own checks would ever
notice going wrong — a title used as a join key would pass every functional test
in the file while quietly creating a second authority table nobody tests.

**Run the whole suite AFTER the changelog, not before it.** Pass A was committed
with a failing check. The order was: wire the change, run the suite (green), then
add the BUILD_ID and changelog entry, then run only `buildid.test.js`. But the
changelog entry quotes the string the change retired — "Assistant
Analyst/Analyst" — and `roletitles.test.js` had asserted that string existed
nowhere in the file. The suite was green when it ran and red by the time it was
committed. The changelog is part of the change; the last thing before a commit is
always the full suite.

**"Must not exist" needs an exception for the note that says it was removed.**
The check now asserts the literal survives in exactly one place and that the
place is inside `var CHANGELOG`. A rule with no room for its own documentation
either goes red for an honest reason or gets weakened until it means nothing.

**Pin a deliberately half-done state, and name the edit that finishes it.**
`warehousesplit.test.js` has a whole section of `STEP 2 PENDING` assertions:
Supply Chain still owns the four dispatch rights, KAM still has New PO Entry.
They are true today on purpose — nobody holds the Warehouse role and nobody in
Finance has a login, so removing either would stop trucks leaving the plant or
stop POs being raised. Each assertion carries the exact edit that finishes it, so
when somebody makes that edit the check fails and points at itself. A half-done
change that nobody wrote down is indistinguishable from a finished one six weeks
later.

**Splice at the bracket, not at the text.** Several `SCREENS` entries have byte
-identical `owners` arrays. Adding a role by matching the array's text hits the
wrong screen; the count assertion caught it on the first try. Find the entry by
its `{id:'…'`, then find ITS closing bracket.

**Measure the alternative before recommending it.** The plan for giving the new
Warehouse role dispatch was one tick — `edit` on Shipments in the access matrix,
which `_canEditOn` consults before the owners list. Running the real gate showed
that tick also hands over `rm.check`, `rm.receive` and `pr.close`, because a
`canEdit` right asks about the screen the person is **standing on**, not the
screen the job belongs to. The recommendation was already given before it was
measured. Measuring took one script; the advice was wrong for an hour.

**A right leaves the freeze only by being pinned somewhere else.**
`authmodel.test.js` compares every right, role and screen against a written-down
record of the old rule. Eight codes deliberately no longer match it, so they are
declared in `RULED_CHANGE` — with who ruled it and the exact new answer, asserted
on every screen. Skipping a code without pinning its replacement turns the freeze
into a list of things nobody checks any more.

**When a defect class is cured, assert the cure, not just the fix.** All seven
`canEdit` rights are now live, so not one of them is still answered by "which
screen are you on". That is pinned as its own check — `none of them is still
decided by it` — and so is the shipped Authorisation card having no loophole left
to warn about. Both go red if somebody ever un-flips them.

**Restore the precondition rather than deleting the test.** Twenty-five checks
exercised machinery built to manage a right's transition to live, all written
against Supply Chain's rights. Going live removed the condition they demonstrate.
They now build their sandbox with `mk(role, true)`, which un-flips those eight
codes and re-seeds — the old world, on purpose — while a separate check asserts
the new one. Deleting them would have lost the proof that the machinery works at
all, and the next department has still to go through it.

**A warning that is always on is a warning nobody reads.** `rightsFreezeCheck()`
compared grants against the legacy answer for every right, live ones included, so
the moment `order.acknowledge` went live it listed nine roles as drifting from a
rule that no longer decides anything — for ever. It now skips live rights and
answers the question it was built for: what would change if you flipped the ones
still waiting.

**A frozen record cannot be asked to agree with a later decision.** Two checks
compared live settings against a right's `legacy` block: the drift card, and the
one asserting that `acEscalation`'s manager matches the right's `alsoOn` roles.
Once dispatch escalation moved to Supply Chain, `alsoOn` still recorded the Plant
Manager — and both were correct, because `alsoOn` describes where the button used
to be reachable from, not who covers it today. Live rights are now skipped in
both. A record of the past that must keep matching the present is not a record.

**Say what a change costs in the source, not only in the commit message.**
Separation rule 4 reads "the person who loads does not release", and Saad now
holds `shipment.load` and approves the release. In practice the warehouse loads
and he approves, which is the shape the rule wants — but nothing stops the same
person doing both, and the rule cannot fire because `shipment.release` was never
added to `RIGHTS`. That tension is written into `o2s.html` beside the grant maps
and asserted by `dispatchauthority.test.js`, so it reads as a known cost rather
than something nobody noticed.

**Moving a name in a sign-off is a table entry, not a rewrite.** `rights.test.js`
keeps a list of the gates that must stay `hardRole` — sign-offs on somebody
else's work, which must never follow the access matrix. Moving three of them from
the Plant Manager to Supply Chain failed that list by name, which is the list
doing its job: the check is that they stayed hard, and the name is the part that
was allowed to change.
