# 9. Formulas and business rules

Version 1.2 · 16 Oct 2026 · Owner: Yawar; Tahir rules · Rule: R-5h item 9 (D-20)
Changed in 0.4.0 and 0.5.0: every worked example now uses made-up figures (public repo); F-05 rate order per D-37 (base bands last); F-09 floor includes labour (D-36); F-13 flag wording; B-04 adds dated approvals; settings list matches migration 001 (9 rows); band values removed.
Changed in 0.3.0 and 0.3.1: F-15 Pakistan time added. F-17 marked as proved by flow test H-02. F-05 and F-16 per the labour and FOH ruling. New rules B-01 to B-03 listed.

Code: c2m-lib.js (formulas), c2m-engine.js (nutrients). Proof: C2M App/tests/lib.test.js (F-xx) and C2M App/tests/flow.test.js (letters); the tests stay on Tahir's PC, outside apps/c2m. Units: Rs; per kg, or per L when a product is sold per L. Rounding: stored to 4 decimals; shown to 2 (Rs per kg) or 0 (Rs totals). Owner of every formula: Yawar; ruled by Tahir unless stated.

All worked examples below are example figures. Product A, Product B, Material M, Material N, Client X and the Rs amounts are made up. The real figures are in Yawar's sheets and in C2M itself, never in this file.

