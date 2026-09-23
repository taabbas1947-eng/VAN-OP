/* TODAY — the new front door. 23 September 2026.

   Tahir: "the old app design, structures and user interface, tabs switching and
   easiness and adoption is failed. we are making a new effort." And then, after
   two prototypes on the live data: "we should work on real live."

   What the live data said, measured on the deployed build that afternoon:
   actionItems() was raising 104 obligations, one per order LINE. 54 of them were
   'Open Production' and 9 of those were the same run of Sulfur 70%; 13 'Receive'
   rows were 3 trips to the same bay; the Plant Manager's 18 rows were 7 orders'
   worth of one question. And 11 of the 21 people had nothing at all, because
   acBase() matches an item to a person by ROLE NAME ONLY - so a Warehouse
   Assistant with every dispatch right granted still saw an empty list.

   Today is one screen. It is the landing screen for everyone. It shows the jobs
   waiting on the signed-in person, grouped the way the plant does them, in plain
   words, one button each - and that button is the app's OWN action for the item,
   so pressing it saves exactly as it always has. Nothing in the machinery moves.

   What Today reads:  actionItems()  acDeferActive()  acEscalation()  mayRole()
                      state.actionLog (for "done today")
   What Today changes: nothing. It raises no item of its own and writes no state.

   Run: node today.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, grabTopVar, html } = H;

const ROLES15 = ['KAM','Supply Chain','Production','Production Manager','Lab Rep','AQCM','QCM',
  'QA Inspector','Plant Manager','CFO','COO','Supply Chain Officer','Finance Desk Officer','Finance','Warehouse'];

/* ================= 1. THE SCREEN EXISTS AND EVERYONE OWNS IT ================= */
let SCREENS = null;
{
  /* SCREENS is a top-level const; grabTopVar only knows var. Match it directly. */
  const m = /\nconst SCREENS=\[/.exec(html);
  if (m) {
    const src = H.matchBlock(m.index + '\nconst SCREENS='.length, 'SCREENS', '[');
    const box = { console }; vm.createContext(box);
    vm.runInContext('var SCREENS=' + src, box); SCREENS = box.SCREENS;
  }
}
ok('SCREENS could be read', Array.isArray(SCREENS));
const today = (SCREENS || []).find(s => s.id === 'today');
ok("SCREENS has a screen with id 'today'", !!today);
eq("its name is 'Today'", today && today.name, 'Today');
ROLES15.forEach(r => ok('Today is owned by ' + r, !!today && today.owners.includes(r)));
eq('Today is the FIRST screen in SCREENS', SCREENS && SCREENS[0] && SCREENS[0].id, 'today');

/* ================= 2. IT IS WHERE EVERYONE LANDS ================= */
const nav = /\nconst NAV_GROUPS=\[/.exec(html);
const navSrc = nav ? H.matchBlock(nav.index + 1, 'NAV_GROUPS', '[') : '';
ok("NAV_GROUPS lists 'today' first in the Work group", /label:'Work',\s*ids:\['today'/.test(navSrc), navSrc.slice(0, 80));
/* doLogin is `async function`; grab() only knows plain `function name(`. */
const login = (() => { const i = html.indexOf('\nasync function doLogin('); return i < 0 ? '' : H.matchBlock(i + 1, 'doLogin'); })();
ok("doLogin lands on 'today'", /state\.screen=canView\(state\.role,'today'\)\?'today'/.test(login));
ok("doLogin no longer lands on 'approvals'", !/state\.screen=canView\(state\.role,'approvals'\)\?'approvals'/.test(login));
const render = grab('render');
ok("render() falls back to 'today', not 'dash'", /state\.screen='today'/.test(render) && !/state\.screen='dash'/.test(render));
ok('render() dispatches today:screenToday', /today:screenToday/.test(render));
ok('navBadge counts Today as well as My Actions', /function navBadge\(id\)\{ if\(id!=='approvals'&&id!=='today'\)/.test(html));

/* ================= 3. PLAIN WORDS FOR EVERY LABEL THE APP RAISES ================= */
const ai = grab('actionItems');
const labels = new Set();
ai.replace(/label:'([^']+)'/g, (_, l) => { labels.add(l); return _; });
ai.replace(/label:\(_re\?'([^']+)':'([^']+)'\)/g, (_, a, b) => { labels.add(a); labels.add(b); return _; });
ok('actionItems raises at least 18 distinct labels', labels.size >= 18, [...labels].join(','));
let TD_LABEL = null, TD_RIGHT = null;
try {
  const box = { console }; vm.createContext(box);
  vm.runInContext(grabTopVar('TD_LABEL', '{') + grabTopVar('TD_RIGHT', '{'), box);
  TD_LABEL = box.TD_LABEL; TD_RIGHT = box.TD_RIGHT;
} catch (e) {}
ok('TD_LABEL exists', !!TD_LABEL);
ok('TD_RIGHT exists', !!TD_RIGHT);
labels.forEach(l => {
  const t = TD_LABEL && TD_LABEL[l];
  ok("TD_LABEL has a title and a verb for '" + l + "'", !!t && !!t.title && !!t.verb);
  ok("TD_LABEL['" + l + "'] never says price", !t || !/price/i.test(t.title + ' ' + t.verb), t && (t.title + ' / ' + t.verb));
  ok("TD_LABEL['" + l + "'] spells no number in words", !t || !/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(t.title + ' ' + t.verb), t && t.title);
});

/* ================= 4. THE RIGHT MAP POINTS AT REAL RIGHTS ================= */
let RIGHTS = null;
try { const box = { console }; vm.createContext(box); vm.runInContext(grabTopVar('RIGHTS', '['), box); RIGHTS = box.RIGHTS; } catch (e) {}
const codes = new Set((RIGHTS || []).map(r => r.code));
Object.keys(TD_RIGHT || {}).forEach(l => {
  ok("TD_RIGHT['" + l + "'] = " + TD_RIGHT[l] + ' is a real right code', codes.has(TD_RIGHT[l]));
  ok("TD_RIGHT['" + l + "'] is a label actionItems raises", labels.has(l));
});
[['Ship','shipment.plan'],['Load','shipment.load'],['Gate Pass','gatepass.issue'],['Confirm delivery','delivery.confirm'],
 ['Receive','rm.receive'],['RM Check','rm.check'],['Acknowledge','order.acknowledge'],['Print price','order.print_decision'],
 ['Open Production','production.enter']]
 .forEach(([l, c]) => eq("TD_RIGHT['" + l + "']", TD_RIGHT && TD_RIGHT[l], c));
/* The six codes that were never added to RIGHTS cannot be granted, so the labels
   behind them stay role-decided. If a code is added later, this is the line to
   move. */
['Pack QC','Inspect','Lab QC','Review','Approve','Release','Approve DC','Add reason','Approve PR','Correct','Re-inspect']
 .forEach(l => ok("TD_RIGHT leaves '" + l + "' to the role", !TD_RIGHT || !(l in TD_RIGHT)));

/* ================= 5. WHO SEES WHAT — tdVisible ================= */
function vis(role, grants) {
  const box = {
    console, state: { role },
    mayRole: (r, code) => r === 'COO' || !!(grants && grants[r] && grants[r].includes(code)),
  };
  vm.createContext(box);
  vm.runInContext(grabTopVar('TD_RIGHT', '{') + '\n' + grab('tdVisible'), box);
  return (it) => box.tdVisible(it, role);
}
const ship = { role: 'Supply Chain', label: 'Ship' };
const reason = { role: 'Plant Manager', label: 'Add reason' };
const escd = { role: 'Supply Chain', label: 'Ship', _escalated: true };
eq('own role always sees its item', vis('Supply Chain')(ship), true);
eq('COO sees everything', vis('COO')(reason), true);
eq('an item escalated to you is visible', vis('Plant Manager')(escd), true);
eq('Warehouse WITHOUT shipment.plan does not see Ship', vis('Warehouse', {})(ship), false);
eq('Warehouse WITH shipment.plan sees Ship (this is the fix)', vis('Warehouse', { Warehouse: ['shipment.plan'] })(ship), true);
eq('Supply Chain Officer with rm.receive sees Receive', vis('Supply Chain Officer', { 'Supply Chain Officer': ['rm.receive'] })({ role: 'Supply Chain', label: 'Receive' }), true);
eq('a label with no right code stays role-only (Add reason, Lab Rep)', vis('Lab Rep', { 'Lab Rep': ['coa.draft'] })(reason), false);
eq("'Review' (COA) and 'Review' (short close) share a label: role decides, not the code", vis('AQCM', { AQCM: ['coa.review'] })({ role: 'Plant Manager', label: 'Review', l: { shortClose: {} } }), false);

/* ================= 6. GROUPING — the way the plant does the work ================= */
{
  const box = { console, fmt: n => String(n) }; vm.createContext(box);
  vm.runInContext(grab('tdGroups'), box);
  const o1 = { id: 'o1', po: 'P1', promised: '2026-08-01' }, o2 = { id: 'o2', po: 'P2', promised: '2026-09-01' };
  const items = [
    { role: 'Production', label: 'Open Production', o: o1, l: { brand: 'Max Sulfur', ordered: 5000, produced: 0 }, _days: 3 },
    { role: 'Production', label: 'Open Production', o: o2, l: { brand: 'Max Sulfur', ordered: 1000, produced: 200 }, _days: 1 },
    { role: 'Production', label: 'Open Production', o: o2, l: { brand: 'Crop Star', ordered: 100, produced: 0 }, _days: 1 },
    { role: 'Supply Chain', label: 'Receive', o: o1, l: { brand: 'A' }, _days: 2 },
    { role: 'Supply Chain', label: 'Receive', o: o1, l: { brand: 'B' }, _days: 2 },
    { role: 'Plant Manager', label: 'Add reason', o: o2, l: { brand: 'A' }, _days: 9 },
    { role: 'Plant Manager', label: 'Add reason', o: o2, l: { brand: 'B' }, _days: 9 },
    { role: 'Supply Chain', label: 'Ship', o: o1, shipLines: [], _days: 4 },
  ];
  const g = box.tdGroups(items);
  eq('8 items become 5 jobs', g.length, 5);
  eq('every item is in exactly one job', g.reduce((s, x) => s + x.items.length, 0), items.length);
  const ms = g.find(x => x.key === 'prod:Max Sulfur');
  ok('Open Production groups by product', !!ms && ms.items.length === 2);
  eq('and sums what is still to make across orders', ms && ms.qty, 5800);
  const rc = g.find(x => x.key === 'rcv:o1');
  ok('Receive groups by PO — one trip to the bay', !!rc && rc.items.length === 2);
  const rs = g.find(x => x.key === 'rsn:o2');
  ok('Add reason groups by PO — one reason for the order', !!rs && rs.items.length === 2);
  ok('Ship stays one job per truck', g.some(x => x.label === 'Ship' && x.items.length === 1));
}

/* ================= 7. THE SCREEN ITSELF ================= */
const st = grab('screenToday');
ok('screenToday reads the live obligations', /tdItems\(\)/.test(st));
ok("screenToday explains itself once and can be dismissed", /dismissHint\(\\?'today\\?'\)/.test(st) && /hintHidden\('today'\)/.test(st));
ok('a job with several lines opens in place (details), not on another screen', /<details/.test(st + grab('tdCardHTML')));
ok('the button on a job is the app\'s own action for the item', /onclick="'\+one\.act\+'"/.test(grab('tdCardHTML')) && /onclick="'\+it\.act\+'"/.test(grab('tdRowHTML')));
ok('done today comes from the action log', /state\.actionLog/.test(grab('tdDoneToday')) && /tdDoneToday\(\)/.test(st));
ok('an empty queue is not a blank screen', /Nothing waiting on you/.test(st) && /tdPlantPulse/.test(st));
ok('no price is ever rendered on Today', !/price/i.test(st + grab('tdCardHTML') + grab('tdRowHTML') + grab('tdPlantPulse') + grab('tdDoneToday')));
ok('Today has its own stylesheet', /<style id="td-css">/.test(html));

/* ================= 8. IT SHIPS ================= */
ok("BUILD_ID is 2026-09-23j", /BUILD_ID\s*=\s*'2026-09-23j'/.test(html));
ok('the changelog tells people about Today', /ver:'2026-09-23j'[\s\S]{0,400}Today/.test(html));

process.exitCode = report('Today — the new front door') ? 1 : 0;
