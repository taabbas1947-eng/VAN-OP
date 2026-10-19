-- PRODUCTION variant of 001_c2m_core.sql for HostGator phpMyAdmin, which stays stuck on information_schema
-- unless the database is named first (platform convention). Same content as 001_c2m_core.sql; keep both in step.
-- Run once, by hand, in phpMyAdmin (SQL tab). Creates only c2m_ tables; touches no O2S, PD or platform table.
USE jodilkah_vanop_db;

-- =============================================================================
-- C2M: Cost to Margin. Migration 001: core tables.
-- Creates only tables named c2m_*. Changes no O2S, PD or platform table.
-- Safe to run twice (CREATE TABLE IF NOT EXISTS; INSERT IGNORE for defaults).
-- Target: MySQL 5.7+ / MariaDB 10.4+ (VAN platform database).
-- Owner: C2M. Documentation: apps/c2m/docs/04-database-schema.md
-- =============================================================================

-- ---------- A. Data links -----------------------------------------------------
CREATE TABLE IF NOT EXISTS c2m_source (
  id INT AUTO_INCREMENT PRIMARY KEY,
  system_name VARCHAR(40) NOT NULL,            -- Platform, O2S, Yawar files
  what VARCHAR(150) NOT NULL,                  -- what C2M takes (150: unique key fits 767 bytes)
  schedule VARCHAR(60) NOT NULL,               -- e.g. On request, Nightly
  read_only TINYINT(1) NOT NULL DEFAULT 1,
  last_pull_at DATETIME NULL,
  last_pull_note VARCHAR(255) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Not yet run',
  UNIQUE KEY uq_source (system_name, what)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS c2m_field_map (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_id INT NOT NULL,
  source_field VARCHAR(80) NOT NULL,
  c2m_field VARCHAR(80) NOT NULL,
  rule_text VARCHAR(255) NOT NULL,
  KEY ix_fm_source (source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS c2m_sync_run (
  id INT AUTO_INCREMENT PRIMARY KEY,
  started_at DATETIME NOT NULL,
  finished_at DATETIME NULL,
  by_user VARCHAR(64) NOT NULL,
  po_lines INT NOT NULL DEFAULT 0,
  trucks INT NOT NULL DEFAULT 0,
  issues_json LONGTEXT NULL                    -- anomalies found (price below Rs 10, unknown customer, ...)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS c2m_o2s_po_line (       -- read-only copy of O2S PO lines
  line_id VARCHAR(40) PRIMARY KEY,
  po VARCHAR(60) NOT NULL,
  received DATE NULL,
  customer_name VARCHAR(160) NOT NULL,
  channel VARCHAR(40) NOT NULL,
  brand VARCHAR(120) NOT NULL,
  pack DECIMAL(10,3) NOT NULL,
  ordered_kg DECIMAL(14,3) NOT NULL DEFAULT 0,
  dispatched_kg DECIMAL(14,3) NOT NULL DEFAULT 0,
  open_kg DECIMAL(14,3) NOT NULL DEFAULT 0,
  net_price DECIMAL(12,4) NOT NULL DEFAULT 0,  -- per kg or L; FED-inclusive divided by 1.05; FOC 0
  fed_mode VARCHAR(20) NULL,
  payment_terms VARCHAR(40) NULL,
  short_closed TINYINT(1) NOT NULL DEFAULT 0,
  sync_id INT NOT NULL,
  KEY ix_pol_cust (customer_name), KEY ix_pol_brand (brand)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS c2m_o2s_truck (         -- read-only copy of O2S trucks out
  id VARCHAR(40) PRIMARY KEY,
  line_id VARCHAR(40) NOT NULL,
  po VARCHAR(60) NOT NULL,
  dc VARCHAR(40) NULL,
  truck_date DATE NOT NULL,
  kg DECIMAL(14,3) NOT NULL,
  sync_id INT NOT NULL,
  KEY ix_tr_line (line_id), KEY ix_tr_date (truck_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS c2m_import_item (
  id INT AUTO_INCREMENT PRIMARY KEY,
  area VARCHAR(30) NOT NULL,                   -- Rates, Packing, Recipes, Products, Targets, Customers, Prices, Data
  item VARCHAR(160) NOT NULL,
  found_text TEXT NOT NULL,                    -- what was found in the sheets, conflicts side by side
  prefill_text VARCHAR(400) NOT NULL,          -- what C2M suggests
  effect_text VARCHAR(400) NULL,
  kind VARCHAR(30) NOT NULL,                   -- rate | packing_rate | recipe | client_product | target | customer | note
  payload LONGTEXT NOT NULL,                   -- JSON applied on accept
  source_ref VARCHAR(200) NULL,                -- file, sheet, cell
  status VARCHAR(20) NOT NULL DEFAULT 'open',  -- open | accepted | corrected
  decided_by VARCHAR(64) NULL,
  decided_at DATETIME NULL,
  decision_note VARCHAR(400) NULL,
  KEY ix_imp_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

-- ---------- B. Customers and products -------------------------------------------
CREATE TABLE IF NOT EXISTS c2m_customer (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,           -- short name used in C2M, e.g. a client
  o2s_names VARCHAR(600) NOT NULL,             -- O2S names and other spellings, separated by |
  grp VARCHAR(20) NOT NULL,                    -- White label | VAN brand
  segment VARCHAR(40) NOT NULL,                -- O2S segment: White label, COBO, Dealer, Distributor, VGreen, Farmer
  price_rule VARCHAR(20) NULL,                 -- time | po | list
  price_cycle VARCHAR(40) NULL,                -- e.g. Monthly
  region VARCHAR(40) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS c2m_base_product (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS c2m_variant (
  id INT AUTO_INCREMENT PRIMARY KEY,
  base_product_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,                  -- Powder, Pellet, Foliar, ...
  UNIQUE KEY uq_variant (base_product_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS c2m_client_product (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  channel VARCHAR(20) NOT NULL,                -- White label | Distributor | Dealer | Farmer | COBO | VGreen
  brand VARCHAR(120) NOT NULL,                 -- name on the pack
  o2s_brand VARCHAR(120) NOT NULL,             -- brand as O2S writes it
  base_product_id INT NULL,
  variant_id INT NULL,
  spec VARCHAR(200) NULL,                      -- e.g. NPK 11:0:44
  form VARCHAR(10) NOT NULL DEFAULT 'solid',   -- solid | liquid
  reprocessed TINYINT(1) NOT NULL DEFAULT 0,
  sold_per VARCHAR(4) NOT NULL DEFAULT 'kg',   -- kg | L
  density DECIMAL(8,4) NULL,                   -- kg per L, for liquids
  packing_mode VARCHAR(20) NOT NULL DEFAULT 'VAN',  -- VAN | client | bulk
  target_gp DECIMAL(6,2) NULL,                 -- product default from B2B sheet; NULL = no target (never 0 by default)
  budget_gp DECIMAL(6,2) NULL,                 -- from budget V9
  budget_kg_year DECIMAL(14,2) NULL,           -- budget V9 annual kg; basis of forward exposure
  active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_cp (customer_id, channel, o2s_brand)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS c2m_client_pack (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_product_id INT NOT NULL,
  pack_size DECIMAL(10,3) NOT NULL,            -- in kg or L, as sold_per
  packing_bill_id INT NULL,                    -- NULL when client-supplied or bulk
  UNIQUE KEY uq_pack (client_product_id, pack_size)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

-- ---------- C. Raw materials and packing --------------------------------------------
CREATE TABLE IF NOT EXISTS c2m_material_type (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,            -- e.g. Potash source, Phosphate source, Filler
  nutrient_fields VARCHAR(200) NOT NULL,       -- fields asked, separated by | e.g. K%|SO4%; empty for non-nutrient types
  nutrient_role VARCHAR(14) NOT NULL DEFAULT 'nutrient' -- nutrient | none (binder, filler, anti-caking, wetting agent, colour, pH) | unclassified (ruled 16 Oct)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS c2m_raw_material (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  type_id INT NULL,
  unit VARCHAR(4) NOT NULL DEFAULT 'kg'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS c2m_material_grade (
  id INT AUTO_INCREMENT PRIMARY KEY,
  material_id INT NOT NULL,
  grade VARCHAR(60) NOT NULL DEFAULT 'Standard',
  nutrients_json TEXT NULL,                    -- {"K%": 50, "SO4%": 18}
  UNIQUE KEY uq_grade (material_id, grade)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS c2m_material_rate (
  id INT AUTO_INCREMENT PRIMARY KEY,
  grade_id INT NOT NULL,
  rate DECIMAL(12,4) NOT NULL,                 -- Rs per kg or L, latest purchase rate
  rate_date DATE NOT NULL,
  source VARCHAR(200) NOT NULL,                -- purchase document, quote, import
  warned_confirmed TINYINT(1) NOT NULL DEFAULT 0,
  entered_by VARCHAR(64) NOT NULL,
  entered_at DATETIME NOT NULL,
  KEY ix_rate (grade_id, rate_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS c2m_packing_item (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,           -- e.g. Bag 10 kg, Carton (all purpose)
  kind VARCHAR(30) NOT NULL                    -- bag, pouch, bottle, can, drum, seal, inner, label, carton, cap
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS c2m_packing_rate (
  id INT AUTO_INCREMENT PRIMARY KEY,
  packing_item_id INT NOT NULL,
  price_per_piece DECIMAL(12,4) NOT NULL,
  rate_date DATE NOT NULL,
  source VARCHAR(200) NOT NULL,
  entered_by VARCHAR(64) NOT NULL,
  entered_at DATETIME NOT NULL,
  KEY ix_prate (packing_item_id, rate_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS c2m_packing_bill (       -- reusable, e.g. "8 kg bag in a carton of 2"
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'approved', -- draft | approved (Yawar approves alone)
  approved_by VARCHAR(64) NULL,
  approved_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS c2m_packing_bill_line (
  id INT AUTO_INCREMENT PRIMARY KEY,
  packing_bill_id INT NOT NULL,
  packing_item_id INT NOT NULL,
  level VARCHAR(10) NOT NULL DEFAULT 'primary', -- primary (per pack) | secondary (per outer, e.g. carton)
  pieces DECIMAL(10,4) NOT NULL DEFAULT 1,      -- pieces per pack (primary) or per outer (secondary)
  packs_per_outer DECIMAL(10,3) NULL,           -- secondary only: e.g. 2 bags per carton
  KEY ix_pbl (packing_bill_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

-- ---------- D. Recipes ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS c2m_recipe_version (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_product_id INT NOT NULL,
  version_no INT NOT NULL,
  state VARCHAR(20) NOT NULL DEFAULT 'draft',  -- draft | review | endorse | cost | approved | old
  note VARCHAR(400) NULL,                      -- e.g. one-time change: TSP replaced by DAP
  sent_back_by VARCHAR(64) NULL,               -- who sent it back (resend returns to them)
  sent_back_state VARCHAR(20) NULL,
  sent_back_reason VARCHAR(400) NULL,
  sent_back_advice VARCHAR(400) NULL,
  created_by VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL,
  UNIQUE KEY uq_rv (client_product_id, version_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS c2m_recipe_line (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recipe_version_id INT NOT NULL,
  grade_id INT NOT NULL,
  qty DECIMAL(14,8) NOT NULL,                  -- kg (or L) of input per 1 kg (or L) of product, loss included
  KEY ix_rl (recipe_version_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS c2m_recipe_step (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recipe_version_id INT NOT NULL,
  action VARCHAR(30) NOT NULL,                 -- imported, written, sent, reviewed, endorsed, cost_approved, sent_back, resent
  by_user VARCHAR(64) NOT NULL,
  at DATETIME NOT NULL,
  note VARCHAR(400) NULL,
  KEY ix_rs (recipe_version_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

-- ---------- E. Cost -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS c2m_conversion_rule (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  kind VARCHAR(10) NOT NULL DEFAULT 'foh',     -- labour | foh: 1 of each is picked per product and added (ruled 16 Oct)
  is_base TINYINT(1) NOT NULL DEFAULT 0,       -- 1 = a base band; any rate Yawar adds beats the bands (ruled 16 Oct, 5j 10)
  rs_per_kg DECIMAL(10,4) NOT NULL,
  scope_client_product_id INT NULL,            -- most specific (a list of products lives in c2m_conversion_rule_product)
  scope_base_product_id INT NULL,
  scope_form VARCHAR(10) NULL,                 -- solid | liquid
  scope_reprocessed TINYINT(1) NULL,
  scope_pack_min DECIMAL(10,3) NULL,           -- pack size range, in kg or L
  scope_pack_max DECIMAL(10,3) NULL,
  valid_from DATE NOT NULL,
  source VARCHAR(200) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS c2m_conversion_rule_product (  -- a rate assigned to a list of client products
  rule_id INT NOT NULL,
  client_product_id INT NOT NULL,
  PRIMARY KEY (rule_id, client_product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS c2m_list_revision (      -- VAN brand list price revision: Yawar proposes, Tahir approves (ruled 16 Oct)
  id INT AUTO_INCREMENT PRIMARY KEY,
  list_name VARCHAR(40) NOT NULL,              -- dist | dealer | farmer
  items_json LONGTEXT NOT NULL,                -- [{id, product, pack, from:{...}, to:{...}}]
  reason VARCHAR(400) NOT NULL,
  valid_from DATE NOT NULL,
  valid_till DATE NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'proposed', -- proposed | approved | sent_back | replaced
  proposed_by VARCHAR(64) NOT NULL,
  proposed_at DATETIME NOT NULL,
  decided_by VARCHAR(64) NULL,
  decided_at DATETIME NULL,
  back_reason VARCHAR(400) NULL,
  applied TINYINT(1) NOT NULL DEFAULT 0,       -- 1 once the prices are in the list; an approval dated ahead waits for its date (5j 6)
  KEY ix_lrev (list_name, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS c2m_freight_rate (
  id INT AUTO_INCREMENT PRIMARY KEY,
  segment VARCHAR(40) NOT NULL,
  region VARCHAR(40) NOT NULL,
  rs_per_kg DECIMAL(10,4) NOT NULL,
  valid_from DATE NOT NULL,
  UNIQUE KEY uq_fr (segment, region, valid_from)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS c2m_cost_version (     -- dated approved cost per client pack
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_pack_id INT NOT NULL,
  valid_from DATETIME NOT NULL,
  materials DECIMAL(12,4) NOT NULL,
  packing DECIMAL(12,4) NOT NULL,
  conversion DECIMAL(12,4) NOT NULL,
  freight DECIMAL(12,4) NOT NULL,
  total DECIMAL(12,4) NOT NULL,
  recipe_version_id INT NULL,
  cause VARCHAR(300) NOT NULL,                 -- import, recipe approved, re-approval after a rate change
  approved_by VARCHAR(64) NOT NULL,
  KEY ix_cv (client_pack_id, valid_from)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS c2m_reapproval (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cause VARCHAR(300) NOT NULL,
  items_json LONGTEXT NOT NULL,                -- [{client_pack_id, label, from, to, pct}]
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  created_at DATETIME NOT NULL,
  decided_by VARCHAR(64) NULL,
  decided_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS c2m_monthly_actual (
  month CHAR(7) PRIMARY KEY,                   -- YYYY-MM
  actual_labour DECIMAL(16,2) NULL,
  actual_foh DECIMAL(16,2) NULL,
  kg_produced DECIMAL(16,3) NULL,              -- from O2S batches when linked
  absorbed DECIMAL(16,2) NULL,
  entered_by VARCHAR(64) NULL,
  entered_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS c2m_monthly_check (
  id INT AUTO_INCREMENT PRIMARY KEY,
  month CHAR(7) NOT NULL,
  kind VARCHAR(20) NOT NULL,                   -- rate_check | tie_books
  data_json LONGTEXT NULL,                     -- tie_books: ERP sales and COGS by customer
  done_by VARCHAR(64) NOT NULL,
  done_at DATETIME NOT NULL,
  UNIQUE KEY uq_mc (month, kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

-- ---------- F. Prices and targets ----------------------------------------------------
CREATE TABLE IF NOT EXISTS c2m_price (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_pack_id INT NOT NULL,
  price DECIMAL(12,4) NOT NULL,                -- Rs per kg or L, net of FED and sales tax
  prev_price DECIMAL(12,4) NULL,
  valid_from DATE NOT NULL,
  valid_to DATE NULL,
  reason VARCHAR(400) NULL,                    -- reason for change, printed on client lists
  below_target_reason VARCHAR(400) NULL,       -- required when GP below target
  status VARCHAR(20) NOT NULL DEFAULT 'proposed', -- proposed | approved | sent_back | replaced
  proposed_by VARCHAR(64) NOT NULL,
  proposed_at DATETIME NOT NULL,
  decided_by VARCHAR(64) NULL,
  decided_at DATETIME NULL,
  back_reason VARCHAR(400) NULL,
  cut_price_id INT NULL,                       -- the price this approval shortened (its valid_to was moved)
  cut_prev_to DATE NULL,                       -- that price's valid_to before, restored on withdraw or cancel
  KEY ix_price (client_pack_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS c2m_list_price (        -- VAN brand list prices (distributor, dealer, farmer)
  id INT AUTO_INCREMENT PRIMARY KEY,
  list_name VARCHAR(40) NOT NULL,              -- dist | dealer | farmer
  product VARCHAR(160) NOT NULL,
  spec VARCHAR(200) NULL,
  pack VARCHAR(40) NULL,
  data_json TEXT NOT NULL,                     -- all price columns of that list
  issued DATE NOT NULL,
  valid_till DATE NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS c2m_price_doc (          -- every price list document created
  id INT AUTO_INCREMENT PRIMARY KEY,
  ref VARCHAR(60) NOT NULL,
  audience VARCHAR(30) NOT NULL,
  addressee VARCHAR(160) NOT NULL,
  fields_json LONGTEXT NOT NULL,                -- fields picked, reasons, and a snapshot of the rows as issued
  effective DATE NOT NULL,
  valid_till DATE NULL,
  created_by VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS c2m_target_request (     -- client target GP override, approved by Tahir
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_product_id INT NOT NULL,
  from_gp DECIMAL(6,2) NULL,
  to_gp DECIMAL(6,2) NOT NULL,
  reason VARCHAR(400) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  by_user VARCHAR(64) NOT NULL,
  at DATETIME NOT NULL,
  decided_by VARCHAR(64) NULL,
  decided_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

-- ---------- G. Settings, access, notices ---------------------------------------------
CREATE TABLE IF NOT EXISTS c2m_setting (
  k VARCHAR(40) PRIMARY KEY,
  v VARCHAR(100) NOT NULL,
  label VARCHAR(160) NOT NULL,
  needs_approval TINYINT(1) NOT NULL DEFAULT 1,
  updated_by VARCHAR(64) NULL,
  updated_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS c2m_setting_request (
  id INT AUTO_INCREMENT PRIMARY KEY,
  changes_json TEXT NOT NULL,                  -- {"rate_warn_pct": "12"}
  summary VARCHAR(400) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  by_user VARCHAR(64) NOT NULL,
  at DATETIME NOT NULL,
  decided_by VARCHAR(64) NULL,
  decided_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS c2m_list_grant (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL,
  grant_kind VARCHAR(20) NOT NULL,             -- list | client
  grant_value VARCHAR(100) NOT NULL,           -- e.g. dist, farmer_pb, or a customer name
  granted_by VARCHAR(64) NOT NULL,
  granted_at DATETIME NOT NULL,
  UNIQUE KEY uq_grant (username, grant_kind, grant_value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS c2m_notice (
  id INT AUTO_INCREMENT PRIMARY KEY,
  for_role VARCHAR(20) NOT NULL,               -- coo | cfo
  text VARCHAR(400) NOT NULL,
  by_user VARCHAR(64) NOT NULL,
  at DATETIME NOT NULL,
  seen TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

-- ---------- H. Record --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS c2m_audit (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  at DATETIME NOT NULL,
  by_user VARCHAR(64) NOT NULL,
  entity VARCHAR(40) NOT NULL,
  entity_id VARCHAR(60) NULL,
  action VARCHAR(40) NOT NULL,
  old_value TEXT NULL,
  new_value TEXT NULL,
  why VARCHAR(400) NULL,
  KEY ix_audit (entity, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

-- ---------- Defaults (settings ruled by Tahir) ----------------------------------------
INSERT IGNORE INTO c2m_setting (k, v, label, needs_approval) VALUES
 ('rate_warn_pct', '10', 'Rate warning, rise or drop, %', 1),
 ('reapprove_pct', '3', 'Cost re-approval, %', 1),
 ('red_share_pct', '1', 'Red flag needs Rs gap above this % of all white label sales in the period', 1),
 ('red_gap_pts', '2', 'Red flag needs gap to target above, % points', 1),
 ('budget_gp', '0', 'Company budget GP, % (set at first load)', 0),
 ('ambition_gp', '0', 'Company ambition GP, % (set at first load)', 0),
 ('wl_budget_gp', '0', 'White label budget GP, % (set at first load)', 0),
 ('forward_months', '3', 'Forward exposure horizon, months', 1),
 ('conv_budget_month', '0', 'Budget labour + FOH a month, Rs (set at first load; compared with monthly actuals)', 0);

INSERT IGNORE INTO c2m_source (system_name, what, schedule, read_only, status) VALUES
 ('Platform', 'Sign-in, people, C2M role', 'Every request', 1, 'Ready'),
 ('O2S', 'Customers, products, PO lines and trucks out (app_state, read only)', 'On request (Pull now)', 1, 'Not yet run'),
 ('O2S', 'Batches: kg produced per month', 'Monthly', 1, 'Not yet set'),
 ('Yawar files', 'Rates, recipes, costs, prices, targets, budget', 'Once, through the import queue', 1, 'Not yet run');
