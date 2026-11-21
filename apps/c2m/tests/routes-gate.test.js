// Push 10i: plain reads never hold more than the pool's size less 1 (1 connection stays for a save); a save during a cold build gets its connection at once.
const path = require('path'); const express = require('express'); const db = require('./_db.js'); const ROUTES = path.resolve(process.argv[2] || path.join(__dirname, '..', 'c2m-routes.js'));
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => { const N = 4; const P = (await db.fresh(), db.pool(N));
  let inR = 0, maxR = 0, maxT = 0, held = 0, waitTx = [];
  const pdq = async (s, p) => { const sel = /^\s*(SELECT|SHOW)/i.test(s) && !/golive_(until|reset)/.test(s); /* push 10j: the 2 go-live setting reads skip the queue on purpose (they come before a save) */ if (sel) { inR++; maxR = Math.max(maxR, inR); maxT = Math.max(maxT, inR + held); } try { await sleep(60); return await P.execute(s, p || []); } finally { if (sel) inR--; } };
  const pool = { pool: { config: { connectionLimit: N } }, execute: pdq, getConnection: async () => { const t = Date.now(); const c = await P.getConnection(); waitTx.push(Date.now() - t); held++; return { execute: (s, p) => c.execute(s, p || []), query: (s, p) => c.query(s, p || []), beginTransaction: () => c.beginTransaction(), commit: () => c.commit(), rollback: () => c.rollback(), release: () => { held--; c.release(); } }; } };
  const app = express(); app.use(express.json()); require(ROUTES)(app, { pdq, pool, auth: (q, r, n) => { q.user = { u: q.get('x-user') || 'tahir' }; n(); }, path, fs: require('fs'), crypto: require('crypto'), services: {}, noAutoPull: true });
  const srv = app.listen(0); const B = `http://localhost:${srv.address().port}`; await sleep(500);
  await fetch(B + '/api/c2m/nothing', { method: 'POST' }); if (app.locals.c2mForgetKept) app.locals.c2mForgetKept(); maxR = 0; maxT = 0;
  const st = fetch(B + '/api/c2m/state').then(r => r.status); await sleep(200);
  // a save while the build is reading: a holiday add is admin only and runs in a transaction
  const t = Date.now(); const sv = await fetch(B + '/api/c2m/holidays', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ day: '2026-12-25', name: 'Gate test' }) });
  const sMs = Date.now() - t; const s1 = await st;
  ok(s1 === 200, 'state 200'); ok(maxR <= N - 1, `plain reads never above ${N - 1}: ${maxR}`); ok(maxT <= N, `reads plus transactions never above ${N}: ${maxT}`); ok(waitTx.length > 0 && Math.max(...waitTx) < 100, 'the save got its connection at once: ' + JSON.stringify(waitTx)); console.log('save took', sMs, 'ms, status', sv.status);
  await P.execute("DELETE FROM c2m_holiday WHERE name='Gate test'").catch(() => {}); await P.execute("DELETE FROM c2m_audit WHERE entity='holiday' AND why LIKE '%Gate test%'").catch(() => {});
  srv.close(); await P.end(); console.log(`routes-gate: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('ERROR', e.stack); process.exit(1); });
