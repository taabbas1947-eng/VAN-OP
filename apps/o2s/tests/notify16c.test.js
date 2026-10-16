/* 16c (Tahir, 16 Oct 2026): alerts on laptop and phone. The screen side and the fixed lists, no database.
   The server routes against a real database: notify16c.db.test.js. Run: node notify16c.test.js */
const vm = require('vm'), fs = require('fs'), path = require('path');
const H = require('./harness.js');
let pass = 0, fail = 0; const fails = [];
const ok = (n, c, x) => c ? pass++ : (fail++, fails.push(n + (x ? '  [' + x + ']' : '')));
const eq = (n, g, w) => ok(n, g === w, 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w));
const html = H.html, DIR = path.join(__dirname, '..');
const R = require(path.join(DIR, 'notify-routes.js'));

/* ---------- 1. every Today job name is known to the server, with the right roles and escalations ---------- */
{ const td = H.grabTopVar('TD_LABEL', '{'); const labels = Object.keys(new Function(td + ';return TD_LABEL')());
  const extra = ['Approve batch fix', 'Reprint DC', 'Reprint report'];
  const miss = labels.concat(extra).filter(l => !Object.prototype.hasOwnProperty.call(R.JOB_ROLES, l));
  ok('1a every Today job name can alert', miss.length === 0, miss.join(', '));
  const esc = H.grab('acEscalation'); const th = {}; esc.replace(/'([^']+)':\[(?:\d+|PL_LINE_STUCK_DAYS),'([^']+)'\]/g, (m, l, r) => { th[l] = r; });
  th['Lab test'] = 'QCM';
  const diff = Object.keys(th).filter(l => R.ESC_TO[l] !== th[l]).concat(Object.keys(R.ESC_TO).filter(l => th[l] !== R.ESC_TO[l]));
  ok('1b escalations: the same targets as Today (acEscalation)', diff.length === 0, diff.join(', '));
  /* the job's own role must be allowed: the roles each builder gives (read from the code) */
  const fixed = { 'Pack QC': 'QA Inspector', 'Inspect': 'QA Inspector', 'Load': 'Warehouse', 'Gate Pass': 'Warehouse', 'Release': 'Plant Manager', 'Approve PR': 'CFO', 'Acknowledge': 'Supply Chain', 'Pack': 'Production', 'Big pack run': 'Production Manager', 'Packed in 2 months': 'Production Manager', 'Approve batch fix': 'COO', 'Lab QC': 'Lab Rep', 'Approve': 'QCM', 'Review truck': 'Supply Chain', 'Print price': 'Finance' };
  const bad = Object.keys(fixed).filter(l => R.JOB_ROLES[l] && R.JOB_ROLES[l].indexOf(fixed[l]) < 0);
  ok('1c fixed roles match the job list', bad.length === 0, bad.join(', '));
  ok('1d Review truck also goes to the Warehouse', R.JOB_ROLES['Review truck'].indexOf('Warehouse') >= 0);
}

/* ---------- 2. the alert text ---------- */
{ const data = { orders: [{ id: 'O1', po: '659', client: 'SYNGENTA', lines: [{ id: 'L1', brand: 'Naya S Urea', price: 4999 }] }], batches: [{ id: 'B1', batchNo: 'VU26164', base: 'Sulfur Coated Urea' }] };
  let t = R.alertText(data, { l: 'Pack QC', ref: { o: 'O1', l: 'L1' } }, 'Ali Raza');
  eq('2a job, product, PO, from whom', t.title + ' / ' + t.body, 'Pack QC / Naya S Urea · PO 659 · from Ali Raza');
  ok('2b no client, no price', !/SYNGENTA|4999/.test(JSON.stringify(t)));
  t = R.alertText(data, { l: 'Pack', ref: { b: 'B1' } }, '');
  eq('2c a batch job', t.body, 'Sulfur Coated Urea · batch VU26164');
  t = R.alertText(data, { l: 'Pack QC', esc: 1, ref: { o: 'O1', l: 'L1' } }, '');
  eq('2d an escalation says so', t.title, 'Escalated to you: Pack QC');
  t = R.alertText({}, { l: 'Name a cover', ref: {} }, '');
  eq('2e nothing to name: still a clear line', t.body, 'Open Today to see it.');
  ok('2f night 10 pm to 7 am Pakistan time', R.isNight(new Date('2026-10-16T17:00:00Z')) && !R.isNight(new Date('2026-10-16T02:00:00Z')));
}

