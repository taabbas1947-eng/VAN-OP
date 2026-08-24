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

---

## Observation from the production floor — 22 August, Tahir

*Dropped in passing, not to be solved now. Checked against the 16 July snapshot
so the note is accurate; the live system may differ and the counts should be
re-taken there.*

### "Some batches do not have a floor ID"

**In the snapshot: 1 of 83.** It is a **by-product pool**, not a batch.

When a batch is reconciled and some of what came out is by-product, that material
does not become its own batch. It accrues into an open pool for that base
product, and the pool sits there with no batch number, nothing produced and
nothing packed, until somebody calls it for manufacturing — at which point it
becomes a real batch and gets a number.

So the missing number is deliberate. **The problem is that a pool looks like a
batch on the floor.** Somebody reading a list sees a nameless row and reasonably
concludes the system lost a batch number. The fix is not to give pools numbers —
it is to stop them appearing as though they were batches, or to label them as
pools where they do appear.

If the live system shows more than one or two of these, that is a different
finding and worth looking at properly.

### "Some batches do not have a PO or client number"

**70 of 83.** Tahir's guess is right, and the reason is simpler than a fault.

| | |
|---|---|
| Made against a customer order (`kind: po`) | **13** — all 13 carry a PO |
| Made to stock (`kind: bulk`) | **70** — none carry a PO, and none should |

A stock batch has no customer because nobody has bought it yet. It is produced
against the base product and drawn down later when an order arrives. Blank is the
truth there, not a gap.

**On "shouldn't we name an ID to a base batch"** — they already have one. Every
one of the 70 has a batch number. What they do not have is an *owner*.

The real gap is on the floor: a person looking at a batch cannot easily tell
"this one is against VITAL AGRI's order" from "this one is stock". The
distinction exists in the data and may not be visible on screen. That is worth
fixing, and it is a labelling job, not a numbering one.

**To decide when this is picked up:** should a stock batch show something in the
client column — "Stock", or the base product name — rather than blank? Blank
reads as missing data; "Stock" reads as an answer.

---

## Batch close and reopen — built, reviewed, refused (22 August)

Both were built as agreed and both were refused by review. **Nothing reached the
app.** The detail is worth keeping because the fixes are specific.

### The one that matters

**The Reopen button cannot appear for any batch the bulk close closes.** It is
the exact case the whole thing was built for.

Reaching it means clicking a batch on the Production desk to open its detail
view. A batch only becomes clickable there if it still has material to pack or
account for. A batch closed by the bulk button has neither — that is the
definition of being on the list. So it drops off every clickable screen the
moment it is closed.

Measured: **3 of the 35 closed batches can show the button today**, and all three
still have unpacked stock. None of the 16 the bulk button would close could ever
show it.

That is the third time in one day that something was built onto a screen that
does not render it, and the third time my own test checked for the button by
searching the file's text rather than by checking it appears.

### Closing while somebody is logging output

With the close list open the app stops refreshing. If a shift incharge logs
250 Kg during that time, the close still records the older figure: **batch closed
at 5,000 of 5,000, on plan, no variance** — while it actually produced 5,250. The
extra 250 Kg becomes stranded on a closed batch that will not accept more output,
and the only ways out are to write it off as loss or find the Plant Manager.
Nobody is told.

### The reopen loop

A reopened batch goes straight back into the close list, ticked by default, with
nothing on the row saying it was reopened. Its "days open" is measured from when
the batch was first opened, so a batch reopened this morning shows as the oldest
on the list and reads as "close this one first". The reason the Plant Manager
wrote survives only in the corrections register.

### The promise that is mostly not true

The reopen dialog says it will "let shift output be added again". Output is
capped at 105% of plan, and **all 35 closed batches sit at exactly 100%** — so
the most that can ever be added is 5%, about 350 Kg on a 7,000 Kg batch. For a PO
batch whose order is fully produced it is blocked outright, which is **6 of the
16**. The dialog should work out the headroom, show it, and refuse when it is zero.

### Also

- The PO tracker still reads **Produced** after a reopen — the production-complete
  date on the order line is set by the close and never cleared
- Unticking a row rebuilds the whole list and throws you back to the top, which
  with 26 rows means people stop reviewing and just close everything — the exact
  behaviour the change was meant to end
- The reopen is filed in the register as an **AMEND on a batch**, which the
  Plant Manager is not allowed to do. Anyone filtering the register will see rows
  that contradict the authority table
- Entries in the batch's close history carry no id, so if two people reopen the
  same batch one of the two records is silently dropped. One word fixes it

### What the reviewers confirmed is right

The banner reaches a real screen. The generated screens are well formed. Everything
written survives being saved. Reopening then closing again keeps the history in
order. And reopening cannot damage anything QA, packing or the customer holds —
new material lands in a new lot with no certificate, and uncertified material
cannot be packed or shipped, so a signed certificate can never be changed after
the fact by reopening.

---

## 22 August, afternoon — the printing slip, and a save bug found underneath it

### The decision on record

**Option A, the hard gate.** No QA signature, no printed bags. The Plant Manager
is the second signature and his job is to **resolve a delay** — not to be a
routine alternative signer. When he signs, the record says he signed and that QA
was late.

**The price list is parked, deliberately.** Same brand, different price by
customer, by region, by channel. Building that table badly is worse than not
having it.

Design on record: https://claude.ai/code/artifact/50c95c3d-9031-45d6-a441-e7014108a5c2

### The review sent it back

Two reviewers — workflow, and data safety. Neither disagreed with the idea.
Three things stop it being built as written:

