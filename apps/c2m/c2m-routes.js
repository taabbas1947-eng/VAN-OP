/* ============================================================================
 * C2M: Cost to Margin. Routes. Mounted by the platform with 1 line:
 *   require('./apps/c2m/c2m-routes')(app, { pdq, pool, auth, path, fs, crypto });
 *   pool (the platform's mysql2 promise pool) is REQUIRED: C2M refuses to start without it.
 * Every /api/c2m/* route needs the platform sign-in (auth) and a c2m role from
 * user_module_roles. C2M reads O2S's app_state but never writes to it.
 * API reference: docs/05-api.md. Rules: docs/09-formulas-and-rules.md.
 * ==========================================================================*/
'use strict';
const { AsyncLocalStorage } = require('async_hooks');
const lib = require('./c2m-lib');
const engine = require('./c2m-engine');
const { pullO2S } = require('./c2m-o2s');
const PL = require('./c2m-pricelist');

/* Roles (stored in user_module_roles, module 'c2m'). Access matrix: docs/11-access-and-roles.md */
const ROLES = {
  // 0.8.0 places (Tahir's screen rulings 1, 3, 4 and 5, 18 Oct 2026); 0.9.0 adds Reports for Yawar and Tahir (D-53). Screens only: rights stay in the routes below.
  // 1.0.0 (Tahir, 19 Oct 2026, D-76): 5 places; the places not yet ruled on sit under More (Reports, Inputs with nutrients, Back office, Guide)
  cfo: { label: 'CFO', nav: ['approvals', 'products', 'prices', 'margin', 'setup'], more: ['reports', 'inputs', 'backoffice', 'guide'] },
  coo: { label: 'COO', nav: ['approvals', 'products', 'prices', 'margin', 'setup'], more: ['reports', 'inputs', 'backoffice', 'guide'] },
  production: { label: 'Production Manager', nav: ['today', 'recipes', 'guide'] },
  qc: { label: 'QC Head', nav: ['today', 'recipes', 'inputs', 'guide'] }, // Inputs, Materials: nutrient % and class, no rates (ruled 16 Oct; ruling 4, 18 Oct)
  plant: { label: 'Plant Manager', nav: ['today', 'recipes', 'guide'] },
  viewer: { label: 'Price list viewer', nav: ['lists', 'guide'] },
};
const SEES_COST = new Set(['cfo', 'coo', 'production', 'plant']);
const SEES_PRICE = new Set(['cfo', 'coo']);
const STEP_ROLE = lib.RECIPE_WHO; // draft->production, review->qc, endorse->plant, cost->cfo

