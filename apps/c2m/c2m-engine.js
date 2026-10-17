/* ============================================================================
 * C2M cost engine. Loads masters from the database and computes, for every client
 * pack: today's cost (materials + packing + conversion + freight), the approved
 * cost, and the dated cost in force on any day (ruling 14 Oct, 5f: cost by date).
 * Pure formulas live in c2m-lib.js; this file only gathers data and applies them.
 * ==========================================================================*/
'use strict';
const lib = require('./c2m-lib');

const today = () => lib.pkToday();

async function loadSettings(q) {
  const [rows] = await q('SELECT k, v, label, needs_approval FROM c2m_setting');
  const s = {}; rows.forEach(r => { s[r.k] = Number(r.v); });
  return { values: s, rows };
}

/** Latest rate per material grade (and the one before it, for the rate warning). */
async function loadRates(q) {
  const [rows] = await q(`SELECT g.id grade_id, g.grade, g.nutrients_json, m.id material_id, m.name, m.unit, m.type_id, t.name type_name, t.nutrient_fields, t.nutrient_role,
      r.rate, r.rate_date, r.source, r.entered_by, r.entered_at
    FROM c2m_material_grade g JOIN c2m_raw_material m ON m.id=g.material_id
    LEFT JOIN c2m_material_type t ON t.id=m.type_id
    LEFT JOIN c2m_material_rate r ON r.grade_id=g.id
    ORDER BY m.name, g.grade, r.rate_date DESC, r.id DESC`);
  const byGrade = new Map();
  for (const r of rows) {
    if (!byGrade.has(r.grade_id)) byGrade.set(r.grade_id, { gradeId: r.grade_id, materialId: r.material_id, name: r.name, grade: r.grade, unit: r.unit,
      typeId: r.type_id, type: r.type_name, role: r.nutrient_role || 'unclassified', fields: r.nutrient_fields ? r.nutrient_fields.split('|') : [], nutrients: r.nutrients_json ? JSON.parse(r.nutrients_json) : {}, history: [] });
    if (r.rate != null) byGrade.get(r.grade_id).history.push({ rate: Number(r.rate), date: r.rate_date, source: r.source, by: r.entered_by });
  }
  for (const g of byGrade.values()) { g.rate = g.history.length ? g.history[0].rate : null; g.date = g.history.length ? g.history[0].date : null; g.source = g.history.length ? g.history[0].source : null; }
  return byGrade;
}

async function loadPacking(q) {
  const [items] = await q(`SELECT i.id, i.name, i.kind, r.price_per_piece, r.rate_date, r.source FROM c2m_packing_item i
     LEFT JOIN c2m_packing_rate r ON r.id = (SELECT r2.id FROM c2m_packing_rate r2 WHERE r2.packing_item_id=i.id ORDER BY r2.rate_date DESC, r2.id DESC LIMIT 1)
     ORDER BY i.kind, i.name`);
  const itemById = new Map(items.map(i => [i.id, { id: i.id, name: i.name, kind: i.kind, price: i.price_per_piece == null ? null : Number(i.price_per_piece), date: i.rate_date, source: i.source }]));
  const [bills] = await q('SELECT id, name, status FROM c2m_packing_bill ORDER BY name');
  const [lines] = await q('SELECT id, packing_bill_id, packing_item_id, level, pieces, packs_per_outer FROM c2m_packing_bill_line ORDER BY packing_bill_id, level, id');
  const billById = new Map(bills.map(b => [b.id, { id: b.id, name: b.name, status: b.status, lines: [] }]));
  for (const l of lines) {
    const b = billById.get(l.packing_bill_id); if (!b) continue;
    const it = itemById.get(l.packing_item_id);
    b.lines.push({ id: l.id, itemId: l.packing_item_id, item: it ? it.name : '?', price: it ? it.price : null, level: l.level, pieces: Number(l.pieces), packsPerOuter: l.packs_per_outer == null ? null : Number(l.packs_per_outer) });
  }
  return { itemById, billById };
}

async function loadRecipes(q) {
  const [vers] = await q('SELECT * FROM c2m_recipe_version ORDER BY client_product_id, version_no');
  const [lines] = await q('SELECT id, recipe_version_id, grade_id, qty FROM c2m_recipe_line ORDER BY recipe_version_id, id');
  const [steps] = await q('SELECT recipe_version_id, action, by_user, at, note FROM c2m_recipe_step ORDER BY id');
  const byVer = new Map(vers.map(v => [v.id, { ...v, lines: [], steps: [] }]));
  lines.forEach(l => { const v = byVer.get(l.recipe_version_id); if (v) v.lines.push({ id: l.id, gradeId: l.grade_id, qty: Number(l.qty) }); });
  steps.forEach(s => { const v = byVer.get(s.recipe_version_id); if (v) v.steps.push(s); });
  const byCp = new Map();
  for (const v of byVer.values()) { if (!byCp.has(v.client_product_id)) byCp.set(v.client_product_id, []); byCp.get(v.client_product_id).push(v); }
  return { byVer, byCp };
}