1. **The gate has nowhere to stand.** "Supply Chain cannot issue printed bags
   against an unsigned slip" assumes the system knows when bags are issued. It
   does not. Zero references to a printing request anywhere in the app; no
   bag-issue step at all. The only place a printed price is committed is the
   packing screen, which is Production's. A real gate stops the packer, not
   Supply Chain — a different sentence about a different person.
2. **Most batches have no customer.** 36 of 48 open batches are stock batches:
   no PO, no customer, brand often not chosen until packing. Under a
   customer/region/channel price, every field that decides the number is blank.
3. **Two people signing at once produces a signature nobody gave.** Measured on
   the real merge: QA types 1,500 without signing, the Plant Manager signs at
   1,450 — the record says the Plant Manager approved 1,500.

Also found, true today with or without the slip: Zain's role string is "Supply
Chain Officer", which is not one of the ten seeded roles, so any rule written
for "Supply Chain" misses him. The Plant Manager has view-only on the QA screen.
The printed price on a packed lot has no lock and can be changed after shipment.
The stale `qc {e:true}` grant on Supply Chain Officer from 30 July is still live.

### The buildable order of work

1. Answer the print-on-pack backlog — the slip's key line is blank without it
2. Scope the slip to PO batches only; stock batches out until the price table
3. Put the gate at packing, and agree out loud that it stops Production
4. Lock the signature against merging; lock the printed price once bags exist
5. Fix the role strings and the Plant Manager's access; clear the July grants
6. Set the wait threshold in hours, and count Plant Manager resolutions

### Fixed today — a live defect, nothing to do with the slip

**The first change anyone makes after opening the app could be silently thrown
away.** `_baseSnapshot` was never set at boot, so on the first save that hit a
conflict the merge ran with base === local, every field looked unchanged, and
the server's value won. Adding a record was safe; **editing** an existing one was
not. No error — the toast said it synced.

Three fixes, all reviewed before going in:

- `bootState()` now pins the baseline after the state loads
- `doLogin()` does the same — most sessions start at the login screen, not a
  refresh, and after a token expires mid-shift the old baseline was still live
- the PO Tracker audit writer now mints an `id`, so `state.audit` stays on the
  id-matching path. Without it, one edit dropped the array to the leaf rule and
  a conflicting save **deleted the other person's audit rows**

`o2s/tests/firstsave.test.js` — 15 new checks, measured against the real
`merge3` pulled out of the shipping file. Suite is now 282.

### Still open on the save path — NOT fixed, needs its own design

`_savePending` is only cleared inside `if(r.ok)`. A network blip, a 500, or a
sixth conflict leaves it true forever, and the background sync returns early on
it — so that tab stops receiving the team's changes for the rest of the day,
silently. The obvious fix makes a third bug: clearing the flag lets the sync run
and pin the baseline to a local change the server never received, which is
exactly the 30 July gate-pass revert. Needs designing, not patching.

---

## 22 August, evening — the slip: stage settled, second refusal

### The COO's answers

- Printing supervisor is a **separate person, outside the system**, no login
- Zain's job is Supply Chain (the system carries him under a second role string)
- **Production raises the price request for a batch from their plan to pack the
  next day**
- COO's proposal: generate the slip as a **PDF** — QA sees it in the system, the
  identical document goes to the printer outside, so a discrepancy can be
  settled by comparing the two sheets
- Do not stop the line. Do not add process.

### The stage — answered

**The packing plan.** Order entry is too early (no batch, no bags, no dates),
batch open is too early (a stock batch has no brand, PO or customer), packing
entry is too late (bags already printed).

**And this is what dissolves the "no customer" problem.** `doPack` already
refuses anything not against a PO — *"no unassigned packing"*. So a **pack**
always has a customer even when the **batch** does not. Raise the slip at the
packing plan and customer / channel / region are present by construction. No
price table needed.

### I was wrong about the Gate Pass precedent

I told the COO the PDF idea had a working precedent — that `printGatePass`
refuses to produce a document until released. **It does not.** It writes the
full sheet into the new tab and *then* toasts "not yet released". The only
difference for an unreleased pass is that `window.print()` is not auto-called.

The real Gate Pass control is `approveRelease`: four state gates before
`l.dispatched` moves. The paper is a receipt for a decision enforced in the data.

**So "no signature, no PDF" is not a gate.** The enforcement has to be at the
moment a pack is *recorded* — `doPack`, `submitProdQty` and `submitDivert`. Be
honest about what that buys: it does not stop a bag being printed (printing is
outside the system), it stops unslipped bags becoming sellable stock, caught the
same day rather than at inspection.

### One slip per pack was the wrong size — measured

- `packingLog`: 102 rows over 14 packing days. **7.3/day average, 21 on 20 June**
- 44 (date, brand) groups; **8 span more than one PO** — same bag, several
  customers. On 20 June Tornado was packed 4×(4, 17, 25, 12 Kg) for 4 customers
  from one batch
- **7 base batches were packed into more than one brand** (HG26018 → Enrich +
  Humi Cash, AM26003 → Tornado + Max Amino same day, VU26142 → Naya S Urea +
  Vital Urea). The brand is a changeover decision at the filler, not a plan
- **20 of 102 packing runs happened on or before the day the batch's COA was
  approved**, 6 of them before it — so for those there was no evening beforehand

**One slip per print run**: one brand, one brand batch number, one printing
order, drawn down by however many packs across however many POs and days. This
also answers the left-over-bags question.

### Found while checking — a 0.1 price on 23 packing runs

`packPriceGate` demands `+form.price > 0` and offers no "this bag carries no
price" option, so operators type **0.1**. 23 of 102 rows, nine dates, all
`priceVerifiedBy: "Production"`, **`noPrintPack` false on every one** — so the
system believes 0.1 PKR was printed.

