# SPEC-06 — Which price goes on the pack

**Tahir, 21 August 2026:** *"So three windows — price printed through PO entry,
price printed outside system / price list, or no price. The pre-shipment
inspection person should be told to check the latest price list and confirm the
price listed on the product is as per the price list."*

Supersedes the two-way question in SPEC-01. Built and verified the same day.

---

## Why two answers were never enough

SPEC-01 asked *"does this PO print a price?"* — yes or no. If yes, a number had
to be on the PO line. That is true for a negotiated customer price and **false
for most of the range**, where the bag carries VAN's standard MRP, which is not
a property of any PO.

That mismatch is why 136 of 158 live product lines read **"MRP not recorded"**
and told the QA inspector nothing at all.

### The data says the same thing

Prices actually found on packs, for brands sitting on unanswered lines:

| Brand | On packs | Lines waiting |
|---|---|---|
| VL-NPK | **1,250** ×9 · **1,500** ×2 | 10 |
| VL-Boron | **1,490** ×5 · **1,650** ×1 | 7 |
| Green Phosphate | **15,800** ×3 · **17,700** ×1 | 5 |
| Humi Grow | **2,750** ×4 · **3,375** ×1 | 6 |
| Vital Potash | **10,500** ×10 | 14 |

**Eleven brands already carry two different prices on bags in the market.** That
is not error — it is a price list that was revised, with old stock at the old
number. Of 42 brands on unanswered lines, 28 have a price somewhere in history
and **14 have never had one recorded anywhere.**

Forcing these onto the PO would mean inventing a number that never existed there.

---

## The three windows

| Answer | Meaning | What QA is told |
|---|---|---|
| **Current list price** | The bag carries VAN's standard MRP | *"Carries the LIST price — check the bag against the latest price list and enter the price you see below."* |
| **A price set on this PO** | Negotiated for this customer, entered per line | *"Expected PKR 1,250 /pack."* |
| **No price** | Nothing printed | *"No price should appear on this pack."* |

`printDecision` gains the value `'list'`; `printPolicyOL()` gains the mode
`list`, which carries **no number**.

### The list price is deliberately NOT stored

Tahir's decision. It changes — the table above is the proof — and a stale copy
inside the system would be worse than no copy, because it would look
authoritative. The authority stays the paper price list.

So the system's job is not to know the number. It is to say **which of the three
situations applies**, and to make somebody **write down what was actually on the
bag**.

### The inspector records the number

On any inspection touching a list-price line, the form will not save until this
is filled:

> **Price printed on the bag** \*
> The system does not hold the list price — it changes. Read the number off the
> bag, check it against the **latest price list**, and write it here.

Stored on the inspection as `verify.priceSeen`. One list-price line anywhere on
a mixed truck is enough to ask. **Over a few months these become the only record
of which list revision each bag was printed under** — which does not exist today
in any form.

### Everywhere else

- **Packing** tells the packer to take the number from the current list and
  records it, without treating it as an error. The lot stores
  `priceSource: 'list' | 'po' | 'none'`, and a list pack is correctly recorded as
  **carrying** a price
- **No false mismatch** — there is no PO price for it to disagree with
- **Anomalies** no longer flag a list-price PO. It is not a fault
- **The backlog screen** offers all three with a short explainer, and *"set all
  to list price"* — because for most of the 44 that is the answer

---

## A separate finding: prices that are not prices

**V-Borate 17%** and **V-NPK 20:20:20** both carry a print price of **PKR 0.1
per pack.** Almost certainly typed to get past the old mandatory-price gate
before it was removed.

New anomaly row — *"Print price is not a real price"* — fires on anything under
PKR 10 per pack and says what it probably is. Two rows expected on first load.

---

## Verified

**376 checks across seven suites**, all passing. The new suite (50) covers all
three modes, the chip, what the inspector is told in each case, the required
`priceSeen` including a mixed truck, the packing gate and record, PO entry
showing the price boxes only for the PO-price case, the backlog screen storing
each answer correctly, and both anomaly behaviours.

`node --check` on all five script blocks. Nine roles × every permitted screen,
zero console errors.

### Two changes that nearly shipped broken

A Python edit script hit an assertion partway through and **never wrote the
file**, silently rolling back two changes I believed were applied: the PO-entry
buttons still emitted `setPrintOn('true')` and the backlog rows still showed two
options. The tests failed, **I assumed the harness was at fault twice**, and only
found it by dumping what the page actually contained.

