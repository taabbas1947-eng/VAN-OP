# O2S Fault Register — 2026-08-21

Raised by Tahir. Every entry below was confirmed by reading `o2s/o2s.html`
(8,054 lines, last modified 2026-08-16). Line numbers are pointers, not
addresses — they move when the file is edited.

Nothing in this register is a guess. Where I could not confirm something from
the code, it says so.

| # | Fault | Severity | Confirmed | Fix spec |
|---|---|---|---|---|
| 1 | Print price is captured but invisible to everyone downstream | **Critical** | Yes | [SPEC-01](SPEC-01-PRICE-VISIBILITY.md) |
| 2 | Fields are too small to read what is being typed | **High** | Yes | [UI-FIELD-AUDIT](UI-FIELD-AUDIT.md) |
| 3 | No single place showing everything attached to a PO | **Critical** | Yes | [SPEC-02](SPEC-02-PO-DOSSIER.md) |
| 4 | No standard way to correct a record | **High** | Yes | [SPEC-03](SPEC-03-EDIT-STANDARD.md) |
| 5 | Event dates are keying dates, so late/bulk entry is invisible | **Critical** | Yes | [SPEC-04](SPEC-04-REALTIME-DISCIPLINE.md) |
| 6 | The whole truck pipeline is missing from the Action Center | **Critical** | Yes | Fixed 2026-08-21 |
| 7 | Seven of twelve screens push the page sideways on a phone | **High** | Yes | Fixed 2026-08-21 |
| 8 | A truck can be gate-released before its shipment-level inspection | **Open question** | Yes | Awaiting Tahir's decision |
| 9 | Desktop: a nine-figure PKR value was silently losing its last digit | **Critical** | Yes | Fixed 2026-08-21 |
| 10 | A PO that prints no price could not be packed at all | **Critical** | Yes | Fixed 2026-08-21 |
| 11 | `printOnPack:false` read as a decision when it is an unticked default | **Critical** | Yes, on live data | Hotfixed 2026-08-21 |

---

## Fault 1 — The print price is written, then hidden

### What was reported

> When we add a PO and add a price to be printed, it never shows up anywhere in
> the supply chain or to anyone, so the team is still making mistakes in price
> printing because it is not visible to them.

### What the code actually does

There are **two different prices** on a PO line, and they are easy to confuse:

| Field | Meaning | Who may set it |
|---|---|---|
| `invoicePrice` | What VAN charges the client, PKR per Kg/L. Drives Sales & Budget | COO / CFO only |
| `printPrice` | The retail price printed on the pack (MRP), PKR per pack | KAM at PO entry, then whoever packs |

`printPrice` is written in three places and read in three places. **All three
read sites are inside packing modals.** Nowhere else in 8,054 lines does any
screen, table, report or printed document display it.

**Written at:**

- L2594 — PO Entry, the "Print price (MRP on pack)" row, only rendered when the
  `entryPrintOn` checkbox is ticked (L2544)
- L2671 — validated on submit, again only when `entryPrintOn` is on
- L4035, L4264, L4312 — set at packing time if the PO line has no price yet

**Read at:**

- L4279–4280 — `openPack` step 7 "Verify price to print on pack"
- L4248 — `openProdQty` (PO-direct pack)
- L4013 — `openDivert`

**Not present in:**

- PO Tracker (`tracker` screen) — no `printPrice` reference
- The order drawer (`openOrder`)
- Production screen lists
- Pre-shipment QA — neither modal (`renderLotQA` L4486, `renderDispatchQA`
  L6150) shows it, and the 8-point checklist at **L4816** does not contain a
  price item:
  `['Packaging intact & correct','Label / artwork correct','Net weight / count verified','Seal & closure OK','Cleanliness — no contamination','Batch & expiry printed','No leakage / damage','Pallet / loading condition']`
- Shipments screen
- The printed PO (`printPO`), Delivery Challan (`printDC`), Gate Pass
  (`printGatePass`), COA (`printCOA`) or Inspection report (`printInspect`)
- Reports — `printPrice` is not a field in any report definition (L7287, L7291)
- Data Fix "Correct a PO" (L2345–2363) — it exposes `invoicePrice` but **not**
  `printPrice`, so a wrong print price has no correction path at all

### An important qualification (Tahir, 2026-08-21)

**A printed price is not compulsory.** Some clients do not want any price on
the bag. So the fault is *not* "some POs have no price" — that is a legitimate
state. The fault is that **the decision is invisible and unverifiable**: nobody
downstream can tell a no-print PO from a PO where someone forgot, and where a
price does exist nobody can check it.

The decision is already captured — `order.printOnPack`, written at PO entry
(L2544 → L2681). Until 2026-08-21 nothing downstream read it. See
[SPEC-01 Rule 0](SPEC-01-PRICE-VISIBILITY.md) for the four states.

### Three defects, not one

