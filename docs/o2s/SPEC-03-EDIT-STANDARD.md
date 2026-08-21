# SPEC-03 — The standard correction path

**Fixes [Fault 4](FAULT-REGISTER.md#fault-4--no-standard-way-to-correct-a-record).**

---

## The principle

> **Every record in O2S is corrected the same way, by the same rules, and
> leaves the same kind of trail — whatever it is.**

Today there are eight different mechanisms, three record types that cannot be
corrected at all, and correction is concentrated in the COO. The result is that
wrong data stays wrong, people work around it, and the screens stop being
believed.

This spec defines one path. It applies to a batch card, a PO, a packing run, a
QC report, a shipment, an inspection and a master-data row identically.

---

## The three operations, and only three

Every correction in the system is one of these. There is no fourth.

| Operation | What it means | When it is allowed |
|---|---|---|
| **AMEND** | The record is right, a value on it is wrong | The record has not yet been consumed by a downstream control |
| **REVERSE** | The record should not exist. It is cancelled, not deleted | Always, with authority — but never silently |
| **SUPERSEDE** | The record was right at the time and is now replaced by a corrected version. Both remain | For signed or issued records — COA, inspection, DC, gate pass |

**Nothing is ever deleted.** A reversed record stays visible with a strike-through
and its reversal reason. This is not a preference; it is what makes a batch
number traceable years later, which is intent 2.

---

## Which operation applies to which record

| Record | Default operation | Notes |
|---|---|---|
| PO header (client, channel, dates) | AMEND | |
| PO line (qty, committed, invoice price, **print price**) | AMEND | Warn if material is already packed against it |
| PO line — after the line is closed | SUPERSEDE | |
| Batch card, while open | AMEND | |
| Batch card, once lots are logged | REVERSE only | Amending a batch under production corrupts quantity reconciliation |
| Shift output / lot | AMEND | Recompute batch totals |
| **COA — before QCM approval** | AMEND (this is today's `coaReject` path) | |
| **COA — after QCM approval** | **SUPERSEDE** | Issue COA rev. B. Both print. Rev. A is marked superseded, not hidden. **Today: impossible** |
| **Packing run** | REVERSE, then re-enter | Returns the Kg to the batch and to the PO line. **Today: impossible** |
| **Pre-shipment inspection — failed** | AMEND (today's `lotQACorrect` / `clearQaHold`) | |
| **Pre-shipment inspection — passed** | **SUPERSEDE** | A re-inspection is a new inspection; the first one stays. **Today: impossible** |
| Shipment, before gate release | AMEND | |
| Shipment, after gate release | SUPERSEDE | The DC has left the building |
| Delivery confirmation | AMEND | |
| Master data (product, dealer, RM, lab template) | AMEND | Archive rather than delete when it is referenced |

The three rows in bold are the ones that are currently impossible and are
therefore the priority.

---

## The five rules that apply to all of them

### C1 · Every correction states a reason

A free-text reason is **mandatory**, minimum 10 characters, entered in a proper
`<textarea>` — not a `prompt()` box (see
[UI-FIELD-AUDIT](UI-FIELD-AUDIT.md) rule R7).

Optionally preceded by a category from a master list — *keying error ·
wrong batch selected · quantity miscount · price wrong on PO · backdated entry ·
customer amendment · other* — so corrections become countable and the pattern
becomes visible.

### C2 · Every correction records the same six things

| Field | Value |
|---|---|
| `op` | `AMEND` \| `REVERSE` \| `SUPERSEDE` |
| `by` | The **person's name**, from `state.currentUser.name` — never the role |
| `at` | ISO timestamp, system |
| `reason` | Category + free text |
| `before` | The full prior value of every changed field |
| `after` | The new value |

Written to a single new array, `state.corrections[]`, **in addition to**
`state.audit` and `state.actionLog`. One place to read every correction ever
made, filterable by person, record type, category and date.

### C3 · Authority is by record type and stage, not by being the COO

Today Data Fix is COO-only, so every correction anywhere queues behind one
person. Replace with a table:

| Record | Amend | Reverse | Supersede |
|---|---|---|---|
| PO header / line | KAM (own POs) | COO | COO |
| Print price | KAM, COO | — | COO |
| Invoice price | CFO, COO | — | COO |
| Batch card | Production | Plant Manager | — |
| Shift output / lot | Production | Production, same day; Plant Manager after | — |
| COA | Analyst (draft) · AQCM · QCM | QCM | QCM + Plant Manager |
| Packing run | — | Production, same day; Plant Manager after | — |
| Inspection | QA Inspector (failed) | — | QA Inspector + Plant Manager |
| Shipment | Supply Chain | Supply Chain before release; Plant Manager after | Plant Manager |
| Master data | Screen owner | COO | — |

The COO remains able to do anything (`hardRole` already grants this everywhere).
The point is that the COO is no longer *required* for routine corrections —
which is what currently makes people leave errors in place.

> **Use `hardRole()`, not `canEdit()`, for every correction gate.** The comment
> at L1960–1968 documents the 2026-07-30 incident where a screen-level Edit
> grant silently unlocked approval steps. Corrections are approvals. They must
> check the assigned role, never the per-screen access-matrix override.

### C4 · Corrections cascade, visibly

Reversing a packing run must return the Kg to the batch and to the PO line, and
must say so on screen before it is confirmed:

```
Reverse packing lot VGP-26-0088 (1,800 Kg)?

This will:
  · return 1,800 Kg to base batch B-26-0088
  · reduce PO-2026-0142 / V-Germinator Pro packed from 5,000 → 3,200 Kg
  · void the pre-shipment inspection dated 09 Aug (PASS, Insp. Kashif)
  · reopen the line, which is currently Dispatched

3 shipments reference this lot. They are NOT reversed —
they must be handled separately. [Show them]
```

The person confirming sees the full consequence first. Nothing cascades
silently. Where a cascade would touch something already shipped, the system
**refuses** and names what is blocking.

### C5 · Every correction is visible on the record

Not buried in a log. On the record itself:

- An amended field shows a small marker; hovering shows *was X, changed to Y by
  Kashif on 14 Aug — "keying error, entered 1800 not 800"*
- A reversed record renders struck through, greyed, with the reason inline
- A superseded record shows **Superseded by rev. B** and links to it; the new
  record shows **Supersedes rev. A**
- Every one of these appears in the [PO Dossier](SPEC-02-PO-DOSSIER.md) trail

---

## The single UI

One component, `openCorrect(recordType, recordId)`, used from everywhere:

```
┌─────────────────────────────────────────────────────┐
│  Correct record                                      │
│  Packing lot VGP-26-0088 · PO-2026-0142 · 1,800 Kg  │
├─────────────────────────────────────────────────────┤
│  What is wrong?                                      │
│   ( ) Amend a value on this record                   │
│   (•) Reverse it — it should not exist               │
│   ( ) Supersede it with a corrected version          │
├─────────────────────────────────────────────────────┤
│  [ field-by-field editor, or the cascade preview ]   │
├─────────────────────────────────────────────────────┤
│  Category *   [ Keying error            ▾ ]          │
│  What happened? *                                    │
│  ┌───────────────────────────────────────────────┐  │
│  │                                               │  │
│  └───────────────────────────────────────────────┘  │
│                                            0 / 500  │
├─────────────────────────────────────────────────────┤
│  You are signed in as Kashif Mahmood · QA Inspector  │
│                          [Cancel]  [Apply correction]│
└─────────────────────────────────────────────────────┘
```

Every screen that shows a record gets a **Correct** action on it. There is no
separate "Data Fix" destination for routine corrections — you correct a record
where you are looking at it, which is the whole reason people currently do not.

### What happens to Data Fix

Data Fix stops being the correction tool and becomes what its own description
already claims it is (L1996–1997): the **implementation backfill** tool for
loading historical paper records during cutover. Its "Correct a PO" operation
is replaced by the standard path.

That is a real simplification, not a rename — it removes one of the eight
mechanisms.

---

## What gets built first

| Order | Work | Why |
|---|---|---|
| 1 | `state.corrections[]` + the `recordCorrection()` helper | Everything else writes through it |
| 2 | The `openCorrect` modal, with AMEND only | One UI, one set of rules |
| 3 | Wire AMEND into the paths that already exist, replacing their bespoke code | Removes mechanisms rather than adding a ninth |
| 4 | REVERSE, with the cascade preview | The hard part — the preview logic is most of the work |
| 5 | **Packing run reverse** | The most damaging gap today |
| 6 | SUPERSEDE for COA and inspection | Requires a revision number on those records |
| 7 | The correction register — a Reports view over `state.corrections[]` | Makes the pattern visible: who corrects what, how often, why |

Step 7 is worth calling out. Once corrections are countable, *"this person
reverses 30% of their packing entries"* and *"this PO has been amended nine
times"* become visible facts rather than suspicions.

---

## Acceptance tests

1. A packing run entered with the wrong quantity can be reversed by Production
   on the same day, the Kg return to the batch and the line, and the reversal
   shows on the record. → *Today: impossible.*
2. A QCM-approved COA can be superseded with a rev. B. Both print. Rev. A is
   marked superseded and stays traceable. → *Today: impossible.*
3. A passed inspection can be superseded by a re-inspection. Both stay in the
   dossier. → *Today: impossible.*
4. Reversing a packing lot that has already shipped is **refused**, naming the
   shipment and its DC.
5. Every correction, of every type, appears in one register with person,
   category, reason and before → after.
6. A Supply Chain user given screen Edit on Lab QC **cannot** correct a COA.
   → *Regression test for the 2026-07-30 incident.*
7. No correction anywhere in the app uses `prompt()`.

---

*Spec written 2026-08-21. Module: O2S. Status: not implemented.*

---

# BUILT — 2026-08-21 · the spine, AMEND and REVERSE

Tahir: *"a universal path and strategy to edit and correct with a log of who
corrected and when… right now we have multiple paths and we need to close all
and keep one which best suits a system which has to become an ERP 2–3 years
down the line."*

## What was actually there

A "correction" was **a sentence**. `reconLog()` prefixed `RECONCILE:` onto free
text in the action log — 14 call sites, no structure. You could not count
corrections, filter them by person, or reconstruct what a record held before
one. `state.audit` carried some field changes but stamped `user: state.role` —
the job, not the person.

For a system meant to become an ERP, that is the gap that matters. Not "there
are eight editors" — that is a symptom. The cause is that a correction was not
a **record**.

## What exists now

### One ledger, append-only

`state.corrections[]`. Never edited, never deleted. Each entry is a complete,
self-describing fact — the change can be reconstructed from the entry alone,
without the record it changed:

| Field | |
|---|---|
| `id` `at` | identity and an immutable timestamp |
| `by` `byUser` `byRole` | **the person**, their account, and the role they held |
| `op` | `AMEND` · `REVERSE` · `SUPERSEDE` |
| `entityType` `entityId` `entityLabel` | what was corrected — the label captured **at the time**, because labels change |
| `changes[]` | field, label, **before**, **after** |
| `reasonCode` `reason` | a code *and* a sentence |
| `cascade[]` | everything else that moved |

It still writes to `actionLog` and `audit`, so nothing that reads those goes
blind.

### One registry, not eight editors

`CORRECT_ENTITY` describes each record type **once**: how to find it, what to
call it, which fields may be amended, who may act, what cascades, and what
blocks a reversal.

**This is the property that has to hold when this becomes an ERP.** Adding a
record type is a registry entry, not another bespoke editor — so the correction
path cannot grow a ninth mechanism the next time somebody adds a table.

Registered today: **purchase order · PO product line · packing run · shipment ·
production batch.**

### One modal

`openCorrect(type, id)` — the same screen everywhere, reached from the record
you are already looking at. No separate destination to remember, which is most
of why the old paths went unused.

### Reason codes, so corrections become countable

*Keying error · wrong record · quantity miscount · price wrong on the PO ·
recorded late · customer amended · duplicate · other.*

Forty-seven keying errors on the packing screen is an instruction to go and look
at that screen. Forty-seven free-text sentences are not.

### Authority, by record type and operation

Uses **`hardRole()`, never `canEdit()`** — see the 2026-07-30 incident comment:
a screen-level Edit grant once silently unlocked approval steps. A correction is
an approval.

| Record | Amend | Reverse |
|---|---|---|
| Purchase order | KAM, COO | COO |
| PO product line | KAM, COO *(invoice price: CFO, COO)* | COO |
| Packing run | Production, COO | Production, Plant Manager, COO |
| Shipment | Supply Chain, COO | Supply Chain, Plant Manager, COO |
| Production batch | Production, COO | Plant Manager, COO |

Verified: a KAM cannot touch a packing run; Production cannot touch a PO line.

### Nothing is ever deleted

A reversed record stays visible, **struck through**, with its reason. That is
what keeps a batch number traceable in five years.

### The cascade is shown before it happens

Reversing a packing run says what will move, then moves it:

> - Batch B-88 packed 1,200 → 0 Kg
> - PO-1 · Zorro packed 1,200 → 0 Kg
> - Voids the inspection dated 2026-08-09 (PASS)

And it **refuses** rather than unpicking something that has left:

> *Cannot reverse — 1 shipment(s) reference this record: DC-9 (500 Kg, in transit)*

### The register

**Reports → Corrections · who changed what, and why.** Filterable by operation,
record type, person, role and reason code.

## The one that mattered most

**A packing run could not be corrected at all.** It can now be amended *and*
reversed, with the batch and the PO line returning to their correct quantities
and the inspection voided. That was the most damaging gap in the register.

## Verified

| | |
|---|---|
| Authority | KAM blocked on a packing run; Production blocked on a PO line |
| AMEND | person, account, role, field-level before→after, reason all recorded |
| No reason | blocked |
| One-word reason | blocked — *"a sentence, not a word"* |
| REVERSE | cascade warned, then applied; ledger holds all three cascade lines |
| REVERSE with a shipment attached | **refused**, naming the DC |
| Register | structured row, every column populated |

## Not built

**SUPERSEDE.** A QCM-approved COA and a passed inspection still cannot be
replaced with a corrected revision. Both need a revision number on the record
and both print, so it is a larger change than AMEND or REVERSE and deserves its
own pass.

**The 14 legacy `reconLog()` sites.** They still work and still log. A bridge —
`reconCorrection()` — exists so they can be moved onto the ledger one at a time
without a big-bang rewrite. Data Fix should be the first to move.

---

# A bug found while building this, and fixed in six places

Re-rendering a form on `oninput` **destroys and rebuilds the input**, so focus is
lost after the first keystroke. Typing `ZR-2026-0099` landed as **`ZR-42Z`**.

Four of the six were mine, added the same day — the correction fields, the two
sampling boxes and the packing price. Two were pre-existing (RM receive quantity,
RM can-make quantity) and had the same fault; fixed while there rather than left
broken.

The pattern now: **store on `oninput`, re-render on `onchange`.** The conditional
warnings still appear — they just wait until you have finished typing.

*This is worth remembering: every assertion-based test passed, because tests set
values directly instead of typing them. Only a browser typing character by
character found it.*

---

*Spine, AMEND and REVERSE built and verified 2026-08-21. Module: O2S.*
