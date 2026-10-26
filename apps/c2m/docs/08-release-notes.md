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
