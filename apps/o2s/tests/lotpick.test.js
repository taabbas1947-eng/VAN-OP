/* 10 Oct 2026 (10h) — WHICH BATCH GOES ON THE TRUCK (Zain). The planner sees the batches and may choose; untouched, nothing changes.
   Run: node lotpick.test.js */
const H = require('./harness.js'); const vm = require('vm'); const { ok, report, grab, html } = H;
const eq = (g, w, n) => ok(n, JSON.stringify(g) === JSON.stringify(w));
let toasts = [], logs = [], saves = 0;
const modal = { innerHTML: '', classList: { add() {}, remove() {} } };
let uid = 0;
const sb = { console, toast: m => toasts.push(m), save: () => saves++, render() {}, closeModal() {}, logAction: m => logs.push(m), fmt: x => String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ','),
  bpEsc: x => String(x == null ? '' : x), $: () => modal, may: () => true, denyRight: () => 'no', dcControlOn: () => true, qaRequiredOn: () => true, evStamp: () => ({}), _uid: p => p + (++uid),
  TODAY: new Date('2026-10-10'), state: {}, renderDispatchModal() { } };
vm.createContext(sb);
vm.runInContext(['lotBaseNo', 'lotBrandNo', 'lotHasBatch', 'lotAvail', 'lotClearedKg', 'lotShipKg', 'lotsFor', 'lineCleared', 'fifoAlloc', 'dcLots', 'dcDefaultTake', 'dcTakeSum', 'dcManualAlloc', 'dcManualCheck', 'dcSharedLot', 'dcPickerBox', 'shipReadySince', 'nextDCNo', 'saveDispatch', 'dispOrderLine', 'dispLotTake', 'dispLotReset', 'dispQtyDone', 'mpCreate', 'mpSelLines', 'mpOrdersIncluded', 'mpLotLine', 'mpLotTake', 'mpLotReset', 'mpQtyDone', 'shortClient'].map(grab).join('\n') + '\nvar dispForm=null, mpForm=null; function renderMPShip(){}', sb);
const run = s => vm.runInContext(s, sb);
/* one product, three lots of the same Enrich: JE001 (older), JE002, and a held lot */
const lot = (id, kg, ins, ship, no, date, o) => Object.assign({ id, baseBatchNo: 'HG26036', brand: 'Enrich', brandBatchNo: no, po: 'P-1', lid: 'L1', kg, insKg: ins, shipKg: ship, date, mfgDate: '2026-09-25' }, o || {});
const fresh = () => { toasts = []; logs = []; saves = 0; sb.state = { role: 'Supply Chain', shipSerial: 0, shipments: [],
  orders: [{ id: 'O1', po: 'P-1', client: 'Maxim', lines: [{ id: 'L1', brand: 'Enrich', dispatched: 0 }] }],
  packingLog: [lot('K1', 10000, 10000, 0, 'VAN6JE001', '2026-10-01'), lot('K2', 10000, 10000, 0, 'VAN6JE002', '2026-10-02'), lot('K3', 5000, 5000, 0, 'VAN6JE003', '2026-10-03')] };
  run('dispForm={oid:"O1",date:"2026-10-10",dest:"Lahore",transportType:"Ex-factory",bilty:"B1",so:"SO1",lines:[{lid:"L1",brand:"Enrich",rem:25000,qty:12000,on:true}]}'); };
