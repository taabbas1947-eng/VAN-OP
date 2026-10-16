/* 15f (15 Oct 2026): Tahir's rulings on the 15f design picture.
   - One stuck rule per ORDER LINE (7 days, orders of any age), Pack from base on Today.
   - Trucks: one vehicle/driver rule; Start loading sheet with a safe batch change; sent-back fix
     sheet; Truck released + Handed to driver; each truck job's clock from its own step.
   - Shared jobs tagged; Your people counted like the person's own Today.
   - QA by pack type, loading condition, checked before/during/after, batch on the bags.
   - A look-alike batch number refused once; new trucks reserve exactly their packing runs.
   Run: node audit15f.test.js */
const H = require('./harness.js');
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { ok, eq, report, grab, grabTopVar, html } = H;

/* 1. reserved stock: old data unchanged, new trucks exact */
{
  const box = { console }; vm.createContext(box); vm.runInContext(grab('reconcileLotShipKgV1'), box);
  const lot = (id, ins, date) => ({ id, po: 'P1', lid: 'L1', brand: 'E', kg: ins, insKg: ins, date });
  const mk = (rows) => ({ orders: [{ po: 'P1', lines: [{ id: 'L1', brand: 'E', dispatched: 0 }] }], packingLog: [lot('A', 1000, '2026-10-01'), lot('B', 1000, '2026-10-02'), lot('C', 1000, '2026-10-03')], shipments: rows });
  /* legacy open truck: oldest first, as before */
  let s = mk([{ po: 'P1', lid: 'L1', dispId: 'D1', stage: 'loading', kg: 1200, batches: [{ lotId: 'C', kg: 1000 }, { lotId: 'B', kg: 200 }] }]);
  box.reconcileLotShipKgV1(s);
  eq('a truck from before 15f still reserves oldest first (A)', s.packingLog[0].shipKg, 1000);
  eq('...and the rest on B', s.packingLog[1].shipKg, 200);
  eq('...C untouched', s.packingLog[2].shipKg, 0);
  /* new truck: exactly its own runs, after every reload */
  s = mk([{ po: 'P1', lid: 'L1', dispId: 'D1', stage: 'loading', kg: 1200, lotExact: true, batches: [{ lotId: 'C', kg: 1000 }, { lotId: 'B', kg: 200 }] }]);
  box.reconcileLotShipKgV1(s); box.reconcileLotShipKgV1(s);
  eq('a 15f truck reserves C, the run on its DC', s.packingLog[2].shipKg, 1000);
  eq('...and B for 200', s.packingLog[1].shipKg, 200);
  eq('...and leaves A free', s.packingLog[0].shipKg, 0);
  /* mixed: a released exact truck (in dispatched) plus a legacy open truck */
  s = mk([{ po: 'P1', lid: 'L1', dispId: 'D1', stage: 'in_transit', dispCounted: true, kg: 500, lotExact: true, batches: [{ lotId: 'C', kg: 500 }] },
          { po: 'P1', lid: 'L1', dispId: 'D2', stage: 'loading', kg: 300, batches: [{ lotId: 'A', kg: 300 }] }]);
  s.orders[0].lines[0].dispatched = 500;
  box.reconcileLotShipKgV1(s);
  eq('mixed: the exact released truck keeps C', s.packingLog[2].shipKg, 500);
  eq('mixed: the legacy truck goes oldest first, not counted twice', s.packingLog[0].shipKg, 300);
  eq('mixed: B free', s.packingLog[1].shipKg, 0);
  /* the July snapshot gives exactly the same figures as 15e did */
  const STATE = path.join(__dirname, '..', '..', '..', 'data', 'state.json');
  if (fs.existsSync(STATE)) {
    const raw = JSON.parse(fs.readFileSync(STATE, 'utf8')); const d = raw.data || raw;
    const before = (d.packingLog || []).map(p => +p.shipKg || 0);
    const old = new Function('s', (function () {
      /* 15e's rule, kept here only to compare against */
      return "(s.orders||[]).forEach(function(o){ (o.lines||[]).forEach(function(l){ var lots=(s.packingLog||[]).filter(function(p){ if(!p) return false; if((+p.kg||0)<=0.0001) return false; if(p.po!==o.po) return false; return p.lid ? (p.lid===l.id) : (p.brand===l.brand); }).sort(function(a,b){return String(a.date||a.mfgDate||'').localeCompare(String(b.date||b.mfgDate||''))||String(a.id||'').localeCompare(String(b.id||''));}); var onTruck=0; (s.shipments||[]).forEach(function(x){ if(!x||x.voided||x.dispCounted||x.po!==o.po) return; if(!(x.stage||x.dispId)) return; if(x.lid?x.lid!==l.id:x.brand!==l.brand) return; onTruck+=(+x.kg||0); }); var rem=Math.max(0,+l.dispatched||0)+onTruck; lots.forEach(function(p){ var cap=Math.max(0,+p.insKg||0); var t=Math.min(Math.max(0,rem),cap); p.shipKg=t; rem-=t; }); }); });";
    })());
    const a = JSON.parse(JSON.stringify(d)), b = JSON.parse(JSON.stringify(d));
    old(a); box.reconcileLotShipKgV1(b);
    const diff = a.packingLog.filter((p, i) => Math.abs((+p.shipKg || 0) - (+b.packingLog[i].shipKg || 0)) > 0.001).length;
    eq('the snapshot: every packing run reserves exactly what 15e gave', diff, 0);
    ok('...the snapshot was really read', before.length > 50, before.length);
  }
  /* exact Kg never lost: more than a run passed QA, or a run outside the line's pool, goes back to oldest first */
  s = mk([{ po: 'P1', lid: 'L1', dispId: 'D1', stage: 'loading', kg: 1300, lotExact: true, batches: [{ lotId: 'C', kg: 1200 }, { lotId: 'ZZ', kg: 100 }] }]);
  box.reconcileLotShipKgV1(s);
  eq('an exact line over a run\u2019s QA-passed Kg is capped at it', s.packingLog[2].shipKg, 1000);
  eq('...the overflow and the out-of-pool Kg go back to oldest first, none lost', s.packingLog[0].shipKg + s.packingLog[1].shipKg, 300);
  ok('Plan the truck and Start shipment mark new trucks lotExact', (html.match(/lotChosen:!!(r|x\.r)\.manual,lotExact:true/g) || []).length === 2);
}

