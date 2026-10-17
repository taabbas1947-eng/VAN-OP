# 4. Database schemas

Version 1.2 · 16 Oct 2026 · Owner: Tahir (C2M module owner); Claude records · Rule: R-5h item 4 (D-20)
Changed in 0.4.0 and 0.5.0: new columns c2m_conversion_rule.is_base and c2m_list_revision.applied; settings are 9 rows (red_share_pct replaces red_rs; new conv_budget_month; budget_gp, ambition_gp, wl_budget_gp and conv_budget_month start at 0 and are set by the first load); new audit actions cancelled, withdrawn, applied, cost moved since shown; examples use made-up figures. Still 39 tables.
Changed in 0.3.0 and 0.3.1: 39 tables (was 37). New tables c2m_conversion_rule_product and c2m_list_revision. New columns c2m_material_type.nutrient_role, c2m_conversion_rule.kind, c2m_client_product.budget_kg_year. Full column dictionary, keys and indexes added. Full ER diagram.

Source of truth: `apps/c2m/migrations/001_c2m_core.sql`. Every table is named `c2m_...`. Engine InnoDB, utf8mb4, ROW_FORMAT=DYNAMIC. Target MySQL 5.7+ or MariaDB 10.4+.
Rule references: R-2 = Design Record section 2; R-5b to R-5i = Design Record sections 5b to 5i; D-xx = 06-decisions.md.

## 4.1 Migrations, in order

| File | What it does | Applied | Owner | Rule |
|---|---|---|---|---|
| 001_c2m_core.sql | Creates 39 c2m_ tables, 9 default settings (see c2m_setting below) and 4 data sources. CREATE TABLE IF NOT EXISTS and INSERT IGNORE: safe to run twice. Changes no O2S, PD or platform table. | Local, from the C2M App folder: `npm run migrate` (c2m_dev) and `npm test` (c2m_test) | Tahir | D-21 |
| 001_c2m_core.PRODUCTION.sql | The same content as 001_c2m_core.sql, with 1 line in front that names the platform database (phpMyAdmin needs it). Keep both in step; the test run checks it (migration.sync) | Production: once, by hand at go-live (C2M Go Live Plan.md) | Tahir | D-21 |

Nothing is live yet, so every change so far went into 001 (no 002). The first change after go-live must be a new file 002_... and must not edit 001.

Check after running: `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name LIKE 'c2m\_%';` gives 39.

## 4.2 Entity relationships (crow's foot, all 39 tables)

Notes: C2M declares no FOREIGN KEY constraints (the platform does not use them). The links below are kept by the code. Tables with no line to another table stand alone.

```mermaid
erDiagram
  c2m_source ||--o{ c2m_field_map : "maps fields"
  c2m_sync_run ||--o{ c2m_o2s_po_line : "sync_id"
  c2m_sync_run ||--o{ c2m_o2s_truck : "sync_id"
  c2m_o2s_po_line ||--o{ c2m_o2s_truck : "line_id"
  c2m_customer ||--o{ c2m_client_product : buys
  c2m_base_product ||--o{ c2m_variant : "has variants"
  c2m_base_product ||--o{ c2m_client_product : "product type"
  c2m_variant |o--o{ c2m_client_product : variant
  c2m_client_product ||--|{ c2m_client_pack : "sold in"
  c2m_client_product ||--o{ c2m_recipe_version : "own recipe, every version"
  c2m_client_product ||--o{ c2m_target_request : "target override"
  c2m_client_product ||--o{ c2m_conversion_rule_product : "listed on rate"
  c2m_conversion_rule ||--o{ c2m_conversion_rule_product : "list of products"
  c2m_base_product |o--o{ c2m_conversion_rule : "rate for a type"
  c2m_recipe_version ||--|{ c2m_recipe_line : inputs
  c2m_recipe_version ||--|{ c2m_recipe_step : history
  c2m_material_type |o--o{ c2m_raw_material : "class and nutrient fields"
  c2m_raw_material ||--|{ c2m_material_grade : grades
  c2m_material_grade ||--|{ c2m_material_rate : "dated rates"
  c2m_material_grade ||--o{ c2m_recipe_line : "used in"
  c2m_packing_item ||--|{ c2m_packing_rate : "price per piece, dated"
  c2m_packing_item ||--o{ c2m_packing_bill_line : "used in"
  c2m_packing_bill ||--|{ c2m_packing_bill_line : items
  c2m_packing_bill |o--o{ c2m_client_pack : "packed with"
  c2m_client_pack ||--o{ c2m_cost_version : "dated approved cost"
  c2m_recipe_version |o--o{ c2m_cost_version : "costed from"
  c2m_client_pack ||--o{ c2m_price : prices
  c2m_list_price ||--o{ c2m_list_revision : "rows in items_json"
  c2m_customer ||--o{ c2m_list_grant : "client grant by name"
  c2m_setting ||--o{ c2m_setting_request : "changes_json keys"
  c2m_client_pack ||--o{ c2m_reapproval : "packs in items_json"
  c2m_price_doc {
    int id PK
  }
  c2m_freight_rate {
    int id PK
  }
  c2m_monthly_actual {
    char month PK
  }
  c2m_monthly_check {
    int id PK
  }
  c2m_notice {
    int id PK
  }
  c2m_audit {
    bigint id PK
  }
  c2m_import_item {
    int id PK
  }
```

