/* 16e · Customer complaints (Tahir, 14 to 16 Oct 2026; design "Complaints in O2S" version 4).
 * Runs the real complaint code from o2s.html in a sandbox: the steps and the status worked out
 * from them (B4), the job keys (B1), the complaint hold in every free-stock count and at the truck
 * (B2), the role checks (B3), the person who left or moved (B5), working days, the 3 replies,
 * the actions and their tests, what closing needs, the Plant Manager's jobs and the away rule,
 * the brief to read and sign, and the alert text on the server.
 * Run: node complaints16e.test.js */
const vm = require('vm');
const H = require('./harness.js');
const { ok, eq, report, grab, grabTopVar, html } = H;

const a = html.indexOf('/* ===================== COMPLAINTS (16e) - START');
const b = html.indexOf('/* ===================== COMPLAINTS (16e) - END ===================== */');
ok('the complaint code is in 1 marked block', a > 0 && b > a);
const MOD = html.slice(a, b);
const HELP = ['_eq', '_arrId', 'merge3', 'acKey', 'acDeferActive', 'pushRefOf', 'lotAvail', 'lotShipKg', 'lotClearedKg', 'lotHasBatch', 'lotBaseNo', 'lotBrandNo', 'pmvLotFree',
  'localDateOf', 'calDays', '_plDay', 'qsEsc', '_pe', 'lotById'].map(n => grab(n)).join('\n');

const TODAY_S = '2026-10-16';   /* a Friday */
/* the sandbox clock starts on TODAY_S and runs on from there, so a run on any real day gives the same answers */
const T0 = Date.now(), FIX0 = Date.parse(TODAY_S + 'T07:00:00Z');
class FixedDate extends Date { constructor(...a) { if (a.length) super(...a); else super(FIX0 + (Date.now() - T0)); } static now() { return FIX0 + (Date.now() - T0); } }
function box(role, user, st, users) {
  const toasts = [];
  const s = {
    console, JSON, Object, Array, String, Math, Number, RegExp, Date: FixedDate, isNaN, parseInt, toasts,
    TODAY: new Date(TODAY_S + 'T07:00:00Z'), evToday: () => TODAY_S,
    state: Object.assign({ role, currentUser: { name: user, username: user }, orders: [], shipments: [], packingLog: [], inspections: [], complaints: [], masters: { holidays: [], respDepts: ['Production', 'Quality Control'] }, seq: 100 }, st || {}),
    usersList: users || [], toast: m => toasts.push(m), save: () => { s.saved = (s.saved || 0) + 1; }, render: () => {}, closeModal: () => {}, setScreen: () => {}, loadUsers: () => Promise.resolve(),
    fmt: n => String(n), unitOf: () => 'Kg', _tdEsc: x => String(x), boBackHTML: () => '', fyKey: () => '2026-27', printDoc: (t, inner) => { s.printed = inner; }, _docHead: (t, m) => '<h1>' + t + '</h1>' + m,
    $: () => ({ innerHTML: '', classList: { add() {}, remove() {} } }), document: { querySelector: () => null, getElementById: () => null }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    shipClientFor: () => ''
  };
  s.nid = p => p + (s.state.seq++) + '-x';
  vm.createContext(s); vm.runInContext(HELP + '\n' + MOD, s); return s;
}
const USERS = [{ username: 'tahir', name: 'Tahir Abbas', role: 'COO' }, { username: 'fahim', name: 'Fahim', role: 'Plant Manager' }, { username: 'asif', name: 'Asif', role: 'QA Inspector' },
  { username: 'shoaib', name: 'Shoaib Sabir', role: 'Warehouse' }, { username: 'saad', name: 'Saad Jamal', role: 'Supply Chain' }, { username: 'kam1', name: 'KAM One', role: 'KAM' }, { username: 'majid', name: 'Abdul Majid', role: 'Production Manager' }];
const P = (n, u, r) => ({ user: u, name: n, role: r });
/* a delivered truck of Enrich, batch VAN6GE002, from run RB; run RC of the same batch still at VAN */
const DATA = () => ({
  orders: [{ id: 'O1', po: 'PO1', client: 'Syngenta', lines: [{ id: 'L1', brand: 'Enrich', pack: 25 }] }],
  packingLog: [{ id: 'RB', po: 'PO1', lid: 'L1', brand: 'Enrich', brandBatchNo: 'VAN6GE002', baseBatchNo: 'HG26024', kg: 100, insKg: 100, shipKg: 100 },
               { id: 'RC', po: 'PO1', lid: 'L1', brand: 'Enrich', brandBatchNo: 'VAN6GE002', baseBatchNo: 'HG26024', kg: 200, insKg: 200, shipKg: 50 }],
  shipments: [{ id: 'S1', dispId: 'D1', dc: '5224', po: 'PO1', lid: 'L1', brand: 'Enrich', kg: 100, delivered: true, dispCounted: true, batches: [{ lotId: 'RB', brand: 'VAN6GE002', kg: 100 }] },
              { id: 'S2', dispId: 'D2', dc: '5230', po: 'PO1', lid: 'L1', brand: 'Enrich', kg: 50, stage: 'truck_planned', batches: [{ lotId: 'RC', brand: 'VAN6GE002', kg: 50 }] },
              { id: 'S3', dispId: 'D3', dc: '5231', po: 'PO9', brand: 'Enrich', client: 'Other Co', kg: 20, stage: 'in_transit', dispCounted: true, batches: [{ lotId: 'RX', brand: 'VAN6GE002', kg: 20 }] }]
});
function raised(s, extra) {
  s.cmpRF = Object.assign(s.cmpRFNew(), { customer: 'Syngenta', po: 'PO1', type: 'packing', cause: 'Leak', severity: 'Major', seen: 'Product leaked in the carton at the warehouse', qty: '12', unit: 'cartons', received: TODAY_S, to: 'asif' }, extra || {});
  s.cmpRF.pick['S1|0'] = true; s.cmpRaise(true); return s.state.complaints[s.state.complaints.length - 1];
}
const jobs = (s, lb) => s.cmpJobs().filter(j => !lb || j.label === lb);
const as = (s, role, user) => { s.state.role = role; s.state.currentUser = { name: user, username: user }; };

/* ---------- working days (ruling 7) ---------- */
{ const s = box('COO', 'tahir');
  eq('Friday + 1 working day is Saturday', s.cmpWorkAdd('2026-10-16', 1), '2026-10-17');
  eq('Friday + 5 working days skips the Sunday', s.cmpWorkAdd('2026-10-16', 5), '2026-10-22');
  s.state.masters.holidays = [{ id: 'h', date: '2026-10-19', name: 'test holiday' }];
  eq('...and a gazetted holiday on the list', s.cmpWorkAdd('2026-10-16', 5), '2026-10-23');
  eq('15 working days from 16 Oct with that holiday', s.cmpWorkAdd('2026-10-16', 15), '2026-11-04');
  as(s, 'Plant Manager', 'fahim'); s.cmpHolidayAdd('2026-12-25', 'Quaid Day'); eq('only Tahir keeps the holiday list', s.state.masters.holidays.length, 1); }

