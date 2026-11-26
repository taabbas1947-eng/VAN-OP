// A row of 3 or more buttons: its main button and a ••• menu; 1 filled button per row (D-194, 25 Nov 2026). Page checks in jsdom.
// Run: node apps/c2m/tests/page-194.test.js
const fs = require('fs'); const path = require('path'); const { JSDOM, html: PAGE, fixture: FIXTURE } = require('./_page.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
const css = fs.readFileSync(path.join(__dirname, '..', 'c2m.css'), 'utf8');
const dom = new JSDOM(fs.readFileSync(PAGE, 'utf8'), { runScripts: 'dangerously', url: 'https://x.test/c2m', beforeParse(w) { w.localStorage.setItem('van_token', 't'); w.fetch = () => new Promise(() => {}); w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} }); w.scrollTo = () => {}; } });
const w = dom.window; const E = s => w.eval(s); const doc = w.document;
const main = () => doc.querySelector('main') || doc.getElementById('app');
const click = el => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const menuOf = el => el ? [...el.querySelectorAll('.dm button')].map(b => b.textContent.trim()) : [];
setTimeout(() => {
  try {
    w.eval(fs.readFileSync(FIXTURE, 'utf8'));
    E("ST = window.__STF; ST.me.nav = ['approvals', 'clients', 'margin', 'costs', 'pricelists', 'products', 'reports']; ST.me.more = ['setup', 'guide']; ST.me.actions = ST.me.actions.concat(['client.add', 'customer.edit', 'variant.add', 'recipe.start', 'packing.manage', 'lists.link', 'list.revise', 'see.cost']); _pi = null");
    // the helper
    const two = E("acts(['<button class=\"btn\" data-a>A</button>', '<button class=\"btn\" data-b>B</button>'])");
    ok(!/details/.test(two) && (two.match(/class="btn"/g) || []).length === 1 && /class="btn ghost" data-b/.test(two), '2 buttons stay in the row; only the first filled stays filled');
    const three = E("acts(['<button class=\"btn ghost\" data-o>Open</button>', '<button class=\"btn ghost\" data-e>Edit</button>', '<button class=\"btn ghost danger\" data-d>Delete</button>'], 'X')");
    { const d = doc.createElement('div'); d.innerHTML = three; ok(d.children[0].textContent === 'Open' && d.querySelector('details.dots summary').textContent === '•••' && menuOf(d).join() === 'Edit,Delete', '3 buttons: Open and a ••• menu with the rest: ' + d.textContent);
      ok(d.querySelector('.dm .danger') && /More actions for X/.test(d.querySelector('summary').getAttribute('aria-label')), 'Delete stays red in the menu; the ••• says what it is for'); }
    const f2 = E("acts(['<button class=\"btn ghost\" data-o>Open</button>', '<button class=\"btn\" data-p>Propose</button>', '<button class=\"btn\" data-q>Approve</button>'])");
    { const d = doc.createElement('div'); d.innerHTML = f2; ok(d.children[0].textContent === 'Propose' && d.querySelectorAll('button.btn:not(.ghost)').length === 1, 'the main button is the first filled one, and only it stays filled'); }
    ok(E("acts(['', null, '<button class=\"btn\">A</button>'])") === '<button class="btn">A</button>', 'empty items are dropped');
    // the product page bar
    const p = E("ST.products.find(p => p.grp === 'White label').id");
    E(`scr = 'products'; openProd = ${p}; ptab = 'recipe'; renderPage()`);
    const bar = main().querySelector('.pba'); ok(bar && menuOf(bar.querySelector('.dots')).includes('Edit this product') && bar.querySelector('.dm .danger') && /Delete/.test(bar.querySelector('.dm .danger').textContent), 'product page: Edit this product and Delete (red) are in the menu: ' + (bar && bar.textContent));
    ok(bar.querySelectorAll('button.btn:not(.ghost)').length <= 1, 'product page: at most 1 filled button');
    { const s = bar.querySelector('.dots summary'); click(s); s.parentElement.open = true; E('render()'); ok(!main().querySelector('details.dots[open]') && main().querySelector('.pba details.dots').hasAttribute('data-nofold'), 'review M1: a redraw never opens a menu again'); }
    { const d = doc.createElement('div'); d.innerHTML = E("acts(['<button class=\"btn ghost\" data-e>Edit</button>', '<button class=\"btn ghost danger\" data-d>Delete</button>'])"); ok(d.children[0].textContent === 'Edit' && menuOf(d.querySelector('.dots')).join() === 'Delete', 'review m3: Edit and Delete: Delete goes in the menu'); }
    { const d = doc.createElement('div'); d.innerHTML = E("acts(['<button type=\"button\" class=\"btn\" data-a>A</button>', '<button class=\"btn warn\" data-b>B</button>'])"); ok(d.querySelectorAll('button.btn:not(.ghost)').length === 1 && !d.querySelector('.warn'), 'review m4: the class is read as words, wherever it sits'); }
    // Setup, Products and variants, with a VAN brand product
    E("ST.products.filter(p => p.customer === ST.products[0].customer).forEach(p => { p.channel = 'VAN brand'; p.grp = 'VAN brand'; p.customer = 'VAN brand'; }); ST.variantsReady = true; _pi = null; scr = 'setup'; nsu = 'van'; renderPage()");
    const pv = main().querySelector('td .dots'); const pvRow = pv && pv.closest('.acts');
    ok(pvRow && pvRow.children[0].textContent === 'Open' && ['Edit', 'Take out of use'].every(t => menuOf(pv).includes(t)), 'Products and variants: Open and a menu with Edit, Take out of use: ' + (pvRow && pvRow.textContent));
    // the menu opens, 1 at a time, closes on Escape and on a click outside
    const ds = [...main().querySelectorAll('details.dots')]; ok(ds.length > 1, 'more than 1 row with a menu');
    ds[0].open = true; ds[0].dispatchEvent(new w.Event('toggle')); ds[1].open = true; ds[1].dispatchEvent(new w.Event('toggle'));
    ok(!ds[0].open && ds[1].open, '1 menu open at a time');
    doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); ok(!ds[1].open && doc.activeElement === ds[1].querySelector('summary'), 'Escape closes it and puts the cursor back on •••');
    ds[1].open = true; click(main().querySelector('h1')); ok(!ds[1].open, 'a click outside closes it');
    ds[1].open = true; const inside = ds[1].querySelector('.dm'); click(inside); ok(ds[1].open, 'a click inside the menu itself does not close it');
    // packing bill row
    E("ST.packingBills = [{ id: 7, name: 'Bill A', lines: [], at: '2026-11-18' }]; scr = 'costs'; cpart = 'packing'; renderPage()");
    const bl = [...main().querySelectorAll('td .acts')].find(a => a.querySelector('[data-billedit]'));
    ok(bl && (bl.querySelector('.dots') ? bl.children[0].textContent === 'Edit' && menuOf(bl.querySelector('.dots')).includes('Delete') : bl.querySelectorAll('button').length < 3), 'packing bill row: Edit and a menu when it has 3 buttons: ' + (bl && bl.textContent));
    // the 3 Revise buttons are 1 menu
    E("scr = 'clients'; cl = { kind: 'van', brand: null }; ncp.tab = 'vlists'; renderPage()");
    const html = E("revBox(false)"); { const d = doc.createElement('div'); d.innerHTML = html; const m = d.querySelector('details.dlist'); ok(m && /Revise a list/.test(m.querySelector('summary').textContent) && m.querySelectorAll('[data-revstart]').length === 3, 'Revise a list is 1 menu with the 3 lists'); }
    // the look
    ok(/\.dots>\.dm\{position:absolute/.test(css) && /td \.dots>\.dm,\.wrapx \.dots>\.dm\{position:static/.test(css), 'the menu floats, but opens in place inside a table (no cut-off in a sideways-scroll box)');
    ok(/@media \(max-width:760px\)\{\.dots>summary\{min-height:44px!important/.test(css) && /\.dots>\.dm \.btn\.danger\{color:var\(--over\)\}/.test(css), '44 px on a phone; Delete red');
    ok(!/^\.acts\{/m.test(css), 'no new rule for every .acts row');
    { const g = E('JSON.stringify(GUIDE_JOBS())'); ok(/beside \*\*Open\*\* in its row, then \*\*Edit\*\*/.test(g) && /holds \*\*Rename\*\* and \*\*Delete\*\*/.test(g) && /\*\*•••\*\*, then \*\*Edit this product\*\* or \*\*Delete\*\*/.test(g), 'review M2: the Guide names the ••• menu'); }
    { const md = fs.readFileSync(path.join(__dirname, '..', 'docs', '07-guide.md'), 'utf8'); ok(/beside \*\*Open\*\* in its row, then \*\*Edit\*\*/.test(md) && /holds \*\*Rename\*\* and \*\*Delete\*\*/.test(md), 'and docs 07 says the same'); }
  } catch (e) { fail++; console.log('ERROR', e && e.stack); }
  console.log(`page-194: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
}, 300);
