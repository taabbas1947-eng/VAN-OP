/* ============================================================================
 * C2M: Cost to Margin. Pure formulas and business rules (no database, no I/O).
 * Every function here is documented in docs/09-formulas-and-rules.md with the
 * ruling it comes from, and proved by tests/lib.test.js.
 * Units: money in Rs; quantities per kg, or per L when a product is sold per L.
 * ==========================================================================*/
'use strict';

/** Round to n decimals for display and storage (half away from zero). */
function round(x, n = 2) {
  if (x == null || !isFinite(x)) return null;
  const f = Math.pow(10, n);
  return Math.sign(x) * Math.round(Math.abs(x) * f) / f;
}

/**
 * Rate warning (ruling 14 Oct 2026, Design Record 2 "Rates"): a new rate that rises or
 * drops by more than warnPct from the last saved rate must be confirmed ("did you mean?").
 * Returns {warn, pct}. pct is the signed % change; no last rate means no warning.
 */
function rateWarning(lastRate, newRate, warnPct) {
  if (!(newRate > 0)) return { warn: true, pct: null, invalid: true };
  if (!(lastRate > 0)) return { warn: false, pct: null };
  const pct = (newRate - lastRate) / lastRate * 100;
  return { warn: Math.abs(pct) > warnPct, pct };
}

/**
 * Material cost per kg of product (ruling 10 Oct: recipe = kg of input per 1 kg of product,
 * loss included, totals may exceed 1). lines: [{qty, rate}] where rate is Rs per kg (or L) of input.
 */
function materialCost(lines) {
  return lines.reduce((s, l) => s + Number(l.qty) * Number(l.rate), 0);
}

/** Sum of recipe quantities; above 1 = loss carried in the recipe, below 1 = a line may be missing. */
function recipeTotal(lines) {
  return lines.reduce((s, l) => s + Number(l.qty), 0);
}

/**
 * Packing per kg (Yawar 14 Oct, ruled by Tahir 15 Oct, Design Record 5g):
 *  primary item: price per piece x pieces / pack size
 *  secondary item (e.g. carton holding N packs): price per piece x pieces / (N x pack size)
 * Example (made-up figures): an 8 kg bag at Rs 96 / 8 + a carton of 2 bags at Rs 80 / (2 x 8) = 12 + 5 = Rs 17 per kg.
 * lines: [{price, pieces, level, packsPerOuter}]; packSize in kg or L as the product is sold.
 */
function packingPerUnit(lines, packSize) {
  if (!(packSize > 0)) return 0;
  return lines.reduce((s, l) => {
    const pieces = l.pieces == null ? 1 : Number(l.pieces);
    if (l.level === 'secondary') {
      const n = Number(l.packsPerOuter) || 1;
      return s + Number(l.price) * pieces / (n * packSize);
    }
    return s + Number(l.price) * pieces / packSize;
  }, 0);
}

/**
 * Labour and FOH rate choice (ruled 14 Oct; revised by Tahir 16 Oct 2026, Design Record 5i 7 and 5j 10).
 * Every rate is labour or FOH. For each kind C2M picks 1 rate per product and the 2 are added.
 * Levels, first match wins: (1) the product is listed on the rate, (2) its product type,
 * (3) a rate Yawar added for all products (optionally a form, reprocessed, a pack range),
 * (4) the base bands (values set by Yawar, loaded at the first load; not written here: public repo). So any rate Yawar adds beats the bands for the products it covers.
 * Within a level the more specific wins: more conditions first, then the latest valid_from, then the
 * narrower pack range, then the newest. A list rate also honours its form and reprocessed filters.
 * product: {clientProductId, baseProductId, form, reprocessed, packSize, onDate}
 * rules: [{id, kind, isBase, rsPerKg, products[], scopeClientProductId, scopeBaseProductId, scopeForm,
 *          scopeReprocessed, scopePackMin, scopePackMax, validFrom, active}]
 * kind: 'labour' | 'foh' | undefined (undefined = any kind, used by tests of the levels).
 */