**1a — Invisibility.** The person packing sees it. Nobody else does. Supply
Chain planning the truck, QA inspecting before shipment, the Plant Manager
approving the DC, the KAM who set it — none of them can see what price is
supposed to be on that pack, whether one is supposed to be on it at all, or
what price actually went on it.

**1b — The packer's typo becomes the PO's price.** At L4312:

```js
if(l.printPrice==null||l.printPrice===''){ l.printPrice=ppx; }
```

If the PO has no print price, whatever the packer types is written back onto
the PO line as if it had always been there. There is then no record that the PO
never carried a price, and no way to tell an authorised price from a guessed
one. The same pattern is at L4035 and L4264.

**1c — The verification is self-attested and unverifiable.** The packing modal
asks the operator to tick *"I verified this is the correct print price"*
(L4280). It stores `priceVerifiedBy: state.role` — the **role**, not the person
(L4313). There is no second check anywhere, and the QA inspector who is meant
to be the last gate before the gate pass is never shown the number.

### What it costs

This is the direct cause of the reported problem: **packs leave the factory with
the wrong printed price**, and the system that was built to prevent exactly that
has no place where the mistake becomes visible before the truck moves. Fixing
1a alone removes most of the risk; 1b and 1c close it.

---

## Fault 2 — Fields are too small to read what is being typed

### What was reported

> Multiple text, data and information adding fields are poorly sized — it
> doesn't even show what we're adding, hides text, field size never adjusts. We
> need to check every field.

### What the code actually does

Confirmed, with arithmetic. Full detail in
[`UI-FIELD-AUDIT.md`](UI-FIELD-AUDIT.md). The headline facts:

- **There is not one `<textarea>` in the entire application.** 0 occurrences.
  All 62 free-text fields are single-line `<input type="text">`. Remarks, delay
  reasons, correction notes, inspection remarks, driver details — all
  single-line.
- **Every modal is locked to 580px** (`.modal{width:580px}`) on any screen wider
  than 820px. A 27-inch monitor gets the same 580px as a small laptop. The modal
  never uses the space available.
- **A 3-column form field inside a modal is 170px wide** — computed:
  580 − 44 (padding) = 536; (536 − 26 gap) ÷ 3 = 170px. After input padding and
  border, **144px of usable text**, roughly **21 characters** at 13px.
- **`text-overflow: ellipsis` is applied to `<select>`** (L198 of the style
  block). In Chrome this clips the *selected value* — so after choosing a
  product, the operator cannot read which product is selected. This is literally
  "it doesn't show what we're adding".
- **Labels are uppercase with letter-spacing and are allowed to wrap.** A
  three-word label wraps to two or three lines in a 170px column and pushes its
  own input out of line with its neighbours, which is why forms look broken.
- **The PO Entry line table uses `table-layout:fixed` with `overflow:hidden`**
  (L201–204). Its Note column is **130px** and its Committed date column is
  **118px** (L2546). A `type="date"` input needs roughly 120–130px in Chrome
  just to show `dd/mm/yyyy` plus the picker icon; at 118px minus padding it
  clips.
- **10 `prompt()` calls** are used for real business input — correction notes,
  deviation notes, rejection reasons. A browser `prompt()` is one line, cannot
  be styled, cannot be pasted into cleanly, and its content is not visible while
  typing beyond about 30 characters.
- **0 `maxlength` attributes.** Nothing tells the user how much they may type,
  and nothing stops a 500-character remark going into a field that shows 21.

### What it costs

People stop writing the reason. A delay reason that cannot be read while it is
being typed becomes "late" or "issue". The system then holds no usable
explanation for anything, which removes the point of asking.

---

## Fault 3 — No single place showing everything attached to a PO

### What was reported

> There is nothing in the system where we can track and trace a PO to shipment
> and all associated records can be checked in one place… when did it produce,
> how many batches, who produced it, on which floor, when it was packed, when it
> was tested, QC report, when it was inspected for pre-shipment, when it
> shipped, shipment documents — a kind of mapping and attaching every record and
> trail to a primary driver.

### What the code actually does

Confirmed. The data to build this **already exists** — it is spread across nine
arrays in `app_state` and is joined ad-hoc, differently, by each screen. There
is no view that assembles it.

The closest things that exist today, and what each one misses:

| Existing view | What it gives | What it cannot do |
|---|---|---|
| `rpTrace` (Reports → Trace) L7599 | Brand batch ⇄ base batch composition, every Kg reconciled | Keyed on **brand batch**, not PO. No COA, no inspection, no DC, no customer, no dates |
| `rpDocs` (Document viewer) L7383 | Every DC and Gate Pass issued, searchable, printable | **Only** DC and Gate Pass. No COA, no inspection report, no batch card, no PO |
| `rpLog` L7621 | Field-level audit of PO Tracker edits | Only `state.audit`. Does not include production, QC or packing events |
| `state.actionLog` | Free-text narrative of actions | Text only — cannot be filtered to one PO reliably, cannot be exported as a trail |
| PO Tracker drawer | Stage dates and quantities for a PO | Stage summary only; no batches, no lots, no COA, no inspection, no documents |
| `lifecycleByPO` L7926 | Production-stage lifecycle | Production only — stops before QA and shipment |