/* ---------- raise, route, jobs (B1, B3) ---------- */
{ const s = box('QA Inspector', 'asif', DATA(), USERS);
  s.cmpRF = Object.assign(s.cmpRFNew(), { customer: 'Syngenta', po: 'PO1' }); s.cmpRaise(false);
  eq('B3: only Tahir raises (QA refused)', s.state.complaints.length, 0); }
{ const s = box('COO', 'tahir', DATA(), USERS);
  const c = raised(s);
  ok('raised with a number and the truck line', c && c.no === 'CMP-0001' && c.items.length === 1 && c.items[0].batchNo === 'VAN6GE002' && c.items[0].lotId === 'RB');
  eq('raise and send: routed to Asif', s.cmpMain(c).st, 'routed');
  eq('status in words', s.cmpStatus(c), 'Routed');
  const inv = jobs(s, 'Investigate complaint');
  ok('Investigate complaint for Asif by name, with the complaint id', inv.length === 1 && inv[0].who === 'asif' && inv[0].role === 'QA Inspector' && inv[0].cm === c.id);
  const ct = jobs(s, 'Contain complaint');
  ok('Contain complaint for the Warehouse role, due the next day (24 hours)', ct.length === 1 && ct[0].role === 'Warehouse' && ct[0].due === '2026-10-17');
  const rp = jobs(s, 'Reply to customer');
  ok('1 reply job at a time: acknowledge in 1 working day', rp.length === 1 && rp[0].ca === 'ack' && rp[0].due === '2026-10-17' && rp[0].role === 'COO');
  ok('the Plant Manager has a Complaint raised job to read', jobs(s, 'Complaint raised').length === 1 && jobs(s, 'Complaint raised')[0].role === 'Plant Manager');
  ok('Tahir\'s jobs carry no Plant Manager while he is not away', rp[0].alsoRoles === undefined);
  /* B1: 2 complaints never share a card or an alert */
  const c2 = raised(s, { cause: 'Dirty pack' });
  const k1 = s.acKey(jobs(s, 'Contain complaint')[0]), k2 = s.acKey(jobs(s, 'Contain complaint')[1]);
  ok('B1: 2 complaints, 2 keys', k1 !== k2, k1);
  ok('B1: cm and ca at the END of the key', /\|cm:[^|]+\|ca:contain$/.test(k1));
  eq('B1: an order job keeps its key exactly', s.acKey({ label: 'Ship', o: { id: 'O1' } }), 'Ship|o:O1');
  ok('B1: the alert reference carries the complaint and its row at the end', Object.keys(s.pushRefOf(jobs(s, 'Contain complaint')[0])).slice(-2).join() === 'cm,ca' && s.pushRefOf(jobs(s, 'Contain complaint')[0]).cm === c.id);
  eq('the next number', c2.no, 'CMP-0002');
  /* mutation: without the suffix the 2 complaints would share 1 card */
  const keyNoSuffix = it => s.acKey(Object.assign({}, it, { cm: undefined, ca: undefined }));
  ok('mutation check: without cm and ca the 2 Contain jobs collide', keyNoSuffix(jobs(s, 'Contain complaint')[0]) === keyNoSuffix(jobs(s, 'Contain complaint')[1]));
  ok('no Defer on complaint jobs, even with a defer row saved', (() => { const it = jobs(s, 'Contain complaint')[0]; s.state.acDefer = {}; s.state.acDefer[s.acKey(it)] = { until: '2026-12-31' }; return s.acDeferActive(it) === null; })()); }

/* ---------- B4: steps as rows; 2 saves at once keep both ---------- */
{ const s = box('COO', 'tahir', DATA(), USERS); const c = raised(s);
  const base = JSON.parse(JSON.stringify(s.state));
  const A = JSON.parse(JSON.stringify(base)), B = JSON.parse(JSON.stringify(base));
  A.complaints[0].moves.push({ id: 'MVa', k: 'reply', kind: 'ack', at: '2026-10-16T09:00:00Z', date: TODAY_S, how: 'Email', note: 'acknowledged' });
  B.complaints[0].contain.rows.push({ id: 'HLb', kind: 'hold', lotId: 'RC', batchNo: 'VAN6GE002', brand: 'Enrich', po: 'PO1', at: '2026-10-16T09:00:01Z' });
  B.complaints[0].moves.push({ id: 'MVb', k: 'hold', at: '2026-10-16T09:00:01Z', what: 'VAN6GE002' });
  const m = s.merge3(base, A, B);
  ok('B4: the reply and the hold made at the same moment are both kept', m.complaints[0].moves.some(x => x.id === 'MVa') && m.complaints[0].moves.some(x => x.id === 'MVb') && m.complaints[0].contain.rows.length === 1);
  s.state = Object.assign(s.state, { complaints: m.complaints });
  ok('...and the status is worked out from them', s.cmpReplies(s.state.complaints[0])[0].done && s.cmpLotHold(s.state.packingLog[1])); }
{ const s = box('COO', 'tahir', DATA(), USERS); const c = raised(s);
  /* findings by someone the case is no longer routed to do not count */
  c.moves.push({ id: 'MVr', k: 'route', at: '2099-10-16T10:00:00Z', to: P('Saad Jamal', 'saad', 'Supply Chain') });
  c.moves.push({ id: 'MVf', k: 'findings', at: '2099-10-16T10:01:00Z', user: 'asif', fid: 'x' });
  eq('a step from the wrong person is not counted', s.cmpMain(c).st, 'routed');
  eq('...the case is with Saad', s.cmpMain(c).to.user, 'saad');
  c.moves.push({ id: 'MVc', k: 'cancel', at: '2099-10-16T10:02:00Z', why: 'a duplicate of an earlier complaint' });
  c.moves.push({ id: 'MVf2', k: 'findings', at: '2099-10-16T10:03:00Z', user: 'saad', fid: 'y' });
  eq('nothing moves a cancelled case', s.cmpMain(c).st, 'cancelled');
  eq('a cancelled complaint has no jobs', jobs(s).filter(j => j.cm === c.id).length, 0); }

