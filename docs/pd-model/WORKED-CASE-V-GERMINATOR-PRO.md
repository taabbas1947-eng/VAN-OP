# Worked case — V Germinator Pro stability, told by Himmayat

_Recorded 20 August 2026. Himmayat (R&D Manager) answered "take one reaction-based
product you are working on now — how many weeks, and what do you measure on which
days?" with a full account of a live trial. **This is the first real end-to-end test
of the nine-object model against actual VAN work, and it is worth more than any
designed scenario.**_

---

## 1. What happened — his account

> One example from our current R&D work is **V Germinator Pro**. The initial idea was
> to develop a product providing 100% nutrition, containing NPK along with Fe and Mn
> in trace amounts. The R&D team developed the product, and after final approval from
> the Plant Manager, the approved formulation was placed in the relevant product
> development file.
>
> Initially, the sample appeared stable, with no settling or visible degradation. It
> was therefore placed under observation for stability testing. However, **after
> approximately one month white material was observed settled at the bottom** of the
> sample bottle. Analysis showed that the material was related to the **source of K₂O
> (SOP)** used in the formulation. The settling was also associated with a **reduction
> in the measured K₂O content**.
>
> We then **replaced the potash source with KOH**. This resolved the settling issue,
> but introduced another problem: **nitrogen content decreased due to ammonia gas
> formation**. KOH was subsequently **replaced with potassium carbonate**. This
> resolved both the ammonia formation and the K₂O settling issue, and the product was
> again placed under stability observation.
>
> During this period, we received a **complaint from one of our vendors that the seals
> of Tornado bottles were leaking**. Investigation showed that **fermentation** was
> occurring in the product. Since **molasses is also present in V Germinator Pro**, we
> considered fermentation as a potential stability risk for this product as well.
>
> Our initial hypothesis was that **fermentation should not occur at such a low pH**.
> However, when a sealed V Germinator Pro bottle was placed under observation for
> several days, **the bottle seal was found to be swollen — confirming that
> fermentation could occur despite the low pH.**
>
> The product is therefore currently under further stability observation to identify
> the source of fermentation. The main hypotheses being investigated are **molasses
> and amino acids**.

### And what he says the system must do

> This trial demonstrates why a long stability test cannot simply be treated as a
> 12-week waiting period. The system should show the **trial status, current week,
> observations, analytical results, deviations/issues, hypothesis being tested, and
> next planned action** at each stage.
>
> For example, in Week 3 the system should clearly show that the sample is under
> stability observation, which parameters have been checked, whether any physical
> changes have been observed, and what the next observation date is. **If an
> abnormality occurs — settling, ammonia formation, seal swelling, or fermentation —
> it should trigger an investigation rather than simply waiting until the end.**
>
> In this case, **the long trial did not fail because someone stopped waiting.** It
> exposed successive chemistry and formulation issues — first K₂O source settling,
> then ammonia formation, and finally possible fermentation. Each observation led to a
> formulation change and another stability cycle. **This is exactly why stability
> testing needs to be treated as an active, documented monitoring process, rather than
> just a fixed waiting period.**

---

## 2. What this case proves — nine findings

### 2.1 A Run is a chain, not an event
`MODEL.md` §3 says a Run is *"one recipe made and measured. Fast, many per Bet."*
This case is **three formulations in one continuous line of investigation** —
SOP → KOH → potassium carbonate — each one existing *because* the previous one failed,
each triggering a fresh stability cycle.

**Requirement:** a Run must be able to name the Run it replaced, and why. Without that
lineage the record shows three unrelated trials and loses the only thing that makes
them intelligible — that each was caused by the last.

### 2.2 Nothing here was late. The elapsed time was the work.
At no point was anyone slow. This settles `PENDING-DECISIONS.md` B6 with evidence:
**lateness attaches to a reading that did not happen, never to the elapsed life of a
trial.** A board that had shown this work as "late" for four months would have been
lying every day it did so.

### 2.3 An abnormality must open an investigation, not wait for the end
Himmayat's own words. A Run therefore needs a state the model does not have:
**abnormality found → investigation open**. Not passed, not failed, not still running.
The settling at week 4 was not a result to be logged and waited out; it was the moment
the work changed direction.

### 2.4 The reading schedule is not fixed at the start
After settling was found, the plan changed. So **"next observation date" is a live,
owned commitment that moves**, not a calendar set on day one. It is also the only
thing that can legitimately be called late.

### 2.5 A finding can arrive from a completely different product
The fermentation risk did not come from this trial. It came from **a vendor complaint
about Tornado bottle seals** — a different product — and reached V Germinator Pro
**because both contain molasses.**

In model terms: a **Challenge** (complaint on a product we sell) propagated to an
in-flight **Run** on another product through a **shared material**.

**Requirement, and it is a large one:** the system must be able to answer *"what else
contains this material, and what is currently running that uses it?"* — and push that
signal at the people running those trials. **This is exactly the index the Combination
Bank builds.** Maleeha needed search-by-technique; Himmayat needed
search-by-material-across-products-and-complaints. **Same index, two uses.** That is
the strongest argument yet that the Bank is infrastructure rather than a nice extra.

