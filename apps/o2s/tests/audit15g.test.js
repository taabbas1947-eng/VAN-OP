/* 15g (15 Oct 2026): Tahir's rulings on Part C of the design picture.
   - A line is moving when any PO of the same client and product was packed in the last 7 days.
   - Base short: "Waiting for production, X of Y ready"; the ready part is still judged.
   - Both cards: Pack from base, and a Production run for the rest.
   - A bulk-base run is stalled only after 4 days with no output on that base.
   - Day 7 stuck at packing: Supply Chain gets a job - Close short (Plant Manager approves) or
     Waiting for client (reason + date 1 to 30 days; Supply Chain only). Not stuck until then.
   Run: node audit15g.test.js */
const vm = require('vm');
const H = require('./harness.js');
let pass = 0, fail = 0; const fails = [];
const ok = (n, c, x) => c ? pass++ : (fail++, fails.push(n + (x ? '  [' + x + ']' : '')));
const eq = (n, g, w) => ok(n, g === w, 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w));
const html = H.html;
const TODAY = '2026-10-15';

const consts = (html.match(/var PL_STUCK_NO_OUTPUT_DAYS=[^;]+;/) || [''])[0];
const PL_SRC = consts + '\n' + ['calDays','lineShortClosed','_plPackedOf','plBatchMove','_plDay','plBatchFacts','_plLineOf','plLineWantsBase','plOpenLines','plOpenDemandKg','lineShortRequested','batchClearedKg','plBaseLabKg','plShareKey','plBaseShare','_plFirstOk','_plM','plBaseReady','_plBaseReady0','plClientPOs','lineWaitMark','lineWaitClient','lineWaitOver','plLinePack','packLineOwes','_plCarrier','plBatchClass'].map(n => H.grab(n)).join('\n') + '\nvar _plMemo=null; function poReturnOpen(){ return false; }';
function plBox(state) {
  const s = { console, Date, Math, JSON, Object, Array, String,
    fmt: n => Math.round(n).toLocaleString('en-US'),
    localDateOf: d => String(d).slice(0, 10), evToday: () => TODAY,
    lineBucket: (o, l) => (l.delivered >= l.ordered - 0.5 ? 'Delivered' : 'Production'),
    batchStage: b => b._stage || 'pack',
    batchPackableKg: b => Math.max(0, (+b.producedKg || 0) - (+b.packedKg || 0) - (+b.disposedKg || 0)),
    batchPackNow: b => !b.voided && !b.pool && (b.status !== 'closed' || !!b.stockKept) && (b._stage || 'pack') === 'pack' && ((+b.producedKg || 0) - (+b.packedKg || 0) - (+b.disposedKg || 0)) > 0.5,
    plCanAct: () => true, may: () => true, canView: () => true };
  s.state = Object.assign({ batches: [], orders: [], shiftEntries: [], packingLog: [] }, state || {});
  s.globalThis = s; vm.createContext(s); vm.runInContext(PL_SRC, s); return s;
}
const B = (o) => Object.assign({ id: 'B1', batchNo: 'X1', status: 'open', kind: 'bulk', base: 'NPK', plannedKg: 5000, producedKg: 5000, packedKg: 0, disposedKg: 0, openedDate: '2026-07-28' }, o || {});
const ord = (po, client, lines, extra) => Object.assign({ id: 'O' + po, po, client, received: '2026-08-01', acknowledged: true, lines }, extra || {});
const line = (id, brand, extra) => Object.assign({ id, brand, base: 'NPK', ordered: 10000, packed: 0, delivered: 0 }, extra || {});

/* 1. moving: same client and same product on another PO */
{
  const o1 = ord('22867', 'Maxim', [line('L1', 'Enroot')]);
  const o2 = ord('22868', 'Maxim', [line('L2', 'Enroot')]);
  const o3 = ord('30001', 'Other Co', [line('L3', 'Enroot')]);
  const st = { batches: [B()], orders: [o1, o2, o3], packingLog: [
    { po: '22868', lid: 'L2', brand: 'Enroot', date: '2026-10-12', kg: 500 },
    { po: '30001', lid: 'L3', brand: 'Enroot', date: '2026-10-14', kg: 500 } ] };
  const s = plBox(st);
  const t = s.plLinePack(o1, o1.lines[0], '2026-08-01');
  eq('Enroot packed for Maxim on 22868 counts for 22867: last pack', t.last, '2026-10-12');
  eq('...the PO it was packed on is named', t.lastPo, '22868');
  eq('...3 days, so not stuck', t.days, 3);
  const t3 = plBox({ batches: [B()], orders: [o1, o3], packingLog: [{ po: '30001', lid: 'L3', brand: 'Enroot', date: '2026-10-14', kg: 500 }] }).plLinePack(o1, o1.lines[0], '2026-08-01');
  eq('another client packing the same product does not count', t3.last, '');
  eq('...so the line is judged from the PO / base date', t3.days, calDaysTo('2026-08-01'));
  const s4 = plBox({ batches: [B()], orders: [o1, o2], packingLog: [{ po: '22868', lid: 'L9', brand: 'Other brand', date: '2026-10-14', kg: 500 }] });
  eq('the same client packing a different product does not count', s4.plLinePack(o1, o1.lines[0], '2026-08-01').last, '');
  const s5 = plBox({ batches: [B()], orders: [o1, o2], packingLog: [{ po: '22868', lid: 'L2', brand: 'Enroot', date: '2026-10-12', kg: 500, reversed: true }] });
  eq('a reversed pack does not count', s5.plLinePack(o1, o1.lines[0], '2026-08-01').last, '');
  /* the same PO still matches by line id, not brand */
  const o6 = ord('40000', 'Maxim', [line('L6a', 'Enroot'), line('L6b', 'Enroot')]);
  const s6 = plBox({ batches: [B()], orders: [o6], packingLog: [{ po: '40000', lid: 'L6b', brand: 'Enroot', date: '2026-10-14', kg: 500 }] });
  eq('Tahir: on the same PO, the same product packed on another line counts too', s6.plLinePack(o6, o6.lines[0], '2026-08-01').last, '2026-10-14');
  /* plBatchClass: the bulk batch is not stuck while Maxim's Enroot moves on 22868 */
  const c = s.plBatchClass(st.batches[0]);
  ok('the bulk base is not stuck while the same client and product moves', !c || c.k !== 'stuck', c && c.k);
  const s7 = plBox({ batches: [B()], orders: [o1], packingLog: [] });
  const c7 = s7.plBatchClass(s7.state.batches[0]);
  eq('with no pack for 7+ days it is stuck', c7 && c7.k, 'stuck');
}
function calDaysTo(d) { return Math.round((Date.parse(TODAY + 'T00:00:00Z') - Date.parse(d + 'T00:00:00Z')) / 86400000); }

