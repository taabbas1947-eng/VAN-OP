/* O2S alerts on laptop and phone (Web Push). Tahir, 16 Oct 2026 (picture "O2S Notifications", version 3).
   Mounted by 1 guarded line in server.js (platform push 1). Everything O2S-specific about alerts lives here.

   Way 1  after a save: the saving screen sends the jobs its own save made (POST /api/o2s/push/jobs, mode 'save').
   Way 2  every 15 minutes: any open, up-to-date screen sends the full job list (mode 'sweep'); the server alerts
          what is new (jobs that came with the clock, and escalations) and closes what is gone.
   Never twice: 1 row per job and person while the job stays open (o2s_push_open). A job that leaves and comes back alerts again.
   The server decides who and what: each job name may go only to its own roles (JOB_ROLES); the text is built here from the
   saved data by record id; "from" is the person signed in. No screen can send its own words to anyone.
   Night: 10 pm to 7 am Pakistan time, alerts for office roles are held (o2s_push_held) and sent at 7 am as 1 summary per person.
   Production, Production Manager, QA Inspector and Warehouse get theirs at any hour.
   Tables: apps/o2s/migrations/O001_alerts.sql, applied by hand (local first, then live). Until they exist, everything here
   answers "not ready" and nothing else changes. Keys: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT on Render. */
'use strict';
const crypto = require('crypto');

/* Each job name and the roles it may go to (Today job list, System documentation LG-10). A name listed with null may go to
   any O2S role: its role is set when the job is made (the person who asked, the analyst named, the sample step). */
