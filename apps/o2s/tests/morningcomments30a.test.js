/* BUILD 2026-10-30a. Tahir, 30 Oct 2026 (Fahim asked to see the daily comments; panel answers):
   a read-only fold "Truck and PO comments today" on the Morning view of Fahim (Plant Manager) and Majid (Production Manager),
   near the bottom, closed, with the count. Lists every PO the daily comment covers that has waited 15 days or more, and any
   newer PO with a comment today. No comment yet: the label No comment today, with yesterday's comment under it, dated.
   Run: node morningcomments30a.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;

const FNS = ['mvComments', 'mvCommentRow', 'mvCommentsFold', 'mvAdd', 'mvShortD', 'mvNice', 'mvEsc', 'mvPl', 'mvFlag', 'mvMore', 'mvTog',
  'dcReasonText', 'dcClock', 'dcRows', 'dcList', 'dcOn', 'dcWrote', 'dcTextHTML', 'dcMetaHTML', '_plDay', '_av'];
const varLine = n => { const m = new RegExp('\\nvar ' + n + '=[^\\n]*').exec(html); if (!m) throw new Error('no var ' + n); return m[0]; };
const SRC = [varLine('DC_DAYS'), varLine('DC_REASONS'), varLine('MV_MON'), 'var MV_OPEN={};'].join('\n') + '\n' + FNS.map(grab).join('\n');

function box(orders, states) {
  const sb = { state: { orders }, Date, Math, JSON, String, Object, Array, RegExp, isNaN, parseInt,
    _tdEsc: x => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    dcState0: o => (o.id in states ? states[o.id] : null),
    acDeferActive: it => (it && it.o && it.o.id === 'G' ? { until: '2026-11-05', by: 'Saad Jamal', reason: 'client' } : null) };
  vm.createContext(sb); vm.runInContext(SRC, sb); return sb;
}
const M = { view: '2026-10-30' };
const c = (date, extra) => Object.assign({ id: 'DC' + date + Math.random().toString(36).slice(2, 6), date, at: date + 'T05:35:00.000Z', by: 'Muhammad Shoaib', kind: 'ship', reason: 'other', note: 'Waiting for packing material from Maxim.' }, extra || {});

/* ---- which POs ---- */
const orders = [
  { id: 'A', po: '22868', client: 'MAXIM AGRI (PVT) LTD', dayComments: [c('2026-10-29'), c('2026-10-30', { copied: true, copiedFrom: { by: 'Muhammad Shoaib', date: '2026-10-29' } })] },
  { id: 'B', po: 'Maxim Old POs', client: 'Maxim', dayComments: [] },
  { id: 'C', po: '00694', client: 'BKK', dayComments: [c('2026-10-29', { kind: 'po', reason: '', note: 'Asked Saad to close the 2 kg.' })] },
  { id: 'D', po: 'NEW1', client: 'Rudolf', dayComments: [c('2026-10-30', { by: 'Saad Jamal', reason: 'truck-committed', time: '16:00', note: 'Truck from Rudolf.' })] },
  { id: 'E', po: 'NEW2', client: 'Syngenta', dayComments: [] },
  { id: 'F', po: 'WAIT', client: 'Engro', dayComments: [] },
  { id: 'G', po: 'DEF', client: 'Fatima', dayComments: [] },
  { id: 'H', po: 'DONE', client: 'Done Co', dayComments: [] },
  { id: 'I', po: 'GONE', client: 'Gone Co', dayComments: [c('2026-10-30', { note: 'Last truck left at 9.' })] },
];
const states = {
  A: { kind: 'ship', days: 22, required: true },
  B: { kind: 'po', days: 121, required: true, label: 'open lines: Lab QC, Production' },
  C: { kind: 'po', days: 18, required: true, label: 'open lines: shipping' },
  D: { kind: 'ship', days: 4, required: false },
  E: { kind: 'ship', days: 9, required: false },
  F: { kind: 'ship', days: 40, required: false, waitsClient: true },
  G: { kind: 'ship', days: 30, required: false, deferred: true },
  H: null,
  I: null,
};
const sb = box(orders, states);
const L = sb.mvComments(M);
const ids = L.map(r => r.o.id).join();
eq('POs listed: 15 d or more, plus newer ones with a comment today; nothing else', ids.split(',').sort().join(), 'A,B,C,D,F,G,I');
ok('a newer PO with no comment today is left out (E, 9 d)', !/E/.test(ids));
ok('a PO with nothing open and no comment is left out (H)', !/H/.test(ids));
eq('order: no comment yet first (oldest first), then written, then waiting for client and deferred', ids, 'B,C,A,D,I,F,G');

