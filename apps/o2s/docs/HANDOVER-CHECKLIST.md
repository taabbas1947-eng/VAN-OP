# Three things only people can do

Everything built on 21 August is in place and deployed. **Three of the controls
do not actually work until these are done**, and none of them can be done in code.

Ordered by what is blocking the most.

---

## 1 · Answer print-on-pack for 44 POs — *you*

**Blocks:** the entire price control. 136 product lines currently read
**"MRP not recorded"**, which tells the QA inspector nothing useful and lets a bag
go out unchecked on price.

**Where:** My Actions → *"Answer print-on-pack for 44 POs"* — one item, opens one
screen. Or Sales & Budget → *"Answer print-on-pack"*.

**What you will see, per PO:**

> `COBO-2607-4034` · VITAL AGRI NUTRIENTS · 10 products
> *10× unrecorded* — **packs already printed at 1,500 (VL-NPK), 950 (Tornado), 4,500 (Nitro Sulfur)**
> `[ Prints a price ]` `[ No price ]`

That evidence line is what makes this answerable in one sitting — it is what
actually came off your line, not a guess. Nothing saves until you press Save.

**Then expect a second layer.** Answering *"prints a price"* turns a line from
*not recorded* into **MRP not set** until somebody enters the number. That is
correct — the price genuinely is not on the PO — and it is the bigger half of the
job. The printed prices are sitting in the packing lots and could be adopted in
one sweep, **but that is deliberately not built**: it is uncomfortably close to
letting a packer's number become the authorised one. Ask for it if you want it,
and it will be an explicit opt-in logged as an adoption.

**Roughly:** 44 dropdowns, one sitting.

---

## 2 · Verify the AQL accept/reject table — *QCM*

**Blocks:** the sampling numbers being a rule rather than advice. Right now the
inspection screen and the printed report both carry
*"accept/reject numbers NOT yet verified against the standard"*, and nothing is
auto-rejected on them.

**Why it is flagged:** the lot-size and sample-size tables are the standard's
general inspection levels and are solid. **The accept / reject numbers are a best
reading and have not been checked against a copy of ISO 2859-1.** The real table
carries arrows at small sample sizes that redirect to a different plan, and those
are not reproduced.

**What the QCM needs to do:** take a copy of ISO 2859-1, check the Ac/Re values
for the AQL you use (currently set to **2.5**, General Level **II**) against the
table in the code, and correct anything wrong.

**Then:** set `masters.aqlVerified = true` and the warnings disappear.

> Getting these wrong means shipping what should be held, or holding what should
> ship. It is worth an hour of the QCM's time and it is not something to take on
> trust.

---

## 3 · Put real names on the accounts — *you*

**Blocks:** every certificate and inspection report naming a person.

**The problem:** all eight logins have their name set to the role —

| Login | Name today | Should be |
|---|---|---|
| `qa` | QA Inspector | the inspector's full name |
| `lab` | Lab Rep | the analyst's full name |
| `plant` | Plant Manager | their full name |
| `production` | Production | their full name |
| `supply` | Supply Chain | their full name |
| `kam` | KAM | their full name |
| `cfo` | CFO | their full name |
| `tahir` | COO | Tahir Abbas |

**Until then**, every COA prints *"no individual name on file — signed on the
shared 'lab' login"* where the analyst's name should be. That is deliberate:
printing "QCM" on the name line would dress a job title as a person, and the COA
carries ISO/IEC 17025:2017 disclaimers. A certificate signed by a post does not
survive an accreditation audit.

**Where:** Users & Access → edit each person → Full name.

**Fix the names and every future certificate signs itself correctly.** No code
change needed.

> **The better answer, not yet done:** one login per person rather than one per
> function. Two people sharing `qa` still produces one name on both their
> inspections. That is `MODULE: PLATFORM` work — `auth_users`,
> `user_module_roles` — and needs a separately declared session.

---

## Also worth doing

**Circulate the two documents.** `TEAM-NOTE-2026-08-21.md` and
`SOP-PRE-SHIPMENT-INSPECTION.md` (**v2.0** — v1.0 is withdrawn and contained an
instruction that is now wrong). Fahim and Majid both raised things that got fixed
and neither has been told.

**Tell the team the escalation numbers will get worse.** The Action Center now
measures from dates that are true rather than dates entered late. Things that
looked green will go amber. That is the correction working, and it reads as a
regression if nobody says so first.

**Watch Reports → Anomalies for a few weeks.** The late-entry rows and
*"Inspection dated after dispatch"* build the picture that decides whether the
N-day entry lock is ever needed. **Do not turn on a lock before that baseline
exists** — otherwise nobody can tell afterwards whether it helped, or whether
people simply stopped recording.

---

*Written 21 August 2026 after nine deploys in one day. Module: O2S.*
