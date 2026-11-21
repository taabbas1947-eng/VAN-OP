// Race: a plain write outside a transaction bumps the table version BEFORE it runs. A read that starts after the bump and
// reaches the database before the write lands is stored as current (review 10j B-1). Run: node apps/c2m/tests/routes-race.test.js [routes file] [delay ms]
const path = require('path'); const express = require('express'); const tdb = require('./_db.js'); const ROUTES = path.resolve(process.argv[2] || path.join(__dirname, '..', 'c2m-routes.js'));
(async () => { const P = (await tdb.fresh(), tdb.pool(8));
  const D = Number(process.argv[3] || 300); const wait = ms => new Promise(r => setTimeout(r, ms));
  // network latency on writes only (HostGator round trip), reads answer at once
  const pdq = async (s, p) => { if (!/^\s*(SELECT|SHOW)\b/i.test(s) && /c2m_holiday/.test(s)) await wait(D); return P.execute(s, p || []); };
  const pool = { pool: { config: { connectionLimit: 8 } }, execute: pdq, getConnection: async () => { const c = await P.getConnection(); return { execute: (s, p) => c.execute(s, p || []), query: (s, p) => c.query(s, p || []), beginTransaction: () => c.beginTransaction(), commit: () => c.commit(), rollback: () => c.rollback(), release: () => c.release() }; } };
  const app = express(); app.use(express.json()); require(ROUTES)(app, { pdq, pool, auth: (q, r, n) => { q.user = { u: q.get('x-user') || 'tahir' }; n(); }, path, fs: require('fs'), crypto: require('crypto'), services: {}, noAutoPull: true });
  const srv = app.listen(0); const B = `http://localhost:${srv.address().port}`;
  const st = async () => (await fetch(B + '/api/c2m/state', { headers: { 'x-user': 'tahir' } })).json();
  const post = b => fetch(B + '/api/c2m/holidays', { method: 'POST', headers: { 'content-type': 'application/json', 'x-user': 'tahir' }, body: JSON.stringify(b) });
  await P.execute("DELETE FROM c2m_holiday WHERE day='2027-04-01'");
  await st();
  const pw = post({ day: '2027-04-01', name: 'Race test' }); await wait(D / 3); const mid = await st(); await (await pw).json();
  const [[db]] = await P.execute("SELECT COUNT(*) n FROM c2m_holiday WHERE day='2027-04-01'");
  const after = await st(); const seen = (after.holidays || []).some(h => h.day === '2027-04-01');
  console.log(`in database: ${db.n}; during save the page had it: ${(mid.holidays || []).some(h => h.day === '2027-04-01')}; after the save the page has it: ${seen}`);
  await P.execute("DELETE FROM c2m_holiday WHERE day='2027-04-01'"); await P.execute("DELETE FROM c2m_audit WHERE entity='holiday' AND entity_id='2027-04-01'");
  console.log(`routes-race: ${seen ? 1 : 0} pass, ${seen ? 0 : 1} fail`); srv.close(); await P.end(); process.exit(seen ? 0 : 1);
})().catch(e => { console.log('ERROR', e.stack); process.exit(2); });
