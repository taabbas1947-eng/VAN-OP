# The 0.1 price — what it is, why it happened, and the 8 POs that fix it

VAN / O2S. 22 August 2026. Figures from the data snapshot on record (16 July);
live will have more.

---

## What it is

23 of the 102 packing runs on record carry a printed price of **0.1 rupees**.
Nine dates, June and July, every one marked verified by Production. None is
flagged as a no-price pack, so every price report in O2S reads 0.1 as a real
number.

## Why it happened — and it is not the operator's fault

The packing screen asks for the price that goes on the bag and will not accept
zero:

> *"Enter the price that is printed on the pack."*

There **is** a "no price on this pack" option in the code. It looks like this:

```js
if(pol.mode==='noprint') return form.noPrice ? null : 'Confirm that no price is printed on this pack.';
if(!(+form.price>0))     return 'Enter the price that is printed on the pack.';
```

The `noprint` option only appears when the ORDER has been answered — when
somebody has said, on the PO, that this order's bags carry no price.
**No order in the system has been answered.** So the option never appears, the
operator is asked for a number they do not have, and they type 0.1 to get past
the screen.

**This means the fix needs no code.** Answer the print-on-pack question on the
order and the legitimate "no price" option opens by itself. The workaround stops
at the source.

## The whole thing is 8 POs

| PO | Rows | Channel | Customer |
|----|------|---------|----------|
| 22032 | 10 | White Label | MAXIM AGRI (PVT) LTD |
| 22033 | 6 | White Label | MAXIM AGRI (PVT) LTD |
| DLR-2606-0001 | 2 | Dealer | Kissan Zarai Merkaz |
| 21630 | 1 | White Label | MAXIM AGRI (PVT) LTD |
| 21775 | 1 | White Label | MAXIM AGRI (PVT) LTD |
| 260400001 | 1 | White Label | UNITED DISTRIBUTOR PAKISTAN LTD |
| COBO-2606-2537 | 1 | Cobo | VITAL AGRI NUTRIENTS (PVT) LTD |
| VG-VC-2606-6451 | 1 | Vgreen | Vgreen |

None of the eight has a print-on-pack answer recorded. Answer these eight and
you have covered every 0.1 on record.

---

## What was actually printed on the bags

**The Dealer bags were correct.** Confirmed by the COO: the real dealer list
price was printed on them. So the bag that went to the customer is right and the
record in O2S is wrong — this is a record correction, not a product problem.

Those two rows need the real number putting in, through the correction ledger so
the change carries a reason and a name:

| Record id | PO | Brand | Brand batch | Kg | Packed | Needs |
|-----------|----|-------|-------------|----|--------|-------|
| PK1551 | DLR-2606-0001 | Humi Grow | HG26002 | 136 | 2026-07-01 | the real dealer list price |
| PK1550 | DLR-2606-0001 | V-Zinc | VZ10025 | 200 | 2026-07-01 | the real dealer list price |

**The other 21 have not been confirmed.** They are White Label (Maxim Agri,
United Distributor), Cobo and Vgreen — orders where VAN's MRP would not normally
go on the bag at all. If that is right, those records should say *no price
printed*, not 0.1. **Somebody has to confirm that before the records are
changed**, because "0.1 was a placeholder for no price" and "0.1 was a
placeholder for a price we did not have to hand" are different corrections.

---

## The full 23

