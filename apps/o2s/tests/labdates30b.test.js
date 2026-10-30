/* BUILD 2026-10-30b. Himayat (QCM) asked, Tahir ruled 30 Oct 2026 (panel answers):
   1. the lab's first step on Today (Lab COA test and draft, Assign sample) counts its waiting days from the lot's own production date,
      the date Production already types in Log output for that shift; nothing new is entered;
   2. Review COA counts from the day the analyst finished, Approve COA from the day the reviewer finished.
   Live case: HG26047 opened 26 Oct; L4 made 28 Oct and L5 made 29 Oct both showed "waiting 4 d" on 30 Oct and were escalated.
   Run: node labdates30b.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;

const sb = { Date, Math, JSON, String, Object, Array, RegExp, isNaN, parseInt,
  evToday: () => '2026-10-30', TODAY: new Date('2026-10-30T06:00:00Z'),
  calDays: (a, b) => Math.round((Date.parse(String(b).slice(0, 10)) - Date.parse(String(a).slice(0, 10))) / 86400000),
  itemWaiting: () => false, truckClockStart: () => ({ c: null, approx: true }), shipReadySince: () => null, lotsFor: () => [], lotAvail: () => 0,
  baseStallStart: () => null, batchLinesWaiting: () => null, localDateOf: x => String(x).slice(0, 10), daysOver: () => 0, labLateBy: () => 0, state: { role: 'COO' } };
vm.createContext(sb);
vm.runInContext(['labStageSince', 'actTiming'].map(grab).join('\n'), sb);

/* ---- labStageSince ---- */
const coa = (an, rv) => ({ analyst: { date: an || '' }, reviewer: { date: rv || '' } });
eq('Lab COA: the lot date', sb.labStageSince('2026-10-28', null, 'Lab QC'), '2026-10-28');
eq('Assign sample: the lot date', sb.labStageSince('2026-10-28', null, 'Assign sample'), '2026-10-28');
eq('Review: the day the analyst finished (time cut off)', sb.labStageSince('2026-10-26', coa('2026-10-29 11:34'), 'Review'), '2026-10-29');
eq('Review with no analyst date: the lot date', sb.labStageSince('2026-10-26', coa(''), 'Review'), '2026-10-26');
eq('Approve: the day the reviewer finished', sb.labStageSince('2026-10-26', coa('2026-10-29 11:34', '2026-10-30 12:06'), 'Approve'), '2026-10-30');
eq('Approve with no reviewer date: the analyst date, then the lot date', sb.labStageSince('2026-10-26', coa('2026-10-29 11:34', ''), 'Approve') + ' ' + sb.labStageSince('2026-10-26', coa('', ''), 'Approve'), '2026-10-29 2026-10-26');
eq('no usable date at all: empty, so the batch dates are used as before', sb.labStageSince('', null, 'Lab QC'), '');
eq('a lot back from rework reaches the lab on the day rework was done', sb.labStageSince('2026-10-01', null, 'Lab QC', { at: '2026-10-05T09:00:00Z', doneAt: '2026-10-29T08:00:00Z' }), '2026-10-29');
eq('a reworked lot keeps the rework date once the Lab Rep saves a draft (review fix)', sb.labStageSince('2026-10-01', { status: 'draft', analyst: { date: '' } }, 'Lab QC', { at: '2026-10-05T09:00:00Z', doneAt: '2026-10-29T08:00:00Z' }), '2026-10-29');
eq('a reworked lot already analysed: Review counts from the analyst date, not the rework date', sb.labStageSince('2026-10-01', { status: 'analysed', analyst: { date: '2026-10-30 09:00' } }, 'Review', { doneAt: '2026-10-29T08:00:00Z' }), '2026-10-30');
eq('rework not done yet: still the lot date (the job is Production\'s then)', sb.labStageSince('2026-10-01', null, 'Lab QC', { at: '2026-10-05T09:00:00Z' }), '2026-10-01');
eq('a re-issued certificate (draft that supersedes) counts from its re-issue date', sb.labStageSince('2026-10-01', { supersedes: { rev: 0 }, issueDate: '2026-10-28', analyst: { date: '' } }, 'Lab QC'), '2026-10-28');
eq('an ordinary draft keeps the lot date, not its draft date', sb.labStageSince('2026-10-01', { issueDate: '2026-10-28', analyst: { date: '' } }, 'Lab QC'), '2026-10-01');
eq('Review after a re-issue: the new analyst date', sb.labStageSince('2026-10-01', { supersedes: { rev: 0 }, issueDate: '2026-10-28', analyst: { date: '2026-10-29 10:00' } }, 'Review'), '2026-10-29');
eq('a broken date is ignored', sb.labStageSince('28/10/2026', coa('soon'), 'Review'), '');

