/* PLATFORM · O2S alerts (Web Push) mount — 16 Oct 2026, Tahir.
 * The platform part of O2S alerts: the web-push package, the 3 key settings named in
 * render.yaml, and the line in server.js that mounts apps/o2s/notify-routes.js only when
 * that file exists. No database needed: it reads the files and boots the server in
 * local-file mode on a free port to prove it starts with or without the O2S file.
 *   node tests/notify-mount.test.js
 */
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0; const fails = [];
const ok = (n, c, x) => c ? pass++ : (fail++, fails.push(n + (x ? '  [' + x + ']' : '')));
const srv = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
const ry = fs.readFileSync(path.join(ROOT, 'render.yaml'), 'utf8');

ok('package.json: web-push 3.6.x', /^\^?3\.6\.\d+$/.test(pkg.dependencies['web-push'] || ''));
ok('package-lock.json carries web-push', !!(lock.packages && lock.packages['node_modules/web-push']));
['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'].forEach(k =>
  ok('render.yaml names ' + k + ', set by hand (sync: false)', new RegExp('- key: ' + k + '\\n\\s+sync: false').test(ry)));
ok('render.yaml holds no key values', !/VAPID_[A-Z_]+\n\s+value:/.test(ry));

const iMount = srv.indexOf("apps', 'o2s', 'notify-routes.js'");
const iPublic = srv.indexOf("require('./apps/o2s/public-routes')");
const i404 = srv.indexOf("app.use('/api', (req, res) => res.status(404)");
const iCatch = srv.indexOf("app.get('*'");
ok('mount line present', iMount > 0);
ok('mounted after the public routes', iMount > iPublic);
ok('mounted before the /api 404', iMount < i404);
ok('mounted before the O2S catch-all (else /o2s/sw.js would be the app page)', iMount < iCatch);
ok('mounted only when the file exists', /if \(fs\.existsSync\(o2sNotify\)\) \{ try \{ require\(o2sNotify\)/.test(srv));
ok('a broken alerts file is logged and skipped, never stops the server', /catch \(e\) \{ console\.error\('O2S alerts not mounted:'/.test(srv));
ok('hands sign-in, admin, database and platform services to the routes', /require\(o2sNotify\)\(app, \{ store, pdq, auth, admin, services: platformServices, express, path, fs \}\)/.test(srv));
ok('no key value written in server.js', !/VAPID_PRIVATE_KEY\s*=\s*['"]/.test(srv));

/* boot: local-file mode, no DATABASE_URL; health answers whether or not the O2S file is there */
const present = fs.existsSync(path.join(ROOT, 'apps', 'o2s', 'notify-routes.js'));
let child = null, out = '';
const stop = () => { try { child && child.kill(); } catch (e) {} };
(async () => {
  /* a free port, so a server already running elsewhere can never answer for this one */
  const PORT = await new Promise(res => { const t = require('net').createServer(); t.listen(0, '127.0.0.1', () => { const p = t.address().port; t.close(() => res(p)); }); });
  const env = Object.assign({}, process.env, { PORT: String(PORT), DATABASE_URL: '', SESSION_SECRET: 'notify-mount-test' });
  child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', d => out += d); child.stderr.on('data', d => out += d);
  let up = false;
  for (let i = 0; i < 40 && !up; i++) { await new Promise(r => setTimeout(r, 250)); try { const r = await fetch('http://127.0.0.1:' + PORT + '/api/health'); up = r.ok; } catch (e) {} }
  ok('server starts and /api/health answers (notify-routes.js ' + (present ? 'present' : 'absent') + ')', up, out.slice(-300));
  if (up && !present) {
    const r = await fetch('http://127.0.0.1:' + PORT + '/api/o2s/push/key'); ok('without the O2S file, its routes are simply not there (404 JSON)', r.status === 404);
  }
  stop();
  console.log('\nPLATFORM notify mount: ' + pass + ' passed, ' + fail + ' failed');
  fails.forEach(f => console.log('  FAIL  ' + f));
  process.exit(fail ? 1 : 0);
})().catch(e => { stop(); console.error(e); process.exit(1); });