So today, answering *"show me everything about PO-1234, line V-Germinator Pro"*
means opening five screens and joining them by eye. Years later, with the
original staff gone, it is not answerable at all.

### The six printed documents exist — they are just scattered

`printPO`, `printCOA`, `printInspect`, `printDC`, `printGatePass` and the
generic `printDoc` all work. There is no batch card print. None of them can be
reached from one PO-anchored place.

### What it costs

This is the single biggest gap between what O2S was built for and what it does.
Intent 1 and intent 2 in the README both fail here.

---

## Fault 4 — No standard way to correct a record

### What was reported

> The system is developed in pieces, so no standard principle applies to one
> action. For example if we have to edit a record, no matter if it's a batch
> card, or PO, or packing, or QC report, the system does not provide a path,
> route or standard procedure for it.

### What the code actually does

Confirmed. There are at least **eight different correction mechanisms** and no
two behave the same:

| Record | How you correct it | Who | Reason required | Audited |
|---|---|---|---|---|
| PO header & quantities | Data Fix → "Correct a PO" (`dfSubmitCorrect` L2363) | **COO only** | Yes | Yes, as RECONCILE |
| PO stage dates | Inline on PO Tracker (`editField` L1935) | Field owner per `FIELD_OWNER` L1905 | No | Yes, `state.audit` |
| Invoice price | `setLineInvoice` L7197 or bulk L6952 | COO / CFO | No | Yes, as RECONCILE |
| **Print price** | **Nowhere** | — | — | — |
| Shipment | `openShipEdit` / `saveShipEdit` L6309 | Supply Chain / COO | Not verified | Partial |
| Delivery | `markDelivered` L6165 accepts a date | Supply Chain | No | Action log only |
| Failed QA lot | `lotQACorrect` L4504 / `clearQaHold` L4503 — `prompt()` for the note | Supply Chain / QA | Yes, via `prompt()` | Yes |
| **Passed QA inspection** | **Nowhere** — cannot be amended once passed | — | — | — |
| COA before approval | `coaReject` L4473 sends it back to draft, `prompt()` for reason | AQCM / QCM | Yes, via `prompt()` | Yes |
| **COA after QCM approval** | **Nowhere** | — | — | — |
| **A packing run** | **Nowhere** — no edit, no void | — | — | — |
| Batch | `_voidReverseBatch` | Not verified | Not verified | Not verified |
| Master data | `editMaster`, `pmEdit`, `rmMasterRename`, `custEdit` — four different patterns | Varies | No | Varies |

Three consequences follow:

1. **Some records cannot be corrected at all.** A packing run keyed with the
   wrong quantity, batch number or price is permanent. A passed inspection is
   permanent. An approved COA is permanent. In a live system with a learning
   team, that guarantees permanent wrong data.
2. **Where correction exists, the rules differ.** Some paths demand a written
   reason, most do not. Some log old → new, some only write a sentence to the
   action log, some do neither.
3. **Correction is concentrated in the COO.** Data Fix is COO-only. Anyone else
   who makes a mistake must find the COO. In practice that means the mistake is
   left, or worked around with a second wrong entry.

### What it costs

Wrong data is never fixed, so people stop trusting the screens, so they keep
their own records, so the system becomes a reporting chore rather than the
place work happens. That is the mechanism behind Fault 5.

---

## Fault 5 — Event dates are keying dates, so late entry is invisible

### What was reported

> I'm afraid people are not using the system in real time, they are not taking
> actions, not responding to Action Center notifications, and I feel they are
> doing bulk entries which is killing the spirit of the system. What is the
> purpose of a pre-inspection report if it was done 5 days after the actual
> shipment because they hadn't recorded the shipment on the actual date?

### What the code actually does

This is the most important finding in the register, and it is structural.

**`TODAY` is stamped into records 84 times** (L1322 defines it; 84 uses). For
most events, the date stored *is* the date somebody typed it in. There is no
separate field for when the thing actually happened.

The clearest example, and exactly the one reported:

```js
// dispQASubmit, L6160
const d = TODAY.toISOString().slice(0,10);
const qa = {pass:!anyFail, fail:anyFail, by:..., date:d, ...};
```

The pre-shipment inspection date is **not enterable**. It is always today.

Meanwhile the shipment date **is** enterable (`shipForm.date`, L5457, saved as
`dispatch` at L5469). And **nothing validates the two against each other.**

So the reported scenario is not a user error the system failed to catch — it is
a state the system cannot even represent:

| Reality | What O2S stores |
|---|---|
| Truck left on the 10th | `dispatch: '2026-08-10'` — if whoever keyed it chose that date |
| Inspection performed on the 21st, after the fact | `qa.date: '2026-08-21'` — forced |
| Both keyed on the 21st | No record that anything was keyed on the 21st |

