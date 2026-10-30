/* BUILD 2026-10-27a. Tahir's rulings of 27 Oct 2026 (multiple choice):
   1) whoever changes a batch on a truck at Start loading does not review that truck (swapper only; the 2 hour rule is unchanged);
   2) a Stuck at packing job Supply Chain leaves undecided for 3 days also goes to the COO (alert too).
   Run: node audit27a.test.js */
const H = require('./harness.js');
const fs = require('fs');
const path = require('path');
const { ok, eq, report, grab, html } = H;
const vm = require('vm');

/* ---- 1. the swapper does not review ---- */
function run(role, user, rows, fn) {
  const toasts = [];
  const state = { role, currentUser: { name: user, username: user }, audit: [] };
  const src = ['hardRole', '_uRole', 'truckReadyForReview', 'truckSentBack', 'truckFixers', 'truckSwappers', 'truckMadeByMe', 'reviewTruck'].map(grab).join('\n') + '\n' + H.signoffSrc() + '\nreturn {reviewTruck:reviewTruck,truckMadeByMe:truckMadeByMe};';
  const m = new Function('state', 'toast', 'logAction', 'save', 'render', 'shipRowsOf', 'TRUCK_REVIEW_ROLES', 'closeModal', src)(state, t => toasts.push(t), () => {}, () => {}, () => {}, () => rows, ['Supply Chain', 'Warehouse'], () => {});
  if (fn === 'reviewTruck') m.reviewTruck('D1');
  return { toasts, rows, made: m.truckMadeByMe(rows) };
}
const mkRows = (loadedBy, gpBy, swaps) => [{ dispId: 'D1', dc: 'DC-1', stage: 'loading', gatePass: 'GP-1', qa: { pass: true }, loadedByUser: loadedBy, gatePassByUser: gpBy, batchChanges: swaps || [] }];
const reviewed = r => !!r.rows[0].scReview;

