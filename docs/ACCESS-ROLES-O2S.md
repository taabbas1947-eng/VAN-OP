# O2S — Access & Roles: who can do what

_The detailed O2S reference. Expands the O2S section of `ACCESS-ROLES.md`.
Written 2026-09-07 from `o2s/o2s.html` (the `RIGHTS[]` catalogue) and the
in-code gates. **The in-app Authorisation panel is the live source of truth** —
this doc records the standing design and the conversion status._

---

## How O2S decides an action

An action is allowed only if **all** of these pass:

1. **Role** — you hold an O2S role that carries the right.
2. **Ownership** — you act on **your own item**, unless it was formally
   **escalated** to you (`acEscalation`). Holding the role is not enough to touch
   someone else's item. _(This is the 2026-07-30 rule — it must stay impossible
   for one person to act on another's work.)_
3. **Enforcement kind** — how the right is checked (see legend).

### Enforcement legend
| Kind | Meaning |
|---|---|
| **matrix** | Configurable in the **Authorisation panel** — the COO ticks the right against a role (checked as "Edit" on that screen). |
| **hard** | Fixed in code: **COO, or one of the named roles**. Not yet in the panel. |
| **all** | Any signed-in user. |
| **sign-off** | A **second signature** — one person checking another's work. Stays hard-coded on purpose; **never delegated**. |
| **COO-only** | `delegable:false` — only the COO may hold/grant it; a department lead cannot hand it to their own team. |

The **COO** is above all of this: platform + O2S administrator, holds every
right, manages access, and owns the Authorisation panel.

---

## The 10 O2S roles

| Role | Mandate |
|---|---|
| **COO** | Everything. O2S + platform admin, access management, the Authorisation panel, and the COO-only held-back rights. Sees cost/price. |
| **CFO** | Finance. **Approves purchase requisitions.** Sees **cost/price** (COO + CFO only). |
| **KAM** (Key Account Manager) | Commercial. Raises/manages POs; customer-master rights are currently **held back to the COO** (see below). |
| **Supply Chain** | Materials & dispatch: RM checks, shipments, gate passes, deliveries, receiving, closing PRs. |
| **Production** | The plant floor: batches, output, shifts, packing, by-products, rework/divert. |
| **Plant Manager** | Department head & **second signatures**: releases trucks, reopens batches, accepts lab deviations, removes shift output. |
| **Lab Rep** | Quality: lab QC review & approve. |
| **AQCM** (Asst. QC Manager) | Quality: lab QC review & approve. |
| **QCM** (QC Manager) | Quality: lab QC review & approve. |
| **QA Inspector** | Quality: lab QC review & approve; QA holds/corrections. |

---

## Every action, and who can do it

### Commercial
| Action | Who | Kind |
|---|---|---|
| Raise a new PO (`order.create`) | Whoever has Edit on New PO Entry | matrix |
| Answer print-on-pack for a PO (`order.print_decision`) | Whoever has Edit on New PO Entry | matrix |
| Acknowledge a PO (`order.acknowledge`) | Any signed-in user | all |
| Add a customer/dealer (`customer.create`) | **COO only** (legacy KAM; held back until customer rows carry ids) | COO-only |
| Change a customer record (`customer.amend`) | **COO only** (same hold-back) | COO-only |

### Supply Chain
| Action | Who | Kind |
|---|---|---|
| RM Check — confirm material availability (`rm.check`) | Supply Chain _(partial/none → raises a PR for CFO)_ | matrix (was canEdit) |
| Plan a shipment / raise a DC (`shipment.plan`) | Supply Chain _(Plant Manager can reach it from Approvals)_ | matrix |
| Start loading a truck (`shipment.load`) | Supply Chain _(PM via Approvals)_ | matrix |
| Issue a Gate Pass (`gatepass.issue`) | Supply Chain _(PM via Approvals)_ | matrix |
| Confirm a delivery (`delivery.confirm`) | **Supply Chain only** _(COO ruled it never hands to the PM; re-flags to the same owner after 3 days if stale)_ | matrix |
| Receive raw material against a PR (`rm.receive`) | Supply Chain _(only after CFO approves the PR)_ | matrix |
| Close a purchase requisition (`pr.close`) | Supply Chain | matrix |

### Production
| Action | Who | Kind |
|---|---|---|
| Open a batch (`batch.open`) | Production | hard |
| Enter produced quantity (`production.enter`) | Production | hard |
| Log a shift (`shift.log`) | Production | hard |
| Pack cleared stock (`packing.pack`) | Production | hard |
| Reconcile the remainder (`packing.reconcile`) | Production | hard |
| Call a by-product for manufacturing (`byproduct.call`) | Production | hard |
| Divert material (`packing.divert`) | Production | hard |
| Send a pool for rework (`packing.rework`) | Production | hard |
| Close a batch (`batch.close`) | Production | hard |
| Close settled batches in bulk (`batch.close_bulk`) | Production | hard |
| Remove a shift's output / void (`production.void`) | **Plant Manager** (head-level) | hard |

### Quality _(not yet moved into the panel — still enforced in code)_
| Action | Who | Kind |
|---|---|---|
| Lab QC review & approve | Lab Rep · AQCM · QCM · QA Inspector · Plant Manager | hard |
| Clear a QA hold / correct a lot (`clearQaHold`, `lotQACorrect`) | Supply Chain · QA Inspector | canEdit (pending) |
| Edit the Raw Material master | Supply Chain — but this is **master data** (guarded) | master-data |

### Finance
| Action | Who | Kind |
|---|---|---|
| Approve a purchase requisition | **CFO** | hard |
| See cost / price | **COO + CFO only** | hard |

### Second signatures — Plant Manager _(permanent, never delegated)_
| Action | Who | Kind |
|---|---|---|
| Release a loaded truck | Plant Manager | sign-off |
| Approve / reject a delivery challan (DC) | Plant Manager | sign-off |
| Reopen a closed batch | Plant Manager | sign-off |
| Accept a lab deviation / send a batch for rework after an UNFIT result | Plant Manager | sign-off |

---

## Roles × departments (at a glance)

| Department | Owning role(s) | Second signature |
|---|---|---|
| Commercial / orders | KAM (customers held to COO) | — |
| Supply chain / dispatch | Supply Chain | Plant Manager (release truck, DC approve) |
| Production / packing | Production | Plant Manager (void, reopen batch, rework after UNFIT) |
| Quality / lab | Lab Rep, AQCM, QCM, QA Inspector | Plant Manager |
| Finance | CFO (PR approval, cost) | — |
| Everything / admin | COO | — |

---

## Conversion status (why some rights are "matrix" and some "hard")

Rights are being moved from hard-coded role checks into the **Authorisation
panel** one department at a time:

- ✅ **Commercial, Supply Chain, Production** — converted (Aug 2026); their rights
  are tick-able in the panel (except the COO-only held-back customer rights).
- ⏳ **Quality** — not yet; still enforced in code.
- 🔒 **Second signatures** (release truck, DC approve, batch reopen, lab-deviation
  rework) — stay hard-coded **by design**; they are sign-offs, not delegable rights.

A right only appears in the panel once a **real screen/button** asks for it —
the panel never shows a tick that decides nothing.

---

_Keep this in sync when rights move into the panel or the COO changes a grant._