### 2.6 A falsified hypothesis is a result, and the model already has a home for it
*"Fermentation should not occur at such a low pH"* — believed, tested, **disproved.**

This is precisely `MODEL.md`'s **Claim**: an assertion with an owner and an honest
grade, which anyone may challenge. It began as *believed*, the sealed-bottle
observation challenged it, and it is now *disproved*.

**That sentence is worth more to VAN than the formulation change was.** It is a
general fact about low-pH products containing molasses, it applies to every future
product with the same ingredients, and in today's system **it lives nowhere** — it is
a step inside one trial's story. It must be written as a Claim against the Problem,
not buried in a Run.

### 2.7 Every reading carries five things
From his Week 3 example, a reading is not a date and a tick. It is:

| | |
|---|---|
| **Parameters checked** | which tests were run |
| **Physical observation** | settling, colour, swelling — or explicitly *none seen* |
| **Analytical result** | the measured numbers (K₂O content dropped — that was the evidence) |
| **Verdict** | normal · abnormal → investigation |
| **Next observation date** | the moving commitment |

Note the third: **the K₂O measurement falling is what turned "white powder" into a
diagnosis.** Physical observation alone would not have found the cause.

### 2.8 Deviations are Observations raised from inside a Run
Settling, ammonia formation, seal swelling, fermentation. `MODEL.md` treats an
Observation as an intake **door** — something arriving from outside. This case shows
Observations are also **generated inside a Run**, and each one here became the reason
for the next Bet. The door model needs that second origin.

### 2.9 The three formulations are three Combination Bank records
SOP, KOH, potassium carbonate — same product intent, one material line different,
**each with a written reason for abandonment**:

- *SOP — settled after ~1 month, K₂O content dropped.*
- *KOH — settling resolved, but N fell through ammonia gas formation.*
- *K₂CO₃ — resolved both. Under observation.*

This is exactly what the Bank exists to hold, and it confirms two rules already
written: they are **Variants, not duplicates** (`combination-bank/RULES.md` §7.3), and
the material **role** matters — all three are the *potassium source*
(`PENDING-DECISIONS.md` B10). Anyone who ever asks "which K source do we use in
liquids and why" would be answered by these three records in ten seconds.

---

## 3. One honest tension this exposes

**The work did not start from a Problem.**

`MODEL.md` §3 defines a Problem as *"a real field/market pain"*, and the app's own
text says a problem is stated in the field and in farmer economics, never in
chemistry — *"Make NP 5-40" is not a problem, that is a product concept.*

But this case began: *"the initial idea was to develop a product providing 100%
nutrition, containing NPK along with Fe and Mn."* **That is a product concept, not a
field problem.** The model as written has nowhere clean to put the start of this
trial.

Two readings, and Tahir must pick one:

- **(a) The model is right and this is the diagnosis.** Product-first development is
  exactly the habit that produces samples before questions, and the system should make
  the missing problem visible rather than accommodate it.
- **(b) The model is too strict.** Some work legitimately starts from a market slot or
  a customer request, and forcing a fabricated "problem" on top of it teaches people to
  write fiction to satisfy a form.

**This is not a detail.** It decides whether the first screen a person meets can accept
"we want to make a 100% nutrition product" as a valid starting point, or insists on a
field pain first. Getting it wrong in either direction changes adoption.

---

## 4. What to do with this case

### 4.1 It is the pilot — it is already running
`PENDING-DECISIONS.md` **B5** asks which real question to run first on paper. **The
fermentation-source question is live right now**, and it is close to ideal:

- **The question is sharp:** what is fermenting in V Germinator Pro?
- **Two named hypotheses:** molasses, amino acids.
- **It kills cleanly.** Remove or substitute one, observe the seal. The result is
  unambiguous either way.
- **A Claim is already on the table** and already downgraded once — the low-pH belief.
- **It costs nothing extra**, because the work is happening regardless. Only the
  writing-down is new.

Running it in the open, on paper, would prove the discipline against a live problem
before a line of code is written — which is what both Fahim and Abdullah asked for.

### 4.2 It is the test any build must pass
Before this system is called finished, it must be possible to enter this entire
story — three formulations, four abnormalities, a cross-product complaint, a
falsified belief and an open question — and have a person who was not there
understand it in five minutes.

**If the design cannot hold this case, the design is wrong.** It is a better
acceptance test than any specification.

---

## 5. Requirements this adds

| # | Requirement | Where |
|---|---|---|
| B6 | Long trials are active monitoring, not waiting. Status · week · observations · analytical results · deviations · hypothesis · next action. Lateness attaches to a missed reading only. | **Rewritten with this evidence** |
| B14 | Run lineage — a Run names the Run it replaced, and why | New |
| B15 | Abnormality opens an investigation mid-trial; a Run needs that state | New |
| B16 | Cross-product signal by shared material — "what else contains molasses, and what is running that uses it?" | New |
| B17 | A falsified belief is recorded as a Claim against the Problem, not lost inside a Run | New |
| B18 | An Observation can be raised from inside a Run, not only from the intake door | New |
| A4 | Must work start from a Problem, or may it start from a product concept? | **New schema-blocker** |

_Recorded verbatim where quoted. Himmayat's account is the source; the analysis is
Claude's and should be argued with._