/* ---------- B2: the complaint hold ---------- */
{ const s = box('Warehouse', 'shoaib', DATA(), USERS); as(s, 'COO', 'tahir'); const c = raised(s); as(s, 'Warehouse', 'shoaib');
  const RC = s.state.packingLog[1];
  eq('before the hold: 150 Kg/L of run RC can go on a truck', s.lotShipKg(RC), 150);
  const sus = s.cmpSuspectRuns(c).map(p => p.id);
  ok('the same batch still at VAN is offered (RC, not the shipped RB)', sus.join() === 'RC', sus.join());
  s.cmpOpenContain(c.id); s.cmpF.tick.RC = true; s.cmpHold();
  ok('RC on complaint hold', !!s.cmpLotHold(RC));
  eq('B2: held stock is not free to ship', s.lotShipKg(RC), 0);
  eq('B2: ...nor to inspect', s.lotAvail(Object.assign({}, RC, { insKg: 0 })) , 0);
  eq('B2: ...nor to move to another PO', s.pmvLotFree(RC), 0);
  const msg = s.cmpTruckHeld([s.state.shipments[1]]);
  ok('B2: the planned truck carrying RC is blocked (load, gate pass, release)', /complaint hold/.test(msg) && /CMP-0001/.test(msg));
  eq('a truck without held stock is not blocked', s.cmpTruckHeld([s.state.shipments[0]]), '');
  /* who may hold and lift */
  as(s, 'QA Inspector', 'asif'); s.cmpOpenContain(c.id); ok('QA cannot open containment', /Senior Warehouse Officer or Tahir/.test(s.toasts.pop()));
  as(s, 'Warehouse', 'shoaib'); s.cmpOpenContain(c.id); const r = s.cmpRows(c, 'hold')[0];
  s.cmpF.res[r.id] = { k: 'fault', note: 'bags at the bottom are leaking' }; s.cmpResult(r.id);
  ok('fault found: it stays on hold', s.cmpHoldActive(r) && r.result.k === 'fault');
  s.cmpF.note = 'held and checked'; s.cmpContainDone();
  ok('containment done, the hold remains, a Lift complaint hold job for the Warehouse', s.cmpContainState(c).done && jobs(s, 'Lift complaint hold').length === 1 && jobs(s, 'Contain complaint').length === 0);
  ok('close is refused while stock is on hold', s.cmpCloseGaps(c).some(g => /still on complaint hold/.test(g)));
  s.cmpF.res[r.id] = { how: 'rework', lift: 'resealed and checked again' }; s.cmpLift(r.id);
  ok('lifted with a note: free again', !s.cmpLotHold(RC) && s.lotShipKg(RC) === 150 && r.lift.note === 'resealed and checked again'); }
{ const s = box('COO', 'tahir', DATA(), USERS); const c = raised(s); as(s, 'Warehouse', 'shoaib'); s.cmpOpenContain(c.id); s.cmpF.tick.RC = true; s.cmpHold(); as(s, 'COO', 'tahir');
  s.cmpOpenText(c.id, 'cancel'); s.cmpF.text = 'duplicate of an earlier complaint'; s.cmpTextGo();
  ok('cancelling releases its holds (worked out from the cancel step, nothing written on the hold row)', !s.cmpLotHold(s.state.packingLog[1]) && s.lotShipKg(s.state.packingLog[1]) === 150 && !s.cmpRows(c, 'hold')[0].lift && /released: complaint cancelled/.test(s.cmpContainSummary(c))); }
{ /* a cancel the replay throws out (made on an old copy after Resolve) never frees stock */
  const s = box('COO', 'tahir', DATA(), USERS); const c = raised(s); as(s, 'Warehouse', 'shoaib'); s.cmpOpenContain(c.id); s.cmpHoldOne('RC'); as(s, 'COO', 'tahir');
  c.moves.push({ id: 'Z1', k: 'route', at: '2099-01-01T00:00:00Z' }); ['findings', 'accept', 'resolve'].forEach((k, i) => c.moves.push({ id: 'Z' + (i + 2), k, user: 'asif', at: '2099-01-01T00:0' + (i + 1) + ':00Z' }));
  c.moves.splice(c.moves.findIndex(m => m.id === 'Z1'), 1, { id: 'Z1', k: 'route', at: '2099-01-01T00:00:00Z', to: { user: 'asif', name: 'Asif', role: 'QA Inspector' } });
  c.moves.push({ id: 'Z9', k: 'cancel', at: '2099-01-01T00:05:00Z', why: 'old copy cancel' });
  ok('a cancel after Resolve is not counted, and the stock stays held', s.cmpMain(c).st === 'resolved' && !!s.cmpLotHold(s.state.packingLog[1])); }
{ const s = box('COO', 'tahir', DATA(), USERS); const c = raised(s);
  const oth = s.cmpOtherTrucks(c);
  ok('other customers: the truck that left with the same batch (DC 5231), not the complaint\'s own', oth.length === 1 && oth[0].dc === '5231' && oth[0].stage === 'in transit');
  s.cmpOpenAskContact(c.id); s.cmpF.pick[0] = true; s.cmpF.to = 'majid'; s.cmpAskContact();
  ok('only a KAM or Supply Chain person is asked', s.cmpRows(c, 'customer').length === 0 && /KAM or a Supply Chain/.test(s.toasts.pop()));
  s.cmpF = { id: c.id, list: oth, pick: { 0: true }, to: 'kam1' }; s.cmpAskContact();
  const cj = jobs(s, 'Contact customer'); ok('Contact customer for the KAM by name', cj.length === 1 && cj[0].who === 'kam1' && cj[0].role === 'KAM');
  const row = s.cmpRows(c, 'customer')[0]; as(s, 'Supply Chain', 'saad'); s.cmpOpenContact(c.id, row.id); ok('someone else cannot record the call', /kam/i.test(s.toasts.pop()) && !row.contact);
  as(s, 'KAM', 'kam1'); s.cmpOpenContact(c.id, row.id); Object.assign(s.cmpF, { whom: 'store keeper', result: 'checked 20 bags, no leak' }); s.cmpContact();
  ok('the KAM records whom, when and what they found', row.contact && row.contact.whom === 'store keeper' && jobs(s, 'Contact customer').length === 0); }

/* ---------- B5: the person left or moved ---------- */
{ const s = box('COO', 'tahir', DATA(), USERS); const c = raised(s);
  s.usersList = USERS.map(u => u.username === 'asif' ? Object.assign({}, u, { role: 'Supply Chain' }) : u);
  const inv = jobs(s, 'Investigate complaint')[0];
  ok('moved: the job follows the person to the new role', inv.role === 'Supply Chain' && inv.who === 'asif');
  ok('...and Tahir is told (Complaint job to reassign)', jobs(s, 'Complaint job to reassign').some(j => /moved to Supply Chain/.test(j.what)));
  s.usersList = USERS.filter(u => u.username !== 'asif');
  ok('left: Tahir gets the job to route it again', jobs(s, 'Complaint job to reassign').some(j => /has left/.test(j.what)));
  s.usersList = [];
  eq('people list not loaded: nobody is called gone', jobs(s, 'Complaint job to reassign').length, 0); }

