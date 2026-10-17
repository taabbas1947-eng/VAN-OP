# 8. Release notes and change log

Version 1.2 · 16 Oct 2026 · Owner: Claude records; Tahir approves releases · Rule: R-5h item 8 (D-20)
Changed in 0.5.0: entry 0.5.0 added; real figures removed from earlier entries (public repo).
Format: Keep a Changelog, semantic versions. None of these versions is live.

## [0.5.0] · 16 Oct 2026 · fixes from the 4 pre-handover reviews (code, data safety, design, workflow) · Who: Claude built, Tahir approves
### Changed: folders and data safety
- The loader moved to `C2M App/loader/load-import-pack.js` and the tests to `C2M App/tests/` (run-all.js, lib.test.js, flow.test.js). Both stay on Tahir's PC, outside apps/c2m, because they hold or read confidential figures and need the local harness.
- apps/c2m goes to VAN's public repo: no real cost, price, rate, budget, volume, GP % or band value stays in its code, comments or documentation. Worked examples use made-up figures, marked "(example figures)". A confidential scan in tests/run-all.js fails the run if a figure from the import pack, the B2B prices, the budget or the packing list appears in apps/c2m.
### Changed: platform mount
- c2m-routes refuses to start without the platform's mysql2 promise pool (transactions and the 409 guards depend on it). Closes I-09.
- A startup check reads a date: if the pool does not return dates as text (dateStrings), every /api/c2m request gets 503 with a plain message for IT.
- Every query runs as a prepared statement (pool.execute); lists use 1 placeholder per value.
### Changed: dated approvals (D-34)
- Only 1 approved price may wait for its date per pack. A newer approval cancels the waiting one (change record "cancelled"); the approve reply is {ok, waitsUntil, cancelled}.
- Tahir can withdraw a waiting price: POST /api/c2m/prices/:id/withdraw {why}. Today's price stays in force.
- Price proposals carry validFrom, shown as "Takes effect from".
- Only 1 list revision may wait per list. A new revision of that list is refused while one waits. Tahir can withdraw it: POST /api/c2m/lists/revisions/:id/withdraw {why}. The approve reply is {ok, waitsUntil}.
- Waiting revisions apply on the first load of C2M on or after their date (applyDueRevisions); the change record says "applied", once.
- A price document dated ahead shows the prices in force on that date: waiting list revisions applied over today's rows, and the client prices in force on that date. With no date typed, a client list takes the client's own latest price date; a VAN list takes its own list dates.
### Changed: rates and cost (confirms 0.4.0)
- Rate order (is_base): rates Yawar adds beat the base bands; within a level more conditions first, then newest (D-37).
- Contribution floor includes labour (D-36). Freight inwards is out of FOH (D-38). Reprocessed flag per product (D-30).
### Fixed
- PDF: footer and "page n of N" on every page, no blank last page, heading band sized to its text.
- O2S pull lock frees itself after 10 minutes, so a crashed pull does not block the next one.
- 1 open target request per product.
- Change record keeps before-values for packing bills, freight, monthly actuals and checks. Re-approval writes "cost moved since shown" when the cost moved after the item was shown.
- Monthly actuals compare with the setting conv_budget_month, not fixed text. Closes I-05.
### Changed: screens
- Tahir's re-approvals are under "For your information" on Today, not counted as jobs. Closes I-08.
- Flags read "slightly below target" (within the red gap) or "N pts below target, small Rs".
- Restated history view labelled "restated at today's labour and FOH rates".
- "Sign out" link in the header.
### Migrations to run
- 001_c2m_core.sql changed before any live run: budget_gp, ambition_gp and wl_budget_gp start at 0 (were budget figures); new setting conv_budget_month, starting at 0. The first load sets all 4. Settings are now 9 rows.
### Tables touched
- c2m_setting (default rows only). Columns added in 0.5.0: c2m_price.cut_price_id and cut_prev_to (second review round); is_base and applied came in 0.4.0. Still 39 tables.
### What to test after
- npm test: lib.test 40 passed, flow.test 57 passed, confidential.scan 1 passed, migration.sync 1 passed; TOTAL 99 passed, 0 failed (after the final review round).

