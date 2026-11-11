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
const { pullO2S, o2sBaseBrands } = require('./c2m-o2s');
const PL = require('./c2m-pricelist');
const PC = require('./c2m-pricecheck');

/* Roles (stored in user_module_roles, module 'c2m'). Access matrix: docs/11-access-and-roles.md */
const AC = require('./c2m-access');
/* The 6 roles C2M began with. Kept for the platform, which reads module.exports.ROLES at start; the live list is the table c2m_role (migration 002, D-90). */
const ROLES = Object.fromEntries(AC.BUILTIN.map(k => [k, { label: AC.SEED[k].label, ...AC.navFor(AC.SEED[k].actions) }]));

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
  const dryStore = new AsyncLocalStorage(); // effect before saving (push 2a): set only inside a ?dry=1 save
  const clean = p => Array.isArray(p) ? p.map(v => (v === undefined ? null : v)) : p;
  const q = (sql, p) => {
    /* Effect before saving (push 2a): in a dry run every re-approval item a save would write is listed instead (review 5 Nov, finding 1:
       packing price writes its own item, not through reapprovalFor). The rest of the save runs and is rolled back. */
    const dry = dryStore.getStore(); if (dry && /^\s*INSERT INTO c2m_reapproval\b/i.test(sql)) { try { dry.items.push(...JSON.parse((p || [])[1] || '[]')); } catch (_) {} return Promise.resolve([{ insertId: 0, affectedRows: 1 }]); }
    const c = txStore.getStore(); return c ? c.execute(sql, clean(p)) : deps.pdq(sql, clean(p)); };
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
  /* Effect before saving (Tahir and Yawar, 5 Nov 2026, R14; push 2a). A cost save called with ?dry=1 runs exactly as a real
     save, inside 1 transaction, and is then rolled back: nothing is kept, no notice is sent. reapprovalFor collects the packs
     that would wait for re-approval instead of writing them. The page shows them before the real Save. */
  const DRY = Symbol('dry');
  const dryable = fn => async (req, res) => {
    if (![].concat((req.query || {}).dry || []).map(String).includes('1')) return fn(req, res); // ?dry=1 (also when sent twice)
    if (mountFault) throw Object.assign(new Error(mountFault), { status: 503 });
    if (!deps.pool || txStore.getStore()) throw Object.assign(new Error('C2M cannot show the effect here (no database transaction). Nothing was saved.'), { status: 503 }); // never save by accident
    res.json(await runDry(fn, req));
  };
  /** Run a save inside 1 transaction and roll it back; its refusal is thrown as itself. Used by ?dry=1 and by Next week's costs. */
  async function runDry(fn, req) {
    if (!deps.pool || txStore.getStore()) throw Object.assign(new Error('C2M cannot show the effect here (no database transaction). Nothing was saved.'), { status: 503 });
    const box = { items: [], answer: null }; const fake = { json: o => { box.answer = o; return fake; }, status: () => fake, setHeader: () => fake };
    try { await tx(() => dryStore.run(box, async () => { await fn(req, fake); throw DRY; })); } catch (e) { if (e !== DRY) throw e; }
    const S = (await engine.loadAll(q)).settings.values;
    return { dry: true, reapprovePct: S.reapprove_pct != null && S.reapprove_pct !== '' ? Number(S.reapprove_pct) : 3, answer: box.answer, items: box.items.slice(0, 200), count: box.items.length };
  }
  /** A query on the piece 3 link tables: [] if migration 003 has not been run yet. */
  const softQ = async (sql, p) => { try { return await q(sql, p); } catch (e) { if (e && (e.code === 'ER_NO_SUCH_TABLE' || e.errno === 1146)) return [[]]; throw e; } };
  const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) && !isNaN(Date.parse(d));

  /* ---------- Access: c2m role from the platform's role registry ---------- */
  /* The roles: the table c2m_role when migration 002 has been run, else the 6 built in (so a deploy before the migration locks nobody out). */
  async function loadRoles() {
    try {
      const [rows] = await q('SELECT role_key, label, is_admin, actions_json FROM c2m_role');
      if (rows.length) return new Map(rows.map(r => { let a = []; try { a = JSON.parse(r.actions_json); } catch (e) {} return [r.role_key, AC.shape(r.role_key, { label: r.label, admin: !!Number(r.is_admin), actions: Array.isArray(a) ? a : [] })]; }));
    } catch (e) { if (!/c2m_role|doesn't exist|ER_NO_SUCH_TABLE/i.test(String(e && (e.code || e.message)))) throw e; }
    return new Map(AC.BUILTIN.map(k => [k, AC.shape(k, AC.SEED[k])]));
  }
  async function c2mAuth(req, res, next) {
    try {
      const [[r]] = await q("SELECT role FROM user_module_roles WHERE username=? AND module='c2m'", [req.user.u]);
      const RM = await loadRoles(); const R = r ? RM.get(r.role) : null;
      if (!R) return res.status(403).json({ error: 'You do not have a C2M role. Ask your System Administrator to give you one in People and access.' });
      req.c2m = { role: R.key, user: req.user.u, name: req.user.n || req.user.name || req.user.u, label: R.label, admin: R.admin, actions: R.actions, can: R.can, nav: R.nav, more: R.more, roles: RM }; // RM: the roles read once for this request (speed, D-145)
      next();
    } catch (e) { next(e); }
  }
  /** can('action'): the route runs only when this person's role holds the action; the administrator role holds every action. */
  const can = (...actions) => (req, res, next) => actions.some(a => req.c2m.can.has(a)) ? next() : res.status(403).json({ error: 'Your role cannot do this in C2M.' });
  const mayDo = (req, a) => req.c2m.can.has(a);
  /** The people who hold an administrator role now (lower case), so the page shows Approve only on what an administrator proposed (D-89). */
  async function adminUsers(roles) {
    const R = roles || await loadRoles(); const [h] = await q("SELECT username, role FROM user_module_roles WHERE module='c2m'");
    return new Set(h.filter(x => R.get(x.role) && R.get(x.role).admin).map(x => String(x.username).toLowerCase()));
  }
  const wrap = fn => (req, res) => fn(req, res).catch(e => {
    if (e && (e.errno === 1213 || e.errno === 1205 || e.code === 'ER_LOCK_DEADLOCK' || e.code === 'ER_LOCK_WAIT_TIMEOUT')) e = moved();
    if (e && e.code === 'ER_NO_SUCH_TABLE') { e = Object.assign(new Error('C2M is not switched on yet: IT has 1 step to run. Nothing was saved; try again after IT has run it.'), { status: 503 }); }
    if (!e.status) console.error('[c2m]', e);
    if (res.headersSent) return res.end();
    res.status(e.status || 500).json({ error: e.status ? e.message : 'Something went wrong and nothing was saved. Press Refresh and try again; if it happens again, tell IT the time.' });
  });
  const bad = msg => Object.assign(new Error(msg), { status: 400 });
  async function audit(by, entity, id, action, oldV, newV, why) {
    await q('INSERT INTO c2m_audit (at, by_user, entity, entity_id, action, old_value, new_value, why) VALUES (?,?,?,?,?,?,?,?)',
      [now(), by, entity, id == null ? null : String(id), action, oldV == null ? null : JSON.stringify(oldV), newV == null ? null : JSON.stringify(newV), why || null]);
  }
  /** After a change (packing bill, rule, correction), batch every pack whose cost now differs from its
   *  approved cost by more than the threshold, once per cause (ruled 10 Oct). Packs already waiting are left out. */
  /** Once (Tahir, 26 Oct 2026): every costed pack with no approved cost, not a follower, goes onto Approvals as 1 first-cost item. */
  let sweepRun = null;
  function sweepOnce(user) {
    if (!sweepRun) sweepRun = (async () => {
      const [[a]] = await q("SELECT id FROM c2m_audit WHERE entity='first_cost_sweep' LIMIT 1"); if (a) return;
      const D = await engine.loadAll(q);
      const n = await reapprovalFor(`Packs with no approved cost, found once on ${today()}`, p => { const fol = (D.ext.get(p.client_product_id) || {}).followsId; return !fol && !engine.latestApproved(D, p.id); });
      await audit('c2m', 'first_cost_sweep', null, 'run', null, { packs: n, openedBy: user }, 'One time, after the 26 Oct 2026 version');
    })().catch(e => { sweepRun = null; throw e; });
    return sweepRun;
  }
  async function reapprovalFor(cause, filter) {
    const D = await engine.loadAll(q); const S = D.settings.values;
    const [open] = await q("SELECT items_json FROM c2m_reapproval WHERE status='open'");
    const waiting = new Set(); open.forEach(r => JSON.parse(r.items_json).forEach(i => waiting.add(i.packId)));
    const items = [];
    for (const p of D.packs) {
      if (waiting.has(p.id) || (filter && !filter(p, D))) continue; // the filter gets this loadAll too
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
  /* ---------- Month end (push 4, R8 to R10, R23, R43 to R45, D-154) ---------- */
  const PROD = { has: null, at: 0 };
  async function prodReady() { if (PROD.has != null && Date.now() - PROD.at < 60000) return PROD.has; try { const [t] = await q("SHOW TABLES LIKE 'c2m_o2s_production'"); PROD.has = t.length > 0; PROD.at = Date.now(); } catch (_) { return false; } return PROD.has; }
  const ME_ENT = ['lf_rate', 'lf_pick', 'freight', 'packing_rate', 'packing_item', 'packing_bill', 'conversion_rule', 'setting']; /* a held change is listed when it goes in, under its own kind (review 4, finding 9) */
  /** Labour and FOH charged on kg made in 1 month (R10, R43): each O2S production entry at the rate its product was on that day;
   *  stock made for no brand at its base product's rate, or Low when that base's products are on different rates. */
  async function absorbedFor(D, month, prodRows, poLines, match, C) {
    /* C: lookups shared across months (review 4, finding 5) */
    C = C || {};
    const byPoBrand = C.byPoBrand || (C.byPoBrand = (() => { const m0 = new Map(); for (const l of poLines) { const k = String(l.po) + '|' + String(l.brand); if (!m0.has(k)) m0.set(k, l); } return m0; })());
    const packOf = C.packOf || (C.packOf = (() => { const m0 = new Map(); for (const p of D.packs) if (!m0.has(p.client_product_id)) m0.set(p.client_product_id, p); return m0; })());
    /* A stock batch's base is O2S's base name (Potassium Humate, NP 6.32): its C2M products are those whose brand, or an
       O2S name on them, O2S packs from that base (fix 4b, 6 Nov 2026; push 4 keyed this on C2M's production lines). */
    if (!('bb' in C)) C.bb = await o2sBaseBrands(q); const bb = C.bb; /* null: O2S's product master could not be read */
    const cpsOfBase = C.cpsOfBase || (C.cpsOfBase = (() => { const nm = x => String(x == null ? '' : x).replace(/\s+/g, ' ').trim().toLowerCase(); const m0 = new Map();
      /* the product's own name counts only for a VAN brand product, as in engine.matcher (review 4b, finding 2) */
      for (const [base, brands] of (bb || new Map())) { const cs = D.cps.filter(c => (c.channel === 'VAN brand' && brands.has(nm(c.brand))) || String(c.o2s_brand || '').split('|').some(b => brands.has(nm(b)))); if (cs.length) m0.set(base, cs); }
      return m0; })());
    const stockConv = C.stockConv || (C.stockConv = new Map());
    const firstPack = cp => packOf.get(cp.id) || { pack_size: 1 };
    /* R47 (Tahir, 6 Nov 2026): kg made in the month of the first labour and FOH rate, before that rate's day, is charged at the
       rates of that first day (October 2026: 1 to 12 Oct at the 13 Oct rates). Month end only; costs and prices keep their days. */
    const first = 'first' in C ? C.first : (C.first = (D.rules || []).filter(r => Number(r.rsPerKg) > 0 && (r.kind === 'labour' || r.kind === 'foh')) /* active or not: the first day stays fixed if old rates are later switched off (review R47, M2) */.map(r => String(r.validFrom).slice(0, 10)).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()[0] || null);
    const rateDay = day => first && day < first && day.slice(0, 7) === first.slice(0, 7) ? first : day;
    const out = { kg: 0, earlyKg: 0, stockKg: 0, splitKg: 0, unknownKg: 0, unmatchedKg: 0, noRateKg: 0, labour: {}, foh: {}, products: {} };
    const add = (kind, r, kg) => { const nm = r && r.name ? r.name : null; if (!nm || !(r.rsPerKg > 0)) return false; const x = out[kind][nm] || (out[kind][nm] = { kg: 0, rs: 0, rates: {} }); x.kg += kg; x.rs += kg * r.rsPerKg; x.rates[r.rsPerKg] = true; return true; };
    for (const r of prodRows) { const made = String(r.made_on).slice(0, 10); if (made.slice(0, 7) !== month) continue; const kg = Number(r.kg); out.kg += kg; const day = rateDay(made); if (day !== made) out.earlyKg += kg;
      let cp = null, pk = null; if (r.po && r.brand) { const l = byPoBrand.get(String(r.po) + '|' + String(r.brand)); pk = l ? match(l.customer_name, l.brand, l.channel, l.pack) : null; cp = pk ? D.cpById.get(pk.client_product_id) : null; if (!cp) out.unmatchedKg += kg; }
      let conv = null;
      if (cp) { conv = engine.conversionOf(D, cp, pk || firstPack(cp), day); const k = cp.brand + ' · ' + ((D.custById.get(cp.customer_id) || {}).name || ''); const pr = out.products[k] || (out.products[k] = { kg: 0, labour: conv.labour ? conv.labour.name : null, foh: conv.foh ? conv.foh.name : null }); pr.kg += kg; } /* the PO line's own pack (review 4, finding 11) */
      else { out.stockKg += kg; const base = String(r.base || '').replace(/\s+/g, ' ').trim().toLowerCase(); const ck = base + '|' + day;
        if (!stockConv.has(ck)) { const cps = base ? (cpsOfBase.get(base) || []) : []; let v;
          if (!cps.length) v = { kind: 'unknown', conv: null };
          else { const convs = cps.map(c => engine.conversionOf(D, c, firstPack(c), day)); const same = convs.every(c => (c.labour || {}).name === (convs[0].labour || {}).name && (c.foh || {}).name === (convs[0].foh || {}).name);
            if (same) v = { kind: 'same', conv: convs[0] };
            else { const lo = kind => { const x = D.lf ? engine.lfRateOf(D, kind, 'Low', day) : null; return x ? { name: x.label, rsPerKg: x.rsPerKg } : null; }; const L = { labour: lo('labour'), foh: lo('foh') }; const has = c => ['labour', 'foh'].filter(k => (c[k] || {}).rsPerKg > 0); const tot = c => has(c).reduce((s0, k) => s0 + c[k].rsPerKg, 0);
              v = { kind: 'split', conv: L.labour || L.foh ? L : convs.slice().sort((a, b) => has(b).length - has(a).length || tot(a) - tot(b))[0] }; } } /* most rates filled first, then the lowest (review R47, M1) */ /* before Low and High: the lowest of its products' rates, R43's "Low" (fix 4c) */
          stockConv.set(ck, v); }
        const v = stockConv.get(ck); conv = v.conv; if (v.kind === 'split') out.splitKg += kg; if (v.kind === 'unknown') out.unknownKg += kg; } /* a base C2M does not know: not charged, named apart (review 4, finding 8) */
      const okL = conv ? add('labour', conv.labour, kg) : false, okF = conv ? add('foh', conv.foh, kg) : false; if (!okL || !okF) out.noRateKg += kg;
      /* Kg made in Your own report (push 5b, R53, D-158): each entry as it was charged here, so its totals are Month end's own */
      if (C.rows) { const v = cp ? null : stockConv.get(String(r.base || '').replace(/\s+/g, ' ').trim().toLowerCase() + '|' + day); const L = okL ? conv.labour : null, F = okF ? conv.foh : null;
        C.rows.push({ made, base: r.base || '', brand: r.brand || null, po: r.po || null, kg, product: cp ? cp.brand + ' · ' + ((D.custById.get(cp.customer_id) || {}).name || '') : null, how: cp ? 'po' : v && v.kind === 'same' ? 'stock' : v && v.kind === 'split' ? 'low' : 'unknown', poNotFound: !!(r.po && r.brand && !cp), early: day !== made ? day : null,
          labour: L ? L.name : null, labourRate: L ? Number(L.rsPerKg) : null, labourRs: L ? kg * L.rsPerKg : 0, foh: F ? F.name : null, fohRate: F ? Number(F.rsPerKg) : null, fohRs: F ? kg * F.rsPerKg : 0 }); } }
    const fin = kind => { const rows = Object.entries(out[kind]).map(([name, x]) => ({ name, kg: Math.round(x.kg * 1000) / 1000, rs: Math.round(x.rs), rsPerKg: Object.keys(x.rates).length === 1 ? Number(Object.keys(x.rates)[0]) : null })); return { rows, total: rows.reduce((s0, x) => s0 + x.rs, 0) }; };
    return { noMap: !bb && out.stockKg > 0, kg: out.kg, earlyKg: out.earlyKg, firstRateDay: out.earlyKg > 0 ? first : null, stockKg: out.stockKg, splitKg: out.splitKg, unknownKg: out.unknownKg, unmatchedKg: out.unmatchedKg, noRateKg: out.noRateKg, labour: fin('labour'), foh: fin('foh'), products: Object.entries(out.products).map(([name, x]) => ({ name, ...x })).sort((a, b) => b.kg - a.kg) };
  }
  /** The labour, FOH, packing and freight changes made in a month, from the change record, for the COO check (R8). */
  async function monthChanges(month, until) {
    const [rows] = await q(`SELECT id, at, by_user, entity, entity_id, action, old_value, new_value, why FROM c2m_audit WHERE at>=? AND at<? AND entity IN (${ME_ENT.map(() => '?').join(',')}) ORDER BY id`, [month + '-01', until || dayAfterMonth(month), ...ME_ENT]);
    return rows.filter(r => r.entity !== 'setting' || /^lf_/.test(String(r.entity_id))).filter(r => !['view', 'dry'].includes(r.action)).map(r => ({ id: Number(r.id), at: String(r.at).slice(0, 16), by: r.by_user, entity: r.entity, entityId: r.entity_id, action: r.action, old: r.old_value, new: r.new_value, why: r.why }));
  }
  const lockOf = async month => { const [[r]] = await q("SELECT data_json, done_by, done_at FROM c2m_monthly_check WHERE month=? AND kind='lock'", [month]); return r || null; };
  const refuseLocked = async month => { const L = await lockOf(month); if (L) throw bad(`${month} is locked by ${L.done_by}. Only the COO reopens it, with a reason.`); };
  /** Everything Month end shows for the last 6 months. */
  async function monthEndState(D, poLines, match) {
    const ready = await prodReady(); const months = []; for (let i = 1; i <= 6; i++) { const [y, m] = today().slice(0, 7).split('-').map(Number); const d0 = new Date(Date.UTC(y, m - 1 - i, 1)); months.push(d0.toISOString().slice(0, 7)); }
    months.unshift(today().slice(0, 7));
    let prod = []; if (ready) { const [p] = await q('SELECT made_on, base, brand, po, kg FROM c2m_o2s_production WHERE made_on>=?', [months[months.length - 1] + '-01']); prod = p; }
    const out = { ready, lf: !!D.lf, months: {} }; const C = {}; const byM = new Map(); for (const r of prod) { const m = String(r.made_on).slice(0, 7); if (!byM.has(m)) byM.set(m, []); byM.get(m).push(r); }
    const all = await monthChanges(months[months.length - 1], dayAfterMonth(months[0])); /* 1 query for the 7 months (review 4, finding 5) */
    for (const m of months) out.months[m] = { absorbed: ready ? await absorbedFor(D, m, byM.get(m) || [], poLines, match, C) : null, changes: all.filter(c => c.at.slice(0, 7) === m) };
    return out;
  }
  /** Packs that would have no labour or no FOH rate today (review S2). */
  function packsWithoutRates(D, filter) {
    const out = [];
    for (const p of D.packs) {
      if (filter && !filter(p)) continue;
      const cp = D.cpById.get(p.client_product_id); if (!cp) continue;
      const cv = engine.conversionOf(D, cp, p, today()); // Low and High after migration 011 (D-150)
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
  async function notice(forRole, text, by) { await q('INSERT INTO c2m_notice (for_role, text, by_user, at) VALUES (?,?,?,?)', [forRole, String(text).slice(0, 400), by, now()]); } // the column holds 400
  /** A cost input that moves GP (labour and FOH rates, packing bills, product type, reprocessed) is saved by Yawar alone;
   *  Tahir is told each time, with how many packs moved (cost review 18 Oct 2026, D-63; ruling 12). */
  async function costNotice(by, what, re) { await notice('coo', `${what}. ${re ? `${re} pack(s) moved more than the re-approval % and wait in a re-approval item for the CFO.` : 'No pack moved more than the re-approval %.'}`, by); }
  /** The person who proposed never approves (ruling 19; cost review 18 Oct 2026, D-63). */
  const notSelf = async (proposer, req) => {
    if (req.c2m.admin) return; // the administrator role is exempt from ruling 19 (D-89)
    if (proposer && String(proposer).toLowerCase() === String(req.c2m.user).toLowerCase()) throw Object.assign(new Error('You proposed this, so another person approves it.'), { status: 403 });
    /* Anyone below the administrator who is given an approve right approves only what an administrator proposed, never a colleague's or their own (D-89). */
    const [[pr]] = await q("SELECT role FROM user_module_roles WHERE username=? AND module='c2m'", [proposer]);
    const R = pr ? (req.c2m.roles || await loadRoles()).get(pr.role) : null;
    if (!R || !R.admin) throw Object.assign(new Error('You approve only what an administrator proposed.'), { status: 403 });
  };

  const STATE_TTL = 30000; const stateCache = new Map(); let writeVer = 0;
  app.use('/api/c2m', (req, res, next) => { if (req.method !== 'GET') { writeVer++; const done = () => { writeVer++; }; res.on('finish', done); res.on('close', done); } next(); }); // any save, roles included: the kept answers are no longer current
  /* ---------- Page ---------- */
  app.get(['/c2m', '/c2m/'], (req, res) => { res.set('Cache-Control', 'no-cache'); /* the browser keeps its copy and checks it is current (ETag) instead of downloading 560 KB on every open (D-145) */ res.sendFile(path.join(__dirname, 'c2m.html')); });
  app.get('/c2m/assets/van-logo.png', (req, res) => res.sendFile(path.join(__dirname, 'assets', 'van-logo.png')));
  /* ---------- Roles service for the platform (Tahir, 28 Oct 2026; platform docs/ROLES-DESIGN.md §4, trial) ----------
     Only a System Administrator designs C2M's roles, on the platform's Roles by app screen. These 5 calls are registered
     before the C2M sign-in check below on purpose: a System Administrator needs no C2M role to design C2M's roles.
     The administrator role (coo, D-89) keeps its business meaning (others approve only what an administrator proposed; exempt
     from ruling 19 and the second-person rate check). Since 2 Nov 2026 (Tahir, D-142) it is not locked: its actions are ticks. */
  const SV = deps.services || {};
  const sysAdmin = async (req, res, next) => {
    try { if (SV.isSystemAdmin && await SV.isSystemAdmin(req.user.u)) return next(); res.status(403).json({ error: 'Only a System Administrator designs roles.' }); }
    catch (e) { res.status(503).json({ error: 'C2M cannot check who you are just now. Try again in a minute.' }); }
  };
  // subject 'role:<key>', so a role's log rows never mix with a person's history (a role key and a login can be the same word).
  const svcLog = (action, key, before, after) => { try { if (SV.logAccess) return SV.logAccess({ action, subject: 'role:' + key, module: 'c2m', before, after, via: 'roles' }); } catch (e) {} };
  const svcRole = r => ({ key: r.key, label: r.label, department: null, builtin: r.builtin, archived: false, locked: false, rights: r.actions });
  app.get('/api/c2m/rolesvc/catalogue', auth, sysAdmin, (req, res) => res.json({
    groups: AC.CATALOGUE.map(g => ({ name: g.group, items: g.items.map(i => ({ key: i[0], label: i[1] })) })),
    count: AC.ALL_KEYS.length, rename: true, departments: [], lockedNote: "C2M's administrator role is ticked like any role; it keeps its business meaning: others approve only what an administrator proposed.",
    archiveWord: 'Remove', archiveNote: 'C2M has no archive: a role nobody holds is removed for good, and C2M\'s change record keeps what it was. Built-in roles cannot be removed.'
  }));
  app.get('/api/c2m/rolesvc/roles', auth, sysAdmin, wrap(async (req, res) => { res.json({ roles: [...(await loadRoles()).values()].map(svcRole) }); }));
  app.post('/api/c2m/rolesvc/roles', auth, sysAdmin, wrap(async (req, res) => {
    await needTable(); const b = req.body || {}; const label = cleanLabel(b.label), actions = cleanActions(b.rights);
    const key = AC.slug(label); if (!key) throw bad('Give the role a name of 2 to 60 letters.');
    await tx(async () => {
      const [[dup]] = await q('SELECT role_key FROM c2m_role WHERE role_key=? OR LOWER(label)=LOWER(?) FOR UPDATE', [key, label]); if (dup) throw bad('A role with this name already exists.');
      await q('INSERT INTO c2m_role (role_key, label, is_admin, actions_json, builtin, updated_by, updated_at) VALUES (?,?,0,?,0,?,?)', [key, label, JSON.stringify(actions), req.user.u, now()]);
      await audit(req.user.u, 'role', key, 'create', null, { label, actions }, null);
    });
    await svcLog('role.create', key, null, { label, rights: actions });
    res.json({ ok: true, role: { key, label } });
  }));
  app.put('/api/c2m/rolesvc/roles/:key', auth, sysAdmin, wrap(async (req, res) => {
    await needTable(); const b = req.body || {}; const label = cleanLabel(b.label); let before = null, after = null;
    const seenLabel = b.baseLabel != null ? String(b.baseLabel) : null;
    await tx(async () => {
      const [[r]] = await q('SELECT * FROM c2m_role WHERE role_key=? FOR UPDATE', [req.params.key]); if (!r) throw bad('This role does not exist.');
      const adm = !!Number(r.is_admin);   // D-142: the administrator is ticked like any role; D-89 exempts it from the second-person rate check
      const actions = cleanActions(b.rights, adm), seen = Array.isArray(b.base) ? cleanActions(b.base, adm) : null;
      if (adm && !actions.length) throw bad("Keep at least one tick for C2M's administrator role.");
      const [[dup]] = await q('SELECT role_key FROM c2m_role WHERE LOWER(label)=LOWER(?) AND role_key<>?', [label, r.role_key]); if (dup) throw bad('A role with this name already exists.');
      before = { label: r.label, rights: AC.shape(r.role_key, { label: r.label, admin: adm, actions: JSON.parse(r.actions_json || '[]') }).actions };   // an unticked administrator row holds every action
      // Review 28 Oct 2026: apply only this admin's own changes, measured from what their screen showed, onto the role as it is now.
      const from = seen || before.rights, now0 = before.rights;
      const added = actions.filter(k => !from.includes(k) && !now0.includes(k)), removed = from.filter(k => !actions.includes(k) && now0.includes(k));
      const merged = cleanActions(now0.filter(k => !removed.includes(k)).concat(added), adm);
      if (adm && !merged.length) throw bad("Keep at least one tick for C2M's administrator role.");
      const newLabel = (seenLabel != null && label === seenLabel) ? r.label : label;   // unchanged on screen: keep a rename made meanwhile
      after = { label: newLabel, rights: merged };
      await q('UPDATE c2m_role SET label=?, actions_json=?, updated_by=?, updated_at=? WHERE role_key=?', [newLabel, JSON.stringify(merged), req.user.u, now(), r.role_key]);
      await audit(req.user.u, 'role', r.role_key, 'edit', { label: r.label, actions: before.rights }, { label: newLabel, actions: merged }, null);
    });
    await svcLog('role.rights', req.params.key, before, after);
    res.json({ ok: true, role: { key: req.params.key, label } });
  }));
  // C2M has no archived mark: a role nobody holds is removed, and C2M's audit keeps what it was (to confirm with C2M's owner).
  app.post('/api/c2m/rolesvc/roles/:key/archive', auth, sysAdmin, wrap(async (req, res) => {
    await needTable(); let before = null;
    await tx(async () => {
      const [[r]] = await q('SELECT * FROM c2m_role WHERE role_key=? FOR UPDATE', [req.params.key]); if (!r) throw bad('This role does not exist.');
      if (Number(r.is_admin)) throw bad("C2M's administrator role cannot be removed.");
      if (AC.BUILTIN.includes(r.role_key)) throw bad('Built-in C2M roles cannot be removed: C2M sends notices to them.');   // review 28 Oct: e.g. notices to 'cfo'
      const [[n]] = await q("SELECT COUNT(*) n FROM user_module_roles WHERE module='c2m' AND role=?", [r.role_key]);
      if (n.n) throw bad(`${n.n} ${n.n === 1 ? 'person holds' : 'people hold'} this role. Give them another role on the People tab first.`);
      before = { label: r.label, rights: JSON.parse(r.actions_json) };
      await q('DELETE FROM c2m_role WHERE role_key=?', [r.role_key]);
      await audit(req.user.u, 'role', r.role_key, 'delete', { label: r.label, actions: before.rights }, null, 'archived from the platform Roles screen');
    });
    await svcLog('role.archive', req.params.key, before, null);
    res.json({ ok: true });
  }));

  /* ---------- Public price page, no sign-in (Tahir, 11 Nov 2026) ----------
     Simple prices by region and channel, nothing else: Farmer list (Punjab), Distributor list (one list for the country, shown under Punjab and Sindh),
     Dealer list (Sindh). No cost, margin, previous price, % change, reason, payment terms or other policy line, no MRP or FRP, no document number.
     Read only. Registered before the sign-in check on purpose; it sits outside /api/c2m so that check never sees it. Rate limited per visitor, answer kept 60 seconds. */
  const PUB_RATE = { windowMs: 10 * 60 * 1000, max: 120 }; const pubHits = new Map();
  const pubLimit = (req, res, next) => { const xf = String(req.headers['x-forwarded-for'] || '').split(',').map(x => x.trim()).filter(Boolean), ip = xf.length ? xf[xf.length - 1] : (req.ip || 'x'), t = Date.now();
    const h = (pubHits.get(ip) || []).filter(x => t - x < PUB_RATE.windowMs); if (h.length >= PUB_RATE.max) return res.status(429).json({ error: 'Too many requests. Try again in a few minutes.' });
    h.push(t); pubHits.set(ip, h); if (pubHits.size > 5000) for (const [k, v] of pubHits) if (!v.some(x => t - x < PUB_RATE.windowMs)) pubHits.delete(k); next(); };
  let pubCache = { at: 0, body: null };
  async function publicPrices() {
    if (pubCache.body && Date.now() - pubCache.at < 60000) return pubCache.body;
    await applyDueRevisions();
    const [lp] = await q('SELECT list_name, data_json, issued, valid_till FROM c2m_list_price ORDER BY id');
    const L = groupLists(lp, ['pb'], await listMaster());
    const rowsOf = (aud, data, keep) => PL.rows(aud, data).filter(keep);
    const farmer = rowsOf('farmer_pb', { list: L.farmer }, r => r.cur !== '').map(r => ({ product: r.product, pack: r.pack, price: r.cur }));
    const dist = rowsOf('dist', { list: L.dist }, r => r.cur !== '').map(r => ({ product: r.product, pack: r.pack, exFed: r.cur, withFed: r.fed }));
    const dealer = rowsOf('dealer', { list: L.dealer }, r => r.cur !== '').map(r => ({ product: r.product, pack: r.pack, exFed: r.cur, withFed: r.netfed }));
    const d = L.dates || {}, from = k => (d[k] && d[k].issued ? String(d[k].issued).slice(0, 10) : null);
    const body = { punjab: { farmer: { from: from('farmer'), rows: farmer }, dist: { from: from('dist'), rows: dist } }, sindh: { dealer: { from: from('dealer'), rows: dealer }, dist: { from: from('dist'), rows: dist } }, updated: today() };
    pubCache = { at: Date.now(), body }; return body;
  }
  app.get('/api/public/c2m-prices', pubLimit, (req, res) => publicPrices().then(b => { res.set('Cache-Control', 'public, max-age=60'); res.json(b); }, () => res.status(503).json({ error: 'Prices cannot be shown just now. Try again in a minute.' })));
  app.get('/c2m/prices', (req, res) => { res.set('Cache-Control', 'no-cache'); res.sendFile(path.join(__dirname, 'c2m-prices.html')); });

  app.use('/api/c2m', (req, res, next) => checkDates().then(f => f ? res.status(503).json({ error: f }) : next(), () => res.status(503).json({ error: 'C2M cannot reach the database. Try again in a minute.' })), auth, c2mAuth);

  /** A viewer type role (a KAM): sees only the lists and clients granted to him. The same test build() uses. */
  /** The settings the Margin and Approvals maths need, sent to every role that sees margin even without Settings (audit 3 Nov 2026, D-145). */
  /* Push 3b (R3, R34, D-153): each VAN price list has a target GP % (lt_) and a freight Rs per kg (lf_), held as company settings.
     The rows are made when first approved, so no migration is needed. Yawar sends, Tahir approves, as every setting. */
  const LIST_SET = { dist: 'Distributor', dealer: 'Dealer, Sindh', farmer_pb: 'Farmer, Punjab', farmer_sn: 'Farmer, Sindh cash', farmer_snc: 'Farmer, Sindh credit' };
  const LIST_ROWS = Object.entries(LIST_SET).flatMap(([k, n]) => [{ k: 'lt_' + k, v: '', label: `${n} list, target GP %`, needs_approval: 1 }, { k: 'lf_' + k, v: '', label: `${n} list, freight Rs per kg`, needs_approval: 1 }]);
  const isListSet = k => /^l[tf]_(dist|dealer|farmer_pb|farmer_sn|farmer_snc)$/.test(k);
  const MARGIN_SETTINGS = ['budget_gp', 'ambition_gp', 'wl_budget_gp', 'red_gap_pts', 'red_share_pct', 'reapprove_pct', 'rate_warn_pct', 'forward_months', 'conv_budget_month', 'fed_pct'];
  const isViewerRole = R => !!(R && R.can.has('see.granted_lists') && !R.can.has('see.products'));
  const meOf = (acc, user) => ({ user, role: acc.role, label: acc.label, admin: acc.admin, actions: acc.actions, nav: acc.nav, more: acc.more || [] });
  app.get('/api/c2m/me', (req, res) => res.json({ ...meOf(req.c2m, req.c2m.user), name: req.c2m.name }));

  /* ---------- Shared data builder ---------- */
  async function build(acc, user, tmArg) {
    const role = acc.role, has = a => acc.can.has(a);
    const tm = tmArg || []; let tl = Date.now(); const T = n => { const x = Date.now(); tm.push(n + ';dur=' + (x - tl)); tl = x; }; // timing marks for Server-Timing (11 Nov 2026): where the cold open spends its time
    if (has('see.materials') || has('see.products')) await nutBackfill(); // push 7a: copies the old class fields once, after migration 014
    const D = await engine.loadAll(q);
    T('load_all');
    const S = D.settings.values; const AD = await adminUsers(acc.roles); const byAd = u => AD.has(String(u).toLowerCase());
    T('admins');
    const seeCost = has('see.cost'), seePrice = has('see.price');
    const match = engine.matcher(D);
    await applyDueRevisions();
    T('apply_due');
    // Speed: the reads below do not depend on each other, so all are sent together (one wait, not one after another).
    // They start after applyDueRevisions so they see what it applied. A read nobody uses is harmless; its error is ignored. A list-only role (it returns early) prefetches nothing and reads as before.
    const pre = new Map(); const pq = sql => (pre.has(sql) ? pre.get(sql) : q(sql));
    if (has('see.products') || !has('see.granted_lists')) for (const sql of ['SELECT * FROM c2m_price ORDER BY id',
      'SELECT * FROM c2m_o2s_po_line ORDER BY received, po',
      'SELECT id, name, nutrient_fields, nutrient_role FROM c2m_material_type ORDER BY nutrient_role, name',
      'SELECT list_name, data_json, issued, valid_till FROM c2m_list_price ORDER BY id',
      "SELECT * FROM c2m_reapproval WHERE status='open' ORDER BY id",
      "SELECT MIN(at) at FROM c2m_recipe_step WHERE action='imported'",
      'SELECT * FROM c2m_import_item ORDER BY status, id',
      'SELECT * FROM c2m_setting_request ORDER BY id DESC LIMIT 20',
      'SELECT r.*, c.brand, cu.name customer FROM c2m_target_request r JOIN c2m_client_product c ON c.id=r.client_product_id JOIN c2m_customer cu ON cu.id=c.customer_id ORDER BY r.id DESC LIMIT 30',
      'SELECT * FROM c2m_list_grant ORDER BY username',
      "SELECT a.username, a.name, r.role FROM user_module_roles r JOIN auth_users a ON a.username=r.username WHERE r.module='c2m'",
      'SELECT * FROM c2m_monthly_actual ORDER BY month',
      'SELECT month, kind, data_json, done_by, done_at FROM c2m_monthly_check ORDER BY month',
      'SELECT * FROM c2m_source ORDER BY id',
      'SELECT * FROM c2m_field_map ORDER BY id',
      'SELECT * FROM c2m_sync_run ORDER BY id DESC LIMIT 1',
      'SELECT at, by_user, entity, entity_id, action, why FROM c2m_audit ORDER BY id DESC LIMIT 60',
      "SELECT entity_id, by_user, at FROM c2m_audit WHERE entity='product_name' ORDER BY id DESC LIMIT 400",
      "SELECT c.id, c.brand, c.o2s_brand, c.sold_per, GROUP_CONCAT(k.pack_size ORDER BY k.pack_size) sizes FROM c2m_client_product c LEFT JOIN c2m_client_pack k ON k.client_product_id=c.id WHERE c.channel='VAN brand' AND c.active=0 GROUP BY c.id, c.brand, c.o2s_brand, c.sold_per ORDER BY c.brand",
      'SELECT id, list_name, data_json FROM c2m_list_price ORDER BY id',
      "SELECT * FROM c2m_list_revision WHERE (status='approved' AND applied=0) OR id > (SELECT COALESCE(MAX(id), 0) - 30 FROM c2m_list_revision) ORDER BY id DESC",
      "SELECT entity_id FROM c2m_audit WHERE entity='list_revision' AND action='replaced' AND why LIKE 'Closed at the carry-over%'",
      "SELECT id, list_name, items_json, valid_from, decided_at FROM c2m_list_revision WHERE status='approved' AND applied=1 ORDER BY id"]) { const pr = q(sql); pr.catch(() => {}); pre.set(sql, pr); }
    const [prices] = await pq('SELECT * FROM c2m_price ORDER BY id');
    const approvedPrice = inForce(prices, today()); const nextPrice = new Map();
    prices.filter(p => p.status === 'approved' && String(p.valid_from).slice(0, 10) > today()).sort((a, b) => String(b.valid_from).localeCompare(String(a.valid_from))).forEach(p => nextPrice.set(p.client_pack_id, p)); // earliest wins
    const [poLines] = await pq('SELECT * FROM c2m_o2s_po_line ORDER BY received, po');
    const enteredAt = new Map(poLines.filter(l => l.entered_at).map(l => [l.line_id, String(l.entered_at).slice(0, 19)])); // when each PO came in (migration 008; empty before it)
    const lastPo = new Map(); poLines.forEach(l => { const p = match(l.customer_name, l.brand, l.channel, l.pack); if (p && l.net_price > 0 && !engine.isVanBrand(D.cpById.get(p.client_product_id))) lastPo.set(p.id, Number(l.net_price)); }); // a VAN brand pack is priced per channel by its lists (D-44)

    const viewerOnly = !has('see.products') && has('see.granted_lists'); // a KAM: his answer carries no products or recipes (it empties both below), so they are not worked out (11 Nov 2026)
    const products = viewerOnly ? [] : D.cps.map(cp => {
      const cust = D.custById.get(cp.customer_id) || {};
      const appr = engine.approvedVersion(D, cp.id), latest = engine.latestVersion(D, cp.id);
      const packs = D.packs.filter(p => p.client_product_id === cp.id).map(p => {
        const c = engine.packCost(D, p); const av = engine.latestApproved(D, p.id);
        const ap = approvedPrice.get(p.id);
        /* A pack that had an approved price which has ended, with none in force today, has no price: it does not fall back to
           the last O2S PO price, so it shows on "costed, no price" (ruling 3; cost review 18 Oct 2026, D-62). */
        const ended = ap ? null : prices.filter(x => x.client_pack_id === p.id && x.status === 'approved' && String(x.valid_from).slice(0, 10) <= today() && x.valid_to && String(x.valid_to).slice(0, 10) < today()).sort((a, b) => String(b.valid_to).localeCompare(String(a.valid_to)))[0] || null;
        const price = ap ? Number(ap.price) : ended ? null : (lastPo.get(p.id) ?? null);
        const out = { id: p.id, size: Number(p.pack_size), billId: p.packing_bill_id, clientOnly: D.packExt.has(p.id) ? D.packExt.get(p.id) : null };
        if (seeCost) Object.assign(out, { cost: c && c.costed ? { materials: c.materials, packing: c.packing, conversion: c.conversion, freight: c.freight, total: c.total, rule: c.rule ? c.rule.name : null } : null, costGaps: c && !c.costed ? c.gaps : null,
          approvedCost: av ? Number(av.total) : null, approvedFrom: av ? String(av.valid_from).slice(0, 10) : null, /* R4 brand page: date of the last cost approval (push 3a) */ floor: c && c.costed ? lib.contributionFloor(c) : null, labour: c && c.costed ? c.labour : null,
          sheet: (() => { const v = (D.verByPack.get(p.id) || []).filter(x => /^Yawar's Master Cost Sheet/.test(x.cause)).pop(); return v ? { materials: Number(v.materials), packing: Number(v.packing), conversion: Number(v.conversion), total: Number(v.total) } : null; })() });
        const np = nextPrice.get(p.id);
        if (seePrice) Object.assign(out, { price, priceSource: ap ? 'approved' : (price != null ? 'O2S PO' : null), priceEnded: ended ? { price: Number(ended.price), till: String(ended.valid_to).slice(0, 10) } : null, lastPoPrice: lastPo.get(p.id) ?? null, prevPrice: ap && ap.prev_price != null ? Number(ap.prev_price) : null, priceFrom: ap ? ap.valid_from : null, priceTill: ap && ap.valid_to ? String(ap.valid_to).slice(0, 10) : null,
          nextPrice: np ? { id: np.id, price: Number(np.price), from: String(np.valid_from).slice(0, 10) } : null, waitingProposal: prices.some(x => x.client_pack_id === p.id && x.status === 'proposed') });
        return out;
      });
      return { id: cp.id, customer: cust.name, customerId: cust.id, typeId: cp.base_product_id, fam: lib.familyColour(cp.base_product_id, D.productTypes), typeName: ((D.productTypes || []).find(t => Number(t.id) === Number(cp.base_product_id)) || {}).name || null, reprocessed: !!Number(cp.reprocessed), grp: cp.channel === 'White label' ? 'White label' : 'VAN brand', channel: cp.channel, brand: cp.brand, spec: cp.spec, o2sNames: role === 'cfo' || role === 'coo' ? String(cp.o2s_brand).split('|').filter(Boolean) : undefined,
        familyId: (D.ext.get(cp.id) || {}).familyId || null, pvariantId: (D.ext.get(cp.id) || {}).pvariantId || null, followsId: (D.ext.get(cp.id) || {}).followsId || null, followsBrand: (D.ext.get(cp.id) || {}).followsId ? ((D.cpById.get(D.ext.get(cp.id).followsId) || {}).brand || null) : null, form: cp.form, soldPer: cp.sold_per, packingMode: cp.packing_mode, target: seePrice ? (cp.target_gp == null ? null : Number(cp.target_gp)) : undefined,
        budget: seePrice ? (cp.budget_gp == null ? null : Number(cp.budget_gp)) : undefined, budgetKg: seePrice && cp.budget_kg_year != null ? Number(cp.budget_kg_year) : undefined, recipeState: latest ? latest.state : null, approvedVersionId: appr ? appr.id : null, latestVersionId: latest ? latest.id : null, packs,
        defaultName: engine.defaultName(D, cp.id), others: engine.approvedVersions(D, cp.id).filter(v => !appr || v.id !== appr.id).map(v => ({ id: v.id, name: v.rname, version: v.version_no, packs: seeCost ? D.packs.filter(p => p.client_product_id === cp.id).map(p => { const c = engine.packCost(D, p, { version: v }); return { id: p.id, total: c && c.costed ? c.total : null }; }) : undefined })) }; // D-140: the other approved recipes, cost for reading only
    });

    T('products');
    const backSigs = new Map(); if (!viewerOnly) { const ids = [...D.recipes.byVer.values()].filter(v => v.sent_back_by && v.state === 'draft').map(v => v.id); for (const id of ids) backSigs.set(id, await backSig(id)); } // push 7b
    const recipes = viewerOnly ? [] : [...D.recipes.byVer.values()].filter(v => D.cpById.has(v.client_product_id)).map(v => { // a product out of use takes its recipes off the screens too (kept in the database; review 1.0.2 re-check 2, A1)
      const cp = D.cpById.get(v.client_product_id); const cust = cp ? D.custById.get(cp.customer_id) : null;
      const pr = engine.priceRecipe(D, v);
      const lines = pr.lines.map(l => ({ gradeId: l.gradeId, name: l.name, grade: l.grade, qty: l.qty, ...(seeCost ? { rate: l.rate, date: l.date, cost: l.cost } : {}) }));
      return { id: v.id, clientProductId: v.client_product_id, customer: cust ? cust.name : '?', brand: cp ? cp.brand : '?', version: v.version_no, state: v.state, note: seeCost ? v.note : lib.noRs(v.note), rname: v.rname || engine.MAIN, isDefault: v.state === 'approved' && (engine.approvedVersion(D, v.client_product_id) || {}).id === v.id, defaultName: engine.defaultName(D, v.client_product_id),
        sentBack: v.sent_back_by ? { by: v.sent_back_by, state: v.sent_back_state, reason: seeCost ? v.sent_back_reason : lib.noRs(v.sent_back_reason), advice: seeCost ? v.sent_back_advice : lib.noRs(v.sent_back_advice) } : null, // no Rs without see.cost (review 7d, M1)
        lines, kgTotal: pr.kgTotal, materials: seeCost ? pr.materials : undefined, nutrients: engine.nutrients(pr, engine.analysisOpts(D, v.client_product_id)), steps: seeCost ? v.steps : v.steps.map(s => ({ ...s, note: lib.noRs(s.note) })), // push 7d: no Rs to a person who does not see cost
        path: (v.rname || engine.MAIN) !== engine.defaultName(D, v.client_product_id) && engine.approvedVersions(D, v.client_product_id).length > 0 ? 'other' : 'default', // push 7b: other = Majid, Himayat, Yawar (R64)
        flags: ['review', 'endorse'].includes(v.state) ? recipeFlags(D, v.id) : [], // R68: why a comment is needed to pass
        backSig: v.sent_back_by && v.state === 'draft' ? (backSigs.get(v.id) ?? null) : undefined }; // R63: the lines as sent back, so the page says where a resend goes
    });

    // Settings (budget and ambition GP, thresholds) go to Yawar and Tahir only (review S9)
    const out = { m007: D.m007, outOfUseKeys: [...D.outOfUse], variantsReady: D.variantsReady, families: D.families.map(f => ({ id: f.id, name: f.name, variants: D.pvariants.filter(v => v.family_id === f.id).map(v => ({ id: v.id, name: v.name })) })), me: meOf(acc, user), settings: has('see.settings') ? D.settings.rows : has('see.margin') ? D.settings.rows.filter(r => MARGIN_SETTINGS.includes(r.k) || isListSet(r.k)).map(r => ({ k: r.k, v: r.v })) : [], fedPct: lib.fedPct(D.settings.values.fed_pct), products, recipes, today: today() };
    out.m014 = D.m014; // push 7a (D-162): the nutrient list and declared grades; false until migration 014
    out.m015 = !!D.m015; // push 7c (D-164): a basis on each value, densities; false until migration 015
    if (D.m015 && (has('see.materials') || has('see.products'))) out.productDensity = Object.fromEntries([...D.density.product].filter(([k]) => D.cpById.has(k)));
    if (D.m014 && nutCopyFailed && (has('nutrient.list') || has('material.save'))) out.nutCopyFailed = nutCopyFailed; // review 7a, M2: shown, never silent
    if (D.m014 && (has('see.materials') || has('see.products'))) { out.nutrientList = D.nutrientList; out.declared = Object.fromEntries([...D.declared].filter(([k]) => D.cpById.has(k))); }
    T('recipes_out');
    /* Push 7e (Tahir, 10 Nov 2026, D-166): the role page each person reads and signs once per version, kept in the change record.
       Each sign holds the role it was signed in, so a person moved to another role signs that role's page (review 7e, 2). */
    { const [sg] = await softQ("SELECT entity_id, new_value FROM c2m_audit WHERE entity='signoff' AND LOWER(by_user)=LOWER(?)", [user]); out.signed = (sg || []).map(r => ({ page: String(r.entity_id), role: signRole(r.new_value) })); }
    if (acc.admin) { const RM = acc.roles && acc.roles.get ? acc.roles : await loadRoles(); const [all] = await softQ("SELECT by_user, entity_id, new_value, at FROM c2m_audit WHERE entity='signoff' ORDER BY id", []);
      let [pp] = await softQ("SELECT r.username, a.name, r.role FROM user_module_roles r LEFT JOIN auth_users a ON a.username=r.username WHERE r.module='c2m' AND (a.active IS NULL OR a.active=1) ORDER BY r.username", []); // a switched off login is left out (review 7e, 6)
      if (!pp) [pp] = await softQ("SELECT r.username, a.name, r.role FROM user_module_roles r LEFT JOIN auth_users a ON a.username=r.username WHERE r.module='c2m' ORDER BY r.username", []);
      out.signoffs = { rows: (all || []).map(r => ({ user: String(r.by_user).toLowerCase(), page: String(r.entity_id), role: signRole(r.new_value), at: r.at })),
        people: (pp || []).map(p => { const R = RM.get(p.role) || {}; return { user: String(p.username).toLowerCase(), name: p.name || p.username, role: p.role, label: R.label || p.role, admin: !!R.admin, page: R.key ? signPageOf(R) : 'custom' }; }) }; }
    /* Push 7f (Tahir, 10 Nov 2026, D-167): a notice reaches every role holding the right of its step (a role made on the launcher too), and
       each person marks the notices they have read; read ones fold away. */
    const noticeKeys = acc.admin ? [role] : [...new Set([role, ...(has('recipe.edit') || has('recipe.step.draft') ? ['production'] : []), ...(has('recipe.step.review') ? ['qc'] : []), ...(has('recipe.step.endorse') ? ['plant'] : []), ...(has('recipe.step.cost') && has('see.margin') ? ['cfo'] : [])])]; // cfo notices also carry prices and lists: only a finance role reads them (review 7f, 1)
    { const [ns] = await softQ("SELECT new_value FROM c2m_audit WHERE entity='notices_read' AND LOWER(by_user)=LOWER(?) ORDER BY id DESC LIMIT 1", [user]); let up = 0; try { up = Number(JSON.parse((ns && ns[0] && ns[0].new_value) || '{}').upto) || 0; } catch (_) {} out.noticesReadUpto = up; }
    out.issuer = PL.ISSUER; // push 7g: the price list preview names the issuer from the same place as the PDF
    if (!has('see.margin') && noticeKeys.some(k => ['production', 'qc', 'plant', 'cfo'].includes(k))) { const [nt] = await softQ(`SELECT * FROM c2m_notice WHERE for_role IN (${noticeKeys.map(() => '?').join(',')}) AND at >= DATE_SUB(?, INTERVAL 30 DAY) ORDER BY id DESC LIMIT 30`, [...noticeKeys, now()]); out.notices = (nt || []).map(n => has('see.cost') ? n : { ...n, text: lib.noRs(n.text) }); } // push 7b (R65), 7f: by the step rights held
    if (has('see.materials')) {
      // Material master without rates: Himayat's screen (ruled 16 Oct)
      out.materials = [...D.rates.values()].map(g => ({ gradeId: g.gradeId, materialId: g.materialId, name: g.name, grade: g.grade, unit: g.unit, typeId: g.typeId, type: g.type, role: g.role, fields: g.fields, nutrients: g.nutrients,
        ...(D.m014 ? { density: g.density || null, suggest: g.suggest, nutRows: g.nutRows, checked: g.checked, checkedBy: g.checkedBy, checkedAt: g.checkedAt, notEntered: g.notEntered, noRate: g.rate == null } : {}) })); // push 7a: noRate, so the QC Head and Production Manager see a material waiting for the CFO's rate (no Rs)
      const [mt] = await pq('SELECT id, name, nutrient_fields, nutrient_role FROM c2m_material_type ORDER BY nutrient_role, name'); out.materialTypes = mt;
    }
    if (!has('see.products') && has('see.granted_lists')) {
      const [grants] = await q('SELECT grant_kind, grant_value FROM c2m_list_grant WHERE username=?', [user]);
      out.grants = grants;
      const [lp] = await pq('SELECT list_name, data_json, issued, valid_till FROM c2m_list_price ORDER BY id');
      const lg = grants.filter(g => g.grant_kind === 'list').map(g => g.grant_value);
      const farmerCols = [['farmer_pb', 'pb'], ['web', 'pb'], ['farmer_sn', 'sn'], ['farmer_snc', 'snc']].filter(([a]) => lg.includes(a)).map(([, c]) => c);
      const L = groupLists(lp, farmerCols, await listMaster()), may = new Set(lg.map(g => PL.AUDIENCES[g] ? listOf(g) : null));
      out.lists = { issued: L.issued, till: L.till, dates: L.dates, dist: may.has('dist') ? L.dist : [], dealer: may.has('dealer') ? L.dealer : [], farmer: may.has('farmer') ? L.farmer : [] };
      out.wlLists = await wlListData(D, approvedPrice, grants.filter(g => g.grant_kind === 'client').map(g => g.grant_value));
      out.products = []; out.recipes = [];
      T('kam');
      return out;
    }
    const [rv] = await pq("SELECT * FROM c2m_reapproval WHERE status='open' ORDER BY id");
    if (has('see.margin')) out.reapprovals = rv.map(r => ({ id: r.id, cause: r.cause, items: JSON.parse(r.items_json), createdAt: r.created_at }));
    if (seeCost) {
      out.rates = [...D.rates.values()].map(g => ({ gradeId: g.gradeId, name: g.name, grade: g.grade, unit: g.unit, type: g.type, fields: g.fields, nutrients: g.nutrients, rate: g.rate, date: g.date, source: g.source, history: g.history.slice(0, 6) }));
      out.packingItems = [...D.packing.itemById.values()];
      out.packingBills = [...D.packing.billById.values()];
      out.rules = D.rules;
      out.productTypes = D.productTypes;
      if (!out.materialTypes) { const [mt] = await pq('SELECT id, name, nutrient_fields, nutrient_role FROM c2m_material_type ORDER BY nutrient_role, name'); out.materialTypes = mt; }
    }
    T('signoffs_notices');
    if (has('see.margin')) {
      const [sales] = await q(`SELECT t.id, t.truck_date, t.kg, t.po, t.dc, p.line_id, p.received, p.customer_name, p.channel, p.brand, p.pack, p.net_price FROM c2m_o2s_truck t JOIN c2m_o2s_po_line p ON p.line_id=t.line_id ORDER BY t.truck_date`);
      /* R46 (push 4, D-154): each VAN brand sale takes its list's freight, the list picked as the price check picks it; no list: no freight, named. */
      const lineInfo = new Map(poLines.map(l => [l.line_id, l])); const lfOf = k => { const r = D.settings.rows.find(x => x.k === 'lf_' + k); return r && String(r.v).trim() !== '' && isFinite(Number(r.v)) ? Number(r.v) : null; };
      /** The list a VAN brand line is priced on, and that list's freight Rs per kg or L: the price check's own region rule (review 4, finding 4); no list: named, no freight. Trucks and open POs alike (R46; push 5a, D-157). */
      const regionsRead = poLines.some(l => l.region != null); /* regions come from O2S at Pull (009); until then no farmer is defaulted to Punjab (review 6a, finding 1) */
      const listFr = (channel, region, cust, terms) => { const pick = PC.listFor(channel, PC.regionOf(region) || PC.regionOf(cust && cust.region), terms, { noDefault: !regionsRead }); if (!pick || !pick.list) return { noList: pick && pick.none ? pick.none : 'No list' };
        const key = pick.list === 'farmer' ? 'farmer_' + pick.col : pick.list; return { lkey: key, lfr: lfOf(key), ...(pick.dflt ? { lkeyDefault: true } : {}) }; }; // lkeyDefault: a farmer with no region in O2S, taken as on the Farmer list, Punjab (R59, D-159)
      const custOf = name => { const k = String(name == null ? '' : name).trim().toLowerCase(); return k ? D.customers.find(c => String(c.o2s_names).split('|').some(n => n.trim() && n.trim().toLowerCase() === k)) : null; }; // an empty name never matches (the VAN brand owner row has none)
      /* FOC (free) lines are not sales: they carry cost against Rs 0 and would pull GP down. They are kept out of sales,
         GP and exposure and shown on their own (ruling 14b; cost review 18 Oct 2026, D-62). */
      out.foc = [];
      out.sales = sales.filter(s => { if (Number(s.net_price) > 0) return true;
        const p = match(s.customer_name, s.brand, s.channel, s.pack); const cp = p ? D.cpById.get(p.client_product_id) : null; const v = p ? engine.versionOnDate(D, p.id, s.truck_date) : null;
        const cust = cp && !engine.isVanBrand(cp) ? D.custById.get(cp.customer_id) : custOf(s.customer_name);
        const fgrp = s.channel === 'White Label' ? 'White label' : 'VAN brand', fli = lineInfo.get(s.line_id) || {}, flk = fgrp === 'VAN brand' ? listFr(s.channel, fli.region, cust, fli.payment_terms) : {};
        const fbl = lib.buyerLine(fgrp, cp && !engine.isVanBrand(cp) ? cp.channel : (engine.CHANNEL_NAME[s.channel] || s.channel), cust ? cust.name : s.customer_name, flk.lkey); // R56: a farmer under his list
        out.foc.push({ date: s.truck_date, cust: fbl.line, cat: fbl.cat, grp: fgrp, brand: s.brand, pack: Number(s.pack), packId: p ? p.id : null, po: s.po, kg: Number(s.kg), cost: v ? Number(v.total) : null });
        return false; }).map(s => {
        const p = match(s.customer_name, s.brand, s.channel, s.pack); const cp = p ? D.cpById.get(p.client_product_id) : null; const van = engine.isVanBrand(cp);
        const cust = cp && !van ? D.custById.get(cp.customer_id) : custOf(s.customer_name); // VAN brand: the buyer, not the product's owner (D-44)
        const v = p ? engine.versionOnDate(D, p.id, s.truck_date) : null; const cost = v ? Number(v.total) : null;
        const nowC = p ? engine.packCost(D, p) : null;
        const costBands = v && nowC && nowC.costed && /^Yawar's/.test(v.cause) ? Number(v.total) - Number(v.conversion) + nowC.conversion : cost;
        const grp = s.channel === 'White Label' ? 'White label' : 'VAN brand', ch = cp && !van ? cp.channel : (engine.CHANNEL_NAME[s.channel] || s.channel);
        const lk = grp === 'VAN brand' ? (() => { const li = lineInfo.get(s.line_id) || {}; return listFr(s.channel, li.region, cust, li.payment_terms); })() : {};
        const bl = lib.buyerLine(grp, ch, cust ? cust.name : s.customer_name, lk.lkey); // D-74: farmers never named in C2M; R56 (D-159): each farmer sale under the farmer list it was picked on
        return { date: s.truck_date, cust: bl.line, cat: bl.cat, grp, ch, region: cust && bl.cat !== 'farm' ? cust.region || null : null, brand: s.brand, pack: Number(s.pack),
          packId: p ? p.id : null, po: s.po, dc: s.dc, kg: Number(s.kg), price: Number(s.net_price), cost, costBands, parts: v ? [v.materials, v.packing, v.conversion, v.freight].map(Number) : null, rcv: s.received ? String(s.received).slice(0, 10) : null, rcvAt: enteredAt.get(s.line_id) || null, // parts: the approved cost on the truck date, for the Margin drill-down (D-124)
           target: cp && cp.target_gp != null ? Number(cp.target_gp) : null, budget: cp && cp.budget_gp != null ? Number(cp.budget_gp) : null,
           ...lk };
      });
      const um = new Map();
      for (const x of out.sales) if (!x.packId) { const k = `${x.cust}|${x.brand}|${x.pack}`; const u = um.get(k) || { cust: x.cust, brand: x.brand, pack: x.pack, grp: x.grp, kg: 0, rs: 0 }; u.kg += x.kg; u.rs += x.kg * x.price; um.set(k, u); }
      out.unmatched = [...um.values()].sort((a, b) => b.rs - a.rs);
      out.open = poLines.filter(l => Number(l.open_kg) > 0 && Number(l.net_price) > 0).map(l => { // FOC lines are not sales (ruling 14b)
        const p = match(l.customer_name, l.brand, l.channel, l.pack); const cp = p ? D.cpById.get(p.client_product_id) : null; const cust = cp && !engine.isVanBrand(cp) ? D.custById.get(cp.customer_id) : custOf(l.customer_name);
        const c = p ? engine.packCost(D, p) : null;
        const ogrp = l.channel === 'White Label' ? 'White label' : 'VAN brand', olk = ogrp === 'VAN brand' ? listFr(l.channel, l.region, cust, l.payment_terms) : {};
        const obl = lib.buyerLine(ogrp, cp && !engine.isVanBrand(cp) ? cp.channel : (engine.CHANNEL_NAME[l.channel] || l.channel), cust ? cust.name : l.customer_name, olk.lkey);
        return { cust: obl.line, cat: obl.cat, grp: ogrp, brand: l.brand, pack: Number(l.pack), packId: p ? p.id : null, po: l.po, received: l.received,
          kg: Number(l.open_kg), price: Number(l.net_price), cost: c && c.costed ? c.total : null, target: cp && cp.target_gp != null ? Number(cp.target_gp) : null,
          ...olk }; // push 5a (D-157): an open VAN brand PO line carries its list's freight, picked as for trucks
      });
      let urgRows = []; try { [urgRows] = await pq("SELECT entity, entity_id, why FROM c2m_audit WHERE action='urgent' AND entity IN ('price','list_revision')"); } catch (_) {} // R33
      const urgOf = (e, id) => { const u = urgRows.filter(x => x.entity === e && String(x.entity_id) === String(id)).pop(); return u ? u.why : null; };
      out.proposals = prices.filter(p => p.status !== 'approved' || p.decided_at).slice(-60).map(p => ({ urgent: urgOf('price', p.id), byAdmin: byAd(p.proposed_by), id: p.id, packId: p.client_pack_id, price: Number(p.price), prev: p.prev_price == null ? null : Number(p.prev_price), status: p.status,
        reason: p.reason, belowReason: p.below_target_reason, backReason: p.back_reason, by: p.proposed_by, at: p.proposed_at, decidedBy: p.decided_by, decidedAt: p.decided_at, from: p.valid_from, to: p.valid_to || null }));
      // 0.9.0 (read only, no new table): every approved price with its dates, for Price history and the PO price report (R3)
      // 'replaced' with no send-back reason = approved, then ended by a newer price (review 18 Oct, finding 1)
      out.priceHistory = prices.filter(p => p.status === 'approved' || (p.status === 'replaced' && !p.back_reason && p.decided_at)).map(p => ({ id: p.id, packId: p.client_pack_id, price: Number(p.price), prev: p.prev_price == null ? null : Number(p.prev_price), from: String(p.valid_from).slice(0, 10), to: p.valid_to ? String(p.valid_to).slice(0, 10) : null,
        reason: p.reason, by: p.proposed_by, at: p.proposed_at, decidedBy: p.decided_by, decidedAt: p.decided_at }));
      // Every O2S PO line placed on a client pack (open and shipped), for the PO price report (R3); FOC lines (price 0) are marked
      const fy0 = (() => { const t = today(), y = +t.slice(0, 4), m = +t.slice(5, 7); return (m >= 7 ? y : y - 1) + '-07-01'; })();
      // this financial year only (review 18 Oct, finding 10)
      out.poLines = poLines.filter(l => l.received && String(l.received).slice(0, 10) >= fy0).map(l => { const p = match(l.customer_name, l.brand, l.channel, l.pack); const cp = p ? D.cpById.get(p.client_product_id) : null; const cust = cp && !engine.isVanBrand(cp) ? D.custById.get(cp.customer_id) : custOf(l.customer_name);
        const pgrp = l.channel === 'White Label' ? 'White label' : 'VAN brand', plk = pgrp === 'VAN brand' ? listFr(l.channel, l.region, cust, l.payment_terms) : {};
        const pbl = lib.buyerLine(pgrp, cp && !engine.isVanBrand(cp) ? cp.channel : (engine.CHANNEL_NAME[l.channel] || l.channel), cust ? cust.name : l.customer_name, plk.lkey);
        return { po: l.po, received: l.received ? String(l.received).slice(0, 10) : null, enteredAt: l.entered_at ? String(l.entered_at).slice(0, 19) : null, cust: pbl.line, cat: pbl.cat, grp: pgrp, brand: l.brand, pack: Number(l.pack), packId: p ? p.id : null, kg: Number(l.ordered_kg), price: Number(l.net_price), foc: !(Number(l.net_price) > 0) }; });
      /* VAN brand PO price check (Tahir, 4 Nov 2026, D-146; F-32): each VAN brand PO line this FY, from the first list (11 Oct 2026),
         against the list in force on its date. Marks only: it never blocks a PO and Margin keeps the price O2S entered.
         The CFO and COO (see.margin with see.price) get it; the page shows it on Approvals and in Reports. */
      if (has('see.price')) {
        const [lr0] = await pq('SELECT id, list_name, data_json FROM c2m_list_price ORDER BY id');
        let revs = []; try { [revs] = await pq("SELECT id, list_name, items_json, valid_from, decided_at FROM c2m_list_revision WHERE status='approved' AND applied=1 ORDER BY id"); } catch (e) { console.error('[c2m] price check: list revisions not read: ' + (e.code || e.message)); }
        const byList = { dist: { now: [], old: [] }, dealer: { now: [], old: [] }, farmer: { now: [], old: [] } };
        for (const r of lr0) { const m = /^(dist|dealer|farmer)(_old)?$/.exec(r.list_name); if (!m) continue; let d; try { d = JSON.parse(r.data_json); } catch (_) { continue; } byList[m[1]][m[2] ? 'old' : 'now'].push({ id: r.id, d }); }
        const onDate = new Map(); const listsOn = (list, date, at) => { const k = list + '|' + date + '|' + (at || ''); if (!onDate.has(k)) onDate.set(k, PC.rowsOnDate(list, byList[list].now, byList[list].old, revs.filter(r => r.list_name === list), date, at || null)); return onDate.get(k); };
        const pkById = new Map(D.packs.map(k => [Number(k.id), k])); const cpOfPack = id => { const k = pkById.get(Number(id)); return k ? D.cpById.get(k.client_product_id) : null; };
        const ctx = { noDefault: !poLines.some(l => l.region != null), fedPct: lib.fedPct(D.settings.values.fed_pct), listsOn, soldPer: id => (cpOfPack(id) || {}).sold_per || 'kg',
          packNames: id => { const c = cpOfPack(id); return c ? [c.brand].concat(String(c.o2s_brand || '').split('|')).map(x => String(x || '').trim()).filter(Boolean) : []; } };
        const lines = poLines.filter(l => l.channel !== 'White Label' && Number(l.net_price) > 0 && l.received && String(l.received).slice(0, 10) >= fy0).map(l => {
          const p = match(l.customer_name, l.brand, l.channel, l.pack); const cp = p ? D.cpById.get(p.client_product_id) : null; const van = engine.isVanBrand(cp);
          const cust = custOf(l.customer_name); const region = PC.regionOf(l.region) || PC.regionOf(cust && cust.region); // the region O2S keeps on the customer (009), else C2M's customer record
          const received = String(l.received).slice(0, 10);
          const r = PC.check({ po: l.po, received, enteredAt: l.entered_at ? String(l.entered_at).slice(0, 19) : null, channel: l.channel, region, terms: l.payment_terms, fedMode: l.fed_mode, net: Number(l.net_price), size: Number(l.pack), packId: p ? p.id : null, own: !!cp && !van }, ctx);
          let gp = null; if (r.state === 'cost') { const v = engine.versionOnDate(D, p.id, received); if (v && Number(l.net_price) > 0) gp = lib.round((Number(l.net_price) - Number(v.total)) / Number(l.net_price) * 100, 1); }
          const pk = PC.listFor(l.channel, region, l.payment_terms, { noDefault: ctx.noDefault }); /* the client line from the list itself, also when the line is not compared (review 6a, finding 2) */
          const bl = lib.buyerLine('VAN brand', engine.CHANNEL_NAME[l.channel] || l.channel, cust ? cust.name : l.customer_name, pk && pk.list === 'farmer' ? 'farmer_' + pk.col : pk && pk.list); // farmers never named (D-74); under their list (R56)
          return { po: l.po, received, cust: bl.line, cat: bl.cat, ch: engine.CHANNEL_NAME[l.channel] || l.channel, region: region || null, terms: l.payment_terms || null, brand: l.brand, pack: Number(l.pack), packId: p ? p.id : null, kg: Number(l.ordered_kg), ...r, gp };
        });
        const before = lines.filter(x => x.received < PC.FIRST_LIST).length;
        let regionRead = false; try { const [cols] = await q("SHOW COLUMNS FROM c2m_o2s_po_line LIKE 'region'"); regionRead = cols.length > 0; } catch (e) { console.error('[c2m] price check: region column check failed: ' + (e.code || e.message)); } // migration 009 (review 4 Nov, finding 5)
        out.listCheck = { first: PC.FIRST_LIST, tol: PC.TOL_PCT, before, regionRead, regionPulled: poLines.some(l => l.region != null), lines: lines.filter(x => x.received >= PC.FIRST_LIST) };
      }
      T('sales');
      const [[ia]] = await pq("SELECT MIN(at) at FROM c2m_recipe_step WHERE action='imported'"); out.importedAt = ia && ia.at ? String(ia.at) : null; // the day Yawar's sheets were loaded: age of the sheet items
      const [[nd]] = await q('SELECT COUNT(*) n FROM c2m_price_doc WHERE ref LIKE ?', [`VAN/PL/${today().slice(0, 4)}/%`]); out.nextDocRef = `VAN/PL/${today().slice(0, 4)}/${String(Number(nd.n) + 1).padStart(3, '0')}`;
      const [imp] = await pq('SELECT * FROM c2m_import_item ORDER BY status, id'); out.imports = imp;
      const [sreq] = await pq('SELECT * FROM c2m_setting_request ORDER BY id DESC LIMIT 20'); out.settingRequests = sreq.map(r => ({ ...r, byAdmin: byAd(r.by_user) }));
      const [treq] = await pq('SELECT r.*, c.brand, cu.name customer FROM c2m_target_request r JOIN c2m_client_product c ON c.id=r.client_product_id JOIN c2m_customer cu ON cu.id=c.customer_id ORDER BY r.id DESC LIMIT 30'); out.targetRequests = treq.map(r => ({ ...r, byAdmin: byAd(r.by_user) }));
      const [nt] = await q(`SELECT * FROM c2m_notice WHERE for_role IN (${noticeKeys.map(() => '?').join(',')}) AND at >= DATE_SUB(?, INTERVAL 30 DAY) ORDER BY id DESC LIMIT 20`, [...noticeKeys, now()]); out.notices = nt; // push 7f: by the step rights held, last 30 days (review 7f, 5)
      const [gr] = await pq('SELECT * FROM c2m_list_grant ORDER BY username'); out.grants = gr;
      const [people] = await pq("SELECT a.username, a.name, r.role FROM user_module_roles r JOIN auth_users a ON a.username=r.username WHERE r.module='c2m'"); const RR = acc.roles || await loadRoles(); out.people = people.map(p => { const r = RR.get(p.role); return { ...p, roleLabel: r ? r.label : p.role, grantee: isViewerRole(r) }; });
      const [lp] = await pq('SELECT list_name, data_json, issued, valid_till FROM c2m_list_price ORDER BY id'); const LM = await listMaster(); out.lists = groupLists(lp, null, LM);
      { const LP = groupLists(lp, null, LM, true); out.mrpIssues = lib.mrpIssues(LP); out.mrpMissing = LM ? lib.mrpMissing(LP) : []; } /* every farmer row is checked against its own MRP; the dealer and distributor checks, and the packs with no MRP, need rows linked to packs */ // list prices above the printed MRP, and packs with none (D-122)
      out.wlLists = await wlListData(D, approvedPrice, D.customers.filter(c => c.grp !== 'VAN brand').map(c => c.name));
      const [ma] = await pq('SELECT * FROM c2m_monthly_actual ORDER BY month'); out.actuals = ma;
      try { out.monthEnd = await monthEndState(D, poLines, match); } catch (e) { console.error('[c2m] month end not read: ' + (e.code || e.message)); out.monthEnd = null; } /* push 4 (D-154) */
      const [mc] = await pq('SELECT month, kind, data_json, done_by, done_at FROM c2m_monthly_check ORDER BY month'); out.checks = mc.map(c => ({ ...c, data: (() => { try { return c.data_json ? JSON.parse(c.data_json) : null; } catch (_) { return null; } })(), data_json: undefined }));
      const [src] = await pq('SELECT * FROM c2m_source ORDER BY id'); out.sources = src;
      const [fm] = await pq('SELECT * FROM c2m_field_map ORDER BY id'); out.fieldMap = fm;
      const [sr] = await pq('SELECT * FROM c2m_sync_run ORDER BY id DESC LIMIT 1'); out.lastSync = sr[0] || null;
      const [au] = await pq('SELECT at, by_user, entity, entity_id, action, why FROM c2m_audit ORDER BY id DESC LIMIT 60'); out.audit = au;
      const [nl] = await pq("SELECT entity_id, by_user, at FROM c2m_audit WHERE entity='product_name' ORDER BY id DESC LIMIT 400"); out.nameLog = {}; for (const x of nl) if (!out.nameLog[x.entity_id]) out.nameLog[x.entity_id] = { by: x.by_user, at: x.at }; // last name change per product (D-85)
      { const [off] = await pq("SELECT c.id, c.brand, c.o2s_brand, c.sold_per, GROUP_CONCAT(k.pack_size ORDER BY k.pack_size) sizes FROM c2m_client_product c LEFT JOIN c2m_client_pack k ON k.client_product_id=c.id WHERE c.channel='VAN brand' AND c.active=0 GROUP BY c.id, c.brand, c.o2s_brand, c.sold_per ORDER BY c.brand"); out.vanOff = off.map(r => ({ id: r.id, brand: r.brand, names: namesOf(r), soldPer: r.sold_per, sizes: String(r.sizes || '').split(',').filter(Boolean).map(Number) })); } // VAN brand products out of use (Tahir, 20 Oct 2026)
      out.freight = D.freight;
      /* Labour and FOH, Low and High (push 2c, D-150): the rates in force with their history, and each product's pick. */
      if (D.lf) { const T = today(); const KN = { labour: 'Labour', foh: 'FOH' };
        const first0 = [...D.lf.R.values()].flat().map(x => x.validFrom).sort()[0] || T; // the switch: the earliest rate row (migration 011)
        out.lf = { ready: true, from: T, since: String(first0).slice(0, 7), rates: [], picks: [] };
        for (const kind of ['labour', 'foh']) for (const name of D.lf.names[kind]) { const now1 = engine.lfRateOf(D, kind, name, T); const H = (D.lf.R.get(kind + '|' + name) || []).slice().reverse();
          out.lf.rates.push({ kind, name, label: `${KN[kind]} rate ${name}`, rsPerKg: now1 ? now1.rsPerKg : null, validFrom: now1 ? now1.validFrom : null, history: H.slice(0, 12).map(x => ({ rsPerKg: x.rsPerKg, validFrom: x.validFrom, by: x.by, at: x.at, source: x.source })) }); }
        for (const cp of D.cps) out.lf.picks.push({ id: cp.id, labour: engine.lfPickOf(D, cp.id, 'labour', T), foh: engine.lfPickOf(D, cp.id, 'foh', T), lSet: D.lf.P.has(cp.id + '|labour'), fSet: D.lf.P.has(cp.id + '|foh') });
      } else out.lf = { ready: false };
      /* Next week's costs (push 2b, D-149): waiting changes, and those that failed or went in during the last 8 days. */
      T('margin_misc');
      { const ready = await pendReady(); if (ready) await applyDue().catch(() => {}); /* due Monday changes go in before the list is read (review 2b, finding 8) */ const T = today(); out.weekly = { ready, monday: isMonday(T), next: nextMonday(T) }; out.pending = [];
        if (ready) { const since = new Date(Date.parse(T + 'T00:00:00Z') - 8 * 864e5).toISOString().slice(0, 10);
          const [pr] = await q("SELECT id, kind, target, label, now_value, new_value, effect_json, apply_on, urgent, reason, status, saved_by, saved_at, decided_by, decided_at, result_text, body_json FROM c2m_cost_pending WHERE status IN ('waiting','failed') OR (status='applied' AND decided_at>=?) ORDER BY urgent DESC, id DESC LIMIT 200", [since]);
          out.pending = pr.map(x => ({ id: x.id, kind: x.kind, target: x.target, label: x.label, now: x.now_value == null ? null : Number(x.now_value), next: x.new_value == null ? null : Number(x.new_value), effect: (() => { try { return JSON.parse(x.effect_json || 'null'); } catch (_) { return null; } })(), applyOn: String(x.apply_on).slice(0, 10), urgent: !!x.urgent, reason: x.reason, status: x.status, by: x.saved_by, at: x.saved_at, decidedBy: x.decided_by, decidedAt: x.decided_at, result: x.result_text, body: (() => { try { return JSON.parse(x.body_json || '{}'); } catch (_) { return {}; } })() })); } }
      const [li0] = await pq('SELECT id, list_name, data_json FROM c2m_list_price ORDER BY id'); const li = li0.filter(r => MASTER_LISTS.includes(r.list_name)); out.listItems = li.map(r => ({ id: r.id, list: r.list_name, data: JSON.parse(r.data_json) }));
      out.listMaster = { carried: await masterOn(), old: li0.length - li.length }; // 1.0.3 (D-87): the carry-over, and the rows kept read only that left the lists
      out.listOld = li0.filter(r => !MASTER_LISTS.includes(r.list_name)).map(r => { const d = JSON.parse(r.data_json); const l = String(r.list_name).replace(/_old$/, ''); const pk1 = d.packId != null ? D.packs.find(k => Number(k.id) === Number(d.packId)) : null; const c1 = pk1 ? D.cps.find(c => Number(c.id) === Number(pk1.client_product_id)) : null; const z1 = lib.rowSize(l, d); const fitsP = pk1 && (!z1 || !c1 || (Math.abs(z1.v - Number(pk1.pack_size)) < 1e-6 && z1.u === (c1.sold_per || 'kg')));
        return { id: r.id, list: l, packId: fitsP ? Number(d.packId) : null, name: `${d.p || ''}${l !== 'farmer' && d.pack ? ' ' + d.pack : ''}`, prices: Object.fromEntries((LIST_FIELDS[l] || []).map(f => [f, d[f] ?? null])), left: d.left || null }; }); // rows off the lists, with their prices, read only (Tahir, 20 Oct 2026)
      const [lr] = await pq("SELECT * FROM c2m_list_revision WHERE (status='approved' AND applied=0) OR id > (SELECT COALESCE(MAX(id), 0) - 30 FROM c2m_list_revision) ORDER BY id DESC"); const liById = new Map(li.map(r => [r.id, JSON.parse(r.data_json)]));
      { const [cc] = await pq("SELECT entity_id FROM c2m_audit WHERE entity='list_revision' AND action='replaced' AND why LIKE 'Closed at the carry-over%'"); const ccs = new Set(cc.map(x => Number(x.entity_id))); // revisions closed at the carry-over, shown with their prices (review 1.0.3, third check)
        const [crv] = ccs.size ? await q(`SELECT id, list_name, items_json, reason, back_reason, valid_from FROM c2m_list_revision WHERE id IN (${qs([...ccs])})`, [...ccs]) : [[]]; out.closedAtCarry = crv.map(r => ({ id: r.id, list: r.list_name, reason: r.reason, back: r.back_reason, items: JSON.parse(r.items_json).map(it => ({ product: it.product, pack: it.pack, to: it.to })) })); }
      out.listRevisions = lr.map(r => { const open = r.status === 'proposed' || r.status === 'sent_back' || (r.status === 'approved' && !Number(r.applied));
        return { ...r, urgent: urgOf('list_revision', r.id), byAdmin: byAd(r.proposed_by), items: JSON.parse(r.items_json).map(it => open ? itemNow(D, liById, it) : it), items_json: undefined }; }); /* a revision still open shows each row under its name today (review 1.0.2, design finding 5) */
      out.customers = D.customers.map(c => ({ id: c.id, name: c.name, grp: c.grp, segment: c.segment, priceRule: c.price_rule, cycle: c.price_cycle, region: c.region, o2sNames: c.o2s_names, printName: c.print_name || '' })); out.printNameReady = D.customers.length > 0 && 'print_name' in D.customers[0];
      { const [oo] = await pq("SELECT c.id, c.brand, cu.name customer FROM c2m_client_product c JOIN c2m_customer cu ON cu.id=c.customer_id WHERE c.active=0 AND c.channel='White label' ORDER BY cu.name, c.brand"); out.outOfUse = oo; }
      try { out.savedReports = await savedOf(user); } catch (e) { console.error('[c2m] saved reports not read: ' + (e.code || e.message)); out.savedReports = { ready: false, message: 'Saved reports could not be read just now.', rows: [] }; } /* push 5b (D-158): this person's own only */
      const [docs] = [fs.readdirSync(path.join(__dirname, 'docs')).filter(f => f.endsWith('.md')).sort()]; out.docs = docs;
    } else {
      out.docs = fs.readdirSync(path.join(__dirname, 'docs')).filter(f => docAllowed(acc, f)).sort();
    }
    T('tail');
    return out;
  }
  /** Which stored list an audience prints from: farmer_pb, farmer_sn, farmer_snc and web all use the farmer list. */
  /** Documentation by role (review S9): KAMs get the guide and access only; recipe roles add the process flows. */
  function docAllowed(acc, f) { return acc.can.has('guide.all') || /^07-|^11-/.test(f) || (acc.can.has('see.products') && /^01-/.test(f)); }
  function listOf(aud) { return aud === 'dist' ? 'dist' : aud === 'dealer' ? 'dealer' : aud === 'wl' ? 'wl' : 'farmer'; }
  /* Only price fields ever leave the server: the import pack carries cost and margin on some rows (review M1, 16 Oct). */
  const LIST_SAFE = ['p', 'd', 'pack', 'prev', 'now', 'fed', 'mrp', 'terms', 'nsv', 'disc', 'net', 'netfed', 'frp', 'pb', 'sn', 'snc'];
  const safeRow = (d, farmerCols) => Object.fromEntries(Object.entries(d).filter(([k]) => LIST_SAFE.includes(k) && (!farmerCols || !['pb', 'sn', 'snc'].includes(k) || farmerCols.includes(k))));
  /** The 3 VAN brand lists as they print. M (the master packs, once the lists are carried into the master, D-87): each row under its
   * master pack's official name and pack, in master order, products A to Z, packs small to large. Rows left at the carry-over
   * (<list>_old) are never printed. */
  function groupLists(lp, farmerCols, M, withPack) { // withPack: the server's own documents keep each row's pack (the issued distributor list sets prev by pack, D-87); a KAM never receives it
    const g = { dist: [], dealer: [], farmer: [], issued: null, till: null, dates: {} }; const by = { dist: [], dealer: [], farmer: [] };
    lp.forEach(r => { if (!by[r.list_name]) return; let d = JSON.parse(r.data_json); const m = M && d.packId != null ? M.get(Number(d.packId)) : null;
      if (m) { d = lib.officialRow(r.list_name, d, m.brand, m.size, m.soldPer).nd; d.d = String(m.spec || '').trim(); if (d.prevPack != null && Number(d.prevPack) !== Number(d.packId)) d.prev = null; } // the description too: C2M's spec only, the same on all 3 lists (Tahir, 20 Oct 2026); none typed yet prints none (the carry screen names those products)
      const o = safeRow(d, r.list_name === 'farmer' ? farmerCols : null); if (withPack && d.packId != null) o.packId = Number(d.packId); by[r.list_name].push({ d: o, m, i: by[r.list_name].length }); g.issued = r.issued; g.till = r.valid_till; g.dates[r.list_name] = { issued: r.issued, till: r.valid_till }; });
    for (const l of MASTER_LISTS) { const a = by[l]; if (M) a.sort((x, y) => (x.m ? 0 : 1) - (y.m ? 0 : 1) || (x.m && y.m ? lib.masterCmp(x.m, y.m) : 0) || x.i - y.i); g[l] = a.map(x => x.d); }
    return g;
  }
  async function wlListData(D, approvedPrice, clients) {
    const out = {};
    for (const name of clients) {
      const cust = D.customers.find(c => c.name === name); if (!cust) continue;
      const rows = [];
      for (const cp of D.cps.filter(c => c.customer_id === cust.id && c.channel === 'White label')) for (const p of D.packs.filter(x => x.client_product_id === cp.id)) {
        const ap = approvedPrice.get(p.id); if (!ap) continue;
        rows.push({ packId: p.id, typeId: cp.base_product_id == null ? null : Number(cp.base_product_id), fam: lib.familyColour(cp.base_product_id, D.productTypes), famName: cp.base_product_id == null ? 'Other' : ((D.productTypes.find(t => Number(t.id) === Number(cp.base_product_id)) || {}).name || 'Other'), size: Number(p.pack_size), brand: cp.brand, spec: cp.spec, pack: lib.officialPack(p.pack_size, cp.sold_per), cur: Number(ap.price), prev: ap.prev_price == null ? null : Number(ap.prev_price), reason: ap.reason, from: String(ap.valid_from).slice(0, 10) });
      }
      out[name] = { name: cust.print_name || cust.name, rule: cust.price_rule, rows }; // the name the list prints (D-109)
    }
    return out;
  }

  /* ?as=username: Tahir and Yawar see a manager's screen exactly as he sees it (KAM lists, D-91). Read only: the page blocks every save while it shows. */
  app.get('/api/c2m/state', wrap(async (req, res) => {
    let acc = req.c2m, user = req.c2m.user; const as = String(req.query.as || '').trim().toLowerCase();
    if (as) {
      if (!mayDo(req, 'grants.give')) throw Object.assign(new Error('Your role cannot do this in C2M.'), { status: 403 });
      const [[p]] = await q("SELECT a.name, r.role FROM user_module_roles r LEFT JOIN auth_users a ON a.username=r.username WHERE r.username=? AND r.module='c2m'", [as]);
      const R = p ? (req.c2m.roles || await loadRoles()).get(p.role) : null;
      if (!isViewerRole(R)) throw bad('You can see only the screen of a manager who is given price lists and clients.');
      if (!req.c2m.admin && ['see.settings','see.materials','see.cost','see.price'].some(a => R.can.has(a) && !req.c2m.can.has(a))) throw bad('That role can see settings, materials or costs that your role cannot, so its screen cannot be shown to you.');
      acc = { role: R.key, user: as, name: p.name || as, label: R.label, admin: false, actions: R.actions, can: R.can, nav: R.nav, more: R.more, roles: req.c2m.roles }; user = as;
    }
    /* Speed (11 Nov 2026): the answer is kept 30 seconds for the same person and thrown away at once when anyone saves anything in C2M,
       so a second open or a tab switch does not rebuild 565 KB. A save that starts while a build is running makes that build's answer unusable (version check). */
    const ckey = user + '|' + as + '|' + acc.role, hit = stateCache.get(ckey);
    if (hit && hit.ver === writeVer && Date.now() - hit.at < STATE_TTL) { res.set('Server-Timing', 'cache;dur=0'); res.type('json').send(hit.body); return; }
    const ver = writeVer, t0 = Date.now();
    if (!as && (mayDo(req, 'reapproval.decide') || req.c2m.admin)) await sweepOnce(user).catch(e => console.error('[c2m] first-cost sweep', e.message));
    const t1 = Date.now();
    const tm = []; const out = await build(acc, user, tm); out.me.name = acc.name; if (as) out.preview = { user: as, name: acc.name };
    const tj = Date.now(); const body = JSON.stringify(out); tm.push('json;dur=' + (Date.now() - tj)); stateCache.set(ckey, { ver, at: Date.now(), body }); if (stateCache.size > 60) stateCache.delete(stateCache.keys().next().value);
    res.set('Server-Timing', `sweep;dur=${t1 - t0}, build;dur=${Date.now() - t1}, ` + tm.join(', ')); res.type('json').send(body);
  }));

  /* ---------- O2S pull (read only) ---------- */
  /** 1 pull of O2S, by a person (Pull now) or by C2M itself (the daily pull). The claim on c2m_source lets only 1 pull run at a time,
   *  across every instance of the server: a second one gets 409 (manual) or is skipped (daily). */
  async function pullOnce(by, why) {
    const stale = lib.pkNow(new Date(Date.now() - 10 * 60 * 1000));
    const [claim] = await q("UPDATE c2m_source SET status='Pulling', last_pull_note=? WHERE system_name='O2S' AND what LIKE 'Customers%' AND (status<>'Pulling' OR last_pull_note IS NULL OR last_pull_note < ?)", ['Pulling since ' + now(), 'Pulling since ' + stale]);
    if (!claim.affectedRows) throw Object.assign(new Error('A pull is already running. Wait a minute, then look again.'), { status: 409 });
    try {
      return await tx(async () => { const x = await pullO2S(q, by); await audit(by, 'sync', x.syncId, 'pull', null, { poLines: x.poLines, trucks: x.trucks }, why); return x; });
    } catch (e) {
      await q("UPDATE c2m_source SET status='Failed', last_pull_note=? WHERE system_name='O2S' AND what LIKE 'Customers%'", [String(e.message).slice(0, 250)]);
      throw e;
    }
  }
  app.post('/api/c2m/sync', can('o2s.sync'), wrap(async (req, res) => { res.json(await pullOnce(req.c2m.user, 'Pull now')); }));

  /* ---------- Daily pull (Tahir, 4 Nov 2026, D-145: "Pull by itself daily") ----------
     Every day at about 06:00 Pakistan time, and once a few minutes after the server starts when the last finished pull is more than
     20 hours old. Same pull and claim as Pull now; by 'c2m-auto'. A failure is logged and tried again at the next check; it never stops the server. */
  const AUTO = { hour: 6, staleHours: 20, everyMs: 15 * 60 * 1000, firstMs: 3 * 60 * 1000 };
  /** Due now? lastFinished: 'YYYY-MM-DD HH:MM:SS' Pakistan time or null; nowPk the same; atStart: the first check after the server starts.
   *  Pure, so it is tested alone. The 20 hour rule is for the start only, so the daily pull stays at about 06:00. */
  function autoPullDue(lastFinished, nowPk, atStart) {
    if (!lastFinished) return true;
    const t = s => Date.parse(String(s).replace(' ', 'T') + 'Z'); // both are Pakistan wall-clock times: compared as if UTC, the gap is right
    if (atStart && (t(nowPk) - t(lastFinished)) / 36e5 >= AUTO.staleHours) return true;
    const today6 = nowPk.slice(0, 10) + ' ' + String(AUTO.hour).padStart(2, '0') + ':00:00';
    return nowPk >= today6 && String(lastFinished) < today6; // past 06:00 today and nothing finished since
  }
  /** Packs of 1 freight segment and region (reapprovalFor passes its own loadAll to the filter). */
  const freightPacks = (segment, reg) => (p, D0) => { const cp = D0.cpById.get(p.client_product_id); const cu = cp && D0.custById.get(cp.customer_id); return !!cp && cp.channel === segment && !!cu && lib.sameRegion(cu.region, reg); };
  /** A freight rate dated ahead reaches its date (review 4 Nov): the packs it moves are checked for re-approval once, that day or the next pass.
   *  A rate saved on or after its own date was checked at the save. Looks back 7 days, so a server that was down still catches up. */
  let freightBusy = false;
  async function freightDueSweep() {
    if (freightBusy || mountFault) return 0; freightBusy = true; let n = 0;
    try {
      const t = today();
      const [rows] = await q('SELECT segment, region, valid_from FROM c2m_freight_rate WHERE valid_from<=? AND valid_from>DATE_SUB(?, INTERVAL 7 DAY)', [t, t]);
      for (const r of rows) {
        const vf = String(r.valid_from).slice(0, 10), key = `${r.segment}|${r.region}|${vf}`.slice(0, 60);
        await tx(async () => {
          const [[done]] = await q("SELECT id FROM c2m_audit WHERE entity='freight_due' AND entity_id=? LIMIT 1 FOR UPDATE", [key]); if (done) return;
          const [[atSave]] = await q("SELECT id FROM c2m_audit WHERE entity='freight' AND entity_id=? AND action='save' AND at>=? AND new_value LIKE ? LIMIT 1", [`${r.segment}|${r.region}`, vf + ' 00:00:00', `%"validFrom":"${vf}"%`]);
          const re = atSave ? 0 : await reapprovalFor(`Freight ${r.segment} ${r.region} from ${vf} reached its date`, freightPacks(r.segment, r.region));
          if (re) await costNotice('c2m', `Freight ${r.segment} ${r.region} dated ${vf} is in force from today`, re);
          await audit('c2m', 'freight_due', key, 'checked', null, { reapproval: re }, 'Freight rate reached its date'); n++;
        });
      }
      /* Once (5 Nov 2026, review of fault A7): a freight row saved before in other capitals ("sindh") matched no client; regions now
         match with capitals ignored, so such a row can start to count. Each segment and region with more than 1 spelling is
         checked for re-approval once (marker entity freight_case). */
      const [allF] = await q('SELECT DISTINCT segment, region FROM c2m_freight_rate'); const grp = new Map();
      for (const r of allF) { const k = `${r.segment}|${String(r.region || '').trim().replace(/\s+/g, ' ').toLowerCase()}`; if (!grp.has(k)) grp.set(k, []); grp.get(k).push(r.region); }
      for (const [k, spell] of grp) { if (new Set(spell).size < 2) continue; const seg = k.split('|')[0];
        await tx(async () => {
          const [[done]] = await q("SELECT id FROM c2m_audit WHERE entity='freight_case' AND entity_id=? LIMIT 1 FOR UPDATE", [k.slice(0, 60)]); if (done) return;
          const re = await reapprovalFor(`Freight ${seg} ${spell[0]}: rows saved in other capitals (${spell.join(', ')}) now count, ${t}`, freightPacks(seg, spell[0]));
          if (re) await costNotice('c2m', `Freight ${seg} ${spell[0]}: rows saved in other capitals now count`, re);
          await audit('c2m', 'freight_case', k.slice(0, 60), 'checked', null, { spellings: spell, reapproval: re }, 'Freight region spellings joined (fault A7)'); n++;
        });
      }
    } catch (e) { console.error('[c2m] freight date check failed: ' + (e && e.message)); } finally { freightBusy = false; }
    return n;
  }
  let autoBusy = false;
  async function autoPull(nowPk, atStart) {
    if (autoBusy || mountFault) return 'skip';
    autoBusy = true;
    try {
      const [[last]] = await q('SELECT MAX(finished_at) f FROM c2m_sync_run');
      if (!autoPullDue(last && last.f ? String(last.f).slice(0, 19) : null, nowPk || now(), atStart)) return 'not due';
      const r = await pullOnce('c2m-auto', 'Daily pull');
      console.log(`[c2m] daily pull: ${r.poLines} PO lines, ${r.trucks} trucks, ${r.issues.length} issues`);
      return 'pulled';
    } catch (e) {
      if (e && e.status === 409) return 'busy';
      console.error('[c2m] daily pull failed: ' + (e && e.message)); return 'failed';
    } finally { autoBusy = false; }
  }
  if (!deps.noAutoPull) {
    const t1 = setTimeout(() => { autoPull(null, true).catch(() => {}).then(() => applyDue()).catch(() => {}); }, AUTO.firstMs); if (t1.unref) t1.unref();
    const t2 = setInterval(() => { autoPull().catch(() => {}).then(() => applyDue()).catch(() => {}).then(() => freightDueSweep()).catch(() => {}); }, AUTO.everyMs); if (t2.unref) t2.unref(); // Monday costs go in before the freight check (push 2b)
  }
  module.exports._test = Object.assign(module.exports._test || {}, { autoPullDue, autoPull, freightDueSweep, applyDue: (...a) => applyDue(...a), nextMonday: d => nextMonday(d) });

  /* ---------- Recipes: write, review, endorse, approve cost, send back (ruling 13 to 14 Oct) ---------- */
  async function getVersion(id) { const [[v]] = await q('SELECT * FROM c2m_recipe_version WHERE id=?', [id]); if (!v) throw bad('This recipe version is no longer in C2M. Press Refresh; if it is still missing, it was deleted.'); return v; }
  async function step(vid, action, by, note) { await q('INSERT INTO c2m_recipe_step (recipe_version_id, action, by_user, at, note) VALUES (?,?,?,?,?)', [vid, action, by, now(), note || null]); }
  /* ---------- Push 7b (Tahir, 9 Nov 2026, R63 to R65, R68, R69, D-163) ---------- */
  /** The lines of a version as they were when it was last sent back (kept in the change record), or null when not known. */
  async function backSig(vid) {
    const [[a]] = await q("SELECT new_value FROM c2m_audit WHERE entity='recipe' AND entity_id=? AND action='sent_back' ORDER BY id DESC LIMIT 1", [String(vid)]);
    if (!a || !a.new_value) return null; try { const j = JSON.parse(a.new_value); return j && typeof j.lines === 'string' ? j.lines : null; } catch (e) { return null; }
  }
  /** What is red on a recipe at a check (R68): the analysis not complete, or a nutrient below the product's declared grade. */
  function recipeFlags(D, vid) {
    const vo = D.recipes.byVer.get(Number(vid)); if (!vo) return [];
    const N = engine.nutrients(engine.priceRecipe(D, vo), engine.analysisOpts(D, vo.client_product_id)), out = [];
    if (!N.complete) out.push('the nutrient analysis is not complete');
    if (D.m014) { const g = lib.gradeCheck(D.declared.get(Number(vo.client_product_id)) || [], N); g.rows.filter(r => r.state === 'below').forEach(r => out.push(`${r.label} is ${r.by} below the label`));
      if (N.complete && g.rows.some(r => r.state === 'unknown' && /product density/.test(r.why || ''))) out.push('the product density is missing, so the label cannot be checked'); } // push 7c (R71)
    return out;
  }
  /** A recipe in words for a notice: "Enrich for Syngenta Pakistan, version 3 (DAP in place of TSP)". */
  function recipeWords(D, vid) {
    const vo = D.recipes.byVer.get(Number(vid)); const cp = vo ? D.cpById.get(vo.client_product_id) : null; const cu = cp ? D.custById.get(cp.customer_id) : null;
    return `${cp ? cp.brand : 'A product'}${cu ? ' for ' + cu.name : ''}, version ${vo ? vo.version_no : '?'}${vo && vo.rname && vo.rname !== engine.MAIN ? ` (${vo.rname})` : ''}`;
  }
  const whoW = c => `${c.name || c.user} (${c.label})`;
  const NEXT_W = { review: 'Check recipe', endorse: 'Endorse recipe', cost: 'Approve cost' };

  app.post('/api/c2m/recipes/new', can('recipe.start'), wrap(async (req, res) => {
    const { clientProductId, fromVersionId, note, recipeKind } = req.body || {};
    const [[cp]] = await q('SELECT id, active FROM c2m_client_product WHERE id=?', [clientProductId]); if (!cp) throw bad('Pick a client product.');
    /* D-140: a new version of the Default recipe, or another recipe of the product with its own name (e.g. "DAP in place of TSP") */
    const D00 = await engine.loadAll(q); const dn = engine.defaultName(D00, cp.id); let rname = dn;
    if (recipeKind === 'other') {
      if (!D00.m007) throw Object.assign(new Error('A second recipe is not switched on yet: IT has 1 step to run. Nothing was saved; try again after IT has run it.'), { status: 409 });
      rname = cleanName(req.body.recipeName, 80, 'recipe name');
      if (nmK(rname) === nmK(dn)) throw bad(`"${rname}" is the name of the Default recipe. Pick "A new version of the Default recipe", or give this recipe another name.`);
      const other = engine.approvedVersions(D00, cp.id).concat([...(D00.recipes.byCp.get(cp.id) || [])]).find(v => nmK(v.rname) === nmK(rname)); if (other) rname = other.rname; // the same name as an earlier recipe: a new version of that recipe
    }
    { const [ex] = await softQ('SELECT follows_product_id FROM c2m_product_ext WHERE client_product_id=?', [cp.id]); if (ex && ex[0] && ex[0].follows_product_id) throw bad('This product follows one of our products\' recipe, so it has no recipe of its own. Change the recipe of the product it follows.'); }
    const outOfUse = () => bad('This product is out of use (Setup, Products and variants): put it back in use before writing a recipe version.'); if (!Number(cp.active)) throw outOfUse();
    if (fromVersionId) { const [[fv]] = await q('SELECT id FROM c2m_recipe_version WHERE id=? AND client_product_id=?', [fromVersionId, cp.id]); if (!fv) throw bad('Copy from a version of the same product.'); }
    const id = await tx(async () => {
      await lockNames(); { const [[a]] = await q('SELECT active FROM c2m_client_product WHERE id=?', [cp.id]); if (!Number(a.active)) throw outOfUse(); } // a product taken out of use at the same moment (review 1.0.2 re-check 3, finding 3)
      const [[open]] = await q("SELECT id FROM c2m_recipe_version WHERE client_product_id=? AND state IN ('draft','review','endorse','cost')", [cp.id]); // read under the lock: 2 people at once get the clear message (review 1.0.2 re-check 4, finding 4)
      if (open) throw bad('This product already has a version in progress. Finish or send it back first.');
      const [[mx]] = await q('SELECT COALESCE(MAX(version_no),0) n FROM c2m_recipe_version WHERE client_product_id=?', [cp.id]);
      const [ins] = await q("INSERT INTO c2m_recipe_version (client_product_id, version_no, state, note, created_by, created_at) VALUES (?,?,'draft',?,?,?)", [cp.id, mx.n + 1, String(note || 'New version').slice(0, 400), req.c2m.user, now()]);
      if (fromVersionId) { const [lines] = await q('SELECT grade_id, qty FROM c2m_recipe_line WHERE recipe_version_id=?', [fromVersionId]); for (const l of lines) await q('INSERT INTO c2m_recipe_line (recipe_version_id, grade_id, qty) VALUES (?,?,?)', [ins.insertId, l.grade_id, l.qty]); }
      if (rname !== engine.MAIN) await q('INSERT INTO c2m_recipe_name (recipe_version_id, recipe_name) VALUES (?,?)', [ins.insertId, rname]);
      await step(ins.insertId, 'written', req.c2m.user, note); await audit(req.c2m.user, 'recipe', ins.insertId, 'new', null, { clientProductId, version: mx.n + 1, recipe: rname }, note);
      return ins.insertId;
    });
    res.json({ id });
  }));

  app.post('/api/c2m/recipes/:id/lines', can('recipe.edit'), wrap(async (req, res) => {
    const v = await getVersion(req.params.id); if (v.state !== 'draft') throw bad('Only a draft can be changed.');
    const lines = (req.body || {}).lines || [];
    if (!lines.length) throw bad('A recipe needs at least 1 input.');
    for (const l of lines) if (!(Number(l.qty) > 0) || !l.gradeId) throw bad('Every line needs a material and a quantity above 0.');
    const gids = lines.map(l => Number(l.gradeId)); const [gr] = await q(`SELECT id FROM c2m_material_grade WHERE id IN (${qs(gids)})`, gids);
    { const [had] = await q('SELECT grade_id FROM c2m_recipe_line WHERE recipe_version_id=?', [v.id]); const [oo] = await softQ("SELECT entity_id FROM c2m_out_of_use WHERE entity='material_grade'"); const off = new Set(oo.map(x => Number(x.entity_id))); const was = new Set(had.map(x => Number(x.grade_id)));
      if (gids.some(g => off.has(g) && !was.has(g))) throw bad('A material on these lines is out of use. Put it back in use in Costs, Material cost, or pick another.'); }
    if (new Set(gr.map(g => g.id)).size !== new Set(lines.map(l => Number(l.gradeId))).size) throw bad('A material on this recipe is not in the master list.');
    await tx(async () => {
      const [[still]] = await q("SELECT id FROM c2m_recipe_version WHERE id=? AND state='draft' FOR UPDATE", [v.id]); if (!still) throw moved();
      { const [g2] = await q(`SELECT id FROM c2m_material_grade WHERE id IN (${qs(gids)}) LOCK IN SHARE MODE`, gids); if (new Set(g2.map(g => g.id)).size !== new Set(gids).size) throw moved(); } // a material deleted a moment ago (review 30 Oct)
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
    if (!req.c2m.can.has('recipe.step.' + v.state)) throw Object.assign(new Error('This step is not yours.'), { status: 403 });
    const [[n]] = await q('SELECT COUNT(*) n FROM c2m_recipe_line WHERE recipe_version_id=?', [v.id]); if (!n.n) throw bad('Add the recipe lines first.');
    /* D-140 (Tahir, 30 Oct 2026): another recipe of a product that already has its Default takes the short path. Push 7b (R64, D-163):
       the short path is now Majid, Himayat, Yawar (the Plant Manager is skipped), so the QC Head checks every recipe the plant may run. */
    const Dp = await engine.loadAll(q); const vo = Dp.recipes.byVer.get(v.id); const other = vo && vo.rname !== engine.defaultName(Dp, v.client_product_id) && engine.approvedVersions(Dp, v.client_product_id).length > 0;
    const note = String((req.body || {}).note || '').replace(/\s+/g, ' ').trim().slice(0, 400);
    let next = (other && lib.RECIPE_FLOW_OTHER[v.state]) || lib.RECIPE_FLOW[v.state]; let changed = null, nowSig = null;
    if (v.state === 'draft' && v.sent_back_state) { // R63: a resend goes back to the QC Head when the lines changed since it was sent back; else straight to the sender (ruled 14 Oct)
      const [ln] = await q('SELECT grade_id, qty FROM c2m_recipe_line WHERE recipe_version_id=?', [v.id]); const before = await backSig(v.id); nowSig = lib.lineSig(ln);
      changed = before == null ? null : before !== nowSig; next = lib.resendTo(v.sent_back_state, before, nowSig); if (other && next === 'endorse') next = 'review'; // changed null: not known (sent back before 7b), so the QC Head
    }
    /* R68: passing a recipe with something red (analysis not complete, below the declared grade) needs a comment, kept on its step. */
    if (['review', 'endorse'].includes(v.state)) { const red = recipeFlags(Dp, v.id); if (red.length && !note) throw bad(`Write a comment before you pass it, because ${red.join('; ')}.`); }
    /* Review 30 Oct, finding 3: a version that took the short path as another recipe, whose recipe has since become the Default, goes through Himayat and Fahim. */
    const [stp] = await q('SELECT action FROM c2m_recipe_step WHERE recipe_version_id=?', [v.id]); const checked = stp.some(x => x.action === 'reviewed') && stp.some(x => x.action === 'endorsed');
    if (!other && v.state === 'draft' && v.sent_back_state === 'cost' && !checked) next = 'review';
    /* Review 7b, M1 (R64): a short-path version never reaches the cost step without the QC Head, also one sent on before 7b. */
    const qcDone = stp.some(x => x.action === 'reviewed');
    if (other && v.state === 'draft' && next === 'cost' && !qcDone) next = 'review';
    if (other && v.state === 'cost' && !qcDone) throw bad('The QC Head now checks every recipe, another recipe of a product too, and this version has not been checked. Send it back to the Production Manager; when he resends it, it goes to the QC Head.');
    if (!other && v.state === 'cost' && !checked && engine.approvedVersions(Dp, v.client_product_id).length) throw bad(`"${vo ? vo.rname : ''}" is the Default recipe now, so this version needs the QC Head's review and the Plant Manager's endorsement before its cost is approved. Send it back to the Production Manager; when he resends it, it goes to the QC Head.`);
    if (next === 'approved') {
      const D0 = await engine.loadAll(q); const pr = engine.priceRecipe(D0, D0.recipes.byVer.get(v.id));
      if (pr.missingRate) throw bad('A material on this recipe has no rate. Enter its rate first, then approve the cost.');
      const gaps = packsWithoutRates(D0, p => p.client_product_id === v.client_product_id); if (gaps.length) throw bad(`No labour or FOH rate applies to: ${gaps.join('; ')}. ${D0.lf ? 'Fill Labour rate Low and FOH rate Low (or the rate the product is on) in Costs, Labour or FOH first.' : 'Add the rate in Costs, Labour or FOH first.'}`);
      // Every pack must be fully costed on this version: no Rs 0 or part-priced packing goes into a cost version (defect 1)
      const cp0 = D0.cpById.get(v.client_product_id), ver0 = D0.recipes.byVer.get(v.id), notCosted = [];
      if (!cp0) throw bad('This product is out of use. Put it back in use first (Setup, Products and variants), then approve its cost.');
      for (const p of D0.packs.filter(p => p.client_product_id === v.client_product_id)) { const c = engine.packCost(D0, p, { version: ver0 }); if (c && !c.costed) notCosted.push(`${cp0.brand} ${Number(p.pack_size)} ${cp0.sold_per}: ${c.gaps.join(', ')}`); }
      if (notCosted.length) throw bad(`The cost cannot be approved until every pack is fully costed. ${notCosted.join('; ')}. Fix the packing bill or price in Costs, Packing first, then approve again.`);
    }
    const act = { draft: v.sent_back_state ? 'resent' : 'sent', review: 'reviewed', endorse: 'endorsed', cost: 'cost_approved' }[v.state];
    await tx(async () => {
    if (nowSig != null) { const [[lk]] = await q('SELECT id FROM c2m_recipe_version WHERE id=? FOR UPDATE', [v.id]); if (!lk) throw moved(); const [ln2] = await q('SELECT grade_id, qty FROM c2m_recipe_line WHERE recipe_version_id=?', [v.id]); if (lib.lineSig(ln2) !== nowSig) throw moved(); } // review 7b, minor 1: lines saved from another tab a moment ago
    const [u] = await q('UPDATE c2m_recipe_version SET state=?, sent_back_by=NULL, sent_back_state=NULL WHERE id=? AND state=?', [next, v.id, v.state]);
    if (!u.affectedRows) throw moved();
    await step(v.id, act, req.c2m.user, note || null);
    if (next === 'approved') {
      /* D-140: approving a version makes the earlier approved version of the SAME recipe old; the product's other recipes stay approved. */
      const Db = await engine.loadAll(q); const myName = (Db.recipes.byVer.get(v.id) || {}).rname || engine.MAIN; const hadAppr = engine.approvedVersions(Db, v.client_product_id).filter(x => x.id !== v.id);
      const same = hadAppr.filter(x => (x.rname || engine.MAIN) === myName).map(x => x.id);
      if (same.length) await q(`UPDATE c2m_recipe_version SET state='old' WHERE id IN (${qs(same)}) AND state='approved'`, same);
      if (!hadAppr.length && myName !== engine.MAIN && Db.m007) await q('INSERT INTO c2m_recipe_default (client_product_id, recipe_name, set_by, set_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE recipe_name=VALUES(recipe_name), set_by=VALUES(set_by), set_at=VALUES(set_at)', [v.client_product_id, myName, req.c2m.user, now()]); // the first approved recipe is the Default by itself
      const D = await engine.loadAll(q);
      const isDef = (engine.approvedVersion(D, v.client_product_id) || {}).id === v.id;
      if (isDef) for (const p of D.packs.filter(p => p.client_product_id === v.client_product_id)) {
        const c = engine.packCost(D, p); if (!c || !c.costed) { const cpx = D.cpById.get(p.client_product_id); throw bad(`The cost cannot be approved: ${cpx ? cpx.brand + ' ' : ''}${Number(p.pack_size)} ${cpx ? cpx.sold_per : ''} is not fully costed (${c ? c.gaps.join(', ') : 'product out of use'}). Nothing was saved.`); } // checked again inside the transaction
        await q('INSERT INTO c2m_cost_version (client_pack_id, valid_from, materials, packing, conversion, freight, total, recipe_version_id, cause, approved_by) VALUES (?,?,?,?,?,?,?,?,?,?)',
          [p.id, now(), c.materials, c.packing, c.conversion, c.freight, c.total, v.id, `Recipe version ${v.version_no} approved`, req.c2m.user]);
      }
      /* D-98: a product that follows this one takes its approved recipe. Each of its packs that is fully costed gets a new approved cost at once
         (its own packing, labour and overhead). A pack of a follower that is not fully costed does not hold up this approval: it waits for its own approval. */
      if (isDef) for (const [fid, e] of D.ext) if (Number(e.followsId) === Number(v.client_product_id)) {
        const fcp = D.cpById.get(fid); if (!fcp) continue;
        for (const p of D.packs.filter(p => p.client_product_id === fid)) {
          const c = engine.packCost(D, p); if (!c || !c.costed) continue;
          await q('INSERT INTO c2m_cost_version (client_pack_id, valid_from, materials, packing, conversion, freight, total, recipe_version_id, cause, approved_by) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [p.id, now(), c.materials, c.packing, c.conversion, c.freight, c.total, v.id, `Recipe of ${D.cpById.get(v.client_product_id).brand} version ${v.version_no} approved (followed by ${fcp.brand})`, req.c2m.user]);
          await audit(req.c2m.user, 'client_pack', p.id, 'cost_approved', null, { total: c.total, recipeVersion: v.id }, `Followed recipe of ${D.cpById.get(v.client_product_id).brand} approved`);
        }
      }
    }
    await audit(req.c2m.user, 'recipe', v.id, act, v.state, next, other ? 'Another recipe of the product: short path, the Production Manager, the QC Head, then the CFO (R64)' : null);
    /* R65: a notice to the next person, and to the Production Manager when the cost is approved (saved with the step or not at all). */
    const rw = recipeWords(Dp, v.id);
    if (next === 'approved') await notice('production', `Approved: ${rw}. Cost approved by ${whoW(req.c2m)}.`, req.c2m.user);
    else if (NEXT_W[next]) await notice(lib.RECIPE_WHO[next], `${NEXT_W[next]}: ${rw}. ${act === 'resent' ? (next === 'review' && v.sent_back_state !== 'review' ? (changed === null ? 'Resent; C2M does not know whether the lines changed since it was sent back, so it starts again with the QC Head' : 'Resent with changed lines, so it starts again with the QC Head') : 'Resent') : act === 'sent' ? 'Sent' : act === 'reviewed' ? 'Reviewed' : 'Endorsed'} by ${whoW(req.c2m)}${note ? `. Comment: ${note}` : ''}.`, req.c2m.user);
    });
    res.json({ state: next, other: !!other, changed });
  }));

  app.post('/api/c2m/recipes/:id/sendback', wrap(async (req, res) => {
    const v = await getVersion(req.params.id);
    if (!['review', 'endorse', 'cost'].includes(v.state) || !req.c2m.can.has('recipe.step.' + v.state)) throw Object.assign(new Error('Only the person at this step can send it back.'), { status: 403 });
    const reason = String((req.body || {}).reason || '').trim(), advice = String((req.body || {}).advice || '').trim();
    if (!reason || !advice) throw bad('Write a reason and revision advice.');
    await tx(async () => {
      const [u] = await q("UPDATE c2m_recipe_version SET state='draft', sent_back_by=?, sent_back_state=?, sent_back_reason=?, sent_back_advice=? WHERE id=? AND state=?", [req.c2m.user, v.state, reason.slice(0, 400), advice.slice(0, 400), v.id, v.state]);
      if (!u.affectedRows) throw moved();
      await step(v.id, 'sent_back', req.c2m.user, reason + ' | Advice: ' + advice);
      const [ln] = await q('SELECT grade_id, qty FROM c2m_recipe_line WHERE recipe_version_id=?', [v.id]);
      await audit(req.c2m.user, 'recipe', v.id, 'sent_back', v.state, { to: 'draft', lines: lib.lineSig(ln) }, reason); // R63: the lines as sent back, compared at resend
      const Dn = await engine.loadAll(q); await notice('production', `Sent back: ${recipeWords(Dn, v.id)}, by ${whoW(req.c2m)}. Reason: ${reason.slice(0, 140)}. Advice: ${advice.slice(0, 140)}.`, req.c2m.user); // R65
    });
    res.json({ ok: true });
  }));
  /* R69: the QC Head, the Plant Manager or the CFO closes a version that is not going ahead, with a reason. At their own step, or a
     draft they sent back. Closed is kept with its steps and lines; the product's next version starts from its approved one. */
  app.post('/api/c2m/recipes/:id/close', wrap(async (req, res) => {
    const v = await getVersion(req.params.id);
    const atStep = ['review', 'endorse', 'cost'].includes(v.state) && req.c2m.can.has('recipe.step.' + v.state);
    const sender = v.state === 'draft' && v.sent_back_by && (v.sent_back_by === req.c2m.user || req.c2m.admin) && req.c2m.can.has('recipe.step.' + v.sent_back_state);
    if (!atStep && !sender) throw Object.assign(new Error(v.state === 'draft' ? 'Only the person who sent it back closes a draft; the Production Manager may delete his own draft.' : ['approved', 'old', 'closed'].includes(v.state) ? 'Only a version in progress can be closed.' : 'Only the person at this step can close it.'), { status: 403 });
    const reason = String((req.body || {}).reason || '').replace(/\s+/g, ' ').trim();
    if (reason.length < 5) throw bad('Write why this version is closed (at least a few words): the Production Manager reads it.');
    await tx(async () => {
      const [u] = await q("UPDATE c2m_recipe_version SET state='closed' WHERE id=? AND state=?", [v.id, v.state]); if (!u.affectedRows) throw moved();
      await step(v.id, 'closed', req.c2m.user, reason.slice(0, 400));
      await audit(req.c2m.user, 'recipe', v.id, 'closed', v.state, 'closed', reason.slice(0, 400));
      const Dn = await engine.loadAll(q); await notice('production', `Closed: ${recipeWords(Dn, v.id)}, by ${whoW(req.c2m)}. Reason: ${reason.slice(0, 200)}.`, req.c2m.user);
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
        reapprove: base != null && lib.needsReapproval(base, c1.total, S.reapprove_pct), openKg: ok, rsOnOpen: nowC != null ? (c1.total - nowC) * ok : null, priceForTarget: lib.targetPrice(c1.total, lib.targetOr(cp.target_gp, S.budget_gp)) }); // a product on the company target gets its price too (review C9)
    }
    return out;
  }
  app.post('/api/c2m/rates/try', can('rate.save'), wrap(async (req, res) => {
    const { gradeId, rate } = req.body || {};
    const D = await engine.loadAll(q); const g = D.rates.get(Number(gradeId)); if (!g) throw bad('This material is no longer in C2M. Press Refresh; if it is still missing, it was deleted.');
    res.json({ warning: lib.rateWarning(g.rate, Number(rate), D.settings.values.rate_warn_pct), impact: await impactOfRate(Number(gradeId), Number(rate)) });
  }));
  const strictNum = v => (/^\s*\d+(\.\d+)?\s*$/.test(String(v)) ? Number(v) : NaN);
  async function saveRate(user, gradeId, rate, source, confirmed) {
    const D = await engine.loadAll(q); const g = D.rates.get(Number(gradeId)); if (!g) throw bad('This material is no longer in C2M. Press Refresh; if it is still missing, it was deleted.');
    const r = strictNum(rate); if (!(r > 0)) throw bad('Type a rate above 0, digits only.');
    if (!String(source || '').trim()) throw bad('Add the source: PO number or quote.');
    const w = lib.rateWarning(g.rate, r, D.settings.values.rate_warn_pct);
    if (w.warn && !confirmed) throw bad(`Did you mean Rs ${lib.fmtRs2(r)}? It is ${w.pct.toFixed(0)}% from the last saved rate of Rs ${lib.fmtRs2(g.rate)}. Tick "Yes, I meant this rate" to save.`);
    const impact = await impactOfRate(Number(gradeId), r);
    const mv = impact.filter(i => i.reapprove);
    await tx(async () => {
      await q('INSERT INTO c2m_material_rate (grade_id, rate, rate_date, source, warned_confirmed, entered_by, entered_at) VALUES (?,?,?,?,?,?,?)', [g.gradeId, r, today(), String(source).slice(0, 200), w.warn ? 1 : 0, user, now()]);
      await audit(user, 'rate', g.gradeId, 'save', g.rate, r, source);
      if (mv.length) await q('INSERT INTO c2m_reapproval (cause, items_json, created_at) VALUES (?,?,?)', [`${g.name} rate Rs ${lib.fmtRs2(g.rate)} to Rs ${lib.fmtRs2(r)}, ${today()}`, JSON.stringify(mv.map(m => ({ packId: m.packId, label: m.label, from: m.approved, to: m.after, pct: m.pctApproved }))), now()]);
    });
    return mv.length;
  }
  /* ---------- Next week's costs: Monday is cost day (Tahir and Yawar, 5 Nov 2026, R11 as ruled that evening, D-149; push 2b) ----------
     A material, packing price, packing bill or freight change saved on a Monday (Pakistan time) goes in at once. Saved Tuesday to Sunday
     it waits in c2m_cost_pending and goes in at Monday 00:00, or at once when Tahir approves it as urgent; until then it can be changed
     (save again) or dropped. A first cost (a material or packing item with none yet, a freight region with none in force, a new bill or a
     bill no pack uses) goes in at once, since nothing costed moves. For 1 hour after a change goes in, its saver can correct it at once.
     Labour and FOH are not in this cycle (monthly, push 2c). Until migration 010 is run every change goes in when saved, as before. */
  const PEND = { has: null, at: 0 };
  async function pendReady() {
    if (PEND.has != null && Date.now() - PEND.at < 60000) return PEND.has;
    try { const [t] = await q("SHOW TABLES LIKE 'c2m_cost_pending'"); PEND.has = t.length > 0; PEND.at = Date.now(); } catch (_) { return false; } // a passing error is not remembered (review 2b, finding 10)
    return PEND.has;
  }
  const dow = d => new Date(String(d).slice(0, 10) + 'T00:00:00Z').getUTCDay();
  const isMonday = d => dow(d) === 1;
  const nextMonday = d => { const t = new Date(String(d).slice(0, 10) + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + (((8 - t.getUTCDay()) % 7) || 7)); return t.toISOString().slice(0, 10); };
  /* Price cycle (R33, push 3a, D-152): an approved client price, and an approved VAN list revision, take effect on a Monday,
     the cost day, so cost and price move together. Urgent: in force when Tahir approves it, with a reason he reads first. */
  const mondayFrom = d => isMonday(d) ? String(d).slice(0, 10) : nextMonday(d); // the first Monday on or after d
  async function urgentWhy(entity, id) { const [[r]] = await q("SELECT why FROM c2m_audit WHERE entity=? AND entity_id=? AND action='urgent' ORDER BY id DESC LIMIT 1", [entity, String(id)]); return r ? r.why : null; }
  /** The effective date a new price or list revision is saved with: today when urgent, else the Monday asked for (next Monday by default). */
  function cycleFrom(validFrom, urgent, why, what) {
    if (urgent) { if (!String(why || '').trim()) throw bad(`Write why ${what} is urgent: Tahir reads it before he approves.`); return today(); }
    const f = validFrom || mondayFrom(today());
    if (!isMonday(f)) throw bad(`${what[0].toUpperCase() + what.slice(1)} takes effect on a Monday, the cost day. Pick a Monday (the next is ${mondayFrom(today())}), or tick Urgent and write why.`);
    return f;
  }
  const AUD_KIND = { rate: 'rate', packing_rate: 'packing_rate', packing_bill: 'packing_bill', freight: 'freight', packing_assign: 'client_pack' }; // c2m_audit entity of each kind
  /** What a save changes, read before it is held: { target, label, nowV, newV, first, at (save at once for another reason) }. */
  const DESCRIBE = {
    async rate(b) {
      const D = await engine.loadAll(q); const g = D.rates.get(Number(b.gradeId)); if (!g) throw bad('This material is no longer in C2M. Press Refresh; if it is still missing, it was deleted.');
      return { target: String(g.gradeId), label: `Material · ${g.name}${g.grade ? ', ' + g.grade : ''}`, nowV: g.rate, newV: strictNum(b.rate), first: g.rate == null };
    },
    async packing_rate(b) {
      const D = await engine.loadAll(q); const it = D.packing.itemById.get(Number(b.itemId)); if (!it) throw bad('This packing item is no longer in C2M. Press Refresh; if it is still missing, it was deleted.');
      let nv = null; try { nv = piecePriceOf(b).price; } catch (_) { nv = null; } // the save itself refuses a wrong figure
      return { target: String(it.id), label: `Packing · ${it.name}`, nowV: it.price, newV: nv, first: it.price == null };
    },
    async packing_bill(b) {
      const D = await engine.loadAll(q); const mv = movedPacks(D, b); // packs taken from another bill: a move, so it waits (push 2d)
      if (!b.id) return { target: 'new:' + String(b.name || '').trim().slice(0, 160).toLowerCase().slice(0, 75), label: `Packing bill · ${String(b.name || '').trim()}${mv.length ? `, with ${mv.length} pack(s) moved to it` : ''}`, first: !mv.length };
      const bill = D.packing.billById.get(Number(b.id)); if (!bill) throw bad('This packing bill is no longer in C2M. Press Refresh; if it is still missing, it was deleted.');
      const used = D.packs.some(p => Number(p.packing_bill_id) === bill.id); const changed = linesKey(b.lines) !== linesKey(bill.lines);
      return { target: String(bill.id), label: `Packing bill · ${String(b.name || bill.name).trim()}${mv.length ? `, with ${mv.length} pack(s) moved to it` : ''}`, nowV: null, newV: null, first: !mv.length && (!used || !changed) };
    },
    async packing_assign(b) {
      const D = await engine.loadAll(q); const k = D.packs.find(x => Number(x.id) === Number(b.packId)); if (!k) throw bad('This pack is no longer in C2M. Press Refresh; if it is still missing, it was deleted.');
      const cp = D.cpById.get(k.client_product_id) || {}; const to = b.billId ? D.packing.billById.get(Number(b.billId)) : null;
      return { target: String(k.id), label: `Pack · ${cp.brand || ''} ${Number(k.pack_size)} ${cp.sold_per || ''} to ${to ? 'bill ' + to.name : 'no bill'}`, first: k.packing_bill_id == null || Number(k.packing_bill_id) === Number(b.billId || 0) }; // its first bill goes in at once (ruled 5 Nov)
    },
    async freight(b) {
      const D = await engine.loadAll(q); const T = today(); const reg = String(b.region || '').trim();
      const vf = b.validFrom && isDate(b.validFrom) ? b.validFrom : T;
      const inForce = D.freight.find(x => x.segment === b.segment && lib.sameRegion(x.region, reg) && String(x.valid_from).slice(0, 10) <= T);
      return { target: `${b.segment}|${reg}`.toLowerCase().replace(/\s+/g, ' '), label: `Freight · ${b.segment} ${reg}`, nowV: inForce ? Number(inForce.rs_per_kg) : null, newV: strictNum(b.rsPerKg), first: !inForce,
        at: vf >= nextMonday(T) }; // dated for next Monday or later: it already waits for its own date
    }
  };
  /** When this person's change to this item went in, if that was less than 1 hour ago (Undo, edit only: R29, ruled 5 Nov); else null.
   *  A correction keeps the time of the change it corrects, so its hour never starts again (review 2b, finding 3). */
  /** True once migration 011 has run (both tables, as the cost engine needs them). */
  async function lfOn() { try { const [a] = await q("SHOW TABLES LIKE 'c2m_lf_rate'"); const [b] = await q("SHOW TABLES LIKE 'c2m_lf_pick'"); return a.length > 0 && b.length > 0; } catch (_) { return false; } }
  const OLD_LF = 'Labour and FOH are now named rates, Low and High: change them on Costs, Labour or FOH. The old rates stay in the record only.';
  async function correctable(kind, target, user) {
    const since = lib.pkNow(new Date(Date.now() - 3600e3)); const key = `${kind}:${target}`;
    const [[cc]] = await q("SELECT new_value FROM c2m_audit WHERE entity='cost_correct' AND entity_id=? AND by_user=? AND at>=? ORDER BY id DESC LIMIT 1", [key.slice(0, 100), user, since]);
    if (cc) { let o = null; try { o = JSON.parse(cc.new_value).wentIn; } catch (_) {} return o && o >= since ? o : null; }
    const ent = AUD_KIND[kind]; const id = kind === 'freight' ? null : target;
    const [rows] = await q(`SELECT entity_id, at FROM c2m_audit WHERE entity=? AND by_user=? AND at>=? AND action='save' ${id ? 'AND entity_id=?' : ''} ORDER BY id DESC LIMIT 20`, id ? [ent, user, since, id] : [ent, user, since]);
    const hit = kind === 'freight' ? rows.find(r => String(r.entity_id).toLowerCase().replace(/\s+/g, ' ') === target) : rows[0];
    return hit ? String(hit.at).slice(0, 19) : null;
  }
  /** Run a save with a stand-in answer; returns what it answered (Monday saves, Next week's costs, the import queue). */
  async function callFn(fn, req) { const box = { answer: null }; const fake = { json: o => { box.answer = o; return fake; }, status: () => fake, setHeader: () => fake }; await fn(req, fake); return box.answer || {}; }
  /** True when a bill's lines as sent differ from the bill's lines now (item, level, pieces, packs per outer). */
  const linesKey = L => (L || []).map(l => [Number(l.itemId), l.level === 'secondary' ? 's' : 'p', Number(l.pieces), l.level === 'secondary' ? Number(l.packsPerOuter) : 0].join(':')).sort().join('|');
  /** Packs a bill save asks for (body.packIds) that are now on another bill: these moves wait for Monday (ruled 5 Nov, push 2d). */
  const movedPacks = (D, b) => (Array.isArray(b.packIds) ? b.packIds : []).map(Number).filter(id => { const k = D.packs.find(x => Number(x.id) === id); return k && k.packing_bill_id != null && Number(k.packing_bill_id) !== Number(b.id || 0); });
  const weekly = (kind, fn) => async (req, res) => {
    if (dryStore.getStore() || req.c2mApplying || !(await pendReady())) return fn(req, res);
    const b = req.body || {}; const d = await DESCRIBE[kind](b); const T = today();
    if (b.correct) {
      const wentIn = await correctable(kind, d.target, req.c2m.user);
      if (!wentIn) throw bad('The hour to correct this cost has passed. Save it as a change for next Monday, or as urgent with a reason.');
      if (kind === 'freight' && !(b.validFrom && b.validFrom > T)) req.body = { ...b, validFrom: T }; // corrects the rate in force, dated today (review 2b, finding 2)
      let a; await tx(async () => { a = await callFn(fn, req); await audit(req.c2m.user, 'cost_correct', `${kind}:${d.target}`.slice(0, 100), 'correct', null, { wentIn }, null); });
      return res.json(a);
    }
    if (d.first || d.at) return fn(req, res);
    if (isMonday(T)) { // Monday is cost day: in at once; anything still waiting for this item is replaced by it, in the same transaction
      let a; await tx(async () => { await q("UPDATE c2m_cost_pending SET status='replaced', waiting_key=NULL, decided_by=?, decided_at=? WHERE kind=? AND target=? AND status='waiting'", [req.c2m.user, now(), kind, d.target]); a = await callFn(fn, req); });
      return res.json(a);
    }
    const urgent = !!b.urgent; const reason = String(b.reason || '').trim();
    if (urgent && reason.length < 5) throw bad('Say why this cannot wait for Monday (a few words), or untick Urgent.');
    const dryReq = { ...req, body: kind === 'freight' ? { ...b, validFrom: T } : b, query: {} };
    const eff = await runDry(fn, dryReq); // the save's own checks, and its effect worked out as if it went in today
    const on = nextMonday(T); const keep = { ...b }; delete keep.urgent; delete keep.reason; delete keep.correct;
    let gaveNow = 0;
    if (kind === 'packing_bill' || kind === 'packing_assign') { // bills and packs (push 2d; review 2d, findings 3 to 5)
      const D = await engine.loadAll(q); const pkOf = id => D.packs.find(x => Number(x.id) === Number(id));
      const ids = kind === 'packing_assign' ? [Number(b.packId)] : movedPacks(D, b);
      const [w] = await q("SELECT id, kind, target, label, body_json FROM c2m_cost_pending WHERE status='waiting' AND kind IN ('packing_bill','packing_assign')");
      for (const row of w) { if (row.kind === kind && row.target === d.target) continue; let bb = {}; try { bb = JSON.parse(row.body_json || '{}'); } catch (_) {}
        const theirs = row.kind === 'packing_assign' ? [Number(bb.packId)] : Object.keys(bb.packFrom || {}).map(Number);
        if (ids.some(x => theirs.includes(x))) throw bad(`A pack here already waits to move: "${row.label}" in Next week's costs. Change or drop that first.`); }
      if (kind === 'packing_bill') { keep.packFrom = Object.fromEntries(ids.map(id => [id, Number(pkOf(id).packing_bill_id)]));
        if (b.id) { const nb = (b.packIds || []).map(Number).filter(id => { const k = pkOf(id); return k && k.packing_bill_id == null; }); // a pack with no bill gets it at once
          for (const id of nb) { await callFn(PEND_FN.packing_assign, { ...req, query: {}, body: { packId: id, billId: Number(b.id) } }); gaveNow++; }
          keep.packIds = (b.packIds || []).map(Number).filter(id => !nb.includes(id)); } } }
    const effect = { count: eff.count, items: eff.items.slice(0, 50), pct: eff.reapprovePct };
    let id;
    await tx(async () => {
      const vals = [d.label.slice(0, 200), JSON.stringify(keep), d.nowV == null ? null : d.nowV, d.newV == null || isNaN(d.newV) ? null : d.newV, JSON.stringify(effect), on, urgent ? 1 : 0, urgent ? reason.slice(0, 300) : null, req.c2m.user, now()];
      const wkey = `${kind}|${d.target}`.slice(0, 110); // unique while waiting: 1 waiting change per item (review 2b, finding 6)
      const upd = async oid => { id = oid; await q('UPDATE c2m_cost_pending SET label=?, body_json=?, now_value=?, new_value=?, effect_json=?, apply_on=?, urgent=?, reason=?, saved_by=?, saved_at=? WHERE id=?', [...vals, id]); };
      const [[old]] = await q("SELECT id FROM c2m_cost_pending WHERE waiting_key=? FOR UPDATE", [wkey]);
      if (old) await upd(old.id);
      else { try { const [ins] = await q('INSERT INTO c2m_cost_pending (label, body_json, now_value, new_value, effect_json, apply_on, urgent, reason, saved_by, saved_at, kind, target, waiting_key) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', [...vals, kind, d.target, wkey]); id = ins.insertId; }
        catch (e) { if (!(e && (e.code === 'ER_DUP_ENTRY' || e.errno === 1062))) throw e; const [[o2]] = await q("SELECT id FROM c2m_cost_pending WHERE waiting_key=? FOR UPDATE", [wkey]); if (!o2) throw moved(); await upd(o2.id); } }
      await audit(req.c2m.user, 'cost_pending', id, old ? 'change' : 'hold', null, { kind, target: d.target, applyOn: on, urgent }, urgent ? reason : null);
      if (urgent) await notice('coo', `Urgent cost change waits for you on Approvals: ${d.label}. Reason: ${reason}`, req.c2m.user);
    });
    res.json({ ok: true, pending: true, id, applyOn: on, urgent, changed: true, reapproval: 0, effectCount: eff.count, gaveNow });
  };
  const PEND_FN = {}; // kind -> the save, filled where each route is defined
  /** Put 1 waiting change in now, as its saver; the row is marked in the same transaction. */
  async function applyPending(row, by) {
    const fn = PEND_FN[row.kind]; if (!fn) throw bad('Unknown kind of cost change.');
    const body = JSON.parse(row.body_json || '{}'); const T = today();
    if (row.kind === 'freight' && !(body.validFrom && body.validFrom > T)) body.validFrom = T;
    const box = { answer: null }; const fake = { json: o => { box.answer = o; return fake; }, status: () => fake, setHeader: () => fake };
    let label = row.saved_by; try { const [[ur]] = await q("SELECT role FROM user_module_roles WHERE username=? AND module='c2m'", [row.saved_by]); const R = ur ? (await loadRoles()).get(ur.role) : null; if (R) label = R.label; } catch (_) {} // review 2b, finding 11
    const req = { body, query: {}, c2mApplying: true, c2m: { user: row.saved_by, label, name: row.saved_by } };
    await tx(async () => {
      const [[cur]] = await q('SELECT status FROM c2m_cost_pending WHERE id=? FOR UPDATE', [row.id]); if (!cur || cur.status !== 'waiting') throw moved();
      await fn(req, fake);
      const re = box.answer && box.answer.reapproval ? Number(box.answer.reapproval) : 0;
      await q("UPDATE c2m_cost_pending SET status='applied', waiting_key=NULL, decided_by=?, decided_at=?, result_text=? WHERE id=?", [by, now(), `Went in. ${re ? re + ' pack(s) wait for re-approval.' : 'No pack moved more than the re-approval %.'}`, row.id]);
    });
    return box.answer || {};
  }
  let applyBusy = false;
  /** Every 15 minutes and at start: changes waiting for a Monday that has come go in (missed Mondays too, when the server was down). */
  async function applyDue() {
    if (applyBusy || !(await pendReady())) return 0; applyBusy = true; let n = 0, bad1 = 0;
    try {
      const [rows] = await q("SELECT * FROM c2m_cost_pending WHERE status='waiting' AND apply_on<=? ORDER BY id", [today()]);
      for (const r of rows) {
        try { await applyPending(r, 'monday'); n++; }
        catch (e) { if (e && e.status === 409) continue; bad1++; // approved or dropped a moment before: not a failure (review 2b, finding 9)
 await q("UPDATE c2m_cost_pending SET status='failed', waiting_key=NULL, decided_by='monday', decided_at=?, result_text=? WHERE id=? AND status='waiting'", [now(), String(e.message || e).slice(0, 400), r.id]).catch(() => {}); }
      }
      if (n || bad1) { const t = `Monday costs: ${n} change(s) went in${bad1 ? `, ${bad1} could not (see Costs, Next week's costs)` : ''}.`; await notice('coo', t, 'C2M'); if (bad1) await notice('cfo', t, 'C2M'); }
    } finally { applyBusy = false; }
    return n;
  }
  const save_rate = async (req, res) => {
    const { gradeId, rate, source, confirmed } = req.body || {};
    res.json({ ok: true, reapproval: await saveRate(req.c2m.user, gradeId, rate, source, confirmed) });
  };
  PEND_FN.rate = save_rate;
  app.post('/api/c2m/rates', can('rate.save'), wrap(dryable(weekly('rate', save_rate))));
  /** Price per piece from what Yawar typed: per piece, or per kg with pieces per kg (an inner bought by weight, 26 Oct 2026). */
  function piecePriceOf(b) {
    if (b.buy === 'kg') {
      const kg = strictNum(b.perKg), n = strictNum(b.piecesPerKg);
      if (!(kg > 0) || kg > 10000000) throw bad('Type the price per kg, in digits (at most Rs 10,000,000).'); if (!(n > 0) || n > 100000) throw bad('Type how many pieces make 1 kg, in digits (e.g. 29).');
      return { price: lib.piecePrice(kg, n), note: lib.buyNote(kg, n) };
    }
    if (Number(b.price) > 99999999) throw bad('That price per piece is too large.');
    return { price: Number(b.price), note: '' };
  }
  const srcWith = (source, note) => { const t = String(source).trim(); if (t.length + note.length > 200) throw bad(`The source can be at most ${200 - note.length} characters here.`); return t + note; };
  const save_packing_rate = async (req, res) => {
    const { itemId, source, confirmed } = req.body || {}; const pp = piecePriceOf(req.body || {}); const price = pp.price;
    const D = await engine.loadAll(q); const it = D.packing.itemById.get(Number(itemId)); if (!it) throw bad('This packing item is no longer in C2M. Press Refresh; if it is still missing, it was deleted.');
    const r = Number(price); if (!(r > 0)) throw bad('Type a price above 0.'); if (!String(source || '').trim()) throw bad('Add the source: PO number or quote.');
    const w = lib.rateWarning(it.price, r, D.settings.values.rate_warn_pct);
    if (w.warn && !confirmed) throw bad(`Did you mean Rs ${lib.fmtRs2(r)}? It is ${w.pct.toFixed(0)}% from the last saved price of Rs ${lib.fmtRs2(it.price)}. Tick "Yes, I meant this price" to save.`);
    const moved = [];
    for (const p of D.packs.filter(p => p.packing_bill_id)) {
      const bill = D.packing.billById.get(p.packing_bill_id); if (!bill || !bill.lines.some(l => l.itemId === it.id)) continue;
      const c0 = engine.packCost(D, p), c1 = engine.packCost(D, p, { packOverride: { itemId: it.id, price: r } }); if (!c1 || !c1.costed) continue;
      const av = engine.latestApproved(D, p.id); const cp = D.cpById.get(p.client_product_id);
      if (!av) continue; const base = Number(av.total); // from = the approved cost (defect 4); no approved cost yet: not batched
      if (lib.needsReapproval(base, c1.total, D.settings.values.reapprove_pct)) moved.push({ packId: p.id, label: `${cp.brand} ${Number(p.pack_size)} ${cp.sold_per} for ${D.custById.get(cp.customer_id).name}`, from: base, to: c1.total, pct: (c1.total - base) / base * 100 });
    }
    await tx(async () => {
      await q('INSERT INTO c2m_packing_rate (packing_item_id, price_per_piece, rate_date, source, entered_by, entered_at) VALUES (?,?,?,?,?,?)', [it.id, r, today(), srcWith(source, pp.note), req.c2m.user, now()]);
      await audit(req.c2m.user, 'packing_rate', it.id, 'save', it.price, r, source);
      if (moved.length) await q('INSERT INTO c2m_reapproval (cause, items_json, created_at) VALUES (?,?,?)', [`${it.name} price Rs ${lib.fmtRs2(it.price)} to Rs ${lib.fmtRs2(r)}, ${today()}`, JSON.stringify(moved), now()]);
    });
    res.json({ ok: true, reapproval: moved.length });
  };
  PEND_FN.packing_rate = save_packing_rate;
  app.post('/api/c2m/packing/rate', can('packing.manage'), wrap(dryable(weekly('packing_rate', save_packing_rate))));
  /* Approve the batch (or only the packs ticked: body.packIds). Packs not ticked go into a new open item
     "Left open from item N" so none drops out of every queue (cost review 18 Oct 2026, D-61). */
  app.post('/api/c2m/reapprovals/:id/approve', can('reapproval.decide'), wrap(async (req, res) => {
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
        if (!c || !c.costed) { const why = c ? c.gaps.join(', ') : 'its product is out of use'; await audit(req.c2m.user, 'reapproval', r.id, 'left: not costed', null, null, `${it.label}: ${why}`); left.push(`${it.label} (not costed today: ${why})`); continue; }
        // Re-check on approval (defect 4): a cost now within reapprove_pct of the approved cost stays as approved
        const av = engine.latestApproved(D, p.id);
        if (av && !lib.needsReapproval(Number(av.total), c.total, D.settings.values.reapprove_pct)) { await audit(req.c2m.user, 'reapproval', r.id, 'left: within threshold', Number(av.total), c.total, it.label); left.push(`${it.label} (today's Rs ${lib.fmtRs2(c.total)} is within ${D.settings.values.reapprove_pct}% of the approved Rs ${lib.fmtRs2(av.total)})`); continue; }
        if (Math.abs(c.total - Number(it.to)) > 0.005) await audit(req.c2m.user, 'reapproval', r.id, 'cost moved since shown', it.to, c.total, `${it.label}: shown Rs ${lib.fmtRs2(it.to)}, approved at today's Rs ${lib.fmtRs2(c.total)}`);
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
  app.post('/api/c2m/reapprovals/:id/dismiss', can('reapproval.decide'), wrap(async (req, res) => {
    const why = String((req.body || {}).why || '').trim(); if (!why) throw bad('Write why, e.g. "rate typed wrong".');
    // 1 transaction (audit 3 Nov 2026, D-145): if the re-batch fails, the dismiss is undone, so no moved cost is left without an item
    const again = await tx(async () => {
      const [u] = await q("UPDATE c2m_reapproval SET status='dismissed', decided_by=?, decided_at=? WHERE id=? AND status='open'", [req.c2m.user, now(), req.params.id]); if (!u.affectedRows) throw moved();
      await audit(req.c2m.user, 'reapproval', req.params.id, 'dismiss', null, null, why);
      // Packs whose cost still differs from the approved cost for another reason (a rule or packing change) are batched again (review S6)
      return reapprovalFor(`Costs still moved after closing item ${req.params.id}, ${today()}`);
    });
    res.json({ ok: true, reapproval: again });
  }));

  /* ---------- Packing bills (Yawar keeps and approves them alone; ruled 15 Oct) ---------- */
  const save_packing_bill = async (req, res) => {
    const { id, name, lines } = req.body || {};
    if (!String(name || '').trim()) throw bad('Name the packing bill, e.g. "25 kg bag with inner".');
    if (!Array.isArray(lines) || !lines.length) throw bad('Add at least 1 packing item.');
    for (const l of lines) { if (!l.itemId || !(Number(l.pieces) > 0)) throw bad('Every line needs an item and pieces above 0.'); if (l.level === 'secondary' && !(Number(l.packsPerOuter) > 0)) throw bad('A secondary item needs how many packs it holds.'); }
    const nm = String(name).trim().slice(0, 160);
    const iids = lines.map(l => Number(l.itemId)); const [items] = await q(`SELECT id FROM c2m_packing_item WHERE id IN (${qs(iids)})`, iids);
    if (new Set(items.map(i => i.id)).size !== new Set(lines.map(l => Number(l.itemId))).size) throw bad('A packing item on this bill is not in the packing list.');
    const [[dup]] = await q('SELECT id FROM c2m_packing_bill WHERE name=? AND id<>?', [nm, Number(id) || 0]); if (dup) throw bad('Another packing bill has this name.');
    { const [had] = id ? await q('SELECT packing_item_id FROM c2m_packing_bill_line WHERE packing_bill_id=?', [id]) : [[]]; const was = new Set(had.map(x => Number(x.packing_item_id))); const [oo] = await softQ("SELECT entity_id FROM c2m_out_of_use WHERE entity='packing_item'"); const off = new Set(oo.map(x => Number(x.entity_id)));
      if (iids.some(i => off.has(i) && !was.has(i))) throw bad('A packing item on this bill is out of use. Put it back in use in Costs, Packing cost, or pick another.'); }
    if (id) { const [[ex]] = await q('SELECT id FROM c2m_packing_bill WHERE id=?', [id]); if (!ex) throw bad('This packing bill is no longer in C2M. Press Refresh; if it is still missing, it was deleted.'); }
    /* The packs ticked on the bill (screen 6b, push 2d): a pack with no bill gets it at once; one on another bill moves to it
       (that waits for Monday, as a bill change). A pack already on this bill stays on it; it is moved by ticking it on another bill. */
    const want = Array.isArray((req.body || {}).packIds) ? [...new Set(req.body.packIds.map(Number).filter(n => n > 0))] : null; let firstSet = new Set(), addIds = [];
    let fromBill = new Map();
    if (want) { let [pk] = want.length ? await q(`SELECT k.id, k.packing_bill_id, c.packing_mode, c.channel, cu.grp FROM c2m_client_pack k JOIN c2m_client_product c ON c.id=k.client_product_id JOIN c2m_customer cu ON cu.id=c.customer_id WHERE k.id IN (${qs(want)})`, want) : [[]];
      const ok = k => k.packing_mode !== 'bulk' && k.packing_mode !== 'client' && (k.channel === 'VAN brand' || k.grp === 'White label');
      const was = (req.body || {}).packFrom || null; // held saves: where each moving pack was when saved (review 2d, finding 4)
      if (req.c2mApplying) pk = pk.filter(k => ok(k) && (!was || !(String(k.id) in was) || Number(was[k.id] || 0) === Number(k.packing_bill_id || 0))); // Monday: a pack gone, changed or moved since is left out, the rest goes in
      else { if (pk.length !== want.length) throw bad('A pack ticked on this bill is no longer in C2M. Press Refresh, tick the packs again and save; nothing was saved.'); if (pk.some(k => !ok(k))) throw bad('A bulk or client-packed product, or one that is not white label or VAN brand, takes no packing bill here.'); }
      // A pack already on this bill and not in the list stays on it: the list only adds (a pack is moved by ticking it on another bill).
      addIds = pk.filter(k => k.packing_bill_id == null || Number(k.packing_bill_id) !== Number(id || 0)).map(k => Number(k.id)); // review 2d, finding 1: a new bill takes packs with no bill
      firstSet = new Set(pk.filter(k => k.packing_bill_id == null).map(k => Number(k.id))); fromBill = new Map(pk.map(k => [Number(k.id), k.packing_bill_id == null ? null : Number(k.packing_bill_id)]));
      if (addIds.length && id) { const [[o]] = await softQ("SELECT entity_id FROM c2m_out_of_use WHERE entity='packing_bill' AND entity_id=?", [id]); if (o) throw bad('This packing bill is out of use. Put it back in use before giving it packs.'); } }
    if (!id && !req.c2mApplying && await pendReady()) { const [[w]] = await q("SELECT id FROM c2m_cost_pending WHERE kind='packing_bill' AND target=? AND status='waiting'", ['new:' + nm.toLowerCase().slice(0, 75)]); if (w) throw bad('A new bill with this name already waits for Monday (Next week\'s costs): change or drop it there.'); } // review 2d, finding 6
    let billId = Number(id) || null, re = 0;
    await tx(async () => {
      const oldBill = billId ? { name: (await q('SELECT name FROM c2m_packing_bill WHERE id=?', [billId]))[0][0].name, lines: (await q('SELECT packing_item_id itemId, level, pieces, packs_per_outer packsPerOuter FROM c2m_packing_bill_line WHERE packing_bill_id=?', [billId]))[0] } : null;
      if (billId) { await q("UPDATE c2m_packing_bill SET name=?, status='approved', approved_by=?, approved_at=? WHERE id=?", [nm, req.c2m.user, now(), billId]); await q('DELETE FROM c2m_packing_bill_line WHERE packing_bill_id=?', [billId]); }
      else { const [b] = await q("INSERT INTO c2m_packing_bill (name, status, approved_by, approved_at) VALUES (?, 'approved', ?, ?)", [nm, req.c2m.user, now()]); billId = b.insertId; }
      { const [i2] = await q(`SELECT id FROM c2m_packing_item WHERE id IN (${qs(iids)}) LOCK IN SHARE MODE`, iids); if (new Set(i2.map(x => x.id)).size !== new Set(iids).size) throw moved(); } // an item deleted a moment ago (review 30 Oct)
      for (const l of lines) await q('INSERT INTO c2m_packing_bill_line (packing_bill_id, packing_item_id, level, pieces, packs_per_outer) VALUES (?,?,?,?,?)', [billId, Number(l.itemId), l.level === 'secondary' ? 'secondary' : 'primary', Number(l.pieces), l.level === 'secondary' ? Number(l.packsPerOuter) : null]);
      await audit(req.c2m.user, 'packing_bill', billId, id ? 'update' : 'create', id ? oldBill : null, { name: nm, lines, packs: addIds.length ? addIds : undefined }, null);
      if (addIds.length) { await q(`UPDATE c2m_client_pack SET packing_bill_id=? WHERE id IN (${qs(addIds)})`, [billId, ...addIds]); for (const k of addIds) await audit(req.c2m.user, 'client_pack', k, 'packing_bill', fromBill.get(k) ?? null, billId, `Ticked on bill "${nm}"`); }
      /* 1 re-approval item for the bill and its packs; a pack's first bill sends no re-approval (ruled 5 Nov) unless the pack has no
         approved cost yet, when its first approved cost waits for the CFO as before (D-41). */
      if (id || addIds.length) re = await reapprovalFor(`Packing bill "${nm}" ${id ? 'changed' : 'made'}${addIds.length ? `, ${addIds.length} pack(s) put on it` : ''}, ${today()}`, (p, D2) => Number(p.packing_bill_id) === billId && !(firstSet.has(Number(p.id)) && engine.latestApproved(D2, p.id)));
      if (id || addIds.length) await costNotice(req.c2m.user, `Packing bill "${nm}" ${id ? 'changed' : 'made'} by the ${req.c2m.label}${addIds.length ? `, ${addIds.length} pack(s) put on it` : ''}`, re);
    });
    res.json({ id: billId, reapproval: re });
  };
  PEND_FN.packing_bill = save_packing_bill;
  app.post('/api/c2m/packing/bill', can('packing.manage'), wrap(dryable(weekly('packing_bill', save_packing_bill))));
  const save_packing_assign = async (req, res) => {
    const { packId, billId } = req.body || {};
    const [[p]] = await q('SELECT id, packing_bill_id FROM c2m_client_pack WHERE id=?', [packId]); if (!p) throw bad('This pack is no longer in C2M. Press Refresh; if it is still missing, it was deleted.');
    { const [[m]] = await q('SELECT c.packing_mode FROM c2m_client_pack k JOIN c2m_client_product c ON c.id=k.client_product_id WHERE k.id=?', [packId]); if (m && billId && (m.packing_mode === 'bulk' || m.packing_mode === 'client')) throw bad('A bulk or client-packed product takes no packing bill.'); } // review 2d, finding 13
    if (billId) { const [[b]] = await q('SELECT name FROM c2m_packing_bill WHERE id=?', [billId]); if (!b) throw bad('This packing bill is no longer in C2M. Press Refresh; if it is still missing, it was deleted.'); const [[o]] = await softQ("SELECT entity_id FROM c2m_out_of_use WHERE entity='packing_bill' AND entity_id=?", [billId]); if (o && Number(billId) !== Number(p.packing_bill_id)) throw bad('This packing bill is out of use. Put it back in use in Costs, Packing cost, or pick another.'); }
    let re = 0;
    await tx(async () => {
      if (billId) { const [[b2]] = await q('SELECT id FROM c2m_packing_bill WHERE id=? LOCK IN SHARE MODE', [billId]); if (!b2) throw moved(); }
      await q('UPDATE c2m_client_pack SET packing_bill_id=? WHERE id=?', [billId || null, p.id]);
      await audit(req.c2m.user, 'client_pack', p.id, 'packing_bill', p.packing_bill_id, billId || null, null);
      const firstBill = p.packing_bill_id == null; // its first bill: no re-approval unless it has no approved cost yet (ruled 5 Nov)
      re = await reapprovalFor(`Packing bill ${firstBill ? 'given to' : 'changed on'} a pack, ${today()}`, (x, D2) => x.id === p.id && !(firstBill && engine.latestApproved(D2, x.id)));
      await costNotice(req.c2m.user, `Packing bill of pack ${p.id} ${firstBill ? 'given' : 'changed'} by the ${req.c2m.label}`, re);
    });
    res.json({ ok: true, reapproval: re });
  };
  PEND_FN.packing_assign = save_packing_assign;
  app.post('/api/c2m/packing/assign', can('packing.manage'), wrap(dryable(weekly('packing_assign', save_packing_assign))));
  app.post('/api/c2m/packing/item', can('packing.manage'), wrap(async (req, res) => {
    const { name, kind, source } = req.body || {}; const pp = piecePriceOf(req.body || {}); const price = pp.price;
    if (!String(name || '').trim() || !(Number(price) > 0) || !String(source || '').trim()) throw bad(req.body && req.body.buy === 'kg' ? 'Give the item name, price per kg, pieces per kg and source.' : 'Give the item name, price per piece and source.');
    const [[dup]] = await q('SELECT id FROM c2m_packing_item WHERE name=?', [String(name).trim()]); if (dup) throw bad('A packing item with this name exists. Change its price on Costs, Packing cost.');
    const id = await tx(async () => {
      const [r] = await q('INSERT INTO c2m_packing_item (name, kind) VALUES (?,?)', [String(name).trim().slice(0, 120), String(kind || 'other').slice(0, 30)]);
      await q('INSERT INTO c2m_packing_rate (packing_item_id, price_per_piece, rate_date, source, entered_by, entered_at) VALUES (?,?,?,?,?,?)', [r.insertId, Number(price), today(), srcWith(source, pp.note), req.c2m.user, now()]);
      await audit(req.c2m.user, 'packing_item', r.insertId, 'create', null, { name, price }, source);
      return r.insertId;
    });
    res.json({ id });
  }));

  /* ---------- Conversion rules ---------- */
  app.post('/api/c2m/rules/conversion', can('labour.manage'), wrap(dryable(async (req, res) => {
    { if (await lfOn()) throw Object.assign(new Error('Labour and FOH are now named rates, Low and High: change them on Costs, Labour or FOH. The old rates stay in the record only.'), { status: 409 }); }
    const b = req.body || {};
    /* Ruled 16 Oct: a named labour or FOH rate, assigned to all products (optionally a form, reprocessed, a pack range),
     * to a product type, or to a list of products. 1 labour + 1 FOH rate is picked per product and added. */
    if (!String(b.name || '').trim() || !(strictNum(b.rsPerKg) > 0)) throw bad('Give the rate a name and Rs per kg above 0 (digits only). A Rs 0 labour or FOH rate counts as missing.');
    if (!['labour', 'foh'].includes(b.kind)) throw bad('Pick Labour or FOH.');
    if (b.validFrom && !isDate(b.validFrom)) throw bad('From must be a date.');
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
    let pvId = null;
    if (scope === 'variant') { const D0 = await needVariants(); pvId = Number(b.pvariantId); if (!D0.pvariants.some(v => Number(v.id) === pvId)) throw bad('Pick the variant this rate applies to.'); }
    if (scope === 'type') { const [[t]] = await q('SELECT id FROM c2m_base_product WHERE id=?', [b.baseProductId]); if (!t) throw bad('Pick the product type.'); }
    if (!['general', 'type', 'list', 'variant'].includes(scope)) throw bad("Assign the rate to all products, a product type, a variant, or a client's pack.");
    /* A second rate for exactly the same products would leave 2 live rates, and one dated earlier would never be used
       (audit 4 Nov 2026, fault A6). The way to change a rate is Edit in its row, which retires the old one. */
    { const D1 = await engine.loadAll(q); const nn = v => (v == null || v === '' ? null : Number(v)); const same = (a, b) => [...new Set(a.map(Number))].sort().join(',') === [...new Set(b.map(Number))].sort().join(',');
      const nw = { kind: b.kind, type: scope === 'type' ? Number(b.baseProductId) : null, pv: scope === 'variant' ? pvId : null, form: b.form || null, rep: b.reprocessed == null || b.reprocessed === '' ? null : Number(b.reprocessed), min: b.packMin ? strictNum(b.packMin) : null, max: b.packMax ? strictNum(b.packMax) : null };
      const clash = D1.rules.find(r => Number(r.active) && !Number(r.isBase) && (r.kind || 'foh') === nw.kind && nn(r.scopeBaseProductId) === nw.type && nn(r.scopePvariantId) === nw.pv && (r.scopeForm || null) === nw.form && nn(r.scopeReprocessed) === nw.rep && nn(r.scopePackMin) === nw.min && nn(r.scopePackMax) === nw.max && same(r.products || [], ids));
      if (clash) throw bad(`"${clash.name}" is already the ${b.kind === 'labour' ? 'labour' : 'FOH'} rate for the same products, from ${String(clash.validFrom).slice(0, 10)}. To change it, press Edit in its row: the new figure replaces it, and no second rate is left that would never be used.`); }
    let id, re = 0;
    await tx(async () => {
      const [r] = await q('INSERT INTO c2m_conversion_rule (name, kind, rs_per_kg, scope_client_product_id, scope_base_product_id, scope_form, scope_reprocessed, scope_pack_min, scope_pack_max, valid_from, source) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        [String(b.name).slice(0, 160), b.kind, strictNum(b.rsPerKg), null, scope === 'type' ? Number(b.baseProductId) : null, b.form || null, b.reprocessed == null || b.reprocessed === '' ? null : Number(b.reprocessed), b.packMin ? strictNum(b.packMin) : null, b.packMax ? strictNum(b.packMax) : null, b.validFrom || today(), String(b.source || 'Entered by the CFO').slice(0, 200)]);
      id = r.insertId;
      if (scope === 'variant') await q('INSERT INTO c2m_rule_variant (rule_id, pvariant_id) VALUES (?,?)', [id, pvId]);
      for (const cpId of new Set(ids)) await q('INSERT INTO c2m_conversion_rule_product (rule_id, client_product_id) VALUES (?,?)', [id, cpId]);
      await audit(req.c2m.user, 'conversion_rule', id, 'create', null, b, null);
      re = await reapprovalFor(`Conversion rule "${String(b.name).slice(0, 80)}" added, ${today()}`);
      await costNotice(req.c2m.user, `${b.kind === 'labour' ? 'Labour' : 'FOH'} rate "${String(b.name).slice(0, 80)}" added at Rs ${lib.fmtRs2(strictNum(b.rsPerKg))} per kg or L by the CFO`, re);
    });
    res.json({ id, reapproval: re });
  })));
  /* Product type of a client product (used to assign rates) */
  app.post('/api/c2m/products/:id/type', can('product.classify'), wrap(async (req, res) => {
    const [[cp]] = await q('SELECT id, base_product_id FROM c2m_client_product WHERE id=?', [req.params.id]); if (!cp) throw bad('This client product is no longer in C2M. Press Refresh; if it is still missing, it was deleted.');
    let typeId = (req.body || {}).typeId ? Number(req.body.typeId) : null; const newName = String((req.body || {}).newType || '').trim();
    let re = 0;
    await tx(async () => {
      if (newName) { const [[ex]] = await q('SELECT id FROM c2m_base_product WHERE name=?', [newName]); typeId = ex ? ex.id : (await q('INSERT INTO c2m_base_product (name) VALUES (?)', [newName.slice(0, 120)]))[0].insertId; }
      else if (typeId) { const [[t]] = await q('SELECT id FROM c2m_base_product WHERE id=?', [typeId]); if (!t) throw bad('This product type is no longer in C2M. Press Refresh; if it is still missing, it was deleted.'); }
      await q('UPDATE c2m_client_product SET base_product_id=? WHERE id=?', [typeId, cp.id]);
      await audit(req.c2m.user, 'client_product', cp.id, 'type', cp.base_product_id, typeId, null);
      re = await reapprovalFor(`Product type changed, ${today()}`, p => p.client_product_id === cp.id);
      await costNotice(req.c2m.user, `Product type of client product ${cp.id} changed by the CFO`, re);
    });
    res.json({ ok: true, reapproval: re });
  }));
  /* Reprocessed flag of a client product (picks the solid reprocessed band); review 16 Oct: it had no screen */
  app.post('/api/c2m/products/:id/reprocessed', can('product.classify'), wrap(async (req, res) => {
    const [[cp]] = await q('SELECT id, reprocessed FROM c2m_client_product WHERE id=?', [req.params.id]); if (!cp) throw bad('This client product is no longer in C2M. Press Refresh; if it is still missing, it was deleted.');
    const v = (req.body || {}).on ? 1 : 0; let re = 0;
    await tx(async () => {
      await q('UPDATE c2m_client_product SET reprocessed=? WHERE id=?', [v, cp.id]);
      await audit(req.c2m.user, 'client_product', cp.id, 'reprocessed', cp.reprocessed, v, null);
      re = await reapprovalFor(`Reprocessed flag changed, ${today()}`, p => p.client_product_id === cp.id);
      await costNotice(req.c2m.user, `Reprocessed flag of client product ${cp.id} turned ${v ? 'on' : 'off'} by the CFO`, re);
    });
    res.json({ ok: true, reapproval: re });
  }));
  /* ---------- Piece 3 (Tahir, 21 Oct 2026; D-94, D-95, D-98): add client, add product, variants, follows ----------
   * Five link tables (migration 003) hold the family, the variant, the product followed and the client a pack is for.
   * Until the migration is run these routes answer with a plain notice and everything else works as before. */
  const needVariants = async () => { const D = await engine.loadAll(q); if (!D.variantsReady) throw bad('Variants and clients are not switched on yet: IT has 1 step to run. Nothing was saved; try again after IT has run it.'); return D; };
  const GROUPS = ['VAN brand', 'White label', 'Both'];
  /** A pack size (1 L, 25 kg, 500 ml) is never a variant name (Yawar, 29 Oct 2026; D-138). */
  const notSize = v => { if (/(^|[^a-z0-9])\d+([.,]\d+)?\s*(kg|kgs|g|gm|gms|grams?|l|ltrs?|litres?|liters?|ml)(?![a-z0-9])/i.test(String(v || ''))) throw bad(`${String(v).trim()} is a pack size, not a variant. A variant is the form of the product (Powder, Pellets, Granular): add the size under Packs.`); return v; };
  const cleanName = (s, max, what) => { if (s != null && typeof s !== 'string') throw bad(`Write the ${what} as text.`); const v = nmClean(s); if (!v) throw bad(`Write the ${what}.`); if (v.length > max) throw bad(`The ${what} can be at most ${max} characters.`); if (/[|]/.test(v)) throw bad(`The ${what} cannot hold the sign |.`); return v; };
  const spellings = (v, first) => { if (v != null && typeof v !== 'string' && !(Array.isArray(v) && v.every(x => typeof x === 'string'))) throw bad('O2S spellings must be text.'); if (Array.isArray(v) && v.some(x => /[|]/.test(x))) throw bad('A name cannot hold the sign |.'); const raw = Array.isArray(v) ? v : String(v == null ? '' : v).split('|'); const seen = new Set(); return [first].concat(raw).map(nmClean).filter(s => s && !seen.has(nmK(s)) && seen.add(nmK(s))); };
  /** The group of a client follows its products (D-94): white label products make it include White label; it never loses a kind it was made with. */
  async function recomputeGroup(customerId, user) {
    const [[c]] = await q('SELECT id, grp FROM c2m_customer WHERE id=?', [customerId]); if (!c) return;
    const [ps] = await q('SELECT channel FROM c2m_client_product WHERE customer_id=? AND active=1', [customerId]);
    const wl = ps.some(p => p.channel === 'White label'), van = ps.some(p => p.channel === 'VAN brand');
    let g = c.grp;
    if (wl && g === 'VAN brand') g = 'Both';
    else if (wl && van && g === 'White label') g = 'Both';
    if (g !== c.grp) { await q('UPDATE c2m_customer SET grp=? WHERE id=?', [g, c.id]); await audit(user, 'customer', c.id, 'group', c.grp, g, 'The group follows the products'); }
  }
  /** Find or create a family and a variant by id or name. Creating one needs variant.add. */
  async function pickFamilyVariant(req, b) {
    const fid = b.familyId ? Number(b.familyId) : null, fname = nmClean(b.family), vid = b.pvariantId ? Number(b.pvariantId) : null, vname = nmClean(b.variant);
    if (!fid && !fname && !vid && !vname) return { familyId: null, pvariantId: null };
    let fam = null, pv = null;
    if (vid) { [[pv]] = await q('SELECT * FROM c2m_product_variant WHERE id=?', [vid]); if (!pv) throw bad('That variant is not in C2M.'); [[fam]] = await q('SELECT * FROM c2m_product_family WHERE id=?', [pv.family_id]); return { familyId: fam.id, pvariantId: pv.id }; }
    if (fid) { [[fam]] = await q('SELECT * FROM c2m_product_family WHERE id=?', [fid]); if (!fam) throw bad('That product family is not in C2M.'); }
    else if (fname) {
      [[fam]] = await q('SELECT * FROM c2m_product_family WHERE name=?', [fname]);
      if (!fam) { if (!mayDo(req, 'variant.add')) throw Object.assign(new Error('Your role cannot add a new product family or variant.'), { status: 403 }); cleanName(fname, 120, 'family name'); const [r] = await q('INSERT INTO c2m_product_family (name, created_by, created_at) VALUES (?,?,?)', [fname, req.c2m.user, now()]); fam = { id: r.insertId, name: fname }; await audit(req.c2m.user, 'product_family', fam.id, 'add', null, fname, null); }
    }
    if (!fam) throw bad('Pick the product the variant belongs to.');
    if (!vname) return { familyId: fam.id, pvariantId: null };
    [[pv]] = await q('SELECT * FROM c2m_product_variant WHERE family_id=? AND name=?', [fam.id, vname]);
    if (!pv) { if (!mayDo(req, 'variant.add')) throw Object.assign(new Error('Your role cannot add a new variant.'), { status: 403 }); cleanName(vname, 80, 'variant name'); notSize(vname); const [r] = await q('INSERT INTO c2m_product_variant (family_id, name, created_by, created_at) VALUES (?,?,?,?)', [fam.id, vname, req.c2m.user, now()]); pv = { id: r.insertId }; await audit(req.c2m.user, 'product_variant', pv.id, 'add', null, { family: fam.name, variant: vname }, null); }
    return { familyId: fam.id, pvariantId: pv.id };
  }
  const setExt = async (cpId, e) => q('INSERT INTO c2m_product_ext (client_product_id, family_id, pvariant_id, follows_product_id) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE family_id=VALUES(family_id), pvariant_id=VALUES(pvariant_id), follows_product_id=VALUES(follows_product_id)', [cpId, e.familyId || null, e.pvariantId || null, e.followsId || null]);
  /** Check and read the packs of a form: [{size, billId, clientOnly}]. */
  async function readPacks(list, mode) {
    const packs = Array.isArray(list) ? list : []; const seen = new Set(); const out = [];
    for (const k of packs) {
      if (!k || typeof k !== 'object') throw bad('Every pack needs a size.');
      const size = strictNum(k.size); if (!(size >= 0.001)) throw bad('Every pack needs a size of 0.001 or more (digits only).'); if (size >= 99999.9995) throw bad('That pack size is too large.');
      if (Math.abs(size * 1000 - Math.round(size * 1000)) > 1e-6) throw bad('A pack size has at most 3 decimals.');
      if (seen.has(size)) throw bad(`The ${size} pack is listed twice.`); seen.add(size);
      let billId = k.billId ? Number(k.billId) : null;
      if (k.billId && !(Number.isInteger(billId) && billId > 0)) throw bad('A packing bill you picked is not in C2M.');
      if (billId) { const [[b]] = await q('SELECT id FROM c2m_packing_bill WHERE id=?', [billId]); if (!b) throw bad('A packing bill you picked is not in C2M.'); const [[o]] = await softQ("SELECT entity_id FROM c2m_out_of_use WHERE entity='packing_bill' AND entity_id=?", [billId]); if (o) throw bad('A packing bill you picked is out of use. Put it back in use in Costs, Packing cost, or pick another.'); }
      if (mode === 'bulk') billId = null; // a bulk product carries no VAN packing (D-98)
      out.push({ size, billId, clientOnly: !!k.clientOnly });
    }
    return out;
  }
  async function insertPacks(cpId, customerId, packs, user) {
    for (const k of packs) {
      if (k.billId) { const [[b]] = await q('SELECT id FROM c2m_packing_bill WHERE id=? LOCK IN SHARE MODE', [k.billId]); if (!b) throw moved(); } // a bill deleted a moment ago (review 30 Oct)
      const [r] = await q('INSERT INTO c2m_client_pack (client_product_id, pack_size, packing_bill_id) VALUES (?,?,?)', [cpId, k.size, k.billId]);
      if (k.clientOnly) await q('INSERT INTO c2m_pack_ext (client_pack_id, client_only_id) VALUES (?,?)', [r.insertId, customerId]);
      await audit(user, 'client_pack', r.insertId, 'add', null, { productId: cpId, size: k.size, billId: k.billId, clientOnly: !!k.clientOnly }, null);
    }
  }
  /** The followed product must be an active VAN brand product that follows nothing itself. */
  async function checkFollow(D, followsId, selfId) {
    const f = D.cpById.get(Number(followsId)); if (!f || !engine.isVanBrand(f)) throw bad('A product can follow only an active VAN brand product.');
    if (Number(followsId) === Number(selfId)) throw bad('A product cannot follow itself.');
    const e = D.ext.get(f.id); if (e && e.followsId) throw bad(`${f.brand} follows another product itself: follow the product that has the recipe.`);
    return f;
  }
  const modeOk = m => ['VAN', 'client', 'bulk'].includes(m);

  /** Add a client (D-94). Step 1: the name, what it buys, the O2S names. Products are added next, one by one. */
  app.post('/api/c2m/clients', can('client.add'), wrap(async (req, res) => {
    await needVariants();
    const b = req.body || {}; const name = cleanName(b.name, 120, 'client name');
    if (!GROUPS.includes(b.kind)) throw bad('Pick what the client buys: VAN brand, White label or Both.');
    const o2s = spellings(b.o2sNames, name).join('|'); if (o2s.length > 600) throw bad('The O2S names together can be at most 600 characters.');
    const SEG = ['Distributor', 'Dealer', 'COBO', 'VGreen', 'Farmer']; const seg = b.kind === 'White label' ? 'White label' : (b.segment ? String(b.segment) : 'Distributor');
    if (b.kind !== 'White label' && !SEG.includes(seg)) throw bad('Pick the segment of the client.');
    const id = await tx(async () => {
      const [all] = await q('SELECT id, name, o2s_names FROM c2m_customer FOR UPDATE'); const mine = o2s.split('|').map(nmK);
      for (const c of all) { const theirs = [c.name].concat(String(c.o2s_names).split('|')).map(nmK); if (nmK(c.name) === nmK(name)) throw bad(`A client called "${name}" is already in C2M.`); const hit = mine.find(m => theirs.includes(m)); if (hit) throw bad(`The name "${hit}" is already a name of the client ${c.name}: an O2S line could not tell them apart.`); }
      let r; try { [r] = await q('INSERT INTO c2m_customer (name, o2s_names, grp, segment, price_rule, price_cycle, region, active) VALUES (?,?,?,?,?,?,?,1)', [name, o2s, b.kind, seg, b.kind === 'White label' ? 'po' : null, null, null]); }
      catch (e) { if (dupName(e)) throw bad(`A client called "${name}" is already in C2M.`); throw e; }
      await audit(req.c2m.user, 'customer', r.insertId, 'add', null, { name, kind: b.kind, segment: seg, o2sNames: o2s }, 'Add client');
      return r.insertId;
    });
    res.json({ id });
  }));

  /** Add a product to a client, with its packs (D-94, D-95, D-98). A product that follows a VAN product has no recipe of its own. */
  app.post('/api/c2m/clients/:id/products', can('client.add'), wrap(async (req, res) => {
    const D0 = await needVariants(); const b = req.body || {};
    const [[cust]] = await q('SELECT * FROM c2m_customer WHERE id=?', [req.params.id]); if (!cust) throw bad('This client is no longer in C2M. Press Refresh; if it is still missing, it was deleted.');
    { const [[o]] = await softQ("SELECT entity_id FROM c2m_out_of_use WHERE entity='customer' AND entity_id=?", [cust.id]); if (o) throw bad(`${cust.name} is out of use. Put it back in use in Setup, Clients first.`); }
    { const [[ov]] = await q("SELECT COUNT(*) n FROM c2m_client_product WHERE customer_id=? AND channel='VAN brand'", [cust.id]); if (Number(ov.n)) throw bad(`${cust.name} owns the VAN brand products: a client's own brand is added to a client, not to the VAN brand owner.`); }
    const brand = cleanName(b.brand, 120, 'brand name'); const names = spellings(b.o2sNames, brand); const o2s = names.join('|'); if (o2s.length > 120) throw bad(`The brand name and spellings together can be at most 120 characters (now ${o2s.length}).`);
    const typeId = Number(b.typeId); const [[ty]] = await q('SELECT id FROM c2m_base_product WHERE id=?', [typeId]); if (!ty) throw bad('Pick the product type.');
    const form = b.form || 'solid', soldPer = b.soldPer || (form === 'liquid' ? 'L' : 'kg'); if (!['solid', 'liquid'].includes(form)) throw bad('Form is solid or liquid.'); if (!['kg', 'L'].includes(soldPer)) throw bad('Sold per is kg or L.'); if ((form === 'liquid') !== (soldPer === 'L')) throw bad('A liquid is sold per L and a solid per kg.');
    const mode = b.packingMode || 'VAN'; if (!modeOk(mode)) throw bad('Who supplies the packing: VAN, Client or Bulk.');
    const packs = await readPacks(b.packs, mode);
    const id = await tx(async () => {
      const D = await engine.loadAll(q); let fam = { familyId: null, pvariantId: null }, followsId = null;
      if (b.followsId) { const f = await checkFollow(D, b.followsId, 0); followsId = f.id; const fe = D.ext.get(f.id) || {}; fam = { familyId: fe.familyId || null, pvariantId: fe.pvariantId || null }; if (form !== f.form || soldPer !== f.sold_per) throw bad(`${f.brand} is ${f.form}, sold per ${f.sold_per}: a product that follows its recipe has the same form.`); }
      if (b.family || b.variant || b.familyId || b.pvariantId) fam = await pickFamilyVariant(req, b); // the variant it is sold as can differ from the one it follows (FMC: Pellets for now)
      const clash = [...D.cps.filter(c => Number(c.customer_id) === Number(cust.id) && c.channel === 'White label')].find(c => namesOf(c).some(n => names.some(m => nmK(m) === nmK(n))) && D.packs.some(k => Number(k.client_product_id) === Number(c.id) && packs.some(z => Math.abs(Number(k.pack_size) - z.size) < 1e-9)));
      if (clash) throw bad(`${cust.name} already has ${clash.brand} under a name and pack size you used: an O2S line could not tell them apart.`);
      let r; try { [r] = await q("INSERT INTO c2m_client_product (customer_id, channel, brand, o2s_brand, base_product_id, form, sold_per, packing_mode, reprocessed, active) VALUES (?,'White label',?,?,?,?,?,?,0,1)", [cust.id, brand, o2s, ty.id, form, soldPer, mode]); }
      catch (e) { if (dupName(e)) throw bad(`${cust.name} already has a product with these names.`); throw e; }
      await setExt(r.insertId, { ...fam, followsId });
      await insertPacks(r.insertId, cust.id, packs, req.c2m.user);
      await recomputeGroup(cust.id, req.c2m.user);
      await audit(req.c2m.user, 'client_product', r.insertId, 'add', null, { client: cust.name, brand, o2s, typeId: ty.id, form, soldPer, mode, follows: followsId, family: fam.familyId, variant: fam.pvariantId, packs }, 'Add a product');
      return r.insertId;
    });
    res.json({ id });
  }));

  /** Add a pack to a white label product (a pack of its own, maybe for this client only, with its own packing bill). */
  app.post('/api/c2m/products/:id/packs', can('client.add'), wrap(async (req, res) => {
    await needVariants();
    const [[cp]] = await q('SELECT * FROM c2m_client_product WHERE id=?', [req.params.id]); if (!cp) throw bad('This product is no longer in C2M. Press Refresh; if it is still missing, it was deleted.');
    if (cp.channel !== 'White label') throw bad('A pack of a VAN brand product is added through a price list revision (Clients, VAN Brands, Price lists).');
    const packs = await readPacks([req.body || {}], cp.packing_mode);
    await tx(async () => {
      const [[have]] = await q('SELECT id FROM c2m_client_pack WHERE client_product_id=? AND ABS(pack_size-?)<0.0005', [cp.id, packs[0].size]); if (have) throw bad(`${cp.brand} has the ${packs[0].size} pack already.`);
      await insertPacks(cp.id, cp.customer_id, packs, req.c2m.user);
    });
    // A pack added to a product whose recipe is approved waits on Approvals for its first approved cost at once (review 26 Oct 2026, C1).
    // A follower's cost is approved on its own job (Approve cost), so it is not batched here.
    const D0 = await engine.loadAll(q); const fol = (D0.ext.get(cp.id) || {}).followsId;
    const re = fol ? 0 : await reapprovalFor(`Pack ${packs[0].size} ${cp.sold_per} added to ${cp.brand}, ${today()}`, k => k.client_product_id === cp.id && Math.abs(Number(k.pack_size) - packs[0].size) < 0.0005);
    res.json({ ok: true, firstCost: re });
  }));

  /* ---------- Correct a white label product (audit, 23 Oct 2026): rename it, take it out of use, remove a pack added by mistake ---------- */
  app.post('/api/c2m/products/:id/edit', can('client.add'), wrap(async (req, res) => {
    const b = req.body || {};
    const out = await tx(async () => {
      const [[cp]] = await q('SELECT * FROM c2m_client_product WHERE id=? FOR UPDATE', [req.params.id]); if (!cp) throw bad('This product is no longer in C2M. Press Refresh; if it is still missing, it was deleted.');
      if (cp.channel !== 'White label') throw bad('A VAN brand product is renamed in Setup, Products and variants.');
      const brand = cleanName(b.brand, 120, 'brand name'); const names = spellings(b.o2sNames, brand); const o2s = names.join('|'); if (o2s.length > 120) throw bad(`The brand name and spellings together can be at most 120 characters (now ${o2s.length}).`);
      if (brand === cp.brand && o2s === String(cp.o2s_brand || '')) throw bad('Nothing to save: nothing was changed. Change a field first, then save.');
      const D = await engine.loadAll(q); const mine = D.packs.filter(k => Number(k.client_product_id) === Number(cp.id)).map(k => Number(k.pack_size));
      const clash = D.cps.find(c => Number(c.customer_id) === Number(cp.customer_id) && Number(c.id) !== Number(cp.id) && c.channel === 'White label' && namesOf(c).some(n => names.some(m => nmK(m) === nmK(n))) && D.packs.some(k => Number(k.client_product_id) === Number(c.id) && mine.some(z => Math.abs(Number(k.pack_size) - z) < 1e-9)));
      if (clash) throw bad(`This client already has ${clash.brand} under a name and pack size you used: an O2S line could not tell them apart.`);
      try { await q('UPDATE c2m_client_product SET brand=?, o2s_brand=? WHERE id=?', [brand, o2s, cp.id]); } catch (e) { if (dupName(e)) throw bad('This client already has a product with these names.'); throw e; }
      await audit(req.c2m.user, 'client_product', cp.id, 'edit', { brand: cp.brand, o2s: cp.o2s_brand }, { brand, o2s }, b.why ? String(b.why).slice(0, 200) : 'Correct a product');
      return { brand };
    });
    res.json({ ok: true, ...out });
  }));
  app.post('/api/c2m/products/:id/inuse', can('client.add'), wrap(async (req, res) => {
    const on = !!(req.body || {}).on;
    await tx(async () => {
      const [[cp]] = await q('SELECT * FROM c2m_client_product WHERE id=? FOR UPDATE', [req.params.id]); if (!cp) throw bad('This product is no longer in C2M. Press Refresh; if it is still missing, it was deleted.');
      if (cp.channel !== 'White label') throw bad('A VAN brand product is put out of use in Setup, Products and variants.');
      if (Number(cp.active) === (on ? 1 : 0)) throw bad(on ? 'It is in use already.' : 'It is out of use already.');
      if (!on) { const [[w]] = await q("SELECT COUNT(*) n FROM c2m_price p JOIN c2m_client_pack k ON k.id=p.client_pack_id WHERE k.client_product_id=? AND p.status='proposed'", [cp.id]); if (Number(w.n)) throw bad('A price for this product is waiting for the COO. Let him decide it first.'); }
      if (on) { // put back: no other product of the client may already use its name and a pack size (an O2S line could not tell them apart)
        const D = await engine.loadAll(q); const nm0 = namesOf(cp); const [mk] = await q('SELECT pack_size FROM c2m_client_pack WHERE client_product_id=?', [cp.id]); const mine = mk.map(x => Number(x.pack_size));
        const clash = D.cps.find(c => Number(c.customer_id) === Number(cp.customer_id) && Number(c.id) !== Number(cp.id) && c.channel === 'White label' && namesOf(c).some(n => nm0.some(m => nmK(m) === nmK(n))) && D.packs.some(k => Number(k.client_product_id) === Number(c.id) && mine.some(z => Math.abs(Number(k.pack_size) - z) < 1e-9)));
        if (clash) throw bad(`${clash.brand} is in use under a name and pack size of ${cp.brand}: an O2S line could not tell them apart. Rename one of them first.`);
      }
      await q('UPDATE c2m_client_product SET active=? WHERE id=?', [on ? 1 : 0, cp.id]);
      await recomputeGroup(cp.customer_id, req.c2m.user);
      await audit(req.c2m.user, 'client_product', cp.id, on ? 'in use' : 'out of use', cp.active, on ? 1 : 0, (req.body || {}).why ? String(req.body.why).slice(0, 200) : null);
    });
    res.json({ ok: true });
  }));
  app.post('/api/c2m/packs/:id/remove', can('client.add'), wrap(async (req, res) => {
    await tx(async () => {
      const [[k]] = await q('SELECT k.*, c.channel, c.brand, c.sold_per FROM c2m_client_pack k JOIN c2m_client_product c ON c.id=k.client_product_id WHERE k.id=? FOR UPDATE', [req.params.id]); if (!k) throw bad('This pack is no longer in C2M. Press Refresh; if it is still missing, it was deleted.');
      if (k.channel !== 'White label') throw bad('A VAN brand pack is changed through a price list revision.');
      const [[cv]] = await q('SELECT COUNT(*) n FROM c2m_cost_version WHERE client_pack_id=?', [k.id]); const [[pr]] = await q('SELECT COUNT(*) n FROM c2m_price WHERE client_pack_id=?', [k.id]);
      const [ra] = await q("SELECT id FROM c2m_reapproval WHERE status='open' AND (items_json LIKE ? OR items_json LIKE ?)", [`%"packId":${Number(k.id)},%`, `%"packId":${Number(k.id)}}%`]);
      if (Number(cv.n) || Number(pr.n) || ra.length) throw bad(`The ${Number(k.pack_size)} ${k.sold_per} pack of ${k.brand} already has an approved cost, a price or a re-approval, so it cannot be removed. Take the product out of use instead.`);
      const [[left]] = await q('SELECT COUNT(*) n FROM c2m_client_pack WHERE client_product_id=?', [k.client_product_id]); if (Number(left.n) <= 1) throw bad('This is the only pack of the product. Take the product out of use instead.');
      await q('DELETE FROM c2m_pack_ext WHERE client_pack_id=?', [k.id]); await q('DELETE FROM c2m_client_pack WHERE id=?', [k.id]);
      await audit(req.c2m.user, 'client_pack', k.id, 'remove', Number(k.pack_size), null, `Removed the ${Number(k.pack_size)} ${k.sold_per} pack of ${k.brand}`);
    });
    res.json({ ok: true });
  }));

  /** Tag a product with its family and variant (existing products such as Fusion Potash Granular and Powder keep their recipes, packs and cost: D-98). */
  app.post('/api/c2m/products/:id/variant', can('variant.add'), wrap(async (req, res) => {
    await needVariants(); const b = req.body || {}; let re = 0;
    const [[cp]] = await q('SELECT * FROM c2m_client_product WHERE id=?', [req.params.id]); if (!cp) throw bad('This product is no longer in C2M. Press Refresh; if it is still missing, it was deleted.');
    await tx(async () => {
      const [[old]] = await q('SELECT * FROM c2m_product_ext WHERE client_product_id=?', [cp.id]);
      const fam = b.clear ? { familyId: null, pvariantId: null } : await pickFamilyVariant(req, b);
      if (!b.clear && !fam.familyId) throw bad('Pick the product and the variant.');
      await setExt(cp.id, { ...fam, followsId: old ? old.follows_product_id : null });
      await audit(req.c2m.user, 'client_product', cp.id, 'variant', old ? { family: old.family_id, variant: old.pvariant_id } : null, fam, 'Variant tag');
      re = await reapprovalFor(`Variant of ${cp.brand} changed, ${today()}`, k => k.client_product_id === cp.id); // a rate set for the variant may now apply
      await costNotice(req.c2m.user, `Variant of ${cp.brand} changed`, re);
    });
    res.json({ ok: true, reapproval: re });
  }));

  /** Add a variant of a VAN product as a new VAN product (D-98). Its recipe starts as a copy of the main product's, a draft that goes
   * through the normal steps and can be changed. Majid, Tahir and Yawar may add it; the rates stay with Yawar. */
  app.post('/api/c2m/variants', can('variant.add'), wrap(async (req, res) => {
    await needVariants(); const b = req.body || {};
    const vname = notSize(cleanName(b.variant, 80, 'variant name')); if (b.mainVariant) notSize(b.mainVariant);
    const id = await tx(async () => {
      await lockNames(); const D = await engine.loadAll(q);
      const main = D.cpById.get(Number(b.fromProductId)); if (!main || !engine.isVanBrand(main)) throw bad('Pick the product this is a variant of.');
      const me = D.ext.get(main.id) || {};
      if (me.followsId) throw bad(`${main.brand} follows another product: add the variant to the product that has the recipe.`);
      /* the family: the main product's, or a new one named after it; the main product then needs its own variant name */
      let familyId = me.familyId, mainVar = me.pvariantId;
      if (!familyId) { const fam = await pickFamilyVariant(req, { family: nmClean(b.family) || main.brand }); familyId = fam.familyId; }
      if (!mainVar) { const mv = nmClean(b.mainVariant); if (!mv) throw bad(`${main.brand} has no variant yet: say what its own variant is (for example Powder).`); mainVar = (await pickFamilyVariant(req, { familyId, variant: mv })).pvariantId; }
      const [[dupV]] = await q('SELECT id FROM c2m_product_variant WHERE family_id=? AND name=?', [familyId, vname]); if (dupV) throw bad(`The variant "${vname}" is already there for this product.`);
      const nv = (await pickFamilyVariant(req, { familyId, variant: vname })).pvariantId;
      const [[fam]] = await q('SELECT name FROM c2m_product_family WHERE id=?', [familyId]);
      const brand = cleanName(b.brand || `${fam.name} ${vname}`, 120, 'brand name'); const names = spellings(b.o2sNames, brand); const o2s0 = names.join('|');
      const typeId = b.typeId ? Number(b.typeId) : main.base_product_id; const form = b.form || main.form, soldPer = b.soldPer || main.sold_per, mode = b.packingMode || main.packing_mode;
      if (!['solid', 'liquid'].includes(form) || !['kg', 'L'].includes(soldPer) || !modeOk(mode)) throw bad('Check the form, sold per and who supplies the packing.'); if ((form === 'liquid') !== (soldPer === 'L')) throw bad('A liquid is sold per L and a solid per kg.');
      const packs = (await readPacks(b.packs, mode)).map(k => ({ ...k, clientOnly: false })); // a VAN pack is on the VAN lists; a pack for 1 client belongs to that client's own product
      const clash = nameClash(D, 0, names, packs.map(p => p.size)); if (clash) throw bad(clash);
      { const off = await offNames(packs.map(p => p.size)); const hit = names.map(x => ({ x, h: off.find(o => o.names.some(s => nmK(s) === nmK(x))) })).find(y => y.h); if (hit) throw bad(`"${hit.x}" is a name of ${hit.h.brand}, which is out of use and has a pack of the same size.`); }
      let r; const cpNew = { customer_id: main.customer_id, channel: 'VAN brand' };
      const o2s = await storeO2s({ ...cpNew, id: 0 }, names);
      try { [r] = await q("INSERT INTO c2m_client_product (customer_id, channel, brand, o2s_brand, base_product_id, form, sold_per, packing_mode, reprocessed, active) VALUES (?,?,?,?,?,?,?,?,?,1)", [main.customer_id, 'VAN brand', brand, o2s, typeId, form, soldPer, mode, main.reprocessed]); }
      catch (e) { if (dupName(e)) throw bad('Another product of the VAN brand owner already has exactly these O2S spellings: change one.'); throw e; }
      await setExt(main.id, { familyId, pvariantId: mainVar, followsId: null }); await setExt(r.insertId, { familyId, pvariantId: nv, followsId: null });
      await insertPacks(r.insertId, main.customer_id, packs, req.c2m.user);
      /* the recipe starts as a copy of the main product's approved recipe (else its latest), a draft with the usual steps after it */
      const src = engine.approvedVersion(D, main.id) || engine.latestVersion(D, main.id); let rid = null;
      if (src && src.lines.length) {
        const [iv] = await q("INSERT INTO c2m_recipe_version (client_product_id, version_no, state, note, created_by, created_at) VALUES (?,1,'draft',?,?,?)", [r.insertId, `Copied from ${main.brand} version ${src.version_no}; change what differs`, req.c2m.user, now()]);
        rid = iv.insertId; for (const l of src.lines) await q('INSERT INTO c2m_recipe_line (recipe_version_id, grade_id, qty) VALUES (?,?,?)', [rid, l.gradeId, l.qty]);
        await step(rid, 'written', req.c2m.user, `Copied from ${main.brand} version ${src.version_no}`);
      }
      await audit(req.c2m.user, 'client_product', r.insertId, 'add_variant', null, { main: main.brand, brand, variant: vname, recipeCopiedFrom: src ? src.id : null, packs }, 'Add a variant');
      return { id: r.insertId, recipeVersionId: rid };
    });
    res.json(id);
  }));

  /** Set or clear the VAN product a white label product follows. It then takes that product's approved recipe (material cost only). */
  app.post('/api/c2m/products/:id/follow', can('client.add'), wrap(async (req, res) => {
    await needVariants(); const b = req.body || {}; let re = 0;
    await tx(async () => {
      const D = await engine.loadAll(q); const cp = D.cpById.get(Number(req.params.id)); if (!cp) throw bad('This product is no longer in C2M. Press Refresh; if it is still missing, it was deleted.');
      if (cp.channel !== 'White label') throw bad('Only a client product follows one of our products.');
      const [[old]] = await q('SELECT * FROM c2m_product_ext WHERE client_product_id=?', [cp.id]);
      let followsId = null, fam = { familyId: old ? old.family_id : null, pvariantId: old ? old.pvariant_id : null };
      if (b.followsId) { const f = await checkFollow(D, b.followsId, cp.id); followsId = f.id; if (f.form !== cp.form || f.sold_per !== cp.sold_per) throw bad(`${f.brand} is ${f.form}, sold per ${f.sold_per}: this product is ${cp.form}, sold per ${cp.sold_per}.`);
        const own = [...D.recipes.byCp.get(cp.id) || []].filter(v => ['draft', 'review', 'endorse', 'cost'].includes(v.state)); if (own.length) throw bad('This product has a recipe version in progress. Finish or send it back first.');
        const fe = D.ext.get(f.id) || {}; if (!fam.familyId) fam = { familyId: fe.familyId || null, pvariantId: fe.pvariantId || null }; }
      await setExt(cp.id, { ...fam, followsId });
      await audit(req.c2m.user, 'client_product', cp.id, 'follow', old ? old.follows_product_id : null, followsId, 'Follows a VAN product');
      re = await reapprovalFor(`${cp.brand} now ${followsId ? 'follows ' + D.cpById.get(followsId).brand : 'follows no VAN product'}, ${today()}`, p => p.client_product_id === cp.id);
      await costNotice(req.c2m.user, `${cp.brand} ${followsId ? 'now follows the recipe of ' + D.cpById.get(followsId).brand : 'no longer follows a VAN recipe'}`, re);
    });
    res.json({ ok: true, reapproval: re });
  }));

  /** Approve the cost of a product that follows a VAN recipe (the CFO step; the recipe itself was approved on the VAN product).
   * Every pack must be fully costed; a pack whose cost has not moved is left as it is. */
  app.post('/api/c2m/products/:id/approve-cost', can('recipe.step.cost'), wrap(async (req, res) => {
    await needVariants(); let wrote = 0;
    await tx(async () => {
      await q('SELECT id FROM c2m_client_product WHERE id=? FOR UPDATE', [Number(req.params.id)]);
      const D = await engine.loadAll(q); const cp = D.cpById.get(Number(req.params.id)); if (!cp) throw bad('This product is no longer in C2M. Press Refresh; if it is still missing, it was deleted.');
      const e = D.ext.get(cp.id); if (!e || !e.followsId) throw bad('This product has its own recipe: approve its cost on the recipe.');
      const ver = engine.approvedVersion(D, cp.id); if (!ver) throw bad(`${D.cpById.get(e.followsId).brand} has no approved recipe yet: its cost has to be approved first.`);
      const packs = D.packs.filter(p => p.client_product_id === cp.id); if (!packs.length) throw bad('This product has no pack yet.');
      const notCosted = []; const calc = [];
      for (const p of packs) { const c = engine.packCost(D, p); if (!c || !c.costed) notCosted.push(`${Number(p.pack_size)} ${cp.sold_per}: ${c ? c.gaps.join(', ') : 'out of use'}`); else calc.push({ p, c }); }
      if (notCosted.length) throw bad(`The cost cannot be approved until every pack is fully costed. ${notCosted.join('; ')}.`);
      for (const { p, c } of calc) {
        const av = engine.latestApproved(D, p.id); if (av && Math.abs(Number(av.total) - c.total) < 0.005 && av.recipe_version_id === ver.id) continue;
        await q('INSERT INTO c2m_cost_version (client_pack_id, valid_from, materials, packing, conversion, freight, total, recipe_version_id, cause, approved_by) VALUES (?,?,?,?,?,?,?,?,?,?)',
          [p.id, now(), c.materials, c.packing, c.conversion, c.freight, c.total, ver.id, `Cost approved on the recipe of ${D.cpById.get(e.followsId).brand} version ${ver.version_no}`, req.c2m.user]); wrote++;
      }
      if (!wrote) throw bad('Nothing to approve: the approved cost of every pack is already today\'s cost.');
      await audit(req.c2m.user, 'client_product', cp.id, 'cost_approved', null, { packs: wrote, recipeVersion: ver.id }, 'Follows a VAN product');
    });
    res.json({ ok: true, packs: wrote });
  }));

  app.post('/api/c2m/rules/conversion/:id/retire', can('labour.manage'), wrap(async (req, res) => {
    if (await lfOn()) throw Object.assign(new Error(OLD_LF), { status: 409 }); // old labour and FOH rates after migration 011 (review 2c, finding 7 and 8)
    const why = String((req.body || {}).why || '').trim(); if (!why) throw bad('Write why the rate is taken out of use.');
    let re = 0;
    await tx(async () => {
      const [u] = await q('UPDATE c2m_conversion_rule SET active=0 WHERE id=? AND active=1', [req.params.id]); if (!u.affectedRows) throw moved();
      const gaps = packsWithoutRates(await engine.loadAll(q)); if (gaps.length) throw bad(`Retiring this rate leaves ${gaps.length} pack(s) with no rate, e.g. ${gaps.slice(0, 3).join('; ')}. Add the replacing rate first.`);
      await audit(req.c2m.user, 'conversion_rule', req.params.id, 'retire', null, null, why);
      re = await reapprovalFor(`Labour or FOH rate ${req.params.id} taken out of use, ${today()}`);
      await costNotice(req.c2m.user, `Labour or FOH rate ${req.params.id} taken out of use by the CFO (${why.slice(0, 120)})`, re);
    });
    res.json({ ok: true, reapproval: re });
  }));

  /* ---------- Prices: Yawar proposes, Tahir approves or sends back ---------- */
  async function packInfo(packId) {
    const D = await engine.loadAll(q); const p = D.packs.find(x => x.id === Number(packId)); if (!p) throw bad('This pack is no longer in C2M. Press Refresh; if it is still missing, it was deleted.');
    const cp = D.cpById.get(p.client_product_id); if (!cp) throw bad('This product is out of use. Put it back in use first (Setup, Products and variants), then price it.');
    const c = engine.packCost(D, p);
    return { D, p, cp, gaps: c && !c.costed ? c.gaps : [], cost: c && c.costed ? c.total : null, target: lib.targetOr(cp.target_gp, D.settings && D.settings.values ? D.settings.values.budget_gp : null) }; // no target set = the company GP target (D-75)
  }
  app.post('/api/c2m/prices/propose', can('price.propose'), wrap(async (req, res) => {
    const { packId, price, reason, belowReason, replaceId, validFrom, validTo, urgent, urgentWhy: uWhy } = req.body || {};
    const v = strictNum(price); if (!(v > 0)) throw bad('Type a price above 0, digits only.');
    if (Math.abs(v - Math.round(v)) > 1e-9) throw bad(`A client price is a whole rupee. Type ${Math.ceil(v)} (the next whole rupee) or another whole number.`); // Tahir, 22 Oct 2026
    const P = await packInfo(packId);
    if (engine.isVanBrand(P.cp)) throw bad('A VAN brand pack is priced per channel through the VAN brand list revisions (Prices, VAN brand lists), not here.'); // D-44
    if (validFrom && !isDate(validFrom)) throw bad('From must be a date.');
    if (validFrom && validFrom < today()) throw bad('The From date cannot be in the past: pick today or a later day.');
    const from0 = cycleFrom(validFrom, !!urgent, uWhy, 'a price'); // R33
    if (validTo && (!isDate(validTo) || validTo < from0)) throw bad('Till must be the From date or later (it is the last day the price applies).');
    // No price for a pack that is not costed, including one whose recipe is not in C2M yet (D-40; Tahir 18 Oct, I-24)
    if (P.cost == null) throw bad(`This pack is not costed (${P.gaps.join(', ')}), so its GP cannot be checked. Fix its cost first, then propose the price.`);
    const gp = lib.marginPct(v, P.cost);
    if (P.target != null && gp != null && gp < P.target && !String(belowReason || '').trim()) throw bad('This price is below target GP. Write why.');
    if (!String(reason || '').trim()) throw bad('Write the reason the client will read on the list.'); // written by Yawar, never pre-filled (D-56)
    const id = await tx(async () => {
      const [[open]] = await q("SELECT id FROM c2m_price WHERE client_pack_id=? AND status='proposed' FOR UPDATE", [P.p.id]);
      if (open) throw bad('This pack already has a price waiting for the COO. Wait for his decision first.');
      if (replaceId) { const [u] = await q("UPDATE c2m_price SET status='replaced' WHERE id=? AND client_pack_id=? AND status='sent_back'", [replaceId, P.p.id]); if (!u.affectedRows) throw moved(); await audit(req.c2m.user, 'price', replaceId, 'replaced', 'sent_back', 'replaced', 'Revised and sent again'); }
      // 1.0.0: a new price for the pack also closes any older sent-back price of that pack, so none stays on Approvals with no way out (review 19 Oct)
      const [old] = await q("SELECT id FROM c2m_price WHERE client_pack_id=? AND status='sent_back' FOR UPDATE", [P.p.id]);
      for (const o of old) { await q("UPDATE c2m_price SET status='replaced' WHERE id=?", [o.id]); await audit(req.c2m.user, 'price', o.id, 'replaced', 'sent_back', 'replaced', 'A newer price for the same pack was sent'); }
      const cur = await priceInForce(P.p.id);
      const [r] = await q("INSERT INTO c2m_price (client_pack_id, price, prev_price, valid_from, valid_to, reason, below_target_reason, status, proposed_by, proposed_at) VALUES (?,?,?,?,?,?,?,'proposed',?,?)",
        [P.p.id, v, cur ? cur.price : null, from0, validTo || null, String(reason || '').slice(0, 400) || null, String(belowReason || '').slice(0, 400) || null, req.c2m.user, now()]);
      await audit(req.c2m.user, 'price', r.insertId, 'propose', cur ? cur.price : null, v, reason);
      if (urgent) await audit(req.c2m.user, 'price', r.insertId, 'urgent', null, null, String(uWhy).trim().slice(0, 400)); // R33: Tahir reads why on Approvals
      return r.insertId;
    });
    res.json({ id });
  }));
  app.post('/api/c2m/prices/:id/approve', can('price.approve'), wrap(async (req, res) => {
    await tx(async () => {
      const [[p]] = await q("SELECT * FROM c2m_price WHERE id=? AND status='proposed' FOR UPDATE", [req.params.id]); if (!p) throw moved(); await notSelf(p.proposed_by, req);
      const urg = await urgentWhy('price', p.id);
      const from0 = String(p.valid_from).slice(0, 10) > today() ? String(p.valid_from).slice(0, 10) : today();
      const from = urg ? today() : mondayFrom(from0); // R33: a price whose Monday passed while it waited takes the next Monday; urgent goes in today
      if (p.valid_to && String(p.valid_to).slice(0, 10) < from) throw bad(`Its Till date (${String(p.valid_to).slice(0, 10)}) is before it would start (${from}). Send it back for new dates.`);
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
        // A price that started the same day (or later) is replaced outright; its end date is never set before its own start (audit, 23 Oct 2026)
        const sameDay = String(cur.valid_from).slice(0, 10) >= from, endTo = sameDay ? String(cur.valid_from).slice(0, 10) : dayBefore(from);
        await q(`UPDATE c2m_price SET valid_to=?${from <= today() || sameDay ? ", status='replaced'" : ''} WHERE id=?`, [endTo, cur.id]);
        await audit(req.c2m.user, 'price', cur.id, sameDay ? 'replaced' : 'ended', cutPrev, endTo, sameDay ? `Replaced by price ${p.id} on its first day, ${from}` : `Ends before price ${p.id} starts on ${from}`);
      }
      const [u] = await q("UPDATE c2m_price SET status='approved', prev_price=?, valid_from=?, cut_price_id=?, cut_prev_to=?, decided_by=?, decided_at=? WHERE id=? AND status='proposed'", [cur ? cur.price : null, from, cutId, cutPrev, req.c2m.user, now(), p.id]);
      if (!u.affectedRows) throw moved();
      await audit(req.c2m.user, 'price', p.id, 'approve', cur ? cur.price : null, p.price, from > today() ? `Takes over on ${from}` : null);
      res.locals.out = { ok: true, waitsUntil: from > today() ? from : null, cancelled: waiting.length };
      if (waiting.length) { const issued = []; for (const w of waiting) issued.push(...await docsShowingPrice(w));
        await notice('cfo', `A price waiting for a later date was cancelled by the COO's newer approval for the same pack (price ${p.id}).${issued.length ? ` Already issued with the cancelled price: ${issued.join(', ')}. Tell the client.` : ''}`, req.c2m.user); }
    });
    res.json(res.locals.out);
  }));
  /* Withdraw a price approved for a later date, before it takes over (Tahir). */
  app.post('/api/c2m/prices/:id/withdraw', can('price.withdraw'), wrap(async (req, res) => {
    const why = String((req.body || {}).why || '').trim(); if (!why) throw bad('Write why the waiting price is withdrawn.');
    await tx(async () => {
      const [[p]] = await q("SELECT * FROM c2m_price WHERE id=? AND status='approved' AND valid_from>? FOR UPDATE", [req.params.id, today()]); if (!p) throw moved();
      const [u] = await q("UPDATE c2m_price SET status='withdrawn' WHERE id=? AND status='approved'", [p.id]); if (!u.affectedRows) throw moved();
      await restoreCut(p, req.c2m.user, 'withdrawn');
      await audit(req.c2m.user, 'price', p.id, 'withdrawn', p.price, null, why);
      // Tell Yawar, and name any price list already issued that shows this price (review: withdraw told nobody)
      const docs = await docsShowingPrice(p);
      await notice('cfo', `The COO withdrew the price Rs ${lib.fmtRs2(Number(p.price))} waiting from ${String(p.valid_from).slice(0, 10)}. Why: ${why.slice(0, 150)}${docs.length ? `. Already issued with it: ${docs.join(', ')}. Tell the client.` : ''}`, req.c2m.user);
      res.locals.out = { ok: true, issuedDocs: docs };
    });
    res.json(res.locals.out);
  }));
  /* The person who proposed a price or a target can take it back while it waits (audit, 23 Oct 2026): a typo no longer needs Tahir to send it back. */
  app.post('/api/c2m/prices/:id/retract', can('price.propose'), wrap(async (req, res) => {
    await tx(async () => {
      const [[p]] = await q("SELECT * FROM c2m_price WHERE id=? AND status='proposed' FOR UPDATE", [req.params.id]); if (!p) throw moved();
      if (p.proposed_by !== req.c2m.user && !req.c2m.admin) throw bad('Only the person who proposed this price can take it back.');
      await q("UPDATE c2m_price SET status='withdrawn' WHERE id=? AND status='proposed'", [p.id]);
      await audit(req.c2m.user, 'price', p.id, 'taken back', p.price, null, 'Taken back by the proposer');
    });
    res.json({ ok: true });
  }));
  app.post('/api/c2m/targets/:id/retract', can('targets.propose'), wrap(async (req, res) => {
    await tx(async () => {
      const [[t]] = await q("SELECT * FROM c2m_target_request WHERE id=? AND status='open' FOR UPDATE", [req.params.id]); if (!t) throw moved();
      if (t.by_user !== req.c2m.user && !req.c2m.admin) throw bad('Only the person who asked for this target can take it back.');
      await q("UPDATE c2m_target_request SET status='withdrawn', decided_by=?, decided_at=? WHERE id=? AND status='open'", [req.c2m.user, now(), t.id]);
      await audit(req.c2m.user, 'target', t.client_product_id, 'taken back', t.from_gp, t.to_gp, 'Taken back by the proposer');
    });
    res.json({ ok: true });
  }));
  app.post('/api/c2m/prices/:id/sendback', can('price.approve'), wrap(async (req, res) => {
    const reason = String((req.body || {}).reason || '').trim(); if (!reason) throw bad('Write a reason.');
    const [r] = await q("UPDATE c2m_price SET status='sent_back', back_reason=?, decided_by=?, decided_at=? WHERE id=? AND status='proposed'", [reason.slice(0, 400), req.c2m.user, now(), req.params.id]);
    if (!r.affectedRows) throw bad('Nothing to send back.');
    await audit(req.c2m.user, 'price', req.params.id, 'sent_back', null, null, reason);
    res.json({ ok: true });
  }));

  /* ---------- Settings: thresholds need Tahir's approval; budget lines notify Tahir (ruled 14 to 15 Oct) ---------- */
  app.post('/api/c2m/settings', can('settings.edit'), wrap(async (req, res) => {
    const ch = (req.body || {}).changes || {};
    const [rows] = await q('SELECT k, v, label, needs_approval FROM c2m_setting'); rows.forEach(r => { if (r.k === 'budget_gp') { r.needs_approval = 1; r.label = 'Company GP target, %'; } if (isListSet(r.k)) r.needs_approval = 1; });
    for (const L of LIST_ROWS) if (!rows.some(r => r.k === L.k)) rows.push({ ...L }); /* a list's target and freight: not set until first approved (D-153) */
    for (const [k, v] of Object.entries(ch)) if (/^lt_/.test(k) && isListSet(k) && String(v).trim() !== '' && !(strictNum(v) > 0 && strictNum(v) < 100)) throw bad('A list target is a % above 0 and below 100.'); // D-75: waits for Tahir, under the name Setup shows (no SQL needed)
    const pend = {}, direct = [];
    for (const r of rows) if (ch[r.k] != null && String(ch[r.k]) !== String(r.v)) { if (String(ch[r.k]).trim() === '' || !(strictNum(ch[r.k]) >= 0)) throw bad(`${r.label}: type a number (digits only). An empty box is not saved, since it would count as 0 (audit 4 Nov 2026, fault A3).`); if (r.k === 'fed_pct' && !(Number(ch[r.k]) > 0 && Number(ch[r.k]) < 100)) throw bad(`${r.label}: type a % above 0 and below 100.`); (r.needs_approval ? (pend[r.k] = String(ch[r.k])) : direct.push([r, String(ch[r.k])])); }
    await tx(async () => {
      for (const [r, v] of direct) { await q('UPDATE c2m_setting SET v=?, updated_by=?, updated_at=? WHERE k=?', [v, req.c2m.user, now(), r.k]); await notice('coo', `Setting changed: ${r.label} ${r.v} to ${v}`, req.c2m.user); await audit(req.c2m.user, 'setting', r.k, 'change', r.v, v, null); if (r.k === 'fed_pct') await refedLists(req.c2m.user); }
      if (Object.keys(pend).length) {
        const why = String((req.body || {}).why || '').trim().slice(0, 200); /* a list's target or freight carries why, for Tahir (D-153) */
        const summary = (rows.filter(r => pend[r.k] != null).map(r => `${r.label} ${String(r.v).trim() === '' ? 'not set' : r.v} to ${pend[r.k]}`).join('; ') + (why ? `. Why: ${why}` : '')).slice(0, 400); /* the column holds 400 (review 3b, finding 6) */
        if (Object.keys(pend).some(isListSet) && !why) throw bad('Write why the list target or freight changes: the COO reads it before he approves.');
        await q('INSERT INTO c2m_setting_request (changes_json, summary, by_user, at) VALUES (?,?,?,?)', [JSON.stringify(pend), summary, req.c2m.user, now()]);
      }
    });
    res.json({ applied: direct.length, pending: Object.keys(pend).length });
  }));
  app.post('/api/c2m/settings/requests/:id/:act(approve|refuse)', can('settings.approve'), wrap(async (req, res) => {
    await tx(async () => {
      const [[r]] = await q("SELECT * FROM c2m_setting_request WHERE id=? AND status='open' FOR UPDATE", [req.params.id]); if (!r) throw moved(); if (req.params.act === 'approve') await notSelf(r.by_user, req);
      const [u] = await q("UPDATE c2m_setting_request SET status=?, decided_by=?, decided_at=? WHERE id=? AND status='open'", [req.params.act === 'approve' ? 'approved' : 'refused', req.c2m.user, now(), r.id]); if (!u.affectedRows) throw moved();
      if (req.params.act === 'approve') for (const [k, v] of Object.entries(JSON.parse(r.changes_json))) {
        const [[old]] = await q('SELECT v FROM c2m_setting WHERE k=?', [k]);
        if (!old && isListSet(k)) await q('INSERT INTO c2m_setting (k, v, label, needs_approval, updated_by, updated_at) VALUES (?,?,?,1,?,?) ON DUPLICATE KEY UPDATE v=VALUES(v), updated_by=VALUES(updated_by), updated_at=VALUES(updated_at)', [k, v, LIST_ROWS.find(r => r.k === k).label, req.c2m.user, now()]); /* first figure of a list (D-153) */
        else await q('UPDATE c2m_setting SET v=?, updated_by=?, updated_at=? WHERE k=?', [v, req.c2m.user, now(), k]);
        await audit(req.c2m.user, 'setting', k, 'change', old ? old.v : null, v, 'Approved request ' + r.id);
        if (k === 'fed_pct') await refedLists(req.c2m.user);
      }
      await audit(req.c2m.user, 'setting_request', r.id, req.params.act, null, r.summary, null);
    });
    res.json({ ok: true });
  }));

  /* ---------- Client target overrides: Yawar proposes, Tahir approves ---------- */
  app.post('/api/c2m/targets/request', can('targets.propose'), wrap(async (req, res) => {
    const { clientProductId, toGp, reason } = req.body || {};
    const [[cp]] = await q('SELECT id, target_gp FROM c2m_client_product WHERE id=?', [clientProductId]); if (!cp) throw bad('Pick a client product.');
    const toCo = String(toGp).trim().toLowerCase() === 'company'; // back to the company target (Tahir, 26 Oct 2026): held as 0 on the request, NULL on the product
    if (toCo ? cp.target_gp == null : (!/^\d{1,2}(\.\d)?$/.test(String(toGp == null ? '' : toGp).trim()) || !(Number(toGp) > 0) || Number(toGp) === Number(cp.target_gp))) throw bad(toCo ? 'This product is on the company target already.' : 'Type the new target GP: a number above 0 and below 100, with at most 1 decimal, different from today\'s.'); if (!String(reason || '').trim()) throw bad('Write why.');
    // Locked on the product row, so 2 quick clicks cannot open 2 requests (re-review)
    const rid = await tx(async () => {
      await q('SELECT id FROM c2m_client_product WHERE id=? FOR UPDATE', [cp.id]);
      const [[openReq]] = await q("SELECT id FROM c2m_target_request WHERE client_product_id=? AND status='open'", [cp.id]);
      if (openReq) throw bad('This product already has a target change waiting for the COO. Wait for his decision first.');
      const [r] = await q('INSERT INTO c2m_target_request (client_product_id, from_gp, to_gp, reason, by_user, at) VALUES (?,?,?,?,?,?)', [cp.id, cp.target_gp, toCo ? 0 : Number(toGp), String(reason).slice(0, 400), req.c2m.user, now()]);
      await audit(req.c2m.user, 'target_request', r.insertId, 'request', cp.target_gp, toCo ? 'company target' : Number(toGp), reason);
      return r.insertId;
    });
    res.json({ id: rid });
  }));
  app.post('/api/c2m/targets/:id/:act(approve|refuse)', can('targets.approve'), wrap(async (req, res) => {
    await tx(async () => {
      const [[r]] = await q("SELECT * FROM c2m_target_request WHERE id=? AND status='open' FOR UPDATE", [req.params.id]); if (!r) throw moved(); if (req.params.act === 'approve') await notSelf(r.by_user, req);
      const [u] = await q("UPDATE c2m_target_request SET status=?, decided_by=?, decided_at=? WHERE id=? AND status='open'", [req.params.act === 'approve' ? 'approved' : 'refused', req.c2m.user, now(), r.id]); if (!u.affectedRows) throw moved();
      if (req.params.act === 'approve') await q('UPDATE c2m_client_product SET target_gp=? WHERE id=?', [Number(r.to_gp) > 0 ? r.to_gp : null, r.client_product_id]); // 0 = back to the company target
      await audit(req.c2m.user, 'target', r.client_product_id, req.params.act, r.from_gp, r.to_gp, r.reason);
    });
    res.json({ ok: true });
  }));

  /* ---------- Import queue: nothing enters without Yawar ---------- */
  app.post('/api/c2m/import/:id/:act(accept|correct)', can('import.decide'), wrap(async (req, res) => {
    const [[it]] = await q("SELECT * FROM c2m_import_item WHERE id=? AND status='open'", [req.params.id]); if (!it) throw moved();
    let note = 'Accepted: ' + it.prefill_text, re = 0;
    const v = String((req.body || {}).value || '').trim(), why = String((req.body || {}).why || '').trim();
    if (req.params.act === 'correct') {
      if (!v || !why) throw bad('Type the correct value and why.');
      note = `Corrected to ${v}. Why: ${why}`;
    }
    const pl = JSON.parse(it.payload || '{}'); let held = null;
    /* A rate correction is saved through the same controls as any rate: digits only, 10% warning, re-approval, and Monday is cost day
       (review 2b, finding 4): Tuesday to Sunday it waits in Next week's costs. */
    if (req.params.act === 'correct' && it.kind === 'rate' && pl.gradeId) {
      const a = await callFn(weekly('rate', save_rate), { ...req, query: {}, body: { gradeId: pl.gradeId, rate: v.replace(/^rs\.?\s*/i, '').replace(/,/g, ''), source: 'Import queue correction: ' + why.slice(0, 150), confirmed: !!(req.body || {}).confirmed } });
      re = a.reapproval || 0; if (a.pending) { held = a.applyOn; note += ` Waits for Monday ${a.applyOn}.`; } }
    await tx(async () => {
      const [u] = await q("UPDATE c2m_import_item SET status=?, decided_by=?, decided_at=?, decision_note=? WHERE id=? AND status='open'", [req.params.act === 'accept' ? 'accepted' : 'corrected', req.c2m.user, now(), note.slice(0, 400), it.id]);
      if (!u.affectedRows) throw moved();
      await audit(req.c2m.user, 'import_item', it.id, req.params.act, it.prefill_text, note, null);
    });
    res.json({ ok: true, reapproval: re, kind: it.kind, pending: !!held, applyOn: held || undefined });
  }));

  /* ---------- Master data that had no form (audit, 16 Oct) ---------- */
  /* Push 7a (R66, D-162): the QC Head, the Production Manager and the CFO may add a material with no rate; its cost waits for the
     CFO's rate (a recipe using it cannot pass the cost step, as for any line with no rate). With a rate it stays the CFO's (material.save). */
  app.post('/api/c2m/materials', can('material.save', 'material.add'), wrap(async (req, res) => {
    const { name, typeId, unit, grade, rate, source } = req.body || {};
    const nm = String(name || '').replace(/\s+/g, ' ').trim(), gd = String(grade || 'Standard').replace(/\s+/g, ' ').trim() || 'Standard', withRate = rate != null && String(rate).trim() !== '';
    const why = String(source || '').trim();
    if (!nm) throw bad('Give the material name.');
    if (nm.length > 120 || gd.length > 60) throw bad('Keep the name under 120 letters and the grade under 60.');
    if (withRate) {
      if (!req.c2m.can.has('material.save')) throw bad('Leave the rate empty: the CFO adds it. Write the supplier or why it is needed instead.');
      if (!why || !(strictNum(rate) > 0)) throw bad('Give the material name, its rate (digits) and the source.');
    } else if (!why) throw bad('Write the supplier, or why the material is needed, so the CFO can find its rate.');
    if (!['kg', 'L'].includes(unit || 'kg')) throw bad('Unit is kg or L.');
    const [[t]] = await q('SELECT id, name FROM c2m_material_type WHERE id=?', [typeId]); if (!t) throw bad('Pick the class (or To classify, for the QC Head).');
    const id = await tx(async () => {
      let [[m]] = await q('SELECT id FROM c2m_raw_material WHERE name=?', [nm]);
      if (!m) { const [r] = await q('INSERT INTO c2m_raw_material (name, type_id, unit) VALUES (?,?,?)', [nm.slice(0, 120), t.id, unit || 'kg']); m = { id: r.insertId }; }
      const [[ex]] = await q('SELECT id FROM c2m_material_grade WHERE material_id=? AND grade=?', [m.id, gd]); if (ex) throw bad(withRate ? 'This material and grade already exist. Save a new rate on Costs, Material cost (Change cost).' : 'This material and grade are already in C2M: find them in the list.');
      const [g] = await q('INSERT INTO c2m_material_grade (material_id, grade) VALUES (?,?)', [m.id, gd.slice(0, 60)]);
      if (withRate) await q('INSERT INTO c2m_material_rate (grade_id, rate, rate_date, source, entered_by, entered_at) VALUES (?,?,?,?,?,?)', [g.insertId, strictNum(rate), today(), why.slice(0, 200), req.c2m.user, now()]);
      await audit(req.c2m.user, 'material', g.insertId, 'create', null, { name: nm, grade: gd, rate: withRate ? rate : null }, why.slice(0, 300));
      if (!withRate && req.c2m.role !== 'cfo') await notice('cfo', `New material waiting for its rate: ${nm}${gd !== 'Standard' ? ', ' + gd : ''}, added by the ${req.c2m.label}. Note: ${why.slice(0, 150)}. Add the rate on Costs, Material cost (Change cost).`, req.c2m.user);
      return g.insertId;
    });
    res.json({ gradeId: id });
  }));
  /* ---------- Push 7a (Tahir, 9 Nov 2026, R60 to R62, D-162): the nutrient list, material classes as labels, declared grades ---------- */
  const NEED014 = 'This part is not switched on yet: Ahmer runs database update 014 first. Everything else works as before.';
  const has014 = async () => { try { await q('SELECT id FROM c2m_nutrient LIMIT 1'); return true; } catch (e) { if (e && (e.code === 'ER_NO_SUCH_TABLE' || e.errno === 1146)) return false; throw e; } };
  const need014 = async () => { if (!await has014()) throw Object.assign(new Error(NEED014), { status: 409 }); };
  /** Push 7e (D-166): which role page a role reads: the 5 built-in pages by key; a role made on the launcher that sees only given
   *  price lists takes the viewer page; any other takes the launcher-role page. The page copy is rolePageKey in c2m.html. */
  function signPageOf(R) { if (['production', 'qc', 'plant', 'cfo', 'viewer'].includes(R.key)) return R.key; const nav = (R.nav || []).concat(R.more || []);
    return nav.includes('lists') && !nav.some(n => ['products', 'recipes', 'costs', 'margin'].includes(n)) ? 'viewer' : 'custom'; }
  function signRole(v) { try { const o = typeof v === 'string' ? JSON.parse(v) : v; return o && o.role ? String(o.role) : null; } catch (_) { return null; } }
  /** A person signs their own role page (version 1 to 99), once per page, version and role; in 1 transaction (review 7e, 5). The COO does
   *  not sign. Kept in the change record (entity signoff, with the role it was signed in). */
  app.post('/api/c2m/signoff', wrap(async (req, res) => {
    const b = req.body || {}; const page = String(b.page || ''); const v = Number(b.version);
    if (!['production', 'qc', 'plant', 'cfo', 'viewer', 'custom'].includes(page) || !(Number.isInteger(v) && v >= 1 && v <= 99)) throw bad('This role page is not known. Press Refresh.');
    if (req.c2m.admin) return res.json({ ok: true, skipped: true });
    if (page !== signPageOf({ key: req.c2m.role, nav: req.c2m.nav, more: req.c2m.more })) throw bad('This is not the page of your role. Press Refresh.');
    const id = `${page}:${v}`;
    await tx(async () => { const [had] = await q("SELECT entity_id, new_value FROM c2m_audit WHERE entity='signoff' AND by_user=? AND entity_id=? FOR UPDATE", [req.c2m.user, id]);
      if (!(had || []).some(r => signRole(r.new_value) === req.c2m.role)) await audit(req.c2m.user, 'signoff', id, 'signed', null, { role: req.c2m.role || null, label: req.c2m.label || null }, null); });
    res.json({ ok: true, page: id });
  }));
  /* Push 7c (Tahir, 10 Nov 2026, R70 to R73, D-164): % w/w and % w/v, and densities, after migration 015. */
  const m15 = async () => { try { await q('SELECT kind FROM c2m_density LIMIT 1'); return true; } catch (e) { if (e && (e.code === 'ER_NO_SUCH_TABLE' || e.errno === 1146)) return false; throw e; } };
  /** A density, kg per L at 20 °C (R70): of a material grade by the QC Head (nutrient.edit), of a product by the Production Manager
   *  (recipe.edit) or the administrator. An empty figure removes it. Range 0.5 to 3.0 kg per L. */
  app.post('/api/c2m/density', wrap(async (req, res) => {
    if (!await m15()) throw Object.assign(new Error('This part is not switched on yet: Ahmer runs database update 015 first. Everything else works as before.'), { status: 409 });
    const b = req.body || {}; const kind = b.kind === 'product' ? 'product' : b.kind === 'grade' ? 'grade' : null; if (!kind) throw bad('Say whether it is a material or a product.');
    const may = kind === 'grade' ? req.c2m.can.has('nutrient.edit') : (req.c2m.can.has('recipe.edit') || req.c2m.admin);
    if (!may) throw Object.assign(new Error(kind === 'grade' ? 'The QC Head enters the density of a material.' : 'The Production Manager enters the density of a product.'), { status: 403 });
    const id = Number(b.id); const raw = String(b.kgPerL == null ? '' : b.kgPerL).trim(); const src = String(b.source || '').replace(/\s+/g, ' ').trim().slice(0, 120); const dt = String(b.date || '').trim();
    const out = await tx(async () => {
      const [[ref]] = kind === 'grade' ? await q('SELECT id FROM c2m_material_grade WHERE id=? FOR UPDATE', [id]) : await q('SELECT id FROM c2m_client_product WHERE id=? FOR UPDATE', [id]); // locked, so a delete at the same moment waits (review 7c, minor 6)
      if (!ref) throw bad('This is no longer in C2M. Press Refresh.');
      if (kind === 'product') { const [ex] = await softQ('SELECT e.follows_product_id f, p.brand FROM c2m_product_ext e LEFT JOIN c2m_client_product p ON p.id=e.follows_product_id WHERE e.client_product_id=?', [id]); const fo = ex && ex[0]; // review 7c, minor 2: a product that follows another's recipe takes its density
        if (fo && fo.f) throw bad(`This product follows the recipe of ${fo.brand || 'another product'}: enter the density there.`); }
      const [[old]] = await q('SELECT kg_per_l, source, src_date FROM c2m_density WHERE kind=? AND ref_id=? FOR UPDATE', [kind, id]);
      if (raw === '') { await q('DELETE FROM c2m_density WHERE kind=? AND ref_id=?', [kind, id]); await audit(req.c2m.user, 'density', `${kind}:${id}`, 'remove', old || null, null, null); return { ok: true, removed: true }; }
      const d = strictNum(raw); if (!(d >= 0.5 && d <= 3)) throw bad('Type the density in kg per L at 20 °C, from 0.5 to 3.0 (water is 1.0).');
      if (!src) throw bad('Write where the density comes from: a lab report or the supplier certificate.');
      if (dt && (!/^\d{4}-\d{2}-\d{2}$/.test(dt) || isNaN(Date.parse(dt)) || dt > today())) throw bad('The date is not a date up to today.');
      await q('INSERT INTO c2m_density (kind, ref_id, kg_per_l, source, src_date, by_user, at) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE kg_per_l=VALUES(kg_per_l), source=VALUES(source), src_date=VALUES(src_date), by_user=VALUES(by_user), at=VALUES(at)', [kind, id, d, src, dt || null, req.c2m.user, now()]); // 1 statement: 2 first saves at once cannot both insert (review 7c, minor 6)
      await audit(req.c2m.user, 'density', `${kind}:${id}`, 'save', old || null, { kgPerL: d, source: src, date: dt || null }, null);
      return { ok: true, kgPerL: d };
    });
    res.json(out);
  }));
  /** The first time C2M runs after migration 014, it copies every class field and every % already entered (lib.nutrientBackfill). Once:
   *  done when the change record holds its copy row (not when the list has rows, so a nutrient added by hand first never stops it;
   *  review 7a, M2). A nutrient already in the list is reused. If the copy fails it is tried again on the next read, and the QC Head,
   *  the CFO and the COO see that it failed (nutCopyFailed in state). */
  let nutFilled = false, nutFilling = null, nutCopyFailed = null;
  function nutBackfill() {
    if (nutFilled) return Promise.resolve();
    if (!nutFilling) nutFilling = (async () => {
      if (!await has014()) return;
      const done = async () => { const [[a]] = await q("SELECT COUNT(*) n FROM c2m_audit WHERE entity='nutrient' AND action='copy'"); return Number(a.n) > 0; };
      if (await done()) { nutFilled = true; nutCopyFailed = null; return; }
      await tx(async () => {
        const [have] = await q('SELECT id, label FROM c2m_nutrient FOR UPDATE'); if (await done()) return; // copied a moment ago by another request
        const [types] = await q('SELECT id, nutrient_fields, nutrient_role FROM c2m_material_type');
        const [grades] = await q('SELECT g.id, g.nutrients_json json, m.type_id typeId FROM c2m_material_grade g JOIN c2m_raw_material m ON m.id=g.material_id');
        const B = lib.nutrientBackfill(types, grades, have.map(n => n.label));
        const id = new Map(have.map(n => [String(n.label).toLowerCase(), Number(n.id)]));
        for (const l of B.labels) { const [r] = await q('INSERT INTO c2m_nutrient (name, label, basis, measure, hidden, created_by, created_at) VALUES (?,?,?,?,0,?,?)', [l, l, '', 'w/w', 'C2M', now()]); id.set(l.toLowerCase(), r.insertId); }
        for (const r of B.rows) await q('INSERT IGNORE INTO c2m_grade_nutrient (grade_id, nutrient_id, pct, cert, cert_date, by_user, at) VALUES (?,?,?,?,?,?,?)', [r.gradeId, id.get(r.label.toLowerCase()), r.pct, 'Entered before 9 Nov 2026', null, 'C2M', now()]);
        for (const g of B.checked) await q('INSERT IGNORE INTO c2m_grade_check (grade_id, by_user, at) VALUES (?,?,?)', [g, 'C2M', now()]);
        await audit('C2M', 'nutrient', null, 'copy', null, { nutrients: B.labels, fields: B.map, values: B.rows.length, checked: B.checked.length, notCopied: B.skipped.slice(0, 200) },
          `The class fields and the % already entered, copied into the nutrient list once.${B.skipped.length ? ` ${B.skipped.length} value(s) were not made live (a field of an earlier class, or not a %): listed here.` : ''}`);
      });
      nutFilled = true; nutCopyFailed = null;
    })().catch(e => { nutCopyFailed = String(e && e.message || e).slice(0, 200); console.error('[c2m] nutrient copy', nutCopyFailed); }).finally(() => { nutFilling = null; });
    return nutFilling;
  }
  /** R60: the QC Head adds a nutrient alone; C2M stops a second one shown the same way; the CFO is told. */
  app.post('/api/c2m/nutrients', can('nutrient.list'), wrap(async (req, res) => {
    await need014(); await nutBackfill(); // the old fields go in first, so a nutrient typed now joins them (review 7a, M2)
    const out = await tx(async () => {
      const [all] = await q('SELECT label FROM c2m_nutrient FOR UPDATE'); let n;
      try { n = lib.cleanNutrient(req.body || {}, all.map(x => x.label)); } catch (e) { throw bad(e.message); }
      let r; try { [r] = await q('INSERT INTO c2m_nutrient (name, label, basis, measure, hidden, created_by, created_at) VALUES (?,?,?,?,0,?,?)', [n.name, n.label, n.basis, n.measure, req.c2m.user, now()]); }
      catch (e) { if (dupName(e)) throw bad(`${n.label} is already in the nutrient list.`); throw e; }
      await audit(req.c2m.user, 'nutrient', r.insertId, 'create', null, n, null);
      if (req.c2m.role !== 'cfo') await notice('cfo', `${req.c2m.name || req.c2m.user} (${req.c2m.label}) added a nutrient: ${n.label}${n.basis ? ', ' + n.basis : ''}, % ${n.measure}.`, req.c2m.user);
      return { id: r.insertId, ...n };
    });
    res.json(out);
  }));
  /** Change a nutrient's name, "shown as", basis or measure, or hide it (kept for the record, not offered again). A new "shown as"
   *  is written into every class that suggests the old one, so the classes keep pointing at it. */
  app.post('/api/c2m/nutrients/:id', can('nutrient.list'), wrap(async (req, res) => {
    await need014(); const b = req.body || {};
    const out = await tx(async () => {
      const [[o]] = await q('SELECT * FROM c2m_nutrient WHERE id=? FOR UPDATE', [req.params.id]); if (!o) throw bad('This nutrient is no longer in the list. Press Refresh.');
      if (Object.keys(b).every(k => k === 'hidden')) { // hide or show only: the rest is left as it is (review 7a, minor 2)
        await q('UPDATE c2m_nutrient SET hidden=? WHERE id=?', [b.hidden ? 1 : 0, o.id]);
        await audit(req.c2m.user, 'nutrient', o.id, b.hidden ? 'hide' : 'show', { hidden: !!Number(o.hidden) }, { hidden: !!b.hidden }, null);
        return { id: o.id, name: o.name, label: o.label, basis: o.basis, measure: o.measure, hidden: !!b.hidden };
      }
      const [all] = await q('SELECT label FROM c2m_nutrient WHERE id<>?', [o.id]); let n;
      try { n = lib.cleanNutrient({ name: b.name != null ? b.name : o.name, label: b.label != null ? b.label : o.label, basis: b.basis != null ? b.basis : o.basis, measure: b.measure != null ? b.measure : o.measure }, all.map(x => x.label)); } catch (e) { throw bad(e.message); }
      const hidden = b.hidden == null ? !!Number(o.hidden) : !!b.hidden;
      try { await q('UPDATE c2m_nutrient SET name=?, label=?, basis=?, measure=?, hidden=? WHERE id=?', [n.name, n.label, n.basis, n.measure, hidden ? 1 : 0, o.id]); }
      catch (e) { if (dupName(e)) throw bad(`${n.label} is already in the nutrient list.`); throw e; }
      if (n.label !== o.label) {
        const [ts] = await q('SELECT id, nutrient_fields FROM c2m_material_type FOR UPDATE');
        for (const t of ts) { const F = String(t.nutrient_fields || '').split('|').filter(Boolean); if (!F.some(f => lib.fieldLabel(f).toLowerCase() === String(o.label).toLowerCase())) continue;
          await q('UPDATE c2m_material_type SET nutrient_fields=? WHERE id=?', [F.map(f => lib.fieldLabel(f).toLowerCase() === String(o.label).toLowerCase() ? n.label : f).join('|').slice(0, 200), t.id]); }
      }
      await audit(req.c2m.user, 'nutrient', o.id, 'edit', { name: o.name, label: o.label, basis: o.basis, measure: o.measure, hidden: !!Number(o.hidden) }, { ...n, hidden }, null);
      return { id: o.id, ...n, hidden };
    });
    res.json(out);
  }));
  /* Add a material class. Push 7a (R61): a class is a label that suggests nutrients from the list; it locks nothing. The QC Head may add
     one too (nutrient.list), besides the CFO (D-144). Before migration 014 the old form (typed % fields) applies. */
  app.post('/api/c2m/material-types', can('material.save', 'nutrient.list'), wrap(async (req, res) => {
    const b = req.body || {}; let c; const m14 = await has014();
    if (!m14 && !req.c2m.can.has('material.save')) throw Object.assign(new Error(NEED014), { status: 409 });
    if (m14) {
      try { c = lib.newMaterialClass(b.name, b.role, b.role === 'nutrient' ? 'X' : '', []); } catch (e) { throw bad(e.message); } // the name and role only
      c.fields = c.role === 'nutrient' ? await suggestLabels(b.nutrientIds) : [];
    } else {
      const [kt] = await q('SELECT nutrient_fields FROM c2m_material_type');
      const known = [...new Set(kt.flatMap(t => String(t.nutrient_fields || '').split('|').filter(Boolean)))];
      try { c = lib.newMaterialClass(b.name, b.role, b.fields, known); } catch (e) { throw bad(e.message); }
    }
    const id = await tx(async () => {
      const [[ex]] = await q('SELECT id, name FROM c2m_material_type WHERE LOWER(name)=LOWER(?)', [c.name]);
      if (ex) throw bad(`There is already a class called ${ex.name}.`);
      let r; try { [r] = await q('INSERT INTO c2m_material_type (name, nutrient_fields, nutrient_role) VALUES (?,?,?)', [c.name, c.fields.join('|'), c.role]); }
      catch (e) { if (dupName(e)) throw bad(`There is already a class called ${c.name}.`); throw e; } // added at the same moment by someone else
      await audit(req.c2m.user, 'material_type', r.insertId, 'create', null, { name: c.name, role: c.role, fields: c.fields }, b.why ? String(b.why).slice(0, 300) : null);
      return r.insertId;
    });
    res.json({ id, name: c.name, fields: c.fields });
  }));
  /** The nutrients a class suggests, from the list, as their "shown as" names (at most 10). */
  async function suggestLabels(ids) {
    const L = [...new Set([].concat(ids || []).map(Number).filter(n => n > 0))]; if (!L.length) return [];
    if (L.length > 10) throw bad('A class suggests at most 10 nutrients.');
    const [rows] = await q(`SELECT id, label FROM c2m_nutrient WHERE id IN (${L.map(() => '?').join(',')})`, L);
    if (rows.length !== L.length) throw bad('A nutrient picked is no longer in the list. Press Refresh.');
    const out = L.map(i => rows.find(r => Number(r.id) === i).label); if (out.join('|').length > 200) throw bad('The nutrients picked are too long together.');
    return out;
  }
  /** Rename a class or change the nutrients it suggests (push 7a, R61). Whether it carries nutrients is not changed here. */
  app.post('/api/c2m/material-types/:id', can('material.save', 'nutrient.list'), wrap(async (req, res) => {
    await need014(); const b = req.body || {};
    const out = await tx(async () => {
      const [[t]] = await q('SELECT * FROM c2m_material_type WHERE id=? FOR UPDATE', [req.params.id]); if (!t) throw bad('This class is no longer in C2M. Press Refresh.');
      if (t.nutrient_role === 'unclassified') throw bad('To classify is not a class to change.');
      let c; try { c = lib.newMaterialClass(b.name != null ? b.name : t.name, t.nutrient_role, t.nutrient_role === 'nutrient' ? 'X' : '', []); } catch (e) { throw bad(e.message); }
      const fields = t.nutrient_role === 'nutrient' ? (b.nutrientIds != null ? await suggestLabels(b.nutrientIds) : String(t.nutrient_fields || '').split('|').filter(Boolean)) : [];
      const [[ex]] = await q('SELECT id, name FROM c2m_material_type WHERE LOWER(name)=LOWER(?) AND id<>?', [c.name, t.id]); if (ex) throw bad(`There is already a class called ${ex.name}.`);
      try { await q('UPDATE c2m_material_type SET name=?, nutrient_fields=? WHERE id=?', [c.name, fields.join('|'), t.id]); } catch (e) { if (dupName(e)) throw bad(`There is already a class called ${c.name}.`); throw e; }
      await audit(req.c2m.user, 'material_type', t.id, 'edit', { name: t.name, fields: String(t.nutrient_fields || '').split('|').filter(Boolean) }, { name: c.name, fields }, null);
      return { id: t.id, name: c.name, fields };
    });
    res.json(out);
  }));
  /* Nutrient % per grade. Before migration 014: the fields come from the material type (ruled 15 Oct). After it (push 7a, R61): any
     nutrient from the list, each with its certificate and date; saving marks the grade checked, so a nutrient not listed counts as 0. */
  app.post('/api/c2m/grades/:id/nutrients', can('nutrient.edit'), wrap(async (req, res) => {
    if (Array.isArray((req.body || {}).rows)) return saveGradeNutrients(req, res);
    const [[g]] = await q('SELECT g.id, g.nutrients_json, t.nutrient_fields FROM c2m_material_grade g JOIN c2m_raw_material m ON m.id=g.material_id LEFT JOIN c2m_material_type t ON t.id=m.type_id WHERE g.id=?', [req.params.id]);
    if (!g) throw bad('This material grade is no longer in C2M. Press Refresh; if it is still missing, it was deleted.');
    const fields = String(g.nutrient_fields || '').split('|').filter(Boolean), vals = (req.body || {}).values || {}, out = {};
    if (!fields.length) throw bad('This material has no nutrient fields in its class (non-nutrient or to classify). Set a nutrient class first if it carries nutrients.');
    for (const f of fields) if (vals[f] != null && vals[f] !== '') { const v = strictNum(vals[f]); if (!(v >= 0 && v <= 100)) throw bad(`${f}: type a % between 0 and 100.`); out[f] = v; }
    await tx(async () => {
      await q('UPDATE c2m_material_grade SET nutrients_json=? WHERE id=?', [JSON.stringify(out), g.id]);
      await audit(req.c2m.user, 'grade_nutrients', g.id, 'save', g.nutrients_json, out, null);
    });
    res.json({ ok: true });
  }));
  async function saveGradeNutrients(req, res) {
    await need014(); const rows = req.body.rows; const w15 = await m15(); // push 7c: a basis on each value after 015
    const out = await tx(async () => {
      const [[g]] = await q('SELECT g.id, t.nutrient_role FROM c2m_material_grade g JOIN c2m_raw_material m ON m.id=g.material_id LEFT JOIN c2m_material_type t ON t.id=m.type_id WHERE g.id=? FOR UPDATE', [req.params.id]);
      if (!g) throw bad('This material grade is no longer in C2M. Press Refresh; if it is still missing, it was deleted.');
      if (g.nutrient_role !== 'nutrient') throw bad('Pick a class that carries nutrients first (Save class), then enter its nutrients.');
      const [oldRows] = await q('SELECT nutrient_id, pct, cert, cert_date FROM c2m_grade_nutrient WHERE grade_id=?', [g.id]); const had = new Set(oldRows.map(r => Number(r.nutrient_id)));
      const [list] = await q('SELECT id, label, hidden FROM c2m_nutrient'); const N = new Map(list.map(n => [Number(n.id), n]));
      if (!rows.length) throw bad('Add at least 1 nutrient. A material with none is a class that adds no nutrients (binder, filler and the like).');
      if (rows.length > 30) throw bad('At most 30 nutrients for 1 material.');
      const seen = new Set(), clean = [];
      for (const r of rows) {
        const n = N.get(Number(r && r.nutrientId)); if (!n) throw bad('A nutrient picked is no longer in the list. Press Refresh.');
        if (Number(n.hidden) && !had.has(Number(n.id))) throw bad(`${n.label} is hidden in the nutrient list: show it again there first.`);
        if (seen.has(n.id)) throw bad(`${n.label} is listed twice.`); seen.add(n.id);
        const raw = String(r.pct == null ? '' : r.pct).trim(); if (raw === '') throw bad(`Type the % for ${n.label}, or press Remove if the material has none.`);
        const ms = w15 ? (r.measure === 'w/v' ? 'w/v' : 'w/w') : 'w/w'; const v = strictNum(raw); // push 7c: a w/v figure can be above 100 (a dense liquid), a w/w figure cannot
        if (!(v >= 0 && v <= (ms === 'w/v' ? 300 : 100))) throw bad(ms === 'w/v' ? `${n.label}: type a % w/v from 0 to 300 (digits only). A certificate in g per L: divide by 10.` : `${n.label}: type a % w/w between 0 and 100 (digits only).`);
        const cert = String(r.cert || '').replace(/\s+/g, ' ').trim().slice(0, 120); const cd = String(r.certDate || '').trim();
        if (cd && (!/^\d{4}-\d{2}-\d{2}$/.test(cd) || isNaN(Date.parse(cd)) || cd > today())) throw bad(`${n.label}: the certificate date is not a date up to today.`);
        clean.push({ nutrientId: Number(n.id), label: n.label, pct: v, measure: ms, cert: cert || null, certDate: cd || null });
      }
      await q('DELETE FROM c2m_grade_nutrient WHERE grade_id=?', [g.id]);
      for (const r of clean) { if (w15) await q('INSERT INTO c2m_grade_nutrient (grade_id, nutrient_id, pct, measure, cert, cert_date, by_user, at) VALUES (?,?,?,?,?,?,?,?)', [g.id, r.nutrientId, r.pct, r.measure, r.cert, r.certDate, req.c2m.user, now()]); else await q('INSERT INTO c2m_grade_nutrient (grade_id, nutrient_id, pct, cert, cert_date, by_user, at) VALUES (?,?,?,?,?,?,?)', [g.id, r.nutrientId, r.pct, r.cert, r.certDate, req.c2m.user, now()]); }
      await q('DELETE FROM c2m_grade_check WHERE grade_id=?', [g.id]); await q('INSERT INTO c2m_grade_check (grade_id, by_user, at) VALUES (?,?,?)', [g.id, req.c2m.user, now()]);
      await audit(req.c2m.user, 'grade_nutrients', g.id, 'save', oldRows.map(r => ({ nutrientId: Number(r.nutrient_id), pct: Number(r.pct) })), clean.map(r => ({ label: r.label, pct: r.pct, measure: r.measure, cert: r.cert, certDate: r.certDate })), null);
      return { ok: true, rows: clean.length };
    });
    res.json(out);
  }
  /** R62: a product's declared grade, nutrient by nutrient, with the tolerance the QC Head allows below it. Saving replaces the set. */
  app.post('/api/c2m/products/:id/declared', can('grade.declare'), wrap(async (req, res) => {
    await need014(); const rows = (req.body || {}).rows; if (!Array.isArray(rows)) throw bad('Send the declared nutrients.'); const w15pre = await m15();
    const out = await tx(async () => {
      const [[cp]] = await q('SELECT id, brand, sold_per FROM c2m_client_product WHERE id=? FOR UPDATE', [req.params.id]); if (!cp) throw bad('This product is no longer in C2M. Press Refresh.');
      const [list] = await q('SELECT id, label, hidden FROM c2m_nutrient'); const N = new Map(list.map(n => [Number(n.id), n]));
      if (rows.length > 20) throw bad('At most 20 nutrients on a label.');
      const seen = new Set(), clean = [];
      for (const r of rows) {
        const n = N.get(Number(r && r.nutrientId)); if (!n) throw bad('A nutrient picked is no longer in the list. Press Refresh.');
        if (seen.has(n.id)) throw bad(`${n.label} is listed twice.`); seen.add(n.id);
        const ms0 = r.measure === 'w/v' ? 'w/v' : r.measure === 'w/w' ? 'w/w' : (cp.sold_per === 'L' ? 'w/v' : 'w/w'), cap = ms0 === 'w/v' && await m15() ? 300 : 100; // review 7c, minor 3: a w/v label may pass 100
        const p = strictNum(String(r.pct == null ? '' : r.pct).trim()); if (!(p > 0 && p <= cap)) throw bad(`${n.label}: type the % on the label, more than 0 and up to ${cap}.`);
        const tr = String(r.tol == null ? '' : r.tol).trim(); const t = tr === '' ? 0 : strictNum(tr); if (!(t >= 0 && t < p)) throw bad(`${n.label}: the tolerance is the points below the label still taken as meeting it, 0 or more and less than ${p}.`);
        const ms = r.measure === 'w/v' ? 'w/v' : r.measure === 'w/w' ? 'w/w' : (cp.sold_per === 'L' ? 'w/v' : 'w/w'); // push 7c: as the label states it
        clean.push({ nutrientId: Number(n.id), label: n.label, pct: p, tol: t, measure: ms });
      }
      const [old] = await q(w15pre ? 'SELECT nutrient_id, pct, tol, measure FROM c2m_declared_grade WHERE client_product_id=?' : 'SELECT nutrient_id, pct, tol FROM c2m_declared_grade WHERE client_product_id=?', [cp.id]); // the basis it was, in the record (review 7c, minor 9)
      await q('DELETE FROM c2m_declared_grade WHERE client_product_id=?', [cp.id]);
      const w15 = await m15(); for (const r of clean) { if (w15) await q('INSERT INTO c2m_declared_grade (client_product_id, nutrient_id, pct, measure, tol, by_user, at) VALUES (?,?,?,?,?,?,?)', [cp.id, r.nutrientId, r.pct, r.measure, r.tol, req.c2m.user, now()]); else await q('INSERT INTO c2m_declared_grade (client_product_id, nutrient_id, pct, tol, by_user, at) VALUES (?,?,?,?,?,?)', [cp.id, r.nutrientId, r.pct, r.tol, req.c2m.user, now()]); }
      await audit(req.c2m.user, 'declared_grade', cp.id, 'save', old.map(r => ({ nutrientId: Number(r.nutrient_id), pct: Number(r.pct), tol: Number(r.tol), ...(r.measure ? { measure: r.measure } : {}) })), clean.map(r => ({ label: r.label, pct: r.pct, tol: r.tol, measure: r.measure })), null);
      return { ok: true, rows: clean.length };
    });
    res.json(out);
  }));
  /* Material class: nutrient source, or non-nutrient (binder, filler, anti-caking, wetting agent, colour, pH). Ruled 16 Oct.
     Push 7a: a class that adds no nutrients also clears the grade's nutrient rows and check (kept in the change record); a move between
     2 nutrient classes keeps them, all shown on the material card, so nothing is kept out of sight (audit 9 Nov, finding 4f). */
  app.post('/api/c2m/materials/:id/type', can('nutrient.edit'), wrap(async (req, res) => {
    const [[m]] = await q('SELECT id, name, type_id FROM c2m_raw_material WHERE id=?', [req.params.id]); if (!m) throw bad('This material is no longer in C2M. Press Refresh; if it is still missing, it was deleted.');
    const [[t]] = await q('SELECT id, name, nutrient_role FROM c2m_material_type WHERE id=?', [(req.body || {}).typeId]); if (!t) throw bad('Pick the class.');
    const m14 = await has014();
    await tx(async () => {
      await q('UPDATE c2m_raw_material SET type_id=? WHERE id=?', [t.id, m.id]);
      const [old] = await q('SELECT id, grade, nutrients_json FROM c2m_material_grade WHERE material_id=?', [m.id]);
      let rows = null; if (m14 && old.length) [rows] = await q(`SELECT grade_id, nutrient_id, pct FROM c2m_grade_nutrient WHERE grade_id IN (${old.map(() => '?').join(',')})`, old.map(g => g.id));
      if (t.nutrient_role !== 'nutrient') {
        await q('UPDATE c2m_material_grade SET nutrients_json=NULL WHERE material_id=?', [m.id]);
        if (m14 && old.length) { const ids = old.map(g => g.id), ph = ids.map(() => '?').join(','); await q(`DELETE FROM c2m_grade_nutrient WHERE grade_id IN (${ph})`, ids); await q(`DELETE FROM c2m_grade_check WHERE grade_id IN (${ph})`, ids); }
      }
      await audit(req.c2m.user, 'material', m.id, 'class', { typeId: m.type_id, grades: old, nutrientRows: rows || undefined }, { typeId: t.id }, `${m.name}: ${t.name}`);
    });
    res.json({ ok: true });
  }));
  app.post('/api/c2m/customers/:id', can('customer.edit'), wrap(async (req, res) => {
    const { priceRule, cycle, region, o2sNames, printName, name: newName } = req.body || {};
    if (priceRule && !['time', 'po', 'list'].includes(priceRule)) throw bad('Price setting is Time-based, Fixed per PO or Price list: pick 1 of the 3.');
    if (printName != null && typeof printName !== 'string') throw bad('The name on price lists must be text.'); // D-109: the name price lists print; empty = the C2M name
    const nn = newName == null ? null : cleanName(newName, 100, 'client name'); // D-110; 100: a grant holds at most 100 characters
    // Everything validates first, then all writes happen in one transaction on a row read under lock, so a failure or a second rename never leaves a half save.
    await tx(async () => {
      const [all] = await q('SELECT * FROM c2m_customer FOR UPDATE');
      const c = all.find(x => String(x.id) === String(req.params.id)); if (!c) throw bad('This client is no longer in C2M. Press Refresh; if it is still missing, it was deleted.');
      const names = o2sNames == null ? c.o2s_names : String(o2sNames).split('|').map(x => x.trim()).filter(Boolean).join('|');
      if (!names) throw bad('Keep at least 1 O2S name.');
      const rename = nn != null && nn !== c.name;
      if (rename) for (const o of all) { if (o.id === c.id) continue; const theirs = [o.name].concat(String(o.o2s_names).split('|')).map(nmK); if (theirs.includes(nmK(nn))) throw bad(`"${nn}" is already a name of ${o.name}.`); }
      if (rename) {
        try { await q('UPDATE c2m_customer SET name=? WHERE id=?', [nn, c.id]); } catch (e) { if (dupName(e)) throw bad(`A client called "${nn}" is already in C2M.`); throw e; }
        await q("DELETE FROM c2m_list_grant WHERE grant_kind='client' AND grant_value=?", [nn]); // a leftover grant on a name that was no client
        const [g] = await q("UPDATE c2m_list_grant SET grant_value=? WHERE grant_kind='client' AND grant_value=?", [nn, c.name]);
        const [docs] = await q("SELECT id, fields_json FROM c2m_price_doc WHERE audience='wl'");
        let nd = 0; for (const d of docs) { try { const m = JSON.parse(d.fields_json); if (m && m.client === c.name) { m.client = nn; await q('UPDATE c2m_price_doc SET fields_json=? WHERE id=?', [JSON.stringify(m), d.id]); nd++; } } catch (_) { /* leave a document we cannot read */ } }
        await audit(req.c2m.user, 'customer', c.id, 'name', c.name, nn, `Rename: ${g.affectedRows} grant(s) and ${nd} document link(s) moved; printed text of issued documents is unchanged`);
      }
      if (printName != null) {
        const pn = String(printName).replace(/\s+/g, ' ').trim().slice(0, 160);
        try { await q('UPDATE c2m_customer SET print_name=? WHERE id=?', [pn || null, c.id]); } catch (e) { if (e && e.code === 'ER_BAD_FIELD_ERROR') throw Object.assign(new Error('The name on price lists is not switched on yet: IT has 1 step to run. Nothing was saved; try again after IT has run it.'), { status: 409 }); throw e; }
        if ((c.print_name || null) !== (pn || null)) await audit(req.c2m.user, 'customer', c.id, 'print_name', c.print_name || null, pn || null, 'Name on price lists');
      }
      await q('UPDATE c2m_customer SET price_rule=?, price_cycle=?, region=?, o2s_names=? WHERE id=?', [priceRule || c.price_rule, cycle == null ? c.price_cycle : String(cycle).slice(0, 40) || null, region == null ? c.region : String(region).slice(0, 40) || null, names.slice(0, 600), c.id]);
      await audit(req.c2m.user, 'customer', c.id, 'update', { rule: c.price_rule, cycle: c.price_cycle, region: c.region, o2s: c.o2s_names }, { priceRule, cycle, region, o2sNames: names }, null);
    });
    res.json({ ok: true });
  }));
  const save_freight = async (req, res) => {
    const { segment, rsPerKg, validFrom } = req.body || {};
    if (!['Dealer', 'Farmer'].includes(segment)) throw bad('Freight applies to Dealer or Farmer prices.');
    if (!String((req.body || {}).region || '').trim() || !(strictNum(rsPerKg) >= 0)) throw bad('Give the region and Rs per kg (digits).');
    const vf = validFrom || today(); if (!isDate(vf)) throw bad('From must be a date.');
    /* The region is saved in the spelling already in use, so "sindh" matches clients in Sindh (audit 4 Nov 2026, fault A7). */
    { const [cr] = await q("SELECT DISTINCT region FROM c2m_customer WHERE region IS NOT NULL AND region<>''"); const [fr] = await q('SELECT DISTINCT region FROM c2m_freight_rate');
      const cap = x => /^[A-Z]/.test(String(x).trim()) ? 1 : 0; if (!String(req.body.region || '').trim()) throw bad('Pick the region.'); const known = fr.map(x => x.region).find(x => lib.sameRegion(x, req.body.region)) || cr.map(x => x.region).filter(x => lib.sameRegion(x, req.body.region)).sort((a, b) => cap(b) - cap(a))[0]; /* a freight row's spelling first, then a client's with a capital */ if (known) req.body.region = known;
      else throw bad('Pick the region from the list. A new region comes from a client: give the client its region in Setup, Clients first.'); } // R13: region from a list (push 2d); the list is the regions on clients and freight rows
    const region = String(req.body.region).trim().replace(/\s+/g, ' ').slice(0, 40);
    const [[oldF]] = await q('SELECT rs_per_kg FROM c2m_freight_rate WHERE segment=? AND region=? AND valid_from=?', [segment, region, vf]); let re = 0;
    await tx(async () => {
      await q('INSERT INTO c2m_freight_rate (segment, region, rs_per_kg, valid_from) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE rs_per_kg=VALUES(rs_per_kg)', [segment, region, strictNum(rsPerKg), vf]);
      await audit(req.c2m.user, 'freight', `${segment}|${region}`, 'save', oldF ? { rsPerKg: oldF.rs_per_kg, validFrom: vf } : null, { rsPerKg, validFrom: vf }, null);
      // Like every other cost input (D-145): packs of this segment and region whose cost moved past the re-approval % wait for the CFO.
      // A rate dated ahead moves nothing today; freightDueSweep checks it on the day it starts (review 4 Nov).
      const reg = region;
      re = vf > today() ? 0 : await reapprovalFor(`Freight ${segment} ${reg} saved, ${today()}`, freightPacks(segment, reg));
      await costNotice(req.c2m.user, `Freight ${segment} ${reg} saved at Rs ${lib.fmtRs2(strictNum(rsPerKg))} per kg from ${vf} by the ${req.c2m.label}`, re);
    });
    res.json({ ok: true, reapproval: re });
  };
  PEND_FN.freight = save_freight;
  app.post('/api/c2m/freight', can('freight.edit'), wrap(dryable(weekly('freight', save_freight))));
  /* ---------- Labour and FOH, Low and High (Tahir and Yawar, 5 Nov 2026, R17 to R20; push 2c, D-150) ----------
     A rate change or a product's move is in force from the day it is saved (ruled after the review, 5 Nov: "From the day saved").
     Go-live (until 30 Nov 2026): the first figure of a rate and a product's first move need no re-approval; from 1 Dec every
     change and every move goes to re-approval as usual (ruled after the review: "Go-live only"). When the last of the go-live
     rates is filled, each pack's cost that day becomes its approved cost, with no re-approval ("New cost becomes approved"),
     so later changes compare with it. Not in the weekly cycle: reviewed monthly (R15). */
  const KN = { labour: 'Labour', foh: 'FOH' }; const LF_FREE_TILL = '2026-12-01';
  const dWords = d => { const p = String(d).slice(0, 10).split('-'); const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; return p.length === 3 ? `${+p[2]} ${M[+p[1] - 1]} ${p[0]}` : String(d); };
  /** Once, when every named rate has a figure during go-live: each pack's cost today becomes its approved cost (no re-approval). */
  async function lfBaseline(user) {
    const D = await engine.loadAll(q); if (!D.lf) return 0;
    const all = ['labour', 'foh'].every(k => D.lf.names[k].every(n => { const x = engine.lfRateOf(D, k, n, today()); return x && x.rsPerKg > 0; }));
    if (!all) return 0;
    const [[done]] = await q("SELECT id FROM c2m_audit WHERE entity='lf_baseline' LIMIT 1"); if (done) return 0;
    let n = 0;
    for (const p of D.packs) { if (!engine.latestApproved(D, p.id)) continue; const c = engine.packCost(D, p); if (!c || !c.costed) continue;
      await q('INSERT INTO c2m_cost_version (client_pack_id, valid_from, materials, packing, conversion, freight, total, recipe_version_id, cause, approved_by) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [p.id, now(), c.materials, c.packing, c.conversion, c.freight, c.total, c.recipeVersionId, 'Switch to Low and High labour and FOH: cost at go-live, no re-approval (ruled 5 Nov 2026)', user]); n++; }
    await audit(user, 'lf_baseline', 'switch', 'baseline', null, { packs: n }, 'Every pack\'s cost at go-live becomes its approved cost');
    return n;
  }
  const needLf = D => { if (!D.lf) throw Object.assign(new Error('Labour and FOH Low and High is not switched on yet: IT has 1 step to run. Nothing was saved; try again after IT has run it.'), { status: 409 }); };
  app.post('/api/c2m/lf/rate', can('labour.manage'), wrap(dryable(async (req, res) => {
    const b = req.body || {}; const D = await engine.loadAll(q); needLf(D);
    const kind = b.kind; if (!KN[kind]) throw bad('Pick labour or FOH.');
    const name = String(b.name || '').trim().replace(/\s+/g, ' '); if (!/^[A-Za-z0-9 ]{1,40}$/.test(name)) throw bad('Name the rate in a few letters or digits, e.g. Low, High or Average.');
    const rs = strictNum(b.rsPerKg); if (!(rs > 0) || rs > 100000) throw bad('Type the rate in Rs per kg or L, digits above 0.');
    const known = D.lf.names[kind].find(n => n.toLowerCase() === name.toLowerCase()); const nm = known || name; // "low" is the same rate as "Low"
    const T = today(), vf = T; const cur = engine.lfRateOf(D, kind, nm, T); const first = (!cur || cur.rsPerKg == null) && T < LF_FREE_TILL;
    if (cur && cur.rsPerKg === rs) throw bad(`${KN[kind]} rate ${nm} is already Rs ${lib.fmtRs2(rs)}.`);
    const label = `${KN[kind]} rate ${nm}`; let re = 0, base = 0;
    await tx(async () => {
      await q('INSERT INTO c2m_lf_rate (kind, name, rs_per_kg, valid_from, source, set_by, set_at) VALUES (?,?,?,?,?,?,?)', [kind, nm, rs, vf, String(b.source || '').trim().slice(0, 200) || null, req.c2m.user, now()]);
      await audit(req.c2m.user, 'lf_rate', `${kind}:${nm}`, 'save', cur ? { rsPerKg: cur.rsPerKg, validFrom: cur.validFrom } : null, { rsPerKg: rs, validFrom: vf }, b.source || null);
      if (!first && cur && cur.rsPerKg != null) re = await reapprovalFor(`${label} Rs ${lib.fmtRs2(cur.rsPerKg)} to Rs ${lib.fmtRs2(rs)} from ${dWords(vf)}`, (p, D2) => engine.lfPickOf(D2, p.client_product_id, kind) === nm);
      if (first) base = await lfBaseline(req.c2m.user);
      if (first) await notice('coo', `${label} set at Rs ${lib.fmtRs2(rs)} per kg or L from ${dWords(vf)} by the ${req.c2m.label} (go-live: no re-approval).${base ? ` All 4 rates are filled: ${base} pack(s) take their cost today as their approved cost.` : ''}`, req.c2m.user);
      else await costNotice(req.c2m.user, `${label} changed to Rs ${lib.fmtRs2(rs)} per kg or L from ${dWords(vf)} by the ${req.c2m.label}`, re);
    });
    res.json({ ok: true, reapproval: re, first, baseline: base, validFrom: vf });
  })));
  app.post('/api/c2m/lf/pick', can('labour.manage'), wrap(dryable(async (req, res) => {
    const b = req.body || {}; const D = await engine.loadAll(q); needLf(D);
    const kind = b.kind; if (!KN[kind]) throw bad('Pick labour or FOH.');
    const cp = D.cpById.get(Number(b.clientProductId)); if (!cp) throw bad('This product is no longer in C2M, or it is out of use. Press Refresh; to use it again, put it back in use (Setup, Products and variants).');
    if (cp.channel !== 'VAN brand' && (D.custById.get(cp.customer_id) || {}).grp !== 'White label') throw bad('Labour and FOH are picked for white label and VAN brand products.'); // the products C2M costs (D-44)
    const name = String(b.name || '').trim(); if (!D.lf.names[kind].includes(name)) throw bad(`There is no ${KN[kind]} rate named ${name}.`);
    const T = today(), vf = T; const was = engine.lfPickOf(D, cp.id, kind, T); if (was === name) throw bad(`${cp.brand} is already on ${KN[kind]} rate ${name}.`);
    const to = engine.lfRateOf(D, kind, name, T); if (!to || to.rsPerKg == null) throw bad(`Fill ${KN[kind]} rate ${name} first: it has no figure yet.`);
    const first = !D.lf.P.has(cp.id + '|' + kind) && T < LF_FREE_TILL; let re = 0; // free only at go-live (ruled 5 Nov)
    await tx(async () => {
      await q('INSERT INTO c2m_lf_pick (client_product_id, kind, rate_name, valid_from, set_by, set_at) VALUES (?,?,?,?,?,?)', [cp.id, kind, name, vf, req.c2m.user, now()]);
      await audit(req.c2m.user, 'lf_pick', `${cp.id}:${kind}`, 'save', { name: was }, { name, validFrom: vf }, null);
      if (!first) { re = await reapprovalFor(`${cp.brand}: ${KN[kind]} rate ${was} to ${name} from ${dWords(vf)}`, p => Number(p.client_product_id) === cp.id);
        await costNotice(req.c2m.user, `${cp.brand} moved from ${KN[kind]} rate ${was} to ${name} from ${dWords(vf)} by the ${req.c2m.label}`, re); }
    });
    res.json({ ok: true, reapproval: re, first, validFrom: vf });
  })));
  /* Next week's costs: drop a waiting change; Tahir approves an urgent one now, or sends it to Monday (push 2b, D-149). */
  async function pendingRow(id) { if (!(await pendReady())) throw Object.assign(new Error('Next week\'s costs is not switched on yet: IT has 1 step to run. Nothing was saved; try again after IT has run it.'), { status: 409 });
    const [[r]] = await q('SELECT * FROM c2m_cost_pending WHERE id=?', [Number(id)]); if (!r) throw bad('This change is no longer in Next week\'s costs.'); if (r.status !== 'waiting') throw moved(); return r; }
  app.post('/api/c2m/costs/pending/:id/drop', can('rate.save', 'packing.manage', 'freight.edit'), wrap(async (req, res) => {
    const r = await pendingRow(req.params.id);
    const RIGHT = { rate: 'rate.save', packing_rate: 'packing.manage', packing_bill: 'packing.manage', freight: 'freight.edit', packing_assign: 'packing.manage' }; if (!req.c2m.can.has(RIGHT[r.kind])) throw Object.assign(new Error('Your role cannot change this kind of cost.'), { status: 403 }); // review 2b, finding 12
    await tx(async () => { const [u] = await q("UPDATE c2m_cost_pending SET status='dropped', waiting_key=NULL, decided_by=?, decided_at=? WHERE id=? AND status='waiting'", [req.c2m.user, now(), r.id]); if (!u.affectedRows) throw moved();
      await audit(req.c2m.user, 'cost_pending', r.id, 'drop', { label: r.label, next: r.new_value }, null, null); });
    res.json({ ok: true });
  }));
  app.post('/api/c2m/costs/pending/:id/approve', can('price.approve'), wrap(async (req, res) => {
    const r = await pendingRow(req.params.id); if (!r.urgent) throw bad('Only an urgent change waits for approval; this one goes in on Monday.');
    if (String(r.saved_by).toLowerCase() === String(req.c2m.user).toLowerCase()) throw Object.assign(new Error('You saved this change, so another person approves it. It goes in on Monday otherwise.'), { status: 403 }); // review 2b, finding 12
    const a = await applyPending(r, req.c2m.user);
    await audit(req.c2m.user, 'cost_pending', r.id, 'approve_urgent', null, { label: r.label }, r.reason);
    await notice('cfo', `Urgent change approved and in force: ${r.label}.`, req.c2m.user);
    res.json({ ok: true, reapproval: a.reapproval || 0 });
  }));
  app.post('/api/c2m/costs/pending/:id/later', can('price.approve'), wrap(async (req, res) => {
    const r = await pendingRow(req.params.id); if (!r.urgent) throw bad('This change already waits for Monday.');
    await q("UPDATE c2m_cost_pending SET urgent=0 WHERE id=? AND status='waiting'", [r.id]);
    await audit(req.c2m.user, 'cost_pending', r.id, 'not_urgent', null, { label: r.label }, null);
    await notice('cfo', `Not urgent: ${r.label} goes in on Monday ${String(r.apply_on).slice(0, 10)}.`, req.c2m.user);
    res.json({ ok: true });
  }));

  /* ---------- Access grants (Yawar grants lists and clients) ---------- */
  app.post('/api/c2m/grants', can('grants.give'), wrap(async (req, res) => {
    const { username, kind, value, on } = req.body || {};
    if (!['list', 'client'].includes(kind)) throw bad('Unknown grant.');
    const [[person]] = await q("SELECT username FROM user_module_roles WHERE username=? AND module='c2m'", [username]); if (!person) throw bad('This person has no C2M access.');
    if (kind === 'list' && (!PL.AUDIENCES[value] || value === 'mrp')) throw bad(value === 'mrp' ? 'The MRP printing list is for the COO and the CFO only; it is not given to a manager.' : 'Unknown price list.');
    if (kind === 'client') { const [[c]] = await q('SELECT id FROM c2m_customer WHERE name=?', [value]); if (!c) throw bad('Unknown client.'); }
    if (on) await q('INSERT IGNORE INTO c2m_list_grant (username, grant_kind, grant_value, granted_by, granted_at) VALUES (?,?,?,?,?)', [username, kind, value, req.c2m.user, now()]);
    else await q('DELETE FROM c2m_list_grant WHERE username=? AND grant_kind=? AND grant_value=?', [username, kind, value]);
    await audit(req.c2m.user, 'grant', username, on ? 'grant' : 'remove', null, { kind, value }, null);
    res.json({ ok: true });
  }));
  /* Tick all clients, or clear them all, for 1 manager in 1 step (1 line in the change record). */
  app.post('/api/c2m/grants/clients', can('grants.give'), wrap(async (req, res) => {
    const u0 = String((req.body || {}).username || '').trim(), on = !!(req.body || {}).on;
    const [[p]] = await q("SELECT username, role FROM user_module_roles WHERE username=? AND module='c2m'", [u0]);
    if (!p || !isViewerRole((await loadRoles()).get(p.role))) throw bad('This person sees every list already, or has no C2M access.');
    const u = p.username; /* as stored: the page compares it exactly */
    const n = await tx(async () => {
      const [was] = await q("SELECT grant_value FROM c2m_list_grant WHERE username=? AND grant_kind='client'", [u]);
      let now_ = [];
      await q("DELETE FROM c2m_list_grant WHERE username=? AND grant_kind='client'", [u]);
      if (on) {
        const D = await engine.loadAll(q); now_ = D.customers.filter(c => c.grp !== 'VAN brand').map(c => c.name);
        for (const v of now_) await q('INSERT IGNORE INTO c2m_list_grant (username, grant_kind, grant_value, granted_by, granted_at) VALUES (?,?,?,?,?)', [u, 'client', v, req.c2m.user, now()]);
      }
      await audit(req.c2m.user, 'grant', u, on ? 'all clients' : 'no clients', was.map(x => x.grant_value), now_, null);
      return now_.length;
    });
    res.json({ ok: true, clients: n });
  }));
  /* Copy one manager's lists and clients to another (replaces what the second had). Each copy is 1 line in the change record. */
  app.post('/api/c2m/grants/copy', can('grants.give'), wrap(async (req, res) => {
    const from0 = String((req.body || {}).from || '').trim(), to0 = String((req.body || {}).to || '').trim();
    if (!from0 || !to0 || from0.toLowerCase() === to0.toLowerCase()) throw bad('Choose 2 different people.');
    const RR = await loadRoles();
    const viewer = async u => { const [[p]] = await q("SELECT username, role FROM user_module_roles WHERE username=? AND module='c2m'", [u]); return p && isViewerRole(RR.get(p.role)) ? p.username : null; };
    const from = await viewer(from0); if (!from) throw bad('The person to copy from is not a manager given price lists.');
    const to = await viewer(to0); if (!to) throw bad('This person sees every list already, or has no C2M access.');
    const n = await tx(async () => {
      const [g] = await q('SELECT grant_kind, grant_value FROM c2m_list_grant WHERE username=?', [from]);
      const [was] = await q('SELECT grant_kind, grant_value FROM c2m_list_grant WHERE username=?', [to]);
      await q('DELETE FROM c2m_list_grant WHERE username=?', [to]);
      for (const x of g) await q('INSERT INTO c2m_list_grant (username, grant_kind, grant_value, granted_by, granted_at) VALUES (?,?,?,?,?)', [to, x.grant_kind, x.grant_value, req.c2m.user, now()]);
      await audit(req.c2m.user, 'grant', to, 'copy', was.map(x => ({ kind: x.grant_kind, value: x.grant_value })), g.map(x => ({ kind: x.grant_kind, value: x.grant_value })), 'Copied from ' + from);
      return g.length;
    });
    res.json({ ok: true, copied: n });
  }));

  /* ---------- Monthly actuals and checks ---------- */
  app.post('/api/c2m/actuals', can('actuals.enter'), wrap(async (req, res) => {
    const { month, labour, foh } = req.body || {};
    if (!/^\d{4}-\d{2}$/.test(String(month))) throw bad('Pick the month.');
    await refuseLocked(month); /* R9 */
    if (labour == null || foh == null || String(labour).trim() === '' || String(foh).trim() === '' || !(strictNum(labour) >= 0) || !(strictNum(foh) >= 0)) throw bad('Type actual labour and FOH in Rs, digits only. An empty box is not saved as Rs 0 (audit 4 Nov 2026, fault A4).');
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
    if (kind === 'rate_check' && (!mayDo(req, 'actuals.ratecheck') || (!req.c2m.admin && mayDo(req, 'rate.save')))) throw Object.assign(new Error(mayDo(req, 'rate.save') ? 'The rate check is done by a second person, not by the person who entered the rates.' : 'Your role cannot do this in C2M.'), { status: 403 });
    if (kind === 'tie_books' && !mayDo(req, 'actuals.tiebooks')) throw Object.assign(new Error('Your role cannot do this in C2M.'), { status: 403 });
    if (kind === 'lf_cert' && !mayDo(req, 'labour.manage')) throw Object.assign(new Error('Your role cannot do this in C2M.'), { status: 403 }); // monthly labour and FOH certificate (R15, D-150)
    if (!['rate_check', 'tie_books', 'lf_cert'].includes(kind) || !/^\d{4}-\d{2}$/.test(String(month))) throw bad('Pick the month and the check.');
    await refuseLocked(month); /* R9: a locked month's checks do not change */
    /* The checks carry their figures, not just a tick (cost review 18 Oct 2026, D-64): the rate check holds the register rate
       for each material listed; the tie to the books holds ERP sales and COGS beside C2M's own figures for the month. */
    let save = data || null;
    if (kind === 'lf_cert') { if (!data || !['no_change', 'changed'].includes(data.result)) throw bad('Say whether the labour and FOH rates changed: No change, or Changed.');
      if (!(String(month) < today().slice(0, 7))) throw bad('A certificate is for a month that has ended.'); // review 2c, finding 13
      const [[had]] = await q("SELECT done_by FROM c2m_monthly_check WHERE month=? AND kind='lf_cert'", [month]); if (had) throw bad(`${month} is already certified, by ${had.done_by}.`);
      save = { result: data.result }; }
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

  /* ---------- Month end: COO check, lock and reopen (push 4, R8, R9, D-154) ---------- */
  app.post('/api/c2m/monthend/coo-check', wrap(async (req, res) => {
    const { month, seen } = req.body || {}; if (!/^\d{4}-\d{2}$/.test(String(month))) throw bad('Pick the month.');
    if (!req.c2m.admin) throw Object.assign(new Error('The COO check is done by the COO.'), { status: 403 }); /* R8 (review 4, finding 3) */
    if (!(String(month) < today().slice(0, 7))) throw bad('The check is for a month that has ended.');
    await refuseLocked(month);
    const [[rc]] = await q("SELECT id FROM c2m_monthly_check WHERE month=? AND kind='rate_check'", [month]); if (!rc) throw bad('Fill the register rate of the top materials first (the rate check), then mark the changes seen.');
    const ch = await monthChanges(month); const S = new Set((Array.isArray(seen) ? seen : []).map(Number)); const miss = ch.filter(c => !S.has(c.id));
    if (miss.length) throw bad(`Tick every change as seen first: ${miss.length} not ticked.`);
    await tx(async () => {
      await q("INSERT INTO c2m_monthly_check (month, kind, data_json, done_by, done_at) VALUES (?,'coo_check',?,?,?) ON DUPLICATE KEY UPDATE data_json=VALUES(data_json), done_by=VALUES(done_by), done_at=VALUES(done_at)", [month, JSON.stringify({ seen: ch.map(c => c.id) }), req.c2m.user, now()]);
      await audit(req.c2m.user, 'monthly_check', month + ':coo_check', 'done', null, { changes: ch.length }, null);
    });
    res.json({ ok: true, changes: ch.length });
  }));
  app.post('/api/c2m/monthend/lock', wrap(async (req, res) => {
    const { month } = req.body || {}; if (!/^\d{4}-\d{2}$/.test(String(month))) throw bad('Pick the month.');
    if (!req.c2m.admin) throw Object.assign(new Error('Only the COO locks a month.'), { status: 403 });
    if (!(String(month) < today().slice(0, 7))) throw bad('Only a month that has ended can be locked.');
    const [cks] = await q("SELECT kind FROM c2m_monthly_check WHERE month=?", [month]); const has = k => cks.some(c => c.kind === k);
    if (has('lock')) throw bad(`${month} is already locked.`); /* checked again in the transaction below */
    const [[act]] = await q('SELECT actual_labour, actual_foh FROM c2m_monthly_actual WHERE month=?', [month]);
    const need = [!act ? 'actuals' : '', !has('tie_books') ? 'the tie to the books' : '', !has('coo_check') ? 'the COO check' : ''].filter(Boolean);
    if (need.length) throw bad(`Before the lock: ${need.join(', ')}.`);
    const D = await engine.loadAll(q); const match = engine.matcher(D); const [pl0] = await q('SELECT * FROM c2m_o2s_po_line');
    let ab = null; if (await prodReady()) { const [p] = await q('SELECT made_on, base, brand, po, kg FROM c2m_o2s_production WHERE made_on>=? AND made_on<?', [month + '-01', dayAfterMonth(month)]); ab = await absorbedFor(D, month, p, pl0, match); }
    if (ab && ab.noMap) throw bad("O2S's product list could not be read, so stock made for no brand cannot be charged. Try the lock again in a few minutes, or press Pull now first.");
    const F = await monthFigures(month);
    const snap = { sales: Math.round(F.sales), cogs: Math.round(F.cogs), uncosted: Math.round(F.uncosted), focCost: Math.round(F.focCost), kgMade: ab ? ab.kg : null, labourCharged: ab ? ab.labour.total : null, fohCharged: ab ? ab.foh.total : null, notChargedKg: ab ? Math.round(ab.noRateKg) : null, actualLabour: Number(act.actual_labour), actualFoh: Number(act.actual_foh) };
    await tx(async () => {
      const [[a2]] = await q('SELECT actual_labour, actual_foh FROM c2m_monthly_actual WHERE month=? FOR UPDATE', [month]); if (!a2 || Number(a2.actual_labour) !== snap.actualLabour || Number(a2.actual_foh) !== snap.actualFoh) throw moved();
      try { await q("INSERT INTO c2m_monthly_check (month, kind, data_json, done_by, done_at) VALUES (?,'lock',?,?,?)", [month, JSON.stringify(snap), req.c2m.user, now()]); } catch (e) { if (e && e.code === 'ER_DUP_ENTRY') throw bad(`${month} is already locked.`); throw e; } /* 2 presses at once (review 4, finding 10) */
      await audit(req.c2m.user, 'monthly_check', month + ':lock', 'lock', null, snap, null);
    });
    res.json({ ok: true, snap });
  }));
  app.post('/api/c2m/monthend/reopen', wrap(async (req, res) => {
    const { month } = req.body || {}; const why = String((req.body || {}).why || '').trim();
    if (!req.c2m.admin) throw Object.assign(new Error('Only the COO reopens a month.'), { status: 403 });
    if (!/^\d{4}-\d{2}$/.test(String(month))) throw bad('Pick the month.'); if (!why) throw bad('Write why the month is reopened.');
    await tx(async () => {
      const [[L]] = await q("SELECT data_json, done_by, done_at FROM c2m_monthly_check WHERE month=? AND kind='lock' FOR UPDATE", [month]); if (!L) throw bad(`${month} is not locked.`);
      await q("DELETE FROM c2m_monthly_check WHERE month=? AND kind='lock'", [month]);
      await audit(req.c2m.user, 'monthly_check', month + ':lock', 'reopen', L.data_json, null, why.slice(0, 400));
    });
    res.json({ ok: true });
  }));
  /* ---------- Notices ---------- */
  /** Push 7f (D-167): a person marks the notices shown to them as read, up to the newest id; kept per person in the change record. */
  app.post('/api/c2m/notices/read', wrap(async (req, res) => { const up0 = Number((req.body || {}).upto); if (!(Number.isSafeInteger(up0) && up0 > 0)) throw bad('Nothing to mark as read. Press Refresh.');
    const [ns] = await softQ("SELECT new_value FROM c2m_audit WHERE entity='notices_read' AND LOWER(by_user)=LOWER(?) ORDER BY id DESC LIMIT 1", [req.c2m.user]); let was = 0; try { was = Number(JSON.parse((ns && ns[0] && ns[0].new_value) || '{}').upto) || 0; } catch (_) {}
    const up = Math.max(was, up0); if (up > was) await audit(req.c2m.user, 'notices_read', req.c2m.user, 'read', was ? { upto: was } : null, { upto: up }, null); res.json({ ok: true, upto: up }); })); // never goes back (review 7f, 3)
  app.post('/api/c2m/notices/seen', can('notices.see'), wrap(async (req, res) => { await q('UPDATE c2m_notice SET seen=1 WHERE for_role=?', [req.c2m.role]); res.json({ ok: true }); }));

  /* ---------- VAN brand list price revisions: Yawar proposes, Tahir approves or sends back (ruled 16 Oct) ---------- */
  const LIST_FIELDS = { dist: ['now', 'mrp'], dealer: ['nsv', 'disc', 'frp', 'mrp'], farmer: ['pb', 'sn', 'snc'] };
  /** Derived figures (D-72): distributor price with FED = price x (1 + FED %); dealer net = NSV less discount, with FED = net x (1 + FED %). */
  /** The data of a row added by a revision (D-77). The farmer list names each pack in the product column ("Brand 25 kg"),
   * as its loaded rows do and as its price list prints, so the size goes into p there; the other lists keep a pack column. */
  function addedRow(list, it) { const kp = it.keep && it.keep.terms ? { terms: it.keep.terms } : {}; return list === 'farmer' ? { p: `${it.product} ${it.pack}`, packId: it.packId, ...it.to } : { p: it.product, pack: it.pack, packId: it.packId, ...kp, ...it.to, ...(list === 'dist' ? { sentSet: 1, ...(it.keep && it.keep.prev != null ? { prev: it.keep.prev } : {}) } : {}) }; } // keep: terms a row had when it left a list (1.0.3) // dist: never sent before, so no previous price ("new" on the list, D-42; review 1.0.0, finding 3)
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
  app.post('/api/c2m/lists/links', can('lists.link'), wrap(async (req, res) => { // 1.0.2: Tahir links and names too (D-85); the mark stays Yawar's (D-80)
    const links = (req.body || {}).links;
    if (!Array.isArray(links) || !links.length) throw bad('Pick at least 1 row and its pack.');
    if (links.length > 500) throw bad('Save at most 500 links at a time.');
    const whole = v => (typeof v === 'number' && Number.isInteger(v) && v > 0) || (typeof v === 'string' && /^[1-9]\d*$/.test(v)); // ids only: never true, 1.5 or "abc"
    let n = 0;
    const moves = []; // prices moved to another pack, told to the other person after the save
    await tx(async () => {
      await lockNames(); const D = await engine.loadAll(q); const vanPack = new Set(D.packs.filter(k => engine.isVanBrand(D.cpById.get(k.client_product_id))).map(k => Number(k.id))); // names read after the lock, inside the transaction (review 1.0.2, finding 7)
      const master = await masterOn(true); // 1.0.3 (D-87): after the carry-over every row belongs to a master pack
      for (const l of links) {
        if (!l || !whole(l.id)) throw bad('A row is missing.');
        if (l.packId != null && l.packId !== '' && !whole(l.packId)) throw bad('Pick a VAN brand pack: only VAN brand packs can be linked to a list row.');
        const id = Number(l.id), pid = l.packId != null && l.packId !== '' ? Number(l.packId) : null;
        if (pid != null && !vanPack.has(pid)) { const pk0 = D.packs.find(k => Number(k.id) === pid); throw bad(pk0 && !D.cpById.get(pk0.client_product_id) ? 'That pack\'s product is out of use (Setup, Products and variants): pick another pack, or put the product back in use first.' : 'Pick a VAN brand pack: only VAN brand packs can be linked to a list row.'); } // review 1.0.2 re-check 2, A4
        if (l.noPack !== undefined && typeof l.noPack !== 'boolean') throw bad('Mark the row as not a C2M pack, or undo the mark.');
        if (l.noPack === true && pid != null) throw bad('A row linked to a pack cannot also be marked not a C2M pack.');
        const markOp = typeof l.noPack === 'boolean' && !(l.noPack === false && pid != null); // {id, packId, noPack:false} is a link: it takes the mark out (review finding 6)
        if (master && (markOp || pid == null)) throw bad('The lists are carried into the master: every list price belongs to a master pack, so a row cannot be unlinked or marked "not a C2M pack". Move it to the right pack instead.');
        if (markOp && !mayDo(req, 'lists.mark')) throw Object.assign(new Error('Your role cannot mark a row not a C2M pack.'), { status: 403 });
        const [[row]] = await q("SELECT id, list_name, data_json FROM c2m_list_price WHERE id=? AND list_name IN ('dist','dealer','farmer') FOR UPDATE", [id]); if (!row) throw bad('A row is not on any VAN brand list (a row taken off a list is read only).'); // review 1.0.3
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
            if (add) throw bad(`A revision that adds ${add.product} ${add.pack} to this list is with the COO or waits for its date. Undo the mark after it is decided or takes effect.`); }
          if (l.noPack) { delete d.packId; d.noPack = 1; d.noPackBy = req.c2m.user; d.noPackAt = today(); } else { delete d.noPack; delete d.noPackBy; delete d.noPackAt; }
          await q('UPDATE c2m_list_price SET data_json=? WHERE id=?', [JSON.stringify(d), id]);
          await audit(req.c2m.user, 'list_price', String(id), l.noPack ? 'not_c2m_pack' : 'not_c2m_pack_undone', l.noPack ? was : 'not a C2M pack', l.noPack ? 'not a C2M pack' : null, `${row.list_name}: ${d.p}${d.pack ? ' ' + d.pack : ''}`); n++;
          continue;
        }
        if (was === pid) continue;
        if (was != null && pid != null) { /* a move of a row an open revision holds would carry its new prices to another pack: refused, as Take off a list (review 1.0.3 re-check, finding 1) */
          const [pend] = await q("SELECT items_json FROM c2m_list_revision WHERE list_name=? AND (status='proposed' OR (status='approved' AND applied=0))", [row.list_name]);
          if (pend.some(x => JSON.parse(x.items_json).some(it => Number(it.id) === id))) throw bad(`A list revision with the COO, or approved and waiting for its date, changes ${d.p}${d.pack ? ' ' + d.pack : ''}. Move it after the revision is decided or takes effect.`); }
        if (pid != null) { // 1 row per pack on each list (D-77: each VAN pack held once; this replaces the D-73 tolerance of 2 rows on 1 pack, review 19 Oct)
          const [others] = await q('SELECT id, data_json FROM c2m_list_price WHERE list_name=? AND id<>? FOR UPDATE', [row.list_name, id]);
          const finalPack = o => { const later = links.find(x => x && Number(x.id) === Number(o.id) && x.noPack === undefined); return later ? (later.packId == null || later.packId === '' ? null : Number(later.packId)) : Number(JSON.parse(o.data_json).packId); }; // the batch as a whole: 2 rows can swap packs in 1 save (review 1.0.3)
          const dupRow = others.find(o => finalPack(o) === pid);
          if (dupRow) throw bad(`Another row of this list (${JSON.parse(dupRow.data_json).p}${JSON.parse(dupRow.data_json).pack ? ' ' + JSON.parse(dupRow.data_json).pack : ''}) is on that pack: each pack has 1 row on a list. ${master ? 'Move that row to another pack in the same save (to swap the 2), or take it off the list first.' : 'Unlink or change that row first.'}`); }
        if (pid != null) { // a pack waiting to be added to this list by a revision cannot also be linked to a row of it (review 1.0.0, finding 2)
          const [pend] = await q("SELECT items_json FROM c2m_list_revision WHERE list_name=? AND (status='proposed' OR (status='approved' AND applied=0))", [row.list_name]);
          if (pend.some(x => JSON.parse(x.items_json).some(it => it.id == null && it.added && Number(it.packId) === pid))) throw bad(`That pack waits to be added to this list in a revision that is with the COO or approved and waiting for its date. Link the row after it is decided or takes effect, or ask the COO to send it back or withdraw it.`); }
        if (pid != null) { /* a row whose size and unit can be read links only to a pack of that size and unit: the link renames the printed row (review 1.0.2 re-checks; the screens offer only those packs) */
          const z = lib.listRowSize(row.list_name === 'farmer' ? d.p : d.pack), pk = D.packs.find(k => Number(k.id) === pid), c0 = D.cpById.get(pk.client_product_id);
          if (z && (Math.abs(z.v - Number(pk.pack_size)) > 1e-6 || z.u !== (c0.sold_per || 'kg'))) throw bad(`${d.p}${d.pack ? ' ' + d.pack : ''} is written as ${lib.officialPack(z.v, z.u)}; ${c0.brand} ${lib.officialPack(pk.pack_size, c0.sold_per)} is another size or unit. Pick a pack of the same size and unit: the link renames the row on the printed list.`); }
        const hadMark = pid != null && !!d.noPack;
        if (pid == null) delete d.packId; else { d.packId = pid; delete d.noPack; delete d.noPackBy; delete d.noPackAt; } // a link clears the "not a C2M pack" mark (D-80)
        let ren = null; if (pid != null) { const pk = D.packs.find(k => Number(k.id) === pid), c0 = D.cpById.get(pk.client_product_id); ren = lib.officialRow(row.list_name, d, c0.brand, pk.pack_size, c0.sold_per); Object.assign(d, ren.nd); } // a linked row takes the official name (D-85)
        else { const rs = lib.restoreRow(d); if (rs.changed) { for (const kk of Object.keys(d)) delete d[kk]; Object.assign(d, rs.nd); ren = { changed: true, was: rs.was, restored: true }; } } // unlinked: its own name back
        if (master && was != null && pid != null && row.list_name === 'dist') { if (d.prevPack == null) d.prevPack = was; if (Number(d.prevPack) === pid) delete d.prevPack; d.sentSet = 1; } // moved after the carry: the previous price stays, tied to the pack it was for; the list prints "new" while the row sits on another pack, and the price again if it is moved back (review 1.0.3, third check, finding 7)
        await q('UPDATE c2m_list_price SET data_json=?, product=?, pack=? WHERE id=?', [JSON.stringify(d), d.p, d.pack || null, id]);
        if (master && was != null && pid != null) { const pk0 = D.packs.find(k => Number(k.id) === was), c00 = pk0 ? (D.cpById.get(pk0.client_product_id) || {}) : {}; const prc = LIST_FIELDS[row.list_name].filter(f => d[f] != null).map(f => `${f} ${d[f]}`).join(', ');
          moves.push(`${c00.brand || 'pack ' + was} ${pk0 ? lib.officialPack(pk0.pack_size, c00.sold_per) : ''} to ${d.p}${d.pack ? ' ' + d.pack : ''} on the ${LIST_WORD[row.list_name]} list (${priceWords(row.list_name, d)})`); void prc; } // Tahir, 20 Oct 2026: allowed, the other is told
        await audit(req.c2m.user, 'list_price', String(id), 'link', was, pid, `${row.list_name}: ${d.p}${d.pack ? ' ' + d.pack : ''}${hadMark ? ' (mark "not a C2M pack" taken out)' : ''}${ren && ren.changed ? (ren.restored ? ` (its name before the link given back; was "${ren.was}")` : ` (renamed from "${ren.was}")`) : ''}`); n++;
      }
      if (moves.length) { /* inside the transaction: saved with the move or not at all. A notice holds 400 characters, so several moves go in as many notices as they need, each move whole (review 1.0.3, fourth check, finding 4) */
        const who = req.c2m.name || req.c2m.user, head = k => `${who} moved ${moves.length === 1 ? 'a price' : moves.length + ' prices'} to another pack${k}: `, parts = [[]];
        for (const m of moves) { const cur = parts[parts.length - 1]; if (cur.length && (head(' (part 10 of 10)') + cur.concat(m).join('; ')).length > 400) parts.push([m]); else cur.push(m); }
        for (let i = 0; i < parts.length; i++) await notice(req.c2m.role === 'cfo' ? 'coo' : 'cfo', head(parts.length > 1 ? ` (part ${i + 1} of ${parts.length})` : '') + parts[i].join('; '), req.c2m.user); }
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
  app.post('/api/c2m/names/rename-linked', can('lists.link'), wrap(async (req, res) => {
    let n = 0;
    await tx(async () => { await lockNames(); const D = await engine.loadAll(q); n = await renameRows(D, req.c2m.user, D.cps.filter(c => engine.isVanBrand(c)).map(c => c.id), 'official name'); }); // names read inside the transaction (review 1.0.2, finding 7)
    res.json({ changed: n.n, skipped: n.skipped });
  }));
  /** Edit a VAN brand product's official name and its O2S spellings. A new official name renames its list rows too.
   * The page sends the names it showed (was): if someone changed them since, nothing is saved (review 1.0.2, finding 1).
   * preview: true answers with the O2S trucks that would leave or join the product, saving nothing; a save that moves trucks
   * must carry the counts the person saw (accept), so no truck loses its cost unseen (review 1.0.2, finding 2). */
  app.post('/api/c2m/names/product/:id', can('lists.link'), wrap(async (req, res) => {
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
      if (nmK(nb) !== nmK(cp.brand) && lib.listRowSize(nb)) throw bad(`The official name is the trade name only (ruling of 20 Oct 2026): write it with no pack size; the lists add the pack (1 L, 25 kg, 500 ml).`); // a size in the name would be read as the row's size (review 1.0.2 re-check 4, finding 1)
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
        const hit = [nb].concat(list).map(x => ({ x, h: off.find(o => o.names.some(s => nmK(s) === nmK(x))) })).find(y => y.h); if (hit) throw bad(`"${hit.x}" is a name of ${hit.h.brand}, which is out of use and has a pack of the same size: its trucks have no cost on purpose. Put ${hit.h.brand} back in use instead (Setup, Products and variants), if they should be costed.`); }
      if (cp.brand === nb && canon(cp.o2s_brand) === o2s) return { ok: true, changed: 0, rowsRenamed: 0 };
      if (preview) return { preview: true, impact: imp, brand: nb, o2sNames: list };
      if (imp.leave.n || imp.join.n) { const a = accept || {}; if (Number(a.leave) !== imp.leave.n || Number(a.join) !== imp.join.n) throw Object.assign(new Error(`The O2S trucks and open orders this change moves are not what the check before saving showed (now ${imp.leave.n} leave and ${imp.join.n} join). Nothing was saved: reload the page and check again.`), { status: 409 }); }
      const stored = await storeO2s(cp, o2s.split('|'));
      try { await q('UPDATE c2m_client_product SET brand=?, o2s_brand=? WHERE id=?', [nb, stored, cp.id]); }
      catch (e) { if (dupName(e)) throw bad('Another product of the VAN brand owner already has exactly these O2S spellings: change one.'); throw e; }
      const why = imp.leave.n || imp.join.n ? ` (${imp.leave.trucks} O2S trucks, Rs ${lib.fmtInt(imp.leave.rs)}, and ${imp.leave.open} open order lines leave it; ${imp.join.trucks}, Rs ${lib.fmtInt(imp.join.rs)}, and ${imp.join.open} open lines join it)` : '';
      if (cp.brand !== nb) await audit(req.c2m.user, 'product_name', String(cp.id), 'rename', cp.brand, nb, 'Official name' + why);
      if (canon(cp.o2s_brand) !== o2s) await audit(req.c2m.user, 'product_name', String(cp.id), 'o2s_names', canon(cp.o2s_brand), o2s, 'O2S spellings' + (cp.brand !== nb ? '' : why));
      let n = { n: 0, skipped: [] }; if (cp.brand !== nb) { const D2 = await engine.loadAll(q); n = await renameRows(D2, req.c2m.user, [cp.id], `official name changed from "${cp.brand}"`); }
      return { ok: true, changed: 1, rowsRenamed: n.n, rowsSkipped: n.skipped, impact: imp };
    });
    res.json(out);
  }));
  /** Take a VAN brand product out of use, or put it back (Tahir, 20 Oct 2026: "A button in Setup"). Nothing is deleted: the product,
   * its packs, recipes, costs and history stay; out of use it leaves C2M's screens, the grid and the matcher. preview: true answers with
   * the O2S trucks that would lose (or regain) their cost; the save must carry the counts seen. Refused while a list row is linked to its
   * packs, a revision adds one of its packs, or a price for it waits; back in use, refused when its names clash with a product in use. */
  app.post('/api/c2m/names/product/:id/use', can('lists.link'), wrap(async (req, res) => {
    const { inUse, preview, accept } = req.body || {}; if (typeof inUse !== 'boolean') throw bad('Say whether the product goes out of use or back in use.');
    const id = Number(req.params.id);
    const out = await tx(async () => {
      await lockNames(); const D = await engine.loadAll(q);
      const [[cp]] = await q("SELECT * FROM c2m_client_product WHERE id=? AND channel='VAN brand' FOR UPDATE", [id]); if (!cp) throw bad('Pick a VAN brand product.');
      if (!!Number(cp.active) === inUse) return { ok: true, changed: 0 };
      const packIds = D.packs.filter(k => Number(k.client_product_id) === id).map(k => Number(k.id));
      let D2;
      if (!inUse) {
        { const [fl] = await softQ('SELECT p.brand FROM c2m_product_ext e JOIN c2m_client_product p ON p.id=e.client_product_id WHERE e.follows_product_id=? AND p.active=1', [id]); if (fl.length) throw bad(`${cp.brand} is followed by ${fl.slice(0, 3).map(x => x.brand).join(', ')}: they take its recipe. Stop them following it first (their product page).`); }
        const [rows] = await q("SELECT list_name, data_json FROM c2m_list_price WHERE list_name IN ('dist','dealer','farmer')"); const on = rows.map(r => ({ l: r.list_name, d: JSON.parse(r.data_json) })).filter(x => packIds.includes(Number(x.d.packId)));
        if (on.length) throw bad(`${cp.brand} is on ${on.length} price list ${on.length === 1 ? 'row' : 'rows'} (${on.slice(0, 3).map(x => x.d.p + (x.d.pack ? ' ' + x.d.pack : '')).join('; ')}). ${(await masterOn()) ? `Take ${on.length === 1 ? 'it' : 'them'} off the ${on.length === 1 ? 'list' : 'lists'} first (Clients, VAN Brands, Price lists, See all 5 side by side, Take off a list), or move ${on.length === 1 ? 'that price' : 'those prices'} to another pack` : `Take ${on.length === 1 ? 'that row' : 'those rows'} off the list, link ${on.length === 1 ? 'it' : 'them'} to the right pack, or unlink, first`}: a list row cannot point to a product out of use.`);
        const [pend] = await q("SELECT items_json FROM c2m_list_revision WHERE status='proposed' OR (status='approved' AND applied=0)"); if (pend.some(r => JSON.parse(r.items_json).some(it => it.id == null && it.added && packIds.includes(Number(it.packId))))) throw bad(`A list revision adds a pack of ${cp.brand}: take it out of use after the revision is decided or takes effect.`);
        { const [[rv]] = await q("SELECT version_no FROM c2m_recipe_version WHERE client_product_id=? AND state IN ('draft','review','endorse','cost') LIMIT 1", [id]); if (rv) throw bad(`${cp.brand} has recipe version ${rv.version_no} in the workflow (production, QC or cost). Take it out of use once that version is approved: out of use, it could not be approved.`); } // review 1.0.2 re-check 2, A1
        if (packIds.length) { const [[pw]] = await q(`SELECT COUNT(*) n FROM c2m_price WHERE status='proposed' AND client_pack_id IN (${qs(packIds)})`, packIds); if (Number(pw.n)) throw bad(`A price for ${cp.brand} waits for the COO: decide it first.`); }
        D2 = { ...D, cpById: new Map(D.cpById) }; D2.cpById.delete(id);
      } else {
        const clash = nameClash(D, id, namesOf(cp), (await q('SELECT pack_size FROM c2m_client_pack WHERE client_product_id=?', [id]))[0].map(r => Number(r.pack_size))); if (clash) throw bad(`It cannot come back in use as it is: ${clash}`);
        D2 = D; const Dw = { ...D, cpById: new Map(D.cpById) }; Dw.cpById.set(id, cp); /* compare without and with it */ const imp0 = await truckImpact(Dw, D, id); const imp = { leave: imp0.join, join: imp0.leave };
        if (preview) return { preview: true, impact: imp, brand: cp.brand };
        if (imp.join.n && Number((accept || {}).join) !== imp.join.n) throw Object.assign(new Error('The O2S trucks this change moves are not what the check showed. Nothing was saved: reload the page and check again.'), { status: 409 });
        await q('UPDATE c2m_client_product SET active=1 WHERE id=?', [id]);
        await audit(req.c2m.user, 'product_name', String(id), 'in_use', 'out of use', 'in use', `${cp.brand} back in use (Setup, Products and variants): ${imp.join.trucks} O2S trucks, Rs ${lib.fmtInt(imp.join.rs)}, and ${imp.join.open} open order lines, costed under it again`);
        return { ok: true, changed: 1, impact: imp };
      }
      const imp = await truckImpact(D, D2, id);
      if (preview) return { preview: true, impact: imp, brand: cp.brand };
      if (imp.leave.n && Number((accept || {}).leave) !== imp.leave.n) throw Object.assign(new Error('The O2S trucks this change moves are not what the check showed. Nothing was saved: reload the page and check again.'), { status: 409 });
      await q('UPDATE c2m_client_product SET active=0 WHERE id=?', [id]);
      await audit(req.c2m.user, 'product_name', String(id), 'out_of_use', 'in use', 'out of use', `${cp.brand} taken out of use (Setup, Products and variants): ${imp.leave.trucks} O2S trucks, Rs ${lib.fmtInt(imp.leave.rs)}, and ${imp.leave.open} open order lines, lose their cost`);
      return { ok: true, changed: 1, impact: imp };
    });
    res.json(out);
  }));
  /** Settle an O2S name C2M could not place: keep it as a spelling of a VAN brand product that has that pack size, so its trucks are costed at once (C2M never changes O2S). */
  app.post('/api/c2m/names/o2s', can('lists.link'), wrap(async (req, res) => {
    const { name, productId, size } = req.body || {}; if (typeof name !== 'string') throw bad('The O2S name is missing.');
    const nm = nmClean(name); if (!nm) throw bad('The O2S name is missing.'); if (/[|]/.test(nm)) throw bad('A name cannot hold the sign |.');
    const z = Number(size); if (!(z > 0)) throw bad('The O2S pack size is missing: reload and try again.');
    const out = await tx(async () => {
      await lockNames(); const D = await engine.loadAll(q); const cp = D.cpById.get(Number(productId)); if (!cp || !engine.isVanBrand(cp)) throw bad('Pick a VAN brand product.');
      if (!D.packs.some(k => Number(k.client_product_id) === Number(cp.id) && Math.abs(Number(k.pack_size) - z) < 1e-9)) throw bad(`${cp.brand} has no ${z} pack in C2M, so trucks of "${nm}" ${z} could not be costed under it. Pick the product with that pack, or add the pack first.`); // review 1.0.2, design finding 15
      if (namesOf(cp).some(s => nmK(s) === nmK(nm))) return { ok: true, changed: 0 };
      { const [off] = await q("SELECT c.id, c.brand, c.o2s_brand FROM c2m_client_product c JOIN c2m_client_pack k ON k.client_product_id=c.id WHERE c.channel='VAN brand' AND c.active=0 AND ABS(k.pack_size-?)<0.0005", [z]);
        const hit = off.find(c => namesOf(c).some(s => nmK(s) === nmK(nm))); if (hit) throw bad(`"${nm}" is a name of ${hit.brand}, which is out of use: its trucks have no cost on purpose. Put ${hit.brand} back in use instead (Setup, Products and variants), if they should be costed.`); } // review 1.0.2 re-check 2, finding 2
      const o2s = String(cp.o2s_brand).split('|').filter(Boolean).concat(nm).join('|'); if (o2s.length > 120) throw bad(`${cp.brand} already has as many O2S spellings as fit: remove one no longer used (Setup, Products and variants).`);
      const clash = nameClash(D, cp.id, [nm]); if (clash) throw bad(clash);
      const imp = await nameImpact(D, cp.id, cp.brand, o2s);
      try { await q('UPDATE c2m_client_product SET o2s_brand=? WHERE id=?', [await storeO2s(cp, o2s.split('|')), cp.id]); }
      catch (e) { if (dupName(e)) throw bad('Another product of the VAN brand owner already has exactly these O2S spellings: change one.'); throw e; }
      await audit(req.c2m.user, 'product_name', String(cp.id), 'o2s_names', canon(cp.o2s_brand), o2s, `O2S name "${nm}" settled to ${cp.brand}: ${imp.join.trucks} O2S trucks, Rs ${lib.fmtInt(imp.join.rs)}, now costed under it`);
      return { ok: true, changed: 1, impact: imp };
    });
    res.json(out);
  }));
  /* ---------- 1.0.3, 1 master list (Tahir, 20 Oct 2026, D-87) ----------
     "VAN has to have one brand list master identity." Each VAN brand product and pack is held once, in C2M (only products C2M
     costs). The distributor, dealer and farmer lists are its price columns: every list row belongs to a master pack and prints
     under the master's name and pack, in master order (products A to Z, packs small to large), on every list.
     Today's rows are carried into the master once, on 1 screen (C2M carries the prices over once): rows already linked stay;
     C2M matches the rest by name and size, shown to check; the person picks each product C2M cannot match, once for every list
     it is on; 2 rows that would give 1 pack 2 prices on 1 list are chosen between; every row that would leave the printed lists
     is shown first. Rows not carried are kept, read only, under <list>_old (never printed or priced), each in the change record. */
  const MASTER_LISTS = ['dist', 'dealer', 'farmer'];
  const FIELD_WORD = { now: 'price', mrp: 'Recommended MRP', nsv: 'NSV', disc: 'discount', frp: 'FRP', pb: 'Punjab', sn: 'Sindh', snc: 'Sindh credit' };
  const priceWords = (list, o) => (LIST_FIELDS[list] || []).filter(f => o && o[f] != null).map(f => `${FIELD_WORD[f]} ${f === 'disc' ? lib.round(Number(o[f]) * 100, 1) + '%' : 'Rs ' + lib.fmtInt(Number(o[f]))}`).join(', '); // plain words in messages (review 1.0.3, third check)
  const LIST_WORD = { dist: 'distributor', dealer: 'dealer, Sindh', farmer: 'farmer (Punjab, Sindh, Sindh credit and the website)' }; // never the code "dist" in a message (review 1.0.3)
  /** The carry-over, if done: who and when (the change record is the flag: no setting, no table change). */
  async function masterOn(lock) {
    const [[r]] = await q(`SELECT at, by_user FROM c2m_audit WHERE entity='list_master' AND action='carried' ORDER BY id LIMIT 1${lock ? ' LOCK IN SHARE MODE' : ''}`);
    return r ? { at: r.at, by: r.by_user } : null;
  }
  /** Every pack with its product's official name, for printing list rows from the master (products out of use included: a row never points to one, D-86). */
  async function masterPacks() { const [r] = await q('SELECT k.id, k.pack_size, c.brand, c.sold_per, c.spec FROM c2m_client_pack k JOIN c2m_client_product c ON c.id=k.client_product_id'); return new Map(r.map(x => [Number(x.id), { brand: x.brand, size: Number(x.pack_size), soldPer: x.sold_per, spec: x.spec }])); }
  /** The master packs once the lists are carried into the master, else null (the lists print as before until then). */
  async function listMaster() { return (await masterOn()) ? masterPacks() : null; }
  const nz = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9.]+/g, ' ').replace(/\b0+(\d)/g, '$1').trim();
  /** The carry-over plan (pure: it reads, it changes nothing). body: picks {group key: product id | 'none'}, keep {"list|packId": row id},
   * rowPick {row id: pack id | 'leave'}. Returns the groups, the 2-row choices, the rows that leave, the links to save and a signature
   * of them: the carry saves only the plan the person saw (sig). */
  function planCarry(D, rows, body, sentBack) {
    const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
    const picks = { ...obj(body.picks) }, keep = obj(body.keep), rowPick = { ...obj(body.rowPick) };
    const vanCps = D.cps.filter(c => engine.isVanBrand(c));
    const packsOf = new Map(vanCps.map(c => [Number(c.id), D.packs.filter(k => Number(k.client_product_id) === Number(c.id)).sort((a, b) => Number(a.pack_size) - Number(b.pack_size))]));
    const vanPack = new Map(); for (const c of vanCps) for (const k of packsOf.get(Number(c.id))) vanPack.set(Number(k.id), { k, c });
    const fits = (z, k, c) => !!z && Math.abs(z.v - Number(k.pack_size)) < 1e-6 && z.u === (c.sold_per || 'kg');
    const label = pid => { const x = vanPack.get(Number(pid)); return x ? `${x.c.brand} ${lib.officialPack(x.k.pack_size, x.c.sold_per)}` : `pack ${pid}`; };
    const nameOf = (l, d) => `${d.p || ''}${l !== 'farmer' && d.pack ? ' ' + d.pack : ''}`.trim();
    const pricesOf = (l, d) => Object.fromEntries(LIST_FIELDS[l].map(f => [f, d[f] ?? null]));
    const markOf = d => d.noPack ? { by: d.noPackBy || null, at: d.noPackAt || null } : null;
    const R = rows.filter(r => MASTER_LISTS.includes(r.list_name)).map(r => ({ id: Number(r.id), list: r.list_name, d: JSON.parse(r.data_json) }));
    /* a pick that no longer fits (a product taken out of use while the screen was open, a pack of another size) is dropped and named, never a dead end (review 1.0.3) */
    const stale = [];
    /* a row already linked to a pack in use of the size it is written with stays as it is (Tahir's own links, 1.0.2) */
    const fixed = [], open = [];
    for (const r of R) { const z = lib.rowSize(r.list, r.d); const x = r.d.packId != null ? vanPack.get(Number(r.d.packId)) : null;
      if (x && (!z || fits(z, x.k, x.c))) fixed.push({ ...r, pid: Number(r.d.packId) }); else open.push({ ...r, z, hint: x ? Number(x.c.id) : null }); } // linked to a pack of another size, or to a product out of use: carried again
    const G = new Map();
    for (const r of open) { const key = lib.rowNameKey(r.d.p) || 'row ' + r.id; if (!G.has(key)) G.set(key, { key, names: [], lists: [], rows: [] }); const g = G.get(key);
      const nm = String(r.d.p || '').trim(); if (!g.names.includes(nm)) g.names.push(nm); if (!g.lists.includes(r.list)) g.lists.push(r.list); g.rows.push(r); }
    for (const g of G.values()) {
      const sizes = g.rows.map(r => r.z).filter(Boolean);
      const cover = c => sizes.filter(z => packsOf.get(Number(c.id)).some(k => fits(z, k, c))).length;
      const best = cs => { if (cs.length <= 1) return cs[0] || null; const s = cs.map(c => ({ c, n: cover(c) })).sort((a, b) => b.n - a.n); return s[0].n > s[1].n ? s[0].c : null; }; // 2 products under 1 name: the one with the row's packs
      const strict = vanCps.filter(c => namesOf(c).some(n => lib.rowNameKey(n) === g.key));
      const lk = lib.looseKey(g.names[0]); const loose = strict.length || !lk ? [] : vanCps.filter(c => namesOf(c).some(n => lib.looseKey(n) === lk));
      let guess = null; const c0 = best(strict.length ? strict : loose); if (c0) guess = { cpId: Number(c0.id), why: 'same name' };
      if (!guess) { /* the only product with the row's pack size whose spec the list's description holds (as Product names guessed, 1.0.2) */
        const hits = new Set(); let miss = false;
        for (const r of g.rows) { if (!r.z) { miss = true; continue; } const dd = ' ' + nz(r.d.d) + ' '; const h = vanCps.filter(c => c.spec && nz(c.spec) && packsOf.get(Number(c.id)).some(k => fits(r.z, k, c)) && dd.includes(' ' + nz(c.spec) + ' ')); if (h.length === 1) hits.add(Number(h[0].id)); else miss = true; }
        if (hits.size === 1 && !miss) guess = { cpId: [...hits][0], why: 'same spec and size' }; }
      if (!guess && g.rows.every(r => r.hint != null && r.hint === g.rows[0].hint)) guess = { cpId: g.rows[0].hint, why: 'linked before' };
      g.guess = guess; g.family = (strict.length ? strict : loose).map(c => Number(c.id));
      let p = picks[g.key];
      if (p != null && p !== '' && p !== 'none' && !vanCps.some(c => Number(c.id) === Number(p))) { stale.push(`${g.names[0]}: the product picked is no longer a VAN brand product in use`); p = undefined; }
      g.picked = p != null && p !== ''; g.pick = p === 'none' ? 'none' : g.picked ? Number(p) : guess ? guess.cpId : null;
    }
    const target = [];
    for (const g of G.values()) for (const r of g.rows) {
      let rp = rowPick[r.id]; r.pid = null; r.how = null; r.why = null; r.wait = false;
      if (rp != null && rp !== '' && rp !== 'leave') { const x = vanPack.get(Number(rp)); const allowed = g.pick != null && g.pick !== 'none' ? [g.pick].concat(g.family) : [];
        if (!x || (r.z && !fits(r.z, x.k, x.c))) { stale.push(`${nameOf(r.list, r.d)}: the pack picked is not a C2M pack of the size the row is written with`); rp = undefined; }
        else if (!allowed.includes(Number(x.c.id))) { stale.push(`${nameOf(r.list, r.d)}: the pack picked belongs to another product than the one picked for its name`); rp = undefined; } } // a row goes to its name's product (or one of the same name), never to another product (review 1.0.3 re-check)
      if (rp === 'leave') r.why = 'chosen at the carry-over: it leaves the printed lists';
      else if (rp != null && rp !== '') { r.pid = Number(rp); r.how = 'your pick'; }
      else if (g.pick === 'none') r.why = 'not in C2M (chosen at the carry-over): it leaves the printed lists';
      else if (g.pick == null) r.why = 'pick';
      else { const c = D.cpById.get(g.pick); let k = r.z ? packsOf.get(g.pick).find(k => fits(r.z, k, c)) : null, how0 = null;
        if (!r.z) { /* a row written with no size (some farmer rows): the product's only pack, else the 1 pack its rows on the other lists go to; shown to check */
          const ks = packsOf.get(g.pick); const sib = new Set(g.rows.filter(x => x.z).map(x => { const kk = ks.find(k0 => fits(x.z, k0, c)); return kk ? Number(kk.id) : null; }).filter(v => v != null));
          if (ks.length === 1) { k = ks[0]; how0 = 'its only pack'; } else if (sib.size === 1) { k = ks.find(k0 => Number(k0.id) === [...sib][0]); how0 = 'the pack its other rows go to'; } }
        if (k) { r.pid = Number(k.id); r.how = how0 || (g.picked ? 'your pick' : g.guess.why); }
        else { /* the pack of this size under another product of the same name (a separate recipe), only when the product picked is of that name too */
          const fam = r.z && g.family.includes(g.pick) ? g.family.filter(id => id !== g.pick).map(id => ({ c: D.cpById.get(id), k: packsOf.get(id).find(k => fits(r.z, k, D.cpById.get(id))) })).filter(x => x.k) : [];
          if (fam.length === 1) { r.pid = Number(fam[0].k.id); r.how = 'same name, another C2M product with this pack'; }
          else { r.wait = true; r.why = r.z ? `C2M has no ${lib.officialPack(r.z.v, r.z.u)} pack of ${c.brand}: pick its pack, or "Leaves the lists"` : 'its pack size cannot be read from the row: pick its pack, or "Leaves the lists"'; } } } // Tahir, 20 Oct 2026: each row that would leave is chosen, never by default
      if (r.pid != null) target.push(r);
    }
    /* 1 row per pack on each list: 2 rows on 1 pack (rows already linked included, even 2 of them) wait for the person to choose the one kept (review 1.0.3, code finding 1) */
    const slot = new Map(); for (const r of fixed.concat(target)) { const k = r.list + '|' + r.pid; slot.set(k, (slot.get(k) || []).concat(r)); }
    const conflicts = [], losers = new Map(); let unresolved = 0;
    for (const [k, rs] of slot) { if (rs.length < 2) continue; const win = rs.find(r => String(r.id) === String(keep[k])); if (!win) unresolved++; else rs.filter(r => r !== win).forEach(r => losers.set(r.id, `another row of this list was kept for ${label(r.pid)}`));
      conflicts.push({ key: k, list: rs[0].list, packId: rs[0].pid, label: label(rs[0].pid), keep: win ? win.id : null, rows: rs.map(r => ({ id: r.id, name: nameOf(r.list, r.d), linked: fixed.includes(r), mark: markOf(r.d), prices: pricesOf(r.list, r.d) })) }); }
    const links = target.filter(r => !losers.has(r.id)).map(r => { const x = vanPack.get(r.pid); return { id: r.id, list: r.list, pid: r.pid, label: label(r.pid), brand: x.c.brand, size: Number(x.k.pack_size), soldPer: x.c.sold_per }; });
    const leave = R.filter(r => losers.has(r.id)).map(r => ({ id: r.id, list: r.list, name: nameOf(r.list, r.d), why: losers.get(r.id), dup: 1, prices: pricesOf(r.list, r.d) }))
      .concat(open.filter(r => r.pid == null && r.why !== 'pick' && !r.wait).map(r => ({ id: r.id, list: r.list, name: nameOf(r.list, r.d), why: r.why, prices: pricesOf(r.list, r.d) })));
    const undecided = [...G.values()].filter(g => g.pick == null).length, waiting = open.filter(r => r.wait).length;
    /* official names that print on the lists and still carry words in brackets (Tahir, 20 Oct 2026: costing words come out of official names) */
    const usedP = new Set(links.map(x => x.pid).concat(fixed.filter(r => !losers.has(r.id)).map(r => r.pid))); const nameWarn = [...new Set([...usedP].map(pid => vanPack.get(pid)).filter(x => x && /[()]/.test(x.c.brand)).map(x => x.c.brand))];
    const noDesc = [...new Set([...usedP].map(pid => vanPack.get(pid)).filter(x => x && !String(x.c.spec || '').trim()).map(x => x.c.brand))]; // print with no description until one is typed (Tahir, 20 Oct 2026: C2M's description only)
    const sig = require('crypto').createHash('sha1').update(JSON.stringify({ l: links.map(x => [x.id, x.pid]).sort((a, b) => a[0] - b[0]), f: fixed.map(r => [r.id, r.pid]).sort((a, b) => a[0] - b[0]), o: leave.map(x => x.id).sort((a, b) => a - b), s: (sentBack || []).map(r => Number(r.id)).sort((a, b) => a - b) })).digest('hex'); // the rows already linked too (review 1.0.3 re-check, finding 3)
    const groups = [...G.values()].map(g => ({ key: g.key, names: g.names, lists: g.lists, guess: g.guess, pick: g.pick, picked: g.picked, allow: g.pick != null && g.pick !== 'none' ? [...new Set([g.pick].concat(g.family))] : [],
      rows: g.rows.map(r => ({ id: r.id, list: r.list, name: nameOf(r.list, r.d), size: r.z ? lib.officialPack(r.z.v, r.z.u) : null, packId: r.pid, label: r.pid != null ? label(r.pid) : null, how: r.how, why: r.why === 'pick' ? null : r.why, wait: r.wait, rowPick: rowPick[r.id] != null && rowPick[r.id] !== '' && (rowPick[r.id] === 'leave' || r.how === 'your pick') ? String(rowPick[r.id]) : null, kept: !losers.has(r.id), mark: markOf(r.d), prices: pricesOf(r.list, r.d) })) }))
      .sort((a, b) => (a.pick == null || a.rows.some(r => r.wait) ? 0 : 1) - (b.pick == null || b.rows.some(r => r.wait) ? 0 : 1) || (a.picked || !a.guess ? 0 : 1) - (b.picked || !b.guess ? 0 : 1) || a.names[0].localeCompare(b.names[0]));
    const linked = fixed.map(r => ({ id: r.id, list: r.list, name: nameOf(r.list, r.d), packId: r.pid, label: label(r.pid), kept: !losers.has(r.id), prices: pricesOf(r.list, r.d) }));
    const counts = { rows: R.length, linked: fixed.filter(r => !losers.has(r.id)).length, matched: links.filter(x => target.find(t => t.id === x.id).how !== 'your pick').length, picked: links.filter(x => target.find(t => t.id === x.id).how === 'your pick').length, leaving: leave.length, undecided, waiting, unresolved, groups: G.size };
    return { ready: !undecided && !unresolved && !waiting, sig, counts, groups, conflicts, leave, links, linked, stale, nameWarn, noDesc, sentBack: (sentBack || []).map(r => ({ id: r.id, list: r.list_name })) };
  }
  /** The plan as the screen shows it (the links themselves stay on the server). */
  const planOut = P => ({ ready: P.ready, sig: P.sig, counts: P.counts, groups: P.groups, conflicts: P.conflicts, leave: P.leave, linked: P.linked, stale: P.stale, nameWarn: P.nameWarn, noDesc: P.noDesc, sentBack: P.sentBack });
  app.post('/api/c2m/lists/master/preview', can('lists.carry'), wrap(async (req, res) => {
    const on = await masterOn(); if (on) return res.json({ carried: on });
    const D = await engine.loadAll(q); const [rows] = await q("SELECT id, list_name, data_json FROM c2m_list_price WHERE list_name IN ('dist','dealer','farmer') ORDER BY id");
    const [pend] = await q("SELECT DISTINCT list_name FROM c2m_list_revision WHERE status='proposed' OR (status='approved' AND applied=0)");
    const [sb] = await q("SELECT id, list_name FROM c2m_list_revision WHERE status='sent_back' ORDER BY id");
    res.json({ ...planOut(planCarry(D, rows, req.body || {}, sb)), revisions: pend.map(r => r.list_name) });
  }));
  /** Carry today's list rows into the master, once (D-87). Saves only the plan the person saw (sig): if anything changed since, nothing is saved. */
  app.post('/api/c2m/lists/master/carry', can('lists.carry'), wrap(async (req, res) => {
    const b = req.body || {}; if (typeof b.sig !== 'string' || !b.sig) throw bad('The page did not send the plan it showed: reload and try again.');
    const out = await tx(async () => {
      await lockNames(); // names before list rows (lock order)
      const [rows] = await q("SELECT id, list_name, data_json FROM c2m_list_price WHERE list_name IN ('dist','dealer','farmer') ORDER BY id FOR UPDATE");
      if (await masterOn(true)) throw Object.assign(new Error('The lists were carried into the master a moment ago. Reload the page.'), { status: 409 });
      const [pend] = await q("SELECT DISTINCT list_name FROM c2m_list_revision WHERE status='proposed' OR (status='approved' AND applied=0) FOR UPDATE");
      if (pend.length) throw bad(`A revision of the ${pend.map(r => r.list_name).join(', ')} list is with the COO or approved and waiting for its date. Carry the lists into the master once it is decided or takes effect: its rows could leave the lists.`);
      const [sb] = await q("SELECT id, list_name FROM c2m_list_revision WHERE status='sent_back' ORDER BY id FOR UPDATE");
      const D = await engine.loadAll(q); const P = planCarry(D, rows, b, sb);
      if (P.stale.length) throw Object.assign(new Error(`A pick no longer fits: ${P.stale.join('; ')}. Nothing was saved: check the plan again.`), { status: 409 });
      if (!P.ready) throw bad('Pick the product of every name, choose a pack or "Leaves the lists" for every row waiting, and the row kept for every pack with 2 rows on 1 list, first.');
      if (P.sig !== b.sig) throw Object.assign(new Error('The lists or the products changed since the screen showed the plan. Nothing was saved: check the plan again.'), { status: 409 });
      const by = req.c2m.user, day = today(); const byId = new Map(rows.map(r => [Number(r.id), r]));
      for (const L of P.links) { const r = byId.get(L.id); const d = JSON.parse(r.data_json); const was = d.packId != null ? Number(d.packId) : null;
        const mk = d.noPack ? ` (mark "not a C2M pack"${d.noPackBy ? ' by ' + d.noPackBy : ''} taken out)` : ''; d.packId = L.pid; delete d.noPack; delete d.noPackBy; delete d.noPackAt; const ren = lib.officialRow(L.list, d, L.brand, L.size, L.soldPer); Object.assign(d, ren.nd);
        await q('UPDATE c2m_list_price SET data_json=?, product=?, pack=? WHERE id=?', [JSON.stringify(d), d.p, d.pack || null, L.id]);
        await audit(by, 'list_price', String(L.id), 'link', was, L.pid, `${LIST_WORD[L.list]} list: carried into the master as ${L.label}${mk}${ren.changed ? `; was "${ren.was}"` : ''}`.slice(0, 400)); }
      const tsC = now(); for (const lv of P.leave) { const r = byId.get(lv.id); const d = JSON.parse(r.data_json); d.left = { at: day, ts: tsC, by, why: lv.why, ...(lv.dup ? { dup: 1 } : {}) }; // dup: another row was kept for its pack, so it never gives prices to a pack brought back (review 1.0.3, fourth check, finding 1)
        await q('UPDATE c2m_list_price SET list_name=?, data_json=? WHERE id=?', [r.list_name + '_old', JSON.stringify(d), lv.id]);
        await audit(by, 'list_price', String(lv.id), 'left_list', { list: r.list_name, prices: lv.prices }, r.list_name + '_old', `${r.list_name}: ${lv.name} left the printed list at the carry-over into the master: ${lv.why}`.slice(0, 400)); } // the prices kept in the change record too (review 1.0.3, code finding 3)
      /* a revision Tahir sent back is closed: its rows may have moved or left; Yawar types the prices again in the grid (review 1.0.3, workflow finding 12) */
      for (const r of sb) { await q("UPDATE c2m_list_revision SET status='replaced' WHERE id=? AND status='sent_back'", [r.id]); await audit(by, 'list_revision', r.id, 'replaced', 'sent_back', 'replaced', 'Closed at the carry-over into the master: type its prices again in the grid'); }
      if (sb.length) await notice('cfo', `The carry-over into the master closed ${sb.length} list revision(s) the COO had sent back (${sb.map(r => LIST_WORD[r.list_name]).join('; ')}). Their prices are listed under Clients, VAN Brands, Price lists, "Closed at the carry-over": type them again in the grid.`, by); // the prices stay on a screen, not in a capped notice (review 1.0.3, third check, finding 2)
      const D2 = await engine.loadAll(q); const rn = await renameRows(D2, by, D2.cps.filter(c => engine.isVanBrand(c)).map(c => c.id), 'official name, at the carry-over into the master');
      await audit(by, 'list_master', 'lists', 'carried', null, { carried: P.links.length, linked: P.counts.linked, left: P.leave.length }, `Price lists carried into the master: ${P.links.length} rows carried, ${P.counts.linked} already linked, ${P.leave.length} left the printed lists`);
      await notice(req.c2m.role === 'cfo' ? 'coo' : 'cfo', `${req.c2m.name || by} carried the price lists into the master: ${P.links.length} rows carried, ${P.counts.linked} already linked kept, ${P.leave.length} left the printed lists (Clients, VAN Brands, Price lists, Off the lists).`, by); // the other person is told (review 1.0.3, workflow finding 11)
      return { ok: true, carried: P.links.length, linked: P.counts.linked, left: P.leave.length, renamed: rn.n, closed: sb.length };
    });
    res.json(out);
  }));
  /** Take a pack off a list (Tahir, 20 Oct 2026: "Tahir and Yawar both can remove without approval"). The row moves to <list>_old with its
   * prices as they were, who, when and why; it stops printing; logged; the other person is told. Refused while a revision with Tahir, or
   * approved and waiting for its date, holds the row. */
  app.post('/api/c2m/lists/remove', can('lists.remove'), wrap(async (req, res) => {
    const b = req.body || {}; const reqs = Array.isArray(b.rows) ? b.rows : [{ id: b.id, wasPack: b.wasPack }]; // several lists of 1 pack in 1 go (review 1.0.3 re-check, finding 10)
    if (!reqs.length || reqs.length > 3) throw bad('Pick the list or lists to take the pack off.');
    const w = String(b.why == null ? '' : b.why).trim(); if (!w) throw bad('Write why the pack comes off the list (e.g. no longer sold).');
    for (const x of reqs) { const rid = Number(x && x.id); if (!(rid > 0) || !Number.isInteger(rid)) throw bad('A row is missing.'); }
    const out = await tx(async () => {
      await lockNames(); const by = req.c2m.user; const names = [];
      for (const x of reqs) { const rid = Number(x.id);
        const [[row]] = await q("SELECT id, list_name, data_json FROM c2m_list_price WHERE id=? AND list_name IN ('dist','dealer','farmer') FOR UPDATE", [rid]); if (!row) throw Object.assign(new Error('That row is no longer on a list: someone took it off a moment ago. Reload.'), { status: 409 });
        const d = JSON.parse(row.data_json); if (x.wasPack !== undefined && (x.wasPack == null ? null : Number(x.wasPack)) !== (d.packId != null ? Number(d.packId) : null)) throw moved();
        const [pend] = await q("SELECT items_json FROM c2m_list_revision WHERE list_name=? AND (status='proposed' OR (status='approved' AND applied=0)) FOR UPDATE", [row.list_name]);
        if (pend.some(r => JSON.parse(r.items_json).some(it => Number(it.id) === rid))) throw bad(`A list revision with the COO, or approved and waiting for its date, changes this row on the ${LIST_WORD[row.list_name]} list. Take it off after the revision is decided or takes effect.`);
        d.left = { at: today(), ts: now(), by, why: `taken off the list: ${w.slice(0, 200)}` };
        await q('UPDATE c2m_list_price SET list_name=?, data_json=? WHERE id=?', [row.list_name + '_old', JSON.stringify(d), rid]);
        const nm = `${d.p}${row.list_name !== 'farmer' && d.pack ? ' ' + d.pack : ''}`; names.push(`${nm} (${LIST_WORD[row.list_name]})`);
        await audit(by, 'list_price', String(rid), 'left_list', { list: row.list_name, prices: Object.fromEntries(LIST_FIELDS[row.list_name].map(f => [f, d[f] ?? null])) }, row.list_name + '_old', `${LIST_WORD[row.list_name]} list: ${nm} taken off the list: ${w}`.slice(0, 400)); }
      await notice(req.c2m.role === 'cfo' ? 'coo' : 'cfo', `${req.c2m.name || by} took ${names.join('; ')} off the list: ${w.slice(0, 150)}`, by);
      return { ok: true, name: names.join('; '), n: names.length };
    });
    res.json(out);
  }));
  /** The description the price lists print for a VAN brand product: C2M's spec, edited by Tahir or Yawar (Tahir, 20 Oct 2026, D-87). was: the spec the page showed. */
  app.post('/api/c2m/names/product/:id/spec', can('lists.link'), wrap(async (req, res) => {
    const { spec, was } = req.body || {}; if (typeof spec !== 'string' || typeof was !== 'string') throw bad('Write the description; the page must send the one it showed.');
    const s = spec.replace(/\s+/g, ' ').trim(); if (s.length > 200) throw bad('The description can be at most 200 characters.');
    const out = await tx(async () => {
      await lockNames(); const [[cp]] = await q("SELECT id, brand, spec FROM c2m_client_product WHERE id=? AND channel='VAN brand' FOR UPDATE", [Number(req.params.id)]); if (!cp) throw bad('Pick a VAN brand product.');
      if ((cp.spec || '') !== was.replace(/\s+/g, ' ').trim()) throw Object.assign(new Error(`Someone changed the description of ${cp.brand} a moment ago (now: "${cp.spec || ''}"). Nothing was saved.`), { status: 409 });
      if ((cp.spec || '') === s) return { ok: true, changed: 0 };
      await q('UPDATE c2m_client_product SET spec=? WHERE id=?', [s || null, cp.id]);
      await audit(req.c2m.user, 'product_name', String(cp.id), 'spec', cp.spec, s || null, `Description on the price lists: ${cp.brand}`);
      return { ok: true, changed: 1 };
    });
    res.json(out);
  }));
  app.post('/api/c2m/lists/revise', can('list.revise'), wrap(async (req, res) => {
    const { list, items, reason, validTill, replaceId, urgent, urgentWhy: uWhy } = req.body || {}; let { validFrom } = req.body || {};
    if (!LIST_FIELDS[list]) throw bad('Pick the list.');
    if (!String(reason || '').trim()) throw bad('Write the reason for the revision.');
    if (validFrom && !isDate(validFrom)) throw bad('From must be a date.');
    if (validFrom && validFrom < today()) throw bad('The From date cannot be in the past: pick today or a later day.');
    validFrom = cycleFrom(validFrom, !!urgent, uWhy, 'a list revision'); // R33
    if (validTill && (!isDate(validTill) || validTill < validFrom)) throw bad('Till must be after the From date.');
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
    if (D0 && unlinked) throw bad(`${unlinked} ${unlinked === 1 ? 'row' : 'rows'} of this list ${unlinked === 1 ? 'is' : 'are'} not in the master yet. Carry the price lists into the master first (Clients, VAN Brands, Price lists, See all 5 side by side): then every row has its pack and no pack is entered twice.`);
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
        let keep = null; { /* a pack coming back to a list: the prices it left with (discount, FRP, MRP, terms) come back too, shown to Tahir; typed ones win (review 1.0.3 re-check, finding 3) */
          const [old] = await q('SELECT data_json FROM c2m_list_price WHERE list_name=? ORDER BY id DESC', [list + '_old']); const o = old.map(x => JSON.parse(x.data_json)).filter(x => { if (Number(x.packId) !== pid || (x.left && x.left.dup)) return false; const z = lib.rowSize(list, x); return !z || (Math.abs(z.v - Number(pk.pack_size)) < 1e-6 && z.u === (cp.sold_per || 'kg')); })
            .sort((x, y) => String((y.left && (y.left.ts || y.left.at)) || '').localeCompare(String((x.left && (x.left.ts || x.left.at)) || '')))[0]; // only a row that was on this pack, of its size (third check, finding 3); the one that left last, never a row dropped because another was kept for its pack (fourth check, finding 1)
          if (list === 'dist') { const pv = old.map(x => JSON.parse(x.data_json)).filter(x => { if ((x.left && x.left.dup) || x.prev == null || !(Number(x.prevPack) === pid || (x.prevPack == null && Number(x.packId) === pid))) return false; const z = lib.rowSize(list, x); return !z || (Math.abs(z.v - Number(pk.pack_size)) < 1e-6 && z.u === (cp.sold_per || 'kg')); }).sort((x, y) => String((y.left && (y.left.ts || y.left.at)) || '').localeCompare(String((x.left && (x.left.ts || x.left.at)) || '')))[0]; if (pv) keep = { prev: pv.prev }; } // fifth check, finding 2: it comes back as a move keeps it // the price distributors last saw for this pack, also from a row moved off it and then taken off (review 1.0.3, sixth check, finding 6)
          if (o) { const back = []; for (const f of LIST_FIELDS[list]) if (to[f] == null && o[f] != null && Number(o[f]) >= 0) { to[f] = Number(o[f]); back.push(f); } if (list === 'dist' && o.terms) keep = { ...(keep || {}), terms: o.terms }; if (back.length || keep) keep = { ...(keep || {}), back }; } }
        onList.add(pid); out.push({ id: null, packId: pid, ...(keep ? { keep } : {}), product: cp.brand, pack: lib.officialPack(pk.pack_size, cp.sold_per), from: {}, to, added: 1 }); continue; // the pack as C2M writes it (D-85; 500 ml, Tahir 20 Oct 2026)
      }
      const cur = byId.get(Number(it.id)); if (!cur) throw Object.assign(new Error('A row of this revision is no longer on this list (taken off, or left at the carry-over into the master). Reload the page; a revision the COO sent back drops it when opened again.'), { status: 409 });
      if (it.wasPack !== undefined && (it.wasPack == null ? null : Number(it.wasPack)) !== (cur.packId != null ? Number(cur.packId) : null)) { const w0 = it.wasPack == null ? null : await packNameNow(Number(it.wasPack)); throw Object.assign(new Error(`The row you typed for${w0 ? ' (' + w0.product + ' ' + w0.pack + ')' : ''} was moved to another pack a moment ago; it now reads ${cur.p}${cur.pack ? ' ' + cur.pack : ''}. Nothing was sent: cancel, open the form again and type the prices again.`), { status: 409 }); } // named by the pack typed for (review 1.0.3, eighth check); the pack the person saw (review 1.0.3 re-check, finding 1)
      const to = {};
      for (const f of LIST_FIELDS[list]) if (it.values && it.values[f] != null && it.values[f] !== '') { const v = strictNum(it.values[f]); if (!(v >= 0) || (f === 'disc' && v >= 1)) throw bad(`${cur.p}: ${f} must be a number${f === 'disc' ? ' below 1 (e.g. 0.05 for 5%)' : ''}.`); to[f] = v; }
      if (!Object.keys(to).length || LIST_FIELDS[list].every(f => to[f] == null || Number(to[f]) === Number(cur[f]))) continue;
      const from = Object.fromEntries(Object.keys(to).map(f => [f, cur[f] ?? null]));
      out.push({ id: Number(it.id), product: cur.p, pack: cur.pack || null, from, to, packAt: it.wasPack !== undefined ? (it.wasPack == null ? null : Number(it.wasPack)) : (cur.packId != null ? Number(cur.packId) : null) }); // packAt: the pack the price is for; a resend after a move is refused
    }
    if (!out.length) throw bad('No price changed.');
    const id = await tx(async () => {
      await lockNames(); // always first, as Take off a list: names, then list rows, then revisions (review 1.0.3 re-check, finding 4)
      { const ids = out.filter(it => it.id != null).map(it => Number(it.id)); if (ids.length) { const [st0] = await q(`SELECT id, data_json FROM c2m_list_price WHERE list_name=? AND id IN (${qs(ids)}) FOR UPDATE`, [list, ...ids]); const now0 = new Map(st0.map(r => [Number(r.id), JSON.parse(r.data_json)]));
        for (const it of out.filter(x => x.id != null && x.packAt !== undefined)) { const d0 = now0.get(Number(it.id)); if (d0 && (d0.packId != null ? Number(d0.packId) : null) !== it.packAt) { const w0 = it.packAt == null ? null : await packNameNow(it.packAt); throw Object.assign(new Error(`The row you typed for${w0 ? ' (' + w0.product + ' ' + w0.pack + ')' : ''} was moved to another pack a moment ago; it now reads ${d0.p}${d0.pack ? ' ' + d0.pack : ''}. Nothing was sent: cancel, open the form again and type the prices again.`), { status: 409 }); } } } } // checked again with the rows locked: a move at the same moment never takes this price (review 1.0.3, third check, finding 1)
      if (out.some(it => it.added)) { const [cur1] = await q('SELECT data_json FROM c2m_list_price WHERE list_name=? FOR UPDATE', [list]); const on1 = new Set(cur1.map(r => JSON.parse(r.data_json).packId).filter(v => v != null).map(Number)); const hit1 = out.filter(it => it.added && on1.has(Number(it.packId)));
        if (hit1.length) throw Object.assign(new Error(`${hit1.map(it => it.product + ' ' + it.pack).join(', ')} was put on this list a moment ago (a row was moved onto it). Nothing was sent: reload the page; its price now goes on that row.`), { status: 409 }); } // checked again with the rows locked: an added pack never lands on a row moved onto it at the same moment (review 1.0.3, fourth check, finding 5)
      if (out.some(it => it.added)) { for (const it of out.filter(x => x.added)) { const [[c]] = await q('SELECT c.active, c.brand FROM c2m_client_pack k JOIN c2m_client_product c ON c.id=k.client_product_id WHERE k.id=?', [it.packId]); if (!c || !Number(c.active)) throw bad(`${it.product} ${it.pack} is out of use (Setup, Products and variants): it cannot be added to a list.`); } } // review 1.0.2 re-check 2, finding 1
      const [[wait]] = await q("SELECT valid_from FROM c2m_list_revision WHERE list_name=? AND status='approved' AND applied=0 FOR UPDATE", [list]);
      if (wait) throw bad(`A revision of this list is approved and waits for ${String(wait.valid_from).slice(0, 10)}. Ask the COO to withdraw it first, or wait until it takes effect.`);
      const [[open]] = await q("SELECT id FROM c2m_list_revision WHERE list_name=? AND status='proposed' FOR UPDATE", [list]); if (open) throw bad('This list already has a revision waiting for the COO.');
      { const ids = out.filter(it => it.id != null).map(it => Number(it.id)); if (ids.length) { const [still] = await q(`SELECT id FROM c2m_list_price WHERE list_name=? AND id IN (${qs(ids)}) FOR UPDATE`, [list, ...ids]); const on = new Set(still.map(r => Number(r.id))); const gone = out.filter(it => it.id != null && !on.has(Number(it.id)));
        if (gone.length) throw Object.assign(new Error(`${gone.map(it => it.product + (it.pack ? ' ' + it.pack : '')).join(', ')} left this list a moment ago (taken off, or at the carry-over into the master). Nothing was sent: reload the page.`), { status: 409 }); } } // rows read again inside the transaction (review 1.0.3, code finding 2)
      if (replaceId) { const [u] = await q("UPDATE c2m_list_revision SET status='replaced' WHERE id=? AND list_name=? AND status='sent_back'", [replaceId, list]); if (!u.affectedRows) throw moved(); await audit(req.c2m.user, 'list_revision', replaceId, 'replaced', 'sent_back', 'replaced', 'Revised and sent again'); }
      // 1.0.0: a new revision of the list also closes any older sent-back revision of it (review 19 Oct)
      const [oldR] = await q("SELECT id FROM c2m_list_revision WHERE list_name=? AND status='sent_back' FOR UPDATE", [list]);
      for (const o of oldR) { await q("UPDATE c2m_list_revision SET status='replaced' WHERE id=?", [o.id]); await audit(req.c2m.user, 'list_revision', o.id, 'replaced', 'sent_back', 'replaced', 'A newer revision of the same list was sent'); }
      const [r] = await q('INSERT INTO c2m_list_revision (list_name, items_json, reason, valid_from, valid_till, proposed_by, proposed_at) VALUES (?,?,?,?,?,?,?)', [list, JSON.stringify(out), String(reason).slice(0, 400), validFrom, validTill || null, req.c2m.user, now()]);
      await audit(req.c2m.user, 'list_revision', r.insertId, 'propose', null, { list, rows: out.length }, reason);
      if (urgent) await audit(req.c2m.user, 'list_revision', r.insertId, 'urgent', null, null, String(uWhy).trim().slice(0, 400)); // R33
      return r.insertId;
    });
    res.json({ id, rows: out.length });
  }));
  app.post('/api/c2m/lists/revisions/:id/approve', can('list.approve'), wrap(async (req, res) => {
    await tx(async () => {
      await lockNames(); // names before the revision row, as every route that changes names (lock order)
      const [[r]] = await q("SELECT * FROM c2m_list_revision WHERE id=? AND status='proposed' FOR UPDATE", [req.params.id]); if (!r) throw moved(); await notSelf(r.proposed_by, req);
      { const ids = JSON.parse(r.items_json).filter(it => it.id != null).map(it => Number(it.id)); if (ids.length) { const [still] = await q(`SELECT id FROM c2m_list_price WHERE list_name=? AND id IN (${qs(ids)}) FOR UPDATE`, [r.list_name, ...ids]); if (still.length < new Set(ids).size) throw bad('A row of this revision is no longer on the list (taken off, or left at the carry-over into the master): send this revision back to the CFO.'); } } // review 1.0.3, code finding 2
      { const adds = JSON.parse(r.items_json).filter(it => it.id == null && it.added); if (adds.length) { for (const it of adds) { const [[c]] = await q('SELECT c.active FROM c2m_client_pack k JOIN c2m_client_product c ON c.id=k.client_product_id WHERE k.id=?', [it.packId]); if (!c || !Number(c.active)) throw bad(`${it.product} ${it.pack} is out of use now: send this revision back to the CFO.`); } } } // review 1.0.2 re-check 2, finding 1
      /* R33: the list changes on a Monday; one whose Monday passed while it waited takes the next Monday; urgent goes in today. */
      const urg = await urgentWhy('list_revision', r.id), f0 = String(r.valid_from).slice(0, 10) > today() ? String(r.valid_from).slice(0, 10) : today();
      const from = urg ? today() : mondayFrom(f0);
      if (r.valid_till && String(r.valid_till).slice(0, 10) < from) throw bad(`Its Till date (${String(r.valid_till).slice(0, 10)}) is before it would start (${from}). Send it back for new dates.`);
      if (from !== String(r.valid_from).slice(0, 10)) { await q('UPDATE c2m_list_revision SET valid_from=? WHERE id=?', [from, r.id]); r.valid_from = from; }
      const [u] = await q("UPDATE c2m_list_revision SET status='approved', decided_by=?, decided_at=? WHERE id=? AND status='proposed'", [req.c2m.user, now(), r.id]); if (!u.affectedRows) throw moved();
      const waits = from > today() ? from : null;
      if (!waits) await applyRevision(r);
      await audit(req.c2m.user, 'list_revision', r.id, 'approve', null, { list: r.list_name, waitsUntil: waits }, r.reason);
      res.locals.out = { ok: true, waitsUntil: waits };
    });
    res.json(res.locals.out);
  }));
  app.post('/api/c2m/lists/revisions/:id/withdraw', can('list.withdraw'), wrap(async (req, res) => {
    const why = String((req.body || {}).why || '').trim(); if (!why) throw bad('Write why the waiting revision is withdrawn.');
    await tx(async () => {
      const [[r]] = await q("SELECT * FROM c2m_list_revision WHERE id=? AND status='approved' AND applied=0 FOR UPDATE", [req.params.id]); if (!r) throw moved();
      const [u] = await q("UPDATE c2m_list_revision SET status='withdrawn' WHERE id=? AND status='approved' AND applied=0", [r.id]); if (!u.affectedRows) throw moved();
      await audit(req.c2m.user, 'list_revision', r.id, 'withdrawn', null, null, why);
      const [[d]] = await q("SELECT COUNT(*) n FROM c2m_price_doc WHERE audience IN (?,?,?,?,?,?) AND effective>=?", r.list_name === 'dist' ? ['dist', 'dist', 'dist', 'dist', 'dist', 'dist', String(r.valid_from).slice(0, 10)] : r.list_name === 'dealer' ? ['dealer', 'dealer', 'dealer', 'dealer', 'dealer', 'dealer', String(r.valid_from).slice(0, 10)] : ['farmer_pb', 'farmer_sn', 'farmer_snc', 'web', 'web', 'web', String(r.valid_from).slice(0, 10)]);
      await notice('cfo', `The COO withdrew the ${r.list_name} list revision waiting from ${String(r.valid_from).slice(0, 10)}. Why: ${why.slice(0, 150)}${d.n ? `. ${d.n} price list(s) dated on or after it were already issued: tell those who received them.` : ''}`, req.c2m.user);
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
        const [[row]] = await q('SELECT data_json FROM c2m_list_price WHERE id=? AND list_name=? FOR UPDATE', [it.id, r.list_name]); if (!row) continue; // locked: a link or mark made at the same moment is kept, not overwritten (review 1.0.1, finding 4); a row off the list is never priced (review 1.0.3)
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
    for (const r of due) await tx(async () => { if (await applyRevision(r)) await audit('c2m', 'list_revision', r.id, 'applied', null, { list: r.list_name }, 'From date reached'); });
  }
  app.post('/api/c2m/lists/revisions/:id/sendback', can('list.approve'), wrap(async (req, res) => {
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
    const M = await listMaster(); const L = groupLists(lp, null, M, !!M); // the pack goes with each row only once every row has 1 (before the carry-over 2 rows could share a pack: prev stays by name; review 1.0.3)
    const own = L.dates[listKey] || {};
    const base = { ref: b.ref, date: today(), eff: b.eff || (aud === 'wl' ? null : own.issued || L.issued), till: b.till || (aud === 'wl' || aud === 'mrp' ? null : own.till) || null, note: String(b.note || '').slice(0, 300), fedPct: fed }; // the FED % printed stays with the document (D-72)
    if (aud === 'wl') {
      const D = await engine.loadAll(q); const [prices] = await q("SELECT * FROM c2m_price WHERE status='approved'");
      const ap = inForce(prices, b.eff && isDate(b.eff) ? b.eff : today()); // prices in force on the document's own date
      const wl = (await wlListData(D, ap, [b.client]))[b.client]; if (!wl) throw bad('Pick a white label client.');
      // Effective date: Yawar's date if he set one, else the latest start date of this client's approved prices (review M3)
      const last = wl.rows.map(r => String(ap.get(r.packId).valid_from).slice(0, 10)).sort().pop();
      return { ...base, eff: base.eff || last || today(), addressee: (() => { const cu = D.customers.find(c => c.name === b.client); return cu.print_name || cu.name; })(), rule: wl.rule, wl: wl.rows };
    }
    const list = aud === 'dist' ? L.dist : aud === 'dealer' ? L.dealer : L.farmer; // mrp: the farmer list in force on the document's date (D-122)
    return { ...base, list };
  }
  async function viewerMay(user, aud, client) {
    if (aud === 'mrp') return false; // only pricedoc.all makes or opens the MRP printing list (D-122)
    const [g] = await q('SELECT grant_kind, grant_value FROM c2m_list_grant WHERE username=?', [user]);
    if (aud === 'wl') return g.some(x => x.grant_kind === 'client' && x.grant_value === client);
    return g.some(x => x.grant_kind === 'list' && (x.grant_value === aud || (aud === 'web' && x.grant_value === 'farmer_pb')));
  }
  app.post('/api/c2m/pricedocs', wrap(async (req, res) => {
    const b = req.body || {}; const aud = b.audience;
    if (!PL.AUDIENCES[aud]) throw bad('Pick who the list is for.');
    if (!mayDo(req, 'pricedoc.all') && !(mayDo(req, 'pricedoc.granted') && await viewerMay(req.c2m.user, aud, b.client))) throw Object.assign(new Error('This list is not granted to you.'), { status: 403 });
    const allowed = PL.fieldsFor(aud).map(f => f[0]);
    const fields = (Array.isArray(b.fields) ? b.fields : allowed).filter(f => allowed.includes(f)); if (!fields.length) throw bad('Pick at least 1 field.');
    const viewer = !mayDo(req, 'pricedoc.all');
    if (!viewer && b.eff && !isDate(b.eff)) throw bad('From must be a date.');
    if (!viewer && b.till && (!isDate(b.till) || (b.eff && b.till < b.eff))) throw bad('Till must be a date after the From date.');
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
      if (aud === 'dist') { const nmk = x => `${x.p}|${x.pack || ''}`; const byPack = new Map((data.list || []).filter(x => x.packId != null).map(x => ['p' + Number(x.packId), x.now])), byName = new Map((data.list || []).map(x => [nmk(x), x.now])); const printed = { has: k => byPack.has(k) || byName.has(k), get: k => byPack.has(k) ? byPack.get(k) : byName.get(k) }; const pk = d => d.packId != null && byPack.has('p' + Number(d.packId)) ? 'p' + Number(d.packId) : nmk(d); // by master pack after the carry-over (D-87); before it the printed rows carry no pack, so by name as before (review 1.0.3, seventh check, finding 1) // by master pack (D-87): the printed name comes from the master
        const [all] = await q("SELECT id, data_json FROM c2m_list_price WHERE list_name='dist' FOR UPDATE");
        for (const row of all) { const d = JSON.parse(row.data_json); const k = pk(d); if (!printed.has(k) || printed.get(k) == null) continue; d.prev = printed.get(k); d.sentSet = 1; delete d.prevPack; await q('UPDATE c2m_list_price SET data_json=? WHERE id=?', [JSON.stringify(d), row.id]); } 
        /* a pack added by a revision approved and waiting for its date, printed on this list: that price is what distributors now have (review 1.0.3, sixth check, finding 2) */
        const [wr] = await q("SELECT id, items_json FROM c2m_list_revision WHERE list_name='dist' AND status='approved' AND applied=0 FOR UPDATE");
        for (const w of wr) { const its = JSON.parse(w.items_json); let ch = 0; for (const it of its) { if (!(it.id == null && it.added)) continue; const v = printed.get('p' + Number(it.packId)); if (v == null) continue; it.keep = { ...(it.keep || {}), prev: v }; ch = 1; } if (ch) await q('UPDATE c2m_list_revision SET items_json=? WHERE id=?', [JSON.stringify(its), w.id]); } }
      return { id: r.insertId, ref };
    });
    res.json(id);
  }));
  /** The latest issued document of every list (and of every white label client): the Price lists tab downloads these, so a download makes no new number (Tahir, 11 Nov 2026). */
  app.get('/api/c2m/pricedocs/latest', can('pricedoc.all'), wrap(async (req, res) => {
    const [rows] = await q('SELECT id, ref, audience, effective, valid_till, created_by, created_at, fields_json FROM c2m_price_doc ORDER BY id DESC');
    const seen = new Set(), docs = [];
    for (const d of rows) { let client = null; if (d.audience === 'wl') { try { client = JSON.parse(d.fields_json).client || null; } catch (_) {} }
      const k = d.audience + '|' + (client || ''); if (seen.has(k)) continue; seen.add(k);
      docs.push({ id: Number(d.id), ref: d.ref, audience: d.audience, client, effective: d.effective ? String(d.effective).slice(0, 10) : null, till: d.valid_till ? String(d.valid_till).slice(0, 10) : null, by: d.created_by, at: String(d.created_at).slice(0, 19) }); }
    res.json({ docs });
  }));
  app.get('/api/c2m/pricedocs/:id/pdf', wrap(async (req, res) => {
    const [[d]] = await q('SELECT * FROM c2m_price_doc WHERE id=?', [req.params.id]); if (!d) throw bad('This price list document is no longer in C2M. Press Refresh and open it again from the list of documents.');
    const meta = JSON.parse(d.fields_json);
    if (!mayDo(req, 'pricedoc.all') && (d.created_by !== req.c2m.user || !(await viewerMay(req.c2m.user, d.audience, meta.client))))
      throw Object.assign(new Error('This document is not yours, or the list is no longer granted to you.'), { status: 403 });
    // The document prints exactly as issued: the rows were saved with it (older documents rebuild from today's prices).
    const data = meta.snapshot || await docData(d.audience, { client: meta.client, ref: d.ref, eff: String(d.effective).slice(0, 10), till: d.valid_till ? String(d.valid_till).slice(0, 10) : null, note: meta.note });
    PL.pdf(res, d.audience, data, meta.fields, meta.reasons || {});
  }));

  /* ---------- Roles: checks shared with the roles service (the System Administrator designs roles on the launcher, 28 Oct 2026). Logins stay in the platform's People and access. ---------- */
  const roleTable = async () => { try { await q('SELECT 1 FROM c2m_role LIMIT 1'); return true; } catch (e) { if (e && e.code === 'ER_NO_SUCH_TABLE') return false; throw e; } };
  const needTable = async () => { if (!(await roleTable())) throw Object.assign(new Error('Editing roles is not switched on yet: IT has 1 step to run. Nothing was saved; try again after IT has run it.'), { status: 409 }); };
  const cleanActions = (a, admin) => {   // admin: C2M's administrator role (D-89 exempts it from the second-person rate check)
    if (!Array.isArray(a)) throw bad('Tick what this role may do.');
    const set = [...new Set(a.map(String))]; const unknown = set.filter(k => !AC.LABEL[k]); if (unknown.length) throw bad('Unknown action: ' + unknown[0] + '.');
    if (set.includes('roles.manage')) throw bad('Roles are designed by the System Administrator on the launcher.');
    const has = k => set.includes(k);
    if (has('see.margin') && !['see.products', 'see.cost', 'see.price', 'see.settings'].every(has)) throw bad('"The Approvals, Products, Prices, Margin and Setup places" needs Recipes, Costs, Prices and margin, and Settings and targets ticked too.');
    if (has('lists.mark') && !has('lists.link')) throw bad('"Mark a list row as not a C2M pack" needs "Link or rename a list row" ticked too.');
    if (!admin && has('rate.save') && has('actuals.ratecheck')) throw bad('The monthly rate check is done by a second person: a role cannot both save rates and do the rate check.');
    return AC.ALL_KEYS.filter(k => set.includes(k));
  };
  const cleanLabel = l => { const t = String(l || '').trim().replace(/\s+/g, ' '); if (t.length < 2 || t.length > 60) throw bad('Give the role a name of 2 to 60 letters.'); return t; };
  /* The old C2M Roles screen routes (GET/POST /api/c2m/roles, edit, delete) were removed on 4 Nov 2026 (D-145): they needed roles.manage,
     which no role can hold since 28 Oct 2026. Roles are designed by the System Administrator on the launcher, through the roles service above. */

  /* ---------- Change record, in plain words, with filters (D-125) ----------
     Read only. Each entry gets the name of what changed (product, pack, client, material, packing item, setting) in place of its number. */
  const AUDIT_KIND = {
    recipes: ['recipe', 'grade_nutrients', 'material', 'material_type', 'nutrient', 'declared_grade', 'density'],
    costs: ['recipe:cost_approved', 'client_pack:cost_approved', 'client_product:cost_approved', 'reapproval', 'rate', 'packing_bill', 'packing_item', 'packing_rate', 'conversion_rule', 'freight', 'monthly_actual', 'monthly_check', 'first_cost_sweep', 'import_item', 'client_pack:packing_bill'],
    prices: ['price', 'list_revision', 'list_price', 'list_master', 'price_doc', 'target', 'target_request'],
    products: ['client_product', 'client_pack', 'customer', 'product_family', 'product_variant', 'product_name'],
    settings: ['setting', 'setting_request', 'role', 'sync', 'grant'],
  };
  const has0 = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const auditKindOf = a => { for (const [k, L] of Object.entries(AUDIT_KIND)) if (L.includes(a.entity + ':' + a.action)) return k;
    for (const [k, L] of Object.entries(AUDIT_KIND)) if (L.includes(a.entity)) return k; return 'settings'; };
  /** SQL for 1 kind: its entities, less the entity:action pairs filed under another kind, plus its own pairs. */
  const auditKindSql = kind => { const L = AUDIT_KIND[kind], P = [];
    const ents = L.filter(x => !x.includes(':')), mine = L.filter(x => x.includes(':')), others = Object.entries(AUDIT_KIND).filter(([k]) => k !== kind).flatMap(([, v]) => v.filter(x => x.includes(':')));
    const parts = [];
    if (ents.length) { const ex = others.filter(x => ents.includes(x.split(':')[0])); parts.push(`(entity IN (${ents.map(() => '?').join(',')})${ex.map(() => ' AND NOT (entity=? AND action=?)').join('')})`); P.push(...ents); ex.forEach(x => P.push(...x.split(':'))); }
    mine.forEach(x => { parts.push('(entity=? AND action=?)'); P.push(...x.split(':')); });
    if (kind === 'settings') { const all = Object.values(AUDIT_KIND).flat().filter(x => !x.includes(':')); parts.push(`entity NOT IN (${all.map(() => '?').join(',')})`); P.push(...all); } // anything not filed elsewhere
    return { sql: '(' + parts.join(' OR ') + ')', P }; };
  const AUD_THING = { product_name: 'Product name', client_product: 'Product', client_pack: 'Pack', customer: 'Client', price: 'Price', recipe: 'Recipe', reapproval: 'Re-approval', rate: 'Material rate', packing_bill: 'Packing bill', packing_item: 'Packing item', packing_rate: 'Packing rate', product_family: 'Product', product_variant: 'Variant', setting: 'Setting', setting_request: 'Setting change', sync: 'O2S data', target: 'Target GP', target_request: 'Target GP change', first_cost_sweep: 'Packs with no approved cost', saved_report: 'Saved report', list_revision: 'List revision', list_price: 'List row', list_master: 'Price lists', price_doc: 'Price list PDF', material: 'Material', grade_nutrients: 'Nutrients', density: 'Density', nutrient: 'Nutrient list', declared_grade: 'Declared grade', material_type: 'Material class', conversion_rule: 'Labour and FOH rate', freight: 'Freight', monthly_actual: 'Monthly actuals', monthly_check: 'Monthly check', grant: 'List access', role: 'Role', import_item: 'Sheet item', signoff: 'Role page', notices_read: 'Notices' };
  const AUD_DID = { add: 'added', create: 'created', save: 'saved', edit: 'changed', update: 'changed', change: 'changed', remove: 'removed', delete: 'deleted', propose: 'proposed', approve: 'approved', sent_back: 'sent back', withdrawn: 'withdrawn', 'taken back': 'taken back', cancelled: 'cancelled', ended: 'ended', replaced: 'replaced', 'end restored': 'end date restored', request: 'requested', refuse: 'refused', dismiss: 'dismissed', pull: 'pulled', run: 'put on Approvals', cost_approved: 'cost approved', endorsed: 'endorsed', reviewed: 'reviewed', sent: 'sent on', new: 'new version started', lines: 'lines changed', packing_bill: 'packing bill changed', add_variant: 'variant added', follow: 'set to follow a product', type: 'product type changed', variant: 'variant tagged', group: 'group changed', name: 'name changed', print_name: 'printed name changed', class: 'class set', retire: 'taken out of use', copy: 'copied', grant: 'given', link: 'linked', rename: 'renamed', left_list: 'left the list', applied: 'in force', carried: 'carried into the master', done: 'done', reprocessed: 'reprocessed flag changed', 'in use': 'back in use', 'out of use': 'out of use', in_use: 'back in use', out_of_use: 'out of use', 'all clients': 'all clients given', 'no clients': 'no clients', 'FED changed': 'FED changed', 'cost moved since shown': 'cost moved since shown', 'left: not costed': 'left: not costed', 'left: within threshold': 'left: within the threshold', spelling: 'O2S spelling kept', spec: 'description changed', o2s_names: 'O2S spellings changed', not_c2m_pack: 'marked not a C2M pack', unlink: 'unlinked', imported: 'imported', accept: 'accepted', reject: 'rejected', signed: 'read and signed', read: 'marked as read' };
  const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const isoWords = t => String(t == null ? '' : t).replace(/\b(20\d\d)-(\d\d)-(\d\d)\b/g, (m, y, mo, d) => `${+d} ${MON3[+mo - 1]} ${y}`);
  const audWhy = t => isoWords(String(t || '').replace(/\s*\((?:D-\d+[^)]*|ruling[^)]*|review[^)]*|R\d+[^)]*)\)/gi, '').replace(/\s*\bD-\d+\b,?/g, '').replace(/\s{2,}/g, ' ').trim());
  const AUDIT_CAP = 5000;
  /* ---------- Reports (push 5a, R28, R30, R51, D-157): read only, for the roles that see margin (Reports is theirs) ---------- */
  /** Cost history (R51, pack cost only): every approved cost of every pack, with its parts and the same pack's cost before it. */
  app.get('/api/c2m/reports/costs', can('see.margin'), wrap(async (req, res) => {
    const [rows] = await q(`SELECT v.id, v.client_pack_id, v.valid_from, v.materials, v.packing, v.conversion, v.freight, v.total, v.cause, v.approved_by, k.pack_size, k.client_product_id, c.brand, c.channel, c.sold_per, u.name AS customer
      FROM c2m_cost_version v LEFT JOIN c2m_client_pack k ON k.id=v.client_pack_id LEFT JOIN c2m_client_product c ON c.id=k.client_product_id LEFT JOIN c2m_customer u ON u.id=c.customer_id ORDER BY v.client_pack_id, v.valid_from, v.id`);
    const last = new Map(); const N = v => (v == null ? null : Number(v));
    const out = rows.map(r => { const pid = Number(r.client_pack_id); const p = last.get(pid) || null; last.set(pid, r);
      return { id: Number(r.id), packId: pid, productId: r.client_product_id == null ? null : Number(r.client_product_id), cust: r.channel === 'VAN brand' ? 'VAN brand' : (r.customer || 'Client not known'), brand: r.brand || 'Product no longer in C2M', ch: r.channel || null,
        size: N(r.pack_size), soldPer: r.sold_per === 'L' ? 'L' : 'kg', from: String(r.valid_from).slice(0, 19), materials: N(r.materials), packing: N(r.packing), conversion: N(r.conversion), freight: N(r.freight), total: N(r.total),
        cause: r.cause || '', by: r.approved_by || '', prev: p ? N(p.total) : null, prevFrom: p ? String(p.valid_from).slice(0, 19) : null }; });
    res.json({ rows: out });
  }));
  /** VAN list price history: every approved price on the 5 lists, from the first data load (c2m_list_price, its issued date) through every
   *  approved revision (items_json: each item's from and to values). A list never revised starts on its rows' issued date; a list revised
   *  since (each applied revision moves issued) starts on the first list date, PC.FIRST_LIST. */
  const LH_COLS = { dist: ['now'], dealer: ['nsv'], farmer: ['pb', 'sn', 'snc'] };
  function listHistory(lp, revs, first0) {
    const day = v => (v == null ? '' : String(v).slice(0, 10)); const num = v => (v == null || v === '' || !isFinite(Number(v)) ? null : Number(v));
    const dayBefore = d => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() - 1); return t.toISOString().slice(0, 10); };
    const out = []; let firstAll = null;
    for (const L of Object.keys(LH_COLS)) {
      const R = revs.filter(r => r.list_name === L).map(r => { let items = []; try { items = JSON.parse(r.items_json) || []; } catch (_) {} return { ...r, items: Array.isArray(items) ? items : [], from: day(r.valid_from), till: day(r.valid_till) || null }; })
        .sort((a, b) => a.from.localeCompare(b.from) || Number(a.id) - Number(b.id));
      const rows = []; for (const x of lp) { const m = /^(dist|dealer|farmer)(_old)?$/.exec(x.list_name); if (!m || m[1] !== L) continue; let d; try { d = JSON.parse(x.data_json); } catch (_) { continue; } if (!d || (d.left && d.left.dup)) continue; rows.push({ id: Number(x.id), d, old: !!m[2], issued: day(x.issued) }); }
      const firstL = R.some(r => Number(r.applied)) ? first0 : (rows.filter(w => !w.old).map(w => w.issued).filter(Boolean).sort()[0] || first0);
      if (rows.length && (!firstAll || firstL < firstAll)) firstAll = firstL;
      R.forEach(r => r.items.forEach(it => { if (it && it.id == null && it.added && it.packId != null && !rows.some(w => Number(w.d.packId) === Number(it.packId))) rows.push({ id: null, d: { p: it.product || '', pack: it.pack || '', packId: it.packId }, virt: true }); })); // approved for a later date, not on the list yet
      for (const w of rows) for (const f of LH_COLS[L]) {
        const ev = []; for (const r of R) for (const it of r.items) { if (!it || !it.to || !(f in it.to)) continue; const mine = it.id != null ? Number(it.id) === w.id : !!it.added && w.d.packId != null && Number(it.packId) === Number(w.d.packId); if (!mine) continue;
          ev.push({ from: r.from, endAt: r.till, v: num(it.to[f]), was: it.from ? num(it.from[f]) : null, added: it.id == null, reason: r.reason || '', by: r.decided_by || '', at: r.decided_at ? String(r.decided_at).slice(0, 19) : null }); }
        const segs = []; const v0 = ev.length ? (ev[0].added ? null : ev[0].was) : num(w.d[f]);
        if (v0 != null && !w.virt) segs.push({ from: firstL, v: v0, first: true });
        ev.forEach(e => { if (e.v == null) return; segs.push({ ...e, was: segs.length ? segs[segs.length - 1].v : e.was }); });
        const left = w.d.left ? day(w.d.left.ts || w.d.left.at) || null : null;
        segs.forEach((g, i) => { const nx = segs[i + 1]; let till = nx ? dayBefore(nx.from) : left; /* a revision's Till is not used: the price check keeps a list price until the next one (rowsOnDate), so the history does too (review 5a, finding 5) */ if (till && till < g.from) return; // replaced on its own first day
          out.push({ list: L === 'farmer' ? 'farmer_' + f : L, product: String(w.d.p || ''), pack: String(w.d.pack || ''), packId: w.d.packId != null ? Number(w.d.packId) : null, from: g.from, till: till || null, price: g.v, was: g.first ? null : g.was,
            reason: g.first ? null : g.reason, by: g.first ? null : g.by, at: g.first ? null : g.at, first: !!g.first, off: !!w.old }); });
      }
    }
    return { first: firstAll || first0, rows: out };
  }
  app.get('/api/c2m/reports/prices', can('see.margin'), wrap(async (req, res) => {
    const [lp] = await q('SELECT id, list_name, data_json, issued, valid_till FROM c2m_list_price ORDER BY id');
    let revs = []; try { [revs] = await q("SELECT id, list_name, items_json, reason, valid_from, valid_till, decided_by, decided_at, applied FROM c2m_list_revision WHERE status='approved' ORDER BY valid_from, id"); } catch (e) { console.error('[c2m] price history: list revisions not read: ' + (e.code || e.message)); }
    res.json(listHistory(lp, revs, PC.FIRST_LIST));
  }));
  /* ---------- Your own report (push 5b, R52 to R54, D-158): 2 more data sets and saved reports ---------- */
  /** Rates (R53): every change to a material rate, a packing item rate, a labour or FOH rate (Low and High, and the rates before them)
   *  and a freight rate: in force from, kind, item, was, now, change, source and who. Read only. */
  app.get('/api/c2m/reports/rates', can('see.margin'), wrap(async (req, res) => {
    const N = v => (v == null || v === '' || !isFinite(Number(v)) ? null : Number(v)); const day = v => (v == null ? '' : String(v).slice(0, 10)); const out = [];
    /** 1 item's changes, oldest first: each row's was is the same item's rate before it. */
    const chain = (rows, keyOf, mk) => { const last = new Map(); for (const r of rows) { const k = keyOf(r), now1 = mk.now(r); if (now1 == null) continue; const was = last.has(k) ? last.get(k) : null; last.set(k, now1);
      out.push({ kind: mk.kind(r), item: mk.item(r), unit: mk.unit(r), from: day(mk.from(r)), was, now: now1, chg: was ? Math.round((now1 - was) / was * 10000) / 100 : null, source: mk.source(r) || '', by: mk.by(r) || '', at: mk.at(r) ? String(mk.at(r)).slice(0, 19) : null }); } };
    const [mr] = mayDo(req, 'see.materials') ? await q('SELECT r.id, r.grade_id, r.rate, r.rate_date, r.source, r.entered_by, r.entered_at, g.grade, m.name, m.unit FROM c2m_material_rate r JOIN c2m_material_grade g ON g.id=r.grade_id JOIN c2m_raw_material m ON m.id=g.material_id ORDER BY r.grade_id, r.rate_date, r.id') : [[]]; /* raw material rates only for roles that see them (review 5b, finding 4) */
    chain(mr, r => r.grade_id, { kind: () => 'material', item: r => `${r.name}${r.grade ? ' · ' + r.grade : ''}`, unit: r => 'Rs per ' + (r.unit === 'L' ? 'L' : 'kg'), from: r => r.rate_date, now: r => N(r.rate), source: r => r.source, by: r => r.entered_by, at: r => r.entered_at });
    const [pr] = await q('SELECT r.id, r.packing_item_id, r.price_per_piece, r.rate_date, r.source, r.entered_by, r.entered_at, i.name FROM c2m_packing_rate r JOIN c2m_packing_item i ON i.id=r.packing_item_id ORDER BY r.packing_item_id, r.rate_date, r.id');
    chain(pr, r => r.packing_item_id, { kind: () => 'packing', item: r => r.name, unit: () => 'Rs per piece', from: r => r.rate_date, now: r => N(r.price_per_piece), source: r => r.source, by: r => r.entered_by, at: r => r.entered_at });
    const [cr] = await q('SELECT id, name, kind, rs_per_kg, valid_from, source FROM c2m_conversion_rule ORDER BY kind, name, valid_from, id'); /* the rates before Low and High, kept in the record */
    chain(cr, r => r.kind + '|' + r.name, { kind: r => (r.kind === 'labour' ? 'labour' : 'foh'), item: r => `${r.name} (before Low and High)`, unit: () => 'Rs per kg or L', from: r => r.valid_from, now: r => N(r.rs_per_kg), source: r => r.source, by: () => '', at: () => null });
    const [lr] = await softQ('SELECT id, kind, name, rs_per_kg, valid_from, source, set_by, set_at FROM c2m_lf_rate ORDER BY kind, name, valid_from, id'); /* migration 011; [] before it */
    chain(lr, r => r.kind + '|' + r.name, { kind: r => (r.kind === 'labour' ? 'labour' : 'foh'), item: r => `${r.kind === 'labour' ? 'Labour' : 'FOH'} rate ${r.name}`, unit: () => 'Rs per kg or L', from: r => r.valid_from, now: r => N(r.rs_per_kg), source: r => r.source, by: r => r.set_by, at: r => r.set_at });
    const [fr] = await q('SELECT id, segment, region, rs_per_kg, valid_from FROM c2m_freight_rate ORDER BY segment, region, valid_from, id');
    const [fa] = await q("SELECT entity_id, by_user, at, new_value FROM c2m_audit WHERE entity='freight' AND action='save' ORDER BY id"); const fwho = new Map();
    for (const a of fa) { let v = null; try { v = JSON.parse(a.new_value || 'null'); } catch (_) {} if (v && v.validFrom) fwho.set(a.entity_id + '|' + day(v.validFrom), { by: a.by_user, at: a.at }); } /* the freight table keeps no name: the change record does */
    chain(fr, r => r.segment + '|' + r.region, { kind: () => 'freight', item: r => `${r.segment} · ${r.region}`, unit: () => 'Rs per kg', from: r => r.valid_from, now: r => N(r.rs_per_kg), source: () => '', by: r => (fwho.get(r.segment + '|' + r.region + '|' + day(r.valid_from)) || {}).by, at: r => (fwho.get(r.segment + '|' + r.region + '|' + day(r.valid_from)) || {}).at });
    out.sort((a, b) => b.from.localeCompare(a.from) || a.kind.localeCompare(b.kind) || a.item.localeCompare(b.item));
    res.json({ rows: out });
  }));
  /** Kg made (R53): each O2S production entry with the labour and FOH charged on it, worked out by Month end's own absorbedFor,
   *  so the totals for a month are Month end's. from and till: days (both kept); none = every entry. */
  const dayAfter = d => { const t = new Date(String(d).slice(0, 10) + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + 1); return t.toISOString().slice(0, 10); };
  app.get('/api/c2m/reports/made', can('see.margin'), wrap(async (req, res) => {
    if (!(await prodReady())) return res.json({ ready: false, message: 'Kg made is not switched on yet: IT has 1 step to run. Until then kg made cannot be read from O2S.', rows: [], months: {} });
    const Q = req.query || {}; const from = isDate(Q.from) ? String(Q.from) : '', till = isDate(Q.till) ? String(Q.till) : '';
    const [prod] = await q('SELECT made_on, base, brand, po, kg FROM c2m_o2s_production WHERE made_on>=? AND made_on<?', [from || '1900-01-01', till ? dayAfter(till) : '9999-12-31']);
    const D = await engine.loadAll(q); const match = engine.matcher(D); const [pl0] = await q('SELECT * FROM c2m_o2s_po_line');
    const C = { rows: [] }; const months = {}; const ms = [...new Set(prod.map(r => String(r.made_on).slice(0, 7)))].sort(); let noMap = false;
    const byM = new Map(); for (const r of prod) { const k = String(r.made_on).slice(0, 7); if (!byM.has(k)) byM.set(k, []); byM.get(k).push(r); } /* each month reads only its own entries (review 5b, finding 5) */
    for (const m of ms) { const A = await absorbedFor(D, m, byM.get(m), pl0, match, C); if (A.noMap) noMap = true; months[m] = { kg: A.kg, labour: A.labour.total, foh: A.foh.total, noRateKg: A.noRateKg }; }
    res.json({ ready: true, from, till, noMap, months, rows: C.rows.sort((a, b) => a.made.localeCompare(b.made)) });
  }));
  /** Saved reports (R54): kept for the person who made it; only they see, open, rename or delete it. Migration 013. */
  const SAVED = { has: false };
  async function savedReady() { if (SAVED.has) return true; try { const [t] = await q("SHOW TABLES LIKE 'c2m_saved_report'"); SAVED.has = t.length > 0; } catch (_) { return false; } return SAVED.has; } /* once there, it stays; until then it is asked again each time */
  const NEED013 = 'Saving a report is not switched on yet: IT has 1 step to run. The report itself works; it cannot be kept until then.';
  const need013 = async () => { if (!(await savedReady())) throw Object.assign(new Error(NEED013), { status: 409, need: 13 }); };
  const SETS = ['sales', 'open', 'costs', 'wlp', 'vanp', 'rates', 'made'];
  const savedRow = r => { let spec = null; try { spec = JSON.parse(r.spec_json); } catch (_) {} return { id: Number(r.id), name: r.name, spec, created: r.created_at ? String(r.created_at).slice(0, 19) : null, updated: r.updated_at ? String(r.updated_at).slice(0, 19) : null }; };
  async function savedOf(user) { if (!(await savedReady())) return { ready: false, message: NEED013, rows: [] }; const [rows] = await q('SELECT id, name, spec_json, created_at, updated_at FROM c2m_saved_report WHERE owner=? ORDER BY updated_at DESC, id DESC', [user]); return { ready: true, rows: rows.map(savedRow) }; }
  const nameOf = v => { const n = String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); if (!n) throw bad('Name the report.'); if (n.length > 120) throw bad('Keep the name to 120 letters or fewer.'); return n; };
  /** The report's recipe: what it shows, never its figures. Under 20 KB, and it must read back as a report of 1 of the 7 data sets. */
  function specOf(v) {
    let o = v; if (typeof v === 'string') { if (Buffer.byteLength(v, 'utf8') > 20000) throw bad('This report is too large to keep (over 20 KB).'); try { o = JSON.parse(v); } catch (_) { throw bad('The report could not be read, so it was not saved.'); } }
    if (!o || typeof o !== 'object' || Array.isArray(o)) throw bad('The report could not be read, so it was not saved.');
    const t = JSON.stringify(o); if (Buffer.byteLength(t, 'utf8') > 20000) throw bad('This report is too large to keep (over 20 KB).');
    if (!SETS.includes(o.set)) throw bad('The report has no data set C2M knows.'); if (!Array.isArray(o.cols) || !o.cols.length || o.cols.some(c => typeof c !== 'string')) throw bad('The report has no columns.');
    return t;
  }
  app.get('/api/c2m/reports/saved', can('see.margin'), wrap(async (req, res) => { res.json(await savedOf(req.c2m.user)); }));
  app.post('/api/c2m/reports/saved', can('see.margin'), wrap(async (req, res) => {
    await need013(); const b = req.body || {}; const name = nameOf(b.name), spec = specOf(b.spec), user = req.c2m.user;
    const [[old]] = await q('SELECT id, name, spec_json FROM c2m_saved_report WHERE owner=? AND name=?', [user, name]); let id;
    if (old) { if (b.overwrite !== true) throw Object.assign(new Error(`You already have a report called "${old.name}". Press Save over it to replace it, or type another name.`), { status: 409 });
      const was = { name: String(old.name), spec: old.spec_json }; id = Number(old.id);
      await q('UPDATE c2m_saved_report SET name=?, spec_json=?, updated_at=? WHERE id=? AND owner=?', [name, spec, now(), id, user]); /* takes the name as typed now, capitals included (review 5b, finding 3) */
      await audit(user, 'saved_report', id, 'save', was, { name, spec }, 'Saved over'); }
    else { const [[cnt]] = await q('SELECT COUNT(*) AS n FROM c2m_saved_report WHERE owner=?', [user]); if (Number(cnt && cnt.n) >= 50) throw bad('You have 50 saved reports, the most C2M keeps for 1 person. Delete one you no longer use, then save again.'); /* keeps the state call light (review 5b, finding 5) */
      try { const [r] = await q('INSERT INTO c2m_saved_report (owner, name, spec_json, created_at, updated_at) VALUES (?,?,?,?,?)', [user, name, spec, now(), now()]); id = Number(r.insertId); }
      catch (e) { if (e && e.code === 'ER_DUP_ENTRY') throw Object.assign(new Error(`You already have a report called "${name}". Press Save over it to replace it, or type another name.`), { status: 409 }); throw e; } /* 2 saves at once */
      await audit(user, 'saved_report', id, 'save', null, { name, spec }, null); }
    res.json({ ok: true, id, ...(await savedOf(user)) });
  }));
  /** 1 saved report of this person; another person's is "not found" (never shown, renamed or deleted). */
  const mySaved = async (req) => { const id = Number(req.params.id); if (!(id > 0)) throw bad('Pick a saved report.'); const [[r]] = await q('SELECT id, name, spec_json FROM c2m_saved_report WHERE id=? AND owner=?', [id, req.c2m.user]); if (!r) throw Object.assign(new Error('That saved report is not yours, or it is no longer there.'), { status: 404 }); return r; };
  app.post('/api/c2m/reports/saved/:id/rename', can('see.margin'), wrap(async (req, res) => {
    await need013(); const r = await mySaved(req); const name = nameOf((req.body || {}).name), user = req.c2m.user, was = String(r.name);
    if (name === was) throw bad('That is its name already.');
    const [[clash]] = await q('SELECT id FROM c2m_saved_report WHERE owner=? AND name=? AND id<>?', [user, name, r.id]); if (clash) throw Object.assign(new Error(`You already have a report called "${name}". Pick another name.`), { status: 409 });
    try { await q('UPDATE c2m_saved_report SET name=?, updated_at=? WHERE id=? AND owner=?', [name, now(), r.id, user]); } catch (e) { if (e && e.code === 'ER_DUP_ENTRY') throw Object.assign(new Error(`You already have a report called "${name}". Pick another name.`), { status: 409 }); throw e; }
    await audit(user, 'saved_report', r.id, 'rename', { name: was }, { name }, null);
    res.json({ ok: true, ...(await savedOf(user)) });
  }));
  app.post('/api/c2m/reports/saved/:id/delete', can('see.margin'), wrap(async (req, res) => {
    await need013(); const r = await mySaved(req); const user = req.c2m.user, old = { name: String(r.name), spec: r.spec_json };
    await q('DELETE FROM c2m_saved_report WHERE id=? AND owner=?', [r.id, user]);
    await audit(user, 'saved_report', r.id, 'delete', old, null, null);
    res.json({ ok: true, ...(await savedOf(user)) });
  }));
  app.get('/api/c2m/audit', can('see.margin'), wrap(async (req, res) => {
    const Q = req.query || {}; const dt = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null;
    const from = dt(Q.from), to = dt(Q.to), who = String(Q.who || '').trim().slice(0, 64), kind = has0(AUDIT_KIND, String(Q.kind || '')) ? String(Q.kind) : '', text = String(Q.q || '').trim().slice(0, 80);
    const W = ["entity <> 'notices_read'"], P = []; // a notice marked read is not a change (review 7f, 4)
    if (from) { W.push('at >= ?'); P.push(from + ' 00:00:00'); } if (to) { W.push('at <= ?'); P.push(to + ' 23:59:59'); }
    if (who) { W.push('by_user = ?'); P.push(who); }
    if (kind) { const k = auditKindSql(kind); W.push(k.sql); P.push(...k.P); }
    const [rows] = await q(`SELECT id, at, by_user, entity, entity_id, action, why FROM c2m_audit WHERE ${W.join(' AND ')} ORDER BY id DESC LIMIT ${AUDIT_CAP}`, P);
    const capped = rows.length === AUDIT_CAP;
    const D = await engine.loadAll(q); const soft = async (sql, a) => { try { return (await q(sql, a))[0]; } catch (_) { return []; } };
    // names of every client product, in use or not (review r4, finding 10)
    const cpAll = new Map((await soft('SELECT id, brand, customer_id, channel FROM c2m_client_product')).map(x => [Number(x.id), x]));
    const cpName = id => { const cp = cpAll.get(Number(id)) || D.cpById.get(Number(id)); if (!cp) return null; const cu = D.custById.get(cp.customer_id); return `${cp.brand}${cu && cp.channel !== 'VAN brand' ? ' for ' + cu.name : ''}`; };
    const ids = e => [...new Set(rows.filter(r => r.entity === e && /^\d+$/.test(String(r.entity_id || ''))).map(r => Number(r.entity_id)))];
    const pick = async (e, sql) => { const L = ids(e); return L.length ? new Map((await soft(sql.replace('?', L.map(() => '?').join(',')), L)).map(x => [Number(x.id), x])) : new Map(); };
    const packIds = [...new Set(ids('client_pack'))]; const prices = await pick('price', 'SELECT id, client_pack_id, price FROM c2m_price WHERE id IN (?)'); prices.forEach(x => packIds.push(Number(x.client_pack_id)));
    const packAll = new Map(packIds.length ? (await soft(`SELECT k.id, k.client_product_id, k.pack_size, c.sold_per FROM c2m_client_pack k JOIN c2m_client_product c ON c.id=k.client_product_id WHERE k.id IN (${packIds.map(() => '?').join(',')})`, packIds)).map(k => [Number(k.id), k]) : []);
    const packName = id => { const k = packAll.get(Number(id)); if (!k) return null; return `${cpName(k.client_product_id) || 'a product'}, ${+Number(k.pack_size).toFixed(3)} ${k.sold_per === 'L' ? 'L' : 'kg'}`; };
    const recs = await pick('recipe', 'SELECT id, client_product_id, version_no FROM c2m_recipe_version WHERE id IN (?)');
    const gr = new Map(); for (const e of ['rate', 'grade_nutrients', 'material']) { const L = ids(e); if (L.length) (await soft(`SELECT g.id, g.grade, m.name FROM c2m_material_grade g JOIN c2m_raw_material m ON m.id=g.material_id WHERE g.id IN (${L.map(() => '?').join(',')})`, L)).forEach(x => gr.set(Number(x.id), x)); }
    { const L = [...new Set(rows.filter(r => r.entity === 'density' && /^grade:\d+$/.test(String(r.entity_id || ''))).map(r => Number(String(r.entity_id).slice(6))))].filter(n => !gr.has(n)); // push 7c: density rows name their material
      if (L.length) (await soft(`SELECT g.id, g.grade, m.name FROM c2m_material_grade g JOIN c2m_raw_material m ON m.id=g.material_id WHERE g.id IN (${L.map(() => '?').join(',')})`, L)).forEach(x => gr.set(Number(x.id), x)); }
    const mats = await pick('material', 'SELECT id, name FROM c2m_raw_material WHERE id IN (?)');
    const pit = new Map(); for (const e of ['packing_item', 'packing_rate']) { const L = ids(e); if (L.length) (await soft(`SELECT id, name FROM c2m_packing_item WHERE id IN (${L.map(() => '?').join(',')})`, L)).forEach(x => pit.set(Number(x.id), x)); }
    const bills = await pick('packing_bill', 'SELECT id, name FROM c2m_packing_bill WHERE id IN (?)');
    const rules = await pick('conversion_rule', 'SELECT id, name FROM c2m_conversion_rule WHERE id IN (?)');
    const treq = await pick('target_request', 'SELECT id, client_product_id FROM c2m_target_request WHERE id IN (?)');
    const revs = await pick('list_revision', 'SELECT id, list_name FROM c2m_list_revision WHERE id IN (?)');
    const docs = await pick('price_doc', 'SELECT id, ref FROM c2m_price_doc WHERE id IN (?)');
    const sreqs = await pick('setting_request', 'SELECT id, summary FROM c2m_setting_request WHERE id IN (?)');
    const reaps = await pick('reapproval', 'SELECT id, cause FROM c2m_reapproval WHERE id IN (?)');
    const [people] = await q("SELECT a.username, a.name FROM user_module_roles r JOIN auth_users a ON a.username=r.username WHERE r.module='c2m'").catch(() => [[]]);
    const nameOf = new Map(people.map(x => [String(x.username).toLowerCase(), x.name]));
    const LISTW = { dist: 'Distributor list', dealer: 'Dealer list', farmer: 'Farmer list', mrp: 'MRP printing list' };
    const itemOf = a => { const id = a.entity_id, n = Number(id);
      switch (a.entity) {
        case 'client_product': case 'target': case 'product_name': return cpName(id);
        case 'client_pack': return packName(id);
        case 'price': { const p = prices.get(n); return p ? packName(p.client_pack_id) : null; }
        case 'recipe': { const r = recs.get(n); return r ? `${cpName(r.client_product_id) || 'a product'}, version ${r.version_no}` : null; }
        case 'customer': { const c = D.custById.get(n); return c ? c.name : null; }
        case 'signoff': { const [k, ver] = String(id).split(':'); const T = { production: 'Production Manager', qc: 'QC Head', plant: 'Plant Manager', cfo: 'CFO', viewer: 'Price list viewer', custom: 'A role made on the launcher' }; return T[k] ? `${T[k]}, version ${ver}` : null; } // push 7e (review 7e, 7)
        case 'density': { const [k, r] = String(id).split(':'); if (k === 'product') return cpName(r); const g = gr.get(Number(r)); return g ? `${g.name}${g.grade && g.grade !== 'Standard' ? ', ' + g.grade : ''}` : null; } // push 7c (review 7c, minor 4)
        case 'rate': case 'grade_nutrients': { const g = gr.get(n); return g ? `${g.name}${g.grade && g.grade !== 'Standard' ? ', ' + g.grade : ''}` : null; }
        case 'material': { const g = a.action === 'create' ? gr.get(n) : null; const m = mats.get(n); return g ? g.name : m ? m.name : null; }
        case 'packing_item': case 'packing_rate': { const x = pit.get(n); return x ? x.name : null; }
        case 'packing_bill': { const x = bills.get(n); return x ? x.name : null; }
        case 'conversion_rule': { const x = rules.get(n); return x ? x.name : null; }
        case 'target_request': { const x = treq.get(n); return x ? cpName(x.client_product_id) : null; }
        case 'list_revision': { const x = revs.get(n); return x ? LISTW[x.list_name] || x.list_name : null; }
        case 'price_doc': { const x = docs.get(n); return x ? x.ref : null; }
        case 'setting_request': { const x = sreqs.get(n); return x ? x.summary : null; }
        case 'reapproval': { const x = reaps.get(n); return x ? isoWords(x.cause) : null; }
        case 'setting': { const r = (D.settings.rows || []).find(x => x.k === id); return r && r.label ? r.label : id; }
        case 'grant': return nameOf.get(String(id || '').toLowerCase()) || id;
        case 'product_variant': { const v = (D.pvariants || []).find(x => Number(x.id) === n); return v ? v.name : null; }
        case 'product_family': { const v = (D.families || []).find(x => Number(x.id) === n); return v ? v.name : null; }
        case 'monthly_check': case 'monthly_actual': { const m = /^(\d{4})-(\d{2})(?::(.*))?$/.exec(String(id || '')); return m ? `${MON3[+m[2] - 1]} ${m[1]}${m[3] ? ', ' + m[3].replace(/_/g, ' ') : ''}` : id; }
        case 'freight': return id ? String(id).split('|').filter(Boolean).join(', ') : null;
        case 'list_master': return 'All price lists';
        case 'list_price': return LISTW[id] || (id === 'all' ? 'Every list' : id);
        default: return id && !/^\d+$/.test(String(id)) ? String(id).replace(/_/g, ' ') : null; } };
    let out = rows.map(a => { const byName = a.by_user === 'c2m' ? 'C2M' : /^migration/.test(a.by_user) ? 'Data correction' : nameOf.get(String(a.by_user || '').toLowerCase()) || a.by_user;
      return { at: a.at, by: a.by_user, byName, entity: a.entity, action: a.action, kind: auditKindOf(a), item: itemOf(a), id: a.entity_id, what: `${AUD_THING[a.entity] || String(a.entity).replace(/_/g, ' ')} ${AUD_DID[a.action] || String(a.action).replace(/_/g, ' ')}`, why: audWhy(a.why) }; });
    if (text) { const t = text.toLowerCase(); out = out.filter(a => [a.item, a.why, a.byName, a.what].some(x => String(x || '').toLowerCase().includes(t))); } // the words on screen (review r4, finding 14)
    const [byU] = await q('SELECT DISTINCT by_user FROM c2m_audit'); const people2 = byU.map(x => ({ u: x.by_user, n: x.by_user === 'c2m' ? 'C2M' : /^migration/.test(x.by_user) ? 'Data correction by IT' : nameOf.get(String(x.by_user || '').toLowerCase()) || x.by_user })).sort((a, b) => String(a.n).localeCompare(String(b.n)));
    res.json({ rows: out.slice(0, 300), total: out.length, capped, cap: AUDIT_CAP, people: people2 });
  }));


  /* ==========================================================================
   * Yawar's feedback, Tahir's rulings of 30 Oct 2026 (D-139, D-140)
   * Edit and Delete on every list. Delete removes an entry only when nothing uses it (no recipe, packing bill, pack, truck, price
   * or grant); its values stay in the change record. Anything in use is taken out of use instead: hidden from forms and pickers,
   * kept for past costs, and it can be put back. Approved prices and approved recipes are never deleted.
   * The Default recipe: a product may hold more than 1 approved recipe; only the Default sets cost, price for target and margin.
   * Yawar switches the Default alone; Tahir gets a notice.
   * ========================================================================== */
  const OOU = { grade: 'material_grade', pitem: 'packing_item', bill: 'packing_bill', customer: 'customer' };
  const STATE_W = { draft: 'draft', review: 'with the QC Head', endorse: 'with the Plant Manager', cost: 'with the CFO', approved: 'approved', old: 'an old version', closed: 'closed' };
  const need007 = D => { if (!D.m007) throw Object.assign(new Error('This part is not switched on yet: IT has 1 step to run. Nothing was saved; try again after IT has run it.'), { status: 409 }); };
  async function rightFor(req, kind, id) {
    let a = { grade: 'material.save', pitem: 'packing.manage', bill: 'packing.manage', rule: 'labour.manage', freight: 'freight.edit', customer: 'client.add', product: 'client.add', recipe: 'recipe.start' }[kind];
    if (!a) throw bad('Unknown list.');
    if (kind === 'product') { const [[cp]] = await q('SELECT channel FROM c2m_client_product WHERE id=?', [id]); if (cp && cp.channel === 'VAN brand') a = 'lists.link'; }
    if (!req.c2m.can.has(a)) throw Object.assign(new Error('Your role cannot do this in C2M.'), { status: 403 });
  }
  /** What uses an entry: a list of plain lines. Empty = it can be deleted. */
  async function usesOf(kind, id0) {
    const id = Number(id0); if (!(id > 0)) throw bad('Pick a row.');
    const D = await engine.loadAll(q); const L = []; let label = '', out = 'none', isOut = false, extra = {};
    const [allCp] = await q('SELECT c.id, c.brand, c.sold_per, c.channel, c.active, c.customer_id, cu.name customer FROM c2m_client_product c JOIN c2m_customer cu ON cu.id=c.customer_id');
    const cpN = new Map(allCp.map(c => [Number(c.id), c])); const pn = cpId => { const c = cpN.get(Number(cpId)); return c ? (c.channel === 'VAN brand' ? c.brand : `${c.brand} for ${c.customer}`) : `product ${cpId}`; };
    if (kind === 'grade') {
      const [[g]] = await q('SELECT g.id, g.grade, m.id mid, m.name FROM c2m_material_grade g JOIN c2m_raw_material m ON m.id=g.material_id WHERE g.id=?', [id]); if (!g) throw bad('This material is no longer in C2M. Press Refresh; if it is still missing, it was deleted.');
      label = `${g.name}, ${g.grade}`; out = 'out'; isOut = D.outOfUse.has('material_grade:' + id);
      const [rl] = await q('SELECT DISTINCT v.id, v.version_no, v.state, v.client_product_id FROM c2m_recipe_line l JOIN c2m_recipe_version v ON v.id=l.recipe_version_id WHERE l.grade_id=? ORDER BY v.client_product_id, v.version_no', [id]);
      rl.forEach(v => L.push(`${pn(v.client_product_id)}: recipe version ${v.version_no} (${STATE_W[v.state] || v.state})`));
    } else if (kind === 'pitem') {
      const it = D.packing.itemById.get(id); if (!it) throw bad('This packing item is no longer in C2M. Press Refresh; if it is still missing, it was deleted.');
      label = it.name; out = 'out'; isOut = D.outOfUse.has('packing_item:' + id);
      for (const b of D.packing.billById.values()) if (b.lines.some(l => Number(l.itemId) === id)) L.push(`Packing bill "${b.name}"`);
    } else if (kind === 'bill') {
      const b = D.packing.billById.get(id); if (!b) throw bad('This packing bill is no longer in C2M. Press Refresh; if it is still missing, it was deleted.');
      label = b.name; out = 'out'; isOut = D.outOfUse.has('packing_bill:' + id);
      const [ks] = await q('SELECT pack_size, client_product_id FROM c2m_client_pack WHERE packing_bill_id=? ORDER BY client_product_id, pack_size', [id]);
      ks.forEach(k => L.push(`${pn(k.client_product_id)}, ${Number(k.pack_size)} ${(cpN.get(Number(k.client_product_id)) || {}).sold_per || ''} pack`));
    } else if (kind === 'rule') {
      const [[r]] = await q('SELECT * FROM c2m_conversion_rule WHERE id=?', [id]); if (!r) throw bad('This rate is no longer in C2M. Press Refresh; if it is still missing, it was deleted.');
      label = r.name; out = Number(r.active) ? 'retire' : 'none'; isOut = !Number(r.active);
      if (!Number(r.active)) L.push('It is out of use: a rate out of use stays in the record'); // review 30 Oct, smaller point
      const [lp] = await q('SELECT client_product_id FROM c2m_conversion_rule_product WHERE rule_id=?', [id]); lp.forEach(x => { const c = cpN.get(Number(x.client_product_id)); if (c && !Number(c.active)) L.push(`${pn(c.id)} (out of use) is listed on it`); });
      if (D.lf) L.push('An old rate: since the switch to Low and High no pack uses it; it stays in the record'); // review 2c, finding 6
      if (!D.lf) for (const p of D.packs) { const cp = D.cpById.get(p.client_product_id); if (!cp) continue;
        const cv = lib.conversionFor({ clientProductId: cp.id, variantId: (D.ext.get(cp.id) || {}).pvariantId || null, baseProductId: cp.base_product_id, form: cp.form, reprocessed: cp.reprocessed, packSize: Number(p.pack_size), onDate: today() }, D.rules);
        if ((cv.labour && Number(cv.labour.id) === id) || (cv.foh && Number(cv.foh.id) === id)) L.push(`${pn(cp.id)}, ${Number(p.pack_size)} ${cp.sold_per} pack (its cost today)`); }
    } else if (kind === 'freight') {
      const [[f]] = await q('SELECT * FROM c2m_freight_rate WHERE id=?', [id]); if (!f) throw bad('This freight row is no longer in C2M. Press Refresh; if it is still missing, it was deleted.');
      label = `${f.segment}, ${f.region}, from ${String(f.valid_from).slice(0, 10)}`;
      for (const cp of D.cps) { if (!['Dealer', 'Farmer'].includes(cp.channel)) continue; const cu = D.custById.get(cp.customer_id) || {}; const row = D.freight.find(x => x.segment === cp.channel && lib.sameRegion(x.region, cu.region) && String(x.valid_from).slice(0, 10) <= today()); /* the row in force today, not the newest (a row dated ahead is newest; audit 4 Nov 2026, fault A5) */ if (row && Number(row.id) === id) L.push(`${pn(cp.id)} (its cost today)`); }
    } else if (kind === 'customer') {
      const [[c]] = await q('SELECT * FROM c2m_customer WHERE id=?', [id]); if (!c) throw bad('This client is no longer in C2M. Press Refresh; if it is still missing, it was deleted.');
      label = c.name; out = 'out'; isOut = D.outOfUse.has('customer:' + id);
      allCp.filter(x => Number(x.customer_id) === id).forEach(x => L.push(`Product ${x.brand}${Number(x.active) ? '' : ' (out of use)'}`));
      const names = [c.name].concat(String(c.o2s_names || '').split('|')).map(nmK).filter(Boolean);
      if (names.length) { const [pl] = await q('SELECT customer_name FROM c2m_o2s_po_line'); const n = pl.filter(l => names.includes(nmK(l.customer_name))).length; if (n) L.push(`${n} O2S PO line(s) in C2M`); }
      const [gr] = await q("SELECT username FROM c2m_list_grant WHERE grant_kind='client' AND grant_value=?", [c.name]); gr.forEach(g => L.push(`KAM access of ${g.username}`));
      const [docs] = await q("SELECT ref, fields_json FROM c2m_price_doc WHERE audience='wl'"); docs.forEach(d => { try { if (JSON.parse(d.fields_json).client === c.name) L.push(`Issued price list ${d.ref}`); } catch (_) {} });
    } else if (kind === 'product') {
      const cp = cpN.get(id); if (!cp) throw bad('This product is no longer in C2M. Press Refresh; if it is still missing, it was deleted.');
      label = pn(id); out = 'out'; isOut = !Number(cp.active); extra = { channel: cp.channel };
      const [vs] = await q("SELECT version_no, state FROM c2m_recipe_version WHERE client_product_id=? AND state<>'draft' ORDER BY version_no", [id]); vs.forEach(v => L.push(`Recipe version ${v.version_no} (${STATE_W[v.state] || v.state})`));
      const [[cv]] = await q('SELECT COUNT(*) n FROM c2m_cost_version v JOIN c2m_client_pack k ON k.id=v.client_pack_id WHERE k.client_product_id=?', [id]); if (Number(cv.n)) L.push(`${cv.n} approved cost(s)`);
      const [[pr]] = await q('SELECT COUNT(*) n FROM c2m_price p JOIN c2m_client_pack k ON k.id=p.client_pack_id WHERE k.client_product_id=?', [id]); if (Number(pr.n)) L.push(`${pr.n} price(s), approved or proposed`);
      const [fo] = await q('SELECT client_product_id FROM c2m_product_ext WHERE follows_product_id=?', [id]); fo.forEach(f => L.push(`${pn(f.client_product_id)} follows its recipe`));
      const [ks] = await q('SELECT id FROM c2m_client_pack WHERE client_product_id=?', [id]); const kIds = new Set(ks.map(k => Number(k.id)));
      const [lp] = await q('SELECT list_name, data_json FROM c2m_list_price'); const onList = lp.filter(r => { try { const d = JSON.parse(r.data_json); return d.packId != null && kIds.has(Number(d.packId)); } catch (_) { return false; } }); if (onList.length) L.push(`${onList.length} row(s) on the VAN brand price lists`);
      const [ra] = await q("SELECT items_json FROM c2m_reapproval WHERE status='open'"); if (ra.some(r => { try { return JSON.parse(r.items_json).some(i => kIds.has(Number(i.packId))); } catch (_) { return false; } })) L.push('An open re-approval item on Approvals');
      const [rvp] = await q("SELECT id, list_name, items_json FROM c2m_list_revision WHERE status IN ('proposed','sent_back') OR (status='approved' AND applied=0)"); rvp.forEach(r => { try { if (JSON.parse(r.items_json).some(it => it.packId != null && kIds.has(Number(it.packId)))) L.push(`A VAN brand list revision (${r.list_name}) that adds its pack`); } catch (_) {} }); // review 30 Oct, finding 4
      const [[tr]] = await q("SELECT COUNT(*) n FROM c2m_target_request WHERE client_product_id=? AND status='open'", [id]); if (Number(tr.n)) L.push('A target change waiting for the COO');
      // trucks and PO lines: O2S lines with one of its names and pack sizes (white label: under its client's names)
      const [[cpRow]] = await q('SELECT * FROM c2m_client_product WHERE id=?', [id]); const bn = new Set(namesOf(cpRow).map(nmK)); const sizes = new Set(); { const [kk] = await q('SELECT pack_size FROM c2m_client_pack WHERE client_product_id=?', [id]); kk.forEach(k => sizes.add(Number(k.pack_size))); }
      const cust = D.custById.get(cp.customer_id) || (await q('SELECT * FROM c2m_customer WHERE id=?', [cp.customer_id]))[0][0] || {}; const cn = new Set([cust.name].concat(String(cust.o2s_names || '').split('|')).map(nmK).filter(Boolean));
      const [po] = await q('SELECT customer_name, brand, channel, pack FROM c2m_o2s_po_line'); const n = po.filter(l => bn.has(nmK(l.brand)) && [...sizes].some(z => Math.abs(z - Number(l.pack)) < 1e-6) && (cp.channel === 'VAN brand' ? l.channel !== 'White Label' : l.channel === 'White Label' && cn.has(nmK(l.customer_name)))).length;
      if (n) L.push(`${n} O2S PO line(s) or truck(s)`);
    } else if (kind === 'recipe') {
      const [[v]] = await q('SELECT * FROM c2m_recipe_version WHERE id=?', [id]); if (!v) throw bad('This recipe version is no longer in C2M. Press Refresh; if it is still missing, it was deleted.');
      label = `${pn(v.client_product_id)}, recipe version ${v.version_no}`;
      if (v.state !== 'draft') L.push(`It is ${STATE_W[v.state] || v.state}: only a draft can be deleted. ${['approved', 'old', 'closed'].includes(v.state) ? 'Write a new version instead.' : 'Send it back first, or let it finish.'}`);
    } else throw bad('Unknown list.');
    return { kind, id, label, uses: L, out, isOut, ...extra };
  }
  app.get('/api/c2m/uses/:kind/:id', wrap(async (req, res) => { await rightFor(req, req.params.kind, Number(req.params.id)); res.json(await usesOf(req.params.kind, req.params.id)); }));

  app.post('/api/c2m/delete', wrap(async (req, res) => {
    const { kind } = req.body || {}; const id = Number((req.body || {}).id); const why = String((req.body || {}).why || '').trim();
    await rightFor(req, kind, id); if (!why) throw bad('Write why it is deleted.');
    if (kind === 'rule' && await lfOn()) throw Object.assign(new Error(OLD_LF), { status: 409 }); // review 2c, finding 8
    const out = await tx(async () => {
      const LOCK = { grade: 'c2m_material_grade', pitem: 'c2m_packing_item', bill: 'c2m_packing_bill', rule: 'c2m_conversion_rule', freight: 'c2m_freight_rate', customer: 'c2m_customer', product: 'c2m_client_product', recipe: 'c2m_recipe_version' };
      await q(`SELECT id FROM ${LOCK[kind]} WHERE id=? FOR UPDATE`, [id]); // locked first: a save that adds a use waits, or this delete waits for it (review 30 Oct)
      const U = await usesOf(kind, id); // read again inside the transaction: something may have started using it a moment ago
      if (U.uses.length) throw Object.assign(new Error(`${U.label} cannot be deleted: it is used by ${U.uses.slice(0, 3).join('; ')}${U.uses.length > 3 ? ` and ${U.uses.length - 3} more` : ''}. ${U.out === 'out' ? 'Take it out of use instead.' : U.out === 'retire' ? 'Take it out of use instead.' : ''}`), { status: 409 });
      let old = null;
      if (kind === 'grade') {
        const [[g]] = await q('SELECT * FROM c2m_material_grade WHERE id=? FOR UPDATE', [id]); const [rates] = await q('SELECT rate, rate_date, source FROM c2m_material_rate WHERE grade_id=?', [id]); const [[m]] = await q('SELECT * FROM c2m_raw_material WHERE id=?', [g.material_id]);
        const [nr] = await softQ('SELECT n.label, gn.pct, gn.cert, gn.cert_date FROM c2m_grade_nutrient gn JOIN c2m_nutrient n ON n.id=gn.nutrient_id WHERE gn.grade_id=?', [id]); // review 7a, minor 4: kept in the record
        old = { material: m.name, grade: g.grade, unit: m.unit, nutrients: g.nutrients_json, nutrientRows: nr && nr.length ? nr : undefined, rates };
        await q('DELETE FROM c2m_material_rate WHERE grade_id=?', [id]); await q('DELETE FROM c2m_material_grade WHERE id=?', [id]); await softQ('DELETE FROM c2m_grade_nutrient WHERE grade_id=?', [id]); await softQ('DELETE FROM c2m_grade_check WHERE grade_id=?', [id]); await softQ("DELETE FROM c2m_out_of_use WHERE entity='material_grade' AND entity_id=?", [id]); await softQ("DELETE FROM c2m_density WHERE kind='grade' AND ref_id=?", [id]); // push 7a; density: push 7c: nutrient rows and check go too (review 7a, B1: the out-of-use delete stays live)
        const [[left]] = await q('SELECT COUNT(*) n FROM c2m_material_grade WHERE material_id=?', [m.id]); if (!Number(left.n)) await q('DELETE FROM c2m_raw_material WHERE id=?', [m.id]);
      } else if (kind === 'pitem') {
        const [[it]] = await q('SELECT * FROM c2m_packing_item WHERE id=? FOR UPDATE', [id]); const [rates] = await q('SELECT price_per_piece, rate_date, source FROM c2m_packing_rate WHERE packing_item_id=?', [id]);
        old = { name: it.name, kind: it.kind, rates }; await q('DELETE FROM c2m_packing_rate WHERE packing_item_id=?', [id]); await q('DELETE FROM c2m_packing_item WHERE id=?', [id]); await softQ("DELETE FROM c2m_out_of_use WHERE entity='packing_item' AND entity_id=?", [id]);
      } else if (kind === 'bill') {
        const [[b]] = await q('SELECT * FROM c2m_packing_bill WHERE id=? FOR UPDATE', [id]); const [lines] = await q('SELECT packing_item_id, level, pieces, packs_per_outer FROM c2m_packing_bill_line WHERE packing_bill_id=?', [id]);
        old = { name: b.name, lines }; await q('DELETE FROM c2m_packing_bill_line WHERE packing_bill_id=?', [id]); await q('DELETE FROM c2m_packing_bill WHERE id=?', [id]); await softQ("DELETE FROM c2m_out_of_use WHERE entity='packing_bill' AND entity_id=?", [id]);
      } else if (kind === 'rule') {
        const [[r]] = await q('SELECT * FROM c2m_conversion_rule WHERE id=? FOR UPDATE', [id]); const [pr] = await q('SELECT client_product_id FROM c2m_conversion_rule_product WHERE rule_id=?', [id]);
        old = { ...r, products: pr.map(x => x.client_product_id) }; await q('DELETE FROM c2m_conversion_rule_product WHERE rule_id=?', [id]); await softQ('DELETE FROM c2m_rule_variant WHERE rule_id=?', [id]); await q('DELETE FROM c2m_conversion_rule WHERE id=?', [id]);
      } else if (kind === 'freight') {
        const [[f]] = await q('SELECT * FROM c2m_freight_rate WHERE id=? FOR UPDATE', [id]); old = f; await q('DELETE FROM c2m_freight_rate WHERE id=?', [id]);
      } else if (kind === 'customer') {
        const [[c]] = await q('SELECT * FROM c2m_customer WHERE id=? FOR UPDATE', [id]); old = c; await q('DELETE FROM c2m_customer WHERE id=?', [id]); await softQ("DELETE FROM c2m_out_of_use WHERE entity='customer' AND entity_id=?", [id]);
      } else if (kind === 'product') {
        const [[cp]] = await q('SELECT * FROM c2m_client_product WHERE id=? FOR UPDATE', [id]); const [ks] = await q('SELECT * FROM c2m_client_pack WHERE client_product_id=?', [id]); const [dv] = await q('SELECT id FROM c2m_recipe_version WHERE client_product_id=?', [id]);
        old = { product: cp, packs: ks, draftVersions: dv.map(x => x.id) };
        for (const v of dv) { await q('DELETE FROM c2m_recipe_line WHERE recipe_version_id=?', [v.id]); await q('DELETE FROM c2m_recipe_step WHERE recipe_version_id=?', [v.id]); await softQ('DELETE FROM c2m_recipe_name WHERE recipe_version_id=?', [v.id]); }
        await q('DELETE FROM c2m_recipe_version WHERE client_product_id=?', [id]); await softQ('DELETE FROM c2m_recipe_default WHERE client_product_id=?', [id]); await softQ("DELETE FROM c2m_density WHERE kind='product' AND ref_id=?", [id]); await softQ('DELETE FROM c2m_declared_grade WHERE client_product_id=?', [id]); // push 7c (review 7c, minor 5)
        for (const k of ks) await softQ('DELETE FROM c2m_pack_ext WHERE client_pack_id=?', [k.id]);
        /* A labour or FOH rate set for this product only would become a rate for every product once its list is empty (review 30 Oct, finding 1): it is retired, logged. */
        const [rl] = await q('SELECT r.id, r.name FROM c2m_conversion_rule r WHERE r.active=1 AND (r.scope_client_product_id=? OR (EXISTS (SELECT 1 FROM c2m_conversion_rule_product x WHERE x.rule_id=r.id AND x.client_product_id=?) AND NOT EXISTS (SELECT 1 FROM c2m_conversion_rule_product y WHERE y.rule_id=r.id AND y.client_product_id<>?)))', [id, id, id]);
        for (const r of rl) { await q('UPDATE c2m_conversion_rule SET active=0 WHERE id=?', [r.id]); await audit(req.c2m.user, 'conversion_rule', r.id, 'retire', null, null, `Its only product (${cp.brand}) was deleted`); }
        old.retiredRates = rl.map(r => r.id);
        await q('DELETE FROM c2m_client_pack WHERE client_product_id=?', [id]); await q('DELETE FROM c2m_conversion_rule_product WHERE client_product_id=?', [id]); await q('DELETE FROM c2m_target_request WHERE client_product_id=?', [id]);
        await softQ('DELETE FROM c2m_product_ext WHERE client_product_id=?', [id]); await q('DELETE FROM c2m_client_product WHERE id=?', [id]);
        if (cp.channel === 'White label') await recomputeGroup(cp.customer_id, req.c2m.user);
      } else if (kind === 'recipe') {
        const [[v]] = await q("SELECT * FROM c2m_recipe_version WHERE id=? AND state='draft' FOR UPDATE", [id]); if (!v) throw moved();
        const [lines] = await q('SELECT grade_id, qty FROM c2m_recipe_line WHERE recipe_version_id=?', [id]); old = { productId: v.client_product_id, version: v.version_no, note: v.note, lines };
        await q('DELETE FROM c2m_recipe_line WHERE recipe_version_id=?', [id]); await q('DELETE FROM c2m_recipe_step WHERE recipe_version_id=?', [id]); await softQ('DELETE FROM c2m_recipe_name WHERE recipe_version_id=?', [id]); await q('DELETE FROM c2m_recipe_version WHERE id=?', [id]);
      }
      await audit(req.c2m.user, { grade: 'material', pitem: 'packing_item', bill: 'packing_bill', rule: 'conversion_rule', freight: 'freight', customer: 'customer', product: 'client_product', recipe: 'recipe' }[kind], id, 'delete', old, null, `${U.label}: ${why.slice(0, 300)}`);
      return { label: U.label };
    });
    res.json({ ok: true, ...out });
  }));

  /** Take out of use, or put back: a material grade, a packing item, a packing bill or a client (D-139). Products and rates keep their own routes. */
  app.post('/api/c2m/outofuse', wrap(async (req, res) => {
    const { kind } = req.body || {}; const id = Number((req.body || {}).id), on = !!(req.body || {}).on; const why = String((req.body || {}).why || '').trim();
    if (!OOU[kind]) throw bad('This list has no Take out of use.');
    await rightFor(req, kind, id); if (!on && !why) throw bad('Write why it goes out of use.');
    const U = await usesOf(kind, id); const D = await engine.loadAll(q); need007(D);
    await tx(async () => {
      if (on) { const [u] = await q('DELETE FROM c2m_out_of_use WHERE entity=? AND entity_id=?', [OOU[kind], id]); if (!u.affectedRows) throw bad('It is in use already.'); }
      else { const [[ex]] = await q('SELECT entity FROM c2m_out_of_use WHERE entity=? AND entity_id=?', [OOU[kind], id]); if (ex) throw bad('It is out of use already.');
        await q('INSERT INTO c2m_out_of_use (entity, entity_id, by_user, at, why) VALUES (?,?,?,?,?)', [OOU[kind], id, req.c2m.user, now(), why.slice(0, 400)]); }
      await audit(req.c2m.user, OOU[kind], id, on ? 'in use' : 'out of use', null, null, `${U.label}${why ? ': ' + why.slice(0, 300) : ''}`);
    });
    res.json({ ok: true });
  }));

  /** Edit the words of a material (name, grade, unit). Its rate is changed through Change cost, so the effect is shown first. */
  app.post('/api/c2m/edit/grade/:id', can('material.save'), wrap(async (req, res) => {
    const b = req.body || {}; const id = Number(req.params.id);
    await tx(async () => {
      const [[g]] = await q('SELECT g.*, m.name, m.unit, m.id mid FROM c2m_material_grade g JOIN c2m_raw_material m ON m.id=g.material_id WHERE g.id=? FOR UPDATE', [id]); if (!g) throw bad('This material is no longer in C2M. Press Refresh; if it is still missing, it was deleted.');
      const name = cleanName(b.name, 120, 'material name'), grade = cleanName(b.grade || 'Standard', 60, 'grade'), unit = b.unit || g.unit; if (!['kg', 'L'].includes(unit)) throw bad('Unit is kg or L.');
      if (name === g.name && grade === g.grade && unit === g.unit) throw bad('Nothing to save: nothing was changed. Change a field first, then save.');
      if (name !== g.name) { const [[o]] = await q('SELECT id FROM c2m_raw_material WHERE name=? AND id<>?', [name, g.mid]); if (o) throw bad(`Another material is called "${name}". Pick another name.`); }
      if (grade !== g.grade) { const [[o]] = await q('SELECT id FROM c2m_material_grade WHERE material_id=? AND grade=? AND id<>?', [g.mid, grade, id]); if (o) throw bad(`${name} already has the grade "${grade}".`); }
      await q('UPDATE c2m_raw_material SET name=?, unit=? WHERE id=?', [name, unit, g.mid]); await q('UPDATE c2m_material_grade SET grade=? WHERE id=?', [grade, id]);
      await audit(req.c2m.user, 'material', id, 'edit', { name: g.name, grade: g.grade, unit: g.unit }, { name, grade, unit }, 'Edit');
    });
    res.json({ ok: true });
  }));
  /** Edit the words of a packing item (name, kind). Its price is changed through Change packing price, so the effect is shown first. */
  app.post('/api/c2m/edit/pitem/:id', can('packing.manage'), wrap(async (req, res) => {
    const b = req.body || {}; const id = Number(req.params.id);
    await tx(async () => {
      const [[it]] = await q('SELECT * FROM c2m_packing_item WHERE id=? FOR UPDATE', [id]); if (!it) throw bad('This packing item is no longer in C2M. Press Refresh; if it is still missing, it was deleted.');
      const name = cleanName(b.name, 120, 'item name'), kind = String(b.kind || it.kind || 'other').trim().slice(0, 30) || 'other';
      if (name === it.name && kind === it.kind) throw bad('Nothing to save: nothing was changed. Change a field first, then save.');
      if (name !== it.name) { const [[o]] = await q('SELECT id FROM c2m_packing_item WHERE name=? AND id<>?', [name, id]); if (o) throw bad(`Another packing item is called "${name}".`); }
      await q('UPDATE c2m_packing_item SET name=?, kind=? WHERE id=?', [name, kind, id]);
      await audit(req.c2m.user, 'packing_item', id, 'edit', { name: it.name, kind: it.kind }, { name, kind }, 'Edit');
    });
    res.json({ ok: true });
  }));
  /** Edit the words of a labour or FOH rate (name, source). A new Rs, scope or date is saved as a new rate that replaces it (/replace). */
  app.post('/api/c2m/edit/rule/:id', can('labour.manage'), wrap(async (req, res) => {
    if (await lfOn()) throw Object.assign(new Error(OLD_LF), { status: 409 }); // old labour and FOH rates after migration 011 (review 2c, finding 7 and 8)
    const b = req.body || {}; const id = Number(req.params.id);
    await tx(async () => {
      const [[r]] = await q('SELECT * FROM c2m_conversion_rule WHERE id=? FOR UPDATE', [id]); if (!r) throw bad('This rate is no longer in C2M. Press Refresh; if it is still missing, it was deleted.'); if (!Number(r.active)) throw bad('A rate out of use cannot be edited. Add a new rate instead.');
      const name = cleanName(b.name, 160, 'rate name'), source = String(b.source == null ? r.source || '' : b.source).trim().slice(0, 200);
      if (name === r.name && source === (r.source || '')) throw bad('Nothing to save: nothing was changed. Change a field first, then save.');
      await q('UPDATE c2m_conversion_rule SET name=?, source=? WHERE id=?', [name, source || r.source || 'Entered by the CFO', id]); // source cannot be empty
      await audit(req.c2m.user, 'conversion_rule', id, 'edit', { name: r.name, source: r.source }, { name, source }, 'Edit');
    });
    res.json({ ok: true });
  }));

  /** A new Rs or date for a labour or FOH rate (Edit, D-139): a new rate with the same kind and scope, from the date given, replaces it
   *  in 1 save; the old one is retired, never changed, so the record shows both. Costs that move more than the re-approval % wait on Approvals. */
  app.post('/api/c2m/rules/conversion/:id/replace', can('labour.manage'), wrap(dryable(async (req, res) => {
    { if (await lfOn()) throw Object.assign(new Error('Labour and FOH are now named rates, Low and High: change them on Costs, Labour or FOH. The old rates stay in the record only.'), { status: 409 }); }
    const b = req.body || {}; const id = Number(req.params.id);
    const [[r]] = await q('SELECT * FROM c2m_conversion_rule WHERE id=?', [id]); if (!r || !Number(r.active)) throw bad('This rate is no longer in C2M, or it is out of use already. Press Refresh to see the rates as they are now.');
    const rs = strictNum(b.rsPerKg); if (!(rs > 0)) throw bad('Type Rs per kg or L above 0 (digits only). A Rs 0 labour or FOH rate counts as missing.');
    const vf = b.validFrom || today(); if (!isDate(vf)) throw bad('From must be a date.'); if (vf > today()) throw bad('A rate starts today or earlier. A future date is not taken yet, because its cost change would reach no re-approval.');
    const name = cleanName(b.name || r.name, 160, 'rate name'); const source = String(b.source || r.source || 'Entered by the CFO').trim().slice(0, 200);
    if (rs === Number(r.rs_per_kg) && vf === String(r.valid_from).slice(0, 10)) throw bad('Rs and date are the same as now. To change only the name, save without a new Rs.');
    let nid, re = 0;
    await tx(async () => {
      const [u] = await q('UPDATE c2m_conversion_rule SET active=0 WHERE id=? AND active=1', [id]); if (!u.affectedRows) throw moved();
      const [ins] = await q('INSERT INTO c2m_conversion_rule (name, kind, is_base, rs_per_kg, scope_client_product_id, scope_base_product_id, scope_form, scope_reprocessed, scope_pack_min, scope_pack_max, valid_from, source, active) SELECT ?, kind, is_base, ?, scope_client_product_id, scope_base_product_id, scope_form, scope_reprocessed, scope_pack_min, scope_pack_max, ?, ?, 1 FROM c2m_conversion_rule WHERE id=?', [name, rs, vf, source, id]);
      nid = ins.insertId;
      await q('INSERT INTO c2m_conversion_rule_product (rule_id, client_product_id) SELECT ?, client_product_id FROM c2m_conversion_rule_product WHERE rule_id=?', [nid, id]);
      await softQ('INSERT INTO c2m_rule_variant (rule_id, pvariant_id) SELECT ?, pvariant_id FROM c2m_rule_variant WHERE rule_id=?', [nid, id]);
      const gaps = packsWithoutRates(await engine.loadAll(q)); if (gaps.length) throw bad(`This leaves ${gaps.length} pack(s) with no rate, e.g. ${gaps.slice(0, 3).join('; ')}.`);
      await audit(req.c2m.user, 'conversion_rule', nid, 'replace', { id, rsPerKg: Number(r.rs_per_kg), validFrom: String(r.valid_from).slice(0, 10), name: r.name }, { id: nid, rsPerKg: rs, validFrom: vf, name }, `Edit: replaces rate ${id}`);
      re = await reapprovalFor(`${r.kind === 'labour' ? 'Labour' : 'FOH'} rate "${name.slice(0, 80)}" now Rs ${lib.fmtRs2(rs)}, ${today()}`);
      await costNotice(req.c2m.user, `${r.kind === 'labour' ? 'Labour' : 'FOH'} rate "${name.slice(0, 80)}" changed from Rs ${lib.fmtRs2(Number(r.rs_per_kg))} to Rs ${lib.fmtRs2(rs)} per kg or L by ${personNm(req)}`, re);
    });
    res.json({ id: nid, reapproval: re });
  })));

  /** Edit a white label product with the Add a product form, filled (D-139): names, product type, variant, who packs, packs and their bills.
   *  Its form and where its recipe comes from cannot change. A change that moves cost re-costs its packs; a move above the re-approval % waits on Approvals. */
  app.post('/api/c2m/products/:id/full', can('client.add'), wrap(async (req, res) => {
    await needVariants(); const b = req.body || {}; const id = Number(req.params.id); let recost = false, added = 0;
    const r = await tx(async () => {
      const [[cp]] = await q('SELECT * FROM c2m_client_product WHERE id=? FOR UPDATE', [id]); if (!cp) throw bad('This product is no longer in C2M. Press Refresh; if it is still missing, it was deleted.');
      if (cp.channel !== 'White label') throw bad('One of our products is edited in Setup, Products and variants.');
      if (!Number(cp.active)) throw bad('This product is out of use: put it back in use before editing it.');
      const D = await engine.loadAll(q); const ch = [];
      // names
      const brand = cleanName(b.brand, 120, 'brand name'); const names = spellings(b.o2sNames, brand); const o2s = names.join('|'); if (o2s.length > 120) throw bad(`The brand name and spellings together can be at most 120 characters (now ${o2s.length}).`);
      // packs: read and check before writing anything
      const [mine] = await q('SELECT * FROM c2m_client_pack WHERE client_product_id=?', [id]); const mineById = new Map(mine.map(k => [Number(k.id), k]));
      const list = Array.isArray(b.packs) ? b.packs : []; const keep = [], drop = [], fresh = [];
      for (const k of list) { if (k && k.id) { const ex = mineById.get(Number(k.id)); if (!ex) throw bad('A pack on the form is not a pack of this product. Reload and try again.'); if (k.remove) drop.push(ex); else { if (k.size != null && String(k.size).trim() !== '' && Math.abs(strictNum(k.size) - Number(ex.pack_size)) > 1e-9) throw bad(`The ${Number(ex.pack_size)} ${cp.sold_per} pack cannot change its size: remove it and add the new size.`); keep.push({ ex, k }); } } else if (k && String(k.size || '').trim() !== '') fresh.push(k); }
      mine.forEach(k => { if (!list.some(x => x && Number(x.id) === Number(k.id))) keep.push({ ex: k, k: { billId: k.packing_bill_id, clientOnly: D.packExt.has(Number(k.id)) } }); });
      if (!keep.length && !fresh.length) throw bad('A product keeps at least 1 pack. Take the product out of use instead.');
      const mode = b.packingMode || cp.packing_mode; if (!modeOk(mode)) throw bad('Who supplies the packing: VAN, Client or Bulk.');
      const freshP = await readPacks(fresh, mode);
      for (const z of freshP) if (keep.some(x => Math.abs(Number(x.ex.pack_size) - z.size) < 0.0005)) throw bad(`${cp.brand} has the ${z.size} pack already.`);
      const sizesAfter = keep.map(x => Number(x.ex.pack_size)).concat(freshP.map(z => z.size));
      const clash = D.cps.find(c => Number(c.customer_id) === Number(cp.customer_id) && Number(c.id) !== id && c.channel === 'White label' && namesOf(c).some(n => names.some(m => nmK(m) === nmK(n))) && D.packs.some(k => Number(k.client_product_id) === Number(c.id) && sizesAfter.some(z => Math.abs(Number(k.pack_size) - z) < 1e-9)));
      if (clash) throw bad(`This client already has ${clash.brand} under a name and pack size you used: an O2S line could not tell them apart.`);
      for (const k of drop) { const [[cv]] = await q('SELECT COUNT(*) n FROM c2m_cost_version WHERE client_pack_id=?', [k.id]); const [[pr]] = await q('SELECT COUNT(*) n FROM c2m_price WHERE client_pack_id=?', [k.id]);
        const [ra] = await q("SELECT id FROM c2m_reapproval WHERE status='open' AND (items_json LIKE ? OR items_json LIKE ?)", [`%"packId":${Number(k.id)},%`, `%"packId":${Number(k.id)}}%`]);
        if (Number(cv.n) || Number(pr.n) || ra.length) throw bad(`The ${Number(k.pack_size)} ${cp.sold_per} pack already has an approved cost, a price or a re-approval on Approvals, so it cannot be removed. Keep it, or take the product out of use.`); }
      // write
      if (brand !== cp.brand || o2s !== String(cp.o2s_brand || '')) { try { await q('UPDATE c2m_client_product SET brand=?, o2s_brand=? WHERE id=?', [brand, o2s, id]); } catch (e) { if (dupName(e)) throw bad('This client already has a product with these names.'); throw e; } ch.push('names'); }
      const typeId = b.typeId ? Number(b.typeId) : Number(cp.base_product_id); if (typeId && typeId !== Number(cp.base_product_id)) { const [[t]] = await q('SELECT id FROM c2m_base_product WHERE id=?', [typeId]); if (!t) throw bad('This product type is no longer in C2M. Press Refresh; if it is still missing, it was deleted.'); await q('UPDATE c2m_client_product SET base_product_id=? WHERE id=?', [typeId, id]); ch.push('product type'); recost = true; }
      if (mode !== cp.packing_mode) { await q('UPDATE c2m_client_product SET packing_mode=? WHERE id=?', [mode, id]); if (mode === 'bulk') await q('UPDATE c2m_client_pack SET packing_bill_id=NULL WHERE client_product_id=?', [id]); ch.push('who packs it'); recost = true; }
      const e0 = D.ext.get(id) || {};
      if ('pvariantId' in b || b.family || b.variant) { const fam = b.pvariantId ? await pickFamilyVariant(req, { pvariantId: b.pvariantId }) : (b.family || b.variant) ? await pickFamilyVariant(req, { family: b.family, variant: b.variant && notSize(b.variant) }) : { familyId: null, pvariantId: null };
        if (Number(fam.pvariantId || 0) !== Number(e0.pvariantId || 0)) { await setExt(id, { ...fam, followsId: e0.followsId || null }); ch.push('variant'); recost = true; } }
      for (const k of drop) { await softQ('DELETE FROM c2m_pack_ext WHERE client_pack_id=?', [k.id]); await q('DELETE FROM c2m_client_pack WHERE id=?', [k.id]); await audit(req.c2m.user, 'client_pack', k.id, 'remove', Number(k.pack_size), null, `Removed the ${Number(k.pack_size)} ${cp.sold_per} pack of ${brand} (Edit)`); ch.push(`removed the ${Number(k.pack_size)} pack`); }
      for (const { ex, k } of keep) {
        const bill = mode === 'bulk' ? null : (k.billId ? Number(k.billId) : null); if (bill) { const [[bb]] = await q('SELECT id FROM c2m_packing_bill WHERE id=?', [bill]); if (!bb) throw bad('A packing bill you picked is not in C2M.'); }
        if (mode !== 'bulk' && ex.packing_bill_id != null && (bill || null) !== (ex.packing_bill_id || null) && await pendReady() && !isMonday(today())) throw bad(`Moving the ${Number(ex.pack_size)} pack to another packing bill waits for Monday: do it on Costs, Packing cost (tick it on the bill), or on Monday here.`); // review 2d, finding 2
        if (mode !== 'bulk' && (bill || null) !== (ex.packing_bill_id || null)) { await q('UPDATE c2m_client_pack SET packing_bill_id=? WHERE id=?', [bill, ex.id]); await audit(req.c2m.user, 'client_pack', ex.id, 'packing_bill', ex.packing_bill_id, bill, 'Edit'); ch.push(`packing bill of the ${Number(ex.pack_size)} pack`); recost = true; }
        const only = !!k.clientOnly, was = D.packExt.has(Number(ex.id));
        if (only !== was) { if (only) await q('INSERT INTO c2m_pack_ext (client_pack_id, client_only_id) VALUES (?,?)', [ex.id, cp.customer_id]); else await softQ('DELETE FROM c2m_pack_ext WHERE client_pack_id=?', [ex.id]); ch.push(`${Number(ex.pack_size)} pack ${only ? 'for this client only' : 'no longer for this client only'}`); }
      }
      if (freshP.length) { await insertPacks(id, cp.customer_id, freshP, req.c2m.user); added = freshP.length; ch.push(`added ${freshP.map(z => z.size).join(', ')} ${cp.sold_per}`); }
      if (!ch.length) throw bad('Nothing to save: nothing was changed. Change a field first, then save.');
      await audit(req.c2m.user, 'client_product', id, 'edit', { brand: cp.brand, o2s: cp.o2s_brand, typeId: cp.base_product_id, mode: cp.packing_mode, variant: e0.pvariantId || null }, { brand, o2s, typeId, mode, changed: ch }, 'Edit');
      return { changed: ch, brand, follower: !!e0.followsId };
    });
    const re = (recost || added) && !r.follower ? await reapprovalFor(`${r.brand} edited (${r.changed.join(', ')}), ${today()}`, k => Number(k.client_product_id) === id) : 0;
    if (recost) await costNotice(req.c2m.user, `${r.brand} edited by ${req.c2m.user} (${r.changed.join(', ')})`, re);
    res.json({ ok: true, changed: r.changed, reapproval: re });
  }));

  /** Make default (D-140, Tahir 30 Oct 2026): Yawar switches the recipe that sets a product's cost to another approved recipe, alone. Every pack
   *  gets a new approved cost from that moment (trucks from the next day carry it; earlier trucks keep theirs). Tahir gets a notice. */
  app.post('/api/c2m/recipes/:id/default', can('recipe.step.cost'), wrap(async (req, res) => {
    const v = await getVersion(req.params.id); const D0 = await engine.loadAll(q); need007(D0);
    if (v.state !== 'approved') throw bad('Only an approved recipe can be made the Default.');
    const vo = D0.recipes.byVer.get(v.id); const cp = D0.cpById.get(v.client_product_id); if (!cp) throw bad('This product is out of use.');
    if (vo.rname === engine.defaultName(D0, cp.id) && (engine.approvedVersion(D0, cp.id) || {}).id === v.id) throw bad('This is the Default recipe already.');
    const notCosted = []; for (const p of D0.packs.filter(p => p.client_product_id === cp.id)) { const c = engine.packCost(D0, p, { version: vo }); if (c && !c.costed) notCosted.push(`${cp.brand} ${Number(p.pack_size)} ${cp.sold_per}: ${c.gaps.join(', ')}`); }
    if (notCosted.length) throw bad(`It cannot be the Default until every pack is fully costed on it: ${notCosted.join('; ')}.`);
    const was = engine.defaultName(D0, cp.id); let n = 0;
    await tx(async () => {
      const [[still]] = await q("SELECT id FROM c2m_recipe_version WHERE id=? AND state='approved' FOR UPDATE", [v.id]); if (!still) throw moved();
      await q('INSERT INTO c2m_recipe_default (client_product_id, recipe_name, set_by, set_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE recipe_name=VALUES(recipe_name), set_by=VALUES(set_by), set_at=VALUES(set_at)', [cp.id, vo.rname, req.c2m.user, now()]);
      const D = await engine.loadAll(q);
      const write = async (p, cause) => { const c = engine.packCost(D, p); if (!c || !c.costed) return false; await q('INSERT INTO c2m_cost_version (client_pack_id, valid_from, materials, packing, conversion, freight, total, recipe_version_id, cause, approved_by) VALUES (?,?,?,?,?,?,?,?,?,?)', [p.id, now(), c.materials, c.packing, c.conversion, c.freight, c.total, v.id, cause, req.c2m.user]); n++; return true; };
      for (const p of D.packs.filter(p => p.client_product_id === cp.id)) { if (!(await write(p, `Default recipe set to "${vo.rname}" (version ${v.version_no})`))) throw bad('A pack is not fully costed on this recipe. Nothing was saved.'); }
      for (const [fid, e] of D.ext) if (Number(e.followsId) === Number(cp.id)) for (const p of D.packs.filter(p => p.client_product_id === fid)) await write(p, `Default recipe of ${cp.brand} set to "${vo.rname}" (followed by ${(D.cpById.get(fid) || {}).brand || fid})`);
      await audit(req.c2m.user, 'recipe', v.id, 'default', was, vo.rname, `${cp.brand}: the Default recipe is now "${vo.rname}" (version ${v.version_no})`);
      await notice('coo', `${personNm(req)} made "${vo.rname}" (version ${v.version_no}) the Default recipe of ${cp.brand}, in place of "${was}". ${n} pack cost(s) approved from today.`, req.c2m.user);
    });
    res.json({ ok: true, packs: n });
  }));
  const personNm = req => String(req.c2m.name || req.c2m.user).trim().split(/\s+/)[0];

  /* ---------- System documentation (mandatory, ruled 15 Oct) ---------- */
  app.get('/api/c2m/docs/:file', wrap(async (req, res) => {
    const f = path.basename(String(req.params.file)); if (!/^[0-9a-z-]+\.md$/.test(f)) throw bad('Unknown document.');
    const p = path.join(__dirname, 'docs', f); if (!fs.existsSync(p)) throw bad('Unknown document.');
    if (!docAllowed(req.c2m, f)) throw Object.assign(new Error('Not available to your role.'), { status: 403 });
    res.type('text/plain; charset=utf-8').send(fs.readFileSync(p, 'utf8'));
  }));
};

module.exports.ROLES = ROLES;
