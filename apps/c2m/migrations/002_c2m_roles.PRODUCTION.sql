-- PRODUCTION variant of 002_c2m_roles.sql for HostGator phpMyAdmin (SQL tab). Same content; keep both in step.
-- Run once, by hand. Creates only c2m_role.
USE jodilkah_vanop_db;

-- =============================================================================
-- C2M migration 002: roles table (Tahir, 21 Oct 2026, D-89 and D-90).
-- Creates only c2m_role. Changes no O2S, PD or platform table. Safe to run twice.
-- Loads the 6 roles C2M started with; the COO role is the administrator (every action, locked on).
-- Running it again keeps edited roles as they are, but puts back a starting role that was deleted.
-- Until this is run C2M keeps working on the same 6 roles built into the code.
-- Documentation: apps/c2m/docs/04-database-schema.md, docs/11-access-and-roles.md
-- =============================================================================
CREATE TABLE IF NOT EXISTS c2m_role (
  role_key VARCHAR(30) NOT NULL PRIMARY KEY,   -- the value kept in user_module_roles.role
  label VARCHAR(60) NOT NULL,
  is_admin TINYINT(1) NOT NULL DEFAULT 0,      -- the administrator role: every action, cannot be edited or deleted
  actions_json TEXT NOT NULL,                  -- JSON array of action keys; empty for the administrator
  builtin TINYINT(1) NOT NULL DEFAULT 0,
  updated_by VARCHAR(60) NULL,
  updated_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO c2m_role (role_key, label, is_admin, actions_json, builtin) VALUES
  ('cfo', 'CFO', 0, '["price.propose","list.revise","pricedoc.all","recipe.start","recipe.step.cost","reapproval.decide","rate.save","material.save","nutrient.edit","packing.manage","labour.manage","product.classify","settings.edit","targets.propose","customer.edit","freight.edit","grants.give","lists.link","lists.mark","lists.carry","lists.remove","o2s.sync","import.decide","actuals.enter","actuals.tiebooks","notices.see","see.products","see.cost","see.price","see.margin","see.settings","see.materials","guide.all"]', 1),
  ('coo', 'COO', 1, '[]', 1),
  ('production', 'Production Manager', 0, '["recipe.start","recipe.edit","recipe.step.draft","see.products","see.cost"]', 1),
  ('qc', 'QC Head', 0, '["nutrient.edit","recipe.step.review","see.products","see.materials"]', 1),
  ('plant', 'Plant Manager', 0, '["recipe.step.endorse","see.products","see.cost"]', 1),
  ('viewer', 'Price list viewer', 0, '["pricedoc.granted","see.granted_lists"]', 1);
