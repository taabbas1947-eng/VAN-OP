/* 16e · Held stock (Tahir, 17 Oct 2026). Two gaps found in the complaints build:
 *  1. an order line whose packed stock is ALL on complaint hold read "QA Pre-shipment" and sat in the
 *     QA Inspector's work. Ruled: same stage, a red "On complaint hold" tag; the next step and the owner
 *     come from the complaint; off QA's list; not stalled (held on purpose); still late if past its date.
 *  2. held stock dropped out of the ready-to-ship counts with no line saying why. Ruled: one "Held"
 *     heading for complaint holds and QA holds, each row saying why and who lifts it.
 * Runs the real functions from o2s.html. Run: node held16e.test.js */
const vm = require('vm');
const H = require('./harness.js');
const { ok, eq, report, grab, html, matchBlock } = H;

const constLine = name => { const i = html.indexOf('\nconst ' + name + '='); if (i < 0) throw new Error('no const ' + name); return matchBlock(i + 1, name, html[html.indexOf('=', i) + 1]) + ';'; };
const varLine = name => { const i = html.indexOf('\nvar ' + name + '='); if (i < 0) throw new Error('no var ' + name); return matchBlock(i + 1, name, html[html.indexOf('=', i) + 1]) + ';'; };
const FNS = ['lotsFor', 'lotHasBatch', 'lotBaseNo', 'lotBrandNo', 'lotAvail', 'lotClearedKg', 'lotShipKg', 'lineToInspect', 'lineUnbatched', 'lineToInspectTotal', 'lineCleared',
  'lineShortClosed', 'lineBucket', 'orderBucket', 'isStalled', 'qsEsc',
  'lotHeldWhy', 'lotHeldKg', 'heldWhyText', 'heldLiftText', 'cmpHeldPOs', 'lineCmpHeldKg', 'heldRunLine', 'lineHeld', 'lineHeldText', 'heldRuns', 'heldRunsKg', 'lineCmpHeld', 'orderCmpHeld', 'heldNextText', 'heldWhoText', 'heldTagHTML',
  'bucketOwnerOf', 'bucketNextOf', 'heldRunsTable'];
const SRC = constLine('BUCKETS') + '\n' + constLine('BUCKET_META') + '\n' + varLine('NEXT_ACT') + '\n' + FNS.map(grab).join('\n');

const C1 = { id: 'C1', no: 'CMP-0007' };
function box(st, holds) {
  const map = {}; Object.keys(holds).forEach(id => { const p = st.packingLog.find(x => x.id === id); map[id] = { c: holds[id], row: { po: p && p.po } }; });
  const s = { console, JSON, Object, Array, String, Math, Number, state: st, fmt: n => String(n), canView: () => true, _cmpHM: null, calls: 0,
    cmpLotHold: p => map[p.id] || null, cmpStatus: c => c.st || 'Routed', cmpHolder: c => c.who || 'with Asif Ali',
    orderAging: () => ({ days: 30 }), isOverdue: o => !!o.late, lotById: id => st.packingLog.find(x => x.id === id) };
  s.cmpHoldMap = () => { s.calls++; if (!s._cmpHM) s._cmpHM = { map }; return map; };
  vm.createContext(s); vm.runInContext(SRC, s); return s;
}
/* 1 line, 1000 packed in 2 runs, both inspected and cleared */
const DATA = () => ({ complaints: [C1], batches: [],
  orders: [{ id: 'O1', po: 'PO1', lines: [{ id: 'L1', brand: 'VL-Potash', ordered: 1000, packed: 1000, produced: 1000 }] }],
  packingLog: [{ id: 'R1', po: 'PO1', lid: 'L1', brand: 'VL-Potash', baseBatchNo: 'KL26011', kg: 600, insKg: 600, shipKg: 0, date: '2026-10-01' },
    { id: 'R2', po: 'PO1', lid: 'L1', brand: 'VL-Potash', baseBatchNo: 'KL26012', kg: 400, insKg: 400, shipKg: 0, date: '2026-10-02' }] });

{ const st = DATA(), s = box(st, {}), o = st.orders[0], l = o.lines[0];
  eq('no hold: the line is ready to ship', s.lineBucket(o, l), 'Shipment');
  eq('no hold: nothing held', s.lineHeld(o, l).kg, 0);
  eq('no hold: no held runs', s.heldRuns().length, 0);
  ok('no hold: the order is not complaint held', !s.orderCmpHeld(o)); }

