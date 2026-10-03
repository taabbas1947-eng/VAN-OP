/* THREE PLACES, AND THE RULINGS THAT CAME WITH THEM — the night of 23 Sep 2026.

   Tahir answered 20 questions before sleeping. The ones this file pins:
     R1  the Orders view is for people who manage across orders
     R5  new orders: Finance (Ismaeel), the CFO, the COO — "not even Basit"
     R7  Back Office: COO, CFO, Plant Manager
     R9  customers move to Finance with the order (C3 + C9, one change)
     R12 the Warehouse role is created by the build, under Supply Chain
     R20 Majid keeps Reconciliation, loses Data Fix
     R22 Ismaeel's login moves to the role Finance — role only, never a password
     R23 nothing is ever deleted by the build

   The seeds are the thing under test: seedAccessV2 (the ruled matrix cells),
   seedCustomerRightsV1 (the two customer codes go live, granted to Finance and
   the CFO), seedWarehouseRoleV1 (the role), and their ORDER inside ensureState.
   Every seed is flagged so it runs once and the COO's later changes survive.

   Run: node threeplaces.test.js */
const H = require('./harness.js');
const vm = require('vm');
const fs = require('fs');
const { ok, eq, report, grab, grabTopVar, html } = H;
const STATE = JSON.parse(fs.readFileSync(H.STATE, 'utf8')).data;

function box(role) {
  const i = html.indexOf('const SCREENS=');
  const SCREENS_SRC = H.matchBlock(i, 'SCREENS', '[').replace(/^const /, 'var ') + ';';
  const b = { console, JSON, Date, state: { role: role || 'COO', screen: 'today', users: [],
              masters: JSON.parse(JSON.stringify(STATE.masters)) }, logged: [] };
  b.logAction = m => b.logged.push(m);
  b.globalThis = b; vm.createContext(b);
  vm.runInContext(SCREENS_SRC + '\n' + ['scr', 'accessOv', '_ownerEdit', 'accessLevel', 'screenEditOK', 'canView', 'hardRole'].map(grab).join('\n\n')
                  + '\n' + H.authModelSrc(), b);
  return b;
}
/* the app's order, copied from ensureState — pinned below so it cannot drift */
function seedLikeTheApp(b) { b.seedWarehouseRoleV1(b.state); b.seedAccessV2(b.state); b.seedDeptRightsV1(b.state); b.seedCustomerRightsV1(b.state); }

/* ================= 1. the order inside ensureState ================= */
const es = grab('ensureState');
ok('ensureState runs the Warehouse role seed BEFORE the grant seed (a never-answered cell is how it gets dispatch)',
   /seedWarehouseRoleV1\(s\); seedAccessV2\(s\);(?: seedAccessV3\(s\);)? seedDeptRightsV1\(s\); seedCustomerRightsV1\(s\);/.test(es));

/* ================= 2. the Warehouse role — R12 ================= */
{
  const b = box('COO');
  ok('setting up: the July state has no Warehouse role', !b.state.masters.roles.some(r => r.name === 'Warehouse'));
  seedLikeTheApp(b);
  const w = b.state.masters.roles.find(r => r.name === 'Warehouse');
  ok('the Warehouse role exists after the seed', !!w);
  eq('filed under Supply Chain', w && w.deptId, 'supply-chain');
  eq('with the id the title layer expects', w && w.id, 'warehouse');
  ['shipment.plan', 'shipment.load', 'gatepass.issue', 'delivery.confirm'].forEach(c =>
    eq('Warehouse holds ' + c, b.mayRole('Warehouse', c), true));
  ['rm.check', 'rm.receive', 'pr.close'].forEach(c =>
    eq('Warehouse does NOT hold procurement: ' + c, b.mayRole('Warehouse', c), false));
  ok('and it was logged', b.logged.some(l => /Warehouse/.test(l) && /Users & Access/.test(l)), JSON.stringify(b.logged));
  const n = b.state.masters.roles.length;
  seedLikeTheApp(b);
  eq('running the seed again creates nothing', b.state.masters.roles.length, n);
}

/* ================= 3. customers to Finance — R5 / R9 ================= */
{
  const b = box('COO'); seedLikeTheApp(b);
  eq('customer.create is live', b.RIGHTS_LIVE['customer.create'], true);
  eq('customer.amend is live', b.RIGHTS_LIVE['customer.amend'], true);
  ['customer.create', 'customer.amend'].forEach(c => {
    eq('Finance holds ' + c, b.mayRole('Finance', c), true);
    eq('the CFO holds ' + c, b.mayRole('CFO', c), true);
    eq('the KAM no longer holds ' + c, b.mayRole('KAM', c), false);
    eq('the Plant Manager does not hold ' + c, b.mayRole('Plant Manager', c), false);
  });
  ok('the seed is flagged so it runs once', !!b.state.masters._customerRightsV1);
  /* the COO's later change survives a reload */
  b.state.masters.roleRights['cfo']['customer.amend'] = false;
  b.seedCustomerRightsV1(b.state);
  eq("a later 'no' from the COO is not overwritten by the seed", b.state.masters.roleRights['cfo']['customer.amend'], false);
  /* the legacy record is untouched */
  const rt = b.RIGHTS.find(r => r.code === 'customer.create');
  eq('the frozen legacy record still says KAM-only', JSON.stringify(rt.legacy), JSON.stringify({ kind: 'hard', roles: ['KAM'] }));
}

