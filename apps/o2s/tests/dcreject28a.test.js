/* BUILD 2026-10-28a. Tahir, 28 Oct 2026: DC 5260 (EXCL002, Humi Grow, 10,000 Kg, truck TAT 097) failed inspection on 26 Oct 2026 at 23:54 (18:54 UTC);
   the same truck left on a new DC 5261 (gate pass GP-0185) on 27 Oct and the PO was delivered, but 'Truck failed' stayed on Supply Chain's list until it
   was read on 28 Oct. The note says the material is back under Ready to ship. It now clears by itself when, for every product on the failed DC, no line of
   that PO with that product has packed and cleared stock waiting for a truck (lineCleared, the figure the Ship job uses). Stock on another truck (planned,
   loading or gone) is not waiting. Found by the independent review: a second truck of the same PO that was always planned must not close the note,
   a part replan must not, and a truck that has only a gate pass is already carrying the stock.
   The fixture is shaped like the live records read on 28 Oct 2026 (EXCL002: ordered, packed, dispatched and delivered 10,000 Kg Humi Grow).
   Run: node dcreject28a.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;

const sb = { Object, String, Array, Number, Math, Date };
sb.state = {};
vm.createContext(sb);
['lotBaseNo', 'lotHasBatch', 'lotClearedKg', 'lotShipKg', 'lotsFor', 'lineCleared', 'localDateOf', 'dcRejectWaitKg', 'dcRejectCovered', 'dcRejectJobs', 'cmpHoldMap', 'cmpLotHold', '_releaseShip'].forEach(n => vm.runInContext(grab(n), sb));
vm.runInContext('var _cmpHM=null; function cmpMain(c){return {st:c.st||"open"};}', sb);

const rej = (o) => Object.assign({ id: 'DCR1', dispId: 'DSP1', dc: '5260', po: 'EXCL002', client: 'Excel Chemical', by: 'Muhammad Asif', at: '2026-10-26T18:54:41.622Z', why: 'x', kind: 'qa' }, o || {});
const failed = (o) => Object.assign({ id: 'SH1', dispId: 'DSP1', dc: '5260', po: 'EXCL002', brand: 'Humi Grow', kg: 10000, voided: true, stage: 'loading' }, o || {});
const lot = (o) => Object.assign({ id: 'PK1', po: 'EXCL002', lid: 'L1', brand: 'Humi Grow', kg: 10000, insKg: 10000, shipKg: 0, baseBatchNo: 'HG26001', date: '2026-10-20' }, o || {});
const order = (lines) => ({ id: 'O1', po: 'EXCL002', client: 'Excel Chemical', lines: lines || [{ id: 'L1', brand: 'Humi Grow', ordered: 10000 }] });
/* waiting = stock back under Ready to ship (nothing on a truck); loaded = the same stock now on another truck */
const run = (dcRejects, shipments, packingLog, orders) => { sb.state = { dcRejects, shipments, packingLog, orders }; return sb.dcRejectJobs(); };
const waiting = () => [lot({ shipKg: 0 })], loaded = () => [lot({ shipKg: 10000 })];

/* the live case: the same truck left on a new DC, the material is on a truck and gone */
eq('live case: the material left on DC 5261, so no job', run([rej()], [failed()], loaded(), [order()]).length, 0);
/* right after the failure the stock is back under Ready to ship: the job shows */
eq('right after the failure the stock is waiting: the job shows', run([rej()], [failed()], waiting(), [order()]).length, 1);
eq('the job reads Truck failed with the DC and the reason', run([rej()], [failed()], waiting(), [order()])[0].what, 'Truck failed inspection — EXCL002 · DC 5260 · by Muhammad Asif: “x”');
eq('the job goes to Supply Chain', run([rej()], [failed()], waiting(), [order()])[0].role, 'Supply Chain');
/* review finding 1: a second truck of the same PO that was always planned does not close the note */
{ const lots = [lot({ id: 'PK1', shipKg: 0 }), lot({ id: 'PK2', kg: 10000, insKg: 10000, shipKg: 10000, baseBatchNo: 'HG26002' })];
  eq('PO of 20,000 in 2 trucks: truck 2 loaded, the failed 10,000 still waits: the job stays', run([rej()], [failed()], lots, [order([{ id: 'L1', brand: 'Humi Grow', ordered: 20000 }])]).length, 1); }
/* review finding 1b: 2 failed trucks, 1 replacement: stock of one still waits, both notes stay */
{ const lots = [lot({ id: 'PK1', shipKg: 0 }), lot({ id: 'PK2', baseBatchNo: 'HG26002', shipKg: 10000 })];
  const n = run([rej(), rej({ id: 'DCR2', dispId: 'DSP2', dc: '5262' })], [failed(), failed({ id: 'SH2', dispId: 'DSP2', dc: '5262' })], lots, [order([{ id: 'L1', brand: 'Humi Grow', ordered: 20000 }])]).length;
  eq('2 failed trucks, 1 replacement: the notes stay while 10,000 waits', n, 2); }
