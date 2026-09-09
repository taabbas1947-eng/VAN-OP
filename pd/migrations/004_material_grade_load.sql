-- ============================================================================
-- 004_material_grade_load.sql — PD material register: the real grade list
--
-- WRITTEN 9 Sept 2026. Source, and the only source: Tahir's returned
-- worksheet docs/pd-model/combination-bank/PD-Material-Grade-Template-
-- RETURNED-9Sep2026.xlsx. Nothing below was inferred, completed, corrected or
-- looked up. A blank cell on that sheet is loaded as NULL — never as 0 and
-- never as a textbook value — because combination-bank/RULES.md §4.3 makes
-- the analysis a computed number: a fabricated assay would silently become a
-- fabricated N-P-K on every combination that used the grade.
--
-- RUN BY HAND, BY TAHIR, ONLY. Same rule as 002 (MODELING-GROUND-RULES.md).
-- Safe to re-run: every INSERT is INSERT IGNORE, keyed on the unique `code`.
-- Requires 001 and 002 to have been applied first (they have been, in prod).
--
-- ---------------------------------------------------------------------------
-- SECTION 1 — three schema corrections this data forced
-- ---------------------------------------------------------------------------
-- 1a. n_pct / p2o5_pct / k2o_pct / s_pct / zn_pct were NOT NULL DEFAULT 0 in
--     001, built for the retired cost engine. With that shape there is no
--     difference between "this grade contains no nitrogen" and "nobody has
--     assayed the nitrogen yet" — and MODEL.md §6 names exactly that
--     collapse ("not-reported vs not-measured vs not-entered as three
--     distinct states") as a thing the rebuild must not repeat. Made
--     nullable. The ten assay columns 002 added are already nullable.
-- 1b. physical_form — the return sheet carries it for every grade and it
--     decides what a combination can physically be (RULES.md §4.1 form /
--     technique). It had nowhere to live.
-- 1c. grade_source — which PD case or document a grade came from, kept
--     separate from spec_note so provenance is queryable rather than buried
--     in prose (MODEL.md §6: "retrieval provenance separate from
--     confidence"). spec_note widened to 500 to hold the return sheet's own
--     status line and notes without truncating them.
--
-- Each ALTER is written so a re-run fails only with MySQL's "duplicate
-- column" (1060), which phpMyAdmin reports and which is harmless.
-- ---------------------------------------------------------------------------

ALTER TABLE pd_materials MODIFY COLUMN n_pct    DECIMAL(6,3) NULL DEFAULT NULL;
ALTER TABLE pd_materials MODIFY COLUMN p2o5_pct DECIMAL(6,3) NULL DEFAULT NULL;
ALTER TABLE pd_materials MODIFY COLUMN k2o_pct  DECIMAL(6,3) NULL DEFAULT NULL;
ALTER TABLE pd_materials MODIFY COLUMN s_pct    DECIMAL(6,3) NULL DEFAULT NULL;
ALTER TABLE pd_materials MODIFY COLUMN zn_pct   DECIMAL(6,3) NULL DEFAULT NULL;
ALTER TABLE pd_materials ADD COLUMN physical_form VARCHAR(20) NULL AFTER grade_pending;
ALTER TABLE pd_materials ADD COLUMN grade_source VARCHAR(200) NULL AFTER cost_updated;
ALTER TABLE pd_materials MODIFY COLUMN spec_note VARCHAR(500) NULL;

-- ---------------------------------------------------------------------------
-- SECTION 2 — retire the pre-rebuild placeholder seed
-- ---------------------------------------------------------------------------
-- Every boot of server.js used to seed ten invented placeholder materials
-- (PA54, H2SO4, ROCK28, MAP, AS, AMHUM, ZNSO4, SULPH, BINDER, FILLER) with
-- placeholder assays and placeholder costs, for the candidate cost engine that
-- is now deleted (cost is out of PD — PENDING-DECISIONS.md §D). That seed was
-- removed from server.js on 9 Sept 2026, but any database it already ran
-- against still holds the rows. They are NOT deleted: nothing in PD is ever
-- deleted, and 'MAP' in particular would otherwise silently collide with the
-- four real MAP grades below. They are deactivated, so they stop appearing in
-- any picker while their ids stay resolvable.
-- No-op on a database the seed never reached — which may well be all of them.
-- Do not read a zero-row result here as a failure.

UPDATE pd_materials
   SET active = 0,
       grade_pending = 1,
       spec_note = CONCAT(COALESCE(spec_note,''),
         ' [Retired 9 Sept 2026: pre-rebuild placeholder seed, superseded by the returned grade register. Kept, not deleted.]')
 WHERE code IN ('PA54','H2SO4','ROCK28','MAP','AS','AMHUM','ZNSO4','SULPH','BINDER','FILLER')
   AND substance IS NULL
   AND active = 1;   -- so a second run appends the note a second time to nothing

-- ---------------------------------------------------------------------------
-- SECTION 3 — the grade register, exactly as returned
-- ---------------------------------------------------------------------------
-- One row per GRADE, not per substance (RULES.md §5.1). grade_pending = 1 is
-- the sheet's own "grade not yet decided" — a fully valid, fully searchable
-- row that simply can never be called an exact repeat (§5.5 / §7.2).
-- assay_basis is 'placeholder' wherever the sheet's Status column says the
-- assay is still owed, 'standard_grade' where a published grade figure was
-- given. Nothing here is 'van_assay' — no VAN lab result has been entered.
-- cost_per_tonne is left at its column default and means nothing: cost is out
-- of PD, and that column survives only because dropping it is not this
-- file's job.
-- ---------------------------------------------------------------------------

INSERT IGNORE INTO pd_materials
  (code, name, substance, grade_label, grade_pending, n_pct, p2o5_pct, k2o_pct, s_pct, ha_pct, zn_pct, cu_pct, fe_pct, mn_pct, b_pct, ca_pct, mg_pct, moisture_pct, om_pct, ph_value, physical_form, assay_basis, grade_source, spec_note, active)
VALUES
  ('ELEMENTALSULFUR-400MESH', 'Elemental Sulfur 400 Mesh', 'Elemental Sulfur', '400 Mesh', 0, NULL, NULL, NULL, 90, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Powder', 'standard_grade', NULL, 'Form: Powder.', 1),
  ('MAP-12-61', 'MAP 12-61', 'MAP', '12-61', 0, 12, 61, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Granular', 'standard_grade', 'PENDING-DECISIONS.md C2', 'Form: Granular. Return-sheet status: Confirmed (C2). Moisture % as written: ˂1. Tahir ruled 4 real grades, 1 Sept 2026.', 1),
  ('MAP-10-61', 'MAP 10-61', 'MAP', '10-61', 0, 10, 61, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Granular', 'standard_grade', 'PENDING-DECISIONS.md C2', 'Form: Granular. Return-sheet status: Confirmed (C2). Moisture % as written: ˂1.', 1),
  ('MAP-10-52', 'MAP 10-52', 'MAP', '10-52', 0, 10, 52, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Granular', 'standard_grade', 'PENDING-DECISIONS.md C2', 'Form: Granular. Return-sheet status: Confirmed (C2). Moisture % as written: ˂1.', 1),
  ('MAP-11-44', 'MAP 11-44', 'MAP', '11-44', 0, 11, 44, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Granular', 'standard_grade', 'PENDING-DECISIONS.md C2', 'Form: Granular. Return-sheet status: Confirmed (C2). Moisture % as written: ˂1.', 1),
  ('DAP-18-46', 'DAP 18-46', 'DAP', '18-46', 0, 18, 46, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Granular', 'standard_grade', 'PENDING-DECISIONS.md C2', 'Form: Granular. Return-sheet status: Confirmed (C2). Moisture % as written: ˂1.5. Tahir ruled DAP is 1 grade, 1 Sept 2026.', 1),
  ('WDGSULFUR-WDG', 'WDG Sulfur', 'WDG Sulfur', 'WDG', 1, NULL, NULL, NULL, 70, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Powder', 'standard_grade', 'PENDING-DECISIONS.md C1', 'Form: Powder. Return-sheet status: Needs grade. Spelling settled (Sulfur, not Sulphur) — the actual grade/mesh spec was never ruled on. Fill in.', 1),
  ('SOPSULPHATEOFPOTASH', 'SOP (Sulphate of Potash)', 'SOP (Sulphate of Potash)', NULL, 1, NULL, NULL, 50, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Powder', 'placeholder', 'WORKED-CASE-V-GERMINATOR-PRO.md §2.9', 'Form: Powder. Return-sheet status: Needs grade + assay. First K₂O source tried in V Germinator Pro — settled after ~1 month, K₂O content dropped.', 1),
  ('KOH', 'KOH', 'KOH', NULL, 1, NULL, NULL, 70, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Flakes', 'placeholder', 'WORKED-CASE-V-GERMINATOR-PRO.md §2.9', 'Form: Flakes. Return-sheet status: Needs grade + assay. Second K₂O source tried — settling resolved, but N fell to ammonia gas.', 1),
  ('POTASSIUMCARBONATE', 'Potassium Carbonate', 'Potassium Carbonate', NULL, 1, NULL, NULL, 60, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Powder', 'placeholder', 'WORKED-CASE-V-GERMINATOR-PRO.md §2.9', 'Form: Powder. Return-sheet status: Needs grade + assay. Third K₂O source, currently in use — resolved both prior issues, under observation.', 1),
  ('MOLASSES', 'Molasses', 'Molasses', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Liquid', 'placeholder', 'WORKED-CASE-V-GERMINATOR-PRO.md §4.1 / PILOT-001', 'Form: Liquid. Return-sheet status: Needs grade + assay. Fermentation-source suspect #1 in the active pilot.', 1),
  ('AMINOACIDSOURCE', 'Amino Acid (source)', 'Amino Acid (source)', NULL, 1, 50, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Powder', 'placeholder', 'WORKED-CASE-V-GERMINATOR-PRO.md §4.1 / PILOT-001', 'Form: Powder. Return-sheet status: Needs grade + assay. Fermentation-source suspect #2 in the active pilot. "Amino Acid" is a placeholder — name the real material.', 1),
  ('HUMICACIDFLAKES', 'Humic Acid Flakes', 'Humic Acid Flakes', NULL, 1, NULL, NULL, NULL, NULL, 40, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL, NULL, 'Solid', 'placeholder', 'PD prototype seed data (b1)', 'Form: Solid. Return-sheet status: Needs grade + assay. Used in the P-fixation coating Bet — real grade not yet named.', 1),
  ('FULVATELIQUID', 'Fulvate Liquid', 'Fulvate Liquid', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Liquid', 'placeholder', 'PD prototype seed data (b1)', 'Form: Liquid. Return-sheet status: Needs grade + assay. Fulvate-coated MAP trial — real grade not yet named.', 1),
  ('ZINCSULFATEMONOHYDRA', 'Zinc Sulfate Monohydrate', 'Zinc Sulfate Monohydrate', NULL, 1, NULL, NULL, NULL, NULL, NULL, 33, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Powder', 'placeholder', 'combination-bank/RULES.md §5.1 (example)', 'Form: Powder. Return-sheet status: Needs grade + assay. Cited only as a naming example, not a ruling — confirm it''s real.', 1),
  ('PHOSPHORICACID-60', 'Phosphoric Acid 60%', 'Phosphoric Acid', '60%', 0, NULL, 50, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Liquid', 'placeholder', 'combination-bank/RULES.md §5.1 (example)', 'Form: Liquid. Return-sheet status: Needs assay. Cited as a naming example (60/65/75%) — confirm these are the real grades VAN stocks.', 1),
  ('PHOSPHORICACID-65', 'Phosphoric Acid 65%', 'Phosphoric Acid', '65%', 0, NULL, 52, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Liquid', 'placeholder', 'combination-bank/RULES.md §5.1 (example)', 'Form: Liquid. Return-sheet status: Needs assay.', 1),
  ('PHOSPHORICACID-75', 'Phosphoric Acid 75%', 'Phosphoric Acid', '75%', 0, NULL, 55, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Liquid', 'placeholder', 'combination-bank/RULES.md §5.1 (example)', 'Form: Liquid. Return-sheet status: Needs assay.', 1),
  ('LIGNITELOWGRINDED-25', 'Lignite low % (Grinded) 25%', 'Lignite low % (Grinded)', '25%', 0, NULL, NULL, NULL, NULL, 25, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL, NULL, 'Powder', 'placeholder', 'combination-bank/RULES.md §5.1 (example)', 'Form: Powder. Return-sheet status: Needs assay. Cited as a naming example — confirm real grade % values.', 1),
  ('LIGNITEHIGHGRINDED-55', 'Lignite high % (Grinded) 55%', 'Lignite high % (Grinded)', '55%', 0, NULL, NULL, NULL, NULL, 44, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 15, NULL, NULL, 'Powder', 'placeholder', 'combination-bank/RULES.md §5.1 (example)', 'Form: Powder. Return-sheet status: Needs assay.', 1),
  ('MOP-POWDER', 'MOP (Powder)', 'MOP', NULL, 1, NULL, NULL, 60, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Powder', 'placeholder', 'combination-bank/RULES.md §5.1 (example)', 'Form: Powder. Return-sheet status: Needs grade + assay. Moisture % as written: ˂1. Cited as MOP / MOP Powder / MOP Granular — form may BE the grade distinction here.', 1),
  ('MOP-GRANULAR', 'MOP (Granular)', 'MOP', NULL, 1, NULL, NULL, 60, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Granular', 'placeholder', 'combination-bank/RULES.md §5.1 (example)', 'Form: Granular. Return-sheet status: Needs grade + assay. Moisture % as written: ˂1.', 1),
  ('COPPERSULFATEPENTAHY', 'Copper Sulfate pentahydrate', 'Copper Sulfate pentahydrate', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, 25, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'crystal', 'placeholder', 'combination-bank/RULES.md §5.1 (example)', 'Form: crystal. Return-sheet status: Needs grade + assay. Cited as Copper Sulfate vs Copper Sulfate-Imported — confirm whether origin is a real grade distinction or should be dropped (§5.2: supplier is not identity).', 1),
  ('IRONFESOURCE', 'Iron (Fe) source', 'Iron (Fe) source', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Powder', 'placeholder', 'WORKED-CASE-V-GERMINATOR-PRO.md §1 / MODEL.md §3', 'Form: Powder. Return-sheet status: Needs material name + grade. SHEET ANOMALY: the return sheet carries 20.08 in the Mn % column on an iron source. Not loaded as an assay — confirm whether it belongs in Fe %. V Germinator Pro''s brief calls for Fe — no specific material named yet anywhere in the docs.', 1),
  ('MANGANESEMNSOURCE', 'Manganese (Mn) source', 'Manganese (Mn) source', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 32.5, NULL, NULL, NULL, NULL, NULL, NULL, 'Powder', 'placeholder', 'WORKED-CASE-V-GERMINATOR-PRO.md §1 / MODEL.md §3', 'Form: Powder. Return-sheet status: Needs material name + grade. Same brief calls for Mn — no specific material named yet anywhere in the docs.', 1),
  ('MGO', 'MgO', 'MgO', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 60, NULL, NULL, NULL, 'Powder', 'standard_grade', NULL, 'Form: Powder.', 1),
  ('MAGNESIUMSULFATEHEPT', 'Magnesium Sulfate Heptahydrate', 'Magnesium Sulfate Heptahydrate', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 10, 20, NULL, NULL, 'crystal', 'standard_grade', NULL, 'Form: crystal.', 1),
  ('SODIUMBORATE', 'Sodium Borate', 'Sodium Borate', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 20, NULL, NULL, NULL, NULL, NULL, 'Powder', 'standard_grade', NULL, 'Form: Powder.', 1),
  ('SPM', 'SPM', 'SPM', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 40, NULL, 'Solid', 'standard_grade', NULL, 'Form: Solid.', 1),
  ('MKP', 'MKP', 'MKP', NULL, 1, NULL, 52, 34, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Crystal', 'standard_grade', NULL, 'Form: Crystal. Moisture % as written: ˂1.', 1),
  ('BORICACID', 'Boric Acid', 'Boric Acid', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 17, NULL, NULL, NULL, NULL, NULL, 'Powder', 'standard_grade', NULL, 'Form: Powder.', 1),
  ('ROCKPHOSPHATE', 'Rock Phosphate', 'Rock Phosphate', NULL, 1, NULL, 27, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Powder', 'standard_grade', NULL, 'Form: Powder.', 1),
  ('NITRICACID', 'Nitric Acid', 'Nitric Acid', NULL, 1, 20, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Liquid', 'standard_grade', NULL, 'Form: Liquid.', 1),
  ('ZINCASH', 'Zinc Ash', 'Zinc Ash', NULL, 1, NULL, NULL, NULL, NULL, NULL, 40, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Powder', 'standard_grade', NULL, 'Form: Powder.', 1),
  ('POTASSIUMFULVATE', 'Potassium Fulvate', 'Potassium Fulvate', NULL, 1, NULL, NULL, 12, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Powder', 'standard_grade', NULL, 'Form: Powder.', 1),
  ('ZINCOXIDE', 'Zinc Oxide', 'Zinc Oxide', NULL, 1, NULL, NULL, NULL, NULL, NULL, 80, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Powder', 'standard_grade', NULL, 'Form: Powder.', 1),
  ('CALCIUMCARBONATE', 'Calcium Carbonate', 'Calcium Carbonate', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 40, NULL, NULL, NULL, NULL, 'Powder', 'standard_grade', NULL, 'Form: Powder.', 1),
  ('MAGNESIUMCARBONATE', 'Magnesium Carbonate', 'Magnesium Carbonate', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 28.5, NULL, NULL, NULL, 'Powder', 'standard_grade', NULL, 'Form: Powder.', 1),
  ('CALCIUMHYDROXIDE', 'Calcium Hydroxide', 'Calcium Hydroxide', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 54, NULL, NULL, NULL, NULL, 'Powder', 'standard_grade', NULL, 'Form: Powder.', 1),
  ('UREA', 'Urea', 'Urea', NULL, 1, 46, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Granular', 'standard_grade', NULL, 'Form: Granular. Moisture % as written: ˂0.5.', 1),
  ('POLTARY', 'Poltary', 'Poltary', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 40, NULL, 'Solid', 'standard_grade', NULL, 'Form: Solid.', 1),
  ('FLYASH', 'Fly Ash', 'Fly Ash', NULL, 1, NULL, NULL, 15, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Powder', 'standard_grade', NULL, 'Form: Powder.', 1),
  ('CITRICACID', 'Citric Acid', 'Citric Acid', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Powder', 'placeholder', NULL, 'Form: Powder.', 1),
  ('ACETICACID', 'Acetic Acid', 'Acetic Acid', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Liquid', 'placeholder', NULL, 'Form: Liquid.', 1),
  ('GIBERALICACID', 'Giberalic Acid', 'Giberalic Acid', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Powder', 'placeholder', NULL, 'Form: Powder.', 1),
  ('MEAPERKIN', 'MEA perkin', 'MEA perkin', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Liquid', 'placeholder', NULL, 'Form: Liquid.', 1),
  ('EDTASODIUMSALT', 'EDTA Sodium Salt', 'EDTA Sodium Salt', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Powder', 'placeholder', NULL, 'Form: Powder.', 1),
  ('FULVICACID', 'Fulvic Acid', 'Fulvic Acid', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Powder', 'placeholder', NULL, 'Form: Powder.', 1),
  ('SULFURICACID', 'Sulfuric Acid', 'Sulfuric Acid', NULL, 1, NULL, NULL, NULL, 32, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Liquid', 'standard_grade', NULL, 'Form: Liquid.', 1),
  ('PVA', 'PVA', 'PVA', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Powder', 'placeholder', NULL, 'Form: Powder.', 1),
  ('POP', 'POP', 'POP', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Powder', 'placeholder', NULL, 'Form: Powder.', 1),
  ('STARCH', 'Starch', 'Starch', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Powder', 'placeholder', NULL, 'Form: Powder.', 1),
  ('TALC', 'Talc', 'Talc', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Powder', 'placeholder', NULL, 'Form: Powder.', 1),
  ('CHINACLAY', 'China Clay', 'China Clay', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Powder', 'placeholder', NULL, 'Form: Powder.', 1),
  ('FUMEDSILICA', 'Fumed Silica', 'Fumed Silica', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Powder', 'placeholder', NULL, 'Form: Powder.', 1),
  ('YELLOWDYE', 'Yellow dye', 'Yellow dye', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 6.7, 'Powder', 'standard_grade', NULL, 'Form: Powder.', 1),
  ('BLUEDYE', 'Blue dye', 'Blue dye', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 5.7, 'Powder', 'standard_grade', NULL, 'Form: Powder.', 1),
  ('REDDYE', 'Red dye', 'Red dye', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 9.3, 'Powder', 'standard_grade', NULL, 'Form: Powder.', 1);

-- ---------------------------------------------------------------------------
-- NOT LOADED. The return sheet marks this row "Example — not a real template
-- row... Delete or overwrite it." It is a plausible real grade, but the sheet
-- itself says it is a shape demo, so it is left for Tahir to decide rather
-- than loaded on an assumption. Uncomment the INSERT to take it.
-- ---------------------------------------------------------------------------
-- INSERT IGNORE INTO pd_materials
--   (code, name, substance, grade_label, grade_pending, n_pct, p2o5_pct, k2o_pct, s_pct, ha_pct, zn_pct, cu_pct, fe_pct, mn_pct, b_pct, ca_pct, mg_pct, moisture_pct, om_pct, ph_value, physical_form, assay_basis, grade_source, spec_note, active)
-- VALUES
--   ('ELEMENTALSULFUR-200MESH', 'Elemental Sulfur 200 Mesh', 'Elemental Sulfur', '200 Mesh', 0, NULL, NULL, NULL, 90, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Powder', 'placeholder', 'Example — not a real template row', 'Form: Powder. Return-sheet status: Needs assay.', 1);

-- End of 004_material_grade_load.sql
