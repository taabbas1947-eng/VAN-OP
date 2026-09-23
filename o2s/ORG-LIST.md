# O2S — org list

*Started 23 September 2026, from Tahir's own words in session. This file is the
source for named accounts, departments and the chain of command. It is not yet
complete — more roles are coming.*

**Standing rule, Tahir's:** no account without a name and a department. Every
department names the manager responsible.

---

## People

**Source: "O2S Roles — 1st Draft", prepared by HR for O2S onboarding, received
23 Sept 2026.** That sheet is authoritative for names, employee codes and O2S
titles. Where it differed from what was said in session, the sheet wins unless
Tahir over-ruled it — every such case is marked.

`O2S Title` is the title that appears on a digital signature, so it is what
prints on a document. `O2S Role` is what HR wrote the person does.

| # | Code | Name | Department | O2S title (signs as) | What they do | Username |
|---|---|---|---|---|---|---|
| 1 | NG-002 | Tahir Abbas | Executive Leadership | COO | monitoring & tracking | tahir |
| 2 | NG-003 | Yawar Hussain | Finance & Accounting | CFO | monitoring & tracking | yawar |
| 3 | N-004 | Muhammad Faheem Asghar | Operations | Plant Manager | operations monitoring and tracking · production site lead | faheem |
| 4 | N-083 | Abdul Majid | Production | Lead Planning & Production | production lead, monitoring and tracking | majid |
| 5 | N-021 | Ali Raza | Production | Production Associate | production office data entry | aliraza |
| 6 | N-096 | Jawad Naseer | Production | Production Officer | production office data entry | jawad |
| 7 | N-084 | Himayat Hussain | QC Lab | Lead Quality Control | final approval of COA, AQCM verification | himayat |
| 8 | N-085 | Saad Jamal | Supply Chain | Lead Supply Chain | procurement | saad |
| 9 | N-128 | Shoaib Sabir | Supply Chain | Senior Warehouse Officer | warehousing and dispatch | shoaib |
| 10 | N-106 | Zain Ghaffar | Supply Chain | Warehouse Assistant | supply chain office data entry | zain |
| 11 | NG-017 | Abdul Basit Khan | Finance & Accounting | Procurement Accountant | procurement accounting | basit |
| 12 | G-279 | Muhammad Ismaeel | Finance & Accounting | Invoicing Officer | invoicing | ismaeel |
| 13 | N-069 | Muhammad Mursleen | QC Lab | QC Analyst | primary analysis | mursleen |
| 14 | N-103 | Mubeen Ahmad | QC Lab | QC Analyst | primary analysis | mubeen |
| 15 | N-122 | Abdullah Naveed | QC Lab | QC Analyst | primary analysis | abdullah |
| 16 | N-121 | Awais Hameed | QC Lab | QC Analyst | primary analysis | awais |
| 17 | N-089 | Masab Rasheed | QC Lab | **Senior QC Analyst** | secondary analysis and verification of primary analysis | masab |
| 18 | — | Muhammad Ehtisham | Quality Assurance | QA Officer | packaging QA, dispatch QA, inwards QA | ehtisham |
| 19 | — | Muhammad Asif | Quality Assurance | QA Officer | packaging QA, dispatch QA, inwards QA | asif |
| 20 | — | Muhammad Ali | Commercial | Chief Commercial Officer | commercial lead · KAM | mali |
| 21 | — | Muhammad Irfan | Commercial | KAM | reviewer — order status and his own customers | irfan |

Rows 20–21 are **not on the HR sheet** — added on Tahir's instruction from what
he gave in session. Employee codes and exact spellings still to confirm.

**Nobody has a login yet.** The sheet's "Login Created" column is empty for all
19. Usernames above are proposed by Claude; Tahir has the final say.

### Where the HR sheet differed from the session notes

