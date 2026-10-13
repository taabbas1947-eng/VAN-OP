/* REVIEW TRUCK ON EVERY LIST (13 Oct 2026, build 2026-10-13g).
   A job addressed to Supply Chain and also to Warehouse (alsoRoles) must show for both on All actions,
   the side-menu count, Your people and the person card, not only on Today. The person who loaded the truck
   or passed it out never sees it. Run: node trucklists.test.js */
const H = require('./harness.js');
const { ok, eq, report, grab, html } = H;

const helpers = ['itOwnedBy', 'itBarred', 'itMine'].map(grab).join('\n');
const mk = (role, user) => new Function('state', helpers + '\nreturn {own:itOwnedBy,barred:itBarred,mine:itMine};')({ role, currentUser: { username: user } });
const rv = { label: 'Review truck', role: 'Supply Chain', alsoRoles: ['Supply Chain', 'Warehouse'], notWho: ['saad'] };
const load = { label: 'Load', role: 'Warehouse' };

{ const saad = mk('Supply Chain', 'saad'), shoaib = mk('Warehouse', 'shoaib'), zain = mk('Supply Chain Officer', 'zain'), coo = mk('COO', 'tahir');
  ok('Shoaib (Warehouse) owns the Review truck job', shoaib.mine(rv));
  ok('Saad made the truck: it is not on Saad\'s list', !saad.mine(rv));
  ok('a different Supply Chain login still sees it', mk('Supply Chain', 'other').mine(rv));
  ok('Zain (Supply Chain Officer) never sees it', !zain.mine(rv));
  ok('the COO is not barred', !coo.barred(rv, 'saad', 'COO'));
  ok('a job with no alsoRoles stays with its own role', mk('Warehouse', 'shoaib').mine(load) && !mk('Supply Chain', 'saad').mine(load));
  ok('no notWho means nobody is barred', !shoaib.barred({ label: 'Load', role: 'Warehouse' }, 'shoaib', 'Warehouse')); }

/* the screens use the helpers */
const ab = grab('acBase');
ok('All actions: own list uses itMine', /var own=all\.filter\(itMine\)/.test(ab));
ok('All actions: a job already yours is not also "escalated" to you', /if\(itOwnedBy\(x,role\)\) return false/.test(ab));
ok('side-menu count uses itMine', /items\.filter\(itMine\)/.test(grab('navBadge')));
ok('the dashboard to-do list uses itMine', /all\.filter\(itMine\)/.test(grab('dashMyTodos')));
ok('My job card lists use itOwnedBy', /itOwnedBy\(it,role\) && it\.label/.test(grab('tdRoleJobs')));
const op = grab('openPersonList');
ok('the person card lists the shared job and hides it from whoever made the truck', /itOwnedBy\(it,role\) && !itBarred\(it,_pu,role\)/.test(op) && /u\.name===name/.test(op));
const yp = grab('tdYourPeople');
ok('Your people counts a shared job for every role it is addressed to, once each', /\[it\.role\]\.concat\(it\.alsoRoles\|\|\[\]\)\.filter\(function\(r,i,a\)\{ return r && a\.indexOf\(r\)===i; \}\)/.test(yp));
ok('Your people hides it from the person who made the truck', /!itBarred\(it,u\.username,u\.role\)/.test(yp));
ok('Today is unchanged (still tdVisible with notWho)', /x\.notWho&&_me&&x\.notWho\.indexOf\(_me\)>-1&&role!=='COO'/.test(grab('tdItems')));
ok('the 13g changelog entry exists', /ver:'2026-10-13g'/.test(html));
report();
