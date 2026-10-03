/* 26a - 26 Sep 2026, Tahir's list from the floor:
   1. AP26012 made 1,010 of 2,710 and needs no more - where is Close batch? (only "Log output")
   2. The Production Manager can only ask to close a whole PO.
   3. A few bags filled from stock O2S does not track - Tahir ruled: close short with a new reason.
   4. A refused close request comes back to Fahim (see shortcloseactions.test.js for the refusal itself).
   5. The Plant Manager cannot see the DC or gate pass before he approves.
   Plus the "made so far" figure on a batch made for several orders.
   Run: node fixes26a.test.js */
const H = require('./harness.js'); const vm = require('vm'); const { ok, eq, report, grab, grabTopVar, html } = H;

/* ---------- 3. the new reason ---------- */
{ const R = new Function(grabTopVar('SHORTCLOSE_REASONS', '[') + '\nreturn SHORTCLOSE_REASONS;')();
  const r = R.find(x => x.code === 'outside_o2s');
  ok('a close reason for bags filled from stock outside O2S', !!r && r.label === 'Supplied from stock outside O2S');
  ok('...it is not counted against us (Tahir: the customer got the goods)', r && r.ours === false);
  ok('...the other reasons are all still there', ['customer_cancelled','customer_reduced','customer_no_uptake','our_shortfall','material_unavailable','commercial','other'].every(c => R.some(x => x.code === c))); }

/* ---------- 2. the close sheet ticks products ---------- */
function cpWorld(role, rights) {
  const lines = [
    { id: 'L1', brand: 'Green Phosphate', ordered: 15000, delivered: 3000, packed: 3600 },
    { id: 'L2', brand: 'V-Ammonium Phosphate', ordered: 2000, delivered: 0, packed: 300 },
    { id: 'L3', brand: 'Vibrant', ordered: 800, delivered: 800, packed: 800 } ];
  const o = { id: 'O1', po: 'COBO-2608-4613', client: 'VAN', lines };
  const b = { console, o, toasts: [], logged: [], html: '',
    state: { role, currentUser: { name: role === 'COO' ? 'Tahir Abbas' : 'Abdul Majid', username: role === 'COO' ? 'tahir' : 'majid' }, orders: [o], audit: [] },
    may: c => (rights || []).indexOf(c) > -1, denyRight: (c, w) => 'denied: ' + w,
    save() {}, render() {}, closeModal() {}, logAction(m) { b.logged.push(m); }, fmt: n => String(n), qsEsc: x => String(x), _tdClient: () => 'VAN' };
  b.toast = m => b.toasts.push(String(m));
  b.$ = () => ({ set innerHTML(v) { b.html = v; }, classList: { add() {} } });
  vm.createContext(b);
  vm.runInContext(grabTopVar('SHORTCLOSE_REASONS', '[') + '\nvar cpForm=null;\n' +
    ['lineShortClosed','lineShortRequested','lineShortRefused','scArchive','scReason','scWho','scFreeze','cpOpenLines','cpMode','openClosePO','cpPicked','cpTick','cpTickAll','renderClosePO','submitClosePO'].map(grab).join('\n'), b);
  return b; }
{ const b = cpWorld('Production Manager', ['po.shortclose_request']);
  b.openClosePO('O1');
  ok('the card opens the sheet with NOTHING ticked', /Tick a product first/.test(b.html) && !/ checked/.test(b.html));
  ok('...it lists only the open products (Vibrant is delivered)', /Green Phosphate/.test(b.html) && /V-Ammonium Phosphate/.test(b.html) && !/>Vibrant</.test(b.html));
  vm.runInContext("cpForm.reasonCode='customer_reduced'", b); b.submitClosePO();
  ok('submitting with nothing ticked closes nothing', !b.o.lines.some(l => l.shortClose) && /Tick at least one product/.test(b.toasts.slice(-1)[0]));
  b.cpTick('L2', true);
  ok('ticking one product names it on the button', /Ask to close 1 product · 2000 Kg\/L/.test(b.html));
  b.submitClosePO();
  ok('only the ticked product is asked for', !!b.o.lines[1].shortClose && !b.o.lines[0].shortClose);
  ok('...as a request, not a close', !b.o.lines[1].shortClose.approvedAt && b.o.lines[1].shortClose.requestedBy === 'Abdul Majid');
  ok('...and it records who asked, so a refusal can find him (26a)', b.o.lines[1].shortClose.requestedUser === 'majid' && b.o.lines[1].shortClose.requestedRole === 'Production Manager'); }
{ const b = cpWorld('Production Manager', ['po.shortclose_request']);
  b.openClosePO('O1', 'L2');
  ok('from a product row, that product comes ticked', / checked/.test(b.html) && /Ask to close 1 product/.test(b.html)); }
{ const b = cpWorld('COO', ['po.close','po.shortclose_request','po.shortclose_approve']);
  b.openClosePO('O1'); b.cpTickAll(true);
  ok('Tick all ticks every open product', /Close 2 products · 14000 Kg\/L/.test(b.html));
  b.cpTick('L1', false); vm.runInContext("cpForm.reasonCode='outside_o2s'", b); b.submitClosePO();
  ok('the COO closes only what is ticked', !!(b.o.lines[1].shortClose && b.o.lines[1].shortClose.approvedAt) && !b.o.lines[0].shortClose);
  ok('the PO stays open while a product is still open', !b.o.closed); }
