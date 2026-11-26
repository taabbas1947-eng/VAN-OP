// The top bar of 24 Nov 2026 (D-187, part 1): 7 places, Setup as a gear, the Guide beside it, 56 px. Page checks in jsdom.
// Run: node apps/c2m/tests/page-bar.test.js
const fs = require('fs'); const path = require('path'); const { JSDOM, html: PAGE, fixture: FIXTURE } = require('./_page.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
const D = path.join(__dirname, '..'); const css = fs.readFileSync(path.join(D, 'c2m.css'), 'utf8'), js = fs.readFileSync(path.join(D, 'c2m.js'), 'utf8');
const access = require('../c2m-access.js');
const dom = new JSDOM(fs.readFileSync(PAGE, 'utf8'), { runScripts: 'dangerously', url: 'https://x.test/c2m', beforeParse(w) { w.localStorage.setItem('van_token', 't'); w.fetch = () => new Promise(() => {}); w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} }); } });
const w = dom.window; const E = s => w.eval(s); const doc = w.document;
setTimeout(() => {
  try {
    // the server gives the places
    const coo = access.navFor(access.SEED.coo.actions), cfo = access.navFor(access.SEED.cfo.actions);
    ok(coo.nav.join() === 'approvals,clients,margin,costs,pricelists,products,reports' && coo.more.join() === 'setup,guide', 'COO: 7 places on the bar, Setup and Guide beside the name: ' + JSON.stringify(coo));
    ok(cfo.nav.join() === coo.nav.join() && cfo.more.join() === 'setup,guide', 'CFO: the same places');
    ok(access.navFor(access.SEED.production.actions).more.length === 0 && access.navFor(access.SEED.viewer.actions).nav.join() === 'lists,guide', 'the other roles keep their places');
    // the page
    w.eval(fs.readFileSync(FIXTURE, 'utf8')); E("ST = window.__STF; ST.me.nav = ['approvals', 'clients', 'margin', 'costs', 'pricelists', 'products', 'reports']; ST.me.more = ['setup', 'guide']; _pi = null; scr = 'approvals'; renderPage()");
    const nav = [...doc.querySelectorAll('.hdr nav button')];
    ok(nav.map(b => b.textContent.replace(/\d+$/, '').trim()).join() === 'Approvals,Clients,Margin,Costs,Price lists,Products,Reports', 'the bar draws the 7 places in order: ' + nav.map(b => b.textContent.trim()).join());
    ok(nav.filter(b => b.classList.contains('fold')).map(b => b.dataset.scr).join() === 'products,reports' && nav.filter(b => b.classList.contains('fold2')).map(b => b.dataset.scr).join() === 'pricelists', 'Products and Reports fold first, Price lists on a very narrow screen');
    ok(nav.filter(b => !b.classList.contains('far')).map(b => b.dataset.scr).join() === 'approvals,clients,margin,costs', 'the phone bar keeps 4 places');
    const ib = [...doc.querySelectorAll('.hdr .foot .ib')];
    ok(ib.length === 2 && ib[0].dataset.scr === 'setup' && ib[0].getAttribute('aria-label') === 'Setup' && ib[1].dataset.scr === 'guide' && ib[1].getAttribute('aria-label') === 'Guide', 'Setup is a gear and the Guide a button beside the name, each with its name for a screen reader');
    ok(doc.querySelector('.hdr .foot .pp b').textContent === 'Tahir' && doc.querySelector('.hdr .foot .pp .who2').textContent === 'COO', 'the person and the role sit in 1 pill');
    ok(doc.querySelector('.hdr .foot .launch') && doc.querySelector('.hdr .foot [data-signout]'), 'Launcher stays beside Sign out (D-143)');
    ok(!doc.querySelector('.hdr .skins'), 'no look dots');
    E("scr = 'setup'; renderPage()"); ok(doc.querySelector('.hdr .foot .ib[data-scr="setup"]').getAttribute('aria-current') === 'true', 'the gear is marked when Setup is open');
    E("scr = 'products'; renderPage()"); ok(doc.querySelector('.hdr nav button[data-scr="products"]').getAttribute('aria-current') === 'true' && doc.querySelector('.hdr .more').getAttribute('aria-current') === 'true', 'Products is marked on the bar, and on More for when it is folded');
    E("moreOpen = true; renderPage()"); const sh = [...doc.querySelectorAll('.sheet button[data-scr]')];
    ok(sh.map(b => b.className).join('|') === 'far fold2|far fold|far fold||', 'the sheet buttons carry the classes the widths depend on: ' + sh.map(b => b.className).join('|'));
    { const a = access.navFor(access.SEED.coo.actions.filter(k => k !== 'pricedoc.all')); ok(a.nav.join() === 'approvals,clients,margin,costs,products,reports' && a.more.join() === 'setup,guide', 'without the price list right: 6 places'); }
    ok(/\.find\(x => x\.offsetParent !== null\)/.test(js) && /max-width:900px\)\{\.hdr \.foot \.pp\{display:none\}/.test(css), 'More focuses a button that shows; no empty pill on a narrow bar');
    ok(sh.map(b => b.dataset.scr).join() === 'pricelists,products,reports,setup,guide', 'the More sheet lists what the phone bar leaves out: ' + sh.map(b => b.dataset.scr).join());
    E("moreOpen = false; scr = 'approvals'; renderPage()");
    ok(E("pth('products')") === 'Products' && E("pth('setup')") === 'Setup (the gear; on a phone, under More)', 'the Guide names the places, and where Setup is on a phone');
    ok(!/\*\*More\*\*, \*\*(Products|Reports|Setup)\*\*/.test(js) && !/More, (Products|Reports|Setup)/.test(js), 'no Guide step sends anyone to More for Products, Reports or Setup');
    // the styles
    ok(/\.hdr\{height:56px\}/.test(css) && /\.shell\{padding-top:56px\}/.test(css), 'the bar is 56 px and the page starts under it');
    ok(!/\.hdr\{[^}]*z-index:100/.test(css), 'the bar stays under panels, the More sheet and toasts');
    ok(/@media \(min-width:761px\) and \(max-width:1199px\)\{\s*\.hdr nav button\.fold\{display:none\}/.test(css), 'below 1200 px Products and Reports go under More');
  } catch (e) { fail++; console.log('ERROR ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')); }
  console.log(`page-bar: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
}, 50);
