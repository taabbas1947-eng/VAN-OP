const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const app = express();
app.use(express.json({ limit: '15mb' }));

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET) console.log('WARNING: SESSION_SECRET not set — using a temporary one (logins reset on each restart). Set SESSION_SECRET in Render for stable sessions.');

const DEFAULT_USERS = [
  { name: 'Administrator', username: 'admin', password: 'van@2026', role: 'COO' },
  { name: 'KAM', username: 'kam', password: 'van@2026', role: 'KAM' },
  { name: 'Supply Chain', username: 'supply', password: 'van@2026', role: 'Supply Chain' },
  { name: 'Production', username: 'production', password: 'van@2026', role: 'Production' },
  { name: 'Lab Rep', username: 'lab', password: 'van@2026', role: 'Lab Rep' },
  { name: 'QA Inspector', username: 'qa', password: 'van@2026', role: 'QA Inspector' },
  { name: 'Plant Manager', username: 'plant', password: 'van@2026', role: 'Plant Manager' },
  { name: 'CFO', username: 'cfo', password: 'van@2026', role: 'CFO' }
];

/* ---------- password hashing (scrypt, built-in) ---------- */
function hashPw(pw) { const salt = crypto.randomBytes(16).toString('hex'); return salt + ':' + crypto.scryptSync(String(pw), salt, 64).toString('hex'); }
function verifyPw(pw, stored) {
  if (!stored || stored.indexOf(':') < 0) return false;
  const [salt, h] = stored.split(':');
  const hh = crypto.scryptSync(String(pw), salt, 64).toString('hex');
  try { return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(hh, 'hex')); } catch (e) { return false; }
}

