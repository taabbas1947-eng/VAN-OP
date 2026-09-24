/* THE LAB, AS THE LAB WORKS — 24 September 2026 (build 24r).

   At the team briefing the QC manager said O2S gives one analyst a whole sample,
   and that is not how the lab works: he allocates by PARAMETER. One analyst does
   pH on every sample that comes in, another does potash; an analyst stays at one
   instrument instead of walking between several. The lab keeps a manual register
   of who tested which parameter. And a sample late in testing escalated after 1
   day whatever the product, although some tests take 1.5 hours and some 29.

   He gave Tahir 2 documents:
     QCL-FRM-19.01 Assignment, Summary & Review Form (Rev 02, 15/02/2025) - per
       sample: assigned by, product, batch/lot, QC#, assigned date/time, due
       date/time, container type, nature of sample; per parameter: assigned to,
       parameter, initials/date, result, result date, remarks; reviewed/verified.
     Estimated Time For Test Report - 31 parameters, each 30 min sampling + test
       time + 30 min reporting.

   Tahir's rulings, 24 Sep:
     - each test pre-filled with its usual analyst; the QCM confirms or changes
     - due times in clock hours
     - a test past due goes to the QCM; a sample still not done a day after it
       was due goes to the Plant Manager
     - everything in one release

   How it is built, so that nothing breaks:
     - OFF until the COO switches it on (Lab screen). A certificate the lab had
       already started stays in the old flow for good. Switching off again does
       not strand a sample assigned in the new flow.
     - a sample in the new flow carries coa.flow='v2'. Review, approval,
       UNFIT, deviation, printing and supersede are the SAME code as before.
     - a product's time is not typed anywhere: each test has its time, tests run
       side by side, so the sample is due when its longest test is due.

   Run: node labassign.test.js */
const H = require('./harness.js');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { ok, eq, report, grab, grabTopVar, html } = H;

const STATE = JSON.parse(fs.readFileSync(H.STATE, 'utf8')).data;
const BLOCKS = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
function has(name) { try { grab(name); return true; } catch (e) { return false; } }

/* ================= 1. the times, from the QCM's document ================= */
let T = null;
try { const box = {}; vm.createContext(box); vm.runInContext(grabTopVar('LAB_TEST_TIMES', '['), box); T = box.LAB_TEST_TIMES; } catch (e) { T = null; }
ok('LAB_TEST_TIMES exists', Array.isArray(T));
if (Array.isArray(T)) {
  const m = n => (T.find(x => x.name === n) || {}).mins;
  eq('31 parameters, as on the document', T.length, 31);
  eq('pH: 30 + 30 + 30 min = 90', m('pH'), 90);
  eq('Nitrogen: 7 hours', m('Nitrogen'), 420);
  eq('Potash: 2 hours', m('Potash'), 120);
  eq('Phosphate (Normal): 27 hours', m('Phosphate (Normal)'), 1620);
  eq('Phosphate (Urgent): 4 hours', m('Phosphate (Urgent)'), 240);
  eq('Humic Acid Liquid: 29 hours, the longest', m('Humic Acid Liquid'), 1740);
  eq('Particle Size: 30 + 45 + 30 = 1 h 45 min (the sheet printed "1.45 Hours")', m('Particle Size'), 105);
  eq('Moisture (Karl Fischer): 2.5 hours', m('Moisture (Karl Fischer)'), 150);
  eq('Hardness: 4 hours', m('Hardness'), 240);
  ok('spellings corrected: Elemental, Magnesium, Iron (Fe), Fluoride',
    !!m('Elemental Sulfur') && !!m('Magnesium') && !!m('Iron (Fe)') && !!m('Fluoride'));
  ok('every parameter has a positive time', T.every(x => x.mins > 0));
}

