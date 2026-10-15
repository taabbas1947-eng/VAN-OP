/* 15 Oct 2026 - PACKS SHOWN AND CONFIRMED, A LARGE ENTRY FLAGGED (Abdul Majid's rules, ruled by Tahir 15 Oct).
   The person still types Kg/L. The screen shows the packs; he confirms them. A quantity over the batch
   or PO limit is still cut, but the cut is shown. An entry over 10,000 Kg/L is saved and flagged to the
   Production Manager, never stopped. Run: node packs.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab } = H;
const FNS = ['packShiftIncBlock', 'packFmt', 'acKey', 'packShiftIncGate', 'packEntryCalc', 'packConfirmGate', 'packShiftTotal', 'packRowExtras', 'packConfirmInner', 'packFormOf', 'packConfirmTick', 'bigPackJobs', 'openBigPack', 'bigPackSeen'];
function mk(over) {
  const sb = Object.assign({ console, PACK_FLAG_KG: 10000, seedPackForBrand: () => 0, bpEsc: x => String(x), fmt: n => Math.round(n).toLocaleString('en-US'), /* the real fmt rounds to a whole number */ toasts: [], logged: [], $: () => ({ innerHTML: '', classList: { add() {} } }),
    toast: m => sb.toasts.push(m), may: () => true, batchLabApproved: () => true, batchPackableKg: b => b.producedKg - b.packedKg, evDateGate: () => null, evToday: () => '2026-10-15', evStamp: () => ({}),
    shortCloseRefusal: () => null, packPriceGate: () => null, packPriceRecord: () => ({}), packDates: () => ({ mfgDate: '2026-10-15', expDate: '2028-10-15', shelfMonths: 24 }), SHELF_DEFAULT_MONTHS: 24,
    SHELF_OVERRIDE_ROLES: [], hardRole: () => false, fyKey: () => 'FY27', syncPackBatchDates: () => {}, logAction: m => sb.logged.push(m), nid: p => p + (sb.n = (sb.n || 0) + 1), multiTrueUpIfPlaced: () => {},
    save: () => {}, render: () => {}, closeModal: () => {}, denyRight: () => '', _uRole: () => ({ by: 'Abdul Majid' }),
    state: { role: 'Production Manager', currentUser: { name: 'Jawad Naseer' }, masters: {}, packingLog: [], batches: [{ id: 'B', batchNo: 'HG26038', base: 'Potassium Humate', producedKg: 30000, packedKg: 0 }],
      orders: [{ id: 'O', po: 'P1', lines: [{ id: 'L', brand: 'Enrich', base: 'Potassium Humate', pack: 25, ordered: 20000, packed: 0, produced: 0 }] }] } }, over);
  vm.createContext(sb); vm.runInContext(FNS.map(grab).join('\n'), sb); return sb; }
const R = (sb, code) => vm.runInContext(code, sb);
const F = (kg, ok) => ({ bid: 'B', kg, brand: 'Enrich', oid: 'O', lid: 'L', brandBatch: '', packDate: '2026-10-15', shift: 'Morning', incharge: 'Faisal Nadeem', packsOkKg: ok || 0, packsOkSize: ok ? 25 : 0 });
function pack(kg, ok, over) { const sb = mk(over); sb.packForm = F(kg, ok); vm.runInContext(grab('doPack') + '\ndoPack();', sb); return sb; }

