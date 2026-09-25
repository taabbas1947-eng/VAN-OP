/* 25o — free samples (FOC), their own path. Run: node samples.test.js */
const H = require('./harness.js'); const vm = require('vm'); const { ok, eq, report, grab, html } = H;
const FN = ['smpList','smpById','smpKg','smpNextNo','smpStamp','smpMine','smpOwner','smpSince','smpFeedbackDue','smpLog','smpUnit','smpProducts','smpPeople','smpJobs','smpSubmit','smpDecide','smpIssue','smpCheck','smpDispatch','smpArrived','smpFeedback','smpCancel','smpCoaOf','nextGatePassNo','smpMaxNos','acStageOf'];
function mk(role, user) {
  const b = { console, toasts: [], state: { role, currentUser: { name: user, username: user }, samples: [], shipments: [{ gatePass: 'GP-0007' }], orders: [{ po: 'P', lines: [{ id: 'L', ordered: 10 }] }], actionLog: [],
      packingLog: [{ id: 'K1', brand: 'Max Potash', kg: 500, baseBatchId: 'B1', brandBatchNo: 'MP-11', mfgDate: '2026-08-01', expDate: '2028-08-01', po: 'P' }],
      batches: [{ id: 'B1', lots: [{ coa: { status: 'approved', qcNo: 'QC-9' } }] }],
      masters: { products: [{ brand: 'Max Potash', base: 'MP', pack: 25, packs: [25], form: 'Powder', active: true }, { brand: 'Cal-Mag V', pack: 1, packs: [1], form: 'Liquid' }] } },
    usersList: [{ username: 'irfan', name: 'Muhammad Irfan', role: 'KAM' }, { username: 'mali', name: 'Muhammad Ali', role: 'KAM' }],
    fmt: n => String(n), evToday: () => '2026-09-25', calDays: (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5), fyKey: () => '2026-27',
    _uid: p => p + Math.random().toString(36).slice(2, 8), save() {}, render() {}, closeModal() {}, logAction() {}, smpPrint() {},
    toast(m) { b.toasts.push(m); }, denyRight: c => 'no ' + c, confirm: () => true };
  b.may = c => ({ 'sample.request': ['KAM', 'Finance', 'Finance Desk Officer', 'CFO', 'COO'], 'sample.approve': ['COO'], 'sample.issue': ['Warehouse', 'Supply Chain Officer', 'COO'], 'sample.check': ['QA Inspector', 'COO'] }[c] || []).indexOf(b.state.role) > -1;
  b._uRole = () => ({ by: b.state.currentUser.name, user: b.state.currentUser.username, role: b.state.role });
  vm.createContext(b); vm.runInContext("var SMP_QA=['a','b','c','d','e']; var SMP_FEEDBACK_DAYS=14; var smpForm=null, smpAct=null;\n" + FN.map(grab).join('\n'), b); return b; }
