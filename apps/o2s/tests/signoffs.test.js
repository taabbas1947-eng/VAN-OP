/* BUILD 2026-10-29a (trial). Sign-offs, Phase 1 (Tahir, 29 Oct 2026: "do phase 1 exactly as today"; D-341).
   Every gate that saves a signature asks maySign(action) from one table, SIGNOFF_RULES. This proves each gate answers
   EXACTLY as its old line did: the old conditions are copied here word for word and compared with maySign for every
   role, every leave cover and every way the access matrix can widen a gate.
   Run: node signoffs.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;
const pick = (start, end) => { const a = html.indexOf(start); if (a < 0) throw new Error('not found: ' + start); return html.slice(a, html.indexOf(end, a) + end.length); };

const ctx = { state: { role: '', screen: 'qa', masters: { accessMatrix: {} } }, covers: {} };
vm.createContext(ctx);
vm.runInContext(pick('var SIGNOFF_RULES={', '\n};') + '\n' + pick('var TRUCK_REVIEW_ROLES=', ';')
  + '\n' + grab('signoffRoles') + '\n' + grab('maySign') + '\n' + grab('hardRole') + '\n' + grab('canEdit') + '\n' + grab('accessOv')
  + '\nfunction labCovers(role){ return !!covers[role]; }', ctx);

/* the old conditions, word for word from the code before 29 Oct 2026 */
const OLD = {
  'coa.submit':    "state.role==='Lab Rep'",                                         // coaSubmitAnalyst: if(state.role!=='Lab Rep')
  'coa.bench':     "state.role==='Lab Rep'||state.role==='AQCM'||state.role==='QCM'", // benchSave
  'coa.review':    "state.role==='AQCM'||labCovers('AQCM')",                          // coaReview, coaSendBack isAQ
  'coa.approve':   "state.role==='QCM'||labCovers('QCM')",                            // coaApprove, coaSendBack isQM
  'inspection':    "canEdit(['QA Inspector'])||state.role==='COO'",                   // lotQASubmit, savePackInspect, dispQASubmit, openPackInspect, openDispatchQA
  'truck.review':  "hardRole(TRUCK_REVIEW_ROLES)",                                    // reviewTruck, sendBackTruck (review)
  'truck.release': "hardRole(['Plant Manager'])",                                     // approveRelease, sendBackTruck (release)
  'dc.approve':    "hardRole(['Plant Manager'])",                                     // approveDC
  'dc.reject':     "hardRole(['Supply Chain','Plant Manager'])"                       // rejectDC
};
ok('the table holds exactly the 9 gate rules', JSON.stringify(Object.keys(vm.runInContext('SIGNOFF_RULES', ctx)).sort()) === JSON.stringify(Object.keys(OLD).sort()));

const ROLES = ['KAM', 'Supply Chain', 'Production', 'Production Manager', 'Lab Rep', 'AQCM', 'QCM', 'QA Inspector', 'Plant Manager', 'CFO', 'COO',
  'Supply Chain Officer', 'Finance Desk Officer', 'Finance', 'Warehouse', 'Dispatch Clerk'];
const COVERS = [{}, { AQCM: 1 }, { QCM: 1 }, { AQCM: 1, QCM: 1 }];
/* the matrix can widen canEdit for the screen the person is on: Edit given, Edit taken, nothing set */
const MATRICES = role => [{}, { [role]: { qa: { v: true, e: true }, ship: { v: true, e: true } } }, { [role]: { qa: { v: true, e: false }, ship: { v: true, e: false } } }];
let cases = 0, diffs = [];
for (const action of Object.keys(OLD)) for (const role of ROLES) for (const cv of COVERS) for (const mx of MATRICES(role)) for (const screen of ['qa', 'ship']) {
  ctx.state = { role, screen, masters: { accessMatrix: mx } }; ctx.covers = cv;
  const was = !!vm.runInContext(OLD[action], ctx), now = !!vm.runInContext("maySign('" + action + "')", ctx); cases++;
  if (was !== now) diffs.push(action + ' · ' + role + ' · covers ' + JSON.stringify(cv) + ' · matrix ' + JSON.stringify(mx) + ' · ' + screen + ': was ' + was + ', now ' + now);
}
eq('every gate answers exactly as before (' + cases + ' cases: 9 gates × 16 roles × 4 covers × 3 matrices × 2 screens)', diffs.length, 0);
diffs.slice(0, 5).forEach(d => console.log('   ' + d));
ok('an unknown action is refused', vm.runInContext("maySign('no.such')", ctx) === false);

