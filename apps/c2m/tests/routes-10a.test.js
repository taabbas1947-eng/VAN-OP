// Push 10a route checks, run against the throwaway test database (apps/c2m/tests/_db.js)
// Run: node apps/c2m/tests/routes-10a.test.js (or give a routes file as the first argument). Needs the test database: see README.md.
const path = require('path');
const express = require('express'); const db = require('./_db.js');
const ROUTES = path.resolve(process.argv[2] || path.join(__dirname, '..', 'c2m-routes.js'));
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
(async () => {
  const pool = (await db.fresh(), db.pool(5));
  const pdq = (s, p) => pool.execute(s, p || []);
  const pdqT = (s, p) => pdq(s, p).then(r => { if (!/^\s*SELECT/i.test(s) && global.__c2mForget) global.__c2mForget(); return r; }); // push 10j: a direct write is a hand change; C2M forgets its kept answers
  await pdqT("DELETE FROM user_module_roles"); await pdqT("DELETE FROM c2m_notice"); await pdqT("DELETE FROM c2m_price_doc"); await pdqT("DELETE FROM c2m_list_grant"); await pdqT("DELETE FROM c2m_audit WHERE entity='notices_read'");
  for (const [u, r] of [['tahir', 'coo'], ['ali', 'viewer'], ['saad', 'viewer']]) await pdqT('INSERT INTO user_module_roles (username, module, role) VALUES (?,?,?)', [u, 'c2m', r]);
  for (let i = 0; i < 45; i++) await pdqT("INSERT INTO c2m_notice (for_role, text, by_user, at) VALUES ('coo', ?, 'yawar', NOW())", ['Notice ' + i]);
  const fields = JSON.stringify({ fields: ['now'], client: null, reasons: {}, note: '', snapshot: { list: [], eff: '2026-10-11', till: '2026-10-20' } });
  await pdqT("INSERT INTO c2m_price_doc (ref, audience, addressee, fields_json, effective, valid_till, created_by, created_at) VALUES ('VAN/PL/2026/001','dist','Distributors',?, '2026-10-11','2026-10-20','tahir',NOW())", [fields]);
  await pdqT("INSERT INTO c2m_price_doc (ref, audience, addressee, fields_json, effective, valid_till, created_by, created_at) VALUES ('VAN/PL/2026/002','dealer','Dealers',?, '2026-10-11',NULL,'tahir',NOW())", [fields]);
  await pdqT("INSERT INTO c2m_list_grant (username, grant_kind, grant_value, granted_by, granted_at) VALUES ('ali','list','dist','tahir',NOW())");
  const app = express(); app.use(express.json());
  const auth = (req, res, next) => { req.user = { u: req.get('x-user') || 'tahir' }; next(); };
  require(ROUTES)(app, { pdq, pool, auth, path, fs: require('fs'), crypto: require('crypto'), services: {}, noAutoPull: true });
  global.__c2mForget = app.locals.c2mForgetKept;
  app.use((e, req, res, next) => res.status(e.status || 500).json({ error: e.message }));
  const srv = app.listen(0); const port = srv.address().port;
  const call = async (u, m, p, b) => { const r = await fetch(`http://localhost:${port}${p}`, { method: m, headers: { 'x-user': u, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); let j = null; const ct = r.headers.get('content-type') || ''; if (ct.includes('json')) j = await r.json(); return { s: r.status, j, ct }; };
  // C-02: all 45 unread notices reach the COO (was capped at 20)
  const [[mx]] = await pdqT("SELECT MIN(id) a FROM c2m_notice"); await pdqT("INSERT INTO c2m_audit (by_user, entity, entity_id, action, old_value, new_value, why, at) VALUES ('tahir','notices_read','tahir','read',NULL,?,NULL,NOW())", [JSON.stringify({ upto: mx.a + 9 })]);
  const st = await call('tahir', 'GET', '/api/c2m/state'); ok(st.s === 200, 'state 200 ' + st.s + ' ' + JSON.stringify(st.j && st.j.error));
  ok(st.j && Array.isArray(st.j.notices) && st.j.notices.length === 45 && st.j.notices.filter(n => n.id > st.j.noticesReadUpto).length === 35, 'all 35 unread and the 10 read notices, got ' + (st.j && st.j.notices && st.j.notices.length) + ' upto ' + (st.j && st.j.noticesReadUpto));
  // C-07: a viewer sees the latest issued document of a granted list only
  const lm = await call('ali', 'GET', '/api/c2m/pricedocs/latest-mine'); ok(lm.s === 200, 'latest-mine 200 ' + lm.s + JSON.stringify(lm.j));
  ok(lm.j && lm.j.docs.length === 1 && lm.j.docs[0].ref === 'VAN/PL/2026/001', 'ali sees only dist ' + JSON.stringify(lm.j));
  const lm2 = await call('saad', 'GET', '/api/c2m/pricedocs/latest-mine'); ok(lm2.s === 200 && lm2.j.docs.length === 0, 'saad with no grant sees none ' + JSON.stringify(lm2.j));
  const lmT = await call('tahir', 'GET', '/api/c2m/pricedocs/latest-mine'); ok(lmT.j && lmT.j.docs.length === 2, 'coo sees both');
  const [[d1]] = await pdqT("SELECT id FROM c2m_price_doc WHERE ref='VAN/PL/2026/001'"); const [[d2]] = await pdqT("SELECT id FROM c2m_price_doc WHERE ref='VAN/PL/2026/002'");
  const p1 = await call('ali', 'GET', `/api/c2m/pricedocs/${d1.id}/pdf`); ok(p1.s === 409 && /ended on 20 Oct 2026/.test(p1.j.error), 'ended dist list not given to a viewer: ' + p1.s + ' ' + JSON.stringify(p1.j));
  const pT = await call('tahir', 'GET', `/api/c2m/pricedocs/${d1.id}/pdf`); ok(pT.s === 200 && /pdf/.test(pT.ct), 'the COO still downloads it: ' + pT.s);
  await pdqT("INSERT INTO c2m_price_doc (ref, audience, addressee, fields_json, effective, valid_till, created_by, created_at) VALUES ('VAN/PL/2026/003','dist','Distributors',?, '2026-11-20',NULL,'yawar',NOW())", [fields]);
  const [[d3]] = await pdqT("SELECT id FROM c2m_price_doc WHERE ref='VAN/PL/2026/003'");
  const lm3 = await call('ali', 'GET', '/api/c2m/pricedocs/latest-mine'); ok(lm3.j.docs.length === 1 && lm3.j.docs[0].ref === 'VAN/PL/2026/003', 'latest is the new list');
  const p3 = await call('ali', 'GET', `/api/c2m/pricedocs/${d3.id}/pdf`); ok(p3.s === 200 && /pdf/.test(p3.ct), 'ali downloads the current list issued by yawar: ' + p3.s + JSON.stringify(p3.j));
  const mk1 = await call('ali', 'POST', '/api/c2m/pricedocs', { audience: 'dist' }); ok(mk1.s === 409 && /already issued/.test(mk1.j.error), 'viewer cannot make a new number for an issued list: ' + mk1.s + JSON.stringify(mk1.j));
  await pdqT("UPDATE c2m_price_doc SET valid_till='2026-11-01' WHERE ref='VAN/PL/2026/003'"); const mk2 = await call('ali', 'POST', '/api/c2m/pricedocs', { audience: 'dist' }); ok(mk2.s === 409 && /ended on 1 Nov 2026/.test(mk2.j.error), 'viewer cannot issue past an ended list: ' + JSON.stringify(mk2.j)); await pdqT("UPDATE c2m_price_doc SET valid_till=NULL WHERE ref='VAN/PL/2026/003'");
  const p1b = await call('ali', 'GET', `/api/c2m/pricedocs/${d1.id}/pdf`); ok(p1b.s === 409 && /newer list/.test(p1b.j.error), 'an older list refused once a newer one is issued: ' + p1b.s);
  const p2 = await call('ali', 'GET', `/api/c2m/pricedocs/${d2.id}/pdf`); ok(p2.s === 403, 'ali cannot download dealer doc: ' + p2.s);
  const [[cnt]] = await pdqT('SELECT COUNT(*) n FROM c2m_price_doc'); ok(Number(cnt.n) === 3, 'no new document number made by downloads');
  // costNoticeTail: the logic, extracted from the file and run with stubs
  const src = require('fs').readFileSync(ROUTES, 'utf8'); const m = src.match(/function costNoticeTail\(re, info\) \{[\s\S]*?\r?\n  \}\r?\n/); ok(!!m, 'costNoticeTail found');
  const mk = (on) => new Function('glOn', 'dryStore', 'GL', 'dWords', 'addDay', m[0] + '; return costNoticeTail;')(() => on, { getStore: () => null }, { until: '2026-11-30' }, d => d, (d, n) => '2026-12-01');
  const inW = mk(true), outW = mk(false);
  ok(/3 pack\(s\) moved more than the re-approval % \(3%\)/.test(inW(0, { moved: 3, first: 0, pct: 3 })) && /2026-12-01/.test(inW(0, { moved: 3, pct: 3 })), 'window, moved 3: ' + inW(0, { moved: 3, pct: 3 }));
  ok(/^No pack moved more than the re-approval % \(3%\)\.$/.test(inW(0, { moved: 0, pct: 3 })), 'window, counted 0: ' + inW(0, { moved: 0, pct: 3 }));
  ok(/not counted on this notice/.test(inW(0, undefined)) && !/^No pack moved/.test(inW(0, undefined)), 'window, not counted never says none: ' + inW(0, undefined));
  ok(/2 pack\(s\) with no approved cost/.test(inW(2, { moved: 1, pct: 3 })), 'window, first costs said: ' + inW(2, { moved: 1, pct: 3 }));
  ok(outW(4, { moved: 4 }) === '4 pack(s) moved more than the re-approval % and wait in a re-approval item for the CFO.' && outW(0) === 'No pack moved more than the re-approval %.', 'outside window unchanged');
  srv.close(); await pool.end();
  console.log(`routes-10a: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
