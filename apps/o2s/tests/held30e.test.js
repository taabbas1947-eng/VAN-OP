/* BUILD 2026-10-30e. Tahir, 30 Oct 2026 (panel): a pool (by-product, diverted or rework material kept on purpose)
   shows on the Stuck batches list of How are we doing as a held pool, not as stuck, and is not counted as stuck.
   Live case: the Nitro Sulfur pool B3879-eyyp, 11,025 Kg/L of Sulfur Coated Urea leftovers, open since 26 Sep. D-354.
   Run: node held30e.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;
const SRC = ['isBatchStuck', 'stuckBatches', 'heldPools', 'heldPoolRowsHTML'].map(n => grab(n)).join('\n');
function box(batches, age, idle) {
  const b = { console, Math, JSON, Object, String, Array, state: { batches }, batchAge: () => age, batchIdleDays: () => idle, batchPOsLabel: () => '',
    fmt: n => Number(n).toLocaleString('en-US'), _pe: x => String(x == null ? '' : x).replace(/</g, '&lt;') };
  vm.createContext(b); vm.runInContext(SRC, b); return b; }
const pool = { id: 'B3879-eyyp', batchNo: '', kind: 'bulk', type: 'stock', base: 'Nitro Sulfur', plannedKg: 11025, producedKg: 0, status: 'open', openedDate: '2026-09-26', disposition: 'byproduct', pool: true };
const real = { id: 'B1', batchNo: 'HG26040', kind: 'bulk', base: 'Humi Grow', plannedKg: 1000, producedKg: 0, status: 'open', openedDate: '2026-10-01' };
{ const b = box([pool, real], 35, 35);
  ok('a pool is never stuck', b.isBatchStuck(pool) === false);
  ok('a real batch open 35 days, idle 35, is still stuck', b.isBatchStuck(real) === true);
  eq('the stuck list (and its count) has the real batch only', JSON.stringify(b.stuckBatches().map(x => x.id)), JSON.stringify(['B1']));
  eq('the held list has the pool', JSON.stringify(b.heldPools().map(x => [x.id, x.product, x.kind, x.kg])), JSON.stringify([['B3879-eyyp', 'Nitro Sulfur', 'by-product', 11025]]));
  const h = b.heldPoolRowsHTML();
  ok('the held row says Held pool, days open, held not stuck, Kg/L kept', /<b>Held pool<\/b><\/td><td>Nitro Sulfur<\/td>/.test(h) && /35d open/.test(h) && /held, not stuck/.test(h) && /11,025 Kg\/L by-product kept/.test(h), h);
  ok('the held row is not red', !/var\(--red\)/.test(h)); }
{ const closed = Object.assign({}, pool, { status: 'closed' }), voided = Object.assign({}, pool, { voided: true }), dv = Object.assign({}, pool, { id: 'P2', disposition: 'divert', base: 'Zinc 21%' });
  const b = box([closed, voided, dv], 10, 10);
  eq('a closed or voided pool is not listed; a diverted pool is', JSON.stringify(b.heldPools().map(x => [x.id, x.kind])), JSON.stringify([['P2', 'diverted material']])); }
{ const empty = Object.assign({}, pool, { plannedKg: 0.4 }); eq('an emptied pool (called back in full) is not listed', box([empty], 40, 40).heldPools().length, 0); }
ok('the operations table title names held pools', /Batches not closed \u2014 open 7\+ days, idle 3\+ days, and held pools|Batches not closed — open 7\+ days, idle 3\+ days, and held pools/.test(html));
ok('both Stuck batches tables add the held rows', (html.match(/\.join\(''\)\+heldPoolRowsHTML\(\);   \/\* 30e \*\//g) || []).length === 2);
ok('the Guide rule says a pool is held, not stuck', /It is never stuck: on How are we doing it shows as <b>Held pool<\/b>/.test(html));
ok('the changelog has 30e and the build matches', /ver:'2026-10-30e'/.test(html) && /var BUILD_ID='2026-10-(30[e-z]|31[a-z])'/.test(html) && /var SYSDOC_VER='2026-10-(30[e-z]|31[a-z])'/.test(html) && /"id":"D-354"/.test(html));
process.exitCode = report('30e: a pool is held, not stuck') ? 1 : 0;