- **21 of 23 are White Label / Cobo / Vgreen** (Maxim Agri 22032/22033/21630/
  21775, United Distributor 260400001, COBO-2606-2537, VG-VC-2606-6451) where the
  bag almost certainly carries no VAN MRP. A workaround, not a wrong price.
- **2 are on a Dealer order** — Humi Grow and V-Zinc on DLR-2606-0001, Kissan
  Zarai Merkaz. A printed MRP normally applies there. **Needs a human to check
  what was physically on those bags.**
- `printPolicyOL` also returns "MRP 1 /pack" or "MRP 0.1 /pack" on 6 of 71 lines.

Fix: answer print-on-pack, and give the packing screen a real "no price" option.

### Blockers, in build order

1. Answer the print-on-pack backlog — no code, unblocks everything
2. Real "no price on this bag" option at packing
3. Plant Manager access to the QA screen (`accessMatrix['Plant Manager'].qa` is
   absent → view only, so his delay-resolution path is unreachable); fold
   "Supply Chain Officer" into "Supply Chain"
4. Build the slip — one per print run
5. The check at the packing screen; close the Data Fix side door
   (`dfSubmitPacking` writes a packing row with no price, no batch, no dates, no
   lab check, no future-date guard — and Data Fix is ON); guard `allocateStock`
   (marks a line packed with no lot behind it, no role check)
6. Wait threshold in hours + a count of Plant Manager releases

### Still with the COO

- **Refuse or flag** at the packing screen when there is no signed slip
- Can a slip be raised against a batch the lab has not cleared?
- Who signs when the QA inspector is off (one person, active 13 of 24 days)
- The two Dealer bags at 0.1

### Also confirmed dead / wrong, do not build into these

- `screenProd` returns at its first `innerHTML`; everything below is marked
  *"Legacy floor code below is unreachable"* — including the packed-stock card
  and an `openProdQty` button. Live routes are `prodStageList()` and
  `_pcLifeAction`
- `screenQC` computes a `qaRows` table it never renders; `openLotQA` has no live
  caller. The QA slip queue belongs in `screenQA`'s own `innerHTML`, outside the
  tab switch
- `actTiming` clamps `days<0` to 0, so a slip due tomorrow sorts to the BOTTOM of
  My Actions as "0d waiting, Normal". Urgency has to count down, not up
- `submitProdQty` never calls `evDateGate`; `dfSubmitPacking`'s date input has no
  `max`. The "no future dates" rule is not universal today

### COO's two answers, 22 Aug evening — the design is now locked

1. **The packing screen REFUSES.** No signed slip, no packing entry. Not a
   warning, not a reason box.
2. **The lab does not hold the slip up.** A slip may be raised for a batch the
   lab has not cleared, and QA may sign it whenever. `doPack` already refuses to
   pack an uncleared batch, so the two controls stack.

Consequences, both accepted knowingly:

- **The side doors close in the same piece of work, not later.** A refusal at
  `doPack`/`submitProdQty`/`submitDivert` while `dfSubmitPacking` still writes a
  packing row with no price, no batch, no dates and no lab check is not a
  control. Same for `allocateStock`, which marks a line packed with no lot behind
  it and no role check.
- **The slip is no longer an evening-before ritual.** It can be raised and signed
  minutes before packing, which is what keeps the line moving. The day of
  thinking time the CFO wanted becomes a habit, not a rule.
- **Risk carried:** bags can be printed with a batch number and dates for
  material the lab later fails. Scrap cost, accepted.

### 22 Aug, late — two more answers from the COO

1. **The Dealer bags were correct.** The real dealer list price was printed on
   PK1550 (V-Zinc) and PK1551 (Humi Grow), DLR-2606-0001. So the bag that went
   out is right and the O2S record is wrong — a record correction, not a product
   problem. Needs the actual number to correct `printedPrice` through the ledger.
2. **The Plant Manager signs when QA is on leave**, as well as when QA is
   delayed. One rule: when QA cannot sign, the Plant Manager signs, recorded as
   who signed and why (late / on leave).

### The 0.1 fix needs NO CODE — verified

`packPriceGate`:

```js
if(pol.mode==='noprint') return form.noPrice ? null : 'Confirm that no price is printed on this pack.';
if(!(+form.price>0))     return 'Enter the price that is printed on the pack.';
```

The "no price on this pack" path **already exists and works**. It only opens
when `printPolicyOL` returns `noprint`, which needs `o.printDecision==='no'` (or
`printOnPack===false` with no brand history). `printDecision` is null on all 21
orders and `printOnPack` is undefined on 19, so the option never appears — the
operator is asked for a number they do not have and types 0.1.

**Answer print-on-pack and the workaround stops by itself.** No build.

**All 23 rows sit on just 8 POs**: 22032 (10), 22033 (6), DLR-2606-0001 (2),
21630, 21775, 260400001, COBO-2606-2537, VG-VC-2606-6451 (1 each). Full worklist
with record ids: `docs/o2s/PRICE-0.1-WORKLIST.md`.

Still to confirm: what was physically printed on the 21 White Label / Cobo /
Vgreen bags. If the answer is "no VAN price on white label", one answer corrects
all 21.

### 22 Aug, late — Maxim answered, and a FOURTH price case discovered

**Maxim Agri: no price on their bags.** POs 22032, 22033, 21630, 21775 can be
answered "no price printed" today — **18 of the 23 rows settled**, no code.
Side effect to expect and not be alarmed by: `mrpCheckHtml` inverts for a
no-print PO, so those 18 historic 0.1 rows will immediately show
*"but the lot was packed at PKR 0.1 /pack — CHECK THE BAG"*. That is the system
correctly listing the rows that need correcting.

