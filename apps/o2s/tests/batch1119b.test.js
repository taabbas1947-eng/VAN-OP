/* BUILD 2026-11-19b. Batch 1 of the fixes from the 18 Nov 2026 audit, part B1. Tahir ruled on 19 Nov 2026:
   F6 (D-375): a step that removed a row keeps it, whole, as voided, in 1 separate voided-rows list ("Separate voided
   list"), with how, why, who and when; every total leaves it out; the order line History and the Batch trace show it.
   F7 (D-376): dealers, warehouses, rmRequests, rmMovements, rawStock and the rmDecision field move to an archive
   inside the data; nothing is deleted.
   Run: node batch1119b.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;
const clone = x => JSON.parse(JSON.stringify(x));

/* ---------- F6: the helper ---------- */
const base = () => { const c = { console, Math, String, JSON, Date, Object, Array };
  vm.createContext(c); vm.runInContext(['_hash', 'voidRowKeep'].map(grab).join('\n'), c); return c; };
{ const c = base(), s = {};
  const v = c.voidRowKeep(s, 'packingLog', { id: 'PK1', po: 'P1', brand: 'B', kg: 500 }, 'Duplicate repair on load', 'why', undefined, { batchId: 'B1' });
  ok('F6: a row is kept whole, with list, how, why, who and when', v && v.list === 'packingLog' && v.row.kg === 500 && v.how === 'Duplicate repair on load' && v.why === 'why' && v.by === 'System' && !!v.at && v.batchId === 'B1');
  c.voidRowKeep(s, 'packingLog', { id: 'PK1', po: 'P1', brand: 'B', kg: 500 }, 'Duplicate repair on load', 'why');
  eq('F6: the same row kept twice (2 pages, or a load and a merge) is 1 entry', s.voidedRows.length, 1);
  c.voidRowKeep(s, 'packingLog', { id: 'PK1', po: 'P1', brand: 'B', kg: 400 }, 'Duplicate repair on load', 'why');
  eq('F6: a different copy with the same id is its own entry', s.voidedRows.length, 2);
  ok('F6: the kept copy does not change when the live row changes', (function(){ const r = { id: 'X', kg: 1 }; c.voidRowKeep(s, 'shipments', r, 'h'); r.kg = 99; return s.voidedRows[2].row.kg === 1; })());
  ok('F6: every entry has an id, so the merge matches them by id', s.voidedRows.every(x => typeof x.id === 'string' && /^VR-/.test(x.id)));
}

/* ---------- F6: the repairs on load keep what they take out, and the live lists are as before ---------- */
{ const c = base(); vm.runInContext(['dedupePackingLots', 'dedupeShipmentsV1', 'healVU26144ProdLog'].map(grab).join('\n'), c);
  const s = { orders: [{ po: 'P1', lines: [{ id: 'L1', brand: 'B', packed: 1000, dispatched: 600 }] }],
    batches: [{ id: 'BA', batchNo: 'VB1', packedKg: 1000 }, { id: 'BV', batchNo: 'VU26144', producedKg: 1000 }],
    packingLog: [
      { id: 'PK1', po: 'P1', brand: 'B', kg: 500, baseBatchId: 'BA', insKg: 500, shipKg: 300 },
      { id: 'PK1', po: 'P1', brand: 'B', kg: 500, baseBatchId: 'BA', insKg: 0, shipKg: 0 },   /* same id: pass 1 */
      { id: 'PK2', po: 'P1', brand: 'B', kg: 500, baseBatchId: 'BA', insKg: 500, shipKg: 300 },
      { id: 'PK3', po: 'P1', brand: 'B', kg: 500, baseBatchId: 'BA', insKg: 0, shipKg: 0 } ],  /* over-packs BA: pass 2 */
    inspections: [], shipments: [
      { id: 'SH1', po: 'P1', lid: 'L1', brand: 'B', kg: 600, dc: '5001', dispCounted: true },
      { id: 'SH2', po: 'P1', lid: 'L1', brand: 'B', kg: 600, dc: '5001', dispCounted: true } ],
    productionLog: [{ id: 'PL1', batchNo: 'VU26144', kg: 1000 }, { id: 'PL1_2', batchNo: 'VU26144', kg: 1000 }], audit: [] };
  const before = clone(s);
  c.dedupePackingLots(s); c.dedupeShipmentsV1(s); c.healVU26144ProdLog(s);
  eq('F6: the live packing runs add up to the batch packed (1,000)', s.packingLog.reduce((a, p) => a + p.kg, 0), 1000);
  eq('F6: the live trucks add up to the line dispatched (600)', s.shipments.reduce((a, x) => a + x.kg, 0), 600);
  eq('F6: the live production log adds up to produced (1,000)', s.productionLog.reduce((a, p) => a + p.kg, 0), 1000);
  const lists = ['packingLog', 'shipments', 'productionLog'];
  ok('F6: every row taken out is kept in voidedRows (nothing lost)', lists.every(L => before[L].length === s[L].length + (s.voidedRows || []).filter(v => v.list === L).length));
  ok('F6: the duplicate truck row and log row are kept, not live', (function(){ const k = s.voidedRows.filter(v => v.list === 'shipments').map(v => v.rowId); return k.length === 1 && !s.shipments.some(x => x.id === k[0]) && s.shipments.length === 1; })() && !s.productionLog.some(p => p.id === 'PL1_2') && s.voidedRows.some(v => v.list === 'productionLog' && v.rowId === 'PL1_2'));
  ok('F6: the over-packed copy is kept, not live', (function(){ const live = s.packingLog.map(p => p.id).sort().join(','), kept = s.voidedRows.filter(v => v.list === 'packingLog' && v.rowId !== 'PK1').map(v => v.rowId); return kept.length === 1 && live.indexOf(kept[0]) < 0 && live.split(',').concat(kept).sort().join(',') === 'PK1,PK2,PK3'; })());
  ok('F6: each kept row says how and why', (s.voidedRows || []).every(v => /Duplicate repair on load/.test(v.how) && v.why.length > 5));
  const n = s.voidedRows.length; c.dedupePackingLots(s); c.dedupeShipmentsV1(s); c.healVU26144ProdLog(s);
  eq('F6: a second load keeps nothing more', s.voidedRows.length, n);
}

