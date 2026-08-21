# PD — The Combination Bank: the rules

_Written 18 August 2026, from a working session with Tahir (COO). This file is
**rules, not code**. Any implementation must satisfy what is written here. If code
and this document disagree, **this document wins** until Tahir signs a change._

**Status: DESIGN AGREED, NOT BUILT.** Nothing in `pd/` has been touched. No schema
exists. No route exists. The only artefact is the visual demo beside this file,
which is a picture of the agreed behaviour, not an implementation.

**Read alongside:** `../MODEL.md` (the nine-object PD model, same folder — see §2,
there is an unresolved tension) and `How we develop products now.docx` (Tahir's
team charter, canonical).

---

## 1. What this is for

VAN generates combinations constantly — in idea sessions, at the bench, on paper,
in conversation. Most are never made. Almost none are written down anywhere a
second person can find them. Six months later nobody can answer *"did we ever try
MAP with humate at 3% zinc for NP 5-40, and what happened?"*

The Combination Bank is the place that answers that question.

**The rule it exists to serve:**

> Every combination anyone thinks of is written down once, tagged with the problem
> it answers and what it was thought up against, and is findable by anyone from
> that day forward — including the ones we killed, and especially the reason we
> killed them.

Two things follow that are easy to get wrong:

1. **A dead end is not waste, it is the asset.** A killed combination with a
   written reason stops the same dead end being walked twice. The bank is
   therefore not a catalogue of good ideas; it is a record of *all* ideas.
2. **The bank is a register, not a workflow.** It does not approve, schedule or
   gate anything. Work still travels the PD pipeline. The bank only remembers.

---

## 2. Where it sits — an OPEN question, not settled

`MODEL.md` §3 defines **nine objects and no more without Tahir's sign-off**, and
warns that a seeming tenth is "almost certainly one of these nine in a new coat."

The Combination Bank is either:

- **(a) a tenth object** — a Combination, standing alongside Problem / Question /
  Bet / Run / Claim / Challenge / Observation / Request / Constraint; or
- **(b) a register beneath Run and Bet** — a combination is the *recipe* a Run
  makes, and an un-run combination is a Bet that never got a Run.

**This is not decided, and it must be decided before any schema is written.**
Reading (b) is the more conservative one and keeps the nine intact; reading (a) is
honest about the fact that most rows in this bank will never have a Bet or a Run
behind them — they are ideas that were had and never taken up, which is precisely
their value.

Until Tahir rules: the rules below describe the *behaviour*, which is the same
either way. Only the storage decision waits.

---

## 3. Naming

It is called the **Combination Bank**.

**It must not be called the Library.** PD already has a Library
(`pd_library_items`) — the reading room of notes, links and uploaded documents,
already built, already tested, already in the menu. Two things called "the
library" in one module guarantees that a conversation about one of them is
understood as the other.

---

## 4. The record

One combination is one record with two parts.

### 4.1 The combination itself

| Field | Rule |
|---|---|
| Combination number | Assigned on save, permanent, never reused. Identity never changes. |
| Code | Required. The working name a person uses. |
| Name | Required. What it is, in words. |
| Status | Required. One of: idea · screened · selected · bench · formulation · parked · killed · external. |
| Origin | Required. internal · ai_session · competitor · literature · dropbox. |
| Thought up against | Required. problem · idea · product · project · none — plus the specific thing named. |
| Project | Optional. Blank is normal and fine; most ideas belong to no project. |
| Form | Required. granular · liquid · SC · powder · coated. |
| Route | Required. soil · foliar · fertigation · seed treatment. |
| Problem tags | Required. From the controlled list. |
| Crop tags · Soil tags | Optional. From the controlled lists. |
| Rationale | Required. One line: what it tests, or why it was parked or killed. |
| Source · Recorded on | Required. Where it came from, and when. |

**Rationale is required and is the point of the whole record.** A combination
without a written reason is a recipe, and a recipe nobody can explain is worth
nothing to the person who finds it in a year.

### 4.2 Its material lines — one row per material

Composition is **never free text**. It is a set of lines, each one:

- a **material grade**, picked from the register (§5) — never typed;
- an **inclusion %**;
- an optional line note.

