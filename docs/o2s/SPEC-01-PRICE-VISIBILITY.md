# SPEC-01 — Make the print price visible and verifiable

**Fixes [Fault 1](FAULT-REGISTER.md#fault-1--the-print-price-is-written-then-hidden).**
Serves intent 4: *nothing leaves the factory unless it meets quality, packing,
**price as per PO**, batch #, mfg and expiry.*

---

## The principle

> **A price that only one person can see is not a control. It is a note.**

The print price is set by the KAM from the client's PO and printed on packs
that go to the market. Between those two points it currently passes through
production, packing, QA and dispatch — and none of them can see it. This spec
makes it visible at every one of those points and verified at the last one.

---

## Rule 1 · The PO is the only authority for the print price

Today the packer's typed value is written back onto the PO line when the PO has
none:

```js
// doPack L4312 — and the same at L4035 (divert) and L4264 (PO-direct pack)
if(l.printPrice==null||l.printPrice===''){ l.printPrice=ppx; }
```

**Remove this.** Packing must never author the PO's price. Replace with:

| PO line state | Packing behaviour |
|---|---|
| `printPrice > 0` | Show it, read-only. The operator confirms it matches the artwork; they do not type a number |
| `printPrice` missing, and the client normally prints a price (`recallPrintPrice(brand) > 0`) | **Block packing.** Message: *"This PO line has no print price. KAM or COO must set it before this can be packed."* Offer a one-click "Request price" that raises an Action Center item for the KAM |
| `printPrice` missing, and no print history for this client | Allow packing, record `printPrice: null` and `noPrintPrice: true` on the packing lot, so it is explicit rather than absent |

The packing lot keeps recording what was **actually** printed, as a separate
field — see Rule 4. If the two ever differ, that is a finding, not a
correction.

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

Format everywhere: `MRP PKR 1,250 / pack` — never a bare number, because the
invoice price is a per-Kg number and the two get confused. Where both appear,
label them explicitly: `Invoice PKR 240/Kg · MRP PKR 1,250/pack`.

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
| 3 | **Printed price matches the PO** | `order.line.printPrice` |
| 4 | **Batch # on pack matches the record** | `lot.brandBatchNo` |
| 5 | **Mfg & expiry on pack match the record** | `lot.mfgDate`, `lot.expDate` |
| 6 | Net weight / count verified | `line.pack` |
| 7 | Seal & closure OK | — |
| 8 | Cleanliness — no contamination | — |
| 9 | No leakage / damage | — |
| 10 | Pallet / loading condition | — |

Items 3, 4 and 5 render as: *Printed price matches the PO — **expected PKR
1,250/pack*** with Pass / Fail beside it.

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

## New Action Center item

**"PO line has no print price"** — owner: **KAM**, escalates to **COO** after
1 day.

Raised when a PO line has `ordered > 0`, no `printPrice`, and
`recallPrintPrice(brand) > 0` (this brand has carried a printed price before).
It clears when the price is set. This puts the gap in front of the person who
can close it, on the day it appears, rather than at the moment a packer is
standing at the line waiting.

Also add it to the Reports exception list at L7308, alongside the existing
`'No invoice price'` exception, as `'No print price'`.

---

## Acceptance tests

1. Open PO Tracker as **Supply Chain**. Every priced line shows
   `MRP PKR x/pack`. → *Today: not shown at all.*
2. Open a pre-shipment inspection as **QA Inspector**. The header shows the PO's
   print price, and checklist item 3 shows the expected value. → *Today: neither.*
3. Try to pack a PO line with no print price, for a brand that has printed
   before. Packing is blocked with a clear message and a "Request price" button.
   → *Today: the packer types a number and it silently becomes the PO's price.*
4. Pack with a `printedPrice` different from `poPrintPrice`. The lot is flagged
   and cannot pass QA. → *Today: no comparison is made.*
5. Correct a print price in Data Fix. It saves, logs old → new, and warns about
   already-packed lots. → *Today: the field does not exist on that screen.*
6. Open an inspection saved **before** this change. It renders correctly with
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

*Spec written 2026-08-21. Module: O2S. Status: not implemented.*
