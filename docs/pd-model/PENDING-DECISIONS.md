# PD rebuild — what is pending, and what each thing blocks

_Opened 18 August 2026. This is the standing list of everything the rebuild is
waiting on. It is not a backlog of work — it is a list of **decisions and inputs
that are not Claude's to make**, each with what it blocks and what would unblock it._

**Rule: nothing marked BLOCKS SCHEMA gets coded past. Not "started carefully" —
not coded past at all.** Building before these land means building twice.

**STATUS — 1 Sept 2026: §A is now fully answered, including A4's mechanism**
(all four moved to §D). Schema work may proceed **except** where a §B item (still
open) bears directly on it — read §B before designing a screen or table, the same
as always.

**Same-day addendum:** a clickable, fake-data prototype now exists (not committed
to this repo — a Cowork artifact) demonstrating all four screens (`MODEL.md` §5),
the three doors with triage and reply, the Combination Engine as the front door to
a Bet, and Related-from-Dossier surfacing. B5's pilot is started, not finished
(see B5). B9–B12's vocabularies, and now B16's cross-product signal design, are
drafted into `combination-bank/RULES.md`, not yet confirmed by Tahir. A first
partial return on the real material list also landed same day (see B2/B3).
**None of this is code against the real schema** — the
prototype is throwaway HTML/JS, built to be clicked through, not extended.

---

## A. Blocks the schema — no code until these are answered

### A1. ~~Do the gates survive?~~ — SETTLED 1 Sept 2026
**Ruling (Tahir):** reduce to the two hard rules in `MODEL.md` §0. No G1–G6
committee/gate machinery in the rebuild. `REUSE-RULES.md` §1 updated to record this
as settled rather than a default exclusion. **Moved to §D.**

**Question (for the record).** Keep Spec v2's G1–G6 (route-level, deliberate), reduce to the two hard
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

### A2. ~~Is a Combination a tenth object, or a register beneath Bet/Run?~~ — SETTLED 1 Sept 2026
**Ruling (Tahir):** register beneath Bet/Run. The object model stays fixed at nine
(`MODEL.md` §3) — no sign-off needed for a tenth, because there isn't one. **Moved to §D.**

**Question (for the record).**
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

### A3. ~~Cost in PD — settle the contradiction~~ — SETTLED 1 Sept 2026
**Ruling (Tahir):** cost is OUT of PD. Ground-rule 0 applies platform-wide, no PD
exception — `CLAUDE.md` §2 corrected. `REUSE-RULES.md` §2 whitelist item #1 (the
candidate cost engine) removed; it does not carry into the rebuild. **Moved to §D.**

**Question (for the record).**
**Question.** `MODELING-GROUND-RULES.md` §0 says the system does not manage cost.
PD's schema and the candidate engine both compute it. `CLAUDE.md` §2 already reads
ground-rule 0 as **O2S-scoped**, but that is a reading, not a signed amendment.

**Why it blocks.** Whitelist item #1 (`REUSE-RULES.md` §2) is the cost engine. If
cost is out of PD, that item comes off the list and the ranking logic goes with it.

**State.** Sheikh Arshad's "what price?" already forced the question once.

**Decides:** Tahir. · **Source:** `MODEL.md` §7 #2, `CLAUDE.md` §2.

---

### A4. ~~Must work start from a Problem, or may it start from a product concept?~~ — SETTLED 1 Sept 2026, mechanism SETTLED same day
**Ruling (Tahir):** the model was too strict — allow concept-first too. A stated
product concept ("make NP 5-40", "100% nutrition with Fe and Mn") is a valid
starting point in its own right; the system does not force a fabricated Problem on
top of it. **Moved to §D.**

