# New PO Entry — Tab Review & Upgrade Spec

_Reviewer pass: 2026-06-17 · Scope: the `New PO Entry` screen (`screenEntry`, `renderEntryLines`, `submitPO`, and the master-data linkage `clientsForChannel` / `brandPool` / `detailForBrand`). All line refs are to `index.html` as of this date. Lens: interface, data/structure, logic, information capture, ease of use, control, correction-free operation, and master-data integrity across the wider system (recipes, RM, production-by-product, wastage, reconciliation, print price)._

---

## 0) Verdict in one line

The form is **well-built for a single-file app** — the channel→client→brand cascade, qty→packs auto-convert, live validation checklist, and the read-only RM preview are genuinely good. But it is **not yet the "master-data-driven, correction-free" entry point the system is meant to have**: the core catalog is hardcoded, there is **no duplicate-PO guard on this screen** (the exact failure that produced the 13/8 imported-duplicate cleanup), and a few capture gaps (print price, pack=0, date sanity) let bad data through to Production/Shipments.

---

## 1) What's already good (keep)

- **Cascade UX.** Channel → Client → Brand is the right shape; brands, base, form and pack auto-fill from `detailForBrand` (line 1242–1248). Picking a channel correctly resets client/lines (`onChannelChange`, line 1182).
- **Qty → packs.** `Math.ceil(qty/pack)` live preview (`updatePacks`, line 1236) — correct rounding-up for pack counts.
- **Live validation checklist** (`entryChecks`, line 1257) with a disabled submit until green — good "correction-free" instinct.
- **Per-Kg vs per-pack price guard.** The `≥ PKR 1000/Kg` heuristic + per-pack echo (`invPerPackText`, line 1237) and the submit-time confirm dialog (line 1294) catch a real, common data-entry error.
- **RM preview is read-only** and clearly labelled "reference only" — it doesn't pretend to reserve stock; Supply Chain still confirms in PO Tracker. Correct separation of duties.
- **Channel-aware fields.** Vgreen Sub, Delivery focal person, and manual-vs-auto Client PO# appear only when relevant (lines 1209–1220).

---

## 2) Critical gaps (control / correction-free) — fix first

### P0-A · No duplicate-PO# guard on submit
`submitPO` (line 1289) never checks whether the PO# already exists. The quick-add path *does* (`line 1141: state.orders.some(o=>o.po===po)`), but the main entry form does not. For manual channels (White Label / Distributor) the KAM types the client PO# by hand — nothing stops re-entering an existing one. This is the same class of defect behind the imported-duplicate mess we just cleaned. **Fix:** block submit if `state.orders.some(o=>String(o.po)===String(po))`, with a clear toast and a link to the existing PO.

### P0-B · Pack size can be empty and still submit
Packs only compute when `pack>0`; a line with qty but blank pack stores `pack:null` (line 1300) and later throws "Pack size not set" on shipment (the documented symptom at line 2317). **Fix:** add a validation row "Pack size set on every line (> 0)" and block submit; the value already auto-fills from the catalog, so this only bites when the catalog has no pack.

### P0-C · No date sanity (promised ≥ received)
No check that Promised Delivery ≥ PO Received, or that committed ≥ received. Bad imported dates are exactly why `lineOverdue`/`pmDelayLabel` needed received-date guards. Stop them at the source. **Fix:** validation rows "Promised ≥ Received" and "Each line committed ≥ Received".

### P0-D · Print price is never captured here (doc vs reality mismatch)
The top info banner and the role text say the KAM sets *"the print price and VAN invoice price"*, but the form has **only** an invoice-price column; `submitPO` hardcodes `printPrice:0` (line 1300). Print price is actually set later at packing (`packingLog.printPrice` / `priceVerifiedBy`). Either (a) add a Print Price column here, or (b) fix the banner/role copy so it stops promising a field that isn't on the screen. Pick one — today it's misleading.

---

## 3) Master-data integrity (the structural issue)

### P1-A · The client/brand catalog is hardcoded, not master data
`brandPool()` (line 1180) reads `SEED.catalog.brandsByClient`; `clientsForChannel` (line 1172) reads `SEED.catalog.clients` / `channelByClient`. Only **Dealers** come from live state (`state.dealers`). So:

- Editable as master data today: KAM names, focal persons, forms, priorities, recipes, raw materials, packing materials, costing, dealers (Admin · Master Data + Dealer Master).
- **NOT editable (needs a code push):** White-Label/Distributor/Vgreen/Cobo clients, the brand list per client, and each brand's **base, form, pack** — the very fields this screen auto-fills.

