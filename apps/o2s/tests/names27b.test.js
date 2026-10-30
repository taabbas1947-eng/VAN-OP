/* BUILD 2026-10-27b. Tahir's rulings of 27 Oct 2026 (multiple choice): one name for each product.
   - V Germinator Pro and V-Germinator Pro are the same product: one entry, V-Germinator Pro
   - Cala Mag V and Cal-Mag V are the same product: one entry, Cal-Mag V
   - V-Mg Essential is the correct spelling, and takes the full specification that sat on V-Mag Essential
   - 4 empty placeholders are removed (Pro Mix Liquid, Ferti Huma Pellets, Ferti huma Super, V-Germonator Pro)
   - old records are left as issued; the other spelling is "also known as" (inactive, marked)
   Run: node names27b.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;

const cp = x => JSON.parse(JSON.stringify(x));

/* ---- a small copy of the live product list (shape taken from the live master, 27 Oct 2026) ---- */
function fixture() {
  return {
    masters: {
      _productsV1: { at: 'x' },
      products: [
        { brand: 'V-Germinator Pro', base: 'Liquid Phosphrous', generic: 'P 27% + N 1% + K 6%', form: 'Liquid', owner: 'VAN', mapOwner: 'VAN', wl: false, group: 'Liquid', pack: 5, packs: [5], clients: ['BKK', 'Dealers', 'VITAL AGRI NUTRIENTS (PVT) LTD', 'Vgreen'], packsBy: { BKK: [5], Dealers: [5], 'VITAL AGRI NUTRIENTS (PVT) LTD': [5], Vgreen: [5] }, active: true, seeded: true },
        { brand: 'V Germinator Pro', base: 'Liquid Phosphrous', generic: 'Liquid Phosphate 27% + N + K Mg', form: 'Liquid', owner: 'Vital Agri', mapOwner: 'White Label', wl: true, group: 'Liquid', pack: 5, packs: [5, 1000], clients: ['LCI PAKISTAN LIMITED', 'RUDOLF LIFE SCIENCES'], packsBy: { 'LCI PAKISTAN LIMITED': [5], 'RUDOLF LIFE SCIENCES': [1000] }, active: true, seeded: true },
        { brand: 'V-Germonator Pro', base: 'Liquid Phosphrous', generic: '', form: 'Powder', owner: 'White Label', mapOwner: 'White Label', wl: true, group: null, pack: 1, packs: [1], clients: [], packsBy: {}, mapOnly: true, active: true, seeded: true },
        { brand: 'Cal-Mag V', base: 'Cal-Mag V', generic: 'Ca 6%+Mg 4%+B 1%+N 10%', form: 'Liquid', owner: 'VAN', mapOwner: 'VAN', wl: false, group: 'Liquid', pack: 1, packs: [1], clients: ['BKK', 'Dealers', 'Vgreen'], packsBy: { BKK: [1], Dealers: [1], Vgreen: [1] }, active: true, seeded: true },
        { brand: 'Cala Mag V', base: 'Cala Mag V', generic: 'Ca 6%, Mg 4%, B 1%, N 10%', form: 'Liquid', owner: 'Vital Agri', mapOwner: 'White Label', wl: true, group: 'Liquid', pack: 1, packs: [1, 1000], clients: ['LCI PAKISTAN LIMITED', 'RUDOLF LIFE SCIENCES'], packsBy: { 'LCI PAKISTAN LIMITED': [1], 'RUDOLF LIFE SCIENCES': [1000] }, active: true, seeded: true },
        { brand: 'V-Mg Essential', base: 'Mg Sulphate', generic: '', form: 'Powder', owner: 'VAN', mapOwner: 'VAN', wl: false, group: null, pack: 1, packs: [1], clients: [], packsBy: {}, mapOnly: true, active: true, seeded: true },
        { brand: 'V-Mag Essential', base: 'Mg Sulphate', generic: 'MgSO4 - 10%', form: 'Crystal', owner: 'VAN', mapOwner: 'VAN', wl: false, group: 'Crystalline', pack: 5, packs: [5], clients: ['BKK', 'Dealers', 'Vgreen'], packsBy: { BKK: [5], Dealers: [5], Vgreen: [5] }, active: true, seeded: true },
        { brand: 'ProMix Liquid', base: 'ProMix Liquid', generic: 'NPK 8:8:6', form: 'Liquid', owner: 'Syngenta', mapOwner: 'White Label', wl: true, group: 'Liquid', pack: 1000, packs: [1000], clients: ['SYNGENTA PAKISTAN LIMITED'], packsBy: { 'SYNGENTA PAKISTAN LIMITED': [1000] }, active: true, seeded: true },
        { brand: 'Pro Mix Liquid', base: 'NPK 8.8.6', generic: '', form: 'Powder', owner: 'White Label', mapOwner: 'White Label', wl: true, group: null, pack: 1, packs: [1], clients: [], packsBy: {}, mapOnly: true, active: true, seeded: true },
        { brand: 'Ferti Huma Pellet', base: 'Potassium Humate', generic: 'K2O 7%, H 40%', form: 'Pellet', owner: 'LCI', mapOwner: 'White Label', wl: true, group: 'Humic', pack: 8, packs: [8], clients: ['LCI PAKISTAN LIMITED'], packsBy: { 'LCI PAKISTAN LIMITED': [8] }, active: true, seeded: true },
        { brand: 'Ferti Huma Pellets', base: 'Potassium Humate', generic: '', form: 'Powder', owner: 'White Label', mapOwner: 'White Label', wl: true, group: null, pack: 1, packs: [1], clients: [], packsBy: {}, mapOnly: true, active: true, seeded: true },
        { brand: 'Ferti Huma Super', base: 'Potassium Humate Liquid', generic: 'K-Humate Liquid', form: 'Liquid', owner: 'Vital Agri', mapOwner: 'White Label', wl: true, group: 'Liquid', pack: 4, packs: [4], clients: ['LCI PAKISTAN LIMITED'], packsBy: { 'LCI PAKISTAN LIMITED': [4] }, active: true, seeded: true },
        { brand: 'Ferti huma Super', base: 'Potassium Humate Liquid', generic: '', form: 'Powder', owner: 'White Label', mapOwner: 'White Label', wl: true, group: null, pack: 1, packs: [1], clients: [], packsBy: {}, mapOnly: true, active: true, seeded: true }
      ],
      groupOfBrand: { 'V-Germinator Pro': 'Liquid', 'V Germinator Pro': 'Liquid', 'Cal-Mag V': 'Liquid', 'Cala Mag V': 'Liquid', 'V-Mag Essential': 'Crystalline', 'ProMix Liquid': 'Liquid', 'Ferti Huma Pellet': 'Humic', 'Ferti Huma Super': 'Liquid', 'Pro Mix Liquid': null },
      labTemplates: { 'V Germinator Pro': [{ g: 'Chemical', test: 'P2O5', spec: '27%', method: 'x', mu: '%' }], 'Nitro Germinator Pro': [{ g: 'Chemical', test: 'N', spec: '1', method: 'x', mu: '%' }] },
      recipes: { 'Cala Mag V': { 'Boric Acid': 0.0393 } }
    },
    /* the old spellings sit on real records: they must not be rewritten */
    orders: [{ po: 'RUDP1026', client: 'RUDOLF LIFE SCIENCES', lines: [{ brand: 'V Germinator Pro', base: 'Liquid Phosphrous', ordered: 5000 }] }],
    batches: [{ id: 'B3526-vat2', lots: [{ coa: { item: 'V Germinator Pro', batchNo: 'VG26001-L1' } }] }],
    shipments: [], packingLog: [{ brand: 'V Germinator Pro' }], inspections: [{ brand: 'V Germinator Pro' }], productionLog: []
  };
}

