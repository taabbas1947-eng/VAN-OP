// Push 10f page checks in jsdom. Run: node apps/c2m/tests/page-10f.test.js (or give a page file as the first argument)
const fs = require('fs'); const { JSDOM, html: PAGE, fixture: FIXTURE } = require('./_page.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
const html = fs.readFileSync(process.argv[2] || PAGE, 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.test/c2m', beforeParse(w) { w.localStorage.setItem('van_token', 't'); w.fetch = () => new Promise(() => {}); w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} }); } });
const w = dom.window; const E = s => w.eval(s); const doc = w.document; const tick = () => new Promise(r => setTimeout(r, 20));
setTimeout(async () => {
  try {
    w.eval(fs.readFileSync(FIXTURE, 'utf8'));
    E("ST = window.__STF; ST.people = [{ username: 'ali', name: 'Muhammad Ali', role: 'kam', roleLabel: 'KAM', grantee: true }]; ST.wlLists = { BKK: { rows: [] } }; _pi = null; scr = 'approvals'; renderPage()");
    // C-22: worked out once per draw, again on the next draw
    ok(E('jobs() === jobs()') && E('exposure() === exposure()') && E('toChange() === toChange()') && E('waitingOn() === waitingOn()'), 'C-22 same answer within a draw');
    const j1 = E('jobs()'); E('render()'); ok(E('jobs()') !== j1, 'C-22 a new draw works it out again');
    const x1 = E('exposure()'); E("fbasis = fbasis === 'budget' ? 'run' : 'budget'"); ok(E('exposure()') !== x1, 'C-22 the expected kg basis is part of the key'); E("fbasis = 'budget'");
    const n1 = E('nmRows()'); E("nm.hist = nm.hist === 'approved' ? 'restated' : 'approved'"); ok(E('nmRows()') !== n1, 'C-22 the history basis is part of the key'); E("nm.hist = 'approved'");
    E('window.__ST0 = ST; ST = { ...ST }'); const j2 = E('jobs()'); E('ST = window.__ST0'); ok(E('jobs()') !== j2, 'C-22 a new ST works it out again');
    // the same totals as before: exposure with the index equals the old way for 1 pack
    const ex = E('exposure()'); const k0 = ex[0]; const since = E("addDays(ST.today, -91)"); const shipped = w.__STF.sales.filter(s => s.packId === k0.id && s.date >= since).reduce((a, s) => a + s.kg, 0); const openKg = w.__STF.open.filter(o => o.packId === k0.id).reduce((a, o) => a + o.kg, 0);
    ok(k0.openKg === openKg && k0.kg3 > 0 && ex.length === 240, 'C-22 exposure from the index: open ' + k0.openKg + ' vs ' + openKg + ', shipped ' + shipped);
    // C-09 folds: a fold opened by the person stays open after a redraw; a count in its words does not matter; a date does
    E("scr = 'pricelists'; plTab = 'acc'; PLX = []; render()");
    const d = doc.querySelector('main details.how'); d.querySelector('summary').click(); await tick(); ok(d.open, 'fold opened');
    E('render()'); ok(doc.querySelector('main details.how').open, 'C-09 fold stays open after a redraw');
    E("ST.people.push({ username: 'saad', name: 'Saad', role: 'kam', roleLabel: 'KAM', grantee: true }); render()"); ok(doc.querySelector('main details.how').open, 'C-09 fold stays open when its count changes');
    doc.querySelector('main details.how > summary').click(); await tick(); E('render()'); ok(!doc.querySelector('main details.how').open, 'C-09 fold closed by the person stays closed');
    const k1 = E("(() => { const x = document.createElement('details'); x.innerHTML = '<summary>12 updates by Yawar, 20 Nov 2026</summary>'; return foldKey(x); })()"), k2 = E("(() => { const x = document.createElement('details'); x.innerHTML = '<summary>9 updates by Yawar, 18 Nov 2026</summary>'; return foldKey(x); })()"), k3 = E("(() => { const x = document.createElement('details'); x.innerHTML = '<summary>3 updates by Yawar, 20 Nov 2026</summary>'; return foldKey(x); })()");
    ok(k1 !== k2 && k1 === k3, 'C-09 fold key: date kept, count dropped: ' + k1 + ' / ' + k2);
    // C-09 focus: the button pressed keeps the focus on the same screen
    const tab = doc.querySelector('main [data-pltab="lists"]'); tab.focus(); tab.click(); await tick(); ok(doc.activeElement && doc.activeElement.dataset.pltab === 'lists', 'C-09 focus stays on the tab pressed: ' + (doc.activeElement && doc.activeElement.outerHTML.slice(0, 60)));
    const nb = doc.querySelector('.hdr [data-scr="costs"]'); nb.focus(); E('render()'); ok(doc.activeElement && doc.activeElement.dataset.scr === 'costs', 'C-09 nav focus kept');
    E("scr = 'approvals'"); const nb2 = doc.querySelector('.hdr [data-scr="clients"]'); nb2.focus(); nb2.click(); await tick(); ok(E('scr') === 'clients' && doc.activeElement && doc.activeElement.dataset.scr === 'clients', 'C-09 a nav press keeps focus on the nav button: ' + E('scr'));
    const ch = doc.querySelector('main button[data-clkind], main [role=tab]'); ok(!!ch, 'Clients switch found'); if (ch) { ch.focus(); E('render()'); ok(doc.activeElement === doc.querySelector(`main [data-clkind="${ch.dataset.clkind}"]`) || doc.activeElement.textContent === ch.textContent, 'C-09 a tab inside a screen keeps focus'); }
    // review 10f: menus and row folds are never kept; places and panels have their own keys; ticks keep focus; the same button in row 3 stays row 3
    ok(E("(() => { const x = document.createElement('details'); x.className = 'rowmenu'; x.innerHTML = '<summary>More</summary>'; return foldKey(x); })()") === null && E("(() => { const x = document.createElement('details'); x.className = 'newm'; x.innerHTML = '<summary>+ New</summary>'; return foldKey(x); })()") === null, 'B1, M1 menus not kept');
    ok(E("(() => { const t = document.createElement('table'); t.innerHTML = '<tbody><tr><td><details><summary>Edit</summary></details></td></tr></tbody>'; return foldKey(t.querySelector('details')); })()") === null, 'm1 a fold in a row not kept');
    const v1 = E("(scr = 'inputs', inp = 'materials', viewKey())"), v2 = E("(inp = 'packing', viewKey())"); ok(v1 !== v2, 'M2 a sub-tab is its own place: ' + v1 + ' / ' + v2);
    const p1 = E("(pan = { k: 'tochange', only: 'price' }, panKey())"), p2 = E("(pan = { k: 'tochange', only: 'noprice' }, panKey())"); ok(p1 !== p2, 'M2 each panel its own key'); E('pan = null');
    E("scr = 'pricelists'; plTab = 'acc'; ST.grants = []; render()"); const cb = doc.querySelector('main input[type=checkbox][data-grant]'); ok(!!cb, 'a grant tick found'); if (cb) { const id0 = cb.id; cb.removeAttribute('id'); cb.focus(); const k = E('focusKey(document.activeElement)'); ok(k && k.tag === 'INPUT', 'm2 a tick has a focus key'); }
    const rows = [...doc.querySelectorAll('main [data-kam-preview]')]; ok(rows.length > 1, 'KAM preview rows found: ' + rows.length); if (rows.length > 1) { rows[1].focus(); E('render()'); ok(doc.activeElement && doc.activeElement.getAttribute('data-kam-preview') === rows[1].getAttribute('data-kam-preview'), 'm4 the same row'); }
    ok(E("CHANGELOG.some(c => c.ver === '2026-11-20f')"), 'change list 2026-11-20f');
  } catch (e) { fail++; console.log('ERROR', e && e.stack); }
  console.log(`page-10f: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
}, 300);
