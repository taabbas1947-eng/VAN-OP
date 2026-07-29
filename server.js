const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const pd = require('./pd/pd-lib'); // everything Product Development lives under ./pd — kept apart from the O2S files in this root on purpose
const app = express();
app.use(require('compression')());
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
let pdq = null; // set below when DATABASE_URL is present — PD (Product Development) needs real relational SQL, not the local-file fallback.
if (DATABASE_URL) {
  const mysql = require('mysql2/promise');
  const pool = mysql.createPool(parseMysqlUrl(DATABASE_URL));

  // Helper: run a query, return [rows, fields]. mysql2 always returns [rows, fields].
  const q = (sql, params) => pool.execute(sql, params || []);
  pdq = q;

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

    async getRev() { const [rows] = await q('SELECT rev FROM app_state WHERE id=1'); return rows[0] ? rows[0].rev : 0; },

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
    async getRev() { return (rd(SF, { rev: 0 }).rev) || 0; },
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

/* ---------- PD (Product Development) foundation migration ---------- */
// Additive, idempotent: safe to run on every boot. Statements that have
// already been applied (duplicate column, table already exists) are skipped
// individually rather than aborting the whole file, since MySQL 5.7 (some
// cPanel/HostGator hosts) doesn't support "ADD COLUMN IF NOT EXISTS".
async function runPdMigration() {
  if (!pdq) { console.log('PD migration skipped — no DATABASE_URL (local-file mode has no relational SQL to migrate).'); return; }
  const sqlPath = path.join(__dirname, 'pd', 'migrations', '001_pd_foundation.sql');
  let sql;
  try { sql = fs.readFileSync(sqlPath, 'utf8'); } catch (e) { console.log('PD migration file not found, skipping: ' + sqlPath); return; }
  const sqlNoComments = sql.split('\n').filter(line => !line.trim().startsWith('--')).join('\n');
  const statements = sqlNoComments
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(Boolean);
  let applied = 0, skipped = 0;
  for (const stmt of statements) {
    try { await pdq(stmt); applied++; }
    catch (e) {
      // 1060 duplicate column, 1061 duplicate key name, 1050 table exists (CREATE TABLE already has IF NOT EXISTS so this is belt-and-braces)
      if ([1060, 1061, 1050].includes(e.errno)) { skipped++; continue; }
      console.error('PD migration statement failed:\n' + stmt.slice(0, 120) + '...\n', e.message);
      throw e;
    }
  }
  console.log(`PD migration: ${applied} statements applied, ${skipped} already in place.`);
  // Bootstrap: give the seeded 'admin' account (already the hardcoded O2S COO —
  // see DEFAULT_USERS above) the matching PD role too, but only if NOBODY has a
  // PD role yet. This makes a fresh install/local dev DB immediately usable
  // (sign in as admin, everything's unlocked) without a manual API call, while
  // never overwriting a real deployment's own role assignments.
  try {
    const [countRows] = await pdq("SELECT COUNT(*) AS n FROM auth_users WHERE pd_role IS NOT NULL");
    if (Number(countRows[0].n) === 0) {
      await pdq("UPDATE auth_users SET pd_role='coo' WHERE username='admin'");
      console.log("PD bootstrap: no PD roles existed yet — granted 'admin' the coo PD role so a fresh install/local DB is immediately usable.");
    }
  } catch (e) { console.error('PD role bootstrap check failed (non-fatal):', e.message); }
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

/* ---------- PD auth: same token as O2S (auth() above), plus the PD role loaded fresh from
   the DB on every request rather than baked into the 30-day token, so a role change takes
   effect immediately instead of waiting for re-login. */
async function pdAuth(req, res, next) {
  if (!pdq) return res.status(503).json({ error: 'PD is not available — this server has no DATABASE_URL (local-file mode).' });
  try {
    const [rows] = await pdq('SELECT id, username, name, pd_role, active FROM auth_users WHERE username=?', [req.user.u]);
    const u = rows[0];
    if (!u || !u.active) return res.status(403).json({ error: 'No PD account for this login.' });
    req.pdUser = u;
    next();
  } catch (e) { res.status(500).json({ error: String(e) }); }
}
function pdSurface(surface) {
  return (req, res, next) => {
    if (!pd.can_pd(req.pdUser.pd_role, surface)) {
      return res.status(403).json({ error: `Not permitted: ${surface}. Your PD role: ${req.pdUser.pd_role || '(none)'}. Ask the COO or Data Custodian for access.` });
    }
    next();
  };
}

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
// Lightweight change-check: returns ONLY the rev (no data blob). The client polls this and pulls full /api/state only when rev changed.
app.get('/api/rev', auth, async (req, res) => { try { res.json({ rev: await store.getRev() }); } catch (e) { res.status(500).json({ error: String(e) }); } });
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

/* ---------- PD (Product Development) API ----------
   MVP slice ported from the standalone van-rd-app: idea intake, the two-lane
   G1 screen, and the gate log. Everything else the PHP app has (records/G2,
   samples, tests, trials, gates G3-G6, candidates/materials, library,
   projects, users admin, audit, regulatory, learnings, formulations,
   dropbox) is not yet ported — see PORTING_STATUS.md. */

app.get('/api/pd/me', auth, pdAuth, (req, res) => {
  res.json({
    id: req.pdUser.id, username: req.pdUser.username, name: req.pdUser.name,
    pd_role: req.pdUser.pd_role, label: pd.PD_ROLES[req.pdUser.pd_role] || null,
    landing: pd.landing_for_pd(req.pdUser.pd_role),
    surfaces: pd.allowed_surfaces(req.pdUser.pd_role),
  });
});

// Ideas: submit (BASE_SURFACES — anyone with a PD role) and list (own vs all per role).
app.post('/api/pd/ideas', auth, pdAuth, pdSurface('ideas.new'), async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.title || !b.idea_text || !b.change_type) return res.status(400).json({ error: 'title, idea_text and change_type are required' });
    if (!pd.CHANGE_TYPES[b.change_type]) return res.status(400).json({ error: 'invalid change_type' });
    const lane = pd.lane_for(b.change_type); // the submitter never picks or sees a lane — set from the kind of idea, same rule as the PHP app
    const h = await pd.insert_numbered(pdq, 'pd_hypotheses', 'h_number', async (n) => {
      await pdq(
        `INSERT INTO pd_hypotheses (h_number, title, change_type, lane, idea_text, problem_text, reasoning_text, materials_text, success_text, crop_area, support_text, risk_text, submitted_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [n, b.title, b.change_type, lane, b.idea_text, b.problem_text || null, b.reasoning_text || null,
         b.materials_text || null, b.success_text || null, b.crop_area || null, b.support_text || null,
         b.risk_text || null, req.pdUser.id]
      );
    });
    res.json({ ok: true, h_number: h, h_label: pd.fmt_h(h), lane });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.get('/api/pd/ideas', auth, pdAuth, pdSurface('ideas.own'), async (req, res) => {
  try {
    const seeAll = pd.may_see_all_ideas(req.pdUser.pd_role) && pd.can_pd(req.pdUser.pd_role, 'ideas.all');
    const [rows] = seeAll
      ? await pdq(`SELECT h.*, u.name AS submitted_by_name FROM pd_hypotheses h JOIN auth_users u ON u.id=h.submitted_by ORDER BY h.h_number DESC`)
      : await pdq(`SELECT h.*, u.name AS submitted_by_name FROM pd_hypotheses h JOIN auth_users u ON u.id=h.submitted_by WHERE h.submitted_by=? ORDER BY h.h_number DESC`, [req.pdUser.id]);
    res.json(rows.map(r => ({ ...r, h_label: pd.fmt_h(r.h_number), stage_label: pd.STAGES[r.stage] })));
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.get('/api/pd/ideas/:id', auth, pdAuth, pdSurface('ideas.own'), async (req, res) => {
  try {
    const [[idea]] = [( await pdq(`SELECT h.*, u.name AS submitted_by_name FROM pd_hypotheses h JOIN auth_users u ON u.id=h.submitted_by WHERE h.id=?`, [req.params.id]))[0]];
    if (!idea) return res.status(404).json({ error: 'not found' });
    if (idea.submitted_by !== req.pdUser.id && !(pd.may_see_all_ideas(req.pdUser.pd_role) && pd.can_pd(req.pdUser.pd_role, 'ideas.all'))) {
      return res.status(403).json({ error: 'Not your idea to view.' });
    }
    const [gates] = await pdq(`SELECT g.*, u.name AS decided_by_name FROM pd_gate_decisions g JOIN auth_users u ON u.id=g.decided_by WHERE g.hypothesis_id=? ORDER BY g.decided_at ASC`, [req.params.id]);
    res.json({ ...idea, h_label: pd.fmt_h(idea.h_number), stage_label: pd.STAGES[idea.stage], gates });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// G1 screen: the two-lane decision. Deputy screens (Plant Manager on either lane) land as PROVISIONAL.
app.post('/api/pd/ideas/:id/screen', auth, pdAuth, pdSurface('screen'), async (req, res) => {
  try {
    const b = req.body || {};
    // The G1 form's real vocabulary (log/park/kill/merge — see the note in pd-lib.js),
    // not the GATE_OUTCOMES label set, which the PHP app itself doesn't use here.
    if (!pd.PD_SCREEN_DECISIONS[b.decision]) return res.status(400).json({ error: 'decision must be one of: ' + Object.keys(pd.PD_SCREEN_DECISIONS).join(', ') });
    if (!b.reason || !b.reason.trim()) return res.status(400).json({ error: 'A written reason is required for every gate decision.' });
    const [[idea]] = [(await pdq('SELECT * FROM pd_hypotheses WHERE id=?', [req.params.id]))[0]];
    if (!idea) return res.status(404).json({ error: 'not found' });
    if (idea.screen_decision) return res.status(409).json({ error: 'This idea has already been screened.' });
    if (!pd.may_screen(req.pdUser.pd_role, idea.lane)) return res.status(403).json({ error: `Your PD role (${req.pdUser.pd_role}) does not screen the ${idea.lane} lane.` });
    const provisional = pd.screens_as_deputy(req.pdUser.pd_role, idea.lane);
    await pdq('UPDATE pd_hypotheses SET screen_decision=?, screen_reason=?, screened_by=?, screened_at=NOW(), stage=? WHERE id=?',
      [b.decision, b.reason, req.pdUser.id, pd.SCREEN_TO_STAGE[b.decision], req.params.id]);
    await pdq('INSERT INTO pd_gate_decisions (hypothesis_id, gate, decision, reason, decided_by, provisional) VALUES (?,?,?,?,?,?)',
      [req.params.id, 'G1', pd.SCREEN_TO_GATE_DECISION[b.decision], b.reason, req.pdUser.id, provisional ? 1 : 0]);
    res.json({ ok: true, provisional });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.get('/api/pd/gatelog', auth, pdAuth, pdSurface('gatelog'), async (req, res) => {
  try {
    const [rows] = await pdq(`SELECT g.*, h.h_number, h.title, u.name AS decided_by_name
       FROM pd_gate_decisions g JOIN pd_hypotheses h ON h.id=g.hypothesis_id JOIN auth_users u ON u.id=g.decided_by
       ORDER BY g.decided_at DESC LIMIT 200`);
    res.json(rows.map(r => ({ ...r, h_label: pd.fmt_h(r.h_number) })));
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// My Work: ideas in this lane/role's screening queue (mirrors mywork.php's "the button that does the thing").
app.get('/api/pd/mywork', auth, pdAuth, pdSurface('mywork'), async (req, res) => {
  try {
    const [rows] = await pdq(`SELECT h.* FROM pd_hypotheses h WHERE h.screen_decision='' ORDER BY h.submitted_at ASC`);
    const mine = rows.filter(r => pd.may_screen(req.pdUser.pd_role, r.lane));
    res.json(mine.map(r => ({ ...r, h_label: pd.fmt_h(r.h_number), lane_label: pd.LANES[r.lane] })));
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

/* ---------- PD/O2S admin: assign a PD role to an existing O2S account (COO only, mirrors O2S's own admin gate) ---------- */
app.put('/api/pd/users/:username/role', auth, admin, pdAuth, async (req, res) => {
  try {
    const role = req.body && req.body.pd_role;
    if (role !== null && !pd.PD_ROLES[role]) return res.status(400).json({ error: 'invalid pd_role' });
    const [result] = await pdq('UPDATE auth_users SET pd_role=? WHERE username=?', [role, String(req.params.username).toLowerCase()]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

const _NOCACHE = 'no-store, no-cache, must-revalidate';
// Front door: the platform launcher.
app.get(['/', '/launcher', '/launcher.html'], (req, res) => { res.set('Cache-Control', _NOCACHE); res.sendFile(path.join(__dirname, 'launcher.html')); });
// PD app: /pd (must come before the O2S catch-all below, or it silently serves O2S instead — this bit us once already).
app.get(['/pd', '/pd/*'], (req, res) => { res.set('Cache-Control', _NOCACHE); res.sendFile(path.join(__dirname, 'pd', 'pd.html')); });
// O2S app: any other non-API path falls through to it.
app.get('*', (req, res) => { res.set('Cache-Control', _NOCACHE); res.sendFile(path.join(__dirname, 'index.html')); });

// migrateAuth runs BEFORE runPdMigration: the PD bootstrap step (inside runPdMigration)
// grants the seeded 'admin' row a PD role, which only works if that row already exists.
store.init().then(migrateAuth).then(runPdMigration).then(() => app.listen(PORT, () => console.log('VAN Order Control Tower on port ' + PORT)));
