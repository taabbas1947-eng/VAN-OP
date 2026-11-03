/* BUILD 2026-11-03b. Tahir, 3 Nov 2026 (picture page "Correct Button by Area", all 5 ruled; panel of 3 Nov on the 6 fields):
   the Correct button on a single record follows the areas of Correct a record (D-365, R-052).
   Run: node correct1103b.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, grabTopVar, html } = H;
const SRC = grabTopVar('DF_AREAS', '{') + '\n' + grab('hardRole') + '\n'
  + ['correctAllowed', 'correctFieldOK', 'correctAnyField', 'correctCanAmend'].map(grab).join('\n') + '\n'
  + 'var CORRECT_ENTITY=' + grabTopVar('CORRECT_ENTITY', '{').replace(/^\s*var\s+CORRECT_ENTITY\s*=\s*/, '') + ';';
function mk(role) {
  const b = { console, JSON, Object, String, Array, Date, Math, state: { role, orders: [], packingLog: [], shipments: [], batches: [], inspections: [] },
    fmt: x => String(x), shortClient: x => x, lotMoveLock: () => null, batchClearedKg: () => 0 };
  vm.createContext(b); vm.runInContext(SRC, b); return b; }
const ROLES = ['COO', 'CFO', 'KAM', 'Production', 'Production Manager', 'Plant Manager', 'Supply Chain', 'Finance', 'Warehouse', 'QCM', 'QA Inspector', 'Supply Chain Officer'];
/* who may correct (AMEND) and reverse each record type, after the build */
const WANT = {
  /* reverse on a PO and a line: nobody (Tahir, 3 Nov, after review: 'Take it off; use Close') */
  order:      { a: ['COO', 'CFO'], r: [] },
  orderLine:  { a: ['COO', 'CFO'], r: [] },
  packingLot: { a: ['COO', 'Plant Manager', 'Production Manager'], r: ['COO', 'Plant Manager', 'Production Manager'] },
  shipment:   { a: ['COO', 'Plant Manager', 'Supply Chain'], r: ['COO', 'Plant Manager', 'Supply Chain'] },
  batch:      { a: ['COO', 'Plant Manager', 'Production Manager'], r: [] } };
/* 1. the record lists */
Object.keys(WANT).forEach(t => ROLES.forEach(role => { const b = mk(role);
  eq(t + ' · ' + role + ' corrects', b.correctAllowed(t, 'AMEND'), WANT[t].a.indexOf(role) > -1);
  eq(t + ' · ' + role + ' reverses', b.correctAllowed(t, 'REVERSE'), WANT[t].r.indexOf(role) > -1);
  eq(t + ' · ' + role + ' sees the button (any field)', b.correctCanAmend(t), WANT[t].a.indexOf(role) > -1); }));
/* 2. the lists ARE the areas, one source (DF_AREAS) */
{ const b = mk('COO'); const E = b.CORRECT_ENTITY, A = b.DF_AREAS;
  ok('order and orderLine correct by DF_AREAS.correct', E.order.amend === A.correct && E.orderLine.amend === A.correct);
  ok('order and orderLine: nobody reverses (empty lists), and each says how to end it', E.order.reverse.length === 0 && E.orderLine.reverse.length === 0 && /Close products/.test(E.order.noReverse) && /Close this line/.test(E.orderLine.noReverse));
  ok('packingLot uses DF_AREAS.packing', E.packingLot.amend === A.packing && E.packingLot.reverse === A.packing);
  ok('shipment uses DF_AREAS.shipment', E.shipment.amend === A.shipment && E.shipment.reverse === A.shipment);
  ok('batch corrects by DF_AREAS.production; nobody reverses a batch', E.batch.amend === A.production && Array.isArray(E.batch.reverse) && E.batch.reverse.length === 0);
  ok('the dead amendPriced list is gone', !('amendPriced' in E.orderLine));
  ok('coa unchanged: supersede QCM, COO; no amend, no reverse', E.coa.amend.length === 0 && E.coa.reverse.length === 0 && E.coa.supersede.join() === 'QCM,COO');
  ok('inspection unchanged: supersede QA Inspector, Plant Manager, COO', E.inspection.supersede.join() === 'QA Inspector,Plant Manager,COO'); }
