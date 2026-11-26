// The VAN look (D-196, 26 Nov 2026): the website's colours and fonts, 1 set of sizes, page tops, Today, row buttons. Page checks in jsdom.
// Run: node apps/c2m/tests/page-196.test.js
const fs = require('fs'); const path = require('path'); const { JSDOM, html: PAGE, fixture: FIXTURE } = require('./_page.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
const css = fs.readFileSync(path.join(__dirname, '..', 'c2m.css'), 'utf8');
const shell = fs.readFileSync(path.join(__dirname, '..', 'c2m.html'), 'utf8');
const dom = new JSDOM(fs.readFileSync(PAGE, 'utf8'), { runScripts: 'dangerously', url: 'https://x.test/c2m', beforeParse(w) { w.localStorage.setItem('van_token', 't'); w.fetch = () => new Promise(() => {}); w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} }); w.scrollTo = () => {}; } });
const w = dom.window; const E = s => w.eval(s); const doc = w.document;
const main = () => doc.querySelector('main') || doc.getElementById('app');
setTimeout(async () => {
  try {
    // 1. Colours, fonts and sizes (the last block of c2m.css wins)
    const last = css.slice(css.indexOf('The VAN look, D-196'));
    ok(last.length > 1000, 'the D-196 block is in c2m.css');
    for (const [k, v] of [['bg', '#F7F4EE'], ['ink', '#171A16'], ['amber', '#C88A2E'], ['ok', '#2D5A3C'], ['blue', '#171A16']]) ok(new RegExp(`--${k}:${v}`).test(last), `token --${k} is the website's ${v}`);
    ok(/family=Fraunces/.test(shell) && /Public\+Sans/.test(shell) && !/family=Inter/.test(shell), 'the page loads Fraunces and Public Sans, not Inter');
    ok(/main h1,main h1\.topic\{font-family:var\(--serif\);font-weight:400;font-size:30px/.test(last), 'page titles: Fraunces, 30 px');
    const sizes = [...new Set([...last.matchAll(/font-size:(\d+(?:\.\d+)?)px/g)].map(m => Number(m[1])))].sort((a, b) => a - b);
    ok(sizes.every(s => [12, 14, 16, 22, 30].includes(s)), 'the block uses only the 5 type sizes: ' + sizes.join(', '));
    ok(/--h:36px;--hrow:32px/.test(last) && /min-height:var\(--h\)/.test(last), 'buttons and boxes: 36 px, 32 px in a table row');
    ok(/main td:not\(\.doc \*\)\{padding:8px 12px;vertical-align:middle/.test(last), 'table cells: text and buttons on 1 line (middle)');
    ok(/\.wrapx\.tall,\.appr2 \.afyi\{max-height:none;overflow:visible\}\.vgrid\{max-height:none\}/.test(last), 'no list scrolls inside its own box');
    ok(/html\{scrollbar-gutter:stable\}/.test(last), 'every place starts at the same left edge (room kept for the scroll bar)');
    ok(/\.hdr\{background:var\(--surface\)/.test(last) && /\.hdr nav button\[aria-current="true"\]\{[^}]*box-shadow:inset 0 -2px 0 var\(--amber\)/.test(last), 'top bar: light, the open place underlined in amber');
    ok(/\.hdr \.foot \.pp\{[^}]*max-width:none/.test(last) && /\.hdr \.foot \.pp b\{flex:none/.test(last), 'the name in the top bar is never cut to 1 letter');

    w.eval(fs.readFileSync(FIXTURE, 'utf8'));
    E("ST = window.__STF; ST.me.nav = ['approvals', 'clients', 'margin', 'costs', 'pricelists', 'products', 'reports']; ST.me.more = ['setup', 'guide']; _pi = null");
    // 2. Clients: the White Label | VAN Brands switch sits under the title
    E("scr = 'clients'; cl = { kind: 'wl', brand: null }; renderPage()");
    { const h = main().querySelector('h1'), sw = main().querySelector('.clsw'); ok(h && sw && (h.compareDocumentPosition(sw) & w.Node.DOCUMENT_POSITION_FOLLOWING), 'Clients, White Label: the switch comes after the title'); ok(main().querySelectorAll('.clsw').length === 1, 'the switch shows once'); }
    E("cl = { kind: 'van', brand: null }; renderPage()");
    { const h = main().querySelector('h1'), sw = main().querySelector('.clsw'); ok(h && sw && (h.compareDocumentPosition(sw) & w.Node.DOCUMENT_POSITION_FOLLOWING), 'Clients, VAN Brands: the switch comes after the title'); ok(main().querySelectorAll('.clsw').length === 1, 'VAN Brands: the switch shows once'); }
    ok(E("underHead('<i id=u1></i>', () => '<p>no head</p>')").startsWith('<i id=u1>'), 'underHead: with no page head, the tabs go first, as before');
    ok(E("(underHead('X', () => head('T', 'a', '')), AFH)") === '', 'underHead leaves nothing over for the next draw');
    // 3. Margin: the facts line sits in the page head, not above the title
    E("scr = 'margin'; renderPage()");
    { const ph = main().querySelector('.phd .phmeta'); ok(ph && ph.textContent.length > 3, 'Margin: the period and O2S time are in the page head: ' + (ph && ph.textContent)); ok(/\.kick\.meta:has\(\+ \.phd\)\{display:none\}/.test(css), 'the old line above the title is hidden when a page head follows'); }
    ok(E("(meta('x'), head('T', 'a', ''), MT)") === '', 'the facts line is used once');
    // 4. Today for the plant roles: no Your day card, the next move once
    E("ST.me = Object.assign({}, ST.me, { role: 'plant', admin: false, label: 'Plant Manager', actions: ['recipe.step.endorse', 'see.products', 'see.cost'], nav: ['today', 'recipes', 'guide'], more: [], user: 'fahim' }); scr = 'today'; renderPage()");
    { const t = main().textContent; ok(!/Your day/.test(t) && !/Your next move, above\./.test(t), 'Today: no Your day card, no repeat of the next move'); ok((t.match(/Nothing needs you today\./g) || []).length <= 1, 'Today with nothing to do says so once'); }
    E("(() => { const J = [{ t: 'Endorse recipe: A', d: 'x', btn: 'Open', kind: 'approve', pri: 0, since: ST.today }, { t: 'Endorse recipe: B', d: 'y', btn: 'Open recipe', kind: 'approve', pri: 1, since: ST.today }]; window.__hg = homeGrid(J, 0, []); })()");
    ok(/Endorse recipe: B/.test(E('__hg')) && !/Endorse recipe: A/.test(E('__hg')) && /class="home one"/.test(E('__hg')), 'Today: the list holds the rest, full width');
    ok(E("homeGrid([{ t: 'Only', d: '', btn: 'Open', kind: 'approve', pri: 0, since: ST.today }], 0, [])") === '', 'Today: 1 job is the next move alone, no list card');
    // 5. Packing cost: Change price and ••• (Edit and Delete fold)
    E("ST.me = window.__STF.me; ST.me.actions = (ST.me.actions || []).concat(['packing.manage']); ST.packingItems = [{ id: 7, name: 'Bag 25 Kg', kind: 'Bag', price: 120, date: '2026-10-13', source: 'Sheet' }]; scr = 'costs'; cpart = 'packing'; renderPage()");
    { const tr = [...main().querySelectorAll('table[data-lft="pitems"] tr')].find(r => /Bag 25 Kg/.test(r.textContent)); const vis = tr ? [...tr.querySelectorAll('button.btn')].filter(b => !b.closest('.dm')) : []; ok(tr && vis.length === 1 && /Change price/.test(vis[0].textContent) && tr.querySelector('details.dots'), 'Packing cost: 1 button and ••• per row: ' + (tr && tr.textContent.slice(0, 80))); }
    // 6. Inputs: the values column does not repeat the State column
    ok(E("nutLine({ role: 'nutrient', fields: ['K'], nutrients: {}, nutRows: [] }, true)") === '<span class="ans">–</span>', 'Inputs: a material with nothing entered shows a dash; State says what is missing');
    ok(/K 60/.test(E("nutLine({ role: 'nutrient', fields: ['K'], nutrients: { K: 60 }, nutRows: [{ label: 'K', pct: 60 }] }, true)")), 'Inputs: the values alone');
    ok(/to enter: K/.test(E("nutLine({ role: 'nutrient', fields: ['K', 'S'], nutrients: { S: 1 }, nutRows: [{ label: 'S', pct: 1 }] })")), 'elsewhere nutLine still says what is missing');
    // 8. After the independent review of D-196
    E("ST.me = Object.assign({}, window.__STF.me, { role: 'cfo', admin: false, label: 'CFO', user: 'yawar' })");
    { const h = E("homeGrid([{ t: 'Only job', d: '', btn: 'Open', kind: 'approve', pri: 0, since: ST.today }], 0, [])"); ok(!/Nothing needs you today/.test(h) && !/Only job/.test(h), 'review 1: the CFO with 1 job sees the next move alone, no list that says nothing needs you'); }
    ok(!/\.vgrid,/.test(css.slice(css.indexOf('The VAN look, D-196'))) && /\.vgrid\{max-height:none\}/.test(css), 'review 2: the 5 lists side by side still scroll sideways inside their box');
    ok(/--faint:#5F645B/.test(css), 'review 3: column heads and hints in a grey with 5:1 contrast or more');
    ok(/\.hdr \.n\{background:#855610\}/.test(css), 'review 4: the count in the top bar is white on dark amber (6.3:1)');
    E("ST.me = window.__STF.me; ST.me.actions = (ST.me.actions || []).concat(['packing.manage']); ST.packingItems = [{ id: 8, name: 'Bag & liner', kind: 'Bag', price: 5, date: '2026-10-13', source: 'x' }]; scr = 'costs'; cpart = 'packing'; renderPage()");
    { const s = main().querySelector('table[data-lft="pitems"] details.dots summary'); ok(s && s.getAttribute('aria-label') === 'More actions for Bag & liner', 'review 5: the ••• label is escaped once: ' + (s && s.getAttribute('aria-label'))); }
    ok(/main th:not\(\.doc \*\)/.test(css) && /main td:not\(\.doc \*\)/.test(css), 'review 7: the price list preview keeps the look of the PDF');
    // 9. D-196b, after the live check: Today with nothing to do and items with others
    E("ST.me = Object.assign({}, window.__STF.me, { role: 'qc', admin: false, label: 'QC Head', actions: ['recipe.step.review', 'see.products', 'see.materials'], nav: ['today', 'recipes', 'inputs', 'guide'], more: [], user: 'himayat' }); scr = 'today'; renderPage()");
    { const em = main().querySelector('.endmark'); ok(!em || !/Nothing needs you today/.test(em.textContent), 'D-196b: the end line does not repeat "Nothing needs you today."'); }
    { const src = fs.readFileSync(path.join(__dirname, '..', 'c2m.js'), 'utf8'); const ln = src.split('\n').find(l => l.includes('class="ans endmark"')) || ''; ok(ln && !/Nothing needs you today/.test(ln) && /with others; none needs you now/.test(ln), 'D-196b: the end line is built without the repeat, and still counts the items with others'); }
    ok(!/details\.box:not\(\.form\)>summary\{[^}]*display:flex/.test(css), 'D-196b review: a folding line flows as text, so no gap opens before a comma');
    ok(/main details\.box:not\(\.form\)>summary\{padding:8px 12px;min-height:var\(--h\)/.test(css), 'D-196b: a folding box opens from a full-height row');
    ok(/2026-11-26d/.test(E('JSON.stringify(CHANGELOG)')), "What's changed has 2026-11-26d");
    // 7. Guide, What's changed and docs moved with it
    ok(/2026-11-26c/.test(E('JSON.stringify(CHANGELOG)')), "What's changed has the new look (2026-11-26c)");
    ok(/D-196/.test(fs.readFileSync(path.join(__dirname, '..', 'docs', '06-decisions.md'), 'utf8')), 'docs 06 records D-196');
  } catch (e) { fail++; console.log('ERROR', e && e.stack); }
  console.log(`page-196: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
}, 300);
