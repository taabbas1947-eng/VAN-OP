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

### 1.1 · Answer print-on-pack — **you** · *the expensive one · see §1A.1 for how to do it safely*

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

### 1.3 · Put real names on the eight accounts — **you** · *read §1A.3 first, this is not as simple as it looks*

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

## 1A · How to run each of the four without breaking anyone's day

*Added 22 August 2026, after Tahir asked how to handle these. Two of my earlier
recommendations were wrong and are corrected here.*

---

### 1A.1 · The 44 POs — **do not do all 44 in one sitting**

**The risk nobody flagged yesterday:** answering a PO does not just tidy a
record. It changes, immediately and live, what packing and QA are shown on
orders that are already in flight.

Two specific consequences:

- Answer **"current list price"** → every future inspection touching that PO now
  has a **new mandatory field**. QA cannot save without reading the price off the
  bag. A truck at the gate this afternoon meets a required box that was not there
  this morning, with no warning
- Answer **"a price set on this PO"** → the line goes from grey *not recorded* to
  **red "MRP not set"** until somebody types the number, and QA is told
  *"this PO prints a price but none is set — ask the KAM before passing."*
  **That is a real block on a real truck**

Neither is a bug. Both are the control doing its job. But arriving unannounced,
mid-shift, they read as the system breaking.

### The sequence

1. **Send the brief first.** QA needs to know about the new box, and needs to
   have the current price list in hand, before the first PO is answered
2. **Answer five, not forty-four.** Pick five that are finished — nothing in
   production, nothing loading — and watch what the screens do for a day
3. **Then the rest, outside shift hours.** The screen is read-only until you
   press Save, so you can work through it and abandon it safely
4. **Answer "a price set on this PO" ONLY where you will enter the number in the
   same sitting.** Leaving it half-done converts a quiet grey line into a red
   block on a truck. If you are not sure of the number, leave the PO unanswered
   — grey is honest, red is a stoppage
5. **Prefer "list price" where the evidence supports it.** It carries no number,
   so it cannot half-land

### On the recommendation column

It reads the evidence, it does not know the answer. It is right about the shape
of the thing — *packs on this PO already went out with a price and none of it
came from the PO* is a fact, not a guess. But **the KAM has the client's
instruction and the system does not.** Where the recommendation and the KAM
disagree, the KAM is right.

It refuses to guess on 2 of 21 in the snapshot. Those are the ones to ask about.

---

### 1A.2 · The AQL table — **the flag is cosmetic, the checking is not**

**Correction to what I told you.** `masters.aqlVerified` does exactly one thing:
it removes the red *"accept/reject numbers NOT yet verified against the standard"*
line from the screen and the printed report. Verified in the code today — it is
the only thing that flag touches. **Nothing auto-rejects either before or after.**

So the danger is not that turning it on changes behaviour. **The danger is that
it stops the report admitting it is unverified while the numbers are still
unchecked.** A report that says nothing is trusted more than one carrying a
warning.

### What to actually ask the QCM

Do not ask him to review code. Ask him one narrow question:

> For **AQL 2.5, General Inspection Level II**, single sampling, normal
> inspection — for each sample size we use (2, 3, 5, 8, 13, 20, 32, 50, 80, 125,
> 200, 315, 500, 800, 1250, 2000): what are the **accept** and **reject**
> numbers, and **is there an arrow** on that cell?

**The arrows are the whole point.** In ISO 2859-1 an arrow on a cell means *this
plan does not apply — use the sample size the arrow points to instead*, which
changes both the sample size and the accept number. **Our table has no arrow
handling at all.** It is a flat lookup. That is the specific defect to check for,
and it is the one most likely to be wrong.

**I cannot check this for you.** I do not have the standard in front of me and I
will not reconstruct the numbers from memory — inventing an accept number is
exactly the failure this control exists to prevent. It needs a copy of ISO 2859-1
and an hour of the QCM's time.

### How to ask without it landing as blame

It was not his error. The table was seeded from a best reading and **shipped
carrying its own warning**, which is the honest way to ship something unverified.
He is being asked to close it, not to explain it.

**Only set the flag once he has confirmed in writing** — an email is enough. Then
the report stops apologising, and it has earned the right to.

> **Also worth knowing:** lot QA carries **no sample plan and no record checks at
> all** — those exist only on pack inspection and pre-shipment QA. The earliest
> gate is the thinnest one. Not urgent, but it is a gap, not a design.

---

### 1A.3 · Real names — **this is the one that can do harm. Do not do it as written.**

**I gave you bad advice yesterday.** The checklist says put a real name on each
of the eight logins. **Do not do that where a login is shared.**

The logins are named after jobs — `qa`, `lab`, `plant`. If **two inspectors share
`qa`** and you set the name to *"Asif Mehmood"*, then every inspection either of
them performs prints **Asif's name**. Every certificate. Every report that goes
to a customer.

Today the certificate prints *"no individual name on file — signed on the shared
'lab' login."* That is ugly, and it is **honest**. It says: a person did this and
we cannot tell you which one.

Replacing it with one person's name does not fix the problem. **It converts a
visible gap into an invisible false attribution** — a name on a QA document
belonging to someone who was not there. That is worse in an audit, not better,
and it is worse for the person whose name it is.

### So, the rule

| Login | Set a real name? |
|---|---|
| Used by **exactly one person**, and will stay that way | **Yes** — set it today |
| Used by **two or more people**, now or in future | **No.** Leave it. The blank is the truth |

**Confirm who actually uses each login before you type anything.** Ask; do not
assume from the role name. `tahir` is safe — it is already one person.

**The real fix is one login per person**, and that is `MODULE: PLATFORM` work —
`auth_users`, `user_module_roles` — needing its own declared session. Until then
a blank line on a certificate is the correct output, not a defect to be cleared.

---

### 1A.4 · The stale `datafix` grant — safe, two minutes

`screenDataFix()` hard-checks `state.role === 'COO'`. The Production grant does
nothing today and removing it takes nothing away from anyone. **No announcement
needed and nobody will notice.**

Do it because the day someone refactors that check to use the access matrix, the
grant becomes real, and nobody will remember it is there.

Users & Access → Production → clear `datafix`.

---

### The order to do them in

1. **Send the brief** — everything else is safer once people have read it
2. **The datafix grant** — two minutes, zero risk, get it off the list
3. **Names, but only on single-person logins** — after asking who shares what
4. **Five POs**, watch for a day
5. **The QCM's hour on the AQL table** — start the ask now, it runs in parallel
6. **The remaining POs**, outside shift hours

Nothing on this list needs to happen today except the brief.

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

**Tomorrow, in this order:** send the brief · clear the datafix grant · ask who
shares which login before touching a single name · answer **five** POs and watch
for a day · start the QCM on the AQL table.

The 44 in one sitting is the thing not to do. §1A.1 says why.

---

*Assembled 22 August 2026. Module: O2S. §0 and §1A correct earlier advice.*
