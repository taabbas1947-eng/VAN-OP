// Push 10e page checks in jsdom. Run: node apps/c2m/tests/page-10e.test.js (or give a page file as the first argument)
const fs = require('fs'); const { JSDOM, html: PAGE, fixture: FIXTURE } = require('./_page.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
const html = fs.readFileSync(process.argv[2] || PAGE, 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.test/c2m', beforeParse(w) { w.localStorage.setItem('van_token', 't'); w.fetch = () => new Promise(() => {}); w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} }); } });
const w = dom.window; const E = s => w.eval(s); const doc = w.document;
const tick = () => new Promise(r => setTimeout(r, 30));
setTimeout(async () => {
  try {
    const pk = (id, size, cost, ap, price) => ({ id, size, cost: cost == null ? null : { total: cost, materials: cost, packing: 0, conversion: 0, freight: 0 }, approvedCost: ap, costGaps: [], price });
    w.__ST = { today: '2026-11-20', me: { role: 'coo', admin: true, label: 'COO', actions: ['see.cost', 'see.margin', 'see.products', 'see.price', 'price.approve', 'pricedoc.all', 'grants.give', 'see.settings', 'settings.edit', 'reapproval.decide'], nav: ['approvals', 'clients', 'margin', 'costs', 'pricelists'], more: ['setup'], user: 'tahir', name: 'Tahir' },
      settings: [{ k: 'reapprove_pct', v: '5' }, { k: 'budget_gp', v: '' }, { k: 'red_gap_pts', v: ' ' }], golive: { on: true, until: '2026-11-30' }, fedPct: 0,
      products: [{ id: 1, brand: 'Alpha', customer: 'BKK', grp: 'White label', channel: 'White label', soldPer: 'kg', packs: [pk(11, 25, 100, 100, 0)], target: null, recipeState: 'approved', approvedVersionId: 1, active: true }],
      customers: [], recipes: [], pending: [], reapprovals: [], proposals: [{ id: 5, packId: 11, price: 0, status: 'proposed', from: '2026-11-23' }], listRevisions: [], settingRequests: [], targetRequests: [], checks: [], actuals: [], imports: [], notices: [], sales: [{ date: '2026-11-02', target: null, kg: 1, price: 1 }], open: [], listItems: [], rates: [], materials: [], packingItems: [], packingBills: [], rules: [], freight: [], people: [], grants: [], wlLists: {},
      holidays: [{ day: '2026-11-18', name: 'Test holiday' }], holidaysReady: true };
    E('ST = window.__ST; _pi = null');
    // C-12 formats
    ok(E("rs(-0.4)") === 'Rs 0' && E("rs(-2.5)") === 'Rs -3' && E("rs(2.5)") === 'Rs 3' && E("rs(Infinity)") === '–', 'C-12 rs: ' + E("[rs(-0.4), rs(-2.5), rs(2.5)].join('|')"));
    ok(E("pc(-0.04)") === '0.0%' && E("pc(-0.06)") === '-0.1%' && E("n0(-0.4)") === '0' && E("rsM2(undefined)") === '–' && E("rsM2(NaN)") === '–' && E("rsM2(-1500000)") === 'Rs -1.50M' && E("p1(-0.01)") === '0.0', 'C-12 pc, n0, rsM2, p1');
    // C-13 settings
    ok(E("SET('budget_gp')") === null && E("SET('red_gap_pts')") === null && E("SET('reapprove_pct')") === 5 && E("FEDP()") === 0, 'C-13 blank setting null, FED 0 stays 0');
    E("delete ST.fedPct"); ok(E("FEDP()") === 5, 'C-13 FED missing is 5'); E("ST.fedPct = 0");
    // C-14
    ok(E("lfFree()") === true && /Until 30 Nov 2026 \(the go-live window's last day\)/.test(E("lfFreeTxt()")), 'C-14 window open');
    E("ST.golive = { on: false, until: '2026-11-10' }"); ok(E("lfFree()") === false && /Only while the go-live window is open/.test(E("lfFreeTxt()")), 'C-14 window closed'); E("ST.golive = { on: true, until: '2026-11-30' }");
    // C-15 and C-26 toast
    E("toast('Bad thing', true)"); const tt = doc.getElementById('toast'); ok(tt.getAttribute('role') === 'alert' && tt.getAttribute('aria-live') === 'assertive', 'C-15 error toast is an alert');
    E("toast('Saved')"); ok(tt.getAttribute('role') === 'status', 'C-15 normal toast is status'); ok(/\.toast\{[^}]*z-index:70\}/.test(html), 'C-15 toast above the boxes');
    // C-26
    ok(E(`esc("a'b")`) === 'a&#39;b', 'C-26 esc quote'); ok(/@media \(min-width:761px\)\{html\{scroll-padding-top:60px\}\}/.test(html), 'C-26 scroll padding');
    // C-11, C-16, C-18, C-37 on Approvals
    E('scr = "approvals"; renderPage()'); const main = doc.querySelector('main');
    ok(!/undefined/.test(main.textContent), 'C-11 no "undefined" on Approvals');
    const jb = [...main.querySelectorAll('[data-job]')]; ok(jb.length && jb.every(b => /^\d+$/.test(b.dataset.job) && b.dataset.jk), 'C-16 C-18 job buttons have an index and a key: ' + jb.map(b => b.dataset.job + ':' + b.dataset.jk).join(' / '));
    ok(/Approve price/.test(main.textContent) && !/Infinity|NaN/.test(main.textContent), 'C-37 a price of 0 gives no Infinity');
    const nb = doc.querySelector('[data-scr="approvals"]'); ok(nb && (!nb.querySelector('.n') || /^Approvals, \d+ waiting$/.test(nb.getAttribute('aria-label') || '')), 'C-26 badge label on the button: ' + (nb && nb.getAttribute('aria-label')));
    // C-18 stale key
    const b0 = jb[0]; b0.dataset.jk = 'gone|x'; b0.click(); await tick(); ok(/has changed since the page was drawn/.test(tt.textContent), 'C-18 a stale job is not opened: ' + tt.textContent);
    // C-11 verdict with no target
    E("ST.sales = [{ date: '2026-11-02', cust: 'BKK', grp: 'White label', cat: 'wl', kg: 10, price: 120, cost: 100, target: null, packId: 11 }]");
    const hg = E("homeGrid(jobs(), nextMove(jobs()), [])"); ok(!/undefined/.test(hg), 'C-11 homeGrid: ' + (hg.match(/class="st [^"]*">[^<]*/) || [])[0]);
    // C-35 working days skip holidays
    ok(E("wdays('2026-11-16')") === 3, 'C-35 16 to 20 Nov less 18 Nov holiday is 3 working days: ' + E("wdays('2026-11-16')"));
    E("ST.holidays = []"); ok(E("wdays('2026-11-16')") === 4, 'C-35 without the holiday 4'); E("ST.holidays = [{ day: '2026-11-18', name: 'Test holiday' }]");
    const hb = doc.createElement('div'); hb.innerHTML = E('holidayBox()'); ok(hb.querySelector('[data-holadd]') && /Test holiday/.test(hb.textContent) && hb.querySelector('[data-holdel="2026-11-18"]'), 'C-35 COO keeps the list');
    E("ST.me.admin = false"); hb.innerHTML = E('holidayBox()'); ok(!hb.querySelector('[data-holadd]') && !hb.querySelector('[data-holdel]') && /The COO keeps this list/.test(hb.textContent), 'C-35 others read it'); E("ST.me.admin = true");
    E("ST.holidaysReady = false"); hb.innerHTML = E('holidayBox()'); ok(/migration 017/.test(hb.textContent), 'C-35 before the migration'); E("ST.holidaysReady = true");
    // C-36
    const rb = E("reappBox({ id: 1, cause: 'x', items: [{ label: 'P', from: 10, to: 12, pct: null }] })"); ok(/\(–\)/.test(rb), 'C-36 no % shows –');
    // C-38 Price lists read once, error said on the page
    E("PLX = 'error'; scr = 'pricelists'; plTab = 'lists'; renderPage()"); ok(/could not be read/.test(doc.querySelector('main').textContent) && doc.querySelector('main [data-plretry]'), 'C-38 error with Try again');
    let calls = 0; E("window.__api = api; api = (p, b) => { window.__calls = (window.__calls || 0) + 1; return Promise.resolve(p.includes('preview') ? { rows: [{ product: 'Z', pack: '1 L', cur: 'Rs 9' }], eff: '2026-12-01' } : { docs: [] }); }");
    doc.querySelector('main [data-plretry]').click(); await tick(); await tick(); ok(Array.isArray(E('PLX')) && E('window.__calls') === 1, 'C-38 Try again reads once: ' + E('window.__calls'));
    E('render()'); E('render()'); await tick(); ok(E('window.__calls') === 1, 'C-38 a redraw does not read again');
    // C-20 a document dated ahead shows the server's rows
    E("PLB.aud = 'dist'; PLB.eff = '2026-12-01'; PLB.effSet = true; PLB.pick = {}; PLPV = { key: null, rows: null, err: null }"); const d1 = doc.createElement('div'); d1.innerHTML = E("plDoc('dist')"); await tick(); await tick();
    const d2 = doc.createElement('div'); d2.innerHTML = E("plDoc('dist')"); ok(/Z/.test(d2.querySelector('.doc-tb tbody').textContent) && E('window.__calls') === 2, 'C-20 preview rows from the server: ' + d2.querySelector('.doc-tb tbody').textContent.slice(0, 60));
    // C-19 an older load does not land after a newer one
    let res = []; E("api = (p) => new Promise(r => window.__res.push(r))"); w.__res = res;
    E("window.__l1 = load(); window.__l2 = load()"); res[1]({ ...w.__ST, me: { ...w.__ST.me }, tag: 'new' }); await tick(); res[0]({ ...w.__ST, me: { ...w.__ST.me }, tag: 'old' }); await tick();
    ok(E('ST.tag') === 'new', 'C-19 the newest load wins: ' + E('ST.tag'));
    // C-31 filled-in targets are marked
    E("ST.settings.find(s => s.k === 'budget_gp').v = '23'"); E("api = () => Promise.resolve(JSON.parse(JSON.stringify(window.__ST2)))"); w.__ST2 = { ...w.__ST, settings: [{ k: 'budget_gp', v: '23' }], sales: [{ date: '2026-11-02', target: null }, { date: '2026-11-03', target: 30 }] };
    await E('load()'); ok(E('ST.sales[0].target') === 23 && E('ST.sales[0].targetDefault') === true && E('ST.sales[0].targetOwn') === null && E('ST.sales[1].targetDefault') === undefined && E('ST.products[0].targetOwn') === null, 'C-31 marked and kept');
    // review 10e B-1: every role loads (the change list is read for non-admins), CFO and KAM
    for (const who of [{ role: 'cfo', admin: false, label: 'CFO', actions: ['see.cost', 'see.margin', 'see.products', 'see.price', 'pricedoc.all', 'rate.save', 'labour.manage'], nav: ['approvals', 'clients', 'margin', 'costs', 'pricelists'], more: [] }, { role: 'viewer', admin: false, label: 'Price lists only', actions: ['see.granted_lists', 'pricedoc.granted'], nav: ['lists'], more: [] }]) {
      w.__ST3 = { ...w.__ST, me: { ...who, user: 'u_' + who.role, name: 'U ' + who.role }, grants: [] }; w.localStorage.removeItem('c2m_wn_u_' + who.role);
      E("api = () => Promise.resolve(JSON.parse(JSON.stringify(window.__ST3)))"); let err = null; try { await E('load()'); } catch (e) { err = e; }
      let e2 = null; try { E("localStorage.setItem(wnKey(), '2026-11-20d'); _wnShown = false; _rpShown = false; wnMine(); checkWhatsNew()"); } catch (e) { e2 = e; } ok(!e2, 'the change list reads for ' + who.role + ': ' + (e2 && e2.message));
      ok(!err && E('ST.me.role') === who.role && doc.querySelector('main') && !/could not load/.test(doc.querySelector('main').textContent), 'loads as ' + who.role + ': ' + (err && err.message) + ' role=' + E('ST.me.role'));
    }
    E('api = window.__api');
    // C-17 each job opens its own packs
    ok(/pan: \{ k: 'tochange', only: 'noprice' \}/.test(html) && /pan: \{ k: 'tochange', only: 'price' \}/.test(html) && /toChangeBody\(P\.only\)/.test(html), 'C-17 2 panels');
    ok(E("CHANGELOG.some(c => c.ver === '2026-11-20e')"), 'change list 2026-11-20e');
  } catch (e) { fail++; console.log('ERROR', e && e.stack); }
  console.log(`page-10e: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
}, 300);