**UDPL send bags with the price ALREADY PRINTED — VAN has no action on price.**
This is a case `printDecision` cannot express. All three existing answers
misinform the inspector; the worst is "no price", because `qcExpect` then says
*"no price should appear on this pack"* and every UDPL lot raises a false
failure on a correct bag. A warning that is wrong every time is one people learn
to click past.

**DO NOT ANSWER PO 260400001** until a fourth option exists.

Proposed fourth `printDecision` value — **`supplied`** (bags supplied pre-printed
by the customer):
- packing: no price asked for, as per no-print
- record: `priceSource:'customer'`, `printedPrice:null`, **not** `noPrintPack`
  (a price exists, it is simply not ours)
- inspection: "the customer supplies these bags printed — check the bag matches
  what they sent, do not check against a VAN price"
- **printing slip: none at all.** VAN is not printing these bags. This is the
  first case where the right answer is that no slip exists, and the slip design
  had no branch for it.

**The question that sizes it.** White Label is six customers, not one:
Syngenta 58 packing rows / 348,020 Kg, Maxim 18 / 77,355, Rudolf 3 / 50,560,
UDPL 1 / 8,000, plus LCI and Arysta (ordered, not yet packed). **Syngenta alone
is 57% of all packing on record.** If Syngenta, LCI, Rudolf and Arysta also
supply their own printed bags, `supplied` is not an edge case — it is how most of
the volume works, and it goes ahead of everything else on the price side.

Full detail and the row-by-row status: `docs/o2s/PRICE-0.1-WORKLIST.md`.

### 22 Aug — the price picture is now complete, and it found 128 tonnes

COO's answers: **Syngenta, LCI, Rudolf and Arysta — VAN prints the price; the
customer supplies it on the PO or later by email.** **Cobo and Vgreen bags do
carry a price.** So UDPL is the ONLY pre-printed-bag account — the `supplied`
option is one PO, not the main road.

**Four ways a price reaches a bag:**

1. Maxim Agri — no price at all. VAN prints. → `printDecision='no'` (exists)
2. Syngenta / LCI / Rudolf / Arysta — customer sets it (PO or email), VAN prints.
   → `'yes'` + price, but **nothing records the email**
3. UDPL — customer sets it AND prints it. → **no option fits**; needs `supplied`
4. Cobo / Vgreen / Dealer / Farmer / Distributor — VAN sets it, VAN prints

**Of 102 packing runs:**

| | Rows | Kg |
|---|---|---|
| price matches the order line | 53 | 285,754 |
| **price exists ONLY on the packing row** | **24** | **128,293** |
| 0.1 placeholder | 23 | 87,691 |
| printed price differs from the order line | 2 | 122 |

The 128,293 Kg, largest first: Syngenta Enrich 68,195 @ 4,500 (line 0);
Rudolf Orbit-K 37,500 @ 23,750 (line 0); Rudolf Basic 13,060 @ 13,750 (line 0);
Cobo Vital Potash 7,000 @ 10,500; Cobo V-Mg Essential 1,500 @ 1,350; Kissan
V-Mg Essential 585 @ 1,350; BKK Vibrant 400 @ 6,000; plus four small rows.

The numbers look right — read off an email and typed in. **But that typing is
the whole record.** No PO line, no email reference, no approval, no name beyond
"Production". This is the CFO's concern as a measurement, and the strongest
argument the slip has: its "taken from" line is exactly what is missing.

The 2 mismatches are both Vgreen placeholders (line=1, printed 1,250 and 795 —
the correct VAN prices). Bags right, orders wrong.

### The price list may be far smaller than feared — needs the COO's answer

**Every VAN own-brand shows ONE printed MRP across every channel it sold
through.** No brand shows two:

VL-NPK 1,250 (Farmer/Vgreen/Dealer/Cobo) · V-Mg Essential 1,350
(Dealer/Cobo/Farmer) · Tornado 795 (Dealer/Vgreen/Cobo) · V-Transfarm 1,875 ·
Vital Potash 10,500 · Fusion Potash 13,000 · Vital Urea 6,500 · Vibrant 6,000

The COO parked the price list because price differs customer-, region- and
channel-wise. That describes a **trade/invoice price**, not the **MRP on the
bag**. O2S already separates them: `invoicePrice` (CFO/COO only) vs
`printPrice`. **If the printed MRP is one number per brand, the list needed for
printing is an afternoon's work, not a project** — and the parked blocker
disappears.

Eight brands in a July snapshot is suggestive, not proof. **Ask the COO.**

Full analysis: `docs/o2s/PRICE-INTEGRITY.md`.

### 22 Aug — COO corrected the MRP hypothesis, and settled the design

**I was wrong.** I suggested the printed MRP might be one number per brand
(every VAN own-brand showed a single price across channels in the July
snapshot). **The COO: the printed MRP can vary.** Eight brands over five weeks
was a coincidence of the sample. The price list stays parked as a careful piece
of work, and nothing in the slip design may assume one lookupable number.

**Dealer numbers received** — DLR-2606-0001, both currently 0.1:
- PK1551 Humi Grow, 136 Kg → **3,100**
- PK1550 V-Zinc, 200 Kg → **4,800**

**The decisive answer:** *"Syngenta and Rudolf orders are large POs and price
can change in mid of the PO."*

This **withdraws my recommendation** to put the proven prices on the order lines
for the big accounts. `l.printPrice` holds ONE number for the whole line. Writing
4,500 on the Syngenta Enrich line claims all 271,504 Kg carries 4,500; if the
price moves at 150,000 Kg the line is wrong about everything after, and
correcting it makes it wrong about everything before. **One field cannot hold a
price that changes over time.**

Exposure now:

