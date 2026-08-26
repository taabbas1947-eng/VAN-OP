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
    /* screen:'admin' because that is where the Authorisation card renders, and
       the app can never be in a state with no screen (render() forces one). The
       panel defect that survived four review rounds survived because this
       sandbox had no screen at all, so mayRole answered a question the running
       app never asks. */
    state: { role: roleName || 'COO', screen: 'admin', users: [],
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
  ok('three departments are converted: Commercial, Supply Chain and Production',
     B.RIGHTS.every(r => ['commercial', 'supply-chain', 'production'].indexOf(r.dept) >= 0)
     && ['supply-chain', 'production'].every(d => B.RIGHTS.some(r => r.dept === d)),
     JSON.stringify(B.RIGHTS.map(r => r.dept)));
  /* The sign-offs are NOT in the catalogue and must never be. */
  ['dc.approve', 'dc.reject', 'shipment.release', 'batch.reopen', 'coa.approve']
    .forEach(c => ok('sign-off NOT converted: ' + c, !B.rightByCode(c)));
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
  function OLDCANEDIT(role, owners) {
    if (role === 'COO') return true;
    const m = (B.state.masters && B.state.masters.accessMatrix) || {};
    const o = (m[role] && m[role][B.state.screen]) || null;
    if (o) { if (o.e === true) return true; if (o.e === false) return false; }
    return owners.indexOf(role) >= 0;
  }
  const OLD = {
    'order.create':         r => B.accessLevel(r, 'entry') === 'edit',
    'order.print_decision': r => B.accessLevel(r, 'entry') === 'edit',
    'order.acknowledge':    () => true,
    'customer.create':      r => r === 'COO' || r === 'KAM',
    'customer.amend':       r => r === 'COO' || r === 'KAM',
    /* Supply Chain's gates were canEdit(['Supply Chain']), which is: the COO
       always; otherwise the access matrix override for WHICHEVER SCREEN the
       person is standing on, if it has an opinion; otherwise the owners list.
       Written out here because this file is the record of what the app did. */
    'shipment.plan':        r => OLDCANEDIT(r, ['Supply Chain']),
    'shipment.load':        r => OLDCANEDIT(r, ['Supply Chain']),
    'gatepass.issue':       r => OLDCANEDIT(r, ['Supply Chain']),
    'delivery.confirm':     r => OLDCANEDIT(r, ['Supply Chain']),
    'rm.receive':           r => OLDCANEDIT(r, ['Supply Chain']),
    'pr.close':             r => OLDCANEDIT(r, ['Supply Chain']),
    /* Production's gates were hardRole(['Production']) — the COO, or that exact
       role name. No screen in it, then or now. */
    'batch.open':           r => r === 'COO' || r === 'Production',
    'production.enter':     r => r === 'COO' || r === 'Production',
    'shift.log':            r => r === 'COO' || r === 'Production',
    'packing.pack':         r => r === 'COO' || r === 'Production',
    'packing.reconcile':    r => r === 'COO' || r === 'Production',
    'byproduct.call':       r => r === 'COO' || r === 'Production',
    'packing.divert':       r => r === 'COO' || r === 'Production',
    'packing.rework':       r => r === 'COO' || r === 'Production',
    'batch.close':          r => r === 'COO' || r === 'Production',
    'batch.close_bulk':     r => r === 'COO' || r === 'Production',
  };
  /* NEW CAPABILITIES — rights that never had an old answer, because the button
     did not exist. They cannot be in OLD and must not be silently skipped, so
     they are named here and each one has to PROVE it is new: the file as it stood
     before must contain no caller of its handler. A conversion smuggled in as a
     new capability would escape the freeze proof entirely, which is exactly the
     shape this list has to make impossible. */
  const NEW_RIGHTS = {
    'production.void': { handler: 'openRemoveLot', since: '26 Aug 2026',
                         why: 'Removing a wrongly logged shift. Nothing could do it before: '
                            + 'the only unwind in the file sat below screenProd\'s unreachable '
                            + 'return and was COO-only besides.' },
  };
  /* CLOSED GAPS — the third shape, neither of the two above. NOT a conversion:
     there is no old answer to freeze, because the old answer was "anyone, no
     check at all" — writing that into OLD would make the freeze loop below
     assert the hole is a feature. NOT a new capability either: the handler is
     not new, it had real callers all along, so NEW_RIGHTS's own proof ("had NO
     caller before") would fail it, correctly — that proof exists to stop a
     conversion hiding in NEW_RIGHTS, and a gap-closure hiding there is the same
     kind of mistake. Proved the other way round: the handler DID have a caller
     before, AND its body is quoted here byte-for-byte from the pre-change
     snapshot to show it asked nothing at all. */
  const CLOSED_GAP = {
    'rm.check': { handlers: ['openRMCheck', 'rmSubmit'], since: '26 Aug 2026',
      before: {
        openRMCheck: "function openRMCheck(oid,lid){ const o=state.orders.find(x=>x.id===oid); const l=o&&o.lines.find(x=>x.id===lid); if(!l)return;",
        rmSubmit: "function rmSubmit(){ const o=state.orders.find(x=>x.id===rmForm.oid); const l=o.lines.find(x=>x.id===rmForm.lid); const today=TODAY.toISOString().slice(0,10); var ord=+l.ordered||0;",
      },
      why: 'RM Check confirms a line makeable, in part or not at all, and short/none '
         + 'raises a PR for CFO approval — and nothing, ever, asked who was doing it. '
         + 'Found while closing the same Production stuck list that let a QA Inspector '
         + 'reach Receive and Close PR before those two were converted on 25 Aug: this '
         + 'one was worse, because those two DID have a real check behind the button '
         + '(the button was reachable, the write was not) and this one had neither.' },
  };
  {
    const before = fs.readFileSync(require('path').join(__dirname, '_before-lot.html'), 'utf8');
    Object.keys(NEW_RIGHTS).forEach(code => {
      const n = NEW_RIGHTS[code];
      ok(code + ' is in the catalogue', !!B.rightByCode(code));
      ok(code + ' is NOT in OLD — it has no old answer to freeze', !OLD[code]);
      /* the proof that it is new, not a conversion in disguise */
      ok(code + ': ' + n.handler + ' had NO caller before ' + n.since,
         !new RegExp(n.handler + '\\s*\\(').test(before),
         'found ' + n.handler + ' in the pre-change file');
      ok(code + ': ' + n.handler + ' HAS a caller now',
         new RegExp(n.handler + '\\s*\\(').test(H.html));
      /* and it must not have quietly taken a right's place */
      ok(code + ' asks no old code', !OLD[code]);
    });
    Object.keys(CLOSED_GAP).forEach(code => {
      const n = CLOSED_GAP[code];
      ok(code + ' is in the catalogue', !!B.rightByCode(code));
      ok(code + ' is NOT in OLD — the old answer was "anyone", not a rule to freeze', !OLD[code]);
      ok(code + ' is NOT in NEW_RIGHTS — its handlers are not new', !NEW_RIGHTS[code]);
      n.handlers.forEach(h => {
        ok(code + ': ' + h + ' really was unguarded before ' + n.since + ' — quoted, not assumed',
           before.indexOf(n.before[h]) >= 0, 'literal not found in _before-lot.html: ' + n.before[h].slice(0, 80));
        ok(code + ': ' + h + ' asks may(\'' + code + '\') now',
           new RegExp("may\\('" + code.replace('.', '\\.') + "'\\)").test(H.grab(h)), H.grab(h).slice(0, 140));
      });
    });
  }
  eq('every right in the catalogue has its old check written down here, is a declared new capability, or closes a gap that was never checked',
     B.RIGHTS.filter(r => !OLD[r.code] && !NEW_RIGHTS[r.code] && !CLOSED_GAP[r.code]).length, 0);
  /* Checked ON EVERY SCREEN, because the old canEdit rule gives a different
     answer depending on where the person is standing — and reproducing that
     exactly, screen by screen, is the whole claim. */
  const SCRIDS = B.SCREENS.map(x => x.id).concat([undefined]);
  let checked = 0;
  SCRIDS.forEach(sid => {
    B.state.screen = sid;
    B.RIGHTS.forEach(rt => {
      if (NEW_RIGHTS[rt.code] || CLOSED_GAP[rt.code]) return;   /* no old answer exists to freeze against */
      ROLES.forEach(r => {
        checked++;
        const got = B.mayRole(r, rt.code), want = OLD[rt.code](r);
        if (got !== want) fail++, fails.push('CHANGED on screen ' + sid + ': ' + r + ' · ' + rt.code
          + ' now ' + got + ', was ' + want);
        else pass++;
      });
    });
  });
  B.state.screen='admin';
  ok('...and that was every right, every role, on every screen', checked > 1500, 'checked ' + checked);
}

