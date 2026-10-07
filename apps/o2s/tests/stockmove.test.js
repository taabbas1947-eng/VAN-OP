/* 7 Oct 2026 (07c) — MOVE PACKED STOCK TO ANOTHER PO.
   Maxim 22868 (Sindh) has Enroot packed and cleared; 22867 (Punjab) needs it.
   Tahir: same customer, product and price, same price on the bag; Supply Chain
   asks, the Plant Manager approves, the QA result moves with the lot, all logged.
   Run: node stockmove.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, grabTopVar } = H;
const mk = () => ({
  seq: 5000, poMoves: [], actionLog: [], inspections: [],
  orders: [
    { id: 'O7', po: '22867', client: 'MAXIM AGRI (PVT) LTD', acknowledged: true, lines: [{ id: 'a', brand: 'Enroot', ordered: 35000, produced: 4165, packed: 4165, dispatched: 0, delivered: 0, invoicePrice: 248, pack: 10 }] },
    { id: 'O8', po: '22868', client: 'MAXIM AGRI (PVT) LTD', acknowledged: true, lines: [{ id: 'b', brand: 'Enroot', ordered: 35000, produced: 19950, packed: 19950, dispatched: 9240, delivered: 9240, invoicePrice: 248, pack: 10 }] },
    { id: 'O9', po: '30001', client: 'OTHER CO', acknowledged: true, lines: [{ id: 'c', brand: 'Enroot', ordered: 1000, produced: 0, packed: 0, invoicePrice: 248, pack: 10 }] },
    { id: 'OX', po: '22999', client: 'MAXIM AGRI (PVT) LTD', acknowledged: true, lines: [{ id: 'x', brand: 'Enroot', ordered: 1000, produced: 0, packed: 0, invoicePrice: 260, pack: 10 }] }],
  packingLog: [
    { id: 'P1', po: '22868', lid: 'b', brand: 'Enroot', kg: 9240, insKg: 9240, shipKg: 9240, brandBatchNo: 'MAXNP26007', date: '2026-09-21', mfgDate: '2026-09', expDate: '2028-09' },
    { id: 'P2', po: '22868', lid: 'b', brand: 'Enroot', kg: 3640, insKg: 3640, shipKg: 0, brandBatchNo: 'MAXNP26008', date: '2026-09-22', mfgDate: '2026-09', expDate: '2028-09' },
    { id: 'P3', po: '22868', lid: 'b', brand: 'Enroot', kg: 7070, insKg: 0, shipKg: 0, brandBatchNo: 'MAXNP26008', date: '2026-09-26' },
    { id: 'P4', po: '22867', lid: 'a', brand: 'Enroot', kg: 4165, insKg: 4165, shipKg: 0, brandBatchNo: 'MAXNP26008', date: '2026-10-02' }] });
const sb = { console, toasts: [], saved: 0, role: 'Supply Chain', user: { name: 'Saad Jamal', username: 'saad' } };
Object.assign(sb, { toast: m => sb.toasts.push(m), save: () => sb.saved++, render: () => {}, closeModal: () => {}, logAction: w => sb.state.actionLog.unshift({ what: w }),
  fmt: n => Number(Math.round(n)).toLocaleString('en-US'), qsEsc: x => String(x), _tx: x => String(x || ''), denyRight: (c) => 'no right ' + c,
  $: () => ({ classList: { add() {} }, set innerHTML(v) { sb.html = v; } }), TODAY: new Date('2026-10-07T06:00:00Z'),
  lineNetPrice: (o, l) => +l.invoicePrice || 0, printPolicyOL: () => ({ mode: 'noprint', price: null }) });
vm.createContext(sb);
vm.runInContext(['nid', 'evToday', 'lotBaseNo', 'lotBrandNo', 'lotsFor', 'lotAvail', 'lotClearedKg', 'linePassedInsp', 'lineFacts', 'saleLeft',
  'pmvWho', 'pmvSame', 'pmvLine', 'pmvLotFree', 'pmvLotCleared', 'pmvOpenOn', 'pmvRoom', 'pmvWhyNot', 'pmvTargets', 'pmvCanStart', 'moveStockButtonHTML',
  'openMoveStock', 'renderMoveStock', 'submitMoveStock', 'pmvById', 'pmvProblems', 'openMoveApprove', 'renderMoveApprove', 'approveMove', 'pmvApply', 'refuseMove', 'cancelMove', 'noteMoveRefusal', 'pmvActionItems', 'lotMoveLock', 'lotFamily', 'qcFull'].map(grab).join('\n')
  + '\nvar pmvForm=null, pmvRefuseWhy="";\nfunction may(c){ return c==="stock.move_request"?this.state.role==="Supply Chain"||this.state.role==="COO":c==="stock.move_approve"?this.state.role==="Plant Manager"||this.state.role==="COO":false; }'
  + '\nvar CORRECT_ENTITY=' + grabTopVar('CORRECT_ENTITY', '{').replace(/^\s*var\s+CORRECT_ENTITY\s*=\s*/, '') + ';', sb);
