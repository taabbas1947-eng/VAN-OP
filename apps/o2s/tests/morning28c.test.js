/* BUILD 2026-10-28c. Tahir, 28 Oct 2026, after the live test of 28b:
   1. + New entry has 2 tabs on top of the selected form: New order | FOC sample. The COO sees both (he may ask as well as approve).
      A person who may start only 1 goes straight to that form, no tabs. A half-typed sample form is kept until Cancel, Send or sign-out.
   2. The FOC samples link on Today shows for every role that may open the list, Back Office or not (1 click, not 2).
   3. Morning view: a shift is "running" only if it logged on 3 or more different days in the last 14.
   Run: node morning28c.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;
const body = html.split('\n').filter(l => !l.startsWith('/*SYSDOC_DATA_START*/')).join('\n');

/* ---- 3. which shifts count as running ---- */
{ const m = /var _sd=\{\};[^\n]*?MV_ACTIVE\[k\]=1; \}\);/.exec(body);
  ok('the running-shift rule is in the model', !!m);
  const run = (rows, day) => { const sb = { Object, M: { day, shifts: rows }, MV_ACTIVE: null, mvAdd: (d, n) => { const t = new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000); return t.toISOString().slice(0, 10); } };
    vm.createContext(sb); vm.runInContext(m[0].replace(/MV_ACTIVE=\{\};/, 'MV_ACTIVE={};'), sb); return Object.keys(sb.MV_ACTIVE).sort().join(); };
  const D = '2026-10-27';
  eq('Evening with 1 entry in 14 days is not running (the live case, 15 Oct)', run([{ d: '2026-10-15', shift: 'Evening' }, { d: '2026-10-26', shift: 'Morning' }, { d: '2026-10-25', shift: 'Morning' }, { d: '2026-10-24', shift: 'Morning' }], D), 'Morning');
  eq('a shift with entries on 3 different days is running', run([{ d: '2026-10-20', shift: 'Night' }, { d: '2026-10-22', shift: 'Night' }, { d: '2026-10-27', shift: 'Night' }], D), 'Night');
  eq('5 entries on the same single day is still not running', run([1, 2, 3, 4, 5].map(() => ({ d: '2026-10-26', shift: 'Evening' })), D), '');
  eq('2 different days is not enough', run([{ d: '2026-10-25', shift: 'Evening' }, { d: '2026-10-26', shift: 'Evening' }], D), '');
  eq('but a shift that logged on the day shown is counted, so "X of Y logged" never has X above Y (review fix)', run([{ d: '2026-10-27', shift: 'Evening' }, { d: '2026-10-20', shift: 'Morning' }], D), 'Evening');
  eq('an entry older than 14 days does not count', run([{ d: '2026-10-01', shift: 'Night' }, { d: '2026-10-02', shift: 'Night' }, { d: '2026-10-03', shift: 'Night' }], D), '');
  eq('the first day of the window (14 days back) counts', run([{ d: '2026-10-13', shift: 'Night' }, { d: '2026-10-14', shift: 'Night' }, { d: '2026-10-15', shift: 'Night' }], D), 'Night');
  const sn = { state: { masters: { shifts: ['Morning', 'Evening', 'Night'] } }, String, MV_ACTIVE: null }; vm.createContext(sn); vm.runInContext(grab('mvShiftNames'), sn);
  eq('before the model runs, all 3 shifts are asked about', sn.mvShiftNames().join(), 'Morning,Evening,Night');
  sn.MV_ACTIVE = { Morning: 1, Night: 1 }; eq('after it runs, only Morning and Night are chased', sn.mvShiftNames().join(), 'Morning,Night');
  sn.MV_ACTIVE = {}; eq('if no shift qualifies, all 3 are asked about (never an empty list)', sn.mvShiftNames().join(), 'Morning,Evening,Night'); }

/* ---- 1. the 2 tabs ---- */
const log = [];
const sb = { state: { role: 'COO', screen: 'today' }, log, _tdEsc: x => String(x), $: () => ({ classList: { add() { log.push(['open']); } } }), toast: m => log.push(['toast', m]), closeModal: () => log.push(['close']),
  setScreen: s => { log.push(['go', s]); sb.state.screen = s; }, smpNew: () => { log.push(['smpNew']); sb.smpForm = { fresh: 1 }; }, smpRenderForm: () => log.push(['render']), smpForm: null,
  canView: () => true, screenEditOK: () => true, may: () => true };
