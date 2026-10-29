/* 29a (Tahir, 29 Oct 2026, from Shoaib's proposal) - the daily comment on POs waiting for a truck.
   Pulls the real functions out of o2s.html (no copies of the logic) and runs them with small stubs.
   Run: node apps/o2s/tests/dailycomment29a.test.js */
const H = require('./harness.js'); const vm = require('vm'); const { ok, eq, report, grab, html } = H;

const FNS = ['_tdClient','_arrId','_eq','merge3','dcRows','dcSaves','dcPick','dcFormSave','dcReasonText','dcClock','dcList','dcOn','dcYesterday','dcShipLines','dcShipDays','dcState','dcState0','dcLabel','dcWaitsClient','dcMissing','dcPoDue','dcWrote','dcTextHTML','dcMetaHTML','dcCardHTML','dcBtnHTML','dcPanelHTML','openDayComment','renderDayComment','dcSave','dcSameAsYesterday','dcDueHTML','bucketLabelOf','_tdEsc','_pe','_av','_plDay','calDays','localDateOf'];
function world(opts) {
  opts = opts || {};
  const b = { console, TODAY: new Date('2026-10-29T05:00:00Z'), tdScope: 'plant', tdFilter: '' };
  b.state = { role: opts.role || 'Supply Chain', currentUser: { username: opts.user || 'saad', name: opts.name || 'Saad Jamal' }, orders: [], actionLog: [] };
  b.toasts = []; b.logs = []; b.saves = 0; b.renders = 0; b.closed = 0; b.deferred = {};
  b.evToday = () => b.TODAY.toISOString().slice(0, 10);
  b.may = (c) => (opts.noRight ? false : c === 'shipment.plan');
  b.denyRight = (c, w) => 'DENY ' + c;
  b.toast = (m) => b.toasts.push(m);
  b.logAction = (w) => b.logs.push(w);
  b.save = () => b.saves++;
  b.render = () => b.renders++;
  b.closeModal = () => b.closed++;
  b._uRole = () => ({ by: b.state.currentUser.name, user: b.state.currentUser.username, role: b.state.role });
  b.$ = (id) => ({ classList: { add() {}, remove() {} }, set innerHTML(v) { b.modalHTML = v; } });
  b.lineBucket = (o, l) => l.bucket || 'PO Created';
  b.lineCleared = (o, l) => l.clr || 0;
  b.shipReadySince = (o, l) => l.ready || null;
  b.orderBucket = (o) => { const order = ['PO Created','RM Check','Production','Lab QC','QA Pre-shipment','Shipment','Delivered','Closed short']; return order[Math.min.apply(null, o.lines.map(l => order.indexOf(l.bucket || 'PO Created')))]; };
  b.orderOpen = (o) => !['Delivered','Closed short'].includes(b.orderBucket(o));
  b.acDeferActive = (it) => b.deferred[it.o.id] ? { until: '2026-11-05' } : null;
  b.shortClient = (n) => String(n || '').split(' ')[0];
  b.openOrder = () => {};
  const dv = (re) => { const m = re.exec(html); if (!m) throw new Error('not found: ' + re); return m[0]; };
  vm.createContext(b); vm.runInContext([dv(/var DC_DAYS=15;/), dv(/var DC_REASONS=\[[^;]*\];/), 'var dcForm=null;','var dcMemo=null;'].join('\n') + '\n' + FNS.map(grab).join('\n'), b);
  return b;
}
const ship = (id, ready, extra) => Object.assign({ id, po: 'P' + id, client: 'UDPL Co', received: '2026-08-01', lines: [{ id: 'L' + id, brand: 'Humi Cash', bucket: 'Shipment', clr: 500, ready }] }, extra || {});
const prod = (id, received) => ({ id, po: 'P' + id, client: 'Maxim Co', received, lines: [{ id: 'L' + id, brand: 'Max Amino', bucket: 'Production', ordered: 300 }] });

/* ---------- who needs a comment ---------- */
{ const w = world();
  w.state.orders = [ship('A', '2026-10-14'), ship('B', '2026-10-15'), ship('C', '2026-10-13'), prod('D', '2026-10-14'), prod('E', '2026-10-13')];
  const s = (i) => w.dcState(w.state.orders[i]);
  eq('Ship job waiting 15 days: a comment is required', s(0).required, true);
  eq('...days counted from the oldest ready lot', s(0).days, 15);
  eq('Ship job waiting 14 days: not required', s(1).required, false);
  eq('...but it is still a Ship job (can be commented)', s(1).kind, 'ship');
  eq('Ship job waiting 16 days: required', s(2).required, true);
  eq('Other open PO received 15 days ago: required', s(3).required, true);
  eq('...and it is a PO, not a Ship job', s(3).kind, 'po');
  eq('Other open PO received 16 days ago: required', s(4).required, true);
  eq('Other open PO received 14 days ago: not required', w.dcState(prod('F', '2026-10-15')).required, false);
  /* Ship wait counts days as a Ship job, not the age of the PO (an old PO with a new ready lot is not required) */
  eq('a PO received 80 days ago whose stock became ready 3 days ago: not required', w.dcState(ship('G', '2026-10-26')).required, false);
  /* a deferred Ship job needs none */
  w.deferred['A'] = 1; eq('a deferred Ship job needs no comment', w.dcState(w.state.orders[0]).required, false);
  eq('...and says it is deferred', w.dcState(w.state.orders[0]).deferred, true);
  eq('...so the label does not show', w.dcMissing(w.state.orders[0]), false);
  /* the Ship job stops mattering when nothing is open */
  eq('delivered PO: nothing open, no state', w.dcState({ id: 'X', po: 'X', lines: [{ id: 'l', bucket: 'Delivered' }] }), null);
  eq('closed short PO with nothing packed: no state', w.dcState({ id: 'X', po: 'X', lines: [{ id: 'l', bucket: 'Closed short' }] }), null);
  eq('closed short line with packed stock not shipped is still a Ship job (PO 21301)', w.dcState({ id: 'X', po: 'X', received: '2026-07-01', lines: [{ id: 'l', bucket: 'Closed short', clr: 1000, ready: '2026-07-30' }] }).kind, 'ship');
  eq('a PO with a truck out (Shipment, nothing cleared) is a PO not ready to ship', w.dcState({ id: 'X', po: 'X', received: '2026-10-01', lines: [{ id: 'l', bucket: 'Shipment', clr: 0 }] }).kind, 'po');
  eq('a PO with no lines: no state', w.dcState({ id: 'X', po: 'X', lines: [] }), null);
  /* no ready date at all: falls back to the PO date, never NaN */
  eq('a Ship job with no ready date counts from the PO received date', w.dcState(ship('H', null, { received: '2026-10-01' })).days, 28);
  eq('a PO with no received date has 0 days, not NaN', w.dcState({ id: 'X', po: 'X', lines: [{ id: 'l', bucket: 'Production' }] }).days, 0);
}

