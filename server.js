const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const pd = require('./pd/pd-lib'); // everything Product Development lives under ./pd — kept apart from the O2S files in this root on purpose

// Local-dev convenience: load a gitignored .env if present, WITHOUT overriding real env vars.
// This keeps `npm start` working locally (DATABASE_URL / SESSION_SECRET) without exporting them by
// hand each time. On the hosted deploy there is no .env, and any platform env var always wins.
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      if (!line.trim() || line.trim().startsWith('#')) continue;
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    }
    console.log('Loaded local .env (values not already set in the environment).');
  }
} catch (e) { /* .env is optional */ }

const app = express();
app.use(require('compression')());
app.use(express.json({ limit: '25mb' })); // 25mb so a 15MB Library upload (base64 ~+37%) fits in the JSON body

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
  // dateStrings: return DATE/DATETIME/TIMESTAMP as strings, not JS Date objects — avoids the
  // UTC toISOString() shift that would move a DATE back a day in +05:00 (PKT) when JSON-serialised.
  const pool = mysql.createPool({ ...parseMysqlUrl(DATABASE_URL), dateStrings: true });

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
  // Seed the materials register (the candidate screen's arithmetic inputs) if it is empty — the
  // faithful equivalent of the PHP setup.php reading inc/seed_materials.php. All prices are placeholders.
  try {
    const [[mc]] = [(await pdq('SELECT COUNT(*) AS n FROM pd_materials'))[0]];
    if (Number(mc.n) === 0 && pd.MATERIALS_SEED && pd.MATERIALS_SEED.length) {
      for (const m of pd.MATERIALS_SEED) {
        await pdq('INSERT IGNORE INTO pd_materials (code, name, n_pct, p2o5_pct, s_pct, zn_pct, cost_per_tonne, assay_basis, cost_basis, spec_note, cost_updated) VALUES (?,?,?,?,?,?,?,?,?,?,CURRENT_DATE)',
          [m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8], m[9]]);
      }
      console.log(`PD materials seeded: ${pd.MATERIALS_SEED.length} rows (all placeholder-priced).`);
    }
  } catch (e) { console.error('PD materials seed check failed (non-fatal):', e.message); }
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

/* Auto-audit: log every successful PD mutation (POST/PUT) to pd_audit_log. The PHP app called audit() by
   hand in each handler; here one middleware captures the same who/what/when, with a path-derived action. */