ok('the order card says it is a choice now', /'Close products…':'Ask to close products…'/.test(grab('closePOButtonHTML')));

/* ---------- 1. Close batch where the batch is ---------- */
{ const sl = grab('prodStageList');
  ok('Running batches: Close batch beside Log output once there is output', /if\(edClose&&prod>0\.5&&b\.status==='open'\)act\+=' <button class="sm ghost" onclick="event\.stopPropagation\(\);openCloseBatch/.test(sl));
  ok('the list row, producing: the same', /if\(st==='producing'\)\{[^}]*edClose&&prod>0\.5&&b\.status==='open'[^}]*openCloseBatch/.test(sl)); }
{ const TD = new Function(H.matchBlock(html.indexOf('var TD_RIGHT='), 'TD_RIGHT').replace('var TD_RIGHT=', 'return '))();
  eq('the close-batch job reaches whoever holds batch.close (the Production Manager)', TD['Close batch'], 'batch.close');
  eq('...and the reopened one', TD['Reopened — check first'], 'batch.close'); }
{ const f = new Function('state', grab('runBatchesFor') + '\nreturn runBatchesFor;');
  const st = { batches: [
    { id: 'B1', kind: 'multi', allocations: [{ oid: 'O1', lid: 'L2', po: 'COBO-2608-4613', kg: 2000 }, { oid: 'O9', lid: 'X', po: 'BKK', kg: 500 }] },
    { id: 'B2', kind: 'po', po: 'COBO-2608-4613', lineId: 'L2' }, { id: 'B3', kind: 'bulk', base: 'x' }, { id: 'B4', kind: 'multi', voided: true, allocations: [{ lid: 'L2' }] } ] };
  const r = f(st)({ po: 'COBO-2608-4613' }, { id: 'L2', brand: 'V-Ammonium Phosphate' }).map(b => b.id).join(',');
  eq('the run sheet lists a multi-order batch made for the line (AP26012 was missing)', r, 'B1,B2'); }

