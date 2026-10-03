# PD — team review of the new procedure, 19 August 2026

_Five responses, circulated by Tahir. Verdict: **unanimous agreement on the spine.**
No dissent, no request to change the procedure. Two responses carry **new
requirements the model does not currently meet**; one is an unprompted request for
something designed the day before._

**Attribution note.** Names and roles are as given by Tahir. Spellings are his;
two are likely shortened (`Himmayt`, `Abdullah naved`). **The "knowledge retrieval
layer" paragraph is attributed here to Maleeha** on the basis of where her name
falls in the source text — Tahir to confirm, and to supply her role.

---

## 1. What each person said

**Fahim — Plant Manager.**
> "I cant agree more. And technical gaps or requirements would emerge i believe
> while working on the platform."

Agreement, plus the most honest line in the review: **the requirements are not all
knowable now.** Read as a vote for starting small and letting the rest surface.

**Himmayat — R&D Manager.**
> "I agree with the procedure. My suggestions are to keep the objective very clear
> for each trial and allow flexibility for lengthy trials, especially for chemical
> reaction-based products, where achieving the required quality and stability may
> require more time and testing."

Agreement **plus two requirements** — see §2.1 and §2.2. This is the response that
changes the design.

**Maleeha.** _(role to confirm)_
> "Genuinely a well-designed PD system that can save unnecessary effort and expense
> on samples unless an idea answers every question asked. While working on a few
> ideas last week, I noticed we are lacking a knowledge retrieval layer or an ideas
> bank at this stage, which can tell us what we have already learned about a problem
> across every bet we have run against it. So if I have an idea, I should have a
> place to look back and see whether the idea has been tested and why it was
> rejected or parked, to avoid duplication and narrow down the thoughts."

**She asked for the Combination Bank without having seen it** — she hit the problem
last week, working on real ideas. But her ask is **broader than what was designed**:
see §2.3.

**Abdullah Naveed — Lab and R&D Officer.**
> "I really like the core idea. Having a clear question before making a sample, and
> documenting what we learn afterward, can save a lot of repeated work. Overall, I
> think this is a good direction, and I'm looking forward to seeing how it works
> with a real question."

Agreement, and a direct vote for the **paper pilot** — run one real question first.

**Masab — Lab In-charge.**
> "The proposed procedure is a valuable step toward evidence based PD, as it
> connects every laboratory trial with a clear purpose and documented outcome. It
> presents a practical and well organized approach that can improve coordination
> among R&D, QC, Plant, Agronomy. Written conclusions for every trial will reduce
> repeated trials, improve accountability, preserve technical knowledge and make PD
> decisions more transparent, traceable and reliable."

Agreement, and confirmation that the **written-conclusion rule** is understood as
the point, not as paperwork. He also names **cross-function coordination** as a
benefit — R&D, QC, Plant, Agronomy — which is a use the design should not break.

---

## 2. What the review actually changes

### 2.1 REQUIREMENT — long-running trials must not read as failure

**Raised by:** Himmayat.

`MODEL.md` §3 describes a **Run** as *"one recipe made and measured. **Fast, many per
Bet.**"* That is true for a blend screen. It is **false for a chemical-reaction
product**, where stability and quality data accumulate over weeks or months.

Two things break as designed:

1. **The scoreboard punishes honest work.** `MODEL.md` §5 makes "What I owe" the only
   scoreboard, and *"late shows as late."* A twelve-week stability trial would sit
   there looking late for eleven weeks. People do not tolerate a board that calls
   them late for doing the work properly — **they stop using the board.**
2. **There is nowhere to put an interim reading.** A long Run has readings at day 7,
   30, 90. The model has `expected` / `actual` / `read` on a Run, which fits one
   measurement, not a series.

**What is needed (for Tahir's decision, not Claude's):** a Run that can be declared
long-running at the point it opens, carrying its own expected duration, holding
**dated interim readings**, and reading as **"running, next reading due X"** rather
than late. Lateness should attach to *a reading that did not happen*, never to the
elapsed life of the trial.

### 2.2 REQUIREMENT — the objective of each trial must be visible on it

**Raised by:** Himmayat, and echoed by Abdullah and Masab.

The model already carries this in principle: a Bet cannot exist without its kill
criterion, a Question has an owner. But **"keep the objective very clear for each
trial" is a request about what a person sees on the trial itself** — not about what
the schema stores. Whatever a Run looks like on screen, the question it answers and
the result that would kill it must be **on that screen**, not one click away.

Cheap to honour if designed in now. Expensive to retrofit.

### 2.3 CONFIRMATION, with a widening — the ideas bank

**Raised by:** Maleeha, unprompted, from real work last week.