/* 3. the fields: who may change each one */
function fld(b, t, k) { return b.CORRECT_ENTITY[t].fields.find(x => x.k === k); }
const F = [
  ['packingLot', 'brandBatchNo', ['COO', 'Plant Manager']], ['packingLot', 'mfgDate', ['COO', 'Plant Manager']], ['packingLot', 'expDate', ['COO', 'Plant Manager']],
  ['packingLot', 'bagMfg', ['COO', 'Plant Manager', 'Production Manager']], ['packingLot', 'printedMfg', ['COO', 'Plant Manager', 'Production Manager']],
  ['packingLot', 'printedPrice', ['COO', 'Plant Manager', 'Production Manager']], ['packingLot', 'actualDate', ['COO', 'Plant Manager', 'Production Manager']],
  ['batch', 'batchNo', ['COO', 'Plant Manager']], ['batch', 'plannedKg', ['COO', 'Plant Manager']], ['batch', 'producedKg', ['COO', 'Plant Manager']],
  ['batch', 'openedDate', ['COO', 'Plant Manager', 'Production Manager']],
  ['orderLine', 'invoicePrice', ['COO', 'CFO']], ['orderLine', 'committed', ['COO', 'CFO']], ['orderLine', 'printPrice', ['COO', 'CFO']],
  ['order', 'client', ['COO', 'CFO']], ['shipment', 'vehicle', ['COO', 'Plant Manager', 'Supply Chain']] ];
F.forEach(([t, k, who]) => ROLES.forEach(role => { const b = mk(role);
  eq(t + '.' + k + ' · ' + role, b.correctFieldOK(t, fld(b, t, k)), who.indexOf(role) > -1); }));
