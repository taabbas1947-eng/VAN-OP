# The price fix sheet — everything, in the order to do it

VAN / O2S. 22 August 2026. Built from the COO's answers today. Figures from the
data snapshot on record (16 July); live will have more rows, and the shape will
be the same.

**Nothing here needs code.** All of it is answering questions and correcting
records in screens that already exist.

**Source to record on every correction:** *Tahir (COO), 22 August 2026* — his
instruction, in place of chasing the original emails.

---

## Part A — set 14 order-line prices · closes 128,415 Kg

These prices are already proven: they were printed on bags and recorded on the
packing rows. The order lines say 0 (or the 1 placeholder). Setting the line
makes the system agree with the bag.

| PO | Customer | Channel | Brand | Set line to | Now | Kg affected |
|----|----------|---------|-------|-------------|-----|-------------|
| 6595010236 | Syngenta | White Label | Enrich | **4,500** | 0 | 68,195 |
| 1821412156 | Rudolf | White Label | Orbit-K | **23,750** | 0 | 37,500 |
| 1821412156 | Rudolf | White Label | Basic | **13,750** | 0 | 13,060 |
| COBO-2606-2537 | Vital Agri | Cobo | Vital Potash | **10,500** | 0 | 7,000 |
| COBO-2606-2537 | Vital Agri | Cobo | V-Mg Essential | **1,350** | 0 | 1,500 |
| DLR-2606-0001 | Kissan Zarai Merkaz | Dealer | V-Mg Essential | **1,350** | 0 | 585 |
| 202600422 | BKK | Distributor | Vibrant | **6,000** | 0 | 400 |
| VG-VC-2606-6451 | Vgreen | Vgreen | VL-NPK | **1,250** | 1 | 97 |
| VG-VC-2606-6451 | Vgreen | Vgreen | Tornado | **795** | 1 | 25 |
| DLR-2605-0001 | Afaq Zari Merkaz | Dealer | Tornado | **795** | 0 | 17 |
| COBO-2606-2537 | Vital Agri | Cobo | VL-NPK | **1,250** | 0 | 12 |
| COBO-2606-2537 | Vital Agri | Cobo | Tornado | **795** | 0 | 12 |
| DLR-2606-0001 | Kissan Zarai Merkaz | Dealer | VL-NPK | **1,250** | 0 | 8 |
| DLR-2606-0001 | Kissan Zarai Merkaz | Dealer | Tornado | **795** | 0 | 4 |

Enrich, Orbit-K and Basic are confirmed current by the COO today. The rest are
read straight off what was packed.

**Note on the top three:** these are large POs and the COO has said the price can
move mid-PO. Setting the line records today's number, not a permanent one — 460
tonnes are still to pack on Syngenta and Rudolf, and the line will need updating
by hand whenever a new price arrives. That manual chase is exactly what the
printing slip replaces.

---

## Part B — answer print-on-pack on all 21 orders

Already waiting in the COO's own **My Actions** as a *Print price* item, with a
button that opens the bulk answer screen. No PO hunting.

### No price on the pack — 5 POs (Maxim Agri)

| PO | Lines |
|----|-------|
| 22032 | 11 |
| 22033 | 8 |
| 21630 | 2 |
| 21301 | 1 |
| 21775 | 1 |

Maxim want no price printed. Answering these opens the legitimate *"no price on
this pack"* option at packing, which is what stops the 0.1 workaround at source.

**Expect this and do not be alarmed:** the moment these are answered, the 18
historic 0.1 rows on those POs will show a red warning saying the lot was packed
at 0.1 on a PO that should carry no price. That is the system listing the rows
that need correcting. It is Part C, writing itself.

### Yes, with a price — 11 POs

FRM-2606-7239 · 4204003692 · 202600422 · COBO-2606-2537 ·
DLR-SN-TAN-007-2606-8904 · VG-VC-2606-6451 · 6595010464 · 1821412156 ·
6595010236 · DLR-2605-0001 · DLR-2606-0001

Each already has a real price on the order, on packed bags, or both. Do Part A
first so the number is there when the answer is recorded.

### Hold — 1 PO

