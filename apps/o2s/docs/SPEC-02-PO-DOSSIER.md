# SPEC-02 — The PO Dossier

**Fixes [Fault 3](FAULT-REGISTER.md#fault-3--no-single-place-showing-everything-attached-to-a-po).**
Serves intent 1 (*where is the order, who holds it, since when*) and intent 2
(*a batch number traces everything, even years later*).

---

## The decision

**Primary spine: the PO line** — the pair `(PO, product line)`.

**Equal entry point: the batch number** — searching any base batch number or
brand batch number lands in the same dossier, filtered to that batch.

Why the line and not the PO header: the customer, the committed date, the
invoice price, the print price, the quantity and the produced material all
attach to a *product on a PO*, not to the PO as a whole. A PO with three
products has three independent journeys through the factory, produced in
different weeks, tested on different COAs and often shipped on different
trucks. A single dossier for the header would interleave three unrelated
timelines. A dossier per line answers the question a person actually asks.

The PO header still gets a page — it is a thin index listing its lines with
their stage, and it links into each one.

---

## What it must answer

Tahir's list, restated as the questions the page has to answer without the
reader opening anything else:

| Question | Source in `app_state` today |
|---|---|
| Where is this order, right now? | derived stage |
| Who is holding it, and since when? | Action Center owner + the new `actualDate` / `recordedAt` from [SPEC-04](SPEC-04-REALTIME-DISCIPLINE.md) |
| When was it produced? | `batches[].openedDate`, `productionLog[].date` |
| How many batches? | `batches` where `po` and `lineId` match |
| Who produced it? | `batches[].lots[].incharge`, `productionLog[].incharge` |
| On which floor / shift? | `productionLog[].shift`, `lots[].shift` |
| When was it packed? | `packingLog[].date`, `.mfgDate`, `.expDate` |
| When was it tested? | `batches[].lots[].coa.*` — analyst, AQCM, QCM, each with a timestamp |
| The QC report | `printCOA(batchId, lotId)` |
| When was it inspected pre-shipment? | `packingLog[].qa`, `shipments[].qa`, `inspections[]` |
| When did it ship? | `shipments[].dispatch`, `.dispId`, `.dc`, `.gatePass` |
| Shipment documents | `printDC(dispId)`, `printGatePass(dispId)` |
| What price was on the pack? | `line.printPrice` + `packingLog[].printedPrice` ([SPEC-01](SPEC-01-PRICE-VISIBILITY.md)) |
| Who changed what, when? | `state.audit`, `state.actionLog` |

**Every one of these already exists in the data.** Nothing new needs to be
captured to build this page. The gap is purely that no view assembles it.

---

## The join keys

All the record arrays already carry stable IDs (`ensureRecordIds`, L1383–1390).
The joins are:

```
order (o)                      state.orders[]
  └─ line (l)                  o.lines[]                     key: l.id

     batches                   state.batches[]               where b.po === o.po && b.lineId === l.id
                                                             (bulk batches: match by b.base === l.base)
       └─ lots                 b.lots[]                      key: lot.lotNo
            └─ COA             lot.coa                       analyst / reviewer / approver + dates

     shift output              state.productionLog[]         where pl.po === o.po && pl.brand === l.brand

     packing lots              state.packingLog[]            where p.po === o.po && p.lid === l.id
                                                             (fallback: p.brand === l.brand)
       └─ QA inspection        p.qa                          checklist, by, date, remarks
       └─ base ⇄ brand batch   p.baseBatchNo → p.brandBatchNo

     inspections               state.inspections[]           where ins.po === o.po && ins.lid === l.id

     shipments                 state.shipments[]             where s.po === o.po && s.lid === l.id
       └─ dispatch group       s.dispId                      → DC, Gate Pass, vehicle, driver, seal
       └─ shipment QA          s.qa

     audit trail               state.audit[]                 where a.po === o.po && a.brand === l.brand
     action narrative          state.actionLog[]             text match on PO — see the caveat below
```

> **Caveat — `actionLog` is not reliably joinable.** It stores a free-text
> sentence (`logAction()` L1952), so filtering it to one PO means substring
> matching on the PO number. That works but it is fragile. **Add `po`, `lid`
> and `module` fields to `actionLog` entries going forward**, and fall back to
> substring matching for historical rows. This is a small additive change with
> a large payoff for the dossier.

> **Caveat — batch↔line matching.** PO batches carry `lineId`, but bulk batches
> (`kind:'bulk'`) do not — they are packed into a line later. So a bulk batch
> reaches the dossier **through the packing lot**, not directly. The dossier
> must follow `packingLog[].baseBatchId` back to the batch, which is exactly
> what `rpTrace` already does (L7602).

---

## The page

One route, three ways in:

| Entry | Lands on |
|---|---|
| Click a line on PO Tracker, Production, QA, Shipments or Reports | That line's dossier |
| Search a **PO number** | The PO header index → pick a line |
| Search a **base or brand batch number** | The dossier of the line that batch was packed into, scrolled to that batch and highlighted. If one base batch fed several lines, a chooser first |

### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  PO-2026-0142  ·  V-Germinator Pro  ·  Ittefaq Traders, Multan       │
│  Ordered 5,000 Kg · 5 Kg pouch · Committed 12 Aug 26                 │
│  Invoice PKR 240/Kg  ·  MRP PKR 1,250/pack                           │
│  ● Stage: Dispatched   ·   Holder: Supply Chain   ·   4 days         │
│                                                       [Print dossier]│
├──────────────────────────────────────────────────────────────────────┤
│  ORDER ─── RM ─── PRODUCED ─── QC ─── PACKED ─── INSPECTED ─── SHIPPED│
│    ✓        ✓         ✓         ✓        ✓           ✓          ●     │
│  Each node: actual date · recorded date · by whom · lag              │
├──────────────────────────────────────────────────────────────────────┤
│  ▼ Production            3 batches · 5,120 Kg produced               │
│    B-26-0088   opened 02 Aug   Floor A                               │
│      Lot 088-1   1,800 Kg   Shift A   Imran      COA ✓ FIT   [COA]   │
│      Lot 088-2   1,700 Kg   Shift B   Imran      COA ✓ FIT   [COA]   │
│    B-26-0091 …                                                       │
├──────────────────────────────────────────────────────────────────────┤
│  ▼ Packing               4 lots · 5,000 Kg · 1,000 packs             │
│    VGP-26-0088  from B-26-0088  1,800 Kg  packed 06 Aug              │
│      Mfg 06 Aug 26 · Exp 06 Aug 28 · MRP printed 1,250 ✓ matches PO  │
│      Packed by Imran · price verified by Imran 06 Aug 14:22          │
├──────────────────────────────────────────────────────────────────────┤
│  ▼ Pre-shipment inspection    2 inspections · 5,000 Kg cleared       │
│    09 Aug · VGP-26-0088 · 1,800 Kg · PASS · Insp. Kashif  [Report]   │
│      10/10 checks · price ✓ · batch ✓ · mfg+exp ✓                    │
│      ⚠ recorded 14 Aug — 5 days after the inspection date            │
├──────────────────────────────────────────────────────────────────────┤
│  ▼ Shipment              1 truck · DC-081026-004                     │
│    10 Aug · 5,000 Kg · LES-4471 · Malik Transport · Seal 77213       │
│    Gate pass GP-0442 · PM approved by Bilal 10 Aug 09:40             │
│                                          [DC]  [Gate Pass]  [SO]     │
├──────────────────────────────────────────────────────────────────────┤
│  ▼ Every record and change      47 entries    [filter] [export CSV]  │
│    one merged, time-ordered trail — see below                        │
└──────────────────────────────────────────────────────────────────────┘
```

### The merged trail

The bottom section is the part that makes this a dossier rather than a summary.
It merges **six** sources into one time-ordered list:

| Source | Contributes |
|---|---|
| `state.audit` | Every field change, old → new, who, when |
| `state.actionLog` | Every action taken, as narrative |
| `batches[].lots[].coa` | Analyst signed, AQCM reviewed, QCM approved, rejections, deviations |
| `packingLog[]` | Each pack run with its batch numbers and price |
| `packingLog[].qa` and `shipments[].qa` | Each inspection, pass or fail, and each re-inspection |
| `shipments[]` | Dispatch, PM approval, gate release, delivery |

Each row: **actual date · recorded date · lag · who · what · [document]**.

Rows where lag exceeds the threshold for that event type are marked. That
marking is the whole reason [SPEC-04](SPEC-04-REALTIME-DISCIPLINE.md) has to
land before this page is trusted — without `actualDate` and `recordedAt` as
separate fields, the lag column is always zero and the dossier renders a
comfortable fiction.

### Print

`[Print dossier]` produces one PDF via the existing `printDoc` helper (L4559):
the header, the timeline, every section, the full trail, and an appendix
listing the COA, inspection report, DC and gate pass numbers with their dates.
This is the document you hand an auditor, a customer, or a court, and it is why
the dossier is worth building even before anything else improves.

---

## Access

Read access follows the existing access matrix — anyone who can view PO Tracker
can view the dossier. It is **read-only**; every action on it deep-links to the
screen that owns that action, which keeps the ownership model intact and stops
the dossier becoming a back door around
[SPEC-03](SPEC-03-EDIT-STANDARD.md).

Two exceptions, both COO-gated: the export, and the entry-lag column.

---

## Build order

| Step | Deliverable | Depends on |
|---|---|---|
| 1 | `poDossier(oid, lid)` — a pure read function returning the assembled object. No UI | Nothing |
| 2 | Batch-number index: `batchNo → [{oid, lid}]`, built from `packingLog` and `batches` | Step 1 |
| 3 | The page: header, timeline, five sections | Steps 1–2 |
| 4 | The merged trail | Step 1 + `actionLog` gaining `po`/`lid` |
| 5 | Deep links in from Tracker, Production, QA, Shipments, Reports | Step 3 |
| 6 | `[Print dossier]` | Step 3 |
| 7 | Lag column and lateness marks | [SPEC-04](SPEC-04-REALTIME-DISCIPLINE.md) step 1 |

Step 1 is where the work is. Once the data is assembled correctly, the page and
the print are presentation.

---

## What this replaces

Nothing is deleted. `rpTrace` (batch composition) and `rpDocs` (document
viewer) stay — they answer *"which base batches make up this brand batch"* and
*"find me a DC"*, which are different questions from *"tell me everything about
this order line"*. The dossier links to both.

---

## Acceptance tests

1. Open any delivered PO line. Every question in the table at the top of this
   spec is answered on one page, without navigating away.
2. Search a brand batch number from six months ago. It lands on the right
   dossier with that batch highlighted. → *This is intent 2.*
3. Search a base batch that was split across two PO lines. A chooser appears
   naming both, then lands correctly.
4. A PO line with no production yet shows the page with empty sections and the
   correct current holder — it must not error or render blank.
5. Print the dossier for a completed line. The PDF contains the COA number,
   inspection date, DC number and gate pass number.
6. A line packed from a **bulk** batch (no `lineId` on the batch) still shows
   its production batches, resolved through the packing lot.

---

*Spec written 2026-08-21. Module: O2S. Status: not implemented.*
