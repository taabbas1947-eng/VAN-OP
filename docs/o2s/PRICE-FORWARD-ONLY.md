# Forward only — the revised sheet after "consider history closed"

VAN / O2S. 22 August 2026. Replaces Parts A and C of PRICE-FIX-SHEET.md.

The COO's call: *"Why we need to back fill things? we should ignore them, we
should consider them closed."*

That is the right call, and checking it turned up something better than an
argument for it.

---

## Closing history costs nothing — the warning it would have left never appears

The worry with answering Maxim as "no price" was that the 18 historic 0.1 rows
would then show a red warning forever: *"the lot was packed at PKR 0.1 /pack —
CHECK THE BAG, this PO should carry NO printed price."*

They will not. That warning is built by `mrpCheckHtml`, which is rendered in
exactly one place in the whole file — inside `renderLotQA`. Follow the chain:

```
mrpCheckHtml  ←  renderLotQA  ←  openLotQA  ←  qaRows  ←  nothing
```

`qaRows` is built once, at line 6800, and never inserted into any screen.
`screenQC` computes it and throws it away. **So that warning has never been seen
by anybody, and leaving the 23 rows alone leaves no mess behind.**

**The live inspection check is a different one and it is fine.** `qcExpect` /
`qcVerifyTable` / `priceSeen` — the SPEC-06 work — renders through
`openPackInspect`, which is reachable from three live places: the "Awaiting QA"
card, the QA unit rows, and an Action Center item. That one works and it is
forward-looking, which is all that matters now.

---

## What actually still matters: 358 tonnes not yet packed

History is closed. The live question is what happens to material still in the
queue.

**17 of 21 orders still have material to pack — 539,248 Kg.** Only 4 are
finished. And of the lines still to pack, **31 carry no printed price at all,
covering 358,005 Kg of future packing.**

### The part that needs no number — answer print-on-pack and it is done

| PO | Lines still to pack | Kg | Answer |
|----|--------------------|-----|--------|
| 22032 | Enroot, Max Compost, Max Sulfur ×2 | 15,220 | No price |
| 22033 | Max Sulfur ×2 | 6,000 | No price |
| 21630 | Max Sulfur | 5,500 | No price |
| 21301 | Max Sulfur | 2,000 | No price |

Maxim want no price on the bag, so these need no number at all — just the answer.
**Eight lines and 28,720 Kg cleared by four clicks.**

### The part where the number is already proven

| PO | Brand | Kg to pack | Set to |
|----|-------|-----------|--------|
| 6595010236 | Enrich (Syngenta) | 203,309 | **4,500** |
| 1821412156 | Basic (Rudolf) | 34,940 | **13,750** |
| 1821412156 | Orbit-K (Rudolf) | 12,500 | **23,750** |

All three confirmed current by the COO. **251,000 Kg, three numbers already
known.** These are also the three big POs where the price can move mid-PO, so
what goes on the line is today's number and will need updating when a new one
arrives — the chase the slip is meant to replace.

### The part nobody has a number for — and this is the live commercial exposure

| PO | Customer | Brands | Kg to pack |
|----|----------|--------|-----------|
| 1821412156 | Rudolf | Tervalis 16,000 · Tervalis Plus 10,000 · Harbor Fertigation 7,000 · V Germinator Pro 5,000 · Cala Mag V 1,000 · Genius 440 | **39,440** |
| 7500003652 | Arysta | Fruitlish | **14,772** |
| 4204003607 | LCI | Authority (line carries the 0.1 placeholder) | **10,000** |
| 4204003087 | LCI | Ferti Rise | **1,770** |
| COBO-2606-2537 | Vital Agri | Nitro Sulfur 5,000 · Cal-Mag V 12 · VL-Micro Mix 12 | **5,024** |
| VG-2605-0002 | Vgreen | Fusion Potash 500 · Nitro Sulfur 500 · Humi Grow 160 · V-Transfarm 120 · Crop Star 100 | **1,380** |
| VG-VC-2606-6451 | Vgreen | Green Sulfur 100 · V-Boron Liquid 50 | **150** |

**Roughly 66,000 Kg of white-label and own-brand material is queued to be packed
with no MRP recorded anywhere in the system.** Rudolf alone is 39 tonnes across
six brands.

When each of those runs, somebody will need a number and there is nothing written
down. Today that means a phone call and a value typed straight onto a packing
row — which is exactly how the 128 tonnes of unsourced pricing happened, and it
is about to happen again on 66 more.

**This is the live version of the problem, and it is the strongest reason to
build the slip rather than a reason to fix the past.**

### One PO on hold

**260400001, United Distributor, Humi Cash, 6,000 Kg still to pack.** Bags arrive
pre-printed. Waits for the `supplied` option.

---

## What is dropped, deliberately

- **All 23 packing-row corrections.** The material shipped; the customer has it;
  no warning is displayed anywhere. Closed.
- **Line prices on the 4 fully-packed orders.** Nothing left to pack, so no
  future run reads them.

The record will show 0.1 on those June rows for ever. That is honest — it is what
was entered at the time, and the note explaining why sits in
`docs/o2s/PRICE-INTEGRITY.md` rather than being rewritten into the data.

---

## The one code change this decision requires

**Open the print-on-pack question to everyone who can create a PO.**

COO's words: *"It should be for everyone who got access to New PO Entry."*

Today `openBulkPrintDecision` is gated `state.role==='COO' || state.role==='KAM'`.
The New PO Entry screen is owned by `KAM`, and `accessMatrix` additionally grants
`entry:{v:true,e:true}` to the **Plant Manager**. So the intended set today is
**KAM, Plant Manager, COO** — and, more importantly, it should follow the entry
screen automatically so that granting somebody PO entry in future grants this
too, without another code change.

**Trade-off to be aware of, stated plainly:** following the access matrix rather
than a fixed role list is the same mechanism that caused the 30 July incident,
where a screen-level Edit grant silently unlocked approval steps. The difference
is that here it is deliberate and it is what was asked for — the price answer is
part of taking an order, not an approval. It should still be written so that the
set of people it opens to is visible on screen, not implied.

---

## Sequence from here

1. **Answer print-on-pack on the 17 live orders.** Four Maxim POs clear 8 lines
   with no numbers needed.
2. **Set the three proven prices** — Enrich, Basic, Orbit-K. 251 tonnes.
3. **Get the missing numbers** for the ~66,000 Kg above, Rudolf first.
4. **Open the screen to PO-entry roles** — small code change, reviewed.
5. Then the build order as agreed: Action Center urgency, `supplied`, the slip,
   the refusal at packing.

Steps 1–3 in a quiet window, with a snapshot taken before and a row-by-row report
after.
