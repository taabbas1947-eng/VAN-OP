/* 17a · A truck that came back (Tahir, 17 Oct 2026). DC 5244 left as collected at the factory and the
 * driver brought it back over weight. Ruled: Saad or Shoaib asks with the reason, the Plant Manager approves;
 * approving undoes the release in 1 step (shipped and delivered off the line, the Kg back to the same runs as
 * Cleared, the truck cancelled with its DC and gate pass numbers never reused, out of sales, a correction kept);
 * the lighter truck is planned as usual and keeps the morning's QA pass when it is the same vehicle with only
 * those runs. Runs the real functions from o2s.html. Run: node truckback17a.test.js */
const vm = require('vm');
const H = require('./harness.js');
const { ok, eq, report, grab, html } = H;
const FNS = ['cbMayAsk', 'cbMayDecide', 'cbRows', 'cbOpen', 'cbLeft', 'cbLine', 'cbKg', 'cbComplaintOn', 'cbAsk', 'cbRefuse', 'cbApprove', 'cbVeh', 'cbCarryQA',
  '_releaseShip', 'lotsFor', 'lotHasBatch', 'lotBaseNo', 'lotBrandNo', 'lotAvail', 'lotClearedKg', 'lotShipKg', 'lineCleared', 'dcBatchLines', 'reconcileLotShipKgV1', 'nextDCNo', 'nextGatePassNo', 'saleLeft', 'qsEsc', 'lotById', 'cbDaysAgo', 'cbRecent', 'localDateOf', 'cbApproveNow'];
const SRC = 'var CB_CARRY_DAYS=2; var _cbBusy={};\n' + FNS.map(grab).join('\n');
function box(role, user, st) {
  const s = { console, JSON, Object, Array, String, Math, Number, Date, isNaN, parseInt, state: Object.assign({ role, currentUser: { name: user, username: user }, seq: 1, corrections: [], audit: [] }, st),
    TODAY: new Date('2026-10-17T07:00:00Z'), fmt: n => String(Math.round(n)), toast: m => { s.lastToast = m; }, save: () => {}, render: () => {}, closeModal: () => {}, logAction: () => {},
    shortClient: x => x, lotBagDates: () => ({}), bagMonthLabel: () => '', cmpLotHold: () => null, cmpOpen: c => !c.closed,
    recordCorrection: (op, type, id, label, changes, rc, reason, cascade) => { s.state.corrections.unshift({ op, type, id, reason, cascade }); } };
  s._uRole = () => ({ by: user, user: user, role });
  s.nid = p => p + (s.state.seq++);
  vm.createContext(s); vm.runInContext(SRC, s); return s;
}
/* 1 line ordered 20,000; runs R1 (10,000) and R2 (10,000), both passed QA; truck A (DC 5243) took R1 6,000 and left; truck B (DC 5244) took R1 4,000 + R2 9,120 and was collected */
const DATA = () => ({
  orders: [{ id: 'O1', po: 'PO1', client: 'Syngenta', lines: [{ id: 'L1', brand: 'Enrich', ordered: 20000, packed: 20000, dispatched: 19120, delivered: 19120, deliveredDate: '2026-10-17', dispatchDate: '2026-10-10' }] }],
  packingLog: [{ id: 'R1', po: 'PO1', lid: 'L1', brand: 'Enrich', baseBatchNo: 'HG26039', brandBatchNo: 'VAN6JE002', kg: 10000, insKg: 10000, shipKg: 10000, date: '2026-10-01' },
    { id: 'R2', po: 'PO1', lid: 'L1', brand: 'Enrich', baseBatchNo: 'HG26040', brandBatchNo: 'VAN6JE002', kg: 10000, insKg: 10000, shipKg: 9120, date: '2026-10-02' }],
  shipments: [{ id: 'S0', dispId: 'DA', po: 'PO1', lid: 'L1', brand: 'Enrich', kg: 6000, dc: '5243', gatePass: 'GP-0171', lotExact: true, batches: [{ lotId: 'R1', kg: 6000 }], dispCounted: true, stage: 'delivered', delivered: '2026-10-16', qa: { pass: true } },
    { id: 'S1', dispId: 'DB', po: 'PO1', lid: 'L1', brand: 'Enrich', kg: 13120, dc: '5244', gatePass: 'GP-0172', lotExact: true, vehicle: 'JW 4092', batches: [{ lotId: 'R1', batch: 'HG26039', brand: 'VAN6JE002', kg: 4000 }, { lotId: 'R2', batch: 'HG26040', brand: 'VAN6JE002', kg: 9120 }], dispCounted: true, stage: 'delivered', dcStatus: 'approved', releasedAt: '2026-10-17T02:01:17Z', approvedDate: '2026-10-17', delivered: '2026-10-17', deliveredVia: 'Collected at factory', qa: { pass: true, by: 'Muhammad Asif', date: '2026-10-17', verify: [{ key: 'pallet', item: 'old', result: 'pass' }, { key: 'x', result: 'pass' }], remarks: '' } }],
  complaints: [], corrections: [], audit: [], seq: 1 });

