# Where the printed price actually comes from — and where it is recorded

VAN / O2S. 22 August 2026. Every figure measured from the data snapshot on
record (16 July). Live will differ; the shape will not.

---

## The four ways a price gets onto a VAN bag

The COO's answers today complete the picture. There are four, and the system
only knows about two of them.

| # | Case | Who sets the price | Who prints | In the system today |
|---|------|--------------------|------------|---------------------|
| 1 | **Maxim Agri** | nobody — no price on the bag | VAN | Yes — answer "no price" |
| 2 | **Syngenta, LCI, Rudolf, Arysta** | the customer, on the PO **or later by email** | VAN | Partly — no record of the email |
| 3 | **United Distributor** | the customer | **the customer** — bags arrive pre-printed | **No.** No option fits. |
| 4 | **Cobo, Vgreen, Dealer, Farmer, Distributor** | VAN | VAN | Yes — a price on the line |

Case 2 is the important one. It is the biggest block of volume, and **the price
arrives by email after the order is placed.** Nothing in O2S records that email.

---

## What that costs: 128,293 Kg with a price that is written down nowhere

Of the 102 packing runs on record:

| | Rows | Kg |
|---|---|---|
| Price matches the order line — clean | 53 | 285,754 |
| **Price exists ONLY on the packing row** | **24** | **128,293** |
| The 0.1 placeholder | 23 | 87,691 |
| Price differs from the order line | 2 | 122 |

**Nearly half the packing runs have a price problem of some kind.**

### The 128,293 Kg, largest first

| Kg | Customer | PO | Brand | Printed at | Order line says |
|----|----------|----|----|------------|-----------------|
| 68,195 | Syngenta | 6595010236 | Enrich | 4,500 | 0 |
| 37,500 | Rudolf Life Sciences | 1821412156 | Orbit-K | 23,750 | 0 |
| 13,060 | Rudolf Life Sciences | 1821412156 | Basic | 13,750 | 0 |
| 7,000 | Vital Agri (Cobo) | COBO-2606-2537 | Vital Potash | 10,500 | 0 |
| 1,500 | Vital Agri (Cobo) | COBO-2606-2537 | V-Mg Essential | 1,350 | 0 |
| 585 | Kissan Zarai Merkaz | DLR-2606-0001 | V-Mg Essential | 1,350 | 0 |
| 400 | BKK (Distributor) | 202600422 | Vibrant | 6,000 | 0 |
| 17 | Afaq Zari Merkaz | DLR-2605-0001 | Tornado | 795 | 0 |
| 12 | Vital Agri (Cobo) | COBO-2606-2537 | VL-NPK | 1,250 | 0 |
| 12 | Vital Agri (Cobo) | COBO-2606-2537 | Tornado | 795 | 0 |
| 8 | Kissan Zarai Merkaz | DLR-2606-0001 | VL-NPK | 1,250 | 0 |
| 4 | Kissan Zarai Merkaz | DLR-2606-0001 | Tornado | 795 | 0 |

The numbers themselves look right — 4,500 for Enrich, 23,750 for Orbit-K. Nobody
invented them. Somebody read them off an email or a price list and typed them in.

**But that is the entire record.** There is no PO line carrying the number, no
reference to the email it came from, no approval, and no name attached to it
beyond the word "Production". If Syngenta ever questions the MRP on 68 tonnes of
Enrich, there is nothing in the system to point at.

**This is the CFO's concern, stated as a measurement rather than a worry.** It is
also the single strongest argument for the printing slip: the slip's *"taken
from"* line is exactly the record that does not exist today.

### The two mismatches

| Record | PO | Brand | Line says | Printed |
|--------|----|-------|-----------|---------|
| PK1389 | VG-VC-2606-6451 | VL-NPK | 1 | 1,250 |
| PK1384 | VG-VC-2606-6451 | Tornado | 1 | 795 |

Both Vgreen, both the same placeholder story: someone typed 1 on the order to get
past PO entry, and the operator printed the correct VAN price. The bags are
right; the orders are wrong.

---

## The good news, and it is bigger than the bad news

**For VAN's own brands, the printed MRP is ONE number per brand across every
channel in this data.** Not a single brand shows two different printed prices:

