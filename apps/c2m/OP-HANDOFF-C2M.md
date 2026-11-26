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
- 26 Oct 2026 16:20, live check after the push: pack sizes now read for 34 of 37 farmer rows (Vibrant 4 L, V-Boron Liquid 1 L, ...). 3 farmer list names carry no pack size at all: "Cal-Mag V", "V Germinator Pro", "Nitro Sulfur"; their MRP prints with an empty pack size until the list name has it (or the lists are carried into the master, which writes the official pack). No price above its MRP.

## 26 Oct 2026 Round 4 rulings (Tahir)
- Words: Product (Humi Grow), Variant (Powder, Pellets), Pack (8 kg), Client product (sold to a client under its brand) on every screen.
- Majid gets a read-only Products screen. Packs that never got an approved cost go once onto Approvals as 1 "first cost" item. Tahir's revision panel names the packs a list revision would put above the printed MRP (approval still allowed).
- To build: tables (sort, sticky headers, short phone view), forms (required marks, errors under the field, dates in words), Product Cost tab 1 row per pack, Margin drill-down (approved price, cost parts, link), Change record in plain words with filters, Guide as the "I want to" table (history to release notes), Setup Clients and VAN products 1 table each.

## 26 Oct 2026 Round 4 built (D-124 to D-134) and migration 006 (D-133). NOT PUSHED.
- Files: c2m.html, c2m-routes.js, c2m-access.js; migrations/006_c2m_material_spelling.sql and its PRODUCTION file; docs 01 to 12 (07 rewritten, its history moved to 08). Tests: fix10.test, fix10ui, fix10b added to runall.sh; all pass. Independent review r4: 28 findings, fixed except those listed in D-134.
- Migration 006: run once in phpMyAdmin after the push; its last query should show no rows. It was not checked against live names (Chrome not reachable then).
- After the push, check live (read only): Margin, open a client and a pack: trucks show "Approved when the PO came in" and the cost parts; a VAN brand pack says it is priced on the lists. Setup, Clients and Setup, Products and variants are 1 table each. Setup, Record and checks, Change record reads in words with filters. Guide shows the I want to table. Majid sees Products, to read. Approvals has 1 "Packs with no approved cost" item (logged as C2M).
- Open for Tahir: Majid may tag or clear any product's variant (D-98), which can move cost through a variant rate.
- 26 Oct 2026 18:30, after the push: migrations 005 and 006 run by Ahmer; live check passed (see doc 12). Tahir ruled (D-135): Majid keeps tagging variants; no channel list price in the VAN brand drill-down; no migration 007 (Magnisium Oxide stays; migration line times stay).

## 29 Oct 2026 Reopened O2S lines read as open again (D-136). PUSHED (commit e5611ab, 19:09). No migration.
- MODULE: C2M. One line changed: `apps/c2m/c2m-o2s.js` line 36, `const closed = !!sc.approvedAt && !sc.reopenedAt;`. Before, a line the COO reopened in O2S (new Reopen button) kept its approval date, so C2M kept reading it as short-closed (short_closed 1, open_kg 0). Now it reads as open: open_kg = ordered minus dispatched. Matches O2S `lineShortClosed`.
- Docs changed: 02-data-flows, 04-database-schema, 06-decisions (D-136), 08-release-notes, 10-data-dictionary, 12-tests-issues-assumptions.
- Review: 2 independent reviewers (code, data safety). Both: Push, but know this. No other reader of the flag; no data lost.
- Know this: (1) a reopen reaches C2M only after the next "Pull now" (the pull is the only caller; it writes C2M tables, so it was NOT pressed in the live check). (2) An old reopened line comes back into Margin open orders and the open-quantity impact figures. Tell Yawar and Tahir. (3) C2M open uses dispatched, O2S uses delivered (older difference, not touched).
- Tests: a 9-case check (fails 3 of 9 on the old file, passes 9 of 9 on the new) was run OUTSIDE the repo. The full C2M suite (`npm test` in "C2M App", needs the c2m_test database) is NOT run: it lives on Tahir's PC and was not reachable. Run it there once. The new test is not yet in `C2M App/tests`; a stronger two-sync test (real upsert) exists in scratch and can be placed there when that folder is connected.
- After the first real reopen in O2S: press "Pull now", then check that line on Margin open orders (open_kg back above 0).

## 30 Oct 2026 Yawar's feedback and the Send back fault (D-137 to D-140). NOT PUSHED. Needs migration 007 (MODULE: C2M)
- Tahir's rulings (panel, 30 Oct): Delete only what nothing uses, else Take out of use; clients can be deleted or taken out of use; the Default recipe replaces D-22; another recipe takes the short path (Majid writes, Yawar approves); Yawar alone switches the Default, Tahir gets a notice. Proposal page: https://claude.ai/artifact/4XGAzXDk2oQWidtkFVk56N
- Built: D-137 Send back on a VAN brand list revision opens its reason box (revBox, rev.list). D-138 a Find box on every list ("2 of 59"); variant = the form, a size is a pack, a variant named like a size is stopped. D-139 Edit and Delete on every list, Take out of use and Put back for materials, packing items, packing bills and clients, Edit this product (the Add a product form), delete a draft recipe. D-140 another recipe beside the Default, Make default, approved recipes and their cost on the product page.
- Files: c2m.html, c2m-routes.js, c2m-engine.js, migrations/007_c2m_out_of_use_default_recipe.sql and its PRODUCTION file, docs 01 to 12. No server.js, O2S or platform file touched.
- Migration 007 (3 new tables): run on local van_platform first; production by hand later. Without it C2M works as before; Take out of use, another recipe and Make default say migration 007 is needed.
- Tests (cloud copy of the C2M App kit with today's code, MariaDB 10.11): yw1 17/17, yw2 9/9, no007 passed; the old kit suite 183 passed, 46 failed, 0 crashed, the same failing tests as before the change. yw1, yw2 and no007 are now in C2M App\tests.
- Independent review: 4 serious findings (a product-only rate becoming a rate for every product after a product delete; Edit removing a pack on an open re-approval; a short-path version becoming the Default unchecked; VAN product delete ignoring list revisions) and smaller ones, all fixed and tested (doc 12, 12.11).
- Not confirmed, for Tahir: Make default approves the new pack costs at once (Yawar is the cost approver), so the 3% re-approval does not apply to the switch itself; the proposal page said it did.
- After the push and migration 007: check live, read only: a Find box on Setup lists; Edit and Delete in rows; a product page, Recipe, Approved recipes; Send back on a list revision panel opens its box.

## 30 Oct 2026 (2) Pushed and checked live; update notice at login (D-141). PUSHED (commit d64ccf3, 11:01). No migration (MODULE: C2M)
- D-137 to D-140 pushed by Tahir (commit a4d0593). Live check as Tahir, read only: Find boxes on Setup lists (clients 31, packing items 47, bills 67, rates 8, products 29; "humi" gave 2 of 29); Edit and Delete in rows; the variant line on Products and variants; Delete on a material in a recipe names the recipe and says migration 007 is needed. Migration 007 is NOT run on live yet (m007 false): Take out of use, another recipe and Make default wait for it; check them live after Ahmer runs it.
- D-141 built (Tahir: like O2S; panel: only changes for their job; remembered in the browser): CHANGELOG in c2m.html, a box at login with the updates since the last one seen, lines filtered by the person's actions, links to Guide rows, Got it; the Guide keeps What changed. Files: c2m.html, docs 03, 06, 07, 08, 10, 12. No database change.
- Standing rule: every C2M release adds its CHANGELOG entry in the same change (yw3 W-04 counts entries against release notes on the newest date).
- Tests: yw3 4/4 (new, in C2M App\tests), yw1 17/17, yw2 9/9; old kit suite 182 passed, 47 failed (ui09 V-02 presses Escape while the new box is open: expected). Independent review: 2 defects (keyboard focus, screen behind not inert) and 5 smaller, all fixed.
- After the push: open C2M as Tahir; the box should list 3 updates; Got it; reopen: no box.

## 30 Oct 2026 (3) Where to resume (MODULE: C2M)
- State: D-137 to D-141 are all pushed (a4d0593, d64ccf3); the local folder matches GitHub. Nothing is waiting in the folder.
- Next 1: live check of D-141, read only. Tahir opens C2M: the box lists 3 updates (29 Oct, 30 Oct, 30 Oct notice); press Got it; open C2M again: no box. Then the same as Majid if he can sign in (his box should show only lines for his job).
- Next 2: Ahmer runs migration 007 (migrations/007_c2m_out_of_use_default_recipe.sql on local first, then the .PRODUCTION.sql by hand). Do not press for it. After it runs, check live, read only: m007 true; Take out of use on a material; Keep another recipe; Make default (as Yawar).
- Open question for Tahir: Make default approves the new pack costs at once (the 3% re-approval does not apply to the switch), as the proposal page said. Confirm or change.
- Old note (D-136): after the first real reopen in O2S, press Pull now and check that line on Margin open orders (open quantity back above 0). Tell Yawar old reopened lines will reappear in the open-order and impact figures.
- Known test note: old kit ui09 V-02 fails because the new box is open when it presses Escape. Expected; new tests are yw1, yw2, yw3 and no007 in C2M App\tests.
- Rules: Tahir pushes; migrations local first, production by hand; no server.js, O2S or platform files; live checks read only; no passwords; the price import pack never leaves scratch.

## 29 Oct 2026 — Roles trial: C2M names roles, not people; roles service (MODULE: C2M, branch roles-trial) — NOT PUSHED

A proposal for C2M's owner, built on the platform's roles trial (`docs/ROLES-DESIGN.md` at the repo root, §7A).
1. **Roles service** for the platform's Roles by app screen: `/api/c2m/rolesvc/*` in `c2m-routes.js`, registered before
   `c2mAuth`, System Administrator only; `roles.manage` removed from `c2m-access.js`, so no C2M role designs roles; COO
   keeps `is_admin` (D-89) and shows locked; built-in roles cannot be removed.
2. **Roles instead of names** in every screen text and message (Tahir, 29 Oct): Tahir → the COO, Yawar → the CFO,
   Majid → the Production Manager, Himayat → the QC Head, Fahim → the Plant Manager; "(Tahir, date)" → "(ruling of date)".
   The no-role message now says "Ask your System Administrator to give you one in People and access." Text only:
   code matching stored data (`/^Yawar's Master Cost Sheet/`) and comments unchanged; the printed price list keeps
   "Yawar Hussain". Checked: both files parse; C2M opens with no console error; the Guide shows no names.
Still for C2M's owner: `docs/` 03, 05, 11 still describe roles.manage and name people; the old Roles screen text.

## 30 Oct 2026 — Roles trial caught up with main: Yawar's feedback (D-137 to D-141) merged, said with roles (MODULE: C2M, branch roles-trial) — NOT PUSHED

Main's C2M commits (e5611ab, a4d0593, d64ccf3, aaaa16b) merged into roles-trial. c2m.html had 11 conflicts, all between
main's new screens and the trial's names-to-roles text: each took main's side, then the trial's ruling (29 Oct: C2M names
roles, not people) was applied to main's new lines only, with the same function as before: 19 lines in c2m.html, 6 in
c2m-routes.js, and 5 nested-template lines by hand (e.g. "Majid writes it and Yawar approves its cost" → "The Production
Manager writes it and the CFO approves its cost"; "Tahir is told" → "The COO is told"). Code values follow: the new Guide
filter gjVisible compares 'COO' / 'CFO', like the trial's Guide. The default source of a rate, 'Entered by Yawar', is
'Entered by the CFO' as in the trial's other line. Names left only in code comments. c2m.html script parses; c2m-routes.js
loads; platform c2m-mount 25/25. C2M's own suite (C2M App, c2m_test) not run here. Migration 007 is main's, unchanged.

## 2 Nov 2026 — The COO role is no longer locked on the launcher (D-142) (MODULE: C2M, branch roles-trial) — NOT COMMITTED, NOT PUSHED

Tahir: "remove lock from C2M COO". The COO role (the administrator, D-89) is now ticked like any role on the launcher's Roles
by app. c2m-access.js shape(): an administrator row with no ticks (every COO row today, actions_json []) still holds every
action; once its ticks are saved, the ticks decide. c2m-routes.js roles service: locked false; PUT takes the administrator's
ticks (refuses none ticked); D-89's exemption kept, so it may hold both "save rates" and "do the rate check"; the delta is
measured from its real actions (every action while unticked). Kept: the administrator meaning (others approve only what an
administrator proposed; exempt from ruling 19), and it cannot be removed. Not changed: C2M's own Roles screen (unreachable
since roles.manage left the catalogue on 28 Oct). An action added to C2M later is not given to the COO by itself.
Docs: 06-decisions D-142; 11-access 11.11 Administrator row. Checked on the trial server (roles_trial), the COO row put back
exactly afterwards: not locked, 48 of 48 ticked, C2M gives Tahir 48; untick 1 = 47 in C2M; both rate rights allowed; no tick
refused; cannot be removed. Roles-service check for C2M all passed; platform c2m-mount 25/25, notify-mount 15/15,
pd-removed 17/17. C2M's own suite (C2M App) not run here. Trial server on port 3003 restarted on this code.

## 4 Nov 2026 — Back to the launcher at every width, own tab icon, top bar fits (D-143) (MODULE: C2M) — NOT PUSHED

From the 3 Nov read-only audit (artifact "C2M and Roles Audit"). Tahir: "go ahead". Files: apps/c2m/c2m.html (head icon link; the foot
template: the launcher link left the role label, with 3 forms lw/ls/li; CSS in the phone block, the 761 px block, a new 761 to 1400 px
rule, the 761 to 1100 px block and a new top bar fit block; CHANGELOG 2026-11-04a), docs 06 (D-143) and 08. No server, database or other
app change. Checked in Playwright with a stand-in state at 1920, 1440, 1400, 1366, 1300, 1280, 1250, 1200, 1150, 1101, 1100, 1024, 960, 900,
860, 820, 800, 780, 761, 390 and 360 px: link visible at each, no tab cut off or drawn over another (smallest gap 29 px at 761 px), no page
error, script parses. C2M's own suite (C2M App, c2m_test) not run here: it is on Tahir's PC; if a test pins `launch-w`, it needs the new
class names. After the push: open C2M live at full width and at a narrower window, press the launcher link, and see no /favicon.ico request.
Same day, on Tahir's ruling (3 Nov panel), O2S role Supply Chain Officer: Lab screen Edit to View, through the platform roles service
(PUT /api/o2s/rolesvc/roles/Supply Chain Officer, logged); nothing else on the role changed.

## 4 Nov 2026 (2) — Add a material class (D-144) (MODULE: C2M) — NOT PUSHED

Tahir asked how to add a class so Amino Acid can carry an amino acid %; ruled by panel: build an Add class form, CFO only.
Files: c2m-lib.js (newMaterialClass), c2m-routes.js (POST /api/c2m/material-types, can material.save), c2m.html (classForm under
"Add a material or a new grade", its handlers, Guide row, CHANGELOG 2026-11-04b), docs 05, 06 (D-144), 07, 08, 11. No migration.
Tested: the rule alone (10 cases: spaces, missing %, n% → N%, duplicates, 1N%, |, no field, 11 fields, unknown role, non-nutrient);
the route mounted on express with a stand-in database (CFO adds 200, same name in other letters 400, non-nutrient 200, short name
400, Production Manager 403, QC Head 403, COO 200); the page in Playwright as the CFO (form shows, non-nutrient hides the fields,
Add class posts, toast, the new class appears in the Class list, form clears, no page error). Not run: C2M's own suite on Tahir's PC.
After the push: as the CFO add "Amino acid source" (N%, Amino acid%, OM%); the QC Head moves Amino Acid to it and enters its %.
Seen live 4 Nov, not changed: 2 class names say "sulphur" (Calcium and sulphur source, Sulphur source), against the "Sulfur" ruling (D-118).

## 4 Nov 2026 (3) — Daily O2S pull, POs checked by their time, freight date, audit fixes (D-145) (MODULE: C2M) — NOT PUSHED

Tahir ruled by panel (4 Nov): pull daily; PO checked by its time; freight date fix only. The rest are the 3 Nov audit fixes.
Files: c2m-routes.js (pullOnce, daily pull with autoPullDue/autoPull and timers, roles read once, dismiss in tx, freight re-approval,
margin settings for see.margin roles, entered_at and rcvAt in the state, /c2m no-cache, old roles routes removed, rolesvc note), c2m-lib.js
(needsReapproval default 3, targetOr 0 = none, priceCountsForPo), c2m-engine.js (freightFor dated today or earlier; exported for tests),
c2m-o2s.js (entered_at, enteredPk), c2m.html (once() busy guard, saved-but-not-refreshed message, first load slow line and Retry,
stuck label in working days, priceOn by PO time, Client prices header GP, Roles screen removed, Sign out, Guide texts, CHANGELOG
2026-11-04c), migrations 008 (+ PRODUCTION), docs 01, 03, 04, 05, 06 (D-145), 07, 08, 09, 11, 12.
Migration 008: run locally first, then production by hand. The code works before it: the pull checks the column (SHOW COLUMNS) and
skips it; PO checks then treat every PO as having no entry time.
Tests: see doc 12 section 12.13. Not run: C2M App suite on Tahir's PC; a real database.
After the push: watch the server log the next morning for "[c2m] daily pull"; Setup, From O2S shows the pull by c2m-auto; after 008,
the next pull fills entered_at.

### 4 Nov 2026 (3) — independent review of the D-145 batch, fixed (MODULE: C2M) — NOT PUSHED
- PO entry time: the earliest "Created PO <po>" line in O2S's action log; printDecisionAt only as the fallback (O2S moves it when a print
  decision is corrected). entered_at is written inside the PO line upsert (no extra UPDATE per line); a failed column check is logged.
