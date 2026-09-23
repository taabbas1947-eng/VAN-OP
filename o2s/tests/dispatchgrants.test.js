/* DISPATCH AND PROCUREMENT BECOME GRANT-DECIDED — 23 September 2026.

   Tahir's ruling, in his own words: "Saad has the right to dispatch, Shoaib also
   should have the right, but over time all dispatch-related documentation is the
   responsibility of the Senior Warehouse Officer. Their assistant is common for
   now and he can also do the dispatch and documentation, loading, truck etc. But
   for procurement, PO acknowledge, raw material checking - it's Saad's role."

   So the line is not between people, it is between two kinds of work:

     DISPATCH     plan a shipment, load a truck, issue a Gate Pass, confirm a
                  delivery. Saad (Lead Supply Chain), Shoaib (Senior Warehouse
                  Officer), Zain (Warehouse Assistant).
     PROCUREMENT  RM check, receive raw material, close a PR, acknowledge a PO.
                  Saad alone.

   The Plant Manager is in neither list. Later the same day: "Plant Manager is no
   more a cover. Saad becomes the authority to approve dispatch." And: "this is
   again a burden on Plant Manager, Saad should do, no one else - we will decide
   who is to cover later." Until a cover is named, the COO is the only fallback.

   Zain keeps dispatch - the assistant is shared for now. What he must not have is
   procurement, and that is exactly what the old rule could not express.

   WHY A TICK IN THE ACCESS MATRIX WOULD NOT DO IT. The first plan was to give the
   new Warehouse role `edit` on Shipments. Running the real gate showed that tick
   grants dispatch AND procurement, because a canEdit right asks
   `_canEditOn(state, role, state.screen, owners)` - the screen the person is
   STANDING ON, not the screen the job belongs to. A warehouse officer standing on
   Shipments could approve his own procurement.

   So the answer is not a tick. It is to make these rights live, so mayRole()
   reads the grant table instead of asking a screen:

       function mayRole(role,code){ if(role==='COO') return true;
         if(RIGHTS_LIVE[code]!==true) return mayLegacyRole(role,code);
         return roleRightsOf(role)[code]===true; }

   order.acknowledge is the odd one out: its legacy was `{kind:'all'}`, so
   literally every role in the system could acknowledge a PO. Narrowing it is the
   biggest single change here and the one most likely to block somebody who was
   quietly doing it. Because the grant table now decides, widening it again is one
   tick in Authorisation and no code change at all.

   WHAT THE FLIP COSTS, measured before it was chosen: the roles that hold one of
   these rights today only through a screen lose it - Production, Lab Rep, AQCM,
   QCM, QA Inspector, CFO and Finance. The COO had ALREADY refused `ship` edit to
   seven of them in the live access matrix, so for those the flip only makes his
   own decision stick everywhere instead of on one screen.

   Run: node dispatchgrants.test.js */
const H = require('./harness.js');
const fs = require('fs');
const vm = require('vm');
const STATE = JSON.parse(fs.readFileSync(H.STATE, 'utf8')).data;

let pass = 0, fail = 0; const fails = [];
function ok(n, c, x) { if (c) pass++; else { fail++; fails.push(n + (x ? '  [' + x + ']' : '')); } }
function eq(n, g, w) { ok(n, g === w, 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w)); }

const DISPATCH = ['shipment.plan', 'shipment.load', 'gatepass.issue', 'delivery.confirm'];
const PROC = ['rm.check', 'rm.receive', 'pr.close', 'order.acknowledge'];

/* ================= 1. WHAT IS LIVE, AND WHO IS GRANTED ================= */
{
  const live = H.grabTopVar('RIGHTS_LIVE', '{');
  DISPATCH.concat(PROC).forEach(c => ok(c + ' is in RIGHTS_LIVE', live.indexOf("'" + c + "'") > -1));
  const flat = H.html.replace(/\s+/g, ' ');
  ok('dispatch is granted to the three who do it',
     /var DISPATCH_GRANT=\{'Supply Chain':true,'Warehouse':true,'Supply Chain Officer':true\}/.test(flat));
  ok('procurement is Saad alone',
     /var PROCUREMENT_GRANT=\{'Supply Chain':true\}/.test(flat));
}

