/* BUILD 2026-10-28b. Tahir, 28 Oct 2026: the Morning view. One read-only page for each of 7 people (Tahir COO, Yawar CFO, Fahim Plant Manager,
   Majid Production Manager, Saad Supply Chain, Himayat QC Manager, Ismaeel Finance); each person sees only their own page, the COO included;
   it has its own skin, scoped so it cannot touch the rest of O2S. In the same build FOC samples left the header: Today has one "+ New entry"
   button (a commercial order or an FOC sample, whichever the role may start) and the list of all samples is a Back Office tile.
   What these checks cover: who gets which page, that the page cannot write, the header / screen / dispatch wiring, the skin scope, and the
   "+ New entry" choice. The figures themselves were tied to How are we doing and Plant on the live data (28 Oct 2026), read only.
   Run: node morning28b.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, grabTopVar, html } = H;
const body = html.split('\n').filter(l => !l.startsWith('/*SYSDOC_DATA_START*/')).join('\n');

/* ---- who gets which page ---- */
const sb = { String, state: {} };
vm.createContext(sb);
vm.runInContext(grabTopVar('MV_PAGE_USER', '{') + grabTopVar('MV_PAGE_ROLE', '{') + ['mvPageFor', 'mvMine', 'mvMay'].map(grab).join('\n'), sb);
const as = (user, role) => { sb.state = { role, currentUser: user ? { username: user } : {} }; return sb.mvPageFor(user, role); };
eq('Tahir (COO) gets his own page', as('tahir', 'COO'), 'tahir');
eq('Yawar (CFO)', as('yawar', 'CFO'), 'yawar');
eq('Fahim (Plant Manager)', as('fahim', 'Plant Manager'), 'fahim');
eq('Majid (Production Manager)', as('majid', 'Production Manager'), 'majid');
eq('Saad (Supply Chain)', as('saad', 'Supply Chain'), 'saad');
eq('Himayat (QC Manager)', as('himayat', 'QCM'), 'himayat');
eq('Ismaeel (Finance)', as('ismaeel', 'Finance'), 'ismaeel');
eq('the second COO login falls back to the COO page by role', as('ahmer', 'COO'), 'tahir');
eq('a person is matched by login name before role (a COO login named yawar still gets Yawar page)', as('yawar', 'COO'), 'yawar');
eq('a Lab Rep has no page', as('someone', 'Lab Rep'), null);
eq('a KAM has no page', as('irfan', 'KAM'), null);
eq('a Warehouse login has no page', as('shoaib', 'Warehouse'), null);
ok('mvMay is false for a role with no page', (() => { as('irfan', 'KAM'); return sb.mvMay() === false; })());
ok('mvMay is true for the seven', (() => { as('saad', 'Supply Chain'); return sb.mvMay() === true; })());
eq('exactly seven pages exist', (body.match(/var MV_PAGES=\{[^}]*\}/)[0].match(/mvPage[A-Z]\w+/g) || []).length, 7);