/* the calculation */
{ const sb = mk(); sb.packForm = F(500); const c = R(sb, 'packEntryCalc(packForm,"pack")');
  eq('500 Kg/L at 25 per pack is 20 packs', c.packs, 20); ok('a whole number of packs', c.whole); ok('not capped', !c.capped); ok('not large', !c.big); }
{ const sb = mk(); sb.packForm = F(510); const c = R(sb, 'packEntryCalc(packForm,"pack")'); eq('510 Kg/L is 20.4 packs', c.packs, 20.4); ok('...and says it is not whole', !c.whole); }
{ const sb = mk(); sb.packForm = F(30000); const c = R(sb, 'packEntryCalc(packForm,"pack")');
  eq('typing more than the PO needs is cut to what it needs (20,000)', c.kg, 20000); ok('...and the cut is flagged for the screen', c.capped); eq('...packs follow the real figure', c.packs, 800); eq('...and the typed figure is kept', c.typed, 30000); }
{ const sb = mk({ seedPackForBrand: () => 0 }); sb.state.orders[0].lines[0].pack = 0; sb.packForm = F(500); const c = R(sb, 'packEntryCalc(packForm,"pack")');
  eq('no pack size: no packs shown', c.packs, null); eq('...and nothing to confirm', R(sb, 'packConfirmGate(packForm,"pack")'), ''); }
{ const sb = mk({ seedPackForBrand: () => 50 }); sb.state.orders[0].lines[0].pack = 0; sb.packForm = F(500); eq('pack size falls back to the catalogue', R(sb, 'packEntryCalc(packForm,"pack")').packs, 10); }

/* the confirmation */
{ const sb = pack(500, 0); ok('an unconfirmed pack is refused', /packs/i.test(sb.toasts.join(' ')) && /20/.test(sb.toasts.join(' '))); eq('...and moves nothing', sb.state.packingLog.length + sb.state.batches[0].packedKg, 0); }
{ const sb = pack(500, 300); eq('a confirmation for a different quantity does not count', sb.state.packingLog.length, 0); }
{ const sb = pack(500, 500); eq('a confirmed pack counts', sb.state.packingLog.length, 1);
  const r = sb.state.packingLog[0]; eq('...stores the packs', r.packs, 20); eq('...and the pack size', r.packSize, 25); eq('...kg as typed', r.kg, 500); ok('...no flag', !r.bigRun); }
{ const sb = pack(30000, 20000); eq('a cut quantity is confirmed on the real figure', sb.state.packingLog.length, 1); eq('...and the row holds the cut figure', sb.state.packingLog[0].kg, 20000); }
{ const sb = mk(); sb.packForm = F(500); R(sb, 'packConfirmTick("pack",true)'); eq('ticking records the quantity confirmed', sb.packForm.packsOkKg, 500);
  R(sb, 'packConfirmTick("pack",false)'); eq('unticking clears it', sb.packForm.packsOkKg, 0); }

/* the screen text */
{ const sb = mk(); sb.packForm = F(500); const h = R(sb, 'packConfirmInner(packForm,"pack")');
  ok('shows the packs', /500 Kg\/L = 20 packs/.test(h)); ok('has the confirm box', /type="checkbox"/.test(h) && /Yes, 20 packs is what was packed/.test(h)); ok('no large warning', !/flagged/.test(h)); }
{ const sb = mk(); sb.packForm = F(30000); const h = R(sb, 'packConfirmInner(packForm,"pack")');
  ok('a cut is stated, not silent', /You typed 30,000; only 20,000 can be packed here/.test(h)); ok('a large entry says it will be flagged', /flagged to the Production Manager/.test(h)); }
{ const sb = mk(); sb.packForm = F(510); ok('a part pack is called out', /not a whole number of packs/.test(R(sb, 'packConfirmInner(packForm,"pack")'))); }
{ const sb = mk(); sb.packForm = { oid: '', lid: '', kg: 5 }; ok('with no PO it asks for one', /Pick the PO/.test(R(sb, 'packConfirmInner(packForm,"pack")'))); }

/* the 10,000 limit: one entry, saved and flagged, never stopped */
{ const sb = pack(10000, 10000); eq('exactly 10,000 is not flagged', !!sb.state.packingLog[0].bigRun, false); }
{ const sb = pack(10025, 10025); const r = sb.state.packingLog[0]; ok('10,025 is saved', !!r); eq('...kg kept', r.kg, 10025); eq('...flagged', r.bigRun && r.bigRun.limit, 10000); eq('...not yet seen', r.bigRun.ack, false); }
{ const sb = pack(12000, 12000); eq('a large entry is not stopped', sb.state.packingLog.length, 1); eq('...and the PO line counts it', sb.state.orders[0].lines[0].packed, 12000); }

