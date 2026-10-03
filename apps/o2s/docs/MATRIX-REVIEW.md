# The rights matrix, as it stands today — for the COO's review

VAN / O2S. 22 August 2026. Every cell read from the live access matrix in the
data on record. **Read this before any more gates are converted**, because each
conversion turns a dormant grant into a real one.

Until today most of these grants did nothing — the code ignored the matrix and
used role names instead. That is what is being fixed, and it means **every cell
below is about to start meaning something.**

---

## The grid

**EDIT** = can do the work · view = can see it · — = no access

| Screen | KAM | Supply Chain | Production | Lab Rep | AQCM | QCM | QA Insp | Plant Mgr | CFO | SC Officer | Finance |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Dashboard | view | view | view | view | view | view | view | **EDIT** | view | — | view |
| My Actions | **EDIT** | **EDIT** | **EDIT** | **EDIT** | **EDIT** | **EDIT** | **EDIT** | **EDIT** | **EDIT** | view | view |
| New PO Entry | **EDIT** | — | — | — | — | — | — | **EDIT** | view | — | — |
| Customer Master | **EDIT** | — | — | — | — | — | — | **EDIT** | **EDIT** | — | — |
| PO Tracker | **EDIT** | **EDIT** | **EDIT** | — | — | — | — | **EDIT** | **EDIT** | view | view |
| Production | view | view | **EDIT** | — | — | — | **EDIT** | **EDIT** | view | view | — |
| Lab QC | — | view | view | **EDIT** | **EDIT** | **EDIT** | view | **EDIT** | view | **EDIT** | — |
| Pre-shipment QA | view | **EDIT** | view | view | view | view | **EDIT** | view | view | view | view |
| Shipments | view | **EDIT** | view | — | — | — | view | **EDIT** | view | **EDIT** | view |
| Reports | **EDIT** | **EDIT** | **EDIT** | **EDIT** | **EDIT** | **EDIT** | **EDIT** | **EDIT** | **EDIT** | **EDIT** | **EDIT** |
| Instructions | view | view | view | view | view | view | view | view | view | view | view |
| Admin · Master Data | — | — | — | — | — | — | — | **EDIT** | — | — | — |
| Data Fix | — | view | **EDIT** | — | — | — | — | view | — | — | — |
| Users & Access | — | — | — | — | — | — | — | **EDIT** | — | — | — |

---

## Six cells that need your decision

### 1. The Plant Manager holds Edit on 11 of 15 screens — including Users & Access

**This is the one to look at first.** Edit on Users & Access means he can change
the matrix itself — including granting himself anything else. Today that does
nothing much, because the code ignores the matrix. **The moment the sweep
finishes, it means he can grant himself every right in the system**, and the
matrix stops being your control and becomes his.

He also holds Edit on Master Data, Lab QC, Production, Shipments and the
Dashboard. That is not a Plant Manager grant; that is a second COO.

**Suggestion:** Users & Access to view (or none). Then look at Master Data and
Lab QC separately — Lab QC edit next to his existing deviation and rework
sign-offs puts a lot of the certificate chain in one pair of hands.

### 2. QA Inspector holds Edit on Production

The inspector could enter the production they later inspect. Today the 28
Production gates refuse them, so it does nothing. Convert those gates and it
becomes real.

**Suggestion:** set it to view. Then Production can be converted safely. This is
the single cell blocking the biggest part of the sweep.

### 3. Supply Chain Officer still holds Edit on Lab QC — the 30 July grant

This is the grant from the incident, still sitting there. It bought the ability
to approve and release delivery challans through a loophole that has since been
closed. Lab QC edit means signing certificates.

**Suggestion:** remove it. It has been on the open list since July.

### 4. Zain is under two role names

"Supply Chain" and "Supply Chain Officer" are two live roles doing one job — 55
actions and 40 shipments under the first, 14 and 20 under the second (Zain). They
have **different grants**: Supply Chain has Edit on Pre-shipment QA and My
Actions; Supply Chain Officer does not, but has Edit on Lab QC.

So Zain's rights depend on which of the two names his account carries, and
neither of you chose that. **One live role name, please** — history keeps the old
one, which is honest.

### 5. Everyone has Edit on Reports

Eleven of eleven roles. Worth one look: if anything on Reports writes rather than
reads, this is the widest grant in the system.

### 6. Ismael in Finance

The Finance role has Edit on **Reports only** — no PO entry, not even view. So
the code fix alone will not let him enter a PO.

**Two cells to check on the live system, and both must be right:**

1. **Which role is Ismael's account assigned?** He works in finance, but his
   login may sit under a different role. The account decides, not the department.
2. **Does that role have EDIT on New PO Entry?** View shows him the form with a
   dead button — which is exactly the symptom you reported. Edit is what makes it
   work.

**And one thing to watch:** the accounts on record are generic — `kam`,
`production`, `cfo`, one per role. If Ismael shares a login, granting his role PO
entry grants it to everyone on that login. That is the same "real names only on
single-person logins" item that has been open since the start.

---

## What is now converted, and what is waiting

| | State |
|---|---|
| **New PO Entry** | **Converted.** Follows the matrix. KAM, Plant Manager, COO today — the Plant Manager by your decision. |
| **Customer Master** | **Held back** on your instruction, until customer and dealer records carry ids. Two people on that screen today silently delete each other's work. |
| **Production (28 gates)** | Waiting on cell 2 above. |
| **Master Data / admin (5 gates)** | Waiting on cell 1 above. |
| **Sign-offs (~12 gates)** | **Never converting.** COA chain, DC approval, truck release, batch reopen. Now protected by a test that runs the July incident and proves it still fails. |

---

## Two loose ends the conversion created

**A Plant Manager can now raise a PO but cannot correct it.** The correction
ledger still lists `['KAM','COO']` for orders and order lines. Whoever may create
a record should be able to fix a typo in it — those two lists should move
together.

**The PO Confirmation says "Prepared by — KAM."** It prints the KAM chosen from
the dropdown. If a Plant Manager raises the order, a customer-facing document
attributes it to a KAM who never touched it. The order carries no "entered by"
field at all — only the action log knows who really did it.
