/* BUILD 2026-10-30d. Tahir, 30 Oct 2026: the small remainder close leftovers af, ah, ai, aj, al from the 29c reviews,
   asked as panel questions, shown as the picture page Small Close Leftovers, then rechecked (4 points and 1 gap). D-353.
   (al) a line with nothing delivered goes the normal route; (aj) 7 days from the later of received and entered;
   (af) a reopen card to the closer (small close) or the asker (normal close), the jobs wait from the reopen day;
   (ah, ai) the COO's Morning view rows; (ai) a pack dated on or before the close day may go on a closed line;
   the New for you card once more; Inspect packed reaches QA's Today on a closed line.
   Run: node small30d.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;
const FNS = ['localDateOf', 'calDays', 'evToday', 'lineShortClosed', 'lineShortRequested', 'cpOpenLines', 'scLeft', 'tinyFmt', 'tinyMade',
  'tinyPoAgeDays', 'tinyOpensOn', 'tinyRefusal', 'scReopenNote', 'tinyDay', 'tinyPoStart', 'lineReopenDay', 'batchReopenDay', 'packLineOwes',
  'reopenCardsFor', 'reopenCardHTML', 'reopenSeen', 'scCloseDay', 'latePackOk', 'latePackRefusal', 'latePackNoteHTML', 'shortCloseRefusal', 'scReason',
  'mvCooCloseRows', 'mvRow', 'mvEsc', 'mvShortD', 'mvNice', 'shortClient', 'scAsker', 'scWho', 'reopenShortClose', '_scLine', 'tinyNoticeDue', 'tinySeen',
  'poLinesForBrand', 'brandCanon', 'actTiming', 'latePackLive', 'scLateKg', 'shortCloseGap'];
const SRC = FNS.map(n => grab(n)).join('\n') + '\n' + H.grabTopVar('SHORTCLOSE_REASONS', '[') + '\nvar SHORTCLOSE_SMALL_KG=50; var SHORTCLOSE_TINY_MIN_DAYS=7;\n'
  + /var REOPEN_CLOCK_SKIP=\[[^\]]*\];/.exec(html)[0] + '\nvar MV_MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];';
function box(st, me) {
  const b = { console, Math, JSON, Object, String, Array, RegExp, Number, isFinite, Date, logs: [], toasts: [], saved: 0,
    TODAY: new Date('2026-10-30T09:00:00Z'), state: Object.assign({ role: 'Supply Chain', orders: [], currentUser: me || { name: 'Saad Jamal', username: 'saad' } }, st || {}),
    usersList: [{ username: 'saad', name: 'Saad Jamal', role: 'Supply Chain' }, { username: 'majid', name: 'Abdul Majid', role: 'Production Manager' }, { username: 'tahir', name: 'Tahir Abbas', role: 'COO' }],
    may: () => true, denyRight: () => 'no', toast: m => b.toasts.push(m), logAction: m => b.logs.push(m), save: () => { b.saved++; }, render: () => {},
    nid: p => p + Math.random().toString(36).slice(2, 7), qsEsc: x => String(x), _pe: x => String(x == null ? '' : x), stageOf: () => 'Production', itemWaiting: () => false };
  b.globalThis = b; vm.createContext(b); vm.runInContext(SRC, b); return b; }
const L = (x) => Object.assign({ id: 'L1', brand: 'Max Potash', ordered: 30000, delivered: 29960, packed: 29960, produced: 29960, dispatched: 29960 }, x || {});
const O = (l, x) => Object.assign({ id: 'O1', po: '22868', client: 'MAXIM AGRI (PVT) LTD', received: '2026-09-11', lines: [l] }, x || {});

/* ---- (al) nothing delivered ---- */
{ const b = box(); const l = L({ ordered: 17, delivered: 0, packed: 0, produced: 0, dispatched: 0 }); const o = O(l, { received: '2026-10-01' });
  const w = b.tinyRefusal(o, l);
  ok('(al) a line with nothing delivered is refused, normal route', /^Nothing has been delivered on Max Potash yet\. A line with nothing delivered cannot be closed this way\. A new request goes to the Plant Manager\.$/.test(w), w);
  const l2 = L(); ok('(al) a line with something delivered, 40 left, 49 days old, still qualifies (Maxim 22868)', b.tinyRefusal(O(l2), l2) === '');
  const l3 = L({ ordered: 50, delivered: 48, packed: 48, produced: 48, dispatched: 48 }); ok('(al) BKK 00694 VL-Boron 2 left still qualifies', b.tinyRefusal(O(l3, { received: '2026-10-12' }), l3) === '');
  const l4 = L({ ordered: 17, delivered: 0.4, packed: 0, produced: 0, dispatched: 0 }); ok('(al) 0.4 delivered counts as nothing delivered', /^Nothing has been delivered/.test(b.tinyRefusal(O(l4, { received: '2026-10-01' }), l4))); }