/* ---- actTiming: the live case ---- */
const B = { batchNo: 'HG26047', openedDate: '2026-10-26' };
const t = (it) => sb.actTiming(it);
eq('before (no lotAt): L4 counted from the batch open date, 4 d', t({ batch: B, label: 'Lab QC' }).days, 4);
eq('HG26047-L4, made 28 Oct: waiting 2 d', t({ batch: B, label: 'Lab QC', lotAt: '2026-10-28' }).days, 2);
eq('HG26047-L5, made 29 Oct: waiting 1 d', t({ batch: B, label: 'Lab QC', lotAt: '2026-10-29' }).days, 1);
eq('HG26048-L1, made 29 Oct, batch opened 30 Oct: waiting 1 d, not 0', t({ batch: { openedDate: '2026-10-30' }, label: 'Lab QC', lotAt: '2026-10-29' }).days, 1);
eq('a closed batch no longer hides an old lot behind its close date', t({ batch: { openedDate: '2026-10-01', closedDate: '2026-10-29' }, label: 'Lab QC', lotAt: '2026-10-20' }).days, 10);
eq('Review from the analyst date', t({ batch: B, label: 'Review', lotAt: sb.labStageSince('2026-10-26', coa('2026-10-29 11:34'), 'Review') }).days, 1);
ok('with a lot date the count is exact, not marked as approximate', t({ batch: B, label: 'Review', lotAt: '2026-10-29' }).approx === false);
ok('without one, Review stays approximate as before', t({ batch: B, label: 'Review' }).approx === true);
eq('a lot dated in the future counts as 0, never negative', t({ batch: B, label: 'Lab QC', lotAt: '2026-11-02' }).days, 0);
eq('created is the lot date', t({ batch: B, label: 'Lab QC', lotAt: '2026-10-28' }).created, '2026-10-28');

/* ---- every lab job carries its own date ---- */
const ai = grab('actionItems');
ok('each lot unit carries its production date', /prov:l\.prov,date:l\.date\|\|''\}\)\):\[\{id:'',no:\(b\.batchNo\|\|''\),coa:b\.coa,rework:b\.rework,date:''\}\]/.test(ai));
ok('Lab COA job: lotAt from the lot date (or rework done, or re-issue)', /role:'Lab Rep',batch:b,lid:u\.id,lotAt:labStageSince\(u\.date,u\.coa,'Lab QC',u\.rework\),what:'Lab COA/.test(ai));
ok('Review COA job: lotAt from the analyst date', /role:'AQCM',batch:b,lid:u\.id,lotAt:labStageSince\(u\.date,u\.coa,'Review'\),what:'Review COA/.test(ai));
ok('Approve COA job: lotAt from the reviewer date', /role:'QCM',batch:b,lid:u\.id,lotAt:labStageSince\(u\.date,u\.coa,'Approve'\),what:'Approve COA/.test(ai));
ok('a COA sent back keeps its own date (the day it was sent back)', /role:'AQCM',batch:b,lid:u\.id,labAt:_rt\.at,what:'Review COA again/.test(ai) && /role:'Lab Rep',who:_rtWho,batch:b,lid:u\.id,labAt:_rt\.at/.test(ai));
ok('Assign sample job (new lab flow): lotAt from the lot date', /lotAt:labStageSince\(u\.date,u\.coa,'Assign sample',u\.rework\),what:'Assign sample/.test(grab('labV2Items')));
ok('the leave cover check counts Review and Approve the same way as Today, a COA sent back from the day it was sent back', /actTiming\(\{batch:b,label:label,labAt:\(coaOpenReturn\(c\)\|\|\{\}\)\.at\|\|undefined,lotAt:labStageSince\(u!==b\?u\.date:'',c,label\)\}\)/.test(html));
eq('a COA sent back counts from the day it was sent back, before the lot date (the labAt branch wins)', t({ batch: B, label: 'Review', labAt: '2026-10-29', lotAt: '2026-10-26' }).days, 1);
ok('nothing in labStageSince writes', !/save\(|logAction\(|state\.[A-Za-z_]+\s*=[^=]/.test(grab('labStageSince')));

/* ---- Guide and changelog ---- */
ok('the Guide says it, under Lab in How the app works', /counts its waiting days from the lot\\u2019s own production date/.test(grab('guideHow')));
ok('the changelog has the 30b entry and the build matches', /ver:'2026-10-30b'/.test(html) && /var BUILD_ID='2026-10-(30[b-z]|31[a-z])'/.test(html) && /var SYSDOC_VER='2026-10-(30[b-z]|31[a-z])'/.test(html));
ok('the UNFIT lot job (Plant Manager, label Review) is not changed: no lotAt', /items\.push\(\{role:'Plant Manager',batch:b,lid:u\.id,what:'UNFIT lot — '/.test(ai));
process.exitCode = report('30b: lab waiting days from each lot\'s own date') ? 1 : 0;
