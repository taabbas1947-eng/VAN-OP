/* REPORTS: a department lead sees at least his team's; "Your reports" card (12 Oct, 12d).
   Run: node reportsteam.test.js */
const H = require('./harness.js');
const { ok, eq, report, grab, grabTopVar, html } = H;
const cat = (() => { const m = /\nvar RP_CATALOGUE=\[/.exec(html); return H.matchBlock(m.index + 1, 'RP_CATALOGUE', '['); })();
const NAMES = { kam:'KAM','supply-chain':'Supply Chain',production:'Production','lab-rep':'Lab Rep',aqcm:'AQCM',qcm:'QCM','qa-inspector':'QA Inspector','plant-manager':'Plant Manager',cfo:'CFO',coo:'COO','supply-chain-officer':'Supply Chain Officer',finance:'Finance',warehouse:'Warehouse','production-manager':'Production Manager','finance-desk-officer':'Finance Desk Officer' };
const roles = Object.keys(NAMES).map(id => ({ id, name: NAMES[id] }));
function mk(role, leads, store, money) {
  const depts = JSON.parse(JSON.stringify(eval('(' + grabTopVar('DEPTS', '[').replace(/^var DEPTS=/, '').replace(/;$/, '') + ')')));
  Object.assign(depts.reduce((a, d) => (a[d.id] = d, a), {}), {});
  (leads || []).forEach(([d, r]) => { depts.filter(x => x.id === d)[0].leadRoleId = r; });
  const state = { role, currentUser: { name: 'u-' + role }, masters: { roles, departments: depts } };
  const localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
  const src = grabTopVar('DEPTS', '[') + grabTopVar('ROLE_DEPT', '{') + cat + ';\n' +
    ['deptById', 'rolesOfState', 'roleByName', 'roleIdOf', 'roleDeptId', 'deptLeadRole', 'isDeptLead', 'rolesInDept', 'rpDef', 'rpTeamMay', 'rpMay', 'rpVisible', 'rpRecentKey', 'rpRecentIds', 'rpNoteRecent', 'rpQuickList'].map(grab).join('\n') +
    '\nreturn {vis:rpVisible,quick:rpQuickList,note:rpNoteRecent,may:rpMay};';
  return new Function('state', 'mayMoney', 'INVOICE_ROLES', 'localStorage', src)(state, () => !!money, ['Finance'], localStorage);
}
const ids = (r, leads, money) => mk(r, leads, {}, money).vis().map(c => c.id);
const PL = [['production', 'production-manager']];

/* the QCM gets what the QA Inspector gets */
{ const q = ids('QCM'), i = ids('QA Inspector');
  ok('the QC Manager (quality lead) sees every report a QA Inspector sees', i.every(x => q.indexOf(x) > -1));
  ok('...including Packed waiting to ship and Stock moved between POs', q.indexOf('waiting') > -1 && q.indexOf('moves') > -1); }
/* production lead */
{ const pm = ids('Production Manager', PL), pf = ids('Production', PL), pfOld = ids('Production');
  ok('with the Production Manager as lead, he sees every report the Production role sees', pf.every(x => pm.indexOf(x) > -1));
  ok('the floor role Production does NOT gain the Production Manager\'s reports', pf.indexOf('moves') < 0 && pf.indexOf('rm') < 0);
  ok('the floor role Production sees Packed waiting to ship (Tahir, 13 Oct)', pf.indexOf('waiting') > -1);
  ok('(DEPENDENCY, pinned on purpose: if the floor role is the Production lead, the rule widens it to the manager reports. The COO set the Production Manager as lead live on 12 Oct; a fresh install seeds the floor role and needs the same Setup step)', pfOld.indexOf('moves') > -1);
  const pmOld = ids('Production Manager');
  ok('the Production Manager lost nothing', pmOld.every(x => pm.indexOf(x) > -1)); }
/* money still gated */
{ const f = ids('CFO', null, false);
  ok('a lead without the money right still does not see money reports', f.indexOf('sales') < 0 && f.indexOf('invoicing') < 0);
  ok('the Finance Desk Officer is not widened (not a lead)', ids('Finance Desk Officer').length === ids('Finance Desk Officer', PL).length); }
/* nobody else widens: non-lead roles identical with and without the rule */
{ const base = (r) => mk(r, null, {}, true).vis().map(c => c.id);
  const tm = grab('rpTeamMay');
  ok('rpTeamMay never opens a role-for-all report logic and is failure-safe', /c\.roles==='all'/.test(tm) && /catch\(e\)\{ return false; \}/.test(tm));
  const co = base('COO'); eq('the COO still sees all 21', co.length, 21);
  ['Warehouse', 'Lab Rep', 'AQCM', 'QA Inspector', 'Supply Chain Officer', 'Finance'].forEach(r => ok(r + ' (not a lead) gets nothing from the rule', mk(r, null, {}, true).vis().every(c => (c.roles === 'all') || c.roles.indexOf(r) > -1 || (c.id === 'invoicing' && r === 'Finance')))); }
/* Your reports card */
{ const st = {}; const a = mk('Warehouse', null, st);
  const d = a.quick().map(c => c.id);
  ok('no history: the card shows the job\'s own reports (up to 4), never Custom', d.length > 0 && d.length <= 4 && d.indexOf('custom') < 0 && d.every(x => ids('Warehouse').indexOf(x) > -1));
  a.note('docs'); a.note('trucks');
  const e = a.quick().map(c => c.id);
  ok('recent first, newest first', e[0] === 'trucks' && e[1] === 'docs');
  st['o2s_rp_recent_u-Warehouse'] = JSON.stringify(['invoicing', 'sales', 'trucks']);
  ok('a recent report the role may no longer open is dropped', a.quick().map(c => c.id).indexOf('invoicing') < 0);
  st['o2s_rp_recent_u-Warehouse'] = '{bad json';
  ok('broken storage falls back to the job\'s reports', a.quick().length > 0);
  const b = new Function('state', 'localStorage', grab('rpRecentKey') + grab('rpRecentIds') + grab('rpNoteRecent') + 'return {r:rpRecentIds,n:rpNoteRecent};')({ role: 'x', currentUser: { name: 'x' } }, { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } });
  b.n('docs'); ok('blocked storage never throws', Array.isArray(b.r())); }
ok('Reports home shows the card first, above the function cards', /var qk=rpQuickList\(\)/.test(grab('rpListHTML')) && /var cards=quick\+RP_GROUPS/.test(grab('rpListHTML')) && /Your reports/.test(grab('rpListHTML')));
ok('opening any report is remembered', /rpNoteRecent\(id\)/.test(grab('rpOpen')));
ok('rpMay still decides: money gate first, then COO, then roles, then the team rule', /return c\.roles==='all'\|\|\(c\.roles\|\|\[\]\)\.indexOf\(state\.role\)>-1\|\|rpTeamMay\(c\)/.test(grab('rpMay')) && grab('rpMay').indexOf('c.money') < grab('rpMay').indexOf('rpTeamMay'));
ok('the 12d changelog entry exists (BUILD_ID itself is pinned by buildid.test.js)', /ver:'2026-10-12d'/.test(html));
ok('Guide says which reports you can open', /<h3>Which reports you can open<\/h3>/.test(html) && /department lead<\/b>/.test(html) && /Your reports<\/b> card/.test(html));
process.exitCode = report('Reports: team rule and Your reports (12d)') ? 1 : 0;
