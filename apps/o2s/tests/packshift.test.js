/* 15 Oct 2026 - PACKING SHIFT AND IN-CHARGE (Tahir; design page "Packing Shift and In-charge").
   The 3 live packing entries (pack run, quantity entry, divert to a PO) refuse without a shift and
   an in-charge, store both on the row, and move nothing when they refuse. The correction paths
   (Data fix, Line fix) do not ask. The picks start empty. Run: node packshift.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab } = H;
const MASTERS = { shifts: ['Morning', 'Evening', 'Night'], incharges: ['Faisal Nadeem', 'Adnan Rasheed'] };
function base(extra) {
  const sb = Object.assign({ console, PACK_FLAG_KG: 10000, seedPackForBrand: () => 0, bpEsc: x => String(x), _uRole: () => ({ by: 'Abdul Majid' }), toasts: [], toast: m => sb.toasts.push(m), may: () => true, batchLabApproved: () => true, batchPackableKg: b => b.producedKg - b.packedKg,
    evDateGate: () => null, evToday: () => '2026-10-15', evStamp: () => ({}), shortCloseRefusal: () => null, packPriceGate: () => null, packPriceRecord: () => ({}),
    packDates: () => ({ mfgDate: '2026-10-15', expDate: '2028-10-15', shelfMonths: 24 }), SHELF_DEFAULT_MONTHS: 24, SHELF_OVERRIDE_ROLES: [], hardRole: () => false, fyKey: () => 'FY27',
    syncPackBatchDates: () => {}, logAction: () => {}, nid: p => p + '1', multiTrueUpIfPlaced: () => {}, save: () => { sb.saved = 1; }, render: () => {}, closeModal: () => {}, fmt: String, denyRight: () => '',
    TODAY: new Date('2026-10-15'), $: () => ({ classList: { add() {} } }),
    state: { currentUser: { name: 'Jawad Naseer' }, role: 'Production', masters: MASTERS, packingLog: [],
      batches: [{ id: 'B', batchNo: 'HG26038', base: 'Potassium Humate', producedKg: 4000, packedKg: 0 }],
      orders: [{ id: 'O', po: 'P1', lines: [{ id: 'L', brand: 'Enrich', base: 'Potassium Humate', ordered: 1000, packed: 0, produced: 0 }] }] } }, extra);
  vm.createContext(sb); return sb; }
function moved(sb) { return sb.state.batches[0].packedKg + sb.state.orders[0].lines[0].packed + sb.state.packingLog.length; }
const GATE = ['packShiftIncGate', 'packFmt', 'packEntryCalc', 'packConfirmGate', 'packShiftTotal', 'packRowExtras'].map(grab).join('\n');

/* the gate itself */
{ const sb = base({}); vm.runInContext(GATE, sb);
  const g = f => vm.runInContext('packShiftIncGate', sb)(f);
  ok('no shift is refused', /shift/i.test(g({ shift: '', incharge: 'Faisal Nadeem' })));
  ok('no in-charge is refused', /in-charge/i.test(g({ shift: 'Morning', incharge: '' })));
  ok('blank spaces count as empty', g({ shift: '  ', incharge: ' ' }) !== '');
  eq('both picked is allowed', g({ shift: 'Night', incharge: 'Adnan Rasheed' }), ''); }

/* 1 - pack run (doPack) */
function runPack(shift, inch) {
  const sb = base({ packForm: { bid: 'B', kg: 500, brand: 'Enrich', oid: 'O', lid: 'L', brandBatch: '', packDate: '2026-10-15', shift, incharge: inch } });
  vm.runInContext(GATE + '\n' + grab('doPack') + '\ndoPack();', sb); return sb; }
{ const sb = runPack('', 'Faisal Nadeem'); ok('pack run without shift is refused', /shift/i.test(sb.toasts.join(' '))); eq('...and moves nothing', moved(sb), 0); }
{ const sb = runPack('Morning', ''); ok('pack run without in-charge is refused', /in-charge/i.test(sb.toasts.join(' '))); eq('...and moves nothing', moved(sb), 0); }
{ const sb = runPack('Evening', 'Adnan Rasheed'); eq('pack run with both counts', sb.state.packingLog.length, 1);
  eq('...stores the shift', sb.state.packingLog[0].shift, 'Evening'); eq('...stores the in-charge', sb.state.packingLog[0].incharge, 'Adnan Rasheed');
  eq('...and still stores the typist in by', sb.state.packingLog[0].by, 'Jawad Naseer'); }