**Mechanism (Tahir, same session):** broaden Problem itself rather than add a new
object or a nullable parent. Problem carries a `kind` flag — `field_problem` |
`product_concept` — and keeps its shape either way: few, long-lived, the single
parent every Question/Bet/Run aimed at it hangs off. Registering a Problem of
either kind is a direct action, not a fourth door (`MODEL.md` §3). Rejected: a
lightweight concept object (adds a tenth object, needs sign-off it wasn't given)
and a nullable Problem parent with an inline text field (loses the shared parent a
concept needs once it spawns more than one Question — exactly what V Germinator Pro
did over three formulations, `WORKED-CASE-V-GERMINATOR-PRO.md` §1). This item is
now schema-ready.

**Question (for the record), 20 Aug 2026, from the worked case.**

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

### B2. The real material and grade list — first return received 1 Sept 2026
Tahir's team returned `PD-Material-Grade-Template.xlsx` with a first pass: 21 new
materials named (Magnesium Sulfate Heptahydrate, Sodium Borate, SPM/Sugar Press
Mud, MKP, Boric Acid, Rock Phosphate, Nitric Acid, Zinc Ash, Fulvic Acid, PVA,
Potassium Fulvate, EDTA-type Sodium Salt (name to confirm), Zinc Oxide, Calcium
Carbonate, Magnesium Carbonate, a plant-growth-regulator entry (name to confirm),
MEA/Monoethanolamine from supplier Perkin, Calcium Hydroxide, Urea, Poultry Waste
(OM), Fly Ash) plus physical form for every row, both new and original. **Grade /
spec for all 21 new rows, and for most of the original 24 candidates, is still
open** — not yet touched in this pass. Archived as returned:
`combination-bank/PD-Material-Grade-Template-RETURNED-1Sep2026.xlsx`.
**Source:** `combination-bank/RULES.md` §10.

### B3. The assay figures — partially confirmed 1 Sept 2026
Real, confirmed lab figures now on file for: Sulfur S 80% · SOP K₂O 50% · KOH
K₂O 70% · Potassium Carbonate K₂O 60% · Amino Acid (source) N 50% · Zinc Sulfate
Monohydrate Zn 33% · Phosphoric Acid P₂O₅ 50/52/55% (60/65/75% grades
respectively) · MOP K₂O 60% (both powder and granular) · Zinc Oxide Zn 80%.
Confirmed by Tahir as final lab data, not placeholders. Everything else —
including all 21 newly named materials except Zinc Oxide — still has no assay on
file. Computed analysis stays blank for any combination using an un-assayed
grade, per §4.3 of `combination-bank/RULES.md` — designed behaviour, not a fault.


### B4. The controlled vocabularies — fill-in template built 1 Sept 2026
Crops, soils, problems, forms, routes — **all currently invented by Claude.** Real
lists needed before entry is real. A fill-in-the-blank template
(`combination-bank/PD-Controlled-Vocabularies-Template.xlsx`) now lays out every
existing placeholder value from the demo file and `MODEL.md`, for Tahir to
confirm, edit, drop or extend — same pattern as B2/B3's material template, sourced
only from PD's own docs, nothing from the ERP. **One thing surfaced building it:
Route exists as two different, only-partly-overlapping lists** — the Combination
record's own 4-value Route field (`combination-bank/RULES.md` §4.1) and `MODEL.md`
§3's 6-value delivery-context list that Constraints hang off — flagged in the
template for a ruling, not resolved here.

### B5. Pilot before software — STARTED 1 Sept 2026
`MODEL.md` §7 #5: run ONE live question in the open first (humic mechanism, or
NP 11-44 NUE — both ready) to prove the discipline changes behaviour before spending
on the build. Tahir's own words on why: *"a perfect empty container is what VAN
produces when structure exists but nobody owes an answer."*

**Started, not finished.** The Question, both hypotheses, and the kill criterion for
the fermentation-source pilot are written down in
`PILOT-001-fermentation-source.md`, transcribed from Himmayat's own words in
`WORKED-CASE-V-GERMINATOR-PRO.md` §4.1 — nothing invented. What is still needed is
not more design: it is Himmayat actually reading it, correcting anything wrong, and
writing the next observation directly into that file — on paper, before any
software exists. **This is still the cheapest, most overdue move on this page**;
writing the pilot down is not the same as running it.

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

### B8. ~~The problem dossier~~ — SETTLED 1 Sept 2026 — its own screen, sign-off given
**Ruling (Tahir):** its own screen, browsable across every Problem at once — not a
section buried inside one Problem's record. **This is the explicit sign-off
`REUSE-RULES.md` §5 requires for a 3rd screen** (target was 2; the tripwire says
stop and show Tahir before continuing past it — this is that moment, done on
purpose, not drift). Screen count is now 3, and about to become 4 — see the new
reporting item below, same session.

Maleeha asked for a view that shows *"what we have already learned about a problem
**across every bet we have run against it**."* The Combination Bank is keyed to
combinations; this is keyed to the **problem** — every Bet, Run, Claim and
combination aimed at it, and what each taught. Not a new object: a read view across
objects the model already has.

### B9. Technique / architecture is missing — and it CORRECTS A WRITTEN RULE — vocabulary drafted 1 Sept 2026
**Drafted into `combination-bank/RULES.md` §4.1 and §7.1 (now six signals, not
five), 1 Sept 2026** — the seven-value list below, and the corrected duplicate
rule. **Not yet confirmed by Tahir.** Treat as drafted, not settled, same status
as the crop/soil/problem vocabularies (B4).
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

