/* 10 Oct 2026 — BATCH NUMBER CORRECTION: ask, then the COO approves (VAN6JW001 typed, VAN6JE001 on the bags). Run: node batchfix.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, report, grab, html } = H;
const eq = (got, want, name) => ok(name, JSON.stringify(got) === JSON.stringify(want));
const modal = { innerHTML: '', className: '', classList: { add() {}, remove() {} } };
let toasts = [], saves = 0;
const sb = { console, $: id => id === 'modal' ? modal : { classList: { add() {}, remove() {} } },
  fmt: x => String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ','), toast: m => toasts.push(m), save: () => saves++, closeModal() {}, render() {},
  nid: p => p + Math.random().toString(36).slice(2, 6), correctTypeLabel: t => t, correctReasonText: k => k, _pe: x => String(x), hardRole: r => sb.state.role === 'COO' || r.includes(sb.state.role), state: {} };
vm.createContext(sb);
vm.runInContext(['lotBaseNo', 'lotBrandNo', 'lotById', 'recordCorrection', 'logAction', 'bpEsc', 'bpId', '_av', '_uRole', 'bfxMayRequest', 'bfxMayDecide', 'bfxFor', 'bfxPending', 'bfxRowHit', 'bfxImpact', 'bfxApply', 'bfxOpen', 'bfxRender', 'bfxSubmit', 'bfxJobs', 'bfxReview', 'bfxDecide', 'bfxCell'].map(grab).join('\n') + '\nvar bfxForm=null, bfxNote="";', sb);
const fresh = () => { toasts = []; sb.state = { role: 'Production Manager', currentUser: { name: 'Majid', username: 'majid' },
  batches: [{ id: 'B1', batchNo: 'HG26036' }],
  packingLog: [
    { id: 'PK4331-6n85', baseBatchId: 'B1', brand: 'Max Potash', brandBatchNo: 'VAN6JW001', po: 'P-1', lid: 'L1', kg: 1632, shipKg: 1632, insKg: 1632 },
    { id: 'PK1', baseBatchId: 'B1', brand: 'Max Potash', brandBatchNo: 'VAN6JE001', po: 'P-1', lid: 'L1', kg: 8320, shipKg: 8320, insKg: 8320 },
    { id: 'PK2', baseBatchId: 'B1', brand: 'Max Potash', brandBatchNo: 'VAN6JE001', po: 'P-1', lid: 'L1', kg: 8672, shipKg: 8672, insKg: 8672 }],
  shipments: [
    { dispId: 'D1', dc: '5224', po: 'P-1', batches: [{ lotId: 'PK4331-6n85', batch: 'HG26036', brand: 'VAN6JW001', kg: 800 }] },
    { dispId: 'D2', dc: '5229', po: 'P-1', batches: [{ lotId: 'PK4331-6n85', batch: 'HG26036', brand: 'VAN6JW001', kg: 832 }, { lotId: 'PK1', brand: 'VAN6JE001', kg: 8320 }] },
    { dispId: 'D3', dc: '9', po: 'P-1', voided: true, batches: [{ lotId: 'PK4331-6n85', brand: 'VAN6JW001', kg: 5 }] }],
  inspections: [{ id: 'I1', po: 'P-1', date: '2026-10-05', batches: [{ lotId: 'PK4331-6n85', brand: 'VAN6JW001', kg: 1632 }, { lotId: 'PK1', brand: 'VAN6JE001', kg: 8320 }] }] }; };
const run = s => vm.runInContext(s, sb);
const ask = (nn, bags, reason) => { run('bfxOpen("PK4331-6n85")'); sb.bfxForm.newNo = nn; sb.bfxForm.bags = bags; sb.bfxForm.reason = reason; run('bfxSubmit()'); };

fresh();
ok('the app still refuses a plain edit (rule unchanged)', /Quarantine and re-label; do not edit the record/.test(html));
ask('van6je001', 'new', 'Majid checked the pallets: bags print VAN6JE001');
eq(sb.state.batchFixReqs.length, 1, 'a request is saved'); eq(sb.state.batchFixReqs[0].status, 'pending', 'it is pending');
eq(sb.state.packingLog[0].brandBatchNo, 'VAN6JW001', 'NOTHING changes on asking');
eq(sb.state.batchFixReqs[0].newNo, 'VAN6JE001', 'new number is upper-cased');
eq(run('bfxJobs()').map(j => j.role), ['COO'], 'the COO gets the job');
ok('job text says old to new', /VAN6JW001 → VAN6JE001/.test(run('bfxJobs()')[0].what));
toasts = []; run('bfxOpen("PK4331-6n85")'); ok('a second request on the same run is refused', toasts.some(t => /already waiting/.test(t)));
sb.state.role = 'KAM'; run('bfxOpen("PK4331-6n85")'); ok('a KAM cannot ask', toasts.some(t => /only/.test(t)));
sb.state.role = 'Production Manager'; toasts = []; sb.state.role = 'Production Manager';
run('bfxDecide(bfxJobs0)'.replace('bfxJobs0', '"' + sb.state.batchFixReqs[0].id + '",true')); ok('the Production Manager cannot approve', toasts.some(t => /COO decides/.test(t)) && sb.state.packingLog[0].brandBatchNo === 'VAN6JW001');

/* refusals at the request stage */
fresh(); ask('VAN6JE001', 'old', 'bags say the old number here'); ok('bags carry the old number: refused with the quarantine advice', toasts.some(t => /Quarantine and re-label/.test(t)) && !(sb.state.batchFixReqs || []).length);
fresh(); ask('VAN6JE001', '', 'long enough reason here'); ok('must say what is on the bags', toasts.some(t => /bags/.test(t)));
fresh(); ask('VAN6JE001', 'new', 'short'); ok('reason must be at least 10 characters', toasts.some(t => /reason/.test(t)));
fresh(); ask('VAN6JW001', 'new', 'same number as now ok'); ok('same number refused', toasts.some(t => /already in the record/.test(t)));
fresh(); ask('V@N 1', 'new', 'odd characters in it'); ok('odd characters refused', toasts.some(t => /letters and digits/.test(t)));

