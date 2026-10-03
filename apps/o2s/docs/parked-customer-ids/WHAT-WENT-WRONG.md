# Customer & dealer ids — parked, and why

VAN / O2S. 24 August 2026. **Do not restart this from the tests alone.**

---

## What we were trying to fix

`state.customers` (21 rows) and `state.dealers` (6 rows) carry no id on any row.

When two people save at the same time, the app merges the two versions. It can
only merge row by row if every row has an id. With no ids, the whole list is
treated as one lump and **the last person to save wins the entire list** — the
other person's work disappears with no error and no warning.

That is why Customer Master is still locked to KAM/COO. Widening it before the
ids exist would give four people a screen where they silently delete each
other's work instead of two.

The fix looked small: give every row an id. It was not.

---

## Attempt 1 — refused

Added the two back-fill lines and nothing else. The reviewer found that

* `custSave` rebuilds the customer as a brand-new object, so **editing a
  customer threw its id away**. On the next load the app minted a fresh id from
  the *new* field values, and one customer became two rows. 21 in, 22 out.
* `addDealer` and the seeder in `custInit` also created rows with no id.
* So the ids survived exactly until somebody used the screen — the fix was a
  no-op at best.
* Worse: while one browser has the new code and another still has the old one,
  the merge sees ids on one side and none on the other, and **deletes every row
  the other browser sent**. A case that is safe today would have become a new
  way to lose data.

## Attempt 2 — refused again, on something new

Fixed all four of those: id carried across an edit, id minted at all three
creation sites, one shared field list, and a guard on the merge so it only
takes the id path when **both** sides carry ids.

77 checks, all green, every one verified to go red when its fix was removed.
And it was still wrong.

### The blocking finding

The merge guard was written for customers and dealers. **But the merge function
is generic — it runs over the whole database.** The guard changed behaviour for
every list in the system, including `state.audit`, the change trail.

`state.audit` is *already* half-id'd today: **one** writer gives an audit row an
id; **23 others do not**. So the guard fires on the audit trail constantly — no
rollout needed, two ordinary users on the same version.

And in that case the guard makes things worse, not better:

| what happened | old behaviour | with the guard |
|---|---|---|
| you changed nothing locally | the other person's id-less rows were dropped | kept — **better** |
| you also changed something | their id'd rows were merged in properly | **all of their rows discarded** |

Real scenario the reviewer reproduced: the KAM edits a committed date on the PO
Tracker. In the same minute Supply Chain does an RM check *and* a PO Tracker
edit. The KAM's save collides. Under today's code Supply Chain's PO Tracker
audit row survives. Under the guard, **the whole of Supply Chain's audit delta
is thrown away** — and the screen says "Synced with the team's latest changes".

Our new tests did not catch it because they only tested the safe direction
(local unchanged). A comment in the app also claims that one writer is "the only
one that adds audit rows during a session" — that comment is simply false, and
another comment six lines below it contradicts it.

### A second, independent finding

Customer **codes** are generated from a *count*, not a key
(`DLR-…-{dealers.length+1}`, `100 + count of that segment`). Two people creating
a customer at the same time therefore mint the **same code**. Today the merge
collapses the list and one of them quietly vanishes — bad, but the code stays
unique. With ids, **both rows survive under one code**, and every screen looks
the customer up by code. The second one can never be opened, edited or
corrected, and there is no delete. It just sits in the list and in New PO Entry
forever.

Aggravating: `dlrForm` is never populated — the two functions that would set the
region and city (`onDlrRegion`, `onDlrCity`) have **no callers anywhere in the
file**. So every suggested dealer code comes out as `DLR-PB-XXX-NNN` and differs
only by the sequence number. Maximum collision surface, on the one segment the
screen exists to serve.

### Test gaps found by mutation testing

31 planted regressions, 27 caught, 4 survived:

1. Deleting the dealer back-fill line entirely — **suite stays green.** The one
   that matters.
2. Removing the duplicate-suffix counter in `ensureIds` — green, because the
   16 July snapshot happens to have no collisions. The "ids are unique" check
   was passing for the wrong reason.
3. Shrinking the id field list to `['code']` — green, because the test reads the
   list out of the app. Nothing asserts the fields are *adequate*.
4. Re-adding the deleted "Set all to no price" button with different quote marks
   — green. (That one is in the shipped file; noted in OPEN-ITEMS.)

---

## What is parked

Reverted out of the working tree on 24 August:

* `CUST_ID_FIELDS` / `DLR_ID_FIELDS`
* the two `ensureIds` lines for customers and dealers in `ensureRecordIds`
* the merge guard `(srv.length===0 || _arrId(srv))`
* id-minting in `custSave` (new + edit + dealer mirror), `addDealer`, `custInit`

Kept, because the review verified them clean and they are independent:

* the six Data Fix permission gates
* the bulk "no price" confirmation and the deleted button

The tests for the parked work are in `PARKED-customer-ids.test.js` in this
folder. They are good tests. They are not enough tests.

---

## What a third attempt has to do FIRST

In this order. Steps 1–3 are not optional.

1. **Do not touch the generic merge.** Either fix the id path so it *keeps*
   id-less rows from the other side instead of deleting them, or apply any
   guard per-list rather than to the whole database. Whichever is chosen, the
   test must cover the case where **both** sides changed, not only ours.
2. **Give `state.audit` an id at every one of its 24 writers, or none.**
   Half-id'd is the worst of the three states, and it is what we have. Correct
   the false comment above the one writer that does mint an id.
3. **Make customer codes unique by construction, not by counting.** A code
   minted from a count collides the moment two people work at once. Until that
   is fixed, ids turn a silent deletion into a permanent unfixable duplicate.
4. Then, and only then, the id back-fill — customers and dealers together, with
   a test that runs `ensureRecordIds` itself for **both** arrays.
5. Then Customer Master can come off `hardRole(['KAM'])` and follow the matrix.

## What it costs to leave it parked

Two people on Customer Master at the same time still overwrite each other. That
is why the screen stays locked to KAM and the COO — the lock is the mitigation.
Nothing else in the system is affected.