| Said in session | HR sheet | Taken as |
|---|---|---|
| Fahim Asghar | Muhammad Faheem Asghar | HR |
| Abdul Majid — Production Manager | Lead Planning & Production | HR |
| Muhammad Shoaib — Warehouse Manager | Shoaib Sabir — Senior Warehouse Officer, in Supply Chain | HR |
| Saad Jamal — Supply Chain Manager | Lead Supply Chain, procurement | HR |
| Zain Ghaffar — Supply Chain Officer | Warehouse Assistant | HR |
| Himmayat Hussain — QCM | Himayat Hussain — Lead Quality Control | HR |
| Masab Rasheed — AQCM | QC Analyst | **over-ruled → Senior QC Analyst** (see C11) |
| Abdullah Naveed — Analyst | QC Analyst, primary analysis | HR |
| M Ismail | Muhammad Ismaeel | HR |
| Abdul Basit | Abdul Basit Khan | HR |
| Ali Raza — Production Officer | Production Associate | HR |

Four people were not in the session notes at all: **Muhammad Mursleen, Mubeen
Ahmad, Awais Hameed** (QC analysts) and — answering a question left open all
day — **Muhammad Ehtisham and Muhammad Asif, the two QA Officers who do the
pre-shipment inspections.**

## Departments and their manager

| Department | Manager responsible | Note |
|---|---|---|
| Commercial | Muhammad Ali (Chief Commercial Officer) | not on the HR sheet; added on Tahir's instruction |
| Production | Abdul Majid (Lead Planning & Production) | **changed** — code names the `production` operator role as lead |
| QC Lab | Himayat Hussain (Lead Quality Control) | **fills a real gap** — Quality had no lead at all |
| Quality Assurance | Muhammad Faheem Asghar (Plant Manager) | **independent** — see C10 |
| Supply Chain | Saad Jamal (Lead Supply Chain) | warehouse sits inside it, not separate — C10 |
| Finance & Accounting | Yawar Hussain (CFO) | unchanged |
| Executive Leadership / Operations | Muhammad Faheem Asghar (Plant Manager) | unchanged, confirmed |

---

## Rulings taken (Tahir, 23 Sept)

1. **Supply Chain Manager replaces the `Supply Chain` role.** Supply Chain
   Officer stays underneath. Supply Chain Manager becomes the department lead.
2. **`Finance` and `Finance Desk Officer` both retire**, replaced by Invoicing
   Officer and Procurement Accountant. Finance = CFO + those two.
3. **Warehouse becomes its own (seventh) department**, led by the Warehouse
   Manager.
4. **Plant Manager continues to lead Leadership.**
5. **Production Manager runs Production**, not the `production` operator role.
6. **Masab is AQCM** — existing role, unchanged. **Abdullah is "Analyst"** —
   O2S calls this role `Lab Rep` today; open whether the role is renamed.
7. Usernames: Claude proposes, Tahir confirms.

---

## What this costs in code — verified by reading `o2s.html`, not assumed

Every one of the 14 roles is seeded `builtin:true` (`seedRolesV1`), and both
admin functions refuse built-ins:

```
renameRole:  if(r.builtin){ toast("Built-in roles can't be renamed (they're wired in code)."); return; }
archiveRole: if(r.builtin){ toast("Built-in roles can't be archived."); return; }
```

**So none of rulings 1, 2 or 6 can be done from the Admin screen.** Each is a
code change plus a matching correction to the live `app_state` row, because
roles and departments were already seeded there in August and the seed only
fills once.

### The rename hazard

Role gates are matched on the role **name**, not its id. Counted in `o2s.html`:

| Hard-coded gate | Count |
|---|---|
| `canEdit(['Supply Chain'])` | **8** |
| `canEdit(['QA Inspector'])` | 7 |
| `canEdit(['Lab Rep','AQCM','QCM'])` | 6 |
| `canEdit(['Plant Manager','Production'])` | 3 |
| `canEdit(['Plant Manager'])` | 2 |
| `canEdit(['COO'])` | 2 |
| `canEdit(['CFO'])` | 2 |
| `canEdit(['Supply Chain','Plant Manager'])` | 1 |
| `canEdit(['AQCM','QCM'])` | 1 |

plus `legacy:{kind:'hard', roles:[…]}` on rights — `Production` ×10, `KAM` ×2,
`Plant Manager` ×1 — and bare comparisons `state.role==='COO'` ×50,
`state.role==='CFO'` ×15, `state.role==='CEO'` ×1.