Stand-alone tables (no key link): c2m_price_doc keeps its own snapshot of rows; c2m_freight_rate is matched by segment = channel and region = customer region; c2m_monthly_actual and c2m_monthly_check are keyed by month; c2m_notice, c2m_audit and c2m_import_item point at other rows only through text or JSON. Lines through items_json or names (re-approval, list revision, list grant, setting request) are links the code keeps, not columns.

## 4.3 Tables by group, with owner and rule

| Group | Tables | Owner (who writes) | Rule |
|---|---|---|---|
| A. Data links | c2m_source, c2m_field_map, c2m_sync_run, c2m_o2s_po_line, c2m_o2s_truck, c2m_import_item | O2S pull: Yawar or Tahir; import queue: Yawar | D-12, D-21, D-07 |
| B. Customers and products | c2m_customer, c2m_base_product, c2m_variant, c2m_client_product, c2m_client_pack | Yawar | R-2, D-03, D-25 |
| C. Materials and packing | c2m_material_type, c2m_raw_material, c2m_material_grade, c2m_material_rate, c2m_packing_item, c2m_packing_rate, c2m_packing_bill, c2m_packing_bill_line | Rates and packing: Yawar; class and nutrient %: Himayat (or Yawar) | D-10, D-19, D-23 |
| D. Recipes | c2m_recipe_version, c2m_recipe_line, c2m_recipe_step | Majid writes; Himayat, Fahim, Yawar step | D-08, D-09 |
| E. Cost | c2m_conversion_rule, c2m_conversion_rule_product, c2m_freight_rate, c2m_cost_version, c2m_reapproval, c2m_monthly_actual, c2m_monthly_check | Yawar; monthly rate check: Tahir | D-04, D-05, D-16, D-18, D-25 |
| F. Prices and targets | c2m_price, c2m_list_price, c2m_list_revision, c2m_price_doc, c2m_target_request | Yawar proposes; Tahir approves | D-06, D-14, D-28, R-5i 3 |
| G. Settings, access, notices | c2m_setting, c2m_setting_request, c2m_list_grant, c2m_notice | Yawar proposes; Tahir approves thresholds; Yawar grants lists | D-18, R-2 |
| H. Record | c2m_audit | Written by C2M on every change | R-5h, D-20 |

## 4.4 Column dictionary

Legend: PK primary key, UQ unique, IX index, AI auto increment. "Null" says whether the column may be empty. A blank default means none.

### A. Data links

**c2m_source** (data sources C2M reads; 4 rows by default). Owner: Tahir. Rule D-12.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | INT AI | no | | PK |
| system_name | VARCHAR(40) | no | | Platform, O2S, Yawar files |
| what | VARCHAR(150) | no | | What C2M takes from it |
| schedule | VARCHAR(60) | no | | e.g. On request, Monthly |
| read_only | TINYINT(1) | no | 1 | 1 = C2M only reads |
| last_pull_at | DATETIME | yes | | Last pull, Pakistan time |
| last_pull_note | VARCHAR(255) | yes | | Counts, or the error of a failed pull |
| status | VARCHAR(30) | no | 'Not yet run' | Not yet run, Not yet set, Ready, Pulling, Read, Failed |

Keys: UQ uq_source (system_name, what).

**c2m_field_map** (field mapping shown in Back Office, Data links). Owner: Tahir. Rule D-12.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | INT AI | no | | PK |
| source_id | INT | no | | c2m_source.id |
| source_field | VARCHAR(80) | no | | Field in the other system, e.g. orders[].lines[].invoicePrice |
| c2m_field | VARCHAR(80) | no | | What it becomes in C2M |
| rule_text | VARCHAR(255) | no | | How it is changed on the way |

Keys: IX ix_fm_source (source_id).

**c2m_sync_run** (1 row per O2S pull). Owner: Yawar or Tahir (whoever pulls). Rule D-21.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | INT AI | no | | PK; written as sync_id on copied rows |
| started_at | DATETIME | no | | Start |
| finished_at | DATETIME | yes | | End; empty if it failed |
| by_user | VARCHAR(64) | no | | Who pulled (or "import") |
| po_lines | INT | no | 0 | PO lines copied |
| trucks | INT | no | 0 | Trucks copied |
| issues_json | LONGTEXT | yes | | List of problems: price below Rs 10, customer not matched |