### Second review round (same day, before handover)
- "Valid till" (valid_to) is the last day a client price applies. A new price ends the old one the day before it starts. Proposals cannot start in the past; approval is refused if the valid till would come before the start.
- An approval dated ahead remembers the price it shortened (new columns c2m_price.cut_price_id, cut_prev_to). Withdraw or cancel puts that end date back exactly and records "end restored". Statuses "cancelled" and "withdrawn" replace "replaced" for these cases.
- Withdrawing a waiting price or list revision notifies Yawar, and names any price list already issued with it.
- 1 open target request per product, now locked so 2 quick clicks cannot open 2.
- A list revision is applied on its date only while still approved; withdraw is locked.
- A wrong mount (no pool) no longer stops the platform: C2M answers 503 with the reason. The date check is awaited, retried, covers DATE and DATETIME, and checks both pdq and the pool.
- Price list PDF: notes and signature kept together above the footer; phone number kept on 1 line; a new price shows "new" in place of "+0.0%".
- KAM preview shows the dates of the list he is looking at. Waiting price card handles packs with no price. Revisions waiting for their date always show, however old.
- Confidential scan widened: whole-number prices written as Rs, VAN list prices, budget GP, client and brand names. Migration comments no longer name a client.
- Final review round: a VAN list revision cannot start in the past; a revision with no end date never leaves an end before its start (on the list and on PDFs dated ahead); a lock clash between 2 people answers "someone else changed this" (409) instead of a crash; a cancelled waiting price names the price lists issued with it; Yawar can set "valid till" on a proposal; a preview dated ahead warns that the PDF uses the prices of that date; the first-load script says "load saved" if only the final O2S pull fails.
- Test run: 99 passed, 0 failed.

## [0.4.0] · 16 Oct 2026 · Tahir's rulings on the 5 reviews (Design Record 5j) · Who: Claude built, Tahir approves
### Changed
- Rate order: rates Yawar adds beat the base bands (new column is_base); among his own rates more conditions first, then newest (D-37).
- Band split into labour and FOH from the budget, with freight inwards taken out of the FOH pool first (D-38).
- Reprocessed flag loaded for the 5 products Tahir named (D-30).
- Red flag uses red_share_pct (1% of all white label sales in the period) in place of red_rs (D-31).
- Approved prices and VAN list revisions dated ahead wait for their date; the screen shows what is waiting (D-34). Price selection is by date in force (new column c2m_list_revision.applied).
- Contribution floor adds the labour rate (D-36).
### Added
- Margin: switch between past trucks at the cost approved on their date and restated at today's bands; the method change is shown as its own effect, and in each product drill-down (D-35).
- Tahir's Today: recipes stuck more than 2 working days; re-approvals for his information; re-approval details read only on Recipes (D-33).
- Queue item: repack rate for traded goods (D-39). In-app Guide updated for Yawar and Tahir.
### Migrations to run
- 001_c2m_core.sql changed before any live run: c2m_conversion_rule.is_base, c2m_list_revision.applied, setting red_share_pct replaces red_rs.
### What to test after
- npm test: 90 passed, 0 failed (16 Oct 2026).

