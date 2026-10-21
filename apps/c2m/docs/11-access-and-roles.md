# 11. Access and roles matrix

Version 1.0.3 · 20 Oct 2026 · Owner: Tahir (grants roles in the platform's People and access); Yawar grants lists · Rule: R-5h item 11 (D-20), R-2 People and rights
Changed in the next version (21 Oct 2026; piece 1 of 4 after Tahir's rulings D-89 to D-95; the version number is set at the push; 1.0.3 is live): 11.11 added: roles are editable (D-89, D-90); the COO role is the administrator with every action; the action list replaces the role names in the code; 11.7 and 11.3 corrected for the administrator. Until migration 002 is run nothing changes.
Changed in 1.0.3 (20 Oct 2026; 1.0.2 went live on 20 Oct at 11:24): after review, D-88 (take off a list, the description, rows leaving chosen). 11.10: the carry-over into the master is Tahir's or Yawar's; moving a price to another pack likewise (D-87).
Changed in 1.0.2 (19 to 20 Oct 2026; 1.0.1 went live on its own on 19 Oct at 23:19): 11.9: Tahir links list rows and edits product names, as Yawar does; the mark stays Yawar's (D-85). 20 Oct 2026: Tahir links on Client prices and the VAN brand list margin report too.
Changed in 1.0.1 (19 Oct 2026): 11.9: "Link a list row or mark it not a C2M pack" is cfo only; Tahir sees the marks (D-80). No other right changed.
Changed in 1.0.0 (19 Oct 2026): 11.9 added: the 5 places and More for cfo and coo (D-76); new actions on Client prices; no right changed.
Changed in 0.9.3 (19 Oct 2026): Reports row names the VAN brand list margin; "Link a list row to its pack" is cfo only (D-73).
Changed in 0.9.2 (19 Oct 2026): FED % (fed_pct) is a setting Yawar proposes and Tahir approves; every role receives the FED % with the state (D-72). No right changed.
Changed in 0.9.1 (3 independent reviews, 18 Oct 2026 night): 11.8 added (D-62 to D-64).
Changed in 0.9.1 (documentation review, 18 Oct 2026): Reports row and Prices views in 11.1; Rule column in 11.2; Mark notices seen in 11.3; a rates row and Waiting on others in 11.4; the KAM's documents limit in 11.5; nobody approves an item they proposed (D-63) in 11.7.
Changed in 0.9.0: Yawar and Tahir get Reports (8 places, D-53, D-57); the new state fields priceHistory, poLines, importedAt and nextDocRef go to cfo and coo only; no right changed.
Changed in 0.8.0: 11.1 and 11.2 rewritten for the 0.8.0 screens (D-45 to D-52). Places moved; no right changed: the server checks every action by role as before, and the nav list per role (ROLES in c2m-routes.js) only chooses screens.
Changed in 0.4.0 and 0.5.0: withdraw a waiting price or list revision is coo only; Tahir sees re-approvals under "For your information" and read only on Recipes; stuck recipes on Tahir's Today; Sign out.
Changed in 0.3.0 and 0.3.1: Materials row added; Back Office sections by role; Tahir receives re-approvals but cannot approve; documents by role; what a KAM can never receive; settings only to Yawar and Tahir; how a role is given and removed.

Roles live in user_module_roles, module 'c2m' (who holds which role). What each role may do is the list of ticked actions in the table c2m_role (from the next version; before migration 002 is run, the 6 roles built into c2m-access.js apply, with the same rights as before). Code: c2m-access.js (the actions and the 6 starting roles), can() and notSelf in c2m-routes.js. The server filters every reply by what the role may do; the page only hides buttons. Sections 11.1 to 11.10 describe the 6 starting roles; 11.11 says what changed for them.

## 11.1 Role against screen (0.9.0)

| Screen | cfo (Yawar) | coo (Tahir) | production (Majid) | qc (Himayat) | plant (Fahim) | viewer (KAMs) | Rule |
|---|---|---|---|---|---|---|---|
| Today, with its panels | yes: every job and approval of his opens in a panel | yes: every approval of his opens in a panel; re-approvals read only | yes | yes | yes | no | R-2, D-46 |
| Margin | yes | yes | no | no | no | no | D-11 |
| Reports (GP bridge, PO price against approved price, VAN brand list margin; 11 more after their pictures are approved) | yes, with Export to Excel | yes, with Export to Excel | no | no | no | no | D-57 |
| Products (1 page per client product) | yes, with cost and price; propose; product type, reprocessed, packing bill per pack | yes, with cost and price; read only | no | no | no | no | D-47 |
| Recipes | no (the product page) | no (the product page) | yes, with cost; his step opens in a panel | yes, no cost; his step opens in a panel | yes, with cost; his step opens in a panel | no | D-08, D-46, D-47 |
| Prices: To change, With Tahir, Waiting for date, By customer, Price lists, VAN brand lists | propose; build lists; propose list revisions | approve (in a panel); build lists; withdraw a price or revision waiting for its date | no | no | no | no | D-06, D-14, D-28, D-34, D-46 |
| Price lists | in Prices | in Prices | no | no | no | granted lists only | D-14 |
| Inputs: Materials | edit: class, nutrient %, rate (try and save), add a material | view, with rates | no | edit: class and nutrient %; no rates or cost | no | no | D-10, D-23, D-48 |
| Inputs: Packing items, Packing bills | edit | view | no | no | no | no | D-10, D-48 |
| Setup | edit (see 11.2) | view; Pull O2S; approvals open in a panel | no | no | no | no | R-2, D-49 |
| Guide | yes | yes | yes | yes | yes | yes | D-20 |

## 11.2 Setup sections by role (0.8.0; was Back Office)

Only cfo and coo open Setup. "edit" = forms and buttons; "view" = read only. Work moved to Today (D-49): the items from Yawar's sheets, monthly actuals, tie to the books, the rate check, and every approval.

| Section | cfo (Yawar) | coo (Tahir) | Rule |
|---|---|---|---|
| Customers | edit | view | R-5 client price rule, D-05 |
| From O2S (was Data links) | edit (Pull O2S now) | edit (Pull O2S now) | D-12, D-21 |
| From Yawar's sheets (was Import queue and Sheet against C2M) | view (accept and correct on Today) | view | D-07 |
| Settings and targets (was Settings, and Rules and targets) | edit (propose settings; labour and FOH rates, retire, target requests, freight) | view; "Open to approve" opens the panel | D-18, D-25, D-06 |
| People and list access (was Access) | edit (list and client grants) | view | R-2 People and rights |
| Monthly checks record (was Monthly actuals and checks) | view; "Enter or correct a month" opens the actuals panel | view; the rate check opens in a panel | D-18 |
| Change record | view | view | R-5h |
| System documentation | all 12 | all 12 | D-20 |

## 11.3 Role against action

| Action | Who | Rule |
|---|---|---|
| Write recipe version | production, cfo, coo | D-08 |
| Edit draft lines | production | D-08 |
| Review / endorse / approve cost | qc / plant / cfo, each at their step | D-08 |
| Send back a recipe | qc, plant, cfo at their step | D-09 |
| Save rate, packing price, packing item, packing bill, bill assignment | cfo | D-10, D-19 |
| Add or retire a labour or FOH rate | cfo | D-25 |
| Set product type, reprocessed flag | cfo | D-25 |
| Add material or grade with rate | cfo | D-23 |
| Set material class, nutrient % | qc, cfo | D-23 |
| Approve or close a re-approval | cfo, and the administrator (coo), who holds every action (D-96 replaces D-54 for the administrator) | R-2 Cost |
| Propose price | cfo | D-06 |
| Approve or send back price | coo | D-06 |
| Withdraw a price approved for a later date, with why | coo only (cfo gets 403) | D-34 |
| Link a VAN brand list row to its C2M pack (Reports, VAN brand list margin) | cfo | D-73 |
| Propose VAN list revision | cfo | D-28 |
| Approve or send back VAN list revision | coo | D-28 |
| Withdraw a list revision approved for a later date, with why | coo only (cfo gets 403) | D-34 |
| Threshold change, target override | cfo proposes, coo approves or refuses | D-18, D-06 |
| Import queue | cfo | D-07 |
| Customer form, freight | cfo | R-5, D-05 |
| Grant lists and clients | cfo | R-2 People and rights |
| Monthly actuals, tie to books | cfo | D-18 |
| Monthly rate check | coo (second person; cfo is refused) | D-18 |
| Pull O2S | cfo, coo | D-12 |
| Mark notices seen | cfo, coo (each for their own notices) | D-18 |
| Create price list PDF | cfo, coo; viewer for granted lists and clients only | D-14 |

## 11.4 What data each role receives (server filter)

| Data | cfo | coo | production | qc | plant | viewer |
|---|---|---|---|---|---|---|
| Cost, approved cost, floor, sheet cost | yes | yes | yes | no | yes | no |
| Material rates (with source and the last 6), packing item prices, packing bills, labour and FOH rates (state rates, packingItems, packingBills, rules) | yes | yes | yes | no | yes | no |
| Client products and recipes without price (brand, spec, packs, recipe state and lines) | yes | yes | yes | yes (no cost) | yes | no |
| Prices, margin, target, budget | yes | yes | no | no | no | no |
| Settings (thresholds, budget lines, FED %) | yes | yes | no | no | no | no |
| Re-approval items | yes | yes (cannot act; shown under "Waiting on others", not counted as jobs) | no | no | no | no |
| Stuck recipes (more than 2 working days at 1 step) | no | yes, on Today | no | no | no | no |
| Materials master (no rates) | yes | yes | no | yes | no | no |
| Sales, open POs, imports, people, change record | yes | yes | no | no | no | no |
| VAN lists | all columns of all lists, prices only | same | no | no | no | granted lists only; farmer columns only for granted farmer lists |
| White label client lists | all clients | all clients | no | no | no | granted clients only |

0.9.0: priceHistory, poLines, importedAt and nextDocRef are sent to cfo and coo only (they carry prices); products carry fam and typeName for every role (a colour and a product type name, no figure). Tested in ui09 V-13.

## 11.5 Documentation by role (D-20; docAllowed)

| Role | Sections served |
|---|---|
| cfo, coo | all 12 |
| production, qc, plant | 01 process flows, 07 guide, 11 access |
| viewer | 07 guide, 11 access |

Anything else returns 403 "Not available to your role." Known limit: a viewer's state carries no document list (the viewer part of the state builder returns early), so a KAM cannot open 07 and 11 from the page, though the route would serve them (I-35). Changes to documentation ship with the code change (D-20). Claude writes them; Tahir approves.

## 11.6 How a role is given and removed (owner: Tahir)
- Give: Tahir adds the person in the platform's People and access and grants module 'c2m' with 1 role (a row in user_module_roles). The person sees C2M on the next page load.
- Remove: Tahir removes the c2m row in People and access. The next request returns 403 "You do not have access to C2M." Yawar then removes any list or client grants in Setup, People and list access (the grants also stop working once the role is gone, because every /api/c2m route needs the role).
- Change: Tahir changes the role in People and access; the new screens apply on the next page load.
- Sign out: the "Sign out" link in the header clears the platform token on this device.
- List and client grants for KAMs: Yawar ticks or unticks them in Setup, People and list access. Each change is in the change record. A KAM's PDF download checks the grant again.

## 11.7 What each role can never do
- Nobody can print cost or margin on a price list; those fields do not exist for any audience.
- A KAM (viewer) never receives cost, margin, settings, products, recipes, or list columns he is not granted. He cannot set notes, dates or reasons on a document.
- Settings go only to cfo and coo.
- cfo cannot approve his own price or list revision, withdraw a waiting approval, approve a threshold change, or do the second-person rate check (unless Tahir ticks those actions on the CFO role; see 11.11).
- Nobody below the administrator can approve a price, list revision, setting request or target request they proposed, whatever role they hold at the time (0.9.1, D-63). The administrator role is exempt (D-89).
- (Until the next version) coo cannot save rates or approve or close a re-approval. From the next version the COO role is the administrator and holds every action (D-89).
- production, qc and plant never see prices or margin; qc never sees cost or rates.
- C2M never writes to O2S or to any platform table.

## 11.8 Access changes in 0.9.1 (owner: Tahir; version 0.9.1, 18 Oct 2026)

| Item | Who | Rule |
|---|---|---|
| foc (FOC trucks with cost) in the state | cfo, coo only (with sales) | D-62, R-2 People and rights |
| priceEnded and lastPoPrice on each pack | roles that see prices only (cfo, coo) | D-62 |
| Approve your own price, list revision, setting or target | nobody (403) | D-63, ruling 19 |
| Notices of cost input changes | coo receives; cfo's changes raise them | D-63, ruling 12 |
| Rate check with register rates | coo only (never the cfo who entered the rates) | D-64, D-18 |
| Tie to the books with ERP figures | cfo only | D-64, D-18 |

## 11.9 Access in 1.0.0 (owner: Tahir; D-76 to D-78; version 1.0.0, 19 Oct 2026)

No right changed: the server checks each action by role as before; ROLES only chooses the places.

| Place or action | cfo (Yawar) | coo (Tahir) | production, qc, plant, viewer | Rule |
|---|---|---|---|---|
| Approvals, Products, Client prices, Margin, Setup | yes | yes | no (their places are unchanged) | D-76 |
| More: Reports, Inputs, Back office, Guide | yes | yes | no | D-76 |
| Type and send white label prices | yes | no | no | D-78, D-06 |
| Type and send VAN brand prices, add a pack to a list | yes | no | no | D-77, D-28 |
| Link a list row to its pack (1.0.2: Tahir too, on Setup Product names, Client prices Not placed and the VAN brand list margin report) | yes | yes (from 1.0.2) | no; a KAM never receives the links or marks | D-73, D-85 |
| Mark a list row "Not a C2M pack" and undo the mark (1.0.1) | yes | no; sees the marks, with who and when, and the marked rows of a list on a revision that adds a pack to it | no | D-80 |
| Setup, Product names: settle names, edit official names and O2S spellings, rename linked rows (1.0.2) | yes | yes | no | D-85 |
| Take a VAN brand product out of use, or put it back (1.0.2, 20 Oct 2026) | yes | yes | no | D-86 |
| Open to approve a price or list revision (panel) | no | yes; never his own (D-63) | no | D-46, D-78 |
| Change settings | yes (thresholds and, from 1.0.0, the company GP target wait for Tahir) | reads; approves | no | D-18, D-75 |

## 11.10 Access in 1.0.3 (owner: Tahir; D-87; version 1.0.3, 20 Oct 2026)

| Action | Yawar (cfo) | Tahir (coo) | Production, QC, plant | KAM (viewer) |
|---|---|---|---|---|
| See the carry-over plan (preview) | yes | yes | no (403) | no (403) |
| Carry over into the master (once) | yes | yes | no | no |
| Move a price to another pack of the same size, after the carry-over | yes | yes | no | no |
| Unlink a row or mark it "not a C2M pack", after the carry-over | no one | no one | no | no |
| Take a pack off a list (no approval) | yes | yes | no | no |
| Edit the description on the price lists | yes | yes | no | no |
| Print a granted list (master order, official names, C2M's description) | yes | yes | no | yes |

A KAM never receives a row's master pack id, nor a row that left the lists.

## 11.11 Roles are editable; the COO role is the administrator (next version; owner: Tahir; D-89, D-90)

| Item | Rule | Decision |
|---|---|---|
| Administrator | The COO role holds every action, always, and cannot be edited or deleted. Tahir and Ahmer Shehzad hold it. It is exempt from "nobody approves what they proposed" (ruling 19) and from the second-person rate check | D-89 |
| Create, edit and delete roles | Only the administrator role: Setup, Roles. Each action is a tick. The 6 starting roles can be edited too. A role cannot be deleted while a person holds it. Creating and editing roles ("roles.manage") can never be ticked on another role | D-89, D-90 |
| Approve what an administrator proposed | A person below the administrator who is given an approve right (price, list revision, settings, targets) approves only an item an administrator proposed: never his own, never a colleague's. The recipe cost step and re-approvals have no proposer, so the rule does not apply to them (ruled by Tahir, 21 Oct 2026) | D-89, D-96 |
| Who holds a role | Still given and removed in the platform's People and access (user_module_roles). C2M never writes it | D-90 |
| Screens | Follow from the ticks: a role that sees margin gets the 5 places and More; a role with only recipe and cost actions gets Today and Recipes; a role with only granted lists gets Price lists | D-90 |
| Before migration 002 | C2M runs on the 6 built-in roles with the old rights; the Roles screen says the migration has not been run and saves nothing | D-90 |

What changed for the 6 starting roles: none, except the COO role. It can now do everything the others can: save rates, approve or close a re-approval, propose prices and list revisions, enter actuals, tie to the books, mark a row "not a C2M pack", and so on. Tested: 45 routes against the 6 roles, the old and the new code give the same answer (270 checks).

The actions (key, plain meaning), grouped as on the Roles screen. The 6 starting roles hold these: CFO the set in the first column that follows; production, qc, plant and viewer as in 11.1 to 11.3.

| Group | Actions |
|---|---|
| Prices and lists | price.propose, price.approve, price.withdraw, list.revise, list.approve, list.withdraw, pricedoc.all, pricedoc.granted |
| Costs and recipes | recipe.start, recipe.edit, recipe.step.draft, recipe.step.review, recipe.step.endorse, recipe.step.cost, reapproval.decide, rate.save, material.save, nutrient.edit, packing.manage, labour.manage, product.classify |
| Setup | settings.edit, settings.approve, targets.propose, targets.approve, customer.edit, freight.edit, grants.give, lists.link, lists.mark, lists.carry, lists.remove, o2s.sync, import.decide, actuals.enter, actuals.tiebooks, actuals.ratecheck, notices.see |
| What the role sees | see.products, see.cost, see.price, see.margin, see.settings, see.materials, see.granted_lists, guide.all |
| Administration | roles.manage (administrator only) |

People and access (platform piece 1b, 21 Oct 2026): the C2M column lists the roles in `c2m_role`, so a role made here can be given to a person at once. Rules there: the role key must match exactly (capitals included); only a platform administrator gives a role made here (it can carry approving rights), and the C2M CFO and COO; a C2M sub-admin gives the built-in roles only. Until migration 002 has run, People and access lists the 6 built-in roles. (Until 21 Oct this said a role made here could not yet be given.)

Rules the Roles screen enforces when a role is saved (found in the independent review): the "places" tick (Approvals, Products, Prices, Margin, Setup) needs Recipes, Costs, Prices and margin, and Settings and targets ticked; "Mark a list row" needs "Link or rename a list row"; a role cannot both save rates and do the monthly rate check (the check stays with a second person); a role name that matches a reserved word gets "-role" added to its key.

Other points: Approve is shown only on an item an administrator proposed, for anyone below the administrator (state items carry byAdmin). Refusing or sending back a colleague's item is not restricted by the proposer rule. The administrator holds every recipe step and can take a recipe through all 4 steps alone (ruled by Tahir, D-96). The notices still go to the CFO and COO roles by name; a new role does not receive notices.
