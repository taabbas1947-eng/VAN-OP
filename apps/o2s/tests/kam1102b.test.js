/* BUILD 2026-11-02b. Tahir, 2 Nov 2026 (picture page "KAM Own Clients"): a KAM sees only his own clients
   (customer's Assigned KAM); Sales & Budget per client, a dealer shows sales only; a KAM enters POs and raises
   complaints for his own clients only; an unknown KAM name sees nothing; a new person skips old briefs and
   old change notes; a one-time welcome page for a KAM. D-360, D-361, R-051.
   Run: node kam1102b.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;
const F = ['kamOn', 'kamName', 'kamKnown', 'kamCustOf', 'kamOwns', 'kamMyCusts', 'kamRun', 'kamNoteIfUnknown', 'kamInstall', 'kamSalesRows', 'kamSalesHtml',
  'personKey', 'personFirst', 'personNewSince', 'kamWelcomeDue', 'openKamWelcome', 'kamWelcomeDone'];
const SRC = F.map(n => grab(n)).join('\n') + "\nvar _kamCallOnly=null, _kamKeep=null, _kamDepth=0, KAM_LISTS=['orders','shipments','inspections','packingLog','complaints','samples','batches','poMoves','customers'];";
function mk(role, name) {
  const cust = [
    { code: 'BKK-D', name: 'BKK', segment: 'Distributor', kam: 'Muhammad Ali' },
    { code: 'BKK-W', name: 'BKK', segment: 'White-label', kam: 'Muhammad Ali' },
    { code: 'DLR-PB-SHE-011', name: 'Naya Sawera Pesticides', segment: 'Dealer', kam: 'Muhammad Ali' },
    { code: 'MAX', name: 'MAXIM AGRI (PVT) LTD', segment: 'White-label', kam: 'Tahir Abbas' },
    { code: 'ART', name: 'Arain Traders', segment: 'Dealer', kam: 'Muhammad Irfan' },
    { code: 'COBO', name: 'COBO', segment: 'COBO', isParent: true, kam: '' },
    { code: 'COBO-001', name: 'Vital Agri Centers', segment: 'COBO', parent: 'COBO', brandKey: 'VITAL AGRI NUTRIENTS (PVT) LTD', kam: 'Muhammad Irfan' }];
  const st = { role, currentUser: { name, username: name ? name.split(' ')[1].toLowerCase() : 'x' }, masters: { kamNames: ['Tahir Abbas', 'Muhammad Ali', 'Muhammad Irfan'], salesTargets: {} },
    customers: cust,
    orders: [{ id: 'O1', po: 'P1', client: 'BKK', channel: 'White Label', lines: [] }, { id: 'O2', po: 'P2', client: 'DLR-PB-SHE-011 | Naya Sawera Pesticides', channel: 'Dealer', lines: [] },
      { id: 'O3', po: 'P3', client: 'MAXIM AGRI (PVT) LTD', channel: 'White Label', lines: [] }, { id: 'O4', po: 'P4', client: 'DLR-SN-TAN-008 | Arain Traders', channel: 'Dealer', lines: [] }],
    shipments: [{ po: 'P1' }, { po: 'P3' }], inspections: [{ po: 'P3' }], packingLog: [{ po: 'P1' }, { po: 'P3' }],
    complaints: [{ id: 'C1', po: 'P3', customer: 'MAXIM AGRI (PVT) LTD' }, { id: 'C2', po: 'P1', customer: 'BKK' }],
    samples: [{ id: 'S1', client: 'BKK', requester: { user: 'zz' } }, { id: 'S2', client: 'MAXIM AGRI (PVT) LTD', requester: { user: 'ali' } }, { id: 'S3', client: 'MAXIM AGRI (PVT) LTD', requester: { user: 'zz' } }],
    batches: [{ id: 'B1', kind: 'bulk', base: 'Amino Acid' }, { id: 'B2', kind: 'po', po: 'P3' }, { id: 'B3', kind: 'po', po: 'P1' }, { id: 'B4', kind: 'multi', allocations: [{ po: 'P3' }, { po: 'P1' }] }, { id: 'B5', kind: 'multi', allocations: [{ po: 'P3' }] }],
    poMoves: [{ fromPo: 'P3', toPo: 'P1' }, { fromPo: 'P3', toPo: 'P4' }], audit: [], readSigns: [] };
  const view = { html: '', insertAdjacentHTML(w, h) { this.html = h + this.html; }, querySelector() { return null; } };
  const b = { console, JSON, Object, String, Array, Date, Math, state: st, saved: 0, toasts: [], view, $: id => id === 'view' ? view : { innerHTML: '', classList: { add() {} } },
    qsEsc: x => String(x), fmt: x => String(x), _plMemo: 1, toast: m => b.toasts.push(m), save: () => { b.saved++; }, nid: p => p + '1', BUILD_ID: 'T', closeModal() {}, checkWhatsNew() {}, evToday: () => '2026-11-02' };
  vm.createContext(b); vm.runInContext('var window=this;', b); vm.runInContext(SRC, b); return b; }
/* who owns what */
{ const b = mk('KAM', 'Muhammad Ali');
  ok('a dealer PO is matched by its code', b.kamOwns('DLR-PB-SHE-011 | Naya Sawera Pesticides'));
  ok('BKK (2 records, both Ali) is his', b.kamOwns('BKK'));
  ok('Maxim is not his', !b.kamOwns('MAXIM AGRI (PVT) LTD'));
  ok('Arain Traders is Irfan\'s, not Ali\'s', !b.kamOwns('DLR-SN-TAN-008 | Arain Traders') && b.kamOwns('DLR-SN-TAN-008 | Arain Traders', 'Muhammad Irfan'));
  ok('a parent record is never matched', !b.kamOwns('COBO', ''));
  ok('a COBO PO (company name) is Irfan\'s through the COBO-001 record, not Ali\'s', b.kamOwns('VITAL AGRI NUTRIENTS (PVT) LTD', 'Muhammad Irfan') && !b.kamOwns('VITAL AGRI NUTRIENTS (PVT) LTD'));
  ok('a dealer is never matched by its brand key', !b.kamOwns('Dealers', 'Muhammad Ali'));
  eq('his customers', b.kamMyCusts().map(c => c.code).join(','), 'BKK-D,BKK-W,DLR-PB-SHE-011'); }