vm.createContext(sb);
vm.runInContext(['tdEntryChoices', 'tdNewEntryGo', 'tdNewEntry', 'tdEntryTabs', 'tdTab'].map(grab).join('\nvar TD_SMPKEEP=false;\n'), sb);
const both = () => { sb.canView = () => true; sb.screenEditOK = () => true; sb.may = () => true; };
both();
const t1 = sb.tdEntryTabs('order');
ok('2 tabs: New order and FOC sample', /New order/.test(t1) && /FOC sample/.test(t1) && (t1.match(/<button/g) || []).length === 2);
ok('the open tab is marked and has no click; the other one switches', /aria-selected="true" class="on">New order/.test(t1) && /tdTab\('foc'\)/.test(t1) && !/tdTab\('order'\)/.test(t1));
const t2 = sb.tdEntryTabs('foc'); ok('on the sample form the FOC tab is the open one', /aria-selected="true" class="on">FOC sample/.test(t2) && /tdTab\('order'\)/.test(t2));
sb.may = () => false; eq('a person who may start only the order sees no tabs', sb.tdEntryTabs('order'), '');
both(); sb.screenEditOK = () => false; eq('a person who may start only the sample sees no tabs', sb.tdEntryTabs('foc'), '');
both();
eq('the COO has both choices (28c)', sb.tdEntryChoices().map(c => c.k).join(), 'order,foc');
log.length = 0; sb.state = { role: 'COO', screen: 'today' }; sb.tdNewEntry(); eq('+ New entry with 2 choices opens New order, no choice window', JSON.stringify(log.filter(x => x[0] !== 'close')), JSON.stringify([['go', 'entry']]));
log.length = 0; sb.smpForm = null; sb.tdTab('foc'); eq('FOC tab with nothing kept opens a fresh sample form', JSON.stringify(log), JSON.stringify([['smpNew']]));
log.length = 0; sb.smpForm = { reqUser: 'typed' }; sb.state.screen = 'today'; sb.tdTab('order');
eq('order tab from the sample form: the window closes and the order screen opens', JSON.stringify(log), JSON.stringify([['close'], ['go', 'entry']]));
log.length = 0; sb.tdTab('foc'); eq('back to the FOC tab: the half-typed form is shown again, not wiped', JSON.stringify(log), JSON.stringify([['render'], ['open']]));
eq('...and the typed value is still there', sb.smpForm.reqUser, 'typed');
log.length = 0; sb.tdTab('foc'); eq('a stray click outside the window closes it, the form stays: the FOC tab brings it back again', JSON.stringify(log), JSON.stringify([['render'], ['open']]));
log.length = 0; sb.smpForm = { reqUser: 'old draft' }; sb.state = { role: 'COO', screen: 'today' }; sb.tdNewEntry(); sb.smpForm = null; log.length = 0; sb.tdTab('foc');
eq('Cancel, Send or a fresh + New entry leaves no form: the FOC tab starts a new one', JSON.stringify(log), JSON.stringify([['smpNew']]));
{ const sn = { smpForm: { reqUser: 'old draft' }, state: { role: 'COO' } }; sn.tdNewEntry2 = 0; vm.createContext(sn); vm.runInContext('var toast=function(){}; var tdEntryChoices=function(){ return [{k:"order"}]; }; var tdNewEntryGo=function(){};' + grab('tdNewEntry'), sn); sn.tdNewEntry();
  eq('+ New entry starts clean: an old half-typed sample is dropped', sn.smpForm, null); }
log.length = 0; sb.state.screen = 'entry'; sb.smpForm = { reqUser: 'x' }; sb.tdTab('order'); eq('order tab while already on the order screen only closes the window', JSON.stringify(log), JSON.stringify([['close']]));
log.length = 0; sb.may = () => false; sb.state = { role: 'Warehouse', screen: 'today' }; sb.canView = () => false; sb.tdNewEntry(); ok('a role with nothing to start gets a plain message', log.length === 1 && log[0][0] === 'toast');
both();