And if the operator back-dates the shipment *and* the inspection is stamped
today, the inspection is dated **after** the dispatch it was supposed to
authorise — with no warning, no flag, and no report that would surface it.

### The same pattern elsewhere

- `lotQASubmit` L4496 — `date: TODAY`, not enterable
- `coaApprove` L4472 — `approvedDate: TODAY`
- `doPack` L4291 — the packing log `date` is `TODAY`; only `mfgDate` and
  `expDate` are enterable, so the pack *run* date cannot be the real one
- `markDelivered` L6165 — accepts a date, defaults to today

So some events allow a real date and some do not, inconsistently, which is
Fault 4 showing up again.

### Why lateness is currently unmeasurable

Because the event date and the keying date are the **same field**, the lag
between them is always zero by construction. No report can show it. No
dashboard can flag it. There is no data to build one from — this is not a
missing screen, it is a missing field.

The escalation engine (`acEscalation` L5003, thresholds at L3197–3198:
acknowledge/RM/Lab-QC 1 day, QA/ship 2 days, produce 4-day silence) is
therefore measuring from dates that were themselves entered late. **It reports
green on a process that ran red.** That is worse than having no escalation,
because it actively reassures.

### One more finding, related

Both inspection modals ask the inspector to **type their own name** into a free
text box (L4491 "Inspector name (shared QA login)", L6155). The system stores
that string as the signatory. The comment in the code confirms QA operates on a
shared login. So the inspection record — the last gate before material leaves
the factory — is signed by a self-typed name on a shared account, dated
automatically to whenever it was keyed. It would not survive an audit.

### What it costs

Everything the system was built to guarantee. If the inspection date is not the
inspection date, intent 4 — *nothing leaves the factory unless it meets
quality, packing, price as per PO, batch, mfg and expiry* — is a formality.
The report exists; the control does not.

---

## Suggested order of work

Ordered by risk removed per unit of change, not by how hard each is.

| Order | Work | Why first / why later |
|---|---|---|
| 1 | **Fault 1** — show the print price everywhere, add it to the QA checklist | Smallest change, removes an active daily loss, no data model change |
| 2 | **Fault 2** — field sizing, textareas, wider modals | Independent of everything else, unblocks people writing real reasons, low risk |
| 3 | **Fault 5a** — add `actualDate` + `recordedAt` to every event | Must come before the dashboard or the lock. Additive fields only, no existing data changes |
| 4 | **Fault 3** — the PO dossier | Best built once dates are trustworthy, otherwise it renders a false trail beautifully |
| 5 | **Fault 4** — the standard correction path | Largest surface area; benefits from the dossier existing as the place corrections are shown |
| 6 | **Fault 5b/5c** — entry-lag dashboard, then the N-day lock | The lock is last on purpose. Locking entry before correction is standardised traps people |

---

*Register opened 2026-08-21. Module: O2S. Source: `o2s/o2s.html` @ 2026-08-16.*

---

# Round two — from the team, 2026-08-21

The first register came from Tahir. These came from the people using the system,
within a day of the first change going live. All three were checked against the
code before anything was written here.

---

## Fault 4 confirmed independently — Majid

> Sir, I would also suggest incorporating a formal correction mechanism to
> address data-entry mistakes.