| Brand | Printed MRP | Channels it appears in |
|-------|-------------|------------------------|
| VL-NPK | 1,250 | Farmer, Vgreen, Dealer, Cobo |
| V-Mg Essential | 1,350 | Dealer, Cobo, Farmer |
| Tornado | 795 | Dealer, Vgreen, Cobo |
| V-Transfarm | 1,875 | Farmer |
| Vital Potash | 10,500 | Cobo |
| Fusion Potash | 13,000 | Dealer |
| Vital Urea | 6,500 | Dealer |
| Vibrant | 6,000 | Distributor |

VL-NPK is sold through four different channels at one printed price.

### Why this matters so much

The COO parked the price list because *"customer wise, regional wise, channel
wise same brand price differ, so we have to be very thoughtful while building
it."* That is a fair description of a **trade price** — what the customer pays.
It does not look like a description of the **MRP printed on the bag** — what the
consumer sees.

O2S already keeps those apart: `invoicePrice` (CFO and COO only) and `printPrice`
(what goes on the pack). If the customer/region/channel variation lives in the
invoice price and the printed MRP is one number per brand, then **the price list
needed for printing is a short list of brands and numbers, not a matrix** — and
it could be built in an afternoon rather than being the large careful project it
was parked as.

**This needs the COO to confirm, not the data.** Eight brands in a July snapshot
is suggestive, not conclusive, and he knows the market. But it is worth asking
before the price list is treated as a big job.

---

## What to do, in order

1. **Answer the four Maxim POs** — 22032, 22033, 21630, 21775 — as no price on
   pack. 18 of the 23 placeholder rows, no code.
2. **Put the real prices onto the Syngenta, Rudolf, Cobo and Vgreen order lines**
   — Enrich 4,500, Orbit-K 23,750, Basic 13,750, Vital Potash 10,500, VL-NPK
   1,250, Tornado 795, V-Mg Essential 1,350. The numbers are already proven by
   what was packed. This closes 24 rows and 128 tonnes of unrecorded pricing.
3. **Settle the MRP-versus-invoice-price question.** If the printed MRP is one
   number per brand, the price list stops being a blocker.
4. **Build the fourth option** — bags supplied pre-printed by the customer — then
   answer UDPL. Only one PO, so this is no longer urgent.
5. **Then the slip**, whose "taken from" line becomes the record of the customer
   email that today exists only in somebody's inbox.

## One thing that changes about the slip design

Case 2 — the customer emails the price after the order — is where the slip earns
its keep. The chase for that number happens today by phone and inbox, and the
result is typed straight onto a packing row. The slip moves that chase to a
recorded step with a name, a date, and a source, one day before the bags are
printed.

Case 3 — UDPL — is the first case where the correct answer is that **no slip
exists at all**, because VAN is not printing the bag. The design needs that
branch.

---

# 22 August, later — the COO corrected me, and it settles the design

## I was wrong: the printed MRP does vary

I suggested that because every VAN own-brand showed a single printed price
across every channel in the July snapshot, the printed MRP might be one number
per brand and the parked price list might be a short list rather than a matrix.

**The COO: the printed MRP can vary.** Eight brands in a five-week window was a
coincidence of the sample, not a rule. The price list stays parked as the
careful piece of work it was called, and nothing in the slip design should assume
a single lookupable number per brand.

## The dealer numbers, so those two records can be corrected

DLR-2606-0001, Kissan Zarai Merkaz:

| Record | Brand | Kg | Correct printed price |
|--------|-------|----|----------------------|
| PK1551 | Humi Grow | 136 | **3,100** |
| PK1550 | V-Zinc | 200 | **4,800** |

Both currently recorded at 0.1. The bags were right; the records were not.

## The decisive one: on a large PO the price can change mid-PO

The COO: *"Syngenta and Rudolf orders are large POs and price can change in mid
of the PO."*

This changes the architecture, and it withdraws a recommendation I made
yesterday.

### Why "put the price on the order line" is wrong for these

`l.printPrice` holds **one number for the whole line**. Writing 4,500 onto the
Syngenta Enrich line claims that all 271,504 Kg of it carries 4,500. If the price
moves after 150,000 Kg, the line is now wrong about everything that follows, and
correcting it makes it wrong about everything before. **A single field cannot
hold a price that changes over time.**

The exposure is real and current:

