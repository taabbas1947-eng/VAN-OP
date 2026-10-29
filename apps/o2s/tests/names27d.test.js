/* BUILD 2026-10-27d. Tahir, 27 Oct 2026: four rulings that settle records.
   1. COBO-2608-4613 V-Transfarm: the pack of 26 Aug (PK2294-g79y) repeats the pack of 22 Aug (PK2082-vbq5).
   2. Batch BS26001 (Amino Acid) was the wrong product: its 500 Kg production row goes.
   3. The base 'Liquid Phosphrous' becomes 'Liquid Phosphorus'; the 6 ingredient recipe is kept; the unused product goes.
   4. Six old names that nothing uses leave the product list. Also: the version on the documentation card follows the build.
   The fixture is shaped like the live records read on 27 Oct 2026.
   Run: node names27d.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;
const cp = x => JSON.parse(JSON.stringify(x));
const BAD = 'Liquid Phosphr' + 'ous', GOOD = 'Liquid Phosphorus';

const sb = { logs: [], applied: 0, Math, Date, Object, JSON, Array, String };
sb.logAction = m => sb.logs.push(m);
sb.applyCustomProducts = () => { sb.applied++; };
vm.createContext(sb); vm.runInContext(grab('dataFix27dV1'), sb);

const fix = () => ({
  orders: [
    { id: 'O43_2015-f9fe', po: 'COBO-2608-4613', client: 'VITAL AGRI NUTRIENTS (PVT) LTD', lines: [
      { id: 'O43_2015-f9feL3', brand: 'V-Transfarm', base: 'Zinc 21%', ordered: 600, packed: 300, produced: 300, dispatched: 300, delivered: 300, qcPass: '2026-08-26' } ] },
    { id: 'O9', po: 'RUDP1026', client: 'RUDOLF LIFE SCIENCES', lines: [
      { id: 'O9L0', brand: 'V Germinator Pro', base: BAD, ordered: 5000, packed: 0 },
      { id: 'O9L1', brand: 'V Germinator Pro', base: BAD, ordered: 4000, packed: 640 } ] } ],
  packingLog: [
    { id: 'PK2082-vbq5', po: 'COBO-2608-4613', lid: 'O43_2015-f9feL3', brand: 'V-Transfarm', base: 'Zinc 21%', kg: 300, shipKg: 300, insKg: 300, baseBatchId: 'B1133', baseBatchNo: 'VT10450', date: '2026-08-22' },
    { id: 'PK2294-g79y', po: 'COBO-2608-4613', lid: 'O43_2015-f9feL3', brand: 'V-Transfarm', base: 'Zinc 21%', kg: 300, shipKg: 0, insKg: 300, baseBatchId: 'B1133', baseBatchNo: 'VT10450', date: '2026-08-26' },
    { id: 'PKR1', po: 'RUDP1026', lid: 'O9L1', brand: 'V Germinator Pro', base: BAD, kg: 640, shipKg: 0, insKg: 0, baseBatchId: 'B9', baseBatchNo: 'VG26002', date: '2026-09-25' } ],
  inspections: [
    { id: 'INS2092', po: 'COBO-2608-4613', lid: 'O43_2015-f9feL3', brand: 'V-Transfarm', kg: 300, pass: true, batches: [{ batch: 'VT10450', kg: 300, lotId: 'PK2082-vbq5' }] },
    { id: 'INS2303', po: 'COBO-2608-4613', lid: 'O43_2015-f9feL3', brand: 'V-Transfarm', kg: 300, pass: true, batches: [{ batch: 'VT10450', kg: 300, lotId: 'PK2294-g79y' }] } ],
  batches: [
    { id: 'B1133', batchNo: 'VT10450', base: 'Zinc 21%', kind: 'bulk', producedKg: 5000, packedKg: 4614, status: 'open', lots: [] },
    { id: 'B3826-rjou', batchNo: 'BS26001', base: 'Amino Acid', kind: 'bulk', status: 'closed', producedKg: 0, packedKg: 0, plannedKg: 500, varianceNote: 'Wrong Product was selected',
      lots: [{ id: 'LOT3829-lf70', lotNo: 'BS26001-L1', qty: 500, coa: null }] },
    { id: 'B9', batchNo: 'VG26002', base: BAD, kind: 'bulk', producedKg: 1000, packedKg: 640, status: 'open', lots: [] },
    { id: 'B10', batchNo: 'VG26004', base: BAD, kind: 'bulk', producedKg: 2500, packedKg: 0, status: 'open', lots: [] },
    { id: 'B11', batchNo: 'VG26005', base: BAD, kind: 'bulk', producedKg: 4000, packedKg: 0, status: 'open', lots: [] },
    { id: 'B3879-eyyp', batchNo: '', base: 'Nitro Sulfur', kind: 'bulk', pool: true, disposition: 'byproduct', plannedKg: 11025, producedKg: 0, status: 'open', lots: [] } ],
  productionLog: [
    { id: 'PLmui1quhjd2tqj6', date: '2026-09-26', base: 'Amino Acid', kg: 500, by: 'Production', batchNo: 'BS26001' },
    { id: 'PLlbs', date: '2026-09-28', base: 'Liquid Bio Stimulant', kg: 500, by: 'Production', batchNo: 'LBS26001' },
    { id: 'PLv1', date: '2026-09-23', base: BAD, kg: 1000, batchNo: 'VG26002' }, { id: 'PLv2', date: '2026-10-23', base: BAD, kg: 2500, batchNo: 'VG26004' }, { id: 'PLv3', date: '2026-10-26', base: BAD, kg: 4000, batchNo: 'VG26005' } ],
  shipments: [], inspectionsX: [],
  masters: {
    products: [
      { brand: 'V-Germinator Pro', base: BAD, generic: 'P 27% + N 4.5% + K 2%', active: true, clients: ['BKK'] },
      { brand: 'V Germinator Pro', base: BAD, generic: 'P 27% + N 4.5% + K 2%', active: false, aka: 'V-Germinator Pro', clients: ['RUDOLF'] },
      { brand: 'Liquid Phosphorus', base: GOOD, generic: 'P 27%', active: true, seeded: false, clients: ['VITAL AGRI NUTRIENTS (PVT) LTD', 'Vgreen', 'Dealers'], packs: [5, 8, 20], group: 'Liquid' },
      { brand: 'Ferti Huma Power', base: 'Potassium Humate', generic: '', active: true, seeded: true, mapOnly: true, clients: [], packs: [1] },
      { brand: 'Ferti Huma Granular', base: 'Potassium Humate', generic: '', active: true, seeded: true, mapOnly: true, clients: [], packs: [1] },
      { brand: 'Ferti Huma Powder', base: 'Potassium Humate', generic: '', active: true, seeded: true, mapOnly: true, clients: [], packs: [1] },
      { brand: 'Germinator Pro - Humic Pellet', base: 'Potassium Humate', generic: '', active: true, seeded: true, mapOnly: true, clients: [], packs: [1] },
      { brand: 'Humi Grow 8 Kg', base: 'Potassium Humate', generic: '', active: true, seeded: true, mapOnly: true, clients: [], packs: [1] },
      { brand: 'Max Zinc 21%', base: 'Zinc 21%', generic: '', active: true, seeded: true, mapOnly: true, clients: [], packs: [1] },
      { brand: 'Humi Grow', base: 'Potassium Humate', generic: 'H 40%', active: true, clients: ['BKK'], packs: [8] },
      { brand: 'Max Zinc', base: 'Zinc 21%', generic: 'Zinc 21% Granular', active: true, clients: ['MAXIM'], packs: [4] } ],
    recipes: {
      [BAD]: { 'Phosphoric Acid 60%': 0.6, 'Molasses': 0.15, 'Urea N-46%': 0.098, 'Magnisium Sulfate Hepta Hydrate': 0.055, 'Potassium Carbonate': 0.043, 'Ferrous Sulfate': 0.025 },
      [GOOD]: { 'Phosphoric Acid 65%': 0.4 }, 'V-Ammonium Phosphate': { MAP: 0.5 } },
    groupOfBrand: { 'Liquid Phosphorus': 'Liquid', 'V-Germinator Pro': 'Liquid' },
    labTemplates: { 'Liquid Phosphorus': [] },
    customProducts: [{ brand: 'Liquid Phosphorus', base: GOOD }, { brand: 'Some Other', base: 'X' }] },
  corrections: [], audit: [], actionLog: []
});
const sumKg = (s, lid) => s.packingLog.filter(p => p.lid === lid).reduce((a, p) => a + (+p.kg || 0), 0);

/* ---- 1. the repeated pack ---- */
{ const s = fix(); sb.dataFix27dV1(s);
  const pk = s.packingLog.find(p => p.id === 'PK2294-g79y'), twin = s.packingLog.find(p => p.id === 'PK2082-vbq5');
  ok('the repeat pack is voided, not deleted', pk && pk.void === true && pk.kg === 0 && pk.voidedKg === 300);
  eq('its clearance is taken back', pk.insKg, 0);
  ok('the first pack is untouched', twin.kg === 300 && twin.shipKg === 300 && twin.insKg === 300 && !twin.void);
  ok('its inspection INS2303 is withdrawn and stays on file', s.inspections.find(i => i.id === 'INS2303').superseded && s.inspections.find(i => i.id === 'INS2303').superseded.reason.length > 10);
  ok('the first inspection INS2092 is untouched', !s.inspections.find(i => i.id === 'INS2092').superseded);
  eq('batch VT10450 packed falls by 300 Kg', s.batches.find(b => b.id === 'B1133').packedKg, 4314);
  const l = s.orders[0].lines[0];
  ok('the packing log now adds up to the 300 the order line says is packed', l.packed === 300 && sumKg(s, l.id) === 300);
  eq('the line is no longer marked fully cleared by QA (only 300 of 600 are)', l.qcPass, '');
  eq('2 entries in the corrections register', s.corrections.length, 2);
  ok('the register names the inspection and the pack, and the reason', s.corrections.some(c => c.op === 'SUPERSEDE' && c.entityType === 'inspection' && c.entityId === 'INS2303') && s.corrections.some(c => c.op === 'VOID' && c.entityType === 'packingLot' && c.entityId === 'PK2294-g79y' && c.reasonCode === 'duplicate'));
  ok('and the audit trail', s.audit.some(a => /VOID packingLot/.test(a.field)) && s.audit.some(a => /SUPERSEDE inspection/.test(a.field))); }
{ /* guards: any difference from the record that was read and nothing is touched */
  const cases = [
    ['pack Kg differs', s => { s.packingLog[1].kg = 250; }],
    ['pack has shipped', s => { s.packingLog[1].shipKg = 50; }],
    ['inspection already withdrawn', s => { s.inspections[1].superseded = { at: 'x' }; }],
    ['pack already voided', s => { s.packingLog[1].void = true; }],
    ['pack was moved to another PO', s => { s.packingLog[1].movedOut = [{ toPo: 'X', lotId: 'Y' }]; }],
    ['the first pack is gone', s => { s.packingLog.splice(0, 1); }],
    ['inspection covers another lot', s => { s.inspections[1].batches[0].lotId = 'PK2082-vbq5'; }],
    ['a truck holds the pack', s => { s.shipments.push({ id: 'S1', batches: [{ lotId: 'PK2294-g79y', kg: 300 }] }); }] ];
  cases.forEach(c => { const s = fix(); c[1](s); const before = cp(s.batches.find(b => b.id === 'B1133')); sb.dataFix27dV1(s);
    ok('guard: ' + c[0] + ' -> nothing is written, the batch is left alone', s.corrections.length === 0 && !(s.inspections[1].superseded && s.inspections[1].superseded.by) && s.batches.find(b => b.id === 'B1133').packedKg === before.packedKg && s.packingLog.every(p => !p.voidedKg)); }); }

