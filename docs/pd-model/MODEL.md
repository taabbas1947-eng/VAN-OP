# PD — The Model (build spec)

_This folder is the source of truth for the PD rebuild. Any PD code must satisfy
what is written here. If code and this document disagree, the document wins until
Tahir signs a change. Written 18 Aug 2026, from an eight-scenario design session
with Tahir (COO, driver of PD)._

**Read `How we develop products now.docx` first — that is the team-facing charter,
authored by Tahir, and it is canonical. This file is the engineering translation.**

---

## 0. What PD is for (do not lose this)

PD's job is **not** to track product development. It is to make VAN capable of
**reaching a conclusion**, and to make the reasoning survive the person who had it.

The two rules the whole system serves, in Tahir's words:

> **Nothing gets made until we have written the question it answers.
> Nothing gets closed until we have written the result — pass, fail, or parked, and why.**

The primary object is therefore **not a project and not a sample**. It is a
**question under an owner**, and a **claim that can be graded and challenged**.

---

## 1. Canonical facts (Tahir's numbers — supersede any earlier figures)

- ~**100+ samples/month**, roughly half genuine PD attempts.
- **5 years → 1 patent, not more than 2 breakthrough products.**
- The failure is not skill. It is: samples made before the question is agreed,
  and work stopped without the result written down.

## 2. Standing corrections (design guardrails — Claude got these wrong once)

1. **VAN sells use efficiency (NUE), not nutrient tonnage.** Lower analysis is the
   product's point, never the alibi. A high-NUE product is *meant* to match a
   higher-analysis competitor at lower loading. Do not "explain away" an
   underperformance complaint as an unequal-kg comparison — for VAN that reasoning
   is usually wrong.
2. **The `E:\NP` evidence base is the reference base for the PHOSPHORUS work only**,
   not the whole of VAN's knowledge. Do not generalise its silences (e.g. "nothing
   on potassium") to the company.
3. **The research model informs; it does not overrule lived experience.** Humic is
   the worked case: the evidence base does not say humic fails — it says the
   *fixation-reduction explanation* fails, while the *root/biostimulant* effect is
   real and the Pakistani field result is positive. Trust **claims**, graded, not
   **sources**, ranked.
4. **The correct first move is almost never a sample.** Across eight real scenarios
   it was one question back, a desk calculation, or a measurement on retained
   samples — under a day, done by someone outside the lab.

---

## 3. The object model — NINE types, and no more without Tahir's sign-off

### The spine (4) — the path work travels
- **Problem** — a real field/market pain, **or a stated product concept**
  ("100% nutrition with Fe and Mn"). Few, long-lived. *P fixation in our soils.*
  **Carries a `kind` flag: `field_problem` | `product_concept`** (settled 1 Sept
  2026, `PENDING-DECISIONS.md` §A4 — mechanism decided same date). A concept is not
  a lesser or fabricated Problem — it gets the same shape and the same job: a single
  long-lived parent that every Question/Bet/Run aimed at it hangs off. This is what
  the V Germinator Pro case needed — one concept, three formulations (SOP → KOH →
  potassium carbonate), months of chained Runs, all under one parent
  (`WORKED-CASE-V-GERMINATOR-PRO.md` §1). No new object, no new door; object count
  stays at nine.
- **Question** — something we must know to solve a Problem. Has a **nature**
  (agronomy · chemistry · production · commercial · regulatory), **one owner**, a
  **state** (open · contested · settled), and a due date.
- **Bet** — a specific approach taken because we believe something, carrying the
  **one result that would kill it**, written before any bench work.
- **Run** — one recipe made and measured. Fast, many per Bet. Records
  **expected vs actual**.

### The atom (1) — how knowledge and team brains enter
- **Claim** — an assertion with an **owner** and an honest **grade**
  (proven · contested · believed). Anyone may **challenge** it. This is how tacit
  team knowledge and the evidence base both enter. Lived experience is a valid,
  gradeable claim ("observed in our products; mechanism unknown; uncontrolled").

### The doors (3) — how anything gets in (ONE intake screen; triage classifies)
- **Challenge** — a complaint on a product we already sell (Maxim, NP 11-44).
  Usually carries a buried, unverified claim that must be made measurable first.
- **Observation** — a result or material that arrived (Rudolf's two variants; the
  boiler fly-ash sample). Not a complaint, not an idea.
- **Request** — someone wants a sample or product made (the multinational; Sheikh
  Arshad). Has requester, purpose, recipient, dispatch date, owner, return-by.
  **This is the Rudolf/customer-sample fix — the object PD currently cannot hold.**

**Registering a Problem (either `kind`) is a direct action, not a fourth door.**
Settled 1 Sept 2026 alongside the `kind` flag above: a person who already knows
they have a field problem or a product concept states it directly, rather than
going through triage as if it had arrived from outside. The three doors stay three.

### The constraint layer (1) — eliminates options, inherited not re-typed
- **Constraint** — a rule that kills options (blending, storage/CRH, logistics/
  freight, regulatory, plant capability). Hangs off a small register of
  **delivery contexts** (soil broadcast · side-dress band · fertigation · foliar ·
  ULV drone · seed treatment). A context is defined **once**; every product aimed
  through it **inherits** its constraints. This is the no-duplication mechanism on
  the delivery side.

**Rule that keeps it lean:** the **product** carries its chemistry; the **delivery
context** carries its constraints; a **Bet** is a product aimed through a context
and inherits both.

**Discipline for future design:** if a new situation seems to need a *tenth* object,
it is almost certainly one of these nine in a new coat. A genuine tenth is a signal
the model is wrong — escalate to Tahir, do not just add a box.