const JOB_ROLES = {
  'Acknowledge': ['Supply Chain'], 'PO sent back': null, 'Approve close short': ['Plant Manager'], 'Refused': null,
  'RM Check': ['Supply Chain'], 'PR refused': null, 'Approve PR': ['CFO'], 'Receive': ['Supply Chain'],
  'Stuck at packing': ['Supply Chain'], 'Pack from base': ['Production'], 'Open Production': ['Production'],
  'Pack QC': ['QA Inspector'], 'Add reason': ['Plant Manager'], 'Ship': ['Supply Chain'], 'Approve customer': ['CFO'],
  'Customer sent back': null, 'Approve move': ['Plant Manager'], 'Move refused': null, 'Check after move': ['Supply Chain'],
  'Duplicate number': ['Supply Chain'], 'Pack': ['Production'], 'Name a cover': ['Plant Manager'], 'Rework lot': ['Production'],
  'Assign sample': ['QCM'], 'Lab test': null, 'Lab late': ['Plant Manager'], 'Lab QC': ['Lab Rep'], 'Correct COA': ['Lab Rep'],
  'Review': ['AQCM', 'Plant Manager'], 'Approve': ['QCM'], 'Print price': ['Finance'], 'Load': ['Warehouse'],
  'Gate Pass': ['Warehouse'], 'Sent back': null, 'Review truck': ['Supply Chain', 'Warehouse'], 'Release': ['Plant Manager'],
  'Approve DC': ['Plant Manager'], 'Confirm delivery': null, 'Truck released': null, 'Inspect': ['QA Inspector'],
  'Truck came back': ['Plant Manager'],   /* 17a: Saad or Shoaib asks, the Plant Manager approves */
  'Correct': ['Supply Chain'], 'Re-inspect': ['Production Manager'], 'Close batch': ['Production'],
  'Reopened — check first': ['Production'], 'Approve batch fix': ['COO'], 'Reprint DC': ['Supply Chain'],
  'Reprint report': ['QA Inspector'], 'DC rejected': ['Supply Chain'], 'Truck failed': ['Supply Chain'],
  'Yield short': ['Plant Manager'], 'Big pack run': ['Production Manager'], 'Packed in 2 months': ['Production Manager'],
  /* 17c provisional release */ 'Release provisionally': ['AQCM', 'QCM'], 'Provisional lot UNFIT': ['Plant Manager'], 'Provisional lot referred': ['COO'],
  'Approve sample': null, 'Issue sample': null, 'Check sample': null, 'Sample gate pass': null, 'Review sample': null,
  'Release sample': null, 'Sample arrived': null, 'Sample feedback': null, 'Sample not approved': null,
  /* 16e complaints (Tahir 16 Oct: no alerts for his own complaint jobs). His jobs are listed with the Plant Manager only,
     so they alert the Plant Manager while Tahir is marked away (the job then carries the Plant Manager in alsoRoles) and never Tahir. */
  'Route complaint': ['Plant Manager'], 'Review complaint': ['Plant Manager'], 'Independent findings': ['Plant Manager'],
  'Resolve complaint': ['Plant Manager'], 'Close complaint': ['Plant Manager'], 'Reply to customer': ['Plant Manager'],
  'Complaint job to reassign': ['Plant Manager'], 'Complaint action past due': ['Plant Manager'], 'Check complaint action': ['Plant Manager'],
  'Test complaint fix': ['Plant Manager'], 'Complaint number repeats': ['Plant Manager'],
  'Contain complaint': ['Warehouse'], 'Lift complaint hold': ['Warehouse'], 'Contact customer': ['KAM', 'Supply Chain'],
  'Containment past due': ['Plant Manager'],
  /* the routed person and an action owner can hold any role but the COO (Tahir gets no alert for complaint jobs) */
  'Investigate complaint': ['KAM', 'Supply Chain', 'Supply Chain Officer', 'Production', 'Production Manager', 'Plant Manager', 'Warehouse', 'QA Inspector', 'Lab Rep', 'AQCM', 'QCM', 'CFO', 'Finance', 'Finance Desk Officer'],
  'Do complaint action': ['KAM', 'Supply Chain', 'Supply Chain Officer', 'Production', 'Production Manager', 'Plant Manager', 'Warehouse', 'QA Inspector', 'Lab Rep', 'AQCM', 'QCM', 'CFO', 'Finance', 'Finance Desk Officer'], 'Complaint raised': ['Plant Manager'], 'Complaint closed': ['Plant Manager']
};
/* Escalations: job name -> the only role it may escalate to (acEscalation in o2s.html). Lab test escalates to the QCM by the clock. */
const ESC_TO = {
  'Acknowledge': 'Plant Manager', 'RM Check': 'CFO', 'Receive': 'CFO', 'Lab QC': 'Plant Manager', 'Correct COA': 'QCM',
  'Assign sample': 'Plant Manager', 'Review': 'Plant Manager', 'Approve': 'Plant Manager', 'Pack QC': 'Plant Manager',
  'Inspect': 'Plant Manager', 'Ship': 'Supply Chain', 'Open Production': 'Plant Manager', 'Approve PR': 'COO',
  'Print price': 'COO', 'Load': 'Supply Chain', 'Gate Pass': 'Supply Chain', 'Review truck': 'Plant Manager', 'Release': 'COO',
  'Approve DC': 'COO', 'Truck came back': 'COO', 'Confirm delivery': 'Plant Manager', 'Approve move': 'COO', 'Approve close short': 'COO',
  'Pack': 'Production Manager', 'Pack from base': 'Plant Manager', 'Stuck at packing': 'COO', 'Check after move': 'Plant Manager',
  'Duplicate number': 'Plant Manager', 'Lab test': 'QCM'
};
const O2S_ROLES = ['COO', 'KAM', 'Supply Chain', 'Supply Chain Officer', 'Production', 'Production Manager', 'Plant Manager',
  'Warehouse', 'QA Inspector', 'Lab Rep', 'AQCM', 'QCM', 'CFO', 'Finance', 'Finance Desk Officer'];
const NIGHT_ANY_HOUR = ['Production', 'Production Manager', 'QA Inspector', 'Warehouse'];   /* Tahir 16 Oct: night-shift roles */
const SWEEP_EVERY_MS = 10 * 60 * 1000;   /* screens offer a list every 15 minutes; the server takes at most 1 per 10 minutes */
const TTL_SECONDS = 6 * 3600;            /* an alert waits at most 6 hours for a device that is off */
const MAX_JOBS = 2000, MAX_SAVE_JOBS = 100, MAX_SENDS_PER_MIN = 30;
/* push services a device address may point to (Chrome, Edge, Firefox, Safari); any other address is refused */
const PUSH_HOSTS = /^https:\/\/([a-z0-9-]+\.)*(fcm\.googleapis\.com|android\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com)(:\d+)?\//i;
const SEED_KEY = '__seeded__';

