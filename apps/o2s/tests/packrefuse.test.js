/* 5 Oct 2026 — A REFUSED PACK MUST ADD NOTHING.
   doPack added the quantity to the PO line and the batch, then checked the brand
   batch # and the shelf life. A refusal there returned with both already counted
   and no packing record: VG-VC-2609-5466 Nitro Sulfur packed 250, NS26004 +250,
   no lot. Pack now checks first.  Run: node packrefuse.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab } = H;
function box(brandBatch) {
  const sb = { console, toasts: [], toast: m => sb.toasts.push(m), may: () => true, batchLabApproved: () => true, batchPackableKg: b => b.producedKg - b.packedKg,
    evDateGate: () => null, evToday: () => '2026-09-26', evStamp: () => ({}), shortCloseRefusal: () => null, packPriceGate: () => null, packPriceRecord: () => ({}),
    packDates: () => ({ mfgDate: '2026-09-26', expDate: '2028-09-26', shelfMonths: 24 }), SHELF_DEFAULT_MONTHS: 24, SHELF_OVERRIDE_ROLES: [], hardRole: () => false, fyKey: () => 'FY27',
    syncPackBatchDates: () => {}, logAction: () => {}, nid: p => p + '1', multiTrueUpIfPlaced: () => {}, save: () => { sb.saved = 1; }, render: () => {}, closeModal: () => {}, fmt: String, denyRight: () => '',
    state: { currentUser: { name: 'J' }, packingLog: [],
      batches: [{ id: 'B', batchNo: 'NS26004', base: 'Nitro Sulfur', producedKg: 4000, packedKg: 2875 }, { id: 'B9', batchNo: 'NS26009', base: 'Nitro Sulfur', openedDate: '2026-09-01', producedKg: 1, packedKg: 0 }],
      orders: [{ id: 'O', po: 'VG-VC-2609-5466', lines: [{ id: 'L', brand: 'Nitro Sulfur', ordered: 250, packed: 0, produced: 0 }] }] },
    packForm: { bid: 'B', kg: 250, brand: 'Nitro Sulfur', oid: 'O', lid: 'L', brandBatch: brandBatch, packDate: '2026-09-26' } };
  vm.createContext(sb); vm.runInContext(grab('doPack') + '\ndoPack();', sb); return sb; }
{ const sb = box('NS26009');
  ok('the brand batch # is refused', /base batch number/.test(sb.toasts.join(' ')));
  eq('the batch did not move', sb.state.batches[0].packedKg, 2875);
  eq('the line did not move', sb.state.orders[0].lines[0].packed, 0);
  eq('no packing record', sb.state.packingLog.length, 0); }
{ const sb = box('');
  eq('a good pack still counts on the batch', sb.state.batches[0].packedKg, 3125);
  eq('...on the line', sb.state.orders[0].lines[0].packed, 250);
  eq('...and writes its record', sb.state.packingLog.length, 1); }
process.exitCode = report('A refused pack adds nothing (5 Oct)') ? 1 : 0;
