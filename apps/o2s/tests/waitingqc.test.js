/* WAITING QC SHOWS THE WHOLE BATCH (13 Oct 2026, build 2026-10-13d).
   HG26042: 25,000 made in 5 lots, L1 (2,750) tested for the batch; the card said only "2,750 made".
   Run: node waitingqc.test.js */
const H = require('./harness.js');
const { ok, eq, report, grab, html } = H;
const src = ['labRepOf', 'labRepApproved', 'labLotWaitsRep', 'labRepWaiting'].map(grab).join('\n') + '\nreturn {w:labRepWaiting};';
const w = new Function('LAB_REP_RULE', src)(true).w;
const lots = [['L1', 2750], ['L2', 6000], ['L3', 5500], ['L4', 7500], ['L5', 3250]].map(([n, q]) => ({ id: n, lotNo: 'HG26042-' + n, qty: q, coa: null }));
const b = { batchNo: 'HG26042', producedKg: 25000, lots, repLot: { lotId: 'L1' } };
let r = w(b);
eq('4 lots wait', r && r.n, 4); eq('22,250 Kg wait', r && r.kg, 22250); eq('5 lots in the batch', r && r.count, 5);
eq('tested lot is L1', r && r.repNo, 'HG26042-L1'); eq('tested lot Kg', r && r.repQty, 2750);
ok('no tested lot marked: nothing to add', w({ batchNo: 'X', lots, producedKg: 25000 }) === null);
ok('a one-lot batch adds nothing', w({ batchNo: 'X', producedKg: 5, lots: [lots[0]], repLot: { lotId: 'L1' } }) === null);
ok('lots with their own certificate are not counted as waiting', (() => { const l2 = lots.map(x => Object.assign({}, x)); l2[1].coa = { status: 'draft' }; const x = w({ batchNo: 'X', lots: l2, repLot: { lotId: 'L1' } }); return x.n === 3 && x.kg === 16250; })());
ok('the Waiting QC card names the batch, the tested lot and the waiting lots', /u\.wait\?\(u\.b\.batchNo/.test(html) && /Tested lot: <b>/.test(html) && /get their certificate from this result/.test(html));
ok('the Follow QC button still opens the tested lot', /openBatchCOA\(\\''\+u\.b\.id\+'\\',\\''\+u\.id\+'\\'\)/.test(html));
ok('the Guide explains that every lot is tested on its own', /Every lot is tested on its own/.test(html));
ok('the 13d changelog entry exists', /ver:'2026-10-13d'/.test(html));
ok('13e: the rule is off, so every lot of a batch shows in Waiting QC', /var LAB_REP_RULE=false;/.test(html));
report('Waiting QC shows the whole batch');
