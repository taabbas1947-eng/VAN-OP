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
