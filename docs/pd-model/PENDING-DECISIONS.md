# PD rebuild — what is pending, and what each thing blocks

_Opened 18 August 2026. This is the standing list of everything the rebuild is
waiting on. It is not a backlog of work — it is a list of **decisions and inputs
that are not Claude's to make**, each with what it blocks and what would unblock it._

**Rule: nothing marked BLOCKS SCHEMA gets coded past. Not "started carefully" —
not coded past at all.** Building before these land means building twice.

---

## A. Blocks the schema — no code until these are answered

### A1. Do the gates survive?
**Question.** Keep Spec v2's G1–G6 (route-level, deliberate), reduce to the two hard
rules in `MODEL.md` §0, or replace with obligations-and-deadlines?

**Why it blocks everything.** Four tables (`pd_gate_decisions`, `pd_product_gates`,
`pd_route_screens`, `pd_dev_records`), most of the 79 endpoints and most of the 20
surfaces exist to serve the gate model. If gates go, roughly half the old system
goes with them and the new schema looks nothing like the old one. If they stay, the
rebuild is much closer to an extension. **This single answer decides the shape of
everything.**

**State.** `MODEL.md` §7 #1 records Tahir leaning away from "gates and committees"
as the frame. Leaning is not a ruling.

**Decides:** Tahir. · **Source:** `MODEL.md` §7 #1.

---

### A2. Is a Combination a tenth object, or a register beneath Bet/Run?
**Question.** `MODEL.md` §3 fixes the model at **nine objects, no more without
Tahir's sign-off**, and warns that a seeming tenth is usually one of the nine in a
new coat. The Combination Bank is either a genuine tenth, or a register holding the
recipes that Runs make and Bets propose.

**Why it blocks.** It decides where combinations are stored and what they hang off.

**The honest tension.** Most rows in the bank will never have a Bet or a Run behind
them — they are ideas that were had and never taken up. That is precisely their
value, and it is also the strongest argument that they are not a Bet in a new coat.

**Decides:** Tahir. · **Source:** `combination-bank/RULES.md` §2, `MODEL.md` §3.

---

### A3. Cost in PD — settle the contradiction
**Question.** `MODELING-GROUND-RULES.md` §0 says the system does not manage cost.
PD's schema and the candidate engine both compute it. `CLAUDE.md` §2 already reads
ground-rule 0 as **O2S-scoped**, but that is a reading, not a signed amendment.

**Why it blocks.** Whitelist item #1 (`REUSE-RULES.md` §2) is the cost engine. If
cost is out of PD, that item comes off the list and the ranking logic goes with it.

**State.** Sheikh Arshad's "what price?" already forced the question once.

**Decides:** Tahir. · **Source:** `MODEL.md` §7 #2, `CLAUDE.md` §2.

---

### A4. Must work start from a Problem, or may it start from a product concept?
**NEW, 20 Aug 2026, from the worked case.**

`MODEL.md` §3 defines a Problem as *"a real field/market pain"*, and the app's own text
insists a problem is stated in the field and in farmer economics, never in chemistry —
*"Make NP 5-40" is not a problem, that is a product concept.*

But the V Germinator Pro work began: *"the initial idea was to develop a product
providing 100% nutrition, containing NPK along with Fe and Mn."* **That is a product
concept.** The model as written has nowhere clean to put the start of a real, current,
approved piece of VAN development.

- **(a) The model is right, and this is the diagnosis.** Product-first development is
  the habit that produces samples before questions. The system should make the missing
  problem visible rather than accommodate it.
- **(b) The model is too strict.** Some work legitimately starts from a market slot or
  a customer request, and forcing a fabricated "problem" on top teaches people to write
  fiction to satisfy a form.

**Why it blocks the schema:** it decides whether a Problem is a mandatory parent, and
whether the first screen a person meets can accept "we want to make a 100% nutrition
product" as a valid starting point. Getting it wrong in either direction changes
adoption.

**Decides:** Tahir. · **Source:** `WORKED-CASE-V-GERMINATOR-PRO.md` §3.

---

## B. Blocks the build, not the schema

### B1. ~~The team review~~ — LANDED 19 Aug 2026, approved
Five responses, unanimous agreement on the spine, no dissent, no change requested to
the procedure. Full record and quotes: `TEAM-REVIEW-2026-08-19.md`. It produced three
new requirements — B6, B7, B8 below — and one independent confirmation: **Maleeha
asked for the Combination Bank without having seen it**, from real work last week.
**Moved to §D.**