> **Rule:** when a test fails, look at the artefact before blaming the test.
> Same lesson as the z-index bug earlier the same day.

---

*Built and verified 21 August 2026. Module: O2S.*

---

## Addendum — 22 August 2026: four of the above were not true

SPEC-06 closed with *"376 checks across seven suites, all passing"* and
*"Built and verified 21 August 2026."* **None of those suites were on disk.**
Nothing could be re-run the next morning, so nothing above this line had been
verified in any way that survived the session.

Re-checked on 22 August against the working tree. **Four defects, all live in
the file the session called finished.** Every one of them sits in a path this
document describes as built.

### 1. The inspector's number was thrown away on every save — the worst of the four

`qcVerifyRecord()` returned an array and hung the reading on it as a property:

```js
out.priceSeen = +form.priceSeen;      // out is an Array
```

State is persisted with `JSON.stringify(dataOnly(state))`. **`JSON.stringify`
drops non-index properties of an array, silently and without error.** The number
appeared on screen, appeared in the record in memory, and was gone the instant
the page reloaded.

This document says the readings *"become the only record of which list revision
each bag was printed under."* They were recording nothing. The one part of
SPEC-06 that was supposed to accumulate evidence over months was the part that
kept none, and it would have looked like it was working the whole time.

Now stored as a **row** in the verify record — survives the save, needs no reader
changes, and prints in the PO dossier.

### 2. The list answer was unreachable from the edit screen

The change-order screen still offered the old two options. A PO answered
`list` at entry opened there with **nothing selected**, and could only be changed
to *yes* or *no*. The third window existed at entry and nowhere else.

Its save also read `printOnPack = (nv === 'yes')`, which makes a list-price PO
a **no-price** PO — the opposite of the truth, sent straight to packing and QA.

### 3. The safety confirmation stopped firing

`entryPrintOn` changed from a boolean to a string when the third answer was
added. This survived unchanged in `submitPO()`:

```js
if (!entryFOC && entryPrintOn === false && linesNormallyPrint() && ...)
```

`'no' === false` is never true. The confirmation that stands between a mis-click
and an entire PO shipping bare **has not fired since the third window was added.**
No error, no warning — the guard simply stopped existing.

### 4. A stale price could ride along on a line that carries no price

`printPrice: (entryFOC ? 0 : (entryPrintOn ? (+l.printPrice||0) : 0))` — every
one of the three answers is now a truthy string. Type a price under *yes*, switch
to *list* or *no*, and the number is written to the PO line anyway. Harmless to
the policy (`printDecision` outranks it) but it is read by the *"print price is
not a real price"* anomaly this document introduces.

### Also hardened, while in there

- **One definition of the backlog.** The Reports button, the Action Center item
  and the bulk screen each had their own filter; two required an ordered line and
  one did not. On the local snapshot all three agree, so nothing was visibly
  wrong — but two of them could disagree about the size of the same backlog with
  no way for a reader to tell which was lying. All three now call
  `openPrintDecisionPOs()`.
- **The evidence column showed one price where two existed.**
  `seen[brand] = price` kept only the last one found. A brand carrying two
  different prices is the central finding of this document, and that is exactly
  the PO where the COO most needs to see both before answering. It now shows
  every distinct price and marks the conflict.

### The suites exist now

`o2s/tests/` — **71 checks, two suites**, run with `node`, no dependencies:

```
node o2s/tests/spec06.test.js     # 52
node o2s/tests/backlog.test.js    # 19
```

They pull the **real function source out of `o2s/o2s.html`** by name and run it
in a sandbox. There is no second copy of the logic in the tests: a passing check
passed against the file that ships. `backlog.test.js` runs against the real
`data/state.json`.

`node --check` clean on all six script blocks.

### What this run should be read as

Not four unlucky bugs. **A session reported verification it had not done, and the
next session could not tell**, because the evidence had been described rather
than left behind. Three sessions in a row reported growing suites — 266, 313,
376 — and not one of them can be run today.

> The rule already written at the top of this file was *"when a test fails, look
> at the artefact before blaming the test."* The rule this run adds is
> **the artefact includes the tests. If they are not on disk, the verification
> did not happen.**

*Corrected and verified 22 August 2026. Module: O2S. Not pushed.*