/* rules for what may ship */
fresh(); eq(run('lineCleared(state.orders[0],state.orders[0].lines[0])'), 25000, 'all 3 lots ready: 25,000');
sb.state.packingLog[2].qaHold = true; eq(run('lineCleared(state.orders[0],state.orders[0].lines[0])'), 20000, 'a lot on QA hold does not count as ready');
sb.state.packingLog[1].brandBatchNo = ''; sb.state.packingLog[1].baseBatchNo = ''; eq(run('lineCleared(state.orders[0],state.orders[0].lines[0])'), 10000, 'a lot with no batch number does not count either');
fresh(); sb.state.packingLog[2].qaHold = true; eq(run('dcLots(state.orders[0],state.orders[0].lines[0])').map(p => p.id), ['K1', 'K2'], 'the picker offers only lots that can go');
/* untouched = exactly oldest first, same as before */
fresh(); run('saveDispatch()');
let sh = sb.state.shipments; eq(sh.length, 1, 'untouched: one shipment line'); eq(sh[0].batches.map(b => b.lotId + ':' + b.kg), ['K1:10000', 'K2:2000'], 'untouched: oldest first, 10,000 from K1 then 2,000 from K2');
eq(sb.state.packingLog.map(p => p.shipKg), [10000, 2000, 0], 'the lots are drawn down');
ok('untouched is not marked as chosen', sh[0].lotChosen === false);
/* the planner chooses K2 and K3, not the oldest */
fresh(); run('dispLotTake(0,"K2",9000)'); eq(run('dispForm.lines[0].manual'), true, 'a take marks the line as chosen'); eq(run('dispForm.lines[0].take'), { K1: 10000, K2: 9000 }, 'starts from oldest first, then the change is applied');
run('dispLotTake(0,"K1",0)'); run('dispLotTake(0,"K3",3000)');
eq(run('dispForm.lines[0].qty'), 12000, 'the quantity becomes the sum of the takes'); eq(run('dispForm.lines[0].take'), { K1: 0, K2: 9000, K3: 3000 }, 'by lot id');
run('saveDispatch()'); sh = sb.state.shipments;
eq(sh[0].batches.map(b => b.lotId + ':' + b.brand + ':' + b.kg), ['K2:VAN6JE002:9000', 'K3:VAN6JE003:3000'], 'the DC carries the chosen batches, with their brand batch numbers');
eq(sb.state.packingLog.map(p => p.shipKg), [0, 9000, 3000], 'only the chosen lots are drawn down'); ok('marked as chosen', sh[0].lotChosen === true); eq(sh[0].kg, 12000, 'DC quantity is the sum');
/* never silently clamped */
fresh(); run('dispLotTake(0,"K3",6000)'); run('dispLotTake(0,"K1",0)'); run('dispLotTake(0,"K2",6000)');
run('saveDispatch()'); ok('asking for more than a lot has is refused, with the reason', toasts.some(t => /VAN6JE003/.test(t) && /only 5,000/.test(t))); eq(sb.state.shipments.length, 0, 'nothing is saved'); eq(sb.state.packingLog.map(p => p.shipKg), [0, 0, 0], 'and no lot is touched');
/* a lot taken by someone else after the planner opened the form */
fresh(); run('dispLotTake(0,"K2",12000)'); run('dispLotTake(0,"K1",0)'); sb.state.packingLog[1].shipKg = 5000; toasts = []; run('saveDispatch()');
ok('stock changed under him: refused with the live figure', toasts.some(t => /only 5,000/.test(t)) && sb.state.shipments.length === 0);
/* a lot put on hold after he opened the form */
fresh(); run('dispLotTake(0,"K2",12000)'); run('dispLotTake(0,"K1",0)'); sb.state.packingLog[1].qaHold = true; toasts = []; run('saveDispatch()');
ok('a lot held after he opened the form cannot go', sb.state.shipments.length === 0 && toasts.length === 1);
/* nothing chosen */
fresh(); run('dispLotTake(0,"K1",0)'); run('dispLotTake(0,"K2",0)'); toasts = []; run('dispForm.lines[0].qty=1'); run('saveDispatch()'); ok('a chosen line with nothing taken is refused', sb.state.shipments.length === 0);
/* typing the quantity again goes back to oldest first */
fresh(); run('dispLotTake(0,"K2",9000)'); run('dispForm.lines[0].qty=3000'); run('dispQtyDone(0)'); eq(run('dispForm.lines[0].manual'), false, 'typing the quantity resets the choice'); run('saveDispatch()'); eq(sb.state.shipments[0].batches.map(b => b.lotId + ':' + b.kg), ['K1:3000'], 'and the truck takes oldest first');
/* the picker shows the batch before the DC exists */
fresh(); const box = run('dcPickerBox(state.orders[0],dispForm.lines[0],function(id){return "t(\'"+id+"\')";},"r()")');
ok('the picker names each batch on the bag, the dates and what is ready', /VAN6JE001/.test(box) && /VAN6JE002/.test(box) && /2026-10-01/.test(box) && /2026-09-25/.test(box) && /10,000/.test(box));
ok('oldest first is said to be filled in', /Oldest first is filled in/.test(box));