/* ---- 2. the wrong-product batch ---- */
{ const s = fix(); const aug = s.productionLog.reduce((a, p) => a + p.kg, 0); sb.dataFix27dV1(s);
  ok('the 500 Kg Amino Acid row is gone', !s.productionLog.some(p => p.id === 'PLmui1quhjd2tqj6'));
  ok('the LBS26001 row (the right product) stays', s.productionLog.some(p => p.id === 'PLlbs' && p.kg === 500));
  eq('production total falls by exactly 500 Kg', aug - s.productionLog.reduce((a, p) => a + p.kg, 0), 500);
  const b = s.batches.find(x => x.batchNo === 'BS26001');
  ok('the batch stays closed with its note and its figures', b.status === 'closed' && b.varianceNote === 'Wrong Product was selected' && b.producedKg === 0);
  eq('its uncertified lot goes with the row', b.lots.length, 0);
  ok('audit line written (no register entry for a row)', s.audit.some(a => /REMOVE productionRow/.test(a.field)) && !s.corrections.some(c => c.entityType === 'productionRow')); }
{ const s = fix(); s.batches[1].lots[0].coa = { status: 'approved' }; sb.dataFix27dV1(s);   /* the app's own Remove production entry refuses this; so does the migration */
  ok('guard: a certified 500 Kg lot -> the row and the lot both stay', s.batches[1].lots.length === 1 && s.productionLog.some(p => p.id === 'PLmui1quhjd2tqj6'));
  ok('and the skip is on the record', s.masters._fix27d.skipped.some(x => /BS26001/.test(x))); }
{ const s = fix(); s.productionLog[0].po = 'COBO-2608-4613'; sb.dataFix27dV1(s);   /* a row with an order would also lower that order line */
  ok('guard: a row that belongs to an order -> row and lot stay', s.productionLog.some(p => p.id === 'PLmui1quhjd2tqj6') && s.batches[1].lots.length === 1 && s.masters._fix27d.skipped.some(x => /BS26001/.test(x))); }
{ const s = fix(); s.batches[1].status = 'open'; sb.dataFix27dV1(s); ok('guard: batch not closed -> row kept', s.productionLog.some(p => p.id === 'PLmui1quhjd2tqj6')); }
{ const s = fix(); s.productionLog[0].kg = 400; sb.dataFix27dV1(s); ok('guard: row Kg differs -> row kept', s.productionLog.some(p => p.id === 'PLmui1quhjd2tqj6')); }

