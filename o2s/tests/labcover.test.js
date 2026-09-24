/* LEAVE COVER FOR THE LAB SIGN-OFFS — 24 September 2026 (build 24u).

   Tahir: "When Himayat is on leave, the AQCM can sign the report on behalf of
   Himayat, and when the AQCM is on leave Himayat can do it on his behalf. How to
   create this cover?"

   His rulings the same evening:
     - "As per ISO, no management can sign; no cover will sign both." A cover
       takes ONE signature; the 2 signatures on a certificate stay 2 people.
     - the Plant Manager allows the cover
     - lab sign-offs only (AQCM review, QCM approval)
     - the print says whom it was signed for

   So when Himayat is away and Masab covers the approval, Masab still cannot
   approve a certificate he reviewed himself. The Plant Manager can name a
   second cover for the review (another lab person) for the same days; the
   cover screen says so.

   Run: node labcover.test.js */
const H = require('./harness.js');
const fs = require('fs');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;
const STATE = JSON.parse(fs.readFileSync(H.STATE, 'utf8')).data;
const BLOCKS = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
function has(name) { try { grab(name); return true; } catch (e) { return false; } }
function app(role, user, name) {
  const els = {};
  const el = (id) => {
    if (id && els[id]) return els[id];
    const o = { id: id || '', innerHTML: '', textContent: '', value: '', style: {}, _cls: {},
      classList: { add(k) { o._cls[k] = 1; }, remove(k) { delete o._cls[k]; }, contains(k) { return !!o._cls[k]; }, toggle() {} },
      addEventListener() {}, appendChild() {}, querySelector() { return el(); },
      querySelectorAll() { return []; }, focus() {}, click() {}, getAttribute() { return null; },
      setAttribute() {}, remove() {}, dataset: {}, children: [], parentNode: null, scrollIntoView() {},
      insertAdjacentHTML(p, h) { o.innerHTML += h; } };
    if (id) els[id] = o;
    return o;
  };
  const doc = { getElementById(id) { return el(id); }, querySelector() { return el(); },
    querySelectorAll() { return []; }, createElement() { return el(); },
    body: el('body'), documentElement: el('html'), head: el('head'), addEventListener() {} };
  const printed = [];
  const c = { console, JSON, Math, Date, String, Number, Array, Object, Boolean, RegExp, Error,
    isNaN, parseInt, parseFloat, Promise, Intl, URL, encodeURIComponent, decodeURIComponent,
    document: doc, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {},
    fetch() { return Promise.resolve({ ok: false, json: () => ({}) }); },
    alert() {}, confirm() { return true; }, prompt() { return 'wrong spec on pH'; },
    location: { href: '', search: '', reload() {} }, navigator: { userAgent: 'node' },
    history: { pushState() {} }, requestAnimationFrame() {}, performance: { now() { return 0; } },
    Blob: function () {}, btoa: s => s, atob: s => s,
    open() { return { document: { write(h) { printed.push(h); }, close() {} }, focus() {} }; } };
  c.window = c; c.globalThis = c; c.self = c;
  vm.createContext(c);
  BLOCKS.forEach(b => vm.runInContext(b, c));
  c.__printed = printed;
  c.__st = JSON.parse(JSON.stringify(STATE));
  vm.runInContext('state = __st; state.batches = state.batches || [];'
    + ' toasts = []; toast = function(m){ toasts.push(String(m)); }; save = function(){};'
    + ' usersList = [{username:"awais",name:"Awais Ali",role:"Lab Rep"},{username:"mubeen",name:"Mubeen Ahmad",role:"Lab Rep"},'
    + '{username:"masab",name:"Masab Khan",role:"AQCM"},{username:"himayat",name:"Himayat Hussain",role:"QCM"},{username:"fahim",name:"Fahim Asghar",role:"Plant Manager"}];', c);
  vm.runInContext('if(typeof seedDeptRightsV1==="function") seedDeptRightsV1(state);', c);
  as(c, role, user, name);
  c.__els = els;
  return c;
}
function as(c, role, user, name) { vm.runInContext('state.role=' + JSON.stringify(role) + '; state.currentUser={name:' + JSON.stringify(name) + ',username:' + JSON.stringify(user) + ',role:' + JSON.stringify(role) + '}; toasts=[];', c); }
const run = (c, src) => vm.runInContext(src, c);