/* ================= 4. the ruled matrix — R1, R5, R7, R20 ================= */
{
  const b = box('COO'); seedLikeTheApp(b);
  const lv = (r, sc) => b.accessLevel(r, sc);
  eq('Finance edits New PO Entry', lv('Finance', 'entry'), 'edit');
  eq('the CFO edits New PO Entry', lv('CFO', 'entry'), 'edit');
  eq('the KAM cannot open New PO Entry', lv('KAM', 'entry'), 'none');
  eq('the Plant Manager cannot open New PO Entry', lv('Plant Manager', 'entry'), 'none');
  eq('Finance edits Customer Master', lv('Finance', 'dealers'), 'edit');
  eq('the Plant Manager can look at Customer Master (Back Office is his too)', lv('Plant Manager', 'dealers'), 'view');
  eq('the KAM cannot open Customer Master', lv('KAM', 'dealers'), 'none');
  eq('Production cannot open Data Fix', lv('Production', 'datafix'), 'none');
  eq('the CFO edits Data Fix (Back Office)', lv('CFO', 'datafix'), 'edit');
  eq('Production cannot open Reconciliation', lv('Production', 'recon'), 'none');
  ['KAM', 'Lab Rep', 'QA Inspector', 'Production', 'Supply Chain Officer'].forEach(r => {
    ok(r + ' can read the PO Tracker (Report Center)', lv(r, 'tracker') !== 'none', lv(r, 'tracker'));
    ok(r + ' can read the Dashboard (Report Center)', lv(r, 'dash') !== 'none', lv(r, 'dash'));
    ok(r + ' can read Reports (Report Center)', lv(r, 'reports') !== 'none', lv(r, 'reports'));
  });
  ok('the seed is flagged so it runs once', !!b.state.masters._accessV2);
  b.state.masters.accessMatrix['KAM'].entry = { v: true, e: true };
  b.seedAccessV2(b.state);
  eq("a later change by the COO survives a reload", lv('KAM', 'entry'), 'edit');
  ok('and the seeding was logged', b.logged.some(l => /Access matrix/.test(l)), JSON.stringify(b.logged));
}

/* ================= 5. the account migration — R22, R23 ================= */
{
  const src = (() => { const i = html.indexOf('\nasync function migrateAccountsV1('); return i < 0 ? '' : H.matchBlock(i + 1, 'migrateAccountsV1'); })();
  ok('migrateAccountsV1 exists', src.length > 100);
  ok('it runs only for the COO', /state\.role!=='COO'\) return/.test(src));
  ok('it is flagged so it runs once', /_ismaeelRoleV1/.test(src));
  ok('it moves ONLY the login ismaeel', /username==='ismaeel'/.test(src));
  ok('it moves it only if the role is still Finance Desk Officer', /u\.role!=='Finance Desk Officer'/.test(src));
  ok("it sends name, username and role — and never a password", /body=\{name:u\.name,username:u\.username,role:'Finance'\}/.test(src) && !/password/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/No password touched/g, '')));
  ok('it never deletes anything', !/DELETE/.test(src));
  ok('it logs the move', /logAction\('Account ismaeel moved/.test(src));
  ok('doLogin calls it after the app is on screen', /renderApp\(\); startSync\(\);\s*try\{ migrateAccountsV1\(\); \}catch\(e\)\{\}/.test(html));
}

/* ================= 6. the sidebar ================= */
{
  const m = /\nconst NAV_GROUPS=\[/.exec(html);
  const nav = H.matchBlock(m.index + 1, 'NAV_GROUPS', '[');
  /* 23s: Today · Plant · Back Office · Guide. Report Center's screens (Orders, Reports) are links under Plant. */
  ok('exactly the groups Today, Plant, Back Office, Guide', /label:'Today'/.test(nav) && /label:'Plant'/.test(nav) && /label:'Back Office'/.test(nav) && /label:'Guide'/.test(nav) && !/Report Center/.test(nav) && !/Operations/.test(nav) && !/Insights/.test(nav) && !/Setup & admin/.test(nav));
  ok("'approvals' (My Actions) is not in the sidebar any more", !/'approvals'/.test(nav));
  ['prod', 'qc', 'qa', 'ship', 'entry'].forEach(id => ok("'" + id + "' is reached from a job, not the sidebar", !new RegExp("'" + id + "'").test(nav)));
  ok('but the screens still exist for the forms', ['prod', 'qc', 'qa', 'ship', 'entry', 'approvals'].every(id => new RegExp("\\{id:'" + id + "'").test(html)));
}

process.exitCode = report('Three places — the rulings of 23 Sep night') ? 1 : 0;