{ const st = DATA(), s = box(st, { R1: C1 }), o = st.orders[0], l = o.lines[0];
  eq('1 of 2 runs held: still Shipment for the free run', s.lineBucket(o, l), 'Shipment');
  eq('1 of 2 runs held: 400 ready', s.lineCleared(o, l), 400);
  eq('1 of 2 runs held: 600 held', s.lineHeld(o, l).kg, 600);
  eq('the line note says why', s.lineHeldText(s.lineHeld(o, l)), '600 Kg/L held: complaint CMP-0007');
  ok('a part hold does not tag the order', !s.orderCmpHeld(o)); }

{ const st = DATA(), s = box(st, { R1: C1, R2: C1 }), o = st.orders[0], l = o.lines[0];
  eq('all held: the stage stays Packed · QA (QA Pre-shipment)', s.lineBucket(o, l), 'QA Pre-shipment');
  eq('all held: nothing to inspect', s.lineToInspectTotal(o, l), 0);
  eq('all held: nothing ready', s.lineCleared(o, l), 0);
  const h = s.orderCmpHeld(o);
  ok('all held: the order is complaint held', h && h.kg === 1000 && h.nos.join() === 'CMP-0007');
  eq('the owner comes from the complaint, not QA Inspector', s.bucketOwnerOf(o, 'QA Pre-shipment'), 'with Asif Ali');
  eq('the next step comes from the complaint', s.bucketNextOf(o, 'QA Pre-shipment'), 'Complaint CMP-0007: Routed');
  ok('the tag reads On complaint hold with the number', /On complaint hold · CMP-0007/.test(s.heldTagHTML(h)));
  eq('held on purpose is not stalled', s.isStalled(o), false);
  o.late = true; eq('isStalled leaves a late order to the late list', s.isStalled(o), false); o.late = false;
  eq('2 held runs', s.heldRuns().length, 2);
  eq('held Kg in all', s.heldRunsKg(), 1000);
  const t = s.heldRunsTable(s.heldRuns(), true, true);
  ok('the table says who lifts a complaint hold', /Senior Warehouse Officer or Tahir, when the complaint says/.test(t));
  ok('the table opens the complaint', /cmpOpenCase\('C1'\)/.test(t)); }

{ const st = DATA(); st.packingLog[0].qaHold = { reason: 'torn bags' }; const s = box(st, {}), o = st.orders[0], l = o.lines[0];
  eq('a QA hold is Held too, with its reason', s.lineHeld(o, l).why.join(), 'QA hold: torn bags');
  eq('QA held Kg', s.lineHeld(o, l).qaKg, 600);
  ok('a QA hold does not tag the order as complaint held', !s.orderCmpHeld(o));
  eq('QA hold: lifted by', s.heldLiftText(s.lotHeldWhy(st.packingLog[0])), 'Production Manager fixes it, then QA inspects again');
  ok('QA hold row keeps its Correct & re-inspect button', /clearQaHold\('R1'\)/.test(s.heldRunsTable(s.heldRuns(), true, true)));
  ok('without the right, the row says waiting', /waiting/.test(s.heldRunsTable(s.heldRuns(), true, false))); }

{ const st = DATA(); st.packingLog[0].shipKg = 200; const s = box(st, { R1: C1 }), o = st.orders[0], l = o.lines[0];
  eq('held Kg is what is not yet on a truck', s.lineHeld(o, l).kg, 400); }

{ const st = DATA(); st.complaints = []; st.packingLog[0].qaHold = { reason: 'x' }; st.packingLog[1].qaHold = { reason: 'x' }; const s = box(st, {}), o = st.orders[0];
  ok('no complaints: the order is never complaint held (QA hold keeps QA as owner)', !s.orderCmpHeld(o) && s.bucketOwnerOf(o, 'QA Pre-shipment') === 'QA Inspector'); }