/* every write gate asks maySign, and no old condition is left in them */
const GATES = { coaSubmitAnalyst: 'coa.submit', coaReview: 'coa.review', coaApprove: 'coa.approve', benchSave: 'coa.bench',
  lotQASubmit: 'inspection', savePackInspect: 'inspection', dispQASubmit: 'inspection', openPackInspect: 'inspection', openDispatchQA: 'inspection',
  approveRelease: 'truck.release', approveDC: 'dc.approve', rejectDC: 'dc.reject', reviewTruck: 'truck.review' };
for (const [fn, action] of Object.entries(GATES)) ok(fn + ' asks maySign(\'' + action + '\') first', new RegExp("^\\s*(async\\s+)?function\\s+" + fn + "\\([^)]*\\)\\s*\\{\\s*if\\(!maySign\\('" + action.replace('.', '\\.') + "'\\)\\)").test(grab(fn)), grab(fn).slice(0, 110));
{ const sb = grab('coaSendBack');
  ok('coaSendBack: isAQ and isQM come from maySign', /var isAQ=maySign\('coa\.review'\), isQM=maySign\('coa\.approve'\);/.test(sb)); }
{ const tb = grab('sendBackTruck');
  ok('sendBackTruck: the review step asks maySign', /step==='review'&&!maySign\('truck\.review'\)/.test(tb));
  ok('sendBackTruck: the release step asks maySign', /step==='release'&&!maySign\('truck\.release'\)/.test(tb));
  ok('sendBackTruck: the loader self-check is unchanged', /step==='review'&&state\.role!=='COO'&&truckMadeByMe\(rows\)/.test(tb)); }
ok('no write gate still carries an old condition', !Object.keys(GATES).some(fn => /state\.role(!|=)==?'(Lab Rep|AQCM|QCM)'\s*(\||\))|hardRole\(\['Plant Manager'\]\)|hardRole\(TRUCK_REVIEW_ROLES\)|canEdit\(\['QA Inspector'\]\)\|\|state\.role==='COO'/.test(grab(fn).split('\n')[0])));
ok('the 2-person checks inside the COA gates are unchanged', /coaSamePerson/.test(grab('coaApprove')) && /labRanATest/.test(grab('coaApprove')));
/* Phase 2 (D-342): the lists are data. A list saved in masters.signoffs replaces the default, for the saves. */
{ const as = (role, signoffs, cv) => { ctx.state = { role, screen: 'qa', masters: { accessMatrix: {}, signoffs } }; ctx.covers = cv || {}; };
  const may = a => vm.runInContext("maySign('" + a + "')", ctx);
  as('Plant Manager', { 'coa.approve': ['Plant Manager'] }); ok('a role given "Approve a COA" may approve', may('coa.approve') === true);
  as('QCM', { 'coa.approve': ['Plant Manager'] }); ok('the role it was taken from may not', may('coa.approve') === false);
  as('Lab Rep', { 'coa.approve': ['Plant Manager'] }, { QCM: 1 }); ok("the QCM's named leave cover still signs for the QCM", may('coa.approve') === true);
  as('COO', { 'truck.release': ['Plant Manager'] }); ok('the COO taken off "Release a truck" may not release (no COO shortcut)', may('truck.release') === false);
  as('COO', {}); ok('with nothing saved the COO releases, as before', may('truck.release') === true);
  as('Warehouse', { 'dc.reject': ['Warehouse'] }); ok('a list role is enough for the list rules', may('dc.reject') === true);
  as('COO', { inspection: ['QA Inspector'] }); ok('the COO taken off "Inspect" may not inspect', may('inspection') === false);
  as('KAM', { inspection: ['QA Inspector', 'KAM'] }); ctx.state.masters.accessMatrix = { KAM: { qa: { v: true, e: false } } };
  ok('an inspection role still follows the screen rule (Edit taken on the screen: refused)', may('inspection') === false);
  as('Production', { 'truck.review': [] }); ok('an empty saved list refuses everyone', may('truck.review') === false);
  vm.runInContext(grab('soRole') + '\n' + grab('soAlso'), ctx);
  as('x', { 'coa.approve': ['COO', 'Plant Manager', 'QCM'] });
  ok('a Today job goes to the first role in the list that is not the COO', vm.runInContext("soRole('coa.approve')", ctx) === 'Plant Manager');
  ok('and is also seen by every other role in the list', JSON.stringify(vm.runInContext("soAlso('coa.approve')", ctx)) === '["COO","Plant Manager","QCM"]'); }