/* ---------- made so far: AP26012's real numbers ---------- */
function tuWorld() {
  const L = (id, po, ord, prod, pk) => ({ id, po, ordered: ord, produced: prod, packed: pk, prodComplete: '' });
  const orders = [
    { id: 'Oc', po: 'COBO-2608-4613', lines: [Object.assign(L('Lc', 'COBO', 2000, 745.39, 300), { brand: 'V-Ammonium Phosphate' })] },
    { id: 'Ob', po: 'PUR-ORD-2026-00576', lines: [Object.assign(L('Lb', 'BKK', 500, 500, 500), { brand: 'V-Ammonium Phosphate', prodComplete: '2026-08-26' })] },
    { id: 'Of', po: 'FRM-2608-4875', lines: [Object.assign(L('Lf', 'F', 190, 190, 190), { brand: 'V-Ammonium Phosphate', prodComplete: '2026-08-26' })] },
    { id: 'Ow', po: 'FRM-2608-9602', lines: [Object.assign(L('Lw', 'W', 20, 20, 20), { brand: 'V-Ammonium Phosphate', prodComplete: '2026-08-26' })] } ];
  const b = { id: 'B2062-9qas', batchNo: 'AP26012', kind: 'multi', plannedKg: 2710, producedKg: 1010, packedKg: 1010,
    allocations: [{ oid: 'Ow', lid: 'Lw', po: 'FRM-2608-9602', kg: 20 }, { oid: 'Of', lid: 'Lf', po: 'FRM-2608-4875', kg: 190 }, { oid: 'Ob', lid: 'Lb', po: 'PUR-ORD-2026-00576', kg: 500 }, { oid: 'Oc', lid: 'Lc', po: 'COBO-2608-4613', kg: 2000 }] };
  const packingLog = [{ baseBatchId: b.id, lid: 'Lc', po: 'COBO-2608-4613', kg: 300 }, { baseBatchId: b.id, lid: 'Lb', kg: 500 }, { baseBatchId: b.id, lid: 'Lf', kg: 190 }, { baseBatchId: b.id, lid: 'Lw', kg: 20 }];
  const state = { orders, packingLog, batches: [b] };
  return { b, state, orders, run: new Function('state', grab('multiTrueUp') + '\nreturn multiTrueUp;')(state) }; }
{ const w = tuWorld(); const out = w.run(w.b);
  const c = w.orders[0].lines[0];
  eq('AP26012 closes: COBO V-Ammonium Phosphate made so far 745.39 → 300 (what was packed for it)', c.produced, 300);
  eq('...so "still to make" reads 1,700, the real figure', 2000 - c.produced, 1700);
  eq('...one change, on that line only', out.length, 1);
  ok('...the 3 small orders are untouched (they took more than their planned share)', w.orders[1].lines[0].produced === 500 && w.orders[2].lines[0].produced === 190 && w.orders[3].lines[0].produced === 20);
  eq('...the change is remembered on the allocation', w.b.allocations[3].trueUpKg, 445.39);
  const again = w.run(w.b);
  eq('closing it again (after a reopen) does not take it down twice', again.length, 0);
  eq('...made so far stays 300', c.produced, 300); }
{ const w = tuWorld(); w.orders[0].lines[0].packed = 0; w.state.packingLog = w.state.packingLog.filter(p => p.lid !== 'Lc');
  w.run(w.b); eq('never below what the line has packed (0 packed: 0, not negative)', w.orders[0].lines[0].produced, 0); }
{ const w = tuWorld(); w.b.allocations[3].credited = 400; w.orders[0].lines[0].produced = 400;
  w.run(w.b); eq('with the recorded credit (26a on), it uses that: 400 credited, 300 packed → 300', w.orders[0].lines[0].produced, 300); }
{ const w = tuWorld(); w.b.kind = 'po'; eq('a single-order batch is left alone', w.run(w.b).length, 0); }
ok('the close, each pack and each reconcile run the guarded true-up', /multiTrueUpIfPlaced\(b\)/.test(grab('doCloseBatch')) && /multiTrueUpIfPlaced\(b\)/.test(grab('doPack')) && /multiTrueUpIfPlaced\(b\)/.test(grab('saveReconcile')));
ok('...and every change goes to the audit', /Made so far brought to what was packed/.test(grab('multiTrueUpIfPlaced')));
{ /* MAXKL26005 on live, 26 Sep: open, 2,036 made, 982 packed. Closing it must not take 22868 from 1,000 to 0 while 1,054 still waits to be packed. */
  const mk = (status, packedKg) => { const w = tuWorld(); w.b.status = status; w.b.packedKg = packedKg; w.b.disposedKg = 0;
    const run = new Function('state', 'fmt', 'logAction', grab('batchRemainderKg') + '\n' + grab('multiTrueUp') + '\n' + grab('multiTrueUpIfPlaced') + '\nreturn multiTrueUpIfPlaced;')(w.state, n => String(n), () => {});
    return { w, run }; };
  let t = mk('open', 1010); eq('an OPEN batch is never trued up', t.run(t.w.b).length, 0);
  t = mk('closed', 710); eq('a closed batch with material still unpacked is left alone', t.run(t.w.b).length, 0); eq('...COBO keeps its 745.39 until it is placed', t.w.orders[0].lines[0].produced, 745.39);
  t = mk('closed', 1010); eq('closed and fully placed: trued up', t.run(t.w.b).length, 1); eq('...COBO to 300', t.w.orders[0].lines[0].produced, 300); }
ok('shift output on a multi batch records what each order was credited', /al\.credited=Math\.round/.test(html));

