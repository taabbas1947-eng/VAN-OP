# The access matrix should mean what it says

VAN / O2S. 22 August 2026. Four questions from the COO, answered with what is
actually in the file.

> *"When we have made the authority and rights matrix, then every seeded right
> should be catered by the matrix. For example, I have given access of New PO
> Entry to the Finance but he couldn't add the PO as it was gated to KAM only.
> What is the purpose of access matrix then?"*

---

# 1. Why Finance could not add a PO

You are right, and the app agrees with you in writing. The comment above
`accessLevel` says:

> *"The access matrix is authoritative: each role×screen is No access / View /
> Edit."*

It is not. Underneath the matrix there are **115 role decisions hard-coded in
the file that the matrix cannot reach**:

| | Count |
|---|-------|
| `hardRole([...])` gates | **56** |
| Raw `state.role === '...'` checks | **59** |

Your Finance example is one of them. `submitPO()` is `hardRole(['KAM'])`, and
`validate()` disables the submit button with *"Switch role to KAM to enable
submit."* So Finance gets the screen, gets the form, and gets a dead button.

**What the matrix governs today is doors. What it does not govern is what you can
do once you are through one.**

## The 56 hard gates, sorted by what they actually are

| Role | Gates | Where |
|------|-------|-------|
| Production | 28 | doPack, submitProdQty, openBatchModal, setBatchNo, submitShiftLog, openDivert, submitDivert, openRework, submitRework, openReconcile, saveReconcile, screenProd, prodStageList … |
| Plant Manager | 14 | approveDC, rejectDC, approveRelease, coaDeviation, coaRework, doReopenBatch, openReopenBatch, screenQC … |
| KAM | 7 | **submitPO, validate**, screenEntry, addDealer, custSave, screenDealers |
| COO | 5 | addMaster, editMaster, delMaster, screenAdmin, pmCanEdit |
| AQCM / QCM / Lab Rep / QA Inspector | 9 | coaReview, coaApprove, renderCOAModal, screenQC |

Sorting them by what they protect, not by role, gives three kinds — and the
answer is different for each.

### Kind A — doing your own job. About 40 of the 56. **These should follow the matrix and do not.**

Packing a batch. Entering production. Submitting a PO. Adding a dealer. Setting a
batch number. Logging a shift. These are *operating a desk*. If you grant
somebody Edit on the Production screen, they should be able to work it. If you
grant Finance Edit on New PO Entry, Finance should be able to enter a PO.

There is no safety argument for hard-coding these. They are hard-coded because
the app was written role-first and the matrix was added later.

### Kind B — signing off on somebody else's work. About 12 of the 56. **These must NOT follow the matrix.**

- `coaReview` (AQCM) → `coaApprove` (QCM) → `coaDeviation` (Plant Manager): the
  lab certificate chain. Three different people sign in sequence. If one grant
  could unlock all three, the chain is decoration.
- `approveDC`, `rejectDC`, `approveRelease`: releasing a loaded truck.
- `doReopenBatch`: undoing a close.

**This is the 30 July incident.** Supply Chain Officer was given Edit on the
Shipments and Lab QC screens for an ordinary reason, and — because `canEdit()`
lets a screen grant win — that account could approve and release delivery
challans, and would have been able to sign Lab QC certificates. The grant was
made for one purpose and silently bought another.

So the rule is not *"the matrix should control everything."* It is:

> **The matrix must control everything except a small, named list of sign-offs —
> and it must SHOW you that list, so it never lies about what it can do.**

### Kind C — screen rendering. The rest. **Pure duplication.**

`screenProd`, `screenEntry`, `screenQC`, `screenDealers`, `screenAdmin` all
re-decide who may see a screen, next to a matrix that already answers exactly
that question. Two answers to one question is how they drift apart.

## What to build

1. **Kind A and Kind C become matrix-driven.** `screenEditOK('prod')`,
   `screenEditOK('entry')` and so on, replacing the role names. Your Finance
   grant then works, and every future grant works, without a code change.
2. **Kind B stays hard-coded — and becomes visible.** In Users & Access, those
   rights appear as **locked rows with a reason**: *"Approve a delivery challan —
   Plant Manager only. Sign-off rights cannot be granted here, because the person
   who releases a truck must not be the person who loaded it."* The matrix stops
   lying by omission. You can see the whole authority map in one place, including
   the parts you deliberately cannot buy.
