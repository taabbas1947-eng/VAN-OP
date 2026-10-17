# 12. Tests, issues and assumptions

Version 1.4 · 16 Oct 2026 · Owner: Claude records; Tahir and Yawar confirm assumptions · Rule: R-5h item 12 (D-20)
Changed in 0.5.0: tests moved to C2M App/tests (outside apps/c2m); new suites confidential.scan and migration.sync; flow tests V-02, V-03, W-01 to W-03; last run recorded; real figures removed from the assumptions (public repo); I-05, I-08, I-09 fixed; I-14 to I-16 added.
Changed in 0.3.1: test ranges and last run; shipped items moved out of "not built"; assumptions and open issues in 1 table with owner, date and status; A-04, A-17 corrected; A-19 added; review reports with fix status.

## 12.1 Tests

Run `npm test` (or `node tests/run-all.js`) from the C2M App folder on Tahir's PC. The tests and the loader live there, outside apps/c2m, because they hold or read confidential figures and need the local harness; they do not go to the public repo. The run builds a fresh test database (c2m_test), runs the migration, writes the O2S stand-in, loads day-1 data with `loader/load-import-pack.js --wipe-local`, runs both suites, then the confidential scan and the migration sync check. flow.test.js refuses any database but c2m_test. Owner of the tests: Claude; Tahir reviews.

| Suite | Ids | What they prove | Count |
|---|---|---|---|
| lib.test.js | F-01 to F-18 | Formulas in 09 (rate warning, materials, recipe total, packing, rate choice and order, cost, margin, target price, floor with labour, FED, re-approval, exposure, flags, recipe chain, Pakistan time, labour + FOH) | 40 |
| flow.test.js | A-01 to A-04 | Access: screens by role, no role refused, Himayat no cost, KAM only granted lists | 4 |
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
| | H-01 to H-02 | Himayat's Materials screen; non-nutrient inputs; class change (also proves F-17) | 2 |
| | Q-01 to Q-02 | Labour and FOH rate on a list of products; inner liners on client-packed products | 2 |
| | V-01 to V-03 | VAN list revision: propose, send back, resend, approve; approvals dated ahead wait (list revision and client price); reprocessed band and floor with labour | 3 |
| | W-01 to W-03 | A newer approval cancels the waiting price, a waiting price can be withdrawn; a waiting list revision blocks a new one, can be withdrawn, a PDF dated ahead shows the future prices; C2M refuses to start without the platform pool | 3 |
| | X-01 | Every change is in the change record | 1 |
| confidential.scan (in run-all.js) | | No figure from the import pack, the B2B prices, the budget or the packing list appears anywhere in apps/c2m | 1 |
| migration.sync (in run-all.js) | | 001_c2m_core.PRODUCTION.sql is 001_c2m_core.sql with the database line in front | 1 |

Totals: 95 checks (40 lib, 53 flow, 1 confidential scan, 1 migration sync).
Last run, 16 Oct 2026, after the 0.5.0 documentation change: lib.test 40 passed, 0 failed; flow.test 53 passed, 0 failed; confidential.scan 1 passed, 0 failed (280 figures checked); migration.sync 1 passed, 0 failed; TOTAL 95 passed, 0 failed, 0 crashed. Run from a copy of tests/run-all.js with the I-16 line break put back, because the file itself does not start.
Not tested by automation: the PDF's look, the phone layout, the 2-step buttons and other screen behaviour (checked by clicking through as each person).

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
| A-07 | VAN brand products are listed for sales but carry no cost until their recipes are imported. Company GP against the budget and ambition lines waits for that (D-32). | Tahir | 16 Oct 2026 | open |
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
| A-19 | The 13 Oct approved cost is Yawar's sheet. The move to the bands waits in 1 re-approval item for the packs that move more than 3%. | Yawar | 16 Oct 2026 | open |
| A-20 | The budget lines (budget_gp, ambition_gp, wl_budget_gp, conv_budget_month) start at 0 in migration 001 and are set by the first load. At go-live the production load must set them, or the flags and the monthly comparison read against 0. | Tahir | 16 Oct 2026 | open |
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
| I-14 | The rule "1 open target request per product" has no test of its own. | Claude | 16 Oct 2026 | open |
| I-15 | The list revision withdraw runs without a row lock (a single guarded UPDATE); 2 presses at once still give 1 success and 1 409. Recorded, no change needed. | Claude | 16 Oct 2026 | open |
| I-16 | tests/run-all.js on 16 Oct 2026 (15:29) has a syntax error: a comment swallowed the next statement in confidentialScan (the line "if (a >= 10 && ...)" is joined to the comment before it), so `node tests/run-all.js` does not start, and figures with 2 decimals would not be scanned. This documentation run used a copy with the line break put back. Fix the file. | Claude | 16 Oct 2026 | open |

## 12.3 Known limits
- The stand-in platform (harness) never moves to VAN Systems.
- The O2S data is only as fresh as the last Pull now.
- The exposure and history switches are per screen and not saved.
- The confidential scan checks figures from the import pack, the loader and the budget totals. A figure that is in none of them (for example a typed example that matches a real cost by chance) is not caught; the documentation is also read by eye for every 2-decimal figure and every "Rs" figure.

## 12.4 Review and audit reports with fix status

| Review | Date | Fixed in | Status |
|---|---|---|---|
| 3 reviews: code, UX, cost accountant | 16 Oct 2026 | 0.2.0 | fixed (see 08) |
| 5 reviews of 0.3.0 (incl. data leak, honest load, rate guards, interface) | 16 Oct 2026 | 0.3.1 | fixed (see 08); tests B-01 to B-03 added |
| Independent documentation review: 04 table count and dictionary, 05 stale and missing routes and errors, 01 to 03 flows and states, 07 guide, 09 examples, 10, 11, 12, version headers | 16 Oct 2026 | documentation 1.1 | fixed, except I-07 (code change needed) |
| Tahir's rulings on the 5 reviews (Design Record 5j) | 16 Oct 2026 | 0.4.0 | fixed (see 08); tests V-02, V-03, F-18 added |
| 4 pre-handover reviews: code, data safety, design, workflow | 16 Oct 2026 | 0.5.0 | fixed (see 08); tests W-01 to W-03, confidential scan and migration sync added; documentation 1.2 cleared of real figures |
