// 1 Products place with a switch, All | VAN Brands | White label (D-190, 24 Nov 2026). Page checks in jsdom.
// Run: node apps/c2m/tests/page-prod.test.js
const fs = require('fs'); const { JSDOM, html: PAGE, fixture: FIXTURE } = require('./_page.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
const dom = new JSDOM(fs.readFileSync(PAGE, 'utf8'), { runScripts: 'dangerously', url: 'https://x.test/c2m', beforeParse(w) { w.localStorage.setItem('van_token', 't'); w.fetch = () => new Promise(() => {}); w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} }); w.scrollTo = () => {}; } });
const w = dom.window; const E = s => w.eval(s); const doc = w.document;
const main = () => doc.querySelector('main') || doc.getElementById('app');
const click = el => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
setTimeout(() => {
  try {
    w.eval(fs.readFileSync(FIXTURE, 'utf8'));
    E("ST = window.__STF; ST.me.nav = ['approvals', 'clients', 'margin', 'costs', 'pricelists', 'products', 'reports']; ST.me.more = ['setup', 'guide']; ST.products.filter(p => p.customer === ST.products[0].customer).forEach(p => { p.channel = 'VAN brand'; p.grp = 'VAN brand'; p.customer = 'VAN brand'; }); _pi = null");
    const nV = E("ST.products.filter(p => p.channel === 'VAN brand').length"), nA = E('ST.products.length');
    ok(nV > 0 && nA > nV, 'the invented data has both kinds: ' + nV + ' of ' + nA);
    E("scr = 'products'; openProd = null; prodKind = 'all'; renderPage()");
    let sw = [...main().querySelectorAll('.psw [data-pkind]')];
    ok(sw.map(b => b.dataset.pkind).join() === 'all,van,wl' && sw[0].getAttribute('aria-selected') === 'true', 'the switch has All, VAN Brands, White label, and opens on All');
    ok(sw.map(b => parseInt(b.querySelector('small').textContent, 10)).join() === [nA, nV, nA - nV].join(), 'each side says its count: ' + sw.map(b => b.textContent).join(' | '));
    ok(main().querySelector('.ptools') && main().querySelector('.cr'), 'All is the list by client');
    // VAN Brands: the pack table that was under Clients
    click(sw[1]);
    ok(E('prodKind') === 'van' && E('scr') === 'products', 'pressing VAN Brands stays in Products');
    ok(main().querySelector('.vpbs') && main().querySelector('table.vpt') && main().querySelector('h1').textContent.trim() === 'Products', 'VAN Brands shows the 4 boxes and the pack table under the heading Products');
    ok(main().querySelector('.psw [data-pkind="van"]').getAttribute('aria-selected') === 'true' && !main().querySelector('[data-ncp-tab="vprod"]'), 'the switch is drawn there, not the old 2 tabs');
    const row = main().querySelector('table.vpt tr.go[data-openprod]'); ok(!!row, 'a pack row opens its product');
    // White label: the list by client, without our own products
    click(main().querySelector('.psw [data-pkind="wl"]'));
    ok(E('prodKind') === 'wl' && !/VAN brand/.test([...main().querySelectorAll('.crh b')].map(b => b.textContent).join('|')), 'White label leaves the VAN brand group out: ' + [...main().querySelectorAll('.crh b')].map(b => b.textContent).join('|'));
    ok(new RegExp('of ' + (nA - nV) + ' products shown').test(main().textContent), 'and counts only its own products');
    // Clients, VAN Brands: price lists only, with a link to the products
    E("scr = 'clients'; cl = { kind: 'van', brand: null, last: 'van' }; ncp.tab = 'vprod'; renderPage()");
    ok(E('ncp.tab') === 'vlists' && !main().querySelector('[data-ncp-tab="vprod"]') && !main().querySelector('.vpbs'), 'Clients, VAN Brands no longer has a Products tab');
    const lk = main().querySelector('.vpl [data-pkind="van"]'); ok(!!lk, 'it links to Products, VAN Brands');
    click(lk); ok(E('scr') === 'products' && E('prodKind') === 'van' && main().querySelector('.vpbs'), 'the link opens Products on VAN Brands');
    // Find anything and the Guide
    ok(E("GOTO.vprod.t('')") === 'Products › VAN Brands', 'Find anything names the new place: ' + E("GOTO.vprod.t('')"));
    E("scr = 'approvals'; GOTO.vtab.go('vprod')"); ok(E('scr') === 'products' && E('prodKind') === 'van', 'an old address of the tab opens the new place');
    E("scr = 'approvals'; GOTO.vtab.go('vlists')"); ok(E('scr') === 'clients' && E('ncp.tab') === 'vlists', 'Price lists still opens under Clients');
    // review of push 3: a form asked for on VAN Brands draws; typing is not carried across; the address keeps the side
    E("scr = 'products'; openProd = null; prodKind = 'van'; newRec = { cp: null, kind: 'default' }; renderPage()"); ok(E('prodKind') === 'all' && !main().querySelector('.vpbs') && main().querySelector('.ptools'), 'a new recipe asked for on VAN Brands opens the list by client, where its form is'); E('newRec = null');
    E("prodKind = 'all'; prodQ = 'zzz'; renderPage()"); click(main().querySelector('.psw [data-pkind="wl"]')); ok(E('prodQ') === '' && main().querySelector('.cr'), 'what was typed in Find is not carried to the other side');
    E("prodKind = 'van'"); ok(E('navHash(navSnap())') === '#vprod:', 'the address of Products on VAN Brands: ' + E('navHash(navSnap())')); E("prodKind = 'all'"); ok(E('navHash(navSnap())') === '#scr:products', 'and of All');
    // Back keeps the side
    E("scr = 'products'; openProd = null; prodKind = 'wl'"); const a = E('JSON.stringify(navBase(navSnap()))'); E("prodKind = 'van'"); ok(a !== E('JSON.stringify(navBase(navSnap()))'), 'each side of the switch is its own step for Back');
    // a role without the Products place keeps the tab under Clients
    E("ST.me.nav = ['approvals', 'clients', 'margin', 'costs']; ST.me.more = []; scr = 'clients'; cl = { kind: 'van', brand: null, last: 'van' }; ncp.tab = 'vprod'; renderPage()");
    ok(main().querySelector('[data-ncp-tab="vprod"]') && main().querySelector('.vpbs') && main().querySelector('h1').textContent.trim() === 'VAN Brands', 'with no Products place the tab under Clients stays');
    ok(E("GOTO.vprod.t('')") === 'Clients › VAN Brands › Products', 'and Find anything names it there');
    // a role that sees no cost keeps the list by client on VAN Brands
    E("ST.me.nav = ['today', 'products', 'recipes', 'guide']; ST.me.admin = false; ST.me.actions = ST.me.actions.filter(k => k !== 'see.cost'); _pi = null; scr = 'products'; openProd = null; prodKind = 'van'");
    if (!E("CAN('see.cost')")) { E('renderPage()'); ok(!main().querySelector('.vpbs') && main().querySelector('.ptools'), 'no cost right: VAN Brands is the list by client, no cost table'); } else ok(true, 'skipped: this fixture person keeps see.cost');
  } catch (e) { fail++; console.log('ERROR', e && e.stack); }
  console.log(`page-prod: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
}, 300);