Her ask matches the Combination Bank on the duplication half — *"whether the idea has
been tested and why it was rejected or parked"* is precisely what the Bank's killed
and parked records exist to answer.

**But the first half of her sentence is wider than the Bank as designed:**

> *"…tell us what we have already learned about a problem **across every bet we have
> run against it**."*

The Bank is keyed to **combinations**. She is asking for a view keyed to the
**problem** — everything tried against it, every Bet, every Run, and what each one
taught. That is the Problem joined to its Claims, Bets, Runs *and* combinations, on
one page. Call it a **problem dossier**.

It is not a new object. It is a **read view across objects the model already has**,
and it is arguably the most valuable screen in the system — but `MODEL.md` §5 says
there are only two screens. **Does the dossier become the third, or is it a section
of the Problem record?** Tahir's call.

---

## 2.4 Maleeha's follow-up — the most useful answer in the review

_Verbatim, 19 August 2026, in response to "which idea, and what did you want to look
up?"_

> "I have been working on co-granulating a fast-release and a slow-release phosphorus
> source together, with an anion introduced between the two phases specifically to
> compete for the same calcium-binding sites phosphate would otherwise fix onto,
> reducing fixation instead of just timing around it. Alongside this, I was also
> exploring how global manufacturers approach the same problem, coated-release and
> fused co-granulation techniques, mainly to understand where the industry has already
> gone, not as a separate idea I was pursuing.
>
> I wanted to look up whether any part of this — a dual-phase P source, a competing
> anion, or a fused/coated architecture — had already been tried here, and what came of
> it. I wanted our own history before deciding which piece of the idea was actually
> worth developing further, rather than rebuilding that picture from outside
> literature.
>
> If one person could have answered in a single line, it would have said:
> **'We tested [technique] on [ingredient/combination] and found [result]'** or,
> **'we've never tested this specific combination.'**
> One line like that would have told me which part of the direction was already known
> ground and which part was open, before I spent time researching it externally."

**What this proves about the design.** She searched for a **technique**, an
**architecture** and a **mechanism**. The Combination Bank stores materials, grades
and percentages. **It would not have answered a single one of her three questions.**

Four requirements follow, now recorded as `PENDING-DECISIONS.md` **B9–B12**:

| # | What her answer forces |
|---|---|
| B9 | A **technique axis** — blended · co-granulated · fused · coated · layered · reacted. **And it corrects a written rule:** `RULES.md` §7.1's five-signal hard stop would wrongly block a co-granulated version of an existing blend. Technique must be a sixth signal. |
| B10 | A **role and phase** on every material line — "competing anion, interlayer" is the information; "ZnSO₄ 3%" is not. |
| B11 | A **mechanism tag** — *"reducing fixation instead of just timing around it"* is the difference that matters, and no problem tag captures it. |
| B12 | The search must **answer in a sentence**, including the honest negative, and must show **ours vs the world's** separately. |

**And a change of emphasis.** She searched *before deciding what to develop*, to
narrow her own scope. The Bank has been designed mainly as a duplicate check at the
moment of saving. Her use is the more valuable one: **search before the work.** The
entry-time check is a by-product of the same index.

**The cost of not having it, in her own words:** she went to external literature to
rebuild a picture VAN already owns. That is the expense this system exists to stop —
not wasted samples, wasted *thinking*.

---

## 3. What this review does not prove

Worth writing down while the agreement is fresh.

- **Nobody objected.** Five for, none against, no material criticism. That is a
  strong signal, but agreement with a *principle* is cheaper than agreement with a
  *procedure you have had to follow.* The people who will find the real friction are
  the ones who have not used it yet — Fahim said as much.
- **Only Maleeha's comment is grounded in the work.** She hit the gap last week on
  real ideas. The rest is assent to a good idea, which is not the same evidence.
- **The strongest recommendation in the review is to test it, not to build it.**
  Abdullah wants to see it "work with a real question"; Fahim expects gaps to emerge
  in use. Both point at `PENDING-DECISIONS.md` **B5 — run one live question on paper
  first.**

---

## 4. Status changes

| Item | Was | Now |
|---|---|---|
| `PENDING-DECISIONS.md` B1 — team review | Waiting | **Landed. Approved, no changes to the spine.** Moved to §D. |
| Long-running trials | Not in the model | **New requirement — B6.** |
| Objective visible on the trial | Implicit | **New requirement — B7.** |
| Problem dossier view | Not designed | **New requirement + open question — B8.** |
| Combination Bank | Tahir's idea | **Independently requested by the team.** |

**None of these change section A.** The three schema-blocking decisions — do the
gates survive, is a Combination a tenth object, is cost in or out of PD — are
untouched by this review and still gate any code.