/* ---- load the real functions ---- */
const BRAND_AKA_SRC = /const BRAND_AKA=(\{[^}]*\});/.exec(html);
ok('BRAND_AKA is declared in the page', !!BRAND_AKA_SRC);
const sandbox = { logs: [], applied: 0 };
sandbox.logAction = m => sandbox.logs.push(m);
sandbox.applyCustomProducts = () => { sandbox.applied++; };
vm.createContext(sandbox);
vm.runInContext('var BRAND_AKA=' + BRAND_AKA_SRC[1] + ';\n' + grab('brandCanon') + '\n' + grab('productNamesV1'), sandbox);

/* ---- 1. brandCanon ---- */
eq('brandCanon: V Germinator Pro -> V-Germinator Pro', vm.runInContext("brandCanon('V Germinator Pro')", sandbox), 'V-Germinator Pro');
eq('brandCanon: Cala Mag V -> Cal-Mag V', vm.runInContext("brandCanon('Cala Mag V')", sandbox), 'Cal-Mag V');
eq('brandCanon: V-Mag Essential -> V-Mg Essential', vm.runInContext("brandCanon('V-Mag Essential')", sandbox), 'V-Mg Essential');
eq('brandCanon: a correct name is unchanged', vm.runInContext("brandCanon('V-Germinator Pro')", sandbox), 'V-Germinator Pro');
eq('brandCanon: an unknown name is unchanged', vm.runInContext("brandCanon('Enrich')", sandbox), 'Enrich');
eq('brandCanon: constructor/toString are not aliases', vm.runInContext("brandCanon('constructor')", sandbox), 'constructor');
eq('brandCanon: nothing stays nothing', vm.runInContext("brandCanon(undefined)", sandbox), undefined);

