# SOP · Pre-shipment inspection

**Who:** QA Inspector
**When:** After packing, **before** the truck is loaded
**Where in O2S:** Pre-shipment QA → *Inspect…*
**Version 2.0 · 21 August 2026** — replaces v1.0 of the same date

> **v1.0 is withdrawn.** It told you the system stamps today's date automatically
> and that you should write the real date in Remarks. **That is no longer true and
> following it now would put the wrong date on the record.** The date is a field
> you fill in. Everything below reflects what the screen actually does today.

---

## Why this step exists

Once a truck leaves the gate nothing can be corrected. The bag is in the market
with whatever is printed on it.

Your signature on this record says four things happened:

1. You checked a **proper sample** of the bags — not the whole lot, and not one bag
2. The **price on the bag** is what the customer's PO requires — including *no
   price*, where that is what they asked for
3. The **batch number** matches the record, so the material can be traced years from now
4. The **manufacturing and expiry dates** match the record

**A truck can no longer be released until this inspection passes.** As of today
the Plant Manager's release button refuses without it. You are not paperwork at
the end of the process; you are the gate.

---

## Before you start

**Have real bags in front of you.** Not the pallet, not a label sheet — actual
finished bags from the lot, opened and looked at.

Open the lot in O2S and read the screen before you touch the bags. It tells you
how many to check and what they should say.

---

## Step 1 · How many bags to check

The screen works this out for you from the size of the lot, using **ISO 2859-1**:

> Lot **1,000** packs · level **II**, AQL **2.5** · code **J**
> → check **80** bags · accept if defects ≤ **5**, reject at **6**

Roughly, for a sense of scale:

| Lot | Bags to check | Accept up to |
|---|---|---|
| 40 packs | 8 | 0 defects |
| 200 | 32 | 2 |
| 1,000 | 80 | 5 |
| 5,000 | 200 | 10 |
| 20,000 | 315 | 14 |

Two boxes to fill:

- **Bags actually opened and checked** — the true number. Not the number you were
  supposed to check
- **Defective bags found** — 0 if none

> **If you check fewer bags than it asks for**, the system will not stop you, but
> it will not save until you say **why** in Remarks — *"only 40 bags reachable,
> rest already strapped on the pallet"* is a perfectly good reason. The record and
> the printed report will both show **REDUCED SAMPLE**. That is honest, and far
> better than claiming a full sample you did not take.

> ⚠️ **The accept / reject numbers are not yet verified.** They are the system's
> best reading of the standard and the QCM has not yet checked them against a real
> copy of ISO 2859-1. Until that happens the numbers are **advice, not a rule** —
> the system will not reject a lot on them. **Use your judgement, and if the count
> looks wrong to you, hold the lot and ask the QCM.**

---

## Step 2 · The three record checks

These three are where you are **comparing the bag against a record**. Each one
shows you what to expect, so you are never checking a batch number from memory.

### Price on the pack is as the PO requires

The screen tells you which of four situations you are in:

| What it says | What the bag should show | Fail if |
|---|---|---|
| **expected PKR 1,250 /pack** | exactly that price | different price, or no price at all |
| **no price should appear on this pack** | no price anywhere | **any** price is printed |
| **this PO prints a price but none is set** | unknown — **ask the KAM** | do not pass until you know |
| **not recorded — check the client PO** | unknown — check the paper PO | do not pass until you know |

A price appearing where the customer asked for none is just as serious as a wrong
price. It reaches the same market and is just as hard to take back.

### Batch # on the pack matches the record

The screen shows the expected number, e.g. **ZR-2026-0042**. Read it off the bag.
Different, missing, or smudged past reading → **Fail**. A bag whose batch number
cannot be read cannot be traced, and tracing is the whole reason we number batches.

### Mfg & expiry on the pack match the record

Both are shown. Compare both. Watch for an expiry more than two years after
manufacture — the system defaults to two years and it can be edited, so an unusual
gap is worth a second look.

**All three must be marked. Any Fail fails the lot**, even if all eight items in
the next section pass.

---

## Step 3 · The eight-point checklist

Work through these on the physical material:

- Packaging intact & correct
- Label / artwork correct
- Net weight / count verified
- Seal & closure OK
- Cleanliness — no contamination
- Batch & expiry printed
- No leakage / damage
- Pallet / loading condition

Every item must be Pass or Fail before the form will save.

---

## Step 4 · The date

**"Date this material was actually inspected."** It defaults to today. If you
inspected it today, leave it and move on — nothing else appears.

If you inspected it on an earlier day, **change it to the real day**. A box will
appear asking why it is being recorded now. Answer it honestly — *"inspected on
the floor Friday, keyed Monday"*, *"terminal was down"*, *"paperwork reached me
late"*. Six characters minimum, and a real sentence is better.

Two things it will refuse:

- **A date in the future.** There is no honest version of this
- **A late date with no reason**

The record keeps both dates — when it happened and when you typed it. The printed
report shows the gap: *"Inspected 2026-08-16, recorded 2026-08-21 — 5 days later."*

**Inspect and record on the same day wherever you can.** The gap is not a
punishment, it is the truth, and management can now see it.

---

## Step 5 · Sign and record

**Inspector name.** Type your own full name. QA currently shares one login, so
this box is the only record of who did the inspection. Not a department, not a
shift, not initials — **your name**.

**Remarks.** Use it. Write something whenever:

- anything failed — exactly what you saw, with numbers
- something looked unusual but you passed it — what, and why
- you checked fewer bags than asked — why *(required)*
- you had to check the paper PO or call anyone — who, and what they said

A blank Remarks on a clean pass is fine. A blank Remarks on a fail is not — the
next person has nothing to work with.

---

## When a lot fails

Failing is not a problem. **Passing something you were unsure about is.**

A failed lot leaves the queue and goes to Supply Chain to correct, then comes back
for re-inspection. Both inspections stay on the record. Nothing is lost by failing
something and being wrong. A great deal is lost by passing something and being
wrong.

If you cannot resolve something — a price you cannot confirm, a batch number that
looks off, artwork you have not seen — **stop and ask the Plant Manager. Do not
pass it while you wait.**

---

## Quick reference

**Sample:** the screen tells you how many. Enter the true number checked and the
defects found. Fewer than asked → say why.

| Screen says | Bag should have | Fail if |
|---|---|---|
| **expected PKR x /pack** | that exact price | different, or none |
| **no price should appear** | no price at all | any price printed |
| **not set** / **not recorded** | ask the KAM / check the PO | do not pass until you know |

**Batch #** must match exactly. **Mfg and expiry** must match exactly.
**Type your own name.** **Real date.** **Real remarks.**

---

*Issued 21 August 2026, v2.0. Review when the QCM has verified the AQL table, and
again when QA staff get individual logins.*