| PO | Customer | Runs | Packed | Still to pack |
|----|----------|------|--------|---------------|
| 6595010464 | Syngenta | 48 over 11 days | 279,825 Kg | 170,175 Kg |
| 6595010236 | Syngenta | 10 over 4 days | 68,195 Kg | 203,309 Kg |
| 1821412156 | Rudolf | 3 | 50,560 Kg | 86,880 Kg |

Measured: **0 of 41 (PO, brand) combos carry more than one printed price** — it
has not bitten yet. But 460 tonnes remain to pack on those three, over weeks.
(Caveat: no packing row in this snapshot carries a `lid` — `_lotLidMigV1` is
absent, so `migratePackingLotLidV1` had not run. Rows matched by PO + brand,
which is how that migration matches them too.)

### What it settles

**The price belongs to the print run, not the order line.** Exactly the shape
already chosen for a different reason — one slip per print run. A mid-PO price
change is then just the next slip carrying a different number: nothing to
correct, no contradiction, history intact.

**Code consequence:** `printPolicyOL(o,l)` takes only an order and a line and
cannot express "4,500 until 20 June, 4,800 after". If the slip is the price
authority it must consult the slip covering the run. Same gap a reviewer flagged
("printPolicyOL cannot select among several slips") — now with a business reason.

### Revised recommendation — split by PO size

- **Short POs** (Cobo, Vgreen, dealers, BKK): price on the order line. Clean.
- **Large POs** (Syngenta, Rudolf): put today's price on the line too, knowing it
  is the CURRENT price and needs a manual update whenever a new one arrives by
  email. Still far better than 0, which tells the inspector nothing.
- **Correct the packing rows** through the ledger either way; the rows already
  hold the right numbers for runs that have happened.

### New open question for the COO

Once the slip exists, should the order line's price be **advisory** with the slip
as the authority? That is the cleanest answer to a moving price, and it is a
business call.

### 22 Aug — the authority rule (COO). This changes who fills the slip in.

> *"KAM number is suggestive and advisory, the list [too]. But once Production
> has issued the printing slip, and if they have updated the price, the price
> Production updated is authority and can't change."*

| Source | Standing |
|--------|----------|
| KAM's price on the PO | Advisory |
| The price list | Advisory |
| **Price Production puts on the issued slip** | **Authority. Frozen.** |

**This reverses something I had backwards.** My design had QA *supplying* the
MRP. The CFO never asked for that — his words were that the slip already states
the MRP and QA should be involved *"for MRP validation"*.

So: **Production enters the price** (they hold the PO and the customer email),
**QA validates and signs**. QA's load drops sharply — checking one number against
a source, not hunting for it — and it matches what already happens.

**"Can't change" has to be BUILT, not just stated.** `printedPrice` on a packed
lot has no lock today; Production can amend it after QA clearance and after
shipment. Four things make the rule real:

1. Slip price locks on issue — same `lockedIf` pattern as `brandBatchNo`/`mfgDate`
2. Wrong price = a NEW slip, not an edit → `CORRECT_ENTITY` supersede-only, like
   `coa` and `inspection`, blocked once bags are printed
3. `printedPrice` on the packing lot locks once a slip covers it
4. `printPolicyOL` must prefer the slip over the line; `mrpTag`/`qcExpect` must
   say "from the issued slip", not "from the PO"

**Tension to watch, not to solve:** Production now both sets the price AND is the
party the packing gate refuses. QA's signature is the only independent check —
and the Plant Manager fallback (QA late or on leave) is where that check can
quietly disappear. Watch the count of PM signatures.

### The 1 July email — the dates do not fit, and that IS the argument

Asked where the Syngenta/Rudolf prices came from, the COO answered **1 July**.

| PO | Brand | Price | Packed | Kg |
|----|-------|-------|--------|-----|
| 6595010236 | Enrich | 4,500 | 13–22 Jun | 68,195 |
| 1821412156 | Orbit-K | 23,750 | 18–20 Jun | 37,500 |
| 1821412156 | Basic | 13,750 | 7 Jun | 13,060 |

All **118,755 Kg** was packed BEFORE that email existed (Basic 3½ weeks before).
Either an earlier email/call set them and 1 July was the latest in the thread, or
they were agreed verbally and confirmed after.

**The record cannot tell us.** A senior person reconstructing from memory five
weeks later against a system that kept no trace is exactly the failure the slip
removes. Not a criticism — the best demonstration yet of why "taken from"
matters.

### New open question

**Who wins when Production and QA disagree on the number?** The slip now carries
Production's price and QA's signature. If QA will not sign what Production
entered, the design has no route out of that yet.

### 22 Aug — deadlock route: Plant Manager, via the Action Center (COO)

Right answer, and for a reason worth knowing: **it routes around the access
blocker.** `accessMatrix['Plant Manager']` has no `qa` key → view-only on the QA
screen, which has been blocking his whole fallback role. But `SCREENS`
`approvals` ("My Actions") lists Plant Manager among its owners AND he carries
`approvals:{v:true,e:true}`. Full rights there already.

**So put ALL THREE Plant Manager cases in the Action Center:**

| Case | What happened | Kind |
|------|---------------|------|
| Late | QA has not signed, run is due | Cover |
| Absent | QA on leave | Cover |
| **Overruled** | **QA refused to sign Production's price** | **A decision** |

His QA-screen access then drops from blocker to tidy-up.

**Record the three separately and count the third.** The first two are cover; the
third is an independent check raised and set aside. Never collapse them into one
"Plant Manager signed" line — the third is what an auditor asks about, and it
needs its own figure in the report.

**Precedent to copy: Fahim's own.** The 21 Aug truck-pipeline work exists because
he reported *"gate pass approval is assigned to Plant Manager but it does not
appear in my actions"*. Same failure shape, already fixed once.