/* ================= 2. WHAT EACH ROLE CAN ACTUALLY DO ================= */
function blockAt(n, o) { const i = H.html.indexOf(n); return H.matchBlock(i, n, o); }
function makeBox() {
  const src = blockAt('const SCREENS=', '[').replace(/^const /, 'var ') + ';\n'
    + H.grabTopVar('DEPTS', '[') + H.grabTopVar('ROLE_DEPT', '{') + H.grabTopVar('RIGHTS', '[')
    + H.grabTopVar('RIGHTS_LIVE', '{') + H.grabTopVar('DISPATCH_LIVE', '[') + H.grabTopVar('DISPATCH_GRANT', '{')
    + H.grabTopVar('PROCUREMENT_LIVE', '[') + H.grabTopVar('PROCUREMENT_GRANT', '{') + '\n'
    + ['rightByCode', 'accessOv', '_ownerEdit', 'accessLevelOn', 'accessLevel', '_canEditOn',
       'mayLegacyRole', 'mayRole', 'rolesOfState', 'roleByName', 'roleIdOf', 'roleRightsOf',
       'seedAnswer', 'seedDeptRightsV1', 'seedTitlesV1', 'scr']
      .map(n => { try { return H.grab(n); } catch (e) { return ''; } }).join('\n\n');
  const box = {
    console, state: { role: 'COO', screen: 'ship', masters: JSON.parse(JSON.stringify(STATE.masters)) },
    _pe: v => String(v == null ? '' : v), ROLE_TITLE: {}, USER_TITLE: {}
  };
  box.globalThis = box;
  vm.createContext(box);
  vm.runInContext(src, box);
  box.state.masters.roles.push({ id: 'warehouse', name: 'Warehouse', deptId: 'supply-chain', builtin: false, archived: false });
  box.seedDeptRightsV1(box.state);
  return box;
}
{
  const box = makeBox();
  const R = box.RIGHTS.map(r => r.code);
  const canOn = (role, scr) => { box.state.screen = scr; return R.filter(c => box.mayRole(role, c)); };

  /* Everyone who dispatches, dispatches. */
  ['Supply Chain', 'Warehouse', 'Supply Chain Officer'].forEach(r => {
    const c = canOn(r, 'ship');
    DISPATCH.forEach(d => ok(r + ' can ' + d, c.indexOf(d) > -1, c.join(' ')));
  });

  /* THE CHECK THE WHOLE CHANGE EXISTS FOR: dispatch without procurement. */
  ['Warehouse', 'Supply Chain Officer'].forEach(r => {
    const c = canOn(r, 'ship');
    PROC.forEach(x => ok(r + ' can NOT ' + x + ' - not even standing on Shipments', c.indexOf(x) < 0, c.join(' ')));
    /* Nothing beyond dispatch, apart from one asymmetry recorded below. */
    eq(r + ' holds exactly the dispatch four and nothing else',
       c.slice().sort().join(' '), DISPATCH.slice().sort().join(' '));
  });

  /* Saad keeps both halves - he is the department. */
  const sc = canOn('Supply Chain', 'ship');
  PROC.forEach(c => ok('Supply Chain keeps ' + c, sc.indexOf(c) > -1, sc.join(' ')));

  /* The roles that held these only by standing somewhere. */
  ['Production', 'Lab Rep', 'AQCM', 'QCM', 'QA Inspector', 'CFO', 'Finance', 'Plant Manager'].forEach(r => {
    const c = canOn(r, 'ship');
    DISPATCH.concat(PROC).forEach(d => ok(r + ' can no longer ' + d, c.indexOf(d) < 0, c.join(' ')));
  });

  /* THE ASYMMETRY THIS SUITE FOUND, AND THE RULING THAT CLOSED IT.
     po.shortclose_request named eight roles, written before the Supply Chain
     split existed, and it left the Warehouse Assistant able to ask for a line to
     be closed short while the Senior Warehouse Officer above him could not.
     Reported rather than quietly patched, and Tahir ruled: "only 2 managers can
     ask for a short closure - Production Manager, Supply Chain Manager." */
  ['Supply Chain Officer', 'Warehouse', 'Production', 'CFO', 'Finance', 'Plant Manager'].forEach(r =>
    ok(r + ' can no longer ask for a short close', canOn(r, 'ship').indexOf('po.shortclose_request') < 0));
  ok('the Lead Supply Chain can', canOn('Supply Chain', 'ship').indexOf('po.shortclose_request') > -1);

  /* And the screen stops mattering, which is the point of going live. */
  ['approvals', 'prod', 'qc', 'qa', 'entry', 'reports'].forEach(scr =>
    ok('a QA Inspector cannot issue a Gate Pass from ' + scr, canOn('QA Inspector', scr).indexOf('gatepass.issue') < 0));
  ok('...nor can a Lab Rep from Lab QC', canOn('Lab Rep', 'qc').indexOf('gatepass.issue') < 0);
  ok('...and a Warehouse officer cannot run an RM check from My Actions',
     canOn('Warehouse', 'approvals').indexOf('rm.check') < 0);
}

/* ================= 3. THE SEED IS IDEMPOTENT AND NEVER OVERRULES THE COO ================= */
{
  const box = makeBox();
  const id = box.roleIdOf('Warehouse');
  box.state.masters.roleRights[id]['gatepass.issue'] = false;
  box.seedDeptRightsV1(box.state);
  eq('a COO refusal is never re-granted by the seed', box.state.masters.roleRights[id]['gatepass.issue'], false);
  box.state.screen = 'ship';
  ok('...and the refusal is what the gate answers', !box.mayRole('Warehouse', 'gatepass.issue'));

  /* Widening again is a grant, not a code change - the property that makes
     narrowing order.acknowledge a safe thing to do. */
  const fid = box.roleIdOf('Finance');
  box.state.masters.roleRights[fid]['order.acknowledge'] = true;
  ok('the COO can widen a right back with one tick', box.mayRole('Finance', 'order.acknowledge'));

  /* A role created later still gets a decided row - the seed is not behind a flag. */
  box.state.masters.roles.push({ id: 'loader', name: 'Loader', deptId: 'supply-chain', builtin: false, archived: false });
  box.seedDeptRightsV1(box.state);
  const lid = box.roleIdOf('Loader');
  DISPATCH.concat(PROC).forEach(c => eq('a brand-new role gets an explicit no for ' + c, box.state.masters.roleRights[lid][c], false));
}

/* ================= 4. THE DRIFT CARD STOPS REPORTING HISTORY ================= */
/* rightsFreezeCheck() answers "what would change if you flipped the rights still
   waiting". Before this change it compared EVERY right, live ones included, so
   the moment order.acknowledge went live it listed nine roles as drifting from a
   rule that no longer decides anything - for ever. A warning that is always on is
   a warning nobody reads. */
{
  const src = H.grab('rightsFreezeCheck');
  ok('the drift check skips rights that are already live', /RIGHTS_LIVE\[r\.code\]===true\) return;/.test(src));
  ok('...and says why, so it is not read as an oversight', /frozen\s*\n?\s*\*?\s*record|frozen/.test(src));
}

console.log('\nDispatch and procurement by grant, not by which screen you stand on: ' + pass + ' passed, ' + fail + ' failed');
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fail ? 1 : 0);