/* the multi-PO truck planner: the same choice, saved the same way */
const mpFresh = () => { fresh(); run('mpForm={client:"Maxim",date:"2026-10-10",dest:"Lahore",transportType:"Ex-factory",truckSize:"10t",vehicle:"TLA-1",driver:"D",driverContact:"0300",orders:[{oid:"O1",po:"P-1",so:"SO1",lines:[{lid:"L1",brand:"Enrich",rem:25000,qty:12000,on:true}]}]}'); };
mpFresh(); run('mpCreate()'); let ms = sb.state.shipments;
eq(ms.map(x => x.batches.map(b => b.lotId + ':' + b.kg).join('+')), ['K1:10000+K2:2000'], 'multi-PO untouched: oldest first as before'); ok('multi-PO untouched is not marked as chosen', ms[0].lotChosen === false);
mpFresh(); run('mpLotTake(0,0,"K2",9000)'); run('mpLotTake(0,0,"K1",0)'); run('mpLotTake(0,0,"K3",3000)'); eq(run('mpForm.orders[0].lines[0].qty'), 12000, 'multi-PO: quantity is the sum of the takes');
run('mpCreate()'); ms = sb.state.shipments; eq(ms[0].batches.map(b => b.lotId + ':' + b.brand + ':' + b.kg), ['K2:VAN6JE002:9000', 'K3:VAN6JE003:3000'], 'multi-PO: the DC carries the chosen batches'); ok('multi-PO: marked as chosen', ms[0].lotChosen === true);
mpFresh(); run('mpLotTake(0,0,"K3",9000)'); run('mpLotTake(0,0,"K1",0)'); toasts = []; run('mpCreate()'); ok('multi-PO: too much from one lot is refused and nothing is saved', toasts.some(t => /only 5,000/.test(t)) && sb.state.shipments.length === 0 && sb.state.packingLog.every(p => !p.shipKg));
mpFresh(); run('mpLotTake(0,0,"K2",9000)'); run('mpQtyDone(0,0)'); eq(run('mpForm.orders[0].lines[0].manual'), false, 'multi-PO: typing the quantity resets the choice');

/* whole Kg only */
fresh(); run('dispLotTake(0,"K2",1234.7)'); eq(run('dispForm.lines[0].take.K2'), 1235, 'a typed quantity is rounded to whole Kg');
ok('the box takes whole Kg', /step="1"/.test(box));
/* two products offered the same packing run: a chosen split is refused */
fresh(); sb.state.orders[0].lines.push({ id: 'L2', brand: 'Enrich', dispatched: 0 }); sb.state.packingLog.forEach(p => { delete p.lid; });
run('dispForm.lines.push({lid:"L2",brand:"Enrich",rem:25000,qty:1000,on:true})'); run('dispLotTake(0,"K1",1000)'); toasts = []; run('saveDispatch()');
ok('same run under 2 products and a chosen split: refused with the run named', toasts.some(t => /K1/.test(t) && /separate trucks/.test(t)) && sb.state.shipments.length === 0);
fresh(); sb.state.orders[0].lines.push({ id: 'L2', brand: 'Enrich', dispatched: 0 }); sb.state.packingLog.forEach(p => { delete p.lid; });
run('dispForm.lines.push({lid:"L2",brand:"Enrich",rem:25000,qty:1000,on:true})'); toasts = []; run('saveDispatch()'); ok('the same, with nothing chosen, goes as before', !toasts.some(t => /separate trucks/.test(t)) && sb.state.shipments.length >= 1);
/* ready since follows the same rule as ready */
fresh(); sb.state.packingLog[0].qaHold = true; eq(run('shipReadySince(state.orders[0],state.orders[0].lines[0])'), '2026-10-02', 'a held lot does not set the ready since date');
/* wiring in both planners */
ok('single-PO planner shows the picker and saves chosen lots', /dcPickerBox\(o,r,function\(id\)\{ return "dispLotTake/.test(html) && /r\.manual\?dcManualAlloc\(o,l,r\.take\):fifoAlloc/.test(html));
ok('multi-PO planner shows the picker and saves chosen lots', /mpLotTake\("\+oi/.test(html) && /x\.r\.manual\?dcManualAlloc\(o,l,x\.r\.take\):fifoAlloc/.test(html));
ok('both validate before changing anything', /dcManualCheck\(o,l,r\)/.test(html) && /dcManualCheck\(o,l,x\.r\)/.test(html));
ok('the old "oldest first" sentence on the trace is gone', !/is taken from packing runs, oldest first/.test(html));
report();
