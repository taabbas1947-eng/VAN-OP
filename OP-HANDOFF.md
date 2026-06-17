# VAN Order Control Tower — OP Handoff

_Updated: 2026-06-17 · COO: Tahir · Single code file: `index.html` (~3670 lines, vanilla JS). Backend: `server.js` (Node/Express + Postgres, one `app_state` JSON blob + rev counter). Deploys never touch the DB. Pushes go via GitHub Desktop (Claude cannot push). Render auto-deploys on push; rollback restores prior code only, never the DB._

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

---

## 3) OPEN — needs decision before any data change

**Imported-order + duplicate-PO cleanup (DATA change — not started).**
- 13 PO numbers each exist twice: an **imported** copy (`createdSeed:true`, real May dates, carries the real deliveries) and a **new** copy Tahir entered (id suffix `_NNNN`, received 2026-06-01, promised 2026-06-30).
- Tahir's call: **remove the imported copy, keep the new one** (confirmed via PO 1821412156 / Rudolf).
- Cascade: imported orders' deliveries came from imported shipments → removing the orders should also remove their imported shipments, else orphan shipments / "shipped X but order shows 0" mismatches.
- UNANSWERED scope question: (A) remove ALL imported (`createdSeed`) orders + their shipments — full clean slate, matches "no opening balance"; or (B) only the 13 duplicated POs + their shipments.
- Symptom this fixes: My Actions = 161 pending (Supply Chain 59 RM-Check/Receive, Production 49, Plant Manager 50, Lab 3), mostly imported-order noise. The push above already cuts the PM delay flood; the data cleanup cuts the RM-Check/Produce floods.
- LIVE OPERATIONAL RISK (seen 2026-06-17): the duplicate POs now appear twice in the **Pack** dropdown (e.g. PO 6595010236 · Syngenta shows two entries, "needs 221,917" and "needs 271,504") — an operator can pack bulk base into the wrong (imported) copy. Interim: tell Production to pack into the NEW copy only until cleanup is done. Raises priority of this cleanup.
- Possible-intentional, do NOT auto-merge: duplicate brand lines with different qty (e.g. Max Sulfur 5,000 + 1,000) look like split lines.

---

## 4) BACKLOG (later)

- Phase 2b: monthly-budget data model + Master Data UI (#15).
- #18 harden concurrent-save merge (don't duplicate freshly-packed lots) — note the `_NNNN` order ids may be a merge artifact; check.
- #19 align Ready-to-ship columns across PO cards.
- Set MOP Granular cost (currently 0, flagged).
- Product master single source of truth: `E:\VAN Platform\VAN-Product-Master-FINAL.csv` (Tahir editing Owner/Client cols).

---

## 5) STANDING CONSTRAINTS

- No push unless sure it won't cause new trouble; no new bug / incorrect push.
- Never hurt open orders, production, shipment, QC, or master data.
- Snapshot the DB before any **data** change (code-only pushes don't touch DB).
- Never connect to the live DB with credentials. Claude cannot push — Tahir pushes via GitHub Desktop.
- Don't invent recipe ratios or costs; flag anything unverified.
- NOTE: the bash sandbox CANNOT reach `E:\VAN Platform\VAN-OP` — use Read/Write/Edit/Grep on the host path; sandbox-test logic in isolation only.