/* ---- (aj) 7 days from the later of received and entered ---- */
{ const b = box();
  eq('(aj) no enteredOn: the received date', b.tinyPoStart({ received: '2026-10-20' }), '2026-10-20');
  eq('(aj) entered later than received: the entry day', b.tinyPoStart({ received: '2026-10-20', enteredOn: '2026-10-27' }), '2026-10-27');
  eq('(aj) entered before received (typed ahead): the received date', b.tinyPoStart({ received: '2026-10-25', enteredOn: '2026-10-20' }), '2026-10-25');
  eq('(aj) no received date: the entry day', b.tinyPoStart({ enteredOn: '2026-10-27' }), '2026-10-27');
  eq('(aj) neither: empty, so the age is not known and the PO is not held back (as 29c)', b.tinyPoAgeDays({}), null);
  const l = L(); const o = O(l, { received: '2026-10-20', enteredOn: '2026-10-27' });
  const w = b.tinyRefusal(o, l);
  eq('(aj) the sentence names both dates and the opening day', w, 'This PO was received on 20 Oct 2026 and entered in O2S on 27 Oct 2026. A small remainder can be closed this way from 3 Nov 2026, 7 days after the later of the 2 dates.');
  const o2 = O(l, { received: '2026-10-27' }); ok('(aj) entered the same day as received: the old sentence', /^This PO was received 3 days ago\./.test(b.tinyRefusal(o2, l)), b.tinyRefusal(o2, l));
  const o3 = O(l, { received: '2026-10-01', enteredOn: '2026-10-22' }); ok('(aj) 8 days after entry: qualifies', b.tinyRefusal(o3, l) === '');
  ok('(aj) order entry saves the day', /ord\.enteredBy=sigStamp\(\); ord\.enteredOn=evToday\(\);/.test(grab('submitPO')));
  ok('(aj) a Data Fix new PO saves the day', /received:dfForm\.received\|\|'',enteredOn:evToday\(\),/.test(grab('dfSubmitPO'))); }