## [0.3.1] · 16 Oct 2026 · fixes from the 5 reviews (local, not live) · Who: Claude built, Tahir approves
### Fixed: data and access
- KAM data leak closed: cost and margin are never sent to a KAM; farmer columns go only by grant; settings go only to Yawar and Tahir; documents are limited by role (viewer: 07 and 11; production, qc, plant: 01, 07, 11). Rule R-2 People and rights. Test B-02.
- White label PDF is dated from its own approved prices; VAN list PDF is dated from its own list's dates. D-14.
### Fixed: rates and re-approval
- Future-dated labour and FOH rates are refused. D-25. Test B-03.
- A retire that leaves a pack with no labour or no FOH rate is refused, and cost approval checks the same. D-25. Tests B-03, R-07.
- List rates keep their form filter (formOk on every level). D-25. Test B-03.
- Pack range checked: numbers above 0, "from" below "below". Test B-03.
- An empty "approve ticked" is refused. Test B-01.
- Re-batch after a dismiss: packs still moved for another cause make a new re-approval item. R-2 Cost.
- A class change keeps the old class and nutrient values in the change record. D-23.
- An MRP-only list revision keeps the last price change (prev only moves when the price itself changes). D-28.
- More writes run in 1 transaction (rate, packing price, packing bill, assignment, rules, product type, reprocessed, materials, nutrients, class, price propose, list revise and approve, price documents).
### Fixed: the load (then apps/c2m/seed/load-import-pack.js; moved to C2M App/loader in 0.5.0)
- Honest load: the 13 Oct approved cost is Yawar's sheet; the move to the bands waits in 1 re-approval item for the change of conversion basis. A-19. Test B-01.
- The bands start 13 Oct. A-15.
- Inner liners matched by the pack's own size first. D-26.
- Material classes corrected: gypsum, Plaster of Paris, POP and calcium hydroxide are "Calcium and sulphur source". A-17.
- Product types from budget V9 lines. A-16.
### Changed: margin
- Forward kg leaves out kg already on open POs. D-15, D-27.
- The reprocessed flag can be set (Back Office, Products and packing). D-25.
### Changed: interface
- Back Office sections in a word row instead of a sidebar.
- 2-step approvals (press, then "Confirm: ...").
- Reason boxes inline, under the item.
- Messages announced to screen readers; errors in red.
- Names in the header; dates in words.
- "Rs at stake" wording on the margin board.
- Customers sorted by severity, with a gap column; a concentration line; a note for no-volume packs below cost.
- Materials: classes grouped, a Save class button, "Blank fields are 0".
- Tables show as cards on a phone.
- List revision table shows Now and the change %; discount typed as %.
- New Back Office section "Sheet against C2M".
### Documentation
- System documentation 1.1: 04 has all 39 tables with columns, keys and indexes and a full ER diagram; 05 has every route and 1 errors section; 01 to 03 have the new flows, data flows, states and decision tables; 07 matches the app's Guide and adds the 0.3.0 jobs; 09, 10, 11, 12 updated. Every section carries version, owner and rule.
### Tables touched
- None changed in 0.3.1. The schema stays as 0.3.0 (39 tables).
### Migrations to run
- 001_c2m_core.sql only (nothing is live).
### What to test after
- npm test: 86 passed, 0 failed (16 Oct 2026). Then click through as each of the 6 people, on a desktop and a phone.

## [0.3.0] · 16 Oct 2026 · Tahir's rulings on the review questions (local, not live)
### Changed
- Conversion = 1 labour rate + 1 FOH rate per product (D-25). The base bands are split into labour and FOH; Yawar adds named rates and assigns each to all products, a form, a product type or a list of products; saved rates apply by themselves and moved costs go to re-approval. Yawar's per-product figures are no longer loaded.
- Client-packed products carry VAN's named inner liner or seal (D-26).
- Forward exposure has a switch: budget kg or last 3 months (D-27).
### Added
- Himayat's Materials screen: class and nutrient % per grade, a to-do filter, a Today job (D-23).
- Non-nutrient material classes: binder, filler, anti-caking agent, wetting agent or adjuvant, colour, pH adjuster. They count in weight and cost, add 0 to the nutrient analysis, and never show "to enter". The recipe's analysis lists them, flags blank fields and unclassified inputs.
- Product types (budget V9 production lines), settable per product.
- VAN brand list revisions: propose, send back, resend, approve; the list's previous prices and dates update (D-28).
- Phone layout for jobs, approvals, price lists and forms (D-24).
### Migrations to run
- 001_c2m_core.sql changed again before any live run: c2m_material_type.nutrient_role, c2m_conversion_rule.kind, new tables c2m_conversion_rule_product and c2m_list_revision.
### What to test after
- npm test: 83 passed, 0 failed (16 Oct 2026).