| # | Channel | PO | Customer | Brand | Brand batch | Kg | Packed on | Record id |
|---|---------|----|----------|-------|-------------|----|-----------|-----------|
| 1 | Cobo | COBO-2606-2537 | VITAL AGRI NUTRIENTS | V-Ammonium Phosphate | AP26009 | 1,500 | 2026-06-17 | PK1313 |
| 2 | Dealer | DLR-2606-0001 | Kissan Zarai Merkaz | Humi Grow | HG26002 | 136 | 2026-07-01 | PK1551 |
| 3 | Dealer | DLR-2606-0001 | Kissan Zarai Merkaz | V-Zinc | VZ10025 | 200 | 2026-07-01 | PK1550 |
| 4 | Vgreen | VG-VC-2606-6451 | Vgreen | V-Mg Essential | MG10320 | 500 | 2026-06-20 | PK1390 |
| 5 | White Label | 22033 | MAXIM AGRI | Max Amino | AM26002 | 300 | 2026-06-11 | PK1114 |
| 6 | White Label | 22032 | MAXIM AGRI | Max Amino | AM26002 | 300 | 2026-06-11 | PK1113 |
| 7 | White Label | 22033 | MAXIM AGRI | Max Boron | MAXB26001 | 300 | 2026-06-11 | PK1112 |
| 8 | White Label | 22032 | MAXIM AGRI | Max Boron | MAXB26001 | 300 | 2026-06-11 | PK1111 |
| 9 | White Label | 21630 | MAXIM AGRI | Max Compost | MAXC26001 | 1,575 | 2026-06-11 | PK1109 |
| 10 | White Label | 22032 | MAXIM AGRI | Max Potash | MAXNK26007 | 13,800 | 2026-06-15 | PK1364 |
| 11 | White Label | 22032 | MAXIM AGRI | NPK 16:18:18 | MAXM26001 | 2,000 | 2026-06-15 | PK1557 |
| 12 | White Label | 22032 | MAXIM AGRI | Max Humic | MAXH26003 | 4,000 | 2026-06-18 | PK1269 |
| 13 | White Label | 22033 | MAXIM AGRI | Max Humic | MAXH26003 | 4,000 | 2026-06-18 | PK1268 |
| 14 | White Label | 22032 | MAXIM AGRI | Max Phos | MAXAP26004 | 15,000 | 2026-06-18 | PK1311 |
| 15 | White Label | 22032 | MAXIM AGRI | Enroot | MAXNP26005 | 10,780 | 2026-06-19 | PK1359 |
| 16 | White Label | 22033 | MAXIM AGRI | Enroot | MAXNP26005 | 7,000 | 2026-06-19 | PK1358 |
| 17 | White Label | 21775 | MAXIM AGRI | Max Amino | MAXAM26002 | 300 | 2026-06-20 | PK1382 |
| 18 | White Label | 22033 | MAXIM AGRI | Max Zinc | MAXZ10320 | 2,000 | 2026-06-20 | PK1377 |
| 19 | White Label | 22032 | MAXIM AGRI | Max Zinc | MAXZ10320 | 1,208 | 2026-06-20 | PK1376 |
| 20 | White Label | 22032 | MAXIM AGRI | Max Zinc | MAXZ10320 | 792 | 2026-06-20 | PK1375 |
| 21 | White Label | 260400001 | UNITED DISTRIBUTOR PAKISTAN | Humi Cash | UDPLKH26007 | 8,000 | 2026-06-20 | PK1366 |
| 22 | White Label | 22033 | MAXIM AGRI | Max Compost | MAXGC26001 | 2,500 | 2026-06-22 | PK1454 |
| 23 | White Label | 22032 | MAXIM AGRI | Max Potash | MAXNK26007 | 11,200 | 2026-06-28 | PK1556 |

---

## Order of work

1. **Answer print-on-pack on the eight POs above.** No code. Stops it recurring
   and opens the legitimate "no price" option for those orders.
2. **Confirm what was physically on the 21 White Label / Cobo / Vgreen bags.**
   One answer covers all of them if the answer is "no VAN price on white label".
3. **Correct the two Dealer rows** with the real dealer list price, through the
   correction ledger (`printedPrice` on the packing lot — Production or COO, with
   a reason).
4. **Then correct the other 21** to match what step 2 establishes.

## One thing worth knowing about step 3

The `printedPrice` field on a packed lot carries **no lock**. It can be changed
after QA has cleared the lot and after the goods have shipped, by Production. For
this cleanup that is convenient. As a standing rule it is a hole, and it is on
the list to close when the slip work goes in.

---

# 22 August, later — the COO's answers, and a fourth case nobody had

## Maxim Agri: no price on their bags — 18 of the 23 rows are settled