**c2m_o2s_po_line** (read-only copy of O2S PO lines). Owner: O2S (C2M copies). Rule D-12, D-15.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| line_id | VARCHAR(40) | no | | PK, O2S line id |
| po | VARCHAR(60) | no | | PO number |
| received | DATE | yes | | PO received date |
| customer_name | VARCHAR(160) | no | | O2S customer name (dealer code removed) |
| channel | VARCHAR(40) | no | | O2S channel, e.g. White Label, Dealer |
| brand | VARCHAR(120) | no | | O2S brand |
| pack | DECIMAL(10,3) | no | | Pack size, kg or L |
| ordered_kg | DECIMAL(14,3) | no | 0 | Ordered |
| dispatched_kg | DECIMAL(14,3) | no | 0 | Dispatched |
| open_kg | DECIMAL(14,3) | no | 0 | Ordered less dispatched; 0 when short-closed or "Old POs" |
| net_price | DECIMAL(12,4) | no | 0 | Rs per kg or L, without FED and sales tax (F-10) |
| fed_mode | VARCHAR(20) | yes | | Inclusive or Exclusive |
| payment_terms | VARCHAR(40) | yes | | O2S payment terms |
| short_closed | TINYINT(1) | no | 0 | 1 = short-close approved in O2S |
| sync_id | INT | no | | c2m_sync_run.id of the pull that wrote it |

Keys: IX ix_pol_cust (customer_name), IX ix_pol_brand (brand).

**c2m_o2s_truck** (read-only copy of O2S trucks out). Owner: O2S (C2M copies). Rule D-16.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | VARCHAR(40) | no | | PK, O2S shipment id |
| line_id | VARCHAR(40) | no | | c2m_o2s_po_line.line_id |
| po | VARCHAR(60) | no | | PO number |
| dc | VARCHAR(40) | yes | | Delivery challan |
| truck_date | DATE | no | | approvedDate, else dispatch date |
| kg | DECIMAL(14,3) | no | | Kg or L on the truck |
| sync_id | INT | no | | Pull that wrote it |

Keys: IX ix_tr_line (line_id), IX ix_tr_date (truck_date).

