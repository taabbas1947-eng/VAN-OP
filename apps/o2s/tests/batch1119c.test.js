/* BUILD 2026-11-19c. Batch 1 of the fixes from the 18 Nov 2026 audit, part B2. Tahir ruled on 19 Nov 2026 (F12, D-377):
   the COO covers the Plant Manager and the CFO while they are away. Only the person going away marks Away, from his
   name at the top of any screen, and ends it himself; it also ends by itself on the back-on day. While it stands, his
   jobs are on the COO's Today from day 1, marked "cover for <name>". A New for you card and the Guide show the 3 steps.
   Run: node batch1119c.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;

const box = (st, role, user) => { const c = { console, Math, String, Date, JSON, Object, state: st, TODAY: new Date('2026-11-20T05:00:00Z'), _logs: [] };
  st.role = role; st.currentUser = user || null;
  vm.createContext(c);
  vm.runInContext(html.match(/var AWAY_ROLES=\{[^}]*\};/)[0] + '\n' + ['awayList', 'awayOn', 'awayActive', 'awayMine', 'awayMay', 'awayDay', 'awayMark', 'awayBack', 'awayBannerHTML', 'awayNoticeDue', 'awayNoticeCard', 'awayNoticeRead'].map(grab).join('\n')
    + '\nfunction evToday(){ return TODAY.toISOString().slice(0,10); }\nfunction _plDay(d){ return d; }\nfunction qsEsc(s){ return String(s==null?"":s).replace(/</g,"&lt;"); }\nfunction roleTitle(r){ return r; }'
    + '\nvar _t=[]; function toast(m){ _t.push(m); }\nfunction logAction(w){ _logs.push(w); }\nfunction save(){}\nfunction render(){}\nfunction closeModal(){}\nfunction sigStamp(){ return {name:(state.currentUser||{}).name||""}; }', c);
  return c; };
const fahim = { username: 'fahim', name: 'Fahim Asghar' };

/* ---------- marking away ---------- */
{ const st = { masters: {} }, c = box(st, 'Plant Manager', fahim);
  ok('F12: the Plant Manager may mark himself away', c.awayMay() === true);
  c.awayMark('2026-11-20', '2026-11-24');
  const a = st.masters.awayCover[0];
  ok('F12: the mark keeps who, role, first day and back-on day', a.user === 'fahim' && a.name === 'Fahim Asghar' && a.role === 'Plant Manager' && a.from === '2026-11-20' && a.backOn === '2026-11-24' && !!a.id);
  ok('F12: it is logged', /Away: Fahim Asghar .*from 2026-11-20, back on 2026-11-24/.test(c._logs[0]));
  ok('F12: he is away today', !!c.awayActive('Plant Manager') && !c.awayActive('CFO'));
  c.awayMark('2026-11-21', '2026-11-25');
  eq('F12: a second mark while away is refused', st.masters.awayCover.length, 1);
  ok('F12: his Today says he is away, with I am back', /You are away until <b>2026-11-24<\/b>\. Your jobs are with the COO\./.test(c.awayBannerHTML()) && /awayBack\(\)/.test(c.awayBannerHTML()));
  c.awayBack();
  ok('F12: I am back ends it', !!st.masters.awayCover[0].endedAt && !c.awayActive('Plant Manager') && c.awayBannerHTML() === '');
}
{ const st = { masters: { awayCover: [{ id: 'A1', user: 'fahim', name: 'Fahim Asghar', role: 'Plant Manager', from: '2026-11-16', backOn: '2026-11-20' }] } }, c = box(st, 'Plant Manager', fahim);
  ok('F12: away ends by itself on the back-on day', !c.awayActive('Plant Manager') && !c.awayMine());
}
{ const st = { masters: {} };
  const q = box(st, 'QCM', { username: 'q', name: 'Q' }); q.awayMark('2026-11-20', '2026-11-22');
  ok('F12: another role cannot mark away here', !st.masters.awayCover && q.awayMay() === false);
  const y = box(st, 'CFO', { username: 'yawar', name: 'Yawar' });
  y.awayMark('2026-11-19', '2026-11-22'); ok('F12: the first day cannot be before today', !st.masters.awayCover);
  y.awayMark('2026-11-22', '2026-11-22'); ok('F12: back on must be after the first day', !st.masters.awayCover);
  y.awayMark('2026-11-22', '2026-11-25');
  ok('F12: the CFO may mark a later absence; it is not active before its first day', st.masters.awayCover.length === 1 && !y.awayActive('CFO') && !!y.awayMine());
  ok('F12: before it starts his Today says when it starts', /From <b>2026-11-22<\/b>, back on <b>2026-11-25<\/b>/.test(y.awayBannerHTML()));
}
/* ---------- the New for you card ---------- */
{ const st = { masters: {} }, c = box(st, 'CFO', { username: 'yawar', name: 'Yawar' });
  ok('F12: the CFO sees the New for you card with the 3 steps', /New for you/.test(c.awayNoticeCard()) && /Tap your name at the top of any screen/.test(c.awayNoticeCard()) && /I am going away/.test(c.awayNoticeCard()) && /I am back/.test(c.awayNoticeCard()));
  c.awayNoticeRead(); eq('F12: once read it is gone', c.awayNoticeCard(), '');
  const d = box({ masters: {} }, 'Supply Chain', { username: 's', name: 'S' }); eq('F12: other roles do not get it', d.awayNoticeCard(), '');
}
/* ---------- the COO's Today ---------- */
{ const ti = grab('tdItems');
  ok('F12: the COO sees an away role\'s jobs from day 1', /if\(role==='COO'&&typeof awayActive==='function'\) Object\.keys\(AWAY_ROLES\)/.test(ti) && /x\._cover=\(a&&!wait\)\?\(a\.name\|\|x\.role\):''/.test(ti) && /x\._escalated \|\| x\.role==='COO' \|\| x\._cover/.test(ti));
  ok('F12: the card is tagged cover for the person', /cover for '\+_tdEsc\(/.test(grab('tdTags')));
  const c = { console, String, Object, state: { role: 'COO', masters: { awayCover: [{ id: 'A1', user: 'fahim', name: 'Fahim Asghar', role: 'Plant Manager', from: '2026-11-20', backOn: '2026-11-24' }] } }, TODAY: new Date('2026-11-21T05:00:00Z'), tdScope: 'mine' };
  vm.createContext(c);
  vm.runInContext(html.match(/var AWAY_ROLES=\{[^}]*\};/)[0] + '\n' + ['awayList', 'awayOn', 'awayActive', 'tdItems'].map(grab).join('\n')
    + '\nfunction evToday(){ return TODAY.toISOString().slice(0,10); }\nfunction actionItems(){ return [{role:"Plant Manager",label:"Release"},{role:"CFO",label:"Approve PR"},{role:"COO",label:"Approve move"},{role:"Supply Chain",label:"Ship"}]; }'
    + '\nfunction acEscalation(){ return null; }\nfunction tdVisible(){ return true; }\nfunction labCoverSees(){ return false; }\nfunction acDeferActive(){ return false; }\nfunction acRiskOf(){ return 0; }\nfunction actTiming(){ return {days:0}; }', c);
  const T = c.tdItems().map(x => x.role + ':' + (x._cover || '')).sort().join(', ');
  eq('F12: on day 2 of the absence the COO has his own job and the Plant Manager\'s, not the CFO\'s or Supply Chain\'s', T, 'COO:, Plant Manager:Fahim Asghar');
  c.TODAY = new Date('2026-11-24T05:00:00Z');
  eq('F12: on the back-on day the cover ends', c.tdItems().map(x => x.role).join(','), 'COO');
}
/* ---------- Tahir's rulings after the review: 4 jobs wait, escalations come too, the Morning view counts them ---------- */
{ const c = { console, String, Object, state: { role: 'COO', masters: { awayCover: [{ id: 'A1', user: 'fahim', name: 'Fahim Asghar', role: 'Plant Manager', from: '2026-11-20', backOn: '2026-11-24' }] } }, TODAY: new Date('2026-11-21T05:00:00Z'), tdScope: 'mine' };
  vm.createContext(c);
  vm.runInContext(html.match(/var AWAY_ROLES=\{[^}]*\};/)[0] + '\n' + html.match(/var AWAY_WAIT=\{[^}]*\};/)[0] + '\n' + ['awayList', 'awayOn', 'awayActive', 'tdItems'].map(grab).join('\n')
    + '\nfunction evToday(){ return TODAY.toISOString().slice(0,10); }'
    + '\nfunction actionItems(){ return [{role:"Plant Manager",label:"Release sample"},{role:"Plant Manager",label:"Name a cover"},{role:"Plant Manager",label:"Complaint raised"},{role:"Plant Manager",label:"Complaint closed"},{role:"Plant Manager",label:"Approve move"},{role:"Supply Chain",label:"Receive",escTo:"Plant Manager"},{role:"Supply Chain",label:"Ship"}]; }'
    + '\nfunction acEscalation(x){ return x.escTo?{to:x.escTo}:null; }\nfunction tdVisible(){ return true; }\nfunction labCoverSees(){ return false; }\nfunction acDeferActive(){ return false; }\nfunction acRiskOf(){ return 0; }\nfunction actTiming(){ return {days:0}; }', c);
  const L = c.tdItems().map(x => x.label).sort().join(', ');
  eq('ruling: Release sample, Name a cover and the 2 complaint read-it jobs wait for Fahim; his other jobs and the job escalated to him come to the COO', L, 'Approve move, Receive');
  ok('ruling: the escalated job is tagged cover for him', c.tdItems().filter(x => x.label === 'Receive')[0]._cover === 'Fahim Asghar');
}
{ const c = { console, String, Object, state: { role: 'COO', masters: { awayCover: [{ id: 'A1', user: 'fahim', name: 'Fahim Asghar', role: 'Plant Manager', from: '2026-11-20', backOn: '2026-11-24' }] } }, TODAY: new Date('2026-11-21T05:00:00Z'), tdScope: 'mine', TD_RIGHT: {} };
  vm.createContext(c);
  vm.runInContext(html.match(/var AWAY_ROLES=\{[^}]*\};/)[0] + '\n' + html.match(/var AWAY_WAIT=\{[^}]*\};/)[0] + '\n' + html.match(/var AWAY_CHASE=\{[^}]*\};/)[0] + '\n' + ['awayList', 'awayOn', 'awayActive', 'tdItems', 'tdCanAct'].map(grab).join('\n')
    + '\nfunction evToday(){ return TODAY.toISOString().slice(0,10); }'
    + '\nfunction actionItems(){ return [{role:"AQCM",label:"Review",escTo:"Plant Manager"},{role:"Plant Manager",label:"Review"},{role:"Plant Manager",label:"Investigate complaint",cm:"C1",who:"fahim"},{role:"Plant Manager",label:"Do complaint action",cm:"C1",ca:"a1",who:"fahim"},{role:"Plant Manager",label:"Route complaint",cm:"C2"}]; }'
    + '\nfunction acEscalation(x){ return x.escTo?{to:x.escTo}:null; }\nfunction tdVisible(){ return true; }\nfunction labCoverSees(){ return false; }\nfunction acDeferActive(){ return false; }\nfunction acRiskOf(){ return 0; }\nfunction actTiming(){ return {days:0}; }\nfunction may(){ return true; }', c);
  const it = c.tdItems(), lab = it.filter(x => x.role === 'AQCM')[0], pmReview = it.filter(x => x.role === 'Plant Manager' && x.label === 'Review')[0];
  ok('review 2: a lab sign-off escalated to the away Plant Manager comes to the COO to chase, with no button', lab && lab._cover === 'Fahim Asghar' && c.tdCanAct(lab) === false);
  ok('review 2: the Plant Manager\'s own UNFIT Review stays a job the COO can act on', pmReview && pmReview._cover && c.tdCanAct(pmReview) === true);
  ok('review 2: complaint jobs addressed to the away person by name wait for him', !it.some(x => x.label === 'Investigate complaint' || x.label === 'Do complaint action'));
  ok('review 2: a complaint job of his role not addressed by name still comes', it.some(x => x.label === 'Route complaint' && x._cover));
}
{ const st = { masters: { awayCover: [{ id: 'A3', user: 'fahim', name: 'Fahim Asghar', role: 'Plant Manager', from: '2026-11-18', backOn: '2026-11-24' }] } }, c = box(st, 'Plant Manager', fahim);
  c.awayBack(); ok('review 2: I am back during an absence is logged as back, not cancelled', /^Back: Fahim Asghar .*ended away/.test(c._logs[0]) && /Welcome back/.test(c._t[c._t.length - 1]));
}
ok('ruling: the COO\'s Morning view counts the covered jobs', /x\._escalated\|\|x\.role==='COO'\|\|x\._cover/.test(grab('mvToday')));
{ const st = { masters: { awayCover: [{ id: 'A2', user: 'yawar', name: 'Yawar', role: 'CFO', from: '2026-11-22', backOn: '2026-11-25' }] } }, c = box(st, 'CFO', { username: 'yawar', name: 'Yawar' });
  ok('review: before the first day the button reads Cancel my away', /Cancel my away/.test(c.awayBannerHTML()) && !/I am back/.test(c.awayBannerHTML()));
  c.awayBack(); ok('review: cancelling before the first day is logged as cancelled', /Away cancelled: Yawar/.test(c._logs[0]) && !!st.masters.awayCover[0].endedAt);
}
ok('review: the name menu reads Cancel my away before the first day', /awayOn\(awayMine\(\)\)\?'I am back':'Cancel my away'/.test(html));
ok('the Guide names the 4 jobs that wait and the escalations that come', /A job escalated to you while you are away also comes to the COO\. Only the Plant Manager can do 4 jobs, so they wait for him/.test(html));

