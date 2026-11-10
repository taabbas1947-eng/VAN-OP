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

/** A packing item bought by weight (Yawar, 26 Oct 2026: plastic inners, 20 to 30 pieces per kg): price per piece =
 *  Rs per kg / pieces per kg. The working is kept at the end of the rate's source as "[bought per kg: 860 / 29]",
 *  so the rate history shows what was bought, with no database change. */
const BUY_RE = /\s*\[bought per kg: ([0-9.]+) \/ ([0-9.]+)\]\s*$/;
function buyOf(source) { const m = BUY_RE.exec(String(source || '')); return m ? { perKg: Number(m[1]), piecesPerKg: Number(m[2]) } : null; }
function buyNote(perKg, piecesPerKg) { return ` [bought per kg: ${Number(perKg)} / ${Number(piecesPerKg)}]`; }
function sourceText(source) { return String(source || '').replace(BUY_RE, ''); }
function piecePrice(perKg, piecesPerKg) { return Math.round(Number(perKg) / Number(piecesPerKg) * 10000) / 10000; }

/** Printed MRP of a VAN brand pack (Tahir, 26 Oct 2026, D-122): the Farmer, Sindh credit price with FED, rounded UP to
 *  the next Rs 50; with no credit price, the highest farmer price (Punjab or Sindh), rounded the same way. f: a farmer row. */
function printMrp(f) {
  const n = v => (v == null || v === '' || !isFinite(Number(v)) ? 0 : Number(v));
  const snc = n(f && f.snc), base = snc > 0 ? snc : Math.max(n(f && f.pb), n(f && f.sn)); if (!(base > 0)) return null;
  const b2 = Math.round(base * 100) / 100; return { mrp: Math.ceil(b2 / 50 - 1e-9) * 50, basis: snc > 0 ? 'Sindh credit' : (n(f && f.pb) >= n(f && f.sn) ? 'Farmer Punjab (no credit price)' : 'Farmer Sindh (no credit price)'), base: b2 };
}
/** Every list price above its pack's printed MRP (D-122): Farmer Punjab and Sindh (the website uses Punjab), Dealer FRP,
 *  Dealer net with FED, Distributor price with FED, and the Recommended MRP on the Dealer and Distributor lists (Yawar, 26 Oct 2026).
 *  L: lists grouped with each row's packId. */
function mrpIssues(L) {
  const by = new Map(); (L.farmer || []).forEach(f => { if (f.packId == null) return; const m = printMrp(f); if (m) by.set(Number(f.packId), { m, f }); });
  const out = []; const chk = (pid, name, list, field, word, v) => { const x = by.get(Number(pid)); if (!x || v == null || v === '' || !(Number(v) > x.m.mrp + 0.004)) return; out.push({ packId: Number(pid), name, list, field, word, price: Number(v), mrp: x.m.mrp }); };
  (L.farmer || []).forEach(f => { const m = printMrp(f); if (!m) return; [['pb', 'Farmer, Punjab (and the website)'], ['sn', 'Farmer, Sindh']].forEach(([k, w]) => { const v = f[k]; if (v != null && v !== '' && Number(v) > m.mrp + 0.004) out.push({ packId: f.packId != null ? Number(f.packId) : null, name: f.p, list: 'farmer', field: k, word: w, price: Number(v), mrp: m.mrp }); }); }); // each farmer row against its own MRP: needs no link to a pack
  (L.dealer || []).forEach(d => { if (d.packId == null) return; const nm = `${d.p}${d.pack ? ' ' + d.pack : ''}`; chk(d.packId, nm, 'dealer', 'frp', 'Dealer FRP', d.frp); chk(d.packId, nm, 'dealer', 'netfed', 'Dealer net with FED', d.netfed); chk(d.packId, nm, 'dealer', 'mrp', 'Dealer Recommended MRP', d.mrp); });
  (L.dist || []).forEach(d => { if (d.packId == null) return; const nm = `${d.p}${d.pack ? ' ' + d.pack : ''}`; chk(d.packId, nm, 'dist', 'fed', 'Distributor price with FED', d.fed); chk(d.packId, nm, 'dist', 'mrp', 'Distributor Recommended MRP', d.mrp); });
  return out;
}

