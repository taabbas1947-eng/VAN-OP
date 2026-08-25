/* Departments · roles · rights — the authorisation redesign, first function.
   24 August 2026.

   The COO's model: a department is the function, one role in it is the lead,
   and the lead ticks rights for the other roles in his own department. He may
   not tick his own row — only the COO can widen a lead.

   THE CONSTRAINT THIS SUITE EXISTS TO ENFORCE: "the current system shouldn't
   stop working." Every converted gate now asks may('some.right'), but no right
   is live yet, so may() runs the EXACT check the gate ran before. The grants
   were seeded from those same old checks, so switching a right live later also
   changes nobody's answer. Both halves are proved below, per role, against the
   real access matrix in the data on record — not against a made-up one.

   Run: node authmodel.test.js */
const H = require('./harness.js');
const fs = require('fs');
const vm = require('vm');
const STATE = JSON.parse(fs.readFileSync(H.STATE, 'utf8')).data;

let pass = 0, fail = 0; const fails = [];
function ok(n, c, x) { if (c) pass++; else { fail++; fails.push(n + (x ? '  [' + x + ']' : '')); } }
function eq(n, g, w) { ok(n, g === w, 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w)); }

const SCREENS_SRC = (function () {
  const i = H.html.indexOf('const SCREENS=');
  if (i < 0) throw new Error('SCREENS not found');
  return H.matchBlock(i, 'SCREENS', '[').replace(/^const /, 'var ') + ';';
})();
function mk(roleName) {
  const b = { console, JSON, Date,
    state: { role: roleName || 'COO', users: [],
             masters: JSON.parse(JSON.stringify(STATE.masters)) } };
  b.globalThis = b;
  vm.createContext(b);
  vm.runInContext(SCREENS_SRC + '\n'
    + ['scr', 'accessOv', '_ownerEdit', 'accessLevel', 'screenEditOK', 'hardRole'].map(H.grab).join('\n\n')
    + '\n' + H.authModelSrc(), b);
  b.seedDeptRightsV1(b.state);          /* the same seeding the app does at load */
  return b;
}
const B = mk('COO');
const ROLES = (STATE.masters.roles || []).map(r => r.name);
const asRole = r => { B.state.role = r; };

/* ================= 0. the access rule has ONE implementation ================= */
/* Seeding the grant table needs the matrix answer for a state object that is
   not yet the live `state`. That used to be a second copy of the rule, and a
   copy that drifts is how the matrix and the grants would silently disagree.
   accessLevel() is now a thin wrapper over accessLevelOn(); this proves they
   still give the same answer for every role on every screen, and that
   accessLevel holds no rule of its own. */
{
  const body = H.grab('accessLevel');
  ok('accessLevel is a wrapper, not a second copy of the rule',
     /accessLevelOn\(state,\s*role,\s*id\)/.test(body) && !/accessOv|_ownerEdit/.test(body), body);
  const ids = B.SCREENS.map(x => x.id);
  let agree = 0, seen = 0;
  ROLES.concat(['Nobody At All']).forEach(r => ids.forEach(id => {
    seen++; if (B.accessLevel(r, id) === B.accessLevelOn(B.state, r, id)) agree++; }));
  eq('the two ways of asking agree on every role x screen', agree, seen);
  ok('and that really was every role on every screen', seen === (ROLES.length + 1) * ids.length && seen > 100,
     'checked ' + seen);
}

/* ================= 1. the model is there and makes sense ================= */
{
  eq('six departments are seeded', B.state.masters.departments.length, 6);
  ok('every role sits in a department',
     (B.state.masters.roles || []).every(r => !!B.roleDeptId(r.name)),
     JSON.stringify((B.state.masters.roles || []).filter(r => !B.roleDeptId(r.name)).map(r => r.name)));
  eq('Commercial\'s lead is the KAM', B.deptLeadRole('commercial'), 'KAM');
  eq('Production\'s lead is Production', B.deptLeadRole('production'), 'Production');
  ok('the KAM is a lead', B.isDeptLead('KAM') === true);
  ok('a Lab Rep is not', B.isDeptLead('Lab Rep') === false);
  /* Pinned one by one. A role quietly filed in the wrong department gets the
     wrong lead — and that lead can then tick rights for somebody who is not his. */
  [['KAM','commercial'],['Supply Chain','supply-chain'],['Supply Chain Officer','supply-chain'],
   ['Production','production'],['Lab Rep','quality'],['AQCM','quality'],['QCM','quality'],
   ['QA Inspector','quality'],['Plant Manager','leadership'],['CFO','finance'],
   ['Finance','finance'],['COO','leadership']].forEach(([rn, dep]) =>
     eq('filed correctly: ' + rn, B.roleDeptId(rn), dep));
  ok('Zain\'s two role names both land in Supply Chain',
     B.roleDeptId('Supply Chain') === 'supply-chain' && B.roleDeptId('Supply Chain Officer') === 'supply-chain');
  ok('every right belongs to a department that exists',
     B.RIGHTS.every(r => !!B.deptById(r.dept)));
  ok('only Commercial is converted so far',
     B.RIGHTS.every(r => r.dept === 'commercial'), JSON.stringify(B.RIGHTS.map(r => r.dept)));
  ok('and nothing is live yet — this is what makes the conversion safe',
     Object.keys(B.RIGHTS_LIVE).length === 0, JSON.stringify(B.RIGHTS_LIVE));
}

/* ================= 2. NOTHING STOPPED WORKING ================= */

/* 2a. Each converted gate gives the same answer as the check it replaced.
   The old checks are written out here by hand ON PURPOSE — this is the one
   place a copy is the point, because it is the record of what the app did
   before the change. mayWork(x) was accessLevel(role,x)==='edit';
   hardRole([r]) was role==='COO'||role===r; ackOrder had no check at all. */
{
  const OLD = {
    'order.create':         r => B.accessLevel(r, 'entry') === 'edit',
    'order.print_decision': r => B.accessLevel(r, 'entry') === 'edit',
    'order.acknowledge':    () => true,
    'customer.create':      r => r === 'COO' || r === 'KAM',
    'customer.amend':       r => r === 'COO' || r === 'KAM',
  };
  eq('every right in the catalogue has its old check written down here',
     B.RIGHTS.filter(r => !OLD[r.code]).length, 0);
  B.RIGHTS.forEach(rt => {
    ROLES.forEach(r => {
      eq('unchanged: ' + r + ' · ' + rt.code, B.mayRole(r, rt.code), OLD[rt.code](r));
    });
  });
}

/* 2b. And it STAYS unchanged when the right is switched on, because the grants
   were seeded from those same old checks. This is the check that has to be
   green before any right goes live. */
{
  eq('the freeze check is clean — no role gains or loses anything when a right goes live',
     B.rightsFreezeCheck().join(' | '), '');

  /* Actually switch them all on and compare, role by role. */
  const before = ROLES.map(r => B.RIGHTS.map(rt => B.mayRole(r, rt.code)).join(','));
  B.RIGHTS.forEach(rt => { B.RIGHTS_LIVE[rt.code] = true; });
  const after = ROLES.map(r => B.RIGHTS.map(rt => B.mayRole(r, rt.code)).join(','));
  ROLES.forEach((r, i) => eq('switching every right live changes nothing for ' + r, after[i], before[i]));
  B.RIGHTS.forEach(rt => { delete B.RIGHTS_LIVE[rt.code]; });
}

/* 2c. Customer Master is still as locked as it was — the whole point of the
   hold-back survives the conversion. */
{
  const can = c => ROLES.filter(r => B.mayRole(r, c));
  eq('adding a customer is still KAM and COO only', can('customer.create').join(', '), 'KAM, COO');
  eq('changing one is too', can('customer.amend').join(', '), 'KAM, COO');
  eq('and raising a PO is still the three the COO chose',
     can('order.create').join(', '), 'KAM, Plant Manager, COO');
}

