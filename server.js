const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
app.use(express.json({ limit: '15mb' }));

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
let store;

if (DATABASE_URL) {
  // Production: PostgreSQL (data persists across deploys)
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  store = {
    async init() {
      await pool.query('CREATE TABLE IF NOT EXISTS app_state (id int PRIMARY KEY, rev int NOT NULL DEFAULT 0, data text)');
      await pool.query('INSERT INTO app_state (id, rev, data) VALUES (1, 0, NULL) ON CONFLICT (id) DO NOTHING');
    },
    async get() {
      const r = await pool.query('SELECT rev, data FROM app_state WHERE id = 1');
      const row = r.rows[0] || { rev: 0, data: null };
      return { rev: row.rev, data: row.data ? JSON.parse(row.data) : null };
    },
    async set(d) {
      const r = await pool.query('UPDATE app_state SET rev = rev + 1, data = $1 WHERE id = 1 RETURNING rev', [JSON.stringify(d)]);
      return r.rows[0].rev;
    }
  };
  console.log('Storage: PostgreSQL');
} else {
  // Local/dev fallback: JSON file
  const FILE = path.join(__dirname, 'data', 'state.json');
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const read = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { return { rev: 0, data: null }; } };
  store = {
    async init() {},
    async get() { return read(); },
    async set(d) { const c = read(); const rev = (c.rev || 0) + 1; fs.writeFileSync(FILE, JSON.stringify({ rev, data: d })); return rev; }
  };
  console.log('Storage: local file (set DATABASE_URL for Postgres)');
}

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/api/state', async (req, res) => { try { res.json(await store.get()); } catch (e) { res.status(500).json({ error: String(e) }); } });
app.post('/api/state', async (req, res) => { try { res.json({ rev: await store.set(req.body) }); } catch (e) { res.status(500).json({ error: String(e) }); } });

// The app is a single self-contained file (no local assets) — serve it for every page route.
app.get('*', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.sendFile(path.join(__dirname, 'index.html'));
});

store.init().then(() => app.listen(PORT, () => console.log('VAN Order Control Tower on port ' + PORT)));