/* 2. one vehicle and driver rule */
{
  const box = {}; vm.createContext(box); vm.runInContext(grab('truckVehicleRule'), box);
  ok('no vehicle: refused, bilty optional', /Vehicle no\. is required/.test(box.truckVehicleRule({ bilty: 'B1' })));
  ok('no driver name: refused', /Driver name is required/.test(box.truckVehicleRule({ vehicle: 'TLA-1' })));
  ok('no driver phone: refused', /Driver phone is required/.test(box.truckVehicleRule({ vehicle: 'TLA-1', driver: 'Akram' })));
  eq('vehicle, driver and phone, no bilty: allowed', box.truckVehicleRule({ vehicle: 'TLA-1', driver: 'Akram', driverContact: '0300' }), '');
  ok('both sheets use it', /truckVehicleRule\(dispForm\)/.test(grab('saveDispatch')) && /truckVehicleRule\(f\)/.test(grab('mpCreate')) && /truckVehicleRule\(f\)/.test(grab('mpGo')));
  ok('the old Ex-factory bilty rule is gone', !/Bilty # is required for Ex-factory/.test(html) && !/Enter a Vehicle # or a Bilty #/.test(html));
  ok('the rule is written on both sheets before Save', (html.match(/TRUCK_RULE_TXT/g) || []).length >= 4);
}

/* 3. the batch change at loading */
{
  const mkBox = () => {
    const toasts = [], logs = [], corr = [];
    const box = { console, toasts, logs, corr, toast: m => toasts.push(m), save() {}, render() {}, closeModal() {}, fmt: x => String(Math.round(x)), unitOf: () => 'Kg', tsEsc: x => String(x == null ? '' : x),
      logAction: m => logs.push(m), recordCorrection: (...a) => corr.push(a), denyRight: () => 'no right', may: c => c === 'shipment.load', qaRequiredOn: () => true, shipClientFor: () => '',
      _uRole: () => ({ by: 'Shoaib', user: 'shoaib', role: 'Warehouse' }), $: () => ({ innerHTML: '', classList: { add() {}, remove() {} } }), state: {} };
    vm.createContext(box);
    ['lotBaseNo', 'lotBrandNo', 'lotHasBatch', 'lotClearedKg', 'lotShipKg', 'lotsFor', 'lotById', 'shipRowsOf', 'slCanChange', '_slLine', 'slCandidates', 'renderStartLoading', 'openStartLoading', 'truckSwapBatch'].forEach(f => vm.runInContext(grab(f), box));
    vm.runInContext('var slForm=null;', box);
    const lot = (id, no, ins, ship, o) => Object.assign({ id, po: 'P1', lid: 'L1', brand: 'Enrich', kg: ins, insKg: ins, shipKg: ship, baseBatchNo: 'HG', brandBatchNo: no, date: '2026-10-0' + id.slice(-1) }, o || {});
    box.state = { role: 'Warehouse', batches: [], orders: [{ po: 'P1', lines: [{ id: 'L1', brand: 'Enrich' }, { id: 'L2', brand: 'Zinc' }] }],
      packingLog: [lot('K1', 'VAN1', 1000, 800), lot('K2', 'VAN2', 1000, 0), lot('K3', 'VAN3', 500, 0, { qaHold: true }), lot('K4', 'VAN4', 300, 0), lot('Z1', 'ZN1', 500, 100, { lid: 'L2', brand: 'Zinc' })],
      shipments: [{ id: 'S1', dispId: 'D1', dc: '77', po: 'P1', lid: 'L1', brand: 'Enrich', kg: 800, stage: 'truck_planned', dispatch: '2026-10-15', batches: [{ lotId: 'K1', batch: 'HG', brand: 'VAN1', kg: 800 }] },
        { id: 'S2', dispId: 'D1', dc: '77', po: 'P1', lid: 'L2', brand: 'Zinc', kg: 100, stage: 'truck_planned', dispatch: '2026-10-15', batches: [{ lotId: 'Z1', batch: 'ZN', brand: 'ZN1', kg: 100 }] }] };
    return box;
  };
  let b = mkBox();
  const c = b.slCandidates('D1', 'S1', 0).map(p => p.id);
  ok('offered: another cleared run of the same PO line with enough free stock', c.indexOf('K2') > -1);
  ok('not offered: a run on QA hold', c.indexOf('K3') < 0);
  ok('not offered: a run without enough free stock for the whole line', c.indexOf('K4') < 0);
  ok('not offered: a run of another product on the same truck', c.indexOf('Z1') < 0);
  b.truckSwapBatch('D1', 'S1', 0, 'K2', 'bags');
  ok('a reason of under 5 characters is refused', b.toasts.some(t => /Say why/.test(t)) && b.state.shipments[0].batches[0].lotId === 'K1');
  b.state.shipments[0].qa = { pass: true, by: 'Asif' };
  b.truckSwapBatch('D1', 'S1', 0, 'K2', 'K2 bags were at the front');
  const r = b.state.shipments[0];
  eq('the DC line now carries the new batch', r.batches[0].brand, 'VAN2');
  eq('...the Kg goes back to the first run in the same save', b.state.packingLog[0].shipKg, 0);
  eq('...and onto the new run', b.state.packingLog[1].shipKg, 800);
  ok('the truck now reserves exactly (lotExact) on every row', b.state.shipments.every(x => x.lotExact === true));
  eq('the DC is marked revised (same number)', r.dcRevised, 1); eq('...the DC number did not change', r.dc, '77');
  ok('the whole truck goes back to QA, the old result kept', r.qa === null && r.qaHistory && r.qaHistory[0].by === 'Asif');
  ok('the change is logged: old, new, Kg, who, why', r.batchChanges[0].from === 'VAN1' && r.batchChanges[0].to === 'VAN2' && r.batchChanges[0].kg === 800 && r.batchChanges[0].by === 'Shoaib' && /front/.test(r.batchChanges[0].why));
  ok('...in the corrections register too', b.corr.length === 1 && b.corr[0][3] === 'DC 77 · P1');
  /* after the gate pass: refused */
  b = mkBox(); b.state.shipments.forEach(x => { x.stage = 'loading'; x.gatePass = 'GP9'; });
  b.truckSwapBatch('D1', 'S1', 0, 'K2', 'bags at the front'); ok('after the gate pass the change is refused', b.toasts.some(t => /gate pass is issued/.test(t)) && b.state.shipments[0].batches[0].lotId === 'K1');
  /* someone took the stock meanwhile: refused, nothing cut down */
  b = mkBox(); b.state.packingLog[1].shipKg = 900;
  b.truckSwapBatch('D1', 'S1', 0, 'K2', 'bags at the front'); ok('a run that is no longer free is refused at save', b.toasts.some(t => /no longer free/.test(t)) && b.state.packingLog[0].shipKg === 800);
  /* no right: refused */
  b = mkBox(); b.may = () => false; b.truckSwapBatch('D1', 'S1', 0, 'K2', 'bags at the front'); ok('without the load right it is refused', b.toasts.length === 1 && b.state.shipments[0].batches[0].lotId === 'K1');
  /* the sheet */
  b = mkBox(); let shown = ''; b.$ = () => ({ set innerHTML(v) { shown = v; }, get innerHTML() { return shown; }, classList: { add() {}, remove() {} } }); b.openStartLoading('D1');
  ok('Start loading opens a sheet listing each DC line with its batch, Kg and packs', /Start loading/.test(shown) && /VAN1/.test(shown) && /ZN1/.test(shown) && /Loading these/.test(shown) && /Bags show a different batch\?/.test(shown));
  ok('the Load job opens that sheet, not a single tap', /openStartLoading\('"\+g\.dispId\+"'\)",label:'Load'/.test(html));
  /* a 2-product truck changed at loading keeps both products' reservations right after a reload */
  b = mkBox(); b.truckSwapBatch('D1', 'S1', 0, 'K2', 'K2 bags were at the front');
  vm.runInContext(grab('reconcileLotShipKgV1'), b); b.state.orders[0].lines.forEach(l => { l.dispatched = 0; }); b.reconcileLotShipKgV1(b.state);
  ok('after a reload: K2 carries the Enrich line, K1 is free, Zinc keeps Z1', b.state.packingLog[1].shipKg === 800 && b.state.packingLog[0].shipKg === 0 && b.state.packingLog[4].shipKg === 100);
  ok('the DC prints "revised" when a batch was changed', /x&&x\.dcRevised; \}\)\)\?' <b>\(revised\)<\/b>'/.test(grab('printDC')));
  ok('the reviewer and the Plant Manager see the change on the truck sheet', /Batch changed at loading: /.test(grab('tsSheetHTML')));
  ok('the gate pass sheet offers Change a batch while allowed', /Change a batch…/.test(grab('renderTruckSign')) && /slCanChange\(rows\)/.test(grab('renderTruckSign')));
}