Majid arrived at [Fault 4](#fault-4--no-standard-way-to-correct-a-record)
independently, without having seen the register. That is the strongest evidence
in this document that the fault is real and is felt daily, and it moves
[SPEC-03](SPEC-03-EDIT-STANDARD.md) up the queue.

Nothing to add to the analysis. The spec already covers it. What Majid's message
changes is the priority: a fault two people raise unprompted in the same week is
costing more than the register credited it with.

---

## Fault 6 — the whole truck pipeline was missing from the Action Center

**Raised by Fahim:** *"Gate pass approval is assigned to Plant Manager but it
does not appear in my actions."*

### What the code showed

He was right, and it was five faults, not one. `actionItems()` had **no entry at
all** for any step after "Ship". Verified by listing every `act:` target in the
function:

```
ackOrder · approveRMPR · cfoApprovePR · clearQaHold · gotoProduce ·
lotQACorrect · openDelayReason · openDispatch · openDispatchQA ·
openPackInspect · openRMCheck · openRMReceive · openReceiveMaterials
```

Absent: `startLoading`, `issueGatePass`, `approveRelease`, `approveDC`,
`openDeliveryConfirm`.

| Stage | Owner | Action | Was in My Actions? |
|---|---|---|---|
| Ready to ship | Supply Chain | `openDispatch` | Yes |
| Truck planned | Supply Chain | `startLoading` | **No** |
| Loading, no gate pass | Supply Chain | `issueGatePass` | **No** |
| Loading + gate pass | **Plant Manager** | `approveRelease` | **No** ← Fahim |
| DC pending approval | Plant Manager | `approveDC` | **No** |
| In transit | Supply Chain | `openDeliveryConfirm` | **No** |

So the moment a truck was planned it **disappeared from every worklist** and
could only be found by remembering to open the Shipments screen and scroll.

It is worse for the Plant Manager than for anyone else. The Shipments screen
lists `owners:['Supply Chain']`, so he gets view access by default and no more —
the role that owns the release gate has to go hunting on someone else's screen
for a button, with nothing anywhere telling him it is waiting. Before this fix
the Plant Manager had exactly **two** action item types in the entire system
(UNFIT lot review, and add-a-delay-reason), so he had no reason to build the
habit of looking at all.

### Why this matters more than a missing button

Tahir's Fault 5 was *"they are not responding to Action Center notifications."*
Part of that is a habit. But for the entire second half of the shipment process,
**there were no notifications to respond to.** People were being asked to check
a list that did not contain their work.

### Fixed 2026-08-21

All five items added, each with an escalation threshold. A loaded truck sitting
unreleased escalates to the COO after one day — it is the most expensive thing
in the process to leave standing.

The release item deliberately stays hidden while the shipment's pre-shipment
inspection is still pending, so it never invites the Plant Manager to release
ahead of QA.

---

## Fault 7 — the app pushes the page sideways on a phone

**Raised by Fahim:** *"Mobile friendly version please."*

### What the measurement showed

There is a responsive layer already (`@media(max-width:820px)`), and the parts
it covers work — the nav becomes a drawer, the toggle appears, grids collapse to
one column. The problem was elsewhere.

At 390px, **7 of 12 screens pushed the page horizontally**, which is what makes
an app feel broken on a phone: you scroll down and the whole page drifts
sideways.

| Screen | Overflow |
|---|---|
| PO Tracker | **204px** |
| Sales & Budget | 92px |
| My Actions | 68px |
| Users & Access | 53px |
| Production | 46px |
| Admin | 39px |
| Shipments | 32px |
| Pre-shipment QA | 24px |

Found by hiding each element in turn and re-measuring, rather than by eye. Three
root causes, not eight:

**7a · The top bar could not shrink** — 7 screens. `.tbttl`, which holds the
screen title and subtitle, ships as `flex: 0 0 auto`. `flex-shrink: 0` means it
refuses to narrow below its content, so a title like *"Sales & Budget
(dashboard)"* (261px) held the whole bar — and therefore the page — open by
92px. Adding `min-width: 0` alone did **not** fix it; the shrink factor was the
real culprit and took a second pass to find.

**7b · The same flexbox problem in every Action Center card** — `.axn-bd` had no
`min-width: 0`, so a long client name (*"· Ittefaq Traders & Company, Multan"*)
forced the card wide.

**7c · The PO Tracker matrix had no scroll container** — `table.t2mtx` sits in a
plain `div` with `overflow-x: visible`, so a 555px table stretched the page
instead of scrolling inside itself. This was the worst single offender, on the
screen everyone uses most.

### Fixed 2026-08-21

Three CSS causes, three CSS fixes, plus a `:has()` scroll container for the
tracker matrix. **All 12 screens now measure 0px overflow at 390px, with no
change at 1600px.** On a phone the tracker matrix keeps a 520px minimum width and
scrolls inside its own card, so the columns stay readable instead of being
crushed.

This is not "a mobile version". It is the existing app no longer breaking on a
phone. A layout genuinely designed for a phone — the Action Center as the home
screen, one-thumb approve/reject, a camera for batch numbers — is a separate
piece of work and a much larger one.

---

## Fault 8 — a truck can be released before its shipment inspection

**Not reported by anyone. Found while fixing Fault 6.** Recorded because it sits
directly on intent 4, and flagged rather than fixed because changing a gate on a
live system is Tahir's call, not mine.

`approveRelease()` checks three things: the caller is the Plant Manager, the
truck is in `loading`, and a gate pass has been issued. **It does not check
whether the shipment-level pre-shipment inspection has passed.**

There are two QA layers, and only one of them gates:

| Layer | What it is | Does it gate? |
|---|---|---|
| **Lot-level** (`packingLog[].qa`) | Each packed lot inspected before it can be loaded | **Yes** — `readyLinesFor()` only offers inspected & cleared quantity |
| **Shipment-level** (`shipments[].qa`, `openDispatchQA`) | The truck-load inspected as a whole | **No** — nothing stops release without it |

So material on the truck has always been inspected at lot level. What can be
skipped is the second, truck-level check. `markDelivered` and
`openDeliveryConfirm` both refuse when `qa === 'pending'` — so the release step
is the one place in the chain that does not.

That inconsistency is [Fault 4](#fault-4--no-standard-way-to-correct-a-record)
showing up again: the same rule applied in two places and not a third.

**The question for Tahir:** should `approveRelease` refuse when the shipment
inspection is still pending? Adding the check is about four lines. It would stop
a truck that today would go. Given the current backlog of un-recorded
inspections (Fault 5), it may block real trucks on the day it deploys — which is
why it is a decision and not a fix.

As an interim, the Action Center item for the release already stays hidden while
inspection is pending, so nobody is *invited* to skip it.

---

*Round two opened 2026-08-21. Faults 6 and 7 fixed the same day; 4 specified;
8 awaiting a decision.*

---

## Fault 7b — the mobile layout was too sparse to be useful

**Tahir, on seeing the first mobile fix:** *"Still too dense and large text, it
should be compact ... and it should adjust based on the field, tab size, length
and open tabs."*

Fault 7 stopped the page sliding sideways. It did nothing about how much of the
screen was spent before you saw any work — and that is the difference between
"it fits" and "it is usable on a phone".

### What the measurement showed

My Actions, 390 × 844:

| Block | Height | Why |
|---|---|---|
| Stat cards | **360px** | 4 cards, **one per row**, 84px each |
| Filter controls | **160px** | 4 controls, **one per row**, 34px each |
| `.paperui` padding | 44px | desktop padding on a phone |
| **Total before the first task** | **659px** | **78% of the screen** |

You scrolled most of a screen before reaching a single piece of work. On the
screen whose entire job is to show you your work.

The type scale was part of it but not the main part. The real cost was that
every container was full-width and stacked, because the responsive layer only
ever collapsed things to one column — it never re-packed them.

### What changed

| Block | Before | After |
|---|---|---|
| Stat cards | 360px, 1-up | **129px, 2-up** — all four still visible, no swiping |
| Filters | 160px, 4 rows | **110px** — search on its own row, dropdowns two-up |
| `.paperui` padding | 44px | 26px |
| Stat value / label | 27px / 10.5px | 18px / 9px |
| Screen title | 17px | 15px |
| Action card title | 12.5px | 12px |
| **Before the first task** | **659px** | **375px — 44% instead of 78%** |

Three tasks now sit on the first screen. Before, none did.

### The one place I spent height rather than saved it

Three dropdowns across a 390px screen fits the height budget, and I built it
that way first. It clipped their own selected values to *"Group: ..."* and
*"Sort: Ri..."*.

That is [Fault 2](#fault-2--fields-are-too-small-to-read-what-is-being-typed)
all over again — a control that will not tell you what it is set to. So they
went back to two per row, at a cost of 39px. Readable beats compact when the
thing being compressed is the answer to *"what am I looking at?"*

### The iOS zoom floor, now paid only by iOS

The original stylesheet forced `input, select, textarea { font-size: 16px }`
below 820px, with the comment *"iOS: >=16px stops focus auto-zoom"*. That is
correct and worth keeping — below 16px, iOS Safari zooms the page every time a
field is focused and the user has to pinch back out.

But **Android was paying for it too, and Android does not have the problem.**
The floor is now scoped with `@supports (-webkit-touch-callout: none)`, which is
true on iOS WebKit and false on Android Chrome. Android gets 13.5px; iOS keeps
16px. If the detection ever fails, the fallback is exactly today's behaviour.

### What this still is not

A layout genuinely designed for a phone. This is the desktop app packed
sensibly. A real mobile design would make the Action Center the home screen,
put approve/reject under one thumb, and use the camera for batch numbers.
That is a separate and much larger piece of work — worth asking Fahim which of
the two he was asking for.

---

*Fault 7b measured and fixed 2026-08-21. All 12 screens: 0px horizontal
overflow at 390px, unchanged at 1600px.*

---

## Fault 9 — the desktop app: silent truncation and empty screens

**Tahir:** *"The app overall has too much clusters and white empty spaces and
sometimes the app even flows text outside the window. It's about the webapp
equally, not just mobile."*

### First, an honest correction

**I could not reproduce text escaping the browser window on desktop.** Every
screen measures 0px horizontal page overflow at 1024, 1280, 1366, 1600 and
1920px, with 40 POs of realistic data loaded.

What I did find looks the same to a user and is worse than it looks: **text
silently truncated inside its own card, with no ellipsis and no warning.**

If the case you have in mind is different — a modal, a print preview, a specific
screen with specific data — send a screenshot. I have not hit it.

### Why this was missed until now

The first mobile pass used a tidy fixture: one PO, one client, short names,
`PKR 1.2M`. Everything passed. The faults below only appear with **real data** —
long client names, nine-figure PKR values, 40 orders. The fixture was rebuilt to
match production before any of this was written.

### 9a · A financial figure was losing its last digit

Sales & Budget at 1024px, with real annual targets:

```
BEFORE:   PKR 625,000,00(     ← the card renders "PKR 625,000,000"
AFTER:    PKR 625,000,000        clipped mid-digit
```

`.kpi .v` was fixed at 23px. `PKR 625,000,000` needs 181px in a 166px box, and
`.kpi` carries `overflow: hidden` — so the surplus is not painted outside the
card, it is **cut off inside it**, mid-number, with nothing to indicate that
anything is missing.

Three of the four tiles on that screen were affected. **A CFO reading the budget
screen was being shown a number missing its last digit.** This is the most
serious defect found in the app so far, and it is invisible — there is no error,
no ellipsis, nothing to notice.

**Fixed** by making the value size itself to the card rather than the card being
asked to fit the value:

```css
.kpi{container-type:inline-size}
.kpi .v{font-size:min(23px,10.5cqi)!important;white-space:normal}
```

23px when there is room, shrinking only when the card is too narrow for what it
holds. This is what Tahir asked for as *"adjust based on the field, length"*.
Container-query units need the same browser generation as `:has()`, which this
file already depends on.

Side effect worth having: the long values had been wrapping onto two lines, so
fixing this also gave ~65px back on that screen — the "By client" table now
shows two rows in the fold where it showed one.

### 9b · My own action titles were the worst clipped text in the app

The truck-pipeline items added earlier the same day carried the client name, the
DC number **and** the quantity in a single `.axn-t1`, which is one nowrap line.
Measured clipping **474px of itself** off the right edge at 1024px.

Fixed: the headline is now PO and DC only. The card already prints client and
product underneath, and the detail belongs in the drawer.

### 9c · Empty screens — measured

`ink` = the fraction of the first screen occupied by cards, tables or task rows,
at 1366 × 768 (the common office laptop) with 40 POs loaded:

| Screen | Ink | Chrome before the first data row |
|---|---|---|
| **Dashboard** | **0.00** | **1,707px — over two screens** |
| **Shipments** | **0.00** | — |
| Lab QC | 0.15 | — |
| Pre-shipment QA | 0.15 | — |
| Reports | 0.18 | 412px |
| Users & Access | 0.25 | 251px |
| Production | 0.53 | — |
| My Actions | 0.58 | 213px |
| Admin | 0.65 | 799px |
| PO Tracker | high | 320px |

**Dashboard and Shipments show no data at all in the first screen.** On the
Dashboard that is three stacked banners saying nearly the same thing (the
"Tuned for COO" strip, the "Executive overview" heading block, and the "Today's
read · auto-generated" summary), then a row of stat tiles, then two chart cards
— one of which is a large empty box when it has no data to draw.

**Not fixed, and deliberately so.** Deciding which of those three banners earns
its place is a product decision about what a COO should see first, not a
formatting one. Deleting a summary Tahir wrote is not mine to do. The measurement
is here so the decision can be made with a number attached.

---

*Fault 9 opened 2026-08-21. 9a and 9b fixed; 9c measured and left for a
decision. Verified across 1024 / 1280 / 1366 / 1600 / 1920 with a 40-PO
production-shaped fixture.*

---

## Fault 10 — a PO that prints no price could not be packed at all

**Not reported by anyone. Found while implementing SPEC-01 rule 1, the same day
Tahir said "not every PO prints a price".**

This is the most direct example in the register of a rule being written into
code before anyone asked whether it was true.

### What the code did

All three packing paths — `doPack`, `doProdQty`, `doDivert` — carried the same
gate:

```js
const ppx = +form.price || 0;
if(!(ppx > 0)){ toast('Enter the price to print on the pack.'); return; }
```

**A positive print price was mandatory to pack anything.** So for a client who
does not want a price on the bag, the operator had two options: leave the
material unpacked, or invent a number.

They invented a number. And then:

```js
if(l.printPrice == null || l.printPrice === ''){ l.printPrice = ppx; }
```

the invented number was written back onto the PO line, where it became
indistinguishable from a price the KAM had set. Packing was authoring
commercial data, on exactly the customers who had asked for none.

### The principle now

> **Packing records what went on the bag. It never authors what should have.**

The PO is the only authority. A difference between the two is a finding for the
inspector, not a silent correction.

### Fixed 2026-08-21

One shared price step across all three packing paths (`packPriceBlock` /
`packPriceGate` / `packPriceRecord`), behaving by the four states of
[SPEC-01 Rule 0](SPEC-01-PRICE-VISIBILITY.md):

| PO state | What packing asks for |
|---|---|
| **no-print** | Nothing to enter. One confirmation: *"I confirm no price is printed on this pack."* |
| **priced** | The PO's price, pre-filled. Type what is actually on the bag; if it differs, a red warning says it will be recorded as a discrepancy and **the PO is left unchanged** |
| **missing / not specified** | Record what is printed, with a note that this does **not** set the PO's price — ask the KAM |

The packing lot now stores both sides of the question:

| Field | Meaning |
|---|---|
| `poPrintPrice` | what the PO authorised at that moment |
| `printedPrice` | what the operator says went on the bag |
| `priceMismatch` | true when they differ |
| `noPrintPack` | true when the PO prints nothing |
| `priceVerifiedBy` | **the person's name** — was `state.role`, which stored `"Production"`. That names a job, and you cannot go back and ask a job what it saw |
| `priceVerifiedAt` | timestamp |

### Verified — six cases in a browser

| Case | Result |
|---|---|
| No-print PO, confirmation not ticked | blocked, clear message |
| **No-print PO, confirmed** | **packs — was impossible before** |
| Priced PO 1250, operator confirms 1250 | packs, no mismatch, PO unchanged |
| Priced PO 1250, bag says 900 | packs, `priceMismatch: true`, **PO still 1250** |
| **PO has no price, operator types 777** | packs, `printedPrice: 777`, **PO price still unset** |
| **Legacy PO, operator types 500** | packs, **PO price still unset** |

The last two are the ones that matter: the write-back is gone.

### Also added — the pre-flight count

Two rows in Reports → Anomalies, so the size of the backlog is a number rather
than a guess before anything is made to block:

- **"No print/no-print decision"** — nobody has recorded whether this PO prints a
  price. Every PO from the opening import is in this state
- **"No print price"** — the PO says it prints one and none is set

A PO that deliberately prints no price is **not** an anomaly and never appears
in either.

---

*Fault 10 opened and fixed 2026-08-21. SPEC-01 rules 1, 4 and 7 are now built;
rules 3 (the QA checklist price item), 5 (correcting a print price) and 6 (the
printed documents) remain.*

---

## Fault 11 — I read a default as a decision, and shipped it live

**Found on the live system by Tahir asking me to go and look, within an hour of
the deploy. This is my error, not the app's.**

### What was on screen

`COBO-2608-4613` · VITAL AGRI NUTRIENTS. Every one of its sixteen products
showed the calm grey chip **"No price on pack"**.

The packed lots on that same PO:

| Product | Actually printed on the bag |
|---|---|
| VL-NPK | PKR 1,500 /pack |
| Tornado | PKR 950 /pack |
| Vibrant | PKR 6,700 /pack |
| Nitro Sulfur | PKR 4,500 /pack |
| VL-Micro Mix | PKR 1,500 /pack |

So the app was telling the QA inspector *"this pack should carry no price"* about
bags that plainly have prices printed on them — **a wrong instruction at the last
control before material leaves the factory.** Worse than showing nothing, because
an inspector who trusts it would pass a bag they should have questioned, or fail
one they should have passed.

### The error

`order.printOnPack` is written as `!!entryPrintOn` — the state of an **unticked
checkbox** at PO entry. I read `false` as *"this client does not want a price on
the bag"*. It means *"the KAM did not tick the box."*

Those are not the same thing, and the live data says so plainly:

| | |
|---|---|
| POs with `printOnPack === false` | **41 of 44** |
| Their PO lines carrying a price | **0** |
| Their packed lots carrying a real printed price | **150** |

A 93% "no price" rate should have been the tell. Tahir told me *some* clients do
not want a price printed. I built a model where almost all of them do not, and
never checked that against the data before shipping it.

### Why the tests did not catch it

Every test I wrote fed `printOnPack` explicitly — `true`, `false`, or absent —
and asserted the branch behaved as designed. **The branch behaved exactly as
designed. The design was wrong**, because the meaning I assigned to `false` was
not the meaning the field carries in production.

No unit test can catch that. Only the live data could, and I did not look at the
live data before shipping. The lesson is not "write more tests" — it is
**check what a field actually contains before deciding what it means.**

### The rule now

> **A printed price is "deliberately none" only when nothing contradicts it.**

Any evidence that the product does carry a price outranks the flag:

| Evidence | Result |
|---|---|
| The line itself carries a price | **priced** — the strongest signal there is, it beats the flag |
| `printOnPack === true`, no price | **missing** — a real gap |
| `printOnPack === false`, but this brand has printed a price before | **not recorded** — the box was simply never ticked. *This is the live case: 151 lines* |
| `printOnPack === false`, and nothing anywhere contradicts it | **no price on pack** — genuine |
| No flag at all | history decides: **not recorded** or **not specified** |

The 151 affected lines now read **"MRP not recorded"** in amber — honest, and it
prompts the KAM to set the price rather than reassuring an inspector about a
decision nobody made.

Fault 10's fix is unaffected: a genuinely no-print PO still packs with a single
confirmation. Verified, along with all seven states.

### What this does not fix

`printOnPack` still cannot express *"the KAM decided this PO prints no price"*
distinctly from *"the KAM did not answer"*. Until PO entry forces an explicit
choice, the flag stays a default rather than a decision, and this function is
inferring around it.

**That is the real fix and it is not built.** PO entry should ask the question
outright — *prints a price / does not print a price* — with no default, so the
data starts meaning something. Existing POs stay "not recorded" until someone
answers for them, which is what the *"No print/no-print decision"* anomaly row
is for.

---

*Fault 11 opened and hotfixed 2026-08-21, same day as the fault it corrects.
The underlying data-model gap is recorded, unbuilt, and needs Tahir's decision.*
