# SPEC-01 — Make the print price visible and verifiable

**Fixes [Fault 1](FAULT-REGISTER.md#fault-1--the-print-price-is-written-then-hidden).**
Serves intent 4: *nothing leaves the factory unless it meets quality, packing,
**price as per PO**, batch #, mfg and expiry.*

---

## The principle

> **A price that only one person can see is not a control. It is a note.**
>
> **And a price is not compulsory — the decision about it is.**

The print price is set by the KAM from the client's PO and printed on packs
that go to the market. Between those two points it currently passes through
production, packing, QA and dispatch — and none of them can see it. This spec
makes it visible at every one of those points and verified at the last one.

---

## Rule 0 · A price is not compulsory — the *decision* is

**Corrected 2026-08-21 after Tahir's review.** Some clients do not want any
price printed on the bag. A PO with no print price is therefore a **legitimate
state**, not a gap, and must never be flagged as an error. Doing so would put a
standing false alarm on every line of those customers, which
`MODELING-GROUND-RULES.md` forbids outright.

What must be enforced is not *a price on every PO* but *a recorded decision on
every PO*, and — where a price does exist — that it is visible, checked and
verified by everyone in the chain.

The decision is **already stored**: `order.printOnPack` is written at PO entry
from the "Print price on pack" tick (`screenEntry` L2544 → the order object at
L2681). Nothing new needs capturing at PO level. What was missing is that
nothing downstream ever read it.

### The four states

| State | Condition | How it must read |
|---|---|---|
| **priced** | `printOnPack === true`, price set | `MRP 1,250 /pack` — amber. Everyone checks against it |
| **no-print** | `printOnPack === false` | `No price on pack` — **grey and calm.** A correct, deliberate state |
| **missing** | `printOnPack === true`, no price | `MRP not set` — red. This is the only real gap |
| **not specified** | no flag at all | `Print price not specified` — grey. Legacy POs and every line from the opening-PO import (which hard-codes `printPrice: 0`, L2170). We cannot know, so we do not guess |

A fifth, softer case: no flag, no price, but the brand has carried a printed
price before (`recallPrintPrice(brand) > 0`) → `MRP not recorded`, amber
outline. Worth asking about, not worth blocking.

> **Status: BUILT 2026-08-21.** `printPolicy()` / `printPolicyOL()` /
> `mrpTag()` / `mrpTagFor()` in `o2s.html`. All five states verified in a
> headless browser.

### The check inverts for a no-print PO

This is the part that is easy to miss. Where the PO says *no price*, the QA
failure is **a price appearing on a bag that should carry none** — which is
just as much a market problem as a wrong price. The inspection panel says so
explicitly, and flags it red if the packing lot recorded a price against a
no-print PO.

> **Status: BUILT 2026-08-21.** `mrpCheckHtml()` handles the inversion.

---

## Rule 1 · Packing must not author the PO's price

Today the packer's typed value is written back onto the PO line when the PO has
none:

```js
// doPack L4312 — and the same at L4035 (divert) and L4264 (PO-direct pack)
if(l.printPrice==null||l.printPrice===''){ l.printPrice=ppx; }
```

**Remove this.** Packing must never author the PO's price. Replace with,
keyed on the states in Rule 0:

| State | Packing behaviour |
|---|---|
| **priced** | Show it, read-only. The operator confirms it matches the artwork; they do not type a number |
| **no-print** | Pack normally. Record `printPrice: null` and `printOnPack: false` on the lot so the intent travels with the material. **No prompt, no warning, no friction** |
| **missing** | This is the only case that should hold anything up — and even then, prefer a **warning plus a one-click "Ask the KAM"** over a hard block. Blocking the floor because an office field is empty moves the cost to the wrong person. Escalate hard only if the same line is packed a second time still unpriced |
| **not specified** | Pack normally, but raise the Action Center item in Rule 7 so someone records the decision once, for good |

The packing lot keeps recording what was **actually** printed, as a separate
field — see Rule 4. If that ever contradicts the PO's state, that is a finding,
not a correction.

## Rule 2 · The print price is shown wherever the PO line is shown

Add it as a visible column or line item on:

| Screen / view | Where | Shown to |
|---|---|---|
| **PO Tracker** — line row and order drawer | Beside Ordered / Pack size | KAM, Supply Chain, Production, Plant Manager, CFO, COO |
| **Production** — the PO batch master and the lifecycle panel | In the eyebrow line with PO and brand | Production, Plant Manager, COO |
| **Pre-shipment QA** — both inspection modals | In the `.sub` header line, beside batch, mfg and exp | QA Inspector, Supply Chain, COO |
| **Shipments** — Ready-to-ship rows and the dispatch modal | Per product line | Supply Chain, Plant Manager, COO |
| **Reports** — PO/line dataset (L7287) and the shipment dataset (L7291) | New dimension `printPrice` | Everyone with Reports access |
| **PO Dossier** (SPEC-02) | Header block | Everyone with dossier access |

Format everywhere: one chip, in whichever of the four states of Rule 0 applies —
never a bare number, because the invoice price is a per-Kg number and the two get
confused. Where both appear, label them explicitly:
`Invoice PKR 240/Kg · MRP PKR 1,250/pack`.

> **Status: BUILT 2026-08-21** — PO Tracker drawer, Load-a-truck modal, and all
> three inspection modals. **Still to do:** the Production batch master and
> lifecycle panel, the Shipments ready-to-ship rows, the two Reports datasets,
> and the PO Dossier header.

**Access note.** `invoicePrice` is COO/CFO-only and stays that way — that is a
commercial figure. `printPrice` is the opposite: it is printed on the pack and
sold in the market. **Everyone in the chain must see it.** Do not copy the
`invoicePrice` role gate onto it.

## Rule 3 · The print price becomes a QA checklist item

The checklist at L4816 is currently:

```js
const QC_CHECKLIST=['Packaging intact & correct','Label / artwork correct',
 'Net weight / count verified','Seal & closure OK','Cleanliness — no contamination',
 'Batch & expiry printed','No leakage / damage','Pallet / loading condition'];
```

It becomes ten items, and the three verification items carry the expected value
from the PO and the lot beside them so the inspector is comparing, not
remembering:

| # | Item | Expected value shown from |
|---|---|---|
| 1 | Packaging intact & correct | — |
| 2 | Label / artwork correct | — |
| 3 | **Price on pack is as the PO requires** | Rule 0 state + `line.printPrice` |
| 4 | **Batch # on pack matches the record** | `lot.brandBatchNo` |
| 5 | **Mfg & expiry on pack match the record** | `lot.mfgDate`, `lot.expDate` |
| 6 | Net weight / count verified | `line.pack` |
| 7 | Seal & closure OK | — |
| 8 | Cleanliness — no contamination | — |
| 9 | No leakage / damage | — |
| 10 | Pallet / loading condition | — |

Item 3 is worded *"Price on pack is as the PO requires"*, not *"matches the
PO"* — because for a no-print client the correct pack has **no price on it at
all**, and an inspector reading "matches" on a blank bag has nothing to match.
The line renders differently by state:

| State | What item 3 shows beside Pass / Fail |
|---|---|
| priced | *expected **PKR 1,250 /pack*** |
| no-print | ***no price should appear on this pack*** |
| missing | *this PO prints a price but none is set — ask the KAM before passing* |
| not specified | *check the client PO before passing* |

> **Compatibility.** `QC_CHECKLIST` is stored by index inside every saved
> inspection (`checklist: QC_CHECKLIST.map((it,i)=>({item:it,result:...}))`,
> L4497). Existing records store the **item text** alongside the result, so
> historical inspections stay readable. But **do not reorder or insert into the
> middle of the array** — append the three new items at positions 9, 10, 11 in
> code even if they display at positions 3, 4, 5, or old records will
> mis-render. Safer still: give each item a stable `key` and migrate the
> renderer to look up by key rather than index.

## Rule 4 · Record what was printed, separately from what was authorised

On every packing lot, store both:

| Field | Meaning | Set by |
|---|---|---|
| `poPrintPrice` | The PO's authorised print price at the moment of packing | Copied from the PO line, read-only |
| `printedPrice` | What the operator confirms actually went on the pack | The operator |
| `priceVerifiedBy` | The **person**, not the role | `state.currentUser.name` |
| `priceVerifiedAt` | Timestamp | System |

Today `priceVerifiedBy: state.role` (L4313) stores `"Production"`. That names a
job, not a person, and cannot be followed up. Change it to the user's name,
falling back to the role only if no user is attached.

If `printedPrice !== poPrintPrice`, the lot is flagged and **cannot pass QA**
until either the PO is corrected (through the standard correction path,
[SPEC-03](SPEC-03-EDIT-STANDARD.md)) or the lot is re-labelled.

## Rule 5 · The print price is correctable through the standard path

Add `printPrice` to Data Fix → "Correct a PO" (L2345–2363), which today exposes
`invoicePrice` and not `printPrice`. Correction requires a reason and logs
old → new as RECONCILE, exactly like the invoice price does.

Correcting a print price **after** material has been packed against that line
must warn, list the affected lots by batch number, and record the warning was
shown. Packs already printed cannot be un-printed; the record should say so.

## Rule 6 · The price appears on the documents that leave the building

| Document | Add |
|---|---|
| **Printed PO** (`printPO`) | A `MRP / pack` column beside the invoice price |
| **Pre-shipment inspection report** (`printInspect`) | The price check line with expected and confirmed values |
| **Delivery Challan** (`printDC`) | MRP per pack per line — this is what the receiving party can check |

Not the Gate Pass — it is an Urdu security document for the gate, and price is
not the gate's business.

---

## Rule 7 · One Action Center item, and it is about the *decision*, not the price

**"PO has no print/no-print decision recorded"** — owner: **KAM**, escalates to
**COO** after 2 days.

Raised only where `printOnPack` is absent — legacy POs and everything from the
opening-PO import. It clears the moment someone ticks or unticks the box. Once
every open PO carries a decision, this item disappears for good and never comes
back, because new POs cannot be created without one.

A separate, narrower item — **"PO prints a price, but none is set"** — covers
the `missing` state only. That one is a genuine gap.

Neither item fires for a no-print PO. There is nothing wrong with a no-print PO.

Add both to the Reports exception list at L7308 alongside the existing
`'No invoice price'` row, so the size of the backlog is one number you can look
at before deciding whether any of this needs to block anything.

---

## Acceptance tests

1. Open PO Tracker as **Supply Chain**. Every priced line shows
   `MRP PKR x/pack`. → *Today: not shown at all.* ✅ **built**
2. A PO for a client who does not print a price shows a **calm grey** *"No price
   on pack"* — never a red flag, never a warning, never an Action Center item.
   ✅ **built**
3. A PO whose `printOnPack` is on but has no price shows red *"MRP not set"* —
   and only that PO. ✅ **built**
4. An imported PO with no `printOnPack` flag shows grey *"Print price not
   specified"*, not an error. ✅ **built**
5. Open a pre-shipment inspection as **QA Inspector**. The panel shows what the
   PO requires and, where a price was recorded at packing, whether it agrees.
   ✅ **built**
6. A **no-print** PO whose packing lot recorded a price is flagged red —
   *CHECK THE BAG, this PO should carry NO printed price*. ✅ **built**
7. Checklist item 3 renders the right wording for each of the four states.
   → *Not built.*
8. Pack a line whose PO is priced. The operator confirms the number; they cannot
   author it. → *Today: the packer types a number and it silently becomes the
   PO's price.*
9. Correct a print price in Data Fix. It saves, logs old → new, and warns about
   already-packed lots. → *Today: the field does not exist on that screen.*
10. Open an inspection saved **before** this change. It renders correctly with
    its original 8 items. → *Regression test for the index-vs-key issue.*

---

## Estimated change surface

| Rule | Touches | Size |
|---|---|---|
| 1 | 3 pack functions | ~30 lines |
| 2 | 6 render sites + 2 report definitions | ~60 lines |
| 3 | `QC_CHECKLIST` + 3 inspection renderers | ~50 lines |
| 4 | 3 pack functions + QA gate | ~35 lines |
| 5 | Data Fix correct form + submit | ~20 lines |
| 6 | 3 print functions | ~25 lines |

No change to the shape of stored data beyond **additive** fields
(`poPrintPrice`, `printedPrice`, `priceVerifiedAt`, `noPrintPrice`). Nothing is
renamed or removed, so old records keep working.

---

*Spec written 2026-08-21. Corrected the same day after Tahir's review: a print
price is not compulsory, so Rule 0 replaced the "every line must have a price"
assumption that ran through the first draft. Module: O2S.*

*Status: Rules 0 and 2 built (display and inspection panels). Rules 1, 3, 4, 5,
6 and 7 specified, not built.*

---

# Rule 0 completed — 2026-08-21 · the question is now asked

Fault 11 happened because `printOnPack` could not hold the answer. It was
`!!entryPrintOn` — the state of a checkbox — so "no" and "nobody said" were the
same value, and I inferred one from the other and got it wrong on 41 of 44 live
POs.

Inferring around a field that cannot express the answer is not a fix. **The fix
is to ask the question.**

## At PO entry

The checkbox is gone. In its place, a required question with **no default**:

> **Does this PO print a price on the pack? \***
> The retail/MRP figure printed on the bag. *This client has printed a price
> before.* Whoever packs and whoever inspects will be shown your answer — so it
> has to be an answer, not a blank.
>
> `[ Yes — prints a price ]` `[ No — no price on the bag ]`
>
> **Not answered yet**

- Neither option is preselected. The panel is amber until answered.
- The client's history is shown as a **hint beside the question**, never as a
  silent answer to it. That was the original mistake, one layer down.
- The PO **cannot be submitted** unanswered — it fails the pre-submit checklist
  and the submit gate.
- Answering "No" on products that normally print a price still asks for
  confirmation, and the confirmation now states the consequence: *"Packing and QA
  will both be told not to print a price."*

## What is stored

| Field | Meaning |
|---|---|
| `printDecision` | `'yes'` / `'no'` — **only ever written when somebody answered** |
| `printDecisionBy` | who answered |
| `printDecisionAt` | when |
| `printOnPack` | kept in sync, so nothing downstream breaks |

`printDecision` existing at all is the signal. That is what separates it from
`printOnPack`, which every PO has whether anyone thought about it or not.

## How it resolves

`printPolicyOL()` now trusts an explicit answer **absolutely** — no inference,
no second-guessing:

| Order | Rule |
|---|---|
| 1 | `printDecision === 'no'` → **no price on pack**, full stop. Even if the brand has printed a price before |
| 2 | `printDecision === 'yes'` → priced, or **MRP not set** if no price is entered |
| 3 | *legacy only, no decision recorded* | a price on the line wins, then brand history, then "not specified" |

Rules 1 and 2 are the future. Rule 3 is the Fault 11 salvage path, and it exists
only until every open PO has been answered for.

## Answering for POs already in flight

**Data Fix → Correct a PO** gained the question, and it says plainly when nobody
has ever answered it:

> *Never answered. The system is currently inferring **unrecorded** from what has
> been printed before — an inference, not a decision.*

Saving records the answer with the person and the timestamp, exactly like a new
PO. Print price is now correctable per line on the same screen, which also
closes **Rule 5** — until today a wrong print price had no correction path
anywhere in the app.

> This is COO-only because Data Fix is. The KAM owns the PO and should be able to
> answer for their own, which is [SPEC-03](SPEC-03-EDIT-STANDARD.md)'s authority
> table. Until that lands, the COO sweeps the backlog.

## The backlog is countable

The *"No print/no-print decision"* anomaly row was itself wrong at first — it
counted `printOnPack === undefined`, which is **zero** on live data, while 151
lines were genuinely undecided. It now counts through `printPolicyOL`, so it
reports what is actually unresolved.

## Verified

| Case | Result |
|---|---|
| Answered **No**, brand has printed 1,500 before | **no price on pack** — the decision beats the history |
| Answered **Yes**, no price set | MRP not set |
| Answered **Yes**, price 1,250 | MRP 1,250 /pack |
| Legacy, never answered, history 1,500 | **MRP not recorded** — honest, no false instruction |
| PO Entry opens | `entryPrintOn === null` — unanswered, not defaulted |
| Data Fix, PO never answered | control present, "Never answered" banner shown |
| Data Fix save | `printDecision: 'yes'`, `printOnPack: true`, person recorded, line price set, policy flips to **priced** |

---

*Rule 0 completed 2026-08-21. Rules 3 (the QA checklist price item) and 6 (the
printed documents) remain.*

---

# Rule 3 built, and the backlog made clearable — 2026-08-21

## First, what the live data said

With the question deployed and nobody having answered it yet:

| | |
|---|---|
| POs | 44 — **none answered**, as expected |
| Lines reading **MRP not recorded** | 136 |
| Lines reading **No price on pack** (no history anywhere) | 15 |
| Lines **priced** | 7 |
| *"No print/no-print decision"* anomaly rows | **136** |

The count is now real. It was reporting zero the day before.

## The backlog needed a way to be cleared

Data Fix answers one PO at a time — pick it from a dropdown, answer, type a
reason, save, repeat. **Forty-four times.** A backlog that tedious does not get
cleared, and until it is cleared 136 lines read "not recorded" and the whole
price control sits inert.

So: **one screen, every unanswered PO, two clicks each, one save.**

For each PO it shows what the system is currently *inferring*, and — more useful —
**what has actually been printed on that PO's packs**:

> `COBO-2607-4034` · VITAL AGRI NUTRIENTS · 10 products
> *10× unrecorded* — **packs already printed at 1,500 (VL-NPK), 950 (Tornado), 4,500 (Nitro Sulfur)**
> `[ Prints a price ]` `[ No price ]`

That evidence line is the point. The COO is not guessing; they are looking at
what came off the line. Nothing is written until Save, and POs already answered
never appear.

Reached from **one** Action Center item — not 44. Forty-four identical rows
would bury every other action in the list. Owner **KAM** (they know the client's
instruction), escalating to **COO** after 3 days. It disappears for good once
every PO carries an answer.

> **Expect a second layer.** Answering "prints a price" turns a line from
> *not recorded* into ***MRP not set*** until somebody enters the actual number.
> That is correct — the price genuinely is not on the PO — but it means the
> backlog has two stages, and the second is the bigger one.
>
> The printed prices are sitting in the packing lots and could be adopted as the
> PO's authorised price in one sweep. **Deliberately not built.** That is
> uncomfortably close to Fault 10 — a packer's number becoming the authorised
> one — and the difference is only that a human reviewed it. If it is built, it
> must be an explicit per-PO opt-in, logged as an adoption rather than a
> correction, and it needs Tahir's decision first.

## Rule 3 — the three record checks

The original 8-point checklist asks *"Batch & expiry printed"* — **printed, not
correct**. An inspector can honestly tick that on a bag carrying the wrong batch
number. And it never mentions price at all, which is half of intent 4.

Three new items sit **above** the checklist, each carrying the expected value
beside it, because nobody should be checking a batch number from memory:

| Check | What it shows |
|---|---|
| **Price on the pack is as the PO requires** | *expected **PKR 1,250 /pack*** · or ***no price should appear on this pack*** · or *not recorded — check the client PO before passing* |
| **Batch # on the pack matches the record** | *expected **ZR-2026-0042*** |
| **Mfg & expiry on the pack match the record** | *expected mfg **2026-08-06** · exp **2028-08-06*** |

Worded *"as the PO requires"*, not *"matches the PO"* — for a no-print client the
correct pack has **no price on it at all**, and an inspector reading "matches" on
a blank bag has nothing to match.

All three are **mandatory**, and **any Fail fails the lot or the truck**, even
when all eight original items pass.

On a truck carrying several products each check lists the expectation **per
product** and is marked once for the load.

### Where it was built, and where it was not

Live data decided this. The per-lot QA screen holds **zero** records; the paths
your team actually uses are `savePackInspect` (**113 records**) and
`dispQASubmit` (**137 shipments**). Both now carry the verify block.

### Stored separately, on purpose

Under `qa.verify` / `ins.verify` — **not appended to `QC_CHECKLIST`**. Every
existing inspection stores its checklist *by array index*
(`QC_CHECKLIST.map((it,i)=>…)`), so extending that array would silently re-label
every inspection ever saved.

## Verified

| Case | Result |
|---|---|
| PO answered **yes**, price 1,250 | *expected PKR 1,250 /pack* |
| PO answered **no** | ***no price should appear on this pack*** |
| PO never answered | *not recorded — check the client PO before passing* |
| Three checks left unmarked | **blocked** |
| Price check **failed**, all 8 others pass | lot **fails**, goes on hold |
| Batch check failed on a truck | truck **fails**, shipment voided |
| All pass | cleared, quantity released to ship |
| Bulk screen | 2 POs answered, decision + person + timestamp stored, action item drops to zero |

---

*Rules 0, 1, 2, 3, 4, 5 and 7 are now built. **Rule 6** — the print price on the
printed PO, Delivery Challan and inspection report — is the last one open.*