(async () => {
const b = mk('KAM', 'irfan'); const S = b.state;
const as = (role, user) => { S.role = role; S.currentUser = { name: user, username: user }; };
b.smpForm = { client: 'SYNGENTA', purpose: 'Product trial', why: 'trial on 5 acres', lines: [{ brand: 'Max Potash', pack: '25', packs: '2' }], neededBy: '2026-10-01', how: 'Courier' };
vm.runInContext('smpForm=this.smpForm', b); b.smpSubmit();
eq('a KAM asks for himself', S.samples.length, 1); const x = S.samples[0];
eq('...the kg is packs × pack', x.lines[0].kg, 50); eq('...it waits on the COO', x.status, 'requested'); eq('...numbered', x.no, 'SMP-0001');
eq('the COO has the job', JSON.stringify(b.smpJobs().map(j => [j.role, j.label])), '[["COO","Approve sample"]]');
as('Finance', 'ismaeel'); vm.runInContext("smpForm={reqUser:'mali',client:'__new',prospect:'Green Farms',city:'Multan',purpose:'Other',why:'new grower, first contact',lines:[{brand:'Cal-Mag V',pack:'1',packs:'3'}],neededBy:'2026-10-02',how:'Courier'}", b); b.smpSubmit();
const y = S.samples[0]; ok('Finance asks on behalf of Muhammad Ali, both kept', y.requester.name === 'Muhammad Ali' && y.onBehalf && y.entered.by === 'ismaeel' && y.prospect && y.lines[0].unit === 'L');
vm.runInContext("smpForm={client:'X',purpose:'Other',why:'short',lines:[{brand:'Max Potash',pack:'25',packs:'1'}],neededBy:'2026-10-02',how:'Courier',reqUser:'mali'}", b); b.smpSubmit(); eq('a request needs a real why', S.samples.length, 2);
as('Warehouse', 'shoaib'); vm.runInContext(`smpAct={id:'${x.id}',lots:[{lot:'K1',kg:'50'}],marks:[],note:''}`, b); b.smpIssue(); eq('nothing is issued before the COO approves', x.status, 'requested');
as('KAM', 'irfan'); vm.runInContext(`smpAct={id:'${x.id}',note:''}`, b); b.smpDecide(true); eq('a KAM cannot approve', x.status, 'requested');
as('COO', 'tahir'); vm.runInContext(`smpAct={id:'${y.id}',note:''}`, b); b.smpDecide(false); eq('not approving needs a reason', y.status, 'requested');
vm.runInContext(`smpAct={id:'${x.id}',note:''}`, b); b.smpDecide(true); eq('the COO approves', x.status, 'approved');
as('Warehouse', 'shoaib'); vm.runInContext(`smpAct={id:'${x.id}',lots:[{lot:'K1',kg:'80'}],marks:[],note:''}`, b); b.smpIssue(); eq('not more than approved', x.status, 'approved');
vm.runInContext(`smpAct={id:'${x.id}',lots:[{lot:'K1',kg:'50'}],marks:[],note:''}`, b); b.smpIssue(); eq('issued from a named lot', x.status, 'issued');
ok('...batch, dates and COA follow it', x.issue.lines[0].batch === 'MP-11' && x.issue.lines[0].exp === '2028-08-01' && x.issue.lines[0].coa === 'QC-9');
vm.runInContext(`smpAct={id:'${x.id}',carrier:'TCS',date:'2026-09-25'}`, b); await b.smpDispatch(); eq('no gate pass before QA', x.status, 'issued');
as('QA Inspector', 'shoaib'); vm.runInContext(`smpAct={id:'${x.id}',marks:['pass','pass','pass','pass','pass'],note:''}`, b); b.smpCheck(); eq('the person who issued it does not check it', x.status, 'issued');
as('QA Inspector', 'asif'); vm.runInContext(`smpAct={id:'${x.id}',marks:['pass','fail','pass','pass','pass'],note:''}`, b); b.smpCheck(); eq('a fail needs a reason', x.status, 'issued');
vm.runInContext(`smpAct={id:'${x.id}',marks:['pass','pass','pass','pass','pass'],note:''}`, b); b.smpCheck(); eq('QA passes it', x.status, 'checked');
as('Warehouse', 'shoaib'); x.qa.date = '2026-09-25'; vm.runInContext(`smpAct={id:'${x.id}',carrier:'TCS',tracking:'T1',date:'2020-01-01'}`, b); await b.smpDispatch(); eq('it cannot leave before it was approved and checked', x.status, 'checked');
vm.runInContext(`smpAct={id:'${x.id}',carrier:'TCS',tracking:'T1',date:'2026-09-25'}`, b); await b.smpDispatch();
ok('sample DC and a gate pass from the trucks’ book', x.status === 'dispatched' && x.dispatch.dc === 'SDC-0001' && x.dispatch.gatePass === 'GP-0008');
eq('the next truck gate pass follows it', b.nextGatePassNo(), 'GP-0009');
eq('Irfan is asked if it arrived', JSON.stringify(b.smpJobs().filter(j => j.smp === x).map(j => [j.label, j.who])), '[["Sample arrived","irfan"]]');
as('KAM', 'mali'); vm.runInContext(`smpAct={id:'${x.id}',via:'Client told me',date:'2026-09-26'}`, b); b.smpArrived(); eq('someone else cannot confirm it', x.status, 'dispatched');
as('KAM', 'irfan'); vm.runInContext(`smpAct={id:'${x.id}',via:'Client told me',date:'2026-09-24'}`, b); b.smpArrived(); eq('it cannot arrive before it left', x.status, 'dispatched');
vm.runInContext(`smpAct={id:'${x.id}',via:'Client told me',date:'2026-09-25'}`, b); b.smpArrived(); eq('Irfan confirms it arrived', x.status, 'delivered');
x.delivered.date = '2026-09-01'; eq('14 days on with no feedback, Irfan is asked', JSON.stringify(b.smpJobs().filter(j => j.smp === x).map(j => j.label)), '["Sample feedback"]');
as('KAM', 'mali'); vm.runInContext(`smpAct={id:'${x.id}',result:'Negative',note:'x',po:''}`, b); b.smpFeedback(); eq('another KAM cannot record feedback on it', (x.feedback || []).length, 0);
as('KAM', 'irfan'); vm.runInContext(`smpAct={id:'${x.id}',result:'Positive, an order is coming',note:'good',po:'PO-1'}`, b); b.smpFeedback();
ok('feedback kept with who and the order it led to', x.feedback.length === 1 && x.feedback[0].by === 'irfan' && x.feedback[0].po === 'PO-1');
eq('...and the job goes', b.smpJobs().filter(j => j.smp === x).length, 0);
ok('no order, lot, shipment or sale was touched', S.orders.length === 1 && S.shipments.length === 1 && S.packingLog[0].kg === 500 && S.orders[0].lines[0].ordered === 10);
ok('New order no longer offers FOC', !/FOC sample \(no charge\)<\/option>/.test(html) && /ask for it under Samples/.test(html) && !/<option value="FOC"/.test(html));
ok('the chain is on Today and the Guide', /smpJobs\(\)/.test(grab('actionItems')) && /'Approve sample':'Issue sample'/.test(html) && /<h3>Free samples<\/h3>/.test(grab('guideRules')) && /smpNew\(\)/.test(grab('tdStarts')));
ok('the four rights exist, the approval is the COO’s alone', /code:'sample\.approve'[\s\S]{0,200}legacy:\{kind:'hard', roles:\[\]\}/.test(html));
ok('Samples is in the header only for the people in the chain', /if\(id==='samples'&&!smpMayView\(\)\) return;/.test(grab('renderTopNav')));
ok('sample jobs are never counted as Production', b.acStageOf('Issue sample') === 'Free samples' && b.acStageOf('Sample feedback') === 'Free samples');
{ const c = mk('COO', 'tahir'); const T = c.state; vm.runInContext("smpForm={reqUser:'__other',reqOther:'Tahir Abbas',client:'SYN',purpose:'Other',why:'client visit, handed over',lines:[{brand:'Max Potash',pack:'25',packs:'1'}],neededBy:'2026-10-02',how:'Our staff carries it'}", c); c.smpSubmit();
  const z = T.samples[0]; vm.runInContext(`smpAct={id:'${z.id}',note:''}`, c); c.smpDecide(true); eq('the COO approving what he entered himself must write a note', z.status, 'requested');
  vm.runInContext(`smpAct={id:'${z.id}',note:'visit to Syngenta'}`, c); c.smpDecide(true); ok('...then it goes, marked as his own', z.status === 'approved' && z.approval.self === true);
  T.role = 'Warehouse'; T.packingLog.push({ id: 'K2', brand: 'Cal-Mag V', kg: 10 }); vm.runInContext(`smpAct={id:'${z.id}',lots:[{lot:'K2',kg:'25'}]}`, c); c.smpIssue(); eq('a lot of another product is refused', z.status, 'approved');
  vm.runInContext(`smpAct={id:'${z.id}',lots:[{lot:'__other',batch:'RET-9',kg:'25'}]}`, c); c.smpIssue();
  T.role = 'QA Inspector'; T.currentUser = { name: 'asif', username: 'asif' }; vm.runInContext(`smpAct={id:'${z.id}',marks:['pass','pass','pass','pass','pass'],note:''}`, c); c.smpCheck(); eq('the COA line cannot pass with no certificate named', z.status, 'issued');
  vm.runInContext(`smpAct={id:'${z.id}',marks:['pass','pass','pass','pass','pass'],note:'',coa:{0:'QC-77'}}`, c); c.smpCheck(); ok('...QA names the one he saw and it passes', z.status === 'checked' && z.issue.lines[0].coa === 'QC-77' && z.issue.lines[0].coaTypedBy === 'asif'); }
{ const m = { samples: [{ dcNo: 'SDC-0004', dispatch: { gatePass: 'GP-0012' } }], shipments: [{ gatePass: 'GP-0010' }] }; const b2 = mk('COO', 't'); eq('numbers come from the highest of both copies', JSON.stringify(b2.smpMaxNos(m)), '{"gp":12,"dc":4}'); }
process.exitCode = report('Free samples (25o)') ? 1 : 0;
})();