/** Everything needed to cost any client pack. */
async function loadAll(q) {
  const settings = await loadSettings(q);
  const rates = await loadRates(q);
  const packing = await loadPacking(q);
  const recipes = await loadRecipes(q);
  const [customers] = await q('SELECT * FROM c2m_customer ORDER BY grp DESC, name');
  const [cps] = await q('SELECT * FROM c2m_client_product WHERE active=1 ORDER BY customer_id, brand');
  const [packs] = await q('SELECT * FROM c2m_client_pack ORDER BY client_product_id, pack_size');
  const [rules] = await q('SELECT * FROM c2m_conversion_rule WHERE active=1');
  const [ruleProducts] = await q('SELECT rule_id, client_product_id FROM c2m_conversion_rule_product');
  const [types] = await q('SELECT id, name FROM c2m_base_product ORDER BY name');
  const [freight] = await q('SELECT * FROM c2m_freight_rate ORDER BY valid_from DESC');
  const [versions] = await q('SELECT * FROM c2m_cost_version ORDER BY client_pack_id, valid_from');
  const custById = new Map(customers.map(c => [c.id, c]));
  const cpById = new Map(cps.map(c => [c.id, c]));
  const verByPack = new Map();
  versions.forEach(v => { if (!verByPack.has(v.client_pack_id)) verByPack.set(v.client_pack_id, []); verByPack.get(v.client_pack_id).push(v); });
  const ruleObjs = rules.map(r => ({ id: r.id, name: r.name, kind: r.kind, isBase: r.is_base, products: ruleProducts.filter(x => x.rule_id === r.id).map(x => x.client_product_id), rsPerKg: Number(r.rs_per_kg), scopeClientProductId: r.scope_client_product_id, scopeBaseProductId: r.scope_base_product_id,
    scopeForm: r.scope_form, scopeReprocessed: r.scope_reprocessed, scopePackMin: r.scope_pack_min, scopePackMax: r.scope_pack_max, validFrom: r.valid_from, active: r.active, source: r.source }));
  return { settings, rates, packing, recipes, customers, custById, cps, cpById, packs, rules: ruleObjs, productTypes: types, freight, verByPack };
}

function approvedVersion(D, cpId) {
  const list = D.recipes.byCp.get(cpId) || [];
  const appr = list.filter(v => v.state === 'approved');
  return appr.length ? appr[appr.length - 1] : null;
}
function latestVersion(D, cpId) { const list = D.recipes.byCp.get(cpId) || []; return list.length ? list[list.length - 1] : null; }

/** Materials cost of a recipe version at today's rates; also returns the priced lines. */
function priceRecipe(D, ver, rateOverride) {
  if (!ver) return null;
  const lines = ver.lines.map(l => { const g = D.rates.get(l.gradeId) || {}; const rate = rateOverride && rateOverride.gradeId === l.gradeId ? rateOverride.rate : g.rate;
    return { gradeId: l.gradeId, name: g.name || '?', grade: g.grade, qty: l.qty, rate, date: g.date, cost: rate == null ? null : l.qty * rate, nutrients: g.nutrients || {}, fields: g.fields || [], role: g.role || 'unclassified', type: g.type }; });
  const missing = lines.some(l => l.rate == null);
  return { lines, materials: missing ? null : lib.materialCost(lines), kgTotal: lib.recipeTotal(lines), missingRate: missing };
}

/** Nutrient analysis of a recipe (ruled 13 Oct; non-nutrient inputs ruled 16 Oct, Design Record 5i 4a).
 * % in product = sum of qty x nutrient % over the lines. Non-nutrient inputs (binder, filler, anti-caking,
 * wetting agent, colour, pH adjuster) count in the weight and add 0. A nutrient input with a field left
 * blank makes that field incomplete; an unclassified input is listed for Himayat to classify. */
function nutrients(priced) {
  const out = {}, fields = new Set(), missing = new Map(), carriers = [], unclassified = [];
  for (const l of priced.lines) {
    if (l.role === 'none') { carriers.push({ name: l.name, type: l.type, qty: l.qty }); continue; }
    if (l.role !== 'nutrient') { unclassified.push(l.name); continue; }
    for (const f of l.fields) { fields.add(f); const v = (l.nutrients || {})[f]; if (v == null) { if (!missing.has(f)) missing.set(f, []); missing.get(f).push(l.name); } else out[f] = (out[f] || 0) + l.qty * Number(v); }
  }
  return {
    fields: [...fields].map(f => ({ field: f, pct: out[f] == null ? null : out[f], missing: missing.get(f) || [] })),
    carriers, carrierKg: carriers.reduce((s, c) => s + c.qty, 0), unclassified,
    complete: !unclassified.length && ![...missing.values()].some(x => x.length),
  };
}