/* ================= 2. a template test name suggests its parameter ================= */
if (has('labSuggestParam')) {
  const box = { console }; vm.createContext(box); vm.runInContext(grab('labSuggestParam'), box);
  const s = (t, f) => box.labSuggestParam(t, f);
  eq('N → Nitrogen', s('N'), 'Nitrogen');
  eq('Nitrogen → Nitrogen', s('Nitrogen'), 'Nitrogen');
  eq('K2O → Potash', s('K2O'), 'Potash');
  eq('P2O5 → Phosphate (Normal)', s('P2O5'), 'Phosphate (Normal)');
  eq('pH (1% sol.) → pH', s('pH (1% sol.)'), 'pH');
  eq('Moisture → Moisture (Drying)', s('Moisture'), 'Moisture (Drying)');
  eq('Physical Status → Physical', s('Physical Status'), 'Physical');
  eq('Color → Physical', s('Color'), 'Physical');
  eq('HA on a liquid → Humic Acid Liquid', s('HA', 'Liquid'), 'Humic Acid Liquid');
  eq('HA on a solid → Humic Acid Solid', s('HA', 'Powder'), 'Humic Acid Solid');
  eq('MgO → Magnesium', s('MgO'), 'Magnesium');
  eq('Zn → Zinc', s('Zn'), 'Zinc');
  eq('Amino N → Amino Acid', s('Amino N'), 'Amino Acid');
  eq('OM → Organic Matter', s('OM'), 'Organic Matter');
  eq('Density → Density', s('Density'), 'Density');
  eq('S is ambiguous (elemental or sulfate) - left for the QCM', s('S'), '');
  eq('an unknown name is left for the QCM', s('Chloride as NaCl'), '');
} else ok('labSuggestParam exists', false);

/* ================= 3. the whole flow, in the real app ================= */
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
const NEWB = { id: 'B-LAB1', batchNo: 'VN26999', base: 'VL-NPK', brand: 'VL-NPK', kind: 'bulk', status: 'closed',
  openedDate: '2026-09-24', closedDate: '2026-09-24', plannedKg: 1000, producedKg: 1000, packedKg: 0, disposedKg: 0, lots: [] };
const TPL = [{ g: 'Physical', test: 'Physical Status', spec: 'Liquid', method: 'Visual', mu: '-' },
             { g: 'Chemical', test: 'pH (1% sol.)', spec: '5-7', method: 'pH meter', mu: '0.1' },
             { g: 'Chemical', test: 'N', spec: '>=10', method: 'Kjeldahl', mu: '0.5' }];
function withBatch(c, coa) {
  c.__nb = JSON.parse(JSON.stringify(NEWB)); if (coa) c.__nb.coa = coa;
  c.__tpl = JSON.parse(JSON.stringify(TPL));
  run(c, 'state.batches.push(__nb); state.masters=state.masters||{}; state.masters.labTemplates=state.masters.labTemplates||{}; state.masters.labTemplates["VL-NPK"]=__tpl;');
}
const items = (c, pred) => run(c, 'actionItems()').filter(it => it.batch && it.batch.id === 'B-LAB1').filter(pred || (() => true));
const labels = c => items(c).map(it => it.label).join(',');
const B = c => run(c, 'state.batches.find(function(b){return b.id==="B-LAB1";})');

ok('the flow functions exist', ['labFlowOn', 'labSetFlow', 'openLabAssign', 'labAssignConfirm', 'openBench', 'benchSave', 'printLabAssign', 'labParamsList'].every(has));

/* 3a. switched off: nothing changes */
{
  const c = app('COO', 'tahir', 'Tahir Abbas'); withBatch(c);
  eq('off: a new sample is the old "Lab QC" job', labels(c), 'Lab QC');
  eq('off: addressed to the Lab Rep role, as before', items(c)[0].role, 'Lab Rep');
}

/* 3b. only the COO switches it */
{
  const c = app('QCM', 'himayat', 'Himayat Hussain'); withBatch(c);
  try { run(c, 'labSetFlow(true)'); } catch (e) {}
  ok('the QCM cannot switch the new flow on', !run(c, 'labFlowOn()'));
  as(c, 'COO', 'tahir', 'Tahir Abbas'); run(c, 'labSetFlow(true)');
  ok('the COO can', run(c, 'labFlowOn()') === true);
  eq('on: a new sample is one "Assign sample" job', labels(c), 'Assign sample');
  eq('...for the QCM', items(c)[0].role, 'QCM');
}

