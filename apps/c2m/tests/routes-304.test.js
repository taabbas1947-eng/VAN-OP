// Push 10l: the state answer has no time inside it, so the same data gives the same answer and the browser gets 304. Run: node apps/c2m/tests/routes-304.test.js
const path = require('path'); const http = require('http'); const express = require('express'); const db = require('./_db.js'); const ROUTES = path.resolve(process.argv[2] || path.join(__dirname, '..', 'c2m-routes.js'));
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
const get = (url, h) => new Promise((res, rej) => http.get(url, { headers: h }, r => { let b = ''; r.on('data', d => { b += d; }); r.on('end', () => res({ s: r.statusCode, h: r.headers, b })); }).on('error', rej)); // http.get: no "no-cache" added, as a browser revalidating would send
(async () => { const P = (await db.fresh(), db.pool(5)); const pdq = (s, p) => P.execute(s, p || []);
  const pool = { pool: { config: { connectionLimit: 5 } }, execute: pdq, getConnection: () => P.getConnection() };
  const app = express(); app.use(express.json()); require(ROUTES)(app, { pdq, pool, auth: (q, r, n) => { q.user = { u: q.get('x-user') || 'tahir' }; n(); }, path, fs: require('fs'), crypto: require('crypto'), services: {}, noAutoPull: true });
  const srv = app.listen(0); const B = `http://localhost:${srv.address().port}`;
  const a = await get(B + '/api/c2m/state', { 'x-user': 'tahir' });
  ok(a.s === 200 && !!a.h.etag, 'state 200 with an ETag');
  ok(/private/.test(a.h['cache-control'] || '') && /no-cache/.test(a.h['cache-control'] || ''), 'Cache-Control private, no-cache: ' + a.h['cache-control']);
  ok(Number(a.h['x-c2m-built']) > 0, 'X-C2M-Built says when it was built');
  ok(!('builtAt' in JSON.parse(a.b)), 'no builtAt inside the answer');
  // a rebuild (not the 30 second kept answer) with nothing changed: the same answer, so 304
  await fetch(B + '/api/c2m/nothing', { method: 'POST' }); // ends the kept answer; changes no data
  const b2 = await get(B + '/api/c2m/state', { 'x-user': 'tahir', 'if-none-match': a.h.etag });
  ok(b2.s === 304 && b2.b === '', 'the same data after a rebuild gives 304 and no body: ' + b2.s);
  ok(Number(b2.h['x-c2m-built']) >= Number(a.h['x-c2m-built']), 'the 304 still says when it was built');
  // a change gives a new answer
  await fetch(B + '/api/c2m/holidays', { method: 'POST', headers: { 'content-type': 'application/json', 'x-user': 'tahir' }, body: JSON.stringify({ day: '2027-05-01', name: 'Test 304' }) });
  const c = await get(B + '/api/c2m/state', { 'x-user': 'tahir', 'if-none-match': a.h.etag });
  ok(c.s === 200 && c.h.etag !== a.h.etag && JSON.parse(c.b).holidays.some(h => h.day === '2027-05-01'), 'a change gives 200 and the new answer');
  // the kept answer (within 30 seconds) gives 304 too
  const d = await get(B + '/api/c2m/state', { 'x-user': 'tahir', 'if-none-match': c.h.etag }); ok(d.s === 304, 'the kept answer gives 304: ' + d.s);
  // another person never gets 304 on someone else's ETag with different data
  const e = await get(B + '/api/c2m/state', { 'x-user': 'ali', 'if-none-match': c.h.etag }); ok(e.s === 200, 'another person with a different answer gets 200: ' + e.s);
  srv.close(); await P.end(); console.log(`routes-304: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('ERROR', e.stack); process.exit(1); });