| PO | Customer | Packing runs | Days | Packed | Still to pack |
|----|----------|--------------|------|--------|---------------|
| 6595010464 | Syngenta | 48 | 11 (11 Jun → 1 Jul) | 279,825 Kg | 170,175 Kg |
| 6595010236 | Syngenta | 10 | 4 | 68,195 Kg | 203,309 Kg |
| 1821412156 | Rudolf | 3 | — | 50,560 Kg | 86,880 Kg |

Measured: **0 of 41 (PO, brand) combinations in the snapshot carry more than one
printed price.** So it has not happened yet in the data on record — but 460,000
Kg is still to be packed on those three POs, over weeks, and there is nowhere in
the system to put a second price when it arrives.

*(Caveat on that measurement: none of the 102 packing rows in this snapshot
carries a `lid`, because `migratePackingLotLidV1` had not yet run when it was
taken — `_lotLidMigV1` is absent from the flags. Rows were therefore matched to
orders by PO and brand, which is how the migration itself matches them.)*

### What it settles

**The price belongs to the print run, not to the order line.**

That is exactly the shape the design already arrived at for a different reason —
one slip per print run rather than one per pack. A mid-PO price change is then
simply the next slip carrying a different number:

- no correction to make, because nothing earlier was wrong
- no contradiction, because each slip covers only its own bags
- the history stays intact — you can see which bags went out at which price, and
  what each number was taken from

**The slip is not only a control. It is the only place in this system where a
price that changes can honestly live.**

### The consequence for the code

`printPolicyOL(o, l)` decides which price applies and takes only an order and a
line. It cannot express *"4,500 until 20 June, 4,800 after"*. If the slip becomes
the price authority, `printPolicyOL` has to consult the slip covering the run,
not the line — which is the same gap a reviewer flagged earlier as *"printPolicyOL
cannot select among several slips"*. Now there is a business reason for it, not
just a technical one.

## The revised recommendation

**Split it by PO size.**

- **Short POs — Cobo, Vgreen, the dealers, BKK.** Put the price on the order
  line. One price, one short run, nothing to change. This closes the smaller
  unrecorded rows cleanly.
- **Large POs — Syngenta, Rudolf.** Put today's price on the line as well, but
  understand what it is: the *current* price, not the whole truth, and it will
  need updating by hand whenever the customer sends a new one. It is still much
  better than 0, which tells the inspector nothing at all. The slip is what
  replaces that manual chase.
- **Correct the packing rows** either way, through the ledger, with a reason.
  The rows already hold the right numbers for the runs that have happened.

---

# 22 August — the authority rule, and what the dates show

## The COO's authority model

> *"KAM number is suggestive and advisory, the list [too]. But once Production
> has issued the printing slip, and if they have updated the price, the price
> Production updated is authority and can't change."*

Three levels, and this is a genuine correction to the design:

| Source | Standing |
|--------|----------|
| The KAM's price on the PO | **Advisory** — a suggestion |
| The price list | **Advisory** |
| **The price Production puts on the issued printing slip** | **Authority. Frozen.** |

### This reverses one thing I had wrong

My design had **QA supplying** the MRP — reading it off a list and writing it
onto the slip. That was never what the CFO asked for. His words:

> *"A slip is issued... stating the product, quantity, batch number,
> manufacturing date, expiry **and MRP to be printed**. Suggestion is to involve
> QA at this point **for MRP validation**."*

The slip already carries the MRP. QA **validates** it. So:

- **Production enters the price** — they hold the PO and the customer's email,
  they are the ones who know
- **QA checks and signs** — a validation, not a data-entry job
- QA's daily load drops sharply: checking one number against a source, not
  hunting for it
- And it matches what already happens, so there is less for anyone to absorb

### "Can't change" has to be built, not just stated

Today `printedPrice` on a packed lot carries **no lock**. Production can amend it
through the correction ledger after QA has cleared the lot and after the goods
have shipped. So the authority rule is not real until that hole is closed.

What "frozen" has to mean in code:

1. **The slip price locks when the slip is issued.** Same pattern as
   `brandBatchNo` and `mfgDate`, which already carry a `lockedIf`.
2. **A wrong price means a NEW slip, not an edit** — supersede, not amend.
   Exactly what the data-safety reviewer asked for: register the slip in
   `CORRECT_ENTITY` as supersede-only, like a signed COA or a passed inspection,
   blocked once bags have been printed against it.
3. **`printedPrice` on the packing lot locks once a slip covers it.** Otherwise
   the authority is quietly undone one screen downstream.
