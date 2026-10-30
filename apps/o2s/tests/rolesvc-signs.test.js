/* BUILD 2026-10-29a (trial). Sign-offs, Phase 2 (Tahir, 29 Oct 2026: "i want it to be dynamic list all sign off and check
   it for the roles"; COO "(a) Ticks like every role"; D-342). The roles service lists every sign-off for each role and
   writes the lists to masters.signoffs: only the admin's own changes, never an empty list, the 2-person rules checked.
   Runs the service against a store in memory. Run: node rolesvc-signs.test.js */
const H = require('./harness.js');
const fs = require('fs'), path = require('path');
const { ok, eq, report } = H;

const routes = {};
const app = { get: (p, ...h) => { routes['GET ' + p] = h[h.length - 1]; }, post: (p, ...h) => { routes['POST ' + p] = h[h.length - 1]; }, put: (p, ...h) => { routes['PUT ' + p] = h[h.length - 1]; } };
const roles = ['KAM', 'Supply Chain', 'Warehouse', 'Lab Rep', 'AQCM', 'QCM', 'QA Inspector', 'Plant Manager', 'COO'].map(n => ({ id: n.toLowerCase().replace(/ /g, '-'), name: n, deptId: 'd1', builtin: true }));
let data = { masters: { roles, departments: [{ id: 'd1', name: 'Plant', leadRoleId: 'coo' }], roleRights: {}, roleRightsSet: {}, accessMatrix: {}, _cooUnlockV1: { at: 'x' } }, actionLog: [] }, rev = 1;
const store = { getState: async () => ({ rev, data: JSON.parse(JSON.stringify(data)) }), setStateGuarded: async (r, d) => { if (r !== rev) return { conflict: true }; data = d; rev++; return {}; } };
const logs = [], held = { 'Plant Manager': 1, QCM: 1, AQCM: 1, 'Supply Chain': 1, COO: 1 };
require(path.join(__dirname, '..', 'o2s-rolesvc.js'))(app, { store, pdq: null, auth: null, fs, path,
  services: { isSystemAdmin: async () => true, logAccess: x => logs.push(x), holdersOf: async (m, r) => Array(held[r] || 0).fill({}) } });
async function call(m, p, body, params) {
  let out = { s: 200 }; const res = { status(c) { out.s = c; return this; }, json(j) { out.j = j; } };
  await routes[m + ' ' + p]({ body, params: params || {}, user: { u: 'tahir', n: 'Tahir Abbas' } }, res); return out;
}
const S = '/api/o2s/rolesvc';
const put = (key, signoffs, baseSignoffs) => call('PUT', S + '/roles/:key', { rights: [], base: [], signoffs, baseSignoffs }, { key });
const signsOf = async k => (await call('GET', S + '/roles')).j.roles.find(r => r.key === k).signoffs;

