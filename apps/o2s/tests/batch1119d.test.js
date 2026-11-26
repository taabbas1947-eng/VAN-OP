/* BUILD 2026-11-19d. Batch 1 of the fixes from the 18 Nov 2026 audit, part B3 (F14, D-378). Tahir ruled on 19 Nov 2026:
   a job waiting 7 days asks "Why is this waiting?": Waiting for client, Raw material, Capacity, Other with a note. Every Today
   job asks, except jobs on their own clock (lab tests, complaint jobs, Confirm delivery, Near expiry). The reason holds until a
   date picked 1 to 30 days ahead; while it stands the job does not escalate. Waiting for client uses the existing line mark,
   and anyone who owns the job may set it. The reason shows on the card and on the Morning view. It replaces the Ship daily
   comment; the PO comment stays. An escalated card says why it reached you, how long and what to do.
   Tahir ruled again on 19 Nov 2026 (the design page, approved as shown): Production is asked only when the run is behind its own
   plan (each production line's daily output from O2S history, every open order queued by committed date) AND nothing has moved
   for 7 days; Waiting for client is offered on a packed PO; on a card for more than 1 PO it marks only the POs ticked; the COO
   may give the reason too. The independent review's fixes are checked here as well.
   Run: node batch1119d.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;
const top = re => { const m = html.match(re); if (!m) throw new Error('not found ' + re); return m[0]; };

const box = (st, role, extra) => { const c = Object.assign({ console, Math, String, Date, JSON, Object, Array, state: st, TODAY: new Date('2026-11-19T05:00:00Z'), _t: [], _l: [], _saved: 0, tdLastGroups: [] }, extra || {});
  st.role = role; st.currentUser = st.currentUser || { username: 'saad', name: 'Saad Jamal' };
  vm.createContext(c);
  vm.runInContext(top(/var JR_DAYS=7, tdLastGroups=\[\];/).replace(', tdLastGroups=[]', '') + '\n' + top(/var JR_REASONS=\[[^;]*\];/) + '\n' + top(/var JR_SKIP=\{[^}]*\};/) + '\n'
    + top(/var JR_HIST_DAYS=90, JR_HIST_MIN=3, _jrPMemo=null;/) + '\n' + top(/var JR_RANK=\{[^}]*\};/) + '\n' + top(/var _jrMvMemo=null;/) + '\n'
    + ['jrText', 'jrToday', 'jrOf', 'jrMarkLine', 'jrDays', 'jrLastMove', 'jrIdle', 'jrCurLine', 'jrAsks', 'jrMay', 'jrAddDays', 'jrBaseLine', 'jrLineOfOL', 'jrRates', 'jrRateOf', 'jrPlanAll', 'jrWorse', 'jrPlanOf', 'jrPlanHTML', 'jrLines', 'jrPoLine', 'jrOrderOf', 'jrCardItems', 'openJobReason', 'renderJobReason', 'jrSave', 'jrBlockHTML', 'acKey'].map(grab).join('\n')
    + '\nfunction evToday(){ return TODAY.toISOString().slice(0,10); }\nfunction actTiming(it){ return {days:it.d||0}; }\nfunction itemWaiting(it){ return !!it.wait; }'
    + '\nfunction _plLineOf(o,l){ return !l.closed; }\nfunction lineShortRequested(){ return false; }\nfunction lineWaitClient(l){ var w=lineWaitMark(l); return (w&&w.kind!=="end"&&!l.closed)?w:null; }\nfunction lineWaitMark(l){ var a=(l&&l.waitMarks)||[]; return a.length?a[a.length-1]:null; }'
    + '\nvar _wcN=0; function _wcMark(o,l,kind,why,until){ var m={id:"WC"+(++_wcN),kind:kind,why:why,until:until}; l.waitMarks=(l.waitMarks||[]).concat([m]); return m; }'
    + '\nfunction groupOf(b){ return ((state.masters&&state.masters.groupOfBrand)||{})[b]||""; }\nfunction groupRate(g){ return +(((state.masters&&state.masters.productionGroups)||{})[g])||0; }\nfunction leadCfg(){ return {rate:5000,qc:1,disp:1}; }'
    + '\nfunction lineShortClosed(l){ return !!l.shortClosed; }\nfunction lineBucket(o,l){ return l.delivered?"Delivered":"Production"; }\nfunction fmt(n){ return Math.round(n).toLocaleString("en-US"); }\nfunction localDateOf(v){ return String(v||"").slice(0,10); }\nfunction calDays(a){ return Math.round((Date.parse(TODAY.toISOString().slice(0,10)+"T00:00:00Z")-Date.parse(String(a).slice(0,10)+"T00:00:00Z"))/86400000); }\nfunction _av(x){ return String(x==null?"":x).replace(/&/g,"&amp;").replace(/"/g,"&quot;"); }'
    + '\nfunction _uRole(){ return {by:state.currentUser.name,user:state.currentUser.username,role:state.role}; }\nfunction _plDay(d){ return d; }\nfunction _pe(x){ return String(x==null?"":x).replace(/</g,"&lt;"); }\nfunction _tdEsc(x){ return _pe(x); }'
    + '\nvar TD_LABEL={}; var _modal=""; function $(){ return { set innerHTML(v){ _modal=v; }, classList:{ add(){} } }; }\nfunction toast(m){ _t.push(m); }\nfunction logAction(w){ _l.push(w); }\nfunction save(){ _saved++; }\nfunction render(){}\nfunction closeModal(){}', c);
  return c; };
const O = { id: 'O1', po: 'P1', lines: [{ id: 'L1', brand: 'Humi Cash' }] };
const job = (x) => Object.assign({ label: 'Open Production', role: 'Production', o: O, l: O.lines[0], d: 8 }, x || {});

/* ---------- which jobs ask ---------- */
{ const c = box({ orders: [O] }, 'Production');
  ok('F14: a job waiting 7 days asks', c.jrAsks(job({ d: 7 })) === true);
  ok('F14: 6 days does not ask yet', c.jrAsks(job({ d: 6 })) === false);
  ok('F14: own-clock jobs never ask (lab test, Confirm delivery, Near expiry, complaint, Add reason, Lab late)', ['Lab test', 'Confirm delivery', 'Lab late', 'Add reason'].every(l => !c.jrAsks(job({ label: l, d: 20 }))) && !c.jrAsks(job({ cm: 'C1', label: 'Investigate complaint', d: 20 })) && !c.jrAsks(job({ nearExp: { id: 'p' }, label: 'Near expiry', d: 20 })));
  ok('F14: a job already marked waiting for the client does not ask', c.jrAsks(job({ wait: true, d: 20 })) === false);
  ok('F14: the owner may answer; another role may not; the COO may', c.jrMay(job()) === true && box({ orders: [O] }, 'QCM').jrMay(job()) === false && box({ orders: [O] }, 'COO').jrMay(job()) === true);
}
/* ---------- saving a reason ---------- */
{ const st = { orders: [O] }, c = box(st, 'Production'); const it = job(), it2 = job({ l: { id: 'L9', brand: 'X' }, d: 3 });
  c.tdLastGroups = [{ key: 'one:T1', items: [it, it2] }];
  c.openJobReason('one:T1');
  ok('F14: the box offers the 4 reasons, Waiting for client on a job for a PO line', /Waiting for client/.test(c._modal) && /Raw material/.test(c._modal) && /Capacity/.test(c._modal) && /Other/.test(c._modal) && /Check again on|Waiting for the client until/.test(c._modal));
  c.jrForm.reason = 'other'; c.jrForm.note = 'abc'; c.jrSave(); ok('F14: Other needs a note', /at least 5 characters/.test(c._t.pop()) && !st.jobReasons);
  c.jrForm.reason = 'rm'; c.jrForm.until = '2026-12-25'; c.jrSave(); ok('F14: the date must be 1 to 30 days ahead', /1 to 30 days/.test(c._t.pop()) && !st.jobReasons);
  c.jrForm.until = '2026-11-19'; c.jrSave(); ok('F14: today is not ahead', /1 to 30 days/.test(c._t.pop()));
  c.jrForm.until = '2026-11-26'; c.jrForm.note = 'urea due Friday'; c.jrSave();
  const k = c.acKey(it), r = st.jobReasons && st.jobReasons[k];
  ok('F14: the reason is kept by the job, with who, until and why', r && r.reason === 'rm' && r.until === '2026-11-26' && r.note === 'urea due Friday' && r.by === 'Saad Jamal' && r.role === 'Production' && r.days === 8);
  ok('F14: a job on the same card under 7 days gets no reason', !st.jobReasons[c.acKey(it2)]);
  ok('F14: it is logged and saved', /Reason after 7 days: Raw material \(urea due Friday\) until 2026-11-26/.test(c._l[0]) && c._saved === 1);
  ok('F14: while it stands the job does not ask and reads as given', !!c.jrOf(it) && !c.jrAsks(it) && /Why waiting: Raw material/.test(c.jrBlockHTML({ key: 'one:T1', items: [it] })) && /not escalating/.test(c.jrBlockHTML({ key: 'one:T1', items: [it] })));
  c.openJobReason('one:T1'); c.jrForm.reason = 'capacity'; c.jrForm.note = ''; c.jrForm.until = '2026-11-28'; c.jrSave();
  ok('F14: changing the reason keeps the old one as history', st.jobReasons[k].reason === 'capacity' && st.jobReasons[k].hist.length === 1 && st.jobReasons[k].hist[0].reason === 'rm');
  c.TODAY = new Date('2026-11-29T05:00:00Z');
  ok('F14: after its date the reason ends and the box asks again', !c.jrOf(it) && c.jrAsks(job({ d: 18 })) === true);
}
{ const st = { orders: [O] }, c = box(st, 'Production'); const it = job();
  c.tdLastGroups = [{ key: 'g', items: [it] }]; c.openJobReason('g'); c.jrForm.reason = 'client'; c.jrForm.note = ''; c.jrForm.until = '2026-12-01'; c.jrSave();
  const wm = O.lines[0].waitMarks || [];
  ok('F14: Waiting for client sets the existing line mark (no 2nd record), by the job owner (Production here)', wm.length === 1 && wm[0].until === '2026-12-01' && wm[0].kind === 'wait' && /Waiting for client/.test(wm[0].why));
  ok('F14: ...and keeps the reason on the job too', st.jobReasons[c.acKey(it)].reason === 'client');
  const n = box({ orders: [] }, 'QA Inspector'); n.tdLastGroups = [{ key: 'g', items: [job({ label: 'Pack QC', role: 'QA Inspector', o: null, l: null, d: 9 })] }]; n.openJobReason('g');
  ok('F14: a job with no PO line does not offer Waiting for client', /Why is this waiting\?/.test(n._modal) && /value="rm"/.test(n._modal) && !/value="client"/.test(n._modal));
  const q = box({ orders: [O] }, 'QCM'); q.tdLastGroups = [{ key: 'g', items: [job()] }]; q.openJobReason('g');
  ok('F14: someone who does not own the job cannot give the reason', /Only the person whose job it is/.test(q._t[0]));
  ok('F14: a non-owner sees the question without a button', /the owner gives the reason/.test(q.jrBlockHTML({ key: 'g', items: [job()] })) && !/openJobReason/.test(q.jrBlockHTML({ key: 'g', items: [job()] })));
}
/* ---------- escalation stops while the reason stands ---------- */
{ const es = grab('acEscalation');
  ok('F14: acEscalation returns nothing while a reason stands', /if\(typeof jrOf==='function'&&jrOf\(it\)\) return null;/.test(es) && es.indexOf('jrOf(it)') < es.indexOf('var TH='));
  const c = { console, Math, PL_LINE_STUCK_DAYS: 7, state: { jobReasons: {} }, TODAY: new Date('2026-11-19T05:00:00Z') };
  vm.createContext(c);
  vm.runInContext(grab('acEscalation') + '\n' + grab('jrOf') + '\n' + grab('jrToday') + '\nfunction acKey(it){ return it.k; }\nfunction evToday(){ return TODAY.toISOString().slice(0,10); }\nfunction labLateBy(){ return 0; }\nfunction actTiming(it){ return {days:it._d}; }\nfunction acProduceStallDays(it){ return it._d; }\nfunction batchLinesWaiting(){ return null; }\nfunction batchNpMark(){ return null; }', c);
  ok('F14: without a reason a 9-day Ship job escalates', !!c.acEscalation({ label: 'Ship', k: 'S1', _d: 9 }));
  c.state.jobReasons.S1 = { reason: 'capacity', until: '2026-11-25' };
  ok('F14: with a reason it does not', c.acEscalation({ label: 'Ship', k: 'S1', _d: 9 }) === null);
  c.state.jobReasons.S1.until = '2026-11-18';
  ok('F14: when the date has passed it escalates again', !!c.acEscalation({ label: 'Ship', k: 'S1', _d: 9 }));
}
/* ---------- the card, the escalated line, the Ship daily comment, the Morning view ---------- */
{ const td = grab('tdCardHTML');
  ok('F14: the card shows the reason or the question', /h\+=jrBlockHTML\(g\);/.test(td) && /h\+=tdEscLineHTML\(g\)\+jrBlockHTML\(g\);/.test(td));
  ok('F14: the Ship card no longer offers the daily comment', !/h\+=dcBtnHTML\(one\.o\)/.test(td));
  ok('F14: the Ship daily comment is never required', /return \{kind:'ship',days:d,deferred:df,waitsClient:wc,required:false\};/.test(grab('dcState0')));
  ok('F14: the PO comment stays', /return \{kind:'po',days:r,deferred:false,waitsClient:wc2,required:!wc2&&r>=DC_DAYS/.test(grab('dcState0')));
  ok('F14: a reason shows as a tag', /reason given/.test(grab('tdTags')) && !/No comment today/.test(grab('tdTags')));
  const c = { console, String }; vm.createContext(c);
  vm.runInContext(grab('tdEscLineHTML') + '\nfunction jrDays(it){ return it.d; }\nfunction tdCanAct(it){ return !!it.can; }\nfunction _tdEsc(x){ return String(x); }\nfunction roleTitle(r){ return r; }', c);
  ok('F14: an escalated card says why it reached you, how long, with whom and what to do', /Why you see this:<\/b> it has waited 5 d with Supply Chain, past its time, so it reached you\. Do it yourself, or ask them\./.test(c.tdEscLineHTML({ items: [{ _escalated: true, d: 5, role: 'Supply Chain', can: true }] })));
  ok('F14: ...and when you cannot do it, says to ask them', /Ask them to do it; you cannot do it yourself\./.test(c.tdEscLineHTML({ items: [{ _escalated: true, d: 5, role: 'AQCM', can: false }] })));
  eq('F14: a card that is not escalated has no such line', c.tdEscLineHTML({ items: [{ d: 5 }] }), '');
}
{ const st = { jobReasons: { 'Open Production|o:O1|l:L1': { reason: 'rm', note: 'urea', until: '2026-11-25' } } };
  const c = { console, Math, String, JSON, state: st, TODAY: new Date('2026-11-19T05:00:00Z'), TD_LABEL: { 'Open Production': { title: 'Production run' }, 'Ship': { title: 'Ready to ship' } } };
  vm.createContext(c);
  vm.runInContext(top(/var JR_DAYS=7, tdLastGroups=\[\];/) + '\n' + top(/var JR_REASONS=\[[^;]*\];/) + '\n' + top(/var JR_SKIP=\{[^}]*\};/) + '\n' + top(/var _jrMvMemo=null;/) + '\n' + ['mvReasonsHTML', 'jrOf', 'jrToday', 'jrDays', 'jrText', 'acKey', 'jrAsks', 'jrPlanOf', 'jrIdle', 'jrLastMove', 'jrAddDays'].map(grab).join('\n')
    + '\nfunction evToday(){ return TODAY.toISOString().slice(0,10); }\nfunction actTiming(it){ return {days:it.d}; }\nfunction itemWaiting(it){ return !!it.wait; }\nfunction mvPl(n,w){ return n+" "+w+(n===1?"":"s"); }\nfunction mvVb(n,a,b){ return n===1?a:b; }\nfunction mvEsc(x){ return String(x); }\nfunction mvRow(l,r,s){ return "<row>"+l+"|"+r+"|"+(s||"")+"</row>"; }\nfunction _plDay(d){ return d; }', c);
  const g = [{ items: [{ label: 'Open Production', o: { id: 'O1', po: 'P1' }, l: { id: 'L1' }, _days: 9 }] }, { items: [{ label: 'Ship', o: { id: 'O2', po: 'P2' }, _days: 12 }] }, { items: [{ label: 'Ship', o: { id: 'O3', po: 'P3' }, _days: 3 }] }];
  const h = c.mvReasonsHTML({ own: g });
  ok('F14: the Morning view says how many jobs wait past their time, why, and how many have no reason yet', /Why your jobs wait: 2 jobs, 1 raw material; 1 with no reason yet \(Today asks why\)/.test(h));
  ok('F14: ...and lists each reason with its job, PO, date and note', /<row>Production run · P1\|Raw material\|until 2026-11-25 · urea<\/row>/.test(h));
  ok('F14: the Morning view page draws it', /h\+=mvReasonsHTML\(T\);/.test(grab('mvWatching')));
}