### B2. The real material and grade list
Tahir is sending additions. Until then the demo register holds VAN's real 51
materials **plus ~40 grades Claude invented**, marked as such. Those must be
confirmed or dropped before any of it becomes master data.
**Source:** `combination-bank/RULES.md` §10.

### B3. The assay figures
N · P₂O₅ · K₂O · S · Zn per grade. **They do not exist in any file.** Tahir is
supplying them. Until then computed analysis is blank for most of the register —
which is the designed behaviour, not a fault.

### B4. The controlled vocabularies
Crops, soils, problems, forms, routes — **all currently invented by Claude.** Real
lists needed before entry is real.

### B5. Pilot before software
`MODEL.md` §7 #5: run ONE live question in the open first (humic mechanism, or
NP 11-44 NUE — both ready) to prove the discipline changes behaviour before spending
on the build. Tahir's own words on why: *"a perfect empty container is what VAN
produces when structure exists but nobody owes an answer."*
**Not yet started. This is arguably the cheapest next move of anything on this page.**

**A candidate has appeared, and it is already running (20 Aug 2026):** the
**fermentation-source question in V Germinator Pro** — what is fermenting, molasses or
amino acids? Sharp question, two named hypotheses, kills cleanly (substitute one,
observe the seal), a Claim already downgraded once, and **it costs nothing extra
because the work is happening anyway — only the writing-down is new.**
See `WORKED-CASE-V-GERMINATOR-PRO.md` §4.1.

### B6. Long trials are ACTIVE MONITORING, not a waiting period — evidenced
_Upgraded 20 Aug 2026 with a full worked case: `WORKED-CASE-V-GERMINATOR-PRO.md`._

Himmayat's V Germinator Pro account settles this with real work rather than argument.
Four months, three formulations (SOP → KOH → potassium carbonate), four abnormalities,
and **at no point was anyone late.** The elapsed time *was* the work.

**What a long Run must carry, in his own words:** trial status · current week ·
observations · analytical results · deviations and issues · the hypothesis being
tested · the next planned action — **at each stage, not at the end.**

**What one reading contains:** parameters checked · physical observation (or
explicitly *none seen*) · analytical result · verdict (normal / abnormal) · next
observation date. The third matters most — *the falling K₂O measurement is what turned
"white powder" into a diagnosis.* Physical observation alone would not have found the
cause.

**Settled by evidence:** lateness attaches to **a reading that did not happen**, never
to the elapsed life of a trial. And the reading schedule **moves** — after settling was
found, the plan changed. "Next observation date" is a live owned commitment, not a
calendar set on day one.

### B7. The objective must be visible on the trial itself — NEW, from the review
Himmayat, echoed by Abdullah and Masab. The schema already carries it (a Bet cannot
exist without its kill criterion). This is about **what a person sees on the screen**:
the question the trial answers, and the result that would kill it, on the trial —
not one click away. Cheap now, expensive to retrofit.

### B8. The problem dossier — NEW, from the review
Maleeha asked for a view that shows *"what we have already learned about a problem
**across every bet we have run against it**."* The Combination Bank is keyed to
combinations; this is keyed to the **problem** — every Bet, Run, Claim and
combination aimed at it, and what each taught.

Not a new object: a read view across objects the model already has. But `MODEL.md` §5
says **two screens**. **Open question for Tahir: is the dossier a third screen, or a
section of the Problem record?**

### B9. Technique / architecture is missing — and it CORRECTS A WRITTEN RULE
**From Maleeha's second answer, 19 Aug 2026.** She was looking for *"a dual-phase P
source, a competing anion, or a fused/coated architecture."* None of those is a
material, a grade or an inclusion %. **The Bank as designed could not have answered
her.**

A record needs a **technique axis**: blended · co-granulated · fused · coated ·
layered · impregnated · reacted.

**This corrects `combination-bank/RULES.md` §7.1.** "Clear evidence" is currently five
signals — same grades, same inclusions, same form, same route, same problem. **Two
recipes with identical materials at identical percentages, one blended and one
co-granulated, are different products, and the hard stop as written would wrongly
block the second one.** Technique must become a sixth signal before any code is
written, or the rule creates exactly the false blockage Tahir warned about with
material grades.

### B10. A material line needs a ROLE and a PHASE — NEW
Maleeha's anion is *"introduced between the two phases"* for a purpose. "ZnSO₄ 3%"
records none of that. A line needs:
- **role** — fast-release P source · slow-release P source · competing anion ·
  coating · binder · carrier · filler;
- **phase / position** — core · shell · interlayer · matrix.

Without this, architecture is invisible even when the technique is tagged, and the
Bank cannot answer "have we ever put a competing anion between two phases?"