/* the narrowed lists while a screen is drawn */
{ const b = mk('KAM', 'Muhammad Ali'); const S = b.state, full = { o: S.orders, s: S.shipments, c: S.customers, bt: S.batches };
  let seen = null;
  b.kamRun(function () { seen = { o: S.orders.map(x => x.po).join(), s: S.shipments.map(x => x.po).join(), i: S.inspections.length, p: S.packingLog.map(x => x.po).join(), c: S.complaints.map(x => x.id).join(), sm: S.samples.map(x => x.id).join(), bt: S.batches.map(x => x.id).join(), mv: S.poMoves.length, cu: S.customers.map(x => x.code).join(), nested: b.kamRun(() => S.orders.length) }; });
  eq('orders: only his', seen.o, 'P1,P2'); eq('shipments: only his', seen.s, 'P1'); eq('inspections: none of his', seen.i, 0); eq('packing: only his', seen.p, 'P1');
  eq('complaints: only his', seen.c, 'C2'); eq('samples: his client, or asked by him', seen.sm, 'S1,S2');
  eq('batches: bulk kept, PO batches only his, a shared multi batch kept', seen.bt, 'B1,B3,B4');
  eq('stock moves touching his POs', seen.mv, 1); eq('customers: his and the parents', seen.cu, 'BKK-D,BKK-W,DLR-PB-SHE-011,COBO'); eq('nested call sees the same narrow list', seen.nested, 2);
  ok('afterwards the very same full lists are back', S.orders === full.o && S.shipments === full.s && S.customers === full.c && S.batches === full.bt && S.orders.length === 4);
  ok('the Plant memo is cleared after the draw', b._plMemo === null);
  try { b.kamRun(() => { throw new Error('x'); }); } catch (e) {}
  ok('a draw that fails still puts the full lists back', S.orders === full.o && b._kamDepth === 0); }
{ const b = mk('Supply Chain', 'Saad Jamal'); let n = 0; b.kamRun(() => { n = b.state.orders.length; }); eq('any other role sees everything', n, 4); }
{ const b = mk('KAM', 'Muhammad Akram'); let n = -1, c = -1, bt = -1, cu = -1; b.kamRun(() => { n = b.state.orders.length; c = b.state.complaints.length; bt = b.state.batches.length; cu = b.state.customers.length; });
  ok('a KAM whose name is not on the KAM list sees no client, no batch, no customer', n === 0 && c === 0 && bt === 0 && cu === 0 && !b.kamKnown());
  b.kamNoteIfUnknown(); ok('and is told to ask Ahmer', /not on the KAM list/.test(b.view.html) && /Ask Ahmer/.test(b.view.html)); }
{ const b = mk('KAM', 'Muhammad Ali'); let inside = -1; b.render = function () { inside = b.state.orders.length; }; b.kamInstall();
  b.render(); ok('render() is wrapped: it draws only his orders, and the full list is back after', inside === 2 && b.state.orders.length === 4 && b.render._kam === 1); }