const S = () => sb.state, L = (po) => S().orders.find(o => o.po === po).lines[0], O = (po) => S().orders.find(o => o.po === po);
const as = (role, name, user) => { S().role = role; S().currentUser = { name, username: user }; };
sb.state = mk(); as('Supply Chain', 'Saad Jamal', 'saad');
vm.runInContext('state=this.state', sb);

/* who may start, and where */
ok('Supply Chain sees the button on 22868 Enroot (packed stock not on a truck, a PO to move to)', /Move packed stock to another PO/.test(sb.moveStockButtonHTML(O('22868'), L('22868'))));
const tg = sb.pmvTargets(O('22868'), L('22868'));
ok('targets: only the same customer and product (not OTHER CO)', tg.length === 2 && !tg.some(t => t.o.po === '30001'));
ok('22999 is offered but blocked: a different price', tg.find(t => t.o.po === '22999').why.some(w => /different price/.test(w)));
ok('22867 is allowed', tg.find(t => t.o.po === '22867').why.length === 0);
as('Production', 'Floor', 'floor'); ok('Production does not get the button', sb.moveStockButtonHTML(O('22868'), L('22868')) === '');
as('Supply Chain', 'Saad Jamal', 'saad');

/* the request */
const ask = (kg, reason, to) => { sb.openMoveStock('22868', 'b'); vm.runInContext('pmvForm.to=' + JSON.stringify(to || '22867|a') + ';pmvForm.kg=' + JSON.stringify(kg) + ';pmvForm.reason=' + JSON.stringify(reason == null ? 'Punjab due first' : reason), sb); sb.submitMoveStock(); return sb.toasts[sb.toasts.length - 1]; };
ok('shipped stock cannot move (P1 left on DC 123)', /only 0 Kg\/L not shipped/.test(ask({ P1: 100 })));
ok('a reason is required', /Write why/.test(ask({ P2: 3640 }, '')));
ok('another customer\'s PO cannot be chosen', /different customer|different price/.test(ask({ P2: 100 }, 'x', '30001|c')));
eq('nothing asked yet', S().poMoves.length, 0);
ok('a good request goes to the Plant Manager', /Sent to the Plant Manager/.test(ask({ P2: 3640, P3: 7070 })));
const m = S().poMoves[0];
ok('...recorded with lots, Kg, reason and the asker', m.status === 'asked' && m.kg === 10710 && m.lots.length === 2 && m.by.user === 'saad' && /ASKED/.test(S().actionLog[0].what));
ok('nothing has moved yet', L('22868').packed === 19950 && L('22867').packed === 4165);
ok('the Plant Manager gets it on Today', sb.pmvActionItems().some(i => i.role === 'Plant Manager' && i.label === 'Approve move'));
ok('a second request on the same lines waits', /already waiting/.test(ask({ P3: 10 })));

/* the decision */
as('Supply Chain', 'Saad Jamal', 'saad'); sb.approveMove(m.id);
ok('the asker cannot approve', m.status === 'asked');
as('Plant Manager', 'Fahim Asghar', 'fahim');
L('22867').ordered = 10000; sb.approveMove(m.id);
ok('every check runs again at approval: no room on 22867 any more, refused', m.status === 'asked' && /room for only/.test(sb.toasts[sb.toasts.length - 1]));
L('22867').ordered = 35000;
sb.approveMove(m.id);
eq('approved', m.status, 'done');
const facts = po => sb.lineFacts(O(po), L(po));
ok('22868: packed 19,950 → 9,240, produced too; packed still equals its packing records', L('22868').packed === 9240 && L('22868').produced === 9240 && facts('22868').gap === 0);
ok('22867: packed 4,165 → 14,875, produced too; packed equals its packing records', L('22867').packed === 14875 && L('22867').produced === 14875 && facts('22867').gap === 0);
const kids = S().packingLog.filter(p => p.movedFrom);
ok('2 new packing records on 22867, same batch, dates and a link back', kids.length === 2 && kids.every(p => p.po === '22867' && p.lid === 'a' && p.brandBatchNo === 'MAXNP26008' && p.movedFrom.moveId === m.id));
const k2 = kids.find(p => p.movedFrom.lotId === 'P2'), k3 = kids.find(p => p.movedFrom.lotId === 'P3');
ok('the QA result moves with the lot: P2 was cleared → its 3,640 is cleared on 22867', k2.insKg === 3640 && k2.mfgDate === '2026-09' && k2.expDate === '2028-09');
ok('...P3 was waiting for QA → still waiting on 22867', k3.insKg === 0 && sb.lotAvail(k3) === 7070);
ok('the source lots are emptied and point forward', S().packingLog.find(p => p.id === 'P2').kg === 0 && S().packingLog.find(p => p.id === 'P2').movedOut[0].toPo === '22867');
eq('22867 cleared and ready to ship: 4,165 + 3,640', sb.lotsFor(O('22867'), L('22867')).reduce((a, p) => a + sb.lotClearedKg(p), 0), 7805);
eq('22868 cleared and ready: 0', sb.lotsFor(O('22868'), L('22868')).reduce((a, p) => a + sb.lotClearedKg(p), 0), 0);
ok('shipped stock untouched: P1 still 9,240 shipped on 22868', S().packingLog.find(p => p.id === 'P1').shipKg === 9240 && L('22868').dispatched === 9240);
ok('logged', /APPROVED/.test(S().actionLog[0].what) && m.approvedBy.user === 'fahim' && m.before.from.packed === 19950);