### B11. Mechanism is the thing people search by — NEW
Her distinction: *"reducing fixation instead of just timing around it."* Two products
can attack the same problem by different mechanisms, and **that difference is the
whole idea**. Problem tags do not capture it.

Needs a **mechanism / intent** tag: compete for Ca binding sites · delay release ·
acidulate the micro-zone · chelate · protect from volatilisation. This is the axis a
researcher actually thinks in.

### B12. The search must answer in a sentence, not a result list — NEW
She wrote the required output herself:

> *"We tested [technique] on [ingredient/combination] and found [result]"* — or —
> *"we've never tested this specific combination."*

Two consequences:
1. **The honest negative is a first-class answer.** "Never tried here" is exactly as
   valuable as a hit, and it is what lets someone stop researching and start working.
2. Results must distinguish **ours** from **the world's**. She went to external
   literature *because* internal history was unavailable, and was careful to say her
   competitor scan was *"not a separate idea I was pursuing."* The Bank already
   separates `origin: competitor / literature` — that separation must be **visible in
   results**, not just stored.

**Also a shift of emphasis.** She searched **before deciding what to develop**, to
narrow scope. The Bank has been designed mainly as a duplicate check at the moment of
saving. **Its primary job is search before the work, not blocking at entry.** The
entry-time check is a by-product.

### B13. Everything must be re-classifiable — NEW, and it is a first-class requirement
**Raised by Tahir, 20 Aug 2026:** *"people might confuse things — they will call a Bet
an idea and add it, they might see a Question as a Run and add it. They will learn,
but while they are learning we should have the full capability to edit, remap, and
correctly assign things to the right field and the right stage."*

**This is not an admin convenience. It is what makes the nine-object model usable by
people who have never used it.** A model with nine object types will be got wrong for
the first few months. If a wrong entry is expensive to fix, two things happen: people
stop entering, or the record fills with things filed under the wrong name and the
Problem dossier (B8) starts lying.

`MODEL.md` §5 already says the intake door needs *"no need to classify — triage
classifies."* **This extends that principle past intake and makes it permanent.**

**What is needed:**

1. **Convert any object to any other** without re-typing — Question → Bet,
   Observation → Claim, "idea" → Question. The content moves; the person does not
   retype it.
2. **Move a value from the wrong field to the right one**, including across object
   types.
3. **Re-assign stage, owner and parent** — an item hung off the wrong Problem or the
   wrong Bet gets re-parented.
4. **Merge and split.** Two entries that turn out to be the same thing merge. One
   entry containing two questions splits into two, each keeping the original as its
   source.
5. **Bulk correction** during the learning period. A registrar fixing thirty
   misfiled entries one at a time will not fix them.
6. **Undo.** A wrong re-classification must be reversible.

**And the guardrails, which matter as much:**