/* ---- 2. the migration on the live-shaped list ---- */
const s = fixture(); const recordsBefore = cp({ o: s.orders, b: s.batches, p: s.packingLog, i: s.inspections, sh: s.shipments });
sandbox.productNamesV1(s);
const P = n => s.masters.products.find(p => p.brand === n);
const M = s.masters;

ok('V-Germinator Pro now sells to LCI and Rudolf as well as BKK, Dealers, VAN, Vgreen', ['BKK', 'Dealers', 'VITAL AGRI NUTRIENTS (PVT) LTD', 'Vgreen', 'LCI PAKISTAN LIMITED', 'RUDOLF LIFE SCIENCES'].every(c => P('V-Germinator Pro').clients.indexOf(c) > -1));
eq('V-Germinator Pro keeps its own 5 Kg first, adds 1000', P('V-Germinator Pro').packs.join(','), '5,1000');
eq('V-Germinator Pro: Rudolf buys 1000, as before', P('V-Germinator Pro').packsBy['RUDOLF LIFE SCIENCES'].join(','), '1000');
eq('V-Germinator Pro keeps its own specification', P('V-Germinator Pro').generic, 'P 27% + N 1% + K 6%');
eq('V-Germinator Pro stays active', P('V-Germinator Pro').active, true);
eq('V Germinator Pro is retired, not deleted', P('V Germinator Pro').active, false);
eq('V Germinator Pro is marked as the same product as V-Germinator Pro', P('V Germinator Pro').aka, 'V-Germinator Pro');
eq('the lab template moved to V-Germinator Pro', (M.labTemplates['V-Germinator Pro'] || []).length, 1);
ok('the old template key is gone so the lab sees one product', !('V Germinator Pro' in M.labTemplates));
ok('Nitro Germinator Pro is a different product and is left alone', !!M.labTemplates['Nitro Germinator Pro']);

ok('Cal-Mag V now sells to LCI and Rudolf as well', ['LCI PAKISTAN LIMITED', 'RUDOLF LIFE SCIENCES'].every(c => P('Cal-Mag V').clients.indexOf(c) > -1));
eq('Cal-Mag V packs 1 and 1000', P('Cal-Mag V').packs.join(','), '1,1000');
eq('Cala Mag V is retired and marked as Cal-Mag V', P('Cala Mag V').aka + '/' + P('Cala Mag V').active, 'Cal-Mag V/false');
ok('the recipe stays where it is (Cal-Mag V reads it through RECIPE_ALIAS)', !!M.recipes['Cala Mag V']);