/* 2d. The COO can never be locked out. */
ROLES.concat(['Somebody New']).forEach(() => {});
B.RIGHTS.forEach(rt => ok('the COO always has ' + rt.code, B.mayRole('COO', rt.code) === true));

/* 2e. A role nobody has heard of gets nothing (except where the old rule really
   did say "anyone" — and that is recorded, not invented). */
{
  const c = 'Night Shift Clerk';
  ok('an unknown role cannot raise a PO', B.mayRole(c, 'order.create') === false);
  ok('...or touch a customer record', B.mayRole(c, 'customer.create') === false);
  ok('...but CAN acknowledge, because that gate never had a check — recorded, not invented',
     B.mayRole(c, 'order.acknowledge') === true);
}

/* ================= 3. who may hand out a right ================= */
{
  const refuse = (granter, target, code) => { asRole(granter); return B.grantRefusal(granter, target, code); };

  eq('the COO may tick anything for anyone', refuse('COO', 'Finance', 'order.create'), '');

  /* The lead, inside his own department */
  ok('the Commercial lead may NOT tick his own row — the whole point',
     /cannot change his own/.test(refuse('KAM', 'KAM', 'order.create')),
     refuse('KAM', 'KAM', 'order.create'));

  /* Commercial has one role today (KAM). Put a second one in it and the lead
     can tick for it — that is the 5-to-10-people case. */
  {
    B.state.masters.roles.push({ id: 'sales-officer', name: 'Sales Officer', deptId: 'commercial', builtin: false, archived: false });
    eq('the lead MAY tick for another role in his own department',
       refuse('KAM', 'Sales Officer', 'order.create'), '');
    /* The lead is the right person and the target is in his department — but he
       does not hold this one himself, so he cannot pass it on. A Commercial
       right whose old rule was "CFO only" gives exactly that shape. */
    B.RIGHTS.push({ code: 'price.invoice_set', dept: 'commercial', name: 'Set the invoice price',
                    legacy: { kind: 'hard', roles: ['CFO'] } });
    ok('setting up the case: the KAM does NOT hold that right',
       B.mayRole('KAM', 'price.invoice_set') === false);
    ok('a lead cannot hand out a right he does not hold himself',
       /do not hold yourself/.test(refuse('KAM', 'Sales Officer', 'price.invoice_set')),
       refuse('KAM', 'Sales Officer', 'price.invoice_set'));
    B.RIGHTS.pop();
    ok('a lead cannot reach into another department',
       /not in Commercial|Only the COO/.test(refuse('KAM', 'Production', 'order.create')),
       refuse('KAM', 'Production', 'order.create'));
    ok('somebody who is not a lead cannot tick at all',
       /Only the COO and a department lead/.test(refuse('Lab Rep', 'Sales Officer', 'order.create')),
       refuse('Lab Rep', 'Sales Officer', 'order.create'));
    ok('and a right that does not exist cannot be granted',
       /does not exist/.test(refuse('KAM', 'Sales Officer', 'batch.close')));
    B.state.masters.roles = B.state.masters.roles.filter(r => r.id !== 'sales-officer');
  }
}

/* ================= 4. separation of duty ================= */
{
  /* None of the pairs can bite yet — both halves have to be in the catalogue,
     and only Commercial is converted. That is correct, and it must be TRUE
     rather than assumed, so it is checked. */
  ok('no separation rule fires today, because no pair is fully converted yet',
     B.SEPARATION.every(([a, b]) => !(B.rightByCode(a) && B.rightByCode(b))));
  B.RIGHTS.forEach(rt => ROLES.forEach(r =>
    eq('nothing is blocked by separation today: ' + r + ' · ' + rt.code,
       B.separationRefusal(r, rt.code), '')));

  /* And it DOES bite the moment the other half arrives. Add dc.approve — the
     pair order.create + dc.approve — and give it to the KAM. */
  {
    B.RIGHTS.push({ code: 'dc.approve', dept: 'supply-chain', name: 'Approve a delivery challan', legacy: { kind: 'hard', roles: ['Plant Manager'] } });
    ok('KAM already raises orders', B.mayRole('KAM', 'order.create') === true);
    ok('so KAM cannot also be given DC approval',
       /already has/.test(B.separationRefusal('KAM', 'dc.approve')),
       B.separationRefusal('KAM', 'dc.approve'));
    ok('...and the reason is given, not just a no',
       /approving its own delivery/.test(B.separationRefusal('KAM', 'dc.approve')));
    ok('a role that does NOT raise orders is unaffected',
       B.separationRefusal('Lab Rep', 'dc.approve') === '');
    B.RIGHTS.pop();
  }
}

/* ================= 5. rights are filed by role id, not by name ================= */
{
  /* Renaming a role used to orphan its entire rights row silently — which is how
     "Supply Chain" and "Supply Chain Officer" became two rows for one job. */
  const b2 = mk('COO');
  const before = b2.mayRole('KAM', 'customer.create');
  ok('the KAM has the customer right before the rename', before === true);
  b2.RIGHTS.forEach(rt => { b2.RIGHTS_LIVE[rt.code] = true; });
  const r = b2.state.masters.roles.find(x => x.name === 'KAM');
  r.name = 'Key Account Manager';
  ok('after a rename the role KEEPS its rights',
     b2.mayRole('Key Account Manager', 'customer.create') === true);
  ok('and the old name has nothing, because it no longer exists',
     b2.mayRole('KAM', 'customer.create') === false);
}

/* ================= 6. the refusal is worth reading ================= */
{
  asRole('Production');
  const msg = B.denyRight('order.create', 'Submitting a PO');
  ok('names what was refused', /Submitting a PO/.test(msg), msg);
  ok('names the right in plain words', /Raise a new PO/.test(msg), msg);
  ok('names who can', /KAM/.test(msg), msg);
  ok('and says who to ask', /Authorisation/.test(msg), msg);
}

