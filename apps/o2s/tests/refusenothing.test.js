/* 5 Oct 2026 — A REFUSAL LEAVES NOTHING BEHIND (after the Pack bug, the same
   "change first, check after" was looked for across O2S; 3 smaller cases found).
   Run: node refusenothing.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab } = H;
const base = () => ({ console, toasts: [], saved: 0 });
/* 1. lab bench: no FIT/UNFIT -> the result is not left on the test */
{ const sb = base(); const t = { param: 'K2O', test: 'K2O', spec: '' }; const coa = { status: 'draft', tests: [t] };
  Object.assign(sb, { toast: m => sb.toasts.push(m), state: { role: 'Lab Rep' }, coaCtx: () => ({ b: {}, h: { coa }, L: 'x' }), labIsV2: () => true,
    coaAutoRemark: () => '', sigStamp: () => 'sig', coaOverall: () => 'FIT', qcAudit2: () => {}, logAction: () => {}, save: () => sb.saved++, render: () => {}, closeModal: () => {} });
  vm.createContext(sb); vm.runInContext(grab('benchSave'), sb);
  sb.benchSave('B', 'L', 0, '30.5', '');
  ok('refused for no FIT/UNFIT', /FIT or UNFIT/.test(sb.toasts.join(' ')));
  eq('the result is not left on the test', t.result, undefined);
  try { sb.benchSave('B', 'L', 0, '30.5', 'FIT'); } catch (e) { /* later steps need the whole app; only the write is checked */ }
  eq('with FIT it is written', [t.result, t.remark].join('|'), '30.5|FIT'); }
/* 2. lead time: one bad value -> none written */
{ const sb = base(); const vals = { rateKgPerDay: '500', qcDays: '9', dispatchDays: '-1', rmProcureDays: '3', minDays: '2' };
  Object.assign(sb, { toast: m => sb.toasts.push(m), canEdit: () => true, document: { getElementById: id => ({ value: vals[id.slice(3)] }) },
    state: { masters: { leadTime: { rateKgPerDay: 400, qcDays: 2, dispatchDays: 1, rmProcureDays: 7, minDays: 3 } } } });
  vm.createContext(sb); vm.runInContext(grab('saveLeadTime'), sb);
  try { sb.saveLeadTime(); } catch (e) {}
  ok('refused for the bad value', /non-negative/.test(sb.toasts.join(' ')));
  eq('the good values before it are not written', JSON.stringify(sb.state.masters.leadTime), JSON.stringify({ rateKgPerDay: 400, qcDays: 2, dispatchDays: 1, rmProcureDays: 7, minDays: 3 })); }
/* 3. dispatch: nothing cleared -> no shipment number used */
{ const sb = base(); const l = { id: 'L', brand: 'X' }; const o = { id: 'O', po: 'P', lines: [l] };
  Object.assign(sb, { toast: m => sb.toasts.push(m), may: () => true, denyRight: () => '', dcControlOn: () => false, nextDCNo: () => '9', lineCleared: () => 0,
    fifoAlloc: () => [], lotsFor: () => [], _uid: p => p, TODAY: new Date('2026-10-05'),
    state: { orders: [o], shipments: [], seq: 10, shipSerial: 41 },
    dispForm: { oid: 'O', dc: '777', date: '2026-10-05', lines: [{ lid: 'L', on: true, qty: 50 }] } });
  vm.createContext(sb); vm.runInContext(grab('saveDispatch'), sb);
  sb.saveDispatch();
  ok('refused: nothing cleared to ship', /Nothing cleared/.test(sb.toasts.join(' ')));
  eq('the shipment serial is not used up', sb.state.shipSerial, 41); }
ok('Plan a truck takes the serial only after the truck is made', /var _serN=\(state\.shipSerial\|\|0\)\+1;[\s\S]*if\(!n\)\{toast\('Nothing cleared to ship[^\n]*\n  state\.shipSerial=_serN;/.test(grab('mpCreate')));
process.exitCode = report('A refusal leaves nothing behind (5 Oct)') ? 1 : 0;
