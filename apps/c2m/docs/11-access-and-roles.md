# 11. Access and roles matrix

Version 1.2 · 16 Oct 2026 · Owner: Tahir (grants roles in the platform's People and access); Yawar grants lists · Rule: R-5h item 11 (D-20), R-2 People and rights
Changed in 0.4.0 and 0.5.0: withdraw a waiting price or list revision is coo only; Tahir sees re-approvals under "For your information" and read only on Recipes; stuck recipes on Tahir's Today; Sign out.
Changed in 0.3.0 and 0.3.1: Materials row added; Back Office sections by role; Tahir receives re-approvals but cannot approve; documents by role; what a KAM can never receive; settings only to Yawar and Tahir; how a role is given and removed.

Roles live in user_module_roles, module 'c2m'. Code: ROLES, SEES_COST, SEES_PRICE and docAllowed in c2m-routes.js. The server filters every reply by role; the page only hides buttons.

## 11.1 Role against screen

| Screen | cfo (Yawar) | coo (Tahir) | production (Majid) | qc (Himayat) | plant (Fahim) | viewer (KAMs) | Rule |
|---|---|---|---|---|---|---|---|
| Today | yes | yes | yes | yes | yes | no | R-2 |
| Margin | yes | yes | no | no | no | no | D-11 |
| Recipes | yes, with cost; re-approval items | yes, with cost; re-approval items read only | yes, with cost | yes, no cost | yes, with cost | no | D-08, D-33 |
| Materials | in Back Office, edit | in Back Office, view | no | yes: class and nutrient %, no rates or cost | no | no | D-23 |
| Rates | edit | view | no | no | no | no | D-10 |
| Prices | propose | approve; withdraw a price waiting for its date | no | no | no | no | D-06, D-34 |
| Price lists | build; propose list revisions | build; approve list revisions; withdraw a revision waiting for its date | no | no | no | granted lists only | D-14, D-28, D-34 |
| Back Office | edit | view and approve (see 11.2) | no | no | no | no | R-2 |
| Guide | yes | yes | yes | yes | yes | yes | D-20 |

## 11.2 Back Office sections by role

Only cfo and coo open Back Office. "edit" = forms and buttons; "view" = read only.

| Section | cfo (Yawar) | coo (Tahir) |
|---|---|---|
| Import queue | edit (accept, correct) | view ("with Yawar") |
| Sheet against C2M | view | view |
| Data links | edit (Pull now) | edit (Pull now) |
| Customers | edit | view |
| Products and packing | edit (product type, reprocessed, packing bills and items) | view |
| Materials | edit (add material, class, nutrient %) | view |
| Rules and targets | edit (labour and FOH rates, retire, target requests, freight) | approve or refuse target requests |
| Settings | edit (propose) | approve or refuse threshold changes |
| Access | edit (list and client grants) | view |
| Monthly actuals and checks | actuals, tie to the books | rate check (second person) |
| Change record | view | view |
| System documentation | all 12 | all 12 |

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
| Create price list PDF | cfo, coo; viewer for granted lists and clients only | D-14 |

## 11.4 What data each role receives (server filter)

| Data | cfo | coo | production | qc | plant | viewer |
|---|---|---|---|---|---|---|
| Cost, approved cost, floor, sheet cost | yes | yes | yes | no | yes | no |
| Prices, margin, target, budget | yes | yes | no | no | no | no |
| Settings (thresholds, budget lines) | yes | yes | no | no | no | no |
| Re-approval items | yes | yes (cannot act; shown under "For your information", not counted as jobs) | no | no | no | no |
| Stuck recipes (more than 2 working days at one step) | no | yes, on Today | no | no | no | no |
| Materials master (no rates) | yes | yes | no | yes | no | no |
| Sales, open POs, imports, people, change record | yes | yes | no | no | no | no |
| VAN lists | all columns of all lists, prices only | same | no | no | no | granted lists only; farmer columns only for granted farmer lists |
| White label client lists | all clients | all clients | no | no | no | granted clients only |

## 11.5 Documentation by role (D-20; docAllowed)

| Role | Sections served |
|---|---|
| cfo, coo | all 12 |
| production, qc, plant | 01 process flows, 07 guide, 11 access |
| viewer | 07 guide, 11 access |

Anything else returns 403 "Not available to your role." Changes to documentation ship with the code change (D-20). Claude writes them; Tahir approves.

## 11.6 How a role is given and removed (owner: Tahir)
- Give: Tahir adds the person in the platform's People and access and grants module 'c2m' with 1 role (a row in user_module_roles). The person sees C2M on the next page load.
- Remove: Tahir removes the c2m row in People and access. The next request returns 403 "You do not have access to C2M." Yawar then removes any list or client grants in Back Office, Access (the grants also stop working once the role is gone, because every /api/c2m route needs the role).
- Change: Tahir changes the role in People and access; the new screens apply on the next page load.
- Sign out: the "Sign out" link in the header clears the platform token on this device.
- List and client grants for KAMs: Yawar ticks or unticks them in Back Office, Access. Each change is in the change record. A KAM's PDF download checks the grant again.

## 11.7 What each role can never do
- Nobody can print cost or margin on a price list; those fields do not exist for any audience.
- A KAM (viewer) never receives cost, margin, settings, products, recipes, or list columns he is not granted. He cannot set notes, dates or reasons on a document.
- Settings go only to cfo and coo.
- cfo cannot approve his own price or list revision, withdraw a waiting approval, approve a threshold change, or do the second-person rate check.
- coo cannot save rates or approve or close a re-approval.
- production, qc and plant never see prices or margin; qc never sees cost or rates.
- C2M never writes to O2S or to any platform table.
