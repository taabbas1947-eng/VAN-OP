# 8. Release notes and change log
- **Speed fix (21 Oct 2026, after piece 3):** the state call took about 4.6 seconds on live because loadAll asked the database 16 questions one after another. They now run together in one wait (c2m-engine.js, loadAll). Nothing else changed; all suites pass. Second step: in c2m-routes.js (build) the 22 plain reads of the state call now start together after applyDueRevisions, instead of one after another; a list-only role (KAM) reads as before. The state output was compared before and after for 3 roles and is identical; independent review found no defect.

Version 1.0.3 · 20 Oct 2026 · Owner: Claude records; Tahir approves releases · Rule: R-5h item 8 (D-20)
Changed in 1.0.3 (20 Oct 2026; 1.0.2 went live on 20 Oct at 11:24): entry 1.0.3 added; 1.0.2 went live on 20 Oct at 11:24.
Changed in 1.0.2 (20 Oct 2026): entry 1.0.2 added; fixes from its reviews added; 1.0.1 went live on its own on 19 Oct at 23:19.
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

## [Next version, push 8: price lists easy to find, public price page, faster open] · 11 Nov 2026 · Who: Tahir asked; Claude built; not pushed · No migration
### Added
- A top tab **Price lists** for the CFO and the COO: every list (7 VAN brand lists and each white label client) as a card with **Download latest PDF**, which reuses the latest issued document and makes no new VAN/PL number. **Make a new one** opens the builder, 1 click behind. Under the cards: the steps to add a KAM or team member, the KAM lists screen, and a red flag naming anyone who holds the Price list viewer role but sees no list. GET /api/c2m/pricedocs/latest (pricedoc.all).
- A public price page for people with no login at /c2m/prices, fed by GET /api/public/c2m-prices: Punjab shows the Farmer list and the Distributor list; Sindh shows the Dealer list and the Distributor list (1 list for the country). Prices only: no cost, margin, previous price, % change, reason, payment terms, MRP, FRP or document number. Read only, 120 requests per visitor per 10 minutes, answer kept 60 seconds. Opening /c2m with no sign-in token goes to this page; the page links to Team sign in.
### Changed
- Speed: /api/c2m/state is kept 30 seconds per person and role and dropped the moment anyone saves in C2M (role changes on the launcher included); it sends a Server-Timing header (sweep, build) so the slow part can be read on live. A KAM's answer no longer works out products and recipes it then empties. Fonts no longer block the first paint.
- navFor: a role with see.margin and pricedoc.all gets the place pricelists after costs.

## [Next version, push 7g: screens tidied] · 10 Nov 2026 · D-168, D-169 · Who: Tahir ruled ("All 25 in 1 push"); Claude built and tested; not pushed · No migration
### Fixed
- The price list preview names the issuer as the PDF does. The brand page shows recipe kg with 4 decimals.
- Below target has 1 colour on every screen, Margin included: red when more than 2 points short of the target, amber when short within 2 points. The size of the Rs short no longer decides red (D-169).
- The price list issuer is kept in 1 place for the PDF and the preview.
- On a phone: the recipe line editor puts the kg box and Remove under the material; pack figures carry their labels; chart text stays readable; Find and the report column arrows are at least 40 px.
- The price list preview scrolls sideways inside its box. The label check says "density missing" and wraps.
### Changed
- Page titles in normal case and bigger; Clients and Month end have a title and an answer line. 1 corner size and a firmer card edge.
- Money on tiles and in lists in millions with 2 decimals; kg with 4 decimals; GP always with %; a missing figure shows as –; a phrase with no value is left out.
- Recipe page: 1 title, 1 answer line; missing material data only in the amber box; Open to write opens the line editor; Delete this draft after the step's action.
- Delete and Remove have a red outline. Product page: 1 action bar under the title, Propose a price once. Materials: Change cost in the row, History, Edit and Delete under More, no Rs in the cells.
- Guide: jobs grouped under the place each starts in, Start as outline buttons. What changed: 1 title, the 5 newest, see all in the Guide. Figures in Margin rows can be selected and copied. In-app change list entry 2026-11-10e.

## [Next version, push 7f: notices read, notices for launcher roles, the CFO and nutrients] · 10 Nov 2026 · D-167 · Who: Tahir ruled; Claude built and tested; not pushed · Migration 016 (Ahmer runs it)
### Changed
- For your information shows the notices not yet read, with Mark as read; read ones fold away for 30 days.
- A role made on the launcher that holds a recipe step gets that step's notices.
- The CFO no longer enters nutrients; the QC Head does.
- The QC Head's notes hide a figure written before Rs too. The line editor names a blank %. In-app change list entry 2026-11-10d.

## [Next version, push 7e: the role page, read and signed once] · 10 Nov 2026 · D-166 · Who: Tahir ruled; Claude built and tested; not pushed · No migration
### Added
- A page about each person's role in C2M, read and signed once per version before C2M opens. The COO does not sign; he sees who signed and reads each page on Setup, Record and checks, Role sign-offs.
- Guide: Read your role page. In-app change list entry 2026-11-10c.

## [Next version, push 7d: fixes from the walk of each screen] · 10 Nov 2026 · D-165 · Who: Tahir ruled; Claude built and tested; not pushed · No migration
### Fixed
- The QC Head no longer sees rupee figures in a recipe's history or note.
- Packs not costed show on Today only to those who can fix them; the CFO's labour and FOH job heads his list.
- Dates in notes read as 14 Oct 2026; re-approval lines no longer quote today's % against an older cause.
- Wording on Today, the recipes list, the recipe page and the material card. A Guide row for the Plant Manager's Inputs.
- In-app change list entry 2026-11-10b.

## [Next version, push 7c: liquids, % w/w and % w/v, densities] · 10 Nov 2026 · D-164 · Who: Tahir ruled (R70, R71, R72, R73); Claude built and tested; not pushed · Migration 015 (Ahmer runs it first)
### Added
- Each % on a material card is w/w or w/v, as its certificate states it; each nutrient on a label too.
- Densities, kg per L at 20 °C, with source and date: of a material (the QC Head, on its card) and of a product (the Production Manager, on Inputs, Declared grades).
- The analysis of a product sold per L is in % w/v, of one sold per kg in % w/w, with the other basis beside it once the product density is known. Label checks are made in the label's basis.
- A missing density makes only the figures that need it "not complete", naming it.
### Changed
- The nutrient list no longer asks w/w or w/v (it is on each value now).
- The line editor works out the analysis on the right basis, per 1 L for a liquid, and shows the lines' total kg per L as a hint.
- Recipe screens say kg per L for a product sold per L (they said kg per kg). A material whose density is needed and missing shows "density needed" on Materials and Today.
- In-app change list entry 2026-11-10a, held until 015 has run. Guide: 2 new rows (Enter the density of a material, Enter the density of a product); 3 rows say w/w or w/v.

## [Next version, push 7b: the recipe path, notices, the line editor, the check screen, Close] · 9 Nov 2026 · D-163 · Who: Tahir ruled (R63, R64, R65, R67, R68, R69); Claude built and tested; not pushed · No migration
### Added
- Notices at each recipe step: the next person is told, and the Production Manager is told when a recipe is approved, sent back or closed. The Production Manager, QC Head and Plant Manager now see their notices on Today.
- The line editor shows each material with its grade and what it carries, a Find box, the % of the mix, the live total and the live analysis against the label (warning only).
- The check screen: what changed against the approved version, the analysis against the label, material data missing with Open material.
- Close this version, with a reason, for the QC Head, Plant Manager and CFO at their step (and the sender of a draft sent back).
### Changed
- A resend goes to the QC Head when the lines changed since it was sent back; straight back to the sender only when no line changed.
- Another recipe of a product now goes Production Manager, QC Head, CFO (was Production Manager, CFO).
- Passing a recipe with something red (analysis not complete, below the label) needs a comment, kept on the step.
- Words: Write recipe, Revise recipe, Check recipe, Pass to the Plant Manager or the CFO, Send to the QC Head; sent back by first name.
- In-app change list entry 2026-11-09b by role; entry 2026-11-09a now waits until migration 014 has run and is remembered as not seen. Guide rows: Check a recipe (was Review a recipe), Close a recipe version (new), and 7 recipe rows rewritten.

## [Next version, push 7a: nutrient list, material cards, declared grades, a material with no rate] · 9 Nov 2026 · D-162 · Who: Tahir ruled (R60, R61, R62, R66); Claude built and tested; not pushed · Migration 014 (Ahmer runs it first)
### Added
- 1 nutrient list kept by the QC Head (Nutrients tab): each nutrient with how it is shown, its full name, its basis (K2O, not K) and % w/w or w/v. C2M stops a second one shown the same way; a nutrient is hidden, never deleted; the CFO is told of a new one.
- A card per material (Open): every nutrient it carries with its %, certificate and date; any nutrient from the list can be added whatever the class, or a new one added to the list from the card. The amino acid case is now 1 screen, with no message to the CFO.
- Declared grades tab: what each product's label promises, nutrient by nutrient, with a tolerance; the Default recipe is checked against it (meets, or below by how much). A warning only.
- A material can be added with no rate by the QC Head or the Production Manager (supplier or why required); the CFO is told and sees "… materials wait for your rate" on Approvals.
- The Production Manager now has Inputs (read only, plus Add a material).
### Changed
- A class (Classes tab) only suggests nutrients; the QC Head may add and edit classes too. A material saved by the QC Head is complete; a nutrient not on it counts as 0 (replaces the "Blank fields are 0" tick).
- Changing a material between 2 nutrient classes keeps its values, all on the card (before, values of fields the new class lacked were kept out of sight).
- Every class field and % already entered is copied into the new tables by C2M the first time it runs after migration 014.
- In-app change list entry 2026-11-09a, by role; Guide rows: Enter a material's nutrients (was Class a material and enter its nutrient %), Add a nutrient to the list, Enter a product's declared grade, Add a material that is not in the list, Add the rate of a new material; Add a material class rewritten.

## [Next version, push 6c: phone tap targets, Back, 1 tab style] · 7 Nov 2026 · D-161 · Who: Tahir ruled (R21, R58); Claude built and tested; not pushed · No migration
### Changed
- On a phone every control on Approvals, Clients and the brand pages is at least 40 px to tap (R21): re-approve ticks (the whole line), the target pencil, Open to approve, Open recipe, New price, chips, the Costs back links, the With others fold, Find boxes and path links. COO and CFO at 390 px: 265 and 272 small controls there before, 0 after. The laptop look is unchanged; rates and price list grids stay laptop work.
- The phone Back button stays inside C2M and goes back 1 step: brand page to client, client to Clients, report to Reports, a part of a place to the place, a place to the place before; an open panel, Find or More closes first. Typed text not saved: Back asks "Leave without saving?" on the page, Stay or Leave. The address names the place, so a reload opens it again if the person can, else Approvals.
- 1 tab style (R58): the underlined tab row for every switch between places and parts of a page (White Label and VAN Brands, Products and Price lists, Setup and its parts, the product page, Price history, Chart and Table); chips only for filters. The folder tabs of D-59 are replaced (Tahir confirmed the underline look, 7 Nov 2026).
- In-app change list entry 2026-11-07c, by role: Back and tabs for everyone; Approvals, Clients, re-approve ticks and the target pencil only for those with those places.

