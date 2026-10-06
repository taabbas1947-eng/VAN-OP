/* 6 Oct 2026 (06c) — EVERY PAPER EASIER TO FIND.
   Tahir: "does he know where he finds what? like an old record, a copy of
   inspection report or copy of DC or COA?"
   Run: node findcopy.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, grabTopVar, html } = H;

/* 1. The order sheet's Papers: each paper under the rule it already has */
const sb = { console, qsEsc: x => String(x), money: true, role: 'Supply Chain', coaRoles: ['QCM', 'Plant Manager', 'COO'], qaView: false,
  mayMoney: () => sb.money, canView: (r, id) => id === 'qa' ? sb.qaView : true,
  rpDef: id => ({ id }), rpMay: c => sb.coaRoles.indexOf(sb.state.role) > -1,
  psiDetailFor: g => g.dispId === 'D1', state: { role: 'Supply Chain', batches: [], shipments: [], inspections: [] } };
vm.createContext(sb);
vm.runInContext(['shipDcBtn', 'shipGpBtn', 'shipPsiBtn', 'ordDocBatches', 'ordDocsHTML'].map(grab).join('\n') +
  '\nfunction printGatePass(){}\nfunction dispatchGroups(){ return this.groups||[]; }', sb);
const o = { id: 'O1', po: 'P-1' };
sb.groups = [{ dispId: 'D1', po: 'P-1', pos: ['P-1'], dc: '133', gatePass: 'GP-9', vehicle: 'TLA-1', date: '2026-10-05', qa: 'pass' },
             { dispId: 'D2', po: 'P-2', pos: ['P-2'], dc: '200', qa: 'pass' }];
sb.state.batches = [
  { id: 'B1', po: 'P-1', brand: 'V-Zinc', batchNo: 'B-1', coa: { status: 'approved' } },
  { id: 'B2', po: 'P-1', brand: 'V-Mg', batchNo: 'B-2', lots: [{ id: 'L1', lotNo: 'B-2/1', coa: { status: 'approved' } }, { id: 'L2', lotNo: 'B-2/2', coa: { status: 'review' } }] },
  { id: 'B3', kind: 'multi', allocations: [{ po: 'P-9' }, { po: 'P-1' }], brand: 'Sulfur', batchNo: 'B-3', coa: { status: 'approved' } },
  { id: 'B4', po: 'P-2', brand: 'Other', batchNo: 'B-4', coa: { status: 'approved' } },
  { id: 'B5', po: 'P-1', voided: true, coa: { status: 'approved' } }];
sb.state.inspections = [{ po: 'P-1' }];
let h = sb.ordDocsHTML(o);
ok('a money role gets the PO', /printPO\('P-1'\)/.test(h));
ok('this order\'s truck: DC, gate pass and inspection report', /printDC\('D1'\)/.test(h) && /printGatePass\('D1'\)/.test(h) && /printPSI\('D1'\)/.test(h));
ok('another order\'s truck is not listed', !/D2/.test(h));
ok('Supply Chain gets no COA (the Lab certificates report is not theirs)', !/printCOA/.test(h));
ok('and no inspection log without QA access', !/printInspect/.test(h));
sb.money = false; sb.state.role = 'QCM'; sb.qaView = true;
h = sb.ordDocsHTML(o);
ok('no PO for a role that does not see money', !/printPO/.test(h));
ok('the lab gets each approved certificate: batch, lot and a shared batch', /printCOA\('B1',''\)/.test(h) && /printCOA\('B2','L1'\)/.test(h) && /printCOA\('B3',''\)/.test(h));
ok('not one still in review, another PO\'s, or a voided batch', !/'L2'/.test(h) && !/B4/.test(h) && !/B5/.test(h));
ok('QA access gives the inspection log', /printInspect\('P-1'\)/.test(h));
sb.groups = []; sb.state.batches = []; sb.state.inspections = []; sb.state.role = 'Supply Chain'; sb.qaView = false;
eq('an order with no papers shows no Papers section', sb.ordDocsHTML(o), '');
ok('the order sheet ends with Papers', /h\+=ordDocsHTML\(o\);/.test(grab('openOrderSheet')));

