/* 17c (Tahir, 17 Oct 2026): release a Potassium Humate lot provisionally.
 *  - The AQCM or the QCM releases a lot once the quick tests (Physical Status, Color, Moisture, K2O) are FIT;
 *    HA (the slow test) is pending. No certificate is issued: the lot only counts as cleared (Ready to pack).
 *  - It may be packed and shipped; no COA goes with the truck; the final COA follows analyst, AQCM, QCM.
 *  - Final UNFIT: no automatic hold. The Plant Manager decides on Today: the lot (rework or deviation, as before),
 *    each run still at VAN (keep or rework, rework holds it), each truck that left (accept with a reason, or
 *    inform the COO, who gets a job that opens the complaint form filled in).
 *  - "HA pending" shows on Ready to pack, the packed runs and the truck screens, never on the DC.
 * Runs the real functions from o2s.html. Run: node audit17c.test.js */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const H = require('./harness.js');
let pass = 0, fail = 0; const fails = [];
const ok = (n, c, x) => c ? pass++ : (fail++, fails.push(n + (x ? '  [' + x + ']' : '')));
const eq = (n, g, w) => ok(n, g === w, 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w));
const html = H.html;
const TODAY = '2026-10-17';
const provVar = (html.match(/var PROV_ITEMS=[^;]+;/) || [''])[0];
const FNS = ['provRule','lotProvActive','lotProvDate','batchHasProv','provMay','provQuick','provWhyNot','provRelease','provBannerHTML','batchApprovedOnlyKg','provStampRun','provRunLots','lotProvUnfit','runProvState','provRunLeft','provTag','provLineTag','provTruckText','provTraceHTML','provTrucksOf','provUnfitFacts','provComplaintFor','provJobs','provMayDecide','openProvUnfit','renderProvUnfit','_provCtx','provRunDecide','provShipDecide','provRaiseComplaint',
  'coaCtx','coaItemOf','batchLabApproved','batchPackableKg','batchClearedKg','lineApprovedProducedKg','_plFirstOk','packJobSince','cmpTruckLeft','cmpLeftKg','cmpRunAtVan','cmpRFNew','cmpDelivered','coaSamePerson','provUnfitDate','coaRework','coaDeviation','lotsFor'];
const SRC = provVar + '\nvar PACK_JOB_SINCE="2026-01-01"; var provForm=null; var coaForm={}; var cmpRF=null; var cmpTab="";\n' + FNS.map(n => H.grab(n)).join('\n');

function make(role) {
  const s = { console, Date, Math, JSON, Object, Array, String, isNaN, toasts: [], logs: [], audits: [], saved: 0, modal: '', screen: '',
    fmt: n => Math.round(n).toLocaleString('en-US'), qsEsc: x => String(x == null ? '' : x).replace(/</g, '&lt;'), labRanATest: () => false, cmpAway: () => !!s.away, coaEsc: x => String(x == null ? '' : x), _pe: x => String(x == null ? '' : x), _av: x => String(x == null ? '' : x),
    localDateOf: d => String(d).slice(0, 10), evToday: () => TODAY, _plDay: d => String(d || ''), shortClient: c => c, lotBrandNo: p => p.brandBatchNo || '',
    sigStamp: () => ({}), coaTS: () => TODAY, labCovers: () => false, labOnBehalf: () => null, coaFSClose: () => {}, coaPersistDraft: () => {}, closeModal: () => {}, render: () => {},
    qcAudit2: (b, f, v) => s.audits.push(f + ': ' + v), toast: m => s.toasts.push(m), logAction: m => s.logs.push(m), save: () => { s.saved++; },
    hardRole: roles => s.state.role === 'COO' || roles.includes(s.state.role), cmpBoss: () => s.state.role === 'COO', cmpMain: c => ({ st: c.st || 'raised' }),
    setScreen: x => { s.screen = x; }, prompt: () => s.promptAns || '', $: () => ({ classList: { add: () => {} }, set innerHTML(v) { s.modal = v; } }) };
  s.state = { role, currentUser: { name: role === 'COO' ? 'Tahir' : (role === 'Plant Manager' ? 'Plant Mgr' : 'Lab Lead'), username: 'u' }, batches: [], orders: [], packingLog: [], shipments: [], complaints: [], audit: [] };
  s.globalThis = s; vm.createContext(s); vm.runInContext(SRC, s); return s;
}
const T = (test, result, remark) => ({ test, spec: '', result, remark });
function quickCOA(st, ha) { return { status: st || 'draft', tests: [T('Physical Status', 'Powder', 'FIT'), T('Color', 'Black', 'FIT'), T('Moisture', '12', 'FIT'), T('HA', ha || '', ha ? 'FIT' : ''), T('K2O', '10', 'FIT')], analyst: { date: '2026-10-17' } }; }
function world(s) {
  const b = { id: 'B1', kind: 'bulk', base: 'Potassium Humate', batchNo: 'HG26050', producedKg: 2000, packedKg: 0, disposedKg: 0,
    lots: [{ id: 'L1', lotNo: 'HG26050-L1', qty: 1000, coa: quickCOA('draft') }, { id: 'L2', lotNo: 'HG26050-L2', qty: 1000, coa: { status: 'approved', certifiedKg: 1000, approvedDate: '2026-10-15', tests: [] } }] };
  s.state.batches = [b]; s.coaForm = { bid: 'B1', lid: 'L1' }; vm.runInContext('coaForm={bid:"B1",lid:"L1"}', s); return b;
}

