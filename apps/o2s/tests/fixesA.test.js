/* 7 Oct 2026 (07e) — LIST A: things that could make stock or numbers wrong.
   Each case below failed on the code before 07e. Run: node fixesA.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, grabTopVar } = H;
const sb = { console, toasts: [], toast: m => sb.toasts.push(m), fmt: n => String(Math.round(n)), save: () => {}, dfBack: () => {}, recordBackfill: () => {}, logAction: () => {},
  screenEditOK: () => true, dfReasonOk: () => true, packDates: () => ({}), batchLabApproved: () => true, TODAY: new Date('2026-10-07T06:00:00Z') };
vm.createContext(sb);
vm.runInContext(['_uid', 'nid', '_arrId', '_eq', 'merge3', 'lotBaseNo', 'lotBrandNo', 'lotsFor', '_releaseShip', 'batchPackableKg', 'lineOnTruckKg', 'dfSubmitShipment', 'dfSubmitPacking', 'dfSubmitProduction', 'mergeDupNumbers'].map(f => { try { return grab(f); } catch (e) { return ''; } }).join('\n')
  + '\nvar dfForm={};', sb);

/* A1 - after 2 audits: no adding in the merge (it double-counted); a lost pack is caught */
ok('A1: the merge is back to "mine wins" (no counter adding, no save queue)', !/MERGE_COUNTERS|_mergeCounter|_saveInFlight/.test(H.html.replace(/\/\*[\s\S]*?\*\//g, '')));
{ const sx = { console, fmt: n => String(Math.round(n)), unitOf: () => 'Kg/L', saleLeft: () => true, state: { packingLog: [{ id: 'P1', po: 'X', lid: 'a', kg: 300 }, { id: 'P2', po: 'X', lid: 'a', kg: 300 }], shipments: [] } };
  vm.createContext(sx); vm.runInContext(['lotsFor', 'lineFacts', 'lineIssues', 'lineShortClosed'].map(grab).join('\n'), sx);
  const I = sx.lineIssues({ po: 'X' }, { id: 'a', brand: 'B', ordered: 1000, packed: 300 });
  ok('A1: a line whose packing records (600) exceed its packed (300) is flagged', I.some(i => i.k === 'lost' && /300 Kg\/L in packing records not counted/.test(i.t)));
  ok('A1: it goes on the packing list of Needs you, with a fix that raises packed to its records', /i\.k==='lost'/.test(grab('lineFixRows')) && /F\.gap<-0\.5;/.test(grab('lineFixOpen')) && /if a record is a copy of another|if one is a copy of another/.test(grab('lineFixOpen')) && /if\(to>was\) l\.produced=Math\.max/.test(grab('lineFixCut'))); }

/* A2 */
sb.state = { packingLog: [{ id: 'P1', po: 'X', lid: 'a', brand: 'B', kg: 500, insKg: 500, shipKg: 500, baseBatchNo: 'VB26001' }, { id: 'P2', po: 'X', lid: 'a', brand: 'B', kg: 500, insKg: 500, shipKg: 500, baseBatchNo: 'VB26001' }] };
vm.runInContext('state=this.state', sb);
const o = { po: 'X' }, l = { id: 'a', brand: 'B' };
sb._releaseShip(o, l, [{ lotId: 'P2', batch: 'VB26001', kg: 400 }]);
ok('A2: cancelling a truck that took 400 from P2 frees only P2 (P1 untouched)', sb.state.packingLog[0].shipKg === 500 && sb.state.packingLog[1].shipKg === 100);
sb.state.packingLog.forEach(p => p.shipKg = 500);
sb._releaseShip(o, l, [{ batch: 'VB26001', kg: 400 }]);
ok('A2: an old row with no lotId frees one lot only, once', sb.state.packingLog.filter(p => p.shipKg === 100).length === 1 && sb.state.packingLog.filter(p => p.shipKg === 500).length === 1);

/* A3 */
ok('A3: editing a truck no longer re-spreads shipped Kg over the lots', !/resyncLineShipKg/.test(grab('saveShipEdit')));

/* A4 */
sb.state = { role: 'COO', orders: [{ id: 'O1', po: 'X', lines: [{ id: 'a', brand: 'B', ordered: 300, packed: 300, dispatched: 0, delivered: 0 }] }], shipments: [], warehouses: ['W'],
  packingLog: [{ id: 'P1', po: 'X', lid: 'a', brand: 'B', kg: 300, insKg: 300, shipKg: 0, baseBatchNo: 'B1' }] };
vm.runInContext('state=this.state; dfForm={oid:"O1",lid:"a",qty:300,date:"2026-10-01"}', sb);
sb.dfSubmitShipment();
ok('A4: a back-filled truck takes its 300 Kg off the lot (nothing left to ship again)', sb.state.packingLog[0].shipKg === 300 && sb.state.orders[0].lines[0].dispatched === 300);
ok('A4 (audit): no guessed lot links are stored on the back-filled truck', !sb.state.shipments[0].batches);

/* A5 */
const B = { id: 'B1', batchNo: 'VB1', producedKg: 500, packedKg: 450, coa: { status: 'approved' } };
sb.state = { role: 'COO', batches: [B], packingLog: [], productionLog: [], orders: [{ id: 'O1', po: 'X', lines: [{ id: 'a', brand: 'B', base: 'b', ordered: 1000, packed: 0, produced: 0 }] }] };
vm.runInContext('state=this.state; dfForm={oid:"O1",lid:"a",bid:"B1",qty:300}', sb);
sb.dfSubmitPacking();
ok('A5: back-fill packing refuses more than the batch has left (50 of 500)', /has only 50 Kg/.test(sb.toasts[sb.toasts.length - 1]) && B.packedKg === 450 && sb.state.orders[0].lines[0].packed === 0);
vm.runInContext('dfForm={kind:"po",oid:"O1",lid:"a",qty:5000}', sb);
sb.dfSubmitProduction();
ok('A5: back-fill production refuses 5,000 on a 1,000 line', /more than the line still needs/.test(sb.toasts[sb.toasts.length - 1]) && sb.state.orders[0].lines[0].produced === 0);

/* A6 */
ok('A6: truck and inspection ids are unique, not a per-tab counter', /const dispId=_uid\('DSP'\)/.test(grab('saveDispatch')) && /var dispId=_uid\('DSP'\)/.test(grab('mpCreate')) && /\{id:_uid\('INS'\),po:o\.po/.test(grab('savePackInspect')));
sb.state = { shipments: [{ dispId: 'D1', dc: '5228', gatePass: 'GP-0200' }, { dispId: 'D2', dc: '5228', gatePass: 'GP-0201' }] };
vm.runInContext('state=this.state', sb);
const w = sb.mergeDupNumbers({ shipments: [{ dispId: 'D1', dc: '5228' }] });
ok('A6: after a merge, a DC number now on 2 trucks (one given here) is called out', w.length === 1 && /DC 5228 was given to 2 trucks/.test(w[0]));
sb.state.shipments = [{ dispId: 'D1', dc: '1', gatePass: 'GP-0042' }, { dispId: 'D2', dc: '2', gatePass: 'GP-0042' }];
ok('A6 (audit): a gate pass given here to a truck already on the server is caught too', sb.mergeDupNumbers({ shipments: [{ dispId: 'D1', dc: '1', gatePass: '' }, { dispId: 'D2', dc: '2', gatePass: 'GP-0042' }] }).some(x => /Gate pass GP-0042/.test(x)));
ok('A6 (audit): no warning when both numbers came from the server', sb.mergeDupNumbers({ shipments: [{ dispId: 'D1', dc: '1', gatePass: 'GP-0042' }, { dispId: 'D2', dc: '2', gatePass: 'GP-0042' }] }).length === 0);
ok('A6: the warning is raised from the 409 merge', /mergeDupNumbers\(j\.data\)/.test(grab('saveNow')));

/* A7 */
eq('A7: a batch whose leftover was kept as bulk stock can still be packed', sb.batchPackableKg({ reconciled: true, disposedKg: 0, stockKept: { kg: 300 }, producedKg: 1000, packedKg: 700, coa: { status: 'approved' } }), 300);
eq('A7: a reconciled batch with nothing kept stays closed to packing', sb.batchPackableKg({ reconciled: true, disposedKg: 0, producedKg: 1000, packedKg: 700, coa: { status: 'approved' } }), 0);
ok('A7 (audit): kept stock shows in the line\'s pack picker and the bulk stock list', /\(!b\.reconciled\|\|b\.stockKept\)/.test(grab('poBatchesForLine')) && /b\.type==='stock'&&\(!b\.reconciled\|\|b\.stockKept\)/.test(H.html));
ok('A6 (audit): people see the DC or ship number, not the long truck id', !/\('\+dispId\+'\) created/.test(H.html) && /dc:g\.dc\|\|'',shipNo:g\.shipNo/.test(H.html));

/* (withdrawn: the one-save-at-a-time queue) */
process.exitCode = report('List A: stock and numbers (07e)') ? 1 : 0;
