# O2S — open items

*Assembled 22 August 2026 from `OP-HANDOFF.md`, `docs/o2s/FAULT-REGISTER.md`,
`HANDOVER-CHECKLIST.md` and `TEAM-NOTE-2026-08-21.md`. Every code claim below was
re-checked against `o2s/o2s.html` today — several notes had gone stale.*

**Read the two corrections in §0 first. They change what is actually left.**

---

## 0 · Two things the notes get wrong

**Fault 8 is closed, not open.** The register table still reads *"Open question —
awaiting Tahir's decision."* It was decided and built: `approveRelease()` now
refuses a truck whose shipment-level inspection has not passed. Verified in the
code today. **The register row needs correcting** so nobody re-opens it.

**`printedPrice` is listed as "parked" and also as built.** The 21 Aug close says
parked; SPEC-06 was built the same evening. It is built. Corrected in the handoff
this morning.

---

## 1 · Blocked on people, not on code

None of these can be done by writing anything. Three controls stay inert until
they are.

### 1.1 · Answer print-on-pack — **you** · *the expensive one*

**44 POs on live** (I could not verify that count — `data/state.json` here is a
16 July snapshot with 21). Until they are answered, **136 product lines tell the
QA inspector nothing** about the price on the bag.

Easier than it was on 21 August. The screen now offers **three** answers, not two
— *current list price* · *a price set on this PO* · *no price* — and beside each
PO it now says what the evidence looks like:

> *Looks like: the current list price — 9 packs on this PO already went out with a
> price on them, and none of it came from the PO. Still needs your click.*

It will not pick for you and it will never suggest *no price*. On the snapshot it
reaches an opinion on 19 of 21 and admits it has nothing on 2.

**Where:** My Actions → *"Answer print-on-pack…"*, or Sales & Budget.
**Then expect a second layer:** answering *"a price set on this PO"* turns a line
from *not recorded* into **MRP not set** until the number is entered. Answering
*list price* does not — which is why most of them should be list.

### 1.2 · Verify the AQL accept/reject table — **QCM**

The lot-size and sample-size tables are sound. **The Ac/Re numbers are a best
reading and have never been checked against a copy of ISO 2859-1** — the real
table has arrows at small sample sizes redirecting to a different plan, and those
are not reproduced. Until then the inspection screen and the printed report both
carry a warning and nothing auto-rejects.

AQL **2.5**, General Level **II**. When corrected, set `masters.aqlVerified = true`
and the warnings go.

> Wrong here means shipping what should be held, or holding what should ship.

### 1.3 · Put real names on the eight accounts — **you**

Every login is named after the job, not the person, so every COA prints
*"no individual name on file"* where the analyst's name belongs. A certificate
signed by a post does not survive an ISO/IEC 17025 audit.

**Where:** Users & Access → each person → Full name. No code change.
**The better answer, not built:** one login per person. Two people sharing `qa`
still produce one name. That is `MODULE: PLATFORM` and needs its own session.

### 1.4 · Clear a stale access grant — **you**, two minutes

The live access matrix carries `datafix {e:true}` for **Production**. It does
nothing today (`screenDataFix()` hard-checks `role==='COO'`) but it becomes live
the day that check is ever refactored. Users & Access.

---

## 2 · Team feedback — every item is fixed, and nobody has been told

Three people raised four things. All four are built and deployed. **None of them
knows.**

| Who | What they said | Where it stands |
|---|---|---|
| **Majid** | A formal way to correct data-entry mistakes | **Built** — SPEC-03: one correction path, `state.corrections[]` ledger, AMEND / REVERSE / BACKFILL / SUPERSEDE, Reports → Corrections register |
| **Fahim** | Gate pass approval never appeared in his actions | **Built** — and it was five faults, not one: the *entire* truck pipeline after "Ship" raised no action items |
| **Fahim** | Mobile version | **Built** — two passes. 7 of 12 screens overflowed sideways; chrome before the first task cut 659px → 375px |
| **Plant Manager** | DC prints the wrong batch #, focal person not editable, *"the batch link must be unbreakable"* | **Built** — SPEC-05 |

### The one action here: circulate two documents