/* ---------- 5. see before you sign ---------- */
{ const ai = grab('actionItems');
  ok('Release opens the sheet, not the approval', /act:"openTruckSign\('"\+g\.dispId\+"','release'\)",label:'Release'/.test(ai) && !/act:"approveRelease\(/.test(ai));
  ok('Approve DC, Review truck and Gate Pass the same', /'approvedc'\)",label:'Approve DC'/.test(ai) && /'review'\)",label:'Review truck'/.test(ai) && /'gatepass'\)",label:'Gate Pass'/.test(ai));
  ok('a sent-back truck goes to whoever issued its gate pass', /truckSentBack\(g\.rows\[0\]\|\|\{\}\)/.test(ai) && /who:\(g\.rows\[0\]\|\|\{\}\)\.gatePassByUser/.test(ai) && /label:'Sent back'/.test(ai)); }
{ const sh = grab('tsSheetHTML');
  ok('the sheet shows the DC and the gate pass themselves', /printDC\(/.test(sh) && /printGatePass\(/.test(sh));
  ok('...who loaded, the inspection, who issued the gate pass, who reviewed', /Loaded by/.test(sh) && /Inspection/.test(sh) && /Gate pass by/.test(sh) && /Reviewed by/.test(sh));
  ok('...customer, vehicle, driver, products and quantities', /Customer/.test(sh) && /Vehicle/.test(sh) && /Driver/.test(sh) && /Quantity/.test(sh)); }
{ const T = new Function(H.matchBlock(html.indexOf('var TS_STEP='), 'TS_STEP').replace('var TS_STEP=', 'return '))();
  ok('Confirm calls the same sign-off as before (its checks unchanged)', T.release.fn === 'approveRelease' && T.review.fn === 'reviewTruck' && T.gatepass.fn === 'issueGatePass' && T.approvedc.fn === 'approveDC');
  ok('send back on review and release only (Tahir)', T.review.back && T.release.back && !T.gatepass.back && !T.approvedc.back); }
function tsWorld(role) {
  const rows = [{ dispId: 'D1', po: 'P1', stage: 'loading', gatePass: 'GP-0138', gatePassBy: 'Zain Ghaffar', gatePassByUser: 'zain', gatePassByRole: 'Supply Chain Officer', scReview: { by: 'Saad Jamal', at: '2026-09-26T10:00:00Z' }, qa: { pass: true }, kg: 400 }];
  const b = { console, toasts: [], rows, state: { role, currentUser: { name: role, username: role.toLowerCase() }, shipments: rows, audit: [] },
    save() {}, render() {}, closeModal() {}, logAction() {}, fmt: n => String(n), may: c => b.state.role === 'Warehouse' && ['gatepass.issue','shipment.plan'].indexOf(c) > -1 };
  b.toast = m => b.toasts.push(String(m)); b.$ = () => ({ set innerHTML(v) {}, classList: { add() {} } });
  b.hardRole = r => role === 'COO' || r.indexOf(role) > -1;
  b._uRole = () => ({ by: b.state.currentUser.name, user: b.state.currentUser.username, role });
  vm.createContext(b);
  vm.runInContext(H.matchBlock(html.indexOf('var TS_STEP='), 'TS_STEP') + ';\nvar tsForm=null;\n' + ['shipRowsOf','truckSentBack','sendBackTruck','truckFixed','truckReviewSince'].map(grab).join('\n'), b);
  return b; }
{ const b = tsWorld('Plant Manager');
  b.sendBackTruck('D1', 'release', '');
  ok('sending back needs the reason', !b.rows[0].sentBack && /Say what is wrong/.test(b.toasts[0]));
  b.sendBackTruck('D1', 'release', 'vehicle number on the DC is wrong');
  ok('the Plant Manager sends it back with the reason', b.truckSentBack(b.rows[0]) && b.rows[0].sentBack.why === 'vehicle number on the DC is wrong');
  ok('...Saad reviews it again once fixed: his review is set aside, kept, never erased', b.rows[0].scReview === null && b.rows[0].scReviewPrev.by === 'Saad Jamal');
  b.state.role = 'Warehouse'; b.state.currentUser = { name: 'Zain Ghaffar', username: 'zain' }; b._uRole = () => ({ by: 'Zain Ghaffar', user: 'zain', role: 'Warehouse' });
  b.truckFixed('D1', 'corrected');
  ok('the warehouse fixes it and it goes back for review', !b.truckSentBack(b.rows[0]) && b.rows[0].sentBack.fixedBy === 'Zain Ghaffar');
  ok('...and Saad\'s 2-hour review clock starts again from the fix', b.truckReviewSince(b.rows[0]) === b.rows[0].sentBack.fixedAt); }
{ const b = tsWorld('Supply Chain'); b.sendBackTruck('D1', 'gatepass', 'x');
  ok('the gate pass step has no send back', !b.rows[0].sentBack); }
{ const b = tsWorld('KAM'); b.sendBackTruck('D1', 'release', 'x');
  ok('only the Plant Manager sends back from release', !b.rows[0].sentBack); }
ok('release refuses a truck that is sent back', /truckSentBack\(_sb\[0\]\)/.test(grab('approveRelease')));
ok('review refuses a truck that is sent back', /truckSentBack\(rows\[0\]\)/.test(grab('reviewTruck')));
ok('the Shipments card routes through the same sheet', /openTruckSign\(\\''\+g\.dispId\+'\\',\\'release\\'\)/.test(grab('shipCard')) && /openTruckSentBack\(/.test(grab('shipCard')));

/* ---------- the lab: send a report back down the chain (Tahir, 26 Sep) ---------- */
function labWorld(role, user) {
  const coa = { status: 'reviewed', item: 'Mg Sulphate', tests: [{ test: 'MgO', result: '16', remark: 'FIT' }],
    analyst: { name: 'Asif', date: '2026-09-25 10:00' }, draftedBy: { name: 'Asif', user: 'asif', role: 'Lab Rep' },
    reviewer: { name: 'Asma', user: 'asma', date: '2026-09-25 12:00' } };
  const b = { toasts: [], logged: [], state: { role, currentUser: { name: user, username: user.toLowerCase() }, batches: [{ id: 'B1', batchNo: 'VMG10420', lots: [{ id: 'L1', lotNo: 'VMG10420-L1', coa }] }], audit: [] },
    save() {}, logAction(m) { b.logged.push(m); }, coaFSClose() {}, qcAudit2() {}, labCovers: () => false, renderCOAModal() {}, coaEsc: x => String(x == null ? '' : x) };
  b.toast = m => b.toasts.push(String(m));
  vm.createContext(b);
  vm.runInContext("var coaForm={bid:'B1',lid:'L1'};\n" + ['coaCtx','sigStamp','labIsV2','coaOpenReturn','coaCloseReturn','coaSendBack','coaReturnBanner'].map(grab).join('\n'), b);
  b.coa = () => b.state.batches[0].lots[0].coa;
  b.as = (r, u) => { b.state.role = r; b.state.currentUser = { name: u, username: u.toLowerCase() }; };
  b.note = n => vm.runInContext('coaForm._sb={note:' + JSON.stringify(n) + '}', b);
  return b; }
{ const w = labWorld('QCM', 'Himayat');
  w.note('fix'); w.coaSendBack();
  ok('a send-back needs a real note', w.coa().status === 'reviewed' && /Say what to correct/.test(w.toasts.slice(-1)[0]));
  w.as('AQCM', 'Asma'); w.note('Mg result does not match the bench sheet'); w.coaSendBack();
  ok('chain of custody: the AQCM cannot send back a report that is with the QCM', w.coa().status === 'reviewed');
  w.as('QCM', 'Himayat'); w.note('Mg result does not match the bench sheet; check the dilution'); w.coaSendBack();
  eq('the QCM sends it back to the AQCM: status back to analysed', w.coa().status, 'analysed');
  ok('...the review signature is set aside and kept on the return', w.coa().reviewer.name === '' && w.coa().returnOpen.prevReviewer.name === 'Asma');
  ok('...the return is open, addressed to the AQCM, with the note', w.coa().returnOpen.to === 'AQCM' && /dilution/.test(w.coa().returnOpen.note) && w.coa().returns.length === 1);
  ok('...the banner on the report says who sent it back and why', /Sent back by Himayat/.test(w.coaReturnBanner(w.coa(), 'analysed', true, false)) && /dilution/.test(w.coaReturnBanner(w.coa(), 'analysed', true, false)));
  w.note('Please correct'); w.coaSendBack();
  ok('the QCM cannot skip the AQCM to the analyst', w.coa().status === 'analysed');
  w.as('AQCM', 'Asma'); w.note('Re-check Mg by titration and correct the result'); w.coaSendBack();
  eq('the AQCM sends it on to the analyst: status draft', w.coa().status, 'draft');
  ok('...to the analyst who drafted it, by name', w.coa().returnOpen.to === 'analyst' && w.coa().returnOpen.toUser === 'asif' && w.coa().returnOpen.toName === 'Asif');
  ok('...the analyst signature is unsigned for the resubmission, the name kept', w.coa().analyst.name === 'Asif' && w.coa().analyst.date === '');
  ok('...the QCM\'s return is answered as "sent on to the analyst", both kept in the history', w.coa().returns.length === 2 && w.coa().returns[0].doneHow === 'sent on to the analyst' && !w.coa().returns[1].doneAt);
  w.as('Lab Rep', 'Asif'); w.coaCloseReturn(w.coa(), 'resubmitted');
  ok('the analyst resubmits: the return is answered, nothing left open', w.coaOpenReturn(w.coa()) === null && w.coa().returns[1].doneBy === 'Asif');
  ok('...and the report keeps both notes as history', /Sent back before/.test(w.coaReturnBanner(w.coa(), 'analysed', true, false))); }
{ const w = labWorld('QCM', 'Himayat'); w.coa().status = 'approved'; w.note('Please correct the Mg result on this one'); w.coaSendBack();
  ok('an approved certificate is not sent back: re-issue as a new revision', w.coa().status === 'approved' && /re-issue it as a new revision/.test(w.toasts.slice(-1)[0])); }
ok('the analyst\'s resubmit answers the return', /coaCloseReturn\(h\.coa,'resubmitted'\)/.test(grab('coaSubmitAnalyst')));
ok('the AQCM\'s review answers any return still open', /coaCloseReturn\(h\.coa,'reviewed again'\)/.test(grab('coaReview')));
{ const ai = grab('actionItems');
  ok('Today: a returned report goes to the analyst who drafted it, with the note, timed from the return', /label:'Correct COA'/.test(ai) && /who:_rtWho/.test(ai) && /labAt:_rt\.at/.test(ai) && /sent back by/.test(ai));
  ok('Today: back with the AQCM it says Review COA again, with the note', /Review COA again/.test(ai)); }
ok('the report buttons say Send back, one step down the chain', /Send back to the analyst…/.test(html) && /Send back to the AQCM…/.test(html) && !/onclick="coaReject\(/.test(html));
ok('a return nobody answers reaches the QCM after a day', /'Correct COA':\[1,'QCM'\]/.test(html));

/* ---------- back paths (Tahir, 26 Sep: "check clearly that acceptance, rejection, approval have a back path") ---------- */
function bpWorld(role, user) {
  const b = { toasts: [], logged: [], html: '',
    state: { role, currentUser: { name: user, username: user.toLowerCase() }, audit: [],
      orders: [{ id: 'O1', po: 'PO-1', client: 'Arysta', received: '2026-09-20', acknowledged: false, enteredBy: { name: 'Ismaeel', user: 'ismaeel', role: 'Finance Desk Officer' },
        lines: [{ id: 'L1', brand: 'Fruitlish', ordered: 4000, committed: '2026-10-01', rmPR: { qty: 500, by: 'Supply Chain', date: '2026-09-21', cfoApproved: '', closed: false } }] }],
      prs: [{ id: 'P1', rm: 'MOP', qtyRequired: 2000, qtyReceived: 0, status: 'open', cfoApproved: null, date: '2026-09-21', by: 'Supply Chain', byRole: 'Supply Chain', byName: 'Saad Jamal' }],
      customers: [{ code: 'C1', name: 'Green Farms', segment: 'Dealer', status: 'Pending approval', createdBy: { name: 'Ismaeel', user: 'ismaeel', role: 'Finance Desk Officer' } }],
      shipments: [{ dispId: 'D1', dc: '130', po: 'PO-1', client: 'Arysta', kg: 400, dcStatus: 'pending', lid: 'L1', brand: 'Fruitlish' }] },
    usersList: [], save() {}, render() {}, closeModal() {}, logAction(m) { b.logged.push(m); }, fmt: n => String(n), unitOf: () => 'Kg', lineShortClosed: () => false,
    mayMoney: () => false, correctCanAmend: () => false, _releaseShip() {}, shipClientFor: () => '', smpLog() {}, TODAY: new Date('2026-09-26T00:00:00Z') };
  b.toast = m => b.toasts.push(String(m)); b.$ = () => ({ set innerHTML(v) { b.html = v; }, classList: { add() {} } });
  b.may = c => ({ 'order.acknowledge': ['Supply Chain'], 'customer.amend': ['Finance', 'Finance Desk Officer'] }[c] || []).indexOf(b.state.role) > -1;
  b.canEdit = r => r.indexOf(b.state.role) > -1; b.hardRole = r => b.state.role === 'COO' || r.indexOf(b.state.role) > -1;
  b.denyRight = (c, w) => 'no ' + w; b._pe = x => String(x == null ? '' : x);
  b._uRole = () => ({ by: b.state.currentUser.name, user: b.state.currentUser.username, role: b.state.role });
  b.as = (r, u) => { b.state.role = r; b.state.currentUser = { name: u, username: u.toLowerCase() }; };
  vm.createContext(b);
  vm.runInContext('var bpForm=null;\n' + ['bpEsc','bpId','bpReasonHTML','bpFacts','bpHistory','bpOwnerFromName','poReturnOpen','poOwner','poLinesHTML','poFactsHTML','openAckSheet','renderAckSheet','sendBackPO','openPoReturn','poReturnFixed','ackOrder',
    'prRec','prArgs','prFactsHTML','openPRSheet','renderPRSheet','refusePR','openPRRefused','prAskAgain','prDrop','cfoApprovePR',
    'custReturnOpen','custFindByCode','custFactsHTML','openCustSheet','renderCustSheet','sendBackCustomer','openCustReturn','custReturnFixed','approveCustomer',
    'shipRowsOf','rejectDC','dcRejectNote','dcRejectJobs','dcRejectSeen'].map(grab).join('\n'), b);
  return b; }
{ const w = bpWorld('Supply Chain', 'Saad Jamal'); const o = w.state.orders[0];
  w.openAckSheet('O1');
  ok('Acknowledge opens the PO first: the customer and the lines', /Acknowledge PO PO-1/.test(w.html) && /Fruitlish/.test(w.html) && /4000 Kg/.test(w.html) && /Send back…/.test(w.html));
  w.sendBackPO('O1', 'no'); ok('sending a PO back needs a reason', !o.ackReturn);
  w.sendBackPO('O1', 'Quantity does not match the client PO (3,000 not 4,000)');
  ok('...sent back to whoever entered it, by name', w.poReturnOpen(o) && o.ackReturn.toUser === 'ismaeel' && o.ackReturn.toRole === 'Finance Desk Officer');
  w.ackOrder('O1'); ok('...and it cannot be acknowledged while it is back with Finance', !o.acknowledged);
  w.as('Finance Desk Officer', 'Ismaeel'); w.poReturnFixed('O1', 'quantity corrected by the CFO');
  ok('Finance marks it fixed: back to Supply Chain, the return kept in the history', !w.poReturnOpen(o) && o.ackReturns.length === 1 && o.ackReturns[0].fixedBy === 'Ismaeel');
  w.as('Supply Chain', 'Saad Jamal'); w.ackOrder('O1'); ok('...then it can be acknowledged', o.acknowledged === true); }
{ const w = bpWorld('CFO', 'Ali'); const p = w.state.prs[0];
  w.openPRSheet('pr', 'P1'); ok('Approve PR opens the request first', /Purchase request — MOP/.test(w.html) && /2000 Kg\/L/.test(w.html) && /Saad Jamal/.test(w.html) && /Refuse…/.test(w.html));
  w.refusePR('pr', 'P1', 'x'); ok('refusing needs a reason', !p.refused);
  w.refusePR('pr', 'P1', 'Stock on hand covers it until 5 Oct');
  ok('the CFO refuses with a reason; the PR is not approved', !!p.refused && !p.cfoApproved && /Stock on hand/.test(p.refused.why));
  w.cfoApprovePR('P1'); ok('...a refused PR cannot then be approved by accident', !p.cfoApproved);
  w.as('Supply Chain', 'Saad Jamal'); vm.runInContext("bpForm={note:'Arysta order doubled; stock no longer covers it'}", w); w.prAskAgain('pr', 'P1');
  ok('Supply Chain asks again with what changed: back with the CFO, refusal kept', !p.refused && p.refusals.length === 1);
  w.as('CFO', 'Ali'); w.refusePR('pr', 'P1', 'Still not needed this month'); w.as('Supply Chain', 'Saad Jamal'); w.prDrop('pr', 'P1');
  ok('...or drops it: the PR closes with the reason', p.status === 'closed' && /Still not needed/.test(p.closedWhy));
  const l = w.state.orders[0].lines[0]; w.as('CFO', 'Ali'); w.refusePR('line', 'O1', 'L1', 'Use the MOP already received');
  ok('a line PR is refused the same way', !!l.rmPR.refused && !l.rmPR.cfoApproved); }
{ const w = bpWorld('CFO', 'Ali'); const c = w.state.customers[0];
  w.openCustSheet('C1'); ok('Approve customer opens the record first', /New customer — Green Farms/.test(w.html) && /Send back…/.test(w.html));
  w.sendBackCustomer('C1', 'Credit days should be 30, not 60');
  ok('the CFO sends it back to whoever entered it', w.custReturnOpen(c) && c.sentBack.toUser === 'ismaeel' && c.status === 'Pending approval');
  w.approveCustomer('C1'); ok('...it cannot be approved while it is back with Finance', c.status === 'Pending approval');
  w.as('Finance Desk Officer', 'Ismaeel'); w.custReturnFixed('C1', 'credit days 30');
  w.as('CFO', 'Ali'); w.approveCustomer('C1'); ok('fixed, then approved; the send-back stays in the history', c.status === 'Active' && c.sentBacks.length === 1); }
ok('an edit of the customer keeps who entered it and the send-back', /\['createdBy','sentBack','sentBacks'\]/.test(grab('custSave')));
{ const w = bpWorld('Supply Chain', 'Saad Jamal');
  w.rejectDC('D1', ''); ok('rejecting a DC needs a reason', !w.state.shipments[0].voided);
  w.rejectDC('D1', 'Wrong customer on the DC');
  ok('...with a reason it is voided and the reason is kept', w.state.shipments[0].voided && w.state.shipments[0].rejectWhy === 'Wrong customer on the DC');
  const j = w.dcRejectJobs(); ok('...and Supply Chain gets it on Today', j.length === 1 && j[0].role === 'Supply Chain' && j[0].label === 'DC rejected');
  w.dcRejectSeen(j[0].dcr.id); eq('...until read', w.dcRejectJobs().length, 0); }
ok('the Reject DC button opens the reason sheet', /openRejectDC\(/.test(grab('shipCard')) && !/onclick="rejectDC\(/.test(html));
ok('a sample not approved goes on the asker\'s Today until read', /x\.status==='rejected'&&!x\.rejectSeenAt/.test(grab('smpJobs')) && /smpRejectSeen\(/.test(grab('smpRenderOpen')));
ok('Pack QA: the correction note is required, both ways', /note\.length<5/.test(grab('lotQACorrect')) && /note\.length<5/.test(grab('clearQaHold')));
{ const ai = grab('actionItems');
  ok('Today: Acknowledge, Approve PR open their sheets', /openAckSheet\(/.test(ai) && /openPRSheet\('line'/.test(ai) && /openPRSheet\('pr'/.test(ai));
  ok('Today: PO sent back and PR refused go back to the person', /label:'PO sent back'/.test(ai) && /label:'PR refused'/.test(ai) && /dcRejectJobs\(\)/.test(ai)); }

/* ---------- batch leftovers: loss, by-product, divert, rework, stock (Tahir, 26 Sep) ---------- */
function rcWorld() {
  const b = { toasts: [], logged: [], html: '',
    state: { role: 'Production Manager', currentUser: { name: 'Abdul Majid', username: 'majid' }, audit: [], orders: [], packingLog: [],
      masters: { byproductRules: [{ from: 'Sulfur Coated Urea', to: 'Nitro Sulfur' }], varianceReasons: ['Wastage'] },
      batches: [{ id: 'B1', batchNo: 'VU26185', base: 'Sulfur Coated Urea', kind: 'bulk', status: 'closed', plannedKg: 7000, producedKg: 7000, packedKg: 6450, disposedKg: 0, lots: [] }] },
    TODAY: new Date('2026-09-26T00:00:00Z'), save() {}, render() {}, closeModal() {}, logAction(m) { b.logged.push(m); }, fmt: n => String(n), coaItemOf: x => x.base, multiTrueUpIfPlaced() {},
    may: c => ['packing.reconcile', 'byproduct.call'].indexOf(c) > -1, denyRight: (c, w) => 'no ' + w, fyKey: () => '2026-27', batchOwnerInFY: () => false, validateBatchNo: () => true, SEED: {} };
  b.toast = m => b.toasts.push(String(m)); b.$ = () => ({ set innerHTML(v) { b.html = v; }, classList: { add() {} } });
  vm.createContext(b);
  vm.runInContext("var recForm=null, callBpForm=null, _seq=100; function nid(p){ return p+(++_seq); }\n" + ['prodSkin','prodTiles','batchRemainderKg','recAllocated','recItem','recSetKg','allBasesForRecon','openReconcile','renderReconcile','saveReconcile','consumeDivertSources','callBpTargets','openCallBp','renderCallBp','submitCallBp'].map(grab).join('\n'), b);
  b.B = () => b.state.batches.find(x => x.id === 'B1');
  return b; }
{ const w = rcWorld();
  w.openReconcile('B1');
  const it = vm.runInContext('recForm.items', w)[0];
  ok('Sulfur Coated Urea: the whole 550 Kg leftover is suggested as by-product to Nitro Sulfur', it.type === 'byproduct' && it.base === 'Nitro Sulfur' && +it.kg === 550);
  ok('...the sheet offers Keep as bulk stock', /Keep as bulk stock/.test(w.html));
  vm.runInContext("recSetKg('byproduct','400'); recForm.loss='100'; recForm.lossReason='Wastage'; recSetKg('stock','50');", w);
  w.saveReconcile();
  const b = w.B(); const pool = w.state.batches.find(x => x.pool && x.disposition === 'byproduct');
  ok('400 Kg goes to the Nitro Sulfur pool, traced to VU26185', pool && pool.base === 'Nitro Sulfur' && +pool.plannedKg === 400 && pool.sources[0].batchNo === 'VU26185');
  eq('100 Kg loss is written off with its reason', b.lossKg + '/' + b.lossReason, '100/Wastage');
  eq('50 Kg kept as bulk stock is NOT disposed: disposed 500, leftover 50', b.disposedKg + '/' + w.batchRemainderKg(b), '500/50');
  ok('...and it is named as stock on the batch', b.stockKept && b.stockKept.kg === 50);
  /* the stock is later written off: the loss ADDS */
  w.openReconcile('B1'); vm.runInContext("recForm.items=[]; recForm.loss='50'; recForm.lossReason='Wastage';", w); w.saveReconcile();
  eq('a second reconcile ADDS to the loss (it used to overwrite it): 150', w.B().lossKg, 150);
  eq('...the cumulative record the wastage reports read says 150 too', w.B().packReconcile.loss, 150);
  eq('...both reconciles kept in the history', w.B().reconHistory.length, 2);
  eq('...nothing left unaccounted', w.batchRemainderKg(w.B()), 0);
  /* calling the by-product into manufacturing keeps the trace */
  w.openCallBp(pool.id); vm.runInContext("callBpForm.qty='300'; callBpForm.batchNo='NS26006';", w); w.submitCallBp();
  const ns = w.state.batches.find(x => x.batchNo === 'NS26006');
  ok('calling 300 Kg creates Nitro Sulfur batch NS26006 that names VU26185 as its source', ns && ns.fromSources && ns.fromSources[0].sourceBatchNo === 'VU26185' && ns.fromSources[0].kg === 300);
  ok('...and the pool keeps 100 Kg, its source list drawn down to match', +pool.plannedKg === 100 && pool.sources[0].kg === 100);
  /* Tahir: the Nitro Sulfur pool can be called into a new Sulfur Coated Urea batch too */
  eq('the pool can be called into Nitro Sulfur or Sulfur Coated Urea', JSON.stringify(w.callBpTargets(pool)), '["Nitro Sulfur","Sulfur Coated Urea"]');
  w.openCallBp(pool.id); ok('...the call sheet asks which', /Call it into a new batch of/.test(w.html) && /Sulfur Coated Urea/.test(w.html));
  vm.runInContext("callBpForm.qty='100'; callBpForm.batchNo='VU26191'; callBpForm.target='Sulfur Coated Urea';", w); w.submitCallBp();
  const vu = w.state.batches.find(x => x.batchNo === 'VU26191');
  ok('...a new Sulfur Coated Urea batch VU26191 from the pool, traced to VU26185', vu && vu.base === 'Sulfur Coated Urea' && vu.sourcePoolBase === 'Nitro Sulfur' && vu.fromSources[0].sourceBatchNo === 'VU26185');
  eq('...the pool is empty', +pool.plannedKg, 0); }
ok('the loss reasons include material, weight, moisture and packing loss', /\['Material loss','Weight loss','Moisture loss','Packing loss'\]/.test(grab('renderReconcile')));
ok('Ready to pack: Packing finished for the Production Manager (packing.reconcile)', /edRecon&&rem>0\.5&&st!=='producing'&&st!=='qc'/.test(grab('prodStageList')) && /Packing finished · reconcile \/ move<\/button>/.test(grab('prodStageList')) && /edClose&&b\.status==='open'&&st==='pack'/.test(grab('prodStageList')));
ok('the batch passport offers it too, closed batches included', /Packing finished — account for/.test(grab('_pcLifeAction')) && /Packing finished — account for the rest/.test(grab('_pcLifeAction')));

process.exitCode = report('26a fixes') ? 1 : 0;
