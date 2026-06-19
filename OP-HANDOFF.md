# VAN Order Control Tower — OP Handoff

_Updated: 2026-06-18 · COO: Tahir · Single code file: `index.html` (4308 lines, vanilla JS). Backend: `server.js` (Node/Express + Postgres, one `app_state` JSON blob + rev counter). Deploys never touch the DB. Pushes go via GitHub Desktop (Claude cannot push). Render auto-deploys on push; rollback restores prior code only, never the DB._

> **STATUS — 2026-06-18:** §0/§1 shipped & live (`343b7bb`); handoff-wording cleanup pushed (`68ae33f`); **§0a Action Center display fixes pushed & live (`94593b9`)**; in-app verification by Tahir in progress. Local = `origin/main` = `8cdd2c3`, 0/0. Data-migration flags `_purgeImpV1`, `_purgeImpDupV1`, `_purgeImpNoTwinV1`, `_fixVU26134L2V1` all `true` in the 18 Jun snapshot. **§0b PO Tracker audit done (read-only) — 1 fix open, not yet implemented.** The old "READY TO PUSH / NOT pushed" labels in §0 and §1 were stale notes — those edits are already shipped and live.

---

## 0h) READY TO PUSH (AFTER A FRESH SNAPSHOT) — 2026-06-18 · Production STAGE 2+3 (logic + one-time DATA migration; NOT yet pushed)

**Stage 2 (logic, code-only):** `saveReconcile` by-product branch now **accrues into ONE open pool per base** (find-or-create, `pool:true`, `sources[]`) instead of a new fragmented batch per reconcile — never sets `producedKg`, so no batch#/QC until called for manufacturing. Divert/rework branches left unchanged (0 records today; full pool + call/merge lands in Stage 4).

**Stage 3 (DATA migration — runs once on load):** `consolidateByproductV1` merges the existing **21 by-product accruals → 1 open pool (9,805 Kg, all 21 source links kept, `producedKg` 0)**. Idempotent (`s._bpConsolidateV1`), audit-logged, wired LAST in `ensureState`. **Simulated against the 18-Jun snapshot:** 59→39 batches · 1 pool · 9,805 Kg · 21 sources · **38 normal batches byte-identical & untouched** · idempotent on re-run · pool cannot trigger QC. `node --check` clean; `index.html` intact (4445 lines).

