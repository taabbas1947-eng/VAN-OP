# VAN Systems — Access & Roles: who can do what

_Source of truth for the platform's access model. Written 2026-09-07 from the
live code (`server.js` platform access, `pd/pd-lib.js` PD roles, `o2s/o2s.html`
capability catalogue). Where the app has an in-app panel that can change rights
(O2S Authorisation matrix, PLATFORM Manage-access), **that panel is the live
truth** and this doc describes the standing design._

Access is decided in **three layers**. A person must pass all three to perform an action.

```
Layer 1  PLATFORM   — can you sign in, and which modules do you see?      (COO / subsystem admin / user)
Layer 2  MODULE     — what role do you hold inside that module?           (O2S role / PD role)
Layer 3  ACTION     — does that role carry this specific right?           (server-side, deny-by-default)
```

---

## Layer 1 — Platform access (two-tier)

One login (`van_token`) covers the whole platform. What you can *administer* is a
separate thing from what modules you can *use*.

| Tier | How it's set | What it can do |
|---|---|---|
| **COO — Platform Administrator** | O2S role = `COO` | The top of the platform. Uses every module. Manages **any** user's access in **any** module. **Appoints/removes subsystem administrators.** Only the COO can grant the COO role. |
| **Subsystem Administrator** | `is_admin = 1` on a `(user, module)` grant | Manages roles **within that one module only**. A person can be admin of more than one module. Cannot assign the COO role, cannot touch the COO's own access, cannot administer a module they don't administer. |
| **Regular user** | one or more `(module, role)` grants | Uses the modules they're granted. On the launcher, granted tiles are unlocked; ungranted tiles are visible but **locked**. |

**Guardrails enforced in code** (`/api/platform/access`, `/api/platform/admin`):
- A subsystem admin is refused any module outside their `adminModules`.
- A subsystem admin cannot set anyone's role to `COO`.
- Nobody but the COO can change the COO's access.
- Creating a user grants **identity only** — access is granted separately afterwards.
- The system refuses to remove the **last COO** (there must always be one).

---

## Layer 2a — O2S roles (Order to Ship)

O2S has **10 roles**: `KAM · Supply Chain · Production · Lab Rep · AQCM · QCM ·
QA Inspector · Plant Manager · CFO · COO`.

Rights in O2S are governed by a **capability catalogue** and an in-app
**Authorisation panel** where the COO ticks rights against roles. Some rights are
still "hard" (fixed in code) and are migrating into the panel. The table below is
the **standing ownership by department** — the panel is the live word.

| Role | What they own / are allowed to do |
|---|---|
| **COO** | Everything. Platform + O2S administration, access management, and the actions held back to the COO alone (e.g. sign-off tied to customer identity). Sees cost/price. |
| **CFO** | Finance. Approves **purchase requisitions** (a partial/none RM check raises a PR for CFO approval). Sees **cost/price** (COO + CFO only). |
| **KAM** (Key Account Manager) | Commercial. **Add/change customers & dealers**, raise and manage POs. |
| **Supply Chain** | The dispatch & materials spine: **RM Check** (material availability), **plan a shipment / raise a DC**, **start loading**, **issue a gate pass**, **confirm delivery**, **receive raw material** against an approved PR, **close a PR**. |
| **Production** | The plant floor: **open / close a batch** (incl. bulk close), **enter produced quantity**, **log a shift**, **pack cleared stock**, **reconcile the remainder**, **call a by-product**, **divert** or **send a pool for rework**. |
| **Plant Manager** | Department head & **second signatures**: **release the truck** (after gate pass), **reopen a closed batch**, **accept a lab deviation / send a batch for rework after an UNFIT result**, **remove a shift's output** (void). Can deputise on some supply-chain steps from the Approvals screen. |
| **Lab Rep / AQCM / QCM / QA Inspector** | Quality control: **lab QC review & approve** at the quality gates. |

_Note: O2S enforces the item's **owner**, not just the role — a manager only sees
another owner's live button when work is formally escalated to them
(`acEscalation`). This is deliberate; it's what stops one person acting on
another's item._

---

## Layer 2b — PD roles (Product Development)

PD has **10 roles**, each mapped to a set of **surfaces** (screens/APIs). No
`pd_role` at all = **no PD access**. The COO (chair) is implicitly allowed
**every write action** on top of the surfaces below.

| Role (`pd_role`) | Label | What they can reach |
|---|---|---|
| **member** | Team member | Base only: home, **their own** ideas, submit a new idea, the guide, the library. Cannot see everyone's ideas. |
| **consultant** | Outside Reviewer | Base **+ read across**: all ideas, gate log, development records, registers. (A reviewer's view.) |
| **lab_tech** | Lab Technician | Base **+** my work, **samples**, candidates. |
| **ceo** | CEO (advisor) | Base **+** broad visibility: my work, all ideas, gate log, records, candidates, trials, registers, learnings, formulations, regulatory. Lands on the portfolio index. |
| **qc_head** | QC Head (the PD Lead) | **Full operator**: base + my work, all ideas, gate log, screen, records, samples, candidates, trials, registers, learnings, formulations, regulatory. |
| **rta** | Plant Manager (RTA) | Full operator (as qc_head). |
| **production** | Production Manager | Full operator (as qc_head). |
| **agronomy** | Agronomy | Full operator (as qc_head). |
| **custodian** | Data Custodian | Everything, **including admin, audit, and the dropbox** — the operational administrator of PD. |
| **coo** | COO (chair) | Everything (as custodian) **+ implicit authority over every write action / gate**. |

### PD gate powers (the six-gate pipeline G1–G6)

- **G1 · Screen** decides whether an idea opens a route. Who may screen depends on the lane:
  - **Heavy lane** (a brand-new product concept): the **COO** screens, with the **Plant Manager (RTA)** as backup.
  - **Light lane** (improvement / variant / fix): the **QC Head (PD Lead)** screens, with the **Plant Manager (RTA)** as deputy.
  - The **COO can always screen** either lane.
- **G2 · Design approval** — sign off the development record before the bench opens.
- **G3–G6** (Beaker → Bench → Field trial → Scale-up) are **committee gates**; an `advance` decision moves the pipeline stage forward.
- Every decision (advance / iterate / park / kill / return / reclassify) is **kept forever with its reason** — nothing is deleted.

---

## Layer 3 — How it's enforced

- Every PD API route declares a **surface**; the server checks `can_pd(role, surface)`
  before running it — a hidden button is never the only lock (`pdRequireSurface`).
- O2S actions check the capability catalogue / `hardRole` **and the item's owner**
  server-side.
- Platform access routes check `accessAdmin` (COO or the relevant subsystem admin).
- Default is **deny**: no role → no access.

---

## The other modules

| Module | Access status |
|---|---|
| **HRMS** | A **separate application** (Django) with **its own role model** — not governed by this repo. It has its own RBAC (deny-by-default), row-level confidentiality per role (department + location, or team), and a leave-approval hierarchy (line manager → final authority). Documented with that app. |
| **QMS, CRMS** | **Not built.** "Coming soon" tiles. When built, they slot into the same two-tier platform model above (each gets its own roles + a subsystem administrator). |

---

_When roles or rights change in the app, update this doc — or note that the
in-app Authorisation / Manage-access panel now differs from it._
