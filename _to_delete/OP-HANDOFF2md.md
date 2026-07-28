# VAN Order Control Tower — OP Handoff

_Updated: 2026-06-19 · COO: Tahir · Single code file: `index.html` (4308 lines, vanilla JS). Backend: `server.js` (Node/Express + MySQL on HostGator, one `app_state` JSON blob + rev counter). Deploys never touch the DB. Pushes go via GitHub Desktop (Claude cannot push). Render auto-deploys on push; rollback restores prior code only, never the DB._

> **STATUS ADD — 2026-07-28 (cloud session, later):** **DUPLICATE BATCH-ID CORRUPTION — LIVE DATA REPAIRED, CODE GUARD READY TO PUSH.** Incident: batches VLNPK26002 (NPK 8.8.6) and VB26003 (Potassium Humate) were both created as internal id `B1114` — two open tabs each held seq=1114 and `'B'+(state.seq++)` handed out the same id; `merge3` (which pairs array records by id) then cross-merged their lots on every 409, wiping VLNPK26002's 500 kg output, parking lot VLNPK26002-L1 (wrong product) + a wrong QC sample (SF0255, "VB26002-L1"/Vibrant) inside VB26003, and leaking a stray lot into VBO26001 (which had separately collided as B1132). **Live DB repaired in-app (rev 1153–1155, admin session, all other users off):** VLNPK26002 → `B1556` (500/500, lot VLNPK26002-L1 fresh in Lab QC awaiting COA), VB26003 rebuilt as `B1134` (1160/1160, lot VB26003-L2 keeps its correct analysed COA SF0256), phantom twin removed, SF0255 deleted, VBO26001 cleaned, shiftEntries SE1114/SE1130 re-pointed, seq bumped to 1558; audit lines written. **Code fix (this working tree, NOT yet pushed):** (1) `nid(prefix)` — all 17 `'X'+(state.seq++)` id sites (B/LOT/SE/PK/PR + 3 order-id sites) now append a per-tab random suffix so two tabs can never mint the same id; (2) `bumpSeqV1(s)` — on every load/merge, seq jumps above the highest numeric id suffix in the data; (3) `healDupBatchIdsV1(s)` — end of `ensureState` chain (so it also runs on every 409-merge result): any batches still sharing an id get split, later twins re-id'd, their shiftEntries/packingLog re-pointed **by batchNo**, audit line logged. All 6 script blocks `node --check` clean; heal + collision simulated in node (twin split ✓, SE re-point ✓, no dups left ✓, two same-seq tabs mint distinct ids ✓). Old ids untouched. Tahir pushes via GitHub Desktop. ⚠ Stale tabs running pre-fix code can still re-corrupt until the deploy is live and everyone reloads.
>
> **STATUS ADD — 2026-07-28 (cloud session):** **§0q MULTI-PO BATCH — PUSHED & LIVE (commit `13befc4`, merged as `ecd6db3`).** One production run serving several POs of the same product (the Fusion Potash 3-client problem): "+ Open batch" gains a **Multiple POs** mode → one batch #, one Lab COA, pack out to each linked PO. Built per Tahir's decisions: pack **defaults** to linked POs (not locked) · shift output spreads **pro-rata** · **multi-PO only** (no bulk opened for the ~40 own-base products). Code-only, no data migration, no master change. All script blocks `node --check` clean; end-to-end simulation passed (open → FY-unique guard → RM guard → pro-rata shifts → 105% cap → QC once → pack ×3 POs → stage done); render smoke passed. Tahir pushes via GitHub Desktop.
>
> **STATUS — 2026-06-19 (session handoff; new chat starts here):**
>
> **LIVE & verified:** Production reconcile programme (§0j/§0k/§0l — by-product/divert/rework + fixes), §0m Stage 5 Command-Center lanes, §0n Action-Center-as-landing, and **§0o Action Center (My Actions) REDESIGN** — the merged urgency-first worklist (risk chips + role chip bar + grouped list + drawer/stepper), browser-confirmed (52 rows, Late 11 / Today 38 / Normal 3).
>
> **§0p PO Tracker REDESIGN — PUSHED & BROWSER-VERIFIED LIVE** (Matrix dense table default, stage rail, risk strip, Matrix·List·Board, slide-in drawer, channel filter, sharpened at-risk). All four screens — Production, Action Center, PO Tracker — are now redesigned & live.
>
> **Offline prototypes (design source of truth, in `E:\VAN Platform\`):** `VAN-ActionCenter-PROTOTYPE.html` / `-v2.html`, `VAN-POTracker-PROTOTYPE.html`; design re-audit `VAN-Design-ReAudit-MyActions-POTracker-Production.md`. Agreed scheme = **teal/charcoal** (app vars `--navy`/`--amber`/`--red`/`--txt`); blue `#1d4ed8` allowed for Lab/COA only.
>
> **Still open after §0p:** §0b PO Tracker's 1 original fix; design pass on remaining tabs (QC/Lab, Shipments, Reports, Sales & Budget — Production/PO-Tracker/Action-Center done); functional live test of divert/rework draws (writes data — low-stakes batch).
>
> **Working method (Tahir, firm):** offline-prototype → inline review → port to live → **Tahir pushes via GitHub Desktop** (Claude cannot push) → Claude verifies live + updates this handoff. Snapshot before any data change. Verify every edit (isolation `node --check`; the bash mount is often stale/truncated — trust the Read/Edit file tools + isolation checks, not full-file mount checks).

---

## 0q) PUSHED — 2026-07-28 · MULTI-PO BATCH (one run · several POs · one batch # · one COA) — code-only, no data migration

**PUSH RECORD (2026-07-28):** Tahir pushed commit `13befc4` "MUTIPLE PO"; GitHub required a pull because origin carried 4-day-old commits from the second contributor (launcher.html landing page + loading/login-first, compression middleware + `compression` dep, `/api/rev` light auto-refresh poll). GitHub Desktop auto-merged — **zero conflicts** (disjoint regions; the one grep hit was a CSS `====` comment divider, not a marker) — and pushed merge `ecd6db3`, which Render deploys. **Verified ON THE DEVICE post-merge:** working tree clean & up-to-date with origin; index.html 7,802 lines, all script blocks parse (`new Function` per block, node v22), 26 multi-PO markers intact, `/api/rev` poll present; `node --check server.js` clean; compression in package.json. ⚠ Container-mount caveat re-confirmed: a re-staged file kept serving the FIRST staging (stale bytes/size) — always verify on the device, never trust the uploads mount for freshness. **Still pending: live browser click-through** — open Production → "+ Open batch" → "Multiple POs" tab, open a small real multi-PO batch, log one shift, confirm linked POs advance on the tracker and the pack modal shows "· linked".

**Problem (floor, via Production & Lab):** products registered as their own base (e.g. **Fusion Potash** — ~40 such own-base/blend products) are NOT in `BULK_BASES`, so they can only be produced "Against a PO", and a PO batch's plan + shift output are capped to that single PO. One physical run serving 3 small POs was impossible as one batch → the floor was forced into 3 batch numbers → 3 COAs for one kettle. QC principle: **one production run = one batch = one COA** (clients get copies of the same batch COA; the per-client document is the pre-shipment QA, already per PO line).

**Design decisions (Tahir, 2026-07-28):** (1) pack **defaults** to the linked POs but is **not locked** — surplus can pack to any open PO of the product; (2) production progress spreads **pro-rata** across the linked PO lines so all clients' POs show In-Production; (3) **multi-PO only** — the ~40 own-base products do NOT get speculative "Bulk → stock" (make-to-order discipline kept). `BULK_BASES` untouched.

**Built (all in `index.html`, ready to push, NOT pushed):**
1. **"+ Open batch" → third mode "Multiple POs"** (`renderOpenBatch` rebuilt; new `mbForm`/`mbBasePick`/`mbTick`/`mbQty`): pick product (derived from open PO lines via brandMap→base) → tick PO lines, allocate full/partial per line (default = remaining, capped at remaining-order AND RM-allowed; RM-unconfirmed lines disabled with "RM not confirmed") → one batch # → live planned total (`#mbTotal`, no re-render so typing keeps focus).
2. **`submitMultiBatch()`** (+ dispatch in `openBatch('multi')`): per-line guards mirror the PO path (remaining order, `rmAllows` cap), batch # FY-unique via `batchOwnerInFY` + soft format check; creates `{kind:'multi', base, allocations:[{oid,lid,po,client,brand,kg}], plannedKg:Σ}`.
3. **`submitShiftLog` pro-rata branch**: each shift's output spreads across linked lines by allocation share (last line takes the rounding remainder; capped at each line's remaining order — residual stays as batch stock); sets `prodStart`/`prodComplete`; writes **one `productionLog` slice per PO** (line-accurate registers & reversals; `multi:true` marker). Zero-output shifts log one 0-kg entry. 105% plan cap + closed-batch guard unchanged.
4. **Packing**: `openPack` preselects the brand when all allocations share one; `renderPackModal` lists **linked POs first** with a "· linked" tag and shows "opened for N POs (…)" in the header. `doPack` itself unchanged (cross-PO packing already existed).
5. **Display**: journey/lane/board/lifecycle/output-table cards + shift-log header + QC rows show the multi kind (`MULTI-PO` tag, `batchPOsLabel(b)` = "3 POs · A, B, C"); pack buttons route multi via `openPack` (was bulk-only); per-PO-line "Log output" shortcut also finds multi batches covering that line. New CSS `.pjk.multi`.