/* ---- 3. the phosphorus spelling ---- */
{ const s = fix(); sb.dataFix27dV1(s); const J = JSON.stringify(s.orders) + JSON.stringify(s.packingLog) + JSON.stringify(s.batches) + JSON.stringify(s.productionLog) + JSON.stringify(s.masters.products);
  ok('the old spelling is gone from orders, packs, batches, production and products', J.indexOf(BAD) < 0);
  eq('all 11 records carry the new spelling', (J.match(/"base":"Liquid Phosphorus"/g) || []).length, 11);   /* 2 lines + 1 pack + 3 batches + 3 rows + 2 products */
  ok('the 6 ingredient recipe now stands under the right spelling', Object.keys(s.masters.recipes[GOOD]).length === 6 && s.masters.recipes[GOOD]['Phosphoric Acid 60%'] === 0.6 && !s.masters.recipes[BAD]);
  ok('the other recipe is untouched', s.masters.recipes['V-Ammonium Phosphate'].MAP === 0.5);
  ok('the unused product Liquid Phosphorus is removed', !s.masters.products.some(p => p.brand === GOOD));
  ok('and its group entry and custom entry', s.masters.groupOfBrand[GOOD] === undefined && !s.masters.customProducts.some(c => c.brand === GOOD) && s.masters.customProducts.some(c => c.brand === 'Some Other'));
  ok('both V-Germinator Pro entries still point at the base', s.masters.products.filter(p => /Germinator Pro$/.test(p.brand)).every(p => p.base === GOOD));
  ok('no order line lost its brand', s.orders[1].lines.every(l => l.brand === 'V Germinator Pro')); }
{ /* a recipe someone typed since is never overwritten */
  const s = fix(); s.masters.recipes[GOOD] = { 'Phosphoric Acid 65%': 0.5 }; sb.dataFix27dV1(s);
  eq('a changed recipe under the right spelling is kept', s.masters.recipes[GOOD]['Phosphoric Acid 65%'], 0.5);
  ok('and the 6 ingredient recipe is not lost', !!s.masters.recipes[BAD]);
  ok('and the skip is on the record', s.masters._fix27d.skipped.some(x => /Recipe/.test(x))); }
{ const s = fix(); s.masters.recipes[GOOD] = cp(s.masters.recipes[BAD]); sb.dataFix27dV1(s);   /* a restored old snapshot: the seed already put the same recipe under the new key */
  ok('the same recipe under both spellings -> one is left, under the right one', !s.masters.recipes[BAD] && Object.keys(s.masters.recipes[GOOD]).length === 6 && s.masters._fix27d.skipped.length === 0); }
{ /* the product is used by a record -> made inactive, not removed */
  const s = fix(); s.orders[0].lines.push({ id: 'X', brand: GOOD, base: GOOD, ordered: 10 }); sb.dataFix27dV1(s);
  const p = s.masters.products.find(x => x.brand === GOOD);
  ok('a used Liquid Phosphorus is retired, not removed', p && p.active === false); }