Renaming `Supply Chain` without changing those 9 call sites leaves the person
listed as having access while every button refuses him. Renaming `Lab Rep`
(ruling 6) breaks 6 more. `state.role==='CEO'` matches no role that exists —
worth a look on its own.

`archiveRole` also refuses to archive a department lead until that department
has a new one, so ruling 1 must set the new lead before retiring the old role.

### Warehouse as a seventh department

Rights carry a department, and `grantRefusal` enforces it:

```
if(r.dept!==gd) return '"'+r.name+'" belongs to '+…+'. Ask the COO.'
```

A new department starts with no rights filed to it, so its manager can grant
nothing. **Open question for Tahir:** which duties move to Warehouse —
receiving raw material (`rm.receive`), loading a truck (`shipment.load`),
issuing a Gate Pass (`gatepass.issue`), packed-stock custody?

### Open questions

- The KAM and the QA Inspector still need names.
- Is "Production Officer" the existing `Production` role renamed, or a new role
  beside it? Renaming it breaks 3 `canEdit(['Plant Manager','Production'])`
  gates and 10 `legacy:{kind:'hard', roles:['Production']}` entries.
- Does the COA signature block print `Analyst` or keep `Lab Rep`?
- Which rights belong to Warehouse?
- Confirm the proposed usernames.

---

## A name collision, found 23 Sept

The Queue Shell prototype invented staff names before this list existed. One of
them — **Ali Raza** — turns out to be a real person here, a Production Officer.
The prototype shows "Ali Raza · QA Inspector" recording an inspection a day
late, with an invented reason.

That is exactly the misreading the example-data warning was built to prevent,
and it is no longer hypothetical. Before the prototype goes in front of the
company, either the invented names are replaced with this list, or the figures
attached to them stop being per-person. Not both left as they are.


---

## Commercial rethink — Tahir, 23 Sept

**Commercial no longer does data entry.** PO entry moves to Finance. What the
KAM is for now:

- track and trace an order, review and check what is ready
- communication, and tracking sale and revenue linked to customer type
- **see only the customers tagged to him as KAM**

### Rulings

| # | Ruling |
|---|---|
| C1 | **One KAM role, both jobs** — tracking/review and the commercial/revenue side. Not split. |
| C2 | **Finance raises POs, and the KAM still can too.** Both keep New PO Entry. |
| C3 | **Customer master moves to Finance.** Adding and changing customers leaves Commercial. |
| C4 | Muhammad Ali, Chief Commercial Officer, is the manager responsible for Commercial. He has **no access to O2S at all today** — there was no role that fitted him. |
| C5 | Raising a PO must not be wired to a seeded KAM code — anyone can be allowed. |
| C6 | **A new customer must be approved by the COO or the CFO before it can carry a PO.** Not the CCO. |
| C7 | **There are three KAMs: Tahir Abbas, Muhammad Irfan, Muhammad Ali.** Muhammad Imran is transferred and is no longer a KAM — Tahir deleted him from the app on 23 Sept. |
| C8 | **KAM is not a role — it is a property of the person.** Role decides what buttons you get (one each, per the no-second-role rule); the KAM tag decides which customers you see. |
| C9 | **The `KAM` role is redefined as a read-only reviewer** — order status and the customers tagged to him, nothing editable. Muhammad Irfan holds it. |
| C10 | **Quality splits in two.** QC Lab under Himayat Hussain does COAs. The QA Officers are **independent, report to the Plant Manager**, and do the pre-shipment inspections. Warehouse stays **inside** Supply Chain — the seventh-department idea is dropped. |
| C11 | **COA signatures: QC Analyst / Senior QC Analyst / Lead Quality Control.** Masab Rasheed signs as Senior QC Analyst so the verification signature is distinct from the four analysts. |
| C12 | **FOC samples never carry a printed price.** O2S must answer price-on-pack itself on an FOC order, not leave it unanswered. |

### What the code already allows, and what it does not

**C2 and C5 need no code at all.** Raising a PO is screen-gated, not name-gated:

```js
{code:'order.create', dept:'commercial', name:'Raise a new PO',
 legacy:{kind:'screen', scr:'entry'}}
```