**Untouched:** Lab QC/COA chain (batch-level already — one COA per multi batch automatically), pre-shipment QA (per PO line, quantity-true off packingLog), reconcile, pools (by-product/divert/rework — their targets include multi batches automatically), `BULK_BASES`, all master data. **No migration; additive only** (new kind exists only once the floor opens one; merge-safe via record addition).

**Naming note:** the multi-PO **shipment** wizard already owned `mpForm`/`mp*` — the batch form is `mbForm`/`mb*` to avoid the collision (caught by `node --check`).

**Verified (2026-07-28, isolation):** all 6 script blocks `node --check` clean; file 7,801 lines, 6 script tags, proper end; function census = exactly +5 (`batchPOsLabel`, `mbBasePick`, `mbQty`, `mbTick`, `submitMultiBatch`). Simulation (3 Fusion Potash POs 125/175/200 = 500 Kg): open ✓ · FY-reuse blocked ✓ · RM-unconfirmed blocked ✓ · pro-rata shifts 300+200 → lines land exactly 125/175/200, `producedKg` 500, 2 lots, 6 productionLog slices summing 500 ✓ · 105% cap blocks ✓ · QC approve → packable 500 ✓ · pack ×3 POs from the one batch, 3 packingLog entries all carrying FP26001, stage → done, remainder 0 ✓ · over-alloc blocked ("max 100"), partial alloc (60 of 100) ✓. Render smoke: multi modal (tabs/rows/RM flag/total/submit) ✓, pack modal linked-first + tag ✓, brand preselect ✓.

