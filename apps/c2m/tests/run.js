/* C2M tests: run every check (push 10k, audit C-27, 21 Nov 2026). See README.md.
 *   node apps/c2m/tests/run.js            page checks only (needs jsdom; no database)
 *   C2M_TEST_DB=throwaway C2M_TEST_DATABASE_URL=mysql://root:@127.0.0.1:3306/c2m_test node apps/c2m/tests/run.js
 *                                         page checks and route checks (the route checks empty and rebuild that database)
 * Each file prints "<name>: <n> pass, <m> fail"; this adds them up and ends with exit code 1 if any check failed. */
const { spawnSync } = require('child_process'); const fs = require('fs'); const path = require('path');
const files = fs.readdirSync(__dirname).filter(f => /\.test\.js$/.test(f)).sort((a, b) => (a.startsWith('page') ? 0 : 1) - (b.startsWith('page') ? 0 : 1) || a.localeCompare(b));
const withDb = process.env.C2M_TEST_DB === 'throwaway' && !!process.env.C2M_TEST_DATABASE_URL;
let P = 0, F = 0, bad = []; const skipped = [];
for (const f of files) {
  if (f.startsWith('routes-') && !withDb) { skipped.push(f + ' (no test database)'); continue; }
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8', timeout: 300000, env: process.env });
  const out = (r.stdout || '') + (r.stderr || ''); const m = out.match(/(\S+): (\d+) pass, (\d+) fail/);
  if (/skipped, jsdom is not installed/.test(out)) { skipped.push(f + ' (jsdom not installed)'); continue; }
  if (!m || r.status !== 0) { bad.push(f); const L = out.split('\n').filter(l => l.trim()); (m ? L.filter(l => /FAIL|ERROR|Error/.test(l)) : L).slice(-5).forEach(l => console.log('  ' + l)); } // no result: its last lines say why (review 10k m-2)
  if (m) { P += +m[2]; F += +m[3]; console.log(`${m[1]}: ${m[2]} pass, ${m[3]} fail`); } else console.log(f + ': no result (exit ' + r.status + ')');
}
if (skipped.length) console.log('skipped: ' + skipped.join(', '));
console.log(`C2M tests: ${P} pass, ${F} fail` + (bad.length ? `; not clean: ${bad.join(', ')}` : ''));
if (!P && !F && !bad.length) console.log('Nothing ran: install jsdom and/or set the test database (apps/c2m/tests/README.md).');
process.exit(F || bad.length ? 1 : 0);
