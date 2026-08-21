# SPEC-04 — Real-time discipline

**Fixes [Fault 5](FAULT-REGISTER.md#fault-5--event-dates-are-keying-dates-so-late-entry-is-invisible).**
This is the spec that decides whether O2S is a control system or a record of
what people remembered to type.

**Scope chosen by Tahir on 2026-08-21:**

- ✅ Record actual date **and** entry date on every event
- ✅ Make lateness visible to management
- ✅ Hard lock after N days, with a named authority — **Plant Manager** — able
  to enter past the lock
- ⬜ Sequence validation — *not selected. Recommended anyway; see "The one
  thing you did not pick" at the end.*

---

## The diagnosis in one sentence

**O2S cannot currently tell the difference between something that happened
today and something that was typed in today**, because for most events they are
the same field.

`TODAY` is stamped into records **84 times**. The pre-shipment inspection date
(`dispQASubmit` L6160, `lotQASubmit` L4496), the COA approval date
(`coaApprove` L4472) and the packing run date (`doPack` L4291) are all forced
to the system date and are not enterable at all.

So the situation Tahir described — *"what is the purpose of a pre-inspection
report if it was done 5 days after the actual shipment"* — is not a discipline
failure the system failed to catch. **It is a state the system cannot
represent.** There is no field in which the truth could be stored.

Everything else in this spec depends on fixing that first.

---

## Part 1 · Two dates on every event *(foundation — build this first)*

### The change

Every event record gains two fields:

| Field | Meaning | Set by | Editable |
|---|---|---|---|
| `actualDate` | When the thing **happened** in the factory | The person, defaulting to today | Yes, within the window |
| `recordedAt` | When it was **keyed into O2S** | The system, ISO timestamp | Never |
| `recordedBy` | Who keyed it | `state.currentUser.name` | Never |

`lag = actualDate → recordedAt`, in days. That number is the whole point. It
does not exist today and cannot be computed from existing data.

### Which records

| Record | `actualDate` is | Enterable today? |
|---|---|---|
| Batch opened | The date production started the batch | Partly (`openedDate`) |
| Shift output / lot | The shift date | ✅ yes (L4092) |
| **COA approval** | The date QCM signed | ❌ **forced to today** |
| **Packing run** | The date the material was packed | ❌ **forced to today** (mfg/exp are enterable, the run date is not) |
| **Lot QA inspection** | The date the inspector inspected | ❌ **forced to today** |
| **Dispatch QA inspection** | The date the inspector inspected | ❌ **forced to today** |
| Dispatch | The date the truck left | ✅ yes (L5457, L6085) |
| Gate release | The date the gate pass was used | Not verified |
| Delivery | The date the customer received it | ✅ yes (L5268) |
| PR raised / RM ready | The actual date | Partly |

The four marked ❌ are the priority. They are also, not coincidentally, the four
that sit closest to material leaving the factory.

### Backward compatibility

This is **purely additive**. No existing field is renamed or removed.

For records written before this change, `actualDate` falls back to the existing
date field and `recordedAt` is unknown. **Render unknown lag as `—`, never as
`0`.** Showing zero lag for historical records would manufacture a clean history
that was never verified, which is the exact failure this spec exists to end.

Add a one-line marker to migrated records: `preLagTracking: true`, so the
dashboard can exclude them honestly rather than silently.

### The entry UI

Every event form gets the same date control:

```
Date this actually happened *
[ 2026-08-21 ▾ ]   ← defaults to today

⚠ 5 days ago. Why is this being recorded now?
[ Reason for late entry .............................. ]
```

The reason box appears **only** when `actualDate` is before today. Below the
soft threshold it does not appear at all, so same-day work is never slowed
down. This matters: if entering today's work becomes slower than entering last
week's, the system teaches the wrong habit.

---

## Part 2 · Lateness visible to management

### Thresholds

| Event | Soft — reason required | Hard — locked, needs Plant Manager |
|---|---|---|
| Shift output / lot | 1 day | 3 days |
| COA sign-off | 1 day | 3 days |
| Packing run | 1 day | 3 days |
| **Pre-shipment inspection** | **same day** | **2 days** |
| Dispatch | same day | 2 days |
| Gate release | same day | 2 days |
| Delivery confirmation | 2 days | 7 days |
| RM / PR events | 2 days | 7 days |

The inspection and dispatch thresholds are the tightest on purpose. Those two
are the ones that were reported as broken, and they are the two where a late
entry destroys the control rather than merely delaying the record.

These belong in a master-data table, not hard-coded, so they can be tuned
without a deploy — **but only the COO may change them**, and every change is
logged. A threshold that anyone can relax is not a threshold.

### The dashboard — "Entry discipline"

New COO / Plant Manager screen. Four views over one dataset.

**By person**

| Person | Role | Entries (30d) | Same day | 1–2 d | 3+ d | Median lag | Worst |
|---|---|---|---|---|---|---|---|
| Kashif M. | QA Inspector | 42 | 31% | 24% | **45%** | 2 d | 9 d |
| Imran A. | Production | 118 | 89% | 9% | 2% | 0 d | 4 d |

**By screen** — the same columns per screen, which shows whether a screen is
hard to use rather than a person being slow. If every user of one screen is
late, the screen is the problem.

**Bulk-entry detection** — the mechanism Tahir named directly. Flag any session
where **5 or more events with 3 or more distinct `actualDate` values are keyed
within 15 minutes**. That is a person catching up on a week, and it is exactly
what dissolves the value of the system.

```
⚠ Bulk entry · Kashif Mahmood · 14 Aug 16:40–16:52
   11 pre-shipment inspections keyed in 12 minutes
   covering actual dates 04 Aug – 12 Aug
   [Open the 11 records]
```

**Records still open past their threshold** — the operational view. A shipment
dispatched with no inspection recorded, a batch with no COA after 3 days. This
is the one the Plant Manager should look at daily.

### Making it land where people already look

Add an **Entry lag** column to the Action Center, and to every record shown in
the [PO Dossier](SPEC-02-PO-DOSSIER.md) trail. A number nobody sees changes
nothing; the dashboard is for the pattern, the inline column is for the moment.

---

## Part 3 · The hard lock, with Plant Manager authority

### The behaviour

Past the hard threshold, the ordinary user cannot save. They see:

```
This is 6 days old. Recording it here needs Plant Manager approval.

  Inspection of VGP-26-0088 · 1,800 Kg · PO-2026-0142
  Actual date: 08 Aug 2026    Today: 14 Aug 2026

[ Request Plant Manager approval ]      [ Cancel ]
```

**Request** raises an Action Center item owned by the Plant Manager, carrying
the full draft entry. The Plant Manager sees exactly what is proposed, and
either enters it themselves or approves it for the original user to save.

### Who holds the authority

| Level | Who | Can enter past the hard lock |
|---|---|---|
| Ordinary | Everyone | No — must request |
| **Backdate authority** | **Plant Manager** | Yes, with a mandatory written reason |
| Override | COO | Yes, always |

Implement as a new capability flag rather than a hard-coded role check, so a
second authority (a QA Manager, a shift superintendent) can be added later
without touching the logic. Gate it with `hardRole()`, **never** `canEdit()` —
see the 2026-07-30 incident comment at L1960.

### Every backdated entry is marked, permanently

A record entered past the hard lock carries `backdated: true`, the approver's
name, and the reason. It renders with a marker everywhere it appears —
including on the printed inspection report and in the PO dossier.

This is deliberate and it is the point of the whole mechanism. If a
pre-shipment inspection was recorded six days after the truck left, **the
printed inspection report must say so.** A document that hides that is worse
than no document, because it certifies something nobody verified at the time.

### One caution, stated plainly

A hard lock creates pressure to record something *convenient* rather than
nothing — for example, entering today's date so the save goes through. Two
mitigations:

1. **Requesting approval must be genuinely easier than falsifying a date.** One
   click, the draft is preserved, the Plant Manager gets it in the Action
   Center immediately. If requesting is slower than lying, people will lie.
2. **Watch the numbers after go-live.** If same-day entry rises while the total
   number of recorded events falls, people have stopped recording rather than
   started recording promptly. The dashboard should show total event volume
   beside the lag figures so that shift is visible.

Do not enable the lock until the dashboard has been running for at least four
weeks and the current baseline is known. Locking against an unmeasured baseline
means nobody can tell whether it helped.

---

## The one thing you did not pick

**Sequence validation** was not selected. I am recording the recommendation
because it is cheap and it catches the exact failure that was reported.

Without it, `actualDate` is free — nothing stops an inspection dated **after**
the dispatch it was meant to authorise. The two-date change makes that
*visible*; sequence validation makes it *impossible*.

The rules are few:

| Rule | Blocks |
|---|---|
| Pre-shipment inspection ≤ dispatch date | The reported failure, exactly |
| Packing ≥ COA approval date | Packing uncertified material |
| Dispatch ≥ inspection date | Shipping before inspecting |
| Delivery ≥ dispatch date | Arriving before leaving |
| Shift output ≥ batch opened date | Producing before starting |
| No `actualDate` in the future | Typos and pre-dating |

Each is one comparison at save time, with a clear message naming the conflicting
record and its date. Perhaps 40 lines in total, and the sixth rule alone catches
a whole class of keying errors.

My recommendation is to build them **as warnings first** — save is allowed, but
the record is flagged and appears on the dashboard. Run that for a month, see
how often each fires and whether any rule is wrong about how the factory
actually works, then promote the ones that prove correct to hard blocks. That
gets the protection without betting on my model of your process being right.

Your call. It is not built unless you say so.

---

## Build order

| Step | Work | Ships | Depends on |
|---|---|---|---|
| 1 | `actualDate` / `recordedAt` / `recordedBy` on the four ❌ records | Truth becomes storable | Nothing |
| 2 | Same three fields on every remaining event record | Complete coverage | Step 1 |
| 3 | The shared date control with the conditional late-entry reason | Consistent entry everywhere | Step 1 |
| 4 | Entry-lag column in the Action Center and the dossier trail | Lag visible at the moment | Steps 1–2 |
| 5 | The Entry Discipline dashboard, all four views | The pattern visible | Steps 1–2 |
| 6 | Bulk-entry detection | The named behaviour becomes measurable | Step 5 |
| 7 | Thresholds in master data, COO-editable, logged | Tunable without a deploy | Step 5 |
| 8 | Soft warnings — reason required past the soft threshold | Gentle pressure | Steps 3, 7 |
| 9 | **Baseline period — at least 4 weeks, no lock** | You learn what normal is | Steps 5–8 |
| 10 | The hard lock + Plant Manager approval flow | Enforcement | Step 9 |
| 11 | Sequence validation as warnings, *if you want it* | | Steps 1–2 |

Steps 1 and 2 are the ones that matter most and are the least visible. Nothing
downstream — not the dashboard, not the lock, not the dossier's trail, not the
escalation engine's credibility — works without them.

---

## A note on the escalation engine

The Action Center already has escalation with locked thresholds (`acEscalation`
L5003; 1 day for acknowledge / RM / Lab QC, 2 days for QA / ship, 4-day silence
for produce). That engine is well built.

It is currently measuring elapsed time from dates that were themselves entered
late. **It reports green on a process that ran red.** Once step 1 lands,
escalation should measure from `actualDate` — at which point it starts telling
the truth, and the numbers will look worse before they look better. That is the
correction working, not a regression.

---

## Related: who signed the inspection

Both inspection modals ask the inspector to **type their own name** into a free
text field (L4491 — labelled *"Inspector name (shared QA login)"* — and L6155),
and store that string as the signatory.

So the last control before material leaves the factory is signed by a self-typed
name, on a shared account, on a date the system chose. Any one of those three
would weaken the record. Together they mean the pre-shipment inspection cannot
be relied on as evidence.

This is a **PLATFORM** matter, not O2S — it needs individual logins for QA
staff (`auth_users`, `user_module_roles`), which is outside this module's
boundary under `CLAUDE.md` §1. It is recorded here because it sits directly on
top of intent 4, and because fixing the date without fixing the identity only
gets you a truthfully-dated anonymous signature.

Raise it as a separate `MODULE: PLATFORM` piece of work.

---

*Spec written 2026-08-21. Module: O2S. Status: not implemented.*

---

# BUILT — 2026-08-21 · Step 1 and part of steps 3, 4

## What is now in the code

Three fields travel with every event that previously forced today's date:

| Field | Meaning | Set by | Editable |
|---|---|---|---|
| `actualDate` | when it happened in the factory | the person | yes, within the window |
| `recordedAt` | when it was keyed into O2S | system, ISO | never |
| `recordedBy` | who keyed it | the person's name | never |
| `enteredLate` | days late, only when past the threshold | derived | — |
| `lateReason` | why it is being recorded now | the person | — |

`date` is still written, set to `actualDate`, so **every existing reader picks up
the true date without being touched** — stage rollups, escalation, the QA gates,
reports, the packing log. That was the design choice that kept this change small.

### The four that could not record a real date — now can

| Event | Before | Now |
|---|---|---|
| Packing run (`doPack`) | `date: TODAY`, not enterable | "Date this was actually packed" |
| PO-direct pack (`submitProdQty`) | had a date field that was never used | wired through, with the late-entry gate |
| Lot inspection (`lotQASubmit`) | `date: TODAY`, not enterable | "Date this lot was actually inspected" |
| Shipment inspection (`dispQASubmit`) | `date: TODAY`, not enterable | "Date this truck was actually inspected" |
| Pack inspection (`savePackInspect`) | `date: TODAY`, not enterable | "Date this material was actually inspected" |

Divert-packing is stamped at today, since a divert happens as it is recorded.

**COA approval is deliberately different.** It gets `recordedAt` and `recordedBy`
but no date entry: a signature's date *is* the moment of signing, and letting
someone backdate their own sign-off would weaken the record rather than
strengthen it. Backdating a COA belongs in the correction path
([SPEC-03](SPEC-03-EDIT-STANDARD.md)), where it leaves a trail.

## The entry control

`evDateField()` — one control, used by every event form. The late-entry reason
box appears **only** once the date is past that event's threshold.

That conditional matters more than it looks. If recording today's work were
slower than recording last week's, the system would be teaching the wrong habit.
Same-day entry is one date field and nothing else.

`evDateGate()` refuses two things:

- a **future date** — outright, no override. There is no honest reason to record
  something that has not happened
- a **late entry with no reason** — minimum six characters, in a real textarea

## Thresholds

In master data (`state.masters.entryThresholds`), so they can be tuned without a
deploy — COO only. Defaults:

| Event | Reason required after |
|---|---|
| Shipment inspection · pack inspection · dispatch | same day |
| Lot inspection | same day |
| Packing run · COA · shift output | 1 day |
| Delivery confirmation | 2 days |

The inspection and dispatch thresholds are tightest on purpose: those are the
two where a late entry destroys the control rather than merely delaying the
record.

## Legacy records

`recordedAt` is absent, so `evLag()` returns **null** and the badge reads
*"entry date not tracked"*. **It never renders as 0.** Showing zero lag for
records nobody verified would manufacture a clean history and defeat the point
of the change.

## Visible today, without the dashboard

Five new rows in **Reports → Anomalies**, so the pattern is countable now rather
than after step 5:

- **Packed late — recorded Nd after**
- **Inspected late — recorded Nd after** (lot and pre-shipment)
- **Truck inspected late — recorded Nd after**
- **Inspection dated after dispatch** — *the exact case Tahir described*: the
  truck left on the 14th, the inspection is dated the 19th, so the inspection
  cannot have authorised the shipment

Each row names the person who keyed it and quotes the reason they gave, or says
*"no reason given"*.

## Verified — six cases in a browser

| Case | Result |
|---|---|
| Inspected today | saves, lag 0, no reason asked, no friction |
| Inspected 5 days ago, no reason | **blocked** — "say why it is being recorded now" |
| Inspected 5 days ago, with reason | saves · `actualDate` 16th · `recordedAt` 21st · `enteredLate: 5` · reason stored · **`date` is the 16th, not today** |
| Date in the future | **blocked** |
| Legacy record | lag `null`, badge "entry date not tracked" — never 0 |
| Inspection dated after its dispatch | **flagged in Anomalies** |

## Still to build

| Step | Work |
|---|---|
| 2 | The same three fields on the remaining event records — shift output, RM/PR events, gate release |
| 5 | The Entry Discipline dashboard — by person, by screen, bulk-entry detection |
| 6 | Bulk-entry detection: 5+ events across 3+ distinct actual dates keyed within 15 minutes |
| 9 | **A baseline period of at least four weeks before any lock.** Locking against an unmeasured baseline means nobody can tell whether it helped |
| 10 | The hard lock with Plant Manager approval |
| 11 | Sequence validation as warnings — *partly delivered already*: "inspection dated after dispatch" is the first of the six rules, running as a report rather than a block |

## A note on the escalation engine

`acEscalation` now measures from dates that are true rather than from dates that
were themselves entered late. **The numbers will look worse before they look
better.** That is the correction working, not a regression.

---

*Step 1 built and verified 2026-08-21. Module: O2S.*
