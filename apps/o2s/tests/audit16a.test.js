/* 16a (Tahir, 15 Oct night): read and sign once; System documentation with a test that fails the build
   when a Guide rule, a build, a role or a data list has no entry.
   Run: node audit16a.test.js */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const H = require('./harness.js');
let pass = 0, fail = 0; const fails = [];
const ok = (n, c, x) => c ? pass++ : (fail++, fails.push(n + (x ? '  [' + x + ']' : '')));
const eq = (n, g, w) => ok(n, g === w, 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w));
const html = H.html;
const topVar = (name) => { const m = new RegExp('var ' + name + '=([\\s\\S]*?);\\n').exec(html); return m ? m[0] : ''; };

/* ---------- 1. read and sign ---------- */
const lineVar = (n) => { const m = new RegExp('\\nvar ' + n + '=[^\\n;]*;').exec(html); if (!m) throw new Error('no var ' + n); return m[0].trim(); };
const RS_FNS = ['rsParts', 'rsQ', 'rsPicOf', 'rsWhat', 'rsWords', 'rsMinMs', 'rsUserKey', 'rsShared', 'rsDevice', 'rsSignOf', 'rsSignsOf', 'rsMySign', 'rsPending', 'rsNorm', 'rsNameOk',
  'rsProgKey', 'rsKeep', 'rsShuffle', 'rsSaved', 'rsSign', 'rsWaitSaved', 'rsDone', 'readSignRows', 'openReadSignList', 'rsListHTML'];
const RS_SRC = ["var RS_BRIEF='" + /var RS_BRIEF='([^']+)'/.exec(html)[1] + "';", H.grabTopVar('RS_ALL', '['), H.grabTopVar('RS_PARTS', '['),
  lineVar('RS_REREAD_MS'), lineVar('RS_MS_PER_WORD'), lineVar('RS_SHARED_RE'), lineVar('_rsSeed'), lineVar('RS_SAVE_WAIT_MS'), lineVar('_rsListAsked')].join('\n')
  + '\n' + RS_FNS.map(n => H.grab(n)).join('\n');