/* ================= 7. the gates really were converted ================= */
{
  const G = [['submitPO', 'order.create'], ['ackOrder', 'order.acknowledge'],
             ['bulkPDMayAnswer', 'order.print_decision'], ['addDealer', 'customer.create']];
  G.forEach(([fn, code]) => ok('GUARD: ' + fn + ' asks may(\'' + code + '\')',
     new RegExp("may\\('" + code.replace('.', '\\.') + "'\\)").test(H.grab(fn)), H.grab(fn).slice(0, 90)));
  /* custSave asks for a different right depending on whether it is an add or an
     edit, so it reads may(_rt) — both names must be in the function. */
  ok('GUARD: custSave asks for customer.create on an add and customer.amend on an edit',
     /may\(_rt\)/.test(H.grab('custSave')) && /'customer\.amend'/.test(H.grab('custSave'))
       && /'customer\.create'/.test(H.grab('custSave')), H.grab('custSave').slice(0, 140));
  ok('GUARD: no Commercial gate still calls hardRole([\'KAM\'])',
     !/hardRole\(\['KAM'\]\)/.test(H.grab('custSave') + H.grab('addDealer')));
  ok('GUARD: the sign-off gates were NOT touched — hardRole is still used elsewhere',
     (H.html.match(/hardRole\(\[/g) || []).length >= 40);
}

/* ================= 8. the matrix rule really is the OLD matrix rule ================= */
/* Section 0 only proves accessLevel is a wrapper over accessLevelOn — which it
   is BY CONSTRUCTION, so it could never fail. This is the check that matters:
   the rewritten rule against the rule as it stood before the rewrite, written
   out here by hand because this file is the record of what the app used to do.
   Flipping one default in accessLevelOn changes 46 of 180 answers, and nothing
   used to notice. */
{
  const OLDRULE = (role, id) => {
    if (role === 'COO') return 'edit';
    const m = (B.state.masters && B.state.masters.accessMatrix) || {};
    const o = (m[role] && m[role][id]) || null;
    const v = (o && o.v !== undefined) ? o.v : true;
    const sc = B.SCREENS.find(x => x.id === id);
    const own = !!(sc && sc.owners && sc.owners.indexOf(role) >= 0);
    const e = (o && o.e !== undefined) ? o.e : own;
    return e ? 'edit' : (v ? 'view' : 'none');
  };
  const ids = B.SCREENS.map(x => x.id);
  let same = 0, seen = 0, diffs = [];
  ROLES.concat(['Nobody At All']).forEach(r => ids.forEach(id => {
    seen++;
    if (B.accessLevelOn(B.state, r, id) === OLDRULE(r, id)) same++;
    else diffs.push(r + '/' + id + ': now ' + B.accessLevelOn(B.state, r, id) + ', was ' + OLDRULE(r, id));
  }));
  eq('the rewritten matrix rule matches the one it replaced, everywhere', same, seen);
  ok('...and that is every role on every screen', seen > 150, 'checked ' + seen);
  ok('no differences at all', diffs.length === 0, diffs.slice(0, 4).join(' | '));

  /* view/none matters as much as edit: it decides what is in somebody's menu. */
  const views = ROLES.map(r => ids.filter(id => B.accessLevelOn(B.state, r, id) !== 'none').length);
  ok('every role can still see at least one screen', views.every(n => n > 0), JSON.stringify(views));
  eq('KAM still sees the same number of screens as the old rule said',
     ids.filter(id => B.accessLevelOn(B.state, 'KAM', id) !== 'none').length,
     ids.filter(id => OLDRULE('KAM', id) !== 'none').length);
}

/* ================= 9. the seed catches up ================= */
/* The first cut ran once behind a flag. A role or a right created afterwards
   got no grant row at all: it worked while its right was not live and was
   silently revoked the day the right went on, with no screen able to give it
   back. */
{
  const b = mk('COO');
  ok('a grant row exists for every role after the first run',
     (b.state.masters.roles || []).filter(r => r.name !== 'COO')
       .every(r => !!b.state.masters.roleRights[r.id]));

  /* a role that appears later */
  b.state.masters.roles.push({ id: 'accounts-officer', name: 'Accounts Officer', deptId: 'finance', builtin: false, archived: false });
  b.state.masters.accessMatrix['Accounts Officer'] = { entry: { v: true, e: true } };
  b.seedDeptRightsV1(b.state);
  ok('a role added AFTER the first seed gets a grant row',
     !!b.state.masters.roleRights['accounts-officer'],
     JSON.stringify(Object.keys(b.state.masters.roleRights)));
  eq('...matching what it can do today', b.state.masters.roleRights['accounts-officer']['order.create'], true);
  eq('...including the right that was open to everyone',
     b.state.masters.roleRights['accounts-officer']['order.acknowledge'], true);
  eq('and the freeze check stays clean', b.rightsFreezeCheck().join(' | '), '');

  /* a right that appears later */
  b.RIGHTS.push({ code: 'order.cancel', dept: 'commercial', name: 'Cancel a PO', legacy: { kind: 'all' } });
  ok('BEFORE re-seeding, the new right has no answer for anybody',
     b.state.masters.roleRights['kam']['order.cancel'] === undefined);
  ok('...and the freeze check says so', b.rightsFreezeCheck().length > 0);
  b.seedDeptRightsV1(b.state);
  eq('a right added AFTER the first seed is filled in for every role',
     ROLES.filter(r => r !== 'COO').filter(r => b.state.masters.roleRights[b.roleIdOf(r)]['order.cancel'] === true).length,
     ROLES.filter(r => r !== 'COO').length);
  eq('and the freeze check is clean again', b.rightsFreezeCheck().join(' | '), '');
  b.RIGHTS.pop();

  /* a lead's deliberate NO is not undone by the seed running again */
  b.state.masters.roleRights['kam']['order.acknowledge'] = false;
  b.seedDeptRightsV1(b.state);
  eq('a deliberate "no" survives the seed running again',
     b.state.masters.roleRights['kam']['order.acknowledge'], false);

  /* THE REASON accessLevelOn EXISTS. The first ensureState runs before the
     global `state` is assigned, so a seed that asked accessLevel() — which reads
     the live `state` — would see nothing and seed every screen-kind right to
     false, silently. Run the seed in a sandbox with NO live state at all. */
  {
    const b3 = mk('COO');
    const fresh = JSON.parse(JSON.stringify({ masters: STATE.masters }));
    delete fresh.masters.roleRights; delete fresh.masters.departments;
    b3.state = undefined;                       /* exactly the boot condition */
    b3.seedDeptRightsV1(fresh);
    eq('the KAM is seeded able to raise a PO even with no live state yet',
       fresh.masters.roleRights['kam']['order.create'], true);
    eq('...and Production is seeded unable to', fresh.masters.roleRights['production']['order.create'], false);
    ok('the screen-kind grants are not all false — which is what asking the live state would give',
       Object.keys(fresh.masters.roleRights).some(k => fresh.masters.roleRights[k]['order.create'] === true));
    b3.state = { masters: fresh.masters, role: 'COO', users: [] };
  }

  /* and it does not churn the state on every load (which would fight the merge) */
  const b2 = mk('COO');
  const snap = JSON.stringify(b2.state.masters.roleRights);
  b2.seedDeptRightsV1(b2.state); b2.seedDeptRightsV1(b2.state);
  eq('running the seed three times leaves the state byte-identical',
     JSON.stringify(b2.state.masters.roleRights), snap);
}

/* ================= 10. the drift check actually reports drift ================= */
/* Asserting only that rightsFreezeCheck() comes back empty would pass just as
   well if it always returned []. Feed it a state that HAS drifted. */
{
  const b = mk('COO');
  eq('clean to begin with', b.rightsFreezeCheck().join(' | '), '');
  b.state.masters.roleRights['production']['order.create'] = true;   /* Production cannot enter a PO today */
  const bad = b.rightsFreezeCheck();
  ok('a tick that disagrees with today IS reported', bad.length === 1, JSON.stringify(bad));
  ok('...naming the role and the right', /Production/.test(bad[0]) && /order\.create/.test(bad[0]), bad[0]);
  b.state.masters.roleRights['production']['order.create'] = false;
  eq('and clean again once it is put right', b.rightsFreezeCheck().join(' | '), '');
}

/* ================= 11. changing the matrix keeps the grants in step ================= */
/* A screen-kind right answers off the matrix until it goes live and off the
   grant table afterwards. If the COO moves that matrix cell in between, the two
   disagree, and somebody silently gains or loses access the day it goes live. */
{
  const b = mk('COO');
  eq('Supply Chain cannot enter a PO today', b.mayRole('Supply Chain', 'order.create'), false);
  b.state.masters.accessMatrix['Supply Chain'].entry = { v: true, e: true };
  ok('the matrix now says it can, but the grant still says no',
     b.mayRole('Supply Chain', 'order.create') === true
     && b.state.masters.roleRights['supply-chain']['order.create'] === false);
  /* order.print_decision hangs off the same screen, so a single matrix change
     drifts both of that screen's rights. */
  { const bad = b.rightsFreezeCheck();
    ok('...which the drift check catches', bad.length >= 1 && bad.some(x => /order\.create/.test(x)), JSON.stringify(bad)); }
  b.resyncScreenRights('Supply Chain', 'entry');
  eq('re-syncing puts a SEEDED grant where the matrix now points',
     b.state.masters.roleRights['supply-chain']['order.create'], true);
  eq('and the drift is gone', b.rightsFreezeCheck().join(' | '), '');

  /* THE THING THAT MUST NOT HAPPEN. A tick somebody set by hand is a decision.
     The first cut re-pointed every screen-kind grant on any matrix click, so the
     COO could untick a right, be told it was recorded, click an unrelated cell
     for the same role, and have the untick silently put back — no toast, nothing
     in the log, and the drift banner reporting all clear. */
  b.markRightDecided('Supply Chain', 'order.create');
  b.state.masters.roleRights['supply-chain']['order.create'] = false;
  b.state.masters.accessMatrix['Supply Chain'].entry = { v: true, e: true };
  b.resyncScreenRights('Supply Chain', 'entry');
  eq('a DECIDED tick is never overwritten by a matrix change',
     b.state.masters.roleRights['supply-chain']['order.create'], false);
  ok('...and the drift is REPORTED rather than silently undone',
     b.rightsFreezeCheck().some(x => /Supply Chain \/ order\.create/.test(x)),
     JSON.stringify(b.rightsFreezeCheck()));
  b.state.masters.roleRightsSet['supply-chain']['order.create'] = false;
  b.state.masters.roleRights['supply-chain']['order.create'] = true;

  /* And a matrix click only moves the rights that hang off THAT screen. */
  b.state.masters.roleRights['supply-chain']['order.print_decision'] = false;
  b.resyncScreenRights('Supply Chain', 'dash');
  eq('a click on an unrelated screen touches nothing',
     b.state.masters.roleRights['supply-chain']['order.print_decision'], false);
  b.resyncScreenRights('Supply Chain', 'entry');
  eq('a click on the right screen does', b.state.masters.roleRights['supply-chain']['order.print_decision'], true);

  /* the other direction — taking access away */
  b.state.masters.accessMatrix['Plant Manager'].entry = { v: true, e: false };
  b.resyncScreenRights('Plant Manager', 'entry');
  eq('taking Edit away takes the grant with it',
     b.state.masters.roleRights['plant-manager']['order.create'], false);

  /* a right that IS live is no longer the matrix's business */
  b.RIGHTS_LIVE['order.create'] = true;
  b.state.masters.accessMatrix['Supply Chain'].entry = { v: false, e: false };
  b.resyncScreenRights('Supply Chain', 'entry');
  eq('once a right is live the matrix no longer moves it',
     b.state.masters.roleRights['supply-chain']['order.create'], true);
  delete b.RIGHTS_LIVE['order.create'];

  /* hard-kind rights are never touched by a matrix change */
  const before = b.state.masters.roleRights['kam']['customer.create'];
  b.state.masters.accessMatrix['KAM'].dealers = { v: false, e: false };
  b.resyncScreenRights('KAM', 'dealers');
  eq('a matrix change does not touch a right that never came from the matrix',
     b.state.masters.roleRights['kam']['customer.create'], before);

  ok('GUARD: amxCycle re-syncs, naming the screen that changed',
     /resyncScreenRights\(role,\s*id\)/.test(H.grab('amxCycle')));
  ok('GUARD: rightTick records that a person decided the cell',
     /markRightDecided\(roleName,code\)/.test(H.grab('rightTick')));
}

/* ================= 12. some rights are not the lead's to give ================= */
/* Customer Master is held back because two people on that screen silently
   delete each other's work. Before the rights model, widening it took a code
   change under review. It must not have become a tick the KAM can hand out. */
{
  const b = mk('COO');
  b.state.masters.roles.push({ id: 'sales-officer', name: 'Sales Officer', deptId: 'commercial', builtin: false, archived: false });
  b.seedDeptRightsV1(b.state);
  ok('the two customer rights are marked as the COO’s alone',
     b.rightByCode('customer.create').delegable === false && b.rightByCode('customer.amend').delegable === false);
  ['customer.create', 'customer.amend'].forEach(c => {
    ok('the Commercial LEAD cannot hand out ' + c,
       /only be changed by the COO/.test(b.grantRefusal('KAM', 'Sales Officer', c)),
       b.grantRefusal('KAM', 'Sales Officer', c));
    ok('...and the refusal says why it is held back',
       /HELD BACK/.test(b.grantRefusal('KAM', 'Sales Officer', c)));
    eq('but the COO still can', b.grantRefusal('COO', 'Sales Officer', c), '');
  });
  eq('an ordinary Commercial right is still the lead’s to give',
     b.grantRefusal('KAM', 'Sales Officer', 'order.create'), '');
}

/* ================= 13. the panel itself ================= */
/* grantRefusal being right is worth nothing if the button does not ask it.
   These drive rightTick and authCard, not the predicate underneath them. */
{
  function panel(role) {
    const b = mk(role);
    b.state.users = [{ name: 'ahmed', role: 'Sales Officer' }, { name: 'bilal', role: 'Sales Officer' }];
    b.state.masters.roles.push({ id: 'sales-officer', name: 'Sales Officer', deptId: 'commercial', builtin: false, archived: false });
    b.seedDeptRightsV1(b.state);
    b.toasts = []; b.saved = 0; b.logged = [];
    Object.assign(b, {
      toast: m => b.toasts.push(m), save: () => { b.saved++; }, render: () => {},
      logAction: m => b.logged.push(m),
      acOpen: {}, authDept: 'commercial', $: () => null,
      usersList: [{ name: 'ahmed', role: 'Sales Officer' }, { name: 'bilal', role: 'Sales Officer' }], acard: (k, t, h, body) => '<CARD ' + k + '>' + body + '</CARD>',
      _pe: x => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    });
    vm.runInContext(['_at', 'screenEditOK', 'accessLevel', 'authRepaint', 'rightTickById', 'rightTick', 'authPick', 'authDriftBanner', 'authCard']
                    .map(H.grab).join('\n\n'), b);
    b.state.masters.accessMatrix[role] = b.state.masters.accessMatrix[role] || {};
    if (role !== 'COO') b.state.masters.accessMatrix[role].admin = { v: true, e: false };
    return b;
  }

  /* the lead ticks for his own team — it lands */
  {
    const b = panel('KAM');
    eq('setting up: Sales Officer cannot raise a PO', b.mayRole('Sales Officer', 'order.create'), false);
    b.rightTick('Sales Officer', 'order.create', true);
    eq('the lead’s tick is written', b.state.masters.roleRights['sales-officer']['order.create'], true);
    ok('and saved', b.saved === 1);
    ok('and logged', b.logged.some(l => /order\.create/.test(l) && /Sales Officer/.test(l)), JSON.stringify(b.logged));
    ok('and the person is told it is not live yet',
       b.toasts.some(t => /not live|Takes effect/i.test(t)), JSON.stringify(b.toasts));
  }
  /* every refusal reaches the WRITER, not just the button */
  [['KAM', 'KAM', 'order.create', /cannot change his own/],
   ['KAM', 'Production', 'order.create', /not in Commercial|Only the COO/],
   ['KAM', 'Sales Officer', 'customer.create', /only be changed by the COO/],
   ['Lab Rep', 'Sales Officer', 'order.create', /Only the COO and a department lead/],
   ['Production', 'Sales Officer', 'order.create', /Only the COO|not in/]
  ].forEach(([who, target, code, re]) => {
    const b = panel(who);
    const before = JSON.stringify(b.state.masters.roleRights);
    b.rightTick(target, code, true);
    ok('rightTick REFUSES ' + who + ' -> ' + target + ' / ' + code,
       JSON.stringify(b.state.masters.roleRights) === before, 'it wrote anyway');
    ok('...and says why', b.toasts.some(t => re.test(t)), JSON.stringify(b.toasts));
    ok('...and saved nothing', b.saved === 0);
  });
  /* The lead's power does not come from the Admin screen. Admin is owned by the
     Plant Manager and the COO, so a gate on Admin-edit would mean no lead could
     ever use this panel. What a lead may do is decided by grantRefusal, and it
     holds whatever the screen says — including from the console. */
  {
    const b = panel('KAM');
    b.state.masters.accessMatrix['KAM'] = b.state.masters.accessMatrix['KAM'] || {};
    b.state.masters.accessMatrix['KAM'].admin = { v: false, e: false };
    eq('the Commercial lead has no access to the Admin screen at all',
       b.accessLevel('KAM', 'admin'), 'none');
    b.rightTick('Sales Officer', 'order.create', true);
    ok('and so cannot tick — a screen he cannot open is not a screen he can act on',
       b.state.masters.roleRights['sales-officer']['order.create'] !== true, 'it wrote anyway');
    /* VIEW is the requirement, not EDIT. Admin Edit is a broad grant (master
       data, recipes, lab templates) and letting it buy the rights panel would be
       the 2026-07-30 pattern again. */
    b.state.masters.accessMatrix['KAM'].admin = { v: true, e: false };
    b.rightTick('Sales Officer', 'order.create', true);
    eq('given VIEW on Admin he can manage his OWN department — the lead model',
       b.state.masters.roleRights['sales-officer']['order.create'], true);
    b.toasts = [];
    b.rightTick('Production', 'order.create', true);
    ok('but he still cannot reach outside it, screen or no screen',
       b.state.masters.roleRights['production']['order.create'] !== true, 'it wrote anyway');
    ok('...and is told why', b.toasts.some(t => /not in Commercial|Only the COO/.test(t)), JSON.stringify(b.toasts));
  }
  /* the card renders, and renders the things it claims to */
  {
    const b = panel('COO');
    const html = b.authCard();
    ok('the card renders', typeof html === 'string' && html.length > 500);
    ok('it names the department lead', /KAM/.test(html));
    ok('it shows the head count per role', /2 people/.test(html), html.slice(0, 300));
    ok('it marks rights that are not live yet', /not live yet/.test(html));
    ok('it marks the COO-only rights', /COO only/.test(html));
    ok('it wires the ticks to the writer', /rightTickById\(/.test(html));
    ok('and it uses ONE card key for every tab, so clicking a tab does not close it',
       (html.match(/<CARD authpanel>/g) || []).length === 1, html.slice(0, 120));

    /* the drift warning is on the screen, not only in this test file */
    ok('a clean model says so on the card', /Checked/.test(html));
    b.state.masters.roleRights['production']['order.create'] = true;
    const html2 = b.authCard();
    ok('and a drifted one WARNS on the card', /not match what the app does today/.test(html2));
    ok('...naming the role', /Production/.test(html2));
  }
  /* The GRID must show the same rules the writer enforces. A cell that looks
     tickable but is refused on click, or one that looks dead but writes, is a
     panel nobody can reason about. */
  {
    const b = panel('KAM');
    const html = b.authCard();
    const rowOf = code => {
      const i = html.indexOf(code);
      const cells = html.slice(i).split('</tr>')[0];
      return cells;
    };
    const dead = h => (h.match(/cursor:not-allowed/g) || []).length;
    const livec = h => (h.match(/cursor:pointer/g) || []).length;
    /* KAM is the lead: his own column must be dead on every row */
    ok('the lead\'s own column is not tickable in the grid',
       /rightTick\('KAM'/.test(html) === false, 'his own cells are wired to rightTick');
    /* the COO-only rights must be dead for the lead across the whole row */
    const cust = rowOf('Add a customer or dealer');
    ok('a COO-only right shows as untickable to the lead', dead(cust) > 0 && livec(cust) === 0, cust.slice(0, 200));
    /* an ordinary right must be tickable for somebody other than himself */
    b.state.masters.roles.push({ id: 'so2', name: 'Sales Officer 2', deptId: 'commercial', builtin: false, archived: false });
    b.seedDeptRightsV1(b.state);
    const html2 = b.authCard();
    const ord = html2.slice(html2.indexOf('Raise a new PO')).split('</tr>')[0];
    ok('an ordinary right IS tickable for somebody else in his department',
       /cursor:pointer/.test(ord) && /rightTickById\('so2'/.test(ord), ord.slice(0, 320));
    /* A separation rule must show in the grid, not only bite on the click. No
       pair is fully converted yet, so the second half is added here to make the
       case reachable — the same way section 4 does. */
    {
      const bs = panel('COO');
      bs.RIGHTS.push({ code: 'dc.approve', dept: 'commercial', name: 'Approve a delivery challan',
                       legacy: { kind: 'hard', roles: ['Plant Manager'] } });
      bs.seedDeptRightsV1(bs.state);
      ok('setting up: the KAM raises orders', bs.mayRole('KAM', 'order.create') === true);
      const row = bs.authCard();
      const dcRow = row.slice(row.indexOf('Approve a delivery challan')).split('</tr>')[0];
      ok('the KAM\'s DC cell is shown as untickable, not merely refused on click',
         /cursor:not-allowed/.test(dcRow), dcRow.slice(0, 260));
      ok('...and the cell says why, so nobody has to press it to find out',
         /already has/.test(dcRow) && /own delivery/.test(dcRow), dcRow.slice(0, 300));
      bs.RIGHTS.pop();
    }

    /* and to somebody who is not a lead at all, the whole grid is dead */
    const b3 = panel('Lab Rep');
    const html3 = b3.authCard();
    ok('a non-lead sees no tickable cell at all',
       !/cursor:pointer/.test(html3) && !/rightTickById\(/.test(html3), (html3.match(/rightTickById\([^)]{0,40}/) || [''])[0]);
  }

  /* a role in no department is shown, not hidden */
  {
    const b = panel('COO');
    b.state.masters.roles.push({ id: 'orphan', name: 'Stores Clerk', builtin: false, archived: false });
    const html = b.authCard();
    ok('a role with no department is surfaced', /in no department yet/.test(html));
    ok('...by name', /Stores Clerk/.test(html));
    ok('...with a way for the COO to file it', /setRoleDept\('orphan'/.test(html));
  }
  /* role names are typed by the COO and land inside HTML attributes */
  {
    const b = panel('COO');
    b.state.masters.roles.push({ id: 'x1', name: 'S" onfocus="alert(1)', deptId: 'commercial', builtin: false, archived: false });
    b.seedDeptRightsV1(b.state);
    const html = b.authCard();
    /* Between tags the name is only TEXT, and _pe is right there. The danger is
       an ATTRIBUTE: pull every title="…" and onclick="…" value and check none of
       them ended early and left the rest of the name as live markup. */
    const attrs = (html.match(/(?:title|onclick)="[^"]*"/g) || []);
    ok('there are attributes carrying the name at all', attrs.length > 0);
    /* If the escaping failed, the name's own quote would close the attribute and
       the rest of it would land as a REAL attribute — onfocus=" with a live
       quote. Escaped, it can only ever appear as onfocus=&quot;, which is inert
       text inside the value. So the thing to look for is the live form. */
    /* Only what is INSIDE a tag can become an attribute. Between tags the name
       is text, and _pe has already taken the angle brackets out of it. */
    const tags = html.match(/<[^>]*>/g) || [];
    const badTag = tags.filter(t => /\son\w+\s*=/.test(t) && !/on(?:click|change)\s*="(?:rightTick|setRoleDept|authPick)/.test(t));
    ok('no tag gained an event handler from a role name', badTag.length === 0, badTag.slice(0, 2).join(' | '));
    /* Since the handler moved to the role ID, the hostile NAME reaches no
       attribute at all — it is only text between tags. That is the stronger
       position: check it is really only text, and that angle brackets in a name
       cannot open a tag. */
    ok('the name appears only as text, never inside an attribute',
       (html.match(/(?:title|onclick)="[^"]*"/g) || []).every(a => !/onfocus/i.test(a)));
    /* The click handler carries the role's ID, which is [a-z0-9-] by
       construction, so a hostile NAME can never reach the JavaScript at all —
       and an ordinary apostrophe cannot break the handler either. */
    ok('the tick handler carries the role id, not its name',
       /rightTickById\('x1'/.test(html) && !/rightTickById\('S/.test(html),
       (html.match(/rightTickById\([^)]{0,40}/g) || []).join(' | ').slice(0, 200));
    b.state.masters.roles.push({ id: 'x2', name: '<img src=x onerror=alert(1)>', deptId: 'commercial', builtin: false, archived: false });
    b.seedDeptRightsV1(b.state);
    const html4 = b.authCard();
    ok('angle brackets in a role name cannot open a tag',
       !/<img src=x/.test(html4) && /&lt;img src=x/.test(html4),
       (html4.match(/.{0,30}img src=x.{0,20}/) || [''])[0]);
  }
}

/* ================= 14. the wiring, not just the parts ================= */
{
  /* The suite calls seedDeptRightsV1 by hand. That proves the function works;
     it does not prove the app ever calls it, or calls it after the roles exist. */
  const boot = H.grab('ensureState');
  const iRoles = boot.indexOf('seedRolesV1(s)');
  const iSeed = boot.indexOf('seedDeptRightsV1(s)');
  ok('ensureState calls seedDeptRightsV1 at boot', iSeed > 0, 'not called at all');
  ok('...AFTER the roles exist, or there would be nothing to seed', iRoles > 0 && iSeed > iRoles,
     'roles at ' + iRoles + ', seed at ' + iSeed);
  ok('GUARD: the Admin screen actually renders the panel', /\$\{authCard\(\)\}/.test(H.grab('screenAdmin')));
  /* Which right gates which control on Customer Master. Getting these the wrong
     way round lets somebody fill the whole form and lose it at the Save. */
  { const sd = H.grab('screenDealers');
    ok('GUARD: seeing Customer Master needs amend OR create',
       /var ed=may\('customer\.amend'\)\|\|may\('customer\.create'\)/.test(sd), sd.slice(0, 200));
    ok('GUARD: the Add button needs create specifically',
       /var edAdd=may\('customer\.create'\)/.test(sd) && /edAdd\?/.test(sd)); }
  ok('GUARD: addRole files the new role in a department',
     /deptId:\s*dept/.test(H.grab('addRole')) && /Pick the department/.test(H.grab('addRole')));
  ok('GUARD: rightTick asks grantRefusal before it writes',
     /grantRefusal\(state\.role,roleName,code\)/.test(H.grab('rightTick')));
  /* Deliberately NOT gated on Admin-edit: Admin belongs to the Plant Manager and
     the COO, so that gate would lock every department lead out of the panel
     built for him. grantRefusal is the rule, and it is asked at the writer. */
  ok('GUARD: rightTick does NOT hang the lead model off the Admin screen',
     !/screenEditOK\('admin'\)/.test(H.grab('rightTick')));
  ok('GUARD: and it writes nothing before grantRefusal has answered',
     H.grab('rightTick').indexOf('grantRefusal') < H.grab('rightTick').indexOf('roleRights'));
}

/* ================= 15. archived roles are still live authorities ================= */
/* archiveRole tells the COO "existing users keep it", and state.role comes from
   the login token — so an archived role still signs in and works. It is also
   invisible in the access matrix (rolesList filters it), so nothing can correct
   its grants from that side. Leaving it out of the freeze check is how a grant
   sits unreachable and unreported until the day it goes live. */
{
  const b = mk('COO');
  const sco = b.state.masters.roles.find(r => r.name === 'Supply Chain Officer');
  b.state.masters.accessMatrix['Supply Chain Officer'].entry = { v: true, e: true };
  b.resyncScreenRights('Supply Chain Officer', 'entry');
  eq('while active, it holds the right', b.state.masters.roleRights[sco.id]['order.create'], true);
  sco.archived = true;
  b.state.masters.accessMatrix['Supply Chain Officer'].entry = { v: false, e: false };
  eq('archived, the grant is still sitting there', b.state.masters.roleRights[sco.id]['order.create'], true);
  ok('and the freeze check REPORTS it rather than looking away',
     b.rightsFreezeCheck().some(x => /Supply Chain Officer/.test(x)), JSON.stringify(b.rightsFreezeCheck()));
  ok('...saying it is archived, so the COO knows why he cannot see it in the matrix',
     b.rightsFreezeCheck().some(x => /\(archived\)/.test(x)));
  b.seedDeptRightsV1(b.state);
  ok('the seed keeps giving an archived role a row — its users still sign in',
     !!b.state.masters.roleRights[sco.id]);
  sco.archived = false;
}

/* ================= 16. the panel shows everyone who HOLDS a right ================= */
/* Columns used to be the department's own roles only. Plant Manager holds
   order.create off the matrix and ten roles hold order.acknowledge because that
   gate never had a check — none of them was a column, so the card printed one
   column and five ticks and read as the whole answer. */
{
  const b = mk('COO');
  Object.assign(b, { toast: () => {}, save: () => {}, render: () => {}, logAction: () => {},
    acOpen: {}, authDept: 'commercial', $: () => null, usersList: [],
    acard: (k, t, h, body) => '<CARD>' + body + '</CARD>',
    _pe: x => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') });
  vm.runInContext(['_at', 'screenEditOK', 'accessLevel', 'authRepaint', 'rightTickById', 'rightTick', 'authPick', 'authDriftBanner', 'authCard']
                  .map(H.grab).join('\n\n'), b);
  const html = b.authCard();
  ok('setting up: the Plant Manager really does hold order.create',
     b.mayRole('Plant Manager', 'order.create') === true);
  ok('setting up: Production really does hold order.acknowledge',
     b.mayRole('Production', 'order.acknowledge') === true);
  ok('a right-holder from OUTSIDE the department gets a column', /Plant Manager/.test(html));
  ok('...and so does one that holds it only because the gate had no check', /Production/.test(html));
  ok('they are marked as not belonging to the department', /holds it/.test(html));
  ok('and the card says so in words', /not in this department but already/.test(html));
  /* the COO can take it away; the lead cannot reach outside his own department */
  eq('the COO may untick a guest', b.grantRefusal('COO', 'Plant Manager', 'order.create'), '');
  ok('the lead may not', b.grantRefusal('KAM', 'Plant Manager', 'order.create') !== '');
}

/* ================= 17. the headcount is real or it is a dash ================= */
/* state.users is the seeded demo list and is never refreshed from the server, so
   counting it printed a number that was always wrong — QCM as "0 people" next to
   the ticks that decide who signs a COA. */
{
  function card(users) {
    const b = mk('COO');
    Object.assign(b, { toast: () => {}, save: () => {}, render: () => {}, logAction: () => {},
      acOpen: {}, authDept: 'commercial', $: () => null, usersList: users,
      state: Object.assign(b.state, { users: [{ name: 'ghost', role: 'KAM' }, { name: 'ghost2', role: 'KAM' }] }),
      acard: (k, t, h, body) => '<CARD>' + body + '</CARD>',
      _pe: x => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') });
    vm.runInContext(['_at', 'screenEditOK', 'accessLevel', 'authRepaint', 'rightTickById', 'rightTick', 'authPick', 'authDriftBanner', 'authCard']
                    .map(H.grab).join('\n\n'), b);
    return b.authCard();
  }
  const none = card([]);
  ok('with no real user list, the card shows a dash, not an invented number',
     />—</.test(none) && !/2 people/.test(none), none.slice(0, 400));
  ok('...and never counts the seeded demo accounts', !/1 person/.test(none) && !/0 people/.test(none));
  const real = card([{ name: 'a', role: 'KAM' }, { name: 'b', role: 'KAM' }, { name: 'c', role: 'Production' }]);
  ok('with a real list, it counts THAT', /2 people/.test(real), real.slice(0, 400));
  ok('...and one person reads as one person', /1 person/.test(real));
}

/* ================= 18. the rest of the wiring ================= */
{
  /* rightTick needs the screen it lives on. Not Edit — Admin Edit is a broad
     grant and letting it buy the rights panel is the 2026-07-30 pattern. */
  {
    const b = mk('KAM');
    b.state.masters.roles.push({ id: 'so3', name: 'Sales Officer', deptId: 'commercial', builtin: false, archived: false });
    b.seedDeptRightsV1(b.state);
    Object.assign(b, { toasts: [], toast: m => b.toasts.push(m), save: () => {}, render: () => {}, logAction: () => {} });
    vm.runInContext(['accessLevel', 'authRepaint', 'rightTickById', 'rightTick'].map(H.grab).join('\n\n'), b);
    b.state.masters.accessMatrix['KAM'].admin = { v: false, e: false };
    b.rightTick('Sales Officer', 'order.create', true);
    ok('somebody who cannot open Admin at all cannot tick, even from the console',
       b.state.masters.roleRights['so3']['order.create'] !== true, 'it wrote anyway');
    ok('...and is told why', b.toasts.some(t => /Admin/.test(t)), JSON.stringify(b.toasts));
    b.state.masters.accessMatrix['KAM'].admin = { v: true, e: false };
    b.rightTick('Sales Officer', 'order.create', true);
    eq('but VIEW is enough — Edit on Admin must not be what buys this',
       b.state.masters.roleRights['so3']['order.create'], true);
    /* A tick for a role that does not exist writes nothing. Checked as the COO,
       because grantRefusal stops everybody else long before the id lookup — so
       as a lead this would pass whether the guard were there or not. */
    const c = mk('COO');
    Object.assign(c, { toasts: [], toast: m => c.toasts.push(m), save: () => {}, render: () => {}, logAction: () => {} });
    vm.runInContext(['accessLevel', 'authRepaint', 'rightTickById', 'rightTick'].map(H.grab).join('\n\n'), c);
    const before = JSON.stringify(c.state.masters.roleRights);
    c.rightTick('No Such Role', 'order.create', true);
    eq('a tick for a role that does not exist writes nothing',
       JSON.stringify(c.state.masters.roleRights), before);
    ok('...and says so', c.toasts.some(t => /Unknown role/.test(t)), JSON.stringify(c.toasts));
  }
  /* the seed never writes a row for the COO — he is not grantable */
  {
    const b = mk('COO');
    ok('no grant row is created for the COO', !b.state.masters.roleRights['coo'],
       JSON.stringify(Object.keys(b.state.masters.roleRights)));
  }
  /* a right that belongs to another department is refused even to a lead */
  {
    const b = mk('COO');
    b.state.masters.roles.push({ id: 'so4', name: 'Sales Officer', deptId: 'commercial', builtin: false, archived: false });
    b.RIGHTS.push({ code: 'shipment.load', dept: 'supply-chain', name: 'Load a truck', legacy: { kind: 'hard', roles: ['Supply Chain'] } });
    b.seedDeptRightsV1(b.state);
    b.state.masters.roleRights['kam']['shipment.load'] = true;   /* even if he somehow holds it */
    ok('a lead cannot hand out a right that belongs to another department',
       /belongs to Supply Chain/.test(b.grantRefusal('KAM', 'Sales Officer', 'shipment.load')),
       b.grantRefusal('KAM', 'Sales Officer', 'shipment.load'));
    b.RIGHTS.pop();
  }
  /* the stored department wins over the built-in constant */
  {
    const b = mk('COO');
    eq('the lead comes from the constant when the store agrees', b.deptLeadRole('commercial'), 'KAM');
    b.state.masters.departments.find(d => d.id === 'commercial').leadRoleId = 'plant-manager';
    eq('and from the STORE when they differ, so the COO can move a lead',
       b.deptLeadRole('commercial'), 'Plant Manager');
  }
  /* source wiring the behaviour tests cannot see */
  ok('GUARD: addRole refuses without a department and seeds the new role',
     /Pick the department/.test(H.grab('addRole')) && /seedDeptRightsV1\(state\)/.test(H.grab('addRole')));
  ok('GUARD: setRoleDept is COO only, like every other change to the org shape',
     /state\.role!=='COO'/.test(H.grab('setRoleDept')));
  ok('GUARD: setRoleDept refuses to strand a department without its lead',
     /new lead first/.test(H.grab('setRoleDept')));
  ok('GUARD: a matrix click is saved AND repaints the panel beside it',
     (H.grab('amxCycle').match(/save\(\)/g) || []).length >= 2 && /render\(\)/.test(H.grab('amxCycle')));
  ok('GUARD: custSave asks create on an add and amend on an edit, that way round',
     /f\.editing\?'customer\.amend':'customer\.create'/.test(H.grab('custSave')), H.grab('custSave').slice(0, 160));
  ok('GUARD: the vestigial seed flag is gone', !/_deptRightsSeedV1/.test(H.html));
}

/* ================= 19. the refusal must name somebody who can help ================= */
/* It used to name the department lead unconditionally. The lead cannot grant
   outside his own department, cannot grant a COO-only right, and today cannot
   even open the screen the panel lives on — so a CFO refused on New PO Entry
   was sent to a KAM who had no way to help, and lost a day. */
{
  const b = mk('CFO');
  const msg = b.denyRight('order.create', 'Submitting a PO');
  ok('it still says what was refused and who currently can', /Submitting a PO/.test(msg) && /KAM/.test(msg), msg);
  ok('it points at a real place, naming the screen it is actually on',
     /Admin.*Master Data.*Authorisation/.test(msg), msg);
  ok('it does NOT tell a CFO to ask the Commercial lead, who cannot grant it',
     !/Ask KAM/.test(msg), msg);
  ok('it names the COO, who can', /COO to grant it|COO to grant/.test(msg) || /Ask COO/.test(msg), msg);

  /* and when somebody CAN grant it, they are named */
  const c = mk('COO');
  c.state.masters.roles.push({ id: 'so9', name: 'Sales Officer', deptId: 'commercial', builtin: false, archived: false });
  c.state.masters.accessMatrix['KAM'].admin = { v: true, e: false };   /* the lead can now reach the panel */
  c.seedDeptRightsV1(c.state);
  c.state.role = 'Sales Officer';
  const msg2 = c.denyRight('order.create', 'Submitting a PO');
  ok('a Sales Officer IS told to ask his own lead, because the lead really can',
     /KAM/.test(msg2.split('Ask')[1] || ''), msg2);
  /* take the lead's screen access away again and he stops being named */
  c.state.masters.accessMatrix['KAM'].admin = { v: false, e: false };
  const msg3 = c.denyRight('order.create', 'Submitting a PO');
  ok('...and stops being named the moment he cannot reach the panel',
     !/KAM/.test(msg3.split('Ask')[1] || ''), msg3);
}

/* ================= 20. the grid shows what was SET ================= */
/* The tick used to be the answer the app gives TODAY, while the click wrote into
   the grant table. So the COO could untick a right, be told it was saved, and
   watch the cell stay green for ever — no way to read back what he had set, no
   way to tell "already done" from "not done yet". */
{
  function panel2(role) {
    const b = mk(role);
    b.state.masters.roles.push({ id: 'so10', name: 'Sales Officer', deptId: 'commercial', builtin: false, archived: false });
    b.seedDeptRightsV1(b.state);
    b.toasts = []; b.saved = 0;
    Object.assign(b, { toast: m => b.toasts.push(m), save: () => { b.saved++; }, render: () => {}, logAction: () => {},
      acOpen: {}, authDept: 'commercial', $: () => null, usersList: [],
      acard: (k, t, h, body) => '<CARD>' + body + '</CARD>',
      _pe: x => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') });
    vm.runInContext(['_at', 'screenEditOK', 'accessLevel', 'authRepaint', 'rightTickById', 'rightTick', 'authPick', 'authDriftBanner', 'authCard']
                    .map(H.grab).join('\n\n'), b);
    return b;
  }
  const b = panel2('COO');
  const cellOf = (html, right, col) => {
    const row = html.slice(html.indexOf(right)).split('</tr>')[0];
    const cells = row.split('<td');
    return cells[col] || '';
  };
  ok('setting up: the Plant Manager holds order.create today', b.mayRole('Plant Manager', 'order.create') === true);
  const before = b.authCard();
  ok('and the grid shows it granted', /Granted/.test(cellOf(before, 'Raise a new PO', 1)) ||
     /Granted/.test(before.slice(before.indexOf('Raise a new PO')).split('</tr>')[0]));
  b.rightTick('Plant Manager', 'order.create', false);
  eq('the untick is stored', b.state.masters.roleRights['plant-manager']['order.create'], false);
  const after = b.authCard();
  const pmRow = after.slice(after.indexOf('Raise a new PO')).split('</tr>')[0];
  ok('THE GRID CHANGES — the decision is visible', /Not granted/.test(pmRow), pmRow.slice(0, 400));
  ok('...and it says today\'s answer is still different', /today the app still says yes/.test(pmRow), pmRow.slice(0, 500));
  ok('...and offers to put it BACK, not to remove it again', /order\.create',true\)/.test(pmRow), pmRow.slice(0, 400));
  ok('the card counts what is set but not yet in force', /tick.{0,30}marked/.test(after), after.slice(-700));
  /* and a COO-only right the COO does change also shows */
  b.rightTick('Sales Officer', 'customer.create', true);
  const after2 = b.authCard();
  const cuRow = after2.slice(after2.indexOf('Add a customer or dealer')).split('</tr>')[0];
  ok('a COO-only grant shows as granted once he sets it', /Granted/.test(cuRow), cuRow.slice(0, 400));
}

/* ================= 21. the chain, end to end ================= */
/* A source grep for markRightDecided is satisfied by a call that is commented
   out. This runs the whole chain: tick through rightTick, then a matrix click
   through resyncScreenRights, and checks the decision survives. */
{
  const b = mk('COO');
  b.state.masters.roles.push({ id: 'so11', name: 'Sales Officer', deptId: 'commercial', builtin: false, archived: false });
  b.state.masters.accessMatrix['Sales Officer'] = { entry: { v: true, e: true } };
  b.seedDeptRightsV1(b.state);
  Object.assign(b, { toasts: [], toast: m => b.toasts.push(m), save: () => {}, render: () => {}, logAction: () => {} });
  vm.runInContext(['accessLevel', 'authRepaint', 'rightTickById', 'rightTick'].map(H.grab).join('\n\n'), b);
  eq('seeded from the matrix: he may raise a PO', b.state.masters.roleRights['so11']['order.create'], true);
  b.rightTick('Sales Officer', 'order.create', false);          /* the COO decides otherwise */
  eq('the COO unticks it', b.state.masters.roleRights['so11']['order.create'], false);
  b.state.masters.accessMatrix['Sales Officer'].entry = { v: true, e: true };
  b.resyncScreenRights('Sales Officer', 'entry');               /* an unrelated matrix click */
  eq('AND A LATER MATRIX CLICK DOES NOT PUT IT BACK',
     b.state.masters.roleRights['so11']['order.create'], false);
  /* a cell nobody has decided still follows the matrix */
  b.state.masters.accessMatrix['Sales Officer'].entry = { v: false, e: false };
  b.resyncScreenRights('Sales Officer', 'entry');
  eq('an undecided cell still follows the matrix',
     b.state.masters.roleRights['so11']['order.print_decision'], false);
}

/* ================= 22. the smaller guards ================= */
{
  /* moving a lead out of his own department */
  const b = mk('COO');
  Object.assign(b, { toasts: [], toast: m => b.toasts.push(m), save: () => {}, render: () => {}, logAction: () => {},
    _roleById: id => b.state.masters.roles.find(r => r.id === id) });
  vm.runInContext(H.grab('setRoleDept'), b);
  b.setRoleDept('kam', 'finance');
  eq('a department lead cannot be moved out, leaving his department without one',
     b.roleDeptId('KAM'), 'commercial');
  ok('...and is told to appoint a new lead first',
     b.toasts.some(t => /new lead first/.test(t)), JSON.stringify(b.toasts));
  b.toasts = [];
  b.setRoleDept('finance', 'commercial');
  eq('a role that is NOT a lead moves freely', b.roleDeptId('Finance'), 'commercial');

  /* an archived role that still holds a right is labelled as archived on the card */
  const c = mk('COO');
  const sco = c.state.masters.roles.find(r => r.name === 'Supply Chain Officer');
  sco.deptId = 'commercial';
  c.seedDeptRightsV1(c.state);
  c.state.masters.roleRights[sco.id]['order.create'] = true;
  sco.archived = true;
  Object.assign(c, { toast: () => {}, save: () => {}, render: () => {}, logAction: () => {},
    acOpen: {}, authDept: 'commercial', $: () => null, usersList: [],
    acard: (k, t, h, body) => '<CARD>' + body + '</CARD>',
    _pe: x => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') });
  vm.runInContext(['_at', 'screenEditOK', 'accessLevel', 'authRepaint', 'rightTickById', 'rightTick', 'authPick', 'authDriftBanner', 'authCard']
                  .map(H.grab).join('\n\n'), c);
  const html = c.authCard();
  ok('an archived role holding a right is shown', /Supply Chain Officer/.test(html));
  { /* Look in the COLUMN HEADER, not anywhere in the card — the drift banner
       also prints "(archived)", so a loose match passes with no label at all. */
    const head = html.slice(html.indexOf('<thead'), html.indexOf('</thead>'));
    const col = head.slice(head.indexOf('Supply Chain Officer'));
    ok('...and its column is marked archived, so the COO knows why the matrix has no cell for it',
       /archived/.test(col.split('</th>')[0]), col.slice(0, 260)); }
  ok('...and NOT called a guest, since it is in this department',
     !/Supply Chain Officer<\/b> (is|are) not in this department/.test(html));

  /* a matrix click repaints the panel WITHOUT rebuilding the screen */
  const amx = H.grab('amxCycle');
  ok('GUARD: the matrix fast path repaints only the auth card',
     /\$\('authwrap'\)/.test(amx) && /innerHTML=authCard\(\)/.test(amx), amx.slice(-300));
  { /* Comments stripped first — the note above this very line says the words
       "full render()", and matching prose instead of code is how a guard starts
       reporting on itself. */
    const code = amx.replace(/\/\*[\s\S]*?\*\//g, '');
    const fast = code.split('else {')[0];
    ok('GUARD: and does NOT full-render, which would eat half-typed master data',
       !/(^|[^.\w])render\(\)/.test(fast), fast.slice(-260));
    ok('GUARD: the no-element path still repaints normally',
       /(^|[^.\w])render\(\)/.test(code.split('else {')[1] || ''), code.slice(-160)); }
  ok('GUARD: the Admin screen gives the card the node to repaint',
     /id="authwrap"/.test(H.grab('screenAdmin')));
  /* The panel's OWN buttons must repaint the card, not the screen, for the same
     reason the matrix click does — half-typed master data sits beside them. */
  ok('GUARD: the department tabs repaint the card, not the screen',
     /authRepaint\(\)/.test(H.grab('authPick')) && !/(^|[^.\w])render\(\)/.test(H.grab('authPick')),
     H.grab('authPick'));
  ok('GUARD: so does a tick', /authRepaint\(\)/.test(H.grab('rightTick')));
  /* And the id-based entry point must not invent a role from an unknown id. */
  {
    const b = mk('COO');
    Object.assign(b, { toasts: [], toast: m => b.toasts.push(m), save: () => {}, render: () => {},
                       logAction: () => {}, $: () => null });
    vm.runInContext(['accessLevel', 'authRepaint', 'rightTickById', 'rightTick', 'authCard',
                     '_at', 'authDriftBanner', 'screenEditOK'].map(H.grab).join('\n\n'), b);
    b.acOpen = {}; b.authDept = 'commercial'; b.usersList = [];
    b.acard = (k, t, h, body) => body;
    b._pe = x => String(x == null ? '' : x);
    const before = JSON.stringify(b.state.masters.roleRights);
    b.rightTickById('no-such-id', 'order.create', true);
    eq('a tick from an unknown role id writes nothing',
       JSON.stringify(b.state.masters.roleRights), before);
    ok('...and says so', b.toasts.some(t => /Unknown role/.test(t)), JSON.stringify(b.toasts));
  }
}

console.log('\nAuthorisation model — departments, roles, rights: ' + pass + ' passed, ' + fail + ' failed');
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fail ? 1 : 0);
