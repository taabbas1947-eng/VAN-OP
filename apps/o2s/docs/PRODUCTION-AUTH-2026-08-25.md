# Production authorisation — built, reviewed, ready
**25 August 2026 · five rounds of independent review · approved**

## What you asked for

> "Let me map one role in each department as function manager lead and each function
> manager has people… production manager lead and he could have 5-10 people which can
> have selected role within production and packing as ticked and defined by the
> production manager… but we make sure the current system shouldn't stop working."

Commercial and Supply Chain are done. This is **Production**, the third and last.

## What changed

Production's permissions used to be one hard-coded rule repeated in 25 places:
*"is this person the Production role?"* If yes, every button. If no, none.

Those 25 places now ask for **ten named rights** instead:

| Right | What it lets someone do |
|---|---|
| Open a batch | Start a new production batch |
| Enter produced quantity | Log output against a batch |
| Log a shift | Record a shift's output |
| Pack cleared stock | Pack material the lab has cleared |
| Reconcile the remainder | Account for what is left after packing |
| Call a by-product for manufacturing | Bring a by-product pool back in |
| Divert material | Move a pool to another use |
| Send a pool for rework | Production-side rework of a pool |
| Close a batch | End production, fix the produced quantity |
| Close settled batches in bulk | The same rule, in bulk |

**Nobody's access changes today.** Every one of those rights currently answers with
exactly the old rule, for every role, on every screen. The reviewer proved it by
running every gate for all twelve roles across all fifteen screens — 7,995 checks,
no differences — and by rendering the whole Production screen from both the old and
the new file and comparing them character by character. Not one byte moved.

## How you make the split

1. **Admin · Master Data → Authorisation.**
2. Add a role, e.g. **Production Manager**, and file it under Production.
3. There is now a **"change lead"** dropdown on each department. Point Production at
   the Production Manager. (COO only.)
4. Tick the head-level rights against him — closing a batch, reconciling, bulk close
   — and leave the floor rights with the floor officers: logging shifts, entering
   produced quantity, packing.
5. Each tick shows as **pending** until you switch that right live. Nothing changes
   until you do.

Once you do split them, the screen follows: a floor officer who may only log shifts
sees the **Log output** button and no longer sees Pack, Reconcile or Close batch. The
Production Manager sees Close batch and Reconcile and not Log output. That is tested
by actually drawing the screen for two invented roles, not by reading the code.

## The one thing the app will NOT do for you

When you split the roles, the app will stop somebody closing a batch without the
right. It will **not** stop you giving the *same* role both **closing** and
**reopening** a batch.

Reopening is deliberately not one of these rights — it stays the Plant Manager's
second signature, hard-wired, so it can never be handed out by a tick. But that also
means nothing in the app objects if you tick "Close a batch" for the Plant Manager
himself, and then one person both ends production and can undo it.

That pairing is your judgement, not the app's rule. Worth deciding before you start
ticking.

## What else is in this build

- **Opening a batch had no permission check at all** on the Submit button. The only
  guard was the button being drawn greyed out. It now asks for the right properly.
  Nobody loses anything — every way of reaching that button already needed it.
- **Archiving a role that leads a department is refused.** It used to be the way
  round the rule that stops you moving a lead out, and it left a department pointing
  at a role nobody could hold.
- Two small display faults: the lead dropdown offered archived roles it would then
  refuse, and two messages printed `&amp;` instead of `&`.

## Not fixed, and you should know

Production's **"Stuck / blocked"** list is not filtered by role. A QA Inspector
standing on the Production screen can **receive raw material**, **close a purchase
requisition**, and **CFO-approve a PR** — none of which are his job, and the Supply
Chain officer beside him cannot do the first two. Separately, raising an RM check /
PR has no permission check at all.

This is live today and is not something this change caused. It is the next thing I
would fix.

## The numbers

Ten test suites, **5,839 checks**, all green. Five rounds of independent review, each
one with the authority to refuse — and each of the first four did refuse, on:

1. Three pending fixes (round 0)
2. A comment claiming ten rights were twelve, and a comment asserting a permission
   check that did not exist
3. A crash I introduced that would have frozen the Production screen's "Waiting QC"
   tab for everyone, and stayed frozen until a page reload
4. A comment naming the wrong buttons
5. — approved

The crash is worth a sentence: no test caught it, because the July test data happens
to contain no batch waiting for a lab certificate. There is now a test file that
loads the whole app and renders every tab for every role with data in every tab.
