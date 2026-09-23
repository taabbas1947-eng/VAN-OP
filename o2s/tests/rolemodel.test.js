/* THE ROLE NAME IS THE JOIN KEY — 23 September 2026.

   Before the role model grows from the ten it shipped with to the twenty-one
   on HR's O2S onboarding list, this file writes down what the model does now,
   so the growth is visible instead of silent.

   Why it matters. A role in O2S is joined by its NAME, as a string, in three
   separate tables written by hand:

     SCREENS[].owners      — which screens the role can reach
     RIGHTS[].legacy.roles — what a right answers before it goes live
     FIELD_OWNER           — who owns a field on the PO

   and by its ID in a fourth (masters.roleRights, keyed by role id, deliberately
   — see the note above the grant table in o2s.html: renameRole changes the name
   in place and a name-keyed table would orphan the whole row).

   Nothing checks the spelling. Write 'Supply Chain officer' into a screen's
   owners and the app does not complain, does not log, does not warn: the role
   simply never matches, forever, and the person it was written for is locked
   out of a screen somebody believes they were given. That is the failure this
   file exists to catch, because it is the failure that scales with the number
   of roles — and we are about to more than double them.

   TWO CATEGORIES OF NAME, and the difference matters:

     BUILT-IN (10)  in SEED.roles, created on first run, locked from Admin
                    (renameRole and archiveRole refuse them) because 500-odd
                    string literals in o2s.html spell them out.
     PLANNED  (4)   named in the code tables but NOT in SEED.roles. Two of the
                    four — Supply Chain Officer and Finance — the COO has since
                    created for real through Admin (added 22 June 2026, per the
                    action log). Two — Production Manager and Finance Desk
                    Officer — are wired and INERT: every screen and right that
                    names them does nothing at all until somebody adds the role.

   This file does not judge whether that design is right. It pins what it is.

   Run: node rolemodel.test.js */
const H = require('./harness.js');
const fs = require('fs');
const vm = require('vm');
const STATE = JSON.parse(fs.readFileSync(H.STATE, 'utf8')).data;

let pass = 0, fail = 0; const fails = [];
function ok(n, c, x) { if (c) pass++; else { fail++; fails.push(n + (x ? '  [' + x + ']' : '')); } }
function eq(n, g, w) { ok(n, g === w, 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w)); }

/* ---- the two name sets, pinned ---- */
const BUILTIN = ['KAM', 'Supply Chain', 'Production', 'Lab Rep', 'AQCM', 'QCM',
                 'QA Inspector', 'Plant Manager', 'CFO', 'COO'];
const PLANNED = ['Finance', 'Finance Desk Officer', 'Production Manager', 'Supply Chain Officer'];
/* Of the planned four, these two exist for real in the live state today. */
const PLANNED_LIVE = ['Finance', 'Supply Chain Officer'];
/* ...and these two are wired in code and held by nobody. */
const PLANNED_INERT = ['Production Manager', 'Finance Desk Officer'];

/* ================= 1. THE TEN BUILT-INS ================= */
{
  const m = /"roles":\s*(\[[^\]]*\])/.exec(H.html);
  ok('SEED carries a roles list', !!m);
  const seed = JSON.parse(m[1]);
  eq('SEED.roles is the ten built-ins, in order', seed.join(' | '), BUILTIN.join(' | '));
  eq('...and there are exactly ten', seed.length, 10);
  /* The order is not cosmetic: seedRolesV1 maps it straight into masters.roles,
     and the Admin list renders in that order. */
  eq('COO is last', seed[seed.length - 1], 'COO');
}

/* ================= 2. EVERY NAME IN THE AUTHORITY TABLES ================= */
/* Pulled out of the real source, not asserted from memory. If somebody adds a
   role name to a screen or a right, it shows up here. */
function blockAt(needle, open) {
  const i = H.html.indexOf(needle);
  if (i < 0) throw new Error('not found: ' + needle);
  return H.matchBlock(i, needle, open);
}
const SCR_SRC = blockAt('const SCREENS=', '[');
const RGT_SRC = blockAt('var RIGHTS=', '[');
const FLD_SRC = blockAt('const FIELD_OWNER=', '{');

