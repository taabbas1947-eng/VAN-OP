// D-197 (26 Nov 2026): the material card saves once, with its help beside the form; a recipe opened from Recipes keeps Recipes lit.
// Run: node apps/c2m/tests/page-197.test.js
const fs = require('fs'); const path = require('path'); const { JSDOM, html: PAGE, fixture: FIXTURE } = require('./_page.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
const css = fs.readFileSync(path.join(__dirname, '..', 'c2m.css'), 'utf8');
const dom = new JSDOM(fs.readFileSync(PAGE, 'utf8'), { runScripts: 'dangerously', url: 'https://x.test/c2m', beforeParse(w) { w.localStorage.setItem('van_token', 't'); w.fetch = () => new Promise(() => {}); w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} }); w.scrollTo = () => {}; } });
const w = dom.window; const E = s => w.eval(s); const doc = w.document;
const main = () => doc.querySelector('main') || doc.getElementById('app');
const tick = () => new Promise(r => setTimeout(r, 30));
setTimeout(async () => {
  try {
    w.eval(fs.readFileSync(FIXTURE, 'utf8'));
    E(`ST = window.__STF; ST.m014 = true; ST.m015 = true; _pi = null;
      ST.me = Object.assign({}, ST.me, { actions: ST.me.actions.concat(['nutrient.edit', 'nutrient.list', 'see.materials']), nav: ['approvals', 'clients', 'margin', 'costs', 'products', 'recipes', 'inputs'], more: ['setup', 'guide'] });
      ST.nutrientList = [{ id: 1, label: 'K', name: 'Potassium', basis: 'K2O' }];
      ST.materials = [{ gradeId: 11, name: 'Potash liquid', grade: 'SOP', role: 'nutrient', unit: 'kg', type: 'Nutrient', checked: true, fields: ['K'], nutRows: [{ nutrientId: 1, label: 'K', pct: 50, measure: 'w/v' }], nutrients: { K: 50 }, density: null }];
      window.__acts = []; act = async (u, b) => { __acts.push(u); return {}; };
      scr = 'inputs'; inp = 'materials'; mtab = 'materials'; mcOpen = 11; mcDraft = null; renderPage()`);
    // 1. 1 Save
    const m = main();
    ok(m.querySelector('[data-n7mcsave]') && !m.querySelector('[data-n7den="grade"]'), 'the card has 1 Save and no Save density of its own');
    ok(!/Save density/.test(m.textContent), 'no "Save density" anywhere on the card');
    ok(m.querySelector('.mcgrid .mcmain #mcd-v') && m.querySelector('.mcgrid .mcmain [data-n7mcsave]'), 'the density box and Save sit in the form column');
    // 2. Help beside the form
    const hp = m.querySelector('.mcgrid > aside.mchelp');
    ok(hp && /counts as 0/.test(hp.textContent) && /Density/.test(hp.textContent), 'the help (nutrients and density) is in its own column: ' + (hp && hp.textContent.slice(0, 60)));
    ok(/@media \(min-width:900px\)\{\.mcgrid\{grid-template-columns:minmax\(0,1fr\) 320px/.test(css) && !main().querySelector('.mcgrid table'), 'the help sits beside the density box and Save at 900 px and over (under them on a phone); the nutrient table keeps the full width');
    // 3. Save sends the density, then the nutrients
    doc.getElementById('mcd-v').value = '1.25'; doc.getElementById('mcd-s').value = 'lab report'; doc.getElementById('mcd-d').value = '2026-11-20';
    m.querySelector('[data-n7mcsave]').click(); await tick(); await tick();
    ok(E('JSON.stringify(__acts)') === JSON.stringify(['/api/c2m/density', '/api/c2m/grades/11/nutrients']), '1 Save: the density first, then the nutrients: ' + E('JSON.stringify(__acts)'));
    // 4. A changed source alone is saved too
    E(`__acts = []; ST.materials[0].density = { kgPerL: 1.25, source: 'lab report', date: '2026-11-20' }; mcOpen = 11; mcDraft = null; renderPage()`);
    doc.getElementById('mcd-s').value = 'supplier certificate'; main().querySelector('[data-n7mcsave]').click(); await tick(); await tick();
    ok(E('__acts[0]') === '/api/c2m/density', 'a new source for the same density is saved with the card');
    E(`__acts = []; mcOpen = 11; mcDraft = null; renderPage()`); main().querySelector('[data-n7mcsave]').click(); await tick(); await tick();
    ok(E('JSON.stringify(__acts)') === JSON.stringify(['/api/c2m/grades/11/nutrients']), 'nothing changed in the density: only the nutrients are sent');
    // 5. A recipe opened from Recipes keeps Recipes lit
    const pid = E('(ST.products || [])[0] && ST.products[0].id');
    ok(pid != null, 'the fixture has a product');
    E(`ST.recipes = [{ id: 5, clientProductId: ${pid}, brand: 'B', customer: 'C', state: 'draft', version: 1, lines: [], steps: [] }]; scr = 'recipes'; openProd = null; goRec(5)`);
    ok(E('scr') === 'products' && E('recFrom') === true, 'opened from Recipes: the product page, marked as from Recipes');
    E("window.__vp = vProducts; vProducts = () => '<h1>Product</h1>'; renderPage(); vProducts = window.__vp"); /* the product page needs more data than the fixture has: a stand-in page, the real top bar */
    const lit = [...doc.querySelectorAll('.hdr nav button[aria-current="true"]')].map(b => b.dataset.scr);
    ok(lit.length === 1 && lit[0] === 'recipes', 'Recipes is lit in the top bar: ' + lit.join(','));
    ok(/\$\{recFrom \? 'All recipes' : 'All products'\}/.test(fs.readFileSync(path.join(__dirname, '..', 'c2m.js'), 'utf8')), 'the way back reads "All recipes"');
    E("document.body.insertAdjacentHTML('beforeend', '<button id=pb data-prodback></button>')"); doc.getElementById('pb').click(); await tick();
    ok(E('scr') === 'recipes' && E('openProd') === null, 'the way back leads to Recipes');
    E("scr = 'recipes'; goRec(5)"); ok(E('recFrom') === true, 'review 1: set again from Recipes');
    E("document.body.insertAdjacentHTML('beforeend', '<button id=op data-openprod=\"' + ST.products[0].id + '\"></button>')"); E("window.__vp = vProducts; vProducts = () => '<h1>Product</h1>'"); doc.getElementById('op').click(); await tick(); E('vProducts = window.__vp');
    ok(E('recFrom') === false, 'review 1: another product opened from the page no longer keeps Recipes lit');
    E("scr = 'recipes'; goRec(5); window.__sn = navSnap(); recFrom = false; navRestore(__sn)"); ok(E('recFrom') === true, 'review 2: Back and Forward keep Recipes lit');
    E(`ST.materials[0].density = { kgPerL: 1.2, source: 'lab report', date: '2026-11-20' }; __acts = []; scr = 'inputs'; inp = 'materials'; mtab = 'materials'; mcOpen = 11; mcDraft = null; renderPage()`);
    doc.getElementById('mcd-v').value = '1.20'; main().querySelector('[data-n7mcsave]').click(); await tick(); await tick();
    ok(E('JSON.stringify(__acts)') === JSON.stringify(['/api/c2m/grades/11/nutrients']), 'review 3: "1.20" against a saved 1.2 is no change: ' + E('JSON.stringify(__acts)'));
    E("scr = 'products'; openRec = null; goRec(5)"); ok(E('recFrom') === false, 'opened from anywhere else: Products stays lit, as before');
    E("scr = 'clients'; openProd = null; recFrom = true; try { renderPage() } catch (e) {}"); ok(E('recFrom') === false, 'leaving the product page clears it');
    // 6. Guide and What's changed
    ok(/Press \*\*Save\*\*: it saves the nutrients and the density together/.test(E('JSON.stringify(GUIDE_JOBS())')), 'Guide: density step 5 says Save');
    ok(/2026-11-26f/.test(E('JSON.stringify(CHANGELOG)')) && E('CHANGELOG[CHANGELOG.length - 1].ver') === '2026-11-26f', "What's changed has 2026-11-26f, last (newest)");
    ok(/D-197/.test(fs.readFileSync(path.join(__dirname, '..', 'docs', '06-decisions.md'), 'utf8')), 'docs 06 records D-197');
  } catch (e) { fail++; console.log('ERROR', e && e.stack); }
  console.log(`page-197: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
}, 300);
