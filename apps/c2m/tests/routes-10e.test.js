// Push 10e route checks, run against the throwaway test database (apps/c2m/tests/_db.js)
// Run: node apps/c2m/tests/routes-10e.test.js (or give a routes file as the first argument). Needs the test database: see README.md.
const path = require('path');
const express = require('express'); const db = require('./_db.js');
const ROUTES = path.resolve(process.argv[2] || path.join(__dirname, '..', 'c2m-routes.js'));
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
(async () => {
  const yr = require(path.join(__dirname, '..', 'c2m-lib.js')).pkToday().slice(0, 4); // the server numbers by Pakistan year
  const pool = (await db.fresh(), db.pool(5));
  const pdq = (s, p) => pool.execute(s, p || []);
  const pdqT = (s, p) => pdq(s, p).then(r => { if (!/^\s*SELECT/i.test(s) && global.__c2mForget) global.__c2mForget(); return r; }); // push 10j: a direct write is a hand change; C2M forgets its kept answers
  await pdqT("DELETE FROM user_module_roles"); await pdqT("DELETE FROM c2m_notice"); await pdqT("DELETE FROM c2m_price_doc"); await pdqT("DELETE FROM c2m_list_grant"); await pdqT("DELETE FROM c2m_audit WHERE entity='notices_read'");
  await pdqT("DELETE FROM c2m_holiday"); await pdqT("DELETE FROM c2m_audit WHERE entity='holiday'"); await pdqT("DELETE FROM c2m_setting WHERE k LIKE 'pl_seq_%' OR k LIKE 'golive_%'");
  for (const [u, r] of [['tahir', 'coo'], ['ali', 'viewer'], ['saad', 'viewer'], ['yawar', 'cfo']]) await pdqT('INSERT INTO user_module_roles (username, module, role) VALUES (?,?,?)', [u, 'c2m', r]);
  for (let i = 0; i < 45; i++) await pdqT("INSERT INTO c2m_notice (for_role, text, by_user, at) VALUES ('coo', ?, 'yawar', NOW())", ['Notice ' + i]);
  const fields = JSON.stringify({ fields: ['now'], client: null, reasons: {}, note: '', snapshot: { list: [], eff: '2026-10-11', till: '2026-10-20' } });
  await pdqT("INSERT INTO c2m_price_doc (ref, audience, addressee, fields_json, effective, valid_till, created_by, created_at) VALUES ('VAN/PL/" + yr + "/001','dist','Distributors',?, '2026-10-11','2026-10-20','tahir',NOW())", [fields]);
  await pdqT("INSERT INTO c2m_price_doc (ref, audience, addressee, fields_json, effective, valid_till, created_by, created_at) VALUES ('VAN/PL/" + yr + "/002','dealer','Dealers',?, '2026-10-11',NULL,'tahir',NOW())", [fields]);
  await pdqT("INSERT INTO c2m_list_grant (username, grant_kind, grant_value, granted_by, granted_at) VALUES ('ali','list','dist','tahir',NOW())");
  const app = express(); app.use(express.json());
  const auth = (req, res, next) => { req.user = { u: req.get('x-user') || 'tahir' }; next(); };
  require(ROUTES)(app, { pdq, pool, auth, path, fs: require('fs'), crypto: require('crypto'), services: {}, noAutoPull: true });
  global.__c2mForget = app.locals.c2mForgetKept;
  app.use((e, req, res, next) => res.status(e.status || 500).json({ error: e.message }));
  const srv = app.listen(0); const port = srv.address().port;
  const call = async (u, m, p, b) => { const r = await fetch(`http://localhost:${port}${p}`, { method: m, headers: { 'x-user': u, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); let j = null; const ct = r.headers.get('content-type') || ''; if (ct.includes('json')) j = await r.json(); return { s: r.status, j, ct }; };

  const lib = require(path.join(path.dirname(ROUTES), 'c2m-lib.js'));
  ok(lib.fedPct(0) === 0 && lib.fedPct('0') === 0 && lib.fedPct('') === 5 && lib.fedPct(null) === 5 && lib.fedPct(18) === 18 && lib.fedPct(150) === 5, 'C-13 FED: 0 stays 0, blank is 5');
  // C-33: numbers from a counter, never reused
  const st0 = await call('tahir', 'GET', '/api/c2m/state'); ok(st0.s === 200 && st0.j.nextDocRef === `VAN/PL/${yr}/003`, 'next number after 001 and 002: ' + (st0.j && st0.j.nextDocRef));
  await pdqT("DELETE FROM c2m_price_doc WHERE ref='VAN/PL/" + yr + "/001'");
  const st1 = await call('tahir', 'GET', '/api/c2m/state'); ok(st1.j.nextDocRef === `VAN/PL/${yr}/003`, 'a deleted document does not change the next number: ' + st1.j.nextDocRef);
  const mk = await call('tahir', 'POST', '/api/c2m/pricedocs', { audience: 'dealer', eff: '2026-11-20' }); ok(mk.s === 200, 'COO issues a dealer list: ' + mk.s + JSON.stringify(mk.j));
  const [[last]] = await pdqT('SELECT ref FROM c2m_price_doc ORDER BY id DESC LIMIT 1'); ok(last.ref === `VAN/PL/${yr}/003`, 'number from the counter: ' + last.ref);
  const [[sq]] = await pdqT('SELECT v FROM c2m_setting WHERE k=?', ['pl_seq_' + yr]); ok(sq && String(sq.v) === '3', 'counter saved: ' + (sq && sq.v));
  await pdqT('DELETE FROM c2m_price_doc WHERE ref=?', [last.ref]);
  const mk2 = await call('tahir', 'POST', '/api/c2m/pricedocs', { audience: 'dealer', eff: '2026-11-20' }); const [[last2]] = await pdqT('SELECT ref FROM c2m_price_doc ORDER BY id DESC LIMIT 1');
  ok(mk2.s === 200 && last2.ref !== last.ref, 'a deleted number is not given again: ' + last.ref + ' then ' + last2.ref);
  let dup = null; try { await pdqT("INSERT INTO c2m_price_doc (ref, audience, addressee, fields_json, effective, created_by, created_at) VALUES (?, 'dist', 'x', '{}', '2026-11-20', 'tahir', NOW())", [last2.ref]); } catch (e) { dup = e.code; }
  ok(dup === 'ER_DUP_ENTRY', 'UNIQUE on ref (migration 017): ' + dup);
  const st2 = await call('tahir', 'GET', '/api/c2m/state'); ok(st2.j.settings.every(s => !/^pl_seq_/.test(s.k)), 'counter not shown in Company settings');
  const sp = await call('tahir', 'POST', '/api/c2m/settings', { changes: { ['pl_seq_' + yr]: '1' } }); ok(sp.s === 400 && /given by C2M/.test(sp.j.error), 'the counter cannot be set in Company settings: ' + sp.s);
  // C-20: preview of a document dated ahead
  const pv = await call('tahir', 'POST', '/api/c2m/pricedocs/preview', { audience: 'dealer', eff: '2026-12-01' }); ok(pv.s === 200 && Array.isArray(pv.j.rows) && pv.j.eff === '2026-12-01', 'preview rows on the From date: ' + pv.s + JSON.stringify(pv.j).slice(0, 120));
  const [[cnt]] = await pdqT('SELECT COUNT(*) n FROM c2m_price_doc'); const pv2 = await call('tahir', 'POST', '/api/c2m/pricedocs/preview', { audience: 'dist', eff: '2026-12-01' }); const [[cnt2]] = await pdqT('SELECT COUNT(*) n FROM c2m_price_doc');
  ok(pv2.s === 200 && cnt.n === cnt2.n, 'preview saves nothing');
  const pvV = await call('ali', 'POST', '/api/c2m/pricedocs/preview', { audience: 'dist', eff: '2026-12-01' }); ok(pvV.s === 403, 'a viewer cannot preview: ' + pvV.s);
  const pvB = await call('tahir', 'POST', '/api/c2m/pricedocs/preview', { audience: 'dist', eff: '1 Dec' }); ok(pvB.s === 400, 'a bad date refused: ' + pvB.s);
  // C-35: public holidays, kept by the COO only
  const h1 = await call('tahir', 'POST', '/api/c2m/holidays', { day: '2026-12-25', name: 'Quaid Day' }); ok(h1.s === 200, 'COO adds a holiday: ' + h1.s + JSON.stringify(h1.j));
  const h2 = await call('yawar', 'POST', '/api/c2m/holidays', { day: '2026-12-26', name: 'x' }); ok(h2.s === 403 && /Only the COO/.test(h2.j.error), 'CFO refused: ' + h2.s);
  const h3 = await call('tahir', 'POST', '/api/c2m/holidays', { day: '2026-12-27' }); ok(h3.s === 400, 'a name is needed: ' + h3.s);
  const st3 = await call('ali', 'GET', '/api/c2m/state'); ok(st3.j.holidaysReady === true && st3.j.holidays.length === 1 && st3.j.holidays[0].day === '2026-12-25' && st3.j.holidays[0].name === 'Quaid Day', 'every role reads the holidays: ' + JSON.stringify(st3.j.holidays));
  const h4 = await call('tahir', 'POST', '/api/c2m/holidays', { day: '2026-12-25', remove: true }); const st4 = await call('tahir', 'GET', '/api/c2m/state'); ok(h4.s === 200 && st4.j.holidays.length === 0, 'removed');
  const [[ah]] = await pdqT("SELECT COUNT(*) n FROM c2m_audit WHERE entity='holiday'"); ok(ah.n === 2, 'in the change record: ' + ah.n);
  const [[ar]] = await pdqT("SELECT old_value FROM c2m_audit WHERE entity='holiday' AND action='remove'"); ok(ar && /Quaid Day/.test(ar.old_value), 'a removal keeps the name: ' + (ar && ar.old_value));
  // C-21: a save after the window's last day runs the close first
  const yday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  await pdqT("INSERT INTO c2m_setting (k, v, label, needs_approval) VALUES ('golive_until', ?, 'Go-live window, last day', 0) ON DUPLICATE KEY UPDATE v=VALUES(v)", [yday]);
  await new Promise(r => setTimeout(r, 31000)); // the window's last day is read at most every 30 s
  const h5 = await call('tahir', 'POST', '/api/c2m/holidays', { day: '2026-12-25', name: 'Quaid Day' }); const [[rs]] = await pdqT("SELECT v FROM c2m_setting WHERE k='golive_reset'");
  ok(h5.s === 200 && rs && String(rs.v).slice(0, 10) === yday, 'the close ran before the save: ' + h5.s + ' ' + JSON.stringify(rs));
  srv.close(); await pool.end();
  console.log(`routes-10e: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('ERROR', e && e.stack); process.exit(1); });
