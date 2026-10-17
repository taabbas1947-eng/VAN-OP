# 7. The Guide

Version 1.2 · 16 Oct 2026 · Owner: Yawar; Tahir approves changes · Rule: R-5h item 7 (D-20)
Changed in 0.4.0 and 0.5.0: App Guide lines for Yawar and Tahir matched again to the app (GUIDE in c2m.html); dated approvals, withdraw, "For your information", flag wording, restated history and Sign out added; band values removed (public repo).
Changed in 0.3.0 and 0.3.1: matched word for word to the app's Guide screen (the GUIDE list in c2m.html), then each role's 0.3.0 and 0.3.1 jobs added.

How to read this: items marked "App Guide" are the exact lines on the app's Guide screen. Items marked "Also" are jobs that are not on the app's Guide screen in these words; the GUIDE list in c2m.html should get them in a later code change (open issue I-07 in 12).

## Yawar (CFO, role cfo)

App Guide:
1. Each morning open Today and work from the top.
2. Rules: add labour or FOH rates by kind, for all products, a form, a product type or a list of products; set each product's type and reprocessed flag in Products and packing.
3. Price lists: revise a VAN brand list (Tahir approves); approvals dated ahead take over on their date.
4. Back Office, Sheet against C2M: each pack's 13 Oct sheet cost against C2M, with the cause of every gap.
5. Rates: try a new rate, check its effect, then save with its source. A move over the warning level asks you to confirm.
6. Recipes: approve cost after Fahim endorses. Send back with a reason and advice if something is wrong.
7. Re-approvals: when a rate moves products over the set %, approve them in 1 item.
8. Prices: propose from "Prices to change". Below target needs your written reason.
9. Price lists: build each list, pick the fields, create the PDF.
10. Back Office: settle the import queue, keep packing bills, enter monthly actuals, tie to the books, grant lists.

Also:
11. Re-approvals (R-2 Cost): each item lists its packs with approved cost, cost now and %. Approve all (press twice to confirm), or untick packs and Approve ticked only (at least 1), or Close: the change was wrong, with a reason. Packs you leave out keep their approved cost. A rate save, packing price, packing bill edit or assignment, labour or FOH rate added or retired, product type, reprocessed flag or import rate correction can each make an item. If a cost moved again after the item was shown, C2M approves today's cost and notes it in the change record.
12. The first item waiting for you is the move of conversion to the base bands. Until you approve it, the approved cost from 13 Oct is your own sheet (A-19).
13. Labour and FOH rates (D-25, D-37), Back Office, Rules and targets: add a named rate, pick Labour or FOH, Rs per kg, a start date today or earlier. Assign it to all products (optionally only solids or liquids, reprocessed or not, a pack range), to a product type, or to a list of products you tick. It applies from its date by itself. Any rate you add beats the base bands for the products it covers; among your own rates, the one with more conditions wins, then the newest. Retire a rate with a reason; C2M refuses if any product would be left with no labour or FOH rate.
14. VAN brand list revisions (D-28), Price lists: Revise a list, type only the prices that change (the screen shows Now and the change %; discount is typed as %), add a reason, effective date and valid till, Send to Tahir. If he sends it back, Revise and resend. While an approved revision of a list waits for its date, a new revision of that list is refused.
15. Price proposals: set "Takes effect from" and valid till. Only 1 price per pack can wait for Tahir, and only 1 approved price per pack can wait for its date.
16. Sheet against C2M, Back Office: over 3% shows red.
17. Master data forms, Back Office: add a material or grade with its rate and source (Materials); add a packing item; set a customer's price rule, cycle, region and O2S names (Customers); set freight per segment and region (Rules and targets). You can also set a material's class and nutrient %.
18. Settings: the budget lines (company budget GP, ambition GP, white label budget GP, budget labour + FOH a month) were set by the first load. A change applies at once with a notice to Tahir. Only 1 target request per product can wait for Tahir.

## Tahir (COO, role coo)

App Guide:
1. Today shows prices, list revisions, threshold changes and target overrides waiting for you, recipes stuck more than 2 working days, and customers below target.
2. Re-approvals of cost are Yawar's; you see them for information.
3. Approve or send back each price with a reason.
4. Each month check the top 15 rates against the purchase register.
5. Margin: start with forward exposure, then drill into the customer, product and PO.

Also:
6. VAN brand list revisions (D-28): Today shows "Approve list revision". Open it on Price lists, check each price from and to, then Approve (press twice to confirm) or Send back with a reason.
7. Approvals take 2 presses: the button changes to "Confirm: ..." and you press again within 6 seconds.
8. Approvals dated ahead (D-34): a price or list revision approved for a later date waits for it. Prices shows "Approved, waiting for their date"; Price lists shows the waiting revision. Today's price or list stays in force until then. Press Withdraw and write why to cancel it before its date. A newer price approval for the same pack cancels the older waiting price, and the change record says so.
9. Re-approvals: Yawar's open items show on your Today under "For your information" (they are not counted as your jobs) and read only on Recipes. You cannot approve or close them (R-2 Cost).
10. Margin: the switch "Expected kg: budget" or "Expected kg: last 3 months" changes the forward view on your screen only; it is not saved (D-27). Forward kg leaves out kg already on open POs. A second switch shows past trucks at the cost approved on their date, or "restated at today's labour and FOH rates" (D-35).
11. Flags: red needs more than the red gap in points below target and a Rs gap above the red share of all white label sales. Amber reads "slightly below target" (within the red gap) or "N pts below target, small Rs".

## Majid (Production Manager, role production)

App Guide:
1. Today shows recipes to check or revise.
2. Write a new version from Recipes when a recipe changes, including a one-time change.
3. A recipe sent back carries a reason and advice; revise and resend it, and it goes straight back to whoever sent it.

## Himayat (QC Head, role qc)

App Guide:
1. Today shows recipes to review and materials to complete.
2. Materials: class each material (nutrient source, or no nutrients such as binder, filler, anti-caking agent, wetting agent) and enter the % of each nutrient field.
3. Check the inputs and the nutrient analysis, then mark reviewed or send back with a reason and advice.

Also:
4. Materials screen (D-23): use the filter To do. Classes are grouped: nutrient sources, and "adds no nutrients". Pick a class, then press Save class. Moving a material to a no-nutrient class clears its % values (they stay in the change record).
5. Enter %: "Blank fields are 0" is ticked; untick it if a blank means "not known yet".
6. Gypsum, Plaster of Paris (POP) and calcium hydroxide load as "Calcium and sulphur source" (Ca%, S%). Change any class that is wrong.

## Fahim (Plant Manager, role plant)

App Guide:
1. Today shows recipes to endorse.
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
