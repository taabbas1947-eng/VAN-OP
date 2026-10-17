/* 17b (Tahir, 17 Oct 2026), from Abdul Majid's 2 screens and Tahir's rulings the same day:
 *  1. Today: the chip "Cleared by the lab, ready to pack" lists EVERY cleared batch with Kg/L left and Pack,
 *     open, not folded; an escalated job keeps its red mark.
 *  2. Pack from base opens the Pack sheet with NO batch chosen; the packer picks the base batch from every
 *     cleared batch of that base (oldest first); an older batch still waiting is named, nothing is asked.
 *  3. Why a cleared batch is not packed: the Production Manager (or the COO) writes Under processing (1 week)
 *     or Held for an expected PO of another client (client + date 1 to 30 days). Nothing else changes; not
 *     stuck while it stands; a held batch is still offered for packing with a note.
 * Runs the real functions from o2s.html. Run: node audit17b.test.js */
const vm = require('vm');
const H = require('./harness.js');
let pass = 0, fail = 0; const fails = [];
const ok = (n, c, x) => c ? pass++ : (fail++, fails.push(n + (x ? '  [' + x + ']' : '')));
const eq = (n, g, w) => ok(n, g === w, 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w));
const html = H.html;
const TODAY = '2026-10-12';

const consts = (html.match(/var PL_STUCK_NO_OUTPUT_DAYS=[^;]+;/) || [''])[0];
const FNS = ['calDays','lineShortClosed','_plPackedOf','plBatchMove','_plDay','plBatchFacts','_plLineOf','plLineWantsBase','plOpenLines','plOpenDemandKg','lineShortRequested','batchClearedKg','plBaseLabKg','plShareKey','plBaseShare','_plFirstOk','_plM','plBaseReady','_plBaseReady0','plClientPOs','lineWaitMark','lineWaitClient','lineWaitOver','plLinePack','packLineOwes','_plCarrier','plBatchClass','_plRow','plStuckBatches','plHeldBatches','_plOpenBtn',
  'npMay','npAddDays','batchNpLast','batchNpMark','npShort','npLong','npClients','npLinkHTML','openNpMark','_npRow','saveNpMark','endNpMark','plNpBatches','itemWaiting','batchLinesWaiting',
  'npTimes','packBasePickable','openPackBase','packBaseList','packPickBase','packBaseField','packPickPO','openPackFromBase',
  'tdReadyMay','tdReadyBatches','tdReadyLoose','tdReadyCount','tdReadyHTML','tdReadyCard','_tdEsc'];
const SRC = consts + '\nvar NP_PROCESS_DAYS=7; var npForm=null; var packForm=null; var TD_READY_KEY=\'Cleared by the lab, ready to pack\';\n' + FNS.map(n => H.grab(n)).join('\n') + '\nvar _plMemo=null; function poReturnOpen(){ return false; }';

