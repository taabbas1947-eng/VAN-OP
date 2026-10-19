# 8. Release notes and change log

Version 1.0.1 · 19 Oct 2026 · Owner: Claude records; Tahir approves releases · Rule: R-5h item 8 (D-20)
Changed in 1.0.1 (19 Oct 2026): entry 1.0.1 added; live status.
Changed in 1.0.0 (19 Oct 2026): entry 1.0.0 added.
Changed in 0.9.3 (19 Oct 2026): entry 0.9.3 added.
Changed in 0.9.2 (19 Oct 2026): entry 0.9.2 added; its "Decided, not code" part changed by D-70 and D-71; FED setting and wording added (D-72).
Changed in 0.9.1 (3 independent reviews, 18 Oct 2026 night): entry 0.9.1 added.
Changed in 0.9.1 (documentation review, 18 Oct 2026): live status brought up to date; the 12 unbuilt reports move to 0.9.2; 0.9.0 entry gets its test totals and what to test after; the folder tabs (D-59) ship in 0.9.1 (its entry is written with the 0.9.1 code).
Changed in 0.9.0: entry 0.9.0 added.
Changed in 0.8.0: entry 0.8.0 added.
Changed in 0.7.0: entry 0.7.0 added.
Changed in 0.6.0: entry 0.6.0 added.
Changed in 0.5.0: entry 0.5.0 added; real figures removed from earlier entries (public repo).
Format: Keep a Changelog, semantic versions. Live: 1.0.0 (pushed 19 Oct about 22:09, checked live by Claude as Tahir the same evening; Yawar's view checked in the cloud copy only); 0.9.3 pushed 19 Oct 14:38, checked live; 0.9.2 pushed 19 Oct 12:43, checked live; first data load 19 Oct 2026 about 13:17, checked live. Before: 0.9.1 (pushed 19 Oct 09:39, checked live). apps/c2m first pushed by Tahir on 17 Oct and the live migration run the same day (39 empty c2m_ tables); 0.6.0 and 0.7.0 pushed on 18 Oct (17:29), 0.8.0 (20:16) and 0.9.0 (22:03), each checked live by Claude. The folder tabs (D-59) were built after the 0.9.0 push and ship in 0.9.1. No data loaded yet: the first data load runs on Monday 19 Oct 2026.

## [1.0.1] · 19 Oct 2026 · Tahir's answers on the open points and reviewer points after the 1.0.0 push (D-80 to D-84) · Who: Claude built; Tahir ruled and approves the push
### Added
- Client prices, VAN brand prices: Not placed lists each list row with no pack, with a pick to link it (Save links) and "Not a C2M pack"; marked rows show with who and when, and Undo. A marked row stays on its list and prints; it is left out of the VAN brand list margin report and no longer stops a new pack being added to the list. A linked row, or a row that names a C2M pack, cannot be marked; Tahir's panel for a revision that adds a row lists the marked rows; marked rows' prices change through "Change prices of marked rows" (D-80).
- Margin: 1 line under the headline names each client or buyer line with trucks in the period but none costed (no cost, or no C2M pack), and lines partly left out with their truck counts, with no figures (D-83).
- Product page: History is back as a 3rd tab (D-82).
### Changed
- Reports, VAN brand list margin: each pack against its product's GP target (its own, else the company GP target), with a Target % column and in the Excel export; the portfolio against the targets weighted by sales; the ambition GP is no longer used there (D-81).
- Reports, VAN brand list margin: the links table shows the mark, and Yawar can mark or undo there too (D-80).
### Fixed (found by the 1.0.1 reviews before release)
- A list revision approved at the same moment as a link or mark no longer overwrites it (applyRevision locks the rows it rewrites).
### Confirmed, no change
- "Above: check" at more than 5 points over target; COBO on Farmer Sindh and Farmer Sindh credit, VGreen on Farmer Punjab (D-84).
### API
- POST /api/c2m/lists/links: items may be {id, noPack: true or false} (D-80).
### Database
- No table, column or migration. c2m_list_price.data_json may hold noPack, noPackBy, noPackAt. Production SQL: none.
### Tests
- New suite c2m101.test (W-01 to W-07); ui08 U-03 and ui09 V-07 (3 tabs); van093 L-03 to L-05 (product targets); c2m100 T-10 (the grid table only). TOTAL 198 passed, 0 failed.
### What to test after (on live)
- Yawar: Client prices, VAN brand prices, Not placed: link 1 row with the pick, mark 1 row of a product C2M does not cost, then Undo it; Reports, VAN brand list margin shows a Target % column.
- Tahir: Margin, White label: the left-out line names the clients with no costed truck; a product page shows History.

## [1.0.0] · 19 Oct 2026 · The new C2M: 5 places, buyer sync rule, targets, client prices, VAN brand price grid, Margin (D-74 to D-79) · Who: Claude built; Tahir ruled and approves the push
### Added
- Client prices, White label clients: client chips by FY sales; each pack's price now, cost today, GP %, target, price for target and state (below, on target, "above: check"); new prices typed in the rows with the new GP at once; Send to Tahir, 1 proposal per pack; Tahir's "Open to approve" in the row opens the panel (D-78).
- Client prices, VAN brand prices: each VAN pack once with 5 list columns and the GP under each price; typed prices and prices for packs not yet on a list go to Tahir as 1 list revision per list; list revisions shown under the grid (D-77). A pack can be added to a list only once every row of that list is linked to its pack, and is never entered twice (B-22). A sent-back revision with an added row can be revised and resent; a send from the new screens replaces the sent-back item it supersedes.
- Margin rebuilt on the approved picture: 3 groupings, FY to date and White label first, approved cost on each truck's date with a restated switch, sorted by Rs against target, 4 figures, GP by month against target, Rs at stake, red, amber and on chips, Columns, Export to Excel, drill to packs and trucks (D-79).
- Setup with 10 tabs; Back office (the earlier Setup) under More (D-76).
- Buyer lines from O2S on every sale, FOC truck, open PO and PO line (D-74).
### Changed
- Yawar and Tahir: 5 places (Approvals, Products, Client prices, Margin, Setup) and More (Reports, Inputs, Back office, Guide); no group labels in the rail; phone bar of 4 with the 5th under More (D-76).
- Every product has a GP target: a product with none takes the company GP target (D-75), shown as "company target". A change to the company GP target now waits for Tahir. The white label budget setting is no longer used or shown.
- Each pack has 1 row on a list (links refuse a 2nd row); a list whose revision waits is closed in the grid; a new price or revision closes older sent-back ones; a sent-back valid-till date is kept; the resend form sends on the first click.
- Product page: 2 tabs, Recipe and Cost by pack (D-76).
- Red on Margin and on Approvals: 1 rule (below cost, or more than red_gap_pts short with Rs short above red_share_pct % of white label sales) (D-79).
- Guide lines for Yawar and Tahir rewritten for the 5 places.
### Removed
- For Yawar and Tahir: the 0.9.0 Margin page and the 0.9.0 Prices views (replaced by D-78 and D-79). The code of the earlier Prices screen stays for the KAMs' Price lists place.
### API
- POST /api/c2m/lists/revise: items may be {id: null, packId, values} (an added row, D-77). GET /api/c2m/state: me.more; cat and buyer line on sales, foc, open, poLines (D-74).
### Database
- No table, column or migration. Production SQL: none.
### Tests
- New suite c2m100.test (T-01 to T-18; T-14 to T-18 prove the review fixes); flow S-01 (company target waits for Tahir); van093 L-05 (1 row per pack); lib J-01, J-02; ui08 U-01 to U-05, U-09 to U-12, flow A-01, ui09 V-01, V-07, V-11, V-12, V-14, V-16, van093 changed for the 5 places; ui09 V-05, V-06, V-08, V-18, V-19 retired with the screens they tested (12.1). TOTAL 191 passed, 0 failed (12.1a), run in the cloud copy on 19 Oct 2026 after the independent reviews (code; data safety; design and workflow).
### What to test after (on live)
- Yawar: the 5 places and More; Client prices, type a price and see the GP; send 1 test price and send it back as Tahir; VAN brand prices, check the grid against the lists; Margin, check White label GP against your own figure; Setup, 10 tabs.
- Tahir: Approvals; Client prices "Open to approve"; Margin red lines.

## [0.9.3] · 19 Oct 2026 · Reports, VAN brand list margin (D-73) · Who: Claude built; Tahir approved the picture
### Added
- Reports, VAN brand list margin: 1 line per VAN pack with its cost today per pack and, on the distributor, dealer and farmer list, the price without FED and its GP (distributor price ex FED; dealer NSV ex FED, before the additional discount; farmer price / (1 + FED %), with a switch for Punjab, Sindh and Sindh credit). Red below cost, amber below the company ambition GP, green at or above it; the state names the worst list; the worst first. The answer line gives the VAN brand portfolio GP on what was sold this FY against the ambition GP, and how many packs are below ambition and below cost. Export to Excel (packs and links).
- Links: each list row is linked once to its C2M pack in the same report. C2M suggests a pack where the name, size and unit agree, marked "suggested: check"; Yawar checks, picks the rest and saves; the Save button counts every link it sends. A row not linked stays out of the table and is counted under it. Tahir reads the links.
- Guide line 3 for Yawar and Tahir.
### Database
- No table, column or migration: the link is packId inside each list row's data. New route POST /api/c2m/lists/links (cfo). Tests: van093.test L-01 to L-07. TOTAL 176 passed, 0 failed (lib 41, van07 8, flow 57, fix06 20, ui08 12, ui09 19, fix091 6, fix092 4, van093 7, confidential scan 1, migration sync 1), run in the cloud copy on 19 Oct 2026.
### What to test after (on live)
- Yawar: Reports, VAN brand list margin: check the suggested packs, link the rest, Save links; the table fills. Tahir: the same report shows the lines and the links, with no Save.

## [0.9.2] · 19 Oct 2026 · Prices, By customer: state against target, all clients (D-68); FED, the only tax on VAN, as 1 setting (D-72) · Who: Claude built; Tahir approves
### Changed
- Prices, By customer opens on All clients: every white label pack at today's price with GP on cost today, its target and a state: red (below cost, below the contribution floor, or costed with no price), amber (below target), green (on target), grey (no target or not costed). A pack with no price says why (with Tahir, waiting for a date, ended). The product page uses the same state rule. The worst come first; the answer line counts them ("1 of 7 packs on target; 1 below cost, ..."). Each client in the list shows "n of N on target"; pick 1 client to see only its packs. The column "Margin" is now "GP on cost today"; the switch is "GP and target".
- Prices, To change: the pill "below contribution" is now "below floor", the same word as By customer; a price of 0 counts as no price.
- Guide lines for Yawar (8) and Tahir (new 9).
- The 12 unbuilt reports carry no version number: they are built after their pictures are approved.
- FED is the only tax on VAN, 5%, on every product and client (D-72). 1 setting, FED % (fed_pct), in Setup, Settings and targets: Yawar proposes, Tahir approves. It replaces the 5% fixed in the code for O2S prices that include FED, distributor price with FED and dealer net with FED. When Tahir approves a new FED %, every distributor and dealer row's price with FED is worked again. Each price list document keeps the FED % it was issued with.
- Words: white label lists say "exclude FED (5%)" (was "exclude FED and sales tax"); dealer headings "Net price ex FED" and "Net price with FED" (were "ex taxes" and "with taxes"); farmer lists "include FED (5%)" (was "include taxes"); the price basis line on every list names FED with its % (was "FED and sales tax extra", "Net of taxes, and with taxes", "Taxes included"); the revise form says the FED % it uses.
- Parked (I-38): a FED change also reaches past O2S PO prices at the next pull. No effect while FED stays 5%; Tahir: no action for now (19 Oct 2026).
### Decided, not code (D-69 to D-71)
- No GP target per VAN brand product: Yawar does not enter them (D-69 b withdrawn). Every VAN brand list row and the VAN brand portfolio GP will be judged against the company ambition GP; GP before freight on every list; farmer prices ex FED (price / (1 + FED %), D-72); dealer GP on the NSV before the additional discount; each list row carries its C2M pack (D-70). Built with the VAN brand list margin report, after Tahir approves its picture.
- C2M does its minimum even if O2S stops; O2S is a second source (D-71).
### Database
- No table, column or migration. The first load adds 1 setting row, fed_pct = 5 (loader and fallback SQL; a missing row is taken as 5, so live works the same before the load). Tests: ui09 V-19; fix092.test K-01 to K-04; lib F-10 at FED 6%. TOTAL 169 passed, 0 failed (lib 41, van07 8, flow 57, fix06 20, ui08 12, ui09 19, fix091 6, fix092 4, confidential scan 1, migration sync 1), run in the cloud copy on 19 Oct 2026.
### What to test after (on live)
- Prices, By customer: All clients first; every pack has a state; picking 1 client shows its packs and counts.
- Price lists: the white label note says "exclude FED (5%)"; dealer headings say ex FED and with FED. After the load: Setup, Settings and targets shows FED, % at 5.

## [0.9.1] · 18 Oct 2026 · 3 independent reviews: cost and management accounting, UI/UX, documentation (D-60 to D-67) · Who: Claude built; Tahir approves ("Also rules and formulas", no migration)
### Fixed (cost review)
- A truck counts as sold only once its gate pass is approved (O2S approvedDate). Trucks still loading were counted as sold and as open at once (13 trucks, 8,934 kg in the 13 Oct export; 258 trucks, not 271) (D-60). After the push, press Pull O2S now: the pull replaces the old copy, nothing is reloaded.
- "Approve ticked only": the packs not ticked wait in a new item "Left open from item N" on Today; before, they sat in no queue (D-61).
- FOC lines (price 0) are out of sales, GP and open POs, shown on their own on the customer page (ruling 14b, D-62).
- A customer is judged against its target on the products that have one, so a product with no target cannot hide one below target (D-62).
- A pack whose approved price has ended has no price; it no longer falls back to the last O2S PO price (D-62).
- A price approved for a later date counts from its date in Rs at stake; the Rs a proposal adds counts from its effective date, the same on the propose panel, the proposal card and Tahir's approval (D-62).
- The person who proposed a price, list revision, setting or target cannot approve it (D-63).
### Added
- Notices on Tahir's Today for every labour or FOH rate, packing bill, product type or reprocessed change, with the packs moved (D-63).
- Monthly checks with figures: tie to the books in total with C2M's own sales and COGS beside the ERP figures and the gap; the rate check lists the 15 materials with the most Rs in the month and needs each register rate (D-64).
- Margin: GP on cost today beside GP on approved cost; a line that GP is on band cost while budget and targets were set on full cost (D-62).
- GP bridge: a Method bar for the 13 Oct change of conversion basis; volume and mix work kg and L apart (D-62, D-35).
- A check-the-quantities box on a solid recipe whose inputs add to below 0.98 or above 1.20 kg per kg (D-64).
### Changed (UI/UX review, D-65)
- The propose panel follows the typed price at once, keeps the cursor, and warns below today's price; the client reason shows its error under the box.
- Searches filter as you type and keep the cursor. Every date box shows the date in words.
- Product type, reprocessed and packing bill changes wait for Save, with the packs they recost.
- An empty C2M says what is missing and where it comes from, on Today, Margin, Products, Prices, Inputs and the Setup tables. Monthly jobs never count days from before the first load.
- Today: the next move button names the step; To do sorts red, then stuck, then oldest; 1 pack with no price opens its own propose panel ("Set a price").
- 1 colour rule: red = below cost, below floor or a red customer ("below target, large Rs gap"); amber = below target; green = on target.
- Phone: Today lines stack with 44 px buttons; the Prices and Margin tables become cards; Sign out moves to More; the GP trend is drawn at phone size.
- The line above a topic carries only data facts; the product page opens with the product as its topic; Setup explanations fold under "How this works"; shorter Setup tab names; folder tabs scroll sideways instead of wrapping.
- Labels: "GP at budget %", "Short of target on open POs", "below approved price", "Approved cost on date", VAN brand GP "before freight out". Login ids and role codes show as names. Internal references (ruling and decision numbers) left the screen text.
- The 2-step button turns green, "Tap again to confirm"; Approve cost takes 2 steps.
- Unbuilt report cards are dashed and say "not built yet"; the GP bridge axis uses round steps and may start above 0 (marked on the bars); the GP trend marks the month to date.
- Price list builder: steps 1, 2, 3, then the document marked "PREVIEW, NOT ISSUED", then Create PDF.
- Folder tabs (D-59) ship in this release.
### Fixed (documentation review)
- All 12 sections corrected against the code (136 findings: 22 high, 66 medium, 48 low); band values removed from code comments, the migration comment (comment only, both files) and the handoff; the confidential scan now also catches the band values.
### Not built (D-67)
- Unrecovered conversion line (D-29 stands); cost and GP per VAN list revision row (waits for the VAN list matching decision); liquids by density (Yawar, I-06); anything needing a new table.
### Database
- No table, column or migration. Rules and tables touched: c2m_notice (new notices), c2m_monthly_check (data_json now validated and read back). Tests: fix091.test (N-01 to N-07) and ui09 V-16 to V-18 added; flow, ui08 and ui09 updated. TOTAL 163 passed, 0 failed (lib 40, van07 8, flow 57, fix06 20, ui08 12, ui09 18, fix091 6, confidential scan 1, migration sync 1), run in the cloud copy on 18 Oct 2026 night.
### What to test after (on live)
- Pull O2S now once; Margin and the truck counts match O2S trucks with a gate pass.
- Yawar: propose panel (type a price, the GP follows; empty reason shows under the box); product type change waits for Save; monthly checks panel shows C2M figures.
- Tahir: For your information shows cost input notices; the rate check table; an approval of your own proposal is refused.
- Phone: Today and Prices as cards; Sign out under More.

## [0.9.0] · 18 Oct 2026 · the approved picture, version 4, with the left rail (D-53 to D-58) · Who: Claude built, Tahir approves
### Added
- Left rail in VAN navy: VAN logo, Find anything (Ctrl K: places, client products, customers, materials, reports), places grouped Analyse, Work on, Admin; the person, Back to launcher and Sign out at its foot. The page keeps the O2S look (D-53).
- Reports for Yawar and Tahir: 14 cards; GP bridge (monthly) and PO price against approved price built in full, each with Export to Excel; the other 12 show "0.9.1" (D-57; moved to 0.9.2 on 18 Oct, the cards are relabelled in the 0.9.1 code).
- Excel export (.xlsx made in the browser) on the Margin customer table and on both reports.
- Product page: cost waterfall per pack; Cost and price by pack in 1 tab with an Each pack table; Price history and Sales tabs; Propose a price at the top; step chips say who did each step and when.
- Today: next move card, groups with counts, the age of every waiting line, stuck after more than 2 working days (Monday to Saturday), Waiting on others with ages, a job for packs costed with no price (D-54).
- Server, read only, Yawar and Tahir only: priceHistory, poLines, importedAt, nextDocRef in the state; proposals carry decidedAt; products and white label list rows carry the family colour (D-55).
### Changed
- Margin: 4 figures (sales with kg and L, gross profit Rs against the budget Rs, Rs at stake with locked in, customers red), the GP trend by month against budget, where money is at stake in 1 card with 3 tabs, group chips (white label, VAN brand, all), the customer table as a working table (search, chips with counts, Kg or L, GP bar against target, row stripe, totals row with sales-weighted GP, Columns).
- Prices: 1 To change list with reason pills, including packs costed with no price; tab counts; a Waiting for date tab; Propose in a side panel with 4 tiles, GP on both costs and the Rs effect; the reason for the client is no longer pre-filled and is needed to send (D-56).
- Tahir's price approval panel: tiles, its place in the queue (n of N), Yawar's below-target reason set apart, stacked buttons.
- Recipe review: the answer names what stops the analysis; each input shows its nutrient %; the working of each worked-out % is shown.
- Price list preview and PDF: number, issued and effective block; price basis beside the client block; 2 signatures; family chips; page number (D-58).
- Phone: 1-line top bar; bottom bar of 4 places and More.
### Not built (Tahir, 18 Oct 2026)
- The declared grade check (H2): no new database entry (D-58). The 12 undrawn reports: built after their pictures are approved (D-57; first planned for 0.9.1, then 0.9.2).
### Changed after the first push (Tahir, 18 Oct 2026, 22:21; D-59)
- The views inside Prices, Setup, Inputs and the product page are folder tabs, with counts in a badge. The first push showed them as underlined text. Not part of the live 0.9.0: it ships in 0.9.1.
### Fixed before the push (independent review, 18 Oct 2026; see 12.4)
- Price history and the PO price report keep a price after a newer one replaced it. The client reason is also checked on the server. PO lines are sent for this financial year only. The PDF client box grows with a long name. The GP bridge answer reads in proper English.
### Database
- No table, column or migration. Tests: ui09.test (V-01 to V-15) added; ui08, flow A-01 updated for 8 places and the new tabs. TOTAL 154 passed, 0 failed (lib 40, van07 8, flow 57, fix06 20, ui08 12, ui09 15, confidential scan, migration sync), 18 Oct 2026. After D-59 only ui08 and ui09 were run again (27 passed).
### What to test after (on live, as Tahir and as Yawar)
- The navy rail with 8 places for Yawar and Tahir; Find anything (Ctrl K); every place and view opens with no page error.
- Today: next move, To approve, To do, Waiting on others, ages and stuck marks.
- Reports: GP bridge and PO price against approved price open and export to Excel (once data is loaded).
- Prices: propose panel refuses an empty client reason; Tahir's approval panel.
- Price list preview: number, issued and effective block, 2 signatures; a PDF opens.
- On a phone: top bar, bottom bar of 4 places and More.

## [0.8.0] · 18 Oct 2026 · the screen redesign, stage 1 (Tahir's 8 screen rulings) · Who: Claude built, Tahir approves
### Changed: where things sit and how they read (D-45 to D-52). No rule, right, approval step, formula or table changed.
- Yawar and Tahir work on 7 places: Today, Margin, Products, Prices, Inputs, Setup, Guide (D-45). The O2S look stays.
- Every approval and job opens in a panel on Today and is done there (D-46). Approve and send back buttons sit only in a panel; a list elsewhere says "Open to approve". Close or Escape shuts the panel.
- Products: 1 page per client product, with Recipe, Cost by pack, Price and History (D-47). The product list has filters (white label, VAN brand, recipe in progress, not costed, below cost or target) and a search box. The Price tab shows GP on cost today, the price for target and the gap to it per kg or L.
- Inputs: 1 materials table with class, nutrient % and, for Yawar and Tahir, the rate with its date and source; Packing items and Packing bills beside it (D-48). Himayat sees no rates, as before.
- Setup replaces Back Office: Customers, From O2S, From Yawar's sheets, Settings and targets, People and list access, Monthly checks record, Change record, System documentation (D-49).
- Prices has 5 views: To change, Proposals, By customer, Price lists, VAN brand lists.
- Every screen opens with its topic and 1 answer line; explanations fold under "How this works" (D-51).
- Phone: the tabs sit at the bottom; a panel fills the screen (D-52).
- Step names keep their capitals ("Yawar approves cost", not "yawar approves cost").
### Not in this stage
- Reports (14 reports ruled 18 Oct), the price life flow with client acknowledgement, migration 002 and the other rulings of the 21: still to build.
### Tests
- New suite ui08.test (U-01 to U-12): runs the real page in a DOM (jsdom) against the local harness as each person; clicks every place, sub-view, product page tab and Today panel; approves a price from Tahir's panel end to end; resends a price and sends back a list revision in panels opened from Prices; checks no id is used twice and no form is left behind. TOTAL 139 passed, 0 failed.
### Fixed after the independent review (same day)
- A form drawn behind a panel and again in it: a price revised in a panel opened from Prices sent the old figure, and Tahir could not send back a VAN list revision from a panel opened from Prices. No form is drawn behind an open panel now.
- Recipe steps open in a panel from the product page and from Recipes too ("Open to approve cost", "Open to review recipe"); the step buttons sit only in the panel.
- Setup, Monthly checks record: "Enter or correct a month" opens the actuals panel for any month.
- Closing a panel clears every form it opened. While a panel is open the header and the screen behind are inert; Tab and Shift+Tab stay in the panel; after a save focus stays where it was; on close it goes back to the button that opened the panel.
- A form now closes after a successful save (it stayed open until the next click).
- Panels for list revisions, threshold changes and target changes show only their own item; replaced proposals are left out of the product page History; old place names removed from 2 server messages and 1 page text.

## [0.7.0] · 18 Oct 2026 · ruling 8 built, and the VAN brand costs loaded from Yawar's sheet · Who: Claude built, Tahir approves
### Changed: VAN brand products (D-44)
- Each VAN pack is now 1 product with 1 cost, sold in every channel. Before, the same pack was held once per channel (COBO, Dealer, Distributor, Farmer, VGreen), which made about 24 product names look like 99 rows.
- An O2S line in any channel other than white label finds the VAN pack by brand and pack size. The sale keeps the buyer, channel and region, so margin by channel and by buyer still works.
- A VAN pack shows no single price; VAN prices change through the VAN brand list revisions. A per-pack price proposal for a VAN pack is refused.
- Products and packing, Rules and Sheet against C2M now list VAN brand products with the white label ones.
### Data (day-1 load; outside apps/c2m)
- The loader reads Yawar's VAN Brands tab: 47 packs (dated 14 Oct 2026, with his snapshots of 30 Jun, 10 Aug and 25 Sep for the cost on each truck's date). His DEALERS and COBO tabs give the same cost for every pack.
- 30 VAN products and 52 packs load: the 47 sheet packs plus 5 O2S packs with no costing column (no cost). 45 packs carry Yawar's figures as the approved cost; where his sheet has Rs 0 labour and FOH the band takes its place (a Rs 0 rate counts as missing). 2 wait with Majid: the sheet costs a 500 ml bottle with pack size 1. Materials and packing rebuild his sheet for every costed pack; only labour and FOH move to the bands, in 1 re-approval item.
- White label costs and rates are unchanged by the load (all 41 packs compared).
- Yawar's import queue lists every open question: the names matched between his sheet and O2S, a product made in-house and also bought in, 2 pack sizes to confirm, packs with no costing column, VAN targets, a costing working that is not a product, packing to itemise. Product names stay in the queue and the import pack, not in this public file.
### Tests
- New suite van07.test.js (Z-01 to Z-07) in C2M App/tests, run right after the load: every sheet pack loaded with Yawar's figures, the matching, the sale keeping its buyer and channel, the refusal of a per-pack price. flow test P-04 now finds its re-approval item by cause (the VAN brand item also stays open). The confidential scan also reads the VAN Brands figures (730 figures) and the VAN product names.
- An independent review found 10 points; fixed: the packing items are now matched 1 piece first across all items (a 10 L can was read as 3 cans of 3 L), the 2 bottle packs wait with Majid, the Rs 0 labour and FOH, a pack is never added twice, double spaces in O2S names, an empty buyer name, the Propose button and 2 screen texts on VAN packs, and the tests and the scan. A blank O2S buyer now never shows as the VAN brand owner row.
- TOTAL 126 passed, 0 failed, 0 crashed on a fresh c2m_test, 18 Oct 2026.

