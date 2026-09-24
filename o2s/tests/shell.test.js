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
ok('the top bar hides on the 4 main screens, People and Orders', /body\[data-screen="today"\] \.topbar,body\[data-screen="plant"\] \.topbar,body\[data-screen="backoffice"\] \.topbar,body\[data-screen="instructions"\] \.topbar,body\[data-screen="users"\] \.topbar,body\[data-screen="tracker"\] \.topbar\{display:none\}/.test(html));

/* ================= 2. TODAY IN THE QUEUE SHELL'S SHAPE ================= */
const st = grab('screenToday'), card = grab('tdCardHTML');
ok('3 tiles: waiting, past due, done today', /tdTallyHTML\(own\.length,lateOwn\)/.test(st) && /waiting<\/span>/.test(grab('tdTallyHTML')) && /past due/.test(grab('tdTallyHTML')) && /done today/.test(grab('tdTallyHTML')));
ok('"Waiting on you" with the count, like the artifact; "Open in the plant" for the COO\'s whole-plant view (23u)', /'Open in the plant':'Waiting on you'\)\+'<span class="cnt">'\+own\.length\+'<\/span>/.test(st));
ok('a card is STAGE / title / line / chips', /<div class="tdstage">'\+stage\+'<\/div><div class="tdtitle">'\+ttl\+'<\/div>/.test(card));
ok('a production run says so on the card', /'Production run'/.test(card));
ok('the card colour is the JOB clock: red after a day, amber today (23u)', /g\.days>0\?' late':' warn'/.test(card));
/* 23u: what the outside UX review changed */
const tags = grab('tdTags');
ok('the main chip is the job\'s own age, not the customer\'s promise', /waiting '\+g\.days\+' d/.test(tags) && /new today/.test(tags) && /d past promise/.test(tags) && !/days past promise/.test(tags));
ok('the list is oldest JOB first', /\(b\.days-a\.days\)\|\|\(b\.late-a\.late\)/.test(grab('tdGroups')));
ok('escalations are one card per role, with their list inside', /tdEscByRoleHTML\(esc\)/.test(st) && /See their list/.test(grab('tdEscByRoleHTML')) && /roleTitle\(r\)/.test(grab('tdEscByRoleHTML')));
ok('the COO starts orders only', /state\.role==='COO'\) b=b\.filter\(function\(x\)\{ return x\[0\]==='entry'; \}\)/.test(grab('tdStarts')));
ok('a late-reason card is titled by the order, not by its own label', /var ttl=\(g\.key\.indexOf\('prod:'\)===0\)\?title:sub/.test(card));
ok('the empty state does not lecture', !/honest answer/.test(st));
ok('the phone does not repeat the name under the header', /@media \(max-width:820px\)\{\.tdwho\{display:none\}\}/.test(html));
ok('done today is counted from the action log, per person', /e\.by===me/.test(grab('tdDoneCount')));