3. **One helper, `mayDo('packing.close')` style**, so a right is asked for once
   and answered in one place — instead of 115 answers scattered through the file.

That third point is what makes this survivable. Today a right lives in whichever
function happens to check it; a rule in two places is the fault that has bitten
this project repeatedly, most recently four hours ago.

---

# 2. Your question 3 — the bulk "set all to no price" button

**What I suggest, and why.**

Entering a single PO, the app already protects you. `submitPO` refuses a "no"
answer without asking: *"these products normally DO carry a price… Is that
right?"* — driven by the products' own printing history.

The bulk screen has no such question, and it has a **"Set all to no price"**
button sitting directly above 21 unanswered POs. Two clicks sets all 21. Each one
tells the packer not to print a price AND inverts the QA inspector's later check
— a bag that *does* carry a price becomes the failure. One person, two clicks,
21 safety checks turned inside out.

**Three things, smallest first:**

1. **Delete the "Set all to no price" button.** Keep "set all to list price" and
   "set all to price on this PO" — those are recoverable and they are the common
   answers. Make "no" a deliberate per-PO click. It is the only answer that
   disarms a control, so it should cost one second of attention each.
2. **Put the single-PO confirmation into the bulk save.** Before writing, count
   the POs being set to "no" whose products have carried a printed price before,
   name them, and require an explicit confirm: *"4 of these 11 contain products
   that normally carry a printed price — Max Humic, Enroot, Tornado, VL-NPK. Set
   them to no price anyway?"*
3. **Cap a single bulk save.** If more than, say, 10 POs are being answered at
   once, say so and ask. Not because 21 is wrong, but because a screen that can
   change 21 records in one click should say the number out loud first.

The screen already gets this right in one respect worth keeping: its suggestion
engine *never* proposes "no", because you cannot prove a negative from silence.
The button undoes that care.

---

# 3. Your question 4 — two people answering the same PO

**What happens now.** Ali (KAM) answers a PO as "list price" and saves. Fahim
already has the bulk screen open — and background sync is deliberately paused
while a modal is open, so his copy still shows that PO as unanswered. He answers
"no" and saves. **His answer wins, silently.** Ali is never told. The field-level
merge keeps whichever side changed the value, and both people's action-log rows
say *"first answer"*, so the register asserts two different first answers for the
same PO.

**What I suggest, in the order I would build it.**

1. **Remember what you were shown.** When the screen opens, record each PO's
   current answer (almost always blank). On save, write only where the stored
   value still matches what is there now. Anything that moved underneath is
   skipped and reported: *"PO 22032 was answered by Fahim as 'no price' while you
   were working. Yours was not applied."* Nobody's work is lost silently, which
   is the actual harm.
2. **Check against fresh data, not the stale copy.** The guard in point 1 reads
   local state, and local state is stale by construction while the modal is open.
   So the save must refresh first, or take the conflict and re-check after the
   merge. This is the part with real work in it — and it is the same underlying
   issue as the signature lock on the printing slip, so the two should be solved
   once, together, rather than twice.
3. **Log what actually happened.** *"First answer"* when the field was blank;
   *"changed from list price to no price"* when it was not. One line of code, and
   it makes the register truthful.
4. **Show who answered it, on the row.** The screen already stores
   `printDecisionBy` and `printDecisionAt`. Putting them on the row means the
   second person sees the answer before they type over it.

Point 4 alone prevents most of this in practice, and it is the cheapest thing on
the list.

---

# 4. Removing Data Fix

> *"Data Fix should be removed from system as we are building a universal edit
> trail and an app-wise, process-wise edit feature, and each function head has
> some right to edit."*

**Agreed, and the evidence for it is stronger than tidiness.**

Data Fix has five write paths:

| Function | What it does | Status |
|----------|--------------|--------|
| `dfSubmitCorrect` | corrects a PO | **duplicate** — the correction ledger already does this, and this copy has **no permission check at all** while its five siblings have one |
| `dfSubmitPO` | creates a missing PO | backfill |
| `dfSubmitProduction` | creates a missing production entry | backfill |
| `dfSubmitPacking` | creates a missing packing record | backfill |
| `dfSubmitShipment` | creates a missing shipment | backfill |

**The problem is not that Data Fix exists. It is that Data Fix skips the checks
the real screens enforce.** `dfSubmitPacking` writes a packing record with no
printed price, no price verification, no batch, no manufacturing or expiry date,
no lab-approval check, and a date field with no future-date guard — none of
which the real packing screen would allow. It is not a repair tool. It is a way
round every rule on the packing screen, and Production holds edit rights on it.