## [Next version, push 6b: Guide jobs with steps and Start, Find anything] · 7 Nov 2026 · D-160 · Who: Tahir ruled (R24, R25, R57); Claude built and tested; not pushed · No migration
### Changed
- The Guide (R25, R57): 1 row per job for every role (COO 36, CFO 55, Production Manager 10, QC Head 6, Plant Manager 5, KAM 4). A row shows the job and who does it; tap it for 3 to 6 numbered steps and what happens next; Start (40 px) opens the first screen of the job. The answer line says how many jobs the person has. The Production Manager, QC Head, Plant Manager and KAMs have job rows in place of their short lists. Doc 07 holds the same rows, with their steps, row for row.
- Fixed in the Guide: the Setup rows say More, Setup; Keep another recipe for a product goes through More, Products, + New (the CFO and COO have no Recipes place); Bought per, Kg (was "Bought per Kg"); Read a report names Your own report; the product page tab is Cost by pack.
- New jobs: Fix packs that are not costed; Price packs that are costed with no price; Check items from your sheets; Revise a price the COO sent back; Revise a list revision the COO sent back; Give a VAN brand pack a printed MRP; See a recipe that is stuck (COO); Approve the cost of a product that follows another's recipe; Find anything.
- Find anything (R24): clients from the client list, a client with no sales too, opening on Clients (White Label, or the VAN list of a distributor or dealer, or Setup, Clients for a client with no product), with its Margin as the next result; VAN brand products on Clients, VAN Brands, Products; the 5 price lists (distributor list, dealer list, farmer list, price list) and Make a price list PDF (MRP, PDF); All 5 side by side; KAM lists; Company settings; Change record; Sheet items; month end and lock; re-approvals; Your own report; the Guide's jobs (the row opens with its Start). Reports not built yet are not offered. A packing item (Bag 25) opens Packing cost filtered to it. Every result is a place the person can open.
- Fixed: choosing the place Reports in Find reopened the last report read; it now opens the Reports page, as the top bar does.
- Independent review 6b fixed: a Start or Find filter on Approvals that matched no line hid every job (now set only when a line matches, with "Showing only …: N other items hidden" and Show all); Find anything took 9.6 s a key at 150 clients (now under 10 ms); Guide rows need the job's right, so a role with Margin but no cost or price rights sees no action rows; the off-list line's button shows only for a role that can open the report; Margin and materials searches set by Find are cleared by the top bar; 12 Guide rows' step 1 matches where Start lands (doc 12).
- In-app change list entry 2026-11-07b.

## [Next version, push 6a: words, messages, farmer list lines] · 7 Nov 2026 · D-159 · Who: Tahir ruled (R26, R56, R59); Claude built and tested; not pushed · No migration
### Changed
- Margin, Margin by client and brand, and Your own report: farmers are not clients (R56). Farmer sales show under the farmer price list each sale was picked on: Farmer list, Punjab; Farmer list, Sindh cash; Farmer list, Sindh credit, each with its own GP and judged on that list's target. White label clients, distributors, dealers, COBO and VGreen stay client lines. Farmers and other is gone; a sale with no O2S category C2M knows shows as Other sales.
- A farmer sale or open PO line with no region in O2S is taken as on the Farmer list, Punjab (R59): its list freight, target and the VAN brand PO price check follow that list; Margin and the price check report say how many. A dealer with no region is unchanged.
- Words on every screen and in every server message (R26): client and client line; From and Till; Take out of use, Out of use, Put back in use; Labour and FOH; Sync setting and Price setting; Costs and Clients for the old place names; Labour rate Low, FOH rate High; no decision numbers, ruling numbers, R-codes, version numbers or migration numbers on screen ("This part is not switched on yet: IT has 1 step to run.").
- Messages give the next step: a row no longer in C2M (about 42 server messages), Nothing to save, and the unexpected error (Press Refresh and try again; tell IT the time). Status codes unchanged.
- Rupees show thousands commas (Rs 1,250.00) on screen and in server messages.
- In-app change list entry 2026-11-07a.

## [Next version, push 5b: Your own report] · 6 Nov 2026 · D-158 · Who: Tahir ruled (R52 to R54); Claude built and tested; not pushed · Needs migration 013 (Ahmer)
### Added
- Reports: Your own report, first on the page. Pick the data (Sales, Open POs, Pack cost, Client prices, VAN list prices, Rates, Kg made), the period, the columns in your order, the filters, and each row or totals by group; download as Excel, CSV or PDF. Sales totals agree with Margin; Kg made agrees with Month end.
- Save a report with a name: kept for you, listed under Your own report to open on today's data, rename or delete. Needs migration 013 (013_c2m_saved_report.sql, for Ahmer, after 012); until it is run Save is off and says so, and everything else works.
- Adjust on the bar of Cost history, Price history, Margin by client and brand and GP bridge: opens the report in Your own report on its data, dates, filters and columns. The other 3 reports show Adjust off, with the reason.
- Routes: GET /api/c2m/reports/rates and /api/c2m/reports/made (read only); GET and POST /api/c2m/reports/saved, POST /api/c2m/reports/saved/:id/rename and /delete (own reports only). All for the roles that see margin.
- Find: "Your own report". In-app change list entry 2026-11-06e.
### Changed
- Month end's charge on kg made (absorbedFor) can also hand back each entry as it is charged, for Kg made; its totals are unchanged (tested against the lock).

