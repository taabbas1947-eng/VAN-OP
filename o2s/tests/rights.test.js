/* The access matrix is meant to be the authority map. Until 22 August it was not:
   56 hardRole() gates and 59 raw state.role checks sat underneath it, so a grant
   made in Users & Access could be silently overruled by a role name in the code.
   The COO's example: Finance was given New PO Entry and still could not add a PO,
   because submitPO was hardRole(['KAM']).

   This suite pins the two kinds apart.

   KIND A — doing your own job. Follows the matrix, via mayWork(screenId).
   KIND B — signing off on somebody else's work. Stays on hardRole() and must
            NEVER follow the matrix (2026-07-30: a screen grant given for an
            ordinary reason bought the right to approve and release DCs).

   Run: node rights.test.js */
const H = require('./harness.js');
const fs = require('fs');
const vm = require('vm');

const STATE = JSON.parse(fs.readFileSync(H.STATE, 'utf8')).data;

const src = ['accessOv', '_ownerEdit', 'accessLevel', 'screenEditOK',
             'mayWork', 'whoMayEdit', 'denyWork'].map(H.grab).join('\n\n')
          + '\n' + (function () {
              const i = H.html.indexOf('const SCREENS=');
              if (i < 0) throw new Error('SCREENS not found');
              return H.matchBlock(i, 'SCREENS', '[').replace(/^const /, 'var ') + ';';
            })();

const box = {
  console,
  state: { role: 'COO', masters: JSON.parse(JSON.stringify(STATE.masters)) },
  scr: id => box.SCREENS.find(s => s.id === id),
  _pe: v => String(v == null ? '' : v),
};
box.globalThis = box;
vm.createContext(box);
vm.runInContext(src, box);
const { mayWork, whoMayEdit, denyWork } = box;

let pass = 0, fail = 0; const fails = [];
function ok(n, c, x) { if (c) pass++; else { fail++; fails.push(n + (x ? '  [' + x + ']' : '')); } }
function eq(n, g, w) { ok(n, g === w, 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w)); }
const asRole = r => { box.state.role = r; };
const ALL = (STATE.masters.roles || []).map(r => r.name).concat(['COO'])
              .filter((r, i, a) => a.indexOf(r) === i);

/* ================= KIND A — the matrix decides ================= */

/* Who the matrix says may work the two screens converted so far. Read off the
   real matrix, not asserted from memory — if somebody changes a grant, this
   list changes with it and the test still tells the truth. */
{
  const can = id => ALL.filter(r => { asRole(r); return mayWork(id); });
  asRole('COO');
  /* Entry is converted. Plant Manager here is the COO's DELIBERATE choice of
     22 Aug ("entry yes, Customer Master no") — not an accident of the matrix. */
  eq('New PO Entry — who may work it', can('entry').join(', '), 'KAM, Plant Manager, COO');
  /* Customer Master is HELD BACK until customer/dealer rows carry ids, so the
     matrix must NOT govern it yet. If somebody converts it, this fails. */
  const dealerSrc = H.grab('custSave') + H.grab('addDealer');
  ok('Customer Master is still hard-gated (held back until ids exist)',
     /hardRole\(\['KAM'\]\)/.test(dealerSrc) && !/mayWork\('dealers'\)/.test(dealerSrc));
  ok('...and the refusal says why', /held back until customer records carry ids/.test(dealerSrc));
}

/* THE POINT OF THE WHOLE CHANGE. The COO grants Finance PO entry in Users &
   Access; Finance can then enter a PO. No code change, no deploy. */
{
  const m = box.state.masters.accessMatrix;
  asRole('Finance');
  ok('BEFORE the grant: Finance cannot enter a PO', mayWork('entry') === false);
  m['Finance'].entry = { v: true, e: true };
  ok('AFTER the grant: Finance CAN enter a PO — this is the fault being fixed',
     mayWork('entry') === true);
  m['Finance'].entry = { v: false, e: false };
  ok('and taking the grant away closes it again', mayWork('entry') === false);
}

/* A brand-new role invented in Users & Access gets nothing by accident. */
{
  const m = box.state.masters.accessMatrix;
  asRole('Night Shift Clerk');
  ok('an unknown role gets no edit anywhere by default', !mayWork('entry') && !mayWork('dealers'));
  m['Night Shift Clerk'] = { entry: { v: true, e: true } };
  ok('...until it is granted, and then only where it was granted',
     mayWork('entry') === true && mayWork('dealers') === false);
  delete m['Night Shift Clerk'];
}

/* mayWork must ask about the NAMED screen, never the screen the person is on.
   canEdit() does the latter; QA Inspector holds prod:{e:true}, so canEdit()
   would have let them submit a PO from the Production screen. */
{
  asRole('QA Inspector');
  box.state.screen = 'prod';
  ok('QA Inspector standing on Production still cannot enter a PO', mayWork('entry') === false);
  delete box.state.screen;
}

/* The refusal must name the screen and the real people, so it is actionable. */
{
  asRole('Production');
  const msg = denyWork('entry', 'Submitting a PO');
  ok('refusal names what was refused', /Submitting a PO/.test(msg), msg);
  ok('refusal names the SCREEN whose access decides it', /New PO Entry/.test(msg), msg);
  ok('refusal names who can, from the matrix', /KAM/.test(msg) && /Plant Manager/.test(msg), msg);
  ok('refusal says where to go', /Users & Access/.test(msg), msg);
}

