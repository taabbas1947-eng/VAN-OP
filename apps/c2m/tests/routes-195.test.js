// B10 and B14 (D-195, 25 Nov 2026): the red clients marked as seen, and the Remind of a stuck recipe: route checks.
// Run: node apps/c2m/tests/routes-195.test.js (or give a routes file as the first argument). Needs the test database: see README.md.
const path = require('path');
const express = require('express'); const db = require('./_db.js');
const ROUTES = path.resolve(process.argv[2] || path.join(__dirname, '..', 'c2m-routes.js'));
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
(async () => {
  const pool = (await db.fresh(), db.pool(5));
  const pdq = (s, p) => pool.execute(s, p || []);
  const pdqT = (s, p) => pdq(s, p).then(r => { if (!/^\s*SELECT/i.test(s) && global.__c2mForget) global.__c2mForget(); return r; });
  await pdqT('DELETE FROM user_module_roles');
  for (const [u, r] of [['tahir', 'coo'], ['yawar', 'cfo'], ['majid', 'production']]) await pdqT('INSERT INTO user_module_roles (username, module, role) VALUES (?,?,?)', [u, 'c2m', r]);
  const [c] = await pdqT("INSERT INTO c2m_customer (name, o2s_names, grp, segment) VALUES ('Rudolf','Rudolf','White label','White label')");
  const [p1] = await pdqT("INSERT INTO c2m_client_product (customer_id, channel, brand, o2s_brand) VALUES (?, 'White label', 'Basic', 'Basic')", [c.insertId]); const cp = p1.insertId;
  await pdqT('INSERT INTO c2m_client_pack (client_product_id, pack_size) VALUES (?, 10)', [cp]);
  const [v1] = await pdqT("INSERT INTO c2m_recipe_version (client_product_id, version_no, state, created_by, created_at) VALUES (?, 1, 'review', 'majid', NOW())", [cp]); const vr = v1.insertId;
  const [v2] = await pdqT("INSERT INTO c2m_recipe_version (client_product_id, version_no, state, created_by, created_at) VALUES (?, 2, 'approved', 'majid', NOW())", [cp]); const va = v2.insertId;

  const app = express(); app.use(express.json());
  const auth = (req, res, next) => { req.user = { u: req.get('x-user') || 'tahir' }; next(); };
  require(ROUTES)(app, { pdq, pool, auth, path, fs: require('fs'), crypto: require('crypto'), services: {}, noAutoPull: true });
  global.__c2mForget = app.locals.c2mForgetKept;
  app.use((e, req, res, next) => res.status(e.status || 500).json({ error: e.message }));
  const srv = app.listen(0); const port = srv.address().port;
  const call = async (u, m, p, b) => { const r = await fetch(`http://localhost:${port}${p}`, { method: m, headers: { 'x-user': u, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); let j = null; try { j = await r.json(); } catch (_) {} return { s: r.status, j }; };
  const post = (u, p, b) => call(u, 'POST', p, b || {});
  const state = async u => (await call(u, 'GET', '/api/c2m/state')).j || {};

  // B14: Remind
  let R = await post('yawar', `/api/c2m/recipes/${vr}/remind`); ok(R.s === 403, 'B14: only the COO reminds: ' + R.s);
  R = await post('tahir', `/api/c2m/recipes/${va}/remind`); ok(R.s === 400 && /not waiting on anyone/.test(R.j.error), 'B14: an approved recipe waits on nobody: ' + JSON.stringify(R.j));
  R = await post('tahir', `/api/c2m/recipes/${vr}/remind`); ok(R.s === 200 && R.j.role === 'qc', 'B14: a recipe at review reminds the QC Head: ' + JSON.stringify(R.j));
  { const [n] = await pdq("SELECT for_role, text, by_user FROM c2m_notice WHERE for_role='qc' ORDER BY id DESC LIMIT 1"); ok(n.length && /^Reminder from /.test(n[0].text) && /Basic/.test(n[0].text) && n[0].by_user === 'tahir', 'B14: the QC Head gets a notice in C2M: ' + (n[0] && n[0].text)); }
  { const [a] = await pdq("SELECT by_user, action FROM c2m_audit WHERE entity='recipe_remind' AND entity_id=?", [String(vr)]); ok(a.length === 1 && a[0].by_user === 'tahir', 'B14: the reminder is in the change record'); }
  R = await post('tahir', `/api/c2m/recipes/${vr}/remind`); ok(R.s === 400 && /already sent today/.test(R.j.error), 'B14: at most 1 a day for each recipe');
  { const s = await state('tahir'); ok(Array.isArray(s.remindedToday) && s.remindedToday.includes(vr), 'B14: the state tells the COO what was reminded today: ' + JSON.stringify(s.remindedToday)); }
  { const s = await state('yawar'); ok(s.remindedToday === undefined && s.redSeen === undefined, 'B10, B14: other roles get neither list'); }

  // B10: red clients seen
  { const s = await state('tahir'); ok(s.redSeen === null, 'B10: nothing marked yet: ' + JSON.stringify(s.redSeen)); }
  R = await post('yawar', '/api/c2m/redseen', { clients: ['Rudolf'] }); ok(R.s === 403, 'B10: only the COO marks red clients as seen');
  R = await post('tahir', '/api/c2m/redseen', { clients: 'Rudolf' }); ok(R.s === 400, 'B10: a list is needed');
  R = await post('tahir', '/api/c2m/redseen', { clients: ['Rudolf', 'Rudolf', ' ', 'Maxim Agri'] }); ok(R.s === 200 && R.j.clients.join() === 'Rudolf,Maxim Agri', 'B10: saved once each, blanks dropped: ' + JSON.stringify(R.j));
  { const s = await state('tahir'); ok(JSON.stringify(s.redSeen) === '["Rudolf","Maxim Agri"]', 'B10: the state carries the last list: ' + JSON.stringify(s.redSeen)); }
  { const r = await call('tahir', 'GET', '/api/c2m/audit?limit=50'); const rows = (r.j && r.j.rows) || []; ok(rows.some(x => x.entity === 'recipe_remind') && !rows.some(x => x.entity === 'red_seen'), 'B10: marking as seen is not a change in the change record'); }

  srv.close(); await pool.end();
  console.log(`routes-195: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