function pickConversionRule(product, rules, kind) {
  const on = product.onDate || '9999-12-31';
  const live = rules.filter(r => r.active !== 0 && String(r.validFrom).slice(0, 10) <= on && (kind == null || (r.kind || 'foh') === kind));
  const inPack = r => (r.scopePackMin == null || product.packSize >= Number(r.scopePackMin)) &&
                      (r.scopePackMax == null || product.packSize < Number(r.scopePackMax));
  const formOk = r => (r.scopeForm == null || r.scopeForm === product.form) &&
                      (r.scopeReprocessed == null || Number(r.scopeReprocessed) === (product.reprocessed ? 1 : 0));
  const listed = r => (r.products && r.products.length) || r.scopeClientProductId != null;
  const onList = r => (r.products || []).map(Number).includes(Number(product.clientProductId)) || Number(r.scopeClientProductId) === Number(product.clientProductId);
  const base = r => !!Number(r.isBase || 0);
  const levels = [
    r => listed(r) && onList(r) && inPack(r) && formOk(r),
    r => !listed(r) && r.scopeBaseProductId != null && Number(r.scopeBaseProductId) === Number(product.baseProductId) && inPack(r) && formOk(r),
    r => !listed(r) && r.scopeBaseProductId == null && !base(r) && inPack(r) && formOk(r),
    r => !listed(r) && r.scopeBaseProductId == null && base(r) && inPack(r) && formOk(r),
  ];
  const conds = r => ['scopeForm', 'scopeReprocessed', 'scopePackMin', 'scopePackMax'].filter(k => r[k] != null).length;
  const width = r => (r.scopePackMax == null ? 1e9 : Number(r.scopePackMax)) - (r.scopePackMin == null ? 0 : Number(r.scopePackMin));
  for (const test of levels) {
    const hits = live.filter(test).sort((a, b) => conds(b) - conds(a) || String(b.validFrom).slice(0, 10).localeCompare(String(a.validFrom).slice(0, 10)) || width(a) - width(b) || Number(b.id || 0) - Number(a.id || 0));
    if (hits.length) return hits[0];
  }
  return null;
}

/** Conversion per kg = the labour rate picked + the FOH rate picked (ruled 16 Oct). */
function conversionFor(product, rules) {
  const labour = pickConversionRule(product, rules, 'labour'), foh = pickConversionRule(product, rules, 'foh');
  return { labour, foh, rsPerKg: (labour ? Number(labour.rsPerKg) : 0) + (foh ? Number(foh.rsPerKg) : 0) };
}

/** Full cost per kg (or L): materials + packing + conversion + freight (ruling 10 Oct, section 2 "Cost"). */
function costBreakdown({ materials, packing, conversion, freight }) {
  const m = Number(materials) || 0, p = Number(packing) || 0, c = Number(conversion) || 0, f = Number(freight) || 0;
  return { materials: m, packing: p, conversion: c, freight: f, total: m + p + c + f };
}

/** Margin on net price before FED (ruling 10 Oct; FED is the only tax on VAN, D-72): (price - cost) / price x 100. */
function marginPct(price, cost) {
  if (!(price > 0) || cost == null) return null;
  return (price - cost) / price * 100;
}

/** Target price = cost / (1 - target GP) (ruling 10 Oct). Null when no target. */
function targetPrice(cost, targetGp) {
  if (cost == null || targetGp == null || targetGp >= 100) return null;
  return cost / (1 - targetGp / 100);
}

/** Contribution floor (ruled 14 Oct, 5f; labour added 16 Oct, 5j 8): materials + packing + freight + the labour rate per kg; FOH is fixed. */
function contributionFloor(b) { return (Number(b.materials) || 0) + (Number(b.packing) || 0) + (Number(b.freight) || 0) + (Number(b.labour) || 0); }

/** FED % from the setting fed_pct (D-72): the only tax on VAN, charged on every product and client. A missing,
 * blank or out-of-range value (not above 0 and below 100) is taken as 5, the rate ruled by Tahir on 19 Oct 2026. */
function fedPct(v) { const n = Number(v); return v != null && v !== '' && n > 0 && n < 100 ? n : 5; }

/** Net PO price from O2S (O2S rule): FED-inclusive lines divided by (1 + FED %); free lines 0. */
function netPoPrice(invoicePrice, fedMode, foc, fed = 5) {
  if (foc) return 0;
  const p = Number(invoicePrice) || 0;
  return fedMode === 'Inclusive' ? p / (1 + fedPct(fed) / 100) : p;
}

/** Cost re-approval needed when cost moves more than pct from the last approved cost (ruling 10 Oct, 3%). */
function needsReapproval(approvedCost, newCost, pct) {
  if (!(approvedCost > 0) || newCost == null) return false;
  return Math.abs(newCost - approvedCost) / approvedCost * 100 > pct;
}

/**
 * Exposure on a client product (ruling 14 Oct, 5f):
 *  locked  = max(target price - PO price, 0) x open PO kg   (already fixed by POs; plan for it)
 *  forward = max(target price - current price, 0) x expected kg for the horizon (ranking basis)
 *  forwardLoss = max(cost - current price, 0) x expected kg
 */
function exposure({ cost, targetGp, currentPrice, openKg, expectedKg }) {
  const tp = targetPrice(cost, targetGp);
  const gap = tp == null ? 0 : Math.max(tp - currentPrice, 0);
  return {
    targetPrice: tp,
    locked: gap * (Number(openKg) || 0),
    forward: gap * (Number(expectedKg) || 0),
    forwardLoss: Math.max((cost || 0) - currentPrice, 0) * (Number(expectedKg) || 0),
  };
}

