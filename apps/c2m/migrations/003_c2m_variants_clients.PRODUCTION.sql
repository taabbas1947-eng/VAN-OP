-- PRODUCTION variant of 003_c2m_variants_clients.sql for HostGator phpMyAdmin (SQL tab). Same content; keep both in step.
-- Run once, by hand. Creates only c2m_ tables.
USE jodilkah_vanop_db;

-- =============================================================================
-- C2M migration 003: add client, product families and variants (Tahir, 21 Oct 2026, D-94, D-95, D-98).
-- Creates 5 new c2m_ tables and nothing else. It changes no existing table and no O2S, PD or platform table.
-- Safe to run twice (CREATE TABLE IF NOT EXISTS; the 2 role updates only add an action that is not there yet).
--   c2m_product_family  a VAN product that can have variants (Humi Grow, Fusion Potash)
--   c2m_product_variant a variant of a family (Powder, Pellets, Granular)
--   c2m_product_ext     per client product: its family, its variant, and the VAN product whose approved recipe it follows
--   c2m_pack_ext        per client pack: the one client it is made for (a special pack), if any
--   c2m_rule_variant    per conversion rate: the one variant it applies to, if any
-- Until this is run C2M keeps working exactly as before: the screens for variants and for adding a client show a plain notice.
-- Documentation: apps/c2m/docs/04-database-schema.md, docs/06-decisions.md (D-98), docs/09-rules-and-formulas.md
-- =============================================================================
CREATE TABLE IF NOT EXISTS c2m_product_family (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  created_by VARCHAR(60) NULL,
  created_at DATETIME NULL,
  UNIQUE KEY uq_family (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS c2m_product_variant (
  id INT AUTO_INCREMENT PRIMARY KEY,
  family_id INT NOT NULL,
  name VARCHAR(80) NOT NULL,
  created_by VARCHAR(60) NULL,
  created_at DATETIME NULL,
  UNIQUE KEY uq_variant (family_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS c2m_product_ext (
  client_product_id INT NOT NULL PRIMARY KEY,
  family_id INT NULL,
  pvariant_id INT NULL,
  follows_product_id INT NULL                  -- the VAN product whose approved recipe this product uses (material cost only)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS c2m_pack_ext (
  client_pack_id INT NOT NULL PRIMARY KEY,
  client_only_id INT NOT NULL                   -- c2m_customer.id: a pack made for this client only
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS c2m_rule_variant (
  rule_id INT NOT NULL PRIMARY KEY,
  pvariant_id INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- The 2 new actions for the starting roles (the COO holds every action already). A role you have edited keeps your edit
-- if it no longer holds the action this one is put next to; then tick the new action in Roles.
--   client.add: add a client, a product and a pack (CFO)      variant.add: add a variant or tag a product's variant (CFO, Production)
UPDATE c2m_role SET actions_json = REPLACE(actions_json, '"customer.edit"', '"customer.edit","client.add"')
  WHERE role_key = 'cfo' AND actions_json LIKE '%"customer.edit"%' AND actions_json NOT LIKE '%"client.add"%';
UPDATE c2m_role SET actions_json = REPLACE(actions_json, '"customer.edit"', '"customer.edit","variant.add"')
  WHERE role_key = 'cfo' AND actions_json LIKE '%"customer.edit"%' AND actions_json NOT LIKE '%"variant.add"%';
UPDATE c2m_role SET actions_json = REPLACE(actions_json, '"recipe.start"', '"recipe.start","variant.add"')
  WHERE role_key = 'production' AND actions_json LIKE '%"recipe.start"%' AND actions_json NOT LIKE '%"variant.add"%';