eq('V-Mg Essential takes the crystal form', P('V-Mg Essential').form, 'Crystal');
eq('V-Mg Essential takes MgSO4 - 10%', P('V-Mg Essential').generic, 'MgSO4 - 10%');
eq('V-Mg Essential takes the 5 Kg pack', P('V-Mg Essential').pack, 5);
ok('V-Mg Essential is no longer an empty placeholder', P('V-Mg Essential').mapOnly === undefined && P('V-Mg Essential').clients.length === 3);
eq('V-Mg Essential group is Crystalline', M.groupOfBrand['V-Mg Essential'], 'Crystalline');
ok('V-Mag Essential is gone from the list and the group table', !P('V-Mag Essential') && !('V-Mag Essential' in M.groupOfBrand));

['Pro Mix Liquid', 'Ferti Huma Pellets', 'Ferti huma Super', 'V-Germonator Pro'].forEach(n => ok(n + ' (empty placeholder) is removed', !P(n)));
ok('ProMix Liquid, Ferti Huma Pellet, Ferti Huma Super are kept', !!P('ProMix Liquid') && !!P('Ferti Huma Pellet') && !!P('Ferti Huma Super'));
eq('13 products in; V-Mag and the 4 placeholders go; 8 are left (live: 91 become 86)', s.masters.products.length, 8);
eq('the migration is flagged once', !!M._namesV1, true);
ok('it was logged, and kept on the flag (logAction has no state while the app starts)', sandbox.logs.length === 1 && /Product names made one each/.test(sandbox.logs[0]) && M._namesV1.did.length === M._namesV1.n && M._namesV1.n >= 6);
ok('the tables are rebuilt after it runs', sandbox.applied === 1);

/* no record is rewritten */
eq('orders, batches, CoAs, packing and QA keep the spelling they were issued with', JSON.stringify({ o: s.orders, b: s.batches, p: s.packingLog, i: s.inspections, sh: s.shipments }), JSON.stringify(recordsBefore));

/* run twice: nothing more happens */
const again = cp(s); sandbox.logs.length = 0; sandbox.applied = 0; sandbox.productNamesV1(again);
eq('a second run changes nothing', JSON.stringify(again), JSON.stringify(s));
{ /* with the flag removed the steps themselves are safe to repeat */
  const t = cp(s); delete t.masters._namesV1; sandbox.productNamesV1(t); delete t.masters._namesV1; delete s.masters._namesV1;
  const a = cp(t); delete a.masters._namesV1; const b = cp(s); delete b.masters._namesV1;
  eq('the steps themselves are idempotent (run again without the flag)', JSON.stringify(a.masters.products), JSON.stringify(b.masters.products));
  s.masters._namesV1 = cp(again.masters._namesV1); sandbox.logs.length = 0; sandbox.applied = 0; }
ok('and logs nothing', sandbox.logs.length === 0 && sandbox.applied === 0);

