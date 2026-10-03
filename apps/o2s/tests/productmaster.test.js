/* ONE PRODUCT MASTER — R17, the night of 23 September 2026.

   Until tonight a brand lived in three places: 142 catalogue entries hard-coded
   in the file under 11 client keys, a 74-entry brand map beside it (both
   patched at load by BRANDMAP_FIX and BRAND_ALIAS), and a "custom products"
   list added through Admin. Tahir: "Yes — one product master, migrated from
   the file on first load. After this, no brand lives in code."

   migrateProductsV1 snapshots the in-memory catalogue (after the load-time
   patches) plus the custom list into state.masters.products, once, flagged.
   applyProductsV1 then REBUILDS the two in-memory tables from the master on
   every load, so the ~20 places that read SEED.catalog / SEED.brandMap keep
   working untouched. Editing the master is Back Office: COO, CFO, Plant Manager.

   Run: node productmaster.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;

const mig = grab('migrateProductsV1'), app = grab('applyProductsV1'), legacy = grab('applyCustomProducts');
ok('migrateProductsV1 exists', mig.length > 200);
ok('applyProductsV1 exists', app.length > 200);
ok('ensureMasters migrates BEFORE it applies', /migrateProductsV1\(s\);\s*applyCustomProducts\(s\);/.test(grab('ensureMasters')));
ok('applyCustomProducts hands over to the master once it exists', /Array\.isArray\(s\.masters\.products\)/.test(legacy) && /applyProductsV1\(s\)/.test(legacy));
ok('the master is edited by Back Office, not the COO alone', /hardRole\(\['COO','CFO','Plant Manager'\]\)/.test(grab('pmCanEdit')));
ok('customProducts() returns the master once migrated', /s?tate\.masters\.products/.test(grab('customProducts')));

function box() {
  const b = { console, Date, logged: [], logAction: m => b.logged.push(m),
    SEED: { catalog: {
      clients: ['ACME', 'Dealers'],
      channelByClient: { ACME: 'White Label', Dealers: 'Dealer' },
      brandsByClient: {
        ACME: [ { brand: 'Acme Zinc', base: 'Zinc 21%', generic: 'Zinc 21%', form: 'Granular', owner: 'ACME', pack: 3, packs: [3] },
                { brand: 'Acme Humic', base: 'Potassium Humate', generic: 'K-Humate 8%', form: 'Liquid', owner: 'ACME', pack: 8, packs: [8, 20] } ],
        Dealers: [ { brand: 'Vital Potash', base: 'Vital Potash', generic: 'Potash 30%', form: 'Liquid', owner: 'VAN', pack: 20, packs: [20] },
                   { brand: 'Acme Zinc', base: 'Zinc 21%', generic: 'Zinc 21%', form: 'Granular', owner: 'ACME', pack: 1, packs: [1] } ] },
    }, brandMap: { 'Acme Zinc': { base: 'Zinc 21%', owner: 'White Label' }, 'Acme Humic': { base: 'Potassium Humate', owner: 'White Label' },
                   'Vital Potash': { base: 'Vital Potash', owner: 'VAN' }, 'Map Only': { base: 'Boron 5%', owner: 'VAN' } } } };
  vm.createContext(b); vm.runInContext(mig + '\n' + app, b);
  return b;
}
{
  const b = box();
  const s = { masters: { customProducts: [ { brand: 'Custom One', base: 'Custom One', generic: 'X', form: 'Powder', clients: ['Dealers'], packs: [5], pack: 5, owner: 'VAN', wl: false } ], groupOfBrand: { 'Acme Zinc': 'Granular' } } };
  b.migrateProductsV1(s);
  const P = s.masters.products;
  ok('the master exists', Array.isArray(P));
  eq('3 catalogue brands + 1 map-only + 1 custom = 5 products', P.length, 5);
  const z = P.find(p => p.brand === 'Acme Zinc');
  eq('a brand sold to 2 clients is ONE product with 2 clients', z.clients.slice().sort().join(','), 'ACME,Dealers');
  eq('its packs are the union', z.packs.slice().sort((a, b) => a - b).join(','), '1,3');
  eq('its base comes from the map', z.base, 'Zinc 21%');
  eq('it is marked as seeded', z.seeded, true);
  eq('it carries its production group', z.group, 'Granular');
  eq('the white-label flag follows the map owner', z.wl, true);
  const m = P.find(p => p.brand === 'Map Only');
  ok('a map-only brand is kept, with no client', m && m.clients.length === 0 && m.base === 'Boron 5%');
  const c = P.find(p => p.brand === 'Custom One');
  ok('the custom product is merged, not seeded', c && c.seeded === false);
  ok('the migration is flagged with a count', s.masters._productsV1 && s.masters._productsV1.count === 5);
  ok('and logged', b.logged.some(l => /5 products/.test(l)), JSON.stringify(b.logged));
  const n = P.length; b.migrateProductsV1(s);
  eq('running it again changes nothing', s.masters.products.length, n);

  /* the rebuild reproduces the tables */
  b.SEED.catalog.brandsByClient = { ACME: [{ brand: 'STALE', base: 'x' }] }; b.SEED.brandMap = { STALE: { base: 'x' } };
  b.applyProductsV1(s);
  const bbc = b.SEED.catalog.brandsByClient, bm = b.SEED.brandMap;
  ok('stale entries are gone', !bbc.ACME.some(e => e.brand === 'STALE') && !bm.STALE);
  eq('ACME has its 2 brands again', bbc.ACME.map(e => e.brand).sort().join(','), 'Acme Humic,Acme Zinc');
  eq('Dealers has 3 (2 seeded + the custom one)', bbc.Dealers.map(e => e.brand).sort().join(','), 'Acme Zinc,Custom One,Vital Potash');
  eq('the brand map is rebuilt with base and owner', JSON.stringify(bm['Acme Zinc']), JSON.stringify({ base: 'Zinc 21%', owner: 'White Label' }));
  ok('a map-only brand is back in the map', !!bm['Map Only'] && bm['Map Only'].base === 'Boron 5%');
  ok('the custom brand is in the map, VAN-owned', bm['Custom One'] && bm['Custom One'].owner === 'VAN');
  /* an edit in the master reaches the tables */
  z.base = 'Zinc 21% (corrected)'; b.applyProductsV1(s);
  eq('a corrected base reaches the brand map', b.SEED.brandMap['Acme Zinc'].base, 'Zinc 21% (corrected)');
  eq('...and the catalogue entry', b.SEED.catalog.brandsByClient.ACME.find(e => e.brand === 'Acme Zinc').base, 'Zinc 21% (corrected)');
  z.active = false; b.applyProductsV1(s);
  ok('a deactivated product leaves the catalogue (cannot be ordered) but stays in the map (old orders still resolve)',
     !b.SEED.catalog.brandsByClient.ACME.some(e => e.brand === 'Acme Zinc') && !!b.SEED.brandMap['Acme Zinc']);
}

process.exitCode = report('One product master') ? 1 : 0;