## [0.2.0] · 16 Oct 2026 · fixes from the 3 reviews (local, not live)
### Changed
- Pakistan time (Asia/Karachi) for every date and time C2M writes.
- Transactions and "someone else changed this" (409) guards on every approval and step: recipe steps, re-approvals, prices, settings, targets, import queue.
- Re-approvals go only to Yawar and Tahir (they carry cost). Approve per pack, or close as "the rate was wrong" with a reason.
- Packing bill edit, packing bill assignment, a new or retired conversion rule, and an import rate correction now send moved costs for re-approval. A packing bill is checked before anything changes.
- Import queue: a rate correction passes the rate controls (digits only, 10% warning). A note item records the decision only.
- Prices: 1 price waiting for Tahir per pack; effective and valid-till dates; previous price taken when Tahir approves. Tahir's card shows cost, GP, target, floor and Rs over the forward kg.
- Price list documents: numbered by C2M (VAN/PL/year/number) and saved with their rows, so a reprint shows what was issued. A KAM cannot set notes, dates or reasons; the grant is checked again on download. KAMs receive only granted lists.
- Cost approval is blocked while a material has no rate.
- Conversion rule tie on the same date: the narrower pack range wins, then the newest.
- Front end: Bearer token from the platform (van_token), PDF saved as a file, sign-out clears the token, "no target" grey, locked-in per PO line, forward kg basis shown, revision due only when the price is older than 30 days, version-in-progress cost compare, packing bill lines under the recipe, O2S age, sales C2M could not place.
### Added
- Forms: new material or grade with rate; nutrient % per grade; customer price rule, cycle, region and O2S names; freight per segment and region; retire a conversion rule.
- Loader rewritten (then apps/c2m/seed/load-import-pack.js; now C2M App/loader): reads the import pack outside apps/; --wipe-local only on a local c2m_dev or c2m_test; --production inserts only and refuses if C2M holds products; 1 transaction; never writes app_state; dated cost versions from Yawar's snapshots; only genuine packing bills; exact budget targets and budget kg; every B2B tab's prices.
- harness/load-o2s-standin.js writes the local O2S stand-in (local only).
- .gitignore keeps the import pack and the local database out of git.
### Fixed
- The FED queue item was wrong (the PO price it named is already net); removed. F-10 example corrected.
### Migrations to run
- 001_c2m_core.sql changed before any live run: c2m_source.what 150, c2m_list_grant.grant_value 100 (keys fit 767 bytes), ROW_FORMAT=DYNAMIC, c2m_client_product.budget_kg_year, c2m_price_doc.fields_json LONGTEXT. Nothing is live, so no 002 is needed.
### What to test after
- npm test: 75 passed, 0 failed (16 Oct 2026).

## [0.1.0] · 16 Oct 2026 · first build (local, not live)
### Added
- Module apps/c2m: page (c2m.html), routes (c2m-routes.js), formulas (c2m-lib.js), cost engine (c2m-engine.js), O2S reader (c2m-o2s.js), price list PDFs (c2m-pricelist.js).
- Migration 001_c2m_core.sql: 37 c2m_ tables (39 from 0.3.0).
- Screens: Today, Margin, Recipes, Rates, Prices, Price lists, Back Office (11 sections incl. System documentation), Guide.
- Day-1 load from Yawar's Master Cost Sheet (63 of 64 recipes rebuild his cost to the rupee), packing list, B2B prices, VAN lists of 11 Oct, O2S export of 13 Oct.
- Tests: lib.test.js (formulas), flow.test.js (every flow as each role). Now in C2M App/tests, outside apps/c2m (0.5.0).
### Migrations to run
- 001_c2m_core.sql (local: npm run migrate; production: by hand, see C2M Go Live Plan.md).
### What to test after
- npm test (builds c2m_test and runs everything); then click through as each of the 6 people.
