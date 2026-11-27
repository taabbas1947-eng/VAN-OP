/* BUILD 2026-11-27f. Your people as a compact grid, late work first (D-386).
   Tahir ruled on 27 Nov 2026 (design page "O2S Your people, phase E1"): opens on Needs attention (red and amber),
   All one tap away; red, amber, green, the oldest job first; the card keeps name, title, jobs waiting and oldest job;
   % current, done today and the shared names move to the tapped list; 2 to a row on a phone. Counts unchanged.
   Run: node yp1127f.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;

function box(people, jobs, stored) {
  const c = { console, Math, String, Date, JSON, Object, Array, isNaN };
  vm.createContext(c);
  const store = { o2s_yp_mode: stored };
  c.localStorage = { getItem: k => (store[k] === undefined ? null : store[k]), setItem: (k, v) => { store[k] = v; } };
  c.__store = store; c.__renders = 0;
  vm.runInContext(['qsEsc', 'ppCurrent', 'ypInfo', 'ypMode', 'ypSetMode', 'ypTodayLog', 'tdYourPeople'].map(grab).join('\n')
    + '\nvar _ypMode=null;', c);
  c.state = { role: 'COO', currentUser: { username: 'tahir' }, actionLog: [] };
  c.TODAY = new Date('2026-11-27T10:00:00Z');
  c.TD_LEADS = {};
  c.usersList = people;
  c.roleDeptId = () => 'd1';
  c.actionItems = () => jobs.map(j => Object.assign({}, j));
  c.acDeferActive = () => false;
  c.actTiming = it => ({ days: it.d });
  c.localDateOf = t => String(t).slice(0, 10);
  c.evAllStamps = () => [];
  c.ypJobsFor = (u, all) => all.filter(it => it.who === u.username);
  c.tdGroups = items => items.map(it => ({ days: it.d, items: [it] }));
  c.jobSharers = () => [{}];
  c.itemWaiting = it => !!it.wait;
  c.personTitle = (un, role) => role;
  c.render = () => { c.__renders++; };
  return c;
}
const people = [
  { username: 'a', name: 'Abdullah Naveed', role: 'QC Analyst' },
  { username: 'b', name: 'Abdul Basit', role: 'Finance' },
  { username: 'r', name: 'Ali Raza', role: 'Production' },
  { username: 's', name: 'Saad Jamal', role: 'Supply Chain' },
  { username: 'h', name: 'Himayat Hussain', role: 'QCM' },
  { username: 'w', name: 'Zain Ghaffar', role: 'Warehouse' }
];
const jobs = [
  { who: 'a', d: 6 }, { who: 'a', d: 2 },
  { who: 'r', d: 149 }, { who: 'r', d: 3 },
  { who: 's', d: 121 },
  { who: 'h', d: 3 },
  { who: 'w', d: 0, wait: true }
];
const names = h => (h.match(/<span class="nm">([^<]+)<\/span>/g) || []).map(x => x.replace(/<[^>]+>/g, ''));

let c = box(people, jobs);
let h = c.tdYourPeople();
eq('opens on Needs attention: red first, then amber, the oldest job first', names(h).join(' | '), 'Ali Raza | Saad Jamal | Abdullah Naveed | Himayat Hussain');
ok('green people (no job 1 day or more) are left out of Needs attention', !/Abdul Basit|Zain Ghaffar/.test(names(h).join(' ')));
ok('the chips carry the counts: Needs attention 4, All 6', /Needs attention <span class="c">4<\/span>/.test(h) && /All <span class="c">6<\/span>/.test(h));
ok('Needs attention is pressed', /class="qs-btn sm on" aria-pressed="true" onclick="ypSetMode\('att'\)"/.test(h));
ok('the section head still counts everyone', /Your people<span class="cnt">6<\/span>/.test(h));
ok('cards are in a grid', /<div class="yp-grid">/.test(h));
ok('red card: 2 waiting, 149 d, red bar', /class="person yp yp-red"[^>]*>(?:(?!<\/button>).)*Ali Raza(?:(?!<\/button>).)*<span>2 waiting<\/span><span class="d">149 d<\/span>/.test(h));
ok('amber card: Himayat, 1 waiting, 3 d', /class="person yp yp-amber"[^>]*>(?:(?!<\/button>).)*Himayat Hussain(?:(?!<\/button>).)*<span>1 waiting<\/span><span class="d">3 d<\/span>/.test(h));
ok('the card no longer carries % current, done today or shared names', !/% current|done today|shared with/.test(h.replace(/<div class="dept-num[\s\S]*?This is the department’s one number\.<\/div>(<div class="bar">[\s\S]*?<\/div>)?<\/div>/, '')));
ok('tapping a card opens the same list as before', /onclick="openPersonList\('Production','Ali Raza'\)"/.test(h));

c.ypSetMode('all');
eq('All is remembered on the device, not saved', c.__store.o2s_yp_mode, 'all');
ok('All redraws the page', c.__renders === 1);
h = c.tdYourPeople();
eq('All: red, amber, then green by name', names(h).join(' | '), 'Ali Raza | Saad Jamal | Abdullah Naveed | Himayat Hussain | Abdul Basit | Zain Ghaffar');
ok('green card with nothing waiting says none', /Abdul Basit(?:(?!<\/button>).)*<span>0 waiting<\/span><span class="d">none<\/span>/.test(h));
ok('a job waiting for the client still says on hold', /Zain Ghaffar(?:(?!<\/button>).)*<span>1 waiting<\/span><span class="d">on hold<\/span>/.test(h));

c = box(people, jobs, 'all');
ok('a stored All opens on All', /class="qs-btn sm on" aria-pressed="true" onclick="ypSetMode\('all'\)"/.test(c.tdYourPeople()));
c = box(people, jobs, 'junk');
ok('anything else stored opens on Needs attention', /aria-pressed="true" onclick="ypSetMode\('att'\)"/.test(c.tdYourPeople()));
c = box(people, [{ who: 'w', d: 0, wait: true }]);
ok('nobody late: a plain line, and All is still there', /Nobody has a job waiting 1 day or more\. Tap All to see everyone\./.test(c.tdYourPeople()) && /All <span class="c">6<\/span>/.test(c.tdYourPeople()));
c = box(people, jobs); c.localStorage.getItem = () => { throw new Error('blocked'); }; c.localStorage.setItem = () => { throw new Error('blocked'); };
ok('a browser that blocks storage still works', /Needs attention/.test(c.tdYourPeople()) && (c.ypSetMode('all'), c.__renders === 1));

/* names are escaped */
c = box([{ username: 'x', name: '<img src=x onerror=1>', role: 'QC' }], [{ who: 'x', d: 9 }]);
ok('names are escaped', !/<img src=x/.test(c.tdYourPeople()));