**c2m_import_item** (Yawar's import queue). Owner: Yawar. Rule D-07, R-4.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | INT AI | no | | PK |
| area | VARCHAR(30) | no | | Rates, Packing, Recipes, Products, Rules, Targets, Customers, Prices |
| item | VARCHAR(160) | no | | Short title |
| found_text | TEXT | no | | What was found in the sheets |
| prefill_text | VARCHAR(400) | no | | What C2M suggests |
| effect_text | VARCHAR(400) | yes | | Effect on cost or price |
| kind | VARCHAR(30) | no | | rate or note (see 10) |
| payload | LONGTEXT | no | | JSON, e.g. {gradeId, rate} for a rate item |
| source_ref | VARCHAR(200) | yes | | File, sheet, cell |
| status | VARCHAR(20) | no | 'open' | open, accepted, corrected |
| decided_by | VARCHAR(64) | yes | | Yawar |
| decided_at | DATETIME | yes | | When |
| decision_note | VARCHAR(400) | yes | | "Accepted: ..." or "Corrected to ... Why: ..." |

Keys: IX ix_imp_status (status).

### B. Customers and products

**c2m_customer**. Owner: Yawar. Rule R-2, R-5 client price rule.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | INT AI | no | | PK |
| name | VARCHAR(120) | no | | UQ. Short name in C2M, e.g. Client X |
| o2s_names | VARCHAR(600) | no | | O2S names and other spellings, separated by \| |
| grp | VARCHAR(20) | no | | White label, VAN brand, Both |
| segment | VARCHAR(40) | no | | White label, COBO, Dealer, Distributor, VGreen, Farmer |
| price_rule | VARCHAR(20) | yes | | time, po, list; empty = to set |
| price_cycle | VARCHAR(40) | yes | | e.g. Monthly, Per PO |
| region | VARCHAR(40) | yes | | Used for freight |
| active | TINYINT(1) | no | 1 | 1 = in use |

**c2m_base_product** (product type; the production lines of budget V9). Owner: Yawar. Rule D-25, A-16.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | INT AI | no | | PK |
| name | VARCHAR(120) | no | | UQ. e.g. NPK Line, Humic Line - Crystal |

**c2m_variant** (not used by any screen yet). Owner: Yawar. Rule R-2.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | INT AI | no | | PK |
| base_product_id | INT | no | | c2m_base_product.id |
| name | VARCHAR(120) | no | | Powder, Pellet, Foliar |

Keys: UQ uq_variant (base_product_id, name).

**c2m_client_product** (what a customer buys under its brand). Owner: Yawar. Rule D-03, D-06, D-25, D-27.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | INT AI | no | | PK |
| customer_id | INT | no | | c2m_customer.id |
| channel | VARCHAR(20) | no | | White label, Distributor, Dealer, Farmer, COBO, VGreen |
| brand | VARCHAR(120) | no | | Name on the pack |
| o2s_brand | VARCHAR(120) | no | | Brand as O2S writes it |
| base_product_id | INT | yes | | Product type (c2m_base_product.id); used to assign labour and FOH rates |
| variant_id | INT | yes | | Not used yet |
| spec | VARCHAR(200) | yes | | e.g. NPK 10:10:10 |
| form | VARCHAR(10) | no | 'solid' | solid, liquid |
| reprocessed | TINYINT(1) | no | 0 | 1 = reprocessed; picks the solid reprocessed base band. Set per product by Yawar in Back Office, Products and packing (D-30) |
| sold_per | VARCHAR(4) | no | 'kg' | kg, L |
| density | DECIMAL(8,4) | yes | | kg per L; not used yet |
| packing_mode | VARCHAR(20) | no | 'VAN' | VAN, client, bulk |
| target_gp | DECIMAL(6,2) | yes | | Target GP %; empty = no target, never 0 |
| budget_gp | DECIMAL(6,2) | yes | | Budget V9 GP % |
| budget_kg_year | DECIMAL(14,2) | yes | | Budget V9 kg a year; basis of forward exposure on "budget kg" |
| active | TINYINT(1) | no | 1 | 1 = in use |

Keys: UQ uq_cp (customer_id, channel, o2s_brand).

**c2m_client_pack**. Owner: Yawar. Rule D-19.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | INT AI | no | | PK |
| client_product_id | INT | no | | c2m_client_product.id |
| pack_size | DECIMAL(10,3) | no | | kg or L, as sold_per |
| packing_bill_id | INT | yes | | c2m_packing_bill.id; empty for bulk |

Keys: UQ uq_pack (client_product_id, pack_size).

### C. Materials and packing

**c2m_material_type** (material class). Owner: Himayat (classes used); Yawar. Rule D-23, R-5i 4a.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | INT AI | no | | PK |
| name | VARCHAR(80) | no | | UQ. e.g. Potash source, Non-nutrient: binder |
| nutrient_fields | VARCHAR(200) | no | | Fields asked, separated by \|, e.g. K%\|SO4%; empty for non-nutrient classes |
| nutrient_role | VARCHAR(14) | no | 'nutrient' | nutrient, none, unclassified (see 10) |

**c2m_raw_material**. Owner: Yawar adds; Himayat classes. Rule D-23.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | INT AI | no | | PK |
| name | VARCHAR(120) | no | | UQ. Material name |
| type_id | INT | yes | | c2m_material_type.id (its class) |
| unit | VARCHAR(4) | no | 'kg' | kg, L |

**c2m_material_grade**. Owner: Yawar adds; Himayat enters nutrient %. Rule D-23.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | INT AI | no | | PK |
| material_id | INT | no | | c2m_raw_material.id |
| grade | VARCHAR(60) | no | 'Standard' | Grade name |
| nutrients_json | TEXT | yes | | e.g. {"K%": 56}. Cleared when the class becomes non-nutrient (old values kept in c2m_audit) |

Keys: UQ uq_grade (material_id, grade).

**c2m_material_rate** (dated rates, kept forever). Owner: Yawar. Rule D-10, R-2 Rates.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | INT AI | no | | PK |
| grade_id | INT | no | | c2m_material_grade.id |
| rate | DECIMAL(12,4) | no | | Rs per kg or L, latest purchase rate |
| rate_date | DATE | no | | Date saved (Pakistan) |
| source | VARCHAR(200) | no | | PO, quote, or import |
| warned_confirmed | TINYINT(1) | no | 0 | 1 = saved after "Yes, I meant this rate" |
| entered_by | VARCHAR(64) | no | | Who |
| entered_at | DATETIME | no | | When |

Keys: IX ix_rate (grade_id, rate_date).

**c2m_packing_item**. Owner: Yawar. Rule D-19.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | INT AI | no | | PK |
| name | VARCHAR(120) | no | | UQ. e.g. Bag 10 kg |
| kind | VARCHAR(30) | no | | bag, pouch, bottle, can, drum, seal, inner, label, carton, cap, other, to itemise |

**c2m_packing_rate** (dated price per piece). Owner: Yawar. Rule D-19.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | INT AI | no | | PK |
| packing_item_id | INT | no | | c2m_packing_item.id |
| price_per_piece | DECIMAL(12,4) | no | | Rs per piece |
| rate_date | DATE | no | | Date saved |
| source | VARCHAR(200) | no | | PO, quote, import |
| entered_by | VARCHAR(64) | no | | Who |
| entered_at | DATETIME | no | | When |

Keys: IX ix_prate (packing_item_id, rate_date).

**c2m_packing_bill**. Owner: Yawar (approves alone). Rule D-19.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | INT AI | no | | PK |
| name | VARCHAR(160) | no | | UQ. e.g. "Product A 10 kg: Bag 10 kg + carton per 2 bags" |
| status | VARCHAR(20) | no | 'approved' | draft, approved |
| approved_by | VARCHAR(64) | yes | | Yawar |
| approved_at | DATETIME | yes | | When |

**c2m_packing_bill_line**. Owner: Yawar. Rule D-19.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | INT AI | no | | PK |
| packing_bill_id | INT | no | | c2m_packing_bill.id |
| packing_item_id | INT | no | | c2m_packing_item.id |
| level | VARCHAR(10) | no | 'primary' | primary (per pack), secondary (per outer) |
| pieces | DECIMAL(10,4) | no | 1 | Pieces per pack (primary) or per outer (secondary) |
| packs_per_outer | DECIMAL(10,3) | yes | | Secondary only: packs held by 1 outer |

Keys: IX ix_pbl (packing_bill_id).

### D. Recipes

**c2m_recipe_version**. Owner: Majid writes; each step owner moves it. Rule D-08, D-09, R-5i 1 and 2.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | INT AI | no | | PK |
| client_product_id | INT | no | | c2m_client_product.id |
| version_no | INT | no | | 1, 2, 3 per product |
| state | VARCHAR(20) | no | 'draft' | draft, review, endorse, cost, approved, old |
| note | VARCHAR(400) | yes | | e.g. one-time change: TSP replaced by DAP |
| sent_back_by | VARCHAR(64) | yes | | Who sent it back |
| sent_back_state | VARCHAR(20) | yes | | The step it was sent back from; resend returns there |
| sent_back_reason | VARCHAR(400) | yes | | Reason |
| sent_back_advice | VARCHAR(400) | yes | | Revision advice |
| created_by | VARCHAR(64) | no | | Who wrote it |
| created_at | DATETIME | no | | When |

Keys: UQ uq_rv (client_product_id, version_no).

**c2m_recipe_line**. Owner: Majid. Rule R-2 Recipes.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | INT AI | no | | PK |
| recipe_version_id | INT | no | | c2m_recipe_version.id |
| grade_id | INT | no | | c2m_material_grade.id |
| qty | DECIMAL(14,8) | no | | kg (or L) of input per 1 kg (or L) of product, loss included |

Keys: IX ix_rl (recipe_version_id).

**c2m_recipe_step** (history of every step). Owner: C2M writes. Rule D-08.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | INT AI | no | | PK |
| recipe_version_id | INT | no | | c2m_recipe_version.id |
| action | VARCHAR(30) | no | | imported, written, sent, resent, reviewed, endorsed, cost_approved, sent_back |
| by_user | VARCHAR(64) | no | | Who |
| at | DATETIME | no | | When |
| note | VARCHAR(400) | yes | | Note, or reason and advice |

Keys: IX ix_rs (recipe_version_id).

### E. Cost

**c2m_conversion_rule** (named labour or FOH rate). Owner: Yawar. Rule D-04, D-25, R-5i 7.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | INT AI | no | | PK |
| name | VARCHAR(160) | no | | e.g. "Base labour: solid, not reprocessed" |
| kind | VARCHAR(10) | no | 'foh' | labour, foh |
| is_base | TINYINT(1) | no | 0 | 1 = a base band (loaded at first load). Rates Yawar adds are 0 and beat the base bands (D-37) |
| rs_per_kg | DECIMAL(10,4) | no | | Rs per kg or L for this kind |
| scope_client_product_id | INT | yes | | Old single-product scope; new list rates use c2m_conversion_rule_product |
| scope_base_product_id | INT | yes | | Product type the rate is for |
| scope_form | VARCHAR(10) | yes | | solid, liquid; empty = any |
| scope_reprocessed | TINYINT(1) | yes | | 1, 0; empty = any |
| scope_pack_min | DECIMAL(10,3) | yes | | Packs from this size (included) |
| scope_pack_max | DECIMAL(10,3) | yes | | Packs below this size |
| valid_from | DATE | no | | Start; today or earlier only (0.3.1) |
| source | VARCHAR(200) | no | | Who ruled or why |
| active | TINYINT(1) | no | 1 | 0 = retired |

**c2m_conversion_rule_product** (new in 0.3.0: a rate assigned to a list of products). Owner: Yawar. Rule D-25.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| rule_id | INT | no | | c2m_conversion_rule.id |
| client_product_id | INT | no | | c2m_client_product.id |

Keys: PK (rule_id, client_product_id).

**c2m_freight_rate**. Owner: Yawar. Rule D-05.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | INT AI | no | | PK |
| segment | VARCHAR(40) | no | | Dealer, Farmer |
| region | VARCHAR(40) | no | | e.g. Sindh |
| rs_per_kg | DECIMAL(10,4) | no | | Rs per kg |
| valid_from | DATE | no | | Start |

Keys: UQ uq_fr (segment, region, valid_from).

**c2m_cost_version** (dated approved cost per pack; kept forever). Owner: Yawar approves. Rule D-16.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | INT AI | no | | PK |
| client_pack_id | INT | no | | c2m_client_pack.id |
| valid_from | DATETIME | no | | In force from |
| materials | DECIMAL(12,4) | no | | Rs per kg or L |
| packing | DECIMAL(12,4) | no | | Rs per kg or L |
| conversion | DECIMAL(12,4) | no | | Labour + FOH, Rs per kg or L |
| freight | DECIMAL(12,4) | no | | Rs per kg |
| total | DECIMAL(12,4) | no | | Sum |
| recipe_version_id | INT | yes | | Recipe version costed |
| cause | VARCHAR(300) | no | | e.g. "Yawar's Master Cost Sheet of 2026-10-13", "Re-approval: ..." |
| approved_by | VARCHAR(64) | no | | Yawar, or "import" |

Keys: IX ix_cv (client_pack_id, valid_from).

**c2m_reapproval** (1 item per cause). Owner: Yawar decides. Rule R-2 Cost, R-5i 6.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | INT AI | no | | PK |
| cause | VARCHAR(300) | no | | e.g. "Material M rate Rs 387 to Rs 433, 2026-10-16" (example figures) |
| items_json | LONGTEXT | no | | [{packId, label, from, to, pct}] |
| status | VARCHAR(20) | no | 'open' | open, approved, dismissed |
| created_at | DATETIME | no | | When |
| decided_by | VARCHAR(64) | yes | | Yawar |
| decided_at | DATETIME | yes | | When |

**c2m_monthly_actual**. Owner: Yawar. Rule D-18.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| month | CHAR(7) | no | | PK, YYYY-MM |
| actual_labour | DECIMAL(16,2) | yes | | Rs |
| actual_foh | DECIMAL(16,2) | yes | | Rs |
| kg_produced | DECIMAL(16,3) | yes | | From O2S batches when linked (not yet) |
| absorbed | DECIMAL(16,2) | yes | | Charged to products (needs kg produced) |
| entered_by | VARCHAR(64) | yes | | Who |
| entered_at | DATETIME | yes | | When |

**c2m_monthly_check**. Owner: Tahir (rate_check), Yawar (tie_books). Rule D-18.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | INT AI | no | | PK |
| month | CHAR(7) | no | | YYYY-MM |
| kind | VARCHAR(20) | no | | rate_check, tie_books |
| data_json | LONGTEXT | yes | | tie_books: ERP sales and COGS |
| done_by | VARCHAR(64) | no | | Who |
| done_at | DATETIME | no | | When |

Keys: UQ uq_mc (month, kind).

### F. Prices and targets

**c2m_price** (white label client price per pack). Owner: Yawar proposes; Tahir approves. Rule D-06, D-22, R-5i 3.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | INT AI | no | | PK |
| client_pack_id | INT | no | | c2m_client_pack.id |
| price | DECIMAL(12,4) | no | | Rs per kg or L, net of FED and sales tax |
| prev_price | DECIMAL(12,4) | yes | | Price it replaces; taken again at approval |
| valid_from | DATE | no | | Effective date. On approval: the later of the proposed date and the approval date |
| valid_to | DATE | yes | | Valid till: the LAST day the price applies (inclusive). Set to the day before a new price starts |
| cut_price_id | INT | yes | | The price this approval shortened |
| cut_prev_to | DATE | yes | | That price's valid_to before; put back on withdraw or cancel |
| reason | VARCHAR(400) | yes | | Reason for change; printed on client lists |
| below_target_reason | VARCHAR(400) | yes | | Required when GP is below target |
| status | VARCHAR(20) | no | 'proposed' | proposed, approved, sent_back, replaced. An approved price with valid_from after today waits for its date (only 1 per pack); a waiting price cancelled by a newer approval becomes cancelled; one Tahir withdraws becomes withdrawn |
| proposed_by | VARCHAR(64) | no | | Yawar |
| proposed_at | DATETIME | no | | When |
| decided_by | VARCHAR(64) | yes | | Tahir |
| decided_at | DATETIME | yes | | When |
| back_reason | VARCHAR(400) | yes | | Tahir's reason for sending back |

Keys: IX ix_price (client_pack_id, status). The price in force on a date: status approved, valid_from on or before the date, valid_to empty or on or after it (valid_to is the last day).

**c2m_list_price** (VAN brand list rows). Owner: Yawar (through revisions approved by Tahir). Rule D-14, D-28.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | INT AI | no | | PK |
| list_name | VARCHAR(40) | no | | dist, dealer, farmer |
| product | VARCHAR(160) | no | | Product |
| spec | VARCHAR(200) | yes | | Specification |
| pack | VARCHAR(40) | yes | | Pack (empty on the farmer list) |
| data_json | TEXT | no | | Price columns only (see 10). Cost and margin are never stored here |
| issued | DATE | no | | List effective date |
| valid_till | DATE | yes | | List valid till |

**c2m_list_revision** (new in 0.3.0). Owner: Yawar proposes; Tahir approves. Rule D-28.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | INT AI | no | | PK |
| list_name | VARCHAR(40) | no | | dist, dealer, farmer |
| items_json | LONGTEXT | no | | [{id, product, pack, from:{...}, to:{...}}] |
| reason | VARCHAR(400) | no | | Reason for the revision |
| valid_from | DATE | no | | New effective date |
| valid_till | DATE | yes | | New valid till |
| status | VARCHAR(20) | no | 'proposed' | proposed, approved, sent_back, replaced, withdrawn (a waiting revision Tahir withdraws) |
| proposed_by | VARCHAR(64) | no | | Yawar |
| proposed_at | DATETIME | no | | When |
| decided_by | VARCHAR(64) | yes | | Tahir |
| decided_at | DATETIME | yes | | When |
| back_reason | VARCHAR(400) | yes | | Tahir's reason |
| applied | TINYINT(1) | no | 0 | 1 once its prices are in the list. An approval dated ahead stays 0 until the first load of C2M on or after valid_from (D-34) |

Keys: IX ix_lrev (list_name, status).

**c2m_price_doc** (every price list document issued). Owner: creator (Yawar, Tahir, or a KAM for granted lists). Rule D-14.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | INT AI | no | | PK |
| ref | VARCHAR(60) | no | | VAN/PL/year/number, set by C2M |
| audience | VARCHAR(30) | no | | wl, dist, dealer, farmer_pb, farmer_sn, farmer_snc, web |
| addressee | VARCHAR(160) | no | | Client or audience name |
| fields_json | LONGTEXT | no | | {fields, client, reasons, note, snapshot}. snapshot = the rows and dates as issued; a reprint uses it |
| effective | DATE | no | | Effective date printed |
| valid_till | DATE | yes | | Valid till printed |
| created_by | VARCHAR(64) | no | | Who |
| created_at | DATETIME | no | | When |

**c2m_target_request** (client target override). Owner: Yawar proposes; Tahir approves. Rule D-06.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | INT AI | no | | PK |
| client_product_id | INT | no | | c2m_client_product.id |
| from_gp | DECIMAL(6,2) | yes | | Target before |
| to_gp | DECIMAL(6,2) | no | | Target asked |
| reason | VARCHAR(400) | no | | Why |
| status | VARCHAR(20) | no | 'open' | open, approved, refused |
| by_user | VARCHAR(64) | no | | Yawar |
| at | DATETIME | no | | When |
| decided_by | VARCHAR(64) | yes | | Tahir |
| decided_at | DATETIME | yes | | When |

### G. Settings, access, notices

**c2m_setting** (9 rows by default, listed below the table). Owner: Yawar proposes; Tahir approves thresholds. Rule D-18.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| k | VARCHAR(40) | no | | PK, e.g. reapprove_pct |
| v | VARCHAR(100) | no | | Value |
| label | VARCHAR(160) | no | | Plain label |
| needs_approval | TINYINT(1) | no | 1 | 1 = Tahir approves; 0 = notice to Tahir |
| updated_by | VARCHAR(64) | yes | | Who |
| updated_at | DATETIME | yes | | When |

Default rows (migration 001):

| k | Default | needs_approval | Meaning |
|---|---|---|---|
| rate_warn_pct | 10 | 1 | Rate warning, rise or drop, % |
| reapprove_pct | 3 | 1 | Cost re-approval, % |
| red_share_pct | 1 | 1 | Red flag needs a Rs gap above this % of all white label sales in the period (replaces red_rs, D-31) |
| red_gap_pts | 2 | 1 | Red flag needs a gap to target above this many % points |
| forward_months | 3 | 1 | Forward exposure horizon, months |
| budget_gp | 0 | 0 | Company budget GP, %; set by the first load |
| ambition_gp | 0 | 0 | Company ambition GP, %; set by the first load |
| wl_budget_gp | 0 | 0 | White label budget GP, %; set by the first load |
| conv_budget_month | 0 | 0 | Budget labour + FOH a month, Rs; set by the first load; compared with monthly actuals |

**c2m_setting_request**. Owner: Yawar proposes; Tahir decides. Rule D-18.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | INT AI | no | | PK |
| changes_json | TEXT | no | | {"rate_warn_pct": "12"} |
| summary | VARCHAR(400) | no | | Plain summary |
| status | VARCHAR(20) | no | 'open' | open, approved, refused |
| by_user | VARCHAR(64) | no | | Yawar |
| at | DATETIME | no | | When |
| decided_by | VARCHAR(64) | yes | | Tahir |
| decided_at | DATETIME | yes | | When |

**c2m_list_grant**. Owner: Yawar. Rule R-2 People and rights.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | INT AI | no | | PK |
| username | VARCHAR(64) | no | | Platform user |
| grant_kind | VARCHAR(20) | no | | list, client |
| grant_value | VARCHAR(100) | no | | A list (dist, dealer, farmer_pb, farmer_sn, farmer_snc, web) or a customer name |
| granted_by | VARCHAR(64) | no | | Yawar |
| granted_at | DATETIME | no | | When |

Keys: UQ uq_grant (username, grant_kind, grant_value). A grant is removed by deleting its row (logged in c2m_audit).

**c2m_notice**. Owner: C2M writes. Rule D-18.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | INT AI | no | | PK |
| for_role | VARCHAR(20) | no | | coo, cfo |
| text | VARCHAR(400) | no | | e.g. "Setting changed: Company budget GP 20 to 21" (example figures) |
| by_user | VARCHAR(64) | no | | Who caused it |
| at | DATETIME | no | | When |
| seen | TINYINT(1) | no | 0 | 1 = seen |

### H. Record

**c2m_audit** (change record; nothing is deleted). Owner: C2M writes; Yawar and Tahir read. Rule R-5h, D-20.

| Column | Type | Null | Default | Meaning |
|---|---|---|---|---|
| id | BIGINT AI | no | | PK |
| at | DATETIME | no | | When (Pakistan) |
| by_user | VARCHAR(64) | no | | Who |
| entity | VARCHAR(40) | no | | rate, recipe, price, list_revision, material, reapproval, conversion_rule, client_product, ... |
| entity_id | VARCHAR(60) | yes | | Id of the thing changed |
| action | VARCHAR(40) | no | | create, save, update, approve, sent_back, dismiss, class, type, reprocessed, retire, cancelled (a waiting price replaced by a newer approval), withdrawn (Tahir withdrew a waiting price or list revision), applied (a waiting list revision reached its date; written once), cost moved since shown (re-approval approved at a cost that moved after the item was shown), ... |
| old_value | TEXT | yes | | JSON before (e.g. old class and nutrient values; a packing bill's old name and lines; the old freight rate; the old monthly actuals; the old monthly check) |
| new_value | TEXT | yes | | JSON after |
| why | VARCHAR(400) | yes | | Reason or source |

Keys: IX ix_audit (entity, entity_id).

## 4.5 Index list (all)

| Table | Index | Columns | Kind |
|---|---|---|---|
| c2m_source | uq_source | system_name, what | unique |
| c2m_field_map | ix_fm_source | source_id | index |
| c2m_o2s_po_line | ix_pol_cust, ix_pol_brand | customer_name; brand | index |
| c2m_o2s_truck | ix_tr_line, ix_tr_date | line_id; truck_date | index |
| c2m_import_item | ix_imp_status | status | index |
| c2m_customer | name | name | unique |
| c2m_base_product | name | name | unique |
| c2m_variant | uq_variant | base_product_id, name | unique |
| c2m_client_product | uq_cp | customer_id, channel, o2s_brand | unique |
| c2m_client_pack | uq_pack | client_product_id, pack_size | unique |
| c2m_material_type | name | name | unique |
| c2m_raw_material | name | name | unique |
| c2m_material_grade | uq_grade | material_id, grade | unique |
| c2m_material_rate | ix_rate | grade_id, rate_date | index |
| c2m_packing_item | name | name | unique |
| c2m_packing_rate | ix_prate | packing_item_id, rate_date | index |
| c2m_packing_bill | name | name | unique |
| c2m_packing_bill_line | ix_pbl | packing_bill_id | index |
| c2m_recipe_version | uq_rv | client_product_id, version_no | unique |
| c2m_recipe_line | ix_rl | recipe_version_id | index |
| c2m_recipe_step | ix_rs | recipe_version_id | index |
| c2m_conversion_rule_product | PRIMARY | rule_id, client_product_id | primary |
| c2m_list_revision | ix_lrev | list_name, status | index |
| c2m_freight_rate | uq_fr | segment, region, valid_from | unique |
| c2m_cost_version | ix_cv | client_pack_id, valid_from | index |
| c2m_monthly_check | uq_mc | month, kind | unique |
| c2m_price | ix_price | client_pack_id, status | index |
| c2m_list_grant | uq_grant | username, grant_kind, grant_value | unique |
| c2m_audit | ix_audit | entity, entity_id | index |

Every table also has its primary key (section 4.4).

## 4.6 Kept and deleted (owner: Tahir; rule R-5h)
- Nothing is deleted by users. Rates, packing prices, prices, list revisions, cost versions, recipe versions and steps, re-approval items and import items are kept forever with their status.
- Replaced by design: recipe lines of a DRAFT (when Majid saves new lines), lines of a packing bill (when Yawar edits it), a material's nutrient values when its class becomes non-nutrient. The old values go to c2m_audit first.
- Deleted by design: a list grant when Yawar removes it (logged); c2m_o2s_po_line and c2m_o2s_truck rows from older pulls (they are a copy of O2S).
- A retired labour or FOH rate stays with active = 0.

## 4.7 Platform tables C2M reads (not owned)
auth_users (name), user_module_roles (module 'c2m': cfo, coo, production, qc, plant, viewer), app_state row 1 (O2S data, read only). C2M writes none of them (D-12, D-21).