## [0.6.0] · 18 Oct 2026 · the 6 defects from the 18 Oct review that can put a wrong cost or price in front of a client, or stop rate saves · Who: Claude built, Tahir approves
### Fixed: cost (defects 1 and 2; D-40)
- A pack is costed only when every part of its cost is there: a rate for every material; for a pack VAN packs, a packing bill with at least 1 item, every item priced above Rs 0, and a pack size above 0; and both a labour and a FOH rate. Before, a missing packing price or a missing FOH rate counted as Rs 0, so the cost was too low and the GP too high (example figures: a 10 kg pack with its bag unpriced showed cost 120, not 130; at a price of 200, GP 40%, not 35%). A bulk product, and a client-packed pack with no bill, still carry no packing (D-26 unchanged).
- A pack that is not costed says why on Recipes: "Not costed: no packing bill", "no price for (item)", "no FOH rate".
- Cost approval is refused, naming each pack and what is missing, until every pack of the product is fully costed on that version (B-05). The check runs again inside the approval transaction, so nothing is saved if a price or rate changed in between; an inactive product is refused.
- A rate of Rs 0, for a material, labour or FOH, counts as missing; the rules form refuses a Rs 0 labour or FOH rate (Tahir 18 Oct, I-20).
- A price cannot be proposed for a pack that is not costed, including one whose recipe is not in C2M yet (Tahir 18 Oct, I-24): its GP and the below-target check need a cost. The product screen shows why in place of the Propose button, and Yawar's Today lists every such white label pack.
### Fixed: rate saves (defect 3)
- A pack of an inactive product no longer breaks Try a rate, Save or the import-queue rate correction: it is skipped. Pricing a pack of an inactive product is refused in words, not with a server error.
### Fixed: re-approval (defect 4; D-41)
- An item made by a material rate or a packing price shows the approved cost as "from", and the % against it. Before, it showed the cost before the change, so the figure and even the direction could be wrong (example figures: approved 120, cost 110 rising to 114 showed "110 to 114, +3.6%"; it is "120 to 114, -5.0%").
- Try a rate shows the approved cost and the % against it next to "re-approve".
- On approval each pack is checked again: a pack now within reapprove_pct of its approved cost, or no longer fully costed, keeps its approved cost and is named ("Left on approved cost"). The reply is {ok, approved, left}.
- A material's first rate, or a packing item's first price, batches packs against their approved cost (before, those packs were skipped). A pack with no approved cost yet is not batched, as with the other triggers; When another trigger touches such a pack (e.g. a packing bill assigned), it joins the item as "first cost"; approving it sets its first approved cost.
- When nothing is re-approved, the message says "No pack re-approved."
### Fixed: price lists (defects 11 and 12; D-42)
- Revise and resend of a sent-back dealer list revision keeps the discount: a stored 0.05 fills the form as 5 (%). Before, it filled 0.05, which was sent as 0.05% (example figures: dealer net on 1,000 became 999.50, not 950).
- Distributor list: the previous price is the price on the last distributor list actually sent (Tahir 18 Oct, I-21, D-42). It moves only when a distributor list is issued in C2M; until then the list loaded from Yawar counts as the last sent. So an MRP-only revision no longer reprints the last price change as new, and 2 revisions before a list is sent are measured against what the distributors last received. A row with no previous price prints "new" and "New price", not "0.0%, No change", and is listed with the reasons for change. A row with no price prints neither.
### Tests
- New suite fix06.test.js (Y-01 to Y-08, 20 checks) in C2M App/tests, run by run-all.js after flow.test. On the 0.5.0 code 19 of the 20 fail (Y-01c proves behaviour that was already right).
- An independent review of the change (2 rounds) found 10 points, then 4 more on the follow-up: 7 of the first 10 fixed (#5 for material rates only; the labour and FOH half is I-20), 1 checked clean (I-23), 2 for Tahir (I-21, I-22); the 4 follow-up points fixed, with 1 for Tahir (I-24).
- TOTAL 119 passed, 0 failed, 0 crashed on a fresh c2m_test, 18 Oct 2026.
- Tahir's rulings of 18 Oct on the review points: I-20 a Rs 0 labour or FOH rate is missing; I-21 previous price = last list sent; I-22 approve today's cost and record it, as built (D-43); I-24 no price for a pack whose recipe is not in C2M.

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