/* 3c. a certificate the lab had already started stays old */
{
  const c = app('COO', 'tahir', 'Tahir Abbas');
  withBatch(c, { status: 'draft', tests: [{ test: 'pH', spec: '5-7', result: '6', remark: 'FIT' }], analyst: { name: '' } });
  run(c, 'labSetFlow(true)');
  eq('on, but a draft started before: still the old "Lab QC" job', labels(c), 'Lab QC');
}

/* 3d. the QCM assigns */
const c = app('COO', 'tahir', 'Tahir Abbas'); withBatch(c); run(c, 'labSetFlow(true)');
as(c, 'Lab Rep', 'awais', 'Awais Ali');
run(c, 'openLabAssign("B-LAB1","")');
ok('a Lab Rep cannot open the assignment for editing', !run(c, 'labAsg && labAsg.edit'));
as(c, 'QCM', 'himayat', 'Himayat Hussain');
run(c, 'openLabAssign("B-LAB1","")');
ok('the QCM opens it', !!run(c, 'labAsg && labAsg.edit'));
eq('it carries the 3 template tests', run(c, 'labAsg.rows.length'), 3);
eq('Physical Status suggested as Physical', run(c, 'labAsg.rows[0].param'), 'Physical');
eq('pH (1% sol.) suggested as pH', run(c, 'labAsg.rows[1].param'), 'pH');
eq('N suggested as Nitrogen', run(c, 'labAsg.rows[2].param'), 'Nitrogen');
ok('the assignment form is drawn with the QCL-FRM-19.01 fields', /Container type/.test(run(c, 'document.getElementById("modal").innerHTML')) && /Nature of sample/.test(run(c, 'document.getElementById("modal").innerHTML')));
run(c, 'labAsg.temp="25"; labAsg.humidity="40"; labAsg.container="Bottle"; labAsg.nature="Liquid";');
run(c, 'labAsg.rows[0].to="awais"; labAsg.rows[1].to="awais";');
run(c, 'labAssignConfirm()');
ok('a test with no analyst is refused', /analyst/i.test(run(c, 'toasts.join("|")')) && !B(c).coa);
run(c, 'labAsg.rows[2].to="mubeen"; toasts=[]; labAssignConfirm()');
{
  const co = B(c).coa;
  ok('assigned: the sample now has a certificate in the new flow', co && co.flow === 'v2', JSON.stringify(co && co.flow));
  eq('...still a draft', co && co.status, 'draft');
  ok('...assigned by the QCM, with the time', co && co.assign && co.assign.by && co.assign.by.user === 'himayat' && !!co.assign.at);
  eq('...container and nature recorded', co && (co.assign.container + '/' + co.assign.nature), 'Bottle/Liquid');
  ok('...the certificate header is filled (the fields the old submit required)', co && co.sampledBy && co.sampleQty && co.temp === '25' && co.humidity === '40' && co.analysisTime && co.qcNo);
  const at = Date.parse(co.assign.at);
  eq('pH due 90 min after assignment', Date.parse(co.tests[1].due) - at, 90 * 60000);
  eq('Nitrogen due 7 hours after', Date.parse(co.tests[2].due) - at, 420 * 60000);
  eq('the sample is due when its longest test is due', co.dueAt, co.tests[2].due);
  eq('each test names its analyst', co.tests.map(r => r.to).join(','), 'awais,awais,mubeen');
  eq('the usual analyst is remembered per parameter', run(c, 'state.masters.labUsual.Nitrogen'), 'mubeen');
  eq('the parameter is remembered for this product\'s test', run(c, 'state.masters.labParamOf["VL-NPK|n"]'), 'Nitrogen');
}