/**
 * Flag a margin (ruling 14 Oct, 5f): below cost = red; below target by more than gapPts AND
 * Rs impact above redRs = red; any other shortfall to target = amber "slightly below target";
 * below budget = amber; else on target. No target and no budget = on target if not below cost.
 * g: {gp, target, budget, sales}  (sales = costed sales Rs in the period, for the Rs impact)
 */
function flag(g, redRs, gapPts) {
  if (g.gp == null) return { level: 'none', text: 'cost to load' };
  if (g.gp < 0) return { level: 'red', text: 'below cost' };
  if (g.target != null && g.gp < g.target - 0.05) {
    const gap = g.target - g.gp, impact = gap / 100 * (g.sales || 0);
    return gap > gapPts && impact > redRs ? { level: 'red', text: 'below target' } : { level: 'amber', text: 'slightly below target' };
  }
  if (g.budget != null && g.gp < g.budget - 0.05) return { level: 'amber', text: 'below budget' };
  return { level: 'green', text: 'on target' };
}

/** Family colour of a product type (Tahir, 18 Oct 2026: family chips by product type, D-55). Types in id order take the
 *  VAN Brand Master family colours in turn; a product with no type is grey. Server and page use this same colour. */
const FAMILY_COLOURS = ['#0F7A72', '#D2751A', '#0A86C8', '#2F7D3F', '#6E4A8E', '#7A5230', '#D9B300']; // the 7 Brand Master family colours, nothing invented
function familyColour(typeId, types) {
  if (typeId == null) return '#8796A5';
  const ids = (types || []).map(t => Number(t.id)).sort((a, b) => a - b); const i = ids.indexOf(Number(typeId));
  return i < 0 ? '#8796A5' : FAMILY_COLOURS[i % FAMILY_COLOURS.length];
}
/** Next step in the recipe chain (ruling 13 Oct): Majid writes, Himayat reviews, Fahim endorses, Yawar approves cost. */
const RECIPE_FLOW = { draft: 'review', review: 'endorse', endorse: 'cost', cost: 'approved' };
const RECIPE_WHO = { draft: 'production', review: 'qc', endorse: 'plant', cost: 'cfo' };

/** Pakistan time (Asia/Karachi, UTC+5, no daylight saving). Audit finding 9, 16 Oct 2026. */
function pkParts(d = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const o = {}; f.formatToParts(d).forEach(p => { o[p.type] = p.value; }); if (o.hour === '24') o.hour = '00'; return o;
}
function pkToday(d) { const o = pkParts(d); return `${o.year}-${o.month}-${o.day}`; }
function pkNow(d) { const o = pkParts(d); return `${o.year}-${o.month}-${o.day} ${o.hour}:${o.minute}:${o.second}`; }

/** Buyer line of a sale (Tahir, 19 Oct 2026, D-74): C2M names only white label clients, distributors and dealers, as O2S marks
 *  them on the PO. COBO and VGreen are 1 line each (they buy on price lists); every farmer, and any other buyer, is pooled
 *  into 1 line, "Farmers and other". grp is 'White label' or 'VAN brand'; ch is the O2S channel as C2M names it. */
const CATS = { wl: 'White label', dist: 'Distributors', dealer: 'Dealers', cobo: 'COBO', vg: 'VGreen', farm: 'Farmers and other' };
function buyerLine(grp, ch, name) {
  const cat = grp === 'White label' ? 'wl' : ({ Distributor: 'dist', Dealer: 'dealer', COBO: 'cobo', Cobo: 'cobo', VGreen: 'vg', Vgreen: 'vg' }[String(ch || '').trim()] || 'farm');
  return { cat, line: ['wl', 'dist', 'dealer'].includes(cat) ? String(name || '') : CATS[cat] };
}
/** A product's GP target (Tahir, 19 Oct 2026, D-75): its own target if one is set, else the company GP target (budget_gp). */
function targetOr(t, budget) { return t != null && t !== '' && isFinite(Number(t)) ? Number(t) : (budget != null && isFinite(Number(budget)) ? Number(budget) : null); }

/** Pakistani number format with digits, e.g. 1,234,567. */
function fmtInt(x) { return x == null ? '' : Math.round(x).toLocaleString('en-US'); }

module.exports = {
  round, rateWarning, materialCost, recipeTotal, packingPerUnit, pickConversionRule, conversionFor, costBreakdown,
  marginPct, targetPrice, contributionFloor, fedPct, netPoPrice, needsReapproval, exposure, flag,
  RECIPE_FLOW, RECIPE_WHO, fmtInt, pkToday, pkNow, FAMILY_COLOURS, familyColour, CATS, buyerLine, targetOr,
};