/* 4. the sent-back truck is fixed on its sheet */
{
  const logs = [], corr = [], toasts = [];
  const box = { console, toast: m => toasts.push(m), save() {}, render() {}, closeModal() {}, logAction: m => logs.push(m), recordCorrection: (...a) => corr.push(a),
    may: c => c === 'gatepass.issue', dcControlOn: () => true, _uRole: () => ({ by: 'Shoaib', user: 'shoaib', role: 'Warehouse' }), state: { role: 'Warehouse' } };
  vm.createContext(box);
  ['shipRowsOf', 'truckSentBack', 'truckVehicleRule', 'truckFixed'].forEach(f => vm.runInContext(grab(f), box));
  vm.runInContext((html.match(/var TRUCK_FIX_FIELDS=[^;]+;/) || [''])[0] + ' var tsForm=null;', box);
  box.state.shipments = [{ dispId: 'D1', dc: '77', po: 'P1', vehicle: 'TLA-1', driver: 'Akram', driverContact: '0300', bilty: '', sentBack: { by: 'Saad', why: 'vehicle wrong' } }];
  vm.runInContext("tsForm={dispId:'D1',note:'',v:{vehicle:'TLB-2',driver:'Akram',driverContact:'0300',bilty:'B7',seal:'',carrier:'',focalPerson:'',focalPhone:''}}", box);
  box.truckFixed('D1', 'vehicle corrected');
  const r = box.state.shipments[0];
  eq('the vehicle is corrected on the truck', r.vehicle, 'TLB-2'); eq('...and the bilty added', r.bilty, 'B7');
  ok('it goes back for review (fixed)', !!r.sentBack.fixedAt);
  ok('every change is logged and in the corrections register', corr.length === 1 && corr[0][4].length === 2 && corr[0][4][0].before === 'TLA-1' && corr[0][4][0].after === 'TLB-2' && /2 details corrected/.test(logs[0]));
  box.state.shipments = [{ dispId: 'D2', dc: '78', vehicle: 'TLA-1', driver: 'Akram', driverContact: '0300', sentBack: { by: 'Saad', why: 'x' } }];
  vm.runInContext("tsForm={dispId:'D2',note:'',v:{vehicle:'TLA-1',driver:'',driverContact:'0300',bilty:'',seal:'',carrier:'',focalPerson:'',focalPhone:''}}", box);
  box.truckFixed('D2', ''); ok('the vehicle rule holds on the fix sheet too', /Driver name is required/.test(toasts[toasts.length - 1]) && !box.state.shipments[0].sentBack.fixedAt);
  ok('the old dead-end "Edit the shipment" button is gone from the sheet', !/Edit the shipment<\/button>/.test(grab('renderTruckSentBack')) && /Quantity and batches cannot change here/.test(grab('renderTruckSentBack')));
}