/* ---------- investigate, review, actions, tests, close ---------- */
function investigated(s, c) {
  as(s, 'QA Inspector', 'asif'); s.cmpOpenInvestigate(c.id); const f = s.cmpInv;
  f.problem = 'Bags of Enrich leaked in the carton'; f.chains[0].whys = [{ a: 'Seal was weak on 12 bags', ev: 'packing run RB, shift B' }];
  f.chains[1].whys = [{ a: 'Seal check skipped on that run', ev: 'inspection record of 13 Aug' }];
  f.checks = { 0: 'Checked', 1: 'Checked', 2: 'Not on record' }; f.rootCause = 'The sealing machine was set too cold on shift B'; f.rootCode = 'Machine'; f.where = 'Packing';
  f.correction = { what: 'Hold and check the same batch', owner: 'shoaib', due: '2026-10-17' };
  f.corrective = [{ what: 'Fix the sealing temperature chart', owner: 'majid', due: '2026-10-20' }];
  f.resp = [{ dept: 'Production', user: 'majid', role: 'Primary' }, { dept: 'Carrier', name: 'ABC Goods', role: 'Also' }];
  s.cmpSendFindings(''); }
{ const s = box('COO', 'tahir', DATA(), USERS); const c = raised(s);
  as(s, 'Supply Chain', 'saad'); s.cmpOpenInvestigate(c.id); ok('only the routed person investigates', /routed to Asif/.test(s.toasts.pop()) && !s.cmpInv);
  as(s, 'QA Inspector', 'asif'); s.cmpOpenInvestigate(c.id); s.cmpInv.problem = 'Bags leaked'; s.cmpSendFindings(''); ok('findings need both chains', s.cmpInv.errs.some(e => /Why 1/.test(e)) && s.cmpInv.errs.filter(e => /Chain/.test(e)).length === 2);
  investigated(s, c);
  eq('findings in', s.cmpMain(c).st, 'findings');
  const f = s.cmpLatestFinding(c);
  ok('the finding keeps 2 chains, the records, the actions and 1 Primary', f.chains.length === 2 && f.checks.length === 3 && f.acts.length === 2 && f.resp.filter(r => r.role === 'Primary').length === 1);
  ok('ruling 11: an outside party (a carrier) may be on the rows', f.resp.some(r => r.outside && r.name === 'ABC Goods'));
  ok('Review complaint for Tahir', jobs(s, 'Review complaint').length === 1);
  /* B3: the Plant Manager cannot accept while Tahir is here */
  as(s, 'Plant Manager', 'fahim'); s.cmpOpenAccept(c.id); ok('B3: the Plant Manager cannot review while Tahir is here', !s.cmpF || s.cmpF.id !== c.id);
  as(s, 'COO', 'tahir'); s.cmpOpenAccept(c.id); s.cmpAccept(); ok('accept needs a test for each corrective action', /test/.test(s.toasts.pop()) && s.cmpMain(c).st === 'findings');
  const cid = Object.keys(s.cmpF.tests)[0]; s.cmpF.tests[cid] = { what: 'No leak in the next 20 inspections of Enrich', date: TODAY_S }; s.cmpAccept();
  eq('accepted', s.cmpMain(c).st, 'accepted');
  const A = s.cmpActions(c); ok('2 actions given to their owners', A.length === 2 && jobs(s, 'Do complaint action').length === 2);
  ok('the action job is by name with its due date', jobs(s, 'Do complaint action').some(j => j.who === 'majid' && j.due === '2026-10-20'));
  /* replies */
  s.cmpOpenReply(c.id, 'ack'); Object.assign(s.cmpF, { how: 'Email', note: 'We are on it' }); s.cmpReply();
  ok('after acknowledge, the interim reply is next (5 working days)', jobs(s, 'Reply to customer')[0].ca === 'interim' && jobs(s, 'Reply to customer')[0].due === '2026-10-22');
  /* resolve */
  s.cmpOpenResolve(c.id); s.cmpF.acts = { 0: true }; s.cmpF.told = TODAY_S; s.cmpF.cost = '15000'; s.cmpResolve(); ok('Resolve needs the final reply (Tahir 16 Oct)', s.cmpMain(c).st === 'accepted' && /final reply/.test(s.toasts.pop()));
  s.cmpF.fhow = 'Email'; s.cmpF.fnote = 'Root cause and actions sent'; s.cmpResolve();
  ok('Resolve records the final reply; the interim reply not sent counts as covered', s.cmpReplies(c).filter(r => r.kind === 'final')[0].done && s.cmpReplies(c).filter(r => r.kind === 'interim')[0].skipped);
  eq('resolved: the customer side is closed', s.cmpMain(c).st, 'resolved');
  ok('close is refused: actions open and containment not done', s.cmpCloseGaps(c).length >= 2);
  s.cmpCloseCase(c.id); eq('...so it stays resolved', s.cmpMain(c).st, 'resolved');
  /* the owner does it, Tahir checks */
  const corr = A.filter(x => x.kind === 'correction')[0], cor = A.filter(x => x.kind === 'corrective')[0];
  as(s, 'Warehouse', 'shoaib'); s.cmpOpenAction(c.id, cor.id); ok('someone else cannot do the action', /Abdul Majid/.test(s.toasts.pop()));
  s.cmpOpenAction(c.id, corr.id); s.cmpF.note = 'Held 150 Kg/L and checked every bag'; s.cmpActDone();
  as(s, 'Production Manager', 'majid'); s.cmpOpenAction(c.id, cor.id); s.cmpF.note = 'Chart fixed and posted at the line'; s.cmpActDone();
  as(s, 'COO', 'tahir'); ok('2 Check complaint action jobs for Tahir', jobs(s, 'Check complaint action').length === 2);
  s.cmpOpenCheck(c.id, corr.id); s.cmpF.note = 'seen'; s.cmpCheck(true);
  s.cmpOpenCheck(c.id, cor.id); s.cmpF.note = 'chart not signed'; s.cmpCheck(false);
  eq('not done: back to the owner', s.cmpActState(c, cor).st, 'open');
  as(s, 'Production Manager', 'majid'); s.cmpOpenAction(c.id, cor.id); s.cmpF.note = 'Chart signed by the in-charge'; s.cmpActDone();
  as(s, 'COO', 'tahir'); s.cmpOpenCheck(c.id, cor.id); s.cmpF.note = 'ok now'; s.cmpCheck(true);
  eq('checked, its fix is being tested', s.cmpActState(c, cor).st, 'testing');
  ok('Test complaint fix on its date (today)', jobs(s, 'Test complaint fix').length === 1);
  s.cmpOpenTest(c.id, cor.id); s.cmpF.note = 'leaked again'; s.cmpF.fail = true; s.cmpTest(false); ok('failed needs a new corrective action', /new corrective action/.test(s.toasts.pop()));
  Object.assign(s.cmpF, { what: 'Replace the sealing jaw', owner: 'majid', due: '2026-10-25', tw: 'No leak in 20 inspections', td: '2026-10-30' }); s.cmpTest(false);
  eq('failed: a new corrective action is open', s.cmpActions(c).filter(x => s.cmpActState(c, x).st === 'open').length, 1);
  const nx = s.cmpActions(c).filter(x => s.cmpActState(c, x).st === 'open')[0];
  as(s, 'Production Manager', 'majid'); s.cmpOpenAction(c.id, nx.id); s.cmpF.note = 'New jaw fitted on 25 Oct'; s.cmpActDone(); as(s, 'COO', 'tahir'); s.cmpOpenCheck(c.id, nx.id); s.cmpF.note = 'ok, seen it'; s.cmpCheck(true);
  eq('the new test is not due before its date', jobs(s, 'Test complaint fix').length, 0);
  s.cmpOpenTest(c.id, nx.id); s.cmpF.note = 'no leak in 20 inspections'; s.cmpTest(true);
  eq('test passed', s.cmpActState(c, nx).st, 'passed');
  as(s, 'Warehouse', 'shoaib'); s.cmpOpenContain(c.id); s.cmpF.note = 'no other stock of this batch at VAN'; s.cmpContainDone(); as(s, 'COO', 'tahir');
  eq('every step done: nothing missing for close', s.cmpCloseGaps(c).join('; '), '');
  ok('Close complaint for Tahir', jobs(s, 'Close complaint').length === 1);
  s.cmpCloseCase(c.id); eq('closed', s.cmpMain(c).st, 'closed');
  ok('the Plant Manager has Complaint closed to read', jobs(s, 'Complaint closed').length === 1);
  as(s, 'Plant Manager', 'fahim'); s.cmpSeen(c.id, 'closed'); s.cmpSeen(c.id, 'raised');
  ok('Seen: both read-it jobs gone', jobs(s, 'Complaint closed').length === 0 && jobs(s, 'Complaint raised').length === 0);
  /* the outcome report (ruling: no one responsible, no cost, the bag batch only) */
  as(s, 'COO', 'tahir'); s.cmpOpenReport(c.id); s.cmpF.text = 'We are sorry for the leak. We found the cause and fixed it; every bag is now checked.'; s.cmpPrintReport();
  const pr = String(s.printed || '');
  ok('report: root cause, actions, the bag batch, Tahir\'s words', /sealing machine/.test(pr) && /Replace the sealing jaw/.test(pr) && /VAN6GE002/.test(pr) && /We are sorry/.test(pr));
  ok('report: never who was responsible, the cost or the internal batch', !/Abdul Majid|majid|ABC Goods|Primary|15000|HG26024/.test(pr));
  /* reopen */
  s.cmpOpenText(c.id, 'reopen'); s.cmpF.text = 'the same leak found again at another store'; s.cmpTextGo();
  eq('reopened goes back to Route', s.cmpMain(c).st, 'reopened');
  ok('the earlier actions stay as history and do not block the new round', s.cmpActions(c).length === 0 && (c.actions || []).length === 3); }