/* a placeholder that a record uses is retired, not deleted */
{
  const t = fixture(); t.orders.push({ po: 'X', lines: [{ brand: 'Pro Mix Liquid', base: 'NPK 8.8.6' }] });
  sandbox.productNamesV1(t);
  const q = t.masters.products.find(p => p.brand === 'Pro Mix Liquid');
  ok('Pro Mix Liquid used by an order line is kept, inactive and marked', !!q && q.active === false && q.aka === 'ProMix Liquid');
  ok('the other placeholders are still removed', !t.masters.products.find(p => p.brand === 'Ferti huma Super'));
}
/* a placeholder used only by a FOC sample (a record kind outside orders and batches) is kept */
{
  const t = fixture(); t.samples = [{ id: 'S1', brand: 'Ferti huma Super' }]; t.packedStock = { 'Pro Mix Liquid': 40 };
  sandbox.productNamesV1(t);
  const f = n => t.masters.products.find(p => p.brand === n);
  ok('Ferti huma Super used by a sample is retired, not removed', !!f('Ferti huma Super') && f('Ferti huma Super').active === false && f('Ferti huma Super').aka === 'Ferti Huma Super');
  ok('Pro Mix Liquid with packed stock under it is retired, not removed', !!f('Pro Mix Liquid') && f('Pro Mix Liquid').active === false);
}
/* V-Mag Essential used by a record the older rename does not reach is kept inactive */
{
  const t = fixture(); t.samples = [{ id: 'S1', brand: 'V-Mag Essential' }];
  sandbox.productNamesV1(t);
  const q = t.masters.products.find(p => p.brand === 'V-Mag Essential');
  ok('V-Mag Essential used by a sample is kept, inactive, marked V-Mg Essential', !!q && q.active === false && q.aka === 'V-Mg Essential');
  eq('and V-Mg Essential still took the specification', t.masters.products.find(p => p.brand === 'V-Mg Essential').generic, 'MgSO4 - 10%');
}
/* V-Mg Essential that already has its own specification is not overwritten */
{
  const t = fixture(); const v = t.masters.products.find(p => p.brand === 'V-Mg Essential'); v.generic = 'own spec'; v.clients = ['BKK']; delete v.mapOnly;
  sandbox.productNamesV1(t);
  eq('an existing V-Mg Essential specification is left alone', t.masters.products.find(p => p.brand === 'V-Mg Essential').generic, 'own spec');
  ok('and V-Mag Essential is left as it is', !!t.masters.products.find(p => p.brand === 'V-Mag Essential'));
}
/* both lab templates present: the correct name wins, the old one is not lost */
{
  const t = fixture(); t.masters.labTemplates['V-Germinator Pro'] = [{ g: 'Chemical', test: 'own', spec: '1', method: 'x', mu: '%' }];
  sandbox.productNamesV1(t);
  eq('the correct name keeps its own template', t.masters.labTemplates['V-Germinator Pro'][0].test, 'own');
  ok('the old key is not deleted when both exist', !!t.masters.labTemplates['V Germinator Pro']);
}
/* a placeholder that has a client is not "empty" */
{
  const t = fixture(); t.masters.products.find(p => p.brand === 'Ferti huma Super').clients = ['LCI PAKISTAN LIMITED'];
  sandbox.productNamesV1(t);
  ok('a placeholder with a client is retired, not removed', (t.masters.products.find(p => p.brand === 'Ferti huma Super') || {}).active === false);
}
/* only one side present: no crash, no change to the other */
{
  const t = fixture(); t.masters.products = t.masters.products.filter(p => p.brand !== 'Cala Mag V');
  sandbox.productNamesV1(t);
  eq('Cal-Mag V is left alone when Cala Mag V is not in the list', t.masters.products.find(p => p.brand === 'Cal-Mag V').clients.length, 3);
}
/* no master list yet, no state */
{ sandbox.productNamesV1({ masters: {} }); sandbox.productNamesV1(null); sandbox.productNamesV1({}); ok('no product list, no state: no crash', true); }
/* the merged side's Packs By never overwrite the correct name's own */
{
  const t = fixture(); t.masters.products.find(p => p.brand === 'V Germinator Pro').packsBy.BKK = [99];
  sandbox.productNamesV1(t);
  eq('the correct name wins where both name the same client', t.masters.products.find(p => p.brand === 'V-Germinator Pro').packsBy.BKK.join(','), '5');
}