`kind:'screen'` means it is answered by the access matrix on New PO Entry. Any
role given edit access there can raise a PO. Giving it to Finance while the KAM
keeps it is two ticks in the matrix.

**C3 is hard-wired and held back on purpose:**

```js
{code:'customer.create', dept:'commercial', name:'Add a customer or dealer', delegable:false,
 note:'HELD BACK until customer rows carry ids — COO only, not the lead.',
 legacy:{kind:'hard', roles:['KAM']}}
```

Same for `customer.amend`. Only the role literally named `KAM` qualifies, and
`delegable:false` means no department lead can pass it on — the COO alone. The
recorded reason is real: **customer rows carry no id**, so two people editing
that screen at once silently delete one another's work. Moving this to Finance
means fixing that bug first, or moving a known data-loss risk to a new desk.

**The KAM scope does not exist.** The tagging does:

- customers already carry an **Assigned KAM** field; orders carry a `kam` too
- but nothing anywhere filters by it — no row-level scoping exists in O2S. Every
  KAM sees every customer and every order.
- the field is decorative today: the master list is `kamNames: ["Muhammad Imran"]`
  — one name, so the PO dropdown offers one choice — and the opening-PO importer
  stamps `kam:'Tahir Abbas'` on every order it creates
- `kamNames` is a plain list of text with **no link to any login**

So "a KAM sees only his own customers" needs, in order: a link from the user
account to a KAM identity, then a scope filter, then every screen that lists
customers or orders taught to respect it. This would be the first row-level
scoping in O2S — miss one screen and it leaks.

### A control point Tahir should decide knowingly

With C2 and C3 together, Finance would **create the customer, raise the PO and
issue the invoice** — the whole revenue cycle inside one department with no
second pair of eyes. Today the KAM owning the customer record is what prevents
that, incidentally rather than by design. None of the five separation rules
covers this shape.

**Ruled 23 Sept (C6): a new customer must be approved by the COO or the CFO
before it can carry a PO.** Explicitly not the CCO.

Note for whoever builds it: the **CFO sits inside Finance**, so CFO approval is
a supervisor checking his own department — maker-checker, not independent. The
**COO is outside Finance**, so that approval is the one that actually breaks the
cycle. Both are allowed; they are not equally strong, and that is Tahir's
decision, taken knowingly.

**How it should work.** Customers already carry a status. A customer starts
unapproved and cannot carry a PO until the COO or CFO approves it. In New PO
Entry this is a **17th readiness check — "Customer approved"** — shown in the
same list as the existing 16, so the person entering sees exactly why the button
is disabled instead of guessing. The approval is recorded with who and when,
like every other sign-off, and appears on the customer record.

Open: does approval block only new POs, or also block amending an existing
customer back into use?

### Still owed

- Is **Chief Commercial Officer** its own role, or does Muhammad Ali hold `KAM`?
- The **QA Inspector** has no name — and the inspection gate went live today.
- Which rights move to the Warehouse department.
- Does the COA print `Analyst` or keep `Lab Rep`?
- Does customer approval block only new POs, or also re-activating an old customer?


---

## KAM is a tag, not a role — and why that matters

Three people are KAMs: **Tahir Abbas (COO), Muhammad Irfan, Muhammad Ali (CCO)**.
Two of the three are KAMs *as well as* holding another job. So KAM is a hat, not
a job title.

This resolves a real tension. Tahir ruled **no per-user overrides and no second
role**, because both bypass the role-keyed refusal rules (`grantRefusal` and
`separationRefusal` are keyed on role). But if KAM had to be a role, he and Irfan
would each need two.

**The model that satisfies both:**

| | What it is | What it decides |
|---|---|---|
| **Role** | One per person, as ruled | What buttons you get |
| **KAM assignment** | A tag on the user account | Which customers you see |

It is also the only shape in which the scoping works. If KAM were a role, all
three would share it and therefore see the same customers — the opposite of what
was asked for. The filter has to follow the person.

