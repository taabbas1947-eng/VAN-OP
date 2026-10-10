/* 10 Oct 2026 — BATCH TRACE (Production Manager: "in which brands was the 40,000 Kg of HG26036 packed?").
   Run: node batchtrace.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;

const modal = { innerHTML: '', classList: { add() {}, remove() {} } };
const sb = { console, hardRole: r => sb.state.role === 'COO' || r.includes(sb.state.role), $: id => id === 'modal' ? modal : { classList: { add() {}, remove() {} } }, fmt: x => String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ','), qsEsc: x => String(x == null ? '' : x),
  state: {} };
vm.createContext(sb);
vm.runInContext(['lotBaseNo', 'lotBrandNo', 'btBatches', 'batchTrace', 'btShow', 'btSheet', 'btOpenPack', 'bfxCell', 'bfxPicker', 'bfxMayRequest', 'bfxPending', 'bfxFor', 'bpEsc', '_av', 'btOpenTruck', 'batchTraceHTML', 'rpBatchTraceHTML'].map(grab).join('\n') + '\nvar rpBt="";', sb);

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
/* Majid, 10 Oct: a truck row is one DC and brand batch; a brand batch row opens its packing runs */
sb.state.packingLog.push({ id: 'K6', baseBatchId: 'B1', brand: 'Germinator Pro', brandBatchNo: 'GPH26002', po: 'P-1', lid: 'L1', kg: 100, shipKg: 100, date: '2026-09-06' }, { id: 'K7', baseBatchId: 'B1', brand: 'Germinator Pro', brandBatchNo: 'GPH26002', po: 'P-1', lid: 'L1', kg: 50, shipKg: 50, date: '2026-09-07' });
sb.state.shipments.push({ dispId: 'D5', dc: '200', dispatch: '2026-09-30', po: 'P-1', vehicle: 'TLZ-9', kg: 150, batches: [{ lotId: 'K6', brand: 'GPH26002', kg: 100 }, { lotId: 'K7', brand: 'GPH26002', kg: 50 }] },
  { dispId: 'D5', dc: '200', dispatch: '2026-09-30', po: 'P-1', vehicle: 'TLZ-9', kg: 400, batches: [{ lotId: 'K9', brand: 'OTHER', kg: 400 }] });