Confirmed by the COO. So four POs can be answered **"no price printed"** today,
and that closes eighteen rows:

| PO | Rows | Answer |
|----|------|--------|
| 22032 | 10 | No price printed |
| 22033 | 6 | No price printed |
| 21630 | 1 | No price printed |
| 21775 | 1 | No price printed |

This answer is correct and the system handles it properly. `qcExpect` will tell
the inspector *"no price should appear on this pack"*, and `mrpCheckHtml` inverts
the check — for a no-print PO the failure is a price **appearing** on a bag that
should carry none. That is exactly right for Maxim.

**Expect this side effect, it is not a fault.** The moment those four POs are
answered, the eighteen historic 0.1 rows will start showing a red warning:
*"but the lot was packed at PKR 0.1 /pack — CHECK THE BAG, this PO should carry
NO printed price"*. That is the system correctly pointing at the rows that need
correcting. It is the worklist making itself.

## UDPL: a case the system cannot express — DO NOT ANSWER THIS ONE YET

The COO: *"UDPL send us bags with price already printed so we have no action on
price in case of UDPL."*

There is a printed price on those bags. It is just not VAN's, and VAN neither
sets it nor verifies it. The system has three answers and **all three are wrong
here**:

| If answered | The inspector is told | Why it is wrong |
|-------------|----------------------|-----------------|
| No price | *"no price should appear on this pack"* | There IS a price. The inspector gets a red warning on a bag that is correct. |
| List price | *"check the bag against the latest price list"* | The number is not on VAN's list. Wrong authority. |
| Yes + price | VAN authorised this number | VAN did not set it. |

The dangerous one is the first, because it is the one that looks closest. It
would put a false failure in front of the inspector on every UDPL lot, and a
warning that is wrong every time is a warning people learn to click past.

**So leave PO 260400001 unanswered until there is a fourth option.**

### The fourth option

A `printDecision` value of **`supplied`** — *bags supplied pre-printed by the
customer*:

- **Packing:** no price asked for, same as no-print
- **Record:** `priceSource:'customer'`, `printedPrice:null`, and **not**
  `noPrintPack` — because a price does exist, it is simply not ours
- **Inspection:** *"the customer supplies these bags printed. Check the bag
  matches what they sent. Do not check it against a VAN price."*
- **Printing slip:** no slip at all. VAN is not printing these bags, so there is
  nothing for QA to sign and nothing to send to the printing supervisor.

That last point matters for the slip design: this is the first case where the
right answer is *no slip exists*, and the design had no branch for it.

## The question that decides how big this is

White Label is not one customer. On the record it is **six**:

| Customer | Packing rows | Kg |
|----------|--------------|-----|
| SYNGENTA PAKISTAN LIMITED | 58 | 348,020 |
| MAXIM AGRI (PVT) LTD | 18 | 77,355 |
| RUDOLF LIFE SCIENCES | 3 | 50,560 |
| UNITED DISTRIBUTOR PAKISTAN LTD | 1 | 8,000 |
| LCI PAKISTAN LIMITED | 0 (ordered, not yet packed) | — |
| ARYSTA LIFE SCIENCES (PVT) LTD | 0 (ordered, not yet packed) | — |

Syngenta alone is 57% of every packing run on record and 348 tonnes.

**Do Syngenta, LCI, Rudolf and Arysta also supply their own pre-printed bags?**
If they do, "supplied" is not a UDPL edge case — it is how most of the volume
actually works, and it should be built before anything else on the price side.
If they do not, it is one PO and it can wait.

## Where the 23 rows stand now

| Rows | Customer | Status |
|------|----------|--------|
| 18 | Maxim Agri | **Answered** — no price. Answer the four POs, then correct the rows. |
| 2 | Kissan Zarai Merkaz (Dealer) | Real dealer list price was printed. **Needs the number.** |
| 1 | United Distributor | **Blocked** — needs the fourth option first. |
| 1 | Vital Agri Nutrients (Cobo) | Not answered. |
| 1 | Vgreen | Not answered. |