/* ---- 3. the pick lists after the tables are rebuilt (real applyProductsV1) ---- */
{
  const sb = { BULK_BASES: [], SEED: { catalog: { brandsByClient: {}, clients: [] }, brandMap: {} } };
  vm.createContext(sb); vm.runInContext(grab('applyProductsV1'), sb);
  sb.applyProductsV1(s);
  const bbc = sb.SEED.catalog.brandsByClient, bm = sb.SEED.brandMap;
  const brandsFor = c => (bbc[c] || []).map(x => x.brand);
  ok('Rudolf is offered V-Germinator Pro and Cal-Mag V', brandsFor('RUDOLF LIFE SCIENCES').indexOf('V-Germinator Pro') > -1 && brandsFor('RUDOLF LIFE SCIENCES').indexOf('Cal-Mag V') > -1);
  ok('Rudolf is no longer offered the retired spellings', brandsFor('RUDOLF LIFE SCIENCES').indexOf('V Germinator Pro') < 0 && brandsFor('RUDOLF LIFE SCIENCES').indexOf('Cala Mag V') < 0);
  ok('LCI is offered V-Germinator Pro, not V Germinator Pro', brandsFor('LCI PAKISTAN LIMITED').indexOf('V-Germinator Pro') > -1 && brandsFor('LCI PAKISTAN LIMITED').indexOf('V Germinator Pro') < 0);
  eq('Rudolf buys V-Germinator Pro in 1000', (bbc['RUDOLF LIFE SCIENCES'].find(x => x.brand === 'V-Germinator Pro') || {}).pack, 1000);
  ok('an OLD Rudolf order line (V Germinator Pro) still finds its base in the brand map', bm['V Germinator Pro'] && bm['V Germinator Pro'].base === 'Liquid Phosphrous');
  ok('an OLD Cala Mag V line still finds its base in the brand map', bm['Cala Mag V'] && bm['Cala Mag V'].base === 'Cala Mag V');
  ok('the old spellings keep their White Label owner in the brand map, as before', bm['V Germinator Pro'].owner === 'White Label');
  ok('the removed placeholders are not in the brand map', !bm['Pro Mix Liquid'] && !bm['V-Germonator Pro'] && !bm['Ferti Huma Pellets']);
  ok('V-Mg Essential is offered to BKK in 5 Kg', ((bbc.BKK || []).find(x => x.brand === 'V-Mg Essential') || {}).pack === 5);
  eq('V-Mg Essential group reaches the group table', s.masters.groupOfBrand['V-Mg Essential'], 'Crystalline');
}

/* ---- 4. the lab finds a template under either spelling ---- */
{
  const sb = { state: { masters: { labTemplates: cp(s.masters.labTemplates) } }, brandCanon: sandbox.brandCanon, autoTemplateFor: () => [] };
  vm.createContext(sb); vm.runInContext(grab('coaItemOf') + '\n' + grab('coaTemplate'), sb);
  const old = sb.coaTemplate({ kind: 'po', brand: 'V Germinator Pro', base: 'Liquid Phosphrous' });
  const cur = sb.coaTemplate({ kind: 'po', brand: 'V-Germinator Pro', base: 'Liquid Phosphrous' });
  eq('a batch under the OLD spelling finds the V-Germinator Pro template', old.length, 1);
  eq('a batch under the correct spelling finds it too', cur.length, 1);
  { const both = { 'V-Germinator Pro': [{ test: 'new' }], 'V Germinator Pro': [{ test: 'old' }] };
    const sb2 = { state: { masters: { labTemplates: both } }, brandCanon: sandbox.brandCanon, autoTemplateFor: () => [] };
    vm.createContext(sb2); vm.runInContext(grab('coaItemOf') + '\n' + grab('coaTemplate'), sb2);
    eq('a batch under the old spelling reads the correct name first', sb2.coaTemplate({ kind: 'po', brand: 'V Germinator Pro', base: 'Liquid Phosphrous' })[0].test, 'new'); }
  eq('an unrelated product still gets its own (empty) answer', sb.coaTemplate({ kind: 'po', brand: 'Enrich', base: 'Potassium Humate' }).length, 0);
}
ok('the lab saves a template under the correct name', /labTemplates\[brandCanon\(coaForm\.item\)\]=/.test(html));