/* ---- the rows ---- */
const row = id => sb.mvCommentRow(L.find(r => r.o.id === id));
const a = row('A');
ok('written: the reason and the note', /<b>Other\.<\/b> Waiting for packing material from Maxim\./.test(a));
ok('written: who and when, and copied from', /written 10:35 by Muhammad Shoaib/.test(a) && /copied from Muhammad Shoaib, 29 Oct/.test(a));
ok('written: Ship job and its days on the right', /Ship job · 22 d/.test(a));
ok('written: no No comment today label', !/No comment today/.test(a));
ok('the PO opens its page, view only', /onclick="openOrder\('A'\);return false"/.test(a) && />22868<\/a>/.test(a));
ok('the client name is shortened the Morning view way (MAXIM AGRI (PVT) LTD reads Maxim Agri)', /<\/a> · Maxim Agri<div class="mv-cm">/.test(a));
const cc = row('C');
ok('no comment today: the label', /mv-warn">No comment today/.test(cc));
ok('no comment today: yesterday\'s comment under it, dated, with its writer', /Yesterday, 29 Oct: Asked Saad to close the 2 kg\. · by Muhammad Shoaib/.test(cc));
ok('an open PO shows what its open lines are doing', /open lines: shipping/.test(cc) && /Open PO · 18 d/.test(cc));
const b = row('B');
ok('no comment today or yesterday says so', /No comment today/.test(b) && /none yesterday either/.test(b));
const d = row('D');
ok('truck committed shows the time at the plant', /Truck committed, at the plant by 04:00 PM\./.test(d));
ok('a waiting-for-client PO says no comment is needed', /mv-good">Waiting for client/.test(row('F')) && /no comment needed while the mark stands/.test(row('F')) && !/No comment today/.test(row('F')));
ok('a deferred Ship job says who put it off, until when, and that no comment is needed', /Deferred/.test(row('G')) && /put off by Saad Jamal until 5 Nov; no comment needed until it comes back/.test(row('G')) && !/No comment today/.test(row('G')));
ok('a PO closed since the comment shows nothing open now', /nothing open now/.test(row('I')) && /Last truck left at 9\./.test(row('I')));

/* ---- escaping ---- */
{ const o2 = [{ id: 'X"1', po: '<b>P</b>', client: 'A & B <i>', dayComments: [c('2026-10-30', { note: '<script>x</script>', by: '<u>z</u>' })] }];
  const s2 = box(o2, { 'X"1': { kind: 'ship', days: 20, required: true } }); const r = s2.mvCommentRow(s2.mvComments(M)[0]);
  ok('PO, client, note and writer are escaped', !/<b>P<\/b>|<i>|<script>|<u>/.test(r));
  ok('the id is safe inside the onclick', !/openOrder\('X"1'/.test(r)); }

/* ---- the fold ---- */
const f = sb.mvCommentsFold(M);
ok('one fold called Truck and PO comments today, closed by default', /<details class="mv-more" data-t="Truck and PO comments today"/.test(f) && !/ open>/.test(f.slice(0, 200)));
ok('the heading count: POs listed and comments written; a missing comment is not counted (Tahir, 29 Oct)', /7 POs · 3 written<\/span>/.test(f) && !/not yet/.test(f));
ok('the PO link has its own class, not the Client POs table class mv-po', /class="mv-polink"/.test(a) && !/class="mv-po"/.test(a));
sb.MV_OPEN['Truck and PO comments today'] = true; ok('once opened it stays open on the next draw', / open><summary>/.test(sb.mvCommentsFold(M)));
{ const s3 = box([], {}); const e = s3.mvCommentsFold(M); ok('nothing to list: the fold says so', /none/.test(e) && /No PO has waited 15 days or more, and no comment was written today\./.test(e)); }
{ const s4 = box([{ id: 'Q', po: 'Q', client: 'Q', dayComments: [] }], { Q: { kind: 'ship', days: 15, required: true } });
  ok('exactly 15 days is listed', s4.mvComments(M).length === 1);
  const s5 = box([{ id: 'Q', po: 'Q', client: 'Q', dayComments: [] }], { Q: { kind: 'ship', days: 14, required: false } });
  ok('14 days with no comment is not listed', s5.mvComments(M).length === 0); }
{ const s6 = box([{ id: 'Z', po: 'Z', client: 'Z', dayComments: [c('2026-10-30')] }, { id: 'Y', po: 'Y', client: 'Y', dayComments: [c('2026-10-30')] }], { Y: { kind: 'ship', days: 20, required: true } }); s6.dcState0 = o => { if (o.id === 'Z') throw new Error('boom'); return { kind: 'ship', days: 20, required: true }; };
  let threw = false, L6 = []; try { L6 = s6.mvComments(M); } catch (e) { threw = true; } ok('a PO whose state cannot be worked out does not break the page', !threw);
  eq('...and that PO is left out, even with a comment today; the others stay', L6.map(r => r.o.id).join(), 'Y'); }
{ const s7 = box([{ id: 'W', po: 'W', client: 'W', dayComments: { bad: 1 } }, { id: 'V', po: 'V', client: 'V', dayComments: [] }], { W: { kind: 'ship', days: 20, required: true }, V: { kind: 'ship', days: 20, required: true } });
  let threw = false, L7 = []; try { L7 = s7.mvComments(M); } catch (e) { threw = true; } ok('a broken comment list on one PO does not blank the page', !threw && L7.map(r => r.o.id).join() === 'V'); }

/* ---- wiring ---- */
const fahim = grab('mvPageFahim'), majid = grab('mvPageMajid');
ok('Fahim\'s page has the fold', /comments:mvCommentsFold\(M\)/.test(fahim));
ok('Majid\'s page has the fold', /comments:mvCommentsFold\(M\)/.test(majid));
['mvPageTahir', 'mvPageYawar', 'mvPageSaad', 'mvPageHimayat', 'mvPageIsmaeel'].forEach(n => { try { ok(n + ' does not have it (Tahir chose Fahim and Majid only)', !/mvCommentsFold/.test(grab(n))); } catch (e) { ok(n + ' grabbed', false, e.message); } });
const page = grab('mvPage');
ok('the fold sits after Client POs and before Details', /f\.push\(mvMore\('Client POs'[^\n]*\n\s*if\(o\.comments\) f\.push\(o\.comments\);[^\n]*\n\s*if\(o\.details\)/.test(page));
ok('nothing in the fold writes', !/save\(|logAction\(|state\.[a-zA-Z]+\s*=[^=]/.test(['mvComments', 'mvCommentRow', 'mvCommentsFold'].map(grab).join('\n')));
ok('the changelog has the 30a entry and the build matches', /ver:'2026-10-30a'/.test(html) && /var BUILD_ID='2026-10-30a'/.test(html) && /var SYSDOC_VER='2026-10-30a'/.test(html));
ok('the Guide says it, in the Morning view part and in the daily comment rule', /<b>Truck and PO comments today<\/b>, a fold near the bottom/.test(html) && /read all of the day\\u2019s comments together on their Morning view/.test(html));
process.exitCode = report('30a: comments fold on the Morning view of Fahim and Majid') ? 1 : 0;
