# Short-closing a PO — specification

*Ruled by Tahir Abbas, 23 September 2026. Written against `o2s.html` at
`BUILD_ID='2026-09-23b'`.*

## Build status

| | |
|---|---|
| **Built, 23 Sept** | the model, the guard, the five gates, the tracker stage and the overdue rule — 39 checks in `tests/shortclose.test.js`, suite at 7,319 / 0 |
| **Not built yet** | the request/approve/reopen actions, the three right codes, the UI, the My Actions item for the approver, and the report treatment |

No `BUILD_ID` bump and no changelog entry for the engine: nothing a person can
see has changed, because there is no way to create a `shortClose` yet. Both come
with the UI, so the announcement matches what people can actually do.

**One scope decision taken during the build, and worth knowing.** The spec said
production refuses. In the code, `submitShiftLog()` records a shift that
physically happened — so it is deliberately **not** guarded, along with Data Fix.
Blocking an honest record of real work is exactly the behaviour this system is
trying to end. What is guarded is new forward work: packing, diverting,
allocating free stock onto the line, and raising more material.

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

---

## Closing a tiny remainder without the Plant Manager (built 29 Oct 2026, build 2026-10-29c)

*Ruled by Tahir Abbas, 29 October 2026 (decision D-348, rule R-048). This is a
second route to the same `l.shortClose` record. The 23 September route above is
unchanged for every line that is not a tiny remainder.*

**The rule.** A PO line with 50 Kg or L or less left may be closed short at once,
with no Plant Manager step, by Supply Chain (Saad Jamal), Finance (Muhammad
Ismail) and Warehouse (Muhammad Shoaib). The right is held by the role, not by
the person. Supply Chain Officer (Zain), CFO and Finance Desk Officer do not hold
it. The Plant Manager is not told.

- **"Left"** is ordered minus delivered. A line with nothing delivered counts.
  There is no limit per PO. The number 50 is fixed in code (`tinyLimit`), not a
  setting.
- **Reasons** are the same 8 as the normal close.
- **The record** is the same `l.shortClose`, with `tinyRemainder:true`,
  `tinyLimit:50`, `leftAtClose` and `approvedBy` set to the person who closed it.
  The frozen quantities (`scFreeze`) carry the shortfall, as on the 23 Sept route.
- **Who is told:** a one-time "New for you" card on Today for the 3 roles, a
  "Small remainder." note in My job, and Guide rule R-048. No group message.

**What refuses it** (`tinyRefusal`, checked in this order; the person gets the
sentence, nothing is written):

1. line not found
2. already closed short
3. a request for a normal close is waiting (the Plant Manager decides it)
4. nothing open
5. the line was ever refused or reopened (on the line or in its history): a new
   request goes to the Plant Manager
6. more than 50 left (50.01 is refused, and shown as 50.01)
7. the PO is under 7 days old, counted in calendar days from the day it was
   received, Pakistan time (`SHORTCLOSE_TINY_MIN_DAYS`; a PO with no readable
   received date is not held back)
8. stock already made and not yet delivered (the larger of produced, packed and
   dispatched, less delivered, above 0.5): let it ship first
9. an open raw-material purchase request on the line (Tahir: keep this block)

**Stale screens.** The 7-second background sync is paused while a window is open,
so the close window re-reads the server first (`tinyFresh`) and checks the
figures again (`tinyConfirm` then `tinyShortClose`). If the left figure moved
since the person opened the window, they are asked to read it again. If the
check cannot be made, nothing is closed. Cancel, or a tap outside, while it
checks closes nothing, and the check gives up after 15 seconds.

**Why not.** For a line of 50 Kg/L or less that the person's role could close
but the rules refuse, the screen shows the reason in place of the button
(`tinyWhyNot`, drawn by `closeLineButtonHTML`).

**Known and left (tell Tahir):**

- Reopen (added 29 Oct): the COO alone sees "Reopen this line" on the order sheet
  for a line closed short (`reopenLineButtonHTML`, `openReopenClose`,
  `reopenConfirm`, then `reopenShortClose`). A reason is required, the latest
  figures are re-read first, the close stays in the history (reopenedBy,
  reopenedAt, reopenedWhy) and the log and audit row carry the reason. A reopened
  line cannot be closed the quick way again.
- Production is not told, the Inspect job is not kept, and a new batch can still
  be opened for the line.
- "Asked by" and "Approved by" are the same person on this route.
- If two people act on the same line at the same moment the record can mix their
  names.
- Finance and Warehouse hold no right to ask for a normal close.
- The frozen shortfall stays as recorded if stock is delivered late.
- The older normal-window sentence about "delivery performance" is untrue and was
  left as it was.

- Review round (29 Oct): a small new order can be closed at once once the PO is 7
  days old (no limit per person, KAM and Sales not told); the open raw material request
  refusal blocks a common tiny remainder and invites a false RM received tap; a
  truck keyed late, or output not yet logged, is not seen by the stock-made check;
  two people within seconds can mix a record and lose the first audit row; closes
  do not enter On-time %, and Fulfilment % drops every closed line; the run sheet, Stuck decision
  and Running batch pages still ask the Plant Manager for a small line; a stale
  ask for a normal close sent after a tiny close can overwrite fields of it; a
  delivery landing between the check and the save stays under the close.

Finance and Warehouse can open the Closed short report (added 29 Oct).

Third review round (29 Oct): a reopened line gets its Pack job back; the Closed short
report keeps an earlier close that was reopened and replaced; the refusal and the
Ask and approval windows name who reopened a line, when and why. Left, to tell
Tahir: C2M used to read a reopened line as closed; fixed in C2M on 29 Oct (C2M D-136,
commit e5611ab; a reopen reaches C2M after its next Pull now); nobody is told of a reopen and
the reopened line's jobs age from the PO's received date; the COO gets no notice of
a tiny close; late packing is refused on a closed line; a backdated received date
skips the 7 day rule; small farmer orders qualify after 7 days.

Tests: `tests/tinyclose29c.test.js` (334 checks).