/* the Production Manager's job */
{ const sb = pack(12000, 12000); const j = R(sb, 'bigPackJobs()');
  eq('one Big pack run job', j.length, 1); eq('...for the Production Manager', j[0].role, 'Production Manager'); eq('...labelled Big pack run', j[0].label, 'Big pack run');
  ok('...says kg, packs, shift and in-charge', /12,000 Kg\/L \(480 packs\)/.test(j[0].what) && /Morning/.test(j[0].what) && /Faisal Nadeem/.test(j[0].what) && /keyed by Jawad Naseer/.test(j[0].what));
  const id = sb.state.packingLog[0].id;
  sb.state.role = 'Production'; R(sb, 'bigPackSeen("' + id + '")'); eq('Production cannot mark it seen', R(sb, 'bigPackJobs()').length, 1); ok('...and is told', /Production Manager marks this seen/.test(sb.toasts.join(' ')));
  sb.state.role = 'Production Manager'; R(sb, 'bigPackSeen("' + id + '")'); eq('the Production Manager marks it seen', R(sb, 'bigPackJobs()').length, 0);
  eq('...who is recorded', sb.state.packingLog[0].bigRun.ackBy, 'Abdul Majid'); ok('...and it is logged', sb.logged.some(m => /Big pack run seen/.test(m))); }
{ const sb = pack(500, 500); eq('a normal entry makes no job', R(sb, 'bigPackJobs()').length, 0); }
{ const sb = pack(12000, 12000); sb.state.packingLog[0].reversed = true; eq('a reversed entry makes no job', R(sb, 'bigPackJobs()').length, 0); }


/* audit 15 Oct: whole-number rounding, a tick that outlives a change of line, divert rounding and pool, job identity */
{ const sb = mk(); sb.packForm = F(510); const h = R(sb, 'packConfirmInner(packForm,"pack")');
  ok('a part pack is shown as 20.4 packs, not 20 (real fmt rounds)', /510 Kg\/L = 20\.4 packs/.test(h) && /Yes, 20\.4 packs/.test(h)); }
{ const sb = pack(510, 0); eq('a part pack unconfirmed is refused', sb.state.packingLog.length, 0); ok('...the refusal says 20.4', /20\.4/.test(sb.toasts.join(' '))); }
{ const sb = mk(); sb.state.orders[0].lines.push({ id: 'L2', brand: 'Enrich', base: 'Potassium Humate', pack: 50, ordered: 20000, packed: 0, produced: 0 });
  sb.packForm = F(1000); R(sb, 'packConfirmTick("pack",true)'); eq('ticked on the 25 Kg pack line', R(sb, 'packConfirmGate(packForm,"pack")'), '');
  sb.packForm.lid = 'L2'; ok('moving to the 50 Kg pack line (same kg) cancels the tick', R(sb, 'packConfirmGate(packForm,"pack")') !== '');
  ok('...and the box shows unticked', !/<input type="checkbox" checked/.test(R(sb, 'packConfirmInner(packForm,"pack")'))); }
