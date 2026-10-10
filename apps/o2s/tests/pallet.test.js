/* 10 Oct 2026 — batch on the pallet checked against each DC line at the truck inspection. Run: node pallet.test.js */
const H = require('./harness.js'); const vm = require('vm'); const { ok, report, grab, html } = H;
const eq = (g, w, n) => ok(n, JSON.stringify(g) === JSON.stringify(w));
let toasts = [], rejects = [], logs = [];
const modal = { innerHTML: '', classList: { add() {}, remove() {} } };
const sb = { console, toast: m => toasts.push(m), save() {}, render() {}, closeModal() {}, fmt: x => String(Math.round(x)), _pe: x => String(x), _av: x => String(x), _tx: x => String(x || ''),
  $: () => modal, canEdit: () => true, evToday: () => '2026-10-10', evDateGate: () => null, evStamp: () => ({}), logAction: m => logs.push(m), dcRejectNote: (r, w, k) => rejects.push({ w, k }), _releaseShip() {},
  qcVerifyGate: () => null, qcAskSeen: () => false, qcNaGate: () => null, qcVerifyRecord: v => [{ key: 'price', result: v[0] }, { key: 'batch', result: v[1] }, { key: 'dates', result: v[2] }],
  QC_CHECKLIST: ['a', 'b'], qcVerifyFailed: v => (v || []).some(x => x === 'fail'), state: {}, renderDispatchQA() {} };
vm.createContext(sb);
vm.runInContext(['lotById', 'dispRowsFor', 'dcBatchLines', 'dispQAPallet', 'dispPalletBlock', 'dispQASubmit'].map(grab).join('\n') + '\nvar dispQAForm={};\nfunction renderDispatchQA(){}', sb);
const fresh = () => { toasts = []; rejects = []; logs = []; sb.state = { role: 'QA Inspector',
  orders: [{ po: 'P-1', lines: [{ id: 'L1', brand: 'Enrich', dispatched: 20000 }] }],
  packingLog: [{ id: 'PK-A', mfgDate: '2026-09-25', expDate: '2028-09-25', brandBatchNo: 'VAN6JE001' }, { id: 'PK-B', mfgDate: '2026-09-25', expDate: '2028-09-25', brandBatchNo: 'VAN6JW001' }],
  shipments: [{ dispId: 'D1', dc: '5229', po: 'P-1', lid: 'L1', brand: 'Enrich', kg: 9000, batches: [{ lotId: 'PK-B', batch: 'HG26036', brand: 'VAN6JW001', kg: 832 }, { lotId: 'PK-A', batch: 'HG26036', brand: 'VAN6JE001', kg: 8168 }] }] };
  vm.runInContext('dispQAForm={dispId:"D1",marks:["pass","pass"],verify:["pass","","pass"],pallet:{},officer:"Sana",remarks:"",date:"2026-10-10",dateReason:""}', sb); };
const F = () => vm.runInContext('dispQAForm', sb);
fresh(); const ls = vm.runInContext('dcBatchLines', sb)(sb.state.shipments);
eq(ls.map(l => l.no), ['VAN6JW001', 'VAN6JE001'], 'every batch line of the DC is listed'); eq(ls[1].mfg, '2026-09-25', 'with the mfg date of its own packing run');
ok('the block shows each batch number in large type', /VAN6JW001/.test(vm.runInContext('dispPalletBlock', sb)(sb.state.shipments)));
// not marked
vm.runInContext('dispQASubmit()', sb); ok('submitting without checking the pallet is refused', toasts.some(t => /Check the batch on the pallet/.test(t)) && !sb.state.shipments[0].qa);
// one different
vm.runInContext('dispQAPallet', sb)(ls[0].k, 'ok'); eq(F().verify[1], '', 'one line marked: the batch verdict waits');
vm.runInContext('dispQAPallet', sb)(ls[1].k, 'diff'); eq(F().verify[1], 'fail', 'one Different fails the batch check');
toasts = []; vm.runInContext('dispQASubmit()', sb); ok('a failed truck needs remarks saying what the pallet carried', toasts.some(t => /Remarks/.test(t)) && !sb.state.shipments[0].qa);
F().remarks = 'Pallet had VAN6JE002 not VAN6JE001'; toasts = []; vm.runInContext('dispQASubmit()', sb); if(!sb.state.shipments[0].qa) console.log('TOASTS', toasts);
const s0 = sb.state.shipments[0]; ok('the truck fails and is stopped', s0.qa && s0.qa.fail === true && s0.voided === true);
ok('Supply Chain is told', rejects.length === 1 && rejects[0].k === 'qa');
ok('the pallet lines are saved with the inspection', s0.qa.verify.filter(v => v.key === 'pallet').length === 2 && s0.qa.verify.filter(v => v.key === 'pallet').some(v => v.result === 'fail'));
// all same
fresh(); const l2 = vm.runInContext('dcBatchLines', sb)(sb.state.shipments); l2.forEach(l => vm.runInContext('dispQAPallet', sb)(l.k, 'ok'));
eq(F().verify[1], 'pass', 'all Same: the batch check passes by itself'); vm.runInContext('dispQASubmit()', sb);
ok('the truck passes and is not stopped', sb.state.shipments[0].qa && sb.state.shipments[0].qa.pass === true && !sb.state.shipments[0].voided && !rejects.length);
// wiring
ok('the inspection screen shows the block and the DC batches, not the first packing run', /\$\{dispPalletBlock\(/.test(html) && /set by the line-by-line check above/.test(html));
report();