/* 1. which lots */
{ const s = make('AQCM'); const b = world(s);
  ok('1a Potassium Humate has a rule', !!s.provRule(b));
  ok('1b Potassium Humate Liquid has none', !s.provRule({ kind: 'bulk', base: 'Potassium Humate Liquid' }));
  ok('1c another product has none', !s.provRule({ kind: 'bulk', base: 'Max Potash' }));
  const Q = s.provQuick(b, b.lots[0]); eq('1d 4 quick tests', Q.quick.map(t => t.test).join(','), 'Physical Status,Color,Moisture,K2O'); eq('1e HA is the slow test', Q.slow.map(t => t.test).join(','), 'HA');
  eq('1f all quick FIT: may release', s.provWhyNot(b, b.lots[0]), '');
  ok('1g on the batch, not a lot: refused', /for 1 lot/.test(s.provWhyNot(b, b)));
  ok('1h approved: refused', /already approved/.test(s.provWhyNot(b, b.lots[1])));
  b.lots[0].coa.tests[2].result = ''; ok('1i a quick result missing: refused', /Enter the result of Moisture/.test(s.provWhyNot(b, b.lots[0])));
  b.lots[0].coa.tests[2].result = '14'; b.lots[0].coa.tests[2].remark = 'UNFIT'; ok('1j a quick test UNFIT: refused', /Moisture is not marked FIT/.test(s.provWhyNot(b, b.lots[0])));
  b.lots[0].coa.status = 'failed'; ok('1k a failed lot: refused', /Plant Manager decides/.test(s.provWhyNot(b, b.lots[0])));
  b.lots[0].coa = null; ok('1l no result: refused', /No result/.test(s.provWhyNot(b, b.lots[0])));
  const b2 = { kind: 'bulk', base: 'Potassium Humate', lots: [{ id: 'X', coa: { status: 'draft', tests: [T('Physical Status', 'P', 'FIT'), T('K2O', '9', 'FIT')] } }] };
  ok('1m no slow test: approve as usual', /no slow test/.test(s.provWhyNot(b2, b2.lots[0])));
  const b3 = { kind: 'bulk', base: 'Potassium Humate', lots: [{ id: 'X', coa: Object.assign(quickCOA('analysed'), { deviation: { note: 'x' } }) }] };
  ok('1n a deviation lot follows the full approval', /deviation/.test(s.provWhyNot(b3, b3.lots[0])));
  const b4 = { kind: 'bulk', base: 'Potassium Humate', lots: [{ id: 'X', coa: quickCOA('analysed', '45') }] };
  ok('1o submitted (analysed): no release, it follows the full approval', /already submitted/.test(s.provWhyNot(b4, b4.lots[0])));
  const b5 = { kind: 'bulk', base: 'Potassium Humate', lots: [{ id: 'X', coa: quickCOA('draft', '45') }] };
  ok('1p HA already entered: no release', /HA is already entered/.test(s.provWhyNot(b5, b5.lots[0])));
  ok('1q Humic acid named in full is the slow test too', s.provQuick(b5, { coa: { tests: [T('Humic Acid', '', '')] } }).slow.length === 1);
}
/* 2. who */
for (const [r, w] of [['AQCM', true], ['QCM', true], ['Lab Rep', false], ['Plant Manager', false], ['Production Manager', false]]) { const s = make(r); eq('2 ' + r + ' may release: ' + w, s.provMay(), w); }
/* 3. release */
{ const s = make('Lab Rep'); const b = world(s); s.provRelease(); ok('3a the analyst cannot', !b.lots[0].prov && /AQCM or the QCM/.test(s.toasts[0])); }
{ const s = make('QCM'); const b = world(s); s.provRelease(); const p = b.lots[0].prov;
  ok('3b the QCM releases', !!p && p.role === 'QCM' && p.by === 'Lab Lead' && p.kg === 1000);
  eq('3c the 4 quick results kept', p.tests.map(t => t.test + '=' + t.result).join(','), 'Physical Status=Powder,Color=Black,Moisture=12,K2O=10');
  eq('3d HA pending', p.pending.join(','), 'HA');
  ok('3e no certificate: the COA status is untouched', b.lots[0].coa.status === 'draft' && !b.lots[0].coa.approvedDate);
  ok('3f audit, log, saved', s.audits.length === 1 && /Released provisionally/.test(s.audits[0]) && /No certificate issued/.test(s.logs[0]) && s.saved === 1);
  s.provRelease(); ok('3g a second release is refused', /Already released/.test(s.toasts[s.toasts.length - 1]) && s.saved === 1);
}
{ const s = make('AQCM'); const b = world(s); b.lots[0].coa.analyst.name = 'Lab Lead'; s.provRelease(); ok('3h the AQCM may release results he entered himself (Tahir 17 Oct: no 2-person rule here)', !!b.lots[0].prov); }
/* 4. cleared, Ready to pack */
{ const s = make('AQCM'); const b = world(s);
  eq('4a before: cleared = the approved lot', s.batchClearedKg(b), 1000);
  s.provRelease();
  eq('4b after: the provisional lot counts as cleared', s.batchClearedKg(b), 2000);
  eq('4c packable', s.batchPackableKg(b), 2000);
  ok('4d a batch with only a provisional lot is lab-cleared', s.batchLabApproved({ lots: [b.lots[0]] }));
  ok('4e batchHasProv', s.batchHasProv(b));
  eq('4f cleared from the release day', s._plFirstOk({ lots: [b.lots[0]] }), TODAY);
  eq('4g the Pack job counts from it', s.packJobSince({ lots: [b.lots[0]] }), TODAY);
  const ob = { kind: 'po', po: 'P1', lineId: 'LN', lots: [b.lots[0]] }; s.state.batches.push(ob);
  eq('4h PO line approved Kg counts it', s.lineApprovedProducedKg({ po: 'P1' }, { id: 'LN' }), 1000);
  b.lots[0].coa.status = 'approved'; b.lots[0].coa.certifiedKg = 1000;
  ok('4i final approved: no longer provisional', !s.lotProvActive(b.lots[0]) && !s.batchHasProv(b));
  b.lots[0].coa.status = 'failed';
  ok('4j final UNFIT: the bulk is no longer cleared (it follows the normal path; packed runs are not held)', !s.lotProvActive(b.lots[0]) && s.batchClearedKg(b) === 1000 && !s.batchHasProv(b));
  b.lots[0].coa.status = 'draft'; b.lots[0].prov.final = { at: 'x' }; ok('4j2 a re-issue after the final approval does not bring the release back', !s.lotProvActive(b.lots[0])); delete b.lots[0].prov.final; b.lots[0].coa.status = 'failed';
  b.lots[0].prov.ended = { kind: 'rework' }; ok('4k sent to rework: no longer cleared', !s.lotProvActive(b.lots[0]) && s.batchClearedKg(b) === 1000);
}
/* 5. the runs remember the provisional Kg */
function packed(s, b, kg, id, po) { b.packedKg += kg; const row = { id, kg, po: po || 'P9', lid: 'LN', brand: 'Brand', brandBatchNo: b.batchNo, baseBatchId: b.id }; s.state.packingLog.unshift(row); s.provStampRun(b, row); return row; }
{ const s = make('AQCM'); const b = world(s); s.provRelease();
  const r1 = packed(s, b, 800, 'R1'); ok('5a run within the approved Kg: not provisional', !r1.prov);
  const r2 = packed(s, b, 700, 'R2'); ok('5b run past the approved Kg: provisional for the over part', r2.prov && r2.prov.kg === 500 && r2.prov.lots[0] === 'L1' && r2.prov.lotNos[0] === 'HG26050-L1');
  const r3 = packed(s, b, 300, 'R3'); ok('5c the next run all provisional', r3.prov && r3.prov.kg === 300);
  eq('5d run state pending', s.runProvState(r3), 'pending');
  ok('5e line tag HA pending', /HA pending/.test(s.provLineTag({ po: 'P9' }, { id: 'LN' })));
  s.state.shipments = [{ id: 'S1', dispId: 'D1', dc: 'DC-1', po: 'P9', batches: [{ lotId: 'R3', kg: 300 }] }];
  ok('5f truck text: no COA goes with the truck', /HA pending: no COA goes with this truck/.test(s.provTruckText(s.state.shipments)));
  ok('5g trace note', /released provisionally by Lab Lead/.test(s.provTraceHTML(b)) && /HA pending/.test(s.provTraceHTML(b)));
  b.lots[0].coa.status = 'approved'; eq('5h final approved: run state clear', s.runProvState(r3), ''); eq('5i no truck text', s.provTruckText(s.state.shipments), '');
  const s2 = make('AQCM'); const b2 = world(s2); const r0 = packed(s2, b2, 500, 'R0'); ok('5j no provisional lot: nothing stamped', !r0.prov);
}
/* 6. jobs */
{ const s = make('AQCM'); const b = world(s);
  let j = s.provJobs(); eq('6a 1 job: release provisionally', j.length, 1);
  ok('6b for the AQCM, also the QCM, on the lot', j[0].role === 'AQCM' && j[0].alsoRoles.join() === 'QCM' && j[0].lid === 'L1' && j[0].label === 'Release provisionally' && /HA pending/.test(j[0].what));
  b.lots[0].coa.tests[0].remark = ''; eq('6c not while a quick test is open', s.provJobs().length, 0); b.lots[0].coa.tests[0].remark = 'FIT';
  s.provRelease(); eq('6d released: the job goes', s.provJobs().length, 0);
  b.lots[0].coa.status = 'failed'; b.lots[0].coa.tests[3] = T('HA', '40', 'UNFIT');
  j = s.provJobs(); ok('6e final UNFIT: the Plant Manager job', j.length === 1 && j[0].role === 'Plant Manager' && j[0].label === 'Provisional lot UNFIT' && /the lot/.test(j[0].what));
}
/* 7. the Plant Manager decides: lot, runs at VAN, trucks */
function unfitWorld(role) { const s = make('AQCM'); const b = world(s); s.provRelease(); const r1 = packed(s, b, 1000, 'R1'); const r2 = packed(s, b, 600, 'R2', 'P7'); const r3 = packed(s, b, 400, 'R3', 'P8');
  s.state.orders = [{ id: 'O7', po: 'P7', client: 'Client A' }, { id: 'O8', po: 'P8', client: 'Client B' }];
  s.state.shipments = [{ id: 'S1', dispId: 'D1', dc: 'DC-11', po: 'P7', client: 'Client A', dispCounted: true, batches: [{ lotId: 'R2', kg: 600 }] }];
  b.lots[0].coa.status = 'failed'; b.lots[0].coa.tests[3] = T('HA', '40', 'UNFIT'); s.state.role = role; s.state.currentUser.name = role === 'COO' ? 'Tahir' : 'Plant Mgr'; return { s, b, r1, r2, r3 }; }
{ const { s, b, r2, r3 } = unfitWorld('Plant Manager');
  const F = s.provUnfitFacts(b, b.lots[0]);
  ok('7a runs: R1 fully approved Kg is not involved', F.runs.map(r => r.id).sort().join() === 'R2,R3', F.runs.map(r => r.id).join());
  ok('7b at VAN: R3; trucks: DC-11', F.atVan.map(r => r.id).join() === 'R3' && F.trucks.length === 1 && F.trucks[0].dc === 'DC-11' && F.trucks[0].kg === 600);
  eq('7c run on the truck shows UNFIT', s.runProvState(r2), 'unfit');
  ok('7d the truck shows UNFIT, Plant Manager deciding', /final COA UNFIT/.test(s.provTruckText(s.state.shipments)));
  s.openProvUnfit('B1', 'L1'); ok('7e the sheet lists the 3 parts', /1\. The lot/.test(s.modal) && /2\. Runs packed and still at VAN/.test(s.modal) && /3\. Trucks that left/.test(s.modal) && /DC DC-11/.test(s.modal) && /UNFIT on HA 40/.test(s.modal));
  s.provForm.why.R3 = 'abc'; s.provRunDecide('R3', 'rework'); ok('7f a short reason is refused', !r3.provDecision && /at least 5/.test(s.toasts.pop()));
  r3.insKg = 400; s.provForm.why.R3 = 'HA is low, repack after rework'; s.provRunDecide('R3', 'rework');
  ok('7g rework: decided and held for Production', r3.provDecision.kind === 'rework' && r3.qaHold && r3.qaHold.kg === 400 && /came back UNFIT/.test(r3.qaHold.reason) && r3.qaHold.fails[0] === 'Final COA UNFIT');
  ok('7g2 rework: the inspected Kg go back for inspection', r3.insKg === 0 && r3.provReinsp && r3.provReinsp.from === 400);
  eq('7h run state rework', s.runProvState(r3), 'rework');
  s.provRunDecide('R3', 'keep'); ok('7i decided once', /Already decided/.test(s.toasts.pop()));
  s.provForm.why.TD1 = 'Customer agreed, minor HA gap'; s.provShipDecide('D1', 'accept');
  ok('7j truck accepted with the reason', b.lots[0].prov.ship.D1.kind === 'accept' && b.lots[0].prov.ship.D1.dc === 'DC-11');
  eq('7k the truck no longer shows deciding', s.provTruckText(s.state.shipments), '');
  let j = s.provJobs(); ok('7l the job stays for the lot', j.length === 1 && /the lot/.test(j[0].what) && !/run/.test(j[0].what) && !/truck/.test(j[0].what));
  s.promptAns = 'Accept, HA 40 is usable'; vm.runInContext('coaForm={bid:"B1",lid:"L1"}', s); s.coaDeviation();
  ok('7m deviation: recorded on the provisional lot', b.lots[0].prov.unfit && b.lots[0].prov.unfit.decided === 'deviation' && b.lots[0].coa.status === 'analysed');
  eq('7n all decided: the job goes', s.provJobs().length, 0);
}
{ const { s, b, r3 } = unfitWorld('Plant Manager'); s.openProvUnfit('B1', 'L1');
  s.provForm.why.R3 = 'Low HA but usable for this client'; s.provRunDecide('R3', 'keep'); ok('7o keep: no hold', r3.provDecision.kind === 'keep' && !r3.qaHold);
  s.promptAns = 'Rework the bulk, HA low'; vm.runInContext('coaForm={bid:"B1",lid:"L1"}', s); s.coaRework();
  ok('7p rework of the lot: bulk only, provisional ended', b.lots[0].prov.ended && b.lots[0].prov.unfit.decided === 'rework' && b.lots[0].coa === null && !s.lotProvActive(b.lots[0]));
  ok('7q the truck still to decide', s.provJobs().some(x => x.label === 'Provisional lot UNFIT' && /1 truck shipped/.test(x.what)));
}
{ const { s, b } = unfitWorld('Production Manager'); s.openProvUnfit('B1', 'L1'); s.provForm.why.TD1 = 'not mine to say'; s.provShipDecide('D1', 'accept');
  ok('7r only the Plant Manager decides', !(b.lots[0].prov.ship || {}).D1 && /Plant Manager decides/.test(s.toasts.pop()));
  ok('7s others see the sheet read only', /Waiting for the Plant Manager/.test(s.modal) && !/provShipDecide/.test(s.modal)); }
{ const { s, r3 } = unfitWorld('Plant Manager'); r3.shipKg = 400; s.state.shipments.push({ id: 'S2', dispId: 'D2', dc: 'DC-12', po: 'P8', batches: [{ lotId: 'R3', kg: 400 }] });
  s.openProvUnfit('B1', 'L1'); s.provForm.why.R3 = 'HA low, rework these bags'; s.provRunDecide('R3', 'rework');
  ok('7t rework refused while the run is on a planned truck', !r3.provDecision && /planned truck/.test(s.toasts.pop()));
  s.provRunDecide('R3', 'keep'); s.state.shipments[1].dispCounted = true;
  const F = s.provUnfitFacts(s.state.batches[0], s.state.batches[0].lots[0]);
  ok('7u a kept run that leaves later is not asked again as a truck', F.trucks.length === 2 && F.truckOpen.map(t => t.dispId).join() === 'D1'); }
