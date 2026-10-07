/* 7 Oct 2026 (07i) — the 4 reviewers' findings on 07h, fixed. Built on the stock move fixture (07c).
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
  'openMoveStock', 'renderMoveStock', 'submitMoveStock', 'pmvById', 'pmvProblems', 'openMoveApprove', 'renderMoveApprove', 'approveMove', 'pmvApply', 'refuseMove', 'cancelMove', 'noteMoveRefusal', 'pmvActionItems', 'lotMoveLock', 'lotFamily', 'qcFull', 'srvUpToDate', 'pmvSig', 'pmvMovedInNote', '_pmvSheetOpen'].map(grab).join('\n')
  + '\nvar pmvForm=null, pmvRefuseWhy="", _pmvBusy={};\nfunction may(c){ return c==="stock.move_request"?this.state.role==="Supply Chain"||this.state.role==="COO":c==="stock.move_approve"?this.state.role==="Plant Manager"||this.state.role==="COO":false; }'
  + '\nvar CORRECT_ENTITY=' + grabTopVar('CORRECT_ENTITY', '{').replace(/^\s*var\s+CORRECT_ENTITY\s*=\s*/, '') + ';', sb);
const S = () => sb.state, L = (po) => S().orders.find(o => o.po === po).lines[0], O = (po) => S().orders.find(o => o.po === po);
const as = (role, name, user) => { S().role = role; S().currentUser = { name, username: user }; };
sb.state = mk(); as('Supply Chain', 'Saad Jamal', 'saad');
vm.runInContext('state=this.state', sb);


