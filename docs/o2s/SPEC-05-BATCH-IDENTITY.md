# SPEC-05 — Batch identity and the link that must not break

**Raised by the Plant Manager, 21 August 2026.** Built and verified the same day.

> *"The batch number should be linked to the internal batch but the packing-stage
> batch number be printed on the DC… batch integrity and the link should be
> traceable and unbreakable. It's a critical link."*

---

## What he described

VAN produces **internal batches** — `HG26023`, `VU26174`. At packing, material may
be re-batched into a **client-format number**: Syngenta wants `VAN6GE002`, not our
internal number. That client number is what is printed on the bag.

So the Delivery Challan must carry the number that is on the bag, and that number
must stay tied to the internal batches it came from, permanently.

## What the live system actually showed

Measured on production before anything was changed.

| | |
|---|---|
| Packing lots re-batched (pack # ≠ internal #) | **49 of 153 — 32%** |
| Client batch numbers drawing on several internal batches | **7** |
| Largest: `VAN6GU002` | **9 internal batches**, 55,275 Kg |
| Shipment batch rows carrying a lot id | **0 of 176** |
| Inspection batch rows carrying a lot id | **113 of 113** |
| POs with no delivery focal person | **36 of 44** |

And it runs **both ways**: `VU26174` appears under both `VAN6GU001` and
`VAN6GU002`; `HG26023` under both `VAN6GE001` and `VAN6GE002`. The relationship
is **many-to-many**, joined at the packing lot.

### The model was already right

Each packing lot carries `baseBatchId` — a **hard id**, not a number — plus both
numbers. The packing screen has said so all along: *"Brand batch # (on pack —
reuse the same # to merge several base batches)."* The capability was designed in
and the team uses it.

**What was broken was the paperwork on top of it, and the durability underneath.**

---

## Three breaks, and what was done

### 1 · The DC printed the wrong number

One line of `printDC`:

```js
var bn = r.batches.map(function(b){ return b.batch; }).join(', ');   // INTERNAL
```

`b.brand` — the number on the bag — was read and discarded. **DC 69** (Syngenta)
printed `HG26024, HG26023`; every bag said `VAN6GE002`. A storeman checking the
delivery against the pallet found **no match at all**.

Now: **`Batch # (on pack)`** leads, with **`Internal batch`** in its own column,
each internal number carrying the quantity it contributed when a pack batch draws
on more than one.

**One printed line per (product × pack batch number).** A single product line can
carry two pack batches — **DC 29** ships Naya S Urea under *both* `VAN6FU006` and
`VAN6GU001`, with internal batch `VU26166` split across the two. Two columns
cannot express that on one line without lying about which internal batch went
into which bag, so the line splits. Quantities still total the same.

**Measured at A4 portrait, worst real case (DC 29):** table 688px into 688px
usable — an exact fit with the product column still the widest at 201px, nothing
clipped, a three-batch row at 64px against 31px for an empty one, one page.
**No landscape needed.**

### 2 · A batch number is an identity, not a value

Tahir, on being asked what a corrected batch number should do to an issued DC:

> *"Why does a batch number need to be corrected? A batch number change
> authorisation should be done through a very strong gate."*

He was right, and it simplified the design. Once bags carry a number, the record
must match the bag. Changing the record to something else **breaks** the link to
the physical material rather than repairing it.

| When | Batch # change |
|---|---|
| Packed, nothing inspected or shipped | Plant Manager or COO, reason required, on the register |
| Anything **inspected** on that lot | **Refused** — *"withdraw the inspection first if it was wrong"* |
| Anything **shipped** | **Refused** — *"quarantine and re-label; do not edit the record"* |

This applies to both numbers — the pack number on the lot, and the internal
number on the batch. Production can still **set** a blank batch number, which is
their job; **changing** one that exists reroutes to the correction path and says
why. The box appears disabled with the reason under it, and forcing the value
past it is refused at apply.

A mislabelled bag is a physical event. The system now says so instead of offering
a text box.

### 3 · The link was a copied string

`shipments[].batches[]` stored `{batch, brand, kg}` — the numbers as text, with
nothing pointing at the lot. **0 of 176 rows carried an id.** A quoted number is a
photocopy: correct the number anywhere and the challan keeps printing the old one
with nothing to detect it.

- New dispatches store **`lotId`** (both dispatch paths).
- `linkShipBatchLotsV1` backfills existing rows by matching PO + product + both
  batch numbers, linking **only where unambiguous** — a wrong link is worse than
  no link. What it cannot resolve is counted on `state._shipLotLink`, not guessed.
- **`onAmend` on the registry** — new. Correcting a number now propagates:
  the internal number to lot numbers, the COA, shift entries, the production log,
  every packing run, and any document quoting it; the pack number to the
  inspections and challan lines that quote it, **matched by lot id where present
  and by the old number where not** (legacy rows).
  Everything that moved is recorded as the correction's cascade.

Without `onAmend`, the correction path built this morning would have changed a
batch number on the lot and left the COA and every document saying something
else. **That hole was introduced this morning and is closed in the same change.**

The two identities stay separate: renumbering an internal batch does **not**
overwrite a client pack number that was deliberately made different.

---

## The focal person

`focalPerson` was offered at PO Entry for **Cobo, VGreen and Dealer only** — so
White Label, Distributor and Farmer had no way to set it, and 36 of 44 POs print
an empty **FOCAL PERSON** line. Every Syngenta order is White Label.

- PO Entry now offers it on **every channel**, as free text with the master list
  as suggestions — a one-off contact on a White Label load does not deserve a
  master record.
- **Editable per truck** on the shipment screen, pre-filled from the PO. A
  customer can send a different person to receive a particular load.
- The DC uses the truck's value, falling back to the PO's.

---

## Verified

**208 checks across four suites**, all passing:

| Suite | |
|---|---|
| Correction path assertions | 109 |
| Click-through, interface only | 40 |
| **DC layout + batch link** | **28** |
| **Batch-number gate** | **31** |

The DC suite reproduces the two real shipments — DC 69 and DC 29 — and asserts
the split, the quantities, the pairing, that `VU26166` correctly appears on both
lines, and the A4 measurement. The gate suite covers all three lock states by
role, the disabled box, forcing the value past it, propagation to COA / lots /
inspections / challans, and the `setBatchNo` reroute.

`node --check` on all five script blocks. No console errors on any screen, for
any of the nine roles.

---

## Open

- **`mfgDate`, `expDate` and `printedPrice` are also on the bag** and are not yet
  locked after shipping the way the batch number is. Same class of problem —
  worth a decision.
- The Gate Pass carries **no batch column at all**. Not raised, but it is the
  document at the gate.
- `state._shipLotLink` should be read after the first live load to confirm the
  backfill resolved all 176 rows. If it reports `ambiguous` or `unmatched`
  above zero, those rows need looking at by hand.

---

*Built and verified 21 August 2026. Module: O2S.*
