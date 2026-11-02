/* BUILD 2026-10-30a (trial). Alerts follow the sign-off ticks (Tahir, 30 Oct 2026: "now").
   The phone and laptop alert for a sign-off job goes to the roles ticked for that sign-off on the launcher
   (masters.signoffs), not to a fixed list; with nothing saved it goes exactly where it went before.
   Run: node alerts-follow-ticks.test.js */
const H = require('./harness.js');
const { ok, eq, report, grab } = H;
const R = require('../notify-routes.js');
const A = (label, signoffs) => JSON.stringify(R.allowedFor(label, signoffs === undefined ? {} : { signoffs }));

ok('the alerts read the sign-off defaults from o2s.html', R.signoffRulesRead() === true);
/* with nothing saved: exactly the fixed lists of before */
Object.keys(R.SIGNOFF_JOBS).forEach(l => eq('nothing saved: "' + l + '" goes where it went before', A(l), JSON.stringify(R.JOB_ROLES[l])));
/* every sign-off job on Today is one of these labels, and each names a real sign-off */
{ const ai = grab('actionItems'); const re = /role:soRole\('([a-z.]+)'\),alsoRoles:soAlso\('\1'\)[^}]*?label:'([^']+)'/g; let m, n = 0;
  while ((m = re.exec(ai))) { n++; ok('Today job "' + m[2] + '" (' + m[1] + ') follows its ticks in the alerts too', R.SIGNOFF_JOBS[m[2]] && R.SIGNOFF_JOBS[m[2]].action === m[1]); }
  ok('the Today sign-off jobs were found (' + n + '; the truck review job holds a function, so the simple match skips it)', n >= 7);
  Object.keys(R.SIGNOFF_JOBS).forEach(l => ok('"' + l + '" is a Today job label', ai.indexOf("label:'" + l + "'") >= 0)); }
/* a saved list replaces the default */
eq('a role ticked to inspect gets the Inspect alert', A('Inspect', { inspection: ['QA Inspector', 'Production Manager'] }), '["QA Inspector","Production Manager"]');
eq('...and the Pack QC alert', A('Pack QC', { inspection: ['Production Manager'] }), '["Production Manager"]');
eq('a role taken off approving a COA gets no Approve alert', A('Approve', { 'coa.approve': ['Plant Manager'] }), '["Plant Manager"]');
eq('the COO gets no sign-off alert even when ticked (the COO sees every job on Today), as before', A('Release', { 'truck.release': ['COO', 'Plant Manager'] }), '["Plant Manager"]');
eq('"Review" keeps the Plant Manager for the UNFIT lot job, whoever reviews COAs', A('Review', { 'coa.review': ['QCM'] }), '["QCM","Plant Manager"]');
eq('an empty saved list alerts nobody for that sign-off', A('Approve DC', { 'dc.approve': [] }), '[]');
/* jobs that are not sign-offs keep their fixed lists */
eq('a job that is not a sign-off keeps its fixed roles', A('Close batch', { inspection: ['KAM'] }), JSON.stringify(R.JOB_ROLES['Close batch']));
ok('a job listed with null still goes to any O2S role', JSON.parse(A('Lab test')).length >= 10);
/* review of 2 Nov: ticks not read in a sweep = close nothing, or open sign-off jobs alert their people again next sweep */
{ const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'notify-routes.js'), 'utf8');
  ok('ticks not read: the sweep closes no alert (like a failed people lookup)', /if \(!\(st0 && st0\.data && st0\.data\.masters\)\) \{ lookupFailed = true;/.test(src) && /mode === 'sweep' && !lookupFailed && startedAt/.test(src)); }
{ const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'notify-routes.js'), 'utf8');
  ok('a role made on the launcher and ticked gets the sign-off alert (not only the 15 built-in roles)', /\(so \|\| O2S_ROLES\.indexOf\(r\) >= 0\) && allowed\.indexOf\(r\) >= 0/.test(src));
  eq('...its name passes the tick list', A('Inspect', { inspection: ['QA Inspector', 'Night QA'] }), '["QA Inspector","Night QA"]'); }
report('30a: alerts follow the sign-off ticks');