/* 2. waiting for client: marks are rows with ids; the latest one decides */
const WM = (until, extra) => Object.assign({ id: 'WC' + until, kind: 'wait', until, why: 'Maxim calls off after 25 Oct', by: 'Saad', at: '2026-10-15T05:00:00Z' }, extra || {});
{
  const mk = (marks) => { const o = ord('22867', 'Maxim', [line('L1', 'Enroot', marks ? { waitMarks: marks } : {})]); return plBox({ batches: [B()], orders: [o], packingLog: [] }); };
  let s = mk([WM('2026-10-25')]);
  ok('lineWaitClient: a date in the future is waiting', !!s.lineWaitClient(s.state.orders[0].lines[0]));
  let c = s.plBatchClass(s.state.batches[0]);
  ok('a line waiting for the client is not stuck', !c || c.k !== 'stuck', c && c.k);
  s = mk([WM(TODAY)]);
  ok('...still waiting on the date itself (Tahir: stuck again the day after)', !!s.lineWaitClient(s.state.orders[0].lines[0]));
  s = mk([WM('2026-10-14')]);
  ok('the day after the date it is no longer waiting', !s.lineWaitClient(s.state.orders[0].lines[0]));
  eq('...the wait was over on 15 Oct', s.lineWaitOver(s.state.orders[0].lines[0]), '2026-10-15');
  c = s.plBatchClass(s.state.batches[0]);
  eq('...and is stuck again', c && c.k, 'stuck');
  ok('no marks: not waiting', !plBox({}).lineWaitClient({}));
  ok('a nonsense date never waits forever', !plBox({}).lineWaitClient({ waitMarks: [WM('garbage')] }));
  ok('final review: a fully packed line no longer waits (nobody could end it)', !plBox({}).lineWaitClient({ ordered: 100, packed: 100, waitMarks: [WM('2026-10-25')] }));
  s = mk([WM('2026-10-25'), WM('', { id: 'E1', kind: 'end', at: '2026-10-15T07:00:00Z' })]);
  ok('a later End mark ends the wait early', !s.lineWaitClient(s.state.orders[0].lines[0]));
  eq('...over on the day it was ended', s.lineWaitOver(s.state.orders[0].lines[0]), '2026-10-15');
  s = mk([WM('2026-10-20', { id: 'A', at: '2026-10-15T05:00:00Z' }), WM('2026-11-01', { id: 'B', at: '2026-10-15T06:00:00Z' })]);
  eq('the latest mark decides the date (a change)', s.lineWaitClient(s.state.orders[0].lines[0]).until, '2026-11-01');
  eq('plLinePack carries the wait', !!s.plLinePack(s.state.orders[0], s.state.orders[0].lines[0], '').waitClient, true);
}

/* 3. saving a mark: Supply Chain or COO only; reason 5+; date 1 to 30 days; every mark kept; log and audit */
{
  const SRC = ['_wcFind', '_wcMark', 'saveWaitClient', 'endWaitClient', 'lineWaitMark', 'lineWaitClient'].map(n => H.grab(n)).join('\n');
  const box = (role) => {
    const toasts = [], logs = [];
    const s = { console, Date, Math, JSON, String, toasts, logs,
      TODAY: new Date(TODAY + 'T00:00:00'), evToday: () => TODAY,
      hardRole: (r) => s.state.role === 'COO' || r.includes(s.state.role),
      _uRole: () => ({ by: 'Saad Jamal', user: 'saad', role: s.state.role }),
      _plDay: d => d, toast: m => toasts.push(m), logAction: m => logs.push(m),
      _plLineOf: (o, l) => !o.cancelled && !l.shortClosed && (+l.ordered || 0) - (+l.packed || 0) > 0.5, lineShortRequested: l => !!l.scReq,
      save: () => { s.saved = (s.saved || 0) + 1; }, closeModal: () => {}, render: () => {} };
    s.state = { role, orders: [ord('22867', 'Maxim', [line('L1', 'Enroot')])], audit: [] };
    vm.createContext(s); vm.runInContext(SRC + '\nvar wcForm={};', s); return s;
  };
  const L = s => s.state.orders[0].lines[0];
  const W = s => s.lineWaitClient(L(s));
  let s = box('Production');
  s.saveWaitClient('O22867', 'L1', 'Maxim calls off later', '2026-10-25');
  ok('Production cannot mark waiting for client', !W(s) && /Supply Chain/.test(s.toasts[0]));
  s = box('Plant Manager'); s.saveWaitClient('O22867', 'L1', 'Maxim calls off later', '2026-10-25');
  ok('the Plant Manager cannot either', !W(s));
  s = box('Supply Chain'); s.saveWaitClient('O22867', 'L1', 'abc', '2026-10-25');
  ok('a reason under 5 characters is refused', !W(s) && /at least 5/.test(s.toasts[0]));
  s = box('Supply Chain'); s.saveWaitClient('O22867', 'L1', 'Maxim calls off later', '');
  ok('no date is refused', !W(s) && /Pick the date/.test(s.toasts[0]));
  s = box('Supply Chain'); s.saveWaitClient('O22867', 'L1', 'Maxim calls off later', TODAY);
  ok('today is refused (at least 1 day)', !W(s) && /1 to 30/.test(s.toasts[0]));
  s = box('Supply Chain'); s.saveWaitClient('O22867', 'L1', 'Maxim calls off later', '2026-11-15');
  ok('31 days is refused', !W(s));
  s = box('Supply Chain'); s.saveWaitClient('O22867', 'L1', 'Maxim calls off later', '2026-11-14');
  eq('30 days is accepted', W(s) && W(s).until, '2026-11-14');
  s = box('Supply Chain'); s.saveWaitClient('O22867', 'L1', '  Maxim calls off after 25 Oct  ', '2026-10-16');
  eq('1 day is accepted, the reason trimmed', W(s) && W(s).why, 'Maxim calls off after 25 Oct');
  eq('...who marked it is kept', W(s).by, 'Saad Jamal');
  ok('...the mark is a row with its own id (2 people marking at once are both kept)', /^WC/.test(W(s).id) && L(s).waitMarks.length === 1);
  eq('...saved once', s.saved, 1);
  ok('...the log names the PO, product, date and reason', /22867.*Enroot.*2026-10-16.*Maxim calls off/.test(s.logs[0]));
  ok('...the audit gets a row with the id', s.state.audit[0] && s.state.audit[0].field === 'Waiting for client' && s.state.audit[0].id === W(s).id);
  s.saveWaitClient('O22867', 'L1', 'Moved to 30 Oct by Maxim', '2026-10-30');
  eq('a change keeps the first mark too', L(s).waitMarks.length, 2);
  eq('...the new date stands', W(s).until, '2026-10-30');
  eq('...the audit shows the old date', s.state.audit[0].old, '2026-10-16');
  s.endWaitClient('O22867', 'L1', 'abc');
  ok('ending needs a reason', !!W(s) && /at least 5/.test(s.toasts[s.toasts.length - 1]));
  s.endWaitClient('O22867', 'L1', 'Maxim called off today');
  ok('Supply Chain can end the wait early', !W(s) && L(s).waitMarks.length === 3 && L(s).waitMarks[2].kind === 'end');
  ok('...logged as ended', /Wait for client ended/.test(s.logs[s.logs.length - 1]));
  s.endWaitClient('O22867', 'L1', 'Maxim called off today');
  ok('ending a line that is not waiting is refused', L(s).waitMarks.length === 3 && /not waiting/.test(s.toasts[s.toasts.length - 1]));
  s = box('COO'); s.saveWaitClient('O22867', 'L1', 'Maxim calls off later', '2026-10-25');
  ok('the COO may mark it', !!W(s));
  s.state.role = 'Production'; s.endWaitClient('O22867', 'L1', 'Maxim called off today');
  ok('Production cannot end it', !!W(s));
  s = box('Supply Chain'); L(s).scReq = true; s.saveWaitClient('O22867', 'L1', 'Maxim calls off later', '2026-10-25');
  ok('review: a line already asked to close short cannot be marked waiting', !W(s));
  s = box('Supply Chain'); L(s).packed = 10000; s.saveWaitClient('O22867', 'L1', 'Maxim calls off later', '2026-10-25');
  ok('review: a fully packed line cannot be marked waiting', !W(s));
  ok('nothing writes the old single waitClient field any more', !/l\.waitClient=/.test(html));
}
{ /* 2 people mark the same line at the same moment: the real merge keeps both marks */
  const box = { console, JSON, Object, Array };
  vm.createContext(box); vm.runInContext(['_eq', '_arrId', 'merge3'].map(n => H.grab(n)).join('\n'), box);
  const base = { waitMarks: [] };
  const a = { waitMarks: [WM('2026-10-25', { id: 'WCa', by: 'Saad' })] }, b = { waitMarks: [WM('2026-10-30', { id: 'WCb', by: 'Tahir', at: '2026-10-15T05:00:01Z' })] };
  base.waitMarks = undefined;
  const m = box.merge3({}, a, b);
  eq('both marks survive the merge', (m.waitMarks || []).length, 2);
}