/* ---- (af) reopen: who is told ---- */
{ const mk = (sc) => { const l = L({ shortClose: Object.assign({ approvedAt: '2026-10-31T05:00:00Z', approvedBy: 'Abdul Majid', reasonCode: 'customer_reduced', orderedAtClose: 30000, deliveredAtClose: 29960 }, sc) }); return { l, o: O(l) }; };
  { const t = mk({ requestedBy: 'Saad Jamal', requestedUser: 'saad', requestedRole: 'Supply Chain', approvedBy: 'Saad Jamal', tinyRemainder: true, leftAtClose: 40 });
    const b = box({ role: 'COO', orders: [t.o] }, { name: 'Tahir Abbas', username: 'tahir' }); b.reopenShortClose('O1', 'L1', 'client will lift it');
    ok('(af) a small close reopened by the COO: its closer is to be told', JSON.stringify(t.l.shortClose.reopenNotify) === JSON.stringify({ user: 'saad', name: 'Saad Jamal', role: 'Supply Chain' }), JSON.stringify(t.l.shortClose.reopenNotify));
    ok('(af) the reopen itself is unchanged: reopened, reason, log and audit', !!t.l.shortClose.reopenedAt && t.l.shortClose.reopenedWhy === 'client will lift it' && b.logs.some(x => /REOPENED/.test(x)) && b.saved === 1);
    b.state.currentUser = { name: 'Saad Jamal', username: 'saad' };
    const cards = b.reopenCardsFor(); eq('(af) Saad has 1 card', cards.length, 1);
    const h = b.reopenCardHTML();
    ok('(af) the card names the line, the close, the reopen and the reason', /Reopened by the COO/.test(h) && /Max Potash on PO 22868/.test(h) && /You closed it short on 31 Oct 2026: 40 Kg\/L left at the close, Customer reduced the quantity\./.test(h) && /Tahir Abbas reopened it on/.test(h) && /client will lift it/.test(h), h);
    b.reopenSeen(cards[0].key); eq('(af) after Seen the card is gone', b.reopenCardsFor().length, 0); ok('(af) Seen is logged and saved', b.logs.some(x => /^Read that 22868/.test(x)) && b.saved === 2);
    b.state.currentUser = { name: 'Abdul Majid', username: 'majid' }; eq('(af) nobody else sees it', b.reopenCardsFor().length, 0); }
  { const t = mk({ requestedBy: 'Abdul Majid', requestedUser: 'majid', requestedRole: 'Production Manager', approvedBy: 'Fahim' });
    const b = box({ role: 'COO', orders: [t.o] }, { name: 'Tahir Abbas', username: 'tahir' }); b.reopenShortClose('O1', 'L1', 'x');
    eq('(af) a normal close: the asker is told, not the Plant Manager who approved', t.l.shortClose.reopenNotify && t.l.shortClose.reopenNotify.user, 'majid');
    b.state.currentUser = { name: 'Abdul Majid', username: 'majid' }; ok('(af) the normal-close card says who asked and who approved', /You asked to close it short on .*; Fahim approved it on/.test(b.reopenCardHTML())); }
  { const t = mk({ requestedBy: 'Saad Jamal', approvedBy: 'Fahim' });   /* an old close: name only, no login */
    const b = box({ role: 'COO', orders: [t.o] }, { name: 'Tahir Abbas', username: 'tahir' }); b.reopenShortClose('O1', 'L1', 'x');
    eq('(af) a close with a name only finds the person by name', t.l.shortClose.reopenNotify && t.l.shortClose.reopenNotify.user, 'saad'); }
  { const t = mk({ requestedBy: 'Tahir Abbas', requestedUser: 'tahir', requestedRole: 'COO', approvedBy: 'Tahir Abbas' });
    const b = box({ role: 'COO', orders: [t.o] }, { name: 'Tahir Abbas', username: 'tahir' }); b.reopenShortClose('O1', 'L1', 'x');
    ok('(af) the COO reopening his own close tells nobody', !t.l.shortClose.reopenNotify); }
  { const t = mk({ requestedBy: 'Saad Jamal', requestedUser: 'saad', reopenedAt: '2026-10-01T00:00:00Z' }); const b = box({ orders: [t.o] });
    eq('(af) an old reopen with no notify mark makes no card', b.reopenCardsFor().length, 0); }
  ok('(af) Today draws the card after the New for you card', /h\+=tinyNoticeCard\(\); h\+=reopenCardHTML\(\);/.test(grab('screenToday'))); }