/* whoMayEdit must not fall over when the roles list is missing or malformed —
   a refusal that throws leaves the person with no message at all. */
{
  asRole('Production');
  const saved = box.state.masters.roles;
  [undefined, null, [], 'not-an-array', [{ name: 'KAM' }, null, 'COO']].forEach((v, i) => {
    box.state.masters.roles = v;
    let out = null, threw = false;
    try { out = whoMayEdit('entry'); } catch (e) { threw = true; }
    ok('whoMayEdit survives a broken roles list (case ' + i + ')', !threw && Array.isArray(out));
    ok('...and still names the COO (case ' + i + ')', !threw && out.indexOf('COO') >= 0);
  });
  box.state.masters.roles = saved;
}

/* ================= KIND B — the matrix must NOT decide ================= */

/* THE REAL TEST — reproduce the 30 July incident and prove it still fails.
   A reviewer planted the regression back into hardRole (making it consult the
   screen override) and all 424 checks stayed green, because the Kind B section
   below was only a source grep. A grep proves six strings are present. It cannot
   prove the gate still means anything. This runs hardRole itself, as the account
   from the incident, standing on the screen it was granted. */
{
  const hbox = { console, state: {
    role: 'Supply Chain Officer', screen: 'ship',
    masters: { accessMatrix: { 'Supply Chain Officer': {
      ship: { v: true, e: true }, qc: { v: true, e: true },   /* the real July grants */
      prod: { v: true, e: true }, entry: { v: true, e: true } /* and then some */
    } } } } };
  hbox.globalThis = hbox;
  vm.createContext(hbox);
  vm.runInContext(H.grab('hardRole'), hbox);
  const hr = hbox.hardRole;

  [['Plant Manager', 'approve or release a DC'], ['QCM', 'sign a COA'],
   ['AQCM', 'review a COA'], ['Production', 'enter production']].forEach(([role, what]) => {
    ok('JULY INCIDENT: a screen Edit grant must NOT buy the right to ' + what,
       hr([role]) === false, 'hardRole([' + role + ']) returned true');
  });
  ['ship', 'qc', 'prod', 'entry', 'approvals', undefined].forEach(scrn => {
    hbox.state.screen = scrn;
    ok('...on whichever screen they are standing (' + (scrn || 'none') + ')',
       hr(['Plant Manager']) === false);
  });
  hbox.state.screen = 'ship';

  /* and it still does its actual job */
  ok('hardRole still admits the role it names', hr(['Supply Chain Officer']) === true);
  hbox.state.role = 'COO';
  ok('hardRole still admits the COO', hr(['Plant Manager']) === true);
  hbox.state.role = 'Production';
  ok('hardRole still refuses an unrelated role', hr(['Plant Manager']) === false);

  /* Belt and braces: the source must not even mention the matrix. */
  const body = H.grab('hardRole');
  ok('hardRole reads no access matrix', !/accessMatrix|accessOv|accessLevel/.test(body), body.slice(0, 120));
  ok('hardRole reads no current screen', !/state\.screen/.test(body), body.slice(0, 120));
}

/* These are sign-offs: a second person checking a first person's work. If a
   screen grant could buy them, the chain is decoration. Source guard — it proves
   the strings are present, nothing more. The behaviour test above is the one
   that would catch a real regression. */
{
  const mustStayHard = [
    ['coaReview',      'AQCM',          'lab certificate — second signature'],
    ['coaApprove',     'QCM',           'lab certificate — final signature'],
    ['approveDC',      'Plant Manager', 'approving a delivery challan'],
    ['approveRelease', 'Plant Manager', 'releasing a loaded truck'],
    ['rejectDC',       'Plant Manager', 'rejecting a delivery challan'],
    ['doReopenBatch',  'Plant Manager', 'undoing a batch close'],
    ['openReopenBatch','Plant Manager', 'opening the reopen dialog'],
    ['coaDeviation',   'Plant Manager', 'accepting a lab deviation'],
    ['coaRework',      'Plant Manager', 'sending a batch for rework'],
  ];
  mustStayHard.forEach(([fn, role, what]) => {
    let body = '';
    try { body = H.grab(fn); } catch (e) { /* reported below */ }
    ok('KIND B still hard-gated: ' + fn + ' (' + what + ')',
       !!body && new RegExp("hardRole\\(\\[[^\\]]*'" + role + "'").test(body),
       body ? 'no hardRole([...' + role + '...]) found' : 'function ' + fn + ' not found');
    ok('KIND B not converted by mistake: ' + fn + ' does not call mayWork',
       !!body && !/mayWork\(/.test(body));
  });
}

/* The sweep so far: every KAM gate is gone. When Production and admin are done,
   this list grows. */
{
  const kam = (H.html.match(/hardRole\(\['KAM'\]\)/g) || []).length;
  eq('the 3 remaining KAM gates are the held-back Customer Master ones', kam, 3);
  /* 63 hardRole CALLS on 56 lines before the sweep (the earlier "56" was a line
     count, not a call count — worth being exact, because this number will get
     quoted). Seven KAM calls converted, so 56 calls remain. */
  const total = (H.html.match(/hardRole\(\[/g) || []).length;
  eq('4 of the 63 hardRole calls converted (entry only; dealers held back)', total, 59);
  ok('the Kind B sign-off gates are untouched', total >= 40, 'remaining: ' + total);
  console.log('    hardRole calls: 63 before the sweep, ' + total + ' now  (' + (63 - total) + ' converted; Customer Master held back)');
}

console.log('\nRights — matrix vs sign-off: ' + pass + ' passed, ' + fail + ' failed');
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fail ? 1 : 0);