/* ================= 3. PLANT: 3 lights ================= */
const SCREENS = H.grabTopVar ? null : null;
ok("SCREENS has a screen with id 'plant', owned by every role", /\{id:'plant', name:'Plant'[^\n]*owners:\['KAM','Supply Chain','Production','Production Manager','Lab Rep','AQCM','QCM','QA Inspector','Plant Manager','CFO','COO','Supply Chain Officer','Finance Desk Officer','Finance','Warehouse'\]/.test(html));
ok('render() knows it', /plant:screenPlant/.test(rnd));
const pl = grab('screenPlant');
ok('exactly 4 lights: 3 from the Firefighter lists, the 4th stuck batches (24b)', /k:'delayed',t:'Late orders'/.test(pl) && /k:'holds',t:'Trucks waiting'/.test(pl) && /k:'material',t:'Waiting on material'/.test(pl) && /k:'stuck',t:'Stuck batches'/.test(pl) && (pl.match(/\{k:'/g) || []).length === 4);
{
  const sb = grab('plStuckBatches');
  ok('a stuck batch is open with no output for 3 days, or made its plan and sat open 2 days', /PL_STUCK_NO_OUTPUT_DAYS=3, PL_STUCK_MADE_OPEN_DAYS=2/.test(html) && /no output for /.test(sb) && /made its plan, still open/.test(sb));
  ok('last move = the latest shift entry on the batch, else the day it opened', /state\.shiftEntries/.test(grab('plBatchLastMove')) && /b\.openedDate\|\|b\.date/.test(grab('plBatchLastMove')));
  ok('a row opens the run sheet for a PO batch, else the close or the shift log', /openRun\('/.test(sb) && /openCloseBatch\('/.test(sb) && /openShiftLog\('/.test(sb));
  ok('pools, by-products and closed batches are never stuck', /b\.voided\|\|b\.pool\|\|b\.status!=='open'\|\|b\.disposition==='byproduct'/.test(sb));
  ok('nothing is written', !/save\(\)/.test(sb));
}
ok('the lights come from fireLists(), the same numbers the Firefighter had', /var F=fireLists\(\)/.test(pl));
ok('a light counts ORDERS, not lines', /m\[r\.po\]=1/.test(pl) && /Object\.keys\(m\)\.length/.test(pl));
ok('tap a light, get only that list', /plSel=plSel===/.test(pl) && /if\(sel && sel\.k==='delayed'\)/.test(pl));
ok('late orders are one row per ORDER, lines inside (R14)', /one row per ORDER/.test(pl) && /byPo\[r\.po\]/.test(pl));
ok('a row has the action, for people who may act', /plCanAct\(\)&&g\.act/.test(pl) && /plCanAct\(\)&&r\.act/.test(pl));
ok('the KAM reads, never acts (C9)', /state\.role!=='KAM'/.test(grab('plCanAct')));
ok('every department on one line: lead, jobs waiting, oldest, on late orders', /plDeptLines\(\)/.test(pl) && /jobs waiting/.test(pl) && /oldest job/.test(pl) && /on late orders/.test(pl));
ok('a department with no lead says so, in red', /no lead named/.test(pl));
ok('the floor is stage words per open order', /plFloor\(\)/.test(pl) && /lineBucket\(o,l\)/.test(grab('plFloor')));
ok('Find an order sits at the top of Plant, with All orders and Reports beside it (23u)', /id="plFind"/.test(pl) && /plFilterFloor\(\)/.test(pl) && /setScreen\(\\'tracker\\'\)/.test(pl) && /setScreen\(\\'reports\\'\)/.test(pl) && pl.indexOf('pl-find') < pl.indexOf('qs-tally'));
ok('Trucks waiting includes orders ready with no truck yet (23u)', /F\.holds\.concat\(plReadyNoTruck\(\)\)/.test(pl) && /it\.label!=='Ship'/.test(grab('plReadyNoTruck')));
ok('department counts are the jobs Today counts (23u)', /tdGroups\(byDept\[d\]\)/.test(grab('plDeptLines')));
ok('Plant no longer calls itself read-only while every row has a button', !/read-only/.test(pl));
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
ok('a Back Office job opens its one card ALONE: tabs and other cards are not shown (23x)', /boFocus=card\|\|''/.test(grab('boOpen')) && /\.ac2gbar/.test(grab('boFocusApply')) && /details\.acard/.test(grab('boFocusApply')) && /else d\.style\.display='none'/.test(grab('boFocusApply')) && /boFocusApply\(\);\n\}/.test(html));
ok('the page title becomes the job, under Back Office', /ss\.textContent='Back Office'/.test(grab('boFocusApply')));
ok('leaving Setup by any other route clears the focus', /if\(id!=='admin'\) boFocus='';/.test(grab('setScreen')));
ok('Back Office leaves the header when the person has no job there (23u)', /if\(id==='backoffice'\)\{ try\{ if\(!boJobs\(\)\.length\) return; \}catch\(e\)\{\} \}/.test(rtn));
ok('Give someone access shows only to whoever can edit People (23u)', /ok:canView\(state\.role,'users'\)&&screenEditOK\('users'\)/.test(bj));

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
ok('a move reads Role: A -> B, signs as: X -> Y (23u)', /Role: <b>'\+qsEsc\(ppEdit\.from\)/.test(pr) && /signs as: <b>'\+qsEsc\(personTitle\(ppEdit\.username,ppEdit\.from\)\)/.test(pr));
ok('no code slugs in the sentences (23u)', !/qsEsc\(s\.code\)/.test(grab('roleSentencesHTML')));
ok('the only COO cannot be moved out of COO (23u)', /ppEdit\.from==='COO'&&ppEdit\.role!=='COO'/.test(ps) && /coos<=1/.test(ps));
ok('Add a person shows what the chosen role can do before the person exists', /roleSentencesHTML\(uForm\.role\)/.test(pp));
ok('Production Manager and Finance Desk Officer file into a department by id', /'production-manager':'production', 'finance-desk-officer':'finance'/.test(html));

/* ================= 6. GUIDE: roles and titles ================= */
const rt = grab('rolesTitlesCard');
ok('the Guide opens on Your day, then Roles and titles (23u)', /\$\('view'\)\.innerHTML=`\s*\$\{yourDayCard\(\)\}\s*\$\{rolesTitlesCard\(\)\}/.test(html));
ok('Your day lists what reaches the role, the button, and who gets it next', /tdRoleJobs\(role\)/.test(grab('yourDayCard')) && /your button: /.test(grab('yourDayCard')) && /TD_NEXT\[l\]/.test(grab('yourDayCard')));
ok('the old step-by-step is a reference at the bottom, the manual is for COO/CFO/PM', /<details class="qs-ref">/.test(html) && /\(state\.role==='COO'\|\|state\.role==='CFO'\|\|state\.role==='Plant Manager'\)\?backOfficeManualCard\(\):''/.test(html));
ok('it says a role is not a job title, in the words Tahir asked for', /A role is not a job title\./.test(rt) && /roles are added and never renamed/.test(rt) && /Two people can hold one role and sign differently/.test(rt));
ok('it lists every role under its department with the people who hold it', /roleDeptId\(r\.name\)===d\.id/.test(rt) && /u\.role===r\.name/.test(rt) && /signs as/.test(rt));

/* ================= 7. BUILD ================= */
ok("BUILD_ID is 2026-09-23t or later", /var BUILD_ID='2026-09-2(3[t-z]|4[a-z])'/.test(html));
/* 24e: the person who loads does not release */
{
  const f = new Function(grab('seedLoadRightV1') + ';return seedLoadRightV1;')();
  const st = { masters: { roles: [{id:'supply-chain',name:'Supply Chain'},{id:'warehouse',name:'Warehouse'},{id:'supply-chain-officer',name:'Supply Chain Officer'},{id:'production',name:'Production'}],
    roleRights: { 'supply-chain': {'shipment.load': true, 'shipment.plan': true}, 'warehouse': {'shipment.load': true}, 'supply-chain-officer': {}, 'production': {'batch.open': true} } } };
  f(st);
  ok('Lead Supply Chain loses loading, keeps the rest', st.masters.roleRights['supply-chain']['shipment.load'] === false && st.masters.roleRights['supply-chain']['shipment.plan'] === true);
  ok('the Warehouse keeps it; the Warehouse Assistant gets it', st.masters.roleRights['warehouse']['shipment.load'] === true && st.masters.roleRights['supply-chain-officer']['shipment.load'] === true);
  ok('nobody else is touched', st.masters.roleRights['production']['shipment.load'] === undefined);
  ok('it is logged with the ruling, marked decided, and runs once', /the person who loads does not release/.test((st.actionLog||[]).map(e=>e.what).join(' ')) && st.masters.roleRightsSet['supply-chain']['shipment.load'] === true && (st.masters.roleRights['supply-chain']['shipment.load'] = true, f(st), st.masters.roleRights['supply-chain']['shipment.load'] === true));
  ok('it runs in ensureState after the acknowledge seed', /seedAckRightV1\(s\); seedLoadRightV1\(s\);/.test(html));
}
/* 24d: "Done. Now waiting on Masab." */
{
  ok('opening a job snapshots the queue; save() looks for what appeared', /tdNoteTaken\(key\)/.test(grab('tdTake')) && /if\(typeof tdAfterSave==='function'&&tdLastTaken\) tdAfterSave\(\)/.test(grab('save')));
  const src = grab('tdSnapKeys') + grab('tdNoteTaken') + grab('tdHolderNames') + grab('tdAfterSave') + 'var tdLastTaken=null;';
  ok('the helper does not shadow the Guide\'s tdWhoHolds', (html.match(/function tdWhoHolds\(/g) || []).length === 1 && /function tdHolderNames\(/.test(html));
  let items = [{label:'Lab QC', role:'Lab Rep', o:{id:'O1'}}], toasts = [];
  const env = { actionItems: () => items, acKey: it => it.label + '|o:' + it.o.id, usersList: [{name:'Masab Rasheed', role:'AQCM'}], TD_LABEL: {'Review':{title:'Needs your signature'}}, roleTitle: r => r, toast: m => toasts.push(m), setTimeout: (f) => f(), Date: Date };
  const f = new Function(...Object.keys(env), 'items', src + ';tdNoteTaken("Lab QC|o:O1"); items.length=0; items.push({label:"Review", role:"AQCM", o:{id:"O1"}}); tdAfterSave(); return 1;');
  f(...Object.values(env), items);
  ok('after the job is gone and a new one appeared on the same order, the toast names the next person', toasts.length === 1 && /Now waiting on Masab Rasheed — needs your signature\./.test(toasts[0]), toasts.join(' | '));
  toasts.length = 0; items = [{label:'Lab QC', role:'Lab Rep', o:{id:'O1'}}];
  env.actionItems = () => items;
  const g = new Function(...Object.keys(env), 'items', src + ';tdNoteTaken("Lab QC|o:O1"); tdAfterSave(); return 1;');
  g(...Object.values(env), items);
  ok('while the job is still there (a save that did not finish it), nothing is said', toasts.length === 0);
  ok('nothing is written', !/save\(\)/.test(grab('tdAfterSave') + grab('tdNoteTaken')));
}
/* 24c: the 2-person rules can refuse */
{
  ok('the sign-offs stay OUT of the catalogue', ['inspection.perform','coa.draft','coa.review','coa.approve','shipment.release','dc.approve'].every(c => !new RegExp("code:'" + c.replace('.', '\\.') + "'").test(html)));
  ok('but each one names the role that holds it today', /var SIGNOFF_ROLES=\{'inspection\.perform':\['QA Inspector'\],'coa\.draft':\['Lab Rep','AQCM','QCM'\],'coa\.review':\['AQCM'\],'coa\.approve':\['QCM'\],'shipment\.release':\['Supply Chain'\],'dc\.approve':\['Supply Chain'\]\}/.test(html));
  ok('separationRefusal reads a sign-off half from that map and never grants it', /holdsCode\(targetRole,other\)/.test(grab('separationRefusal')) && /rightByCode\(code\)\?mayHere\(role,code\):holdsSignoff\(role,code\)/.test(grab('holdsCode')));
  ok('the Roles editor shows a rule already broken', /sodConflicts\(role\)/.test(grab('roleEditorHTML')) && /A 2-person rule is broken/.test(grab('roleEditorHTML')));
  ok('on the certificate the rule is per person: drafter cannot review or approve, reviewer cannot approve', /h\.coa\.draftedBy=sigStamp\(\)/.test(html) && /coaSamePerson\(h\.coa\.draftedBy/.test(grab('coaReview')) && /coaSamePerson\(h\.coa\.reviewer/.test(grab('coaApprove')) && /coaSamePerson\(h\.coa\.draftedBy/.test(grab('coaApprove')));
  const f = new Function('state', grab('coaSamePerson') + ';return coaSamePerson;');
  const me = { currentUser: { name: 'Masab Rasheed', username: 'masab' } };
  ok('same login = same person', f(me)({ user: 'masab', name: 'X' }, '') === true);
  ok('same typed name = same person', f(me)(null, ' masab rasheed ') === true);
  ok('another person is not', f(me)({ user: 'himayat', name: 'Himayat Hussain' }, 'Mubeen Ahmad') === false);
}
/* 24a: your people */
{
  const yp = grab('tdYourPeople'), ev = grab('evAllStamps');
  ok('a lead\'s Today ends with Your people, before done-today', /tdYourPeople\(\);\n  h\+=tdDoneToday\(\);/.test(grab('screenToday')));
  ok('only the lead\'s own departments (TD_LEADS); the COO sees all', /TD_LEADS\[state\.role\]/.test(yp) && /state\.role==='COO'\?null/.test(yp));
  ok('each person: waiting on their role, oldest, done today, current %', /waiting on /.test(yp) && /oldest waiting/.test(yp) && /done today/.test(yp) && /% current/.test(yp));
  ok('current comes from the app\'s own entry stamps: recordedBy, actualDate, recordedAt, enteredLate', /x\.recordedAt&&x\.recordedBy&&x\.actualDate/.test(ev) && /enteredLate/.test(ev));
  ok('the walk never reads the action log, audit, corrections or masters as stamps', /k==='actionLog'\|\|k==='audit'\|\|k==='corrections'\|\|k==='masters'/.test(ev));
  ok('one honest number for the department, over 7 days', /deptCur=ppCurrent\(/.test(yp) && /7\)/.test(yp) && /one number/.test(yp));
  ok('tap a person for their list', /openPersonList\(/.test(yp) && /tdGroups\(all\)/.test(grab('openPersonList')));
  ok('nothing is written', !/save\(\)/.test(yp + ev + grab('openPersonList')));
  const f = new Function(grab('ppCurrent') + ';return ppCurrent;')();
  const TODAY = new Date();
  const g = new Function('TODAY', grab('ppCurrent') + ';return ppCurrent;')(TODAY);
  const r = g([{at:new Date(Date.now()-86400000).toISOString(),late:false},{at:new Date(Date.now()-2*86400000).toISOString(),late:true},{at:'2020-01-01T00:00:00Z',late:true}], 7);
  ok('current = on-time stamps over stamps in the window; old ones ignored', r.n === 2 && r.ok === 1 && r.pct === 50);
}
/* 23z: Orders you can read */
{
  const so = grab('screenOrders'), oc = grab('ordCardHTML');
  ok("the 'tracker' screen renders screenOrders now", /tracker:screenOrders,/.test(html));
  ok('3 tiles: open, past promise, delivered or closed', /open<\/span>/.test(so) && /past promise/.test(so) && /delivered or closed/.test(so));
  ok('one search box, no matrix, no group-by, no saved views, no 8 stage chips', /id="ordFind"/.test(so) && !/trkViewSw|trkGroup|trkSavedViews|FILTER STAGE/.test(so));
  ok('a card says where it stands, who acts next, how late, how much delivered', /NEXT_ACT\[b\]/.test(oc) && /ordNextWho\(b\)/.test(oc) && /d past promise/.test(oc) && /Kg\/L delivered/.test(oc));
  ok('who acts next is written as the TITLE, not the role code', /roleTitle\(owner\)/.test(grab('ordNextWho')));
  ok('tap a card for the journey - the same drawer as before', /openTkDrawer\(/.test(oc));
  ok('late orders first, then by days late', /var la=isOverdue\(a\)\?1:0, lb=isOverdue\(b\)\?1:0/.test(so) && /daysOver\(a\)/.test(so));
  ok('a search that arrives from elsewhere (trkSearch) is honoured', /if\(trkSearch&&!ordQ\)\{ ordQ=trkSearch;/.test(so));
  ok('the COO\'s Close this PO sits on the card; never on a delivered or closed one', /closePOButtonHTML\(o\)/.test(oc) && /!done&&!shut/.test(oc));
  ok('no price on Orders', !/price|PKR|\bRs\b/i.test(so + oc));
}
/* 23y: close a PO, the product sheet, a new base reaches the floor */
{
  const sub = (() => { const i = html.indexOf('\nfunction submitClosePO('); return i < 0 ? '' : H.matchBlock(i + 1, 'submitClosePO'); })();
  ok('po.close exists in the catalogue, COO only, not delegable', /\{code:'po\.close',\s+dept:'leadership', name:'Close a whole PO', delegable:false,/.test(html) && /code:'po\.close'[\s\S]{0,400}legacy:\{kind:'hard', roles:\[\]\}/.test(html));
  ok('the COO closes every open line in one act, approved in the same act', /approvedBy:who,approvedAt:now,poClose:true/.test(sub) && /o\.closed=\{at:now,by:who/.test(sub));
  ok('the 2 managers who may ask get the same sheet, and it files a REQUEST per line', /if\(f\.mode==='ask'\)/.test(sub) && /may\('po\.shortclose_request'\)/.test(sub) && /requestedBy:scWho\(\),requestedAt/.test(sub) && !/approvedAt/.test(sub.split("if(f.mode==='ask')")[1].split('return;')[0]));
  ok('a close needs a reason, and "other" needs words', /if\(!scReason\(f\.reasonCode\)\)/.test(sub) && /f\.reasonCode==='other' && !String\(f\.reason\|\|''\)\.trim\(\)/.test(sub));
  ok('the ordered quantity is never rewritten; the close is logged and audited', /scFreeze\(l\)/.test(sub) && /logAction\('PO CLOSED by the COO/.test(sub) && /field:'PO closed'/.test(sub) && !/l\.ordered=/.test(sub));
  ok('who may close: COO or po.close; who may ask: po.shortclose_request; nobody else sees the button', /if\(state\.role==='COO'\|\|may\('po\.close'\)\) return 'close'; if\(may\('po\.shortclose_request'\)\) return 'ask'; return '';/.test(grab('cpMode')) && /if\(!m\|\|!o\|\|!cpOpenLines\(o\)\.length\) return ''/.test(grab('closePOButtonHTML')));
  ok('the button is on Plant\'s late orders and the floor, and on the run sheet', /closePOButtonHTML\(oo\)/.test(grab('screenPlant')) && /closePOButtonHTML\(o\)/.test(grab('screenPlant')) && /openClosePO\(/.test(grab('renderRun')));
  ok('the run sheet also lets a manager ask to close ONE line short', /openShortClose\(/.test(grab('renderRun')));
  const ps = grab('pmRenderSheet');
  ok('the product form is a sheet in 4 steps', /step\(1,'The product'/.test(ps) && /step\(2,'What the plant makes'/.test(ps) && /step\(3,'How it is packed'/.test(ps) && /step\(4,'Who can order it'/.test(ps));
  ok('add and edit open the sheet; cancel and save close it', /pmSheetOpen\(\); \}/.test(grab('pmStartAdd')) && /pmSheetOpen\(\); \}/.test(grab('pmEdit')) && /closeModal\(\); render\(\); \}/.test(grab('pmCancel')) && /closeModal\(\); render\(\);\n\}/.test(grab('pmSave')));
  ok('the old inline form is never drawn', /if\(f&&ed&&false\)\{/.test(grab('productMasterCard')));
  ok('a product saved as its own base is marked bulk', /bulk:!!f\.ownBase/.test(grab('pmSave')));
  const ap = grab('applyProductsV1');
  ok('a bulk base reaches BULK_BASES (Liquid Bio Stimulant)', /BULK_BASES\.push\(b\)/.test(ap) && /p\.bulk===true\)\|\|\(p\.seeded===false&&\(p\.base\|\|p\.brand\)===p\.brand\)/.test(ap));
  {
    const f = new Function('SEED','BULK_BASES', ap + ';return applyProductsV1;')({catalog:{}}, ['Sulfur 70%']);
    const BB = ['Sulfur 70%']; const g = new Function('SEED','BULK_BASES', ap + ';return applyProductsV1;');
    const fn = g({catalog:{}}, BB);
    fn({masters:{products:[{brand:'Liquid Bio Stimulant',base:'Liquid Bio Stimulant',seeded:false,active:true,clients:['Dealers'],packs:[1]},{brand:'Cal-Mag V',base:'Cal-Mag V',seeded:true,active:true,clients:['BKK'],packs:[1]},{brand:'Max Sulfur',base:'Sulfur 70%',seeded:true,active:true,clients:['MAXIM'],packs:[1]}]}});
    ok('a hand-added own base is pushed; a migrated (own) row and a normal brand are not', BB.indexOf('Liquid Bio Stimulant') > -1 && BB.indexOf('Cal-Mag V') < 0 && BB.length === 2);
  }
}
/* 23x: who is on it, and acknowledge is Supply Chain's */
ok('opening a job marks it taken by me, in the shared state', /state\.taken\[key\]=\{by:me,at:new Date\(\)\.toISOString\(\)\}/.test(grab('tdTake')) && /save\(\)/.test(grab('tdTake')));
ok('the mark shows to OTHERS only, and expires after 8 hours', /if\(t\.by===me\) return null/.test(grab('tdTakenBy')) && /age<8\*3600000/.test(grab('tdTakenBy')));
ok('the card says who is on it', /is on it/.test(grab('tdTakenTag')) && /tdTakenTag\(g\)/.test(grab('tdTags')));
ok('it never locks: the button still runs the action', /tdTake\(.*?\);'\+one\.act\+'"/.test(grab('tdCardHTML')));
{
  const src = grab('seedAckRightV1');
  const f = new Function(src + ';return seedAckRightV1;')();
  const st = { masters: { roles: [{id:'supply-chain',name:'Supply Chain'},{id:'lab-rep',name:'Lab Rep'},{id:'aqcm',name:'AQCM'},{id:'plant-manager',name:'Plant Manager'},{id:'production',name:'Production'}],
    roleRights: { 'lab-rep': {'order.acknowledge': true}, 'aqcm': {'order.acknowledge': true}, 'supply-chain': {'order.acknowledge': true}, 'production': {'order.acknowledge': true, 'batch.open': true} } } };
  f(st);
  ok('acknowledge removed from Lab Rep and AQCM', st.masters.roleRights['lab-rep']['order.acknowledge'] === false && st.masters.roleRights['aqcm']['order.acknowledge'] === false);
  ok('acknowledge removed from Production, its other rights untouched', st.masters.roleRights['production']['order.acknowledge'] === false && st.masters.roleRights['production']['batch.open'] === true);
  ok('Supply Chain keeps it; the Plant Manager gets it (escalation)', st.masters.roleRights['supply-chain']['order.acknowledge'] === true && st.masters.roleRights['plant-manager']['order.acknowledge'] === true);
  ok('it is logged, with the roles it left', /Acknowledge a PO removed from Lab Rep, AQCM, Production/.test((st.actionLog||[]).map(e=>e.what).join(' ')));
  ok('it runs once', !!st.masters._ackRightV1 && (st.masters.roleRights['lab-rep']['order.acknowledge'] = true, f(st), st.masters.roleRights['lab-rep']['order.acknowledge'] === true));
  ok('each answer is marked decided, so nothing derived overwrites it', st.masters.roleRightsSet['lab-rep']['order.acknowledge'] === true);
}
ok('the seed runs in ensureState after the customer rights', /seedCustomerRightsV1\(s\); seedPrintDecisionV1\(s\); seedAckRightV1\(s\);/.test(html));
/* 23w: the first job-shaped sheet - the run */
const run = grab('renderRun');
ok('"Open production" on Today opens the run sheet, not the Production Center', /act:`openRun\('\$\{o\.id\}','\$\{l\.id\}'\)`,label:'Open Production'/.test(html));
ok('the run sheet is for ONE order line: to make, made, to pack', /Kg\/L still to make/.test(run) && /made so far/.test(run) && /still to pack/.test(run));
ok('the batches on the line carry Log output / Close the batch / Pack, each the app\'s own modal', /openShiftLog\(/.test(run) && /openCloseBatch\(/.test(run) && /openProdQty\(/.test(run));
ok('a batch that made its plan offers Close first', /var done=\(\+b\.producedKg\|\|0\)>=\(\+b\.plannedKg\|\|0\)-0\.5/.test(run));
ok('bulk of the same base that is cleared can be packed from the sheet', /runBulkFor\(l\)/.test(run) && /openPack\(/.test(run) && /batchPackableKg\(b\)>0\.5/.test(grab('runBulkFor')));
ok('every button asks the same right the modal asks', /may\('shift\.log'\)/.test(run) && /may\('batch\.close'\)/.test(run) && /may\('production\.enter'\)/.test(run) && /may\('batch\.open'\)/.test(run));
ok('opening a batch from the sheet arrives with PO and product picked', /prodPOsel=\\''\+qsEsc\(o\.id\)/.test(run) && /prodLineSel=\\''\+qsEsc\(l\.id\)/.test(run) && /l\.id===prodLineSel\)\?'selected'/.test(html));
ok('the Production Center is a link at the bottom, not the landing', /gotoProduce\(/.test(run) && run.indexOf('gotoProduce(') > run.indexOf('openShiftLog('));
ok('no price on the run sheet', !/price/i.test(run));
/* 23v: roles you can edit, one at a time */
const re = grab('roleEditorHTML');
ok('People -> Roles carries an editor for the picked role (23v)', /roleEditorHTML\(ppRole\)/.test(pp) && /deptLeadsHTML\(\)/.test(pp) && /newRoleHTML\(\)/.test(pp));
ok('every LIVE right is a sentence with a tick', /RIGHTS_LIVE\[r\.code\]===true/.test(re) && /type="checkbox"/.test(re) && /reRightTick\(/.test(re));
ok('a tick goes through rightTick, so grantRefusal and separationRefusal still apply', /rightTick\(role,code,on\)/.test(grab('reRightTick')) && /grantRefusal\(state\.role,role,r\.code\)/.test(re));
ok('every screen is None / Read / Edit through the matrix cell', /amxSet\(/.test(re) && /\['none','view','edit'\]/.test(re));
ok('amxSet writes the same cell the matrix wrote, logs it and resyncs the screen rights', /m\[role\]\[id\]=\{v:\(level!=='none'\),e:\(level==='edit'\)\}/.test(grab('amxSet')) && /logAction\('Access set: '/.test(grab('amxSet')) && /resyncScreenRights\(role,id\)/.test(grab('amxSet')));
ok('the COO is never editable and only the COO edits', /if\(role==='COO'\)\{ toast\('The COO always has full access'\); return; \}/.test(grab('amxSet')) && /state\.role!=='COO'/.test(grab('amxSet')));
ok('Today, Plant, Back Office, All actions and the Dashboard are not in the screen list', /RE_SCREENS_SKIP=\{today:1,plant:1,backoffice:1,approvals:1,dash:1\}/.test(html));
ok('department leads are set through setDeptLead', /setDeptLead\(/.test(grab('deptLeadsHTML')));
ok('a new role goes through addRole with the same 2 inputs', /id="adm_newrole"/.test(grab('newRoleHTML')) && /id="adm_newroledept"/.test(grab('newRoleHTML')) && /onclick="addRole\(\)"/.test(grab('newRoleHTML')));
ok('the Ismaeel migration also runs when the COO is already signed in', /checkWhatsNew\(\); try\{ if\(state\.role==='COO' && typeof migrateAccountsV1==='function'\) migrateAccountsV1\(\); \}catch\(e\)\{\}/.test(grab('renderApp')));
ok('green save buttons are blue like everything else', /button\.green\{background:var\(--accent\)\}/.test(html));
ok('the 23s changelog entry comes after 23r', /ver:'2026-09-23r'[\s\S]*ver:'2026-09-23s'/.test(html));
/* 23t: the door matches the house; everyone lands on Today */
const lg = grab('renderLogin');
ok('the sign-in page is paper, kraft rule, one blue button - no green', /#E6E8E2/.test(lg) && /#8C6532/.test(lg) && /#2E5F86/.test(lg) && !/#1f6b3a|#17552e|#0b4f63|linear-gradient/.test(lg));
ok('the sign-in page still calls doLogin and keeps the two inputs', /id="lg_user"/.test(lg) && /id="lg_pass"/.test(lg) && /onclick="doLogin\(\)"/.test(lg));
ok('sign-in says where accounts and passwords are handled', /Back Office/.test(lg) && /People/.test(lg));
ok('a browser that remembered All actions or the Dashboard lands on Today', /if\(state\.screen==='approvals'\|\|state\.screen==='dash'\) state\.screen='today'; render\(\);/.test(grab('renderApp')));

report('The Queue Shell, live (23s)');
