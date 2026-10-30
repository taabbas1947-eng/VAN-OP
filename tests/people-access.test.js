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
const fs = require('fs');
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
  // 21 Oct 2026 (Tahir): the System Administrator holds all access power; COO is an ordinary role.
  await test('an O2S COO who is not System Administrator has no access power', async () => {
    const before = (await q("SELECT role FROM user_module_roles WHERE username='saad' AND module='o2s'"))[0];
    try {
      assert.strictEqual((await call('POST', '/api/platform/access', T, { username: 'saad', module: 'o2s', role: 'COO' })).status, 200);
      const S = (await login('saad')).token;
      const me = await call('GET', '/api/me', S);
      assert.strictEqual(me.body.platformAdmin, false, 'O2S COO alone is not System Administrator');
      assert.strictEqual((await call('GET', '/api/platform/users', S)).status, 403, 'and cannot open People and access');
      assert.strictEqual((await call('POST', '/api/platform/users', S, { username: 'coo.test', name: 'COO Test', password: 'abcdef1' })).status, 403, 'nor create a login');
    } finally {
      if (before) await call('POST', '/api/platform/access', T, { username: 'saad', module: 'o2s', role: before.role });
      else await call('DELETE', '/api/platform/access', T, { username: 'saad', module: 'o2s' });
    }
  });
  await test('app admin is removed: the old address answers 410, and an old App admin tick gives no access power', async () => {
    // Tahir, 28 Oct 2026 (docs/ROLES-DESIGN.md): only a System Administrator manages access and designs roles.
    const keep = (await q("SELECT role, is_admin FROM user_module_roles WHERE username='saad' AND module='c2m'"))[0];
    try {
      assert.strictEqual((await call('POST', '/api/platform/admin', T, { username: 'saad', module: 'c2m', is_admin: true })).status, 410);
      await call('POST', '/api/platform/access', T, { username: 'saad', module: 'c2m', role: 'viewer' });
      await q("UPDATE user_module_roles SET is_admin=1 WHERE username='saad' AND module='c2m'");   // a tick left from before
      const S = (await login('saad')).token;
      assert.deepStrictEqual((await call('GET', '/api/me', S)).body.adminModules, [], 'the old tick administers nothing');
      assert.strictEqual((await call('GET', '/api/platform/users', S)).status, 403, 'and opens no People and access');
      assert.strictEqual((await call('POST', '/api/platform/access', S, { username: 'fahim', module: 'c2m', role: 'qc' })).status, 403, 'nor gives a role');
    } finally {
      if (keep) { await call('POST', '/api/platform/access', T, { username: 'saad', module: 'c2m', role: keep.role }); await q("UPDATE user_module_roles SET is_admin=? WHERE username='saad' AND module='c2m'", [keep.is_admin]); }
      else await call('DELETE', '/api/platform/access', T, { username: 'saad', module: 'c2m' });
    }
  });
  for (const app of ['o2s', 'c2m']) {
    await test(app + ' roles service: only a System Administrator designs; a role made there can be given, changed and archived, and is logged', async () => {
      const P = '/api/' + app + '/rolesvc', S = (await login('saad')).token;
      const cat = await call('GET', P + '/catalogue', T); assert.strictEqual(cat.status, 200, JSON.stringify(cat.body));
      assert.strictEqual((await call('GET', P + '/roles', S)).status, 403, 'not for someone who is not System Administrator');
      assert.strictEqual((await call('POST', P + '/roles', S, { label: 'Nope', rights: [] })).status, 403);
      const all = cat.body.groups.flatMap(g => g.items.map(i => i.key)), dept = (cat.body.departments || [])[0];
      const keys = cat.body.groups.flatMap(g => g.items.filter(i => i.inForce !== false).map(i => i.key));   // only rights that can be set
      assert.strictEqual(keys.length, cat.body.count, 'the count is the rights that can be set');
      const had = (await q('SELECT role FROM user_module_roles WHERE username=? AND module=?', ['abdullah', app]))[0];   // put back after
      assert.ok(!all.includes('roles.manage'), 'no right inside the app designs roles');
      const label = 'Test Role ' + app + ' ' + Date.now().toString(36);   // unique: an archived O2S role keeps its name
      const made = await call('POST', P + '/roles', T, { label, department: dept ? dept.key : null, rights: [keys[0]] });
      assert.strictEqual(made.status, 200, JSON.stringify(made.body)); const key = made.body.role.key;
      assert.strictEqual((await call('POST', '/api/platform/access', T, { username: 'abdullah', module: app, role: key })).status, 200, 'People and access can give it at once');
      assert.strictEqual((await call('POST', P + '/roles/' + encodeURIComponent(key) + '/archive', T, {})).status, 400, 'not archived while held');
      assert.strictEqual((await call('PUT', P + '/roles/' + encodeURIComponent(key), T, { label, rights: [], base: [keys[0]], baseLabel: label })).status, 200);
      assert.deepStrictEqual((await call('GET', P + '/roles', T)).body.roles.find(r => r.key === key).rights, [], 'the change reads back');
      // Review 28 Oct 2026: a screen opened earlier must not undo a change made meanwhile. Someone gives keys[0] and keys[1];
      // an admin whose screen still showed only keys[0] takes keys[0] away: keys[1] must stay.
      await call('PUT', P + '/roles/' + encodeURIComponent(key), T, { label, rights: [keys[0], keys[1]], base: [], baseLabel: label });
      await call('PUT', P + '/roles/' + encodeURIComponent(key), T, { label, rights: [], base: [keys[0]], baseLabel: label });
      assert.deepStrictEqual((await call('GET', P + '/roles', T)).body.roles.find(r => r.key === key).rights, [keys[1]], "the other person's right is kept");
      if (had) await call('POST', '/api/platform/access', T, { username: 'abdullah', module: app, role: had.role });
      else await call('DELETE', '/api/platform/access', T, { username: 'abdullah', module: app });
      assert.strictEqual((await call('POST', P + '/roles/' + encodeURIComponent(key) + '/archive', T, {})).status, 200);
      const acts = (await logRows('role:' + key)).filter(x => x.module === app).map(x => x.action);
      ['role.create', 'role.rights', 'role.archive'].forEach(a => assert.ok(acts.includes(a), a + ' is in the access log'));
    });
  }
  await test('the only O2S COO can be switched off like anyone; a second System Administrator can switch the first off and on', async () => {
    // Setup: tahir is the only System Administrator; fahim is the only O2S COO and not an admin.
    const fahimO2s = (await q("SELECT role FROM user_module_roles WHERE username='fahim' AND module='o2s'"))[0];
    const admins = (await q("SELECT username FROM user_module_roles WHERE module='platform' AND role='admin'")).map(r => r.username);
    const coos = (await q("SELECT username, role FROM user_module_roles WHERE module='o2s' AND role='COO'")).map(r => r.username);
    try {
      for (const u of admins.filter(u => u !== 'tahir')) await call('DELETE', '/api/platform/access', T, { username: u, module: 'platform' });
      for (const u of coos.filter(u => u !== 'tahir')) await call('POST', '/api/platform/access', T, { username: u, module: 'o2s', role: 'KAM' });
      assert.strictEqual((await call('POST', '/api/platform/access', T, { username: 'fahim', module: 'o2s', role: 'COO' })).status, 200);
      // Under the old rule tahir (also O2S COO) counted twice; now: fahim, an O2S COO, switches off like anyone.
      const r = await call('POST', '/api/platform/people/fahim/active', T, { active: false });
      assert.strictEqual(r.status, 200, 'an O2S COO can be switched off: ' + JSON.stringify(r.body));
      await call('POST', '/api/platform/people/fahim/active', T, { active: true });
      // The last-System-Administrator guard, reached through a second admin: saad is made admin, switches off tahir
      // (allowed: saad remains), switches tahir back on, gives up admin; then saad (no longer admin) is refused.
      assert.strictEqual((await call('POST', '/api/platform/access', T, { username: 'saad', module: 'platform', role: 'admin' })).status, 200);
      const S = (await login('saad')).token;
      assert.strictEqual((await call('POST', '/api/platform/people/tahir/active', S, { active: false })).status, 200, 'not the last admin while saad is one');
      assert.strictEqual((await call('POST', '/api/platform/people/tahir/active', S, { active: true })).status, 200);
      // Note: the "last System Administrator" refusal cannot be reached through the app: the caller is always an
      // active System Administrator and cannot switch themselves off (tested above), so 2 active admins always exist
      // when one switches the other off. The guard stays in the server as a backstop.
      assert.strictEqual((await call('POST', '/api/platform/people/saad/active', S, { active: false })).status, 400, 'own login refused');
    } finally {
      await call('POST', '/api/platform/people/tahir/active', T, { active: true }).catch(() => {});
      await call('POST', '/api/platform/people/fahim/active', T, { active: true }).catch(() => {});
      if (fahimO2s) await call('POST', '/api/platform/access', T, { username: 'fahim', module: 'o2s', role: fahimO2s.role });
      for (const u of coos) await call('POST', '/api/platform/access', T, { username: u, module: 'o2s', role: 'COO' });
      await call('DELETE', '/api/platform/access', T, { username: 'saad', module: 'platform' }).catch(() => {});
      for (const u of admins) await call('POST', '/api/platform/access', T, { username: u, module: 'platform', role: 'admin' });
    }
  });
  await test('new password: the old one stops, the new one works, the log never holds it', async () => {
    // 24 Oct 2026: the test makes its own login (live data has no 'lab' login).
    assert.strictEqual((await call('POST', '/api/platform/users', T, { username: 'pw.test', name: 'Password Test', password: PW })).status, 200);
    assert.strictEqual((await call('POST', '/api/platform/people/pw.test/password', T, { password: '123' })).status, 400);
    assert.strictEqual((await call('POST', '/api/platform/people/pw.test/password', T, { password: 'fresh-pass-1' })).status, 200);
    assert.strictEqual((await login('pw.test')).status, 401);
    assert.strictEqual((await login('pw.test', 'fresh-pass-1')).status, 200);
    const rows = await logRows('pw.test');
    assert.ok(rows.some(x => x.action === 'account.password_reset'));
    assert.ok(!JSON.stringify(rows).includes('fresh-pass-1'));
  });
  await test('role grants from the launcher are logged with before and after', async () => {
    // 17 Oct 2026: PD was removed; C2M is the second app with roles (needs apps/c2m installed).
    // 21 Oct 2026: only this test's rows; the copy may already hold earlier C2M changes for fahim.
    // 24 Oct 2026: on live data fahim already holds a C2M role, so it is cleared first and put back after.
    const [held] = await q("SELECT role, is_admin FROM user_module_roles WHERE username='fahim' AND module='c2m'");
    try {
      if (held) await call('DELETE', '/api/platform/access', T, { username: 'fahim', module: 'c2m' });
      const [mark] = await q('SELECT COALESCE(MAX(log_id), 0) AS id FROM platform_access_log');
      await call('POST', '/api/platform/access', T, { username: 'fahim', module: 'c2m', role: 'plant' });
      await call('POST', '/api/platform/access', T, { username: 'fahim', module: 'c2m', role: 'qc' });
      await call('DELETE', '/api/platform/access', T, { username: 'fahim', module: 'c2m' });
      const rows = await q('SELECT action, module, before_val, after_val FROM platform_access_log WHERE subject=? AND module=? AND log_id>? ORDER BY log_id', ['fahim', 'c2m', mark.id]);
      assert.deepStrictEqual(rows.map(x => x.action), ['role.grant', 'role.change', 'role.revoke']);
      assert.strictEqual(rows[1].before_val, 'plant'); assert.strictEqual(rows[1].after_val, 'qc');
      assert.strictEqual((await call('POST', '/api/platform/access', T, { username: 'fahim', module: 'pd', role: 'member' })).status, 400, 'PD roles can no longer be given');
    } finally {
      if (held) {
        await call('POST', '/api/platform/access', T, { username: 'fahim', module: 'c2m', role: held.role });
        if (Number(held.is_admin)) await q("UPDATE user_module_roles SET is_admin=1 WHERE username='fahim' AND module='c2m'");   // the old tick, put back as it was (the route is gone)
      }
    }
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
    const keys = r.body.modules.map(x => x.key); assert.ok(keys.includes('o2s') && keys.includes('c2m'));
    assert.ok(!keys.includes('pd'), 'PD is gone from who holds what (removed 17 Oct 2026)');
    const c2m = r.body.modules.find(x => x.key === 'c2m');
    // 24 Oct 2026: live data may have every role filled, so check the mark is right rather than that one is vacant.
    r.body.modules.forEach(m => m.roles.forEach(x => assert.strictEqual(x.vacant, !x.holders.some(h => h.active), m.key + ' ' + x.key + ': vacant means nobody active holds it')));
    assert.ok(c2m.roles.find(x => x.key === 'coo'), 'C2M lists its coo role');
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