## What replacing it takes

The correction ledger (`CORRECT_ENTITY`) already registers seven record types —
order, order line, packing lot, shipment, batch, COA, inspection — with amend,
reverse, supersede and backfill, a reason code on every change, and a register
you can read.

- **`dfSubmitCorrect` can be deleted today.** It is duplication.
- **The four backfill paths need a home in the ledger.** The ledger amends
  records that exist; these create records that should exist and do not. That is
  a real piece of work: each one has to land through the same validation the
  normal screen applies, so a backfilled packing run is indistinguishable from a
  properly entered one except for its reason code.

## And this is where your matrix point lands

"Each function head has some right to edit" is exactly the Kind A / Kind B split
above. The ledger already carries per-record-type role lists — `packingLot` can
be amended by Production and COO, `orderLine` by KAM and COO, and `coa` and
`inspection` are supersede-only because they were true when they were signed.

**Those lists should come from the matrix**, one row per record type, so you can
give the Production Manager the right to amend a packing lot without touching
code — and so the COA row can sit there **locked**, with the reason written next
to it.

That is the whole answer to "what is the purpose of the access matrix then": it
should be the one place the authority map lives, including the parts of it that
are deliberately not yours to move.

---

# Suggested order

1. **One helper for rights**, and convert the Kind A gates to it — starting with
   `submitPO`, so your Finance grant works.
2. **Show the locked Kind B rights** in Users & Access with their reasons.
3. **The bulk "no price" fixes** — delete the button, add the confirmation.
4. **The concurrent-answer fixes** — show who answered, log honestly, then the
   fresh-read check alongside the slip's signature lock.
5. **Delete `dfSubmitCorrect`.** Then move the four backfills into the ledger,
   with the real validations, and remove the Data Fix screen.

Each through the reviewers, one at a time. Item 1 is the one that answers your
question, and it is the biggest — 115 decisions is not a small sweep, and the
whole point is that it must not go in half-done.

---

# 22 August — the KAM field is doing two jobs, and neither well

> *"KAM's core feature was to track which KAM is managing which client. KAM is
> not always the person who is adding a new PO. What if Tahir is KAM for Syngenta
> but the new PO entry is made by Ismael?"*

Right, and the data already agrees with you.

## What is there now

**The customer master already carries a `kam` field.** 8 of 21 customers have it
filled — Arysta, LCI and Maxim all point at Tahir Abbas; BKK points at Muhammad
Ali. That is account ownership, stored where it belongs.

**And the order carries its own `kam` as well**, typed from a dropdown on every
PO: 19 orders say Tahir Abbas, 2 say Muhammad Imran.

So the same fact is stored twice, and one of the two is re-typed by hand on every
order. **No client currently shows two different KAMs across its POs**, so the
duplication has not bitten yet — but nothing prevents it, and once someone else
enters the PO it becomes wrong immediately, which is your point.

## Two fields, two jobs

| Field | What it means | Where it comes from |
|-------|---------------|---------------------|
| **Account KAM** | who manages this client | the **customer record** — inherited onto the order, not typed |
| **Entered by** | who created this PO | the **login** — automatic, never typed, never editable |

The order stops asking "which KAM?" and starts showing "Account KAM: Tahir Abbas
(from the customer record)". If the account moves to another KAM, it moves once
on the customer and every future order follows.

**Today the order has no "entered by" field at all.** Who really created a PO
exists only in the action log, not on the record and not on any document.

## The customer-facing document

The PO Confirmation currently prints **"Prepared by — KAM"** with the dropdown
value. If Ismael enters a Syngenta order, that document tells Syngenta it was
prepared by Tahir. It should read:

```
Account KAM     Tahir Abbas
Prepared by     Ismael  ·  Finance  ·  22 Aug 2026
```

## The migration is unambiguous

13 of 21 customers have no KAM on the master. Their orders do. Since **no client
has conflicting KAMs across its POs**, `customer.kam` can be filled from the
orders with no judgement calls and no ambiguity — then the order-level field
becomes inherited rather than entered.

## Why this belongs in the authorisation redesign

It is the same mistake in a different place: **one field carrying two meanings
because the model had nowhere to put the second one.** "Production" is a
department pretending to be a role; "KAM" is an account owner pretending to be an
author. Both get fixed by naming the thing you actually mean.
