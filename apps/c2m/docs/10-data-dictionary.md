# 10. Data dictionary and glossary

Version 1.2 · 16 Oct 2026 · Owner: Yawar; Himayat for material classes · Rule: R-5h item 10 (D-20)
Changed in 0.4.0 and 0.5.0: is_base, applied, the settings, waiting and withdrawn approvals, audit actions; band values and budget figures removed (public repo).
Changed in 0.3.0 and 0.3.1: rs_per_kg fixed (1 rate of 1 kind, labour or FOH). Added nutrient_role, kind, product type, reprocessed, budget_kg_year, valid_from and valid_to, every status value and every pick list. Column-level detail of every table is in 04.

## 10.1 Key fields

| Field | Meaning | Unit or values | Source | Rule |
|---|---|---|---|---|
| net_price | Price per kg or L on the O2S PO line, without FED and sales tax | Rs | O2S orders[].lines[].invoicePrice; / 1.05 when fedMode is Inclusive; 0 for free orders | F-10 |
| open_kg | Kg still to ship on a PO line | kg or L | ordered less dispatched; 0 when short-closed or in an "Old POs" customer | D-15 |
| truck_date | Day the truck counts as a sale | date | O2S shipments[].approvedDate, else dispatch | D-16 |
| qty (recipe line) | Input per 1 kg (or L) of product, loss included | kg per kg | Majid; day 1 from Yawar's sheet | R-2 Recipes |
| rate | Latest purchase rate of a material grade | Rs per kg or L | Yawar, with source | D-10 |
| price_per_piece | Price of 1 packing item | Rs | Yawar, with source | D-19 |
| pieces, packs_per_outer | Pieces of an item per pack; for a secondary item, packs held by 1 outer | number | Yawar's packing bill | D-19 |
| kind (c2m_conversion_rule) | Which part of conversion a rate is | labour, foh | Yawar | D-25 |
| rs_per_kg (c2m_conversion_rule) | Rs per kg or L of 1 named rate of 1 kind. A product's conversion = the labour rate picked + the FOH rate picked | Rs per kg or L | Yawar's rates; base bands loaded at first load, from 13 Oct | D-25, F-16 |
| is_base (c2m_conversion_rule) | Whether the rate is a base band. Rates Yawar adds are 0 and beat the base bands | 0, 1 | Loader sets 1 on the bands; Yawar's form sets 0 | D-37 |
| rs_per_kg (c2m_freight_rate) | Freight per kg for a segment and region | Rs per kg | Yawar | D-05 |
| base_product_id (product type) | The product's type: a production line of budget V9, used to assign labour and FOH rates | a c2m_base_product name | Loader from budget V9 (A-16); Yawar changes it | D-25 |
| reprocessed | Whether the product is reprocessed; picks the solid reprocessed band. Set per product | 0 no, 1 yes | Yawar, Back Office, Products and packing | D-04, D-25, D-30 |
| nutrient_role (c2m_material_type) | Whether a material class carries nutrients | nutrient, none, unclassified | Loader; Himayat changes a material's class | D-23 |
| nutrients_json | % of each nutrient field in a material grade | % (0 to 100) per field | Himayat | D-23 |
| target_gp | Target gross margin for the client product | %; blank = no target, never 0 | B2B sheet; override approved by Tahir | D-06 |
| budget_gp | GP in the FY 2026-27 budget | % | Budget V9 | A-13 |
| budget_kg_year | Kg (or L) a year in the FY 2026-27 budget | kg or L a year | Budget V9 | D-27, A-09 |
| valid_from, valid_to (c2m_price) | Effective date ("Takes effect from") and valid till of a client price. On approval valid_from becomes the later of the proposed date and the approval date; the price in force gets valid_to. An approved price with valid_from after today waits for its date (1 per pack) | date | Yawar proposes; Tahir approves | D-22, D-34, R-5i 3 |
| valid_from (c2m_conversion_rule) | First day a labour or FOH rate applies; today or earlier | date | Yawar | D-25 |
| valid_from, valid_till (c2m_list_revision) | New effective date and valid till of a VAN list | date | Yawar | D-28 |
| applied (c2m_list_revision) | Whether the revision's prices are in the list. An approval dated ahead stays 0 until the first load of C2M on or after its date | 0, 1 | C2M | D-34 |
| issued, valid_till (c2m_list_price) | Effective date and valid till of the VAN list; a VAN list PDF is dated from these | date | Loader (11 Oct); list revisions | D-14, D-28 |
| packing_mode | Who supplies packing | VAN, client, bulk | Yawar | D-26 |
| price_rule | How a client's price changes | time, po, list; blank = to set | Yawar | R-5 client price rule |
| channel | Sales channel of a client product | White label, Distributor, Dealer, Farmer, COBO, VGreen | O2S | R-2 |

