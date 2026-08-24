# Departments, roles and rights — a redesign of the authorisation model

VAN / O2S. 22 August 2026. Written after the COO reviewed the live matrix.

> *"What I have just seen in the matrix, I found it's really poorly defined. We
> have considered production as a role not as a department. Further we can't add
> the new role/department through the backend. We need to work the authorisation
> panel as the only valid path. Also we need to rethink the matrix — like we
> bring role and then we can add possible rights to each role within his function
> or otherwise. I would prefer a role-based table then assigning (tick) possible
> rights."*

The diagnosis is right. Here is the evidence, then the design.

---

# Part 1 — what is actually wrong

## 1. There is no department. A role is a flat name.

The whole model is `{id, name, builtin, archived}`. Nothing else. So "Production"
has to serve as a department, a job title and a permission bucket at the same
time — and the moment there are two people in production doing different jobs,
there is nowhere to put that.

The same squeeze is already visible in Quality: **Lab Rep, AQCM, QCM and QA
Inspector are four roles in what is really one function**, and they are flat
siblings of "Production" and "CFO".

## 2. A new role created in the panel can see almost everything and do nothing

`addRole()` seeds the new role with three denials — Users, Master Data, Data Fix
— and nothing else. Every other screen falls to the default, and the default for
visibility is **true**.

**So a brand-new role can see 12 of the 15 screens on the day it is created**,
including PO Tracker, Production, Lab QC, Shipments and Sales & Budget. Nobody
chose that. It is what happens when a permission model defaults to yes.

And it can *do* nothing, because the 115 hard-coded gates in the file have never
heard of it.

## 3. Ten of the twelve roles cannot be renamed or archived

The panel says it plainly: **"wired in code — locked"**. Built-in roles are
untouchable because their names are typed into the source in 115 places. That is
the answer to "we can't add the new role/department" — you can add one, it just
cannot do anything, and you cannot reshape the ten that matter.

## 4. Rights are filed under the role's NAME, not its id

`accessMatrix` is keyed by name while roles carry an id. Rename a role and its
entire rights row is orphaned — the role keeps its id and loses everything it was
allowed to do, silently. That is also why "Supply Chain" and "Supply Chain
Officer" ended up as two separate rights rows for one job.

---

# Part 2 — the model

**Department → Role → Rights**, with users assigned to a role, and everything
created in the Authorisation panel.

## Departments

A department is the function, and the natural home of a set of rights.

| Department | Roles in it today would be |
|---|---|
| Commercial | KAM, and whoever else takes orders |
| Production | Production Manager, Shift Incharge |
| Quality | Lab Rep, AQCM, QCM, QA Inspector |
| Supply Chain | Supply Chain Officer, Store |
| Finance | CFO, Finance Officer |
| Leadership | Plant Manager, COO |

A department is not a permission. It is the grouping that makes the rights list
readable and gives a role its default set — *"within his function"*. Rights from
another department can still be ticked — *"or otherwise"* — because real plants
are not tidy.

## Rights — named capabilities, not screens

A screen is not a right. "Edit on Production" is not a decision anyone can reason
about; "may close a batch" is. The catalogue below is derived from what the code
actually gates today.

### Commercial
`order.create` · `order.amend` · `order.acknowledge` · `order.print_decision`
· `customer.create` · `customer.amend` · `price.invoice_set`

### Production
`batch.open` · `batch.set_number` · `production.enter` · `production.void`
· `packing.pack` · `packing.divert` · `packing.rework` · `packing.reconcile`
· `batch.close` · `batch.close_bulk` · `shift.log` · `byproduct.call`

### Quality
`coa.draft` · `coa.review` · `coa.approve` · `coa.deviation` · `coa.rework`
· `inspection.perform` · `inspection.record_price` · `slip.sign`

### Supply Chain
`shipment.plan` · `shipment.load` · `gatepass.issue` · `shipment.release`
· `dc.approve` · `dc.reject` · `delivery.confirm`

### Leadership
`batch.reopen` · `slip.resolve_delay` · `correction.supersede`

### Administration
`master.edit` · `users.manage` · `rights.manage` · `role.manage`