/* ---- 5. the Product list screen refuses a second spelling ---- */
{
  const i = html.indexOf('function pmSave(){'); const body = html.slice(i, html.indexOf('function pmDel(', i));
  ok('Add product refuses a retired spelling (brandCanon)', /var _cn=brandCanon\(brand\);[\s\S]*if\(_cn!==brand&&f\.editing!==brand\)/.test(body));
  ok('Add product refuses the same name with only spaces, dashes or underscores different', /replace\(\/\[\\s\\-_\]\+\/g,''\)/.test(body) && /_nk\(p\.brand\)===_nk\(brand\)/.test(body));
  ok('...and only against products that are still active', /p\.active!==false&&_nk\(p\.brand\)/.test(body));
  ok('...and not against the product being edited', /p\.brand!==f\.editing&&p\.active!==false/.test(body));
  /* the guard itself: the REAL source between its two markers, run on its own */
  const a = body.indexOf('/* 27b: stop a second spelling'), z = body.indexOf('var base=f.ownBase');
  ok('the guard block was found in pmSave', a > 0 && z > a);
  const guardSrc = body.slice(a, z);
  const guard = new Function('brandCanon', 'BRAND_AKA', 'customProducts', 'f', 'brand', 'toast', guardSrc + '\nreturn true;');
  const AKA = vm.runInContext('BRAND_AKA', sandbox);
  const cpf = () => s.masters.products;
  const run = (brand, editing) => { const t = []; const r = guard(sandbox.brandCanon, AKA, cpf, { editing }, brand, m => t.push(m)); return { r, t: t.join('') }; };
  ok('typing V Germinator Pro is refused, pointing at V-Germinator Pro', /another spelling of "V-Germinator Pro"/.test(run('V Germinator Pro').t) && run('V Germinator Pro').r === undefined);
  ok('typing Cala-Mag V (a punctuation variant of a retired spelling) is refused', /another spelling of "Cal-Mag V"/.test(run('Cala-Mag V').t));
  ok('typing V Mag Essential is refused', /another spelling of "V-Mg Essential"/.test(run('V Mag Essential').t));
  ok('typing promix liquid in other capitals is refused', /(another spelling of|same name as) "ProMix Liquid"/.test(run('promix liquid').t));
  ok('typing Pro-Mix Liquid is refused', /(another spelling of|same name as) "ProMix Liquid"/.test(run('Pro-Mix Liquid').t));
  eq('a genuinely new name passes', run('Brand New Product').r, true);
  eq('Max Zinc 21% is not mistaken for Max Zinc', run('Max Zinc 21%').r, true);
  eq('NP 6.32 is not mistaken for NP 63.2', (() => { const x = cp(s); x.masters.products.push({ brand: 'NP 6.32', active: true }); const g = (b) => { const t = []; const r = guard(sandbox.brandCanon, AKA, () => x.masters.products, { editing: '' }, b, m => t.push(m)); return r; }; return g('NP 63.2'); })(), true);
  eq('editing a product under its own name passes', run('ProMix Liquid', 'ProMix Liquid').r, true);
  ok('editing a retired spelling is refused', /Edit "V-Germinator Pro" instead/.test((() => { const x = cp(s); const g = (b, ed) => { const t = []; guard(sandbox.brandCanon, AKA, () => x.masters.products, { editing: ed }, b, m => t.push(m)); return t.join(''); }; return g('V Germinator Pro', 'V Germinator Pro'); })()));
}
/* a retired spelling cannot be switched back on; a lab template is not started under it */
{ const src = grab('pmToggle');
  const toasts = []; let applied = 0;
  const f = new Function('pmCanEdit', 'customProducts', 'toast', 'applyCustomProducts', 'state', 'logAction', 'save', 'render', src + '\nreturn pmToggle;')(() => true, () => s.masters.products, m => toasts.push(m), () => { applied++; }, {}, () => {}, () => {}, () => {});
  const idx = s.masters.products.findIndex(p => p.brand === 'V Germinator Pro');
  f(idx);
  ok('Reactivate on a retired spelling is refused', /another spelling of "V-Germinator Pro"/.test(toasts.join('')) && s.masters.products[idx].active === false && applied === 0);
  const idx2 = s.masters.products.findIndex(p => p.brand === 'ProMix Liquid');
  s.masters.products[idx2].active = false; f(idx2);
  ok('Reactivate on an ordinary product still works', s.masters.products[idx2].active === true && applied === 1); }