/* the tapped list carries what left the card */
const op = grab('openPersonList');
ok('the tapped list shows % current, done today and shared names', /ypInfo\(\{role:role,username:_pu,name:name\},all,ypTodayLog\(\),evAllStamps\(\)\)/.test(op) && /% current/.test(op) && /done today/.test(op) && /shared with/.test(op));
ok('the colour rule is unchanged: amber 1 to 6 days, red from 7', /var tone=gs\.length\?\(worst>=7\?'st-over':\(worst>=1\?'st-late':'st-ok'\)\):'st-ok';/.test(grab('ypInfo')));
/* 2026-11-27f review fixes */
ok('the tapped list hides complaint jobs from the same people as the card count', /actionItems\(\)\.filter\(function\(it\)\{ return !acDeferActive\(it\)&&!\(it\.cm&&state\.role!=='COO'&&state\.role!=='Plant Manager'\); \}\)\); all\.forEach\(function\(it,i\)\{ it\._id='PL'/.test(op));
ok('% current keeps its colour: green 90+, amber 70+, red below', /var _pc=cur\.pct==null\?'':\(cur\.pct>=90\?'st-ok':\(cur\.pct>=70\?'st-late':'st-over'\)\);/.test(op) && /\.yp-facts \.st-ok,\.yp-facts \.st-late,\.yp-facts \.st-over\{color:var\(--st\);font-weight:600\}/.test(html));
ok('the 2 chips are 40 px tall for a thumb', /\.yp-chips \.qs-btn\{min-height:40px\}/.test(html));
ok('nothing is saved', !/save\(\)/.test(grab('tdYourPeople') + grab('ypInfo') + grab('ypSetMode') + grab('ypMode') + op));
ok('3 to a row; 2 under 600 px', /\.yp-grid\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\);gap:6px\}/.test(html) && /@media \(max-width:599\.98px\)\{\.yp-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}\}/.test(html));

/* Guide, build, docs */
ok('the Guide explains Your people', /<h2>Your people<\/h2><div class="gd-intro">If you lead a department/.test(grab('guideHow')));
ok('the Shared jobs rule points to the tapped list', /shared jobs are named in the list a tap on the person opens, never counted twice\./.test(html));
ok('BUILD_ID 2026-11-27f or later', /var BUILD_ID='2026-(11-(27[f-z]|2[89][a-z]|30[a-z])|12-\d\d[a-z])';/.test(html));
ok('changelog has 2026-11-27f', /ver:'2026-11-27f'/.test(html));
ok('system documentation carries D-386', /"id":"D-386"/.test(html));

report('yp1127f');