/* review fixes, 17 Oct */
{ const st = DATA(); st.orders[0].lines[0].packed = 600; st.packingLog.pop(); const s = box(st, { R1: C1 }), o = st.orders[0], l = o.lines[0];
  ok('part packed, all of it held: the line still shows the work owed (no complaint owner)', s.lineBucket(o, l) !== 'QA Pre-shipment' && !s.orderCmpHeld(o));
  eq('... and its held stock is still named', s.lineHeld(o, l).kg, 600); }
{ const st = DATA(); const l0 = st.orders[0].lines[0]; l0.dispatched = 600; st.packingLog[0].shipKg = 600; const s = box(st, { R2: C1 }), o = st.orders[0];
  eq('part shipped, the rest held: the stage stays Shipment', s.lineBucket(o, l0), 'Shipment');
  ok('part shipped, the rest held: tagged, owner from the complaint', !!s.orderCmpHeld(o) && s.bucketOwnerOf(o, 'Shipment') === 'with Asif Ali');
  eq('part shipped, the rest held: not stalled', s.isStalled(o), false); }
{ const st = DATA(), C2 = { id: 'C2', no: 'CMP-0008', st: 'Findings in', who: 'with Tahir' }; const s = box(st, { R1: C1, R2: C2 }), o = st.orders[0];
  eq('2 complaints: each with its own status', s.bucketNextOf(o, 'QA Pre-shipment'), 'Complaint CMP-0007: Routed; CMP-0008: Findings in');
  eq('2 complaints: both holders', s.bucketOwnerOf(o, 'QA Pre-shipment'), 'with Asif Ali; with Tahir'); }
{ const st = DATA(); st.packingLog[1].qaHold = { reason: 'torn bags' }; const s = box(st, { R1: C1 }), o = st.orders[0];
  ok('complaint and QA hold: the QA fix stays in view', /and a QA hold to fix/.test(s.bucketNextOf(o, 'QA Pre-shipment')) && /Production Manager/.test(s.bucketOwnerOf(o, 'QA Pre-shipment'))); }
{ const st = DATA(); st.packingLog[0].qaHold = { reason: 'x' }; st.packingLog[0].shipKg = 600; const s = box(st, {});
  eq('a QA-held run all on trucks: not on Shipments or the dashboards', s.heldRuns().length, 0);
  eq('... but the QA screen keeps it for its fix button', s.heldRuns(true).length, 1); }
{ const st = DATA(); st.packingLog[0].po = 'NOPO'; const s = box(st, { R1: C1 });
  eq('a run with no order is not counted as held', s.heldRuns().length, 0); }
{ const st = DATA(); st.orders[0].lines[0].shortClose = { approvedAt: 'x' }; st.packingLog[0].qaHold = { reason: 'x' }; const s = box(st, {});
  eq('a QA-held run on a closed line stays on the Held list (its stock can still ship)', s.heldRuns(true).length, 1); }
{ const st = DATA(); st.packingLog[0].po = 'PO1'; const s = box(st, { R1: C1 }); s._cmpHM = null; s.cmpHoldMap = () => { if (!s._cmpHM) s._cmpHM = {}; return { R1: { c: C1, row: { po: 'OLDPO' } } }; };
  ok('the PO list reads the run\u2019s own PO first', s.cmpHeldPOs().PO1 === 1); }
{ const st = DATA(); st.orders.push({ id: 'O2', po: 'PO2', lines: [{ id: 'L2', brand: 'X', ordered: 10, packed: 10 }] }); const s = box(st, { R1: C1 });
  eq('speed: an order with nothing held is answered from the PO list', s.orderCmpHeld(st.orders[1]), null);
  s.orderCmpHeld(st.orders[0]); const memo = s._cmpHM.oh; ok('speed: the answer is kept for the render', memo && Object.prototype.hasOwnProperty.call(memo, 'O1')); }
{ const st = DATA(); const s = box(st, {}); s.orderCmpHeld(st.orders[0]); const c1 = s.calls; s.orderCmpHeld(st.orders[0]);
  ok('speed: no holds, the PO list is built once', s._cmpHM.pos === null && s.calls === c1 + 1); }
ok('tracker table escapes owner and next', /<td>'\+qsEsc\(owner\)\+'<\/td><td>'\+qsEsc\(next\)\+'<\/td>/.test(html));
ok('the Production Manager gets the Correct & re-inspect button', /isQA\|\|isSC\|\|isCOO\|\|state\.role==='Production Manager'/.test(grab('screenQA')));

/* the screens that read it */
ok('tracker "my work" filter skips a held order', /case 'myrole':return state\.role==='COO'\|\|\(BUCKET_META\[b\]\.owner===state\.role&&!orderCmpHeld\(o\)\)/.test(html));
ok('QA screen: Held card from heldRuns, Issues count includes it', /issues:lotFail\.length\+heldR\.length/.test(html) && /Held, not for shipping/.test(grab('screenQA')));
ok('Shipments Ready view lists held runs', /function renderShipToship\(rpos,ed\)\{ return renderShipToship0\(rpos,ed\)\+shipHeldHTML\(\); \}/.test(html));
ok('Packed, waiting to ship report: Waiting = Ready + Waiting for QA + Held', /awaitqa:Math\.max\(0,w-rd-hd\),held:hd/.test(html) && /\{k:'held',l:'Held',t:'meas'\}/.test(html));
ok('dashboards name held Kg beside ready', (html.match(/Kg\/L held'\):''/g) || []).length >= 3);
ok('order sheet: a held order opens the complaint, not QA', /openBtn=_h\?/.test(grab('openOrderSheet')));
ok('stock move says held stock is not offered', /Held stock is not offered here/.test(grab('renderMoveStock')));

process.exit(report('16e held stock') ? 1 : 0);
