# PD — OP Handoff

*Product Development (`pd/`). Split out of `OP-HANDOFF.md` on 23 September 2026.
Entries are in their original order; nothing was edited, reworded or dropped.*

> ## The rule for this file
>
> **One file per module.** PD work is recorded here and nowhere else. O2S work
> goes in `OP-HANDOFF-O2S.md`. Anything genuinely spanning both goes in
> `OP-HANDOFF-SHARED.md`, and should be rare — the module rule already says
> never edit two modules in one change.
>
> **Never rewrite this file from a copy you have been holding.** On
> 23 September 2026 the same entry was lost three times that way: a session
> read the file, worked for a while, then wrote back a whole-file rebuild from
> its stale copy, silently deleting everything another session had appended in
> between.
>
> Before every write:
> 1. **Re-read this file from disk immediately before writing.** Not a copy
>    read earlier in the session.
> 2. **Append only.** New entries go at the end. Never regenerate the file.
> 3. **Assert that your new text begins with the exact bytes you just read.**
>    If it does not, stop and re-read.
> 4. **Read it back after writing** and confirm both the previous last heading
>    and your new heading are present.
>
> A correction to an old entry is a single exact string replacement on freshly
> read content, with the target asserted to occur exactly once. **Never delete
> an entry** — corrections are appended and cross-referenced.

---

> **STATUS ADD — 2026-09-01 (cloud session, later same day): PD · §B RULINGS (B8/B19/C1/C2/C5), THE PROTOTYPE, AND B5/B9–B12 DRAFTS. STILL NO SCHEMA CODE. NOT PUSHED.**
>
> **Module worked in: PD.** Docs only — `pd/` untouched. Files changed this round: `docs/pd-model/PENDING-DECISIONS.md`, `docs/pd-model/MODEL.md` §5, `docs/pd-model/REUSE-RULES.md` §5, `docs/pd-model/combination-bank/RULES.md` (§2, §4.1, §4.2, §7.1, §9, §11), new file `docs/pd-model/PILOT-001-fermentation-source.md`. `OP-HANDOFF.md` (this entry).
>
> **Rulings this round (Tahir):**
> - **B8** — Problem dossier is its own screen, browsable across every Problem. This is the explicit sign-off `REUSE-RULES.md` §5 requires for a 3rd screen.
> - **B19** — a leadership/portfolio Report view, needed now, not deferred. 4th screen, sign-off given. Aggregate-only KPI tiles + needs-attention feed + recently-closed feed — **never a per-person breakdown**, same guardrail as `RECLASSIFICATION-RULES.md`.
> - **C1** — `Sulfur` is the correct spelling; `Sulphur` entries are the same substance, merge.
> - **C2** — MAP is 4 grades (12-61, 10-61, 10-52, 11-44); DAP is 1 grade (18-46).
> - **C5** — evidence base is "light native + link": a real lightweight Claim lives in PD; deep source material (e.g. `E:\NP`) stays where it is, pointed to, not duplicated.
> - **Engine-first, Claims are memory — not a gatekeeper**, and the **backfill principle** (retrospective-only, invited only on an actively reopened Problem) both recorded in `PENDING-DECISIONS.md` §D, tested against the bio-boiler fly-ash MOP-recovery case Tahir reopened this session.
>
> **A clickable prototype was built** (Cowork artifact, not committed to this repo — throwaway HTML/JS, not a schema). It went through real critique and rebuild, not just one pass: renamed "Leadership Report" to "Report"; added a Source/reference field on Bet and Claim so a document, folder or paper attaches as a pointer, matching C5; fixed the Combination Engine's candidate scoring, which had been showing a ₨/kg cost figure — a direct contradiction of the settled A3 ruling (cost is out of PD) — now scored on mass-balance/design-space fit only. Then, in response to "this app is still a data entry app": built the three doors (Challenge/Observation/Request) into "What came in" as real intake objects with owner, status and a triage action — previously the prototype only let people log Problems directly, which was the actual substance behind "no direction, no visibility, no clarity of who's asking, who's replying"; made the Combination Engine the front door for placing a Bet instead of a buried toggle; added a Related-from-Dossier panel that surfaces matching past Claims automatically on the Question screen.
>
> **B5, the paper pilot, is started, not finished.** `PILOT-001-fermentation-source.md` writes down the fermentation-source Question, both hypotheses (molasses / amino acids), and both kill criteria — transcribed from Himmayat's own words in `WORKED-CASE-V-GERMINATOR-PRO.md` §4.1, nothing invented. Waiting on Himmayat to correct it and write the next real observation directly into the file. **Still the cheapest, most overdue move on the whole page** — writing it down is not the same as running it.
>
> **B9–B12 vocabularies drafted into `combination-bank/RULES.md`**, not ruled on by Tahir: technique (§4.1, seven values, now a 6th duplicate-check signal at §7.1), material role + phase (§4.2), mechanism/intent (§9.1), and the sentence-answer search spec with the honest-negative and ours-vs-the-world's rules (§9.2). All drafted directly from Maleeha's own session language (recorded in `PENDING-DECISIONS.md` B9–B12), not invented from nothing — but explicitly flagged as unconfirmed, same status as the crop/soil/problem vocabularies (B4). Also caught and fixed in the same pass: `combination-bank/RULES.md` §2 still read the tenth-object question as open after A2 had already settled it — corrected so the two documents cannot be read as disagreeing.
>
> **Documentation debt closed this round:** `MODEL.md` §5 rewritten from "TWO screens" to the actual four, with both sign-offs cited; `REUSE-RULES.md` §5's drift table now shows the actual screen count (4) against the target (2) rather than silently going stale.
>
> **Not done:** no schema, no code against the real app, B2/B3/B4 (real material list, assays, controlled vocabularies) still entirely owed by Tahir, B9–B12 vocabularies still need his confirmation, B13's reclassification capability (fully designed, `RECLASSIFICATION-RULES.md`) has no representation anywhere in the prototype, B14/B16/B17/B18 (Run lineage, cross-product material signal, Claims writable directly against a Problem, Observations arising inside a Run) remain designed-but-unbuilt requirements from the worked case, not yet touched this session.