**Consequence for the data.** `state.masters.kamNames` — a free list of text with
no link to any login — should be retired, and the assignment should live on the
user account instead. That link is the missing piece that makes "a KAM sees only
his own customers" possible at all.

### Live hazard found 23 Sept — check this first

`kamNames` held exactly one value, Muhammad Imran, and it was deleted from the
app today. **KAM Name is required check #4 of the 16 on New PO Entry**, and the
dropdown is built only from that list:

```js
<select id="e_kam"><option value="">— pick KAM —</option>
  ${((state.masters&&state.masters.kamNames)||[]).map(...)}
...
['KAM Name', !!($('e_kam')&&$('e_kam').value.trim()), 'e_kam'],
...
if($('e_submit')) $('e_submit').disabled = !ok;
```

If the list is now empty, the only option is the blank placeholder, the check can
never pass, and **the Submit button is dead for everyone** — with no message,
because the 16 checks are computed and shown to nobody. The fix is one admin
action, no code: Admin · Master Data → KAM names → add Tahir Abbas, Muhammad
Irfan, Muhammad Ali.

This is the disease in miniature: deleting one master-data value silently
disabled a required field across the whole app, nothing warned the person who did
it, and nothing would tell the person who hit it.

### The history

Orders already tagged to Muhammad Imran still carry his name, and the opening-PO
importer stamped `kam:'Tahir Abbas'` on every order it created. Recommendation:
**leave the history alone** — it records who held the account at the time — but
those customers must be re-tagged to a current KAM, or they belong to nobody once
scoping goes live. Count not yet taken; `van_platform.sql` in the repo would give
the exact number, not yet read.

### The `KAM` role, redefined — ruled 23 Sept (C9)

Muhammad Irfan needs "a reviewer only, from order status and customers attached
to him". That is the whole role:

- **read-only everywhere** — no PO entry, no customer changes, no approvals, no
  sign-offs
- **order status end to end** — PO Tracker and the dashboard
- **scoped to his own customers**, and their orders only
- the commercial side already described: delivered value by customer type

So `KAM` stops meaning "the person who enters POs and owns the customer record"
and starts meaning **"reviewer over my own accounts"**. A much smaller and safer
role, which is what makes it giveable to anyone.

| Person | Role — what buttons | KAM tag — what he sees |
|---|---|---|
| Muhammad Irfan | **KAM** (read-only reviewer) | his customers |
| Muhammad Ali | Chief Commercial Officer *(confirm)* | his customers |
| Tahir Abbas | COO | his customers |

**These two changes are one change.** A read-only role cannot hold
`customer.create`, and that right is hard-wired `legacy:{kind:'hard',
roles:['KAM']}`. So redefining `KAM` as read-only (C9) and moving the customer
master to Finance (C3) must ship together — do one without the other and the
Customer Master screen breaks for whoever holds `KAM`.

### Live check, 23 Sept

The KAM dropdown on New PO Entry is **working again** — Tahir re-added the names
after deleting Muhammad Imran. PO entry is not blocked. Confirmed by Tahir from
the live screen.

### Still owed on Commercial

- Is **Chief Commercial Officer** its own role, or does Muhammad Ali hold `KAM`?
  (If `KAM` is now read-only, Ali needs a different role to do anything.)
- Which customers are tagged to which of the three KAMs.


---

## C10 — why the QA split matters more than it looks

Tahir: *"Himayat leads lab quality. Inspectors are independent and report to the
Plant Manager, and they do pre-shipment inspections."*

That is the structural fix for the finding that opened this whole thread. The app
has a separation rule reading **"nobody inspects their own output"** —
`production.enter` ✕ `inspection.perform` — and it has never been able to fire,
because six of the nine codes the five rules name are missing from `RIGHTS`.

Putting the QA Officers outside both Production and QC Lab enforces the same
thing organisationally, without waiting for the code. Muhammad Ehtisham and
Muhammad Asif answer to the Plant Manager, not to the people whose work they
inspect.

It also closes a gap that was open all day: **the pre-shipment inspection gate
went live on 23 Sept with nobody named to do the inspections.** There are two of
them, and this is their job.