/* ---- 4. the six names ---- */
{ const s = fix(); sb.dataFix27dV1(s); const left = s.masters.products.map(p => p.brand);
  ['Ferti Huma Power', 'Ferti Huma Granular', 'Ferti Huma Powder', 'Germinator Pro - Humic Pellet', 'Humi Grow 8 Kg', 'Max Zinc 21%'].forEach(n => ok(n + ' is removed', left.indexOf(n) < 0));
  ok('the real products next to them stay', left.indexOf('Humi Grow') > -1 && left.indexOf('Max Zinc') > -1 && left.indexOf('V-Germinator Pro') > -1);
  eq('products left: 4 of 11', left.length, 4); }
{ const s = fix(); s.shipments.push({ id: 'S', brand: 'Max Zinc 21%' }); sb.dataFix27dV1(s);
  const p = s.masters.products.find(x => x.brand === 'Max Zinc 21%'); ok('a name a record uses is retired, not removed', p && p.active === false); }
{ const s = fix(); s.masters.products.find(p => p.brand === 'Humi Grow 8 Kg').clients = ['BKK']; sb.dataFix27dV1(s);
  ok('a name that has a client is kept', s.masters.products.some(p => p.brand === 'Humi Grow 8 Kg'));
  ok('and the skip is on the record', s.masters._fix27d.skipped.some(x => /Humi Grow 8 Kg/.test(x))); }