**Known nuances (accepted v1):** (a) reconcile of a shortfall doesn't walk back the pro-rata `l.produced` (packing's `produced=max(produced,packed)` never decreases; tracker delivery truth is `packed`); (b) budget/cost view classes multi batches as "Bulk / unassigned" (cost attribution per PO can ride packingLog later); (c) COA QC# client-prefix defaults to 'VN' for multi (no single client).

---

## 0p) SHIPPED & LIVE (browser-verified) — 2026-06-19 · PO Tracker REDESIGN ported to live `screenTracker` — render-only
_Live check (Chrome, COO): Matrix dense table default (21 rows), risk strip, 8-button stage rail, Matrix·List·Board toggle (Matrix active), Board = 7 lanes / 20 cards, drawer builds 3 bars + line items. `openTkDrawer`/`tkMatrixTable` present. Deployed cleanly._

Ports the reconciled prototype (`VAN-POTracker-PROTOTYPE.html`, from user's `o2s_po_tracker_improved_v3.html`) onto the existing tracker. **Render-only — reuses `orderBucket()` (the blocking/earliest-incomplete stage rule, already live), `orderBal`, `isOverdue/isStalled/attentionOf`, `t2matrix`, `orderCard`, `openOrder`.** No data/flow/rules change.

**Added:** (1) **slim risk strip** — open POs · at-risk · RM-blocked · Kg remaining; (2) **stage rail** — All + the 7 real buckets (PO Created → … → Delivered) with counts, click sets `trkStage`; (3) **Board view** (`t2board`) — kanban lanes by blocking stage; (4) **channel filter** (`trkChannel`); (5) **risk dropdown** (All risk / At risk / Overdue / Stalled / Priority) replacing the old risk chips that duplicated the rail; (6) **default view = Matrix** (PO × stage grid), toggle order **Matrix · List · Board**. `trkList()` now also gates by `trkStage` + `trkChannel`. New CSS `.tkstrip/.tkrail/.tkboard/.tklane/.tkbc` using live `--navy/--amber/--red` vars.

**De-dup respected:** the stage rail replaces the old RM-check/Production/Ready filter chips (which duplicated stage); the strip carries only non-stage signals.

**Matrix = the prototype's dense table** (`tkMatrixTable`, NOT the old PO×stage `t2matrix` grid — corrected after Tahir flagged the mismatch). Columns: PO · Customer · Channel · Stage (blocking) · Prod% · Pack% · Del% · Remaining · Owner · Next · Promise · Risk. Prod/Pack/Del% summed across each PO's lines; stage badge via `t2spill(orderBucket)`; risk pill Late/RM-blocked/Watch/On-track; promise via `t2promText`. (`t2matrix` left defined but unused.)

**Refinements (2026-06-19, after Tahir's live review):**
- **Slide-in drawer** (`openTkDrawer`/`closeTkDrawer`/`tkRiskBadge` + `.tkdrawer/.tkdim/.tkd*` CSS): row-click in ALL three views opens the prototype's right drawer (risk badge · Stage/Channel/KAM/Promise/Next/Remaining KV · Produced/Packed/Delivered bars · line items) with an **Open full PO** button → the existing `openOrder` detail. Replaces the prior direct `openOrder` on row-click.
- **"At risk" sharpened**: strip count = overdue OR RM-blocked OR priority-hot (dropped generic `isStalled` 7d) — was flagging ~17/18.
- **Header fix**: "N of M shown · stage = blocking" (was mislabeled "M open" while strip said the real open count).
- **Legend** only renders in List view (explains the flow dots, n/a to the table).
- **View toggle un-buried**: moved right of the toolbar with a "View" label, bolder buttons, teal border + subtle shadow (`.tkvwrap/.tkvlbl`).

**Verified:** isolation `node --check` clean on `screenTracker`/`t2board`/`trkMatch`/`trkList` (template-literal heavy). Live browser preview of the strip/rail counts couldn't run (extension connection dropped mid-session) — but every number is computed by the **already-live** `orderBucket/orderBal/isOverdue/attentionOf`, so it mirrors what the tracker already shows. Recommend: push, then a live click-through (Matrix default, rail filter, Board lanes, channel) like the Action Center.

---

## 0o) SHIPPED & LIVE (browser-verified) — 2026-06-19 · Action Center (My Actions) REDESIGN ported to live `screenApprovals` — render-only
_Live check (Chrome, COO): the merged worklist renders — 4 risk chips, role chip bar (7 roles), grouped Late·11 / Today·38 / Normal·3, 52 rows; `acRowHTML`/`acRoleBarHTML` present. Deployed cleanly._

Replaces the COO accordion "dashboard" with the approved **prototype-2 merged worklist** (design ref: user's `Action Center.html`; offline prototypes `VAN-ActionCenter-PROTOTYPE.html` / `-v2.html`). **Render-only — reuses `actionItems()` unchanged**; no rule, flow, or which-actions-exist logic touched.

**What it is:** one urgency-first list. Risk chips **All / Late / Today / Normal** (with counts) + an **oldest** caption; for COO a horizontal **role chip bar** (All + per-role counts, late in red) replaces the old left panel; grouped body **Late/blocked → Today → Normal**; each row = type badge + work (PO + customer · product · role) + waiting badge + the real action button (`it.act`). Row → **modal drawer** with Role/Product/Created/Promised/Qty-left + the 7-stage **stepper** (done / current / waiting) and the action button. Search (partial re-render, keeps focus) + Sort (risk/oldest/newest/customer).

**Role-driven (no manual toggle in live):** COO sees all roles + role bar; any other role sees only their own queue (no role bar) — same `state.role` logic as before.

**Mapping reused:** risk via `actOverdue`→late, else `actUrg()<=2`→today, else normal; age/created via `actTiming`; type colour by label (Pack QC=teal, Produce/RM=amber, Lab/COA=blue `#1d4ed8`, delay/fix=red, ship=grey); stage via `acStageOf`. New code: `acBase/acCounts/acFiltered/acRowHTML/acListHTML/acChipsHTML/acRoleBarHTML/acOpenDrawer` + new `screenApprovals`; scoped CSS `.ac2-*` (uses live `--navy/--amber/--red/--txt` vars).

**Verified offline:** isolation `node --check` clean; live risk-bucket simulation (reusing the live `actOverdue/actUrg`) on today's 64 actions → 8 late / 52 today / 4 normal (sums to 64), oldest 15d, role split Production 43·6late / QA 11·2 / SC 8 / Lab 2. Not yet browser-clicked.

**Notes / fast-follow:** the **Today** bucket is large (52) because "urgent but not overdue" (≥3d or hot) all land there — may want to split into "due soon" vs "this week" later. **Deferred from prototype:** Cards view and bulk-select (core worklist shipped first). Old helpers `actCard`/`acard` remain defined (now unused) — harmless.

---

## 0n) SHIPPED & LIVE (browser-verified) — 2026-06-19 · Landing page = Action Center for ALL users

On app open / login, every user now lands on the **Action Center ("My Actions", screen id `approvals`)** instead of the Dashboard. `screen` is a session key (never saved/shared), so the landing is set in three client spots, all now `'approvals'`: the seed default (`buildFromSeed`), `sessionInit` (reopen-with-session path), and `doLogin` (fresh login — guarded with `canView`, falls back to the role's first allowed screen only if it somehow can't view Action Center). In-session navigation (`setScreen`) is unchanged; the render-time access guards still redirect to `dash` only if a screen is genuinely unviewable. Verified: `approvals` is owned by every role. Bundled with §0m (same uncommitted `index.html`).

---

## 0m) SHIPPED & LIVE (browser-verified) — 2026-06-19 · Production STAGE 5 (Command Center lanes) — RENDER-ONLY, no logic/data change
_Live check (Chrome, COO): landing opens on My Actions; Production "All" shows 4 populated lanes (In production 2 / Awaiting Lab QC 12 / Ready to pack 7 / Packed) + By-product pool line; selecting a chip collapses to a single flat lane; back to All restores the lanes. `_prodLanes` confirmed running._

**Problem (from Tahir's live screenshot):** the Production journey was one giant flat scroll of ~30+ batch cards under the chips — hard to scan.

**Change:** when the **All** chip is selected, the journey list now renders as **labelled lanes** grouped by `batchStage` (the existing mutually-exclusive stage) — `In production` → `Awaiting Lab QC` → `Ready to pack` → `Reconcile` → `Packed — ready to close`. Each lane has a coloured header + count. Selecting a specific chip still shows that single lane as a flat list (unchanged behaviour). The by-product / divert / rework **pool lines stay as their own lanes** above. New helper `_prodLanes(items,ed)`; the journeyBoard list expression now branches `prodStage ? <flat filtered> : _prodLanes(_jb)`.

**Render-only — nothing else touched:** same `_jb` membership, same `journeyCard`, same `batchStage`/`batchClearedKg`/pack/QC logic. No data, no flow, no migration.

**Verified offline:** isolation `node --check` clean. Lane-coverage simulation on the 19-Jun snapshot: all 48 `_jb` batches bucket into exactly one lane (`producing/qc/pack/recon/done`), **0 unbucketed** — nothing is ever dropped from the board (the `done` lane catches fully-packed batches that aren't in any chip count). Not yet browser-clicked.

**Stage 4 + 5 = the Production reconcile/Command-Center programme is complete.**

---

## 0l) SHIPPED & LIVE — 2026-06-19 · Production STAGE 4c (REWORK) + pool-leak fix — code-only, no data migration

**Model:** rework = off-spec material of the **same base** — **NOT QC-cleared, needs re-processing**. Routed at reconcile into a **per-product rework pool**; Production calls it (partial) and **picks per call**: OWN batch or MERGE.

1. **Capture:** `saveReconcile` gains a `rework` branch (mirrors the pools) — accrues into one find-or-create open pool per base (`disposition:'rework', pool:true, sources[]`). No batch #, no QC while pooling.
2. **Visible line:** a **"Rework · {product}: X Kg pooled · off-spec, needs re-processing"** row on the Production journey (`_rwPools`), with a **"Call for rework ▸"** button (edit-rights only).
3. **Call** (`openRework`/`renderRework`/`submitRework`) — operator picks per call:
   - **Own batch** — assigns a batch # **now** (validated: `fyKey`/`batchOwnerInFY`/`validateBatchNo`), creates a normal producing batch (`producedKg:0`, `fromRework:true`, `reworkSources[]`) that shows on the board and follows the standard route — re-process (Log shift output) → Lab QC → pack → QA. Like by-product, but no grind label.
   - **Merge into a batch** — feeds it into a chosen open same-product batch **as input** (`reworkInputKg` + `plannedKg += qty`, `reworkedFrom[]`); rides that batch's re-process → QC → pack, **no own #**. Like divert's recycle. **Does NOT touch the target's `producedKg`/COA/`lots`/`packedKg`** (risk R6).
   - Both draws FIFO-consume the pool's `sources[]` (via the shared `consumeDivertSources`) and record the parent-batch slices for traceability; pool total recomputed from remaining sources.

**Pool-leak fix (applies to by-product/divert/rework):** `openBatches` and `doneBatches` now exclude `b.pool`, so **no pool ever appears in the Production "Open batches"/"Completed" cards** with Log-output/Reconcile buttons (this also closed a latent **divert-pool** leak from 4b, since a fully-drained pool with `plannedKg:0` would otherwise have surfaced there).

**Verified offline:** isolation `node --check` clean on the rework functions. Simulated against the 19-Jun snapshot: capture (3 reconciles → 1 pool, 400 kg), pool **not** in Open-batches, OWN call (new RW batch planned 250 / produced 0, pool −250, shows on board), MERGE (target planned +150, **produced/packed/lots unchanged**, pool drains to 0). 0 rework records live today → nothing live touched. **Pools confirmed silent in QC** (`producedKg>0` filters), **Set-batch-#** (`producedKg>0||packedKg>0`), and now **Open/Done batch cards** (`!b.pool`).

**Stage 4 COMPLETE** (4a by-product, 4b divert, 4c rework). The full reconcile model — loss / by-product / divert / rework — is now built end-to-end.

---

## 0k) SHIPPED & LIVE — 2026-06-19 · Production STAGE 4b (DIVERT) — code-only, no data migration

**Model:** divert = QC-cleared powder of the **same product**, routed at reconcile into a **visible per-product "diverted material" pool** (no own batch #, no QC, no re-processing) — then drawn two ways.

1. **Capture:** `saveReconcile` gains a `divert` branch (mirrors the by-product pool) — accrues into one find-or-create open pool per base (`disposition:'divert', pool:true, qcCleared:true, sources[]`), accumulating across many batches. No fragmented batch, no QC trigger.
2. **Hidden from the journey board:** `_jb` now excludes **all pools** (`!b.pool`) — both by-product and divert pools show on their own summary lines, never as "Producing 0" clutter.
3. **Visible line:** a **"Diverted material · {product}: X Kg available · QC-cleared"** row on the Production journey (computed via `_dvPools`), with **Recycle ▸** and **Pack to PO ▸** buttons (edit-rights only).
4. **Draws** (`openDivert`/`renderDivert`/`submitDivert`):
   - **Recycle into a batch** — feeds the diverted material into a chosen open same-product batch **as input** (`recycledInputKg` + `plannedKg += qty`, `recycledFrom[]`), then it rides that batch's normal grind → QC → pack. **Does NOT touch the target's `producedKg`/COA/`lots`/`packedKg`** (risk R6 — display/input vs. produced-math separation kept).
   - **Pack to a PO** — packs QC-cleared diverted stock straight into a brand for an open PO via the **real packing path** (creates a `packingLog` entry `fromDivert:true`, increments `l.packed`), decrements the pool. No re-processing, no new batch.
   - **Source-ledger preserved (traceability):** every draw FIFO-consumes the pool's `sources[]` via `consumeDivertSources(p,qty)` and records the exact parent-batch slices — pack writes `fromDivertSources:[{sourceBatchId,sourceBatchNo,kg}]` (NOT a single generic source #); recycle stores the slices on `recycledFrom[]`. Pool total is recomputed from the remaining `sources[]` after each draw so the ledger never drifts. Divert is QC-cleared under the parent COA, so parent-batch traceability is kept on every slice.
   - **Strictly same-product:** the recycle target and the pack PO line are both guarded at submit (`tb.base===p.base`; pack line's base via `l.base`/`SEED.brandMap` must equal `p.base`) — no brand/base mismatch, on top of the brand picker already being limited to `brandsForBase(p.base)`. Pack qty is capped to the PO's open quantity.

**Verified offline:** `node --check` clean on all 5 script blocks; `index.html` intact (4529 lines). Against the 19-Jun snapshot: 0 existing divert records (so nothing live is touched today); **no real/normal batch carries `pool:true`** (the new `!b.pool` filter hides nothing it shouldn't); simulated capture (2 reconciles → 1 pool, 1,000 kg), recycle (pool −300, target produced/packed/lots **unchanged**), and pack (pool −250, `packingLog` +1 carrying source #, `l.packed` +250) — all invariants hold. By-product pool (10,480 kg) and 51 normal batches untouched.

**Still open in Stage 4:** 4c **Rework** (operator picks own-batch like by-product OR merge like divert).

---

## 0j) SHIPPED & LIVE — 2026-06-19 · 3 live fixes (partial-batch packability + close PR + dangling notification) — code-only, no data migration

1. **Partial-batch packability (master fix):** a batch's QC-cleared, unpacked stock now **lands & accumulates in Ready-to-pack EVEN while the batch keeps producing** the remainder (it accumulates per batch as each lot clears — `batchClearedKg` already sums QC-approved lots). Changes: (a) `journeyCard` shows a **"Pack cleared (X)"** action on a producing batch when `cleared−packed>0.5`; (b) `_jc` count + the **"Ready to pack" chip/lens** include any batch with cleared-unpacked stock (so a batch can be in **Producing AND Ready-to-pack**). Fixes **MAXNK26007** (13,800 cleared of 25,000 plan — was locked under "Producing", now packable & visible in Ready-to-pack). Verified: producing 1 + pack 1, lens shows it.
2. **Close PR without full receipt:** new `closePR(prId)` + a **"Close PR"** button on the Receive-GRN card (Supply Chain / COO). Closes a PR at what was actually received — e.g. Manganese Sulfate Mono **1,500 of an over-stacked 3,000** (drops the unneeded 1,500), or **cancels** with nothing received (V-Zinc). Sets status closed, `qtyRequired=received`, reason + audit logged. Fixes the "can't close the PR" block.
3. **Dangling Receive notification fixed:** the **My-Actions "Receive" action now requires an OPEN PR** for the line's materials (`actionItems`, line ~2799). Previously it keyed only off the line (`prRaised && !rmReady && rmStatus!=='received`), so a closed/cancelled PR left the Receive action stuck in My Actions. Verified on live snapshot: the V-Zinc Receive (PR closed) disappears (6→5 actions); V-Mg's stays only while its PR is genuinely open, and clears the instant that PR is closed. Part of the PR-close flow.

**Verified:** `node --check` clean on all changes; `index.html` intact (4490 lines). **Code-only — no auto data migration** (both act only on user click); snapshot before use as good practice.

**THESE ARE NOW PART OF THE NEW PRODUCTION FLOW DESIGN (permanent, not hotfixes):**
- **Ready-to-pack is an accumulating per-batch quantity = QC-cleared − packed.** A batch can be **Producing AND Ready-to-pack at the same time**; each cleared lot lands in and accumulates into that batch's ready-to-pack; it is packable at any time while the batch keeps producing the rest. (Stage-label is no longer mutually exclusive for the pack lens.)
- **A PR can be closed before full receipt** ("received enough" → closes at the received qty; or "cancel" → nothing received), reason + audit logged — PRs no longer get stuck open.
- **Design link to Divert:** divert "pack to PO" now largely rides this same Ready-to-pack-while-producing mechanism (pack QC-cleared material to a client PO); the genuinely new divert piece is **recycle into another same-product batch** + the **cross-batch visible divert pool**.

---

## 0i) SHIPPED & LIVE — 2026-06-19 · Production STAGE 3 CORRECTIVE (by-product de-dup) — VERIFIED on live

**Pushed & confirmed on the post-corrective snapshot:** `_bpConsolidateV1` + `_bpDedupV1` both set; **21/21 fragments voided** (kg→0, no double-count); **0 by-product in the QC screen** (2 false entries cleared); 51 normal batches untouched; audit logged. **Bonus — Stage 2 proven live:** the pool grew 9,805→**10,480 Kg** (21→**23 sources**) because 2 more SCU batches were reconciled since, and they **accumulated into the single pool with NO new fragments** — confirming the accumulation logic works on live. Rule 1 (accumulation half) + Rule 5 (by-product slice) are now live & proven.

ORIGINAL NOTE (for record):

**What happened:** Stage 2+3 was pushed 19-Jun. The migration created the pool correctly (Nitro Sulfur · 9,805 Kg · 21 sources, guard set, audit logged) **BUT the 21 hard-deleted fragments came back** — the live save uses an **additive 3-way merge: record ADDITIONS stick, record DELETIONS do not survive concurrency** (a concurrent session re-adds them). Result in the post-push snapshot: 1 pool + 21 fragments = by-product **double-counted (≈19,610 Kg)**, and the 2 output-carrying fragments (B1285/B1283) re-surfaced in the **QC screen** (screenQC had no by-product filter; Stage 1 only filtered the board + actionItems).

**LESSON (important for all future migrations here): SOFT-DELETE (mark a field), never hard-delete — field edits survive the merge, record deletions don't.**

**Corrective fix (code-only, verified on the 19-Jun post-push snapshot):**
1. `dedupeByproductV1` migration — once a pool exists, **voids** leftover non-pool by-product fragments (`voided:true`, kg→0, status `void`) instead of deleting. Guard `_bpDedupV1`; only acts when a pool is present; audit-logged.
2. By-product **summary counts the POOL only** (`_bpPools.length?_bpPools:_bpAll`) — so kg is right (9,805) even if a soft-delete is partially fought by the merge.
3. `screenQC` now **excludes `disposition==='byproduct'`** — the 2 false QC entries gone from the QC tab too.
**Verified:** 19,610→9,805 summary, 21/21 fragments voided, QC by-product excluded, pool intact (9,805 · 21 sources), 51 normal batches untouched, idempotent, `node --check` clean, file intact (4458 lines). Rollback = the 19-Jun snapshot.

---

## 0h) PUSHED 2026-06-19 · Production STAGE 2+3 (logic + one-time DATA migration) — pool created OK; see §0i for the de-dup correction

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
- **Divert (CLARIFIED 2026-06-19 — e.g. Potassium Humate powder from grading)** → the SAME product, **already FINAL & QC-cleared under the parent batch's COA — NO separate QC, NO processing/grind, NO batch # of its own**. Captured at grading/reconcile and **ACCUMULATES into a per-PRODUCT "diverted material" pool/stock** (diverting from 5 batches → all land in that one product's pool; each source batch # tracked). **Production SEES it** as a visible line: "Diverted material available · [product]: X kg" (like the Nitro Sulfur by-product line). Production draws from the pool (partial) two ways: **(a) recycle** → allocate X kg as **input into a new/existing same-product production batch** (rides that batch's QC/pack), or **(b) pack** → ship X kg to a **client PO** (QC-cleared, carries source #). Stays in the visible pool until recycled or packed — never lost. _Difference vs by-product: divert pools too, but needs NO grind, NO re-QC, NO own batch #._
- **Rework** (off-spec, same base) → pooled + partial-call; **operator chooses per call: OWN batch (own #, standard route, like by-product) OR merge into an existing base batch (no own #, like divert)** → standard route → **ALWAYS to a PO**.
- **By-product & rework are POOLS with PARTIAL CALL that DO need a production/processing step** — accumulate, then Production calls a partial (or full) quantity when ready; a batch # is assigned **at call**; the remainder stays pooled. **Divert is the exception** — it is already QC-cleared (parent COA), needs NO processing, NO batch #; it is **recycled into a same-product batch as input OR packed straight to a PO** (see the Divert line above). Live implementation plan + risk register: `E:\VAN Platform\VAN-Production-Reconcile-Implementation-Plan.md` (5 staged, snapshot-first, reversible). Offline prototype models it all end-to-end.
- **Batch#** for **by-product & rework** routed batches: assigned **at "call for manufacturing" / when it enters processing** — never while accumulating. **Divert carries no own batch #** (it keeps its parent source batch # for traceability).
- **KEY:** **by-product & rework** require a production/processing step before QC — the old "ready to QC & pack" shortcut (cause of premature QC/QA) is REMOVED for those two. **Divert does NOT require any of that:** it is final & already QC-cleared under the parent batch's COA, so NO grind, NO re-QC, NO own batch # — it only **recycles** (as input into a same-product batch) or **packs to a PO**, carrying its source batch slices for traceability.
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

---

## Session 2026-06-22 — UI redesign, Production Center, dynamic roles, consolidated Dashboard

All changes were **render/layout only — no business logic, master data, flows, or access model changed** unless noted. Each edited via shell Python (assert count==1 + `/tmp` backup) → `node --check` all `<script>` blocks → runtime smoke → Tahir pushes via GitHub Desktop → verified live read-only (browser, no `save()` fired). App is **live with active users**; verification never mutated data.

**5-screen redesign (prototypes consumed, then built as deltas):**
- **My Actions** — per-row mini 7-step stepper; Group-by toggle (Priority / By stage / By role). Existing chips/role-bar/drawer/handlers untouched.
- **PO Tracker** — Matrix is now the PO × 7-stage ✓/●/· grid (`t2matrix` wired); PO drawer has a line×stage matrix; "Open in {owner}" deep-link (`BUCKET_SCREEN`→`setScreen`).
- **Lab QC** — 4-KPI strip + By status / My step / By product group-by (`qcGroup`). COA chain untouched.
- **Pre-shipment QA** — 4-KPI strip (incl. No-batch# blocked) + By status / PO / product group-by (`qaGroup`) + Cleared group. Quantity-true engine untouched.
- **Shipments** — KPI strip; two-column Ready | Shipped&closed board; **live shipNo preview** in record modal; **shipNo column** in log. DC rule already built: `shipNo = MMDDYY + 3-digit serial + DC`, DC single-use, **recording = delivered** (Dispatched≡Delivered; the dead In-transit/Mark-delivered UI was removed).

**Production Center** — global **"+ Open batch" modal** (Against a PO / Bulk → stock) on all 3 views (Floor/Output/Lifecycle), reuses `openBatch` verbatim; Floor sub-views Lanes/Board/Table; Lifecycle Batch master→detail stepper + Lots/Quality/Reconcile tabs. **Open-for-production picker tightened** to lines with `produced < ordered`. **Lanes** redesigned to compact `laneCard` (≈240px, fills the row; click → Lifecycle detail; quick action per stage).

**Dynamic roles** — Stage 1 (`seedRolesV1` → `masters.roles` objects + `rolesList()`; repointed user dropdowns + matrix columns; behaviorally identical) and **Stage 3** (Admin → "Roles" card: add/rename/archive, COO-only, audited; built-ins locked; custom roles auto-locked from admin/users/datafix; access granted via the matrix). **Stage 2 (owners[]→matrix refactor) is PARKED — build only on concrete need.** Access matrix UX: sticky Screen column + header; `amxCycle` updates the clicked cell in place (no re-render, no scroll jump).

**Dashboard — consolidated control center** (`screenDash` now tabbed; old exec/ops split replaced). Tabs: **Performance** (existing exec dashboard), **Sales & Budget**, **Production**, **Quality**, **Shipments**, **Supply Chain (RM/PR)**. Auto-selects the signed-in role's tab; deep-linking question-cards with per-role **"Your action"** highlight (`_DQOWN` map; COO sees none); small CSS trend charts (`_dbars`/`_trail7`); "Where orders are sitting" stage bar. Read-only (`execMetrics`/`floorKpis`/etc.).

**Sales & Budget folded into the Dashboard** — `screenBudget` → `budgetHtml()` rendered by the dashboard Sales tab; standalone removed from sidebar (`vis` hides `budget`); `screenBudget` redirects to the tab; **access gate preserved** (tab shows only for roles with `budget` access — Lab Rep/AQCM/QCM/QA Inspector/Supply Chain Officer are None; invoice-price action stays COO/CFO). Matrix row relabeled **"Sales & Budget (dashboard)"** (still the single control point in Admin → Access control).

**Declutter** — removed the 9 explanatory "tip" banners from screens (My Actions, Lab QC, Pre-shipment QA, Shipments, Admin, New PO Entry, Dealer Master, Reports, Users). Kept the Instructions page header, the Data Fix state banner, and the Sales "Set invoice prices" button. **Instructions rewritten** to match the current app (Production Center + Open-batch modal, quantity-true QA before shipping, DC→shipNo, record=delivered, dynamic Roles, Dashboard).

**Docs in `E:\VAN Platform\`:** added `VAN-O2S-5Screen-Redesign-Gap-Analysis-2026-06-22.md`; `VAN-O2S-Plan-Dynamic-Roles-Control-Center.md` updated (Stage 1/3 done, Stage 2 on-hold).

**Open roadmap (not started):**
- **Raw-material costs missing/zero**: Sulfuric Acid, MOP Granular (Fly Ash Waste likely intentional 0) — need real values from Tahir; blocks accurate product costing.
- **Relational DB + API** (design doc exists) — staged, off-prod first.
- **Dynamic roles Stage 2** (owners[]→matrix) — parked.
- Custom roles **Supply Chain Officer** and **Finance** exist; grant their screen access via the matrix.

**Prototype source files** (the 5 redesign zips + the Production Center kit in `E:\VAN Platform\Production Center Handoff\`) were **consumed and removed at end of this session** — superseded by the live app + the gap-analysis doc.