/* 2 - quantity entry (submitProdQty) */
function runQty(shift, inch) {
  const sb = base({ pqForm: { oid: 'O', lid: 'L', bid: 'B', qty: 300, date: '2026-10-15', shift, incharge: inch }, packedKgNote: 0 });
  sb.state.batches[0].kind = 'po'; sb.state.batches[0].po = 'P1'; sb.state.batches[0].lineId = 'L';
  vm.runInContext(GATE + '\n' + grab('pqMax') + '\n' + grab('submitProdQty') + '\nsubmitProdQty();', sb); return sb; }
{ const sb = runQty('', ''); ok('quantity entry without picks is refused', sb.toasts.length > 0 && /shift/i.test(sb.toasts.join(' '))); eq('...and moves nothing', moved(sb), 0); }
{ const sb = runQty('Night', 'Faisal Nadeem'); eq('quantity entry with both counts', sb.state.packingLog.length, 1);
  eq('...stores the shift', sb.state.packingLog[0].shift, 'Night'); eq('...stores the in-charge', sb.state.packingLog[0].incharge, 'Faisal Nadeem'); }

/* 3 - divert to a PO (submitDivert, pack mode) */
function runDiv(shift, inch) {
  const sb = base({ divForm: { poolId: 'P', mode: 'pack', qty: 400, bid: '', brand: 'Enrich', oid: 'O', lid: 'L', price: '', priceOk: false, shift, incharge: inch },
    SEED: { brandMap: {} }, brandsForBase: () => ['Enrich'] });
  sb.state.batches.push({ id: 'P', base: 'Potassium Humate', plannedKg: 400, pool: true, sources: [{ batch: 'B', batchNo: 'HG26038', kg: 400 }] });
  vm.runInContext(GATE + '\n' + grab('consumeDivertSources') + '\n' + grab('submitDivert') + '\nsubmitDivert();', sb); return sb; }
{ const sb = runDiv('', ''); ok('divert without picks is refused', /shift/i.test(sb.toasts.join(' '))); eq('...and moves nothing', moved(sb), 0); }
{ const sb = runDiv('Morning', 'Adnan Rasheed'); eq('divert with both counts', sb.state.packingLog.length, 1);
  eq('...stores the shift', sb.state.packingLog[0].shift, 'Morning'); eq('...stores the in-charge', sb.state.packingLog[0].incharge, 'Adnan Rasheed'); }

/* the screen */
{ const sb = base({}); vm.runInContext(grab('packShiftIncBlock'), sb);
  const h = vm.runInContext('packShiftIncBlock', sb)({ shift: '', incharge: '' }, 'packForm', '');
  ok('shows both picks', /<label>Shift <span style="color:var\(--red\)">\*<\/span><\/label>/.test(h) && /In-charge of this packing run <span style="color:var\(--red\)">\*<\/span>/.test(h));
  ok('both start on "— pick —", nothing preselected', (h.match(/— pick —/g) || []).length === 2 && !/selected/.test(h));
  ok('offers the shifts and the in-charges from the same lists', /Morning/.test(h) && /Faisal Nadeem/.test(h) && /Adnan Rasheed/.test(h));
  ok('says it is not the person typing', /not the person typing/.test(h));
  const h2 = vm.runInContext('packShiftIncBlock', sb)({ shift: 'Night', incharge: 'Adnan Rasheed' }, 'packForm', '');
  ok('keeps what was picked', /<option selected>Night/.test(h2) && /<option selected>Adnan Rasheed/.test(h2)); }
{ const html = H.html;
  ok('the pack screen, quantity screen and divert screen each show the picks', (html.match(/packShiftIncBlock\(/g) || []).length === 6); /* 1 definition + 3 live screens + 2 correction screens */ }


/* the duplicate clean-up must not merge two real entries that differ in shift or in-charge */
function dd(rowA, rowB) {
  const s = { batches: [{ id: 'B', packedKg: 500 }], orders: [], inspections: [], packingLog: [Object.assign({ id: 'PK1', baseBatchId: 'B', kg: 500, po: 'P', brand: 'E' }, rowA), Object.assign({ id: 'PK2', baseBatchId: 'B', kg: 500, po: 'P', brand: 'E' }, rowB)] };
  const sb = { console }; vm.createContext(sb); vm.runInContext(grab('dedupePackingLots') + '\ndedupePackingLots(s);', Object.assign(sb, { s })); return s.packingLog.length; }
eq('same kg, same shift and in-charge, over-packed: the stray copy is still merged', dd({ shift: 'Morning', incharge: 'Faisal Nadeem' }, { shift: 'Morning', incharge: 'Faisal Nadeem' }), 1);
eq('same kg, different shift: both kept', dd({ shift: 'Morning', incharge: 'Faisal Nadeem' }, { shift: 'Evening', incharge: 'Faisal Nadeem' }), 2);
eq('same kg, different in-charge: both kept', dd({ shift: 'Morning', incharge: 'Faisal Nadeem' }, { shift: 'Morning', incharge: 'Adnan Rasheed' }), 2);
eq('old rows with neither field are merged as before', dd({}, {}), 1);

/* the two correction paths ask too (15 Oct afternoon) */
['dfSubmitPacking', 'lineFixRecord'].forEach(n => { let src = ''; try { src = grab(n); } catch (e) {}
  ok(n + ' requires the shift and the in-charge', src.length > 0 && /packShiftIncGate/.test(src)); });
process.exitCode = report('Packing shift and in-charge (15 Oct)') ? 1 : 0;
