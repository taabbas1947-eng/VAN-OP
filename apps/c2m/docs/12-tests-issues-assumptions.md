# 12. Tests, issues and assumptions

Version 1.0.3 · 20 Oct 2026 · Owner: Claude records; Tahir and Yawar confirm assumptions · Rule: R-5h item 12 (D-20)
Changed in the next version (21 Oct 2026; piece 1 of 4 after Tahir's rulings D-89 to D-95; the version number is set at the push; 1.0.3 is live): 12.1e added: tests for the roles change (piece 1) run against a test database; known limits for it in 12.3. The earlier suites c2m100 to c2m103 could not be run in the session that built it: run them before the push.
Changed in 1.0.3 (20 Oct 2026; 1.0.2 went live on 20 Oct at 11:24): 12.1d added: suite c2m103.test (M-01 to M-07) and the tests changed for D-87; totals 221, after the 7 review rounds 229 (M-08 to M-15); known limits in 12.3; the 1.0.3 reviews in 12.4.
Changed in 1.0.2 (19 Oct 2026; review fixes 20 Oct): 12.1c added: suite c2m102.test (X-01 to X-17) and the tests changed for D-85; totals 203; known limits for product names in 12.3; the 1.0.2 review in 12.4.
Changed in 1.0.1 (19 Oct 2026): 12.1b added: suite c2m101.test (W-01 to W-07) and the tests changed for D-80 to D-82; totals 198; I-39, I-40, I-41 and I-45 closed (D-81, D-84, D-80); the 1.0.1 review in 12.4.
Changed in 1.0.0 (19 Oct 2026): suite c2m100.test (T-01 to T-18); lib J-01, J-02; ui08, ui09, flow and van093 changed for the 5 places; ui09 V-05, V-06, V-08, V-18, V-19 retired; I-39 to I-44 added; totals in 12.1a; the 1.0.0 review in 12.4.
Changed in 0.9.3 (19 Oct 2026): suite van093.test (L-01 to L-07); ui09 V-11 counts 3 ready reports; totals 176; I-27 done (D-73); the review of 0.9.3 in 12.4.
Changed in 0.9.2 (19 Oct 2026): ui09 V-19; suite fix092.test (K-01 to K-04); lib F-10 at FED 6%; totals 169; I-27 changed by D-70; I-38 added (FED and past PO prices); the FED review in 12.4.
Changed in 0.9.1 (3 independent reviews, 18 Oct 2026 night): suite fix091.test (N-01 to N-07); ui09 V-16 to V-18; totals 163 and last run; A-21 done as a comment edit; the 3 reviews in 12.4.
Changed in 0.9.1 (documentation review, 18 Oct 2026): van07 Z-01 to Z-08 and flow W-01 to W-07 counted right; run list names all 6 suites; flow A-01 for 8 places; the run after D-59; I-14 and I-16 fixed; A-07 superseded; A-19, A-20 brought up to date; I-29 to I-37 and A-21 to A-24 added (Tahir to confirm where marked); known limits for the confidential scan; the documentation review in 12.4.
Changed in 0.9.0: suite ui09.test (V-01 to V-15); the 0.9.0 review in 12.4; 2 known limits in 12.3; ui08 U-01 to U-05, U-08 and flow A-01 changed for 8 places and the new tabs; totals and last run.
Changed in 0.8.0: suite ui08.test (U-01 to U-11); van07 Z-07 and Z-08; A-01 and H-01 changed for the 0.8.0 places; totals and last run; the 0.8.0 review in 12.4.
Changed in 0.7.0: suite van07.test (Z-01 to Z-06); totals and last run; I-17 closed; I-25 to I-28.
Changed in 0.6.0: suite fix06.test (Y-01 to Y-08); totals and last run; I-17 to I-24; the 18 Oct review in 12.4.
Changed in 0.5.0: tests moved to C2M App/tests (outside apps/c2m); new suites confidential.scan and migration.sync; flow tests V-02, V-03, W-01 to W-03; last run recorded; real figures removed from the assumptions (public repo); I-05, I-08, I-09 fixed; I-14 to I-16 added.
Changed in 0.3.1: test ranges and last run; shipped items moved out of "not built"; assumptions and open issues in 1 table with owner, date and status; A-04, A-17 corrected; A-19 added; review reports with fix status.

## 12.1 Tests

Run `npm test` (or `node tests/run-all.js`) from the C2M App folder on Tahir's PC. The tests and the loader live there, outside apps/c2m, because they hold or read confidential figures and need the local harness; they do not go to the public repo. The run builds a fresh test database (c2m_test), runs the migration, writes the O2S stand-in, loads day-1 data with `loader/load-import-pack.js --wipe-local`, runs lib.test, van07.test, flow.test, fix06.test, ui08.test and ui09.test, then the confidential scan and the migration sync check. flow.test.js refuses any database but c2m_test. Owner of the tests: Claude; Tahir reviews.

| Suite | Ids | What they prove | Count |
|---|---|---|---|
| lib.test.js | F-01 to F-18 | Formulas in 09 (rate warning, materials, recipe total, packing, rate choice and order, cost, margin, target price, floor with labour, FED, re-approval, exposure, flags, recipe chain, Pakistan time, labour + FOH) | 41 |
| flow.test.js | A-01 to A-04 | Access: screens by role (0.9.0: Yawar and Tahir 8 places with Reports, Himayat 4 with Inputs), no role refused, Himayat no cost, KAM only granted lists | 4 |
| | B-01 to B-03 | 0.3.1 review fixes: 13 Oct cost = sheet and 1 re-approval item; empty "approve ticked" refused; KAM data leak closed; settings and documents by role; rate dates, pack range, list form filter, last rate kept | 3 |
| | C-01 to C-03 | Costs rebuild Yawar's sheet; packing per kg; trucks at the cost on their date | 3 |
| | R-01 to R-07 | Recipe chain, 1 in progress, send back, resend to sender, cost approval | 7 |
| | P-01 to P-05 | Rates: source, warning, try, re-approval approve all, Tahir cannot save | 5 |
| | PR-01 to PR-02 | Prices: below target reason; propose, send back, resend, approve | 2 |
| | S-01 to S-02 | Threshold waits for Tahir; budget line with notice; target override | 2 |
| | I-01 | Import queue accept and correct; rate correction through rate controls | 1 |
| | L-01 to L-02 | Price list PDF; grants | 2 |
| | M-01 | Monthly actuals; rate check by a second person | 1 |
| | O-01 | O2S pull reads app_state and never changes it | 1 |
| | D-01 | 12 documentation sections served; Majid refused 04 | 1 |
| | G-01 to G-10 | 2 people at once; re-approvals only to Yawar and Tahir; KAM lists; 1 price per pack, dates, prev price; documents as issued; packing bill checks; rule retire; 1 pull at a time (lock frees after 10 minutes); master data forms; loader guards | 10 |
| | H-01 to H-02 | Himayat's Inputs, Materials (D-23, D-48); non-nutrient inputs; class change (also proves F-17) | 2 |
| | Q-01 to Q-02 | Labour and FOH rate on a list of products; inner liners on client-packed products | 2 |
| | V-01 to V-03 | VAN list revision: propose, send back, resend, approve; approvals dated ahead wait (list revision and client price); reprocessed band and floor with labour | 3 |
| | W-01 to W-07 | A newer approval cancels the waiting price, a waiting price can be withdrawn (D-34); a waiting list revision blocks a new one, can be withdrawn, a PDF dated ahead shows the future prices (D-34); a wrong mount answers 503 and does not take the platform down (B-07); "valid till" is the last day a price applies (W-04, D-22); withdrawing a waiting price puts back the end date it had shortened (W-05, D-34); 2 quick clicks open only 1 target request (W-06, B-08); a list revision cannot start in the past and never leaves an end before its start (W-07, D-34) | 7 |
| | X-01 | Every change is in the change record | 1 |
| fix06.test.js | Y-01 to Y-08 | 0.6.0 fixes: a pack is costed only when complete (packing, labour and FOH) and cost approval waits for it (D-40); a pack of an inactive product does not break rate saves or pricing; re-approval from the approved cost and checked again on approval (D-41); dealer discount kept on resend; distributor previous price and "new" (D-42); a material's first rate; a Rs 0 material rate; no price proposed for a pack that is not costed, including one whose recipe is not in C2M; a Rs 0 labour or FOH rate; distributor previous price = last list sent; a first approved cost through a re-approval item. Made-up names and figures (Fix06 ...) | 20 |
| ui08.test.js | U-01 to U-12 | 0.8.0 screens (D-45 to D-52), run in a DOM (jsdom) on the real page against the local harness, as each person: the places of each role, each with its topic and 1 answer line (U-01); every sub-view of Prices, Inputs and Setup, with no id used twice (U-02); the product page with its 4 tabs for a white label, a VAN brand and a not-costed product, and the filters (U-03); every Today job opens its own panel on Today, Close and Escape shut it (U-04); no approve, send back, accept or step button outside a panel for any person, on any place, sub-view, product page tab or recipe (U-05); a price approved end to end in Tahir's panel (U-06); 1 materials table, no rate for Himayat (U-07); no old place named in the page or the server's messages, phone tabs at the bottom (U-08); a sent-back price revised in a panel opened from Prices sends the typed price (U-09); a VAN list revision sent back in a panel opened from Prices, and no form left behind after a tab click (U-10); Himayat receives no rate, cost or price, and Yawar enters or corrects a month from Setup in a panel (U-11); the keyboard stays in a panel (header and screen behind inert, Tab and Shift+Tab kept in, focus kept after a save) (U-12). Against the code before the review fixes, U-05 and U-08 to U-11 fail, as they should | 12 |
| ui09.test.js | V-01 to V-19 | 0.9.0 screens (D-53 to D-58), in a DOM (jsdom) on the real page against the local harness: the rail and its groups by role (V-01); Find anything (V-02); Today's next move, groups, counts and ages (V-03); stuck after more than 2 working days, Sunday skipped (V-04); Margin figures, trend and stake tabs (V-05); the customer working table, chips, search, totals, Columns and a real .xlsx (V-06); the product page waterfall, pack table, price history, sales and step dates (V-07); Prices list, tab counts, the propose panel, reason required, send (V-08); Tahir's approval panel (V-09); recipe review nutrient % and working, no Rs for Himayat (V-10); Reports (3 ready from 0.9.3), the bridge adding up, the PO lines, both exports (V-11); the price list preview and its PDF (V-12); the new state fields to Yawar and Tahir only (V-13); the phone bar and More (V-14); price history keeps a price a newer one replaced, and leaves out a replaced sent-back proposal (V-15) 0.9.1 (D-65, D-62): the propose panel follows the typed price without redrawing the box, warns below today's price, shows dates in words (V-16); a cost-moving change waits for Save and Cancel drops it (V-17); Margin carries the cost basis line, the new labels and GP on cost today (V-18). Owner Claude; rules D-53 to D-58, D-62, D-65; last result 18 passed, 18 Oct 2026 night. 0.9.2 (D-68): By customer opens on All clients with a state on every pack, the worst first, counts matching (V-19) | 19 |
| fix091.test.js | N-01 to N-07 (6 checks; N-06 runs inside N-02) | 0.9.1 fixes from the 3 reviews: a truck counts only with its gate pass (N-01, D-60); approve ticked only leaves the rest in a new item (N-02, D-61); Tahir is told of a new labour rate (N-06, D-63); FOC lines out of sales and open POs (N-03, D-62); an ended price leaves no price (N-04, D-62); the proposer cannot approve (N-05, D-63); the monthly checks need their figures (N-07, D-64). Owner Claude; last result 6 passed, 18 Oct 2026 night | 6 |
| fix092.test.js | K-01 to K-04 | FED, the only tax on VAN, as 1 setting (D-72): the load adds FED 5% and every role gets it (K-01); a FED change needs Tahir, above 0 and below 100, and works again the price with FED on every distributor and dealer row (K-02); a document keeps its FED % and its words name FED only (K-03); an O2S pull divides FED-inclusive prices by (1 + FED %) (K-04). Puts FED back to 5 at the end | 4 |
| van093.test.js | L-01 to L-07 | VAN brand list margin (D-73): only Yawar links, only to an active VAN brand pack, whole-number ids, at most 500, all or nothing, unlink, audit, a KAM never gets the link (L-01, B-18); suggestions only on the same name, size and unit, near names, other units and % refused, marked and counted by Save (L-02); every price, cost per pack and GP on the page against F-22 for all 3 farmer lists, colour and state, the worst first, the worked example (L-03); the answer line with the portfolio GP worked out from the trucks, the counts and the worst pack, Tahir reads only (L-04); 2 rows on 1 pack, a pack not costed, no ambition GP, an inactive pack (L-05); Save sends hidden changes (L-06); Export to Excel (L-07) | 7 |
| van07.test.js | Z-01 to Z-08 | 0.7.0 ruling 8 (D-44): 1 product per VAN pack; all 47 sheet packs loaded with Yawar's VAN Brands figures; materials and packing rebuild his sheet; the matching in every channel; the sale keeps buyer, channel and region; no per-pack price for a VAN pack; 1 band-move item and the queue questions; a split product's pack, a sale by a client that buys in 2 channels, the dealer's region. Runs right after the load, before flow.test | 8 |
| confidential.scan (in run-all.js) | | No figure from the import pack, the B2B prices, the budget or the packing list appears anywhere in apps/c2m | 1 |
| migration.sync (in run-all.js) | | 001_c2m_core.PRODUCTION.sql is 001_c2m_core.sql with the database line in front | 1 |

Totals: 176 checks (41 lib, 8 van07, 57 flow, 20 fix06, 12 ui08, 19 ui09, 6 fix091, 4 fix092, 7 van093, 1 confidential scan, 1 migration sync), after 0.9.3.
Last run, 19 Oct 2026, after 0.9.3 (VAN brand list margin, D-73), on a fresh c2m_test in the cloud copy: lib 41, van07 8, flow 57, fix06 20, ui08 12, ui09 19, fix091 6, fix092 4, van093 7 passed; confidential scan and migration sync passed. TOTAL 176 passed, 0 failed.
Last run, 19 Oct 2026, after 0.9.2 with the FED setting (D-72), on a fresh c2m_test in the cloud copy: lib 41, van07 8, flow 57, fix06 20, ui08 12, ui09 19, fix091 6, fix092 4 passed; confidential scan and migration sync passed. TOTAL 169 passed, 0 failed.
Last run, 18 Oct 2026 night, after 0.9.1, on a fresh c2m_test in the cloud copy (MariaDB 10.11): lib.test 40 passed; van07.test 8 passed; flow.test 57 passed; fix06.test 20 passed; ui08.test 12 passed; ui09.test 18 passed; fix091.test 6 passed; confidential.scan 1 passed (730 figures checked; now also the base band values); migration.sync 1 passed. TOTAL 163 passed, 0 failed. To run again on Tahir's PC before the push. Note for test writers: in jsdom, document.body.textContent includes the page's own script, so a screen text check reads main, not body.
Last run, 18 Oct 2026, after 0.9.0, on a fresh c2m_test: lib.test 40 passed; van07.test 8 passed; flow.test 57 passed; fix06.test 20 passed; ui08.test 12 passed; ui09.test 15 passed; confidential.scan 1 passed (730 figures checked); migration.sync 1 passed. TOTAL 154 passed, 0 failed (after the review fixes). After D-59 (folder tabs, built after the 0.9.0 push) only ui08.test (12) and ui09.test (15) were run again: 27 passed; the full run of 154 is from before D-59.
Rule proved by each test: lib tests carry the F- id they prove (09); the rule of each flow, fix06, van07, ui08 and ui09 group is in the "What they prove" column; a result per test is not recorded, only per suite (I-37).
Run after 0.8.0 (the screen redesign and its review fixes), on a fresh c2m_test: lib.test 40 passed; van07.test 8 passed; flow.test 57 passed; fix06.test 20 passed; ui08.test 12 passed; confidential.scan 1 passed (730 figures checked); migration.sync 1 passed; TOTAL 139 passed, 0 failed, 0 crashed.
Run after 0.7.0 (ruling 8 and the VAN brand load), on a fresh c2m_test: lib.test 40 passed; van07.test 7 passed; flow.test 57 passed; fix06.test 20 passed; confidential.scan 1 passed (730 figures checked, VAN names included); migration.sync 1 passed; TOTAL 126 passed, 0 failed, 0 crashed.
Run after the 0.6.0 fixes, on a fresh c2m_test (MariaDB 10.6 in the desktop app's Linux workspace, running a copy of the C2M App harness with apps/c2m taken from the VAN Systems repo): lib.test 40 passed; flow.test 57 passed; fix06.test 20 passed; confidential.scan 1 passed; migration.sync 1 passed; TOTAL 119 passed, 0 failed, 0 crashed. fix06 run against the 0.5.0 code: 19 of 20 fail there, as they should (Y-01c proves kept behaviour).
Earlier run, 16 Oct 2026, after the 0.5.0 documentation change: lib.test 40 passed, 0 failed; flow.test 53 passed, 0 failed; confidential.scan 1 passed, 0 failed (280 figures checked); migration.sync 1 passed, 0 failed; TOTAL 95 passed, 0 failed, 0 crashed. Run from a copy of tests/run-all.js with the I-16 line break put back, because the file itself does not start.
Not tested by automation: the PDF's look by eye, the 2-step buttons, and the figures of the page's flag() and exposure() (I-31). Panels, keyboard, places, the phone bar and the PDF's content are tested in ui08 and ui09 (U-04, U-12, V-12, V-14); the rest is checked by clicking through as each person.

## 12.1a Tests in 1.0.0 (owner: Claude records; version 1.0.0, 19 Oct 2026)

| Suite | Ids | What they prove | Count | Rule |
|---|---|---|---|---|
| lib.test.js | J-01, J-02 | Buyer line by O2S category; target fallback | 2 | D-74, D-75 |
| c2m100.test.js | T-01 | Every sale, FOC, open PO and PO line has a category; COBO, VGreen, farmers 1 line each; a buyer in 2 places split by what it bought | 1 | D-74 |
| | T-02, T-13 | A revision adds a row only for a VAN pack not on the list; refused cases; approval writes it with its pack and FED; farmer row named with its size | 2 | D-77 |
| | T-03 | A product with no target takes the company GP target on screen and in the proposal check | 1 | D-75 |
| | T-04 to T-07 | Margin answer, figures and totals against sums worked out from the trucks; sort; groupings; chips; search; Columns; Excel; basis line; restated; drill; pooled line not named | 4 | D-79, D-74 |
| | T-08, T-09 | Client prices: chips by sales; GP, price for target and state per pack; type, live GP, no send without reason, 1 proposal; Tahir opens it in the panel and approves | 2 | D-78 |
| | T-10 | VAN grid: each pack once, 5 columns, GP under each price; unchanged value not sent; 1 revision per list with the added row | 1 | D-77 |
| | T-11, T-12 | Setup tabs and labels; no white label budget; other roles unchanged; More places open; no target figure in the page | 2 | D-75, D-76 |
| | T-14 to T-17 | Review findings fixed: a sent-back revision with an added row is revised and resent; no second row for a pack through a waiting add; an added distributor row is never sent; a new price replaces the sent-back one; waiting prices are the picked client's | 4 | D-77, D-78, D-42 |

Changed for the 5 places: flow A-01; ui08 U-01 to U-05, U-06, U-09 to U-12; ui09 V-01, V-07, V-11, V-12, V-14, V-16; van093 (Reports under More). Retired with the screens they tested: ui09 V-05, V-06 (0.9.0 Margin; now T-04 to T-07), V-08, V-19 (0.9.0 Prices; now T-08 to T-10; the propose panel is still V-16), V-18 (0.9.0 Margin wording; the GP bridge stays in V-11).

Last run (cloud copy, 19 Oct 2026, after all review fixes): TOTAL 191 passed, 0 failed (lib 43, van07 8, flow 57, fix06 20, ui08 12, ui09 14, fix091 6, fix092 4, van093 7, c2m100 18, confidential scan 1, migration sync 1). T-18 proves the second-review fixes; flow S-01 now expects the company GP target to wait for Tahir; van093 L-05 expects a 2nd row on 1 pack to be refused. fix06 Y-05 reads the resend form key in its new form (an added row is keyed p<packId>).

## 12.1b Tests in 1.0.1 (owner: Claude records; version 1.0.1, 19 Oct 2026)

| Suite | Ids | What they prove | Count | Rule |
|---|---|---|---|---|
| c2m101.test.js | W-01 | The links route: only Yawar marks; bad input refused; a linked row and a row that names a C2M pack refused; the mark names who and when; audited; the same mark is no change; Undo and a link (also {packId, noPack:false}) take it out, and the link record says so | 1 | D-80, B-24 |
| | W-02 | A row with no pack blocks an added pack; 1 marked of 2 still blocks; both marked: the add is taken; Undo refused while it waits; the marked rows stay on the list; a marked row that names the pack blocks its add | 1 | D-80, I-43 |
| | W-03 | Grid Not placed: a pick and the mark per row; the pick offers only packs not on the list; a mark moves the row to Marked with who and Undo; a pick saves its link; Tahir sees no button; Undo puts it back | 1 | D-80 |
| | W-04 | Report: a marked row is not counted as having no pack; mark and Undo in the links table; Excel says "Not a C2M pack" and has the target column | 1 | D-80, D-81 |
| | W-05 | Margin left-out line worked out from the trucks for White label, All sales, Distributors and COBO: whole lines with their reason, partly left out lines with counts; no figures | 1 | D-83 |
| | W-06 | Tahir's revision panel and the list under the grid name the marked rows when a revision adds a pack; "Change prices of marked rows" holds only marked rows and sends 1 revision | 1 | D-80 |
| | W-07 | A pick left from before never re-links a row no longer in Not placed; a mark clears a hidden report pick | 1 | D-80 |

Changed: ui08 U-03 and ui09 V-07 (3 product tabs, History lists every recipe step, D-82); van093 L-03 (each pack against its own target, else the company target; the Target % column), L-04 (portfolio against targets weighted by sales; no "ambition" in the answer), L-05 (the ambition GP no longer moves the report) (D-81); c2m100 T-10 reads the grid table only (the Not placed table is a table too).

Last run (cloud copy, 19 Oct 2026, after the 1.0.1 review fixes): TOTAL 198 passed, 0 failed (lib 43, van07 8, flow 57, fix06 20, ui08 12, ui09 14, fix091 6, fix092 4, van093 7, c2m100 18, c2m101 7, confidential scan 1, migration sync 1).

## 12.1c Tests in 1.0.2 (owner: Claude records; version 1.0.2, 19 Oct 2026)

| Suite | Ids | What they prove | Count | Rule |
|---|---|---|---|---|
| c2m102.test.js | X-01 | A link renames the row to the official name with the pack as C2M writes it, keeps the old name, logs "renamed from"; the product column follows; an unlink gives the old name back; Tahir links; production and the KAM cannot; Tahir cannot mark | 1 | D-85, D-80 |
| | X-02 | Rename linked rows: every linked row under another name renamed, logged with the name before; pressed again nothing changes; every linked row carries its official name | 1 | D-85 |
| | X-03 | Tahir and Yawar edit an official name and spellings; its rows follow; empty, sign \|, over 120, a name of another product, spellings over 120, not a list, a name of another product of the same size refused; logged; last change shown | 1 | D-85, B-26 |
| | X-04 | An O2S name C2M cannot place is kept as a spelling; its trucks are costed at once; the O2S line is not changed; the same spelling again is no change; the official name matches with no spelling | 1 | D-85 |
| | X-05 | Setup, Product names: the row in Names to settle with the guess preselected; Rename and link; Rename linked rows in 2 steps; Edit and Save; Tahir sees no mark button; no page error | 1 | D-85 |
| | X-06 | Review 1.0.2: a save on names someone changed since is refused (409), nothing saved; the names shown are required; a link from an out-of-date screen is refused (409) | 1 | D-85 |
| | X-07 | Review 1.0.2: a rename keeps the name before as a spelling and its trucks keep their cost; removing a spelling that carries trucks is counted first (trucks, Rs, first date) and refused without the counts seen; with them, saved and logged with trucks and Rs | 1 | D-85, B-26 |
| | X-08 | Tahir 20 Oct 2026: 2 products share a trade name when their pack sizes differ; with a pack size in common refused, the name as written | 1 | D-85, B-26 |
| | X-09 | Review 1.0.2: after a rename, the mark on a row under the name before is refused (every name of the product checked) | 1 | D-80, D-85 |
| | X-10 | Review 1.0.2: an open revision shows today's names; an added pack takes its row under the official name of the day it takes effect | 1 | D-77, D-85 |
| | X-12 | Re-check: every pick offers a row whose size can be read only packs of that size and unit; a row with no size every pack | 1 | D-85 |
| | X-13 | Re-check: 2 products sharing a trade name each keep just that name as their spelling | 1 | D-85, B-26 |
| | X-14 | D-86: a product is taken out of use and put back (trucks shown first; refused while linked; nothing deleted; logged; the button on screen) | 1 | D-86 |
| | X-15 | D-86: 500 ml, 250 g under 1 L or 1 kg; 1 L and 25 kg above; a 500 ml list row names a 0.5 L pack | 1 | D-86 |
| | X-16 | Re-check 2: the server refuses a link to another size; out of use refused with a recipe in the workflow; a name of a product out of use refused as a spelling; a revision cannot add, nor Tahir approve, a pack out of use; open order lines counted in the check | 1 | D-85, D-86 |
| | X-17 | Re-check 3: Rename never renames a row linked to another size (listed with Unlink); Edit refuses a name of a product out of use; no recipe version for a product out of use; a draft blocks out of use | 1 | D-85, D-86 |
| | X-11 | Review 1.0.2 screens: a row with no size can be picked; removing a spelling shows the trucks before saving, nothing saved without Save anyway; Tahir picks under Not placed with no mark button; Names to settle on Approvals opens in a panel and leads to Product names | 1 | D-85 |

Changed: ui08 U-02 and c2m100 T-11 (11 Setup tabs); van093 L-01 (Tahir links from 1.0.2), L-03 and L-06 (the longer link toast), L-04 (Tahir links, no mark button), L-06 (picks a pack free on the list); c2m102 X-03 to X-05 (the names shown, the check before saving, the pack size); c2m101 freeRows (freed rows written with no size); van093 L-06 (picks a pack the select offers); c2m101 freeRows (renames the rows it frees to names no pack has, since a linked row now carries its official name).

Last run (cloud copy, 20 Oct 2026, 1.0.1 with 1.0.2 after the review and re-check fixes): TOTAL 215 passed, 0 failed (c2m102 17). Before review (19 Oct): TOTAL 203 passed, 0 failed (lib 43, van07 8, flow 57, fix06 20, ui08 12, ui09 14, fix091 6, fix092 4, van093 7, c2m100 18, c2m101 7, c2m102 5, confidential scan 1, migration sync 1).

## 12.1d Tests in 1.0.3 (owner: Claude records; version 1.0.3, 20 Oct 2026)

| Suite | Ids | What they prove | Count | Rule |
|---|---|---|---|---|
| c2m103.test.js | M-01 | The plan reads only (no row or change record written); Yawar and Tahir only (production and KAM 403); every open row in exactly 1 group, every row linked or in a group; a name with a % matched loosely to its pack; "05 KG" and "5 Kg" rows are 1 name; a row with no size goes to the product's only pack; an unknown name waits; 2 rows on 1 pack wait with their prices; spec and size guess; counts worked out in the test | 1 | D-87, B-27 |
| | M-02 | The screen, as Yawar: counts in the answer line; Carry over disabled while a name waits; "Not in C2M" moves the rows to the leaving list; the 2-row choice with prices marks the row not kept; a row with no pack of its size offers packs of its size only | 1 | D-87 |
| | M-03 | Refusals: no plan (400), not ready (400), production (403), a plan not the one seen (409, nothing saved), a revision open (400) | 1 | D-87 |
| | M-04 | 2 people press Carry over at once: 1 saved, 1 refused (409); every row has its master pack and no mark; official name and the name before kept; the row not kept and the unknown row moved to _old with prices and why; change record (carried once, each row left, each link); never twice; a KAM never sees a row that left nor a pack id | 1 | D-87 |
| | M-05 | The lists in master order under official names (3 lists); a rename made straight in the database prints at once, in the state and the issued document; the issued distributor list sets prev by pack | 1 | D-42, D-87 |
| | M-06 | After the carry-over: unlink and mark refused; a move to a pack of the same size renames the row; a pack is added by a revision; no carry-over button or job on any screen | 1 | D-87 |
| | M-07 | (was van093 L-06) The report moves a price to another pack: no "Not linked" choice; a hidden change is counted and saved | 1 | D-87 |
| | M-08 | Review 1.0.3: 2 rows already linked to 1 pack are a choice; a row with no pack of its size waits and leaves only when chosen; stale picks dropped and named (200); a sent-back revision shown and closed at the carry, Yawar told; official names with brackets flagged | 1 | D-87, D-88 |
| | M-09 | D-88: take off a list: production and KAM 403; a reason needed; refused while a revision holds the row; 409 on another pack shown; off the list, visible with who and why, never printed; Yawar told; prices in the change record; a row off a list is read only and cannot be taken off twice; the product can then go out of use; the button and box on the grid; Off the lists | 1 | D-88, B-28 |
| | M-11 | Re-check: a move refused while a revision holds the row, then allowed with a notice naming both products; a price typed for a row moved meanwhile refused (409); a pack coming back brings its FRP and discount, shown to Tahir, and is back with them after approval; 2 lists in 1 go with 1 notice; a product with no description prints none | 1 | D-87, D-88 |
| | M-12 | Third check: closed revisions on the state; packAt on each row; a resend after a move refused (409); "new" while moved, the previous price back when moved back; prices that came back marked and shown to Tahir as not typed; a list held by a revision cannot be ticked in the take-off box; "Closed at the carry-over" on the page | 1 | D-87, D-88 |
| | M-10 | D-88: the description: a changed one since is refused (409); edited, printed on the lists, logged. A revision on a row that left: approval refused, sending refused. 2 rows swap packs in 1 save; 1 alone refused with the swap advice | 1 | D-87, D-88 |
| | M-13 | Fourth check: a pack brought back takes the FRP of the row taken off last, not a duplicate dropped at the carry-over or an older row; "Revise and resend" after a move fills nothing for the moved row, says why, and sends the price typed for the pack it is on now (packAt the new pack); prices that came back are not filled in and stay marked after the resend; 6 moves in 1 save told in notices of 400 characters or less, every move whole | 1 | D-87, D-88 |
| | M-14 | Fifth check: a distributor pack brought back keeps the price distributors last saw (shown to Tahir; printed after approval, not "new"); a list dated ahead issued while the pack waits for its date sets that previous price (no second increase); a resend whose added pack got a row meanwhile shows it once, names it in the notes above the form with what was typed, and fills nothing in on that row; the moved-row note names the pack the price was typed for | 1 | D-42, D-87, D-88 |
| | M-15 | Seventh check (runs before the carry-over): issuing a distributor list sets the previous price of a row linked to a pack to the price printed | 1 | D-42 |

Changed for D-87: c2m100 T-02 and c2m101 W-02 (the refusal words); c2m101 W-03, W-04, W-07 (no Not placed, mark or picks on the screens; Carry into the master offered), W-06 (no revision of marked rows); c2m102 X-05, X-11, X-12, X-17 (Product names keeps names only; the carry-over panel and screen; row picks of the row's size; a row linked to another size is carried again); van093 L-02 to L-05 (the report links no row by row; suggestions saved by route in the test), L-06 moved to c2m103 M-07; run-all runs c2m103 last.

Last run (cloud copy, 20 Oct 2026, 1.0.3 after the review fixes): TOTAL 229 passed, 0 failed (lib 43, van07 8, flow 57, fix06 20, ui08 12, ui09 14, fix091 6, fix092 4, van093 6, c2m100 18, c2m101 7, c2m102 17, c2m103 15, confidential scan 1, migration sync 1). Before review: 221; after round 1: 224; after round 2: 225; after round 3: 226; after round 4: 227; after round 5: 228; after round 6: 228 (M-13 and M-14 changed); after round 7: 229. A price typed to add a pack against a row moved onto it at the same moment, run 15 times here and 27 times by the fifth reviewer: never both saved. A race of a move against a price typed for the same row, run 8 times: never both saved. Changed after review: c2m100 T-18 (the swap advice), c2m102 X-12 (a stale row pick is dropped and named; only packs of the name's product).

## 12.2 Assumptions and open issues (1 table)

A-xx: assumptions decided overnight 15 to 16 Oct under Tahir's instruction "decide, log as assumption", to be confirmed. I-xx: open issues. Status: open, confirmed, superseded, fixed. The figures behind each assumption are in the Design Record and Yawar's sheets, not here (public repo).

| No | Item | Owner (confirms or fixes) | Date | Status |
|---|---|---|---|---|
| A-01 | Recipes imported from Yawar's live cost sheet load as approved (version 1). Only those that do not rebuild his total wait with Majid. 1 import queue item asks Yawar to confirm them under his name. | Tahir, Yawar | 16 Oct 2026 | open |
| A-02 | Superseded by D-25: the base bands with named labour and FOH rates. Yawar's per-product figures are listed in a queue item for reference. | Tahir | 16 Oct 2026 | superseded |
| A-03 | Only 3 packing bills are itemised, the ones Yawar's own formulas show (a bag with a carton per 2 bags; a bag with an inner; an inner alone). Every other VAN-packed pack carries 1 placeholder piece "Packing to itemise", 1 queue item per client. | Yawar | 16 Oct 2026 | open |
| A-04 | Dated cost versions load from Yawar's snapshots of 30 Jun, 10 Aug and 25 Sep 2026 plus his 13 Oct sheet. A truck carries the cost in force on its date. Trucks before 30 Jun use the earliest. | Yawar | 16 Oct 2026 | open |
| A-05 | White label prices: approved prices from every B2B tab, dated from the tab where it carries a date; tabs with no date are dated 25 Sep and queued. A row for 1 pack size applies only to that pack. Other packs use the latest O2S PO price. | Yawar | 16 Oct 2026 | open |
| A-06 | Price rules: 1 client time-based monthly, 1 client per PO (ruled); all other white label clients left "to set". | Yawar | 16 Oct 2026 | open |
| A-07 | Superseded by D-44 (0.7.0): the first load reads Yawar's VAN Brands tab and gives 45 VAN packs his figures as the approved cost; the packs still with no cost are in I-28. (Was: VAN brand products carry no cost until their recipes are imported; D-32.) | Tahir | 16 Oct 2026; updated 18 Oct 2026 | superseded |
| A-08 | Freight: none loaded (figures are Yawar's). Delivered prices carry 0. | Yawar | 16 Oct 2026 | open |
| A-09 | Forward exposure: budget kg a year / 12 x forward_months (shared across a product's packs by kg shipped), or the last 91 days' run rate; a switch on the Margin screen picks the basis and is not saved (D-27). Forward kg leaves out kg already on open POs. Locked-in uses each open PO line at its own price. | Tahir | 16 Oct 2026 | open |
| A-10 | The monthly second-person rate check is done by Tahir (coo role). | Tahir | 16 Oct 2026 | open |
| A-11 | KAM Punjab is an example person with 2 VAN lists and 1 client's monthly list (local data only). | Yawar | 16 Oct 2026 | open |
| A-12 | Packing for a pack size with no own column in Yawar's sheet uses the same per-kg figure as the column that exists (placeholder until itemised). Listed in 1 queue item per client. | Yawar | 16 Oct 2026 | open |
| A-13 | Target GP = the product's budget GP; the company budget GP where the budget has no line; 1 product left blank. No target and no budget shows grey "no target", never green. | Yawar | 16 Oct 2026 | open |
| A-14 | Superseded by D-26: client-packed products keep VAN's named inner liner or seal. Each liner is matched to the pack's own size first (0.3.1); a liner made for another size is marked "check". Packs whose figure matches no liner stay placeholders, queued. | Yawar | 16 Oct 2026 | superseded |
| A-15 | The base bands are split into labour and FOH by the budget: budget labour against budget FOH less freight inwards (D-38). A queue item asks Yawar for the real split. | Yawar | 16 Oct 2026 | open |
| A-16 | Product types are the production lines of the budget. Guessed for 4 products with no budget row. Yawar can change any product's type. | Yawar | 16 Oct 2026 | open |
| A-17 | Material classes set at load from the names (corrected in 0.3.1): gypsum, Plaster of Paris, POP, calcium hydroxide = calcium and sulphur source (Ca%, S%); starch, granulation agent, bentonite = binder; talc, fly ash = filler; fume silica = anti-caking; dyes = colour; citric acid, NaOH = pH adjuster; MEA = nitrogen source; amino acid, poultry mud, press mud, molasses = organic source. Himayat confirms or changes each on his screen. | Himayat | 16 Oct 2026 | open |
| A-18 | Trucks before 13 Oct keep Yawar's snapshot costs. From 13 Oct the approved cost is his sheet until he approves the move to the bands (A-19); today's cost, forward exposure and price screens already use the bands. | Tahir | 16 Oct 2026 | open |
| A-19 | The 13 Oct approved cost is Yawar's sheet. The move to the bands waits in 2 re-approval items (white label packs; VAN brand packs, D-44) for the packs that move more than 3%. | Yawar | 16 Oct 2026; updated 18 Oct 2026 | open |
| A-20 | The budget lines (budget_gp, ambition_gp, wl_budget_gp, conv_budget_month) start at 0 in migration 001. The first load now sets them from budget V9; Yawar confirms or corrects each on 19 Oct (Monday checklist). | Yawar | 16 Oct 2026; updated 18 Oct 2026 | open until Yawar confirms |
| A-21 | Migration 001 is live and frozen (04, 4.1). Its comments held the base band values and a packing item example, which must not be in the public repo. Done in 0.9.1 as a comment-only edit to both files (no schema change; the live database is not touched; the sync check passes). Tahir to confirm, or to revert and wait for 002. | Tahir to confirm | 18 Oct 2026 | done, to confirm |
| A-22 | D-02: the platform rule "cost is out" is to be updated for C2M at go-live. C2M tables went live on 17 Oct; whether the platform edit is done is for Tahir to confirm. | Tahir to confirm | 18 Oct 2026 | open |
| A-23 | Version numbers. The folder tabs (D-59) were built after the 0.9.0 push and ship in 0.9.1 with the review fixes; the 12 unbuilt reports are built after their pictures are approved (no version number fixed; 0.9.2 became the By customer state, D-68); the product page tab change of 0.9.0 has no decision number of its own. Tahir to confirm this numbering and whether the tab change needs its own decision. | Tahir to confirm | 18 Oct 2026 | open |
| A-24 | Staff names in the public repo: the documents name Yawar, Majid, Himayat, Fahim and Tahir, and the price list PDF signs with 2 full names (D-58). The project rules (C2M App CLAUDE.md, rule 1) list staff names among what stays outside the repo. Tahir to confirm that first names in public documents are acceptable. | Tahir to confirm | 18 Oct 2026 | open |
| I-01 | Escalation, due dates, stand in and away are not built (not ruled). The stuck flag on Tahir's Today is built (D-33). | Tahir | 16 Oct 2026 | open |
| I-02 | Batch kg produced (for the absorbed labour and FOH) waits for the O2S batch link. | Tahir | 16 Oct 2026 | open |
| I-03 | O2S has no invoices: a sale is a truck out x PO price; many truck dates are keying dates (29 to 31 Jul). | Tahir | 16 Oct 2026 | open |
| I-04 | 1 client product's materials cost sits above Yawar's sheet because his client tab types 1 material rate differently (queue item; a data fix for Yawar). | Yawar | 16 Oct 2026 | open |
| I-05 | The budget figure on Monthly actuals was fixed text. Now the setting conv_budget_month (0.5.0). | Claude | 16 Oct 2026 | fixed |
| I-06 | Units kg against L: density is not used; liquids are costed per L (queue item). | Yawar | 16 Oct 2026 | open |
| I-07 | The app's Guide screen (GUIDE in c2m.html) carries part of the newer jobs (rates, list revisions, Sheet against C2M, Tahir's information items) but not all the "Also" items in 07. Next code change. | Claude | 16 Oct 2026 | open |
| I-08 | Tahir now sees open re-approval items under "For your information" on Today and read only on Recipes (0.4.0, D-33). | Tahir | 16 Oct 2026 | fixed |
| I-09 | C2M now refuses to start without the platform pool, so transactions always run (0.5.0, test W-03). The platform must pass pool and set dateStrings (Go Live Plan). | Tahir (PLATFORM edit) | 16 Oct 2026 | fixed |
| I-10 | Test names: the lib test "F-03 rule tie on the same date" proves F-05; lib test F-06 still sums the sheet conversion, while B-01 proves the band cost. Rename and add a band case. | Claude | 16 Oct 2026 | open |
| I-11 | Enforcement in R-5h (a test that fails when a rule or table has no documentation entry) is not built. | Claude | 16 Oct 2026 | open |
| I-12 | c2m_variant and c2m_client_product.density exist but no screen uses them. | Yawar | 16 Oct 2026 | open |
| I-13 | Built in 0.3.0 (no longer "not built"): VAN brand list revisions, phone layout, Himayat's nutrient screen. | Claude | 16 Oct 2026 | fixed |
| I-14 | The rule "1 open target request per product" has no test of its own. Fixed: flow test W-06 (2 quick clicks open only 1 target request). | Claude | 16 Oct 2026; closed 18 Oct 2026 | fixed |
| I-15 | The list revision withdraw runs without a row lock (a single guarded UPDATE); 2 presses at once still give 1 success and 1 409. Recorded, no change needed. | Claude | 16 Oct 2026 | accepted |
| I-16 | tests/run-all.js on 16 Oct 2026 (15:29) had a syntax error in confidentialScan, so `node tests/run-all.js` did not start. Fixed: the file now parses (node --check passes) and the 154-check run of 18 Oct used it. | Claude | 16 Oct 2026; closed 18 Oct 2026 | fixed |
| I-17 | The 99 VAN rows (about 24 product names repeated once per channel) are gone in 0.7.0: 30 VAN products, 52 packs, 1 product per pack (D-44). | Yawar | 18 Oct 2026 | fixed |
| I-18 | A rate save and a packing price save do not leave out packs already waiting in an open re-approval item (01 §1.3 says a waiting pack is left out; the other triggers do). A pack can sit in 2 open items; approving either uses today's cost and checks it again (D-41), so no wrong cost is approved. To fix with 1 open item per pack (migration 002). | Claude | 18 Oct 2026 | open |
| I-19 | Re-approval items made before 0.6.0 on a local database keep their old "from" figure (the cost before the change). Approving them is safe: C2M approves today's cost and checks it against the approved cost again. | Claude | 18 Oct 2026 | open |
| I-20 | A labour or FOH rate of Rs 0: Tahir ruled 18 Oct that it counts as missing, like a Rs 0 material rate. Built in 0.6.0; the rules form refuses it (test Y-02c). | Tahir | 18 Oct 2026 | ruled, built |
| I-21 | Distributor "previous price": Tahir ruled 18 Oct that it is the price on the last list actually sent to distributors (D-42). Built in 0.6.0: it moves only when a distributor list is issued (test Y-06). | Tahir | 18 Oct 2026 | ruled, built |
| I-22 | A cost that moved after the re-approval item was shown: Tahir ruled 18 Oct to approve today's cost and record both figures, as built (D-43). | Tahir | 18 Oct 2026 | ruled, built |
| I-23 | Checked 18 Oct 2026 on a fresh day-1 load: no approved cost version has Rs 0 packing on a VAN-packed pack or Rs 0 conversion, and no material rate or labour or FOH rate is Rs 0. So no approved cost carries the 0.5.0 Rs 0 gap. | Claude | 18 Oct 2026 | checked |
| I-24 | Pricing a pack whose recipe is not in C2M yet: Tahir ruled 18 Oct to refuse until the recipe is in C2M. Built in 0.6.0 (test Y-07b); 3 white label packs today show on Yawar's Today. | Tahir | 18 Oct 2026 | ruled, built |
| I-25 | Freight by the sale's channel and region is not built for VAN brand sales; none is loaded, so VAN GP is before freight (as before). | Yawar | 18 Oct 2026 | open |
| I-26 | Ruling 8 also asks for a load form for VAN brand costs. Not built: the day-1 loader reads Yawar's VAN Brands tab; later changes go through rates, packing and recipes as for white label. | Tahir | 18 Oct 2026 | open |
| I-27 | VAN brand products load with no target GP (Yawar's sheets give none per product); they show "no target". Changed 19 Oct 2026 by D-70: no target per VAN product; VAN brand is judged against the company ambition GP, built with the VAN brand list margin report. | Claude (to build) | 18 Oct 2026; changed 19 Oct 2026 | done in 0.9.3 (D-73): the VAN brand list margin judges every list row and the VAN brand portfolio against the ambition GP; Products and Margin keep no target per VAN product, as ruled |
| I-28 | 5 O2S VAN packs have no costing column and no cost (1 of them carries a large distributor sale); 2 more wait with Majid for their pack size. Their sales carry no cost until Yawar adds the recipe or column. A pack added to a costed product has no packing bill, so a new recipe version of that product cannot be cost-approved until the pack gets a bill (D-40). The packs are named in Yawar's import queue. | Yawar | 18 Oct 2026 | open |
| I-29 | O2S trucks still planned or loading counted as sold: the pull copied every shipment not voided, with no gate pass check, and their kg also stayed in open POs (v0.5 review item 3; ruling 14). Fixed in 0.9.1: a truck counts only once its gate pass is approved (approvedDate). | Claude | 18 Oct 2026 | fixed in 0.9.1 (D-60) |
| I-30 | No screen or route adds a customer, client product or pack (v0.5 review item 1). A new client's or product's sales stay under "Sales C2M could not place" until the loader or IT adds it. | Tahir (to rule the form), Claude (to build) | 18 Oct 2026 | open |
| I-31 | lib.flag and lib.exposure in c2m-lib.js are not used by the app (the page's flag() and exposure() in c2m.html run) and differ from F-12 and F-13 (lib.flag uses a fixed Rs and has no grey "no target"; lib.exposure does not take out open-PO kg). lib tests F-12 and F-13 prove these copies, not the page. Remove or align the copies and test the page's figures. | Claude | 18 Oct 2026 | open |
| I-32 | Freight is not dated in use: freightFor takes the newest freight row for the segment and region, even one whose valid_from is still ahead, and a freight save raises no re-approval (v0.5 review item 11). No freight is loaded yet (A-08). | Claude | 18 Oct 2026 | open |
| I-33 | The approver was not compared with the proposer: a person given coo and cfo in turn could propose and approve the same item (v0.5 review item 7; ruling 19). Fixed in 0.9.1: nobody can approve a price, list revision, setting request or target request they proposed. | Claude | 18 Oct 2026 | fixed in 0.9.1 (D-63) |
| I-34 | Rulings of 18 Oct 2026 (Design Record 5k) not yet built: 3 (ended price shows "no price"; today Margin falls back to the last O2S PO price), 4 (1 proposal with many packs), 5 (O2S shows the approved price at PO entry; an O2S change), 7 (1 master formula per base product), 9 (gap to the ERP weighted average in Tie to the books), 10 (price life: client acknowledgement), 11 (wrong rate voided on "the change was wrong"), 13 (traded goods as a 1-line recipe), 14b (FOC outside sales, GP and locked exposure), 16 (quarter close and reopen), 17 (client budget in sales Rs and GP Rs), 18 (targets from 1 Jul, to check; Yawar's entered GP for old months), 21 (1 open request per setting). Ruling 6 (declared grade flag) was dropped by D-58. Already in the code: 1 (changed by D-53), 2 and 15 (propose and exposure use cost today), 8 (D-44), 12 (Tahir sees each item's Rs effect on open POs), 14 (D-60), 19 (D-63), 20 (D-54). Each enters 06 when built. | Tahir (rules), Claude (builds) | 18 Oct 2026 | open |
| I-35 | A KAM (viewer) cannot open the documents 07 and 11 from the page: the state builder returns before it sets the document list for a viewer, though the route serves them (11.5). | Claude | 18 Oct 2026 | open |
| I-36 | A blank box in Settings saves 0: a budget line applies at once with a notice, and a threshold goes to Tahir as 0 (v0.5 review item 9). | Claude | 18 Oct 2026 | open |
| I-37 | Tests record a result per suite only, not per test; flow, fix06, van07, ui08 and ui09 tests name their rule in the description, not as a rule number. | Claude | 18 Oct 2026 | open |
| I-38 | A FED change reaches past O2S PO prices: each pull works out every PO line's net price again at the FED in force that day, so if FED moves from 5% to 6%, POs charged at 5% are divided by 1.06 and past GP drops by about 1% (independent review, 19 Oct 2026). Tahir to rule: FED by the PO's received date (needs a dated FED: a table, so not in 0.9.x), or 1 FED for all POs as now. No effect while FED stays 5%. Tahir, 19 Oct 2026 12:38: no action for now. | Tahir (rules) | 19 Oct 2026 | parked (no action for now) |
| I-39 | "Above: check" on Client prices is more than 5 points over target. Action: Tahir to confirm | Tahir | 19 Oct 2026 | closed 19 Oct 2026: confirmed as built (D-84) |
| I-40 | COBO is judged on the Farmer Sindh and Farmer Sindh credit columns, VGreen on Farmer Punjab; Margin shows them as 1 line each against product targets. Action: Tahir to confirm | Tahir | 19 Oct 2026 | closed 19 Oct 2026: confirmed as built (D-84) |
| I-41 | Reports, VAN brand list margin (under More) still colours against the ambition GP (D-73), while the VAN grid uses each product's target (D-75). Action: Tahir to say which | Tahir | 19 Oct 2026 | closed 19 Oct 2026: each product's target (D-81, 1.0.1) |
| I-42 | The labour and FOH bands wait for budget kg for the 39 products (from Yawar or budget V9); the 2 re-approval items stay held. Action: Yawar | Yawar | 19 Oct 2026 | open |
| I-43 | A list row not linked to its pack is not seen as that pack's row, so a price for that pack in an empty cell could add a second row. Fixed in 1.0.0 before release: an added row is refused while any row of that list is not linked, and the grid closes those cells. Action: Yawar confirms the suggested links and links the rest (More, Reports, VAN brand list margin) before adding packs | Yawar | 19 Oct 2026 | fixed (guard); links to do on live |
| I-44 | Under- or over-recovery line on Margin waits for Yawar to enter the new rate (D-79). Action: Yawar | Yawar | 19 Oct 2026 | waiting |
| I-45 | A VAN brand list row with no matching pack in C2M cannot be linked, so that list cannot take an added pack (the guard waits for every row to be linked). Action: Tahir to say: a "not a C2M pack" mark, or a way to remove the row | Tahir | 19 Oct 2026 | closed 19 Oct 2026: the "not a C2M pack" mark (D-80, 1.0.1) |

## 12.3 Known limits
- Next version (piece 1, roles): a role made in Setup, Roles is given from People and access (platform piece 1b, done 21 Oct 2026). The home screen shows job lists for the 6 starting roles; a new role shows the recipe steps it holds and its places. The recipe cost step and re-approvals have no proposer, so the rule "approve only what an administrator proposed" does not apply to them (ruled by Tahir, D-96).
- The stand-in platform (harness) never moves to VAN Systems.
- 1.0.3: a distributor pack brought back while a row moved off it is still on the list prints "new" (that row keeps the previous price for when it moves back); 2 rows leaving in the same second are ordered by row number.
- 1.0.3: a revision form refused because a row was moved meanwhile keeps refusing until it is opened again, and what was typed is lost (never priced on the other product). Before the carry-over, a distributor list issued ahead of a newly added pack's date does not set that pack's previous price (as in 1.0.2).
- 1.0.3: a save of many price moves at once writes as many notices as needed; the notice list shows the latest 20, so a very large save pushes older notices out of view (the change record keeps every move). A single move whose names run past about 110 characters each is still cut at 400 characters.
- The O2S data is only as fresh as the last Pull now.
- The exposure and history switches are per screen and not saved.
- The confidential scan checks figures from the import pack, the loader and the budget totals. A figure that is in none of them (for example a typed example that matches a real cost by chance) is not caught; the documentation is also read by eye for every 2-decimal figure and every "Rs" figure. Whole-number money is scanned only from 100 rupees up and only when written with "Rs", so small rates such as the base band values are not caught by the scan; they are kept out by review (A-21).

- 0.9.0: a price list issued before 0.9.0 reprints from its saved rows on the 0.9.0 letterhead (2 signatures, number block); the rows and figures are as issued.
- 0.9.0: the age of the sheet items counts from the first load of Yawar's sheets (the earliest imported recipe step); the items carry no date of their own.

- 1.0.1 (D-80): a product C2M costs under a different name (a list row named differently from its C2M pack) can still be marked "not a C2M pack"; the server cannot tell. Tahir's panel for a revision that adds a pack lists the marked rows of that list so he can send it back. With many marked rows the list is long.
- 1.0.1 (D-80): a list row with no size in its name whose name equals a C2M VAN product cannot be marked, even for a pack size C2M does not cost; link it, or correct the row.
- 1.0.1 (D-80): a wrong mark cannot be undone while a revision that adds a pack to that list waits (with Tahir, or approved for a later date); the refusal says so.
- 1.0.1 (D-80): new prices for linked rows (the grid) and for marked rows (the marked-rows form) of 1 list go as 2 revisions, 1 after the other: a list takes 1 waiting revision at a time.

- 1.0.2 (D-85): product names cover VAN brand products only; white label products keep their O2S names from the first load (Setup, Customers for customer names).
- 1.0.2 (D-85): the O2S spellings of a product fit in 120 characters together (the column's size); a long list needs an old spelling removed.
- 1.0.2 (D-85): a price list already issued keeps the names it was issued with; renamed rows print the official name from the next list.
- 1.0.2 (D-85, review): a printed list says nothing about a renamed product, and while rows are settled over several days 1 list can carry some rows renamed and some not. For Tahir.
- 1.0.2 (D-85, review): a pack under 1 L or 1 kg prints as C2M writes it, e.g. 0.5 L for 500 ml. For Tahir.
- 1.0.2 (D-85, review): each name is settled 1 click at a time (about 33 list rows on live); there is no "accept all guesses". For Tahir.
- 1.0.2 (D-85): removing an O2S spelling or an old official name changes Margin and the reports for every past month whose trucks used it; C2M shows the trucks and Rs before saving and logs them, but does not stop it.

- 1.0.3 (D-88): a VAN brand product with no description in C2M prints none until one is typed in Product names; the carry screen and Product names show which.
- 1.0.3 (D-88): a row taken off a list comes back only as a new row: its price typed in the grid, approved by Tahir as a list revision.
- 1.0.3 (D-87): the carry-over cannot be undone in the app; the rows that left are kept read only (Off the lists) and come back only as new rows through a revision.
- 1.0.3 (D-87): until the carry-over, rows with no pack and rows marked "not a C2M pack" take no new prices from the grid (the "Change prices of marked rows" form is gone); the carry-over is meant to be done first.
- 1.0.3 (D-87): before the carry-over the routes that link, unlink and mark a row still answer (no screen calls them); after it, unlink and mark are refused.

## 12.4 Review and audit reports with fix status

| Review | Date | Fixed in | Status |
|---|---|---|---|
| 3 reviews: code, UX, cost accountant | 16 Oct 2026 | 0.2.0 | fixed (see 08) |
| 5 reviews of 0.3.0 (incl. data leak, honest load, rate guards, interface) | 16 Oct 2026 | 0.3.1 | fixed (see 08); tests B-01 to B-03 added |
| Independent documentation review: 04 table count and dictionary, 05 stale and missing routes and errors, 01 to 03 flows and states, 07 guide, 09 examples, 10, 11, 12, version headers | 16 Oct 2026 | documentation 1.1 | fixed, except I-07 (code change needed) |
| Tahir's rulings on the 5 reviews (Design Record 5j) | 16 Oct 2026 | 0.4.0 | fixed (see 08); tests V-02, V-03, F-18 added |
| 4 pre-handover reviews: code, data safety, design, workflow | 16 Oct 2026 | 0.5.0 | fixed (see 08); tests W-01 to W-03, confidential scan and migration sync added; documentation 1.2 cleared of real figures |
| 18 Oct review on Tahir's 5 questions (flow, process, data, interface, clarity): 7 flow breaks, 19 formula defects, 12 schema findings | 18 Oct 2026 | 0.6.0 for defects 1, 2, 3, 4, 11 and 12 | 6 of 19 defects fixed; tests Y-01 to Y-08; the rest wait for the redesign build (OP-HANDOFF-C2M.md) |
| Independent review of the 0.6.0 change (code, accounting, docs, tests), 2 rounds: 10 points, then 4 on the follow-up | 18 Oct 2026 | 0.6.0 | Of the 10: 7 fixed (Rs 0 material rate, with the labour and FOH half left as I-20; no price on a pack not costed, with a Today job; approval check inside the transaction; packs with no approved cost not batched by a rate save; row with no price; docs; tests Y-02b, Y-03b, Y-04e, Y-07 and the Y-06 check after the price revision), 1 checked clean (I-23), 2 for Tahir (I-21, I-22), ruled the same day. Of the 4: first cost route added, Propose button replaced by the reason, message names the pack, docs; pricing of packs whose recipe is not in C2M ruled by Tahir the same day: refused (I-24) |
| Independent review of the 0.8.0 screens (rights, panels, product page, Inputs, old names, accessibility, the test) | 18 Oct 2026 | 0.8.0 | All 10 fixed: a form drawn behind a panel and again in it (a resent price sent the old figure; Tahir could not send back a VAN list revision from a panel opened in Prices) fixed by drawing no form behind an open panel; actuals and tie to the books reachable for any month from Setup, Monthly checks record, in a panel; recipe steps (check, review, endorse, approve cost) opened in a panel from the product page and Recipes too; 1 close step clears every form; old place names in 2 server messages and 1 page text; focus kept in the panel and returned to its button; panels for list revisions, threshold and target changes show only their own item; replaced proposals left out of History; forms now close after a successful save. Tests U-05 widened, U-09 to U-11 added, duplicate-id checks; no right changed (routes diff = the nav lists and 4 message texts). Round 2 (same reviewer): all 10 confirmed fixed; 2 new low points on keyboard focus fixed (the header is inert while a panel is open and Shift+Tab from the panel title stays in; after a save focus stays where it was); test U-12 added |
| Independent review of 0.9.0 (code, maths, PDF, Excel, access) | 18 Oct 2026 | 0.9.0 | fixed before the push: price history and the PO price report now keep a price after a newer one replaced it (high); packs indexed once per load (speed); PDF client box grows with a long name, title clear of the company name, no repeated line; GP bridge answer in proper English and "GP did not change"; costed-with-no-price leaves out packs with Tahir or waiting for their date, and is not counted twice; no invented age ("today") on prices to change, undated jobs sort last; focus returns after Find anything and More, no finder over a panel, listbox semantics, phone focus ring; waterfall total visible in dark mode; the client reason also checked on the server; no "null%" with no budget; PO lines this financial year only, lines not placed on a pack shown; customer export follows the columns and order, kg and L apart; only the 7 Brand Master family colours; band figures removed from the page text; dead code. Not changed: step chip says "Majid checked" (the system's step name) |
| Folder tabs (D-59), built after the 0.9.0 push | 18 Oct 2026 | 0.9.1 | ui08 and ui09 run again (27 passed); covered by the 3 reviews below (UI/UX S1: tabs no longer wrap) |
| Independent documentation audit of 0.9.0 against the code and the standard (all 12 sections, README, Design Record, Go Live Plan) | 18 Oct 2026 | 0.9.1 (documentation) | HIGH and MEDIUM points fixed in the documents; code comments with the band values, the handoff entry and the decisions for Tahir left to the main session and Tahir (A-21 to A-24) |
| 3 independent reviews of 0.9.0 plus folder tabs: cost and management accounting (verdict: ready with fixes; 17 findings), UI/UX (verdict: ready with fixes; 10 MUST, 18 SHOULD, 9 COULD), documentation audit (136 findings) | 18 Oct 2026 night | 0.9.1 | Cost: findings 1, 2, 3 (wording), 4 (figures on the checks), 5 (notice and proposer check), 6, 7, 8, 9, 10, 12, 14 (guide line), 15 (recipe total) fixed (D-60 to D-64); 3 (unrecovered line: D-29 stands), 11 (waits for VAN list matching), 13 (Yawar), 16 (I-31) and 17 (tables) not built (D-67). UI/UX: all 10 MUST and 16 of 18 SHOULD fixed (D-65); S2 partly (product page layers reduced), S4 for the propose reason only; COULD C1, C3, C5, C9 done. Documentation: HIGH and MEDIUM fixed. Re-review of the 0.9.1 code: see the next row |
| Independent review of Prices, By customer state against target (D-68), 19 Oct 2026 (1 BLOCKER, 5 SHOULD), then a re-check (3 NIT) | 19 Oct 2026 | 0.9.2 | All fixed: below floor checked before below cost (it could never show); 1 rule for the product page and By customer; the average only on trucks in the period; no-price labels; V-19 made strict; release note total; NITs (below floor word in To change, price 0 is no price) |
| Independent review of the FED setting (D-72), 19 Oct 2026 (verdict: ready with fixes; 0 BLOCKER, 2 SHOULD, 5 NIT) | 19 Oct 2026 | 0.9.2 | SHOULD 2 (a list revision applied while a FED change is approved could keep the old FED: the setting is now read with a share lock) fixed; SHOULD 1 (a FED change reaches past PO prices) recorded as I-38 for Tahir; NITs fixed: fix092 always leaves FED at 5, K-04 asserts lines were compared, fallback SQL always carries fed_pct, docs 06, 08, 10, 12 corrected. Not changed: a list row with no price keeps its old price with FED (none exists) |
| Independent review of 0.9.3, VAN brand list margin (D-73), 19 Oct 2026 (verdict: ready with fixes; 1 BLOCKER, 5 SHOULD, 10 NIT) | 19 Oct 2026 | 0.9.3 | BLOCKER fixed: the F-22 example used a real ambition figure and a real price; both replaced by example figures, and the confidential scan now also blocks that figure. SHOULD fixed: the answer line names the worst pack and its list (as the picture); suggestions are marked "suggested: check" and Save counts every link it sends; Save sends changed rows that are not shown; a row linked to a pack no longer active says so; tests made stronger (negative suggestion cases, rollback of a mixed batch, the 500 cap, non-number ids, 2 rows on 1 pack, not costed, no ambition, inactive pack, all 3 farmer lists, the portfolio GP worked out from the trucks). NITs fixed: message for over 500, whole-number ids only, unit in suggestions, row count on the pill, first row with a price, cost before freight, wording with no ambition, portfolio GP on approved cost, the 'new' signature, the double guard in the test, 05 lists every 400. Re-check of the fixes, same day: 1 new BLOCKER (the new example's dealer figure was a real list price; replaced and checked against the lists) and 1 SHOULD (lines of 1 colour were in name order, so "furthest below" could name the wrong pack; now worst GP first, and L-03 checks it), both fixed |

### 1.0.0 independent review (19 Oct 2026; owner: Claude records, Tahir decides items 9; version 1.0.0)
Reviewer: an independent agent that did not write the code; it ran the full suite, Playwright as Yawar and Tahir at laptop and phone width, API calls, and its own figures from the state. Verdict: ready with fixes. Confirmed correct by running: Margin figures (GP, sales, weighted target, Rs short, red threshold, sort, trucks with no cost left out), buyer lines and targets, VAN grid cost and GP, a future-dated added row prints "new", withdraw from the grid, no approve button outside a panel (D-46), roles and self-approval on the server, the refused added-row cases, no sideways scroll at 400 px, no page errors.

| No | Finding | Severity | Fix | Status |
|---|---|---|---|---|
| 1 | A sent-back revision with an added row could not be revised and resent; the grid's resend button did nothing | high | added rows keyed p<packId> in the resend form, shown as "new row on this list"; grid opens the panel (T-14) | fixed |
| 2 | A pack could get 2 rows on 1 list (link made while an add waited; links alone) | medium | links refuse a waiting pack; apply puts prices on a linked row instead of a new one (T-15); rows linked to 1 pack by links alone stay allowed (D-73) and are flagged in the grid | fixed; links rule stays as D-73 |
| 3 | An added distributor row would print a previous price never sent | medium/low | written with sentSet, no prev (T-16) | fixed |
| 4 | A send from the new screens left the old sent-back item stuck | medium/low | replaceId passed (T-17) | fixed |
| 5 | Client prices on a phone: send bar large, New price column far right | low | send bar sticky only once a price is typed; column order to Tahir | partly fixed |
| 6 | Waiting prices under the table showed every client | low | filtered to the picked client (T-17) | fixed |
| 7 | Docs: wl_budget_gp still in Back office; F-08; doc 07 line 84; B-22 | low | all 4 corrected; wl_budget_gp hidden everywhere | fixed |
| 8 | Trend title compared part months; restated view drops other trucks unsaid; added row shown as "n/a to" | low | full months compared; restated line says so; "new row on this list" | fixed |
| 9 | Lost by the rulings: Margin drill's open POs, FOC and links; product page Price history, Sales, History | for Tahir | not changed: Tahir to say whether any comes back | open |

Re-check by the same reviewer (19 Oct 2026), run, not only read: findings 1 to 8 confirmed fixed; no page or console error and no sideways scroll at 1280 and 400 px for Yawar and Tahir. Verdict: ready. Leftovers, low: (a) a send from the grid replaces the list's sent-back revision even when other rows are typed: the send bar now says so before sending, and the revision can be opened to revise instead; (b) older sent-back items (from before the fix) stay on Approvals until revised or replaced; (c) a wrong link can still make a pack look free and let a second row in: links must be right, and the grid flags packs with more than 1 row; (d) the refusal wording now covers a revision approved and waiting for its date.

### 1.0.0 data-safety review and design and workflow review (19 Oct 2026; 2 independent agents, run not only read; owner: Claude records, Tahir decides "for Tahir")

| No | Finding (what a person would see) | From | Fix | Status |
|---|---|---|---|---|
| 1 | A wrong or repeated link showed one product's price under another and let a pack go onto a list twice | data safety | links refuse a 2nd row of a list on 1 pack; adds refused while a pack has 2 rows; suggestions never put 2 rows on 1 pack (T-18, L-05) | fixed |
| 2 | Yawar could change the company GP target, and so the target of every untargeted product, with only a notice to Tahir | workflow | budget_gp waits for Tahir (S-01) | fixed |
| 3 | The grid let prices be typed on a list whose revision waits, and hid an approved price waiting for its date | design | column closed with the reason; waiting price shown with its date (T-18, T-10) | fixed |
| 4 | Re-sending a sent-back promo price dropped its end date; older sent-back items stayed on Approvals for good | data safety, workflow | end date kept; every older sent-back price or revision closed (T-18) | fixed |
| 5 | The first click on Send in the resend form did nothing | data safety | no redraw on change; Send reads the boxes (T-14) | fixed |
| 6 | Untargeted products looked as if they had their own target; target requests said "none" | data safety, design | "company target" shown; requests name the company figure | fixed |
| 7 | Phone: send bar hid the table and sat behind the bottom bar; laptop: last grid column cut off | design | send bar above the bottom bar, capped; grid pack column and header stay, narrower boxes | fixed |
| 8 | Red and amber told apart by colour only | design | words added ("red", "amber", "below", "above") | fixed |
| 9 | Setup "Sales FY to date" counted every truck | design | filtered to this FY | fixed |
| 10 | Chart labels could overlap (a line comment hid the code that separates them); More not marked as current; Tahir told to link rows | design | fixed | fixed |
| 11 | Margin leaves out a client whose trucks have no approved cost, with no line saying so | design | none: Tahir ruled "left out, with no line counting them" (D-79) | for Tahir |
| 12 | Product page Price history, Sales and History gone; Margin drill without open POs and FOC | design | none: ruled by D-76 | for Tahir |
| 13 | A list row with no matching pack in C2M can never be linked, so that list can never take an added pack | design | none yet: needs a "not a C2M pack" mark or a way to remove the row | for Tahir (I-45) |
| 14 | A row added by an approved revision has no change-record line of its own (the revision's approval is logged) | data safety | none | known limit |

Re-checks by the same 2 reviewers (19 Oct 2026, run): every fix above confirmed. Small points they raised, fixed the same evening: the company GP target request now carries the name Setup shows, and Tahir's job reads "Approve setting change"; the closed-column line says "until it takes effect or Tahir withdraws it" for an approved revision; the row says a sent-back valid-till is kept only if the new From is on or before it, and the send message names any price sent without it; in the grid the row actually linked to a pack always takes its cell, and a suggestion turned down is listed under Not placed; the sent-back item a new one replaces is logged "replaced" too. Known limit: a target request made while a product had no target of its own shows the company figure as it is today, not as it was on the day of the request. Verdicts: data safety "safe to ship"; design and workflow "confirmed fixed apart from the 2 items Tahir has ruled on".



### 1.0.1 code and data-safety review and design and workflow review (19 Oct 2026; 2 independent agents, run not only read; owner: Claude records; version 1.0.1)

| # | Finding (what would happen) | Review | Fix | Status |
|---|---|---|---|---|
| 1 | "Not a C2M pack" on a row C2M does cost lifted the guard, so a pack could be added and the same product print twice on a list; Tahir was not told | both | the mark refused on a row that names a C2M pack (name, size and unit; with no size, by name), on a linked row, and on a pack a waiting revision adds; an add refused where a marked row names the pack; Tahir's panel and the revision list under the grid list the marked rows (W-01, W-02, W-06) | fixed; different names rely on Tahir (12.3) |
| 2 | A marked row's prices could never be changed again from the screens Yawar uses | design | "Change prices of marked rows": the revise form with only the marked rows; closed while a revision of that list waits; warns that it replaces a sent-back revision (W-06) | fixed |
| 3 | A pick left in the grid or the report re-linked a row, or took a mark away | both | grid Save sends only rows still not placed; picks cleared on mark and Undo; the report never sends a pick for a marked row (W-07) | fixed |
| 4 | A revision approved at the moment a row was marked or linked overwrote the mark or link | data safety | applyRevision locks each row it rewrites | fixed (run with a pause by the reviewer) |
| 5 | A mark from an out-of-date screen dropped a fresh link | both | a linked row cannot be marked (W-01) | fixed |
| 6 | Undo while an add waited, and picks that were sure to fail | design | Undo refused while a revision adds a pack to the list; picks offer no pack taken, picked, suggested or waiting (W-02, W-03) | fixed |
| 7 | Margin missed partly costed lines (a buyer in 2 places) and gave one reason for all | both | lines with no costed truck named with their reason (no cost, or no C2M pack); partly left out lines named with counts (W-05) | fixed |
| 8 | "Left out of margin" was true only of the report; Guide not updated; help texts pointed to Reports | design | wording "left out of the VAN brand list margin report"; in-app Guide and docs 07 updated; help texts point to Not placed | fixed |
| 9 | Smaller: {packId, noPack:false} saved nothing; Undo toast wrong on a stale screen; the link record silent when a mark went; a company target of 0 shown as 0.0% | code | all fixed (W-01) | fixed |
| 10 | A suggested row cannot be marked on Client prices | design | none: a suggested row names a C2M pack, so the server refuses the mark with its reason | accepted |

Re-checks by the same 2 reviewers (19 Oct 2026, run): fixed, with 4 last points fixed the same evening (a row with no size named as a product; the marked-rows button closed while its list has a waiting revision; Guide and data dictionary wording; a pick left in another tab for a marked row never sent). Verdicts after them: "ship with these fixes" from both, each fix then made and the suite run: TOTAL 198 passed, 0 failed.

### 1.0.2 code and data-safety review and screens and workflow review (19 to 20 Oct 2026; 2 independent agents, run not only read; owner: Claude records, Tahir decides "for Tahir"; version 1.0.2)

| No | Finding (what a person would see) | From | Fix | Status |
|---|---|---|---|---|
| 1 | Tahir and Yawar overwrite each other's name changes unseen; a link on an out-of-date screen relinks a row | both | the page sends the names (and link) it showed; 409 if changed since (X-06) | fixed |
| 2 | Removing a spelling, or a rename with the spellings box empty, takes the cost off past trucks and changes Margin back months, with only "Saved." | both | name before a rename kept as a spelling; trucks, Rs and first date shown before saving; saved only with the counts seen; logged (X-07, X-11) | fixed |
| 3 | Cost-sheet notes in official names print on customer lists, and 1 trade name cannot be used by 2 products | design | Tahir: "Trade name only"; a shared name allowed when pack sizes differ (X-08); the names themselves are changed by Tahir or Yawar on the screen | fixed (code); names for Tahir and Yawar |
| 4 | A rename switches off the guard of a row marked "not a C2M pack" | both | every name of the product checked (X-09) | fixed |
| 5 | A revision in flight prints and shows the old name; 1 list under 2 names | design | open revisions show today's names; an added row takes today's official name (X-10) | fixed |
| 6 | Rows written with no size cannot be picked; Tahir cannot clear them | design | every pack offered for such rows; Tahir links on the other screens too (X-11) | fixed |
| 7 | Checks of names race between 2 people; names read outside the transaction | data safety | products locked, names read inside the transaction | fixed |
| 8 | Linking on Client prices and the margin report renames rows unsaid; Tahir told only Yawar links | design | toasts and help say so; Tahir links there (no mark) | fixed |
| 9 | Nobody is prompted to settle names; From O2S points elsewhere | design | "Names to settle" on Approvals, in a panel; From O2S points to Product names (X-11) | fixed |
| 10 | Picks on other O2S rows reset after 1 save; picks keyed by row position | design | picks kept and keyed by name | fixed |
| 11 | O2S pack size 0.5 shown as 1 | design | shown as 0.5 | fixed |
| 12 | Opening is heavy: 1 click per row, no accept-all | design | none: for Tahir | for Tahir |
| 13 | Column "On price lists as" showed which lists, not the names printed | design | shows the printed names | fixed |
| 14 | 500 ml prints as 0.5 L | design | none: for Tahir | for Tahir |
| 15 | Clash message lowercased the name; a spelling accepted for a product with no pack of its size; typed text lost on redraw; spellings split by commas | both | name as written; refused (X-04); text kept; 1 per line | fixed |
| 16 | Duplicate spellings across 2 products of the owner fail with a general error | code | clear 400 | fixed |
| 17 | Lists printed to KAMs and dealers say nothing about renamed products; rows half-renamed during opening | design | none: for Tahir | for Tahir |

Re-check by the same 2 reviewers (20 Oct 2026, run, not only read): fixes 1, 2, 4, 5, 7, 10, 13 and 15 held, including 2 people renaming at once (8 rounds: 1 save, 1 refusal each time). They found 9 more, all fixed and tested the same day:

| No | Finding (what a person would see) | From | Fix | Status |
|---|---|---|---|---|
| R1 | A wrong pick linked a 3 kg dealer row to a 3 L pack, and the dealer list then printed the other product | design | every pick offers only packs of the row's size and unit (X-12) | fixed |
| R2 | An old pick in the margin report silently undid a newer link by someone else | data safety | the pick carries the link shown when it was made; 409; picks cleared after Save | fixed |
| R3 | 2 products sharing a trade name could not both keep just that name (unique key on the spellings) | both | stored apart with a leading \| (X-13) | fixed |
| R4 | Every rename kept the old name as a spelling, filling the 120 characters | both | kept only when O2S trucks or an unlinked list row use it | fixed |
| R5 | O2S pick showed product names only, so a 3 kg name could be kept for a 3 L product | design | pick shows pack and unit, with "O2S gives the size only: check the unit" | fixed |
| R6 | Production saw 2 identical recipe lines for 2 products under 1 trade name | design | packs shown beside a shared name on Recipes, the recipe page and Approvals | fixed |
| R7 | A list printed during opening carried 1 product under 2 names with no warning | design | the price list builder warns and links to Product names | fixed |
| R8 | A row linked to a product out of use could not be linked again ("someone else changed this") | data safety | the page sends the row's stored link | fixed |
| R9 | A double click on a save showed a false warning; a rename at the moment a revision applied could add a row under the old name; the GP bridge named packs by the O2S spelling | both | 1 save per click; names locked when a revision applies; official names in the GP bridge | fixed |
| R10 | An O2S name for a product C2M does not hold stays in Names to settle | design | none: the Guide says so | known limit |

Second re-check by the same 2 reviewers (20 Oct 2026, run): all 7 code and data-safety findings and design findings 2, 3, 5, 7 and 8 held. New findings, all on "Take out of use" and its edges, fixed the same day:

| No | Finding (what a person would see) | From | Fix | Status |
|---|---|---|---|---|
| S1 | A revision sent at the moment a product went out of use put a row on that product, and Tahir could approve it | both | names locked in revise and approve; both refuse a pack out of use (X-16) | fixed |
| S2 | A product's own O2S name came back in Names to settle with a wrong guess, and once kept elsewhere the product could not come back | both | names of products out of use left out of Names to settle and refused as spellings (X-16) | fixed |
| S3 | A rename dropped a name used only by an open O2S order; the checks counted shipped trucks only | data safety | open order lines counted; the name kept when they use it; Names to settle lists open orders (X-16) | fixed |
| S4 | The server accepted a link to another size, though the screens offer only matching packs | both | the links route refuses it (X-16) | fixed |
| S5 | A recipe in the workflow became "? for ?" and could never be approved | both | out of use refused while a recipe is in the workflow; recipes of a product out of use leave the screens | fixed |
| S6 | A click during another save did nothing, silently; a refused link to an out-of-use pack said "pick a VAN brand pack" | both | "Wait: the last save is still running."; the message names the product out of use | fixed |
| S7 | A price list dated ahead reads an added row's name without the name lock | data safety | none: a rename at that same second leaves the row under "linked rows under another name", fixed by Rename | known limit |
| S8 | The KAM printing a half-settled list sees no warning and no list of renames to tell dealers | design | none: Tahir ruled KAMs tell dealers; what they tell from is for Tahir | for Tahir |
| S9 | O2S gives no kg or L, so a 3 kg name can be kept for a 3 L product after the warning | design | warning on the pick; the server cannot know the unit | for Tahir |
| S10 | Take out of use: 1 click and a confirm, for Tahir and Yawar, no reason asked | workflow | none: for Tahir | for Tahir |

Third re-check by a fresh independent reviewer (20 Oct 2026, run): S1, S3, S4, S5 and S6 held (60 rounds of out of use against a revision never both saved; 180 saves at once, 0 deadlocks). Found and fixed the same day:

| No | Finding (what a person would see) | From | Fix | Status |
|---|---|---|---|---|
| T1 | Rename to official names printed a row linked by mistake to another size under that size at its own price | data safety | rows linked to another size are never renamed; listed with Unlink (X-17). On live no row was linked yet (89 of 89 unlinked on 20 Oct) | fixed |
| T2 | A name of a product out of use could still be typed in Edit | code | refused (X-17) | fixed |
| T3 | A recipe version could be started on a product out of use, then vanished | workflow | refused, under the names lock (X-17) | fixed |
| T4 | The refusal said to "drop" a recipe, but C2M cannot drop one | workflow | message: take it out of use once that version is approved | fixed |
| T5 | With only open orders moving, the warning showed a blank date and the toast said 0 trucks | design | its own wording; toasts and change record count open lines | fixed |
| T6 | A list row with no size in its name still takes any pack, and the link renames it | design | none: by design (3 farmer rows today); the pick and its official name are shown before Save | known limit |
| T7 | Free (FOC) open lines count in the check but are not listed in Names to settle; a page open across the deploy keeps getting 409 | code | the 409 now says to reload | partly fixed |

Fourth check by a fresh independent reviewer (20 Oct 2026, run; verdict "push but know this"): every caller of the renamed-rows count updated; the size check, Unlink, the Edit refusal and the recipe refusal held (20 rounds of out of use against a new recipe: never both, never neither, 0 errors). Its points, fixed the same day: an official name holding a size (renamed back) left farmer rows under a wrong name: a new official name with a size is now refused (X-17); the Setup and Approvals counts of rows to settle now agree, and the Approvals panel lists rows linked to another size; the check no longer opens with "0 trucks" when only open orders move; 2 people starting a recipe version at once now get "already has a version in progress" (read under the lock). Left: a product whose saved spelling already equals an out-of-use product's name must remove it before other edits (cannot arise on live: no product is out of use yet).
- 1.0.3 (D-87): price lists sent to KAMs and dealers after the carry-over carry new order, names and descriptions with no "was" note (D-86: KAMs tell their dealers). KAMs do not see "Off the lists".
- 1.0.3 (D-87): a distributor list issued at the same instant as the carry-over could set previous prices by name for rows read before it (very narrow; not changed).

### 1.0.3 reviews (20 Oct 2026; independent agents, run not only read; owner: Claude records, Tahir ruled D-88; version 1.0.3)

Round 1: a code and data-safety reviewer and a screens and workflow reviewer, both "do not push yet". Round 2 (re-check, 2 fresh reviewers): code and data safety "push, but know this"; screens and workflow "do not push yet". Every finding was fixed, ruled by Tahir, or listed here.

| # | Finding (round) | Fix or status |
|---|---|---|
| R1 | No way to take a product off a list after the carry-over (1, screens) | Take off a list, Tahir or Yawar, no approval (Tahir, D-88); several lists in 1 go (2) |
| R2 | 2 rows already linked to 1 pack passed unseen (1, code) | Raised as a choice; prev by pack only after the carry |
| R3 | A revision could be approved onto a row that had left (1, code) | Revise re-reads rows in its transaction; approve refuses; applyRevision checks the list |
| R4 | Rows leaving by default; rows that left invisible (1, both) | Each chosen (Tahir, D-88); Off the lists with prices; prices in the change record |
| R5 | Distributor list printed an old description (1, screens) | C2M's description on all 3 lists (Tahir, D-88); none prints none (2, code) |
| R6 | Costing words in official names would print (1, screens) | Renamed on live through Product names (Tahir's OK); warning on the carry screen |
| R7 | Swap of 2 wrong carries impossible (1, screens) | Batch checked on its final state |
| R8 | Stale pick trapped the screen (1, both) | Dropped and named; Start again; picks kept on coming back (2) |
| R9 | Untrue counts, marks not shown, other person not told, sent-back revisions (1, screens) | Reworded; marks shown; notices; sent-back closed at the carry with its prices named (2) |
| R10 | Reasons on the distributor list keyed by position (1, code) | Keyed by product and pack; old documents keep theirs |
| R11 | A price moved to another product, nobody told (2, screens) | Allowed, the other is told (Tahir, D-88); refused while an open revision holds the row (2, code) |
| R12 | A price typed for a row moved meanwhile landed on the other pack (2, code) | wasPack on each revision row: 409 |
| R13 | A row brought back lost its discount, FRP, MRP (2, screens) | They come back from the row that left, shown to Tahir |
| R14 | Take-off box cut on a phone; 3 rounds for 3 lists (2, screens) | Above the grid, ticks per list, 1 save |
| R15 | Resend of a sent-back revision stuck on a row taken off (2, screens) | The row is dropped from the resend, with a message |
| R16 | Row picks to another product on the carry screen (2, screens) | Limited to the name's product and same-name products |
| R17 | Plan signature did not cover rows already linked (2, code) | It does |
| R18 | Lock order revise and remove (2, code) | Names lock first in both |
| R19 | KAMs and dealers get re-ordered lists with no "was" note (2, screens) | Not built: Tahir ruled KAMs tell dealers (D-86) |
| R20 | Same-instant distributor issue and carry (1, code) | Very narrow; not changed; in 12.3 |
| R21 | A move and a price typed at the same moment: the price landed on the other pack (3) | Checked again with the rows locked (packAt); run 8 times, never both saved |
| R22 | Prices of revisions closed at the carry-over only in a capped notice (3) | Listed on the page, "Closed at the carry-over" |
| R23 | Prices that came back looked typed; could come from a row of another size (3) | Marked for Tahir; only from a row of that pack and size |
| R24 | Rename with the description cleared kept the old one; table stale after Save anyway (3) | Fixed |
| R25 | Resend after a move; a move by mistake lost the distributor previous price (3) | packAt on resend; previous price tied to its pack |
| R26 | Field codes in notices; take-off box offered a held list; phone gaps in Product names (3) | Plain words; tick disabled with why; stacked labels fixed |

Round 3 (third check, 1 fresh reviewer covering code, data safety, screens and workflow): "do not push yet"; every finding fixed and tested (R21 to R26).

| R27 | A pack brought back took the prices of a duplicate row dropped at the carry-over (wrong MRP, terms lost) (4) | Takes the row that left last; rows dropped because another row was kept for their pack never give prices and do not show "back on the list" |
| R28 | "Revise and resend" could never be sent once a row in it had been moved; the message pointed to a reload that did not help (4) | The moved row is not filled in and says why; a price typed for it is for the pack it is on now |
| R29 | On resend, prices that came back looked typed (4) | Not filled in as typed; shown as "comes back unless typed"; marked again |
| R30 | The move notice was cut off at 400 characters with 3 or more moves (4) | As many notices as needed, each move whole |
| R31 | A price typed to add a pack and a row moved onto that pack at the same moment: both saved, the approval described it as a new row (4) | Checked again with the rows locked: the revision is refused (409); run 15 times, never both saved |
| R32 | Take-off button counted a held list once; a refused description said "Nothing was saved" after names were saved and lost the words typed; the approval panel showed only 12 prices (4) | Count after unticking; plain message with the words typed; the panel shows every price. The "Closed at the carry-over" box stays as a record, folded |

Round 4 (fourth check, 1 fresh reviewer, run not only read): "push, but know this"; every finding fixed and tested (R27 to R32); every round-3 fix held.

| R33 | The moved-row note on resend named the product the row is on now, not the one the price was typed for (5) | Named by the pack the price was typed for |
| R34 | A distributor pack brought back printed "new" with no previous price (5) | The price distributors last saw comes back with it, shown to Tahir |
| R35 | An empty grid cell could show "off since" from a duplicate dropped at the carry-over (5) | The row that left last, never a duplicate |
| R36 | Resend after the added pack got a row by a move: shown twice, refused on Send (5) | Shown once; the typed price goes on that row, with a note |
| R37 | The moved-row note was a thin strip on a phone (5) | A full-width line above the row |
| R38 | A save of very many moves makes many notices; the notice list shows the latest 20; a single move over 400 characters is still cut (5) | Not changed: VAN names are far shorter; in 12.3 |

Round 5 (fifth check, 1 fresh reviewer, run not only read): "push, but know this"; every fix of round 4 held; R33 to R37 fixed and tested, R38 listed.

| R39 | Resend after the added pack got a row by a move: the typed price went on that row, but the pack's old MRP, terms and previous price were lost without a word, and Tahir saw only the price change (6) | Nothing is filled in for it; the note says that row keeps its own prices and what was typed; Yawar decides |
| R40 | A list dated ahead, issued while a returning distributor pack waited for its date, would show the same increase twice (6) | Issuing sets the waiting pack's previous price to the price printed |
| R41 | Notes cut off on a phone; 1 pop-up replacing another so a dropped price went unnamed; 2 notes saying different things (6) | All changes since typing in 1 list above the form (taken off, moved, now on the list), each with what was typed; the row says "see the note above" |
| R42 | A distributor row moved off its pack and then taken off: bringing the pack back printed "new" (6) | The previous price comes from the row that last carried it for that pack |

Round 6 (sixth check, 1 fresh reviewer, run not only read): "push, but know this"; fixes 1 to 3 of round 5 held; R39 to R42 fixed and tested (the reviewer's scripts for R39, R40 and R42 run again: right prices, no second increase).

| R43 | Before the carry-over, issuing a distributor list no longer set the previous price of rows linked to a pack (1.0.3 matched by pack only; printed rows carry no pack until the carry-over) (7) | By pack when the printed row has one, else by name as in 1.0.2; M-15 |
| R44 | A price typed in "Revise: list" or for a row not in the revision could land on another product if the row was moved while the form was open (7) | Every row's pack is recorded when the form opens; a move meanwhile is refused (409); the reviewer's script run again: refused, nothing sent |
| R45 | The resend form showed "comes back" values from the old revision; the values are worked out again on sending (7) | Shown as "came back last time ...; worked out again on sending"; Tahir sees the real values |
| R46 | The previous price that comes back was not checked against the pack size (7) | Checked as the other prices |
| R47 | A distributor row moved off a pack but still on the list: bringing that pack back prints "new"; 2 rows leaving in the same second are ordered by row number (7) | Not changed: "new" shows the honest state, and the moved row keeps that previous price for when it moves back; in 12.3 |

Round 7 (seventh check, 1 fresh reviewer, run not only read): "push, but know this"; the 3 fixes of round 6 held; R43 to R46 fixed and tested; R47 listed.

| R48 | The refusal after a move named the row's new product, not the one typed for (8) | Names the pack typed for and what the row reads now; M-11 checks it |
| R49 | After that refusal the open form keeps refusing until opened again; what was typed is lost (8) | Not changed: safer than 1.0.2, which priced the other product; the message says to open the form again; in 12.3 |
| R50 | Before the carry-over, a list issued ahead of a newly added pack's date does not set its previous price (8) | Not changed: same as 1.0.2; after the carry-over it is set; in 12.3 |

Round 8 (eighth check, 1 fresh reviewer, run side by side with live 1.0.2 before the carry-over): "push, but know this"; no wrong price or previous price, no data lost; every round-7 fix held and matched 1.0.2 where it should; R48 fixed (wording only, covered by the tests, not re-reviewed), R49 and R50 listed.

## 12.1e Tests in the next version, piece 1 (owner: Claude records; D-89, D-90)

The suites c2m100 to c2m103 and their loader are outside the repository and were not available in this session, so they were not run. New tests were written against a throw-away MariaDB database with the real c2m-routes.js mounted on a test server with a stub sign-in:

| Test | What it proves | Result |
|---|---|---|
| Route by role (regress) | for each of the 45 guarded routes and each of the 6 starting roles the new code allows exactly what the old code allowed, except that the COO role (administrator) is allowed everywhere; the 6 roles get the same screens | 270 checks, 0 differences |
| Roles (roles.test) | only the administrator opens, creates, edits, deletes roles; a new role gives exactly the ticked rights and takes effect at once; the 6 roles can be edited; the administrator role is locked; a role held by a person is not deleted; the administrator may approve his own item; Yawar may approve an item Tahir proposed and not his own or a colleague's; a person below the administrator with an approve right cannot approve Yawar's item; before migration 002 the 6 roles still work, the Roles screen says so, creating a role is refused (409); an unknown role gets no access | 40 checks, all passed (including the review fixes: dependency rules, rate check separation, reserved keys, byAdmin) |
| Screen (browser) | every role opens the page with no script error; Tahir creates a role on the Roles screen and it is saved with the ticked actions | passed |

Not tested: the earlier suites; the screens with real data (the test database holds none); Render with the real platform sign-in.

Independent review of piece 1 (21 Oct 2026): 2 blockers (page screens and job lists still keyed to role names) and 8 should-fix points; all fixed except (the administrator and recipe steps question is closed by D-96): notices go to the CFO and COO roles by name only, roles are last-write-wins, and the platform hand-off, which is done (platform piece 1b, 21 Oct 2026; user_module_roles.role is varchar(64)).

## 12.1f Tests in the next version, piece 2: KAM lists (owner: Claude records; D-91, D-97)

Written against a throw-away MariaDB database; C2M's own suites c2m100 to c2m103 are outside the repository and were not run.

| Test | What it proves | Result |
|---|---|---|
| KAM routes (kam.test.js, 36 checks) | only the 3 viewer type people are listed as managers; Tahir and Yawar can tick, a KAM or Production cannot; unknown client or person refused; tick all and clear (VAN brand never); copy replaces, refuses the same person, a person who sees all, and a non-manager, and leaves 1 change record line; preview carries the manager's own role, screens and grants and nothing else, equals what he gets himself, and is refused for a KAM, Production, an administrator target, a non-manager and an unknown person; a new viewer type role is listed | passed |
| KAM screen (kamui.js, desktop and phone) | the tab is named KAM lists; 3 managers each "sees nothing"; a tick, a client chip, tick all, clear, copy and the preview work and save; the preview bar shows and every save is refused while it shows; Back to KAM lists returns; Yawar sees and ticks; a KAM with nothing is told to ask Tahir or Yawar; no script error | passed |
| Earlier checks (roles.test 37, regress 270 route by role) | no change to the 6 starting roles | passed |

Not tested: the real sign-in on Render, with the real 3 managers and the real clients.

### 12.4 Independent review of piece 2 (21 Oct 2026)
An independent agent read the change and ran the tests. No blocker. Fixed before the push: (1) a person whose username has capitals was shown "Sees nothing yet" after Tick all or Copy, because the routes wrote the name in small letters; they now use the name as stored. (2) Double clicking See what this person sees lost the way back; a second click is now ignored. (3) Documents not yet written; now written. Also fixed: Tick all removes client grants of clients that no longer exist; the preview refuses a role that can see settings, materials or costs that the previewer cannot; a failed Back reloads the page. Left as they are: the preview overwrites the Price list builder choice of the previewer; phone chips are 34 px tall; the 2 routes write the change record in slightly different forms. The tests now repeat cleanly.

## 12.1g Tests in the next version, piece 3: Add client and variants (owner: Claude records; D-94, D-95, D-98)

- p3.test.js, 93 checks on a local database: rate order (client pack, variant, type, general; a variant rate never leaks), Add client (kinds, names, duplicates, O2S spellings), Add a product (follows, variant, packs, bulk, the 25 kg pack tagged Excel with its own bill), cost arithmetic of a follower (followed materials + its own packing + its own conversion), CFO approval and its double press, variant add with recipe copy, recipe steps for the copy, a follower getting its cost when the followed recipe is approved, rate by variant reaching only that variant, tags, permissions of 6 roles, group rule, and the app and old routes working with a table of migration 003 missing.
- p3ui.js, 59 checks in a browser on desktop and phone: the Add client and Add a product forms, typed values kept across redraws, the Variants tab, the rate form, the follower's product page, Majid's Add a variant, no page errors, no sideways scroll.
- The 270 role checks (regress.js), roles.test.js, kam.test.js and kamui.js still pass. C2M's own suites c2m100 to c2m103 are outside the repository and were not run.

### 12.4 addition: independent review of piece 3 (21 Oct 2026)
An independent agent reviewed the change and found 9 defects, none high; all fixed and each covered by a test: (1) a pack size with more than 3 decimals or under 0.001 was stored wrongly or gave a 500; (2) 2 clients could share an O2S spelling; (3) re-tagging a variant moved costs with no re-approval or notice; (4) a followed VAN product could be taken out of use; (5) a white label product could be added to the VAN brand owner; (6) a double press of Approve cost wrote cost versions twice; (7) liquid could be saved sold per kg; (8) weak input checks (null pack, text bill id, non text names, a | inside a spelling); (9) cost versions written for followers had no change record row. Suspected, not changed: a follower pack not fully costed keeps a stale approved cost until it is costed and approved (listed in Known limits); a variant added under a family named like an unrelated product merges into it (the family name is shown on the form).

## 12.5 Speed change and Guide (22 Oct 2026)
- Speed: the state output was compared before and after for the cfo, coo and production roles (hash of the full response): identical. All suites run again (regress, roles, KAM, KAM screens, piece 3: route and browser): pass. Independent review: no defect. Its note on database load for list-only roles was acted on (they prefetch nothing).
- Measured on live (22 Oct 2026): state call about 3 seconds, was 3.7 to 6 seconds; the plain health call about 0.4 seconds, so most of the rest is database waits.
- Guide: checked on desktop and phone as Tahir, Yawar, Majid, Himayat and Fahim: Who does what shows 6 boxes, the reader's own box is marked, no sideways scroll, no page error.
- Not done: C2M's own suites c2m100 to c2m103 (outside the repo).

## 12.6 Piece 4, the new look (22 Oct 2026)

- Suites run on local after the build: regress, roles, kam, kamui, p3, p3ui, all passing. Screenshots as COO and Production Manager, on computer and phone, in all 4 looks.
- Independent review found 5 medium and some low points; fixed: top bar squeezed between 761 and 1100 px, To do column agreeing with State, client colours clashing, keyboard focus after a click, red jobs sorting last, amber text contrast, 0 day wording, empty trend month, tab order, dot size.
- Not tested: roles with long menus between 761 and 1000 px, printing, browsers other than Chromium. Not yet run live.
- Assumption: the look is kept per browser, not per person on the server.

## 12.7 Price list review (22 Oct 2026)

- All suites pass on local; sample PDFs rendered (white label, farmer) and the preview checked for the 7 changes. An independent review found: old farmer documents losing the pack, a zero size printing 0.00, key order, paise still allowed on screens, spacing of the pack text, key height and phone signature: all fixed.
- Not tested: the PDF with the real logo and live data; a printed copy. Not yet live.

## 12.8 Name on price lists (22 Oct 2026)

- Tested: save, clear, refusal for Majid, state, screen, and migration not run (409, nothing saved, other edits still work). Independent review fixed: half saved edit before a 409, a non text value, audit row when nothing changed. All 6 suites pass.
- Known: an older document made before snapshots existed would print today's name on reprint; the PDF font cannot print Urdu names.

## 12.9 Rename a client (D-110, 22 Oct 2026)
- Tests (local, rn.js): Majid refused; duplicate name, clash with an O2S name, empty, too long and non-text all refused; rename keeps O2S names; grant moves; document link moves while printed text stays; unchanged name is a no-op; edit form renames from the screen. All suites pass.
- Not tested live. Assumption: no other table holds the client name (checked in code and migrations). A name over 100 characters is refused because a grant holds 100.
- Independent review found 3 points, all fixed: validation ran after the rename committed; a stale read could orphan grants on two renames at once; the open price list builder kept the old client name. Tests added for each.
- Open: Tahir asked what Group means; segment edit ruled out.

## 12.10 Handover audit, 23 Oct 2026 (D-114 to D-116)
- 2 independent audits (data flow and logic; layout and UX). Auditor 1: 3 high, 7 medium findings; auditor 2: 5 severity 1, 9 severity 2, polish. All fixed in 1 round except: re-approval dismissal (kept as ruled, wording fixed) and trucks before the first approved cost (kept, A-04, now stated in Margin).
- New test file fix07.test.js (after p3): blank and bad targets refused and nothing saved; a same-day price replaces the earlier one with valid dates; rename, out of use, put back; remove a pack with no cost; refuse a pack with an approved cost.
- Playwright checks in /work/p4 (not shipped): Products rows and menu at 1300 and 390 px, correct box through the screen.
- Assumption A-23: a first-time CFO can finish each flow from the screens; checked by an auditor reading the code and screens, not by a real first-time user. Tahir to watch Yawar's first session.

### 26 Oct 2026, review fixes (D-119 to D-121)
- fix08.test.js (API, van_platform; also C2M_DB=van_review1): inner per kg refused in letters or with no pieces; 860 / 29 = 29.6552 per piece, working kept with the rate; state shows the buy and a clean source; 25 kg pack 1.186 per kg; carton 13.33 per L; per kg and per piece rates save; cost from the next day (3 cases, both functions); back to the company target (refused when already on it, held as 0, NULL on approval); a new pack's first cost waits at once (live-sized copy).
- fix08ui.js (Playwright, C2M_DB=van_review1, as Yawar, Majid): listed in the release note. All pass.
- harness.js reads C2M_DB to run on another database copy.
- Open: packs added before this version with no approved cost get their first cost item only when something else recosts them; Margin names them. Round 4 (words, tables, forms, Guide in full) and the MRP list (D-122) are next.
- 26 Oct 2026, independent check (agent 3) on van_review3: 2 blockers, 8 wrong, polish; all fixed and re-tested (runall.sh, fix08ui 33 checks). Kept as is: the history of target requests shows in the Change record and on Approvals, not in Setup; a pack added before this version with no approved cost gets its first-cost item only when something recosts it.
