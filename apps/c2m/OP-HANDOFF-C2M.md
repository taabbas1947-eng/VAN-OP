# OP-HANDOFF-C2M · session log (append-only, CLAUDE.md §4.1 rules)

C2M (Cost to Margin): cost, recipes, prices and margin for every client pack. App key `c2m`, page `/c2m`,
API `/api/c2m/*`, tables `c2m_*`. Built by the collaborator (v0.5, 15–16 Oct 2026) in
`VAN Platform\Cost and Pricing\C2M App\`; its 12 documents are in `docs/`. The platform part (mount, roles,
own pool) is in `OP-HANDOFF-PLATFORM.md`, entries of 17 Oct 2026.

## 17 Oct 2026 — Step 3: C2M brought into the repo and tested locally with real data (MODULE: C2M) — NOT PUSHED

- **Into the repo:** only `apps/c2m/` from the collaborator's folder (21 files: page, routes, engine, lib,
  o2s, pricelist, logo, 12 docs, migration `001_c2m_core.sql` + `.PRODUCTION.sql`). Checked first: no customer
  prices, costs or client names; money figures in comments and docs are made-up examples, plus the base band
  rule (band values removed 18 Oct night: they are internal and may not be in the public repo) and the Rs 10 price floor. **Not brought in, never to be:** `loader/` (real customer
  prices hard-coded), `import pack/`, `local database/`, `harness/`, `node_modules/`, `Build Inputs/`.
- **Local database:** `001_c2m_core.sql` run on `van_platform` twice: 39 `c2m_` tables, 9 settings, safe twice;
  O2S `app_state` unchanged (rev 14341).
- **Tested by Tahir on his local VAN-OP (port 3000):**
  - People and access shows a C2M column. Roles given: ahmer coo, tahir coo, yawar cfo; each one is in
    `platform_access_log`.
  - `/c2m` opens with a role.
  - "Pull now" copied 241 PO lines (73 POs) and 283 trucks. A second pull gave the same counts. O2S unchanged.
- **Rehearsal of the first real data load (step 5), local only:**
  - Ran the collaborator's loader `--production` against local `van_platform`, with the import pack read
    where it is.
  - Loaded: 26 customers, 133 client products, 142 packs, 59 materials, 32 recipes, 148 dated cost versions
    (4 cost sheets, 30 Jun to 13 Oct), 37 white-label prices, 89 VAN list rows, 25 open import items.
    O2S: 241 PO lines, 283 trucks, 1 sync issue.
  - A second run was refused ("C2M already holds products"), nothing changed. Tahir: Margin shows.
  - Note for go-live: the collaborator's `C2M App\node_modules` is incomplete (`mysql2` cannot find
    `sqlstring`), so the loader does not start from that folder. The rehearsal ran from a temporary copy using
    VAN-OP's packages. Run `npm install` there first, or do the same on the day.
- **Still to do before step 4 (live):**
  - Ask the collaborator for the missing `package.json`, `tests/` and the fix for `tests/run-all.js`
    (doc 12 I-16), so C2M's own tests run here.
  - Check the flag rule (`c2m-lib.js` fixed Rs against D-31 share of sales).
  - The launcher tile stays closed and its date changes after step 4.
- **Open, from C2M's own notes:** VAN brand products have no cost (A-07); no freight (A-08); most clients
  without a price rule (A-05/A-06); 3 real packing bills, the rest placeholders (A-03/A-12).

Pushed: **no**. Tahir: "do not push until we test it locally"; push steps 2 and 3 together when he is done.

## 17 Oct 2026 (2) — Independent review of C2M v0.5: 4 reviewers, "push, but know this" (MODULE: C2M)

Code, data safety, workflow and design reviewers (none wrote C2M), read-only, with the local rehearsal data.
All 4: **safe to push with the tile closed, live C2M tables empty and no live C2M roles**; fix the items
below **before the first live load or opening the tile.** Verified in the code by the integrating session:
items 1, 2, 3, 6 and 7.

**Held up:**
- No cost, rate, price or margin reaches qc or viewer, whether on screen, in API replies or in PDFs.
- Every write route checks the role on the server.
- All values are passed as parameters; no SQL injection found.
- Money is DECIMAL.
- Most decisions are guarded against 2 people at once (409).
- The formulas that run match doc 09: F-01, 02, 04 to 13, 15.
- The O2S pull never writes O2S and rolls back on failure.
- The flag on screen follows F-13/D-31 (`c2m.html` `flag()`). The `lib.flag`/`lib.exposure` copies are unused.

**Fix before first live load / opening (for the collaborator):**
1. **No screen adds a customer, client product or pack** (no route inserts `c2m_customer` /
   `c2m_client_product` / `c2m_client_pack`). A new client or product is never costed; "Sales C2M could not
   place" tells Yawar to add it, but he can't. A VAN brand product with no recipe can't get a first recipe
   either (`c2m.html` new-recipe list filter).
2. **Import queue "Correct" changes nothing except for `rate` items** (`c2m-routes.js` import act). It changes
   nothing for 23 of the 25 day-1 items (kind `note`). The item reads "corrected" but C2M keeps the old
   figure.
3. **Planned or loading O2S trucks count as sold** (`c2m-o2s.js`: every non-voided shipment, no `stage`
   check). Their kg also stays in open POs, so it is counted twice. 0 such trucks in the rehearsal data.
4. **Re-approval "Close: the change was wrong" does not undo the wrong rate.** The same packs are queued again
   at the wrong cost with "moved for another reason", and can then be approved. Items made by a rate or
   packing price save also show a false "approved" figure and % (`from: m.now` / `c0.total` instead of the
   approved cost). A pack can sit in 2 open items (rate saves don't skip waiting packs), and approving both
   writes 2 cost versions.
5. **Rs 0 packing approved silently:** a VAN-packed pack with no packing bill, a bill item with no price, or
   pack size 0. 100 VAN-packed packs have no bill; 9 white label packs with an approved recipe have none (2
   bulk, 7 client-packed). Contradicts A-03.
6. **A price with an end date leaves a gap:** once it ends, the price it replaced does not return. Margin
   falls back to the last O2S PO price, and price lists drop the product without saying so. None of the
   approved prices has an end date yet.
7. **Separation of duties:**
   - Yawar sets rates, approves cost and approves his own re-approvals.
   - Tahir's monthly check stores no figures.
   - A platform admin who is also C2M coo can switch himself to cfo in People and access, propose, then switch
     back and approve; no route compares approver with proposer.
   - Price approval is advice only: O2S PO entry is not controlled.
   - Doc 12 I-01 says there is no stand-in.
8. **Customer price-list PDFs:**
   - The first list calls every price "New price" (O2S PO prices are ignored as previous price).
   - "Raw material cost change" is pre-filled as the reason and prints for the client.
   - An empty list can be downloaded and uses up a VAN/PL number.
   - The title month comes from the latest price date, not the issue date.
   - Every PDF is signed by Yawar, even one a KAM downloads.
9. **Live placeholders:** budgets are seeded `'0'` in the production migration, so Margin reads "against its
   0% budget". A blank Settings box saves 0 with no approval. An old Settings tab can silently put back old
   values; no 1-open-request-per-key rule.
10. **FOC sample lines:** full target price × kg is counted as locked exposure, and cost with no sale shows the
    customer red "below cost". Doc 09 has no rule.
11. **Freight is not dated** (a future rate applies today) and never raises a re-approval. No freight is
    loaded yet (A-08).
12. **C2M's tests are missing.** `tests/lib.test.js`, `flow.test.js` and `run-all.js` are not on disk, so the
    "95 checks passed" (doc 12.1) cannot be re-run. The real F-12/F-13 code lives only in `c2m.html`, and
    screens are untested.

**Smaller:**
- Labels:
  - "approved version" heads today's cost on the Recipe screen.
  - "Not costed: no approved recipe" also shows for a missing rate.
  - A pack can show "costed" with packing or conversion at 0.
  - Customer GP is shown with no sign of how much of its sales is costed.
- Hard-coded dates in screen text (13 Oct, 29 Jul).
- Guide versus screen:
  - "Blank fields are 0" ticked versus unticked.
  - "tables show as cards" is true for the Materials table only.
  - KAMs get no docs, because the viewer branch returns early.
- The first click after typing may be swallowed by a re-render. Likely, but not tested in a browser.
- Lower-case person names.
- Some refusals don't say who to ask.
- "Mark notices seen" also clears notices that arrived after the screen was drawn.
- Several 2-step routes are not one transaction, and the toast then says "Nothing was saved".
- Packing bills and customers: in 2 tabs the last save wins with no warning.
- The in-app change record shows no before/after values.
- Long text is silently cut locally (not strict mode); on live it would fail. `o2s_names` is cut at 600
  characters.
- Confirm live MySQL isolation is not SERIALIZABLE, or the pull's `app_state` read would block O2S saves.
- A missed monthly check cannot be done after the month moves on; "tie to the books" shows no gap.
- `checkDates()` opens a connection at start-up.
- Google Fonts are loaded from the internet.

Pushed: no.

## 17 Oct 2026 (3) — Launcher tile live, and a way back to the launcher (MODULE: C2M + PLATFORM) — NOT PUSHED

Tahir: "lets active the tile" and "add back to launcher in C2M".
- `launcher.html` (platform): the C2M tile is a live, role-based tile (`data-module="c2m"`, `/c2m`), like O2S.
  It opens for C2M role holders and is locked ("Access not granted") for everyone else. On live, nobody holds a
  C2M role, so it shows locked. **Give live C2M roles only after step 4 (tables) and v0.6 fixes and the data
  load (step 5).**
- `c2m.html` (C2M): "← Back to launcher" at the start of the header, linking to `/`, with the same words and
  tooltip as O2S's rail button; small `.hdr .home` style. This is the integrating session's change to the
  collaborator's file; keep it in v0.6.

Pushed: no.

## 17 Oct 2026 (4) — Tahir: C2M goes live now, with known limits (MODULE: C2M) — NOT PUSHED

Tahir's ruling, after the 4-reviewer report above: **live now, known limits.**
- Live C2M roles for **Tahir (coo) and Yawar (cfo) only** until v0.6. No other role holders: not Majid,
  Himayat, Fahim or KAMs.
- **No customer price-list PDFs are sent** until v0.6 fixes item 8 ("New price", the pre-filled reason, empty
  lists, the title month, the signature).
- The collaborator fixes items 1 to 12 in v0.6 while Tahir and Yawar use it.

Go-live steps:
1. Push.
2. `001_c2m_core.PRODUCTION.sql` in phpMyAdmin on `jodilkah_vanop_db` (Tahir).
3. First data load with the loader `--production` against live, once, from Tahir's PC. The password is
   typed by Tahir, never in chat or files.
4. Roles in People and access.
5. Check: pull O2S, Margin, and Yawar enters the real budgets (seeded 0).

Pushed: no.

## 17 Oct 2026 (5) — TASK for Monday 19 Oct 2026: C2M live data load, with Yawar (MODULE: C2M) — OPEN

Status, Saturday 17 Oct: steps 1 and 2 are done.
- Step 1: pushed by Tahir.
- Step 2: `001_c2m_core.PRODUCTION.sql` run on live by Tahir; 39 empty `c2m_` tables.

Steps 3 to 5 wait for **Monday 19 Oct**, because Yawar (CFO) is on leave until then.

**Monday, in this order:**
1. **Load the data on live.** Tahir picks one way:
   - **A (recommended):** export the C2M tables from local `van_platform` (the loader rehearsal Tahir checked on 17 Oct) as a `.sql` file. Leave out the test traces (2 test pulls by ahmer in `c2m_sync_run`, 3 `c2m_audit` rows, the copied O2S rows). Prefix the tables `jodilkah_vanop_db.`, then import in phpMyAdmin.
   - **B:** run the loader against live from Tahir's PC with the prepared script `run-live-load.ps1` (scratchpad `c2m-live-load`, outside the repo). Needs Remote MySQL for his IP and the password typed by him.
   - Either way: once only, with the loader's "refuses a second run" check.
2. **Roles on live** in People and access: Tahir **coo**, Yawar **cfo**. Nobody else until v0.6.
3. **With Yawar:**
   - Pull O2S now. Check Margin.
   - Enter the real budgets in Back Office → Rules. They are seeded 0: `budget_gp`, `ambition_gp`, `wl_budget_gp`, `conv_budget_month`.
   - Compare 2 or 3 products against his own cost sheet.
   - Start the 25 import-queue items. Note v0.6 item 2: "Correct" changes the figure only for rate items.
4. **No customer price-list PDFs are sent** until v0.6.

Until then the live C2M tile is locked for everyone, because nobody holds a C2M role.

Pushed: no (log entry only).
- **Correction, same day (Tahir):** live C2M roles are already given: **3 users, COO and CFO roles only.**
  The live C2M tile opens for those 3 and is locked only for people without a C2M role. It is not "locked for
  everyone", as written above, and it is not to be locked or hidden. Until Monday's load, those 3 see C2M
  with its tables but no costs or prices. Monday step 2 (roles) is therefore already done; check the 3
  holders in People and access.


## 18 Oct 2026 — Screen redesign ruled by Tahir, before any import (MODULE: C2M) — NOT BUILT

Tahir: "Before we start any import, we need to work on the screen, ux/ui, interface, tabs; currently it's a mess." The whole of `c2m.html` and docs 01, 06, 07, 11 were read; a picture was published for him (claude.ai artifact "C2M Screen Redesign", version 2). Counted from the code: 21 views for cfo and coo (8 tabs, 12 Back Office sections, 3 Prices views); Tahir's approvals sit on 5 screens; 1 pack's story is spread over 3 screens; Materials and packing item prices each shown twice.

**Rulings (Tahir, 18 Oct 2026):**
1. Tabs for cfo and coo: Today, Margin, Products, Prices, Inputs, Setup, Guide (7).
2. Every approval and job is done in a panel on Today, without jumping to its own screen.
3. 1 product page per client product: Recipe, Cost by pack, Price, History (replaces the separate Recipes view and the scattered price and packing parts).
4. 1 Materials table under Inputs, shared by Himayat (class and nutrient %, no rates) and Yawar (also rate).
5. Back Office becomes Setup: customers, from O2S, from Yawar's sheets, settings and targets, people and list access, monthly checks record, change record, system documentation. Work moves to Today.
6. Guide stays a tab (the "?" Help button was not taken).
7. Each screen opens with its topic and 1 answer line; long explanations go into a "How this works" fold.
8. Phone: tabs at the bottom of the screen.

Unchanged: every rule, role, right, approval step and number (docs 06, 11). Only where things sit and how they read.

Files changed: this log only. Nothing built. Pushed: no.
Next: build the new screens in `c2m.html` when Tahir says, tested locally, independent review, docs 01, 07, 08, 11 updated in the same change.


## 18 Oct 2026 (2) — Full review and redesign on Tahir's 5 questions (MODULE: C2M) — NOT BUILT

Tahir found the 18 Oct screen picture still poor (tabs, tables, price list, no reports) and asked for a full review as product manager, UX architect and systems analyst: flow gaps, accuracy and edge cases, data and architecture, interface, clarity, with no calculation mistakes. 3 independent reviewers read every C2M file and ran the real code; a 4th checked every number on the result. Published as the same claude.ai artifact "C2M Screen Redesign", version 4 (replaces versions 1 to 3).

Findings:
- Flow: 7 breaks (no screen adds client, product or pack; declared grade never checked against analysis; re-approval has no Rs effect or notice; costed-no-price packs never listed; VAN brand blocked on 3 screens; O2S PO price never compared with approved price; approval uses cost today while Margin uses approved cost).
- Calculations: core formulas F-02 to F-16 match doc 09; 19 defects around them. 5 can put a wrong cost or price in front of a client: Rs 0 packing counted as costed (1), Rs 0 conversion counted as costed (2), re-approval shows the wrong approved figure and direction (4), dealer discount divided by 100 again on resend (11), distributor list % change wrong (12). Also new: an inactive product with a pack makes every rate save fail (3); customer target ignores products with no target and can hide a red (5). Test scripts used: scratchpad run/ (session only).
- Cases: of 19 manufacturing cases, 2 handled, 8 in part, 9 not (liquids by density and FOC are the urgent ones).
- Data: history not frozen (O2S copy wiped each pull, past trucks use today's targets); 12 findings; draft migration 002 in 18 parts (0 to 17), not run anywhere.
- Design: VAN Brand Master look (logo blue, VAN navy, logo red, family chips; Space Grotesk and Archivo), left rail (Today; Margin, Reports; Products, Prices, Inputs; Setup, Guide), working tables, panels, Report Center with 14 reports, VAN letterhead price list signed by the approver.

Rulings waiting: 21 (8 change a ruled decision: D-13 look, D-06/D-22 multi-pack proposals, D-08/D-23 grade shortfall block, D-03/D-08 master formula, D-32 VAN brand, D-10/D-19 re-approval Rs limit, D-18 budget approval, D-33 stuck flag for all items).

Files changed: this log only. Pushed: no.
Next: Tahir's rulings in rounds of 4; then fix the 5 wrong-price defects and defect 3 first, locally, with tests and an independent review.

- **Rulings, same day (Tahir), round 1 of the 21:**
  - Ruling 1: keep the O2S look (D-13 stands). Only the tables, panels and Reports change; the Brand Master colours, fonts and left rail are not taken.
  - Ruling 2: "below target" on a price proposal is judged on cost today (both costs still shown).
  - Ruling 14: a sale counts when the truck is released at the gate; planned and loading trucks stay in open POs. FOC treatment still open.
  - Ruling 3: when an approved price ends with no new one, the pack shows "no price" and a job goes to Yawar's Prices to change; Margin shows the gap and does not guess a price.
- **Rulings, same day (Tahir), round 2:**
  - Ruling 4 (changes D-06, D-22): Yawar may send 1 client's price revision as 1 proposal with many packs; Tahir approves all, approves ticked, or sends back.
  - Ruling 6: a recipe whose worked-out analysis is below its declared grade is flagged in red at every step, not blocked (D-08, D-23 stand).
  - Ruling 14b: FOC sample lines are kept outside sales, GP and locked exposure; their cost shows on its own line per client and month.
  - Ruling 20 (changes D-33): every waiting item (prices, list revisions, re-approvals, import items, recipes) shows its age and holder, and is marked stuck after 2 working days, Sundays off.
- **Rulings, same day (Tahir), round 3:**
  - Ruling 9: prices use the latest rate; the gap to the ERP's weighted average shows as its own line in Tie to the books.
  - Ruling 11: on "the change was wrong", the wrong rate is voided, kept on record, no longer used.
  - Ruling 15: Rs at stake and exposure use cost today.
  - Ruling 10, in Tahir's words (being clarified with him, not yet a build rule): "The new cost will only apply when new price list of customer or segment is marked approved and shared with client. So updating the cost and new price list itself doesn't qualify if this price is not new price. We have to actually solve this: when a new price is updated, it must be agreed and all open PO should be completed, so we need a clear price list for a client, acknowledged / agreement validation for the list, before it starts assuming new price is operative."
  - Ruling 10, settled after 4 questions: (a) a new price goes live only after it is approved by Tahir, carried on a price list that is created and shared with the client, and acknowledged by the client; (b) acknowledgement = Yawar or the KAM records the date and the person at the client (no proof file); (c) once acknowledged, POs received on or after that date take the new price, open POs ship at their own PO price; (d) no acknowledgement: a job for Yawar and the KAM with days waited, on Tahir's Today after 7 days, old price stays; (e) a new cost counts from Yawar's approval, and each client shows "price not yet passed on: Rs X" = sum over trucks since approval of (approved new price - price on truck) x kg. Picture: "Price life" section of the artifact.
- **Rulings, same day (Tahir), round 4:**
  - Ruling 5: O2S shows C2M's live approved price at PO entry and asks a reason for any other price (an O2S change; C2M still writes nothing to O2S).
  - Ruling 12: re-approvals stay with Yawar alone (D-10, D-19 stand); Tahir sees each item's Rs effect on his Today for information.
  - Ruling 16: no month close; a quarter close only, done by Yawar. Reopening not yet ruled.
  - Ruling 19: the proposer can never approve the same item, enforced in the database, with 1 named stand-in for Tahir's approvals (name not yet given).
- **Rulings, same day (Tahir), round 5:**
  - Ruling 19 corrected: no stand-in after all. The proposer can never approve the same item; Tahir's approvals wait for him.
  - Ruling 16 completed: Yawar closes a quarter and may reopen it with a written reason; Tahir sees each reopening on his Today.
  - Ruling 21: only 1 open threshold change request per setting at a time.
  - Ruling 18: targets loaded on day 1 count from 1 Jul 2026 (FY start).
  - Still open: 7 (1 master formula shared by many client brands, D-03/D-08), 8 (VAN brand cost load and product model, D-32), 13 (how traded goods enter cost), 17 (budget phasing, and whether a budget change needs Tahir, D-18).
  - Ruling 18 added to (Tahir): for any old month whose GP C2M cannot work out from the data, Yawar enters that month's actual GP: 1 consolidated figure per month for white label. It replaces C2M's figure for that month and shows as "entered by Yawar".
- **Rulings, same day (Tahir), round 6, the last 4 (all 21 now settled):**
  - Ruling 7 (changes D-03, D-08): 1 master formula per base product; client brands link to it, so a change goes through the 4 steps once and applies to all linked brands; a brand that really differs keeps its own recipe.
  - Ruling 8 (changes D-32): 1 product per VAN brand pack, with 1 cost; channel and region kept on each sale; Yawar loads VAN brand costs once through a load form.
  - Ruling 13: traded goods are a 1-line recipe at the buy rate, through the normal steps, with the repack rate of D-39.
  - Ruling 17: no kg budget. A client-wise monthly budget of sales Rs and GP Rs. Sales Rs is read from O2S (state.masters.salesTargetsMonthly, found in o2s.html; C2M changes nothing in O2S). O2S holds no GP budget, so GP Rs per client per month is entered by Yawar in C2M (build reading, Tahir to correct if wrong). A change applies with a notice to Tahir (D-18 stands).
- **Next (when Tahir says build):** update docs 06 (decisions D-40 onward), 01, 03, 09, 11 with these rulings in the same change as the code; first fix the 5 wrong-price defects (1, 2, 4, 11, 12) and defect 3, then the screens in the O2S look, the panels on Today, Reports and the price-life flow; migration 002 rewritten to the rulings; local van_platform first, tests, independent review, nothing pushed by Claude.
- **Ruling 17 confirmed and added to (Tahir, same day):** GP Rs per client per month entered by Yawar in C2M: confirmed. GP never waits for a budget: with no GP budget set, each client's GP is still worked out from C2M cost against the O2S sale price (F-07). For future orders, each client and pack shows the price needed to reach target GP on cost today (F-08: cost today / (1 - target GP%)) and the Rs per kg gap to the current price (reading of "price required to achieve the gap"; Tahir to correct if wrong). Every new price revision shows its GP against cost today (as ruling 2).

## 18 Oct 2026 (3) — 0.6.0 built on local: the 6 wrong-price defects (MODULE: C2M) — NOT PUSHED

- **Tahir said "go".** Built on the local copy only. Claude pushed nothing; Tahir pushes with GitHub Desktop.
- **Fixed** (review numbers): 1 Rs 0 / part-priced packing counted as costed; 2 Rs 0 conversion counted as costed; 3 an inactive product broke every rate save; 4 re-approval showed today's cost as "from" (wrong figure and direction), now the approved cost, re-checked on approval; 11 dealer discount divided by 100 again on resend; 12 distributor list % change (previous = price before each revision on every row; no previous prints "new").
- **Rules recorded:** D-40 (costed only when complete; cost approval and pricing wait), D-41 (re-approval from the approved cost, re-checked; "first cost" items), D-42 (distributor previous price). The 21 screen rulings enter 06 from D-43 as they are built.
- **Files changed (repo):** apps/c2m/c2m-engine.js, c2m-routes.js, c2m-pricelist.js, c2m.html; docs 01, 03, 05, 06, 07, 08 (0.6.0 entry), 09, 12. No migration, no schema change, nothing outside apps/c2m.
- **Outside the repo (C2M App, Tahir's PC):** new tests/fix06.test.js (Y-01 to Y-08, 19 checks, made-up figures); run-all.js runs it after flow.test; C2M App/apps/c2m synced to the repo's apps/c2m so `npm test` there runs the 0.6.0 code.
- **Tests:** TOTAL 118 passed, 0 failed (40 lib, 57 flow, 19 fix06, confidential scan, migration sync) on a fresh c2m_test in a MariaDB 10.6 run inside the desktop app's Linux workspace. On the 0.5.0 code 17 of the 19 new checks fail.
- **Independent review, 2 rounds:** 14 points. Fixed: Rs 0 material rate = missing; no price for a pack with an approved recipe that is not costed (reason shown in place of Propose; Today job for Yawar); approval check repeated inside the transaction; packs with no approved cost not batched by rate saves, and a "first cost" item when another trigger (e.g. bill assigned) touches them; row with no price prints blank; docs and tests. Checked clean: no day-1 approved cost carries a Rs 0 part (I-23).
- **For Tahir to rule (12 I-20 to I-22, I-24):** I-20 is a Rs 0 labour or FOH rate allowed; I-21 distributor "previous" = before last revision or last issued list; I-22 approve today's cost when it moved after the item was shown, or re-batch; I-24 pricing a pack whose recipe is not in C2M yet (allow as now, check against approved cost, or refuse).
- **Data note (I-17):** 99 VAN brand packs have no packing bill; they show "Not costed: no packing bill" until bills are assigned (needed for the VAN brand cost load, ruling 8).
- **Still open, not in this change:** I-18 a pack can sit in 2 open re-approval items (rate save and packing price save do not skip waiting packs; migration 002 fixes it); the other 13 defects and the redesign.
- **Next:** Tahir reviews and pushes; then Claude tests each change on the live site before the next item (after the production migration of C2M itself, which is not live yet).
- **Tahir's 4 rulings on the review points, same day (built into 0.6.0):** I-20 a Rs 0 labour or FOH rate counts as missing (rules form refuses it); I-21 distributor previous price = price on the last list actually sent (moves only when a distributor list is issued; D-42 rewritten); I-22 approve today's cost and record both figures, as built (D-43); I-24 no price for a pack whose recipe is not in C2M yet. The 21 screen rulings now enter 06 from D-44. Tests: 119 passed, 0 failed (fix06 20 checks; 19 of 20 fail on the 0.5.0 code).
- **Correction (Tahir):** "99 VAN brand packs" was unclear wording. It is 99 pack rows of 24 VAN brand names (each listed once per channel and pack size), from the day-1 load; Tahir says VAN does not have that many brands, so the list is to be checked against Yawar's files (I-17 reworded).
- **Next asked by Tahir:** read Yawar's Dropbox folder for all costs and recipes and bring them into C2M.
- **Yawar's Dropbox folder read (read only, 18 Oct; nothing written there):** C:\Users\tahir\Dropbox\VAN-VG Price List and Cost. Master Cost Sheet saved 14 Oct 2026 11:25.
  - B2B: the 8 client tabs hold 65 recipes; every one is the same as the 13 Oct snapshot C2M already loaded (0 new, 0 gone, 0 changed).
  - VAN brand: tabs "VAN Brands DEALERS" and "VAN Brands COBO" hold 47 pack recipes (25 product names, incl. 3 outsourced packs) with materials, packing by type, labour and FOH and pack size; the 2 tabs give the same cost for every pack, so 1 cost per pack (ruling 8). "VAN Brand Cost Summary" lists the same packs. None of these are in C2M yet (the day-1 loader read only the 8 client tabs).
  - 1 more tab is a 2-option costing working, not a product. "Pakcing Material" is the packing list C2M already loaded.
  - C2M's 99 VAN rows are the same ~24 product names repeated once per channel (COBO, Dealer, Distributor, Farmer, VGreen) from O2S and the price lists; ruling 8 replaces this with 1 product per pack.
  - Waiting on Tahir: load the 47 VAN packs after building ruling 8 (1 product per pack), or into the current per-channel rows now; and the go-live steps (Go Live Plan, Ahmer) for "live".

## 18 Oct 2026 (4) — 0.7.0 built on local: ruling 8 and the VAN brand load (MODULE: C2M) — NOT PUSHED

- **Tahir ruled:** build ruling 8 first (1 product per VAN pack, the channel kept on the sale), then load the 47 VAN packs once; Claude prepares the full load (client and VAN brand), tests it locally and has it reviewed; then the live steps.
- **Correction to Claude's reply of 18 Oct:** the live migration is already done (Tahir, 17 Oct: 39 empty c2m_ tables; 3 users hold C2M roles). What remains on live: Tahir pushes 0.6.0 and 0.7.0 (no table change), then the first data load once.
- **The first live load must use the 0.7.0 loader.** Do not use Option A of 17 Oct (export of the local van_platform rehearsal): that data holds the old per-channel VAN rows, no VAN costs and no owner row, and the loader refuses a second run on live. Use Option B (loader from Tahir's PC with the 0.7.0 import pack), or re-run the 0.7.0 loader on local before any export.
- **App (repo):** apps/c2m/c2m-engine.js (matcher: VAN pack by brand and pack for any non white label line; other O2S spellings with |; double spaces ignored), c2m-routes.js (VAN sale shows the buyer, O2S channel and region; no single price for a VAN pack; a per-pack price proposal refused; an empty buyer name never matches), c2m.html (VAN products in Products and packing, Rules, Sheet against C2M; Propose hidden on VAN packs; 2 texts). Docs 01, 02, 03, 04, 05, 06 (D-44), 07, 08 (0.7.0), 09 (B-11), 10, 12 (I-17 closed, I-25 to I-28). No migration.
- **Outside the repo (C2M App):** import pack read_van_brands.py and van-brands-<date>.json (4 dates); loader VAN block; tests van07.test.js (Z-01 to Z-07), flow P-04 finds its item by cause, run-all order and scan (VAN figures and names).
- **Load result (local):** 30 VAN products, 52 packs; 45 carry Yawar's figures as approved cost (Rs 0 labour and FOH in his sheet replaced by the band); 2 bottle packs wait with Majid (sheet pack size 1 for a 500 ml bottle); 5 O2S packs have no column and no cost. Materials and packing rebuild his sheet for every costed pack; all VAN-channel truck kg match a pack; white label costs and rates unchanged. 29 of the costed VAN packs move more than 3% on the bands (mostly down), in 1 re-approval item for Yawar.
- **Tests:** 126 passed, 0 failed. Independent review: 10 points; fixed as listed in 08 (0.7.0).
- **Open for Yawar (queue):** name matches, in-house or bought-in product, 2 bottle pack sizes, 1 pack size 20 or 25, packs with no column, a can priced at the 20 L figure, VAN targets, a costing working that is not a product, packing to itemise.
- **Next:** Tahir pushes 0.6.0 and 0.7.0 with GitHub Desktop; then the first live load with Yawar (Option B); Claude then checks the live site.

## 18 Oct 2026 (5) — Pushed 0.6.0 and 0.7.0 checked live; Monday load prepared; 0.8.0 screens built on local (MODULE: C2M) — 0.8.0 NOT PUSHED

- **Live check of Tahir's push (18 Oct, 17:29, commit "c2m", 16 files):** the live page serves 0.7.0; all 8 C2M tabs open as Tahir (COO) with no page error; C2M is empty until the load; O2S opens.
- **Monday's first live load (Option B), prepared outside the repo (C2M App\loader, confidential):**
  - `run-live-load.ps1` asks host, user, database and a hidden password, sets C2M_DB_SSL=1 (`-StrictCertificate` to check HostGator's certificate), refuses a blank host or user, runs `live-load.js`, clears the details after.
  - `live-load.js`: read-only before-checks (39 tables, all 37 data tables empty, 9 settings with the 4 budget figures 0, 4 sources, the session's SSL cipher, app_state, the 9 import pack files, the 0.7.0 loader), then LOAD typed by hand (anything else = dry run), the loader once, after-counts on a new connection against the rehearsal, a log with no password or figure. After a failure it counts what is really in C2M.
  - The loader now refuses a live run without encryption.
  - `C2M first load FALLBACK.sql` for phpMyAdmin, only if HostGator refuses the encrypted connection: the same load as a rehearsal, 1 transaction, refuses a second import.
  - Practised on a local live look-alike: dry run, refused second run, a forced failure that changed nothing, a dropped idle connection, every refusal path. Independent review: no blocker; 14 points fixed.
  - Rehearsal counts: 65 products, 93 packs (52 VAN), 59 recipe versions, 328 cost versions, 68 rates, 38 open import items, 2 re-approval items (21 white label packs, 26 VAN packs). New O2S sales since 13 Oct can raise some counts.
  - Loader text fixes: "pack added to undefined"; recipes item counts white label only (32); 1 VAN pack size asked once; the liner item names the bill from Yawar's own formula; a VAN pack's packing reads "per unit at your sheet's pack size 1". (Product names removed 18 Oct night: none may be in the public repo.)
  - Checklist: `E:\Cost and Pricing\C2M Live Load Monday Checklist.md` (Sunday dry run, the load, counts, what to do if something goes wrong). Yawar's 38 questions: `E:\Cost and Pricing\Yawar Import Questions 19 Oct.txt`. Go Live Plan step 8 rewritten to point to them.
  - The 4 budget settings are loaded from budget V9 (not 0): Yawar confirms them.
- **0.8.0, the screen redesign stage 1 (Tahir's 8 screen rulings; D-45 to D-52):** 7 places for cfo and coo (Today, Margin, Products, Prices, Inputs, Setup, Guide); every approval and job in a panel on Today ("Open to ..." elsewhere opens the same panel); 1 product page per client product (Recipe, Cost by pack, Price, History); 1 materials table on Inputs (Himayat: no rates, as before); Setup replaces Back Office; Prices with 5 views; topic and 1 answer line with a "How this works" fold on every screen; phone tabs at the bottom. No right, rule, formula or table changed: the routes diff is the nav lists and 4 message texts.
  - **Files (repo):** apps/c2m/c2m.html, c2m-routes.js; docs 01, 02, 04, 05, 06 (D-45 to D-52), 07, 08 (0.8.0), 09, 10, 11, 12.
  - **Outside the repo (C2M App):** tests/ui08.test.js (U-01 to U-12, jsdom), run-all.js runs it last, flow.test A-01 and H-01, van07 Z-08; package.json 0.8.0 with jsdom 24.1.3 as a dev dependency (installed); loader and live-load files above.
  - **Tests:** TOTAL 139 passed, 0 failed (lib 40, van07 8, flow 57, fix06 20, ui08 12, confidential scan 730 figures, migration sync). Screens looked at by Claude at laptop and phone width.
  - **Independent review:** 10 findings, all fixed (2 high: a form drawn behind a panel and again in it sent an old price, and blocked a list send back); re-checked by the same reviewer: all 10 confirmed; 2 new low keyboard-focus points fixed (test U-12).
  - **Not in this stage:** Reports (14), the price life flow, migration 002, and the other rulings of the 21.
- **Next:** Monday: Sunday dry run, then the live load with Yawar (checklist); Claude checks live after. Tahir pushes 0.8.0 when he is happy with it (no table change); Claude then tests it on live.
- **0.8.0 pushed by Tahir (18 Oct, 20:16, commit "C2M") and checked live by Claude:** the live page serves 0.8.0; Tahir (COO) sees the 7 places; every place and its sub-views (Prices 5, Inputs 3, Setup 8) open with their topic and answer line, no page error, no id used twice; Today's job (the Sep rate check) opens its panel, the header and screen behind are inert, Close works; O2S opens. Seen on live with no data loaded: Prices, By customer reads ": 0 packs." when there is no white label client (to fix in the next change; it reads right once the load is in).

## 18 Oct 2026 (6): C2M 0.9.0, the approved picture with the left rail, ready to push before the load
- **Asked (Tahir):** after 0.8.0 went live he saw no visual change. Claude made a side-by-side page (live 0.8.0 against the approved picture, version 4: 46 items not built). Tahir ruled: take the left rail (ruling 1 changed: navy rail, the page keeps the O2S look); all items in 1 change, ready before Monday's load; family chips by product type; stuck after more than 2 working days, Monday to Saturday; no declared % ("no new database entry or migration"); Reports split: 2 now, the other 12 drawn for approval and built in 0.9.1.
- **Built (D-53 to D-58):** left rail with Find anything (Ctrl K) and Reports for Yawar and Tahir (8 places); Today with the next move, groups, ages and stuck; Margin with 4 figures, the GP trend, the stake card and the customer working table with Excel export; product page with step dates, the cost waterfall, cost and price in 1 tab, Price history and Sales; Prices as 1 list with reason pills, tab counts, Waiting for date, propose in a side panel; Tahir's approval panel with tiles; recipe review with nutrient % per input and the working; Reports with GP bridge and PO price against approved price; price list preview and PDF with the number block, price basis and 2 signatures; phone bar of 4 places and More. Also fixed: Prices, By customer read ": 0 packs." with no data.
- **Server, read only:** state adds priceHistory, poLines (this FY), importedAt, nextDocRef for cfo and coo only; fam and typeName on products; propose refuses an empty client reason. No table, column or migration.
- **Files (repo):** apps/c2m/c2m.html, c2m-routes.js, c2m-pricelist.js, c2m-lib.js; docs 01 to 12 (06: D-53 to D-58; 08: 0.9.0).
- **Outside the repo (C2M App):** tests/ui09.test.js (V-01 to V-15), run-all.js runs it; ui08 and flow A-01 changed for 8 places and the new tabs. Monday checklist: push 0.9.0 first, 0.9.0 screen names.
- **Tests:** TOTAL 154 passed, 0 failed (lib 40, van07 8, flow 57, fix06 20, ui08 12, ui09 15, confidential scan 730 figures, migration sync). Screens looked at by Claude at laptop and phone width with example data; PDFs looked at for white label, distributor and dealer lists.
- **Independent review:** 1 high (price history and the PO report dropped prices a newer price had replaced), 4 medium (speed on Margin, PDF layout, bridge wording, no-price job counted twice), lows on focus, dark mode, ages; all fixed and re-tested (V-15 added). Kept: the step chip reads "Majid checked" (the system's step name).
- **Next:** Tahir pushes 0.9.0; Claude checks live; then the dry run and Monday's load. Tahir approves or changes the 12 report pictures (5 need a decision) for 0.9.1.
- **0.9.0 pushed by Tahir (18 Oct, 22:03) and checked live by Claude:** the navy rail, 8 places, every view opens with no page or console error, Today's panel, Reports and Find anything work. Tahir then saw the views inside a place did not look like tabs; he chose folder tabs (D-59). Built and tested (ui08 12, ui09 15 passed); files: c2m.html, docs 06 and 08. To push.

## 18 Oct 2026 (7): C2M 0.9.1, the 3 independent reviews, built overnight, ready to push before the load
- **Asked (Tahir, 22:25):** after the folder tabs, 2 independent expert reviews (a cost and management accountant, a UI/UX expert), their findings built, and every system document audited. Ruled: "Also rules and formulas" (rules and formulas may change, still no migration); "Before the load": built, tested and reviewed overnight; Tahir pushes in the morning, Claude checks live, then the dry run and the load.
- **Verdicts:** cost and management accountant: ready with fixes (3 must, 10 should). UI/UX: ready with fixes (10 must, 18 should). Documentation audit: 136 findings (22 high).
- **Built (D-60 to D-67):** a truck counts as sold only with its gate pass (13 trucks still loading were counted as sold and as open; 258 trucks on the 13 Oct export, not 271); approve ticked only leaves the rest in a new item; FOC out of sales, GP and open POs; customer target judged on products with a target; an ended price leaves no price; dated prices count from their date; 1 rule for the Rs a proposal adds; GP bridge Method bar and kg and L apart; GP on cost today; the proposer never approves; Tahir told of every labour and FOH, packing bill, product type and reprocessed change; monthly checks with figures (C2M figures worked out by the server); recipe quantity check; screen fixes: live propose panel, search as you type, dates in words, Save for cost-moving changes, empty states, colours, phone cards, verbs, labels, eyebrows, folded explanations, green 2-tap confirm, bridge axis, trend month to date, price list builder order. Not built (D-67): unrecovered conversion line (D-29 stands), VAN list revision cost per row (waits for the VAN list matching decision), liquids by density (Yawar), anything needing a table.
- **Files (repo):** apps/c2m/c2m.html, c2m-routes.js, c2m-o2s.js, c2m-lib.js (comment), migrations/001_c2m_core.sql and .PRODUCTION.sql (comments only: band values and a packing example removed; no schema change; A-21 for Tahir to confirm), docs 01 to 12, OP-HANDOFF-C2M.md.
- **Outside the repo (C2M App):** tests/fix091.test.js (N-01 to N-07), ui09 V-16 to V-18, flow and ui08 updated, run-all.js (fix091 and a band-value scan), loader/live-load.js (trucks 258), loader/load-import-pack.js (field map text), README, package.json 0.9.1.
- **Tests:** TOTAL 163 passed, 0 failed (lib 40, van07 8, flow 57, fix06 20, ui08 12, ui09 18, fix091 6, confidential scan, migration sync). Screens looked at by Claude at laptop and phone width with example data.
- **Independent re-review of the 0.9.1 code:** no blocker; 9 should items and the nits fixed and re-tested (see 12.4).
- **Corrections to earlier entries (this file is append-only, so they are written here):** line 13: the band values were removed from that line on 18 Oct night (public repo); the 18 Oct (6) entry: "5 need a decision" for the report pictures is 3 (volume, rate shock and rupee, FOC and samples), and they are now built in 0.9.2, not 0.9.1; the folder tabs (D-59) are not in the live 0.9.0, they ship in 0.9.1; "Back Office" names in older entries are now Setup (D-49); older headings use em dashes, kept as written.
- **To push:** the files above. **Next:** Tahir pushes 0.9.1; Claude checks live; the dry run and the load. The load uses the 0.9.1 pull (gate pass trucks only).
- **0.9.1 pushed by Tahir (19 Oct, 09:39, commit "c2m") and checked live by Claude (10:10):** the live page serves 0.9.1; Tahir (COO) sees the 8 places; with the empty database every place says "No data in C2M yet" and where it comes from; every place and its folder tabs (Prices 6, Inputs 3, Setup 8) open with their topic and answer line; both reports open; the 12 documents show version 0.9.1; no page error. Next: the dry run, then the load.
- **C2M roles given (19 Oct, 10:40, Tahir asked; done by Claude in his People and access):** majid production, himayat qc, fahim plant; ali, irfan and saad viewer (price lists only). Already held: tahir coo, yawar cfo, ahmer coo (Tahir: system administrator, keeps full access for now). Saad needs the dealer list: Yawar ticks it in C2M Setup, People and access (list grants are the cfo's, 11.6); Ali and Irfan get their lists the same way.

## 19 Oct 2026 (1): C2M 0.9.2, Prices By customer shows each pack against target (D-68, D-69)
- **Asked (Tahir, 10:39):** can Yawar and Tahir see in 1 or 2 clicks whether current white label and VAN brand prices meet the GP target, client by client and product by product? Answer: white label yes (Prices; Prices, By customer), VAN brand no (no VAN brand target; no screen sets list prices against cost). Tahir chose all 3: (a) a state marker on By customer, (b) Yawar enters VAN brand targets through the target requests, (c) the VAN brand list margin report after its picture and the list matching decision.
- **Built (a), D-68:** Prices, By customer opens on All clients: every white label pack at today's price, GP on cost today, target and a state (red below floor, below cost or no price, which says why; amber below target; green on target; grey no target or not costed), worst first, counts in the answer line; each client in the list shows "n of N on target". The product page uses the same rule. To change says "below floor" for what it called "below contribution"; a price of 0 is no price.
- **(b), D-69:** no code. After the load Yawar enters the VAN brand targets in Setup, Settings and targets; Tahir approves on Today.
- **(c):** the report picture now has the target and a state (12-report page, VAN brand list margin); 3 answers wait for Tahir: match by name, GP basis before freight, 1 target per product.
- **Files (repo):** apps/c2m/c2m.html, docs 01, 06, 07, 08, 09, 10, 11, 12, OP-HANDOFF-C2M.md. **Outside the repo:** tests/ui09.test.js (V-19). **Tests:** TOTAL 164 passed, 0 failed. **Independent review:** 1 blocker (below floor could never show) and 5 should items, all fixed; re-check confirmed; its 3 nits fixed.
- **To push:** the files above. No migration.
- **19 Oct 2026 (2), same release, before the push:** Tahir answered the 3 report questions (11:12 to 11:16). D-69 (b) withdrawn: no GP target per VAN brand product, and C2M does not track sales or stock product by product. D-70: every VAN brand list row and the VAN brand portfolio GP are judged against the company ambition GP; GP before freight on every list; farmer prices net of 1 tax rate Yawar sets and Tahir approves; each list row carries its C2M pack (in its data, no migration). D-71: C2M does its minimum even if O2S stops; O2S is a second source. The report picture is redrawn; still to confirm: farmer tax as price / (1 + rate), dealer GP before or after the additional discount, and the picture. Files changed again: docs 06, 08, 12 (no code).
- **19 Oct 2026 (3), same release, before the push:** Tahir (12:08): dealer GP on the NSV before the additional discount; the farmer retail price includes FED 5%; the tax on VAN is only FED 5%, on every product and client. He chose 1 FED setting for all and all wording to FED. D-72: setting fed_pct (5; Yawar proposes, Tahir approves; added by the first load, a missing row reads 5) used in the O2S pull, distributor price with FED, dealer net with FED, every price list note and basis line; an approved change works again every distributor and dealer row; a document keeps its FED %. Wording: no "sales tax" or "taxes" left. Independent review: ready with fixes, 0 blocker; SHOULD 2 (share lock on the FED read in applyRevision) and the NITs fixed; SHOULD 1 is I-38 for Tahir (a FED change reaches past PO prices at the next pull). Tests TOTAL 169 passed, 0 failed (fix092 K-01 to K-04 new). Files: apps/c2m/c2m.html, c2m-lib.js, c2m-o2s.js, c2m-routes.js, c2m-pricelist.js, docs 02, 04, 05, 06, 08, 09, 10, 11, 12, this file. Outside the repo: loader/load-import-pack.js and make-fallback-sql.js (the loader must be this one for the first load), tests/run-all.js, lib.test.js, fix092.test.js.
- **19 Oct 2026 (4):** Tahir on I-38 (a FED change reaching past PO prices): "no action for now". I-38 parked; docs 08 and 12 say so.
- **19 Oct 2026 (5):** 0.9.2 pushed by Tahir at 12:43; checked live by Claude: new page served (By customer, FED setting), state fedPct 5 (row not there yet, reads 5), settings still 9 rows (live-load pre-check holds), Prices and By customer open with no console errors, price list notes and basis say FED (5%) on all 4 lists, no "sales tax" or "taxes". With no data loaded, By customer shows "No white label client in C2M yet"; its colours are checked after the load.
- **19 Oct 2026 (6): first live load done** by Tahir at about 13:17 (605 s, encrypted, certificate not checked: HostGator does not send its full chain). After: 66 products (rehearsal 65), 94 packs (93), VAN packs 52, recipes 59, cost versions 328, rates 68, queue 38, re-approvals 2, 1 O2S pull; customers 29, PO lines 250, trucks 284. The 1 extra product and pack is a white label product first sold in O2S after 13 Oct (UDPL, 0.5 L): no recipe, no cost, priced from its O2S PO; it has no queue item. The 38 queue items are the same as the rehearsal, so Yawar's 38 questions stand. Sync issue: 1 O2S PO line priced Rs 0.001 (to correct in O2S). Settings: 10 rows, fed_pct 5, budget figures loaded. Checked live by Claude: Today shows data; Prices, By customer opens on All clients with the states (15 of 42 packs on target) and no console errors.
- **19 Oct 2026 (7): C2M 0.9.3, Reports, VAN brand list margin (D-73).** Tahir approved the picture at 13:33. Built: 1 line per VAN pack with cost today per pack (before freight) and GP on the distributor (ex FED), dealer (NSV ex FED, before the additional discount) and farmer list (price / 1.05; Punjab, Sindh, Sindh credit), red below cost, amber below the ambition GP, green at or above, worst first; the answer line gives the VAN brand portfolio GP this FY against the ambition GP and names the worst pack. The first load ran before the links, so each list row is linked to its C2M pack in the report: C2M suggests (same name, size and unit, marked "suggested: check"), Yawar checks and saves (new route POST /api/c2m/lists/links, cfo; packId inside the row data, no migration). Independent review: 1 blocker (real figures in the F-22 example) and 5 should, all fixed; re-check found 1 new blocker (a real price in the new example) and 1 should (sort within a colour), both fixed; final check: ready. Tests TOTAL 176 passed, 0 failed (van093 L-01 to L-07 new; ui09 V-11 counts 3 ready reports; the scan blocks the ambition figure). Files (repo): apps/c2m/c2m.html, c2m-routes.js, docs 01, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, this file. Outside the repo: tests/van093.test.js, ui09.test.js, run-all.js. After the push: Yawar links the rows in Reports, VAN brand list margin.
- **19 Oct 2026 (8):** 0.9.3 pushed by Tahir at 14:38; checked live by Claude as Tahir: new page served; Reports shows 3 ready, 11 drawn; Reports, VAN brand list margin opens with no console errors: portfolio GP line against the ambition GP, "No list row is linked to its C2M pack yet", 89 list rows (25 distributor, 27 dealer, 37 farmer) not linked, read only for Tahir (no Save, no picks); POST /api/c2m/lists/links refuses Tahir (403). C2M will suggest 56 of the 89 (20, 18, 18) when Yawar opens it. Next: Yawar checks the suggestions, links the rest, Save links; then Claude checks the filled table.

## 19 Oct 2026 (9): C2M 1.0.0, the new C2M (5 places), built, tested and reviewed, ready for Tahir to push
- **Asked (Tahir):** "Lets built now?" after the demo. Answers: whole new C2M, all 5 places at once, replace each old screen as its new place lands, the extras under a "More" link; the company GP target is the budget figure for every product with none of its own, and ambition is the only other figure (figures in the settings, not in this public file); VAN brand packs held once with a column per list; VGreen 1 price on the farmer list.
- **Built (D-74 to D-79, dated 19 Oct 2026):** buyer sync rule from the O2S category on each PO (white label, distributors, dealers named; COBO and VGreen 1 line each; farmers and others pooled, never named); every product has a GP target (company target by default); 5 places for Yawar and Tahir (Approvals, Products, Client prices, Margin, Setup) with More (Reports, Inputs, Back office, Guide); product page 2 tabs; Client prices with white label rows typed in place and sent as proposals; VAN brand price grid sent as list revisions (a pack not on a list adds its row on approval, only once every row of that list is linked to its pack); Margin rebuilt on the approved picture (version 11) with 1 red rule shared with Approvals.
- **Found and fixed while testing (before review):** Tahir's Approve sat in the Client prices row: now "Open to approve" opens the panel (D-46); red on Margin used the points only (every line red): now the Setup rule; the VAN grid matched list rows by a list of near names written in the code (broke B-18 and put product names in the public folder): now the B-18 rule only; phone bar of 4 with the 5th place under More; Margin chips scrolled the whole page sideways on a phone; an added farmer row would print with no size; a price typed in an empty cell of a list with unlinked rows could add a second row for a pack (guard added, I-43).
- **Files (repo):** apps/c2m/c2m.html, c2m-routes.js, c2m-lib.js, c2m-engine.js (the company GP target waits for Tahir); docs 01 to 12 (version 1.0.0; 06: D-74 to D-79). No migration, no table or column, no production SQL.
- **Outside the repo (C2M App):** tests/c2m100.test.js (new, T-01 to T-18), tests/lib.test.js (J-01, J-02), tests/run-all.js (runs c2m100), tests/flow.test.js (A-01, S-01), tests/ui08.test.js, tests/ui09.test.js (V-05, V-06, V-08, V-18, V-19 retired with the old screens), tests/van093.test.js (L-05), tests/fix06.test.js (Y-05 reads the new resend key).
- **Tests:** TOTAL 191 passed, 0 failed (lib 43, van07 8, flow 57, fix06 20, ui08 12, ui09 14, fix091 6, fix092 4, van093 7, c2m100 18, confidential scan 1, migration sync 1), run in the cloud copy after all review fixes.
- **Independent review:** ready with fixes: 1 high (a sent-back revision with an added row could not be resent), 3 medium (duplicate rows for a pack, an added distributor row printing a previous price, sent-back items left stuck), lows; all fixed and re-tested (12.4). Second round (Tahir's pre-push rule): a data-safety reviewer and a design and workflow reviewer. Found and fixed: a pack could still get 2 rows on a list through links (now 1 row per pack, replacing the D-73 tolerance); Yawar could change the company GP target with only a notice (now waits for Tahir); the grid let prices be typed on a list whose revision waits; a resent promo price lost its end date; the first click on Send in the resend form did nothing; older sent-back items stayed for good; phone and laptop layout; colour-only states. Both re-checks: confirmed (data safety: safe to ship). Item 9 is for Tahir: the Margin drill no longer shows open POs, FOC and links, and the product page lost Price history, Sales and History, as ruled.
- **For Tahir (ruled, raised by the reviewers):** Margin leaves out a client whose trucks have no approved cost, with no line (D-79); the product page's Price history, Sales and History tabs are gone (D-76). I-45: a list row with no matching C2M pack can never be linked, so that list cannot take an added pack.
- **To confirm (Tahir):** I-39 "above: check" at more than 5 points over target; I-40 which list columns COBO and VGreen are judged on; I-41 whether the VAN brand list margin report (under More) should colour against the product target instead of the ambition GP.
- **Waiting:** I-42 bands wait for budget kg for the 39 products; the 2 re-approval items stay held. I-44 no under- or over-recovery line until Yawar enters the new rate. On live, Yawar confirms the suggested list-row links and links the rest before adding VAN packs to a list.
- **Next:** Tahir pushes 1.0.0; Claude tests live end to end as Yawar and Tahir.

## 19 Oct 2026 (10): 1.0.0 checked live; C2M 1.0.1, Tahir's answers on the open points and reviewer points, built, tested and reviewed, ready for Tahir to push
- **1.0.0 live (pushed by Tahir about 22:09):** checked by Claude as Tahir: new page served; the 5 places and More open with no page or console error; product page 2 tabs; Setup shows the company GP target "needs Tahir". Yawar's view not checked live (Claude cannot sign in as him); checked in the cloud copy.
- **Asked (Tahir, 22:09):** "ask me questions for the decisions needed and reviewer points raised and we resolve them now". Answers: "above: check" stays at 5 points and COBO and VGreen stay on their list columns (D-84); the VAN brand list margin report against each product's target (D-81); a "Not a C2M pack" mark that Yawar sets with no approval (D-80, picture approved); Margin names the clients left out, count and names, no figures (D-83, picture approved); History back on the product page (D-82); the client name already in this note stays; the confidential scan stays as it is.
- **Built (1.0.1):** links route takes {id, noPack}; Client prices, VAN brand prices: Not placed (pick, Save links, Not a C2M pack) and Marked (who, when, Undo, Change prices of marked rows); report: Target % column, each pack against its product's target, portfolio against targets weighted by sales, mark and Undo in the links table and Excel; Margin left-out line; product page History tab; Guide lines for Yawar and Tahir.
- **Independent review (2 agents, run, not only read):** both said "ship with fixes"; all fixed the same evening and re-checked: a marked row could let the same product print twice on a list (now refused when the row names a C2M pack, by name and size or by name alone; an add is refused where a marked row names the pack; Tahir's revision panel lists the marked rows); marked rows' prices could never change (new marked-rows form); stale picks re-linked rows or took marks away; a revision approved at the moment of a mark overwrote it (rows now locked); Margin missed partly costed lines (now named with counts); wording and Guide. Data safety and design re-checks: confirmed. Known limits in 12.3 (a product under another name relies on Tahir's warning).
- **Files (repo):** apps/c2m/c2m.html, c2m-routes.js, c2m-lib.js; docs 01 to 12 (version 1.0.1; 06: D-80 to D-84). No migration, no table or column, no production SQL.
- **Outside the repo (C2M App):** tests/c2m101.test.js (new, W-01 to W-07); tests/c2m100, ui08, ui09, van093, run-all changed.
- **Tests:** TOTAL 198 passed, 0 failed (lib 43, van07 8, flow 57, fix06 20, ui08 12, ui09 14, fix091 6, fix092 4, van093 7, c2m100 18, c2m101 7, confidential scan 1, migration sync 1), cloud copy, after all review fixes. The scan run on the repo copy flags only the client name already in this note (left as Tahir ruled).
- **For Tahir to know:** no VAN product has its own GP target yet, so the VAN brand list margin report now judges every VAN pack at the company GP target instead of the ambition GP: the bar is lower and some amber packs turn green.
- **Next:** Tahir pushes 1.0.1; Claude tests live as Tahir (and Yawar when he opens it).

## 20 Oct 2026 (1): 1.0.1 found live; C2M 1.0.2, product names (D-85) and product out of use (D-86), built, tested and reviewed in 5 rounds, ready for Tahir to push
- **1.0.1 is already live:** commit 7d26062 ("C2M", 19 Oct 23:19) is on GitHub main, pushed before the ruling "Hold 1.0.1, ship together" was made. Checked live 20 Oct as Tahir: docs at 1.0.1, Client prices › VAN brand prices shows 33 rows under Not placed with no buttons for Tahir (as 1.0.1 was built), no page error. So 1.0.2 now ships on its own, on top of 1.0.1.
- **Asked (Tahir), on 1 VAN product shown in C2M and on a price list under 2 names:** "how should we resolve such issues at opening?" Ruled 19 Oct: "1 name everywhere"; Tahir and Yawar both edit; O2S names mapped in C2M until O2S is corrected; renamed rows change at once and print on the next list; the official name is C2M's name today; packs written 1 L, 25 kg. 20 Oct: official names are the trade name only (2 products may share it when pack sizes differ); 1 product with 2 cost sheets: keep the in-house one, take the other out of use with "a button in Setup"; an unsold pack stays for now (no pack switch without a table change); packs under 1 L or 1 kg print 500 ml, 250 g; no rename note on printed lists (KAMs tell dealers).
- **Built:** Setup › Product names (Names to settle: list rows with no pack, O2S names C2M cannot place incl. open orders, linked rows under another name; the table of official names, packs, O2S spellings 1 per line, names printed on the lists, last change; Edit with a check of the O2S trucks and open orders that would move before saving; Take out of use / Put back in use). A link from any screen renames the row to the official name and gives its name back on unlink. Tahir links too; the mark "not a C2M pack" stays Yawar's. Approvals carries "Names to settle". The price list builder warns when a VAN list has rows not settled.
- **Files (repo):** apps/c2m/c2m.html, c2m-routes.js, c2m-lib.js, c2m-engine.js; docs 01 to 12 (version 1.0.2; 06: D-85, D-86); this entry. No migration, no table or column, no production SQL.
- **Outside the repo (C2M App):** tests/c2m102.test.js (new, X-01 to X-17); c2m100, c2m101, van093, ui08, run-all changed.
- **Tests:** TOTAL 215 passed, 0 failed (c2m102 17), cloud copy, after all review fixes; confidential scan passed.
- **Independent reviews:** 5 rounds (a code and data-safety reviewer and a screens and workflow reviewer, then 2 fresh reviewers), run not only read; the last verdict "push but know this", its points then fixed and re-tested; every finding fixed or listed for Tahir in doc 12, 12.4. The 2 people at once cases were run: 1 save and 1 refusal each time.
- **For Tahir:** (1) the KAM printing a half-settled list sees no warning and no list of renames to tell dealers from; (2) O2S gives no kg or L, so the person keeping an O2S name must check the unit (warned on screen); (3) Take out of use is 1 click and a confirm for Tahir and Yawar, no reason asked.
- **After the push (Tahir or Yawar, on the screen, not by SQL):** settle the names in Setup › Product names; clean official names to trade names; take the outsourced cost sheet out of use. Claude checks it live.
- **Next:** Tahir pushes 1.0.2; Claude tests live end to end as Tahir.

## 20 Oct 2026 (2): C2M 1.0.3, 1 master list (D-87) and its review rulings (D-88), built, tested and reviewed in 8 rounds, ready for Tahir to push
- **Asked (Tahir), after mapping list rows one by one:** "VAN has to have one brand list master identity." Ruled 20 Oct: "Full master list only"; master holds "Only products C2M costs"; "C2M carries them over once"; "Master order, same on all lists"; 1 product written 2 ways on the lists: "1 product". Picture "C2M Master Brand List" shown before the build.
- **Ruled after the reviews (D-88):** a pack is taken off a list by "Tahir and Yawar both ... without approval"; the lists print "C2M's spec, editable"; costing words come out of official names ("ask me if not sure"); rows that would leave are "Each one chosen, then visible"; a price moved to another product's pack: "Allowed, the other is told".
- **Built:** Client prices, VAN brand prices: Carry into the master (also from Product names, the margin report, the price list builder and an Approvals panel): 1 screen, picks once per name for every list, C2M's matches shown to check, rows with no pack of their size chosen one by one, 2 rows on 1 pack chosen between, rows leaving listed, stale picks dropped and named, Carry over saves only the plan seen. After it every list prints from the master (official name, C2M's description, pack; products A to Z, packs small to large). Take off a list (1 or more lists, 1 reason, the other told); Off the lists (read only, with prices); Closed at the carry-over (prices of sent-back revisions it closed); description edited in Product names; a price moved in the VAN brand list margin report (the other told). Not placed, the mark, Rename and link and the report's link picks are gone from the screens.
- **Live data, through the screens as Tahir, 20 Oct 2026 (his OK; each checked first: 0 trucks or open orders lose cost; the name before kept as an O2S spelling):** 4 official names changed to the trade name (costing words and a recipe note taken out; 1 product renamed to its powder variant, its granular variant kept); 1 outsourced cost sheet taken out of use (D-86). The 3rd variant of that product is not in C2M yet. Names are in the live change record, not here (public repo).
- **Files (repo):** apps/c2m/c2m.html, c2m-routes.js, c2m-lib.js, c2m-pricelist.js; docs 01 to 12 (version 1.0.3; 06: D-87, D-88); this entry. No migration, no table or column, no production SQL.
- **Outside the repo (C2M App):** tests/c2m103.test.js (new, M-01 to M-15); c2m100, c2m101, c2m102, van093, run-all changed.
- **Tests:** TOTAL 229 passed, 0 failed, cloud copy, after all review fixes; confidential scan passed; a race of a move against a price typed for the same row run 8 times, and of a pack added against a row moved onto it run 15 times: never both saved.
- **Independent reviews:** 8 rounds (round 1: code and data safety, screens and workflow; round 2: 2 fresh reviewers; rounds 3 to 8: 1 fresh reviewer each across code, data safety and screens), run not only read; every finding fixed, ruled by Tahir or listed in doc 12, 12.4.
- **For Tahir:** (1) lists sent after the carry-over come in a new order with new names and descriptions, with no "was" note (D-86: KAMs tell dealers); (2) the carry-over cannot be undone in the app; rows that left stay under Off the lists; (3) before the carry-over, rows with no pack take no new prices: carry over first.
- **After the push (Tahir or Yawar, on the screen):** type descriptions for products that have none (the carry screen names them); then Carry into the master, check C2M's matches, pick the 4 or so names it cannot match, press Carry over twice. Claude checks it live (read only until then).
- **Next:** Tahir pushes 1.0.3; Claude tests live end to end as Tahir (read only).
- **20 Oct 2026 (3):** 1.0.3 pushed by Tahir at 16:51; checked live by Claude as Tahir at about 16:55, read only: the page and the server serve 1.0.3; Approvals shows "Carry the price lists into the master: 89 list rows" and opens in a panel; the carry-over screen reads the plan without saving (89 rows: 21 already linked, 61 matched by C2M, 0 leaving, 3 names to pick; Carry over greyed out until they are picked); the VAN brand grid shows the 1 master list box; Product names shows the description column; no page errors. Nothing carried yet. Next: Tahir or Yawar carries over; Claude checks the printed lists live.

## 21 Oct 2026 (1): feedback on 1.0.3 turned into pictures and rulings D-89 to D-95; nothing built, nothing pushed
- **Asked (Tahir), after the 1.0.3 push:** screens, tabs, tables and Home poor; Tahir lacks full access; the back office poorly designed; the product filter does not show clients; a price list cannot be given to a KAM; roles cannot be added. Then: add the clients FMC and Excel Chemical, add clients from the back office, and variants (Powder, Pellets, Crystal, Granular) with overhead per variant.
- **Done:** pictures drawn inline in the chat only (Tahir: no artifacts, no half split screens): Silver skin Home, Products, Setup, Roles, KAM lists; Add client in 2 kinds; variants with a special pack. Rulings D-89 to D-95 written in doc 06 (6.1 and 6.2). Files touched: apps/c2m/docs/06-decisions.md and this entry. No code, no migration.
- **Facts found in the code (for whoever builds):** no route adds a client, product or pack (I-30); c2m_variant exists and client_product has variant_id, but no code reads or writes them; conversion rules scope by product type, form, reprocessed and pack size, not by variant; a client has 1 group, and white label lists skip clients labelled VAN brand (c2m-routes, wlLists); VAN brand products are costed once under the owner row and distributors are matched by the O2S name; the O2S sync stores the pack as a number and O2S has no variant field, so the variant travels in the brand name (D-95).
- **Open for Tahir:** whether Ahmer Shehzad also creates and edits roles (D-89); a client colour for everyone or per person (D-92); the segment, price rule and regions of FMC and Excel Chemical (D-94); real per client figures for the Margin and Client prices pictures; the Brand Master fonts and colours (folder not connected).
- **Next:** the build plan, in pieces, each declared, tested, reviewed by an independent agent, documented and pushed by Tahir, then checked live. Platform side of Roles (C2M_ROLES in server.js) is a separate PLATFORM piece.
- **21 Oct 2026 (2), Tahir's answers:** Ahmer Shehzad also creates and edits roles (D-89, D-90 changed); a client's colour is the same for everyone (D-92 changed). FMC and Excel Chemical: "single price as white label", and he asked whether both can sit in the white label category while selling VAN brand (see D-94; being settled).
- **21 Oct 2026 (3), Tahir's answers:** FMC and Excel Chemical are "just like other white label clients, every rule, except they sell one of VAN brand"; their white label Humic Grow follows the VAN Humic Grow recipe (one cost sheet). D-94 changed; their segment, price rule and region are no longer open (they follow the white label rules; region is not used for white label). Still open: real per client figures for the Margin and Client prices pictures; Brand Master fonts and colours.

## 21 Oct 2026 (4) Piece 1 of 4 built: Access and Roles (D-89, D-90). Not pushed.
- Module C2M only. New: c2m-access.js, migrations/002_c2m_roles.sql and .PRODUCTION.sql (table c2m_role). Changed: c2m-routes.js (45 guards now can(action); roles routes; notSelf rule; byAdmin on state items), c2m.html (CAN/ADM helpers, Setup, Roles screen, no role-name checks left except Home persona for the 6 starting roles), docs 01, 02, 03, 04, 05, 07, 08, 10, 11, 12.
- Tests (cloud test database, not C2M's own suites, which were unavailable): 270 route by role checks, 0 differences; 40 roles checks; browser check of every role. Independent review found 2 blockers and 8 should-fix points; all fixed except the open items below.
- To do at push: run migration 002 (PRODUCTION version, phpMyAdmin) BEFORE or after the deploy (C2M works either way; the Roles screen saves only after it). Set the version number. Run C2M's own suites c2m100 to c2m103 (not run here).
- Open: none left. (1) Platform piece 1b was done by Ahmer on 21 Oct 2026 and checked live. (2) and (3) ruled by Tahir, D-96.
- Next: piece 2, KAM lists (D-91).

## 21 Oct 2026 (5) Piece 2 of 4 built: KAM lists (D-91, D-97). Not pushed.
- Module C2M only. Changed: c2m-routes.js (isViewerRole; people[].grantee; GET /state?as=; POST /grants/clients and /grants/copy), c2m.html (Setup, KAM lists replaces the old grid; preview bar; in-app Guide for cfo, coo and viewer), docs 01, 02, 03, 05, 06, 07, 08, 11, 12. No migration.
- Tests (cloud test database): 36 route checks, browser run on desktop and phone, 270 route by role checks still 0 differences, 37 roles checks. Independent review: see 12.4.
- To do at push: set the version number. Run C2M's own suites c2m100 to c2m103 (not run here). After the push Claude checks it live.
- Next: piece 3, Add client and variants (D-94, D-95).

## 21 Oct 2026 (6) - Piece 3 of 4: Add client and variants (D-94, D-95, D-98) built on local (MODULE: C2M) - NOT PUSHED

- What: Add client, Add a product with packs (follows a VAN product, who supplies the packing, only for this client), Setup Variants (add, tag), rate by variant, follower cost, group follows products. 13 rulings recorded as D-98.
- Files: apps/c2m/c2m-routes.js, c2m.html, c2m-lib.js, c2m-engine.js, c2m-access.js, migrations/003_c2m_variants_clients.sql and .PRODUCTION.sql, docs 01 to 12.
- Tahir does: run 003 (the PRODUCTION file) in phpMyAdmin BEFORE or at the push (C2M works without it but the new screens say it is needed); set the version number at the push; push.
- Then test on live: see 08 release notes, What to test after.
- Reviewed by an independent agent: 9 defects, all fixed (12.4). Not done: C2M's own suites c2m100 to c2m103 (outside the repo).
- Next: piece 4, the new look (Silver skin, Home, Products client chips; D-92, D-93), picture first.

## 22 Oct 2026 (7) - Piece 3 pushed and live; speed fix; Guide Who does what (MODULE: C2M) - Guide and docs NOT PUSHED

- Done and live: piece 3 (Add client, Add a product, Variants, rate by variant, follows). Ahmer ran migration 003 (variantsReady true). Checked live 22 Oct 2026: Add client, Add a product on 18 client rows, the Variants tab (empty: no variant added yet). The full flow with data (add a Pellets variant to Humi Grow, add products for FMC and Excel, approve a follower's cost, rate by variant, Excel's group reads Both) is NOT yet tested on live: it writes real rows, so Tahir decides who runs it.
- Done and pushed: speed fix in c2m-engine.js (loadAll reads together) and c2m-routes.js (build prefetch). State call about 3 seconds on live, was 3.7 to 6. Tahir ruled to leave it there for now (22 Oct 2026). Further option: send the remaining about 15 waits together, or a 10 second per role cache (a change by someone else could show up to 10 seconds late).
- Not pushed (to push in the morning): c2m.html (Guide: new Who does what part; wider How C2M works) and docs 03 (3.24), 07 (Who does what, read this first), 08, 11 (11.13), 12 (12.5), and this handoff. No migration, no route change. Set the version number at the push.
- After the push Claude checks the Guide live (Who does what shows for each role, own box marked) and then runs the piece 3 data test if Tahir says so.
- Known and not mine: /favicon.ico on the platform is about 1 MB and takes about 3.8 seconds (not C2M). C2M's own suites c2m100 to c2m103 not run (outside the repo).
- Choices to check: Add a product shows on every client row that can take its own brand (the picture showed it on Excel, not on Kashmir). Majid has no Setup, so he adds a variant from a VAN product's page. The rate for a variant is set by Yawar (labour.manage, assumed).
- Next: piece 4, the new look (Home, Products client chips, Silver skin; D-92, D-93), picture first. Later: KAM tick "saving, second click ignored" fix; live test of KAM Copy, Tick all and Clear.

## 22 Oct 2026 (8) Piece 4 of 4, pictures chosen (D-99). Nothing built.
- Module C2M. Drawn inline in the chat (3 layouts each for Home and Products, Silver skin, real client names and counts from live). Tahir chose: Home B (verdict left, jobs right, stacked on a phone); Products B (client list on the left with count and colour, a drop down on a phone). D-99 written in doc 06.
- Still to build: Silver skin with 2 more skins (Slate dusk, Paper) chosen per person; bolder tabs; thin dim table lines with a soft blue, text left, numbers right; top bar first name only; smaller product headings; client colour the same for everyone (D-92, D-93, D-99). Needs a per person skin setting (a small table or the browser; to decide when building).
- Next: Tahir says go ahead; then build, test, independent review, docs and Guide, Tahir pushes, Claude checks live.
- **22 Oct 2026 (8), later:** 4 variants drawn and judged by an independent UX and UI agent; Tahir chose Silver cool and 4 skins per person (D-100). Fixes from the review are part of the build: status always has a word, client colours avoid red, amber and green, the trend label does not cover the line, no repeat of red. Nothing built.

## 22 Oct 2026 (9) Piece 4 of 4 built: the new look (D-92, D-93, D-99, D-100). NOT PUSHED (MODULE: C2M)
- Changed: c2m.html only (4 looks, top bar, Home verdict and jobs, Products client list and To do column, Guide Your look). Docs 03, 06, 07, 08, 12 updated. No database change, no server change.
- Tested on local (all suites pass) and reviewed by an independent agent; its findings are fixed. Not yet checked live.
- Next: Tahir pushes and sets the version; then Claude checks live as COO and as another role, on computer and phone. Open: the look is per browser; Home verdict figures to be read against live Margin.

## 22 Oct 2026 (10) Piece 4 pushed and live; price list review built (D-101 to D-108). NOT PUSHED (MODULE: C2M)
- Piece 4 checked live as COO: look, Home verdict, Products client list all work.
- Built: 1 signature (Yawar), price per pack column, issue month in title, colour key, farmer Pack size, whole rupee prices, Valid until note. Files: c2m-pricelist.js, c2m-routes.js, c2m.html, docs 05, 06, 08, 12.
- Open: Sulfur spelling needs Tahir to approve the 5 specifications and 3 material names; customer name, group and segment cannot be edited anywhere (Edit form only has price rule, cycle, region, O2S names; it is under More, Back office, Customers): to build next, with care for grants held by client name.
- Next: Tahir pushes; Claude checks a white label PDF live.

## 22 Oct 2026 (11) Name on price lists built (D-109). NOT PUSHED. Needs migration 004 (MODULE: C2M)
- Ahmer runs migrations/004_c2m_customer_print_name.PRODUCTION.sql in phpMyAdmin once, after the push. Then Tahir: More, Back office, Customers, Edit, type the name (Arysta Life Science Pvt Ltd (UPL)).
- Files: c2m-routes.js, c2m.html, c2m-pricelist.js, migrations 004 (2 files), docs 04, 05, 06, 07, 08, 12. Open: Sulfur list (D-108); name, group and segment of the client itself still cannot be edited.

(12) 22 Oct 2026, rename a client (D-110): Customers, Edit, Customer name in C2M. Moves KAM grants and issued-document links; printed text of issued documents unchanged. Built, tested locally, not pushed. Open: Group question (Tahir did not understand it; segment edit ruled out); Sulfur spelling (D-108): 5 specifications are edited by Tahir or Yawar at Names, product, description; the 3 material names have no rename screen, so they need a decision. Delete apply6.py.

## Handover to Yawar, 23 Oct 2026 (D-111 to D-116)
- **Built, tested on the local database, not pushed:** the new Margin page (whole company, current month), Products by client with a + New menu, the product page target box, More as a menu, Setup and Back office merged into Setup (4 groups), correct a white label product (rename, out of use, remove a pack), a Guide first day and "I want to..." table, and the fixes of 2 independent audits (doc 12, section 12.10).
- **First-day checklist for Yawar:** (1) Approvals, do "Your next move"; (2) Products, open a client, open a product, press + New to see the 4 jobs; (3) Client prices, type a price, see the GP, Send to Tahir; (4) Margin, read the first line (group and period); (5) Setup, look at the 4 groups; (6) Guide, read "I want to...".
- **Not verified:** nothing is tested on live data; Margin only with synthetic trucks; no real PDF checked; no real first-time user has used it.
- **Still open:** migration 004 (Ahmer) so the print name saves; Sulfur: 5 specifications and 3 material names need Tahir; "Group" is not editable on purpose.
- **After the push:** Tahir says "pushed"; Claude checks each screen live (no real writes).

## 23 Oct 2026 (late) Sulfur spelling, migration 005 (D-118). NOT PUSHED
- Ahmer runs migrations/005_c2m_sulfur_spelling.PRODUCTION.sql once in phpMyAdmin. It corrects 5 descriptions (Max Sulfur, Germinator Pro Sulfur, Nutrivant Urea, Green Sulfur, Vital Urea) and 3 materials (Sulfur 500 Mech, Sulfur Grinded- 200-250 Mesh, Sulfur WDG). Safe to run twice.
- Live check on 23 Oct: migration 004 is in (printNameReady true), but Arysta's print name is still empty. Tahir types it once: Setup, Client details, Arysta, Edit.

## 26 Oct 2026 Yawar's live feedback and Tahir's rulings (NOT BUILT YET)
- MRP printing price list for VAN brand packs, to be added in C2M. Reference: Farmer, Sindh credit price (the highest VAN brand price). Tahir: MRP = Sindh credit price with FED, rounded UP to the next Rs 50 (1,234 prints 1,250); it follows the credit price from the same date, after Tahir approves the credit price; output: a PDF list for packing and the printer, plus a warning on Approvals and Margin when any list price goes above the printed MRP.
- Packing: Yawar likes a separate packing recipe (C2M's packing bill) linked to the product. Cartons: cost per carton / (packs per carton x pack size), e.g. 160 / (4 x 3) per L; C2M's secondary line already works this way (lib.packingPerUnit).
- Plastic inners are bought per kg with 20 to 30 pieces per kg: cost per kg of product = (Rs per kg / pieces per kg) / pack size, e.g. (860 / 29) / 25. Today a packing rate is price per piece only. Tahir: pieces per kg is typed with each purchase rate.
- 26 Oct 2026 review rulings (Tahir): rounds 1 and 2 built together (wrong numbers and false messages; 1 home per job), then the MRP list, then words, tables, forms and Guide. Targets move from Setup into Client prices, sent with prices in 1 send. After a cost re-approval, trucks from the moment of approval take the new cost (earlier trucks that day keep the old cost). Tahir may approve what he proposed, as administrator. A product's own target can be removed through Tahir's approval (back to the company target). Freight tab stays and says how many products use it. Review page: https://claude.ai/artifact/SaDzzyzJjnFTAXXRewy4qj

## 26 Oct 2026 Review rounds 1 and 2 built (D-119 to D-121). NOT PUSHED. No migration.
- Files: c2m.html, c2m-routes.js, c2m-engine.js, c2m-lib.js, c2m-access.js; docs 03, 05, 06, 07, 08, 09, 11, 12; this file. Tests here: runall.sh with fix08.test and fix08ui (live-sized copy) all pass; independent check done and its findings fixed.
- After the push, check live (read only): Setup shows 5 tabs (Costs, Clients, VAN products, Settings, Record and checks); Costs, Packing shows Bought per; More shows Reports and Guide only; Products, + New opens forms on Products; Client prices shows the Target column (change, use company) and the title line; Approvals ends with "End of your list"; Margin figures move only for trucks dated on a cost approval day (now old cost).
- Next: MRP printing list (D-122), then round 4 (words, tables, forms, Guide in full).

- 26 Oct 2026, MRP list design shown (https://claude.ai/artifact/Hq1STX54wd5EhTQ9Ep9LT4), NOT BUILT: Tahir is checking it with Yawar first. Rulings so far: MRP = Sindh credit price with FED rounded up to the next Rs 50; no credit price: the highest farmer price rounded the same way; the worked-out MRP replaces the typed MRP on the Dealer and Distributor lists (a pack with no farmer row keeps its typed MRP and is named); the MRP list uses only the prices in force on its date; warnings when Farmer Punjab, Sindh, Website, Dealer FRP or Dealer net with FED is above the MRP.

## 26 Oct 2026 MRP printing list built (D-122). NOT PUSHED. No migration.
- Files: c2m.html, c2m-routes.js, c2m-lib.js, c2m-pricelist.js; docs 01, 02, 05, 06, 07, 08, 09, 10, 11, 12. Tests: fix09.test and fix09ui (seeded copy van_review4) plus runall.sh, all pass; independent check done and its findings fixed.
- After the push, check live (read only): Client prices, Price lists shows "MRP printing list (packing and printer)" and its preview; Dealer and Distributor lists say Recommended MRP; Approvals and Margin name any list price above its printed MRP; the VAN brand tab has the 2 buttons to change FRP and Recommended MRP.
- A pack only on the Dealer or Distributor list has no printed MRP: Approvals names it (D-123).
- 26 Oct 2026, live check of D-122 after the push: the MRP list works (37 rows, MRP from Sindh credit, no price above MRP). Fixed and NOT PUSHED: blank pack size for Liter, (01 Liter) and 05-kg names; farmer rows checked before the carry-over. Note: live lists are not yet carried into the master (21 of 89 rows linked), so the Dealer and Distributor MRP checks start after Tahir or Yawar carries them (Client prices, VAN brand prices, Carry into the master).
