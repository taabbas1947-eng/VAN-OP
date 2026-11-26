// B7, B10, B11, B12, B14 (D-195, 25 Nov 2026): page checks in jsdom.
// Run: node apps/c2m/tests/page-195.test.js
const fs = require('fs'); const path = require('path'); const { JSDOM, html: PAGE, fixture: FIXTURE } = require('./_page.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
let calls = [];
const dom = new JSDOM(fs.readFileSync(PAGE, 'utf8'), { runScripts: 'dangerously', url: 'https://x.test/c2m', beforeParse(w) { w.localStorage.setItem('van_token', 't'); w.fetch = () => new Promise(() => {}); w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} }); w.scrollTo = () => {}; } });
const w = dom.window; const E = s => w.eval(s); const doc = w.document;
const main = () => doc.querySelector('main') || doc.getElementById('app');
const click = el => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const tick = () => new Promise(r => setTimeout(r, 20));
setTimeout(async () => {
  try {
    w.eval(fs.readFileSync(FIXTURE, 'utf8'));
    E("ST = window.__STF; ST.me.nav = ['approvals', 'clients', 'margin', 'costs', 'pricelists', 'products', 'reports']; ST.me.more = ['setup', 'guide']; _pi = null");
    w.__calls = calls; E("api = async (p, b) => { window.__calls.push([p, b]); if (/remind/.test(p)) return { ok: true, role: 'qc' }; if (/redseen/.test(p)) return { ok: true, clients: b.clients }; return { ok: true }; }");
    // B12
    E("scr = 'clients'; cl = { kind: 'van', brand: null }; ncp.tab = 'vlists'; renderPage()");
    ok(/List prices of the VAN brands/.test(main().textContent) && !/Price lists of the VAN brands/.test(main().textContent), 'B12: the VAN Brands line says List prices');
    ok(E("nTabs.toString().length > 0") && /\['vlists', 'List prices'\]/.test(E('vanTabs.toString()')), 'B12: the tab for a role with no Products place is List prices');
    const g = E('JSON.stringify(GUIDE_JOBS())'); ok(/\*\*VAN Brands\*\*, \*\*List prices\*\*/.test(g) && !/\*\*VAN Brands\*\*, \*\*Price lists\*\*/.test(g), 'B12: the Guide says Clients, VAN Brands, List prices');
    ok(E("NAV.pricelists || NAV.lists") && /Price list/.test(E("NAV.lists || ''")), 'B12: the top bar keeps Price lists');
    const md = fs.readFileSync(path.join(__dirname, '..', 'docs', '07-guide.md'), 'utf8'); ok(!/\*\*VAN Brands\*\*, \*\*Price lists\*\*/.test(md.split('\n').slice(0, 120).join('\n')), 'B12: docs 07 job table says List prices too');
    // B11
    E("ST.me.actions = ST.me.actions.concat(['actuals.ratecheck']); ST.checks = []; _pi = null");
    E("ST.today = '2026-11-03'"); let j = E('jobs0()').find(x => /rates against the purchase register/.test(x.t));
    ok(j && j.due === '2026-11-05' && j.kind === 'do', 'B11: before the 5th the check is due on the 5th: ' + JSON.stringify(j && { due: j.due, kind: j.kind }));
    E("ST.today = '2026-11-10'"); j = E('jobs0()').find(x => /rates against the purchase register/.test(x.t));
    ok(j && j.kind === 'red' && j.since === '2026-11-05', 'B11: after the 5th it is overdue, counted from the 5th');
    E("scr = 'approvals'; renderPage()"); const rcRow = [...main().querySelectorAll('.jrow')].find(r => /purchase register/.test(r.textContent));
    ok(rcRow && /Overdue \d+ working days?/.test(rcRow.querySelector('.sw').textContent), 'B11: the row says Overdue n working days: ' + (rcRow && rcRow.querySelector('.sw').textContent));
    E("ST.today = '2026-11-03'; renderPage()"); const rc2 = [...main().querySelectorAll('.jrow')].find(r => /purchase register/.test(r.textContent));
    ok(rc2 && /^Due 5 Nov/.test(rc2.querySelector('.sw').textContent), 'B11: before it, Due 5 Nov: ' + (rc2 && rc2.querySelector('.sw').textContent));
    E("ST.today = '2026-11-20'");
    // B7
    E("scr = 'approvals'; LFQ.jobs = ''; renderPage()"); const nJ = E('jobs().length');
    ok(nJ > 12 ? !!main().querySelector('[data-lf="jobs"]') : !main().querySelector('[data-lf="jobs"]'), 'B7: the Find box only above 12 rows (' + nJ + ' rows)');
    // B10
    E("window.__red = (() => { const keep = { per: nm.per, hist: nm.hist, grp: nm.grp }; Object.assign(nm, { per: 'fy', hist: 'approved', grp: 'wl' }); try { return nmGroup(nmRows().filter(r => nmIn(r) && nmGrp(r)), r => r.cust).filter(x => x.s.st === 'red').map(x => x.k); } finally { Object.assign(nm, keep); } })()");
    const red = E('window.__red'); ok(red.length > 0, 'the invented data has red clients: ' + red.length);
    E('ST.redSeen = null'); let rj = E('jobs0()').find(x => /newly red on margin/.test(x.t)); ok(rj && new RegExp('^' + red.length + ' white label clients? newly red').test(rj.t), 'B10: never marked: all red ones are new: ' + (rj && rj.t));
    E('ST.redSeen = window.__red.slice()'); ok(!E('jobs0()').some(x => /red on margin/.test(x.t)), 'B10: all seen: no job');
    E('ST.redSeen = window.__red.slice(1)'); rj = E('jobs0()').find(x => /newly red on margin/.test(x.t)); ok(rj && /^1 white label client newly red/.test(rj.t) && rj.t.includes(red[0]) && (red.length === 1 || new RegExp(red.length + ' red in all').test(rj.d)), 'B10: 1 new: the job names it and counts all: ' + (rj && rj.t + ' / ' + rj.d));
    calls.length = 0; rj.go(); await tick(); ok(calls.some(([p, b]) => p === '/api/c2m/redseen' && b.clients.length === red.length), 'B10: Open margin marks every red client as seen');
    ok(E('scr') === 'margin' && E('nm.f') === 'red', 'and opens Margin on the red clients');
    ok(E("jobTopic({ t: '1 white label client newly red on margin, FY to date: X' })") === 'Margin', 'review M2: the job sits under the Margin chip');
    E("ST.redSeen = window.__red.concat(['Zz Client no longer red']); redPrune = false"); calls.length = 0; E('jobs0()'); await tick();
    ok(calls.some(([p, b]) => p === '/api/c2m/redseen' && !b.clients.includes('Zz Client no longer red') && b.clients.length === red.length), 'review M1: a client no longer red leaves the seen list, so turning red again is news');
    calls.length = 0; E('jobs0()'); await tick(); ok(!calls.length, 'and nothing is saved again when the list is already right');
    // B14
    E("ST.recipes = [{ id: 501, brand: 'Alpha', customer: 'BKK', state: 'review', version: 1, steps: [{ action: 'sent', at: '2026-11-02 10:00:00', by_user: 'majid' }] }]; ST.remindedToday = []; scr = 'approvals'; jtab = 'stuck'; LFQ.jobs = ''; renderPage()");
    const rb = main().querySelector('[data-remind="501"]'); ok(rb && /Remind the QC Head about/.test(rb.getAttribute('aria-label')) && !rb.dataset.confirm, 'B14: a stuck recipe has Remind, named for its holder: ' + (rb && rb.getAttribute('aria-label')));
    calls.length = 0; click(rb); await tick(); await tick();
    ok(calls.some(([p]) => p === '/api/c2m/recipes/501/remind') && E('ST.remindedToday').includes(501), 'B14: Remind calls the server once');
    ok(!main().querySelector('[data-remind="501"]') && /Reminded today/.test(main().textContent), 'B14: then the row says Reminded today');
    E("ST.me.admin = false; ST.me.role = 'cfo'; renderPage()"); ok(!main().querySelector('[data-remind]'), 'B14: only the COO sees Remind');
  } catch (e) { fail++; console.log('ERROR', e && e.stack); }
  console.log(`page-195: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
}, 300);
