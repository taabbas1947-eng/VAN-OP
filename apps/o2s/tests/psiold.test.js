/* 7 Oct 2026 (07c) — AN OLD TRUCK IS JUDGED BY WHAT WAS KNOWN WHEN IT LEFT.
   PSI-110 (Kisan, GPH26002, left 4 Sep) printed FAILED with every check passed:
   one inspection on 28 Aug failed the date check, the batch was re-inspected and
   passed on 29 Aug, and inspections from 12 and 16 Sep (after the truck left)
   were counted too. Run: node psiold.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab } = H;
const ins = (id, d, pass, extra) => Object.assign({ id, brand: 'Germinator Pro - Humic', actualDate: d, date: d, pass, batches: [{ brand: 'GPH26002', batch: 'GP26002' }],
  checklist: [{ item: 'Packaging intact', result: 'pass' }], verify: [{ item: 'Mfg and expiry dates', result: pass ? 'pass' : 'fail' }] }, extra || {});
const sb = { console, state: { inspections: [ins('I1', '2026-08-22', true), ins('I2', '2026-08-28', false), ins('I3', '2026-08-29', true), ins('I4', '2026-09-12', true), ins('I5', '2026-09-16', true), ins('I6', '2026-08-30', false, { superseded: { by: 'x' } })] } };
vm.createContext(sb);
vm.runInContext(['psiPackNo', 'psiDetailFor'].map(grab).join('\n'), sb);
const truck = d => ({ dispId: 'D', date: d, rows: [{ brand: 'Germinator Pro - Humic', qa: { pass: true, closed: true }, batches: [{ brand: 'GPH26002', batch: 'GP26002', kg: 800 }] }] });
let d = sb.psiDetailFor(truck('2026-09-04'));
ok('PSI-110 (left 4 Sep): passes - the 29 Aug re-inspection is the last before it left', d.pass === true);
eq('...and only that inspection decides', d.recs.map(x => x.id).join(','), 'I3');
ok('...nothing made after the truck left is counted', !d.recs.some(x => x.actualDate > '2026-09-04') && d.after === false);
d = sb.psiDetailFor(truck('2026-08-28'));
ok('a truck that left on 28 Aug, the day of the failed check, stays FAILED', d.pass === false && d.recs[0].id === 'I2');
d = sb.psiDetailFor(truck('2026-08-21'));
ok('a truck that left before any inspection shows the first later one, marked as after dispatch', d.recs[0].id === 'I1' && d.after === true);
ok('a withdrawn inspection never decides', !sb.psiDetailFor(truck('2026-08-31')).recs.some(x => x.id === 'I6'));
const pp = grab('printPSI');
ok('the print shows the date and batch verification rows, not only the 8 physical checks', (pp.match(/\+vr\+cr\+/g) || []).length === 2);
ok('a passing and a failing record are never merged into one block', /\(x\.pass\?'P':'F'\)/.test(pp) && /x\.verify\|\|\[\]\)\.map/.test(pp));
ok('an inspection made after the truck left says so on the print', /This inspection was made after the truck left\./.test(pp));
ok('the note says which inspection counts', /for each batch, the last inspection made before the truck left/.test(H.html));
process.exitCode = report('Old trucks judged by what was known when they left (07c)') ? 1 : 0;
