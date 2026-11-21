// Push 10h (C-24): the shell names hashed files; they are served with the right type and cache. Run: node apps/c2m/tests/routes-shell.test.js
const path = require('path'); const express = require('express'); const db = require('./_db.js'); const ROUTES = path.resolve(process.argv[2] || path.join(__dirname, '..', 'c2m-routes.js'));
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
(async () => {
  const pool = (await db.fresh(), db.pool(5));
  const app = express(); app.use(require('compression')()); app.use(express.json());
  require(ROUTES)(app, { pdq: (s, p) => pool.execute(s, p || []), pool, auth: (req, res, next) => { req.user = { u: req.get('x-user') || 'tahir' }; next(); }, path, fs: require('fs'), crypto: require('crypto'), services: {}, noAutoPull: true });
  app.get('*', (req, res) => res.status(299).send('catch-all'));
  const srv = app.listen(0); const B = `http://localhost:${srv.address().port}`;
  const r = await fetch(B + '/c2m'); const h = await r.text(); ok(r.status === 200 && /no-cache/.test(r.headers.get('cache-control')) && r.headers.get('etag'), 'shell 200, no-cache, ETag');
  const css = (h.match(/href="(\/c2m\/c2m\.[0-9a-f]{12}\.css)"/) || [])[1], js = (h.match(/src="(\/c2m\/c2m\.[0-9a-f]{12}\.js)"/) || [])[1]; ok(css && js, 'shell names hashed files ' + css + ' ' + js);
  const fs = require('fs'), crypto = require('crypto'), D = path.dirname(ROUTES);
  ok(js.includes(crypto.createHash('sha1').update(fs.readFileSync(path.join(D, 'c2m.js'))).digest('hex').slice(0, 12)), 'js hash is the content hash');
  for (const [u, t, f] of [[css, 'text/css', 'c2m.css'], [js, 'javascript', 'c2m.js']]) { const a = await fetch(B + u, { headers: { 'accept-encoding': 'gzip' } }); const body = await a.text();
    ok(a.status === 200 && a.headers.get('content-type').includes(t), u + ' type ' + a.headers.get('content-type')); ok(/max-age=31536000/.test(a.headers.get('cache-control')) && /immutable/.test(a.headers.get('cache-control')), u + ' kept a year: ' + a.headers.get('cache-control'));
    ok(body === fs.readFileSync(path.join(D, f), 'utf8'), u + ' content'); ok(a.headers.get('content-encoding') === 'gzip', u + ' compressed: ' + a.headers.get('content-encoding')); }
  const o = await fetch(B + '/c2m/c2m.000000000000.js'); ok(o.status === 200 && /no-cache/.test(o.headers.get('cache-control')), 'an unknown hash: the current file, no-cache');
  const p = await fetch(B + '/c2m/c2m.js'); ok(p.status === 200 && /no-cache/.test(p.headers.get('cache-control')), 'no hash: the current file, no-cache');
  const x = await fetch(B + '/c2m/c2m.abc.js'); ok(x.status === 299, 'anything else falls through to the next route');
  const pr = await fetch(B + '/c2m/prices'); ok(pr.status === 200, 'public price page still served');
  ok(/C2M could not load/.test(h) && /typeof firstLoad!=='function'/.test(h), 'the shell says when the script did not arrive');
  { const a = await fetch(B + js); const et = a.headers.get('etag'); ok(et === '"' + js.match(/c2m\.([0-9a-f]{12})\.js/)[1] + '"', 'ETag is the hash: ' + et);
    const st = await new Promise(res => require('http').get(B + js, { headers: { 'if-none-match': et } }, r => { r.resume(); res(r.statusCode); })); ok(st === 304, 'a known ETag gets 304 (node fetch sends no-cache, so http.get): ' + st); }
  const la = async u => { await fetch(B + '/api/c2m/nothing', { method: 'POST' }); const r2 = await fetch(B + '/api/c2m/state', { headers: { 'x-user': u } }); await r2.text(); return r2.headers.get('server-timing') || ''; };
  const tA = await la('tahir'), tK = await la('ali'); ok(/la_\w+;desc="\d+ rows";dur=\d+/.test(tA), 'la_ entries for the administrator: ' + (tA.match(/la_[^,]*/) || [''])[0]); ok(/load_all/.test(tK) && !/la_/.test(tK), 'no la_ entries for a KAM');
  srv.close(); await pool.end(); console.log(`routes-shell: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('ERROR', e.stack); process.exit(1); });
