/* BUILD 2026-10-30a (trial). Tahir, 28-29 Oct 2026 (platform docs/ROLES-DESIGN.md, the O2S step; D-350, R-049):
   people, logins, roles, rights, departments, leads and screen access are set by the System Administrator on the
   launcher, in People and access, and O2S reads the person's role from the server each time it opens.
   This runs the real functions from o2s.html in a sandbox: every writer must refuse BEFORE it changes anything, the
   People screen must render read only, and the start-up must take the role the server gives.
   Run: node accessmoved.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, report, grab, html } = H;

/* 1. every writer refuses and changes nothing */
const WRITERS = ['ppSave', 'addUser', 'delUser', 'openEditUser', 'saveEditUser', 'rightTick', 'amxSet', 'amxCycle',
  'setDeptLead', 'setRoleDept', 'addRole', 'renameRole', 'archiveRole', 'restoreRole'];
const state0 = () => ({ role: 'COO', currentUser: { name: 'Test COO', username: 'coo.test', role: 'COO' }, screen: 'admin',
  masters: { roles: [{ id: 'kam', name: 'KAM', deptId: 'commercial', builtin: true }, { id: 'clerk', name: 'Clerk', deptId: 'commercial', builtin: false }],
    roleRights: { kam: { 'order.create': true } }, roleRightsSet: {}, accessMatrix: { KAM: { entry: { v: true, e: true } } },
    departments: [{ id: 'commercial', name: 'Commercial', leadRoleId: 'kam' }] }, users: [{ username: 'a', name: 'A', role: 'KAM' }], actionLog: [], audit: [] });
