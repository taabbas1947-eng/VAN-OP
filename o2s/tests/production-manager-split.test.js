/* Production Manager / Production split - 27 Aug 2026.

   Real-world context, from Tahir: Abdul Majid is the Production Manager and
   department lead, wants oversight of every production-related process.
   Ali Raza and Jawad Naseer are Production Officers running the floor
   (open batch, allocate floor/shift, log outputs, packing) - identical to
   each other, different shifts on peak days. Until now all three shared one
   undifferentiated "Production" role.

   The COO's decisions, captured in this order:
     1. genuine two-role split - new "Production Manager" (Majid, department
        lead) vs existing "Production" (Ali Raza + Jawad Naseer, identical).
     2. Manager-only: void a shift's output, call a by-product / divert /
        rework, and Data Fix edit access (corrections move off the floor).
        Explicitly NOT manager-only: closing a batch (bulk or single) - the
        floor keeps that.
     3. production.void: BOTH Plant Manager and Production Manager keep it
        (a senior-override choice, not a full handover).

   This is NOT a code-only right split like Commercial/Supply Chain's: the
   RIGHTS_LIVE flip (see the block comment above var RIGHTS_LIVE in o2s.html)
   only makes the grant table authoritative and preserves today's answers
   unchanged. The SPLIT itself - Production Manager existing, holding these
   rights, being the department's lead, and Production losing the three
   manager-only ones - is live Admin configuration, done through the exact
   same addRole/setDeptLead/grant mechanism authmodel.test.js section 32
   already tests generically. This file runs that mechanism for the REAL
   role names and the REAL final grant, so the split itself has a check
   beyond "the mechanism works for some hypothetical role".

   Run: node production-manager-split.test.js */
const H = require('./harness.js');
const fs = require('fs');
const vm = require('vm');
const STATE = JSON.parse(fs.readFileSync(H.STATE, 'utf8')).data;

let pass = 0, fail = 0; const fails = [];
function ok(n, c, x) { if (c) pass++; else { fail++; fails.push(n + (x ? '  [' + x + ']' : '')); } }
function eq(n, g, w) { ok(n, g === w, 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w)); }

function mk() {
  const src = H.authModelSrc();
  const b = { console, JSON, Date,
    state: { role: 'COO', screen: 'admin', users: [],
             masters: JSON.parse(JSON.stringify(STATE.masters)) } };
  b.globalThis = b;
  vm.createContext(b);
  vm.runInContext(src, b);
  b.seedDeptRightsV1(b.state);   /* mirrors ensureState() running on every real load */
  Object.assign(b, { toasts: [], toast: m => b.toasts.push(m), saved: 0, save: () => { b.saved++; },
    render: () => {}, authRepaint: () => {}, logged: [], logAction: m => b.logged.push(m), $: () => null,
    _pe: x => String(x == null ? '' : x), _at: x => String(x == null ? '' : x),
    _roleById: id => b.state.masters.roles.find(r => r.id === id) });
  vm.runInContext(H.grab('setDeptLead'), b);
  return b;
}

const PROD_CODES = ['batch.open', 'production.enter', 'shift.log', 'packing.pack', 'packing.reconcile',
                     'batch.close', 'batch.close_bulk'];
const MGR_ONLY = ['byproduct.call', 'packing.divert', 'packing.rework'];
const VOID = 'production.void';

/* ================= 1. before anything: today's baseline, unchanged ================= */
{
  const b = mk();
  ok('Production department is still led by Production, before any change',
     b.deptLeadRole('production') === 'Production');
  PROD_CODES.concat(MGR_ONLY).forEach(c =>
    eq('baseline: Production holds ' + c, b.mayHere('Production', c), true));
  eq('baseline: Production cannot void a shift', b.mayHere('Production', VOID), false);
  eq('baseline: Plant Manager can void a shift', b.mayHere('Plant Manager', VOID), true);
  ok('baseline: Production Manager does not exist yet',
     !b.state.masters.roles.some(r => r.name === 'Production Manager'));
}

/* ================= 2. the COO creates the role - starts with nothing ================= */
{
  const b = mk();
  b.state.masters.roles.push({ id: 'production-manager', name: 'Production Manager',
    deptId: 'production', builtin: false, archived: false });
  b.seedDeptRightsV1(b.state);
  ok('the new role is filed in Production', b.roleDeptId('Production Manager') === 'production');
  ok('it is not yet the lead', b.isDeptLead('Production Manager') === false);
  PROD_CODES.concat(MGR_ONLY, [VOID]).forEach(c =>
    eq('a brand-new head starts with nothing: ' + c, b.mayHere('Production Manager', c), false));
  /* and the floor is untouched by his mere existence */
  PROD_CODES.concat(MGR_ONLY).forEach(c =>
    eq('Production is unaffected by the new role existing: ' + c, b.mayHere('Production', c), true));
}

