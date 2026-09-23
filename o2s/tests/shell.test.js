/* THE QUEUE SHELL, LIVE — 2026-09-23s.
   Tahir, 23 Sep night: "it should look like a totally new universe when people
   land next time", "always choose the Queue Shell for queues", "Queue Shell
   everywhere", "a totally new kind of back office which is easy to move, assign
   a role, and clearly grant rights for each role at the time of assignment".
   Four words in the header: Today · Plant · Back Office · Guide. Plant is the
   Firefighter with 3 lights, not a list of dashboard tiles. Back Office is
   jobs. People is a list of people, not a matrix. Run: node shell.test.js */
const H = require('./harness.js');
const { ok, eq, report, grab, html } = H;

/* ================= 1. THE SHELL ================= */
ok('the Queue Shell stylesheet is in the file', /<style id="qs-shell">/.test(html));
ok('IBM Plex is loaded', /fonts\.googleapis\.com\/css2\?family=IBM\+Plex\+Mono/.test(html));
ok('the sidebar, the menu button and the search box never show', /\.side,\.navbackdrop,\.navtoggle,#densityBtn,\.livepill,\.helpbar,\.cmdk,#sidefoot,\.tbspace\{display:none!important\}/.test(html));
ok('the header carries the 4 words and the person', /<header class="qs-top" id="qsTop">/.test(html) && /<nav class="qs-nav" id="qsNav"/.test(html) && /<div id="qsMe">/.test(html) && /id="qsClock"/.test(html));
const nav = (() => { const m = /\nconst NAV_GROUPS=\[/.exec(html); return m ? H.matchBlock(m.index + 1, 'NAV_GROUPS', '[') : ''; })();
eq('exactly 4 groups', (nav.match(/label:'/g) || []).length, 4);
['Today', 'Plant', 'Back Office', 'Guide'].forEach(w => ok("the word '" + w + "' is in the header", new RegExp("label:'" + w + "'").test(nav)));
ok('the Dashboard is not a word in the header', !/'dash'/.test(nav));
ok('Report Center is gone from the header (its screens are links under Plant)', !/Report Center/.test(nav));
const rtn = grab('renderTopNav');
ok('renderTopNav fills the header from NAV_GROUPS', /NAV_GROUPS\.forEach/.test(rtn) && /canView\(state\.role,id\)/.test(rtn));
ok('the person pill shows name and TITLE, and explains role vs title', /personTitle\(/.test(rtn) && /decides your buttons/.test(rtn) && /what you are called/.test(rtn));
ok('the person pill has Sign out', /onclick="logout\(\)"/.test(rtn));
const rnd = grab('render');
ok('render() stamps the screen on <body> and fills the header', /setAttribute\('data-screen',state\.screen\)/.test(rnd) && /renderTopNav\(\)/.test(rnd));
ok('the old sidebar render no longer assumes #nav exists', /if\(\$\('nav'\)\) \$\('nav'\)\.innerHTML=html;/.test(grab('renderNav')));
ok('the top bar hides on the 4 main screens and People', /body\[data-screen="today"\] \.topbar,body\[data-screen="plant"\] \.topbar,body\[data-screen="backoffice"\] \.topbar,body\[data-screen="instructions"\] \.topbar,body\[data-screen="users"\] \.topbar\{display:none\}/.test(html));

/* ================= 2. TODAY IN THE QUEUE SHELL'S SHAPE ================= */
const st = grab('screenToday'), card = grab('tdCardHTML');
ok('3 tiles: waiting, past due, done today', /tdTallyHTML\(own\.length,lateOwn\)/.test(st) && /waiting<\/span>/.test(grab('tdTallyHTML')) && /past due/.test(grab('tdTallyHTML')) && /done today/.test(grab('tdTallyHTML')));
ok('"Waiting on you" with the count, like the artifact', /Waiting on you<span class="cnt">'\+own\.length\+'<\/span>/.test(st));
ok('a card is STAGE / title / line / chips', /<div class="tdstage">'\+stage\+'<\/div><div class="tdtitle">'\+ttl\+'<\/div>/.test(card));
ok('a production run says so on the card', /'Production run'/.test(card));
ok('the card colour follows lateness: late, warn, or on time', /' late':\(warn\?' warn':''\)/.test(card));
ok('done today is counted from the action log, per person', /e\.by===me/.test(grab('tdDoneCount')));

/* ================= 3. PLANT: 3 lights ================= */
const SCREENS = H.grabTopVar ? null : null;
ok("SCREENS has a screen with id 'plant', owned by every role", /\{id:'plant', name:'Plant'[^\n]*owners:\['KAM','Supply Chain','Production','Production Manager','Lab Rep','AQCM','QCM','QA Inspector','Plant Manager','CFO','COO','Supply Chain Officer','Finance Desk Officer','Finance','Warehouse'\]/.test(html));
ok('render() knows it', /plant:screenPlant/.test(rnd));
const pl = grab('screenPlant');
ok('exactly 3 lights, from the Firefighter lists', /k:'delayed',t:'Late orders'/.test(pl) && /k:'holds',t:'Trucks waiting'/.test(pl) && /k:'material',t:'Waiting on material'/.test(pl) && (pl.match(/\{k:'/g) || []).length === 3);
ok('the lights come from fireLists(), the same numbers the Firefighter had', /var F=fireLists\(\)/.test(pl));
ok('a light counts ORDERS, not lines', /m\[r\.po\]=1/.test(pl) && /Object\.keys\(m\)\.length/.test(pl));
ok('tap a light, get only that list', /plSel=plSel===/.test(pl) && /if\(sel && sel\.k==='delayed'\)/.test(pl));
ok('late orders are one row per ORDER, lines inside (R14)', /one row per ORDER/.test(pl) && /byPo\[r\.po\]/.test(pl));
ok('a row has the action, for people who may act', /plCanAct\(\)&&g\.act/.test(pl) && /plCanAct\(\)&&r\.act/.test(pl));
ok('the KAM reads, never acts (C9)', /state\.role!=='KAM'/.test(grab('plCanAct')));
ok('every department on one line: lead, jobs waiting, oldest, on late orders', /plDeptLines\(\)/.test(pl) && /jobs waiting/.test(pl) && /oldest job/.test(pl) && /on late orders/.test(pl));
ok('a department with no lead says so, in red', /no lead named/.test(pl));
ok('the floor is stage words per open order', /plFloor\(\)/.test(pl) && /lineBucket\(o,l\)/.test(grab('plFloor')));
ok('All orders and Reports are 2 links under Plant', /setScreen\(\\'tracker\\'\)/.test(pl) && /setScreen\(\\'reports\\'\)/.test(pl));
ok('no money on Plant', !/price|PKR|fmtRs|\bRs\b|invoice|budget/i.test(pl + grab('plDeptLines') + grab('plFloor')));
ok('the customer name on Plant is the short one, never the code', /plClient\(/.test(pl) && /_tdClient/.test(grab('plClient')));
eq('plDays: today', (() => { const f = new Function(grab('plDays') + ';return plDays;')(); return f(0); })(), 'today');
eq('plDays: 3 d', (() => { const f = new Function(grab('plDays') + ';return plDays;')(); return f(3); })(), '3 d');
eq('plTone: empty is ok', (() => { const f = new Function(grab('plTone') + ';return plTone;')(); return f([], 0); })(), 'st-ok');
eq('plTone: a week is over', (() => { const f = new Function(grab('plTone') + ';return plTone;')(); return f([1], 7); })(), 'st-over');
eq('plTone: less than a week is late', (() => { const f = new Function(grab('plTone') + ';return plTone;')(); return f([1], 2); })(), 'st-late');

/* ================= 4. BACK OFFICE: jobs ================= */
const bo = grab('screenBackOffice'), bj = grab('boJobs');
ok('Back Office renders jobs, not tiles', /boJobs\(\)/.test(bo) && /class="bo-job/.test(bo) && !/bo-tile/.test(bo));
['Approve a customer', 'Add a customer', 'attach a base to a brand', 'Set the budget for FY', 'Allocate to clients', 'Give someone access', 'Change what a role may do', 'Reference lists', 'Reconcile packing', 'Correct a record', 'Recipes and lab templates']
  .forEach(j => ok("job: " + j, bj.indexOf(j) > -1));
ok('a job carries its count', /pend\+' waiting'/.test(bj) && /chSet\+' of '\+BUDGET_CHANNELS\.length/.test(bj) && /unsettled\+' base to settle'/.test(bj));
ok('Reconcile reads reconCompute() (reconRows never existed)', /reconCompute\(\)/.test(bj) && !/reconRows/.test(bj));
ok('Approve a customer and the budget are CFO/COO jobs (R7, R8, R9)', /isFin=\(state\.role==='COO'\|\|state\.role==='CFO'\)/.test(bj));
ok('Correct a record stays COO-only', /ok:state\.role==='COO'&&canView\(state\.role,'datafix'\)/.test(bj));
ok('Add a customer opens the form itself', /custStartAdd\(\)/.test(bj));
ok("boOpen sets the admin tab and opens the card", /admTab=tab/.test(grab('boOpen')) && /acOpen\[card\]=true/.test(grab('boOpen')));

/* ================= 5. PEOPLE, NOT A MATRIX ================= */
const pp = grab('screenPeople'), pr = grab('ppRender'), ps = (() => { const i = html.indexOf('\nasync function ppSave('); return i < 0 ? '' : H.matchBlock(i + 1, 'ppSave'); })();
ok('the People screen replaces the Users & Access table', /function screenUsers\(\)\{ screenPeople\(\); loadUsers\(\); \}/.test(html) && /if\(state\.screen==='users'\) screenPeople\(\); \}/.test(html));
ok('people are listed by department, with role, login and title', /roleDeptId\(u\.role\)/.test(pp) && /personTitle\(u\.username,u\.role\)/.test(pp) && /login <span class="mono">/.test(pp));
ok('what a role can do is written as sentences from the LIVE rights', /RIGHTS_LIVE\[r\.code\]!==true\) return/.test(grab('roleSentences')) && /mayRole\(role,r\.code\)/.test(grab('roleSentences')));
ok('the screens a role can edit or read come from the same accessLevel the app uses', /accessLevel\(role,s\.id\)/.test(grab('roleScreens')));
ok('a move shows before -> after: gains and loses', /Before \\u2192 after|Before → after/.test(pr) && /roleDiffHTML\(ppEdit\.from,ppEdit\.role\)/.test(pr) && /Gains/.test(grab('roleDiffHTML')) && /Loses/.test(grab('roleDiffHTML')));
ok('the move needs confirming', /Confirm the move/.test(pr));
ok('the sheet also resets a password and renames', /Reset password/.test(pr) && /Rename/.test(pr) && /type="password"/.test(pr));
ok('every save is the same PUT Users & Access makes', /fetch\('\/api\/users\/'\+encodeURIComponent\(old\),\{method:'PUT'/.test(ps));
ok('nothing here deletes', !/DELETE/.test(ps + pp + pr));
ok('the password is sent only when the COO typed one, and only by that sheet', /if\(ppEdit\.mode==='password'\)\{ if\(!ppEdit\.password\)/.test(ps) && /body\.password=ppEdit\.password/.test(ps));
ok('only a person with Edit on People can change people', /screenEditOK\('users'\)/.test(grab('ppCan')) && /if\(!ppCan\(\)\)/.test(ps));
ok('a password reset is logged without the password', /logAction\('Password reset for '\+un\)/.test(ps) && !/logAction\([^)]*password\)/i.test(ps.replace("logAction('Password reset for '+un)", '')));
ok('the Roles view says: roles only, an exception becomes a new role', /an exception for one person becomes a new role/.test(pp));
ok('Add a person shows what the chosen role can do before the person exists', /roleSentencesHTML\(uForm\.role\)/.test(pp));
ok('Production Manager and Finance Desk Officer file into a department by id', /'production-manager':'production', 'finance-desk-officer':'finance'/.test(html));

/* ================= 6. GUIDE: roles and titles ================= */
const rt = grab('rolesTitlesCard');
ok('the Guide opens on Roles and titles', /\$\('view'\)\.innerHTML=`\s*\$\{rolesTitlesCard\(\)\}/.test(html));
ok('it says a role is not a job title, in the words Tahir asked for', /A role is not a job title\./.test(rt) && /roles are added and never renamed/.test(rt) && /Two people can hold one role and sign differently/.test(rt));
ok('it lists every role under its department with the people who hold it', /roleDeptId\(r\.name\)===d\.id/.test(rt) && /u\.role===r\.name/.test(rt) && /signs as/.test(rt));

/* ================= 7. BUILD ================= */
ok("BUILD_ID is 2026-09-23s", /var BUILD_ID='2026-09-23s'/.test(html));
ok('the changelog entry is last', /ver:'2026-09-23s'[\s\S]*\n\];\n<\/script>/.test(html) && !/ver:'2026-09-23s'[\s\S]*ver:'2026-09-23r'/.test(html));

report('The Queue Shell, live (23s)');