/* Sales & Budget for a KAM */
{ const b = mk('KAM', 'Muhammad Ali'); b.state.masters.salesTargets = { 'BKK': { '2026-27': 1000 }, 'Dealers': { '2026-27': 99999 } };
  vm.runInContext(`function fyKey(d){ return '2026-27'; } function evToday(){ return '2026-11-02'; } function _plDay(d){ return d; }
    function budgetKey(o){ return o.channel==='Dealer'?'Dealers':o.client; } function budgetTargetOf(ST,k,ch,fy){ return +((ST[k]||{})[fy])||0; }
    function saleOpenValue(o,l){ return +l.open||0; }
    function saleRows(){ return [{client:'BKK',channel:'White Label',key:'BKK',fy:'2026-27',month:'2026-11',value:300},{client:'BKK',channel:'White Label',key:'BKK',fy:'2026-27',month:'2026-10',value:200},
      {client:'DLR-PB-SHE-011 | Naya Sawera Pesticides',channel:'Dealer',key:'Dealers',fy:'2026-27',month:'2026-10',value:50}]; }`, b);
  b.state.orders[0].lines = [{ open: 70 }];
  const R = b.kamRun(() => b.kamSalesRows()); const bkk = R.filter(r => r.client === 'BKK' && r.channel === 'White Label')[0], dl = R.filter(r => /Naya/.test(r.client))[0];
  ok('BKK: target 1,000, sold 500 FY, 300 this month, 70 open', bkk && bkk.target === 1000 && bkk.fy === 500 && bkk.mo === 300 && bkk.open === 70);
  ok('the dealer shows its sales only, never the shared dealers target', dl && dl.dealer === true && dl.target === null && dl.fy === 50);
  const h = b.kamRun(() => b.kamSalesHtml());
  ok('the page leads with his FY sold total and says dealers show sales only', /Your clients: PKR 550 sold this financial year/.test(h) && /dealer: sales only/.test(h) && !/99999/.test(h)); }