/* 4. the decision sheet renders: both buttons, the date limits */
{
  const SRC = ['openStuckDecision', 'renderStuckDecision'].map(n => H.grab(n)).join('\n');
  const el = { modal: { innerHTML: '' }, modalBg: { classList: { add() {} } } };
  const o = ord('22867', 'Maxim', [line('L1', 'Enroot', { packed: 2000 })]);
  const s = { console, Date, Math, JSON, String, TODAY: new Date(TODAY + 'T00:00:00'), evToday: () => TODAY,
    $: id => el[id], fmt: n => Math.round(n).toLocaleString('en-US'), unitOf: () => 'Kg', shortClient: c => c, _pe: x => String(x), _av: x => String(x), _plDay: d => d,
    plBaseReady: () => ({ kg: 3000, first: '2026-08-01', batches: [] }), plLineWantsBase: () => true, plLineOwnReady: () => null, lineWaitClient: l => (l.waitMarks || [])[0] || null, plLinePack: () => ({ last: '2026-10-01', lastPo: '22868', days: 14 }), closeModal() {} };
  s.state = { orders: [o] }; vm.createContext(s); vm.runInContext(SRC + '\nvar wcForm=null;', s);
  s.openStuckDecision('O22867', 'L1');
  const h = el.modal.innerHTML;
  ok('the sheet is titled for the decision', /Stuck at packing: close short or keep\?/.test(h));
  ok('...it shows what is still to pack', /8,000 Kg<\/b> still to pack/.test(h));
  ok('...and the ready base', /Base ready: 3,000 Kg/.test(h));
  ok('...the last pack on the other PO', /Last packed 2026-10-01 \(PO 22868\)/.test(h));
  ok('...a Close short button that opens the usual request', /openShortClose\('O22867','L1'\)/.test(h));
  ok('...a Waiting for client button', /Waiting for client…/.test(h));
  vm.runInContext("wcForm.open=true; renderStuckDecision()", s);
  const h2 = el.modal.innerHTML;
  ok('Waiting for client opens the reason and date', /id="wc_why"/.test(h2) && /id="wc_until"/.test(h2));
  ok('...the date runs from tomorrow to 30 days', /min="2026-10-16"/.test(h2) && /max="2026-11-14"/.test(h2));
  ok('...and saves through saveWaitClient', /saveWaitClient\(wcForm\.oid,wcForm\.lid,wcForm\.why,wcForm\.until\)/.test(h2));
  s.state.orders[0].lines[0].waitMarks = [{ id: 'W', kind: 'wait', until: '2026-10-25', why: 'call-off later', by: 'Saad', at: '2026-10-15T05:00:00Z' }];
  vm.runInContext("wcForm={oid:'O22867',lid:'L1',why:'',until:'2026-10-25',open:true,edit:true}; renderStuckDecision()", s);
  const h3 = el.modal.innerHTML;
  ok('Change or end: titled, shows the current mark', /Waiting for client: change or end/.test(h3) && /Waiting for client until 2026-10-25<\/b>, marked by Saad/.test(h3));
  ok('...End the wait now and Save new date', /endWaitClient\(wcForm\.oid,wcForm\.lid,wcForm\.why\)/.test(h3) && /Save new date/.test(h3));
  ok('...no Close short button there', !/openShortClose/.test(h3));
}

