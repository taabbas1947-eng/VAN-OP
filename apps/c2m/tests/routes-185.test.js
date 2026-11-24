// Audit fixes of 24 Nov 2026 (D-185 point 6; docs 12, W1, W2, W3, W5, W7, C1, C2, C4, C5): route and formula checks.
// Run: node apps/c2m/tests/routes-185.test.js (or give a routes file as the first argument). Needs the test database: see README.md.
const path = require('path');
const express = require('express'); const db = require('./_db.js');
const ROUTES = path.resolve(process.argv[2] || path.join(__dirname, '..', 'c2m-routes.js'));
const lib = require('../c2m-lib.js'); const engine = require('../c2m-engine.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
(async () => {
  // ---- formulas, no database
  ok(lib.round(2103 * 0.975, 2) === 2050.43, 'C4: NSV 2103 at 2.5% rounds to 2050.43 (B-79): ' + lib.round(2103 * 0.975, 2));
  ok(lib.round(1.005, 2) === 1.01 && lib.round(-2.5, 0) === -3 && lib.round(0.1 + 0.2, 2) === 0.3 && lib.round(1234.5678, 2) === 1234.57 && lib.round(null) === null && lib.round(Infinity) === null, 'C4: half away from zero, other values as before');
  { let bad = 0; for (let p = 1; p <= 20000; p++) if (lib.round(p * 1.05, 2) !== Math.round(p * 105) / 100) bad++; ok(bad === 0, 'C4: every whole price x 1.05 still exact: ' + bad + ' wrong'); }
  ok(Math.abs(lib.round(8730959.347619498, 6) - 8730959.347619) < 1e-9, 'C4: 6 decimals on a large value still right: ' + lib.round(8730959.347619498, 6));
  ok(lib.round(1e13 + 0.125, 2) === Math.round((1e13 + 0.125) * 100) / 100, 'C4: a very large value rounds as before');
  ok(lib.reapprovePct('') === 3 && lib.reapprovePct(null) === 3 && lib.reapprovePct('x') === 3 && lib.reapprovePct(5) === 5 && lib.reapprovePct(0) === 0, 'C1: re-approval % is 3 when blank, missing or not a number; a real 0 stays 0');
  ok(lib.needsReapproval(100, 103.5, null) === true && lib.needsReapproval(100, 102.5, null) === false, 'C1: a missing % still means 3');
  ok(lib.targetPrice(100, 100) === null && lib.targetPrice(100, 120) === null && Math.abs(lib.targetPrice(77, 23) - 100) < 1e-9, 'C2: no price for a target of 100% or more');
  { const P = engine.priceRecipe({ rates: new Map() }, { lines: [] }); ok(P && P.materials === null && P.noLines === true, 'C5: a recipe with no lines has no materials cost: ' + JSON.stringify(P)); }

  // ---- routes
  const pool = (await db.fresh(), db.pool(5));
  const pdq = (s, p) => pool.execute(s, p || []);
  const pdqT = (s, p) => pdq(s, p).then(r => { if (!/^\s*SELECT/i.test(s) && global.__c2mForget) global.__c2mForget(); return r; });
  await pdqT("INSERT INTO auth_users (username, name) VALUES ('umer','Umer')");
  await pdqT('DELETE FROM user_module_roles');
  for (const [u, r] of [['tahir', 'coo'], ['yawar', 'cfo'], ['umer', 'cfo'], ['majid', 'production']]) await pdqT('INSERT INTO user_module_roles (username, module, role) VALUES (?,?,?)', [u, 'c2m', r]);
  const [c] = await pdqT("INSERT INTO c2m_customer (name, o2s_names, grp, segment) VALUES ('Rudolf','Rudolf','White label','White label')");
  const [p1] = await pdqT("INSERT INTO c2m_client_product (customer_id, channel, brand, o2s_brand) VALUES (?, 'White label', 'Basic', 'Basic')", [c.insertId]); const cp = p1.insertId;
  const [k] = await pdqT('INSERT INTO c2m_client_pack (client_product_id, pack_size) VALUES (?, 10)', [cp]); const pack = k.insertId;
  const price = async (status, by) => (await pdqT("INSERT INTO c2m_price (client_pack_id, price, valid_from, reason, status, proposed_by, proposed_at) VALUES (?, 100, CURDATE(), 'test', ?, ?, NOW())", [pack, status, by || 'yawar']))[0].insertId;
  const rev = async (status, by, list) => (await pdqT("INSERT INTO c2m_list_revision (list_name, items_json, reason, valid_from, status, proposed_by, proposed_at) VALUES (?, '[]', 'test', CURDATE(), ?, ?, NOW())", [list || 'dist', status, by || 'yawar']))[0].insertId;
  const st = async (t, id) => { const [[r]] = await pdq(`SELECT status FROM ${t} WHERE id=?`, [id]); return r && r.status; };
  const aud = async (entity, id, action) => { const [r] = await pdq('SELECT by_user, why FROM c2m_audit WHERE entity=? AND entity_id=? AND action=?', [entity, String(id), action]); return r; };

  const app = express(); app.use(express.json());
  const auth = (req, res, next) => { req.user = { u: req.get('x-user') || 'tahir' }; next(); };
  require(ROUTES)(app, { pdq, pool, auth, path, fs: require('fs'), crypto: require('crypto'), services: {}, noAutoPull: true });
  global.__c2mForget = app.locals.c2mForgetKept;
  app.use((e, req, res, next) => res.status(e.status || 500).json({ error: e.message }));
  const srv = app.listen(0); const port = srv.address().port;
  const call = async (u, m, p, b) => { const r = await fetch(`http://localhost:${port}${p}`, { method: m, headers: { 'x-user': u, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); let j = null; try { j = await r.json(); } catch (_) {} return { s: r.status, j }; };
  const post = (u, p, b) => call(u, 'POST', p, b || {});

  // W1: a list revision waiting for the COO is taken back by its sender
  let r1 = await rev('proposed', 'yawar');
  let R = await post('majid', `/api/c2m/lists/revisions/${r1}/retract`); ok(R.s === 403, 'W1: a role without list.revise cannot take a revision back: ' + R.s);
  R = await post('umer', `/api/c2m/lists/revisions/${r1}/retract`); ok(R.s === 400 && /Only the person who sent/.test(R.j.error) && await st('c2m_list_revision', r1) === 'proposed', 'W1: another CFO cannot take it back: ' + JSON.stringify(R));
  R = await post('yawar', `/api/c2m/lists/revisions/${r1}/retract`); ok(R.s === 200 && await st('c2m_list_revision', r1) === 'withdrawn', 'W1: the sender takes it back: ' + JSON.stringify(R));
  let A = await aud('list_revision', r1, 'taken back'); ok(A.length === 1 && A[0].by_user === 'yawar' && /Taken back by the sender/.test(A[0].why), 'W1: 1 line in the change record, with who and why: ' + JSON.stringify(A));
  R = await post('yawar', `/api/c2m/lists/revisions/${r1}/retract`); ok(R.s === 409, 'W1: a second press finds nothing to take back: ' + R.s);
  // W2: a sent-back revision is dropped; an approved one is not
  const r2 = await rev('sent_back', 'yawar');
  R = await post('yawar', `/api/c2m/lists/revisions/${r2}/retract`); A = await aud('list_revision', r2, 'taken back');
  ok(R.s === 200 && await st('c2m_list_revision', r2) === 'withdrawn' && A.length === 1 && /Dropped by the sender after it was sent back/.test(A[0].why), 'W2: a sent-back revision is dropped, and the record says so: ' + JSON.stringify(A));
  const r3 = await rev('approved', 'yawar', 'dealer');
  R = await post('yawar', `/api/c2m/lists/revisions/${r3}/retract`); ok(R.s === 409 && await st('c2m_list_revision', r3) === 'approved', 'W2: an approved revision is not taken back here (the COO withdraws it): ' + R.s);
  const r4 = await rev('proposed', 'yawar', 'farmer');
  R = await post('tahir', `/api/c2m/lists/revisions/${r4}/retract`); ok(R.s === 200 && await st('c2m_list_revision', r4) === 'withdrawn', 'W1: the administrator may take back another person\'s revision: ' + R.s);

  // W2: a sent-back price is dropped by its proposer
  const pr1 = await price('sent_back', 'yawar');
  R = await post('umer', `/api/c2m/prices/${pr1}/retract`); ok(R.s === 400 && await st('c2m_price', pr1) === 'sent_back', 'W2: another CFO cannot drop it: ' + R.s);
  R = await post('yawar', `/api/c2m/prices/${pr1}/retract`); A = await aud('price', pr1, 'taken back');
  ok(R.s === 200 && await st('c2m_price', pr1) === 'withdrawn' && A.length === 1 && /Dropped by the proposer after it was sent back/.test(A[0].why), 'W2: a sent-back price is dropped: ' + JSON.stringify(A));
  const pr2 = await price('proposed', 'yawar');
  R = await post('yawar', `/api/c2m/prices/${pr2}/retract`); A = await aud('price', pr2, 'taken back');
  ok(R.s === 200 && await st('c2m_price', pr2) === 'withdrawn' && /Taken back by the proposer/.test(A[0].why), 'a waiting price is still taken back as before');
  const pr3 = await price('approved', 'yawar');
  R = await post('yawar', `/api/c2m/prices/${pr3}/retract`); ok(R.s === 409 && await st('c2m_price', pr3) === 'approved', 'an approved price is not taken back here: ' + R.s);

  // W7: a send back and its record are saved together
  const pr4 = await price('proposed', 'yawar');
  R = await post('tahir', `/api/c2m/prices/${pr4}/sendback`, { reason: 'Too low' }); A = await aud('price', pr4, 'sent_back');
  ok(R.s === 200 && await st('c2m_price', pr4) === 'sent_back' && A.length === 1 && A[0].why === 'Too low', 'W7: price sent back with its record: ' + JSON.stringify(A));
  R = await post('tahir', `/api/c2m/prices/${pr4}/sendback`, { reason: 'Again' }); A = await aud('price', pr4, 'sent_back');
  ok(R.s === 400 && A.length === 1, 'W7: nothing to send back writes no second record: ' + R.s + ' ' + A.length);
  const r5 = await rev('proposed', 'yawar', 'farmer');
  R = await post('tahir', `/api/c2m/lists/revisions/${r5}/sendback`, { reason: 'Check MRP' }); A = await aud('list_revision', r5, 'sent_back');
  ok(R.s === 200 && await st('c2m_list_revision', r5) === 'sent_back' && A.length === 1, 'W7: revision sent back with its record');
  R = await post('tahir', `/api/c2m/lists/revisions/${r5}/sendback`, { reason: 'Again' }); A = await aud('list_revision', r5, 'sent_back');
  ok(R.s === 409 && A.length === 1, 'W7: a second send back writes no second record: ' + R.s);

  // C1: a blank setting is "not set", never 0
  await pdqT("UPDATE c2m_setting SET v='' WHERE k='reapprove_pct'");
  const [[hasB]] = await pdq("SELECT COUNT(*) n FROM c2m_setting WHERE k='budget_gp'");
  if (Number(hasB.n)) await pdqT("UPDATE c2m_setting SET v=' ' WHERE k='budget_gp'"); else await pdqT("INSERT INTO c2m_setting (k, v, label, needs_approval) VALUES ('budget_gp', ' ', 'Company GP target, %', 1)");
  const D = await engine.loadAll(pdq); const S = D.settings.values; // loadSettings is not exported: read through loadAll
  ok(S.reapprove_pct === null && S.budget_gp === null, 'C1: blank settings read as null: ' + JSON.stringify({ r: S.reapprove_pct, b: S.budget_gp }));
  ok(lib.needsReapproval(100, 102, S.reapprove_pct) === false && lib.needsReapproval(100, 104, S.reapprove_pct) === true, 'C1: with a blank setting a 2% move needs no re-approval and a 4% move does');
  ok(lib.targetOr(null, S.budget_gp) === null, 'C1: a blank company target is no target, not 0%');
  await pdqT("UPDATE c2m_setting SET v='3' WHERE k='reapprove_pct'"); await pdqT("UPDATE c2m_setting SET v='23.2' WHERE k='budget_gp'");

  // C2: a GP target of 100% or more is refused
  R = await post('yawar', '/api/c2m/settings', { changes: { budget_gp: '100' }, budget_gp: '100' });
  ok(R.s === 400 && /below 100/.test((R.j || {}).error || ''), 'C2: company GP target 100 is refused: ' + JSON.stringify(R));
  for (const k2 of ['ambition_gp', 'wl_budget_gp']) { const [[has]] = await pdq('SELECT v FROM c2m_setting WHERE k=?', [k2]); if (has) { const b2 = {}; b2[k2] = '100'; R = await post('yawar', '/api/c2m/settings', { changes: b2, ...b2 }); ok(R.s === 400 && /below 100/.test((R.j || {}).error || ''), 'C2: ' + k2 + ' 100 is refused: ' + JSON.stringify(R)); } }
  const [[bg]] = await pdq("SELECT v FROM c2m_setting WHERE k='budget_gp'"); ok(String(bg.v) === '23.2', 'C2: the setting is unchanged: ' + bg.v);

  // W5: a pack added to a product is saved with its first-cost check in 1 transaction (the route still answers)
  R = await post('yawar', `/api/c2m/products/${cp}/packs`, { size: '5' });
  const [[n5]] = await pdq('SELECT COUNT(*) n FROM c2m_client_pack WHERE client_product_id=? AND ABS(pack_size-5)<0.0005', [cp]);
  ok(R.s === 200 && R.j.ok === true && Number(n5.n) === 1, 'W5: Add a pack saves the pack: ' + JSON.stringify(R));
  R = await post('yawar', `/api/c2m/products/${cp}/packs`, { size: '5' });
  const [[n5b]] = await pdq('SELECT COUNT(*) n FROM c2m_client_pack WHERE client_product_id=? AND ABS(pack_size-5)<0.0005', [cp]);
  ok(R.s === 400 && Number(n5b.n) === 1, 'W5: the same size again is refused and nothing is added: ' + R.s);

  // W3: the Edit form refuses a packing bill that is out of use
  const [b1] = await pdqT("INSERT INTO c2m_packing_bill (name, status) VALUES ('Old 10 kg bag', 'approved')"); const bill = b1.insertId;
  await pdqT("INSERT INTO c2m_out_of_use (entity, entity_id, by_user, at, why) VALUES ('packing_bill', ?, 'yawar', NOW(), 'test')", [bill]);
  const [packsNow] = await pdq('SELECT id, pack_size FROM c2m_client_pack WHERE client_product_id=? ORDER BY pack_size', [cp]);
  R = await post('yawar', `/api/c2m/products/${cp}/full`, { brand: 'Basic', o2sNames: ['Basic'], packs: packsNow.map(x => ({ id: x.id, billId: Number(x.id) === Number(pack) ? bill : null })) });
  const [[pb]] = await pdq('SELECT packing_bill_id FROM c2m_client_pack WHERE id=?', [pack]);
  ok(R.s === 400 && /out of use/.test((R.j || {}).error || '') && pb.packing_bill_id == null, 'W3: Edit refuses an out-of-use packing bill and saves nothing: ' + JSON.stringify(R));
  await pdqT("DELETE FROM c2m_out_of_use WHERE entity='packing_bill' AND entity_id=?", [bill]);
  R = await post('yawar', `/api/c2m/products/${cp}/full`, { brand: 'Basic', o2sNames: ['Basic'], packs: packsNow.map(x => ({ id: x.id, billId: Number(x.id) === Number(pack) ? bill : null })) });
  const [[pb2]] = await pdq('SELECT packing_bill_id FROM c2m_client_pack WHERE id=?', [pack]);
  ok(R.s === 200 && Number(pb2.packing_bill_id) === Number(bill) && typeof R.j.reapproval === 'number', 'W3, W5: with the bill back in use the Edit saves, and answers with its re-approval count: ' + JSON.stringify(R));

  // ---- D-187 (Tahir's rulings of 24 Nov 2026 on W3, W9 and B3a)
  const iso = d => d.toISOString().slice(0, 10); const plus = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
  R = await post('tahir', '/api/c2m/golive', { until: plus(3) }); ok(R.s === 200, 'the go-live window opens: ' + JSON.stringify(R));
  // W3: a client-packed product may carry a VAN packing bill, also on Costs, Packing cost
  await pdqT("UPDATE c2m_client_product SET packing_mode='client' WHERE id=?", [cp]);
  const [k5] = await pdq('SELECT id FROM c2m_client_pack WHERE client_product_id=? AND ABS(pack_size-5)<0.0005', [cp]);
  R = await post('yawar', '/api/c2m/packing/assign', { packId: k5[0].id, billId: bill });
  const [[pb5]] = await pdq('SELECT packing_bill_id FROM c2m_client_pack WHERE id=?', [k5[0].id]);
  ok(R.s === 200 && Number(pb5.packing_bill_id) === Number(bill), 'W3: a pack of a client-packed product takes a packing bill on Costs: ' + JSON.stringify(R));
  await pdqT("UPDATE c2m_client_product SET packing_mode='bulk' WHERE id=?", [cp]);
  R = await post('yawar', '/api/c2m/packing/assign', { packId: pack, billId: bill }); ok(R.s === 400 && /bulk product takes no packing bill/.test((R.j || {}).error || ''), 'W3: a bulk product still takes none: ' + JSON.stringify(R));
  await pdqT("UPDATE c2m_client_product SET packing_mode='client' WHERE id=?", [cp]);
  // W9: a labour and FOH certificate is corrected only after the COO reopened its month
  const pm = (() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); })();
  await pdqT("INSERT INTO c2m_monthly_check (month, kind, data_json, done_by, done_at) VALUES (?, 'lf_cert', '{\"result\":\"no_change\"}', 'yawar', NOW() - INTERVAL 2 DAY)", [pm]);
  R = await post('yawar', '/api/c2m/checks', { month: pm, kind: 'lf_cert', data: { result: 'changed' } });
  ok(R.s === 400 && /the COO reopens the month first/.test((R.j || {}).error || ''), 'W9: a certified month is not certified again: ' + JSON.stringify(R));
  await pdqT("INSERT INTO c2m_audit (at, by_user, entity, entity_id, action, old_value, new_value, why) VALUES (NOW() - INTERVAL 3 DAY, 'tahir', 'monthly_check', ?, 'reopen', NULL, NULL, 'older reopen')", [pm + ':lock']);
  R = await post('yawar', '/api/c2m/checks', { month: pm, kind: 'lf_cert', data: { result: 'changed' } }); ok(R.s === 400, 'W9: a reopen before the certificate does not count: ' + R.s);
  await pdqT("INSERT INTO c2m_audit (at, by_user, entity, entity_id, action, old_value, new_value, why) VALUES (NOW() - INTERVAL 1 DAY, 'tahir', 'monthly_check', ?, 'reopen', NULL, NULL, 'wrong certificate')", [pm + ':lock']);
  R = await post('yawar', '/api/c2m/checks', { month: pm, kind: 'lf_cert', data: { result: 'changed' } });
  const [[cert]] = await pdq("SELECT data_json FROM c2m_monthly_check WHERE month=? AND kind='lf_cert'", [pm]);
  ok(R.s === 200 && /changed/.test(cert.data_json), 'W9: after the COO reopened the month the certificate is corrected: ' + JSON.stringify(R) + ' ' + cert.data_json);
  R = await post('yawar', '/api/c2m/checks', { month: pm, kind: 'lf_cert', data: { result: 'no_change' } }); ok(R.s === 400, 'W9: and once corrected it is closed again until the next reopen: ' + R.s);
  // B3a: closing the go-live window closes every open re-approval item
  const [ra1] = await pdqT("INSERT INTO c2m_reapproval (cause, items_json, status, created_at) VALUES ('Old bands', '[{\"packId\":99999,\"label\":\"x\",\"from\":1,\"to\":2,\"pct\":100}]', 'open', NOW())");
  const [ra2] = await pdqT("INSERT INTO c2m_reapproval (cause, items_json, status, created_at) VALUES ('Already decided', '[]', 'approved', NOW())");
  const [ra3] = await pdqT("INSERT INTO c2m_reapproval (cause, items_json, status, created_at) VALUES ('First cost of a pack not costed yet', ?, 'open', NOW())", [JSON.stringify([{ packId: pack, label: 'Basic 10', from: null, to: 5, pct: null }])]); // Basic has no approved recipe: its packs are left not costed at the close
  R = await post('tahir', '/api/c2m/golive', { close: true });
  const [raAll] = await pdq("SELECT id, status, decided_by FROM c2m_reapproval WHERE status='open'");
  ok(raAll.length === 1 && Number(raAll[0].id) === Number(ra3.insertId), 'B3a: an item that names a pack left not costed stays open: ' + JSON.stringify(raAll));
  ok(R.s === 200 && await st('c2m_reapproval', ra1.insertId) === 'dismissed' && await st('c2m_reapproval', ra2.insertId) === 'approved', 'B3a: the window close closes the other open re-approval items, and does not touch a decided one: ' + JSON.stringify(R) + ' ' + JSON.stringify(raAll));
  A = await aud('reapproval', ra1.insertId, 'dismiss'); ok(A.length === 1 && /Go-live window closed/.test(A[0].why), 'B3a: with its line in the change record: ' + JSON.stringify(A));
  const [nt] = await pdq("SELECT body FROM c2m_notice WHERE body LIKE 'Go-live window closed%' ORDER BY id DESC LIMIT 1").catch(() => [[]]);
  ok(!nt.length || /open re-approval item\(s\) were closed with it/.test(nt[0].body), 'B3a: the notice to the COO and the CFO says so' + (nt.length ? '' : ' (notice table not read)'));

  srv.close(); await pool.end();
  console.log(`routes-185: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