/* review finding 2: a replacement with only a gate pass (not yet released) already carries the stock */
eq('stock on a loading truck (gate pass, not released) is not waiting: the job goes', run([rej()], [failed(), { id: 'SH3', dispId: 'DSP3', po: 'EXCL002', brand: 'Humi Grow', kg: 10000, stage: 'loading', gatePassAt: '2026-10-26T19:20:33.665Z' }], loaded(), [order()]).length, 0);
/* part replan: 4,000 of 10,000 on a truck, 6,000 still waits */
eq('part replan (4,000 on a truck, 6,000 waiting): the job stays', run([rej()], [failed()], [lot({ shipKg: 4000 })], [order()]).length, 1);
/* a replacement truck cancelled or failed again gives the stock back: the job shows again */
eq('replacement cancelled, stock back: the job shows again', run([rej()], [failed()], waiting(), [order()]).length, 1);
/* a lot with no batch number or on QA hold cannot go on a truck; it is not Ready to ship */
eq('stock on QA hold is not Ready to ship: the job goes', run([rej()], [failed()], [lot({ qaHold: true })], [order()]).length, 0);
/* another product waiting on the same PO does not keep this note; the failed product does */
{ const lots = [lot({ shipKg: 10000 }), lot({ id: 'PK9', lid: 'L2', brand: 'Max Zinc', kg: 500, insKg: 500, shipKg: 0, baseBatchNo: 'MZ1' })];
  eq('another product waiting: the Humi Grow note goes', run([rej()], [failed()], lots, [order([{ id: 'L1', brand: 'Humi Grow', ordered: 10000 }, { id: 'L2', brand: 'Max Zinc', ordered: 500 }])]).length, 0); }
/* another PO waiting does not keep this note */
eq('stock of another PO waiting: the job goes', run([rej()], [failed()], loaded().concat([lot({ id: 'PK8', po: 'EXCL009', lid: 'L9', shipKg: 0 })]), [order()]).length, 0);
/* a mixed DC: every product must be clear */
{ const f = [failed({ brand: 'Humi Grow', kg: 3000 }), failed({ id: 'SH1b', brand: 'Max Zinc', kg: 500 })];
  const ords = [order([{ id: 'L1', brand: 'Humi Grow', ordered: 3000 }, { id: 'L2', brand: 'Max Zinc', ordered: 500 }])];
  const hg = lot({ kg: 3000, insKg: 3000, shipKg: 3000 }), mzWait = lot({ id: 'PK9', lid: 'L2', brand: 'Max Zinc', kg: 500, insKg: 500, shipKg: 0, baseBatchNo: 'MZ1' }), mzGone = Object.assign({}, mzWait, { shipKg: 500 });
  eq('mixed DC, one product still waiting: the job stays', run([rej()], f, [hg, mzWait], ords).length, 1);
  eq('mixed DC, both products on trucks: the job goes', run([rej()], f, [hg, mzGone], ords).length, 0); }
/* records that cannot be read never close a note */
eq('failed DC rows missing: the job stays', run([rej()], [], loaded(), [order()]).length, 1);
eq('order not found: the job stays', run([rej()], [failed()], loaded(), []).length, 1);
eq('no line of that product on the order: the job stays', run([rej()], [failed()], loaded(), [order([{ id: 'L7', brand: 'Max Zinc', ordered: 5 }])]).length, 1);
eq('failed rows with no brand: the job stays', run([rej()], [failed({ brand: '' })], loaded(), [order()]).length, 1);
eq('no shipments, no lots, no orders at all: the job stays and nothing throws', run([rej()], undefined, undefined, undefined).length, 1);
eq('a null row in every list is skipped', run([null, rej()], [null, failed()], [null, lot({ shipKg: 10000 })], [null, order()]).length, 0);
/* the older rule is kept */
eq('a note already read is not a job', run([rej({ seenAt: '2026-10-28T08:06:45.998Z' })], [failed()], waiting(), [order()]).length, 0);
eq('rejected DC (not QA), stock waiting: the job shows as DC rejected', run([rej({ kind: undefined })], [failed()], waiting(), [order()])[0].label, 'DC rejected');
eq('rejected DC (not QA), stock on a truck: the job goes', run([rej({ kind: undefined })], [failed()], loaded(), [order()]).length, 0);
/* two notes: only the covered one goes */
{ const sh = [failed(), failed({ id: 'SH9', dispId: 'DSP9', dc: '5300', po: 'EXCL009' })];
  const ords = [order(), { id: 'O9', po: 'EXCL009', lines: [{ id: 'L9', brand: 'Humi Grow', ordered: 10000 }] }];
  const lots = [lot({ shipKg: 10000 }), lot({ id: 'PK9', po: 'EXCL009', lid: 'L9', shipKg: 0 })];
  eq('two notes, one covered', run([rej(), rej({ id: 'DCR2', dispId: 'DSP9', dc: '5300', po: 'EXCL009' })], sh, lots, ords).map(j => j.dcr.id).join(','), 'DCR2'); }