function div(qty, tickQty, plan) { const sb = mk({ brandsForBase: () => ['Enrich'], SEED: { brandMap: {} }, TODAY: new Date('2026-10-15') });
  sb.state.batches.push({ id: 'P', base: 'Potassium Humate', plannedKg: plan, pool: true, sources: [{ batch: 'B', batchNo: 'HG26038', kg: plan }] });
  sb.divForm = { poolId: 'P', mode: 'pack', qty, bid: '', brand: 'Enrich', oid: 'O', lid: 'L', price: '', priceOk: false, shift: 'Morning', incharge: 'Faisal Nadeem', packsOkKg: tickQty || 0, packsOkSize: tickQty ? 25 : 0 };
  vm.runInContext(grab('consumeDivertSources') + '\n' + grab('submitDivert') + '\nsubmitDivert();', sb); return sb; }
{ const sb = mk(); sb.divForm = { poolId: 'P', qty: 100.4, oid: 'O', lid: 'L' }; sb.state.batches.push({ id: 'P', plannedKg: 1000.7 });
  const c = R(sb, 'packEntryCalc(divForm,"div")'); eq('divert: the quantity is rounded as submitDivert rounds it', c.kg, 100); eq('...so the packs are for 100', c.packs, 4); }
{ const sb = div(100.4, 100, 1000.7); eq('divert: the packs confirmed are the packs saved', sb.state.packingLog.length === 1 && sb.state.packingLog[0].kg === 100 && sb.state.packingLog[0].packs, 4); }
{ const sb = mk(); sb.state.batches.push({ id: 'P', plannedKg: 300 }); sb.divForm = { poolId: 'P', qty: 400, oid: 'O', lid: 'L' };
  const h = R(sb, 'packConfirmInner(divForm,"div")'); ok('divert: above the pool the screen says it will be refused, not "cut"', /more than the pool has \(300 Kg\/L\)\. It will be refused/.test(h) && !/You typed/.test(h)); }
{ const sb = div(400, 400, 300); eq('divert: above the pool is refused and moves nothing', sb.state.packingLog.length, 0); }
{ const sb = pack(12000, 12000); const a = sb.state.packingLog[0]; const sb2 = pack(12000, 12000); sb2.state.packingLog[0].id = 'PKX9';
  sb.state.packingLog.push(Object.assign({}, a, { id: 'PKX9' })); const j = R(sb, 'bigPackJobs()');
  eq('two Big pack run jobs', j.length, 2); ok('...have different keys, so deferring one does not defer the other', R(sb, 'acKey')(j[0]) !== R(sb, 'acKey')(j[1])); }
{ const sb = pack(12000, 12000); sb.state.packingLog[0].kg = 2000; ok('after a stock move reduces the row, the job still names the flagged entry', /12,000 Kg\/L/.test(R(sb, 'bigPackJobs()')[0].what)); }