/* impact preview */
fresh(); const im = run('bfxImpact(lotById("PK4331-6n85"),"VAN6JE001")');
eq(im.dcs, ['DC 5224 (800 Kg)', 'DC 5229 (832 Kg)'], 'impact lists the live DCs, not the voided one'); eq(im.insp, 1, 'impact counts the inspection line'); eq(im.joins, { kg: 16992, runs: 2 }, 'it joins the 2 existing VAN6JE001 runs');

/* approve */
fresh(); ask('VAN6JE001', 'new', 'Majid checked the pallets: bags print VAN6JE001');
const id = sb.state.batchFixReqs[0].id; sb.state.role = 'COO'; sb.state.currentUser = { name: 'Tahir' };
run('bfxReview("' + id + '")'); ok('the COO sees Approve and Refuse', /Approve/.test(modal.innerHTML) && /Refuse/.test(modal.innerHTML));
run('bfxDecide("' + id + '",true)');
eq(sb.state.packingLog[0].brandBatchNo, 'VAN6JE001', 'the packing run now has the right number');
eq(sb.state.shipments[0].batches[0].brand, 'VAN6JE001', 'DC 5224 line followed'); eq(sb.state.shipments[1].batches[0].brand, 'VAN6JE001', 'DC 5229 line followed');
eq(sb.state.shipments[2].batches[0].brand, 'VAN6JW001', 'a voided DC is left alone'); eq(sb.state.inspections[0].batches[0].brand, 'VAN6JE001', 'the inspection line followed');
eq(sb.state.packingLog[1].brandBatchNo, 'VAN6JE001', 'other runs untouched'); eq(sb.state.batchFixReqs[0].status, 'approved', 'request closed as approved');
const cr = sb.state.corrections[0]; ok('the correction register keeps the old number', cr && cr.changes[0].before === 'VAN6JW001' && cr.changes[0].after === 'VAN6JE001' && cr.entityType === 'packingLot');
eq(run('bfxJobs()').length, 0, 'the job is gone'); const n = sb.state.corrections.length; run('bfxDecide("' + id + '",true)'); eq(sb.state.corrections.length, n, 'approving twice does nothing');

/* refuse */
fresh(); ask('VAN6JE001', 'new', 'Majid checked the pallets: bags print VAN6JE001'); const id2 = sb.state.batchFixReqs[0].id; sb.state.role = 'COO';
run('bfxDecide("' + id2 + '",false)'); ok('refusing needs a note', toasts.some(t => /why you refuse/.test(t)) && sb.state.batchFixReqs[0].status === 'pending');
sb.bfxNote = 'Check the second pallet first'; run('bfxDecide("' + id2 + '",false)'); eq(sb.state.batchFixReqs[0].status, 'refused', 'refused with a note'); eq(sb.state.packingLog[0].brandBatchNo, 'VAN6JW001', 'refusal leaves the record alone');

/* stale: number changed under it */
fresh(); ask('VAN6JE001', 'new', 'Majid checked the pallets: bags print VAN6JE001'); sb.state.packingLog[0].brandBatchNo = 'VAN6JZ001'; sb.state.role = 'COO'; run('bfxDecide("' + sb.state.batchFixReqs[0].id + '",true)');
ok('stale request is not applied', toasts.some(t => /no longer/.test(t)) && sb.state.packingLog[0].brandBatchNo === 'VAN6JZ001');

/* wiring */
ok('the action list carries the job and a distinct key', /bfxJobs\(\)\.forEach/.test(html) && /if\(it\.bfx\)p\.push/.test(html));
ok('the Batch trace drawer has the fix button', /bfxCell\(l\.id\)/.test(html));
ok('no button on every run: one picker under the table', !/>Wrong number<\/button>/.test(html) && /function bfxPicker/.test(html) && /\+bfxPicker\(g\)/.test(html));
report();