/* 5. bulk base: stalled only after 4 days with no output on that base */
{
  const SRC = ['calDays', 'baseLastOutput', 'baseStallStart', 'acProduceStallDays'].map(n => H.grab(n)).join('\n');
  const s = { console, Date, Math, JSON, String, localDateOf: d => String(d).slice(0, 10), evToday: () => TODAY };
  s.state = { batches: [{ id: 'B1', kind: 'bulk', base: 'NPK', openedDate: '2026-08-01' }, { id: 'B2', kind: 'bulk', base: 'NPK', openedDate: '2026-09-01' }, { id: 'B3', kind: 'bulk', base: 'UREA', openedDate: '2026-10-14' }, { id: 'B4', kind: 'bulk', base: 'NPK', openedDate: '2026-10-14', voided: true }],
    shiftEntries: [{ batchId: 'B1', date: '2026-10-13', kg: 500 }, { batchId: 'B2', date: '2026-10-14', kg: 0 }, { batchId: 'B3', date: '2026-10-15', kg: 500 }, { batchId: 'B4', date: '2026-10-15', kg: 500 }], productionLog: [] };
  vm.createContext(s); vm.runInContext(SRC, s);
  eq('last output on a base: the newest shift entry on any of its bulk batches', s.baseLastOutput('NPK'), '2026-10-13');
  eq('a voided batch, another base and a shift with 0 Kg do not count', s.baseLastOutput('NPK'), '2026-10-13');
  s.state.batches.push({ id: 'B5', kind: 'bulk', base: 'NPK', openedDate: '2026-10-15' });
  eq('Tahir: opening a new batch is not output', s.baseLastOutput('NPK'), '2026-10-13');
  eq('no bulk batch on the base: none', s.baseLastOutput('XYZ'), '');
  const it = { o: { po: 'P1', received: '2026-08-01' }, l: { id: 'L1', base: 'NPK', rmReady: '2026-08-07' } };
  eq('the run clock is 2 d from the last output, not 68 d from raw material ready', s.acProduceStallDays(it), 2);
  s.state.shiftEntries = [{ batchId: 'B1', date: '2026-10-10', kg: 500 }];
  eq('5 d with no output on the base', s.acProduceStallDays(it), 5);
  s.state.shiftEntries = [];
  eq('a bulk base with no output yet: counted from the PO arriving', s.acProduceStallDays(it), 75);
  s.state.batches.push({ id: 'P', kind: 'po', po: 'P1', lineId: 'L1', openedDate: '2026-10-15', lots: [] });
  eq('a line with its own PO batch keeps the PO-batch clock', s.acProduceStallDays(it), 0);
  ok('the Open Production threshold is still 4 days', /'Open Production':\[4,'Plant Manager'\]/.test(html));
}

