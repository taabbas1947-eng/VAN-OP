// A new price shows its effect on the client page; Names to settle with nothing waiting lives in Setup (D-193, 25 Nov 2026). Page checks in jsdom.
// Run: node apps/c2m/tests/page-193.test.js
const fs = require('fs'); const { JSDOM, html: PAGE, fixture: FIXTURE } = require('./_page.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
const dom = new JSDOM(fs.readFileSync(PAGE, 'utf8'), { runScripts: 'dangerously', url: 'https://x.test/c2m', beforeParse(w) { w.localStorage.setItem('van_token', 't'); w.fetch = () => new Promise(() => {}); w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} }); w.scrollTo = () => {}; } });
const w = dom.window; const E = s => w.eval(s); const doc = w.document;
const main = () => doc.querySelector('main') || doc.getElementById('app');
setTimeout(() => {
  try {
    w.eval(fs.readFileSync(FIXTURE, 'utf8'));
    /* the CFO: proposes prices; sees margin */
    E("ST = window.__STF; ST.me.role = 'cfo'; ST.me.admin = false; ST.me.actions = ST.me.actions.filter(a => a !== 'price.approve').concat(['price.propose', 'lists.link']); ST.me.nav = ['approvals', 'clients', 'margin', 'costs', 'pricelists', 'products', 'reports']; ST.me.more = ['setup', 'guide']; _pi = null");
    ok(E("CAN('price.propose') && !CAN('price.approve')"), 'the invented person proposes prices and does not approve them');
    E("scr = 'clients'; cl = { kind: 'wl', brand: null }; ncp.tab = 'wl'; ncp.np = {}; renderPage()");
    const cl = E('ncp.cl'); const R = E(`ncpRows(${JSON.stringify(cl)}).filter(r => r.c != null && r.pr > 0 && !r.wait && r.t > 0)`); ok(R.length > 0, 'a costed, priced pack on the client: ' + cl);
    const heads = [...main().querySelectorAll('table thead th')].map(t => t.textContent.trim()); ok(heads.includes('New price, Rs') && heads.includes('After the change'), 'the columns of the picture: ' + heads.join(' | '));
    const r = R[0], up = Math.ceil(r.tp + 10), dn = Math.floor(r.c * 1.02);
    // a price above target: new GP and its rise in points
    E(`ncp.np[${r.k.id}] = '${up}'; renderPage()`);
    let cell = main().querySelector(`#ncp-${r.k.id}`).closest('tr').querySelector('td.wlaft');
    const ngp = (up - r.c) / up * 100, d = ngp - r.gp;
    ok(cell.querySelector('b').textContent === ngp.toFixed(1) + '%', 'the new GP %: ' + cell.textContent);
    ok(new RegExp('^\\+' + Math.abs(d).toFixed(1).replace('.', '\\.') + ' points?$').test(cell.querySelector('.pill').textContent) && cell.querySelector('.pill.p-green'), 'its change in points, green when it rises: ' + cell.textContent);
    ok(!/reason needed/.test(cell.textContent), 'no reason asked on target');
    // a price below target: reason needed, the same rule as the send bar
    E(`ncp.np[${r.k.id}] = '${dn}'; renderPage()`);
    cell = main().querySelector(`#ncp-${r.k.id}`).closest('tr').querySelector('td.wlaft');
    ok(/below target: reason needed/.test(cell.textContent) && cell.querySelector('.pill.p-amber'), 'below target: reason needed: ' + cell.textContent);
    ok(main().querySelector('#ncpb'), 'and the send bar asks why below target');
    ok(!main().querySelector('table.cards.short') || cell.classList.contains('k'), 'on a phone the folded row keeps the cell with the effect');
    ok(/−\d/.test(cell.textContent), 'a fall shows with a minus: ' + cell.textContent);
    // within 0.05 points of the target: no reason (C3)
    E(`ncp.np[${r.k.id}] = String(${r.tp}); renderPage()`);
    cell = main().querySelector(`#ncp-${r.k.id}`).closest('tr').querySelector('td.wlaft'); ok(!/reason needed/.test(cell.textContent) === !E(`belowT((${r.tp} - ${r.c}) / ${r.tp} * 100, ${r.t})`), 'the pill follows belowT exactly');
    // empty box: nothing shown
    E(`ncp.np = {}; renderPage()`); ok(main().querySelector(`#ncp-${r.k.id}`).closest('tr').querySelector('td.wlaft').textContent.trim() === '', 'nothing typed, nothing shown');
    // the helper on its own
    ok(/first price/.test(E("ngpAfter({ ngp: 30, gp: null, pr: 0, np: 100, c: 70, t: 25 })")), 'a pack with no price yet says first price');
    ok(/no change/.test(E("ngpAfter({ ngp: 30.02, gp: 30, pr: 100, np: 101, c: 70, t: 25 })")), 'under 0.05 points says no change');
    ok(/\+1\.0 point</.test(E("ngpAfter({ ngp: 31, gp: 30, pr: 100, np: 102, c: 70, t: 25 })")), '1 point, not 1 points');
    ok(/\+0\.0|no change/.test(E("ngpAfter({ ngp: 30.14, gp: 30.06, pr: 100, np: 101, c: 70, t: 25 })")), 'review m5: 2 GPs that show the same say no change');
    ok(E("ngpAfter({ ngp: 10, gp: 10, pr: 100, np: 100, c: 90, t: 25 })") === '', 'review M1: the price in force typed again shows nothing, as the send bar counts nothing');
    ok(E("ngpAfter({ ngp: 10, gp: 12, pr: 100, np: 98, c: 88, t: 25, wait: { price: 99 } })") === '', 'review M1: a row waiting for the COO shows nothing');
    ok(/class="t-bad"/.test(E("ngpAfter({ ngp: -5, gp: 2, pr: 100, np: 95, c: 100, t: null })")), 'review m4: below cost with no target is red');
    // B8: Names to settle
    E("ST.unmatched = [{ grp: 'VAN brand', brand: 'Zz Odd Name', pack: 25, kg: 0, rs: 0 }]; ST.vanOff = []; _pi = null");
    ok(E('pnRows().o2s.length') === 1, 'an O2S name with no sale waiting');
    ok(!E('jobs0()').some(j => /^Names to settle/.test(j.t)), 'B8: it is not on the Approvals list');
    E("scr = 'setup'; nsu = 'clients'; renderPage()");
    const tab = main().querySelector('[data-nsu="van"]'); ok(tab && tab.querySelector('.tc') && tab.querySelector('.tc').textContent === '1' && /1 O2S name to settle/.test(tab.querySelector('.tc').getAttribute('aria-label')) && tab.closest('[role=tablist]').getAttribute('aria-label') === 'Setup', 'its count is on the tab Products and variants: ' + (tab && tab.textContent));
    E("nsu = 'van'; renderPage()"); ok(/O2S names to settle: 1/.test(main().textContent) && /Zz Odd Name/.test(main().textContent), 'and Setup, Products and variants lists it');
    E("ST.unmatched = [{ grp: 'VAN brand', brand: 'Zz Odd Name', pack: 25, kg: 200, rs: 40000 }]; _pi = null");
    ok(E('jobs0()').some(j => /^Names to settle: 1 O2S name/.test(j.t) && /no cost until/.test(j.d)), 'a name with sales waiting stays on the list');
    E("ST.unmatched = [{ grp: 'VAN brand', brand: 'Zz Odd Name', pack: 25, kg: 0, rs: 0 }]; ST.open = [{ grp: 'VAN brand', brand: 'Zz Odd Name', pack: 25, kg: 500 }]; _pi = null");
    ok(E('jobs0()').some(j => /^Names to settle: 1 O2S name/.test(j.t) && /Open O2S orders/.test(j.d)), 'review m7: a name with open orders and no truck yet stays on the list');
  } catch (e) { fail++; console.log('ERROR', e && e.stack); }
  console.log(`page-193: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
}, 300);