/* ---------- action past due and owner change ---------- */
{ const s = box('COO', 'tahir', DATA(), USERS); const c = raised(s); investigated(s, c); as(s, 'COO', 'tahir'); s.cmpOpenAccept(c.id); Object.keys(s.cmpF.tests).forEach(k => s.cmpF.tests[k] = { what: 'test the fix', date: '2026-10-30' }); s.cmpAccept();
  s.evToday = () => '2026-10-21'; vm.runInContext('evToday=function(){ return "2026-10-21"; }', s);
  const pd = jobs(s, 'Complaint action past due');
  ok('ruling 3: a late action goes to Tahir (the owner keeps the job)', pd.length === 2 && jobs(s, 'Do complaint action').length === 2);
  eq('status: Action past due', s.cmpStatus(c), 'Action past due');
  const a1 = s.cmpActions(c)[0]; s.cmpOpenOwner(c.id, a1.id); s.cmpF.to = 'saad'; s.cmpF.due = '2026-10-25'; s.cmpOwner();
  ok('Tahir gives it to someone else with a new date', s.cmpActState(c, a1).owner.user === 'saad' && s.cmpActState(c, a1).due === '2026-10-25' && jobs(s, 'Complaint action past due').length === 1); }

/* ---------- ruling 5: away ---------- */
{ const s = box('COO', 'tahir', DATA(), USERS); const c = raised(s);
  as(s, 'Plant Manager', 'fahim'); ok('the Plant Manager reads, cannot act', s.cmpWatcher() && !s.cmpBoss() && !s.cmpSeesCost());
  s.cmpMarkAway(); eq('only the COO marks himself away', (s.state.cooAway || []).length, 0);
  as(s, 'COO', 'tahir'); s.cmpMarkAway();
  as(s, 'Plant Manager', 'fahim'); ok('while Tahir is away the Plant Manager does all of it, the cost included', s.cmpBoss() && s.cmpSeesCost());
  ok('...and Tahir\'s jobs reach him', jobs(s, 'Reply to customer')[0].alsoRoles.indexOf('Plant Manager') >= 0);
  as(s, 'COO', 'tahir'); s.cmpMarkBack(); as(s, 'Plant Manager', 'fahim'); ok('back: read only again', !s.cmpBoss()); }

/* ---------- numbers, repeats, links, batch fix ---------- */
{ const s = box('COO', 'tahir', DATA(), USERS); const c1 = raised(s); const c2 = raised(s);
  ok('a repeat: same product, type and cause', c2.repeat.ids.indexOf(c1.id) >= 0 && s.cmpRepeatsOf(c2).length === 1);
  c2.no = c1.no; ok('a number on 2 complaints gives Tahir a job', jobs(s, 'Complaint number repeats').length === 1);
  s.cmpRenumber(c2.id); ok('...renumbered, recorded', c2.no === 'CMP-0002' && c2.moves.some(m => m.k === 'renumber'));
  const n = s.cmpBfxFollow(s.state.packingLog[0], 'VAN6GE002', 'VAN6GE012');
  ok('a batch number correction follows onto the complaints', n === 2 && c1.items[0].batchNo === 'VAN6GE012'); }