/* 8. inform the COO, the complaint form */
{ const { s, b } = unfitWorld('Plant Manager'); s.openProvUnfit('B1', 'L1');
  s.provForm.why.TD1 = 'Client is big, what do we do? <b>'; s.provShipDecide('D1', 'refer');
  let j = s.provJobs().filter(x => x.label === 'Provisional lot referred');
  ok('8a the COO gets a job', j.length === 1 && j[0].role === 'COO' && j[0].disp.dispId === 'D1' && /DC-11/.test(j[0].what) && /Client is big/.test(j[0].what) && !j[0].alsoRoles);
  ok('8a2 the note is escaped on Today', !/<b>/.test(j[0].what) && /&lt;b>/.test(j[0].what));
  ok('8a3 not delivered yet: the job says so', /once the delivery is confirmed/.test(j[0].what));
  s.away = true; ok('8a4 Tahir away: the Plant Manager sees it too', s.provJobs().filter(x => x.label === 'Provisional lot referred')[0].alsoRoles.join() === 'Plant Manager'); s.away = false;
  s.state.role = 'Plant Manager'; s.provRaiseComplaint('B1', 'L1', 'D1'); ok('8b only Tahir raises it', s.cmpRF === null && /Only Tahir/.test(s.toasts.pop()));
  s.state.role = 'COO'; vm.runInContext('cmpRF=null', s); s.provRaiseComplaint('B1', 'L1', 'D1'); ok('8b2 not delivered yet: the form waits', vm.runInContext('cmpRF', s) === null && /not confirmed delivered/.test(s.toasts.pop()));
  s.state.shipments[0].delivered = true; s.provRaiseComplaint('B1', 'L1', 'D1'); const f = vm.runInContext('cmpRF', s);
  ok('8c the form is filled in', f.customer === 'Client A' && f.po === 'P7' && f.type === 'spec' && f.cause === 'Content' && f.qty === 600 && f.pick['S1|0'] === true && f.received === TODAY);
  ok('8d what was seen names the lot, the result and his note', /HG26050-L1/.test(f.seen) && /HA 40/.test(f.seen) && /Client is big/.test(f.seen));
  ok('8d2 delivered: the job no longer says wait', !/once the delivery/.test(s.provJobs().filter(x => x.label === 'Provisional lot referred')[0].what));
  ok('8e opens Complaints, Raise', s.screen === 'complaints' && vm.runInContext('cmpTab', s) === 'raise');
  s.state.complaints = [{ id: 'C1', items: [{ dispId: 'D1' }] }];
  eq('8f the complaint is raised: the COO job goes', s.provJobs().filter(x => x.label === 'Provisional lot referred').length, 0);
  s.state.complaints[0].st = 'cancelled'; eq('8g a cancelled complaint brings it back', s.provJobs().filter(x => x.label === 'Provisional lot referred').length, 1);
}
/* 9. the build: screens, jobs, Guide, never on the DC */
const fnSrc = n => H.grab(n);
ok('9a cleared lots: provisional in batchClearedKg, batchPackableKg, batchLabApproved, lineApprovedProducedKg', ['batchClearedKg', 'batchPackableKg', 'batchLabApproved', 'lineApprovedProducedKg'].every(n => /lotProvActive/.test(fnSrc(n))));
ok('9b every pack path stamps the run', ['doPack', 'submitProdQty', 'dfSubmitPacking', 'lineFixRecord'].every(n => /provStampRun/.test(fnSrc(n))));
ok('9c the generic UNFIT job skips a provisional lot', /st==='failed'&&!u\.prov/.test(html) && /prov:l\.prov/.test(html));
ok('9d Lab QC job says finish the full test', /released provisionally: finish the full test/.test(html));
ok('9e Today items include provJobs', /provJobs\(\)\.forEach\(function\(it\)\{ items\.push\(it\); \}\)/.test(fnSrc('actionItems')));
ok('9f the certificate shows Release provisionally to the AQCM/QCM', /onclick="provRelease\(\)">Release provisionally/.test(html) && /provBannerHTML\(b,coaForm\)/.test(html));
ok('9g rework and deviation record the provisional lot', /prov\.ended/.test(fnSrc('coaRework')) && /prov\.unfit/.test(fnSrc('coaDeviation')));
ok('9h HA pending: Ready to pack card, Pack sheet, QA lines, ship ready, truck card', /provisional \\u00b7 HA pending/.test(fnSrc('tdReadyCard')) && /provisional, HA pending/.test(fnSrc('packBaseField')) && /provTruckText/.test(fnSrc('shipCard')) && (html.match(/provLineTag\(/g) || []).length >= 4);
ok('9i never on the DC', !/provTruckText|provLineTag|provTag|HA pending|lotProvActive|provisional/i.test(fnSrc('printDC')));
ok('9j job titles', /'Release provisionally': \{title:/.test(html) && /'Provisional lot UNFIT': \{title:/.test(html) && /'Provisional lot referred': \{title:/.test(html));
const R = require('../notify-routes.js');
ok('9k alerts: who', R.JOB_ROLES['Release provisionally'].join() === 'AQCM,QCM' && R.JOB_ROLES['Provisional lot UNFIT'].join() === 'Plant Manager' && R.JOB_ROLES['Provisional lot referred'].join() === 'COO');
ok('9l Guide rule R-043', /<h3>Releasing a lot before the full certificate<\/h3>/.test(html) && /'Releasing a lot before the full certificate':'R-043'/.test(html));
ok('9m RULES.txt', /R-043\tReleasing a lot before the full certificate/.test(fs.readFileSync(path.join(__dirname, '..', 'docs', 'System Documentation', 'RULES.txt'), 'utf8')));
ok('9n change log and build', /ver:'2026-10-17c'/.test(html) && ((/var BUILD_ID='([^']+)'/.exec(html)||[])[1]||'')>='2026-10-17c');   /* 21a: a later build keeps 17c in the log; pinned like 16a */
ok('9o My job notes for the lab, the Plant Manager and the COO', /var _n17c=\{'AQCM':/.test(html) && /'Plant Manager':'A Potassium Humate lot may be released provisionally/.test(html));
ok('9q the final approval ends the release; a leave cover sees the release job', /h\.prov\.final=\{at:/.test(fnSrc('coaApprove')) && /Release provisionally/.test(fnSrc('labCoverSees')));
ok('9r the button shows only when the lot may be released', /st==='draft'&&!provWhyNot\(b,_pvh\)/.test(html));
ok('9p only Potassium Humate', /var PROV_ITEMS=\{'Potassium Humate':\{slow:/.test(html) && !/var PROV_ITEMS=\{[^}]*\},'/.test(html));

console.log(fails.length ? 'FAILED:\n  ' + fails.join('\n  ') : '');
console.log('17c: provisional lot release: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