function make(role, state) {
  const s = { console, Date, Math, JSON, Object, Array, String, isNaN, toasts: [], logs: [], saved: 0,
    fmt: n => Math.round(n).toLocaleString('en-US'), bpEsc: x => String(x == null ? '' : x), _pe: x => String(x == null ? '' : x), _av: x => String(x == null ? '' : x),
    localDateOf: d => String(d).slice(0, 10), evToday: () => TODAY, shortClient: c => c, unitOf: () => 'Kg/L', batchPOsLabel: b => (b.allocations || []).map(a => a.po).join(', '),
    lineBucket: (o, l) => (l.delivered >= l.ordered - 0.5 ? 'Delivered' : 'Production'),
    batchStage: b => b._stage || 'pack',
    batchPackableKg: b => Math.max(0, (+b.producedKg || 0) - (+b.packedKg || 0) - (+b.disposedKg || 0)),
    batchPackNow: b => !!b && !b.voided && !b.pool && (b.status !== 'closed' || !!b.stockKept) && (b._stage || 'pack') === 'pack' && ((+b.producedKg || 0) - (+b.packedKg || 0) - (+b.disposedKg || 0)) > 0.5,
    activeFloorBatches: () => s.state.batches.filter(b => b.disposition !== 'byproduct' && !b.pool),
    plCanAct: () => true, canView: () => true, may: code => s.mayAll !== false, hardRole: roles => s.state.role === 'COO' || roles.includes(s.state.role),
    toast: m => s.toasts.push(m), logAction: m => s.logs.push(m), save: () => { s.saved++; }, closeModal: () => {}, render: () => {}, renderPackModal: () => { s.rendered = (s.rendered || 0) + 1; }, renderNpMark: () => {},
    $: () => ({ classList: { add: () => {} } }), tdCardHTML: g => '<JOB ' + g.items[0].batch.id + (g.items.some(x => x._escalated) ? ' late' : '') + '>' };
  s._uRole = () => ({ by: s.state.currentUser.name, user: s.state.currentUser.username, role: s.state.role });
  s.state = Object.assign({ role, currentUser: { name: role === 'COO' ? 'Tahir' : 'Abdul Majid', username: 'majid' }, batches: [], orders: [], shiftEntries: [], packingLog: [], audit: [], customers: [] }, state || {});
  s.globalThis = s; vm.createContext(s); vm.runInContext(SRC, s); return s;
}
const lots = d => [{ qty: 1, coa: { status: 'approved', approvedDate: d } }];
const B = (o) => Object.assign({ id: 'B1', batchNo: 'HG26037', status: 'closed', stockKept: true, kind: 'bulk', base: 'Potassium Humate', plannedKg: 5000, producedKg: 5000, packedKg: 3496, disposedKg: 0, openedDate: '2026-09-01', lots: lots('2026-09-20') }, o || {});
const ord = (o) => Object.assign({ id: 'O1', po: '6595010522', client: 'SYNGENTA PAKISTAN', received: '2026-10-01', acknowledged: true, lines: [{ id: 'L1', base: 'Potassium Humate', brand: 'Enrich', ordered: 20000, packed: 0, delivered: 0 }] }, o || {});
const two = () => ({ batches: [B(), B({ id: 'B2', batchNo: 'HG26041', packedKg: 0, lots: lots('2026-10-05') }), B({ id: 'B3', batchNo: 'HG26044', packedKg: 0, lots: lots('2026-10-08') })], orders: [ord()] });