A new action label must be registered in **four** tables or it renders wrong and
escalates to nobody: `ACT_EMOJI` (else a bare bullet), `acTypeColor` (else grey),
`acStageOf` (else files under "Production"), `acEscalation.TH` (else **never
escalates**). Set `role:'Plant Manager'` directly rather than relying on
escalation — a blocked print run needs deciding today. Escalate on to COO after
1 day, matching `Release` / `Approve DC`.

### New gap found: the Action Center cannot say "blocking now"

`actUrg` is purely age-based: `overdue→0 · 7d→1 · 3d or hot→2 · else→3`. So a
price dispute raised this morning holding a print run scores **3 — bottom of the
list**, below a five-day-old inspection. `actTiming` also clamps negative days to
0, so a slip due tomorrow sorts bottom too.

**It measures how long something has waited, not how soon it is needed.** Right
for everything it handles today; wrong for a slip. Must be fixed in the same
piece of work or the dispute item is invisible on the screen it was built for.

### Practical

- **The print-on-pack backlog is already in the COO's own Action Center** — a
  `Print price` item (KAM-owned, escalates to COO after 3 days; `acBase()` gives
  the COO every item regardless of owner), with a button that opens
  `openBulkPrintDecision()`. No PO hunting.
- **Syngenta Enrich confirmed still at 4,500** — the line can be set now, closing
  68,195 Kg of unrecorded pricing. Rudolf Orbit-K 23,750 and Basic 13,750 are
  NOT confirmed current.

### Remaining open with the COO

- How many hours is "late" before Fahim can sign for QA?
- Are the Rudolf prices still current?
- Can Production find the 1 July email?

### 22 Aug — "1 working day" (COO). Two blockers before it can be built.

**1. The app has NO concept of a working day.** Zero references to weekend,
holiday, working day or `getDay()` anywhere in `o2s.html`. `evThreshold` and
`acEscalation.TH` both count plain calendar days. So "1 working day" must either
be built from scratch or redefined as 1 calendar day.

**Shortcut question: is Sunday a working day at VAN?** The record says the plant
is not closed — production entries on Sundays, some packing, some dispatch, and
the COO is one of the heaviest Sunday users in the log. **If Sunday counts, 1
working day = 1 calendar day and no calendar needs building.**

**2. A full working day lands the fallback AFTER the run it protects.**

> Slip raised Thu 4pm for Friday's 6am run. One working day later = Fri 4pm. The
> run was at 6am. Fahim can step in ten hours after the bags were needed.

The clock starts when the slip is *raised*; what it protects is when the bags are
*needed*, and those are a day apart by design.

**Suggested wording, same intent, lands in time:**
> *If the slip is still unsigned at the end of the working day it was raised, the
> Plant Manager can sign it.*

QA gets the whole day; recovery happens the evening before, not the morning after.

### Saturday: the fallback is thinnest where the gate bites hardest

`actionLog` by weekday, 15 Jun – 16 Jul:

| Role | Sun | Mon | Tue | Wed | Thu | Fri | Sat |
|------|-----|-----|-----|-----|-----|-----|-----|
| QA Inspector | 2 | 4 | 3 | 14 | 5 | **1** | **23** |
| Plant Manager | **0** | **0** | 3 | 13 | 5 | 6 | **0** |
| Production | 2 | 23 | 39 | 35 | 52 | 33 | 31 |
| QCM | 0 | 18 | 21 | 14 | 15 | 20 | 6 |
| COO | 34 | 43 | 23 | 21 | 16 | 13 | 6 |

**Saturday is the busiest packing day (29 rows, ahead of Thu 26, Wed 20)** and
QA's busiest day by far — while the Plant Manager logged nothing on any Saturday
or Sunday on record.

**If QA is away on a Saturday, the designated fallback has historically not been
in the system that day.**

**CAVEAT — the sample is thin and this is a flag, not an accusation.** 24
distinct dates: only 3 Saturdays, 3 Fridays, 2 Sundays. The action log records
what someone did *in the app*, not whether they were at work. Check with the
people concerned.

If it holds, Saturday needs a named answer before the gate goes live, and each
obvious candidate has a problem: Majid sets the price so cannot approve it; QCM's
Saturday presence is light (6); the COO's is lighter (6).

### Open with the COO

1. Is Sunday a working day? (decides whether a calendar gets built)
2. Clock from slip-raised, or to bags-needed? (recommend the latter wording above)
3. Who covers Saturday when QA is away?
4. Rudolf Orbit-K 23,750 and Basic 13,750 — still current?
5. Can Production find the 1 July email?

### 22 Aug — the last four answers. Threshold settled, fix sheet issued.

**Sunday IS a working day** → *1 working day = 1 calendar day*. **No calendar
needs building.** The threshold is a plain day count, which every existing
threshold in the app already is.

**Plant Manager covers Saturday when QA is away.** Answered. Worth telling Fahim
explicitly, because the design now depends on him being reachable on the busiest
packing day of the week and he logged nothing in the app on any Saturday in the
record.

**Rudolf Orbit-K 23,750 and Basic 13,750 are current.** With Enrich at 4,500,
the three biggest orphaned prices are confirmed — 118,755 Kg.

**The 1 July email: dropped. Record "Tahir (COO)" as the reference instead.**
That is a legitimate source — the COO is the authority — and it means the 118
tonnes stops being unsourced. Use it as the "taken from" on every correction.

**Still worth taking:** measure the wait to when the **bags are needed**, not
from when the slip was raised. Thursday-afternoon slip for Friday's early run
would otherwise only become releasable Friday afternoon, after the run.
*"Unsigned at the end of the day it was raised"* gives QA the whole day and puts
the recovery the evening before.

