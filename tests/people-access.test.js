/* PLATFORM · People and access — gate 1 tests (27 Sept 2026)
 *
 * RUNS ONLY AGAINST A THROWAWAY COPY OF THE DATABASE. It resets every password
 * to a test value, switches people off and on, and creates a test login. Never
 * point it at van_platform on XAMPP or at production.
 *
 *   PLATFORM_TEST_DB=throwaway \
 *   DATABASE_URL=mysql://user:pass@127.0.0.1:3306/<copy> node tests/people-access.test.js
 *
 * The copy must have platform migration P001 applied. The test boots its own
 * server from this folder on port 3955 and stops it at the end.
 */
const { spawn } = require('child_process');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');

const URL_ = process.env.DATABASE_URL || '';
if (process.env.PLATFORM_TEST_DB !== 'throwaway') { console.error('Refusing: set PLATFORM_TEST_DB=throwaway to confirm this is a throwaway copy.'); process.exit(2); }
if (/jodilkah|vanop_db|\/van_platform$/.test(URL_)) { console.error('Refusing: DATABASE_URL looks like a real database (' + URL_.replace(/:[^:@]*@/, ':***@') + ').'); process.exit(2); }

const ROOT = path.join(__dirname, '..');
const PORT = 3955, BASE = 'http://127.0.0.1:' + PORT, PW = 'test1234';
const mysql = require(path.join(ROOT, 'node_modules', 'mysql2', 'promise'));
let db, srv, passed = 0;
const results = [];

async function call(method, p, token, body) {
  const r = await fetch(BASE + p, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}), body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, body: j };
}
async function login(u, pw) { const r = await call('POST', '/api/login', null, { username: u, password: pw || PW }); return { status: r.status, token: r.body && r.body.token, error: r.body && r.body.error }; }
async function test(name, fn) {
  try { await fn(); passed++; results.push('PASS  ' + name); }
  catch (e) { results.push('FAIL  ' + name + '\n        ' + (e && e.message)); }
}
const q = async (sql, a) => (await db.query(sql, a || []))[0];
const logRows = async (subject) => q('SELECT action, module, before_val, after_val, actor, via FROM platform_access_log WHERE subject=? ORDER BY log_id', [subject]);