const B = c => run(c, 'state.batches.find(function(b){return b.id==="B-COV";})');
function withCert(c, status, extra) {
  c.__b = { id: 'B-COV', batchNo: 'VC26001', base: 'Vital Potash', brand: 'Vital Potash', kind: 'bulk', status: 'closed',
    openedDate: '2026-09-20', closedDate: '2026-09-20', plannedKg: 500, producedKg: 500, packedKg: 0, disposedKg: 0, lots: [],
    coa: Object.assign({ status, item: 'Vital Potash', batchNo: 'VC26001', qcNo: 'Q-9', rev: 0,
      tests: [{ test: 'K2O', spec: '>=44', result: '45', remark: 'FIT' }],
      analyst: { name: 'Mubeen Ahmad', date: '2026-09-21 10:00' }, draftedBy: { name: 'Mubeen Ahmad', user: 'mubeen', role: 'Lab Rep' },
      reviewer: { name: '', date: '' }, approver: { name: '', date: '' } }, extra || {}) };
  run(c, 'state.batches.push(__b);');
}
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const day = n => { const d = new Date(today()); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

ok('the cover functions exist', ['labCovers', 'labSetCover', 'labEndCover', 'openLabCover', 'labCoverActive'].every(has));

/* 1. who may set it */
{
  const c = app('QCM', 'himayat', 'Himayat Hussain'); withCert(c, 'reviewed');
  run(c, `labSetCover("QCM","masab","${today()}","${day(3)}")`);
  eq('the QCM cannot hand his own signature over', run(c, 'labCoverActive().length'), 0);
  as(c, 'COO', 'tahir', 'Tahir Abbas');
  run(c, `labSetCover("QCM","masab","${today()}","${day(3)}")`);
  eq('nor can the COO - the Plant Manager allows the cover', run(c, 'labCoverActive().length'), 0);
  as(c, 'Plant Manager', 'fahim', 'Fahim Asghar');
  run(c, `labSetCover("QCM","himayat","${today()}","${day(3)}")`);
  eq('the absent person cannot be his own cover', run(c, 'labCoverActive().length'), 0);
  run(c, `labSetCover("QCM","fahim","${today()}","${day(3)}")`);
  eq('management cannot be named cover (ISO)', run(c, 'labCoverActive().length'), 0);
  run(c, `labSetCover("QCM","masab","${day(3)}","${today()}")`);
  eq('the end date cannot be before the start', run(c, 'labCoverActive().length'), 0);
  run(c, `labSetCover("QCM","masab","${today()}","${day(3)}")`);
  eq('the Plant Manager names Masab to cover the QCM approval', run(c, 'labCoverActive().length'), 1);
  const cv = run(c, 'labCoverActive()[0]');
  ok('...recorded with who allowed it and whose signature it is', cv.role === 'QCM' && cv.absent === 'himayat' && cv.cover === 'masab' && cv.by && cv.by.user === 'fahim');
}

/* 2. the cover signs the approval, marked "for" */
{
  const c = app('Plant Manager', 'fahim', 'Fahim Asghar');
  withCert(c, 'reviewed', { reviewer: { name: 'Awais Ali', user: 'awais', role: 'AQCM', date: '2026-09-22 09:00' } });
  run(c, `labSetCover("QCM","masab","${today()}","${day(3)}")`);
  as(c, 'AQCM', 'masab', 'Masab Khan');
  ok('Masab covers the QCM approval today', run(c, 'labCovers("QCM")') === true);
  ok("...so the approval job is on Masab's Today", run(c, 'tdItems()').some(it => it.label === 'Approve' && it.batch && it.batch.id === 'B-COV'));
  run(c, 'coaForm={bid:"B-COV",lid:""}; coaApprove()');
  const co = B(c).coa;
  eq('he approves it', co.status, 'approved');
  eq('...signed in his own name', co.approver && co.approver.name, 'Masab Khan');
  ok('...for Himayat Hussain (QCM)', co.approver && co.approver.onBehalf && co.approver.onBehalf.name === 'Himayat Hussain' && co.approver.onBehalf.role === 'QCM', JSON.stringify(co.approver));
  run(c, 'printCOA("B-COV","")');
  ok('the printed certificate says whom it was signed for', /for Himayat Hussain/.test(c.__printed.join('')));
  run(c, 'coaForm=JSON.parse(JSON.stringify(state.batches.find(function(b){return b.id==="B-COV";}).coa)); coaForm.bid="B-COV"; coaForm.lid=""; renderCOAModal();');
  ok('the certificate sheet says it too', /for Himayat Hussain/.test(run(c, 'document.getElementById("coaFS").innerHTML')));
}

/* 3. no cover signs both */
{
  const c = app('Plant Manager', 'fahim', 'Fahim Asghar');
  withCert(c, 'analysed');
  run(c, `labSetCover("QCM","masab","${today()}","${day(3)}")`);
  as(c, 'AQCM', 'masab', 'Masab Khan');
  run(c, 'coaForm={bid:"B-COV",lid:""}; coaReview()');
  eq('Masab reviews as himself', B(c).coa.status, 'reviewed');
  ok('...with no "for" on his own signature', !B(c).coa.reviewer.onBehalf);
  run(c, 'coaForm={bid:"B-COV",lid:""}; coaApprove()');
  eq('and cannot then approve it as the cover', B(c).coa.status, 'reviewed');
  ok("Today does not offer him an approval he cannot give", !run(c, 'tdItems()').some(it => it.label === 'Approve' && it.batch && it.batch.id === 'B-COV'));
}

/* 4. the other way round: Masab away, Himayat reviews for him */
{
  const c = app('Plant Manager', 'fahim', 'Fahim Asghar');
  withCert(c, 'analysed');
  run(c, `labSetCover("AQCM","himayat","${today()}","${day(2)}")`);
  as(c, 'QCM', 'himayat', 'Himayat Hussain');
  run(c, 'coaForm={bid:"B-COV",lid:""}; coaReview()');
  const co = B(c).coa;
  eq('Himayat reviews for Masab', co.status, 'reviewed');
  ok('...marked for Masab Khan (AQCM)', co.reviewer.onBehalf && co.reviewer.onBehalf.name === 'Masab Khan');
  run(c, 'coaForm={bid:"B-COV",lid:""}; coaApprove()');
  eq('and cannot then approve what he reviewed', B(c).coa.status, 'reviewed');
}

/* 5. dates and ending */
{
  const c = app('Plant Manager', 'fahim', 'Fahim Asghar'); withCert(c, 'reviewed', { reviewer: { name: 'Awais Ali', user: 'awais', role: 'AQCM', date: 'x' } });
  run(c, `labSetCover("QCM","masab","${day(1)}","${day(4)}")`);
  as(c, 'AQCM', 'masab', 'Masab Khan');
  ok('a cover starting tomorrow does not work today', run(c, 'labCovers("QCM")') === false);
  run(c, 'coaForm={bid:"B-COV",lid:""}; coaApprove()');
  eq('...so he cannot approve today', B(c).coa.status, 'reviewed');
  as(c, 'Plant Manager', 'fahim', 'Fahim Asghar');
  run(c, `labSetCover("QCM","masab","${today()}","${day(4)}")`);
  const id = run(c, 'labCoverActive()[0].id');
  run(c, 'labEndCover(' + JSON.stringify(id) + ')');
  as(c, 'AQCM', 'masab', 'Masab Khan');
  ok('ended early: no longer covering', run(c, 'labCovers("QCM")') === false);
  ok('...and the record stays, marked ended', run(c, 'state.masters.labCover.some(function(x){return x.id===' + JSON.stringify(id) + '&&x.ended;})'));
}

/* 6. the screen */
{
  const c = app('Plant Manager', 'fahim', 'Fahim Asghar'); withCert(c, 'reviewed');
  run(c, 'state.screen="qc"; qcTab="review"; render();');
  ok('the Lab screen offers the Plant Manager "Leave cover"', /openLabCover\(\)/.test(run(c, 'document.getElementById("view").innerHTML')));
  run(c, 'openLabCover()');
  const m = run(c, 'document.getElementById("modal").innerHTML');
  ok('the cover screen explains the 2-person rule', /cannot approve a certificate (he|they) reviewed/i.test(m), m.slice(0, 300));
  as(c, 'Lab Rep', 'awais', 'Awais Ali');
  run(c, 'state.screen="qc"; render();');
  ok('a Lab Rep is not offered it', !/openLabCover\(\)/.test(run(c, 'document.getElementById("view").innerHTML')));
}

/* 7. two covers saved in the same moment are two records (found by check 5:
   the id was the clock alone, so ending one ended the other) */
{
  const c = app('Plant Manager', 'fahim', 'Fahim Asghar');
  run(c, `labSetCover("QCM","masab","${today()}","${day(2)}"); labSetCover("AQCM","awais","${today()}","${day(2)}");`);
  const ids = run(c, 'labCoverList().map(function(x){return x.id;})');
  ok('2 covers, 2 different ids', ids.length === 2 && ids[0] !== ids[1], JSON.stringify(ids));
}

/* 8. Tahir, 24 Sep: "Should I remove the COO's ability to sign certificates, yes".
   ISO: management does not sign. The COO kept every signature through hardRole()
   (the COO passes every role check). Now the 3 lines of a certificate - analysed,
   reviewed, approved - are the lab's alone. Assigning, reassigning, rejecting and
   superseding are not signatures and stay with the COO as before. */
{
  const c = app('COO', 'tahir', 'Tahir Abbas'); withCert(c, 'analysed');
  run(c, 'coaForm={bid:"B-COV",lid:""}; coaReview()');
  eq('the COO cannot review a certificate', B(c).coa.status, 'analysed');
  run(c, 'state.batches.find(function(b){return b.id==="B-COV";}).coa.status="reviewed"; state.batches.find(function(b){return b.id==="B-COV";}).coa.reviewer={name:"Masab Khan",user:"masab",role:"AQCM",date:"x"}; coaForm={bid:"B-COV",lid:""}; coaApprove()');
  eq('the COO cannot approve a certificate', B(c).coa.status, 'reviewed');
  run(c, 'coaForm=JSON.parse(JSON.stringify(state.batches.find(function(b){return b.id==="B-COV";}).coa)); coaForm.bid="B-COV"; coaForm.lid=""; renderCOAModal();');
  ok('the certificate sheet offers the COO no Approve button', !/coaApprove\(\)/.test(run(c, 'document.getElementById("coaFS").innerHTML')));
  run(c, 'state.screen="qc"; qcTab="review"; render();');
  ok('nor does the Lab screen', !/Approve \(QCM\)/.test(run(c, 'document.getElementById("view").innerHTML')));
  const d = app('COO', 'tahir', 'Tahir Abbas'); withCert(d, 'draft', { analyst: { name: '' }, tests: [{ test: 'K2O', spec: '>=44', result: '45', remark: 'FIT' }], qcNo: 'Q', sampledBy: 'x', sampleQty: 'x', analysisTime: 'x', temp: '1', humidity: '1' });
  run(d, 'coaForm=JSON.parse(JSON.stringify(state.batches.find(function(b){return b.id==="B-COV";}).coa)); coaForm.bid="B-COV"; coaForm.lid=""; coaForm.analyst={name:"Tahir Abbas"}; coaSubmitAnalyst();');
  eq('the COO cannot sign the analyst line either', B(d).coa.status, 'draft');
  ok('the benchSave refuses the COO', /state\.role==='Lab Rep'\|\|state\.role==='AQCM'\|\|state\.role==='QCM'\)\)\{ toast\('Lab only'\)/.test(grab('benchSave')));
  as(c, 'QCM', 'himayat', 'Himayat Hussain');
  run(c, 'coaForm={bid:"B-COV",lid:""}; coaApprove()');
  eq('the QCM still approves', B(c).coa.status, 'approved');
}

ok('BUILD_ID is 2026-09-24u or later', /BUILD_ID\s*=\s*'2026-09-(24[u-z]|2[5-9][a-z]|30[a-z])'/.test(html));
ok('the changelog tells the lab', /ver:'2026-09-24u'[\s\S]{0,900}cover/i.test(html));
process.exitCode = report('Leave cover for the lab sign-offs (24u)') ? 1 : 0;