ok('Saad (Supply Chain) and Shoaib (Warehouse) may ask; Zain (Supply Chain Officer) may not', box('Supply Chain', 'saad', DATA()).cbMayAsk() && box('Warehouse', 'shoaib', DATA()).cbMayAsk() && !box('Supply Chain Officer', 'zain', DATA()).cbMayAsk());
ok('the Plant Manager decides; Supply Chain does not', box('Plant Manager', 'fahim', DATA()).cbMayDecide() && !box('Supply Chain', 'saad', DATA()).cbMayDecide());
{ const st = DATA(); const a = box('Supply Chain', 'saad', st);
  a.cbForm = { dispId: 'DB', why: 'too short' }; vm.runInContext('cbForm=this.cbForm', a); a.cbAsk.call(a);
  ok('a reason under 10 characters is refused', !a.cbOpen(a.cbRows('DB')));
  vm.runInContext("cbForm={dispId:'DB', why:'Driver says the load is over weight; some bags come off'}; cbAsk();", a);
  ok('asked: waits for the Plant Manager', !!a.cbOpen(a.cbRows('DB')));
  eq('asking changes nothing on the line', st.orders[0].lines[0].dispatched, 19120);
  const p = box('Plant Manager', 'fahim', st);
  vm.runInContext("cbForm={dispId:'DB', no:''}; cbApprove();", p);
  const l = st.orders[0].lines[0], b = st.shipments[1];
  eq('approved: shipped off the line', l.dispatched, 6000);
  eq('approved: delivered off the line', l.delivered, 6000);
  eq('the line delivered date goes back to the other truck', l.deliveredDate, '2026-10-16');
  eq('run R1 gives back 4,000', st.packingLog[0].shipKg, 6000);
  eq('run R2 gives back 9,120', st.packingLog[1].shipKg, 0);
  eq('13,120 Kg/L back: 14,000 cleared with the 880 already free', p.lineCleared(st.orders[0], l), 14000);
  ok('the truck is cancelled and out of sales', b.voided && b.stage === 'cancelled' && b.dcStatus === 'cancelled' && !p.saleLeft(b));
  ok('what it was is kept', b.cameBack.was.delivered === '2026-10-17' && b.cameBack.was.deliveredVia === 'Collected at factory');
  ok('a correction keeps the reason', st.corrections[0] && st.corrections[0].op === 'VOID' && /over weight/.test(st.corrections[0].reason) && /approved by fahim/.test(st.corrections[0].reason));
  eq('DC 5244 is never issued again', p.nextDCNo(), '5245');
  eq('gate pass GP-0172 is never issued again', p.nextGatePassNo(), 'GP-0173');
  /* the next load counts the runs the same way */
  p.reconcileLotShipKgV1(st); eq('after a reload, still 14,000 cleared', p.lineCleared(st.orders[0], l), 14000);
  /* the lighter truck: same vehicle, 16 Kg less from R2 */
  st.shipments.unshift({ id: 'S2', dispId: 'DC2', po: 'PO1', lid: 'L1', brand: 'Enrich', kg: 13104, dc: '5245', vehicle: 'JW-4092', lotExact: true, batches: [{ lotId: 'R1', batch: 'HG26039', brand: 'VAN6JE002', kg: 4000 }, { lotId: 'R2', batch: 'HG26040', brand: 'VAN6JE002', kg: 9104 }], stage: 'truck_planned', qa: null });
  const s2 = box('Supply Chain', 'saad', st); eq('the QA pass is carried from DC 5244', s2.cbCarryQA('DC2'), '5244');
  const q = st.shipments[0].qa;
  ok('carried pass: marked, same batches, fewer bags', q && q.pass && q.carriedFrom && q.carriedFrom.dc === '5244' && /same batches, fewer bags/.test(q.remarks));
  ok('carried pass: the batch lines are the new truck’s Kg', q.verify.filter(v => v.key === 'pallet').map(v => v.item).join('|') === 'Bags: Enrich VAN6JE002 (4000 Kg/L): batch checked on DC 5244 2026-10-17; same batches, fewer bags|Bags: Enrich VAN6JE002 (9104 Kg/L): batch checked on DC 5244 2026-10-17; same batches, fewer bags');
  eq('the came-back truck points to the new DC', st.shipments[2].cameBack.reusedDc, '5245');
  st.shipments.unshift({ id: 'S3', dispId: 'DC3', po: 'PO1', lid: 'L1', brand: 'Enrich', kg: 10, dc: '5246', vehicle: 'JW 4092', batches: [{ lotId: 'R2', kg: 10 }], stage: 'truck_planned', qa: null });
  eq('the pass is carried once only', box('Supply Chain', 'saad', st).cbCarryQA('DC3'), null); }
{ const st = DATA(); const a = box('Warehouse', 'shoaib', st); vm.runInContext("cbForm={dispId:'DB', why:'Driver says the load is over weight; some bags come off'}; cbAsk();", a);
  const p = box('Plant Manager', 'fahim', st); vm.runInContext("cbForm={dispId:'DB', no:''}; cbApprove();", p);
  st.shipments.unshift({ id: 'S2', dispId: 'DX', po: 'PO1', lid: 'L1', brand: 'Enrich', kg: 13104, dc: '5245', vehicle: 'LEA 1234', batches: [{ lotId: 'R2', kg: 9104 }], stage: 'truck_planned', qa: null });
  eq('another vehicle: QA checks it as any truck', box('Supply Chain', 'saad', st).cbCarryQA('DX'), null);
  st.shipments[0].vehicle = 'JW4092'; st.shipments[0].batches = [{ lotId: 'R2', kg: 9500 }];
  eq('more Kg of a run than came back: QA checks it', box('Supply Chain', 'saad', st).cbCarryQA('DX'), null); }
{ const st = DATA(); const a = box('Supply Chain', 'saad', st); vm.runInContext("cbForm={dispId:'DB', why:'Driver says the load is over weight; some bags come off'}; cbAsk();", a);
  const p = box('Plant Manager', 'fahim', st); vm.runInContext("cbForm={dispId:'DB', no:'no'}; cbRefuse();", p); ok('a refusal needs 5 characters', !!p.cbOpen(p.cbRows('DB')));
  vm.runInContext("cbForm={dispId:'DB', no:'Load is within the permit'}; cbRefuse();", p);
  ok('refused: nothing changes', !p.cbOpen(p.cbRows('DB')) && st.orders[0].lines[0].dispatched === 19120 && !st.shipments[1].voided);
  vm.runInContext("cbForm={dispId:'DB', why:'Asked again, the weighbridge slip shows 300 Kg over'}; cbAsk();", a);
  ok('may be asked again; the first ask is kept', !!a.cbOpen(a.cbRows('DB')) && (st.shipments[1].cameBackHist || []).length === 1); }
{ const st = DATA(); st.complaints = [{ no: 'CMP-0001', items: [{ dispId: 'DB' }] }]; const a = box('Supply Chain', 'saad', st);
  vm.runInContext("cbForm={dispId:'DB', why:'Driver says the load is over weight; some bags come off'}; cbAsk();", a);
  const p = box('Plant Manager', 'fahim', st); vm.runInContext("cbForm={dispId:'DB', no:''}; cbApprove();", p);
  ok('an open complaint on the truck stops the undo', !st.shipments[1].voided && /CMP-0001/.test(p.lastToast)); }
{ const st = DATA(); st.shipments[1].dispCounted = false; st.shipments[1].stage = 'loading'; const a = box('Supply Chain', 'saad', st);
  vm.runInContext("cbForm={dispId:'DB', why:'Driver says the load is over weight; some bags come off'}; cbAsk();", a);
  ok('a truck that has not left the gate is not asked here', !a.cbOpen(a.cbRows('DB'))); }