The Admin banner ("Add a value and it appears… no code change needed") is true for the reference lists but **not** for the catalog this tab depends on. This is the gap to close to make the system genuinely master-data-driven, and it ties directly to the backlog items: **Master Data UI (#15)** and **Product master single source of truth (`VAN-Product-Master-FINAL.csv`)**.

**Target:** move `clients`, `channelByClient`, and `brandsByClient` (brand → base, form, pack, default print/invoice price) into `state.masters` (seeded once from the current SEED, additively, like `ensureMasters`), edited via an Admin **Product / Client Master** UI, sourced from `VAN-Product-Master-FINAL.csv`. New PO Entry then reads live master data, and the screen's own promise becomes true.

### P1-B · Brand→base→recipe→RM chain is only as good as the catalog
The RM preview chains brand → `base` (catalog) → recipe (`masters.recipes`) → raw materials. If a brand's `base` is wrong/missing in the hardcoded catalog, the preview and the downstream RM check silently mislead. Once the catalog is master data (P1-A), add an integrity check: every catalog brand must map to a base that has a recipe (you already block this at RM-check time per the recipe-foundation work; surface it at entry as a soft warning too).

### P1-C · Wastage / yield is not represented at entry (by design — confirm)
RM preview appears to use recipe ratios without a wastage/yield uplift. If production reconciliation expects a wastage factor (it exists in `masters.varianceReasons` / yield variance), the *ordered→RM* estimate here will read low. Not necessarily wrong for a "reference only" preview, but worth a one-line note on the screen so Supply Chain knows the preview excludes wastage.

---

## 4) Logic & data-capture (medium)

- **Order id is partly meaningless.** `'O'+(state.orders.length+1)+'_'+state.seq++` (line 1297): the `length+1` part collides after deletions and conveys nothing; only the `_seq` makes it unique. Recommend `'O'+state.seq++` (pure monotonic) to avoid the `_NNNN` artefact called out in backlog #18.
- **`note` is captured in state but has no UI input** (it's in `entryLines` but never shown). Either expose a per-line note field or drop it.
- **Auto PO# uses `Math.random()` seq** (`genPO`, line 1186) — low but non-zero collision risk and not sequential. Prefer a real counter (e.g., per-channel running number) once you add the uniqueness guard.
- **Invoice price is per-line but there's no order-level price summary.** A small "Total order value" line (Σ ordered×invoice) would let the KAM sanity-check against the client PO before submit.
- **No "save as draft".** A long multi-line PO is lost on accidental navigation (state is in-memory `entryLines`). Consider persisting the in-progress entry.

## 5) Interface / ease-of-use (lower, but cheap wins)

- **The info/help banners are heavy.** Two stacked banners + a 10-row checklist push Step 2 below the fold (visible in the screenshot — the header overlaps Step 2 on this viewport). Collapse the help into one dismissible line.
- **Validation checklist could link to the offending field.** Today it lists ✗ items; clicking one should focus that input.
- **Brand dropdown** with many brands needs type-ahead/search (other logs use `regFilter`; reuse it here).
- **Committed date defaults to Promised** (good), but isn't visibly tied to it — if the KAM changes Promised after adding lines, existing lines keep the old committed. Recompute or warn.
- **Pack column placeholder vs value**: the auto-filled pack shows as a placeholder until edited, which can read as "empty". Show it as a real value with a subtle "auto" tag.

---

## 6) Proposed target design (for the rebuild of this tab)

1. **Master-data first.** Catalog (clients, brands, base/form/pack, default prices) → `state.masters`, seeded additively from `VAN-Product-Master-FINAL.csv`; Admin **Product/Client Master** UI to edit. New PO Entry reads live master data. _(Closes P1-A/B, backlog #15.)_
2. **Correction-free submit gate.** Add validation rows: unique PO#, pack>0 per line, promised≥received, committed≥received, invoice price present & <1000. Submit stays disabled until all green. _(Closes P0-A/B/C.)_
3. **Decide print-price ownership.** Either capture print price here (new column, feeds packing) or correct the copy. _(Closes P0-D.)_
4. **Cleaner ids & numbering.** `O+seq` ids; sequential per-channel PO# for auto channels. _(Backlog #18.)_
5. **Order-value summary + per-line note + brand type-ahead + draft persistence.**
6. **Surface the RM preview's assumptions** (excludes wastage; flags base-without-recipe).

---

## 7) Suggested priority order

| Pri | Item | Why |
|---|---|---|
| P0 | Duplicate-PO# guard (A) | Root cause of the duplicate-cleanup work; cheap |
| P0 | Pack>0 + date-sanity validation (B, C) | Stops bad data reaching Production/Shipments |
| P0 | Resolve print-price mismatch (D) | Screen currently promises a field it doesn't have |
| P1 | Catalog → master data + Admin UI (A/B) | Makes "master-data-driven" actually true; backlog #15 |
| P2 | ids/numbering, order-value summary, note, type-ahead, draft | Quality-of-life & integrity |
| P3 | Banner/checklist UX polish | Readability |

---

## 8) Status — P0 implemented 2026-06-17 (code-only, ready to push, NOT pushed)

- **P0-A duplicate-PO# guard** — added to `submitPO` (blocks submit if `state.orders` already has the PO#) **and** as a live checklist row "Client PO # not already used" in `entryChecks`.
- **P0-B pack > 0** — checklist row "Pack size set on every line (> 0)" + hard guard in `submitPO`.
- **P0-C date sanity** — checklist rows "Promised Delivery ≥ PO Received" and "Each line committed date ≥ PO Received" + hard guard in `submitPO`.
- **P0-D print-price mismatch** — took the minimal/reversible path: corrected the entry tip copy to "set the VAN invoice price… Print price is set later at packing." **No Print Price column added** — flip to that if you'd rather capture it at entry.
- Verified: new validation logic unit-tested in isolation (duplicate / pack / date scenarios all behave); no data-model change; submit still gated by the green checklist.

P1 (catalog → master data) and P2/P3 remain open. _Original sections above are the review; this section records what shipped._