/* 3e. the jobs are per analyst, per test */
{
  const li = items(c);
  eq('3 "Lab test" jobs, nothing else', li.map(i => i.label).join(','), 'Lab test,Lab test,Lab test');
  eq('...each for the person it was assigned to', li.map(i => i.who).join(','), 'awais,awais,mubeen');
  as(c, 'Lab Rep', 'awais', 'Awais Ali');
  const mine = run(c, 'tdItems()').filter(it => it.batch && it.batch.id === 'B-LAB1');
  eq("Awais's Today holds his 2 tests, not Mubeen's", mine.length, 2);
  const g = run(c, 'tdGroups(tdItems())').filter(g => /^test:/.test(g.key)).map(g => g.key).sort().join(',');
  ok('grouped by parameter (the bench), not by sample', /test:pH/.test(g) && /test:Physical/.test(g), g);
  const card = run(c, 'tdGroups(tdItems()).filter(function(g){return g.key==="test:pH";}).map(tdCardHTML).join("")');
  ok('the card opens the pH bench sheet', /openBench\(/.test(card) && /pH/.test(card), card.slice(0, 400));
  as(c, 'Lab Rep', 'mubeen', 'Mubeen Ahmad');
  eq("Mubeen's Today holds his 1", run(c, 'tdItems()').filter(it => it.batch && it.batch.id === 'B-LAB1').length, 1);
  as(c, 'QCM', 'himayat', 'Himayat Hussain');
  eq('nothing is escalated before it is due', run(c, 'tdItems()').filter(it => it.batch && it.batch.id === 'B-LAB1').length, 0);
}

/* 3f. late: the QCM hears first, then the Plant Manager */
{
  run(c, 'var _h=state.batches.find(function(b){return b.id==="B-LAB1";}).coa; _h.__keep=_h.tests[2].due; _h.tests[2].due=new Date(Date.now()-3600000).toISOString();');
  const late = items(c, it => it.label === 'Lab test' && it.who === 'mubeen')[0];
  const e = run(c, 'acEscalation')(late);
  ok('a test past its due time escalates to the QCM', e && e.to === 'QCM', JSON.stringify(e));
  as(c, 'QCM', 'himayat', 'Himayat Hussain');
  eq('...and it is on his Today', run(c, 'tdItems()').filter(it => it.batch && it.batch.id === 'B-LAB1').length, 1);
  ok('no Plant Manager job yet', !items(c, it => it.label === 'Lab late').length);
  run(c, 'var _h2=state.batches.find(function(b){return b.id==="B-LAB1";}).coa; _h2.__keepAt=_h2.dueAt; _h2.dueAt=new Date(Date.now()-25*3600000).toISOString();');
  const pm = items(c, it => it.label === 'Lab late');
  eq('a sample still not done a day after it was due: 1 Plant Manager job', pm.length, 1);
  eq('...addressed to the Plant Manager', pm[0] && pm[0].role, 'Plant Manager');
  run(c, 'var _h3=state.batches.find(function(b){return b.id==="B-LAB1";}).coa; _h3.tests[2].due=_h3.__keep; _h3.dueAt=_h3.__keepAt; delete _h3.__keep; delete _h3.__keepAt;');
}

/* 3g. the bench sheet */
{
  as(c, 'Lab Rep', 'awais', 'Awais Ali');
  run(c, 'openBench("pH")');
  const m = run(c, 'document.getElementById("modal").innerHTML');
  ok('the pH bench lists the sample', /VN26999/.test(m) && /benchSave\(/.test(m), m.slice(0, 300));
  run(c, 'benchSave("B-LAB1","",1,"6.2","")');
  let co = B(c).coa;
  eq('the result is kept', co.tests[1].result, '6.2');
  eq('the remark is worked out from the spec', co.tests[1].remark, 'FIT');
  ok('who entered it and when, by login', co.tests[1].doneBy && co.tests[1].doneBy.user === 'awais' && !!co.tests[1].doneAt);
  eq('still a draft while tests remain', co.status, 'draft');
  run(c, 'benchSave("B-LAB1","",0,"Liquid","FIT")');
  as(c, 'Lab Rep', 'mubeen', 'Mubeen Ahmad');
  run(c, 'benchSave("B-LAB1","",2,"12","")');
  co = B(c).coa;
  eq('the last result sends it to the AQCM', co.status, 'analysed');
  eq('the certificate names every analyst', co.analyst && co.analyst.name, 'Awais Ali, Mubeen Ahmad');
  eq('the next job is the AQCM review', labels(c), 'Review');
  run(c, 'benchSave("B-LAB1","",2,"13","")');
  eq('a finished test is not re-entered from the bench', B(c).coa.tests[2].result, '12');
}

/* 3h. 2 people on every certificate - now every analyst counts */
{
  as(c, 'AQCM', 'awais', 'Awais Ali');
  run(c, 'coaForm={bid:"B-LAB1",lid:""}; coaReview()');
  ok('someone who ran a test cannot review it', B(c).coa.status === 'analysed' && /drafted|tested/i.test(run(c, 'toasts.join("|")')));
  as(c, 'AQCM', 'masab', 'Masab Khan');
  run(c, 'coaForm={bid:"B-LAB1",lid:""}; coaReview()');
  eq('the AQCM who ran no test reviews it', B(c).coa.status, 'reviewed');
  as(c, 'QCM', 'mubeen', 'Mubeen Ahmad');
  run(c, 'coaForm={bid:"B-LAB1",lid:""}; coaApprove()');
  eq('someone who ran a test cannot approve it', B(c).coa.status, 'reviewed');
}

/* 3i. rejected: back to the analysts, results kept */
{
  as(c, 'QCM', 'himayat', 'Himayat Hussain');
  run(c, 'coaForm={bid:"B-LAB1",lid:""}; coaReject("reviewed")');
  const co = B(c).coa;
  eq('rejected to draft', co.status, 'draft');
  ok('every test goes back to its analyst', co.tests.every(r => !r.doneAt));
  ok('...with the results kept', co.tests[2].result === '12');
  eq('...so the 3 test jobs return', labels(c), 'Lab test,Lab test,Lab test');
  ok('...not a second assignment', !items(c, it => it.label === 'Assign sample').length);
}

/* 3j. the certificate sheet does not offer the old whole-sample submit */
{
  as(c, 'Lab Rep', 'awais', 'Awais Ali');
  run(c, 'openBatchCOA("B-LAB1","")');
  const fs2 = run(c, 'document.getElementById("coaFS").innerHTML');
  ok('no "Submit for review" on a sample in the new flow', !/coaSubmitAnalyst\(\)/.test(fs2));
  ok('the sheet says where results come from', /bench sheet/i.test(fs2));
}

/* 3k. the 19.01 form prints */
{
  run(c, 'printLabAssign("B-LAB1","")');
  const p = c.__printed.join('');
  ok('prints QCL-FRM-19.01', /QCL-FRM-19\.01/.test(p));
  ok('...with the assigned analysts and parameters', /Awais Ali/.test(p) && /Mubeen Ahmad/.test(p) && /Nitrogen/.test(p));
  ok('...and the container and nature of sample', /Bottle/.test(p) && /Liquid/.test(p));
}

/* 3l. an unassigned sample opened from anywhere goes to the assignment */
{
  const d = app('COO', 'tahir', 'Tahir Abbas'); withBatch(d); run(d, 'labSetFlow(true)');
  as(d, 'QCM', 'himayat', 'Himayat Hussain');
  run(d, 'openBatchCOA("B-LAB1","")');
  ok('the certificate sheet is not opened on an unassigned sample', !/Certificate of Analysis/.test(run(d, 'document.getElementById("coaFS").innerHTML')));
  ok('the assignment is', !!run(d, 'labAsg && labAsg.bid==="B-LAB1"'));
  /* switching off does not strand an assigned sample */
  run(d, 'labAsg.temp="25"; labAsg.humidity="40"; labAsg.rows.forEach(function(r){ r.to="awais"; }); labAssignConfirm();');
  as(d, 'COO', 'tahir', 'Tahir Abbas'); run(d, 'labSetFlow(false)');
  eq('switched off: an assigned sample keeps its test jobs', labels(d), 'Lab test,Lab test,Lab test');
}

/* 3m. supersede: a re-issue goes back to the QCM to assign */
{
  ok('the supersede of a new-flow certificate clears the assignment', /flow==='v2'[\s\S]{0,300}delete next\.assign/.test(html));
}

/* 3n. the Lab screen */
{
  const d = app('COO', 'tahir', 'Tahir Abbas'); withBatch(d); run(d, 'labSetFlow(true)');
  as(d, 'QCM', 'himayat', 'Himayat Hussain');
  run(d, 'state.screen="qc"; qcTab="awaiting"; render();');
  const v = run(d, 'document.getElementById("view").innerHTML');
  ok('the Lab screen offers the QCM "Assign" on the new sample', /openLabAssign\('B-LAB1'/.test(v), v.slice(0, 200));
  ok('...and the test times and analysts', /openLabSetup\(/.test(v));
  run(d, 'openLabSetup()');
  const m = run(d, 'document.getElementById("modal").innerHTML');
  ok('the setup lists the 31 test times', (m.match(/labTimeSet\(/g) || []).length === 31, (m.match(/labTimeSet\(/g) || []).length);
  run(d, 'labTimeSet("pH","2")');
  eq('the QCM can change a time (hours)', run(d, 'labParamsList().find(function(p){return p.name==="pH";}).mins'), 120);
  as(d, 'Lab Rep', 'awais', 'Awais Ali');
  run(d, 'labTimeSet("pH","3")');
  eq('a Lab Rep cannot', run(d, 'labParamsList().find(function(p){return p.name==="pH";}).mins'), 120);
}

/* 3o. found on the first browser walk-through */
{
  /* Vital Potash's template tests Moisture by Karl Fischer: that is the 2.5 h
     test, not the 5 h drying one */
  const d = app('COO', 'tahir', 'Tahir Abbas'); withBatch(d);
  run(d, 'state.masters.labTemplates["VL-NPK"].push({g:"Physical",test:"Moisture",spec:"<1%",method:"Karl Fischer",mu:"-"}); state.masters.labTemplates["VL-NPK"].push({g:"Physical",test:"Moisture",spec:"<1%",method:"Oven",mu:"-"}); labSetFlow(true);');
  as(d, 'QCM', 'himayat', 'Himayat Hussain'); run(d, 'openLabAssign("B-LAB1","")');
  eq('Moisture by Karl Fischer is suggested as Moisture (Karl Fischer)', run(d, 'labAsg.rows[3].param'), 'Moisture (Karl Fischer)');
  eq('Moisture by any other method stays Moisture (Drying)', run(d, 'labAsg.rows[4].param'), 'Moisture (Drying)');
  /* 2 rows of one sample map to the same test (Physical Status and Color are both
     "Physical"): the bench must say which is which */
  run(d, 'labAsg.temp="25"; labAsg.humidity="40"; labAsg.rows.forEach(function(r){ r.to="awais"; }); labAssignConfirm();');
  as(d, 'Lab Rep', 'awais', 'Awais Ali'); run(d, 'openBench("Moisture (Drying)")');
  const m = run(d, 'document.getElementById("modal").innerHTML');
  ok('the bench names the certificate test on each row', />Moisture</.test(m) && /Oven/.test(m), m.slice(0, 600));
}

/* ================= 4. it ships ================= */
ok('BUILD_ID is 2026-09-24r or later', /BUILD_ID\s*=\s*'2026-09-(24[r-z]|2[5-9][a-z]|30[a-z])'/.test(html));
ok('the changelog tells the lab', /ver:'2026-09-24r'[\s\S]{0,1200}(bench|parameter|test)/i.test(html));

process.exitCode = report('The lab, as the lab works (24r)') ? 1 : 0;