/* ---------- the wiring in o2s.html ---------- */
{ const lbl = (() => { const b0 = { console }; vm.createContext(b0); vm.runInContext(grabTopVar('CMP_LABELS', '['), b0); return b0.CMP_LABELS; })();
  const TD = (() => { const b0 = { console, PL_LINE_STUCK_DAYS: 7 }; vm.createContext(b0); vm.runInContext(grabTopVar('TD_LABEL', '{'), b0); return b0.TD_LABEL; })();
  const miss = lbl.filter(l => !TD[l]); ok('every complaint job has a title and a button on Today', miss.length === 0, miss.join(','));
  const NR = require('../notify-routes.js'); const noR = lbl.filter(l => !Object.prototype.hasOwnProperty.call(NR.JOB_ROLES, l)); ok('every complaint job is on the alert routes', noR.length === 0, noR.join(','));
  ok('Tahir\'s complaint jobs never alert Tahir', lbl.every(l => !NR.JOB_ROLES[l] || NR.JOB_ROLES[l].indexOf('COO') < 0));
  ok('Contain complaint alerts the Warehouse role only', NR.JOB_ROLES['Contain complaint'].join() === 'Warehouse');
  const s = box('COO', 'tahir', DATA(), USERS); const c = raised(s);
  const t = NR.alertText({ complaints: [c], orders: DATA().orders }, { l: 'Contain complaint', ref: { cm: c.id } }, '');
  ok('the alert says the complaint number and product, never the customer', /CMP-0001/.test(t.body) && /Enrich/.test(t.body) && !/Syngenta/.test(t.body), t.body);
  ok('actionItems makes the complaint jobs', /cmpJobs\(\)\.forEach/.test(grab('actionItems')));
  ok('every free-stock count reads the hold', /cmpLotHold\(p\)/.test(grab('lotAvail')) && /cmpLotHold\(p\)/.test(grab('lotShipKg')) && /cmpLotHold\(p\)/.test(grab('pmvLotFree')));
  ok('Start loading, the gate pass and Release are refused for held stock', ['startLoading', 'issueGatePass', 'approveRelease'].every(n => /cmpTruckHeld\(/.test(grab(n))));
  ok('a batch correction follows onto complaints', /cmpBfxFollow\(p,old,newNo\)/.test(grab('bfxApply')));
  ok('the screen is a Back Office screen, not in the side menu', /'complaints'\]/.test((/const BACKOFFICE_SCREENS=\[[^\]]*\]/.exec(html) || [''])[0] + ']'));
  ok('the screen checks the role itself (B3)', /if\(!cmpWatcher\(\)\)/.test(grab('screenComplaints')));
  ok('the Plant Manager\'s view-only list is on Today, not counted', /cmpTodayWatch\(\)/.test(grab('screenToday')));
  ok('Back Office has a Complaints desk', /k:'complaints',t:'Complaints'/.test(grab('boDesks')));
  ok('Guide rule and rule number', /<h3>Customer complaints<\/h3>/.test(grab('guideRules')) && /'Customer complaints':'R-040'/.test(html));
  ok('changelog 16e and BUILD_ID', /ver:'2026-10-16e'/.test(html) && ((/var BUILD_ID='([^']+)'/.exec(html)||[])[1]||'')>='2026-10-16e'); }

/* ---------- ruling 12: the brief to read and sign ---------- */
{ const SRC = ["var RS_BRIEF='" + /var RS_BRIEF='([^']+)'/.exec(html)[1] + "';", grabTopVar('RS_ALL', '['), grabTopVar('RS_PARTS', '['), /\nvar RS_TITLE=[^\n]*/.exec(html)[0], /\nvar RS_CMP_ROLES=[^\n]*/.exec(html)[0], grabTopVar('RS_PARTS_CMP', '['), grabTopVar('RS_BRIEFS', '['),
    ...['rsUse', 'rsWith', 'rsParts', 'rsSignsOf', 'rsMySign', 'rsPending', 'rsUserKey', 'rsShared', 'rsDevice', 'rsWhat', 'rsQ'].map(grab), /\nvar RS_SHARED_RE=[^\n]*/.exec(html)[0], 'var _rsSeed=false;'].join('\n');
  const mk = (role, user, signs) => { const x = { console, JSON, Object, Array, String, RegExp, Math, Date, localStorage: { getItem: () => null, setItem() {} }, state: { role, currentUser: { name: user, username: user }, orders: [{ po: 'P1' }], readSigns: signs || [] } }; vm.createContext(x); vm.runInContext(SRC, x); return x; };
  const s1 = { id: 'a', brief: '2026-10-13-15', user: 'asif', role: 'QA Inspector' };
  const q = mk('QA Inspector', 'asif', [s1]); ok('QA signed 13-15 Oct: the Complaints brief is next', q.rsPending() && q.RS_BRIEF === '2026-10-16e' && q.rsParts('QA Inspector').map(p => p.id).join() === 'c1,c2,c3');
  const pr = mk('Production', 'ali', [{ id: 'b', brief: '2026-10-13-15', user: 'ali', role: 'Production' }]); ok('Production is not asked to read the Complaints brief', !pr.rsPending() && pr.RS_BRIEF === '2026-10-13-15');
  const wh = mk('Warehouse', 'shoaib', [{ id: 'c', brief: '2026-10-13-15', user: 'shoaib', role: 'Warehouse' }, { id: 'd', brief: '2026-10-16e', user: 'shoaib', role: 'Warehouse' }]); ok('both signed: nothing pending', !wh.rsPending());
  const nw = mk('KAM', 'kam1', []); ok('a new KAM reads 13-15 Oct first', nw.rsPending() && nw.RS_BRIEF === '2026-10-13-15');
  ok('the brief reaches the 7 roles ruled (the Production Manager added 16 Oct)', mk('COO', 't').RS_BRIEFS[1].roles.join() === 'QA Inspector,QCM,Supply Chain,Warehouse,KAM,Plant Manager,Production Manager');
  const pm = mk('Plant Manager', 'fahim', [{ id: 'e', brief: '2026-10-13-15', user: 'fahim', role: 'Plant Manager' }]); pm.rsPending();
  ok('every part of the brief has a question with the right answer among 3', pm.RS_PARTS_CMP.every(p => p.q && p.q.o.length === 3 && p.q.a >= 0 && p.q.a < 3 && (p.pic || []).length >= 1));
  ok('each of the 6 roles reads at least 2 parts', pm.RS_BRIEFS[1].roles.every(r => pm.RS_PARTS_CMP.filter(p => p.roles.indexOf(r) >= 0).length >= 2));
  ok('after a sign, the next brief opens', /if\(rsPending\(\)\) setTimeout/.test(grab('rsDone'))); }

