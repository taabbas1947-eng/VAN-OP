// Push 10d page checks in jsdom. Run: node apps/c2m/tests/page-10d.test.js (or give a page file as the first argument)
const fs = require('fs'); const { JSDOM, html: PAGE, fixture: FIXTURE } = require('./_page.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
const html = fs.readFileSync(process.argv[2] || PAGE, 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.test/c2m', beforeParse(w) { w.localStorage.setItem('van_token', 't'); w.fetch = () => new Promise(() => {}); w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} }); } });
const w = dom.window; const E = s => w.eval(s); const doc = w.document;
setTimeout(() => {
  try {
    const wl = ['Arysta Life Science Pvt Ltd (UPL)', 'BKK', 'FMC Pakistan', 'Kissan Fertlizers', 'LCI', 'Maxim Agri', 'Rudolf Life Sciences', 'Syngenta Pakistan', 'UDPL'];
    w.__ST = { today: '2026-11-20', me: { role: 'coo', admin: true, label: 'COO', actions: ['see.cost', 'see.margin', 'see.products', 'see.price', 'price.approve', 'pricedoc.all', 'grants.give'], nav: ['approvals', 'clients', 'margin', 'costs', 'pricelists'], more: [], user: 'tahir', name: 'Tahir' },
      settings: [{ k: 'reapprove_pct', v: '5' }], golive: { on: true, until: '2026-11-30' }, products: [], customers: [], recipes: [], pending: [], reapprovals: [], proposals: [], listRevisions: [], settingRequests: [], targetRequests: [], checks: [], actuals: [], imports: [], notices: [], sales: [], open: [], listItems: [], rates: [], materials: [], packingItems: [], packingBills: [], rules: [], freight: [],
      wlLists: Object.fromEntries(wl.map(c => [c, { rows: [] }])),
      people: [{ username: 'ali', name: 'Muhammad Ali', role: 'kam', roleLabel: 'KAM', grantee: true }, { username: 'irfan', name: 'Muhammad Irfan', role: 'kam', roleLabel: 'KAM', grantee: true }, { username: 'saad', name: 'Saad Jamal', role: 'kam', roleLabel: 'KAM', grantee: true }, { username: 'zed', name: 'Zed Khan', role: 'kam', roleLabel: 'KAM', grantee: true }, { username: 'yawar', name: 'Yawar', role: 'cfo', roleLabel: 'CFO', grantee: false }],
      grants: [['ali', 'list', 'dist'], ['ali', 'list', 'farmer_pb'], ['ali', 'client', 'BKK'], ['ali', 'client', 'Kissan Fertlizers'], ['irfan', 'list', 'dealer'], ['irfan', 'list', 'farmer_sn'], ['irfan', 'list', 'farmer_snc'], ['saad', 'list', 'dist'], ['saad', 'list', 'farmer_pb']].map(([username, grant_kind, grant_value]) => ({ username, grant_kind, grant_value })) };
    E('ST = window.__ST; scr = "pricelists"; plTab = "lists"; PLX = [{ id: 1, ref: "VAN/PL/2026/001", audience: "dist", client: null, effective: "2026-10-11", till: "2026-10-20" }]');
    const V = () => { const d = doc.createElement('div'); d.innerHTML = E('vPriceLists()'); return d; };
    let d = V(); const t = d.textContent.replace(/\s+/g, ' ');
    ok(/16 lists\. Only 1 has ever been issued, and it ended on 20 Oct 2026\./.test(t), 'answer line: ' + (t.match(/Price lists(.{0,100})/) || [])[1]);
    ok(d.querySelector('.phr [data-plmake]') && /Make a list/.test(d.querySelector('.phr').textContent), 'Make a list beside Help');
    const tabs = [...d.querySelectorAll('[data-pltab]')]; ok(tabs.length === 2 && tabs[0].getAttribute('aria-selected') === 'true' && /Who can see them\s*4 people/.test(tabs[1].textContent), 'tabs: ' + tabs.map(x => x.textContent).join('|'));
    const cards = [...d.querySelectorAll('.pli')]; ok(cards.length === 1 && cards[0].classList.contains('s-end'), 'issued card ended');
    ok(/Ended 20 Oct 2026, not replaced/.test(cards[0].textContent) && cards[0].querySelector('[data-plget="1"]') && cards[0].querySelector('[data-plnew="dist"]') && /Issue a new PDF/.test(cards[0].textContent) && /VAN\/PL\/2026\/001/.test(cards[0].textContent), 'issued card: ' + cards[0].textContent.replace(/\s+/g, ' '));
    const ni = [...d.querySelectorAll('table.plni tr')]; ok(ni.length === 15 && ni.every(r => r.querySelector('[data-plnew]') && /Make the first one/.test(r.textContent)), 'never issued 15 rows');
    ok(ni.filter(r => r.querySelector('[data-plclient]')).length === 9 && ni.filter(r => /VAN brand/.test(r.textContent)).length === 6, 'never issued kinds');
    ok(/Never issued\s*15/.test(t) && /Issued\s*1/.test(t), 'section counts');
    ok(d.querySelector('.plpub a[href="/c2m/prices"]') && /Public price page/.test(d.querySelector('.plpub').textContent), 'public page 1 line');
    ok(!/Download latest PDF|Make a new one|Who can see the lists/.test(d.innerHTML), 'old wording gone');
    // more issued: in force and later
    E('PLX = [{ id: 1, ref: "VAN/PL/2026/001", audience: "dist", client: null, effective: "2026-10-11", till: "2026-10-20" }, { id: 2, ref: "VAN/PL/2026/002", audience: "dealer", client: null, effective: "2026-11-01", till: "2026-12-31" }, { id: 3, ref: "VAN/PL/2026/003", audience: "wl", client: "BKK", effective: "2026-11-24", till: null }]');
    d = V(); ok(/16 lists\. 3 issued \(1 ended and not replaced\), 13 never issued\./.test(d.textContent), 'answer with 3: ' + (d.textContent.match(/16 lists[^?]*/) || [])[0]);
    const c2 = [...d.querySelectorAll('.pli')].map(c => c.className.split(' ')[1] + ':' + c.querySelector('.pill').textContent); ok(c2.join('|') === 's-end:Ended 20 Oct 2026, not replaced|s-on:In force till 31 Dec 2026|s-later:Starts 24 Nov 2026', 'states: ' + c2.join('|'));
    E('PLX = []'); d = V(); ok(/16 lists\. None has been issued yet\./.test(d.textContent), 'none issued');
    E("PLX = 'loading'"); d = V(); ok(/Looking for the issued lists/.test(d.textContent) && !d.querySelector('.plni'), 'loading');
    E('PLX = [{ id: 1, ref: "VAN/PL/2026/001", audience: "dist", client: null, effective: "2026-10-11", till: "2026-10-20" }]');
    // Who can see them
    E('plTab = "acc"'); d = V(); const tb = d.querySelector('table.placc'); ok(tb && tb.dataset.nosort != null, 'access table');
    const ths = [...tb.querySelectorAll('thead th')].map(x => x.textContent); ok(ths.join('|') === 'Person|Distributor|Dealer, Sindh|Farmer, Punjab|Farmer, Sindh|Farmer, Sindh credit|Website|White label clients|', 'headers: ' + ths.join('|'));
    const rows = [...tb.querySelectorAll('tbody tr')]; ok(rows.length === 4, '4 people rows');
    const ir = rows.find(r => /Muhammad Irfan/.test(r.textContent)); const irD = ir.cells[1]; ok(irD.classList.contains('gap') && /missing/.test(irD.textContent) && !irD.querySelector('input').checked, 'Irfan distributor missing');
    ok(ir.querySelectorAll('td.gap').length === 1 && ir.cells[2].querySelector('input').checked, 'only 1 gap for Irfan');
    ok(rows.every(r => r.querySelectorAll('input[data-grant]').length === 6), 'tick boxes');
    ok(rows.find(r => /Muhammad Ali/.test(r.textContent)).cells[7].textContent.includes('BKK, Kissan Fertlizers'), 'clients listed');
    ok(/sees nothing/.test(rows.find(r => /Zed Khan/.test(r.textContent)).textContent) && !/sees nothing/.test(ir.textContent), 'sees nothing pill');
    const wb = d.querySelector('.plnote').textContent.replace(/\s+/g, ' ');
    ok(!d.querySelector('.warnbox') && /gives Muhammad Irfan this list, not ticked yet: Distributor\./.test(wb) && /7 more people named that day \(Shahid Saleem, Muhammad Mamoon, Umer Shehzad, Abkar Ali, Bilal Khan, Fahim Asghar, Muhammad Ismail\) are not in C2M yet/.test(wb), 'notes: ' + wb);
    ok(/missing: the 11 Nov 2026 ruling gives it/.test(irD.querySelector('input').getAttribute('aria-label')) && irD.querySelector('input').id === 'g-irfan-dist', 'missing in the label, id for focus');
    const aliWeb = rows.find(r => /Muhammad Ali/.test(r.textContent)).cells[6]; ok(/with Farmer, Punjab/.test(aliWeb.textContent) && !/with Farmer/.test(ir.cells[6].textContent), 'Website seen through Farmer, Punjab');
    ok([...tb.querySelectorAll('thead th')].every(h => h.dataset.key), 'every column a key cell on the phone');
    ok(rows.every(r => r.querySelector('[data-kam-preview]') && /See what they see/.test(r.textContent) && /See what .+ sees/.test(r.querySelector('[data-kam-preview]').getAttribute('aria-label'))), 'see what they see');
    ok(!d.querySelector('.kam'), 'no split pane');
    // Change opens clients under the row
    E('KM.sel = "irfan"; KM.open = true'); d = V(); const r2 = [...d.querySelectorAll('table.placc tbody tr')]; const at = r2.findIndex(r => /Muhammad Irfan/.test(r.textContent));
    ok(r2[at + 1] && r2[at + 1].cells[0].colSpan === 9 && r2[at + 1].querySelectorAll('[data-kam-client]').length === 9 && r2[at + 1].querySelector('[data-kam-all="1"]'), 'clients open under the row');
    ok(r2[at].querySelector('[data-kam-open]').getAttribute('aria-expanded') === 'true' && /Close/.test(r2[at].querySelector('[data-kam-open]').textContent), 'Close on the open row');
    E('KM.open = false');
    // read only
    E("ST.me.actions = ST.me.actions.filter(a => a !== 'grants.give' && a !== 'pricedoc.all')"); d = V(); ok(!d.querySelector('input[data-grant]') && /✓/.test(d.querySelector('table.placc').textContent) && d.querySelector('[aria-label="Yes"]') && !d.querySelector('[data-kam-open]') && !d.querySelector('[data-kam-preview]') && /You can look but not change/.test(d.textContent), 'read only');
    E('plTab = "lists"'); d = V(); ok(!d.querySelector('[data-plmake]') && !d.querySelector('[data-plnew]') && d.querySelector('[data-plget]'), 'no make without pricedoc.all');
    E("ST.me.actions.push('grants.give', 'pricedoc.all')");
    // clicks in the page
    E('renderPage()'); ok(doc.querySelector('main .pli'), 'page renders Lists');
    doc.querySelector('main [data-pltab="acc"]').click(); ok(doc.querySelector('main table.placc'), 'tab click shows the table');
    doc.querySelector('main [data-kam-open="ali"]').click(); ok(doc.querySelectorAll('main [data-kam-client]').length === 9 && E('KM.sel') === 'ali', 'Change click opens Ali');
    doc.querySelector('main [data-kam-open="ali"]').click(); ok(!doc.querySelector('main [data-kam-client]'), 'second click closes');
    doc.querySelector('main [data-pltab="lists"]').click(); ok(doc.querySelector('main .pli') && E('plTab') === 'lists', 'back to Lists');
    // a named person with another role, and a person in the ruling counted only when not in C2M at all
    E("ST.people.push({ username: 'bk', name: 'Bilal  khan', role: 'qc', roleLabel: 'QC Head', grantee: false })"); E('plTab = "acc"'); d = V(); const wb2 = d.querySelector('.plnote').textContent.replace(/\s+/g, ' ');
    ok(/holding another C2M role: Bilal khan \(QC Head\)/.test(wb2) && /6 more people named that day/.test(wb2) && !/Bilal Khan,/.test(wb2), 'other role: ' + wb2); E('ST.people.pop(); plTab = "lists"; renderPage()');
    // Make a list opens the builder at once (review 10d, B1)
    doc.querySelector('main [data-plmake]').click(); ok(E('scr') !== 'pricelists' && !doc.querySelector('main .pli'), 'Make a list leaves Price lists: ' + E('scr') + ' ' + E('sub'));
    E('scr = "pricelists"; renderPage()');
    // the How-to and Find go to Who can see them
    E("finderGo('placc:'); renderPage()"); ok(E('scr') === 'pricelists' && E('plTab') === 'acc' && doc.querySelector('main table.placc'), 'placc: opens Who can see them');
    // Setup, KAM lists uses the same table
    ok(/placc/.test(E('boAccess()')), 'Setup KAM lists same table');
    ok(E("CHANGELOG.some(c => c.ver === '2026-11-20d')"), 'change list 2026-11-20d');
  } catch (e) { fail++; console.log('ERROR', e && e.stack); }
  console.log(`page-10d: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
}, 300);