About forty rights, against 115 scattered checks. Each one is asked for in one
place and answered in one place.

## The table

Pick a role. See its rights, its own department first, everything else below,
folded. Tick.

```
Role:  Shift Incharge          Department: Production

  PRODUCTION                                    ✓ = granted
    Open a batch                                    [✓]
    Set a batch number                              [✓]
    Enter produced quantity                         [✓]
    Pack a batch                                    [✓]
    Close a batch                                   [ ]
    Close settled batches in bulk                   [ ]
    Void a production entry                         [ ]
    Log a shift                                     [✓]

  QUALITY                                    ⌄ show 8 rights
  COMMERCIAL                                 ⌄ show 7 rights
  SUPPLY CHAIN                               ⌄ show 7 rights
  ADMINISTRATION                             ⌄ show 4 rights
```

---

# Part 3 — how sign-offs stay safe without being locked

This is the part that decides whether the redesign is better than what it
replaces, and it is where your instruction leads somewhere better than my earlier
answer.

I previously proposed that sign-off rights simply **cannot** be granted in the
panel — locked rows with a reason. That keeps the July incident impossible, but
it contradicts *"the authorisation panel as the only valid path"*, and it leaves
you unable to move a right you legitimately want to move.

**The better answer is separation rules.** Every right is grantable. What the
system holds instead is a short list of **pairs that must not sit on the same
role** — and the panel refuses the second tick, naming the reason.

| These two rights | Cannot sit on one role, because |
|---|---|
| `production.enter` + `inspection.perform` | nobody inspects their own output |
| `coa.draft` + `coa.review` | the analyst does not check their own certificate |
| `coa.review` + `coa.approve` | the certificate needs two signatures, not one |
| `shipment.load` + `shipment.release` | the person who loads does not release |
| `order.create` + `dc.approve` | not raising the order and approving its own delivery |
| `rights.manage` + any sign-off | whoever sets the rules does not also sign |

The last one answers the thing that worried me most in the current grid: the
Plant Manager holds Edit on Users & Access, and once the matrix is real that means
**he can grant himself anything**. Under a separation rule he can hold the
sign-offs or hold the rights panel — not both.

**What this buys you:** everything moves through the panel, nothing is locked
away in code, and the separations that make an audit survivable are written down
in one readable list rather than living as 115 role names scattered through a
file.

**And it is honest about the cost:** a separation rule can be removed too. It
should take the COO, and it should leave a record — the same treatment a
correction gets.

## The default is no

A new role starts with nothing ticked and sees nothing. Rights are added
deliberately. That is the reverse of today, where a new role can already see
twelve screens.

---

# Part 4 — the one thing you already fixed without code

> *"A Plant Manager can't raise a PO, and even if he can it should be a
> permission which we set, which we can remove."*

As of this afternoon that is true. New PO Entry follows the matrix, so the Plant
Manager raising a PO is now a cell you change, not a line somebody edits. **Set
it to View and he cannot raise one.**

That is the whole argument for the redesign in one example: the right answer is
not "who did we hard-code" but "what did we grant, and can we take it back".

---

# Part 5 — what it takes, honestly

This is a bigger piece of work than anything else on the list, and it touches
everything. The order that keeps it safe:

1. **Write the rights catalogue down and agree it.** Forty names, in plain
   language. No code. This is the piece that needs your eye, because a right that
   is named wrong gets granted wrong for years.
2. **Add the department layer** and put every existing role in one. Existing
   rights carry over unchanged, so nothing moves on day one.
3. **Key rights by role id, not name**, so renaming stops destroying them. Repair
   the two Supply Chain rows while doing it.
4. **Build the role-based table** — read-only first, showing what each role can do
   today, derived from the current gates. You will see the whole authority map
   before anything changes behaviour.
5. **Convert the gates to ask for rights**, one department at a time, each behind
   its own review. Production is the biggest and goes last.
6. **Turn on the separation rules**, once the rights are real.

Steps 1 to 4 change no behaviour at all. Step 5 is where it becomes live, and it
is the same rule as this afternoon: every conversion turns a dormant grant into a
real one, so the cells get reviewed before the code, not after.
