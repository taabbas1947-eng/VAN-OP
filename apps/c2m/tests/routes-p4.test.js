// Phase 4 sign-off (26 Nov 2026): the main approval paths end to end on the test database, with the blockers on the way and the change record.
// A recipe from draft to approved cost (the QC Head's nutrient blocker, the packing bill blocker, the cost rollup), then a price, a target and a
// setting through the COO; a rate change to a re-approval item and the new cost; an unmatched O2S name settled. Run: node apps/c2m/tests/routes-p4.test.js. Needs the test database: see README.md.
const path = require('path');
const express = require('express'); const db = require('./_db.js');
const ROUTES = path.resolve(process.argv[2] || path.join(__dirname, '..', 'c2m-routes.js'));
const lib = require('../c2m-lib.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
(async () => {
  const pool = (await db.fresh(), db.pool(5));
  const pdq = (s, p) => pool.execute(s, p || []);
  const pdqT = (s, p) => pdq(s, p).then(r => { if (!/^\s*SELECT/i.test(s) && global.__c2mForget) global.__c2mForget(); return r; });
  await pdqT('DELETE FROM user_module_roles');
  for (const u of ['himayat', 'saleem']) await pdqT('INSERT IGNORE INTO auth_users (username, name) VALUES (?, ?)', [u, u]);
  for (const [u, r] of [['tahir', 'coo'], ['yawar', 'cfo'], ['majid', 'production'], ['himayat', 'qc'], ['saleem', 'plant']]) await pdqT('INSERT INTO user_module_roles (username, module, role) VALUES (?,?,?)', [u, 'c2m', r]);
  await pdqT("DELETE FROM c2m_setting WHERE k LIKE 'golive%'"); // the go-live window closed: the full recipe path
  const [c] = await pdqT("INSERT INTO c2m_customer (name, o2s_names, grp, segment) VALUES ('Rudolf','Rudolf','White label','White label')");
  const [p1] = await pdqT("INSERT INTO c2m_client_product (customer_id, channel, brand, o2s_brand, target_gp) VALUES (?, 'White label', 'Basic', 'Basic', 25)", [c.insertId]); const cp = p1.insertId;
  const [k] = await pdqT('INSERT INTO c2m_client_pack (client_product_id, pack_size) VALUES (?, 10)', [cp]); const pack = k.insertId;
  const [mt] = await pdqT("INSERT INTO c2m_raw_material (name, unit) VALUES ('Urea', 'kg')"); const [gr] = await pdqT("INSERT INTO c2m_material_grade (material_id, grade) VALUES (?, 'Standard')", [mt.insertId]); const grade = gr.insertId;
  await pdqT("INSERT INTO c2m_material_rate (grade_id, rate, rate_date, source, entered_by, entered_at) VALUES (?, 100, DATE_SUB(CURDATE(), INTERVAL 10 DAY), 'test', 'yawar', NOW())", [grade]);
  await pdqT("UPDATE c2m_lf_rate SET rs_per_kg = 5, valid_from = DATE_SUB(CURDATE(), INTERVAL 40 DAY)"); // labour and FOH Low and High filled

  const app = express(); app.use(express.json());
  const auth = (req, res, next) => { req.user = { u: req.get('x-user') || 'tahir' }; next(); };
  require(ROUTES)(app, { pdq, pool, auth, path, fs: require('fs'), crypto: require('crypto'), services: {}, noAutoPull: true });
  global.__c2mForget = app.locals.c2mForgetKept;
  app.use((e, req, res, next) => res.status(e.status || 500).json({ error: e.message }));
  const srv = app.listen(0); const port = srv.address().port;
  const call = async (u, m, p, b) => { const r = await fetch(`http://localhost:${port}${p}`, { method: m, headers: { 'x-user': u, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); let j = null; try { j = await r.json(); } catch (_) {} return { s: r.status, j }; };
  const post = (u, p, b) => call(u, 'POST', p, b || {});
  const auds = async (entity, id) => (await pdq('SELECT action, by_user FROM c2m_audit WHERE entity=? AND entity_id=? ORDER BY id', [entity, String(id)]))[0];
  const stateOf = async id => (await pdq('SELECT state FROM c2m_recipe_version WHERE id=?', [id]))[0][0].state;

  // ---- 1. A recipe, draft to approved cost
  let R = await post('majid', '/api/c2m/recipes/new', { clientProductId: cp }); const vid = R.j && (R.j.id || R.j.versionId); ok(R.s === 200 && vid, 'the Production Manager starts a recipe: ' + JSON.stringify(R.j));
  R = await post('majid', `/api/c2m/recipes/${vid}/lines`, { lines: [{ gradeId: grade, qty: 1 }] }); ok(R.s === 200, 'and writes its line: ' + JSON.stringify(R.j));
  R = await post('yawar', `/api/c2m/recipes/${vid}/advance`, {}); ok(R.s === 403, 'a step that is not yours is refused');
  R = await post('majid', `/api/c2m/recipes/${vid}/advance`, {}); ok(R.s === 200 && await stateOf(vid) === 'review', 'sent on: it goes to the QC Head: ' + await stateOf(vid));
  { const [n] = await pdq("SELECT text FROM c2m_notice WHERE for_role='qc' ORDER BY id DESC LIMIT 1"); ok(n.length && /Basic/.test(n[0].text), 'the QC Head is told'); }
  // the QC nutrient blocker: the material has no nutrient data
  R = await post('himayat', `/api/c2m/recipes/${vid}/advance`, {}); ok(R.s === 400 && R.j && /nutrient analysis is not complete/.test(R.j.error), 'blocker: missing nutrient data stops the QC Head without a comment: ' + JSON.stringify(R.j));
  R = await post('himayat', `/api/c2m/recipes/${vid}/advance`, { note: 'Urea nutrients to be entered; passed for the trial' }); ok(R.s === 200 && await stateOf(vid) === 'endorse', 'with a comment it passes to the Plant Manager: ' + await stateOf(vid));
  R = await post('saleem', `/api/c2m/recipes/${vid}/advance`, { note: 'ok' }); ok(R.s === 200 && await stateOf(vid) === 'cost', 'the Plant Manager endorses; it goes to the CFO: ' + await stateOf(vid));
  // the packing bill blocker
  R = await post('yawar', `/api/c2m/recipes/${vid}/advance`, {}); ok(R.s === 400 && R.j && /not fully costed|packing bill/i.test(R.j.error), 'blocker: a pack with no packing bill stops the cost approval: ' + JSON.stringify(R.j));
  ok(await stateOf(vid) === 'cost', 'and the recipe stays with the CFO');
  const [it] = await pdqT("INSERT INTO c2m_packing_item (name, kind) VALUES ('Bag 10 kg', 'bag')");
  await pdqT("INSERT INTO c2m_packing_rate (packing_item_id, price_per_piece, rate_date, source, entered_by, entered_at) VALUES (?, 20, DATE_SUB(CURDATE(), INTERVAL 10 DAY), 'test', 'yawar', NOW())", [it.insertId]);
  const [bl] = await pdqT("INSERT INTO c2m_packing_bill (name, status) VALUES ('Bag 10 kg alone', 'approved')"); await pdqT("INSERT INTO c2m_packing_bill_line (packing_bill_id, packing_item_id, level, pieces) VALUES (?, ?, 'primary', 1)", [bl.insertId, it.insertId]);
  await pdqT('UPDATE c2m_client_pack SET packing_bill_id=? WHERE id=?', [bl.insertId, pack]);
  R = await post('yawar', `/api/c2m/recipes/${vid}/advance`, {}); ok(R.s === 200 && await stateOf(vid) === 'approved', 'with a bill the CFO approves the cost: ' + JSON.stringify(R.j));
  const [[cv]] = await pdq('SELECT * FROM c2m_cost_version WHERE client_pack_id=? ORDER BY id DESC LIMIT 1', [pack]);
  ok(cv && Math.abs(Number(cv.total) - (Number(cv.materials) + Number(cv.packing) + Number(cv.conversion) + Number(cv.freight))) < 0.0001, 'cost rollup: total = materials + packing + labour and FOH + freight: ' + (cv && [cv.materials, cv.packing, cv.conversion, cv.freight, cv.total].join(' / ')));
  ok(cv && Math.abs(Number(cv.packing) - 2) < 0.0001, 'packing: Rs 20 a bag on a 10 kg pack is Rs 2 per kg: ' + (cv && cv.packing));
  ok(cv && Math.abs(Number(cv.conversion) - 10) < 0.0001, 'labour Rs 5 + FOH Rs 5 per kg: ' + (cv && cv.conversion));
  ok(cv && Math.abs(Number(cv.materials) - 100) < 0.0001 && cv.approved_by === 'yawar' && Number(cv.recipe_version_id) === Number(vid), 'materials: 1 kg of Urea at Rs 100; approved by the CFO, tied to the recipe: ' + (cv && cv.materials));
  { const a = await auds('recipe', vid); const who = new Set(a.map(x => x.by_user)); ok(['majid', 'himayat', 'saleem', 'yawar'].every(u => who.has(u)) && a.filter(x => !['new', 'lines'].includes(x.action)).length >= 4, 'every recipe step, by each of the 4 people, is in the change record: ' + a.map(x => x.action + ':' + x.by_user).join(', ')); }
  { const [n] = await pdq("SELECT text FROM c2m_notice WHERE for_role='production' ORDER BY id DESC LIMIT 1"); ok(n.length && /^Approved: /.test(n[0].text), 'the Production Manager is told it is approved'); }
  const cost = Number(cv.total);

  // ---- 2. A price: the CFO proposes, the COO approves
  const tp = lib.targetPrice(cost, 25); ok(Math.abs(tp - cost / 0.75) < 1e-9, 'target price = cost ÷ (1 − target)');
  const low = Math.floor(cost * 1.1);
  R = await post('yawar', '/api/c2m/prices/propose', { packId: pack, price: low, reason: 'Raw material change' }); ok(R.s === 400 && R.j && /below ta/i.test(R.j.error), 'a price below target needs a reason why: ' + JSON.stringify(R.j));
  R = await post('yawar', '/api/c2m/prices/propose', { packId: pack, price: low, reason: 'Raw material change', belowReason: 'Agreed for the season' }); const pid = R.j && (R.j.id || R.j.priceId); ok(R.s === 200 && pid, 'with the reason it goes to the COO: ' + JSON.stringify(R.j));
  R = await post('yawar', `/api/c2m/prices/${pid}/approve`); ok(R.s === 403, 'the CFO cannot approve a price');
  R = await post('tahir', `/api/c2m/prices/${pid}/approve`); ok(R.s === 200, 'the COO approves it: ' + JSON.stringify(R.j));
  { const [[p]] = await pdq('SELECT status, below_target_reason FROM c2m_price WHERE id=?', [pid]); ok(p && p.status === 'approved' && p.below_target_reason === 'Agreed for the season', 'the price is approved and keeps the reason: ' + JSON.stringify(p)); }
  { const a = await pdq("SELECT action, by_user FROM c2m_audit WHERE entity='price' AND entity_id=? ORDER BY id", [String(pid)]); ok(a[0].some(x => x.by_user === 'yawar') && a[0].some(x => x.by_user === 'tahir'), 'the proposal and the approval are in the change record: ' + a[0].map(x => x.action + ':' + x.by_user).join(', ')); }

  // ---- 3. A target: the CFO asks, the COO approves
  R = await post('yawar', '/api/c2m/targets/request', { clientProductId: cp, toGp: 22, reason: 'Agreed with the client' }); const tid = R.j && (R.j.id || R.j.requestId); ok(R.s === 200 && tid, 'the CFO asks for a new target: ' + JSON.stringify(R.j));
  R = await post('tahir', `/api/c2m/targets/${tid}/approve`); ok(R.s === 200, 'the COO approves it');
  { const [[x]] = await pdq('SELECT target_gp FROM c2m_client_product WHERE id=?', [cp]); ok(Number(x.target_gp) === 22, 'the product now carries 22%: ' + x.target_gp); }
  { const a = await auds('target', cp); ok(a.some(x => x.action === 'approve' && x.by_user === 'tahir'), 'in the change record'); }

  // ---- 4. A setting: the CFO asks, the COO approves
  { const [[s0]] = await pdq("SELECT v FROM c2m_setting WHERE k='reapprove_pct'"); ok(s0 && String(s0.v) === '3', 'the re-approval % starts at 3: ' + (s0 && s0.v)); }
  R = await post('yawar', '/api/c2m/settings', { changes: { reapprove_pct: '4' } }); ok(R.s === 200, 'the CFO asks to change the re-approval %: ' + JSON.stringify(R.j));
  { const [[s]] = await pdq("SELECT v FROM c2m_setting WHERE k='reapprove_pct'"); ok(s && String(s.v) === '3', 'it does not change before the COO approves'); }
  const [[sr]] = await pdq("SELECT id, changes_json FROM c2m_setting_request WHERE status='open' ORDER BY id DESC LIMIT 1"); ok(!!sr && String(JSON.parse(sr.changes_json).reapprove_pct) === '4', 'a request for 4% waits for the COO');
  if (sr) { R = await post('tahir', `/api/c2m/settings/requests/${sr.id}/approve`); ok(R.s === 200, 'the COO approves it: ' + JSON.stringify(R.j)); const [[s]] = await pdq("SELECT v FROM c2m_setting WHERE k='reapprove_pct'"); ok(s && String(s.v) === '4', 'the setting is 4 now'); }
  { const [[s]] = await pdq("SELECT v FROM c2m_setting WHERE k='reapprove_pct'"); const pct = lib.reapprovePct(s && s.v); ok(pct === 4 && lib.needsReapproval(100, 104.5, pct) === true && lib.needsReapproval(100, 103.5, pct) === false, 'the trigger with the approved setting read back: over 4% waits for re-approval, under it does not'); }

  // ---- 5. Gap 1: a rate change that moves a cost past the re-approval % creates a re-approval item; the COO approves the new cost
  { const isMon = new Date().getDay() === 1; // Monday is cost day: the change goes in at once; any other day it waits, and urgent goes to the COO
    R = await post('yawar', '/api/c2m/rates', { gradeId: grade, rate: 120, source: 'Supplier price, 26 Nov', confirmed: true, urgent: true, reason: 'Supplier raised the price today' });
    ok(R.s === 200, 'the CFO saves Urea at Rs 120 (was 100), as urgent: ' + JSON.stringify(R.j).slice(0, 200));
    if (!isMon) { const [[pd]] = await pdq("SELECT id, status FROM c2m_cost_pending WHERE status='waiting' ORDER BY id DESC LIMIT 1"); ok(!!pd, 'not Monday: the change waits for the COO');
      { const [[cv0]] = await pdq('SELECT total FROM c2m_cost_version WHERE client_pack_id=? ORDER BY id DESC LIMIT 1', [pack]); const [[rr0]] = await pdq("SELECT COUNT(*) n FROM c2m_reapproval WHERE status='open'"); ok(Number(cv0.total) === 112 && Number(rr0.n) === 0, 'nothing moves before the COO approves'); }
      if (pd) { R = await post('yawar', `/api/c2m/costs/pending/${pd.id}/approve`); ok(R.s === 403, 'the CFO cannot approve an urgent change');
        R = await post('tahir', `/api/c2m/costs/pending/${pd.id}/approve`); ok(R.s === 200, 'the COO approves it now: ' + JSON.stringify(R.j).slice(0, 200)); } }
    const [[re]] = await pdq("SELECT id, items_json, cause FROM c2m_reapproval WHERE status='open' ORDER BY id DESC LIMIT 1");
    const items = re ? JSON.parse(re.items_json) : []; const it0 = items.find(x => Number(x.packId) === Number(pack));
    ok(!!it0, 'a re-approval item names the pack: ' + (re && re.cause) + ' ' + JSON.stringify(it0));
    { const [[cvx]] = await pdq('SELECT total FROM c2m_cost_version WHERE client_pack_id=? ORDER BY id DESC LIMIT 1', [pack]); ok(Number(cvx.total) === 112, 'the approved cost stays Rs 112 until the COO decides'); }
    if (re) { R = await post('majid', `/api/c2m/reapprovals/${re.id}/approve`); ok(R.s === 403, 'the Production Manager cannot decide a re-approval');
      R = await post('yawar', `/api/c2m/reapprovals/${re.id}/approve`); ok(R.s === 200, 'the CFO, who approves costs, approves the new cost (reapproval.decide, c2m-access.js): ' + JSON.stringify(R.j).slice(0, 200));
      const [[cv2]] = await pdq('SELECT total, materials, approved_by FROM c2m_cost_version WHERE client_pack_id=? ORDER BY id DESC LIMIT 1', [pack]); ok(Number(cv2.total) === 132 && Number(cv2.materials) === 120 && cv2.approved_by === 'yawar', 'the approved cost is Rs 132 now (materials 120 + packing 2 + labour and FOH 10), approved by the CFO: ' + JSON.stringify(cv2));
      const a = await auds('reapproval', re.id); ok(a.some(x => x.by_user === 'yawar'), 'the decision is in the change record: ' + a.map(x => x.action + ':' + x.by_user).join(', ')); }
    const ra = (await pdq("SELECT by_user FROM c2m_audit WHERE entity='rate' ORDER BY id DESC LIMIT 1"))[0]; ok(ra.length && ra[0].by_user === 'yawar', 'the rate itself is in the change record, by the CFO: ' + JSON.stringify(ra)); }
  { const [[small]] = await pdq('SELECT COUNT(*) n FROM c2m_reapproval'); R = await post('yawar', '/api/c2m/rates', { gradeId: grade, rate: 121, source: 'small move', confirmed: true, urgent: true, reason: 'Small change today' });
    const [[pd2]] = await pdq("SELECT id FROM c2m_cost_pending WHERE status='waiting' ORDER BY id DESC LIMIT 1"); if (pd2) await post('tahir', `/api/c2m/costs/pending/${pd2.id}/approve`);
    const [[after]] = await pdq('SELECT COUNT(*) n FROM c2m_reapproval'); const [[rt]] = await pdq('SELECT rate FROM c2m_material_rate WHERE grade_id=? ORDER BY id DESC LIMIT 1', [grade]);
    ok(R.s === 200 && Number(rt.rate) === 121 && Number(after.n) === Number(small.n), 'a move under 4% (Rs 132 to 133) goes in and creates no re-approval item'); }

  // ---- 6. Gap 2: an unmatched O2S name, settled to a VAN brand product, is costed under it
  { const [vc] = await pdqT("INSERT INTO c2m_customer (name, o2s_names, grp, segment) VALUES ('VAN Agri','VAN Agri','VAN brand','Distributor')");
    const [vp] = await pdqT("INSERT INTO c2m_client_product (customer_id, channel, brand, o2s_brand) VALUES (?, 'VAN brand', 'Humi Grow', 'Humi Grow')", [vc.insertId]); const vpid = vp.insertId;
    await pdqT('INSERT INTO c2m_client_pack (client_product_id, pack_size) VALUES (?, 25)', [vpid]);
    await pdqT("INSERT INTO c2m_o2s_po_line (line_id, po, received, customer_name, channel, brand, pack, ordered_kg, dispatched_kg, net_price, sync_id) VALUES ('L1','PO-77',DATE_SUB(CURDATE(), INTERVAL 20 DAY),'Ali Traders','Vgreen','Humi Gro',25,500,500,150,1)");
    await pdqT("INSERT INTO c2m_o2s_truck (id, line_id, po, truck_date, kg, sync_id) VALUES ('T1','L1','PO-77',DATE_SUB(CURDATE(), INTERVAL 15 DAY),250,1), ('T2','L1','PO-77',DATE_SUB(CURDATE(), INTERVAL 10 DAY),250,1)");
    const st = async () => (await call('tahir', 'GET', '/api/c2m/state')).j || {};
    let U = (await st()).unmatched || []; ok(U.some(u => u.brand === 'Humi Gro' && Math.abs(u.kg - 500) < 1e-6), 'blocker: the misspelt O2S name is unmatched, 500 kg with no cost: ' + JSON.stringify(U));
    R = await post('yawar', '/api/c2m/names/o2s', { name: 'Humi Gro', productId: vpid, size: 50 }); ok(R.s === 400 && R.j && /has no 50 pack/.test(R.j.error), 'a size the product does not have is refused: ' + JSON.stringify(R.j));
    R = await post('yawar', '/api/c2m/names/o2s', { name: 'Humi Gro', productId: cp, size: 10 }); ok(R.s === 400 && R.j && /VAN brand product/.test(R.j.error), 'a white label product is refused: ' + JSON.stringify(R.j));
    R = await post('majid', '/api/c2m/names/o2s', { name: 'Humi Gro', productId: vpid, size: 25 }); ok(R.s === 403, 'a person without the right is refused');
    R = await post('yawar', '/api/c2m/names/o2s', { name: 'Humi Gro', productId: vpid, size: 25 }); ok(R.s === 200 && R.j && R.j.changed === 1 && R.j.impact && R.j.impact.join && R.j.impact.join.trucks === 2, 'the CFO settles it: the 2 trucks join the product: ' + JSON.stringify(R.j));
    { const [[x]] = await pdq('SELECT o2s_brand FROM c2m_client_product WHERE id=?', [vpid]); ok(/(^|\|)Humi Gro(\||$)/.test(x.o2s_brand) && /(^|\|)Humi Grow(\||$)/.test(x.o2s_brand), 'the product keeps its name and gains the spelling: ' + x.o2s_brand); }
    const S2 = await st(); U = S2.unmatched || []; ok(!U.some(u => u.brand === 'Humi Gro'), 'the name is no longer unmatched');
    { const sl = (S2.sales || []).filter(x => x.brand === 'Humi Gro'); ok(sl.length === 2 && sl.every(x => x.packId), 'its 2 trucks are now tied to the pack: ' + JSON.stringify(sl.map(x => x.packId))); }
    { const a = await auds('product_name', vpid); ok(a.some(x => x.action === 'o2s_names' && x.by_user === 'yawar'), 'the settling is in the change record'); }
    R = await post('yawar', '/api/c2m/names/o2s', { name: 'Humi Gro', productId: vpid, size: 25 }); ok(R.s === 200 && R.j && R.j.changed === 0, 'settling it again changes nothing'); }

  srv.close(); await pool.end();
  console.log(`routes-p4: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
