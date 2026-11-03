/* BUILD 2026-11-03a. Tahir, 3 Nov 2026 (picture page "Access Fixes 3 Nov"): Correct a record by area (D-362, R-052);
   Sales & Budget to look at for Finance, Supply Chain and the Production Manager (D-363); a late Receive or RM Check goes
   up to the Plant Manager (D-364). Run: node area1103a.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, grabTopVar, html } = H;
const DF = grabTopVar('DF_AREAS', '{') + '\n' + ['dfMay', 'dfMayOp', 'dfAnyArea', 'dfWho', 'dfLineFixMay', 'dfLineFixCan', 'dfOn'].map(grab).join('\n') + "\nvar DF_OFF_MSG='OFF';";
function mk(role, tick, extra) {
  const b = Object.assign({ console, JSON, Object, String, Array, Date, Math, toasts: [], state: { role, dataFixEnabled: true },
    screenEditOK: id => id === 'datafix' ? !!tick : false, toast: m => { b.toasts.push(String(m)); } }, extra || {});
  vm.createContext(b); vm.runInContext(DF, b); return b; }
const ALL = ['po', 'correct', 'produced', 'production', 'packing', 'void', 'shipment'];
const WANT = { COO: ALL, CFO: ['po', 'correct'], 'Plant Manager': ['produced', 'production', 'packing', 'void', 'shipment'],
  'Production Manager': ['produced', 'production', 'packing', 'void'], 'Supply Chain': ['shipment'], Production: [], KAM: [], Finance: [], 'Supply Chain Officer': [] };
/* 1. who holds which part, with the launcher tick */
Object.keys(WANT).forEach(role => { const b = mk(role, true);
  ALL.forEach(a => eq(role + ' · ' + a, b.dfMay(a), WANT[role].indexOf(a) > -1)); });
/* 2. no tick, no part */
['COO', 'CFO', 'Plant Manager', 'Production Manager', 'Supply Chain'].forEach(role => { const b = mk(role, false);
  ok(role + ' without the Correct a record tick holds no part', !b.dfAnyArea()); });
/* 3. Correct values: the CFO all of it, the Plant Manager and the Production Manager Produced only */
{ ok('CFO opens Correct values', mk('CFO', true).dfMayOp('correct'));
  ok('Production Manager opens Correct values (Produced only)', mk('Production Manager', true).dfMayOp('correct') && !mk('Production Manager', true).dfMay('correct'));
  ok('Supply Chain does not open Correct values', !mk('Supply Chain', true).dfMayOp('correct')); }
