# OP-HANDOFF-C2M · session log (append-only, CLAUDE.md §4.1 rules)

C2M (Cost to Margin): cost, recipes, prices and margin for every client pack. App key `c2m`, page `/c2m`,
API `/api/c2m/*`, tables `c2m_*`. Built by the collaborator (v0.5, 15–16 Oct 2026) in
`VAN Platform\Cost and Pricing\C2M App\`; its 12 documents are in `docs/`. The platform part (mount, roles,
own pool) is in `OP-HANDOFF-PLATFORM.md`, entries of 17 Oct 2026.

## 17 Oct 2026 — Step 3: C2M brought into the repo and tested locally with real data (MODULE: C2M) — NOT PUSHED

- **Into the repo:** only `apps/c2m/` from the collaborator's folder (21 files: page, routes, engine, lib,
  o2s, pricelist, logo, 12 docs, migration `001_c2m_core.sql` + `.PRODUCTION.sql`). Checked first: no customer
  prices, costs or client names; money figures in comments and docs are made-up examples, plus the base band
  rule ("Rs 20 / Rs 30") and the Rs 10 price floor. **Not brought in, never to be:** `loader/` (real customer
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