Warehouse stays inside Supply Chain, so there is no seventh department and no
rights to re-file. Saad Jamal owns procurement, Shoaib Sabir owns warehousing and
dispatch, Zain Ghaffar does the data entry — one department, three clear jobs.

---

## C12 — the FOC price-on-pack trap, and how to fix it safely

### What is wrong today, verified in `o2s.html`

On an FOC PO the price-on-pack question **looks required and is not**.

- The panel renders on `entryClient` alone, with a red `*`, an amber border and
  "not answered". The summary shows a warning badge.
- But every price check short-circuits on FOC:
  `['Price-on-pack answered', entryFOC || entryPrintMode()!==null, 'e_lines']`
- So Submit is never blocked by it.

This is worse than a blocker. It teaches whoever raises FOC samples that a red
asterisk and "not answered" can be ignored — and they then ignore it on a
commercial PO, where it decides what the QA inspector is told. That is Fault 11
returning, the one the code's own comment records as having put a wrong
instruction in front of the inspector on **41 of 44 live POs**.

**CORRECTION, same day, before building.** I wrote here that an unanswered FOC
PO makes the inspection report print a red "not recorded — check the client PO".
**That was wrong**, and I found it by reading the submit path before changing it:

```js
printDecision:(entryPrintMode()||'no')
```

The `|| 'no'` already defaults an unanswered PO to "no price", and
`printPolicyOL()` tests `dec==='no'` first and returns `noprint`. So the printed
document was **already correct**. No customer-facing document was ever wrong
because of this.

**What is real** is smaller and sharper. The same submit writes:

```js
printOnPack:  (entryPrintMode()!=='no')   // null !== 'no'  ->  TRUE
printDecision:(entryPrintMode()||'no')    //                ->  'no'
```

Every FOC order carried **two fields disagreeing with each other**. Harmless
today only because `printDecision` is checked first; a trap for anyone who later
reads `printOnPack` and believes it.

So the case for fixing this was never the document. It is that a question shown
as required, which is not required, teaches people that required means nothing —
and on a commercial PO it is the answer that tells the inspector what to check.

### BUILT — 23 Sept 2026

Shipped in `BUILD_ID='2026-09-23a'`. The fix ruled by Tahir, implemented as a
**derived** answer rather than a stored one:

```js
function entryPrintEffective(){ return entryFOC ? 'no' : entryPrintMode(); }
```

Deriving it removes the trap entirely — there is no stored value to clear when a
PO stops being FOC, so a silent "no" cannot be left behind, and a human's own
answer survives a trip through FOC untouched. `entryPrintOn` is still written in
exactly one place, `setPrintOn()`, which is the human pressing a button.

Verified: 24 new checks in `tests/focprice.test.js`, and the full suite at
**7,266 passed / 0 failed** against a baseline of 7,242 — the delta is exactly
the new tests, so nothing else moved. The new suite crashes against the
unmodified file, which is how I know it tests something real.

### The fix as ruled

FOC samples **never** carry a printed price. So:

1. On FOC, O2S sets the answer itself to **"No price on the bag"**.
2. The panel stops asking and states the decision instead — decided, not
   unanswered, with the reason ("FOC sample — no price on the bag").
3. The summary badge goes from warning to settled.
4. `printPolicyOL()` then returns `mode:'noprint'`, and the inspection report
   reads **"no price should appear on this pack"** — a real instruction the
   inspector can act on, instead of a red "not recorded".

### The trap to avoid while building it

**If the PO type changes back from FOC to Commercial, the auto-answer must be
cleared back to unanswered.** Leaving a silent "no" on a commercial PO is
precisely Fault 11 — a wrong instruction in front of the inspector with nobody
having answered anything. The auto-answer must be recorded as system-set, not as
a human decision, and must not survive the type changing.

Tests to write before touching the code: set FOC → the answer is `no` and the
check passes; switch back to Commercial → the answer is cleared and Submit blocks
until a human answers.

---

## Open questions

- Employee codes and exact spellings for Muhammad Ali and Muhammad Irfan.
- ~~Which customers are tagged to which KAM~~ — answered, see The KAM book.
- Is BKK one customer in two segments, or a duplicate?
- Should `Confirmed` become a real status, or be normalised to `Active`?
- Re-tag Shahzad Cheeema (FRM-SHA-26-100) away from Muhammad Imran.
- Confirm the proposed usernames.
- Does customer approval (C6) block only new POs, or also re-activating an old
  customer?