> **STATUS ADD — 2026-09-01 (cloud session, latest): PD · THE FOUR SCHEMA-BLOCKING DECISIONS (§A) — ALL RULED. NO CODE. NOT PUSHED.**
>
> **Module worked in: PD.** Docs only — `pd/` untouched (no schema, no route, no migration). Files changed: `docs/pd-model/PENDING-DECISIONS.md` (A1–A4 moved to §D, dated), `docs/pd-model/MODEL.md` §3/§4/§7, `docs/pd-model/REUSE-RULES.md` §2 whitelist + §1, `CLAUDE.md` §2. `OP-HANDOFF.md` (this entry).
>
> **The four rulings (Tahir, 1 Sept 2026):**
> 1. **Gates — reduced to the two hard rules** in `MODEL.md` §0 (write the question before work starts, write the result before it closes). No G1–G6 committee/gate machinery in the rebuild.
> 2. **Combination Bank is a register beneath Bet/Run**, not a tenth object. The nine-object model is unchanged.
> 3. **Cost is OUT of PD.** Ground-rule 0 applies platform-wide, no PD exception. The candidate cost engine (`pd/pd-lib.js:188–232`, ex-works cost, ranked by rupees/kg P₂O₅) does **not** carry into the rebuild — removed from the `REUSE-RULES.md` §2 whitelist (was item #1).
> 4. **Concept-first is allowed, not just Problem-first.** A stated product concept ("100% nutrition with Fe and Mn") is a valid starting point without a fabricated Problem on top. **Not yet designed:** the concrete mechanism — a lightweight concept object, or a Bet/Question with a null Problem parent. Flagged as a new open item; do not schema `Question —belongs_to→ Problem` until it lands.
>
> **§A of `PENDING-DECISIONS.md` is now fully answered.** Schema work may proceed except where a §B item bears directly on it (read §B first, same rule as always) — and except A4's mechanism, which is real design work still outstanding despite the principle being settled.
>
> **Not done this session:** no schema written, no pilot run (§B5 — the paper pilot, e.g. the V Germinator Pro fermentation question — is still the flagged cheapest next move and is untouched), A4's mechanism undesigned.

> **ADD — same session, later:** A4's mechanism also ruled. **Recommended and accepted:** broaden Problem itself with a `kind` flag (`field_problem` | `product_concept`) rather than add a tenth object or a nullable Problem parent with an inline text field. A concept keeps Problem's shape — few, long-lived, the single parent every Question/Bet/Run hangs off — which is what the V Germinator Pro case actually needed (one concept, three chained formulations, months of Runs, `WORKED-CASE-V-GERMINATOR-PRO.md` §1). Registering a Problem of either kind is a direct action, not a fourth door — the three doors (Challenge/Observation/Request) are unchanged. Object count stays at nine. `MODEL.md` §3/§4/§7 and `PENDING-DECISIONS.md` §A4/§D updated. **A4 is now fully schema-ready — the last open item in §A is closed.** Still open and still the flagged cheapest next move: §B5, the paper pilot.


> **STATUS ADD — 2026-08-18 (cloud session, latest): PD · COMBINATION BANK — DESIGN AGREED AND WRITTEN DOWN. NO CODE. NOT PUSHED.**
>
> **Module worked in: PD.** Nothing under `pd/` was opened for edit. No schema, no route, no migration. `server.js`, `o2s/`, `launcher.html` untouched.
>
> **What this was.** Tahir asked for a searchable place to dump every combination anyone has ever thought of — tagged by the problem it answers and what it was thought up against — so nobody walks the same dead end twice ("like we did in case of NP"). The whole session was design, driven by Tahir's decisions one at a time. Six demo iterations were built and reviewed; only v6 was kept.
>
> **Where it lives:** `docs/pd-model/combination-bank/` — `RULES.md` (the rules, in words, not code — it wins over any code that disagrees), `README.md`, and `combination-bank-demo-v6.html` (standalone, opens in a browser, wired to nothing). **Read `RULES.md` before writing a line of this.**
>
> **The decisions, in brief:** composition is **one row per material**, never free text · the material register is held at **grade** level (MAP 11-52 is not MAP 10-50), **supplier is not part of grade identity** · **only moderators add materials**, but nobody is ever blocked — request it and the row saves flagged · every material carries a **"grade not yet decided"** placeholder · **analysis is computed by mass balance, never typed** · entry is a form or a template file, **free paste removed** (both file shapes accepted) · duplicates: **hard stop only on clear evidence** (same grades, same inclusions ±0.5%, same form, same route, **same problem**, and both records fully graded), everything else **saves flagged pending review and stays searchable** · moderator group is **configurable**, unactioned items **escalate into My Work after 3 days, never auto-accept** · **nothing is ever deleted**.
>
> **Data reality check (RULES.md §10):** the 51 raw materials read from `data/state.json` are real and were read verbatim, spellings included. Their assays **do not exist anywhere** — Tahir is supplying them. Every other grade in the demo is **invented by Claude and marked as such**. Tahir's instruction: leave them in place, he will say which grades and materials to add. The bank starts **empty** — the 46 real recipes in O2S masters are deliberately not loaded.
>
> **Two findings in the real master needing Tahir's word:** `Sulfur` and `Sulphur` both exist as separate substances, so recipes using one will never match recipes using the other; and `MAP` / `DAP` are listed with **no grade at all**.
>
> **Housekeeping:** `docs/pd-audit/README.md` was **replaced** and the original moved to `_to_delete/README-pd-audit-SUPERSEDED-2026-08-18.md` — it instructed the `.patch` / `git apply` workflow that `CLAUDE.md` §3.1 now forbids, pointed at four `.patch` files that no longer exist in the repo, and stated a branch status contradicting `CLAUDE.md` §3. No finding or document was lost; only the dead instructions. Three other docs that mention patches were **deliberately kept** — reasons in `_to_delete/WHY-THESE-ARE-HERE.md`.
>
> **OPEN — blocks the schema:** is a Combination a **tenth object**, or a register beneath Bet/Run? `MODEL.md` §3 fixes the model at nine without Tahir's sign-off. Also open: the real material/grade list, the assays, the controlled vocabularies (crops/soils/problems — all invented today), and the similarity weights (Claude's, untested against real data). Full list: `RULES.md` §11.
>
> **Pushed?** No. Files are in the working tree for Tahir to commit via GitHub Desktop. Changed: `docs/pd-audit/README.md` (modified), `docs/pd-model/` (new, untracked), `_to_delete/` (gitignored).
>
> **Next:** Tahir sends the material/grade additions and the assay figures; then rule on the tenth-object question; then, and only then, a schema.
>
> **ADD — same session, later:** Tahir ruled: **build on the existing app, do not delete `pd/`.** Reuse is **component-level and whitelisted**, never an extension of the old spine — six items only (candidate arithmetic engine `pd-lib.js:188–232`, Library file storage + auth-gated serve `pd-routes.js:1291/1435`, drop box + `/api/pd/similar` `:1658`, `pd_materials` + line-row shape, the `pdAuth`/`pdSurface`/`pdAuditLogger` plumbing, and the `/pd`-before-catch-all route rule). Everything else in `pd/` is opened only to delete it. Rules, vocabulary ban, reading rule and the **drift metrics** (old system measured 7 screens · 16 actions · ~95 fields · 19–21 menu items — targets and the stop-rule) are in **`docs/pd-model/REUSE-RULES.md`**. Everything the rebuild is waiting on is in **`docs/pd-model/PENDING-DECISIONS.md`** — §A is the three that **block the schema**: do the gates survive, is a Combination a tenth object, and is cost in or out of PD. Tahir confirmed **PD holds no real data** (which is what makes a core rebuild cheap — it stops being true the moment the team enters anything) and that **security/access findings are out of scope** for this rebuild per `CLAUDE.md` §2A. **Team review of the new rules and layout has not landed. No PD code is to be written until §A is answered.**

## 1 Sept 2026 (later still) — material list returned, B16 designed, B4 template built