/* scale: 500 unread notes against 20,000 lots finishes at once */
{ const N = 500, ords = [], lots = [], sh = [], rj = [];
  for (let i = 0; i < N; i++) { ords.push({ id: 'O' + i, po: 'P' + i, lines: [{ id: 'L' + i, brand: 'Humi Grow' }] }); rj.push(rej({ id: 'R' + i, dispId: 'D' + i, po: 'P' + i })); sh.push(failed({ id: 'S' + i, dispId: 'D' + i, po: 'P' + i })); }
  for (let i = 0; i < 20000; i++) lots.push(lot({ id: 'K' + i, po: 'P' + (i % N), lid: 'L' + (i % N), shipKg: 10000 }));
  const t0 = Date.now(); const n = run(rj, sh, lots, ords).length; const ms = Date.now() - t0;
  eq('500 unread notes, 20,000 lots, all on trucks: no jobs', n, 0); ok('and it takes under 2 seconds (' + ms + ' ms)', ms < 2000); }

/* second review: fail a truck through the same call dispQASubmit makes (_releaseShip), then look at the job */
const sh1 = (o) => Object.assign({ id: 'SH1', dispId: 'DSP1', dc: '5260', po: 'EXCL002', brand: 'Humi Grow', lid: 'L1', kg: 10000, stage: 'truck_planned', batches: [{ lotId: 'PK1', batch: 'HG26001', brand: 'HG26001', kg: 10000 }] }, o || {});
const failTruck = (st) => { sb.state = st; st.shipments.filter(x => x.dispId === 'DSP1').forEach(x => { x.voided = true; const o = st.orders.find(y => y.po === x.po); const l = o && (o.lines.find(y => y.id === x.lid) || o.lines.find(y => y.brand === x.brand)); sb._releaseShip(o, l, x.batches || []); }); return st; };
{ const st = failTruck({ dcRejects: [rej()], shipments: [sh1()], packingLog: [lot({ shipKg: 10000 })], orders: [order()] });
  eq('through the real fail path: the stock comes back (shipKg 0)', st.packingLog[0].shipKg, 0);
  eq('through the real fail path: the job shows', sb.dcRejectJobs().length, 1); }
{ const st = failTruck({ dcRejects: [rej()], shipments: [sh1({ batches: [{ batch: 'HG26001', brand: 'HG26001', kg: 10000 }] })], packingLog: [lot({ shipKg: 10000 })], orders: [order()] });
  eq('an older truck whose batches carry no lot id still gives the stock back by batch name: the job shows', sb.dcRejectJobs().length, 1); }
/* review finding 1: replaced and gone, then the next part of the PO is packed a week later: the old note must not come back */
{ const st = failTruck({ dcRejects: [rej()], shipments: [sh1()], packingLog: [lot({ shipKg: 10000 })], orders: [order([{ id: 'L1', brand: 'Humi Grow', ordered: 20000 }])] });
  st.packingLog[0].shipKg = 10000;
  eq('replacement truck took it: no job', sb.dcRejectJobs().length, 0);
  st.packingLog.push(lot({ id: 'PK2', baseBatchNo: 'HG26002', date: '2026-10-29', shipKg: 0 }));
  eq('next 10,000 packed on 29 Oct and cleared: the old note stays away', sb.dcRejectJobs().length, 0);
  st.packingLog[1].date = '2026-10-26';
  eq('but stock packed on or before the failure day that waits still keeps the note', sb.dcRejectJobs().length, 1); }

/* build, change log, Guide */
ok('build id is 2026-10-28a or later', /BUILD_ID='2026-10-(28[a-z]|29[a-z]|3[01][a-z])'|BUILD_ID='2026-1[12]-\d\d[a-z]'/.test(html));
ok('change log 2026-10-28a exists', /ver:'2026-10-28a'/.test(html) && /A failed truck leaves Supply Chain's list once its material no longer waits for a truck/.test(html));
ok('the change log says what it now means', /no longer waiting for a truck/.test(html));
ok('Today still builds the note through dcRejectJobs', /dcRejectJobs\(\)\.forEach/.test(html));
ok('the rule does not read gate pass times or Kg of later trucks', !/gatePassAt\)<=String\(r\.at/.test(grab('dcRejectCovered')));
process.exitCode = report('A failed truck clears itself (28a)') ? 1 : 0;