function namesInArrays(blk, keys) {
  const out = new Set();
  const re = new RegExp('(' + keys.join('|') + ")\\s*:\\s*\\[([^\\]]*)\\]", 'g');
  let m;
  while ((m = re.exec(blk))) (m[2].match(/'[^']*'/g) || []).forEach(s => out.add(s.slice(1, -1)));
  return out;
}
const scrNames = namesInArrays(SCR_SRC, ['owners']);
const rgtNames = namesInArrays(RGT_SRC, ['roles', 'owners']);
const fldNames = new Set((FLD_SRC.match(/:\s*'[^']*'/g) || []).map(s => s.replace(/^:\s*'|'$/g, '')));
const union = new Set([...scrNames, ...rgtNames, ...fldNames]);

{
  const known = new Set([...BUILTIN, ...PLANNED]);
  const strays = [...union].filter(n => !known.has(n)).sort();
  /* THE TRIPWIRE. A misspelled role name is a silent, permanent lockout: the
     string never matches, no error is raised, and the only symptom is a person
     saying "I can't see that screen" months later. */
  eq('no role name in SCREENS / RIGHTS / FIELD_OWNER is unknown', strays.join(', '), '');
  eq('...and the full set is the ten built-ins plus the four planned', union.size, 14);

  eq('SCREENS names 14 roles', scrNames.size, 14);
  eq('RIGHTS legacy names 9', rgtNames.size, 9);
  eq('FIELD_OWNER names 4', fldNames.size, 4);

  /* FIELD_OWNER is the narrow one — only roles that own a PO field. If a
     planned role ever appears here it would own a field nobody can hold. */
  ok('FIELD_OWNER holds built-ins only',
     [...fldNames].every(n => BUILTIN.includes(n)), [...fldNames].join(', '));
}

/* ================= 3. NO NEAR-MISS SPELLINGS ================= */
/* Inside the three authority tables a name that merely LOOKS like a role — same
   letters, different case or spacing — is unambiguously a mistake. Outside them
   the same string can be honest UI copy (the dashboard's "Supply chain" tab) or
   a role id ('supply-chain'), so the scan is deliberately confined. */
{
  const squash = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const want = new Map([...BUILTIN, ...PLANNED].map(n => [squash(n), n]));
  const variants = [];
  /* Only the ROLE-BEARING keys. The first run of this scan read every quoted
     string in the block and reported dept:'production' and dept:'supply-chain'
     as misspelled roles. They are not roles — they are department ids, a
     separate namespace that happens to squash to the same letters. Scanning
     the whole block would have made this check permanently noisy, which is the
     same as switching it off. */
  const roleValues = blk => {
    const out = [];
    const re = /(roles|owners)\s*:\s*\[([^\]]*)\]/g;
    let m;
    while ((m = re.exec(blk))) (m[2].match(/'[^']*'/g) || []).forEach(q => out.push(q.slice(1, -1)));
    return out;
  };
  const fieldValues = blk => (blk.match(/:\s*'[^']*'/g) || []).map(s => s.replace(/^:\s*'|'$/g, ''));
  [['SCREENS', roleValues(SCR_SRC)], ['RIGHTS', roleValues(RGT_SRC)],
   ['FIELD_OWNER', fieldValues(FLD_SRC)]].forEach(([label, vals]) => {
    vals.forEach(v => {
      const k = squash(v);
      if (want.has(k) && v !== want.get(k)) variants.push(label + ': ' + v + ' != ' + want.get(k));
    });
  });
  eq('no near-miss role spellings in the authority tables', variants.join(' ; '), '');
}

/* ================= 4. THE BUILT-IN LOCK ================= */
{
  const rn = H.grab('renameRole'), ar = H.grab('archiveRole'), rs = H.grab('restoreRole');
  ok('renameRole refuses a built-in', /if\(r\.builtin\)\{toast\(/.test(rn));
  ok('...and says why — they are wired in code', /wired in code/.test(rn));
  ok('archiveRole refuses a built-in', /if\(r\.builtin\)\{toast\(/.test(ar));
  /* restoreRole does NOT check builtin, and does not need to: a built-in can
     never reach archived:true, so there is nothing to restore. Pinned so that
     if archiveRole's guard is ever removed, this is not mistaken for cover. */
  ok('restoreRole has no built-in guard (nothing can archive one)', !/builtin/.test(rs));
  [rn, ar, rs, H.grab('addRole')].forEach((s, i) =>
    ok('role CRUD #' + (i + 1) + ' is COO-only', /state\.role!=='COO'/.test(s)));
}

/* ================= 5. addRole — the only way a new role exists ================= */
{
  const s = H.grab('addRole');
  ok('addRole demands a department', /Pick the department this role belongs to/.test(s));
  ok('...refuses a duplicate name, case-insensitively', /toLowerCase\(\)===name\.toLowerCase\(\)/.test(s));
  ok('...marks the new role builtin:false', /builtin:false/.test(s));
  ok('...makes the id unique with a numeric suffix', /id=base\+'-'\+\(i\+\+\)/.test(s));
  ok('...locks it out of Users, Admin and Data Fix by default',
     /users:\{v:false,e:false\}/.test(s) && /admin:\{v:false,e:false\}/.test(s) && /datafix:\{v:false,e:false\}/.test(s));
  ok('...and gives it a grant row immediately', /seedDeptRightsV1\(state\)/.test(s));
  ok('...and logs it', /logAction\('Role added: '/.test(s));
}

/* ================= 6. renameRole carries the joins ================= */
{
  const s = H.grab('renameRole');
  ok('renameRole moves the access-matrix row to the new name', /m\[nv\]=m\[old\];\s*delete m\[old\]/.test(s));
  ok('...and re-points every user holding the old name', /u\.role===old\) u\.role=nv/.test(s));
  ok('...refuses a name another role already has', /That role name already exists/.test(s));
  /* It does NOT rewrite SCREENS.owners, RIGHTS.legacy or FIELD_OWNER — it
     cannot, they are code. That is exactly why built-ins are locked, and why a
     renamed custom role silently loses its screens. Pinned as a known edge. */
  ok('...and warns the COO that server-side users are not moved', /Reassign any server-side users/.test(s));
}

/* ================= 7. archiveRole protects the org chart ================= */
{
  const s = H.grab('archiveRole');
  ok('archiveRole refuses to archive a department lead', /leads '\+_ld\.name\+'\. Give that department a new lead first/.test(s));
  ok('...and warns when users still hold the role', /currently have the "'\+r\.name\+'" role/.test(s));
  ok('...existing holders keep it', /existing users keep it/.test(s));
}

/* ================= 8. rolesList — what the app offers ================= */
{
  const box = {
    console, SEED: { roles: BUILTIN.slice() },
    state: { masters: { roles: [
      { id: 'kam', name: 'KAM', builtin: true, archived: false },
      { id: 'old', name: 'Old Role', builtin: false, archived: true }
    ] } }
  };
  box.globalThis = box;
  vm.createContext(box);
  vm.runInContext(H.grab('rolesList') + '\n' + H.grab('seedRolesV1'), box);

  eq('rolesList drops archived roles', box.rolesList().join(', '), 'KAM');

  box.state.masters.roles = [];
  eq('rolesList falls back to SEED.roles when the master is empty',
     box.rolesList().join(', '), BUILTIN.join(', '));
  box.state.masters = null;
  eq('...and when masters is missing altogether',
     box.rolesList().join(', '), BUILTIN.join(', '));

  /* seedRolesV1 fills the master exactly once. */
  const s1 = { masters: {} };
  box.seedRolesV1(s1);
  eq('seedRolesV1 seeds ten', s1.masters.roles.length, 10);
  ok('...all marked built-in', s1.masters.roles.every(r => r.builtin === true));
  ok('...none archived', s1.masters.roles.every(r => r.archived === false));
  eq('...id is the slug of the name', s1.masters.roles.map(r => r.id).join(','),
     'kam,supply-chain,production,lab-rep,aqcm,qcm,qa-inspector,plant-manager,cfo,coo');
  const before = s1.masters.roles;
  s1.masters.roles.push({ id: 'x', name: 'X', builtin: false, archived: false });
  box.seedRolesV1(s1);
  ok('seedRolesV1 is idempotent — it never overwrites a COO edit', s1.masters.roles === before);
  eq('...and leaves the added role alone', s1.masters.roles.length, 11);
}

/* ================= 9. FILING — a role nobody can find gets no rights ================= */
/* The Authorisation panel is built department by department. A role with no
   department shows under "not filed yet" — visible, but it has no lead who can
   grant it anything. Every role that exists must be filed. */
{
  const box = { console, DEPTS: null, ROLE_DEPT: null, state: { masters: { roles: [] } } };
  box.globalThis = box;
  vm.createContext(box);
  vm.runInContext(
    H.grabTopVar('DEPTS', '[') + H.grabTopVar('ROLE_DEPT', '{') + '\n' +
    ['rolesOfState', 'roleByName', 'roleIdOf', 'roleDeptId', 'deptById',
     'deptLeadRole', 'isDeptLead', 'rolesInDept', 'rolesUnfiled'].map(H.grab).join('\n'), box);

  /* The live roles, as they actually stand today. */
  box.state.masters.roles = JSON.parse(JSON.stringify(STATE.masters.roles || []));
  box.state.masters.departments = JSON.parse(JSON.stringify(STATE.masters.departments || []));

  eq('live state carries twelve roles', box.state.masters.roles.length, 12);
  eq('...ten built-in', box.state.masters.roles.filter(r => r.builtin).length, 10);
  eq('...two created by the COO', box.state.masters.roles.filter(r => !r.builtin).map(r => r.name).sort().join(', '),
     PLANNED_LIVE.slice().sort().join(', '));

  /* THE INVARIANT. This is the one that breaks as roles are added. */
  eq('every live role is filed in a department', box.rolesUnfiled().map(r => r.name).join(', '), '');

  /* The two created roles are filed by the built-in constant, not by a stored
     deptId — they were added before addRole demanded one. Pinned so that if
     ROLE_DEPT is ever tidied up, the two roles do not quietly fall out. */
  PLANNED_LIVE.forEach(n => {
    const r = box.roleByName(n);
    ok(n + ' has no stored deptId', !r.deptId);
    ok('...and is filed by ROLE_DEPT instead', !!box.roleDeptId(n), String(box.roleDeptId(n)));
  });
  eq('Supply Chain Officer sits in Supply Chain', box.roleDeptId('Supply Chain Officer'), 'supply-chain');
  eq('Finance sits in Finance', box.roleDeptId('Finance'), 'finance');

  /* A stored deptId must beat the constant, so the COO's own filing wins. */
  box.state.masters.roles.push({ id: 'kam2', name: 'KAM2', deptId: 'finance', builtin: false, archived: false });
  eq('a stored deptId wins over the constant', box.roleDeptId('KAM2'), 'finance');
  box.state.masters.roles.pop();

  /* Leads resolve to real role names. */
  eq('Commercial is led by KAM', box.deptLeadRole('commercial'), 'KAM');
  eq('Leadership is led by the Plant Manager', box.deptLeadRole('leadership'), 'Plant Manager');
  ok('KAM is a department lead', box.isDeptLead('KAM'));
  ok('Supply Chain Officer is not', !box.isDeptLead('Supply Chain Officer'));

  /* An unfiled role IS detected — proof the invariant above can fail. */
  box.state.masters.roles.push({ id: 'ghost', name: 'Ghost', builtin: false, archived: false });
  eq('an unfiled role is reported, not hidden', box.rolesUnfiled().map(r => r.name).join(', '), 'Ghost');
  box.state.masters.roles.pop();
  /* COO is exempt by name — he sits above the departments. */
  ok('COO is never counted as unfiled', !box.rolesUnfiled().some(r => r.name === 'COO'));
}

/* ================= 10. THE INERT TWO ================= */
/* Production Manager and Finance Desk Officer are written into the code tables
   and held by nobody. Everything naming them does exactly nothing today. That
   is safe, and it is deliberate — but it must not be mistaken for the split
   having happened. production-manager-split.test.js runs the real Admin
   mechanism for Production Manager; this only pins that it is not live yet. */
{
  const live = (STATE.masters.roles || []).map(r => r.name);
  PLANNED_INERT.forEach(n => {
    ok(n + ' is named in the code tables', union.has(n));
    ok('...and does not exist as a role yet', live.indexOf(n) < 0);
  });
  PLANNED_LIVE.forEach(n => ok(n + ' does exist', live.indexOf(n) > -1));

  /* Which screens the inert two are already wired for — recorded, so that when
     they are created nobody has to guess what they will suddenly be able to
     reach. */
  const screensFor = n => (SCR_SRC.match(/\{id:'[^']+',[\s\S]*?owners:\[[^\]]*\]/g) || [])
    .filter(s => s.indexOf("'" + n + "'") > -1)
    .map(s => /\{id:'([^']+)'/.exec(s)[1]);
  eq('Production Manager is pre-wired for these screens', screensFor('Production Manager').join(','),
     'dash,approvals,tracker,prod,qc,qa,ship,reports,instructions,datafix,recon');
  eq('Finance Desk Officer is pre-wired for these screens', screensFor('Finance Desk Officer').join(','),
     'dash,approvals,entry,tracker,ship,instructions');
  /* NOT Reports — and the older 'Finance' role IS on Reports. So the role HR
     lists as taking over PO entry from Commercial would be able to raise a PO,
     track it and see the shipment, and not be able to open a single report.
     Recorded, not corrected: who owns a screen is the COO's call, not mine.
     Pinned here so the decision is made deliberately rather than discovered. */
  ok("...and 'Finance' is on Reports while 'Finance Desk Officer' is not",
     screensFor('Finance').indexOf('reports') > -1 &&
     screensFor('Finance Desk Officer').indexOf('reports') < 0);

  /* The only right naming any of the four is the short-close request, added
     23 September. It is legacy:{kind:'hard'} — an unknown name in that list is
     simply never matched, so the eight names are a superset on purpose. */
  const sc = /\{code:'po\.shortclose_request'[\s\S]*?\}\}/.exec(RGT_SRC);
  ok('po.shortclose_request exists', !!sc);
  eq('...and names eight roles, four of them not yet real',
     (sc[0].match(/roles:\[([^\]]*)\]/)[1].match(/'[^']*'/g) || []).length, 8);
}

/* ================= 11. WHAT A RENAME WOULD COST ================= */
/* The reason built-ins are locked, in a number. Each built-in name appears as a
   quoted literal this many times outside the SEED data blob. Renaming one in
   Admin would leave every one of them pointing at a role that no longer exists.
   Counted, not asserted — the point is the order of magnitude, so the check is
   a floor rather than an exact figure that would break on unrelated edits. */
{
  const lines = H.html.split('\n').filter((_, i) => i !== 1620); /* line 1621, the SEED blob */
  const body = lines.join('\n');
  const FLOOR = { 'KAM': 20, 'Supply Chain': 50, 'Production': 80, 'Lab Rep': 20, 'AQCM': 20,
                  'QCM': 20, 'QA Inspector': 20, 'Plant Manager': 60, 'CFO': 30, 'COO': 120 };
  let total = 0;
  BUILTIN.forEach(n => {
    const c = (body.match(new RegExp("'" + n + "'", 'g')) || []).length
            + (body.match(new RegExp('"' + n + '"', 'g')) || []).length;
    total += c;
    ok("'" + n + "' is spelled out at least " + FLOOR[n] + ' times in code', c >= FLOOR[n], 'got ' + c);
  });
  ok('the ten built-in names are spelled out 450+ times in all', total >= 450, 'got ' + total);
  console.log('    built-in role names hard-coded in o2s.html: ' + total + ' literals');
}

console.log('\nRole model — the name is the join key: ' + pass + ' passed, ' + fail + ' failed');
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fail ? 1 : 0);
