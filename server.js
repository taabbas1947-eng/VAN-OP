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

/* ---------- storage (Postgres or local file) ---------- */
let store;
if (DATABASE_URL) {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  store = {
    async init() {
      await pool.query('CREATE TABLE IF NOT EXISTS app_state (id int PRIMARY KEY, rev int NOT NULL DEFAULT 0, data text)');
      await pool.query('INSERT INTO app_state (id, rev, data) VALUES (1, 0, NULL) ON CONFLICT (id) DO NOTHING');
      await pool.query('CREATE TABLE IF NOT EXISTS auth_users (username text PRIMARY KEY, name text, role text, pass_hash text)');
    },
    async getState() { const r = await pool.query('SELECT rev, data FROM app_state WHERE id=1'); const row = r.rows[0] || { rev: 0, data: null }; return { rev: row.rev, data: row.data ? JSON.parse(row.data) : null }; },
    async setState(d) { const r = await pool.query('UPDATE app_state SET rev=rev+1, data=$1 WHERE id=1 RETURNING rev', [JSON.stringify(d)]); return r.rows[0].rev; },
    async setStateGuarded(baseRev, d) { const r = await pool.query('UPDATE app_state SET rev=rev+1, data=$1 WHERE id=1 AND rev=$2 RETURNING rev', [JSON.stringify(d), baseRev]); if (r.rows.length === 0) { const cur = await this.getState(); return { conflict: true, rev: cur.rev, data: cur.data }; } return { conflict: false, rev: r.rows[0].rev }; },
    async usersCount() { const r = await pool.query('SELECT count(*)::int c FROM auth_users'); return r.rows[0].c; },
    async listUsers() { const r = await pool.query('SELECT username, name, role FROM auth_users ORDER BY username'); return r.rows; },
    async getUser(u) { const r = await pool.query('SELECT username, name, role, pass_hash FROM auth_users WHERE username=$1', [u]); return r.rows[0] || null; },
    async putUser(u) { await pool.query('INSERT INTO auth_users(username,name,role,pass_hash) VALUES($1,$2,$3,$4) ON CONFLICT(username) DO UPDATE SET name=$2, role=$3, pass_hash=$4', [u.username, u.name, u.role, u.pass_hash]); },
    async renameUser(oldU, u) { await pool.query('DELETE FROM auth_users WHERE username=$1', [oldU]); await this.putUser(u); },
    async delUser(u) { await pool.query('DELETE FROM auth_users WHERE username=$1', [u]); }
  };
  console.log('Storage: PostgreSQL');
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
app.post('/api/state', auth, async (req, res) => { try {
  const h = req.headers['x-base-rev'];
  if (h !== undefined && h !== '' && !isNaN(Number(h))) {
    const out = await store.setStateGuarded(Number(h), stripUsers(req.body));
    if (out.conflict) return res.status(409).json({ conflict: true, rev: out.rev, data: out.data ? stripUsers(out.data) : null });
    return res.json({ rev: out.rev });
  }
  res.json({ rev: await store.setState(stripUsers(req.body)) });
} catch (e) { res.status(500).json({ error: String(e) }); } });

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