**Inclusions must total 100%** (use a filler or "water q.s." line). Outside
99.5–100.5% the row does not save.

### 4.3 Analysis is computed, never typed

N · P₂O₅ · K₂O · S · Zn are **derived by mass balance from the material assays**.
They are not entry fields and must never become entry fields.

Consequence, accepted deliberately: if a grade has no assay on file, the analysis
cannot compute and the record says so plainly. **That is the correct behaviour.**
It turns a gap in the master data into a visible worklist rather than an invitation
to type a plausible number. Filling one grade's assay fixes every combination that
uses it, at once.

---

## 5. The material register

### 5.1 It is held at GRADE level

A material is not one thing. MAP has several grades; phosphoric acid has more. The
register's row is therefore **a grade**, not a substance — "MAP 11-52 imported",
not "MAP". A grade carries its own assay.

VAN's existing master already works this way in places: `Phosphoric Acid 60% / 65%
/ 75%`, `Grinded Lignite 25% / 55%`, `Zinc Sulfate Mono 33%` vs `Powder 33%`,
`MOP` / `MOP Powder` / `MOP Granular`, `Copper Sulfate` vs `Copper Sulfate-Imported`.

### 5.2 Supplier is NOT part of a grade's identity

Decided 18 Aug 2026. Two grades differ by their **spec**, not by who sold them. If
this ever changes it is a deliberate decision by Tahir, not a drift.

### 5.3 Only a moderator adds to the register

Nobody entering a combination can create a material. This is the single mechanism
that makes normalisation hold: if names cannot be typed, two people cannot spell
the same thing two ways, and the duplicate check becomes exact rather than a guess.

### 5.4 But nobody is ever blocked by a missing material

A person needing a material that is not registered:

1. requests it, describing what they mean in free text — **that text never becomes
   a material name**;
2. their combination **still saves**, flagged;
3. a moderator adds the real grade once, and every row waiting on it resolves to
   that id.

### 5.5 Every material carries a "grade not yet decided" placeholder

Idea-stage work routinely predates the sourcing decision. Forcing a grade that
early would either stall the idea or put a fictional grade on record. A recipe
holding a placeholder is fully searchable and fully valid — it simply can never be
called an exact repeat (§7.2).

### 5.6 It must be PD's existing `pd_materials` register

Not a second list. PD's candidate screen already stores material + inclusion% in
exactly this shape. **Two material registers drift apart within a month and the
costing arithmetic stops agreeing with the bank.**

---

## 6. How records get in

Two routes only.

### 6.1 One at a time — a form with a lines editor

Header fields, then material lines beneath. Constrained fields are dropdowns.
Material is a two-step pick: substance, then grade.

**A wide entry grid does not work here** and was abandoned once composition became
child rows — a four-line recipe cannot be nested inside one grid row and stay
readable. Bulk entry belongs to import.

### 6.2 A batch — an uploaded file, in either of two shapes

- **Shape A — one flat file.** The combination code repeats once per material row;
  header fields repeat or stay blank after the first line. Easiest to produce in
  any spreadsheet.
- **Shape B — two sheets.** `combinations` and `combination_lines`, joined on the
  code. Mirrors the storage exactly.

The importer detects which shape it was given. Both templates are downloadable
with the register and vocabularies embedded as dropdown lists.

**The header check runs before anything else.** A missing, renamed or reordered
column rejects the file and names the exact difference.

### 6.3 Free paste is NOT an entry route

Deliberately removed. Pasting cannot be validated honestly because nothing forces
the column order, and the format drifts within weeks. A file against a published
template cannot drift.

### 6.4 An unmatched material name in a file never creates a material

The row still imports — flagged, with the unmatched text preserved exactly as
written — and a moderator maps it once. **The importer never invents a material.**

---

## 7. Duplicate rules

The whole design serves one sentence:

> **Hard stop only on clear evidence. Anything less comes in, flagged, and a
> moderator settles it. Nothing is ever refused because the app was unsure.**

### 7.1 What counts as clear evidence

All five, or there is no stop:

1. same material **grades**,
2. same inclusions (±0.5%),
3. same form,
4. same route,
5. **same problem / against-ref**.

The fifth matters most. **The same recipe entered against a different problem is
not a duplicate** — it is the same chemistry reached from another direction, which
is exactly what the bank exists to reveal.

### 7.2 Grade specificity gates the hard stop

A fingerprint is only *provable* when **every line on both records names a real
grade**. If either holds a "grade not yet decided" placeholder, the pair can never
hard-stop. They may look identical and be different things, and **the app will not
assert what it cannot prove.**

### 7.3 The four bands

| Band | Meaning | What happens |
|---|---|---|
| **Identical** | All five signals match, both fully graded. | **Hard stop.** Does not save. One way through: save it as a **repeat run**, linked to the original, carrying its own date and reason. |
| **Variant** | Same grades at different inclusions, or the same materials at different grades, or the same recipe aimed elsewhere. | **Saves, flagged pending review.** Sibling link recorded. |
| **Related** | Different chemistry, same intent — same problem, crop, route. | **Saves, flagged pending review.** |
| **Clear** | Nothing close. | Saves confirmed, no flag. |

**A ratio is the experiment, not a duplicate.** Humate at 5% versus 8% is a
finding. Swapping 52% phosphoric acid for 61% is a finding with a cost consequence.
Treating either as a repeat erases the work.

### 7.4 Within one recipe

- **The same substance at two different grades is legitimate** and common — a blend
  can carry two MAP grades. A rule of "MAP cannot repeat" would block honest work.
  **The no-repeat rule sits on the grade, never on the substance.**
- **The same grade twice** is an arithmetic slip, not a recipe. Flagged with a
  one-click merge. **Never blocked.**

### 7.5 What the checker compares, and how it must speak

Weighted: composition fingerprint (40) · material overlap (20) · computed-analysis
distance (15) · tag overlap (15) · wording (10).

**It must always name its evidence** — *"same material set, inclusions differ ·
computes to about the same analysis · same problem/crop/route"* — and never show a
bare score. A person can argue with a reason. Nobody can argue with 82%.

### 7.6 The alias table

Because composition is now grade ids, name-matching is gone from the live path. The
alias table survives in exactly one place: **mapping names inside an imported file
to register ids.**

**Standing rule:** it may map synonyms of the same substance (MAP = mono-ammonium
phosphate) and **never a chemistry family**. Mapping Zn-EDTA and ZnSO₄ both to
"zinc" would hard-stop two genuinely different things. A *missing* alias only ever
fails toward the queue — the safe direction.

### 7.7 "Not the same, because…" is remembered

Dismissing a pair records a permanent not-a-duplicate link. That pairing is never
raised again, for anyone. The checker must stop nagging about a question already
answered.

---

## 8. Moderation

### 8.1 A flagged record is a full citizen

It is in the bank and in search **from the moment it is entered**. The flag says
*not yet confirmed*, never *not yet real*. Nothing is held outside where nobody can
find it.

### 8.2 The moderator group is configurable

Granted in Admin like any other PD surface — Custodian, Registrar and COO to start,
but **whoever Tahir empowers**. It is not hard-coded to a role.

### 8.3 The verdicts

| Verdict | Effect |
|---|---|
| **It is its own thing** | Flag clears; a permanent not-a-duplicate link is written (§7.7). |
| **Variant of …** | Flag clears; sibling link recorded; both stay independently searchable. |
| **Merge into …** | Folds into the existing combination as a repeat entry. Its rationale, source and date are kept on the parent. **Nothing is ever deleted.** |
| **Needs the author** | Sent back with a question. Stays pending and keeps ageing. |

A moderator says what a record **is**. A moderator does not decide whether it may
exist.

### 8.4 Unactioned items escalate; they never auto-accept

Three days without a verdict and the item appears in the moderator's My Work with
an ageing counter, and keeps appearing. **No auto-accept**: a person decides, or it
keeps asking. A queue that clears itself is a queue nobody reads.

### 8.5 Any record can be corrected, re-typed and re-parented

The same principle as `../PENDING-DECISIONS.md` B13, applied here: a combination filed
against the wrong problem, tagged with the wrong mechanism, or holding the wrong grade
on a line **must be correctable without being re-entered**, by the moderator group.

- The combination keeps its number through any correction.
- The correction is recorded — what it was, what it became, who, when — and the
  original values are never overwritten in place.
- The person who entered it is told what changed.
- A correction that changes a material grade **re-runs the duplicate check**, because
  the fingerprint has changed. If that turns the record into an exact repeat of
  another, it goes to the queue — it is never auto-merged behind someone's back.

### 8.6 Material requests sit in the same queue

Add to the register · map to an existing grade · decline with a reason. Same
three-day escalation.

---

## 9. Search

- Full-text across code, name, materials, rationale, against-ref, project, tags.
- Facets: problem · crop · soil · contains material · contains grade · grade
  completeness · form · route · thought-up-against · origin · project · status ·
  review state. **AND across groups, OR within a group.**
- **Two doors, one store:** a global search, and the same rows filtered inside a
  project. Nothing is stored twice.
- Pending records appear in results, marked.

---

## 10. What is real and what is not — read before building

| Thing | Status |
|---|---|
| The 51 raw materials in `data/state.json` (O2S masters) | **Real.** Read verbatim. Names exactly as VAN wrote them. |
| Grades split from those names | **Derived**, only where the name carried an unambiguous token (%, Powder/Granular/Mono, Imported, Mesh, WDG). |
| Assays for those 51 | **Do not exist anywhere.** Tahir is supplying them. |
| Every other grade in the demo | **Invented by Claude** to show the mechanism. Marked "demo". Must be confirmed or dropped before it is master data. |
| The demo's crops, soils, problems, projects | **Invented.** Real controlled lists still needed. |
| The 46 recipes in O2S masters | **Real**, with real inclusions. Decided 18 Aug: the bank starts **empty**; these are not loaded. |

**Two findings in the real master that need Tahir's decision:**

1. **`Sulfur` and `Sulphur` both exist** — `Sulfur Fine (WDG)-A` against `Sulphur
   WDG` and `Sulphur Grinded- 200-250 Mesh`. The app will treat them as two
   different substances, so a recipe using one will never match a recipe using the
   other. Not corrected: changing a master-data string is a data change and needs
   Tahir's word.
2. **`MAP` and `DAP` are listed with no grade at all.** Under §7.2 nothing built on
   them can be hard-stopped until a grade is named. Safe, but they are the first
   two worth grading.

---

## 11. Open decisions — do not code past these

1. **Tenth object, or a register under Bet/Run?** (§2.) Blocks the schema.
2. **The real material and grade list.** Tahir is sending additions; the demo's
   invented grades stay until then and must then be confirmed or dropped.
3. **The assay figures.** Tahir is supplying. Until then computed analysis is blank
   for most of the register — by design, not by fault.
4. **The controlled vocabularies** — crops, soils, problems, forms, routes. All
   currently invented.
5. **`Sulfur` / `Sulphur`** — merge, or keep as two? (§10.)
6. **Should the 46 existing recipes ever be loaded?** Currently no. The cost of
   "no" is that the checker cannot tell someone their new idea is already a product
   VAN sells. Reversible later; it is a one-off load, not a redesign.
7. **Weights and thresholds in §7.5** are Claude's, untested against real data.
   They need tuning once real rows exist. Nobody should treat them as tuned.

---

## 12. What must not happen

1. **No free-text material names.** Ever. This is the load-bearing rule; everything
   else in §7 collapses without it.
2. **No typed analysis figures.** Computed or blank.
3. **No second material register.** (§5.6.)
4. **No hard stop on anything short of §7.1's five signals**, all provable.
5. **No auto-accept of anything sitting in a queue.**
6. **No deletion.** Merged, parked and killed records keep their number and their
   reason forever. The killed ones are the memory.
7. **No alias mapping a chemistry family.** (§7.6.)
8. **The bank must not be called the Library.** (§3.)

---

## 13. Provenance

- Session: 18 August 2026, Tahir + Claude (Cowork). Module declared: **PD**.
- Decisions were taken one at a time in conversation; each rule above traces to one.
- Visual demo of the agreed behaviour: `combination-bank-demo-v6.html`, this
  folder. Standalone HTML, opens in any browser, dummy data, wired to nothing.
- **No code was written. Nothing under `pd/` was modified. Nothing was pushed.**
- Superseded working versions of the demo (v1–v5) were not kept; v6 is the only one
  that carries every decision.