**260400001 (United Distributor).** Bags arrive pre-printed by the customer. All
three existing answers would misinform the inspector — the worst being *"no
price"*, which raises a red warning on every correct bag. Leave it until the
fourth option (*bags supplied pre-printed by the customer*) exists.

### Needs a decision — 4 POs

| PO | Customer | Brand | Why it is here |
|----|----------|-------|----------------|
| 4204003607 | LCI Pakistan | Authority | line carries the 0.1 placeholder; nothing packed yet |
| 4204003087 | LCI Pakistan | Ferti Rise | no price anywhere; nothing packed |
| 7500003652 | Arysta Life Sciences | Fruitlish | no price anywhere; nothing packed |
| VG-2605-0002 | Vgreen | 5 brands | no price anywhere; nothing packed |

Nothing has been packed against any of them, so there is no bag to read the
answer off. These need the price from the customer or the list.

---

## Part C — correct the 23 placeholder packing rows

All currently recorded at **0.1**. Correct through the ledger, with a reason and
the source above.

### 18 rows → no price printed (Maxim Agri)

| Record | PO | Brand | Kg | Packed |
|--------|----|-------|----|--------|
| PK1113 | 22032 | Max Amino | 300 | 11 Jun |
| PK1114 | 22033 | Max Amino | 300 | 11 Jun |
| PK1111 | 22032 | Max Boron | 300 | 11 Jun |
| PK1112 | 22033 | Max Boron | 300 | 11 Jun |
| PK1109 | 21630 | Max Compost | 1,575 | 11 Jun |
| PK1364 | 22032 | Max Potash | 13,800 | 15 Jun |
| PK1557 | 22032 | NPK 16:18:18 | 2,000 | 15 Jun |
| PK1269 | 22032 | Max Humic | 4,000 | 18 Jun |
| PK1268 | 22033 | Max Humic | 4,000 | 18 Jun |
| PK1311 | 22032 | Max Phos | 15,000 | 18 Jun |
| PK1359 | 22032 | Enroot | 10,780 | 19 Jun |
| PK1358 | 22033 | Enroot | 7,000 | 19 Jun |
| PK1382 | 21775 | Max Amino | 300 | 20 Jun |
| PK1377 | 22033 | Max Zinc | 2,000 | 20 Jun |
| PK1376 | 22032 | Max Zinc | 1,208 | 20 Jun |
| PK1375 | 22032 | Max Zinc | 792 | 20 Jun |
| PK1454 | 22033 | Max Compost | 2,500 | 22 Jun |
| PK1556 | 22032 | Max Potash | 11,200 | 28 Jun |

### 2 rows → the real dealer price (confirmed by the COO)

| Record | PO | Brand | Kg | Correct to |
|--------|----|-------|----|-----------|
| PK1551 | DLR-2606-0001 | Humi Grow | 136 | **3,100** |
| PK1550 | DLR-2606-0001 | V-Zinc | 200 | **4,800** |

### 1 row → blocked

| Record | PO | Brand | Kg | Status |
|--------|----|-------|----|--------|
| PK1366 | 260400001 | Humi Cash | 8,000 | waits for the *supplied* option |

### 2 rows → still need a number

| Record | PO | Channel | Brand | Kg | Note |
|--------|----|---------|-------|----|------|
| PK1390 | VG-VC-2606-6451 | Vgreen | V-Mg Essential | 500 | **Very likely 1,350** — that brand shows 1,350 on five other rows across Dealer, Cobo and Farmer, and on the Farmer order line. Worth confirming rather than assuming, since printed MRP can vary. |
| PK1313 | COBO-2606-2537 | Cobo | V-Ammonium Phosphate | 1,500 | **No evidence anywhere.** This is the only packing row that brand has, and no order line carries a price for it. Needs a number from a person. |

---

## What is left after all of this

Two numbers (above), four print-on-pack decisions, and one PO waiting on a code
change. Everything else in the price backlog closes.

Then the build order stands as agreed: the fourth option, the slip itself, the
refusal at packing with the Data Fix door shut in the same pass, the Plant
Manager's three cases in the Action Center recorded separately, and the Action
Center learning to say "blocking now" rather than only "waiting a long time".

