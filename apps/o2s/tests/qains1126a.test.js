/* BUILD 2026-11-26a. QA -> Cleared -> Inspections on file (D-379, R-055). Tahir ruled on 26 Nov 2026: newest first, and a box
   to find any inspection by PO or batch; the card stays on the Cleared tab. Before this the card showed the first 40
   inspections in stored order, so the 25 Nov inspection of PO 23214 (357th of 363) never showed and could not be withdrawn.
   Run: node qains1126a.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;

const box = () => { const c = { console, Math, String, Date, JSON, Object, Array, Map };
  vm.createContext(c);
  vm.runInContext(grab('qaInsHay') + '\n' + grab('qaInsList'), c);
  return c; };
const c = box();
const ins = (id, date, po, extra) => Object.assign({ id, date, po, brand: 'Max Sulfur', by: 'Ali', pass: true, kg: 100 }, extra || {});

/* stored order as live had it: new ones at the front, then rows merged from other devices at the end */
const src = [ins('A', '2026-11-26', '23300'), ins('B', '2026-10-14', '22000')];
for (let i = 0; i < 50; i++) src.push(ins('OLD' + i, '2026-09-' + String(1 + (i % 28)).padStart(2, '0'), '2' + i));
src.push(ins('INSmww1axxq1gjrr9', '2026-11-25', '23214', { kg: 420, batches: [{ batch: 'GS10460', kg: 420 }] }));
src.push(ins('C', '2026-11-25', '23215'));
src.push(null);

const list = c.qaInsList(src, '');
eq('newest first: the 26 Nov inspection is first', list[0].id, 'A');
ok('the 25 Nov inspection stored near the end is in the newest 40', list.slice(0, 40).some(x => x.id === 'INSmww1axxq1gjrr9'));
ok('on the same date the stored order is kept', list.findIndex(x => x.id === 'INSmww1axxq1gjrr9') < list.findIndex(x => x.id === 'C'));
eq('an empty row is dropped, nothing else', list.length, src.length - 1);
ok('dates never go up the list', list.every((x, i) => i === 0 || String(list[i - 1].date) >= String(x.date)));
ok('a back-dated inspection sorts by its actual date', c.qaInsList([ins('X', '2026-11-26', '1', { actualDate: '2026-11-01' }), ins('Y', '2026-11-20', '2')], '')[0].id === 'Y');
ok('the stored list itself is not reordered', src[0].id === 'A' && src[1].id === 'B');

eq('find by PO', c.qaInsList(src, '23214').map(x => x.id).join(), 'INSmww1axxq1gjrr9');
eq('find by base batch', c.qaInsList(src, 'gs10460').map(x => x.id).join(), 'INSmww1axxq1gjrr9');
eq('every typed word must match', c.qaInsList(src, 'max 23215').map(x => x.id).join(), 'C');
eq('find by inspector, spaces around ignored', c.qaInsList([ins('Q', '2026-11-01', '9', { by: 'Mursaleen' })], '  mursal ').length, 1);
ok('an old inspection (beyond the newest 40) is found by its PO', c.qaInsList(src, '249').some(x => x.id === 'OLD49'));
eq('no match: empty', c.qaInsList(src, 'nothing-like-this').length, 0);

/* the card */
const scr = grab('screenQA');
ok('the card no longer takes the first 40 stored', !/\(state\.inspections\|\|\[\]\)\.slice\(0,40\)/.test(scr));
ok('the card lists with qaInsList and shows QA_INS_SHOW rows', /qaInsList\(src,q\)/.test(scr) && /found\.slice\(0,QA_INS_SHOW\)/.test(scr) && /var qaInsQ='', QA_INS_SHOW=40;/.test(html));
ok('the card has the find box and a Clear button', /id="qaInsQ"/.test(scr) && /Find by PO, product, batch or inspector/.test(scr) && /qaInsFind\(\\'\\'\)/.test(scr));
ok('the card says what it shows', /newest '\+all\.length\+' of '/.test(scr) && / found'/.test(scr) && /No inspection on file matches/.test(scr));
ok('the typed text is escaped in the box and in the no-match line', /value="'\+_av\(q\)\+'"/.test(scr) && /qsEsc\(q\)/.test(scr));
ok('Withdraw is still offered only on a passed, not withdrawn inspection, to those allowed', /if\(!x\.superseded && x\.pass && correctAllowed\('inspection','SUPERSEDE'\)\)/.test(scr));
ok('the card stays on the Cleared tab', /if\(qaTab==='cleared'\) qaBody\+=qaInsCard;/.test(scr));

/* Guide, change log, documentation */
ok('Guide rule: Withdrawing a QA inspection, numbered R-055', /<h3>Withdrawing a QA inspection<\/h3>/.test(grab('guideRules')) && /'Withdrawing a QA inspection':'R-055'/.test(html));
ok('the rule says where and who', /QA inspection \\u2192 Cleared/.test(grab('guideRules')) && /The QA Inspector, the Plant Manager and the COO may withdraw/.test(grab('guideRules')));
ok('My job note for the QA Inspector, the Plant Manager and the COO', /New on 26 Nov \(2026-11-26a\)/.test(grab('guideMyJob')) && /\['QA Inspector','Plant Manager','COO'\]\.indexOf\(role\)>-1/.test(grab('guideMyJob')));
ok('change log 2026-11-26a says it', /ver:'2026-11-26a'/.test(html) && /Inspections on file: newest first/.test(html));
ok('BUILD_ID of the build form (2026-11-26a or later) and SYSDOC_VER follows', (function(){ var m=html.match(/var BUILD_ID='(2026-\d\d-\d\d[a-z])';/); return !!m && m[1]>='2026-11-26a' && html.indexOf("var SYSDOC_VER='"+m[1]+"'")>=0; })());
ok('documentation carries D-379 and R-055', /"D-379"/.test(html) && /R-055/.test(html));
report('2026-11-26a: Inspections on file, newest first, with a find box');
