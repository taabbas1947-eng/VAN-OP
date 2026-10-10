/* 10 Oct 2026 — BATCH TRACE (Production Manager: "in which brands was the 40,000 Kg of HG26036 packed?").
   Run: node batchtrace.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;

const sb = { console, fmt: x => String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ','), qsEsc: x => String(x == null ? '' : x),
  state: {} };
vm.createContext(sb);
vm.runInContext(['lotBaseNo', 'lotBrandNo', 'btBatches', 'batchTrace', 'batchTraceHTML', 'rpBatchTraceHTML'].map(grab).join('\n') + '\nvar rpBt="";', sb);

/* HG26036: 40,000 planned, produced, packed into 3 brand batches on 2 POs, 1,000 reconciled as loss, 500 as by-product, closed */
sb.state = {
  orders: [{ po: 'P-1', client: 'Kisan Fertiliser' }, { po: 'P-2', client: 'Maxim' }],
  batches: [{ id: 'B1', batchNo: 'HG26036', brand: 'Potassium Humate', status: 'closed', closedDate: '2026-10-01', plannedKg: 40000, producedKg: 40000, packedKg: 38500, disposedKg: 1500, lossKg: 1000, lossReason: 'Moisture', packReconcile: { loss: 1000, items: [{ type: 'byproduct', base: 'Humate', kg: 500 }] } },
             { id: 'B2', batchNo: 'HG26037', status: 'open', plannedKg: 10, producedKg: 10, packedKg: 0 },
             { id: 'BP', batchNo: '', pool: true, disposition: 'byproduct' }],
  packingLog: [
    { id: 'K1', baseBatchId: 'B1', brand: 'Germinator Pro', brandBatchNo: 'GPH26002', po: 'P-1', lid: 'L1', kg: 20000, shipKg: 15000, date: '2026-09-02' },
    { id: 'K2', baseBatchId: 'B1', brand: 'Germinator Pro', brandBatchNo: 'GPH26002', po: 'P-1', lid: 'L1', kg: 3000, shipKg: 0, date: '2026-09-05' },
    { id: 'K3', baseBatchId: 'B1', brand: 'Humic Plus', brandBatchNo: 'HP26001', po: 'P-2', lid: 'L2', kg: 15500, shipKg: 15500, date: '2026-09-10' },
    { id: 'K4', baseBatchId: 'B1', brand: 'Humic Plus', brandBatchNo: 'HP26001', po: 'P-2', lid: 'L2', kg: 9999, shipKg: 0, reversed: true },
    { id: 'K5', baseBatchId: 'B2', brand: 'Other', po: 'P-2', kg: 7, shipKg: 0 }],
  shipments: [
    { dispId: 'D1', dc: '101', dispatch: '2026-09-20', po: 'P-1', vehicle: 'TLA-1', batches: [{ lotId: 'K1', batch: 'HG26036', brand: 'GPH26002', kg: 15000 }] },
    { dispId: 'D2', dc: '102', dispatch: '2026-09-25', po: 'P-2', vehicle: 'TLB-2', batches: [{ lotId: 'K3', batch: 'HG26036', brand: 'HP26001', kg: 8000 }] },
    { dispId: 'D3', dc: '90', dispatch: '2026-09-12', po: 'P-2', vehicle: 'TLC-3', batches: [{ batch: 'HG26036', brand: 'HP26001', kg: 7500 }] },   /* old row, no lot link */
    { dispId: 'D4', dc: '103', dispatch: '2026-09-26', po: 'P-1', voided: true, batches: [{ lotId: 'K1', kg: 999 }] }]
};
let t = sb.batchTrace(sb.state.batches[0]);
eq('packed adds the packing lots; a reversed lot is left out', t.packed, 38500);
eq('two brands (the brand batch GPH26002 is one row with 2 lots)', t.rows.length, 2);
eq('the biggest brand first: Germinator Pro 23,000', t.rows[0].brand + ':' + t.rows[0].kg, 'Germinator Pro:23000');
eq('the other brand carries its own PO and customer', t.rows[1].po + '/' + t.rows[1].client, 'P-2/Maxim');
eq('shipped from the packing records', t.shipped, 30500);
eq('still in stock', t.inStock, 8000);
eq('trucks: lot-linked and old-row, voided left out', t.trucks.length, 3);
eq('trucks total', t.dcKg, 30500);
eq('one truck matched by number only (counted so the page can say so)', t.byNo, 1);
eq('loss, by-product', t.loss + '/' + t.bp, '1000/500');
eq('nothing unaccounted: 40,000 = 38,500 + 1,500', t.unacc, 0);
let out = sb.batchTraceHTML(t);
ok('the page names the brands, the bag numbers and the customers', /Germinator Pro/.test(out) && /GPH26002/.test(out) && /HP26001/.test(out) && /Maxim/.test(out));
ok('every DC is a link that prints it', /printDC\('D1'\)/.test(out) && /printDC\('D2'\)/.test(out));
ok('all checks pass: no red cross', !/&#10007;/.test(out));
ok('the older-truck note shows', /older than lot links/.test(out));
/* a batch that does not add up is shown in red, not hidden */
sb.state.batches[0].packedKg = 40000; sb.state.batches[0].disposedKg = 0;
out = sb.batchTraceHTML(sb.batchTrace(sb.state.batches[0]));
ok('unaccounted 1,500 and a packed-figure mismatch are both flagged', (out.match(/&#10007;/g) || []).length >= 2 && /1,500 Kg\/L not accounted for/.test(out));
/* search */
sb.rpBt = ''; ok('empty box explains itself', /Type or pick a batch/.test(sb.rpBatchTraceHTML()));
sb.rpBt = 'hg26036'; ok('case does not matter', /Where the quantity went/.test(sb.rpBatchTraceHTML()));
sb.rpBt = 'HG2603'; ok('a partial number offers close matches', /Close matches/.test(sb.rpBatchTraceHTML()) && /HG26036/.test(sb.rpBatchTraceHTML()));
ok('pools (no batch number) are not in the list', !/option value=""/.test(sb.rpBatchTraceHTML()));
/* catalogue */
const cat = html.match(/\{id:'batchtrace'[^\n]*/)[0];
ok('in the catalogue with the roles of Batches and wastage, read-only view', /kind:'batchtrace'/.test(cat) && /roles:\['Production','Production Manager','Plant Manager','QCM','AQCM','COO','CFO'\]/.test(cat));
ok('sits in the Production group', /ids:\['prodshift','batches','batchtrace','rm'\]/.test(html));
ok('opens without the report builder, and renders its own view', /c\.kind==='customer'\|\|c\.kind==='batchtrace'/.test(html) && /if\(c\.kind==='batchtrace'\) return h\+rpBatchTraceHTML/.test(html));
report();