| Id | Formula or rule | Worked example (example figures) | Ruling | Test |
|---|---|---|---|---|
| F-01 | Rate warning when abs(new - last) / last x 100 > rate_warn_pct (rise or drop) | Material N 400 to 4,000 warns; 400 to 436 (9%) does not | D-10 (13 to 14 Oct) | F-01 (lib), P-02 (flow) |
| F-02 | Materials = sum of qty x latest rate | Product A: 1 x 50 + 0.10 x 400 = 90.00 | 10 Oct | F-02 |
| F-03 | Recipe total = sum of qty; above 1 = loss carried; below 1 = water or solvent not listed | Product A 1.10; a liquid with water not listed 0.40 | 10 Oct | F-03 |
| F-04 | Packing per kg = sum of primary price x pieces / pack + sum of secondary price x pieces / (packs per outer x pack) | Product A 10 kg: bag 100/10 + carton 200/(2 x 10) = 20.00; Product B 25 kg: bag 150/25 + inner 50/25 = 8.00 | D-19 | F-04, C-02 |
| F-05 | Rate choice, per kind (labour, FOH): products listed on the rate, then product type, then rates Yawar added for all products, then the base bands (is_base). Within a level: more conditions first, then latest date, then narrower pack range, then newest | a rate Yawar adds for all liquids beats the liquid base bands; a liquid rate beats a plain all-products rate | D-04, D-25, D-37 | F-05, F-18 |
| F-06 | Cost = materials + packing + conversion + freight | Today: Product A 90.00 + 20.00 + 20.00 + 0 = 130.00. If the approved cost came from Yawar's sheet with a different conversion, e.g. 90.00 + 20.00 + 30.00 = 140.00, the approved cost stays 140.00 until Yawar approves the re-approval item | 10 Oct; D-25; A-19 | F-06, B-01 |
| F-07 | Margin % = (net price - cost) / net price x 100; net price excludes FED and sales tax | Product A PO 200.00: on 130.00 = 35.0%; on 140.00 = 30.0% | 10 Oct | F-07 |
| F-08 | Target price = cost / (1 - target %); no target = blank | Product B cost 150.00 at 25% = 200.00 | 10 Oct | F-08 |
| F-09 | Contribution floor = materials + packing + freight + labour rate (FOH left out as fixed) | 90.00 + 20.00 + 0 + 4.00 = 114.00 | D-36 | F-09 |
| F-10 | O2S net price: FED-inclusive / 1.05; free line 0 | 210.00 with FED gives 200.00 | O2S rule | F-10, O-01 |
| F-11 | Re-approval when abs(cost - last approved) / last approved x 100 > reapprove_pct (3% of the product's cost per kg) | 140.00 to 147.00 (+5%) needs re-approval; 100.00 to 102.90 (2.9%) does not | 10 Oct; R-5i 6 | F-11, P-04 |
| F-12 | Locked = max(target price - PO price, 0) x open kg, per open PO line at its own price. Forward = max(target price - current price, 0) x (expected kg - kg already on open POs, not below 0). Expected kg = budget kg a year / 12 x forward_months, shared across a product's packs by kg shipped; or the last 91 days' trucks scaled to forward_months. Basis picked by a screen switch, not saved | Product B: target price 200.00, PO price 190.00, open 10,000 kg: locked = 10.00 x 10,000 = Rs 100,000 | D-15, D-27 | F-12 |
| F-13 | Flags: below cost red; no target and no budget grey "no target"; gap > red_gap_pts and Rs gap > red_share_pct % of all white label sales in the period red; gap > red_gap_pts with a small Rs gap amber "N pts below target, small Rs"; any other shortfall amber "slightly below target"; below budget amber | Client X at 15% against a 20% target on Rs 50M of sales: Rs gap 2.5M, above 1% of Rs 130M white label sales (Rs 1.3M): red. The same gap on Rs 5M of sales: amber "5.0 pts below target, small Rs" | D-17, D-31 | F-13 |
| F-14 | Recipe chain draft, review, endorse, cost, approved; resend returns to the step that sent it back | | D-08, R-5i 1 | F-14, R-06 |
| F-15 | Pakistan time: every date and time C2M writes is Asia/Karachi (UTC+5, no daylight saving) | 20:30 UTC on 15 Oct is 16 Oct in Pakistan | 0.2.0 review fix | F-15 |
| F-16 | Conversion per kg = labour rate picked + FOH rate picked | Product A 4.00 + 16.00 = 20.00 | D-25 | F-16 |
| F-17 | Nutrient % in product = sum of qty x % over nutrient inputs; non-nutrient inputs add 0 but count in weight; a blank field makes the analysis incomplete; an unclassified input is listed | A recipe with talc lists it as a non-nutrient input with its kg | D-23, R-5i 4a | H-02 (flow test, not a lib test) |

## Business rules with a test

| Id | Rule | Owner | Ruling | Test |
|---|---|---|---|---|
| B-01 | The move to the bands is not loaded as approved. The 13 Oct approved cost is Yawar's sheet; packs moving over 3% wait in 1 re-approval item. An empty "approve ticked" is refused | Yawar | D-25, A-19 | B-01 |
| B-02 | A KAM never receives cost, margin or ungranted columns; settings and cost documents stay with Yawar and Tahir | Tahir | R-2 People and rights | B-02, A-04, G-03 |
| B-03 | Labour and FOH rates: no future dates; pack range checked; a list rate keeps its form filter; the last rate of a kind cannot be retired | Yawar | D-25 | B-03 |
| B-04 | 1 price waiting for Tahir per pack; 1 revision waiting per list; 1 approved price waiting for its date per pack (a newer approval cancels the older); 1 approved revision waiting for its date per list (a new revision is refused until it applies or is withdrawn) | Yawar, Tahir | D-22, D-28, D-34 | G-04, V-01, V-02, W-01, W-02 |
| B-05 | Cost approval needs a rate for every material and a labour and a FOH rate for every pack | Yawar | D-25 | R-07, B-03 |
| B-06 | Reprocessed products take the solid reprocessed band; the floor includes labour | Yawar | D-30, D-36 | V-03, F-09 |
| B-07 | C2M does not start without the platform pool; dates must come back as text | Tahir | D-21 | W-03 |
| B-08 | 1 open target request per product | Yawar | D-06 | flow test S-02 covers the request; the 1-open check is not yet tested on its own (I-14) |

## Limits and thresholds (Back Office, Settings; owner: Yawar proposes, Tahir approves; D-18)
Need Tahir's approval: rate_warn_pct 10 · reapprove_pct 3 · red_share_pct 1 · red_gap_pts 2 · forward_months 3.
Notice to Tahir: budget_gp · ambition_gp · wl_budget_gp · conv_budget_month. They start at 0 in migration 001 and are set by the first load from the budget.
Bands: the base bands (Rs per kg, set by Yawar; loaded at first load), from 13 Oct (A-15, D-38): solid not reprocessed; solid reprocessed; liquid packs 10 L and above; liquid packs below 10 L. Each is split into a labour rate and a FOH rate.
Other fixed rules: a recipe more than 2 working days at one step is "stuck" (Sundays off; D-33); a price is due for revision when older than 30 days; the O2S pull lock frees after 10 minutes.