### B10. A material line needs a ROLE and a PHASE — NEW — vocabulary drafted 1 Sept 2026
**Drafted into `combination-bank/RULES.md` §4.2, 1 Sept 2026** — role required,
phase required only where technique is layered/coated/fused (defaults to
`matrix` otherwise, so a plain blend is never forced into a false structure).
**Not yet confirmed by Tahir.**
Maleeha's anion is *"introduced between the two phases"* for a purpose. "ZnSO₄ 3%"
records none of that. A line needs:
- **role** — fast-release P source · slow-release P source · competing anion ·
  coating · binder · carrier · filler;
- **phase / position** — core · shell · interlayer · matrix.

Without this, architecture is invisible even when the technique is tagged, and the
Bank cannot answer "have we ever put a competing anion between two phases?"

### B11. Mechanism is the thing people search by — NEW — vocabulary drafted 1 Sept 2026
**Drafted into `combination-bank/RULES.md` §9.1, 1 Sept 2026** — optional tag,
five values, so an idea without a named mechanism yet is never forced to guess
one. **Not yet confirmed by Tahir.**
Her distinction: *"reducing fixation instead of just timing around it."* Two products
can attack the same problem by different mechanisms, and **that difference is the
whole idea**. Problem tags do not capture it.

Needs a **mechanism / intent** tag: compete for Ca binding sites · delay release ·
acidulate the micro-zone · chelate · protect from volatilisation. This is the axis a
researcher actually thinks in.

### B12. The search must answer in a sentence, not a result list — NEW — spec drafted 1 Sept 2026
**Drafted into `combination-bank/RULES.md` §9/§9.2, 1 Sept 2026** — search
reframed as the Bank's primary job rather than a save-time duplicate check; the
honest-negative rule and the ours-vs-the-world's distinction are now both written
as load-bearing requirements, not just observations. This is a behaviour spec,
not a vocabulary — nothing here needs Tahir's confirmation the way B9–B11's word
lists do, but it is still unbuilt.
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

### B16. Cross-product signal by shared material — NEW, and it is large — design drafted 1 Sept 2026
The fermentation risk did not come from this trial. It came from **a vendor complaint
about Tornado bottle seals** — a different product — and reached V Germinator Pro
**because both contain molasses.**

The system must answer *"what else contains this material, and what is currently
running that uses it?"* and push that signal to the people running those trials.

**This is the same index the Combination Bank builds.** Maleeha needed
search-by-technique; Himmayat needed search-by-material-across-products-and-complaints.
**Two people, two uses, one index — the strongest argument yet that the Bank is
infrastructure, not an extra.**

**Drafted into `combination-bank/RULES.md` §9.3, 1 Sept 2026** — trigger events
(a tagged Challenge/Observation/Claim, or an abnormal Run), what an auto-generated
signal looks like (delivered as an Observation, reusing B18's mechanism, no tenth
object), substance-level matching, and an active-work-only scope. **Not yet
confirmed by Tahir** — same status as B4's and B9–B12's vocabularies. Three
open questions listed at the end of that section, unresolved on purpose.

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

### B19. A leadership/portfolio view — SETTLED 1 Sept 2026 — new requirement, needed now
**Never discussed before this session.** Both existing screens (`MODEL.md` §5) are
scoped to one person's own work — "what came in," "what I owe." Nothing anywhere
addressed a company-wide view: how many Problems are open, which Questions are
overdue across the whole team, how many Bets got killed vs. advanced this quarter.
**Ruling (Tahir):** yes, needed, design it now rather than bolt it on later. This is
the **4th screen** (see B8 — screen count is now consciously 4, not the target 2,
with sign-off given both times).