**⚠ REQUIRES A FRESH SNAPSHOT before push** (Stage 3 mutates live `app_state` on load). Rollback: snapshot restore (data) or code revert (deploys don't touch DB). The 2 false QC actions are already gone via Stage 1's display filter; this removes the underlying 21 fragmented batches and replaces them with the single pool.

---

## 0g) READY TO PUSH — 2026-06-18 · Production STAGE 1 (display de-clutter; CODE-ONLY, no data/flow change; NOT yet pushed)

First stage of the reconcile/by-product rework (see `VAN-Production-Reconcile-Implementation-Plan.md`). **4 read-only display edits, no data write, no workflow change, no snapshot needed:**
1. `_jb` (Production journey board, screenProd) now excludes `disposition==='byproduct'` → the 19 empty "Producing 0" stubs are gone from the board; the stage chip counts follow (computed from `_jb`).
2. `noNoBatches` ("Set batch numbers" card) excludes by-product accruals (they get a # at call-for-manufacturing).
3. `actionItems` COA loop excludes by-product accruals → **clears the 2 false Lab-COA/QC actions** (B1285/B1283, 930 kg, no COA) — My-Actions count only drops.
4. Added a compact "By-product · Nitro Sulfur: N accruals · X Kg pooled" summary line on the board so the pooled material is still visible, just not cluttering.
**Live data untouched** — the 21 by-product accruals still exist in the DB; they're just not shown in the cluttered lists. `node --check` clean on all 4 edits; `index.html` intact (4418 lines, proper end). Rollback = code revert (deploys never touch the DB). Stages 2–5 (logic/data) remain gated on snapshot + sign-off.

---

## 0f) PRODUCTION AUDIT — 2026-06-18 (read-only; AUDIT ONLY, nothing built/pushed — Tahir emphatic)

**Write-path logic is sound** (verified): batch# FY-uniqueness, format validation, base-vs-brand guard, RM-availability gating, **105% over-production cap**, shift validation (shift+incharge+reason-if-zero). No flow blockers in the workflow.

**Main problem = clutter, not logic.** Of 48 batches shown, **19 are empty "Nitro Sulfur · 0 kg · no batch#" by-product stubs** (status open → render "Producing" forever), burying ~12 real batches. Also fills the "Set batch numbers" card (21 blank-# entries).

**By-product (Nitro Sulfur) — current behavior (confirmed in `saveReconcile`, ~line 2338):** each SCU batch reconcile **creates a separate by-product batch** (`state.batches.unshift({disposition:'byproduct', needsProduction, sourceBatch...})`). 21 fragmented accruals, 9,805 kg total. Two wrong routes: *needs-production* → empty "Producing 0" stub per routing (19); *ready-to-QC-&-pack* → tiny qty goes **straight to QC → QA** with no grinding (2, 930 kg). Each `plannedKg` = the accrued by-product kg; `sourceBatchNo` links the parent SCU batch.

**TARGET MODEL (Tahir, to build ONLY when approved):** by-product routes **only to Production, into ONE accumulating Nitro Sulfur pool** — every SCU batch adds to a single open by-product batch; **no QA alert, no QC while accumulating.** Stays open until Production **"calls it for manufacturing"** (~5,000 kg threshold, soft, or manual) → assign **batch #** → **grinding** (production process) → on completion follows the **pre-existing standard route** (Lab QC → pack → QA → ship), packing **against a Nitro Sulfur PO if one exists** (stock not managed in-app).

**Planned change set (deferred):** (1) rewrite by-product branch of `saveReconcile` to accumulate into one find-or-create open pool (record each source SCU batch), not spawn-per-reconcile; (2) suppress QC/QA on the accumulator until ground; (3) add "Call for manufacturing / grind" action (batch# + grind start); (4) one-time DATA merge of the existing 21 accruals → one ~9,805 kg pool (snapshot + approval). (5) Display: separate "By-product · Nitro Sulfur" lane + compact primary board (de-clutter), relabel "Producing 0"→"Needs grinding". **NONE BUILT.**

**DESIGN / INFO-FLOW PRINCIPLES recorded (display + information-architecture only — no master data, no real-time records, no business/data logic; from the reference mockup + Tahir):** (1) **Demand-first** — lead Production with a "what to make next" queue (PO · product · need · RM · recipe · due · one next action); demote the raw batch board to a secondary tab. (2) **Decision/KPI strip** at top (To produce / RM ready / In production / Awaiting QC / Ready to pack / Exceptions) computed from live data. (3) **Reconcile + by-product = their own lane**, separate from normal production. (4) **Ready-to-pack is inventory, not My-Actions noise.** (5) **Rows by default; forms open in a drawer only after an action is chosen.** (6) **Don't duplicate the PO Tracker** — Production queue stays production-specific ("what can I physically make now"). Out of scope / ignored: separate Packing/Inventory/Dispatch nav, the dark sidebar/palette, a full start-batch wizard (current open-batch flow already validates).

**WORKING METHOD (Tahir):** build a **full functional offline prototype FIRST** (file `VAN-Production-Command-Center-PROTOTYPE.html`, kept OUTSIDE the `VAN-OP` repo so it can never be pushed), iterate/rework/validate offline, and **do not go live until every challenge is solved.** Prototype saves nothing and is not connected to live data.

**CONFIRMED RECONCILE RULE-SET (Tahir, 2026-06-18 — for the prototype + eventual build; example: a 350/500 kg SCU remainder splits into loss + by-product + divert + rework):**
- **Loss / overfill** → recorded as loss only. No batch, no onward steps.
- **By-product (Nitro Sulfur)** → ONE accumulating pool (no batch#/QC/QA while pooling). Production **calls it anytime** (soft ~5,000 kg hint, not a gate) → batch# **at call** → **grind** → standard route (Lab QC → pack → QA → ship). Packs to a Nitro Sulfur PO **if one exists, else HOLDS** (it's its own sellable product).
- **Divert** → fed **back into a production batch of the ORIGINATING product** (e.g. 150 kg back into SCU production) as input → produced → standard route → **ALWAYS to a PO**.
- **Rework** (off-spec, same base) → pooled + partial-call; **operator chooses per call: OWN batch (own #, standard route, like by-product) OR merge into an existing base batch (no own #, like divert)** → standard route → **ALWAYS to a PO**.
- **All "needs-production" routes (by-product, divert, rework) are POOLS with PARTIAL CALL** — accumulate, then Production calls a partial (or full) quantity when ready; the remainder stays pooled. Divert specifically MERGES into the originating product's batch as input (no batch# of its own). Live implementation plan + risk register: `E:\VAN Platform\VAN-Production-Reconcile-Implementation-Plan.md` (5 staged, snapshot-first, reversible). Offline prototype models it all end-to-end.
- **Batch#** for every routed batch: assigned **at "call for manufacturing" / when it enters processing** — never while accumulating.
- **KEY:** by-product, divert AND rework **all require a production/processing step before QC** — the old "ready to QC & pack" shortcut (cause of premature QC/QA) is REMOVED for all three.
- Routes in scope (confirmed all occur): by-product, divert, rework. Modeled in `VAN-Production-Command-Center-PROTOTYPE.html` (Reconcile + By-product tabs) for offline validation — NOT built in the live app.

---

## 0a) SHIPPED & LIVE — 2026-06-18 · Action Center (My Actions) audit + display fixes (code-only; no data/flow/rules/master change; pushed in commit `94593b9`)

Tab-by-tab audit, Action Center first. **Audit result: logic, rules and accuracy are sound** — replicated every action trigger against the 18-Jun snapshot: **0 stale RM-Check rows** (none on already-produced/packed lines) and **0 false Produce rows** (none where the brand is already fully packed). `Acknowledge` correctly once-per-PO; `shipReadySince` dating, COO role-union view, and urgency-first sort all good. Three display-only improvements made (all in `actionItems`/`actTiming`, read-only — no writes, no flow/ownership/master change):

1. **`Open Production` now deep-links.** New helper `gotoProduce(oid)` (sets `prodMode='po'`, `prodPOsel=oid`, opens Production) replaces the generic `gotoScreen('prod')`. Clicking a Produce row now lands on that PO ready to pick the brand — and it now behaves like every other action (which all open a targeted modal/screen). Per-brand rows kept by design (still 47 rows — you see each brand needing production), only the button changed.
2. **`Ship` consolidated to ONE row per PO.** `openDispatch(oid)` is whole-PO (tick products on the truck), so the old per-line Ship repeated the same button (e.g. `22032` showed 3 identical Ship buttons). Now emitted once per PO after the lines loop: **8 line-rows → 6 PO-rows**; brand list kept in the description (`Ship N products (a, b, c)`), and the age spans all cleared lots via `shipLines` (e.g. `22032` = 7d since 11 Jun). `actTiming` Ship case updated to aggregate `shipLines` (back-compatible with a single `it.l`).
3. **Pre-shipment `Inspect` rows now carry a date/age.** Dispatch group passed through as `disp:g`; new `actTiming` branch `else if(it.disp) c=it.disp.date` so the card shows "since / Nd pending" (was blank). 0 pending in the current snapshot, so nothing to show yet, but it will populate when an inspection is queued.

**Verification:** full main `<script>` block reconstructed and `node --check`-clean **with** all edits; isolation run of the exact edited functions against the live snapshot passed (0 Ship rows missing a date, 0 Inspect rows missing a date, 0 Produce buttons not deep-linked, Ship 8→6, Produce unchanged at 47). Real `index.html` intact at 4308 lines, 5/5 script tags, proper end. **Cosmetic left alone:** render fn is still named `screenApprovals` for the "My Actions" screen (internal only; renaming risks the screen router for no user benefit).

---

## 0e) READY TO PUSH — 2026-06-18 · Sidebar / shell nav refinement (code-only display; no logic/data/flow; NOT yet pushed)

- **Grouped sidebar** — `renderNav` rewritten to render `NAV_GROUPS` (Work / Operations / Insights / Setup & admin / Guide) with section headers, replacing the flat 14-item list. Active pill kept.
- **My Actions live count badge** (`navBadge` → `actionItems()` filtered to role; COO sees all).
- **⌘K / Ctrl+K command palette** + a sidebar "Search PO or screen" trigger (`openCmdK`/`cmdkItems`/`cmdkRender`/`cmdkKey`, overlay `#cmdk`). Jumps to any screen, or any PO (PO match routes to Tracker pre-filtered by that PO#). Arrow keys + Enter + Esc. Keydown bound once via `window._cmdkBound`.
- **User dropdown** — `#rolebox` is now a native `<details class="usermenu">` avatar menu (name/role + Sign out); no extra JS, closes naturally.
- **Breadcrumb** — topbar subtitle now shows "Group · screen sub" (`groupOf(s.id)` in `render`).
- **Collapse** — kept existing `toggleSide()` (hamburger hides the sidebar on desktop).
- **Compacting pass (post first-look):** denser sidebar (rows 5px pad, 16px icons, 32px logo, 220px width, tighter group headers); search trigger rebuilt to a single non-wrapping line (magnifier + "Search…" + Ctrl K chip); top bar compacted (title 16px/700, padding 7px 18px, 32px toggle, slimmer helpbar) + `.wrap` 16px 20px — consistent modern shell.
- **DEFERRED (noted, not built):** (a) Admin *flyout* — the Admin screen is one monolithic page, so a flyout can't deep-link into sub-cards; low value, skipped to avoid risk. (b) icon-rail collapse — current collapse hides the sidebar rather than shrinking to an icon rail.
- New CSS: `.navgrp`, `.nlbl`, `.navct`, `.usermenu*`, `.navsearch`, `.cmdk*`. New globals: `NAV_GROUPS`, `window._cmdkBound/_cmdkSel`.
- **Verified:** `node --check` clean on the shell script block; real `index.html` intact (4415 lines, 5/5 script tags, proper end). No data/flow/rules/master change.

**This push bundles:** §0c tracker-v2 refinements + §0d color scheme + §0e nav — all code-only, no DB impact.

---

## 0d) READY TO PUSH — 2026-06-18 · App-wide color scheme: Teal & Charcoal (CSS-only; no logic/data; NOT yet pushed)

Whole-app reskin via the `:root` CSS variables (primary `--navy`/`--green`/`--teal` → teal `#0e7c66`; `--blue` accent → `#2563eb`; charcoal text `--txt #1a2420`; cool neutral surfaces/lines; amber/red status kept). Swept all hardcoded old-green literals app-wide (`1f7a43`, `155e32`, `74b53a`, `e7f3ea`, `rgba(31,122,67…)`) so every screen reskins consistently — incl. helpbar, brand logo, SVG icon strokes, focus ring. Chosen as "best" for a modern, agri-appropriate, professional look. One-variable system, trivial to swap. **NEXT (in progress): full sidebar/nav refinement** — group 14 items into Work/Operations/Insights/Setup, active pill + count badge, collapsible rail, breadcrumb top bar, user dropdown, ⌘K jump-to search, Admin flyout (display-only).

---

## 0c) PO Tracker redesign — 2026-06-18 (code-only; no data/flow/rules/master change). v1 SHIPPED; v2 refinements PENDING PUSH.

Full redesign of `screenTracker`/`orderCard` + new CSS. Decision (Tahir): **at-risk pinned on top, then newest first.** All display-only — drawer stays read-only, Matrix view preserved, chip counts unchanged, no data touched.

**v2 refinements (pending push, after Tahir's first-look review):** (a) **removed the decision-strip metric cards** — they duplicated the filter chips (same Overdue/Stalled/Ready counts) and wasted vertical space; the clickable chips serve both roles now. (b) **List/Matrix toggle moved to top-left**, first in the controls bar (was hidden far-right). (c) **Sort control labelled** "Sort"; chips = filters ("All" = no filter, default), dropdown = ordering. (d) **Pinned section = OVERDUE only** (`isOverdue`), not overdue+stalled — pinning all 16 stalled left "Active" with just 2; now 2 pinned / 18 newest-first, with stalled shown amber inline. Note: the mockup shown in chat used Claude's palette for illustration; the live screen keeps VAN's own colours by design.

- **Compact one-line rows on a fixed CSS grid** (new `.tk*` classes) — fixes the column "slipping"/misalignment; far denser than the old `.t2row`.
- **Decision strip** (metric cards): Overdue / Stalled 7d+ / Ready to ship / New today.
- **Visible controls:** a proper sort `<select>` (`risk_new` default; + Newest first / By stage / Longest in stage) and a clear List/Matrix segmented toggle (`.tkseg`) — no longer hidden far-right.
- **Sections:** "Needs attention · N" (overdue+stalled, `_trkRiskCmp`) pinned above "Active · newest first · N" (`_trkNewCmp`). **All 20 shown, no cap.**
- **Search cursor bug FIXED:** input now repaints only `#trkBody` via `_trkPaint()` (no full screen re-render per keystroke) — the "backward typing" caret reset is gone.
- **REMAINING BALANCE per PO** (`orderBal` = Σordered − Σdelivered; e.g. Naya S Urea PO 6595010464 = 339,775 left of 450,000) shown as "X left · del/ord · progress bar". **Multi-product POs expand** (`toggleTrkRow`/`tkLineRow`, state in `trkExpanded`) to per-product running balance. 9/20 POs are multi-product.
- **Audit fix 1.1 applied:** the stale tracker helpbar override is disabled (`if(false){…}` at the `s.id==='tracker'` block) so the meta bar now reads "view only", matching the read-only drawer.
- New fns: `orderBal`, `tkProg`, `tkBalCell`, `tkLineRow`, `t2bars`, `toggleTrkRow`, `_trkRecv`, `_trkNewCmp`, `_trkRiskCmp`, `trkList`, `trkBodyHTML`, `_trkPaint`. New globals `trkSort`(default `risk_new`), `trkExpanded`. New `.tk*` CSS block.
- **Verified:** `node --check` clean on the tracker script block; real file intact (4357 lines, 5/5 script tags, proper end); snapshot balances correct; section split correct (all 20 shown).

---

## 0b) PO Tracker audit — 2026-06-18 (read-only review; NO code changed yet; 1 fix open + enhancements)

Tab audit #2. **Engine is accurate** — replicated ageing/overdue/stalled against the 18-Jun snapshot: of 17 "stalled" orders, 15 have *exact* stage-entry dates and are genuinely stuck (real backlog, e.g. PO `1821412156` 17d in "PO Created", `21630` 13d in "RM Check"); only 2 use the honest "~" approximate fallback. Chip counts mirror `trkMatch` exactly. No flow blockers, no security issues.

**FIX 1.1 — DONE in §0c (was: misleading helpbar vs read-only drawer):** the meta bar shows `Update here: Yes — <role fields> (click to open)` (COO sees "any field"), but the order drawer (`openOrder`) is hard read-only (`fld()` has `ed=false`, drawer says "View only") and the registry text says "Updates are entered from each role's own screen." Root cause: stale per-role override in the helpbar builder (~line 1197, `if(s.id==='tracker'){…upd='Yes — '+tm[state.role]+…}`), residue of a former editable drawer. **Fix:** delete that tracker override so it falls through to `upd='No — view only'`. Display-only.

**Enhancements (by ease×impact):** (2.1 easy/high) stalled signal dilutes at 16/20 red — tier 7–13d vs 14d+, or per-stage SLA; (2.2 easy/med) search `oninput`→`trkRender()` re-renders whole screen + manual refocus (line 1744) → debounce / list-only re-render; (2.3 easy/low) `mixed` orders show only earliest-stage next action (`NEXT_ACT[orderBucket]`) — add "+N more"; (2.4 med/low) 2 Shipment-stage POs (`6595010236` ~17d, `6595010464` ~10d) read "~" because lots carry no QA-pass/clear date — dispatch should write a clear date; (2.5 cleanup/low) **dead code:** `fld()`/`editField()`/`myOpenFields()`/`canEditField()`/`LIFE_GROUPS`/`FIELD_LABEL` are defined but never called (drawer went read-only) — removing them kills the 1.1 class of bug.

---

## 0) SHIPPED & LIVE — 2026-06-17/18 session (all verified in live code; data fixes recorded done in live DB)

**F · Production stage fix — packable stock no longer flagged "Reconcile required" (READ-ONLY display logic; no data/My-Actions change; LIVE — guard `(cleared-packed)<=0.5` confirmed in `index.html`):** `batchStage` was marking any *closed* batch with unpacked remainder as `recon`, overriding "Ready to pack" — so 21 batches of QC-cleared, fully packable stock (NP26007 25,000; HG26020 17,500; HG26019 43,500; RUBS26003 13,200; +15 SCU leftovers) showed "Reconcile required · stalled" before packing even started. Surgical fix: added `&& (cleared-packed)<=0.5` to the recon condition, so a batch is only `recon` when **no QC-cleared stock is left to pack**; the Reconcile button stays available as a choice (production AND packing stages). Verified on snapshot: exactly 21 recon→pack, every other stage unchanged (incl. VU26138 stays qc — no side effect), genuine reconcile (closed + uncleared leftover) preserved. `batchStage` is derived (stores nothing); `actionItems`/My Actions don't use it → no notification change.

**E · VU26134 phantom-lot fix (DATA migration, approved by Tahir, runs once on load; LIVE — `_fixVU26134L2V1` = true in 18 Jun snapshot, migration has run on production):** `fixPhantomLotVU26134` removes batch VU26134's duplicate phantom lot L2 — L1 & L2 shared id `LOT1158` (L2 a byte-for-byte copy of L1 with no COA), over-allocating to 10,500 kg vs the 7,000 produced, so "approve all" cleared L1 and left L2 stuck in the Lab QC queue forever. Heavily guarded: VU26134 only; only when over-allocated; only a duplicate-id lot with no approved COA; never under-allocates below producedKg; audit-logged; idempotent via `_fixVU26134L2V1`. Verified on snapshot: 3→2 lots, 10,500→7,000, exactly ONE lot removed across all batches, stuck QC clears. (Diagnosis confirmed it was a duplicate, not real production: producedKg/plannedKg=7,000, packed 6,500, L2 identical to L1, and 21/21 other SCU batches are 7,000 kg.)

**H · My Actions date + dedupe fixes (READ-ONLY display logic; no data/flow/My-Actions-membership change; LIVE — superseded by I, see note):** (1) **Ship "since" date** — `actTiming` Ship case used `l.qcPass || order.received`, but live orders never set line `qcPass` (QC is per-lot), so all 8 Ship actions showed a false "~17d since received". This was first fixed with `lastPackDate(o,l)`, then **replaced in item I by `shipReadySince`** (the truer "oldest QC-cleared, not-yet-shipped lot" — so `lastPackDate` is no longer in the code; `shipReadySince` is what's live). (2) **Acknowledge** moved out of the per-line loop → **one per PO** (was N identical actions for an N-line unacked PO; latent — 0 unacked orders currently). No action added/removed, no ownership change, no writes. Verified on snapshot.

**I · My Actions final polish (READ-ONLY display; no data/master/flow loss; LIVE — `shipReadySince` confirmed in `index.html`):** (1) **Ship "since" = oldest QC-cleared, not-yet-shipped lot** (`shipReadySince`) — truest "waiting since" (replaces the latest-packed proxy; stays consistent with when Ship actually fires). (2) **COO view hardening** — action groups derived from roles actually present (preferred order, then any extras) so no action is ever dropped if a role isn't in the fixed list. (3) **Pack-inspection trigger added** (`label:'Pack QC'`, QA Inspector, per line, `lineToInspect>0.5` → `openPackInspect`) — closes the one real completeness gap from the per-role audit; was only on the QC screen. Audit conclusion: My Actions is otherwise complete; the 29 "ready-to-pack" batches were deliberately NOT dumped in as rows (inventory state, screen-driven, would be noise). Verified on snapshot + synthetic cases.

**G · CRITICAL — auto-refresh no longer clobbers an unsaved PO (code-only; LIVE — `_savePending` confirmed in `index.html`; the LCI PO 4204003692 is now present in the 18 Jun snapshot, recv 18 Jun):** Root cause of the "I added an LCI PO and it vanished" report (PO 4204003692, confirmed absent from the 06-18 snapshot — never persisted). The 7s `startSync` did `state=ensureState(j.data)` — a **blind replace** of local state with the server's, guarded only by focused-input/modal/`hasUnsavedEntry`. After PO submit the form is cleared and you're moved to the Tracker, and the save is debounced 400ms — so a refresh firing in that gap while Production was saving (their reconcile saves were live at 08:1x on 06-18) replaced local state and wiped the just-created order before it saved. Fix: added `_savePending` (set synchronously in `save()`, cleared on successful `saveNow`); `startSync` now (1) **skips** the pull while `_savePending`, and (2) **merges** via the proven `merge3` instead of blind-replacing — so a not-yet-saved local order can never be clobbered. Verified in sandbox: simulated race keeps the new order AND the concurrent Production change. Related to backlog #18.

**A · Imported-order cleanup (data migration, runs once on load):** `purgeImportDuplicates` (13 twinned dups) + `purgeImportedNoTwin` (8 no-twin imports). Combined verified end-state 40→19 orders, 57→11 shipments, 0 `createdSeed` / 0 `by:'Imported'` left, 11 live shipments kept, idempotent. Safety skip on any import with live work. Snapshot first; keep `van-data-snapshot-2026-06-17.json` as restore point.

**B · New PO Entry P0 fixes (`entryChecks`/`submitPO`):** duplicate-PO# guard, pack>0, promised≥received + committed≥received; corrected the entry tip (invoice price here; print price at packing). Review in `reviews/NEWPO-ENTRY-REVIEW.md`.

**D · Priority + computed-risk combination (READ-ONLY, no data/alerts/master change):** `attentionOf(o)` blends computed risk (overdue→due-soon→on-track, from committed dates) with manual priority (Critical/High/Normal/Low). Used ONLY for: PO Tracker sort (`attnCmp`: risk tier → priority → days overdue → received) and a single combined "attention" chip on the order card (shows only when elevated; replaced the always-on priority pill → less clutter). Pure compute — writes nothing, adds no My Actions/audit/alerts, no master change. `priorityPill` now unused (harmless). Verified: 8/8 logic assertions (risk leads, priority orders within tier); read-only confirmed.

**C · Capable-to-promise committed dates + line/volume roll-up:**
- New master data: `masters.leadTime` {rateKgPerDay 5000 (default/fallback), qcDays 1, dispatchDays 2, rmProcureDays 7, minDays 3}; `masters.productionGroups` {Powder/Crystalline/Liquid/Granular 5000, Humic 10000, Sulfur Coated Urea 14000}; `masters.groupOfBrand` (brand→group, pre-filled by form + Potassium Humate→Humic, Sulfur Coated Urea→SCU specials; additive). All editable in **Admin · Master Data → Delivery lead-time & production groups** (`leadTimeCard`/`saveLeadTime`, COO). Rates are placeholders (thin data) — tune in Admin.
- **Committed-date engine (make-to-order, sequential):** `computeCommitted(received,qty,procureDays,brand,s)` = received + procurement + ⌈qty ÷ group-rate(brand)⌉ production + qc + dispatch, floored at minDays. **Procurement = bottleneck:** the slowest required raw material not in stock (`procureDaysFor` → `matLead`, per-material `leadDays` in rawMaterials master else default 7; 0 if all stocked). **Production rate = the brand's production-group daily rate** (`rateForBrand`→`groupRate`, else default). Auto-fills each line's committed on New PO Entry live as qty changes (`updateCommitted`; override allowed; shows "auto · Nd lead · incl Xd RM"); persisted in `submitPO`.
- **Roll-up (fixes the 9-of-10 false-delay):** PO Tracker card now shows "X of N lines late · Y/N delivered" instead of a blanket overdue stamp; dashboard adds **Overdue Lines** KPI; dashboard per-line overdue now consistently uses `l.committed` (was `o.promised`). On-time % was already line-level.
- **Promised vs Committed (settled):** Promised = customer-facing PO date; Committed = per-line ops target from the lead-time model. Products on one PO can carry different committed dates by design.
- Verified: computeCommitted / leadDays / lineRollup unit-tested; new functions syntax-checked in isolation; host file end intact. Rate 8,000 is a thin-data placeholder (5 prod records) — tune in Admin as output accrues; split per-base later.

---

## 1) SHIPPED & LIVE — 3 code edits (code only, no data touched; confirmed in live `index.html`)

1. **`lineOverdue`** (line 771) — received-date guard: a line whose `committed` date is before `o.received` is treated as a bad/imported date and is NOT overdue. Clears UDPL & Arysta false-overdue.
2. **`pmDelayLabel`** (lines ~2227–2229) — same received-date guard, plus tightened to fire the delay-reason prompt **only when genuinely overdue** (removed the "due in N days / due today" nag). Plant-Manager prompts ~50 → ~18.
3. **PO Tracker render** (line ~1456 + section logic) — grouped by **stage + owning role**, count header `N orders · M overdue`, sort = stage order then most-overdue first.

Verification: isolation-sandbox pass on overdue/delay logic; 5/5 `<script>` tags intact; edits confirmed on disk. No master-data / order / shipment / QC / stock change.

---

## 2) ALREADY LIVE (pushed earlier this session)

- PR/Receive fixes: `rmSubmit` guard (no phantom PR on empty lines), `openReceiveMaterials` matches a line's actual requisition, `healPRFlags` resets stale `prRaised`.
- Naming/recipe foundation: `RECIPE_ALIAS`, `BRAND_ALIAS`, `migrateBrandNames`, `BRANDMAP_FIX` (34 brands → 13 bases), `BYPRODUCT_BASES` (Nitro Sulfur from SCU), `loadBaseRecipesV2` (13 bases), `loadBlendRecipesV1/V2` (~34 blends), recipe-picker shows only the 13 bulk bases, RM-check blocked when a base has no recipe.
- `purgeImportedProduction`: removed imported/seed production batches + seed productionLog; KEPT orders, shipments, raw stock.
- **`purgeImportDuplicates` (DATA change — pushed 2026-06-17): the 13 duplicate-PO cleanup is DONE.** One-time, idempotent (guard `s._purgeImpDupV1`), runs in `ensureState` after `purgeImportedProduction`. Removes each `createdSeed` import copy whose PO# is shared by a live New-PO-Entry twin (no `createdSeed`), plus ONLY that PO's `by:'Imported'` shipments. Verified against the 2026-06-17 snapshot: **13 orders + 12 imported shipments removed; 11 live `Supply Chain` shipments preserved (incl. Syngenta 6595010236's 7); 0 orphan refs; idempotent on re-run.** Safety guard: any import copy showing live work (`packed`/`produced` > `delivered`) is SKIPPED, left in place, and logged to `audit` — real packing/production is never deleted. The 8 imported-no-twin orders + their ~34 imported shipments are intentionally LEFT ALONE (see OPEN below). Writes an `audit` entry on run.
- **`.gitattributes` added (2026-06-17):** repo locked to LF (`* text=auto eol=lf` + explicit html/js/json/md/yaml) to stop whole-file CRLF↔LF diff churn. After adding it, run `git add --renormalize .` once if a stray CRLF diff reappears.

---

## 3) OPEN — needs decision (13-dup cleanup now DONE; only no-twin scope remains)

**Imported-order + duplicate-PO cleanup — 13 duplicates DONE (see §2). Remaining open item: the 8 imported-no-twin orders.**
- ~~13 PO numbers each exist twice~~ — RESOLVED & LIVE via `purgeImportDuplicates` (see §2). The 13 removed: 21301, 21630, 21775, 22032, 22033, 260400001, 1821412156, 4204003087, 6595010236, 7500003652, VG-2605-0002, DLR-2605-0001, DLR-2606-0001.
- ~~STILL OPEN — the 8 imported-no-twin orders~~ — RESOLVED 2026-06-17. GOVERNING PRINCIPLE (Tahir): **anything delivered before the system went live should NOT sit in the operational system** → all 8 removed. `purgeImportedNoTwin` written + sandbox-verified, **READY TO PUSH (not yet pushed)**. Removes the 8 (6595010235, 6595010360, 260300001, 4204003000, 4204003240, P00206, VG-2605-0001, 2026-00358) + their 34 `by:'Imported'` shipments; same live-work safety skip; guard `s._purgeImpNoTwinV1`; wired after `purgeImportDuplicates`. Note: 6595010360's `ordered=250,500` vs `delivered=120,525` was inflated import data (Tahir: it was 100% delivered pre-launch), not a real open balance — removal clears the phantom overdue. Verified end-state across BOTH purges: **40→19 orders, 57→11 shipments, 0 `createdSeed` orders left, 0 `by:'Imported'` shipments left, 11 live `Supply Chain` shipments preserved, idempotent.**
- Tahir's call (13 dups): **remove the imported copy, keep the new one** — DONE.
- Cascade: imported orders' deliveries came from imported shipments → removing the orders should also remove their imported shipments, else orphan shipments / "shipped X but order shows 0" mismatches.
- UNANSWERED scope question: (A) remove ALL imported (`createdSeed`) orders + their shipments — full clean slate, matches "no opening balance"; or (B) only the 13 duplicated POs + their shipments.
- Symptom this fixes: My Actions = 161 pending (Supply Chain 59 RM-Check/Receive, Production 49, Plant Manager 50, Lab 3), mostly imported-order noise. The push above already cuts the PM delay flood; the data cleanup cuts the RM-Check/Produce floods.
- LIVE OPERATIONAL RISK (seen 2026-06-17): the duplicate POs now appear twice in the **Pack** dropdown (e.g. PO 6595010236 · Syngenta shows two entries, "needs 221,917" and "needs 271,504") — an operator can pack bulk base into the wrong (imported) copy. Interim: tell Production to pack into the NEW copy only until cleanup is done. Raises priority of this cleanup.
- Possible-intentional, do NOT auto-merge: duplicate brand lines with different qty (e.g. Max Sulfur 5,000 + 1,000) look like split lines.
- KEEP vs REMOVE marker (verified 2026-06-17): KEEP = order WITHOUT `createdSeed` (Tahir's new copy, received 2026-06-01); REMOVE = `createdSeed:true` (imported, older date). Scan = exactly 13 duplicate POs, no more.
- GOVERNING RULE (Tahir, 2026-06-17): **Imported POs are removed; whatever was entered via New PO Entry on launch day stays as the live/active order.** `createdSeed` = imported (remove); no marker = live entry (keep). Lines on the import copy that aren't on the new copy were almost always DELIVERED pre-launch (their packing records were purged, so the system shows them as "needs" but they actually shipped).
- RESOLVED:
  - **DLR-2605-0001** ✓ — 4 extra products were delivered pre-launch; Tornado-only new copy is correct. Remove import.
  - **1821412156 (Rudolf)** ✓ — Jackpot + Harbor Foliar delivered pre-launch. Remove import, keep new.
- RESOLVED (Maxim, 2026-06-17): **22032** new NPK 2,000 correct; **22033** new Enroot 7,000 keep. Remove both imports.
  - **21775** still glance-check: new Max Amino 300 vs import 900.
  - NOTE "Ordered 73,600" on 22032 = the import total (NPK 1,000); correct new total = 74,600. Should self-correct when import removed; if it shows on the NEW copy, it's a sum bug to fix — Tahir to confirm screen.
- **SAFETY RULE before deleting ANY import copy (Tahir):** flag any PO that has live production/packing/PR/shipment against it; never delete real work. Per-copy signal = line `packed`/`produced` > 0 (seed never sets `packed`, so `packed>0` on an import copy = someone packed into the wrong copy post-launch). `delivered>0` alone = pre-launch noise (expected). packingLog/shipments key off PO# (shared by both copies) so can't pin a copy — use line fields. Run the read-only flag snippet (in chat 2026-06-17) before the removal pass; if any import shows packed/produced, move that work to the live copy first.
  - Clean identical pairs (safe to drop import): 21301, 21630, 4204003087, 6595010236, 7500003652, VG-2605-0002, DLR-2606-0001.
- SAFETY-CHECK RESULT (2026-06-17, ran flag snippet): **all 13 import duplicates are SAFE to delete — no live post-launch work on any of them.** Every flagged import line shows packed==produced==delivered (seed/pre-launch signature; live packing would show packed>delivered). Post-launch packing on 21630/22032/22033 is `packingLog`-on-PO# with NO import line work → it belongs to the NEW copies (shared PO#).
- ALSO FOUND — ~8 imported orders with NO new twin (pre-launch fully-delivered history): 6595010235 (Enrich), 6595010360 (Naya S Urea 120,525), 260300001 (Humi Cash), 4204003000 (Ferti K Foliar), 4204003240 (Ferti Huma Pellet), P00206 (Kisan), VG-2605-0001 (11 products incl. discontinued V-Boron Liquid), 2026-00358 (BKK). These are the "imported, no twin" set — the OPEN SCOPE decision: remove (clean slate) vs keep (delivered history).
- CASCADE: imported orders carry many imported shipments (6595010236→11, 6595010360→12, VG-2605-0001→11). Removal must take orders + their imported shipments together (snapshot-first) or shipments orphan. NOTE near-but-distinct PO#s (6595010235 vs …236; 4204003000/…087/…240; VG-2605-0001 vs …0002) are DIFFERENT orders, NOT duplicates — leave alone.
- OPEN SCOPE: rule implies ALL imported (`createdSeed`) orders go, not just the 13 duplicated. Confirm whether imported orders with NO new-entry twin (pre-launch delivered history) should also be removed, or kept for dashboard history.
- INTERIM packing guidance to team: pack into the ✅ KEEP copy (the "needs" number matching the recv-2026-06-01 order). For 6595010236 that is "needs 221917".

---

## 4) BACKLOG (later)

- Phase 2b: monthly-budget data model + Master Data UI (#15).
- #18 harden concurrent-save merge (don't duplicate freshly-packed lots) — note the `_NNNN` order ids may be a merge artifact; check.
- #19 align Ready-to-ship columns across PO cards.
- Set MOP Granular cost (currently 0, flagged).
- Product master single source of truth: `E:\VAN Platform\VAN-Product-Master-FINAL.csv` (Tahir editing Owner/Client cols).

---

## 5) STANDING CONSTRAINTS

- **See `MODELING-GROUND-RULES.md` (permanent).** Modeling not pushing; NO master-data change without Tahir's explicit approval (ask first); no false alerts / My Actions noise / data overwrite; new computed features are read-only by default.
- No push unless sure it won't cause new trouble; no new bug / incorrect push.
- Never hurt open orders, production, shipment, QC, or master data.
- Snapshot the DB before any **data** change (code-only pushes don't touch DB).
- Never connect to the live DB with credentials. Claude cannot push — Tahir pushes via GitHub Desktop.
- Don't invent recipe ratios or costs; flag anything unverified.
- NOTE: the bash sandbox CANNOT reach `E:\VAN Platform\VAN-OP` — use Read/Write/Edit/Grep on the host path; sandbox-test logic in isolation only.