(async () => {
const clone = x => JSON.parse(JSON.stringify(x));
vm.runInContext(['_arrId', '_eq', 'merge3', 'pmvSettleV1', 'packLineOwes', 'packJobWanted', 'packJobSince', 'lineLostKg', 'dupNumbers', '_dupN', 'gdScreenOpen', '_asRole', '_avgN', '_movedInMapBuild', '_movedInMap', 'lineOverUsed', 'localDateOf'].map(grab).join('\n') + '\nvar PACK_JOB_SINCE="2026-10-08"; var MONEY_ROLES=["COO","CFO","Plant Manager","KAM"]; var HOW_ROLES=["COO","CFO","Plant Manager","Production Manager","Supply Chain"];', sb);
/* E1: the same move approved on 2 screens, then the 2 saves merged by the app's own merge3 */
vm.runInContext('pmvForm={fromPo:"22868",fromLid:"b",to:"22867|a",kg:{P2:"3000"},reason:"Punjab first"}', sb); sb.submitMoveStock();
const m = S().poMoves[0]; ok('E1 setup: a move is waiting', m && m.status === 'asked', JSON.stringify(sb.toasts.slice(-2)));
const base = clone(S());
const runApprove = async (st) => { sb.state = st; vm.runInContext('state=this.state', sb); as('Plant Manager', 'Fahim', 'fahim'); await sb.approveMove(m.id); return sb.state; };
const A = await runApprove(clone(base)); const B = await runApprove(clone(base));
const M = sb.merge3(base, A, B); sb.pmvSettleV1(M);
const lots = M.packingLog.filter(p => p.movedFrom && p.movedFrom.moveId === m.id);
const lb = M.orders.find(o => o.po === '22867').lines[0], la = M.orders.find(o => o.po === '22868').lines[0];
ok('E1: approved twice, merged: ONE new lot of 3,000, not two', lots.length === 1 && lots[0].kg === 3000, JSON.stringify(lots.map(l => [l.id, l.kg])));
ok('E1: 22867 packed rises by 3,000 once (4,165 → 7,165); 22868 falls once (19,950 → 16,950)', lb.packed === 7165 && la.packed === 16950, lb.packed + ' / ' + la.packed);
ok('E1: the source lot gave 3,000 once (3,640 → 640)', M.packingLog.find(p => p.id === 'P2').kg === 640);
/* E2: one approves, the other refuses at the same moment */
const C = clone(base); sb.state = C; vm.runInContext('state=this.state', sb); as('Plant Manager', 'Fahim', 'fahim'); vm.runInContext('pmvRefuseWhy="not now"', sb); await sb.refuseMove(m.id);
const M2 = sb.merge3(base, C, A); sb.pmvSettleV1(M2); const m2 = M2.poMoves.find(x => x.id === m.id);
ok('E2: approve and refuse clash → Moved, and the refusal is kept as a clash', m2.status === 'done' && m2.clash && m2.clash.was === 'refusal', JSON.stringify(m2.status));
/* E3 */
sb.state = clone(A); vm.runInContext('state=this.state', sb); const before = JSON.stringify(sb.state.packingLog); ok('E3: applying the same move again changes nothing', sb.pmvApply(sb.state.poMoves.find(x => x.id === m.id)) === false && JSON.stringify(sb.state.packingLog) === before);
/* E4 */
sb.state = A; vm.runInContext('state=this.state', sb); const sc = A.poMoves.find(x => x.id === m.id).scCheck;
ok('E4: Supply Chain gets "Check after move" for the PO the stock left', sc && /22868 needs 3,000 Kg\/L made again/.test(sc.need.join(' ')) && sb.pmvActionItems().some(i => i.label === 'Check after move' && i.role === 'Supply Chain'), JSON.stringify(sc));
/* E5 */
sb.state = { orders: [{ po: 'P1', lines: [{ id: 'L1', brand: 'B', ordered: 1000, packed: 1000 }, { id: 'L2', brand: 'B', ordered: 500, packed: 100 }] }] }; vm.runInContext('state=this.state', sb);
ok('E5: a multi-PO batch whose POs are all packed is not a Pack job', sb.packJobWanted({ kind: 'multi', allocations: [{ po: 'P1', lid: 'L1', brand: 'B' }] }) === false);
ok('E5: ...and is one while a PO still needs packing', sb.packJobWanted({ kind: 'multi', allocations: [{ po: 'P1', lid: 'L1', brand: 'B' }, { po: 'P1', lid: 'L2', brand: 'B' }] }) === true);
ok('E5: old cleared stock is aged from 8 Oct, newer from its first approval', sb.packJobSince({ lots: [{ coa: { status: 'approved', approvedDate: '2026-08-01' } }] }) === "2026-10-08" && sb.packJobSince({ lots: [{ coa: { status: 'approved', approvedDate: '2026-10-09' } }, { coa: { status: 'approved', approvedDate: '2026-10-08' } }] }) === '2026-10-08');
/* E6 */
const o6 = { po: 'X', lines: [{ id: 'l', brand: 'B', ordered: 300, packed: 300 }] };
ok('E6: 600 in records on a 300 order packed 300 is not lost', sb.lineLostKg(o6, o6.lines[0], { lots: [{ lid: 'l' }], logged: 600, ordered: 300, packed: 300 }) === 0);
ok('E6: 500 in records, packed 300, ordered 1000 → 200 lost', sb.lineLostKg(o6, o6.lines[0], { lots: [{ lid: 'l' }], logged: 500, ordered: 1000, packed: 300 }) === 200);
const o6b = { po: 'Y', lines: [{ id: 'l1', brand: 'B' }, { id: 'l2', brand: 'B' }] };
ok('E6: old records with no line on a PO with 2 lines of the brand: not judged', sb.lineLostKg(o6b, o6b.lines[0], { lots: [{}], logged: 800, ordered: 1000, packed: 300 }) === 0);
/* E7 */
sb.state = { shipments: [{ dispId: 'D1', dc: '5100', gatePass: 'GP-0007', po: 'A', dispatch: '2026-10-07', stage: 'gatepass', dcStatus: 'pending' }, { dispId: 'D2', dc: '5100', gatePass: '', po: 'B', dispatch: '2026-10-07', stage: 'truck_planned', dcStatus: 'pending' }, { dispId: 'D3', dc: '5038', po: 'C', dispCounted: true }, { dispId: 'D4', dc: '5038', po: 'D', dispCounted: true }], samples: [{ id: 'S1', client: 'Z', status: 'gatepass', dispatch: { gatePass: 'GP-0007', date: '2026-10-07' } }] }; vm.runInContext('state=this.state', sb);
const dn = sb.dupNumbers();
ok('E7: DC 5100 on 2 trucks and gate pass 7 on a truck and a sample are jobs; 2 trucks that left on DC 5038 are not', dn.length === 2 && dn.some(d => d.kind === 'dc' && d.no === 5100) && dn.some(d => d.kind === 'gp' && d.no === 7) && !dn.some(d => d.no === 5038), JSON.stringify(dn.map(d => d.key)));
/* E8 */
vm.runInContext('function canView(){ return true; } function smpMayView(){ return ["COO","KAM"].indexOf(state.role)>-1; } function screenEditOK(){ return state.role==="COO"; }', sb); sb.state = { role: 'KAM' }; vm.runInContext('state=this.state', sb);
ok('E8: Correct a record is for the COO only; People and FOC samples follow their own checks', sb.gdScreenOpen('CFO', 'datafix') === false && sb.gdScreenOpen('COO', 'datafix') === true && sb.gdScreenOpen('KAM', 'users') === false && sb.gdScreenOpen('KAM', 'samples') === true && sb.gdScreenOpen('Lab Rep', 'samples') === false && sb.state.role === 'KAM');
ok('E9: an average counts only rows with the value', sb._avgN([{ d: 2 }, { d: null }, { d: 4 }], 'd') === 2);
/* review round 2 */
{ sb.state = clone(base); vm.runInContext('state=this.state', sb); as('Plant Manager', 'Fahim', 'fahim');
  const p1 = sb.approveMove(m.id), p2 = sb.approveMove(m.id); await p1; await p2;
  const mm = sb.state.poMoves.find(x => x.id === m.id);
  ok('R1: a double-click approves once and the move records who approved it', mm.status === 'done' && mm.approvedBy && mm.approvedBy.name === 'Fahim' && sb.state.packingLog.filter(p => p.movedFrom && p.movedFrom.moveId === m.id).length === 1); }
{ const M3 = sb.merge3(base, clone(A), clone(C)); sb.pmvSettleV1(M3); const m3 = M3.poMoves.find(x => x.id === m.id);
  ok('R2: refusal saved first, approval second: Moved, and the late refusal is named', m3.status === 'done' && m3.clash && m3.clash.was === 'refusal', JSON.stringify(m3.clash)); }
{ const o = { po: 'X', lines: [{ id: 'l', brand: 'B' }] };
  sb.state = { shipments: [{ dispId: 'T', batches: [{ lotId: 'P2', kg: 3640 }] }], packingLog: [{ id: 'P2', po: 'X', lid: 'l', brand: 'B', kg: 640, brandBatchNo: 'N8' }] }; vm.runInContext('state=this.state', sb);
  const t = sb.lineOverUsed(o, o.lines[0]);
  ok('R3: a truck linked to a run is not judged by those links (they are re-dealt on every load and gave false alarms)', t.length === 0, JSON.stringify(t));
  sb.state = { shipments: [], packingLog: [{ id: 'P2', po: 'X', lid: 'l', brand: 'B', kg: 0, brandBatchNo: 'N8', movedOut: [{ moveId: 'M1', kg: 3640 }] }, { id: 'PKM1-0', po: 'Y', lid: 'y', kg: 3640, movedFrom: { moveId: 'M1', lotId: 'P2' } }, { id: 'PKM2-0', po: 'Z', lid: 'z', kg: 3640, movedFrom: { moveId: 'M2', lotId: 'P2' } }] }; vm.runInContext('state=this.state', sb);
  const t2 = sb.lineOverUsed(o, o.lines[0]);
  ok('R3: 2 whole-run moves of the same 3,640 are shown, though the run now holds 0', t2.length === 1 && /7,280 was moved out of it but it records 3,640/.test(t2[0]), JSON.stringify(t2)); }
/* round 4: 2 different moves from one run approved at the same moment - the lost subtraction is put back */
{ const b0 = clone(base); const m1 = b0.poMoves.find(x => x.id === m.id); b0.orders.find(o => o.po === '22999').lines[0].invoicePrice = 248;
  const m2 = JSON.parse(JSON.stringify(m1)); m2.id = 'MV2'; m2.toPo = '22999'; m2.toLid = 'x'; m2.kg = 1000; m2.lots = m2.lots.map(x => Object.assign({}, x, { kg: 1000 })); b0.poMoves.unshift(m2); const m2id = 'MV2';   /* 2 Supply Chain screens each asked; both asks survived the merge */
  const base2 = clone(b0); const mA = base2.poMoves.find(x => x.id === m.id), mB = base2.poMoves.find(x => x.id === m2id);
  const run = async (id) => { const st = clone(base2); sb.state = st; vm.runInContext('state=this.state', sb); as('Plant Manager', 'Fahim', 'fahim'); await sb.approveMove(id); return st; };
  const X = await run(m.id), Y = await run(m2id); const MM = sb.merge3(base2, X, Y); sb.pmvSettleV1(MM);
  sb.state = MM; vm.runInContext('state=this.state', sb);
  const o68 = MM.orders.find(o => o.po === '22868'), o99 = MM.orders.find(o => o.po === '22999'), o67 = MM.orders.find(o => o.po === '22867');
  const f68 = sb.lineOverUsed(o68, o68.lines[0]), f99 = sb.lineOverUsed(o99, o99.lines[0]), f67 = sb.lineOverUsed(o67, o67.lines[0]);
  ok('R4 (a): 2 moves of one run at the same moment are flagged on the PO it left and on both POs it went to, not repaired', f68.length === 1 && f99.length === 1 && f67.length === 1 && /4,000 was moved out of it but it records 3,000/.test(f68[0]) && /may not exist/.test(f99[0]), JSON.stringify([f68, f99, f67]));
  ok('R4 (a): an ordinary single move flags nothing', sb.lineOverUsed(A.orders.find(o => o.po === '22867'), A.orders.find(o => o.po === '22867').lines[0]).length === 0 || (sb.state = A, vm.runInContext('state=this.state', sb), sb.lineOverUsed(A.orders.find(o => o.po === '22867'), A.orders.find(o => o.po === '22867').lines[0]).length === 0)); }
ok('BUILD_ID is 07i', /var BUILD_ID='2026-10-07i'/.test(H.html));
process.exitCode = report('07i: the 4 reviewers\' findings fixed') ? 1 : 0;
})();