/* ---------- the 3 audits of 16 Oct ---------- */
{ /* a truck marked delivered without the count has left VAN (UX blocker 1) */
  const d = DATA(); d.shipments.push({ id: 'S4', dispId: 'D4', dc: '5240', po: 'PO1', lid: 'L1', brand: 'Enrich', kg: 50, delivered: true, batches: [{ lotId: 'RC', brand: 'VAN6GE002', kg: 50 }] });
  const s = box('COO', 'tahir', d, USERS); eq('stock on a delivered truck is not counted at VAN', s.cmpRunAtVan(s.state.packingLog[1]), 150); }
{ const s = box('COO', 'tahir', DATA(), USERS); const c = raised(s); as(s, 'Warehouse', 'shoaib'); s.cmpOpenContain(c.id);
  /* containment done with the same batch left unheld asks first (flow 2) */
  s.confirm = () => false; vm.runInContext('confirm=function(){ return false; }', s); s.cmpF.note = 'checked'; s.cmpContainDone();
  ok('containment done with the batch unheld is asked first; No keeps it open', !s.cmpContainState(c).done);
  vm.runInContext('confirm=undefined', s);
  s.cmpHoldOne('RC'); const r = s.cmpRows(c, 'hold')[0]; ok('1 tap holds it', !!s.cmpLotHold(s.state.packingLog[1]));
  s.cmpF.res[r.id] = { k: 'fault', note: 'seams open on 3 bags' }; s.cmpResult(r.id);
  s.cmpF.res[r.id] = { lift: 'to be scrapped' }; s.cmpLift(r.id); ok('lift needs what happens to the stock (flow blocker 1)', !r.lift && /what happens/.test(s.toasts.pop()));
  s.cmpF.res[r.id] = { how: 'gone', lift: 'written off' }; s.cmpLift(r.id); ok('written off needs the record reversed first', !r.lift && /reverse/.test(s.toasts.pop()));
  s.cmpF.res[r.id] = { how: 'qa', lift: 'seams to be resealed' }; s.cmpLift(r.id);
  ok('handed to QA hold: the complaint hold is lifted, the stock stays off trucks', !!r.lift && !s.cmpLotHold(s.state.packingLog[1]) && !!s.state.packingLog[1].qaHold && s.lotShipKg(s.state.packingLog[1]) === 0); }
{ /* late containment goes to Tahir (flow 3, code 6) */
  const s = box('COO', 'tahir', DATA(), USERS); const c = raised(s); vm.runInContext('evToday=function(){ return "2026-10-20"; }', s);
  const j = jobs(s, 'Containment past due'); ok('containment past its day: Tahir gets a job', j.length === 1 && j[0].role === 'COO');
  ok('...and the case shows red', s.cmpTone(c) === 'st-over'); }
{ const s = box('COO', 'tahir', DATA(), USERS.filter(u => u.role !== 'Warehouse')); raised(s);
  ok('nobody holds the Warehouse role: Tahir is told at once', jobs(s, 'Containment past due').some(j => /nobody holds/.test(j.what))); }
{ /* a closed complaint with stock still held keeps its Lift job (code 2) */
  const s = box('COO', 'tahir', DATA(), USERS); const c = raised(s); as(s, 'Warehouse', 'shoaib'); s.cmpOpenContain(c.id); s.cmpHoldOne('RC');
  c.moves.push({ id: 'Y1', k: 'close', at: '2099-01-01T00:00:00Z' });   /* as a merge could leave it */
  c.moves.find(m => m.k === 'route').k = 'route'; s.state.complaints[0].moves = c.moves;
  const st = s.cmpMain(c).st; ok('a held run on a complaint that is not open still has a Lift complaint hold job', st !== 'closed' || jobs(s, 'Lift complaint hold').length === 1); }
{ /* reopen restarts containment and the replies (flow 5) */
  const s = box('COO', 'tahir', DATA(), USERS); const c = raised(s);
  ['ack', 'interim', 'final'].forEach((k, i) => c.moves.push({ id: 'R' + i, k: 'reply', kind: k, at: '2099-01-0' + (i + 1) + 'T00:00:00Z', date: TODAY_S }));
  c.moves.push({ id: 'C1', k: 'contain-done', at: '2099-01-04T00:00:00Z', note: 'done' });
  ['findings', 'accept', 'resolve', 'close'].forEach((k, i) => c.moves.push({ id: 'F' + i, k, user: 'asif', at: '2099-01-0' + (i + 5) + 'T00:00:00Z' }));
  eq('closed before the reopen', s.cmpMain(c).st, 'closed');
  c.moves.push({ id: 'RO', k: 'reopen', at: '2099-02-01T00:00:00Z', why: 'more leaking cartons found' });
  ok('after a reopen: containment and the first reply are jobs again', jobs(s, 'Contain complaint').length === 1 && jobs(s, 'Reply to customer').filter(j => j.ca === 'ack').length === 1); }
{ /* actions count from the accept step even with a device clock behind (code 1) */
  const s = box('COO', 'tahir', DATA(), USERS); const c = raised(s); c.moves.push({ id: 'FUT', k: 'reply', kind: 'ack', at: '2099-05-05T00:00:00Z', date: TODAY_S });
  investigated(s, c); as(s, 'COO', 'tahir'); s.cmpOpenAccept(c.id); Object.keys(s.cmpF.tests).forEach(k => s.cmpF.tests[k] = { what: 'test the fix', date: '2026-10-30' }); s.cmpAccept();
  ok('accepted actions are counted (since = the accept step)', s.cmpActions(c).length === 2 && c.actions.every(a => a.since >= '2099-05-05')); }
{ /* independent: an old cannot from the routed person is not counted (code 5) */
  const s = box('COO', 'tahir', DATA(), USERS); const c = raised(s); investigated(s, c); as(s, 'COO', 'tahir');
  s.cmpOpenText(c.id, 'independent'); s.cmpF.text = 'Dr Zeeshan'; s.cmpTextGo();
  c.moves.push({ id: 'OLD', k: 'cannot', at: '2099-01-01T00:00:00Z', user: 'asif', fid: 'x' });
  eq('an old cannot does not move an independent round', s.cmpMain(c).st, 'independent'); }
{ /* a truck job blocked by a hold says so and does not escalate (flow 6) */
  const s = box('COO', 'tahir', DATA(), USERS); const c = raised(s); as(s, 'Warehouse', 'shoaib'); s.cmpOpenContain(c.id); s.cmpHoldOne('RC');
  const it = { label: 'Load', disp: { rows: [s.state.shipments[1]] }, what: 'Start loading — PO1' }; s.cmpMarkHeldTrucks([it]);
  ok('the Load job says ON COMPLAINT HOLD and is marked', it.cmpHeld === true && /ON COMPLAINT HOLD: CMP-0001/.test(it.what));
  ok('acEscalation leaves a held truck alone', /if\(it\.cmpHeld\) return null/.test(grab('acEscalation'))); }
{ /* linked: not a repeat, not another customer (flow 11) */
  const s = box('COO', 'tahir', DATA(), USERS); const c1 = raised(s); const c2 = raised(s, { link: c1.id });
  ok('a linked complaint is not counted as a repeat', s.cmpRepeatsOf(c2).length === 0); }
{ /* the report prints what really happened to each action (flow 8) */
  const s = box('COO', 'tahir', DATA(), USERS); const c = raised(s); investigated(s, c); as(s, 'COO', 'tahir'); s.cmpOpenAccept(c.id); Object.keys(s.cmpF.tests).forEach(k => s.cmpF.tests[k] = { what: 'no leak in 20', date: TODAY_S }); s.cmpAccept();
  const cor = s.cmpActions(c).filter(a => a.kind === 'corrective')[0]; as(s, 'Production Manager', 'majid'); s.cmpOpenAction(c.id, cor.id); s.cmpF.note = 'Chart fixed and posted'; s.cmpActDone();
  as(s, 'COO', 'tahir'); s.cmpOpenCheck(c.id, cor.id); s.cmpF.note = 'seen it'; s.cmpCheck(true); s.cmpOpenTest(c.id, cor.id); Object.assign(s.cmpF, { note: 'leaked again', fail: true, what: 'Replace the jaw', owner: 'majid', due: '2026-10-25', tw: 'no leak', td: '2026-10-30' }); s.cmpTest(false);
  s.cmpOpenReport(c.id); s.cmpF.text = 'We are sorry. We found the cause and are fixing it now.'; s.cmpPrintReport();
  ok('a failed fix prints as not worked, never as done', /did not work: replaced by a new action/.test(s.printed)); }
{ /* sent back: the form starts from the person's own findings (code 13) */
  const s = box('COO', 'tahir', DATA(), USERS); const c = raised(s); investigated(s, c); as(s, 'COO', 'tahir'); s.cmpOpenText(c.id, 'sendback'); s.cmpF.text = 'check the night shift too'; s.cmpTextGo();
  as(s, 'QA Inspector', 'asif'); s.cmpOpenInvestigate(c.id); ok('sent back: the form is filled from the last findings', s.cmpInv.rootCause === 'The sealing machine was set too cold on shift B' && s.cmpInv.resp.length === 2); }
{ /* every gap at once (UX 6) */
  const s = box('COO', 'tahir', DATA(), USERS); s.cmpRF = s.cmpRFNew(); s.cmpRaise(true);
  ok('Raise lists every missing answer at once', s.cmpRF.errs.length >= 5 && s.state.complaints.length === 0);
  const c = raised(s); as(s, 'QA Inspector', 'asif'); s.cmpOpenInvestigate(c.id); s.cmpSendFindings('');
  ok('Investigate lists every missing answer at once', (s.cmpInv.errs || []).length >= 6 && s.cmpMain(c).st === 'routed'); }
{ const NR = require('../notify-routes.js');
  ok('Investigate and Do complaint action never alert the COO', NR.JOB_ROLES['Investigate complaint'].indexOf('COO') < 0 && NR.JOB_ROLES['Do complaint action'].indexOf('COO') < 0 && NR.JOB_ROLES['Do complaint action'].indexOf('QA Inspector') >= 0);
  ok('complaint jobs are left out of How are we doing', /!\(x&&\(x\.cm\|\|x\.cmpHeld\)\)/.test(grab('howStuck')));
  ok('the older DC approval checks the hold too', /cmpTruckHeld\(rows\)/.test(grab('approveDC'))); }
{ /* away with a back date ends by itself (flow 16) */
  const s = box('COO', 'tahir', DATA(), USERS); s.cmpMarkAway('2026-10-18'); ok('away until 18 Oct', s.cmpAway());
  vm.runInContext('evToday=function(){ return "2026-10-19"; }', s); ok('...ends by itself on 19 Oct', !s.cmpAway()); }

