/* SUPPLY CHAIN SPLITS THREE WAYS — 23 September 2026, pass B.

   Tahir's ruling, asked as a direct question: Supply Chain becomes three roles.
   Lead Supply Chain keeps procurement and the RM chain; a warehouse role gets
   loading, the Gate Pass and packed-stock custody; the assistant gets data entry
   only. His words for why: "a warehouse officer cannot approve his own
   procurement."

   WHO DOES WHAT, from HR's sheet: Saad Jamal is Lead Supply Chain (procurement),
   Shoaib Sabir is Senior Warehouse Officer (warehousing and dispatch), Zain
   Ghaffar is Warehouse Assistant (data entry). Warehouse sits INSIDE Supply
   Chain as a department - C10 dropped the seventh-department idea.

   ======================================================================
   THIS IS STEP ONE OF TWO, AND THAT IS DELIBERATE.
   ======================================================================
   The four dispatch rights are still answered by legacy:{kind:'canEdit',
   owners:[...]} - they are NOT in RIGHTS_LIVE, so the grant table does not
   decide them yet. If 'Supply Chain' were removed from those owners today,
   dispatch would stop working the moment this shipped, because NOBODY HOLDS THE
   WAREHOUSE ROLE YET - there are no logins at all (the HR sheet's "Login
   Created" column is empty for all of them).

   So step one is purely ADDITIVE: Warehouse gains everything it needs, and
   nothing loses anything. Step two - removing 'Supply Chain' from the four
   dispatch rights, and removing 'KAM' from New PO Entry per C9 - happens once
   the accounts exist and Shoaib and the Finance desk are actually logged in.

   This file pins BOTH halves: what has been added, and what has deliberately not
   been removed yet, with the exact edit named. A half-done change that nobody
   wrote down is indistinguishable from a finished one six weeks later.

   Run: node warehousesplit.test.js */
const H = require('./harness.js');
const fs = require('fs');
const STATE = JSON.parse(fs.readFileSync(H.STATE, 'utf8')).data;

let pass = 0, fail = 0; const fails = [];
function ok(n, c, x) { if (c) pass++; else { fail++; fails.push(n + (x ? '  [' + x + ']' : '')); } }
function eq(n, g, w) { ok(n, g === w, 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w)); }

function blockAt(needle, open) {
  const i = H.html.indexOf(needle);
  if (i < 0) throw new Error('not found: ' + needle);
  return H.matchBlock(i, needle, open);
}
const SCR = blockAt('const SCREENS=', '[');
const RGT = blockAt('var RIGHTS=', '[');

/* One right's source, by code. */
function right(code) {
  const re = new RegExp("\\{code:'" + code.replace('.', '\\.') + "'[\\s\\S]*?\\}\\}");
  const m = re.exec(RGT);
  if (!m) throw new Error('right not found: ' + code);
  return m[0];
}
/* The owners array of one screen, spliced at ITS closing bracket - several
   screens share their owners text verbatim, so matching on the text picks the
   wrong one. That mistake was made while writing this change and caught by an
   assertion; it is not repeated here. */