/* 4. the ordered quantity is locked on the PO line's Correct button (25 Sep rule; Tahir, 3 Nov: "yes") */
{ const b = mk('COO'); const f = fld(b, 'orderLine', 'ordered');
  ok('Ordered has a lock', typeof f.lockedIf === 'function');
  ok('...that always answers, with the close-short and new-order routes', /never rewritten/.test(f.lockedIf({})) && /close the line short/.test(f.lockedIf({})) && /new order/.test(f.lockedIf({ ordered: 5 })));
  ok('applyCorrect refuses a locked field (the save checks lockedIf, not only the form)', /var lock=null; try\{ lock=x\.lockedIf\?x\.lockedIf\(tgt\):null; \}catch\(e\)\{\}\s*if\(lock\)\{ refused=/.test(html)); }
/* 5. the switch does not stop the Correct button (Tahir, 3 Nov: routine corrections stay with each user) */
['correctAllowed', 'correctFieldOK', 'correctAnyField', 'correctCanAmend', 'openCorrect', 'renderCorrect', 'applyCorrect'].forEach(fn => {
  let s = ''; try { s = grab(fn); } catch (e) { s = ''; }
  if (s) ok(fn + ' does not look at the corrections switch', !/dfOn\(\)|dataFixEnabled/.test(s)); });
ok('the CORRECT_ENTITY registry does not look at the switch', !/dfOn\(\)|dataFixEnabled/.test(grabTopVar('CORRECT_ENTITY', '{')));
/* 6. wording follows */
ok('a PO sent back says correcting a PO is the COO\'s or the CFO\'s', /correcting a PO is the COO’s or the CFO’s — ask them/.test(html) && !/Correct a record is the KAM’s/.test(html));
ok('the shift and in-charge rule no longer names Production on the Correct button', !/its <b>Correct<\/b> button: Production, the Plant Manager or the COO/.test(html));
ok('the month on the bag: Correct the month names the packing area', /<b>Correct the month<\/b> \(the COO, the Plant Manager or the Production Manager; the month only\)/.test(html));
ok('Guide R-052 explains the Correct button by area and the switch', /The <b>Correct<\/b> button on a single record follows the same areas, and the switch does not stop it/.test(html));
ok('BUILD_ID and SYSDOC_VER are 2026-11-03b or later', /var BUILD_ID='2026-(11-(03[b-z]|0[4-9][a-z]|[1-3]\d[a-z])|12-\d\d[a-z])'/.test(html) && /var SYSDOC_VER='2026-(11-(03[b-z]|0[4-9][a-z]|[1-3]\d[a-z])|12-\d\d[a-z])'/.test(html));
ok('changelog 2026-11-03b is there', /\{ver:'2026-11-03b', date:'2026-11-03', title:"The Correct button follows the areas"/.test(html));
/* 7. Batch trace's Correct the month follows the fields */
{ const b = mk('Production'); vm.runInContext("var BT_MONTH_FIELDS=['bagMfg','printedMfg'];\n" + grab('btMonthMay'), b);
  ok('Production no longer sees Correct the month', !b.btMonthMay());
  ['Production Manager', 'Plant Manager', 'COO'].forEach(r => { const c = mk(r); vm.runInContext("var BT_MONTH_FIELDS=['bagMfg','printedMfg'];\n" + grab('btMonthMay'), c);
    ok(r + ' sees Correct the month', c.btMonthMay()); }); }
/* 8. the real sheet and save (review 1: test the save, not only the text) */
{ const SRC2 = H.correctEntitySrc() + '\n' + H.grabObj('CORRECT_REASONS') + '\n' + ['hardRole', 'correctAllowed', 'correctFieldOK', 'correctAnyField', 'correctCanAmend', 'correctLabelLc', 'correctTarget', 'openCorrect', 'renderCorrect', 'correctSetOp', 'applyCorrect', '_pe'].map(grab).join('\n');
  const mk2 = role => { const log = { toasts: [], reg: [], html: '' };
    const modal = { classList: { add() {}, remove() {} }, set innerHTML(v) { log.html = v; }, get innerHTML() { return log.html; } };
    const st = { role, currentUser: { name: 'T' }, orders: [{ id: 'O1', po: 'P1', client: 'A', priority: 'Normal', lines: [{ id: 'L1', brand: 'X', ordered: 1000, committed: '2026-11-20', printPrice: 50, invoicePrice: 100 }] }], packingLog: [], shipments: [], batches: [], inspections: [] };
    const b = { console, JSON, Object, String, Array, Math, Date, state: st, log, fmt: x => String(x), shortClient: x => x, lotMoveLock: () => null, batchClearedKg: () => 0,
      toast: m => log.toasts.push(m), save() {}, render() {}, closeModal() {}, logAction() {}, qsEsc: x => String(x), _av: x => String(x), _tx: x => String(x == null ? '' : x),
      evToday: () => '2026-11-03', isCorrection: (a, c) => String(a) !== String(c), recordCorrection: (...a) => log.reg.push(a),
      document: { getElementById: () => null }, $: id => id === 'modal' ? modal : { classList: { add() {}, remove() {} } } };
    b.globalThis = b; vm.createContext(b); vm.runInContext(SRC2, b); return b; };
  const b = mk2('CFO'); b.openCorrect('orderLine', 'L1');
  ok('8a the CFO opens a PO line: Ordered shows as locked, no Reverse button, the Close this line note', !!b.correctForm && /locked/.test(b.log.html) && !/Reverse it/.test(b.log.html) && /Close this line/.test(b.log.html));
  vm.runInContext("correctForm.vals.ordered=500; correctForm.vals.committed='2026-11-25'; correctForm.reasonCode=CORRECT_REASONS[0].k; correctForm.reason='client changed it by email';", b); b.applyCorrect();
  const l = b.state.orders[0].lines[0];
  ok('8b saving a new Ordered is refused, and nothing in that save is written', l.ordered === 1000 && l.committed === '2026-11-20' && b.log.reg.length === 0 && b.log.toasts.some(t => /Ordered \(Kg\/L\) cannot be changed — The ordered quantity is never rewritten/.test(t)));
  vm.runInContext("correctForm=null;", b); b.openCorrect('orderLine', 'L1');
  vm.runInContext("correctForm.vals.committed='2026-11-25'; correctForm.reasonCode=CORRECT_REASONS[0].k; correctForm.reason='client changed it by email';", b); b.applyCorrect();
  ok('8c the CFO can still correct the committed date', l.committed === '2026-11-25' && b.log.reg.length === 1);
  const c = mk2('COO'); c.openCorrect('order', 'O1');
  ok('8d the COO opens a PO: no Reverse button, the Close products note', !/Reverse it/.test(c.log.html) && /Close products/.test(c.log.html));
  vm.runInContext("correctForm.op='REVERSE'; correctForm.reasonCode=CORRECT_REASONS[0].k; correctForm.reason='duplicate PO entered';", c); c.applyCorrect();
  ok('8e a forced REVERSE on a PO is refused, nothing marked, nothing in the register', c.state.orders[0].reversed === undefined && c.log.reg.length === 0 && c.log.toasts.some(t => /do not have authority/.test(t)));
  const k = mk2('KAM'); k.openCorrect('orderLine', 'L1');
  ok('8f the KAM is refused, and the message keeps PO in capitals', !k.correctForm && k.log.toasts[0] === 'You do not have authority to correct a PO product line'); }
/* 9. the PO sent back sheet says how a wrong quantity is fixed; the packing notes name the right people */
ok('9a sent back: a wrong quantity is closed short or a new order', /A wrong quantity is not corrected: the ordered quantity is never rewritten\. Less than ordered: close the line short with a reason\. More: a new order\./.test(grab('openPoReturn')));
ok('9b Packed in 2 months no longer says Production corrects its month', !/Production corrects its month/.test(html) && /the COO, the Plant Manager or the Production Manager corrects its month/.test(html));
ok('9c the packing price note asks the COO or the CFO, not the KAM', /ask the COO or the CFO to set it on the PO line \(its Correct button\)/.test(html) && !/ask the KAM to set it on the PO/.test(html));
ok('9d the Guide says where each button is and that a shipment has none yet', /A shipment has no Correct button on any screen yet/.test(html) && /Nobody reverses a PO or a line: to end one, the COO closes it short with a reason/.test(html));
/* 10. review 2 (Tahir, 3 Nov: 'Add Correct to the card'): the order sheet's product card carries Correct for the COO and the CFO only */
{ const src = grab('openOrderSheet');
  ok('10a the card asks correctCanAmend(\'orderLine\') and opens the line\'s Correct sheet', src.indexOf("+((typeof correctCanAmend==='function'&&correctCanAmend('orderLine'))?'<button class=\"qs-btn sm ghost\"") > -1 && src.indexOf("onclick=\"closeModal();openCorrect(\\'orderLine\\',\\''+qsEsc(l.id)+'\\')\">Correct</button>'") > -1);
  ROLES.forEach(role => eq('10b ' + role + ' sees Correct on the card', mk(role).correctCanAmend('orderLine'), ['COO', 'CFO'].indexOf(role) > -1));
  ok('10c the older drawer asks the same thing, no dead REVERSE check', /correctCanAmend\('orderLine'\)\?` <button/.test(html) && !/correctAllowed\('orderLine','REVERSE'\)/.test(html));
  ok('10d the reverse notes say the COO closes, the CFO asks the COO', /the COO closes them short with <b>Close products\\u2026<\/b> on the order, with a reason; the CFO asks the COO/.test(html) && /the COO closes it short with <b>Close this line<\/b> on the order, with a reason; the CFO asks the COO/.test(html));
  ok('10e the Guide names the order sheet', /A PO line \(Orders, the order sheet: <b>Correct<\/b> on each product\)/.test(html));
  ok('10f Finance\'s note: a PO is corrected by the CFO or the COO', /'Finance':'A PO or a new customer sent back to you shows the reason on your Today\. A customer you correct and send on again\. A PO is corrected by the CFO or the COO/.test(html)); }
/* 11. a Production person changing an existing batch number gets 1 clear message, not 2 */
{ const sb = (role, ok2) => { const log = []; const b = { console, state: { role, batches: [{ id: 'B1', batchNo: 'HG26001', openedDate: '2026-10-01' }] }, toast: m => log.push(m), log, opened: [],
    openCorrect: (t, id) => b.opened.push(t + ':' + id), TODAY: new Date('2026-11-03'), fyKey: () => '2026-27', batchOwnerInFY: () => false, batchNearGate: () => null, validateBatchNo: () => true };
    vm.createContext(b); vm.runInContext(SRC + '\n' + grab('setBatchNo'), b); return b; };
  const p = sb('Production'); p.setBatchNo('B1', 'HG26009');
  ok('11a Production: 1 message naming the Plant Manager and the COO, no sheet', p.log.length === 1 && /Plant Manager\u2019s or the COO\u2019s/.test(p.log[0]) && p.opened.length === 0 && p.state.batches[0].batchNo === 'HG26001');
  const c = sb('COO'); c.setBatchNo('B1', 'HG26009');
  ok('11b the COO is sent to the Correct sheet, with 1 message', c.opened.join() === 'batch:B1' && c.state.batches[0].batchNo === 'HG26001' && c.log.length === 1); }
/* 12. review 3 (Tahir, 3 Nov: 'Add Correct to each run', then '1 picker under the table'): Batch trace opens a packing run's full Correct sheet */
{ const pk = role => { const b = mk(role); b.state.packingLog = [{ id: 'PK1', kg: 4000, bagMfg: '2026-10' }, { id: 'PK2', kg: 2000, reversed: true }, { id: 'PK3', kg: 500, mfgDate: '2026-06-01' }];
    Object.assign(b, { _av: x => String(x), qsEsc: x => String(x), bagMonthLabel: m => 'Oct-2026', lotBagDates: p => ({ mfg: p.mfgDate || '' }) });
    vm.runInContext(grab('btRunMay') + '\n' + grab('btRunPicker'), b); return b; };
  const G = { lots: [{ id: 'PK1' }, { id: 'PK2' }, { id: 'PK3' }] };
  ROLES.forEach(role => { const h = pk(role).btRunPicker(G);
    eq('12a ' + role + ' sees the run picker', h !== '', ['COO', 'Plant Manager', 'Production Manager'].indexOf(role) > -1); });
  const h = pk('Production Manager').btRunPicker(G);
  ok('12b 1 picker and 1 button under the table, not a button on each run', (h.match(/<button/g) || []).length === 1 && (h.match(/<select/g) || []).length === 1);
  ok('12c it lists the live runs only, with their month', /PK1 · Oct-2026 · 4000 Kg/.test(h) && /PK3 · 2026-06-01 · 500 Kg/.test(h) && !/PK2/.test(h));
  ok('12d the button opens the run\'s full sheet (no field list), from the picked run', /openCorrect\('packingLot',document\.getElementById\('btRunPick'\)\.value\)">Correct/.test(h));
  ok('12e the packing run sheet shows it beside Ask for a correction and Correct the month', /\+bfxPicker\(g\)\+btRunPicker\(g\)\+btMonthPicker\(g\);/.test(grab('btOpenPack')));
  ok('12f the run picker does not read the switch', !/dfOn\(\)|dataFixEnabled/.test(grab('btRunPicker') + grab('btRunMay')));
  ok('12g the Guide names Batch trace and Correct on the batch', /A packing run \(Reports, Batch trace, the packing runs of a brand batch: pick the run, <b>Correct\\u2026<\/b>/.test(html) && /A batch \(Production, <b>Correct\\u2026<\/b> on the batch, and the Closed batches card\)/.test(html)); }
/* 13. review 4: the run's sheet, run for real from the picker's call — what Reverse refuses, and the printed price */
{ const SRC3 = H.correctEntitySrc() + '\n' + H.grabObj('CORRECT_REASONS') + '\n' + ['hardRole', 'correctAllowed', 'correctFieldOK', 'correctAnyField', 'correctCanAmend', 'correctLabelLc', 'correctTarget', 'openCorrect', 'renderCorrect', 'correctSetOp', 'applyCorrect', '_pe'].map(grab).join('\n');
  const run = (extra) => Object.assign({ id: 'PK1', po: 'P1', lid: 'L1', brand: 'X', kg: 4000, baseBatchId: 'B1', bagMfg: '2026-10', printedPrice: 500, printPrice: 500, poPrintPrice: 500, insKg: 0, shipKg: 0 }, extra || {});
  const mk3 = (role, p, holds, ships) => { const log = { toasts: [], reg: [], html: '' };
    const modal = { classList: { add() {}, remove() {} }, set innerHTML(v) { log.html = v; }, get innerHTML() { return log.html; } };
    const st = { role, currentUser: { name: 'T' }, orders: [{ id: 'O1', po: 'P1', lines: [{ id: 'L1', brand: 'X', ordered: 5000, packed: 4000, produced: 4000 }] }],
      batches: [{ id: 'B1', batchNo: 'HG1', packedKg: 4000 }], packingLog: [p], shipments: ships || [], inspections: [] };
    const b = { console, JSON, Object, String, Array, Math, Date, state: st, log, fmt: x => String(x), shortClient: x => x, lotMoveLock: () => null, batchClearedKg: () => 0,
      cmpLotHold: q => (holds && holds[q.id]) || null, lotBrandNo: q => q.brandBatchNo || '', toast: m => log.toasts.push(m), save() {}, render() {}, closeModal() {}, logAction() {}, qsEsc: x => String(x), _av: x => String(x),
      _tx: x => String(x == null ? '' : x), evToday: () => '2026-11-03', isCorrection: (a, c) => String(a) !== String(c), recordCorrection: (...a) => log.reg.push(a),
      document: { getElementById: () => null }, $: id => id === 'modal' ? modal : { classList: { add() {}, remove() {} } } };
    b.globalThis = b; vm.createContext(b); vm.runInContext(SRC3, b); return b; };
  const tryRev = (p, holds, ships) => { const b = mk3('Production Manager', p, holds, ships); b.openCorrect('packingLot', 'PK1');
    vm.runInContext("correctForm.op='REVERSE'; correctForm.reasonCode=CORRECT_REASONS[0].k; correctForm.reason='packed against the wrong line';", b); b.renderCorrect(); const shown = b.log.html; b.applyCorrect(); return { b, shown }; };
  [['cleared by QA', run({ insKg: 4000 }), null, /Withdraw the inspection first/],
   ['on a truck', run({ shipKg: 1000 }), null, /put on a truck/],
   ['on QA hold', run({ qaHold: { reason: 'r' } }), null, /QA hold/],
   ['already reversed', run({ reversed: true }), null, /already reversed or voided/],
   ['a truck took (lot link)', run(), null, /Truck DC 77 took this run/, [{ id: 'S1', dc: '77', po: 'P1', brand: 'X', kg: 4000, stage: 'delivered', lotTake: [{ lotId: 'PK1', kg: 4000 }] }]],
   ['an older truck took (its batch number, no lot link)', run({ brandBatchNo: 'VAN1' }), null, /took this run/, [{ id: 'S2', dc: '78', po: 'P1', brand: 'X', kg: 100, stage: 'truck_planned', batches: [{ brand: 'VAN1', kg: 100 }] }]]].forEach(([why, p, holds, re, ships]) => {
    const { b, shown } = tryRev(p, holds, ships);
    ok('13a a run ' + why + ' cannot be reversed: the sheet says why, the save refuses, nothing moves', /It cannot be reversed now/.test(shown) && re.test(shown) && b.log.reg.length === 0 && b.log.toasts.some(t => /^Cannot reverse — /.test(t) && re.test(t)) && b.state.batches[0].packedKg === 4000 && b.state.orders[0].lines[0].packed === 4000); });
  { const { b } = tryRev(run(), { PK1: { id: 'C1' } });
    ok('13g a run held by a complaint CAN be reversed (the complaint\'s written-off lift asks for it first; review 5: no loop)', b.state.packingLog[0].reversed === true && b.log.reg.length === 1); }
  { const { b } = tryRev(run({ brandBatchNo: 'VAN1' }), null, [{ id: 'S9', dc: '90', po: 'P1', brand: 'X', kg: 3000, stage: 'delivered', lotTake: [{ lotId: 'PK9', kg: 3000 }], batches: [{ lotId: 'PK9', brand: 'VAN9', kg: 3000 }] }]);
    ok('13h a delivered truck of the same product that did NOT take this run does not block it (Tahir, 3 Nov: only its own Kg)', b.state.packingLog[0].reversed === true); }
  { const { b } = tryRev(run());
    ok('13b a clean run is reversed: the run, the batch and the line follow, 1 register line', b.state.packingLog[0].reversed === true && b.state.batches[0].packedKg === 0 && b.state.orders[0].lines[0].packed === 0 && b.log.reg.length === 1 && b.log.reg[0][0] === 'REVERSE'); }
  { const b = mk3('Production Manager', run()); b.openCorrect('packingLot', 'PK1');
    vm.runInContext("correctForm.vals.printedPrice=550; correctForm.reasonCode=CORRECT_REASONS[0].k; correctForm.reason='bags read 550 at the store check';", b); b.applyCorrect();
    const q = b.state.packingLog[0];
    ok('13c a corrected printed price is the one QA and the papers read, and the mismatch is worked out again', q.printedPrice === 550 && q.printPrice === 550 && q.priceMismatch === true && b.log.reg.length === 1 && /follows \(550\)/.test(String(b.log.reg[0][7]))); }
  { const b = mk3('Production Manager', run({ insKg: 4000 })); b.openCorrect('packingLot', 'PK1');
    vm.runInContext("correctForm.vals.printedPrice=550; correctForm.reasonCode=CORRECT_REASONS[0].k; correctForm.reason='bags read 550 at the store check';", b); b.applyCorrect();
    ok('13d on a cleared run the printed price is locked', b.state.packingLog[0].printedPrice === 500 && b.log.reg.length === 0 && b.log.toasts.some(t => /Price printed on the pack cannot be changed — 4000 Kg\/L has been CLEARED by QA/.test(t))); }
  { const b = mk3('Production Manager', run({ noPrintPack: true, printedPrice: null })); b.openCorrect('packingLot', 'PK1');
    vm.runInContext("correctForm.vals.printedPrice=550; correctForm.reasonCode=CORRECT_REASONS[0].k; correctForm.reason='bags read 550 at the store check';", b); b.applyCorrect();
    ok('13i a run packed with no price printed: the price stays locked', b.log.reg.length === 0 && b.log.toasts.some(t => /packed with no price printed/.test(t))); }
  { const b = mk3('Production Manager', run()); b.openCorrect('packingLot', 'PK1');
    vm.runInContext("correctForm.vals.printedPrice=''; correctForm.reasonCode=CORRECT_REASONS[0].k; correctForm.reason='emptied the box by mistake';", b); b.applyCorrect();
    ok('13j an emptied price box is refused, not saved as 0', b.state.packingLog[0].printedPrice === 500 && b.log.reg.length === 0 && b.log.toasts.some(t => /more than 0/.test(t))); }
  { const b0 = mk3('Production Manager', run()); b0.state.orders[0].lines[0].dispatched = 3500; b0.state.orders[0].lines[0].packed = 4000;
    b0.openCorrect('packingLot', 'PK1'); vm.runInContext("correctForm.op='REVERSE'; correctForm.reasonCode=CORRECT_REASONS[0].k; correctForm.reason='packed against the wrong line';", b0); b0.renderCorrect(); const sh = b0.log.html; b0.applyCorrect();
    ok('13l a reverse that would leave packed below what left the gate is refused (as Bring packed back refuses)', /has already left the gate\. Reversing this run would leave packed at 0, below it/.test(sh) && b0.state.packingLog[0].reversed !== true && b0.state.orders[0].lines[0].packed === 4000 && b0.log.reg.length === 0); }
  { const b0 = mk3('Production Manager', run()); b0.state.orders[0].lines[0].dispatched = 500; b0.state.orders[0].lines[0].packed = 5000;
    b0.openCorrect('packingLot', 'PK1'); vm.runInContext("correctForm.op='REVERSE'; correctForm.reasonCode=CORRECT_REASONS[0].k; correctForm.reason='packed against the wrong line';", b0); b0.applyCorrect();
    ok('13m ...and allowed when packed stays at or above it', b0.state.packingLog[0].reversed === true && b0.state.orders[0].lines[0].packed === 1000); }
  { const src = grab('openOrderSheet');
    ok('13n the order sheet has Correct the PO for whoever correctCanAmend(\'order\') allows', src.indexOf("close+=((typeof correctCanAmend==='function'&&correctCanAmend('order'))?'<button class=\"qs-btn\"") > -1 && src.indexOf("openCorrect(\\'order\\',\\''+qsEsc(o.id)+'\\')\">Correct the PO</button>'") > -1);
    ROLES.forEach(role => eq('13o ' + role + ' sees Correct the PO', mk(role).correctCanAmend('order'), ['COO', 'CFO'].indexOf(role) > -1)); }
  ok('13p the complaint lift names who reverses and how', /Ask the COO, the Plant Manager or the Production Manager to reverse it first \(Reports, Batch trace: pick the run, Correct; if QA cleared it, QA withdraws the inspection first\)/.test(html));
  { /* review 7: the run's own line, not the first line of that brand */
    const b0 = mk3('Production Manager', run({ lid: 'L2' })); b0.state.orders[0].lines = [{ id: 'L1', brand: 'X', ordered: 5000, packed: 4000, dispatched: 0 }, { id: 'L2', brand: 'X', ordered: 5000, packed: 4000, dispatched: 3500 }];
    b0.openCorrect('packingLot', 'PK1'); vm.runInContext("correctForm.op='REVERSE'; correctForm.reasonCode=CORRECT_REASONS[0].k; correctForm.reason='packed against the wrong line';", b0); b0.applyCorrect();
    ok('13q 2 lines of the same brand: the refusal reads the run\'s own line (L2, 3500 gone)', b0.state.packingLog[0].reversed !== true && b0.log.toasts.some(t => /has already left the gate\. Reversing this run would leave packed at 0, below it\. The material was real: keep this run\./.test(t))); }
  { const { b } = tryRev(run(), null, [{ id: 'S5', dc: '79', po: 'P1', brand: 'X', kg: 4000, stage: 'loading', batches: [{ lotId: 'PK1', brand: 'VAN1', kg: 4000 }] }]);
    ok('13r a truck whose batch line names this run (lotId, no lotTake) blocks it', b.state.packingLog[0].reversed !== true && b.log.toasts.some(t => /Truck DC 79 took this run/.test(t))); }
  ok('13s the PO sent back sheet says Correct the PO too; R-011 names the PO exception; the line note points to Batch trace', /Correct the PO'\+\(canFix\?' \(button below\)'/.test(grab('openPoReturn')) && />Correct the PO<\/button>/.test(grab('openPoReturn')) && /A PO sent back differs: only the COO and the CFO correct a PO, so anyone else who entered it asks them/.test(html) && /reverse that run instead \(Reports, Batch trace: pick the run, Correct\)/.test(html));
  ok('13k the Today card for a PO sent back says Open it, not Fix it', /'PO sent back':\s*\{title:'PO sent back to you',\s*verb:'Open it'\}/.test(html));
  ok('13e a batch number fix waiting on a reversed run cannot be approved', /if\(p\.reversed\|\|p\.void\)\{ toast\('This packing run has been reversed or voided, so its number no longer needs fixing/.test(grab('bfxDecide')));
  ok('13f the Guide says what stops a reverse', /A run QA has cleared, a run a truck took, a run on QA hold, and a run whose reverse would leave the line\\u2019s packed below what has left the gate cannot be reversed: withdraw the inspection or settle the hold first/.test(html)); }
if (report('correct1103b')) process.exitCode = 1;
