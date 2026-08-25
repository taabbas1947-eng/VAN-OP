# Supply Chain — the second department

VAN / O2S. 25 August 2026. **Approved on review. Not yet pushed.**

---

## What is built

Six Supply Chain rights, converted the same way Commercial was — the app answers
exactly as it did before, and switching a right on is a separate decision:

| Right | What it is |
|---|---|
| Plan a shipment / raise a DC | Create and edit a dispatch |
| Start loading a truck | Move a planned truck into loading |
| Issue a Gate Pass | Needed before the truck can be released |
| Confirm a delivery | Record that the customer received the load |
| Receive raw material against a PR | Only after the CFO has approved it |
| Close a purchase requisition | End a PR that is finished or abandoned |

**Approving a delivery challan, rejecting one, and releasing a loaded truck are
deliberately NOT here and never will be.** Those are second signatures — one
person checking another's work — and they stay locked in code. That is the
30 July incident, and it stays impossible.

**Nothing changes on the day this goes out.** The reviewer built the old and new
versions side by side and compared every role on every screen across thousands of
scrambled settings: **2,397,600 comparisons, zero differences.**

Zain's two role names both sit in the Supply Chain department, so one lead covers
both without anything being renamed or merged.

---

## What this uncovered — and it matters more than the conversion

Supply Chain's gates asked a question none of us would have written down: **"does
this person have Edit on whatever screen they happen to be looking at?"** Not
"can they do this job".

That has a real consequence today, before any of this:

> **A QA Inspector standing on the Production screen can receive raw material
> into stock and close a purchase requisition.** The Supply Chain officer
> standing beside him cannot.

The reason: Production's "stuck / blocked" list is not filtered by role — it
shows everybody's stuck items, with live buttons. The QA Inspector holds Edit on
Production, so the old rule says yes. Supply Chain does not hold Edit on
Production, so it says no. Nobody chose either answer.

The new panel now names this on screen, so it is a decision you take rather than
something that quietly stops working:

> *1 role can do this work today only because of another screen. QA Inspector —
> 2 rights, via Production.*

**Your one-cell fix:** setting QA Inspector's Production access to view closes it.
That is the same cell that has been blocking the Production conversion since
22 August.

### Two more on the same list, which I have NOT touched

The reviewer went looking for worse on that same unfiltered Production list, and
found two:

1. **A QA Inspector can CFO-approve a purchase requisition** from there. Approving
   a PR is worse than closing one.
2. **Raising an RM Check and a PR has no permission check at all** — any role that
   can open the Production screen can do it. That is KAM, Lab Rep, Finance,
   Production, anyone.

Both belong to the Finance and Quality conversions, so they are on the list, not
in this change. But you should know they are there.

---

## The review took four rounds again

Refused three times, all three correct:

1. `Close PR` reaches the Production list too — I had recorded only `Receive`, so
   the panel said "1 right" when it was 2. **Under-warning**, which is the worse
   direction.
2. I wrote in a comment that My Actions only ever shows you your own items. It
   does not — it also shows a manager the items escalated *to* him, with the
   original owner's live button. That was a false statement in a file you read.
3. Before that: the panel opened by telling you nothing would change and then
   immediately listed eight people who would; and of those eight, six were not
   true at all — no such button is rendered anywhere they can go. A warning that
   is mostly false is worse than none, because the safe-looking response is to
   grant six roles a shipment right they have never had.

The fourth round approved it, with one correction: I had written that these
buttons appear on four screens including the Dashboard. The Dashboard's to-do
list has no callers — it is three screens. Corrected.

**3,261 checks pass.** The `alsoOn` list (where each button is really reachable
from) is now checked against the app's own tables rather than my memory, so the
same drift cannot happen on the next department.

---

## What is next at your end

**1. Push?** Same as last time: it changes nobody's access on the day it goes out.

**2. Set QA Inspector's Production access to view.** One cell. It closes the
raw-material hole above *and* unblocks the Production conversion, which is the
biggest remaining piece.

**3. Add the Sales Officer.** You said an order-entry clerk can exist. Admin ·
Master Data → Roles → type the name, pick **Commercial**, Add. It gets its rights
row immediately, and the KAM can then tick for it — once you also give the KAM
access to the Admin screen, which is where the panel lives for now.

**4. Which department next?** Quality is the natural third — Lab Rep, AQCM, QCM
and QA Inspector are four roles doing one job, which is where the department
layer pays off most. But it is nearly all sign-offs, so it will be slow and
careful. Production is bigger and opens up the moment you set that one cell.

**5. Still owed from the older list:** the KAM split (Account KAM from the
customer record, Entered by from the login) and the printing slip (needs the
fourth price option — customer sends bags already printed).