- **Content is editable; the record of what it was is not.** Every re-classification
  keeps: what it was recorded as, by whom, when — and what it became, by whom, when,
  and why. `MODEL.md` §6 already demands exactly this for claims (*"versioned; never
  overwrite in place"*). Same rule, applied to type and parentage.
- **Identity survives.** The item keeps its number through any conversion. Nothing is
  deleted, nothing is re-numbered — consistent with the standing rule that killed and
  parked things keep their number forever.
- **The person who entered it is told.** A silent correction teaches nobody and costs
  trust. They should see what it became and why.
- **The correction is the teaching moment.** Showing *"moved to Bet, because a Bet
  carries the one result that would kill it"* is how the team learns the vocabulary.
  A system that corrects invisibly produces people who keep making the same mistake.
- **Who may do it is configurable** — the same group model as the Combination Bank
  moderator, not a hard-coded role.

**SETTLED 20 Aug 2026 — full design is `RECLASSIFICATION-RULES.md`.** Tahir ruled:
**no reason or justification is ever required**, not even when crossing object types.
The "why" is recorded automatically as **the model's own definition of the new type**,
not as the mover's prose. Content is editable, the record of what it was is not.
**Authorship never transfers.** The correction is the teaching: one message, the
definition, and a way to answer back. **No per-person error count may ever exist.**
Design question closed; the requirement stands and must be met by any build.

### B14. Run lineage — a Run must name the Run it replaced, and why — NEW
Source: the worked case. SOP → KOH → potassium carbonate is **one line of
investigation**, each formulation existing *because* the previous one failed. Without
the link, the record shows three unrelated trials and loses the only thing that makes
them intelligible.

### B15. An abnormality opens an investigation mid-trial — NEW
Himmayat: *"If an abnormality occurs… it should trigger an investigation rather than
simply waiting until the end."* A Run needs a state the model does not have:
**abnormality found → investigation open.** Not passed, not failed, not still running.
The settling at week 4 was not a result to log and wait out; it was the moment the work
changed direction.

### B16. Cross-product signal by shared material — NEW, and it is large
The fermentation risk did not come from this trial. It came from **a vendor complaint
about Tornado bottle seals** — a different product — and reached V Germinator Pro
**because both contain molasses.**

The system must answer *"what else contains this material, and what is currently
running that uses it?"* and push that signal to the people running those trials.

**This is the same index the Combination Bank builds.** Maleeha needed
search-by-technique; Himmayat needed search-by-material-across-products-and-complaints.
**Two people, two uses, one index — the strongest argument yet that the Bank is
infrastructure, not an extra.**

### B17. A falsified belief is a Claim, and must survive outside the trial — NEW
*"Fermentation should not occur at such a low pH"* — believed, tested, **disproved.**

That sentence is a general fact about low-pH products containing molasses. It applies
to every future product with those ingredients, and today **it lives nowhere** — it is
a step inside one trial's story. It must be written as a **Claim against the Problem**,
graded and challengeable, not buried in a Run. `MODEL.md` already has the object; the
flow must actually put it there.

### B18. An Observation can arise INSIDE a Run — NEW
Settling, ammonia formation, seal swelling, fermentation. `MODEL.md` treats an
Observation as an intake **door** — something arriving from outside. Each of these was
generated **inside** a Run, and each became the reason for the next Bet. The model needs
that second origin.

---

## C. Decisions that can wait, but must not be forgotten

### C1. `Sulfur` vs `Sulphur` in the raw-material master
Both spellings exist as separate entries — `Sulfur Fine (WDG)-A` against
`Sulphur WDG` and `Sulphur Grinded- 200-250 Mesh`. The app will treat them as two
different substances, so a recipe using one can never match a recipe using the
other. **Not corrected by Claude: changing a master-data string is a data change and
needs Tahir's word.**

### C2. `MAP` and `DAP` are listed with no grade at all
Under `RULES.md` §7.2 nothing built on them can be hard-stopped as a repeat until a
grade is named. Safe behaviour, but they are the first two worth grading.

### C3. Should the 46 existing O2S recipes ever be loaded into the bank?
Currently **no** — decided 18 Aug, the bank starts empty. The cost of "no" is that
the duplicate checker cannot tell someone their new idea is already a product VAN
sells. Reversible later: it is a one-off load, not a redesign.

### C4. Similarity weights and thresholds
`RULES.md` §7.5 — Claude's, untested against real data. They need tuning once real
rows exist. **Nobody should treat them as tuned.**

### C5. Evidence base — rebuild into PD, or link to `E:\NP`?
`MODEL.md` §6 sets out what a knowledge store must preserve per claim (scope
conditions, endpoint class, independence, correction history, do-not-quote,
not-reported vs not-measured vs not-entered). The current `pd_library_items` /
`pd_learnings` tables **cannot hold it without destroying it.** Rebuild is the
bigger, righter job. **Source:** `MODEL.md` §6, §7 #3.

---

## D. Settled — recorded so they are not reopened by accident

| Date | Decision |
|---|---|
| 18 Aug 2026 | **Build on the existing app**, do not delete `pd/`. Reuse is component-level and whitelisted — `REUSE-RULES.md`. |
| 18 Aug 2026 | **PD holds no real data** (confirmed by Tahir). This is what makes a core rebuild cheap; it stops being true the moment the team enters anything. |
| 18 Aug 2026 | **Security / access / infrastructure findings are out of scope** for this rebuild — one line in the security register, nothing more. |
| 18 Aug 2026 | Combination Bank: one row per material · register at grade level · supplier not part of grade identity · moderators only add materials · analysis computed, never typed · hard stop only on clear evidence. Full set in `combination-bank/RULES.md`. |
| 19 Aug 2026 | **Team review landed — approved, unanimous, no change to the spine.** Three new requirements (B6, B7, B8) and independent confirmation of the Combination Bank. Record: `TEAM-REVIEW-2026-08-19.md`. |
| 19 Aug 2026 | Noted, not settled: the two people closest to the bench (Fahim, Abdullah) both said the same thing in different words — **the remaining gaps will surface in use, not in review.** That is the argument for B5, the paper pilot, over more design. |

---

## E. How to use this file

- **Before writing any PD code**, read section A. If anything there is unanswered,
  the answer is not "start on the parts that don't depend on it."
- When a decision lands, **move it to section D with the date** — do not delete it.
  A settled decision with no record gets relitigated in three weeks.
- When something new blocks the work, add it here rather than carrying it in a
  session that will end.