/* the tabs are drawn on both forms */
ok('the order screen draws the tabs above its form', /<\/style>\s*\$\{tdEntryTabs\('order'\)\}/.test(grab('screenEntry')));
ok('the sample form draws the tabs above its first section', /<div class="mb">'\s*\+tdEntryTabs\('foc'\)/.test(grab('smpRenderForm')));
ok('signing out or in drops a half-typed sample (it must not show to the next person on the same PC)', /setSession\(''/.test(grab('logout')) && /smpForm=null/.test(grab('setSession')));
ok('Cancel on the sample form drops the draft', /onclick="smpForm=null;closeModal\(\)">Cancel/.test(grab('smpRenderForm')));
ok('sending a sample keeps what was typed on the order screen under it (priority, dates, PO number, KAM)', /_ek=\(state\.screen==='entry'\)\?entrySnap\(\):null/.test(grab('smpSubmit')) && /render\(\); if\(_ek\) entryRestore\(_ek\)/.test(grab('smpSubmit')));
ok('the tab labels stay readable on hover on the order page', /\.tdtabs button\{color:var\(--ink\)\} \.tdtabs button:hover:not\(\.on\)\{background:var\(--surface-2\);color:var\(--ink\)\}/.test(html));
ok('the order screen points to the tab when the person has it, to the samples page when not', /\$\{tdEntryTabs\('order'\)\?'A free sample is not an order: use the FOC sample tab above\.':'A free sample is not an order: <a href="javascript:void\(0\)" onclick="setScreen\(\\'samples\\'\)">ask for it on the FOC samples page<\/a>\.'\}/.test(body));
ok('the Back Office FOC samples tile offers Ask to the COO as well, like the samples page and + New entry', /may\('sample\.request'\)\?\{l:'Ask for a free sample',go:'smpNew\(\)'\}:null/.test(grab('boDesks')));
ok('the tabs reuse the existing segmented control look, no new global CSS', /class="tdscope tdtabs"/.test(grab('tdEntryTabs')) && !/\.tdtabs\s*\{/.test(body));
ok('no new right was created: the sample tab is offered only to whoever already holds sample.request', /may\('sample\.request'\)/.test(grab('tdEntryChoices')) && !/sample\.request.*=.*true/.test(grab('tdEntryChoices')));

/* ---- 2. the link ---- */
const ts = grab('tdStarts');
ok('the FOC samples link on Today shows for every role that may open the list', /if\(smpListOK\(\)\) b\.push\(\['samples'/.test(ts) && !/boVisible/.test(ts));
{ const s2 = { state: { role: 'Supply Chain' }, _tdEsc: x => String(x), canView: () => true, may: () => false, smpListOK: () => true, boVisible: () => true, tdEntryChoices: () => [] }; vm.createContext(s2); vm.runInContext(ts, s2);
  ok('Supply Chain (has Back Office) now has the link on Today', /FOC samples/.test(s2.tdStarts()));
  s2.state.role = 'COO'; ok('so does the COO', /FOC samples/.test(s2.tdStarts()));
  s2.smpListOK = () => false; ok('nobody sees the link if the samples screen is switched off for the role', !/FOC samples/.test(s2.tdStarts())); }
ok('Back Office keeps its FOC samples tile', /D\.push\(\{k:'samples',t:'FOC samples'/.test(grab('boDesks')));

/* ---- digits, not words, in the Morning view text (found by shell.test.js, which had been failing since 28b) ---- */
{ const a = body.indexOf('/* ===================== MORNING VIEW'), z = body.indexOf('/* ===================== PLANT - the 3 lights'); const mod = body.slice(a, z);
  ok('no "Seven people", "seven people", "two days or more" or "one page for each" left in the Morning view', !/\b[Ss]even people|two days or more|one page for each/.test(mod) && !/<div class="gd-intro">Seven/.test(body)); }

/* ---- build and notes ---- */
ok('the build is 2026-10-28c or later', /var BUILD_ID='2026-10-(28[c-z]|29[a-z]?|3\d[a-z]?)'|var BUILD_ID='2026-1[12]/.test(html));
ok('the system documentation version follows the build', ((/var SYSDOC_VER='([^']+)'/.exec(html) || [])[1] || '') >= '2026-10-28c' && /var SYSDOC_VER='([^']+)'/.exec(html)[1] === /var BUILD_ID='([^']+)'/.exec(html)[1]);   // 30 Oct: any later build, equal to BUILD_ID   /* 28d, 29a: the version moves with every build of the day */
ok('the change log has the 28c entry', /ver:'2026-10-28c'[^\n]*New entry has 2 tabs/.test(html));
ok('the Guide says who sees the tab: Finance, the CFO and the COO; the KAM goes straight to the form', /the KAM goes straight to the sample form; Finance, the CFO and the COO pick the <b>FOC sample<\/b> tab beside <b>New order<\/b>/.test(grab('guideRules')));
process.exitCode = report('28c: New entry tabs, samples link, running shifts') ? 1 : 0;