## 10.2 Pick lists, in full

| List | Values | Where |
|---|---|---|
| Roles | cfo, coo, production, qc, plant, viewer | user_module_roles |
| Recipe state | draft, review, endorse, cost, approved, old | c2m_recipe_version.state |
| Recipe step action | imported, written, sent, resent, reviewed, endorsed, cost_approved, sent_back | c2m_recipe_step.action |
| Price status | proposed, approved, sent_back, replaced (approved and dated ahead = waiting; cancelled or withdrawn = replaced) | c2m_price.status |
| List revision status | proposed, approved, sent_back, replaced (approved with applied 0 = waiting; withdrawn = replaced) | c2m_list_revision.status |
| Re-approval status | open, approved, dismissed | c2m_reapproval.status |
| Import item status | open, accepted, corrected | c2m_import_item.status |
| Import item kind | rate (a correction is saved as a rate), note (records the decision only) | c2m_import_item.kind |
| Import item area | Rates, Packing, Recipes, Products, Rules, Targets, Customers, Prices | c2m_import_item.area |
| Setting request status | open, approved, refused | c2m_setting_request.status |
| Target request status | open, approved, refused | c2m_target_request.status |
| Packing bill status | draft, approved | c2m_packing_bill.status |
| Data source status | Not yet run, Not yet set, Ready, Pulling, Read, Failed | c2m_source.status |
| Conversion kind | labour, foh | c2m_conversion_rule.kind |
| Rate scope (on the form) | general (all products), type (a product type), list (a list of products) | POST rules/conversion |
| Form | solid, liquid | c2m_client_product.form, scope_form |
| Sold per, material unit | kg, L | c2m_client_product.sold_per, c2m_raw_material.unit |
| Packing mode | VAN, client, bulk | c2m_client_product.packing_mode |
| Packing level | primary, secondary | c2m_packing_bill_line.level |
| Packing item kind | bag, pouch, bottle, can, drum, seal, inner, label, carton, cap, other, to itemise | c2m_packing_item.kind |
| Price rule | time, po, list | c2m_customer.price_rule |
| Customer group | White label, VAN brand, Both | c2m_customer.grp |
| Freight segment | Dealer, Farmer | c2m_freight_rate.segment |
| nutrient_role | nutrient, none, unclassified | c2m_material_type.nutrient_role |
| Material classes (loaded) | Calcium and sulphur source (Ca%, S%: gypsum, Plaster of Paris, POP, calcium hydroxide); Non-nutrient: binder (starch, granulation agent, bentonite); Non-nutrient: filler (talc, fly ash); Non-nutrient: anti-caking agent (fume silica, silica); Non-nutrient: colour (dyes); Non-nutrient: pH adjuster (citric acid, NaOH); Non-nutrient: wetting agent or adjuvant; Potash source (K%); Potash and sulphate source (K%, SO4%); Nitrogen and phosphate source (N%, P%); Nitrogen source (N%; includes MEA); Phosphate source (P%); Sulphur source (S%); Humic source (Humic%, K%); Micronutrient (Zn%, Fe%, Mn%, Cu%, B%, Mg%); Organic source (N%, OM%: amino acid, poultry mud, press mud, molasses); Other input: to classify | c2m_material_type |
| Product types (loaded) | Compost Line, Granulation Line, Humic Line - Crystal, Humic Line - Pellets, Humic Line - Powder, Humic-Liquid, Micro Granule, Micro Nutrients-Liquid, NPK Line, Sulfur Coating Line, Traded-Solid; Yawar can add more | c2m_base_product |
| List names | dist, dealer, farmer | c2m_list_price.list_name, c2m_list_revision.list_name |
| List fields a revision may change | dist: now, mrp · dealer: nsv, disc (fraction; typed as % on screen), frp, mrp · farmer: pb, sn, snc | POST lists/revise |
| List columns that may leave the server | p, d, pack, prev, now, fed, mrp, terms, nsv, disc, net, netfed, frp, pb, sn, snc | safeRow in c2m-routes.js |
| Price list audiences | wl (white label client, monthly), dist (distributor and channel partner), dealer (dealer, Sindh), farmer_pb, farmer_sn, farmer_snc, web (website) | c2m_price_doc.audience, c2m_list_grant |
| Grant kind | list, client | c2m_list_grant.grant_kind |
| Monthly check kind | rate_check, tie_books | c2m_monthly_check.kind |
| Notice for | coo, cfo | c2m_notice.for_role |
| Exposure basis (screen only, not saved) | budget kg, run rate (last 3 months) | Margin screen switch |
| History basis (screen only, not saved) | cost approved on the truck's date; restated at today's labour and FOH rates | Margin screen switch |
| Settings | rate_warn_pct, reapprove_pct, red_share_pct, red_gap_pts, forward_months (Tahir approves); budget_gp, ambition_gp, wl_budget_gp, conv_budget_month (notice to Tahir; start at 0, set by the first load) | c2m_setting.k |
| Audit actions added in 0.5.0 | cancelled, withdrawn, applied, cost moved since shown | c2m_audit.action |