/* 2. Lab certificates: who signed and when */
const sq = { console, state: { orders: [{ po: 'P-1', client: 'Arain' }], batches: [
  { id: 'B1', po: 'P-1', brand: 'V-Zinc', batchNo: 'B-1', producedKg: 500, coa: { status: 'approved', approvedDate: '2026-10-02', dateOfTest: '2026-10-01', approver: { name: 'QCM Name' }, reviewer: { name: 'AQCM Name' } } },
  { id: 'B2', po: 'P-1', brand: 'V-Mg', batchNo: 'B-2', producedKg: 300, lots: [{ id: 'L1', lotNo: 'B-2/1', qty: 300, coa: { status: 'review', dateOfTest: '2026-10-03', reviewer: { name: 'AQCM Name' } } }] }] } };
vm.createContext(sq);
vm.runInContext(grab('_rbClientMap') + '\nvar RB_DATASETS=' + grabTopVar('RB_DATASETS', '{').replace(/^\s*var\s+RB_DATASETS\s*=\s*/, '') + ';\nthis.qcRows=RB_DATASETS.qc.rows();', sq);
const r = sq.qcRows;
eq('an approved certificate is dated the day it was approved', r[0].date, '2026-10-02');
eq('and signed by the approver', r[0].by, 'QCM Name');
eq('an approved certificate reads FIT', r[0].result, 'FIT');
ok('it can be printed, from the batch', r[0]._ok === true && r[0]._bid === 'B1' && r[0]._lid === '');
eq('one in review is dated the test day', r[1].date, '2026-10-03');
eq('and named by its reviewer', r[1].by, 'AQCM Name');
ok('but cannot be printed yet', r[1]._ok === false);
sq.state.batches = [{ id: 'B9', batchNo: 'B-9', producedKg: 10, coa: { status: 'approved' }, lots: [{ id: 'L9', lotNo: 'B-9/1', qty: 10 }] }];
vm.runInContext('this.qcRows=RB_DATASETS.qc.rows();', sq);
ok('a lot with no certificate of its own prints the batch certificate', sq.qcRows[0]._ok === true && sq.qcRows[0]._lid === '');
ok('the report shows a COA button per approved row', /c\.id==='coa'&&!res\.summary/.test(grab('rpReportHTML')) && /printCOA\(/.test(grab('rpReportHTML')));

/* 3. Documents: the switch is above the list; the full name is shown */
const rr = grab('rpReportHTML');
ok('the Purchase orders / DC switch comes before the list', rr.indexOf('Delivery challans, gate passes and inspection reports') > -1 && rr.indexOf('Delivery challans, gate passes and inspection reports') < rr.indexOf("rpDocs():rpPos()"));
ok('the PO register shows the full customer name', /_pe\(o\.client\|\|'—'\)/.test(grab('rpPos')));
ok('the DC register shows the full customer name', /_pe\(g\.client\|\|'—'\)/.test(grab('rpDocs')));

/* 4. One name, and the Guide */
ok('the samples page is FOC samples, as in the header (25p)', /\{id:'samples', name:'FOC samples'/.test(html) && /label:'FOC samples'/.test(html) && !/<h1>Free samples<\/h1>/.test(html));
const rules = grab('guideRules');
ok('The rules: Where to find a copy', /<h3>Where to find a copy<\/h3>/.test(rules) && /Reports → <b>Lab certificates<\/b>/.test(rules) && /<b>Papers<\/b>/.test(rules) && /Delivery challans, gate passes and inspection reports/.test(rules));

/* 5. 06d: the inspection register wraps and its report number prints */
const reg = grab('psiRegisterHTML');
ok('the report number is a link that opens printPSI', /<a class="psi-link"[^>]*onclick="printPSI\(/.test(reg));
ok('the Print button stays as well', /\)">Print<\/button>/.test(reg));
ok('customer and products wrap', (reg.match(/<td'\+_wr\+'>/g) || []).length === 2 && /white-space:normal/.test(reg));
ok('the Guide says to tap the report number', /tap the report number to open it, ready to print or save as PDF/.test(grab('guideRules')));
process.exitCode = report('Every paper easier to find (06c)') ? 1 : 0;