/* wired into the app */
const html = H.html;
ok('Today collects the job', /bigPackJobs\(\)\.forEach/.test(html));
ok('the job has its card text', /'Big pack run':\s*\{title:/.test(html));
ok('the job has its next step', /'Big pack run':''/.test(html));
ok('the job has an owner in the Guide', /'Big pack run':'Production Manager'/.test(html));
ok('the job has its stage', /lb==='Yield short'\|\|lb==='Big pack run'/.test(html));
ok('the 5 screens show the confirm box (3 live, 2 correction)', (html.match(/packConfirmBlock\('/g) || []).length === 5);
ok('the 3 entries are gated', (html.match(/packConfirmGate\(/g) || []).length === 6); /* 1 definition + 3 entries + 2 correction paths */
ok('the 3 entries store the extras', (html.match(/packRowExtras\(/g) || []).length === 6);

/* the Guide and the changelog move with the flow (CLAUDE.md, 24 Sep rule) */
ok('the Guide tells Production about the picks, the packs and the flag', /_n15=\{'Production':_pk15\+' A packing entry over 10,000 Kg\/L, or a shift that packs over 10,000 Kg\/L in total, is saved/.test(html));
ok('the Guide tells the Production Manager about Big pack run and Seen', /'Production Manager':_pk15\+' A packing entry over 10,000 Kg\/L comes to you as <b>Big pack run<\/b>/.test(html));
ok('the Guide has the rule', /Why packing asks for the shift, the in-charge and the packs/.test(html));
ok('How the app works mentions it', /Each packing entry says which shift and which in-charge packed it/.test(html));
ok('the changelog has the entry and BUILD_ID matches', /ver:'2026-10-15b'/.test(html) && /ver:'2026-10-15c'/.test(html) && /BUILD_ID='2026-10-15c'/.test(html));

/* second audit (15 Oct): fractional pack size, other entries, who may mark Seen */
{ const sb = mk(); sb.state.orders[0].lines[0].pack = 0.5; sb.packForm = F(5); const h = R(sb, 'packConfirmInner(packForm,"pack")');
  ok('a 0.5 pack size is shown as 0.5, not 1', /10 packs<\/b> of 0\.5 Kg\/L/.test(h)); }
{ const sb = mk(); sb.state.orders[0].lines[0].pack = 0.5; sb.packForm = F(5); sb.packForm.kg = 5.5; ok('a fractional quantity is shown with its decimal', /5\.5 Kg\/L = 11 packs/.test(R(sb, 'packConfirmInner(packForm,"pack")'))); }
{ const sb = mk(); sb.packForm = F(500, 500); sb.packForm.incharge = ''; vm.runInContext(grab('doPack') + '\ndoPack();', sb);
  eq('an empty in-charge alone refuses the pack run', sb.state.packingLog.length, 0); ok('...and says in-charge', /in-charge/i.test(sb.toasts.join(' '))); }
{ const sb = mk(); sb.packForm = F(500, 500); sb.packForm.shift = ''; vm.runInContext(grab('doPack') + '\ndoPack();', sb);
  eq('an empty shift alone refuses the pack run', sb.state.packingLog.length, 0); }
{ const sb = mk({ pqMax: () => 300 }); sb.pqForm = { oid: 'O', lid: 'L', qty: 500, shift: 'Morning', incharge: 'Faisal Nadeem', packsOkKg: 0, packsOkSize: 0 };
  const c = R(sb, 'packEntryCalc(pqForm,"pq")'); eq('quantity entry is capped to what the line allows', c.kg, 300); ok('...and the cut is flagged', c.capped); eq('...packs follow the real figure', c.packs, 12);
  ok('an unticked quantity entry is refused', /Check the number of packs \(12\)/.test(R(sb, 'packConfirmGate(pqForm,"pq")')));
  R(sb, 'packConfirmTick("pq",true)'); eq('...a tick passes it', R(sb, 'packConfirmGate(pqForm,"pq")'), '');
  sb.pqForm.qty = 400; sb.pqForm.qty = 200; ok("...and a changed quantity loses the tick", /Check the number of packs/.test(R(sb, "packConfirmGate(pqForm,\"pq\")"))); }
{ const sb = mk(); sb.state.batches.push({ id: 'PL', plannedKg: 1000 }); sb.divForm = { oid: 'O', lid: 'L', qty: 500.4, poolId: 'PL', shift: 'Morning', incharge: 'Faisal Nadeem', packsOkKg: 0, packsOkSize: 0 };
  const c = R(sb, 'packEntryCalc(divForm,"div")'); eq('divert rounds the typed quantity', c.kg, 500); eq('...packs follow the rounded figure', c.packs, 20);
  ok('an unticked divert is refused', /Check the number of packs/.test(R(sb, 'packConfirmGate(divForm,"div")')));
  R(sb, 'packConfirmTick("div",true)'); eq('...a tick passes it', R(sb, 'packConfirmGate(divForm,"div")'), ''); }
{ const sb = pack(12000, 12000); const id = sb.state.packingLog[0].id; sb.state.role = 'COO'; R(sb, 'bigPackSeen("' + id + '")');
  eq('only the Production Manager marks it seen (the COO does not)', R(sb, 'bigPackJobs()').length, 1); }

/* 15 Oct afternoon: the shift total, the limit named, the two correction paths */
{ const sb = mk(); sb.state.packingLog = [{ date: '2026-10-15', shift: 'Morning', incharge: 'Faisal Nadeem', kg: 6000 }, { date: '2026-10-15', shift: 'Morning', incharge: 'Faisal Nadeem', kg: 1000, reversed: true }, { date: '2026-10-14', shift: 'Morning', incharge: 'Faisal Nadeem', kg: 9000 }, { date: '2026-10-15', shift: 'Evening', incharge: 'Faisal Nadeem', kg: 9000 }];
  const f = { shift: 'Morning', incharge: 'Faisal Nadeem' };
  eq('the shift total counts only the same date, shift and in-charge, and not reversed rows', R(sb, 'packShiftTotal(3000,' + JSON.stringify(f) + ',"2026-10-15")'), 9000);
  ok('6,000 then 3,000 is not flagged (9,000)', !R(sb, 'packRowExtras(3000,{pack:25},' + JSON.stringify(f) + ',"2026-10-15")').bigRun);
  const x = R(sb, 'packRowExtras(4500,{pack:25},' + JSON.stringify(f) + ',"2026-10-15")');
  ok('6,000 then 4,500 is flagged: splitting does not hide a run over 10,000', x.bigRun && x.bigRun.total === 10500 && x.bigRun.kg === 4500);
  sb.state.packingLog.push({ date: '2026-10-15', shift: 'Morning', incharge: 'Faisal Nadeem', kg: 4500 }); /* the run is now 10,500 */
  ok('a later entry after the run already crossed is not flagged again (one run, one job)', !R(sb, 'packRowExtras(500,{pack:25},' + JSON.stringify(f) + ',"2026-10-15")').bigRun);
  ok('...but an entry that is itself over 10,000 still is', !!R(sb, 'packRowExtras(10001,{pack:25},' + JSON.stringify(f) + ',"2026-10-15")').bigRun);
  ok('a different in-charge is a different run', !R(sb, 'packRowExtras(4500,{pack:25},{shift:"Morning",incharge:"Adnan Rasheed"},"2026-10-15")').bigRun);
  ok('with no date given only the entry is judged', !R(sb, 'packRowExtras(4500,{pack:25},' + JSON.stringify(f) + ')').bigRun); }
{ const sb = mk(); sb.state.packingLog = [{ date: '2026-10-15', shift: 'Morning', incharge: 'Faisal Nadeem', kg: 6000 }]; sb.packForm = Object.assign(F(5000, 5000), { packDate: '2026-10-15' });
  vm.runInContext(grab('doPack') + '\ndoPack();', sb); const r = sb.state.packingLog[0];
  ok('a split entry that takes the shift over 10,000 is saved, never stopped', sb.state.packingLog.length === 2 && r.kg === 5000); ok('...and flagged with the shift total', r.bigRun && r.bigRun.total === 11000);
  const j = R(sb, 'bigPackJobs()'); ok('...the job says the shift total', j.length === 1 && /11,000 Kg\/L for the shift/.test(j[0].what) && /^Big pack run/.test(j[0].what)); }
{ const sb = mk(); sb.packForm = F(30000); const h = R(sb, 'packConfirmInner(packForm,"pack")'); ok('the cut says the PO set the limit', /the PO line needs only 20,000 more/.test(h)); ok('the box says tick to continue', /Tick this box to continue/.test(h)); }
{ const sb = mk(); sb.state.batches[0].producedKg = 400; sb.packForm = F(500); const h = R(sb, 'packConfirmInner(packForm,"pack")'); ok('the cut says the batch set the limit', /the batch has only 400 left/.test(h)); }
{ const sb = mk(); sb.state.masters = { shifts: [], incharges: [] }; ok('an empty shift list says who to ask', /Ask the COO/.test(R(sb, 'packShiftIncGate({shift:"",incharge:""})')));
  sb.state.masters = { shifts: ['Morning'], incharges: [] }; ok('an empty in-charge list says who to ask', /No in-charge is on the list/.test(R(sb, 'packShiftIncGate({shift:"Morning",incharge:""})'))); }
{ const sb = mk(); sb.dfForm = { oid: 'O', lid: 'L', qty: 500, shift: '', incharge: '', packsOkKg: 0, packsOkSize: 0 };
  const c = R(sb, 'packEntryCalc(dfForm,"df")'); eq('Add missing packing: packs for the typed quantity', c.packs, 20); ok('...never cut', !c.capped);
  ok('...refused with no shift', /shift/.test(R(sb, 'packShiftIncGate(dfForm)'))); ok('...refused with no tick', /Check the number of packs \(20\)/.test(R(sb, 'packConfirmGate(dfForm,"df")')));
  R(sb, 'packConfirmTick("df",true)'); eq('...the tick passes it', R(sb, 'packConfirmGate(dfForm,"df")'), ''); }
{ const sb = mk({ lineFacts: () => ({ gap: 400, ordered: 20000, logged: 0 }) }); sb.lfForm = { po: 'P1', lid: 'L', kg: '', shift: '', incharge: '', packsOkKg: 0, packsOkSize: 0 };
  const c = R(sb, 'packEntryCalc(lfForm,"lf")'); eq('Reconcile: an empty quantity means what the gap allows (400), as lineFixRecord does', c.kg, 400); eq('...packs follow', c.packs, 16);
  sb.lfForm.kg = '250'; eq('...a typed quantity is used as typed', R(sb, 'packEntryCalc(lfForm,"lf")').kg, 250);
  ok('...refused with no tick', /Check the number of packs/.test(R(sb, 'packConfirmGate(lfForm,"lf")'))); R(sb, 'packConfirmTick("lf",true)'); eq('...the tick passes it', R(sb, 'packConfirmGate(lfForm,"lf")'), ''); }
{ const html = H.html; const df = grab('dfSubmitPacking'), lf = grab('lineFixRecord');
  ok('Add missing packing gates before it writes', /packShiftIncGate\(dfForm\)\|\|packConfirmGate\(dfForm,'df'\)/.test(df) && df.indexOf('packShiftIncGate') < df.indexOf('l.packed=(l.packed||0)+q'));
  ok('...and stores the extras and the typist\'s name', /packRowExtras\(q,l,dfForm,d\)/.test(df) && /by:\(\(state\.currentUser&&state\.currentUser\.name\)\|\|state\.role\)/.test(df));
  ok('Write the packing record gates before it writes', /packShiftIncGate\(lfForm\)\|\|packConfirmGate\(lfForm,'lf'\)/.test(lf) && lf.indexOf('packShiftIncGate') < lf.indexOf('b.packedKg=bBefore+kg'));
  ok('...and stores the extras', /packRowExtras\(kg,l,lfForm,d\)/.test(lf));
  ok('Add missing packing starts with the picks empty', /shift:\(op==='packing'\?'':/.test(html)); ok('Write the packing record starts with the picks empty', /shift:'',incharge:'',packsOkKg:0,packsOkSize:0\};/.test(html));
  ok('Write the packing record clears the picks, tick and quantity for the next record', /lfForm\.shift='';\s*lfForm\.incharge='';\s*lfForm\.packsOkKg=0;\s*lfForm\.packsOkSize=0;/.test(lf));
  ok('the job has one name everywhere', !/Large packing run/.test(html)); ok('the sheet says what Seen means', /<b>Seen<\/b> means you have read this and checked the figure with the in-charge/.test(html)); }

/* 15c: the PO is asked for before the shift; the Guide is true for lines with no pack size; names are escaped */
{ const sb = mk(); sb.packForm = Object.assign(F(500), { oid: '', lid: '', shift: '', incharge: '' }); vm.runInContext(grab('doPack') + '\ndoPack();', sb);
  ok('with nothing picked the first message is to pick the PO', /Pick the PO/.test(sb.toasts[0]) && sb.state.packingLog.length === 0, JSON.stringify(sb.toasts)); }
{ const sb = mk(); sb.state.masters = { shifts: ['Morning'], incharges: ['Faisal Nadeem'] }; sb.packForm = Object.assign(F(500, 500), { shift: '', incharge: '' });  vm.runInContext(grab('doPack') + '\ndoPack();', sb);
  ok('with the PO picked the message is about the shift', /Pick the shift/.test(sb.toasts[0]), JSON.stringify(sb.toasts)); }
ok('the Guide says the packs are shown where the PO line has a pack size', (html.match(/where the PO line has a pack size/g) || []).length === 4);
{ const sb = mk({ bpEsc: x => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }); sb.state.masters = { shifts: ['<b>Morning'], incharges: ['A & B'] };
  const h = R(sb, 'packShiftIncBlock({shift:"",incharge:""},"packForm","")'); ok('list names are written escaped', /&lt;b&gt;Morning/.test(h) && /A &amp; B/.test(h) && !/<b>Morning/.test(h)); }
ok('the Guide rule covers the cut, the tick again, no pack size, the correction paths and the typist name', /change the quantity and the box must be ticked again/.test(html) && /says which limit applied/.test(html) && /Where the PO line has no pack size/.test(html) && /Write the packing record\) ask for the same/.test(html) && /carries the name of the person who typed it/.test(html));
ok('the Guide does not promise one job per run', !/once per run/.test(html) && /only the entry that takes the total over 10,000 is flagged; an entry that is itself over 10,000 is always flagged/.test(html));
ok('the Guide tells the COO a wrong pick is reversed and entered again', /A wrong shift or in-charge cannot be edited after saving/.test(html));
process.exitCode = report('Packs confirmed and large entries flagged (15 Oct)') ? 1 : 0;
