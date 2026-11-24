// D-184 page checks in jsdom (Tahir, 23 Nov 2026): 1 Remove button on every recipe, its box, 1 press.
// Run: node apps/c2m/tests/page-184.test.js (or give a page file as the first argument)
const fs = require('fs'); const { JSDOM, html: PAGE } = require('./_page.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
const html = fs.readFileSync(process.argv[2] || PAGE, 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.test/c2m', beforeParse(w) { w.fetch = () => new Promise(() => {}); w.localStorage.setItem('van_token', 't'); } });
const w = dom.window; const E = s => w.eval(s); const txt = h => String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const tick = () => new Promise(r => setTimeout(r, 0));
setTimeout(async () => {
  try {
    const rec = (id, version, state, rname, extra) => ({ id, clientProductId: 1, customer: 'Rudolf', brand: 'Basic', version, state, rname, isDefault: false, defaultName: 'Main', note: '', lines: [], steps: [], flags: [], path: null, sentBack: null, materials: [], nutrients: { fields: [], carriers: [], carrierKg: 0, notEntered: [], unclassified: [], complete: true }, kgTotal: 1, ...extra });
    w.__ST = { today: '2026-11-23', m007: true, me: { role: 'cfo', admin: false, actions: ['recipe.start', 'recipe.step.cost', 'see.cost', 'see.products'], nav: ['approvals', 'products'], more: [], user: 'yawar', name: 'Yawar' },
      settings: [{ k: 'reapprove_pct', v: '3' }], golive: { on: false },
      products: [{ id: 1, brand: 'Basic', customer: 'Rudolf', soldPer: 'kg', channel: 'White label', grp: 'White label', packs: [{ id: 11, size: 10, unit: 'kg', cost: { total: 100 }, approvedCost: 100 }], target: 23, active: true, recipeState: 'approved', approvedVersionId: 14, defaultName: 'Main', others: [{ id: 67, name: 'Basic - Standard Recipe - MAP, TSP & AS', version: 2, packs: [{ id: 11, total: 104 }] }] }],
      recipes: [rec(14, 1, 'approved', 'Main', { isDefault: true }), rec(67, 2, 'approved', 'Basic - Standard Recipe - MAP, TSP & AS'), rec(70, 3, 'draft', 'Main'), rec(71, 4, 'review', 'Main')],
      pending: [], reapprovals: [], proposals: [], listRevisions: [], settingRequests: [], targetRequests: [], checks: [], actuals: [], imports: [], notices: [], sales: [], open: [], rates: [], materials: [], listItems: [], mrpMissing: [], mrpIssues: [], packingItems: [], packingBills: [], rules: [], customers: [] };
    E('ST = window.__ST; _pi = null; if (typeof RSEQ !== "undefined") RSEQ++');
    const V = id => E(`vRecipe(ST.recipes.find(v => v.id === ${id}))`);
    // The CFO on Basic version 2 (approved, not the Default): Remove under the name; the old buttons are gone
    let h = V(67); ok(/data-rrem="67" data-rremw="head"/.test(h), 'CFO: Remove on the approved recipe head');
    ok(!/Delete this draft/.test(h) && !/data-rwdel="recipe/.test(h), 'no Delete this draft');
    h = V(70); ok(/data-rrem="70"/.test(h) && !/Delete this draft/.test(h), 'draft: Remove, not Delete this draft');
    // Option 2: Remove in each row of the product's recipe list, the Default included
    let B = E('recipesBox(ST.products[0])'); ok(/data-rrem="14" data-rremw="list"/.test(B) && /data-rrem="67" data-rremw="list"/.test(B), 'Remove in both rows of the recipe list');
    // The Production Manager: Remove on his draft only
    E("ST.me = { role: 'production', admin: false, actions: ['recipe.start', 'recipe.edit', 'recipe.step.draft', 'see.products', 'see.cost'], nav: ['products'], more: [], user: 'majid' }; RSEQ++");
    ok(/data-rrem="70"/.test(V(70)), 'Production Manager: Remove on a draft'); ok(!/data-rrem="67"/.test(V(67)), 'Production Manager: no Remove on an approved recipe');
    ok(!/data-rrem=/.test(E('recipesBox(ST.products[0])')), 'Production Manager: no Remove in the recipe list');
    // The QC Head at his step, inside the panel: Remove sits with the step buttons, once; Close this version is gone
    E("ST.me = { role: 'qc', admin: false, actions: ['recipe.step.review', 'see.products'], nav: ['today'], more: [], user: 'himayat' }; RSEQ++");
    h = E('vRecipe(ST.recipes.find(v => v.id === 71), { panel: true })');
    ok((h.match(/data-rrem="71"/g) || []).length === 1, 'QC Head in the panel: 1 Remove: ' + (h.match(/data-rrem="71"/g) || []).length);
    ok(!/>Close this version</.test(h) && /data-sb="71"/.test(h), 'Close this version renamed Remove; Send back stays');
    ok(!/data-rrem="67"/.test(V(67)), 'QC Head: no Remove on an approved recipe');
    // The box: delete, with the 4 checks and the 4 reasons; 1 press, no Confirm
    E("ST.me = { role: 'cfo', admin: false, actions: ['recipe.start', 'recipe.step.cost', 'see.cost', 'see.products'], nav: ['approvals', 'products'], more: [], user: 'yawar' }; RSEQ++");
    const U = { kind: 'recipe', id: 67, label: 'Basic for Rudolf, recipe "Basic - Standard Recipe - MAP, TSP & AS" version 2', action: 'delete', uses: [], fix: null, recipe: { id: 67, state: 'approved', productId: 1, brand: 'Basic', rname: 'Basic - Standard Recipe - MAP, TSP & AS', version: 2, defaultName: 'Main' },
      checks: [{ ok: true, t: 'Not the Default (Main version 1 is)' }, { ok: true, t: 'No approved cost was ever written on it' }, { ok: true, t: 'Never the Default' }, { ok: true, t: 'No product follows it' }] };
    w.__U = U; E("recRem = { id: 67, where: 'head', U: window.__U, chip: null, note: '' }; RSEQ++");
    h = V(67); const box = (h.match(/<div class="box form rembox[\s\S]*?Delete recipe<\/button>/) || [''])[0];
    ok(/Delete this recipe\?/.test(h) && (h.match(/<li class="ok">/g) || []).length === 4, 'delete box with 4 checks');
    ok(['Wrong name: meant a new version of Main', 'Started by mistake', 'Not going ahead', 'Other'].every(c => h.includes(`data-rremchip="${c}"`)), 'the 4 reasons');
    ok(/data-rremgo/.test(box) && !/data-rremgo[^>]*data-confirm/.test(box), 'Delete recipe is 1 press (no Confirm)');
    ok(!/rembox/.test(E('recipesBox(ST.products[0])')), 'the box opens only where its button was pressed');
    // Presses: no reason, no call; Other needs a note; a reason with a note is sent as 1 line
    w.__calls = []; E("act = async (p, b) => { window.__calls.push({ p, b }); return { label: 'x' }; }");
    w.document.getElementById('app').innerHTML = V(67);
    const click = sel => { const b = w.document.querySelector(sel); if (!b) throw new Error('no ' + sel); b.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
    click('[data-rremgo]'); await tick(); ok(w.__calls.length === 0, 'no reason picked: nothing sent');
    E("recRem.chip = 'Other'; recRem.note = ''"); w.document.getElementById('app').innerHTML = V(67); click('[data-rremgo]'); await tick(); ok(w.__calls.length === 0, 'Other with no note: nothing sent');
    E("recRem.chip = 'Wrong name: meant a new version of Main'"); w.document.getElementById('app').innerHTML = V(67);
    w.document.getElementById('rremn').value = 'Majid will write it as Main version 2'; click('[data-rremgo]'); await tick(); await tick();
    const c1 = w.__calls[0]; ok(c1 && c1.p === '/api/c2m/delete' && c1.b.kind === 'recipe' && c1.b.id === 67 && c1.b.why === 'Wrong name: meant a new version of Main: Majid will write it as Main version 2', 'sent: ' + JSON.stringify(c1));
    ok(E('recRem') === null, 'the box closes after the delete');
    // Close at a step: the same box says Close it and posts to close
    w.__U2 = { ...U, id: 71, action: 'close', checks: [], recipe: { ...U.recipe, id: 71, state: 'review' } };
    E("ST.me = { role: 'qc', admin: false, actions: ['recipe.step.review', 'see.products'], nav: ['today'], more: [], user: 'himayat' }; recRem = { id: 71, where: 'head', U: window.__U2, chip: 'Not going ahead', note: '' }; RSEQ++");
    h = E('vRecipe(ST.recipes.find(v => v.id === 71), { panel: true })'); ok(/Close this version<\/b>/.test(h) && /Close it<\/button>/.test(h) && /Replaced by another version/.test(h), 'close box at the step');
    w.__calls = []; w.document.getElementById('app').innerHTML = h; click('[data-rremgo]'); await tick(); await tick();
    ok(w.__calls[0] && w.__calls[0].p === '/api/c2m/recipes/71/close' && w.__calls[0].b.reason === 'Not going ahead', 'close sent with its reason: ' + JSON.stringify(w.__calls[0]));
    // Cannot: the Default, with its fix
    w.__U3 = { ...U, id: 14, action: 'none', fix: 'default', uses: ["It is the Default: it sets Basic's cost, price and margin"], checks: [{ ok: false, t: "It is the Default: it sets Basic's cost, price and margin" }, { ok: true, t: 'No product follows it' }], recipe: { ...U.recipe, id: 14 } };
    E("ST.me = { role: 'cfo', admin: false, actions: ['recipe.start', 'recipe.step.cost', 'see.cost', 'see.products'], nav: ['approvals', 'products'], more: [], user: 'yawar' }; recRem = { id: 14, where: 'head', U: window.__U3, chip: null, note: '' }; RSEQ++");
    h = V(14); ok(/cannot be removed/.test(h) && /<li class="no">It is the Default/.test(h) && /data-rremprod="1"/.test(h) && !/data-rremgo/.test(h), 'Default: why it stays, and Make another recipe the Default: ' + txt(h).slice(0, 300));
    E("recRem = { id: 14, where: 'list', U: window.__U3, chip: null, note: '' }; RSEQ++"); B = E('recipesBox(ST.products[0])');
    ok(/cannot be removed/.test(B) && /in the table above first/.test(B), 'from the list: points to Make default in the table');
    w.document.getElementById('app').innerHTML = B; // 24 Nov 2026: the box is put on the page here, so the check does not lean on what an earlier press left there
    ok(E('busyNow()') === true, 'an open Remove box holds the refresh');
    E('recRem = null');
    // Guide and What's changed
    ok(/Remove a recipe/.test(fs.readFileSync(require('path').join(__dirname, '..', 'c2m.js'), 'utf8')) && !/'Delete a draft started by mistake'/.test(fs.readFileSync(require('path').join(__dirname, '..', 'c2m.js'), 'utf8')), 'Guide job Remove a recipe replaces Delete a draft started by mistake');
    ok(/ver: '2026-11-23a'/.test(fs.readFileSync(require('path').join(__dirname, '..', 'c2m.js'), 'utf8')), "What's changed entry 2026-11-23a");
  } catch (e) { fail++; console.log('ERROR ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 4).join(' ')); }
  console.log(`page-184: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
}, 50);