function box(role, name, user, extra, opt) {
  opt = opt || {}; const toasts = [], logs = [], timers = [], store = Object.assign({}, opt.store || {});
  let now = 1760000000000; const FakeDate = function (x) { return x === undefined ? new Date(now) : new Date(x); }; FakeDate.now = () => now; FakeDate.parse = Date.parse;
  const s = { console, Date: FakeDate, Math, JSON, Object, String, Array, RegExp, Promise, toasts, logs, timers, BUILD_ID: '2026-10-16a', CHANGELOG: [{ ver: '2026-10-16a' }],
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } }, store,
    toast: m => toasts.push(m), logAction: m => logs.push(m), save: () => { s.saved = (s.saved || 0) + 1; },
    closeReadSign: () => { s.closed = true; s.rsForm = null; }, render: () => {}, renderReadSign: () => { s.drawn = (s.drawn || 0) + 1; }, rsSignState: () => {},
    _plDay: d => d, localDateOf: d => String(d).slice(0, 10), qsEsc: x => String(x), setTimeout: (f, ms) => { timers.push(f); }, usersList: opt.users || [],
    _baseSnapshot: null, _buildStale: false, document: { getElementById: () => null } };
  s.tick = (ms) => { now += ms; const t = timers.splice(0); t.forEach(f => f()); };
  s.state = Object.assign({ role, currentUser: { name, username: user }, orders: [{ po: 'P1' }], readSigns: [] }, extra || {});
  vm.createContext(s); vm.runInContext(RS_SRC + '\nvar rsForm=null;', s); return s;
}
const allDone = (s) => { const ps = s.rsParts(s.state.role).map(p => p.id); const o = {}; ps.forEach(id => o[id] = true); return { parts: ps, ok: o, wrong: {}, typed: '', tick: true, nameLeft: false, manual: false, row: null, saving: false, err: '' }; };
{
  const s = box('Production', 'Ali Raza', 'ali');
  const ids = r => s.rsParts(r).map(p => p.id).join(',');
  eq('Production reads 6 parts', ids('Production'), 'p0,p1,p2,p3,p8,p10');
  eq('Supply Chain reads 7 parts', ids('Supply Chain'), 'p0,p3,p4,p5,p6,p9,p11');
  eq('the COO reads all 12', s.rsParts('COO').length, 12);
  eq('the CFO reads For everyone, Packing (Correct a record) and Who can open what', ids('CFO'), 'p0,p1,p9');
  eq('Warehouse reads 5 parts', ids('Warehouse'), 'p0,p5,p6,p9,p11');
  eq('the Lab Rep: no truck leak check, but Batch trace', ids('Lab Rep'), 'p0,p8,p9');
  eq('the AQCM: nothing new in Who can open what', ids('AQCM'), 'p0,p8');
  eq('the QCM', ids('QCM'), 'p0,p7,p8');
  ok('every role in O2S reads at least For everyone', s.RS_ALL.every(r => s.rsParts(r)[0].id === 'p0'));
  const qs = []; s.RS_PARTS.forEach(p => { qs.push([p.id, '*', p.q]); Object.keys(p.qr || {}).forEach(r => qs.push([p.id, r, p.qr[r]])); });
  ok('every question has 3 answers, a right one and a reason', qs.every(x => x[2] && x[2].o.length === 3 && x[2].a >= 0 && x[2].a < 3 && x[2].why), qs.filter(x => !(x[2] && x[2].o.length === 3)).map(x => x[0]).join(','));
  ok('the right answer is not always in the same place in the data', new Set(qs.map(x => x[2].a)).size === 3);
  ok('a role question only for a role that reads the part', qs.every(x => x[1] === '*' || s.RS_PARTS.filter(p => p.id === x[0])[0].roles.indexOf(x[1]) >= 0));
  ok('every part has a picture', s.RS_PARTS.every(p => (p.pic || []).length >= 1));
  const noLine = []; s.RS_PARTS.forEach(p => p.roles.forEach(r => { s.state.role = r; if (!s.rsWhat(p).length) noLine.push(p.id + ':' + r); }));
  ok('everyone who reads a part sees at least 1 line of it', noLine.length === 0, noLine.join(','));
  s.state.role = 'Lab Rep'; const p9 = s.RS_PARTS.filter(p => p.id === 'p9')[0];
  ok('the Lab Rep is not sent to FOC sample lists they cannot open', s.rsWhat(p9).length === 1 && /Batch trace/.test(s.rsWhat(p9)[0]) && /Batch trace/.test(s.rsQ(p9).o[s.rsQ(p9).a]));
  ok('...and no FOC picture either', !/FOC/.test(JSON.stringify(s.rsPicOf(p9))));
  s.state.role = 'QA Inspector'; const p7 = s.RS_PARTS.filter(p => p.id === 'p7')[0];
  ok('QA leak check: a drop from the pressed bottle is Leaking', /upside down and press/.test(p7.q.t) && p7.q.o[p7.q.a] === 'Leaking');
  ok('QA reads that a changed batch comes back, and no All pass on FOC', s.rsWhat(p7).some(w => /comes back to you/.test(w)) && s.rsWhat(p7).some(w => /no All pass/.test(w)));
  s.state.role = 'KAM'; const p4 = s.RS_PARTS.filter(p => p.id === 'p4')[0];
  ok('the KAM answers about their own job on Stuck at packing', /\byou\b/i.test(s.rsQ(p4).t) && s.rsQ(p4) !== p4.q);
  s.state.role = 'Production';
  const p0 = s.RS_PARTS[0]; ok('For everyone asks about packing done 3 days ago', /3 days ago/.test(p0.q.t));
  ok('a part waits at least 5 seconds, about 3 seconds per 10 words', s.RS_PARTS.every(p => s.rsMinMs(p) >= 5000 && s.rsMinMs(p) === Math.max(5000, s.rsWords(p, true) * 300)));
  ok('a shuffle has every answer once', [0, 1, 2, 3, 4].every(() => s.rsShuffle(3).slice().sort().join() === '0,1,2'));
  ok('pending before signing', s.rsPending());
  ok('not pending with no orders', !box('Production', 'Ali Raza', 'ali', { orders: [] }).rsPending());
  { const z = box('Production', 'Ali Raza', 'ali'); z._rsSeed = true; ok('not pending on the built-in starting data', !z.rsPending()); }
  ok('not pending for a role outside the 15', !box('Director', 'X', 'x').rsPending());
  /* sign */
  s.rsForm = allDone(s); delete s.rsForm.ok.p10; s.rsForm.typed = 'Ali Raza'; s.rsForm.wrong = { p3: 2 };
  s.rsSign(); ok('cannot sign with a part not done', s.state.readSigns.length === 0 && /Finish every part/.test(s.toasts.pop()));
  s.rsForm.ok.p10 = true; s.rsForm.typed = 'Jawad'; s.rsSign();
  ok('a name that is not the account name is refused', s.state.readSigns.length === 0 && /as it is on your account/.test(s.toasts.pop()));
  s.rsForm.typed = 'ali  RAZA'; s.rsForm.tick = false; s.rsSign();
  ok('the tick is required', s.state.readSigns.length === 0 && /Tick/.test(s.toasts.pop()));
  s.rsForm.tick = true; s.rsSign();
  const r = s.state.readSigns[0];
  ok('signed: 1 row with its own id', s.state.readSigns.length === 1 && /^RS/.test(r.id));
  ok('...brief, user, name, role, build, device', r.brief === s.RS_BRIEF && r.user === 'ali' && r.name === 'Ali Raza' && r.role === 'Production' && r.build === '2026-10-16a' && /^D/.test(r.device));
  ok('...the parts read and the wrong tries kept', r.parts.length === 6 && r.wrong.p3 === 2);
  ok('...the typed name kept as typed', r.typed === 'ali  RAZA');
  ok('...saved, and the page stays open saying Saving until the server has it', s.saved === 1 && s.rsForm && s.rsForm.saving && !s.closed);
  s.tick(500); ok('...still open while the server has not confirmed', !s.closed);
  s._baseSnapshot = { readSigns: [r] }; s.tick(500);
  ok('...closes once the server has the sign, and says it is saved', s.closed === true && /saved/.test(s.toasts.pop()));
  ok('...logged', /Read and signed/.test(s.logs[0]));
  ok('no longer pending', !s.rsPending());
}
{ /* no internet: the page stays, says Not saved yet, and Sign again adds no second row */
  const s = box('Warehouse', 'Shoaib', 'shoaib'); s.rsForm = allDone(s); s.rsForm.typed = 'Shoaib';
  s.rsSign(); s.tick(16000); s.tick(1);
  ok('no internet: not closed, says Not saved yet', !s.closed && /Not saved yet: check your internet/.test(s.rsForm.err) && !s.rsForm.saving);
  s.rsSign(); eq('Sign again: still 1 row', s.state.readSigns.length, 1); eq('...and saved again', s.saved, 2);
  s._baseSnapshot = { readSigns: s.state.readSigns.slice() }; s.tick(400); ok('...closes when it gets through', s.closed === true);
}
{ /* a new build while reading: the save is refused, the page says so and keeps the answers */
  const s = box('Warehouse', 'Shoaib', 'shoaib'); s.rsForm = allDone(s); s.rsForm.typed = 'Shoaib'; s._buildStale = true;
  s.rsSign(); s.tick(1);
  ok('new build: not closed, says Refresh now', !s.closed && /newer version of O2S/.test(s.rsForm.err));
}
{ /* progress is kept on the device; a reload keeps the parts done */
  const s = box('Production', 'Ali Raza', 'ali'); s.rsForm = allDone(s); s.rsKeep();
  const k = JSON.parse(s.store[s.rsProgKey()]); ok('progress kept on the device', k.ok.p0 && k.role === 'Production');
}
{ /* shared logins: own name, once per device, more than 1 sign per login */
  const s = box('Production', 'Production 1', 'prod1', null, { store: { o2s_device: 'Dtab1' } });
  ok('prod1 is a shared login', s.rsShared());
  ok('...any own full name is accepted', s.rsNameOk('Abdul Majid') && !s.rsNameOk('ab'));
  s.rsForm = allDone(s); s.rsForm.typed = 'Abdul Majid'; s.rsSign(); s._baseSnapshot = { readSigns: s.state.readSigns.slice() }; s.tick(400);
  const r = s.state.readSigns[0]; ok('...the row says shared, the typed name and the device', r.shared === true && r.typed === 'Abdul Majid' && r.device === 'Dtab1');
  ok('...not pending again on this device', !s.rsPending());
  const t = box('Production', 'Production 1', 'prod1', { readSigns: [r] }, { store: { o2s_device: 'Dphone2' } });
  ok('...pending on another device', t.rsPending());
  ok('the COO is never treated as shared', !box('COO', 'Tahir', 'coo').rsShared());
  ok('progress is not kept on a shared login (the next person reads it all)', (() => { const u = box('Production', 'P1', 'prod1'); u.rsForm = allDone(u); u.rsKeep(); return !Object.keys(u.store).some(x => /^o2s_rs_/.test(x)); })());
}
{ /* names in any script, and an empty account name */
  ok('an Urdu account name can be signed', box('Warehouse', 'شعیب', 'shoaib').rsNameOk(' شعیب '));
  ok('an empty account name: any name of 2 letters or more', box('Warehouse', '', 'shoaib').rsNameOk('Shoaib'));
}
{ /* Back Office list */
  const users = [{ username: 'ali', name: 'Ali Raza', role: 'Production' }, { username: 'prod1', name: 'Production 1', role: 'Production' }, { username: 'admin', name: 'Administrator', role: 'COO' }, { username: 'x', name: 'X', role: 'Director' }, { username: 'saad', name: 'Saad', role: 'Supply Chain' }];
  const signs = [{ id: 'a', brief: '2026-10-13-15', user: 'prod1', typed: 'Abdul Majid', name: 'Production 1', role: 'Production', shared: true, at: '2026-10-16T03:00:00Z', wrong: {} },
                 { id: 'b', brief: '2026-10-13-15', user: 'prod1', typed: 'Jawad Naseer', name: 'Production 1', role: 'Production', shared: true, at: '2026-10-16T03:10:00Z', wrong: {} },
                 { id: 'd', brief: '2026-10-13-15', user: 'admin', typed: 'Administrator', name: 'Administrator', role: 'COO', at: '2026-10-16T03:30:00Z', wrong: {} },
                 { id: 'c', brief: '2026-10-13-15', user: 'saad', typed: 'Saad', name: 'Saad', role: 'Supply Chain', at: '2026-10-16T03:20:00Z', wrong: { p4: 1 } }];
  const s = box('COO', 'Tahir', 'tahir', { readSigns: signs }, { users });
  const rows = s.readSignRows();
  ok('the Administrator (even once he signs) and roles outside the 15 are not listed', !rows.some(r => r.user === 'admin' || r.user === 'x'));
  eq('a shared login shows each person who signed on it', rows.filter(r => r.user === 'prod1').length, 2);
  ok('...by the name they typed', rows.some(r => /Abdul Majid/.test(r.name)) && rows.some(r => /Jawad Naseer/.test(r.name)));
  ok('not signed first', rows[0].user === 'ali' && !rows[0].sign);
}
{ /* the people list that cannot load is asked for once, not in a loop */
  let calls = 0; const s = box('COO', 'Tahir', 'tahir');
  const modal = { innerHTML: '' }; const boxEl = { innerHTML: '' };
  s.$ = id => id === 'modal' ? modal : { classList: { add() {} } };
  s.document = { getElementById: id => (id === 'rsListBox' && /rsListBox/.test(modal.innerHTML)) ? boxEl : null };
  s.loadUsers = () => { calls++; return Promise.resolve(); };
  s.openReadSignList();
  ok('loading shows Loading, not a green 0 of 0', /Loading the people list/.test(boxEl.innerHTML));
  setImmediate(() => { 
    ok('the people list is asked for once', calls === 1);
    ok('...then says it could not be loaded', /could not be loaded/.test(boxEl.innerHTML));
    finish();
  });
}
{ /* 2 people sign at the same moment: the real merge keeps both rows */
  const b = { console, JSON, Object, Array }; vm.createContext(b); vm.runInContext(['_eq', '_arrId', 'merge3'].map(n => H.grab(n)).join('\n'), b);
  const m = b.merge3({ readSigns: [] }, { readSigns: [{ id: 'RSa', user: 'ali' }] }, { readSigns: [{ id: 'RSb', user: 'saad' }] });
  eq('2 signs at once: both kept', (m.readSigns || []).length, 2);
}
{ /* the page shows before the app, wrong answer means read again */
  const ra = H.grab('renderApp');
  ok('the app opens the page first when not signed', /if\(rsPending\(\)\) openReadSign\(\); else \{ closeReadSign\(\); checkWhatsNew\(\); \}/.test(ra));
  ok('signed out: the page is closed, never over the sign-in', /if\(!authed\(\)\)\{ try\{ closeReadSign\(\); \}catch\(e\)\{\}/.test(ra));
  const an = H.grab('rsAnswer');
  ok('a wrong answer counts a try, hides the question and opens the part again', /f\.wrong\[pid\]=\(f\.wrong\[pid\]\|\|0\)\+1; f\.seen\[pid\]=false; f\.endSeen\[pid\]=false; f\.reread\[pid\]=true;/.test(an));
  ok('...with the answers in a new order next time', /delete f\.order\[pid\]/.test(an));
  ok('...and at least 8 seconds to read again', /f\.need\[pid\]=Math\.max\(RS_REREAD_MS/.test(an));
  ok('the question shows only with the end on screen and the reading time passed', /if\(f\.endSeen\[id\]&&now-\(f\.openAt\[id\]\|\|now\)>=\(f\.need\[id\]\|\|0\)\)\{ f\.seen\[id\]=true;/.test(H.grab('rsWatch')));
  const rr = H.grab('renderReadSign');
  ok('the answers are shuffled for each person', /f\.order\[p\.id\]=rsShuffle\(q\.o\.length\)/.test(rr));
  ok('a part opens only after the one before is answered', /var open=ix===0\|\|f\.ok\[parts\[ix-1\]\.id\]/.test(rr));
  ok('the sign box shows only when every part is done', /if\(done===n\)\{/.test(rr));
  ok('the heading says about how many minutes', /about '\+mins\+' minute/.test(rr));
  ok('Back Office lists who signed', /k:'readsign',t:'Read and signed'/.test(H.grab('boDesks')) && /function openReadSignList/.test(html));
  const z = +(/#rsPage\{[^}]*z-index:(\d+)/.exec(html) || [])[1], zt = +(/\.toast\{[^}]*z-index:(\d+)/.exec(html) || [])[1];
  ok('messages and the new-version bar show above the page', z > 320 && z < zt, 'page ' + z + ' toast ' + zt);
  ok('the app under the page cannot be reached with the Tab key', /sh\.inert=true/.test(H.grab('openReadSign')));
  ok('signed on another device closes the page, but never our own sign still on its way', /if\(rsForm\.saving\|\|rsForm\.manual\|\|rsForm\.row\) return;/.test(H.grab('openReadSign')));
  ok('the Back Office tile shows no green count before the people list loads', /var _have=\(usersList\|\|\[\]\)\.length>0;/.test(H.grab('boDesks')));
  ok('a shared login can open the page again from the Guide', /openReadSign\(true\)/.test(H.grab('guidePage')));
  const dl = H.grab('doLogin');
  ok('sign in: data not loaded means sign in again, never the June data saved over the server', /if\(!loaded\)\{ setSession\(''/.test(dl) && !/if\(!loaded\)\{ state=buildFromSeed\(\); \}/.test(dl));
  ok('the built-in starting data is marked, so the page does not open on it', /_rsSeed=true/.test(H.grab('buildFromSeed')));
}

/* ---------- 2. System documentation: the failing test ---------- */
const dataM = /\/\*SYSDOC_DATA_START\*\/var SYSDOC_DATA=([\s\S]*?);\/\*SYSDOC_DATA_END\*\//.exec(html);
const D = dataM ? JSON.parse(dataM[1]) : {};
const ids = (() => { const b = { console }; vm.createContext(b); vm.runInContext(H.grabTopVar('SYSDOC_RULE_IDS', '{'), b); return b.SYSDOC_RULE_IDS; })();
const tabs = (() => { const b = { console }; vm.createContext(b); vm.runInContext(H.grabTopVar('SYSDOC_TABS', '['), b); return b.SYSDOC_TABS.map(t => t[0]); })();
eq('12 parts', tabs.length, 12);
const ruleTitles = [...H.grab('guideRules').matchAll(/<h3>(.*?)<\/h3>/g)].map(m => m[1]);
const noId = ruleTitles.filter(t => !ids[t]);
ok('every Guide rule has a rule number (add it to SYSDOC_RULE_IDS)', noId.length === 0, noId.join(' | '));
const gone = Object.keys(ids).filter(t => ruleTitles.indexOf(t) < 0);
ok('every rule number points at a rule that exists', gone.length === 0, gone.join(' | '));
ok('rule numbers are unique', new Set(Object.values(ids)).size === Object.keys(ids).length);
const written = ['flows', 'dataflows', 'logic', 'schema', 'api', 'decisions', 'formulas', 'dictionary', 'access', 'tests'];
written.forEach(t => {
  const T = D[t];
  ok('part ' + t + ' has entries', T && (T.items || []).length > 0);
  if (!T) return;
  ok('part ' + t + ' has a version and a date', !!T.ver && /^\d{4}-\d{2}-\d{2}$/.test(T.date || ''));
  const bad = (T.items || []).filter(i => !i.id || !i.title || !i.owner || !(i.status === 'confirmed' || i.status === 'not confirmed'));
  ok('part ' + t + ': every item has an id, a title, an owner and a status', bad.length === 0, bad.map(i => i.id).join(','));
  const noAsk = (T.items || []).filter(i => i.status === 'not confirmed' && !i.ask);
  ok('part ' + t + ': every not confirmed item carries its question', noAsk.length === 0, noAsk.map(i => i.id).join(','));
  const badRule = []; (T.items || []).forEach(i => (i.rules || []).forEach(r => { if (/^R-/.test(r) && Object.values(ids).indexOf(r) < 0) badRule.push(i.id + ':' + r); }));
  ok('part ' + t + ': every rule number exists', badRule.length === 0, badRule.join(','));
});
/* every build is in the change log part (drawn live from CHANGELOG) */
{
  const b = { console, qsEsc: x => String(x) }; vm.createContext(b); vm.runInContext(H.grabTopVar('CHANGELOG', '[') + '\n' + H.grab('sysDocChangelog'), b);
  const out = b.sysDocChangelog(); const vers = b.CHANGELOG.map(c => c.ver);
  ok('every build is in the change log part', vers.every(v => out.indexOf(v) >= 0), vers.filter(v => out.indexOf(v) < 0).join(','));
  ok('every build says what changed', b.CHANGELOG.every(c => (c.items || []).length > 0), b.CHANGELOG.filter(c => !(c.items || []).length).map(c => c.ver).join(','));
}
/* every role has an entry in access */
{
  const roles = new Set();
  const sc = /const SCREENS=\[([\s\S]*?)\n\];/.exec(html); (sc ? sc[1] : '').replace(/owners:\[([^\]]*)\]/g, (_, l) => { l.replace(/'([^']+)'/g, (__, r) => roles.add(r)); });
  const acc = JSON.stringify(D.access || {});
  const miss = [...roles].filter(r => acc.indexOf(r) < 0);
  ok('every role has an entry in Access and roles', roles.size > 10 && miss.length === 0, miss.join(', '));
}
/* every data list has an entry in Data schemas */
{
  const lists = ['orders', 'lines', 'shipments', 'batches', 'lots', 'packingLog', 'productionLog', 'shiftEntries', 'inspections', 'samples', 'corrections', 'poMoves', 'customers', 'dealers', 'warehouses', 'prs', 'rmRequests', 'rmMovements', 'audit', 'actionLog', 'masters', 'acDefer', 'taken', 'readSigns', 'waitMarks'];
  const sch = JSON.stringify(D.schema || {});
  const miss = lists.filter(l => sch.indexOf(l) < 0);
  ok('every data list has an entry in Data schemas', miss.length === 0, miss.join(', '));
}
ok('System documentation opens from the Guide for everyone', /tabs\.push\(\['sysdoc','System documentation'\]\)/.test(H.grab('guideTabsHTML')) && /guideTab==='sysdoc'\) h\+=sysDocHTML\(\)/.test(H.grab('guidePage')));
ok('...and from Back Office', /k:'sysdoc',t:'System documentation'/.test(H.grab('boDesks')));
ok('Guide rule: System documentation', /<h3>System documentation<\/h3>/.test(H.grab('guideRules')));
ok('changelog 16a and BUILD_ID', /ver:'2026-10-16a'/.test(html) && /var BUILD_ID='2026-10-16[a-z]';/.test(html));

/* the app page can be opened before sign-in: no security weakness is written into it */
{
  const FINAL = /restart clears|password is right|jodilkah|HostGator|\/home\/claude|Any signed-in login|\bS-[01]\d\b|no O2S role check|does not check the O2S role|password length is checked|default password|password hash|is public|SESSION_SECRET|overwrite all|can read the list of logins/i;
  const left = []; Object.keys(D).forEach(t => (D[t].items || []).forEach(i => { if (i.id === 'TS-07') return; const j = JSON.stringify(i); if (FINAL.test(j)) left.push(t + ':' + i.id); }));
  ok('no security weakness in System documentation (they stay in docs/SECURITY-REGISTER.md)', left.length === 0, left.join(','));
  const ts7 = ((D.tests || {}).items || []).filter(i => i.id === 'TS-07')[0];
  ok('...the Tests part only points to the register', ts7 && (ts7.blocks||[]).length === 1 && !/\bS-0\d/.test(JSON.stringify(ts7)));
}
function finish(){
console.log((fails.length ? fails.map(f => '  FAIL  ' + f).join('\n') + '\n' : '') + '16a: read and sign, System documentation: ' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exitCode = 1;
}