/* 6. acEscalation: waiting for client tells nobody, run for real */
{
  const src = H.grab('acEscalation');
  const s = { console, PL_LINE_STUCK_DAYS: 7, labLateBy: () => 0, acProduceStallDays: () => 9, actTiming: () => ({ days: 9 }) };
  vm.createContext(s); vm.runInContext(src, s);
  ok('Pack from base on day 9 escalates to the Plant Manager', (s.acEscalation({ label: 'Pack from base' }) || {}).to === 'Plant Manager');
  eq('...but not while waiting for the client', s.acEscalation({ label: 'Pack from base', waitClient: { until: '2026-10-25' } }), null);
  ok('the rest card stalled 9 d escalates', (s.acEscalation({ label: 'Open Production', restKg: 100 }) || {}).stall === true);
  eq('...but not while the line waits for the client', s.acEscalation({ label: 'Open Production', restKg: 100, waitClient: { until: '2026-10-25' } }), null);
  eq('Stuck at packing is Saad’s own job, it does not escalate', s.acEscalation({ label: 'Stuck at packing' }), null);
}
{ /* the card and the stall clock agree: never counted from before the PO arrived */
  const SRC = ['calDays', 'baseLastOutput', 'baseStallStart', 'acProduceStallDays'].map(n => H.grab(n)).join('\n');
  const s = { console, Date, Math, JSON, String, localDateOf: d => String(d).slice(0, 10), evToday: () => TODAY };
  s.state = { batches: [{ id: 'B1', kind: 'bulk', base: 'NPK', openedDate: '2026-08-01' }, { id: 'BP', kind: 'bulk', base: 'NPK', openedDate: '2026-10-14', disposition: 'byproduct' }, { id: 'PL', kind: 'bulk', base: 'NPK', openedDate: '2026-10-14', pool: true }], shiftEntries: [{ batchId: 'B1', date: '2026-08-15', kg: 500 }, { batchId: 'BP', date: '2026-10-14', kg: 500 }, { batchId: 'PL', date: '2026-10-14', kg: 500 }], productionLog: [] };
  vm.createContext(s); vm.runInContext(SRC, s);
  eq('review: a by-product or pool batch is not output on the base', s.baseLastOutput('NPK'), '2026-08-15');
  eq('review: a PO received yesterday is stalled 1 d, not 61 d', s.acProduceStallDays({ o: { po: 'P9', received: '2026-10-14' }, l: { id: 'L', base: 'NPK' } }), 1);
  ok('actTiming uses the same clock (baseStallStart)', /var _bss2=baseStallStart\(it\.o,l\)/.test(H.grab('actTiming')) && /var _bss=baseStallStart\(o,l\)/.test(H.grab('acProduceStallDays')));
  ok('Tahir: the rest card waiting for the client is calm too', /if\(it\.waitClient&&it\.waitClient\.at\)\{ var _wa2=/.test(H.grab('actTiming')));
  ok('review: a waiting Pack from base card is calm from the day it was marked', /if\(it\.waitClient&&it\.waitClient\.at\)/.test(H.grab('actTiming')));
}
{ /* who counts as the same client */
  const s = plBox({ orders: [ord('A', 'Maxim', []), ord('B', 'Maxim', [], { cancelled: true }), ord('C', '', []), ord('D', '', [])] });
  const m = s.plClientPOs(s.state.orders[0]);
  ok('review: a cancelled PO of the same client does not count', !m.B && m.A);
  const e = s.plClientPOs(s.state.orders[2]);
  ok('review: a PO with no client counts only itself', e.C && !e.D);
}

/* 7. Today: the base jobs of one line, run for real (plLineBaseItems) */
{
  const SRC = PL_SRC + '\n' + ['rmAllows', 'baseLastOutput', 'baseStallStart', 'plLineBaseItems'].map(n => H.grab(n)).join('\n');
  const mk = (st) => { const s = plBox(st); vm.runInContext(['rmAllows', 'baseLastOutput', 'baseStallStart', 'plStuckJob', 'plLineOwnReady', 'plLineOwnStuck', 'plLineBaseItems'].map(n => H.grab(n)).join('\n') + "\nfunction unitOf(){ return 'Kg'; }\n" + (html.match(/var STUCK_JOB_SINCE='[^']+';/) || [''])[0], s); return s; };
  const lot = (q, st) => ({ qty: q, coa: st ? { status: st, approvedDate: '2026-08-01' } : null });
  const base = (kg, extra) => B(Object.assign({ producedKg: kg, plannedKg: kg, status: 'closed', stockKept: true, lots: [lot(kg, 'approved')] }, extra || {}));
  const L1 = (x) => line('L1', 'Enroot', Object.assign({ rmReady: '2026-08-01' }, x || {}));
  const labels = (a) => (a || []).map(x => x.label + (x.restKg != null ? ':' + Math.round(x.restKg) : '')).join(', ');
  /* base covers the line: one Pack from base card, no rest card */
  let s = mk({ batches: [base(12000)], orders: [ord('22867', 'Maxim', [L1()])], packingLog: [{ po: '22867', lid: 'L1', brand: 'Enroot', date: '2026-10-14', kg: 1 }] });
  eq('base covers the line: Pack from base only', labels(s.plLineBaseItems(s.state.orders[0], s.state.orders[0].lines[0])), 'Pack from base');
  /* base short: both cards, the rest = what base does not cover */
  s = mk({ batches: [base(3000)], orders: [ord('22867', 'Maxim', [L1()])], packingLog: [{ po: '22867', lid: 'L1', brand: 'Enroot', date: '2026-10-14', kg: 1 }] });
  eq('base short (3,000 of 10,000): Pack from base and the run for the rest 7,000', labels(s.plLineBaseItems(s.state.orders[0], s.state.orders[0].lines[0])), 'Pack from base, Open Production:7000');
  /* raw material caps the rest */
  s = mk({ batches: [base(3000)], orders: [ord('22867', 'Maxim', [line('L1', 'Enroot', { rmStatus: 'partial', canMakeKg: 4000 })])], packingLog: [{ po: '22867', lid: 'L1', brand: 'Enroot', date: '2026-10-14', kg: 1 }] });
  eq('raw material for 4,000 only: the rest is 1,000, not 7,000', labels(s.plLineBaseItems(s.state.orders[0], s.state.orders[0].lines[0])), 'Pack from base, Open Production:1000');
  /* base with the lab is not "to make" */
  s = mk({ batches: [base(3000), B({ id: 'B2', batchNo: 'X2', producedKg: 5000, plannedKg: 5000, status: 'closed', lots: [lot(5000, null)] })], orders: [ord('22867', 'Maxim', [L1()])], packingLog: [{ po: '22867', lid: 'L1', brand: 'Enroot', date: '2026-10-14', kg: 1 }] });
  let it = s.plLineBaseItems(s.state.orders[0], s.state.orders[0].lines[0]);
  eq('5,000 with the lab: the rest to make is 2,000', labels(it), 'Pack from base, Open Production:2000');
  eq('...the card carries the lab share', Math.round(it[0].pfbShare.lab), 5000);
  /* one base, 2 lines: shared oldest PO first */
  const o1 = ord('22867', 'Maxim', [line('L1', 'Enroot', { ordered: 500, rmReady: '2026-08-01' })], { received: '2026-08-01' });
  const o2 = ord('22900', 'Other', [line('L2', 'Humi', { ordered: 500, rmReady: '2026-08-01' })], { received: '2026-09-01' });
  s = mk({ batches: [base(600)], orders: [o1, o2], packingLog: [] });
  eq('600 ready, 2 lines of 500: the older PO gets 500', Math.round(s.plLineBaseItems(o1, o1.lines[0])[0].pfbShare.ready), 500);
  eq('...the newer PO gets 100 and a run for 400 (and, nothing packed since Sep, Stuck at packing)', labels(s.plLineBaseItems(o2, o2.lines[0])), 'Pack from base, Open Production:400, Stuck at packing');
  eq('Tahir: every order sees all the ready base - the newer card shows 500 ready', Math.round(s.plLineBaseItems(o2, o2.lines[0])[0].pfbShare.ready), 500);
  s = mk({ batches: [base(400)], orders: [o1, o2], packingLog: [] });
  eq('400 ready: the newer PO still sees the base; the run asks for the 500 the base cannot cover', labels(s.plLineBaseItems(o2, o2.lines[0])), 'Pack from base, Open Production:500, Stuck at packing');
  eq('...and the older PO asks for 100', labels(s.plLineBaseItems(o1, o1.lines[0])), 'Pack from base, Open Production:100, Stuck at packing');
  /* stuck at packing on day 7, for Supply Chain */
  s = mk({ batches: [base(12000)], orders: [ord('22867', 'Maxim', [L1()])], packingLog: [{ po: '22867', lid: 'L1', brand: 'Enroot', date: '2026-10-08', kg: 1 }] });
  it = s.plLineBaseItems(s.state.orders[0], s.state.orders[0].lines[0]);
  eq('7 d with nothing packed: Supply Chain gets Stuck at packing', labels(it), 'Pack from base, Stuck at packing');
  eq('...for Supply Chain', it[1].role, 'Supply Chain');
  eq('...from the day it turned stuck (8 + 7 = 15 Oct)', it[1].labAt, '2026-10-15');
  eq('...the card knows the last pack', it[1].pfbLast, '2026-10-08');
  s = mk({ batches: [base(12000)], orders: [ord('22867', 'Maxim', [L1()])], packingLog: [{ po: '22867', lid: 'L1', brand: 'Enroot', date: '2026-10-09', kg: 1 }] });
  eq('6 d: no Supply Chain job yet', labels(s.plLineBaseItems(s.state.orders[0], s.state.orders[0].lines[0])), 'Pack from base');
  s = mk({ batches: [base(12000)], orders: [ord('22867', 'Maxim', [L1()]), ord('22868', 'Maxim', [line('L2', 'Enroot')])], packingLog: [{ po: '22868', lid: 'L2', brand: 'Enroot', date: '2026-10-13', kg: 1 }] });
  eq('Maxim Enroot packed on 22868 2 d ago: 22867 gets no Supply Chain job', labels(s.plLineBaseItems(s.state.orders[0], s.state.orders[0].lines[0])), 'Pack from base');
  s = mk({ batches: [base(3000)], orders: [ord('22867', 'Maxim', [L1({ waitMarks: [WM('2026-10-25')] })])], packingLog: [] });
  it = s.plLineBaseItems(s.state.orders[0], s.state.orders[0].lines[0]);
  eq('waiting for client: no Supply Chain job', labels(it), 'Pack from base, Open Production:7000');
  ok('...both cards carry the wait, so neither escalates', !!it[0].waitClient && !!it[1].waitClient);
  s = mk({ batches: [base(3000)], orders: [ord('22867', 'Maxim', [L1({ shortClosedAt: 'x' })], { cancelled: true })], packingLog: [] });
  eq('a cancelled order: no base jobs', s.plLineBaseItems(s.state.orders[0], s.state.orders[0].lines[0]), null);
  s = mk({ batches: [base(3000)], orders: [ord('22867', 'Maxim', [L1({ packed: 10000 })])], packingLog: [] });
  eq('a fully packed line: no base jobs', s.plLineBaseItems(s.state.orders[0], s.state.orders[0].lines[0]), null);
  ok('actionItems takes the base jobs from plLineBaseItems', /var _bi=plLineBaseItems\(o,l\); if\(_bi\) _bi\.forEach/.test(H.grab('actionItems')));
  ok('the Stuck at packing clock starts on the day the line turned stuck', /case 'Stuck at packing': c=it\.labAt\|\|it\.o\.received/.test(H.grab('actTiming')));
  ok('the Today group counts only the rest for the rest card', /g\.qty\+=\(it\.restKg!=null\)\?Math\.max\(0,it\.restKg\)/.test(html));
  ok('the card says Waiting for production / Waiting for the lab: X of Y ready', /'<b>Waiting for the lab:<\/b> <b>':'<b>Waiting for production:<\/b> <b>'/.test(html));
  ok('the tag says waiting for client until the date', /\\u23f8 waiting for client until '\+_plDay\(_p0\.waitClient\.until\)/.test(html));
  ok('the Supply Chain card says why it is there', /if\(g\.label==='Stuck at packing'\)\{ line=/.test(H.grab('tdCardHTML')));
  ok('Today names the decision', /'Stuck at packing':\{title:'Stuck at packing: close short or keep\?', verb:'Decide'\}/.test(html));
}

/* 7b. second review */
{
  const mk = (st) => { const s = plBox(st); vm.runInContext(['rmAllows', 'baseLastOutput', 'baseStallStart', 'plStuckJob', 'plLineOwnReady', 'plLineOwnStuck', 'plLineBaseItems'].map(n => H.grab(n)).join('\n') + "\nfunction unitOf(){ return 'Kg'; }\n" + (html.match(/var STUCK_JOB_SINCE='[^']+';/) || [''])[0], s); return s; };
  const labs = (a) => a === null ? 'null' : a.map(x => x.label + (x.restKg != null ? ':' + Math.round(x.restKg) : '')).join(', ');
  const lab = B({ id: 'BL', batchNo: 'XL', producedKg: 500, plannedKg: 500, status: 'closed', lots: [{ qty: 500, coa: null }] });
  const o = ord('P1', 'C', [line('L1', 'Enroot', { ordered: 500, rmReady: '2026-08-01' })]);
  let s = mk({ batches: [lab], orders: [o], packingLog: [] });
  eq('nothing ready, 500 with the lab: no run card asks to make it again', labs(s.plLineBaseItems(o, o.lines[0])), '');
  const o2 = ord('P2', 'C', [line('L2', 'Enroot', { ordered: 800, rmReady: '2026-08-01' })]);
  s = mk({ batches: [lab], orders: [o2], packingLog: [] });
  eq('nothing ready, 500 with the lab, 800 needed: a run for 300', labs(s.plLineBaseItems(o2, o2.lines[0])), 'Open Production:300');
  /* a line asked to close short takes no share */
  const ready = B({ id: 'BR', producedKg: 500, plannedKg: 500, status: 'closed', stockKept: true, lots: [{ qty: 500, coa: { status: 'approved', approvedDate: '2026-08-01' } }] });
  const oa = ord('A1', 'C', [line('LA', 'Enroot', { ordered: 500, rmReady: '2026-08-01', shortClose: { requestedAt: 'x' } })], { received: '2026-07-01' });
  const ob = ord('B1', 'D', [line('LB', 'Humi', { ordered: 500, rmReady: '2026-08-01' })], { received: '2026-09-01' });
  s = mk({ batches: [ready], orders: [oa, ob], packingLog: [] });
  eq('the older line asked to close short takes no share: the newer gets the 500', Math.round((s.plBaseShare('NPK')[s.plShareKey(ob, ob.lines[0])] || {}).ready || 0), 500);
  ok('...and has no share itself', !s.plBaseShare('NPK')[s.plShareKey(oa, oa.lines[0])]);
  const ow = ord('W1', 'Maxim', [line('LW', 'Enroot', { ordered: 500, rmReady: '2026-08-01', waitMarks: [WM('2026-10-25')] })], { received: '2026-06-01' });
  s = mk({ batches: [ready], orders: [ow, ob], packingLog: [] });
  eq('Tahir: a line waiting for the client goes to the back - the newer PO gets the 500', Math.round((s.plBaseShare('NPK')[s.plShareKey(ob, ob.lines[0])] || {}).ready || 0), 500);
  eq('...and the waiting line gets what is left (0)', Math.round((s.plBaseShare('NPK')[s.plShareKey(ow, ow.lines[0])] || {}).ready || 0), 0);
  /* plBaseLabKg */
  s = plBox({ batches: [
    B({ id: 'a', producedKg: 300, lots: [{ qty: 200, coa: { status: 'failed' } }, { qty: 100, coa: { status: 'draft' } }] }),
    B({ id: 'b', producedKg: 100, disposedKg: 60, lots: [{ qty: 100, coa: null }] }),
    B({ id: 'c', reconciled: true, lots: [{ qty: 50, coa: null }] }),
    B({ id: 'd', reconciled: true, stockKept: true, producedKg: 40, lots: [{ qty: 40, coa: null }] }),
    B({ id: 'e', pool: true, lots: [{ qty: 70, coa: null }] }),
    B({ id: 'f', disposition: 'byproduct', lots: [{ qty: 70, coa: null }] }),
    B({ id: 'g', kind: 'po', lots: [{ qty: 70, coa: null }] }) ] });
  eq('with the lab: pending lots only, capped by disposal, kept stock in, pools/by-product/PO out', Math.round(s.plBaseLabKg('NPK')), 100 + 40 + 40);
  /* a voided PO batch is not the line's own batch */
  const SRC = ['calDays', 'baseLastOutput', 'baseStallStart'].map(n => H.grab(n)).join('\n');
  const z = { console, Date, Math, JSON, String, localDateOf: d => String(d).slice(0, 10), evToday: () => TODAY };
  z.state = { batches: [{ id: 'B1', kind: 'bulk', base: 'NPK' }, { id: 'V', kind: 'po', po: 'P1', lineId: 'L1', voided: true }], shiftEntries: [{ batchId: 'B1', date: '2026-10-13', kg: 5 }] };
  vm.createContext(z); vm.runInContext(SRC, z);
  eq('a voided PO batch does not switch the line off the base clock', z.baseStallStart({ po: 'P1', received: '2026-08-01' }, { id: 'L1', base: 'NPK' }), '2026-10-13');
  ok('the waiting date is read in Pakistan time', /var _wa=localDateOf\(it\.waitClient\.at\)/.test(H.grab('actTiming')) && /var _wa2=localDateOf\(it\.waitClient\.at\)/.test(H.grab('actTiming')));
  ok('a calm Production run card waiting for the client says so', /g\.label==='Open Production'&&g\.items\.length&&g\.items\.every\(function\(x\)\{ return x\.waitClient; \}\)/.test(H.grab('tdTags')));
}

/* 7c. third review: Tahir's rulings */
{
  const mk = (st) => { const s = plBox(st); vm.runInContext(['rmAllows', 'baseLastOutput', 'baseStallStart', 'plStuckJob', 'plLineOwnReady', 'plLineOwnStuck', 'batchLinesWaiting', 'plLineBaseItems'].map(n => H.grab(n)).join('\n') + "\nfunction unitOf(){ return 'Kg'; }\n" + (html.match(/var STUCK_JOB_SINCE='[^']+';/) || [''])[0], s); return s; };
  const base = (kg) => B({ producedKg: kg, plannedKg: kg, status: 'closed', stockKept: true, lots: [{ qty: kg, coa: { status: 'approved', approvedDate: '2026-08-01' } }] });
  /* a moving long PO: its run card is calm */
  let s = mk({ batches: [base(3000)], orders: [ord('659', 'Syngenta', [line('L1', 'Enrich', { rmReady: '2026-08-01' })])], packingLog: [{ po: '659', lid: 'L1', brand: 'Enrich', date: '2026-10-13', kg: 1 }] });
  let it = s.plLineBaseItems(s.state.orders[0], s.state.orders[0].lines[0]);
  const rest = it.find(x => x.label === 'Open Production');
  ok('packed 2 d ago: the run card is marked moving', rest && rest.moving === true && rest.movingSince === '2026-10-13');
  { const e = { console, PL_LINE_STUCK_DAYS: 7, labLateBy: () => 0, acProduceStallDays: () => 9, actTiming: () => ({ days: 9 }), batchLinesWaiting: b => !!b.w };
    vm.createContext(e); vm.runInContext(H.grab('acEscalation'), e);
    eq('Tahir: no stall alarm while the line is moving', e.acEscalation({ label: 'Open Production', restKg: 100, moving: true }), null);
    eq('a PO batch Pack job whose lines all wait for the client tells nobody', e.acEscalation({ label: 'Pack', batch: { w: true } }), null);
    ok('...otherwise the Pack job still escalates', !!e.acEscalation({ label: 'Pack', batch: { w: false } })); }
  ok('the calm run card counts from the last pack', /if\(it\.moving&&it\.movingSince&&String\(it\.movingSince\)>String\(c\|\|''\)\) c=String\(it\.movingSince\)/.test(H.grab('actTiming')));
  /* Saad's card never says he sat on it for months: from the day this reached the plant */
  s = mk({ batches: [base(12000)], orders: [ord('P1', 'C', [line('L1', 'Enroot', { rmReady: '2026-08-01' })])], packingLog: [{ po: 'P1', lid: 'L1', brand: 'Enroot', date: '2026-07-01', kg: 1 }] });
  it = s.plLineBaseItems(s.state.orders[0], s.state.orders[0].lines[0]).find(x => x.label === 'Stuck at packing');
  eq('a line stuck since July: Saad’s job starts today, not in July', it && it.labAt, '2026-10-15');
  /* after a wait is over, the job starts again from that day */
  s = mk({ batches: [base(12000)], orders: [ord('P1', 'C', [line('L1', 'Enroot', { rmReady: '2026-08-01', waitMarks: [WM('2026-10-25', { at: '2026-10-01T05:00:00Z' }), WM('', { id: 'E', kind: 'end', at: '2026-10-15T10:00:00Z' })] })])], packingLog: [] });
  it = s.plLineBaseItems(s.state.orders[0], s.state.orders[0].lines[0]).find(x => x.label === 'Stuck at packing');
  eq('a wait ended today: the job is back, from today', it && it.labAt, '2026-10-15');
  /* a line packed from its own PO batch gets the same job */
  const pb = B({ id: 'PB', kind: 'po', po: 'LCI1', lineId: 'L1', status: 'closed', stockKept: true, producedKg: 2000, plannedKg: 2000, lots: [{ qty: 2000, coa: { status: 'approved', approvedDate: '2026-09-01' } }] });
  s = mk({ batches: [pb], orders: [ord('LCI1', 'LCI', [line('L1', 'Ferti Rise', { base: 'Ferti Rise', ordered: 2000 })])], packingLog: [] });
  let j = s.plLineOwnStuck(s.state.orders[0], s.state.orders[0].lines[0]);
  eq('Tahir: a line on its own PO batch, nothing packed for 44 d: Supply Chain gets Stuck at packing', j && j.label, 'Stuck at packing');
  eq('...for Supply Chain', j && j.role, 'Supply Chain');
  s = mk({ batches: [pb], orders: [ord('LCI1', 'LCI', [line('L1', 'Ferti Rise', { base: 'Ferti Rise', ordered: 2000, waitMarks: [WM('2026-10-25')] })])], packingLog: [] });
  eq('...not while it waits for the client', s.plLineOwnStuck(s.state.orders[0], s.state.orders[0].lines[0]), null);
  ok('...and its Pack job is calm', !!s.batchLinesWaiting(pb) && s.batchLinesWaiting(pb).until === '2026-10-25');
  s = mk({ batches: [pb], orders: [ord('LCI1', 'LCI', [line('L1', 'Ferti Rise', { base: 'Ferti Rise', ordered: 2000 })])], packingLog: [{ po: 'LCI1', lid: 'L1', brand: 'Ferti Rise', date: '2026-10-12', kg: 1 }] });
  eq('...not while it is moving', s.plLineOwnStuck(s.state.orders[0], s.state.orders[0].lines[0]), null);
  ok('actionItems raises it for every line', /_osj=plLineOwnStuck\(o,l\)/.test(H.grab('actionItems')));
}

/* 7d. final review */
{
  const ai = H.grab('actionItems');
  ok('the old run card carries the wait and the moving flag, so it is calm too', /items\.push\(\{role:'Production',o,l,waitClient:_pk0\?_pk0\.waitClient:null,moving:_mv0/.test(ai));
  const e = { console, actOverdue: () => true, actTiming: () => ({ days: 30 }), attentionOf: () => ({}), batchLinesWaiting: b => b.w ? { until: '2026-10-25' } : false };
  vm.createContext(e); vm.runInContext(H.grab('itemWaiting') + '\n' + H.grab('actUrg'), e); e.lineWaitClient = l => l.w ? { until: '2026-10-25' } : null;
  eq('a job waiting for the client is never urgent, even on an overdue order', e.actUrg({ waitClient: { until: '2026-10-25' }, o: {} }), 3);
  eq('...nor a PO batch Pack job whose lines wait', e.actUrg({ label: 'Pack', batch: { w: true } }), 3);
  eq('...other overdue jobs stay at the top', e.actUrg({ o: {} }), 0);
  ok('a waiting card is not drawn red', /var h='<div class="tdcard'\+\(_gw\?'':/.test(H.grab('tdCardHTML')));
  ok('a waiting PO batch Pack card says so', /g\.label==='Pack'&&g\.items\.length&&g\.items\.every/.test(H.grab('tdTags')));
  ok('a calm run card says the line is moving, and on which PO', /packed '\+_plDay\(g\.items\[0\]\.movingSince\)\+\(g\.items\[0\]\.movingPo/.test(H.grab('tdTags')));
  ok('final review: a waiting job has waited 0 days everywhere (Today, Your people, Departments)', /if\(days!=null&&typeof itemWaiting==='function'&&itemWaiting\(it\)\) days=0;/.test(H.grab('actTiming')));
  ok('...the Ship job of a waiting line is calm too', e.actUrg({ label: 'Ship', shipLines: [{ w: true }], o: {} }) === 3 && e.actUrg({ label: 'Ship', shipLines: [{ w: true }, { w: false }], o: {} }) === 0);
  ok('Your people says on hold, not today, when every job waits', /'on hold':'today'/.test(H.grab('tdYourPeople')));
  ok('the dashboard shows Saad\u2019s reason for a waiting late line', /Waiting for client until '\+_plDay\(w\.until\)/.test(H.grab('dashOpsMetrics')));
  ok('Tahir: no delay-reason job while the line waits for the client', /lineWaitClient\(l\)\) return null;/.test(H.grab('pmDelayLabel')));
  ok('the Stuck tile shows the waiting count beside the oldest age', /L\.k==='stuck'&&plWaitLines\(\)\.length/.test(H.grab('screenPlant')));
  ok('the run card says why it is there (the base totals)', /this run is what the base cannot cover/.test(H.grab('tdCardHTML')));
  ok('Pack from base says when the base is shared', /the same base is shared by '/.test(H.grab('tdCardHTML')));
  ok('Saad’s card says what is ready to pack, not only what is on the order', /ready to pack \('\+fmt\(Math\.round\(one\.pfbRem\|\|0\)\)\+' still on the order\)/.test(H.grab('tdCardHTML')));
  ok('the end toast says what really happens', /shows as stuck again now, and Supply Chain gets the job from today/.test(H.grab('endWaitClient')));
}
{ /* same-date resave refused; the audit old value after an end */
  const SRC = ['_wcFind', '_wcMark', 'saveWaitClient', 'endWaitClient', 'lineWaitMark', 'lineWaitClient'].map(n => H.grab(n)).join('\n');
  const toasts = [];
  const s = { console, Date, Math, JSON, String, TODAY: new Date(TODAY + 'T00:00:00'), evToday: () => TODAY, hardRole: () => true,
    _uRole: () => ({ by: 'Saad Jamal', user: 'saad', role: 'Supply Chain' }), _plDay: d => d, toast: m => toasts.push(m), logAction: () => {},
    _plLineOf: () => true, lineShortRequested: () => false, save: () => {}, closeModal: () => {}, render: () => {} };
  s.state = { role: 'Supply Chain', orders: [ord('22867', 'Maxim', [line('L1', 'Enroot')])], audit: [] };
  vm.createContext(s); vm.runInContext(SRC + '\nvar wcForm={};', s);
  const L = s.state.orders[0].lines[0];
  s.saveWaitClient('O22867', 'L1', 'Maxim calls off later', '2026-10-25');
  s.saveWaitClient('O22867', 'L1', 'Maxim calls off later', '2026-10-25');
  ok('saving the same date again is refused (no false renewal)', L.waitMarks.length === 1 && /already waits/.test(toasts[toasts.length - 1]));
  L.waitMarks[0].at = '2026-10-15T01:00:00Z';
  s.endWaitClient('O22867', 'L1', 'Maxim called off today'); L.waitMarks[1].at = '2026-10-15T02:00:00Z';
  s.saveWaitClient('O22867', 'L1', 'Maxim delayed again', '2026-10-28');
  eq('after an end, the next mark’s audit shows "ended" as the old value', s.state.audit[0].old, 'ended');
}


{ /* a multi-PO batch: a finished line does not hold up the calm */
  const s = plBox({ orders: [ord('A', 'C', [line('LA', 'X', { packed: 10000 })]), ord('B', 'C', [line('LB', 'X', { waitMarks: [WM('2026-10-25')] })])] });
  vm.runInContext(H.grab('batchLinesWaiting'), s);
  ok('a multi-PO batch is calm when its only open line waits', !!s.batchLinesWaiting({ kind: 'multi', allocations: [{ po: 'A', lid: 'LA' }, { po: 'B', lid: 'LB' }] }));
  s.state.orders.push(ord('C', 'C', [line('LC', 'X')]));
  ok('...not when another open line does not wait', s.batchLinesWaiting({ kind: 'multi', allocations: [{ po: 'B', lid: 'LB' }, { po: 'C', lid: 'LC' }] }) === false);
  ok('a PO batch with no order does not crash and is not calm', s.batchLinesWaiting({ kind: 'po', po: 'NONE', lineId: 'L' }) === false);
}

/* 8. Plant lists the lines waiting for the client; nothing written while drawing */
{
  ok('Plant lists Waiting for client under Stuck', /if\(sel\.k==='stuck'\)\{ var WL=plWaitLines\(\);/.test(html) && /<h2>Waiting for client <span class="cnt">/.test(html));
  ok('...it opens even with nothing stuck or held', /x\.k==='stuck'&&\(plHeldBatches\(\)\.length\|\|plWaitLines\(\)\.length\)/.test(H.grab('screenPlant')));
  ok('...Supply Chain and the COO get Change or end there', /openWaitEdit\(/.test(H.grab('screenPlant')) && /hardRole\(\['Supply Chain'\]\)/.test(H.grab('screenPlant')));
  ok('...it says how many times the date was set, amber from 3', /date set '\+x\.n\+' times since/.test(H.grab('screenPlant')) && /x\.n>=3\?'st-late'/.test(H.grab('screenPlant')));
  ok('...and says up front how many lines wait', /order line'\+\(_wn===1\?' is':'s are'\)\+' waiting for the client/.test(H.grab('screenPlant')));
  ok('...only lines still to pack and not closed short', /if\(w&&!lineShortClosed\(l\)&&\(\+l\.ordered\|\|0\)-\(\+l\.packed\|\|0\)>0\.5\) WL\.push/.test(html));
  ok('the rule functions write nothing', !/save\(\)/.test(H.grab('plLinePack') + H.grab('lineWaitClient') + H.grab('plClientPOs') + H.grab('baseLastOutput') + H.grab('renderStuckDecision')));
}

/* 9. Guide, What's new, changelog, BUILD_ID */
{
  const g = H.grab('guideRules');
  ok('Guide: Stuck at packing: close short or keep', /<h3>Stuck at packing: close short or keep<\/h3>/.test(g));
  ok('Guide: Waiting for production', /<h3>Waiting for production<\/h3>/.test(g));
  ok('Guide: the same client and product counts as moving', /same client and the same product/i.test(g));
  ok('What’s new for Supply Chain, Production, Plant Manager and COO', /var _n15g=\{'Supply Chain':/.test(html) && /'Production':_mv15g/.test(html) && /'Plant Manager':_mv15g/.test(html) && /'COO':_mv15g/.test(html));
  ok('changelog has 15g', /ver:'2026-10-15g'/.test(html));
  ok('BUILD_ID is 2026-10-15g or later', /var BUILD_ID='2026-10-15[g-z]';/.test(html));
}

console.log((fails.length ? fails.map(f => '  FAIL  ' + f).join('\n') + '\n' : '') + '15g: stuck at packing, waiting for client, both cards: ' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exitCode = 1;