/* ---------- stateless signed session token ---------- */
function makeToken(u) {
  const payload = Buffer.from(JSON.stringify({ u: u.username, r: u.role, n: u.name, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return payload + '.' + sig;
}
function readToken(tok) {
  if (!tok) return null;
  const i = tok.indexOf('.'); if (i < 0) return null;
  const payload = tok.slice(0, i), sig = tok.slice(i + 1);
  const expect = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  try { const p = JSON.parse(Buffer.from(payload, 'base64url').toString()); if (!p.exp || p.exp < Date.now()) return null; return p; } catch (e) { return null; }
}

/* ---------- parse DATABASE_URL into mysql2 config ---------- */
function parseMysqlUrl(url) {
  // Supports:  mysql://user:pass@host:port/dbname
  // Also handles blank password: mysql://user:@host:port/dbname
  const m = url.match(/^mysql:\/\/([^:]+):([^@]*)@([^:/]+)(?::(\d+))?\/(.+)$/);
  if (!m) throw new Error('DATABASE_URL must be in the form mysql://user:pass@host:port/dbname');
  return {
    host: m[3],
    port: m[4] ? parseInt(m[4]) : 3306,
    user: m[1],
    password: m[2],  // blank string is fine for XAMPP default root
    database: m[5],
    ssl: false,
    waitForConnections: true,
    connectionLimit: 5,
  };
}

/* ---------- storage (MySQL or local file) ---------- */
let store;
if (DATABASE_URL) {
  const mysql = require('mysql2/promise');
  const pool = mysql.createPool(parseMysqlUrl(DATABASE_URL));

  // Helper: run a query, return [rows, fields]. mysql2 always returns [rows, fields].
  const q = (sql, params) => pool.execute(sql, params || []);

  store = {
    async init() {
      // LONGTEXT for data — MySQL's TEXT max is 65KB, app_state JSON can be much larger.
      await q(`CREATE TABLE IF NOT EXISTS app_state (
        id INT PRIMARY KEY,
        rev INT NOT NULL DEFAULT 0,
        data LONGTEXT
      )`);
      // INSERT IGNORE = ON CONFLICT DO NOTHING in MySQL
      await q('INSERT IGNORE INTO app_state (id, rev, data) VALUES (1, 0, NULL)');
      await q(`CREATE TABLE IF NOT EXISTS auth_users (
        username VARCHAR(191) PRIMARY KEY,
        name TEXT,
        role TEXT,
        pass_hash TEXT
      )`);
    },

    async getState() {
      const [rows] = await q('SELECT rev, data FROM app_state WHERE id=1');
      const row = rows[0] || { rev: 0, data: null };
      return { rev: row.rev, data: row.data ? JSON.parse(row.data) : null };
    },

    async setState(d) {
      await q('UPDATE app_state SET rev=rev+1, data=? WHERE id=1', [JSON.stringify(d)]);
      const [rows] = await q('SELECT rev FROM app_state WHERE id=1');
      return rows[0].rev;
    },

    async setStateGuarded(baseRev, d) {
      const [result] = await q(
        'UPDATE app_state SET rev=rev+1, data=? WHERE id=1 AND rev=?',
        [JSON.stringify(d), baseRev]
      );
      // result.affectedRows === 0 means the rev didn't match — conflict
      if (result.affectedRows === 0) {
        const cur = await this.getState();
        return { conflict: true, rev: cur.rev, data: cur.data };
      }
      const [rows] = await q('SELECT rev FROM app_state WHERE id=1');
      return { conflict: false, rev: rows[0].rev };
    },

    async usersCount() {
      const [rows] = await q('SELECT count(*) AS c FROM auth_users');
      return rows[0].c;
    },

    async listUsers() {
      const [rows] = await q('SELECT username, name, role FROM auth_users ORDER BY username');
      return rows;
    },

    async getUser(u) {
      const [rows] = await q('SELECT username, name, role, pass_hash FROM auth_users WHERE username=?', [u]);
      return rows[0] || null;
    },

    async putUser(u) {
      // ON DUPLICATE KEY UPDATE = ON CONFLICT DO UPDATE in MySQL
      await q(
        'INSERT INTO auth_users(username,name,role,pass_hash) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name), role=VALUES(role), pass_hash=VALUES(pass_hash)',
        [u.username, u.name, u.role, u.pass_hash]
      );
    },

    async renameUser(oldU, u) {
      await q('DELETE FROM auth_users WHERE username=?', [oldU]);
      await this.putUser(u);
    },

    async delUser(u) {
      await q('DELETE FROM auth_users WHERE username=?', [u]);
    }
  };
  console.log('Storage: MySQL');
} else {
  const SDIR = path.join(__dirname, 'data'); fs.mkdirSync(SDIR, { recursive: true });
  const SF = path.join(SDIR, 'state.json'), AF = path.join(SDIR, 'auth.json');
  const rd = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return def; } };
  store = {
    async init() {},
    async getState() { return rd(SF, { rev: 0, data: null }); },
    async setState(d) { const c = rd(SF, { rev: 0 }); const rev = (c.rev || 0) + 1; fs.writeFileSync(SF, JSON.stringify({ rev, data: d })); return rev; },
    async setStateGuarded(baseRev, d) { const c = rd(SF, { rev: 0, data: null }); if ((c.rev || 0) !== baseRev) { return { conflict: true, rev: c.rev || 0, data: c.data }; } const rev = (c.rev || 0) + 1; fs.writeFileSync(SF, JSON.stringify({ rev, data: d })); return { conflict: false, rev }; },
    async usersCount() { return rd(AF, []).length; },
    async listUsers() { return rd(AF, []).map(u => ({ username: u.username, name: u.name, role: u.role })); },
    async getUser(u) { return rd(AF, []).find(x => x.username === u) || null; },
    async putUser(u) { const a = rd(AF, []); const i = a.findIndex(x => x.username === u.username); if (i >= 0) a[i] = u; else a.push(u); fs.writeFileSync(AF, JSON.stringify(a)); },
    async renameUser(oldU, u) { let a = rd(AF, []).filter(x => x.username !== oldU); a.push(u); fs.writeFileSync(AF, JSON.stringify(a)); },
    async delUser(u) { fs.writeFileSync(AF, JSON.stringify(rd(AF, []).filter(x => x.username !== u))); }
  };
  console.log('Storage: local file');
}

/* ---------- one-time migration: move existing users into hashed auth ---------- */
async function migrateAuth() {
  if ((await store.usersCount()) > 0) return;
  let seed = DEFAULT_USERS;
  try { const st = await store.getState(); if (st.data && Array.isArray(st.data.users) && st.data.users.length) seed = st.data.users; } catch (e) {}
  for (const u of seed) {
    if (!u.username) continue;
    await store.putUser({ username: String(u.username).toLowerCase(), name: u.name || u.username, role: u.role || 'KAM', pass_hash: hashPw(u.password || 'van@2026') });
  }
  console.log('Auth migrated: ' + seed.length + ' users (passwords hashed).');
}

/* ---------- auth middleware ---------- */
function auth(req, res, next) { const p = readToken((req.headers.authorization || '').replace(/^Bearer /, '')); if (!p) return res.status(401).json({ error: 'unauthorized' }); req.user = p; next(); }
function admin(req, res, next) { if (!req.user || req.user.r !== 'COO') return res.status(403).json({ error: 'admin only' }); next(); }
const stripUsers = (d) => { if (d && typeof d === 'object') { const o = { ...d }; delete o.users; return o; } return d; };

/* ---------- routes ---------- */
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.post('/api/login', async (req, res) => {
  try {
    const u = String((req.body && req.body.username) || '').trim().toLowerCase();
    const p = String((req.body && req.body.password) || '');
    const usr = await store.getUser(u);
    if (!usr || !verifyPw(p, usr.pass_hash)) return res.status(401).json({ error: 'Incorrect username or password' });
    res.json({ token: makeToken(usr), user: { name: usr.name, username: usr.username, role: usr.role } });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.get('/api/state', auth, async (req, res) => { try { const s = await store.getState(); res.json({ rev: s.rev, data: s.data ? stripUsers(s.data) : null }); } catch (e) { res.status(500).json({ error: String(e) }); } });
app.post('/api/state', auth, async (req, res) => {
  try {
    const h = req.headers['x-base-rev'];
    if (h !== undefined && h !== '' && !isNaN(Number(h))) {
      const out = await store.setStateGuarded(Number(h), stripUsers(req.body));
      if (out.conflict) return res.status(409).json({ conflict: true, rev: out.rev, data: out.data ? stripUsers(out.data) : null });
      return res.json({ rev: out.rev });
    }
    res.json({ rev: await store.setState(stripUsers(req.body)) });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.get('/api/users', auth, async (req, res) => { try { res.json(await store.listUsers()); } catch (e) { res.status(500).json({ error: String(e) }); } });
app.post('/api/users', auth, admin, async (req, res) => {
  try {
    const b = req.body || {}; const username = String(b.username || '').trim().toLowerCase();
    if (!b.name || !username || !b.password) return res.status(400).json({ error: 'name, username, password required' });
    if (await store.getUser(username)) return res.status(409).json({ error: 'username exists' });
    await store.putUser({ username, name: b.name, role: b.role || 'KAM', pass_hash: hashPw(b.password) });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.put('/api/users/:username', auth, admin, async (req, res) => {
  try {
    const oldU = String(req.params.username || '').toLowerCase(); const ex = await store.getUser(oldU); if (!ex) return res.status(404).json({ error: 'not found' });
    const b = req.body || {}; const newU = String(b.username || oldU).trim().toLowerCase();
    if (newU !== oldU && await store.getUser(newU)) return res.status(409).json({ error: 'username exists' });
    if (ex.role === 'COO' && (b.role && b.role !== 'COO')) { const all = await store.listUsers(); if (all.filter(x => x.role === 'COO').length <= 1) return res.status(400).json({ error: 'need at least one COO' }); }
    const rec = { username: newU, name: b.name || ex.name, role: b.role || ex.role, pass_hash: b.password ? hashPw(b.password) : ex.pass_hash };
    if (newU !== oldU) await store.renameUser(oldU, rec); else await store.putUser(rec);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.delete('/api/users/:username', auth, admin, async (req, res) => {
  try {
    const u = String(req.params.username || '').toLowerCase(); const ex = await store.getUser(u); if (!ex) return res.status(404).json({ error: 'not found' });
    if (req.user.u === u) return res.status(400).json({ error: 'cannot delete yourself' });
    if (ex.role === 'COO') { const all = await store.listUsers(); if (all.filter(x => x.role === 'COO').length <= 1) return res.status(400).json({ error: 'cannot delete last COO' }); }
    await store.delUser(u); res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.get('*', (req, res) => { res.set('Cache-Control', 'no-store, no-cache, must-revalidate'); res.sendFile(path.join(__dirname, 'index.html')); });

store.init().then(migrateAuth).then(() => app.listen(PORT, () => console.log('VAN Order Control Tower on port ' + PORT)));