/* ================= 3. the COO's exact grant, applied ================= */
function granted() {
  const b = mk();
  b.state.masters.roles.push({ id: 'production-manager', name: 'Production Manager',
    deptId: 'production', builtin: false, archived: false });
  b.seedDeptRightsV1(b.state);
  b.setDeptLead('production', 'production-manager');
  const pm = b.state.masters.roleRights['production-manager'];
  const pr = b.state.masters.roleRights[b.roleIdOf('Production')];
  /* the seven shared rights: both keep them (explicitly NOT manager-only) */
  PROD_CODES.forEach(c => { pm[c] = true; });
  /* the three the COO moved to Manager-only, revoked off the floor role */
  MGR_ONLY.forEach(c => { pm[c] = true; pr[c] = false; });
  /* void: Production Manager gets it too, Plant Manager KEEPS it (COO's
     explicit choice - not a full handover) */
  pm[VOID] = true;
  return b;
}
{
  const b = granted();
  ok('Production Manager is now the department lead', b.deptLeadRole('production') === 'Production Manager');
  ok('...and it was logged', b.logged.some(l => /Department lead: Production/.test(l) && /Production Manager/.test(l)));

  /* the seven shared rights: BOTH roles hold them */
  PROD_CODES.forEach(c => {
    eq('shared right, Production Manager holds ' + c, b.mayHere('Production Manager', c), true);
    eq('shared right, Production (officer) still holds ' + c, b.mayHere('Production', c), true);
  });

  /* the three manager-only rights: Manager yes, officer no */
  MGR_ONLY.forEach(c => {
    eq('manager-only, Production Manager holds ' + c, b.mayHere('Production Manager', c), true);
    eq('manager-only, Production (officer) no longer holds ' + c, b.mayHere('Production', c), false);
  });

  /* void: both heads, never the floor */
  eq('void: Production Manager holds it', b.mayHere('Production Manager', VOID), true);
  eq('void: Plant Manager still holds it (kept, not moved)', b.mayHere('Plant Manager', VOID), true);
  eq('void: the floor officer never does', b.mayHere('Production', VOID), false);

  /* nobody outside this got anything by accident */
  ['QA Inspector', 'KAM', 'Supply Chain', 'Lab Rep', 'CFO'].forEach(role =>
    PROD_CODES.concat(MGR_ONLY, [VOID]).forEach(c =>
      eq(role + ' still holds none of it: ' + c, b.mayHere(role, c), false)));

  /* the real gate agrees with the panel-facing check */
  PROD_CODES.concat(MGR_ONLY, [VOID]).forEach(c => {
    eq('mayRole agrees with mayHere for Production Manager: ' + c,
       b.mayRole('Production Manager', c), b.mayHere('Production Manager', c));
    eq('mayRole agrees with mayHere for Production: ' + c,
       b.mayRole('Production', c), b.mayHere('Production', c));
  });
}

/* ================= 4. Ali Raza and Jawad Naseer stay identical to each other ================= */
/* The two floor officers are not separate roles - they are two USERS on the
   same "Production" role. Nothing in this split gives one anything the other
   lacks; proving it means proving the ROLE'S rights are what decide it, not
   anything per-user. There is no per-user right override anywhere in may()/
   mayHere() - checked by reading the gate itself, not asserted from memory. */
{
  const mayHereSrc = H.grab('mayHere');
  const mayRoleSrc = H.grab('mayRole');
  ok('mayHere takes a role, not a user, and has no per-user branch',
     !/currentUser|username/.test(mayHereSrc), mayHereSrc);
  ok('mayRole takes a role, not a user, and has no per-user branch',
     !/currentUser|username/.test(mayRoleSrc), mayRoleSrc);
}

/* ================= 5. Data Fix access is a SEPARATE mechanism, untouched by any of this ================= */
/* "Corrections should be with manager" is the accessMatrix (screenEditOK),
   not the RIGHTS catalogue - confirmed by the actual gates in dfSubmitPacking
   and dfSubmitVoid, and proven NOT to move on its own just because production
   rights were granted/revoked above. */
{
  const b = granted();
  const dfSrc = H.grab('dfSubmitPacking') + H.grab('dfSubmitVoid');
  ok('Data Fix write path still gates on the access matrix, not a RIGHTS code',
     /screenEditOK\('datafix'\)/.test(dfSrc) && !/may\('data ?fix/.test(dfSrc));
  const before = b.state.masters.accessMatrix['Production'].datafix;
  ok('granting/revoking production rights above did not touch the Data Fix cell',
     JSON.stringify(before) === JSON.stringify(STATE.masters.accessMatrix['Production'].datafix));
}

console.log('\nProduction Manager / Production split: ' + pass + ' passed, ' + fail + ' failed');
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fail ? 1 : 0);