ok('a new lab template name is turned into the correct spelling', /const nm=brandCanon\(n\.trim\(\)\)/.test(grab('labTplNewProduct')));

/* ---- 5b. the places that read a product by its spelling ---- */
{ const sb = { SEED: { catalog: { brandsByClient: { 'RUDOLF LIFE SCIENCES': [{ brand: 'V-Germinator Pro', base: 'Liquid Phosphrous', pack: 1000, form: 'Liquid', generic: 'g' }] } } }, brandCanon: sandbox.brandCanon };
  vm.createContext(sb); vm.runInContext(grab('coaGenericOf') + '\n' + grab('seedPackForBrand'), sb);
  eq('the CoA generic is found for a batch under the retired spelling', (sb.coaGenericOf('V Germinator Pro') || {}).brand, 'V-Germinator Pro');
  eq('the seed pack is found for a line under the retired spelling', sb.seedPackForBrand('V Germinator Pro'), 1000);
  eq('an unrelated brand still has no seed pack', sb.seedPackForBrand('Enrich'), 0); }
{ const st = { orders: [{ received: '2026-10-01', lines: [{ brand: 'V Germinator Pro', printPrice: 450 }] }, { received: '2026-09-01', lines: [{ brand: 'V-Germinator Pro', printPrice: 400 }] }], packingLog: [] };
  const sb = { state: st, brandCanon: sandbox.brandCanon }; vm.createContext(sb); vm.runInContext(grab('recallPrintPrice'), sb);
  eq('the printed price recalled for V-Germinator Pro counts the older V Germinator Pro orders', sb.recallPrintPrice('V-Germinator Pro'), 450);
  eq('and the other way round', sb.recallPrintPrice('V Germinator Pro'), 450); }
{ const st = { orders: [{ po: 'A', lines: [{ brand: 'V Germinator Pro', ordered: 100, packed: 0 }] }, { po: 'B', lines: [{ brand: 'V-Germinator Pro', ordered: 100, packed: 0 }, { brand: 'Enrich', ordered: 5, packed: 0 }] }] };
  const sb = { state: st, brandCanon: sandbox.brandCanon, lineShortClosed: () => false, stageOf: () => 'Packing' }; vm.createContext(sb); vm.runInContext(grab('poLinesForBrand'), sb);
  eq('Pack lists the open lines of both spellings of one product', sb.poLinesForBrand('V-Germinator Pro').map(x => x.o.po).join(','), 'A,B');
  eq('and not another product', sb.poLinesForBrand('Enrich').length, 1); }

/* ---- 6. the screen, the load order, the Guide and the change log ---- */
ok('the product list marks a retired spelling as the same product as the correct one', /same product as '\+esc\(p\.aka\)/.test(html));
ok('the migration runs in the load chain, after migrateBrandNames and before the recipes', /migrateBrandNames\(s\); productNamesV1\(s\); (productGenericV1\(s\); )?(dataFix27dV1\(s\); )?(cooUnlockV1\(s\); )?loadBaseRecipesV2\(s\);/.test(html));
ok('the migration does not touch BRAND_ALIAS (which rewrites records)', !/BRAND_ALIAS=\{[^}]*Germinator/.test(html) && !/BRAND_ALIAS=\{[^}]*Cala Mag/.test(html));
ok('build id is 2026-10-27b or later', ((/var BUILD_ID='([^']+)'/.exec(html) || [])[1] || '') >= '2026-10-27b');   // 29 Oct: any later build
ok('change log 2026-10-27b exists', /ver:'2026-10-27b'/.test(html) && /One name for each product/.test(html));
ok('The Rules: One name for each product', /<h3>One name for each product<\/h3>/.test(grab('guideRules')));
ok('My job: a New on 27 Oct (27b) note for the COO and the Plant Manager', /var _n27b=\{'COO':[\s\S]*'Plant Manager':/.test(grab('guideMyJob')) && /New on 27 Oct \(27b\)/.test(grab('guideMyJob')));

process.exitCode = report('27b: one name for each product, old spellings kept as also known as, no record rewritten') ? 1 : 0;
