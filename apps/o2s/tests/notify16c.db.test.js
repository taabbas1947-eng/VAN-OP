/* 16c alerts: the server routes against a REAL MySQL or MariaDB database (a throwaway one).
 *   O2S_ALERTS_TEST_DB=mysql://user:pass@127.0.0.1:3306/throwaway_db node apps/o2s/tests/notify16c.db.test.js
 * Without O2S_ALERTS_TEST_DB it says "skipped" and passes, so the normal test run never touches a database.
 * It creates its own tables (migrations/O001_alerts.sql, plus small auth_users, user_module_roles and app_state tables)
 * and refuses any database whose name does not contain "test" or "throwaway". The push services are replaced by a recorder,
 * so nothing leaves this computer. */
const path = require('path'), fs = require('fs');
const URL_ = process.env.O2S_ALERTS_TEST_DB || '';
if (!URL_) { console.log('\n16c alerts, database routes: skipped (set O2S_ALERTS_TEST_DB to a throwaway database): 0 passed, 0 failed'); process.exit(0); }
const dbName = (URL_.match(/\/([^/?]+)(\?|$)/) || [])[1] || '';
if (!/test|throwaway/i.test(dbName) || /jodilkah|vanop|van_platform/i.test(URL_)) { console.error('Refusing: ' + dbName + ' does not look like a throwaway database.'); process.exit(2); }

const ROOT = path.join(__dirname, '..', '..', '..');
const req = (m) => require(path.join(ROOT, 'node_modules', m));
const express = req('express'), mysql = req('mysql2/promise');
let pass = 0, fail = 0; const fails = [];
const ok = (n, c, x) => c ? pass++ : (fail++, fails.push(n + (x ? '  [' + x + ']' : '')));
const eq = (n, g, w) => ok(n, g === w, 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w));

/* the push services, replaced by a recorder */
const SENT = []; let FAIL_NEXT = 0;
require.cache[require.resolve(path.join(ROOT, 'node_modules', 'web-push'))] = { exports: {
  setVapidDetails() {},
  async sendNotification(sub, payload, opt) { if (FAIL_NEXT) { FAIL_NEXT--; const e = new Error('gone'); e.statusCode = 410; throw e; } SENT.push({ ep: sub.endpoint, p: JSON.parse(payload), opt }); return { statusCode: 201 }; }
} };
process.env.VAPID_PUBLIC_KEY = 'BTestPublicKey'; process.env.VAPID_PRIVATE_KEY = 'test-private'; process.env.VAPID_SUBJECT = 'mailto:test@example.com';

const u = new URL(URL_);
const pool = mysql.createPool({ host: u.hostname, port: +u.port || 3306, user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database: dbName, dateStrings: true, multipleStatements: false });
const q = (sql, p) => pool.execute(sql, p || []);
const ROUTES = path.join(__dirname, '..', 'notify-routes.js');

