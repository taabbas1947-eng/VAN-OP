/* PLATFORM · PD removed — 17 Oct 2026, Tahir ("lets remove PD today"; C2L replaces it).
 * Proves PD is gone from the platform: no PD files, nothing loads them, PD roles cannot be given,
 * the Render disk that held only PD Library uploads is gone, and PD's old addresses send people
 * to the launcher instead of falling into the O2S catch-all. No database needed: it reads the files
 * and boots the server in local-file mode on a free port.
 *   node tests/pd-removed.test.js
 */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0; const fails = [];
const ok = (n, c, x) => c ? pass++ : (fail++, fails.push(n + (x ? '  [' + x + ']' : '')));
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const srv = read('server.js'), lau = read('launcher.html'), ry = read('render.yaml');
const code = s => s.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');   // lines that are not comments

ok('apps/pd is gone', !fs.existsSync(path.join(ROOT, 'apps', 'pd')));
ok('server.js loads nothing from apps/pd', !/require\(['"]\.\/apps\/pd/.test(srv) && !/apps', 'pd'/.test(srv));
ok('no PD auth, surface, audit logger or start-up step left', !/pdAuth|pdSurface|pdAuditLogger|runPdMigration|PD_ROLE_KEYS/.test(code(srv)));
ok('PD is not in the module list, the admin list or the role check', !/key: 'pd'/.test(srv) && /const REAL_MODULES = \['o2s'\]/.test(srv) && !/module === 'pd'/.test(srv));
ok('PD roles are no longer copied from auth_users.pd_role at start-up (they would come back on every restart)', !/SELECT username, 'pd', pd_role/.test(srv));
ok('the legacy column map no longer writes pd_role', /const LEGACY_COL = \{ o2s: 'role' \};/.test(srv));
ok("PD's old addresses go to the launcher", /app\.get\(\['\/drop', '\/pd', '\/pd\/\*'\], \(req, res\) => res\.redirect\(302, '\/'\)\);/.test(srv));
const iRedir = srv.indexOf("app.get(['/drop', '/pd', '/pd/*']"), iCatch = srv.indexOf("app.get('*'");
ok('the redirect sits before the O2S catch-all', iRedir > 0 && iRedir < iCatch);
ok('the launcher has no PD role list or PD fallback column', !/PD_ROLES|pdRoles|key: 'pd'/.test(code(lau)));
ok('render.yaml has no disk and no PD_LIBRARY_DIR', !/^\s*disk:/m.test(ry) && !/PD_LIBRARY_DIR/.test(ry));

let child = null, out = '';
const stop = () => { try { child && child.kill(); } catch (e) {} };
(async () => {
  const PORT = await new Promise(res => { const t = require('net').createServer(); t.listen(0, '127.0.0.1', () => { const p = t.address().port; t.close(() => res(p)); }); });
  const env = Object.assign({}, process.env, { PORT: String(PORT), DATABASE_URL: '', SESSION_SECRET: 'pd-removed-test' });
  child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', d => out += d); child.stderr.on('data', d => out += d);
  const B = 'http://127.0.0.1:' + PORT;
  let up = false;
  for (let i = 0; i < 40 && !up; i++) { await new Promise(r => setTimeout(r, 250)); try { up = (await fetch(B + '/api/health')).ok; } catch (e) {} }
  ok('server starts without PD', up, out.slice(-300));
  if (up) {
    for (const p of ['/pd', '/pd/library', '/drop']) {
      const r = await fetch(B + p, { redirect: 'manual' });
      ok(p + ' goes to the launcher (302 to /)', r.status === 302 && r.headers.get('location') === '/', r.status + ' ' + r.headers.get('location'));
    }
    ok('/api/pd/* answers 404, not a PD screen', (await fetch(B + '/api/pd/me')).status === 404);
    ok('the launcher and O2S still answer', (await fetch(B + '/')).status === 200 && (await fetch(B + '/o2s')).status === 200);
    ok('no PD error at start-up', !/PD |pd-lib|pd-routes/i.test(out), out.slice(-300));
  }
  stop();
  console.log('\nPLATFORM pd removed: ' + pass + ' passed, ' + fail + ' failed');
  fails.forEach(f => console.log('  FAIL  ' + f));
  process.exit(fail ? 1 : 0);
})().catch(e => { stop(); console.error(e); process.exit(1); });