## 10.3 Glossary
- **GP**: gross profit margin, (price - cost) / price.
- **FOH**: factory overheads.
- **Labour rate, FOH rate**: named Rs per kg rates; each product takes 1 of each.
- **Bands (base bands)**: the conversion levels ruled on 13 Oct (Rs per kg, set by Yawar; loaded at first load), split into labour and FOH. Any rate Yawar adds beats them.
- **Conversion**: labour plus FOH charged to a product per kg.
- **Product type**: the production line a product is made on (budget V9).
- **Reprocessed**: a flag Yawar sets on a product; a reprocessed solid takes the solid reprocessed band.
- **Re-approval**: Yawar's approval of a new cost after a change moved it more than 3%.
- **Contribution floor**: lowest price that covers materials, packing, freight and the labour rate.
- **Waiting (approval)**: a price or list revision Tahir approved for a later date. It takes over by itself on that date; Tahir can withdraw it before then.
- **Freight inwards**: transport of materials to the plant. Material rates are delivered, so it is not part of FOH.
- **Locked in**: margin gap on POs already agreed.
- **Forward exposure**: margin gap on the coming months' expected volume, less kg already on open POs.
- **Rs at stake**: forward exposure in rupees, shown on the margin board.
- **Non-nutrient input**: binder, filler, anti-caking agent, wetting agent or adjuvant, colour, pH adjuster.
- **List revision**: a change to VAN brand list prices, approved by Tahir.
- **Sheet against C2M**: Back Office section comparing Yawar's 13 Oct sheet with C2M's cost today.
- **COBO**: VAN's own outlets.
- **KAM**: key account manager.
- **White label**: products VAN makes under a client's brand.
- **FED**: federal excise duty (5% on the distributor list).
- **MRP, FRP**: maximum retail price, farmer retail price.
- **NSV**: dealer price before discount.
- **PKT**: Pakistan time, Asia/Karachi.