/* ---------- Production: asked only when the run is behind its own plan (Tahir, 19 Nov) ---------- */
const PM = () => ({ groupOfBrand: { 'Humi Cash': 'Humic', 'Tervalis': 'Humic', 'Max Sulfur': 'Powder' }, productionGroups: { Humic: 10000, Powder: 5000 }, products: [{ brand: 'Tervalis', base: 'Potassium Humate' }, { brand: 'Humi Cash', base: 'Potassium Humate' }] });
const PLOG = [{ date: '2026-11-01', base: 'Potassium Humate', kg: 8000 }, { date: '2026-11-03', base: 'Potassium Humate', kg: 4000 }, { date: '2026-11-03', base: 'Potassium Humate', kg: 5000 }, { date: '2026-11-05', base: 'Potassium Humate', kg: 12000 }, { date: '2026-07-01', base: 'Potassium Humate', kg: 1 }];
const mkO = (id, brand, ordered, committed, x) => ({ id, po: 'PO' + id, client: 'C' + id, received: '2026-10-01', lines: [Object.assign({ id: 'L' + id, brand, base: 'Potassium Humate', ordered, packed: 0, committed }, x || {})] });
{ const A = mkO('A', 'Humi Cash', 90000, '2026-12-01'), B = mkO('B', 'Tervalis', 90000, '2026-12-10'), C = mkO('C', 'Max Sulfur', 5000, '2026-11-10', { base: 'Sulfur 70%' }), D = mkO('D', 'Tervalis', 5000, ''), E = mkO('E', 'Tervalis', 50000, '2026-11-25', { packed: 50000 });
  const st = { orders: [A, B, C, D, E], masters: PM(), productionLog: PLOG.slice() }, c = box(st, 'Production');
  const pj = (o, d, x) => Object.assign({ label: 'Open Production', role: 'Production', o, l: o.lines[0], d }, x || {});
  const H = c.jrRates();
  ok('F14 plan: the daily output of a line is the median of its production days in the last 90 days (8,000, 9,000, 12,000 -> 9,000), found through the products of the base', H.Humic && H.Humic.days === 3 && H.Humic.med === 9000);
  ok('F14 plan: 3 days of history or more use history; fewer use the Lead times rate in Setup', c.jrRateOf('Humic', H).rate === 9000 && c.jrRateOf('Humic', H).src === 'history' && c.jrRateOf('Humic', { Humic: { days: 2, med: 1 } }).rate === 10000 && c.jrRateOf('Humic', { Humic: { days: 2, med: 1 } }).src === 'setup' && c.jrRateOf('', {}).rate === 5000);
  const pA = c.jrPlanOf(pj(A, 9)), pB = c.jrPlanOf(pj(B, 9)), pC = c.jrPlanOf(pj(C, 9));
  ok('F14 plan: latest start = committed - days to make the Kg queued - 1 lab day - 1 dispatch day (A: 1 Dec - 10 - 2 = 19 Nov, on time today)', pA.start === '2026-11-19' && pA.status === 'ontime' && pA.kgQueued === 90000);
  ok('F14 plan: an order is queued behind the orders on its line due before it (B alone would start 28 Nov; behind A it had to start 18 Nov)', pB.kgQueued === 180000 && pB.start === '2026-11-18' && pB.status === 'behind');
  ok('F14 plan: past the committed date is late; a line with no history uses its Setup rate (Powder 5,000)', pC.status === 'late' && pC.committed === '2026-11-10' && pC.line === 'Powder' && pC.rate === 5000 && pC.src === 'setup');
  ok('F14 plan: a fully packed line is not queued, and a line with no committed date has no plan', !c.jrPlanAll()['E|LE'] && c.jrPlanOf(pj(D, 9)) === null);
  ok('F14 plan: 2 jobs on 1 order line read the same plan (the line is queued once)', c.jrPlanOf(pj(B, 9, { label: 'Pack from base' })) === pB);
  ok('F14: Production on plan does not ask even after 9 days with no movement', c.jrAsks(pj(A, 9)) === false);
  ok('F14: Production behind its plan asks after 7 days with no movement', c.jrAsks(pj(B, 7)) === true && c.jrAsks(pj(B, 6)) === false);
  ok('F14: Production late asks after 7 days with no movement', c.jrAsks(pj(C, 7)) === true);
  ok('F14: a Production job with no committed date, or with no PO (a stock batch), keeps the 7 days', c.jrAsks(pj(D, 7)) === true && c.jrAsks({ label: 'Pack', role: 'Production', batch: { id: 'b1', kind: 'stock' }, d: 8 }) === true && c.jrAsks({ label: 'Pack', role: 'Production', batch: { id: 'b1', kind: 'stock' }, d: 6 }) === false);
  ok('F14: other roles keep 7 days with no movement', c.jrAsks(pj(A, 9, { label: 'Ship', role: 'Supply Chain' })) === true);
  const hA = c.jrPlanHTML({ items: [pj(A, 9)] }), hB = c.jrPlanHTML({ items: [pj(B, 9)] }), hC = c.jrPlanHTML({ items: [pj(C, 16)] });
  ok('F14 card: on time says Start by and the line with its daily output and where it comes from', /Start by <b>2026-11-19<\/b> to meet 2026-12-01/.test(hA) && /Humic line, about 9,000 Kg\/L a day \(O2S, last 90 days\)/.test(hA));
  ok('F14 card: behind says when the start was due and how long nothing has moved', /Behind:<\/b> the start was due 2026-11-18 to meet 2026-12-10; no movement for 9 d/.test(hB));
  ok('F14 card: late says the committed date', /Late:<\/b> committed 2026-11-10; no movement for 16 d/.test(hC));
  ok('F14 card: a card for several runs shows the worst one', /Late:/.test(c.jrPlanHTML({ items: [pj(A, 9), pj(C, 9), pj(B, 9)] })));
  ok('F14 card: the plan line shows on a Production card even when nothing asks', /Start by/.test(c.jrBlockHTML({ key: 'prod:Humi Cash', items: [pj(A, 2)] })) && !/Why is this waiting/.test(c.jrBlockHTML({ key: 'prod:Humi Cash', items: [pj(A, 2)] })));
  ok('F14 card: a job that is behind asks with the plan in the question', /Behind the plan, no movement for 7 days or more: why\?/.test(c.jrBlockHTML({ key: 'prod:Tervalis', items: [pj(B, 9)] })));
  c.openJobReason('prod:Tervalis');
  c.tdLastGroups = [{ key: 'prod:Tervalis', items: [pj(B, 9)] }]; c.openJobReason('prod:Tervalis');
  ok('F14 box: for Production it says the run is behind the plan for the committed date', /is behind the plan for the committed date, and nothing has been made or packed for 7 days or more/.test(c._modal));
}
/* ---------- Waiting for client on a packed PO (Tahir, 19 Nov) ---------- */
{ const P = { id: 'OP', po: 'P77', client: 'X', lines: [{ id: 'LP', brand: 'Enrich', ordered: 100, packed: 100, closed: true }] };
  const st = { orders: [P] }, c = box(st, 'Supply Chain'); const it = { label: 'Ship', role: 'Supply Chain', o: P, shipLines: P.lines, d: 9 };
  c.tdLastGroups = [{ key: 'one:S', items: [it] }]; c.openJobReason('one:S');
  ok('F14: a Ship job on a fully packed PO offers Waiting for client', /value="client"/.test(c._modal) && c.jrForm.pos.length === 1 && c.jrForm.pos[0].tick === true);
  c.jrForm.reason = 'client'; c.jrForm.note = 'client asked to hold'; c.jrForm.until = '2026-11-30'; c.jrSave();
  const r = st.jobReasons[c.acKey(it)];
  ok('F14: ...the reason holds the job, and no mark is written on a line with nothing left to pack', r && r.reason === 'client' && (r.pos || []).join() === 'OP' && (r.marks || []).length === 0 && !(P.lines[0].waitMarks || []).length && !!c.jrOf(it) && !c.jrAsks(it));
}
/* ---------- a card for more than 1 PO: tick the POs (Tahir, 19 Nov) ---------- */
{ const O1 = { id: 'M1', po: 'PM1', client: 'Maxim', lines: [{ id: 'X1', brand: 'Max Amino', ordered: 500, packed: 0 }] }, O2 = { id: 'M2', po: 'PM2', client: 'Other', lines: [{ id: 'X2', brand: 'Max Amino', ordered: 300, packed: 0 }] };
  const st = { orders: [O1, O2] }, c = box(st, 'Production'); const i1 = { label: 'Open Production', role: 'Production', o: O1, l: O1.lines[0], d: 20 }, i2 = { label: 'Open Production', role: 'Production', o: O2, l: O2.lines[0], d: 20 };
  c.tdLastGroups = [{ key: 'prod:Max Amino', items: [i1, i2] }]; c.openJobReason('prod:Max Amino');
  ok('F14: a card for 2 POs lists both, none ticked', c.jrForm.pos.length === 2 && c.jrForm.pos.every(p => !p.tick));
  c.jrForm.reason = 'client'; c.renderJobReason();
  ok('F14: ...the box asks which POs wait for the client', /Which POs wait for the client\? \(this card has 2\)/.test(c._modal) && /PM1 · Maxim/.test(c._modal) && /PM2 · Other/.test(c._modal));
  c.jrForm.until = '2026-11-30'; c.jrSave();
  ok('F14: ...with none ticked it is not saved', /Tick the POs that wait for the client/.test(c._t.pop()) && !st.jobReasons);
  c.jrForm.pos[1].tick = true; c.jrSave();
  ok('F14: ...only the ticked PO is marked and holds the reason; the other still asks', (O2.lines[0].waitMarks || []).length === 1 && !(O1.lines[0].waitMarks || []).length && !!c.jrOf(i2) && !c.jrOf(i1) && c.jrAsks(i1) === true);
  /* review M5: the reason follows the mark it wrote */
  const k2 = c.acKey(i2); ok('F14: the reason keeps the id of the mark it wrote', st.jobReasons[k2].marks.length === 1 && st.jobReasons[k2].marks[0].mid === O2.lines[0].waitMarks[0].id);
  O2.lines[0].waitMarks.push({ id: 'SC1', kind: 'end', why: 'client called' });
  ok('F14: when Supply Chain ends the wait, the reason ends with it', !c.jrOf(i2));
  O2.lines[0].waitMarks.pop();
  c.tdLastGroups = [{ key: 'prod:Max Amino', items: [i2] }]; c.openJobReason('prod:Max Amino'); c.jrForm.reason = 'rm'; c.jrForm.note = ''; c.jrForm.until = '2026-11-28'; c.jrSave();
  const wm = O2.lines[0].waitMarks;
  ok('F14: changing a Waiting for client reason to another ends the wait mark it wrote', wm.length === 2 && wm[1].kind === 'end' && /Reason changed to Raw material/.test(wm[1].why) && st.jobReasons[k2].reason === 'rm');
}
/* ---------- review fixes ---------- */
{ const st = { orders: [O] }, c = box(st, 'Production'); const it = job();
  c.tdLastGroups = [{ key: "one:Ab'c", items: [it] }];
  const b = c.jrBlockHTML({ key: "one:Ab'c", items: [it] });
  ok('F14 review: a card key with an apostrophe is passed encoded and still opens the box', /openJobReason\('one%3AAb%27c'\)/.test(b) && (c.openJobReason('one%3AAb%27c'), /Why is this waiting\?/.test(c._modal)));
  c.jrForm.note = 'x" onfocus="alert(1)'; c.renderJobReason();
  ok('F14 review (M1): the note is escaped inside its value', /value="x&quot; onfocus=&quot;alert\(1\)"/.test(c._modal) && !/value="x" onfocus/.test(c._modal));
  c.jrForm.reason = 'rm'; c.jrForm.note = ''; c.jrForm.until = '2026-11-26'; c.jrSave();
  ok('F14 review: a reason from an earlier wait is ignored once the job has moved (8 days then, 2 now)', !!c.jrOf(job({ d: 8 })) && !c.jrOf(job({ d: 2 })));
  ok('F14 review: Truck released keeps its own clock', c.jrAsks(job({ label: 'Truck released', d: 20 })) === false);
  ok('F14 review (M2): the Morning view no longer shows No comment today for a PO ready to ship', /if\(!td&&s&&s\.kind==='ship'\) return;/.test(grab('mvComments')));
  ok('F14: the COO may give the reason on any job that reached him', box({ orders: [O] }, 'COO').jrMay(job({ role: 'Supply Chain' })) === true);
}