function pdAuditLogger(req, res, next) {
  if (!pdq || (req.method !== 'POST' && req.method !== 'PUT')) return next();
  res.on('finish', () => {
    try {
      if (res.statusCode >= 400) return;
      const uid = req.pdUser && req.pdUser.id;
      if (!uid) return;
      const full = String(req.originalUrl || '').split('?')[0];
      const action = (full.replace(/^\/api\/pd\/?/, '').replace(/\/\d+(?=\/|$)/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'root').slice(0, 80);
      pdq('INSERT INTO pd_audit_log (user_id, action, detail) VALUES (?,?,?)', [uid, action, (req.method + ' ' + full).slice(0, 500)]).catch(() => {});
    } catch (e) {}
  });
  next();
}
app.use('/api/pd', pdAuditLogger);

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

// Platform identity: who you are + which modules you may enter. Drives the launcher's tiles and each module's access.
// Reads the authoritative user_module_roles table (seeded from today's role/pd_role by runPlatformMigration).
app.get('/api/me', auth, async (req, res) => {
  try {
    let modules = [];
    if (pdq) {
      // user_module_roles is the single source of truth for ACCESS (which modules you may enter).
      const [rows] = await pdq('SELECT module, role, is_admin FROM user_module_roles WHERE username=?', [req.user.u]);
      modules = rows.map(r => ({ module: r.module, role: r.role, admin: !!r.is_admin }));
    } else if (req.user.r) {
      modules = [{ module: 'o2s', role: req.user.r, admin: req.user.r === 'COO' }]; // file-store fallback (no relational table)
    }
    const o2s = modules.find(m => m.module === 'o2s');
    const isCOO = !!(o2s && o2s.role === 'COO');
    // Which modules this person may ADMINISTER: the COO administers all; others only their is_admin grants.
    const adminModules = isCOO ? REAL_MODULES.slice() : modules.filter(m => m.admin).map(m => m.module);
    res.json({ username: req.user.u, name: req.user.n, o2sRole: o2s ? o2s.role : null, modules, adminModules });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

/* ---------- Platform access admin (COO): assign / revoke module roles. Dual-write: user_module_roles + the legacy column,
   so O2S (auth_users.role) and PD (auth_users.pd_role) keep reading their columns unchanged. ---------- */
const PD_ROLE_KEYS = Object.keys((pd && pd.PD_ROLES) || {});
function validModuleRole(module, role) {
  if (!role) return false;
  if (module === 'pd') return PD_ROLE_KEYS.indexOf(role) >= 0;
  if (module === 'o2s') return true; // O2S roles are free-form (managed in O2S master data)
  return false; // qms/compha not built yet
}
const REAL_MODULES = ['o2s', 'pd'];
// Load a caller's platform-admin capabilities fresh from the DB (roles/admin can change between logins).
async function loadAdminCaps(username) {
  const [rows] = await pdq('SELECT module, role, is_admin FROM user_module_roles WHERE username=?', [username]);
  const o2s = rows.find(r => r.module === 'o2s');
  const isCOO = !!(o2s && o2s.role === 'COO');                          // COO = platform admin
  const adminModules = isCOO ? REAL_MODULES.slice() : rows.filter(r => r.is_admin).map(r => r.module);
  return { isCOO, adminModules };
}
async function isUserCOO(username) {
  const [rows] = await pdq("SELECT role FROM user_module_roles WHERE username=? AND module='o2s'", [username]);
  return !!(rows[0] && rows[0].role === 'COO');
}
// Gate for access administration: the COO (platform admin) OR any subsystem admin. Caps land on req.adminCaps.
async function accessAdmin(req, res, next) {
  if (!pdq) return res.status(503).json({ error: 'Platform access admin needs DATABASE_URL (relational store).' });
  try {
    const caps = await loadAdminCaps(req.user.u);
    if (!caps.isCOO && caps.adminModules.length === 0) return res.status(403).json({ error: 'You are not an access administrator.' });
    req.adminCaps = caps;
    next();
  } catch (e) { res.status(500).json({ error: String(e) }); }
}
// The admin grid: every user + their module roles (+ which modules each person administers).
app.get('/api/platform/users', auth, accessAdmin, async (req, res) => {
  try {
    const [users] = await pdq('SELECT username, name FROM auth_users ORDER BY username');
    const [roles] = await pdq('SELECT username, module, role, is_admin FROM user_module_roles');
    const byUser = {}, adminBy = {};
    roles.forEach(r => {
      (byUser[r.username] = byUser[r.username] || {})[r.module] = r.role;
      if (r.is_admin) (adminBy[r.username] = adminBy[r.username] || []).push(r.module);
    });
    // O2S role options = O2S's master roles list (from app_state) UNION roles already assigned,
    // so a newly-created O2S role shows up in the grid even before anyone holds it.
    let masterRoles = [];
    try { const st = await store.getState(); const rs = st && st.data && st.data.masters && st.data.masters.roles; if (Array.isArray(rs)) masterRoles = rs.filter(r => r && !r.archived).map(r => r.name); } catch (e) {}
    const [o2sRoleRows] = await pdq("SELECT DISTINCT role FROM auth_users WHERE role IS NOT NULL AND role <> ''");
    const o2sRoles = Array.from(new Set(masterRoles.concat(o2sRoleRows.map(r => r.role)))).filter(Boolean).sort();
    res.json({
      users: users.map(u => ({ username: u.username, name: u.name, modules: byUser[u.username] || {}, adminOf: adminBy[u.username] || [] })),
      o2sRoles: o2sRoles,
      pdRoles: PD_ROLE_KEYS,
      caps: req.adminCaps
    });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
// Set/replace a user's role in a module (dual-write). COO does any module; a subsystem admin only their own.
app.post('/api/platform/access', auth, accessAdmin, async (req, res) => {
  try {
    const username = String((req.body && req.body.username) || '').trim().toLowerCase();
    const module = String((req.body && req.body.module) || '').trim().toLowerCase();
    const role = String((req.body && req.body.role) || '').trim();
    if (!username || !module) return res.status(400).json({ error: 'username and module required' });
    if (!validModuleRole(module, role)) return res.status(400).json({ error: 'invalid role "' + role + '" for module ' + module });
    const caps = req.adminCaps;
    if (!caps.isCOO) {                                                  // subsystem-admin guardrails
      if (caps.adminModules.indexOf(module) < 0) return res.status(403).json({ error: 'You administer only: ' + (caps.adminModules.join(', ') || '(none)') + '.' });
      if (module === 'o2s' && role === 'COO') return res.status(403).json({ error: 'Only the COO can assign the COO role.' });
      if (await isUserCOO(username)) return res.status(403).json({ error: "You can't change the COO's access." });
    }
    const [ex] = await pdq('SELECT username FROM auth_users WHERE username=?', [username]);
    if (!ex[0]) return res.status(404).json({ error: 'no such user' });
    await pdq('INSERT INTO user_module_roles (username, module, role) VALUES (?,?,?) ON DUPLICATE KEY UPDATE role=VALUES(role)', [username, module, role]);
    if (module === 'o2s') await pdq('UPDATE auth_users SET role=? WHERE username=?', [role, username]);
    else if (module === 'pd') await pdq('UPDATE auth_users SET pd_role=? WHERE username=?', [role, username]);
    res.json({ ok: true, username, module, role });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
// Revoke a user's access to a module (dual-write). COO does any module; a subsystem admin only their own.
app.delete('/api/platform/access', auth, accessAdmin, async (req, res) => {
  try {
    const username = String((req.body && req.body.username) || '').trim().toLowerCase();
    const module = String((req.body && req.body.module) || '').trim().toLowerCase();
    if (!username || !module) return res.status(400).json({ error: 'username and module required' });
    const caps = req.adminCaps;
    if (!caps.isCOO) {                                                  // subsystem-admin guardrails
      if (caps.adminModules.indexOf(module) < 0) return res.status(403).json({ error: 'You administer only: ' + (caps.adminModules.join(', ') || '(none)') + '.' });
      if (await isUserCOO(username)) return res.status(403).json({ error: "You can't change the COO's access." });
    }
    await pdq('DELETE FROM user_module_roles WHERE username=? AND module=?', [username, module]);
    // mirror the removal to the module's legacy column
    if (module === 'o2s') await pdq('UPDATE auth_users SET role=NULL WHERE username=?', [username]);
    else if (module === 'pd') await pdq('UPDATE auth_users SET pd_role=NULL WHERE username=?', [username]);
    res.json({ ok: true, username, module, revoked: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
// Create a user — IDENTITY ONLY, no module access. COO-only. Access is granted afterward in Manage access.
app.post('/api/platform/users', auth, admin, async (req, res) => {
  try {
    if (!pdq) return res.status(503).json({ error: 'Platform user admin needs DATABASE_URL (relational store).' });
    const b = req.body || {};
    const username = String(b.username || '').trim().toLowerCase();
    const name = String(b.name || '').trim();
    const password = String(b.password || '');
    if (!username || !name || !password) return res.status(400).json({ error: 'username, name and password are required' });
    if (!/^[a-z0-9._-]{2,}$/.test(username)) return res.status(400).json({ error: 'username: letters, numbers, . _ - only (min 2 chars)' });
    const [ex] = await pdq('SELECT username FROM auth_users WHERE username=?', [username]);
    if (ex[0]) return res.status(409).json({ error: 'that username already exists' });
    // role and pd_role stay NULL — the account exists but has no module access until granted in Manage access.
    await pdq('INSERT INTO auth_users (username, name, pass_hash, active) VALUES (?,?,?,1)', [username, name, hashPw(password)]);
    res.json({ ok: true, username, name });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
// Appoint / remove a SUBSYSTEM ADMIN for a module (sets user_module_roles.is_admin). COO-only.
// The person must already have a role in that module — admin is an attribute of an existing grant.
app.post('/api/platform/admin', auth, admin, async (req, res) => {
  try {
    if (!pdq) return res.status(503).json({ error: 'Platform admin needs DATABASE_URL.' });
    const username = String((req.body && req.body.username) || '').trim().toLowerCase();
    const module = String((req.body && req.body.module) || '').trim().toLowerCase();
    const isAdmin = !!(req.body && req.body.is_admin);
    if (!username || REAL_MODULES.indexOf(module) < 0) return res.status(400).json({ error: 'valid username and module (o2s|pd) required' });
    const [ex] = await pdq('SELECT role FROM user_module_roles WHERE username=? AND module=?', [username, module]);
    if (!ex[0]) return res.status(400).json({ error: 'Grant ' + username + ' a role in ' + module.toUpperCase() + ' first, then make them its admin.' });
    await pdq('UPDATE user_module_roles SET is_admin=? WHERE username=? AND module=?', [isAdmin ? 1 : 0, username, module]);
    res.json({ ok: true, username, module, is_admin: isAdmin });
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
    const pp = (b.parent_product_id !== undefined && b.parent_product_id !== '' && b.parent_product_id !== null) ? Number(b.parent_product_id) : null;
    const pb = (b.problem_id !== undefined && b.problem_id !== '' && b.problem_id !== null) ? Number(b.problem_id) : null;
    const h = await pd.insert_numbered(pdq, 'pd_hypotheses', 'h_number', async (n) => {
      await pdq(
        `INSERT INTO pd_hypotheses (h_number, title, change_type, lane, parent_product_id, problem_id, idea_text, problem_text, reasoning_text, materials_text, success_text, crop_area, support_text, risk_text, submitted_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [n, b.title, b.change_type, lane, pp, pb, b.idea_text, b.problem_text || null, b.reasoning_text || null,
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
    const [gates] = await pdq(`SELECT g.*, u.name AS decided_by_name, ru.name AS ratified_by_name FROM pd_gate_decisions g JOIN auth_users u ON u.id=g.decided_by LEFT JOIN auth_users ru ON ru.id=g.ratified_by WHERE g.hypothesis_id=? ORDER BY g.decided_at ASC`, [req.params.id]);
    // Development Records for this idea — only shown to those who may reach records (operators/ceo/consultant), never members.
    let records = [];
    if (pd.can_pd(req.pdUser.pd_role, 'records')) {
      const [rr] = await pdq(`SELECT id, record_no, status, approved_g2_at, target_analysis FROM pd_dev_records WHERE hypothesis_id=? ORDER BY id DESC`, [req.params.id]);
      records = rr;
    }
    // The G2 route opens only from an idea the screener passed as LOG at G1; only the QC Head team (or COO) may open one.
    const can_create_record = idea.screen_decision === 'log' && pd.can_role(req.pdUser.pd_role, ['qc_head']);
    // COO's light-lane reversal window: a short veto (LIGHT_REVERSAL_DAYS), only if the COO didn't screen it themselves and it hasn't been reversed already.
    let reversal = null;
    if (idea.lane === 'light' && req.pdUser.pd_role === 'coo' && idea.screen_decision && idea.screened_at && idea.screened_by !== req.pdUser.id) {
      const [[rv]] = [(await pdq("SELECT DATEDIFF(NOW(), screened_at) AS days, (SELECT COUNT(*) FROM pd_gate_decisions WHERE hypothesis_id=? AND gate='G1' AND decision='reverse') AS reversed FROM pd_hypotheses WHERE id=?", [req.params.id, req.params.id]))[0]];
      const left = pd.LIGHT_REVERSAL_DAYS - Number(rv.days);
      if (left >= 0 && Number(rv.reversed) === 0) reversal = { daysLeft: left };
    }
    const isOperator = pd.may_see_all_ideas(req.pdUser.pd_role) && pd.can_pd(req.pdUser.pd_role, 'ideas.all');
    // Screener/owner context + parent/problem/project labels
    const [labels] = await pdq(`SELECT sb.name screened_by_name, ob.name owner_name,
        pp.code product_code, pp.name product_name, pb.p_number, pb.title problem_title,
        pj.id project_id_, pj.proj_number, pj.code project_code, pj.title project_title
      FROM pd_hypotheses h
      LEFT JOIN auth_users sb ON sb.id=h.screened_by LEFT JOIN auth_users ob ON ob.id=h.owner_id
      LEFT JOIN pd_products pp ON pp.id=h.parent_product_id LEFT JOIN pd_problems pb ON pb.id=h.problem_id
      LEFT JOIN pd_projects pj ON pj.id=h.project_id WHERE h.id=?`, [req.params.id]);
    const lab = labels[0] || {};
    // System memory (shown on the idea itself): similar past ideas + relevant learnings
    const memtext = `${idea.title} ${idea.idea_text || ''} ${idea.materials_text || ''}`.trim();
    let memory = { similar: [], learnings: [] };
    if (memtext.length >= 6) {
      const [sim] = await pdq(`SELECT id, h_number, title, stage, screen_reason, park_condition,
          MATCH(title, idea_text, problem_text, materials_text) AGAINST (? IN NATURAL LANGUAGE MODE) AS score
        FROM pd_hypotheses WHERE MATCH(title, idea_text, problem_text, materials_text) AGAINST (? IN NATURAL LANGUAGE MODE) AND id <> ? ORDER BY score DESC LIMIT 5`, [memtext, memtext, req.params.id]);
      memory.similar = sim.filter(s => Number(s.score) > 0).map(s => {
        let note = pd.STAGES[s.stage] || s.stage;
        if (s.stage === 'killed') note = 'killed — ' + (s.screen_reason || 'see gate log');
        else if (s.stage === 'parked') note = 'parked' + (s.park_condition ? ' — ' + s.park_condition : '');
        return { id: s.id, label: pd.fmt_h(s.h_number) + ' — ' + s.title, note };
      });
      try {
        const [lrn] = await pdq('SELECT fact, evidence, source FROM pd_learnings WHERE MATCH(fact, tag) AGAINST (? IN NATURAL LANGUAGE MODE) LIMIT 4', [memtext]);
        memory.learnings = lrn;
      } catch (e) { /* fulltext may have no index terms */ }
    }
    // Samples + field trials for this idea (the "Samples & trials" section)
    const [smpRows] = await pdq('SELECT sample_no FROM pd_samples WHERE hypothesis_id=? ORDER BY sample_no', [req.params.id]);
    const [trlRows] = await pdq('SELECT trial_code FROM pd_field_trials WHERE hypothesis_id=? ORDER BY id', [req.params.id]);
    const samples = smpRows.map(s => pd.fmt_s(s.sample_no));
    const trials = trlRows.map(t => t.trial_code);
    // Pre-bench candidate counts (for the summary line)
    const [[cc]] = [(await pdq("SELECT COUNT(*) n, SUM(status='selected') sel FROM pd_candidates WHERE hypothesis_id=?", [req.params.id]))[0]];
    const candidateCounts = { total: Number(cc.n) || 0, selected: Number(cc.sel) || 0 };
    // Discussion + reading pinned to this idea — shown to operators AND to the idea's own submitter (like the PHP page).
    const canDiscuss = isOperator || idea.submitted_by === req.pdUser.id;
    let comments = [], pinned = [], lists = null;
    if (canDiscuss) {
      const [cm] = await pdq(`SELECT c.*, u.name, u.pd_role FROM pd_comments c JOIN auth_users u ON u.id=c.added_by WHERE c.target_type='hypothesis' AND c.target_id=? ORDER BY c.added_at`, [req.params.id]);
      comments = cm.map(c => ({ ...c, role_label: pd.PD_ROLES[c.pd_role] || c.pd_role }));
      const [pn] = await pdq(`SELECT i.id, i.item_no, i.title, i.why, i.evidence FROM pd_library_pins p JOIN pd_library_items i ON i.id=p.item_id WHERE p.target_type='hypothesis' AND p.target_id=? AND i.archived=0 ORDER BY p.pinned_at`, [req.params.id]);
      pinned = pn.map(i => ({ ...i, l_label: pd.fmt_l(i.item_no), evidence_short: pd.EVIDENCE_SHORT[i.evidence] }));
    }
    if (isOperator) { // the tracker-update dropdowns are operator-only (the update itself is custodian-gated)
      const [users] = await pdq('SELECT id, name FROM auth_users WHERE pd_role IS NOT NULL ORDER BY name');
      const [products] = await pdq('SELECT id, code FROM pd_products ORDER BY code');
      const [problems] = await pdq('SELECT id, p_number, title FROM pd_problems ORDER BY p_number');
      lists = { users, products, problems: problems.map(p => ({ id: p.id, label: pd.fmt_p(p.p_number) + ' — ' + p.title })), stages: pd.STAGES };
    }
    const canScreen = idea.stage === 'proposed' && pd.may_screen(req.pdUser.pd_role, idea.lane);
    // Next step · whose job (the flow banner) — needs the latest dev record's review/sign state.
    const [[latestRec]] = [(await pdq('SELECT id, approved_g2_at, review_rta_at, review_complete_by FROM pd_dev_records WHERE hypothesis_id=? ORDER BY id DESC LIMIT 1', [req.params.id]))[0]];
    const next_step = pdNextStep(idea, latestRec || null);
    res.json({
      ...idea, h_label: pd.fmt_h(idea.h_number), stage_label: pd.STAGES[idea.stage], next_step,
      change_type_label: pd.CHANGE_TYPES[idea.change_type] || idea.change_type,
      lane_who: pd.screener_for(idea.lane)[2],
      screened_by_name: lab.screened_by_name, owner_name: lab.owner_name,
      product: lab.product_code ? { code: lab.product_code, name: lab.product_name } : null,
      problem: lab.p_number ? { label: pd.fmt_p(lab.p_number) + ' — ' + lab.problem_title } : null,
      project: lab.project_id_ ? { id: lab.project_id_, label: pd.fmt_prj(lab.proj_number) + ' ' + lab.project_code, title: lab.project_title } : null,
      gates, records, can_create_record, reversal, memory, comments, pinned, lists, isOperator, canScreen,
      samples, trials, candidateCounts, canDiscuss,
      caps: { screen: canScreen, update: pd.can_role(req.pdUser.pd_role, ['custodian']), comment: canDiscuss, recordGate: pd.can_role(req.pdUser.pd_role, ['rta', 'custodian']) },
    });
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
    const f = k => (b[k] == null ? '' : String(b[k]).trim());
    const prio = ['', 'high', 'medium', 'low'].includes(b.priority) ? b.priority : '';
    const owner = (b.owner_id !== undefined && b.owner_id !== '' && b.owner_id !== null) ? Number(b.owner_id) : null;
    await pdq('UPDATE pd_hypotheses SET screen_decision=?, screen_reason=?, screen_manuf_note=?, screen_chem_note=?, park_condition=?, priority=?, route=?, lever=?, stage=?, screened_by=?, screened_at=NOW(), owner_id=? WHERE id=?',
      [b.decision, b.reason, f('screen_manuf_note'), f('screen_chem_note'), f('park_condition'), prio, f('route'), f('lever'), pd.SCREEN_TO_STAGE[b.decision], req.pdUser.id, owner, req.params.id]);
    const reasonNote = b.reason + (provisional ? ` (screened by the Plant Manager as deputy on the ${idea.lane} lane — to be ratified)` : '');
    await pdq('INSERT INTO pd_gate_decisions (hypothesis_id, gate, decision, reason, decided_by, provisional) VALUES (?,?,?,?,?,?)',
      [req.params.id, 'G1', pd.SCREEN_TO_GATE_DECISION[b.decision], reasonNote, req.pdUser.id, provisional ? 1 : 0]);
    // NOTE: the PHP app emails the submitter (decision) and the COO (deputy screen / light-lane window) here; notifications not yet ported.
    res.json({ ok: true, provisional });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.get('/api/pd/gatelog', auth, pdAuth, pdSurface('gatelog'), async (req, res) => {
  try {
    const [rows] = await pdq(`SELECT g.*, h.h_number, h.title, u.name AS decided_by_name, ru.name AS ratified_by_name
       FROM pd_gate_decisions g JOIN pd_hypotheses h ON h.id=g.hypothesis_id JOIN auth_users u ON u.id=g.decided_by
       LEFT JOIN auth_users ru ON ru.id=g.ratified_by
       ORDER BY g.decided_at DESC LIMIT 200`);
    res.json(rows.map(r => ({ ...r, h_label: pd.fmt_h(r.h_number) })));
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// My Work: ideas in this lane/role's screening queue (mirrors mywork.php's "the button that does the thing").
app.get('/api/pd/mywork', auth, pdAuth, pdSurface('mywork'), async (req, res) => {
  try {
    const R = req.pdUser.pd_role, SLA = pd.GATE_SLA_DAYS, REV = pd.LIGHT_REVERSAL_DAYS;
    const one = async (sql, params) => (await pdq(sql, params || []))[0];
    const awaiting = lane => one("SELECT h.id, h.h_number, h.title, DATEDIFF(NOW(), h.submitted_at) age FROM pd_hypotheses h WHERE h.stage='proposed' AND h.lane=? ORDER BY h.submitted_at", [lane]);
    const awaitingHeavy = await awaiting('heavy'), awaitingLight = await awaiting('light');
    const awaitingAll = [...awaitingHeavy, ...awaitingLight].sort((a, b) => (a.age < b.age ? 1 : -1));
    const screenedNoRecord = await one("SELECT h.id, h.h_number, h.title FROM pd_hypotheses h WHERE h.screen_decision='log' AND NOT EXISTS (SELECT 1 FROM pd_dev_records r WHERE r.hypothesis_id=h.id) ORDER BY h.screened_at");
    const recNeedRta = await one("SELECT r.id, r.record_no, h.h_number, h.title FROM pd_dev_records r JOIN pd_hypotheses h ON h.id=r.hypothesis_id WHERE r.review_rta_at IS NULL ORDER BY r.created_at");
    const recNeedComplete = await one("SELECT r.id, r.record_no, h.h_number, h.title FROM pd_dev_records r JOIN pd_hypotheses h ON h.id=r.hypothesis_id WHERE r.review_rta_at IS NOT NULL AND r.review_complete_by IS NULL ORDER BY r.review_rta_at");
    const recReadyG2 = await one("SELECT r.id, r.record_no, h.h_number, h.title FROM pd_dev_records r JOIN pd_hypotheses h ON h.id=r.hypothesis_id WHERE r.review_rta_at IS NOT NULL AND r.review_complete_by IS NOT NULL AND r.approved_g2_at IS NULL ORDER BY r.review_rta_at");
    const benchOpen = await one("SELECT h.id, h.h_number, h.title FROM pd_hypotheses h WHERE EXISTS (SELECT 1 FROM pd_gate_decisions g WHERE g.hypothesis_id=h.id AND g.gate='G3' AND g.decision='advance') AND NOT EXISTS (SELECT 1 FROM pd_samples s WHERE s.hypothesis_id=h.id) ORDER BY h.h_number");
    const samplesNoTest = await one("SELECT s.id, s.sample_no, s.recipe_short FROM pd_samples s WHERE NOT EXISTS (SELECT 1 FROM pd_lab_tests t WHERE t.sample_id=s.id) ORDER BY s.sample_no");
    const fieldNoTrial = await one("SELECT h.id, h.h_number, h.title FROM pd_hypotheses h WHERE h.stage='field_trial' AND NOT EXISTS (SELECT 1 FROM pd_field_trials t WHERE t.hypothesis_id=h.id) ORDER BY h.h_number");
    const validated = await one("SELECT id, h_number, title FROM pd_hypotheses WHERE stage='validated' ORDER BY h_number");
    const pendRatify = await one("SELECT g.id, g.gate, g.decision, h.h_number, h.title FROM pd_gate_decisions g JOIN pd_hypotheses h ON h.id=g.hypothesis_id WHERE g.provisional=1 AND g.ratified_by IS NULL ORDER BY g.decided_at");
    const openProblems = await one("SELECT id, p_number, title FROM pd_problems WHERE status='open' ORDER BY p_number");
    const dropNew = await one("SELECT id, name, text FROM pd_dropbox WHERE status='new' ORDER BY created_at");
    const routesNoCandidates = await one("SELECT h.id, h.h_number, h.title FROM pd_hypotheses h WHERE h.screen_decision='log' AND h.stage NOT IN ('killed','parked','validated') AND NOT EXISTS (SELECT 1 FROM pd_candidates c WHERE c.hypothesis_id=h.id) ORDER BY h.h_number");
    const candsToMake = await one("SELECT c.cand_no, c.label, c.hypothesis_id, h.h_number FROM pd_candidates c JOIN pd_hypotheses h ON h.id=c.hypothesis_id WHERE c.status='selected' AND EXISTS (SELECT 1 FROM pd_gate_decisions g WHERE g.hypothesis_id=c.hypothesis_id AND g.gate='G3' AND g.decision='advance') ORDER BY c.calc_cost_per_kg_p");
    const digest = await one(`SELECT h.id, h.h_number, h.title, h.screen_decision, u2.name screener FROM pd_hypotheses h JOIN auth_users u2 ON u2.id=h.screened_by WHERE h.lane='light' AND h.screen_decision<>'' AND h.screened_at IS NOT NULL AND h.screened_at > DATE_SUB(NOW(), INTERVAL ${REV} DAY) AND u2.pd_role <> 'coo' AND NOT EXISTS (SELECT 1 FROM pd_gate_decisions g WHERE g.hypothesis_id=h.id AND g.gate='G1' AND g.decision='reverse') ORDER BY h.screened_at DESC`);

    const sections = [];
    // Labels are rendered as HTML on the client, so escape all user-controlled text here.
    const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const H = x => pd.fmt_h(x.h_number) + ' — ' + E(x.title);
    const ageStr = x => x.age > SLA ? ` · ${x.age} days — over the ${SLA}-day target` : ` · ${x.age} day${x.age === 1 ? '' : 's'}`;
    const add = (items, title, rowFn, act = true) => { if (items.length) sections.push({ title, act, items: items.slice(0, 8).map(rowFn), more: Math.max(0, items.length - 8) }); };
    const idea = (x, extra, btnLabel, ghost) => ({ label: H(x) + (extra || ''), btn: { label: btnLabel, hash: '#idea/' + x.id, ghost: !!ghost } });
    const rec = (r, btnLabel, ghost) => ({ label: r.record_no + ' — ' + pd.fmt_h(r.h_number) + ' ' + E(r.title), btn: { label: btnLabel, hash: '#record/' + r.id, ghost: !!ghost } });

    if (R === 'coo') {
      add(awaitingHeavy, 'Ideas awaiting your screen (G1 · heavy lane — new product concepts)', x => idea(x, ageStr(x), 'Screen'));
      add(digest, `Light-lane digest — screens you may still reverse (${REV}-day window)`, x => idea(x, ' — ' + String(x.screen_decision).toUpperCase() + ' by ' + E(x.screener), 'Review', true), false);
      add(openProblems, 'New problems to review & set direction', p => ({ label: pd.fmt_p(p.p_number) + ' — ' + E(p.title), btn: { label: 'Review', hash: '#problems' } }));
      add(recReadyG2, 'Designs ready for you to sign (G2)', r => rec(r, 'Review & sign'));
      add(pendRatify, 'Provisional decisions waiting on your ratification', g => ({ label: g.gate + ' ' + String(g.decision).toUpperCase() + ' — ' + pd.fmt_h(g.h_number) + ' ' + E(g.title), btn: { label: 'Ratify', hash: '#gatelog' } }));
    }
    if (R === 'qc_head') {
      add(awaitingLight, 'Ideas awaiting your screen (G1 · light lane — improvements, variants, fixes)', x => idea(x, ageStr(x), 'Screen'));
      add(screenedNoRecord, 'Screened LOG — open a Development Record for the route', x => idea(x, '', 'Open record'));
      add(routesNoCandidates, 'Open routes with nothing screened on paper yet', x => ({ label: H(x), btn: { label: 'Screen candidates', hash: '#route/' + x.id, ghost: true } }), false);
      add(candsToMake, 'Candidates selected and cleared by the beaker gate — make them', c => ({ label: pd.fmt_c(c.cand_no) + ' ' + E(c.label) + ' (on ' + pd.fmt_h(c.h_number) + ')', btn: { label: 'Make', hash: '#route/' + c.hypothesis_id } }));
      add(benchOpen, 'Bench open (G3 passed) — log a sample', x => ({ label: H(x), btn: { label: 'Log sample', hash: '#samples' } }));
      add(samplesNoTest, 'Samples awaiting a lab test', s => ({ label: pd.fmt_s(s.sample_no) + ' — ' + E(s.recipe_short || ''), btn: { label: 'Log test', hash: '#tests' } }));
    }
    if (R === 'rta') {
      add(recNeedRta, 'Development Records awaiting your technical review', r => rec(r, 'Review'));
      add(recReadyG2, 'Designs ready for G2 — you may sign on site (the COO ratifies)', r => rec(r, 'Open'));
      add(awaitingAll, 'Intake queue — screen ONLY as deputy, when the named screener is away', x => idea(x, ageStr(x), 'View', true), false);
    }
    if (R === 'custodian') {
      add(awaitingAll, 'Intake queue — nudge the screener if it is ageing', x => idea(x, ageStr(x), 'View', true), false);
      add(recNeedComplete, 'Records needing your completeness check before G2', r => rec(r, 'Check'));
      add(dropNew, 'Drop-box entries to triage', d => ({ label: E(d.name) + ' — ' + E(String(d.text).slice(0, 50)), btn: { label: 'Triage', hash: '#dropbox' } }));
      add(openProblems, 'New problems — log them and nudge management (they decide)', p => ({ label: pd.fmt_p(p.p_number) + ' — ' + E(p.title), btn: { label: 'Open', hash: '#problems', ghost: true } }), false);
      add(pendRatify, 'Provisional decisions to minute', g => ({ label: g.gate + ' ' + String(g.decision).toUpperCase() + ' — ' + pd.fmt_h(g.h_number) + ' ' + E(g.title), btn: { label: 'Open', hash: '#gatelog', ghost: true } }), false);
    }
    if (R === 'lab_tech') {
      add(candsToMake, 'Candidates selected and cleared by the beaker gate — make them', c => ({ label: pd.fmt_c(c.cand_no) + ' ' + E(c.label) + ' (on ' + pd.fmt_h(c.h_number) + ')', btn: { label: 'Make', hash: '#route/' + c.hypothesis_id } }));
      add(benchOpen, 'Bench open (G3 passed) — log a sample', x => ({ label: H(x), btn: { label: 'Log sample', hash: '#samples' } }));
      add(samplesNoTest, 'Samples awaiting a lab test', s => ({ label: pd.fmt_s(s.sample_no) + ' — ' + E(s.recipe_short || ''), btn: { label: 'Log test', hash: '#tests' } }));
    }
    if (R === 'agronomy') {
      add(fieldNoTrial, 'Field-stage ideas needing a trial designed (DAP control, replication, measures fixed before sowing)', x => ({ label: H(x), btn: { label: 'Design trial', hash: '#trials' } }));
    }
    if (R === 'production') {
      add(validated, 'Validated — take to costing, registration and launch', x => ({ label: H(x), btn: { label: 'Open', hash: '#formulations', ghost: true } }), false);
      add(screenedNoRecord, 'Newly screened — your quick "can we make it?" read is wanted', x => idea(x, '', 'View', true), false);
    }
    if (R === 'ceo') {
      add(recReadyG2, 'Designs at G2 — read the reasoning if you want to weigh in', r => rec(r, 'Read', true), false);
      add(validated, 'Validated candidates heading for G6', x => idea(x, '', 'Read', true), false);
    }
    res.json({ sections, caughtUp: sections.length === 0, firstName: String(req.pdUser.name || '').trim().split(' ')[0] });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

/* ---------- PD · G2 / Development Records (faithful port of records.php + record.php) ----------
   The rule this enforces: no sample is made until Sections 1-3 are written, reviewed (RTA),
   checked complete (Custodian), and approved at G2. Sections 1-3 lock on G2 approval — a changed
   design is a NEW record. Sections 4-5 open only after G2. Write actions are gated per role the
   same way the PHP app did (can_role = the listed roles, or COO). */

// List every Development Record. Read surface 'records' (operators / ceo / consultant / coo / custodian; not members/lab techs).
app.get('/api/pd/records', auth, pdAuth, pdSurface('records'), async (req, res) => {
  try {
    const [rows] = await pdq(`SELECT r.*, h.h_number, h.title FROM pd_dev_records r JOIN pd_hypotheses h ON h.id=r.hypothesis_id ORDER BY r.id DESC`);
    res.json(rows.map(r => ({ ...r, h_label: pd.fmt_h(r.h_number) })));
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// Open a new record for a hypothesis. QC Head team (or COO), and only for an idea passed LOG at G1.
app.post('/api/pd/records', auth, pdAuth, pdSurface('records'), async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['qc_head'])) return res.status(403).json({ error: 'Only the QC Head team (or COO) may open a Development Record.' });
    const hid = Number((req.body && req.body.hypothesis_id) || 0);
    const [[hyp]] = [(await pdq('SELECT id, h_number, screen_decision FROM pd_hypotheses WHERE id=?', [hid]))[0]];
    if (!hyp) return res.status(404).json({ error: 'Hypothesis not found.' });
    if (hyp.screen_decision !== 'log') return res.status(409).json({ error: `A Development Record opens only for an idea passed as LOG at G1. ${pd.fmt_h(hyp.h_number)} is ${hyp.screen_decision ? hyp.screen_decision.toUpperCase() : 'awaiting screen'}.` });
    // Allocate DR-#### safely under concurrency (record_no is UNIQUE) — mirrors record.php's retry loop.
    let rid = 0, no = '';
    for (let tryN = 0; tryN < 10; tryN++) {
      const [[mx]] = [(await pdq(`SELECT COALESCE(MAX(CAST(SUBSTRING(record_no,4) AS UNSIGNED)),0)+1 AS n FROM pd_dev_records`))[0]];
      no = 'DR-' + String(mx.n).padStart(4, '0');
      try {
        const [ins] = await pdq('INSERT INTO pd_dev_records (hypothesis_id, record_no, created_by) VALUES (?,?,?)', [hid, no, req.pdUser.id]);
        rid = ins.insertId; break;
      } catch (e) { if (e && e.errno === 1062) continue; throw e; }
    }
    if (!rid) return res.status(500).json({ error: 'Could not allocate a record number — try again.' });
    res.json({ ok: true, id: rid, record_no: no });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// One record + its hypothesis + role-scoped capability flags (what THIS user may do), so the UI matches the server's gates.
app.get('/api/pd/records/:id', auth, pdAuth, pdSurface('records'), async (req, res) => {
  try {
    const [[r]] = [(await pdq(
      `SELECT r.*, h.h_number, h.title, h.change_type,
         ur.name AS review_rta_by_name, uc.name AS review_complete_by_name, ug.name AS approved_g2_by_name
       FROM pd_dev_records r
       JOIN pd_hypotheses h ON h.id=r.hypothesis_id
       LEFT JOIN auth_users ur ON ur.id=r.review_rta_by
       LEFT JOIN auth_users uc ON uc.id=r.review_complete_by
       LEFT JOIN auth_users ug ON ug.id=r.approved_g2_by
       WHERE r.id=?`, [req.params.id]))[0]];
    if (!r) return res.status(404).json({ error: 'Record not found.' });
    const role = req.pdUser.pd_role;
    const locked_pre = !!r.approved_g2_at;
    const caps = {
      locked_pre,
      can_edit_pre: pd.can_role(role, ['qc_head']) && !locked_pre,
      can_review_rta: pd.can_role(role, ['rta']) && !r.review_rta_at,
      can_complete: pd.can_role(role, ['custodian']) && !r.review_complete_at,
      can_approve_g2: pd.can_role(role, ['rta']) && !r.approved_g2_at,
      g2_ready: !!r.review_rta_at && !!r.review_complete_at,
      would_delegate: role === 'rta', // COO signing is not delegated; RTA on site is
      can_edit_post: pd.can_role(role, ['qc_head', 'rta']) && locked_pre,
    };
    res.json({ ...r, h_label: pd.fmt_h(r.h_number), caps });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// Save Sections 1-3 (pre-bench). QC Head team (or COO); blocked once G2 has locked the design.
app.post('/api/pd/records/:id/pre', auth, pdAuth, pdSurface('records'), async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['qc_head'])) return res.status(403).json({ error: 'Sections 1–3 are edited by the QC Head team (or COO).' });
    const [[r]] = [(await pdq('SELECT approved_g2_at FROM pd_dev_records WHERE id=?', [req.params.id]))[0]];
    if (!r) return res.status(404).json({ error: 'Record not found.' });
    if (r.approved_g2_at) return res.status(409).json({ error: 'Sections 1–3 are locked — the design was already approved at G2. A changed design is a NEW record.' });
    const b = req.body || {}; const f = k => (b[k] == null ? '' : String(b[k]).trim());
    await pdq(`UPDATE pd_dev_records SET target_analysis=?, platform_concept=?, batch_size=?,
         s1_soil_problem=?, s1_crop_region=?, s1_farmer_reason=?, s1_claims_tags=?,
         s2_reactions=?, s2_mass_balance=?, s2_water_balance=?, s2_ingredient_roles=?, s2_predicted_split=?,
         s3_hypothesis_one_line=?, s3_success_kill_criteria=?, s3_assays_methods=?, s3_release_protocol=?
       WHERE id=?`,
      [f('target_analysis'), f('platform_concept'), f('batch_size'),
       f('s1_soil_problem'), f('s1_crop_region'), f('s1_farmer_reason'), f('s1_claims_tags'),
       f('s2_reactions'), f('s2_mass_balance'), f('s2_water_balance'), f('s2_ingredient_roles'), f('s2_predicted_split'),
       f('s3_hypothesis_one_line'), f('s3_success_kill_criteria'), f('s3_assays_methods'), f('s3_release_protocol'), req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// RTA technical review.
app.post('/api/pd/records/:id/rta-review', auth, pdAuth, pdSurface('records'), async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['rta'])) return res.status(403).json({ error: 'The technical review is the Plant Manager’s (RTA).' });
    const [[r]] = [(await pdq('SELECT review_rta_at FROM pd_dev_records WHERE id=?', [req.params.id]))[0]];
    if (!r) return res.status(404).json({ error: 'Record not found.' });
    if (r.review_rta_at) return res.status(409).json({ error: 'Technical review already recorded.' });
    await pdq('UPDATE pd_dev_records SET review_rta_by=?, review_rta_at=NOW(), review_rta_note=?, status="reviewed" WHERE id=?',
      [req.pdUser.id, String((req.body && req.body.note) || '').trim(), req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// Custodian completeness check.
app.post('/api/pd/records/:id/complete', auth, pdAuth, pdSurface('records'), async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['custodian'])) return res.status(403).json({ error: 'The completeness check is the Data Custodian’s.' });
    const [[r]] = [(await pdq('SELECT review_complete_at FROM pd_dev_records WHERE id=?', [req.params.id]))[0]];
    if (!r) return res.status(404).json({ error: 'Record not found.' });
    if (r.review_complete_at) return res.status(409).json({ error: 'Completeness already confirmed.' });
    await pdq('UPDATE pd_dev_records SET review_complete_by=?, review_complete_at=NOW() WHERE id=?', [req.pdUser.id, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// G2 approval — COO, or RTA under delegation (flagged provisional, COO ratifies in the Gate Log). Advances the idea to 'designed'.
app.post('/api/pd/records/:id/g2', auth, pdAuth, pdSurface('records'), async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['rta'])) return res.status(403).json({ error: 'G2 sign-off is the COO’s (or the RTA on site under delegation).' });
    const [[r]] = [(await pdq('SELECT * FROM pd_dev_records WHERE id=?', [req.params.id]))[0]];
    if (!r) return res.status(404).json({ error: 'Record not found.' });
    if (r.approved_g2_at) return res.status(409).json({ error: 'G2 already approved.' });
    if (!r.review_rta_at || !r.review_complete_at) return res.status(409).json({ error: 'G2 needs BOTH the RTA technical review and the Custodian completeness check first.' });
    const delegated = req.pdUser.pd_role === 'rta' ? 1 : 0;
    await pdq('UPDATE pd_dev_records SET approved_g2_by=?, approved_g2_at=NOW(), approved_g2_delegated=?, status="approved" WHERE id=?',
      [req.pdUser.id, delegated, req.params.id]);
    await pdq('UPDATE pd_hypotheses SET stage="designed" WHERE id=? AND stage="screened"', [r.hypothesis_id]);
    await pdq('INSERT INTO pd_gate_decisions (hypothesis_id, gate, decision, reason, decided_by, provisional) VALUES (?,?,?,?,?,?)',
      [r.hypothesis_id, 'G2', 'advance', 'Design approved: ' + r.record_no + (delegated ? ' (signed on site under delegated authority — COO to ratify within 48 h)' : ''), req.pdUser.id, delegated]);
    // NOTE: the PHP app also emails the COO on a delegated sign-off; notifications are not yet ported (see PORTING_STATUS.md).
    res.json({ ok: true, delegated: !!delegated });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// Save Sections 4-5 (post-bench). QC Head team or RTA (or COO); only after G2.
app.post('/api/pd/records/:id/post', auth, pdAuth, pdSurface('records'), async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['qc_head', 'rta'])) return res.status(403).json({ error: 'Bench results are recorded by the QC Head team or the RTA.' });
    const [[r]] = [(await pdq('SELECT approved_g2_at FROM pd_dev_records WHERE id=?', [req.params.id]))[0]];
    if (!r) return res.status(404).json({ error: 'Record not found.' });
    if (!r.approved_g2_at) return res.status(409).json({ error: 'No bench work before G2 approval — that is the beaker-gate rule.' });
    const b = req.body || {}; const f = k => (b[k] == null ? '' : String(b[k]).trim());
    const resultVs = ['', 'pass', 'fail', 'ambiguous'].includes(b.s5_result_vs_criteria) ? b.s5_result_vs_criteria : '';
    const decision = ['', 'advance', 'iterate', 'stop'].includes(b.s5_decision) ? b.s5_decision : '';
    await pdq(`UPDATE pd_dev_records SET s4_actual_charges=?, s4_observations=?, s4_deviations=?, s4_recovery=?,
         s5_measured_vs_predicted=?, s5_result_vs_criteria=?, s5_discussion=?, s5_decision=?, s5_next_experiment=?,
         status=IF(?<>'', 'bench_done', status) WHERE id=?`,
      [f('s4_actual_charges'), f('s4_observations'), f('s4_deviations'), f('s4_recovery'),
       f('s5_measured_vs_predicted'), resultVs, f('s5_discussion'), decision, f('s5_next_experiment'),
       f('s4_actual_charges'), req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

/* ---------- PD · Gate log recorder (G3-G6 committee decisions) — faithful port of gates.php ----------
   G1 is recorded on the idea (screen), G2 on the Development Record; G3-G6 are recorded here by the chair
   (COO), an RTA site quorum (provisional until the COO ratifies), or the Custodian minuting the meeting. */

app.post('/api/pd/gates/decide', auth, pdAuth, pdSurface('gatelog'), async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['rta', 'custodian'])) return res.status(403).json({ error: 'Gate decisions are recorded by the chair (COO), the RTA site quorum, or the Custodian.' });
    const b = req.body || {};
    const hid = Number(b.hypothesis_id || 0);
    const gate = String(b.gate || '');
    const decision = String(b.decision || '');
    const reason = String(b.reason || '').trim();
    if (!['G3', 'G4', 'G5', 'G6'].includes(gate)) return res.status(400).json({ error: 'gate must be one of G3, G4, G5, G6 (G1 is the screen, G2 the Development Record).' });
    if (!['advance', 'iterate', 'park', 'kill'].includes(decision)) return res.status(400).json({ error: 'decision must be advance, iterate, park or kill.' });
    if (!reason) return res.status(400).json({ error: 'A written reason is required — no decision exists without a reason.' });
    const [[hyp]] = [(await pdq('SELECT id FROM pd_hypotheses WHERE id=?', [hid]))[0]];
    if (!hyp) return res.status(404).json({ error: 'Pick a hypothesis.' });
    const site = b.is_site_quorum ? 1 : 0;
    const provisional = site ? 1 : 0; // site-quorum decisions are provisional until the COO ratifies
    await pdq('INSERT INTO pd_gate_decisions (hypothesis_id, gate, decision, reason, decided_by, is_site_quorum, attendees, provisional) VALUES (?,?,?,?,?,?,?,?)',
      [hid, gate, decision, reason, req.pdUser.id, site, String(b.attendees || '').trim(), provisional]);
    if (decision === 'advance' && pd.GATE_ADVANCE_STAGE[gate]) await pdq('UPDATE pd_hypotheses SET stage=? WHERE id=?', [pd.GATE_ADVANCE_STAGE[gate], hid]);
    else if (decision === 'park') await pdq('UPDATE pd_hypotheses SET stage="parked" WHERE id=?', [hid]);
    else if (decision === 'kill') await pdq('UPDATE pd_hypotheses SET stage="killed" WHERE id=?', [hid]);
    // NOTE: the PHP app also emails the COO on a provisional (site-quorum) decision; notifications are not yet ported.
    res.json({ ok: true, provisional: !!provisional });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// COO ratifies a provisional/delegated decision (48-hour rule). Also ratifies a matching delegated G2 on the record.
app.post('/api/pd/gates/:id/ratify', auth, pdAuth, pdSurface('gatelog'), async (req, res) => {
  try {
    if (req.pdUser.pd_role !== 'coo') return res.status(403).json({ error: 'Ratification is the COO’s.' });
    const [[g]] = [(await pdq('SELECT * FROM pd_gate_decisions WHERE id=?', [req.params.id]))[0]];
    if (!g) return res.status(404).json({ error: 'Decision not found.' });
    await pdq('UPDATE pd_gate_decisions SET ratified_by=?, ratified_at=NOW(), provisional=0 WHERE id=?', [req.pdUser.id, req.params.id]);
    if (g.gate === 'G2') await pdq('UPDATE pd_dev_records SET ratified_by=?, ratified_at=NOW() WHERE hypothesis_id=? AND approved_g2_delegated=1 AND ratified_by IS NULL', [req.pdUser.id, g.hypothesis_id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

/* ---------- PD · G3 beaker gate: samples + lab tests (faithful port of samples.php + tests.php) ----------
   A sample cannot be logged until the idea has a G3 ADVANCE in the gate log — the beaker-gate discipline. */

app.get('/api/pd/samples', auth, pdAuth, pdSurface('samples'), async (req, res) => {
  try {
    const [rows] = await pdq(`SELECT s.*, h.h_number FROM pd_samples s JOIN pd_hypotheses h ON h.id=s.hypothesis_id ORDER BY s.sample_no DESC`);
    res.json(rows.map(s => ({ ...s, s_label: pd.fmt_s(s.sample_no), h_label: pd.fmt_h(s.h_number) })));
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// Log a physical sample. QC Head team / Lab Technician / Custodian (or COO). Blocked unless a G3 ADVANCE exists.
app.post('/api/pd/samples', auth, pdAuth, pdSurface('samples'), async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['qc_head', 'custodian', 'lab_tech'])) return res.status(403).json({ error: 'Samples are logged by the QC Head team, a Lab Technician, or the Custodian.' });
    const b = req.body || {};
    const hid = Number(b.hypothesis_id || 0);
    const [[hyp]] = [(await pdq(`SELECT h.id, h.h_number,
        (SELECT COUNT(*) FROM pd_gate_decisions g WHERE g.hypothesis_id=h.id AND g.gate='G3' AND g.decision='advance') AS g3ok
        FROM pd_hypotheses h WHERE h.id=?`, [hid]))[0]];
    if (!hyp) return res.status(404).json({ error: 'Pick a hypothesis.' });
    if (!hyp.g3ok) return res.status(409).json({ error: `No G3 (beaker gate) advance is recorded for ${pd.fmt_h(hyp.h_number)} — a sample cannot be logged before the committee opens the beaker gate.` });
    const dr = (b.dev_record_id !== undefined && b.dev_record_id !== null && b.dev_record_id !== '') ? Number(b.dev_record_id) : null;
    const f = k => (b[k] == null ? '' : String(b[k]).trim());
    const sample_no = await pd.insert_numbered(pdq, 'pd_samples', 'sample_no', async (n) => {
      await pdq(`INSERT INTO pd_samples (sample_no, hypothesis_id, dev_record_id, made_on, recipe_short, target_analysis, batch_size, made_by, materials, retain_location, observation, notes, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [n, hid, dr, b.made_on || null, f('recipe_short'), f('target_analysis'), f('batch_size'), f('made_by'), f('materials'), f('retain_location'), f('observation'), f('notes'), req.pdUser.id]);
    });
    await pdq('UPDATE pd_hypotheses SET stage="sampled" WHERE id=? AND stage IN ("designed")', [hid]);
    res.json({ ok: true, sample_no, s_label: pd.fmt_s(sample_no) });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.get('/api/pd/tests', auth, pdAuth, pdSurface('samples'), async (req, res) => {
  try {
    const [rows] = await pdq(`SELECT t.*, s.sample_no, h.h_number FROM pd_lab_tests t JOIN pd_samples s ON s.id=t.sample_id JOIN pd_hypotheses h ON h.id=s.hypothesis_id ORDER BY t.test_no DESC`);
    res.json(rows.map(t => ({ ...t, t_label: pd.fmt_t(t.test_no), s_label: pd.fmt_s(t.sample_no), h_label: pd.fmt_h(t.h_number) })));
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// Log a lab test against a sample. Same roles as samples. Moves the sample to 'tested' and the idea to stage 'tested'.
app.post('/api/pd/tests', auth, pdAuth, pdSurface('samples'), async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['qc_head', 'custodian', 'lab_tech'])) return res.status(403).json({ error: 'Lab tests are logged by the QC Head team, a Lab Technician, or the Custodian.' });
    const b = req.body || {};
    const sid = Number(b.sample_id || 0);
    const [[s]] = [(await pdq('SELECT id, hypothesis_id FROM pd_samples WHERE id=?', [sid]))[0]];
    if (!s) return res.status(404).json({ error: 'Pick a sample.' });
    if (!b.test_type || !String(b.test_type).trim()) return res.status(400).json({ error: 'test_type is required.' });
    const f = k => (b[k] == null ? '' : String(b[k]).trim());
    const pass_fail = ['', 'pass', 'fail', 'na'].includes(b.pass_fail) ? b.pass_fail : '';
    const stNum = Number(b.stability_day);
    const stability = (b.stability_day !== undefined && b.stability_day !== null && String(b.stability_day).trim() !== '' && !isNaN(stNum)) ? stNum : null;
    const test_no = await pd.insert_numbered(pdq, 'pd_lab_tests', 'test_no', async (n) => {
      await pdq(`INSERT INTO pd_lab_tests (test_no, sample_id, tested_on, test_type, stability_day, method, result, units, pass_fail, tested_by, notes, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [n, sid, b.tested_on || null, f('test_type'), stability, f('method'), f('result'), f('units'), pass_fail, f('tested_by'), f('notes'), req.pdUser.id]);
    });
    await pdq('UPDATE pd_samples SET status="tested" WHERE id=?', [sid]);
    await pdq('UPDATE pd_hypotheses SET stage="tested" WHERE id=? AND stage="sampled"', [s.hypothesis_id]);
    res.json({ ok: true, test_no, t_label: pd.fmt_t(test_no) });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

/* ---------- PD · Pre-bench candidate screen + materials register (faithful port of
   candidates.php + materials.php + inc/screen.php). The arithmetic lives in pd-lib's
   screen_candidate(); these routes wire it to the DB and enforce the same role gates. */

// get-or-create a route's screen settings (mirrors route_settings())
async function pdRouteSettings(hid) {
  let [rows] = await pdq('SELECT * FROM pd_route_screens WHERE hypothesis_id=?', [hid]);
  if (!rows[0]) { await pdq('INSERT INTO pd_route_screens (hypothesis_id) VALUES (?)', [hid]); [rows] = await pdq('SELECT * FROM pd_route_screens WHERE hypothesis_id=?', [hid]); }
  return rows[0];
}
// re-run the arithmetic for one candidate and store the result (mirrors rescreen())
async function pdRescreenCandidate(cid) {
  const [[c]] = [(await pdq('SELECT * FROM pd_candidates WHERE id=?', [cid]))[0]];
  if (!c) return null;
  const rs = await pdRouteSettings(c.hypothesis_id);
  const [lineRows] = await pdq('SELECT cl.inclusion_pct, m.* FROM pd_candidate_lines cl JOIN pd_materials m ON m.id=cl.material_id WHERE cl.candidate_id=?', [cid]);
  const lines = lineRows.map(row => ({ material: row, pct: Number(row.inclusion_pct) }));
  const present = lines.filter(l => l.pct >= pd.CONFLICT_MIN_PCT).map(l => l.material.id);
  let conflicts = [];
  if (present.length > 1) {
    const ph = present.map(() => '?').join(',');
    const [cf] = await pdq(`SELECT c.*, a.code ca, b.code cb FROM pd_material_conflicts c JOIN pd_materials a ON a.id=c.material_a_id JOIN pd_materials b ON b.id=c.material_b_id WHERE c.material_a_id IN (${ph}) AND c.material_b_id IN (${ph})`, [...present, ...present]);
    conflicts = cf;
  }
  const r = pd.screen_candidate(lines, rs, conflicts);
  await pdq(`UPDATE pd_candidates SET calc_inclusion_total=?, calc_n=?, calc_p2o5=?, calc_s=?, calc_zn=?, calc_rm_cost=?, calc_exworks_cost=?, calc_cost_per_kg_p=?, provisional_pricing=?, verdict=?, verdict_reasons=? WHERE id=?`,
    [r.total, r.n, r.p2o5, r.s, r.zn, r.rm_cost, r.exworks, r.cost_per_kg_p, r.provisional, r.verdict, r.reasons, cid]);
  return r;
}

// ---- Materials register ----
app.get('/api/pd/materials', auth, pdAuth, pdSurface('candidates'), async (req, res) => {
  try {
    const [materials] = await pdq('SELECT * FROM pd_materials WHERE active=1 ORDER BY code');
    const [conflicts] = await pdq(`SELECT c.*, a.code ca, a.name na, b.code cb, b.name nb, uc.name confirmed_by_name FROM pd_material_conflicts c
       JOIN pd_materials a ON a.id=c.material_a_id JOIN pd_materials b ON b.id=c.material_b_id LEFT JOIN auth_users uc ON uc.id=c.confirmed_by ORDER BY c.severity, a.code`);
    const placeholders = materials.filter(m => m.cost_basis === 'placeholder' || m.assay_basis === 'placeholder').length;
    const role = req.pdUser.pd_role;
    res.json({ materials, conflicts, placeholders, assayBasis: pd.ASSAY_BASIS, costBasis: pd.COST_BASIS,
      caps: { edit: pd.can_role(role, ['qc_head', 'production', 'custodian']), confirm: pd.can_role(role, ['qc_head']) } });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/pd/materials', auth, pdAuth, pdSurface('candidates'), async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['qc_head', 'production', 'custodian'])) return res.status(403).json({ error: 'The materials register is edited by the QC Head team, Production, or the Custodian.' });
    const b = req.body || {};
    const num = k => Math.max(0, Math.min(100, Number(b[k]) || 0));
    const ab = pd.ASSAY_BASIS[b.assay_basis] ? b.assay_basis : 'placeholder';
    const cb = pd.COST_BASIS[b.cost_basis] ? b.cost_basis : 'placeholder';
    const cost = Math.max(0, Number(b.cost_per_tonne) || 0), spec = String(b.spec_note || '').trim();
    const mid = Number(b.material_id || 0);
    if (mid) {
      const [r] = await pdq('UPDATE pd_materials SET n_pct=?, p2o5_pct=?, s_pct=?, zn_pct=?, cost_per_tonne=?, assay_basis=?, cost_basis=?, spec_note=?, cost_updated=CURRENT_DATE, updated_by=? WHERE id=?',
        [num('n_pct'), num('p2o5_pct'), num('s_pct'), num('zn_pct'), cost, ab, cb, spec, req.pdUser.id, mid]);
      if (r.affectedRows === 0) return res.status(404).json({ error: 'Material not found.' });
      return res.json({ ok: true, updated: true });
    }
    const code = String(b.code || '').trim().toUpperCase(), name = String(b.name || '').trim();
    if (!code || !name) return res.status(400).json({ error: 'A material needs a short code and a name.' });
    const [ex] = await pdq('SELECT id FROM pd_materials WHERE code=?', [code]);
    if (ex[0]) return res.status(409).json({ error: 'That code is already in the register.' });
    await pdq('INSERT INTO pd_materials (code, name, n_pct, p2o5_pct, s_pct, zn_pct, cost_per_tonne, assay_basis, cost_basis, spec_note, cost_updated, updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,CURRENT_DATE,?)',
      [code, name, num('n_pct'), num('p2o5_pct'), num('s_pct'), num('zn_pct'), cost, ab, cb, spec, req.pdUser.id]);
    res.json({ ok: true, created: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/pd/materials/conflicts', auth, pdAuth, pdSurface('candidates'), async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['qc_head', 'production', 'custodian'])) return res.status(403).json({ error: 'The compatibility table is edited by the QC Head team, Production, or the Custodian.' });
    const b = req.body || {};
    let a = Number(b.material_a_id || 0), bb = Number(b.material_b_id || 0);
    const reason = String(b.reason || '').trim();
    if (a === bb || !a || !bb || !reason) return res.status(400).json({ error: 'Pick two different materials and say why they should not meet.' });
    if (a > bb) { const t = a; a = bb; bb = t; } // one row per unordered pair
    const sev = b.severity === 'avoid' ? 'avoid' : 'caution';
    try { await pdq('INSERT INTO pd_material_conflicts (material_a_id, material_b_id, severity, reason, added_by) VALUES (?,?,?,?,?)', [a, bb, sev, reason, req.pdUser.id]); res.json({ ok: true }); }
    catch (e) { if (e && e.errno === 1062) return res.status(409).json({ error: 'That pair is already flagged.' }); throw e; }
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/pd/materials/conflicts/:id/confirm', auth, pdAuth, pdSurface('candidates'), async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['qc_head'])) return res.status(403).json({ error: 'Confirming a compatibility flag is a chemistry call — the QC Head’s.' });
    const [r] = await pdq('UPDATE pd_material_conflicts SET confirmed_by=?, confirmed_at=NOW() WHERE id=?', [req.pdUser.id, req.params.id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Flag not found.' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ---- Candidate screen ----
app.get('/api/pd/candidates', auth, pdAuth, pdSurface('candidates'), async (req, res) => {
  try {
    const [rows] = await pdq(`SELECT h.id, h.h_number, h.title, h.stage, h.route,
        (SELECT COUNT(*) FROM pd_candidates c WHERE c.hypothesis_id=h.id) cands,
        (SELECT COUNT(*) FROM pd_candidates c WHERE c.hypothesis_id=h.id AND c.status='selected') sel,
        (SELECT COUNT(*) FROM pd_gate_decisions g WHERE g.hypothesis_id=h.id AND g.gate='G3' AND g.decision='advance') g3
      FROM pd_hypotheses h WHERE h.screen_decision='log' AND h.stage NOT IN ('killed','parked') ORDER BY h.h_number DESC`);
    res.json(rows.map(r => ({ ...r, h_label: pd.fmt_h(r.h_number), stage_label: pd.STAGES[r.stage], g3_open: r.g3 > 0 })));
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.get('/api/pd/candidates/:hid', auth, pdAuth, pdSurface('candidates'), async (req, res) => {
  try {
    const hid = Number(req.params.hid);
    const [[hyp]] = [(await pdq('SELECT id, h_number, title, route, stage FROM pd_hypotheses WHERE id=?', [hid]))[0]];
    if (!hyp) return res.status(404).json({ error: 'Route not found.' });
    const rs = await pdRouteSettings(hid);
    const [materials] = await pdq('SELECT * FROM pd_materials WHERE active=1 ORDER BY code');
    const [cands] = await pdq(`SELECT c.*, s.sample_no, du.name decided_by_name FROM pd_candidates c
        LEFT JOIN pd_samples s ON s.id=c.sample_id LEFT JOIN auth_users du ON du.id=c.decided_by
        WHERE c.hypothesis_id=? ORDER BY FIELD(verdict,'pass','borderline','fail'), calc_cost_per_kg_p`, [hid]);
    const [[g3row]] = [(await pdq("SELECT COUNT(*) c FROM pd_gate_decisions WHERE hypothesis_id=? AND gate='G3' AND decision='advance'", [hid]))[0]];
    const role = req.pdUser.pd_role;
    res.json({
      hyp: { ...hyp, h_label: pd.fmt_h(hyp.h_number), stage_label: pd.STAGES[hyp.stage] }, rs, materials,
      candidates: cands.map(c => ({ ...c, c_label: pd.fmt_c(c.cand_no), s_label: c.sample_no ? pd.fmt_s(c.sample_no) : null })),
      g3_open: g3row.c > 0,
      caps: { editBar: pd.can_role(role, ['qc_head', 'production', 'custodian']), addCandidate: pd.can_role(role, ['qc_head', 'lab_tech']), decide: pd.can_role(role, ['qc_head']), make: pd.can_role(role, ['qc_head', 'lab_tech']) },
    });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/pd/candidates/:hid/settings', auth, pdAuth, pdSurface('candidates'), async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['qc_head', 'production', 'custodian'])) return res.status(403).json({ error: 'The screen bar is set by the QC Head team, Production, or the Custodian.' });
    const hid = Number(req.params.hid); await pdRouteSettings(hid);
    const b = req.body || {}; const f = k => Number(b[k]) || 0;
    await pdq(`UPDATE pd_route_screens SET target_p2o5_min=?, target_p2o5_max=?, target_n_min=?, target_n_max=?, target_s_min=?, target_zn_min=?,
        cost_ceiling_per_tonne=?, ceiling_basis=?, conversion_cost_per_tonne=?, process_loss_pct=?, set_by=? WHERE hypothesis_id=?`,
      [f('target_p2o5_min'), f('target_p2o5_max') || 100, f('target_n_min'), f('target_n_max') || 100, f('target_s_min'), f('target_zn_min'),
       f('cost_ceiling_per_tonne'), String(b.ceiling_basis || '').trim(), f('conversion_cost_per_tonne'), f('process_loss_pct'), req.pdUser.id, hid]);
    const [cs] = await pdq('SELECT id FROM pd_candidates WHERE hypothesis_id=?', [hid]);
    for (const c of cs) await pdRescreenCandidate(c.id);
    res.json({ ok: true, rescreened: cs.length });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/pd/candidates/:hid/add', auth, pdAuth, pdSurface('candidates'), async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['qc_head', 'lab_tech'])) return res.status(403).json({ error: 'Candidates are added by the QC Head team or the Lab.' });
    const hid = Number(req.params.hid), b = req.body || {};
    const label = String(b.label || '').trim(), micro = String(b.micro_hypothesis || '').trim();
    if (!label || !micro) return res.status(400).json({ error: 'A candidate needs a label and a one-line micro-hypothesis — what this combination tests, and what you expect.' });
    const agg = {};
    for (const ln of (b.lines || [])) { const mid = Number(ln.material_id || 0), pct = Number(ln.inclusion_pct || 0); if (mid && pct > 0) agg[mid] = (agg[mid] || 0) + pct; }
    const mids = Object.keys(agg);
    if (!mids.length) return res.status(400).json({ error: 'Give the candidate at least one material with an inclusion above zero.' });
    let newId = 0, candNo = 0;
    for (let tryN = 0; tryN < 10; tryN++) {
      const [[mx]] = [(await pdq('SELECT COALESCE(MAX(cand_no),0)+1 n FROM pd_candidates WHERE hypothesis_id=?', [hid]))[0]];
      candNo = mx.n;
      try { const [ins] = await pdq('INSERT INTO pd_candidates (hypothesis_id, cand_no, label, micro_hypothesis, created_by) VALUES (?,?,?,?,?)', [hid, candNo, label, micro, req.pdUser.id]); newId = ins.insertId; break; }
      catch (e) { if (e && e.errno === 1062) continue; throw e; }
    }
    if (!newId) return res.status(500).json({ error: 'Could not allocate a candidate number — try again.' });
    for (const mid of mids) await pdq('INSERT INTO pd_candidate_lines (candidate_id, material_id, inclusion_pct) VALUES (?,?,?)', [newId, Number(mid), agg[mid]]);
    const r = await pdRescreenCandidate(newId);
    res.json({ ok: true, id: newId, c_label: pd.fmt_c(candNo), verdict: r.verdict });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/pd/candidates/:hid/decide', auth, pdAuth, pdSurface('candidates'), async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['qc_head'])) return res.status(403).json({ error: 'Selecting candidates for the bench is the QC Head’s call (they own the chemistry).' });
    const hid = Number(req.params.hid), b = req.body || {};
    const cid = Number(b.candidate_id || 0), want = b.decision === 'selected' ? 'selected' : 'rejected';
    const reason = String(b.decision_reason || '').trim();
    const [[c]] = [(await pdq('SELECT * FROM pd_candidates WHERE id=? AND hypothesis_id=?', [cid, hid]))[0]];
    if (!c) return res.status(404).json({ error: 'Candidate not found on this route.' });
    if (!reason) return res.status(400).json({ error: 'Selecting or rejecting a candidate carries a reason, like every other decision here.' });
    if (want === 'selected' && c.verdict === 'fail') return res.status(409).json({ error: 'That candidate fails the screen. Fix the bar or the materials and re-screen — do not select past a FAIL, because then the screen stops meaning anything.' });
    await pdq('UPDATE pd_candidates SET status=?, decided_by=?, decided_at=NOW(), decision_reason=? WHERE id=?', [want, req.pdUser.id, reason, cid]);
    res.json({ ok: true, status: want });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/pd/candidates/:hid/make', auth, pdAuth, pdSurface('candidates'), async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['qc_head', 'lab_tech'])) return res.status(403).json({ error: 'Making a sample from a candidate is the QC Head team’s or the Lab’s.' });
    const hid = Number(req.params.hid), b = req.body || {};
    const cid = Number(b.candidate_id || 0);
    const [[c]] = [(await pdq('SELECT * FROM pd_candidates WHERE id=? AND hypothesis_id=?', [cid, hid]))[0]];
    if (!c) return res.status(404).json({ error: 'Candidate not found on this route.' });
    if (c.status !== 'selected') return res.status(409).json({ error: 'Only a SELECTED candidate can be made. Select it first, with a reason.' });
    const [[g3]] = [(await pdq("SELECT COUNT(*) c FROM pd_gate_decisions WHERE hypothesis_id=? AND gate='G3' AND decision='advance'", [hid]))[0]];
    if (!g3.c) return res.status(409).json({ error: 'The beaker gate is shut: no G3 ADVANCE is recorded for this route. The screen may rank candidates on paper all day — nothing gets physically made until the committee opens the route.' });
    const [lines] = await pdq('SELECT m.code, m.name, cl.inclusion_pct FROM pd_candidate_lines cl JOIN pd_materials m ON m.id=cl.material_id WHERE cl.candidate_id=? ORDER BY cl.inclusion_pct DESC', [cid]);
    const recipe = lines.map(l => l.code + ' ' + Number(l.inclusion_pct) + '%').join(' · ');
    const matlist = lines.map(l => l.name + ' — ' + Number(l.inclusion_pct) + '%').join('\n');
    const target = `${Number(c.calc_n).toFixed(1)}-${Number(c.calc_p2o5).toFixed(1)}-0 (mass balance)`;
    const notes = `From pre-bench candidate ${pd.fmt_c(c.cand_no)} — ${c.label}\nMicro-hypothesis: ${c.micro_hypothesis}\nScreened analysis (mass balance, NOT measured): N ${Number(c.calc_n)}%, P2O5 ${Number(c.calc_p2o5)}%, S ${Number(c.calc_s)}%, Zn ${Number(c.calc_zn)}%.\nMeasure the real assay and the water-soluble / citrate-soluble / residual P split, and record both against this.`;
    let sampleId = 0;
    const sample_no = await pd.insert_numbered(pdq, 'pd_samples', 'sample_no', async (n) => {
      const [ins] = await pdq('INSERT INTO pd_samples (sample_no, hypothesis_id, made_on, recipe_short, target_analysis, materials, notes, created_by) VALUES (?,?,CURRENT_DATE,?,?,?,?,?)',
        [n, hid, recipe, target, matlist, notes, req.pdUser.id]);
      sampleId = ins.insertId;
    });
    await pdq('UPDATE pd_candidates SET status="made", sample_id=? WHERE id=?', [sampleId, cid]);
    await pdq('UPDATE pd_hypotheses SET stage="sampled" WHERE id=? AND stage IN ("designed")', [hid]);
    res.json({ ok: true, s_label: pd.fmt_s(sample_no) });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

/* ---------- PD · Field trials (G5) — faithful port of trials.php ----------
   Only for hypotheses that survived the bench (G4). A trial needs a G5 committee approval in the gate
   log before sowing. NOTE: observation PHOTO upload is deferred to the Library file-security pass (same
   reason cowork flagged the Library) — observations are text-only for now; the photo column stays unused. */

app.get('/api/pd/trials', auth, pdAuth, pdSurface('trials'), async (req, res) => {
  try {
    const [hyps] = await pdq("SELECT id, h_number, title FROM pd_hypotheses WHERE stage IN ('evaluated','field_trial','validated') ORDER BY h_number DESC");
    const [trials] = await pdq(`SELECT t.*, h.h_number, h.title,
        (SELECT COUNT(*) FROM pd_gate_decisions g WHERE g.hypothesis_id=t.hypothesis_id AND g.gate='G5' AND g.decision='advance') g5ok
      FROM pd_field_trials t JOIN pd_hypotheses h ON h.id=t.hypothesis_id ORDER BY t.id DESC`);
    const ids = trials.map(t => t.id);
    let obsByTrial = {};
    if (ids.length) {
      const [obs] = await pdq(`SELECT o.*, u.name added_by_name FROM pd_field_obs o JOIN auth_users u ON u.id=o.added_by WHERE o.trial_id IN (${ids.map(() => '?').join(',')}) ORDER BY o.obs_date DESC`, ids);
      for (const o of obs) (obsByTrial[o.trial_id] = obsByTrial[o.trial_id] || []).push(o);
    }
    const role = req.pdUser.pd_role;
    res.json({
      hyps: hyps.map(h => ({ ...h, h_label: pd.fmt_h(h.h_number) })),
      trials: trials.map(t => ({ ...t, h_label: pd.fmt_h(t.h_number), g5ok: t.g5ok > 0, observations: obsByTrial[t.id] || [] })),
      caps: { design: pd.can_role(role, ['agronomy', 'custodian']), observe: pd.can_role(role, ['agronomy', 'custodian', 'rta']), update: pd.can_role(role, ['agronomy', 'custodian']) },
    });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.post('/api/pd/trials', auth, pdAuth, pdSurface('trials'), async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['agronomy', 'custodian'])) return res.status(403).json({ error: 'Field trials are designed by Agronomy or the Custodian.' });
    const b = req.body || {}; const hid = Number(b.hypothesis_id || 0);
    const [[hyp]] = [(await pdq('SELECT id FROM pd_hypotheses WHERE id=?', [hid]))[0]];
    if (!hyp) return res.status(404).json({ error: 'Pick a hypothesis.' });
    const f = k => (b[k] == null ? '' : String(b[k]).trim());
    const year = new Date().getFullYear();
    let code = '';
    for (let tryN = 0; tryN < 10; tryN++) {
      const [[cnt]] = [(await pdq('SELECT COUNT(*)+1 c FROM pd_field_trials WHERE trial_code LIKE ?', [`FT-${year}-%`]))[0]];
      code = `FT-${year}-${String(cnt.c).padStart(2, '0')}`;
      try {
        await pdq(`INSERT INTO pd_field_trials (trial_code, hypothesis_id, season, crop, location, soil_info, objective, success_kill, treatments, design_layout, measurements, designed_by)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          [code, hid, f('season'), f('crop'), f('location'), f('soil_info'), f('objective'), f('success_kill'), f('treatments'), f('design_layout') || 'RCBD, 3 replications', f('measurements'), req.pdUser.id]);
        return res.json({ ok: true, trial_code: code });
      } catch (e) { if (e && e.errno === 1062) continue; throw e; }
    }
    res.status(500).json({ error: 'Could not allocate a trial code — try again.' });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.post('/api/pd/trials/:id/observe', auth, pdAuth, pdSurface('trials'), async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['agronomy', 'custodian', 'rta'])) return res.status(403).json({ error: 'Field observations are added by Agronomy, the Custodian, or the RTA.' });
    const b = req.body || {};
    const [[t]] = [(await pdq('SELECT id FROM pd_field_trials WHERE id=?', [req.params.id]))[0]];
    if (!t) return res.status(404).json({ error: 'Trial not found.' });
    const txt = String(b.obs_text || '').trim();
    if (!txt) return res.status(400).json({ error: 'Write what you saw in the field.' });
    const obsDate = (b.obs_date && String(b.obs_date).trim()) ? b.obs_date : new Date().toISOString().slice(0, 10);
    await pdq('INSERT INTO pd_field_obs (trial_id, obs_date, obs_text, added_by) VALUES (?,?,?,?)', [req.params.id, obsDate, txt, req.pdUser.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.post('/api/pd/trials/:id/update', auth, pdAuth, pdSurface('trials'), async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['agronomy', 'custodian'])) return res.status(403).json({ error: 'A trial is updated by Agronomy or the Custodian.' });
    const b = req.body || {};
    const [[t]] = [(await pdq('SELECT id FROM pd_field_trials WHERE id=?', [req.params.id]))[0]];
    if (!t) return res.status(404).json({ error: 'Trial not found.' });
    const status = ['designed', 'approved', 'running', 'harvested', 'analysed', 'closed'].includes(b.status) ? b.status : 'designed';
    const decision = ['', 'advance', 'repeat', 'stop'].includes(b.decision) ? b.decision : '';
    await pdq('UPDATE pd_field_trials SET status=?, sown=?, harvest=?, result_summary=?, decision=? WHERE id=?',
      [status, (b.sown && String(b.sown).trim()) ? b.sown : null, (b.harvest && String(b.harvest).trim()) ? b.harvest : null, String(b.result_summary || '').trim(), decision, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

/* ---------- PD · Registers: Problems, Projects, Portfolio (faithful port of problems.php + problem_new.php,
   projects.php + project.php, portfolio.php). Reads sit behind the 'registers' surface; registering a NEW
   problem is open to any PD role, mirroring the PHP Home door ("anyone may register a problem"). ---------- */

async function pdParticipants() { const [u] = await pdq('SELECT id, name FROM auth_users WHERE pd_role IS NOT NULL AND active=1 ORDER BY name'); return u; }

// -- Problems --
app.get('/api/pd/problems', auth, pdAuth, pdSurface('registers'), async (req, res) => {
  try {
    const [rows] = await pdq(`SELECT p.*, u.name added_by_name,
        (SELECT COUNT(*) FROM pd_hypotheses h WHERE h.problem_id=p.id) ideas
      FROM pd_problems p JOIN auth_users u ON u.id=p.added_by ORDER BY p.p_number`);
    const [prods] = await pdq('SELECT problem_id, code FROM pd_products WHERE problem_id IS NOT NULL');
    const [projs] = await pdq('SELECT id, proj_number, code, problem_id FROM pd_projects WHERE problem_id IS NOT NULL');
    const byProb = {};
    rows.forEach(p => byProb[p.id] = { products: [], projects: [] });
    prods.forEach(pr => { if (byProb[pr.problem_id]) byProb[pr.problem_id].products.push(pr.code); });
    projs.forEach(pj => { if (byProb[pj.problem_id]) byProb[pj.problem_id].projects.push({ id: pj.id, label: pd.fmt_prj(pj.proj_number) + ' ' + pj.code }); });
    res.json({
      problems: rows.map(p => ({ ...p, p_label: pd.fmt_p(p.p_number), source_label: pd.SOURCES[p.source] || p.source, work: byProb[p.id] })),
      caps: { setStatus: pd.can_role(req.pdUser.pd_role, ['custodian']) },
    });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/pd/problems', auth, pdAuth, async (req, res) => { // any PD role — open intake door
  try {
    const b = req.body || {};
    const title = String(b.title || '').trim(), stmt = String(b.statement || '').trim();
    if (!title || !stmt) return res.status(400).json({ error: 'Give the problem a title and state it in field / farmer-economics terms.' });
    const src = pd.SOURCES[b.source] ? b.source : 'team';
    const n = await pd.insert_numbered(pdq, 'pd_problems', 'p_number', async (n) => {
      await pdq('INSERT INTO pd_problems (p_number, title, statement, context, source, added_by) VALUES (?,?,?,?,?,?)',
        [n, title, stmt, String(b.context || '').trim(), src, req.pdUser.id]);
    });
    res.json({ ok: true, p_label: pd.fmt_p(n) });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/pd/problems/:id/status', auth, pdAuth, pdSurface('registers'), async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['custodian'])) return res.status(403).json({ error: 'Problem status is set by the COO or the Custodian.' });
    const status = pd.PROBLEM_STATUS.includes(req.body && req.body.status) ? req.body.status : 'open';
    const [r] = await pdq('UPDATE pd_problems SET status=? WHERE id=?', [status, req.params.id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Problem not found.' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// -- Projects --
app.get('/api/pd/projects', auth, pdAuth, pdSurface('registers'), async (req, res) => {
  try {
    const [projects] = await pdq(`SELECT p.*, pr.p_number, pr.title ptitle, ou.name owner_name,
        (SELECT COUNT(*) FROM pd_hypotheses hh WHERE hh.project_id=p.id) routes
      FROM pd_projects p LEFT JOIN pd_problems pr ON pr.id=p.problem_id LEFT JOIN auth_users ou ON ou.id=p.owner_id ORDER BY p.proj_number`);
    const [problems] = await pdq('SELECT id, p_number, title FROM pd_problems ORDER BY p_number');
    res.json({
      projects: projects.map(p => ({ ...p, prj_label: pd.fmt_prj(p.proj_number), status_label: pd.PROJECT_STATUS[p.status] || p.status, problem_label: p.p_number ? pd.fmt_p(p.p_number) + ' — ' + p.ptitle : null })),
      problems: problems.map(p => ({ id: p.id, label: pd.fmt_p(p.p_number) + ' — ' + p.title })),
      users: await pdParticipants(),
      caps: { open: pd.can_role(req.pdUser.pd_role, ['qc_head', 'custodian']) },
    });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/pd/projects', auth, pdAuth, pdSurface('registers'), async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['qc_head', 'custodian'])) return res.status(403).json({ error: 'Projects are opened by the COO, the PD Lead, or the Registrar.' });
    const b = req.body || {};
    const code = String(b.code || '').trim(), title = String(b.title || '').trim();
    if (!code || !title) return res.status(400).json({ error: 'A project needs a short code and a title.' });
    const problem_id = (b.problem_id !== undefined && b.problem_id !== '' && b.problem_id !== null) ? Number(b.problem_id) : null;
    const owner_id = (b.owner_id !== undefined && b.owner_id !== '' && b.owner_id !== null) ? Number(b.owner_id) : null;
    let newId = 0;
    const n = await pd.insert_numbered(pdq, 'pd_projects', 'proj_number', async (n) => {
      const [ins] = await pdq('INSERT INTO pd_projects (proj_number, code, title, problem_id, brief_why, brief_how, brief_routes, brief_target, owner_id, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [n, code, title, problem_id, String(b.brief_why || '').trim(), String(b.brief_how || '').trim(), String(b.brief_routes || '').trim(), String(b.brief_target || '').trim(), owner_id, req.pdUser.id]);
      newId = ins.insertId;
    });
    res.json({ ok: true, id: newId, prj_label: pd.fmt_prj(n) });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.get('/api/pd/projects/:id', auth, pdAuth, pdSurface('registers'), async (req, res) => {
  try {
    const [[p]] = [(await pdq('SELECT p.*, ou.name owner_name FROM pd_projects p LEFT JOIN auth_users ou ON ou.id=p.owner_id WHERE p.id=?', [req.params.id]))[0]];
    if (!p) return res.status(404).json({ error: 'Project not found.' });
    const problem = p.problem_id ? (await pdq('SELECT p_number, title, statement FROM pd_problems WHERE id=?', [p.problem_id]))[0][0] : null;
    const [routes] = await pdq('SELECT id, h_number, title, route, lane, stage, screen_decision FROM pd_hypotheses WHERE project_id=? ORDER BY route, h_number', [req.params.id]);
    const [free] = await pdq("SELECT id, h_number, title, route FROM pd_hypotheses WHERE project_id IS NULL AND stage NOT IN ('killed') ORDER BY h_number DESC LIMIT 100");
    const [problems] = await pdq('SELECT id, p_number, title FROM pd_problems ORDER BY p_number');
    res.json({
      project: { ...p, prj_label: pd.fmt_prj(p.proj_number), status_label: pd.PROJECT_STATUS[p.status] || p.status },
      problem: problem ? { ...problem, p_label: pd.fmt_p(problem.p_number) } : null,
      routes: routes.map(r => ({ ...r, h_label: pd.fmt_h(r.h_number), stage_label: pd.STAGES[r.stage] })),
      free: free.map(f => ({ ...f, h_label: pd.fmt_h(f.h_number) })),
      problems: problems.map(pp => ({ id: pp.id, label: pd.fmt_p(pp.p_number) + ' — ' + pp.title })),
      users: await pdParticipants(),
      projectStatus: pd.PROJECT_STATUS,
      caps: { edit: pd.can_role(req.pdUser.pd_role, ['qc_head', 'custodian']) },
    });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/pd/projects/:id/save', auth, pdAuth, pdSurface('registers'), async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['qc_head', 'custodian'])) return res.status(403).json({ error: 'The Brief is edited by the COO, the PD Lead, or the Registrar.' });
    const b = req.body || {};
    const [[p]] = [(await pdq('SELECT code, title FROM pd_projects WHERE id=?', [req.params.id]))[0]];
    if (!p) return res.status(404).json({ error: 'Project not found.' });
    const status = pd.PROJECT_STATUS[b.status] ? b.status : 'open';
    const problem_id = (b.problem_id !== undefined && b.problem_id !== '' && b.problem_id !== null) ? Number(b.problem_id) : null;
    const owner_id = (b.owner_id !== undefined && b.owner_id !== '' && b.owner_id !== null) ? Number(b.owner_id) : null;
    await pdq('UPDATE pd_projects SET code=?, title=?, problem_id=?, brief_why=?, brief_how=?, brief_routes=?, brief_target=?, status=?, owner_id=? WHERE id=?',
      [String(b.code || p.code).trim() || p.code, String(b.title || p.title).trim() || p.title, problem_id, String(b.brief_why || '').trim(), String(b.brief_how || '').trim(), String(b.brief_routes || '').trim(), String(b.brief_target || '').trim(), status, owner_id, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/pd/projects/:id/attach', auth, pdAuth, pdSurface('registers'), async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['qc_head', 'custodian'])) return res.status(403).json({ error: 'Attaching a route is the COO/PD Lead/Registrar.' });
    const hid = Number((req.body && req.body.hypothesis_id) || 0);
    if (!hid) return res.status(400).json({ error: 'Pick a route.' });
    await pdq('UPDATE pd_hypotheses SET project_id=? WHERE id=?', [req.params.id, hid]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/pd/projects/:id/detach', auth, pdAuth, pdSurface('registers'), async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['qc_head', 'custodian'])) return res.status(403).json({ error: 'Detaching a route is the COO/PD Lead/Registrar.' });
    await pdq('UPDATE pd_hypotheses SET project_id=NULL WHERE id=? AND project_id=?', [Number((req.body && req.body.hypothesis_id) || 0), req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// -- Portfolio (problem -> product concepts -> ideas, with concept gates A-E) --
app.get('/api/pd/portfolio', auth, pdAuth, pdSurface('registers'), async (req, res) => {
  try {
    const [problems] = await pdq('SELECT * FROM pd_problems ORDER BY p_number');
    const [products] = await pdq('SELECT * FROM pd_products ORDER BY code');
    const [counts] = await pdq('SELECT parent_product_id pid, stage, COUNT(*) c FROM pd_hypotheses WHERE parent_product_id IS NOT NULL GROUP BY parent_product_id, stage');
    const [gates] = await pdq('SELECT * FROM pd_product_gates');
    const [directRows] = await pdq('SELECT problem_id, COUNT(*) c FROM pd_hypotheses WHERE problem_id IS NOT NULL AND parent_product_id IS NULL GROUP BY problem_id');
    const [currentForms] = await pdq("SELECT product_id, version, name FROM pd_formulations WHERE status='current'");
    const countsByProduct = {}; counts.forEach(r => { (countsByProduct[r.pid] = countsByProduct[r.pid] || {})[r.stage] = r.c; });
    const gatesByProduct = {}; gates.forEach(g => { (gatesByProduct[g.product_id] = gatesByProduct[g.product_id] || {})[g.gate] = { status: g.status, note: g.note }; });
    const directByProblem = {}; directRows.forEach(r => directByProblem[r.problem_id] = r.c);
    const currentByProduct = {}; currentForms.forEach(f => currentByProduct[f.product_id] = { version: f.version, name: f.name });
    const shapeProduct = p => {
      const c = countsByProduct[p.id] || {};
      const alive = ['screened', 'designed', 'sampled', 'tested', 'evaluated', 'field_trial'].reduce((s, k) => s + (c[k] || 0), 0);
      return { ...p, counts: { proposed: c.proposed || 0, alive, killed: c.killed || 0, parked: c.parked || 0, validated: c.validated || 0 }, gates: gatesByProduct[p.id] || {}, current: currentByProduct[p.id] || null };
    };
    res.json({
      conceptGates: pd.CONCEPT_GATES,
      problems: problems.map(p => ({ ...p, p_label: pd.fmt_p(p.p_number), direct: directByProblem[p.id] || 0 })),
      products: products.map(shapeProduct),
      caps: { manage: pd.can_role(req.pdUser.pd_role, ['custodian']), gate: req.pdUser.pd_role === 'coo' },
    });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/pd/portfolio/products', auth, pdAuth, pdSurface('registers'), async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['custodian'])) return res.status(403).json({ error: 'Product concepts are created by the COO or the Custodian.' });
    const b = req.body || {};
    const code = String(b.code || '').trim(), name = String(b.name || '').trim();
    if (!code || !name) return res.status(400).json({ error: 'Code and name are required.' });
    const [ex] = await pdq('SELECT id FROM pd_products WHERE code=?', [code]);
    if (ex[0]) return res.status(409).json({ error: 'That product code already exists.' });
    const problem_id = (b.problem_id !== undefined && b.problem_id !== '' && b.problem_id !== null) ? Number(b.problem_id) : null;
    await pdq('INSERT INTO pd_products (code, name, problem_id) VALUES (?,?,?)', [code, name, problem_id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/pd/portfolio/products/:id/link', auth, pdAuth, pdSurface('registers'), async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['custodian'])) return res.status(403).json({ error: 'Linking a product to a problem is the COO or Custodian.' });
    const problem_id = (req.body && req.body.problem_id !== undefined && req.body.problem_id !== '' && req.body.problem_id !== null) ? Number(req.body.problem_id) : null;
    const [r] = await pdq('UPDATE pd_products SET problem_id=? WHERE id=?', [problem_id, req.params.id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Product not found.' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/pd/portfolio/products/:id/gate', auth, pdAuth, pdSurface('registers'), async (req, res) => {
  try {
    if (req.pdUser.pd_role !== 'coo') return res.status(403).json({ error: 'Concept gate decisions are the COO’s.' });
    const b = req.body || {}; const gate = String(b.gate || '');
    if (!pd.CONCEPT_GATES[gate]) return res.status(400).json({ error: 'Pick a gate (A–E).' });
    const status = ['open', 'pass', 'fail'].includes(b.status) ? b.status : 'open';
    await pdq('INSERT INTO pd_product_gates (product_id, gate, status, note, decided_by, decided_at) VALUES (?,?,?,?,?,NOW()) ON DUPLICATE KEY UPDATE status=VALUES(status), note=VALUES(note), decided_by=VALUES(decided_by), decided_at=NOW()',
      [req.params.id, gate, status, String(b.note || '').trim(), req.pdUser.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

/* ---------- PD · Admin registers: Regulatory, Learnings, Formulations + the Activity log
   (faithful port of regulatory.php, learnings.php, formulations.php, audit.php). ---------- */

const REG_STATUS = { not_started: 'Not started', dossier_prep: 'Dossier in preparation', submitted: 'Submitted', queries: 'Authority queries', registered: 'Registered', renewal_due: 'Renewal due' };

// -- Regulatory (one row per product per province) --
app.get('/api/pd/regulatory', auth, pdAuth, pdSurface('regulatory'), async (req, res) => {
  try {
    const [products] = await pdq('SELECT id, code FROM pd_products ORDER BY code');
    const [rows] = await pdq('SELECT r.*, p.code FROM pd_regulatory r JOIN pd_products p ON p.id=r.product_id ORDER BY p.code, r.province');
    res.json({ products, rows: rows.map(r => ({ ...r, status_label: REG_STATUS[r.status] || r.status })), statuses: REG_STATUS, caps: { edit: pd.can_role(req.pdUser.pd_role, ['production', 'custodian']) } });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/pd/regulatory', auth, pdAuth, pdSurface('regulatory'), async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['production', 'custodian'])) return res.status(403).json({ error: 'Regulatory status is updated by Production, the Custodian, or the COO.' });
    const b = req.body || {};
    const pid = Number(b.product_id || 0), prov = String(b.province || '').trim();
    if (!pid || !prov) return res.status(400).json({ error: 'Product and province are required.' });
    const status = REG_STATUS[b.status] ? b.status : 'not_started';
    const d = k => (b[k] && String(b[k]).trim()) ? b[k] : null;
    const vals = [status, String(b.authority || '').trim(), String(b.ref_no || '').trim(), d('submitted_on'), d('registered_on'), d('renewal_due'), String(b.notes || '').trim(), req.pdUser.id];
    const [[ex]] = [(await pdq('SELECT id FROM pd_regulatory WHERE product_id=? AND province=?', [pid, prov]))[0]];
    if (ex) await pdq('UPDATE pd_regulatory SET status=?, authority=?, ref_no=?, submitted_on=?, registered_on=?, renewal_due=?, notes=?, updated_by=? WHERE id=?', [...vals, ex.id]);
    else await pdq('INSERT INTO pd_regulatory (status, authority, ref_no, submitted_on, registered_on, renewal_due, notes, updated_by, product_id, province) VALUES (?,?,?,?,?,?,?,?,?,?)', [...vals, pid, prov]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// -- Learnings (searchable knowledge register) --
app.get('/api/pd/learnings', auth, pdAuth, pdSurface('learnings'), async (req, res) => {
  try {
    const s = String(req.query.s || '').trim();
    let rows;
    if (s) { [rows] = await pdq(`SELECT l.*, h.h_number FROM pd_learnings l LEFT JOIN pd_hypotheses h ON h.id=l.hypothesis_id
        WHERE MATCH(l.fact, l.tag) AGAINST (? IN NATURAL LANGUAGE MODE) OR l.fact LIKE ? ORDER BY l.added_at DESC LIMIT 100`, [s, '%' + s + '%']); }
    else { [rows] = await pdq('SELECT l.*, h.h_number FROM pd_learnings l LEFT JOIN pd_hypotheses h ON h.id=l.hypothesis_id ORDER BY l.added_at DESC LIMIT 100'); }
    const [hyps] = await pdq('SELECT id, h_number, title FROM pd_hypotheses ORDER BY h_number DESC LIMIT 200');
    const uids = [...new Set(rows.map(r => r.added_by))];
    const names = {};
    if (uids.length) { const [ur] = await pdq(`SELECT id, name FROM auth_users WHERE id IN (${uids.map(() => '?').join(',')})`, uids); ur.forEach(u => names[u.id] = u.name); }
    res.json({
      learnings: rows.map(l => ({ ...l, h_label: l.h_number ? pd.fmt_h(l.h_number) : null, added_by_name: names[l.added_by] || '' })),
      hyps: hyps.map(h => ({ id: h.id, h_label: pd.fmt_h(h.h_number), title: h.title })),
      caps: { add: pd.can_role(req.pdUser.pd_role, ['qc_head', 'rta', 'custodian', 'agronomy', 'production']) },
    });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/pd/learnings', auth, pdAuth, pdSurface('learnings'), async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['qc_head', 'rta', 'custodian', 'agronomy', 'production'])) return res.status(403).json({ error: 'Learnings are added by the technical team (QC Head, RTA, Production, Agronomy, Custodian).' });
    const b = req.body || {};
    const fact = String(b.fact || '').trim();
    if (!fact) return res.status(400).json({ error: 'Write the fact in one or two sentences.' });
    const evidence = ['verified', 'validate', 'open'].includes(b.evidence) ? b.evidence : 'validate';
    const hyp = (b.hypothesis_id !== undefined && b.hypothesis_id !== '' && b.hypothesis_id !== null) ? Number(b.hypothesis_id) : null;
    await pdq('INSERT INTO pd_learnings (fact, evidence, tag, source, hypothesis_id, added_by) VALUES (?,?,?,?,?,?)', [fact, evidence, String(b.tag || '').trim(), String(b.source || '').trim(), hyp, req.pdUser.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// -- Formulations (versioned per product; composition restricted to senior technical roles) --
app.get('/api/pd/formulations', auth, pdAuth, pdSurface('formulations'), async (req, res) => {
  try {
    const seesComp = ['coo', 'ceo', 'qc_head', 'rta', 'production', 'custodian'].includes(req.pdUser.pd_role);
    const [products] = await pdq('SELECT id, code, name FROM pd_products ORDER BY code');
    const [hyps] = await pdq('SELECT id, h_number, title FROM pd_hypotheses ORDER BY h_number DESC LIMIT 200');
    const [recs] = await pdq('SELECT id, record_no FROM pd_dev_records ORDER BY id DESC');
    const [forms] = await pdq(`SELECT f.*, p.code, pf.version parent_version, h.h_number, dr.record_no
        FROM pd_formulations f JOIN pd_products p ON p.id=f.product_id
        LEFT JOIN pd_formulations pf ON pf.id=f.parent_formulation_id
        LEFT JOIN pd_hypotheses h ON h.id=f.hypothesis_id
        LEFT JOIN pd_dev_records dr ON dr.id=f.dev_record_id ORDER BY p.code, f.version`);
    res.json({
      seesComposition: seesComp,
      products, recs,
      hyps: hyps.map(h => ({ id: h.id, h_label: pd.fmt_h(h.h_number), title: h.title })),
      forms: forms.map(f => ({ id: f.id, product_id: f.product_id, code: f.code, version: f.version, name: f.name, status: f.status,
        parent_version: f.parent_version, h_label: f.h_number ? pd.fmt_h(f.h_number) : null, record_no: f.record_no,
        change_reason: seesComp ? f.change_reason : null, composition: seesComp ? f.composition : null })),
      caps: { add: pd.can_role(req.pdUser.pd_role, ['qc_head', 'rta']) },
    });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/pd/formulations', auth, pdAuth, pdSurface('formulations'), async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['qc_head', 'rta'])) return res.status(403).json({ error: 'Formulation versions are registered by the QC Head, the RTA, or the COO.' });
    const b = req.body || {};
    const pid = Number(b.product_id || 0);
    const [[prod]] = [(await pdq('SELECT id FROM pd_products WHERE id=?', [pid]))[0]];
    if (!prod) return res.status(404).json({ error: 'Pick a product.' });
    const name = String(b.name || '').trim(), comp = String(b.composition || '').trim();
    if (!name || !comp) return res.status(400).json({ error: 'Name and composition are required.' });
    const status = ['candidate', 'current'].includes(b.status) ? b.status : 'candidate';
    const parent = (b.parent_formulation_id !== undefined && b.parent_formulation_id !== '' && b.parent_formulation_id !== null) ? Number(b.parent_formulation_id) : null;
    const hyp = (b.hypothesis_id !== undefined && b.hypothesis_id !== '' && b.hypothesis_id !== null) ? Number(b.hypothesis_id) : null;
    const dr = (b.dev_record_id !== undefined && b.dev_record_id !== '' && b.dev_record_id !== null) ? Number(b.dev_record_id) : null;
    let ver = 0;
    for (let t = 0; t < 10; t++) {
      const [[mx]] = [(await pdq('SELECT COALESCE(MAX(version),0)+1 v FROM pd_formulations WHERE product_id=?', [pid]))[0]];
      ver = mx.v;
      try {
        await pdq('INSERT INTO pd_formulations (product_id, version, name, parent_formulation_id, hypothesis_id, dev_record_id, composition, change_reason, status, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)',
          [pid, ver, name, parent, hyp, dr, comp, String(b.change_reason || '').trim(), status, req.pdUser.id]);
        break;
      } catch (e) { if (e && e.errno === 1062) continue; throw e; }
    }
    res.json({ ok: true, version: ver });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/pd/formulations/:id/current', auth, pdAuth, pdSurface('formulations'), async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['qc_head', 'rta'])) return res.status(403).json({ error: 'Changing the current formulation is the QC Head, the RTA, or the COO.' });
    const [[f]] = [(await pdq('SELECT id, product_id, version FROM pd_formulations WHERE id=?', [req.params.id]))[0]];
    if (!f) return res.status(404).json({ error: 'Formulation not found.' });
    await pdq('UPDATE pd_formulations SET status="superseded" WHERE product_id=? AND status="current"', [f.product_id]);
    await pdq('UPDATE pd_formulations SET status="current" WHERE id=?', [f.id]);
    res.json({ ok: true, version: f.version });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// -- Activity log (COO / Custodian, read-only) --
app.get('/api/pd/audit', auth, pdAuth, async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['custodian'])) return res.status(403).json({ error: 'The activity log is the COO’s and the Custodian’s.' });
    const fa = String(req.query.a || ''), fu = Number(req.query.u || 0);
    let sql = 'SELECT a.*, u.name, u.username FROM pd_audit_log a LEFT JOIN auth_users u ON u.id=a.user_id WHERE 1=1';
    const params = [];
    if (fa) { sql += ' AND a.action=?'; params.push(fa); }
    if (fu) { sql += ' AND a.user_id=?'; params.push(fu); }
    const [rows] = await pdq(sql + ' ORDER BY a.id DESC LIMIT 300', params);
    const [actions] = await pdq('SELECT DISTINCT action FROM pd_audit_log ORDER BY action');
    const [users] = await pdq('SELECT id, name FROM auth_users WHERE pd_role IS NOT NULL ORDER BY name');
    res.json({ rows, actions: actions.map(a => a.action), users });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

/* ---------- PD · The Library (faithful port of library.php + libitem.php + file.php + inc/library.php).
   Files live on local disk OUTSIDE the web root (configurable via PD_LIBRARY_DIR), served only through the
   auth-checked route below — never by a guessable URL. Uploads arrive base64-in-JSON (no multipart dep). ---------- */

const LIBRARY_DIR = process.env.PD_LIBRARY_DIR || path.join(__dirname, '..', 'van_library_files');
function libDirReady() { if (!fs.existsSync(LIBRARY_DIR)) fs.mkdirSync(LIBRARY_DIR, { recursive: true }); return LIBRARY_DIR; }
async function libTotalBytes() { const [[r]] = [(await pdq("SELECT COALESCE(SUM(file_size),0) t FROM pd_library_items WHERE kind='document'"))[0]]; return Number(r.t); }
const libMayUpload = role => !['member', 'consultant'].includes(role); // documents cost disk + carry copyright -> operator action
// Validate a base64 upload, write it under a randomised name, return {stored,name,size,ext} or throw a safe Error.
function libStoreUpload(base64, origName) {
  const buf = Buffer.from(String(base64 || '').replace(/^data:[^;]*;base64,/, ''), 'base64');
  if (buf.length <= 0) throw new Error('That file is empty.');
  if (buf.length > pd.LIB_MAX_BYTES) throw new Error(`That file is ${pd.human_size(buf.length)}. The cap is ${pd.human_size(pd.LIB_MAX_BYTES)} — put it somewhere else and add it as a link, or summarise it as a note.`);
  const orig = String(origName || '').trim();
  const ext = (orig.includes('.') ? orig.split('.').pop() : '').toLowerCase();
  if (!pd.LIB_TYPES[ext]) throw new Error(`The library takes ${Object.keys(pd.LIB_TYPES).join(', ')}. It does not take "${ext}" — that is deliberate, not an oversight.`);
  if (['jpg', 'jpeg', 'png'].includes(ext)) {
    const jpg = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
    const png = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
    if (!(jpg || png)) throw new Error('That is named as an image but is not one.');
  }
  const head = buf.slice(0, 512).toString('latin1');
  if (/<\?php/i.test(head) || head.includes('<?=')) throw new Error('That file contains code and will not be stored.');
  const d = libDirReady();
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const stored = `${ymd}_${crypto.randomBytes(10).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(d, stored), buf);
  return { stored, name: orig.slice(0, 200), size: buf.length, ext };
}
async function pinTargets() {
  const [hyps] = await pdq("SELECT id, h_number, title FROM pd_hypotheses WHERE stage NOT IN ('killed') ORDER BY h_number DESC");
  const [prjs] = await pdq('SELECT id, proj_number, title FROM pd_projects ORDER BY proj_number DESC');
  const [probs] = await pdq('SELECT id, p_number, title FROM pd_problems ORDER BY p_number DESC');
  return {
    hyps: hyps.map(x => ({ value: 'hypothesis:' + x.id, label: pd.fmt_h(x.h_number) + ' — ' + x.title })),
    projects: prjs.map(x => ({ value: 'project:' + x.id, label: pd.fmt_prj(x.proj_number) + ' — ' + x.title })),
    problems: probs.map(x => ({ value: 'problem:' + x.id, label: pd.fmt_p(x.p_number) + ' — ' + x.title })),
  };
}
async function resolvePin(p) {
  if (p.target_type === 'hypothesis') { const [[r]] = [(await pdq('SELECT h_number, title FROM pd_hypotheses WHERE id=?', [p.target_id]))[0]]; return r ? { label: pd.fmt_h(r.h_number) + ' — ' + r.title, href: '#idea/' + p.target_id } : { label: '(missing route)', href: '' }; }
  if (p.target_type === 'project') { const [[r]] = [(await pdq('SELECT proj_number, title FROM pd_projects WHERE id=?', [p.target_id]))[0]]; return r ? { label: pd.fmt_prj(r.proj_number) + ' — ' + r.title, href: '#project/' + p.target_id } : { label: '(missing project)', href: '' }; }
  const [[r]] = [(await pdq('SELECT p_number, title FROM pd_problems WHERE id=?', [p.target_id]))[0]]; return r ? { label: pd.fmt_p(r.p_number) + ' — ' + r.title, href: '#problems' } : { label: '(missing problem)', href: '' };
}

app.get('/api/pd/library', auth, pdAuth, pdSurface('library'), async (req, res) => {
  try {
    const kindf = pd.LIB_KINDS[req.query.kind] ? req.query.kind : '';
    const evf = pd.EVIDENCE[req.query.ev] ? req.query.ev : '';
    const search = String(req.query.q || '').trim();
    let sql = `SELECT i.*, u.name aname,
        (SELECT COUNT(*) FROM pd_comments c WHERE c.target_type='library' AND c.target_id=i.id) ncom,
        (SELECT COUNT(*) FROM pd_library_pins p WHERE p.item_id=i.id) npin
      FROM pd_library_items i JOIN auth_users u ON u.id=i.added_by WHERE i.archived=0`;
    const args = [];
    if (kindf) { sql += ' AND i.kind=?'; args.push(kindf); }
    if (evf) { sql += ' AND i.evidence=?'; args.push(evf); }
    if (search) { sql += ' AND (i.title LIKE ? OR i.why LIKE ? OR i.body LIKE ? OR i.tag LIKE ? OR i.source LIKE ?)'; const like = '%' + search + '%'; args.push(like, like, like, like, like); }
    sql += ' ORDER BY i.added_at DESC';
    const [rows] = await pdq(sql, args);
    const role = req.pdUser.pd_role;
    let store = null;
    if (pd.can_role(role, ['custodian'])) {
      const [[dc]] = [(await pdq("SELECT COUNT(*) c FROM pd_library_items WHERE kind='document' AND archived=0"))[0]];
      store = { totalBytes: await libTotalBytes(), totalH: pd.human_size(await libTotalBytes()), documents: dc.c, dir: path.basename(LIBRARY_DIR) };
    }
    res.json({
      items: rows.map(r => ({ ...r, l_label: pd.fmt_l(r.item_no), evidence_short: pd.EVIDENCE_SHORT[r.evidence], kind_label: pd.LIB_KINDS[r.kind].split(' — ')[0], size_h: r.file_size ? pd.human_size(r.file_size) : null })),
      kinds: pd.LIB_KINDS, evidence: pd.EVIDENCE, evidenceShort: pd.EVIDENCE_SHORT, libTypes: Object.keys(pd.LIB_TYPES), maxSizeH: pd.human_size(pd.LIB_MAX_BYTES),
      pins: await pinTargets(), mayUpload: libMayUpload(role), store, filters: { kind: kindf, ev: evf, q: search },
    });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/pd/library', auth, pdAuth, pdSurface('library'), async (req, res) => {
  try {
    const b = req.body || {}, role = req.pdUser.pd_role;
    const kind = pd.LIB_KINDS[b.kind] ? b.kind : 'note';
    const title = String(b.title || '').trim(), why = String(b.why || '').trim();
    const body = String(b.body || '').trim(), url = pd.lib_clean_url(b.url);
    const ev = pd.EVIDENCE[b.evidence] ? b.evidence : 'open';
    if (kind === 'document' && !libMayUpload(role)) return res.status(403).json({ error: 'Uploading a document is an operator action — the file store is shared and limited. Add it as a note or a link instead.' });
    if (!title || !why) return res.status(400).json({ error: 'Every item needs a title and one line on WHY the team should read it.' });
    if (kind === 'note' && !body) return res.status(400).json({ error: 'A note needs a body. Write what you want them to know.' });
    if (kind === 'link' && !url) return res.status(400).json({ error: 'That does not look like a web address.' });
    let file = { stored: null, name: null, size: null, ext: null };
    if (kind === 'document') { try { file = libStoreUpload(b.file_data, b.file_name); } catch (e) { return res.status(400).json({ error: e.message }); } }
    let newId = 0;
    const n = await pd.insert_numbered(pdq, 'pd_library_items', 'item_no', async (n) => {
      const [ins] = await pdq('INSERT INTO pd_library_items (item_no, kind, title, why, body, url, file_stored, file_name, file_size, file_ext, evidence, source, tag, added_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [n, kind, title, why, body || null, url || null, file.stored, file.name, file.size, file.ext, ev, String(b.source || '').trim() || null, String(b.tag || '').trim() || null, req.pdUser.id]);
      newId = ins.insertId;
    });
    const m = String(b.pin || '').match(/^(hypothesis|project|problem):(\d+)$/);
    if (m) await pdq('INSERT IGNORE INTO pd_library_pins (item_id, target_type, target_id, pinned_by) VALUES (?,?,?,?)', [newId, m[1], Number(m[2]), req.pdUser.id]);
    res.json({ ok: true, l_label: pd.fmt_l(n) });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.get('/api/pd/library/:id', auth, pdAuth, pdSurface('library'), async (req, res) => {
  try {
    const [[it]] = [(await pdq('SELECT i.*, u.name aname, u.pd_role arole FROM pd_library_items i JOIN auth_users u ON u.id=i.added_by WHERE i.id=?', [req.params.id]))[0]];
    if (!it) return res.status(404).json({ error: 'Not found.' });
    const [pinRows] = await pdq('SELECT * FROM pd_library_pins WHERE item_id=? ORDER BY pinned_at', [req.params.id]);
    const pins = [];
    for (const p of pinRows) pins.push({ id: p.id, ...(await resolvePin(p)) });
    const [comments] = await pdq(`SELECT c.*, u.name, u.pd_role FROM pd_comments c JOIN auth_users u ON u.id=c.added_by WHERE c.target_type='library' AND c.target_id=? ORDER BY c.added_at`, [req.params.id]);
    res.json({
      item: { ...it, l_label: pd.fmt_l(it.item_no), kind_label: pd.LIB_KINDS[it.kind], evidence_label: pd.EVIDENCE[it.evidence], size_h: it.file_size ? pd.human_size(it.file_size) : null, role_label: pd.PD_ROLES[it.arole] || it.arole },
      pins, comments: comments.map(c => ({ ...c, role_label: pd.PD_ROLES[c.pd_role] || c.pd_role })),
      targets: await pinTargets(), caps: { archive: pd.can_role(req.pdUser.pd_role, ['custodian']) },
    });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/pd/library/:id/pin', auth, pdAuth, pdSurface('library'), async (req, res) => {
  try { const m = String((req.body && req.body.pin) || '').match(/^(hypothesis|project|problem):(\d+)$/);
    if (!m) return res.status(400).json({ error: 'Pick somewhere to pin it.' });
    await pdq('INSERT IGNORE INTO pd_library_pins (item_id, target_type, target_id, pinned_by) VALUES (?,?,?,?)', [req.params.id, m[1], Number(m[2]), req.pdUser.id]);
    res.json({ ok: true }); } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/pd/library/:id/unpin', auth, pdAuth, pdSurface('library'), async (req, res) => {
  try { await pdq('DELETE FROM pd_library_pins WHERE id=? AND item_id=?', [Number((req.body && req.body.pin_id) || 0), req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/pd/library/:id/archive', auth, pdAuth, pdSurface('library'), async (req, res) => {
  try { if (!pd.can_role(req.pdUser.pd_role, ['custodian'])) return res.status(403).json({ error: 'Archiving a library item is the Registrar’s (Custodian/COO).' });
    const reason = String((req.body && req.body.reason) || '').trim();
    if (!reason) return res.status(400).json({ error: 'Archiving carries a reason, like everything else here.' });
    const [r] = await pdq('UPDATE pd_library_items SET archived=1, archived_reason=? WHERE id=?', [reason, req.params.id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Not found.' });
    res.json({ ok: true }); } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/pd/library/:id/restore', auth, pdAuth, pdSurface('library'), async (req, res) => {
  try { if (!pd.can_role(req.pdUser.pd_role, ['custodian'])) return res.status(403).json({ error: 'Restoring a library item is the Registrar’s (Custodian/COO).' });
    await pdq('UPDATE pd_library_items SET archived=0, archived_reason=NULL WHERE id=?', [req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/pd/library/:id/comment', auth, pdAuth, pdSurface('library'), async (req, res) => {
  try { const body = String((req.body && req.body.body) || '').trim();
    if (!body) return res.status(400).json({ error: 'Write something first.' });
    const [[it]] = [(await pdq('SELECT id FROM pd_library_items WHERE id=?', [req.params.id]))[0]];
    if (!it) return res.status(404).json({ error: 'Not found.' });
    await pdq("INSERT INTO pd_comments (target_type, target_id, body, added_by) VALUES ('library',?,?,?)", [req.params.id, body, req.pdUser.id]);
    res.json({ ok: true }); } catch (e) { res.status(500).json({ error: String(e) }); }
});
// Serve a document — the ONLY way a file is read. Looked up by DB id, auth-checked, basename-guarded.
app.get('/api/pd/library/:id/file', auth, pdAuth, pdSurface('library'), async (req, res) => {
  try {
    const [[it]] = [(await pdq("SELECT * FROM pd_library_items WHERE id=? AND kind='document'", [req.params.id]))[0]];
    if (!it || !it.file_stored) return res.status(404).json({ error: 'Not found.' });
    const fpath = path.join(LIBRARY_DIR, path.basename(String(it.file_stored)));
    if (!fs.existsSync(fpath)) return res.status(404).json({ error: 'The file is missing from the store.' });
    const ext = String(it.file_ext || '').toLowerCase();
    const inline = ['pdf', 'jpg', 'jpeg', 'png', 'txt'].includes(ext);
    const name = String(it.file_name || '').replace(/[^\w.\- ]+/g, '_') || ('file.' + ext);
    res.setHeader('Content-Type', pd.LIB_TYPES[ext] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${name}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; object-src 'none'");
    fs.createReadStream(fpath).pipe(res);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

/* ---------- PD · Guide (guide.php) — role label + landing + the gate outcomes, single-sourced from pd-lib.
   The static prose lives in the SPA; this just supplies the pieces that come from constants. ---------- */
app.get('/api/pd/guide', auth, pdAuth, (req, res) => {
  try {
    const role = req.pdUser.pd_role;
    const L = pd.landing_for_pd(role); // 'home' | 'index' | 'mywork'
    res.json({
      role, roleLabel: pd.PD_ROLES[role] || 'Team member',
      landingHash: L === 'index' ? '#board' : '#' + L,
      gates: pd.GATES, outcomes: pd.GATE_OUTCOMES,
      slaDays: pd.GATE_SLA_DAYS, reversalDays: pd.LIGHT_REVERSAL_DAYS,
    });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

/* ---------- PD · Home front door + Door 3 "challenge a product" (faithful port of home.php + challenge.php) ---------- */

// The recipe of record for a product, in plain words (mirrors challenge.php current_version()).
async function pdCurrentVersion(pid) {
  let [rows] = await pdq("SELECT version, name FROM pd_formulations WHERE product_id=? AND status='current' ORDER BY version DESC LIMIT 1", [pid]);
  if (rows[0]) return 'v' + rows[0].version + ' — ' + rows[0].name;
  [rows] = await pdq("SELECT version, name, status FROM pd_formulations WHERE product_id=? ORDER BY version DESC LIMIT 1", [pid]);
  if (rows[0]) return 'v' + rows[0].version + ' — ' + rows[0].name + ' (' + rows[0].status + ')';
  return 'no formulation of record yet — nothing has been promoted at G4';
}

// "Next step · whose job" for one idea — faithful port of next_step() (inc/layout.php). rec = latest dev record (or null).
function pdNextStep(idea, rec) {
  const SLA = pd.GATE_SLA_DAYS, reason = idea.screen_reason;
  if (idea.stage === 'parked') return { who: '—', text: 'Parked — ' + (reason || 'good, not now') + '. It keeps its number and its reason forever.' };
  if (idea.stage === 'killed') return { who: '—', text: 'Closed — ' + (reason || 'the reason is in the gate log') + '. Nothing is ever deleted.' };
  const lane = idea.lane || pd.lane_for(idea.change_type);
  if (idea.stage === 'proposed') {
    const who = pd.screener_for(lane)[2];
    return { who: lane === 'light' ? 'PD Lead' : 'COO', text: 'Awaiting the G1 screen — ' + who + ' decides LOG / PARK / CLOSE / RECLASSIFY, with a reason, inside ' + SLA + ' days.' };
  }
  if (idea.screen_decision === 'log' && !rec) return { who: 'QC Head', text: 'Screened LOG — next the QC Head opens a Development Record for the route.' };
  if (rec && !rec.approved_g2_at) {
    if (!rec.review_rta_at) return { who: 'Plant Manager', text: 'Dev Record open — it needs the Plant Manager’s technical review.', hash: '#record/' + rec.id };
    if (!rec.review_complete_by) return { who: 'Registrar', text: 'Needs the Custodian’s completeness check before G2.', hash: '#record/' + rec.id };
    return { who: 'COO / Plant Manager', text: 'Ready for G2 — the COO signs the design (or the Plant Manager on site, with the COO ratifying).', hash: '#record/' + rec.id };
  }
  const M = {
    designed: { who: 'Committee', text: 'G2 signed — next the committee opens the beaker gate (G3) in the Gate log. No sample may be made before it.', hash: '#gatelog' },
    sampled: { who: 'Lab / QC', text: 'Bench open — log samples and lab tests, then bring the runs to G4.', hash: '#samples' },
    tested: { who: 'Committee', text: 'Bench results are in — next G4: which run wins, read against the criteria written before the runs.', hash: '#gatelog' },
    evaluated: { who: 'Committee', text: 'Promoted at G4 — next G5, field-trial approval with a real DAP control.', hash: '#gatelog' },
    field_trial: { who: 'Agronomy', text: 'In field trials — climb the trial ladder, then G6.', hash: '#trials' },
    validated: { who: 'Production', text: 'Validated — hand to Production for costing, registration and launch (G6).', hash: '#formulations' },
  };
  return M[idea.stage] || { who: '', text: '' };
}

// Home: the intake-first front door — recent submissions (own for submitters, all for operators) + total.
app.get('/api/pd/home', auth, pdAuth, async (req, res) => {
  try {
    const isSubmitter = ['member', 'consultant'].includes(req.pdUser.pd_role);
    const [[tc]] = [(await pdq('SELECT COUNT(*) c FROM pd_hypotheses'))[0]];
    const sql = 'SELECT h.id, h.h_number, h.title, h.change_type, h.lane, h.stage, h.screen_decision, u.name submitter_name FROM pd_hypotheses h JOIN auth_users u ON u.id=h.submitted_by'
      + (isSubmitter ? ' WHERE h.submitted_by=?' : '') + ' ORDER BY h.h_number DESC LIMIT 15';
    const [rows] = await pdq(sql, isSubmitter ? [req.pdUser.id] : []);
    res.json({
      total: tc.c, isSubmitter,
      submissions: rows.map(r => ({ id: r.id, h_label: pd.fmt_h(r.h_number), title: r.title, submitter_name: r.submitter_name, change_type_label: pd.CHANGE_TYPES[r.change_type] || r.change_type, lane: r.lane, stage_label: pd.STAGES[r.stage], screen_decision: r.screen_decision })),
    });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// New-idea form data: products + open/being-addressed problems, for the two "link it to…" dropdowns.
app.get('/api/pd/idea-form', auth, pdAuth, pdSurface('ideas.new'), async (req, res) => {
  try {
    const [products] = await pdq('SELECT id, code, name FROM pd_products ORDER BY code');
    const [problems] = await pdq("SELECT id, p_number, title FROM pd_problems WHERE status IN ('open','being_addressed') ORDER BY p_number");
    res.json({ products, problems: problems.map(p => ({ id: p.id, label: pd.fmt_p(p.p_number) + ' — ' + p.title })) });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// Door 3 — challenge an existing product: the form data (products + their current version).
app.get('/api/pd/challenge', auth, pdAuth, async (req, res) => {
  try {
    const [products] = await pdq('SELECT id, code, name FROM pd_products ORDER BY code');
    const out = [];
    for (const p of products) out.push({ id: p.id, code: p.code, name: p.name, current: await pdCurrentVersion(p.id) });
    res.json({ products: out });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
// Submit a challenge — any PD role (open intake). Creates a light-lane 'challenge' idea linked to the product.
app.post('/api/pd/challenge', auth, pdAuth, async (req, res) => {
  try {
    const b = req.body || {};
    const title = String(b.title || '').trim(), text = String(b.challenge_text || '').trim(), pid = Number(b.product_id || 0);
    if (!title || !text || !pid) return res.status(400).json({ error: 'Pick the product, give the challenge a short title, and say what is wrong.' });
    const [[prod]] = [(await pdq('SELECT code, name FROM pd_products WHERE id=?', [pid]))[0]];
    if (!prod) return res.status(404).json({ error: 'That product no longer exists.' });
    const body = text + `\n\n[Challenge to ${prod.code} — current version at the time of writing: ${await pdCurrentVersion(pid)}]`;
    let newId = 0;
    const n = await pd.insert_numbered(pdq, 'pd_hypotheses', 'h_number', async (n) => {
      const [ins] = await pdq('INSERT INTO pd_hypotheses (h_number, title, change_type, lane, parent_product_id, idea_text, problem_text, submitted_by) VALUES (?,?,?,?,?,?,?,?)',
        [n, title, 'challenge', pd.lane_for('challenge'), pid, body, 'A fault or weakness in a product we already sell.', req.pdUser.id]);
      newId = ins.insertId;
    });
    // NOTE: the PHP app emails the light-lane screener here; notifications not yet ported.
    res.json({ ok: true, id: newId, h_label: pd.fmt_h(n) });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

/* ---------- PD · Loose ends: light-lane reversal, the pipeline board, current formulation ---------- */

// COO's light-lane reversal — a short veto, not a gate (faithful to hypothesis.php action=reverse).
app.post('/api/pd/ideas/:id/reverse', auth, pdAuth, pdSurface('ideas.own'), async (req, res) => {
  try {
    if (req.pdUser.pd_role !== 'coo') return res.status(403).json({ error: 'Reversing a light-lane screen is the COO’s.' });
    const reason = String((req.body && req.body.reason) || '').trim();
    if (!reason) return res.status(400).json({ error: 'A reversal carries a written reason too — the submitter and the PD Lead both read it.' });
    const [[h]] = [(await pdq('SELECT id, lane, screen_decision, screened_by, DATEDIFF(NOW(), screened_at) days FROM pd_hypotheses WHERE id=?', [req.params.id]))[0]];
    if (!h) return res.status(404).json({ error: 'Idea not found.' });
    if (h.lane !== 'light' || !h.screen_decision || h.days === null || Number(h.days) > pd.LIGHT_REVERSAL_DAYS) return res.status(409).json({ error: `The ${pd.LIGHT_REVERSAL_DAYS}-day reversal window has closed. Record a fresh gate decision instead — the history stays intact either way.` });
    const [[rev]] = [(await pdq("SELECT COUNT(*) c FROM pd_gate_decisions WHERE hypothesis_id=? AND gate='G1' AND decision='reverse'", [req.params.id]))[0]];
    if (rev.c > 0) return res.status(409).json({ error: 'This screen was already reversed once.' });
    await pdq("UPDATE pd_hypotheses SET stage='proposed', screen_decision='', screen_reason='', screened_by=NULL, screened_at=NULL WHERE id=?", [req.params.id]);
    await pdq("INSERT INTO pd_gate_decisions (hypothesis_id, gate, decision, reason, decided_by) VALUES (?,?,?,?,?)", [req.params.id, 'G1', 'reverse', reason, req.pdUser.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// Custodian tracker update — stage / priority / owner / next action / product / problem (hypothesis.php action=update).
app.post('/api/pd/ideas/:id/update', auth, pdAuth, pdSurface('ideas.own'), async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['custodian'])) return res.status(403).json({ error: 'Updating the tracker is the Custodian’s (or COO’s).' });
    const b = req.body || {};
    const stage = pd.STAGES[b.stage] ? b.stage : 'proposed';
    const prio = ['', 'high', 'medium', 'low'].includes(b.priority) ? b.priority : '';
    const n = k => (b[k] !== undefined && b[k] !== '' && b[k] !== null) ? Number(b[k]) : null;
    const [r] = await pdq('UPDATE pd_hypotheses SET stage=?, priority=?, next_action=?, owner_id=?, parent_product_id=?, problem_id=? WHERE id=?',
      [stage, prio, String(b.next_action || '').trim(), n('owner_id'), n('parent_product_id'), n('problem_id'), req.params.id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Idea not found.' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
// Comment on an idea (operators; discussion, never a gate reason). pd_comments target_type='hypothesis'.
app.post('/api/pd/ideas/:id/comment', auth, pdAuth, pdSurface('ideas.own'), async (req, res) => {
  try {
    const [[idea]] = [(await pdq('SELECT submitted_by FROM pd_hypotheses WHERE id=?', [req.params.id]))[0]];
    if (!idea) return res.status(404).json({ error: 'Idea not found.' });
    const isOperator = pd.may_see_all_ideas(req.pdUser.pd_role) && pd.can_pd(req.pdUser.pd_role, 'ideas.all');
    if (!isOperator && idea.submitted_by !== req.pdUser.id) return res.status(403).json({ error: 'Not your idea to comment on.' });
    const body = String((req.body && req.body.body) || '').trim();
    if (!body) return res.status(400).json({ error: 'Write something first.' });
    await pdq("INSERT INTO pd_comments (target_type, target_id, body, added_by) VALUES ('hypothesis',?,?,?)", [req.params.id, body, req.pdUser.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// The pipeline board — every idea grouped by stage, plus the "untouched 4+ weeks" list (faithful to index.php).
app.get('/api/pd/board', auth, pdAuth, pdSurface('ideas.all'), async (req, res) => {
  try {
    const [rows] = await pdq('SELECT id, h_number, title, stage, lane, priority, submitted_at, updated_at, DATEDIFF(NOW(), submitted_at) age_days FROM pd_hypotheses ORDER BY h_number');
    const [stale] = await pdq("SELECT id, h_number, title, stage, updated_at FROM pd_hypotheses WHERE stage NOT IN ('parked','killed','validated') AND updated_at < DATE_SUB(NOW(), INTERVAL 28 DAY) ORDER BY updated_at");
    res.json({
      items: rows.map(r => ({ id: r.id, h_label: pd.fmt_h(r.h_number), title: r.title, stage: r.stage, lane: r.lane, age_days: Number(r.age_days) })),
      stale: stale.map(s => ({ id: s.id, h_label: pd.fmt_h(s.h_number), title: s.title, stage_label: pd.STAGES[s.stage], updated_at: s.updated_at })),
      slaDays: pd.GATE_SLA_DAYS,
    });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

/* ---------- PD · Similar-idea check (the system's memory) + the public Drop box
   (faithful port of similar.php + dropbox.php). ---------- */

// "Have we seen this idea before?" — fulltext over past hypotheses, with a fate + advice per match.
app.get('/api/pd/similar', auth, pdAuth, async (req, res) => {
  try {
    const qtext = String(req.query.q || '').trim();
    const exclude = Number(req.query.exclude || 0);
    if (qtext.length < 6) return res.json({ matches: [] });
    const [rows] = await pdq(
      `SELECT id, h_number, title, stage, screen_decision, screen_reason, park_condition, change_type,
              MATCH(title, idea_text, problem_text, materials_text) AGAINST (? IN NATURAL LANGUAGE MODE) AS score
       FROM pd_hypotheses
       WHERE MATCH(title, idea_text, problem_text, materials_text) AGAINST (? IN NATURAL LANGUAGE MODE) AND id <> ?
       ORDER BY score DESC LIMIT 5`, [qtext, qtext, exclude]);
    const out = [];
    for (const r of rows) {
      if (Number(r.score) <= 0) continue;
      let fate = 'in process', advice = 'Talk to its owner before duplicating work.';
      if (r.stage === 'killed') { fate = 'KILLED'; advice = 'Killed before — reason: ' + (r.screen_reason || 'see its gate log') + '. Only resubmit if something material has changed.'; }
      else if (r.stage === 'parked') { fate = 'PARKED'; advice = 'Parked' + (r.park_condition ? ' — re-look condition: ' + r.park_condition : '') + '. It may be time to revive it instead of duplicating it.'; }
      else if (r.stage === 'validated') { fate = 'VALIDATED'; advice = 'This already exists as a proven result — consider proposing a VARIANT of it instead.'; }
      else if (r.stage === 'proposed') { fate = 'awaiting screen'; advice = 'A very similar idea is already waiting to be screened.'; }
      out.push({ id: r.id, label: pd.fmt_h(r.h_number) + ' — ' + r.title, stage: pd.STAGES[r.stage] || r.stage, fate, advice, score: Math.round(Number(r.score) * 10000) / 10000 });
    }
    res.json({ matches: out });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// PUBLIC — no login. Honeypot + per-IP rate limit (5/hour), mirroring dropbox.php's anti-junk.
app.post('/api/pd/dropbox', async (req, res) => {
  try {
    if (!pdq) return res.status(503).json({ error: 'PD is not available on this server.' });
    const b = req.body || {};
    if (String(b.website || '') !== '') return res.json({ ok: true }); // honeypot: pretend success, store nothing
    const name = String(b.name || '').trim(), text = String(b.text || '').trim(), contact = String(b.contact || '').trim();
    const src = pd.SOURCES[b.source] ? b.source : 'team';
    const ip = String(req.ip || (req.socket && req.socket.remoteAddress) || '').slice(0, 45);
    if (name.length < 2) return res.status(400).json({ error: 'Please give your name.' });
    if (text.length < 15) return res.status(400).json({ error: 'Please describe the idea or problem in a sentence or two.' });
    const [[rc]] = [(await pdq('SELECT COUNT(*) c FROM pd_dropbox WHERE ip=? AND created_at > NOW() - INTERVAL 1 HOUR', [ip]))[0]];
    if (rc.c >= 5) return res.status(429).json({ error: 'That is quite a few in one hour — please try again later or find the Registrar in person.' });
    await pdq('INSERT INTO pd_dropbox (name, contact, source, text, ip) VALUES (?,?,?,?,?)', [name.slice(0, 100), contact.slice(0, 120) || null, src, text.slice(0, 5000), ip]);
    // NOTE: the PHP app emails the Custodian on a new entry; notifications are not yet ported.
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// Triage (Registrar / COO): list, convert to an idea, or dismiss.
app.get('/api/pd/dropbox', auth, pdAuth, async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['custodian'])) return res.status(403).json({ error: 'Drop-box triage is the Registrar’s (Custodian/COO).' });
    const [rows] = await pdq(`SELECT d.*, u2.name handler, h.h_number FROM pd_dropbox d
        LEFT JOIN auth_users u2 ON u2.id=d.handled_by LEFT JOIN pd_hypotheses h ON h.id=d.converted_hypothesis_id
        ORDER BY FIELD(d.status,'new','converted','dismissed'), d.id DESC LIMIT 100`);
    res.json({ entries: rows.map(e => ({ ...e, source_label: pd.SOURCES[e.source] || e.source, h_label: e.h_number ? pd.fmt_h(e.h_number) : null })) });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/pd/dropbox/:id/dismiss', auth, pdAuth, async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['custodian'])) return res.status(403).json({ error: 'Drop-box triage is the Registrar’s (Custodian/COO).' });
    const [[e]] = [(await pdq("SELECT id FROM pd_dropbox WHERE id=? AND status='new'", [req.params.id]))[0]];
    if (!e) return res.status(404).json({ error: 'Entry not found or already handled.' });
    await pdq("UPDATE pd_dropbox SET status='dismissed', handled_by=?, handled_at=NOW() WHERE id=?", [req.pdUser.id, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/pd/dropbox/:id/convert', auth, pdAuth, async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['custodian'])) return res.status(403).json({ error: 'Drop-box triage is the Registrar’s (Custodian/COO).' });
    const title = String((req.body && req.body.title) || '').trim();
    if (!title) return res.status(400).json({ error: 'Give the idea a short title before converting.' });
    const [[e]] = [(await pdq("SELECT * FROM pd_dropbox WHERE id=? AND status='new'", [req.params.id]))[0]];
    if (!e) return res.status(404).json({ error: 'Entry not found or already handled.' });
    const ideatext = e.text + `\n\n[From the drop box — ${e.name}${e.contact ? ', ' + e.contact : ''}; source: ${pd.SOURCES[e.source] || e.source}. Logged by ${req.pdUser.name}.]`;
    let hid = 0;
    const n = await pd.insert_numbered(pdq, 'pd_hypotheses', 'h_number', async (n) => {
      const [ins] = await pdq('INSERT INTO pd_hypotheses (h_number, title, change_type, lane, idea_text, submitted_by) VALUES (?,?,?,?,?,?)', [n, title, 'new', pd.lane_for('new'), ideatext, req.pdUser.id]);
      hid = ins.insertId;
    });
    await pdq("UPDATE pd_dropbox SET status='converted', converted_hypothesis_id=?, handled_by=?, handled_at=NOW() WHERE id=?", [hid, req.pdUser.id, req.params.id]);
    res.json({ ok: true, h_label: pd.fmt_h(n) });
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
// Shared brand assets (VAN logo + horse-emblem trademark), used by the launcher and every module top bar.
// Cacheable — these are stable files; bump the filename if a logo ever changes.
app.use('/assets', express.static(path.join(__dirname, 'assets'), { maxAge: '7d', immutable: false }));
// Front door: the platform launcher.
app.get(['/', '/launcher', '/launcher.html'], (req, res) => { res.set('Cache-Control', _NOCACHE); res.sendFile(path.join(__dirname, 'launcher.html')); });
// Public drop box (no login) — must come before the /pd/* SPA route below.
app.get(['/drop', '/pd/drop'], (req, res) => { res.set('Cache-Control', _NOCACHE); res.sendFile(path.join(__dirname, 'pd', 'drop.html')); });
// PD app: /pd (must come before the O2S catch-all below, or it silently serves O2S instead — this bit us once already).
app.get(['/pd', '/pd/*'], (req, res) => { res.set('Cache-Control', _NOCACHE); res.sendFile(path.join(__dirname, 'pd', 'pd.html')); });
// O2S app: any other non-API path falls through to it.
app.get('*', (req, res) => { res.set('Cache-Control', _NOCACHE); res.sendFile(path.join(__dirname, 'index.html')); });

// migrateAuth runs BEFORE runPdMigration: the PD bootstrap step (inside runPdMigration)
// grants the seeded 'admin' row a PD role, which only works if that row already exists.
/* ---------- Platform migration: user_module_roles — the platform's authoritative user->module->role store ----------
   Additive. Creates the table and seeds it once from today's columns (auth_users.role -> o2s, auth_users.pd_role -> pd).
   Idempotent: PK (username, module) means re-runs and manual/admin edits are never overwritten. The legacy columns
   stay in place (dual-write) so O2S and PD keep reading them unchanged; this table is the platform's read model. */
async function runPlatformMigration() {
  if (!pdq) { console.log('Platform migration skipped — no DATABASE_URL (relational store needed).'); return; }
  await pdq(`CREATE TABLE IF NOT EXISTS user_module_roles (
    username VARCHAR(191) NOT NULL,
    module   VARCHAR(32)  NOT NULL,
    role     VARCHAR(64)  NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (username, module)
  )`);
  await pdq("INSERT IGNORE INTO user_module_roles (username, module, role) SELECT username, 'o2s', role FROM auth_users WHERE role IS NOT NULL AND role <> ''");
  try { await pdq("INSERT IGNORE INTO user_module_roles (username, module, role) SELECT username, 'pd', pd_role FROM auth_users WHERE pd_role IS NOT NULL"); } catch (e) { /* pd_role column not present yet */ }
  // is_admin: marks a grant as a SUBSYSTEM ADMIN of that module (can manage roles within it).
  // Additive + idempotent — error 1060 (duplicate column) on re-run is expected and ignored.
  try { await pdq("ALTER TABLE user_module_roles ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0"); } catch (e) { if (e && e.errno !== 1060) console.log('is_admin column add skipped: ' + e.message); }
  try { const [c] = await pdq('SELECT COUNT(*) AS n FROM user_module_roles'); console.log('Platform migration: user_module_roles ready (' + (c[0] ? c[0].n : '?') + ' rows).'); } catch (e) {}
}

store.init().then(migrateAuth).then(runPdMigration).then(runPlatformMigration).then(() => app.listen(PORT, () => console.log('VAN Order Control Tower on port ' + PORT)));