### `docs/o2s/PRICE-FIX-SHEET.md` — the whole backlog, no code required

- **Part A — 14 order-line prices, closing 128,415 Kg.** Every number proven by
  what was actually packed. Enrich 4,500 / Orbit-K 23,750 / Basic 13,750 /
  Vital Potash 10,500 / V-Mg Essential 1,350 / Vibrant 6,000 / VL-NPK 1,250 /
  Tornado 795.
- **Part B — print-on-pack for all 21 orders.** 5 Maxim POs = no price
  (22032, 22033, 21630, 21301, 21775); 11 = yes with a price; 1 HOLD (UDPL
  260400001); **4 need a decision** — 4204003607 LCI Authority, 4204003087 LCI
  Ferti Rise, 7500003652 Arysta Fruitlish, VG-2605-0002 Vgreen. Nothing is packed
  against those four, so there is no bag to read the answer off.
- **Part C — the 23 placeholder rows.** 18 Maxim → no price; PK1551 Humi Grow →
  3,100; PK1550 V-Zinc → 4,800; PK1366 UDPL blocked; **2 still need a number** —
  PK1390 Vgreen V-Mg Essential (very likely 1,350, five other rows agree, but
  printed MRP can vary so confirm) and PK1313 Cobo V-Ammonium Phosphate (**no
  evidence anywhere** — only packing row that brand has, no order line priced).

After this sheet: 2 numbers, 4 decisions, 1 PO waiting on code. The rest of the
price backlog closes.

### 22 Aug, end of day — four answers. Design closed, build order set.

| Question | Answer |
|----------|--------|
| Vgreen V-Mg Essential PK1390 | **1,350** confirmed |
| The four POs with nothing packed | **Leave unanswered** until something is packed |
| Plant Manager threshold | **End of the working day the slip was raised** |
| Build first | **The Action Center urgency fix** |

**One number still unknown in the whole price backlog:** PK1313 — Cobo,
V-Ammonium Phosphate, 1,500 Kg, 17 June. Only packing row that brand has ever
had; no order line prices it. Nothing to infer from. Needs a person.

**Final threshold wording:**
> If the printing slip is still unsigned at the end of the working day it was
> raised, the Plant Manager can sign it.

Sunday is a working day, so this is a plain day boundary — no calendar to build.
The Plant Manager's three cases (late / absent / **overruled**) stay separate in
the record; only the third is a control being set aside and it gets its own count.

**Build order:**

1. **Action Center urgency fix** — `actUrg` scores purely on how long something
   has waited, and `actTiming` clamps a future date to 0 days. So a slip due
   tomorrow and a dispute raised this morning both sort BELOW a five-day-old
   inspection. Build the slip first and nobody sees it in time. Also improves the
   screen the team already uses daily, so the value is not conditional on the
   slip landing.
2. `supplied` option → unblocks UDPL 260400001
3. The slip itself
4. The refusal at packing + Data Fix door closed in the same pass

Reviewers before code on every one of them, per the standing rule.

### 22 Aug — last number in. Price backlog fully specified.

**Cobo V-Ammonium Phosphate = 6,700.** The one row with nothing to infer from
(only packing row that brand ever had; order line unpriced) now has a number.

Goes in two places: packing row **PK1313** (0.1 → 6,700) and the
COBO-2606-2537 order line (0 → 6,700). **Part A of the fix sheet is now 15 order
lines covering 129,915 Kg.**

**Nothing in the price backlog is waiting on information any more.** What is left
is corrections to make, four POs deliberately left open until something is packed
against them, and one PO (UDPL 260400001) waiting on the `supplied` option.

Next build, in order, reviewers before code on each:
1. Action Center urgency fix
2. `supplied` option → unblocks UDPL
3. The slip
4. The refusal at packing + Data Fix door closed in the same pass

### 22 Aug — COO: don't backfill. History is closed. (Right call.)

> *"Why we need to back fill things? we should ignore them, we should consider
> them closed."*

**And it costs nothing — checked.** The worry was that answering Maxim "no price"
would leave the 18 historic 0.1 rows showing a permanent red warning. It will
not. That warning comes from `mrpCheckHtml`, rendered in exactly one place —
inside `renderLotQA`. The chain is:

`mrpCheckHtml ← renderLotQA ← openLotQA ← qaRows ← nothing`

`qaRows` is built at line 6800 and never inserted into any screen; `screenQC`
computes and discards it. **That warning has never been seen by anybody.**

The LIVE inspection check is a different one and it is fine: `qcExpect` /
`qcVerifyTable` / `priceSeen` (SPEC-06) renders through `openPackInspect`, which
is reachable from three live places — the Awaiting QA card, the QA unit rows, and
an Action Center item.

**Dropped deliberately:** all 23 packing-row corrections, and line prices on the
4 fully-packed orders. The 0.1 stays on those June rows for ever; the explanation
lives in `docs/o2s/PRICE-INTEGRITY.md` rather than being rewritten into the data.

### What actually matters now: 358 tonnes NOT YET PACKED

17 of 21 orders still have material to pack — **539,248 Kg**. Of the lines still
to pack, **31 carry no printed price at all, covering 358,005 Kg**.

- **No number needed** — 4 Maxim POs (22032, 22033, 21630, 21301), 8 lines,
  28,720 Kg. Answer "no price" and they are done.
- **Number already proven** — Enrich 4,500 (203,309 Kg), Basic 13,750 (34,940),
  Orbit-K 23,750 (12,500). **251 tonnes, three numbers, all confirmed current.**
