/* 25b — ONE LOT TESTED FOR THE BATCH. Himayat: with 5 or 10 lots in a batch,
   which lot represents the batch, and how is it identified? Tahir: one lot is
   tested; each lot gets a copy of its certificate saying "results from lot X".
   Run: node replot.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;
const sb = { console, toasts: [], logs: [], audits: [], saved: 0,
  toast: m => sb.toasts.push(m), logAction: m => sb.logs.push(m), qcAudit2: (b, f, v) => sb.audits.push(f + ': ' + v), save: () => sb.saved++, render: () => {},
  labCovers: r => sb.cover === r, cover: '', evToday: () => '2026-09-24', fmt: n => String(n), qsEsc: x => String(x), confirm: () => true,
  state: { role: 'QCM', currentUser: { name: 'Himayat' }, batches: [{ id: 'B', batchNo: 'VU26200', openedDate: '2026-09-01',
    lots: [{ id: 'L1', lotNo: 'VU26200-L1', qty: 1000, date: '2026-09-01', coa: null }, { id: 'L2', lotNo: 'VU26200-L2', qty: 800, date: '2026-09-02', coa: null },
           { id: 'L3', lotNo: 'VU26200-L3', qty: 600, date: '2026-09-03', coa: { status: 'draft', tests: [] } }] }] } };
vm.createContext(sb);
vm.runInContext(['labMayRep', 'labRepOf', 'labRepApproved', 'labLotWaitsRep', 'labSetRep', '_labCopyOne', 'labCopyRep', 'labLotLate', 'labExtendRep', 'labRepCell', 'labRepBtn'].map(grab).join('\n'), sb);
const b = sb.state.batches[0], U = id => Object.assign({ b }, b.lots.find(l => l.id === id));
sb.state.role = 'Lab Rep'; ok('a Lab Rep cannot choose the tested lot', sb.labSetRep('B', 'L2') === false && !b.repLot);
sb.state.role = 'QCM'; ok('the QCM marks lot 2 as tested for the batch', sb.labSetRep('B', 'L2') === true && b.repLot.lotNo === 'VU26200-L2' && b.repLot.by === 'Himayat');
ok('it is on the audit trail', sb.audits.some(a => /Tested lot for the batch/.test(a)));
ok('lot 1 is no longer a lab job: it waits for lot 2', sb.labLotWaitsRep(b, U('L1')));
ok('lot 2 itself is a lab job', !sb.labLotWaitsRep(b, U('L2')));
ok('lot 3, already in testing, stays a lab job', !sb.labLotWaitsRep(b, U('L3')));
ok('the lab screen says whose result lot 1 takes', /takes the result of lot <b>VU26200-L2/.test(sb.labRepCell(U('L1'))));
ok('the QCM can change his mind while lot 2 is untested', sb.labSetRep('B', 'L1') === true && b.repLot.lotId === 'L1');
sb.labSetRep('B', 'L2');
/* lot 2 approved */
b.lots[1].coa = { status: 'approved', approvedDate: '2026-09-20', tests: [{ test: 'N', result: '46.1' }], analyst: { name: 'Awais' }, reviewer: { name: 'Mubeen' }, approver: { name: 'Himayat' }, quantity: '800 Kg', batchNo: 'VU26200-L2', remarks: '' };
b.lots.push({ id: 'L4', lotNo: 'VU26200-L4', qty: 300, date: '2026-09-21', coa: null }); /* exists at approval? no - added below after copy */
b.lots.pop();
eq('on approval the result is copied to the lots with no certificate', sb.labCopyRep(b, b.lots[1]), 1);
const c1 = b.lots[0].coa;
eq('lot 1 has its own certificate: its lot number and quantity', [c1.batchNo, c1.quantity, c1.status].join('|'), 'VU26200-L1|1000 Kg|approved');
eq('...the tested lot\'s results', c1.tests[0].result, '46.1');
eq('...and says where they come from', c1.repOf.lotNo + ' / ' + c1.remarks, 'VU26200-L2 / Results from lot VU26200-L2, tested for batch VU26200.');
eq('...with the same 3 signatures', [c1.analyst.name, c1.reviewer.name, c1.approver.name].join(','), 'Awais,Mubeen,Himayat');
eq('lot 3 (tested on its own) is left alone', b.lots[2].coa.status, 'draft');
ok('once approved, the tested lot cannot be changed', sb.labSetRep('B', 'L1') === false);
/* a lot logged after */
b.lots.push({ id: 'L4', lotNo: 'VU26200-L4', qty: 300, date: '2026-09-21', coa: null });
ok('a lot logged after the result is not covered', sb.labLotLate(b, U('L4')) && !sb.labLotWaitsRep(b, U('L4')));
sb.state.role = 'AQCM'; sb.labExtendRep('B', 'L4'); ok('only the QCM extends the result', !b.lots[3].coa);
sb.state.role = 'QCM'; sb.labExtendRep('B', 'L4');
eq('the QCM extends it, and the certificate says so', b.lots[3].coa.repOf.how + ' ' + /Extended to this lot by Himayat/.test(b.lots[3].coa.remarks), 'extended true');
/* wiring */
ok('approval copies the result', /labCopyRep\(b,ctx\.lot\)/.test(html));
ok('waiting lots are not lab jobs on Today', /if\(labLotWaitsRep\(b,u\)\) return; \/\* 25b/.test(html));
ok('...nor on the QC waiting list', /if\(u\.coa&&\(st==='approved'\|\|st==='failed'\)\)return; if\(labLotWaitsRep\(b,u\)\) return;/.test(html));
ok('the lab screen shows the choice and the cover', /labRepCell\(u\)/.test(html) && /labRepBtn\(u\)/.test(html));
ok('the printed certificate names the tested lot', /Results from lot \$\{e\(c\.repOf\.lotNo\)\}, the lot tested for batch/.test(grab('printCOA')));
process.exitCode = report('One lot tested for the batch (25b)') ? 1 : 0;