function owners(id) {
  const i = SCR.indexOf("{id:'" + id + "',");
  const o = SCR.indexOf('owners:[', i), c = SCR.indexOf(']', o);
  return (SCR.slice(o, c).match(/'[^']*'/g) || []).map(q => q.slice(1, -1));
}

const DISPATCH = ['shipment.plan', 'shipment.load', 'gatepass.issue', 'delivery.confirm'];
const PROCUREMENT = ['rm.check', 'rm.receive', 'pr.close'];

/* ================= 1. THE ROLE EXISTS IN CODE, AND NOWHERE ELSE YET ================= */
ok('Warehouse is filed inside Supply Chain', /'warehouse':'supply-chain'/.test(H.html));
ok('...and is titled Senior Warehouse Officer', /'Warehouse':'Senior Warehouse Officer'/.test(H.html));
/* Inert, exactly like Production Manager: wired in code, held by nobody, so
   everything naming it does nothing at all until the COO adds the role. */
eq('Warehouse is not a role in live state yet',
   (STATE.masters.roles || []).filter(r => r.name === 'Warehouse').length, 0);

/* ================= 2. HOW THE WAREHOUSE REACHES DISPATCH ================= */
/* TWO WRONG ROUTES, BOTH RULED OUT BY MEASUREMENT, BEFORE THE RIGHT ONE.

   FIRST: add 'Warehouse' to owners:['Supply Chain'] inside the dispatch rights'
   `legacy` blocks. authmodel.test.js refused it, correctly - a legacy block is a
   FROZEN RECORD of what the gate did before conversion, and editing one makes the
   app claim the old rule was something it never was. Reverted.

   SECOND: tick Warehouse = edit on Shipments in the access matrix, since
   _canEditOn() consults the matrix before the owners list. Running the real gate
   showed that tick hands Warehouse PROCUREMENT as well - rm.check, rm.receive,
   pr.close - because a canEdit right asks about the screen the person is STANDING
   ON, not the screen the job belongs to. It would have defeated the one thing the
   split exists to do.

   THE RIGHT ONE: make the rights live, so the grant table decides them and the
   answer is the same on every screen. See dispatchgrants.test.js. */
{
  const ce = H.grab('_canEditOn');
  /* Compared against where the owners list is USED, not where it is named: the
     first version of this check compared against indexOf('owners'), which finds
     the parameter in the signature and is therefore always first. */
  const mi = ce.indexOf('accessMatrix'), oi = ce.indexOf('(owners||[])');
  ok('the access matrix is consulted before the owners list', mi > -1 && oi > -1 && mi < oi);
  ok('...and an explicit grant is enough on its own', /if\(o\.e===true\) return true;/.test(ce));
  ok('...and an explicit refusal still wins', /if\(o\.e===false\) return false;/.test(ce));
  ok('the reason is written where the change would have gone',
     /not by editing the dispatch rights/.test(H.html));
  /* So the frozen records must still read exactly as they did. */
  DISPATCH.forEach(c => ok(c + " keeps its frozen legacy owners untouched",
     /owners:\['Supply Chain'\]/.test(right(c)), right(c).slice(0, 110)));
}

/* ================= 3. PROCUREMENT IS NOT ================= */
/* The separation Tahir asked for, stated as the thing that must stay false. */
PROCUREMENT.forEach(c => ok(c + ' does NOT name Warehouse', right(c).indexOf("'Warehouse'") < 0));
ok('the raw-material master stays with Supply Chain',
   /function rmCanEdit\(\)\{ return canEdit\(\['Supply Chain'\]\); \}/.test(H.html));

/* ================= 4. PACKED-STOCK CUSTODY ================= */
['clearQaHold', 'lotQACorrect'].forEach(fn =>
  ok(fn + " asks canEdit(['Supply Chain','Warehouse'])", /canEdit\(\['Supply Chain','Warehouse'\]\)/.test(H.grab(fn))));
ok('the Pre-shipment QA screen lets the warehouse in',
   /isSC=canEdit\(\['Supply Chain','Warehouse'\]\)/.test(H.grab('screenQA')));
ok('...and so does Lab QC', /isSC=canEdit\(\['Supply Chain','Warehouse'\]\)/.test(H.grab('screenQC')));

/* ================= 5. THE SCREENS ================= */
{
  const want = ['dash', 'approvals', 'tracker', 'qa', 'ship', 'reports', 'instructions'];
  want.forEach(id => ok('Warehouse can open ' + id, owners(id).indexOf('Warehouse') > -1, owners(id).join(',')));
  /* Not Production, not New PO Entry. A warehouse officer logs no output and
     raises no order. */
  ['prod', 'entry'].forEach(id => ok('Warehouse is NOT on ' + id, owners(id).indexOf('Warehouse') < 0));
}

/* ================= 6. STEP TWO — WHAT HAS NOT BEEN REMOVED YET ================= */
/* These assertions describe a DELIBERATELY unfinished state. Each names the edit
   that finishes it. When somebody makes that edit, the assertion here fails and
   points at itself - which is the only way a two-step change survives six weeks
   and a different pair of hands. */
{
  /* DONE, later the same day. The step described here as pending was carried out
     once Tahir ruled on who dispatches: the four rights went into RIGHTS_LIVE and
     the grant table decides them. dispatchgrants.test.js holds the detail. The
     legacy blocks are untouched - they are a frozen record, and going live makes
     them inert rather than wrong. */
  const liveNow = H.grabTopVar('RIGHTS_LIVE', '{');
  DISPATCH.forEach(c => ok("STEP 2 DONE — " + c + " is decided by the grant table", liveNow.indexOf("'" + c + "'") > -1));
  DISPATCH.forEach(c => ok("...and its frozen legacy record is untouched", right(c).indexOf("'Supply Chain'") > -1));

  /* C9: KAM becomes a read-only reviewer, so it loses New PO Entry. C2 said the
     opposite and Tahir resolved it in favour of C9 on 23 September. Finance is
     on the screen now; KAM comes off when the Finance desk is logged in. */
  ok('Finance can now raise a PO', owners('entry').indexOf('Finance') > -1, owners('entry').join(','));
  ok('Finance Desk Officer can too', owners('entry').indexOf('Finance Desk Officer') > -1);
  ok('STEP 2 PENDING — KAM still has New PO Entry', owners('entry').indexOf('KAM') > -1);
  /* THE EDIT: remove 'KAM' from the entry screen's owners, and move
     customer.create / customer.amend off legacy:{kind:'hard',roles:['KAM']}.
     Those two are ONE change (C3 + C9): a read-only KAM cannot hold
     customer.create, so doing either alone breaks Customer Master for whoever
     holds KAM. */
  ok('STEP 2 PENDING — customer.create is still hard-wired to KAM',
     /roles:\['KAM'\]/.test(right('customer.create')));
  ok('STEP 2 PENDING — so is customer.amend', /roles:\['KAM'\]/.test(right('customer.amend')));

  /* And the reason the KAM half cannot simply be done now, stated as a fact about
     the file rather than a note: these two are not live, so the legacy roles list
     IS the answer, and it names KAM. */
  ['customer.create', 'customer.amend'].forEach(c =>
    ok(c + " is not in RIGHTS_LIVE, so its legacy roles still decide", liveNow.indexOf("'" + c + "'") < 0));
}

console.log('\nSupply Chain splits three ways — dispatch done, the KAM half pending: ' + pass + ' passed, ' + fail + ' failed');
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fail ? 1 : 0);