- **NO NUMBER ANYWHERE — ~66,000 Kg**: Rudolf 39,440 across six brands (Tervalis
  16,000, Tervalis Plus 10,000, Harbor Fertigation 7,000, V Germinator Pro 5,000,
  Cala Mag V 1,000, Genius 440); Arysta Fruitlish 14,772; LCI Authority 10,000
  (line carries the 0.1 placeholder) and Ferti Rise 1,770; Cobo 5,024; Vgreen
  1,530.
- **On hold** — UDPL 260400001 Humi Cash 6,000 Kg, waits for `supplied`.

**That last group is the live version of the whole problem.** When those runs
happen somebody needs a number and nothing is written down — a phone call and a
value typed onto a packing row, which is exactly how the 128 tonnes of unsourced
pricing happened. It is about to happen again on 66 more.

### COO: print-on-pack should be open to everyone with New PO Entry access

`openBulkPrintDecision` is gated `state.role==='COO'||state.role==='KAM'`.
`SCREENS` entry owners = `['KAM']`; `accessMatrix` also grants
`entry:{v:true,e:true}` to **Plant Manager**. So today the intended set is
**KAM, Plant Manager, COO** — and it should follow the entry screen automatically
so a future PO-entry grant carries this with it.

**Trade-off, stated:** following the access matrix rather than a fixed role list
is the same mechanism behind the 30 July incident (a screen-level Edit grant
silently unlocked approval steps). Here it is deliberate and is what was asked
for — the price answer is part of taking an order, not an approval. Write it so
the set of people it opens to is visible on screen, not implied.

### Sequence

1. Answer print-on-pack on the 17 live orders (4 Maxim POs need no numbers)
2. Set the three proven prices — Enrich, Basic, Orbit-K — 251 tonnes
3. Get the missing numbers for the ~66,000 Kg, **Rudolf first**
4. Open the screen to PO-entry roles (small code change, reviewed)
5. Then: Action Center urgency → `supplied` → the slip → the refusal at packing

Steps 1–3 in a quiet window, snapshot before, row-by-row report after.

Full detail: `docs/o2s/PRICE-FORWARD-ONLY.md`.

### 22 Aug — two changes built, REVIEW REFUSED, two of my faults fixed. NOT pushed.

Built: (1) print-on-pack opened to PO-entry access, (2) Action Center able to
express a deadline. Both reviewers refused. Two findings were plain mistakes:

**MY FAULT 1 — the gate moved on the door, not on the till.**
`openBulkPrintDecision()` was widened; `saveBulkPrintDecision()` was left on
`COO||KAM`. A newly-permitted person would have answered 21 POs, pressed Save,
got "COO / KAM only" and lost every one (`bulkPD={}` on next open). The
one-rule-in-two-places fault, again. **Fixed:** a single `bulkPDMayAnswer()` now
asked in both places, plus `bulkPDDenied()` for one refusal message. Regression
checks in `backlog.test.js` run the REAL predicate for five roles — COO, KAM,
Plant Manager accepted; Production, CFO refused with the reason.

**MY FAULT 2 — the deadline flipped at noon, every day, every timezone.**
`TODAY` carries a time of day; a bare 'YYYY-MM-DD' parses as midnight; so
`Math.round((due-TODAY)/86400000)` gave whole-days-minus-hours-elapsed. Measured:

```
 9:00 due today -> dueIn  0  "due today"
13:00 due today -> dueIn -1  "1d past due"  ROW TURNS RED
18:00 due today -> dueIn -1  "1d past due"
```

The exact mislabelling the change existed to prevent. **Fixed:** normalise TODAY
to its own date before subtracting.

**AND MY TEST HID IT.** It pinned `TODAY` to `new Date('2026-08-22T00:00:00Z')` —
exact UTC midnight, which the app produces for one millisecond a day. Every
deadline assertion passed only because of that. **Fixed:** the test now builds
TODAY with the app's own expression and runs the deadline checks at 00:00, 09:00,
12:00, 13:00, 18:00 and 23:00.

Suite: 387 checks, all passing (52 / 40 / 182 / 15 / 98).

### Still open from the review — NOT fixed, needs decisions

1. **The Plant Manager cannot reach the screen at all.** Two callers of
   `openBulkPrintDecision`: the Sales & Budget button (gated `COO||CFO`, line
   ~9964) and the Action Center item (`role:'KAM'`, `acEscalation` sends
   'Print price' to COO). So the widened permission is unreachable by the only
   role it adds. Also the **CFO sees that button and is always refused by it.**
2. **`screenEditOK('entry')` does not mean "can create a PO".** `submitPO` is
   `hardRole(['KAM'])` — the Plant Manager holds `entry:{e:true}` and still
   cannot submit a PO. Both reviewers say the honest gate is an explicit
   `hardRole(['KAM','Plant Manager'])`, or widen `submitPO` to match. **COO
   decision.**
3. **Bulk "set all to no price" has no confirmation.** The single-PO path
   (`submitPO`) refuses "no" without a confirm when the products normally carry
   a price. Two clicks can set 21 POs to no-price and invert 21 QA checks.
4. **Two people answering the same PO: the second silently wins.** Sync is
   paused while the modal is open, so the `o.printDecision` guard reads stale
   state; `merge3`'s leaf rule keeps local. Both writers log "first answer".
5. **`dfSubmitCorrect()` writes `printDecision` with NO permission check at all**
   — its five siblings all carry `screenEditOK('datafix')`. Production holds
   `datafix:{e:true}`, inert only because the screen hardcodes COO.
6. `_days` is 0 for a deadline item, so "Oldest first" / "Newest first" sort a
   past-due slip as if it arrived this morning.
7. `acRowHTML` / `acCardHTML` show the PO promised date instead of the deadline
   the row is being coloured and sorted by.

**Nothing pushed. Working tree has the two fixes and the hardened tests.**