(async () => {
  for (const t of ['o2s_push_devices', 'o2s_push_open', 'o2s_push_held', 'app_state', 'auth_users', 'user_module_roles']) await q('DROP TABLE IF EXISTS ' + t);
  await q('CREATE TABLE app_state (id INT PRIMARY KEY, rev INT NOT NULL DEFAULT 0, data LONGTEXT)');
  await q('CREATE TABLE auth_users (username VARCHAR(191) PRIMARY KEY, name TEXT, role TEXT, pass_hash TEXT, active TINYINT NULL)');
  await q('CREATE TABLE user_module_roles (username VARCHAR(191), module VARCHAR(40), role VARCHAR(80), PRIMARY KEY (username, module))');
  const people = [['asif', 'Asif', 'QA Inspector'], ['ali', 'Ali Raza', 'Production'], ['majid', 'Abdul Majid', 'Production Manager'], ['fahim', 'Fahim', 'Plant Manager'], ['tahir', 'Tahir Abbas', 'COO'], ['saad', 'Saad', 'Supply Chain'], ['shoaib', 'Shoaib', 'Warehouse'], ['yawar', 'Yawar', 'CFO'], ['off1', 'Switched Off', 'QA Inspector']];
  for (const p of people) { await q('INSERT INTO auth_users (username,name,role,active) VALUES (?,?,?,?)', [p[0], p[1], p[2], p[0] === 'off1' ? 0 : 1]); await q("INSERT INTO user_module_roles VALUES (?, 'o2s', ?)", [p[0], p[2]]); }
  const data = { orders: [{ id: 'O1', po: '6595010464', client: 'SYNGENTA PAKISTAN LIMITED', lines: [{ id: 'O1L0', brand: 'Naya S Urea', price: 999 }] }], batches: [{ id: 'B1', batchNo: 'VU26164', base: 'Sulfur Coated Urea' }], packingLog: [], shipments: [{ id: 'S1', dispId: 'DSP1', po: '6595010464', brand: 'Naya S Urea' }] };
  await q('INSERT INTO app_state VALUES (1, 7, ?)', [JSON.stringify(data)]);
  const migration = fs.readFileSync(path.join(__dirname, '..', 'migrations', 'O001_alerts.sql'), 'utf8').replace(/^\s*--.*$/mg, '').split(';').map(x => x.trim()).filter(Boolean);
  for (const st of migration) await q(st);
  for (const st of migration) await q(st);   /* safe to run twice */
  ok('migration: 3 tables', (await q("SHOW TABLES LIKE 'o2s_push_%'"))[0].length === 3);

  /* the server pieces the routes are handed (as server.js does) */
  let REV = 7;
  const store = { async getRev() { return REV; }, async getState() { const [r] = await q('SELECT rev, data FROM app_state WHERE id=1'); return { rev: r[0].rev, data: JSON.parse(r[0].data) }; } };
  const users = {}; people.forEach(p => users[p[0]] = { u: p[0], r: p[2], n: p[1] });
  const auth = (r, s, n) => { const t = (r.headers.authorization || '').replace(/^Bearer /, ''); if (!users[t]) return s.status(401).json({ error: 'unauthorized' }); r.user = users[t]; n(); };
  const admin = (r, s, n) => r.user.r === 'COO' ? n() : s.status(403).json({ error: 'admin only' });
  let FAIL_ROLE = '', BREAK = false;
  const holdersOf = async (module, role) => { if (role === FAIL_ROLE) throw new Error('lookup failed'); const [rows] = await q("SELECT a.username, a.name FROM user_module_roles r JOIN auth_users a ON a.username=r.username WHERE r.module=? AND r.role=? AND COALESCE(a.active,1)<>0", [module, role]); return rows; };
  const app = express(); app.use(express.json({ limit: '5mb' }));
  const qq = (sql, p) => (BREAK && /o2s_push_open/.test(sql)) ? Promise.reject(new Error('lost connection')) : q(sql, p);
  require(ROUTES)(app, { store, pdq: qq, auth, admin, services: { holdersOf }, express, path, fs });
  const srv = app.listen(0); const BASE = 'http://127.0.0.1:' + srv.address().port;
  const call = async (method, p, who, body) => { const r = await fetch(BASE + p, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, who ? { Authorization: 'Bearer ' + who } : {}), body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch (e) {} return { s: r.status, j, ct: r.headers.get('content-type') || '' }; };
  const sub = (n) => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/' + n, keys: { p256dh: 'p' + n, auth: 'a' + n } });

  /* static pieces */
  let r = await fetch(BASE + '/o2s/sw.js'); ok('sw.js is JavaScript, no-store, scope /o2s', r.ok && /javascript/.test(r.headers.get('content-type')) && /no-store/.test(r.headers.get('cache-control')) && r.headers.get('service-worker-allowed') === '/o2s');
  r = await fetch(BASE + '/o2s/manifest.json'); ok('manifest.json', r.ok && /manifest\+json/.test(r.headers.get('content-type')));
  r = await fetch(BASE + '/o2s/icons/icon-192.png'); ok('icon', r.ok && /png/.test(r.headers.get('content-type')));
  r = await fetch(BASE + '/o2s/icons/nope.png'); ok('a missing icon is 404, never the app page', r.status === 404);

  r = await call('GET', '/api/o2s/push/key', null); eq('key needs sign-in', r.s, 401);
  r = await call('GET', '/api/o2s/push/key', 'asif'); ok('ready with keys and tables', r.j && r.j.ready === true && r.j.publicKey === 'BTestPublicKey');

  /* devices */
  r = await call('POST', '/api/o2s/push/subscribe', 'asif', { subscription: { endpoint: 'http://not-https', keys: {} } }); eq('a bad device is refused', r.s, 400);
  r = await call('POST', '/api/o2s/push/subscribe', 'asif', { subscription: { endpoint: 'https://evil.example/x', keys: { p256dh: 'p', auth: 'a' } } }); eq('only a push service address is taken (Chrome, Edge, Firefox, Safari)', r.s, 400);
  r = await call('POST', '/api/o2s/push/subscribe', 'asif', { subscription: { endpoint: 'https://fcm.googleapis.com.evil.example/x', keys: { p256dh: 'p', auth: 'a' } } }); eq('...a look-alike address is refused', r.s, 400);
  for (const [who, n] of [['asif', 'qa-phone'], ['majid', 'pm-phone'], ['fahim', 'plant-laptop'], ['tahir', 'coo-phone'], ['ali', 'ali-laptop'], ['saad', 'sc-phone'], ['yawar', 'cfo-phone']]) {
    r = await call('POST', '/api/o2s/push/subscribe', who, { subscription: sub(n), device: 'Chrome on Android' }); ok('switch on: ' + who, r.j && r.j.ok);
  }
  r = await call('POST', '/api/o2s/push/mine', 'asif', { endpoint: sub('qa-phone').endpoint }); ok('mine: on', r.j && r.j.on === true);
  r = await call('POST', '/api/o2s/push/test', 'asif', {}); ok('test alert: 1 device', r.j && r.j.sent === 1 && SENT.pop().p.t === 'O2S test alert');

  /* saves are ignored until the first list records what is open */
  r = await call('POST', '/api/o2s/push/jobs', 'ali', { mode: 'save', rev: 7, jobs: [{ k: 'Pack QC|o:O1|l:O1L0', l: 'Pack QC', r: 'QA Inspector', ref: { o: 'O1', l: 'O1L0' } }] });
  ok('before the first list, a save alerts nothing', r.j && r.j.skipped && SENT.length === 0);
  const open1 = [{ k: 'Ship|o:O1', l: 'Ship', r: 'Supply Chain', ref: { o: 'O1' } }, { k: 'Add reason|o:O1|l:O1L0', l: 'Add reason', r: 'Plant Manager', ref: { o: 'O1', l: 'O1L0' } }];
  r = await call('POST', '/api/o2s/push/jobs', 'majid', { mode: 'sweep', rev: 6, jobs: open1 }); ok('a screen behind the server is not used', r.j && r.j.skipped === 'not up to date');
  r = await call('POST', '/api/o2s/push/jobs', 'majid', { mode: 'sweep', rev: 7, jobs: open1 }); ok('first list: recorded, nothing sent', r.j && r.j.seeded === 2 && SENT.length === 0);

  /* Way 1 */
  const night0 = require(ROUTES).isNight();
  r = await call('POST', '/api/o2s/push/jobs', 'ali', { mode: 'save', rev: 8, jobs: [{ k: 'Pack QC|o:O1|l:O1L0', l: 'Pack QC', r: 'QA Inspector', ref: { o: 'O1', l: 'O1L0' } }] });
  const a1 = SENT.find(x => x.ep.endsWith('qa-phone'));
  ok('Pack QC reaches the QA Inspector (any hour)', !!a1 && r.j.sent === 1);
  ok('alert text: job, product, PO, from whom; no client, no price', a1 && a1.p.t === 'Pack QC' && a1.p.b === 'Naya S Urea · PO 6595010464 · from Ali Raza' && !/SYNGENTA|999/.test(JSON.stringify(a1.p)));
  ok('TTL is a few hours, not weeks', a1 && a1.opt.TTL === 6 * 3600);
  ok('switched-off login gets nothing', !SENT.some(x => /off1/.test(x.ep)));
  SENT.length = 0;
  r = await call('POST', '/api/o2s/push/jobs', 'ali', { mode: 'save', rev: 8, jobs: [{ k: 'Pack QC|o:O1|l:O1L0', l: 'Pack QC', r: 'QA Inspector', ref: { o: 'O1', l: 'O1L0' } }] });
  ok('never twice while the job stays open', SENT.length === 0 && r.j.fresh === 0);
  r = await call('POST', '/api/o2s/push/jobs', 'ali', { mode: 'save', rev: 8, jobs: [{ k: 'Pack QC|o:O1|l:O1L1', l: 'Pack QC', r: 'CFO', ref: { o: 'O1' } }] });
  ok('a job may go only to its own roles (Pack QC never to the CFO)', SENT.length === 0 && r.j.fresh === 0);
  r = await call('POST', '/api/o2s/push/jobs', 'ali', { mode: 'save', rev: 8, jobs: [{ k: 'Hello|x', l: 'Send this to everyone', r: 'COO' }] });
  ok('an unknown job name is ignored', SENT.length === 0 && r.j.fresh === 0);
  r = await call('POST', '/api/o2s/push/jobs', 'ali', { mode: 'save', rev: 8, jobs: [{ k: 'Pack|b:B1', l: 'Pack', r: 'Production', ref: { b: 'B1' } }] });
  ok('never the person whose save made it', !SENT.some(x => x.ep.endsWith('ali-laptop')));
  SENT.length = 0;
  r = await call('POST', '/api/o2s/push/jobs', 'saad', { mode: 'save', rev: 9, jobs: [{ k: 'Refused|o:O1', l: 'Refused', r: 'Supply Chain', w: 'saad', ref: { o: 'O1' } }, { k: 'Sent back|d:DSP1', l: 'Sent back', r: 'Warehouse', w: 'shoaib', ref: { d: 'DSP1' } }] });
  ok('a job for 1 person goes to that person only (and not to the one who saved)', SENT.length === 0);
  r = await call('POST', '/api/o2s/push/jobs', 'fahim', { mode: 'save', rev: 9, jobs: [{ k: 'Refused|o:O1|2', l: 'Refused', r: 'Supply Chain', w: 'saad', ref: { o: 'O1' } }] });
  ok('...saad gets his own Refused', SENT.length === 1 && SENT[0].ep.endsWith('sc-phone'));
  SENT.length = 0;
  r = await call('POST', '/api/o2s/push/jobs', 'fahim', { mode: 'save', rev: 9, jobs: [{ k: 'Review truck|d:DSP1', l: 'Review truck', r: 'Supply Chain', a: ['Warehouse'], n: ['saad'], ref: { d: 'DSP1' } }] });
  ok('notWho is kept off (the loader never reviews)', !SENT.some(x => x.ep.endsWith('sc-phone')));
  r = await call('POST', '/api/o2s/push/jobs', 'fahim', { mode: 'save', rev: 9, jobs: [{ k: 'esc|Pack QC|o:O1|l:O1L0', l: 'Pack QC', r: 'Plant Manager', esc: 1 }] });
  ok('an escalation is never taken from a save', r.j.fresh === 0);

  /* Way 2: escalation, closing, coming back, night */
  SENT.length = 0; REV = 10;
  const list2 = open1.concat([{ k: 'Pack QC|o:O1|l:O1L0', l: 'Pack QC', r: 'QA Inspector', ref: { o: 'O1', l: 'O1L0' } }, { k: 'esc|Pack QC|o:O1|l:O1L0', l: 'Pack QC', r: 'Plant Manager', esc: 1, ref: { o: 'O1', l: 'O1L0' } }, { k: 'esc|Ship|o:O1', l: 'Ship', r: 'COO', esc: 1 }]);
  r = await call('POST', '/api/o2s/push/jobs', 'majid', { mode: 'sweep', rev: 10, jobs: list2 });
  ok('a second list within 10 minutes is not used', r.j && r.j.skipped === 'recent');
  /* move the clock of the last list back */
  const mod = require(ROUTES);
  await new Promise(res => setTimeout(res, 10));
  ok('test hook to reset the list clock exists', typeof mod._resetSweepClock === 'function');
  if (mod._resetSweepClock) mod._resetSweepClock();
  r = await call('POST', '/api/o2s/push/jobs', 'majid', { mode: 'sweep', rev: 10, jobs: list2 });
  const esc = SENT.find(x => x.ep.endsWith('plant-laptop'));
  ok('escalation reaches the Plant Manager once (or is held at night)', night0 ? (r.j.held >= 1) : (!!esc && /Escalated to you: Pack QC/.test(esc.p.t)));
  ok('an escalation to a role it never goes to is ignored (Ship to the COO)', !SENT.some(x => x.ep.endsWith('coo-phone')));
  ok('closed: the jobs no longer open', r.j && r.j.closed >= 0);
  /* Pack QC leaves, then comes back: alerts again (a list closes only rows opened before it started; the clock is in whole seconds) */
  await new Promise(res => setTimeout(res, 1100));
  if (mod._resetSweepClock) mod._resetSweepClock();
  r = await call('POST', '/api/o2s/push/jobs', 'majid', { mode: 'sweep', rev: 10, jobs: open1 });
  ok('a job that leaves is closed', r.j && r.j.closed >= 2);
  SENT.length = 0;
  r = await call('POST', '/api/o2s/push/jobs', 'ali', { mode: 'save', rev: 11, jobs: [{ k: 'Pack QC|o:O1|l:O1L0', l: 'Pack QC', r: 'QA Inspector', ref: { o: 'O1', l: 'O1L0' } }] });
  ok('...and alerts again when it comes back', SENT.some(x => x.ep.endsWith('qa-phone')));

  /* review 16 Oct: the person who saved is never alerted later by the 15-minute list */
  SENT.length = 0;
  r = await call('POST', '/api/o2s/push/jobs', 'ali', { mode: 'save', rev: 11, jobs: [{ k: 'Close batch|b:B1', l: 'Close batch', r: 'Production', ref: { b: 'B1' } }] });
  ok('the saver: recorded, not alerted', r.j.fresh === 0 && SENT.length === 0 && (await q("SELECT COUNT(*) n FROM o2s_push_open WHERE username='ali' AND job_key='Close batch|b:B1'"))[0][0].n === 1);
  REV = 11; if (mod._resetSweepClock) mod._resetSweepClock();
  const list3 = open1.concat([{ k: 'Pack QC|o:O1|l:O1L0', l: 'Pack QC', r: 'QA Inspector', ref: { o: 'O1', l: 'O1L0' } }, { k: 'Close batch|b:B1', l: 'Close batch', r: 'Production', ref: { b: 'B1' } }]);
  r = await call('POST', '/api/o2s/push/jobs', 'majid', { mode: 'sweep', rev: 11, jobs: list3 });
  ok('...and the next 15-minute list does not alert him either', r.j.ok && !SENT.some(x => x.ep.endsWith('ali-laptop')));
  /* a row a save opens while a list runs is never closed by that list */
  await q("INSERT INTO o2s_push_open (key_hash, username, job_key, opened_at) VALUES ('race', 'asif', 'Inspect|d:RACE', NOW() + INTERVAL 1 HOUR)");
  if (mod._resetSweepClock) mod._resetSweepClock();
  r = await call('POST', '/api/o2s/push/jobs', 'majid', { mode: 'sweep', rev: 11, jobs: list3 });
  eq('a row newer than the list stays open', (await q("SELECT COUNT(*) n FROM o2s_push_open WHERE key_hash='race'"))[0][0].n, 1);
  await q("DELETE FROM o2s_push_open WHERE key_hash='race'");
  /* a people lookup that fails never closes jobs */
  await new Promise(res => setTimeout(res, 1100));
  FAIL_ROLE = 'Supply Chain'; if (mod._resetSweepClock) mod._resetSweepClock();
  r = await call('POST', '/api/o2s/push/jobs', 'majid', { mode: 'sweep', rev: 11, jobs: open1 });   /* Pack QC left out: it would close */
  ok('a failed people lookup: nothing closed', r.j.ok && r.j.closed === 0 && (await q("SELECT COUNT(*) n FROM o2s_push_open WHERE job_key='Pack QC|o:O1|l:O1L0'"))[0][0].n === 1);
  FAIL_ROLE = '';
  /* a database error answers and never stops the server */
  BREAK = true;
  r = await call('POST', '/api/o2s/push/jobs', 'ali', { mode: 'save', rev: 11, jobs: [{ k: 'Pack|b:B2', l: 'Pack', r: 'Production' }] });
  ok('a database error: {ok:false}, no crash', r.s === 200 && r.j && r.j.ok === false);
  BREAK = false;
  r = await call('GET', '/api/o2s/push/key', 'asif'); ok('...the server still answers', r.s === 200 && r.j.ready === true);

  /* night hold and the 7 am summary */
  ok('night is 10 pm to 7 am Pakistan time', mod.isNight(new Date('2026-10-16T17:00:00Z')) === true && mod.isNight(new Date('2026-10-16T01:59:00Z')) === true && mod.isNight(new Date('2026-10-16T02:00:00Z')) === false && mod.isNight(new Date('2026-10-16T16:59:00Z')) === false);
  ok('test hook for the night exists', typeof mod._setNow === 'function');
  if (mod._setNow) {
    mod._setNow(new Date('2026-10-16T18:00:00Z'));   /* 11 pm */
    SENT.length = 0;
    r = await call('POST', '/api/o2s/push/jobs', 'majid', { mode: 'save', rev: 12, jobs: [{ k: 'Approve PR|pr:1', l: 'Approve PR', r: 'CFO' }, { k: 'Inspect|d:DSP1', l: 'Inspect', r: 'QA Inspector', ref: { d: 'DSP1' } }] });
    ok('at night: QA Inspector alert now, CFO alert held', SENT.some(x => x.ep.endsWith('qa-phone')) && !SENT.some(x => x.ep.endsWith('cfo-phone')) && r.j.held === 1);
    eq('...1 row held', (await q('SELECT COUNT(*) n FROM o2s_push_held'))[0][0].n, 1);
    mod._setNow(new Date('2026-10-17T02:05:00Z'));   /* 7:05 am */
    SENT.length = 0; await mod._releaseHeld();
    const s7 = SENT.find(x => x.ep.endsWith('cfo-phone'));
    ok('7 am: 1 summary to the CFO', !!s7 && s7.p.t === 'O2S: 1 new job since 10 pm' && s7.p.b === 'Approve PR');
    eq('...and the held row is gone', (await q('SELECT COUNT(*) n FROM o2s_push_held'))[0][0].n, 0);
    mod._setNow(null);
  }

  /* a device that is gone is removed */
  FAIL_NEXT = 1; SENT.length = 0;
  r = await call('POST', '/api/o2s/push/test', 'yawar', {});
  eq('a device the push service no longer knows is removed', (await q("SELECT COUNT(*) n FROM o2s_push_devices WHERE username='yawar'"))[0][0].n, 0);

  /* the same browser, another person */
  r = await call('POST', '/api/o2s/push/mine', 'shoaib', { endpoint: sub('ali-laptop').endpoint });
  ok('another person signed in on that browser: it stops alerting the first', r.j && r.j.on === false && r.j.released === true);
  eq('...Ali has no device left', (await q("SELECT COUNT(*) n FROM o2s_push_devices WHERE username='ali'"))[0][0].n, 0);
  r = await call('POST', '/api/o2s/push/unsubscribe', 'tahir', { endpoint: sub('pm-phone').endpoint });
  eq('nobody switches off another person\'s device', (await q("SELECT COUNT(*) n FROM o2s_push_devices WHERE username='majid'"))[0][0].n, 1);
  r = await call('POST', '/api/o2s/push/unsubscribe', 'majid', { endpoint: sub('pm-phone').endpoint });
  eq('sign-out or Turn off removes my own device', (await q("SELECT COUNT(*) n FROM o2s_push_devices WHERE username='majid'"))[0][0].n, 0);

  /* who has alerts on */
  r = await call('GET', '/api/o2s/push/people', 'ali'); eq('the list is for the COO and the Plant Manager', r.s, 403);
  r = await call('GET', '/api/o2s/push/people', 'fahim'); ok('Plant Manager sees it; switched-off logins left out', r.j && r.j.ready && r.j.people.length === 8 && r.j.people.find(p => p.username === 'asif').devices.length === 1);

  /* no record of the O2S data was touched */
  const [st] = await q('SELECT rev, data FROM app_state WHERE id=1');
  ok('the O2S data is untouched', st[0].rev === 7 && st[0].data === JSON.stringify(data));

  /* tables missing: not ready, nothing breaks */
  await q('DROP TABLE o2s_push_held'); if (mod._resetTables) mod._resetTables();
  r = await call('GET', '/api/o2s/push/key', 'asif'); ok('without the tables: not ready, no error', r.s === 200 && r.j.ready === false && r.j.tables === false);
  r = await call('POST', '/api/o2s/push/jobs', 'ali', { mode: 'save', rev: 13, jobs: [] }); ok('...jobs: not ready, no error', r.s === 200 && r.j.ok === false);

  srv.close(); await pool.end();
  console.log('\n16c alerts, database routes: ' + pass + ' passed, ' + fail + ' failed');
  fails.forEach(f => console.log('  FAIL  ' + f));
  process.exit(fail ? 1 : 0);
})().catch(async e => { console.error(e); try { await pool.end(); } catch (x) {} process.exit(1); });
