-- VAN Operations Platform — PD (Product Development) foundation migration
-- Adds the R&D pipeline domain to the SAME database O2S already uses.
-- Additive only, same convention as the standalone PD app's own upgrade_vNN.sql files.
-- Run ONCE against the database your DATABASE_URL points at.

SET NAMES utf8mb4;

-- 1. Give auth_users what the PD tables need: a stable integer id to key
--    foreign keys on (auth_users.username is fine as a primary key for O2S's
--    own use, but the ported PD schema — proven across 182 test assertions —
--    references users by integer id throughout; adding one is far lower risk
--    than rewriting every foreign key to varchar).
-- Split into separate statements (rather than one multi-clause ALTER) so the
-- migration runner can retry this file safely — each statement is skipped
-- individually if that column already exists (MySQL error 1060).
ALTER TABLE auth_users ADD COLUMN id INT AUTO_INCREMENT UNIQUE FIRST;
ALTER TABLE auth_users ADD COLUMN pd_role ENUM('coo','ceo','qc_head','rta','production','agronomy','custodian','member','lab_tech','consultant') NULL;
ALTER TABLE auth_users ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE auth_users ADD COLUMN must_change_pw TINYINT(1) NOT NULL DEFAULT 0;
-- pd_role stays NULL for everyone until you assign it — nobody gets PD access
-- by accident. must_change_pw defaults to 0 (off) since O2S doesn't enforce
-- this today; set it per-user if you want the PD app's forced-reset behaviour.

-- 2. The PD schema itself — ported near-verbatim from van-rd-app/schema.sql,
--    with FOREIGN KEY ... REFERENCES users(id) changed to auth_users(id).

