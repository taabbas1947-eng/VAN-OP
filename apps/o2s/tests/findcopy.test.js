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
ok('The rules: Where to find a copy', /<h3>Where to find a copy<\/h3>/.test(rules) && /Lab and QA → <b>Lab certificates<\/b>/.test(rules) && /<b>One customer<\/b>/.test(rules) && /<b>Papers<\/b>/.test(rules) && /Delivery challans, gate passes and inspection reports/.test(rules));

/* 5. 06d: the inspection register wraps and its report number prints */
const reg = grab('psiRegisterHTML');
ok('the report number is a link that opens printPSI', /<a class="psi-link"[^>]*onclick="printPSI\(/.test(reg));
ok('the Print button stays as well', /\)">Print<\/button>/.test(reg));
ok('customer and products wrap', (reg.match(/<td'\+_wr\+'>/g) || []).length === 2 && /white-space:normal/.test(reg));
ok('the Guide says to tap the report number', /tap the report number to open it, ready to print or save as PDF/.test(grab('guideRules')));
/* 6. 07a: late means a later calendar day; reports fit the screen */
{ const sl = { console, TODAY: new Date('2026-10-07T06:00:00Z') };
  vm.createContext(sl);
  vm.runInContext(['evToday', 'localDateOf', 'calDays', 'evLag'].map(grab).join('\n'), sl);
  eq('keyed the same day at 6 pm is not late', sl.evLag({ actualDate: '2026-10-06', recordedAt: '2026-10-06T13:00:00Z' }), 0);
  eq('keyed the next day is 1 day', sl.evLag({ actualDate: '2026-10-03', recordedAt: '2026-10-04T10:00:00Z' }), 1);
  eq('keyed 7 days later is 7', sl.evLag({ actualDate: '2026-08-15', recordedAt: '2026-08-22T09:00:00Z' }), 7);
  eq('no recorded time, no answer', sl.evLag({ actualDate: '2026-08-15' }), null); }
ok('late entries: the quantity is labelled Kg/L, not Value', /\{k:'value',l:'Kg\/L',t:'meas'\}\],\s*\/\* 07a/.test(html));
ok('shipments report: a PO column after the DC', /id:'trucks'[^\n]*cols:\['date','dc','po','client'/.test(html) && /_disp:s\.dispId\|\|''/.test(html));
ok('a DC number opens the DC', /k==='dc'&&r\._disp/.test(grab('rpCellHTML')) && /printDC\(/.test(grab('rpCellHTML')));
ok('long text wraps in named reports, detail gets room', /'detail'/.test(html.match(/var RP_WRAP_COLS=[^\n]*/)[0]) && /td\.rpwrap\.wide\{min-width:260px/.test(html));
ok('an open report uses the screen width', /\.qs\.wide\.rp\{max-width:min\(1400px,100%\)\}/.test(html) && /<div class="qs wide rp"><div class="bo-back">/.test(grab('rpReportHTML')));
/* 7. 07b: reports by function, and 5 new reports */
{ const cat = (() => { const m = /\nvar RP_CATALOGUE=\[/.exec(html); return H.matchBlock(m.index + 1, 'RP_CATALOGUE', '['); })();
  const grp = (() => { const m = /\nvar RP_GROUPS=\[/.exec(html); return H.matchBlock(m.index + 1, 'RP_GROUPS', '['); })();
  ['openorders', 'customer', 'packqa', 'waiting', 'labtat'].forEach(id => ok('new report: ' + id, new RegExp("\\{id:'" + id + "'").test(cat)));
  const ids = (cat.match(/\{id:'([a-z]+)'/g) || []).map(x => x.slice(5, -1)).filter(x => x !== 'custom');
  const inG = (grp.match(/'[a-z]+'/g) || []).map(x => x.slice(1, -1));
  ok('every report except Custom sits in exactly one function group', ids.every(id => inG.filter(x => x === id).length === 1));
  const f = new Function('state', 'mayMoney', "var INVOICE_ROLES=['Finance'];\n" + cat + ';\n' + grp + ';\n' + ['rpDef', 'rpMay', 'rpGroupVisible'].map(grab).join('\n') + '\nreturn {G:RP_GROUPS,v:rpGroupVisible};');
  const qa = f({ role: 'QA Inspector' }, () => false);
  const qg = qa.G.map(g => g.id + ':' + qa.v(g).map(c => c.id).join(','));
  ok('QA Inspector: Lab and QA holds certificates, turnaround, packing QA and truck inspections; no money group', qg.indexOf('quality:coa,labtat,packqa,psi') > -1 && qg.indexOf('money:') > -1);
  const pm = f({ role: 'Production Manager' }, () => false);
  ok('Lab turnaround is open to the Production Manager and the Plant Manager (Tahir, 7 Oct)', pm.v(pm.G.find(g => g.id === 'quality')).some(c => c.id === 'labtat') && (() => { const x = f({ role: 'Plant Manager' }, () => false); return x.v(x.G.find(g => g.id === 'quality')).some(c => c.id === 'labtat'); })());
  const pr = f({ role: 'Production' }, () => false);
  ok('a group a role has no report in shows no card (rpListHTML skips an empty group)', /if\(!rs\.length\) return '';/.test(grab('rpListHTML')) && pr.v(pr.G.find(g => g.id === 'control')).length === 0);
  ok('inside a function: its reports are tabs', /class="subnav rp-tabs"/.test(grab('rpReportHTML')) && /rpGroupVisible\(g\)/.test(grab('rpReportHTML')));
  ok('rights unchanged: a tab is a report rpMay allows', /rpMay\(c\)/.test(grab('rpGroupVisible')));
}
{ /* the 3 new datasets, on a small plant */
  const sd = { console, TODAY: new Date('2026-10-07T06:00:00Z'), state: {
    orders: [{ po: 'P1', client: 'Arain', lines: [{ id: 'a', brand: 'V-Zinc', ordered: 1000, packed: 800, dispatched: 300, delivered: 300 }, { id: 'b', brand: 'Vibrant', ordered: 500, packed: 500, dispatched: 500, delivered: 500 }] }],
    packingLog: [{ po: 'P1', brand: 'V-Zinc', kg: 800, date: '2026-10-04', brandBatchNo: 'VZ-1', qa: { pass: true, by: 'Ehtisham', actualDate: '2026-10-05' } }],
    inspections: [{ po: 'P1', brand: 'V-Zinc', kg: 500, by: 'Asif', actualDate: '2026-10-06', pass: false, batches: [{ batch: 'VZ-1' }] }],
    batches: [{ id: 'B1', po: 'P1', brand: 'V-Zinc', batchNo: 'B-1', coa: { status: 'approved', assign: { at: '2026-10-01T05:00:00Z' }, approvedDate: '2026-10-04', approver: { name: 'QCM' } } },
              { id: 'B3', po: 'P1', brand: 'Old', batchNo: 'B-3', coa: { status: 'approved', receivingDate: '2026-10-03', approvedDate: '2026-10-04' } },
              { id: 'B2', po: 'P1', brand: 'Vibrant', batchNo: 'B-2', coa: { status: 'review', assign: { at: '2026-10-05T05:00:00Z' } } }] } };
  vm.createContext(sd);
  vm.runInContext(['evToday', 'localDateOf', 'calDays', '_rbClientMap', 'lotBaseNo', 'lotBrandNo', 'batchPOsLabel', 'lineShortClosed'].map(grab).join('\n') + '\nfunction lineCleared(o,l){ return l.brand==="V-Zinc"?200:0; }\nfunction lineNetPrice(){ return 0; }\nfunction fedSplit(){ return {fed:0}; }\nvar RB_DATASETS=' + grabTopVar('RB_DATASETS', '{').replace(/^\s*var\s+RB_DATASETS\s*=\s*/, '') + ';\nthis.D=RB_DATASETS;', sd);
  const w = sd.D.waiting.rows();
  eq('waiting to ship: one line has packed stock not shipped', w.length, 1);
  ok('...500 waiting, 200 cleared and ready, 300 waiting for QA, last packed 4 Oct', w[0].waiting === 500 && w[0].ready === 200 && w[0].awaitqa === 300 && w[0].lastpacked === '2026-10-04');
  const q = sd.D.packqa.rows();
  ok('packing QA: the packed-material inspection and the older lot check, each with result and inspector', q.length === 2 && q.some(r => r.result === 'Fail' && r.by === 'Asif' && r.batch === 'VZ-1') && q.some(r => r.result === 'Pass' && r.kind === 'Packed lot' && r.batch === 'VZ-1'));
  const t = sd.D.labtat.rows();
  ok('lab turnaround: approved = sample in to approval (3 days)', t.some(r => r.batch === 'B-1' && r.days === 3 && r.status === 'Approved'));
  ok('an old-flow certificate (no hand-over to the lab) is left out (Tahir, 7 Oct)', !t.some(r => r.batch === 'B-3'));
  ok('an open certificate counts the days so far, from the hand-over to the lab (07i: shown, not averaged)', t.some(r => r.batch === 'B-2' && r.days === null && r.sofar === '2 days so far' && /^Open/.test(r.status)));
  const o = sd.D.orders.rows();
  ok('open orders: what is left per line (700, and 0 for the delivered one)', o.find(r => r.product === 'V-Zinc').balance === 700 && o.find(r => r.product === 'Vibrant').balance === 0);
}
ok('opening One customer does not fall into the builder branch', /c\.kind==='customer'/.test(grab('rpOpen')));
ok('one customer: orders open their sheet, the DC number prints the DC, no prices', /openOrderSheet\(/.test(grab('rpCustomerHTML')) && /printDC\(/.test(grab('rpCustomerHTML')) && !/price|pkr\(/i.test(grab('rpCustomerHTML')));
ok('lab turnaround shows an average, not a sum of days', /avgKey/.test(grab('rpSentence')) && /'avg '/.test(grab('rpTableHTML')));
process.exitCode = report('Every paper easier to find (06c)') ? 1 : 0;