/* ---------- 2. the Pack sheet: no batch chosen, pick from every cleared batch ---------- */
{ const s = make('Production Manager', two());
  s.openPackFromBase('O1', 'L1');
  eq('Pack from base: no batch is chosen', s.packForm.bid, '');
  ok('...the batch box shows, and the sheet is on the order line', s.packForm.pickBase === true && s.packForm.oid === 'O1' && s.packForm.lid === 'L1' && s.packForm.brand === 'Enrich');
  eq('...no quantity until a batch is picked', s.packForm.kg, '');
  const f0 = s.packBaseField(null);
  ok('the box lists every cleared batch of the base, oldest first', /HG26037[\s\S]*HG26041[\s\S]*HG26044/.test(f0) && /3 cleared, oldest first/.test(f0), f0);
  ok('...each with Kg/L left and the day it was cleared', /HG26037 \u00b7 1,504 Kg\/L left \u00b7 cleared 20 Sep/.test(f0));
  ok('...and says no batch is chosen for you', /No batch is chosen for you/.test(f0));
  s.packPickBase('B2');
  eq('picking HG26041 sets the batch', s.packForm.bid, 'B2');
  eq('...the quantity fills in: the batch, cut to what the line needs', s.packForm.kg, 5000);
  ok('...the packs are confirmed again for the new figure', s.packForm.packsOkKg === 0);
  const f2 = s.packBaseField(s.state.batches[1]);
  ok('picking a newer batch: the older one still waiting is named, nothing is asked', /An older cleared batch is still waiting: <b>HG26037<\/b> 1,504 Kg\/L \(cleared 20 Sep\)\. You may still pack from HG26041\./.test(f2), f2);
  ok('picking the oldest: no note', !/older cleared/.test(s.packBaseField(s.state.batches[0])));
  const f3 = s.packBaseField(s.state.batches[2]);
  ok('picking the newest: both older ones are named', /Older cleared batches are still waiting: <b>HG26037<\/b>[^.]*<b>HG26041<\/b>/.test(f3));
  s.state.orders[0].lines[0].packed = 19000; s.packPickBase('B2');
  eq('the quantity is cut to what the line still needs', s.packForm.kg, 1000);
  s.state.batches.push(B({ id: 'BX', base: 'Other base', batchNo: 'ZZ1' })); s.packPickBase('BX');
  eq('a batch of another base cannot be picked', s.packForm.bid, '');
  s.state.batches.push(B({ id: 'BP', kind: 'po', po: 'P9' })); s.packPickBase('BP');
  eq('a batch made for a PO cannot be picked on the base sheet', s.packForm.bid, '');
  ok('a PO batch or a batch for several POs keeps its own sheet (no box)', !s.packBasePickable({ kind: 'po' }) && !s.packBasePickable({ kind: 'multi' }) && s.packBasePickable({ kind: 'bulk' }) && !s.packBasePickable({ kind: 'bulk', disposition: 'byproduct' }));
}
{ const pm = H.grab('renderPackModal'), dp = H.grab('doPack'), op = H.grab('openPack');
  ok('the sheet opens with no batch (a stand-in keeps the base), Pack waits for the pick', /const b=_b0\|\|\{id:'',base:packForm\.base,batchNo:'',kind:'bulk'\}/.test(pm) && /base batch <b>not picked yet<\/b>/.test(pm));
  ok('the batch box sits at the top of the sheet when the base batch can be changed', /\$\{packForm\.pickBase\?packBaseField\(_b0\):''\}\n     <div class="fld"><label>1 · Pack into brand/.test(pm));
  ok('Pack refuses with no batch picked', /if\(!b\)\{toast\('Pick the base batch you are packing from/.test(dp));
  ok('a sheet opened on 1 base batch starts on it and can be changed', /packForm\.pickBase=packBasePickable\(b\)/.test(op));
  ok('the brand batch hint follows the pick', /blank = same as the base batch you pick/.test(pm));
}

/* ---------- 1. Today: every cleared batch under the chip ---------- */
{ const st = two(); st.batches.push(B({ id: 'BP', kind: 'po', po: '659', brand: 'Max', batchNo: 'VMX1', packedKg: 4000, lots: lots('2026-10-02') }));
  st.batches.push(B({ id: 'BQ', batchNo: 'QC1', _stage: 'qc', packedKg: 0 }));   /* with the lab: not cleared */
  st.batches.push(B({ id: 'BZ', batchNo: 'Z0', packedKg: 5000 }));   /* nothing left */
  const s = make('Production Manager', st);
  const bs = s.tdReadyBatches();
  eq('every cleared batch with Kg/L left, oldest cleared first', bs.map(b => b.batchNo).join(','), 'HG26037,VMX1,HG26041,HG26044');
  const job = { label: 'Pack', items: [{ batch: st.batches[3], _escalated: true }] };
  const h = s.tdReadyHTML(bs, [job]);
  ok('a batch with a Pack job shows that job (red when escalated), not a second card', /<JOB BP late>/.test(h) && (h.match(/VMX1/g) || []).length === 0);
  ok('the other batches show with Kg/L left, whose stock it is, and Pack', /Potassium Humate \u00b7 batch HG26037<\/div><div class="tdsub"><b>1,504<\/b> Kg\/L ready to pack \u00b7 base stock for any open order of Potassium Humate/.test(h) && /onclick="openPack\('B1'\)">Pack<\/button>/.test(h));
  ok('...open, never folded', !/<details/.test(h));
  ok('the heading counts every card and says how many were escalated', /ready to pack<span class="cnt">4<\/span>/.test(h) && /1 was escalated to you \(red\)/.test(h));
  ok('the Production Manager can write why under each batch', (h.match(/Why not packed\u2026/g) || []).length === 4);
  eq('the chip count is the number of cards', s.tdReadyCount(bs, [job]), 4);
  eq('a Pack job whose batch is not on the list still counts and shows', s.tdReadyCount(bs, [job, { label: 'Pack', items: [{ batch: { id: 'GONE' } }] }]), 5);
  s.mayAll = false;
  { const hm = s.tdReadyHTML(s.tdReadyBatches(), []); ok('the Production Manager without the packing right still sees the list, with no Pack button', /HG26037/.test(hm) && !/>Pack<\/button>/.test(hm)); }
  s.state.role = 'KAM';
  eq('someone who may not pack gets no list', s.tdReadyBatches().length, 0);
  const s2 = make('Production', st);
  ok('a Production Officer sees the list but cannot write why', /HG26037/.test(s2.tdReadyHTML(s2.tdReadyBatches(), [])) && !/Why not packed/.test(s2.tdReadyHTML(s2.tdReadyBatches(), [])));
}
{ const st = H.grab('screenToday');
  ok('the chip counts every cleared batch for those who may pack', /var _rdy=tdReadyBatches\(\); if\(tdReadyMay\(\)\)\{ var _rn=tdReadyCount\(_rdy,groupsAll\); if\(_rn\) kinds\[TD_READY_KEY\]=_rn; \}/.test(st));
  ok('...the chips show even when it is the only kind', /if\(kk\.length>1\|\|\(kinds\[TD_READY_KEY\]&&tdReadyMay\(\)\)\)\{/.test(st));
  ok('...pressing it draws the open list', /if\(tdFilter===TD_READY_KEY&&tdReadyMay\(\)\)\{ h\+=tdReadyHTML\(_rdy,groupsAll\); \}/.test(st));
  ok('the chip has the same words as the Pack job', /'Pack':\s*\{title:'Cleared by the lab, ready to pack'/.test(html) && /var TD_READY_KEY='Cleared by the lab, ready to pack';/.test(html));
  ok('no money on Today', !/price/i.test(H.grab('tdReadyHTML') + H.grab('tdReadyCard')));
}

/* ---------- 3. why a cleared batch is not packed ---------- */
{ const st = two(); const s = make('Production Manager', st);
  /* nothing packed for the line for 11 d: the oldest batch is stuck, the others queued */
  eq('before: the oldest cleared batch is stuck', s.plBatchClass(st.batches[0]).k, 'stuck');
  eq('...the next one is queued', s.plBatchClass(st.batches[1]).k, 'queued');
  s.openNpMark('B1'); s.npForm.kind = 'processing'; s.saveNpMark();
  const m = st.batches[0].npMarks[0];
  ok('under processing: 1 week (not stuck through day 6, back on day 7)', m.kind === 'processing' && m.until === '2026-10-18' && /back on 19 Oct/.test(s.npShort(m)), JSON.stringify(m));
  ok('...the row has its own id, who and when', /^NP/.test(m.id) && m.by === 'Abdul Majid' && m.user === 'majid' && !!m.at);
  ok('...saved, logged and audited', s.saved === 1 && /Why not packed . batch HG26037: under processing until 2026-10-18 by Abdul Majid/.test(s.logs[0]) && s.state.audit[0].field === 'Why not packed' && s.state.audit[0].id === m.id);
  const c = s.plBatchClass(st.batches[0]);
  ok('the batch is not stuck while the reason stands, and says why', c.k === 'np' && /Under processing: not counted as stuck until 18 Oct, back on 19 Oct\. Written by Abdul Majid on \d+ \w+\./.test(c.why), c.why);
  eq('...nothing else changes on the batch', JSON.stringify(Object.keys(st.batches[0]).sort()), JSON.stringify(Object.keys(B()).concat(['npMarks']).sort()));
  eq('...the next cleared batch is the one its orders are judged on now', s.plBatchClass(st.batches[1]).k, 'stuck');
  eq('Plant lists it under Not packed, reason written', s.plNpBatches().map(x => x.b.batchNo).join(), 'HG26037');
  ok('...and it is off the stuck list', !s.plStuckBatches().some(r => r.batchNo === 'HG26037'));
  s.openPackFromBase('O1', 'L1');
  ok('it is still offered for packing, with the note', /HG26037 \u00b7 1,504 Kg\/L left \u00b7 cleared 20 Sep \u00b7 under processing, back on 19 Oct/.test(s.packBaseField(null)));
  s.openNpMark('B1'); s.npForm.kind = 'processing'; s.saveNpMark();
  ok('the same reason again is refused', st.batches[0].npMarks.length === 1 && /already written/.test(s.toasts.pop()));
  s.openNpMark('B1'); s.endNpMark();
  ok('ended: kept as a row, and the batch is judged as before', st.batches[0].npMarks.length === 2 && st.batches[0].npMarks[1].kind === 'end' && s.plBatchClass(st.batches[0]).k === 'stuck');
}
{ const st = two(); st.customers = [{ name: 'Engro Fertilizers', status: 'Active' }, { name: 'Old Co', status: 'Inactive' }, { name: 'Group', isParent: true }];
  const s = make('Production Manager', st);
  eq('the client list is active customers only', s.npClients().join('|'), 'Engro Fertilizers');
  s.openNpMark('B1'); s.npForm.kind = 'heldpo'; s.npForm.until = '2026-10-20'; s.saveNpMark();
  ok('held for a PO: the client is required', !st.batches[0].npMarks && /Pick the client/.test(s.toasts.pop()));
  s.npForm.client = 'Engro Fertilizers'; s.npForm.until = '2026-11-20'; s.saveNpMark();
  ok('...the date must be 1 to 30 days away', !st.batches[0].npMarks && /1 to 30 days/.test(s.toasts.pop()));
  s.npForm.until = TODAY; s.saveNpMark(); ok('...not today', !st.batches[0].npMarks);
  s.npForm.until = '2026-10-25'; s.saveNpMark();
  const m = st.batches[0].npMarks[0];
  ok('held for Engro until 25 Oct', m.kind === 'heldpo' && m.client === 'Engro Fertilizers' && m.until === '2026-10-25');
  eq('not stuck through the date', s.plBatchClass(st.batches[0]).k, 'np');
  ok('the note names the client and the date', /held for Engro Fertilizers, PO expected by 25 Oct/.test(s.npShort(m)));
  const st3 = JSON.parse(JSON.stringify(st)); const s3 = make('Production Manager', st3); vm.runInContext("evToday=function(){ return '2026-10-26'; }", s3);
  eq('the day after the date it is judged as before', s3.plBatchClass(st3.batches[0]).k, 'stuck');
  st.batches[0].packedKg = 5000; eq('nothing left to pack: the reason holds nothing', s.batchNpMark(st.batches[0]), null);
}
{ const s = make('Production', two()); s.openNpMark('B1');
  ok('a Production Officer cannot write why', s.npForm === null && /Production Manager writes why/.test(s.toasts.pop()));
  const c = make('COO', two()); c.openNpMark('B1'); c.npForm.kind = 'processing'; c.saveNpMark();
  ok('the COO can', (c.state.batches[0].npMarks || []).length === 1 && c.state.batches[0].npMarks[0].by === 'Tahir');
  const p = make('Plant Manager', two()); p.openNpMark('B1'); ok('the Plant Manager cannot', p.npForm === null);
}
{ /* a PO batch with a Pack job: calm, not escalated, says why */
  const st = { batches: [B({ id: 'BP', kind: 'po', po: '6595010522', lineId: 'L1', brand: 'Enrich', npMarks: [{ id: 'NP1', kind: 'processing', until: '2026-10-18', at: '2026-10-12T05:00:00Z', by: 'Abdul Majid' }] })], orders: [ord()] };
  const s = make('Production Manager', st);
  ok('its Pack job counts as calm (0 days, never urgent)', s.itemWaiting({ label: 'Pack', batch: st.batches[0] }) === true);
  ok('...and nobody is told', /it\.label==='Pack'&&it\.batch&&\(batchLinesWaiting\(it\.batch\)\|\|batchNpMark\(it\.batch\)\)\) return null;/.test(H.grab('acEscalation')));
  ok('...its card says why', /g\.label==='Pack'&&g\.items\.length&&g\.items\.every\(function\(x\)\{ return x\.batch&&batchNpMark\(x\.batch\); \}\)\) t\+='<span class="tdtag">\\u23f8 '\+_tdEsc\(npShort\(batchNpMark\(g\.items\[0\]\.batch\)\)\)/.test(H.grab('tdTags')));
  ok('marks are rows with ids, so 2 saves at once are both kept by the merge', /id:'NP'\+Date\.now\(\)/.test(H.grab('_npRow')) && /b\.npMarks=\(b\.npMarks\|\|\[\]\)\.concat\(\[m\]\)/.test(H.grab('_npRow')));
}
{ const pl = H.grab('screenPlant');
  ok('Plant: Not packed, reason written, with Change or end for the Production Manager', /Not packed, reason written/.test(pl) && /openNpMark\(\\''\+qsEsc\(b\.id\)\+'\\'\)">Change or end/.test(pl));
  ok('Plant: a stuck cleared batch has Why not packed for the Production Manager', /npMay\(\)&&r\.bid&&r\.ready/.test(pl));
}

/* ---------- review fixes (independent review, 17 Oct) ---------- */
{ ok('a filter whose kind has gone is reset on every render, never hiding the rest', /\n  if\(tdFilter && !kinds\[tdFilter\]\) tdFilter='';   \/\* 17b review/.test(H.grab('screenToday')));
  const st = two(); st.batches[0].npMarks = [{ id: 'NP1', kind: 'heldpo', client: 'Engro', until: '2026-10-20', at: '2026-10-12T05:00:00Z', by: 'Abdul Majid' }];
  const s = make('Production Manager', st); s.openPackFromBase('O1', 'L1');
  ok('the older-batch note says when the older one is held for another client', /<b>HG26037<\/b> 1,504 Kg\/L \(cleared 20 Sep\) \(held for Engro, PO expected by 20 Oct\)/.test(s.packBaseField(st.batches[1])), s.packBaseField(st.batches[1]));
  st.batches[0].npMarks.push({ id: 'NP2', kind: 'end', until: '', at: '2026-10-12T06:00:00Z' }, { id: 'NP3', kind: 'processing', until: '2026-10-18', at: '2026-10-12T07:00:00Z' });
  const r = s.plNpBatches()[0]; eq('Plant counts how many times a reason was written (ends not counted)', r.n, 2);
  const st2 = { batches: [B({ npMarks: [{ id: 'NP1', kind: 'processing', until: '2026-10-18', at: '2026-10-12T05:00:00Z' }] })], orders: [] };
  eq('a marked batch with no open order is listed only under Held for orders', make('Production Manager', st2).plNpBatches().length, 0);
  const s3 = make('Production Manager', two()); s3.openPackFromBase('O1', 'L1'); const gone = B({ id: 'BG', batchNo: 'GONE1', packedKg: 5000 });
  ok('a picked batch no longer on the list names no older batch', !/older/.test(s3.packBaseField(gone)));
  ok('nothing is written on a batch by the Pack sheet', !Object.keys(st.batches[1]).some(k => /^_/.test(k)));
  ok('the Guide says the order line keeps its own clock', /The order line keeps its own clock/.test(H.grab('guideRules')) && !/its Pack job is calm and nobody is told/.test(H.grab('guideRules')));
}
/* ---------- Guide, change log, build ---------- */
{ const g = H.grab('guideRules'), mj = H.grab('guideMyJob');
  ok('Guide rule: every cleared batch, and why one is not packed (R-042)', /<h3>Every cleared batch, and why one is not packed<\/h3>/.test(g) && /'Every cleared batch, and why one is not packed':'R-042'/.test(html));
  ok('Guide: Pack from base opens with no batch chosen', /with <b>no batch chosen<\/b>: pick the base batch from the list/.test(g) && !/opens the Pack sheet on the oldest cleared batch/.test(g));
  ok('My job: Production, Production Manager, Plant Manager and COO notes', /New on 17 Oct \(17b\)/.test(mj) && /'Production Manager':_pk17\+/.test(mj));
  ok('changelog 17b and BUILD_ID 17b or later', /ver:'2026-10-17b'/.test(html) && ((/var BUILD_ID='([^']+)'/.exec(html) || [])[1] || '') >= '2026-10-17b');
}
console.log((fails.length ? fails.map(f => '  FAIL  ' + f).join('\n') + '\n' : '') + '17b: every cleared batch, pick the base batch, why not packed: ' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exitCode = 1;