4. **`printPolicyOL` must prefer the slip over the line.** The line is now
   advisory, so `mrpTag` and `qcExpect` must say *"from the issued slip"*, not
   *"from the PO"*, or the inspector is told the wrong authority.

### One tension worth naming, not solving

Production now both **sets** the price and is the party the packing gate refuses.
That makes QA's signature the only independent check on the number — and the
Plant Manager fallback, for when QA is late or on leave, is the point where that
independent check can quietly disappear. Worth watching in the report of how
often the Plant Manager has to sign.

---

## The 1 July email, and what the dates actually show

Asked where the Syngenta and Rudolf prices came from, the COO answered: **1
July**.

The packing dates do not fit:

| PO | Brand | Price | Packed | Kg | vs 1 July |
|----|-------|-------|--------|----|-----------|
| 6595010236 | Enrich | 4,500 | 13–22 June | 68,195 | all **before** |
| 1821412156 | Orbit-K | 23,750 | 18–20 June | 37,500 | all **before** |
| 1821412156 | Basic | 13,750 | 7 June | 13,060 | 3½ weeks **before** |

All 118,755 Kg went into bags before that email existed. So either an earlier
email or a phone call set those prices and the 1 July message was the latest in a
thread, or the numbers were agreed verbally and confirmed later.

**The record cannot tell us, and that is the entire point.** A senior person
reconstructing from memory five weeks later, against a system that kept no trace,
is exactly the failure the slip removes. It is not a criticism of the answer —
it is the strongest possible demonstration of why the slip's *"taken from"* line
matters.

Once the slip exists, this question takes ten seconds instead of a memory test.

---

# 22 August — the dispute route, and why the Action Center is the right answer

**COO: when QA will not sign what Production entered, the Plant Manager solves
it from the Action Center.**

That is right, and it is right for a reason worth knowing.

## It routes around the access blocker instead of waiting for it

The Plant Manager has **view-only** on the Pre-shipment QA screen —
`accessMatrix['Plant Manager']` has no `qa` key, so `accessLevel` gives view and
`screenQA` renders `viewOnly(...)` with every button disabled. That has been
blocking his whole fallback role.

The Action Center is different. `SCREENS` entry for `approvals` ("My Actions")
lists **Plant Manager among its owners**, and `accessMatrix['Plant Manager']`
carries `approvals:{v:true,e:true}`. He already has full rights there.

### Which suggests going further

**Put all three Plant Manager cases in the Action Center**, not just the dispute:

| Case | What happened |
|------|---------------|
| **Late** | QA has not signed and the run is due |
| **Absent** | QA is on leave |
| **Overruled** | QA refused to sign Production's price |

One screen he already owns, one place to look, and the QA-screen access fix stops
being a blocker for the design — it becomes tidy-up.

## But record the three separately, and count the third

The first two are **cover**. The third is a **decision**: an independent check was
raised and then set aside. Those are not the same event and must never collapse
into one line reading "Plant Manager signed".

The third is the one an auditor asks about. It needs its own count in the report,
alongside the count of late and absent signings. A plant where the Plant Manager
overrules QA on price once a month is telling you something; a plant where it
happens weekly is telling you something louder.

## The precedent to copy

`actionItems()` already generates a **`'Print price'`** item — owned by the KAM,
opening `openBulkPrintDecision()`, escalating to the COO after 3 days. And the
"truck pipeline" work of 21 August exists precisely because Fahim reported *"gate
pass approval is assigned to Plant Manager but it does not appear in my actions"*.
That is the same failure shape, already fixed once. Follow it.

A new label has to be registered in **four** places or it renders wrong and
escalates to nobody:

| Table | If missed |
|-------|-----------|
| `ACT_EMOJI` | renders as a bare bullet |
| `acTypeColor` | renders grey (`var(--mut)`) |
| `acStageOf` | files into the "Production" pipeline position, wrong |
| `acEscalation.TH` | **never escalates to anyone, ever** |

For a dispute, set `role:'Plant Manager'` **directly** rather than relying on
escalation — a blocked print run needs deciding today, not after a threshold.
Escalate onward to the COO after 1 day, matching `Release` and `Approve DC`.

## A real gap this exposes: the Action Center cannot say "blocking now"

`actUrg` is purely age-based:

```
overdue → 0 · 7+ days → 1 · 3+ days or a hot order → 2 · everything else → 3
```