**Shape agreed this session (first draft, refine on use):** KPI tiles — open
Problems (by `kind`: field problem vs. product concept), Questions overdue, Bets
active / killed / advanced, Claims logged by grade, combinations generated vs.
made vs. tested. Below that, two short feeds: things overdue across the whole
team, and what closed recently with its result. **Guardrail, non-negotiable:**
aggregate only, **never a per-person breakdown** — the same rule `RECLASSIFICATION-RULES.md`
already sets for corrections ("No per-person error count. Not on a dashboard, not
in a report, not derivable") applies here by the same logic. A leadership view
that quietly becomes a scorecard undoes the no-blame culture the whole model
depends on.

---

## C. Decisions that can wait, but must not be forgotten

### C1. ~~`Sulfur` vs `Sulphur` in the raw-material master~~ — SETTLED 1 Sept 2026
**Ruling (Tahir):** `Sulfur` is the correct spelling. Existing entries under
`Sulphur` (`Sulphur WDG`, `Sulphur Grinded- 200-250 Mesh`) are the same substance
under the wrong spelling — merge/rename to `Sulfur` as a master-data correction, not
two materials. **Moved to §D.**

Both spellings exist as separate entries — `Sulfur Fine (WDG)-A` against
`Sulphur WDG` and `Sulphur Grinded- 200-250 Mesh`. The app treated them as two
different substances, so a recipe using one could never match a recipe using the
other, until this correction lands.

### C2. ~~`MAP` and `DAP` are listed with no grade at all~~ — SETTLED 1 Sept 2026
**Ruling (Tahir):** MAP is graded as **four** distinct grades — 12-61, 10-61, 10-52,
11-44 (N-P₂O₅). DAP is graded as **one** — 18-46. These are now real, distinct
register entries, not one ungraded bucket each.

Under `RULES.md` §7.2 nothing built on them could be hard-stopped as a repeat until
a grade was named. **Moved to §D.**

### C3. Should the 46 existing O2S recipes ever be loaded into the bank?
Currently **no** — decided 18 Aug, the bank starts empty. The cost of "no" is that
the duplicate checker cannot tell someone their new idea is already a product VAN
sells. Reversible later: it is a one-off load, not a redesign.

### C4. Similarity weights and thresholds
`RULES.md` §7.5 — Claude's, untested against real data. They need tuning once real
rows exist. **Nobody should treat them as tuned.**

### C5. ~~Evidence base — rebuild into PD, or link to `E:\NP`?~~ — SETTLED 1 Sept 2026
**Ruling (Tahir):** light native + link. PD stores a real, lightweight Claim
natively — what it says, owner, grade, one-line scope note — with a pointer
underneath to the full source material (`E:\NP` or wherever it actually lives) for
anyone who wants the depth. **Not** a full rebuild of `MODEL.md` §6's complete spec
(scope conditions, endpoint class, independence, correction history, do-not-quote,
not-reported/not-measured/not-entered as structured fields) — that stays in the
source material itself, not duplicated into PD. Rationale discussed same session:
avoids re-hosting research that's actively maintained elsewhere (e.g. the DAP
Alternative Project), and keeps the Claim layer light per the engine-first
principle above, while still giving PD something real and searchable of its own
rather than a bare, breakable link.