/* ---- the independent review of 27d: lab tests, the wider rename, the guards, a real rebuild ---- */
{ const s = fix(); sb.dataFix27dV1(s);
  ok('the empty Liquid Phosphorus lab list is gone', !(GOOD in s.masters.labTemplates)); }
{ /* what the empty list did: coaTemplate stops at an empty list and never reaches the automatic tests */
  const cs = { state: null, brandCanon: x => x, coaItemOf: b => b.base || b.brand || '', autoTemplateFor: () => [{ test: 'auto' }] };
  vm.createContext(cs); vm.runInContext(grab('coaTemplate'), cs);
  const b = { kind: 'bulk', base: GOOD, brand: '' };
  const raw = fix(); raw.masters.labTemplates = { [GOOD]: [] }; cs.state = raw;
  eq('a lab list with no tests no longer hides the automatic tests (a product save leaves one behind)', cs.coaTemplate(b).length, 1);
  const s = fix(); sb.dataFix27dV1(s); cs.state = s;
  eq('after the migration the COA for the base gets the automatic tests', cs.coaTemplate(b).length, 1);
  cs.state = { masters: { labTemplates: { [GOOD]: [{ test: 'Density' }, { test: 'pH' }] } } };
  eq('a real lab list still wins over the automatic tests', cs.coaTemplate(b).length, 2);
  cs.state = { masters: { labTemplates: { 'V-Germinator Pro': [], [GOOD]: [{ test: 'Density' }] } } };
  eq('an empty list under the brand falls through to the real list under the base', cs.coaTemplate({ kind: 'po', brand: 'V-Germinator Pro', base: GOOD }).length, 1); }
{ const s = fix(); s.masters.labTemplates = { [BAD]: [{ test: 'pH' }] }; sb.dataFix27dV1(s);
  ok('a lab list under the old spelling moves to the new one', s.masters.labTemplates[GOOD] && s.masters.labTemplates[GOOD].length === 1 && !(BAD in s.masters.labTemplates)); }
{ const s = fix(); s.masters.labTemplates = { [BAD]: [{ test: 'pH' }], [GOOD]: [{ test: 'Density' }] }; sb.dataFix27dV1(s);
  ok('two different lab lists: both kept, the skip recorded', s.masters.labTemplates[BAD].length === 1 && s.masters.labTemplates[GOOD][0].test === 'Density' && s.masters._fix27d.skipped.some(x => /Lab tests/.test(x))); }
{ const s = fix(); s.masters.labTemplates = { [GOOD]: [{ test: 'Density' }] }; sb.dataFix27dV1(s);
  ok('a real lab list under the right spelling is never touched', s.masters.labTemplates[GOOD].length === 1); }
{ /* the base spelling outside the four tables: product catBase, recycled-from, requests; history is left as written */
  const s = fix(); s.masters.products[0].catBase = BAD; s.batches[3].recycledFrom = [{ base: BAD, kg: 5 }]; s.prs = [{ id: 'PR1', items: [{ base: BAD, qty: 1 }] }]; s.audit = [{ brand: BAD }]; s.masters.products[1].settled = { kept: BAD };
  sb.dataFix27dV1(s); const J = JSON.stringify([s.orders, s.packingLog, s.batches, s.productionLog, s.prs, s.masters.products.map(p => { const q = cp(p); delete q.settled; return q; }), s.masters.recipes, s.masters.labTemplates]);
  ok('no copy of the old spelling is left in the live records, product catBase included', J.indexOf(BAD) < 0 && s.masters.products[0].catBase === GOOD && s.batches[3].recycledFrom[0].base === GOOD && s.prs[0].items[0].base === GOOD);
  ok('history keeps what was written then: audit and the 24 Sep settled note', s.audit.some(a => a.brand === BAD) && s.masters.products[1].settled.kept === BAD); }
{ const s = fix(); s.orders[0].lines[0].qcPass = '2026-08-26'; s.packingLog.push({ id: 'PKX', po: 'COBO-2608-4613', lid: 'O43_2015-f9feL3', brand: 'V-Transfarm', base: 'Zinc 21%', kg: 0, reversed: true, insKg: 300 }); sb.dataFix27dV1(s);
  eq('a reversed pack does not count as cleared Kg', s.orders[0].lines[0].qcPass, ''); }
{ const s = fix(); s.packingLog.push({ id: 'PKY', po: 'COBO-2608-4613', lid: 'O43_2015-f9feL3', brand: 'V-Transfarm', base: 'Zinc 21%', kg: 300, shipKg: 0, insKg: 300 }); sb.dataFix27dV1(s);
  eq('a real pack that is cleared keeps the line cleared (600 of 600)', s.orders[0].lines[0].qcPass, '2026-08-26'); }
{ const s = fix(); s.packingLog[1].kg = 250; sb.dataFix27dV1(s);
  ok('a pack that no longer matches: the skip is on the record', s.masters._fix27d.skipped.some(x => /PK2294-g79y/.test(x))); }
{ /* the real rebuild of the product tables from the master: removed names do not come back */
  const ap = { SEED: { catalog: {} }, BULK_BASES: [] }; vm.createContext(ap); vm.runInContext(grab('applyProductsV1'), ap);
  const s = fix(); sb.dataFix27dV1(s); ap.applyProductsV1(s);
  const gone = [GOOD, 'Ferti Huma Power', 'Ferti Huma Granular', 'Ferti Huma Powder', 'Germinator Pro - Humic Pellet', 'Humi Grow 8 Kg', 'Max Zinc 21%'];
  const inCat = Object.keys(ap.SEED.catalog.brandsByClient).reduce((a, k) => a.concat(ap.SEED.catalog.brandsByClient[k].map(x => x.brand)), []);
  ok('the rebuilt catalogue and brand map carry none of the 7 removed names', gone.every(n => inCat.indexOf(n) < 0 && ap.SEED.brandMap[n] === undefined));
  ok('and V-Germinator Pro is there with the right base', ap.SEED.brandMap['V-Germinator Pro'] && ap.SEED.brandMap['V-Germinator Pro'].base === GOOD); }