module.exports = function mountC2mRoutes(app, deps) {
  const { auth, path, fs } = deps;
  // Without the pool, every approval would run without a transaction and the "someone else changed this"
  // guards would silently stop working (handover review, 16 Oct). Refuse to start instead.
  // A wrong mount must not take the platform down: C2M answers 503 with the reason and O2S and PD carry on (re-review).
  const mountFault = !deps.pool || typeof deps.pool.getConnection !== 'function' ? 'C2M is not set up: the platform must mount it with its mysql2 promise pool { pdq, pool, auth, path, fs, crypto }. Ask IT.'
    : typeof deps.pdq !== 'function' || typeof auth !== 'function' ? 'C2M is not set up: pdq and auth are missing from the mount. Ask IT.' : null;
  if (mountFault) {
    console.error('[c2m] ' + mountFault);
    app.use(['/c2m', '/api/c2m'], (req, res) => res.status(503).json({ error: mountFault }));
    return;
  }
  // C2M compares dates as text, so DATE and DATETIME must come back as strings (dateStrings: true), on pdq and on the pool.
  let dateCheck = null;
  const checkDates = () => (dateCheck = dateCheck || (async () => {
    const sql = "SELECT CAST('2026-01-02' AS DATE) d, CAST('2026-01-02 03:04:05' AS DATETIME) t";
    const [[a]] = await deps.pdq(sql); const c = await deps.pool.getConnection(); let b; try { [[b]] = await c.execute(sql); } finally { c.release(); }
    return [a.d, a.t, b.d, b.t].every(v => typeof v === 'string') ? null : 'C2M needs the database pool to return dates as text (mysql2 option dateStrings: true). Ask IT.';
  })().catch(e => { dateCheck = null; throw e; }));
  checkDates().then(f => f && console.error('[c2m] ' + f)).catch(() => {});
  const now = () => lib.pkNow();     // Pakistan time (audit finding 9)
  const today = () => lib.pkToday();
  /* Every query goes through q: undefined becomes NULL (review S9), and inside tx() it runs on the
   * transaction's connection. Without deps.pool C2M answers 503 (mountFault above); the check in tx() is only a guard. */
  const txStore = new AsyncLocalStorage();
  const clean = p => Array.isArray(p) ? p.map(v => (v === undefined ? null : v)) : p;
  const q = (sql, p) => { const c = txStore.getStore(); return c ? c.execute(sql, clean(p)) : deps.pdq(sql, clean(p)); };
  /** Placeholders for a list, e.g. IN (?,?,?): prepared statements (the platform's pool.execute) cannot take an array for 1 ?. */
  const qs = a => a.map(() => '?').join(',');
  async function tx(fn) {
    if (!deps.pool || txStore.getStore()) return fn();
    const c = await deps.pool.getConnection();
    try { await c.beginTransaction(); const r = await txStore.run(c, fn); await c.commit(); return r; }
    catch (e) { await c.rollback().catch(() => {}); throw e; }
    finally { c.release(); }
  }
  const moved = () => Object.assign(new Error('Someone else changed this a moment ago. Check before retrying.'), { status: 409 });
  const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) && !isNaN(Date.parse(d));

  /* ---------- Access: c2m role from the platform's role registry ---------- */
  async function c2mAuth(req, res, next) {
    try {
      const [[r]] = await q("SELECT role FROM user_module_roles WHERE username=? AND module='c2m'", [req.user.u]);
      if (!r || !ROLES[r.role]) return res.status(403).json({ error: 'You do not have access to C2M. Ask Tahir to grant it in People and access.' });
      req.c2m = { role: r.role, user: req.user.u, name: req.user.n || req.user.name || req.user.u };
      next();
    } catch (e) { next(e); }
  }
  const need = (...roles) => (req, res, next) => roles.includes(req.c2m.role) ? next() : res.status(403).json({ error: 'Your role cannot do this in C2M.' });
  const wrap = fn => (req, res) => fn(req, res).catch(e => {
    if (e && (e.errno === 1213 || e.errno === 1205 || e.code === 'ER_LOCK_DEADLOCK' || e.code === 'ER_LOCK_WAIT_TIMEOUT')) e = moved();
    if (e && e.code === 'ER_NO_SUCH_TABLE') { e = Object.assign(new Error('C2M tables are not installed yet. Ask IT to run the C2M migration.'), { status: 503 }); }
    if (!e.status) console.error('[c2m]', e);
    if (res.headersSent) return res.end();
    res.status(e.status || 500).json({ error: e.status ? e.message : 'Something went wrong. Nothing was saved.' });
  });
  const bad = msg => Object.assign(new Error(msg), { status: 400 });
  async function audit(by, entity, id, action, oldV, newV, why) {
    await q('INSERT INTO c2m_audit (at, by_user, entity, entity_id, action, old_value, new_value, why) VALUES (?,?,?,?,?,?,?,?)',
      [now(), by, entity, id == null ? null : String(id), action, oldV == null ? null : JSON.stringify(oldV), newV == null ? null : JSON.stringify(newV), why || null]);
  }
  /** After a change (packing bill, rule, correction), batch every pack whose cost now differs from its
   *  approved cost by more than the threshold, once per cause (ruled 10 Oct). Packs already waiting are left out. */
  async function reapprovalFor(cause, filter) {
    const D = await engine.loadAll(q); const S = D.settings.values;
    const [open] = await q("SELECT items_json FROM c2m_reapproval WHERE status='open'");
    const waiting = new Set(); open.forEach(r => JSON.parse(r.items_json).forEach(i => waiting.add(i.packId)));
    const items = [];
    for (const p of D.packs) {
      if (waiting.has(p.id) || (filter && !filter(p))) continue;
      const av = engine.latestApproved(D, p.id);
      const c = engine.packCost(D, p); if (!c || !c.costed) continue;
      if (av && !lib.needsReapproval(Number(av.total), c.total, S.reapprove_pct)) continue;
      const cp = D.cpById.get(p.client_product_id); const label = `${cp.brand} ${Number(p.pack_size)} ${cp.sold_per} for ${D.custById.get(cp.customer_id).name}`;
      // A costed pack with no approved cost yet (e.g. a packing bill just assigned) waits here for its first approved cost (D-41)
      items.push(av ? { packId: p.id, label, from: Number(av.total), to: c.total, pct: (c.total - Number(av.total)) / Number(av.total) * 100 } : { packId: p.id, label, from: null, to: c.total, pct: null, first: true });
    }
    if (items.length) await q('INSERT INTO c2m_reapproval (cause, items_json, created_at) VALUES (?,?,?)', [cause.slice(0, 300), JSON.stringify(items), now()]);
    return items.length;
  }
  /** C2M's own sales and cost of trucks out in a month (YYYY-MM), from O2S trucks and the approved cost on each truck's date;
   *  FOC lines (price 0) are kept apart (D-62, D-64). */
  async function monthFigures(month) {
    const D = await engine.loadAll(q); const match = engine.matcher(D);
    const [rows] = await q('SELECT t.truck_date, t.kg, p.customer_name, p.channel, p.brand, p.pack, p.net_price FROM c2m_o2s_truck t JOIN c2m_o2s_po_line p ON p.line_id=t.line_id WHERE t.truck_date>=? AND t.truck_date<?', [month + '-01', dayAfterMonth(month)]);
    const out = { sales: 0, cogs: 0, uncosted: 0, focCost: 0 };
    for (const r of rows) { const pk = match(r.customer_name, r.brand, r.channel, r.pack); const v = pk ? engine.versionOnDate(D, pk.id, r.truck_date) : null; const kg = Number(r.kg), pr = Number(r.net_price);
      if (!(pr > 0)) { if (v) out.focCost += kg * Number(v.total); continue; }
      out.sales += kg * pr; if (v) out.cogs += kg * Number(v.total); else out.uncosted += kg * pr; }
    return out;
  }
  const dayAfterMonth = m => { const [y, mo] = m.split('-').map(Number); return mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, '0')}-01`; };
  /** Packs that would have no labour or no FOH rate today (review S2). */
  function packsWithoutRates(D, filter) {
    const out = [];
    for (const p of D.packs) {
      if (filter && !filter(p)) continue;
      const cp = D.cpById.get(p.client_product_id); if (!cp) continue;
      const cv = lib.conversionFor({ clientProductId: cp.id, baseProductId: cp.base_product_id, form: cp.form, reprocessed: cp.reprocessed, packSize: Number(p.pack_size), onDate: today() }, D.rules);
      const noL = !cv.labour || !(Number(cv.labour.rsPerKg) > 0), noF = !cv.foh || !(Number(cv.foh.rsPerKg) > 0); // Rs 0 = missing (I-20)
      if (noL || noF) out.push(`${cp.brand} ${Number(p.pack_size)} ${cp.sold_per} (no ${noL ? 'labour' : 'FOH'} rate)`);
    }
    return out;
  }
  /** Approved prices in force on a date: started on or before it, and valid_to (the LAST day in force) not passed (5j 6). */
  function inForce(prices, date) {
    const m = new Map();
    prices.filter(p => p.status === 'approved' && String(p.valid_from).slice(0, 10) <= date && (!p.valid_to || String(p.valid_to).slice(0, 10) >= date))
      .sort((a, b) => String(a.valid_from).localeCompare(String(b.valid_from)) || a.id - b.id).forEach(p => m.set(p.client_pack_id, p));
    return m;
  }
  const dayBefore = d => { const t = new Date(String(d).slice(0, 10) + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() - 1); return t.toISOString().slice(0, 10); };
  async function priceInForce(packId) { const [ps] = await q('SELECT * FROM c2m_price WHERE client_pack_id=?', [packId]); return inForce(ps, today()).get(Number(packId)) || null; }
  /** Put back the end date an approval ahead had moved on the price it shortened (withdraw or cancel). */
  async function restoreCut(w, by, why) {
    if (!w.cut_price_id) return;
    const [[c]] = await q('SELECT id, valid_to, status FROM c2m_price WHERE id=? FOR UPDATE', [w.cut_price_id]); if (!c) return;
    await q("UPDATE c2m_price SET valid_to=?, status=IF(status='replaced','approved',status) WHERE id=?", [w.cut_prev_to || null, c.id]);
    await audit(by, 'price', c.id, 'end restored', c.valid_to, w.cut_prev_to || null, `Price ${w.id} ${why}`);
  }
  /** References of issued price lists whose rows carry this price for this pack, dated on or after its start. */
  async function docsShowingPrice(p) {
    const [docs] = await q("SELECT ref, effective, fields_json FROM c2m_price_doc WHERE audience='wl' AND effective>=?", [String(p.valid_from).slice(0, 10)]);
    return docs.filter(d => { try { return (JSON.parse(d.fields_json).snapshot.wl || []).some(r => Number(r.packId) === Number(p.client_pack_id) && Number(r.cur) === Number(p.price)); } catch (_) { return false; } }).map(d => d.ref);
  }
  async function notice(forRole, text, by) { await q('INSERT INTO c2m_notice (for_role, text, by_user, at) VALUES (?,?,?,?)', [forRole, text, by, now()]); }
  /** A cost input that moves GP (labour and FOH rates, packing bills, product type, reprocessed) is saved by Yawar alone;
   *  Tahir is told each time, with how many packs moved (cost review 18 Oct 2026, D-63; ruling 12). */
  async function costNotice(by, what, re) { await notice('coo', `${what}. ${re ? `${re} pack(s) moved more than the re-approval % and wait in a re-approval item for Yawar.` : 'No pack moved more than the re-approval %.'}`, by); }
  /** The person who proposed never approves (ruling 19; cost review 18 Oct 2026, D-63). */
  const notSelf = (proposer, user) => { if (proposer && String(proposer).toLowerCase() === String(user).toLowerCase()) throw Object.assign(new Error('You proposed this, so another person approves it (ruling 19).'), { status: 403 }); };

  /* ---------- Page ---------- */
  app.get(['/c2m', '/c2m/'], (req, res) => { res.set('Cache-Control', 'no-store'); res.sendFile(path.join(__dirname, 'c2m.html')); });
  app.get('/c2m/assets/van-logo.png', (req, res) => res.sendFile(path.join(__dirname, 'assets', 'van-logo.png')));
  app.use('/api/c2m', (req, res, next) => checkDates().then(f => f ? res.status(503).json({ error: f }) : next(), () => res.status(503).json({ error: 'C2M cannot reach the database. Try again in a minute.' })), auth, c2mAuth);

  app.get('/api/c2m/me', (req, res) => res.json({ user: req.c2m.user, name: req.c2m.name, role: req.c2m.role, label: ROLES[req.c2m.role].label, nav: ROLES[req.c2m.role].nav, more: ROLES[req.c2m.role].more || [] }));

  /* ---------- Shared data builder ---------- */
  async function build(role, user) {
    const D = await engine.loadAll(q);
    const S = D.settings.values;
    const seeCost = SEES_COST.has(role), seePrice = SEES_PRICE.has(role);
    const match = engine.matcher(D);
    await applyDueRevisions();
    const [prices] = await q('SELECT * FROM c2m_price ORDER BY id');
    const approvedPrice = inForce(prices, today()); const nextPrice = new Map();
    prices.filter(p => p.status === 'approved' && String(p.valid_from).slice(0, 10) > today()).sort((a, b) => String(b.valid_from).localeCompare(String(a.valid_from))).forEach(p => nextPrice.set(p.client_pack_id, p)); // earliest wins
    const [poLines] = await q('SELECT * FROM c2m_o2s_po_line ORDER BY received, po');
    const lastPo = new Map(); poLines.forEach(l => { const p = match(l.customer_name, l.brand, l.channel, l.pack); if (p && l.net_price > 0 && !engine.isVanBrand(D.cpById.get(p.client_product_id))) lastPo.set(p.id, Number(l.net_price)); }); // a VAN brand pack is priced per channel by its lists (D-44)

    const products = D.cps.map(cp => {
      const cust = D.custById.get(cp.customer_id) || {};
      const appr = engine.approvedVersion(D, cp.id), latest = engine.latestVersion(D, cp.id);
      const packs = D.packs.filter(p => p.client_product_id === cp.id).map(p => {
        const c = engine.packCost(D, p); const av = engine.latestApproved(D, p.id);
        const ap = approvedPrice.get(p.id);
        /* A pack that had an approved price which has ended, with none in force today, has no price: it does not fall back to
           the last O2S PO price, so it shows on "costed, no price" (ruling 3; cost review 18 Oct 2026, D-62). */
        const ended = ap ? null : prices.filter(x => x.client_pack_id === p.id && x.status === 'approved' && String(x.valid_from).slice(0, 10) <= today() && x.valid_to && String(x.valid_to).slice(0, 10) < today()).sort((a, b) => String(b.valid_to).localeCompare(String(a.valid_to)))[0] || null;
        const price = ap ? Number(ap.price) : ended ? null : (lastPo.get(p.id) ?? null);
        const out = { id: p.id, size: Number(p.pack_size), billId: p.packing_bill_id };
        if (seeCost) Object.assign(out, { cost: c && c.costed ? { materials: c.materials, packing: c.packing, conversion: c.conversion, freight: c.freight, total: c.total, rule: c.rule ? c.rule.name : null } : null, costGaps: c && !c.costed ? c.gaps : null,
          approvedCost: av ? Number(av.total) : null, floor: c && c.costed ? lib.contributionFloor(c) : null, labour: c && c.costed ? c.labour : null,
          sheet: (() => { const v = (D.verByPack.get(p.id) || []).filter(x => /^Yawar's Master Cost Sheet/.test(x.cause)).pop(); return v ? { materials: Number(v.materials), packing: Number(v.packing), conversion: Number(v.conversion), total: Number(v.total) } : null; })() });
        const np = nextPrice.get(p.id);
        if (seePrice) Object.assign(out, { price, priceSource: ap ? 'approved' : (price != null ? 'O2S PO' : null), priceEnded: ended ? { price: Number(ended.price), till: String(ended.valid_to).slice(0, 10) } : null, lastPoPrice: lastPo.get(p.id) ?? null, prevPrice: ap && ap.prev_price != null ? Number(ap.prev_price) : null, priceFrom: ap ? ap.valid_from : null, priceTill: ap && ap.valid_to ? String(ap.valid_to).slice(0, 10) : null,
          nextPrice: np ? { id: np.id, price: Number(np.price), from: String(np.valid_from).slice(0, 10) } : null, waitingProposal: prices.some(x => x.client_pack_id === p.id && x.status === 'proposed') });
        return out;
      });
      return { id: cp.id, customer: cust.name, customerId: cust.id, typeId: cp.base_product_id, fam: lib.familyColour(cp.base_product_id, D.productTypes), typeName: ((D.productTypes || []).find(t => Number(t.id) === Number(cp.base_product_id)) || {}).name || null, reprocessed: !!Number(cp.reprocessed), grp: cp.channel === 'White label' ? 'White label' : 'VAN brand', channel: cp.channel, brand: cp.brand, spec: cp.spec, o2sNames: role === 'cfo' || role === 'coo' ? String(cp.o2s_brand).split('|').filter(Boolean) : undefined,
        form: cp.form, soldPer: cp.sold_per, packingMode: cp.packing_mode, target: seePrice || role === 'cfo' ? (cp.target_gp == null ? null : Number(cp.target_gp)) : undefined,
        budget: seePrice ? (cp.budget_gp == null ? null : Number(cp.budget_gp)) : undefined, budgetKg: seePrice && cp.budget_kg_year != null ? Number(cp.budget_kg_year) : undefined, recipeState: latest ? latest.state : null, approvedVersionId: appr ? appr.id : null, latestVersionId: latest ? latest.id : null, packs };
    });

    const recipes = [...D.recipes.byVer.values()].filter(v => D.cpById.has(v.client_product_id)).map(v => { // a product out of use takes its recipes off the screens too (kept in the database; review 1.0.2 re-check 2, A1)
      const cp = D.cpById.get(v.client_product_id); const cust = cp ? D.custById.get(cp.customer_id) : null;
      const pr = engine.priceRecipe(D, v);
      const lines = pr.lines.map(l => ({ gradeId: l.gradeId, name: l.name, grade: l.grade, qty: l.qty, ...(seeCost ? { rate: l.rate, date: l.date, cost: l.cost } : {}) }));
      return { id: v.id, clientProductId: v.client_product_id, customer: cust ? cust.name : '?', brand: cp ? cp.brand : '?', version: v.version_no, state: v.state, note: v.note,
        sentBack: v.sent_back_by ? { by: v.sent_back_by, state: v.sent_back_state, reason: v.sent_back_reason, advice: v.sent_back_advice } : null,
        lines, kgTotal: pr.kgTotal, materials: seeCost ? pr.materials : undefined, nutrients: engine.nutrients(pr), steps: v.steps };
    });

    // Settings (budget and ambition GP, thresholds) go to Yawar and Tahir only (review S9)
    const out = { me: { user, role, label: ROLES[role].label, nav: ROLES[role].nav, more: ROLES[role].more || [] }, settings: ['cfo', 'coo'].includes(role) ? D.settings.rows : [], fedPct: lib.fedPct(D.settings.values.fed_pct), products, recipes, today: today() };
    if (['qc', 'cfo', 'coo'].includes(role)) {
      // Material master without rates: Himayat's screen (ruled 16 Oct)
      out.materials = [...D.rates.values()].map(g => ({ gradeId: g.gradeId, materialId: g.materialId, name: g.name, grade: g.grade, unit: g.unit, typeId: g.typeId, type: g.type, role: g.role, fields: g.fields, nutrients: g.nutrients }));
      const [mt] = await q('SELECT id, name, nutrient_fields, nutrient_role FROM c2m_material_type ORDER BY nutrient_role, name'); out.materialTypes = mt;
    }
    if (role === 'viewer') {
      const [grants] = await q('SELECT grant_kind, grant_value FROM c2m_list_grant WHERE username=?', [user]);
      out.grants = grants;
      const [lp] = await q('SELECT list_name, data_json, issued, valid_till FROM c2m_list_price ORDER BY id');
      const lg = grants.filter(g => g.grant_kind === 'list').map(g => g.grant_value);
      const farmerCols = [['farmer_pb', 'pb'], ['web', 'pb'], ['farmer_sn', 'sn'], ['farmer_snc', 'snc']].filter(([a]) => lg.includes(a)).map(([, c]) => c);
      const L = groupLists(lp, farmerCols), may = new Set(lg.map(g => PL.AUDIENCES[g] ? listOf(g) : null));
      out.lists = { issued: L.issued, till: L.till, dates: L.dates, dist: may.has('dist') ? L.dist : [], dealer: may.has('dealer') ? L.dealer : [], farmer: may.has('farmer') ? L.farmer : [] };
      out.wlLists = await wlListData(D, approvedPrice, grants.filter(g => g.grant_kind === 'client').map(g => g.grant_value));
      out.products = []; out.recipes = [];
      return out;
    }
    const [rv] = await q("SELECT * FROM c2m_reapproval WHERE status='open' ORDER BY id");
    if (role === 'cfo' || role === 'coo') out.reapprovals = rv.map(r => ({ id: r.id, cause: r.cause, items: JSON.parse(r.items_json), createdAt: r.created_at }));
    if (seeCost) {
      out.rates = [...D.rates.values()].map(g => ({ gradeId: g.gradeId, name: g.name, grade: g.grade, unit: g.unit, type: g.type, fields: g.fields, nutrients: g.nutrients, rate: g.rate, date: g.date, source: g.source, history: g.history.slice(0, 6) }));
      out.packingItems = [...D.packing.itemById.values()];
      out.packingBills = [...D.packing.billById.values()];
      out.rules = D.rules;
      out.productTypes = D.productTypes;
      if (!out.materialTypes) { const [mt] = await q('SELECT id, name, nutrient_fields, nutrient_role FROM c2m_material_type ORDER BY nutrient_role, name'); out.materialTypes = mt; }
    }
    if (role === 'cfo' || role === 'coo') {
      const [sales] = await q(`SELECT t.id, t.truck_date, t.kg, t.po, t.dc, p.customer_name, p.channel, p.brand, p.pack, p.net_price FROM c2m_o2s_truck t JOIN c2m_o2s_po_line p ON p.line_id=t.line_id ORDER BY t.truck_date`);
      const custOf = name => { const k = String(name == null ? '' : name).trim().toLowerCase(); return k ? D.customers.find(c => String(c.o2s_names).split('|').some(n => n.trim() && n.trim().toLowerCase() === k)) : null; }; // an empty name never matches (the VAN brand owner row has none)
      /* FOC (free) lines are not sales: they carry cost against Rs 0 and would pull GP down. They are kept out of sales,
         GP and exposure and shown on their own (ruling 14b; cost review 18 Oct 2026, D-62). */
      out.foc = [];
      out.sales = sales.filter(s => { if (Number(s.net_price) > 0) return true;
        const p = match(s.customer_name, s.brand, s.channel, s.pack); const cp = p ? D.cpById.get(p.client_product_id) : null; const v = p ? engine.versionOnDate(D, p.id, s.truck_date) : null;
        const cust = cp && !engine.isVanBrand(cp) ? D.custById.get(cp.customer_id) : custOf(s.customer_name);
        const fgrp = s.channel === 'White Label' ? 'White label' : 'VAN brand', fbl = lib.buyerLine(fgrp, cp && !engine.isVanBrand(cp) ? cp.channel : (engine.CHANNEL_NAME[s.channel] || s.channel), cust ? cust.name : s.customer_name);
        out.foc.push({ date: s.truck_date, cust: fbl.line, cat: fbl.cat, grp: fgrp, brand: s.brand, pack: Number(s.pack), packId: p ? p.id : null, po: s.po, kg: Number(s.kg), cost: v ? Number(v.total) : null });
        return false; }).map(s => {
        const p = match(s.customer_name, s.brand, s.channel, s.pack); const cp = p ? D.cpById.get(p.client_product_id) : null; const van = engine.isVanBrand(cp);
        const cust = cp && !van ? D.custById.get(cp.customer_id) : custOf(s.customer_name); // VAN brand: the buyer, not the product's owner (D-44)
        const v = p ? engine.versionOnDate(D, p.id, s.truck_date) : null; const cost = v ? Number(v.total) : null;
        const nowC = p ? engine.packCost(D, p) : null;
        const costBands = v && nowC && nowC.costed && /^Yawar's/.test(v.cause) ? Number(v.total) - Number(v.conversion) + nowC.conversion : cost;
        const grp = s.channel === 'White Label' ? 'White label' : 'VAN brand', ch = cp && !van ? cp.channel : (engine.CHANNEL_NAME[s.channel] || s.channel);
        const bl = lib.buyerLine(grp, ch, cust ? cust.name : s.customer_name); // D-74: farmers and others pooled, never named in C2M
        return { date: s.truck_date, cust: bl.line, cat: bl.cat, grp, ch, region: cust && bl.cat !== 'farm' ? cust.region || null : null, brand: s.brand, pack: Number(s.pack),
          packId: p ? p.id : null, po: s.po, dc: s.dc, kg: Number(s.kg), price: Number(s.net_price), cost, costBands, target: cp && cp.target_gp != null ? Number(cp.target_gp) : null, budget: cp && cp.budget_gp != null ? Number(cp.budget_gp) : null };
      });
      const um = new Map();
      for (const x of out.sales) if (!x.packId) { const k = `${x.cust}|${x.brand}|${x.pack}`; const u = um.get(k) || { cust: x.cust, brand: x.brand, pack: x.pack, grp: x.grp, kg: 0, rs: 0 }; u.kg += x.kg; u.rs += x.kg * x.price; um.set(k, u); }
      out.unmatched = [...um.values()].sort((a, b) => b.rs - a.rs);
      out.open = poLines.filter(l => Number(l.open_kg) > 0 && Number(l.net_price) > 0).map(l => { // FOC lines are not sales (ruling 14b)
        const p = match(l.customer_name, l.brand, l.channel, l.pack); const cp = p ? D.cpById.get(p.client_product_id) : null; const cust = cp && !engine.isVanBrand(cp) ? D.custById.get(cp.customer_id) : custOf(l.customer_name);
        const c = p ? engine.packCost(D, p) : null;
        const ogrp = l.channel === 'White Label' ? 'White label' : 'VAN brand', obl = lib.buyerLine(ogrp, cp && !engine.isVanBrand(cp) ? cp.channel : (engine.CHANNEL_NAME[l.channel] || l.channel), cust ? cust.name : l.customer_name);
        return { cust: obl.line, cat: obl.cat, grp: ogrp, brand: l.brand, pack: Number(l.pack), packId: p ? p.id : null, po: l.po, received: l.received,
          kg: Number(l.open_kg), price: Number(l.net_price), cost: c && c.costed ? c.total : null, target: cp && cp.target_gp != null ? Number(cp.target_gp) : null };
      });
      out.proposals = prices.filter(p => p.status !== 'approved' || p.decided_at).slice(-60).map(p => ({ id: p.id, packId: p.client_pack_id, price: Number(p.price), prev: p.prev_price == null ? null : Number(p.prev_price), status: p.status,
        reason: p.reason, belowReason: p.below_target_reason, backReason: p.back_reason, by: p.proposed_by, at: p.proposed_at, decidedBy: p.decided_by, decidedAt: p.decided_at, from: p.valid_from, to: p.valid_to || null }));
      // 0.9.0 (read only, no new table): every approved price with its dates, for Price history and the PO price report (R3)
      // 'replaced' with no send-back reason = approved, then ended by a newer price (review 18 Oct, finding 1)
      out.priceHistory = prices.filter(p => p.status === 'approved' || (p.status === 'replaced' && !p.back_reason && p.decided_at)).map(p => ({ id: p.id, packId: p.client_pack_id, price: Number(p.price), prev: p.prev_price == null ? null : Number(p.prev_price), from: String(p.valid_from).slice(0, 10), to: p.valid_to ? String(p.valid_to).slice(0, 10) : null,
        reason: p.reason, by: p.proposed_by, at: p.proposed_at, decidedBy: p.decided_by, decidedAt: p.decided_at }));
      // Every O2S PO line placed on a client pack (open and shipped), for the PO price report (R3); FOC lines (price 0) are marked
      const fy0 = (() => { const t = today(), y = +t.slice(0, 4), m = +t.slice(5, 7); return (m >= 7 ? y : y - 1) + '-07-01'; })();
      // this financial year only (review 18 Oct, finding 10)
      out.poLines = poLines.filter(l => l.received && String(l.received).slice(0, 10) >= fy0).map(l => { const p = match(l.customer_name, l.brand, l.channel, l.pack); const cp = p ? D.cpById.get(p.client_product_id) : null; const cust = cp && !engine.isVanBrand(cp) ? D.custById.get(cp.customer_id) : custOf(l.customer_name);
        const pgrp = l.channel === 'White Label' ? 'White label' : 'VAN brand', pbl = lib.buyerLine(pgrp, cp && !engine.isVanBrand(cp) ? cp.channel : (engine.CHANNEL_NAME[l.channel] || l.channel), cust ? cust.name : l.customer_name);
        return { po: l.po, received: l.received ? String(l.received).slice(0, 10) : null, cust: pbl.line, cat: pbl.cat, grp: pgrp, brand: l.brand, pack: Number(l.pack), packId: p ? p.id : null, kg: Number(l.ordered_kg), price: Number(l.net_price), foc: !(Number(l.net_price) > 0) }; });
      const [[ia]] = await q("SELECT MIN(at) at FROM c2m_recipe_step WHERE action='imported'"); out.importedAt = ia && ia.at ? String(ia.at) : null; // the day Yawar's sheets were loaded: age of the sheet items
      const [[nd]] = await q('SELECT COUNT(*) n FROM c2m_price_doc WHERE ref LIKE ?', [`VAN/PL/${today().slice(0, 4)}/%`]); out.nextDocRef = `VAN/PL/${today().slice(0, 4)}/${String(Number(nd.n) + 1).padStart(3, '0')}`;
      const [imp] = await q('SELECT * FROM c2m_import_item ORDER BY status, id'); out.imports = imp;
      const [sreq] = await q('SELECT * FROM c2m_setting_request ORDER BY id DESC LIMIT 20'); out.settingRequests = sreq;
      const [treq] = await q('SELECT r.*, c.brand, cu.name customer FROM c2m_target_request r JOIN c2m_client_product c ON c.id=r.client_product_id JOIN c2m_customer cu ON cu.id=c.customer_id ORDER BY r.id DESC LIMIT 30'); out.targetRequests = treq;
      const [nt] = await q("SELECT * FROM c2m_notice WHERE for_role=? ORDER BY id DESC LIMIT 20", [role]); out.notices = nt;
      const [gr] = await q('SELECT * FROM c2m_list_grant ORDER BY username'); out.grants = gr;
      const [people] = await q("SELECT a.username, a.name, r.role FROM user_module_roles r JOIN auth_users a ON a.username=r.username WHERE r.module='c2m'"); out.people = people;
      const [lp] = await q('SELECT list_name, data_json, issued, valid_till FROM c2m_list_price ORDER BY id'); out.lists = groupLists(lp);
      out.wlLists = await wlListData(D, approvedPrice, D.customers.filter(c => c.grp !== 'VAN brand').map(c => c.name));
      const [ma] = await q('SELECT * FROM c2m_monthly_actual ORDER BY month'); out.actuals = ma;
      const [mc] = await q('SELECT month, kind, data_json, done_by, done_at FROM c2m_monthly_check ORDER BY month'); out.checks = mc.map(c => ({ ...c, data: (() => { try { return c.data_json ? JSON.parse(c.data_json) : null; } catch (_) { return null; } })(), data_json: undefined }));
      const [src] = await q('SELECT * FROM c2m_source ORDER BY id'); out.sources = src;
      const [fm] = await q('SELECT * FROM c2m_field_map ORDER BY id'); out.fieldMap = fm;
      const [sr] = await q('SELECT * FROM c2m_sync_run ORDER BY id DESC LIMIT 1'); out.lastSync = sr[0] || null;
      const [au] = await q('SELECT at, by_user, entity, entity_id, action, why FROM c2m_audit ORDER BY id DESC LIMIT 60'); out.audit = au;
      const [nl] = await q("SELECT entity_id, by_user, at FROM c2m_audit WHERE entity='product_name' ORDER BY id DESC LIMIT 400"); out.nameLog = {}; for (const x of nl) if (!out.nameLog[x.entity_id]) out.nameLog[x.entity_id] = { by: x.by_user, at: x.at }; // last name change per product (D-85)
      { const [off] = await q("SELECT c.id, c.brand, c.o2s_brand, c.sold_per, GROUP_CONCAT(k.pack_size ORDER BY k.pack_size) sizes FROM c2m_client_product c LEFT JOIN c2m_client_pack k ON k.client_product_id=c.id WHERE c.channel='VAN brand' AND c.active=0 GROUP BY c.id, c.brand, c.o2s_brand, c.sold_per ORDER BY c.brand"); out.vanOff = off.map(r => ({ id: r.id, brand: r.brand, names: namesOf(r), soldPer: r.sold_per, sizes: String(r.sizes || '').split(',').filter(Boolean).map(Number) })); } // VAN brand products out of use (Tahir, 20 Oct 2026)
      out.freight = D.freight;
      const [li] = await q('SELECT id, list_name, data_json FROM c2m_list_price ORDER BY id'); out.listItems = li.map(r => ({ id: r.id, list: r.list_name, data: JSON.parse(r.data_json) }));
      const [lr] = await q("SELECT * FROM c2m_list_revision WHERE (status='approved' AND applied=0) OR id > (SELECT COALESCE(MAX(id), 0) - 30 FROM c2m_list_revision) ORDER BY id DESC"); const liById = new Map(li.map(r => [r.id, JSON.parse(r.data_json)]));
      out.listRevisions = lr.map(r => { const open = r.status === 'proposed' || r.status === 'sent_back' || (r.status === 'approved' && !Number(r.applied));
        return { ...r, items: JSON.parse(r.items_json).map(it => open ? itemNow(D, liById, it) : it), items_json: undefined }; }); /* a revision still open shows each row under its name today (review 1.0.2, design finding 5) */
      out.customers = D.customers.map(c => ({ id: c.id, name: c.name, grp: c.grp, segment: c.segment, priceRule: c.price_rule, cycle: c.price_cycle, region: c.region, o2sNames: c.o2s_names }));
      const [docs] = [fs.readdirSync(path.join(__dirname, 'docs')).filter(f => f.endsWith('.md')).sort()]; out.docs = docs;
    } else {
      out.docs = fs.readdirSync(path.join(__dirname, 'docs')).filter(f => docAllowed(role, f)).sort();
    }
    return out;
  }
  /** Which stored list an audience prints from: farmer_pb, farmer_sn, farmer_snc and web all use the farmer list. */
  /** Documentation by role (review S9): KAMs get the guide and access only; recipe roles add the process flows. */
  function docAllowed(role, f) { return ['cfo', 'coo'].includes(role) || /^07-|^11-/.test(f) || (role !== 'viewer' && /^01-/.test(f)); }
  function listOf(aud) { return aud === 'dist' ? 'dist' : aud === 'dealer' ? 'dealer' : aud === 'wl' ? 'wl' : 'farmer'; }
  /* Only price fields ever leave the server: the import pack carries cost and margin on some rows (review M1, 16 Oct). */
  const LIST_SAFE = ['p', 'd', 'pack', 'prev', 'now', 'fed', 'mrp', 'terms', 'nsv', 'disc', 'net', 'netfed', 'frp', 'pb', 'sn', 'snc'];
  const safeRow = (d, farmerCols) => Object.fromEntries(Object.entries(d).filter(([k]) => LIST_SAFE.includes(k) && (!farmerCols || !['pb', 'sn', 'snc'].includes(k) || farmerCols.includes(k))));
  function groupLists(lp, farmerCols) {
    const g = { dist: [], dealer: [], farmer: [], issued: null, till: null, dates: {} };
    lp.forEach(r => { (g[r.list_name] || []).push(safeRow(JSON.parse(r.data_json), r.list_name === 'farmer' ? farmerCols : null)); g.issued = r.issued; g.till = r.valid_till; g.dates[r.list_name] = { issued: r.issued, till: r.valid_till }; });
    return g;
  }
  async function wlListData(D, approvedPrice, clients) {
    const out = {};
    for (const name of clients) {
      const cust = D.customers.find(c => c.name === name); if (!cust) continue;
      const rows = [];
      for (const cp of D.cps.filter(c => c.customer_id === cust.id && c.channel === 'White label')) for (const p of D.packs.filter(x => x.client_product_id === cp.id)) {
        const ap = approvedPrice.get(p.id); if (!ap) continue;
        rows.push({ packId: p.id, typeId: cp.base_product_id == null ? null : Number(cp.base_product_id), fam: lib.familyColour(cp.base_product_id, D.productTypes), brand: cp.brand, spec: cp.spec, pack: `${Number(p.pack_size)} ${cp.sold_per}`, cur: Number(ap.price), prev: ap.prev_price == null ? null : Number(ap.prev_price), reason: ap.reason, from: String(ap.valid_from).slice(0, 10) });
      }
      out[name] = { name: cust.name, rule: cust.price_rule, rows };
    }
    return out;
  }

  app.get('/api/c2m/state', wrap(async (req, res) => { const out = await build(req.c2m.role, req.c2m.user); out.me.name = req.c2m.name; res.json(out); }));

  /* ---------- O2S pull (read only) ---------- */
  app.post('/api/c2m/sync', need('cfo', 'coo'), wrap(async (req, res) => {
    const stale = lib.pkNow(new Date(Date.now() - 10 * 60 * 1000));
    const [claim] = await q("UPDATE c2m_source SET status='Pulling', last_pull_note=? WHERE system_name='O2S' AND what LIKE 'Customers%' AND (status<>'Pulling' OR last_pull_note IS NULL OR last_pull_note < ?)", ['Pulling since ' + now(), 'Pulling since ' + stale]);
    if (!claim.affectedRows) throw Object.assign(new Error('A pull is already running. Wait a minute, then look again.'), { status: 409 });
    try {
      const r = await tx(async () => { const x = await pullO2S(q, req.c2m.user); await audit(req.c2m.user, 'sync', x.syncId, 'pull', null, { poLines: x.poLines, trucks: x.trucks }, 'Pull now'); return x; });
      res.json(r);
    } catch (e) {
      await q("UPDATE c2m_source SET status='Failed', last_pull_note=? WHERE system_name='O2S' AND what LIKE 'Customers%'", [String(e.message).slice(0, 250)]);
      throw e;
    }
  }));

  /* ---------- Recipes: write, review, endorse, approve cost, send back (ruling 13 to 14 Oct) ---------- */
  async function getVersion(id) { const [[v]] = await q('SELECT * FROM c2m_recipe_version WHERE id=?', [id]); if (!v) throw bad('Recipe version not found.'); return v; }
  async function step(vid, action, by, note) { await q('INSERT INTO c2m_recipe_step (recipe_version_id, action, by_user, at, note) VALUES (?,?,?,?,?)', [vid, action, by, now(), note || null]); }

  app.post('/api/c2m/recipes/new', need('production', 'cfo', 'coo'), wrap(async (req, res) => {
    const { clientProductId, fromVersionId, note } = req.body || {};
    const [[cp]] = await q('SELECT id, active FROM c2m_client_product WHERE id=?', [clientProductId]); if (!cp) throw bad('Pick a client product.');
    const outOfUse = () => bad('This product is out of use (Setup, Product names): put it back in use before writing a recipe version.'); if (!Number(cp.active)) throw outOfUse();
    if (fromVersionId) { const [[fv]] = await q('SELECT id FROM c2m_recipe_version WHERE id=? AND client_product_id=?', [fromVersionId, cp.id]); if (!fv) throw bad('Copy from a version of the same product.'); }
    const id = await tx(async () => {
      await lockNames(); { const [[a]] = await q('SELECT active FROM c2m_client_product WHERE id=?', [cp.id]); if (!Number(a.active)) throw outOfUse(); } // a product taken out of use at the same moment (review 1.0.2 re-check 3, finding 3)
      const [[open]] = await q("SELECT id FROM c2m_recipe_version WHERE client_product_id=? AND state IN ('draft','review','endorse','cost')", [cp.id]); // read under the lock: 2 people at once get the clear message (review 1.0.2 re-check 4, finding 4)
      if (open) throw bad('This product already has a version in progress. Finish or send it back first.');
      const [[mx]] = await q('SELECT COALESCE(MAX(version_no),0) n FROM c2m_recipe_version WHERE client_product_id=?', [cp.id]);
      const [ins] = await q("INSERT INTO c2m_recipe_version (client_product_id, version_no, state, note, created_by, created_at) VALUES (?,?,'draft',?,?,?)", [cp.id, mx.n + 1, String(note || 'New version').slice(0, 400), req.c2m.user, now()]);
      if (fromVersionId) { const [lines] = await q('SELECT grade_id, qty FROM c2m_recipe_line WHERE recipe_version_id=?', [fromVersionId]); for (const l of lines) await q('INSERT INTO c2m_recipe_line (recipe_version_id, grade_id, qty) VALUES (?,?,?)', [ins.insertId, l.grade_id, l.qty]); }
      await step(ins.insertId, 'written', req.c2m.user, note); await audit(req.c2m.user, 'recipe', ins.insertId, 'new', null, { clientProductId, version: mx.n + 1 }, note);
      return ins.insertId;
    });
    res.json({ id });
  }));

  app.post('/api/c2m/recipes/:id/lines', need('production'), wrap(async (req, res) => {
    const v = await getVersion(req.params.id); if (v.state !== 'draft') throw bad('Only a draft can be changed.');
    const lines = (req.body || {}).lines || [];
    if (!lines.length) throw bad('A recipe needs at least 1 input.');
    for (const l of lines) if (!(Number(l.qty) > 0) || !l.gradeId) throw bad('Every line needs a material and a quantity above 0.');
    const gids = lines.map(l => Number(l.gradeId)); const [gr] = await q(`SELECT id FROM c2m_material_grade WHERE id IN (${qs(gids)})`, gids);
    if (new Set(gr.map(g => g.id)).size !== new Set(lines.map(l => Number(l.gradeId))).size) throw bad('A material on this recipe is not in the master list.');
    await tx(async () => {
      const [[still]] = await q("SELECT id FROM c2m_recipe_version WHERE id=? AND state='draft' FOR UPDATE", [v.id]); if (!still) throw moved();
      const [old] = await q('SELECT grade_id, qty FROM c2m_recipe_line WHERE recipe_version_id=?', [v.id]);
      await q('DELETE FROM c2m_recipe_line WHERE recipe_version_id=?', [v.id]);
      for (const l of lines) await q('INSERT INTO c2m_recipe_line (recipe_version_id, grade_id, qty) VALUES (?,?,?)', [v.id, Number(l.gradeId), Number(l.qty)]);
      if ((req.body || {}).note) await q('UPDATE c2m_recipe_version SET note=? WHERE id=?', [String(req.body.note).slice(0, 400), v.id]);
      await audit(req.c2m.user, 'recipe', v.id, 'lines', old, lines, req.body.note);
    });
    res.json({ ok: true });
  }));

  app.post('/api/c2m/recipes/:id/advance', wrap(async (req, res) => {
    const v = await getVersion(req.params.id);
    if (STEP_ROLE[v.state] !== req.c2m.role) throw Object.assign(new Error('This step is not yours.'), { status: 403 });
    const [[n]] = await q('SELECT COUNT(*) n FROM c2m_recipe_line WHERE recipe_version_id=?', [v.id]); if (!n.n) throw bad('Add the recipe lines first.');
    let next = lib.RECIPE_FLOW[v.state];
    if (v.state === 'draft' && v.sent_back_state) next = v.sent_back_state; // resend goes straight back to whoever sent it back (ruled 14 Oct)
    if (next === 'approved') {
      const D0 = await engine.loadAll(q); const pr = engine.priceRecipe(D0, D0.recipes.byVer.get(v.id));
      if (pr.missingRate) throw bad('A material on this recipe has no rate. Enter its rate first, then approve the cost.');
      const gaps = packsWithoutRates(D0, p => p.client_product_id === v.client_product_id); if (gaps.length) throw bad(`No labour or FOH rate applies to: ${gaps.join('; ')}. Add the rate in Setup, Settings and targets first.`);
      // Every pack must be fully costed on this version: no Rs 0 or part-priced packing goes into a cost version (defect 1)
      const cp0 = D0.cpById.get(v.client_product_id), ver0 = D0.recipes.byVer.get(v.id), notCosted = [];
      if (!cp0) throw bad('This product is inactive. Make it active before approving its cost.');
      for (const p of D0.packs.filter(p => p.client_product_id === v.client_product_id)) { const c = engine.packCost(D0, p, { version: ver0 }); if (c && !c.costed) notCosted.push(`${cp0.brand} ${Number(p.pack_size)} ${cp0.sold_per}: ${c.gaps.join(', ')}`); }
      if (notCosted.length) throw bad(`The cost cannot be approved until every pack is fully costed. ${notCosted.join('; ')}. Fix the packing bill or price in Inputs first.`);
    }
    const act = { draft: v.sent_back_state ? 'resent' : 'sent', review: 'reviewed', endorse: 'endorsed', cost: 'cost_approved' }[v.state];
    await tx(async () => {
    const [u] = await q('UPDATE c2m_recipe_version SET state=?, sent_back_by=NULL, sent_back_state=NULL WHERE id=? AND state=?', [next, v.id, v.state]);
    if (!u.affectedRows) throw moved();
    await step(v.id, act, req.c2m.user, (req.body || {}).note);
    if (next === 'approved') {
      await q("UPDATE c2m_recipe_version SET state='old' WHERE client_product_id=? AND state='approved' AND id<>?", [v.client_product_id, v.id]);
      const D = await engine.loadAll(q);
      for (const p of D.packs.filter(p => p.client_product_id === v.client_product_id)) {
        const c = engine.packCost(D, p); if (!c || !c.costed) { const cpx = D.cpById.get(p.client_product_id); throw bad(`The cost cannot be approved: ${cpx ? cpx.brand + ' ' : ''}${Number(p.pack_size)} ${cpx ? cpx.sold_per : ''} is not fully costed (${c ? c.gaps.join(', ') : 'product inactive'}). Nothing was saved.`); } // checked again inside the transaction
        await q('INSERT INTO c2m_cost_version (client_pack_id, valid_from, materials, packing, conversion, freight, total, recipe_version_id, cause, approved_by) VALUES (?,?,?,?,?,?,?,?,?,?)',
          [p.id, now(), c.materials, c.packing, c.conversion, c.freight, c.total, v.id, `Recipe version ${v.version_no} approved`, req.c2m.user]);
      }
    }
    await audit(req.c2m.user, 'recipe', v.id, act, v.state, next, null);
    });
    res.json({ state: next });
  }));

  app.post('/api/c2m/recipes/:id/sendback', wrap(async (req, res) => {
    const v = await getVersion(req.params.id);
    if (!['review', 'endorse', 'cost'].includes(v.state) || STEP_ROLE[v.state] !== req.c2m.role) throw Object.assign(new Error('Only the person at this step can send it back.'), { status: 403 });
    const reason = String((req.body || {}).reason || '').trim(), advice = String((req.body || {}).advice || '').trim();
    if (!reason || !advice) throw bad('Write a reason and revision advice.');
    await tx(async () => {
      const [u] = await q("UPDATE c2m_recipe_version SET state='draft', sent_back_by=?, sent_back_state=?, sent_back_reason=?, sent_back_advice=? WHERE id=? AND state=?", [req.c2m.user, v.state, reason.slice(0, 400), advice.slice(0, 400), v.id, v.state]);
      if (!u.affectedRows) throw moved();
      await step(v.id, 'sent_back', req.c2m.user, reason + ' | Advice: ' + advice);
      await audit(req.c2m.user, 'recipe', v.id, 'sent_back', v.state, 'draft', reason);
    });
    res.json({ ok: true });
  }));

  /* ---------- Rates: try, then save; 10% warning; re-approval batched by cause ---------- */
  async function impactOfRate(gradeId, newRate) {
    const D = await engine.loadAll(q); const S = D.settings.values;
    const [opens] = await q('SELECT customer_name, brand, channel, pack, open_kg FROM c2m_o2s_po_line WHERE open_kg>0');
    const match = engine.matcher(D); const openByPack = new Map();
    opens.forEach(o => { const p = match(o.customer_name, o.brand, o.channel, o.pack); if (p) openByPack.set(p.id, (openByPack.get(p.id) || 0) + Number(o.open_kg)); });
    const out = [];
    for (const p of D.packs) {
      const cp = D.cpById.get(p.client_product_id); if (!cp) continue; // a pack of an inactive product is skipped, not a crash (defect 3)
      const v = engine.approvedVersion(D, cp.id);
      if (!v || !v.lines.some(l => l.gradeId === gradeId)) continue;
      const c0 = engine.packCost(D, p), c1 = engine.packCost(D, p, { rateOverride: { gradeId, rate: newRate } });
      if (!c1 || !c1.costed) continue;
      const nowC = c0 && c0.costed ? c0.total : null; // null: this is the material's first rate
      // The re-approval base is the approved cost, never today's cost (defect 4)
      const av = engine.latestApproved(D, p.id); const base = av ? Number(av.total) : null; // no approved cost yet: shown, never batched (as reapprovalFor)
      const ok = openByPack.get(p.id) || 0;
      out.push({ packId: p.id, label: `${cp.brand} ${Number(p.pack_size)} ${cp.sold_per} for ${D.custById.get(cp.customer_id).name}`, now: nowC, after: c1.total, pct: nowC ? (c1.total - nowC) / nowC * 100 : null,
        approved: base, pctApproved: base ? (c1.total - base) / base * 100 : null,
        reapprove: base != null && lib.needsReapproval(base, c1.total, S.reapprove_pct), openKg: ok, rsOnOpen: nowC != null ? (c1.total - nowC) * ok : null, priceForTarget: lib.targetPrice(c1.total, cp.target_gp == null ? null : Number(cp.target_gp)) });
    }
    return out;
  }
  app.post('/api/c2m/rates/try', need('cfo'), wrap(async (req, res) => {
    const { gradeId, rate } = req.body || {};
    const D = await engine.loadAll(q); const g = D.rates.get(Number(gradeId)); if (!g) throw bad('Material not found.');
    res.json({ warning: lib.rateWarning(g.rate, Number(rate), D.settings.values.rate_warn_pct), impact: await impactOfRate(Number(gradeId), Number(rate)) });
  }));
  const strictNum = v => (/^\s*\d+(\.\d+)?\s*$/.test(String(v)) ? Number(v) : NaN);
  async function saveRate(user, gradeId, rate, source, confirmed) {
    const D = await engine.loadAll(q); const g = D.rates.get(Number(gradeId)); if (!g) throw bad('Material not found.');
    const r = strictNum(rate); if (!(r > 0)) throw bad('Type a rate above 0, digits only.');
    if (!String(source || '').trim()) throw bad('Add the source: PO number or quote.');
    const w = lib.rateWarning(g.rate, r, D.settings.values.rate_warn_pct);
    if (w.warn && !confirmed) throw bad(`Did you mean Rs ${r}? It is ${w.pct.toFixed(0)}% from the last saved rate of Rs ${g.rate}. Tick "Yes, I meant this rate" to save.`);
    const impact = await impactOfRate(Number(gradeId), r);
    const mv = impact.filter(i => i.reapprove);
    await tx(async () => {
      await q('INSERT INTO c2m_material_rate (grade_id, rate, rate_date, source, warned_confirmed, entered_by, entered_at) VALUES (?,?,?,?,?,?,?)', [g.gradeId, r, today(), String(source).slice(0, 200), w.warn ? 1 : 0, user, now()]);
      await audit(user, 'rate', g.gradeId, 'save', g.rate, r, source);
      if (mv.length) await q('INSERT INTO c2m_reapproval (cause, items_json, created_at) VALUES (?,?,?)', [`${g.name} rate Rs ${g.rate} to Rs ${r}, ${today()}`, JSON.stringify(mv.map(m => ({ packId: m.packId, label: m.label, from: m.approved, to: m.after, pct: m.pctApproved }))), now()]);
    });
    return mv.length;
  }
  app.post('/api/c2m/rates', need('cfo'), wrap(async (req, res) => {
    const { gradeId, rate, source, confirmed } = req.body || {};
    res.json({ ok: true, reapproval: await saveRate(req.c2m.user, gradeId, rate, source, confirmed) });
  }));
  app.post('/api/c2m/packing/rate', need('cfo'), wrap(async (req, res) => {
    const { itemId, price, source, confirmed } = req.body || {};
    const D = await engine.loadAll(q); const it = D.packing.itemById.get(Number(itemId)); if (!it) throw bad('Packing item not found.');
    const r = Number(price); if (!(r > 0)) throw bad('Type a price above 0.'); if (!String(source || '').trim()) throw bad('Add the source: PO number or quote.');
    const w = lib.rateWarning(it.price, r, D.settings.values.rate_warn_pct);
    if (w.warn && !confirmed) throw bad(`Did you mean Rs ${r}? It is ${w.pct.toFixed(0)}% from the last saved price of Rs ${it.price}. Tick "Yes, I meant this price" to save.`);
    const moved = [];
    for (const p of D.packs.filter(p => p.packing_bill_id)) {
      const bill = D.packing.billById.get(p.packing_bill_id); if (!bill || !bill.lines.some(l => l.itemId === it.id)) continue;
      const c0 = engine.packCost(D, p), c1 = engine.packCost(D, p, { packOverride: { itemId: it.id, price: r } }); if (!c1 || !c1.costed) continue;
      const av = engine.latestApproved(D, p.id); const cp = D.cpById.get(p.client_product_id);
      if (!av) continue; const base = Number(av.total); // from = the approved cost (defect 4); no approved cost yet: not batched
      if (lib.needsReapproval(base, c1.total, D.settings.values.reapprove_pct)) moved.push({ packId: p.id, label: `${cp.brand} ${Number(p.pack_size)} ${cp.sold_per} for ${D.custById.get(cp.customer_id).name}`, from: base, to: c1.total, pct: (c1.total - base) / base * 100 });
    }
    await tx(async () => {
      await q('INSERT INTO c2m_packing_rate (packing_item_id, price_per_piece, rate_date, source, entered_by, entered_at) VALUES (?,?,?,?,?,?)', [it.id, r, today(), String(source).slice(0, 200), req.c2m.user, now()]);
      await audit(req.c2m.user, 'packing_rate', it.id, 'save', it.price, r, source);
      if (moved.length) await q('INSERT INTO c2m_reapproval (cause, items_json, created_at) VALUES (?,?,?)', [`${it.name} price Rs ${it.price} to Rs ${r}, ${today()}`, JSON.stringify(moved), now()]);
    });
    res.json({ ok: true, reapproval: moved.length });
  }));
  /* Approve the batch (or only the packs ticked: body.packIds). Packs not ticked go into a new open item
     "Left open from item N" so none drops out of every queue (cost review 18 Oct 2026, D-61). */
  app.post('/api/c2m/reapprovals/:id/approve', need('cfo'), wrap(async (req, res) => {
    const pick = Array.isArray((req.body || {}).packIds) ? new Set(req.body.packIds.map(Number)) : null;
    if (pick && !pick.size) throw bad('Tick at least 1 pack, or use "The rate was wrong" to close it.');
    const left = []; let approvedN = 0, reopened = 0; const unticked = new Set();
    await tx(async () => {
      const [[r]] = await q("SELECT * FROM c2m_reapproval WHERE id=? AND status='open' FOR UPDATE", [req.params.id]); if (!r) throw moved();
      if (pick) JSON.parse(r.items_json).forEach(it => { if (!pick.has(it.packId)) unticked.add(it.packId); });
      const [u] = await q("UPDATE c2m_reapproval SET status='approved', decided_by=?, decided_at=? WHERE id=? AND status='open'", [req.c2m.user, now(), r.id]); if (!u.affectedRows) throw moved();
      const D = await engine.loadAll(q); let n = 0;
      for (const it of JSON.parse(r.items_json)) {
        if (pick && !pick.has(it.packId)) continue;
        const p = D.packs.find(x => x.id === it.packId); if (!p) continue; const c = engine.packCost(D, p);
        if (!c || !c.costed) { const why = c ? c.gaps.join(', ') : 'its product is inactive'; await audit(req.c2m.user, 'reapproval', r.id, 'left: not costed', null, null, `${it.label}: ${why}`); left.push(`${it.label} (not costed today: ${why})`); continue; }
        // Re-check on approval (defect 4): a cost now within reapprove_pct of the approved cost stays as approved
        const av = engine.latestApproved(D, p.id);
        if (av && !lib.needsReapproval(Number(av.total), c.total, D.settings.values.reapprove_pct)) { await audit(req.c2m.user, 'reapproval', r.id, 'left: within threshold', Number(av.total), c.total, it.label); left.push(`${it.label} (today's Rs ${c.total.toFixed(2)} is within ${D.settings.values.reapprove_pct}% of the approved Rs ${Number(av.total).toFixed(2)})`); continue; }
        if (Math.abs(c.total - Number(it.to)) > 0.005) await audit(req.c2m.user, 'reapproval', r.id, 'cost moved since shown', it.to, c.total, `${it.label}: shown Rs ${Number(it.to).toFixed(2)}, approved at today's Rs ${c.total.toFixed(2)}`);
        await q('INSERT INTO c2m_cost_version (client_pack_id, valid_from, materials, packing, conversion, freight, total, recipe_version_id, cause, approved_by) VALUES (?,?,?,?,?,?,?,?,?,?)',
          [p.id, now(), c.materials, c.packing, c.conversion, c.freight, c.total, c.recipeVersionId, 'Re-approval: ' + r.cause, req.c2m.user]); n++;
      }
      await audit(req.c2m.user, 'reapproval', r.id, 'approve', null, { packs: n, of: JSON.parse(r.items_json).length }, r.cause);
      approvedN = n;
      // Packs not ticked wait in a new item (only those still beyond the threshold, or with no approved cost yet), in the same transaction (re-review 18 Oct night)
      if (unticked.size) reopened = await reapprovalFor(`Left open from item ${r.id} (not ticked), ${today()}`, p => unticked.has(p.id));
    });
    res.json({ ok: true, approved: approvedN, left, reopened });
  }));
  /* The rate was wrong: close the batch without new costs; Yawar then saves the right rate. */
  app.post('/api/c2m/reapprovals/:id/dismiss', need('cfo'), wrap(async (req, res) => {
    const why = String((req.body || {}).why || '').trim(); if (!why) throw bad('Write why, e.g. "rate typed wrong".');
    const [u] = await q("UPDATE c2m_reapproval SET status='dismissed', decided_by=?, decided_at=? WHERE id=? AND status='open'", [req.c2m.user, now(), req.params.id]); if (!u.affectedRows) throw moved();
    await audit(req.c2m.user, 'reapproval', req.params.id, 'dismiss', null, null, why);
    // Packs whose cost still differs from the approved cost for another reason (a rule or packing change) are batched again (review S6)
    const again = await reapprovalFor(`Costs still moved after closing item ${req.params.id}, ${today()}`);
    res.json({ ok: true, reapproval: again });
  }));

  /* ---------- Packing bills (Yawar keeps and approves them alone; ruled 15 Oct) ---------- */
  app.post('/api/c2m/packing/bill', need('cfo'), wrap(async (req, res) => {
    const { id, name, lines } = req.body || {};
    if (!String(name || '').trim()) throw bad('Name the packing bill, e.g. "25 kg bag with inner".');
    if (!Array.isArray(lines) || !lines.length) throw bad('Add at least 1 packing item.');
    for (const l of lines) { if (!l.itemId || !(Number(l.pieces) > 0)) throw bad('Every line needs an item and pieces above 0.'); if (l.level === 'secondary' && !(Number(l.packsPerOuter) > 0)) throw bad('A secondary item needs how many packs it holds.'); }
    const nm = String(name).trim().slice(0, 160);
    const iids = lines.map(l => Number(l.itemId)); const [items] = await q(`SELECT id FROM c2m_packing_item WHERE id IN (${qs(iids)})`, iids);
    if (new Set(items.map(i => i.id)).size !== new Set(lines.map(l => Number(l.itemId))).size) throw bad('A packing item on this bill is not in the packing list.');
    const [[dup]] = await q('SELECT id FROM c2m_packing_bill WHERE name=? AND id<>?', [nm, Number(id) || 0]); if (dup) throw bad('Another packing bill has this name.');
    if (id) { const [[ex]] = await q('SELECT id FROM c2m_packing_bill WHERE id=?', [id]); if (!ex) throw bad('Packing bill not found.'); }
    let billId = Number(id) || null, re = 0;
    await tx(async () => {
      const oldBill = billId ? { name: (await q('SELECT name FROM c2m_packing_bill WHERE id=?', [billId]))[0][0].name, lines: (await q('SELECT packing_item_id itemId, level, pieces, packs_per_outer packsPerOuter FROM c2m_packing_bill_line WHERE packing_bill_id=?', [billId]))[0] } : null;
      if (billId) { await q("UPDATE c2m_packing_bill SET name=?, status='approved', approved_by=?, approved_at=? WHERE id=?", [nm, req.c2m.user, now(), billId]); await q('DELETE FROM c2m_packing_bill_line WHERE packing_bill_id=?', [billId]); }
      else { const [b] = await q("INSERT INTO c2m_packing_bill (name, status, approved_by, approved_at) VALUES (?, 'approved', ?, ?)", [nm, req.c2m.user, now()]); billId = b.insertId; }
      for (const l of lines) await q('INSERT INTO c2m_packing_bill_line (packing_bill_id, packing_item_id, level, pieces, packs_per_outer) VALUES (?,?,?,?,?)', [billId, Number(l.itemId), l.level === 'secondary' ? 'secondary' : 'primary', Number(l.pieces), l.level === 'secondary' ? Number(l.packsPerOuter) : null]);
      await audit(req.c2m.user, 'packing_bill', billId, id ? 'update' : 'create', id ? oldBill : null, { name: nm, lines }, null);
      if (id) re = await reapprovalFor(`Packing bill "${nm}" changed, ${today()}`, p => p.packing_bill_id === billId);
      if (id) await costNotice(req.c2m.user, `Packing bill "${nm}" changed by Yawar`, re);
    });
    res.json({ id: billId, reapproval: re });
  }));
  app.post('/api/c2m/packing/assign', need('cfo'), wrap(async (req, res) => {
    const { packId, billId } = req.body || {};
    const [[p]] = await q('SELECT id, packing_bill_id FROM c2m_client_pack WHERE id=?', [packId]); if (!p) throw bad('Pack not found.');
    if (billId) { const [[b]] = await q('SELECT name FROM c2m_packing_bill WHERE id=?', [billId]); if (!b) throw bad('Packing bill not found.'); }
    let re = 0;
    await tx(async () => {
      await q('UPDATE c2m_client_pack SET packing_bill_id=? WHERE id=?', [billId || null, p.id]);
      await audit(req.c2m.user, 'client_pack', p.id, 'packing_bill', p.packing_bill_id, billId || null, null);
      re = await reapprovalFor(`Packing bill changed on a pack, ${today()}`, x => x.id === p.id);
      await costNotice(req.c2m.user, `Packing bill of pack ${p.id} changed by Yawar`, re);
    });
    res.json({ ok: true, reapproval: re });
  }));
  app.post('/api/c2m/packing/item', need('cfo'), wrap(async (req, res) => {
    const { name, kind, price, source } = req.body || {};
    if (!String(name || '').trim() || !(Number(price) > 0) || !String(source || '').trim()) throw bad('Give the item name, price per piece and source.');
    const [[dup]] = await q('SELECT id FROM c2m_packing_item WHERE name=?', [String(name).trim()]); if (dup) throw bad('A packing item with this name exists. Change its price on Inputs, Packing items.');
    const id = await tx(async () => {
      const [r] = await q('INSERT INTO c2m_packing_item (name, kind) VALUES (?,?)', [String(name).trim().slice(0, 120), String(kind || 'other').slice(0, 30)]);
      await q('INSERT INTO c2m_packing_rate (packing_item_id, price_per_piece, rate_date, source, entered_by, entered_at) VALUES (?,?,?,?,?,?)', [r.insertId, Number(price), today(), String(source).slice(0, 200), req.c2m.user, now()]);
      await audit(req.c2m.user, 'packing_item', r.insertId, 'create', null, { name, price }, source);
      return r.insertId;
    });
    res.json({ id });
  }));

  /* ---------- Conversion rules ---------- */
  app.post('/api/c2m/rules/conversion', need('cfo'), wrap(async (req, res) => {
    const b = req.body || {};
    /* Ruled 16 Oct: a named labour or FOH rate, assigned to all products (optionally a form, reprocessed, a pack range),
     * to a product type, or to a list of products. 1 labour + 1 FOH rate is picked per product and added. */
    if (!String(b.name || '').trim() || !(strictNum(b.rsPerKg) > 0)) throw bad('Give the rate a name and Rs per kg above 0 (digits only). A Rs 0 labour or FOH rate counts as missing.');
    if (!['labour', 'foh'].includes(b.kind)) throw bad('Pick Labour or FOH.');
    if (b.validFrom && !isDate(b.validFrom)) throw bad('Valid from must be a date.');
    if (b.validFrom && b.validFrom > today()) throw bad('A rate starts today or earlier. A future date is not taken yet, because its cost change would reach no re-approval.');
    if (b.form && !['solid', 'liquid'].includes(b.form)) throw bad('Form is solid or liquid.');
    // S4: pack range must be numbers, from below to
    for (const k of ['packMin', 'packMax']) if (b[k] != null && b[k] !== '' && !(strictNum(b[k]) > 0)) throw bad('Pack sizes must be numbers above 0.');
    if (b.packMin && b.packMax && strictNum(b.packMin) >= strictNum(b.packMax)) throw bad('"Packs from" must be below "packs below".');
    if (b.reprocessed != null && b.reprocessed !== '' && !['0', '1', 0, 1].includes(b.reprocessed)) throw bad('Reprocessed is yes or no.');
    const scope = b.scope || (b.clientProductId ? 'list' : 'general');
    let ids = Array.isArray(b.productIds) ? b.productIds.map(Number).filter(Boolean) : b.clientProductId ? [Number(b.clientProductId)] : [];
    if (scope === 'list') {
      if (!ids.length) throw bad('Pick at least 1 product for this rate.');
      const [ok] = await q(`SELECT id FROM c2m_client_product WHERE id IN (${qs(ids)})`, ids); if (ok.length !== new Set(ids).size) throw bad('A product on this list is not in C2M.');
    } else ids = [];
    if (scope === 'type') { const [[t]] = await q('SELECT id FROM c2m_base_product WHERE id=?', [b.baseProductId]); if (!t) throw bad('Pick the product type.'); }
    if (!['general', 'type', 'list'].includes(scope)) throw bad('Assign the rate to all products, a product type, or a list of products.');
    let id, re = 0;
    await tx(async () => {
      const [r] = await q('INSERT INTO c2m_conversion_rule (name, kind, rs_per_kg, scope_client_product_id, scope_base_product_id, scope_form, scope_reprocessed, scope_pack_min, scope_pack_max, valid_from, source) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        [String(b.name).slice(0, 160), b.kind, strictNum(b.rsPerKg), null, scope === 'type' ? Number(b.baseProductId) : null, b.form || null, b.reprocessed == null || b.reprocessed === '' ? null : Number(b.reprocessed), b.packMin ? strictNum(b.packMin) : null, b.packMax ? strictNum(b.packMax) : null, b.validFrom || today(), String(b.source || 'Entered by Yawar').slice(0, 200)]);
      id = r.insertId;
      for (const cpId of new Set(ids)) await q('INSERT INTO c2m_conversion_rule_product (rule_id, client_product_id) VALUES (?,?)', [id, cpId]);
      await audit(req.c2m.user, 'conversion_rule', id, 'create', null, b, null);
      re = await reapprovalFor(`Conversion rule "${String(b.name).slice(0, 80)}" added, ${today()}`);
      await costNotice(req.c2m.user, `${b.kind === 'labour' ? 'Labour' : 'FOH'} rate "${String(b.name).slice(0, 80)}" added at Rs ${strictNum(b.rsPerKg)} per kg or L by Yawar`, re);
    });
    res.json({ id, reapproval: re });
  }));
  /* Product type of a client product (used to assign rates) */
  app.post('/api/c2m/products/:id/type', need('cfo'), wrap(async (req, res) => {
    const [[cp]] = await q('SELECT id, base_product_id FROM c2m_client_product WHERE id=?', [req.params.id]); if (!cp) throw bad('Client product not found.');
    let typeId = (req.body || {}).typeId ? Number(req.body.typeId) : null; const newName = String((req.body || {}).newType || '').trim();
    let re = 0;
    await tx(async () => {
      if (newName) { const [[ex]] = await q('SELECT id FROM c2m_base_product WHERE name=?', [newName]); typeId = ex ? ex.id : (await q('INSERT INTO c2m_base_product (name) VALUES (?)', [newName.slice(0, 120)]))[0].insertId; }
      else if (typeId) { const [[t]] = await q('SELECT id FROM c2m_base_product WHERE id=?', [typeId]); if (!t) throw bad('Product type not found.'); }
      await q('UPDATE c2m_client_product SET base_product_id=? WHERE id=?', [typeId, cp.id]);
      await audit(req.c2m.user, 'client_product', cp.id, 'type', cp.base_product_id, typeId, null);
      re = await reapprovalFor(`Product type changed, ${today()}`, p => p.client_product_id === cp.id);
      await costNotice(req.c2m.user, `Product type of client product ${cp.id} changed by Yawar`, re);
    });
    res.json({ ok: true, reapproval: re });
  }));
  /* Reprocessed flag of a client product (picks the solid reprocessed band); review 16 Oct: it had no screen */
  app.post('/api/c2m/products/:id/reprocessed', need('cfo'), wrap(async (req, res) => {
    const [[cp]] = await q('SELECT id, reprocessed FROM c2m_client_product WHERE id=?', [req.params.id]); if (!cp) throw bad('Client product not found.');
    const v = (req.body || {}).on ? 1 : 0; let re = 0;
    await tx(async () => {
      await q('UPDATE c2m_client_product SET reprocessed=? WHERE id=?', [v, cp.id]);
      await audit(req.c2m.user, 'client_product', cp.id, 'reprocessed', cp.reprocessed, v, null);
      re = await reapprovalFor(`Reprocessed flag changed, ${today()}`, p => p.client_product_id === cp.id);
      await costNotice(req.c2m.user, `Reprocessed flag of client product ${cp.id} turned ${v ? 'on' : 'off'} by Yawar`, re);
    });
    res.json({ ok: true, reapproval: re });
  }));
  app.post('/api/c2m/rules/conversion/:id/retire', need('cfo'), wrap(async (req, res) => {
    const why = String((req.body || {}).why || '').trim(); if (!why) throw bad('Write why the rule is retired.');
    let re = 0;
    await tx(async () => {
      const [u] = await q('UPDATE c2m_conversion_rule SET active=0 WHERE id=? AND active=1', [req.params.id]); if (!u.affectedRows) throw moved();
      const gaps = packsWithoutRates(await engine.loadAll(q)); if (gaps.length) throw bad(`Retiring this rate leaves ${gaps.length} pack(s) with no rate, e.g. ${gaps.slice(0, 3).join('; ')}. Add the replacing rate first.`);
      await audit(req.c2m.user, 'conversion_rule', req.params.id, 'retire', null, null, why);
      re = await reapprovalFor(`Conversion rule ${req.params.id} retired, ${today()}`);
      await costNotice(req.c2m.user, `Labour or FOH rate ${req.params.id} retired by Yawar (${why.slice(0, 120)})`, re);
    });
    res.json({ ok: true, reapproval: re });
  }));

  /* ---------- Prices: Yawar proposes, Tahir approves or sends back ---------- */
  async function packInfo(packId) {
    const D = await engine.loadAll(q); const p = D.packs.find(x => x.id === Number(packId)); if (!p) throw bad('Pack not found.');
    const cp = D.cpById.get(p.client_product_id); if (!cp) throw bad('This product is inactive. Make it active before pricing it.');
    const c = engine.packCost(D, p);
    return { D, p, cp, gaps: c && !c.costed ? c.gaps : [], cost: c && c.costed ? c.total : null, target: lib.targetOr(cp.target_gp, D.settings && D.settings.values ? D.settings.values.budget_gp : null) }; // no target set = the company GP target (D-75)
  }
  app.post('/api/c2m/prices/propose', need('cfo'), wrap(async (req, res) => {
    const { packId, price, reason, belowReason, replaceId, validFrom, validTo } = req.body || {};
    const P = await packInfo(packId); const v = strictNum(price); if (!(v > 0)) throw bad('Type a price above 0, digits only.');
    if (engine.isVanBrand(P.cp)) throw bad('A VAN brand pack is priced per channel through the VAN brand list revisions (Prices, VAN brand lists), not here.'); // D-44
    if (validFrom && !isDate(validFrom)) throw bad('Effective date must be a date.');
    if (validFrom && validFrom < today()) throw bad('The effective date cannot be in the past.');
    if (validTo && (!isDate(validTo) || validTo < (validFrom || today()))) throw bad('Valid till must be the effective date or later (it is the last day the price applies).');
    // No price for a pack that is not costed, including one whose recipe is not in C2M yet (D-40; Tahir 18 Oct, I-24)
    if (P.cost == null) throw bad(`This pack is not costed (${P.gaps.join(', ')}), so its GP cannot be checked. Fix its cost first, then propose the price.`);
    const gp = lib.marginPct(v, P.cost);
    if (P.target != null && gp != null && gp < P.target && !String(belowReason || '').trim()) throw bad('This price is below target GP. Write why.');
    if (!String(reason || '').trim()) throw bad('Write the reason the client will read on the list.'); // written by Yawar, never pre-filled (D-56)
    const id = await tx(async () => {
      const [[open]] = await q("SELECT id FROM c2m_price WHERE client_pack_id=? AND status='proposed' FOR UPDATE", [P.p.id]);
      if (open) throw bad('This pack already has a price waiting for Tahir. Wait for his decision first.');
      if (replaceId) { const [u] = await q("UPDATE c2m_price SET status='replaced' WHERE id=? AND client_pack_id=? AND status='sent_back'", [replaceId, P.p.id]); if (!u.affectedRows) throw moved(); await audit(req.c2m.user, 'price', replaceId, 'replaced', 'sent_back', 'replaced', 'Revised and sent again'); }
      // 1.0.0: a new price for the pack also closes any older sent-back price of that pack, so none stays on Approvals with no way out (review 19 Oct)
      const [old] = await q("SELECT id FROM c2m_price WHERE client_pack_id=? AND status='sent_back' FOR UPDATE", [P.p.id]);
      for (const o of old) { await q("UPDATE c2m_price SET status='replaced' WHERE id=?", [o.id]); await audit(req.c2m.user, 'price', o.id, 'replaced', 'sent_back', 'replaced', 'A newer price for the same pack was sent'); }
      const cur = await priceInForce(P.p.id);
      const [r] = await q("INSERT INTO c2m_price (client_pack_id, price, prev_price, valid_from, valid_to, reason, below_target_reason, status, proposed_by, proposed_at) VALUES (?,?,?,?,?,?,?,'proposed',?,?)",
        [P.p.id, v, cur ? cur.price : null, validFrom || today(), validTo || null, String(reason || '').slice(0, 400) || null, String(belowReason || '').slice(0, 400) || null, req.c2m.user, now()]);
      await audit(req.c2m.user, 'price', r.insertId, 'propose', cur ? cur.price : null, v, reason);
      return r.insertId;
    });
    res.json({ id });
  }));
  app.post('/api/c2m/prices/:id/approve', need('coo'), wrap(async (req, res) => {
    await tx(async () => {
      const [[p]] = await q("SELECT * FROM c2m_price WHERE id=? AND status='proposed' FOR UPDATE", [req.params.id]); if (!p) throw moved(); notSelf(p.proposed_by, req.c2m.user);
      const from = String(p.valid_from).slice(0, 10) > today() ? String(p.valid_from).slice(0, 10) : today();
      if (p.valid_to && String(p.valid_to).slice(0, 10) < from) throw bad(`Its valid till date (${String(p.valid_to).slice(0, 10)}) is before it would start (${from}). Send it back for new dates.`);
      // Only 1 price may wait for its date: a newer approval cancels the waiting one, puts back what it shortened, and says so
      const [waiting] = await q("SELECT * FROM c2m_price WHERE client_pack_id=? AND status='approved' AND valid_from>? AND id<>? FOR UPDATE", [p.client_pack_id, today(), p.id]);
      for (const w of waiting) {
        const [c] = await q("UPDATE c2m_price SET status='cancelled' WHERE id=? AND status='approved'", [w.id]); if (!c.affectedRows) continue;
        await restoreCut(w, req.c2m.user, `cancelled by the newer approval ${p.id}`);
        await audit(req.c2m.user, 'price', w.id, 'cancelled', w.price, null, `Waiting price from ${String(w.valid_from).slice(0, 10)} cancelled by the newer approval ${p.id}`);
      }
      const cur = await priceInForce(p.client_pack_id);
      let cutId = null, cutPrev = null;
      if (cur && (!cur.valid_to || String(cur.valid_to).slice(0, 10) >= from)) {
        // The price in force ends the day before the new one starts; its old end date is kept on the new row
        cutId = cur.id; cutPrev = cur.valid_to ? String(cur.valid_to).slice(0, 10) : null;
        await q(`UPDATE c2m_price SET valid_to=?${from <= today() ? ", status='replaced'" : ''} WHERE id=?`, [dayBefore(from), cur.id]);
        await audit(req.c2m.user, 'price', cur.id, 'ended', cutPrev, dayBefore(from), `Ends before price ${p.id} starts on ${from}`);
      }
      const [u] = await q("UPDATE c2m_price SET status='approved', prev_price=?, valid_from=?, cut_price_id=?, cut_prev_to=?, decided_by=?, decided_at=? WHERE id=? AND status='proposed'", [cur ? cur.price : null, from, cutId, cutPrev, req.c2m.user, now(), p.id]);
      if (!u.affectedRows) throw moved();
      await audit(req.c2m.user, 'price', p.id, 'approve', cur ? cur.price : null, p.price, from > today() ? `Takes over on ${from}` : null);
      res.locals.out = { ok: true, waitsUntil: from > today() ? from : null, cancelled: waiting.length };
      if (waiting.length) { const issued = []; for (const w of waiting) issued.push(...await docsShowingPrice(w));
        await notice('cfo', `A price waiting for a later date was cancelled by Tahir's newer approval for the same pack (price ${p.id}).${issued.length ? ` Already issued with the cancelled price: ${issued.join(', ')}. Tell the client.` : ''}`, req.c2m.user); }
    });
    res.json(res.locals.out);
  }));
  /* Withdraw a price approved for a later date, before it takes over (Tahir). */
  app.post('/api/c2m/prices/:id/withdraw', need('coo'), wrap(async (req, res) => {
    const why = String((req.body || {}).why || '').trim(); if (!why) throw bad('Write why the waiting price is withdrawn.');
    await tx(async () => {
      const [[p]] = await q("SELECT * FROM c2m_price WHERE id=? AND status='approved' AND valid_from>? FOR UPDATE", [req.params.id, today()]); if (!p) throw moved();
      const [u] = await q("UPDATE c2m_price SET status='withdrawn' WHERE id=? AND status='approved'", [p.id]); if (!u.affectedRows) throw moved();
      await restoreCut(p, req.c2m.user, 'withdrawn');
      await audit(req.c2m.user, 'price', p.id, 'withdrawn', p.price, null, why);
      // Tell Yawar, and name any price list already issued that shows this price (review: withdraw told nobody)
      const docs = await docsShowingPrice(p);
      await notice('cfo', `Tahir withdrew the price Rs ${Number(p.price)} waiting from ${String(p.valid_from).slice(0, 10)}. Why: ${why.slice(0, 150)}${docs.length ? `. Already issued with it: ${docs.join(', ')}. Tell the client.` : ''}`, req.c2m.user);
      res.locals.out = { ok: true, issuedDocs: docs };
    });
    res.json(res.locals.out);
  }));
  app.post('/api/c2m/prices/:id/sendback', need('coo'), wrap(async (req, res) => {
    const reason = String((req.body || {}).reason || '').trim(); if (!reason) throw bad('Write a reason.');
    const [r] = await q("UPDATE c2m_price SET status='sent_back', back_reason=?, decided_by=?, decided_at=? WHERE id=? AND status='proposed'", [reason.slice(0, 400), req.c2m.user, now(), req.params.id]);
    if (!r.affectedRows) throw bad('Nothing to send back.');
    await audit(req.c2m.user, 'price', req.params.id, 'sent_back', null, null, reason);
    res.json({ ok: true });
  }));

  /* ---------- Settings: thresholds need Tahir's approval; budget lines notify Tahir (ruled 14 to 15 Oct) ---------- */
  app.post('/api/c2m/settings', need('cfo'), wrap(async (req, res) => {
    const ch = (req.body || {}).changes || {};
    const [rows] = await q('SELECT k, v, label, needs_approval FROM c2m_setting'); rows.forEach(r => { if (r.k === 'budget_gp') { r.needs_approval = 1; r.label = 'Company GP target, %'; } }); // D-75: waits for Tahir, under the name Setup shows (no SQL needed)
    const pend = {}, direct = [];
    for (const r of rows) if (ch[r.k] != null && String(ch[r.k]) !== String(r.v)) { if (!(Number(ch[r.k]) >= 0)) throw bad(`${r.label}: type a number.`); if (r.k === 'fed_pct' && !(Number(ch[r.k]) > 0 && Number(ch[r.k]) < 100)) throw bad(`${r.label}: type a % above 0 and below 100.`); (r.needs_approval ? (pend[r.k] = String(ch[r.k])) : direct.push([r, String(ch[r.k])])); }
    await tx(async () => {
      for (const [r, v] of direct) { await q('UPDATE c2m_setting SET v=?, updated_by=?, updated_at=? WHERE k=?', [v, req.c2m.user, now(), r.k]); await notice('coo', `Setting changed: ${r.label} ${r.v} to ${v}`, req.c2m.user); await audit(req.c2m.user, 'setting', r.k, 'change', r.v, v, null); if (r.k === 'fed_pct') await refedLists(req.c2m.user); }
      if (Object.keys(pend).length) {
        const summary = rows.filter(r => pend[r.k] != null).map(r => `${r.label} ${r.v} to ${pend[r.k]}`).join('; ');
        await q('INSERT INTO c2m_setting_request (changes_json, summary, by_user, at) VALUES (?,?,?,?)', [JSON.stringify(pend), summary, req.c2m.user, now()]);
      }
    });
    res.json({ applied: direct.length, pending: Object.keys(pend).length });
  }));
  app.post('/api/c2m/settings/requests/:id/:act(approve|refuse)', need('coo'), wrap(async (req, res) => {
    await tx(async () => {
      const [[r]] = await q("SELECT * FROM c2m_setting_request WHERE id=? AND status='open' FOR UPDATE", [req.params.id]); if (!r) throw moved(); if (req.params.act === 'approve') notSelf(r.by_user, req.c2m.user);
      const [u] = await q("UPDATE c2m_setting_request SET status=?, decided_by=?, decided_at=? WHERE id=? AND status='open'", [req.params.act === 'approve' ? 'approved' : 'refused', req.c2m.user, now(), r.id]); if (!u.affectedRows) throw moved();
      if (req.params.act === 'approve') for (const [k, v] of Object.entries(JSON.parse(r.changes_json))) {
        const [[old]] = await q('SELECT v FROM c2m_setting WHERE k=?', [k]);
        await q('UPDATE c2m_setting SET v=?, updated_by=?, updated_at=? WHERE k=?', [v, req.c2m.user, now(), k]);
        await audit(req.c2m.user, 'setting', k, 'change', old ? old.v : null, v, 'Approved request ' + r.id);
        if (k === 'fed_pct') await refedLists(req.c2m.user);
      }
      await audit(req.c2m.user, 'setting_request', r.id, req.params.act, null, r.summary, null);
    });
    res.json({ ok: true });
  }));

  /* ---------- Client target overrides: Yawar proposes, Tahir approves ---------- */
  app.post('/api/c2m/targets/request', need('cfo'), wrap(async (req, res) => {
    const { clientProductId, toGp, reason } = req.body || {};
    const [[cp]] = await q('SELECT id, target_gp FROM c2m_client_product WHERE id=?', [clientProductId]); if (!cp) throw bad('Pick a client product.');
    if (!(Number(toGp) >= 0 && Number(toGp) < 100)) throw bad('Target GP must be between 0 and 100.'); if (!String(reason || '').trim()) throw bad('Write why.');
    // Locked on the product row, so 2 quick clicks cannot open 2 requests (re-review)
    const rid = await tx(async () => {
      await q('SELECT id FROM c2m_client_product WHERE id=? FOR UPDATE', [cp.id]);
      const [[openReq]] = await q("SELECT id FROM c2m_target_request WHERE client_product_id=? AND status='open'", [cp.id]);
      if (openReq) throw bad('This product already has a target change waiting for Tahir. Wait for his decision first.');
      const [r] = await q('INSERT INTO c2m_target_request (client_product_id, from_gp, to_gp, reason, by_user, at) VALUES (?,?,?,?,?,?)', [cp.id, cp.target_gp, Number(toGp), String(reason).slice(0, 400), req.c2m.user, now()]);
      await audit(req.c2m.user, 'target_request', r.insertId, 'request', cp.target_gp, Number(toGp), reason);
      return r.insertId;
    });
    res.json({ id: rid });
  }));
  app.post('/api/c2m/targets/:id/:act(approve|refuse)', need('coo'), wrap(async (req, res) => {
    await tx(async () => {
      const [[r]] = await q("SELECT * FROM c2m_target_request WHERE id=? AND status='open' FOR UPDATE", [req.params.id]); if (!r) throw moved(); if (req.params.act === 'approve') notSelf(r.by_user, req.c2m.user);
      const [u] = await q("UPDATE c2m_target_request SET status=?, decided_by=?, decided_at=? WHERE id=? AND status='open'", [req.params.act === 'approve' ? 'approved' : 'refused', req.c2m.user, now(), r.id]); if (!u.affectedRows) throw moved();
      if (req.params.act === 'approve') await q('UPDATE c2m_client_product SET target_gp=? WHERE id=?', [r.to_gp, r.client_product_id]);
      await audit(req.c2m.user, 'target', r.client_product_id, req.params.act, r.from_gp, r.to_gp, r.reason);
    });
    res.json({ ok: true });
  }));

  /* ---------- Import queue: nothing enters without Yawar ---------- */
  app.post('/api/c2m/import/:id/:act(accept|correct)', need('cfo'), wrap(async (req, res) => {
    const [[it]] = await q("SELECT * FROM c2m_import_item WHERE id=? AND status='open'", [req.params.id]); if (!it) throw moved();
    let note = 'Accepted: ' + it.prefill_text, re = 0;
    const v = String((req.body || {}).value || '').trim(), why = String((req.body || {}).why || '').trim();
    if (req.params.act === 'correct') {
      if (!v || !why) throw bad('Type the correct value and why.');
      note = `Corrected to ${v}. Why: ${why}`;
    }
    await tx(async () => {
      const [u] = await q("UPDATE c2m_import_item SET status=?, decided_by=?, decided_at=?, decision_note=? WHERE id=? AND status='open'", [req.params.act === 'accept' ? 'accepted' : 'corrected', req.c2m.user, now(), note.slice(0, 400), it.id]);
      if (!u.affectedRows) throw moved();
      const pl = JSON.parse(it.payload || '{}');
      // A rate correction is saved through the same controls as any rate: digits only, 10% warning, re-approval.
      if (req.params.act === 'correct' && it.kind === 'rate' && pl.gradeId) re = await saveRate(req.c2m.user, pl.gradeId, v.replace(/^rs\.?\s*/i, '').replace(/,/g, ''), 'Import queue correction: ' + why.slice(0, 150), !!(req.body || {}).confirmed);
      await audit(req.c2m.user, 'import_item', it.id, req.params.act, it.prefill_text, note, null);
    });
    res.json({ ok: true, reapproval: re, kind: it.kind });
  }));

  /* ---------- Master data that had no form (audit, 16 Oct) ---------- */
  app.post('/api/c2m/materials', need('cfo'), wrap(async (req, res) => {
    const { name, typeId, unit, grade, rate, source } = req.body || {};
    const nm = String(name || '').trim(), gd = String(grade || 'Standard').trim();
    if (!nm || !String(source || '').trim() || !(strictNum(rate) > 0)) throw bad('Give the material name, its rate (digits) and the source.');
    if (!['kg', 'L'].includes(unit || 'kg')) throw bad('Unit is kg or L.');
    const [[t]] = await q('SELECT id FROM c2m_material_type WHERE id=?', [typeId]); if (!t) throw bad('Pick the material type.');
    const id = await tx(async () => {
      let [[m]] = await q('SELECT id FROM c2m_raw_material WHERE name=?', [nm]);
      if (!m) { const [r] = await q('INSERT INTO c2m_raw_material (name, type_id, unit) VALUES (?,?,?)', [nm.slice(0, 120), t.id, unit || 'kg']); m = { id: r.insertId }; }
      const [[ex]] = await q('SELECT id FROM c2m_material_grade WHERE material_id=? AND grade=?', [m.id, gd]); if (ex) throw bad('This material and grade already exist. Save a new rate on Inputs, Materials (Try rate).');
      const [g] = await q('INSERT INTO c2m_material_grade (material_id, grade) VALUES (?,?)', [m.id, gd.slice(0, 60)]);
      await q('INSERT INTO c2m_material_rate (grade_id, rate, rate_date, source, entered_by, entered_at) VALUES (?,?,?,?,?,?)', [g.insertId, strictNum(rate), today(), String(source).slice(0, 200), req.c2m.user, now()]);
      await audit(req.c2m.user, 'material', g.insertId, 'create', null, { name: nm, grade: gd, rate }, source);
      return g.insertId;
    });
    res.json({ gradeId: id });
  }));
  /* Nutrient % per grade: the fields come from the material type (ruled 15 Oct). */
  app.post('/api/c2m/grades/:id/nutrients', need('cfo', 'qc'), wrap(async (req, res) => {
    const [[g]] = await q('SELECT g.id, g.nutrients_json, t.nutrient_fields FROM c2m_material_grade g JOIN c2m_raw_material m ON m.id=g.material_id LEFT JOIN c2m_material_type t ON t.id=m.type_id WHERE g.id=?', [req.params.id]);
    if (!g) throw bad('Material grade not found.');
    const fields = String(g.nutrient_fields || '').split('|').filter(Boolean), vals = (req.body || {}).values || {}, out = {};
    if (!fields.length) throw bad('This material has no nutrient fields in its class (non-nutrient or to classify). Set a nutrient class first if it carries nutrients.');
    for (const f of fields) if (vals[f] != null && vals[f] !== '') { const v = strictNum(vals[f]); if (!(v >= 0 && v <= 100)) throw bad(`${f}: type a % between 0 and 100.`); out[f] = v; }
    await tx(async () => {
      await q('UPDATE c2m_material_grade SET nutrients_json=? WHERE id=?', [JSON.stringify(out), g.id]);
      await audit(req.c2m.user, 'grade_nutrients', g.id, 'save', g.nutrients_json, out, null);
    });
    res.json({ ok: true });
  }));
  /* Material class: nutrient source, or non-nutrient (binder, filler, anti-caking, wetting agent, colour, pH). Ruled 16 Oct. */
  app.post('/api/c2m/materials/:id/type', need('cfo', 'qc'), wrap(async (req, res) => {
    const [[m]] = await q('SELECT id, name, type_id FROM c2m_raw_material WHERE id=?', [req.params.id]); if (!m) throw bad('Material not found.');
    const [[t]] = await q('SELECT id, name, nutrient_role FROM c2m_material_type WHERE id=?', [(req.body || {}).typeId]); if (!t) throw bad('Pick the class.');
    await tx(async () => {
      await q('UPDATE c2m_raw_material SET type_id=? WHERE id=?', [t.id, m.id]);
      const [old] = await q('SELECT id, grade, nutrients_json FROM c2m_material_grade WHERE material_id=?', [m.id]);
      if (t.nutrient_role !== 'nutrient') await q('UPDATE c2m_material_grade SET nutrients_json=NULL WHERE material_id=?', [m.id]);
      await audit(req.c2m.user, 'material', m.id, 'class', { typeId: m.type_id, grades: old }, { typeId: t.id }, `${m.name}: ${t.name}`);
    });
    res.json({ ok: true });
  }));
  app.post('/api/c2m/customers/:id', need('cfo'), wrap(async (req, res) => {
    const { priceRule, cycle, region, o2sNames } = req.body || {};
    const [[c]] = await q('SELECT * FROM c2m_customer WHERE id=?', [req.params.id]); if (!c) throw bad('Customer not found.');
    if (priceRule && !['time', 'po', 'list'].includes(priceRule)) throw bad('Price rule is time based, per PO, or list.');
    const names = o2sNames == null ? c.o2s_names : String(o2sNames).split('|').map(x => x.trim()).filter(Boolean).join('|');
    if (!names) throw bad('Keep at least 1 O2S name.');
    await q('UPDATE c2m_customer SET price_rule=?, price_cycle=?, region=?, o2s_names=? WHERE id=?', [priceRule || c.price_rule, cycle == null ? c.price_cycle : String(cycle).slice(0, 40) || null, region == null ? c.region : String(region).slice(0, 40) || null, names.slice(0, 600), c.id]);
    await audit(req.c2m.user, 'customer', c.id, 'update', { rule: c.price_rule, cycle: c.price_cycle, region: c.region, o2s: c.o2s_names }, { priceRule, cycle, region, o2sNames: names }, null);
    res.json({ ok: true });
  }));
  app.post('/api/c2m/freight', need('cfo'), wrap(async (req, res) => {
    const { segment, region, rsPerKg, validFrom } = req.body || {};
    if (!['Dealer', 'Farmer'].includes(segment)) throw bad('Freight applies to Dealer or Farmer prices.');
    if (!String(region || '').trim() || !(strictNum(rsPerKg) >= 0)) throw bad('Give the region and Rs per kg (digits).');
    const vf = validFrom || today(); if (!isDate(vf)) throw bad('Valid from must be a date.');
    const [[oldF]] = await q('SELECT rs_per_kg FROM c2m_freight_rate WHERE segment=? AND region=? AND valid_from=?', [segment, String(region).trim().slice(0, 40), vf]);
    await tx(async () => {
      await q('INSERT INTO c2m_freight_rate (segment, region, rs_per_kg, valid_from) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE rs_per_kg=VALUES(rs_per_kg)', [segment, String(region).trim().slice(0, 40), strictNum(rsPerKg), vf]);
      await audit(req.c2m.user, 'freight', `${segment}|${region}`, 'save', oldF ? { rsPerKg: oldF.rs_per_kg, validFrom: vf } : null, { rsPerKg, validFrom: vf }, null);
    });
    res.json({ ok: true });
  }));

  /* ---------- Access grants (Yawar grants lists and clients) ---------- */
  app.post('/api/c2m/grants', need('cfo'), wrap(async (req, res) => {
    const { username, kind, value, on } = req.body || {};
    if (!['list', 'client'].includes(kind)) throw bad('Unknown grant.');
    const [[person]] = await q("SELECT username FROM user_module_roles WHERE username=? AND module='c2m'", [username]); if (!person) throw bad('This person has no C2M access.');
    if (kind === 'list' && !PL.AUDIENCES[value]) throw bad('Unknown price list.');
    if (kind === 'client') { const [[c]] = await q('SELECT id FROM c2m_customer WHERE name=?', [value]); if (!c) throw bad('Unknown client.'); }
    if (on) await q('INSERT IGNORE INTO c2m_list_grant (username, grant_kind, grant_value, granted_by, granted_at) VALUES (?,?,?,?,?)', [username, kind, value, req.c2m.user, now()]);
    else await q('DELETE FROM c2m_list_grant WHERE username=? AND grant_kind=? AND grant_value=?', [username, kind, value]);
    await audit(req.c2m.user, 'grant', username, on ? 'grant' : 'remove', null, { kind, value }, null);
    res.json({ ok: true });
  }));

  /* ---------- Monthly actuals and checks ---------- */
  app.post('/api/c2m/actuals', need('cfo'), wrap(async (req, res) => {
    const { month, labour, foh } = req.body || {};
    if (!/^\d{4}-\d{2}$/.test(String(month))) throw bad('Pick the month.');
    if (!(Number(labour) >= 0) || !(Number(foh) >= 0)) throw bad('Type actual labour and FOH in Rs.');
    const [[oldA]] = await q('SELECT actual_labour, actual_foh, entered_by FROM c2m_monthly_actual WHERE month=?', [month]);
    await tx(async () => {
      await q('INSERT INTO c2m_monthly_actual (month, actual_labour, actual_foh, entered_by, entered_at) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE actual_labour=VALUES(actual_labour), actual_foh=VALUES(actual_foh), entered_by=VALUES(entered_by), entered_at=VALUES(entered_at)',
        [month, Number(labour), Number(foh), req.c2m.user, now()]);
      await audit(req.c2m.user, 'monthly_actual', month, 'save', oldA || null, { labour, foh }, null);
    });
    res.json({ ok: true });
  }));
  app.post('/api/c2m/checks', wrap(async (req, res) => {
    const { month, kind, data } = req.body || {};
    if (kind === 'rate_check' && req.c2m.role === 'cfo') throw Object.assign(new Error('The rate check is done by a second person, not by the person who entered the rates.'), { status: 403 });
    if (kind === 'rate_check' && req.c2m.role !== 'coo') throw Object.assign(new Error('Your role cannot do this in C2M.'), { status: 403 });
    if (kind === 'tie_books' && req.c2m.role !== 'cfo') throw Object.assign(new Error('Your role cannot do this in C2M.'), { status: 403 });
    if (!['rate_check', 'tie_books'].includes(kind) || !/^\d{4}-\d{2}$/.test(String(month))) throw bad('Pick the month and the check.');
    /* The checks carry their figures, not just a tick (cost review 18 Oct 2026, D-64): the rate check holds the register rate
       for each material listed; the tie to the books holds ERP sales and COGS beside C2M's own figures for the month. */
    let save = data || null;
    if (kind === 'rate_check') { const R = data && Array.isArray(data.rates) ? data.rates : null; if (!R || !R.length) throw bad('There is no material to check for this month: the check needs at least 1 material with its purchase register rate.');
      if (R.some(r => !r || typeof r !== 'object' || !r.gradeId || !(strictNum(r.register) > 0))) throw bad('Every material listed needs its purchase register rate (digits above 0) before the check is done.');
      save = { rates: R.map(r => ({ gradeId: Number(r.gradeId), name: String(r.name || '').slice(0, 120), c2m: Number(r.c2m) || null, date: r.date || null, source: String(r.source || '').slice(0, 200), rs: Number(r.rs) || 0, register: strictNum(r.register) })) }; }
    if (kind === 'tie_books') { if (!(data && strictNum(data.erpSales) > 0 && strictNum(data.erpCogs) > 0)) throw bad('Enter ERP sales and ERP COGS for the month, in Rs (digits above 0).');
      /* C2M's own figures are worked out here, never taken from the page, so the person tying cannot supply the check figures (re-review 18 Oct night) */
      const C = await monthFigures(String(month)); save = { erpSales: strictNum(data.erpSales), erpCogs: strictNum(data.erpCogs), c2mSales: Math.round(C.sales), c2mCogs: Math.round(C.cogs), c2mUncosted: Math.round(C.uncosted), focCost: Math.round(C.focCost) }; }
    const [[oldC]] = await q('SELECT data_json, done_by, done_at FROM c2m_monthly_check WHERE month=? AND kind=?', [month, kind]);
    await tx(async () => {
      await q('INSERT INTO c2m_monthly_check (month, kind, data_json, done_by, done_at) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE data_json=VALUES(data_json), done_by=VALUES(done_by), done_at=VALUES(done_at)', [month, kind, save ? JSON.stringify(save) : null, req.c2m.user, now()]);
      await audit(req.c2m.user, 'monthly_check', month + ':' + kind, 'done', oldC || null, save, null);
    });
    res.json({ ok: true });
  }));

  /* ---------- Notices ---------- */
  app.post('/api/c2m/notices/seen', need('coo', 'cfo'), wrap(async (req, res) => { await q('UPDATE c2m_notice SET seen=1 WHERE for_role=?', [req.c2m.role]); res.json({ ok: true }); }));

  /* ---------- VAN brand list price revisions: Yawar proposes, Tahir approves or sends back (ruled 16 Oct) ---------- */
  const LIST_FIELDS = { dist: ['now', 'mrp'], dealer: ['nsv', 'disc', 'frp', 'mrp'], farmer: ['pb', 'sn', 'snc'] };
  /** Derived figures (D-72): distributor price with FED = price x (1 + FED %); dealer net = NSV less discount, with FED = net x (1 + FED %). */
  /** The data of a row added by a revision (D-77). The farmer list names each pack in the product column ("Brand 25 kg"),
   * as its loaded rows do and as its price list prints, so the size goes into p there; the other lists keep a pack column. */
  function addedRow(list, it) { return list === 'farmer' ? { p: `${it.product} ${it.pack}`, packId: it.packId, ...it.to } : { p: it.product, pack: it.pack, packId: it.packId, ...it.to, ...(list === 'dist' ? { sentSet: 1 } : {}) }; } // dist: never sent before, so no previous price ("new" on the list, D-42; review 1.0.0, finding 3)
  /** A revision item under the names of today: an added pack under its product's official name, a row under the row's name (1.0.2, D-85; review 1.0.2, design finding 5). */
  function itemNow(D, liById, it) {
    if (it.id == null && it.added) { const pk = D.packs.find(k => Number(k.id) === Number(it.packId)); const c = pk ? D.cpById.get(pk.client_product_id) : null; return c ? { ...it, product: c.brand, pack: lib.officialPack(pk.pack_size, c.sold_per) } : it; }
    const d = liById.get(Number(it.id)); return d ? { ...it, product: d.p, pack: d.pack || null } : it;
  }
  /** An added pack's official name today, read inside the transaction that adds its row (null when the pack is gone). */
  async function packNameNow(packId) {
    const [[r]] = await q('SELECT c.brand, c.sold_per, k.pack_size FROM c2m_client_pack k JOIN c2m_client_product c ON c.id=k.client_product_id WHERE k.id=?', [packId]);
    return r ? { product: r.brand, pack: lib.officialPack(r.pack_size, r.sold_per) } : null;
  }
  function deriveList(list, d, fed) {
    const o = { ...d }; const f = 1 + lib.fedPct(fed) / 100;
    if (list === 'dist' && o.now != null) o.fed = lib.round(Number(o.now) * f, 2);
    if (list === 'dealer' && o.nsv != null) { o.net = lib.round(Number(o.nsv) * (1 - Number(o.disc || 0)), 2); o.netfed = lib.round(o.net * f, 2); }
    return o;
  }
  /** The FED % in force (setting fed_pct; 5 when the row is not there yet, D-72). */
  async function fedNow(lock) { const [[r]] = await q("SELECT v FROM c2m_setting WHERE k='fed_pct'" + (lock ? ' LOCK IN SHARE MODE' : '')); return lib.fedPct(r && r.v); } // lock: inside a transaction, wait for a FED change being approved (review 19 Oct)
  /** A changed FED % carries into every distributor and dealer row's price with FED at once (D-72). */
  async function refedLists(by) {
    const fed = await fedNow(); const [all] = await q("SELECT id, list_name, data_json FROM c2m_list_price WHERE list_name IN ('dist','dealer') FOR UPDATE"); let n = 0;
    for (const row of all) { const d = JSON.parse(row.data_json); const o = deriveList(row.list_name, d, fed); if (JSON.stringify(o) !== JSON.stringify(d)) { await q('UPDATE c2m_list_price SET data_json=? WHERE id=?', [JSON.stringify(o), row.id]); n++; } }
    await audit(by, 'list_price', 'all', 'FED changed', null, { fed, rows: n }, 'FED % changed: price with FED worked again on the distributor and dealer lists');
    return n;
  }
  /** Link VAN brand list rows to their C2M pack (D-70, D-73): Yawar picks the pack for each row once; the report
   * "VAN brand list margin" reads cost through this link only, never through names or O2S. packId null unlinks a row. */
  app.post('/api/c2m/lists/links', need('cfo', 'coo'), wrap(async (req, res) => { // 1.0.2: Tahir links and names too (D-85); the mark stays Yawar's (D-80)
    const links = (req.body || {}).links;
    if (!Array.isArray(links) || !links.length) throw bad('Pick at least 1 row and its pack.');
    if (links.length > 500) throw bad('Save at most 500 links at a time.');
    const whole = v => (typeof v === 'number' && Number.isInteger(v) && v > 0) || (typeof v === 'string' && /^[1-9]\d*$/.test(v)); // ids only: never true, 1.5 or "abc"
    let n = 0;
    await tx(async () => {
      await lockNames(); const D = await engine.loadAll(q); const vanPack = new Set(D.packs.filter(k => engine.isVanBrand(D.cpById.get(k.client_product_id))).map(k => Number(k.id))); // names read after the lock, inside the transaction (review 1.0.2, finding 7)
      for (const l of links) {
        if (!l || !whole(l.id)) throw bad('A row is missing.');
        if (l.packId != null && l.packId !== '' && !whole(l.packId)) throw bad('Pick a VAN brand pack: only VAN brand packs can be linked to a list row.');
        const id = Number(l.id), pid = l.packId != null && l.packId !== '' ? Number(l.packId) : null;
        if (pid != null && !vanPack.has(pid)) { const pk0 = D.packs.find(k => Number(k.id) === pid); throw bad(pk0 && !D.cpById.get(pk0.client_product_id) ? 'That pack\'s product is out of use (Setup, Product names): pick another pack, or put the product back in use first.' : 'Pick a VAN brand pack: only VAN brand packs can be linked to a list row.'); } // review 1.0.2 re-check 2, A4
        if (l.noPack !== undefined && typeof l.noPack !== 'boolean') throw bad('Mark the row as not a C2M pack, or undo the mark.');
        if (l.noPack === true && pid != null) throw bad('A row linked to a pack cannot also be marked not a C2M pack.');
        const markOp = typeof l.noPack === 'boolean' && !(l.noPack === false && pid != null); // {id, packId, noPack:false} is a link: it takes the mark out (review finding 6)
        if (markOp && req.c2m.role !== 'cfo') throw Object.assign(new Error('Only Yawar marks a row not a C2M pack (D-80).'), { status: 403 });
        const [[row]] = await q('SELECT id, list_name, data_json FROM c2m_list_price WHERE id=? FOR UPDATE', [id]); if (!row) throw bad('A row is not on any VAN brand list.');
        const d = JSON.parse(row.data_json); const was = d.packId != null ? Number(d.packId) : null;
        if (l.wasPack !== undefined && (l.wasPack == null ? null : Number(l.wasPack)) !== was) throw moved(); // the screen showed another link: someone changed this row a moment ago (review 1.0.2, design finding 3)
        /* 1.0.1, I-45 (Tahir, 19 Oct 2026, D-80): Yawar marks a list row whose product C2M does not cost as "not a C2M pack".
           The row stays on its list and prints as before; it stops blocking an added pack and is left out of margin.
           No approval, like a link; logged in the change record; linking the row to a pack, or Undo, clears the mark. */
        if (markOp) {
          const on = !!d.noPack; if (on === l.noPack) continue;
          if (l.noPack && was != null) throw bad(`${d.p}${d.pack ? ' ' + d.pack : ''} is linked to a pack: it is a C2M pack. Unlink it first if the link is wrong (the screen may be out of date: reload).`); // review finding 5
          if (l.noPack) { /* C2M has a pack this row names (name, size and unit agree, B-18): link it instead (review finding 1) */
            const hit = D.packs.find(k => vanPack.has(Number(k.id)) && namesOf(D.cpById.get(k.client_product_id)).some(nm => lib.listRowIs(row.list_name, d, nm, k.pack_size, D.cpById.get(k.client_product_id).sold_per))); // every name of the product: official, spellings, names before a rename (review 1.0.2, finding 4)
            if (hit) { const c = D.cpById.get(hit.client_product_id); throw bad(`C2M has a pack this row names: ${c.brand} ${Number(hit.pack_size)} ${c.sold_per}. Link the row to it instead of marking it not a C2M pack.`); }
            const [pend] = await q("SELECT items_json FROM c2m_list_revision WHERE list_name=? AND (status='proposed' OR (status='approved' AND applied=0))", [row.list_name]);
            const add = pend.flatMap(x => JSON.parse(x.items_json)).find(it => { if (!(it.id == null && it.added)) return false; const pk = D.packs.find(k => Number(k.id) === Number(it.packId)); const c = pk ? D.cpById.get(pk.client_product_id) : null;
              const z = pk ? { v: Number(pk.pack_size), u: c.sold_per || 'kg' } : lib.listRowSize(it.pack); return !!z && [it.product].concat(c ? namesOf(c) : []).some(nm => lib.listRowIs(row.list_name, d, nm, z.v, z.u)); }); // size from the pack itself (500 ml reads as 0.5 L)
            if (add) throw bad(`${add.product} ${add.pack} waits to be added to this list in a revision: this row is that pack. Link it after the revision is decided or takes effect.`); }
          if (!l.noPack) { /* Undo while a revision adds a pack to this list would leave a row with no pack beside that add (review 1.0.1, design finding 6) */
            const [pend] = await q("SELECT items_json FROM c2m_list_revision WHERE list_name=? AND (status='proposed' OR (status='approved' AND applied=0))", [row.list_name]);
            const add = pend.flatMap(x => JSON.parse(x.items_json)).find(it => it.id == null && it.added);
            if (add) throw bad(`A revision that adds ${add.product} ${add.pack} to this list is with Tahir or waits for its date. Undo the mark after it is decided or takes effect.`); }
          if (l.noPack) { delete d.packId; d.noPack = 1; d.noPackBy = req.c2m.user; d.noPackAt = today(); } else { delete d.noPack; delete d.noPackBy; delete d.noPackAt; }
          await q('UPDATE c2m_list_price SET data_json=? WHERE id=?', [JSON.stringify(d), id]);
          await audit(req.c2m.user, 'list_price', String(id), l.noPack ? 'not_c2m_pack' : 'not_c2m_pack_undone', l.noPack ? was : 'not a C2M pack', l.noPack ? 'not a C2M pack' : null, `${row.list_name}: ${d.p}${d.pack ? ' ' + d.pack : ''}`); n++;
          continue;
        }
        if (was === pid) continue;
        if (pid != null) { // 1 row per pack on each list (D-77: each VAN pack held once; this replaces the D-73 tolerance of 2 rows on 1 pack, review 19 Oct)
          const [others] = await q('SELECT id, data_json FROM c2m_list_price WHERE list_name=? AND id<>? FOR UPDATE', [row.list_name, id]); const dupRow = others.find(o => Number(JSON.parse(o.data_json).packId) === pid);
          if (dupRow) throw bad(`Another row of this list (${JSON.parse(dupRow.data_json).p}${JSON.parse(dupRow.data_json).pack ? ' ' + JSON.parse(dupRow.data_json).pack : ''}) is already linked to that pack: each pack has 1 row on a list. Unlink or change that row first.`); }
        if (pid != null) { // a pack waiting to be added to this list by a revision cannot also be linked to a row of it (review 1.0.0, finding 2)
          const [pend] = await q("SELECT items_json FROM c2m_list_revision WHERE list_name=? AND (status='proposed' OR (status='approved' AND applied=0))", [row.list_name]);
          if (pend.some(x => JSON.parse(x.items_json).some(it => it.id == null && it.added && Number(it.packId) === pid))) throw bad(`That pack waits to be added to this list in a revision that is with Tahir or approved and waiting for its date. Link the row after it is decided or takes effect, or ask Tahir to send it back or withdraw it.`); }
        if (pid != null) { /* a row whose size and unit can be read links only to a pack of that size and unit: the link renames the printed row (review 1.0.2 re-checks; the screens offer only those packs) */
          const z = lib.listRowSize(row.list_name === 'farmer' ? d.p : d.pack), pk = D.packs.find(k => Number(k.id) === pid), c0 = D.cpById.get(pk.client_product_id);
          if (z && (Math.abs(z.v - Number(pk.pack_size)) > 1e-6 || z.u !== (c0.sold_per || 'kg'))) throw bad(`${d.p}${d.pack ? ' ' + d.pack : ''} is written as ${lib.officialPack(z.v, z.u)}; ${c0.brand} ${lib.officialPack(pk.pack_size, c0.sold_per)} is another size or unit. Pick a pack of the same size and unit: the link renames the row on the printed list.`); }
        const hadMark = pid != null && !!d.noPack;
        if (pid == null) delete d.packId; else { d.packId = pid; delete d.noPack; delete d.noPackBy; delete d.noPackAt; } // a link clears the "not a C2M pack" mark (D-80)
        let ren = null; if (pid != null) { const pk = D.packs.find(k => Number(k.id) === pid), c0 = D.cpById.get(pk.client_product_id); ren = lib.officialRow(row.list_name, d, c0.brand, pk.pack_size, c0.sold_per); Object.assign(d, ren.nd); } // a linked row takes the official name (D-85)
        else { const rs = lib.restoreRow(d); if (rs.changed) { for (const kk of Object.keys(d)) delete d[kk]; Object.assign(d, rs.nd); ren = { changed: true, was: rs.was, restored: true }; } } // unlinked: its own name back
        await q('UPDATE c2m_list_price SET data_json=?, product=?, pack=? WHERE id=?', [JSON.stringify(d), d.p, d.pack || null, id]);
        await audit(req.c2m.user, 'list_price', String(id), 'link', was, pid, `${row.list_name}: ${d.p}${d.pack ? ' ' + d.pack : ''}${hadMark ? ' (mark "not a C2M pack" taken out)' : ''}${ren && ren.changed ? (ren.restored ? ` (its name before the link given back; was "${ren.was}")` : ` (renamed from "${ren.was}")`) : ''}`); n++;
      }
    });
    res.json({ changed: n });
  }));
  /* ---------- 1.0.2 product names (Tahir, 19 Oct 2026, D-85): 1 name per product; Tahir and Yawar both edit; every change logged ---------- */
  const nmK = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();
  const nmClean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  /** Every name of a product: the official name and each O2S spelling (an official name before a rename is kept as a spelling). */
  const namesOf = c => [...new Set([c.brand].concat(String(c.o2s_brand == null ? '' : c.o2s_brand).split('|')).map(nmClean).filter(Boolean))];
  /** Lock the VAN brand products while names are read and changed, so 2 people saving at once cannot both pass the checks (review 1.0.2, finding 6). */
  async function lockNames() { await q("SELECT id FROM c2m_client_product WHERE channel='VAN brand' ORDER BY id FOR UPDATE"); }
  /** Refuse a name that would place an O2S line of a pack size on 2 products: names (official and spellings) are unique per pack size
   * among active VAN brand products. 2 products may share a trade name when their pack sizes differ (Tahir, 20 Oct 2026, D-85). */
  function nameClash(D, cpId, names, sizes) {
    const mine = sizes || D.packs.filter(k => Number(k.client_product_id) === Number(cpId)).map(k => Number(k.pack_size));
    for (const c of D.cps.filter(c => engine.isVanBrand(c) && Number(c.id) !== Number(cpId))) {
      const theirs = new Set(namesOf(c).map(nmK)); const zs = D.packs.filter(k => Number(k.client_product_id) === Number(c.id)).map(k => Number(k.pack_size));
      const same = mine.filter(z => zs.some(y => Math.abs(y - z) < 1e-9));
      for (const n of names.map(nmClean).filter(Boolean)) if (theirs.has(nmK(n)) && same.length) return `"${n}" is already a name of ${c.brand}, which also has the ${same.map(z => Number(z)).join(', ')} pack: an O2S line could not tell them apart. 2 products can share a name only when their pack sizes differ.`;
    }
    return null;
  }
  /** O2S trucks whose product would change if a product took these names: those that leave it and those that join it (review 1.0.2, finding 2).
   * Rs is the sales value (kg or L x O2S net price); from is the earliest truck date. */
  async function nameImpact(D, cpId, brand, o2s) {
    const cp = D.cpById.get(Number(cpId)); const D2 = { ...D, cpById: new Map(D.cpById) }; D2.cpById.set(Number(cpId), { ...cp, brand, o2s_brand: o2s });
    return truckImpact(D, D2, cpId);
  }
  /** Trucks placed on product cpId under D but not D2 (leave), and under D2 but not D (join). */
  async function truckImpact(D, D2, cpId) {
    const m1 = engine.matcher(D), m2 = engine.matcher(D2); const mine = new Set(D.packs.filter(k => Number(k.client_product_id) === Number(cpId)).map(k => Number(k.id)));
    const [rows] = await q('SELECT t.truck_date, t.kg, p.customer_name, p.channel, p.brand, p.pack, p.net_price FROM c2m_o2s_truck t JOIN c2m_o2s_po_line p ON p.line_id=t.line_id');
    const out = { leave: { trucks: 0, rs: 0, from: null, names: [], open: 0, openKg: 0 }, join: { trucks: 0, rs: 0, from: null, names: [], open: 0, openKg: 0 } };
    /* open O2S order lines (nothing shipped yet) count too: their trucks would arrive with no cost (review 1.0.2 re-check 2, finding 3) */
    const [ol] = await q('SELECT customer_name, channel, brand, pack, open_kg FROM c2m_o2s_po_line WHERE open_kg>0');
    for (const r of ol) { const a = m1(r.customer_name, r.brand, r.channel, r.pack), b = m2(r.customer_name, r.brand, r.channel, r.pack);
      const ia = a && mine.has(Number(a.id)), ib = b && mine.has(Number(b.id)); if (ia === ib) continue; const o = ia ? out.leave : out.join; o.open++; o.openKg += Number(r.open_kg); if (!o.names.includes(r.brand) && o.names.length < 5) o.names.push(r.brand); }
    for (const r of rows) { const a = m1(r.customer_name, r.brand, r.channel, r.pack), b = m2(r.customer_name, r.brand, r.channel, r.pack);
      const ia = a && mine.has(Number(a.id)), ib = b && mine.has(Number(b.id)); if (ia === ib) continue; const o = ia ? out.leave : out.join;
      const dt = String(r.truck_date instanceof Date ? r.truck_date.toISOString() : r.truck_date).slice(0, 10);
      o.trucks++; o.rs += Number(r.kg) * Math.max(0, Number(r.net_price) || 0); if (!o.from || dt < o.from) o.from = dt; if (!o.names.includes(r.brand) && o.names.length < 5) o.names.push(r.brand); }
    out.leave.rs = Math.round(out.leave.rs); out.join.rs = Math.round(out.join.rs);
    for (const o of [out.leave, out.join]) { o.openKg = Math.round(o.openKg); o.n = o.trucks + o.open; } // n: trucks and open order lines; a save carries the n seen
    return out;
  }
  /** Rename every list row linked to the packs of the given products to its official name; returns the rows renamed. */
  async function renameRows(D, user, cpIds, why) {
    const ids = cpIds.map(Number); const packs = new Map(D.packs.filter(k => ids.includes(Number(k.client_product_id))).map(k => [Number(k.id), k])); let n = 0;
    const [rows] = await q("SELECT id, list_name, data_json FROM c2m_list_price WHERE list_name IN ('dist','dealer','farmer') FOR UPDATE");
    const skipped = [];
    for (const r of rows) { const d = JSON.parse(r.data_json); const pk = d.packId != null ? packs.get(Number(d.packId)) : null; if (!pk) continue; const c = D.cpById.get(pk.client_product_id); if (!c) continue;
      const z = lib.listRowSize(r.list_name === 'farmer' ? d.p : d.pack); if (z && (Math.abs(z.v - Number(pk.pack_size)) > 1e-6 || z.u !== (c.sold_per || 'kg'))) { skipped.push(`${d.p}${d.pack ? ' ' + d.pack : ''}`); continue; } // linked to a pack of another size (before 1.0.2): never renamed to it; Product names lists it to unlink (review 1.0.2 re-check 3, finding 1)
      const ren = lib.officialRow(r.list_name, d, c.brand, pk.pack_size, c.sold_per); if (!ren.changed) continue;
      await q('UPDATE c2m_list_price SET data_json=?, product=?, pack=? WHERE id=?', [JSON.stringify(ren.nd), ren.nd.p, ren.nd.pack || null, r.id]);
      await audit(user, 'list_price', String(r.id), 'rename', ren.was, ren.now, `${r.list_name}: ${why}`); n++; }
    return { n, skipped };
  }
  /** VAN brand products out of use with a pack of one of these sizes, with their names. */
  async function offNames(sizes) { if (!sizes.length) return []; const [off] = await q(`SELECT DISTINCT c.id, c.brand, c.o2s_brand FROM c2m_client_product c JOIN c2m_client_pack k ON k.client_product_id=c.id WHERE c.channel='VAN brand' AND c.active=0 AND (${sizes.map(() => 'ABS(k.pack_size-?)<0.0005').join(' OR ')})`, sizes); return off.map(c => ({ ...c, names: namesOf(c) })); }
  /** O2S spellings: unique names (double spaces as 1, case kept), at most 120 characters together (the column's size). */
  const dupName = e => e && (e.code === 'ER_DUP_ENTRY' || e.errno === 1062);
  const canon = v => String(v == null ? '' : v).split('|').filter(Boolean).join('|');
  /** The spellings as stored. The unique key uq_cp (customer, channel, o2s_brand) would stop 2 products that share a trade name from both
   * keeping just that name; a leading | (an empty spelling, ignored everywhere) keeps the stored text apart (review 1.0.2 re-check, finding 3). */
  async function storeO2s(cp, list) { const base = list.join('|');
    for (let pad = 0; pad < 6; pad++) { const v = '|'.repeat(pad) + base; if (v.length > 120) break; const [[x]] = await q('SELECT id FROM c2m_client_product WHERE customer_id=? AND channel=? AND o2s_brand=? AND id<>?', [cp.customer_id, cp.channel, v, cp.id]); if (!x) return v; }
    throw bad('Another product of the VAN brand owner already has exactly these O2S spellings: change one.'); }
  /** Opening step: every linked list row still under another name takes the official name (Tahir: "1 name everywhere"). */
  app.post('/api/c2m/names/rename-linked', need('cfo', 'coo'), wrap(async (req, res) => {
    let n = 0;
    await tx(async () => { await lockNames(); const D = await engine.loadAll(q); n = await renameRows(D, req.c2m.user, D.cps.filter(c => engine.isVanBrand(c)).map(c => c.id), 'official name (D-85)'); }); // names read inside the transaction (review 1.0.2, finding 7)
    res.json({ changed: n.n, skipped: n.skipped });
  }));
  /** Edit a VAN brand product's official name and its O2S spellings. A new official name renames its list rows too.
   * The page sends the names it showed (was): if someone changed them since, nothing is saved (review 1.0.2, finding 1).
   * preview: true answers with the O2S trucks that would leave or join the product, saving nothing; a save that moves trucks
   * must carry the counts the person saw (accept), so no truck loses its cost unseen (review 1.0.2, finding 2). */
  app.post('/api/c2m/names/product/:id', need('cfo', 'coo'), wrap(async (req, res) => {
    const { brand, o2sNames, was, preview, accept } = req.body || {};
    if (!was || typeof was !== 'object' || typeof was.brand !== 'string' || typeof was.o2s !== 'string') throw bad('The page did not send the names it showed: reload and try again.');
    if (brand != null && typeof brand !== 'string') throw bad('Write the official name.');
    if (o2sNames != null && (!Array.isArray(o2sNames) || o2sNames.some(s => typeof s !== 'string'))) throw bad('O2S spellings must be a list of names.');
    const out = await tx(async () => {
      await lockNames(); const D = await engine.loadAll(q); const cp = D.cpById.get(Number(req.params.id));
      if (!cp || !engine.isVanBrand(cp)) throw bad('Pick a VAN brand product.');
      if (cp.brand !== was.brand || String(cp.o2s_brand).split('|').filter(Boolean).join('|') !== was.o2s) throw Object.assign(new Error(`Someone changed the names of ${cp.brand} a moment ago (now: ${namesOf(cp).join(', ')}). Nothing was saved: check them and edit again.`), { status: 409 });
      const nb = nmClean(brand == null ? cp.brand : brand); if (!nb) throw bad('Write the official name.'); if (nb.length > 120) throw bad('The official name can be at most 120 characters.');
      if (/[|]/.test(nb)) throw bad('A name cannot hold the sign |.');
      if (nmK(nb) !== nmK(cp.brand) && lib.listRowSize(nb)) throw bad(`The official name is the trade name only (Tahir, 20 Oct 2026): write it with no pack size; the lists add the pack (1 L, 25 kg, 500 ml).`); // a size in the name would be read as the row's size (review 1.0.2 re-check 4, finding 1)
      const sp = o2sNames == null ? String(cp.o2s_brand).split('|') : o2sNames.slice();
      const uniq = a => { const seen = new Set(); return a.map(nmClean).filter(s => s && !seen.has(nmK(s)) && seen.add(nmK(s))); };
      let list = uniq(sp); if (list.some(s => /[|]/.test(s))) throw bad('A name cannot hold the sign |.');
      let o2s = (list.length ? list : [nb]).join('|'); let imp = await nameImpact(D, cp.id, nb, o2s);
      /* the name before a rename stays as a spelling when O2S trucks are placed by it, so they keep their cost (review 1.0.2, finding 2);
         a name O2S never used is not kept (review 1.0.2 re-check, finding 8) */
      if (nmK(nb) !== nmK(cp.brand) && !list.some(s => nmK(s) === nmK(cp.brand))) {
        const sizes = D.packs.filter(k => Number(k.client_product_id) === Number(cp.id)).map(k => Number(k.pack_size));
        const [lr] = await q("SELECT list_name, data_json FROM c2m_list_price WHERE list_name IN ('dist','dealer','farmer')"); // a row not linked, or marked not a C2M pack, still written with the name before: the guards know it by that name (review 1.0.2, finding 4)
        const rowUses = lr.some(r => { const d = JSON.parse(r.data_json); return d.packId == null && sizes.some(z => lib.listRowIs(r.list_name, d, cp.brand, z, cp.sold_per)); });
        if (imp.leave.n || rowUses) { const l2 = uniq(list.concat(cp.brand)), o2 = l2.join('|'), i2 = await nameImpact(D, cp.id, nb, o2); if (rowUses || i2.leave.n < imp.leave.n) { list = l2; o2s = o2; imp = i2; } } }
      if (o2s.length > 120) throw bad(`The O2S spellings together can be at most 120 characters (now ${o2s.length}). Remove a spelling: the check before saving shows the trucks it carries.`);
      const clash = nameClash(D, cp.id, [nb].concat(list)); if (clash) throw bad(clash);
      { const sizes = D.packs.filter(k => Number(k.client_product_id) === Number(cp.id)).map(k => Number(k.pack_size)); const off = await offNames(sizes); // a name of a product out of use is refused here too (review 1.0.2 re-check 3, finding 2)
        const hit = [nb].concat(list).map(x => ({ x, h: off.find(o => o.names.some(s => nmK(s) === nmK(x))) })).find(y => y.h); if (hit) throw bad(`"${hit.x}" is a name of ${hit.h.brand}, which is out of use and has a pack of the same size: its trucks have no cost on purpose. Put ${hit.h.brand} back in use instead (Setup, Product names), if they should be costed.`); }
      if (cp.brand === nb && canon(cp.o2s_brand) === o2s) return { ok: true, changed: 0, rowsRenamed: 0 };
      if (preview) return { preview: true, impact: imp, brand: nb, o2sNames: list };
      if (imp.leave.n || imp.join.n) { const a = accept || {}; if (Number(a.leave) !== imp.leave.n || Number(a.join) !== imp.join.n) throw Object.assign(new Error(`The O2S trucks and open orders this change moves are not what the check before saving showed (now ${imp.leave.n} leave and ${imp.join.n} join). Nothing was saved: reload the page and check again.`), { status: 409 }); }
      const stored = await storeO2s(cp, o2s.split('|'));
      try { await q('UPDATE c2m_client_product SET brand=?, o2s_brand=? WHERE id=?', [nb, stored, cp.id]); }
      catch (e) { if (dupName(e)) throw bad('Another product of the VAN brand owner already has exactly these O2S spellings: change one.'); throw e; }
      const why = imp.leave.n || imp.join.n ? ` (${imp.leave.trucks} O2S trucks, Rs ${lib.fmtInt(imp.leave.rs)}, and ${imp.leave.open} open order lines leave it; ${imp.join.trucks}, Rs ${lib.fmtInt(imp.join.rs)}, and ${imp.join.open} open lines join it)` : '';
      if (cp.brand !== nb) await audit(req.c2m.user, 'product_name', String(cp.id), 'rename', cp.brand, nb, 'Official name (D-85)' + why);
      if (canon(cp.o2s_brand) !== o2s) await audit(req.c2m.user, 'product_name', String(cp.id), 'o2s_names', canon(cp.o2s_brand), o2s, 'O2S spellings (D-85)' + (cp.brand !== nb ? '' : why));
      let n = { n: 0, skipped: [] }; if (cp.brand !== nb) { const D2 = await engine.loadAll(q); n = await renameRows(D2, req.c2m.user, [cp.id], `official name changed from "${cp.brand}" (D-85)`); }
      return { ok: true, changed: 1, rowsRenamed: n.n, rowsSkipped: n.skipped, impact: imp };
    });
    res.json(out);
  }));
  /** Take a VAN brand product out of use, or put it back (Tahir, 20 Oct 2026: "A button in Setup"). Nothing is deleted: the product,
   * its packs, recipes, costs and history stay; out of use it leaves C2M's screens, the grid and the matcher. preview: true answers with
   * the O2S trucks that would lose (or regain) their cost; the save must carry the counts seen. Refused while a list row is linked to its
   * packs, a revision adds one of its packs, or a price for it waits; back in use, refused when its names clash with a product in use. */
  app.post('/api/c2m/names/product/:id/use', need('cfo', 'coo'), wrap(async (req, res) => {
    const { inUse, preview, accept } = req.body || {}; if (typeof inUse !== 'boolean') throw bad('Say whether the product goes out of use or back in use.');
    const id = Number(req.params.id);
    const out = await tx(async () => {
      await lockNames(); const D = await engine.loadAll(q);
      const [[cp]] = await q("SELECT * FROM c2m_client_product WHERE id=? AND channel='VAN brand' FOR UPDATE", [id]); if (!cp) throw bad('Pick a VAN brand product.');
      if (!!Number(cp.active) === inUse) return { ok: true, changed: 0 };
      const packIds = D.packs.filter(k => Number(k.client_product_id) === id).map(k => Number(k.id));
      let D2;
      if (!inUse) {
        const [rows] = await q("SELECT list_name, data_json FROM c2m_list_price WHERE list_name IN ('dist','dealer','farmer')"); const on = rows.map(r => ({ l: r.list_name, d: JSON.parse(r.data_json) })).filter(x => packIds.includes(Number(x.d.packId)));
        if (on.length) throw bad(`${cp.brand} is on ${on.length} price list ${on.length === 1 ? 'row' : 'rows'} (${on.slice(0, 3).map(x => x.d.p + (x.d.pack ? ' ' + x.d.pack : '')).join('; ')}). Link ${on.length === 1 ? 'that row' : 'those rows'} to the right pack, or unlink, first: a list row cannot point to a product out of use.`);
        const [pend] = await q("SELECT items_json FROM c2m_list_revision WHERE status='proposed' OR (status='approved' AND applied=0)"); if (pend.some(r => JSON.parse(r.items_json).some(it => it.id == null && it.added && packIds.includes(Number(it.packId))))) throw bad(`A list revision adds a pack of ${cp.brand}: take it out of use after the revision is decided or takes effect.`);
        { const [[rv]] = await q("SELECT version_no FROM c2m_recipe_version WHERE client_product_id=? AND state IN ('draft','review','endorse','cost') LIMIT 1", [id]); if (rv) throw bad(`${cp.brand} has recipe version ${rv.version_no} in the workflow (production, QC or cost). Take it out of use once that version is approved: out of use, it could not be approved.`); } // review 1.0.2 re-check 2, A1
        if (packIds.length) { const [[pw]] = await q(`SELECT COUNT(*) n FROM c2m_price WHERE status='proposed' AND client_pack_id IN (${qs(packIds)})`, packIds); if (Number(pw.n)) throw bad(`A price for ${cp.brand} waits for Tahir: decide it first.`); }
        D2 = { ...D, cpById: new Map(D.cpById) }; D2.cpById.delete(id);
      } else {
        const clash = nameClash(D, id, namesOf(cp), (await q('SELECT pack_size FROM c2m_client_pack WHERE client_product_id=?', [id]))[0].map(r => Number(r.pack_size))); if (clash) throw bad(`It cannot come back in use as it is: ${clash}`);
        D2 = D; const Dw = { ...D, cpById: new Map(D.cpById) }; Dw.cpById.set(id, cp); /* compare without and with it */ const imp0 = await truckImpact(Dw, D, id); const imp = { leave: imp0.join, join: imp0.leave };
        if (preview) return { preview: true, impact: imp, brand: cp.brand };
        if (imp.join.n && Number((accept || {}).join) !== imp.join.n) throw Object.assign(new Error('The O2S trucks this change moves are not what the check showed. Nothing was saved: reload the page and check again.'), { status: 409 });
        await q('UPDATE c2m_client_product SET active=1 WHERE id=?', [id]);
        await audit(req.c2m.user, 'product_name', String(id), 'in_use', 'out of use', 'in use', `${cp.brand} back in use (Setup, Product names): ${imp.join.trucks} O2S trucks, Rs ${lib.fmtInt(imp.join.rs)}, and ${imp.join.open} open order lines, costed under it again`);
        return { ok: true, changed: 1, impact: imp };
      }
      const imp = await truckImpact(D, D2, id);
      if (preview) return { preview: true, impact: imp, brand: cp.brand };
      if (imp.leave.n && Number((accept || {}).leave) !== imp.leave.n) throw Object.assign(new Error('The O2S trucks this change moves are not what the check showed. Nothing was saved: reload the page and check again.'), { status: 409 });
      await q('UPDATE c2m_client_product SET active=0 WHERE id=?', [id]);
      await audit(req.c2m.user, 'product_name', String(id), 'out_of_use', 'in use', 'out of use', `${cp.brand} taken out of use (Setup, Product names): ${imp.leave.trucks} O2S trucks, Rs ${lib.fmtInt(imp.leave.rs)}, and ${imp.leave.open} open order lines, lose their cost`);
      return { ok: true, changed: 1, impact: imp };
    });
    res.json(out);
  }));
  /** Settle an O2S name C2M could not place: keep it as a spelling of a VAN brand product that has that pack size, so its trucks are costed at once (C2M never changes O2S). */
  app.post('/api/c2m/names/o2s', need('cfo', 'coo'), wrap(async (req, res) => {
    const { name, productId, size } = req.body || {}; if (typeof name !== 'string') throw bad('The O2S name is missing.');
    const nm = nmClean(name); if (!nm) throw bad('The O2S name is missing.'); if (/[|]/.test(nm)) throw bad('A name cannot hold the sign |.');
    const z = Number(size); if (!(z > 0)) throw bad('The O2S pack size is missing: reload and try again.');
    const out = await tx(async () => {
      await lockNames(); const D = await engine.loadAll(q); const cp = D.cpById.get(Number(productId)); if (!cp || !engine.isVanBrand(cp)) throw bad('Pick a VAN brand product.');
      if (!D.packs.some(k => Number(k.client_product_id) === Number(cp.id) && Math.abs(Number(k.pack_size) - z) < 1e-9)) throw bad(`${cp.brand} has no ${z} pack in C2M, so trucks of "${nm}" ${z} could not be costed under it. Pick the product with that pack, or add the pack first.`); // review 1.0.2, design finding 15
      if (namesOf(cp).some(s => nmK(s) === nmK(nm))) return { ok: true, changed: 0 };
      { const [off] = await q("SELECT c.id, c.brand, c.o2s_brand FROM c2m_client_product c JOIN c2m_client_pack k ON k.client_product_id=c.id WHERE c.channel='VAN brand' AND c.active=0 AND ABS(k.pack_size-?)<0.0005", [z]);
        const hit = off.find(c => namesOf(c).some(s => nmK(s) === nmK(nm))); if (hit) throw bad(`"${nm}" is a name of ${hit.brand}, which is out of use: its trucks have no cost on purpose. Put ${hit.brand} back in use instead (Setup, Product names), if they should be costed.`); } // review 1.0.2 re-check 2, finding 2
      const o2s = String(cp.o2s_brand).split('|').filter(Boolean).concat(nm).join('|'); if (o2s.length > 120) throw bad(`${cp.brand} already has as many O2S spellings as fit: remove one no longer used (Setup, Product names).`);
      const clash = nameClash(D, cp.id, [nm]); if (clash) throw bad(clash);
      const imp = await nameImpact(D, cp.id, cp.brand, o2s);
      try { await q('UPDATE c2m_client_product SET o2s_brand=? WHERE id=?', [await storeO2s(cp, o2s.split('|')), cp.id]); }
      catch (e) { if (dupName(e)) throw bad('Another product of the VAN brand owner already has exactly these O2S spellings: change one.'); throw e; }
      await audit(req.c2m.user, 'product_name', String(cp.id), 'o2s_names', canon(cp.o2s_brand), o2s, `O2S name "${nm}" settled to ${cp.brand} (D-85): ${imp.join.trucks} O2S trucks, Rs ${lib.fmtInt(imp.join.rs)}, now costed under it`);
      return { ok: true, changed: 1, impact: imp };
    });
    res.json(out);
  }));
  app.post('/api/c2m/lists/revise', need('cfo'), wrap(async (req, res) => {
    const { list, items, reason, validFrom, validTill, replaceId } = req.body || {};
    if (!LIST_FIELDS[list]) throw bad('Pick the list.');
    if (!String(reason || '').trim()) throw bad('Write the reason for the revision.');
    if (!isDate(validFrom)) throw bad('Effective date must be a date.');
    if (validFrom < today()) throw bad('The effective date cannot be in the past.');
    if (validTill && (!isDate(validTill) || validTill < validFrom)) throw bad('Valid till must be after the effective date.');
    if (!Array.isArray(items) || !items.length) throw bad('Change at least 1 price.');
    const [rows] = await q('SELECT id, data_json FROM c2m_list_price WHERE list_name=?', [list]); const byId = new Map(rows.map(r => [r.id, JSON.parse(r.data_json)]));
    const out = [];
    /* 1.0.0, VAN brand price grid (Tahir, 19 Oct 2026, D-77): a price typed for a VAN brand pack that has no row on this list
       adds a row for that pack, through the same revision and Tahir's approval. The row carries its pack (packId) from the start. */
    const D0 = items.some(it => it && it.id == null && it.packId != null) ? await engine.loadAll(q) : null;
    const onList = new Set(rows.map(r => JSON.parse(r.data_json).packId).filter(v => v != null).map(Number));
    /* A pack is added only when every row of the list is linked to its pack (D-73), so a row the list already holds under
       another name is never entered twice (1.0.0 review of the grid, I-43). */
    const unlinked = rows.filter(r => { const d = JSON.parse(r.data_json); return d.packId == null && !d.noPack; }).length; // a row marked not a C2M pack does not block (D-80)
    const seenP = new Map(); for (const r of rows) { const pp = JSON.parse(r.data_json).packId; if (pp != null) seenP.set(Number(pp), (seenP.get(Number(pp)) || 0) + 1); }
    const dupN = [...seenP.values()].filter(n => n > 1).length;
    if (D0 && dupN) throw bad(`${dupN} ${dupN === 1 ? 'pack has' : 'packs have'} more than 1 row linked on this list. Correct those links first (More, Reports, VAN brand list margin), so no pack is entered twice.`);
    if (D0 && unlinked) throw bad(`${unlinked} ${unlinked === 1 ? 'row' : 'rows'} of this list ${unlinked === 1 ? 'is' : 'are'} not linked to a pack yet. Link ${unlinked === 1 ? 'it' : 'them'} first, or mark a row of a product C2M does not cost "Not a C2M pack" (Client prices, VAN brand prices, Not placed), so no pack is entered twice.`);
    for (const it of items) {
      if (it && it.id == null && it.packId != null) {
        const pid = Number(it.packId); const pk = D0.packs.find(k => Number(k.id) === pid); const cp = pk ? D0.cpById.get(pk.client_product_id) : null;
        if (!pk || !engine.isVanBrand(cp)) throw bad('Only a VAN brand pack can be added to a VAN brand list.');
        if (onList.has(pid)) throw bad(`${cp.brand} ${Number(pk.pack_size)} ${cp.sold_per} is already on this list: change its price instead.`);
        { const mk = rows.map(r => JSON.parse(r.data_json)).find(x => x.noPack && namesOf(cp).some(nm => lib.listRowIs(list, x, nm, pk.pack_size, cp.sold_per))); // review finding 1 (D-80); every name of the product (review 1.0.2, finding 4)
          if (mk) throw bad(`${mk.p}${mk.pack ? ' ' + mk.pack : ''} on this list is marked not a C2M pack, but it names ${cp.brand} ${Number(pk.pack_size)} ${cp.sold_per}. Undo the mark and link that row, then change its price.`); }
        const to = {};
        for (const f of LIST_FIELDS[list]) if (it.values && it.values[f] != null && it.values[f] !== '') { const v = strictNum(it.values[f]); if (!(v > 0) || (f === 'disc' && v >= 1)) throw bad(`${cp.brand}: ${f} must be a number above 0${f === 'disc' ? ' and below 1' : ''}.`); to[f] = v; }
        if (!Object.keys(to).length) continue;
        onList.add(pid); out.push({ id: null, packId: pid, product: cp.brand, pack: lib.officialPack(pk.pack_size, cp.sold_per), from: {}, to, added: 1 }); continue; // the pack as C2M writes it (D-85; 500 ml, Tahir 20 Oct 2026)
      }
      const cur = byId.get(Number(it.id)); if (!cur) throw bad('A row is not on this list.');
      const to = {};
      for (const f of LIST_FIELDS[list]) if (it.values && it.values[f] != null && it.values[f] !== '') { const v = strictNum(it.values[f]); if (!(v >= 0) || (f === 'disc' && v >= 1)) throw bad(`${cur.p}: ${f} must be a number${f === 'disc' ? ' below 1 (e.g. 0.05 for 5%)' : ''}.`); to[f] = v; }
      if (!Object.keys(to).length || LIST_FIELDS[list].every(f => to[f] == null || Number(to[f]) === Number(cur[f]))) continue;
      const from = Object.fromEntries(Object.keys(to).map(f => [f, cur[f] ?? null]));
      out.push({ id: Number(it.id), product: cur.p, pack: cur.pack || null, from, to });
    }
    if (!out.length) throw bad('No price changed.');
    const id = await tx(async () => {
      if (out.some(it => it.added)) { await lockNames(); for (const it of out.filter(x => x.added)) { const [[c]] = await q('SELECT c.active, c.brand FROM c2m_client_pack k JOIN c2m_client_product c ON c.id=k.client_product_id WHERE k.id=?', [it.packId]); if (!c || !Number(c.active)) throw bad(`${it.product} ${it.pack} is out of use (Setup, Product names): it cannot be added to a list.`); } } // review 1.0.2 re-check 2, finding 1
      const [[wait]] = await q("SELECT valid_from FROM c2m_list_revision WHERE list_name=? AND status='approved' AND applied=0 FOR UPDATE", [list]);
      if (wait) throw bad(`A revision of this list is approved and waits for ${String(wait.valid_from).slice(0, 10)}. Ask Tahir to withdraw it first, or wait until it takes effect.`);
      const [[open]] = await q("SELECT id FROM c2m_list_revision WHERE list_name=? AND status='proposed' FOR UPDATE", [list]); if (open) throw bad('This list already has a revision waiting for Tahir.');
      if (replaceId) { const [u] = await q("UPDATE c2m_list_revision SET status='replaced' WHERE id=? AND list_name=? AND status='sent_back'", [replaceId, list]); if (!u.affectedRows) throw moved(); await audit(req.c2m.user, 'list_revision', replaceId, 'replaced', 'sent_back', 'replaced', 'Revised and sent again'); }
      // 1.0.0: a new revision of the list also closes any older sent-back revision of it (review 19 Oct)
      const [oldR] = await q("SELECT id FROM c2m_list_revision WHERE list_name=? AND status='sent_back' FOR UPDATE", [list]);
      for (const o of oldR) { await q("UPDATE c2m_list_revision SET status='replaced' WHERE id=?", [o.id]); await audit(req.c2m.user, 'list_revision', o.id, 'replaced', 'sent_back', 'replaced', 'A newer revision of the same list was sent'); }
      const [r] = await q('INSERT INTO c2m_list_revision (list_name, items_json, reason, valid_from, valid_till, proposed_by, proposed_at) VALUES (?,?,?,?,?,?,?)', [list, JSON.stringify(out), String(reason).slice(0, 400), validFrom, validTill || null, req.c2m.user, now()]);
      await audit(req.c2m.user, 'list_revision', r.insertId, 'propose', null, { list, rows: out.length }, reason);
      return r.insertId;
    });
    res.json({ id, rows: out.length });
  }));
  app.post('/api/c2m/lists/revisions/:id/approve', need('coo'), wrap(async (req, res) => {
    await tx(async () => {
      await lockNames(); // names before the revision row, as every route that changes names (lock order)
      const [[r]] = await q("SELECT * FROM c2m_list_revision WHERE id=? AND status='proposed' FOR UPDATE", [req.params.id]); if (!r) throw moved(); notSelf(r.proposed_by, req.c2m.user);
      { const adds = JSON.parse(r.items_json).filter(it => it.id == null && it.added); if (adds.length) { for (const it of adds) { const [[c]] = await q('SELECT c.active FROM c2m_client_pack k JOIN c2m_client_product c ON c.id=k.client_product_id WHERE k.id=?', [it.packId]); if (!c || !Number(c.active)) throw bad(`${it.product} ${it.pack} is out of use now: send this revision back to Yawar.`); } } } // review 1.0.2 re-check 2, finding 1
      const [u] = await q("UPDATE c2m_list_revision SET status='approved', decided_by=?, decided_at=? WHERE id=? AND status='proposed'", [req.c2m.user, now(), r.id]); if (!u.affectedRows) throw moved();
      const waits = String(r.valid_from).slice(0, 10) > today() ? String(r.valid_from).slice(0, 10) : null;
      if (!waits) await applyRevision(r);
      await audit(req.c2m.user, 'list_revision', r.id, 'approve', null, { list: r.list_name, waitsUntil: waits }, r.reason);
      res.locals.out = { ok: true, waitsUntil: waits };
    });
    res.json(res.locals.out);
  }));
  app.post('/api/c2m/lists/revisions/:id/withdraw', need('coo'), wrap(async (req, res) => {
    const why = String((req.body || {}).why || '').trim(); if (!why) throw bad('Write why the waiting revision is withdrawn.');
    await tx(async () => {
      const [[r]] = await q("SELECT * FROM c2m_list_revision WHERE id=? AND status='approved' AND applied=0 FOR UPDATE", [req.params.id]); if (!r) throw moved();
      const [u] = await q("UPDATE c2m_list_revision SET status='withdrawn' WHERE id=? AND status='approved' AND applied=0", [r.id]); if (!u.affectedRows) throw moved();
      await audit(req.c2m.user, 'list_revision', r.id, 'withdrawn', null, null, why);
      const [[d]] = await q("SELECT COUNT(*) n FROM c2m_price_doc WHERE audience IN (?,?,?,?,?,?) AND effective>=?", r.list_name === 'dist' ? ['dist', 'dist', 'dist', 'dist', 'dist', 'dist', String(r.valid_from).slice(0, 10)] : r.list_name === 'dealer' ? ['dealer', 'dealer', 'dealer', 'dealer', 'dealer', 'dealer', String(r.valid_from).slice(0, 10)] : ['farmer_pb', 'farmer_sn', 'farmer_snc', 'web', 'web', 'web', String(r.valid_from).slice(0, 10)]);
      await notice('cfo', `Tahir withdrew the ${r.list_name} list revision waiting from ${String(r.valid_from).slice(0, 10)}. Why: ${why.slice(0, 150)}${d.n ? `. ${d.n} price list(s) dated on or after it were already issued: tell those who received them.` : ''}`, req.c2m.user);
    });
    res.json({ ok: true });
  }));
  /** Put an approved revision's prices into its list (on approval, or on its date). */
  async function applyRevision(r) {
      await lockNames(); // names read below (an added row's official name) wait for a rename being saved (review 1.0.2 re-check, finding 6)
      const [ok] = await q("UPDATE c2m_list_revision SET applied=1 WHERE id=? AND applied=0 AND status='approved'", [r.id]); if (!ok.affectedRows) return false;
      const fed = await fedNow(true);
      // Distributor list: prev is the price on the last list actually sent (Tahir 18 Oct 2026, D-42, I-21). It changes only when a
      // distributor list is issued. Until C2M has issued one, the list loaded from Yawar is the last one sent: the first revision
      // takes each row's price before it as prev, once (sentSet).
      if (r.list_name === 'dist') { const [all] = await q("SELECT id, data_json FROM c2m_list_price WHERE list_name='dist' FOR UPDATE");
        for (const row of all) { const d = JSON.parse(row.data_json); if (d.sentSet || d.now == null) continue; d.prev = d.now; d.sentSet = 1; await q('UPDATE c2m_list_price SET data_json=? WHERE id=?', [JSON.stringify(d), row.id]); } }
      for (const it of JSON.parse(r.items_json)) {
        if (it.id == null && it.added) { // a new row for a VAN brand pack (D-77)
          /* If a row of this list was linked to the pack after the revision was sent, that row takes the prices: never a second row (review 1.0.0, finding 2). */
          const [same] = await q('SELECT id, data_json FROM c2m_list_price WHERE list_name=? FOR UPDATE', [r.list_name]); const hit = same.find(x => Number(JSON.parse(x.data_json).packId) === Number(it.packId));
          if (hit) { const d0 = JSON.parse(hit.data_json); if (r.list_name !== 'dist') d0.prevValues = { ...(d0.prevValues || {}), ...Object.fromEntries(Object.keys(it.to).map(f => [f, d0[f]])) }; Object.assign(d0, it.to); await q('UPDATE c2m_list_price SET data_json=? WHERE id=?', [JSON.stringify(deriveList(r.list_name, d0, fed)), hit.id]); continue; }
          const d = deriveList(r.list_name, addedRow(r.list_name, { ...it, ...((await packNameNow(it.packId)) || {}) }), fed); // under the official name of the day it takes effect (review 1.0.2, design finding 5)
          await q('INSERT INTO c2m_list_price (list_name, product, spec, pack, data_json, issued, valid_till) VALUES (?,?,?,?,?,?,?)', [r.list_name, d.p, null, d.pack || null, JSON.stringify(d), String(r.valid_from).slice(0, 10), r.valid_till ? String(r.valid_till).slice(0, 10) : null]);
          continue;
        }
        const [[row]] = await q('SELECT data_json FROM c2m_list_price WHERE id=? FOR UPDATE', [it.id]); if (!row) continue; // locked: a link or mark made at the same moment is kept, not overwritten (review 1.0.1, finding 4)
        const d = JSON.parse(row.data_json);
        if (r.list_name !== 'dist') d.prevValues = { ...(d.prevValues || {}), ...Object.fromEntries(Object.keys(it.to).map(f => [f, d[f]])) };
        Object.assign(d, it.to);
        await q('UPDATE c2m_list_price SET data_json=? WHERE id=?', [JSON.stringify(deriveList(r.list_name, d, fed)), it.id]);
      }
      if (r.valid_till) await q('UPDATE c2m_list_price SET issued=?, valid_till=? WHERE list_name=?', [String(r.valid_from).slice(0, 10), String(r.valid_till).slice(0, 10), r.list_name]);
      else await q('UPDATE c2m_list_price SET issued=?, valid_till=IF(valid_till IS NOT NULL AND valid_till >= ?, valid_till, NULL) WHERE list_name=?', [String(r.valid_from).slice(0, 10), String(r.valid_from).slice(0, 10), r.list_name]);
      return true;
  }
  /** Revisions approved ahead of their date take effect on it (checked whenever C2M loads). */
  async function applyDueRevisions() {
    const [due] = await q("SELECT * FROM c2m_list_revision WHERE status='approved' AND applied=0 AND valid_from<=? ORDER BY valid_from, id", [today()]);
    for (const r of due) await tx(async () => { if (await applyRevision(r)) await audit('c2m', 'list_revision', r.id, 'applied', null, { list: r.list_name }, 'Effective date reached'); });
  }
  app.post('/api/c2m/lists/revisions/:id/sendback', need('coo'), wrap(async (req, res) => {
    const reason = String((req.body || {}).reason || '').trim(); if (!reason) throw bad('Write a reason.');
    const [u] = await q("UPDATE c2m_list_revision SET status='sent_back', back_reason=?, decided_by=?, decided_at=? WHERE id=? AND status='proposed'", [reason.slice(0, 400), req.c2m.user, now(), req.params.id]);
    if (!u.affectedRows) throw moved();
    await audit(req.c2m.user, 'list_revision', req.params.id, 'sent_back', null, null, reason);
    res.json({ ok: true });
  }));

  /* ---------- Price list documents ---------- */
  async function docData(aud, b) {
    await applyDueRevisions();
    const fed = await fedNow();
    const [lp] = await q('SELECT id, list_name, data_json, issued, valid_till FROM c2m_list_price ORDER BY id');
    const listKey = aud === 'dist' ? 'dist' : aud === 'dealer' ? 'dealer' : 'farmer';
    // A document dated ahead shows the list as it will be on that date: the waiting revision applied over today's rows
    if (aud !== 'wl' && b.eff && isDate(b.eff) && b.eff > today()) {
      const [w] = await q("SELECT * FROM c2m_list_revision WHERE list_name=? AND status='approved' AND applied=0 AND valid_from<=? ORDER BY valid_from, id", [listKey, b.eff]);
      for (const r of w) {
        if (r.list_name === 'dist') for (const row of lp.filter(x => x.list_name === 'dist')) { const d = JSON.parse(row.data_json); if (!d.sentSet && d.now != null) { d.prev = d.now; d.sentSet = 1; row.data_json = JSON.stringify(d); } } // as applyRevision (D-42)
        for (const it of JSON.parse(r.items_json)) { if (it.id == null && it.added) { lp.push({ id: null, list_name: r.list_name, data_json: JSON.stringify(deriveList(r.list_name, addedRow(r.list_name, { ...it, ...((await packNameNow(it.packId)) || {}) }), fed)), issued: r.valid_from, valid_till: r.valid_till }); continue; } const row = lp.find(x => x.id === it.id); if (!row) continue;
          const d = JSON.parse(row.data_json); Object.assign(d, it.to); row.data_json = JSON.stringify(deriveList(r.list_name, d, fed)); }
        // The list's dates change for every row of the list, as applyRevision does: no end date before the new start
        for (const row of lp.filter(x => x.list_name === r.list_name)) { row.issued = r.valid_from; row.valid_till = r.valid_till || (row.valid_till && String(row.valid_till).slice(0, 10) >= String(r.valid_from).slice(0, 10) ? row.valid_till : null); }
      }
    }
    const L = groupLists(lp);
    const own = L.dates[listKey] || {};
    const base = { ref: b.ref, date: today(), eff: b.eff || (aud === 'wl' ? null : own.issued || L.issued), till: b.till || (aud === 'wl' ? null : own.till) || null, note: String(b.note || '').slice(0, 300), fedPct: fed }; // the FED % printed stays with the document (D-72)
    if (aud === 'wl') {
      const D = await engine.loadAll(q); const [prices] = await q("SELECT * FROM c2m_price WHERE status='approved'");
      const ap = inForce(prices, b.eff && isDate(b.eff) ? b.eff : today()); // prices in force on the document's own date
      const wl = (await wlListData(D, ap, [b.client]))[b.client]; if (!wl) throw bad('Pick a white label client.');
      // Effective date: Yawar's date if he set one, else the latest start date of this client's approved prices (review M3)
      const last = wl.rows.map(r => String(ap.get(r.packId).valid_from).slice(0, 10)).sort().pop();
      return { ...base, eff: base.eff || last || today(), addressee: D.customers.find(c => c.name === b.client).name, rule: wl.rule, wl: wl.rows };
    }
    const list = aud === 'dist' ? L.dist : aud === 'dealer' ? L.dealer : L.farmer;
    return { ...base, list };
  }
  async function viewerMay(user, aud, client) {
    const [g] = await q('SELECT grant_kind, grant_value FROM c2m_list_grant WHERE username=?', [user]);
    if (aud === 'wl') return g.some(x => x.grant_kind === 'client' && x.grant_value === client);
    return g.some(x => x.grant_kind === 'list' && (x.grant_value === aud || (aud === 'web' && x.grant_value === 'farmer_pb')));
  }
  app.post('/api/c2m/pricedocs', wrap(async (req, res) => {
    const b = req.body || {}; const aud = b.audience;
    if (!PL.AUDIENCES[aud]) throw bad('Pick who the list is for.');
    if (!['cfo', 'coo'].includes(req.c2m.role) && !(req.c2m.role === 'viewer' && await viewerMay(req.c2m.user, aud, b.client))) throw Object.assign(new Error('This list is not granted to you.'), { status: 403 });
    const allowed = PL.fieldsFor(aud).map(f => f[0]);
    const fields = (Array.isArray(b.fields) ? b.fields : allowed).filter(f => allowed.includes(f)); if (!fields.length) throw bad('Pick at least 1 field.');
    const viewer = req.c2m.role === 'viewer';
    if (!viewer && b.eff && !isDate(b.eff)) throw bad('Effective date must be a date.');
    if (!viewer && b.till && (!isDate(b.till) || (b.eff && b.till < b.eff))) throw bad('Valid till must be a date after the effective date.');
    const opts = viewer ? { client: b.client } : { client: b.client, eff: b.eff, till: b.till, note: b.note };
    const reasons = viewer ? {} : (b.reasons && typeof b.reasons === 'object' ? b.reasons : {});
    const id = await tx(async () => {
      const yr = today().slice(0, 4);
      const [[n]] = await q("SELECT COUNT(*) n FROM c2m_price_doc WHERE ref LIKE ? FOR UPDATE", [`VAN/PL/${yr}/%`]);
      const ref = `VAN/PL/${yr}/${String(n.n + 1).padStart(3, '0')}`;
      const data = await docData(aud, { ...opts, ref });
      const [r] = await q('INSERT INTO c2m_price_doc (ref, audience, addressee, fields_json, effective, valid_till, created_by, created_at) VALUES (?,?,?,?,?,?,?,?)',
        [ref, aud, data.addressee || PL.title(aud, data).to, JSON.stringify({ fields, client: b.client || null, reasons, note: data.note, snapshot: data }), data.eff, data.till, req.c2m.user, now()]);
      await audit(req.c2m.user, 'price_doc', r.insertId, 'create', null, { ref, aud, client: b.client || null }, null);
      // A distributor list issued is the list the distributors now have: each row's printed price becomes its prev (D-42)
      if (aud === 'dist') { const printed = new Map((data.list || []).map(x => [`${x.p}|${x.pack || ''}`, x.now]));
        const [all] = await q("SELECT id, data_json FROM c2m_list_price WHERE list_name='dist' FOR UPDATE");
        for (const row of all) { const d = JSON.parse(row.data_json); const k = `${d.p}|${d.pack || ''}`; if (!printed.has(k) || printed.get(k) == null) continue; d.prev = printed.get(k); d.sentSet = 1; await q('UPDATE c2m_list_price SET data_json=? WHERE id=?', [JSON.stringify(d), row.id]); } }
      return { id: r.insertId, ref };
    });
    res.json(id);
  }));
  app.get('/api/c2m/pricedocs/:id/pdf', wrap(async (req, res) => {
    const [[d]] = await q('SELECT * FROM c2m_price_doc WHERE id=?', [req.params.id]); if (!d) throw bad('Document not found.');
    const meta = JSON.parse(d.fields_json);
    if (!['cfo', 'coo'].includes(req.c2m.role) && (d.created_by !== req.c2m.user || !(await viewerMay(req.c2m.user, d.audience, meta.client))))
      throw Object.assign(new Error('This document is not yours, or the list is no longer granted to you.'), { status: 403 });
    // The document prints exactly as issued: the rows were saved with it (older documents rebuild from today's prices).
    const data = meta.snapshot || await docData(d.audience, { client: meta.client, ref: d.ref, eff: String(d.effective).slice(0, 10), till: d.valid_till ? String(d.valid_till).slice(0, 10) : null, note: meta.note });
    PL.pdf(res, d.audience, data, meta.fields, meta.reasons || {});
  }));

  /* ---------- System documentation (mandatory, ruled 15 Oct) ---------- */
  app.get('/api/c2m/docs/:file', wrap(async (req, res) => {
    const f = path.basename(String(req.params.file)); if (!/^[0-9a-z-]+\.md$/.test(f)) throw bad('Unknown document.');
    const p = path.join(__dirname, 'docs', f); if (!fs.existsSync(p)) throw bad('Unknown document.');
    if (!docAllowed(req.c2m.role, f)) throw Object.assign(new Error('Not available to your role.'), { status: 403 });
    res.type('text/plain; charset=utf-8').send(fs.readFileSync(p, 'utf8'));
  }));
};

module.exports.ROLES = ROLES;