/* ---------- F6: the steps that remove rows call the keeper ---------- */
{ const r = grab('doRemoveLot');
  ok('F6: Removed shift output keeps the lot', /_vrK\(state,'lots',lt,'Removed shift output'/.test(r));
  ok('F6: ...its shift entry', /_vrK\(state,'shiftEntries',se\[si\]/.test(r));
  ok('F6: ...and its production log row(s), single and multi', (r.match(/_vrK\(state,'productionLog'/g) || []).length === 2);
  ok('F6: the reason picked and typed goes with them', /_vrWhy=\(rmLotForm\.reasonCode/.test(r));
  ok('F6: the remove sheet says the rows are kept as voided', /leave the records and are kept as voided, with your reason/.test(grab('renderRemoveLot')));
  ok('F6: ...and the lot it takes off the batch', /voidRowKeep\(state,'lots',b\.lots\[idx\],'Production entry removed by the COO'/.test(grab('_voidReverseBatch')));
  ok('F6: the unused remove-production-entry step keeps the row', /voidRowKeep\(state,'productionLog',p,'Production entry removed by the COO'/.test(grab('voidProdEntry')));
}

/* ---------- F6: COA send-back and reject keep who did each test ---------- */
{ const c = { console, String }; vm.createContext(c); vm.runInContext(grab('coaTestsDone'), c);
  const kept = c.coaTestsDone({ tests: [{ name: 'N', doneAt: '2026-11-18T10:00', doneBy: 'Ali' }, { name: 'K2O' }] });
  ok('F6: who did each test and when is copied', kept.length === 1 && kept[0].test === 'N' && kept[0].doneBy === 'Ali' && kept[0].doneAt === '2026-11-18T10:00');
  ok('F6: a send-back copies them before clearing', /r\.testsDone=coaTestsDone\(c\); \(c\.tests\|\|\[\]\)\.forEach\(function\(t\)\{ delete t\.doneAt;/.test(grab('coaSendBack')));
  ok('F6: a reject copies them before clearing', /var _td=labIsV2\(h\.coa\)\?coaTestsDone\(h\.coa\):\[\]; if\(labIsV2/.test(grab('coaReject')) && /h\.coa\.rejected\.testsDone=_td/.test(grab('coaReject')));
}

/* ---------- F6: the History and the Batch trace show voided rows ---------- */
{ const st = { packingLog: [], corrections: [], actionLog: [], audit: [], voidedRows: [
    { id: 'VR-1', list: 'packingLog', how: 'Duplicate repair on load', why: 'same as PK1', by: 'System', at: '2026-11-19T05:00:00Z', row: { id: 'PK9', po: 'P1', lid: 'L1', brand: 'B', kg: 500, baseBatchNo: 'VB1' } },
    { id: 'VR-2', list: 'shipments', how: 'Duplicate repair on load', why: 'DC 5001', by: 'System', at: '2026-11-19T05:00:00Z', row: { id: 'SH9', po: 'P1', lid: 'L1', brand: 'B', kg: 600, dc: '5001' } },
    { id: 'VR-3', list: 'lots', how: 'Removed shift output', why: 'typo: entered twice', by: 'Majid', at: '2026-11-19T06:00:00Z', batchId: 'BA', row: { id: 'LOT1', lotNo: 'VB1-L2', qty: 300 } },
    { id: 'VR-4', list: 'packingLog', how: 'x', why: '', by: 'System', at: '2026-11-19', row: { id: 'PK8', po: 'P2', brand: 'B', kg: 1 } } ] };
  const c = { console, Math, String, JSON, state: st, RegExp };
  vm.createContext(c);
  vm.runInContext(['lineHistory', 'batchVoidedHTML'].map(grab).join('\n') + '\nfunction fmt(n){ return String(n); }\nfunction qsEsc(s){ return String(s==null?"":s).replace(/</g,"&lt;"); }'
    + '\nfunction lotBaseNo(p){ return p.baseBatchNo||""; }\nfunction lineFacts(){ return {sh:[]}; }\nfunction unitOf(){ return "Kg"; }\nfunction saleLeft(){ return false; }', c);
  const E = c.lineHistory({ po: 'P1', lines: [{ id: 'L1', brand: 'B' }] }, { id: 'L1', brand: 'B' }).map(e => e.txt).join(' | ');
  ok('F6: the order History shows a voided packing run with how and why', /Packing run 500 from batch VB1 kept as <b>voided<\/b>: Duplicate repair on load/.test(E));
  ok('F6: the order History shows a voided truck row', /Truck row DC 5001 · 600 kept as <b>voided<\/b>/.test(E));
  ok('F6: another PO\'s voided row is not on this line', !/PK8/.test(E) && !/ 1 from batch/.test(E));
  const B = c.batchVoidedHTML({ id: 'BA', batchNo: 'VB9' });
  ok('F6: the Batch trace lists the voided lot with its reason and who', /Kept as voided \(1\)/.test(B) && /Lot VB1-L2/.test(B) && /typo: entered twice/.test(B) && /Majid/.test(B));
  eq('F6: a batch with nothing voided shows nothing', c.batchVoidedHTML({ id: 'ZZ', batchNo: 'ZZ' }), '');
  ok('F6: the Batch trace page adds it', /batchVoidedHTML\(b\)/.test(grab('batchTraceHTML')));
  ok('F6: the year-end reset empties the voided rows with the transactions', /state\.voidedRows=\[\]/.test(grab('startNewYearClean')));
}

/* ---------- F7: the archive ---------- */
{ const c = { console, Date, Object, Array, JSON }; vm.createContext(c); vm.runInContext(grab('archiveRetiredV1'), c);
  const s = { dealers: [{ code: 'D1' }], warehouses: ['Main Warehouse'], rmRequests: [], rmMovements: [], rawStock: {}, orders: [{ id: 'O1', po: 'P1', rmDecision: 'pending' }, { id: 'O2', po: 'P2' }], customers: [{ code: 'D1' }] };
  c.archiveRetiredV1(s);
  ok('F7: the 5 lists leave the live data', ['dealers', 'warehouses', 'rmRequests', 'rmMovements', 'rawStock'].every(k => s[k] === undefined));
  ok('F7: they are kept whole in archive.retired', s.archive.retired.lists.dealers[0].code === 'D1' && s.archive.retired.lists.warehouses[0] === 'Main Warehouse' && Array.isArray(s.archive.retired.lists.rmRequests) && typeof s.archive.retired.lists.rawStock === 'object');
  ok('F7: rmDecision leaves each order and is kept by order id', s.orders[0].rmDecision === undefined && s.archive.retired.rmDecision.O1 === 'pending' && !('O2' in s.archive.retired.rmDecision));
  ok('F7: it says when and why', !!s.archive.retired.at && /F7/.test(s.archive.retired.why) && s._archiveV1 === true);
  const snap = JSON.stringify(s); c.archiveRetiredV1(s);
  eq('F7: a second run changes nothing', JSON.stringify(s), snap);
  s.dealers = [{ code: 'D1' }]; s.rmRequests = []; c.archiveRetiredV1(s);
  ok('F7: a key a merge brings back moves again, and an empty one never overwrites the kept list', s.dealers === undefined && s.rmRequests === undefined && s.archive.retired.lists.dealers.length === 1);
  eq('F7: customers are untouched', s.customers.length, 1);
  s.dealers = [{ code: 'D1' }, { code: 'D9' }]; c.archiveRetiredV1(s);
  ok('F7: a later, different copy never replaces the kept list; it is kept beside it', s.archive.retired.lists.dealers.length === 1 && s.archive.retired.later.length === 1 && s.archive.retired.later[0].key === 'dealers' && s.archive.retired.later[0].value.length === 2 && s.dealers === undefined);
  const h = { rawStock: { Urea: 500, DAP: 0 }, orders: [] }; c.archiveRetiredV1(h);
  ok('F7: a raw-stock map that holds stock stays live (it feeds committed dates and RM Position)', h.rawStock && h.rawStock.Urea === 500 && !(h.archive && h.archive.retired && h.archive.retired.lists.rawStock));
  const z = { rawStock: { Urea: 0 }, orders: [] }; c.archiveRetiredV1(z);
  ok('F7: an all-zero raw-stock map is archived', z.rawStock === undefined && z.archive.retired.lists.rawStock.Urea === 0);
}
{ const es = grab('ensureState');
  ok('F7: ensureState no longer makes the retired lists', !/s\.dealers\s*=/.test(es) && !/s\.warehouses=/.test(es) && !/s\.rmRequests=/.test(es) && !/s\.rmMovements=/.test(es) && !/s\.rawStock=/.test(es));
  ok('F7: ensureState moves them to the archive last', /linkShipBatchLotsV1\(s\); archiveRetiredV1\(s\); return s;/.test(es));
  ok('F7: new orders no longer carry rmDecision', !/rmDecision/.test(grab('submitPO')) && !/rmDecision/.test(grab('dfSubmitPO') || '') );
  ok('F7: the truck backfill no longer reads the warehouse names', !/state\.warehouses/.test(grab('dfSubmitShipment')));
  ok('F7: the year-end reset no longer makes them again', !/state\.rmRequests=|state\.rmMovements=|state\.rawStock=/.test(grab('startNewYearClean')));
  const c = { console }; vm.createContext(c); vm.runInContext(grab('rmCheck') + '\nfunction needFor(){ return {Urea:10}; }', c);
  ok('F7: the raw-material check reads a missing raw-stock map as 0', (function(){ try{ const r = c.rmCheck({}, {}); return r.short.length === 1 && r.short[0].have === 0; }catch(e){ return false; } })());
  ok('F7: receiving a PR makes the raw-stock map again only then', /state\.rawStock=state\.rawStock\|\|\{\}; state\.rawStock\[p\.rm\]/.test(grab('receivePR')));
}

/* ---------- change log, Guide, build and System Documentation ---------- */
ok('change log 2026-11-19b says the 3 changes', /ver:'2026-11-19b'/.test(html) && /kept, whole, in 1 list of voided rows/.test(html) && /who did each test and when is kept with the send-back/.test(html) && /moved, whole, into an archive inside the data/.test(html));
ok('the Guide rule Nothing is deleted says rows are kept as voided', /A row taken out of the records \(a removed shift output, or a duplicate found when O2S opens\) is kept whole as <b>voided<\/b>/.test(html));
ok('the Guide tells each role what changed', /var _n19b=\{'Production Manager':/.test(grab('guideMyJob')) && /New on 19 Nov \(2026-11-19b\)/.test(grab('guideMyJob')));
ok('BUILD_ID is 2026-11-19b and SYSDOC_VER follows', /var BUILD_ID='2026-11-19b';/.test(html) && /var SYSDOC_VER='2026-11-19b'/.test(html));
ok('the System Documentation carries D-375, D-376, SC-47 and SC-48', /"id":"D-375"/.test(html) && /"id":"D-376"/.test(html) && /"id":"SC-47"/.test(html) && /"id":"SC-48"/.test(html));
ok('SC-36 lists the steps that now keep rows as voided', /kept whole in voidedRows with how, why, who and when, never deleted/.test(html));

report('2026-11-19b batch 1, part B1: voided rows kept, unused lists archived');