**Material list, first return.** Tahir's team sent back `PD-Material-Grade-Template.xlsx`
partially filled: physical form added to every row, 11 assay figures confirmed as
real lab data on existing candidates (Sulfur S 80%, SOP/KOH/K₂CO₃/MOP K₂O
50/70/60/60%, Amino Acid N 50%, Zinc Sulfate Zn 33%, Phosphoric Acid P₂O₅
50/52/55%, Zinc Oxide Zn 80%), and 21 new materials named. Asked clarifying
questions rather than sending it back for another pass, per instruction — three
ambiguous names resolved: SPM = Sugar Press Mud, Poltary = Poultry Waste (OM),
MEA perkin = Monoethanolamine from a supplier called Perkin. Archived with those
three annotated: `combination-bank/PD-Material-Grade-Template-RETURNED-1Sep2026.xlsx`.
Grades for the 21 new rows, and for most of the original 24 candidates, are still
open — not addressed in this pass. `PENDING-DECISIONS.md` B2/B3 updated to record
this precisely.

**B16 — cross-product signal by shared material — design drafted.** Added
`combination-bank/RULES.md` §9.3: reuses the existing material-register index
(no new index, no tenth object), delivered as an auto-generated Observation
(reusing B18's mechanism) when a Challenge/Observation/Claim tagged with a
material, or an abnormal Run, matches another active Bet/Run/Problem using the
same substance. Matching is substance-level by default, scoped to active work
only. Three open questions left deliberately unresolved at the end of that
section. Not built, not confirmed — same status as B9–B12. Also fixed a stale
cross-reference in `RULES.md` §12 (“five signals” → “six”, missed when §7.1 was
corrected earlier the same day).

**B4 — controlled vocabularies template built.** New file
`combination-bank/PD-Controlled-Vocabularies-Template.xlsx` — Form, Route,
Crop/Soil/Problem tags, every value traced to the repo's own demo file
(`combination-bank-demo-v6.html`) or `MODEL.md`, nothing from the ERP. Surfaced a
real inconsistency while building it: Route is two different, partly-overlapping
lists in two different files (`RULES.md` §4.1's 4-value list vs. `MODEL.md` §3's
6-value delivery-context list) — flagged in the template for Tahir to rule on,
not resolved unilaterally.

**Not done:** grades/assays for the new materials and most of the original 24;
Route reconciliation; B16 trigger events, matching key and scope all still open
questions; controlled vocabularies still need Tahir's actual answers, not just a
template to answer them in.


_Same day, addendum:_ both templates (`PD-Material-Grade-Template-RETURNED-1Sep2026.xlsx` and `PD-Controlled-Vocabularies-Template.xlsx`) sent back to the team for the next pass. Nothing further from this side until they come back.


---

## 9 Sept 2026 — MODULE: PD — old gate-based app retired, new nine-object schema built, not run

Tahir: "We are working on PD... Product Development, let's develop if nothing
is developed yet. Ask me questions." Confirmed nothing of the new nine-object
model existed in code yet. Four scoping decisions from him this session:
schema first, then screens; take the old /pd app down now; include the
drafted-but-unconfirmed B9/B10/B11/B16 Combination Bank fields now, as
optional; build in the same live database O2S already uses.

**Built, not run, not pushed:**

- `pd/migrations/002_pd_core_rebuild.sql` (NEW, ~860 lines) — a pre-flight
  safety check (counts rows across everything about to be dropped/narrowed,
  aborts loudly if any database's "PD holds no real data" premise turns out
  false for it), then drops every old gate/hypothesis table not on
  REUSE-RULES.md §2's whitelist, creates the nine-object schema (Problem,
  Question, Bet, Run + readings, Claim, Challenge, Observation, Request,
  Constraint + delivery-context register), the Combination Bank register
  beneath Bet/Run, and the pd_reclassifications audit trail. Every object
  gets a permanent human-facing number (MODEL.md §4's "keep their number
  forever" rule) — pd_problems keeps the old p_number name on purpose so the
  Library's pin code needed no renaming. ALTERs pd_materials additively for
  the real HA/Cu/Fe/Mn/B/Ca/Mg/Moisture/OM/pH assay data from this week's
  material-grade return.
  **Not run against any database — nobody but Tahir, by hand, ever.**
- `pd/pd-lib.js`, `pd/pd-routes.js` — rewritten from ~2,040 combined lines to
  ~460. Kept only REUSE-RULES.md §2's whitelist: the Library (file storage +
  serve + comments + pins, adapted to pin only to a Problem) and the Drop
  box + Registrar triage (adapted so a Registrar converts an entry into a
  Challenge, Observation, or Request — the three doors — never directly into
  a Problem, per Tahir's decision). The old fulltext "similar idea?" checker
  is NOT ported — Tahir's decision: its code lives on only inside the
  Combination Bank's duplicate detector, a separate later build step.
  Everything else (idea intake, the G1-G6 gate machinery, candidates,
  samples, trials, formulations, regulatory, learnings) is deleted, not
  ported.
- `pd/pd.html` — the ~1,900-line old SPA replaced with a small static "being
  rebuilt" notice.
- `pd/drop.html` — one line fixed: it promised a "sign in to track your
  submission" flow that no longer exists on the new placeholder page.
- `server.js` — one function changed: `runPdMigration()` used to re-apply
  `001_pd_foundation.sql` on every boot (tolerating "already applied"
  errors). Self-caught in review: that would have silently recreated every
  table 002 just dropped on the very next restart, undoing the whole rebuild
  with no error and no log line anyone would think to check. Retired that
  call; kept the harmless PD-role bootstrap; dropped the old materials
  cost-seed (cost is out of PD, so not seeding it is correct, not a loss).
  The route-order mount at the bottom of the file (`/pd` before O2S's
  catch-all) was not touched.

**Independent review** (code reviewer + data-safety reviewer, per this
repo's standing "no exceptions" review rule): both ran against the actual
files on the device, not summaries. Real findings, all fixed and
re-verified by a second review pass:
  - `runPdMigration()` resurrecting the old schema on every boot (above) —
    the most severe finding, fixed.
  - The drop-box→Observation conversion had a misaligned INSERT (a literal
    landed in the `text` column, the real text in `origin`) — fixed.
  - The drop-box convert route could duplicate a record if two people
    triaged the same entry at once (no atomic claim) — restructured to a
    claim-first compare-and-swap.
  - Two now-orphaned pd_library_pins.target_type values ('hypothesis',
    'project') could make `resolvePin()` show the wrong Problem by id
    coincidence — schema narrowed, code guarded.
  - `pd_problems` had a `retired_reason` but no way to record why a Problem
    closed as `addressed` — generalized to one `closed_reason`.
  - Error text on four routes said triage was "the Registrar's" while the
    actual permission check only ever admitted Custodian/COO — reworded so
    the message never promises access the code doesn't grant (the new
    `registrar` pd_role, added by this migration, isn't wired to anything
    yet — that's a screens-milestone decision, on purpose).
  - Self-introduced while trimming the Library's pin code: the regex lost
    its second capture group but the insert still read the old two-group
    indexing, so every pin attempt inserted `target_id=NaN` and 500'd —
    fixed, both call sites.
  - The pre-flight safety check's own abort mechanism had a bug (a 115-char
    fake procedure name over MySQL's 64-char identifier limit) — it still
    halted the migration correctly, just with a confusing error instead of
    the intended one — shortened and re-verified.

**Disclosed, not fixed — flagged for Tahir, not decided here:**
  - No field-VALUE snapshot anywhere yet. `pd_reclassifications` records
    that something was refiled and by whom, but not a copy of what it said
    at the time — an ordinary edit later can still silently overwrite
    history on any of the nine objects or a Combination. Needs Tahir's
    decision on a mechanism before screens get built.
  - The claim-then-create-then-point-back sequence in drop-box convert is
    still two non-transactional statements, not one. A real failure between
    them leaves an entry stuck at `status='converted'` pointing at nothing —
    visible to a human, recoverable by hand, not currently by any route.
  - 002 only ALTERs pd_materials/pd_comments/pd_library_pins/auth_users, so
    it assumes 001 already ran once (true for production today). A brand
    new database that never had 001 applied would need 001 run by hand
    first, since 002 no longer runs it automatically.
  - Library and drop-box triage exist as working routes but have no click
    path yet — `pd.html` is a static notice, nothing calls them. Expected
    per "schema first, then screens," not a bug, but worth saying plainly:
    "kept" means the code survives, not that anyone can reach it today.

**Not done / next:** run `pd/migrations/002_pd_core_rebuild.sql` by hand
against `DATABASE_URL` (never Claude — this repo's own rule). After that's
confirmed clean, the screens milestone: an intake screen for the three
doors, a Problem/Question/Bet/Run working view, and the Combination Bank
entry form are all still unbuilt. Not pushed — local changes only, for
Tahir to review and commit via GitHub Desktop.

---

## 9–10 September 2026 — the screens milestone, plus training material

**What was built.** Four screens, which is exactly the number `MODEL.md §5`
signs off and exactly the number `REUSE-RULES.md §5`'s tripwire allows:

  - **What I owe** — the landing page. Readings due, Questions past their
    date, Runs where something abnormal was seen, and any notice that an
    entry was refiled. It exists because the audit found the system was
    changing state without ever telling the person who owned it.
  - **What came in** — the three doors (Challenge / Observation / Request)
    behind one box, plus the triage list. A door is optional and "not sure
    yet" is listed first on purpose.
  - **Problems** — the register and the dossier: Problem → Question → Bet →
    Run, with Claims and the history.
  - **The Report** — `MODEL.md §5.4`. Counts of things, never of people,
    and there is no version of it that can be pointed at one person.

**Migrations added — RUN THESE BY HAND, IN ORDER, BEFORE THE CODE:**

    pd/migrations/003_pd_history_and_notices.sql
    pd/migrations/004_material_grade_load.sql
    pd/migrations/005_pd_claim_identity.sql

  - **003** — `pd_field_history`, an append-only field-value snapshot table
    (Tahir's ruling, 9 Sept). Append-only is enforced by two triggers that
    `SIGNAL SQLSTATE '45000'` on UPDATE and on DELETE, so it is the database
    refusing, not the application. This closes the "no field-VALUE snapshot
    anywhere" item disclosed in the previous entry. Also adds `pd_notices`
    and `pd_observations.door_chosen` (backfilled to 0 for existing rows).
  - **004** — the 58 real grades from the returned 9 Sept worksheet, and it
    retires the ten placeholder seed materials. **Two things to look at:**
    the sheet carries **20.08 in the Mn % column on an iron source**, which
    is loaded with no assay and the raw cell kept in `spec_note`; and the
    `Elemental Sulfur 200 Mesh` row is commented out because the sheet marks
    it an example rather than a stocked grade.
  - **005** — `UNIQUE KEY (claim_number, version)` on `pd_claims`, with a
    pre-flight duplicate check that prints STOP rather than failing halfway.

**Also needed before anyone can sign in:** the eight pilot users need a PD
role granted in Manage Access. Nobody outside that list can reach `/pd` at
all, which is intended.

**Tests.** 362 assertions, 0 failed, across five suites:
`intake.test.js` (134) · `spine.test.js` (102) · `screens.test.js` (46) ·
`intake.browser.js` (45) · `spine.browser.js` (35). The last two drive a
real browser, because the previous PD build shipped a client-side defect the
API suite could not see. Both browser suites assert the nav is exactly four
items, so the screen-count tripwire cannot be crossed silently.

**Independent audit** (senior reviewers, per the standing rule — and this
time one reviewing adoption rather than code: whether eight real people
would use this, and why they would not). Its central verdict was that **the
system had to give something back before it asked for anything**, which is
what drove building `What I owe` and `The Report` in this pass rather than
later. Every code finding was verified against the running system before
being acted on.

**One audit claim was checked and found WRONG — do not act on it.** A
reviewer reported that an abnormal reading leaves a Run in `RUNNING`. It does
not: an abnormal reading flips the Run to `abnormal_investigation`, R-003 in
the seeded case sits in that state, and `spine.browser.js` pins it. What was
true underneath it — that nobody was ever *told* — is real and is what the
new landing page fixes.

**Fixed in this pass** (wording and flow, which Tahir authorised):
the close forms now show the kill criterion and what was expected, at the
moment the result is written; raw MySQL driver text no longer reaches any PD
screen (40 handlers, one replacement); typed drafts survive a re-render; a
chosen door is no longer a gate; a notice fires on re-parenting and is no
longer swallowed by a background fetch on another screen; and eleven
concurrency and identity defects — a move race that created two records, an
undo that did not verify the live pointer, claim-number collisions, revisions
forking the version chain, and an `/edit` path that quietly undid both hard
rules on a closed record.

**A verification pass over the training material found three more code
defects.** Rather than trust that this session had described its own build
correctly, every factual claim in the walkthrough and the Custodian briefing
(about 120 of them) was checked against the running system:

  - The filing queue was sorted **newest-first while its own hint said
    "oldest first"** — the oldest entry, the one most likely to have gone
    stale, sank to the bottom of the Custodian's list. Now oldest-first with
    a deterministic tiebreak so the list does not reshuffle between loads.
  - **A refiling notice could be silently consumed.** `GET /api/pd/intake`
    returned and marked notices seen, and `renderIntake()` never showed them.
    Delivery is what marks a notice seen (§7 allows no acknowledge button),
    so only the route that RENDERS a notice may return one — `/api/pd/mywork`.
    A test now pins that What came in can never carry one. This had shipped
    twice; that is why it is now a test rather than a comment.
  - **A banned word survived on The Report** — "a form that is asking the
    wrong thing." Not aimed at a person, but §6 is not conditional. The
    browser suite's §6 sweep runs over rendered screens and this string was
    added after the sweep last ran green on that screen.
  - A Bet on What I owe did not name the Question it tests, though the
    payload already carried it (B7). Added.

Ten claims in the documents were corrected in the same pass — most usefully
that filing an entry against a Problem with **no owner** does not take it out
of the queue (it needs both), and that a per-person refiling count is not
something the system fails to hold — it holds it and no screen may group by
it, which is a materially different sentence to put in a Custodian's mouth.

**Training material, built and published as private pages on claude.ai:**

  - *Before You Open PD* — the walkthrough, with real screenshots of the
    real screens and the V Germinator Pro case as it actually happened.
  - *The Custodian's Desk* — a separate briefing for the Data Custodian,
    because her role is filing rather than chemistry and the no-blame rules
    matter more to her than to anyone else.
  - *Seven Calls on PD* — the structural findings, written as decisions for
    Tahir rather than changes made unilaterally.
  - `PD-introduction.pptx` — the same story as a deck.

**Not done / next.** Seven structural questions are waiting on Tahir's
ruling (see *Seven Calls on PD*); two of them — **who moderates** and
**whether a Run needs a recipe** — gate the Combination Bank build, which is
the largest piece still unbuilt from the original screens request. Search
across Problems, Questions, Bets, Runs and Claims does not exist at all and
is, in this session's view, the biggest single gap in the system. Nothing is
pushed — local changes only, for Tahir to review and commit via GitHub
Desktop.

---

## 10 September 2026 — Tahir's rulings on the seven, and what they changed

Five of the seven open questions were answered. **Search ordering (1) and the
role labels (2) are still open** — 2 is waiting on Tahir's own words for the
labels, since it is an org chart question, not a technical one.

**Ruled and now built:**

  - **Constraints are written from inside the Problem dossier** (decision 3),
    not from a fifth screen. `POST /api/pd/constraints` and
    `POST /api/pd/constraints/:id/retire`, both leads-only, plus a Constraints
    card on the dossier showing the whole register grouped by delivery
    context. This closes MODEL.md §3's ninth object, which until today could
    be read but never written. The nav is still four items, so REUSE-RULES §5's
    tripwire is not crossed.
    Retiring is not deleting: it takes a written reason and is a
    compare-and-swap, so two people cannot write over each other's reason and a
    rule that stopped binding does not quietly vanish and get re-argued.
  - **The banned word in `server.js` only** (decision 6). Line 423's
    `'invalid role "x" for module y'` is now `'The X module has no role called
    "y".'` No behaviour change, no other `server.js` edits. The remaining 16
    places where raw driver text can reach a screen stay for a separate piece
    of work with its own O2S test pass — Tahir's ruling, and the right one:
    mixing a platform refactor into a PD milestone is how a live module breaks
    for a reason nobody can find.
  - **`pd/PORTING_STATUS.md` is retired** (decision 7). The file now contains
    only a pointer to this document and to `docs/pd-model/`. It was NOT
    deleted from disk — the device bridge cannot delete — so **delete it in
    GitHub Desktop if you want it gone**; leaving the stub is also fine and
    keeps the git history reachable. `CLAUDE.md` updated in two places: the PD
    file list now names `pd-routes.js` and `tests/` and drops the retired file,
    and §3 says plainly that OP-HANDOFF.md is the single status document and a
    second one should not be started.

**Ruled, and waiting on the Combination Bank build:**

  - **The moderator group is hard-coded to Custodian + Registrar + COO for the
    pilot** (decision 4), to be made configurable in Admin before anyone
    outside the eight uses it. Nothing is built for it yet — it lands with the
    bank's moderation queue.
  - **A recipe is required to CLOSE a Run, never to start one** (decision 5).
    Not yet enforced, and deliberately so: there is no way to record a recipe
    until the Combination Bank exists, so switching the check on today would
    make every Run uncloseable. It goes in with the bank, in the same change
    as the entry form.

**One more defect, found by a test that only failed when the box was slow.**
`settle`, `close-bet` and `close-run` each had an early "already closed" guard
sitting ABOVE the validation and above `writeClosingClaim()`. So whether a
person who lost a close race had their written result kept as a Claim or
silently dropped depended on how many microseconds they lost by — two
behaviours for one situation, and the wide-margin one discarded their words
while telling them nothing. The early guards are gone; the claim is written
first and the state change is a compare-and-swap in all three routes, so every
loser is treated identically and told "nothing is lost", truthfully. Pinned by
a test that closes a run long after it was closed, not just concurrently.

**Tests: 383 assertions, 0 failed** — `intake.test.js` (134) ·
`spine.test.js` (123) · `screens.test.js` (46) · `intake.browser.js` (45) ·
`spine.browser.js` (35).

**Still not done:** the Combination Bank — entry form, the six-signal duplicate
checker, the four bands and the moderation queue — is the largest piece left
from the original screens request, and it is now unblocked. Search across the
nine objects (decision 1) is unbuilt and, in this session's view, the single
biggest gap in PD. Nothing is pushed — local changes only, for Tahir to review
and commit via GitHub Desktop.

---

## 10 September 2026 (later) — search, and the role list matched to the org chart

The last two open questions were answered. **Nothing is waiting on Tahir.**

### Decision 1 — search, before the Combination Bank

`GET /api/pd/search?q=` searches **everything a person wrote**: a Problem's
title, statement, context and closing reason; a Question's title, text and
settled reason; a Bet's approach and its kill criterion; a Run's expected,
actual and replaces-reason; every reading (parameters, physical observation,
analytical result); every current Claim and its source; all three doors; and
every live constraint. Results say what kind of thing each one is, carry a
snippet showing why the row came back, and name the Problem they sit under.

**`LIKE`, not FULLTEXT, and this is deliberate.** InnoDB fulltext drops every
token shorter than `innodb_ft_min_token_size` — 3 by default and a server-wide
setting we do not control on HostGator. What this team actually searches for is
chemistry: pH, N, P, K, Zn, B, Fe, Mn, K2O, SOP, MAP, KOH, CRH, ULV. Half of
those are one or two characters, so a fulltext search would return an empty
list for "pH" — not an error, just nothing — and people would conclude PD has
no memory rather than that the search has a token floor. `LIKE '%x%'` finds all
of them and costs nothing at pilot scale. It will not scale to a hundred
thousand Runs; when that day comes the fix is an index, not a rewrite.

**§8.1 holds.** The route reads only `q`. There is no author parameter and no
way to point a search at a person, because a search box that takes an author IS
a per-person count. A test passes `&author=&owner_id=&user=&created_by=&by=`
and asserts the results are byte-identical to the plain query, and another
asserts no groupable person field appears in the payload.

**It is not a fifth screen.** The box sits in the sidebar ABOVE the nav — search
is how you reach the four screens, not a fifth one — and results render as a
panel over Problems, the same way one entry and one dossier already do. The nav
is still four items and both browser suites assert it.

### Decision 2 — the role list

`migrations/006_pd_roles.sql` — **run by hand after 005.** It extends the
`auth_users.pd_role` ENUM by two values and changes no row. The two renames are
display strings in `pd-lib.js`, not data, so nobody's access moves.

| Key | Was | Now | Who |
|---|---|---|---|
| `rta` | Plant Manager (RTA) | **R&D Manager** | Himmayat |
| `production` | Production Manager | unchanged | Majid |
| `agronomy` | Agronomy | **Agronomy Lead** | Maleeha |
| `field_agronomy` | — | **Field Agronomist** (new) | Nadeem |
| `associate_agronomy` | — | **Associate Agronomist** (new) | Erum |

The old label named the wrong job *and* collided with `production`, which is
what the real Plant Manager holds; and a compliance audit had already found
that RTA is never expanded anywhere in the system, so nobody could learn what
it meant from the software. Agronomy was one role for the whole function, so
the system could not tell the lead from the people who work to her.

**All four of Agronomy Lead, Production Manager, Field Agronomist and
Associate Agronomist are LEADS** (`LEAD_ROLES` in `pd-lib.js`), on Tahir's
ruling. A lead may name someone else the owner of a Question, Bet or Run,
settle a Question, and close work that is not their own.

**After running 006:** give Nadeem `field_agronomy` and Erum
`associate_agronomy` in Manage Access. `launcher.html`'s fallback role array
was also brought back into step — it had been missing `registrar` since 002,
though the Access screen prefers the server's list so nobody saw it.

**Tests: 408 assertions, 0 failed** — `intake.test.js` (134) ·
`spine.test.js` (123) · `screens.test.js` (64) · `intake.browser.js` (45) ·
`spine.browser.js` (42).

**Next, and now unblocked:** the Combination Bank — entry form, the six-signal
duplicate checker, the four bands, the moderation queue (Custodian + Registrar
+ COO, hard-coded for the pilot), and the close-time recipe check on a Run.
Nothing is pushed — local changes only, for Tahir to review and commit via
GitHub Desktop.

---

## 11 September 2026 — MODULE: PD — migration state, the 003 backfill bug, and Tahir's rulings A1 + B2

**Session constraint, and it shaped everything below: `device_bash` would not
mount** (`no Plan9 drive shares mounted under /mnt/.virtiofs-root/shared`),
tried twice, an hour apart. Files could be read and written through the device
bridge; **no shell on Tahir's machine, so no `git status` and no test run.**
A future session that has one should start by re-running the suites.

### Where things actually stood

Read from the git refs rather than guessed: local `main` and `origin/main` were
both at `852798d` ("PD", 11 Sept 10:59 PKT), so the 10 September work was
committed and pushed. Whether the working tree was clean could not be checked
without a shell.

**The migration question could not be answered from the repo at all** — 003–006
are run by hand and there is no migrations table, so a week later nobody can say
which reached the database. Written this session:

  - **`pd/migrations/STATE-CHECK.sql`** — read-only, safe with people signed in.
    PART 1 reads `information_schema` only, so nothing in it can error because a
    table or column is missing: that absence IS the answer. One grid, one verdict
    per migration — 003's table, its two append-only triggers, `pd_notices`,
    `door_chosen`, 004's columns, 005's unique key, 006's ENUM, and 007's row.
    PART 2 counts the 58 grades, checks the ten pre-rebuild seeds are
    deactivated, runs 005's duplicate pre-flight, and lists who holds a
    `pd_role`.

### A real bug in 003, found by reading it

`003_pd_history_and_notices.sql` claimed in its own header to be safe to re-run
while ending on an unguarded

    UPDATE pd_observations SET door_chosen = 0 WHERE created_at < NOW();

On a second run that resets **every** Observation to 0, including the ones where
a person really did choose a door — erasing the exact distinction the column
exists to hold, with nothing to restore it from, since a migration writes no
`pd_field_history` rows.

**Fixed by removing the UPDATE**, not by guarding it. The column is now added
with `DEFAULT 0` — which is what MySQL gives every existing row in the ADD COLUMN
itself, so the backfill is the default — and a second `ALTER` then moves the
standing default to 1 for everything written afterwards. Identical end state on a
fresh database; on a database where the old file already ran, the new one changes
nothing. Checked first that no route depends on the column default: all three
`INSERT INTO pd_observations` sites in `pd-routes.js` name `door_chosen`
explicitly. **The SQL was reviewed line by line, not executed** — no MySQL in the
container and the proxy blocks `apt` and `npm`.

### Housekeeping Tahir did

`OP-HANDOFF-1.md`, `pd/pd-1.html` and `pd/pd-routes-1.js` were byte-identical
duplicates (MD5-checked) carried into `852798d`, and nothing referenced them —
`server.js` requires `./pd/pd-routes` and serves `pd/pd.html`. The device bridge
cannot delete, so Tahir removed them in File Explorer and committed, along with
`render.yaml.bak`. `OP-HANDOFF-1.md` was the one that mattered: a second status
document is what CLAUDE.md §3 forbids, and it would have started lying the moment
this file got its next entry.

### The question that produced two structural calls

Tahir asked how the flow works when a Question is not about agronomy — his
example, recovering potash from bio-boiler fly ash, which is chemistry and
production with no agronomy in it. The answer is that **the flow does not branch
by discipline**: the ash is an Observation (MODEL.md §3 names that very sample),
triaged under a Problem of `kind: product_concept`, with a `nature: chemistry`
Question owned by the R&D Manager and a `nature: production` Question owned by
the Production Manager. Agronomy enters only if somebody claims the recovered
material performs on a crop, which is a separate Question with a separate owner
and a separate kill criterion.

Two things were wrong underneath that answer, both verified in the code before
being raised, and both put to Tahir as calls rather than changed:

**A — `nature` did no work.** Required on every Question (400 without it),
stored, shown as a pill, editable — and it routed nothing. Since "What I owe" is
per-owner and §8.1 requires it to stay that way, a chemist could not find a
chemistry Question that an agronomist happened to own.

**B — a plant-capability rule had nowhere to live.** MODEL.md §3 lists
`plant_capability` as a kind of Constraint and 002 wrote it into the ENUM, but
`delivery_context_id` is NOT NULL, the create route refuses a constraint with no
context, and both read paths inner-join the context table. Filed under
fertigation such a rule is wrong there and invisible to the other five contexts;
filed six times it is the duplication the register exists to prevent. MODEL.md's
own sentence gives it away — "the no-duplication mechanism on the **delivery**
side". There was no plant side. The fly-ash case is exactly what exposes it: the
bench recovers the potash, the plant cannot reproduce it, and that fact could not
be written down.

### Tahir's rulings, 11 September 2026

  - **A1 — BUILD.** A discipline filter over open Questions, on the Problems
    register and on search results.
  - **A2 — REJECTED.** No nature→role default owner. An owner that is wrong but
    already filled in gets accepted by someone in a hurry, and work that *looks*
    assigned is worse than work that is visibly not. The lead still assigns.
  - **B1 — DROPPED.** No second, plant-side constraint register.
  - **B2 — BUILD.** One more row in the existing register instead. Because B1 was
    dropped, **this row is permanent, not a stopgap** — it is the only place a
    plant-capability rule belongs, and it is written up that way in `pd-lib.js`.
  - **B3 — REJECTED.** No `process_validation` role mirroring the Field
    Agronomist. A role nobody fills makes the org chart lie, and the QC Head
    arguably already is that person. The human half is covered by the existing
    mechanism: anyone who thinks a bench claim will not survive scale-up writes a
    counter-Claim against it.

### What was built

**A1**

  - `pd-routes.js` — new `GET /api/pd/questions`: every open Question under every
    Problem, whoever owns it, with owner, Problem, due date and open-Bet count.
    **It reads no query parameters at all.** The filtering happens on the screen
    over rows already sent, so there is no query string here that could be
    pointed at a person — §8.1 cannot be talked around a route that reads
    nothing. `owner_name` is returned because a reader needs to know who to ask,
    exactly as the dossier already shows it.
  - `pd.html` — an **Open Questions** card at the foot of Problems with a
    Discipline dropdown. Not a fifth screen; the nav is still four items.
  - Search results carry the discipline: Questions their own, Bets and Runs
    inherited from the Question they sit under. A "Narrow to one discipline"
    control appears only when the results span more than one, and says plainly
    that choosing one hides Problems, Claims and entries, which have none.

**B2**

  - `pd/migrations/007_plant_wide_context.sql` — one row,
    `plant-wide — what we can actually make`, id pinned at **90** so
    `pd-lib.js` can name it without matching a string somebody may later rewrite
    (002 seeded the six real contexts without explicit ids, so they hold 1–6).
    `INSERT IGNORE`, `name` is UNIQUE, safe to re-run, and it prints STOP if id
    90 is ever something else.
  - `pd-lib.js` — `PLANT_WIDE_CONTEXT_ID`, with the reasoning written down as a
    ruling rather than as a workaround.
  - `pd-routes.js` — **every Bet inherits the plant-wide constraints** on top of
    its own context's; without that the row would have been inert. And **a Bet
    may not be aimed through plant-wide** — it is not a way of delivering
    anything — refused with a sentence rather than accepted quietly. The
    constraint form's 400 now names plant-wide as an option.
  - `pd.html` — plant-wide is left out of a Bet's "Aimed through" list, and each
    inherited rule on a Bet says whether it came from the delivery context or is
    true of the plant whatever the context. Those are different sentences and
    must not read as one.

**One defect found in this session's own work and fixed before delivery:** a
discipline chosen on one search carried over to the next. Since the control is
only drawn when results span more than one discipline, a following search
returning a single discipline would have shown an empty list with no visible way
to clear the filter. Every search now starts unnarrowed.

### NOT DONE — read this before trusting the above

**No tests were written and none were run.** The suites need a live server and
database (`BASE=http://127.0.0.1:4310 node pd/tests/screens.test.js`), and this
session had no shell on Tahir's machine and no MySQL in the container. What was
done instead: `node --check` clean on `pd-lib.js`, `pd-routes.js` and
`pd.html`'s single script block, plus a hand trace of the data path. Test code
was deliberately NOT written, because a test nobody has executed costs more than
a missing one when it fails for its own reasons.

**What the missing assertions must pin**, for whoever adds them:

  - `GET /api/pd/questions` returns byte-identical results with
    `&author=&owner_id=&user=&created_by=&by=` appended, the same way the search
    test does it;
  - a constraint written against plant-wide appears on a Bet aimed through a
    different context, carrying `plant_wide: true`;
  - `POST /api/pd/bets` with `delivery_context_id = 90` is refused;
  - both browser suites still see exactly four nav items.

The last run of record remains **408 assertions, 0 failed** (10 Sept), which
predates every change in this entry.

### Order of work when the pilot opens

1. `STATE-CHECK.sql` PART 1 in phpMyAdmin — it says which migrations are missing.
2. Whichever of 003, 004, 005, 006 are outstanding, in that order. If STATE-CHECK
   says 003 is already APPLIED, do not run it again; there is nothing to gain.
3. **007 last.**
4. A `pd_role` for each of the eight pilot users in Manage Access — Nadeem
   `field_agronomy`, Erum `associate_agronomy`, both only after 006.
5. Confirm Render built the pushed commit green.
6. Open `/pd`: four nav items, the Open Questions card and its dropdown, a
   plant-wide constraint showing on a Bet aimed through fertigation, and
   plant-wide absent from that Bet's "Aimed through" list.

**Still the largest unbuilt piece:** the Combination Bank — entry form, the
six-signal duplicate checker, the four bands, the moderation queue (Custodian +
Registrar + COO, hard-coded for the pilot) and the close-time recipe check on a
Run. Unblocked since 10 September and untouched.

Nothing pushed — local changes only, for Tahir to review and commit via GitHub
Desktop.

### CORRECTION — added while merging these two entries, 11 September 2026

The "Order of work when the pilot opens" list above was written without sight of
the entry immediately before it, which was on the remote and not in this working
tree at the time. That entry supersedes the list on three points:

  - **002, 003, 004, 005 and 006 are already applied to PRODUCTION**
    (`jodilkah_vanop_db`), verified there by fingerprint against
    `information_schema`; `pd_materials` holds 68 rows, 58 active. The local
    `van_platform` database is level with it. So steps 1 and 2 above are done,
    and the only migration still outstanding anywhere is **007**.
  - **003 therefore already ran once, in its original form**, before the backfill
    fix recorded in this entry. That first run was correct — the fix protects a
    SECOND run, which must now never happen. `STATE-CHECK.sql` will report 003
    APPLIED. Do not run it again, and do not read the amended file as something
    to apply.
  - **Step 4, the roles, is blocked for a different reason than assumed.** The
    pilot people have no `auth_users` accounts yet — 006 added the role OPTIONS,
    and a role cannot be given to an account that does not exist. Each person
    gets theirs as they are onboarded in Manage Access: Himmayat `rta`, Majid
    `production`, Maleeha `agronomy`, Nadeem `field_agronomy`, Erum
    `associate_agronomy`.

**So what actually stands between here and eight people signing in: 007, the
eight accounts, and the smoke test.** The schema is otherwise done.

Both entries are kept in full and in the order the work happened. The remote
entry notes that it had already been lost once "when the working-tree
OP-HANDOFF was reset during the merge" — it has not been lost again.

---

## 23 September 2026 — MODULE: PD — 007 applied locally, the app used end to end, and the landing page rebuilt around actions

### The rule that now governs migrations

Tahir's ruling, recorded in `CLAUDE.md` §2 the same day: **every migration and
every test runs against the LOCAL database first. Production is applied by
hand, later, at his choosing.** A migration is finished when it is applied
locally and the file is in the repo. Never press for the production run as
the next step.

Under that rule, **007 is done.** Applied to local `van_platform` through
phpMyAdmin (Claude drove the browser; Tahir opened it). The row is named
`plant-wide`, not the longer em-dash name written on 11 September: a non-ASCII
character typed through a browser is one more thing that can arrive wrong, and
nothing in the code reads the name (pd-lib.js matches on id 90). Both
`007_plant_wide_context.sql` and `STATE-CHECK.sql` were changed to match.
Local register now holds ids 1–6 and 90.

Production has 002–006 (per the 11 Sept record) and not 007. That is correct
under the rule and nothing is waiting on it.

### The app, used rather than looked at

Signed in as COO on `localhost:3000/pd`, the empty screens were walked, then
one real case was written from the door to a recorded reading:

    O-001 (ash arrived) → P-01 (product concept) → filed, owner QCM
    → Q-001 chemistry, due 15 Oct → B-001 water leach, kill criterion
    → R-001 → abnormal reading, K2O 1.8% → Run moved to investigation
    → What I owe showed 1

**No defect at any step.** The A1 discipline filter and the B2 plant-wide
exclusion were both confirmed live. These records stay in the local database.

### Nine findings, and the one that mattered

Written up on a private page for Tahir ("PD Before Launch"). In short:

  - **What I owe was five lists, one per object type.** One Question with one
    Bet and one Run filled three of them, printed the kill criterion twice and
    the Question title three times. That is one unit of work on the screen
    every user opens first.
  - The discipline box on the Question form opened on **Agronomy**, so a
    Question saved in a hurry was labelled agronomy whatever it was — the same
    objection Tahir accepted when he rejected a pre-filled owner (A2).
  - `P-01` against `O-001`, `Q-001`, `B-001`, `R-001`.
  - Nothing on any screen defined Problem, Question, Bet, Run or Claim.
  - A Run has one field (expected). Nowhere to record what was mixed. The
    Report already names this gap.
  - The same entry printed twice on the intake screen for a triage user.
  - "held as an Observation for now" still showed after the entry was filed.
  - A Bet read RUNNING before its first Run existed.
  - **One finding was WRONG and is withdrawn:** "Who reported it" is not
    pre-filled with the user's name. It is a placeholder, shown grey. Misread
    from the screenshot.

### The Council

Tahir asked for a five-reviewer acceptability review. Run as the Council
(five adversarial lenses, one verdict). Where they agreed independently: the
landing page gave nothing back and sent a person elsewhere to begin; PD has
to sit inside a moment that already exists (the sample request) or it is extra
typing; the vocabulary is a barrier on entry and an asset later, so teach it in
place. The Outsider's catch: "Bet" reads as gambling to a plant chemist, and
"What I owe" reads as a debt. Verdict: ship the small changes, open with
three people before eleven.

### Built, in `pd/pd.html`, `pd/pd-lib.js`, `pd/pd-routes.js`

  - **What I owe rebuilt as one dated list of actions.** Three time buckets:
    *Needs you now* (late or abnormal), *Coming up* (dated), *No date on it*.
    Each row leads with the action in plain words ("Record the next reading",
    "Decide it once the readings are in"), the object type is a tag, the
    permanent number is on the row. Reads the same `/api/pd/mywork` payload.
    No route, permission or rule changed. §8.1 holds.
  - **A write box on the landing page.** Same `POST /api/pd/intake` as the
    full form, no door picked, triage decides. Verified: an entry saved from
    there became O-002 and appeared in the filing queue.
  - **The discipline box opens on "— pick one —".** The server already
    refused a Question with no discipline; the screen now agrees.
  - **`fmt_p` pads to three digits.** P-001. Stored numbers unchanged.
  - **A Bet's open status reads "Open"**, not "Running".
  - **A glossary in the sidebar**, `<details>` under the nav, fed by
    `definitions` now sent in the `/api/pd/intake` payload from
    `OBJECT_DEFINITIONS`. One line per object, always one click away.
  - "held as an Observation for now" shows only while the entry is unsorted.
  - Intake screen: "Your entries" and "Already filed" capped at the five most
    recent and retitled, since everything a person wrote is on What I owe.

**Verified live on the running app:** the rebuilt landing page, the write box,
the nature placeholder, the stale line. **Not yet visible: P-001, "Open", and
the glossary** — they live in `pd-lib.js` and `pd-routes.js`, which Node loads
at boot. They show after the local server is restarted.

**Not run:** the five test suites. Still 408/0 from 10 September. The
Council's Executor would say: three people on Monday finds more than the
suites will.

### What I could not check

The non-lead view. Only COO can be signed in from here, since Claude does not
enter passwords. Four of the twelve are not leads and they decide adoption.

Nothing pushed. Local changes: `pd/pd.html`, `pd/pd-lib.js`,
`pd/pd-routes.js`, `pd/migrations/007_plant_wide_context.sql`,
`pd/migrations/STATE-CHECK.sql`, `CLAUDE.md`, this file.


---

## 23 September 2026 (later) — MODULE: PD — four structural changes built: My desk, Approach, the recipe box, the sample request as the front door

Tahir's rulings the same day, after the Council review earlier in the entry
above. All four are built and on disk. Nothing pushed.

### 1. "What I owe" is now "My desk"

Nav and page title only. The page, its buckets ("Needs you now / Coming up /
No date on it") and the write box are as built earlier today. `MODEL.md` §5
carries a one-line note; the meaning of the screen is unchanged.

### 2. "Bet" is now "Approach" on every screen

The word people read changed. Nothing underneath did: the object is still a
Bet in `MODEL.md`, in `pd_bets`, in every route and in its permanent number,
which keeps the B- prefix (RECLASSIFICATION-RULES §4: a number never changes).
`pd-lib.js` carries the explanation next to `BET_STATUSES`; the glossary
entry now reads "An Approach is one thing we try because we believe
something ... Its number starts with B." Every pill, button, form heading,
report tile and error message was checked: zero user-facing "Bet" left.

### 3. The recipe box on the Run — migration 008

`pd/migrations/008_run_recipe.sql`: one nullable TEXT column,
`pd_runs.recipe_text`, after `combination_id`. STATE-CHECK.sql PART 1 now
reports 008.

What it does on screen:

- The "Make a run" form has a second box, "What will you mix?", optional.
- The Run card shows the recipe in its own block, or "No recipe written on
  this Run yet" while the Run is open.
- "+ Write the recipe" / "Change the recipe" on an open Run, through the
  existing edit route, so the earlier wording is kept in the history like
  every other edited field. Owner or lead, as for every edit.
- Search reads `recipe_text`.
- The report tile "Runs with no recipe written" now counts a Run as having a
  recipe if EITHER the box or a Combination Bank code is on it.

**008 is written and in the repo but NOT yet applied to the local database.**
The phpMyAdmin tab stopped answering mid-session (both open tabs went quiet,
so it looks like Chrome or the machine, not the SQL). Until 008 is applied,
the restarted server will fail on any Run create, the dossier and the report,
because the code reads a column that is not there. Apply 008 first, then
restart. Production: not until Tahir applies it by hand, per the standing
rule.

### 4. The sample request is the front door

On "What came in", the Request door is now second, directly after "Not sure
yet" (which stays first: the 9 September ruling that nobody classifies
before they can write). Its line now says it is the usual reason to be here.
The placeholders on both write boxes lead with "Someone wants a sample of…".
The My desk hint reads "Someone wants a sample? A dealer said something? A
result came in?".

### Housekeeping found on the way

- `007_plant_wide_context.sql` and `STATE-CHECK.sql` on disk still carried
  the em-dash name for row 90; the `plant-wide` versions written this
  morning had not reached the repo. They have now.
- `CLAUDE.md`: "Tahir pushes with GitHub Desktop." had landed at the end of
  the migrations block instead of under "Never push". Moved back.
- `docs/pd-model/MODEL.md` §3 and §5: the Approach label, the recipe box and
  the My desk title, each as a note under the unchanged object.

### Still Tahir's

Apply 008 locally (phpMyAdmin, one paste), restart the local server, then
open a Run and write a recipe on it. Commit and push from GitHub Desktop.
The 11 accounts through Manage Access. Production 003–008 by hand, later.

