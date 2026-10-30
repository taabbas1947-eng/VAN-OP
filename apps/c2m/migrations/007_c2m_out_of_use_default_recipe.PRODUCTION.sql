-- PRODUCTION variant of 007_c2m_out_of_use_default_recipe.sql for HostGator phpMyAdmin (SQL tab). Same content; keep both in step.
-- Run once, by hand. Creates only c2m_ tables.
USE jodilkah_vanop_db;

-- =============================================================================
-- C2M migration 007: out of use for list items, and the default recipe (Tahir's rulings on Yawar's feedback, 30 Oct 2026, D-139, D-140).
-- Creates 3 new c2m_ tables and nothing else. It changes no existing table and no O2S, C2L or platform table.
-- Safe to run twice (CREATE TABLE IF NOT EXISTS).
--   c2m_out_of_use      an item taken out of use: a material grade, a packing item, a packing bill or a client.
--                       Hidden from forms and pickers, kept for past costs, can be put back. No row = in use.
--   c2m_recipe_name     the name of a recipe version (e.g. "DAP in place of TSP"). No row = the product's main recipe ("Main").
--   c2m_recipe_default  per product, the name of the recipe that sets cost, price for target and margin. No row = "Main".
-- Until this is run C2M keeps working exactly as before: every product keeps its 1 approved recipe, Delete still removes an
-- entry nothing uses, and Take out of use, a second recipe and Make default say that migration 007 is needed.
-- Documentation: apps/c2m/docs/04-database-schema.md, docs/06-decisions.md (D-139, D-140)
-- =============================================================================
CREATE TABLE IF NOT EXISTS c2m_out_of_use (
  entity VARCHAR(30) NOT NULL,                 -- material_grade, packing_item, packing_bill, customer
  entity_id INT NOT NULL,
  by_user VARCHAR(64) NOT NULL,
  at DATETIME NOT NULL,
  why VARCHAR(400) NULL,
  PRIMARY KEY (entity, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS c2m_recipe_name (
  recipe_version_id INT NOT NULL PRIMARY KEY,  -- c2m_recipe_version.id
  recipe_name VARCHAR(80) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS c2m_recipe_default (
  client_product_id INT NOT NULL PRIMARY KEY,  -- c2m_client_product.id
  recipe_name VARCHAR(80) NOT NULL,
  set_by VARCHAR(64) NOT NULL,
  set_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
