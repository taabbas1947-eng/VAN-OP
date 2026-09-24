#!/usr/bin/env node
/* preflight — the gate that must pass before any edit to o2s.html is committed.
 *
 * Every defect introduced on 23 September 2026 had one cause: work built on a
 * copy of the file staged earlier in the session, while the file on disk had
 * moved on. It cost the handoff entry twice, wiped another session's work once,
 * and nearly wiped the Gate Pass fix. Each time it was caught by luck or by a
 * test, and each time the response was to promise more care. Promises do not
 * survive a long session. This does.
 *
 *   node preflight.js base   <fresh> <working>   before editing
 *   node preflight.js verify <fresh> <candidate> before committing
 *
 * base   — refuses unless the working copy is byte-identical to the file just
 *          re-staged from disk. Run it AFTER staging and BEFORE the first edit.
 * verify — refuses unless every marker the base file carried is still present in
 *          the candidate. Catches a rebuild that silently dropped earlier work.
 *
 * Exit 0 = go. Exit 1 = stop, do not commit.
 */
const fs = require('fs');
const crypto = require('crypto');

const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const die = m => { console.error('PREFLIGHT FAILED\n  ' + m); process.exit(1); };
const ok  = m => { console.log('preflight ok — ' + m); process.exit(0); };

/* Markers: the load-bearing facts a rebuild must not lose. Each is a string that
   must appear in the file, with the count it must appear at. Add one line here
   for every change that ships; that is what makes the check grow teeth. */
const MARKERS = [
  ["var BUILD_ID='2026-09-",              1, 'the build id'],
  ['function entryPrintEffective(',        1, 'FOC price-on-pack (23a)'],
  ['no Gate Pass. Correct it and re-inspect', 1, 'Gate Pass needs inspection (23b)'],
  ['function shortCloseRefusal(',          1, 'the short-close guard'],
  ["'Closed short'",                       2, 'the short-close stage'],
  ['function qaRequiredOn(',               1, 'the QA cut-over'],
  ["var QA_GO_LIVE='2026-09-23'",          1, 'the QA go-live date'],
  ['function evStamp(',                    1, 'the entry stamp'],
  ['function requestShortClose(',          1, 'short close: request'],
  ['function approveShortClose(',          1, 'short close: approve'],
  ['function reopenShortClose(',           1, 'short close: reopen'],
  ["code:'po.shortclose_request'",         1, 'short close: the rights'],
  ['function openShortCloseReview(',       1, 'short close: the approver modal'],
  /* The role model. A role is joined by its NAME as a string; a name that goes
     missing from these tables does not raise anything, it just stops matching.
     rolemodel.test.js pins the whole set; these three are the load-bearing
     lines that must survive any edit. */
  ["if(r.builtin){toast('Built-in roles can",  2, 'the built-in role lock (rename + archive)'],
  ['function seedRolesV1(',                1, 'the ten built-in roles'],
  ["'Production Manager'",                14, 'Production Manager, pre-wired and inert'],
  /* The eighth stage. BUCKETS drives every dashboard count; losing any of these
     four lines puts closed lines back into the open-order figures silently. */
  ["'Closed short'];",                     2, 'Closed short: the 8th bucket and the last stage'],
  ['const PIPELINE_BUCKETS=',              1, 'the seven-stage pipeline for bars'],
  ['function bucketOpen(',                 1, 'the open predicate'],
  ['function orderOpen(',                  1, 'the order-level open predicate'],
  ['function aggOpen(',                    1, 'fulfilment without closed lines'],
  ['DELIBERATELY not short-close aware',   1, 'cleared stock still ships'],
  ['  shortclose:{label:',                 1, 'the short-close report dataset'],
  /* The title layer. Losing any of these puts internal role names back on a
     customer's COA, and takes two people's own titles off their signatures. */
  ['var ROLE_TITLE=',                      1, 'the default job titles'],
  ['var USER_TITLE=',                      1, 'the two per-person titles'],
  ['function personTitle(',                1, 'person title beats role title'],
  ['function sigTitle(',                   1, 'the signature title'],
  ['function seedTitlesV1(',               1, 'titles seeded idempotently'],
  /* The warehouse split, step one of two. Losing these puts dispatch back in one
     pair of hands with procurement. */
  ["'warehouse':'supply-chain'",           1, 'Warehouse filed inside Supply Chain'],
  ["'Warehouse':'Senior Warehouse Officer'", 1, 'the warehouse title'],
  ['var DISPATCH_LIVE=',                   1, 'the four dispatch rights'],
  ['var DISPATCH_GRANT=',                  1, 'who dispatches'],
  ['var PROCUREMENT_GRANT=',               1, 'procurement is the lead\u2019s'],
  ['if(RIGHTS_LIVE[r.code]===true) return;', 1, 'the drift card ignores live rights'],
  ["roles:['Production Manager','Supply Chain']", 1, 'short close: the two managers'],
  ["hardRole(['Supply Chain'])",            3, 'the three dispatch approval points'],
  ['THERE IS NO COVER',                     1, 'no cover named for Saad yet'],
  ["canEdit(['Supply Chain','Warehouse'])", 4, 'packed-stock custody'],
  /* 2026-09-23j - Today, three places, the night's rulings */
  ['function screenToday(',                1, 'Today - the front door (23j)'],
  ['var TD_LABEL=',                        1, 'Today - plain words for every label'],
  /* 23s: "Report Center" became the word "Plant" (Tahir, 23 Sep night, asked and
     answered). The marker follows the ruling; the group itself is still there. */
  ["label:'Plant', ids:['plant']",         1, 'the four-word header (was the three-place sidebar)'],
  ['function seedAccessV2(',               1, 'the ruled access matrix (R1, R5, R7, R20)'],
  ['function seedCustomerRightsV1(',       1, 'customers to Finance (R5, R9)'],
  ['function seedWarehouseRoleV1(',        1, 'the Warehouse role (R12)'],
  ['async function migrateAccountsV1(',    1, 'Ismaeel to Finance (R22)'],
  /* 2026-09-23k */
  ['function openDelayReasonOrder(',       1, 'one reason per late order (R14)'],
  ['function seedPrintDecisionV1(',        1, 'the old print-on-pack backlog answered (R2)'],
  /* 2026-09-23l */
  ['body.td-on #periodSel',                1, 'Today hides the reporting period (design pass 23l)'],
  ['function _tdClient(',                  1, 'Today - the client name on a card'],
  /* 2026-09-23m */
  ['function migrateProductsV1(',          1, 'one product master (R17): the migration'],
  ['function applyProductsV1(',            1, 'one product master (R17): the rebuild'],
  /* 2026-09-23n */
  ['var MONEY_ROLES=',                     1, 'who sees money (R6)'],
  ['function budgetByChannel(',            1, 'the budget tree (R8)'],
  /* 2026-09-23o */
  ['function approveCustomer(',            1, 'a new customer is approved first (R9)'],
  /* 2026-09-23p */
  ['function fireLists(',                  1, 'the Firefighter dashboard (P6)'],
  /* 2026-09-23q */
  ['function backOfficeManualCard(',       1, 'the Back Office manual (R15)'],
  /* 2026-09-23r */
  ['<style id="van-theme">',               1, 'the design, app-wide (23r)'],
  /* 2026-09-23s */
  ['<style id="qs-shell">',                1, 'the Queue Shell, live (23s)'],
  ['function screenPlant(',                1, 'Plant: the 3 lights (23s)'],
  ['function boJobs(',                     1, 'Back Office as jobs (23s)'],
  ['function screenPeople(',               1, 'People, not a matrix (23s)'],
  ['function rolesTitlesCard(',            1, 'the Guide opens on roles and titles (23s)'],
  /* 2026-09-24g */
  ['function boNeeds(',                    1, 'Back Office: Needs you (24g)'],
  ['function boDesks(',                    1, 'Back Office: the 6 desks (24g)'],
  ['function pmSettle(',                   1, 'settle a base from the anomaly list (24g)'],
  ['function channelBudgetSaveAll(',       1, 'the channel budget saves with a button (24g)'],
  ['function custPendingHTML(',            1, 'customers waiting for the CFO, on Customers (24g)'],
  ['function reTabsHTML(',                 1, 'the role editor in 3 tabs (24g)'],
];