/* 4. the order line Fix sheet and Reconcile's fix follow the areas (Tahir, 3 Nov 12:00: "split by area too") */
{ const L = { COO: [1, 1], CFO: [0, 0], 'Plant Manager': [1, 1], 'Production Manager': [1, 0], 'Supply Chain': [0, 1], Production: [0, 0], Finance: [0, 0] };
  Object.keys(L).forEach(role => { const b = mk(role, true);
    eq(role + ' · packing fixes (rec, cut)', [b.dfLineFixMay('rec'), b.dfLineFixMay('cut')].join(), [!!L[role][0], !!L[role][0]].join());
    eq(role + ' · delivery date', b.dfLineFixMay('date'), !!L[role][1]);
    eq(role + ' · any fix at all', b.dfLineFixMay(), !!(L[role][0] || L[role][1])); });
  ok('no tick, no line fix', !mk('Plant Manager', false).dfLineFixMay());
  const pm = mk('Production Manager', true), sc = mk('Supply Chain', true);
  ok('dfLineFixCan: Majid can fix an untraced line, not an undated one', pm.dfLineFixCan([{ k: 'untraced' }]) && !pm.dfLineFixCan([{ k: 'undated' }]));
  ok('dfLineFixCan: Saad can fix an undated line, not an untraced one', sc.dfLineFixCan([{ k: 'undated' }]) && !sc.dfLineFixCan([{ k: 'untraced' }]));
  ok('dfLineFixCan: an overused line is nobody\'s fix here', !mk('COO', true).dfLineFixCan([{ k: 'overused' }]));
  ok('_lfGuard asks the area of the fix', /function _lfGuard\(mode\)\{ if\(!dfOn\(\)\)\{ toast\(DF_OFF_MSG\); return null; \} if\(!dfLineFixMay\(mode\)\)/.test(grab('_lfGuard')));
  ok('the 3 writers name their area', /_lfGuard\('rec'\)/.test(grab('lineFixRecord')) && /_lfGuard\('cut'\)/.test(grab('lineFixCut')) && /_lfGuard\('date'\)/.test(grab('lineFixDate')));
  const lo = grab('lineFixOpen');
  ok('the sheet: ed from dfLineFixCan, packing buttons need edP, the date button edD', /ed=_on&&dfLineFixCan\(I\)/.test(lo) && /edP&&canRec>0\.5\?btn\('rec'/.test(lo) && /edP&&canCut\?btn\('cut'/.test(lo) && /edD&&I\.some/.test(lo));
  ok('the sheet: a mode outside your area does not open', /if\(lfForm\.mode&&\(!dfOn\(\)\|\|!dfLineFixMay\(lfForm\.mode\)\)\) lfForm\.mode='';/.test(lo));
  ok('Reconcile\'s fix (a packing difference) asks the packing area', /if\(!dfOn\(\)\|\|!dfLineFixMay\('rec'\)\) return ''/.test(grab('reconFixBtn')));
  ok('History and fix: only when you can fix one of the issues', /_I\.length&&dfOn\(\)&&dfLineFixCan\(_I\)\?' and fix'/.test(html));
  /* the writers refuse outside the area */
  [['lineFixRecord', 'Supply Chain'], ['lineFixCut', 'CFO'], ['lineFixDate', 'Production Manager']].forEach(([fn, role]) => {
    const b = mk(role, true, { lfForm: { reason: 'checked on paper' }, _lfCtx: () => ({ o: {}, l: {} }) }); vm.runInContext(grab('_lfGuard') + '\nvar DF_LINEFIX_WHO="W";', b);
    eq(fn + ' · ' + role + ' is refused', b._lfGuard(fn === 'lineFixRecord' ? 'rec' : fn === 'lineFixCut' ? 'cut' : 'date'), null); });
  { const b = mk('Plant Manager', true, { lfForm: { reason: 'checked on paper' }, _lfCtx: () => ({ o: {}, l: {} }) }); vm.runInContext(grab('_lfGuard') + '\nvar DF_LINEFIX_WHO="W";', b);
    ok('the Plant Manager passes all 3', ['rec', 'cut', 'date'].every(m => b._lfGuard(m) !== null)); } }
/* 5. the save buttons check the area, not only the screen */
[['dfSubmitProduction', 'production'], ['dfSubmitPacking', 'packing'], ['dfSubmitVoid', 'void'], ['dfSubmitShipment', 'shipment'], ['dfSubmitPO', 'po']].forEach(([fn, area]) => {
  const src = grab(fn);
  ok(fn + ' asks dfMay(\'' + area + '\') first', src.indexOf("if(!dfMay('" + area + "'))") > -1 && src.indexOf("if(!dfMay('" + area + "'))") < 120);
  Object.keys(WANT).forEach(role => { const b = mk(role, true, { dfForm: { reason: '' }, dfReasonOk: () => false, state: { role, dataFixEnabled: true, orders: [], batches: [], packingLog: [] } });
    vm.runInContext(src, b); try { b[fn](); } catch (e) {}
    const refused = b.toasts.some(t => /is for the|Edit access|OFF/.test(t));
    eq(fn + ' · ' + role + (refused ? ' refused' : ' let through'), !refused, WANT[role].indexOf(area) > -1); }); });
/* 6. dfSubmitCorrect: each field only for its own area */
function correctRun(role) {
  const o = { id: 'O1', po: 'P1', client: 'A', channel: 'White Label', priority: 'Normal', received: '2026-10-01', promised: '2026-10-10', printDecision: 'yes',
    lines: [{ id: 'L1', brand: 'X', produced: 10, invoicePrice: 100, printPrice: 50, committed: '2026-10-20' }] };
  const vals = { co_reason: 'The paper says so, checked today', co_reasonCode: 'typo', co_client: 'B', co_channel: 'Dealer', co_priority: 'High', co_received: '2026-10-02',
    co_promised: '2026-10-25', co_printDecision: 'no', cl_produced_L1: '20', cl_invoicePrice_L1: '200', cl_printPrice_L1: '60' };
  const rec = [];
  const b = mk(role, true, { $: id => (id in vals) ? { value: vals[id] } : null, dfForm: { oid: 'O1' }, state: { role, dataFixEnabled: true, orders: [o] },
    recordCorrection: (op, t, id, label, chg) => rec.push(...chg.map(c => c.field)), save() {}, dfBack() {}, fmt: x => String(x), shortClient: x => x });
  vm.runInContext(grab('dfSubmitCorrect'), b); b.dfSubmitCorrect(); return { o, rec, toasts: b.toasts }; }
{ const c = correctRun('CFO');
  eq('CFO: customer changed', c.o.client, 'B'); eq('CFO: invoice price changed', c.o.lines[0].invoicePrice, 200); eq('CFO: print decision changed', c.o.printDecision, 'no');
  eq('CFO: Produced NOT changed', c.o.lines[0].produced, 10); ok('CFO: no Produced row in the register', c.rec.indexOf('produced') < 0); }
{ const c = correctRun('Production Manager');
  eq('Production Manager: Produced changed', c.o.lines[0].produced, 20); eq('Production Manager: customer NOT changed', c.o.client, 'A');
  eq('Production Manager: prices NOT changed', c.o.lines[0].invoicePrice + '/' + c.o.lines[0].printPrice, '100/50'); eq('Production Manager: promised NOT changed', c.o.promised, '2026-10-10');
  eq('Production Manager: no committed date cascade', c.o.lines[0].committed, '2026-10-20'); eq('Production Manager: only Produced in the register', c.rec.join(','), 'produced'); }
{ const c = correctRun('Supply Chain'); eq('Supply Chain is refused Correct values', c.o.client + c.o.lines[0].produced, 'A10'); ok('...with a message', c.toasts.length > 0); }
{ const c = correctRun('COO'); eq('COO changes all', [c.o.client, c.o.lines[0].produced, c.o.lines[0].invoicePrice].join('/'), 'B/20/200'); }
/* 7. the form disables what is not yours; the cards show who does a part */
{ const f = (html.match(/if\(op==='correct'\)\{[\s\S]*?if\(op==='po'\)\{/) || [''])[0];
  ok('Correct form: header fields carry ${dis}', /id="co_client"[^>]*\$\{dis\}/.test(f) && /id="co_promised"[^>]*\$\{dis\}/.test(f) && /id="co_printDecision"[^>]*\$\{dis\}/.test(f));
  ok('Correct form: Produced carries ${disP}, print price ${dis}', /cl_produced_\$\{l\.id\}[^>]*\$\{disP\}/.test(f) && /cl_printPrice_\$\{l\.id\}[^>]*\$\{dis\}/.test(f));
  const cards = grab('dfCardsHtml');
  ok('cards: a part outside your area is greyed with who does it', /For the \$\{dfWho\(a\)\}/.test(cards) && /const mine=active&&dfMay\(op\)/.test(cards));
  const b = mk('Production Manager', true); vm.runInContext(cards, b); const h = b.dfCardsHtml();
  ok('Majid: Production has Add missing', /<b>Production<\/b><div style="margin-top:8px"><button[^>]*dfStart\('production'\)/.test(h));
  ok('Majid: Order / PO is greyed, for the COO and CFO', /<b>Order \/ PO<\/b><div class="muted"[^>]*>For the COO and CFO/.test(h));
  ok('Majid: Shipment is greyed, for the COO, Plant Manager and Supply Chain', /Shipment \/ Delivery<\/b><div class="muted"[^>]*>For the COO, Plant Manager and Supply Chain/.test(h));
  ok('Majid: Correct values says Produced only', /Correct values<\/b> <span[^>]*>\(Produced only\)/.test(h));
  ok('Majid: Void has its button', /dfStart\('void'\)/.test(h));
  const s = mk('Supply Chain', true); vm.runInContext(cards, s); const hs = s.dfCardsHtml();
  ok('Saad: only Shipment has Add missing', /dfStart\('shipment'\)/.test(hs) && !/dfStart\('(po|production|packing|void|correct)'\)/.test(hs)); }
/* 8. the page and dfStart */
{ const sd = grab('screenDataFix');
  ok('the page opens for anyone with a part (dfAnyArea), not the COO only', /if\(!dfAnyArea\(\)\)/.test(sd) && !/if\(!isCOO\)\{ \$\('view'\)\.innerHTML=`<div class="banner warn">Correct a record is for the COO\.<\/div>`/.test(sd));
  ok('the switch button is still the COO\'s only', /const toggle = isCOO/.test(sd));
  ok('dfStart refuses a part outside your area', /function dfStart\(op\)\{ if\(!dfMayOp\(op\)\)/.test(grab('dfStart'))); }
/* 9. COO-only console controls */
['toggleDataFix', 'importGoLivePOs', 'exportStateJSON', 'startNewYearClean', 'importSnapshotStart', 'importSnapshotApply'].forEach(fn =>
  ok(fn + ' is the COO\'s only', /if\(state\.role!=='COO'\)\{ toast\(/.test(grab(fn).slice(0, 200))));
/* 10. Sales & Budget */
{ ok('MONEY_ROLES unchanged (R6)', /var MONEY_ROLES=\['COO','CFO','Plant Manager','KAM'\];/.test(html));
  ok('BUDGET_VIEW_ROLES are the 3', /var BUDGET_VIEW_ROLES=\['Finance','Supply Chain','Production Manager'\];/.test(html));
  ok('Set the budget / Set invoice prices stay COO and CFO (ed)', /ed=\(state\.role==='COO'\|\|state\.role==='CFO'\)/.test(grab('budgetHtml')));
  const SB = grabTopVar('BUDGET_VIEW_ROLES', '[') + "\nvar MONEY_ROLES=['COO','CFO','Plant Manager','KAM'], INVOICE_ROLES=['Finance'], rpCur='';\n" + grab('mayMoney') + '\n' + grab('screenBudget');
  ['Finance', 'Supply Chain', 'Production Manager', 'CFO', 'Plant Manager', 'Production', 'Warehouse', 'Lab Rep'].forEach(role => {
    const view = { innerHTML: '' }; const b = { state: { role, screen: 'budget' }, $: () => view, kamOn: () => false, kamSalesHtml: () => 'KAM', budgetHtml: () => 'BUDGET' };
    vm.createContext(b); vm.runInContext(SB, b); b.screenBudget();
    const want = ['Finance', 'Supply Chain', 'Production Manager', 'CFO', 'Plant Manager'].indexOf(role) > -1;
    eq('Sales & Budget · ' + role + (want ? ' opens' : ' refused'), view.innerHTML === 'BUDGET', want);
    if (['Finance', 'Supply Chain', 'Production Manager'].indexOf(role) > -1) { vm.runInContext("state.screen='tracker'", b); ok(role + ': mayMoney stays false elsewhere', !b.mayMoney()); } }); }
/* 11. escalation */
{ const a = grab('acEscalation');
  ok("RM Check goes up to the Plant Manager", /'RM Check':\[1,'Plant Manager'\]/.test(a)); ok("Receive goes up to the Plant Manager", /'Receive':\[1,'Plant Manager'\]/.test(a));
  ok('nothing else goes up to the CFO from these 2', !/'RM Check':\[1,'CFO'\]|'Receive':\[1,'CFO'\]/.test(a));
  const R = require(require('path').join(__dirname, '..', 'notify-routes.js'));
  eq('the alert server sends a late RM Check to the Plant Manager too', R.ESC_TO && R.ESC_TO['RM Check'], 'Plant Manager');
  eq('...and a late Receive', R.ESC_TO && R.ESC_TO['Receive'], 'Plant Manager'); }
/* 13. review 1 fixes: shipment no longer COO only; the menus and the Guide follow the areas; Reports reaches the page */
{ ok('the old "Back-filling a truck is the COO\u2019s" line is gone', !/Back-filling a truck is the COO/.test(grab('dfSubmitShipment')));
  ['Supply Chain', 'Plant Manager'].forEach(role => { const b = mk(role, true, { dfForm: { reason: '' }, dfReasonOk: () => false, state: { role, dataFixEnabled: true, orders: [], batches: [], packingLog: [] } });
    vm.runInContext(grab('dfSubmitShipment'), b); try { b.dfSubmitShipment(); } catch (e) {}
    ok(role + ' passes the shipment gates (next stop: the reason)', !b.toasts.some(t => /COO|is for the|Edit access/.test(t)), JSON.stringify(b.toasts)); });
  ok('the sidebar shows Correct a record to anyone with a part', /\(id!=='datafix' \|\| dfAnyArea\(\)\)/.test(html));
  ok('the Back Office tile shows Correct a record to anyone with a part', /go:"boOpen\('datafix'\)", st:'st-na', ok:dfAnyArea\(\)&&canView\(state\.role,'datafix'\)/.test(html));
  ok('Reports: the Sales against budget card opens for the 3', /if\(c\.kind==='budget'&&BUDGET_VIEW_ROLES\.indexOf\(state\.role\)>-1\) return true;/.test(grab('rpMay')));
  ok('the Guide says who opens Correct a record and Sales & Budget', /if\(id==='datafix'\) return _asRole\(r,dfAnyArea\);/.test(grab('gdScreenOpen')) && /BUDGET_VIEW_ROLES\.indexOf\(r\)>-1/.test(grab('gdScreenOpen')));
  ok('the snapshot hint is shown to the COO only', /\$\{state\.role==='COO'\?' Take a snapshot first/.test(html));
  const s = mk('Supply Chain', true); vm.runInContext(grab('dfCardsHtml'), s); const hs = s.dfCardsHtml();
  ok('Saad\'s greyed Correct values names the Produced roles too', /For the COO and CFO; Produced also for the Plant Manager and Production Manager/.test(hs)); }
/* 14. review 2: Finance's Sales and invoicing card still opens the Invoicing sheet first; the Guide's Back Office line */
{ ok('a group card opens its first non-budget report for the 3 who only look', /var _first=\(BUDGET_VIEW_ROLES\.indexOf\(state\.role\)>-1&&MONEY_ROLES\.indexOf\(state\.role\)<0&&rs\.length>1&&rs\[0\]\.kind==='budget'\)\?rs\[1\]:rs\[0\];/.test(html) && /onclick="rpOpen\(\\''\+_first\.id\+'\\'\)"/.test(html));
  const grp = (html.match(/\{id:'money', t:'Sales and invoicing'[^}]*\}/) || [''])[0];
  ok('the Sales and invoicing group lists sales first, then invoicing (why the card needs _first)', /ids:\['sales','invoicing'\]/.test(grp));
  ok('the Guide counts Back Office for anyone who holds a part of Correct a record', /if\(id==='backoffice'\) return \['COO','CFO','Plant Manager'\]\.indexOf\(r\)>-1\|\|\(canView\(r,id\)&&_asRole\(r,dfAnyArea\)\);/.test(grab('gdScreenOpen'))); }
/* 15. review 3: the Needs you rows, the list subtitle, the old 'COO only' lines, Produced raised by Bring packed back */
{ ok('Needs you: undated lines only for whoever stamps the date', /if\(ud\.length&&has\('Correct a record'\)&&dfOn\(\)&&dfMay\('shipment'\)\)/.test(html));
  ok('Needs you: packing mismatches only for whoever fixes packing', /if\(reconN&&has\('Reconcile packing'\)&&dfOn\(\)&&dfMay\('packing'\)\)/.test(html));
  ok('the list promises a fix only to whoever may fix it', /tap one to see its history'\+\(dfOn\(\)&&dfLineFixMay\(kind==='undated'\?'date':'rec'\)\?' and fix it there':''\)/.test(grab('lineFixList')));
  ok('no live text says only the COO reverses a packing record', !/the COO reverses the record|Ask the COO to reverse it under Correct a record|ask the COO to reverse the packing record under Correct a record/.test(html.replace(/\/\*SYSDOC_DATA_START\*\/[\s\S]*?\/\*SYSDOC_DATA_END\*\//, '')));
  ok('the Guide: the missing date is listed for those who stamp it', /the missing date is listed for the COO, the Plant Manager and Supply Chain, who stamp it\./.test(html));
  const cut = grab('lineFixCut');
  ok('Bring packed back: raising Produced needs dfMay(\'produced\')', /to>was&&to>_prodWas\+0\.5&&!dfMay\('produced'\)\) return toast/.test(cut));
  ok('Bring packed back: a Produced change goes on the register', /_prodChg=\(\+l\.produced\|\|0\)!==_prodWas\?\[\{field:'produced'/.test(cut) && /concat\(_prodChg,_bfix\)/.test(cut)); }
/* 16. the corrections switch decides the line Fix sheet too (Tahir, 3 Nov: "Yes, follow the switch") */
{ const off = mk('COO', true); off.state.dataFixEnabled = false; vm.runInContext(grab('_lfGuard') + '\nvar DF_LINEFIX_WHO="W";', off);
  Object.assign(off, { lfForm: { reason: 'checked on paper' }, _lfCtx: () => ({ o: {}, l: {} }) });
  eq('switch OFF: even the COO cannot fix a line', off._lfGuard('rec'), null); ok('...and is told the switch is off', off.toasts.some(t => /OFF/.test(t)));
  const on = mk('COO', true, { lfForm: { reason: 'checked on paper' }, _lfCtx: () => ({ o: {}, l: {} }) }); vm.runInContext(grab('_lfGuard') + '\nvar DF_LINEFIX_WHO="W";', on);
  ok('switch ON: the COO can', on._lfGuard('rec') !== null);
  ['dfSubmitProduction', 'dfSubmitPacking', 'dfSubmitVoid', 'dfSubmitShipment', 'dfSubmitPO', 'dfSubmitCorrect'].forEach(fn => ok(fn + ' stops when the switch is OFF', /if\(!dfOn\(\)\)\{ toast\(DF_OFF_MSG\); return; \}/.test(grab(fn).slice(0, 2000))));
  const lo = grab('lineFixOpen');
  ok('the sheet: Fix only with the switch ON', /_on=dfOn\(\), ed=_on&&dfLineFixCan\(I\)/.test(lo) && /edP=_on&&dfLineFixMay\('rec'\), edD=_on&&dfLineFixMay\('date'\)/.test(lo));
  ok('History and fix, Reconcile\'s fix and the list subtitle follow the switch', /_I\.length&&dfOn\(\)&&dfLineFixCan\(_I\)/.test(html) && /if\(!dfOn\(\)\|\|!dfLineFixMay\('rec'\)\) return ''/.test(grab('reconFixBtn')) && /dfOn\(\)&&dfLineFixMay\(kind==='undated'/.test(grab('lineFixList'))); }
/* 17. review 5: Needs you, Reconcile, the page messages, Import, the switch on the audit trail; a real OFF run of a writer */
{ ok('Needs you lists no fix jobs while OFF', /has\('Correct a record'\)&&dfOn\(\)&&dfMay\('shipment'\)/.test(html) && /has\('Reconcile packing'\)&&dfOn\(\)&&dfMay\('packing'\)/.test(html));
  ok('Reconcile packing says when corrections are off', /\$\{dfOn\(\)\?'':' <b>'\+DF_OFF_MSG\+'<\/b>'\}/.test(html));
  ok('reconFix: the dead old route is gone', /function reconFix\(po,lid\)\{ lfForm=\{\}; lineFixOpen\(po,lid\); \}/.test(html) && !/Turn corrections on first \(Correct a record/.test(html));
  ok('Import opening POs follows the switch', /if\(!dfOn\(\)\)\{ toast\(DF_OFF_MSG\); return; \}/.test(grab('importGoLivePOs')));
  ok('the switch goes on the audit trail', /field:'Corrections switch'/.test(grab('toggleDataFix')));
  ok('the page OFF messages name the Fix sheet too', /\$\{DF_OFF_MSG\} Nothing can be corrected while it is off/.test(grab('screenDataFix')) && /Corrections are <b>OFF<\/b>: nothing can be corrected/.test(grab('screenDataFix')));
  ['dfSubmitPacking', 'dfSubmitPO', 'dfSubmitShipment'].forEach(fn => { const b = mk('COO', true, { dfForm: { reason: 'x' }, dfReasonOk: () => true, state: { role: 'COO', dataFixEnabled: false, orders: [], batches: [], packingLog: [] }, save() { b.saved = 1; } });
    vm.runInContext(grab(fn), b); try { b[fn](); } catch (e) {}
    ok(fn + ' run with the switch OFF: refused with the OFF message, nothing saved', b.toasts[0] === 'OFF' && !b.saved, JSON.stringify(b.toasts)); }); }
/* 12. build and docs */
{ /* 11-03b: 11-03a or a later build */ ok('BUILD_ID 2026-11-03a or later', /var BUILD_ID='2026-(11-(03[a-z]|0[4-9][a-z]|[1-3]\d[a-z])|12-\d\d[a-z])';/.test(html)); ok('SYSDOC_VER 2026-11-03a or later', /var SYSDOC_VER='2026-(11-(03[a-z]|0[4-9][a-z]|[1-3]\d[a-z])|12-\d\d[a-z])'/.test(html)); ok('changelog 2026-11-03a still there', /\{ver:'2026-11-03a'/.test(html));
  ok('changelog 2026-11-03a', /\{ver:'2026-11-03a', date:'2026-11-03'/.test(html)); ok('Guide rule R-052', /'Correct a record is by area':'R-052'/.test(html) && /<h3>Correct a record is by area<\/h3>/.test(html)); }
process.exitCode = report('Correct a record by area, Sales & Budget to look at, late raw material to the Plant Manager (11-03a)') ? 1 : 0;