const sha = (s) => crypto.createHash('sha1').update(String(s)).digest('hex');
let NOW_FIXED = null;   /* tests only (_setNow) */
const nowMs = () => NOW_FIXED ? NOW_FIXED.getTime() : Date.now();
const pkt = (d) => new Date((d ? d.getTime() : nowMs()) + 5 * 3600 * 1000);   /* Pakistan time, no daylight saving */
function isNight(d) { const h = pkt(d).getUTCHours(); return h >= 22 || h < 7; }
const clip = (s, n) => { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

/* The alert text, built from the saved data by record id: job, product, PO, batch, from whom. No client name, no prices, no typed reasons. */
function alertText(data, j, fromName) {
  const ref = (j && j.ref) || {}, parts = [];
  const orders = (data && data.orders) || [];
  let po = '', product = '', batchNo = '';
  const o = ref.o ? orders.find(x => x && x.id === ref.o) : null;
  if (o) { po = o.po || ''; const l = ref.l ? (o.lines || []).find(x => x && (x.id === ref.l || x.brand === ref.l)) : null; if (l) product = l.brand || ''; }
  if (ref.b) { const b = ((data && data.batches) || []).find(x => x && x.id === ref.b); if (b) { batchNo = b.batchNo || ''; product = product || b.brand || b.base || ''; po = po || (b.kind === 'po' ? (b.po || '') : ''); } }
  if (ref.lot) { const p = ((data && data.packingLog) || []).find(x => x && x.id === ref.lot); if (p) { product = product || p.brand || ''; po = po || p.po || ''; batchNo = batchNo || p.brandBatchNo || ''; } }
  if (ref.d) { const s = ((data && data.shipments) || []).find(x => x && (x.dispId === ref.d || x.id === ref.d)); if (s) { product = product || s.brand || ''; po = po || s.po || ''; } }
  if (ref.s) { const sm = ((data && data.samples) || []).find(x => x && x.id === ref.s); if (sm) product = product || sm.product || sm.brand || ''; }
  let cmpNo = '';
  if (ref.cm) { const c = ((data && data.complaints) || []).find(x => x && x.id === ref.cm); if (c) { cmpNo = c.no || ''; product = product || (((c.items || [])[0] || {}).brand || ''); po = po || c.po || ''; } }   /* 16e: the complaint number, never the customer */
  if (cmpNo) parts.push(clip(cmpNo, 20));
  if (product) parts.push(clip(product, 60));
  if (po) parts.push('PO ' + clip(po, 30));
  if (batchNo) parts.push('batch ' + clip(batchNo, 30));
  if (fromName) parts.push('from ' + clip(fromName, 40));
  const title = (j.esc ? 'Escalated to you: ' : '') + j.l;
  return { title: clip(title, 80), body: clip(parts.join(' · ') || 'Open Today to see it.', 200) };
}

module.exports = function mountO2SAlerts(app, ctx) {
  const { store, pdq, auth, admin, services, express, path, fs } = ctx;
  let webpush = null;
  const PUB = process.env.VAPID_PUBLIC_KEY || '', PRIV = process.env.VAPID_PRIVATE_KEY || '', SUBJ = process.env.VAPID_SUBJECT || '';
  let keysOk = false;
  if (PUB && PRIV && SUBJ) { try { webpush = require('web-push'); webpush.setVapidDetails(SUBJ, PUB, PRIV); keysOk = true; } catch (e) { console.error('O2S alerts: keys not usable:', e && e.message); } }

  /* Static: the part that receives alerts while O2S is closed, the app name and icons for the Home Screen. */
  const DIR = __dirname;
  app.get('/o2s/sw.js', (req, res) => { res.set({ 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store', 'Service-Worker-Allowed': '/o2s' }); res.sendFile(path.join(DIR, 'sw.js')); });
  app.get('/o2s/manifest.json', (req, res) => { res.set({ 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'no-cache' }); res.sendFile(path.join(DIR, 'manifest.json')); });
  app.use('/o2s/icons', express.static(path.join(DIR, 'icons'), { maxAge: '7d' }), (req, res) => res.status(404).end());   /* a missing icon is 404, never the app page */

  /* Tables ready? Checked once a minute; until the 3 tables exist on this database every route says "not ready". */
  let tablesAt = 0, tablesOk = false;
  async function tablesReady() {
    if (!pdq) return false;
    if (Date.now() - tablesAt < 60000) return tablesOk;
    tablesAt = Date.now();
    try { await pdq('SELECT 1 FROM o2s_push_devices LIMIT 1'); await pdq('SELECT 1 FROM o2s_push_open LIMIT 1'); await pdq('SELECT 1 FROM o2s_push_held LIMIT 1'); tablesOk = true; }
    catch (e) { tablesOk = false; }
    return tablesOk;
  }
  async function ready() { return keysOk && !!pdq && await tablesReady(); }
  /* every route: an error answers {ok:false} and never stops the server (Express 4 does not catch async errors) */
  const wrap = (fn) => (req, res, next) => Promise.resolve().then(() => fn(req, res, next)).catch((e) => {
    console.error('O2S alerts:', req.path, e && e.message);
    if (!res.headersSent) res.status(200).json({ ok: false, error: 'Alerts could not do that just now.' });
  });
  const role = (req) => String((req.user && req.user.r) || '');
  const me = (req) => String((req.user && req.user.u) || '').toLowerCase();

  /* --- devices --- */
  async function devicesOf(username) {
    const [rows] = await pdq('SELECT id, username, endpoint, p256dh, auth FROM o2s_push_devices WHERE username=?', [username]);
    return rows;
  }
  async function sendTo(dev, payload) {
    try {
      await webpush.sendNotification({ endpoint: dev.endpoint, keys: { p256dh: dev.p256dh, auth: dev.auth } }, JSON.stringify(payload), { TTL: TTL_SECONDS, urgency: 'high' });
      await pdq('UPDATE o2s_push_devices SET last_ok_at=NOW(), fails=0 WHERE id=?', [dev.id]).catch(() => {});
      return true;
    } catch (e) {
      const sc = e && e.statusCode;
      if (sc === 404 || sc === 410) await pdq('DELETE FROM o2s_push_devices WHERE id=?', [dev.id]).catch(() => {});   /* the device switched alerts off or reset its browser */
      else await pdq('UPDATE o2s_push_devices SET fails=fails+1 WHERE id=?', [dev.id]).catch(() => {});
      return false;
    }
  }
  async function deliver(username, recRole, payload) {
    if (isNight() && NIGHT_ANY_HOUR.indexOf(recRole) < 0) {
      await pdq('INSERT INTO o2s_push_held (username, title, created_at) VALUES (?,?,NOW())', [username, clip(payload.t, 120)]);
      return 'held';
    }
    const devs = await devicesOf(username);
    let n = 0; for (const d of devs) if (await sendTo(d, payload)) n++;
    return n ? 'sent' : 'no device';
  }

  /* 7 am: the night's held alerts, 1 summary per person. Runs every minute; also after a restart. */
  let releasing = false;
  async function releaseHeld() {
    if (releasing || !(await ready().catch(() => false)) || isNight()) return;
    releasing = true;
    try {
      const [rows] = await pdq('SELECT id, username, title FROM o2s_push_held ORDER BY id LIMIT 5000');
      const by = {};
      rows.forEach(r => { (by[r.username] = by[r.username] || { ids: [], t: {}, top: 0 }); by[r.username].ids.push(r.id); by[r.username].top = Math.max(by[r.username].top, +r.id); by[r.username].t[r.title] = (by[r.username].t[r.title] || 0) + 1; });
      for (const u of Object.keys(by)) {
        const x = by[u], n = x.ids.length;
        const body = Object.keys(x.t).map(k => k + (x.t[k] > 1 ? ' ' + x.t[k] : '')).join(', ');
        const devs = await devicesOf(u);
        for (const d of devs) await sendTo(d, { t: 'O2S: ' + n + ' new job' + (n === 1 ? '' : 's') + ' since 10 pm', b: clip(body, 200), tag: 'o2s-night', u: '/o2s' });
        await pdq('DELETE FROM o2s_push_held WHERE username=? AND id<=?', [u, x.top]);
      }
    } catch (e) { console.error('O2S alerts: 7 am summary failed:', e && e.message); }
    finally { releasing = false; }
  }
  setInterval(releaseHeld, 60000).unref();

  /* --- routes --- */
  app.get('/api/o2s/push/key', auth, wrap(async (req, res) => {
    const t = await tablesReady();
    res.json({ ready: keysOk && !!pdq && t, keys: keysOk, tables: t, publicKey: keysOk ? PUB : '' });
  }));

  app.post('/api/o2s/push/subscribe', auth, wrap(async (req, res) => {
    if (!(await ready())) return res.status(503).json({ error: 'Alerts are not ready yet.' });
    const s = (req.body && req.body.subscription) || {}, ep = String(s.endpoint || ''), k = s.keys || {};
    if (!PUSH_HOSTS.test(ep) || ep.length > 2000 || !k.p256dh || !k.auth) return res.status(400).json({ error: 'That device could not be switched on.' });
    const dev = clip((req.body && req.body.device) || '', 120);
    /* 1 browser = 1 row; whoever switches on last on that browser owns it */
    await pdq(`INSERT INTO o2s_push_devices (ep_hash, endpoint, p256dh, auth, username, device, created_at) VALUES (?,?,?,?,?,?,NOW())
      ON DUPLICATE KEY UPDATE endpoint=VALUES(endpoint), p256dh=VALUES(p256dh), auth=VALUES(auth), username=VALUES(username), device=VALUES(device), created_at=NOW(), fails=0`,
      [sha(ep), ep, clip(k.p256dh, 255), clip(k.auth, 255), me(req).slice(0, 150), dev]);
    res.json({ ok: true });
  }));

  app.post('/api/o2s/push/unsubscribe', auth, wrap(async (req, res) => {
    if (!(await ready().catch(() => false))) return res.json({ ok: true });
    const ep = String((req.body && req.body.endpoint) || '');
    if (ep) await pdq('DELETE FROM o2s_push_devices WHERE ep_hash=? AND username=?', [sha(ep), me(req)]);
    res.json({ ok: true });
  }));

  /* this browser: switched on for me? (another person may have switched it on last) */
  app.post('/api/o2s/push/mine', auth, wrap(async (req, res) => {
    if (!(await ready())) return res.json({ on: false });
    const ep = String((req.body && req.body.endpoint) || '');
    const [rows] = await pdq('SELECT username FROM o2s_push_devices WHERE ep_hash=?', [sha(ep)]);
    const owner = rows[0] && rows[0].username;
    /* someone else switched this browser on and now another person is signed in on it: it stops alerting the first person */
    if (owner && owner !== me(req)) { await pdq('DELETE FROM o2s_push_devices WHERE ep_hash=?', [sha(ep)]); return res.json({ on: false, released: true }); }
    res.json({ on: !!owner });
  }));

  app.post('/api/o2s/push/test', auth, wrap(async (req, res) => {
    if (!(await ready())) return res.status(503).json({ error: 'Alerts are not ready yet.' });
    const devs = await devicesOf(me(req));
    let n = 0; for (const d of devs) if (await sendTo(d, { t: 'O2S test alert', b: 'Alerts work on this device. Jobs that reach you will show like this.', tag: 'o2s-test', u: '/o2s' })) n++;
    res.json({ sent: n, devices: devs.length });
  }));

  /* who has alerts on (Back Office): the COO, the Plant Manager and the platform administrators */
  app.get('/api/o2s/push/people', auth, async (req, res, next) => {
    if (['COO', 'Plant Manager'].indexOf(role(req)) >= 0) return next();
    return admin(req, res, next);
  }, wrap(async (req, res) => {
    if (!(await ready())) return res.json({ ready: false, people: [] });
    const [held] = await pdq("SELECT r.username, a.name, r.role FROM user_module_roles r JOIN auth_users a ON a.username=r.username WHERE r.module='o2s' ORDER BY r.role, a.name");
    const [devs] = await pdq('SELECT username, device, last_ok_at FROM o2s_push_devices');
    const by = {}; devs.forEach(d => { (by[d.username] = by[d.username] || []).push({ device: d.device || '', lastOk: d.last_ok_at || null }); });
    let off = new Set(); try { const t = await pdq('SELECT username FROM auth_users WHERE COALESCE(active,1)=0'); off = new Set(t[0].map(r => r.username)); } catch (e) {}
    res.json({ ready: true, people: held.filter(h => !off.has(h.username)).map(h => ({ username: h.username, name: h.name || h.username, role: h.role, devices: by[h.username] || [] })) });
  }));

  /* the jobs */
  const sendLog = {};   /* per login: sends in the last minute */
  let lastSweep = 0;
  app.post('/api/o2s/push/jobs', auth, wrap(async (req, res) => {
    if (!(await ready())) return res.json({ ok: false, reason: 'not ready' });
    const mode = req.body && req.body.mode === 'sweep' ? 'sweep' : 'save';
    const u = me(req), now = nowMs();
    const lg = (sendLog[u] = (sendLog[u] || []).filter(t => now - t < 60000)); if (lg.length >= MAX_SENDS_PER_MIN) return res.status(429).json({ error: 'Too many at once.' }); lg.push(now);
    const jobs = Array.isArray(req.body && req.body.jobs) ? req.body.jobs.slice(0, mode === 'save' ? MAX_SAVE_JOBS : MAX_JOBS) : [];
    const [seededRow] = await pdq('SELECT 1 FROM o2s_push_open WHERE key_hash=? AND username=?', [sha(SEED_KEY), '__system__']);
    const seeded = seededRow.length > 0;
    if (mode === 'save' && !seeded) return res.json({ ok: true, skipped: 'waiting for the first list' });   /* until the first list records what is open, a save could look new when it is not */
    let startedAt = null;
    if (mode === 'sweep') {
      if (now - lastSweep < SWEEP_EVERY_MS) return res.json({ ok: true, skipped: 'recent' });
      const [[t0]] = await pdq('SELECT NOW() AS n');   /* taken first: rows a save opens while this list runs are never closed by it */
      startedAt = t0 && t0.n;
      const rev = await store.getRev();
      if (+req.body.rev !== +rev) return res.json({ ok: true, skipped: 'not up to date' });   /* a screen behind the server never decides */
      lastSweep = now;
    }
    /* the recipients: the job's own roles, the person it is addressed to, never notWho.
       In a save the person who saved is recorded (so the 15-minute list never alerts him later) but not alerted. */
    const holders = {}; let lookupFailed = false;
    async function holdersOfRole(r) { if (!holders[r]) holders[r] = await services.holdersOf('o2s', r).catch(() => { lookupFailed = true; return []; }); return holders[r]; }
    const wanted = [], seen = {};   /* {key, hash, username, role, j, self} */
    for (const j0 of jobs) {
      const j = { k: clip(j0 && j0.k, 480), l: String((j0 && j0.l) || ''), r: String((j0 && j0.r) || ''), w: String((j0 && j0.w) || '').toLowerCase(),
        a: Array.isArray(j0 && j0.a) ? j0.a.map(String) : [], n: Array.isArray(j0 && j0.n) ? j0.n.map(x => String(x).toLowerCase()) : [], esc: !!(j0 && j0.esc), ref: (j0 && typeof j0.ref === 'object' && j0.ref) || {} };
      if (!j.k || !Object.prototype.hasOwnProperty.call(JOB_ROLES, j.l)) continue;
      let roles;
      if (j.esc) { if (mode !== 'sweep' || ESC_TO[j.l] !== j.r) continue; roles = [j.r]; }
      else { const allowed = JOB_ROLES[j.l] || O2S_ROLES; roles = [j.r].concat(j.a).filter((r, i, s) => O2S_ROLES.indexOf(r) >= 0 && allowed.indexOf(r) >= 0 && s.indexOf(r) === i); }
      roles.sort((x, y) => (NIGHT_ANY_HOUR.indexOf(x) >= 0 ? 0 : 1) - (NIGHT_ANY_HOUR.indexOf(y) >= 0 ? 0 : 1));   /* a person in 2 of its roles: the any-hour role decides the night rule */
      for (const r of roles) {
        let hs = await holdersOfRole(r);
        if (j.w && !j.esc) hs = hs.filter(h => String(h.username).toLowerCase() === j.w);
        for (const h of hs) {
          const un = String(h.username).toLowerCase().slice(0, 150);
          if (j.n.indexOf(un) >= 0) continue;
          const hash = sha(j.k), id = hash + '|' + un;
          if (seen[id]) continue; seen[id] = 1;
          wanted.push({ key: j.k, hash, username: un, role: r, j, self: mode === 'save' && un === u });
        }
      }
    }
    /* what is open already: 1 read */
    const [openRows] = await pdq('SELECT key_hash, username, opened_at FROM o2s_push_open');
    const have = new Set(openRows.map(o => o.key_hash + '|' + o.username));
    const add = 'INSERT IGNORE INTO o2s_push_open (key_hash, username, job_key, opened_at) VALUES (?,?,?,NOW())';
    /* seed on the very first sweep: record what is open now, alert nothing */
    if (mode === 'sweep' && !seeded) {
      for (const w of wanted) if (!have.has(w.hash + '|' + w.username)) await pdq(add, [w.hash, w.username, w.key]);
      await pdq(add, [sha(SEED_KEY), '__system__', SEED_KEY]);
      return res.json({ ok: true, seeded: wanted.length });
    }
    /* new episodes only: INSERT IGNORE decides, so 2 screens at the same moment cannot both alert */
    const fresh = [];
    for (const w of wanted) {
      if (have.has(w.hash + '|' + w.username)) continue;
      const [r] = await pdq(add, [w.hash, w.username, w.key]);
      if (r && r.affectedRows === 1 && !w.self) fresh.push(w);
    }
    /* a sweep closes the episodes of jobs no longer open, so a job that comes back alerts again.
       Not when a people lookup failed: that would close jobs that are still open. */
    let closed = 0;
    if (mode === 'sweep' && !lookupFailed && startedAt) {
      const live = new Set(wanted.map(w => w.hash + '|' + w.username)); live.add(sha(SEED_KEY) + '|__system__');
      const gone = openRows.filter(o => !live.has(o.key_hash + '|' + o.username));
      for (const o of gone) { const [d] = await pdq('DELETE FROM o2s_push_open WHERE key_hash=? AND username=? AND opened_at<?', [o.key_hash, o.username, startedAt]); closed += (d && d.affectedRows) || 0; }
    }
    let sent = 0, held = 0;
    if (fresh.length) {
      const st = await store.getState().catch(() => ({}));
      const data = (st && st.data) || {};
      const fromName = mode === 'save' ? String((req.user && req.user.n) || '') : '';
      for (const w of fresh) {
        const tx = alertText(data, w.j, w.j.esc ? '' : fromName);
        const out = await deliver(w.username, w.role, { t: tx.title, b: tx.body, tag: w.hash.slice(0, 16), u: '/o2s' }).catch(() => 'failed');
        if (out === 'sent') sent++; else if (out === 'held') held++;
        await pdq('UPDATE o2s_push_open SET sent_at=NOW() WHERE key_hash=? AND username=?', [w.hash, w.username]).catch(() => {});
      }
    }
    res.json({ ok: true, fresh: fresh.length, sent, held, closed });
  }));

  /* tests only */
  module.exports._resetSweepClock = () => { lastSweep = 0; };
  module.exports._setNow = (d) => { NOW_FIXED = d || null; };
  module.exports._releaseHeld = releaseHeld;
  module.exports._resetTables = () => { tablesAt = 0; };
  console.log('O2S alerts mounted' + (keysOk ? '' : ' (keys not set: alerts are off)'));
};
module.exports.JOB_ROLES = JOB_ROLES;
module.exports.ESC_TO = ESC_TO;
module.exports.alertText = alertText;
module.exports.isNight = isNight;
