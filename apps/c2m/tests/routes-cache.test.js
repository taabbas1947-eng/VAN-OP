// Push 10j: kept read answers. Run: node apps/c2m/tests/routes-cache.test.js
const path = require('path'); const express = require('express'); const db = require('./_db.js'); const ROUTES = path.resolve(process.argv[2] || path.join(__dirname, '..', 'c2m-routes.js'));
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
(async () => { const P = (await db.fresh(), db.pool(8));
  const seen = []; const pdq = (s, p) => { seen.push(s); return P.execute(s, p || []); };
  const pool = { pool: { config: { connectionLimit: 8 } }, execute: pdq, getConnection: async () => { const c = await P.getConnection(); return { execute: (s, p) => { seen.push('TX ' + s); return c.execute(s, p || []); }, query: (s, p) => c.query(s, p || []), beginTransaction: () => c.beginTransaction(), commit: () => c.commit(), rollback: () => c.rollback(), release: () => c.release() }; } };
  const app = express(); app.use(express.json()); require(ROUTES)(app, { pdq, pool, auth: (q, r, n) => { q.user = { u: q.get('x-user') || 'tahir' }; n(); }, path, fs: require('fs'), crypto: require('crypto'), services: {}, noAutoPull: true });
  const srv = app.listen(0); const B = `http://localhost:${srv.address().port}`;
  const st = async u => { const r = await fetch(B + '/api/c2m/state', { headers: { 'x-user': u || 'tahir' } }); return { s: r.status, j: await r.json(), t: r.headers.get('server-timing') || '' }; };
  const bump = () => fetch(B + '/api/c2m/nothing', { method: 'POST' }); // any non-GET ends the 30 second kept state answer, not the kept reads
  await st(); await bump(); seen.length = 0;
  const a = await st(); const rc = (a.t.match(/rc;desc="(\d+) of (\d+) kept"/) || []);
  ok(a.s === 200 && +rc[1] > 0 && +rc[1] <= +rc[2], 'a second build gives kept answers: ' + rc[0]);
  ok(seen.some(s => /user_module_roles/.test(s)) && seen.some(s => /FROM app_state/.test(s)), 'sign-in, roles and O2S data are read fresh');
  ok(!seen.some(s => /FROM c2m_customer ORDER BY/.test(s)), 'a C2M table nobody wrote is not read again');
  // a hand change (outside C2M) shows only after the kept answer ends; here the test forgets them as 5 minutes would
  const [[g]] = await P.execute("SELECT v FROM c2m_setting WHERE k='budget_gp'"); const old = g ? g.v : null;
  await P.execute("INSERT INTO c2m_setting (k, v, label) VALUES ('budget_gp','77.7','Company GP target') ON DUPLICATE KEY UPDATE v='77.7'");
  await bump(); const b = await st(); const bv = JSON.stringify(b.j).includes('77.7');
  ok(!bv, 'a hand change is not seen while the answer is kept');
  app.locals.c2mForgetKept(); await bump(); const c = await st(); ok(JSON.stringify(c.j).includes('77.7'), 'seen once the kept answers end');
  // a change through C2M is seen at once
  const r = await fetch(B + '/api/c2m/holidays', { method: 'POST', headers: { 'content-type': 'application/json', 'x-user': 'tahir' }, body: JSON.stringify({ day: '2027-03-23', name: 'Cache test' }) });
  const d = await st(); ok(r.status === 200 && (d.j.holidays || []).some(h => h.day === '2027-03-23'), 'a C2M save is seen at once (' + r.status + ')');
  await fetch(B + '/api/c2m/holidays', { method: 'POST', headers: { 'content-type': 'application/json', 'x-user': 'tahir' }, body: JSON.stringify({ day: '2027-03-23', remove: true }) });
  const e2 = await st(); ok(!(e2.j.holidays || []).some(h => h.day === '2027-03-23'), 'its removal is seen at once');
  // kept answers are copies: 2 builds give the same answer
  await bump(); const x1 = await st(); await bump(); const x2 = await st(); const strip = o => JSON.stringify(o, (k, v) => (k === 'builtAt' ? undefined : v));
  ok(strip(x1.j) === strip(x2.j), 'a kept answer is not changed by the build that used it');
  // roles without see.cost get no rc mark
  await bump(); const k = await st('ali'); ok(!/rc;/.test(k.t), 'no rc mark for a KAM');
  if (old === null) await P.execute("DELETE FROM c2m_setting WHERE k='budget_gp'"); else await P.execute("UPDATE c2m_setting SET v=? WHERE k='budget_gp'", [old]);
  await P.execute("DELETE FROM c2m_audit WHERE entity='holiday' AND entity_id='2027-03-23'").catch(() => {});
  srv.close(); await P.end(); console.log(`routes-cache: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('ERROR', e.stack); process.exit(1); });