So a price dispute raised this morning that is holding a print run gets urgency
**3 — the bottom of the list**, below a five-day-old inspection. And `actTiming`
clamps negative days to 0, so a slip due tomorrow sorts at the bottom too.

**The Action Center measures how long something has waited, not how soon it is
needed.** For everything it handles today that is the right measure. For a slip
it is exactly the wrong one, and it has to be fixed in the same piece of work or
the dispute item is invisible on the screen it was built for.

## Practical, for today

**The print-on-pack backlog is already sitting in the COO's own Action Center.**
It is generated as a `Print price` item, owned by the KAM, escalating to the COO
after 3 days — and `acBase()` gives the COO *every* item regardless of owner. The
button on it opens the bulk answer screen directly. No PO hunting required.

**Syngenta Enrich is confirmed still at 4,500.** The line can be set to 4,500
now, closing 68,195 Kg of the unrecorded pricing, with the understanding that it
is the current number and not a permanent one.

---

# 22 August — "1 working day", and two things the record says about it

**COO: a slip waits 1 working day before the Plant Manager can sign for QA.**

Two problems with that as written. Neither is a reason to change the intent; both
change how it gets built.

## 1. The app has no idea what a working day is

Zero references anywhere in `o2s.html` to a weekend, a holiday, a working day or
even `getDay()`. Every threshold in the system counts plain calendar days —
`evThreshold` and the `acEscalation` TH table both. **"1 working day" cannot be
expressed today.** It is either built, or it is redefined as 1 calendar day.

Which raises the simplifying question: **is Sunday a working day at VAN?** The
record says the plant is not closed on it — production entries on Sundays,
packing on two, shipments on three, and the COO is one of the heaviest Sunday
users in the whole log. If Sunday counts, then **1 working day = 1 calendar day**
and no calendar needs building at all.

## 2. A full working day lands the fallback AFTER the run it was protecting

Work it through on the floor:

> Slip raised Thursday 4pm for Friday's 6am run. One working day later is Friday
> 4pm. The run was at 6am. **Fahim can step in ten hours after the bags were
> needed.**

The threshold is measured from when the slip was *raised*. The thing it is
protecting is when the bags are *needed*. Those are a day apart by design — that
is the whole point of raising the slip the day before.

**Suggested wording instead, same intent, lands in time:**

> *If the slip is still unsigned at the end of the working day it was raised, the
> Plant Manager can sign it.*

That is one working day in spirit, it gives QA the whole day, and the recovery
happens the evening before rather than the morning after.

## What the activity record says about the fallback itself

From `actionLog`, 15 June – 16 July, by weekday:

| Role | Sun | Mon | Tue | Wed | Thu | Fri | Sat |
|------|-----|-----|-----|-----|-----|-----|-----|
| QA Inspector | 2 | 4 | 3 | 14 | 5 | **1** | **23** |
| Plant Manager | **0** | **0** | 3 | 13 | 5 | 6 | **0** |
| Production | 2 | 23 | 39 | 35 | 52 | 33 | 31 |
| COO | 34 | 43 | 23 | 21 | 16 | 13 | 6 |

And packing volume by weekday: **Saturday is the busiest packing day of the week
(29 rows), ahead of Thursday (26) and Wednesday (20).**

So:

- **QA's biggest day is Saturday. The Plant Manager took no action in the system
  on any Saturday or Sunday on record.**
- Saturday is also the plant's busiest packing day.
- **If QA is away on a Saturday, the designated fallback has historically not
  been in the system that day** — on the day the gate would bite hardest.

**Caveat, and it matters: the sample is thin.** The log covers 24 distinct dates
— only 3 Saturdays, 3 Fridays and 2 Sundays. And the action log records what
somebody did *in the app*, not whether they were at work. This is a flag to check
with the people concerned, not a finding about anybody's attendance.

But it is worth checking, because if it holds, the Saturday gap needs a named
answer before the gate goes live — and the obvious candidates each have a problem:
Majid sets the price so he cannot approve it, QCM's Saturday presence is light
(3 actions), and the COO's is lighter still (6).

## Three questions this leaves

1. **Is Sunday a working day?** If yes, 1 working day = 1 calendar day and
   nothing needs building.
2. **Should the clock run from when the slip was raised, or to when the bags are
   needed?** The second is what actually protects the run.
3. **Who covers a Saturday when QA is away?** Saturday is the busiest packing day
   and the Plant Manager's thinnest.
