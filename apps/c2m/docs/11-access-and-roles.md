# 11. Access and roles matrix

Version 0.9.1 · 18 Oct 2026 · Owner: Tahir (grants roles in the platform's People and access); Yawar grants lists · Rule: R-5h item 11 (D-20), R-2 People and rights
Changed in 0.9.1 (3 independent reviews, 18 Oct 2026 night): 11.8 added (D-62 to D-64).
Changed in 0.9.1 (documentation review, 18 Oct 2026): Reports row and Prices views in 11.1; Rule column in 11.2; Mark notices seen in 11.3; a rates row and Waiting on others in 11.4; the KAM's documents limit in 11.5; nobody approves an item they proposed (D-63) in 11.7.
Changed in 0.9.0: Yawar and Tahir get Reports (8 places, D-53, D-57); the new state fields priceHistory, poLines, importedAt and nextDocRef go to cfo and coo only; no right changed.
Changed in 0.8.0: 11.1 and 11.2 rewritten for the 0.8.0 screens (D-45 to D-52). Places moved; no right changed: the server checks every action by role as before, and the nav list per role (ROLES in c2m-routes.js) only chooses screens.
Changed in 0.4.0 and 0.5.0: withdraw a waiting price or list revision is coo only; Tahir sees re-approvals under "For your information" and read only on Recipes; stuck recipes on Tahir's Today; Sign out.
Changed in 0.3.0 and 0.3.1: Materials row added; Back Office sections by role; Tahir receives re-approvals but cannot approve; documents by role; what a KAM can never receive; settings only to Yawar and Tahir; how a role is given and removed.

Roles live in user_module_roles, module 'c2m'. Code: ROLES, SEES_COST, SEES_PRICE and docAllowed in c2m-routes.js. The server filters every reply by role; the page only hides buttons.

## 11.1 Role against screen (0.9.0)

| Screen | cfo (Yawar) | coo (Tahir) | production (Majid) | qc (Himayat) | plant (Fahim) | viewer (KAMs) | Rule |
|---|---|---|---|---|---|---|---|
| Today, with its panels | yes: every job and approval of his opens in a panel | yes: every approval of his opens in a panel; re-approvals read only | yes | yes | yes | no | R-2, D-46 |
| Margin | yes | yes | no | no | no | no | D-11 |
| Reports (GP bridge, PO price against approved price; 12 more in 0.9.2) | yes, with Export to Excel | yes, with Export to Excel | no | no | no | no | D-57 |
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
| Approve or close a re-approval | cfo only. coo receives the open items with the state data but cannot approve or close (403) | R-2 Cost |
| Propose price | cfo | D-06 |
| Approve or send back price | coo | D-06 |
| Withdraw a price approved for a later date, with why | coo only (cfo gets 403) | D-34 |
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
| Settings (thresholds, budget lines) | yes | yes | no | no | no | no |
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
- cfo cannot approve his own price or list revision, withdraw a waiting approval, approve a threshold change, or do the second-person rate check.
- Nobody can approve a price, list revision, setting request or target request they proposed, whatever role they hold at the time (0.9.1, D-63).
- coo cannot save rates or approve or close a re-approval.
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