/* ---------- 3. the screen: jobs as Today makes them ---------- */
const SRC = ['pushKeyOf', 'pushRefOf', 'pushJobsNow', 'pushJobsFrom', 'pushAfterSave', 'pushStatus', 'pushCard', 'pushSupported', 'pushIsIOS', 'pushStandalone', 'pushDeviceName', 'pushHdr', 'acKey', '_pe'].map(H.grab).join('\n')
  + '\n' + /var PUSH=\{[^\n]*\};/.exec(html)[0] + '\nvar PUSH_SWEEP_MS=15*60*1000;';
function box(over) {
  const sent = [], timers = [];
  const b = Object.assign({ console, JSON, Object, Array, String, Date, Math, Uint8Array, sent,
    state: { role: 'Production', currentUser: { username: 'ali', name: 'Ali Raza' }, x: [] },
    _plMemo: null, _rev: 9, usersList: [{ username: 'ali' }], loadCalls: 0, loadUsers: function () { b.loadCalls++; return Promise.resolve(); }, _token: 't', authHdr: () => ({ Authorization: 'Bearer t' }),
    acDeferActive: (it) => !!it.deferred, acEscalation: (it) => it.escTo ? { to: it.escTo, days: 3 } : null,
    actionItems: function () { return (b.state.x || []).slice(); },
    setTimeout: (f) => { timers.push(f); }, fetch: (u, o) => { sent.push({ u, body: JSON.parse(o.body) }); return Promise.resolve({ ok: true }); },
    navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130', serviceWorker: {}, platform: 'Win32', maxTouchPoints: 0 },
    window: { PushManager: function () {}, Notification: { permission: 'default' }, matchMedia: () => ({ matches: false }) }, Notification: { permission: 'default' }, timers }, over || {});
  b.globalThis = b; vm.createContext(b); vm.runInContext(SRC, b); return b;
}
{ const b = box();
  const o = { id: 'O1' }, l = { id: 'L1', brand: 'Naya S Urea' };
  b.state.x = [
    { label: 'Pack QC', role: 'QA Inspector', o, l },
    { label: 'Open Production', role: 'Production', o, l }, { label: 'Open Production', role: 'Production', o: { id: 'O2' }, l: { id: 'L9', brand: 'Naya S Urea' } },
    { label: 'Refused', role: 'Supply Chain', who: 'saad', o },
    { label: 'Review truck', role: 'Supply Chain', alsoRoles: ['Warehouse'], notWho: ['shoaib'], disp: { dispId: 'D1' } },
    { label: 'Ship', role: 'Supply Chain', o, escTo: 'Supply Chain' }, { label: 'Load', role: 'Warehouse', disp: { dispId: 'D2' }, escTo: 'Supply Chain' },
    { label: 'Inspect', role: 'QA Inspector', disp: { dispId: 'D3' }, deferred: true } ];
  const j = b.pushJobsNow();
  ok('3a 1 alert per Today card (Open Production by product)', j.filter(x => x.l === 'Open Production').length === 1 && j.some(x => x.k === 'prod:Naya S Urea'));
  ok('3b the job carries its role, person, second role and kept-off list', j.some(x => x.l === 'Refused' && x.w === 'saad') && j.some(x => x.l === 'Review truck' && x.a[0] === 'Warehouse' && x.n[0] === 'shoaib'));
  ok('3c an escalation to another role is its own item; to the same role it is not', j.some(x => x.esc && x.l === 'Load' && x.r === 'Supply Chain' && x.k === 'esc|' + b.acKey({ label: 'Load', disp: { dispId: 'D2' } })) && !j.some(x => x.esc && x.l === 'Ship'));
  ok('3d a deferred job waits for its return day', !j.some(x => x.l === 'Inspect'));
  ok('3e record ids only, no text', j.every(x => !('what' in x)) && j.find(x => x.l === 'Pack QC').ref.o === 'O1');

  /* Way 1: only the jobs this save made; the live state is put back */
  b.PUSH.ready = true; const live = b.state;
  const before = { x: [{ label: 'Pack QC', role: 'QA Inspector', o, l }] };
  const after = { x: [{ label: 'Pack QC', role: 'QA Inspector', o, l }, { label: 'Load', role: 'Warehouse', disp: { dispId: 'D9' }, escTo: 'Supply Chain' }] };
  b.pushAfterSave(before, JSON.stringify(after)); ok('3f the save is never waited on (runs after it)', b.timers.length === 1 && b.sent.length === 0);
  b.timers.shift()();
  ok('3g sends only the new job, never an escalation', b.sent.length === 1 && b.sent[0].body.mode === 'save' && b.sent[0].body.jobs.length === 1 && b.sent[0].body.jobs[0].l === 'Load');
  ok('3h the live data is put back', b.state === live && b.state.currentUser.username === 'ali');
  b.sent.length = 0; b.PUSH.ready = false; b.pushAfterSave(before, JSON.stringify(after)); ok('3i nothing when alerts are not ready', b.timers.length === 0);
  b.PUSH.ready = true; b.actionItems = () => { throw new Error('boom'); }; b.pushAfterSave(before, JSON.stringify(after)); b.timers.shift()();
  ok('3j a failure sends nothing and the live data is put back', b.sent.length === 0 && b.state === live);
  const b2 = box({ usersList: [] }); b2.PUSH.ready = true; b2.pushAfterSave(before, JSON.stringify(after));
  ok('3k the people list loads first (jobs that name their person need it)', b2.timers.length === 0 && b2.loadCalls === 1);
}
{ /* the card's states */
  const s = (over, push) => { const b = box(over); Object.assign(b.PUSH, push); return b.pushStatus(); };
  eq('4a checking: nothing shown yet', s({}, { ready: null }), 'checking');
  eq('4b routes missing (old server): nothing shown', s({}, { ready: false, absent: true }), 'absent');
  eq('4c no keys on the server', s({}, { ready: false, keys: false }), 'offserver');
  eq('4d tables missing', s({}, { ready: false, keys: true }), 'notready');
  eq('4e ready, not on', s({}, { ready: true, keys: true }), 'off');
  eq('4f on', s({}, { ready: true, keys: true, mine: true }), 'on');
  eq('4g blocked in the browser', s({ Notification: { permission: 'denied' } }, { ready: true, keys: true }), 'blocked');
  eq('4h iPhone in Safari: add to Home Screen first', s({ navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5) Safari/604', standalone: false, serviceWorker: {} } }, { ready: true, keys: true }), 'ios');
  eq('4i iPhone from the Home Screen', s({ navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5) Safari/604', standalone: true, serviceWorker: {} } }, { ready: true, keys: true }), 'off');
  eq('4j a browser that cannot', s({ navigator: { userAgent: 'Old', platform: 'x' }, window: {} }, { ready: true, keys: true }), 'unsupported');
  const b = box(); Object.assign(b.PUSH, { ready: true, keys: true });
  ok('4k Off shows Turn on alerts', /Turn on alerts/.test(b.pushCard())); b.PUSH.mine = true;
  ok('4l On shows the test and Turn off', /Send me a test alert/.test(b.pushCard()) && /Turn off/.test(b.pushCard()));
  const c = (role, push, over) => { const x = box(over); x.state.role = role; Object.assign(x.PUSH, push); return x.pushCard(); };
  ok('4m setup not finished: nothing shown to Production', c('Production', { ready: false, keys: false }) === '' && c('QA Inspector', { ready: false, keys: true }) === '');
  ok('4n ...the COO and the Plant Manager are told', /alert keys are not set/.test(c('COO', { ready: false, keys: false })) && /alert tables are not in the database/.test(c('Plant Manager', { ready: false, keys: true })));
  const iosOld = { navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_7) Safari/604', standalone: true, serviceWorker: {} }, window: {} };
  eq('4o iPhone with the server not ready: not ready first, not the Home Screen hint', s({ navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5) Safari/604', standalone: false, serviceWorker: {} } }, { ready: false, keys: true }), 'notready');
  ok('4p an older iPhone is told to update to iOS 16.4', /iOS 16\.4 or newer/.test(c('Production', { ready: true, keys: true }, iosOld)));
}

/* ---------- 5. wiring ---------- */
{ const sv = H.grab('saveNow');
  ok('5a the base before the save is kept', /const _pushBase=_baseSnapshot;/.test(sv) && sv.indexOf('const _pushBase') < sv.indexOf("await fetch('/api/state'"));
  ok('5b alerts only after the server took the save, never on a conflict', /if\(!_older\) _baseSnapshot=JSON\.parse\(_bodyStr\); try\{ if\(!_older\) pushAfterSave\(_pushBase,_bodyStr\); \}catch\(e\)\{\} \}/.test(sv) && sv.indexOf('pushAfterSave') > sv.indexOf('if(r.ok)'));
  ok('5c sign-out stops this device first', /function logout\(\)\{ try\{ pushSignOut\(\); \}catch\(e\)\{\}/.test(html));
  const ra = H.grab('renderApp');
  ok('5d checked again for each person who signs in; the earlier steps unchanged', /PUSH\.user!==_pu/.test(ra) && /checkWhatsNew\(\); \} try\{ if\(state\.role==='COO' && typeof migrateAccountsV1==='function'\) migrateAccountsV1\(\); \}catch\(e\)\{\}/.test(ra));
  ok('5e the card on Today', /h\+=tdStarts\(\);\n  h\+=pushCard\(\);/.test(H.grab('screenToday')));
  ok('5f Home Screen: manifest and icon', /<link rel="manifest" href="\/o2s\/manifest\.json">/.test(html) && /<link rel="apple-touch-icon" href="\/o2s\/icons\/apple-touch-180\.png">/.test(html));
  const sw = H.grab('pushSweep');
  ok('5g the 15-minute list only from an up-to-date screen', /_savePending\|\|_buildStale/.test(sw) && /if\(rj\.rev!==_rev\) return;/.test(sw));
  ok('5h nothing about alerts is written into the O2S data', !/logAction|save\(\)|saveNow\(\)/.test(['pushTurnOn', 'pushTurnOff', 'pushTest', 'pushAfterSave', 'pushSweep', 'pushCheck', 'pushRefreshMine', 'pushSignOut'].map(H.grab).join('\n')));
  ok('5j a tap on an alert never wipes typing or an open sheet', /hasUnsavedEntry\(\)\|\|\$\('modalBg'\)\.classList\.contains\('open'\)/.test(H.grab('pushStart')));
  ok('5k the 15-minute list waits for the people list', /await loadUsers\(\)/.test(sw) && sw.indexOf('loadUsers') < sw.indexOf('pushJobsNow'));
  ok('5m switching on and the test alert read {ok:false} as a failure', /rj\.ok===false/.test(H.grab('pushTurnOn')) && /j\.ok===false/.test(H.grab('pushTest')));
  ok('5l Back Office counts people, not role rows', /seenP\[p\.username\]/.test(H.grab('pushPeopleList')));
  ok('5i Back Office list for the COO and the Plant Manager', /state\.role==='COO'\|\|state\.role==='Plant Manager'\) D\.push\(\{k:'alerts'/.test(html));
}

/* ---------- 6. the files that go with it ---------- */
{ const sw = fs.readFileSync(path.join(DIR, 'sw.js'), 'utf8');
  ok('6a the alert part shows and opens, and serves no pages (never an old build)', /addEventListener\('push'/.test(sw) && /notificationclick/.test(sw) && !/addEventListener\('fetch'/.test(sw));
  const mf = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
  ok('6b manifest: standalone, /o2s, icons 192 and 512', mf.display === 'standalone' && mf.start_url === '/o2s' && mf.icons.some(i => i.sizes === '192x192') && mf.icons.some(i => i.sizes === '512x512'));
  ok('6c every icon file exists', mf.icons.every(i => fs.existsSync(path.join(DIR, i.src.replace('/o2s/', '')))) && fs.existsSync(path.join(DIR, 'icons', 'apple-touch-180.png')) && fs.existsSync(path.join(DIR, 'icons', 'badge-96.png')));
  const sql = fs.readFileSync(path.join(DIR, 'migrations', 'O001_alerts.sql'), 'utf8');
  ok('6d migration: 3 new tables only, safe twice, no change to anything else', (sql.match(/CREATE TABLE IF NOT EXISTS o2s_push_/g) || []).length === 3 && !/DROP|ALTER|DELETE|UPDATE|INSERT/i.test(sql.replace(/--.*$/mg, '')));
  const nr = fs.readFileSync(path.join(DIR, 'notify-routes.js'), 'utf8');
  ok('6e the text is built on the server; the screen\'s "what" is never sent', !/\.what\b/.test(nr) && /alertText\(data/.test(nr));
  ok('6f "from" is the person signed in', /req\.user && req\.user\.n/.test(nr));
}

/* ---------- 7. Guide, changelog, build ---------- */
ok('7a Guide rule', /<h3>Alerts on your phone and laptop<\/h3>/.test(H.grab('guideRules')) && /'Alerts on your phone and laptop':'R-039'/.test(html));
ok('7b changelog 16c', /'2026-10-16c'/.test(H.grabTopVar('CHANGELOG', '[')));
ok('7c build 16c or later', /var BUILD_ID='2026-10-(16[c-z]|1[7-9][a-z]|[23][0-9][a-z])'/.test(html) && /SYSDOC_VER='2026-10-(16[c-z]|1[7-9][a-z]|[23][0-9][a-z])'/.test(html));
ok('7d My job note for everyone', /New on 16 Oct \(16c\)/.test(H.grab('guideMyJob')));

console.log('\n16c alerts, screen and lists: ' + pass + ' passed, ' + fail + ' failed');
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fail ? 1 : 0);
