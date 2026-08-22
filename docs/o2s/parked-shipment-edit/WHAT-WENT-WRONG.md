# The shipment edit change — parked, not pushed

**22 August 2026.** This folder holds work that was built, reviewed, and stopped
before it reached the app. The app file in the repo is untouched and matches what
is already live.

**Do not copy `o2s.html.WORK-IN-PROGRESS` over `o2s/o2s.html`.** It contains the
faults listed below.

---

## What we were trying to fix

A shipment has two ways to be changed.

The proper way asks you to pick a reason and write a sentence, and keeps a record
of what the value was before. The other way, which has a button on the Shipments
screen, changed nine things about a shipment including **how many kilograms went
on a truck that has already been delivered** — and asked for nothing. No reason,
no record of the old value, and it logged the job title rather than the person.

Tahir's decision: once a load has been delivered, its quantity and its DC number
stop belonging to Supply Chain and pass to the Plant Manager, and only with a
reason written down.

That was built. Then two independent reviewers, who had not written any of it,
were asked to break it. They did.

---

## What the reviewers found

Both reviewers found the same top three faults, working separately. That is what
makes them worth trusting.

### 1. Correcting one truck would have inflated the order and then double-counted it

A load is recorded as 1,000 Kg but was really 900. The Plant Manager corrects it.

The order line jumps to **1,400 Kg dispatched** instead of 900, because another
truck sitting in the yard waiting for approval got counted as though it had
already left. When that truck is approved a week later, its quantity is added
**again**. The order ends up claiming nearly twice the material that actually
moved. Remaining-to-ship goes negative, and stock still sitting on the racks
disappears from Ready to ship.

Nobody sees an error. The correction register records the wrong number as though
it were intended.

### 2. It picks the wrong line when a PO orders the same product twice

**Two POs in the live data do this today** — 22032 and 22033 both carry Max
Sulfur twice. Correcting a shipment on one of those lines writes the combined
total onto whichever line happens to come first and leaves the other frozen.
Both lines end up wrong, and neither says so.

### 3. On a truck carrying several products, it acts on the wrong one

Fix the quantity on the third product and the system sends you to correct the
**first** one. A hurried person types the number into the box in front of them
and files a properly-reasoned correction against the wrong product.

Worse: a truck can be part delivered, some products arrived and some did not.
Opening the edit screen on such a truck reads the status of the first product
only, and saving **wipes the delivery off the ones that did arrive** — with no
reason asked, because the system did not notice anything had changed.

### 4. One field was missed entirely

The focal person, the name of whoever receives the load, prints on the delivery
challan. It can still be overwritten with no reason at all, and the log records
that the previous value was blank when it was not.

### 5. Closing one door removed the safety checks with it

The old screen refused a delivered date in the future, refused one earlier than
the dispatch date, and warned if a DC number was already in use. The new route,
which is now the only route, does none of that. A load can be recorded as
delivered next March, with a written reason attached making it look deliberate.

### 6. One account is left with nowhere to go

There is a real account in the live system called **Supply Chain Officer**. It
can open the edit screen but holds no authority on any shipment field. It gets
told the change needs a reason, then told it has no authority to give one, and
everything typed is thrown away. There is no third door and nothing on screen
says who can help.

---

## Faults that are already live, found along the way

These are not caused by the parked change. They are in the app now.

- **Reversing a shipment does nothing.** The button exists, it asks for a reason,
  it says "reversed", and the shipment stays on the truck, stays counted, and
  keeps printing. A written reason now sits in the register describing something
  that did not happen.
- **The delivery gates can be walked around.** A truck that has not passed
  pre-shipment inspection, or is waiting on DC approval, is refused by Confirm
  delivery and by Mark delivered — but can be set to delivered through the edit
  screen, which checks none of it.
- **A refused correction keeps the changes made before the refusal.** Change two
  values, have the second one refused, and the first is already written to the
  record with nothing in the register explaining it.
- **PO 21775, Max Amino.** Two 300 Kg delivered shipments sit against a line that
  says 300 dispatched on a 300 Kg order. The moment anyone corrects either one,
  the line will read 600 against 300. Worth looking at before it is touched.

---

## What this tells us about testing

There were 130 passing checks over this change when the reviewers were called in.
Every fault above was outside them. The checks tested a single-product truck and
never ran the save path end to end, so the multi-product faults could not appear.

One check was even asserting the wrong thing: it was named "no longer claims an
empty before value" while actually confirming that the false "(blank)" was still
being written.

**A passing test says the thing you thought of works. It says nothing about the
thing you did not think of.** That is what the reviewer is for.

---

*Parked 22 August 2026. Module: O2S. Nothing from this reached the app.*