/* ---------- where it is reached, the Guide, docs ---------- */
ok('F12: the name menu has I am going away for the 2 roles', /AWAY_ROLES\[state\.role\]\)\?'<button class="qs-btn sm" onclick="openAway\(\)">'\+\(awayMine\(\)\?\(awayOn\(awayMine\(\)\)\?'I am back':'Cancel my away'\):'I am going away'\)/.test(html));
ok('F12: Today shows the banner and the card', /h\+=awayBannerHTML\(\); h\+=awayNoticeCard\(\);/.test(html));
ok('F12: the Guide rule has its number', /'When the Plant Manager or the CFO is away':'R-053'/.test(html) && /<h3>When the Plant Manager or the CFO is away<\/h3>/.test(html));
ok('change log 2026-11-19c says it', /ver:'2026-11-19c'/.test(html) && /tap I am going away, pick the first day and the day you are back/.test(html) && /every job of yours, and every job escalated to you, is also on the COO's Today/.test(html));
ok('the Guide tells the Plant Manager, the CFO and the COO', /var _n19c=\{'Plant Manager':_aw19,'CFO':_aw19,'COO':/.test(grab('guideMyJob')) && /New on 19 Nov \(2026-11-19c\)/.test(grab('guideMyJob')));
ok('BUILD_ID of the build form (2026-11-19d since part B3) and SYSDOC_VER follows', /var BUILD_ID='2026-\d\d-\d\d[a-z]';/.test(html) && /ver:'2026-11-19c'/.test(html) && (html.match(/var BUILD_ID='([^']+)'/) || [])[1] === (html.match(/var SYSDOC_VER='([^']+)'/) || [])[1]);
ok('the System Documentation carries D-377 and SC-49', /"id":"D-377"/.test(html) && /"id":"SC-49"/.test(html));
report('2026-11-19c batch 1, part B2: the Away switch');
