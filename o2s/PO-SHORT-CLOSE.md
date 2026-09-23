# Short-closing a PO — specification

*Ruled by Tahir Abbas, 23 September 2026. Written against `o2s.html` at
`BUILD_ID='2026-09-23b'`. Not built yet.*

---

## What it means

A PO is short-closed when the customer will not take the rest of it. Tahir's
definition, in his words:

> "A packed product will leave. PO can only close half means no further packing
> is required. If a product is produced as base, it's already free; but if a
> product is produced against a PO/brand, it will stay in stock until it leaves.
> Usually no PO gets closed for packed product. It's from unpacked or unproduced
> product."

So a short-close is **a stop instruction, not a reversal**:

| | |
|---|---|
| **Stops** | further production and further packing against that line |
| **Does not touch** | anything already packed — it stays allocated and still ships |
| **Does not touch** | base/bulk product, which is already free stock |
| **Does not touch** | anything already dispatched or delivered |

This matters for white-label especially: stock packed in a customer's own bag
cannot be freed to anyone else, so nothing tries to.

---

## Why the obvious implementation is wrong

There is no closed flag on an order or a line anywhere in O2S today. Completion
is derived:

```js
function lineStage(o,l){
  if(l.deliveredDate && (l.delivered||0)>=l.ordered-0.5) return 'Delivered';
  ...
}
function lineOverdue(o,l){ if(!l.committed || (l.delivered||0)>=l.ordered-0.5 || ...) return false; ... }
```

The shortcut is therefore to write `l.ordered = l.delivered` and let everything
else follow. **Do not.** It makes a 30,000 Kg order that shipped 18,000 read as a
30,000 → sorry, as an 18,000 Kg order fully delivered. The customer asked for
30,000. Erasing that is exactly the "tidy dashboard that hides the truth" this
whole system has been getting wrong, and Tahir explicitly ruled the shortfall
stays visible.

A short-close is a **new recorded fact**, not an edit of an old one.

---

## The record

On the **line** (a PO can be short-closed per product, not only whole):

```js
l.shortClose = {
  requestedBy, requestedAt, reason, reasonCode,
  approvedBy,  approvedAt,
  orderedAtClose, deliveredAtClose, packedAtClose,   // frozen, for the audit
  reopenedBy, reopenedAt                             // set if it comes back
}
```

Frozen quantities matter: the shortfall must still read correctly a year later
even if other numbers move.

### Reason codes

The reason decides the fulfilment treatment, so it is a list, not free text —
with free text alongside it.

| Code | Meaning | Counts against delivery performance? |
|---|---|---|
| `customer_cancelled` | customer withdrew the balance | **no** |
| `customer_reduced` | customer cut the quantity | **no** |
| `customer_no_uptake` | ordered, never collected | **no** |
| `our_shortfall` | we could not supply | **yes** |
| `material_unavailable` | RM never arrived | **yes** |
| `commercial` | price, credit or terms | **yes** |
| `other` | free text required | **yes** |

Default to counting against us. An unreasoned close should never quietly improve
the numbers.

---

## Who does what

Ruled 23 Sept: **anyone in Production, Supply Chain or Finance may request;
leadership approves.** Two people, like the customer-approval rule (C6).

| Step | Who |
|---|---|
| Request | Production, Supply Chain or Finance |
| Approve | Plant Manager or COO |
| Reopen | **COO only** |

Reopening is logged with who and when, exactly like the close. A reopened line
returns to whatever stage its quantities put it in — no special state.

New right codes, to be added with the six already owed:

- `po.shortclose_request`
- `po.shortclose_approve` — leadership only, `delegable:false`
- `po.reopen` — COO only, `delegable:false`

**Separation:** the requester must not be the approver, even where one person
holds both rights. That is a sixth separation rule and the first one that would
actually be able to fire, since both codes will exist from the start.

---

## What must refuse once a line is short-closed

| Action | Refuses? | Why |
|---|---|---|
| Produce against the line | **yes** | that is the point of closing |
| Pack against the line | **yes** | "no further packing is required" |
| RM Check / raise a PR | **yes** | no more material needed |
| Ship already-packed stock | **no** | "a packed product will leave" |
| Issue DC / Gate Pass / release | **no** | same reason |
| Mark delivered | **no** | same reason |
| Data Fix corrections | **no** | corrections must stay possible |

The refusal message names the reason and who approved it, so nobody has to go
looking: *"PO-2609-018 · Max Boron was closed short on 23 Sep by Fahim Asghar —
customer reduced the quantity. Packed stock can still ship."*

---

## What it looks like

**Tracker / line stage.** `lineStage()` gains one branch, placed BEFORE the
Delivered test so a partly-delivered closed line reads correctly:

```js
if(l.shortClose && l.shortClose.approvedAt) return 'Closed short';
```

`STAGE_ORDER` needs the new value, and `stageOf()` inherits it automatically.

**Overdue.** `lineOverdue()` returns false for a short-closed line — we are no
longer chasing it. Without this, every short-closed PO sits on the overdue list
forever, which is how people learn to ignore the overdue list.

**On the PO.** Ordered 30,000 · delivered 18,000 · **closed short 12,000** ·
reason · approved by, with the date. The gap is shown, never netted away.

**Waiting on the approver.** A requested-but-unapproved close appears in the
approver's My Actions, like every other pending sign-off.

---

## Reports

Ruled: shortfall shown, and excluded from fulfilment % **when the reason is
customer-side**.

- **Fulfilment %** — a line closed with a `customer_*` reason leaves both the
  numerator and the denominator. It was never ours to deliver. A line closed for
  any other reason stays in the denominator: we failed to supply it, and the
  number should say so.
- **Ordered volume** — unchanged. The customer did order it.
- **A new report:** short-closed lines by reason and by month. Without it this
  becomes a quiet way to make the fulfilment number look good, and the first
  person to notice that will be an auditor.

---

## Tests to write first

1. A short-closed line stops produce, pack and RM Check; the refusal names the reason.
2. A short-closed line does **not** stop shipping, DC, Gate Pass, release or delivery of stock already packed.
3. `lineStage` returns 'Closed short' for an approved close, and only for an approved one — a requested-but-unapproved close changes nothing.
4. `lineOverdue` is false for a short-closed line, and still true for an open one past its committed date.
5. `l.ordered` is never modified by a close — the frozen quantities carry the shortfall.
6. Fulfilment % excludes a `customer_cancelled` close and includes an `our_shortfall` one.
7. The requester cannot approve their own request.
8. Reopen is COO-only, restores the line to its quantity-derived stage, and is logged.
9. A reopened line becomes overdue again if it is past its committed date.
10. Nothing in the suite that passes today changes behaviour for a line with no `shortClose`.

Test 10 is the one that matters most: the overwhelming majority of lines will
never be short-closed, and none of them should notice this feature exists.