/* afterwards */
vm.runInContext(H.html.match(/\(function\(\)\{ var d=CORRECT_ENTITY\.packingLot;[\s\S]*?\}\)\(\);/)[0], sb);
ok('a moved packing run cannot be corrected on its own: every field is locked on both halves', sb.CORRECT_ENTITY.packingLot.fields.every(f => /stock move/.test(f.lockedIf(k2) || '') && /stock move/.test(f.lockedIf(S().packingLog.find(p => p.id === 'P2')) || '')));
ok('...and it cannot be reversed', sb.CORRECT_ENTITY.packingLot.blocks(k2).some(b => /stock move/.test(b)));
ok('the data-fix void refuses it too', /if\(lotMoveLock\(entry\)\) return toast\(lotMoveLock\(entry\)\);/.test(H.html));
/* withdrawing the inspection that cleared P2 un-clears its moved part on 22867 too */
const insp = { id: 'I1', po: '22868', lid: 'b', brand: 'Enroot', kg: 3640, pass: true, batches: [{ lotId: 'P2', batch: 'MAXNP26008', kg: 3640 }] };
S().inspections.push(insp);
ok('withdrawal is allowed (nothing of it has shipped)', sb.CORRECT_ENTITY.inspection.supBlocks(insp).length === 0);
L('22867').qcPass = '2026-10-07';
sb.CORRECT_ENTITY.inspection.doSupersede(insp, 'test');
ok('withdrawing it un-clears the 3,640 now on 22867', k2.insKg === 0 && sb.lotAvail(k2) === 3640);
ok('...and 22867 is no longer QC passed', L('22867').qcPass === '');
k2.insKg = 3640; k2.shipKg = 3640; insp.superseded = null;
ok('once the moved part has shipped on 22867, the withdrawal is refused', sb.CORRECT_ENTITY.inspection.supBlocks(insp).some(b => /already left on this clearance \(here or on the PO it was moved to\)/.test(b)));
ok('lotMoveLock names both halves', /moved to 22867/.test(sb.lotMoveLock(S().packingLog.find(p => p.id === 'P2'))) && /came from 22868/.test(sb.lotMoveLock(k2)));
ok('lotFamily follows the move', sb.lotFamily(S().packingLog.find(p => p.id === 'P2')).map(p => p.id).indexOf(k2.id) > -1);

/* refusal and cancel */
sb.state = mk(); vm.runInContext('state=this.state', sb); as('Supply Chain', 'Saad Jamal', 'saad'); ask({ P2: 1000 });
const r = S().poMoves[0]; as('Plant Manager', 'Fahim Asghar', 'fahim');
sb.refuseMove(r.id); ok('a refusal needs a reason', r.status === 'asked');
vm.runInContext('pmvRefuseWhy="Sindh truck goes tomorrow"', sb); sb.refuseMove(r.id);
ok('refused with a reason, nothing moved', r.status === 'refused' && L('22868').packed === 19950 && L('22867').packed === 4165);
ok('the asker sees why on Today, and only the asker', sb.pmvActionItems().some(i => i.label === 'Move refused' && i.who === 'saad'));
as('Supply Chain', 'Saad Jamal', 'saad'); sb.noteMoveRefusal(r.id); ok('Noted clears it', !sb.pmvActionItems().length);
ask({ P2: 500 }); const c = S().poMoves[0]; sb.cancelMove(c.id); ok('the asker can cancel before approval', c.status === 'cancelled');

/* stock on a planned truck */
S().packingLog.find(p => p.id === 'P2').shipKg = 3000;
ok('stock on a planned or loaded truck is not offered', /only 640 Kg\/L not shipped/.test(ask({ P2: 3640 })));
process.exitCode = report('Move packed stock to another PO (07c)') ? 1 : 0;