let t2 = sb.batchTrace(sb.state.batches[0]);
const d5 = t2.trucks.filter(x => x.dc === '200');
eq('one DC, one brand batch, 2 packing runs: ONE row, 150 Kg, 2 parts', d5.length + '/' + d5[0].kg + '/' + d5[0].parts.length, '1/150/2');
eq('the whole truck total is known (150 here + another product 400)', d5[0].dcAll, 550);
sb.batchTraceHTML(t2); sb.btOpenTruck(t2.trucks.indexOf(d5[0]));
ok('the truck drawer lists each packing run with its Kg and the total', /K6/.test(modal.innerHTML) && /K7/.test(modal.innerHTML) && /DC 200/.test(modal.innerHTML) && /whole truck carried 550/.test(modal.innerHTML));
sb.batchTraceHTML(t2);
const gi = t2.rows.findIndex(g => g.brandNo === 'GPH26002');
sb.btOpenPack(gi);
ok('the brand batch drawer lists every packing run (K1, K2, K6, K7) and the total 23,150', ['K1', 'K2', 'K6', 'K7'].every(k => modal.innerHTML.indexOf(k) > -1) && /4 packing runs make the total/.test(modal.innerHTML) && /23,150/.test(modal.innerHTML));
ok('and which DC took each run', /DC 101 15,000/.test(modal.innerHTML) && /DC 200 100/.test(modal.innerHTML));
ok('rows are tappable', /onclick="btOpenPack\(0\)"/.test(sb.batchTraceHTML(t2)) && /onclick="btOpenTruck\(0\)"/.test(sb.batchTraceHTML(t2)));
sb.state.packingLog.splice(-2); sb.state.shipments.splice(-2);
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
/* 10 Oct 2026 (10h) — the trace: an open batch is not "unaccounted"; a disposal with no type is amber; runs whose shipping records disagree are named */
{
  const mk = (extra, lots, ships) => { sb.state = { orders: [{ po: 'P-1', client: 'Kisan' }], batches: [Object.assign({ id: 'X1', batchNo: 'VU9', brand: 'Urea', status: 'open', plannedKg: 100, producedKg: 100, packedKg: 60 }, extra)], packingLog: lots, shipments: ships || [] }; return sb.batchTrace(sb.state.batches[0]); };
  const lot = (id, kg, ship, o) => Object.assign({ id, baseBatchId: 'X1', brand: 'Urea', brandBatchNo: 'VAN9', po: 'P-1', lid: 'L1', kg, shipKg: ship, date: '2026-09-01' }, o || {});
  /* open, 40 still to pack */
  let t = mk({}, [lot('A', 60, 0)]);
  eq('open batch: 40 still to be packed', t.still + '/' + t.isOpen, '40/true');
  let o = sb.batchTraceHTML(t);
  ok('open batch: says still to be packed, no red cross, no "not accounted for"', /Still to be packed/.test(o) && !/&#10007;/.test(o) && !/Not accounted for/.test(o));
  /* open but packed MORE than made: still an error */
  t = mk({ producedKg: 50, packedKg: 60 }, [lot('A', 60, 0)]);
  eq('open and over-packed: not treated as still to pack', t.still, 0);
  o = sb.batchTraceHTML(t);
  ok('open and over-packed: red', /&#10007;/.test(o) && /more than produced/.test(o));
  /* closed with 40 unaccounted: red */
  t = mk({ status: 'closed' }, [lot('A', 60, 0)]);
  o = sb.batchTraceHTML(t);
  ok('closed with 40 missing: red and says not accounted for', /Not accounted for/.test(o) && /40 Kg\/L not accounted for/.test(o) && /&#10007;/.test(o));
  /* closed, 40 disposed with no type: amber, not red on that line */
  t = mk({ status: 'closed', disposedKg: 40 }, [lot('A', 60, 0)]);
  o = sb.batchTraceHTML(t);
  ok('disposed with no type: amber line', /recorded as disposed, but no type/.test(o) && !/Reconciliation:/.test(o));
  ok('disposed with no type: no red cross', !/&#10007;/.test(o));
  /* disposed with a type that does not match is still red */
  t = mk({ status: 'closed', disposedKg: 40, lossKg: 10, packReconcile: { loss: 10, items: [] } }, [lot('A', 60, 0)]);
  o = sb.batchTraceHTML(t);
  ok('typed 10 but disposed 40: red', /Reconciliation:/.test(o) && /&#10007;/.test(o));
  /* shipping records that disagree */
  t = mk({ status: 'closed', disposedKg: 40, lossKg: 40, packReconcile: { loss: 40, items: [] } },
    [lot('A', 30, 30), lot('B', 30, 30)],
    [{ dispId: 'D1', dc: '1', po: 'P-1', batches: [{ lotId: 'A', brand: 'VAN9', kg: 30 }, { lotId: 'A', brand: 'VAN9', kg: 30 }] }]);
  eq('two runs disagree: A carries 60 on trucks (30 said), B carries 0 (30 said)', t.gaps.map(g => g.id + ':' + g.packRec + '/' + g.trucks).join(','), 'A:30/60,B:30/0');
  o = sb.batchTraceHTML(t);
  ok('the disagreement table is shown with both numbers', /Shipping records that do not agree/.test(o) && /Packing record says shipped/.test(o));
  /* agreeing records: no table */
  t = mk({ status: 'closed', disposedKg: 40, lossKg: 40, packReconcile: { loss: 40, items: [] } }, [lot('A', 60, 60)], [{ dispId: 'D1', dc: '1', po: 'P-1', batches: [{ lotId: 'A', brand: 'VAN9', kg: 60 }] }]);
  eq('records agree: no gaps', t.gaps.length, 0);
  ok('records agree: no table and no red', !/do not agree/.test(sb.batchTraceHTML(t)) && !/&#10007;/.test(sb.batchTraceHTML(t)));
  /* a truck line with no lot link is counted apart */
  t = mk({ status: 'closed', disposedKg: 40, lossKg: 40, packReconcile: { loss: 40, items: [] } }, [lot('A', 60, 60)], [{ dispId: 'D9', dc: '9', po: 'P-1', batches: [{ batch: 'VU9', brand: 'VAN9', kg: 60 }] }]);
  eq('an unlinked truck line is counted in byNoKg, and the run shows a gap of 60', t.byNoKg + '/' + t.gaps.length, '60/1');
  ok('the unlinked Kg is explained on the page', /no link to a packing run/.test(sb.batchTraceHTML(t)));
  /* a back-filled truck (lotTake, no batch lines) explains a lot's shipped Kg: no false disagreement */
  t = mk({ status: 'closed', disposedKg: 40, lossKg: 40, packReconcile: { loss: 40, items: [] } }, [lot('A', 60, 60)], [{ id: 'SH1', po: 'P-1', recon: true, lotTake: [{ lotId: 'A', kg: 60 }] }]);
  eq('a back-filled truck that took the lot: no gap', t.gaps.length, 0);
  /* an unlinked truck line may explain it: the row says so */
  t = mk({ status: 'closed', disposedKg: 40, lossKg: 40, packReconcile: { loss: 40, items: [] } }, [lot('A', 60, 60)], [{ dispId: 'D9', dc: '9', po: 'P-1', batches: [{ batch: 'VU9', brand: 'VAN9', kg: 60 }] }]);
  ok('the gap row says it may be on a truck line with no link', t.gaps[0].maybe === true && /may be on a truck line with no link/.test(sb.batchTraceHTML(t)));
  /* an open batch with everything packed keeps its normal green line */
  t = mk({ producedKg: 60, packedKg: 60 }, [lot('A', 60, 0)]);
  o = sb.batchTraceHTML(t); ok('open and fully packed: the green produced = packed line, no "still open" note', /Produced 60 = packed 60/.test(o) && !/still open/.test(o) && !/Still to be packed/.test(o));
}
report();