/* ---- (af) the reopen clock ---- */
{ const b = box(); const l = L({ shortClose: { approvedAt: '2026-10-20T05:00:00Z', reopenedAt: '2026-10-29T20:30:00Z' }, prRaised: '2026-09-15' }); const o = O(l);
  eq('(af) reopen day is the Pakistan date (20:30 UTC is the next day)', b.lineReopenDay(l), '2026-10-30');
  const t = b.actTiming({ o, l, label: 'Receive' }); eq('(af) a Receive job of a reopened line waits 0 days on the reopen day, not 45', t && t.days, 0);
  const s = b.actTiming({ o, l, label: 'Ship', shipLines: [] }); ok('(af) Ship keeps its own start', s && s.days > 0, JSON.stringify(s));
  const l2 = L({ prRaised: '2026-09-15' }); const t2 = b.actTiming({ o: O(l2), l: l2, label: 'Receive' }); eq('(af) a line never reopened is unchanged', t2 && t2.days, 45);
  const l3 = L({ shortClose: { approvedAt: '2026-10-29T05:00:00Z' }, prRaised: '2026-09-15' }); eq('(af) a closed line has no reopen day', b.lineReopenDay(l3), '');
  ok('(af) the skip list is Ship, Pack QC, Approve close short, Refused', /var REOPEN_CLOCK_SKIP=\['Ship','Pack QC','Approve close short','Refused'\];/.test(html));
  ok('(af) a Pack job of a batch waits from the reopen day too', /if\(it\.batch&&it\.label==='Pack'\)\{ var _rb=batchReopenDay\(it\.batch\); if\(_rb&&_rb>localDateOf\(c\)\)\{ c=_rb; approx=false; \} \}[\s\S]{0,200}var days=null;/.test(grab('actTiming'))); }