- **`docs/o2s/TEAM-NOTE-2026-08-21.md`** — written in your voice, one page, plus
  an end-of-day addendum. Read it once and change anything that does not sound
  like you. **It needs a third section adding for SPEC-06** — the price question
  is now three-way, and the note still describes the old two-way version
- **`docs/o2s/SOP-PRE-SHIPMENT-INSPECTION.md` v2.0** — **v1.0 is withdrawn and
  one of its instructions is now wrong.** Anyone inspecting off v1.0 is following
  a bad instruction today

**Say the escalation numbers will get worse before they do.** They now count from
real dates instead of dates entered late. Green going amber is the correction
working; unannounced, it reads as a regression.

---

## 3 · Decisions only you can make

| | The decision |
|---|---|
| **Sequence validation** | Five of the six rules are still unbuilt. The recommendation stands: build them as **warnings**, run a month, promote the ones that prove right. Not built unless you say so |
| **The entry-lag lock** | **Do not turn it on yet.** Let the late-entry rows run at least four weeks first — lock against an unmeasured baseline and nobody can tell afterwards whether it helped or whether people just stopped recording |
| **`mfgDate` / `expDate` after shipping** | The batch number is now locked once material moves. These two are not, and they are printed on the bag as well. Same class of problem |
| **Data Fix authority** | It edits many lines at once and bypasses the per-record authority table. It is COO tooling and the screen now says so in amber. Changing its gate on a live system is your call, not a side effect |
| **Fault 9c** | Which of the Dashboard's three stacked banners earns its place |
| **Adopting packed prices as authorised** | The printed prices are sitting in the packing lots and could fill the *MRP not set* gap in one sweep. **Deliberately not built** — it is close to letting a packer's number become the authorised one. Ask and it becomes an explicit, logged adoption |

---

## 4 · Build queue

In the order the register recommends.

1. **SPEC-02 — the PO dossier.** *Verified today: 0 references in the code.* The
   last untouched problem from the opening brief, and a pure read — it cannot
   break anything. Everything it wants underneath it now exists
2. **SPEC-04 steps 2, 5, 6, 9, 10** — the same three date fields on the remaining
   events (shift output, RM/PR, gate release), then the entry-lag dashboard.
   *Verified today: `recordedAt` exists (step 1 landed), no lag dashboard*
3. **The Gate Pass carries no batch column at all** — small, and it is a printed
   document going out of the gate
4. **A truck loaded before a COA supersede is not recalled** — it cannot be. The
   system says the customer's copy is stale; acting on it stays a person's job.
   Recorded so nobody reports it as a bug

---

## 5 · Watch on the first live load after this deploys

Expected, not faults. **A number going up is the signal, not the number itself.**

| What | Expect | Meaning |
|---|---|---|
| *"One batch number, more than one mfg date"* | **14 rows** | The backlog. Should only ever fall. A **new** row after this deploy means something went wrong that day |
| *"Print price is not a real price"* | **2 rows** | V-Borate 17% and V-NPK 20:20:20, both at PKR 0.1 — typed to get past the old mandatory-price gate |
| POs ever printed from the system | **0 of 44** | The PO register is new |
| Batches finished but still open | **23** (140,712 Kg) | None needs a variance reason — all on plan. One click clears them |
| `state._shipLotLink` | read it once | If `ambiguous` or `unmatched` is above zero, those rows need a person |
| Escalation / overdue | **worse than yesterday** | Real dates instead of late-entered ones. Tell the team first |

---

## 6 · Not committed yet

This morning's work is in the working tree and **not pushed**:

- `o2s/o2s.html` — four SPEC-06 defects fixed, backlog screen hardened, the
  recommendation added
- `docs/o2s/SPEC-06-PRICE-ON-PACK.md` — new, with the correction addendum
- `o2s/tests/` — new. **85 checks, two suites, that actually exist on disk**
- `OP-HANDOFF.md` — this morning's entry

```
node o2s/tests/spec06.test.js     # 52
node o2s/tests/backlog.test.js    # 33
```

Everything before this morning is in `main` @ `46123ff`.

---

## The shortest version

**Tomorrow:** answer the 44 · send the two documents · get the QCM onto the AQL
table · put real names on the accounts.

Three of those are half an hour each. The 44 is one sitting, and it is the one
that unblocks the most.

---

*Assembled 22 August 2026. Module: O2S.*
