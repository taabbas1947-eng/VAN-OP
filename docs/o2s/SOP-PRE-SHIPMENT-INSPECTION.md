# SOP · Pre-shipment inspection

**Who:** QA Inspector
**When:** After packing, **before** the truck is loaded
**Where in O2S:** Pre-shipment QA screen
**Version:** 1.0 · 21 August 2026

---

## Why this step exists

Once a truck leaves the gate, nothing can be corrected. The bag is in the
market with whatever is printed on it. This inspection is the last point at
which a mistake costs nothing but a few minutes.

Your signature on it says four things happened:

1. The material is the right quality and properly packed
2. The **price on the bag is what the customer's PO requires** — including no
   price at all, where that is what they asked for
3. The **batch number** on the bag matches the record, so it can be traced years
   from now
4. The **manufacturing and expiry dates** on the bag match the record

If any of those is not true, the lot does not ship.

---

## Before you start

**Have the physical pack in front of you.** Not the pallet, not the label
sheet — an actual finished bag from the lot you are inspecting. You are
comparing the bag against the screen. You cannot do that from memory.

Open the lot in O2S. The panel at the top of the inspection screen shows you
what the PO requires. Read it before you look at the bag, not after.

---

## Step 1 · The price check

The amber panel at the top tells you which of four situations you are in.

### **MRP 1,250 /pack** — a price is required

Read the number on the bag. Compare it to the number on the screen.

| | |
|---|---|
| Same | Mark item 3 **Pass** |
| Different | Mark item 3 **Fail**. Write both numbers in Remarks — what the PO says and what the bag says |
| No price on the bag at all | Mark item 3 **Fail**. The PO requires one |

If the screen shows a red warning saying *the lot was packed at PKR X — does
not match the PO*, that means Production recorded a different price at packing
than the PO authorises. **Check the physical bag before you decide.** The bag
is the evidence. The screen is telling you where to look.

### **No price on pack** — no price is required

This client does not want a price on the bag. **This is correct and normal.**

| | |
|---|---|
| No price on the bag | Mark item 3 **Pass** |
| Any price printed on the bag | Mark item 3 **Fail**. Write in Remarks what the bag says |

A price appearing where the customer asked for none is just as serious as a
wrong price. It goes to the same market and it is just as hard to take back.

### **MRP not set** — a price is required but none is recorded

This PO is set to print a price and nobody entered one.

**Do not guess. Do not pass it.** Call the KAM on the PO and get the number.
If you cannot reach them, stop the lot and tell the Plant Manager. Write what
you did in Remarks.

### **Print price not specified** — we do not know

An older PO, or one loaded during the changeover, from before the system
started recording this decision.

Check the customer's PO document itself. If it shows a price, treat it as the
first case. If it clearly does not, treat it as the second. Either way, write
in Remarks what you found and tell the KAM so it gets recorded properly on the
PO — so the next inspector does not have to do this again.

---

## Step 2 · Batch number

The panel shows the batch number that should be printed: *Batch on pack should
read **VGP-26-0088***.

Read it off the bag. Same → **Pass**. Different, missing, or smudged past
reading → **Fail**.

A bag whose batch number cannot be read is a bag that cannot be traced. That is
the whole reason we number batches.

---

## Step 3 · Manufacturing and expiry dates

The panel shows both. Compare both against the bag.

Watch for the expiry being more than two years after manufacture — the system
defaults to two years and it can be edited, so an unusual gap is worth a second
look before you pass it.

---

## Step 4 · The rest of the checklist

Work through the remaining items on the physical material, not from the record:

- Packaging intact and correct
- Label and artwork correct
- Net weight / count verified
- Seal and closure OK
- Cleanliness — no contamination
- No leakage or damage
- Pallet and loading condition

Every item must be marked **Pass** or **Fail** before the form will save.

---

## Step 5 · Sign and record

**Inspector name.** Type your own full name. QA currently shares one login, so
this box is the only record of who actually did the inspection. Do not type a
department, a shift, or initials. Type your name.

**Remarks.** Use it. It is now a proper box and you can write a real sentence.

Write something whenever:

- anything failed — say exactly what you saw, with the numbers
- something looked unusual but you passed it anyway — say what and why
- you had to check the paper PO or call anyone — say who and what they said
- the material was held up, or you inspected it later than you should have —
  say why

A blank Remarks box on a passed lot is fine. A blank Remarks box on a failed
lot is not — the next person has nothing to work with.

---

## When a lot fails

Failing is not a problem. **Passing something you were unsure about is.**

A failed lot leaves the inspection queue and goes to Supply Chain to correct.
Once corrected it comes back for re-inspection, and both inspections stay on
the record. Nothing is lost by failing something and being wrong. A great deal
is lost by passing something and being wrong.

If you are unsure and cannot resolve it — a price you cannot confirm, a batch
number that does not look right, artwork you have not seen before — **stop and
ask the Plant Manager.** Do not pass it while you wait.

---

## One thing to know about the date

The system currently stamps your inspection with **today's date**, whatever day
you actually did it. There is no field for the real date yet. That is being
fixed.

Until it is: **inspect and record on the same day.** If you inspected on Monday
and only get to a screen on Thursday, the record will say Thursday and there is
no way to correct it. Write the real date in Remarks so at least the truth is
somewhere.

---

## Quick reference

| Panel says | Bag should have | Fail if |
|---|---|---|
| **MRP 1,250 /pack** | That exact price | Different price, or no price |
| **No price on pack** | No price at all | Any price is printed |
| **MRP not set** | Unknown — ask the KAM | Do not pass until you know |
| **Print price not specified** | Check the paper PO | Do not pass until you know |

**Batch #** on the bag must match the panel exactly.
**Mfg and expiry** on the bag must match the panel exactly.
**Type your own name.** **Write real remarks.** **Record it the same day.**

---

*Issued 21 August 2026 · O2S Pre-shipment QA · review when the two-date change
goes live.*