/* the buttons and the Today jobs ask the same lists as the saves */
{ ok('COA window and Lab list: Submit, Review and Approve buttons ask maySign', (html.match(/const isLab=maySign\('coa\.submit'\), isAQ=maySign\('coa\.review'\), isQM=maySign\('coa\.approve'\)/g) || []).length === 2);
  ok('the lab bench asks maySign', /ed=maySign\('coa\.bench'\)/.test(grab('openBench')));
  ok('the inspection buttons ask maySign (QA screen, Lab list, dispatch)', !/\(isQA\|\|isCOO\)/.test(html) && !/\(canEdit\(\['QA Inspector'\]\)\|\|state\.role==='COO'\)/.test(html));
  const sc = grab('shipCard');
  ok('the truck card: Review asks maySign, never a fixed role list', /maySign\('truck\.review'\)&&!\(state\.role==='COO'&&maySign\('truck\.release'\)\)&&!truckMadeByMe/.test(sc) && !/TRUCK_REVIEW_ROLES\.indexOf\(state\.role\)/.test(sc));
  ok('the truck card: the COO who may release goes straight to Release, as before (review 29 Oct; approveRelease waives the wait for the COO)',
    /!_rv&&maySign\('truck\.review'\)&&!\(state\.role==='COO'&&maySign\('truck\.release'\)\)&&!truckMadeByMe/.test(sc) && /state\.role!=='COO'/.test(grab('approveRelease')));
  ok('the truck card: Release, Approve DC and Reject DC each ask their own sign-off', /maySign\('truck\.release'\)\?/.test(sc) && /maySign\('dc\.approve'\)\?'<button/.test(sc) && /maySign\('dc\.reject'\)\?'<button/.test(sc));
  const ai = grab('actionItems');
  ['inspection', 'coa.submit', 'coa.review', 'coa.approve', 'truck.review', 'truck.release', 'dc.approve'].forEach(a =>
    ok('Today: the ' + a + ' job goes to the roles in its list', new RegExp("role:soRole\\('" + a.replace('.', '\\.') + "'\\),alsoRoles:soAlso\\('" + a.replace('.', '\\.') + "'\\)").test(ai)));
  ok('Today: no sign-off job names a fixed role any more', !/role:'(QA Inspector|AQCM|QCM)'/.test(ai) && !/role:'Lab Rep',(who|batch)/.test(ai));
  ok('who holds a sign-off (2-person rules, the Guide) follows the lists, with no COO shortcut', /signoffRoles\(a\)\.indexOf\(role\)>=0/.test(grab('holdsSignoff')) && !/role==='COO'/.test(grab('holdsSignoff'))); }
report('29a: sign-off gates in one table, exactly as before');