## [Next version, push 5a: Reports] · 6 Nov 2026 · D-157 · Who: Tahir ruled (R28, R30, R48 to R51); Claude built and tested; not pushed
### Added
- Reports: Cost history, Price history (client prices and the 5 VAN lists) and Margin by client and brand. 7 reports ready.
- Every report: opens on the current month; From and Till with quick choices; Columns (kept in this browser); tick rows; Excel, CSV and PDF of what is on the screen (PDF through the browser's print box).
- Routes GET /api/c2m/reports/costs and /api/c2m/reports/prices (read only, for the roles that see margin).
### Changed
- PO price against approved price: its This month, Last month and FY chips gave way to the date bar; the line chips stay. VAN brand PO against its price list: dates on the PO date. The old Export to Excel buttons gave way to Excel, CSV and PDF with the same content (GP bridge keeps its By pack sheet, VAN brand list margin its Links sheet).
- VAN brand list margin: GP after each list's freight, judged on the list's own target, as Clients › VAN Brands › Price lists; a list with no freight set says "freight not set" and is not judged; portfolio GP after list freight. "Farmer Sindh" reads "Farmer Sindh cash".
- Margin opened on a VAN brand: list freight is its own part of the cost; "Conversion" reads "Labour and FOH". Margin's note says VAN brand GP is after each sale's list freight (it still said "before freight out" after push 4).
- Open VAN brand PO rows carry their list's freight (state).
- Reports: Conversion recovery left Coming later (Costs › Month end answers it). In-app change list entry 2026-11-06d.

## [Next version, October from its 1st day] · 6 Nov 2026 · D-156 · Who: Tahir ruled (R47); Claude built and tested
### Changed
- Month end: kg made in October before the first labour and FOH rates (13 Oct) is charged at the 13 Oct rates, and Month end says how much.
- Stock of a base whose products were on different old rates is charged at the lowest of them.

## [Pushed 6 Nov, fix 4b: Month end finds stock products through O2S] · 6 Nov 2026 · D-155 · Who: Claude found and fixed; Tahir approves the push
### Fixed
- Month end: stock made for no brand is now charged at its products' rate. The base O2S writes on a production entry is matched through O2S's own product master; before, it was looked for among C2M's production lines, so most stock showed as "base not known".
- If O2S's product list cannot be read, Month end says so and the month cannot be locked until it is read.
- "What's changed since you last opened C2M": the change list is back in date order, so pushes 3a, 3b and 4 now show to anyone who has not seen them.

## [Pushed 38ae60b, Month end in 5 steps; VAN brand list freight in Margin] · 6 Nov 2026 · D-154 · Who: Claude built and tested; Tahir and Yawar ruled and approve the push
### Added
- Costs › Month end: 1 page per month in 5 steps: actuals, labour and FOH charged on kg made in O2S (each rate, kg, charged, actual, under or over), tie to the books, COO check (top material rates and every labour, FOH, packing and freight change, ticked as seen; the certificate), lock.
- Lock and reopen (the COO, reopen with a reason). A locked month's actuals and checks cannot change.
- Margin: VAN brand cost includes each sale's list freight; the month's labour and FOH actual less charged as 1 company line; a locked month shows its figures as locked and any change since.
### Changed
- The Approvals jobs for actuals, tie and rate check open Month end; the COO gets COO check and Lock jobs.
### Needs
- Migration 012 (apps/c2m/migrations/012_c2m_o2s_production.sql), locally first, then production by hand. Until then step 2 says it needs the migration; the rest works.

## [2026-11-05g, VAN price lists: 5 cards with target and freight] · 5 Nov 2026 · D-153 · pushed 6 Nov 2026 (commit 7173779) · Who: Claude built and tested; Tahir and Yawar ruled and approve the push
### Added
- VAN Brands, Price lists: 5 cards, each with its target GP and freight per kg, its packs and what is below target or cost after freight.
- Each list: cost, freight, list price, GP after freight and price for target per pack, worst first; New price sends a list revision for Monday.
- Change target or freight on a card: the effect shows first; Tahir approves, as company settings.
### Changed
- VAN Brands has 2 tabs, Products and Price lists. The 5-list grid is See all 5 side by side; the PDF builder opens from the cards (Make a price list PDF).
### Needs
- No migration.

## [2026-11-05f, Clients: client first, then its brand; prices change on Monday] · 5 Nov 2026 · D-152 · pushed 5 Nov 2026 (commit 2779501) · Who: Claude built and tested; Tahir and Yawar ruled and approve the push
### Changed
- The top bar is Approvals, Clients, Margin, Costs and More. Client prices is inside Clients; Products moves under More (until push 3b).
- A new client price or VAN list revision takes effect on a Monday, the cost day (next Monday unless a later Monday is picked). One whose Monday passes while it waits for Tahir takes the next Monday. Urgent: ticked with a reason; it goes in the day Tahir approves it and comes first on his Approvals.
### Added
- Clients opens on White Label; a switch at the top goes to VAN Brands, each side saying what waits and what is below target. Clients remembers the side last used.
- White Label: the client page (as Client prices was) with each brand opening its brand page: recipe, cost by pack, Existing, Current and Projected prices with GP, margin FY to date and open POs, New price.
- VAN Brands: Products (recipe, cost, standard margin), Prices by list and Price lists.
### Needs
- No migration.

## [2026-11-05e, Packing bills pick their packs; freight regions from a list] · 5 Nov 2026 · D-151 · pushed 5 Nov 2026 (commit c1fb8d1) · Who: Claude built and tested; Tahir and Yawar ruled and approve the push
### Added
- Costs, Packing cost: each bill lists its packs (white label and VAN brand, not bulk or client packed). Tick the packs: a pack with no bill gets it at once; a pack on another bill moves on Monday.
### Changed
- Moving a pack to another bill (also from the product page) waits for Monday; its first bill goes in at once. A bill save with unchanged items goes in at once.
- Set freight: the region is a list of the regions on clients and freight rows; a region on neither is refused.
- A pack waits to move in only 1 change at a time; the product's Edit form refuses a bill move Tuesday to Sunday and points to Costs, Packing cost.

## [2026-11-05d, Labour and FOH: Low and High] · 5 Nov 2026 · D-150 · pushed 5 Nov 2026 (commit 4e2ccaf) · Who: Claude built and tested; Tahir and Yawar ruled and approve the push
### Changed
- Labour and FOH are 4 named rates, Rs per kg or L: Labour Low, Labour High, FOH Low, FOH High. Every product starts on Low. The old special rates are retired (kept in the record) and their forms refuse.
- Until the 4 figures are filled, packs show "no labour rate" or "no FOH rate"; approved costs, prices and Margin do not change.
### Added
- Costs, Labour or FOH: each rate with Fill or Change and History; Add a named rate; every product with Low or High (filters: All, On Low, On High, White label, VAN brands). The effect shows before saving.
- A change or a move is in force from the day saved. Until 30 Nov 2026 the first figure of a rate and a product's first move need no re-approval; when all the rates are filled, each pack's cost that day becomes its approved cost.
- Monthly certificate by the 5th (No change or Changed), starting with the month of the switch; Approvals reminds the CFO.
### Needs
- Migration 011 (apps/c2m/migrations/011_c2m_labour_foh_low_high.sql), locally first, then production by hand. The switch happens when it runs.

## [2026-11-05c, Monday is cost day] · 5 Nov 2026 · D-149 · pushed 5 Nov 2026 (commit d3e8e85) · Who: Claude built and tested; Tahir and Yawar ruled and approve the push
### Changed
- Material, packing and freight costs change once a week. Saved on a Monday a change goes in at once; saved Tuesday to Sunday it waits in Next week's costs and goes in at Monday 00:00. A first cost goes in at once. Labour and FOH are not in this cycle.
### Added
- Costs, Open next week's costs: each waiting change with today's figure, Monday's, the change % and the packs that move; Change or Drop until Monday. The lists show the waiting figure under today's.
- Urgent change: a reason, and Tahir approves it on Approvals (Approve now, or Not urgent: Monday).
- Correct (1 hour): the person who saved a change that went in can correct the figure within the hour; the effect shows first.
### Needs
- Migration 010 (apps/c2m/migrations/010_c2m_cost_pending.sql), locally first, then production by hand. Until then every change goes in when saved, as before.

## [2026-11-05b, Costs has its own place] · 5 Nov 2026 · D-148 · pushed 5 Nov 2026 (commit 02900da) · Who: Claude built and tested; Tahir and Yawar ruled and approve the push
### Changed
- Costs is in the top bar for the CFO and COO. It opens on 6 boxes: Material cost, Packing cost, Labour, FOH, Freight cost and Month end, each with its figures, what waits and what is wrong, and Open. Setup moved under More (clients, products, settings, record and checks).
- A packing price, packing bill, labour, FOH or freight change shows its effect before it is saved: the first Save lists the packs whose cost moves more than the re-approval % and saves nothing; Save again keeps it. Material "Try a new rate" is now "Change cost".
- After a save on Costs a box stays on the screen: what was saved, how many packs wait for re-approval, and Open Approvals, Change another, Back to Costs, Close.
### Added
- History on each material: its last 6 costs, with the change in % and who entered it.
### Fixed
- When the internet drops, C2M says it could not reach the server (and that nothing was saved) instead of "Failed to fetch".
- The Packing cost box counts only packs that need a bill (not bulk or client packed); the Freight cost box counts the rates in force today.

## [2026-11-05a, 7 cost saves made safe] · 5 Nov 2026 · D-147 · pushed 5 Nov 2026 (commit 6dc6263) · Who: Claude built and tested; Tahir and Yawar ruled and approve the push
### Fixed
- Material and packing edits: a new rate or price typed with a new name or class is no longer lost.
- Settings and month-end actuals: an empty box is no longer saved as 0.
- Freight: regions match whatever the capitals; Delete checks the rate in force today.
- Labour and FOH: a second rate for exactly the same products is refused.

## [2026-11-04d, VAN brand PO price check] · 4 Nov 2026 · D-146 · pushed 5 Nov 2026 (commit 1f92a10) · Who: Claude built and tested; Tahir ruled and approves the push
### Added
- Each VAN brand PO since 11 Oct is compared with the price list in force on its date and marked (at list within 1%, above, below, not on its list, cost only, not checked). Report: More, Reports, VAN brand PO against its price list, with Excel. A line on Approvals for the CFO and COO when any PO is off its list.
- Migration 009: c2m_o2s_po_line.region, filled from O2S at each pull.
### Not changed
- No PO is blocked; Margin and the PO price report are unchanged.

## [Next version, daily O2S pull, POs by their time, audit fixes] · 4 Nov 2026 · D-145 · Who: Claude built and tested; Tahir ruled and approves the push
### Added
- C2M pulls O2S by itself every day at about 06:00 (and once after a restart when the last pull is 20 h old). Pull now stays.
- Migration 008: c2m_o2s_po_line.entered_at, filled from O2S at each pull.
### Changed
- A PO is checked against the price in force when it was entered (F-20, F-30). A price approved later the same day no longer marks that PO.
- A freight rate dated ahead waits for its date; a freight save waits for re-approval like any cost.
- Stuck jobs show working days.
- Roles: the C2M Roles screen and its routes are removed (the System Administrator designs roles on the launcher).
### Fixed
- A double click sends once: the list send, the client price send and Create PDF.
- After a save whose refresh failed: "Saved. The screen could not refresh" (it said nothing was saved).
- Re-approval dismiss and its re-batch in 1 transaction.
- First load: a line after 20 s; on failure the reason, Retry and Back to launcher.
- A target of 0 counts as no target on the server too; a missing re-approval % means 3; margin roles without Settings get the settings their figures need.
- Client prices header GP with no expected kg is weighted by price, not an average of %.
- Sign out no longer calls an address that does not exist.
- Speed: the roles are read once per request; the C2M page is revalidated instead of downloaded on each open.
### Database
- Migration 008 (local first; production by hand). Until it runs: the pull leaves the column alone and a price approved on a PO's own date is not used for that PO.

## [Next version, add a material class] · 4 Nov 2026 · D-144 · Who: Claude built and tested; Tahir ruled and approves the push
### Added
- Setup, Costs, Materials: "Add a material class" (CFO). A name, whether it carries nutrients, and the % it asks, e.g. N%, Amino acid%, OM%. The new class shows at once in every material's Class list; the QC Head then enters its %.
- Route POST /api/c2m/material-types (material.save). Rule in c2m-lib.js newMaterialClass (tested alone).
- What changed box: entry 2026-11-04b for the CFO and the QC Head; Guide row "Add a material class".
### Database
- None.

## [Next version, back to the launcher and a faster first load] · 4 Nov 2026 · D-143 · Who: Claude built and checked in a browser at 15 widths; Tahir ruled and approves the push
### Fixed
- The top bar links back to the VAN Systems launcher at every width, beside Sign out: "Back to launcher" from 1401 px, "Launcher" from 1101 to 1400 px and on a phone, a house icon from 761 to 1100 px. Before, the link sat inside the role label and was hidden at every width (from 761 px by `.hdr .foot .launch-w{display:none}`, on a phone with the role label); the only way back was the C2M logo.
- C2M has its own tab icon (`/assets/favicon.png`). Before, the browser asked for /favicon.ico, which the platform's catch-all answers with o2s.html (4.2 MB): measured live on 3 Nov, 5.7 s during C2M's first load, holding up the logo.
- The top bar fits from 761 px up. Before, tabs were cut off at 1101 to 1250 px and drawn over each other at 761 to 860 px. From 761 to 1300 px the tab icons and the word Find are left out and tabs pad less; from 761 to 900 px the first name is left out.
- The What changed box has the entry 2026-11-04a for everyone who sees Products or Margin.
### Database
- None.
### Not changed
- The state call (2.9 to 5.1 s live) and the reload after every save: written up in the 3 Nov audit, not in this change.

## [Next version, update notice] · 30 Oct 2026 · D-141 · Who: Claude built; Tahir ruled and approves the push
### Added
- At login, a box lists what changed since the person last opened C2M, only the lines for their job, each with a link to its Guide row; Got it closes it. The Guide keeps every update under What changed.
### Database
- None.

## [Next version, Yawar's feedback] · 30 Oct 2026 · D-137 to D-140 · Who: Claude built; an independent reviewer checked; Tahir ruled and approves the push
### Fixed
- Send back on a VAN brand list revision, in its panel, opens the reason box. Before, the page stopped (D-137).
### Added
- A Find box above every list, the same everywhere, filtering as you type with "2 of 59" (D-138).
- The definition of variant (the form) and pack (the size) on the forms; a variant named like a size is stopped (D-138).
- Edit and Delete on every list; Take out of use and Put back in use for materials, packing items, packing bills and clients; a client product's Edit with the Add a product form; delete a draft recipe (D-139).
- Another recipe for a product beside the Default, on the short path; Make default by Yawar; the approved recipes and their cost on the product page (D-140).
### Changed
- A product page's Trucks lists every truck (was the last 40), so its search finds any.
- Setup, Products and variants: Edit names is called Edit.
### Database
- Migration 007 (3 new tables). Without it C2M works as before; the new parts that need it say so.

## [Next version, reopened lines] · 29 Oct 2026 · D-136 · Who: Claude built; Tahir ruled and approves the push
### Fixed
- A PO line that the COO reopens in O2S is open again in C2M. Before, C2M kept it at 0 Kg open and short-closed, so the open orders and margin lists left it out while O2S was producing and shipping it.
### Known limits
- A line reopened between two pulls shows as closed until the next pull. The pull runs when someone presses it; there is no timer.
### Database
- None.

## [Next version, name on price lists] · 22 Oct 2026 · D-109 · Who: Claude built; Tahir ruled and approves the push
### Added
- Customers, Edit: Name on price lists and documents. Labels now say which name is which; O2S names are marked matching only. Setup, Clients and buyer lines has an Open Customers button.
### Database
- Migration 004: 1 column, c2m_customer.print_name. Run before the box can be saved; until then it shows a notice.

## [Next version, price lists] · 22 Oct 2026 · Price list review (D-101 to D-107) · Who: Claude built; Tahir ruled and approves the push
### Changed
- All price lists print 1 signature: Issued by Yawar Hussain, CFO.
- White label list: new column Price per pack, Rs ex FED; title month is the month of issue; colour key under the table; note Valid until replaced by a later list when no Valid till.
- Farmer and website lists: Pack size column, split from the product name.
- A client price must be a whole rupee when proposed.
### Known limits
- Spelling Sulfur (D-108) is not applied: the list of names waits for Tahir.
- An older document reprinted shows the issue month in its title and has no Approved by.
### Database
- None.

## [Next version, piece 4] · 22 Oct 2026 · The new look (D-92, D-93, D-99, D-100) · Who: Claude built; Tahir ruled and approves the push
### Added
- 4 looks, chosen per person: Silver cool (default), Slate light, Stone warm, Slate dusk (dark). Pick one with the 4 dots in the top bar, or in Guide, Your look. The choice is kept in that browser, so each device remembers its own.
- Home: the verdict (white label GP FY to date against target, with the 6 month trend) on the left for those who see margin; for others, a Your day card (jobs, oldest waiting, stuck, with others). Your jobs on the right, red and stuck first, then oldest first, each with an edge colour and a word (Act now, Stuck, Waiting, To do).
- Products: client list on the left with each client's colour square, product count and how many need work; a To do column (Not costed, Set price, Fix price, Your step, Below target, With Majid, OK). On a phone the list is a drop down.
### Changed
- The left rail is now a top bar on a computer (phone keeps its top bar and bottom tabs). Top bar shows first name only. Tabs bolder; table lines thinner and dimmer; product headings smaller.
- Status colours mean only: red = act or stuck, amber = waiting, green = fine, grey = information, always with a word. Client colours never use red, amber or green.
- The white label margin line above the Home is gone; the verdict replaces it. Home no longer groups jobs under To approve and To do.
### Known limits
- A person on a computer with the operating system set to dark now sees Silver until they choose Slate dusk.
- Client colours follow the list of clients a person can see, so two people with different lists can see different colours for the same client.
### Database
- None.

## [Next version, piece 3] · 21 Oct 2026 · Add client and variants (D-94, D-95, D-98) · Who: Claude built; Tahir ruled and approves the push
### Added
- Setup, Clients and buyer lines: Add client (step 1: name, other O2S spellings, what it buys: VAN brand, White label or Both) and, on each client that can have its own brands, Add a product (step 2: brand name as O2S writes it, product type, follows a VAN product's recipe or not, variant, form, who supplies the packing: VAN, Client or Bulk, other O2S spellings, packs with size, packing bill and "only for this client"). A Products column shows how many products each client has. The group follows the products (Excel, a VAN brand client, becomes Both when it gets its own brand).
- Setup, Variants: each VAN product's variants, the packs, the rates set per variant, Add a variant, and Tag an existing product's variant (Fusion Potash Granular and Powder stay separate products; no recipe, pack or cost moves). Majid adds a variant from a VAN product's page (he has no Setup).
- Add a variant makes a new VAN product whose recipe starts as a copy of the main product's approved recipe, as a draft that goes through the usual 4 steps.
- A white label product can follow a VAN product's recipe: 1 recipe, 1 approved cost for the material part; its packing, labour and overhead are its own. When the followed recipe is approved, each fully costed pack of its followers gets a new approved cost; a follower's own Approve cost (CFO step) covers a change of its own packing or rates.
- Labour, FOH and targets: a rate can apply to a variant. Rate order: the client's pack, the variant, the product type, the general rate.
- New actions client.add (Add a client, product or pack: CFO, COO) and variant.add (Add or tag a variant: CFO, Production Manager, COO).
- Routes: POST /api/c2m/clients, /clients/:id/products, /products/:id/packs, /products/:id/variant, /variants, /products/:id/follow, /products/:id/approve-cost; POST /rules/conversion takes scope variant.
### Changed
- A follower has no recipe of its own: Write a new recipe version is refused for it; its product page says what it follows. The Recipe in progress filter leaves followers out.
- A VAN product that has followers cannot be taken out of use until they stop following it.
- State carries families, variants, follows and the pack's client tag (ST.families, ST.variantsReady).
### Known limits
- Migration 003 must be run first (5 tables); before it the screens say so and everything else works as before. A role you edited that lost its anchor action (customer.edit, recipe.start) does not get the new action from the migration: tick it in Roles.
- A follower pack that is not fully costed when its followed recipe is approved keeps its old approved cost until it is costed and Approve cost is pressed; nothing flags it (a possible later change).
- Re-running migration 002 to restore a deleted starting role gives it no client.add or variant.add: run 003 again.
- Add a product is offered on every client row that can have its own brand (the picture showed it on Excel and not on Kashmir).
### Database
- 5 new tables (45 in all): c2m_product_family, c2m_product_variant, c2m_product_ext, c2m_pack_ext, c2m_rule_variant. No existing table or column changed.
### Tests
- p3.test.js 93 checks (rate order, add client, add product, packs, follows and cost arithmetic, variants and recipe copy, rate by variant, tags, permissions, group rule, the 12 review fixes, and the app with migration 003 not run), p3ui.js 59 checks on desktop and phone (screens, typed values kept across redraws, no page errors, no sideways scroll, Majid's page); the 270 role checks, roles and KAM suites still pass.
### What to test after (on live)
- Run migration 003 in phpMyAdmin (003_c2m_variants_clients.PRODUCTION.sql). Add Pellets as a variant of Humi Grow (the recipe is a copy); add a product to FMC (Humi Grow, Pellets, follows) and to Excel Chemical (Humic Grow, Powder, follows; 8 kg and a 25 kg pack only for Excel); approve the Pellets recipe and see FMC's pack get its approved cost; set a rate for a variant and see only that variant's packs move; Excel's group reads Both.

## [Next version, piece 2] · 21 Oct 2026 · KAM lists (D-91, D-97) · Who: Claude built; Tahir ruled and approves the push
### Added
- Setup, KAM lists: 1 manager at a time, the price lists he may see and print, and the white label clients as chips; Tick all clients, Clear clients, Copy from another manager (asks to confirm when he has ticks), See what this person sees (his own screen, read only).
- Routes POST /api/c2m/grants/clients, POST /api/c2m/grants/copy and GET /api/c2m/state?as=username.
### Changed
- The old tick grid (People and list access) is gone; Tahir and Ahmer, who see every list, are no longer listed as managers. The tab is named KAM lists.
- A manager with nothing granted is told to ask Tahir or Yawar.
### Known limits
- Nobody is told when a list is granted. A client added later is not ticked for anyone by itself.
- Tests: 36 route checks and a browser run on desktop and phone, in a throw-away database; C2M's own suites (c2m100 to c2m103) are outside the repository and were not run.

## [Next, number set at the push] · 21 Oct 2026 · Piece 1 of 4: Access and Roles (D-89, D-90) · Who: Claude built; Tahir ruled and approves the push
### Added
- Setup, Roles (administrator only): create, edit and delete roles by ticking what each may do; the 6 starting roles are editable; a role held by a person is not deleted.
- Migration 002_c2m_roles.sql (and its PRODUCTION version): the table c2m_role. Run it once, by hand. Until then C2M works on the 6 built-in roles and the Roles screen says so.
### Changed
- The COO role is the system administrator: every action, locked. Tahir and Ahmer Shehzad hold it. It is exempt from "nobody approves what they proposed" and from the second-person rate check.
- Anyone below the administrator who is given an approve right approves only what an administrator proposed.
- The 45 route guards and about 50 checks in the page now look at ticked actions, not at the role's name. The 6 starting roles keep exactly their old rights (270 route checks, 0 differences).
### Known limits
- A role made here is given to a person in the platform's People and access (platform piece 1b, Ahmer Shehzad, 21 Oct 2026; checked live).
- The administrator can take a recipe through all 4 steps alone (ruled by Tahir, D-96). Notices still go to the CFO and COO roles by name.
- The earlier test suites (c2m100 to c2m103) were not run in the session that built this.

## [1.0.3] · 20 Oct 2026 · 1 master list: the 3 price lists print from the master (D-87) · Who: Claude built; Tahir ruled and approves the push
### Added
- The carry-over into the master (Tahir or Yawar, once): Client prices, VAN brand prices, Carry into the master; also from Setup, Product names, the VAN brand list margin report, the price list builder and Approvals (opens in a panel). 1 screen: rows already linked stay; C2M matches the rest by name and size, by a loose name (no %, no words in brackets) or by spec and size, shown to check; 1 pick per name for every list; a row with no pack of its size gets a pack pick; 2 rows on 1 pack choose the row kept; rows that leave are listed; Carry over with a 2-step confirm, saved only as the plan seen.
- Rows not carried kept read only (lists dist_old, dealer_old, farmer_old), each in the change record.
### Changed
- Every list prints from the master after the carry-over: official name and pack, products A to Z, packs small to large; a rename prints at once (D-87).
- The issued distributor list sets each row's previous price by master pack.
- After the carry-over a row cannot be unlinked or marked; it can be moved to another pack of the same size in the VAN brand list margin report.
- Setup, Product names: Names to settle lists O2S names only; Approvals: "Names to settle" for O2S names, "Carry the price lists into the master" until it is done.
### Added after review (20 Oct 2026; Tahir's rulings D-88)
- Take off a list (Tahir or Yawar, no approval, with a reason; the other is told); "Off the lists" shows every row off the lists with its prices, read only.
- The description on all 3 lists is C2M's, edited in Product names.
- On the carry-over: each row that would leave is chosen; prices and marks shown on each row; rows already linked listed to check; 2 rows already linked to 1 pack become a choice; a stale pick is dropped and named; official names with brackets flagged; revisions Tahir sent back closed and Yawar told; the other person told of the carry-over; counts reworded.
- 2 rows swap packs in 1 save; a revision cannot be sent or approved onto a row that left the list; reasons on the distributor list keyed by product and pack.
- After the re-check: a move tells the other person and is refused while a revision holds the row; a price typed for a row moved meanwhile is refused; a pack coming back brings its other prices; several lists of 1 pack taken off in 1 go; the take-off box sits above the grid (fits a phone); a product with no description prints none and is named; the carry-over keeps picks on coming back and reads the plan again after each change; row picks only to the name's product; the carry saves only the plan seen, rows already linked included.
- After the fourth check: a pack brought back takes the prices of the row that left last, never a row dropped at the carry-over because another row was kept for its pack (such rows do not show "back on the list"); "Revise and resend" after a row was moved fills nothing for that row, says why, and sends a price typed for the pack it is on now; prices that came back are not filled in again as typed, so they stay marked for Tahir; moves told in as many notices as needed, each move whole (a notice holds 400 characters); a price typed to add a pack is refused (409) when a row was moved onto that pack at the same moment; Tahir's approval panel shows every price of a revision; after the fifth check, a distributor pack brought back keeps the price distributors last saw, the moved-row note names the pack the price was typed for, a resend whose added pack got a row meanwhile puts the typed price on that row, and an empty grid cell never shows "off since" from a duplicate; after the sixth check, "Revise and resend" lists every change since typing (taken off, moved, now on the list) in 1 box above the form with what was typed and fills nothing in for them, and a distributor list issued ahead of a returning pack's date sets its previous price; after the seventh check, issuing a distributor list before the carry-over sets previous prices by name again (as in 1.0.2), and every revision form records each row's pack when it opens, so a move meanwhile is refused, and the refusal names the pack typed for; the take-off button counts only lists that can be ticked; a description refused after the names were saved says so plainly and shows the words typed.
- Live data, through the screens, 20 Oct 2026 (Tahir's OK): 5 official names set to the trade name; the outsourced cost sheet of 1 product taken out of use (D-86).
### Removed
- Not placed, the mark "Not a C2M pack" with Undo, Rename and link, Unlink, Rename linked rows and the report's link picks, from the screens (the routes stay until the carry-over, for safety). "Change prices of marked rows".
### Migrations to run
- None. No table, column or production SQL.
### What to test after
- Live, as Tahir, read only: Client prices, VAN brand prices shows "Carry into the master"; the carry-over screen shows the counts and guesses; nothing is carried until Tahir or Yawar presses Carry over.
- After Tahir or Yawar carries over: the lists print in master order under official names; Approvals has no carry-over job.

## [1.0.2] · 19 Oct 2026 · Product names: 1 name per product everywhere (D-85) and product out of use (D-86) · 1.0.1 went live on its own on 19 Oct at 23:19 · Who: Claude built; Tahir ruled and approves the push
### Added
- Setup, Product names (Tahir and Yawar): Names to settle (list rows with no pack, with C2M's guess by name and size or by spec and size; O2S names C2M cannot place, with a guess by shared words and size; linked rows still under another name) and the table of official names, packs, O2S spellings, lists and last change, with Edit (D-85).
### Changed
- A list row linked to a pack, from any screen, takes the pack's official name and the pack as C2M writes it (1 L, 25 kg); its first name is kept and given back if it is unlinked (D-85).
- Tahir can link list rows too; the "not a C2M pack" mark stays Yawar's (D-80, D-85).
- The official name of a VAN brand product always matches an O2S line, besides its spellings (D-85).
### Fixed after review (20 Oct 2026)
- 2 people editing the same names: the second save is refused with the names now; a link made on an out-of-date screen is refused (review finding 1).
- A rename or a removed spelling could take the cost off past trucks unseen: the name before a rename stays as a spelling; a change that moves trucks shows their count, Rs and first date, and saves only on Save anyway (finding 2).
- The mark "not a C2M pack" and an added pack are checked against every name of the product, not only the official name (finding 4).
- Names are checked and changed with the VAN brand products locked and read inside the transaction (findings 6 and 7).
- A shared trade name is allowed across different pack sizes (Tahir, 20 Oct 2026); the clash message keeps the name as written.
- A revision still open shows today's names; a pack it adds takes its row under today's official name.
- Rows written with no size can be picked; Tahir links under Not placed and in the VAN brand list margin report; the link toasts and help say the row takes the official name.
- O2S spellings are edited 1 per line; O2S names are grouped by exact name (case and spaces) and picked by name; the server refuses a spelling for a product with no pack of its size; pack sizes such as 0.5 show as 0.5.
- The product table's column "On price lists as" shows the names the lists print; spellings equal to the official name are shown.
- Approvals carries "Names to settle" (opens in a panel); Setup, From O2S points to Product names.
### Added after the re-check (20 Oct 2026)
- Take out of use and Put back in use for VAN brand products, in Setup, Product names (Tahir: "A button in Setup", D-86), with the trucks shown first; nothing deleted.
- Packs under 1 L or 1 kg written 500 ml, 250 g (D-86).
- A list row whose size can be read is offered only packs of that size and unit, on every pick.
- A pick in the VAN brand list margin report carries the link shown when it was made: a newer link by someone else is never overwritten (409). A double click sends 1 save.
- O2S picks show each product's pack and unit, with "O2S gives the size only: check the unit".
- 2 products sharing a trade name can both keep just that name as their spelling.
- The name before a rename is kept only when O2S trucks or an unlinked list row use it.
- The price list builder warns when a VAN list still has rows not settled.
- Recipes and Approvals show the packs beside a trade name 2 products share; the GP bridge names packs by their official name.
### Fixed after the second re-check (20 Oct 2026)
- Out of use: refused while a recipe version is in the workflow; its recipes leave the screens; its O2S names are left out of Names to settle and cannot be kept as another product's spelling; a revision cannot add its pack and Tahir cannot approve one that does (names locked in revise and approve).
- The check before a name change counts open O2S order lines too; the name before a rename is kept when an order line uses it; Names to settle lists O2S names on open orders not yet shipped.
- The links route refuses a pack of another size or unit than the row is written with.
- A click while another save runs says "Wait: the last save is still running."; a link to a pack whose product is out of use says so.
### Fixed after the fourth check (20 Oct 2026)
- A new official name with a pack size in it is refused (trade name only); Names to settle counts rows linked to another size on every screen, and the Approvals panel lists them; the check reads right when only open orders move; 2 people starting a recipe version at once get the clear message.
### Fixed after the third re-check (20 Oct 2026)
- Rename to official names, and a product rename, never rename a row linked to a pack of another size; Product names lists such rows with Unlink.
- Edit refuses a name of a product out of use; no recipe version can be started for a product out of use.
- The check before saving reads right when only open orders move ("would arrive with no cost; no past report changes"); toasts and the change record count open order lines.
### API
- POST /api/c2m/names/product/:id/use (D-86);
- POST /api/c2m/names/rename-linked, /api/c2m/names/product/:id, /api/c2m/names/o2s; POST /api/c2m/lists/links open to coo; state: products o2sNames and nameLog for cfo and coo.
### Database
- No table, column or migration. Production SQL: none. The first push changes no name: names change only when Tahir or Yawar settle or edit them.
### Tests
- New suite c2m102.test (X-01 to X-11; X-06 to X-11 added after review); ui08 U-02 and c2m100 T-11 (11 Setup tabs); van093 L-01 (Tahir links), L-06 (a free pack); c2m101 freeRows (rows renamed to names no pack has). TOTAL 203 passed, 0 failed.
### What to test after (on live)
- Tahir or Yawar: Setup, Product names: check C2M's guess on 2 or 3 of the 33 rows and Rename and link them; press Rename linked rows (twice) and check 1 price list prints the official names; edit 1 spelling and put it back.

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

## Guide: Who does what (22 Oct 2026)
- In the app, Guide shows a new part "Who does what" to every role: 6 boxes (Majid, Himayat, Fahim, Yawar, Tahir, KAMs and managers), the reader's own box marked "(this is you)". "How C2M works" now also covers new clients and products, variants, KAM lists and the change record.
- Doc 07 starts with the same text, "Who does what, and how C2M works (read this first)", with how a thing moves through C2M and a new clients, products and variants part.
- Changed: c2m.html (WHO list and vGuide), docs 03 (3.24), 07, 08, 11, 12. No migration, no route change.


## Rename a client (22 Oct 2026)
- Customers, Edit has a new box, Customer name in C2M. A rename moves KAM grants and issued-document links in the same save and is written in the audit trail.
- Changed: c2m-routes.js, c2m.html (Customers edit form, Guide). No migration.

## [Next version] · 23 Oct 2026 · D-111 to D-116 · Who: Claude built; Tahir ruled and approves the push
- Margin page redesigned (D-111); Products by client with a + New menu (D-112); More menu under its button (D-113); audit fixes (D-114); Setup and Back office merged (D-115); white label product corrections and Guide first day (D-116).
- Tests: runall.sh (regress, roles, KAM, KAM UI, p3, p3 UI, fix07: blank target, same-day price, rename, out of use, remove pack) all pass on the local database; the screens were checked at 1440, 1000 and 390 px. Not tested live, and Margin only with synthetic trucks.
- After the push: check live that Products shows client rows, + New opens, Margin opens on the whole company, Setup shows 4 groups and Client details, and Approvals shows no "n/a".
- Migration 005 (23 Oct 2026, D-118): Sulfur spelling in 5 product descriptions and 3 material names. Data only, no screen change. Run once in phpMyAdmin.

## [Next version] · 26 Oct 2026 · D-119 to D-121 · Who: 2 independent reviewers found; Claude built; Tahir ruled and approves the push
- Packing: an item bought per kg (plastic inners) is typed as Rs per kg and pieces in 1 kg; C2M shows 860 / 29 = Rs 29.66 per piece and (860 / 29) / 25 = Rs 1.19 per kg on a 25 kg pack. No migration needed.
- A new pack on a product with an approved recipe waits on Approvals for its first cost at once. Margin's "not counted" line names the packs.
- Try a new rate and Change packing price keep the typing; the first click on Show effect works; Save is ready without Tab. "Extra cost on open POs" replaces "Rs on open POs"; Price for target shows for products on the company target.
- Add a product asks first: is it a VAN product in the client's bag? Majid gets "Write the first recipe" when it is not.
- A cost approved today applies to trucks from tomorrow (D-120). Price approval and re-approval messages say what really changes.
- Client prices: Target column (change, or use company), sent to Tahir with prices in 1 send, with the Rs effect on Margin shown first; a warning, ticked, before a typed price cancels an approved later price; title line with client, basis and unit; empty New price boxes.
- + New opens its form on Products; forms close when the place changes; Setup in 5 tabs; Inputs is Setup, Costs; Approvals ends with "End of your list"; front page chart names the month of its last GP and target.
- Guide: "I want to" table and first day rewritten to the new homes; Tahir may approve his own proposal, said in 1 place.
- Tests: runall.sh adds fix08.test (inner per kg, carton, cost from the next day, back to company target, first cost for a new pack) and fix08ui (on live-sized data: Approvals end, 5 Setup tabs, bought per kg, rate box typing, + New in place, the 1 question, target column, phone width). All pass.
- Independent check of this version (26 Oct 2026, after the build) found 2 blockers and 8 wrong results; all fixed before hand-over: the packing price tick no longer empties the boxes; Setup, Costs, Materials now holds the full materials screen (add a material, class and nutrient %, Try a new rate); targets are sent only after every price check passes; "company" uses the product's own flag (targetDefault); "Write the first recipe" goes to the recipe writer only (recipe.step.draft); the product page has Add a pack; the cancel warning shows for any approved later price (approving a price cancels every waiting later one); a changed rate clears the old effect and tick; messages for first cost, recipe cost approval and Majid's list are true; the target effect counts this FY only; a source too long or a price too large is refused with a message; old place names replaced across the app and server messages. fix08ui grows to 33 checks.

## [Next version] · 26 Oct 2026 · D-122 · MRP printing list
- Client prices, Price lists: new choice "MRP printing list (packing and printer)": Product, Specification, Pack size, MRP Rs (with FED), Based on. MRP = Sindh credit price rounded up to the next Rs 50; no credit price: the highest farmer price, rounded the same way.
- Dealer and Distributor lists: their MRP is now called Recommended MRP (a suggested price, not the printed one), on screens, revisions and PDFs.
- Approvals and Margin name every list price above its printed MRP; the VAN brand prices send bar warns as Yawar types.
- Tests: fix09.test (rule, issues, document, KAM refused) and fix09ui (preview, PDF, warnings) on a seeded copy; runall.sh all pass.
- Live check of D-122 (26 Oct 2026): 37 farmer rows, all MRPs from the Sindh credit price; no price above its MRP. Found and fixed: the pack size was blank for 17 rows named with Liter, (01 Liter) or 05-kg (the name reader now knows Liter, Litre, Ltr, Lit, KGs, gm and thousands commas; units print as kg, L, ml, g); every farmer row is now checked against its own MRP before the carry-over into the master (only 21 of 89 live list rows are linked to packs, so the Dealer and Distributor checks and the packs-with-no-MRP job start after the carry-over).

## [Next version] · 26 Oct 2026 · Round 4 (D-124 to D-132) · Who: Claude built; an independent reviewer checked; Tahir ruled and approves the push
- Words: Product, Variant, Pack, Client product, the same on every screen.
- Tables: click a number or date column to sort; long tables keep their headers on screen; on a phone each row shows its key figures and a tap opens the rest.
- Forms: required fields are marked; a missing one is outlined with the reason under it; dates read 26 Oct 2026.
- Product page, Cost: 1 row per pack, with Detail for its parts, floor, price history and packing bill.
- Margin, a pack's trucks: for a client product, the price approved when its PO came in beside the PO price (as the PO price report); what the cost is made of; Open the product. VAN brand packs are priced on the lists, and the page says so.
- Setup, Record and checks, Change record: names in place of numbers, actions in words, filters by person, kind, dates and search.
- Guide: 1 "I want to…" table for Yawar and Tahir; the old version layers of doc 07 moved here, under "Guide history".
- Setup, Clients and Setup, Products and variants: 1 table each.
- VAN brand list revisions: the panel names any pack whose price would go above its printed MRP; approval still allowed.
- Packs with no approved cost: put on Approvals once, as 1 first-cost item.
- Majid: Products, to read, with Add a variant.
- API: GET /api/c2m/audit (new); each sale in GET /api/c2m/state carries `parts`. No migration.
- Independent review of round 4: 1 high, 10 medium, 17 low; fixed the same day except 3 low points and 1 point for Tahir (D-134).
- Migration 006 (D-133): 3 material names spelled right (Ferrous Sulfate Hepta, Magnesium Sulfate, Magnesium Sulfate Hepta Hydrate). Data only. Run once in phpMyAdmin.
- Tests: fix10.test.js and fix10ui.js (van_review6, a copy of the live-sized data), fix10b.js (van_review8, a copy of the MRP seed); runall.sh all pass.

## Guide history (moved from doc 07, 26 Oct 2026, D-126)
Until round 4, doc 07 kept every version's Guide lines in layers. From round 4 doc 07 holds only today's Guide. The old doc 07 follows unchanged, headings moved down 1 level.

## Doc 07 as it stood on 26 Oct 2026, before round 4

Version 1.0.3 · 20 Oct 2026 · Owner: Yawar; Tahir approves changes · Rule: R-5h item 7 (D-20)
Changed in the next version (21 Oct 2026; piece 1 of 4 after Tahir's rulings D-89 to D-95; the version number is set at the push; 1.0.3 is live): Tahir's line and a new line for any role made in Setup, Roles (D-89, D-90); the in-app Guide carries the same.
Changed in 1.0.3 (20 Oct 2026; 1.0.2 went live on 20 Oct at 11:24): after review, D-88 (take off a list, the description, rows leaving chosen). Yawar and Tahir: 1 master list and the carry-over (D-87); Product names keeps names only; the in-app Guide carries the same lines.
Changed in 1.0.2 (19 to 20 Oct 2026; 1.0.1 went live on its own on 19 Oct at 23:19): Yawar line 7 and Tahir line 4: Setup, Product names (D-85); the in-app Guide carries the same lines. 20 Oct 2026: the check before a name change, trade names, Tahir links on Client prices.
Changed in 1.0.1 (19 Oct 2026): Yawar line 4 and Tahir lines 3 and 5 (D-80 to D-83); the in-app Guide carries the same lines.
Changed in 1.0.0 (19 Oct 2026): "Where things are (1.0.0)" and the 1.0.0 lines for Yawar and Tahir added (D-76 to D-79); the in-app Guide carries the same lines.
Changed in 0.9.3 (19 Oct 2026): Yawar and Tahir line 3 (Reports, VAN brand list margin, D-73).
Changed in 0.9.2 (19 Oct 2026): Yawar line 8 and Tahir new line 9 (By customer state, D-68).
Changed in 0.9.1 (3 independent reviews, 18 Oct 2026 night): App Guide lines for Yawar (5, new 6, new 10) and Tahir (5, new 6) matched again to GUIDE in c2m.html; partial re-approval and 2-tap wording (D-61, D-63 to D-65).
Changed in 0.9.1 (documentation review, 18 Oct 2026): the App Guide lists for Yawar and Tahir matched again, word for word, to GUIDE in c2m.html (0.9.0 lines); rule numbers on each item; "Where things are" adds 0.9.0; Tahir's re-approvals under Waiting on others; Prices, Waiting for date; name and Sign out at the foot of the rail; 2 re-approval items after the first load.
Changed in 0.9.0: "What is new in 0.9.0" added (the left rail, Find anything, Today groups and ages, Reports, Excel, the propose panel).
Changed in 0.8.0: the screen redesign (D-45 to D-52): every App Guide list matched again to the app's GUIDE; the place names in the "Also" items moved to the 0.8.0 screens (Today panels, Products, Inputs, Setup, Prices with its 5 views); a "Where things are" table added.
Changed in 0.7.0: Yawar item 20 (VAN brand products, D-44).
Changed in 0.6.0: Yawar items 11 and 19 (re-approval figures; when a pack is costed). The app's Guide screen does not carry these yet (I-07).
Changed in 0.4.0 and 0.5.0: App Guide lines for Yawar and Tahir matched again to the app (GUIDE in c2m.html); dated approvals, withdraw, "For your information", flag wording, restated history and Sign out added; band values removed (public repo).
Changed in 0.3.0 and 0.3.1: matched word for word to the app's Guide screen (the GUIDE list in c2m.html), then each role's 0.3.0 and 0.3.1 jobs added.

How to read this: items marked "App Guide" are the exact lines on the app's Guide screen. Items marked "Also" are jobs that are not on the app's Guide screen in these words; the GUIDE list in c2m.html should get them in a later code change (open issue I-07 in 12).

### I want to… (26 Oct 2026, D-119; the same table is in the app, Guide)
| Job | Where | What happens next |
|---|---|---|
| Add a variant of a VAN product | Products, + New, Add a variant (the form opens there) | A new VAN product whose recipe starts as a copy of the main one, as a draft. Majid changes it; it is checked and endorsed; Yawar approves its cost, then prices it. |
| Put a variant on a client | Products, + New, Put a variant on a client: pick the client, then answer "Is it a VAN product, in the client's bag?" | Yes: it follows that recipe and Yawar gets "Approve cost" on Approvals. No: Majid gets "Write the first recipe". After the cost is approved it is priced on Client prices. |
| Add a client | Products, + New, Add a client | Step 1 saves the client; step 2 adds its first product. |
| Add a pack to a product | The product's page, Add a pack | If the recipe is approved, Yawar gets its first cost on Approvals at once. |
| Change a client price or a target GP | Client prices: pick the client, type the price or the target (change, or use company) in its row, write the reason, Send to Tahir | Nothing changes until Tahir approves. A new target re-judges every month shown in Margin; the send bar shows the Rs effect first. |
| Update a material, packing, labour or FOH rate | Setup, Costs | Saved at once and logged. A pack whose approved cost moves more than the re-approval % waits on Approvals; once re-approved, Margin uses it for trucks from the next day. An inner bought per kg: Packing, Bought per Kg, with pieces in 1 kg. |
| Make the MRP printing list | Client prices, Price lists, MRP printing list (packing and printer) | MRP = Sindh credit price with FED, rounded up to the next Rs 50; with no credit price, the higher of Punjab and Sindh. The Recommended MRP on the Dealer and Distributor lists is a suggested price, not this one. Approvals names any list price above the printed MRP. |
| Correct a mistake | A price or target you sent: Take back in its row on Client prices. A later approved price: Withdraw (Tahir). A product name, out of use, a pack added by mistake: the product's page. A rate: save the right rate in Setup, Costs. A client name or print name: Setup, Clients. | Every correction is dated and logged in Setup, Record and checks, Change record. |

### Who does what, and how C2M works (read this first) (22 Oct 2026; the same text is in the app, Guide, Who does what)

C2M turns a recipe into a cost, a cost into a price, and a price into the margin on real trucks. Each step has 1 person. Nobody approves their own work.

| Person (role) | What they do | Who comes next |
|---|---|---|
| Majid (Production Manager, production) | Writes each recipe and every new version. Adds a variant from the VAN product's page. | Himayat reviews it. |
| Himayat (QC Head, qc) | Gives each material its class and nutrient %. Reviews the recipe and its nutrient analysis. | Fahim endorses it. |
| Fahim (Plant Manager, plant) | Checks the recipe, nutrients and cost. Endorses it, or sends it back with a reason. | Yawar approves the cost. |
| Yawar (CFO, cfo) | Approves the cost of every recipe. Keeps rates, packing and labour current. Adds clients and products, and a rate for 1 variant. Proposes prices and VAN brand list revisions. Gives KAMs their lists. | Tahir approves his prices, list revisions and setting changes. |
| Tahir (COO, coo) | Approves prices, list revisions, targets and thresholds. Adds clients, products and variants. Makes the roles and decides who sees what. Does the monthly rate check. | As the administrator he may approve what he proposed himself; everyone else may not. |
| KAMs and managers (viewer) | See only the price lists and clients they are given, and download the PDF. They never see cost or margin. | If no list shows, ask Yawar or Tahir. |

A role the administrator makes in Setup, Roles can do what is ticked on it, and sees the places that follow from it.

#### How a thing moves through C2M
1. **Rates and sheets.** Yawar's sheets are imported; he settles every conflict in the import queue. He keeps material rates, packing, labour and FOH current. C2M recosts every recipe and groups the re-approvals by cause.
2. **Recipe to cost.** Majid writes, Himayat reviews, Fahim endorses, Yawar approves the cost. A product that follows a VAN product takes that recipe and its approved material cost; its packing, labour and overhead stay its own, and Yawar approves its cost on its own page (Approve cost).
3. **Cost to price.** Yawar proposes a price (white label client) or a list revision (VAN brand). Tahir approves, or sends it back with a reason. A price or list dated ahead waits for its date.
4. **Price to lists.** Managers and KAMs see the approved lists they are given, as a PDF.
5. **Trucks to margin.** O2S trucks and open POs are costed at the approved cost, so Margin shows GP by client, product and PO against each product's target.

#### New clients, products and variants (from piece 3, D-94, D-95, D-98)
- **Add client** (Setup, Clients and buyer lines): Tahir or Yawar. Name, and what it buys: VAN brand, white label or both. A white label client has no region. The client's group follows its products.
- **Add a product** for a client: brand name as O2S writes it, product type, variant, whether it follows a VAN product's recipe, who supplies the packing (VAN, Client or Bulk), and its packs. A pack can be for 1 client only, with its own packing bill and price.
- **Variants** (Setup, Variants, or the VAN product's page): a VAN product keeps a list of variants (Humi Grow: Powder, Pellets). Majid, Tahir or Yawar adds one; its recipe starts as a copy of the main product's, as a draft. Yawar sets the labour and overhead rates, and a rate for 1 variant.
- **Which rate a pack takes:** the client's own pack, then the variant, then the product type, then the general rate.
- **KAM lists** (Setup, KAM lists): Yawar or Tahir gives each KAM the lists and clients they may see, and can open the screen as that KAM sees it.

#### How to use it, per person
Open your name's section below ("Yawar", "Tahir", "Majid", "Himayat", "Fahim", "KAMs and managers"). Each is the same list as the Guide in the app. The 3 rules that apply to everyone:
- Approve or send back inside the panel that opens from your list; a send back always carries a reason and advice.
- "Someone else changed this a moment ago. Check before retrying." means another person acted first. Look again.
- Every change is dated and logged in the change record (Setup).

### Your look (22 Oct 2026, piece 4)

- Pick one of 4 looks with the 4 dots in the top bar (computer) or in Guide, Your look (phone): Silver cool, Slate light, Stone warm, Slate dusk (dark). It is kept in your browser.
- Colours: red means act or it is stuck; amber means waiting; green means fine; grey is information. Every colour comes with a word. The small coloured square beside a client is only that client's colour.
- Home: left, the white label margin verdict and 6 month trend (Yawar, Tahir); right, your jobs, red and stuck first, then the oldest. Products: pick a client on the left; the To do column says what each product needs.

### Changing the name a price list prints (22 Oct 2026)

- Open Setup, Client details (or Setup, Clients and buyer lines, Open Client details). Click Edit on the client's row. Type the full name in Name on price lists and documents, then Save. Empty means the C2M name prints. Lists already issued keep their old name. The O2S names box is only for matching O2S trucks and POs and never prints.

### Where things are (0.8.0)

| Before 0.8.0 | Now |
|---|---|
| A job's own screen | A panel on Today: approve, send back, accept or enter there |
| Recipes (Yawar, Tahir) | Products: 1 page per client product (Recipe, Cost by pack, Price, History) |
| Rates; Back Office, Materials | Inputs: 1 materials table (class, nutrient %, rate), Packing items, Packing bills |
| Back Office, Products and packing | Product page, Cost by pack (type, reprocessed, packing bill per pack); Inputs (bills and items) |
| Price lists; VAN brand list revisions | Prices: To change, Proposals, By customer, Price lists, VAN brand lists |
| Back Office | Setup: Customers, From O2S, From Yawar's sheets, Settings and targets, KAM lists, Monthly checks record, Change record, System documentation |
| Materials (Himayat) | Inputs (no rates, as before) |

### Where things are (0.9.0)

| Before 0.9.0 | Now |
|---|---|
| Tabs at the top | The left rail (Analyse, Work on, Admin), with Find anything (Ctrl K); on a phone a top bar and a bottom bar of 4 places and More (D-53) |
| No Reports | Reports, for Yawar and Tahir: GP bridge and PO price against approved price; 12 more after their pictures are approved (D-57) |
| Prices: 5 views | Prices: To change, With Tahir, Waiting for date, By customer, Price lists, VAN brand lists (D-56) |
| Product page: Recipe, Cost by pack, Price, History | Recipe, Cost and price by pack, Price history, Sales, History (0.9.0) |
| Name and Sign out in the header | At the foot of the rail, with Back to launcher |
| Underlined views inside a place | Folder tabs with counts in a badge (D-59, 0.9.1) |

### Where things are (1.0.0) (owner: Yawar; Tahir approves; D-76; version 1.0.0, 19 Oct 2026)

| Before 1.0.0 | Now, for Yawar and Tahir |
|---|---|
| Today | Approvals (the same jobs and panels) |
| Margin (0.9.0) | Margin: by client, product or client x product; each truck at its approved cost; sorted by Rs short (D-79) |
| Prices: 6 views | Client prices: White label clients (type new prices in the rows), VAN brand prices (1 grid, each VAN pack once), Price lists (D-77, D-78). Waiting prices sit under the white label table; list revisions under the VAN grid |
| Product page: 5 tabs | Recipe and Cost by pack (D-76) |
| Setup (0.8.0) | Setup: Settings, Material rates, Packing, Labour FOH and targets, Clients and buyer lines, People, From O2S, Sheet items, Monthly checks, Change record |
| Reports, Inputs, Guide in the rail | Under More |

#### Yawar, from 1.0.0
1. Approvals: start with "Your next move"; every approval and job opens in a panel.
2. Products: Recipe, Cost by pack and History; approve cost in its panel; propose a single price from the top of the page.
3. Client prices, White label clients: type new prices in the rows, see the new GP at once, write the reason the client reads (and why, if below target), Send to Tahir: 1 proposal per pack.
4. Client prices, VAN brand prices: each VAN pack once, a column per list; type the prices that change, or a price for a pack not yet on a list; reason and dates; Send to Tahir: 1 list revision per list. Confirm suggested list-row links once. Under Not placed, pick the pack of each row and Save links; only a row of a product C2M does not cost at all: "Not a C2M pack" (check first that C2M has no pack of it under another name; it stays on the list and prints; Undo if wrong). Change the prices of marked rows with "Change prices of marked rows" in the Marked box (D-80).
5. Margin: by client, product or client x product; open a line for its packs and a pack for its trucks; the restated switch is for comparison only.
6. Setup: settings, rates, packing, labour and FOH, targets, buyer lines, people, O2S, sheet items, monthly checks, change record.
7. Setup, Product names: 1 name per product everywhere (D-85). Settle each name C2M cannot place: Rename and link a list row (it prints the official name on the next list), Keep an O2S name as a spelling (its trucks are costed at once), Rename linked rows still under another name. Edit official names (the trade name only; 2 products may share it when their pack sizes differ) and spellings, 1 per line; Tahir can too; every change is logged. A rename keeps the name before as a spelling. Before a change that takes cost off O2S trucks, C2M shows how many trucks and Rs, back to which date: Save anyway only if that is meant. "Names to settle" shows on Approvals while any is left; an O2S name for a product C2M does not hold stays there until the product is added to C2M or O2S corrects the name. Take out of use (in the table) removes a VAN brand product from C2M's screens, the grid and Margin, after showing any O2S trucks that would lose their cost; nothing is deleted, and Put back in use brings it back. A product on a price list row is linked elsewhere or unlinked first. A pack under 1 L or 1 kg is written 500 ml, 250 g (Tahir, 20 Oct 2026). A list row whose size can be read is offered only packs of that size and unit.

#### Tahir, from 1.0.0
1. Approvals: what waits for you, each in its panel; white label clients red on margin.
2. Client prices: "Open to approve" in a row opens the same panel; list revisions show under the VAN grid.
3. Margin: GP against each product's target; red lines first by Rs short; buyers follow the O2S category (D-74). A client with trucks but no approved cost is named in 1 line under the headline (D-83).
5. Client prices, VAN brand prices: rows Yawar marked "Not a C2M pack" show with who and when; they are left out of the VAN brand list margin report (D-80). When a list revision adds a pack to a list, its panel lists the marked rows of that list: check none of them is that pack; if one is, send it back. The VAN brand list margin report (More, Reports) colours each pack against its product's target (D-81).
4. Setup: read every setting; Yawar's threshold and product target changes wait for you on Approvals. Setup, Product names: settle the names C2M cannot place and edit official names and O2S spellings, as Yawar can (D-85); the check before saving shows any O2S trucks that would lose their cost. You also link list rows under Client prices, Not placed, and in the VAN brand list margin report; a linked row takes the official name on the next list. The mark "Not a C2M pack" stays Yawar's.

### Yawar (CFO, role cfo)

App Guide (rule for each line in brackets; the brackets are not on the screen):
1. Each morning open Today and start with "Your next move". Every approval and job opens in a panel on Today; each line shows how long it has waited, and "stuck" after more than 2 working days (Monday to Saturday). (D-46, D-54)
2. Find anything (Ctrl K) opens a product, customer, material, report or place. (D-53)
3. Reports: GP bridge (why GP moved from 1 month to the next), PO price against approved price, and VAN brand list margin (every VAN pack's list prices against its cost and its product's GP target (from 1.0.1, D-81); link each list row to its C2M pack there once: C2M suggests, you check and save; a row of a product C2M does not cost: "Not a C2M pack"); all export to Excel. (D-57, D-73)
4. Products: 1 page per client product, with its recipe and every version, its cost by pack, its price and its history. Approve cost in its panel, opened from Today or from the product page, after Fahim endorses; send back with a reason and advice if something is wrong. (D-08, D-09, D-47)
5. Re-approvals: when a rate moves products over the set %, approve them on Today in 1 item. Approve all, or tick the packs you checked: the packs not ticked wait in a new item, so none is lost. (R-2 Cost, D-41, D-61)
6. A change to a product type, the reprocessed tick or a pack's packing bill waits for Save, and says how many packs it recosts. Tahir is told of every labour or FOH rate, packing bill, product type and reprocessed change. (D-63, D-65)
7. Inputs: 1 materials table (class, nutrient % and rate), packing items and packing bills. Try a new rate, check its effect, then save with its source; a move over the warning level asks you to confirm. (D-10, D-48)
8. Prices: propose from "To change" in the panel beside the list; write the reason the client will read; below target needs your written reason too. Build each price list, pick the fields, create the PDF. Revise a VAN brand list; Tahir approves. Prices, By customer: every white label pack, for all clients or 1, at today's price with its state against target. (D-06, D-14, D-28, D-56, D-68)
9. Setup: customers, the O2S link, your sheets against C2M, settings and targets with labour and FOH rates, KAM lists (who sees which price list), the monthly checks record and the change record. (D-49, D-97)
10. Each month: enter actual labour and FOH, and tie the month to the books by typing ERP sales and COGS in total; C2M shows its own figures beside them and the gap. (D-18, D-64)

Also (a separate list; its numbers 7 to 16 are kept so references in other documents still hold):
7. Re-approvals (R-2 Cost): each item lists its packs with approved cost, cost now and %. Approve all (tap 2 times to confirm), or untick packs and Approve ticked only (at least 1), or Close: the change was wrong, with a reason. Packs you leave out wait in a new item "Left open from item N" (D-61). A rate save, packing price, packing bill edit or assignment, labour or FOH rate added or retired, product type, reprocessed flag or import rate correction can each make an item. If a cost moved again after the item was shown, C2M approves today's cost and notes it in the change record. "Approved" is the last approved cost, and the % is against it (D-41). A pack whose cost is back within the set % when you approve, or is no longer fully costed, keeps its approved cost; C2M names it after approving. An item can also hold a pack with no approved cost yet ("first cost"), for example after you assign it a packing bill; approving it sets its first approved cost.
8. After the first load, 2 re-approval items wait for you: the move of conversion to the base bands for the white label packs, and for the VAN brand packs. Until you approve them, the approved cost from 13 Oct is your own sheet (A-19, D-44).
9. Labour and FOH rates (D-25, D-37), Setup, Settings and targets: add a named rate, pick Labour or FOH, Rs per kg, a start date today or earlier. Assign it to all products (optionally only solids or liquids, reprocessed or not, a pack range), to a product type, or to a list of products you tick. It applies from its date by itself. Any rate you add beats the base bands for the products it covers; among your own rates, the one with more conditions wins, then the newest. Retire a rate with a reason; C2M refuses if any product would be left with no labour or FOH rate.
10. VAN brand list revisions (D-28); from 1.0.0 in Client prices, VAN brand prices (the grid, D-77); before 1.0.0 in Prices, VAN brand lists: Revise a list, type only the prices that change (the screen shows Now and the change %; discount is typed as %), add a reason, effective date and valid till, Send to Tahir. If he sends it back, Revise and resend. While an approved revision of a list waits for its date, a new revision of that list is refused. The previous price printed on a distributor list is the price on the last distributor list you issued (D-42).
11. Price proposals: set "Takes effect from" and valid till. Only 1 price per pack can wait for Tahir, and only 1 approved price per pack can wait for its date.
12. Setup, From Yawar's sheets: over 3% shows red.
13. Master data forms: add a material or grade with its rate and source (Inputs, Materials); add a packing item (Inputs, Packing items); set a customer's price rule, cycle, region and O2S names (Setup, Customers); set freight per segment and region (Setup, Settings and targets). You can also set a material's class and nutrient %.
14. Setup, Settings and targets: the budget lines (company budget GP, ambition GP, white label budget GP, budget labour + FOH a month) were set by the first load. A change applies at once with a notice to Tahir. Only 1 target request per product can wait for Tahir.
15. When a pack is costed (D-40): only when every material has a rate, a VAN-packed pack has a packing bill with at least 1 item, every item priced above Rs 0, and a pack size above 0, and a labour and a FOH rate apply. A white label pack that is not costed, including one whose recipe is not in C2M yet, shows on your Today, and no price can be proposed for it. A labour or FOH rate must be above Rs 0; the product screen says why in place of the Propose button. The product page shows "Not costed" with what is missing; approving the cost is refused until every pack of the product is costed. Fix the price or the bill in Inputs, then approve.
16. VAN brand products (D-44): each VAN pack is 1 product with 1 cost in every channel. Its sales show the buyer, channel and region. Change VAN prices through the VAN brand list revisions, not with a price proposal.

### Tahir (COO, role coo)

App Guide (rule for each line in brackets; the brackets are not on the screen):
1. Today starts with your next move, then what waits for you (prices, list revisions, threshold and target changes), recipes stuck more than 2 working days (Monday to Saturday), and customers below target. Each opens in a panel: approve or send back there, with a reason. (D-33, D-46, D-54)
2. Find anything (Ctrl K) opens a product, customer, material, report or place. (D-53)
3. Reports: GP bridge, PO price against approved price, and VAN brand list margin (every VAN pack's distributor, dealer and farmer price against its cost and its product's GP target (from 1.0.1, D-81), with the VAN brand portfolio GP), with Export to Excel. (D-57, D-73)
4. Re-approvals of cost are Yawar's; you see each one on Today for information. (R-2 Cost)
5. Each month check the rates against the purchase register (Today): C2M lists the 15 materials with the most Rs in the month; type each register rate and save. You cannot approve a price, list, setting or target you proposed yourself. (D-18, D-39, D-63, D-64)
6. For your information on Today shows each change Yawar makes to labour and FOH rates, packing bills, product types and the reprocessed tick, with how many packs moved. (D-63)
7. Margin: start with the Rs at stake, then open the customer, product and PO. (D-11, D-15)
8. Products: 1 page per client product with its recipe, cost, price and history. (D-47)
9. Prices, By customer: every white label pack, for all clients or 1, at today's price with its state against target (red below floor or cost or with no price, amber below target, green on target, grey no target or not costed). (D-68)

Also (a separate list; its numbers 6 to 11 are kept so references in other documents still hold):
6. VAN brand list revisions (D-28): Today shows "Approve list revision". It opens in a panel on Today: check each price from and to, then Approve (press 2 times to confirm) or Send back with a reason.
7. Approvals take 2 taps: the button turns green and reads "Tap again to confirm: ..."; tap again within 6 seconds. (D-65)
8. Approvals dated ahead (D-34): a price or list revision approved for a later date waits for it. Prices, Waiting for date, lists the waiting prices; Prices, VAN brand lists shows the waiting revision. Today's price or list stays in force until then. Press Withdraw and write why to cancel it before its date. A newer price approval for the same pack cancels the older waiting price, and the change record says so.
9. Re-approvals: Yawar's open items show on your Today under "Waiting on others" (with Yawar, re-approve, with their age; they are not counted as your jobs). Open shows the packs read only. You may approve or close them yourself; Yawar normally does (D-96).
10. Margin: the switch "Expected kg: budget" or "Expected kg: last 3 months" changes the forward view on your screen only; it is not saved (D-27). Forward kg leaves out kg already on open POs. A second switch shows past trucks at the cost approved on their date, or "restated at today's labour and FOH rates" (D-35).
11. Flags: red needs more than the red gap in points below target and a Rs gap above the red share of all white label sales. Amber reads "slightly below target" (within the red gap) or "N pts below target, small Rs".

### Majid (Production Manager, role production)

App Guide:
1. Today shows recipes to check or revise; each opens in a panel.
2. Write a new version from Recipes when a recipe changes, including a one-time change.
3. A recipe sent back carries a reason and advice; revise and resend it, and it goes straight back to whoever sent it.

### Himayat (QC Head, role qc)

App Guide:
1. Today shows recipes to review and materials to complete; each opens in a panel.
2. Inputs: class each material (nutrient source, or no nutrients such as binder, filler, anti-caking agent, wetting agent) and enter the % of each nutrient field.
3. Check the inputs and the nutrient analysis, then mark reviewed or send back with a reason and advice.

Also:
4. Inputs, Materials (D-23): use the filter To do. Classes are grouped: nutrient sources, and "adds no nutrients". Pick a class, then press Save class. Moving a material to a no-nutrient class clears its % values (they stay in the change record).
5. Enter %: "Blank fields are 0" is ticked; untick it if a blank means "not known yet".
6. Gypsum, Plaster of Paris (POP) and calcium hydroxide load as "Calcium and sulphur source" (Ca%, S%). Change any class that is wrong.

### Fahim (Plant Manager, role plant)

App Guide:
1. Today shows recipes to endorse; each opens in a panel.
2. Check the recipe, nutrients and cost, then endorse or send back with a reason and advice.

### KAMs and managers (role viewer)

App Guide:
1. Price lists shows the lists granted to you. If none shows, none is granted yet: ask Tahir or Yawar.
2. Download the PDF to share. Prices are approved prices only.

Also:
3. You see only the lists and clients Yawar granted you. Cost and margin never reach you. You cannot set notes, dates or reasons on a document.

### For everyone
- On a phone, tables show as cards.
- Messages appear at the bottom; errors are in red. "Someone else changed this a moment ago. Check before retrying." means another person acted first: look again before retrying.
- Your name shows at the foot of the left rail, with Back to launcher and Sign out (D-53). Dates are written in words, e.g. 16 Oct 2026.
- A price list PDF carries the footer and "page n of N" on every page.

### What is new in 0.9.0 (18 Oct 2026)
- The places are in the navy rail on the left. Ctrl K (or Find anything) finds a product, client, customer, material, report or place. On a phone the places are at the bottom, with More for the rest.
- Today: start with "Your next move". Then To approve, To do and Waiting on others; each line shows how many days it has waited, and "stuck" after more than 2 working days (Monday to Saturday).
- Yawar and Tahir: Reports. GP bridge explains why GP moved from 1 month to the next; PO price against approved price lists every PO line entered below the approved price. Both export to Excel, as does the customer table on Margin.
- Yawar: Propose opens a panel beside the list. Write the reason the client will read; it is not filled in for you.
- Tahir: a price approval shows the figures as tiles, Yawar's reason set apart, and its place in the queue (1 of 3).

### What is new in 1.0.3 (20 Oct 2026): 1 master list (D-87)

- Each VAN pack is held once, in C2M, and the distributor, dealer and farmer lists are its price columns. Every list prints from it: the official name and pack, products A to Z, packs small to large. Prices do not change.
- Once, at the start, Tahir or Yawar carries today's list rows into the master: Client prices, VAN brand prices, Carry into the master (also on Approvals). C2M matches most rows by name and size, marked "C2M: same name. Check": check them. Pick the master product of each name C2M cannot match: the pick counts for every list the name is on. Where 2 rows land on 1 pack of 1 list, choose the row whose prices stay. The rows that leave the printed lists are listed before anything moves; they are kept read only. Press Carry over twice.
- After that nothing is linked row by row: Not placed, the mark "Not a C2M pack" and Rename and link are gone. A price on the wrong pack is moved in More, Reports, VAN brand list margin ("Each list row and its master pack").
- Each row that would leave the printed lists is chosen: its pack, or "Leaves the lists". Carry over waits until every one is chosen.
- A pack no longer sold: Take off a list, in its row of the grid. Tahir or Yawar, with a reason; no approval; the other is told. It stays visible, with its prices, under "Off the lists"; to bring it back, type its price in the grid (a revision to Tahir).
- The description the lists print is C2M's, the same on all 3 lists: edit it in Setup, Product names, Edit, "Description on the price lists". A product with none prints none.
- A price on the wrong product: move it in More, Reports, VAN brand list margin; no approval; the other of Tahir and Yawar is told.
- A pack brought back to a list comes with the discount, FRP, MRP and terms it left with, shown to Tahir in the revision. On "Revise and resend" these show as "comes back ... unless typed": leave them empty to keep them.
- Yawar, "Revise and resend" after Tahir moved a row to another pack: that row's old price is not filled in, and the row says what was typed for which pack. Type its price again for the pack it is on now, or leave it empty. Every price that changed since you typed (a row taken off, a row moved, a new pack that now has a row) is listed in 1 box above the form, with what you had typed; nothing is filled in for those.
- Setup, Product names keeps the official names (the trade name only), the description and O2S spellings.
- KAMs: the lists you print come out in master order under the official names from the carry-over on.

### 7.x Roles (next version)

- Tahir (COO role, the administrator): Setup, Roles. Pick a role or press New role, tick what it may do, then Create role or Save role. A role holding people cannot be deleted. Ahmer Shehzad holds the same role and can do the same. Logins stay in the platform's People and access.
- A role made in Setup, Roles: you may do what is ticked on it and you see the places that follow. Anything you approve must have been proposed by an administrator, never by you or a colleague.

### What is new in piece 3: Add client and variants (D-94, D-95, D-98)

- Yawar and Tahir: Setup, Clients and buyer lines has Add client. Give the name, what it buys, then its first product: the brand name exactly as O2S writes it, the product type, whether it follows a VAN product's recipe, who supplies the packing (VAN, Client or Bulk) and each pack with its packing bill. A pack can be for 1 client only (own packing bill and price). The group follows the products.
- A product that follows a VAN product has no recipe of its own: the material cost comes from the VAN recipe; its packing, labour and overhead are its own. Yawar presses Approve cost on its page (the Approve cost button) when its own cost moves.
- Setup, Variants: each VAN product's variants. Add a variant, or tag an existing product's variant. A rate can apply to 1 variant (Labour, FOH and targets, "2 · A variant").
- Majid: on a VAN product's page press Add a variant; the recipe starts as a copy of the main product's, as a draft. Change what differs and send it on as always.

### Renaming a client (D-110)
Setup, Customers, Edit, box "Customer name in C2M". The new name shows on all C2M screens, in KAM lists and in the client picker; the client's KAM access moves with it. Price lists already issued keep the name they were printed with. To change only what price lists print, use "Name on price lists and documents". Group and segment are not edited here: the group follows the client's products.

### Your first day (Yawar), added 23 Oct 2026
1. Approvals: read "Your next move" and do it.
2. Products: each client is a row; open it, then a product. Press + New to add a variant, put a variant on a client, change a target or add a client.
3. Client prices: pick a client, type a new price in the row, see the GP at once, Send to Tahir. From today the price is in force when Tahir approves; a later date waits; POs already received keep their PO price.
4. Margin: opens on the whole company for this month; change the group or month in the line at the top.
5. Setup: rates, packing, labour and targets, clients, variants, product names, KAM lists, the record of every change. Back office no longer exists: its Customers is Setup, Client details; System documentation is in Setup too.
To correct a mistake: a price not yet in force is withdrawn or sent back; a rate is saved again with the right value; a white label product is renamed, taken out of use or has a pack removed on its own page, Correct a mistake; a client is renamed in Setup, Client details, Edit.
