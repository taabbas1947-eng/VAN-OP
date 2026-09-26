/* 26c - 26 Sep 2026. "Batch AP26012 KEPT COMING BACK AFTER CLOSURE BY PM."
   Live fingerprint: status 'open' but closedDate / closedBy / varianceKg 1700 still on it,
   and no "closed" row in the log. Cause: after a save conflict (409) or an auto-refresh the
   baseline was re-taken from the MERGED local state, which still held the unsent close.
   A second conflict then read the close as "not ours" and took the server's older value.
   This test drives the real saveNow / startSync against a fake server.
   Run: node fixes26c.test.js */
const H = require('./harness.js'); const vm = require('vm'); const { ok, eq, report, grab, grabTopVar, html } = H;
const src = html;

ok('the baseline after a conflict is the server copy, not our merged state',
  /_srvBase=_srvCopy\(j\.data\);[\s\S]{0,400}_rev=j\.rev; _baseSnapshot=_srvBase;/.test(src));
ok('the auto-refresh takes the same server copy as its baseline',
  /const _srvBase=_srvCopy\(j\.data\);\s*state=ensureState\(merge3/.test(src));
ok('neither path re-snapshots the live state after a merge any more',
  !/_rev=j\.rev; _snapBase\(\)/.test(src));
ok('after 5 conflicts in a row the change is tried again, never left unsent',
  /else \{ _saveRetries=0; setTimeout\(save,3000\); \}/.test(src));

function world() {
  const C = o => JSON.parse(JSON.stringify(o));
  const server = { rev: 10, data: { orders: [{ id: 'O1', x: 1 }],
    batches: [{ id: 'B1', batchNo: 'AP26012', status: 'open', producedKg: 1010, plannedKg: 2710 }],
    actionLog: [{ id: 'A0', what: 'old' }] } };
  const timers = [];
  const ctx = { console, JSON, Math, Array, Object, String, Date,
    setTimeout: (f) => { timers.push(f); return timers.length; }, clearTimeout() {},
    document: { activeElement: null, hidden: false }, toast() {}, render() {}, authed: () => true,
    authHdr: () => ({}), setSession() {}, renderApp() {}, $: () => null, ensureState: s => s,
    tdAfterSave() {}, tdLastTaken: null, SESSION_KEYS: ['currentUser', 'role', 'screen', 'expanded'] };
  ctx.fetch = async (url, opt) => {
    const body = opt && opt.body ? JSON.parse(opt.body) : null;
    const baseRev = opt && opt.headers && +opt.headers['X-Base-Rev'];
    if (body) {
      if (baseRev !== server.rev) return { status: 409, ok: false, json: async () => ({ rev: server.rev, data: C(server.data) }) };
      server.data = body; server.rev++; return { status: 200, ok: true, json: async () => ({ rev: server.rev }) };
    }
    return { status: 200, ok: true, json: async () => ({ rev: server.rev, data: C(server.data) }) };
  };
  vm.createContext(ctx);
  vm.runInContext(['var state, _token="t", _buildStale=false, _rev=10, _savePending=false, _saveTimer=null;',
    'let _baseSnapshot=null, _saveRetries=0;',
    grab('dataOnly'), grab('_srvCopy'), grab('_snapBase'), grab('_arrId'), grab('_eq'), grab('merge3'),
    grab('save'), grab('saveNow')].join('\n'), ctx);
  ctx.state = C(server.data); ctx.state.currentUser = { name: 'Abdul Majid' }; ctx.state.role = 'Production Manager';
  vm.runInContext('_snapBase()', ctx);
  const other = (n) => { server.data.orders[0].x = n; server.rev++; };   // someone else saves
  return { ctx, server, timers, other, C };
}

/* Plant screen: every "Open" button opens the sheet, never signs in one tap */
{ const i = src.indexOf('dispatchGroups().forEach(function(g){ if(!g.dispId||g.delivered) return;');
  const blk = src.slice(i - 2500, i + 1500);
  ok('Plant screen: gate pass opens the truck sheet', blk.includes(`act="openTruckSign('"+g.dispId+"','gatepass')"`));
  ok('Plant screen: release opens the truck sheet', blk.includes(`act="openTruckSign('"+g.dispId+"','release')"`));
  ok('Plant screen: Approve DC opens the truck sheet', blk.includes(`act="openTruckSign('"+g.dispId+"','approvedc')"`));
  ok('Plant screen: a waiting PR opens the PR sheet', blk.includes(`openPRSheet('line','"+o.id+"','"+l.id+"')`));
  ok('Plant screen: no one-tap sign is left', !/act="(approveRelease|approveDC|issueGatePass)\('/.test(blk) && !blk.includes(`("approveRMPR('`)); }

/* ---------- a batch closed short reaches the Plant Manager (Tahir: read and mark seen) ---------- */
function ysWorld(role) {
  const b = { console, JSON, Object, String, Math, Date, toasts: [], logged: [], html: '',
    state: { role, currentUser: { name: role === 'COO' ? 'Tahir Abbas' : 'Plant Head', username: 'x' }, batches: [
      { id: 'B1', batchNo: 'AP26012', base: 'V-Ammonium Phosphate', plannedKg: 2710, producedKg: 1010, status: 'closed', varianceKg: 1700, varianceReason: 'Raw-material availability / shortage', closedBy: 'Abdul Majid', closedDate: '2026-09-26' },
      { id: 'B2', batchNo: 'HG26027', plannedKg: 1000, producedKg: 900, status: 'closed', varianceKg: 100, varianceNotify: { to: 'Plant Manager', ack: false } },
      { id: 'B3', batchNo: 'VU26163', plannedKg: 7000, producedKg: 7000, status: 'closed', varianceKg: 0 },
      { id: 'B4', batchNo: 'OPEN1', plannedKg: 7000, producedKg: 100, status: 'open', varianceKg: 6900 } ] },
    fmt: n => String(n), _pe: v => String(v), save() {}, render() {}, closeModal() {}, logAction(m) { b.logged.push(m); } };
  b.toast = m => b.toasts.push(String(m));
  b.$ = () => ({ set innerHTML(v) { b.html = v; }, classList: { add() {} } });
  vm.createContext(b);
  vm.runInContext([grab('_uRole'), grab('bpEsc'), grab('bpId'), grab('yieldShortJobs'), grab('openYieldShort'), grab('yieldShortSeen'),
    grab('dcRejectNote'), grab('dcRejectJobs'), grab('openDcRejected'), grab('dcRejectSeen')].join('\n'), b);
  return b;
}
{ const w = ysWorld('Plant Manager'); const j = w.yieldShortJobs();
  eq('closed-short batches are on the Plant Manager\'s Today (AP26012 and HG26027; not on-plan, not open)', j.map(x => x.batch.batchNo).sort().join(','), 'AP26012,HG26027');
  ok('...addressed to the Plant Manager, label Yield short', j.every(x => x.role === 'Plant Manager' && x.label === 'Yield short'));
  ok('...a close whose note was lost in the sync bug still shows (AP26012 has no varianceNotify)', j.some(x => x.batch.id === 'B1'));
  w.openYieldShort('B1'); ok('the sheet shows planned, produced, short by and the reason', /2710/.test(w.html) && /1010/.test(w.html) && /1700/.test(w.html) && /Raw-material availability/.test(w.html) && /Seen/.test(w.html));
  w.yieldShortSeen('B1'); ok('Seen clears it, with who and when', w.state.batches[0].varianceNotify.ack === true && w.state.batches[0].varianceNotify.ackBy === 'Plant Head');
  eq('...one job left', w.yieldShortJobs().length, 1); ok('...and it is logged', w.logged.some(m => /Yield short seen — AP26012/.test(m))); }
{ const w = ysWorld('Production Manager'); w.yieldShortSeen('B1');
  ok('only the Plant Manager (or COO) marks it seen', !(w.state.batches[0].varianceNotify && w.state.batches[0].varianceNotify.ack)); }
ok('Today includes the yield-short jobs', /yieldShortJobs\(\)\.forEach/.test(grab('actionItems')));

/* ---------- a truck that fails inspection: reason required, Supply Chain told (Tahir: Supply Chain re-plans) ---------- */
{ const q = grab('dispQASubmit');
  ok('a failed inspection needs Remarks (at least 5 characters)', /if\(anyFail && String\(dispQAForm\.remarks\|\|''\)\.trim\(\)\.length<5\)/.test(q));
  ok('...the reason check comes before anything is changed', q.indexOf('trim().length<5') < q.indexOf('s.voided=true'));
  ok('...and the failure is noted for Supply Chain', /dcRejectNote\(rows,String\(dispQAForm\.remarks\|\|''\)\.trim\(\),'qa'\)/.test(q)); }
{ const w = ysWorld('QA Inspector');
  w.dcRejectNote([{ dispId: 'D9', dc: 'DC-0101', po: 'PO-1', client: 'Green Farms', by: 'Saad Jamal' }], 'Bags torn, labels wrong batch', 'qa');
  const j = w.dcRejectJobs();
  ok('Supply Chain gets "Truck failed" with the reason', j.length === 1 && j[0].role === 'Supply Chain' && j[0].label === 'Truck failed' && /Bags torn/.test(j[0].what));
  w.openDcRejected(j[0].dcr.id); ok('...the sheet says the truck failed inspection', /Truck failed inspection/.test(w.html));
  w.dcRejectSeen(j[0].dcr.id); eq('...until read', w.dcRejectJobs().length, 0);
  w.dcRejectNote([{ dispId: 'D8', dc: 'DC-0102', po: 'PO-2' }], 'Wrong customer');
  eq('a rejected DC still reads "DC rejected"', w.dcRejectJobs()[0].label, 'DC rejected'); }

/* ---------- UNFIT rework keeps the results and tells Production (Tahir, 26 Sep) ---------- */
function rwWorld(role, answer) {
  const lot = { id: 'L1', lotNo: 'AP26012-L1', qty: 1010, coa: { status: 'failed', item: 'V-Ammonium Phosphate', remarks: 'P2O5 low', results: [{ p: 'P2O5', v: 40 }] } };
  const b = { console, JSON, Object, String, Math, Date, toasts: [], logged: [], html: '', answers: [].concat(answer),
    state: { role, currentUser: { name: role + ' user', username: 'u' }, audit: [], batches: [{ id: 'B1', batchNo: 'AP26012', base: 'V-Ammonium Phosphate', lots: [lot] }] },
    coaForm: { bid: 'B1', lid: 'L1' }, hardRole: r => r.indexOf(role) > -1, may: c => role === 'Production Manager' && c === 'production.enter',
    denyRight: (c, w) => 'denied: ' + w, coaItemOf: () => 'V-Ammonium Phosphate', _pe: v => String(v), fmt: n => String(n),
    save() {}, render() {}, closeModal() {}, coaFSClose() {}, logAction(m) { b.logged.push(m); } };
  b.prompt = () => b.answers.shift();
  b.toast = m => b.toasts.push(String(m));
  b.$ = () => ({ set innerHTML(v) { b.html = v; }, classList: { add() {} } });
  vm.createContext(b);
  vm.runInContext([grab('coaCtx'), grab('qcAudit2'), grab('coaRework'), grab('reworkOpen'), grab('openReworkLot'), grab('reworkDone')].join('\n'), b);
  return b;
}
{ const w = rwWorld('Plant Manager', ''); w.coaRework();
  ok('rework needs a reason', !!w.state.batches[0].lots[0].coa && /why it goes to rework/.test(w.toasts[0])); }
{ const w = rwWorld('Plant Manager', 'P2O5 below spec, re-blend with fresh MAP'); w.coaRework(); const l = w.state.batches[0].lots[0];
  ok('the failed report is kept in the lot history with the reason', l.coa === null && l.coaHistory.length === 1 && l.coaHistory[0].remarks === 'P2O5 low' && l.coaHistory[0].reworkWhy === 'P2O5 below spec, re-blend with fresh MAP');
  ok('the rework count lives on the lot, not on the wiped report', l.reworks === 1 && l.rework.n === 1);
  ok('the rework is open until Production says it is done', w.reworkOpen(l));
  ok('...and it is logged and audited with the reason', w.logged.some(m => /sent to rework after UNFIT \(#1\) — P2O5 below spec/.test(m)) && w.state.audit[0].val === 'P2O5 below spec, re-blend with fresh MAP');
  w.state.role = 'Production Manager'; w.state.currentUser = { name: 'Production Manager user' }; w.may = c => c === 'production.enter';
  w.openReworkLot('B1', 'L1'); ok('Production sees the reason and the lab remarks', /re-blend with fresh MAP/.test(w.html) && /P2O5 low/.test(w.html) && /Rework done/.test(w.html));
  w.answers = ['']; w.reworkDone('B1', 'L1'); ok('Rework done needs a note', w.reworkOpen(l));
  w.answers = ['Re-blended 1,010 Kg with fresh MAP']; w.reworkDone('B1', 'L1');
  ok('...with a note it goes back to the lab', !w.reworkOpen(l) && l.rework.doneNote === 'Re-blended 1,010 Kg with fresh MAP' && l.rework.doneBy === 'Production Manager user'); }
{ const ai = grab('actionItems');
  ok('Today: a lot in rework goes to Production and not to the lab until done', /if\(!u\.coa && u\.rework && !u\.rework\.doneAt\)\{ items\.push\(\{role:'Production'[\s\S]{0,300}label:'Rework lot'\}\); return; \}/.test(ai));
  ok('...the lot unit carries its rework', /coa:l\.coa,rework:l\.rework/.test(ai));
  ok('Today: a QA-held lot goes to the Production Manager with the reason', /filter\(p=>p&&p\.qaHold\)\.forEach\(p=>items\.push\(\{role:'Production Manager'/.test(ai) && /p\.qaHold\.reason/.test(ai)); }
ok('the Production Manager can clear a hold after fixing it', /state\.role==='Production Manager'/.test(grab('clearQaHold')) && /note\.length<5/.test(grab('clearQaHold')));

/* ---------- delivery: refused / short / damaged recorded (Tahir: record only) ---------- */
{ const c = grab('confirmDelivery'), r = grab('renderDeliveryConfirm');
  ok('the delivery sheet asks the condition on arrival', /DELIV_COND\.map/.test(r) && /Kg\/L affected/.test(r));
  ok('anything but "all received" needs Kg and a note', /if\(!\(\+delivForm\.condKg>0\)\)/.test(c) && /String\(delivForm\.note\|\|''\)\.trim\(\)\.length<5/.test(c));
  ok('it is recorded on the shipment and in the log', /s\.deliveryIssue=\{type:_cond\.k/.test(c) && /_cond\.t\+': '\+fmt\(\+delivForm\.condKg\)/.test(c));
  ok('record only: delivered quantities are computed as before', (c.match(/l\.delivered=/g) || []).length === (grab('confirmDelivery').match(/l\.delivered=/g) || []).length && !/condKg[^;]*l\.delivered/.test(c));
  const D = new Function(grabTopVar('DELIV_COND', '[') + '\nreturn DELIV_COND;')();
  ok('four conditions: all received, refused, short, damaged', D.map(x => x.k).join() === 'ok,refused,short,damaged'); }

/* ---------- a pending customer cannot be made Active without the CFO (R9) ---------- */
{ const c = grab('custToggleStatus');
  ok('"Reactivate" refuses a customer waiting for the CFO', c.indexOf("if(c.status==='Pending approval'){") > -1 && c.indexOf("if(c.status==='Pending approval'){") < c.indexOf("c.status=((c.status||'Active')==='Active')")); }

/* ---------- the Rejected COAs report reads send-backs and UNFIT reworks ---------- */
{ const i = src.indexOf('  var qcRej=[]; (state.batches||[]).forEach(function(b){ var lots=(b.lots&&b.lots.length)?b.lots:[b];');
  const j = src.indexOf('qcRej.sort(', i); const body = src.slice(i, src.indexOf(';', src.indexOf('});', j)) + 1);
  const state = { batches: [
    { id: 'B1', batchNo: 'AP26012', base: 'V-Ammonium Phosphate', lots: [
      { lotNo: 'AP26012-L1', coa: { status: 'analysed', returns: [{ id: 'R1', from: 'QCM', to: 'AQCM', by: 'Himayat', at: '2026-09-26T10:00:00Z', note: 'Moisture result missing' }] },
        coaHistory: [{ status: 'failed', reworkAt: '2026-09-25T09:00:00Z', reworkBy: 'Plant Head', reworkWhy: 'P2O5 below spec', returns: [{ id: 'R1', from: 'QCM', to: 'AQCM', by: 'Himayat', at: '2026-09-26T10:00:00Z', note: 'dup' }] }] } ] },
    { id: 'B2', batchNo: 'HG26001', base: 'Humate', coa: { rejected: { date: '2026-09-20', stage: 'review', by: 'Old', why: 'old style' } } },
    { id: 'B3', batchNo: 'X', base: 'Y', coa: { returns: [{ id: 'R9', from: 'AQCM', to: 'analyst', by: 'A', at: '2025-01-01T00:00:00Z', note: 'out of range' }] } } ] };
  const inR = d => { d = String(d || '').slice(0, 10); return d >= '2026-09-01' && d <= '2026-09-30'; };
  const qcRej = new Function('state', 'inR', body + '\nreturn qcRej;')(state, inR);
  eq('the report counts a send-back, an UNFIT rework and an old rejection (in the period, no duplicates)', qcRej.length, 3);
  ok('...the send-back says who sent it to whom, with the note', qcRej.some(r => r.stage === 'Sent back by QCM to AQCM' && r.why === 'Moisture result missing' && r.batch === 'AP26012-L1'));
  ok('...the UNFIT rework shows its reason', qcRej.some(r => /UNFIT/.test(r.stage) && r.why === 'P2O5 below spec' && r.by === 'Plant Head'));
  ok('...newest first', qcRej[0].date >= qcRej[qcRej.length - 1].date); }

/* ---------- RM Check cannot wipe a purchase request ---------- */
{ const ctx = { state: { currentUser: { name: 'Saad Jamal' }, role: 'Supply Chain' }, JSON, Object, Date, Math, String };
  vm.createContext(ctx); vm.runInContext(grab('rmPRBlocks') + '\n' + grab('rmPRArchive'), ctx);
  ok('an RM Check is blocked while a PR waits for the CFO', /waiting for the CFO/.test(ctx.rmPRBlocks({ rmPR: { qty: 500, closed: false } })));
  ok('...or is approved (use Confirm RM received)', /Confirm RM received/.test(ctx.rmPRBlocks({ rmPR: { qty: 500, cfoApproved: '2026-09-20' } })));
  ok('...or is refused (ask again or drop it)', /ask again or drop/.test(ctx.rmPRBlocks({ rmPR: { qty: 500, refused: { by: 'CFO', why: 'x' } } })));
  ok('...but not when there is no PR, or it is closed', ctx.rmPRBlocks({}) === null && ctx.rmPRBlocks({ rmPR: { closed: true } }) === null);
  const l = { rmPR: { qty: 500, closed: true, closedWhy: 'Refused by CFO: price', refused: { by: 'CFO', why: 'price' } } }; ctx.rmPRArchive(l);
  ok('a closed PR is kept in the line history before a new check replaces it', l.rmPRHistory.length === 1 && l.rmPRHistory[0].closedWhy === 'Refused by CFO: price' && l.rmPRHistory[0].replacedBy === 'Saad Jamal');
  const rs = grab('rmSubmit');
  ok('rmSubmit checks the block and archives BEFORE it writes', rs.indexOf('rmPRBlocks(l)') > -1 && rs.indexOf('rmPRArchive(l)') > -1 && rs.indexOf('rmPRArchive(l)') < rs.indexOf('l.rmPR=null') && rs.indexOf('rmPRArchive(l)') < rs.indexOf('l.rmPR={qty'));
  ok('openRMCheck refuses up front too', /rmPRBlocks\(l\)/.test(grab('openRMCheck')));
  ok('the Plant screen opens the right sheet for each PR state', src.includes(`(pr&&!pr.closed&&pr.refused)?("openPRRefused('line'`) && src.includes(`(pr&&!pr.closed&&pr.cfoApproved)?("openRMReceive(`)); }

/* ---------- a direct close keeps the request someone was waiting on ---------- */
{ const c = grab('submitClosePO');
  ok('a waiting request goes into the line history with the outcome', /var _w=lineShortRequested\(l\)\?JSON\.parse\(JSON\.stringify\(l\.shortClose\)\):null;/.test(c) && /outcome:'Closed directly by '\+who/.test(c));
  ok('...and the close itself names who asked and why', /request:\{by:_w\.requestedBy/.test(c) && /reason:_w\.reason/.test(c));
  ok('...and it is logged', /Waiting close request/.test(c)); }

/* ---------- a lot failing QA needs a reason; only QA inspects ---------- */
{ const q = grab('lotQASubmit');
  ok('only the QA Inspector (or COO) submits a lot inspection', /^function lotQASubmit\(\)\{ if\(!\(canEdit\(\['QA Inspector'\]\)\|\|state\.role==='COO'\)\)/.test(q));
  ok('a failed lot needs Remarks (at least 5 characters), checked before anything is saved', /m==='fail'\) && String\(lotQAForm\.remarks\|\|''\)\.trim\(\)\.length<5/.test(q) && q.indexOf('.length<5') < q.indexOf('p.qa=Object.assign'));
  ok('the "QA failed lot" job carries the reason', /p\.qa\.remarks\?\(': \\u201c'/.test(grab('actionItems'))); }

(async () => {
  /* the AP26012 sequence: two conflicts in a row */
  { const w = world(), s = w.ctx.state, b = s.batches[0];
    b.status = 'closed'; b.closedDate = '2026-09-26'; b.closedBy = 'Abdul Majid'; b.varianceKg = 1700;
    s.actionLog.unshift({ id: 'A1', what: 'Batch AP26012 closed' });
    w.other(2);                                   // conflict 1
    await vm.runInContext('saveNow()', w.ctx);
    w.other(3);                                   // conflict 2 lands before the retry
    await vm.runInContext('saveNow()', w.ctx);
    await vm.runInContext('saveNow()', w.ctx);    // the retry goes through
    const sb = w.server.data.batches[0];
    eq('the close reaches the server after two conflicts in a row', sb.status, 'closed');
    eq('...with who closed it', sb.closedBy, 'Abdul Majid');
    ok('...and the "closed" row stays in the log', w.server.data.actionLog.some(a => a.id === 'A1'));
    eq('...and the other person\'s edit is kept', w.server.data.orders[0].x, 3); }

  /* the same close, with an auto-refresh landing between the click and the save */
  { const w = world(), s = w.ctx.state, b = s.batches[0];
    w.other(2);
    b.status = 'closed'; b.closedBy = 'Abdul Majid';
    // what the auto-refresh does (startSync body)
    const j = { rev: w.server.rev, data: w.C(w.server.data) };
    w.ctx.j = j;
    vm.runInContext('(function(){ const base=_baseSnapshot||dataOnly(state); const _srvBase=_srvCopy(j.data); state=ensureState(merge3(base, dataOnly(state), j.data)); _rev=j.rev; _baseSnapshot=_srvBase; })()', w.ctx);
    eq('an auto-refresh keeps the unsent close on screen', w.ctx.state.batches[0].status, 'closed');
    w.other(3);
    await vm.runInContext('saveNow()', w.ctx);   // conflict
    await vm.runInContext('saveNow()', w.ctx);
    eq('...and it reaches the server after the next conflict', w.server.data.batches[0].status, 'closed'); }

  /* nothing of ours is invented: a clean pull with no local change is the server's data */
  { const w = world();
    w.server.data.batches[0].status = 'closed'; w.server.rev++;
    await vm.runInContext('saveNow()', w.ctx);   // 409, nothing of ours changed
    eq('with no local change the server\'s value wins', w.ctx.state.batches[0].status, 'closed');
    eq('...and saving it again leaves the server as it was', w.server.data.batches[0].status, 'closed'); }

  /* a reopen by someone else is still honoured (a real change on their side) */
  { const w = world(); const s = w.ctx.state;
    s.batches[0].status = 'closed'; await vm.runInContext('saveNow()', w.ctx);
    eq('clean save', w.server.data.batches[0].status, 'closed');
    w.server.data.batches[0].status = 'open'; w.server.data.batches[0].reopenedBy = 'Tahir'; w.server.rev++;
    s.orders[0].x = 9;
    await vm.runInContext('saveNow()', w.ctx); await vm.runInContext('saveNow()', w.ctx);
    eq('someone else\'s reopen is not undone by our unrelated save', w.server.data.batches[0].status, 'open');
    eq('...and our unrelated edit lands', w.server.data.orders[0].x, 9); }

  report('fixes26c');
})();
