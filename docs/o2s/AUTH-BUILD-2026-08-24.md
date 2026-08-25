# The authorisation redesign — first department built

VAN / O2S. 24 August 2026. **Approved on review. Not yet pushed.**

---

## What you asked for, and what is built

> *"Let me map one role in each department as function manager lead, and each
> function manager has people… which can have selected rights within production
> and packing as ticked and defined by the production manager… but we make sure
> the current system shouldn't stop working."*

Your four decisions are in the code:

| Your decision | How it works |
|---|---|
| The lead ticks, and it is live | The lead's tick is written and saved immediately. Every tick is logged with who and when. |
| Rights sit on the **role**, people are put into roles | One list per role. The panel shows how many people hold each role. |
| A lead **cannot** tick his own row | Only the COO can change a lead. This is the single thing that stops a lead quietly becoming a second COO. |
| **Commercial** first | Five rights converted. The other five departments are untouched and work exactly as before. |

---

## How "nothing stops working" is guaranteed — this is the important part

Every place in the app that used to say *"only a KAM may do this"* now asks a
different question: **"does this person have the right to raise a PO?"**

But the answer to that question is still, today, **the old rule, word for word**.
Each right carries a written record of the check it replaced, and until a right
is deliberately switched on, the app runs that old check. So converting the code
changed nobody's access, anywhere, at all.

That is not a claim — it is measured. The independent reviewer built the old
version and the new version side by side and compared the answer for every role
on every screen, across hundreds of scrambled settings: **327,290 comparisons,
zero differences.**

Then, separately: the ticks in the new panel were *filled in from those same old
rules*. So the day you switch a right on, nobody gains or loses anything either.
The app checks this itself and shows you a warning on the panel if any tick has
drifted away from what the app actually does.

**Switching a right on is a separate, one-line, reversible decision — taken one
right at a time, each with its own review.** Nothing is switched on yet.

---

## What you will see

A new **Authorisation** card on Admin · Master Data:

- A tab per department. Commercial has 5 rights; the others say "not converted
  yet — still governed by the access matrix, working exactly as today."
- Under Commercial: a grid of rights down the side, roles across the top, with
  the lead marked, the head count under each role, and a tick you can click.
- A tick you are not allowed to make is greyed and **tells you why when you
  hover** — "a lead cannot change his own rights", "belongs to Supply Chain",
  "already has DC approval — not raising the order and approving its own
  delivery".
- Rights marked **"not live yet"** (all five today) and ticks marked with an
  amber **\*** — set here, but not what the app does yet.
- A notice at the top telling you whether everything still lines up.

The five Commercial rights: raise a PO · answer print-on-pack · acknowledge a PO
· add a customer or dealer · change a customer record.

**Two of them are marked COO-only** and a lead cannot hand them out: the two
customer ones. Customer Master is still held back until the id work is done, and
that hold-back must not become something the KAM can delegate to his own team.

---

## Four things worth knowing plainly

**1. The panel does nothing for a lead yet, and that is not a bug.**
Commercial has exactly one role — KAM — so there is nobody for him to tick for.
And the KAM has no access to the Admin screen, where the card lives. So today
this panel is yours alone. It starts working for a lead the moment Commercial has
a second role (a Sales Officer, say) **and** you give the KAM access to Admin.

**Better next step:** Authorisation should be its **own screen**, not a card
inside Admin. Admin access also carries recipes, lab templates and product master
— you should be able to give a lead the rights panel and nothing else.

**2. Acknowledging a PO never had any check at all.** Anybody signed in could
acknowledge a customer's order. That is now a right — recorded honestly as "open
to everyone", so nothing changes today. Narrowing it is a tick, whenever you want.

**3. A role added later is now caught automatically.** Adding a role asks which
department it belongs to, and it gets its rights row immediately. A role sitting
in no department is shown in the panel with a way to file it, rather than being
invisible.

**4. One thing in my earlier note to you was wrong, and I have corrected it.**
I told you "Supply Chain" and "Supply Chain Officer" were two rows for one job
that "neither of you chose". The reviewer checked your action log. **Supply Chain
Officer was deliberately added on 22 June 2026** — there is no rename anywhere in
your history. Both roles were created on purpose. Whether both should exist is
still worth your decision, but it was a decision, not an accident. My apologies —
`docs/o2s/MATRIX-REVIEW.md` says the wrong thing and should be corrected too.

---

## The review took four rounds

It refused three times, and each refusal was right. What it caught:

1. A role created after go-live would have had no rights row — it would work
   until a right went live, then be silently cut off, with no screen able to fix
   it. And the customer hold-back had become a tick the KAM could hand out.
2. The check I built to prove "nothing changes" was never actually shown to
   anybody; and changing a matrix cell could drift the ticks away from reality in
   both directions, silently.
3. Unticking a right, then clicking an unrelated matrix cell for that person,
   silently put the untick back — no message, nothing in the log. And the grid
   showed the *old* answer rather than what you had just set, so a decision you
   made was invisible.
4. Approved, with one correction: point 4 above.

Along the way my own new tests caught two real bugs in my code — a permission
check calling a function with the wrong argument (which let everybody through),
and a role name with an apostrophe silently breaking its own tick button.

**856 checks pass.** 50-odd deliberate regressions were planted to confirm the
tests actually catch them.

---

## Where the files are

**The device connection to your computer dropped part-way through this work and
has not come back**, so I could not write into `E:\VAN-OP`. The files are
attached to this conversation instead:

- `o2s.html` — replaces `E:\VAN-OP\o2s\o2s.html`
- `authmodel.test.js` — new, goes in `E:\VAN-OP\o2s\tests\`
- `harness.js`, `rights.test.js`, `backlog.test.js`, `actioncenter.test.js`,
  `datafix-bulkprice.test.js` — updated, same folder

Your working tree also still holds the two earlier fixes (the six Data Fix
permission gates and the bulk "no price" confirmation) — those are in this same
`o2s.html`.

---

## What is next at your end

**1. Say whether to push.** The review approved it. It changes nobody's access
on the day it goes out — that is the whole design — so it is a low-risk deploy.
Nothing has been pushed.

**2. Commercial needs a second role for the lead model to mean anything.**
Is there one? A Sales Officer, an order-entry clerk, someone who works alongside
the KAM? Name it and I will add it.

**3. Which department next?** Supply Chain is the natural second — seven rights,
self-contained, and Zain's two role names get sorted on the way through.
Production is the biggest and is still blocked on one matrix cell: **QA Inspector
holds Edit on Production**, meaning he could enter the production he later
inspects. Set that to view and Production opens up.

**4. Two decisions that are yours alone:**
- Should the Authorisation panel become its own screen? (I think yes — it is the
  only way to give a lead the rights panel without also giving him master data.)
- Should "Supply Chain" and "Supply Chain Officer" both continue to exist?

**5. Still owed from your earlier list:** the KAM split (Account KAM from the
customer record, Entered by from the login) and the printing slip (needs the
fourth price option — customer sends bags already printed). Neither has been
started.