/* ---- (ai) late pack on a closed line ---- */
{ const b = box(); const l = L({ ordered: 30000, packed: 29960, shortClose: { approvedAt: '2026-10-31T05:00:00Z', approvedBy: 'Saad Jamal', reasonCode: 'customer_reduced' } }); const o = O(l);
  eq('(ai) close day is the Pakistan date', b.scCloseDay(l), '2026-10-31');
  ok('(ai) packed 30 Oct, on a line closed 31 Oct: allowed', b.latePackOk(l, '2026-10-30') && b.latePackRefusal(o, l, '2026-10-30') === '');
  ok('(ai) packed on the close day: allowed', b.latePackOk(l, '2026-10-31'));
  eq('(ai) packed after the close day: refused with the reason', b.latePackRefusal(o, l, '2026-11-02'), '22868 · Max Potash was closed short on 31 Oct 2026. Bags packed after that day cannot go on this line. Ask the COO to reopen the line.');
  const lf = L({ ordered: 100, packed: 100, shortClose: { approvedAt: '2026-10-31T05:00:00Z', approvedBy: 'Saad Jamal', reasonCode: 'customer_reduced' } });
  ok('(ai) a fully packed closed line: the old refusal', /^Packing is closed/.test(b.latePackRefusal(O(lf), lf, '2026-10-30')));
  const lo = L(); eq('(ai) an open line: nothing refused', b.latePackRefusal(O(lo), lo, '2026-11-02'), '');
  b.state.orders = [o];
  eq('(ai) the Pack sheet list offers the closed line for a pack date on or before the close day', b.poLinesForBrand('Max Potash', '2026-10-30').length, 1);
  eq('(ai) ...not for a later date', b.poLinesForBrand('Max Potash', '2026-11-02').length, 0);
  eq('(ai) ...and not with no date (other callers, for example Divert)', b.poLinesForBrand('Max Potash').length, 0);
  const dp = grab('doPack');
  ok('(ai) doPack checks the pack date against the close', /var _sc=latePackRefusal\(o,l,d\); if\(_sc\)\{toast\(_sc\);return;\}/.test(dp) && !/shortCloseRefusal\(o,l,'Packing'\)/.test(dp));
  ok('(ai) doPack writes latePacks, a log line and an audit row, only on a closed line, after the pack is recorded', /if\(lineShortClosed\(l\)\)\{ var _lp=\{id:nid\('LP'\)/.test(dp) && dp.indexOf('_lp') > dp.indexOf('state.packingLog=state.packingLog') && /field:'Packed after the close'/.test(dp));
  ok('(ai) the Pack sheet passes its date and labels a closed line', /poLinesForBrand\(packForm\.brand,packForm\.packDate\|\|evToday\(\)\)/.test(html) && /only bags packed on or before that day/.test(html));
  l.latePacks = [{ id: 'LP1', at: '2026-11-02T06:00:00Z', packDate: '2026-10-30', kg: 40, by: 'Muhammad Shoaib' }];
  eq('(ai) the line note', b.latePackNoteHTML(l).replace(/<[^>]+>/g, ''), 'Packed after the close was recorded: 40 Kg/L, packed 30 Oct 2026, entered 2 Nov 2026 by Muhammad Shoaib. The line stays closed short; the bags still ship.');
  ok('(ai) the order sheet shows the note', /latePackNoteHTML\(l\)/.test(html)); }

/* ---- (ah, ai) the COO's Morning view ---- */
{ const lt = L({ shortClose: { tinyRemainder: true, leftAtClose: 40, approvedAt: '2026-10-29T06:00:00Z', approvedBy: 'Saad Jamal', reasonCode: 'customer_reduced' } });
  const lp = L({ id: 'L2', brand: 'Grain Set', latePacks: [{ at: '2026-10-29T07:00:00Z', packDate: '2026-10-28', kg: 19, by: 'Muhammad Shoaib' }] });
  const lx = L({ id: 'L3', shortClose: { tinyRemainder: true, leftAtClose: 2, approvedAt: '2026-10-28T06:00:00Z', approvedBy: 'Saad Jamal' } });
  const b = box({ orders: [O(lt), O(lp, { id: 'O2', po: '22867' }), O(lx, { id: 'O3', po: '00694' })] });
  const h = b.mvCooCloseRows({ day: '2026-10-29' }); const t = h.replace(/<[^>]+>/g, '|');
  ok('(ah) yesterday\'s small close: count, Kg/L, who, reason, link to the report', /1 small remainder closed on 29 Oct · 40 Kg\/L/.test(t) && /Max Potash, 22868 Maxim Agri, by Saad Jamal · Customer reduced the quantity/.test(t) && /rpOpen\(\\?'shortclose\\?'\)/.test(h), t);
  ok('(ah) a close of another day is not counted', !/00694/.test(t));
  ok('(ai) yesterday\'s late pack, with a link to the PO', /1 pack entered late on a closed line · 19 Kg\/L/.test(t) && /Grain Set, 22867/.test(t) && /openOrder\(/.test(h), t);
  eq('(ah) nothing that day: nothing drawn', b.mvCooCloseRows({ day: '2026-10-27' }), '');
  ok('(ah) only on the COO page, under Watching', /mvSec\('Watching',mvWatching\(M\)\+mvCooCloseRows\(M\)\)/.test(grab('mvPageTahir')) && (html.match(/\+mvCooCloseRows\(M\)\)/g) || []).length === 1); }

/* ---- the New for you card once more ---- */
{ const b = box({ tinyCloseSeen: { saad: '2026-10-29T10:00:00Z' } }); ok('the card is due again for Saad, who read the old one', b.tinyNoticeDue() === true);
  b.tinySeen(); ok('Read marks both, so it goes', !!b.state.tinyCloseSeen30d.saad && !!b.state.tinyCloseSeen.saad && b.tinyNoticeDue() === false);
  const c = grab('tinyNoticeCard'); ok('the card says nothing delivered and the later of the 2 dates', /if nothing has been delivered on the line yet/.test(c) && /counted from the later of the day it was received and the day it was entered in O2S/.test(c));
  const bc = box({}, { name: 'Tahir Abbas', username: 'tahir' }); bc.state.role = 'COO'; ok('the COO is still never shown the card', bc.tinyNoticeDue() === false); }

/* ---- Inspect packed on a closed line ---- */
{ const ai = grab('actionItems');
  ok('a closed line still raises Pack QC for bags not yet inspected, then nothing else', /if\(lineShortClosed\(l\)\)\{ if\(l\.shortClose\.reasonCode!=='outside_o2s' && lineToInspect\(o,l\)>0\.5\) items\.push\(\{role:'QA Inspector',o,l,what:'Inspect packed '\+l\.brand\+' \\u2014 '\+o\.po,act:`openPackInspect\('\$\{o\.id\}','\$\{l\.id\}'\)`,label:'Pack QC'\}\); return; \}/.test(ai));
  ok('the Pack QC job for an open line is unchanged', /if\(lineToInspect\(o,l\)>0\.5\) items\.push\(\{role:'QA Inspector',o,l,what:'Inspect packed '/.test(ai.slice(ai.indexOf("if(lineShortClosed(l)){ if(l.shortClose.reasonCode!=='outside_o2s'") + 60))); }

/* ---- review round 1 (30 Oct): the fixes, each run, not read ---- */
{ /* finding 1: a real Pack job carries labAt; it must still wait from the reopen day */
  const l = L({ ordered: 1000, packed: 0, delivered: 0, shortClose: { approvedAt: '2026-10-10T05:00:00Z', reopenedAt: '2026-10-29T05:00:00Z' } });
  const b = box({ orders: [O(l)] });
  const t = b.actTiming({ label: 'Pack', batch: { kind: 'po', po: '22868', lineId: 'L1', brand: 'Max Potash' }, labAt: '2026-10-08' });
  eq('(af) a Pack job with labAt (8 Oct) on a line reopened 29 Oct waits 1 day, not 22', t && t.days, 1);
  const l2 = L({ ordered: 1000, packed: 0, delivered: 0 }); const b2 = box({ orders: [O(l2)] });
  eq('(af) the same Pack job on a line never reopened is unchanged (22 days)', b2.actTiming({ label: 'Pack', batch: { kind: 'po', po: '22868', lineId: 'L1', brand: 'Max Potash' }, labAt: '2026-10-08' }).days, 22); }
{ /* finding 2: a closed line beside a delivered line */
  const lc = L({ ordered: 100, packed: 60, delivered: 60, shortClose: { approvedAt: '2026-10-31T05:00:00Z', approvedBy: 'Saad Jamal' } });
  const b = box({ orders: [O(lc)] }); b.stageOf = () => 'Delivered';
  eq('(ai) a closed line is offered even when its PO reads Delivered (another line delivered)', b.poLinesForBrand('Max Potash', '2026-10-30').length, 1);
  const lo = L({ ordered: 100, packed: 60, delivered: 60 }); const b2 = box({ orders: [O(lo)] }); b2.stageOf = () => 'Delivered';
  eq('(ai) an open line on a Delivered PO is still not offered, as before', b2.poLinesForBrand('Max Potash', '2026-10-30').length, 0); }
{ /* finding 3: the note and the Morning view read the live pack row */
  const mk = (row, closed) => { const l = L({ latePacks: [{ id: 'LP1', at: '2026-10-29T07:00:00Z', packDate: '2026-10-28', kg: 40, by: 'Muhammad Shoaib', closedOn: '2026-10-28', pk: 'PK1' }],
    shortClose: closed ? { approvedAt: '2026-10-28T05:00:00Z' } : { approvedAt: '2026-10-28T05:00:00Z', reopenedAt: '2026-10-30T05:00:00Z' } });
    return box({ orders: [O(l)], packingLog: row ? [row] : [] }); };
  let b = mk({ id: 'PK1', kg: 40 }, true); ok('(ai) a live pack row: the note shows, the line stays closed', /40 Kg\/L, packed 28 Oct 2026, entered 29 Oct 2026 by Muhammad Shoaib, on a line closed short on 28 Oct 2026\. The line stays closed short; the bags still ship\./.test(b.latePackNoteHTML(b.state.orders[0].lines[0]).replace(/<[^>]+>/g, '')));
  b = mk({ id: 'PK1', kg: 0, void: true, voidedKg: 40 }, true); eq('(ai) a voided pack row: no note', b.latePackNoteHTML(b.state.orders[0].lines[0]), ''); eq('(ai) ...and no Morning view row', b.mvCooCloseRows({ day: '2026-10-29' }), '');
  b = mk({ id: 'PK1', kg: 40, reversed: true }, true); eq('(ai) a reversed pack row: no note', b.latePackNoteHTML(b.state.orders[0].lines[0]), '');
  b = mk({ id: 'PK1', kg: 30 }, true); ok('(ai) an amended row: the note and the Morning view show 30, not 40', /: 30 Kg\/L/.test(b.latePackNoteHTML(b.state.orders[0].lines[0])) && /19|30 Kg\/L/.test(b.mvCooCloseRows({ day: '2026-10-29' })) && /· 30 Kg\/L/.test(b.mvCooCloseRows({ day: '2026-10-29' })));
  b = mk({ id: 'PK1', kg: 40 }, false); ok('(ai) after a reopen the note does not say the line stays closed', !/stays closed short/.test(b.latePackNoteHTML(b.state.orders[0].lines[0])) && /Packed after the close was recorded/.test(b.latePackNoteHTML(b.state.orders[0].lines[0])));
  b = mk(null, true); eq('(ai) a pack row that is gone: no note', b.latePackNoteHTML(b.state.orders[0].lines[0]), ''); }
{ /* finding 6: no received date */
  const b = box(); const l = L(); const o = O(l, { received: '', enteredOn: '2026-10-27' });
  eq('(aj) a PO with no received date: a clean sentence from the entry day', b.tinyRefusal(o, l), 'This PO has no received date; it was entered in O2S on 27 Oct 2026. A small remainder can be closed this way from 3 Nov 2026, 7 days after it was entered.');
  const o2 = O(l, { received: '' }); eq('(aj) no received date and no entry day: not held back, as 29c', b.tinyRefusal(o2, l), ''); }
{ /* finding 7: a direct close that replaced a waiting request */
  const l = L({ shortClose: { requestedBy: 'Fahim', approvedBy: 'Fahim', approvedAt: '2026-10-31T05:00:00Z', requestedAt: '2026-10-31T05:00:00Z', poClose: true, reasonCode: 'customer_reduced', orderedAtClose: 30000, deliveredAtClose: 29960,
    request: { by: 'Saad Jamal', user: 'saad', role: 'Supply Chain', at: '2026-10-29T05:00:00Z' } } });
  const b = box({ role: 'COO', orders: [O(l)] }, { name: 'Tahir Abbas', username: 'tahir' }); b.reopenShortClose('O1', 'L1', 'x');
  eq('(af) a direct close that replaced a request: the person who asked is told', l.shortClose.reopenNotify && l.shortClose.reopenNotify.user, 'saad');
  b.state.currentUser = { name: 'Saad Jamal', username: 'saad' }; ok('(af) ...and the card says he asked and who closed it', /You asked to close it short on 29 Oct 2026; Fahim closed it on 31 Oct 2026/.test(b.reopenCardHTML()));
  const l2 = L({ shortClose: { requestedBy: 'Fahim', approvedBy: 'Fahim', approvedAt: '2026-10-31T05:00:00Z', poClose: true, reasonCode: 'customer_reduced', orderedAtClose: 30000, deliveredAtClose: 29960 } });
  const b2 = box({ role: 'COO', orders: [O(l2)], }, { name: 'Tahir Abbas', username: 'tahir' }); b2.usersList.push({ username: 'fahim', name: 'Fahim', role: 'Plant Manager' }); b2.reopenShortClose('O1', 'L1', 'x');
  b2.state.currentUser = { name: 'Fahim', username: 'fahim' }; ok('(af) a direct close by one person: the card says he closed it, not that he asked and approved', /You closed it short on 31 Oct 2026/.test(b2.reopenCardHTML()) && !/approved it/.test(b2.reopenCardHTML())); }

{ /* Tahir, 30 Oct: a line closed as Supplied from stock outside O2S (its bags left outside O2S) */
  const l = L({ ordered: 250, packed: 0, delivered: 0, shortClose: { approvedAt: '2026-10-31T05:00:00Z', approvedBy: 'Fahim Asghar', reasonCode: 'outside_o2s' } }); const o = O(l, { po: 'VG-VC-2609-5466' }); const b = box({ orders: [o] });
  ok('outside O2S: no late pack, even dated before the close', b.latePackOk(l, '2026-10-30') === false && /as Supplied from stock outside O2S, so no bags can be entered on it\. Ask the COO to reopen the line\./.test(b.latePackRefusal(o, l, '2026-10-30')));
  eq('outside O2S: not offered on the Pack sheet', b.poLinesForBrand('Max Potash', '2026-10-30').length, 0);
  ok('outside O2S: not listed as waiting for inspection on the QA screen and dashboard', /if\(lineShortClosed\(l\)&&l\.shortClose\.reasonCode==='outside_o2s'\) return;/.test(grab('linesToInspect')));
  ok('outside O2S: no Inspect packed job (the code skips the reason)', /l\.shortClose\.reasonCode!=='outside_o2s' && lineToInspect\(o,l\)>0\.5/.test(grab('actionItems'))); }
{ /* Tahir, 30 Oct (review finding 4): the shortfall leaves out bags packed late against that close */
  const close = { tinyRemainder: true, approvedAt: '2026-10-31T05:00:00Z', orderedAtClose: 30000, deliveredAtClose: 29960, leftAtClose: 40 };
  const l = L({ ordered: 30000, delivered: 29960, packed: 29960, shortClose: close, latePacks: [{ id: 'LP1', at: '2026-11-02T06:00:00Z', packDate: '2026-10-30', kg: 30, closeAt: close.approvedAt, pk: 'PK1' }] });
  let b = box({ orders: [O(l)], packingLog: [{ id: 'PK1', kg: 30 }] });
  eq('a small close of 40 with 30 packed late: shortfall 10', b.shortCloseGap(l), 10);
  b = box({ orders: [O(l)], packingLog: [{ id: 'PK1', kg: 0, void: true }] }); eq('...the late pack voided: shortfall 40 again', b.shortCloseGap(l), 40);
  const l2 = JSON.parse(JSON.stringify(l)); l2.latePacks[0].closeAt = '2026-09-01T00:00:00Z';
  b = box({ orders: [O(l2)], packingLog: [{ id: 'PK1', kg: 30 }] }); eq('...a late pack of an earlier close does not count against this one', b.shortCloseGap(l2), 40);
  ok('the Closed short report uses the same rule', /var gap=Math\.max\(0, Math\.round\(\(ord-del-\(\(typeof scLateKg==='function'\)\?scLateKg\(l,sc\):0\)\)\*100\)\/100\);/.test(html));
  ok('a late pack records the close it was entered against', /closedOn:scCloseDay\(l\),closeAt:l\.shortClose\.approvedAt,pk:state\.packingLog\[0\]\.id\}/.test(grab('doPack'))); }

/* ---- Guide, rules, changelog, build ---- */
ok('The rules: R-048 says nothing delivered goes the normal way and the later of the 2 dates', /A line with nothing delivered yet cannot be closed this way; it goes the normal way, to the Plant Manager\. The PO must be at least '\+SHORTCLOSE_TINY_MIN_DAYS\+' days old, counted from the later of the day it was received and the day it was entered in O2S\./.test(html));
ok('The rules: a new rule After a line is closed short, R-049', /<h3>After a line is closed short<\/h3>/.test(html) && /'After a line is closed short':'R-049'/.test(html));
ok('My job says nothing delivered cannot be closed this way', /A line with nothing delivered yet cannot be closed this way\. It closes at once\./.test(html));
ok('How the app works: the COO\'s Watching rows', /also lists yesterday\\u2019s small remainder closes and any pack entered late on a closed line \(30d\)/.test(html));
ok('the changelog has the 30d entry and the build matches', /ver:'2026-10-30d'/.test(html) && /var BUILD_ID='2026-10-(30[d-z]|31[a-z])'/.test(html) && /var SYSDOC_VER='2026-10-(30[d-z]|31[a-z])'/.test(html));
ok('System documentation: D-353, LG-42, SC-45', /"id":"D-353"/.test(html) && /"id":"LG-42"/.test(html) && /"id":"SC-45"/.test(html));
process.exitCode = report('30d: small remainder close leftovers') ? 1 : 0;