CREATE TABLE IF NOT EXISTS pd_problems (
  id INT AUTO_INCREMENT PRIMARY KEY,
  p_number INT NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  statement TEXT NOT NULL,
  context TEXT,
  source ENUM('team','farmer','dealer','regulator','consultant','management','other') NOT NULL DEFAULT 'team',
  status ENUM('open','being_addressed','solved','retired') NOT NULL DEFAULT 'open',
  added_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (added_by) REFERENCES auth_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  problem_id INT NULL,
  status ENUM('active','parked','launched','closed') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (problem_id) REFERENCES pd_problems(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_product_gates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  gate CHAR(1) NOT NULL,
  status ENUM('open','pass','fail') NOT NULL DEFAULT 'open',
  note TEXT,
  decided_by INT NULL,
  decided_at TIMESTAMP NULL,
  UNIQUE KEY uq_prod_gate (product_id, gate),
  FOREIGN KEY (product_id) REFERENCES pd_products(id),
  FOREIGN KEY (decided_by) REFERENCES auth_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  proj_number INT NOT NULL UNIQUE,
  code VARCHAR(40) NOT NULL,
  title VARCHAR(200) NOT NULL,
  problem_id INT NULL,
  product_id INT NULL,
  brief_why TEXT, brief_how TEXT, brief_routes TEXT, brief_target TEXT,
  status ENUM('open','parked','closed') NOT NULL DEFAULT 'open',
  owner_id INT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (problem_id) REFERENCES pd_problems(id),
  FOREIGN KEY (product_id) REFERENCES pd_products(id),
  FOREIGN KEY (owner_id) REFERENCES auth_users(id),
  FOREIGN KEY (created_by) REFERENCES auth_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_hypotheses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  h_number INT NOT NULL UNIQUE,
  product_id INT NULL,
  title VARCHAR(200) NOT NULL,
  change_type ENUM('new','reformulation','variant','process','challenge') NOT NULL DEFAULT 'new',
  lane ENUM('light','heavy') NOT NULL DEFAULT 'heavy',
  parent_product_id INT NULL,
  problem_id INT NULL,
  project_id INT NULL,
  idea_text TEXT NOT NULL,
  problem_text TEXT,
  reasoning_text TEXT,
  materials_text TEXT,
  success_text TEXT,
  crop_area VARCHAR(120),
  support_text TEXT,
  risk_text TEXT,
  route VARCHAR(60),
  lever VARCHAR(60),
  submitted_by INT NOT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  stage ENUM('proposed','screened','designed','sampled','tested','evaluated','field_trial','validated','parked','killed') NOT NULL DEFAULT 'proposed',
  priority ENUM('','high','medium','low') NOT NULL DEFAULT '',
  screen_decision ENUM('','log','park','kill','merge') NOT NULL DEFAULT '',
  screen_reason TEXT,
  screen_manuf_note TEXT,
  screen_chem_note TEXT,
  screened_by INT NULL,
  screened_at TIMESTAMP NULL,
  park_condition VARCHAR(255),
  owner_id INT NULL,
  next_action VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (submitted_by) REFERENCES auth_users(id),
  FOREIGN KEY (product_id) REFERENCES pd_products(id),
  FOREIGN KEY (problem_id) REFERENCES pd_problems(id),
  FOREIGN KEY (project_id) REFERENCES pd_projects(id),
  FULLTEXT ft_idea (title, idea_text, problem_text, materials_text)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_dev_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hypothesis_id INT NOT NULL,
  record_no VARCHAR(30) NOT NULL UNIQUE,
  target_analysis VARCHAR(60),
  platform_concept VARCHAR(120),
  batch_size VARCHAR(60),
  s1_soil_problem TEXT, s1_crop_region TEXT, s1_farmer_reason TEXT, s1_claims_tags TEXT,
  s2_reactions TEXT, s2_mass_balance TEXT, s2_water_balance TEXT, s2_ingredient_roles TEXT, s2_predicted_split TEXT,
  s3_hypothesis_one_line TEXT, s3_success_kill_criteria TEXT, s3_assays_methods TEXT, s3_release_protocol TEXT,
  review_rta_by INT NULL, review_rta_at TIMESTAMP NULL, review_rta_note TEXT,
  review_complete_by INT NULL, review_complete_at TIMESTAMP NULL,
  approved_g2_by INT NULL, approved_g2_at TIMESTAMP NULL,
  approved_g2_delegated TINYINT(1) NOT NULL DEFAULT 0,
  ratified_by INT NULL, ratified_at TIMESTAMP NULL,
  s4_actual_charges TEXT, s4_observations TEXT, s4_deviations TEXT, s4_recovery TEXT,
  s5_measured_vs_predicted TEXT, s5_result_vs_criteria ENUM('','pass','fail','ambiguous') DEFAULT '',
  s5_discussion TEXT, s5_decision ENUM('','advance','iterate','stop') DEFAULT '', s5_next_experiment TEXT,
  status ENUM('draft','reviewed','approved','bench_done','closed') NOT NULL DEFAULT 'draft',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (hypothesis_id) REFERENCES pd_hypotheses(id),
  FOREIGN KEY (created_by) REFERENCES auth_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_samples (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sample_no INT NOT NULL UNIQUE,
  hypothesis_id INT NOT NULL,
  dev_record_id INT NULL,
  made_on DATE,
  recipe_short VARCHAR(200),
  target_analysis VARCHAR(60),
  batch_size VARCHAR(60),
  made_by VARCHAR(100),
  materials TEXT,
  retain_location VARCHAR(150),
  observation TEXT,
  status ENUM('made','testing','tested','discarded') NOT NULL DEFAULT 'made',
  notes TEXT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hypothesis_id) REFERENCES pd_hypotheses(id),
  FOREIGN KEY (dev_record_id) REFERENCES pd_dev_records(id),
  FOREIGN KEY (created_by) REFERENCES auth_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_lab_tests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  test_no INT NOT NULL UNIQUE,
  sample_id INT NOT NULL,
  tested_on DATE,
  test_type VARCHAR(80) NOT NULL,
  stability_day INT NULL,
  method VARCHAR(120),
  result VARCHAR(120),
  units VARCHAR(40),
  pass_fail ENUM('','pass','fail','na') DEFAULT '',
  tested_by VARCHAR(100),
  notes TEXT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sample_id) REFERENCES pd_samples(id),
  FOREIGN KEY (created_by) REFERENCES auth_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_field_trials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trial_code VARCHAR(20) NOT NULL UNIQUE,
  hypothesis_id INT NOT NULL,
  season VARCHAR(40),
  crop VARCHAR(60),
  location VARCHAR(150),
  soil_info VARCHAR(200),
  objective TEXT,
  success_kill TEXT,
  treatments TEXT,
  design_layout VARCHAR(200),
  measurements TEXT,
  sown DATE NULL, harvest DATE NULL,
  status ENUM('designed','approved','running','harvested','analysed','closed') NOT NULL DEFAULT 'designed',
  result_summary TEXT,
  decision ENUM('','advance','repeat','stop') DEFAULT '',
  designed_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hypothesis_id) REFERENCES pd_hypotheses(id),
  FOREIGN KEY (designed_by) REFERENCES auth_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_field_obs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trial_id INT NOT NULL,
  obs_date DATE NOT NULL,
  obs_text TEXT NOT NULL,
  photo VARCHAR(160) NULL,
  added_by INT NOT NULL,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trial_id) REFERENCES pd_field_trials(id),
  FOREIGN KEY (added_by) REFERENCES auth_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_gate_decisions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hypothesis_id INT NOT NULL,
  gate ENUM('G1','G2','G3','G4','G5','G6') NOT NULL,
  decision ENUM('advance','iterate','park','kill','reverse') NOT NULL,
  reason TEXT NOT NULL,
  decided_by INT NOT NULL,
  is_site_quorum TINYINT(1) NOT NULL DEFAULT 0,
  attendees VARCHAR(255),
  provisional TINYINT(1) NOT NULL DEFAULT 0,
  ratified_by INT NULL, ratified_at TIMESTAMP NULL,
  decided_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hypothesis_id) REFERENCES pd_hypotheses(id),
  FOREIGN KEY (decided_by) REFERENCES auth_users(id),
  FOREIGN KEY (ratified_by) REFERENCES auth_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_materials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  n_pct DECIMAL(6,3) NOT NULL DEFAULT 0,
  p2o5_pct DECIMAL(6,3) NOT NULL DEFAULT 0,
  k2o_pct DECIMAL(6,3) NOT NULL DEFAULT 0,
  s_pct DECIMAL(6,3) NOT NULL DEFAULT 0,
  zn_pct DECIMAL(6,3) NOT NULL DEFAULT 0,
  cost_per_tonne DECIMAL(12,2) NOT NULL DEFAULT 0,
  assay_basis ENUM('placeholder','standard_grade','supplier_spec','van_assay') NOT NULL DEFAULT 'placeholder',
  cost_basis ENUM('placeholder','quote','invoice') NOT NULL DEFAULT 'placeholder',
  cost_updated DATE NULL,
  spec_note VARCHAR(255),
  active TINYINT(1) NOT NULL DEFAULT 1,
  updated_by INT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES auth_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_material_conflicts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  material_a_id INT NOT NULL,
  material_b_id INT NOT NULL,
  severity ENUM('avoid','caution') NOT NULL DEFAULT 'caution',
  reason VARCHAR(255) NOT NULL,
  confirmed_by INT NULL,
  confirmed_at TIMESTAMP NULL,
  added_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pair (material_a_id, material_b_id),
  FOREIGN KEY (material_a_id) REFERENCES pd_materials(id),
  FOREIGN KEY (material_b_id) REFERENCES pd_materials(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_route_screens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hypothesis_id INT NOT NULL UNIQUE,
  target_p2o5_min DECIMAL(6,3) NOT NULL DEFAULT 0,
  target_p2o5_max DECIMAL(6,3) NOT NULL DEFAULT 100,
  target_n_min DECIMAL(6,3) NOT NULL DEFAULT 0,
  target_n_max DECIMAL(6,3) NOT NULL DEFAULT 100,
  target_s_min DECIMAL(6,3) NOT NULL DEFAULT 0,
  target_zn_min DECIMAL(6,3) NOT NULL DEFAULT 0,
  cost_ceiling_per_tonne DECIMAL(12,2) NOT NULL DEFAULT 0,
  ceiling_basis VARCHAR(255),
  conversion_cost_per_tonne DECIMAL(12,2) NOT NULL DEFAULT 0,
  process_loss_pct DECIMAL(6,3) NOT NULL DEFAULT 0,
  set_by INT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (hypothesis_id) REFERENCES pd_hypotheses(id),
  FOREIGN KEY (set_by) REFERENCES auth_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_candidates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hypothesis_id INT NOT NULL,
  cand_no INT NOT NULL,
  label VARCHAR(100) NOT NULL,
  micro_hypothesis VARCHAR(255) NOT NULL,
  calc_inclusion_total DECIMAL(8,3) NOT NULL DEFAULT 0,
  calc_n DECIMAL(8,3) NOT NULL DEFAULT 0,
  calc_p2o5 DECIMAL(8,3) NOT NULL DEFAULT 0,
  calc_s DECIMAL(8,3) NOT NULL DEFAULT 0,
  calc_zn DECIMAL(8,3) NOT NULL DEFAULT 0,
  calc_rm_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  calc_exworks_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  calc_cost_per_kg_p DECIMAL(12,2) NULL DEFAULT NULL,
  provisional_pricing TINYINT(1) NOT NULL DEFAULT 1,
  verdict ENUM('','pass','borderline','fail') NOT NULL DEFAULT '',
  verdict_reasons TEXT,
  status ENUM('screened','selected','rejected','made') NOT NULL DEFAULT 'screened',
  sample_id INT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  decided_by INT NULL,
  decided_at TIMESTAMP NULL,
  decision_reason VARCHAR(255),
  UNIQUE KEY uq_route_cand (hypothesis_id, cand_no),
  FOREIGN KEY (hypothesis_id) REFERENCES pd_hypotheses(id),
  FOREIGN KEY (sample_id) REFERENCES pd_samples(id),
  FOREIGN KEY (created_by) REFERENCES auth_users(id),
  FOREIGN KEY (decided_by) REFERENCES auth_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- FIX A6: existing installs — the column was NOT NULL DEFAULT 0, which made a phosphorus-free
-- candidate score as the cheapest thing on the route. Safe to re-run.
ALTER TABLE pd_candidates MODIFY COLUMN calc_cost_per_kg_p DECIMAL(12,2) NULL DEFAULT NULL;

CREATE TABLE IF NOT EXISTS pd_candidate_lines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id INT NOT NULL,
  material_id INT NOT NULL,
  inclusion_pct DECIMAL(7,3) NOT NULL,
  FOREIGN KEY (candidate_id) REFERENCES pd_candidates(id),
  FOREIGN KEY (material_id) REFERENCES pd_materials(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_library_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_no INT NOT NULL UNIQUE,
  kind ENUM('note','link','document') NOT NULL DEFAULT 'note',
  title VARCHAR(200) NOT NULL,
  why TEXT NOT NULL,
  body MEDIUMTEXT,
  url VARCHAR(500),
  file_stored VARCHAR(120),
  file_name VARCHAR(200),
  file_size INT,
  file_ext VARCHAR(10),
  evidence ENUM('verified','validate','open') NOT NULL DEFAULT 'open',
  source VARCHAR(255),
  tag VARCHAR(60),
  archived TINYINT(1) NOT NULL DEFAULT 0,
  archived_reason VARCHAR(255),
  added_by INT NOT NULL,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FULLTEXT ft_lib (title, why, body, source, tag),
  FOREIGN KEY (added_by) REFERENCES auth_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_library_pins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_id INT NOT NULL,
  target_type ENUM('hypothesis','project','problem') NOT NULL,
  target_id INT NOT NULL,
  pinned_by INT NOT NULL,
  pinned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pin (item_id, target_type, target_id),
  FOREIGN KEY (item_id) REFERENCES pd_library_items(id),
  FOREIGN KEY (pinned_by) REFERENCES auth_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  target_type ENUM('library','hypothesis') NOT NULL,
  target_id INT NOT NULL,
  body TEXT NOT NULL,
  added_by INT NOT NULL,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY k_target (target_type, target_id),
  FOREIGN KEY (added_by) REFERENCES auth_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(80) NOT NULL,
  detail VARCHAR(500),
  at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES auth_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_dropbox (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  contact VARCHAR(120) NULL,
  source ENUM('team','farmer','dealer','regulator','consultant','management','other') NOT NULL DEFAULT 'team',
  text TEXT NOT NULL,
  ip VARCHAR(45) NULL,
  status ENUM('new','converted','dismissed') NOT NULL DEFAULT 'new',
  converted_hypothesis_id INT NULL,
  handled_by INT NULL,
  handled_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (converted_hypothesis_id) REFERENCES pd_hypotheses(id),
  FOREIGN KEY (handled_by) REFERENCES auth_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_formulations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  version INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  parent_formulation_id INT NULL,
  hypothesis_id INT NULL,
  dev_record_id INT NULL,
  composition TEXT,
  change_reason TEXT,
  status ENUM('candidate','current','superseded','retired') NOT NULL DEFAULT 'candidate',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_prod_ver (product_id, version),
  FOREIGN KEY (product_id) REFERENCES pd_products(id),
  FOREIGN KEY (hypothesis_id) REFERENCES pd_hypotheses(id),
  FOREIGN KEY (dev_record_id) REFERENCES pd_dev_records(id),
  FOREIGN KEY (created_by) REFERENCES auth_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_learnings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fact TEXT NOT NULL,
  evidence ENUM('verified','validate','open') NOT NULL DEFAULT 'validate',
  tag VARCHAR(60),
  source VARCHAR(120),
  hypothesis_id INT NULL,
  added_by INT NOT NULL,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FULLTEXT ft_fact (fact, tag),
  FOREIGN KEY (hypothesis_id) REFERENCES pd_hypotheses(id),
  FOREIGN KEY (added_by) REFERENCES auth_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pd_regulatory (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  province VARCHAR(60) NOT NULL,
  authority VARCHAR(120),
  status ENUM('not_started','dossier_prep','submitted','queries','registered','renewal_due') NOT NULL DEFAULT 'not_started',
  ref_no VARCHAR(80),
  submitted_on DATE NULL,
  registered_on DATE NULL,
  renewal_due DATE NULL,
  notes TEXT,
  updated_by INT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES pd_products(id),
  FOREIGN KEY (updated_by) REFERENCES auth_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