{ /* the history and the people are never rewritten */
  const s = fix(); s.actionLog = [{ base: BAD }]; s.users = [{ name: 'x', base: BAD }]; s.corrections = [{ id: 'C0', base: BAD }]; sb.dataFix27dV1(s);
  ok('actionLog, users and corrections keep what was written', s.actionLog[0].base === BAD && s.users[0].base === BAD && s.corrections.some(c => c.id === 'C0' && c.base === BAD)); }
{ const s = fix(); s.masters.labTemplates = { [BAD]: [{ test: 'pH' }], [GOOD]: [{ test: 'pH' }] }; sb.dataFix27dV1(s);
  ok('the same lab list under both spellings -> one is left', !(BAD in s.masters.labTemplates) && s.masters.labTemplates[GOOD].length === 1 && s.masters._fix27d.skipped.length === 0); }
{ const s = fix(); s.masters.labTemplates = { [BAD]: [], [GOOD]: [{ test: 'Density' }] }; sb.dataFix27dV1(s);
  ok('an empty old lab list beside a real one is dropped without a skip', !(BAD in s.masters.labTemplates) && s.masters.labTemplates[GOOD][0].test === 'Density' && s.masters._fix27d.skipped.length === 0); }
{ const s = fix(); s.masters.labTemplates['Max Zinc 21%'] = []; sb.dataFix27dV1(s);
  ok('an empty lab list of a removed old name goes with it', !('Max Zinc 21%' in s.masters.labTemplates)); }
{ const s = fix(); const r = cp(s.masters.recipes[BAD]); const rev = {}; Object.keys(r).reverse().forEach(k => { rev[k] = r[k]; }); s.masters.recipes[GOOD] = rev; sb.dataFix27dV1(s);
  ok('the same recipe in a different key order counts as the same', !s.masters.recipes[BAD] && s.masters._fix27d.skipped.length === 0); }
{ /* BS26001: a multi batch with any certified lot, like the app; and the lot of that day */
  const s = fix(); s.batches[1].kind = 'multi'; s.batches[1].lots.push({ id: 'LX', lotNo: 'X', qty: 200, coa: { status: 'approved' } }); sb.dataFix27dV1(s);
  ok('guard: a multi batch holding a certified lot -> row and lots stay', s.productionLog.some(p => p.id === 'PLmui1quhjd2tqj6') && s.batches[1].lots.length === 2); }
{ const s = fix(); s.productionLog[0].date = '2026-09-26'; s.batches[1].lots = [{ id: 'A', qty: 500, date: '2026-09-20' }, { id: 'B', qty: 500, date: '2026-09-26' }]; sb.dataFix27dV1(s);
  ok('two 500 Kg lots: the one of the row\'s own day goes, the other stays', s.batches[1].lots.length === 1 && s.batches[1].lots[0].id === 'A'); }
{ /* a skip is visible where the app can show it: the audit trail, and the log line */
  sb.logs.length = 0; const s = fix(); s.packingLog[1].kg = 250; sb.dataFix27dV1(s);
  ok('a skip is written on the audit trail', s.audit.some(a => a.field === 'SKIPPED 27d' && /PK2294-g79y/.test(a.val)));
  ok('and in the log line', sb.logs.length === 1 && /NOT done/.test(sb.logs[0])); }
{ /* the old spelling must not survive anywhere outside the masters, even where the walk cannot reach */
  const s = fix(); let deep = { base: BAD }; for (let i = 0; i < 14; i++) deep = { n: deep }; s.deepThing = deep; sb.dataFix27dV1(s);
  ok('a copy the walk cannot reach is reported, not hidden', s.masters._fix27d.skipped.some(x => /deepThing/.test(x))); }