(async () => {
  const cat = (await call('GET', S + '/catalogue')).j;
  eq('the catalogue lists the 9 sign-off gates', (cat.signoffs || []).length, 9);
  ok('inspection says it also needs Edit on the screen', /needs Edit on the screen/.test(cat.signoffs.find(x => x.key === 'inspection').note));
  ok("approve says the QCM's leave cover also signs", /leave cover for the QCM/.test(cat.signoffs.find(x => x.key === 'coa.approve').note));
  const all = (await call('GET', S + '/roles')).j.roles;
  ok('the read-only "fixed" line is gone from every role', all.every(r => !('fixed' in r)));
  eq('with nothing saved, the COO signs what it signs today', JSON.stringify(await signsOf('COO')), '["inspection","truck.review","truck.release","dc.approve","dc.reject"]');
  eq('...and Warehouse reviews trucks', JSON.stringify(await signsOf('Warehouse')), '["truck.review"]');
  eq('...and Supply Chain reviews trucks and rejects a DC', JSON.stringify(await signsOf('Supply Chain')), '["truck.review","dc.reject"]');

  let r = await put('Plant Manager', ['truck.release', 'dc.approve', 'dc.reject', 'coa.approve'], ['truck.release', 'dc.approve', 'dc.reject']);
  eq('Plant Manager given "Approve a COA"', r.s, 200);
  eq('the list is written for that sign-off only', JSON.stringify(data.masters.signoffs), '{"coa.approve":["QCM","Plant Manager"]}');
  ok('the O2S action log says it', /Sign-offs changed from the platform Roles screen for Plant Manager: now signs Approve a COA/.test(data.actionLog[0].what));
  ok('the access log keeps before and after', logs.some(x => x.action === 'role.rights' && x.subject === 'role:Plant Manager' && x.after.signoffs.includes('coa.approve') && !x.before.signoffs.includes('coa.approve')));

  r = await put('AQCM', ['coa.bench', 'coa.review', 'coa.approve'], ['coa.bench', 'coa.review']);
  ok('AQCM may not approve: it reviews (2-person rule)', r.s === 400 && /cannot hold both "Review a COA" and "Approve a COA"/.test(r.j.error), r.j && r.j.error);
  r = await put('Lab Rep', ['coa.submit', 'coa.bench', 'coa.review'], ['coa.submit', 'coa.bench']);
  ok('Lab Rep may not review: it drafts (2-person rule)', r.s === 400 && /cannot hold both/.test(r.j.error), r.j && r.j.error);
  r = await put('COO', ['inspection', 'truck.review', 'truck.release', 'dc.approve', 'dc.reject', 'coa.review', 'coa.approve'], await signsOf('COO'));
  ok('the COO is exempt from the 2-person rules, as in O2S', r.s === 200, r.j && r.j.error);
  r = await put('COO', ['inspection', 'truck.review', 'truck.release', 'dc.approve', 'dc.reject'], await signsOf('COO'));

  r = await put('Plant Manager', ['truck.release', 'dc.approve', 'dc.reject'], ['truck.release', 'dc.approve', 'dc.reject']);
  ok('a screen that never showed a tick takes nothing away', r.s === 200 && (await signsOf('Plant Manager')).includes('coa.approve'));

  { const stale = await signsOf('Supply Chain');   // two admins: the second takes "Reject a DC" away while the first still shows it ticked
    await put('Supply Chain', stale.filter(a => a !== 'dc.reject'), stale);
    r = await put('Supply Chain', stale, stale);
    ok('an unchanged tick on a stale screen does not undo the other admin\'s change', r.s === 200 && !(await signsOf('Supply Chain')).includes('dc.reject'));
    await put('Supply Chain', stale, stale.filter(a => a !== 'dc.reject')); }
  r = await put('COO', ['inspection', 'truck.review', 'dc.approve', 'dc.reject'], ['inspection', 'truck.review', 'truck.release', 'dc.approve', 'dc.reject']);
  ok('the COO can be taken off "Release a loaded truck"', r.s === 200 && JSON.stringify(data.masters.signoffs['truck.release']) === '["Plant Manager"]');
  r = await put('Plant Manager', ['dc.approve', 'dc.reject', 'coa.approve'], ['truck.release', 'dc.approve', 'dc.reject', 'coa.approve']);
  ok('the last role on a sign-off cannot be unticked', r.s === 400 && /"Release a loaded truck" would have no role left/.test(r.j.error), r.j && r.j.error);

  held['Plant Manager'] = 0;
  r = await put('QCM', ['coa.bench'], ['coa.bench', 'coa.approve']);
  ok('taking it from QCM leaves only Plant Manager, which nobody holds: saved, with a warning', r.s === 200 && /Nobody holds a role that signs "Approve a COA/.test(r.j.warn || ''), r.j && (r.j.warn || r.j.error));
  held['Plant Manager'] = 1;

  r = await call('POST', S + '/roles', { label: 'Night Supervisor', department: 'd1', rights: [], signoffs: ['truck.release'] });
  ok('a new role can be given sign-offs as it is added', r.s === 200 && data.masters.signoffs['truck.release'].includes('Night Supervisor'));
  eq('an unknown sign-off is refused', (await put('COO', ['no.such'], [])).s, 400);
  { const was = JSON.stringify(data.masters.signoffs); await call('PUT', S + '/roles/:key', { rights: [], base: [] }, { key: 'COO' });
    eq('a save without sign-offs leaves the lists alone', JSON.stringify(data.masters.signoffs), was); }

  // what O2S then does with the list: maySign in the app reads the same masters.signoffs
  const vm = require('vm'), html = H.html, pick = (a, b) => { const i = html.indexOf(a); return html.slice(i, html.indexOf(b, i) + b.length); };
  const ctx = { state: { role: 'Plant Manager', screen: 'qa', masters: data.masters } };
  vm.createContext(ctx); vm.runInContext(pick('var SIGNOFF_RULES={', '\n};') + '\n' + pick('var TRUCK_REVIEW_ROLES=', ';') + '\n' + H.grab('signoffRoles') + '\n' + H.grab('maySign') + '\nfunction labCovers(){ return false; }', ctx);
  ok('in O2S the Plant Manager may now approve a COA', vm.runInContext("maySign('coa.approve')", ctx) === true);
  ctx.state.role = 'QCM'; ok('...and the QCM may not', vm.runInContext("maySign('coa.approve')", ctx) === false);
  report('29a: sign-off lists through the roles service (D-342)');
})();