(async () => {
  const m = URL_.match(/^mysql:\/\/([^:]+):([^@]*)@([^:/]+)(?::(\d+))?\/(.+)$/);
  db = await mysql.createConnection({ host: m[3], port: Number(m[4] || 3306), user: m[1], password: m[2], database: m[5] });
  const accounts = (await q('SELECT username FROM auth_users ORDER BY username')).map(r => r.username);
  for (const u of accounts) { const s = crypto.randomBytes(16).toString('hex'); await q('UPDATE auth_users SET pass_hash=?, active=1 WHERE username=?', [s + ':' + crypto.scryptSync(PW, s, 64).toString('hex'), u]); }

  srv = spawn('node', ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(PORT), SESSION_SECRET: 'gate1-test' }), stdio: ['ignore', 'pipe', 'pipe'] });
  let bootLog = ''; srv.stdout.on('data', d => bootLog += d); srv.stderr.on('data', d => bootLog += d);
  for (let i = 0; i < 80; i++) { await new Promise(r => setTimeout(r, 250)); try { if ((await fetch(BASE + '/api/health')).ok) break; } catch (e) {} }

  // Captured after boot: the server's own start-up seeds the platform-admin rows, which is not this change.
  const rolesBefore = await q('SELECT username, module, role, is_admin FROM user_module_roles ORDER BY username, module');
  const tok = {};
  await test('every existing account signs in before any change', async () => {
    for (const u of accounts) { const l = await login(u); assert.strictEqual(l.status, 200, u + ' got ' + l.status); tok[u] = l.token; }
  });
  const T = tok.tahir;
  await test('a person is filled for every login', async () => {
    const r = await q('SELECT COUNT(*) n FROM auth_users a WHERE NOT EXISTS (SELECT 1 FROM platform_people p WHERE p.account_id=a.id)');
    assert.strictEqual(Number(r[0].n), 0);
    const pu = await call('GET', '/api/platform/users', T);
    assert.strictEqual(pu.status, 200); assert.deepStrictEqual(pu.body.platform, { people: true, log: true, switchOff: true });
    assert.ok(pu.body.users.every(u => u.personId && u.active === true), 'every row has a person and is switched on');
  });
  await test('a non-administrator cannot use People and access', async () => {
    assert.strictEqual((await call('PATCH', '/api/platform/people/zain', tok.saad, { title: 'x' })).status, 403);
    assert.strictEqual((await call('POST', '/api/platform/people/zain/active', tok.saad, { active: false })).status, 403);
    assert.strictEqual((await call('POST', '/api/platform/people/zain/password', tok.saad, { password: 'abcdef' })).status, 403);
    assert.strictEqual((await call('GET', '/api/platform/users', tok.saad)).status, 403);
  });
  await test('details: title, WhatsApp and email are saved, checked and logged', async () => {
    assert.strictEqual((await call('PATCH', '/api/platform/people/zain', T, { whatsapp: '12ab' })).status, 400);
    assert.strictEqual((await call('PATCH', '/api/platform/people/zain', T, { email: 'not-an-email' })).status, 400);
    const r = await call('PATCH', '/api/platform/people/zain', T, { title: 'Supply Chain Officer', whatsapp: '0300-123 4567', email: 'zain@example.com', company: 'VAN' });
    assert.strictEqual(r.status, 200); assert.strictEqual(r.body.changed, true);
    const p = (await q('SELECT pp.* FROM platform_people pp JOIN auth_users a ON a.id=pp.account_id WHERE a.username=?', ['zain']))[0];
    assert.strictEqual(p.whatsapp, '03001234567'); assert.strictEqual(p.title, 'Supply Chain Officer'); assert.strictEqual(p.company, 'VAN');
    const again = await call('PATCH', '/api/platform/people/zain', T, { title: 'Supply Chain Officer' });
    assert.strictEqual(again.body.changed, false, 'no change, no log row');
    const rows = (await logRows('zain')).filter(x => x.action === 'person.update');
    assert.strictEqual(rows.length, 1); assert.strictEqual(rows[0].actor, 'tahir'); assert.strictEqual(rows[0].via, 'launcher');
  });
  await test('renaming a person keeps the login name O2S reads in step', async () => {
    await call('PATCH', '/api/platform/people/zain', T, { name: 'Zain Ghaffar Test' });
    assert.strictEqual((await q('SELECT name FROM auth_users WHERE username=?', ['zain']))[0].name, 'Zain Ghaffar Test');
    await call('PATCH', '/api/platform/people/zain', T, { name: 'Zain Ghaffar' });
  });
  await test('/api/me carries the title', async () => {
    const me = await call('GET', '/api/me', tok.zain);
    assert.strictEqual(me.body.title, 'Supply Chain Officer');
  });
  await test('switch off: the login is refused, an open session stops, roles are kept', async () => {
    const r = await call('POST', '/api/platform/people/zain/active', T, { active: false });
    assert.strictEqual(r.status, 200);
    assert.strictEqual((await login('zain')).status, 403);
    assert.strictEqual((await call('GET', '/api/state', tok.zain)).status, 401, 'old token stops');
    const roles = await q("SELECT module, role FROM user_module_roles WHERE username='zain'");
    assert.ok(roles.length > 0, 'roles kept');
    assert.strictEqual((await q("SELECT active FROM auth_users WHERE username='zain'"))[0].active, 0);
  });
  await test('switching 1 person off leaves every other account working', async () => {
    for (const u of accounts.filter(x => x !== 'zain')) {
      const l = await login(u); assert.strictEqual(l.status, 200, u + ' login ' + l.status);
      assert.strictEqual((await call('GET', '/api/state', tok[u])).status, 200, u + ' state');
    }
  });
  await test('the switch-off survives a server restart', async () => {
    srv.kill(); await new Promise(r => setTimeout(r, 600));
    srv = spawn('node', ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(PORT), SESSION_SECRET: 'gate1-test' }), stdio: ['ignore', 'pipe', 'pipe'] });
    srv.stdout.on('data', d => bootLog += d);
    for (let i = 0; i < 80; i++) { await new Promise(r => setTimeout(r, 250)); try { if ((await fetch(BASE + '/api/health')).ok) break; } catch (e) {} }
    assert.strictEqual((await login('zain')).status, 403);
    assert.strictEqual((await call('GET', '/api/state', tok.zain)).status, 401);
    assert.strictEqual((await login('saad')).status, 200);
  });
  await test('switch back on: signs in again with the same roles', async () => {
    assert.strictEqual((await call('POST', '/api/platform/people/zain/active', T, { active: true })).status, 200);
    const l = await login('zain'); assert.strictEqual(l.status, 200);
    const me = await call('GET', '/api/me', l.token);
    assert.ok(me.body.modules.some(x => x.module === 'o2s' && x.role === 'Supply Chain Officer'));
    const acts = (await logRows('zain')).map(x => x.action);
    assert.ok(acts.includes('account.switch_off') && acts.includes('account.switch_on'));
  });
  await test('you cannot switch off your own login', async () => {
    assert.strictEqual((await call('POST', '/api/platform/people/tahir/active', T, { active: false })).status, 400);
  });
  await test('the last O2S COO cannot be switched off', async () => {
    assert.strictEqual((await call('POST', '/api/platform/access', T, { username: 'saad', module: 'platform', role: 'admin' })).status, 200);
    const S = (await login('saad')).token;
    assert.strictEqual((await call('POST', '/api/platform/people/ahmer/active', S, { active: false })).status, 200);
    const r = await call('POST', '/api/platform/people/tahir/active', S, { active: false });
    assert.strictEqual(r.status, 400); assert.ok(/last O2S COO/.test(r.body.error), r.body.error);
    await call('POST', '/api/platform/people/ahmer/active', T, { active: true });
    await call('DELETE', '/api/platform/access', T, { username: 'saad', module: 'platform' });
  });
  await test('new password: the old one stops, the new one works, the log never holds it', async () => {
    assert.strictEqual((await call('POST', '/api/platform/people/lab/password', T, { password: '123' })).status, 400);
    assert.strictEqual((await call('POST', '/api/platform/people/lab/password', T, { password: 'fresh-pass-1' })).status, 200);
    assert.strictEqual((await login('lab')).status, 401);
    assert.strictEqual((await login('lab', 'fresh-pass-1')).status, 200);
    const rows = await logRows('lab');
    assert.ok(rows.some(x => x.action === 'account.password_reset'));
    assert.ok(!JSON.stringify(rows).includes('fresh-pass-1'));
  });
  await test('role grants from the launcher are logged with before and after', async () => {
    await call('POST', '/api/platform/access', T, { username: 'fahim', module: 'pd', role: 'production' });
    await call('POST', '/api/platform/access', T, { username: 'fahim', module: 'pd', role: 'member' });
    await call('DELETE', '/api/platform/access', T, { username: 'fahim', module: 'pd' });
    const rows = (await logRows('fahim')).filter(x => x.module === 'pd');
    assert.deepStrictEqual(rows.map(x => x.action), ['role.grant', 'role.change', 'role.revoke']);
    assert.strictEqual(rows[1].before_val, 'production'); assert.strictEqual(rows[1].after_val, 'member');
  });
  await test("O2S's own Users & Access still works, gets a person, and is logged as O2S", async () => {
    const r = await call('POST', '/api/users', T, { name: 'Gate Test', username: 'gate.test', password: 'abcdef1', role: 'KAM' });
    assert.strictEqual(r.status, 200);
    assert.strictEqual((await login('gate.test', 'abcdef1')).status, 200);
    await call('GET', '/api/platform/users', T);
    assert.strictEqual(Number((await q("SELECT COUNT(*) n FROM platform_people pp JOIN auth_users a ON a.id=pp.account_id WHERE a.username='gate.test'"))[0].n), 1);
    const rows = await logRows('gate.test');
    assert.ok(rows.some(x => x.action === 'role.grant' && x.via === 'o2s-users'), JSON.stringify(rows));
    assert.strictEqual((await call('DELETE', '/api/users/gate.test', T)).status, 200, 'O2S delete still works (person kept, login gone)');
    assert.strictEqual(Number((await q("SELECT COUNT(*) n FROM platform_people WHERE full_name='Gate Test' AND account_id IS NULL"))[0].n), 1);
  });
  await test('who holds what: every live system, vacant roles marked', async () => {
    const r = await call('GET', '/api/platform/holders', T);
    assert.strictEqual(r.status, 200);
    const keys = r.body.modules.map(x => x.key); assert.ok(keys.includes('o2s') && keys.includes('pd'));
    const pdm = r.body.modules.find(x => x.key === 'pd');
    assert.ok(pdm.roles.some(x => x.vacant), 'PD has vacant roles');
    assert.ok(pdm.roles.find(x => x.key === 'coo').holders.some(h => h.username === 'tahir'));
  });
  await test('the access log refuses edits and deletes', async () => {
    await assert.rejects(q("UPDATE platform_access_log SET actor='x'"));
    await assert.rejects(q('DELETE FROM platform_access_log'));
  });
  await test('every grant that existed before is still there, unchanged', async () => {
    const after = await q('SELECT username, module, role, is_admin FROM user_module_roles ORDER BY username, module');
    const key = r => r.username + '|' + r.module + '|' + r.role + '|' + r.is_admin;
    const b = new Set(rolesBefore.map(key));
    const missing = after.length ? rolesBefore.filter(r => !after.some(a => key(a) === key(r))) : rolesBefore;
    assert.deepStrictEqual(missing.map(key), []);
    assert.strictEqual(after.filter(a => !b.has(key(a))).length, 0, 'no grant added or changed');
  });
  await test('every account signs in at the end (lab with its new password)', async () => {
    for (const u of accounts) { const l = await login(u, u === 'lab' ? 'fresh-pass-1' : PW); assert.strictEqual(l.status, 200, u + ' got ' + l.status); }
  });

  srv.kill(); await db.end();
  console.log(results.join('\n'));
  console.log('\n' + passed + ' of ' + results.length + ' passed');
  process.exit(passed === results.length ? 0 : 1);
})().catch(e => { console.error(e); try { srv && srv.kill(); } catch (x) {} process.exit(1); });