{ // Shoaib loaded and issued the gate pass, Saad swapped the batch in between: neither reviews
  const rows = () => mkRows('shoaib', 'shoaib', [{ user: 'saad', by: 'Saad Jamal', from: 'HG1', to: 'HG2', kg: 500, why: 'bags at the front' }]);
  let r = run('Supply Chain', 'saad', rows(), 'reviewTruck');
  ok('Saad changed the batch: he cannot review the truck', !reviewed(r) && /changed its batch/.test(r.toasts.join(' ')));
  r = run('Warehouse', 'shoaib', rows(), 'reviewTruck');
  ok('Shoaib loaded it: he cannot review either (unchanged)', !reviewed(r));
}
{ // Saad loaded and issued the gate pass; Shoaib swapped the batch at loading
  const rows = () => mkRows('saad', 'saad', [{ user: 'shoaib', by: 'Muhammad Shoaib', from: 'HG1', to: 'HG2', kg: 500, why: 'x x x x x' }]);
  let r = run('Warehouse', 'shoaib', rows(), 'reviewTruck');
  ok('Shoaib changed the batch on Saad\'s truck: he cannot review it', !reviewed(r) && /changed its batch/.test(r.toasts.join(' ')));
}
{ // a swap by a third person leaves the usual reviewers alone
  const rows = () => mkRows('shoaib', 'shoaib', [{ user: 'zain', by: 'Zain', from: 'a', to: 'b', kg: 1, why: 'xxxxx' }]);
  const r = run('Supply Chain', 'saad', rows(), 'reviewTruck');
  ok('someone else changed the batch: Saad reviews as before', reviewed(r));
}
{ // no swap, nothing changes
  const r = run('Supply Chain', 'saad', mkRows('shoaib', 'shoaib'), 'reviewTruck');
  ok('a truck with no batch change reviews as before', reviewed(r));
  ok('a truck with no batchChanges field at all is safe', run('Supply Chain', 'saad', [{ dispId: 'D1', dc: 'DC-1', stage: 'loading', gatePass: 'GP-1', qa: { pass: true }, loadedByUser: 'shoaib', gatePassByUser: 'shoaib' }], 'reviewTruck').rows[0].scReview);
  const sw = new Function(grab('truckSwappers') + '\nreturn truckSwappers;')();
  eq('truckSwappers lists every user who changed a batch', sw({ batchChanges: [{ user: 'a' }, { user: 'b' }, null, {}] }).join(','), 'a,b');
  eq('truckSwappers of nothing is empty', sw(null).length, 0);
}
{ // the COO is unchanged
  const r = run('COO', 'tahir', mkRows('saad', 'saad', [{ user: 'tahir' }]), 'reviewTruck');
  ok('the COO may still review', reviewed(r));
}
ok('the Review truck job hides from a swapper (notWho)', /concat\(truckFixers\(s\)\)\.concat\(truckSwappers\(s\)\)/.test(grab('actionItems')));
ok('the swap records who did it (user) in batchChanges', /row\.batchChanges=\(row\.batchChanges\|\|\[\]\)\.concat\(\[\{at:at,by:me\.by,user:me\.user/.test(grab('truckSwapBatch')));
ok('the Review step on the truck sheet also refuses a swapper', /step==='review'&&state\.role!=='COO'&&truckMadeByMe\(rows\)/.test(html));
ok('the 2 hour rule is untouched', /var TRUCK_REVIEW_HOURS=2;/.test(html) && /truckReviewLapsed\(r\)/.test(html));

/* ---- 2. Stuck at packing left 3 days goes to the COO ---- */
function esc(days, extra) {
  const s = { console, PL_LINE_STUCK_DAYS: 7, labLateBy: () => 0, acProduceStallDays: () => days, actTiming: () => ({ days }) };
  vm.createContext(s); vm.runInContext(grab('acEscalation'), s);
  return s.acEscalation(Object.assign({ label: 'Stuck at packing' }, extra || {}));
}
eq('day 0: nobody else is told', esc(0), null);
eq('day 2: nobody else is told', esc(2), null);
eq('day 3: the COO is told', (esc(3) || {}).to, 'COO');
eq('day 3 carries its days', (esc(3) || {}).days, 3);
eq('day 12: still the COO', (esc(12) || {}).to, 'COO');
eq('a null clock tells nobody', esc(null), null);
eq('a job held by a complaint tells nobody', esc(9, { cmpHeld: true }), null);
{ // a line waiting for the client has no Stuck at packing job at all
  const s = { PL_LINE_STUCK_DAYS: 7, STUCK_JOB_SINCE: '2026-10-15', lineWaitOver: () => '', fmt: x => String(x), unitOf: () => 'Kg', Math, Date, isNaN };
  vm.createContext(s); vm.runInContext(grab('plStuckJob'), s);
  const o = { id: 'O1', po: 'P1' }, l = { id: 'L1', brand: 'Enroot' };
  eq('a line waiting for the client gets no job, so nothing to escalate', s.plStuckJob(o, l, { waitClient: { until: '2026-11-01' }, days: 20, start: '2026-10-01' }, 100, 0), null);
  ok('a line stuck 8 days gets the job', !!s.plStuckJob(o, l, { days: 8, start: '2026-10-01', last: '', lastPo: '' }, 100, 0));
}
{ const n = fs.readFileSync(path.join(__dirname, '..', 'notify-routes.js'), 'utf8');
  ok('the alert server knows Stuck at packing escalates to the COO', /'Stuck at packing': 'COO'/.test(n.slice(n.indexOf('const ESC_TO'), n.indexOf('const O2S_ROLES'))));
  ok('...and the job itself is still Supply Chain\'s', /'Stuck at packing': \['Supply Chain'\]/.test(n)); }
ok('Today: the COO sees what escalates to him from other roles (existing path)', /e&&e\.to===role\) x\._escalated=true/.test(html));

/* ---- 3. the Guide and the change log ---- */
ok('change log 2026-10-27a exists', /ver:'2026-10-27a'/.test(html) && /A swapped truck, and a Stuck at packing job left undecided/.test(html));
ok('The Rules: whoever changes a batch cannot review that truck', /Whoever changes a batch on a truck <b>cannot review that truck<\/b>/.test(grab('guideRules')));
ok('The Rules: Stuck at packing goes to the COO after 3 days', /within <b>3 days<\/b> of the job coming, it also shows on the COO/.test(grab('guideRules')));
ok('My job: a New on 27 Oct (27a) note for every role touched', ['Supply Chain', 'Warehouse', 'Plant Manager', 'COO'].every(r => new RegExp("var _n27a=\\{[\\s\\S]*'" + r + "':").test(grab('guideMyJob'))));
ok('My job prints the 27a note', /New on 27 Oct \(27a\)/.test(grab('guideMyJob')));

process.exitCode = report('27a: a swapper does not review; Stuck at packing left 3 days goes to the COO') ? 1 : 0;
