/* PLATFORM · C2M (Cost to Margin) mount — 17 Oct 2026, Tahir.
 * The platform part of C2M: the pool handed to apps, the guarded mount of apps/c2m/c2m-routes.js,
 * and c2m in the module list, role check, admin list and role catalogue, all only when C2M is
 * installed. No database needed: it reads server.js and boots the server in local-file mode on a
 * free port to prove it starts with or without the C2M files.
 *   node tests/c2m-mount.test.js
 */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0; const fails = [];
const ok = (n, c, x) => c ? pass++ : (fail++, fails.push(n + (x ? '  [' + x + ']' : '')));
const srv = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8').replace(/\r\n/g, '\n');

/* the pool */
ok('C2M has its own small pool, separate from the one O2S saves use', /let dbPool = null;/.test(srv) && /dbPool = mysql\.createPool\(\{ \.\.\.parseMysqlUrl\(DATABASE_URL\), dateStrings: true, connectionLimit: 3 \}\);/.test(srv));
ok('the main pool is still the one O2S and PD use', /const q = \(sql, params\) => pool\.execute\(sql, params \|\| \[\]\);\n\s+pdq = q;/.test(srv));
// 28 Oct 2026 (roles trial): every role, C2M CFO and COO included, is given only through the System Administrator's gate.
ok('only a System Administrator gives C2M roles, CFO and COO included', /app\.post\('\/api\/platform\/access', auth, accessAdmin,/.test(srv));

/* registration only when installed */
ok('C2M roles read from apps/c2m/c2m-routes.js ROLES', /C2M_ROLES = require\(C2M_FILE\)\.ROLES \|\| \{\}/.test(srv));
ok('reading the roles is guarded (file exists, try/catch)', /try \{ if \(fs\.existsSync\(C2M_FILE\)\) C2M_ROLES = require/.test(srv) && /console\.error\('C2M roles not loaded:'/.test(srv));
ok('module list carries c2m only when installed', /\.\.\.\(C2M_INSTALLED \? \[\{ key: 'c2m', name: 'C2M', live: true \}\] : \[\]\)/.test(srv));
ok('REAL_MODULES carries c2m only when installed', /const REAL_MODULES = \['o2s'\]\.concat\(C2M_INSTALLED \? \['c2m'\] : \[\]\);/.test(srv));
/* Piece 1b (21 Oct 2026, with its review fixes): C2M roles come from C2M's table c2m_role. */
ok('a C2M role must match c2m_role exactly, capitals included', /SELECT role_key, builtin FROM c2m_role WHERE BINARY role_key = \? LIMIT 1/.test(srv) && /if \(module === 'c2m'\) return !!\(await c2mRole\(role\)\);/.test(srv));
ok('the built-in list is used ONLY when c2m_role is missing; other errors are thrown', /if \(isNoTable\(e\)\) return Object\.prototype\.hasOwnProperty\.call\(C2M_ROLES, role\)/.test(srv) && /throw e;/.test(srv.slice(srv.indexOf('async function c2mRole'), srv.indexOf('async function validModuleRole'))));
ok('no C2M role is valid while C2M is not installed', /if \(!C2M_INSTALLED \|\| !role\) return null;/.test(srv));
ok('validModuleRole is async and no caller forgets await (a Promise is truthy: every role would pass)', /async function validModuleRole\(module, role\)/.test(srv) && /if \(!\(await validModuleRole\(module, role\)\)\)/.test(srv) && !/!\s*validModuleRole\(/.test(srv) && (srv.match(/validModuleRole\(/g) || []).length === (srv.match(/await validModuleRole\(|async function validModuleRole\(/g) || []).length);
// 28 Oct 2026 (roles trial): app admin was removed, so there is no C2M sub-admin left to guard; only a System Administrator gives roles.
ok('only a System Administrator manages access (app admin removed)', /if \(!caps\.isCOO\) return res\.status\(403\)\.json\(\{ error: 'Only a System Administrator can manage people and access\.' \}\)/.test(srv));
ok('the role catalogue reads c2m_role, falls back on a missing table and logs any other error', /SELECT role_key, label, builtin FROM c2m_role ORDER BY label/.test(srv) && /if \(!isNoTable\(e\)\) console\.error\('C2M roles: c2m_role could not be read/.test(srv) && /const byKey = \{ o2s, c2m: c2mRoles \};/.test(srv) && /heldIn\('c2m', c2mRoles\)/.test(srv));
ok('o2s is unchanged in the module list, and PD is gone (removed 17 Oct 2026)', /\{ key: 'o2s', name: 'O2S', live: true \},/.test(srv) && !/key: 'pd'/.test(srv));

/* the mount */
const iMount = srv.indexOf('require(C2M_FILE)(app,');
const iNotify = srv.indexOf("apps', 'o2s', 'notify-routes.js'");
const i404 = srv.indexOf("app.use('/api', (req, res) => res.status(404)");
const iCatch = srv.indexOf("app.get('*'");
ok('mount line present', iMount > 0);
ok('mounted after the O2S alerts block', iMount > iNotify);
ok('mounted before the /api 404', iMount < i404);
ok('mounted before the O2S catch-all (else /c2m would be the O2S page)', iMount < iCatch);
ok('mounted only when its roles loaded, so the mount and People and access agree', /if \(C2M_INSTALLED\) \{ try \{ require\(C2M_FILE\)/.test(srv));
ok('a broken C2M file is logged and skipped, never stops the server', /catch \(e\) \{ console\.error\('C2M not mounted:'/.test(srv));
ok('hands C2M its own pool for queries and transactions, plus sign-in, path, fs, crypto, and the platform services', /require\(C2M_FILE\)\(app, \{ pdq: dbPool \? \(sql, params\) => dbPool\.execute\(sql, params \|\| \[\]\) : null, pool: dbPool, auth, path, fs, crypto, services: platformServices \}\)/.test(srv));
// 28 Oct 2026 (roles trial): the services C2M's roles service needs: who is a System Administrator, and the one access log.
ok('the platform services include isSystemAdmin and logAccess', /const platformServices = \{ holdersOf, contactsFor, isSystemAdmin: isPlatformAdmin, logAccess \}/.test(srv));

/* boot: local-file mode, no DATABASE_URL */
const present = fs.existsSync(path.join(ROOT, 'apps', 'c2m', 'c2m-routes.js'));
let child = null, out = '';
const stop = () => { try { child && child.kill(); } catch (e) {} };
(async () => {
  const PORT = await new Promise(res => { const t = require('net').createServer(); t.listen(0, '127.0.0.1', () => { const p = t.address().port; t.close(() => res(p)); }); });
  const env = Object.assign({}, process.env, { PORT: String(PORT), DATABASE_URL: '', SESSION_SECRET: 'c2m-mount-test' });
  child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', d => out += d); child.stderr.on('data', d => out += d);
  let up = false;
  for (let i = 0; i < 40 && !up; i++) { await new Promise(r => setTimeout(r, 250)); try { const r = await fetch('http://127.0.0.1:' + PORT + '/api/health'); up = r.ok; } catch (e) {} }
  ok('server starts and /api/health answers (C2M ' + (present ? 'installed' : 'not installed') + ')', up, out.slice(-300));
  if (up) {
    const r = await fetch('http://127.0.0.1:' + PORT + '/api/c2m/me');
    if (present) ok('installed, no database pool: C2M answers 503 with its reason, the server carries on', r.status === 503);
    else ok('not installed: /api/c2m/* is simply not there (404 JSON)', r.status === 404);
    const l = await fetch('http://127.0.0.1:' + PORT + '/'); ok('the launcher still answers', l.status === 200);
  }
  stop();
  console.log('\nPLATFORM c2m mount: ' + pass + ' passed, ' + fail + ' failed');
  fails.forEach(f => console.log('  FAIL  ' + f));
  process.exit(fail ? 1 : 0);
})().catch(e => { stop(); console.error(e); process.exit(1); });
