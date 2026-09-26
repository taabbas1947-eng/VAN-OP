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

process.exitCode = report('26a fixes') ? 1 : 0;
