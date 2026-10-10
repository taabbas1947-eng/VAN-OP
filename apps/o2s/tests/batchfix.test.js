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
vm.runInContext(['lotBaseNo', 'lotBrandNo', 'lotById', 'recordCorrection', 'logAction', 'bpEsc', 'bpId', '_av', '_uRole', 'bfxMayRequest', 'bfxMayDecide', 'bfxFor', 'bfxPending', 'bfxRowHit', 'bfxImpact', 'bfxApply', 'bfxOpen', 'bfxRender', 'bfxSubmit', 'bfxJobs', 'bfxReview', 'bfxDecide', 'bfxCell', 'bfxChecks', 'bfxFollowBuild', 'bfxFollowText', 'bfxFollowMay', 'bfxFollowJobs', 'bfxFollowOpen', 'bfxFollowDone', 'bfxJs', 'fyKey', 'validateBatchNo'].map(grab).join('\n') + '\nvar bfxForm=null, bfxNote="", bfxFNote="";', sb);
const fresh = () => { toasts = []; sb.state = { role: 'Production Manager', currentUser: { name: 'Majid', username: 'majid' },
  batches: [{ id: 'B1', batchNo: 'HG26036', openedDate: '2026-09-25' }],
  packingLog: [
    { id: 'PK4331-6n85', date: '2026-10-04', mfgDate: '2026-09-25', baseBatchId: 'B1', brand: 'Max Potash', brandBatchNo: 'VAN6JW001', po: 'P-1', lid: 'L1', kg: 1632, shipKg: 1632, insKg: 1632 },
    { id: 'PK1', date: '2026-10-06', mfgDate: '2026-09-25', baseBatchId: 'B1', brand: 'Max Potash', brandBatchNo: 'VAN6JE001', po: 'P-1', lid: 'L1', kg: 8320, shipKg: 8320, insKg: 8320 },
    { id: 'PK2', date: '2026-10-07', mfgDate: '2026-09-25', baseBatchId: 'B1', brand: 'Max Potash', brandBatchNo: 'VAN6JE001', po: 'P-1', lid: 'L1', kg: 8672, shipKg: 8672, insKg: 8672 }],
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

/* the same safeguards as the pack screen */
fresh(); let ck = run('bfxChecks(lotById("PK4331-6n85"),"VAN6JE001")'); eq(ck.block, [], 'JE001 passes: same brand, same mfg date');
fresh(); sb.state.batches.push({ id: 'B9', batchNo: 'VAN6JE001', openedDate: '2026-09-30' }); ck = run('bfxChecks(lotById("PK4331-6n85"),"VAN6JE001")'); ok('a base batch number cannot be used', ck.block.length === 1 && /base batch/.test(ck.block[0]));
fresh(); sb.state.packingLog.push({ id: 'PKX', date: '2026-10-05', brand: 'Other Brand', brandBatchNo: 'VAN6JE001', baseBatchId: 'B1', po: 'P-2', kg: 5, mfgDate: '2026-09-25' }); ck = run('bfxChecks(lotById("PK4331-6n85"),"VAN6JE001")'); ok('a number used by a different brand is refused', ck.block.some(m => /different brand/.test(m)));
fresh(); sb.state.packingLog[1].mfgDate = '2026-09-10'; sb.state.packingLog[2].mfgDate = '2026-09-10'; ck = run('bfxChecks(lotById("PK4331-6n85"),"VAN6JE001")'); ok('a different mfg date is refused', ck.block.some(m => /one date/.test(m)));
fresh(); ask('VAN6JE001', 'new', 'x'.repeat(12)); sb.state.packingLog[1].mfgDate = '2026-09-10'; sb.state.packingLog[2].mfgDate = '2026-09-10'; sb.state.role = 'COO'; run('bfxDecide("' + sb.state.batchFixReqs[0].id + '",true)');
ok('approval re-checks and refuses', sb.state.packingLog[0].brandBatchNo === 'VAN6JW001' && sb.state.batchFixReqs[0].status === 'pending');
fresh(); ck = run('bfxChecks(lotById("PK4331-6n85"),"VAN6JE001")'); ok('a real VAN number gives no pattern warning', ck.block.length === 0 && ck.warn.length === 0);
fresh(); sb.state.packingLog[1].mfgDate = '2026-09-10'; sb.state.packingLog[2].mfgDate = '2026-09-10'; toasts = []; ask('VAN6JE001', 'new', 'Majid checked the pallets: bags print VAN6JE001'); ok('the request itself is refused on a date clash', !(sb.state.batchFixReqs || []).length && toasts.some(m => /one date/.test(m)));
ok('no button on every run: one picker under the table', !/>Wrong number<\/button>/.test(html) && /function bfxPicker/.test(html) && /\+bfxPicker\(g\)/.test(html));
/* 10h: after the fix, the papers already printed are reprinted. Supply Chain and QA each get a job that stays until it is closed. */
const approveFix = () => { fresh(); sb.state.shipments[0].dispCounted = true; sb.state.shipments[0].stage = 'in_transit';
  sb.state.shipments[1].qa = { pass: true, verify: [{ key: 'pallet', item: 'Pallet: Max Potash VAN6JW001 (832 Kg/L) is the batch on the DC', result: 'pass' }, { key: 'pallet', item: 'Pallet: Max Potash VAN6JE001 (8,320 Kg/L) is the batch on the DC', result: 'pass' }, { key: 'price', item: 'Price on the pack', result: 'pass' }] };
  ask('VAN6JE001', 'new', 'Majid checked the pallets: bags print VAN6JE001'); sb.state.role = 'COO'; run('bfxDecide("' + sb.state.batchFixReqs[0].id + '",true)'); return sb.state.batchFixReqs[0]; };
let fr = approveFix();
eq(fr.follow.map(f => f.k), ['dc:D1', 'dc:D2', 'psi:D2', 'in:P-1'], 'a job for each live DC, the truck report of the DC that was inspected, and the PO packed-material report; the voided DC is left out');
eq(fr.follow.find(f => f.k === 'dc:D1').left, true, 'DC 5224 left the gate'); eq(fr.follow.find(f => f.k === 'dc:D2').left, false, 'DC 5229 has not');
eq(sb.state.shipments[1].qa.verify[0].item, 'Pallet: Max Potash VAN6JE001 (832 Kg/L) is the batch on the DC', 'the pallet check text follows the new number');
eq(sb.state.shipments[1].qa.verify[1].item, 'Pallet: Max Potash VAN6JE001 (8,320 Kg/L) is the batch on the DC', 'a line that already said JE001 is untouched');
let jobs = run('bfxFollowJobs()');
eq(jobs.map(j => j.role), ['Supply Chain', 'Supply Chain', 'QA Inspector', 'QA Inspector'], 'Supply Chain gets the 2 DCs, QA the 2 reports');
ok('every job has its own key part', new Set(jobs.map(j => j.fu)).size === 4);
ok('the truck that left says the customer holds the old paper', /already left/.test(jobs[0].what) && !/already left/.test(jobs[1].what));
ok('acKey has the new field so jobs do not collapse', /if\(it\.fu\)p\.push\('fu:'\+it\.fu\)/.test(html) && /bfxFollowJobs\(\)\.forEach/.test(html));
/* opening does not close it */
sb.state.role = 'Supply Chain'; sb.printDC = () => {}; run('bfxFollowOpen("' + fr.id + '",0)'); ok('opening the job shows the print button and Reprinted', /Open the DC to print/.test(modal.innerHTML) && />Reprinted</.test(modal.innerHTML));
eq(run('bfxFollowJobs()').length, 4, 'opening and printing leave the job open');
/* who may close */
sb.state.role = 'QA Inspector'; toasts = []; run('bfxFollowDone("' + fr.id + '",0,true)'); ok('QA cannot close a DC job', toasts.some(t => /Supply Chain closes/.test(t)) && !fr.follow[0].done);
sb.state.role = 'Supply Chain'; run('bfxFollowDone("' + fr.id + '",0,true)'); eq(fr.follow[0].done.how, 'reprinted', 'Supply Chain closes the DC job with Reprinted'); eq(run('bfxFollowJobs()').length, 3, 'it leaves the list');
toasts = []; sb.bfxFNote = 'no'; run('bfxFollowDone("' + fr.id + '",1,false)'); ok('"not needed" needs a reason', toasts.some(t => /at least 5/.test(t)) && !fr.follow[1].done);
sb.bfxFNote = 'Customer collects from the factory again'; run('bfxFollowDone("' + fr.id + '",1,false)'); eq(fr.follow[1].done.how, 'notneeded', 'not needed with a reason is accepted'); eq(fr.follow[1].done.note, 'Customer collects from the factory again', 'the reason is kept');
sb.state.role = 'Supply Chain'; toasts = []; run('bfxFollowDone("' + fr.id + '",2,true)'); ok('Supply Chain cannot close the QA report job', toasts.some(t => /QA closes/.test(t)) && !fr.follow[2].done);
sb.state.role = 'QA Inspector'; run('bfxFollowDone("' + fr.id + '",2,true)'); run('bfxFollowDone("' + fr.id + '",3,true)'); eq(run('bfxFollowJobs()').length, 0, 'QA closes both report jobs: none left');
sb.state.role = 'COO'; run('bfxReview("' + fr.id + '")'); ok('the review screen lists the papers and who closed them', /Papers to reprint/.test(modal.innerHTML) && /reprinted/.test(modal.innerHTML) && /not needed/.test(modal.innerHTML));
/* the truck report is printed by printPSI, the packed-material report by printInspect */
fr = approveFix(); sb.state.role = 'QA Inspector'; run('bfxFollowOpen("' + fr.id + '",2)'); ok('the truck report job opens the truck report, not the packed-material one', /printPSI\('D2'\)/.test(modal.innerHTML) && !/printInspect/.test(modal.innerHTML));
run('bfxFollowOpen("' + fr.id + '",3)'); ok('the packed-material job opens printInspect with the PO', /printInspect\('P-1'\)/.test(modal.innerHTML));
ok('a PO with an apostrophe cannot break the button', run('bfxJs("P\'1")') === "P\\'1");
/* a shipment from before QA was required has no report to reprint */
fresh(); sb.state.shipments[1].qa = { pass: true, closed: true }; ask('VAN6JE001', 'new', 'Majid checked the pallets: bags print VAN6JE001'); sb.state.role = 'COO'; run('bfxDecide("' + sb.state.batchFixReqs[0].id + '",true)');
eq(sb.state.batchFixReqs[0].follow.map(f => f.k), ['dc:D1', 'dc:D2', 'in:P-1'], 'no truck report job for a truck that was never inspected');
/* the pallet text is copied onto every row of the DC: follow it on all of them */
fresh(); const palTxt = 'Pallet: Max Potash VAN6JW001 (832 Kg/L) is the batch on the DC';
sb.state.shipments[1].batches.push({ lotId: 'PK2', brand: 'VAN6JE001', kg: 100 });
sb.state.shipments.push({ dispId: 'D2', dc: '5229', po: 'P-1', brand: 'Other', batches: [{ lotId: 'PK2', brand: 'VAN6JE001', kg: 50 }] });
sb.state.shipments[1].qa = { pass: true, verify: [{ key: 'pallet', item: palTxt, result: 'pass' }] }; sb.state.shipments[3].qa = JSON.parse(JSON.stringify(sb.state.shipments[1].qa));
ask('VAN6JE001', 'new', 'Majid checked the pallets: bags print VAN6JE001'); sb.state.role = 'COO'; run('bfxDecide("' + sb.state.batchFixReqs[0].id + '",true)');
eq([sb.state.shipments[1], sb.state.shipments[3]].map(x => x.qa.verify[0].item), ['Pallet: Max Potash VAN6JE001 (832 Kg/L) is the batch on the DC', 'Pallet: Max Potash VAN6JE001 (832 Kg/L) is the batch on the DC'], 'both rows of the DC show the new number in the pallet text');
/* a correction that touches nothing printed */
fresh(); sb.state.shipments = []; sb.state.inspections = []; ask('VAN6JE001', 'new', 'Majid checked the pallets: bags print VAN6JE001'); sb.state.role = 'COO'; toasts = []; run('bfxDecide("' + sb.state.batchFixReqs[0].id + '",true)');
eq(sb.state.batchFixReqs[0].follow, [], 'no DC or report: no job'); ok('and the toast says so', toasts.some(t => /No DC or inspection report/.test(t)));
/* a refused request makes no jobs */
fresh(); ask('VAN6JE001', 'new', 'Majid checked the pallets: bags print VAN6JE001'); sb.state.role = 'COO'; sb.bfxNote = 'Look at the pallets again'; run('bfxDecide("' + sb.state.batchFixReqs[0].id + '",false)'); eq(run('bfxFollowJobs()').length, 0, 'refused: no reprint job');
report();
