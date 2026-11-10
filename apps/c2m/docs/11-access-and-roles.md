# 11. Access and roles matrix

Version 1.0.3 · 20 Oct 2026 · Owner: Tahir (grants roles in the platform's People and access); Yawar grants lists · Rule: R-5h item 11 (D-20), R-2 People and rights
Changed in the next version (21 Oct 2026; piece 1 of 4 after Tahir's rulings D-89 to D-95; the version number is set at the push; 1.0.3 is live): 11.11 added: roles are editable (D-89, D-90); the COO role is the administrator with every action; the action list replaces the role names in the code; 11.7 and 11.3 corrected for the administrator. Until migration 002 is run nothing changes.
Changed in the next version, piece 2 (21 Oct 2026; the version number is set at the push): 11.6 and the matrix row: KAM lists replaces People and list access (D-97). No right added: the screen and its 2 routes use grants.give.
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
| Inputs: Materials | edit: class, nutrient %, rate (try and save), add a material | view, with rates | after migration 014: view materials and nutrients (no rate columns), add a material with no rate; before: no | edit: class and nutrient %; after migration 014 also the nutrient list, classes, declared grades, add a material with no rate; no rates or cost | no | no | D-10, D-23, D-48, D-162 |
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
| KAM lists (was People and list access) | edit (list and client grants, copy, see a KAM's screen) | edit, the same | R-2 People and rights, D-97 |
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
| Add a material class (its name and the % it asks) | cfo, through the action material.save (the QC Head has nutrient.edit, not material.save, so she cannot) | D-144 |
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
- Remove: Tahir removes the c2m row in People and access. The next request returns 403 "You do not have access to C2M." Tahir or Yawar then removes any list or client grants in Setup, KAM lists (the grants also stop working once the role is gone, because every /api/c2m route needs the role).
- Change: Tahir changes the role in People and access; the new screens apply on the next page load.
- Sign out: the "Sign out" link in the header clears the platform token on this device.
- List and client grants for KAMs (D-97): Tahir or Yawar, Setup, KAM lists. 1 person at a time; each tick saves at once and is in the change record. Copy from another manager replaces his ticks with another manager's. See what this person sees opens that manager's own screen, read only: only for a manager given price lists, never for Tahir or Yawar, and every save is refused while it shows. A KAM is a person whose role holds see.granted_lists and not see.products; anyone who sees every list is not listed. A KAM is not told when something is granted. A KAM's PDF download checks the grant again.

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
| More: Reports, Inputs, Guide (Back office removed, D-115) | yes | yes | no | D-76, D-115 |
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
| Administrator | The COO role holds every action to start with. Since 2 Nov 2026 (D-142, roles trial) its actions are ticks the System Administrator may change on the launcher; it cannot be left with no tick or deleted. Tahir and Ahmer Shehzad hold it. It is exempt from "nobody approves what they proposed" (ruling 19) and from the second-person rate check | D-89, D-142 |
| Create, edit and delete roles | The System Administrator, on the launcher (People and access, Roles by app), through /api/c2m/rolesvc. The C2M Roles screen and roles.manage were removed (28 Oct and 4 Nov 2026). A role cannot be removed while a person holds it. | D-90, D-145 |
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
| Administration | none since 28 Oct 2026 (roles.manage removed; roles are designed on the launcher) |

People and access (platform piece 1b, 21 Oct 2026): the C2M column lists the roles in `c2m_role`, so a role made here can be given to a person at once. Rules there: the role key must match exactly (capitals included); only a platform administrator gives a role made here (it can carry approving rights), and the C2M CFO and COO; a C2M sub-admin gives the built-in roles only. Until migration 002 has run, People and access lists the 6 built-in roles. (Until 21 Oct this said a role made here could not yet be given.)

Rules the Roles screen enforces when a role is saved (found in the independent review): the "places" tick (Approvals, Products, Prices, Margin, Setup) needs Recipes, Costs, Prices and margin, and Settings and targets ticked; "Mark a list row" needs "Link or rename a list row"; a role cannot both save rates and do the monthly rate check (the check stays with a second person); a role name that matches a reserved word gets "-role" added to its key.

Other points: Approve is shown only on an item an administrator proposed, for anyone below the administrator (state items carry byAdmin). Refusing or sending back a colleague's item is not restricted by the proposer rule. The administrator holds every recipe step and can take a recipe through all 4 steps alone (ruled by Tahir, D-96). The notices still go to the CFO and COO roles by name; a new role does not receive notices.

## 11.12 Access in piece 3: client.add and variant.add (owner: Tahir; D-94, D-98)

| Action | What it allows | Starting roles |
|---|---|---|
| client.add | Add a client, a client product and its packs; make a product follow a VAN product | CFO, COO |
| variant.add | Add a variant of a VAN product (a new VAN product with a recipe copy); tag a product's variant; create a new family or variant name | CFO, Production Manager, COO |

Other rules: approving a follower's cost needs recipe.step.cost (the CFO step); rates for a variant need labour.manage (Yawar). Majid has no Setup: he adds a variant from a VAN product's page. A role you made yourself gets no new action until you tick it in Roles. Migration 003 adds the actions to the starting cfo and production rows; the COO holds every action.

## 11.13 Who does what, in one place (22 Oct 2026)
The app Guide and doc 07 now carry a Who does what part for every role. It is the plain-words version of this document: what each role does and who comes next. If a role's rights change in Setup, Roles, keep that part in step. The 6 starting roles are the ones named in it; a role made by the administrator reads "set up by the administrator" in its own Guide.


## 11.14 Places after D-115 (23 Oct 2026)
More for Tahir and Yawar is now Reports, Inputs and Guide. Back office is removed; its Customers and System documentation are tabs of Setup (Client details, System documentation). Corrections of a white label product (rename, out of use, remove a pack) need client.add.

- 26 Oct 2026 (D-119): for roles with Margin (Tahir, Yawar) More holds Reports and Guide only; Inputs is Setup, Costs. Other roles keep Inputs.
- 26 Oct 2026 (D-122): the MRP printing list is made and opened only with pricedoc.all (Tahir, Yawar); it cannot be granted to a manager (the grants route refuses it).
- 26 Oct 2026, round 4: GET /api/c2m/audit needs see.margin (Tahir, Yawar); the change record is not shown to other roles. Majid (production) has Products in his places (nav adds products when the role holds variant.add); on it he reads products and adds a variant; every change route still checks its own right (client.add, price.propose and so on), so nothing else saves for him. The first-cost sweep runs only for a user who may decide re-approvals, or the administrator.
- 26 Oct 2026, review of round 4: Majid may tag or clear any product's variant (POST /products/:id/variant, variant.add, D-98), and a variant rate can move cost. Tahir ruled the same day that Majid keeps this (D-135). A role without see.price sees cost only on a product page: no price, GP, target or state, and no price jobs on the Products list.

## 11.15 Edit, Delete, Take out of use, Make default (30 Oct 2026; owner: Tahir; D-139, D-140)
No new action: each list uses the right that adds to it. Delete, Take out of use and Put back: material grade material.save; packing item and packing bill packing.manage; labour and FOH labour.manage (Retire as before); freight freight.edit; client and white label product client.add; one of our products lists.link; a draft recipe recipe.start (Majid; Yawar holds it too). Edit of words follows the same rights; a client's Edit stays customer.edit. Another recipe is started with recipe.start and approved with recipe.step.cost. Make default needs recipe.step.cost (Yawar; the administrator holds every action). Himayat, Fahim and the KAMs see no Edit or Delete.

## 11.12 4 Nov 2026 (D-145)
- The C2M Roles screen (Setup, Settings, Roles) and its routes are removed. Roles are designed by the System Administrator on the launcher (People and access, Roles by app), through /api/c2m/rolesvc (since 28 Oct 2026). Sections 11.11 above describe the old screen and are history.
- A role with "The Approvals, Products, Prices, Margin and Setup places" (see.margin) but not "Settings and targets" (see.settings) receives the settings its margin figures need, read only (list in 05). It still cannot see or change the Settings screen.

## 11.13 4 Nov 2026 (D-146)
- No new action. The VAN brand PO price check goes to roles with see.margin and see.price (today the CFO and COO). The report sits in More, Reports; the line on Approvals shows only to them. Production, QC, Plant and price list viewers do not receive listCheck (tested).

## 11.14 5 Nov 2026 (D-148)
- No new action. Roles with see.margin (CFO, COO) get Costs in the top bar and Setup under More. A box's Open and its forms keep their own rights: rate.save (material), packing.manage, labour.manage, freight.edit, actuals.enter. Roles without see.margin keep their places as before.

## 11.15 5 Nov 2026 (D-149)
- No new action. Holding, changing and dropping a waiting change follow the save's own right (rate.save, packing.manage, freight.edit). Approve now and Not urgent on an urgent change need price.approve (the COO). Next week's costs is seen by roles with see.margin; only the person who saved a change that went in can correct it within the hour.

## 11.16 5 Nov 2026 (D-150)
- No new action. Filling, changing and adding labour and FOH rates, moving products and the monthly certificate need labour.manage (the CFO). Roles with see.margin see the rates, the picks and the certificate.

## 11.17 5 Nov 2026 (D-152)
- No new action. Roles with see.margin (Tahir and Yawar) see Clients in the top bar; Products is under More. Proposing still needs price.propose or list.revise; approving price.approve or list.approve. Other roles' places are unchanged.

## 11.18 5 Nov 2026 (D-153)
- No new action. A list's target and freight: sent with settings.edit (the CFO), approved with settings.approve (the COO). New prices on a list: list.revise; approval list.approve.

## 11.19 6 Nov 2026 (D-154)
- No new action. COO check: actuals.ratecheck and not a rate saver, or the administrator (the COO). Lock and reopen: the administrator (the COO) only. Actuals and tie: as before (the CFO).

## 11.20 6 Nov 2026 (D-157)
- No new action and no right changed. Reports stays only for the roles that see margin (see.margin: the CFO and the COO); the 2 new routes, GET /api/c2m/reports/costs and /prices, answer 403 to every other role (tested for production, QC, plant and viewer). VAN brand PO against its price list still also needs see.price.

## 11.21 6 Nov 2026 (D-158)
- No new action and no right changed. Your own report sits in Reports, so it is only for the roles that see margin (see.margin: the CFO and the COO). The 6 new routes (rates, made, saved list, save, rename, delete) answer 403 to every other role (tested for production, QC, plant and viewer).
- A saved report belongs to the person who saved it: the owner is taken from the signed-in person on the server, never from the page. Nobody else sees, opens, renames or deletes it, the administrator role included (another person's id answers "not yours, or no longer there").
- Review 5b (6 Nov 2026): the rates route sends raw material rates only to a role that also has see.materials, as the state call does; other rates go to every see.margin role. A person keeps at most 50 saved reports.

## 11.22 7 Nov 2026 (D-160): Guide rows per role, Start and Find
- No new action and no right changed. The Guide shows each person only the rows of their role whose Start opens a place they have (canGo on navFor's places and CAN): COO 36 rows, CFO 55, Production Manager 10, QC Head 6, Plant Manager 5, KAM (viewer) 4, with the seeded rights (tested in p15). A role made on the launcher gets the rows of the role it works like (see.margin: CFO, or COO for the administrator; granted lists only: KAM; recipe draft, review or endorse: Production Manager, QC Head, Plant Manager), filtered the same way; one that fits none reads the 2 general lines.
- Production Manager: See what waits for you; Write the first recipe of a client product; Write a new recipe version; Write another recipe for a product; Revise a recipe sent back; Delete a draft started by mistake; Read a product's recipe, packs and cost; Add a variant; Find anything; Find a row in a list.
- QC Head: See what waits for you; Check a recipe; Close a recipe version; Class a material and enter its nutrient %; Read a recipe; Find anything; Find a row in a list.
- Plant Manager: See what waits for you; Endorse a recipe; Read a recipe; Find anything; Find a row in a list.
- KAM: See your price lists; Download a price list as PDF; Ask for a list you cannot see; Find anything.
- Find anything offers only places the person can open: a KAM finds his own granted lists and the Guide's jobs, never Costs, Margin, Setup or another list; Production, QC and Plant find products and recipes on their own places (Products or Recipes), never Clients.

## 11.23 7 Nov 2026: Independent review 6b, Guide rows need the job's right
- No new action and no right changed. A Guide row now also needs the right of its job (need, in GUIDE_JOBS; a list means any 1 of them): rows show only for the jobs the person has the right to do. Before, a role made on the launcher with see.margin got every CFO or COO row whose place it could open, even approve cost, change VAN list prices, give KAM lists, certify labour and FOH, or make a cost urgent. A row that only reads (Start the day, See margin, the reports, Find anything, Read a recipe and the like) needs only its place.
- The rights: Approve the cost of a recipe, of a product that follows another's recipe, Change the Default recipe: recipe.step.cost. Re-approve costs: reapproval.decide. Approve a price, list revision, target or setting: price.approve, list.approve, targets.approve or settings.approve. Approve an urgent cost change: price.approve. Check items from your sheets: import.decide. Fix packs that are not costed: rate.save, packing.manage, labour.manage or recipe.step.cost. Price packs costed with no price, Revise a price sent back: price.propose. Revise a list revision sent back, Give a VAN brand pack a printed MRP, Change VAN brand list prices: list.revise. Add a client, Put a variant on a client, Add a pack to a client product: client.add. Add a variant (of a product): variant.add. Change a client price or a target GP: price.propose or targets.propose. Set a VAN list's target or freight, Change a setting: settings.edit. Carry the price list rows into the master: lists.carry. Take a pack off a price list: lists.remove. Make a price list PDF, Make the MRP printing list: pricedoc.all. Add a material class: material.save. Update a material, packing, labour or FOH cost, Change or drop a cost waiting for Monday, Make a cost change urgent, Correct a cost that went in: rate.save, packing.manage, labour.manage or freight.edit. Fill or change a labour or FOH rate, Move a product to a High rate, Certify labour and FOH: labour.manage. Give packs a packing bill: packing.manage. Set freight for a region: freight.edit. Rename a product or settle an O2S name: lists.link. Change a client's name or what its lists print: customer.edit. Give a KAM his lists: grants.give. Close the month: actuals.enter, actuals.tiebooks, actuals.ratecheck or labour.manage. Edit a row: customer.edit, client.add, material.save, packing.manage, labour.manage or freight.edit. Delete a row: client.add, material.save, packing.manage, labour.manage or freight.edit. Correct a mistake: price.propose, targets.propose, price.withdraw, list.withdraw or client.add. Keep another recipe, Write the first recipe, Write a new recipe version, Write another recipe, Delete a draft: recipe.start. Revise a recipe sent back: recipe.edit. Review a recipe: recipe.step.review. Class a material: nutrient.edit. Endorse a recipe: recipe.step.endorse. Download a price list as PDF: pricedoc.granted or pricedoc.all.
- Rows per built-in role are unchanged (each seeded role holds the rights of its own rows): COO 36, CFO 55, Production Manager 10, QC Head 6, Plant Manager 5, KAM 4 (tested in p15). A role with only see.margin, see.products and see.price now has 15 rows, all to read (before: 51).
- Today's line "VAN brand PO lines are off their price list" still shows to every role with see.price; its Open the report button shows only when the person can open that report (Reports, and see.price). Before, a role without Reports got a button that did nothing.

## 11.24 9 Nov 2026: push 7a, 3 new actions (D-162)
- nutrient.list "Keep the nutrient list and the material classes": QC Head (and COO). Add or edit a nutrient; add or edit a class (the CFO keeps adding classes through material.save).
- grade.declare "Enter a product's declared grade": QC Head (and COO).
- material.add "Add a material without a rate": QC Head, Production Manager, CFO (and COO). Giving a rate still needs material.save (CFO).
- The Production Manager also gets see.materials, so his places are Today, Products, Recipes, Inputs, Guide. On Inputs he reads materials and nutrients and may Add a material; no packing tabs, no Edit, Hide or Enter buttons.
- Migration 014 adds these to the role rows on the database (production keeps any changes a System Administrator made: an action is only added when missing). Until 014 is run the seeded roles in c2m-access.js carry them, but the new routes answer "not switched on yet".
- Guide rows per built-in role: COO 36, CFO 56, Production Manager 11, QC Head 9, Plant Manager 5, KAM 4 (tested in p15).

## 11.25 9 Nov 2026: push 7b (D-163)
- No new action. Close uses the step rights (recipe.step.review, .endorse, .cost); the sender of a draft sent back may close it if they hold the right of the step they sent it back from.
- The Production Manager, QC Head and Plant Manager (roles production, qc, plant, without notices.see) now receive their own notices of the last 30 days in state and see them on Today, For your information. A custom role receives none.
- Guide rows per built-in role: COO 36, CFO 57, Production Manager 11, QC Head 10, Plant Manager 6, KAM 4 (tested in p15).

## 11.26 10 Nov 2026: push 7c (D-164)
- No new action. A material's density: nutrient.edit (QC Head; the CFO and COO hold it too). A product's density: recipe.edit (Production Manager, COO) or the administrator (R70).
- productDensity goes in state to whoever sees materials or products; it holds no Rs.
- Guide rows per built-in role: COO 36, CFO 57, Production Manager 12, QC Head 11, Plant Manager 6, KAM 4 (tested in p15).