/* ---- once, safe, recorded ---- */
{ sb.logs.length = 0; sb.applied = 0; const s = fix(); sb.dataFix27dV1(s); const f = s.masters._fix27d;
  ok('the durable record is on the masters', f && f.n === 12 && f.did.length === 12 && /D-335/.test(f.by) && Array.isArray(f.skipped) && f.skipped.length === 0);   /* 1 pack + 1 row + base + recipe + lab list + product + 6 names = 12 */
  ok('it logged once and rebuilt the tables', sb.logs.length === 1 && /Records settled/.test(sb.logs[0]) && sb.applied === 1);
  const again = cp(s); sb.logs.length = 0; sb.applied = 0; sb.dataFix27dV1(again);
  eq('a second run changes nothing', JSON.stringify(again), JSON.stringify(s)); ok('and logs nothing', sb.logs.length === 0 && sb.applied === 0);
  const t = cp(s); delete t.masters._fix27d; sb.dataFix27dV1(t); delete t.masters._fix27d; const u = cp(s); delete u.masters._fix27d;
  eq('even without the flag a run finds nothing left to do', JSON.stringify(t), JSON.stringify(u)); }
{ sb.dataFix27dV1(null); sb.dataFix27dV1({}); const s = { masters: {} }; sb.dataFix27dV1(s); ok('no state, no products: no crash', !!s.masters._fix27d); }
{ const s = fix(); delete s.masters.customProducts; delete s.masters.groupOfBrand; delete s.corrections; delete s.audit; sb.dataFix27dV1(s); ok('missing optional tables: no crash and the work is done', s.masters._fix27d && s.corrections.length === 2 && s.audit.length >= 2); }