---

## 4. Key relationships (what the schema must express)
- `Question —belongs_to→ Problem` **(unchanged — still mandatory. See §3: a
  Problem may itself be `kind: product_concept`, so this relationship covers both a
  field problem and a stated concept without a nullable parent or a second object.)**
- `Claim —answers/attaches_to→ Question`  ·  `Claim —challenges→ Claim`
- `Bet —tests→ Question`  ·  `Bet —carries→ kill_criterion (mandatory, pre-bench)`
- `Run —under→ Bet`  ·  Run has `expected`, `actual`, `read`
- `Challenge | Observation | Request —enters_as→ (triaged into the spine)`
- `Constraint —eliminates→ DesignOption`  ·  `Constraint —belongs_to→ DeliveryContext`
- Every object: **owner, state, and a written reason on close.** Nothing is deleted;
  killed/parked things keep their number and reason forever (the memory moat).

## 5. What a person actually sees — FOUR screens, by deliberate sign-off

Target was **two**. `REUSE-RULES.md` §5's drift tripwire says a 3rd screen stops
the rebuild and needs Tahir's explicit sign-off before continuing — that sign-off
was given twice, 1 Sept 2026, both recorded in `PENDING-DECISIONS.md` (§B8, §B19).
This is drift made **on purpose and on the record**, not drift that crept in.

1. **"What came in"** — the single intake door. Everything that shows up here
   first: a Challenge, an Observation, a Request (the three doors, §3), or a
   Problem/concept stated directly. One screen, no need to classify before it
   saves — triage classifies.
2. **"What I owe"** — my assigned questions, who waits on each, by when; late
   shows as late — including Requests waiting on my reply and intake items
   waiting on my triage. The only per-person scoreboard.
3. **The Problem Dossier** (3rd screen, sign-off `PENDING-DECISIONS.md` §B8) —
   every Problem, browsable at once, with everything ever aimed at it: Questions,
   Bets, Runs, Claims, combinations tried. Answers Maleeha's *"what have we
   already learned about a problem across every bet we've run against it."*
4. **The Report** (4th screen, sign-off `PENDING-DECISIONS.md` §B19) —
   portfolio-wide KPI tiles plus a needs-attention feed and a recently-closed
   feed. **Aggregate only, never a per-person breakdown** — the same no-blame
   guardrail `RECLASSIFICATION-RULES.md` sets for corrections applies here by the
   same logic.

Everything else (claims, grades, the full nine as raw records) is back-of-house.

---

## 6. Knowledge must not be flattened (the library requirement)

The current `pd_library_items` / `pd_learnings` tables (title + `evidence` ENUM of
three values) **cannot hold the evidence base without destroying it.** A rebuilt
knowledge store must preserve, per claim:
- **scope conditions** (pH range, CaCO₃ range, soil, duration) — e.g. biochar works
  <pH 7.5, nothing above; Punjab is above.
- **endpoint class** (soil-chemical vs plant-uptake vs yield vs economic) — soil-P
  gains routinely far exceed yield gains.
- **independence** (independent vs manufacturer-affiliated) as a queryable field.
- **retrieval provenance** separate from confidence.
- **correction history** (versioned; five conclusion-changing corrections already
  exist — never overwrite in place).
- **do-not-quote** state (louder than a citation).
- **not-reported vs not-measured vs not-entered** as three distinct states.
- **typed quantities** — P vs P₂O₅ never a bare number.

---

## 7. Decisions — status 1 Sept 2026 (full record: `PENDING-DECISIONS.md`)

1. **Gates — SETTLED.** Reduced to the two hard rules in §0. No G1–G6
   committee/gate machinery in the rebuild.
2. **Cost in PD — SETTLED.** Cost is OUT of PD. Ground-rule 0 ("this system does
   not manage cost") applies platform-wide, no PD exception. The candidate cost
   engine does not carry into the rebuild (`REUSE-RULES.md` §2).
3. **Combination Bank — SETTLED** (raised after this list was first written; see
   `PENDING-DECISIONS.md` §A2). Register beneath Bet/Run, not a tenth object. The
   nine-object model in §3 is unchanged.
4. **Must work start from a Problem? — SETTLED, mechanism SETTLED.**
   Concept-first is allowed. Mechanism: Problem gets a `kind` flag
   (`field_problem` | `product_concept`) rather than a new object or a nullable
   parent — see §3. `PENDING-DECISIONS.md` §A4 has the full record. This item is
   now schema-ready.
5. **Evidence base into PD, or linked?** Still open. Rebuild the library per §6,
   or keep it in `E:\NP` and link. Rebuild is the bigger, righter job.
6. **Migration vs greenfield.** Still open in principle, but `REUSE-RULES.md`
   already settles the practical answer: rebuild the core, reuse only the six
   whitelisted components (now five — the cost engine was removed 1 Sept 2026).
7. **Pilot before software.** Still open, and still arguably the cheapest next
   move. Run ONE live question in the open first (humic mechanism, or NP 11-44
   NUE — both are ready, and the V Germinator Pro fermentation question is a
   third candidate already running) to prove the discipline changes behaviour,
   before spending on the build. The empty `NP 5-40` folders are the warning: a
   perfect empty container is what VAN produces when structure exists but nobody
   owes an answer.

---

## 8. Provenance
- Full reasoning and the eight stress-test scenarios: this session.
- Divergence analysis of the existing build vs this model:
  `PD-DIVERGENCE-REPORT` (delivered to Tahir; not in repo).
- Team charter (canonical, Tahir-authored): `How we develop products now.docx`,
  this folder.