/* someone new */
{ const b = mk('KAM', 'Muhammad Ali'); const r = b.personFirst();
  ok('no read-and-sign and no audit row before: new, from today', r.isNew === true && b.saved === 1 && b.personNewSince() === r.day);
  b.personFirst(); ok('recorded once only', b.saved === 1); }
{ const b = mk('Supply Chain', 'Saad Jamal'); b.state.readSigns = [{ user: 'jamal', brief: '2026-10-13-15' }]; const r = b.personFirst();
  ok('someone who signed before is not new', r.isNew === false && b.personNewSince() === ''); }
{ const b = mk('QCM', 'Himayat Hussain'); b.state.audit = [{ user: 'Himayat Hussain' }]; ok('someone with an audit row before is not new', b.personFirst().isNew === false); }
/* the welcome page */
{ const b = mk('KAM', 'Muhammad Ali'); ok('a KAM with no welcome tick gets the page', b.kamWelcomeDue());
  b.openKamWelcome(); b.document = { getElementById: id => id === 'kw_tick' ? { checked: false } : null }; vm.runInContext('var document=this.document;', b);
  b.kamWelcomeDone(); ok('Start without the tick is refused', b.saved === 0 && /Tick/.test(b.toasts.pop()));
  b.document.getElementById = id => id === 'kw_tick' ? { checked: true } : null; b.kamWelcomeDone();
  ok('ticked: 1 row kept with who and when, never shown again', b.saved === 1 && b.state.welcomeSigns.length === 1 && b.state.welcomeSigns[0].user === 'ali' && !b.kamWelcomeDue()); }
{ const b = mk('Supply Chain', 'Saad Jamal'); ok('other roles get no welcome page', !b.kamWelcomeDue()); }
/* read-and-sign and change notes skip what was written before a new person joined */
{ const rp = grab('rsPending'); const c = { state: { currentUser: { name: 'A', username: 'ali' }, role: 'KAM', orders: [1] }, _rsSeed: false, RS_ALL: [], used: [],
    RS_BRIEFS: [{ id: '2026-10-13-15', roles: ['KAM'] }, { id: '2026-11-05x', roles: ['KAM'] }], rsUse(b) { c.used.push(b.id); }, rsMySign: () => null, nf: '2026-11-02', personNewSince: () => c.nf };
  vm.createContext(c); vm.runInContext(rp, c);
  ok('a new person is not stopped by a brief written before he joined', c.rsPending() === true && c.used[0] === '2026-11-05x');
  c.RS_BRIEFS.pop(); c.used = []; ok('with only old briefs: nothing to sign', c.rsPending() === false);
  c.nf = ''; ok('someone not new still has to sign it', c.rsPending() === true); }
{ const cw = grab('checkWhatsNew'); const store = {}; const c = { state: { currentUser: { name: 'Muhammad Ali' } }, shown: null, nf: '2026-11-02', personNewSince: () => c.nf,
    CHANGELOG: [{ ver: 'a', date: '2026-10-01' }, { ver: 'b', date: '2026-11-02' }], localStorage: { getItem: k => store[k] || '', setItem: (k, v) => { store[k] = v; } },
    $: () => ({ classList: { add() {} }, set innerHTML(v) { c.shown = v; } }), renderWhatsNewHtml: e => e.map(x => x.ver).join(','), _whatsNewShown: false };
  vm.createContext(c); vm.runInContext(cw.replace(/^function checkWhatsNew/, 'var _whatsNewShown=false;function checkWhatsNew'), c); c.checkWhatsNew();
  eq('a new person sees only the change notes from the day he joined', c.shown, 'b'); }
/* nothing narrow ever leaves the page */
{ const b = mk('KAM', 'Muhammad Ali'); vm.runInContext(grab('dataOnly') + "\nvar SESSION_KEYS=['currentUser','role','screen','expanded'];", b); let out = null, outside = null;
  b.kamRun(() => { out = b.dataOnly(b.state); }); outside = b.dataOnly(b.state);
  ok('a save, merge or export made while his screen is drawn carries the full lists', out.orders.length === 4 && out.customers.length === 7 && out.batches.length === 5 && !('role' in out));
  ok('and outside the draw nothing changes', outside.orders.length === 4 && b._kamKeep === null); }
/* review fixes */
{ const b = mk('KAM', 'Muhammad Ali'); b._chanToSeg = ch => ({ 'White Label': 'White-label', Distributor: 'Distributor', Dealer: 'Dealer', Cobo: 'COBO', Vgreen: 'VGreen', Farmer: 'Direct Farmer' })[ch] || '';
  b.state.customers[1].kam = 'Muhammad Imran';   /* BKK white label now Imran's, BKK distributor stays Ali's */
  ok('a name in 2 segments follows the PO channel', !b.kamOwns('BKK', null, null, 'White Label') && b.kamOwns('BKK', null, null, 'Distributor') && b.kamOwns('BKK', 'Muhammad Imran', null, 'White Label'));
  b.state.customers.push({ code: 'FRM-1', name: 'Some Farmer', segment: 'Direct Farmer', brandKey: 'Vgreen', kam: 'Muhammad Ali' });
  ok('a farmer given to a KAM never brings him the Vgreen POs', !b.kamOwns('Vgreen') && b.kamOwns('Some Farmer')); }
{ const b = mk('KAM', 'Muhammad Ali'); b.state.complaints.push({ id: 'C3', po: 'P3', customer: 'MAXIM AGRI (PVT) LTD', contain: { rows: [{ kind: 'customer', customer: 'BKK', owner: { user: 'ali' } }] } });
  let ids = ''; b.kamRun(() => { ids = b.state.complaints.map(x => x.id).join(); });
  ok('a complaint where he is asked to call his own client stays in the list that builds his Today jobs', ids === 'C2,C3');
  vm.runInContext(grab('cmpAll'), b); let listed = ''; b.kamRun(() => { listed = b.cmpAll().map(x => x.id).join(); });
  ok('but the complaints page does not list that other client\'s complaint', listed === 'C2' && b.cmpAll().length === 3 && b._kamCallOnly === null); }
{ const b = mk('KAM', 'Muhammad Ali'); b.state.actionLog = [{ by: 'Muhammad Ali', what: 'Signed in' }]; ok('his own sign-in line does not make a new person old', b.personFirst().isNew === true); }
{ const b = mk('KAM', 'Muhammad Ali'); vm.runInContext(grab('smpCustomers'), b); eq('the sample form offers only his own clients', b.smpCustomers().join('|'), 'BKK|Naya Sawera Pesticides');
  b.state.role = 'COO'; ok('other roles get every client', b.smpCustomers().length === 5); }