const [, , mode, freshPath, otherPath] = process.argv;
if (!mode || !freshPath || !otherPath) die('usage: preflight.js base|verify <fresh> <other>');
for (const p of [freshPath, otherPath]) if (!fs.existsSync(p)) die('missing file: ' + p);

if (mode === 'base') {
  const a = sha(freshPath), b = sha(otherPath);
  if (a !== b) die(
    'the working copy is NOT the file on disk.\n' +
    '  disk    ' + a.slice(0, 16) + '  ' + fs.statSync(freshPath).size + ' bytes\n' +
    '  working ' + b.slice(0, 16) + '  ' + fs.statSync(otherPath).size + ' bytes\n' +
    '  Someone changed it, or you are holding a stale stage. Re-stage and start again.');
  ok('working copy matches disk (' + a.slice(0, 16) + ')');
}

if (mode === 'verify') {
  const base = fs.readFileSync(freshPath, 'utf8');
  const cand = fs.readFileSync(otherPath, 'utf8');
  const lost = [];
  for (const [needle, want, what] of MARKERS) {
    const inBase = base.split(needle).length - 1;
    const inCand = cand.split(needle).length - 1;
    if (inBase === 0) continue;                       // not in this baseline yet
    if (inCand < Math.min(inBase, want)) lost.push(`${what}: base ${inBase}, candidate ${inCand}`);
  }
  if (lost.length) die('the candidate has LOST work that is on disk:\n  - ' + lost.join('\n  - '));
  if (cand.length < base.length * 0.98) die(
    'the candidate is ' + (base.length - cand.length) + ' bytes smaller than the file on disk. ' +
    'An edit adds; a rebuild from a stale copy shrinks. Check before committing.');
  ok('candidate keeps every marker the disk file carries');
}

die('unknown mode: ' + mode);