/* ---- the code ---- */
ok('it runs in the load chain after productGenericV1 and before the recipes', /productGenericV1\(s\); dataFix27dV1\(s\); (alsoBasesV1\(s\); )?loadBaseRecipesV2\(s\);/.test(html));
ok('build id is 2026-10-27d or later', /BUILD_ID='2026-10-(27d|28[a-z]|29[a-z])'/.test(html));
{ const body = html.split('\n').filter(l => !l.startsWith('/*SYSDOC_DATA_START*/')).join('\n');
  const left = (body.match(new RegExp(BAD, 'g')) || []).length;
  eq('the old base spelling appears in the code only in the comment and the recipe alias', left, 2);
  ok('the recipe alias reads the old spelling as the new one', new RegExp("'" + BAD + "':'" + GOOD + "'").test(body));
  ok('the code catalogue now carries the right spelling for V-Germinator Pro', new RegExp("'V-Germinator Pro':\\{base:'" + GOOD + "'").test(body)); }
{ const v = /var SYSDOC_VER='([^']+)', SYSDOC_DATE='([^']+)'/.exec(html), b = /var BUILD_ID='([^']+)'/.exec(html);
  ok('the documentation card version follows the build', v && b && v[1] === b[1] && v[2] === b[1].slice(0, 10)); }
ok('change log 2026-10-27d exists', /ver:'2026-10-27d'/.test(html) && /Records settled: one pack, one batch, one spelling, six old names/.test(html));

process.exitCode = report('27d: records settled (pack, batch, base spelling, six names)') ? 1 : 0;