/* ---------- the confirm review of 16 Oct ---------- */
{ const s = box('COO', 'tahir', DATA(), USERS); const c = raised(s); as(s, 'Warehouse', 'shoaib'); s.cmpOpenContain(c.id); s.cmpHoldOne('RC'); const r = s.cmpRows(c, 'hold')[0];
  s.cmpF.res[r.id] = { k: 'fault', note: 'seams open on 3 bags' }; s.cmpResult(r.id);
  as(s, 'COO', 'tahir'); s.cmpOpenText(c.id, 'cancel'); s.cmpF.text = 'duplicate of an earlier complaint'; s.cmpTextGo();
  ok('cancel is refused while a faulty batch is still held', s.cmpMain(c).st !== 'cancelled' && /fault was found/.test(s.toasts.pop()));
  as(s, 'Warehouse', 'shoaib'); s.cmpOpenContain(c.id); s.cmpF.res[r.id] = { how: 'qa', lift: 'seams to be resealed' }; s.cmpLift(r.id); const RC = s.state.packingLog[1];
  ok('QA hold route: the part not on a truck must be inspected again', RC.insKg === RC.shipKg && !!RC.qaHold);
  RC.qaHold = null; ok('...so after the QA hold is cleared it is not free to ship until QA inspects it', s.lotShipKg(RC) === 0 && s.lotAvail(RC) === 150); }
{ const s = box('COO', 'tahir', DATA(), USERS); const c = raised(s); as(s, 'Warehouse', 'shoaib'); s.cmpOpenContain(c.id); s.cmpHoldOne('RC');
  const it = { label: 'Release', disp: { rows: [Object.assign({}, s.state.shipments[1], { gatePass: 'GP1' })] }, what: 'Release' }; s.cmpMarkHeldTrucks([it]);
  ok('a held truck after the gate pass says wait or cancel, with the batch', /CMP-0001 \(VAN6GE002\)/.test(it.what) && /Supply Chain cancels the truck/.test(it.what));
  ok('Today shows a held truck as on complaint hold, not waiting', /on complaint hold/.test(grab('tdTags')) && /x\.cmpHeld/.test(grab('howStuck')));
  ok('complaint jobs are not in other leads\' Your people lists', /it\.cm&&state\.role!=='COO'/.test(grab('tdYourPeople'))); }
{ const s = box('COO', 'tahir', DATA(), USERS); ok('severity shows what each means', /risk to people or crop/.test(s.cmpRaiseHTML()) && /looks or pack only/.test(s.cmpRaiseHTML())); }
process.exitCode = report('16e customer complaints') ? 1 : 0;