- priceOn: the day-before fallback applies the same entry-time rule (a back-dated price approved on the PO's day after entry never counts).
- Freight dated ahead: freightDueSweep runs with the 15-minute timer, looks back 7 days, checks re-approval once per rate on its start day
  (marker c2m_audit entity freight_due); a rate saved on or after its date was checked at the save. reapprovalFor passes its loadAll to the
  filter (extra argument, no effect on other callers). The freight notice names the saver's role, not "the CFO".
- A send whose refresh fails says "Sent. The screen could not refresh" (VAN brand list send, client price send).
- Docs 03, 05, 11 mark the removed Roles routes and screen; engine export of freightFor listed once.
- Tested: the pull with and without the column (entry time from the action log 09:00Z → 14:00 Pakistan time; fallback 20:00Z → next day
  01:00); the freight sweep (due rate checked once, rate saved after its date skipped, second pass does nothing); the earlier route, page
  and top-bar tests again; script parses, routes load.



## 4 Nov 2026 (4) — VAN brand PO price check (D-146) (MODULE: C2M) — NOT PUSHED

Tahir ruled by panels and comments on the VAN Brand PO Price Check page (4 Nov) and said "Yes, build it".
Each VAN brand PO line from 11 Oct is compared with the list in force on its PO date and marked (at list within 1%, above, below,
not on its list, cost only, not checked). Distributor and Punjab dealer: distributor list; Sindh dealer: dealer net; COBO: farmer
Sindh cash; VGreen: farmer Punjab; farmer: farmer list by region, Sindh cash or credit by payment terms. Never blocks; Margin unchanged.
Files: c2m-pricecheck.js (new, pure), c2m-o2s.js (orderRegion; region written at the pull when 009 is in), c2m-routes.js (listCheck in
the state for see.margin + see.price), c2m.html (report "VAN brand PO against its price list", line on Approvals, Excel, Guide row,
CHANGELOG 2026-11-04d), migrations 009 (+ PRODUCTION), docs 01, 02, 03, 04, 05, 06 (D-146), 07, 08, 09 (F-32, B-36), 10, 11, 12 (12.14).
Migration 009: local first, then production by hand (Ahmer, with 008 if 008 is not run yet). The code works before it: dealers take the
region from C2M's customer record; farmer POs show "region not known".
Tests: doc 12 section 12.14 (63 pure, 17 route, Playwright as the CFO at 1366 and 390). Independent review: 8 findings, all fixed but
the FED % date (I-38). Open: I-46 (dealer or farmer outside Punjab and Sindh; Sindh farmer with no terms), A-25 (FED None) for Tahir.
After the push and 009: Pull now, open More, Reports, VAN brand PO against its price list, and check against the 3 Nov counts on the page.

Same day, after the build: Tahir ruled by panel "Others as Punjab" (dealer or farmer outside Punjab and Sindh checked as Punjab; Sindh farmer
with no terms on Sindh cash) and "Yes, as entered" (FED None compared as entered). Built; I-46 closed, A-25 confirmed; 64 pure tests pass.


## 5 Nov 2026 (1) — Push 1 of the cost redesign: 7 faults fixed (D-147) (MODULE: C2M) — NOT PUSHED

Tahir and Yawar ruled the whole cost and pricing redesign by panel on 5 Nov (R1 to R32, on the C2M Cost Jobs Review page):
client first (White Label, VAN Brands), top bar Approvals, Clients, Margin, Costs, More; Costs as a 6-box configuration centre; named
Labour and FOH Low/High rates per product; weekly Monday cost cycle; month end with absorption on kg made and a lock; Reports with downloads.
Build order: 1 faults (this), 2 Costs centre, 3 Clients, 4 Month end, 5 Reports, 6 words, Guide, Find, phone. Pictures first from push 2.
Push 1 files: c2m.html (material, packing, rule, freight edit read fields before saving; settings and actuals refuse empty; CHANGELOG
2026-11-05a), c2m-routes.js (settings and actuals strictNum; freight region spelling, uses check in force today, freight_case sweep;
same-products labour/FOH refused), c2m-engine.js (freightFor region match), c2m-lib.js (sameRegion), docs 06 (D-147), 08, 09, 12 (12.15).
No migration. Tests: 12.15. After the push: Setup, Costs, Freight should show no change unless a region was saved in other capitals.

## 5 Nov 2026 (2) — Push 2a of the cost redesign: Costs has its own place (D-148) (MODULE: C2M) — NOT PUSHED

Push 1 (D-147) and the price check (D-146) were pushed by Tahir on 5 Nov (commits 6dc6263 and 1f92a10); docs 06 and 08 updated.
Push 2a, from the Costs Centre picture and Tahir's and Yawar's comments on it ("Its fine as it is"; Open only on the boxes):
- c2m-access.js: see.margin roles: top bar Approvals, Products, Client prices, Margin, Costs; More: Setup, Reports, Guide. Phone bar keeps
  the first 4; Costs is under More on the phone.
- c2m-routes.js: dryable() on packing/rate, packing/bill, packing/assign, rules/conversion, rules/conversion/:id/replace, freight. ?dry=1 runs
  the save in 1 transaction and rolls it back; q() lists every c2m_reapproval insert instead of writing it; refused (503) with no pool.
  Messages say "Costs, Packing cost" etc.
- c2m.html: vCosts (6 boxes, Open, crumb), effectFirst (first Save shows the effect; Save again counts only while it is on screen and after
  1 second), Saved box on Costs, material History (data-mhist), Change cost, Labour and FOH apart, finder entries, network error wording,
  CHANGELOG 2026-11-05b, Guide rows.
- Docs 01 (1.27), 02 (2.25), 03 (3.29), 05, 06 (D-148), 07, 08, 09 (B-39), 10, 11 (11.14), 12 (12.16). No migration.
Tests: 12.16 (routes 14 + 5, page 41, old page tests moved to Costs, earlier suites pass). Independent review: 1 blocker (packing price effect
always empty) and 11 smaller findings, all fixed and listed in 12.16.
Known, not this push: phone width overflow on Price lists and Setup, Settings, KAM lists (before this push too; push 6). Assign a bill has no
effect step (push 2c).
Next: Tahir pushes; check live: Costs in the top bar, change a labour rate (first Save shows the effect). Then 2b (weekly Monday cycle,
urgent change with COO approval, Undo = edit within 1 hour), then 2c (Low and High labour and FOH, first assignment free).

## 5 Nov 2026 (3) — Push 2b: Monday is cost day (D-149) (MODULE: C2M) — NOT PUSHED

Push 2a (D-148) pushed by Tahir on 5 Nov (commit 02900da), checked live: Costs in the top bar, 6 boxes with real figures (5 packs
with no packing bill; no freight rate in C2M yet).
Tahir and Yawar ruled R11 again that evening: Monday is cost day (a change saved on Monday goes in that day; Tuesday to Sunday it
waits for Monday 00:00); the 1-hour correction covers both the Saved box and urgent changes in force; a first cost goes in at once;
a packing bill change waits for Monday.
Files: migrations/010_c2m_cost_pending.sql and .PRODUCTION.sql (new table c2m_cost_pending); c2m-routes.js (weekly(), DESCRIBE,
correctable(), applyPending(), applyDue() on the 15-minute timer and on state load, routes costs/pending/:id/drop|approve|later,
state weekly and pending; the import queue rate correction goes through the cycle); c2m.html (form line with Urgent and reason,
"Save ... for Monday", Next week's costs, waiting figure under today's in lists, Correct with minutes left, Approvals line for
Tahir, CHANGELOG 2026-11-05c, Guide rows); docs 01 (1.28), 02 (2.26), 03 (3.30), 04 (4.14), 05, 06 (D-149, D-148 marked pushed),
07, 08, 09 (B-40, B-41), 10 (10.15), 11 (11.15), 12 (12.17).
Migration 010: run locally first, then production by hand (Ahmer). Until it runs, every change goes in when saved, as before.
Tests: 12.17. Independent review: no blocker; 6 wrong results and 9 small points fixed (listed in 12.17).
Open for Tahir (push 2c): a new packing bill goes in at once and Assign is not in the weekly cycle, so a bill change could be
made as a new bill and assigned. Not in 2b: Rs on open POs and prices below target in the packing and freight effect.
Next: Tahir pushes, runs 010 locally; Ahmer runs 010 on production. Then push 2c (Labour and FOH Low and High, monthly certificate,
first assignment free), picture first.

## 5 Nov 2026 (4) — Push 2c: Labour and FOH, Low and High (D-150) (MODULE: C2M) — NOT PUSHED

Push 2b (D-149) pushed by Tahir on 5 Nov (commit d3e8e85), checked live (migration 010 not yet on production: saves go in as before).
Rulings (panel, 5 Nov evening): switch from today, rates "not filled" until Yawar fills them; each client product picks; after
the independent review: in force from the day saved (not back-dated), first figure and first move free only until 30 Nov 2026,
and when all rates are filled each pack's cost that day becomes its approved cost (no re-approval). Bill packs wait for Monday (2d).
Files: migrations/011_c2m_labour_foh_low_high.sql and .PRODUCTION.sql (c2m_lf_rate, c2m_lf_pick, 4 rows not filled);
c2m-engine.js (lfIndex, lfPickOf, lfRateOf, conversionOf; packCost uses it); c2m-routes.js (POST /lf/rate, /lf/pick, lfBaseline,
lf_cert in /checks, state lf, old rule routes refuse after 011, wording); c2m.html (vLF, certificate box, boxes, Approvals lines,
Setup products column, CHANGELOG 2026-11-05d, Guide rows); docs 01 (1.29), 02 (2.27), 03 (3.31), 04 (4.15), 05, 06 (D-150; D-149
marked pushed), 07, 08, 09 (F-33, B-42 to B-44), 10 (10.16), 11 (11.16), 12 (12.18).
Migration 011: the switch happens when it runs. Keep the time between 011 and Yawar filling the 4 figures short: in between, packs
have no labour or FOH cost and other cost changes make no re-approval.
Tests: 12.18. Independent review: no blocker; 3 points ruled, the rest fixed (12.18). Known: the Margin bridge Method bar moves.
Next: Tahir pushes; runs 010 and 011 locally; Ahmer runs 010 and 011 on production; Yawar fills the 4 figures at once. Then push 2d
(freight region list; packing bill picks its packs, moves wait for Monday), picture already approved (screen 6).

## 5 Nov 2026 (5) — Push 2d: packing bills pick their packs; freight region list (D-151) (MODULE: C2M) — NOT PUSHED

Push 2c (D-150) pushed by Tahir on 5 Nov (commit 4e2ccaf), checked live (migrations 010 and 011 not yet on production).
Files: c2m-routes.js (save_packing_bill takes packIds, DESCRIBE packing_bill and packing_assign, Assign in the weekly cycle,
product Edit refuses a bill move Tuesday to Sunday, freight region must be listed); c2m.html (Packs on this bill, Find a pack,
region list, Assign note, CHANGELOG 2026-11-05e, Guide rows); docs 01 (1.30), 02 (2.28), 03 (3.32), 05, 06 (D-151; D-150 marked
pushed), 07, 08, 09 (B-45, F-31), 12 (12.19). No migration.
Tests: 12.19 (route 17, page 12; earlier suites pass). Independent review: 1 blocker and 14 points, all fixed.
Push 2 (Costs centre) is complete with this. Next per R31: push 3, Clients place (White Label and VAN Brands; VAN price lists with
their own margin and freight), picture first.


## 5 Nov 2026 (6) - push 3a: Clients place, brand page, Monday price cycle (D-152), MODULE: C2M
Module: C2M. Not pushed (Tahir pushes). No migration. Push 2d was pushed as c1fb8d1 ("push 4 c2m"); D-151 marked pushed.
Picture: C2M Clients Place artifact (R33 to R38 ruled that evening). Tahir after the first build: no landing page; Clients opens on White Label with a switch to VAN Brands.
Files: apps/c2m/c2m.html, c2m-routes.js, c2m-access.js; docs 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12.
- Top bar for see.margin: Approvals, Clients, Margin, Costs; More: Products, Setup, Reports, Guide. Every old way into Client prices lands in Clients.
- White Label: the client price table; a brand opens the brand page (recipe, cost by pack, Existing/Current/Projected with GP, margin FY to date, open POs, New price). VAN Brands: Products, Prices by list, Price lists.
- R33: client prices and list revisions take effect on a Monday; Monday passed while waiting = next Monday; urgent (audit row action urgent, reason) = the approval day.
Tests: 12.20 (route 18, page 36; earlier suites pass). Independent review: 1 blocker and 10 points; fixed except 2 left for 3b and Tahir's note (12.20).
Next: push 3b, VAN Brands with the 5 list cards, list target margin and freight (R34, R35), 1 migration. Then push 4 (Month end, with R37 VAN sales freight).


## 6 Nov 2026 (1) - push 3b: VAN price lists with target and freight (D-153), MODULE: C2M
Module: C2M. Not pushed (Tahir pushes). No migration: list target and freight are company settings (lt_ and lf_ keys), rows made on first approval. Push 3a was pushed as 2779501 and checked live.
Picture: C2M VAN Price Lists artifact (R39 to R42 ruled that night).
Files: apps/c2m/c2m.html, c2m-routes.js; docs 01, 02, 03, 05, 06, 07, 08, 09, 10, 11, 12.
- VAN Brands: Products and Price lists. 5 cards; a list page with cost, freight, list price, GP after freight, price for target (rounded up), New price (sends that list's revision, Monday cycle). Change target or freight with its effect and why; Tahir approves.
Tests: 12.21. Independent review: no blocker; all points fixed (12.21).
Next: push 4, Month end (absorbed on kg made, certificate, COO check, lock; R37 VAN sales freight by list).


## 6 Nov 2026 (2) - push 4: Month end (D-154), MODULE: C2M
Module: C2M. Not pushed. Push 3b delivered to Tahir's folder 6 Nov (14 files, not yet pushed when push 4 was built; push 4 is built on top of it).
Picture: C2M Month End artifact (R43 to R46 ruled).
Files: apps/c2m/c2m.html, c2m-routes.js, c2m-o2s.js, migrations/012_c2m_o2s_production(.PRODUCTION).sql; docs 01 to 06, 08 to 12.
- Costs › Month end in 5 steps; kg made from O2S production; COO check; lock and reopen; Margin list freight, company line, locked month.
Needs migration 012 (Ahmer), after 010 and 011.
Also c2m-engine.js: conversionOf takes the old rates on a day before the first Low and High rate (review 4, blocker).
Tests: 12.22. Independent review: 1 blocker and 15 points, all fixed except 3 left for push 5 (12.22).
Not yet delivered: Tahir's computer was not reachable at the end.
Next: push 5, Reports (R28, R30).


## 6 Nov 2026 (3) - fix 4b: Month end stock kg found through O2S (D-155), MODULE: C2M
Module: C2M. Not pushed (Tahir pushes). Push 4 was pushed as 38ae60b; Ahmer ran migrations 010 to 012 on production that afternoon; Tahir pressed Pull now. Live: kg made matched O2S's production log month by month (October 407,219 kg), but 375,349 kg of October stock showed as "base not known".
Cause: absorbedFor looked O2S base names up among C2M's production lines. Fix: c2m-o2s.js baseBrandsOf / o2sBaseBrands (O2S's masters.products, read only, 10 minute cache, refreshed on pull); a C2M product is on a base by its O2S name, or its own name for a VAN brand product. No map: Month end says so and the lock is refused; the lock keeps notChargedKg.
Also: the in-app CHANGELOG was out of date order (latest taken as 2026-11-05e), so it was sorted, newest last; new entry 2026-11-06b.
Files: apps/c2m/c2m-o2s.js, c2m-routes.js, c2m.html; docs 02, 03, 06, 08, 09, 10, 12.
Tests: t12 (15), new t14 (9), t3 to t13 and no-011, p9 to p11, pricecheck 64: all passed. Independent review: no blocker, 1 Major and 5 Minor, all fixed.
Next: after the push, check October on live Month end (stock charged; only Liquid Bio Stimulant not known). Then push 5, Reports (R28, R30), picture first.


## 6 Nov 2026 (4) - R47: October charged from its 1st day; fix 4c (D-156), MODULE: C2M
Module: C2M. Not pushed. Fix 4b pushed (980deb1) and checked live: October stock charged, nothing "not known"; 203,519 kg (1 to 12 Oct) not charged as the old rates start 13 Oct. Tahir ruled (panel): charge at the 13 Oct rates.
Files: apps/c2m/c2m-routes.js (absorbedFor: rateDay, earlyKg, firstRateDay; split before Low and High at the lowest product rate), c2m.html (Month end line; CHANGELOG 2026-11-06c); docs 03, 06, 08, 09, 12.
Tests: new t15 (4; 3 fail on the old code), t3 to t14, no-011, p9 to p11 passed.
Next: after the push, check October live (kg not charged 0). Then push 5, Reports, picture first.

## 6 Nov 2026 (5) - push 5a: Reports (D-157), MODULE: C2M
Module: C2M. Not pushed (Tahir pushes). No migration.
Picture: C2M Reports artifact, version 3 (screens 1 to 6 and 8; R28, R30, R48 to R51).
Files: apps/c2m/c2m.html, c2m-routes.js; docs 01, 02, 03, 05, 06, 07, 08, 09, 10, 11, 12.
- 1 tool bar on all 7 reports: From and Till (opens on this month), quick dates, Columns, ticks, Excel, CSV, PDF (print box).
- New: Cost history, Price history (client prices, VAN lists), Margin by client and brand. Routes GET /api/c2m/reports/costs and /prices (see.margin).
- List freight: VAN brand list margin after each list's freight on its own target; open VAN brand PO rows (state); Margin drill part.
Tests: new t16 (19) and p12 (65); t3 to t15, no-011, p9 to p11, pricecheck 64: all passed (12, D-157).
Open for Tahir: VAN brand target in the new margin report is the ambition GP (Margin uses each product's target); VAN list history start for a revised list is 11 Oct.
Next: push 5b, Your own report and saved reports (migration 013), with the Adjust button.

Independent review 5a: no Blocking; 2 Major and 5 Minor fixed (CSV formula guard with -, GP at start on a later cost marked, change note corrected, below cost always red, list history Till, escaping); see docs 12. Open for Tahir: VAN brand target in Margin by client and brand (ambition) differs from Margin (product target).
R55 (Tahir, same evening): each VAN brand sale judged against its own price list's target (saleTgt in nmSum), on Margin and the new report alike; no list or no list target = not judged. Replaces the ambition GP.
Review of R55: 1 Blocking, 1 Major, 6 Minor, all fixed (direction from GP on judged sales; list margin portfolio on list targets; export, chip, answer, help text, sort, below-cost warning). See docs 12.

## 6 Nov 2026 (6) - push 5b: Your own report and saved reports (D-158), MODULE: C2M
Module: C2M. Not pushed (Tahir pushes). Needs migration 013 (Ahmer, after 012): 013_c2m_saved_report.sql and its PRODUCTION copy. Local first was not possible in this build (no database here); it is written and tested in the harness (stubbed table, before and after it exists). Until it runs, Your own report works without Save and says why.
Picture: C2M Reports artifact, version 3 (screen 7, the data you can pick, R52 to R54).
Files: apps/c2m/c2m.html, c2m-routes.js, migrations/013_c2m_saved_report(.PRODUCTION).sql; docs 01 to 12.
- Your own report first on Reports: Data (7 sets: Sales, Open POs, Pack cost, Client prices, VAN list prices, Rates, Kg made), Period, Columns (add, ‹ ›, ✕), Filters, Each row or Totals by group; through the 5a tool bar. GP % on totals = GP ÷ sales. Sales equals Margin; Kg made equals Month end.
- Routes: GET /api/c2m/reports/rates and /made; saved list (also in state), save, rename, delete (own only; see.margin; audited).
- Adjust on Cost history, Price history, Margin by client and brand, GP bridge; off with the reason on the other 3. CHANGELOG 2026-11-06e.
Tests: new t17 (55) and p13 (75); t3 to t16, no-011, p9 to p12, pricecheck 64: all passed (docs 12, D-158).
Next: push 6 (words, Guide, Find and phone).
Independent review 5b: no Blocking or Major; 5 Minor fixed or stated (Kg made rounding note, filter option values, saved name case, raw material rates need see.materials, Kg made per month, 50 saved reports a person). See docs 12.

## 7 Nov 2026 (1) - push 6a: words, farmer list lines (D-159), MODULE: C2M
Module: C2M. Not pushed (Tahir pushes). No migration. Picture: C2M Push 6 plan, section Push 6a and the rulings at its foot (R56, R59).
Files: apps/c2m/c2m.html, c2m-routes.js, c2m-lib.js, c2m-pricecheck.js, c2m-o2s.js; docs 01, 02, 03, 06, 07, 08, 09, 10, 12.
- R26 words on every screen and server message: client and client line; From and Till; Take out of use, Out of use; Labour and FOH, Sync setting, Price setting; no D-nn, ruling or version numbers; "not switched on yet: IT has 1 step to run" in place of migration numbers. Audit word scan: 141 lines before, 8 after (2 hidden Find words, 6 the QC and Production place still named Inputs).
- Next steps in messages: 42 "not found" server messages, "Nothing changed", the 500 answer. Rupees with thousands commas (rs2, lib.fmtRs2, raw Rs templates).
- R56: farmer sales under Farmer list, Punjab, Sindh cash, Sindh credit, each with its GP and its list's target; any unknown channel is Other sales. R59: a farmer with no region is on the Farmer list, Punjab (lkeyDefault; dflt in the price check); Margin and the price check count them. Dealers with no region unchanged.
- CHANGELOG 2026-11-07a.
Tests: new t18 (23) and p14 (18); t3 to t17, no-011, p9 to p13, pricecheck 64: all passed (assertions changed for the new words are listed in docs 12).
Next: push 6b (Guide rows with steps and Start; Find anything), then 6c (phone and Back).
Independent review 6a: no Blocking; 2 Major fixed (Punjab default only once regions are read from O2S; price check client line from the list itself) and Minor (migration number in the change record filter, docs). See docs 12. Before go-live check that migration 009 is on production and Pull now has run (a PO line carries a region).

## 7 Nov 2026 (2) - push 6b: Guide jobs with steps and Start, Find anything (D-160), MODULE: C2M
Module: C2M. Not pushed (Tahir pushes). No migration. Picture: C2M Push 6 plan, section Push 6b and the rulings at its foot (R25, R57, R24).
Files: apps/c2m/c2m.html; docs 01, 02, 03, 06, 07, 08, 11, 12.
- 1 map of where each job opens (GOTO, keys "kind:value"; finderGo the only router, clearing what the top bar clears). The Guide's Start and Find anything both use it; canGo() keeps every row and result to places the person can open.
- Guide (R25, R57): 1 row per job for every role, with who, 3 to 6 numbered steps (bold = the place or button as on screen), what happens next, and Start (40 px). Rows closed until tapped; answer line "Your jobs: N". COO 36, CFO 55, Production Manager 10, QC Head 6, Plant Manager 5, KAM 4. GUIDE_JOBS and docs/07 are equal row for row (74). Fixed: More, Setup rows; Keep another recipe through More, Products, + New; Bought per, Kg; Read a report names Your own report. New jobs: packs not costed, costed with no price, items from your sheets, price or list revision sent back, VAN pack with no printed MRP, recipe stuck (COO), approve cost of a product that follows another's recipe, Find anything.
- Find anything (R24): clients from the client list (no sales too) on Clients, Margin second; VAN brand products on Clients, VAN Brands, Products (filtered); the 5 price lists, Make a price list PDF (MRP, PDF), All 5 side by side; KAM lists, settings, change record, sheet items, month end and lock, re-approvals, Your own report, the Guide's jobs; no report coming later; Bag 25 opens Packing cost filtered. Fixed: Find's Reports reopened the last report.
- A list filter set by Start or Find is cleared on the next top-bar place. CHANGELOG 2026-11-07b.
Tests: new p15 (112); t3 to t18, no-011, pricecheck 64, p9 to p14: all passed, no assertion changed (docs 12, D-160).
Open for Tahir: the QC Head's place is still named Inputs; VAN Brands has no product page of its own (Find opens the filtered Products list); a white label client with no product opens on More, Setup, Clients.
Next: push 6c (phone tap sizes and Back, R21, R58).
Independent review 6b: no Blocking; 3 Major and 3 Minor fixed (M1 an Approvals filter from Start or Find is set only when a line matches, with "Showing only …: N other items hidden" and Show all; M2 Find anything 9.6 s to under 10 ms a key at 150 clients and 40,000 sales lines; M3 Guide rows need the job's right, built-in counts unchanged, COO 36, CFO 55, Production 10, QC 6, Plant 5, KAM 4; m1 no dead off-list button; m2 Margin and materials searches set by Find cleared by the top bar; m3 12 Guide rows' step 1 matches where Start lands). Not pushed. See docs 12.

## 7 Nov 2026 (3) - push 6c: phone tap targets, Back, 2 tab styles (D-161), MODULE: C2M
Module: C2M. Not pushed (Tahir pushes). No migration. Picture: C2M Push 6 plan, section Push 6c and the rulings at its foot (R21, R58; R26 words stay).
Files: apps/c2m/c2m.html; docs 01, 03, 06, 08, 12. Doc 07 and GUIDE_JOBS unchanged (no word or place changed).
- R21 tap targets: on a phone (760 px or less) every control on a page or in a panel is at least 40 px (re-approve ticks: the whole line; target pencil 40 x 40; Open to approve, Open recipe, New price, chips, Costs back links, With others fold, Find boxes, path links). COO and CFO at 390 x 844 on Approvals (items opened), Clients and brand pages: 265 and 272 under 40 px before, 0 and 0 after. All screens 2,557 and 2,564 before, 319 and 319 after (laptop work left). Sideways scroll 0 before and after. Laptop look unchanged.
- Back: render() is renderPage() then navSync(); 1 history step per move (place, tab, client, brand, report, panel, Find, More); filters, chips and typing are not steps. Back 1 step; a panel, Find or More closes first; Close by its own button leaves no extra step. Typed text not saved: Back asks "Leave without saving?" on the page (Stay, Leave). Address #kind:value (GOTO keys) opens the place on a reload if canGo, else Approvals.
- R58: 1 tab style, the underlined row (.subnav, role tablist, tabs aria-selected, arrow keys) for White Label and VAN Brands, Products and Price lists, Setup and its parts (were chips), product page, Inputs, Prices, Price history, Chart and Table, a KAM's lists (were chips), System documentation (were chips). Chips filter only (aria-pressed); the client and Show chips lost their own look (clientchips). otabs, tabs3, clsw seg CSS removed. The folder tabs of D-59 are replaced: Tahir to confirm, or ask for the folder look back (1 CSS change).
- CHANGELOG 2026-11-07c (all roles), last entry.
Tests: new p16 (93); p9 (6 lines) and p10 (1 line) read aria-selected and the new tab row; t3 to t18, no-011, pricecheck 64, p9 to p16: all passed (docs 12, D-161).
This ends the R31 build order (pushes 1 to 6). Next round: the Himayat and Majid workflow review (recipes, raw materials and nutrient %, nutrient types such as amino acid; the approval, rejection and amendment paths).
Independent review 6c: 1 Blocking, 1 Major, 5 Minor, all fixed (B1 Back stuck after a deleted item: a Back or Forward drawing fixes its step in place, never pushes; M1 Back checks rights and ends a KAM preview; m1 only a real save clears the typed record; m2 steps keep their number over a reload and open from their address; m3 #vtab only its 4 parts; m4 #brand of a VAN brand product opens VAN Brands, Products; m5 What changed 2026-11-07c split by role); Tahir confirmed underline tabs. See docs 12.


## 9 Nov 2026 (1) - push 7a: nutrient list, material cards, declared grades, a material with no rate (D-162), MODULE: C2M
Next round started (Tahir, 7 Nov: review the Himayat and Majid workflow). Read-only audit of both roles (scratchpad audit7, 19 screenshots, 10 worst problems); picture "C2M Recipes and Nutrients" published for Tahir; panel of 10 questions; Tahir picked the recommended answer on all 10 (R60 to R69). 7a = R60, R61, R62, R66; 7b (next) = R63 resend back to QC when lines changed, R64 QC checks every short-path recipe, R65 notices at each step, R67 % of mix and live analysis in Majid's editor, R68 comment needed only when red, R69 close a version with a reason.
Files: c2m-access.js (3 new actions; production gets material.add and see.materials, qc nutrient.list, grade.declare, material.add, cfo material.add), c2m-lib.js (fieldLabel, safeLabel, cleanNutrient, nutrientBackfill, gradeCheck), c2m-engine.js (migration 014 reads; nutrientMode; notEntered in the analysis), c2m-routes.js (nutrients, classes as labels, card save, declared grade, material with no rate, the one-time copy, grade delete cleanup), c2m.html (Materials and nutrients: 4 tabs, material card, Nutrients, Classes, Declared grades; CFO Approvals line "materials wait for your rate"; Guide rows; CHANGELOG 2026-11-09a, last entry, shown only after 014), migrations/014_c2m_nutrients.sql and .PRODUCTION.sql (new), docs 01 to 12.
Migration 014: Ahmer runs it on production BEFORE Tahir pushes (4 CREATE TABLE IF NOT EXISTS; role rows get the 3 actions; ends with a check query: empty = done). The first state read after it copies every class field and % into the new tables once (a value left from an earlier class, or not a %, is not made live; listed in the change record). Before 014 C2M works exactly as before.
Tests: new t19 (65) and p17 (53); p15 and p16 assertions updated for the new rows and entry; t3 to t18, no-011, pricecheck 64, p9 to p17 pass; t2 has 1 failure that is the same before this push.
Independent review 7a: 1 Blocking, 4 Major, 6 Minor, all fixed (B1 out-of-use delete was commented out on the grade delete line; M1 copy carries only present class fields; M2 safe labels, copy flag in the change record, failure shown; M3 not complete is unknown, not below; M4 no rate columns for the Production Manager; minors: pre-014 old forms, hidden suggestions, drafts kept, delete record, migration check query, old doc lines). See docs 03 3.43 and 12.
Open for Tahir and Himayat: convert % w/v by density in the analysis or not (today added as typed); each nutrient's tolerance is Himayat's to set.
Not pushed. Delivered to E:\VAN Systems for Tahir to push after Ahmer runs 014.


## 9 Nov 2026 (2) - push 7b: the recipe path, notices, the line editor, the check screen, Close (D-163), MODULE: C2M
Tahir pushed 7a (e998cbe, 14:40); Ahmer runs migration 014 later (7a stays off until then; checked live: page 2026-11-09a served, browser pane signed out, so no signed-in check yet). 7b = R63, R64, R65, R67, R68, R69. No migration.
Files: c2m-lib.js (RECIPE_FLOW_OTHER, lineSig, resendTo), c2m-engine.js (latestVersion skips closed), c2m-routes.js (advance: short path draft, review, cost; resend by comparing the lines kept at send back; comment needed when red; notices at each step; the lines re-checked inside the step; a short-path version with no QC check refused at cost; send back keeps the lines; new POST recipes/:id/close; state: path, flags, backSig, notices for production, qc, plant), c2m.html (recipe screens: words, step chips for the short path and closed, the check panel with What changed, Against the label, material data missing, comment, Pass, Send back, Close; Majid's editor with picker, Find, % of mix, live total and analysis; Guide rows Check a recipe and Close a recipe version; How C2M works and Who does what; CHANGELOG 2026-11-09b last; 2026-11-09a held back until 014 and remembered as not seen), docs 01 to 12.
Tests: new t20 (43) and p18 (44); p15 counts and p17 entry checks updated; t3 to t19, no-011, pricecheck 64, p9 to p17 pass; t2 keeps its old 1 failure.
Independent review 7b: 0 Blocking, 2 Major, 8 Minor; all fixed except minor 5 left for Tahir (notices go to built-in roles by name; a launcher role with a recipe step right gets none; the 3 recipe roles' notices show 30 days, never marked seen). See docs 03 3.44 and 12.
Not pushed. Delivered to E:\VAN Systems for Tahir to push (no migration needed for 7b).

## 10 Nov 2026 (1) - push 7c: liquids, % w/w and % w/v, densities (D-164), MODULE: C2M
Tahir ruled on the picture "C2M Liquids and Basis": R70 the QC Head enters material densities, the Production Manager product densities; R71 a missing density makes only the figures that need it not complete, naming it, never 1.0; R72 shown in the label's basis with the other beside it; R73 the lines' total kg per L as a hint only.
Files: c2m-engine.js, c2m-lib.js, c2m-routes.js, c2m.html, migrations/015_c2m_basis_density.sql and .PRODUCTION.sql (new), docs 01 to 12.
What it does: each % on a material card and each label nutrient is w/w or w/v; densities of materials and products with source and date (POST /api/c2m/density); a product sold per L is worked out in % w/v, per kg in % w/w; label checks in the label's basis; "density needed" on Materials and Today; recipe screens say kg per L for a product sold per L. Change list 2026-11-10a and 2 new Guide rows wait for 015.
Migration 015: Ahmer runs the PRODUCTION file once in phpMyAdmin (2 ALTERs, 2 UPDATEs, 1 new table). A second run stops at the first ALTER: harmless. Until then C2M works as after 7b.
Tests: new t21 (57) and p19 (51); p15, p17, p18 assertions updated; t3 to t20, no-011, pricecheck 64, p9 to p18 pass; t2 keeps its old 1 failure.
Independent unit audit (built code): 0 Blocking, 2 Major, 5 Minor; independent code review: 0 Blocking, 2 Major, 7 Minor; all fixed except the live editor not naming a material with a blank % (as before).
Open for Tahir: whether the recipes of the 23 products sold per L were typed per L (the screens said kg per kg until now); notices to custom roles and marking notices seen; tolerance per nutrient. For Himayat after 015: mark w/v values and enter densities; set P and K basis.
Not pushed. Delivered to E:\VAN Systems for Tahir to push.
Tahir ruled after delivery (10 Nov 2026): the QC Head re-checks all 23 recipes of products sold per L, confirming their lines are kg per 1 L; a wrong one is revised through the normal recipe path. (Answers the open question above and in docs 12.)

## 10 Nov 2026 (2) - push 7d: fixes from the walk of each screen (D-165), MODULE: C2M
Tahir had Majid, Himayat, Fahim and Yawar sign in one by one on the live site; Claude read every screen as each, read only (findings in docs 03, 3.46). Tahir: "Fix all as push 7d".
Files: c2m-lib.js (noRs), c2m-routes.js (no Rs in recipe notes, steps, send back and notices without see.cost), c2m.html (Today items, next move, dates in words, wording, Guide row), docs 03, 06, 07, 08, 11, 12.
No migration. Change list 2026-11-10b.
Tests: t21 61, new p20 13; t3 to t20, no-011, pricecheck, p9 to p19 (see docs 12). Independent review 7d: 0 Blocking, 3 Major, 8 Minor, all fixed.
Data for the team (not faults): Yawar fills labour and FOH High and Low (all 66 products wait on it), freight, Oct actuals, 38 sheet items; Himayat enters 53 materials, trims micronutrient suggestions, adds Amino acids to the list, re-checks the 23 liquid recipes; 0 declared grades.
Not pushed. Delivered to E:\VAN Systems for Tahir to push.

## 10 Nov 2026 (3) - push 7e: the role page, read and signed once (D-166), MODULE: C2M
Tahir asked for a mandatory read and sign-off page for everyone who lands, under 5 minutes, explaining the app flow and their role and job. On the picture "C2M Role Sign-off" he ruled: the page fills the screen until signed; a changed page is signed again; everyone except the COO signs; English.
Files: c2m-routes.js (state signed and signoffs, POST /api/c2m/signoff, record names), c2m.html (ROLE_PAGES for Production Manager, QC Head, Plant Manager, CFO, Price list viewer and a launcher role; the full-screen page; Guide, Read your role page; Setup, Record and checks, Role sign-offs for the COO; change list 2026-11-10c), docs 01 to 12.
No migration: each sign is a change record row (entity signoff, "page:version", with the role).
Tests: t21 70, new p21 70; all others pass (t2 keeps its 1 old failure). Independent review 7e: 1 Blocking (Sign was sent without the sign-in token), 3 Major, 9 Minor, 7 wording; all fixed.
Open for Tahir: the CFO role still holds nutrient.edit, while his page says nutrients are the QC Head's to enter: keep or remove the right. Read each role page on Role sign-offs and correct any words.
Not pushed. Delivered to E:\VAN Systems for Tahir to push.
Tahir ruled after delivery (10 Nov 2026): remove nutrient.edit from the CFO role (only the QC Head and the COO enter nutrients, densities and declared grades). To do in the next push: c2m-access.js SEED cfo, docs 11, the p15 Guide counts; on the live site the right is unticked on the launcher, People and access, Roles by app, C2M, CFO.

## 10 Nov 2026 (4) - push 7f: notices read, notices for launcher roles, the CFO and nutrients (D-167), MODULE: C2M
Tahir: "small push 7f"; notices also reach launcher roles: yes; a notice marked seen once read: yes; remove nutrient.edit from the CFO.
Files: c2m-access.js (CFO without nutrient.edit), c2m-lib.js (noRs: a figure before Rs), c2m-routes.js (notices by step rights; POST /api/c2m/notices/read; record leaves out read marks), c2m.html (For your information: new, Mark as read, read ones folded; the editor names a blank %; change list 2026-11-10d), migrations 016 (+ PRODUCTION), docs 03 to 12.
Migration 016: Ahmer runs the PRODUCTION file once (1 UPDATE and a check; an empty check means done).
Tests: t21 76, new p22 8; full run in docs 12. Independent review 7f: 0 Blocking, 1 Major, 8 Minor, all fixed.
Next (Tahir, 10 Nov): an interface review of every screen (tables, field sizes, colours, text selection, boxes, layout, page structure, text, alignment); an independent audit is running.
Not pushed. Delivered to E:\VAN Systems for Tahir to push.


## 10 Nov 2026 (5) - push 7g: the screens check, 25 findings (D-168), MODULE: C2M
Tahir, on the picture "C2M Screens Check": below target red when more than 2 points short, amber within 2; titles in normal case and bigger; money in millions with 2 decimals; "All 25 in 1 push".
Files: c2m.html (1 colour rule gpTone and gpCls; 1 missing mark –; millions with 2 decimals; kg with 4 decimals; GP with %; titles and answer lines on the recipe page, Clients and Month end; Delete and Remove in red outline; product page action bar; Materials Change cost plus More; the Guide grouped by place; What changed at most 5; phone labels, line editor, chart text and tap targets; change list 2026-11-10e), c2m-pricelist.js (ISSUER, 1 place for the issuer), c2m-routes.js (state issuer), docs 03, 05, 06, 08, 10, 12.
No migration.
Tests: new p23 26; changed p9, p12, p13, p14, p17 (held updates still show), p19, p22. Full run: all pass, t2 keeps its 1 old failure. Independent review 7g: 3 Blocking (amber cells shown green on price lists, Clients sort, the colour rule not on every tile), 6 Major, 9 Minor; all fixed except 1 left for Tahir.
Open for Tahir: Margin (and the Clients overview flag) still needs a large Rs short before red (his ruling of 16 Oct 2026), so a pack 3 points short can be amber on Margin and red on Clients. Keep the Rs test on Margin, or use the 2-point rule alone there too.
Not pushed. Delivered to E:\VAN Systems for Tahir to push, together with push 7f.


## 10 Nov 2026 (6) - push 7g, Margin rule (D-169), MODULE: C2M
Tahir (panel after the 7g review): Margin uses "2 points alone", the same rule as every other screen.
Files: c2m.html (Margin, the Clients overview flag and the COO's red line: red = below cost or more than 2 points short; the Rs test and red_share_pct gone from the page; the setting hidden in Company settings; change list 2026-11-10e says so), docs 03, 06, 08, 09, 12.
Tests: p23 27; full run all pass, t2 keeps its 1 old failure.
The open question in entry (5) is closed. Not pushed. Delivered to E:\VAN Systems for Tahir to push, with 7f and 7g.


## 10 Nov 2026 (7) - pause point: 7f and 7g live, waiting for the team's real feedback, MODULE: C2M
State: pushes 7c to 7g are pushed by Tahir (GitHub 8c09d6f) and live on van-control-tower.onrender.com/c2m. Checked live as Yawar at 17:46: change list 2026-11-10e, the issuer from c2m-pricelist.js ISSUER, money as Rs 3.10M, the 2-point colour rule (17 against 20 red, 18.5 against 20 amber), Clients title and answer line, no n/a and no colour words on Margin, no page errors. Yawar's CFO role page shows first; he has not signed it (left for him).
Still to do on the system: migration 016 is not in effect (live, the CFO still holds nutrient.edit). Ahmer runs 016_c2m_cfo_nutrients.PRODUCTION.sql once (an empty check means done), or Tahir unticks nutrient entry for the CFO on the launcher, People and access, Roles by app, C2M.
For Tahir: read the 6 role pages on Setup, Record and checks, Role sign-offs and correct any words; each person signs at their next login.
Team data C2M waits for (not code): Yawar: labour and FOH rates (Low and High), freight, October actuals, the 38 items from his sheets. Himayat: 53 materials to enter, the amino acids, the re-check of the 23 liquid recipes, declared grades (0 entered).
Open idea, not ruled: a label tolerance per nutrient (Himayat). Needs a picture and Tahir's ruling before any build.
Left on purpose: on a phone, the red Delete on the product page sits full width under the title (within the 7g ruling; Tahir may ask for it smaller).
Next: Tahir resumes when the team has worked in C2M and given real feedback. Then: walk each screen signed in as Majid, Himayat, Fahim and Yawar (about 1 week from now), collect the feedback, picture first, panel questions, build as push 7h.
Working notes for the next session: the cloud copy keeps stash entries for 7e and 7f+7g (already pushed; drop them before new work and start from origin/main 8c09d6f). Tests: route harness t2 to t21 (t2 keeps 1 old failure), page tests p9 to p23, pc, no-011.


## 17 Nov 2026 - push 9: the go-live window (D-170), MODULE: C2M
Why: Yawar, Majid and Himayat are taking C2M live. Yawar: the opening recipes from his sheet were taken as approved and must be corrected (packing, FOH and labour too). His Fruitlish 3 L packing bill seemed not to save: it had saved as urgent and was waiting for Tahir or Monday 23 Nov (its carton line was entered per pack, not 4 packs per outer). No pack had a cost today because Labour and FOH Low and High are empty.
Tahir ruled (panel): a go-live window (every cost change in when saved, no Monday wait, no urgent approval); direct correction of the recipes from the sheet (Production Manager, then the CFO); when the window ends, each pack's cost that day becomes its approved cost; Yawar sets up packing bills himself.
Files: c2m-routes.js (GL cache and glUntil, q drops re-approval items but keeps first-cost items, weekly() treats the window as Monday, POST /api/c2m/golive, glClose, openingCps, recipe /advance direct path with step note "(D-170)", state golive and path golive, Company settings refuses golive_ keys), c2m.html (glStrip on Approvals, Today and Costs, Tahir's last-day box and Close the window now with 2 taps, 1 press save via effectFirst, weekNote and wkHeld, recipe chips and Send to the CFO, change list 2026-11-17a), docs 01, 03, 05 to 12.
No migration: setting rows golive_until and golive_reset in c2m_setting.
Tests (cloud copy, MariaDB 10.11, real code, migrations 001 to 016, scratch harness not in the repo): golive route suite 56 pass, page suite in jsdom 19 pass; both fail on the code before. Independent review: 0 Blocking, 1 Major, 5 Minor, 3 Preference; all fixed except a cap on the last day.
Not pushed. Delivered to E:\VAN Systems for Tahir to push.
After the push: Tahir opens the window on Costs (pick the last day). Yawar fills Labour and FOH Low and High, then saves the Fruitlish 3 L bill again (carton as Secondary, 4 packs per outer). Majid corrects recipes; Yawar approves their cost.
Open for Tahir: what Rs 295 on the Fruitlish bill covers (bottle only, or more); he left it to Yawar.

Live, 17 Nov 2026 16:10: push 9 is pushed (commit 2fb22f1) and deployed. On Tahir's instruction ("stop the approvals, let it be automatic for go-live") Claude opened the go-live window as Tahir, last day 30 Nov 2026; checked live: the strip shows, nothing is held for Monday, Save reads "Save and approve". Labour and FOH Low and High are filled (labour 5 and 7.5, FOH 15 and 22.5). Yawar's urgent Fruitlish 3 L bill (waiting change 6, carton entered per pack) was left for him to save again, which puts it in at once.

17 Nov 2026 18:20, push 9b (MODULE: C2M, c2m.html only, change list 2026-11-17b): Tahir asked for Send to the CFO directly under Save lines for the go-live stage; Majid could not find the send (it lived only in the panel). Added Save lines and send to the CFO in the editor and Send to the CFO on the recipe page, both only for a draft on the go-live path. Tests: send 18, golive 56, page 19 pass. Independent review: 1 Major (failed send left a dead editor) and 2 Minor, fixed. Docs 07, 08, 12. Not pushed; delivered to E:\VAN Systems for Tahir to push.

## 18 Nov 2026 - push 9c: every recipe straight to the CFO in the go-live window, Find on Labour and FOH (D-171), MODULE: C2M
Why: Yawar: "when we add new product it follows the standard approval process Production Manager > QC > Onwards" and asked for a search on Costs, Labour and FOH, "Which products are on which rate". Tahir: "allow them to add new products without approval until 30th nov", "solve the search issues"; panel: "Majid, then Yawar" and "Every recipe sent in the window".
Files: c2m-routes.js (/advance: direct for every draft in the window; lastSendDirect and the marker; typed notes cannot carry "(D-170)"; state path), c2m.html (go-live strip words, the recipe step line, Find box per tab with data-lfs and lfApply, change list 2026-11-18a), docs 01, 03, 05, 06, 07, 08, 09, 11, 12.
No migration.
Tests (cloud copy, scratch harness not in the repo): golive171 32 of 32 (5 of 32 on the old code), p171 21 of 21. Independent review: 0 Blocking, 1 Major, 4 Minor, all fixed; 1 Preference accepted. See docs 12.
Not pushed. Delivered to E:\VAN Systems for Tahir to push.
After the push: check live as Majid that a new product's draft shows Send to the CFO, and as Yawar that Costs, Labour has the Find box.
Open: a recipe already with Himayat or Fahim keeps its path until passed or sent back.

Live, 18 Nov 2026 16:00: push 9c is pushed (commit e93a8a8) and deployed. Checked live as Tahir: the page serves change list 2026-11-18a; the window is open to 30 Nov 2026; all 3 drafts (BKK Potash 30% 1 Liter, Tornado, Bio Dividend) show the go-live path (Send to the CFO); Costs, Labour has the Find box (73 products; "high" 2, "syngenta" 2, "tornado" 2). Still on the old path, as ruled: V Germinator Pro, Farm Booster and Ferti Huma-Pellet with the QC Head, Pulsate with the CFO. Tahir's What changed box was left for him to read.


## 20 Nov 2026 - independent audit and redesign pictures, no code changed, MODULE: C2M
Why: Tahir called the interface useless (layout, Approvals, notices, Products, Costs, Price lists) and asked for independent code, UI/UX and user acceptance audits, then each screen redesigned as a picture before any code.
Done (read only): 3 independent audits on a copy of the repo: code 38 findings (1 Blocking, 11 Major, 26 Minor, 6 security items for docs/SECURITY-REGISTER.md, not yet written there); UI/UX 49 (13 Major); acceptance 36 (5 block adoption). Live data read in Chrome as Tahir, nothing changed.
Checked by Claude: C-01 is real: in the go-live window reapprovalFor counts only first costs (c2m-routes.js 169) and costNotice writes "No pack moved more than the re-approval %" (283); glClose then makes today's cost the approved cost. C-07 is real: the KAM view's Download uses data-mkpdf (c2m.html 4489), which issues a new VAN/PL number, against the 11 Nov ruling. The top bar is position:fixed top 0 on wide screens (checked live at scroll 1000 px); the mid-page bar in Tahir's pictures comes from full-page capture.
Pictures (claude.ai artifacts): audit and plan https://claude.ai/artifact/PhjWQZHk7zxbytN9TJrPhG ; Approvals https://claude.ai/artifact/UL1EC2HWi7EovXVcaWrwTe ; Products https://claude.ai/artifact/H1KjB7UdPKBPp7CjGRgQnK ; Costs https://claude.ai/artifact/49geCjrtG4mcFUHQ4tJsJ7 ; Price lists https://claude.ai/artifact/VaWNtYFncsNDh8E98DoSmQ
Tahir ruled (panel, 20 Nov 2026): push 10a writes the true moved-pack count on every cost notice and shows, from 23 Nov, 1 list of every cost that becomes approved on 1 Dec (approved cost against today's cost); the Approvals badge counts only his decisions; Products drops "Standard margin %"; Costs boxes open as a whole, no Open buttons (replaces D-148).
Plan (each push after its picture is approved): 10a before 30 Nov, data truth (C-01, C-02, C-05, C-06, C-07, C-08, Guide says Send to the CFO in the window, A-24); 10b page head for every screen, sticky bar on every width and hidden in print, Approvals; 10c Products and Costs; 10d Price lists (2 tabs, issued first, access as 1 table); later C-03 speed, C-04 refresh, C-09 focus, Himayat nutrient type, Yawar make-it-sellable, tests into the repo (C-27).
Open for Tahir: 47 re-approval items with the CFO since 19 Oct were made on the old Rs 20 / Rs 30 bands; company target setting is 23.2% against his 19 Oct ruling of 23%; Irfan lacks the Distributor list (11 Nov ruling); 7 people named 11 Nov are not yet price list viewers; freight has 0 rates; white label FY sales read Rs 267.20M at 06:04 and Rs 265.97M at 11:00 on 20 Nov; on a phone, Approvals list before the margin card (D-99 order) not yet ruled.
Files changed: this entry only. Not pushed.

## 20 Nov 2026 (2) - push 10a: data truth before the go-live window closes (D-172), MODULE: C2M
Why: the independent audit of 20 Nov (entry above) found the go-live cost notices untrue and 6 other data faults; Tahir ruled (panel) the true count plus a review list, and said "Go ahead".
Files: c2m-routes.js (reapprovalFor info and mvStore in wrap, costNoticeTail, freight sweeps count moved packs, notices read as unread plus newest 30 read, GET /api/c2m/pricedocs/latest-mine, viewer PDF on any issued document of a granted list), c2m.html (glRevRows, glRevBox, panel glrev, COO job from 7 days before the last day, button on the go-live line, packing rate toast in the window, read fold 30, viewer Download of the latest issued list, grant tick reverted when not saved, VAN Brands packs only, PO price check opens on All dates and Off their list, glGuide, change list 2026-11-20a), docs 03 (3.52), 05, 06 (D-172), 08, 11, 12.
No migration.
Tests (cloud copy, MariaDB with migrations 001 to 016, Express 4, jsdom; scratch harness not in the repo): routes10a 15, page10a 16, render 3; the reviewer's mv, rev.page and nt checks pass. Against the code before: routes10a 7 fail, page10a fails at once.
Independent review: 0 Blocking, 1 Major (list said "keeps the old approved cost" for packs with none), 10 Minor, 2 Preference; all fixed except m5 (for Tahir) and m10 (end-to-end moved-pack test). Re-check: ready to push.
Open for Tahir: a viewer's Download gives the latest issued list even when it ended (the only issued list, Distributor VAN/PL/2026/001, ended 20 Oct) or is dated ahead; the dates show on the line.
Not pushed. Delivered to E:\VAN Systems for Tahir to push.
After the push: check live as Tahir that Costs shows "See the costs that become approved" and the list opens; as a Price list viewer (Saad or Muhammad Ali) that Download gives VAN/PL/2026/001 and makes no new number; that For your information shows every unread notice.
Next: push 10b (page head for every screen, sticky bar in print, Approvals as in picture 1, badge counts only decisions), picture already approved in principle.
Correction to the entry above, same day (append only): Tahir ruled the open point (panel, "Block until a new one"): a Price list viewer gets no Download while the latest issued list of his list has ended, an older document is refused, and a viewer may issue only the first document of a list (server guard on POST /api/c2m/pricedocs, added after the reviewer's last check, with 2 tests). Today the only issued list (Distributor VAN/PL/2026/001) ended on 20 Oct, so KAMs with the Distributor list see "Ask the CFO for the current list" until Yawar issues a new one. Tests: routes10a 21, page10a 18, render 3. Reviewer verdict on the ended-list change: ready to push. Still not pushed.

Live, 20 Nov 2026 14:15: push 10a is pushed (commit 6fcfee2, files match what was delivered) and deployed; checked live as Tahir in Chrome, read only: the page serves change list 2026-11-20a; Costs shows "See the costs that become approved" and the list opens (11 packs: 0 moved more than 5%, 9 moved 5% or less, 2 take their first approved cost; 25 packs have no cost and no approved cost); no Approvals job yet (it starts 23 Nov, 7 days before 30 Nov); For your information shows all 52 unread notices (before: 20); in the window the Guide says Send to the CFO; Saad's Price lists (rendered from his preview state and the live latest-mine): Distributor reads "ended on 20 Oct 2026, ask the CFO" with no Download and no make button, Farmer Punjab "not issued yet" with Download. Not checked live: the viewer server refusal (needs a viewer sign-in; covered by routes10a). Note: the live re-approval % setting is 5, not 3. Next: push 10b.

## 20 Nov 2026 (3) - push 10b: Approvals in 3 groups, and 1 page head (D-173), MODULE: C2M
Why: Tahir's rulings of 20 Nov (D-172 panel) and "go ahead": the badge counts only his decisions; Approvals as in the picture "C2M Approvals redesign"; 1 page head with ? Help; the top bar never printed.
Files: c2m.html only (head() with helpOpen and meta; badgeN; homeGrid list for the administrator: topic chips by jobTopic, groups To approve, Stuck with others, To do, stuck recipes folded per role, working-day ages, red "Act now"; other roles keep their old list; verdict card period, chip in points, legend, * on a month not finished; notice digest; go-live 1 line on Approvals, controls on Costs; target words Raise, Lower, Set; Find hides empty group headers, opens a matching group and counts folded items; print CSS; change list 2026-11-20b), docs 03 (3.53), 06 (D-173), 07, 08, 09 (B-69 to B-72), 12.
No migration. No server change.
Tests (cloud copy, jsdom; scratch harness, not in the repo): page10b 26, page10a 18, render 3; screenshots at 1366 and 390 px in Chrome.
Independent review: 0 Blocking, 5 Major, 10 Minor, 3 Preference; all Major and 7 Minor fixed; re-check: ready to push; its 4 new Minor points fixed after.
Open (listed in doc 12): screens that build their own heading (product, VAN list, client, Costs parts, Labour, Month end) get the standard head and ? Help next; the Your day card and With others fold still count calendar days; Help is kept per topic, not per tab.
Not pushed. Delivered to E:\VAN Systems for Tahir to push.
After the push: check live as Tahir that the badge shows 2, Approvals shows the 3 groups and chips, the 20 packing bill notices fold into 1 line, ? Help opens, and Costs still has the go-live controls; as Majid that his Today list is unchanged.
Next: push 10c (Products and Costs as in pictures 2 and 3).

Live, 20 Nov 2026 15:25: push 10b is pushed (commit bbc2e99, page matches what was delivered) and deployed; checked live as Tahir in Chrome, read only: change list 2026-11-20b; badge 2; answer line "2 decisions need you. Also on your list: 3 recipes stuck with others and 4 jobs to do."; next move "Raise the company target 23.2% to 34.3%", waiting in working days; chips All 9, Recipes 3, Prices and targets 3, Costs and month end 1, Margin 1, Setup 1; groups To approve 2, Stuck with others 3 (1 folded line, up to 28 working days), To do 4; margin card names 1 Jul to 20 Nov 2026, "3.1 points below", legend and "* Nov is 1 to 20 Nov"; notices fold into 3 lines (12 by Yawar on 20 Nov, 29 on 18 Nov, 9 on 17 Nov); go-live 1 line with Open on Costs; ? Help present. Not checked live: Majid's unchanged Today (C2M's preview opens only Price list viewers; covered by page10b). Next: push 10c.

## 20 Nov 2026, push 10c: VAN Brands Products and Costs boxes (MODULE: C2M, D-174)
Files changed: apps/c2m/c2m.html, apps/c2m/c2m-engine.js (packing bills carry approved_at as at), apps/c2m/docs/03, 06, 07, 08, 09, 12.
What: Clients, VAN Brands, Products: 4 boxes that filter and add up (All packs, Cannot be costed, Recipe waiting as part of it, Costed); the whole row opens the product; name once in bold, pack muted, packs small to large; 1 state and only what it does not say; no Standard margin % (his ruling of 20 Nov). Costs: each box is Problem, To do, Not set up, Waiting or Up to date with a coloured edge, word and icon, problems first; the whole box opens (no Open buttons, replaces D-148); the answer line names what needs attention; month end shows the Month end page's 5 steps and the next one; packing last change includes bill saves; labour and FOH say per kg or L; go-live line is 1 line with a fold. Waiting (a freight rate dated later, or a Monday wait outside the go-live window) is not counted as needing attention. Change list 2026-11-20c.
Tests (scratch harness in the cloud copy, not in the repo): page10c 34, page10a 18, page10b 26, render 3; screenshots 1366 and 390 px, no page errors.
Independent review: 2 Blocking, 5 Major, 9 Minor, all fixed except m9 (moving a pack onto a bill from the product does not change the packing last change, noted in doc 12); re-check found 1 Major (docs) and 4 Minor, all fixed; second re-check: ready to push.
Not pushed. Delivered to E:\VAN Systems for Tahir to push.
After the push: check live as Tahir that VAN Brands shows the 4 boxes and no Standard margin, rows open the product, and Costs shows the 6 boxes with edges and no Open buttons.
Next: push 10d (Price lists: Lists and Who can see them tabs).

Live, 20 Nov 2026 16:10: push 10c is pushed (commit 4be739d) and deployed; checked live as Tahir in Chrome, read only: change list 2026-11-20c (its What's changed box left open for Tahir, not pressed). Costs: "3 of 6 need attention: Packing cost, Month end and Freight cost."; Packing Problem (red edge, 48 items, 94 bills, last change 20 Nov, 5 packs have no packing bill); Month end To do (Oct 2026, 1 of 5 steps done, Charged on kg made done, next: actuals); Freight Not set up (0 rates in force); Material, Labour and FOH Up to date (green edge; labour and FOH last change 17 Nov, per kg or L); no Open buttons; go-live line with its fold. VAN Brands, Products: "29 VAN brand products, 49 packs. 7 packs cannot be costed yet."; boxes 49 All, 7 Cannot be costed, 2 Recipe waiting, 42 Costed; states 42 Costed, 4 No recipe, 2 Recipe not approved, 1 Cost missing; no Standard margin column; no underlined links in the table. Next: push 10d.


## 20 Nov 2026, push 10d: Price lists in 2 tabs (MODULE: C2M, D-175)
Files changed: apps/c2m/c2m.html, apps/c2m/docs/01, 03 (3.55), 06 (D-175), 07, 08, 09 (B-76), 11, 12.
What: Price lists (top bar) has 2 tabs. Lists: the answer line counts the lists and the issued ones ("16 lists. Only 1 has ever been issued, and it ended on 20 Oct 2026." on live data); Make a list beside ? Help; issued lists first with number, dates, state (ended and not replaced, starts, in force), Download PDF (no new number) and Issue a new PDF; never-issued lists in 1 table with Make the first one; the public page in 1 line. Who can see them: 1 full-width table of people against the 6 lists (replaces the left list and right panel; also Setup, KAM lists); a tick saves at once; Change opens a person's white label clients under the row; See what they see; Website shows "with Farmer, Punjab"; a cell marked missing is a list the 11 Nov 2026 ruling gives the person (written in the page as PL_RULED, matched by name); a note under the table names those gaps, people named with another C2M role and people not in C2M yet. Find and the How-to open this tab (placc:). Change list 2026-11-20d.
Tests (scratch harness, not in the repo): page10d 42, page10c 34, page10b 26, page10a 18, render 3; Chrome at 1366 and 390 px, no page errors; phone buttons measured 44 px.
Independent review: 1 Blocking, 2 Major, 9 Minor, all fixed except m9 (older: a renamed white label client shows as never issued; a grant for a client out of the list clears only with Clear clients) and 4 preferences; re-check: ready to push after 2 phone points, fixed and measured. Open app-wide: a general 40 px button rule beats older 44 px phone rules (doc 12).
Questions for Tahir (doc 12): keep the Website column or drop it as in the picture; keep the 11 Nov ruling check in the code until met, or make it a setting with an end date; are the 8 names spelt in People and access as in the ruling.
Not pushed. Delivered to E:\VAN Systems for Tahir to push.
After the push: check live as Tahir that Price lists shows the 2 tabs, the issued Distributor list with Download PDF, 15 never issued, and Who can see them with Muhammad Irfan's Distributor marked missing.
Next: the later items in the audit plan (standard head on screens with their own heading, working days on Your day card, speed C-03, refresh C-04, focus and folds C-09).
Tahir's answers, 20 Nov 2026 (panel): keep the Website column; keep the 11 Nov ruling check (PL_RULED) until all 8 people are set up, then take it out of the code; the 8 names are spelt in People and access exactly as in the ruling. Doc 12 updated to match.

Live, 20 Nov 2026 17:45: push 10d is pushed (commit 194f8f2) and deployed; checked live as Tahir in Chrome, read only: change list 2026-11-20d; Price lists answer "16 lists. Only 1 has ever been issued, and it ended on 20 Oct 2026."; Make a list at the top; tabs Lists and Who can see them (3 people); issued: Distributor VAN/PL/2026/001, 11 Oct to 20 Oct 2026, "Ended 20 Oct 2026, not replaced", Download PDF and Issue a new PDF; 15 never issued; public page 1 line. Who can see them: Muhammad Ali (Distributor, Farmer, Punjab; Website with Farmer, Punjab; BKK, Kissan Fertlizers), Muhammad Irfan (Dealer, Sindh, Farmer, Sindh, Farmer, Sindh credit; Distributor marked missing), Saad Jamal (Distributor, Farmer, Punjab). Note: Fahim Asghar is in C2M as Plant Manager (named in the 11 Nov ruling); 6 others are not in C2M yet. Nothing was ticked or changed.


## 20 Nov 2026, push 10e: the audit Minors and public holidays (MODULE: C2M, D-176)
Tahir's rulings (panel): the 19 targeted Minors now; the 6 rebuilds (C-23, C-24, C-25, C-28, C-29, C-34) go with the Major pushes; a public holidays list kept by the COO; a migration for price list numbers.
Files changed: apps/c2m/c2m.html, c2m-routes.js, c2m-lib.js (FED 0 stays 0), c2m-pricelist.js (rows carry _ch), migrations/017_c2m_pl_numbers_holidays.sql and .PRODUCTION.sql (new), docs 01, 02, 03 (3.56), 04 (4.24), 05 (5.26), 06 (D-176), 07, 08, 09 (B-77 to B-79), 10 (10.30), 11, 12.
What: C-11 margin chip Not judged; C-12 money never -0 or Rs NaN; C-13 blank setting not 0, FED 0 kept; C-14 labour and FOH free while the go-live window is open (no fixed date); C-15 and C-26 error toast an alert above every box, esc of ', badge and row labels, scroll padding; C-16 dead code out, nmi; C-17 each prices-to-change job opens its own packs; C-18 job keys; C-19 newest load wins; C-20 a list dated ahead previewed from the server on its From date (POST /api/c2m/pricedocs/preview), reasons too; C-21 a save after the window runs the close first, 1 close at a time; C-31 filled-in targets marked; C-32 kept answers dropped after Monday costs, freight, the pull, the close and list revisions; C-33 VAN/PL numbers from a counter per year (pl_seq_<year>), UNIQUE ref; C-35 public holidays (Company settings, COO only; working days skip them); C-36, C-37 no divide by 0; C-38 Price lists read once with Try again. New Guide job: Add or remove a public holiday. Change list 2026-11-20e.
Tests (scratch harness, not in the repo): page10e 35, routes10e 22 (MariaDB, migrations 001 to 017), page10d 42, page10c 34, page10b 26, page10a 18, render 3, routes10a 21. Migration 017 run twice on the test copy.
Independent review: 1 Blocking (the new change list entries locked every role but the COO out: fixed, with a test that loads as the CFO and a KAM), 0 Major, 9 Minor and 8 Preference, all fixed but P-1 and P-3 (in doc 12); re-check: ready to push.
Migration 017: run on the local database first; production later by hand (017_c2m_pl_numbers_holidays.PRODUCTION.sql). Until it runs, numbering still works and the holiday box says it is not switched on.
Not pushed. Delivered to E:\VAN Systems for Tahir to push.
After the push: check live as Tahir that C2M opens, Company settings shows Public holidays (after 017), the change list shows 2026-11-20e; and that a non-admin role still opens C2M.
Next: the Major pushes (C-03 speed with the file split C-24; C-04 refresh; C-09 focus and folds with the redraw C-23; C-22 repeated work; C-27 tests into the repo), then C-25, C-28, C-29, C-34.

Live, 20 Nov 2026 21:10: push 10e is pushed (commit 3c74059) and deployed; checked live as Tahir in Chrome, read only: change list 2026-11-20e; C2M opens; Approvals answer line and badge label ("Approvals, 2 waiting"); no "undefined" or NaN on Approvals; margin chip "3.1 points below"; every job has a key; the change list reads without error for a non-admin role (37 lines); next price list number VAN/PL/2026/002. Migration 017 not yet run on production (holidaysReady false): the holiday box says it is not switched on until Tahir runs 017_c2m_pl_numbers_holidays.PRODUCTION.sql. Nothing was changed.


## 20 Nov 2026, push 10f: C2M keeps the place, and works lists out once per draw (MODULE: C2M, D-177)
Tahir picked C-09 and C-22 from the Majors ("lets work them").
Files changed: apps/c2m/c2m.html; docs 03 (3.57), 06 (D-177), 08, 12.
What: C-22: memo() with a draw counter (RSEQ) keeps 1 answer per draw for jobs, waitingOn, exposure, toChange, noPrice and nmRows; exposure indexes sales and open POs by pack. Clients redraw 679 ms to 31 ms on a test copy with 20,000 sales (exposure identical to before for all 240 packs). C-09 (with the short-term part of C-23): the button or tick pressed keeps the focus (the same row's button among look-alikes); folds stay as the person left them, kept by place and panel (menus and row folds never kept; the code wins when it changes a fold on purpose); scrolled boxes keep their scroll on the same place, the side panel on the same panel. Change list 2026-11-20f.
Tests (scratch harness, not in the repo): page10f 23, page10e 35, page10d 42, page10c 34, page10b 26, page10a 18, render 3; Chrome scripts perf10f and ui10f.
Independent review: 1 Blocking (every row's More menu opened together), 2 Major (+ New stayed open; scroll into the wrong table or panel), 4 Minor, 1 Preference, all fixed; re-check: ready to push; its last Minor (Margin view and Inputs tab in the place key) fixed the same hour.
Not pushed. Delivered to E:\VAN Systems for Tahir to push.
After the push: check live as Tahir that a press keeps focus, a fold stays open after a save, and Clients opens fast.
Next: the other Majors (C-03 speed of the server state with C-24 the file split; C-04 refresh; C-27 tests into the repo), then C-25, C-28, C-29, C-34. Migration 017 still to run on production by Tahir.

Live, 20 Nov 2026 22:05: push 10f is pushed (commit 862b18a) and deployed; checked live as Tahir in Chrome, read only: change list 2026-11-20f; a draw takes Approvals 10 ms, Clients 19 ms, Costs 14 ms, Margin 77 ms on live data; a fold opened on Approvals stays open after a redraw. Nothing was changed.

## 20 Nov 2026, push 10g: C2M opens faster and keeps itself up to date (audit C-03, C-04; D-178)
- Module: C2M. Files: apps/c2m/c2m.html, apps/c2m/c2m-routes.js, docs 03 (3.58), 05 (5.27), 06 (D-178), 08 (2026-11-20g), 12, 13. No migration. server.js and package.json not touched.
- C-03: reads outside a transaction also use C2M's own pool (1 connection always kept for saves); applyDueRevisions, loadAll and the admins read run together; the margin roles' steps start early; 1 loadAll shared for 30 seconds, dropped by any save. Simulated 150 ms per read: after a save 4,266 ms to about 2,740 ms; the next person about 1,980 ms. State answers same before and after; seeded check of the reordered writes: same rows written.
- C-04: the page reads again when the tab is shown and the data is more than 1 minute old, every 2 minutes while shown, and on a new day; never while a save, panel, editor, preview, typed-not-saved text, changed date or armed button is in progress; "Updated hh:mm" on Approvals from the server's clock.
- Independent review: 2 rounds; round 1 Not ready (B-1, M-1 and Minors), all fixed; round 2 Ready to push, its 2 Minors (m-8, m-9) fixed in this push.
- Tests (scratch harness): page10g 27, page10a to page10f, render, routes10a 21, routes10e 22 pass.
- Not pushed. Ready to push. After the push: live check (speed figures from Server-Timing, Updated line, refresh after 2 minutes).
- Next: C-24 file split with C-23, C-27 tests into the repo, C-03 item 2 (answer with only what changed after a save).
- Live, 20 Nov 2026 23:10: push 10g deployed (change list 2026-11-20g, refresh code and "Updated 23:03" on Approvals seen as Tahir; the What is new box held the refresh, as designed). State build, read only, after the 30 second kept answer ran out: 5,640 ms (first open after the deploy), then 4,177 and 4,377 ms (before 10g: 4,649 to 7,245 ms). load_all is now the long step (3,171 to 3,585 ms): loadAll itself, next to look at. Time outside the build (sending 653 KB) varied from 1.3 s to 7 s, and 1 request took 24 s with no timing header; not from C2M's code.

## 21 Nov 2026, push 10h: the page in 3 files, and which reads make loadAll slow (audit C-24, C-03; D-179)
- Module: C2M. Files: apps/c2m/c2m.html (now a small shell), NEW apps/c2m/c2m.css and apps/c2m/c2m.js (the styles and the script, unchanged apart from the change list entry 2026-11-20h), apps/c2m/c2m-routes.js, docs 02, 03 (3.59), 05 (5.28), 06 (D-179), 07, 08, 10, 12, 13. No migration. server.js and package.json not touched.
- C-24: the server hashes c2m.css and c2m.js at start and serves them as /c2m/c2m.<hash>.css|js, kept by the browser for 1 year; the shell is checked on every open. If the script does not arrive, the shell shows "C2M could not load" with Reload.
- C-03 diagnosis: Server-Timing on GET /api/c2m/state names the 5 largest loadAll reads (la_<table>, rows), for the COO and cost roles only. Answers unchanged.
- Independent review: ready to push; its Minors fixed (could-not-load line, bytes sent as read at start, la_ only for COO and cost roles, docs).
- Tests (scratch harness): shell10h 20, chrome10h, chrome10h-fail, page10a to page10g, render, idle10g, routes10a 21, routes10e 22, snap10g same as 10g.
- PUSH CHECK: GitHub Desktop must list the 2 new files c2m.css and c2m.js; without them C2M shows "C2M could not load" for everyone.
- Not pushed. Ready to push. After the push: live check (hashed names in the page, second open from cache, the la_ entries, then cut the large reads).
- Live, 21 Nov 2026 14:45: push 10h deployed (commit f52e9c7, with c2m.css and c2m.js). Page 2 KB naming c2m.40e9a10c70b7.css and c2m.a09e709a4067.js; first open fetched them (18 KB and 279 KB); second open took both from the browser (0 KB, 0 ms), page ready in 453 ms with the kept state answer. Server-Timing la_ (cold builds 5,896 and 4,258 ms; load_all 3,220 and 3,288 ms): the largest loadAll tables are small (cost_version 411 rows, recipe_line 275, packing_bill_line 175, client_pack 111, packing_bill 94). A single read answers in about 150 ms (packing_bill_line 153 ms), but packing_bill and recipe_line, each the 2nd read of a chain, took 2,500 to 2,800 ms: they wait for a free connection. So load_all is slow from connections held by other reads, not from table size. Next: time every read of the build (the prefetch reads, sales and open orders included) to find what holds the connections.

## 21 Nov 2026, push 10i: C2M reads over 8 connections, 1 kept for saves (audit C-03; D-180)
- Pushed together with the PLATFORM piece (OP-HANDOFF-PLATFORM.md, 21 Nov 2026): server.js gives C2M 8 connections (maxIdle 2, idleTimeout 5 minutes) instead of 3; tests/c2m-mount.test.js pin.
- Module: C2M. Files: apps/c2m/c2m-routes.js (read gate: plain reads leave 1 connection free for saves; writes outside a transaction and the 2 go-live setting reads counted; pool size logged at start), apps/c2m/c2m.js (change list 2026-11-21a), docs 03 (3.58 corrected, 3.60), 06 (D-180), 08, 12, 13.
- Correction to push 10g: C2M's pdq and pool are the same pool in server.js; 10g's "7 connections" never happened live. Corrected in docs 03 and 13.
- Simulated as live (1 pool, 150 ms per read): today 4,563 ms after a save, 2,886 ms the next person; with 10i on 8 connections 2,590 ms and 1,680 ms.
- Independent review: not ready at first (M-1: 8 connections would stay open all day; HostGator allows 25 per cPanel account); fixed with maxIdle and idleTimeout; Minors fixed.
- Tests (scratch harness): gate10i 3, routes10a 21 (also at pool sizes 1 and 8), routes10e 22, shell10h 20, page tests and idle10g, snap10g same as 10h; platform c2m-mount 25.
- BEFORE THE PUSH: check in cPanel how many MySQL connections the account uses at a busy hour (25 in all, every database user counts). Push server.js, tests/c2m-mount.test.js and these apps/c2m files in 1 push.
- Not pushed. Ready to push. After the push: live check (server log line "[c2m] database pool: 8 connections", load_all and build times).
- Live, 21 Nov 2026 15:45: push 10i deployed with the platform line (commit e6fca88; change list 2026-11-21a, script c2m.7a0ddd94233e.js). State build, read only, after the 30 second kept answer ran out: 2,877, 2,464 and 2,645 ms (the last after 5.5 minutes without use, so reopening connections cost nothing visible); before 4,177 to 5,896 ms. load_all 1,776 to 2,007 ms (before 3,220 to 3,288). The very first open after the deploy took 15,369 ms (new server, every connection opened for the first time). Reads still wait in turn: recipe_line and packing_bill 1,229 to 1,465 ms against about 155 ms for a single read. The server log line "[c2m] database pool" was not seen (no access to the Render log from here).

## 21 Nov 2026, push 10j: C2M keeps what it read for up to 5 minutes (audit C-03; D-181)
- Module: C2M. Files: apps/c2m/c2m-routes.js (kept read answers), apps/c2m/c2m.js (change list 2026-11-21b), docs 03 (3.61), 05 (5.29), 06 (D-181), 08, 12, 13. No migration. server.js not touched.
- Tahir's choice (panel, 21 Nov 2026): "keep answers 5 min". Plain reads of C2M's own tables keep their answer up to 5 minutes; any C2M write to a table ends its kept answers (when sent, again when it has landed, and at commit or rollback). Sign-in, roles and O2S data always read fresh. A hand change in phpMyAdmin or a migration shows within 5 minutes.
- Simulated (8 connections, 150 ms per read): after a save 2,590 ms to 630 to 783 ms; the next person 1,680 ms to about 465 ms; 59 of 72 reads kept.
- Independent review: not ready at first (B-1: a write outside a transaction could let a read keep the old table for 5 minutes); fixed and retested (race test passes); Minors fixed.
- Tests (scratch harness): cache10j 9, race10j, gate10i 4, routes10a 21, routes10e 22, shell10h 20, page tests; snap10g and the seeded check equal push 10i.
- Not pushed. Ready to push. After the push: live check (rc "kept" mark in Server-Timing, build time after a save and for the next person).
- Live, 21 Nov 2026 16:50: push 10j deployed (commit 89704f6; change list 2026-11-21b). State build after the 30 second kept answer ran out, read only: 559 and 575 ms (push 10i 2,464 to 2,877 ms); rc 71 of 73 reads kept; about 1.3 to 1.4 s in the browser, most of it sending the 653 KB answer. The open right after a save was not measured (it needs a save).

## 21 Nov 2026, push 10k: the C2M checks are in the repo (audit C-27; D-182)
- Module: C2M. Files: NEW folder apps/c2m/tests (20 files: README.md, run.js, _db.js, _page.js, fixture-state.js, 9 page-*.test.js, 6 routes-*.test.js), docs 06 (D-182), 08, 12. No app code, no migration; package.json and server.js not touched.
- 305 checks, all passing in the session (jsdom 31.0.1, Node 22.23.5, MariaDB 10.11). Page checks need jsdom: npm install --no-save jsdom@31.0.1 in the repo folder. Route checks run only on a throwaway database on this computer whose name ends in _test (CREATE DATABASE c2m_test), with C2M_TEST_DB=throwaway and C2M_TEST_DATABASE_URL set (README.md); each file empties and rebuilds it.
- On this PC (no jsdom, no test database yet): run.js says "Nothing ran", exit 0; every file passes node --check.
- Independent review: 2 rounds; round 1 not ready (a check tied to the year 2026; a crash with Windows line endings), fixed; round 2 ready to push.
- Note: the session's push of 10k was delayed because the computer was offline on 21 Nov evening; written here at 22:05.
- Not pushed. Ready to push. Next: C-23 (redraw only the part of the screen that changed), then the reply with only what changed after a save.

## 21 Nov 2026, push 10l: presses redraw only what changed; a refresh with nothing new downloads nothing (audit C-23, C-03; D-183)
- Module: C2M. Files: apps/c2m/c2m.js (paint: only changed parts of the page are written; folds, sorts, choice boxes and More made safe for a kept part; change list 2026-11-21c), apps/c2m/c2m-routes.js (state answer: build time in header X-C2M-Built, Cache-Control private, no-cache, Vary Authorization, so the same data gives 304), NEW tests page-10l.test.js (22) and routes-304.test.js (9), tests/README.md, docs 03 (3.62), 05 (5.30), 06 (D-183), 08, 12, 13. No migration.
- Independent review: not ready at first (B-1: an opened fold closed again after quiet redraws); fixed with its Minors; the fold and sort checks pass in Chrome too.
- Tests: apps/c2m/tests/run.js 336 pass, 0 fail (session, test database).
- Not pushed. Ready to push. After the push: live check (a refresh with nothing new gets 304; a fold opened on Costs stays open after a refresh).
- Next: after a save, send only what changed (the last open item of the speed work); C-23's longer term (screens as modules) is not planned yet.
- Live, 21 Nov 2026 22:55: push 10l deployed (commit ef0db19; change list 2026-11-21c). Read only, as Tahir: a rebuilt state answer with nothing new came back as 304 from the browser cache (0 KB transferred, X-C2M-Built new); a fold opened on Costs ("What the window does") stayed open through a refresh (main kept) and through a redraw that wrote main. Correction to earlier notes (10j live line and the 10j/10l messages): the state answer is about 653 KB unpacked but about 63 KB as sent (gzip), so the download was a smaller part of the wait than said; a 304 saves about 63 KB per refresh.

## RESUME HERE (21 Nov 2026, 23:05): what is left for the next chat (MODULE: C2M)
- Pushed and live: 10e to 10l (10i with the PLATFORM pool line). Only this handoff entry is not pushed.
- Audit items left: C-25, C-28, C-29, C-34 (rebuild Minors, with the Majors per Tahir's 20 Nov ruling); C-23 longer term (screens as modules) not planned; after a save, a reply with only what changed (low gain now: the answer is about 63 KB as sent).
- Waiting on Tahir: migration 017 on production (phpMyAdmin, the .PRODUCTION file); remove the PL_RULED check once all 8 people are set up; live-data points (47 stale re-approvals, budget 23.2 vs 23, freight 0 rates, FY sales mismatch, Irfan's Distributor tick, Fahim Asghar's role); a .gitattributes (platform) to keep LF line endings.
- Tests: apps/c2m/tests (336 checks, README.md); every push adds its checks there.

## 21 Nov 2026 (2), 23:25: handoff for the next chat: every open task, with the design, colour and layout changes still to do (MODULE: C2M)
Read with the RESUME HERE entry above. Sources read in full for this entry: the 3 audits of 20 Nov 2026 (code C-, UI/UX U-, acceptance A-), the 5 approved pictures and their change notes (links in the 20 Nov audit entry), the 20 Nov to 21 Nov entries of docs 12, and c2m.css and c2m.js as pushed (commit ef0db19, change list 2026-11-21c). Every "today" figure below was counted in those 2 files on 21 Nov 2026.

### 1. Correction to RESUME HERE
- Migration 017 is already run on production (Tahir, 21 Nov 2026 23:04). It is no longer waiting on Tahir. Not yet seen live: on the next live check, Company settings, Public holidays should show the box (holidaysReady true), not "not switched on".

### 2. Design work already done (do not redo)
- 10a: the true moved-pack count on every cost notice (U-02, A-09, C-01); the Guide says Send to the CFO in the window (A-24).
- 10b: the badge counts only Tahir's decisions (U-03, A-01); Approvals in 3 groups (To approve, Stuck with others, To do) with topic chips that add up (A-04); stuck recipes in 1 folded line; working days on the list (U-09, A-03); next move words Raise, Lower, Set (A-05); the margin card title is the finding, with the period, the gap in points, a legend and * on a month not finished (U-05, U-06, A-06); notices folded into a digest with the PO price check first (U-01, U-14 to U-16, A-08); go-live in 1 line on Approvals, its controls on Costs only (U-04; A-10 in part); 1 page head with ? Help on the main places; the top bar is never printed.
- 10c: VAN Brands Products with 4 boxes that add up, the whole row opens, name bold and pack muted, packs small to large, 1 state word, sort marks visible, no Standard margin % (U-18, U-19, U-23 to U-25, A-12 to A-14); Costs boxes with a coloured edge, a word and an icon, problems first, the whole box opens (replaces D-148), the answer line names the boxes, freight Not set up, packing last change reads the bills, rates per kg or L, month end shows its 5 steps and the step after (U-21, U-28, U-41 to U-44, A-17; A-18 in part).
- 10d: Price lists in 2 tabs, issued lists first, Issue a new PDF, never-issued lists in 1 table, Who can see them as 1 full-width table (U-45 to U-47, U-49).
- 10e: Not judged chip, error alert above every box, esc of ' (part of C-26). 10f and 10l: focus, folds and scroll kept; only changed parts redrawn (C-09; C-23 medium term).

### 3. Colour, type and layout changes still to do (app-wide design system; U-26, U-27, U-31 to U-36, U-39, U-40, A-29, C-25, C-28)
Do these as their own push, screen by screen, behind the page tests (no behaviour change). Picture first, as Tahir rules: 1 page showing each component before and after, and his OK, before any code.

3.0 Colour base to keep (Silver cool, the default look, ruled 14 Oct 2026; the pictures' common.css uses the same values). No new colours.
- Ground #EDF0F5, surface #FFFFFF, ink #172033, muted #566074, line #E1E6EE, blue #2F6DB5, kraft #8C6532, top bar #1F2A3C with text #D3DBE8.
- States: green #1F7A45 on #E3F1E8, amber #8F5F00 on #F7ECD3, red #B3261E on #F8E3E1.
- The other 3 looks (Slate light, Stone warm, Slate dusk) keep their own values; every change is checked in all 4, Dusk especially.

3.1 Colour meaning, 1 rule everywhere (U-27, U-36, D-100, D-168)
- Red: act now, stuck (more than 2 working days), below cost, or margin more than 2 points short.
- Amber: waiting on someone, within its time. Example to fix: "Not costed" is amber and turns red only when its recipe is stuck.
- Green: OK, up to date. Grey: to do, not used, not set up.
- Blue: only what can be pressed, and information tags. Never on titles.
- Approvals keeps 3 levels: Act (red), Decide (approvals), Know (the digest). System notes (go-live, What's changed) 1 grey line each.

3.2 A single tag (U-26, U-25)
- Today 7 styles: .pill (mono 11 px, 3 px corners, border in its colour), .stuckp (mono 10.5 px, bordered), .wltag (sans, round, tinted), .verdict .st, .gh .c (mono count), .subnav .tc, .hdr .n.
- To: 1 tag: sans 12 px, weight 600, sentence case, tinted background, no border; tones red, amber, green, grey, blue (values in 3.0). 1 count bubble style, for counts only. Mono only for numbers and references (VAN/PL/2026/001), never for words.

3.3 Type and headings (U-32, U-33)
- Today 22 font sizes: 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 16, 17, 18, 19, 20, 21, 22, 25, 34 px. To 7: 11, 12, 13, 14, 16, 20, 28 px. Faces stay IBM Plex Sans and IBM Plex Mono.
- Capitals with letter spacing today on: the global h2 (13 px, muted), h1.topic (20 px), .kick, .nextmove .k, .gh, .verdict .vk, .wlh2, group rows in tables, .rcard em, .assume b, the side nav group labels. To: sentence case, ink colour, no letter spacing.
- Card titles: Costs .cbox .ct is set 2 times, 1 of them blue. To: 15 px, weight 600, ink.
- Page title 20 px/600, answer line 16 px/500, meta 12 px muted.

3.4 Corners and spacing (U-32)
- Today 11 corner sizes: 1, 2, 3, 4, 5, 6, 8, 9, 10, 14, 999 px. The audit says 4 px for boxes, controls and tags, 999 px only for count bubbles. The approved pictures (10b to 10d) draw boxes at 8 px, buttons at 6 px and tags round. Ask Tahir: follow the approved pictures (8 / 6 / round) or the audit (4 everywhere). Recommendation: the pictures, since he approved them and 10b to 10d already use them.
- Spacing steps 4, 8, 12, 16, 24, 32 px. Content width stays 1160 px.

3.5 Buttons (U-35, U-17)
- Today 9 looks: .btn, .btn.ghost, .btn.danger, .lnk (underlined), .mrow>button.mn (underlined), .newm>summary, .rowmenu>summary, .wlb, .kam-i.
- To 4: Primary (filled blue, at most 1 per region), Secondary (blue outline), Quiet (text), Danger (red outline, never on Approvals). Picture values: 13.5 px, 34 px tall, 44 px on a phone.
- 1 word per kind: Approve for approvals, Open for the rest; the row title names the thing; whole rows are the target where a row opens 1 thing.

3.6 Page head on every screen (U-34; 10b open m6)
- Done on the main places. Still with their own heading: the product page, the VAN list page, the client page, the Costs parts (Material, Packing, Labour and FOH, Freight), Month end.
- Each gets head(): title, meta, ? Help top right, answer line, 1 grey system line when needed, underline tabs with counts, filter bar (chips with counts, Find, "n shown").
- Find on Approvals shows from 3 jobs (J.length > 2); U-11 says only above 12 rows. Ask Tahir.

3.7 Top bar (U-39, U-40, A-29)
- Today the 4 look dots sit in the top bar on every screen (.skins group in the header) and read like status lights; Launcher and Sign out are underlined links side by side (1 slip signs out).
- To (U-39): a person menu "Tahir ▾" with Look (4 named swatches), Guide and Sign out; Launcher stays on the bar (D-143). A-29 says Look in the Guide only (the Guide already has the named Look row). Ask Tahir which.
- Badge: red #E5262A; since 10b it counts only decisions, so red is kept unless Tahir asks (U-37 is met in effect).

3.8 Charts (U-31)
- Target line: grey dashes on Approvals (.vt .tl, muted), kraft dashes on Margin (.otl). To: kraft everywhere. Every chart labels its points and says how to read it.

3.9 Widths and phone (C-25, U-20; 10d open)
- Today 15 different width rules (560, 600, 640, 700, 760 and 761, 900, 980, 1100, 1300, 1400 px and ranges). At 1101 to 1300 px the nav scrolls sideways with its scrollbar hidden, so places off the edge give no sign; at 761 to 1100 px it may run over Find (check live at 800 px as Tahir). To: 3 widths (600, 760, 1100 px); places that do not fit go into More, measured after the draw.
- Long tables still scroll inside a box capped at 72 vh (.wrapx.tall): a scroll inside a scroll. To: the page scrolls, the table header sticks under the 52 px bar.
- A general 40 px button rule beats the older 44 px phone rules (.kam-b .btn, table.cards td .btn, .jobs .job .btn). To: 1 phone rule, 44 px.

3.10 Clean-up under it (C-28)
- 314 inline style="" in c2m.js to classes (vPriceLists and vToday first); 11 !important; .hdr defined 4 times, h1.topic 3 times, .hdr .n 3 times, .cbox .ct 2 times: fold each into its final value; delete the left-rail desktop rules no longer reached from 761 px; order c2m.css as base, shell, components, screens instead of by push.

### 4. Screen content still to do (words and flows, not colour)
Approvals
- U-07, A-07: the stat tiles carry their period ("Sales, FY to date"); "Act now" on a red job not yet stuck names the action.
- U-08: under the next move, "Also stuck: 3 recipes, oldest n working days ›".
- U-12: Names to settle (nothing waits on it) to a Later fold or to Setup. Ask.
- U-13: 2 target requests of the same client shown together, each with its FY Rs effect (tgtEffect).
- U-22, A-33: on a phone, next move first and the margin card as 1 line, or D-99 as now. Not ruled.
- A-36: "5 white label clients red" is a job every day; make it a job only when a client newly turns red. Ask.
- A-35: the rate check reads "Stuck 17 working days" from 1 Nov with no due date: give a due date and say overdue, or merge it with the COO check. Ask.
- A-02: a stuck recipe line says what is missing; a remind button only after the escalation ruling (I-01).
- A-34: a word list in the Guide, or 1 line of meaning on first use (GP, FOH, re-approval % with its figure, w/w, basis, segments, ex FED, NSV, FRP, absorbed).
Products and prices
- U-29, A-16: every count names its unit and basis ("19 packs below target at today's price").
- U-38, A-32: 2 places called Price lists (top bar documents; Clients, VAN Brands tab). Ask: "Price list PDFs" on the top bar, or "List prices" on the tab, or keep both.
- U-48: 1 list with 2 names (AUD "Farmer, Sindh" and "Distributor and channel partner"; LCARD "Farmer, Sindh cash" and "Distributor"): 1 name everywhere (the LCARD names).
- A-15: 2 product lists (Clients, VAN Brands, Products and More, Products): 1 Products place with a switch. Ask.
- A-31: on an issued list, "n prices changed since this PDF: issue a new PDF".
- A-30: viewers see when a list changed and its Valid from, and get a notice when a list they hold changes.
People's flows
- A-20, A-21 (Yawar): a "Make it sellable" checklist per product (recipe, bill, labour and FOH rate, price, list, KAM), each with its fix in place; 1 route per job; Not costed rows go to the missing piece.
- A-22: the bill editor shows the cost per pack and per kg or L before Save.
- A-25, A-26 (Majid): type the material name straight into a new row; 1 unit line at the top; his job line says what it waits for.
- A-27 (Himayat): 1 visible "Add a nutrient type", a nutrient allowed on an unclassed material, 1 Save per card.
- A-11, A-28: recipes approved in the window marked "QC Head and Plant Manager did not check"; Himayat and Fahim told their role until 30 Nov and given the list after. Needs Tahir's ruling.
- A-23: freeze screen changes in the window except fixes, weekly release after. Tahir's call.
- A-18 (rest): the count of products on High under labour and FOH is not shown yet.

### 5. Code audit items still open
- C-25 and C-28: in 3.9 and 3.10.
- C-29: names in the interface ("Tahir", "Yawar", "the COO") from ST.people by role; role keys in 1 place; the date literals '2026-12-01' and '2026-10-11' (also in c2m-pricecheck.js) into settings; out-of-date comments; the duplicated checks in ncpSend0.
- C-34: sending several prices is 1 request per pack; a dropped connection leaves some sent and some not. 1 batch endpoint in 1 tx(), or keep "not sent" rows marked until resent.
- C-23 longer term (screens as modules): not planned. After a save, a reply with only what changed: low gain (the state is about 63 KB as sent).
- Older opens in docs 12: 10a m10 (end-to-end moved-pack test), 10c m9 (a pack moved onto a bill from the product page does not change the packing last change), 10d m9 (a renamed white label client shows as never issued), 10e P-1 and P-3.

### 6. Outside MODULE: C2M (needs a declared switch to PLATFORM, never in the same change)
- docs/SECURITY-REGISTER.md: the 6 security items of the 20 Nov code audit, as S-18 onward: ssl false on the MySQL link; sign-in token in localStorage with no Content-Security-Policy; esc of ' (fixed in 10e, record as fixed); notices/seen marks a whole role; viewer document making (limited in 10a; no rate limit left); kept state answers and, since 10j, up to 800 kept reads for 5 minutes in memory. Mention once, briefly, at the end of that session.
- CLAUDE.md §3.0 to list apps/c2m/tests; a .gitattributes keeping LF endings; jsdom in package.json (optional).

### 7. Waiting on Tahir
- Remove the PL_RULED check once all 8 people are set up (6 not in C2M yet; Fahim Asghar is in C2M as Plant Manager).
- Live data: 47 re-approvals made on the old Rs 20 / Rs 30 bands; company target 23.2% in C2M against his 19 Oct ruling of 23%; freight 0 rates (expected, or to enter before 30 Nov); white label FY sales Rs 267.20M at 06:04 against Rs 265.97M at 11:00 on 20 Nov; Irfan's Distributor tick.
- The "Ask" points in 3 and 4: put them to him as 1 panel round at the start of the design push, each with where it is, what it says now and the options in full.

### 8. Suggested order for the next chat
1. Live check, read only: migration 017 (the holiday box is on).
2. 1 panel round with the "Ask" points.
3. 1 picture page of the design system before and after (tag, buttons, headings, colours, corners), his OK.
4. Push 10m: tokens, 1 tag, headings, buttons, chart target colour (CSS and classes only; page tests stay green; Chrome screenshots of every place at 1366 and 390 px, before and after, in all 4 looks).
5. Push 10n: page head on the remaining screens, the top bar person menu, the 3 widths and the phone rule.
6. Then the content items of 4, then C-29 and C-34.

Files changed: this entry only. Not pushed.

## 23 Nov 2026, 14:40: deleting an approved recipe, Tahir's rulings (D-184); the delete redesign comes before push 10m (MODULE: C2M)

Tahir asked how a recipe is deleted (case: Basic version 2) and called the delete screens poor.
- Today's code: a draft is deleted by the Production Manager or the administrator (Delete this draft, a reason, Delete, Confirm); a version in the workflow can only be closed by the person at its step; approved, old and closed versions can never be deleted (D-139). An approved recipe that is not the Default has no button at all.
- Live read, 23 Nov 14:30 (read only): recipe version id 67, Basic for Rudolf Life Sciences, "Basic - Standard Recipe - MAP, TSP & AS", version 2, note "Increased MAP"; written by majid 13:35, sent 13:37 (go-live, straight to the CFO), cost approved by yawar 13:38; approved, not the Default (Main version 1 is). No approved cost written on it. Looks like Majid meant a new version of Main but typed a new name (not confirmed).
- Rulings (D-184): an approved recipe may be deleted when unused (not the Default; no approved cost ever written on it; never the Default before; no follower). Reason required, lines kept in the change record. The CFO and the administrator delete it. Basic version 2 is deleted once this is live.
- Next: a picture page of the new delete and close flow for his review, then code (apps/c2m only), then push 10m as in the 21 Nov (2) entry.

Files changed: this entry and docs/06-decisions.md (D-184). Not pushed.

## 23 Nov 2026, 15:20: D-184 built, Remove a recipe (MODULE: C2M)

Built from the picture page "C2M Recipe Delete" and Tahir's comments on it (all points ruled; D-184 in docs 06).
- Every recipe has 1 red Remove button, under its name and in each row of the product's list of approved recipes. C2M checks first (GET /api/c2m/uses/recipe/:id) and offers Delete, Close or why it stays. 4 reasons, Other needs a note, 1 press.
- Delete: a draft (recipe.start); an approved recipe that is not the Default, has no approved cost, was never made the Default with Make default, and (if the Default) no follower (CFO or administrator); a closed version (CFO or administrator). Close: at a step, by that step's right (Close this version is now Remove). Old versions never.
- The Production Manager is told when the CFO or the administrator deletes a recipe someone else wrote. Lines, steps, name and state go to the change record.
- Code: c2m-routes.js (recipeRemove, rightFor, usesOf with the person, delete route, /recipes/new locked copy), c2m.js (Remove button, box, handler; Guide job "Remove a recipe"; What's changed 2026-11-23a; Production Manager role page text, version unchanged), c2m.css (end).
- Tests: routes-184 (42), page-184 (27); whole suite 405 pass on MariaDB 10.11 and jsdom 31.0.1 in Claude's workspace. Looked at in Chrome (local copy): the CFO deletes Basic version 2, Main stays the Default; the QC Head's panel; a phone at 390 px.
- Independent review: not ready at first (M1: an open box held the refresh after leaving the page), fixed with 5 minors and the nits; re-check: ready. Details in docs 12.
- Docs: 01 (1.45), 03 (3.63), 05 (5.31), 06 (D-184), 07, 08, 09 (B-80), 11 (11.32), 12, tests/README.md.
- No migration. No change outside apps/c2m.
- After the push: live check, then Yawar or Tahir deletes Basic version 2 (id 67, Rudolf) with "Wrong name: meant a new version of Main".
- Open for Tahir: version numbers of a deleted version are given again (m3); a follower product's own old approved recipe (m6).
- Then: push 10m as in the 21 Nov (2) entry.

Files changed: apps/c2m/c2m-routes.js, c2m.js, c2m.css, docs 01, 03, 05, 06, 07, 08, 09, 11, 12, tests/README.md, tests/routes-184.test.js (new), tests/page-184.test.js (new), this entry. Not pushed.

## 23 Nov 2026, 15:35: Tahir's rulings on the 2 open points (MODULE: C2M)
- m3: version numbers stay as today (a deleted version's number is given again).
- m6: a product that follows another keeps its own old approved recipes; never deleted while it follows. Built in recipeRemove with a check line naming the product it follows.
Files changed: c2m-routes.js, tests/routes-184.test.js, docs 06, 09, 12, this entry. Not pushed.

## 23 Nov 2026, 15:45: D-184 pushed and checked live (MODULE: C2M)
- Tahir pushed at 15:24. Live check (Chrome, as Tahir): the new page loads (c2m.81e319e06a7f.js), What's changed 2026-11-23a shows, the check for recipe 67 answered delete with all 4 checks passed.
- With Tahir's go-ahead in chat, Claude deleted "Basic - Standard Recipe - MAP, TSP & AS" version 2 (id 67, Basic, Rudolf Life Sciences) as Tahir, reason "Wrong name: meant a new version of Main". The server now says it is no longer in C2M; Basic shows only Main version 1 (Default), cost Rs 393.33 per kg on the 10 kg pack, unchanged.
- Seen on the way: on the live site a delete plus the state reload took over 4 seconds before the toast showed; the box had already closed. No fault, but slow (same as other saves).
- Next: push 10m as in the 21 Nov (2) entry (1 panel round with the Ask points first).

Files changed: this entry only. Not pushed.

## RESUME HERE (23 Nov 2026, 16:10): state, every pending development and every open question (MODULE: C2M)
Start the next chat by reading this entry, then the 21 Nov 2026 (2) entry above (it holds the full detail of sections 3 to 6 below, with the audit IDs, today's counts and the colour values). The next chat opens with "MODULE: C2M" (CLAUDE.md §0).

### A. Where things stand (23 Nov 2026, 16:10)
- Live and pushed: everything up to D-184 (commit 729f966, 23 Nov 16:01). Working tree clean.
- D-184, Remove a recipe: pushed 15:24 and checked live. "Basic - Standard Recipe - MAP, TSP & AS" version 2 (id 67, Basic, Rudolf Life Sciences) deleted as Tahir with the reason "Wrong name: meant a new version of Main"; Basic shows only Main version 1 (Default), cost Rs 393.33 per kg on the 10 kg pack, unchanged.
- Picture page for D-184 (all points ruled, kept for the record): "C2M Recipe Delete", claude.ai artifact e7e143ad-7f78-4bd7-8aa8-f9da2357032c.
- Tests: apps/c2m/tests, 407 checks (README.md). They ran in Claude's workspace (MariaDB 10.11, jsdom 31.0.1); Tahir has not run them on his PC.
- Migration 017 is run on production (21 Nov 23:04); the holiday box on Company settings, Public holidays has not yet been seen live.
- Go-live window ends 30 Nov 2026: on 1 Dec each pack's cost that day becomes its approved cost (D-170, push 10a list). Decisions that touch the window (B3, B4 below) are needed before then.

### B. Open questions for Tahir (ask as 1 panel round, each with where it is, what it says now and the options in full)
Before 30 Nov (the go-live window):
- B1. A-11, A-28: mark recipes approved in the window "QC Head and Plant Manager did not check"; tell Himayat and Fahim their role until 30 Nov and give them the list after? Options: mark and list / list only / neither.
- B2. A-23: freeze screen changes in the window except fixes, weekly releases after? Options: freeze until 30 Nov / no freeze.
- B3. Live data (from the 21 Nov live check): 47 re-approvals made on the old Rs 20 / Rs 30 bands (clear them or keep); company target 23.2% in C2M against his 19 Oct ruling of 23% (correct to 23%?); freight rates all 0 (expected, or to enter before 30 Nov); white label FY sales Rs 267.20M at 06:04 against Rs 265.97M at 11:00 on 20 Nov (find the cause?); Irfan's Distributor tick (give it or not).
- B4. Remove the PL_RULED check (price list access) once all 8 people are set up: 6 are not in C2M yet. Who sets them up, and when?
Design system (needed before push 10m):
- B5. Corners: follow the approved pictures (boxes 8 px, buttons 6 px, tags round) or the audit (4 px everywhere). Recommended: the pictures.
- B6. Top bar: a person menu "Tahir ▾" (Look, Guide, Sign out; Launcher stays on the bar), or Look only in the Guide (A-29).
- B7. Find on Approvals: shown from 3 jobs (as today) or only above 12 rows (U-11).
Screens:
- B8. U-12: Names to settle (nothing waits on it) moved to a Later fold, or to Setup, or kept.
- B9. U-22, A-33: on a phone, next move first and the margin card as 1 line, or keep D-99 as now.
- B10. A-36: "5 white label clients red" every day; make it a job only when a client newly turns red?
- B11. A-35: the rate check reads "Stuck 17 working days" with no due date: give it a due date and say overdue, or merge it with the COO check.
- B12. U-38, A-32: 2 places called Price lists: rename the top bar one "Price list PDFs", or the tab "List prices", or keep both.
- B13. A-15: 2 product lists (Clients, VAN Brands, Products; and More, Products): 1 Products place with a switch?
- B14. A-02 and I-01: the escalation ruling for stuck recipes (a Remind button only after it).
New from today:
- B15. The Production Manager's role page text changed with D-184 (an approved recipe that was never used is deleted by the CFO or the COO). Its version was not raised, so Majid was not asked to sign again. Raise it so he signs again, or leave it?

### C. Pending development, in the suggested order
1. Live check, read only: the holiday box (migration 017).
2. The B panel round.
3. 1 picture page of the design system, before and after (tag, buttons, headings, colours, corners), for his OK.
4. Push 10m: tokens, 1 tag, 7 font sizes, sentence-case headings, 4 button kinds, kraft target line on every chart (21 Nov (2) sections 3.0 to 3.5 and 3.8). CSS and classes only; page tests stay green; Chrome screenshots of every place at 1366 and 390 px in all 4 looks, before and after.
5. Push 10n: page head on the remaining screens (product page, VAN list page, client page, Costs parts, Month end), the top bar per B6, 3 widths (600, 760, 1100 px) with places that do not fit going into More, the page scrolling instead of the 72 vh table box, 1 phone rule of 44 px (sections 3.6, 3.7, 3.9).
6. Clean-up (C-28, section 3.10): 314 inline styles to classes, 11 !important, repeated rules folded, c2m.css ordered as base, shell, components, screens.
7. Screen content (section 4):
   - Approvals: tiles carry their period, "Act now" names the action (U-07, A-07); "Also stuck: n recipes" under the next move (U-08); 2 target requests of 1 client together with their FY Rs effect (U-13); a stuck recipe line says what is missing (A-02); a word list or 1 line of meaning on first use (A-34).
   - Products and prices: every count names its unit and basis (U-29, A-16); 1 name per list everywhere, the LCARD names (U-48); "n prices changed since this PDF" on an issued list (A-31); viewers see when a list changed and get a notice (A-30).
   - People's flows: Yawar's "Make it sellable" checklist per product (A-20, A-21); the bill editor shows cost per pack and per kg or L before Save (A-22); Majid types the material name straight into a new row, 1 unit line, his job line says what it waits for (A-25, A-26); Himayat's visible "Add a nutrient type", a nutrient on an unclassed material, 1 Save per card (A-27); the count of products on High under labour and FOH (A-18).
8. Code items (section 5): C-29 (names from ST.people by role, role keys in 1 place, the date literals '2026-12-01' and '2026-10-11' into settings, old comments, the duplicated checks in ncpSend0); C-34 (sending several prices: 1 batch request in 1 transaction, or "not sent" rows kept marked). Older opens in docs 12: 10a m10, 10c m9, 10d m9, 10e P-1 and P-3.
9. Earlier asks still open from memory of the costing work (not started): the 12 further C2M reports drawn for Tahir's approval (0.9.1, 18 Oct); search on Costs, Labour and FOH, "Which products are on which rate" (Yawar, 18 Nov; check whether 10c covered it); review Himayat's and Majid's workflow end to end (7 Nov; partly in A-25 to A-27).

### D. Outside MODULE: C2M (a declared switch, never in the same change)
- PLATFORM: docs/SECURITY-REGISTER.md rows S-18 onward for the 6 security items of the 20 Nov code audit (ssl false on the MySQL link; sign-in token in localStorage with no Content-Security-Policy; esc of ' fixed in 10e; notices/seen marks a whole role; viewer document making; kept answers in memory). Mention once, briefly, at the end of that session (CLAUDE.md §2A).
- PLATFORM: CLAUDE.md §3.0 to list apps/c2m/tests; a .gitattributes keeping LF line endings; jsdom in package.json (optional).

### E. Notes for whoever picks this up
- Working rules: picture first, his OK, then code (van-systems-rules); independent review before "ready to push"; Tahir pushes; Claude checks live after "pushed".
- Running the tests outside Tahir's PC: copy apps/c2m and package.json, npm install express mysql2 pdfkit @fontsource/arimo @fontsource/tinos compression jsdom@31.0.1, a local MariaDB database named c2m_test, then C2M_TEST_DB=throwaway C2M_TEST_DATABASE_URL=mysql://user:pass@127.0.0.1:3306/c2m_test node apps/c2m/tests/run.js. The docs folder must be present (the routes read it).
- On the live site a save plus the reload of the state takes about 4 seconds; a check made sooner reads the old state.

Files changed: this entry only. Not pushed.

## 24 Nov 2026: the redesign brief, the Phase 1 audit and Tahir's rulings (D-185) (MODULE: C2M)
Tahir gave a brief for a full redesign of C2M (4 phases: audit, design system, screen by screen, sign-off) and asked for the pending points to be put to him.
- Phase 1 audit done, read only (3 readers: workflows, calculations, screens against the brief). Findings W1 to W13 and C1 to C10 are in docs 12 (entry of 24 Nov). No broken step in the recipe, price or monthly cost flows; the change record cannot be edited or deleted.
- Rulings, all in D-185 (docs 06): Inter everywhere; 1 colour set (the brief's), the 4 looks dropped; the 4 conflicting layouts (top bar, Approvals desktop and phone, Guide, Costs cards) and 1 Products place ruled on a picture page; pictures first, then each push live when ready (no freeze); a new price row shows the GP change and below target, no new approval rule; the audit fixes go first as their own push. B1 neither; B3b 23.2% stays; B3c freight 0 is right; B3e no tick for Irfan; B4 the check stays; B7 above 12 rows; B8 to Setup; B10 only when newly red; B11 due on the 5th; B12 tab becomes List prices; B14 a Remind button; B15 leave.
- Options not chosen, for the record: font (keep IBM Plex; Inter text with Plex Mono numbers); colours (new set as default keeping 4 looks; keep today's colours); layouts (the brief wins on all 4; earlier rulings stay); timing (pushes from 1 Dec; build with no pictures); B1 (mark and list; list only); B3a (clear; keep); B8 (a Later fold; keep); B11 (merge with the COO check; due on the 7th or 10th); B12 (top bar becomes Price list PDFs; keep); B14 (automatic notice; nothing more); audit fixes (mediums first; record only); price flag (a new approval rule).
- Already in the app, so not to be rebuilt: the client page's 5 tiles, right-aligned numbers, live GP % as a price is typed, the sticky "Send n prices to the COO" bar; the fixed top bar (52 px); the Settings governance pills; the Costs boxes with the 5 month-end steps.
- Next, in this order (Tahir chose the picture page first): (1) the picture page of the redesign (design system, top bar with Products, Approvals desktop and phone, Guide, Costs cards) for his OK; (2) live checks, read only: the 47 re-approval items (B3a), the FY sales drop of 20 Nov (B3d), the holiday box; (3) the audit fixes push (W1 to W5, C1 to C6 at least) with tests, before any design code; (4) the redesign pushes, screen by screen, each with its Guide, docs and tests. The 21 Nov (2) plan sections 3.0, 3.2 to 3.5 and 3.7 are replaced by D-185 where they differ; 3.9 and 3.10 (widths, clean-up) still stand.
- Questions still for Tahir: W9 (correct a labour and FOH certificate after a reopen?), W12 (which change-record entries must carry a reason?).
- Note: CLAUDE.md §3.0 names the folder E:\VAN\VAN Systems\VAN Platform\VAN-OP; on this PC the repo is at E:\VAN Systems (a PLATFORM file, not changed here).

Files changed: docs/06-decisions.md (D-185), docs/12-tests-issues-assumptions.md (entry of 24 Nov), this entry. Not pushed.
- 24 Nov, later: the picture page is published for his ruling: "C2M Redesign Pictures", claude.ai artifact Ao52vAwM7QQLoZuzwZysrP. Part 1 (design system) and part 8 (new price row) are ruled and shown for his eye; parts 2 to 7 wait for A or B (top bar, Approvals desktop, Approvals phone, 1 Products place, Guide, Costs cards), plus 2 small points (Not costed amber or red; the tab names on Approvals if A). No code before his ruling.
- 24 Nov, live checks (Chrome, as Tahir, read only; state built 24 Nov after the 06:04 pull):
  - Holiday box: holidaysReady is true on live (migration 017 seen); 0 holidays entered.
  - B3a: 5 re-approval items are open, 50 pack rows, 49 different packs. Items 1 and 2 (19 Oct, cause "conversion basis changed to the Rs 20 / Rs 30 bands") hold 21 and 26 packs: these are the 47. Item 3 (24 Oct, Amino Acid Powder rate Rs 475 to Rs 480, 1 pack), items 4 and 5 (20 Nov, Genius and Orbit-K packing bill edits, 1 pack each, 0.0% move). In code, the window close (glClose0) writes the approved costs but does not close open re-approval items, so all 5 stay open after 30 Nov unless decided. Waiting for his ruling: clear 1 and 2 with one reason, or the CFO decides.
  - B3d: cause found (figures match; the edit itself not seen field by field). The Approvals sales figure counts only costed sales. O2S name "Max Humic", 8 kg, Maxim Agri: 2 trucks (25 Sept, 7 Oct), 8,000 kg at Rs 154 = Rs 1,232,000, is unmatched since Yawar edited "Max Humic Powder for Maxim Agri" on 20 Nov 10:47 (its O2S names are now only "Max Humic Powder"; a "Max Humic Pellets" product also exists). 267.20M less 1.232M = 265.97M. It sits in Names to settle. Fix is data: settle "Max Humic" to Powder or Pellets. Today: white label FY sales Rs 281.10M in O2S rows, Rs 276.63M matched to a pack, Rs 272.11M costed (the figure shown). So Rs 4.47M is unmatched and Rs 4.52M matched but not costed. Note for B8: Names to settle moves to Setup, yet it holds Rs 4.47M of sales outside the margin figure; ask Tahir whether a count stays on Approvals.

## 24 Nov 2026, later: the audit fixes push is built (D-186) (MODULE: C2M)
Tahir said "Start the fixes" (D-185 point 6).
- Built: W1, W2, W5; W3 and W7 in part; C1 to C6. Details in docs 06 (D-186) and docs 12 (2 entries of 24 Nov).
- On the screen: Take back on a waiting list revision (its sender only); Drop it on a sent-back price or list revision; a withdrawn price says who withdrew it; a price within 0.05 points of target asks no below-target reason, on the New client prices grid, the price panel and the server. Guide jobs and What's changed 2026-11-24a updated.
- Code: c2m-routes.js (new route /lists/revisions/:id/retract; price retract takes sent_back; send backs in a transaction; /products/:id/packs and /full write the re-approval item in the transaction; /full refuses an out-of-use bill; GP target below 100; reapprovePct), c2m-lib.js (round, reapprovePct), c2m-engine.js (blank setting null; a recipe with no lines), c2m.js (tpFor, belowT, lrTake, Drop it, Guide, What's changed).
- Tests: routes-185 (36), page-185 (19); page-184 made to stand on its own. Whole suite 460 pass on this PC. No migration. No change outside apps/c2m.
- Independent review: not ready at first (M1: the New client prices grid without the allowance), fixed with 3 minors; all checks pass after. What the checks do not prove is listed in docs 12.
- Not checked in a browser. After the push: live check as the CFO would see it (Take back on a waiting revision; Drop it on a sent-back price) needs a real waiting item, so read only unless Tahir says.
- Test setup on this PC: XAMPP's MySQL does not start (mysql.db index is corrupt; the same error is in its log on 15 Oct 2026, so it is old). Nothing in C:\xampp was changed. The tests ran on a separate throwaway MariaDB folder in the session scratchpad, port 3307. jsdom 31.0.1 installed with --no-save (node_modules only). Tahir's local van_platform database cannot be reached until XAMPP's MySQL is repaired: tell him.
- Open for Tahir: W3 rest (may a client-packed product carry a packing bill?); W4 (rights of Edit this product); W9; W12; B3a (the 47 packs in re-approval items 1 and 2); the picture page rulings (parts 2 to 7).
- Next: his rulings on the picture page, then the redesign pushes screen by screen.

Files changed: c2m-routes.js, c2m-lib.js, c2m-engine.js, c2m.js, tests/routes-185.test.js (new), tests/page-185.test.js (new), tests/page-184.test.js, tests/README.md, docs 01, 03, 05, 06, 07, 08, 09, 11, 12, this entry. Not pushed. Ready to push.

## 24 Nov 2026, evening: the picture page is ruled and 4 more audit points are built (D-187) (MODULE: C2M)
- Picture page rulings (all in D-187, docs 06): top bar A (7 places, gear, no look dots); Approvals desktop A (4 figures, decisions left in tabs To approve, Stuck with others, To do; chart and news right); phone A (next move first); 1 Products place with a switch; Guide as a card grid with own jobs only; Costs cards A (progress, blocker links, Open button); Not costed amber, red when stuck. Not built.
- Built on his rulings, in the same push as D-186: W3 (a client-packed product may carry a packing bill), W4 (Edit this product needs the matching right for a type or a bill change), W9 (correct a certificate after the COO's reopen), B3a (the window close closes open re-approval items, except one naming a pack left not costed).
- Tests: whole suite 473 pass on this PC. Independent review of the 4 points: ready; 2 minors fixed, 2 recorded (docs 12).
- Not checked in a browser. No migration. No change outside apps/c2m.
- Important for 1 Dec: the window closes after 30 Nov. Push before then, or B3a does not run with the close. On 1 Dec check live which re-approval items stayed open.
- Open for Tahir: W12 (which change-record entries must carry a reason); a new pack's bill on Edit this product (docs 12, minor 4); XAMPP's MySQL repair.
- Next: the redesign, built in pushes on D-185 and D-187: (1) design system (Inter, colours, cards, pills, buttons; the 4 looks removed) with before and after screenshots; (2) top bar and the Products place (needs c2m-access.js navFor); (3) Approvals desktop and phone; (4) Costs cards and Guide; (5) client page, product page, Setup; then the earlier content items (B7, B8, B10, B11, B12, B14). Each with its Guide, docs and tests. Page tests 10b, 10c, 10l and 184 pin today's layout and will need their expectations moved with each push.

Files changed since the last entry: c2m-routes.js, c2m.js, tests/routes-185.test.js, tests/page-185.test.js, tests/README.md, docs 01, 03, 05, 06, 08, 09, 11, 12, this entry. Not pushed. Ready to push.

## 24 Nov 2026, night: redesign push 1, the design system, is built (D-188) (MODULE: C2M)
Tahir said "Start the redesign".
- Built: Inter; 1 colour set; cards with a soft shadow; round tags; filled blue and soft grey buttons; sentence-case headings; the 4 looks removed (top bar dots, Your look in the Guide, the browser key). No layout, word or behaviour changed. What's changed 2026-11-24b.
- Code: c2m.html (font link), c2m.css (:root, the look rules removed, a "Design system, D-185" block at the end), c2m.js (looks removed, What's changed).
- Tests: page-ds (23 new); whole suite 496 pass on this PC.
- Looked at in the built-in browser on a local copy with invented data: Approvals, Costs, a client page at 1366 px; Approvals at 375 px. The rest of the screens were not looked at; nothing on the live site. No independent review of this push yet (docs 12).
- The working tree now holds 3 things not pushed: the audit fixes (D-186), the 4 ruled points (D-187) and this push (D-188). They go live together when Tahir pushes. Push before 30 Nov for B3a.
- How the page was previewed without a database: scratchpad mkpreview.js puts c2m.css, c2m.js and tests/fixture-state.js inside c2m.html with a stand-in for fetch, served by a small local server on port 4599 (session scratchpad, not in the repo). XAMPP's MySQL is still broken.
- Next, in this order: (2) top bar 56 px with 7 places and the gear, and 1 Products place (c2m-access.js navFor; page tests 10b, 10f, 10l pin the bar); (3) Approvals desktop and phone; (4) Costs cards and the Guide grid; (5) client page price row, product page, Setup; (6) 1 filled button per card and the ••• menus on the 7 row clusters; then B7, B8, B10, B11, B12, B14. An independent review of push 1 first.

Files changed since the last entry: c2m.html, c2m.css, c2m.js, tests/page-ds.test.js (new), tests/page-10l.test.js, tests/README.md, docs 03, 06, 07, 08, 12, this entry. Not pushed. Ready to push.

## 24 Nov 2026, late night: redesign push 2, the top bar, built; push 1 reviewed and fixed (D-189) (MODULE: C2M)
- Push 1 review: not ready at first (2 majors: an old !important rule kept card outlines; an armed 2-tap button unreadable under the pointer), fixed with the minors (docs 12).
- Push 2 built: 56 px bar; 7 places for roles that see margin; Setup as a gear and the Guide beside the name; the person pill; Products and Reports fold under More below 1200 px, Price lists below 901 px; phone bar 4 places and More. Guide steps and Find anything no longer say More for Products, Reports, Setup. What's changed 2026-11-24b has a line for it.
- Code: c2m-access.js (navFor), c2m.js (bar, phone4, pth, Guide words, icon gear), c2m.css (2 blocks at the end).
- Tests: page-bar (18 new), page-ds (26); whole suite 517 pass on this PC.
- Looked at in the built-in browser (local copy, invented data) at 5 widths. Not on live. No independent review of push 2 yet.
- The working tree holds D-186, D-187, D-188 and D-189, not pushed. Push before 30 Nov for B3a.
- Next: review push 2; then (3) 1 Products place with a switch (vProducts and the VAN Brands Products tab; U-18 work of 10c lives there; page-10c pins it); (4) Approvals desktop and phone; (5) Costs cards and the Guide grid; (6) client page price row, product page, Setup; (7) 1 filled button per card and the ••• menus; then B7, B8, B10, B11, B12, B14.

Files changed since the last entry: c2m-access.js, c2m.js, c2m.css, tests/page-bar.test.js (new), tests/page-ds.test.js, tests/README.md, docs 03, 06, 07, 08, 11, 12, this entry. Not pushed. Ready to push.

## 24 Nov 2026, last entry of the day: Tahir pushed a4d09b2; push 2 reviewed; pushes 3 (1 Products place) and 4 (Approvals) built and reviewed (D-190, D-191) (MODULE: C2M)
Correction to the entry above: its last line said "Not pushed". Tahir pushed it after that entry, as commit a4d09b2 "CODE CLAUDE PUSH" (D-186 to D-189 together). Live check done, read only: the new bar and look are on the live site (docs 12).
- Push 2 review: ready, 4 minors fixed (More focus, empty pill, "the gear" on a phone, long name).
- Push 3 built (D-190): Products has a switch All, VAN Brands, White label. VAN Brands is the pack table that was under Clients, VAN Brands (needs see.cost). Clients, VAN Brands holds the price lists only, with a link. A role with no Products place keeps the old tab. Not as the picture: no flat table (open point for Tahir).
- Push 4 built (D-191): Approvals for the administrator: 4 figures, the next move, the list in 3 tabs on the wide side, the GP chart and For your information (scrolls in its card) on the narrow side; phone: next move first, GP as 1 line. Other roles unchanged.
- Review of 3 and 4: not ready at first (1 major: a form asked for on Products, VAN Brands did not draw), fixed with 7 minors (docs 12).
- Code: c2m.js (prodKind, prodSwitch, vProducts, vVanProducts, vanTabs, vClients, GOTO.vprod and vtab, navSnap, navBase, navHash, the restore; vToday, homeGrid, jtab, lfApply for the key jobs; What's changed 2026-11-24c), c2m.css (3 blocks at the end).
- Tests: page-prod (24, new), page-appr (21, new), page-bar (21); whole suite 565 pass on this PC.
- Looked at in the built-in browser on the local copy with invented data (docs 12 lists what was and was not looked at). Pushes 3 and 4 are not on live.
- Next: (5) Costs cards (progress, blocker links, Open) and the Guide card grid; (6) client page price row (GP change, below target: reason needed), product page, Setup; (7) 1 filled button per card and the ••• menus; then B7, B8, B10, B11, B12, B14; the Phase 4 sign-off table. On 1 Dec: check which re-approval items stayed open after the window closed (B3a).
- Open for Tahir: flat Products table or not; topic chips with the tabs or tabs only; W12; a new pack on Edit this product with client.add alone.

Files changed since the last entry: c2m.js, c2m.css, tests/page-prod.test.js (new), tests/page-appr.test.js (new), tests/page-bar.test.js, tests/README.md, docs 01, 03, 06, 07, 08, 11, 12, this entry. Not pushed. Ready to push.

## 25 Nov 2026: redesign push 5, the Costs cards and the Guide grid, built and reviewed (D-192) (MODULE: C2M)
- Tahir: "Yes, go on". Built ruling D-187 parts 5 and 6.
- Costs: each card has a line in colour per blocker that opens the part on it (materials with no cost, packs with no packing bill, the next Month end step, changes waiting for Monday), a progress bar on Month end, and its own Open button. Replaces the whole-box button of push 10c.
- Guide: own jobs as cards (place, who, number of steps, Start); a pressed card opens its steps across the row. Place headings gone.
- Review: not ready at first (3 majors), all fixed with 7 minors; 1 minor accepted (docs 12).
- Code: c2m.js (vCosts, costBoxes, noBillPacks, noBillBox, cFocus, the cpart handler, navSnap, navBase, navRestore, goPlace, matTable's Waiting for a rate, vMonthEnd's step anchor, gjRow, gjGroups, vGuide, the Guide job "Update a material, packing, labour or FOH cost", What's changed 2026-11-25a), c2m.css (1 block at the end).
- Tests: page-192 (32, new), page-10c updated; whole suite 597 pass on this PC.
- Pushes 3, 4 and 5 are not on live.
- Next: (6) client page price row (GP change, below target: reason needed), product page, Setup; (7) 1 filled button per card and the ••• menus; then B7, B8, B10, B11, B12, B14; the Phase 4 sign-off table. On 1 Dec: B3a check.
- Open for Tahir: flat Products table or not; topic chips with the tabs or tabs only; W12; a new pack on Edit this product with client.add alone.

Files changed since the last entry: c2m.js, c2m.css, tests/page-192.test.js (new), tests/page-10c.test.js, tests/README.md, docs 01, 03, 06, 07, 08, 11, 12, this entry. Not pushed. Ready to push.

## 25 Nov 2026, later: redesign push 6, the new price row and Names to settle in Setup, built and reviewed (D-193) (MODULE: C2M)
- Tahir: "Yes, go on". Built D-185 part 5 and B8.
- Clients, White Label: columns New price, Rs and After the change: new GP %, the points it moves, "below target: reason needed" (the send bar's rule and rows). Every price still goes to the COO.
- B8: an O2S name with nothing waiting (no sales without cost, no open order) is no longer a job on Approvals; it waits in Setup, Products and variants, count on the tab.
- Product page and Setup looked at for the new look: nothing to change.
- Review: not ready at first (2 majors), fixed with 7 minors (docs 12).
- Code: c2m.js (inCh, r1, ngpAfter, srSay, wlClient, vPrices2's old table, the ncpNp input handler, the phone fold, jobs0 Names to settle, vSetup2 tab count, Guide jobs "Change a client price or a target GP" and "Rename a product or settle an O2S name", What's changed 2026-11-25b), c2m.css (1 block at the end).
- Tests: page-193 (25, new); whole suite 622 pass on this PC.
- Pushes 3 to 6 are not on live.
- Next: (7) 1 filled button per card and the ••• menus on the 7 row clusters; then B7, B10, B11, B12, B14; the Phase 4 sign-off table. On 1 Dec: B3a check.
- Open for Tahir: a name with open orders but no truck stays on Approvals (built so); flat Products table or not; topic chips with the tabs or tabs only; W12; a new pack on Edit this product with client.add alone.

Files changed since the last entry: c2m.js, c2m.css, tests/page-193.test.js (new), tests/README.md, docs 01, 03, 06, 07, 08, 11, 12, this entry. Not pushed. Ready to push.

## 25 Nov 2026, evening: redesign push 7, the ••• menu and 1 filled button per card, built and reviewed (D-194) (MODULE: C2M)
- Tahir: "Yes, go on". Built the ruled design rule for buttons (D-185 part 1).
- Rows with 3 or more buttons (and any row with Delete beside another button): main button plus a ••• menu; Delete red inside, still asks. Applied to Setup Clients, Products and variants, the product page bar, saved reports, packing bills, and Revise a list (1 menu for the 3 lists). Approval panels left (2 buttons each).
- Review: not ready at first (2 majors: the fold memory reopened menus; Guide steps), fixed with 3 minors (docs 12).
- Code: c2m.js (acts, dotsMenu, btnCls, isFilled, isDel, toGhost, rowBtnL; the 6 rows; 3 listeners at the end; 6 Guide jobs; What's changed 2026-11-25c), c2m.css (1 block at the end).
- Tests: page-194 (23, new); whole suite 645 pass on this PC.
- Pushes 3 to 7 are not on live.
- Next: B7, B10, B11, B12, B14; the Phase 4 sign-off table. On 1 Dec: B3a check.
- Open for Tahir: a name with open orders but no truck stays on Approvals (built so); flat Products table or not; topic chips with the tabs or tabs only; W12; a new pack on Edit this product with client.add alone.

Files changed since the last entry: c2m.js, c2m.css, tests/page-194.test.js (new), tests/README.md, docs 01, 03, 06, 07, 08, 11, 12, this entry. Not pushed. Ready to push.

## 26 Nov 2026: B7, B10, B11, B12, B14 built and reviewed (D-195) (MODULE: C2M)
- Tahir: "Yes, go on". Built the 5 remaining content rulings of D-185.
- B7 Find on Approvals above 12 rows. B10 red clients only when newly red (seen list on the server, pruned when a client recovers). B11 rate check due on the 5th, then overdue. B12 Clients, VAN Brands tab is List prices; top bar keeps Price lists. B14 Remind on a stuck recipe: a notice to that step's role, once a day, in the change record.
- Server: 2 new routes in c2m-routes.js (POST /api/c2m/redseen, POST /api/c2m/recipes/:id/remind); state gains redSeen and remindedToday for the administrator. No migration: both use c2m_audit and c2m_notice.
- Review: first reviewer stalled; second: not ready at first (2 majors), fixed with 5 minors; 1 left (docs 12).
- Tests: page-195 (23, new), routes-195 (14, new), page-10b and page-appr moved; whole suite 683 pass on this PC.
- Pushes 3 to 8 are not on live.
- Next: the Phase 4 sign-off table. On 1 Dec: B3a check.
- Open for Tahir: a name with open orders but no truck stays on Approvals (built so); flat Products table or not; topic chips with the tabs or tabs only; W12; a new pack on Edit this product with client.add alone.

Files changed since the last entry: c2m.js, c2m-routes.js, c2m.css, tests/page-195.test.js (new), tests/routes-195.test.js (new), tests/page-10b.test.js, tests/page-appr.test.js, tests/README.md, docs 01, 03, 04, 05, 06, 07, 08, 11, 12, this entry. Not pushed. Ready to push.

## 26 Nov 2026, later: Tahir pushed redesign pushes 3 to 8; live check (MODULE: C2M)
Correction to the entry above: its last line said "Not pushed". Tahir pushed it after that entry.
- Live check, read only, as Tahir, Chrome, 1262 px: the live c2m.js carries D-190 to D-195; the state answers redSeen (null) and remindedToday ([]), so the 2 new routes are deployed. No console errors.
- Approvals: 4 figures (White label GP 18.9% against 21.5%; sales Rs 276.95M; GP Rs 52.34M; 2 recipes stuck, oldest 7 working days); tabs To approve 6, Stuck with others 2, To do 5; chart and news on the right; 13 rows, so the Find box shows. 2 Remind buttons (both recipes with the Plant Manager). Not pressed.
- B10: the job reads "6 white label clients newly red on margin" (all red ones count as new on the first day, as expected). Open margin was not pressed from it, so nothing was marked seen.
- B11: "Check Oct 2026 rates against the purchase register": Overdue 18 working days.
- Products: switch All 80, VAN Brands 29, White label 51; VAN Brands pack table 49 rows. Costs: 3 of 6 need attention (Packing: 5 packs have no packing bill; Month end: next actuals; Freight: not set up). Guide: 38 job cards. Clients, White Label: columns New price, Rs and After the change. Clients, VAN Brands: "List prices of the VAN brands".
- What's changed opened on its own and still shows the entries since 24 Nov: left open, Got it not pressed.
- Not looked at on live: a phone, another person, pressing Remind, Open margin from the job, a ••• menu.
- Next: the Phase 4 sign-off table. On 1 Dec: B3a check.

## 26 Nov 2026, evening: Phase 4 sign-off done; 1 layout fix (MODULE: C2M)
- Tahir: "Yes, go on". The release and readiness sign-off of the brief, table in docs 12 (entry of 26 Nov, Phase 4).
- Maths: pass (server formulas untouched by the redesign; page and server formulas equal on 20,000 cases; cost rollup proven).
- Workflows: pass with 2 gaps (rate change to re-approval item; placing an O2S name: not run end to end). New end-to-end test routes-p4 (35).
- Layout: live at 1262 px, 30 views: no sideways page, no clipped text, bar fixed 56 px, tabular figures. 2 lists scrolled inside their box (Material cost 37 px, Products and variants 51 px): fixed in c2m.css (checked on live data in Claude's own tab, nothing saved). Local copy at 375 px: clean.
- Code: c2m.css (1 block), c2m.js (What's changed 2026-11-26a only). Tests: routes-p4 (new), page-194 (+1). Whole suite 719 pass.
- Next: on 1 Dec, B3a (which re-approval items stayed open after the window closed). The 2 workflow gaps could get their own end-to-end tests.
- Open for Tahir: a name with open orders but no truck stays on Approvals (built so); flat Products table or not; topic chips with the tabs or tabs only; W12; a new pack on Edit this product with client.add alone.

Files changed since the last entry: c2m.css, c2m.js, tests/routes-p4.test.js (new), tests/page-194.test.js, tests/README.md, docs 03, 07, 08, 12, this entry (and the live check entry above, not pushed). Not pushed. Ready to push.

## 26 Nov 2026, late: the 2 workflow gaps closed (MODULE: C2M)
- Tahir: "Yes, add them". routes-p4 gains section 5 (a rate change through urgent approval to a re-approval item, decided, new cost Rs 132) and section 6 (an unmatched O2S name settled, its trucks costed). 58 checks; whole suite 742 pass.
- No app code changed. Found: the CFO decides re-approvals (by the access model), so the test says so.
- Next: on 1 Dec, B3a.

Files changed since the last entry: tests/routes-p4.test.js, tests/README.md, docs 12, this entry. Not pushed. Ready to push (with the entries above).

## 26 Nov 2026, night: Tahir pushed 275113f; live check (MODULE: C2M)
Correction to the 3 entries above: they said "Not pushed". Tahir pushed them as 275113f.
- Live, read only, as Tahir, 1262 px: c2m.css carries the Phase 4 fix and c2m.js the change list 2026-11-26a. Costs, Material cost fits (1111 of 1111 px); Setup, Products and variants fits (all 3 boxes); no sideways page.
- Next: on 1 Dec, B3a (which re-approval items stayed open after the go-live window closed). Open for Tahir: a name with open orders but no truck stays on Approvals (built so); flat Products table or not; topic chips with the tabs or tabs only; W12; a new pack on Edit this product with client.add alone.

## RESUME HERE (26 Nov 2026, night): state, what is due, every open question (MODULE: C2M)
Start the next chat by reading this entry. It replaces the RESUME HERE of 23 Nov 2026 (most of its questions are ruled: D-185, D-187). The detail of each push is in the dated entries above and in docs 06 (D-185 to D-195) and docs 12.

### A. Where things stand
- Live and pushed: everything up to commit 275113f (26 Nov 2026), checked live, read only, as Tahir. After it, only this entry and the 1 above are unpushed.
- The redesign of the brief of 23 Nov 2026 is complete and live: design system (D-188), top bar (D-189), 1 Products place (D-190), Approvals (D-191), Costs cards and Guide cards (D-192), new price row and Names to settle in Setup (D-193), the ••• menu and 1 filled button per card (D-194), B7, B10, B11, B12, B14 (D-195).
- Phase 4 sign-off: done; the table is in docs 12 (entries of 26 Nov). Maths: pass. Workflows: pass, no gap left (routes-p4, 58 checks). Layout: pass after 1 fix (live at 1262 px, 30 views; local copy at 375 px).
- Tests: apps/c2m/tests, 742 checks, all pass on this PC (Node 24.21, jsdom 31.0.1 installed with --no-save, MariaDB 10.4.32). Run: `node apps/c2m/tests/run.js` with C2M_TEST_DB=throwaway and C2M_TEST_DATABASE_URL=mysql://root:@127.0.0.1:3307/c2m_test, against a throwaway MariaDB started from the XAMPP binaries on port 3307 with its own data folder (the session scratchpad held it; a new session must make a new one). XAMPP's own MySQL does not start (mysql.db index corrupt since 15 Oct 2026); nothing in C:\xampp was changed.
- No migration is waiting: D-186 to D-195 need none. The 2 routes of D-195 use c2m_audit and c2m_notice.
- Go-live window: ends 30 Nov 2026.

### B. Due
- 1 Dec 2026, Claude, read only: B3a. Check on live which re-approval items stayed open after the window closed (the rule of D-187: every open item is closed with a line in the change record, except one that names a pack left not costed). Report the list to Tahir.
- First day after this push: the COO's Approvals shows "6 white label clients newly red" once (nothing was marked seen before; Claude's assumption, docs 12). Open margin from that job marks them seen.

### C. Open questions for Tahir (ask in 1 panel round when he wants; none blocks anything)
1. Products (D-190): keep the list by client and the pack table, or build the flat table of the picture (Product, Owner, Packs, Cost today, State)?
2. Approvals (D-191): the topic chips sit above the 3 tabs. Keep both, or tabs only?
3. Names to settle (D-193): a name with open O2S orders but no truck yet stays on Approvals (built so, because the orders will ship with no cost). Right?
4. Clients, White Label (D-193): the brand column is narrower with the new After the change column (131 px at 1262 px). Fine?
5. W12: which change-record entries must carry a reason (bill save, pack bill move, freight, labour and FOH pick, product type, direct settings, actuals and checks, pending drop, price approval, target refusal)?
6. Edit this product: may a person with client.add alone add a new pack with a packing bill (docs 12, minor 4 of the review of 24 Nov)?

### D. Open audit items, all low (docs 12, entries of 24 Nov; none blocks a release)
- W6 the CFO seed has recipe.start but not recipe.edit or recipe.step.draft (live role ticks: Not confirmed). W7 in part (pending "later", urgent approve, holidays, grants write the record outside the transaction). W8 import "correct": 2 presses can save twice. W10 deleting a product drops its decided target requests from the record. W11 a VAN pack with no list price makes no job. W13 a dated-ahead freight row is checked only within 7 days.
- C7 silent fallbacks (packs per outer 0 to 1; NaN cost part to 0). C8 FED mode letter case (what O2S writes: Not confirmed). C9 possible double freight on Dealer or Farmer products (Not confirmed; freight rates are 0 for now). C10 docs only.
- Left from the reviews of this session: 2 Remind presses at the same moment could both send (D-195); a Guide card opened mid-row leaves space beside it (D-192); the tabs of Approvals have no arrow keys (D-191).

### E. Outside C2M (needs a declared MODULE: PLATFORM session, not C2M)
- CLAUDE.md §3.0 still describes the state of 28 Sept and mentions PD; it could point to this entry for C2M.
- docs/SECURITY-REGISTER.md: nothing new from this session.

### F. How to work here (what held this session)
- Pictures first, Tahir's ruling, then code. Every push: Guide, What's changed and docs 01 to 12 in the same change; a page or route test; an independent review before "ready to push"; Claude never pushes. This file is append only: re-read it from disk before writing, never rebuild it.
- Live checks are read only as Tahir. Never press Got it on What's changed, Remind, or Open margin from the red job; never save.

## 26 Nov 2026, late night: design audit as Yawar, Majid, Himayat and Fahim (MODULE: C2M)
- Tahir asked for an audit of forms, tables, text, alignment and design through the 4 people's eyes. Done read only on live (role set in the page, every save blocked). Findings in docs 12, entry of this date.
- Short: 16 font sizes, 12 button heights, 8 box heights, 8 corner radii; table text top while buttons middle; 4 lists scroll inside their box; Costs and Price lists 7 px off; name chip shows 1 letter for the plant roles; Today repeats itself; material card form uneven.
- No code changed. Next: Tahir gives more feedback, then pictures of 1 set of sizes for every table, form and page head, then his OK, then code.

Files changed: docs 12, this entry. Not pushed. Ready to push.

## 26 Nov 2026, late night (2): the website's look; a dash in After the change (MODULE: C2M)
- Website read (4 pages): warm canvas #F7F4EE, ink #171A16 (partner page navy #0E3550), amber #C88A2E, emerald #2D5A3C, Fraunces headings, Public Sans text, pill buttons. C2M uses none of it (cool grey, blue #2563EB, Inter). Detail and the open choice in docs 12.
- Tahir's pasted brief: built the dash in an empty After the change (2026-11-26b). Not built: the sticky bar and the Setup gear (both already there), "Standard" against "Needs COO" (every price goes to the COO). The test names in the brief do not exist here. Suite 742 pass.
- Next: Tahir's feedback, then pictures of C2M in the website's colours and fonts with 1 set of sizes, then his OK, then code.

Files changed since the last entry: c2m.js, c2m.css, tests/page-193.test.js, docs 03, 06, 07, 08, 12, this entry. Not pushed. Ready to push.

## 26 Nov 2026, night (3): D-196 built, C2M in the VAN look (MODULE: C2M)
- Tahir: "Main site look", then "Yes, build it" on the pictures (C2M in the VAN look; scratchpad prev/look.html, not in the repo).
- Built: the website's colours (canvas #F7F4EE, ink #171A16, amber, emerald, brick) and fonts (Fraunces titles, Public Sans text); 1 set of sizes (type 12, 14, 16, 22, 30; buttons and boxes 36 px, 32 px in rows; 40 px on a phone); light top bar with the open place underlined, the name in full; table text in the middle of the row, heads in small capitals; no list with its own scroll bar; the same left edge everywhere; Clients' switch under the title; the facts line beside Help; Today for the 3 plant roles and the CFO without repeats; Packing cost rows with •••; Inputs values without the repeated state; Required on the label line. What's changed 2026-11-26c; Guide step "See what waits for you" 3.
- Not built (docs 06, D-196): 1 Save on the material card; the help beside that form; a recipe from Recipes lighting Products. The COO's Approvals list unchanged.
- Checks: local copy at 1280 px and 375 px for Yawar, Majid, Himayat, Fahim (role set in the page); on live data, read only, the new styles laid over in Claude's own tab. Independent review: 10 points, all fixed or noted (docs 12). Tests: page-196 (new, 40), page-ds, page-10b, page-193 changed; whole suite 783 pass on the throwaway database.
- Next: Tahir pushes; Claude checks live, read only, as each role where possible. Then Tahir's own feedback. On 1 Dec: B3a.

Files changed since the last entry: c2m.css, c2m.html (fonts), c2m.js, tests/page-196.test.js (new), tests/page-ds.test.js, tests/page-10b.test.js, tests/README.md, docs 03, 06, 07, 08, 12, this entry. Not pushed. Ready to push (with the 3 entries above).

## 26 Nov 2026, evening (4): D-196 live check; D-196b (MODULE: C2M)
- Tahir pushed D-196 as 135a4a0 ("major changes"; it also carried apps/o2s/OP-HANDOFF-O2S.md, his own). Render served it at once.
- Live check, read only (docs 12): every place for the COO and the 4 roles (set in Claude's own tab) has the same title edge, no inner scroll, no 3-button rows, no sideways scroll. Margin and Today seen by eye.
- Found on live as the QC Head, fixed as D-196b: "Nothing needs you today." twice on Today; the With others and Read notices lines without padding. What's changed 2026-11-26d. Tests: page-196 now 45; whole suite 788 pass on the throwaway database. Independent review: 1 bug (a gap before a comma in a folding line), fixed; the end-line test made stronger.
- Next: Tahir pushes D-196b; then his own feedback. On 1 Dec: B3a. Still waiting for a ruling: 1 Save on the material card, its help beside the form, a recipe from Recipes lighting Products.

Files changed since the last entry: c2m.css, c2m.js, tests/page-196.test.js, tests/README.md, docs 03, 06, 07, 08, 12, this entry. Not pushed. Ready to push.

## 26 Nov 2026, evening (5): D-196b live (MODULE: C2M)
- Tahir pushed D-196b as 25040f9. Live check, read only: Today for the QC Head says "Nothing needs you today." once; the With others line is a full row. Details in docs 12.
- Open, small: the COO's With others line says "the CFO" and "CFO" for 1 role. Not built.
- The working tree also shows apps/o2s/tests/batch1119d.test.js changed; not from this session, not touched.
- Next: Tahir's own feedback. On 1 Dec: B3a. Still waiting for a ruling: 1 Save on the material card, its help beside the form, a recipe from Recipes lighting Products.

Files changed since the last entry: docs 12, this entry. Not pushed. Ready to push.

## 26 Nov 2026, evening (6): D-196c, With others counts each role once; What's changed back in order (MODULE: C2M)
- Tahir: "Yes, fix it" (the COO's With others line said "5 with the CFO, 1 with CFO"). Recipe lines now say "with the <role>", like every other line. What's changed 2026-11-26e.
- Independent review found an older fault, fixed in the same change: What's changed must run newest last, but since 24c entries were added at the top, so the login box never showed 24c to 26e to anyone who had pressed Got it on 24b. CHANGELOG is now sorted by version when the page loads. Expect: at their next visit each person sees the box once, the newest 5 entries for their job. Also: 26c and 26e now reach every role (were administrator only); "version 2 is with the QC Head".
- Tests: page-196 now 51; whole suite 794 pass on the throwaway database. Docs 03, 06, 07, 08, 12.
- Next: Tahir pushes; Claude checks live, read only (the With others line; the login box shows once). Then Tahir's feedback. On 1 Dec: B3a.

Files changed since the last entry: c2m.js, tests/page-196.test.js, tests/README.md, docs 03, 06, 07, 08, 12, this entry. Not pushed. Ready to push.