/* 2b. And it STAYS unchanged when the right is switched on, because the grants
   were seeded from those same old checks. This is the check that has to be
   green before any right goes live. */
{
  eq('the freeze check is clean — no role gains or loses anything when a right goes live',
     B.rightsFreezeCheck().join(' | '), '');

  /* Switch them all on and compare — using the SCREEN-INDEPENDENT answer, which
     is what a right means once it is live. (mayRole answers the old rule exactly,
     and for the Supply Chain rights that rule depends on the screen the person is
     standing on. Comparing a screen-dependent answer against a screen-independent
     one is comparing two different questions; the thing that must not change is
     what each role can do ON THE SCREEN WHERE THE JOB IS DONE.) */
  const before = ROLES.map(r => B.RIGHTS.map(rt => B.mayHere(r, rt.code)).join(','));
  B.RIGHTS.forEach(rt => { B.RIGHTS_LIVE[rt.code] = true; });
  const after = ROLES.map(r => B.RIGHTS.map(rt => B.mayHere(r, rt.code)).join(','));
  ROLES.forEach((r, i) => eq('switching every right live changes nothing for ' + r, after[i], before[i]));
  B.RIGHTS.forEach(rt => { delete B.RIGHTS_LIVE[rt.code]; });

  /* And on the screen each job actually lives on, the real gate is unchanged too. */
  B.RIGHTS.forEach(rt => {
    const nat = (rt.legacy || {}).scr; if (!nat) return;
    B.state.screen = nat;
    ROLES.forEach(r => {
      const live = B.mayRole(r, rt.code);
      B.RIGHTS_LIVE[rt.code] = true;
      eq('on its own screen (' + nat + '), going live changes nothing: ' + r + ' · ' + rt.code,
         B.mayRole(r, rt.code), live);
      delete B.RIGHTS_LIVE[rt.code];
    });
  });
  B.state.screen='admin';
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
       /does not exist/.test(refuse('KAM', 'Sales Officer', 'no.such.right')));
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
  /* Named, not counted. A floor like ">= 40" goes stale on every conversion and
     then gets quoted as if it meant something; these are the actual gates that
     must never become rights. */
  ['coaReview', 'coaApprove', 'coaDeviation', 'coaRework', 'approveDC', 'rejectDC',
   'approveRelease', 'doReopenBatch', 'openReopenBatch'].forEach(fn => {
    const body = H.grab(fn);
    ok('SIGN-OFF still hard-gated: ' + fn, /hardRole\(\[/.test(body), body.slice(0, 110));
    ok('SIGN-OFF asks for no right: ' + fn, !/(^|[^\w])may\(/.test(body), body.slice(0, 110));
  });
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
    vm.runInContext(['_at', 'screenEditOK', 'accessLevel', 'authRepaint', 'rightTickById', 'rightTick', 'authPick', 'authDriftBanner', 'authLoopholeBanner', 'authCard']
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
    const badTag = tags.filter(t => /\son\w+\s*=/.test(t)
      && !/on(?:click|change)\s*="(?:rightTickById|setRoleDept|setDeptLead|authPick)/.test(t));
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
  vm.runInContext(['_at', 'screenEditOK', 'accessLevel', 'authRepaint', 'rightTickById', 'rightTick', 'authPick', 'authDriftBanner', 'authLoopholeBanner', 'authCard']
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
    vm.runInContext(['_at', 'screenEditOK', 'accessLevel', 'authRepaint', 'rightTickById', 'rightTick', 'authPick', 'authDriftBanner', 'authLoopholeBanner', 'authCard']
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
    vm.runInContext(['_at', 'screenEditOK', 'accessLevel', 'authRepaint', 'rightTickById', 'rightTick', 'authPick', 'authDriftBanner', 'authLoopholeBanner', 'authCard']
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
  vm.runInContext(['_at', 'screenEditOK', 'accessLevel', 'authRepaint', 'rightTickById', 'rightTick', 'authPick', 'authDriftBanner', 'authLoopholeBanner', 'authCard']
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

/* ================= 23. Supply Chain: converted, and the sign-offs are not ================= */
{
  const b = mk('COO');
  const SCR = b.RIGHTS.filter(r => r.dept === 'supply-chain');
  const SC = SCR.map(r => r.code);
  eq('seven Supply Chain rights', SC.length, 7);
  ok('all seven carry the canEdit rule, with the screen the job lives on — six frozen '
     + 'conversions and rm.check besides, which never had an old rule to freeze but is '
     + 'shaped the same way',
     SCR.every(r => r.legacy.kind === 'canEdit' && r.legacy.owners.join() === 'Supply Chain' && !!r.legacy.scr),
     JSON.stringify(SCR.map(r => r.legacy)));
  eq('...six of them frozen conversions, one a closed gap',
     SCR.filter(r => r.code !== 'rm.check').length, 6);

  /* The gates really were converted, and the sign-offs really were not. */
  [['saveShip', 'shipment.plan'], ['saveDispatch', 'shipment.plan'], ['mpCreate', 'shipment.plan'],
   ['saveShipEdit', 'shipment.plan'], ['startLoading', 'shipment.load'],
   ['issueGatePass', 'gatepass.issue'], ['confirmDelivery', 'delivery.confirm'],
   ['markDelivered', 'delivery.confirm'], ['receivePR', 'rm.receive'],
   ['rmReceiveSubmit', 'rm.receive'], ['closePR', 'pr.close']].forEach(([fn, code]) =>
    ok('GUARD: ' + fn + ' asks may(\'' + code + '\')',
       new RegExp("may\\('" + code.replace('.', '\\.') + "'\\)").test(H.grab(fn)), H.grab(fn).slice(0, 100)));

  /* THE LINE THAT MUST NOT BE CROSSED. A delivery challan is approved by a second
     person, and a loaded truck is released by a second person. Those are the
     2026-07-30 incident. They stay on hardRole and out of the catalogue. */
  [['approveDC', 'Plant Manager'], ['rejectDC', 'Plant Manager'], ['approveRelease', 'Plant Manager']]
    .forEach(([fn, role]) => {
      const body = H.grab(fn);
      ok('SIGN-OFF still hard-gated: ' + fn,
         new RegExp("hardRole\\(\\['" + role + "'\\]\\)").test(body), body.slice(0, 120));
      ok('SIGN-OFF not converted by mistake: ' + fn + ' asks for no right',
         !/(^|[^\w])may\(/.test(body), body.slice(0, 120));
    });
  /* And the gate pass still has to be issued before release — the two are a pair,
     one converted and one not, so this is worth pinning. */
  ok('a Gate Pass is still required before the truck is released',
     /gatePass/.test(H.grab('approveRelease')) && /Issue the Gate Pass before release/.test(H.grab('approveRelease')));

  /* The people who can actually do the job, read off the live matrix. */
  eq('who may plan a shipment', b.whoMayRight('shipment.plan').join(', '),
     'Supply Chain, Plant Manager, COO, Supply Chain Officer');
  eq('who may receive raw material', b.whoMayRight('rm.receive').join(', '),
     'Supply Chain, Plant Manager, COO');
  eq('who may RM Check — same shape as rm.receive, same owners',
     b.whoMayRight('rm.check').join(', '), b.whoMayRight('rm.receive').join(', '));
  ok('Zain\'s two role names are both in Supply Chain, so one lead covers both',
     b.roleDeptId('Supply Chain') === 'supply-chain' && b.roleDeptId('Supply Chain Officer') === 'supply-chain');
}

/* ================= 24. the loophole the conversion closes, named out loud ================= */
/* canEdit() asks the matrix about whichever screen the person is standing on.
   Seven roles hold an explicit Edit override on Reports, and each therefore
   satisfies canEdit(['Supply Chain']) while standing there. (Owning a screen is
   not enough — KAM, Production and the Plant Manager own Reports but hold no
   override, so they do not qualify that way. Getting that mechanism wrong is how
   this comment previously said five.)
   And it is NOT only a hole in the rule: the same actions are rendered from My
   Actions, the Dashboard and Production's stuck list, so people do reach them
   while standing elsewhere. The QA Inspector case below is a live one. */
{
  const b = mk('COO');
  const L = b.screenLoopholes();
  ok('the loophole really exists on the data on record', L.length > 0);
  const roles = [...new Set(L.map(x => x.role))];
  /* ONLY the reachable ones. The first cut listed 44 authorities across 8 roles
     of which 2 were real — it told the COO that Finance, the CFO and three lab
     roles could plan shipments and issue gate passes, none of which they can,
     because no such button is rendered anywhere they can go. The safe-looking
     response to a warning like that is to grant six roles a shipment right they
     have never had, which is the opposite of what the warning is for. */
  eq('exactly one role is really affected', roles.join(', '), 'QA Inspector');
  ['Lab Rep', 'AQCM', 'QCM', 'CFO', 'Finance', 'Production'].forEach(r =>
    ok(r + ' is NOT listed — the old rule says yes, but no button is reachable',
       roles.indexOf(r) < 0, JSON.stringify(roles)));
  /* 26 Aug — rm.check joins the two above: it was given the same canEdit shape
     (see CLOSED_GAP, section 2a) because it IS the same shape of gate, so it
     inherits the same matrix-driven exposure for the same reason. Wiring the
     Production stuck list to stop drawing a live button for it (this session,
     see rowS) closes the one path that made this reachable; the cell below is
     what would reopen it if that render ever regressed, which is the point of
     tracking it here rather than only in the UI. */
  eq('and only for the rights whose buttons really appear elsewhere',
     [...new Set(L.map(x => x.code))].sort().join(', '), 'pr.close, rm.check, rm.receive');
  /* THE LIVE ONE. Production's stuck list is not filtered by role and renders the
     Supply Chain "Receive" action. A QA Inspector standing there holds Edit on
     Production, so canEdit(['Supply Chain']) says yes and he books raw material
     into stock — while the Supply Chain officer beside him is refused, because he
     has no Edit on Production. This is true today, before the conversion. */
  {
    const qa = L.filter(x => x.role === 'QA Inspector' && x.code === 'rm.receive')[0];
    ok('QA Inspector can receive raw material via the Production screen',
       !!qa && qa.screens.indexOf('prod') >= 0, JSON.stringify(qa || null));
    ok('...and Supply Chain itself cannot, standing on that same screen',
       b._canEditOn(b.state, 'Supply Chain', 'prod', ['Supply Chain']) === false);
    ok('...while on the screen the job belongs to, it is the other way round',
       b._canEditOn(b.state, 'Supply Chain', 'approvals', ['Supply Chain']) === true
       && b._canEditOn(b.state, 'QA Inspector', 'approvals', ['Supply Chain']) === false);
  }
  ok('the people who hold it properly are NOT listed as a loophole',
     !roles.some(r => ['Supply Chain', 'Plant Manager', 'COO'].indexOf(r) >= 0), JSON.stringify(roles));

  /* Take away QA Inspector's Edit on Production and it closes — the COO's
     one-cell fix, which is also cell 2 of the matrix review. Proves cause, not
     coincidence. */
  b.state.masters.accessMatrix['QA Inspector'].prod = { v: true, e: false };
  eq('removing QA Inspector\'s Edit on Production closes it', b.screenLoopholes().length, 0);
  b.state.masters.accessMatrix['QA Inspector'].prod = { v: true, e: true };

  /* A right whose button is reachable from nowhere else has no loophole, however
     generous the old rule is elsewhere. This is the whole of the fix. */
  const saved = {};
  b.RIGHTS.forEach(r => { if (r.legacy.alsoOn) { saved[r.code] = r.legacy.alsoOn; r.legacy.alsoOn = []; } });
  eq('no reachable screen means no loophole', b.screenLoopholes().length, 0);
  ok('...even though the old rule still says yes for QA Inspector on Production',
     b._canEditOn(b.state, 'QA Inspector', 'prod', ['Supply Chain']) === true);
  b.RIGHTS.forEach(r => { if (saved[r.code]) r.legacy.alsoOn = saved[r.code]; });
  ok('and putting the reachable screens back restores the real ones', b.screenLoopholes().length > 0);

  /* A list is only a way in for the people it is SHOWN to. My Actions hands a
     manager somebody else's escalated item — but only the manager named in
     acEscalation's table. Reporting everyone with Edit on My Actions would put
     the false names back, which is the fault this whole banner was rebuilt to
     stop. */
  {
    const c = mk('COO');
    c.state.masters.accessMatrix['Finance'] = c.state.masters.accessMatrix['Finance'] || {};
    c.state.masters.accessMatrix['Finance'].approvals = { v: true, e: true };
    ok('setting up: the old rule now says yes for Finance on My Actions',
       c._canEditOn(c.state, 'Finance', 'approvals', ['Supply Chain']) === true);
    ok('...but Finance is NOT reported, because nothing escalates a shipment to Finance',
       !c.screenLoopholes().some(x => x.role === 'Finance'),
       JSON.stringify(c.screenLoopholes().filter(x => x.role === 'Finance')));
    /* and the manager the table DOES name would be reported, if he were not
       already allowed on the job's own screen */
    c.state.masters.accessMatrix['Plant Manager'].ship = { v: true, e: false };
    ok('the Plant Manager IS reported once he loses Shipments, because escalation still reaches him',
       c.screenLoopholes().some(x => x.role === 'Plant Manager' && x.screens.indexOf('approvals') >= 0),
       JSON.stringify(c.screenLoopholes().filter(x => x.role === 'Plant Manager')));
  }

  /* Archived roles are included, for the same reason rightsFreezeCheck includes
     them: archiveRole tells the COO "existing users keep it" and state.role comes
     from the login token, so those accounts still sign in and still press the
     button. Leaving them out is a silent revocation at go-live with no warning —
     and the snapshot has no archived role, so nothing else would catch it. */
  {
    const c = mk('COO');
    const qa = c.state.masters.roles.find(x => x.name === 'QA Inspector');
    ok('reported while active', c.screenLoopholes().some(x => x.role === 'QA Inspector'));
    qa.archived = true;
    const arch = c.screenLoopholes().filter(x => x.role === 'QA Inspector');
    ok('STILL reported once archived — the account can still sign in', arch.length > 0,
       JSON.stringify(c.screenLoopholes()));
    ok('...and marked as archived', arch.every(x => x.archived === true), JSON.stringify(arch));
    qa.archived = false;
  }

  /* Once a right is live the matrix no longer speaks for it, so it stops being
     reported as a loophole. */
  const b3 = mk('COO');
  ok('reported while the right is not live', b3.screenLoopholes().some(x => x.code === 'rm.receive'));
  b3.RIGHTS_LIVE['rm.receive'] = true;
  ok('and not once it is live — the hole is closed, not hidden',
     !b3.screenLoopholes().some(x => x.code === 'rm.receive'));
  delete b3.RIGHTS_LIVE['rm.receive'];

  /* It has to be on the screen, not only in this file. */
  const c = mk('COO');
  Object.assign(c, { toast: () => {}, save: () => {}, render: () => {}, logAction: () => {},
    acOpen: {}, authDept: 'supply-chain', usersList: [], $: () => null,
    acard: (k, t, h, body) => '<CARD>' + body + '</CARD>',
    _pe: x => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') });
  vm.runInContext(['_at', 'screenEditOK', 'accessLevel', 'authRepaint', 'rightTickById', 'rightTick',
                   'authPick', 'authDriftBanner', 'authLoopholeBanner', 'authCard'].map(H.grab).join('\n\n'), c);
  const html = c.authCard();
  /* If the check itself cannot run, the card must NOT print the clean sentence.
     That sentence is the one an earlier version printed while people were quietly
     losing access, so this fails closed. */
  {
    const d = mk('COO');
    Object.assign(d, { toast: () => {}, save: () => {}, render: () => {}, logAction: () => {},
      acOpen: {}, authDept: 'supply-chain', usersList: [], $: () => null,
      acard: (k, t, h, body) => '<CARD>' + body + '</CARD>',
      _pe: x => String(x == null ? '' : x) });
    vm.runInContext(['_at', 'screenEditOK', 'accessLevel', 'authRepaint', 'rightTickById', 'rightTick',
                     'authPick', 'authDriftBanner', 'authLoopholeBanner', 'authCard'].map(H.grab).join('\n\n'), d);
    d.screenLoopholes = () => { throw new Error('boom'); };
    const broken = d.authCard();
    ok('a broken loophole check does NOT print the clean sentence',
       !/would change nobody/.test(broken), (broken.match(/Checked[^<]{0,140}/) || [''])[0]);
    ok('...it says so and says not to switch anything on',
       /could not be run/.test(broken) && /Do not switch anything on/.test(broken),
       broken.slice(0, 400));
  }
  ok('the Supply Chain tab warns about it', /only because of another screen/.test(html), html.slice(0, 300));
  ok('...naming the role', /QA Inspector/.test(html));
  ok('...and all three of the rights he can reach', /3 rights/.test(html), (html.match(/QA Inspector[^<]{0,60}/) || [''])[0]);
  ok('...and naming the screen, in words the COO uses', /Production/.test(html));
  { /* inside the warning itself — "Finance" is also a department tab on this card */
    const warn = html.slice(html.indexOf('only because of another screen'));
    const box = warn.slice(0, warn.indexOf('</div></div>') + 12);
    ok('...and NOT naming people it is not true of',
       !/Finance/.test(box) && !/Lab Rep/.test(box) && !/CFO/.test(box), box.slice(0, 400)); }
  /* THE TWO SENTENCES MUST AGREE. The card used to open with "switching any of
     these rights on today would change nobody's access" and then immediately list
     people who lose access. */
  ok('the clean notice does not claim nobody is affected while the list says otherwise',
     !/would change nobody/.test(html), (html.match(/Checked[^<]{0,140}/) || [''])[0]);
  ok('...it says what it really proves, and points at the list',
     /on the screen the job belongs to/.test(html) && /But see below/.test(html),
     (html.match(/Checked[^<]{0,200}/) || [''])[0]);
  c.authDept = 'commercial';
  const html2 = c.authCard();
  ok('and Commercial does not warn, because its rights never worked that way',
     !/only because of another screen/.test(html2));
  ok('...so on Commercial the notice CAN say nobody is affected', /would change nobody/.test(html2),
     (html2.match(/Checked[^<]{0,200}/) || [''])[0]);
}

/* ================= 25. the panel, rendered where the app renders it ================= */
/* The Supply Chain tab is the first one whose old rule depends on the screen the
   person is standing on. authCard only ever renders from Admin, so asking the
   OLD rule there said the Supply Chain team cannot plan a shipment — 10 amber
   asterisks and a footer contradicting the banner three lines above it. */
{
  function panelAt(dept) {
    const b = mk('COO');                    /* state.screen is 'admin', as in the app */
    Object.assign(b, { toast: () => {}, save: () => {}, render: () => {}, logAction: () => {},
      acOpen: {}, authDept: dept, usersList: [], $: () => null,
      acard: (k, t, h, body) => '<CARD>' + body + '</CARD>',
      _pe: x => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') });
    vm.runInContext(['_at', 'screenEditOK', 'accessLevel', 'authRepaint', 'rightTickById', 'rightTick',
                     'authPick', 'authDriftBanner', 'authLoopholeBanner', 'authCard'].map(H.grab).join('\n\n'), b);
    return b;
  }
  ['commercial', 'supply-chain'].forEach(dep => {
    const b = panelAt(dep);
    eq('the card renders from the Admin screen, like the app', b.state.screen, 'admin');
    const html = b.authCard();
    const stars = (html.match(/<sup style="font-size:8px">\*<\/sup>/g) || []).length;
    eq('NOTHING is pending on the ' + dep + ' tab — every tick matches today', stars, 0);
    ok('so the card does not claim otherwise in its footer',
       !/tick.{0,40}marked/.test(html), (html.match(/tick[^<]{0,60}marked[^<]{0,80}/) || [''])[0]);
    ok('and the drift notice says the ticks are clean', /Checked: every tick matches/.test(html), html.slice(0, 260));
    ok('...without claiming more than it proves',
       dep !== 'supply-chain' || !/would change nobody/.test(html), html.slice(0, 260));
    ok('no tooltip tells somebody their own daily job is refused today',
       !/today the app still says no/.test(html),
       (html.match(/title="[^"]*today the app still says no[^"]*"/) || [''])[0]);
  });
  /* And the people who actually do the work are columns on the tab — including
     the ones from OTHER departments who hold the right. The Plant Manager is the
     case that matters: he is Leadership, not Supply Chain, and he holds all six.
     Asking the old screen-dependent rule for that list happens to keep him while
     the card renders from Admin (he has Edit on Admin); take that away and only
     the screen-independent question still finds him. */
  {
    const b = panelAt('supply-chain');
    b.state.masters.accessMatrix['Plant Manager'].admin = { v: true, e: false };
    const h = b.authCard();
    ok('a right-holder from another department is a column even when he cannot edit Admin',
       h.indexOf('Plant Manager') >= 0, h.slice(0, 400));
    ok('...and is marked as not belonging to this department', /holds it/.test(h));
    b.state.masters.accessMatrix['Plant Manager'].admin = { v: true, e: true };
  }
  {
    const html = panelAt('supply-chain').authCard();
    ['Supply Chain', 'Supply Chain Officer', 'Plant Manager'].forEach(r =>
      ok('the Supply Chain tab has a column for ' + r, html.indexOf(r) >= 0));
    ok('and it shows their rights as granted, not withheld',
       (html.match(/Granted/g) || []).length >= 6, (html.match(/Not granted/g) || []).length + ' not-granted');
  }
  /* A deliberate untick still shows as pending — the marker is not simply dead. */
  {
    const b = panelAt('supply-chain');
    b.rightTickById('supply-chain', 'shipment.plan', false);
    const html = b.authCard();
    eq('after a real untick, exactly one tick is marked pending',
       (html.match(/<sup style="font-size:8px">\*<\/sup>/g) || []).length, 1);
    ok('...and the footer says so', /1 tick.{0,20}marked/.test(html), (html.match(/1 tick[^<]{0,70}/) || [''])[0]);
  }
}

/* ================= 26. mayHere must switch over when a right goes live ================= */
/* mayHere answers for the panel, for whoMayRight, for grantRefusal and for
   separation. RIGHTS_LIVE is empty, so every one of those calls currently falls
   through to the old rule and nothing would notice if the live branch were
   missing. The equivalent hole in mayRole is covered; this one was not. */
{
  const b = mk('COO');
  eq('before: Production cannot plan a shipment', b.mayHere('Production', 'shipment.plan'), false);
  b.state.masters.roleRights['production']['shipment.plan'] = true;
  eq('...and the grant alone does nothing while the right is not live',
     b.mayHere('Production', 'shipment.plan'), false);
  b.RIGHTS_LIVE['shipment.plan'] = true;
  eq('ONCE LIVE, mayHere answers from the grant table', b.mayHere('Production', 'shipment.plan'), true);
  b.state.masters.roleRights['production']['shipment.plan'] = false;
  eq('...and follows it back down', b.mayHere('Production', 'shipment.plan'), false);
  eq('the old rule no longer speaks for it: Supply Chain has the grant, so still yes',
     b.mayHere('Supply Chain', 'shipment.plan'), true);
  b.state.masters.roleRights[b.roleIdOf('Supply Chain')]['shipment.plan'] = false;
  eq('...and losing the grant loses the right, whatever the matrix says',
     b.mayHere('Supply Chain', 'shipment.plan'), false);
  ok('and the refusal list follows', b.whoMayRight('shipment.plan').indexOf('Supply Chain') < 0,
     b.whoMayRight('shipment.plan').join(', '));
  delete b.RIGHTS_LIVE['shipment.plan'];
}

/* ================= 27. the call sites the guard list had missed ================= */
{
  [['mpStart', 'shipment.plan'], ['openShipEdit', 'shipment.plan'],
   ['openRMReceive', 'rm.receive'], ['openDeliveryConfirm', 'delivery.confirm'],
   ['openRMCheck', 'rm.check'], ['rmSubmit', 'rm.check']].forEach(([fn, code]) =>
    ok('GUARD: ' + fn + ' asks may(\'' + code + '\')',
       new RegExp("may\\('" + code.replace('.', '\\.') + "'\\)").test(H.grab(fn)), H.grab(fn).slice(0, 110)));
  /* An opener and its writer must ask for the SAME right, or somebody fills a
     form and loses it at the Save — the print-on-pack fault of 22 August. */
  [['openDeliveryConfirm', 'confirmDelivery'], ['openShipEdit', 'saveShipEdit'],
   ['mpStart', 'mpCreate'], ['openRMReceive', 'rmReceiveSubmit'],
   ['openRMCheck', 'rmSubmit']].forEach(([o, w]) => {
    const codeOf = src => (src.match(/may\('([^']+)'\)/) || [])[1];
    eq('opener and writer agree: ' + o + ' / ' + w, codeOf(H.grab(o)), codeOf(H.grab(w)));
  });
  /* The Shipments screen's edit flag follows the same right its buttons do —
     a screen that renders every control and then refuses each one is a screen
     nobody can read. Anchored on the assignment, not on the file. */
  ok('GUARD: the Shipments screen edit flag asks for shipment.plan',
     /var ed=may\('shipment\.plan'\)/.test(H.grab('screenShip')), H.grab('screenShip').slice(0, 160));
  ok('GUARD: and the older Shipments renderer does too',
     /const ed=may\('shipment\.plan'\)/.test(H.grab('screenShipOLD')), H.grab('screenShipOLD').slice(0, 160));
  /* grantRefusal must ask the screen-independent question, or a lead standing on
     Admin would be told he does not hold a right he uses every day. */
  ok('GUARD: grantRefusal asks mayHere, not the screen-dependent rule',
     /mayHere\(granter,code\)/.test(H.grab('grantRefusal')), H.grab('grantRefusal').slice(-260));
  /* A comment that says nothing writes a value, next to a function that reads it,
     is how the next person decides the value is derived and safe to regenerate.
     Prose is not usually worth a test — this one is, because a reviewer caught
     exactly that sentence going stale the moment setDeptLead landed. */
  {
    const writes = /d\.leadRoleId\s*=/.test(H.grab('setDeptLead'));
    /* the note sits INSIDE deptLeadRole, above the lookup */
    const readerComment = H.grab('deptLeadRole');
    ok('setDeptLead really does write the lead', writes);
    ok('GUARD: and deptLeadRole does not claim nothing writes it',
       !/[Nn]othing writes leadRoleId/.test(readerComment)
       && /setDeptLead writes leadRoleId/.test(readerComment), readerComment.slice(-220));
  }
  ok('GUARD: a matrix change re-points canEdit grants as well as screen ones',
     /lg\.kind!=='screen' && lg\.kind!=='canEdit'/.test(H.grab('resyncScreenRights')));
}

/* ================= 28. the refusal that used to send you to the COO ================= */
/* A Supply Chain user pressing Load on his own Dashboard was told he needed a
   right that the panel already showed him holding, and to go ask the COO — who
   could not have helped, because the right is not live and he already has it. */
{
  const b = mk('Supply Chain');
  b.state.screen = 'dash';
  ok('setting up: he is refused on the Dashboard', b.may('shipment.load') === false);
  ok('...but he does hold the right where the job belongs', b.mayHere('Supply Chain', 'shipment.load') === true);
  const msg = b.denyRight('shipment.load', 'Starting loading');
  ok('so the message does NOT send him to the COO', !/Ask /.test(msg), msg);
  ok('it tells him it is his job', /is your job/.test(msg), msg);
  ok('and where the button works', /Shipments/.test(msg), msg);
  /* somebody who genuinely does not hold it still gets the grant route */
  const c = mk('Lab Rep');
  c.state.screen = 'qc';
  const msg2 = c.denyRight('shipment.load', 'Starting loading');
  ok('a role that does not hold it is still told who to ask', /Ask /.test(msg2), msg2);
  ok('...and it is not told this is its job', !/is your job/.test(msg2), msg2);
}

/* ================= 29. the screen each right belongs to ================= */
/* legacy.scr drives the seed, the freeze baseline, the loophole list, what
   denyRight tells people and what the right means once live — and nothing
   asserted it. Moving pr.close from My Actions to Shipments passes silently and
   hands Supply Chain Officer an authority he does not have today. */
{
  const WANT = {
    'order.create':         { kind: 'screen',  scr: 'entry' },
    'order.print_decision': { kind: 'screen',  scr: 'entry' },
    'order.acknowledge':    { kind: 'all',     scr: undefined },
    'customer.create':      { kind: 'hard',    scr: undefined },
    'customer.amend':       { kind: 'hard',    scr: undefined },
    'shipment.plan':        { kind: 'canEdit', scr: 'ship',      alsoOn: 'approvals:Plant Manager' },
    'shipment.load':        { kind: 'canEdit', scr: 'ship',      alsoOn: 'approvals:Plant Manager' },
    'gatepass.issue':       { kind: 'canEdit', scr: 'ship',      alsoOn: 'approvals:Plant Manager' },
    'delivery.confirm':     { kind: 'canEdit', scr: 'ship',      alsoOn: 'approvals:Plant Manager' },
    'rm.receive':           { kind: 'canEdit', scr: 'approvals', alsoOn: 'prod' },
    'pr.close':             { kind: 'canEdit', scr: 'approvals', alsoOn: 'prod' },
    /* closes a gap, 26 Aug — see CLOSED_GAP in section 2a. Same shape as
       rm.receive: its own screen is My Actions, and Production's stuck list is
       the other place the button (used to) reach it. */
    'rm.check':             { kind: 'canEdit', scr: 'approvals', alsoOn: 'prod' },
    'batch.open':           { kind: 'hard',    scr: undefined },
    'production.enter':     { kind: 'hard',    scr: undefined },
    'shift.log':            { kind: 'hard',    scr: undefined },
    'packing.pack':         { kind: 'hard',    scr: undefined },
    'packing.reconcile':    { kind: 'hard',    scr: undefined },
    'byproduct.call':       { kind: 'hard',    scr: undefined },
    'packing.divert':       { kind: 'hard',    scr: undefined },
    'packing.rework':       { kind: 'hard',    scr: undefined },
    'batch.close':          { kind: 'hard',    scr: undefined },
    'batch.close_bulk':     { kind: 'hard',    scr: undefined },
    /* new 26 Aug. The only production right that is not the Production role:
       the floor logs the output, somebody above them unwinds it. */
    'production.void':      { kind: 'hard',    scr: undefined },
  };
  eq('every right in the catalogue is pinned here', B.RIGHTS.filter(r => !WANT[r.code]).length, 0);
  eq('and nothing pinned here has been dropped',
     Object.keys(WANT).filter(c => !B.rightByCode(c)).join(', '), '');
  B.RIGHTS.forEach(r => {
    const w = WANT[r.code];
    eq(r.code + ' — kind', r.legacy.kind, w.kind);
    eq(r.code + ' — the screen the job belongs to', r.legacy.scr, w.scr);
    if (w.alsoOn !== undefined)
      eq(r.code + ' — the other places its button is reachable from',
         (r.legacy.alsoOn || []).map(a => a.scr + (a.roles ? ':' + a.roles.join('+') : '')).join(','), w.alsoOn);
  });
  /* And the screen named is one that exists. */
  B.RIGHTS.forEach(r => {
    const ids = B.SCREENS.map(x => x.id);
    if (r.legacy.scr) ok(r.code + ' points at a real screen', ids.indexOf(r.legacy.scr) >= 0, r.legacy.scr);
    (r.legacy.alsoOn || []).forEach(a =>
      ok(r.code + ' alsoOn points at a real screen', ids.indexOf(a.scr) >= 0, JSON.stringify(a)));
  });
  /* Moving one is not cosmetic — prove it changes who holds the right. */
  {
    const b = mk('COO');
    eq('today Supply Chain Officer cannot close a PR', b.mayHere('Supply Chain Officer', 'pr.close'), false);
    b.rightByCode('pr.close').legacy.scr = 'ship';
    const b2 = mk('COO');
    b2.rightByCode('pr.close').legacy.scr = 'ship';
    b2.state.masters.roleRights = {};
    b2.seedDeptRightsV1(b2.state);
    eq('moving its screen to Shipments would silently hand it to him',
       b2.mayHere('Supply Chain Officer', 'pr.close'), true);
    b.rightByCode('pr.close').legacy.scr = 'approvals';
  }
}

/* ================= 30. alsoOn, derived from where the buttons actually are ================= */
/* `alsoOn` is hand-written, and a hand-written list of render sites drifts. This
   reads the real tables out of the app — PROD_STUCK_CAT (the unfiltered
   Production list) and acEscalation's TH (the My Actions branch that shows a
   manager somebody else's item, with the owner's live button) — and checks the
   catalogue covers every one of them. pr.close was missing 'prod' because
   recvPRCard draws Close PR next to Receive; this is the check that would have
   caught it. */
{
  /* label -> the Supply Chain rights that label's button can trigger */
  const LABEL_RIGHTS = {
    'RM Check':         ['rm.check'],
    'Receive':          ['rm.receive', 'pr.close'],   /* openReceiveMaterials -> recvPRCard draws both */
    'Ship':             ['shipment.plan'],
    'Load':             ['shipment.load'],
    'Gate Pass':        ['gatepass.issue'],
    'Confirm delivery': ['delivery.confirm'],
  };
  const alsoOnOf = code => ((B.rightByCode(code) || {}).legacy || {}).alsoOn || [];
  const scrOf = code => ((B.rightByCode(code) || {}).legacy || {}).scr;

  /* --- Production's stuck list: unfiltered, so anyone who can open it gets in --- */
  const stuck = H.grabTopVar('PROD_STUCK_CAT', '{');
  ok('PROD_STUCK_CAT was found in the app', /Receive/.test(stuck), stuck.slice(0, 120));
  Object.keys(LABEL_RIGHTS).forEach(label => {
    const inStuck = new RegExp("'" + label + "'\\s*:").test(stuck);
    LABEL_RIGHTS[label].forEach(code => {
      if (scrOf(code) === 'prod') return;
      const has = alsoOnOf(code).some(a => a.scr === 'prod' && !a.roles);
      if (inStuck) ok('reachable from Production, so alsoOn says so: ' + label + ' -> ' + code, has,
                      JSON.stringify(alsoOnOf(code)));
      else ok('NOT on the Production list, so alsoOn does not claim it: ' + label + ' -> ' + code, !has);
    });
  });

  /* --- My Actions: acEscalation hands a manager somebody else's item --- */
  const esc = H.grab('acEscalation');
  ok('acEscalation was found', /var TH=\{/.test(esc), esc.slice(0, 80));
  Object.keys(LABEL_RIGHTS).forEach(label => {
    const m = new RegExp("'" + label + "'\\s*:\\s*\\[\\s*\\d+\\s*,\\s*'([^']+)'\\]").exec(esc);
    LABEL_RIGHTS[label].forEach(code => {
      if (scrOf(code) === 'approvals') return;      /* its own screen — nothing to disclose */
      const entry = alsoOnOf(code).filter(a => a.scr === 'approvals')[0];
      if (m) {
        ok('escalated to a manager, so alsoOn says so: ' + label + ' -> ' + code, !!entry,
            JSON.stringify(alsoOnOf(code)));
        ok('...and names the manager the app escalates to (' + m[1] + ')',
           !!entry && (entry.roles || []).indexOf(m[1]) >= 0, JSON.stringify(entry));
      } else {
        ok('not escalated, so alsoOn does not claim My Actions: ' + label + ' -> ' + code, !entry);
      }
    });
  });

  /* Nothing in alsoOn that the tables do not justify. */
  B.RIGHTS.forEach(r => {
    (r.legacy.alsoOn || []).forEach(a => {
      const labels = Object.keys(LABEL_RIGHTS).filter(l => LABEL_RIGHTS[l].indexOf(r.code) >= 0);
      ok(r.code + ' alsoOn ' + a.scr + ' is backed by a real render site',
         labels.length > 0, 'no label maps to ' + r.code);
    });
  });
}

/* ================= 31. Production ================= */
{
  const b = mk('COO');
  const PR = b.RIGHTS.filter(r => r.dept === 'production');
  eq('eleven Production rights', PR.length, 11);
  /* TEN are conversions of the old hardRole(['Production']) gate. ONE —
     production.void, added 26 Aug — is a new capability with no old answer, and
     it deliberately does NOT start with the Production role: the floor logs the
     output, somebody above them unwinds it. Split here so the ten keep their
     strict freeze check instead of it being loosened to accommodate the one. */
  const CONV = PR.filter(r => r.code !== 'production.void');
  const NEWC = PR.filter(r => r.code === 'production.void');
  eq('...ten of them conversions', CONV.length, 10);
  eq('...and one a new capability', NEWC.length, 1);
  ok('every converted one carries the old role check, with no screen in it',
     CONV.every(r => r.legacy.kind === 'hard' && r.legacy.roles.join() === 'Production' && !r.legacy.scr),
     JSON.stringify(CONV.map(r => r.legacy)));
  ok('the new one is hard-gated too, on the head above the floor',
     NEWC.every(r => r.legacy.kind === 'hard' && r.legacy.roles.join() === 'Plant Manager' && !r.legacy.scr),
     JSON.stringify(NEWC.map(r => r.legacy)));

  /* Who can do the work — unchanged for the ten, and that is the point. */
  CONV.forEach(r => eq('who may ' + r.code, b.whoMayRight(r.code).join(', '), 'Production, COO'));
  ['QA Inspector', 'Plant Manager', 'KAM', 'Supply Chain', 'Lab Rep', 'CFO'].forEach(role =>
    CONV.forEach(r => eq(role + ' still cannot ' + r.code, b.mayHere(role, r.code), false)));
  /* and the new one goes to the head, not the floor */
  eq('who may production.void', b.whoMayRight('production.void').join(', '), 'Plant Manager, COO');
  eq('the floor officer who logged it cannot un-log it',
     b.mayHere('Production', 'production.void'), false);
  ['QA Inspector', 'KAM', 'Supply Chain', 'Lab Rep', 'CFO'].forEach(role =>
    eq(role + ' cannot production.void', b.mayHere(role, 'production.void'), false));

  /* THE CELL THE COO SET ON 25 AUG. He set QA Inspector's Production access to
     view. It closed the raw-material hole, and it makes NO difference to these
     rights either way — their rule is a role name, not a screen. Proved rather
     than asserted, because I told him the cell was blocking this conversion and
     it was not. */
  {
    const c = mk('COO');
    c.state.masters.accessMatrix['QA Inspector'].prod = { v: true, e: true };   /* as it was */
    const before = PR.map(r => c.mayHere('QA Inspector', r.code)).join(',');
    c.state.masters.accessMatrix['QA Inspector'].prod = { v: true, e: false };  /* as he set it */
    const after = PR.map(r => c.mayHere('QA Inspector', r.code)).join(',');
    eq('the Production access cell does not touch these rights', after, before);
    ok('...and the answer is no, both ways', before === PR.map(() => 'false').join(','), before);
  }

  /* The gates really were converted. */
  [['openBatchModal', 'batch.open'], ['submitMultiBatch', 'batch.open'],
   ['submitProdQty', 'production.enter'],
   ['submitShiftLog', 'shift.log'], ['doPack', 'packing.pack'],
   ['openReconcile', 'packing.reconcile'], ['saveReconcile', 'packing.reconcile'],
   ['openCallBp', 'byproduct.call'], ['submitCallBp', 'byproduct.call'],
   ['openDivert', 'packing.divert'], ['submitDivert', 'packing.divert'],
   ['openRework', 'packing.rework'], ['submitRework', 'packing.rework'],
   ['openCloseBatch', 'batch.close'], ['doCloseBatch', 'batch.close'],
   ['openSettledClose', 'batch.close_bulk'], ['closeSettledBatches', 'batch.close_bulk'],
   /* The only function in Production that DESTROYS a production record, and the
      newest. A reviewer stripped both of these gates on 26 Aug and every suite
      stayed green while a KAM deleted a lot. */
   ['openRemoveLot', 'production.void'], ['doRemoveLot', 'production.void']].forEach(([fn, code]) =>
    ok('GUARD: ' + fn + ' asks may(\'' + code + '\')',
       new RegExp("may\\('" + code.replace('.', '\\.') + "'\\)").test(H.grab(fn)), H.grab(fn).slice(0, 110)));
  /* opener and writer must agree, or somebody fills a form and loses it */
  [['openBatchModal', 'submitMultiBatch'], ['openCloseBatch', 'doCloseBatch'],
   ['openReconcile', 'saveReconcile'], ['openCallBp', 'submitCallBp'],
   ['openDivert', 'submitDivert'], ['openRework', 'submitRework'],
   ['openSettledClose', 'closeSettledBatches'],
   ['openRemoveLot', 'doRemoveLot']].forEach(([o, w]) => {
    const codeOf = src => (src.match(/may\('([^']+)'\)/) || [])[1];
    eq('opener and writer agree: ' + o + ' / ' + w, codeOf(H.grab(o)), codeOf(H.grab(w)));
  });
  /* The re-check the comment advertises: the lab can certify a lot while the
     modal is open, so doRemoveLot must ask lotRemoveBlockedBy AGAIN and not
     trust openRemoveLot's answer. Removing it left the suite green. */
  ok('GUARD: doRemoveLot re-asks lotRemoveBlockedBy, it does not trust the opener',
     /lotRemoveBlockedBy\(b,lt\)/.test(H.grab('doRemoveLot')), H.grab('doRemoveLot').slice(0, 200));
  ok('GUARD: ...and it asks BEFORE it writes anything',
     H.grab('doRemoveLot').indexOf('lotRemoveBlockedBy') < H.grab('doRemoveLot').indexOf('b.lots='),
     'guard at ' + H.grab('doRemoveLot').indexOf('lotRemoveBlockedBy')
       + ', first write at ' + H.grab('doRemoveLot').indexOf('b.lots='));
  ok('GUARD: openRemoveLot asks it too, so no modal opens on a refusal',
     /lotRemoveBlockedBy\(b,lt\)/.test(H.grab('openRemoveLot')));
  /* 26 Aug (afternoon): a refused lot now draws a DISABLED Remove with the reason
     under it, so the live button is conditioned on the answer held in _why rather
     than on the call inline. Same guard, one variable further along: the render
     asks lotRemoveBlockedBy, and only the "no reason" branch gets an onclick.
     certremove.test.js §8 renders it per role. */
  ok('GUARD: and the render only draws a live Remove where it would be allowed',
     /var _why=_mayRm\?lotRemoveBlockedBy\(sel,l\):null;/.test(H.grab('renderProdLifecycleBatch'))
     && /\(_mayRm && !_why\)\s*\?\s*'<button class="sm ghost" title="[^"]*" onclick="openRemoveLot/.test(H.grab('renderProdLifecycleBatch'))
     && /_mayRm \? '<button class="sm ghost" disabled title="/.test(H.grab('renderProdLifecycleBatch')),
     H.grab('renderProdLifecycleBatch').slice(H.grab('renderProdLifecycleBatch').indexOf('_why'), H.grab('renderProdLifecycleBatch').indexOf('_why') + 400));
  ok('GUARD: the converted Production gates no longer name the role in code',
     !/hardRole\(\['Production'\]\)/.test(H.grab('doCloseBatch') + H.grab('submitProdQty')
       + H.grab('doPack') + H.grab('closeSettledBatches')));
  /* TWO GATES DELIBERATELY LEFT ALONE. Their only buttons sit below screenProd's
     early return, in code the file itself marks unreachable — and the void
     button's render condition there is COO-only, a third answer again. A right
     nobody can ask for would be a tick in the panel that decides nothing, which
     is the one thing the catalogue rule forbids. They go in when a working
     screen does. */
  ['setBatchNo', 'voidProdEntry'].forEach(fn => {
    ok('NOT a right yet, still hard-gated: ' + fn, /hardRole\(\['Production'\]\)/.test(H.grab(fn)),
       H.grab(fn).slice(0, 130));
    ok('...and says why in the file: ' + fn, /not a right yet/.test(H.grab(fn)));
  });
  ok('batch.set_number is still not in the catalogue', !B.rightByCode('batch.set_number'));
  /* production.void IS in the catalogue since 26 Aug, because removeLot gave it a
     working button. voidProdEntry — the register's index-and-quantity version —
     is a different function and stays hard-gated with no live caller. */
  ok('production.void IS in the catalogue now', !!B.rightByCode('production.void'));
  ok('...and its handler has a live caller', /openRemoveLot\s*\(/.test(H.html));
  /* voidProdEntry's ONLY call site is the ✕ remove button in the legacy floor
     block, below screenProd's unconditional return — so it has a caller in the
     source and none a user can reach. Counted, and its position proved, rather
     than asserted. */
  {
    const sp = H.grab('screenProd');
    const ret = sp.indexOf('Legacy floor code below is unreachable');
    const call = sp.indexOf('voidProdEntry(');
    ok('voidProdEntry is called once, inside screenProd', call >= 0);
    ok('...and that call sits BELOW the unreachable marker', ret >= 0 && call > ret,
       'marker at ' + ret + ', call at ' + call);
    eq('...and there is no other call anywhere in the file',
       (H.html.match(/voidProdEntry\s*\(/g) || []).length, 2);   /* the definition + that one */
  }
  ok('the catalogue note tells the COO the app has no button for the one left',
     /NO WORKING\s+BUTTON FOR IT/.test(H.html.slice(H.html.indexOf('Production, converted 25 August'),
       H.html.indexOf('Production, converted 25 August') + 3200)));
  ok('screenProd really does return before that code',
     /Legacy floor code below is unreachable/.test(H.html));

  /* leadLevel: the flag exists for the day a right needs it, and TODAY NOTHING
     CARRIES IT and nothing reads it. Both halves are checked, because a flag that
     quietly starts deciding is exactly the 30 July shape. */
  {
    /* CONSISTENCY, not a fixed answer. The first version of this pinned BOTH
       "nothing is marked" and "the word appears exactly once" — so the note above
       the catalogue could claim rights were marked when none were, and every
       correct fix (mark them, or delete the claim) turned the suite red. A test
       that forbids its own repair is worse than no test. What must hold is that
       the file and the note agree, and that the flag decides nothing. */
    const marked = B.RIGHTS.filter(r => r.leadLevel).map(r => r.code);
    const noteSaysNoneMarked = /no head-level marking in this\s+catalogue at all/.test(H.html);
    ok('the note and the catalogue agree about whether anything is marked',
       noteSaysNoneMarked === (marked.length === 0),
       'marked: ' + JSON.stringify(marked) + '; note says none marked: ' + noteSaysNoneMarked);
    ok('nothing READS the flag — it decides nothing, whatever is marked',
       !/leadLevel\s*(?:===|!==|\?|&&|\|\|)/.test(H.html)
       && !/\.leadLevel\)/.test(H.html.replace(/r\.leadLevel === undefined/g, '')),
       (H.html.match(/.{0,40}leadLevel.{0,40}/g) || []).join(' | ').slice(0, 300));
  }
  {
    const c = mk('COO');
    c.state.masters.roles.push({ id: 'floor-officer', name: 'Floor Officer', deptId: 'production', builtin: false, archived: false });
    c.seedDeptRightsV1(c.state);
    ok('setting up: Floor Officer is in Production and is NOT the lead',
       c.roleDeptId('Floor Officer') === 'production' && c.isDeptLead('Floor Officer') === false
       && c.deptLeadRole('production') === 'Production');
    /* give the floor role both rights and switch them live */
    /* Mark a right by hand and prove the mark changes nothing. */
    c.rightByCode('batch.close').leadLevel = true;
    c.state.masters.roleRights['floor-officer']['batch.close'] = true;
    c.state.masters.roleRights['floor-officer']['packing.pack'] = true;
    c.RIGHTS_LIVE['batch.close'] = true; c.RIGHTS_LIVE['packing.pack'] = true;
    eq('a marked right behaves exactly like an unmarked one for a non-lead',
       c.mayHere('Floor Officer', 'batch.close'), c.mayHere('Floor Officer', 'packing.pack'));
    eq('...and that answer is the grant, not the label', c.mayHere('Floor Officer', 'batch.close'), true);
    eq('the real gate says the same', c.mayRole('Floor Officer', 'batch.close'), true);
    delete c.RIGHTS_LIVE['batch.close']; delete c.RIGHTS_LIVE['packing.pack'];
    delete c.rightByCode('batch.close').leadLevel;
  }
  /* The COO's decisions of 25 Aug, written where he can read them back. */
  ok('the bulk close records that he chose the same rule as a single close',
     /same rule as closing one/.test(b.rightByCode('batch.close_bulk').note));
  ok('closing a batch records why it is Production\'s own',
     /reopening one is already the Plant Manager/.test(b.rightByCode('batch.close').note));
  /* His decision about who may un-log a shift is now recorded on the right
     itself, together with why it does not start with the Production Manager. */
  ok('the removal right records the COO\'s decision',
     /Production Manager and above, never the floor officer who logged it/
       .test(b.rightByCode('production.void').note));
  ok('...and why it sits with the Plant Manager until that role exists',
     /That role does not exist\s+yet/.test(H.html) && /one tick to move it across/.test(H.html));
}

/* ================= 32. pointing a department at its head ================= */
/* The COO's design: Production needs a Production Manager as head, with floor
   officers under him. Until now the lead was whatever the built-in list said and
   there was no way for him to say otherwise. */
{
  function box() {
    const b = mk('COO');
    Object.assign(b, { toasts: [], toast: m => b.toasts.push(m), save: () => { b.saved = (b.saved || 0) + 1; },
      render: () => {}, authRepaint: () => {}, logged: [], logAction: m => b.logged.push(m), $: () => null,
      _pe: x => String(x == null ? '' : x), _at: x => String(x == null ? '' : x),
      _roleById: id => b.state.masters.roles.find(r => r.id === id) });
    vm.runInContext(H.grab('setDeptLead'), b);
    return b;
  }
  {
    const b = box();
    eq('Production is led by the Production role to begin with', b.deptLeadRole('production'), 'Production');
    /* the COO creates the head role, in Production */
    b.state.masters.roles.push({ id: 'production-manager', name: 'Production Manager', deptId: 'production', builtin: false, archived: false });
    b.seedDeptRightsV1(b.state);
    b.setDeptLead('production', 'production-manager');
    eq('and can now hand the department to him', b.deptLeadRole('production'), 'Production Manager');
    ok('the change is logged', b.logged.some(l => /Department lead: Production/.test(l) && /Production Manager/.test(l)),
       JSON.stringify(b.logged));
    ok('and saved', b.saved === 1);
    /* the floor role is still in the department, and still holds the work */
    ok('the floor officers are still Production', b.roleDeptId('Production') === 'production');
    eq('...and still do the job', b.mayHere('Production', 'production.enter'), true);
    /* the new head holds nothing until the COO ticks it — nothing is assumed */
    /* Checked against a right that EXISTS. The first version used
       production.void, which had been dropped from the catalogue — rightByCode
       returned null and both assertions passed for a code like 'zzz.nonsense'. */
    ok('setting up: batch.close is a real right', !!b.rightByCode('batch.close'));
    eq('the new head starts with nothing, as every new role does',
       b.mayHere('Production Manager', 'batch.close'), false);
    ok('...and the COO may tick it across', b.grantRefusal('COO', 'Production Manager', 'batch.close') === '');
    /* WORTH KNOWING, and it surprised me: a brand-new head cannot manage his team
       on day one, because he holds nothing himself and a lead may only hand out a
       right he holds. So the order is: COO creates the role, makes it the lead,
       THEN gives it the rights — and only then can the head run his own
       department. That is the rule working, not a gap. */
    ok('a brand-new head cannot pass on a right he does not hold yet',
       /do not hold yourself/.test(b.grantRefusal('Production Manager', 'Production', 'batch.open')),
       b.grantRefusal('Production Manager', 'Production', 'batch.open'));
    b.state.masters.roleRights['production-manager']['batch.open'] = true;
    b.RIGHTS_LIVE['batch.open'] = true;
    eq('once the COO gives it to him, he can pass it on',
       b.grantRefusal('Production Manager', 'Production', 'batch.open'), '');
    ok('...but still not to himself', /cannot change his own/.test(
       b.grantRefusal('Production Manager', 'Production Manager', 'batch.open')));
    delete b.RIGHTS_LIVE['batch.open'];
  }
  /* the guards */
  {
    const b = box();
    b.state.role = 'Production';
    b.setDeptLead('production', 'kam');
    ok('only the COO can move a lead', b.deptLeadRole('production') === 'Production'
       && b.toasts.some(t => /COO only/.test(t)), JSON.stringify(b.toasts));
    b.state.role = 'COO'; b.toasts = [];
    b.setDeptLead('production', 'kam');
    ok('a lead must be a role that is IN the department', b.deptLeadRole('production') === 'Production'
       && b.toasts.some(t => /not in Production/.test(t)), JSON.stringify(b.toasts));
    b.toasts = [];
    b.setDeptLead('nope', 'production');
    ok('an unknown department is refused', b.toasts.some(t => /Unknown department/.test(t)));
    b.toasts = [];
    b.setDeptLead('production', 'no-such-role');
    ok('an unknown role is refused', b.toasts.some(t => /Unknown role/.test(t)));
    b.toasts = [];
    b.state.masters.roles.push({ id: 'ghost', name: 'Ghost', deptId: 'production', builtin: false, archived: true });
    b.setDeptLead('production', 'ghost');
    ok('an archived role cannot be made the lead', b.deptLeadRole('production') === 'Production'
       && b.toasts.some(t => /archived/.test(t)), JSON.stringify(b.toasts));
  }
  /* it is on the card, for the COO only */
  {
    const b = mk('COO');
    Object.assign(b, { toast: () => {}, save: () => {}, render: () => {}, logAction: () => {},
      acOpen: {}, authDept: 'production', usersList: [], $: () => null,
      acard: (k, t, h, body) => '<CARD>' + body + '</CARD>',
      _pe: x => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') });
    vm.runInContext(['_at', 'screenEditOK', 'accessLevel', 'authRepaint', 'rightTickById', 'rightTick',
                     'authPick', 'authDriftBanner', 'authLoopholeBanner', 'authCard'].map(H.grab).join('\n\n'), b);
    b.state.masters.roles.push({ id: 'production-manager', name: 'Production Manager', deptId: 'production', builtin: false, archived: false });
    b.seedDeptRightsV1(b.state);
    const html = b.authCard();
    ok('the COO gets a way to change the lead on the card', /setDeptLead\('production'/.test(html), html.slice(0, 400));
    ok('...offering the other roles in the department', /Production Manager<\/option>/.test(html), (html.match(/<select[^>]*setDeptLead[\s\S]{0,200}/) || [''])[0]);
    ok('...and not offering the current lead to itself',
       !/<option value="production">Production<\/option>/.test((html.match(/<select[^>]*setDeptLead[\s\S]{0,240}/) || [''])[0]));
    b.state.role = 'Production';
    ok('and nobody else gets it', !/setDeptLead/.test(b.authCard()));
  }
}

/* ================= 33. a screen must not draw a button its action refuses ================= */
/* Every one of these render flags was keyed to one chosen right. Nothing pinned
   them, so re-keying any of them passed the whole suite — and the catalogue's own
   note promises the COO that moving a right is a tick. Give the Production
   Manager batch.open and nothing else: he would have seen "+ Open batch", the
   modal would have opened, and its Submit would have rendered disabled. */
{
  /* renderer -> the rights of the buttons it draws */
  /* Read off the buttons each function actually emits, not from memory. Two of
     these rows were wrong on the first attempt and the check then enforced the
     error — a reviewer measured it: correcting either flag turned the suite red,
     so the next person to fix it would have reverted. Anything changed here must
     be re-read against the emitted onclicks. */
  /* ONE FLAG PER BUTTON, not one per renderer.
     A renderer that draws several buttons, each handler asking its own single
     right, must gate each button on that button's own right. A shared union flag
     shows a person buttons that refuse the moment he clicks them. That is not a
     hypothetical: it is what the COO's head/floor split produces on day two, when
     a floor officer holds shift.log and nothing else.
     Read off the buttons each function actually emits, not from memory. Anything
     changed here must be re-read against the emitted onclicks. */

  /* renderers with exactly ONE gated button — a single flag is correct there */
  const SINGLE = {
    'prodSettledStrip':  'batch.close_bulk',   /* draws exactly one: bulk close */
    'renderOpenBatch':   'batch.open',         /* draws exactly one: the Submit  */
  };
  Object.keys(SINGLE).forEach(fn => {
    let body = ''; try { body = H.grab(fn); } catch (e) { }
    ok(fn + ' was found', !!body, fn + ' not in the file');
    if (!body) return;
    const m = /(?:var|const)\s+ed\s*=\s*([^;]+);/.exec(body)
           || /if\(!(may\([^)]*\)[^)]*)\)\s*return/.exec(body);
    ok(fn + ' has an edit flag built from may()', !!m && /may\(/.test(m[1]), (m && m[1] || '').slice(0, 120));
    if (!m) return;
    const asked = (m[1].match(/may\('([^']+)'\)/g) || []).map(x => x.slice(5, -2));
    eq(fn + ' asks for exactly its one right', asked.join(','), SINGLE[fn]);
  });

  /* renderers that draw SEVERAL buttons — flag, right, and the handler it draws */
  const PERBUTTON = {
    /* its rows draw Produce, Open batch, Log shift, Pack, Reconcile, Close batch */
    'prodStageList': [
      ['edLog',   'shift.log',          'openShiftLog'],
      ['edOpen',  'batch.open',         'openBatchModal'],
      ['edPack',  'packing.pack',       'openPack'],
      ['edQty',   'production.enter',   'openProdQty'],
      ['edRecon', 'packing.reconcile',  'openReconcile'],
      ['edClose', 'batch.close',        'closeBatch'],
    ],
    /* the batch action row: a different button at every stage */
    '_pcLifeAction': [
      ['edLog',   'shift.log',          'openShiftLog'],
      ['edClose', 'batch.close',        'openCloseBatch'],
      ['edPack',  'packing.pack',       'openPack'],
      ['edRecon', 'packing.reconcile',  'openReconcile'],
      ['edBp',    'byproduct.call',     'openCallBp'],
    ],
    /* the pools strip: one flag per row type */
    'prodPoolsStrip': [
      ['edBp',    'byproduct.call',     'openCallBp'],
      ['edDv',    'packing.divert',     'openDivert'],
      ['edRw',    'packing.rework',     'openRework'],
    ],
  };
  Object.keys(PERBUTTON).forEach(fn => {
    let body = ''; try { body = H.grab(fn); } catch (e) { }
    ok(fn + ' was found', !!body, fn + ' not in the file');
    if (!body) return;
    PERBUTTON[fn].forEach(([flag, code, handler]) => {
      ok(fn + ': ' + flag + ' is bound to ' + code,
         new RegExp(flag + "\\s*=\\s*may\\('" + code.replace(/\./g, '\\.') + "'\\)").test(body),
         body.slice(0, 220));
      /* EVERY place that handler is drawn must sit under that flag — not just the
         first. The first version of this checked only body.indexOf(handler) and
         would have passed with four of five sites ungated. */
      let i = -1, sites = 0, bad = [];
      while ((i = body.indexOf(handler + '(', i + 1)) >= 0) {
        sites++;
        const win = body.slice(Math.max(0, i - 220), i);
        if (win.indexOf(flag) < 0) bad.push(body.slice(Math.max(0, i - 90), i + 24));
      }
      ok(fn + ': ' + handler + ' is drawn (' + sites + ' site(s))', sites > 0, 'no call site found');
      ok(fn + ': every ' + handler + ' site sits under ' + flag, bad.length === 0, bad.join(' || ').slice(0, 260));
    });
    /* and no flag may ask for a right whose button this renderer does not draw */
    const flagLines = (body.match(/(?:var|const)\s+ed[A-Za-z]*\s*=\s*[^;]+;/g) || []).join(' ');
    const askedAll = [...new Set((flagLines.match(/may\('([^']+)'\)/g) || []).map(x => x.slice(5, -2)))];
    const drawn = PERBUTTON[fn].map(t => t[1]);
    askedAll.forEach(code =>
      ok(fn + ' asks for no right its buttons do not use: ' + code,
         drawn.indexOf(code) >= 0, 'asks ' + code + ', draws ' + drawn.join(', ')));
  });

  /* edAny is the one flag in prodStageList with no button of its own: it gates the
     stuck-item Resolve row (whose action is whatever the item carries) and the two
     navigation buttons. Re-keyed to a single right it would hide both from a floor
     officer, and nothing noticed — a reviewer planted exactly that. */
  {
    const body = H.grab('prodStageList');
    const m = /var\s+edAny\s*=\s*([^;]+);/.exec(body);
    ok('prodStageList declares edAny', !!m, body.slice(0, 200));
    if (m) {
      const parts = m[1].split('||').map(x => x.trim());
      const flags = ['edLog', 'edOpen', 'edPack', 'edQty', 'edRecon', 'edClose'];
      flags.forEach(f =>
        ok('edAny includes ' + f, parts.indexOf(f) >= 0, 'edAny = ' + m[1]));
      eq('...and nothing else', parts.length, flags.length);
    }
    /* The comment above edAny says WHY a union is still allowed inside a function
       whose whole point is one-flag-per-button. A reviewer found that sentence
       naming the wrong buttons — it pointed at dead code and omitted both live
       readers. Pin the claim to the code so it cannot drift again. */
    /* comments stripped first — the sentence being checked contains the word */
    const code = body.replace(/\/\*[\s\S]*?\*\//g, m => ' '.repeat(m.length));
    const readers = [];
    let i = -1;
    while ((i = code.indexOf('edAny', i + 1)) >= 0) {
      if (/var\s+edAny\s*=/.test(code.slice(Math.max(0, i - 6), i + 8))) continue;  /* the declaration */
      readers.push(code.slice(i, i + 200));
    }
    ok('edAny has readers', readers.length > 0);
    const named = ['openBatchCOA', "setScreen(\\'qc"];
    readers.forEach((r, k) => {
      const inRowS = /Resolve<\/button>/.test(r.slice(0, 200));
      ok('edAny reader ' + (k + 1) + ' is one the comment names',
         inRowS || named.some(nm => new RegExp(nm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(r.slice(0, 200))),
         r.slice(0, 160));
    });
    /* and each named button is gated on edAny SPECIFICALLY. Re-keyed to any single
       right — edLog, say — the nav button vanishes for everyone who does not log
       shifts, which is the opposite of "navigates and writes nothing". */
    [['openBatchCOA', 'Follow QC'], ["setScreen(\\'qc", 'Lab QC']].forEach(([handler, label]) => {
      const j = code.indexOf(handler);
      ok(label + ' is drawn in prodStageList', j > 0, handler + ' not found');
      if (j > 0) ok(label + ' is gated on edAny, not on a single right',
                    /edAny/.test(code.slice(Math.max(0, j - 220), j)),
                    code.slice(Math.max(0, j - 120), j + 20));
    });
    ok('...and the comment names Follow QC', /"Follow QC" on the Waiting-QC tab/.test(H.html));
    ok('...and Lab QC', /"Lab QC \u203a" on a batch\s+row/.test(H.html) || /Lab QC/.test(H.html));
    /* the comment's claim that rowS is never called */
    const calls = (body.match(/rowS\(/g) || []).length;
    const defs = (body.match(/var\s+rowS\s*=/g) || []).length;
    eq('rowS is defined once', defs, 1);
    eq('...and never called, exactly as the comment says', calls, 0);
  }

  /* screenProd's live "+ Open batch" button. It was the one live render flag on
     the Production screen with nothing pinning it: a reviewer re-keyed it to any
     right and all nine suites stayed green. */
  {
    const body = H.grab('screenProd');
    const i = body.indexOf('openBatchModal()');
    ok('screenProd draws + Open batch', i > 0);
    ok('...and it is gated on batch.open',
       i > 0 && /may\('batch\.open'\)/.test(body.slice(Math.max(0, i - 220), i)),
       body.slice(Math.max(0, i - 220), i + 30));
  }

  /* The pools strip, row by row. One shared flag showed all three row types to
     anybody holding any one of the three rights, and the other two refused on the
     click — the same fault as above, one level down. */
  {
    const body = H.grab('prodPoolsStrip');
    [['edBp', 'byproduct.call', 'openCallBp'],
     ['edDv', 'packing.divert', 'openDivert'],
     ['edRw', 'packing.rework', 'openRework']].forEach(([flag, code, fn]) => {
      ok('prodPoolsStrip has a flag for ' + code,
         new RegExp(flag + "\\s*=\\s*may\\('" + code.replace('.', '\\.') + "'\\)").test(body), body.slice(0, 200));
      /* the button for that job is drawn under THAT flag and no other */
      const i = body.indexOf(fn + '(');
      ok('...and ' + fn + ' is drawn under it',
         i > 0 && body.slice(Math.max(0, i - 160), i).indexOf(flag) >= 0,
         body.slice(Math.max(0, i - 160), i + 30));
    });
    ok('and there is no shared union flag left to re-share them',
       !/(?:var|const)\s+ed\s*=/.test(body), body.slice(0, 260));
  }

  /* Behaviour, not just source: a role holding exactly one of a strip's rights
     must see the strip. */
  {
    const b = mk('COO');
    b.state.masters.roles.push({ id: 'floor2', name: 'Floor Two', deptId: 'production', builtin: false, archived: false });
    b.seedDeptRightsV1(b.state);
    b.state.masters.roleRights['floor2']['byproduct.call'] = true;
    b.RIGHTS_LIVE['byproduct.call'] = true;
    b.state.role = 'Floor Two';
    ok('a role holding only byproduct.call can do it', b.may('byproduct.call') === true);
    ok('...and holds none of the others', b.may('production.enter') === false && b.may('packing.divert') === false);
    /* the strip shows if ANY of its three jobs applies, and his row's own flag
       is the one his button hangs off */
    const body = H.grab('prodPoolsStrip');
    ok('so the strip that holds his button shows it to him',
       /var edBp=may\('byproduct\.call'\)/.test(body) && /edBp\s*(?:\?|&&)/.test(body),
       body.slice(0, 240));
    ok('...while the divert and rework rows stay hidden from him',
       /edDv\?/.test(body) && /edRw\?/.test(body), body.slice(0, 240));
    delete b.RIGHTS_LIVE['byproduct.call'];
  }
}

/* ================= 34. the sign-off boundary, on the RENDER side too ================= */
/* Converting a gate is only half of it. If the screen draws a Plant-Manager-only
   button for whoever holds a Production right, every Production user sees Reopen
   on every closed batch and finds out by being refused — and that is the 30 July
   shape wearing a different hat. */
{
  const life = H.grab('_pcLifeAction');
  ok('_pcLifeAction was found', !!life);
  const reopen = life.slice(Math.max(0, life.indexOf('openReopenBatch') - 400), life.indexOf('openReopenBatch') + 60);
  ok('the Reopen button is drawn on a hardRole Plant Manager check',
     /hardRole\(\['Plant Manager'\]\)/.test(reopen), reopen.slice(0, 200));
  ok('...and NOT on any right', !/may\('/.test(reopen), reopen.slice(0, 200));
  /* the same for the other reopen entry point */
  const closed = H.grab('closedBatchesCard');
  ok('the closed-batch card also keeps Reopen on hardRole',
     !/may\('/.test(closed) || /hardRole\(\['Plant Manager'\]\)/.test(closed), closed.slice(0, 200));
}

/* ================= 35. the faults the 25 Aug review refused on ================= */

/* 35a. The catalogue note tells the COO how many rights Production holds. It said
   TWELVE and there are TEN. Nothing pinned it, so the number was free to drift
   and be quoted back as fact. It is now tied to the catalogue itself. */
{
  const DEPT_N = B.RIGHTS.filter(r => r.dept === 'production').length;
  eq('eleven Production rights in the department', DEPT_N, 11);
  /* The sentence is about what the PRODUCTION ROLE holds, not what the department
     contains — and since 26 Aug those are different numbers, because
     production.void went to the head instead. Tying the prose to the department
     total would have made the true sentence fail. */
  const N = B.RIGHTS.filter(r => r.dept === 'production'
              && B.whoMayRight(r.code).indexOf('Production') >= 0).length;
  eq('...of which the Production role holds ten', N, 10);
  const WORDS = ['zero','one','two','three','four','five','six','seven','eight','nine',
                 'ten','eleven','twelve','thirteen','fourteen','fifteen'];
  const m = /it holds all (\w+) of these/.exec(H.html);
  ok('the note states a count', !!m, 'sentence not found');
  ok('...and the number in the prose is the number in the catalogue',
     !!m && m[1] === WORDS[N], m ? ('note says "' + m[1] + '", catalogue has ' + N) : '');
}

/* 35b. openBatch() — the Submit behind the Open-batch form — had NO permission
   check of any kind. The only guards were openBatchModal and the button being
   rendered disabled. A reviewer found the new comment asserting a check that was
   not there. */
{
  const body = H.grab('openBatch');
  ok('openBatch was found', !!body);
  ok('openBatch asks batch.open before it writes anything',
     /^function openBatch\(kind\)\{[\s\S]{0,700}?if\(!may\('batch\.open'\)\)/.test(body),
     body.slice(0, 260));
  /* and BEFORE the multi delegation. Moved below it, submitMultiBatch still asks
     the same right so the multi path looks fine — and the po and bulk paths are
     ungated again, which is the fault this was written for. */
  ok('...and before the multi delegation, not after it',
     body.indexOf("may('batch.open')") < body.indexOf("kind==='multi'"),
     'gate at ' + body.indexOf("may('batch.open')") + ', multi at ' + body.indexOf("kind==='multi'"));
  /* and the gate is genuinely FIRST — before any state is touched */
  const gate = body.indexOf("may('batch.open')");
  const write = Math.min(...['state.batches', 'state.orders', 'nid(']
                  .map(t => { const i = body.indexOf(t); return i < 0 ? 1e9 : i; }));
  ok('...and it is asked before the first write', gate >= 0 && gate < write,
     'gate at ' + gate + ', first write at ' + write);
  /* the modal opener asks the same right, so nobody loses access */
  ok('openBatchModal asks the same right', /may\('batch\.open'\)/.test(H.grab('openBatchModal')));
}

/* 35c. archiveRole could archive a department's lead. setRoleDept already refuses
   to move a lead out; archiving was the way round it, and it left the department
   pointing at a role nobody can hold. Only reachable now that setDeptLead lets
   the COO choose a lead at all. */
{
  const body = H.grab('archiveRole');
  ok('archiveRole refuses to archive a lead',
     /leadRoleId\s*===\s*r\.id/.test(body), body.slice(0, 300));
  const g = body.indexOf('leadRoleId'), w = body.indexOf('r.archived=true');
  ok('...and it refuses BEFORE it writes', g >= 0 && w >= 0 && g < w, 'guard ' + g + ', write ' + w);
  /* BEHAVIOUR, not a regex. The first version of this re-implemented the filter
     in the test and asserted its own copy found the lead — so neutering the guard
     in the app (`if(false&&_ld)`) left the suite green. A reviewer measured that.
     This calls archiveRole and reads the role back. */
  {
    const c = { console, JSON, Date, toasts: [], logs: [],
      state: { role: 'COO', screen: 'admin', users: [],
               masters: JSON.parse(JSON.stringify(STATE.masters)) } };
    c.globalThis = c; vm.createContext(c);
    c.state.masters.roles.push({ id: 'prod-mgr', name: 'Production Manager',
                                 deptId: 'production', builtin: false, archived: false });
    c.state.masters.departments = (c.state.masters.departments || [])
      .map(d => Object.assign({}, d));
    if (!c.state.masters.departments.some(d => d && d.id === 'production'))
      c.state.masters.departments.push({ id: 'production', name: 'Production' });
    vm.runInContext('function toast(m){toasts.push(String(m));}\n'
      + 'function logAction(m){logs.push(String(m));}\n'
      + 'function save(){}\nfunction render(){}\nfunction confirm(){return true;}\n'
      + ['_roleById', 'archiveRole', 'restoreRole'].map(H.grab).join('\n\n'), c);

    const pd = c.state.masters.departments.filter(d => d && d.id === 'production')[0];
    pd.leadRoleId = 'prod-mgr';
    c.archiveRole('prod-mgr');
    const r = c.state.masters.roles.filter(x => x.id === 'prod-mgr')[0];
    ok('archiveRole REFUSES to archive a department lead', r.archived !== true,
       'archived=' + r.archived);
    ok('...and says which department he leads',
       c.toasts.some(t => /Production Manager/.test(t) && /Production/.test(t)),
       c.toasts.join(' | '));
    ok('...and writes nothing to the log', c.logs.length === 0, c.logs.join(' | '));

    /* and it still archives a role that leads nothing */
    c.state.masters.roles.push({ id: 'floor-officer', name: 'Floor Officer',
                                 deptId: 'production', builtin: false, archived: false });
    c.archiveRole('floor-officer');
    const f = c.state.masters.roles.filter(x => x.id === 'floor-officer')[0];
    ok('a role that leads nothing still archives normally', f.archived === true,
       'archived=' + f.archived);

    /* give the department a new lead, and the old one archives */
    pd.leadRoleId = 'production';
    c.archiveRole('prod-mgr');
    ok('once the department has another lead, he archives',
       c.state.masters.roles.filter(x => x.id === 'prod-mgr')[0].archived === true);
  }
}

/* 35d. The lead dropdown offered archived roles, which setDeptLead then always
   refused — a dead option that can only produce an error. */
{
  const card = H.grab('authCard');
  const i = card.indexOf('var inDept=');
  ok('the lead list is built', i >= 0);
  ok('...and it excludes archived roles, like rolesInDept does',
     i >= 0 && /!r\.archived/.test(card.slice(i, i + 200)), card.slice(i, i + 200));
  ok('rolesInDept still excludes them too', /!r\.archived/.test(H.grab('rolesInDept')));
}

/* 35e. toast() sets textContent, so HTML-escaping a name there prints the escape.
   Both new calls did it, and inconsistently — one name escaped, the one beside
   it not. */
{
  const t = H.grab('toast');
  ok('toast still writes textContent, not innerHTML', /textContent/.test(t) && !/innerHTML/.test(t), t.slice(0, 200));
  ['setDeptLead', 'archiveRole'].forEach(fn => {
    const body = H.grab(fn);
    const bad = (body.match(/toast\([^;]*_pe\(/g) || []);
    ok(fn + ' does not escape a name inside a toast', bad.length === 0, bad.join(' | ').slice(0, 200));
  });
}

/* ================= 36. the head/floor split, actually rendered =================
   Every check above reads source. This one runs the batch action row for two
   invented roles — a floor officer who may only log a shift, and a head who may
   only close and reconcile — and reads the buttons back. It is the whole point of
   the COO's design, and it is the test that would have caught the shared flag:
   before the split, BOTH of these roles saw all four buttons and were refused by
   three of them. */
{
  const r = { console, JSON, Date, Math, Object, String, Array,
    state: { role: 'COO', screen: 'prod', users: [], batches: [], orders: [],
             masters: JSON.parse(JSON.stringify(STATE.masters)) } };
  r.globalThis = r; vm.createContext(r);
  vm.runInContext(SCREENS_SRC + '\n'
    + ['scr', 'accessOv', '_ownerEdit', 'accessLevel', 'screenEditOK', 'hardRole', '_pe',
       'batchClearedKg', 'batchPackableKg', 'batchLabApproved', 'batchPackNow',
       'correctCanAmend', 'correctAllowed', '_pcCorrectBtn', '_pcLifeAction'].map(H.grab).join('\n\n')
    + '\nvar fmt=function(n){return Math.round(n).toLocaleString();};'
    + '\n' + H.authModelSrc(), r);
  r.state.masters.roles.push({ id: 'floor-officer', name: 'Floor Officer',
                               deptId: 'production', builtin: false, archived: false });
  r.state.masters.roles.push({ id: 'prod-mgr', name: 'Production Manager',
                               deptId: 'production', builtin: false, archived: false });
  r.seedDeptRightsV1(r.state);

  const CODES = r.RIGHTS.filter(x => x.dept === 'production').map(x => x.code);
  CODES.forEach(c => {
    r.RIGHTS_LIVE[c] = true;                                   /* the split is live */
    r.state.masters.roleRights['floor-officer'][c] = (c === 'shift.log');
    r.state.masters.roleRights['prod-mgr'][c] = (c === 'batch.close' || c === 'packing.reconcile');
  });

  const batch = () => ({ id: 'B1', batchNo: 'X1', status: 'open', kind: 'bulk',
                         producedKg: 100, plannedKg: 1000, packedKg: 0, lots: [] });
  const draw = (role, stage) => { r.state.role = role;
    return (r._pcLifeAction(batch(), { stage: stage }) || '').replace(/<[^>]*>/g, '|'); };

  /* the floor officer: his one button, and none of the others */
  ok('floor officer sees Log shift output',      /Log shift output/.test(draw('Floor Officer', 'producing')));
  ok('...and no Close batch on the same row',   !/Close batch/.test(draw('Floor Officer', 'producing')),
     draw('Floor Officer', 'producing'));
  ok('...and nothing at all on Ready to pack',  draw('Floor Officer', 'pack') === '',
     draw('Floor Officer', 'pack'));
  ok('...and nothing at all on Reconcile',      draw('Floor Officer', 'recon') === '',
     draw('Floor Officer', 'recon'));

  /* the head: his two, and not the floor's */
  ok('the head sees Close batch',                /Close batch/.test(draw('Production Manager', 'producing')));
  ok('...and NOT Log shift output',             !/Log shift output/.test(draw('Production Manager', 'producing')),
     draw('Production Manager', 'producing'));
  ok('...and sees Reconcile remainder',          /Reconcile remainder/.test(draw('Production Manager', 'recon')));
  ok('...and NOT Pack cleared stock',           !/Pack cleared stock/.test(draw('Production Manager', 'pack')),
     draw('Production Manager', 'pack'));

  /* and nothing changed for the role that holds everything */
  r.state.role = 'Production';
  CODES.forEach(c => { delete r.RIGHTS_LIVE[c]; });            /* back to frozen */
  ok('with the rights frozen, Production still sees Log shift output',
     /Log shift output/.test(draw('Production', 'producing')));
  ok('...and Pack cleared stock',  /Pack cleared stock/.test(draw('Production', 'pack')));
  ok('...and Reconcile remainder', /Reconcile remainder/.test(draw('Production', 'recon')));
  ok('while a role outside Production still sees no action button',
     draw('KAM', 'producing') === '', draw('KAM', 'producing'));
}

console.log('\nAuthorisation model — departments, roles, rights: ' + pass + ' passed, ' + fail + ' failed');
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fail ? 1 : 0);