const sb = { toasts: [], saves: 0, fetches: [], Math, Date, Object, JSON, Array, String, RegExp, Promise, console };
sb.toast = m => sb.toasts.push(String(m));
sb.save = () => { sb.saves++; }; sb.saveNow = async () => { sb.saves++; }; sb.render = () => {}; sb.authRepaint = () => {};
sb.logAction = () => {}; sb.fetch = async (u) => { sb.fetches.push(u); return { ok: true, json: async () => ({}) }; };
sb.$ = () => null; sb.prompt = () => 'New Name'; sb.confirm = () => true; sb.closeModal = () => {};
sb.screenEditOK = () => true; sb.ppCan = () => true; sb.canView = () => true; sb.accessLevel = () => 'edit';
vm.createContext(sb);
vm.runInContext(grab('accessMoved') + '\nvar ACCESS_MOVED_MSG=' + JSON.stringify((/var ACCESS_MOVED_MSG='([^']+)'/.exec(html) || [])[1] || '') + ';', sb);
ok('the one message names the System Administrator and the launcher', /System Administrator/.test(sb.ACCESS_MOVED_MSG) && /People and access/.test(sb.ACCESS_MOVED_MSG));
for (const w of WRITERS) {
  const src = grab(w);
  ok(w + ': its first statement is the accessMoved guard', /^\s*(async\s+)?function\s+\w+\([^)]*\)\s*\{\s*if\(accessMoved\(\)\) return;/.test(src), src.slice(0, 120));
  vm.runInContext(src, sb);
  sb.state = state0(); sb.toasts = []; sb.saves = 0; sb.fetches = [];
  const before = JSON.stringify(sb.state);
  const args = { ppSave: [], addUser: [], delUser: ['a'], openEditUser: ['a'], saveEditUser: [], rightTick: ['KAM', 'order.create', false],
    amxSet: ['KAM', 'entry', 'none'], amxCycle: ['KAM', 'entry', null], setDeptLead: ['commercial', 'clerk'], setRoleDept: ['clerk', 'commercial'],
    addRole: [], renameRole: ['clerk'], archiveRole: ['clerk'], restoreRole: ['clerk'] }[w];
  let threw = null; try { const r = sb[w].apply(null, args); if (r && r.then) r.catch(e => { threw = e; }); } catch (e) { threw = e; }
  ok(w + ': changes nothing, saves nothing, calls no server, and says why', !threw && JSON.stringify(sb.state) === before && sb.saves === 0 && sb.fetches.length === 0 && sb.toasts[0] === sb.ACCESS_MOVED_MSG, threw ? String(threw) : sb.toasts.join(' | '));
}

/* 2. the People screen is read only and points to the launcher */
{ const src = grab('screenPeople');
  const v = { innerHTML: '' }, s2 = { ACCESS_MOVED_MSG: sb.ACCESS_MOVED_MSG, $: id => (id === 'view' ? v : null), boBackHTML: () => '<back>', qsEsc: x => String(x), rolesTitlesCard: () => '<roles-and-titles>', ppCan: () => true, usersList: [], rolesList: () => [], state: state0() };
  vm.createContext(s2); vm.runInContext(src, s2); s2.screenPeople();
  ok('People shows the message, a link to the launcher and who holds which role', v.innerHTML.indexOf(sb.ACCESS_MOVED_MSG) >= 0 && /href="\/"/.test(v.innerHTML) && /<roles-and-titles>/.test(v.innerHTML));
  ok('People offers no change: no Add a person, no Save, no role picker', !/Add a person|ppSave|addUser|onchange=/.test(v.innerHTML)); }

/* 3. the Back Office desk sends changes to the launcher */
{ const desks = grab('boDesks');
  ok('the People desk: who holds which role, and Change on the launcher', /l:'Who holds which role'/.test(desks) && /l:'Change on the launcher',go:"location\.href='\/'"/.test(desks));
  ok('the People desk no longer offers Add a person or Move someone', !/l:'Add a person'/.test(desks) && !/l:'Move someone'/.test(desks)); }

/* 4. the role comes from the server when O2S opens */
{ const src = grab('roleFromServer');
  ok('bootState asks the server for the role before the first paint', /restoreSession\(\);\s*\r?\n\s*if\(!\(await roleFromServer\(\)\)\) return;/.test(grab('bootState')));
  const run = async (meRole, startRole) => {
    const shown = { auth: '', shell: '' }, s3 = { _token: 'x', authHdr: () => ({}), state: { role: startRole, currentUser: { role: startRole }, screen: 'admin' }, login: null,
      fetch: async () => ({ ok: true, json: async () => ({ o2sRole: meRole }) }),
      $: id => ({ style: { set display(v) { shown[id === 'authScreen' ? 'auth' : 'shell'] = v; } } }), renderLogin: m => { s3.login = m; } };
    vm.createContext(s3); vm.runInContext(src, s3); const r = await s3.roleFromServer(); return { r, s3, shown };
  };
  (async () => {
    const a = await run('COO', 'KAM');
    ok('a role given on People and access counts at once (KAM in the sign-in, COO on the server: COO)', a.r === true && a.s3.state.role === 'COO' && a.s3.state.currentUser.role === 'COO' && a.s3.state.screen === 'today');
    const b = await run(null, 'COO');
    ok('a role taken away: O2S does not open, and says who to ask', b.r === false && /System Administrator/.test(b.s3.login || '') && b.shown.shell === 'none');
    const c = await run('KAM', 'KAM');
    ok('the same role: nothing moves', c.r === true && c.s3.state.screen === 'admin');
    /* 5. the words */
    ok('Guide rule: Who sets your access (R-049)', /<h3>Who sets your access<\/h3>/.test(grab('guideRules')) && /'Who sets your access':'R-049'/.test(html));
    ok('Guide: no department lead hands out rights any more', !/A department lead can hand out the department/.test(grab('guideRules')));
    ok('a refused screen names the System Administrator', /This screen is not open to your role\. Ask your System Administrator\./.test(grab('setScreen')));
    ok('the rights refusals name the System Administrator, never "Ask the COO"', !/Ask the COO|only the COO can|by the COO\./.test(grab('grantRefusal')));
    ok('changelog 2026-10-30a and BUILD_ID', /ver:'2026-10-30a'/.test(html) && /var BUILD_ID='2026-10-30a'/.test(html));
    ok('System documentation: D-350', /"id":"D-350"/.test(html));
    /* 6. the COO is an ordinary role (D-351): no shortcut, and the one-time step gives it, as ticks, what it had */
    ['canEdit', '_canEditOn', 'mayRole', 'mayHere', 'accessLevelOn'].forEach(fn => ok(fn + ': no COO shortcut', !/role==='COO'\)\s*return/.test(grab(fn))));
    { const ctx = {}; vm.createContext(ctx);
      const pick = (start, end) => { const a = html.indexOf(start); return html.slice(a, html.indexOf(end, a) + end.length); };
      vm.runInContext(pick('var RIGHTS=[', '\n];') + '\n' + pick('var RIGHTS_LIVE={', '\n};') + '\n' + pick('const SCREENS=[', '\n];').replace('const SCREENS', 'var SCREENS') + '\n' + grab('cooUnlockV1')
        + '\nfunction accessOvNone(){}', ctx);
      const st = { masters: { roles: [{ id: 'coo', name: 'COO', builtin: true }, { id: 'kam', name: 'KAM' }], roleRights: { coo: { 'order.acknowledge': true }, kam: { 'order.create': true } }, roleRightsSet: {}, accessMatrix: { KAM: { entry: { v: true, e: false } } } } };
      ctx.st = st; vm.runInContext('cooUnlockV1(st)', ctx);
      const live = ctx.RIGHTS.filter(r => ctx.RIGHTS_LIVE[r.code] === true).map(r => r.code);
      ok('the step ticks every right in force for the COO (' + live.length + ')', live.every(c => st.masters.roleRights.coo[c] === true && st.masters.roleRightsSet.coo[c] === true));
      ok('and gives the COO Edit on every screen (' + ctx.SCREENS.length + ')', ctx.SCREENS.every(sc => st.masters.accessMatrix.COO[sc.id] && st.masters.accessMatrix.COO[sc.id].e === true && st.masters.accessMatrix.COO[sc.id].v === true));
      ok('another role is not touched', JSON.stringify(st.masters.roleRights.kam) === '{"order.create":true}' && JSON.stringify(st.masters.accessMatrix.KAM) === '{"entry":{"v":true,"e":false}}');
      const once = JSON.stringify(st); vm.runInContext('cooUnlockV1(st)', ctx);
      ok('it runs once (masters._cooUnlockV1)', JSON.stringify(st) === once && !!st.masters._cooUnlockV1);
      ok('it runs at load, after the 27d step', /dataFix27dV1\(s\); cooUnlockV1\(s\);/.test(html)); }
    report('29a: access set on the launcher, role from the server');
  })();
}