/* ---------- the list on Today ---------- */
{ const w = world();
  w.state.orders = [ship('A', '2026-10-01'), prod('D', '2026-10-01'), prod('E', '2026-10-20'), prod('F', '2026-09-01')];
  eq('the list holds only open POs not ready to ship and 15+ days old, oldest first', w.dcPoDue().map(o => o.id).join(','), 'F,D');
  const h = w.dcDueHTML();
  ok('the list has its own heading', /POs not ready to ship, comment due/.test(h));
  ok('...it says the rows are not counted in the Today numbers', /not counted in the Today numbers/.test(h));
  ok('...the number is the number of rows listed (2), and the line says how many still need a comment', /cnt">2</.test(h) && /2 of 2 still need a comment today/.test(h));
  ok('...each row says No comment today', (h.match(/No comment today/g) || []).length === 2);
  ok('...and links to the PO', /openOrder\('F'\)/.test(h) && /openOrder\('D'\)/.test(h));
  w.state.orders[1].dayComments = [{ id: 'DC2026-10-29', date: '2026-10-29', kind: 'po', note: 'Bags arrive tomorrow', by: 'Saad Jamal', at: '2026-10-29T06:40:00Z' }];
  const h2 = w.dcDueHTML();
  ok('after a comment the label goes from that row', (h2.match(/No comment today/g) || []).length === 1);
  ok('...the number still equals the rows listed (2) and the line says 1 of 2 still needs a comment', /cnt">2</.test(h2) && /1 of 2 still need a comment today/.test(h2));
  const D2 = w.state.orders[1]; w.state.orders[3].dayComments = [{ id: 'DC2026-10-29-z', date: '2026-10-29', kind: 'po', note: 'Cleared', by: 'Saad Jamal', at: '2026-10-29T06:50:00Z' }];
  ok('...when every row has a comment the heading does not read 0 above a full list', /cnt">2</.test(w.dcDueHTML()) && /All have a comment today/.test(w.dcDueHTML()));
  ok('...and the row still shows today\'s comment', /Bags arrive tomorrow/.test(h2));
  ok('...with the time it was written (PKT, 11:40) and who', /11:40 by Saad Jamal/.test(h2));
  ok('...and the button becomes Change today\'s comment', /Change today’s comment/.test(h2));
  const o = world({ noRight: true }); o.state.orders = w.state.orders; eq('a person without the shipment.plan right sees no list', o.dcDueHTML(), '');
  const c = world({ role: 'COO' }); c.state.orders = w.state.orders; c.tdScope = 'mine'; eq('the COO on "Needs me" sees no list', c.dcDueHTML(), '');
  c.tdScope = 'plant'; ok('...on "Whole plant" he sees it', /comment due/.test(c.dcDueHTML()));
  eq('no due POs: no list at all', world().dcDueHTML(), '');
}

/* ---------- saving ---------- */
{ const w = world(); w.state.orders = [ship('A', '2026-10-01'), prod('D', '2026-10-01')];
  const A = w.state.orders[0], D = w.state.orders[1];
  eq('Ship job with no reason: refused', w.dcSave('A', '', '', 'x note here', false), false);
  eq('...nothing written', A.dayComments, undefined);
  eq('a reason that is not in the list: refused', w.dcSave('A', 'whatever', '', 'x note here', false), false);
  eq('Truck committed with no time: refused', w.dcSave('A', 'truck-committed', '', 'driver called', false), false);
  eq('Truck committed with a bad time: refused', w.dcSave('A', 'truck-committed', '25:99', 'driver called', false), false);
  eq('Other with no note: refused', w.dcSave('A', 'other', '', '  ', false), false);
  eq('a note over 600 characters: refused', w.dcSave('A', 'quality-hold', '', 'x'.repeat(601), false), false);
  eq('nothing was saved by any refusal', w.saves, 0);
  eq('Waiting for the client\'s vehicle with no note: saved (note is optional)', w.dcSave('A', 'client-vehicle', '', '', false), true);
  ok('...one row on the PO, its id starts with DC and the day', A.dayComments.length === 1 && /^DC2026-10-29-/.test(A.dayComments[0].id));
  eq('...the date is today', A.dayComments[0].date, '2026-10-29');
  eq('...written by the signed-in person', A.dayComments[0].by + '|' + A.dayComments[0].user + '|' + A.dayComments[0].role, 'Saad Jamal|saad|Supply Chain');
  eq('...saved to the server, window closed, screen redrawn', [w.saves, w.closed, w.renders].join(','), '1,1,1');
  eq('...one line in the action log', w.logs.length, 1);
  /* a second save on the same day replaces the first; the log keeps both */
  eq('second save on the same day: saved', w.dcSave('A', 'truck-committed', '19:00', 'Spoke to the driver', false), true);
  eq('...both saves are kept on the PO as rows', A.dayComments.length, 2);
  eq('...but the PO shows 1 comment for the day, the latest', w.dcList(A).length + '|' + w.dcOn(A, '2026-10-29').reason, '1|truck-committed');
  eq('...the latest says which row it replaced', A.dayComments[1].replaces, A.dayComments[0].id);
  eq('...the action log now has both', w.logs.length, 2);
  ok('...the second log line names what it replaced, who wrote it and when', /replaces the comment of Saad Jamal/.test(w.logs[1]) && /client's vehicle/.test(w.logs[1]) && /at \d\d:\d\d/.test(w.logs[1]));
  /* the time is dropped when the reason is not truck committed */
  w.dcSave('A', 'quality-hold', '19:00', 'held for retest', false); eq('a time typed under another reason is not kept', w.dcOn(A, '2026-10-29').time, '');
  /* a note-only PO */
  eq('PO not ready to ship, no note: refused', w.dcSave('D', '', '', '', false), false);
  eq('PO not ready to ship, 4 characters: refused', w.dcSave('D', '', '', 'abcd', false), false);
  eq('PO not ready to ship with a note: saved', w.dcSave('D', 'client-vehicle', '19:00', 'Batch packs tomorrow', false), true);
  eq('...no reason or time is kept on a PO that is not ready to ship', D.dayComments[0].reason + '|' + D.dayComments[0].time + '|' + D.dayComments[0].kind, '||po');
  /* rights and state */
  const n = world({ noRight: true }); n.state.orders = [ship('A', '2026-10-01')];
  eq('without the shipment.plan right: refused', n.dcSave('A', 'client-vehicle', '', 'x', false), false);
  ok('...and told why', /DENY shipment.plan/.test(n.toasts[0])); eq('...nothing written', n.state.orders[0].dayComments, undefined);
  eq('a PO that is gone: refused', w.dcSave('NOPE', 'client-vehicle', '', 'x', false), false);
  const done = world(); done.state.orders = [{ id: 'Z', po: 'Z', lines: [{ id: 'l', bucket: 'Delivered' }] }];
  eq('a PO with nothing open: refused', done.dcSave('Z', '', '', 'a note here', false), false);
  eq('...no row is written', done.state.orders[0].dayComments, undefined);
  /* a note with markup is stored as typed and escaped on screen */
  const m = world(); m.state.orders = [prod('M', '2026-10-01')]; m.dcSave('M', '', '', '<img src=x onerror=alert(1)>', false);
  ok('markup in a note is kept as text', m.state.orders[0].dayComments[0].note.indexOf('<img') === 0);
  ok('...and shown escaped on the card, the list and the PO page', !/<img/.test(m.dcCardHTML(m.state.orders[0])) && !/<img/.test(m.dcPanelHTML(m.state.orders[0])) && !/<img/.test(m.dcDueHTML()));
}

/* ---------- same as yesterday ---------- */
{ const w = world(); w.state.orders = [ship('A', '2026-10-01')]; const A = w.state.orders[0];
  A.dayComments = [{ id: 'DC2026-10-28', date: '2026-10-28', kind: 'ship', reason: 'truck-committed', time: '19:00', note: 'Spoke to the UDPL driver', by: 'Zain', at: '2026-10-28T06:40:00Z' }];
  eq('yesterday date', w.dcYesterday(), '2026-10-28');
  eq('same as yesterday: saved', (w.dcSameAsYesterday('A'), A.dayComments.length), 2);
  const t = A.dayComments.find(c => c.date === '2026-10-29');
  eq('...names who first wrote it and the day', t.copiedFrom.by + '|' + t.copiedFrom.date, 'Zain|2026-10-28');
  eq('...repeats reason, time and note', t.reason + '|' + t.time + '|' + t.note, 'truck-committed|19:00|Spoke to the UDPL driver');
  eq('...marked as copied', t.copied, true);
  eq('...written by today\'s person, not yesterday\'s', t.by, 'Saad Jamal');
  eq('...yesterday\'s row is not touched', A.dayComments.find(c => c.date === '2026-10-28').by, 'Zain');
  ok('...the card says who first wrote it', /copied from Zain, 28 Oct/.test(w.dcCardHTML(Object.assign({}, A, { dayComments: [t] }))));
  ok('...the log says it was copied', /same as yesterday/.test(w.logs[0]));
  /* a typed save the same day clears the copied mark */
  w.dcSave('A', 'quality-hold', '', 'held', false); eq('a typed update replaces the copy and is not marked copied', w.dcOn(A, '2026-10-29').copied, false);
  /* the window offers it only when yesterday has a matching comment */
  const x = world(); x.state.orders = [ship('A', '2026-10-01')]; x.openDayComment('A'); ok('no comment yesterday: no button', !/Same as yesterday/.test(x.modalHTML));
  x.state.orders[0].dayComments = [{ id: 'DC2026-10-27', date: '2026-10-27', kind: 'ship', reason: 'quality-hold', note: 'two days ago', by: 'Z', at: '2026-10-27T06:00:00Z' }];
  x.openDayComment('A'); ok('a comment from 2 days ago only: no button', !/Same as yesterday/.test(x.modalHTML));
  x.state.orders[0].dayComments = [{ id: 'DC2026-10-28', date: '2026-10-28', kind: 'ship', reason: 'quality-hold', note: 'yesterday', by: 'Z', at: '2026-10-28T06:00:00Z' }];
  x.openDayComment('A'); ok('a comment from yesterday: the button shows', /Same as yesterday/.test(x.modalHTML));
  x.state.orders[0].dayComments = [{ id: 'DC2026-10-28', date: '2026-10-28', kind: 'po', note: 'was a note only', by: 'Z', at: '2026-10-28T06:00:00Z' }];
  x.openDayComment('A'); ok('yesterday was a note on a PO not ready to ship, today it is a Ship job: no button (it has no reason to repeat)', !/Same as yesterday/.test(x.modalHTML));
  eq('...and calling it anyway writes nothing', (x.dcSameAsYesterday('A'), x.state.orders[0].dayComments.length), 1);
  x.state.orders[0].dayComments.push({ id: 'DC2026-10-29', date: '2026-10-29', kind: 'ship', reason: 'quality-hold', note: 'mine', by: 'S', at: '2026-10-29T05:00:00Z' });
  x.openDayComment('A'); ok('already commented today: the window is "Change today\'s comment" and has no Same as yesterday', /Change today/.test(x.modalHTML) && !/Same as yesterday/.test(x.modalHTML));
}

/* ---------- the window ---------- */
{ const w = world(); w.state.orders = [ship('A', '2026-10-01'), prod('D', '2026-10-01')];
  w.openDayComment('A'); const s = w.modalHTML;
  ok('Ship job window has the 5 reasons', ['Waiting for the client\'s vehicle', 'Waiting for truck arrangement', 'Truck committed', 'Quality hold', 'Other'].every(t => s.indexOf(t.replace(/'/g, '&#39;')) > -1 || s.indexOf(t) > -1));
  ok('...no time box until Truck committed is picked', !/dc_time/.test(s));
  w.dcForm.reason = 'truck-committed'; w.renderDayComment(); ok('...Truck committed adds the time box', /dc_time/.test(w.modalHTML));
  w.dcForm.reason = 'other'; w.renderDayComment(); ok('...Other makes the note required (red star)', /dc_note">[^<]*<span style="color:var\(--red\)">\*/.test(w.modalHTML));
  w.openDayComment('D'); ok('a PO not ready to ship: no pick list', !/dc_r/.test(w.modalHTML)); ok('...a note box that is required', /dc_note/.test(w.modalHTML) && /what is the position today/.test(w.modalHTML));
  ok('...the note limit is 600 characters', /maxlength="600"/.test(w.modalHTML));
  const n = world({ noRight: true }); n.state.orders = [ship('A', '2026-10-01')]; n.openDayComment('A'); ok('without the right: the window does not open', n.modalHTML === undefined && /DENY/.test(n.toasts[0]));
  w.openDayComment('D'); w.dcForm.note = 'half typed'; w.dcForm.kind = 'ship'; w.state.orders[1].lines[0].clr = 100; w.state.orders[1].lines[0].ready = '2026-10-20'; w.renderDayComment();
  ok('if the PO turns into a Ship job while the window is open, it redraws as a Ship job and keeps the typed note', /dc_r/.test(w.modalHTML) && /half typed/.test(w.modalHTML));
}

/* ---------- the card ---------- */
{ const w = world(); w.state.orders = [ship('A', '2026-10-01')]; const A = w.state.orders[0];
  eq('no comments: nothing extra on the card', w.dcCardHTML(A), '');
  ok('...the button says Comment for today', /Comment for today/.test(w.dcBtnHTML(A)));
  A.dayComments = [25, 26, 27, 28, 29].map(i => ({ id: 'DC2026-10-' + i, date: '2026-10-' + i, kind: 'ship', reason: 'quality-hold', note: 'note ' + i, by: 'Z', at: '2026-10-' + i + 'T06:00:00Z' }));
  const h = w.dcCardHTML(A);
  ok('the card shows today\'s comment first', h.indexOf('Today') > -1 && h.indexOf('Today') < h.indexOf('Earlier'));
  ok('...then at most 3 earlier days, newest first', /note 28[\s\S]*note 27[\s\S]*note 26/.test(h) && !/note 25/.test(h));
  ok('...and says how many more are on the PO page', /and 1 more on the PO page/.test(h));
  ok('...the button says Change today\'s comment', /Change today’s comment/.test(w.dcBtnHTML(A)));
  const p = w.dcPanelHTML(A);
  ok('the PO page lists all 5 days, view only, with no button', (p.match(/note \d\d/g) || []).length === 5 && !/<button/.test(p) && /View only/.test(p) && /Daily comments · 5 days/.test(p));
  eq('a PO with no comments: no panel on the PO page', w.dcPanelHTML({ lines: [] }), '');
  const n = world({ noRight: true }); eq('without the right: no button', n.dcBtnHTML(A), '');
  eq('a PO with nothing open: no button', w.dcBtnHTML({ id: 'Z', lines: [{ id: 'l', bucket: 'Delivered' }] }), '');
}

/* ---------- time text ---------- */
{ const w = world();
  eq('19:00 reads 07:00 PM', w.dcClock('19:00'), '07:00 PM'); eq('00:30 reads 12:30 AM', w.dcClock('00:30'), '12:30 AM'); eq('12:00 reads 12:00 PM', w.dcClock('12:00'), '12:00 PM');
  eq('9:05 reads 09:05 AM', w.dcClock('9:05'), '09:05 AM'); eq('a bad time reads as nothing', w.dcClock('soon'), '');
}


/* ---------- the design review's points ---------- */
{ const w = world(); w.state.orders = [ship('A', '2026-10-01')]; const A = w.state.orders[0]; A.client = 'DLR-X-1|Kissan Zarai Merkaz';
  w.openDayComment('A'); ok('the window names the client, not the dealer code', /Kissan Zarai Merkaz/.test(w.modalHTML) && !/DLR-X-1/.test(w.modalHTML));
  ok('...and says the note is up to 600 characters', /Up to 600 characters/.test(w.modalHTML));
  A.dayComments = [{ id: 'DC2026-10-29-a', date: '2026-10-29', kind: 'ship', reason: 'client-vehicle', note: 'Client says Friday', by: 'Zain', user: 'zain', at: '2026-10-29T05:02:00Z' }];
  w.openDayComment('A'); ok('Change today\'s comment shows who wrote the one that is there and says the save goes under the saver\'s name', /Now showing/.test(w.modalHTML) && /written 10:02 by Zain/.test(w.modalHTML) && /under your name/.test(w.modalHTML));
  const long = 'x'.repeat(600); A.dayComments.push({ id: 'DC2026-10-28-b', date: '2026-10-28', kind: 'ship', reason: 'quality-hold', note: long, by: 'Ali', user: 'ali', at: '2026-10-28T05:00:00Z' });
  const c = w.dcCardHTML(A); ok('the card cuts an earlier day\'s long note, the PO page keeps all of it', c.indexOf(long) < 0 && /all of it on the PO page/.test(c) && w.dcPanelHTML(A).indexOf(long) > -1);
  ok('long unbroken text wraps instead of widening the page', /overflow-wrap:anywhere/.test(c) && /overflow-wrap:anywhere/.test(w.dcPanelHTML(A)));
  ok('the PO page says who writes the comments', /Supply Chain, Warehouse and the COO write the comment/.test(w.dcPanelHTML(A)));
}

/* ---------- 2 people, the real merge ---------- */
{ const w = world(); const mk = (by, user, reason, note, at) => w.dcSave && ({ id: 'DC2026-10-29-' + user, date: '2026-10-29', kind: 'ship', reason, time: '', note, copied: false, by, user, role: 'Supply Chain', at });
  const base = { orders: [{ id: 'O1', po: 'P', lines: [{ id: 'L' }] }] };
  const a = { orders: [{ id: 'O1', po: 'P', lines: [{ id: 'L' }], dayComments: [mk('Saad Jamal', 'saad', 'truck-committed', 'Spoke to driver, 7 PM', '2026-10-29T05:00:00Z')] }] };
  const b = { orders: [{ id: 'O1', po: 'P', lines: [{ id: 'L' }], dayComments: [mk('Ali', 'ali', 'client-vehicle', 'Client says Friday', '2026-10-29T06:00:00Z')] }] };
  const m = w.merge3(base, a, b); const rows = m.orders[0].dayComments;
  eq('same PO, same day, both saved from a copy with no comments: both comments survive the merge', rows.length, 2);
  eq('...each keeps its own words (no mixed row)', rows.map(r => r.user + ':' + r.reason + ':' + r.note).sort().join('|'), 'ali:client-vehicle:Client says Friday|saad:truck-committed:Spoke to driver, 7 PM');
  eq('...the PO shows the later one', w.dcList(m.orders[0])[0].user, 'ali');
  /* the same day already has a row; both change it from the same stale copy */
  const row0 = mk('Zain', 'zain', 'client-vehicle', 'Spoke to the driver', '2026-10-29T04:00:00Z');
  const base2 = { orders: [{ id: 'O1', po: 'P', lines: [{ id: 'L' }], dayComments: [row0] }] };
  const a2 = JSON.parse(JSON.stringify(base2)); a2.orders[0].dayComments.push(Object.assign(mk('Saad Jamal', 'saad', 'truck-committed', 'Spoke to the driver', '2026-10-29T05:00:00Z'), { time: '19:00', replaces: row0.id }));
  const b2 = JSON.parse(JSON.stringify(base2)); b2.orders[0].dayComments.push(Object.assign(mk('Ali', 'ali', 'client-vehicle', 'Driver now says tomorrow', '2026-10-29T06:00:00Z'), { replaces: row0.id }));
  const m2 = w.merge3(base2, a2, b2).orders[0];
  eq('both change the same existing comment: 3 rows kept (the original and the 2 new ones)', m2.dayComments.length, 3);
  eq('...no hybrid: Saad\'s row keeps his reason, time and note', JSON.stringify(m2.dayComments.filter(r => r.user === 'saad').map(r => [r.reason, r.time, r.note])), JSON.stringify([['truck-committed', '19:00', 'Spoke to the driver']]));
  eq('...Ali\'s row has no time', m2.dayComments.filter(r => r.user === 'ali')[0].time, '');
  eq('...the PO shows the latest save (Ali, 06:00)', w.dcOn(m2, '2026-10-29').user, 'ali');
  eq('...and says 3 saves were made that day', w.dcSaves(m2, '2026-10-29'), 3);
  /* a different day and a different PO are not lost either */
  const a3 = { orders: [{ id: 'O1', lines: [], dayComments: [Object.assign({}, row0, { id: 'DC2026-10-28-x', date: '2026-10-28' })] }, { id: 'O2', lines: [] }] };
  const b3 = { orders: [{ id: 'O1', lines: [], dayComments: [row0] }, { id: 'O2', lines: [], dayComments: [Object.assign({}, row0, { id: 'DC2026-10-29-y' })] }] };
  const m3 = w.merge3({ orders: [{ id: 'O1', lines: [] }, { id: 'O2', lines: [] }] }, a3, b3);
  eq('another day on the same PO, and another PO: nothing lost', m3.orders[0].dayComments.length + '|' + m3.orders[1].dayComments.length, '2|1');
  /* an old tab that never had the field cannot remove it */
  const m4 = w.merge3({ orders: [{ id: 'O1', lines: [] }] }, { orders: [{ id: 'O1', lines: [] }] }, { orders: [{ id: 'O1', lines: [], dayComments: [row0] }] });
  eq('a tab on the old build (no field) saving after a comment was written does not remove it', (m4.orders[0].dayComments || []).length, 1);
}

/* ---------- taps, stale windows, the clock ---------- */
{ const w = world(); w.state.orders = [ship('A', '2026-10-01')]; const A = w.state.orders[0];
  eq('save once', w.dcSave('A', 'client-vehicle', '', 'Client says Friday', false), true);
  eq('a second tap with the same words writes nothing', (w.dcSave('A', 'client-vehicle', '', 'Client says Friday', false), A.dayComments.length), 1);
  eq('...and no second log line', w.logs.length, 1);
  w.dcSave('A', 'client-vehicle', '', 'Client says Saturday', false); eq('different words are a new row', A.dayComments.length, 2);
  /* same as yesterday tapped twice */
  const x = world(); x.state.orders = [ship('A', '2026-10-01')]; const X = x.state.orders[0];
  X.dayComments = [{ id: 'DC2026-10-28-a', date: '2026-10-28', kind: 'ship', reason: 'quality-hold', note: 'held', by: 'Z', user: 'zz', at: '2026-10-28T06:00:00Z' }];
  x.dcSameAsYesterday('A'); x.dcSameAsYesterday('A'); eq('Same as yesterday tapped twice writes 1 row, not 2', X.dayComments.length, 2);
  /* a copy of a copy still names the first writer */
  const y = world(); y.state.orders = [ship('A', '2026-10-01')]; const Y = y.state.orders[0];
  Y.dayComments = [{ id: 'DC2026-10-28-a', date: '2026-10-28', kind: 'ship', reason: 'quality-hold', note: 'held', copied: true, copiedFrom: { by: 'Ali', date: '2026-10-26', at: '2026-10-26T05:00:00Z' }, by: 'Zain', user: 'zain', at: '2026-10-28T06:00:00Z' }];
  y.dcSameAsYesterday('A'); const cp = y.dcOn(Y, '2026-10-29'); eq('a copy of a copy names the person who first wrote it', cp.copiedFrom.by + '|' + cp.copiedFrom.date, 'Ali|2026-10-26');
  /* the PO changes while the window is open */
  const z = world(); z.state.orders = [prod('D', '2026-10-01')]; z.openDayComment('D'); z.state.orders[0].lines[0].clr = 100; z.state.orders[0].lines[0].ready = '2026-10-20'; z.state.orders[0].lines[0].bucket = 'Shipment';
  eq('the PO turns into a Ship job while the window is open: the save is stopped', z.dcSave('D', '', '', 'half typed note', false), false);
  ok('...the person is told, and the window is drawn again as a Ship job with the note kept', /changed while the window was open/.test(z.toasts[0]) && /dc_r/.test(z.modalHTML));
  eq('...nothing was written', z.state.orders[0].dayComments, undefined);
  /* a window left open past midnight */
  const d = world(); d.state.orders = [ship('A', '2026-10-01')]; d.openDayComment('A'); d.dcForm.day = '2026-10-28'; d.dcForm.reason = 'quality-hold';
  eq('a window opened yesterday does not save under today\'s date', d.dcSave('A', 'quality-hold', '', 'held', false), false);
  ok('...and says so', /day has changed/.test(d.toasts[0]));
  /* the Save button reads the screen, so a time picked a moment before the tap is never lost */
  const t = world(); t.state.orders = [ship('A', '2026-10-01')]; t.openDayComment('A'); t.dcForm.reason = 'truck-committed';
  t.document = { getElementById: (id) => id === 'dc_time' ? { value: '19:30' } : id === 'dc_note' ? { value: 'Driver called' } : null };
  vm.runInContext('var document = this.document;', t); t.dcFormSave();
  eq('Save reads the time and note from the screen', t.state.orders[0].dayComments[0].time + '|' + t.state.orders[0].dayComments[0].note, '19:30|Driver called');
  /* the time box keeps what is typed */
  ok('the time box saves on typing as well as on change', /id="dc_time"[^>]*oninput="dcForm\.time=this\.value" onchange="dcForm\.time=this\.value"/.test((() => { t.dcForm = { oid: 'A', kind: 'ship', day: '2026-10-29', reason: 'truck-committed', time: '', note: '' }; t.renderDayComment(); return t.modalHTML; })()));
  /* the days a Ship job has waited are counted from the same start as the card */
  const n = world(); eq('a Ship job with no ready date counts from the PO received date (the card does the same)', (n.state.orders = [ship('A', null, { received: '2026-10-01' })], n.dcState(n.state.orders[0]).days), 28);
  eq('a Ship line with only a QC pass date still counts from the PO received date', n.dcState(ship('Q', null, { received: '2026-10-10' })).days, 19);
  /* a delivered PO is skipped fast */
  const q = world(); let calls = 0; q.lineCleared = () => { calls++; return 0; };
  q.dcState({ id: 'Z', po: 'Z', lines: [{ id: 'l', bucket: 'Delivered' }, { id: 'm', bucket: 'Delivered' }] }); eq('a delivered PO does not look at its stock', calls, 0);
  /* a PO whose truck is out is not called "not ready to ship" in the window */
  const r = world(); r.state.orders = [{ id: 'T', po: 'T', client: 'K Co', received: '2026-09-01', lines: [{ id: 'l', brand: 'X', bucket: 'Shipment', clr: 0 }] }]; r.openDayComment('T');
  ok('the window does not say not ready to ship for a PO whose truck is out', !/not ready to ship/.test(r.modalHTML) && /no stock ready for a truck/.test(r.modalHTML));
  ok('...and the list says what the open lines are doing, in their own words, not a whole-PO claim about trucks', /open lines: /.test(r.dcDueHTML()) && !/truck sent, delivery not confirmed/.test(r.dcDueHTML()));
  eq('a delivered line is left out of the label', r.bucketLabelOf({ lines: [{ id: 'a', bucket: 'Delivered' }, { id: 'b', bucket: 'PO Created' }] }), 'open lines: not started');
  /* Today is drawn once with each PO's state worked out once */
  const q2 = world(); q2.state.orders = [ship('A', '2026-10-01')]; let cnt = 0; const real = q2.dcState0; q2.dcState0 = (o) => { cnt++; return real(o); }; vm.runInContext('dcMemo={}', q2); q2.dcState(q2.state.orders[0]); q2.dcState(q2.state.orders[0]); q2.dcMissing(q2.state.orders[0]); eq('inside a Today draw a PO\'s state is worked out once', cnt, 1);
  vm.runInContext('dcMemo=null', q2); q2.dcState(q2.state.orders[0]); q2.dcState(q2.state.orders[0]); eq('outside a Today draw nothing is remembered (a save is never read from a stale memo)', cnt, 3);
}


/* ---------- the data-safety review's points ---------- */
{ const w = world(); w.state.orders = [ship('A', '2026-10-01')]; const A = w.state.orders[0];
  /* the replacing save wins even when the first writer's device clock runs fast */
  A.dayComments = [{ id: 'DC2026-10-29-a', date: '2026-10-29', kind: 'ship', reason: 'truck-committed', time: '19:00', note: 'Truck at 7 PM', by: 'Ali', user: 'ali', at: '2026-10-29T06:03:00Z' },
    { id: 'DC2026-10-29-b', date: '2026-10-29', kind: 'ship', reason: 'client-vehicle', note: 'Client says Friday', by: 'Saad', user: 'saad', at: '2026-10-29T06:01:00Z', replaces: 'DC2026-10-29-a' }];
  eq('a save that replaced another shows, whatever the device clocks say', w.dcOn(A, '2026-10-29').id, 'DC2026-10-29-b');
  /* 2 saves made side by side: the later clock shows, and the PO page lists the other */
  A.dayComments = [{ id: 'DC2026-10-29-a', date: '2026-10-29', kind: 'ship', reason: 'truck-committed', time: '19:00', note: 'Truck at 7 PM', by: 'Ali', user: 'ali', at: '2026-10-29T06:00:00Z' },
    { id: 'DC2026-10-29-b', date: '2026-10-29', kind: 'ship', reason: 'client-vehicle', note: 'Client says Friday', by: 'Saad', user: 'saad', at: '2026-10-29T06:01:00Z' }];
  eq('2 side by side saves: the later shows', w.dcOn(A, '2026-10-29').by, 'Saad');
  const p = w.dcPanelHTML(A); ok('...and the PO page also lists the other one with its writer', /Also saved/.test(p) && /Truck at 7 PM/.test(p) && /Ali/.test(p));
  ok('a replaced save is not listed twice as the shown one', w.dcList(A).length === 1);
  /* a cap on saves */
  const c = world(); c.state.orders = [ship('A', '2026-10-01')]; for (let i = 0; i < 20; i++) c.dcSave('A', 'client-vehicle', '', 'note ' + i, false);
  eq('20 saves in a day are kept', c.state.orders[0].dayComments.length, 20);
  c.state.orders[0].dayComments.push({}); c.state.orders[0].dayComments.pop();
  { const last = c.dcOn(c.state.orders[0], '2026-10-29'); eq('an identical repeat at 20 writes nothing', [c.dcSave('A', last.reason, last.time, last.note, false), c.state.orders[0].dayComments.length].join(','), 'true,20'); eq('...and the same text sent as a copy is the 21st: refused', [c.dcSave('A', last.reason, last.time, last.note, true), c.state.orders[0].dayComments.length].join(','), 'false,20'); }
  eq('the 21st is refused and says so', [c.dcSave('A', 'client-vehicle', '', 'note 21', false), c.state.orders[0].dayComments.length, /already has 20 saves/.test(c.toasts[c.toasts.length - 1])].join(','), 'false,20,true');
}


/* ---------- the last re-review's points ---------- */
{ const w = world();
  eq('a line closed short is not an open line in the label', w.dcLabel(['Closed short', 'Production']), 'open lines: Production');
  eq('a line in Shipment is called shipping, not part sent', w.dcLabel(['Shipment', 'PO Created', 'Delivered', 'Shipment']), 'open lines: shipping, not started');
  eq('nothing open: just open', w.dcLabel(['Delivered', 'Closed short']), 'open');
  /* a PO that was delivered while a stale memo was on: the save still refuses */
  w.state.orders = [ship('A', '2026-10-01')]; vm.runInContext('dcMemo={}', w); w.dcState(w.state.orders[0]);
  w.state.orders[0].lines.forEach(l => { l.bucket = 'Delivered'; });
  eq('a save never reads the Today memo, so a PO delivered meanwhile is refused', w.dcSave('A', 'client-vehicle', '', 'x note', false), false);
  const c21 = world(); c21.state.orders = [ship('A', '2026-10-01')]; for (let k = 0; k < 21; k++) c21.dcSave('A', 'client-vehicle', '', 'note ' + k, false);
  ok('the 21st-save message does not send the person to someone who cannot help', /20 saves today\. The comment shown is the last one saved/.test(c21.toasts[c21.toasts.length - 1]) && !/ask the COO/.test(c21.toasts[c21.toasts.length - 1]));
}


/* ---------- Tahir 29 Oct: Waiting for client needs no daily comment ---------- */
{ const w = world(); vm.runInContext('function lineWaitClient(l){ return l.wc ? { until: "2026-11-20" } : null; }', w);
  w.state.orders = [ship('A', '2026-10-01'), prod('D', '2026-10-01')];
  eq('a Ship job needs a comment before the mark', w.dcState(w.state.orders[0]).required, true);
  w.state.orders[0].lines[0].wc = true;
  const s1 = w.dcState(w.state.orders[0]); eq('a Ship job marked Waiting for client needs none while the mark stands', s1.required + '|' + s1.waitsClient, 'false|true');
  ok('...it is not missing, so no No comment today label', !w.dcMissing(w.state.orders[0]));
  ok('...and can still be commented if somebody wants to', !!w.dcBtnHTML(w.state.orders[0]));
  w.state.orders[0].lines[0].wc = false; eq('when the mark ends the comment is due again', w.dcState(w.state.orders[0]).required, true);
  w.state.orders[1].lines[0].wc = true; const s2 = w.dcState(w.state.orders[1]); eq('a PO not ready to ship, all open lines waiting for the client: none due', s2.required + '|' + w.dcPoDue().length, 'false|0');
  const two = ship('T', '2026-10-01'); two.lines.push({ id: 'L2', brand: 'X', bucket: 'Shipment', clr: 100, ready: '2026-10-01' }); two.lines[0].wc = true; w.state.orders = [two];
  eq('2 lines on a Ship job and only 1 waiting for the client: the job still needs it', w.dcState(two).required, true);
}

/* ---------- the source: the wiring ---------- */
{ const act = /const _clr=\(o\.lines\|\|\[\]\)\.filter\(l=>lineBucket\(o,l\)!=='Delivered' && lineCleared\(o,l\)>0\.5\);/;
  ok('the Ship job in actionItems uses the same test as dcShipLines', act.test(html) && /function dcShipLines\(o,bs\)\{ return \(\(o&&o\.lines\)\|\|\[\]\)\.filter\(function\(l,i\)\{ var b=bs\?bs\[i\]:lineBucket\(o,l\); return b!=='Delivered' && lineCleared\(o,l\)>0\.5; \}\); \}/.test(html));
  ok('the Ship card has the Comment for today button', /if\(one\.label==='Ship'&&one\.o\) h\+=dcBtnHTML\(one\.o\);/.test(html));
  ok('the Ship card shows the comments', /if\(one\.label==='Ship'&&one\.o\) h\+=dcCardHTML\(one\.o\);/.test(html));
  ok('the label "No comment today" sits on the Ship tags', /g\.label==='Ship'&&g\.items\.length===1&&g\.items\[0\]\.o&&may\('shipment\.plan'\)&&dcMissing\(g\.items\[0\]\.o\)/.test(html));
  ok('Today draws the list only when no filter is picked', /if\(!tdFilter\) h\+=dcDueHTML\(\);/.test(html));
  ok('the PO page draws the comments, view only', /\$\{dcPanelHTML\(o\)\}/.test(html));
  /* the list is drawn AFTER the Waiting on you section, so it can never be inside the count */
  const iTally = html.indexOf('h+=tdTallyHTML(own.length,lateOwn);'), iDue = html.indexOf('if(!tdFilter) h+=dcDueHTML();');
  ok('the list is drawn after the tally and the Waiting on you list', iTally > 0 && iDue > iTally);
  /* nothing in the count code reads dayComments */
  const tally = grab('tdTallyHTML'); ok('the Today tally does not read the comments', !/dayComments|dcMissing|dcState/.test(tally));
  const ai = grab('actionItems'); ok('actionItems does not read the comments (no job, no alert)', !/dayComments|dcMissing|dcState/.test(ai));
  const ac = grab('tdItems'); ok('tdItems does not read the comments', !/dayComments|dcMissing|dcState/.test(ac));
  ok('the Today done lists, Your people, the done count and Morning team activity leave the daily comment out', (html.match(/String\(e\.what\)\.indexOf\('Daily comment'\)!==0/g) || []).length === 4);
  /* no new right, no new role */
  ok('the only right the comment checks is shipment.plan', (html.match(/may\('([a-z._]+)'\)/g) || []).length > 0 && !/may\('daily/.test(html));
  const wr = FNS.filter(f => /^(openDayComment|dcSave|dcSameAsYesterday|dcBtnHTML|dcDueHTML)$/.test(f)).map(grab).join('\n');
  ok('every writer and entry point checks shipment.plan', (wr.match(/may\('shipment\.plan'\)/g) || []).length >= 4 && /dcSave\(oid,y\.reason/.test(wr));
  ok('every save has its own row id, so 2 saves never meet on one row', /id:'DC'\+day\+'-'\+Date\.now\(\)\.toString\(36\)/.test(html));
}
report('Daily comment 29a');
