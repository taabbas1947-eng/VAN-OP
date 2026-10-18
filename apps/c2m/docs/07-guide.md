# 7. The Guide

Version 1.3 · 18 Oct 2026 · Owner: Yawar; Tahir approves changes · Rule: R-5h item 7 (D-20)
Changed in 0.8.0: the screen redesign (D-45 to D-52): every App Guide list matched again to the app's GUIDE; the place names in the "Also" items moved to the 0.8.0 screens (Today panels, Products, Inputs, Setup, Prices with its 5 views); a "Where things are" table added.
Changed in 0.7.0: Yawar item 20 (VAN brand products, D-44).
Changed in 0.6.0: Yawar items 11 and 19 (re-approval figures; when a pack is costed). The app's Guide screen does not carry these yet (I-07).
Changed in 0.4.0 and 0.5.0: App Guide lines for Yawar and Tahir matched again to the app (GUIDE in c2m.html); dated approvals, withdraw, "For your information", flag wording, restated history and Sign out added; band values removed (public repo).
Changed in 0.3.0 and 0.3.1: matched word for word to the app's Guide screen (the GUIDE list in c2m.html), then each role's 0.3.0 and 0.3.1 jobs added.

How to read this: items marked "App Guide" are the exact lines on the app's Guide screen. Items marked "Also" are jobs that are not on the app's Guide screen in these words; the GUIDE list in c2m.html should get them in a later code change (open issue I-07 in 12).

## Where things are (0.8.0)

| Before 0.8.0 | Now |
|---|---|
| A job's own screen | A panel on Today: approve, send back, accept or enter there |
| Recipes (Yawar, Tahir) | Products: 1 page per client product (Recipe, Cost by pack, Price, History) |
| Rates; Back Office, Materials | Inputs: 1 materials table (class, nutrient %, rate), Packing items, Packing bills |
| Back Office, Products and packing | Product page, Cost by pack (type, reprocessed, packing bill per pack); Inputs (bills and items) |
| Price lists; VAN brand list revisions | Prices: To change, Proposals, By customer, Price lists, VAN brand lists |
| Back Office | Setup: Customers, From O2S, From Yawar's sheets, Settings and targets, People and list access, Monthly checks record, Change record, System documentation |
| Materials (Himayat) | Inputs (no rates, as before) |

## Yawar (CFO, role cfo)

App Guide:
1. Each morning open Today and work from the top. Every approval and job opens in a panel on Today.
2. Products: 1 page per client product, with its recipe and every version, its cost by pack, its price and its history. Approve cost in its panel, opened from Today or from the product page, after Fahim endorses; send back with a reason and advice if something is wrong.
3. Re-approvals: when a rate moves products over the set %, approve them on Today in 1 item.
4. Inputs: 1 materials table (class, nutrient % and rate), packing items and packing bills. Try a new rate, check its effect, then save with its source; a move over the warning level asks you to confirm.
5. Prices: propose from "To change"; below target needs your written reason. Build each price list, pick the fields, create the PDF. Revise a VAN brand list; Tahir approves.
6. Setup: customers, the O2S link, your sheets against C2M, settings and targets with labour and FOH rates, list access, the monthly checks record and the change record.

Also:
7. Re-approvals (R-2 Cost): each item lists its packs with approved cost, cost now and %. Approve all (press twice to confirm), or untick packs and Approve ticked only (at least 1), or Close: the change was wrong, with a reason. Packs you leave out keep their approved cost. A rate save, packing price, packing bill edit or assignment, labour or FOH rate added or retired, product type, reprocessed flag or import rate correction can each make an item. If a cost moved again after the item was shown, C2M approves today's cost and notes it in the change record. "Approved" is the last approved cost, and the % is against it (D-41). A pack whose cost is back within the set % when you approve, or is no longer fully costed, keeps its approved cost; C2M names it after approving. An item can also hold a pack with no approved cost yet ("first cost"), for example after you assign it a packing bill; approving it sets its first approved cost.
8. The first item waiting for you is the move of conversion to the base bands. Until you approve it, the approved cost from 13 Oct is your own sheet (A-19).
9. Labour and FOH rates (D-25, D-37), Setup, Settings and targets: add a named rate, pick Labour or FOH, Rs per kg, a start date today or earlier. Assign it to all products (optionally only solids or liquids, reprocessed or not, a pack range), to a product type, or to a list of products you tick. It applies from its date by itself. Any rate you add beats the base bands for the products it covers; among your own rates, the one with more conditions wins, then the newest. Retire a rate with a reason; C2M refuses if any product would be left with no labour or FOH rate.
10. VAN brand list revisions (D-28), Prices, VAN brand lists: Revise a list, type only the prices that change (the screen shows Now and the change %; discount is typed as %), add a reason, effective date and valid till, Send to Tahir. If he sends it back, Revise and resend. While an approved revision of a list waits for its date, a new revision of that list is refused. The previous price printed on a distributor list is the price on the last distributor list you issued (D-42).
11. Price proposals: set "Takes effect from" and valid till. Only 1 price per pack can wait for Tahir, and only 1 approved price per pack can wait for its date.
12. Setup, From Yawar's sheets: over 3% shows red.
13. Master data forms: add a material or grade with its rate and source (Inputs, Materials); add a packing item (Inputs, Packing items); set a customer's price rule, cycle, region and O2S names (Setup, Customers); set freight per segment and region (Setup, Settings and targets). You can also set a material's class and nutrient %.
14. Setup, Settings and targets: the budget lines (company budget GP, ambition GP, white label budget GP, budget labour + FOH a month) were set by the first load. A change applies at once with a notice to Tahir. Only 1 target request per product can wait for Tahir.
15. When a pack is costed (D-40): only when every material has a rate, a VAN-packed pack has a packing bill with at least 1 item, every item priced above Rs 0, and a pack size above 0, and a labour and a FOH rate apply. A white label pack that is not costed, including one whose recipe is not in C2M yet, shows on your Today, and no price can be proposed for it. A labour or FOH rate must be above Rs 0; the product screen says why in place of the Propose button. The product page shows "Not costed" with what is missing; approving the cost is refused until every pack of the product is costed. Fix the price or the bill in Inputs, then approve.
16. VAN brand products (D-44): each VAN pack is 1 product with 1 cost in every channel. Its sales show the buyer, channel and region. Change VAN prices through the VAN brand list revisions, not with a price proposal.