/* ---- the screen shows only its own page, no picker, and writes nothing ---- */
const mod = body.slice(body.indexOf('/* ===================== MORNING VIEW'), body.indexOf('/* ===================== PLANT - the 3 lights'));
ok('the module is in the file and ends before Plant', mod.length > 20000 && mod.length < 400000);
const screen = grab('screenMorning');
ok('the screen gates itself with mvMine and shows nothing of another person', /mvMine\(\)/.test(screen) && /not set up for your role/.test(screen));
ok('there is no person picker on the screen (own page only, COO included)', !/<select/.test(screen) && !/onchange=/.test(screen));
ok('the module writes nothing: no assignment into state, no save, no fetch, no storage', !/\bstate\.[A-Za-z_$][\w$.\[\]'"]*\s*(=|\+=|-=)[^=]/.test(mod) && !/\b(save|saveState|persist|pushState|fetch|XMLHttpRequest|localStorage|sessionStorage)\s*\(/.test(mod) && !/\blocalStorage\b|\bsessionStorage\b/.test(mod));
ok('the only thing a button on the page does is switch the open / all POs view', (mod.match(/onclick="([^"]*)"/g) || []).every(x => /mvSetScope|setScreen/.test(x)));
ok('the footer says it is read only', /Read only\. Nothing on this page changes any record/.test(screen));
ok('yesterday is always the day before', /yesterday is always the day before today/.test(screen) && /DAY=mvAdd\(V,-1\)/.test(mod));

/* ---- the header, the screen entry and the dispatch ---- */
ok('Morning view is a header word right after Today', /\{label:'Today', ids:\['today'\]\},\s*\n\s*\{label:'Morning view', ids:\['morning'\]\}/.test(body));
ok('FOC samples is no longer a header word', !/\{label:'FOC samples', ids:\['samples'\]\}/.test(body));
ok('the word shows only to the seven', /if\(id==='morning'&&!mvMay\(\)\) return;/.test(grab('renderTopNav')));
ok('the screen is in SCREENS and in the render dispatch', /\{id:'morning', name:'Morning view'/.test(body) && /morning:screenMorning/.test(grab('render')));
ok('no role is given edit on it (owners empty); the screen decides who sees what', /\{id:'morning', name:'Morning view'[^}]*owners:\[\]/.test(body));

/* ---- the skin cannot touch the rest of O2S ---- */
const css = (/<style id="mv-skin">([\s\S]*?)<\/style>/.exec(html) || [0, ''])[1];
ok('the skin is in the page', css.length > 3000);
{ const sel = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '@m{').split('}').map(x => x.split('{')[0].trim()).filter(x => x && x !== '@m');
  const bad = sel.filter(s => s.split(',').some(p => !/^(\.mv\b|@)/.test(p.trim()) && p.trim() !== ''));
  eq('every rule in the skin starts with .mv (nothing global)', bad.length, 0);
  if (bad.length) console.log('   unscoped:', bad.slice(0, 5).join(' | ')); }
ok('light only: no dark-mode rule in the skin', !/prefers-color-scheme/.test(css));
ok('the two fonts are loaded', /family=Source\+Serif\+4/.test(html) && /family=Inter:wght@400;500/.test(html));

/* ---- + New entry ---- */
const log = [];
const sb2 = { state: { role: 'COO' }, log, _tdEsc: x => String(x), $: id => ({ classList: { add() {} }, set innerHTML(v) { log.push(['modal', v]); } }), toast: m => log.push(['toast', m]), closeModal: () => log.push(['close']),
  setScreen: s => log.push(['go', s]), smpNew: () => log.push(['smpNew']) };
vm.createContext(sb2);
vm.runInContext(['tdEntryChoices', 'tdNewEntryGo', 'tdNewEntry', 'boVisible', 'smpListOK'].map(grab).join('\n'), sb2);
const roleSet = (role, o) => { Object.assign(sb2, { canView: (r, s) => s === 'samples' ? o.view !== false : !!o.order, screenEditOK: () => !!o.order, may: c => !!o.sample, smpMayView: () => !!o.view, boJobs: () => o.bo ? [1] : [] }); sb2.state = { role }; log.length = 0; };
roleSet('COO', { order: true, sample: true, view: true }); eq('COO: only a commercial order (he approves samples, he does not ask for them)', sb2.tdEntryChoices().map(c => c.k).join(), 'order');
sb2.tdNewEntry(); eq('...one choice goes straight to the order screen, no modal', JSON.stringify(log.filter(x => x[0] !== 'close')), JSON.stringify([['go', 'entry']]));
roleSet('Finance', { order: true, sample: true, view: true }); eq('Finance: both', sb2.tdEntryChoices().map(c => c.k).join(), 'order,foc');
sb2.tdNewEntry(); ok('...two choices open a modal with both and "See all samples"', log.length === 1 && log[0][0] === 'modal' && /Commercial order/.test(log[0][1]) && /FOC sample/.test(log[0][1]) && /See all samples/.test(log[0][1]));
roleSet('KAM', { order: false, sample: true, view: true }); eq('KAM: only an FOC sample', sb2.tdEntryChoices().map(c => c.k).join(), 'foc');
sb2.tdNewEntry(); eq('...goes straight to the sample form', JSON.stringify(log.filter(x => x[0] !== 'close')), JSON.stringify([['smpNew']]));
roleSet('Warehouse', { order: false, sample: false, view: true }); eq('Warehouse: nothing to start', sb2.tdEntryChoices().length, 0);
sb2.tdNewEntry(); ok('...and a plain message if the button is somehow reached', log.length === 1 && log[0][0] === 'toast');
roleSet('CFO', { order: true, sample: true, view: true }); sb2.tdNewEntryGo('list'); ok('the list of all samples opens from the choice', log.some(x => x[0] === 'go' && x[1] === 'samples'));
const ts = grab('tdStarts');
ok('+ New order and + Ask for a free sample are gone from Today; one + New entry is there', /\+ New entry/.test(ts) && !/\+ New order/.test(ts) && !/\+ Ask for a free sample/.test(ts));
ok('the COO still starts orders only, not batches', /state\.role==='COO'\) b=b\.filter\(function\(x\)\{ return x\[0\]==='@tdNewEntry\(\)'; \}\)/.test(ts));
ok('a person who may see samples but has no Back Office gets a FOC samples link on Today', /smpListOK\(\) && !boVisible\(\)/.test(ts));
ok('Back Office has a FOC samples tile for those who may see samples', /if\(smpListOK\(\)\)\{ var _sl=/.test(grab('boDesks')) && /D\.push\(\{k:'samples',t:'FOC samples'/.test(grab('boDesks')));

/* review fix: no route to the samples list is shown when the COO has switched that screen off for the role */
roleSet('CFO', { order: true, sample: true, view: false }); sb2.state = { role: 'CFO' };
sb2.tdNewEntry(); ok('with Samples switched off, the choice sheet has no See all samples button', log.length === 1 && log[0][0] === 'modal' && !/See all samples/.test(log[0][1]));
eq('...and the route test itself says no', sb2.smpListOK(), false);

/* ---- the month target compares like with like (review fix) ---- */
{ const m = { String, Object, Math, BUDGET_SEP: '|', budgetChannelsOfName: () => [] }; vm.createContext(m);
  vm.runInContext(['mvTKey', 'mvTargetsOf', 'mvMonthT'].map(grab).join('\n'), m);
  const M = { month: '2026-06', fy: '2026-27', targetsM: { A: { '2026-27': { '2026-06': 700 } }, B: { '2026-27': { '2026-06': 300 } } },
    sales: [{ month: '2026-06', key: 'A', value: 500 }, { month: '2026-06', key: 'B', value: 100 }, { month: '2026-06', key: 'C', value: 900 }, { month: '2026-05', key: 'A', value: 77 }] };
  const t = m.mvMonthT(M);
  eq('target total is the clients that have a figure', t.tM, 1000); eq('sold counted against it is theirs only', t.soldT, 600);
  eq('percentage is like with like (600 of 1000, not 1500 of 1000)', t.pct, 60); eq('sales to the client with no figure are shown apart', t.other, 900);
  eq('all sold this month still adds up', t.soldAll, 1500);
  const none = m.mvMonthT({ month: '2026-06', fy: '2026-27', targetsM: {}, sales: M.sales }); ok('no targets at all: no percentage, nothing divided', none.has === false && none.pct === 0); }

/* ---- smaller review fixes ---- */
{ const m = { String, Object, Math, Number, Array }; vm.createContext(m); vm.runInContext(['mvEsc', 'mvPl', 'mvOldest', 'mvMore', 'mvTog', 'mvActsOl', 'mvActs', 'mvFlag'].map(grab).join('\nvar MV_OPEN={};\n') , m);
  eq('a line due today is not called 0 days late', m.mvOldest(0), ', all due today'); eq('1 day late, singular', m.mvOldest(1), ', the oldest 1 day late'); eq('12 days late', m.mvOldest(12), ', the oldest 12 days late');
  const list = [1, 2, 3, 4, 5, 6, 7].map(i => ({ t: 'job ' + i, why: 'w' }));
  const h = m.mvActs(list);
  ok('more than 5 jobs: the rest sit in a fold, none is dropped, and none is called smaller', (h.match(/<li /g) || []).length === 7 && /And 2 more/.test(h) && !/smaller than these/.test(h));
  ok('a fold the person opened stays open after a redraw', (() => { vm.runInContext('MV_OPEN["x"]=true', m); return /<details[^>]*data-t="x"[^>]* open>/.test(m.mvMore('x', '', 'b')); })()); }
ok('Morning view is listed in a role\'s screens, the command palette and the Guide only where it exists', /MV_PAGE_ROLE\[role\]/.test(grab('roleScreens')) && /mvMay\(\)/.test(grab('cmdkItems')) && /MV_PAGE_ROLE\[r\]/.test(grab('gdScreenOpen')));
ok('a DC counts once however many product lines it carries', /tr\[s\.dc\|\|s\.dispId\|\|s\.id\]=1/.test(body));
ok('a free-of-charge order is not on the to-invoice list', /t\.out===M\.day&&!t\.foc/.test(body));
ok('a shift that has logged nothing for 14 days is not chased', /MV_ACTIVE\[x\.shift\]=1/.test(body) && /MV_ACTIVE\[x\]/.test(grab('mvShiftNames')));

/* ---- build ---- */
ok('the build is 2026-10-28b or later', /var BUILD_ID='2026-10-(28[b-z]|29|3\d)'|var BUILD_ID='2026-1[12]/.test(html));
ok('the change log has the entry', /ver:'2026-10-28b'[^\n]*Morning view/.test(html));
ok('the Guide describes the Morning view and the + New entry button', /<h2>The Morning view<\/h2>/.test(grab('guideHow')) && /\+ New entry<\/b> on Today and picks <b>FOC sample/.test(grab('guideRules')));
process.exitCode = report('28b: Morning view and + New entry') ? 1 : 0;
