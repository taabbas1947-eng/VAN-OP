# VAN Order Control Tower — OP Handoff

_Updated: 2026-06-17 · COO: Tahir · Single code file: `index.html` (~3670 lines, vanilla JS). Backend: `server.js` (Node/Express + Postgres, one `app_state` JSON blob + rev counter). Deploys never touch the DB. Pushes go via GitHub Desktop (Claude cannot push). Render auto-deploys on push; rollback restores prior code only, never the DB._

---

## 0) READY TO PUSH — 2026-06-17 session (code only, no data change; NOT pushed)

**E · VU26134 phantom-lot fix (DATA migration, approved by Tahir, runs once on load; NOT pushed):** `fixPhantomLotVU26134` removes batch VU26134's duplicate phantom lot L2 — L1 & L2 shared id `LOT1158` (L2 a byte-for-byte copy of L1 with no COA), over-allocating to 10,500 kg vs the 7,000 produced, so "approve all" cleared L1 and left L2 stuck in the Lab QC queue forever. Heavily guarded: VU26134 only; only when over-allocated; only a duplicate-id lot with no approved COA; never under-allocates below producedKg; audit-logged; idempotent via `_fixVU26134L2V1`. Verified on snapshot: 3→2 lots, 10,500→7,000, exactly ONE lot removed across all batches, stuck QC clears. (Diagnosis confirmed it was a duplicate, not real production: producedKg/plannedKg=7,000, packed 6,500, L2 identical to L1, and 21/21 other SCU batches are 7,000 kg.)

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

## 1) READY TO PUSH NOW — 3 code edits (code only, no data touched)

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