/** Freight per kg for delivered prices (dealer, farmer) by segment x region (ruling 12 Oct). */
function freightFor(D, cp) {
  if (!['Dealer', 'Farmer'].includes(cp.channel)) return 0;
  const cust = D.custById.get(cp.customer_id) || {};
  const f = D.freight.find(x => x.segment === cp.channel && x.region === cust.region);
  return f ? Number(f.rs_per_kg) : 0;
}

/** Today's cost for 1 client pack. opts.rateOverride {gradeId, rate} lets "Try a rate" preview a change. */
function packCost(D, pack, opts = {}) {
  const cp = D.cpById.get(pack.client_product_id); if (!cp) return null;
  const ver = opts.version || approvedVersion(D, cp.id);
  const priced = priceRecipe(D, ver, opts.rateOverride);
  let packing = 0;
  if (cp.packing_mode !== 'bulk' && pack.packing_bill_id) {
    const bill = D.packing.billById.get(pack.packing_bill_id);
    if (bill) packing = lib.packingPerUnit(bill.lines.map(l => (opts.packOverride && opts.packOverride.itemId === l.itemId ? { ...l, price: opts.packOverride.price } : l)), Number(pack.pack_size));
  }
  const cv = lib.conversionFor({ clientProductId: cp.id, baseProductId: cp.base_product_id, form: cp.form, reprocessed: cp.reprocessed, packSize: Number(pack.pack_size), onDate: today() }, D.rules);
  const conversion = cv.rsPerKg;
  const rule = cv.labour || cv.foh ? { name: [cv.labour ? `Labour: ${cv.labour.name} (Rs ${Number(cv.labour.rsPerKg)})` : 'Labour: none', cv.foh ? `FOH: ${cv.foh.name} (Rs ${Number(cv.foh.rsPerKg)})` : 'FOH: none'].join(' · '), labour: cv.labour, foh: cv.foh } : null;
  const freight = freightFor(D, cp);
  if (!priced || priced.materials == null) return { costed: false, packing, conversion, freight, rule, recipeVersionId: ver ? ver.id : null };
  return { costed: true, ...lib.costBreakdown({ materials: priced.materials, packing, conversion, freight }), labour: cv.labour ? Number(cv.labour.rsPerKg) : 0, rule, recipeVersionId: ver.id, kgTotal: priced.kgTotal };
}

/** Approved cost in force on a date (cost by date). Falls back to the earliest version, then today's cost. */
function costOnDate(D, packId, date) {
  const vs = D.verByPack.get(packId) || [];
  if (!vs.length) return null;
  let pick = null;
  for (const v of vs) if (String(v.valid_from).slice(0, 10) <= date) pick = v;
  return Number((pick || vs[0]).total);
}
/** The approved cost version in force on a date (object), or the earliest. */
function versionOnDate(D, packId, date) {
  const vs = D.verByPack.get(packId) || []; if (!vs.length) return null;
  let pick = null; for (const v of vs) if (String(v.valid_from).slice(0, 10) <= date) pick = v;
  return pick || vs[0];
}
function latestApproved(D, packId) { const vs = D.verByPack.get(packId) || []; return vs.length ? vs[vs.length - 1] : null; }

/** Find the client pack for an O2S line: customer name in o2s_names, brand = o2s_brand, channel group, pack size. */
function matcher(D) {
  const idx = new Map();
  for (const p of D.packs) {
    const cp = D.cpById.get(p.client_product_id); if (!cp) continue;
    const cust = D.custById.get(cp.customer_id); if (!cust) continue;
    const wl = cp.channel === 'White label';
    for (const nm of String(cust.o2s_names).split('|')) {
      idx.set([nm.trim().toLowerCase(), cp.o2s_brand.toLowerCase(), wl ? 'wl' : 'van', Number(p.pack_size)].join('#'), p);
    }
  }
  return (customerName, brand, channel, pack) => idx.get([String(customerName).trim().toLowerCase(), String(brand).toLowerCase(), channel === 'White Label' ? 'wl' : 'van', Number(pack)].join('#')) || null;
}

module.exports = { loadAll, packCost, priceRecipe, nutrients, costOnDate, versionOnDate, latestApproved, approvedVersion, latestVersion, matcher, freightFor, today };