/* ---------- 2nd review: movement, a reason from an earlier wait, marks it only re-used, unticked POs, a merge while the box is open ---------- */
{ const B = mkO('B2', 'Tervalis', 90000, '2026-11-15'); B.lines[0].id = 'LB2';
  const st = { orders: [B], masters: PM(), productionLog: [], packingLog: [], batches: [{ id: 'bt', kind: 'po', po: B.po, lineId: 'LB2', batchNo: 'TV-1' }] }, c = box(st, 'Production');
  const it = { label: 'Open Production', role: 'Production', o: B, l: B.lines[0], d: 20 };
  ok('F14 (2nd review, M-B): a late run with nothing made for 20 days asks', c.jrAsks(it) === true && /no movement for 20 d/.test(c.jrPlanHTML({ items: [it] })));
  st.productionLog.push({ date: '2026-11-17', base: 'Potassium Humate', kg: 3000, batchNo: 'TV-1' }); c._jrMvMemo = null;
  ok('F14 (2nd review, M-B): output logged on its own batch 2 days ago counts as movement: it does not ask and the card says 2 d', c.jrIdle(it) === 2 && c.jrAsks(it) === false && /no movement for 2 d/.test(c.jrPlanHTML({ items: [it] })));
  st.productionLog.length = 0; st.productionLog.push({ date: '2026-11-16', base: 'Potassium Humate', kg: 500, po: B.po, brand: 'Tervalis' }); c._jrMvMemo = null;
  ok('F14 (2nd review): a production row written for this PO and product counts as movement too', c.jrIdle(it) === 3);
  st.productionLog.length = 0; c._jrMvMemo = null;
  st.jobReasons = { [c.acKey(it)]: { reason: 'capacity', until: '2026-11-30', at: '2026-11-10T06:00:00Z', since: '2026-10-30', days: 11 } };
  ok('F14 (2nd review, M-A): a reason stands while the run has not moved (its clock started on 30 Oct)', !!c.jrOf(it));
  st.packingLog.push({ po: B.po, lid: 'LB2', brand: 'Tervalis', date: '2026-11-12', kg: 400 }); c._jrMvMemo = null;
  ok('F14 (2nd review, M-A): once it was packed after the reason was given, the reason is over, even when its clock is long again', !c.jrOf(it) && c.jrAsks(it) === true && c.jrIdle(it) === 7);
  const o2 = { label: 'Ship', role: 'Supply Chain', o: B, shipLines: B.lines, d: 3 };
  st.jobReasons[c.acKey(o2)] = { reason: 'rm', until: '2026-11-30', at: '2026-11-10T06:00:00Z', since: '2026-11-01' };
  ok('F14 (2nd review, M-A): for any job, a clock that started after the reason\'s wait (moved since) ends the reason', !c.jrOf(o2) && !!c.jrOf(Object.assign({}, o2, { d: 18 })));
  ok('F14 (2nd review): the queue counts only what is still to make (made, not yet packed, is not queued)', (() => { const X = mkO('X', 'Tervalis', 9000, '2026-12-01', { produced: 9000 }); st.orders.push(X); c._jrPMemo = null; const r = !c.jrPlanAll()['X|LX']; st.orders.pop(); c._jrPMemo = null; return r; })());
}
{ const O1 = { id: 'N1', po: 'PN1', client: 'A', lines: [{ id: 'Y1', brand: 'Max Amino', ordered: 500, packed: 0, waitMarks: [{ id: 'SCX', kind: 'wait', until: '2026-11-30', why: 'SC' }] }] }, O2 = { id: 'N2', po: 'PN2', client: 'B', lines: [{ id: 'Y2', brand: 'Max Amino', ordered: 300, packed: 0 }] };
  const st = { orders: [O1, O2] }, c = box(st, 'Production'); const i1 = { label: 'Open Production', role: 'Production', o: O1, l: O1.lines[0], d: 20 }, i2 = { label: 'Open Production', role: 'Production', o: O2, l: O2.lines[0], d: 20 };
  c.tdLastGroups = [{ key: 'k', items: [i1, i2] }]; c.openJobReason('k'); c.jrForm.reason = 'client'; c.jrForm.until = '2026-11-30'; c.jrForm.pos.forEach(p => { p.tick = true; }); c.jrSave();
  const r1 = st.jobReasons[c.acKey(i1)], r2 = st.jobReasons[c.acKey(i2)];
  ok('F14 (2nd review): a Supply Chain mark with the same date is re-used, not written twice, and is recorded as not its own', O1.lines[0].waitMarks.length === 1 && r1.marks[0].mid === 'SCX' && r1.marks[0].own === false && r2.marks[0].own === true);
  c.openJobReason('k'); ok('F14 (2nd review): the box opens with the POs that hold the reason ticked', c.jrForm.pos.every(p => p.tick));
  c.jrForm.pos[1].tick = false; c.jrSave();
  ok('F14 (2nd review): unticking a PO ends its reason and the mark that reason wrote; the other PO keeps its reason', !!st.jobReasons[c.acKey(i2)].endedAt && O2.lines[0].waitMarks[O2.lines[0].waitMarks.length - 1].kind === 'end' && /unticked/.test(O2.lines[0].waitMarks[O2.lines[0].waitMarks.length - 1].why) && !st.jobReasons[c.acKey(i1)].endedAt);
  c.tdLastGroups = [{ key: 'k', items: [i1] }]; c.openJobReason('k'); c.jrForm.reason = 'rm'; c.jrForm.note = ''; c.jrForm.until = '2026-11-28'; c.jrSave();
  ok('F14 (2nd review): changing the reason leaves a Supply Chain mark it only re-used', O1.lines[0].waitMarks.length === 1 && O1.lines[0].waitMarks[0].kind === 'wait');
}
{ const O3 = { id: 'Q1', po: 'PQ1', client: 'A', lines: [{ id: 'Z1', brand: 'Max Amino', ordered: 500, packed: 0 }] };
  const st = { orders: [O3] }, c = box(st, 'Production'); const old = { label: 'Open Production', role: 'Production', o: O3, l: O3.lines[0], d: 20 };
  c.tdLastGroups = [{ key: 'm', items: [old] }]; c.openJobReason('m');
  st.orders = JSON.parse(JSON.stringify(st.orders));   /* a background save merged and replaced the state while the box was open */
  c.jrForm.reason = 'client'; c.jrForm.until = '2026-11-30'; c.jrSave();
  ok('F14 (2nd review): after a merge while the box is open, the mark lands on the line in the new state', (st.orders[0].lines[0].waitMarks || []).length === 1 && !(O3.lines[0].waitMarks || []).length);
}
ok('F14 (2nd review): the card is wrapped so a bad record never blanks Today', /function jrBlockHTML\(g\)\{ try\{/.test(html) && /return h; \}catch\(e\)\{ return ''; \} \}/.test(grab('jrBlockHTML')));
ok('F14 (2nd review): the Guide names the lab and dispatch days from Lead times and every job on its own clock', /less the lab and dispatch days set in Lead times/.test(html) && /lab tests and Lab late, complaint jobs, Confirm delivery, Near expiry, Add reason and Truck released/.test(html));