## Tahir (COO, role coo)

App Guide:
1. Today shows prices, list revisions, threshold changes and target changes waiting for you, recipes stuck more than 2 working days, and customers below target. Each opens in a panel: approve or send back there, with a reason.
2. Re-approvals of cost are Yawar's; you see each one on Today for information.
3. Each month check the top 15 rates against the purchase register (Today).
4. Margin: start with the Rs at stake, then open the customer, product and PO.
5. Products: 1 page per client product with its recipe, cost, price and history.

Also:
6. VAN brand list revisions (D-28): Today shows "Approve list revision". It opens in a panel on Today: check each price from and to, then Approve (press twice to confirm) or Send back with a reason.
7. Approvals take 2 presses: the button changes to "Confirm: ..." and you press again within 6 seconds.
8. Approvals dated ahead (D-34): a price or list revision approved for a later date waits for it. Prices shows "Approved, waiting for their date"; Prices, VAN brand lists shows the waiting revision. Today's price or list stays in force until then. Press Withdraw and write why to cancel it before its date. A newer price approval for the same pack cancels the older waiting price, and the change record says so.
9. Re-approvals: Yawar's open items show on your Today under "For your information" (they are not counted as your jobs) and read only in a panel (See the packs). You cannot approve or close them (R-2 Cost).
10. Margin: the switch "Expected kg: budget" or "Expected kg: last 3 months" changes the forward view on your screen only; it is not saved (D-27). Forward kg leaves out kg already on open POs. A second switch shows past trucks at the cost approved on their date, or "restated at today's labour and FOH rates" (D-35).
11. Flags: red needs more than the red gap in points below target and a Rs gap above the red share of all white label sales. Amber reads "slightly below target" (within the red gap) or "N pts below target, small Rs".

## Majid (Production Manager, role production)

App Guide:
1. Today shows recipes to check or revise; each opens in a panel.
2. Write a new version from Recipes when a recipe changes, including a one-time change.
3. A recipe sent back carries a reason and advice; revise and resend it, and it goes straight back to whoever sent it.

## Himayat (QC Head, role qc)

App Guide:
1. Today shows recipes to review and materials to complete; each opens in a panel.
2. Inputs: class each material (nutrient source, or no nutrients such as binder, filler, anti-caking agent, wetting agent) and enter the % of each nutrient field.
3. Check the inputs and the nutrient analysis, then mark reviewed or send back with a reason and advice.

Also:
4. Inputs, Materials (D-23): use the filter To do. Classes are grouped: nutrient sources, and "adds no nutrients". Pick a class, then press Save class. Moving a material to a no-nutrient class clears its % values (they stay in the change record).
5. Enter %: "Blank fields are 0" is ticked; untick it if a blank means "not known yet".
6. Gypsum, Plaster of Paris (POP) and calcium hydroxide load as "Calcium and sulphur source" (Ca%, S%). Change any class that is wrong.

## Fahim (Plant Manager, role plant)

App Guide:
1. Today shows recipes to endorse; each opens in a panel.
2. Check the recipe, nutrients and cost, then endorse or send back with a reason and advice.

## KAMs and managers (role viewer)

App Guide:
1. Price lists shows the lists granted to you.
2. Download the PDF to share. Prices are approved prices only.

Also:
3. You see only the lists and clients Yawar granted you. Cost and margin never reach you. You cannot set notes, dates or reasons on a document.

## For everyone
- On a phone, tables show as cards.
- Messages appear at the bottom; errors are in red. "Someone else changed this a moment ago. Check before retrying." means another person acted first: look again before retrying.
- Your name shows in the header, with a "Sign out" link. Dates are written in words, e.g. 16 Oct 2026.
- A price list PDF carries the footer and "page n of N" on every page.