ok('a sample for someone else\'s client is refused', /if\(typeof kamOn==='function'&&kamOn\(\)&&f\.client!=='__new'&&smpCustomers\(\)\.indexOf\(f\.client\)<0\)/.test(grab('smpSubmit')));
ok('the complaint containment table shows a KAM only his own clients\' rows', /if\(kamOn\(\)\)\{ var _me=/.test(grab('cmpContainSummary')));
{ const b = mk('Supply Chain', 'Saad Jamal'); b.state.actionLog = [{ by: 'Saad Jamal', what: 'x' }]; ok('someone in the action log is not new', b.personFirst().isNew === false); }
ok('the welcome page cannot be closed by tapping outside it', /onclick="if\(event\.target===this&&!window\._kamWelcomeOpen\)closeModal\(\)"/.test(html) && /window\._kamWelcomeOpen=true;/.test(grab('openKamWelcome')) && /window\._kamWelcomeOpen=false;/.test(grab('kamWelcomeDone')));
/* wiring */
ok('a KAM is offered only his own clients on New order', /if\(kamOn\(\)&&!_kamCFC\)\{ _kamCFC=1; try\{ return clientsForChannel\(ch\)\.filter\(function\(x\)\{ return x&&kamOwns\(x\.id,null,null,ch\); \}\);/.test(html));
ok('the KAM field on New order holds only his own name', /\(kamOn\(\)\?\[kamName\(\)\]:/.test(html));
ok('submitPO refuses a client that is not his', /if\(kamOn\(\)&&!kamOwns\(entryClient,null,null,entryChannel\)\)\{ toast\('You can enter a PO only for your own clients\./.test(grab('submitPO')));
{ const r = grab('cmpRaise'); ok('a KAM may raise, never send, and only for his own client', /if\(!cmpBoss\(\)&&!kamOn\(\)\)/.test(r) && /if\(!cmpBoss\(\)\)\{ send=false; if\(!kamOwns\(f\.customer\)\)/.test(r)); }
ok('the Complaints page opens for a KAM with a Raise tab and no Send to', /if\(!cmpWatcher\(\)&&!kamOn\(\)\)/.test(grab('screenComplaints')) && /if\(boss\|\|kamOn\(\)\) tabs\.push\(\['raise'/.test(grab('screenComplaints')) && /if\(T&&!kamOn\(\)\)/.test(grab('cmpRaiseHTML')));
ok('Sales & Budget for a KAM is his own table', /if\(kamOn\(\)&&!\(typeof mayMoney==='function'&&!mayMoney\(\)\)\)\{ \$\('view'\)\.innerHTML=kamSalesHtml\(\); return; \}/.test(grab('screenBudget')));
ok('sign-in: first-seen kept, then read-and-sign, else the welcome page, else the change notes', /render\(\); try\{ personFirst\(\); \}catch\(e\)\{\} if\(rsPending\(\)\) openReadSign\(\); else if\(kamWelcomeDue\(\)\)\{ closeReadSign\(\); openKamWelcome\(\); \} else \{ closeReadSign\(\); checkWhatsNew\(\); \}/.test(html));
ok('the wrapper is installed before the app starts', /\nkamInstall\(\);[^\n]*\nbootState\(\);\n<\/script>/.test(html));
ok('Guide rule, changelog and build', /<h3>A KAM sees only his own clients<\/h3>/.test(html) && /'A KAM sees only his own clients':'R-051'/.test(html) && /ver:'2026-11-02b'/.test(html) && /var BUILD_ID='2026-11-(02[b-z]|0[3-9][a-z]|[1-3]\d[a-z])'/.test(html));
process.exitCode = report('11-02b: a KAM sees only his own clients') ? 1 : 0;
