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
/* FIX C5 — a malformed body used to return the framework's HTML stack trace, complete with server
   file paths, to anyone — including unauthenticated callers on /api/login. */
app.use((err, req, res, next) => {
  if (!err) return next();
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'That is too large to upload here.' });
  if (err instanceof SyntaxError || err.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request could not be read.' });
  return next(err);
});

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

/* FIX C1 — sign-in throttle. Ten failures per username per fifteen minutes, then a cool-off.
   In-memory is deliberate: one process, and a restart clearing it is an acceptable trade. */
const LOGIN_MAX = 10, LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginFails = new Map(); // username -> { n, first }
function loginBlockedFor(u) {
  const e = loginFails.get(u);
  if (!e) return 0;
  if (Date.now() - e.first > LOGIN_WINDOW_MS) { loginFails.delete(u); return 0; }
  return e.n >= LOGIN_MAX ? Math.ceil((LOGIN_WINDOW_MS - (Date.now() - e.first)) / 60000) : 0;
}
function noteLoginFail(u) {
  const e = loginFails.get(u);
  if (!e || Date.now() - e.first > LOGIN_WINDOW_MS) loginFails.set(u, { n: 1, first: Date.now() });
  else e.n++;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of loginFails) if (now - v.first > LOGIN_WINDOW_MS) loginFails.delete(k); }, 60000).unref();

app.post('/api/login', async (req, res) => {
  try {
    const u = String((req.body && req.body.username) || '').trim().toLowerCase();
    const p = String((req.body && req.body.password) || '');
    const mins = loginBlockedFor(u);
    if (mins) return res.status(429).json({ error: 'Too many failed sign-ins for this account. Try again in about ' + mins + ' minute' + (mins === 1 ? '' : 's') + ', or ask the COO to reset the password.' });
    const usr = await store.getUser(u);
    if (!usr || !verifyPw(p, usr.pass_hash)) { noteLoginFail(u); return res.status(401).json({ error: 'Incorrect username or password' }); }
    loginFails.delete(u);
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
      pdRoleLabels: (pd && pd.PD_ROLES) || {}, // FIX D10: the Access screen showed raw keys (rta, qc_head, ...)
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

/* PD (Product Development) routes live in pd/pd-routes.js — mounted here so the
   /api/pd/* handlers register at the same point they used to (before the static
   and catch-all routes below). PD work happens in pd/, never in this file. */
require('./pd/pd-routes')(app, { pdq, auth, admin, pdAuth, pdSurface, pd, path, fs, crypto });

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
app.get('*', (req, res) => { res.set('Cache-Control', _NOCACHE); res.sendFile(path.join(__dirname, 'o2s', 'o2s.html')); });

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
