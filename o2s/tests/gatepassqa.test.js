/* The Gate Pass and the pre-shipment inspection — 23 September 2026.
 *
 * FAULT 8, one step further along. On 21 August the release gate was closed:
 * approveRelease() had checked the role, the stage and the gate pass, but never
 * whether the truck-level inspection had passed. markDelivered() and
 * openDeliveryConfirm() already refused a pending one. So release was the third
 * place the same rule belonged and did not exist.
 *
 * issueGatePass() is the fourth. It checked the right and the stage and nothing
 * else — so the document the driver carries out through the gate could be
 * printed for a truck that approveRelease() would then refuse to release. The
 * paperwork said go; the system said no.
 *
 * Found 23 Sept while verifying that the live gate actually stops a truck. It
 * does. This closes the door the paperwork was still walking through.
 *
 * The predicate is deliberately the SAME expression approveRelease uses —
 * !(s.qa && s.qa.pass) — because "a rule applied in two places and not a third"
 * is exactly how fault 4 and fault 8 both happened. If the two ever disagree,
 * that is the bug.
 */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;

/* ---- source-level: the rule is present, and it matches approveRelease ---- */
const gp = grab('issueGatePass');
const ar = grab('approveRelease');

ok('issueGatePass asks about the inspection at all',
   /s\.qa/.test(gp));
ok('it uses the same predicate approveRelease uses',
   /rows\.filter\(function\(s\)\{\s*return !\(s\.qa && s\.qa\.pass\); \}\)/.test(gp) &&
   /rows\.filter\(function\(s\)\{\s*return !\(s\.qa && s\.qa\.pass\); \}\)/.test(ar));
ok('it distinguishes a FAILED inspection from one not yet done',
   /s\.qa && s\.qa\.fail/.test(gp) && /FAILED/.test(gp));
ok('the stage check is still there',
   /stage!=='loading'/.test(gp));
ok('the right is still checked first',
   gp.indexOf("may('gatepass.issue')") < gp.indexOf('s.qa'));
ok('an already-issued Gate Pass still reports itself rather than the inspection',
   gp.indexOf("rows[0].gatePass") < gp.indexOf('s.qa'));

/* ---- behaviour: run the real function against three shipments ---- */
function run(qa){
  const rows = [{ dispId:'D1', dc:'DC-1', stage:'loading', gatePass:'', qa: qa }];
  const box = {
    console, rows,
    may: () => true, denyRight: () => 'denied',
    shipRowsOf: () => rows,
    nextGatePassNo: () => 'GP-0007',
    logAction: () => {}, save: () => {}, render: () => {},
    toasts: [], state: { shipments: rows }
  };
  box.toast = m => box.toasts.push(String(m));
  box.globalThis = box;
  vm.createContext(box);
  vm.runInContext(gp, box);
  box.issueGatePass('D1');
  return { gatePass: rows[0].gatePass, toast: box.toasts.join(' | ') };
}

const pending = run(null);
eq('a truck with no inspection gets no Gate Pass', pending.gatePass, '');
ok('and is told why', /inspection has not passed/i.test(pending.toast));

const failed = run({ pass:false, fail:true });
eq('a truck that FAILED inspection gets no Gate Pass', failed.gatePass, '');
ok('and is told it failed, not that it is merely pending',
   /FAILED/.test(failed.toast) && !/has not passed/i.test(failed.toast));

const passed = run({ pass:true });
eq('a truck that passed gets its Gate Pass', passed.gatePass, 'GP-0007');
ok('and is told the number', /GP-0007/.test(passed.toast));

/* ---- the whole chain now refuses in the same three places ---- */
ok('approveRelease still refuses an uninspected truck',   /!\(s\.qa && s\.qa\.pass\)/.test(ar));
ok('markDelivered still refuses a pending one',
   /qa==='pending'/.test(grab('markDelivered')));

report();