/* 5. truck released: hand the papers to the driver */
{
  ok('release marks the hand-over as due', /s\.releasedAt=new Date\(\)\.toISOString\(\); if\(s\.gatePass\) s\.handoverDue=true;/.test(grab('approveRelease')));
  ok('the issuer gets Truck released until Handed to driver', /_h0\.handoverDue&&!_h0\.handedAt/.test(html) && /label:'Truck released'/.test(html));
  const toasts = []; const box = { console, toast: m => toasts.push(m), save() {}, render() {}, closeModal() {}, logAction() {}, may: () => false, _uRole: () => ({ by: 'Shoaib', user: 'shoaib', role: 'Warehouse' }), state: { role: 'Warehouse' } };
  vm.createContext(box); ['shipRowsOf', 'truckHanded'].forEach(f => vm.runInContext(grab(f), box));
  box.state.shipments = [{ dispId: 'D1', dc: '77', gatePass: 'GP1', gatePassByUser: 'shoaib', handoverDue: true }];
  box.truckHanded('D1'); ok('the gate pass issuer closes it with Handed to driver', !!box.state.shipments[0].handedAt && box.state.shipments[0].handedBy === 'Shoaib');
  box.state.shipments = [{ dispId: 'D2', dc: '78', gatePass: 'GP2', gatePassByUser: 'zain', handoverDue: true }];
  box.truckHanded('D2'); ok('someone else without the right cannot close it', !box.state.shipments[0].handedAt);
  ok('printing does not close it: only the button does', !/handedAt/.test(grab('openHandover').replace(/r\.handedAt\?/, '')));
  ok('Handed to driver is the main green button on the Today card, with what to do', /<b>Do this:<\/b> print the approved DC and gate pass, hand both to the driver, then tap <b>Handed to driver<\/b>\. The tap closes this job\./.test(grab('tdCardHTML')));
  ok('...and on the truck list and the truck sheet', /truckHanded\(/.test(grab('shipCard')) && /truckHanded\(/.test(grab('tsSheetHTML')));
}

/* 6. each truck job's clock from its own step */
{
  const box = { TRUCK_REVIEW_HOURS: 2 }; vm.createContext(box);
  ['localDateOf', '_tcLater', 'truckReviewSince', 'truckClockStart'].forEach(f => vm.runInContext(grab(f), box));
  const g = (label, r, x) => box.truckClockStart({ label, disp: Object.assign({ date: '2026-10-01', rows: [r] }, x || {}) });
  eq('Load: the later of planned and the typed date (planned later)', g('Load', { recordedAt: '2026-10-05T04:00:00Z', dispatch: '2026-10-01' }).c, '2026-10-05T04:00:00Z');
  eq('Load: a truck planned ahead counts from its own day', box.truckClockStart({ label: 'Load', disp: { date: '2026-10-20', rows: [{ recordedAt: '2026-10-05T04:00:00Z' }] } }).c, '2026-10-20');
  eq('Inspect: from planning', g('Inspect', { recordedAt: '2026-10-05T04:00:00Z' }).c, '2026-10-05T04:00:00Z');
  eq('Gate pass: the later of loading started and QA passed', g('Gate Pass', { loadStarted: '2026-10-06', qa: { recordedAt: '2026-10-07T09:00:00Z' } }).c, '2026-10-07T09:00:00Z');
  eq('Review: the latest of gate pass, QA and a fix', g('Review truck', { gatePassAt: '2026-10-08T05:00:00Z', qa: { recordedAt: '2026-10-07T05:00:00Z' }, sentBack: { fixedAt: '2026-10-09T05:00:00Z' } }).c, '2026-10-09T05:00:00Z');
  eq('Release: from the review', g('Release', { scReview: { at: '2026-10-10T05:00:00Z' } }).c, '2026-10-10T05:00:00Z');
  eq('Release, no review: 2 hours after the review became due', g('Release', { gatePassAt: '2026-10-10T05:00:00.000Z' }).c, '2026-10-10T07:00:00.000Z');
  eq('Sent back: from when it was sent back', g('Sent back', { sentBack: { at: '2026-10-11T05:00:00Z' } }).c, '2026-10-11T05:00:00Z');
  eq('Confirm delivery: from the release', g('Confirm delivery', {}, { approvedDate: '2026-10-12' }).c, '2026-10-12');
  const old = g('Gate Pass', {}); ok('an old truck with no times falls back to its dispatch date, marked ~', old.c === '2026-10-01' && old.approx === true);
  ok('actTiming uses it for every truck job', /truckClockStart\(it\)/.test(grab('actTiming')));
  eq('Inspect after a batch change counts from the change', g('Inspect', { recordedAt: '2026-10-05T04:00:00Z', batchChanges: [{ at: '2026-10-14T09:00:00Z' }] }).c, '2026-10-14T09:00:00Z');
  ok('whoever fixed a sent-back truck (now or before) does not review it, checked inside the actions too', /truckFixers\(s\)\.indexOf\(me\.user\)>-1/.test(grab('truckMadeByMe')) && /sentBackHistory/.test(grab('truckFixers')) && /truckMadeByMe\(rows\)/.test(grab('reviewTruck')) && /truckMadeByMe\(rows\)/.test(grab('sendBackTruck')) && /concat\(truckFixers\(s\)\)/.test(html));
  ok('Print DC and Print gate pass are 2 buttons (a browser blocks a 2nd window from 1 tap)', !/printDC\([^)]*\);printGatePass/.test(html));
}

/* 7. Pack from base and the order-line clock */
{
  ok('Today adds Pack from base, 1 per order line; while base is short the run card for the rest shows too (15g)', /label:'Pack from base'/.test(html) && /restKg:_rest,/.test(html));
  ok('it escalates to the Plant Manager after 7 days as stuck', /'Pack from base':\[PL_LINE_STUCK_DAYS,'Plant Manager'\]/.test(html) && /stuck:it\.label==='Pack from base'/.test(grab('acEscalation')) && /stuck · Plant Manager told/.test(grab('tdTags')));
  ok('its clock is the line’s last pack, never the PO’s age', /case 'Pack from base': c=it\.pfbStart\|\|it\.o\.received/.test(grab('actTiming')) && /last packed '\+_plDay\(_p0\.pfbLast\)/.test(grab('tdTags')));
  ok('the card says the base ready (or waiting for production, X of Y ready) and the batches oldest first', /Base ready: <b>/.test(grab('tdCardHTML')) && /oldest first/.test(grab('tdCardHTML')) && /Waiting for production:/.test(grab('tdCardHTML')));
  ok('Pack from base is on Today labels and rights', /'Pack from base':\s*\{title:'Pack from base'/.test(grabTopVar('TD_LABEL', '{')) && /'Pack from base':'packing\.pack'/.test(html));
  ok('the Production Stuck list counts it', /'Pack from base':'produce'/.test(html));
  ok('the batch list uses the same rule', /plBatchClass\(b\)/.test(grab('journeyCard')) && /c&&c\.k==='stuck'/.test(html));
  ok('openPackFromBase opens the oldest cleared batch on the line', /openPack\(rd\.batches\[0\]\.id\)/.test(grab('openPackFromBase')) && /packPickPO\(o\.id\+'\|'\+l\.id\)/.test(grab('openPackFromBase')));
}

/* 7b. the stuck rule, run (review faults 1 to 3) */
{
  const consts = (html.match(/var PL_STUCK_NO_OUTPUT_DAYS=[^;]+;/) || [''])[0];
  const SRC = consts + '\n' + ['calDays','localDateOf','lineShortClosed','_plPackedOf','plBatchMove','_plDay','plBatchFacts','_plLineOf','plLineWantsBase','plOpenLines','plOpenDemandKg','lineShortRequested','batchClearedKg','plBaseLabKg','plShareKey','plBaseShare','_plFirstOk','_plM','plBaseReady','_plBaseReady0','plClientPOs','lineWaitMark','lineWaitClient','lineWaitOver','plLinePack','packLineOwes','_plCarrier','plBatchClass','_plRow','plStuckBatches','plHeldBatches'].map(n => grab(n)).join('\n') + '\nvar _plMemo=null; function poReturnOpen(){ return false; }';
  const mk = (st) => { const s = { console, Date, Math, JSON, fmt: n => String(Math.round(n)), evToday: () => '2026-10-15', lineBucket: () => 'Production', batchStage: b => b._stage || 'pack',
      batchPackableKg: b => Math.max(0, (+b.producedKg || 0) - (+b.packedKg || 0)), batchPackNow: b => !b.voided && (b._stage || 'pack') === 'pack' && (b.status !== 'closed' || !!b.stockKept) && ((+b.producedKg || 0) - (+b.packedKg || 0)) > 0.5 };
    s.state = Object.assign({ batches: [], orders: [], shiftEntries: [], packingLog: [] }, st); vm.createContext(s); vm.runInContext(SRC, s); return s; };
  const ok1 = (d) => ({ status: 'approved', approvedDate: d });
  const B = (o) => Object.assign({ id: 'B1', batchNo: 'X1', status: 'open', kind: 'bulk', base: 'HK', plannedKg: 1000, producedKg: 1000, packedKg: 0, openedDate: '2026-07-01', lots: [{ coa: ok1('2026-07-05') }] }, o);
  const O = { po: 'SYN', received: '2026-06-01', acknowledged: true, lines: [{ id: 'L1', brand: 'Enrich', base: 'HK', ordered: 200000, packed: 1000 }] };
  /* 1: a long PO last packed 15 d ago, base cleared yesterday: not stuck yet */
  let s = mk({ batches: [B({ lots: [{ coa: ok1('2026-10-14') }] })], orders: [O], packingLog: [{ po: 'SYN', lid: 'L1', date: '2026-09-30' }] });
  eq('fresh base on a long PO is not stuck on day 1 (clock from base ready)', s.plBatchClass(s.state.batches[0]), null);
  eq('...its line clock is 1 d', s.plLinePack(O, O.lines[0], '2026-10-14').days, 1);
  /* 2: half packed, the rest back in the lab, nothing cleared ready: the lab, not the order line */
  s = mk({ batches: [B({ packedKg: 500, _stage: 'qc', openedDate: '2026-09-01' })], orders: [O] });
  const c2 = s.plBatchClass(s.state.batches[0]);
  ok('nothing cleared ready: stuck on the lab, not on packing', c2 && c2.who === 'Lab' && /Waiting for the lab to clear the rest/.test(c2.why), c2 && c2.why);
  /* 3: the oldest ready base is a closed batch with kept stock: it carries the stuck line */
  s = mk({ batches: [B({ id: 'OLD', batchNo: 'OLD', status: 'closed', stockKept: 300, lots: [{ coa: ok1('2026-07-02') }] }), B({ id: 'NEW', batchNo: 'NEW', lots: [{ coa: ok1('2026-08-01') }] })], orders: [O] });
  eq('a closed batch holding kept stock carries the stuck line on Plant', s.plStuckBatches().map(r => r.batchNo).join(','), 'OLD');
  eq('...the newer batch is queued behind it', s.plBatchClass(s.state.batches[1]).k, 'queued');
  /* the oldest ready batch still being made never hides the line */
  s = mk({ batches: [B({ id: 'RUN', batchNo: 'RUN', producedKg: 600, lots: [{ coa: ok1('2026-07-02') }] }), B({ id: 'DONE', batchNo: 'DONE', lots: [{ coa: ok1('2026-08-01') }] })], orders: [O] });
  ok('a batch still being made does not carry the line; the made one does', s.plStuckBatches().some(r => r.batchNo === 'DONE' && /SYN/.test(r.why)));
  ok('Plant and Today use 1 test for a line waiting for base', /plLineWantsBase\(o,l\)/.test(grab('plOpenLines')) && /if\(plLineWantsBase\(o,l\)\)\{/.test(html));
  const s2 = mk({ batches: [B({})], orders: [Object.assign({}, O, { acknowledged: false })] });
  eq('a PO not yet acknowledged does not want base', s2.plLineWantsBase(s2.state.orders[0], s2.state.orders[0].lines[0]), false);
  const s3 = mk({ batches: [B({}), { id: 'M1', kind: 'multi', base: 'HK', status: 'open', producedKg: 500, packedKg: 0, allocations: [{ po: 'SYN', brand: 'Enrich' }] }], orders: [O] });
  eq('a line with a ready multi-PO batch for it (old allocation, matched by product) does not want base', s3.plLineWantsBase(O, O.lines[0]), false);
}

/* 8. shared jobs and Your people */
{
  const box = { usersList: [{ username: 'asif', name: 'Asif Ali', role: 'QA Inspector' }, { username: 'ehtisham', name: 'Ehtisham Khan', role: 'QA Inspector' }, { username: 'shoaib', name: 'Shoaib', role: 'Warehouse' }, { username: 'boss', name: 'Tahir', role: 'COO' }], state: {} };
  vm.createContext(box); ['itBarred', 'jobSharers', '_shareNames', '_tdEsc', 'tdSharedTag', 'tdSharedLine', 'itOwnedBy', 'ypJobsFor'].forEach(f => vm.runInContext(grab(f), box));
  const it = { role: 'QA Inspector', label: 'Inspect' };
  eq('a QA job is shared by the 2 inspectors (never the COO)', box.jobSharers(it).map(u => u.username).join(','), 'asif,ehtisham');
  ok('the tag names them, in words', /⇄ Shared · Asif or Ehtisham/.test(box.tdSharedTag({ items: [it] })) && /class="tdtag shared"/.test(box.tdSharedTag({ items: [it] })));
  ok('the card says it closes for both', /Either of you can do this\. When one of you does it, it closes for both\./.test(box.tdSharedLine({ items: [it] })));
  eq('a job addressed to 1 person is not shared', box.jobSharers({ role: 'QA Inspector', who: 'asif' }).length, 0);
  eq('a job the rules bar someone from is not shared with them', box.jobSharers({ role: 'QA Inspector', notWho: ['asif'] }).map(u => u.username).join(','), 'ehtisham');
  box.acEscalation = x => (x.esc ? { to: 'Warehouse' } : null); box.labCoverSees = () => false;
  const jobs = box.ypJobsFor({ username: 'shoaib', name: 'Shoaib', role: 'Warehouse' }, [{ role: 'Warehouse' }, { role: 'Supply Chain', esc: true }, { role: 'Supply Chain' }, { role: 'Warehouse', who: 'zain' }]);
  eq('Your people counts the role’s jobs and those handed on to the role, not jobs for someone else', jobs.length, 2);
  ok('Your people says how many are shared, with whom', /' shared with '/.test(grab('tdYourPeople')) && !/\(shared\)'/.test(grab('tdYourPeople')));
  ok('the shared tag has its own colour', /\.tdtag\.shared\{border-color:#6B4FA0;background:#EEE9F7;color:#5A3E8C\}/.test(html));
}

/* 9. QA by pack type and loading condition */
{
  const box = { console, _pe: x => String(x), customProducts: () => [{ brand: 'Enrich', form: 'Powder' }, { brand: 'Germ', form: 'Liquid' }, { brand: 'Blank' }], state: {} };
  box.window = box; vm.createContext(box);
  vm.runInContext((html.match(/var QC_PACK_Q=\{[\s\S]*?\]\};/) || [''])[0] + (html.match(/var QC_LOAD_Q=\{[^;]+;/) || [''])[0] + (html.match(/const QC_CHECKLIST=\[[^\]]+\];/) || [''])[0].replace('const ', 'var ') + ' var QC_NA_CHECK=[];', box);
  vm.runInContext((html.match(/var QC_ANS=\{[\s\S]*?\};\nQC_ANS\[QC_LOAD_Q\.yes\][^\n]*\nQC_ANS\[QC_PACK_Q\.solid\[0\]\][^\n]*\nQC_ANS\[QC_PACK_Q\.liquid\[0\]\][^\n]*/) || [''])[0], box);
  ['productFormOf', 'qcPackKeys', 'qcItemText', 'qcPackRecord', 'qcPackGate', 'qcChecklistRecord', 'qcChecklistRows', 'qcNaRadio', 'qcAns', 'qcAnsRadios', 'qcPackRows'].forEach(f => vm.runInContext(grab(f), box));
  eq('a powder product is solid', box.productFormOf('Enrich'), 'solid'); eq('a liquid product is liquid', box.productFormOf('Germ'), 'liquid'); eq('no form: unknown', box.productFormOf('Blank'), '');
  eq('solid gets the 2 solid checks', box.qcPackKeys(['Enrich']).map(x => x.form).join(','), 'solid,solid');
  eq('liquid gets the 3 liquid checks', box.qcPackKeys(['Germ']).length, 3);
  eq('a truck with both gets both sets', box.qcPackKeys(['Enrich', 'Germ']).length, 5);
  eq('a product with no form gets both until it is filled in', box.qcPackKeys(['Blank']).length, 5);
  ok('the solid closure check names stitching and heat seal', /bag stitching closed and even, or pouch heat seal fully sealed/.test(box.qcPackKeys(['Enrich'])[0].item));
  ok('the leak check is upside down and pressed', box.qcPackKeys(['Germ']).some(x => /upside down and pressed by hand, no drip/.test(x.item)));
  ok('a missing pack check is refused', /Answer every pack check/.test(box.qcPackGate(['Germ'], { pack: { liquid_0: 'pass' } })));
  eq('all marked: allowed', box.qcPackGate(['Germ'], { pack: { liquid_0: 'pass', liquid_1: 'pass', liquid_2: 'fail' } }), '');
  eq('truck, on pallets: the pallet question', box.qcItemText(7, 'truck', { onPallets: 'yes' }), 'Loading condition (on pallets): pallets sound, stack stable, no torn bags');
  eq('truck, no pallets: the truck bed question', box.qcItemText(7, 'truck', { onPallets: 'no' }), 'Loading condition (no pallets): no torn bags, truck bed clean and dry');
  eq('packed lot: the storage question', box.qcItemText(7, 'lot', {}), 'Storage: stored off the floor, dry');
  eq('the other 7 items keep their text', box.qcItemText(0, 'truck', {}), 'Packaging intact & correct');
  const rec = box.qcChecklistRecord('truck', { onPallets: 'no', marks: ['pass', 'pass', 'pass', 'pass', 'pass', 'pass', 'pass', 'fail'] });
  ok('the saved record carries the question asked (old records keep theirs)', rec[7].item === 'Loading condition (no pallets): no torn bags, truck bed clean and dry' && rec[7].result === 'fail');
  vm.runInContext("var dispQAForm={marks:['','','','','','','',''],onPallets:''};", box);
  const rows = box.qcChecklistRows('dispQAForm', 'truck', 'renderDispatchQA', 'dispQASet', 'dqa');
  ok('the truck asks On pallets? first, then the check', /On pallets\?/.test(rows) && /Answer first; the check follows\./.test(rows));
  ok('no N/A is offered on the checklist any more', !/N\/A/.test(rows));
  ok('checks are answered in their own words, never Pass or Fail', !/> Pass<|> Fail</.test(rows) && /Intact and correct/.test(rows) && /Weight short or over/.test(rows));
  vm.runInContext("dispQAForm.onPallets='yes';", box);
  ok('the loading answer follows the question', /Sound and stable/.test(box.qcChecklistRows('dispQAForm', 'truck', 'r', 's', 'd')));
  vm.runInContext("var lotQAForm={marks:[],pack:{}};", box);
  const pr = box.qcPackRows('lotQAForm', ['Germ'], 'r');
  ok('liquid pack checks: Tight / Loose, No drip / Leaking, Dry / Wet', /Tight, seal in place/.test(pr) && /No drip/.test(pr) && /Leaking/.test(pr) && /Wet or stained/.test(pr) && !/> Pass</.test(pr));
  ok('the record checks answer Correct price / Wrong price and Dates match / Dates differ', /qcAns\(it\.label\)\[0\]/.test(grab('qcVerifyRows')) && /'Price on the pack is correct':\['Correct price','Wrong price'\]/.test(html) && /'Mfg &amp; expiry on the pack match the record':\['Dates match','Dates differ'\]/.test(html));
  ok('the FOC sample check answers in its own words', /smpAns\(q\)\[0\]/.test(html) && /'Seal intact, no leak or damage':\['Intact','Broken, leak or damage'\]/.test(html));
  ok('the saved value is still pass or fail underneath', /setFn\+'\('\+i\+',\\'pass\\'\)'/.test(grab('qcChecklistRows')));
  ok('the truck form asks when it was checked, and refuses without it', /qcWhenRow\('dispQAForm','renderDispatchQA'\)/.test(grab('renderDispatchQA')) && /Say when you checked this truck: before, during or after loading\./.test(grab('dispQASubmit')));
  ok('the truck form reads the batch on the bags, not a pallet', /The bags show/.test(grab('dispPalletBlock')) && !/printed on the pallet/.test(grab('dispPalletBlock')));
  ok('pack checks, pallets and when are saved beside the 8 items', /packChecks:_packRows,onPallets:dispQAForm\.onPallets\|\|'',checkedWhen:dispQAForm\.when\|\|''/.test(grab('dispQASubmit')));
  ok('a failed pack check fails the truck, the lot and the packed lot', /_packRows\.some\(function\(x\)\{ return x\.result==='fail'; \}\)/.test(grab('dispQASubmit')) && /_lpk\.some\(x=>x\.result==='fail'\)/.test(grab('lotQASubmit')) && /_ppk\.some\(x=>x\.result==='fail'\)/.test(grab('savePackInspect')));
  ok('reports print the pack checks', (html.match(/concat\((q|x|p\.qa)\.packChecks\|\|\[\]\)/g) || []).length >= 6);
  ok('the batch record check follows the bag check, with no buttons', /follows the bag check above/.test(grab('qcVerifyRows')));
  ok('the FOC sample check has no All pass button', !/onclick="smpMarkAll\(\)"/.test(html));
}

/* 10. a look-alike batch number is refused once */
{
  const logs = []; const box = { logAction: m => logs.push(m), state: { role: 'Production', currentUser: { name: 'Ali Raza' }, batches: [{ id: 'B1', batchNo: 'VLM26001', openedDate: '2026-08-01' }], packingLog: [] } };
  vm.createContext(box); ['fyKey', '_bnoKey', 'batchNearMatch', 'batchNearGate'].forEach(f => vm.runInContext(grab(f), box)); vm.runInContext("var _bnoAck='';", box);
  const fy = box.fyKey('2026-10-15');
  eq('"VLM 26001" matches "VLM26001" once spaces and capitals are ignored', box.batchNearMatch('vlm 26001', fy), 'VLM26001');
  ok('the first press is refused with the reason', /looks the same as "VLM26001"/.test(box.batchNearGate('VLM 26001', fy)));
  eq('pressing again with the same number adds it', box.batchNearGate('VLM 26001', fy), '');
  ok('...and the action log says who confirmed it', /added although it looks the same as "VLM26001".*Ali Raza/.test(logs[0]));
  eq('an ordinary new number passes', box.batchNearGate('VLM26002', fy), '');
  ok('all 6 batch-number entries use it', (html.match(/batchNearGate\((no,fy,b\.id|batchNo,_fy|bn,_fy|bn,fy)\)/g) || []).length === 6);
}

/* 11. Build, changelog and Guide move together */
{
  ok('BUILD_ID is 2026-10-15f or later', (/var BUILD_ID='([^']+)'/.exec(html) || [])[1] >= '2026-10-15f');
  ok('the changelog has the 15f entry', /\{ver:'2026-10-15f', date:'2026-10-15', title:"One stuck rule, Pack from base, and the truck steps Tahir ruled on 15 Oct"/.test(html));
  const rules = grab('guideRules');
  ['What the Stuck batches list means', 'Pack from base', 'Vehicle and driver on every truck', 'Changing a batch at loading', 'Fixing a sent-back truck', 'Truck released: hand the papers to the driver', 'How long a truck job has waited', 'Shared jobs', 'A batch number that looks like another'].forEach(t => ok('The Rules: ' + t, rules.indexOf('<h3>' + t + '</h3>') > -1));
  ok('The Rules: QA checks by pack type', /<h3>QA checks by pack type<\/h3>/.test(html));
  ok('The stuck rule names 7 days and any order age', /for <b>7 days<\/b>/.test(rules) && /Orders of <b>any age<\/b> count/.test(rules));
  ok('My job: a 15f note for every role touched', ['Production', 'Production Manager', 'Plant Manager', 'QA Inspector', 'Warehouse', 'Supply Chain', 'Supply Chain Officer', 'COO'].every(r => new RegExp("var _n15f=\\{[\\s\\S]*'" + r + "':").test(grab('guideMyJob'))));
  ok('How it works: the Start loading sheet and Handed to driver', /Start loading sheet/.test(grab('guideHow')) && /taps Handed to driver/.test(grab('guideHow')));
}

process.exitCode = report('15f: one stuck rule and the truck steps') ? 1 : 0;