## The threshold, now settled

Sunday is a working day, so **one working day is one calendar day** and no
calendar needs building. The Plant Manager covers Saturday when QA is away.

One wording point still worth taking: measure the wait to when the **bags are
needed**, not from when the slip was raised. A slip raised Thursday afternoon for
Friday's early run would otherwise only become releasable on Friday afternoon —
after the run. *"Unsigned at the end of the day it was raised"* gives QA the whole
day and puts the recovery the evening before.

---

# Answered — 22 August, end of day

| Question | Answer |
|----------|--------|
| Vgreen V-Mg Essential (PK1390) | **1,350** — confirmed. Correct the row. |
| The four POs with nothing packed | **Leave them** until something is packed against them |
| When the Plant Manager can sign for QA | **End of the working day the slip was raised** |
| What gets built first | **The Action Center urgency fix** |

## What that means for the sheet

**Part C is now one row short of complete.** PK1390 goes to 1,350. The only row
left without a number is **PK1313 — Cobo, V-Ammonium Phosphate, 1,500 Kg, packed
17 June**. It is the only packing row that brand has ever had and no order line
prices it, so there is nothing in the system to infer from. It needs a person.

**Part B loses its "needs a decision" section.** 4204003607, 4204003087,
7500003652 and VG-2605-0002 stay unanswered on purpose. Nothing has been packed
against any of them, so no bag has gone out wrong and nothing is at risk. The
question becomes answerable the moment the first pack is planned — which is
exactly when the slip will ask it. That is the honest position rather than a
guess recorded as an answer.

## The threshold, final wording

> **If the printing slip is still unsigned at the end of the working day it was
> raised, the Plant Manager can sign it.**

QA gets the whole day. The recovery lands the evening before the run rather than
after it. Sunday is a working day, so this is a plain day boundary and no
calendar has to be built.

The Plant Manager signs in three situations, and the record must keep them apart:

| Case | What it is |
|------|-----------|
| Late | unsigned at day's end — cover |
| Absent | QA on leave — cover |
| **Overruled** | **QA refused to sign Production's price — a decision** |

Only the third is a control being set aside. It gets its own count in the report.

## Build order, decided

1. **The Action Center urgency fix.** Smallest piece and everything depends on
   it. Today a slip due tomorrow and a dispute raised this morning both sort to
   the bottom of My Actions, below a five-day-old inspection — because urgency is
   worked out purely from how long something has waited (`actUrg`), and
   `actTiming` clamps a future date to zero days. Build the slip before this and
   nobody sees it in time. It also improves the screen the team already uses
   every day, so the benefit is not conditional on the slip landing.
2. The `supplied` option, unblocking UDPL.
3. The slip itself.
4. The refusal at packing, with the Data Fix door closed in the same pass.

Each goes through the reviewers before any code, per the standing rule.

---

# 22 August — the last number. The sheet is complete.

**Cobo V-Ammonium Phosphate is 6,700.**

That was the only row in the entire price backlog with nothing to infer from —
the single packing row that brand has ever had, on an order line carrying no
price. It now has a number, and **every row in this sheet is answerable.**

## Two places it goes

| Where | What | Now |
|-------|------|-----|
| Packing row **PK1313** | COBO-2606-2537, V-Ammonium Phosphate, 1,500 Kg, packed 17 June | 0.1 → **6,700** |
| Order line | COBO-2606-2537 · V-Ammonium Phosphate | 0 → **6,700** |

So **Part A is 15 order lines, not 14**, and the coverage rises to **129,915 Kg**.

## The backlog, closed

| | Count | Status |
|---|-------|--------|
| Order-line prices to set | 15 | every number known |
| Print-on-pack answers | 21 orders | 5 no-price · 11 yes · 1 held (UDPL) · 4 deliberately left |
| Packing rows to correct | 23 | 18 no-price · 4 priced · 1 held |

Nothing in the price backlog is now waiting on information. What remains is
either a correction to make, a deliberate decision to leave something open, or
the one PO that waits on the `supplied` option being built.

**Source on every correction:** *Tahir (COO), 22 August 2026.*