{ const st = DATA(); st.shipments[1].releasedAt = '2026-10-10T05:00:00Z'; const a = box('Supply Chain', 'saad', st);
  vm.runInContext("cbForm={dispId:'DB', why:'Driver says the load is over weight; some bags come off'}; cbAsk();", a);
  ok('a truck released more than 2 days ago is not asked here', !a.cbOpen(a.cbRows('DB')) && /2 days/.test(a.lastToast)); }

{ const st = DATA(); st.orders[0].lines[0].dispatched = 13120; st.orders[0].lines[0].delivered = 13120; st.shipments.shift(); st.packingLog[0].shipKg = 4000;
  const a = box('Supply Chain', 'saad', st); vm.runInContext("cbForm={dispId:'DB', why:'Driver says the load is over weight; some bags come off'}; cbAsk();", a);
  const p = box('Plant Manager', 'fahim', st); vm.runInContext("cbForm={dispId:'DB', no:''}; cbApprove();", p); const l = st.orders[0].lines[0];
  ok('the only truck undone: the line dates are cleared', l.dispatched === 0 && l.delivered === 0 && l.dispatchDate === '' && l.deliveredDate === ''); }
ok('the inspection report says where a carried pass was checked', /this truck carries the same batches, fewer bags/.test(html) && /carriedFrom:q\.carriedFrom\|\|null/.test(html));
ok('no delivery confirm while the truck waits for the Plant Manager', /This truck came back and waits for the Plant Manager/.test(html));
ok('a cancelled truck is not counted in PO lines, charts or the shipment log', /function shipFor\(o,l\)\{ return \(state\.shipments\|\|\[\]\)\.filter\(s=>s&&!s\.voided/.test(html) && (html.match(/_trail7\(\(state\.shipments\|\|\[\]\)\.filter/g)||[]).length === 2);
/* wiring */
const N = require('fs').readFileSync(require('path').join(__dirname, '..', 'notify-routes.js'), 'utf8');
ok('alert goes to the Plant Manager', /'Truck came back': \['Plant Manager'\]/.test(N));
ok('Today job for the Plant Manager', /label:'Truck came back'/.test(html) && /'Truck came back': \{title:/.test(html));
ok('both truck sheets carry the QA pass', (html.match(/cbCarryQA\(dispId\):null/g) || []).length === 2);
ok('the Guide rule is there', /<h3>A truck that came back<\/h3>/.test(html));
process.exit(report('17a truck came back') ? 1 : 0);
