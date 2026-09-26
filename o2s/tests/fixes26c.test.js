/* 26c - 26 Sep 2026. "Batch AP26012 KEPT COMING BACK AFTER CLOSURE BY PM."
   Live fingerprint: status 'open' but closedDate / closedBy / varianceKg 1700 still on it,
   and no "closed" row in the log. Cause: after a save conflict (409) or an auto-refresh the
   baseline was re-taken from the MERGED local state, which still held the unsent close.
   A second conflict then read the close as "not ours" and took the server's older value.
   This test drives the real saveNow / startSync against a fake server.
   Run: node fixes26c.test.js */
const H = require('./harness.js'); const vm = require('vm'); const { ok, eq, report, grab, html } = H;
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