/* ---------- 1 answer covers the base (Tahir, 19 Nov) ---------- */
{ const mk = (id, base) => ({ id, po: 'P' + id, client: 'C', lines: [{ id: 'L' + id, brand: 'Max Sulfur', base, ordered: 1000, packed: 0 }] });
  const A = mk('S1', 'Sulfur 70%'), B = mk('S2', 'Sulfur 70%'), Cc = mk('S3', 'Potassium Humate');
  const st = { orders: [A, B, Cc] }, c = box(st, 'Production');
  const pf = o => ({ label: 'Pack from base', role: 'Production', o, l: o.lines[0], d: 16 });
  const a = pf(A), b = pf(B), x = pf(Cc), op = { label: 'Open Production', role: 'Production', o: A, l: A.lines[0], d: 16 };
  c.tdLastGroups = [{ key: 'one:1', items: [a] }, { key: 'one:2', items: [b] }, { key: 'one:3', items: [x] }, { key: 'prod:Max Sulfur', items: [op] }];
  c.openJobReason('one:1');
  ok('F14: a Pack from base card gathers every Pack from base job of its base (2), not another base, not the production run', c.jrForm.n === 2 && /It covers every Pack from base job of Sulfur 70% on your Today \(2\)/.test(c._modal));
  ok('F14: ...its own PO starts ticked, the other PO of the base does not', c.jrForm.pos.find(p => p.id === 'S1').tick === true && c.jrForm.pos.find(p => p.id === 'S2').tick === false);
  c.jrForm.reason = 'capacity'; c.jrForm.note = ''; c.jrForm.until = '2026-11-26'; c.jrSave();
  ok('F14: ...1 answer holds both cards; the other base and the production run still ask', !!c.jrOf(a) && !!c.jrOf(b) && !c.jrOf(x) && c.jrAsks(x) === true && !c.jrOf(op));
}
/* ---------- change log, Guide, build, docs ---------- */
ok('change log 2026-11-19d says it', /ver:'2026-11-19d'/.test(html) && /Why is this waiting\?/.test(html) && /replaces the daily comment on a Ship job/.test(html));
ok('the Guide rule has its number', /'Why is this waiting\? \(after 7 days\)':'R-054'/.test(html) && /<h3>Why is this waiting\? \(after 7 days\)<\/h3>/.test(html));
ok('the Guide notes for each role', /var _n19d=/.test(grab('guideMyJob')) && /New on 19 Nov \(2026-11-19d\)/.test(grab('guideMyJob')));
ok('BUILD_ID of the build form (2026-11-19d since part B3; 2026-11-26a since Inspections on file) and SYSDOC_VER follows', (function(){ var m=html.match(/var BUILD_ID='(2026-\d\d-\d\d[a-z])';/); return !!m && m[1]>='2026-11-19d' && html.indexOf("var SYSDOC_VER='"+m[1]+"'")>=0; })());
ok('the System Documentation carries D-378 and SC-50', /"id":"D-378"/.test(html) && /"id":"SC-50"/.test(html));
report('2026-11-19d batch 1, part B3: Why is this waiting? after 7 days');
