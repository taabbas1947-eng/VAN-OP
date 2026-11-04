/* BUILD 2026-11-04a. Tahir, 3 and 4 Nov 2026 (panels): Ismaeel (Finance) and Basit (Finance Desk Officer) swap roles on the
   launcher, and the Finance Desk Officer role is widened so Ismaeel loses nothing (D-367). Every job O2S gives to the role
   NAME Finance is the Finance Desk Officer's too; nothing is taken from Finance. Run: node fdo1104a.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, grabTopVar, html } = H;
const F = 'Finance', FDO = 'Finance Desk Officer';

/* 1. role lists that decide a job by name: Finance keeps it, the Finance Desk Officer has it too */
const own = id => { const m = new RegExp("\\{id:'" + id + "', name:'[^']*', ic:'[^']*', owners:\\[([^\\]]*)\\]").exec(html); return m ? m[1] : ''; };
['entry', 'dealers', 'samples'].forEach(id => ok('screen owners ' + id + ': Finance and the Finance Desk Officer', own(id).includes("'" + F + "'") && own(id).includes("'" + FDO + "'"), own(id)));
ok('closing a small remainder short (po.shortclose_small, by role name)', /legacy:\{kind:'hard', roles:\['Supply Chain','Finance','Finance Desk Officer','Warehouse'\]\}\}/.test(html));
const sb = {}; vm.createContext(sb);
vm.runInContext(grabTopVar('INVOICE_ROLES', '[') + grabTopVar('BUDGET_VIEW_ROLES', '[') + grabTopVar('CUSTOMER_GRANT', '{') + grabTopVar('USER_TITLE', '{') + grabTopVar('MV_PAGE_ROLE', '{')
  + '\nthis.R={INVOICE_ROLES,BUDGET_VIEW_ROLES,CUSTOMER_GRANT,USER_TITLE,MV_PAGE_ROLE};', sb);
const R = sb.R;
ok('the Invoicing sheet: Finance and the Finance Desk Officer', R.INVOICE_ROLES.includes(F) && R.INVOICE_ROLES.includes(FDO) && R.INVOICE_ROLES.length === 2);
ok('Sales & Budget to look at: Finance, the Finance Desk Officer, Supply Chain, the Production Manager', [F, FDO, 'Supply Chain', 'Production Manager'].every(r => R.BUDGET_VIEW_ROLES.includes(r)) && R.BUDGET_VIEW_ROLES.length === 4);
ok('customer rights default: Finance, the Finance Desk Officer, the CFO', R.CUSTOMER_GRANT[F] === true && R.CUSTOMER_GRANT[FDO] === true && R.CUSTOMER_GRANT.CFO === true);
eq('Ismaeel keeps his own title across the swap', R.USER_TITLE.ismaeel, 'Invoicing Officer');
eq('Basit keeps his own title across the swap', R.USER_TITLE.basit, 'Procurement Accountant');
ok('the earlier per-person titles are unchanged', R.USER_TITLE.aliraza === 'Production Associate' && R.USER_TITLE.ahmer === 'System Administrator');
ok('the Morning view role keys: Finance and the Finance Desk Officer both point at Ismaeel\'s page', R.MV_PAGE_ROLE[F] === 'ismaeel' && R.MV_PAGE_ROLE[FDO] === 'ismaeel');
ok('complaints: a wrong print on a PO goes to the KAM, Finance and the Finance Desk Officer', /rolesPo:\['KAM','Finance','Finance Desk Officer'\]/.test(html));
['late', 'trucks', 'shortclose', 'invoicing'].forEach(id => { const m = new RegExp("\\{id:'" + id + "', t:[^\\n]*?roles:\\[([^\\]]*)\\]\\}").exec(html);
  ok('report ' + id + ': Finance and the Finance Desk Officer', !!m && m[1].includes("'" + F + "'") && m[1].includes("'" + FDO + "'"), m && m[1]); });
const NR = require('../notify-routes.js');
ok("the 'Print price' alert reaches Finance and the Finance Desk Officer", NR.JOB_ROLES['Print price'].includes(F) && NR.JOB_ROLES['Print price'].includes(FDO));

/* 2. Today: a job routed to Finance is the Finance Desk Officer's too; a job with a named person stays that person's */
{ const ai = grab('actionItems'); const line = (/\n  (items\.forEach\(function\(it\)\{ if\(it && it\.role==='Finance'[^\n]*?\}\);)/.exec(ai) || [])[1];
  ok('actionItems adds the Finance Desk Officer to jobs routed to Finance', !!line);
  const b = {}; vm.createContext(b); vm.runInContext(grab('itOwnedBy') + '\n' + grab('itBarred') + '\nfunction norm(items){ ' + line + ' return items; }', b);
  const mine = (it, role, user) => b.itOwnedBy(it, role) && (!it.who || it.who === user) && !b.itBarred(it, user, role);
  const [pp, sent, cfo, both] = b.norm([{ role: F, label: 'Print price' }, { role: F, who: 'ismaeel', label: 'PO sent back' }, { role: 'CFO', label: 'Approve PR' }, { role: F, alsoRoles: [FDO] }]);
  ok('print-on-pack answers: Finance sees it', mine(pp, F, 'basit'));
  ok('print-on-pack answers: the Finance Desk Officer sees it', mine(pp, FDO, 'ismaeel'));
  ok('a PO sent back to Ismaeel by name: Ismaeel sees it as Finance Desk Officer', mine(sent, FDO, 'ismaeel'));
  ok('a PO sent back to Ismaeel by name: Basit (Finance) does not', !mine(sent, F, 'basit'));
  ok('a job for another role is untouched', !cfo.alsoRoles && !mine(cfo, FDO, 'ismaeel'));
  eq('adding twice does not repeat the role', both.alsoRoles.join('|'), FDO); }

/* 3. the one-time move of 23 Sep (R22) can never undo the swap */
{ const i = html.indexOf('\nasync function migrateAccountsV1('); const src = H.matchBlock(i + 1, 'migrateAccountsV1');
  ok('migrateAccountsV1 returns at once (retired, D-367)', /^async function migrateAccountsV1\(\)\{\n  return;/.test(src)); }

/* 4. Guide, changelog, build, system documentation */
ok('Guide: orders are raised by Finance, the Finance Desk Officer, the CFO and the COO', /Orders are raised by Finance, the Finance Desk Officer, the CFO and the COO only/.test(html));
ok('Guide: Finance or the Finance Desk Officer adds a customer', /Finance or the Finance Desk Officer adds a customer; it is born/.test(html));
ok('Guide: who closes a small remainder', /<b>Supply Chain<\/b>, <b>Finance<\/b>, <b>Finance Desk Officer<\/b> and <b>Warehouse<\/b> can close it short themselves\. The Supply Chain Officer and the CFO cannot\./.test(html));
ok('Guide: FOC sample tab', /Finance, the Finance Desk Officer, the CFO and the COO pick the <b>FOC sample<\/b> tab/.test(html));
ok('changelog 2026-11-04a and the build agree', /ver:'2026-11-04a', date:'2026-11-04', title:"The Finance Desk Officer does what Finance does"/.test(html) && ((/var BUILD_ID='([^']+)'/.exec(html) || [])[1] || '') >= '2026-11-04a');
ok('system documentation is rebuilt and carries D-367', ((/var SYSDOC_VER='([^']+)'/.exec(html) || [])[1] || '') >= '2026-11-04a' && /"id":"D-367"/.test(html));
report('Finance Desk Officer does what Finance does (11-04a, D-367)');