`MODEL.md` §6 sets out what a *full* knowledge store would preserve per claim —
useful as the ceiling to know about, not the floor PD has to build to. **Source:**
`MODEL.md` §6, §7 #3.

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
| 1 Sept 2026 | **A1 — Gates reduced to two hard rules.** No G1–G6 committee/gate machinery in the rebuild. Was already the default per `REUSE-RULES.md`; now a ruling, not a default. |
| 1 Sept 2026 | **A2 — Combination Bank is a register beneath Bet/Run**, not a tenth object. Model stays fixed at nine. |
| 1 Sept 2026 | **A3 — Cost is OUT of PD.** Ground-rule 0 applies platform-wide. The candidate cost engine does not carry into the rebuild; removed from `REUSE-RULES.md` §2 whitelist; `CLAUDE.md` §2 corrected. |
| 1 Sept 2026 | **A4 — Concept-first is allowed, not just Problem-first.** A stated product concept is a valid starting point without a fabricated Problem. **Mechanism also settled same day:** Problem gets a `kind` flag (`field_problem` \| `product_concept`) rather than a new object or a nullable parent — no change to object count, registering either kind is a direct action, not a fourth door. |
| 1 Sept 2026 | **C1 — `Sulfur` is the correct spelling.** `Sulphur` entries are the same substance under the wrong spelling; merge/rename as a master-data correction. |
| 1 Sept 2026 | **C2 — MAP graded as 4 grades** (12-61, 10-61, 10-52, 11-44 N-P₂O₅), **DAP as 1 grade** (18-46). No longer ungraded buckets. |
| 1 Sept 2026 | **Backfill principle agreed: retrospective-only, invited on reopen.** Applies only to a Problem someone actively reopens — not a blanket effort to log every dead project. A backfilled Bet/Run is flagged as recorded retrospectively (roughly when the work happened vs. when it was written down), content bar is low (what was tried + what happened/why it stopped, no forced precision, nothing fabricated to fill a field), owned and protected the same as any Claim/reclassification (no per-person error count, ever — B13's rule extends here), and it is never a gate on opening new Questions against the reopened Problem. Test case: the bio-boiler fly-ash MOP-recovery project (parked; PKR context: Pakistan imports ~80,000 t/yr MOP, VAN uses MOP as a raw material) — reopened with new Questions (silicon recovery, direct fly-ash use, liquid-only route, a new liquid-MOP product) while the original extraction/drying attempt gets backfilled as the closed first Question/Bet under the same (widened) Problem. |
| 1 Sept 2026 | **B8 — Problem dossier is its own screen.** Browsable across every Problem at once. Screen count now 3 (sign-off given). |
| 1 Sept 2026 | **B19 — Leadership/portfolio view, needed now.** 4th screen (sign-off given). Aggregate KPI tiles + overdue feed + recent-closes feed. Never a per-person breakdown. |
| 1 Sept 2026 | **C5 — Evidence: light native + link.** A real lightweight Claim (owner, grade, one-line scope) lives in PD; the deep source material stays where it already lives, pointed to rather than duplicated. |
| 1 Sept 2026 | **`combination-bank/RULES.md` §2 reconciled to A2** — register beneath Bet/Run, matching this file. Was still marked "OPEN" in that file; corrected so the two documents cannot be read as disagreeing. |
| 1 Sept 2026 | **B9–B12 vocabularies and search spec drafted into `combination-bank/RULES.md`** (§4.1 technique, §4.2 role/phase, §9.1 mechanism, §9.2 sentence-answer search) — drafted directly from Maleeha's own session language, not invented from nothing, but **not yet confirmed by Tahir**, same status as the crop/soil/problem vocabularies (B4). |
| 1 Sept 2026 | **B5 pilot started, not finished.** The fermentation-source Question, both hypotheses, and the kill criterion written down in `PILOT-001-fermentation-source.md`, transcribed from `WORKED-CASE-V-GERMINATOR-PRO.md` §4.1. Awaiting Himmayat's correction and the next real observation. |
| 1 Sept 2026 | **B16 cross-product signal design drafted** into `combination-bank/RULES.md` §9.3 — trigger events, auto-generated Observation delivery (no tenth object), substance-level matching, active-work-only scope. **Not yet confirmed by Tahir.** |
| 1 Sept 2026 | **First partial return on B2/B3** — 21 new materials named (3 identities clarified: SPM = Sugar Press Mud, Poltary = Poultry Waste/OM, MEA perkin = Monoethanolamine from supplier Perkin), 11 assay figures confirmed as real lab data on existing candidate rows. Grades for the new rows, and most of the original 24 candidates, still open. Archived: `combination-bank/PD-Material-Grade-Template-RETURNED-1Sep2026.xlsx`. |
| 1 Sept 2026 | **Engine-first, Claims are memory — not a gatekeeper.** Ruled in discussion of AI-assisted research and the Combination Engine (`docs/pd-model/combination-bank/`). The **Combination Engine** — configure materials / design space / constraints → ranked candidates → make → test → write the result — is PD's daily-use core, and must stay frictionless: nothing academic required to run it. The **Claim/evidence layer** (grading, challenge, provenance — `MODEL.md` §6) is optional enrichment for institutional memory, so the next person doesn't repeat a dead end — it is **never a precondition** for making or testing a combination, and logging or grading a claim must never be required before someone can act. Only the two hard rules in `MODEL.md` §0 are required: write the question before work, write the result on close. **Why this matters:** without this guardrail, a claims-review discipline can quietly rebuild the gate/committee problem A1 just removed — a review board in a new costume, arguing over evidence instead of arguing over sign-off. Tahir's framing: don't let AI-driven research turn into an academic claims debate that displaces product development and the system's core focus. Also settled in the same discussion: a **deterministic combination/screening engine** (mass balance, stoichiometry, an explicit design space and constraints — the shape already proven outside PD by the DAP Alternative Project's Phase 1 screening tool, `E:\NP\DAP Alternative Project\02_Prediction_Engine`) is the right model for "AI-assisted research" inside PD; **language-model literature synthesis is not** — VAN's own dated finding on that project was that general literature search (Scite) returned unusable results for this niche chemistry, and formulation chemistry must trace to a written rule, never be invented by an LLM. Source: this session, 1 Sept 2026 (no separate write-up file yet). |

---

## E. How to use this file

- **Before writing any PD code**, read section A. If anything there is unanswered,
  the answer is not "start on the parts that don't depend on it." (As of 1 Sept
  2026, §A is fully answered — this rule now matters for whatever lands in §A next.)
- When a decision lands, **move it to section D with the date** — do not delete it.
  A settled decision with no record gets relitigated in three weeks.
- When something new blocks the work, add it here rather than carrying it in a
  session that will end.