/** Packs on the Dealer or Distributor list with no printed MRP: no farmer row with a price (Tahir, 26 Oct 2026: named on Approvals). */
function mrpMissing(L) {
  const has = new Set((L.farmer || []).filter(f => f.packId != null && printMrp(f)).map(f => Number(f.packId))); const seen = new Set(), out = [];
  [...(L.dealer || []), ...(L.dist || [])].forEach(d => { if (d.packId == null || has.has(Number(d.packId)) || seen.has(Number(d.packId))) return; seen.add(Number(d.packId)); out.push({ packId: Number(d.packId), name: `${d.p}${d.pack ? ' ' + d.pack : ''}` }); });
  return out;
}

/**
 * Labour and FOH rate choice (ruled 14 Oct; revised by Tahir 16 Oct 2026, Design Record 5i 7 and 5j 10).
 * Every rate is labour or FOH. For each kind C2M picks 1 rate per product and the 2 are added.
 * Levels, first match wins: (1) the product is listed on the rate (a client pack), (1b, D-95) its variant, (2) its product type,
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
  const noVar = r => r.scopePvariantId == null; // a rate for one variant is used only at the variant level (D-95)
  const levels = [
    r => listed(r) && onList(r) && inPack(r) && formOk(r),
    r => !listed(r) && r.scopePvariantId != null && product.variantId != null && Number(r.scopePvariantId) === Number(product.variantId) && inPack(r) && formOk(r),
    r => !listed(r) && noVar(r) && r.scopeBaseProductId != null && Number(r.scopeBaseProductId) === Number(product.baseProductId) && inPack(r) && formOk(r),
    r => !listed(r) && noVar(r) && r.scopeBaseProductId == null && !base(r) && inPack(r) && formOk(r),
    r => !listed(r) && noVar(r) && r.scopeBaseProductId == null && base(r) && inPack(r) && formOk(r),
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
/** The re-approval % when the setting is missing or not a number (docs 09: reapprove_pct 3). A missing setting must never switch re-approval off (audit 3 Nov 2026, D-145). */
const REAPPROVE_DEFAULT = 3;
function needsReapproval(approvedCost, newCost, pct) {
  if (!(approvedCost > 0) || newCost == null) return false;
  const p = pct == null || pct === '' || !isFinite(Number(pct)) ? REAPPROVE_DEFAULT : Number(pct);
  return Math.abs(newCost - approvedCost) / approvedCost * 100 > p;
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
/** Push 7b (R64, D-163): another recipe of a product (the short path) goes Production Manager, QC Head, CFO; the Plant Manager is skipped. */
const RECIPE_FLOW_OTHER = { draft: 'review', review: 'cost', cost: 'approved' };
/** A recipe's lines as 1 string, the same whatever their order: "12:0.2|3:0.1" (grade id and kg per kg). R63 compares it at resend. */
const lineSig = lines => (lines || []).map(l => `${Number(l.gradeId != null ? l.gradeId : l.grade_id)}:${Number(Number(l.qty).toFixed(8))}`).sort().join('|');
/** Where a resend goes (R63, D-163): sent back by the QC Head, or the lines changed since it was sent back (or that is not known),
 *  back to the QC Head; otherwise straight back to whoever sent it back. */
function resendTo(sentBackState, sigAtBack, sigNow) { if (sentBackState === 'review' || sentBackState === 'draft' || !sentBackState) return 'review'; return sigAtBack != null && sigAtBack === sigNow ? sentBackState : 'review'; }
const RECIPE_WHO = { draft: 'production', review: 'qc', endorse: 'plant', cost: 'cfo' };

/** Pakistan time (Asia/Karachi, UTC+5, no daylight saving). Audit finding 9, 16 Oct 2026. */
function pkParts(d = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const o = {}; f.formatToParts(d).forEach(p => { o[p.type] = p.value; }); if (o.hour === '24') o.hour = '00'; return o;
}
function pkToday(d) { const o = pkParts(d); return `${o.year}-${o.month}-${o.day}`; }
function pkNow(d) { const o = pkParts(d); return `${o.year}-${o.month}-${o.day} ${o.hour}:${o.minute}:${o.second}`; }

/** Client line of a sale (Tahir, 19 Oct 2026, D-74; R56 and R59, 7 Nov 2026, D-159): C2M names only white label clients, distributors and
 *  dealers, as O2S marks them on the PO. COBO and VGreen are 1 line each (they buy on price lists). Farmers are not clients (R56):
 *  a farmer sale (O2S channel Farmer) shows under the farmer price list it was picked on, lkey farmer_pb, farmer_sn or farmer_snc;
 *  with no list known it is taken as on the Farmer list, Punjab (R59). A sale with any other channel (empty or not one of O2S's 6)
 *  is 1 line, "Other sales". grp is 'White label' or 'VAN brand'; ch is the O2S channel as C2M names it; lkey the sale's list. */
const CATS = { wl: 'White label', dist: 'Distributors', dealer: 'Dealers', cobo: 'COBO', vg: 'VGreen', farm: 'Farmer lists', oth: 'Other sales' };
const FARMER_LINE = { farmer_pb: 'Farmer list, Punjab', farmer_sn: 'Farmer list, Sindh cash', farmer_snc: 'Farmer list, Sindh credit' };
function buyerLine(grp, ch, name, lkey) {
  const c = String(ch || '').trim();
  const cat = grp === 'White label' ? 'wl' : ({ Distributor: 'dist', Dealer: 'dealer', COBO: 'cobo', Cobo: 'cobo', VGreen: 'vg', Vgreen: 'vg' }[c] || (/^farmer$/i.test(c) ? 'farm' : 'oth'));
  if (cat === 'farm') return { cat, line: FARMER_LINE[lkey] || FARMER_LINE.farmer_pb };
  return { cat, line: ['wl', 'dist', 'dealer'].includes(cat) ? String(name || '') : CATS[cat] };
}
/** A product's GP target (Tahir, 19 Oct 2026, D-75): its own target if one is set, else the company GP target (budget_gp). */
/* A target of 0 or less is no target, as on the page (audit 3 Nov 2026, D-145): it takes the company GP target. */
function targetOr(t, budget) { return t != null && t !== '' && isFinite(Number(t)) && Number(t) > 0 ? Number(t) : (budget != null && isFinite(Number(budget)) ? Number(budget) : null); }
/** A PO line is checked against the price in force when it came in (Tahir, 4 Nov 2026, D-145): a price approved on the PO's own date counts only
 *  when it was approved at or before the PO was entered (enteredAt, Pakistan time); with no entry time, a price approved that day does not count. */
function priceCountsForPo(p, received, enteredAt) {
  const day = String(received || '').slice(0, 10), at = p.decidedAt || p.decided_at ? String(p.decidedAt || p.decided_at).slice(0, 19) : null;
  if (!at || at.slice(0, 10) < day) return true; // approved on an earlier day (or no approval time kept): counts as before
  if (at.slice(0, 10) > day) return true; // approved later but dated back: its valid_from decides, as before
  return !!enteredAt && at <= String(enteredAt).slice(0, 19);
}

/** 2 region names are the same when they match with capitals and spaces ignored ("sindh" is Sindh; audit 4 Nov 2026, fault A7). */
function sameRegion(a, b) { const k = v => String(v == null ? '' : v).trim().replace(/\s+/g, ' ').toLowerCase(); return k(a) !== '' && k(a) === k(b); }

/** Pakistani number format with digits, e.g. 1,234,567. */
function fmtInt(x) { return x == null ? '' : Math.round(x).toLocaleString('en-US'); }
/** Rupees with thousands commas and 2 decimals, for messages people read: 1,250.00 (R26, push 6a). */
function fmtRs2(x) { const n = Number(x); return x == null || !isFinite(n) ? String(x) : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

/* A VAN brand list row names a pack when its name (size taken out), size and unit (kg or L) agree: the B-18 rule the page uses
   for suggestions (vmSuggest), here for the server's checks on the "not a C2M pack" mark (1.0.1, D-80, review finding 1). */
const LSIZE = /(\d+(?:\.\d+)?)\s*-?\s*(kgs?|liters?|litres?|ltrs?|l|ml|gms?|grams?|g)\b/i; // g and ml: packs under 1 kg or 1 L (Tahir, 20 Oct 2026)
const lnorm = s => String(s || '').toLowerCase().replace(/[^a-z0-9.]+/g, ' ').replace(/\b0+(\d)/g, '$1').trim();
function listRowSize(s) { const m = String(s || '').match(LSIZE); if (!m) return null; const u = m[2].toLowerCase(); const kg = /^(kg|g)/.test(u); return { v: u === 'ml' || (/^g/.test(u)) ? Number(m[1]) / 1000 : Number(m[1]), u: kg ? 'kg' : 'L' }; }
/** True when list row data d (list dist, dealer or farmer) names the pack brand, size, soldPer (kg or L). */
function listRowIs(list, d, brand, size, soldPer) {
  const z = list === 'farmer' ? listRowSize(d.p) : listRowSize(d.pack);
  if (!z) return lnorm(d.p) !== '' && lnorm(d.p) === lnorm(brand); // a row with no size in it: its name alone equal to the product's names it (review 1.0.1 re-check)
  return Math.abs(Number(size) - z.v) < 1e-6 && (soldPer || 'kg') === z.u && lnorm(String(d.p).replace(new RegExp(LSIZE.source, 'ig'), '')) === lnorm(brand);
}
/* 1.0.2, product names (Tahir, 19 Oct 2026, D-85): 1 name per product everywhere. A VAN brand list row linked to a pack
   carries the product's official name and the pack in C2M's form ("1 L", "25 kg"); the farmer list writes both in p. */
/* Tahir, 20 Oct 2026: a pack under 1 L or 1 kg is written in ml or g (500 ml, 250 g), as farmers know it; 1 L and above stay 1 L, 25 kg. */
const officialPack = (size, soldPer) => { const z = Number(size), u = soldPer || 'kg'; return z > 0 && z < 1 ? `${Math.round(z * 1000)} ${u === 'L' ? 'ml' : 'g'}` : `${z} ${u}`; };
/** The list row data renamed to the official name of its pack; listName keeps the name the row had first. */
function officialRow(list, d, brand, size, soldPer) {
  const pack = officialPack(size, soldPer); const was = list === 'farmer' ? String(d.p || '') : `${d.p || ''}${d.pack ? ' · ' + d.pack : ''}`;
  const nd = { ...d }; if (list === 'farmer') nd.p = `${brand} ${pack}`; else { nd.p = brand; nd.pack = pack; }
  const now = list === 'farmer' ? nd.p : `${nd.p} · ${nd.pack}`; const changed = now !== was;
  if (changed && !nd.listName) { nd.listName = was; nd.listP = d.p; if (d.pack != null) nd.listPack = d.pack; } // the name the row had first, to give back on unlink
  return { nd, was, now, changed };
}
/** Unlinked, a row takes back the name it had before it was renamed to a pack's official name (a wrong link leaves no wrong name). */
function restoreRow(d) {
  if (!d.listName) return { nd: d, changed: false }; const nd = { ...d }; nd.p = d.listP != null ? d.listP : d.p; if (d.listPack != null) nd.pack = d.listPack; else if (d.listP != null) delete nd.pack;
  delete nd.listName; delete nd.listP; delete nd.listPack; return { nd, changed: true, was: d.p, now: nd.p };
}
/* 1.0.3, 1 master list (Tahir, 20 Oct 2026, D-87): today's list rows are carried into the master once, grouped by product.
   rowNameKey: the product name with its pack size taken out ("Brand 30% (01 Liter)" and "Brand 30%" are 1 group).
   looseKey: also without percentages and words in brackets, so "AB Brand 30%" reads as "AB-Brand". */
const rowNameKey = s => lnorm(String(s == null ? '' : s).replace(new RegExp(LSIZE.source, 'ig'), ' ').replace(/\(\s*\)/g, ' '));
const looseKey = s => lnorm(String(s == null ? '' : s).replace(new RegExp(LSIZE.source, 'ig'), ' ').replace(/\([^)]*\)/g, ' ').replace(/\d+(?:\.\d+)*\s*%/g, ' '));
/** Size and unit a list row is written with: the pack column, else the name (the farmer list writes both in the name). */
const rowSize = (list, d) => listRowSize(list === 'farmer' ? d.p : (d.pack || d.p));
/** Master order (D-87): products A to Z by official name, then packs small to large. */
const masterCmp = (a, b) => String(a.brand).toLowerCase().localeCompare(String(b.brand).toLowerCase()) || Number(a.size) - Number(b.size);
/** A new material class (Tahir, 4 Nov 2026, D-144). role 'nutrient' asks % fields; 'none' adds no nutrients and asks none.
 *  Fields are typed separated by commas; each ends with % (added if left out). The same field name in 2 classes adds up in a
 *  recipe's nutrient analysis, so a field typed in other letters (n%) takes the spelling already in use (known). Returns { name, role, fields } or throws a message the person can act on. */
function newMaterialClass(name, role, fieldsText, known) {
  const kn = new Map((known || []).map(k => [String(k).toLowerCase(), String(k)]));
  let nm = String(name || '').replace(/\s+/g, ' ').trim();
  if (!['nutrient', 'none'].includes(role)) throw new Error('Pick whether the class carries nutrients.');
  const bare = nm.replace(/^non-nutrient:\s*/i, '');
  if (bare.length < 3 || bare.length > 66) throw new Error('Give the class a name of 3 to 66 letters.');
  if (role === 'nutrient' && bare !== nm) throw new Error('A class that carries nutrients cannot be named Non-nutrient.');
  if (role === 'none') nm = 'Non-nutrient: ' + bare;
  if (/\|/.test(nm)) throw new Error('A class name cannot hold the sign |.');
  if (role === 'none') return { name: nm, role, fields: [] };
  const seen = new Set(), fields = [];
  for (let f of String(fieldsText || '').split(',')) {
    f = f.replace(/\s+/g, ' ').trim(); if (!f) continue;
    if (!f.endsWith('%')) f += '%';
    f = f.replace(/\s+%$/, '%');
    if (!/^[A-Za-z][A-Za-z0-9 ()+\/.-]{0,23}%$/.test(f)) throw new Error(`"${f}" is not a field name: start with a letter, up to 24 letters or digits, ending in %. For example: N%, Amino acid%.`);
    if (kn.has(f.toLowerCase())) f = kn.get(f.toLowerCase()); // n% is the N% already in use, so it adds up
    const k = f.toLowerCase(); if (seen.has(k)) throw new Error(`${f} is typed twice.`); seen.add(k); fields.push(f);
  }
  if (!fields.length) throw new Error('A nutrient class asks at least 1 field, for example N%.');
  if (fields.length > 10) throw new Error('A class asks at most 10 fields.');
  if (fields.join('|').length > 200) throw new Error('The fields are too long together: shorten their names.');
  return { name: nm, role, fields };
}
/* ---------- Push 7a (Tahir, 9 Nov 2026, R60 to R62, D-162): 1 nutrient list, nutrients per material, declared grade ---------- */
/** The nutrient a class field stands for: the field without its % sign ("N%" is N, "Amino acid %" is Amino acid). */
const fieldLabel = f => String(f == null ? '' : f).replace(/\s+/g, ' ').replace(/\s*%\s*$/, '').trim();
const MEASURES = ['w/w', 'w/v'];
/** A nutrient as typed on the Nutrients tab: { name, label, basis, measure }. Throws a message the person can act on.
 *  label is what it is shown as and what a recipe's analysis adds up by, so 2 nutrients never share it (any letters' case). */
function cleanNutrient(b, taken) {
  const one = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  const label = fieldLabel(one(b && b.label)), name = one(b && b.name) || label, basis = one(b && b.basis), measure = one(b && b.measure) || 'w/w';
  if (!/^[A-Za-z][A-Za-z0-9 ()+\/.₀-₉-]{0,23}$/.test(label)) throw new Error('"Shown as" starts with a letter and has up to 24 letters or digits, for example N, K2O, Amino acids.');
  if (name.length > 60 || basis.length > 60) throw new Error('Keep the name and the basis under 60 letters each.');
  if (/\|/.test(name + basis)) throw new Error('The sign | cannot be used.');
  if (!MEASURES.includes(measure)) throw new Error('Pick % weight in weight (w/w) or % weight in volume (w/v).');
  const t = (taken || []).find(x => String(x).toLowerCase() === label.toLowerCase());
  if (t) throw new Error(`${t} is already in the nutrient list. Use it, or give this one another "shown as" (for example K2O and K are 2 nutrients).`);
  return { name, label, basis, measure };
}
/** A copied class field as a nutrient's "shown as": the field without %, only the signs a "shown as" may hold, at most 24 letters,
 *  starting with a letter (review 7a, M2: 1 odd field must never stop the copy). */
function safeLabel(f) {
  let l = fieldLabel(f).replace(/[^A-Za-z0-9 ()+\/.₀-₉-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!/^[A-Za-z]/.test(l)) l = ('Nutrient ' + l).trim();
  return l.slice(0, 24).trim();
}
/** The first copy of the old data into the new tables (run once by C2M after migration 014).
 *  types: c2m_material_type rows; grades: [{ id, typeId, json }] (json = nutrients_json); taken: "shown as" names already in the list.
 *  Every class field becomes a nutrient (first spelling wins, any letters' case; a name already in the list is reused). Each grade
 *  of a nutrient class carries only the values of its class's own fields, as the old screen counted them (review 7a, M1): a value
 *  left from an earlier class is not made live; it is listed in skipped for the change record. A grade with every class field
 *  entered is taken as checked, as the old screen showed it "complete". Returns { labels (new to the list), map, rows, checked, skipped }. */
function nutrientBackfill(types, grades, taken) {
  const shown = new Map((taken || []).map(t => [String(t).toLowerCase(), String(t)])); // lower-case "shown as" to its spelling
  const origin = new Map((taken || []).map(t => [String(t).toLowerCase(), String(t).toLowerCase()])); // which field each one stands for
  const byField = new Map(), labels = [];
  const add = f => { const k = fieldLabel(f).toLowerCase(); if (!k) return null; if (byField.has(k)) return byField.get(k);
    const base = safeLabel(f); let l = base, i = 2;
    while (shown.has(l.toLowerCase()) && origin.get(l.toLowerCase()) !== k) l = base.slice(0, 21).trim() + ' ' + i++; // cut short to the same name as another field: numbered
    if (!shown.has(l.toLowerCase())) { shown.set(l.toLowerCase(), l); origin.set(l.toLowerCase(), k); labels.push(l); }
    const out = shown.get(l.toLowerCase()); byField.set(k, out); return out; };
  const T = new Map((types || []).map(t => [Number(t.id), t]));
  (types || []).forEach(t => String(t.nutrient_fields || '').split('|').filter(Boolean).forEach(add));
  const rows = [], checked = [], skipped = [];
  for (const g of grades || []) {
    let j = null; try { j = g.json ? JSON.parse(g.json) : null; } catch (e) { j = null; }
    if (!j || typeof j !== 'object' || Array.isArray(j)) { if (g.json) skipped.push({ gradeId: Number(g.id), why: 'not readable', value: String(g.json).slice(0, 120) }); continue; }
    const t = T.get(Number(g.typeId)); if (!t || t.nutrient_role !== 'nutrient') { if (Object.keys(j).length) skipped.push({ gradeId: Number(g.id), why: 'class adds no nutrients', value: j }); continue; }
    const fields = String(t.nutrient_fields || '').split('|').filter(Boolean); const own = new Map(fields.map(f => [fieldLabel(f).toLowerCase(), f]));
    const seen = new Set();
    for (const [k, v] of Object.entries(j)) {
      const n = Number(v); const f = own.get(fieldLabel(k).toLowerCase());
      if (!f) { skipped.push({ gradeId: Number(g.id), why: 'not a field of its class now', value: { [k]: v } }); continue; }
      if (v == null || v === '' || typeof v === 'object' || !isFinite(n) || n < 0 || n > 100) { skipped.push({ gradeId: Number(g.id), why: 'not a % from 0 to 100', value: { [k]: v } }); continue; }
      const l = add(f); if (!l || seen.has(l)) continue; seen.add(l); rows.push({ gradeId: Number(g.id), label: l, pct: n });
    }
    if (fields.length && fields.every(f => { const v = Object.entries(j).find(([k]) => fieldLabel(k).toLowerCase() === fieldLabel(f).toLowerCase()); return v && v[1] != null && v[1] !== '' && typeof v[1] !== 'object' && isFinite(Number(v[1])); })) checked.push(Number(g.id));
  }
  return { labels, map: Object.fromEntries(byField), rows, checked, skipped };
}
/* ---------- Push 7c (Tahir, 10 Nov 2026, R70 to R73, D-164): % w/w and % w/v ----------
   % w/w = kg of nutrient per 100 kg; % w/v = kg per 100 L (g per 100 mL); density in kg per L, at 20 °C. Checked by an
   independent unit audit, 10 Nov 2026 (every rule and example correct). */
const BASES = ['w/w', 'w/v'];
/** kg of nutrient per 1 kg (dosed in kg) or per 1 L (dosed in L) of a material, as a %, from its value as typed.
 *  Dosed in kg: w/w as typed, w/v ÷ density. Dosed in L: w/v as typed, w/w × density. null when a needed density is missing. */
function perUnitPct(v, measure, unit, density) {
  const x = Number(v), d = Number(density) > 0 ? Number(density) : null; const w = measure === 'w/v';
  if (!isFinite(x)) return null;
  if (unit === 'L') return w ? x : d ? x * d : null;
  return w ? (d ? x / d : null) : x;
}
/** A product's figure in the other basis: w/w to w/v × density; w/v to w/w ÷ density; null without a density. */
function toBasis(pct, from, to, rho) { if (pct == null) return null; if (from === to) return pct; const d = Number(rho) > 0 ? Number(rho) : null; if (!d) return null; return from === 'w/w' ? pct * d : pct / d; }
/** A product's declared grade against a recipe's analysis (R62; push 7c: each label nutrient has its basis, R72).
 *  declared: [{ label, pct, tol, measure }]; N: engine.nutrients() (with basis and rho). Each row: meets (got >= label - tolerance),
 *  below (by how much), or unknown (analysis not complete, a density missing, or the product density missing for a label on the
 *  other basis: why says which). A nutrient no material carries is 0 when complete. While not complete, a low figure is unknown
 *  (review 7a, M3); one already at the label stays meets. */
function gradeCheck(declared, N, rho) {
  const F = new Map(((N && N.fields) || []).map(f => [String(f.field).toLowerCase(), f])); const nb = (N && N.basis) || 'w/w', r0 = rho != null ? rho : N && N.rho;
  const rows = (declared || []).map(d => {
    const f = F.get(String(d.label).toLowerCase()); const pct = Number(d.pct), tol = Number(d.tol) || 0; const lb = d.measure === 'w/v' || d.measure === 'w/w' ? d.measure : nb;
    let got = null, why = null;
    if (f && !(f.missing || []).length && !(f.noDensity || []).length && f.pct != null) got = f.pct; else if (!f && N && N.complete) got = 0;
    else if (f && (f.noDensity || []).length) why = `density of ${f.noDensity.join(', ')} missing`;
    if (got != null && got !== 0 && lb !== nb) { const c = toBasis(got, nb, lb, r0); /* 0 is 0 on either basis (review 7c, minor 1) */ if (c == null) { got = null; why = 'the product density is missing (the label is ' + lb + ')'; } else got = c; }
    if (got != null && !(N && N.complete) && got < pct - tol - 1e-9) got = null;
    const state = got == null ? 'unknown' : got >= pct - tol - 1e-9 ? 'meets' : 'below';
    return { label: d.label, pct, tol, measure: lb, got, state, why: state === 'unknown' ? (why || 'the analysis is not complete') : null, by: state === 'below' ? round(pct - got, 2) : 0 };
  });
  return { rows, state: !rows.length ? 'none' : rows.some(r => r.state === 'below') ? 'below' : rows.some(r => r.state === 'unknown') ? 'unknown' : 'meets' };
}
module.exports = {
  newMaterialClass, fieldLabel, safeLabel, MEASURES, cleanNutrient, nutrientBackfill, gradeCheck, BASES, perUnitPct, toBasis,
  rowNameKey, looseKey, rowSize, masterCmp, sameRegion,
  listRowIs, listRowSize, officialRow, officialPack, restoreRow,
  round, rateWarning, materialCost, recipeTotal, packingPerUnit, buyOf, buyNote, sourceText, piecePrice, printMrp, mrpIssues, mrpMissing, pickConversionRule, conversionFor, costBreakdown,
  marginPct, targetPrice, contributionFloor, fedPct, netPoPrice, needsReapproval, exposure, flag,
  RECIPE_FLOW, RECIPE_FLOW_OTHER, lineSig, resendTo, RECIPE_WHO, fmtInt, fmtRs2, pkToday, pkNow, FAMILY_COLOURS, familyColour, CATS, FARMER_LINE, buyerLine, targetOr, priceCountsForPo, REAPPROVE_DEFAULT,
};