- How many **orders** still carry Muhammad Imran as KAM (customers: one, found).
  `van_platform.sql` in the repo would answer it; not yet read.
- Is redistributing the book away from Tahir (25 of 32) part of this exercise?


---

## The KAM book — read from Customer Master, 23 Sept 2026

Taken from Tahir's screenshots of all six segments. **32 customers.**

| Segment | Tahir Abbas | Muhammad Ali | Muhammad Irfan | Muhammad Imran |
|---|---|---|---|---|
| White-label (9) | 7 | 2 | — | — |
| Dealer (8) | 6 | — | 2 | — |
| Distributor (3) | 2 | 1 | — | — |
| VGreen (3) | 3 | — | — | — |
| COBO (1) | — | — | 1 | — |
| Direct Farmer (8) | 7 | — | — | **1** |
| **Total** | **25** | **3** | **3** | **1** |

### Muhammad Ali — 3

- WL-KIS-26-101 · Kisan Fertiliser (Pvt) Ltd
- WL-BKK-26-108 · BKK
- DST-BKK-26-100 · BKK

### Muhammad Irfan — 3

- DLR-SN-TAY-003 · Ghfar Zari Merkaz, Tando Allahyar
- DLR-SN-TAN-008 · Arain Traders, Tando Allahyar
- COBO-001 · Vital Agri Centers

Both dealers are Sindh, which fits a Sindh regional book.

### Muhammad Imran — 1, and it is orphaned

- FRM-SHA-26-100 · Shahzad Cheeema, Hafizabad

He is transferred and was deleted from the app on 23 Sept. **This customer is now
tagged to a KAM who does not exist.** Under the scoping rule it would belong to
nobody and appear on no one's screen. It needs re-tagging before scoping goes
live. This also answers the open question from earlier: the exposure is one
customer, not a backlog — but orders already raised against it still carry his
name in their own `kam` field, which is a separate count not yet taken.

### What the distribution means for the scoping

**Tahir holds 25 of 32 customers — 78%.** So "a KAM sees only his own customers"
would today show the COO almost the whole book and the two working KAMs three
accounts each. The scoping is correct to build, but it only does real work once
the book is actually distributed. Worth deciding whether that redistribution is
part of this exercise or a separate one.

---

## Two data problems visible in the same screenshots

### 1. `Confirmed` is a status the code does not know about

Six of the eight dealers show status **Confirmed**; two show **Active**. The
string `'Confirmed'` **appears nowhere in `o2s.html`** — it exists only in the
data. The only writer of customer status is this toggle:

```js
c.status = ((c.status||'Active')==='Active') ? 'Inactive' : 'Active';
```

It tests for `'Active'` and treats everything else as inactive. So a Confirmed
dealer is shown a **"Reactivate"** button, as if he were switched off — which is
what the screenshot shows on all six. Pressing it does not "reactivate"
anything: it overwrites `Confirmed` with `Active` and the original value is gone.

Not yet established: whether anything downstream depends on `Confirmed`. Nothing
in the code reads it, so probably not — but it is displayed to users as a real
status, and it is quietly destructible. Needs a decision: make it a real status
the code understands, or normalise it away deliberately rather than one accidental
click at a time.

### 2. Two coding inconsistencies, in a table with no ids

- **BKK appears twice** — `WL-BKK-26-108` under White-label and `DST-BKK-26-100`
  under Distributor, both tagged to Muhammad Ali. May be legitimate (one company
  buying in two segments) or a duplicate. Needs Tahir's word.
- **Excel Chemical Karachi carries the code `WL-EXC-26-109`** but sits in the
  **Distributor** tab. The prefix says White-label, the segment says Distributor.

These matter more than they look because **customer rows carry no id** — the code
is the de facto key, and it is what the held-back `customer.create` /
`customer.amend` rights are waiting on. A code whose prefix contradicts its
segment is exactly what breaks a later migration to real ids.
