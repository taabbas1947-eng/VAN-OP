/* ============================================================================
 * PD (Product Development) routes.
 *
 * REBUILT 9 Sept 2026 — Tahir's decision that session: "take the old app down
 * now" rather than run it alongside the schema rebuild (docs/pd-model/
 * PENDING-DECISIONS.md; migration pd/migrations/002_pd_core_rebuild.sql).
 * "PD holds no real data" (settled 18 Aug 2026) is what made this safe.
 *
 * Everything below is what survives REUSE-RULES.md §2's whitelist, adapted
 * to compile against the new nine-object schema:
 *   - GET /api/pd/me                — trimmed to bare identity; the old
 *     landing/surfaces routing was built for screens (ideas board, gate log,
 *     ...) that no longer exist.
 *   - The Library (§2 item 2)       — kept whole, including its comment
 *     feature (pd_comments, narrowed not dropped — see the migration's own
 *     note). pinTargets()/resolvePin() are trimmed to the Problem case only:
 *     the old 'hypothesis' and 'project' pin targets pointed at tables this
 *     migration drops (pd_hypotheses, pd_projects have no place in the new
 *     model — MODEL.md's nine objects have no "project").
 *   - Drop box + triage (§2 item 3) — kept, adapted so a Registrar converts
 *     an entry into a Challenge, Observation, or Request (the three doors,
 *     MODEL.md §3) instead of into a Hypothesis. Tahir's decision, 9 Sept
 *     2026 session: triage targets are the three doors only — Problem stays
 *     a direct, internal action, never a triage outcome ("the three doors
 *     stay three").
 *   - GET /api/pd/similar (the old fulltext "have we seen this before?"
 *     check) is NOT ported. Tahir's decision, 9 Sept 2026 session: its
 *     purpose now lives only inside the Combination Bank's material
 *     duplicate detector (combination-bank/RULES.md §7), a separate, later
 *     build step — not as a standalone checker on this intake surface.
 *
 * Everything else that used to live here — idea intake, the two-lane G1
 * screen, the gate log, records/G2, samples, tests, trials, gates G3-G6,
 * candidates, projects, users admin here (platform already owns that),
 * regulatory, learnings, formulations — is deleted, not ported, per
 * REUSE-RULES.md §2: "Everything else in pd/ is opened only in order to
 * delete it." None of the banned vocabulary (hypothesis, route-as-object,
 * gate, G1-G6, dev_record, the old stage chain — REUSE-RULES.md §3)
 * reappears below under a new name.
 * ==========================================================================*/
module.exports = function mountPdRoutes(app, deps) {
  const { pdq, auth, pdAuth, pdSurface, pd, path, fs, crypto } = deps;

app.get('/api/pd/me', auth, pdAuth, (req, res) => {
  res.json({
    id: req.pdUser.id, username: req.pdUser.username, name: req.pdUser.name,
    pd_role: req.pdUser.pd_role, label: pd.PD_ROLES[req.pdUser.pd_role] || null,
    // ADDED 9 Sept 2026: the front end builds its own navigation from this
    // rather than second-guessing the role table. One source of truth for
    // "what may this person open", shared by the router and the screen.
    surfaces: pd.allowed_surfaces(req.pdUser.pd_role),
  });
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
// ADAPTED 9 Sept 2026 — trimmed to the Problem case only. The old 'hypothesis'
// and 'project' pin targets pointed at tables this migration drops; the new
// nine-object model has no "project" (MODEL.md §3), and an idea is now a
// Problem or nothing. pd_problems.p_number is the same column the old table
// had, so this needed no other change.
async function pinTargets() {
  const [probs] = await pdq('SELECT id, p_number, title FROM pd_problems ORDER BY p_number DESC');
  return {
    problems: probs.map(x => ({ value: 'problem:' + x.id, label: pd.fmt_p(x.p_number) + ' — ' + x.title })),
  };
}
async function resolvePin(p) {
  if (p.target_type !== 'problem') {
    // A pin from before today's rebuild (hypothesis/project) — that target no
    // longer exists in any form. Say so plainly rather than guessing.
    return { label: '(pinned to something this rebuild retired)', href: '' };
  }
  const [[r]] = [(await pdq('SELECT p_number, title FROM pd_problems WHERE id=?', [p.target_id]))[0]];
  return r ? { label: pd.fmt_p(r.p_number) + ' — ' + r.title, href: '#problems' } : { label: '(missing problem)', href: '' };
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
  } catch (e) { fail(res, e); }
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
    const m = String(b.pin || '').match(/^problem:(\d+)$/);
    if (m) await pdq('INSERT IGNORE INTO pd_library_pins (item_id, target_type, target_id, pinned_by) VALUES (?,?,?,?)', [newId, 'problem', Number(m[1]), req.pdUser.id]);
    res.json({ ok: true, l_label: pd.fmt_l(n) });
  } catch (e) { fail(res, e); }
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
  } catch (e) { fail(res, e); }
});
app.post('/api/pd/library/:id/pin', auth, pdAuth, pdSurface('library'), async (req, res) => {
  try { // FIX C3 — pinning is curation, not reading. Members and outside reviewers may read the library, not rearrange it.
    if (!pd.can_role(req.pdUser.pd_role, ['qc_head', 'rta', 'production', 'agronomy', 'custodian', 'lab_tech'])) return res.status(403).json({ error: 'Pinning reading to a problem is for the technical team.' });
    const m = String((req.body && req.body.pin) || '').match(/^problem:(\d+)$/);
    if (!m) return res.status(400).json({ error: 'Pick somewhere to pin it.' });
    await pdq('INSERT IGNORE INTO pd_library_pins (item_id, target_type, target_id, pinned_by) VALUES (?,?,?,?)', [req.params.id, 'problem', Number(m[1]), req.pdUser.id]);
    res.json({ ok: true }); } catch (e) { fail(res, e); }
});
app.post('/api/pd/library/:id/unpin', auth, pdAuth, pdSurface('library'), async (req, res) => {
  try { // FIX C3 — see /pin above.
    if (!pd.can_role(req.pdUser.pd_role, ['qc_head', 'rta', 'production', 'agronomy', 'custodian', 'lab_tech'])) return res.status(403).json({ error: 'Removing a pin is for the technical team.' });
    await pdq('DELETE FROM pd_library_pins WHERE id=? AND item_id=?', [Number((req.body && req.body.pin_id) || 0), req.params.id]); res.json({ ok: true }); }
  catch (e) { fail(res, e); }
});
app.post('/api/pd/library/:id/archive', auth, pdAuth, pdSurface('library'), async (req, res) => {
  try { if (!pd.can_role(req.pdUser.pd_role, ['custodian'])) return res.status(403).json({ error: 'Archiving a library item is the Data Custodian’s (or the COO’s).' });
    const reason = String((req.body && req.body.reason) || '').trim();
    if (!reason) return res.status(400).json({ error: 'Archiving carries a reason, like everything else here.' });
    const [r] = await pdq('UPDATE pd_library_items SET archived=1, archived_reason=? WHERE id=?', [reason, req.params.id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Not found.' });
    res.json({ ok: true }); } catch (e) { fail(res, e); }
});
app.post('/api/pd/library/:id/restore', auth, pdAuth, pdSurface('library'), async (req, res) => {
  try { if (!pd.can_role(req.pdUser.pd_role, ['custodian'])) return res.status(403).json({ error: 'Restoring a library item is the Data Custodian’s (or the COO’s).' });
    await pdq('UPDATE pd_library_items SET archived=0, archived_reason=NULL WHERE id=?', [req.params.id]); res.json({ ok: true }); }
  catch (e) { fail(res, e); }
});
app.post('/api/pd/library/:id/comment', auth, pdAuth, pdSurface('library'), async (req, res) => {
  try { const body = String((req.body && req.body.body) || '').trim();
    if (!body) return res.status(400).json({ error: 'Write something first.' });
    const [[it]] = [(await pdq('SELECT id FROM pd_library_items WHERE id=?', [req.params.id]))[0]];
    if (!it) return res.status(404).json({ error: 'Not found.' });
    await pdq("INSERT INTO pd_comments (target_type, target_id, body, added_by) VALUES ('library',?,?,?)", [req.params.id, body, req.pdUser.id]);
    res.json({ ok: true }); } catch (e) { fail(res, e); }
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
  } catch (e) { fail(res, e); }
});

/* ---------- PD · The public Drop box + Registrar triage (faithful-in-spirit
   port of dropbox.php). ADAPTED 9 Sept 2026: triage now converts an entry
   into a Challenge, Observation, or Request — the three doors (MODEL.md §3)
   — instead of into a Hypothesis, which no longer exists. Tahir's decision,
   9 Sept 2026 session: Problem stays a direct, internal-only action and is
   never a triage outcome ("the three doors stay three"). ---------- */

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
    if (rc.c >= 5) return res.status(429).json({ error: 'That is quite a few in one hour — please try again later or find the Data Custodian in person.' });
    await pdq('INSERT INTO pd_dropbox (name, contact, source, text, ip) VALUES (?,?,?,?,?)', [name.slice(0, 100), contact.slice(0, 120) || null, src, text.slice(0, 5000), ip]);
    // NOTE: the PHP app emails the Custodian on a new entry; notifications are not yet ported.
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

// Triage (Registrar / COO): list, convert to a Challenge/Observation/Request, or dismiss.
app.get('/api/pd/dropbox', auth, pdAuth, async (req, res) => {
  try {
    if (!mayTriage(req.pdUser.pd_role)) return res.status(403).json({ error: 'Drop-box triage is the Data Custodian’s, the Registrar’s or the COO’s.' });
    const [rows] = await pdq(`SELECT d.*, u2.name handler,
        ch.challenge_number, ob.observation_number, rq.request_number
      FROM pd_dropbox d
      LEFT JOIN auth_users u2 ON u2.id=d.handled_by
      LEFT JOIN pd_challenges ch ON d.converted_to_type='challenge' AND ch.id=d.converted_to_id
      LEFT JOIN pd_observations ob ON d.converted_to_type='observation' AND ob.id=d.converted_to_id
      LEFT JOIN pd_requests rq ON d.converted_to_type='request' AND rq.id=d.converted_to_id
      ORDER BY FIELD(d.status,'new','converted','dismissed'), d.id DESC LIMIT 100`);
    res.json({
      entries: rows.map(e => ({
        ...e, source_label: pd.SOURCES[e.source] || e.source,
        converted_label: e.converted_to_type === 'challenge' ? ('CH-' + String(e.challenge_number).padStart(3, '0'))
          : e.converted_to_type === 'observation' ? ('O-' + String(e.observation_number).padStart(3, '0'))
          : e.converted_to_type === 'request' ? ('REQ-' + String(e.request_number).padStart(3, '0'))
          : null,
      })),
    });
  } catch (e) { fail(res, e); }
});
app.post('/api/pd/dropbox/:id/dismiss', auth, pdAuth, async (req, res) => {
  try {
    if (!mayTriage(req.pdUser.pd_role)) return res.status(403).json({ error: 'Drop-box triage is the Data Custodian’s, the Registrar’s or the COO’s.' });
    const [[e]] = [(await pdq("SELECT id FROM pd_dropbox WHERE id=? AND status='new'", [req.params.id]))[0]];
    if (!e) return res.status(404).json({ error: 'Entry not found or already handled.' });
    await pdq("UPDATE pd_dropbox SET status='dismissed', handled_by=?, handled_at=NOW() WHERE id=?", [req.pdUser.id, req.params.id]);
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});
// Convert a drop-box entry into one of the three doors. Each door has its own
// required fields (MODEL.md §3), so the body shape depends on target_type —
// this does not silently default missing fields, the same discipline the old
// convert route used for an idea's title.
app.post('/api/pd/dropbox/:id/convert', auth, pdAuth, async (req, res) => {
  try {
    if (!mayTriage(req.pdUser.pd_role)) return res.status(403).json({ error: 'Drop-box triage is the Data Custodian’s, the Registrar’s or the COO’s.' });
    const b = req.body || {};
    const targetType = String(b.target_type || '');
    if (!['challenge', 'observation', 'request'].includes(targetType)) {
      return res.status(400).json({ error: 'Convert into a Challenge, an Observation, or a Request — pick which door this arrived through.' });
    }
    const [[e]] = [(await pdq("SELECT * FROM pd_dropbox WHERE id=? AND status='new'", [req.params.id]))[0]];
    if (!e) return res.status(404).json({ error: 'Entry not found or already handled.' });

    // Validate the per-type required fields BEFORE touching pd_dropbox's
    // status. Self-caught while fixing the race below: an earlier order
    // claimed the entry FIRST, so a request missing a required field
    // (e.g. no product_ref) would mark the entry 'converted' with nothing
    // actually created — stuck, unretriable, no object behind it.
    const productRef = String(b.product_ref || '').trim();
    if (targetType === 'challenge' && !productRef) return res.status(400).json({ error: 'A Challenge needs the product it is a complaint about.' });
    const requester = String(b.requester || e.name || '').trim(); // falls back to the drop-box submitter's own name
    const purpose = String(b.purpose || '').trim();
    const recipient = String(b.recipient || '').trim();
    if (targetType === 'request' && (!requester || !purpose || !recipient)) return res.status(400).json({ error: 'A Request needs a requester, a purpose, and a recipient.' });

    // Claim the entry BEFORE creating anything. A single UPDATE ... WHERE
    // status='new' is safe against two triagers (or a retried request) acting
    // on the same entry at once — only one can match the WHERE clause; the
    // other gets affectedRows=0 and is told someone beat them to it, instead
    // of both creating their own permanently-numbered record.
    const [claim] = await pdq("UPDATE pd_dropbox SET status='converted', handled_by=?, handled_at=NOW() WHERE id=? AND status='new'", [req.pdUser.id, req.params.id]);
    if (claim.affectedRows === 0) return res.status(409).json({ error: 'Someone else just triaged this entry.' });

    const provenance = `\n\n[From the drop box — ${e.name}${e.contact ? ', ' + e.contact : ''}; source: ${pd.SOURCES[e.source] || e.source}. Logged by ${req.pdUser.name}.]`;

    let newId = 0, numberLabel = '';
    if (targetType === 'challenge') {
      const n = await pd.insert_numbered(pdq, 'pd_challenges', 'challenge_number', async (n) => {
        const [ins] = await pdq(
          `INSERT INTO pd_challenges (challenge_number, product_ref, complaint_text, reported_by_name, reported_by_contact, source, logged_by)
           VALUES (?,?,?,?,?,?,?)`,
          [n, productRef, e.text + provenance, e.name, e.contact || null, e.source, req.pdUser.id]);
        newId = ins.insertId;
      });
      numberLabel = 'CH-' + String(n).padStart(3, '0');
    } else if (targetType === 'observation') {
      const n = await pd.insert_numbered(pdq, 'pd_observations', 'observation_number', async (n) => {
        const [ins] = await pdq(
          `INSERT INTO pd_observations (observation_number, text, origin, reported_by_name, logged_by)
           VALUES (?,?,'door',?,?)`,
          [n, e.text + provenance, e.name, req.pdUser.id]);
        newId = ins.insertId;
      });
      numberLabel = 'O-' + String(n).padStart(3, '0');
    } else {
      const n = await pd.insert_numbered(pdq, 'pd_requests', 'request_number', async (n) => {
        const [ins] = await pdq(
          `INSERT INTO pd_requests (request_number, requester, purpose, recipient, status, logged_by)
           VALUES (?,?,?,?,'unsorted',?)`,
          [n, requester, purpose + provenance, recipient, req.pdUser.id]);
        newId = ins.insertId;
      });
      numberLabel = 'REQ-' + String(n).padStart(3, '0');
    }

    // Fill in the pointer now that the object exists. If this fails or the
    // process dies between the claim above and here, the entry is left
    // status='converted' with converted_to_type/id still NULL — visible and
    // auditable (a Registrar sees a converted entry pointing at nothing) —
    // rather than silently duplicated, which is the failure mode this
    // ordering was chosen to avoid.
    await pdq("UPDATE pd_dropbox SET converted_to_type=?, converted_to_id=? WHERE id=?", [targetType, newId, req.params.id]);
    res.json({ ok: true, label: numberLabel });
  } catch (e) { fail(res, e); }
});


/* ============================================================================
 * PD · THE SCREENS MILESTONE, PART 1 — intake (the three doors), the Problem
 * register, and triage.  ADDED 9 Sept 2026.
 *
 * The rules these routes exist to satisfy, in the order they bind:
 *   MODEL.md §3            — the three doors, and what each one is.
 *   MODEL.md §5.1          — ONE intake screen; "no need to classify before it
 *                            saves — triage classifies."
 *   RECLASSIFICATION-RULES.md — the whole file. It is a rules file, not
 *                            advice. In particular: §2 (no reason is ever
 *                            required to refile), §3 (everything from the door
 *                            is `unsorted`, and that is the normal front of
 *                            the system, not a backlog of mistakes), §4 (what
 *                            is kept permanently), §5 (authorship never
 *                            transfers), §6 (the banned vocabulary), §7 (the
 *                            author's one message), §8 (what must never
 *                            exist), §10 (what a refiler can do).
 *
 * Three things a reader should not have to reverse-engineer:
 *
 * 1. WHY ONE ENDPOINT FOR THREE TABLES. The doors are three tables because
 *    their content genuinely differs (a Request has a recipient and a
 *    return-by date; a Challenge has the product being complained about). The
 *    PERSON does not have to know that. POST /api/pd/intake takes an optional
 *    `door`; when it is missing the entry is filed as an Observation with
 *    door_chosen = 0, which is the honest default (MODEL.md §3: "a result or
 *    material that arrived") and the only one of the three whose required
 *    fields the plain form can always fill.
 *
 * 2. WHY A MOVE CREATES A NEW ROW RATHER THAN UPDATING ONE. The three doors
 *    are separate tables, so "convert type" cannot be an UPDATE. The original
 *    row is kept forever (nothing in PD is deleted), pointed forward by
 *    converted_to_type/id, and every field it held is copied into
 *    pd_field_history as a snapshot before the move. RECLASSIFICATION-RULES.md
 *    §4's "the number never changes" is honoured the way §10's merge rule
 *    already honours it: the old number still resolves, and points at what the
 *    entry became. The new type issues its own number, exactly as §7's own
 *    example message shows ("Your entry is now Bet B-014").
 *
 * 3. WHAT IS DELIBERATELY ABSENT. There is no approval queue in front of
 *    intake, no accuracy score, no per-person grouping in any response, and no
 *    endpoint that answers "who files things wrongly" (§8). The history table
 *    names a person so a reader knows whom to ask — never so anyone can be
 *    counted.
 * ==========================================================================*/

const DOOR_TABLES = {
  challenge:   { table: 'pd_challenges',   numcol: 'challenge_number',   fmt: pd.fmt_ch,  textcol: 'complaint_text' },
  observation: { table: 'pd_observations', numcol: 'observation_number', fmt: pd.fmt_o,   textcol: 'text' },
  request:     { table: 'pd_requests',     numcol: 'request_number',     fmt: pd.fmt_req, textcol: 'purpose' },
};
const isDoor = t => Object.prototype.hasOwnProperty.call(DOOR_TABLES, t);

/* What a person sees when something fails underneath. The driver's own words
   were going straight to the screen — "Error: Data too long for column
   'title'", "Data truncated for column 'grade'" — which is unreadable, and
   puts three of RECLASSIFICATION-RULES.md §6's banned words (error, invalid,
   incorrect) into the interface by a route nobody wrote. The real text goes to
   the server log, where whoever is fixing it can read it. */
function fail(res, e, what) {
  try { console.error('PD ' + (what || 'route') + ' failed:', e && e.stack ? e.stack : String(e)); } catch (x) {}
  res.status(500).json({ error: 'That did not go through. Nothing was changed. Tell the Data Custodian what you were doing — the details are in the server log.' });
}
const mayTriage = role => pd.TRIAGE_ROLES.includes(role) || role === 'coo';
// Only a string (or a number) is text somebody typed. An object used to
// stringify to "[object Object]" and clear a minimum-length check — review
// found a `proven` claim whose whole content was that phrase.
const clean = (v, max) => ((typeof v === 'string' || typeof v === 'number') ? String(v) : '').trim().slice(0, max || 5000);
const dateOrNull = v => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '').trim()) ? String(v).trim() : null);

/* The real column widths from 002. Every value written to one of these
   columns is clamped to its own width, not to a generic 5000, so a long
   paste is shortened at the door instead of being refused by the database
   AFTER the change has already been written to the history table. Found by
   review, 9 Sept 2026: a 200-character product name produced a permanent
   history row describing a change that never happened. */
const WIDTHS = {
  product_ref: 120, buried_claim_text: 2000, complaint_text: 5000,
  reported_by_name: 120, reported_by_contact: 120,
  text: 5000, requester: 120, recipient: 120, purpose: 5000,
  // the spine's own columns (002): everything else on these tables is TEXT
  title: 200, approach: 5000, kill_criterion: 5000, expected: 5000, actual: 5000,
};
const fit = (f, v) => clean(v, WIDTHS[f] || 5000);

/* One row of the intake feed, in the words the screen shows. */
function doorRow(type, r) {
  const d = DOOR_TABLES[type];
  const label = d.fmt(r[d.numcol]);
  const headline = type === 'challenge'
    ? (r.product_ref ? r.product_ref + ' — ' + clean(r.complaint_text, 160) : clean(r.complaint_text, 160))
    : type === 'request'
      ? (r.requester + ' → ' + r.recipient)
      : clean(r.text, 160);
  return {
    type, id: r.id, label, headline,
    text: type === 'challenge' ? r.complaint_text : type === 'request' ? r.purpose : r.text,
    status: r.status, created_at: r.created_at,
    logged_by: r.logged_by, author: r.author_name || null,
    reported_by_name: r.reported_by_name || null,
    problem_id: r.problem_id, problem_label: r.problem_label || null,
    owner_id: r.owner_id, owner_name: r.owner_name || null,
    // `moved` rather than the pointer itself. RECLASSIFICATION-RULES.md §8.1
    // bans a per-person count of refilings "derivable ... by any screen the
    // system offers", and author + which-entries-were-moved, shipped together
    // on every triage load, is one groupBy away from exactly that. The screen
    // needs to know an entry has moved; it does not need to know whose it was
    // once it has.
    moved: !!r.converted_to_id,
    converted_to_type: r.converted_to_type, converted_to_id: r.converted_to_id,
    door_chosen: type === 'observation' ? !!r.door_chosen : true,
    is_system_generated: type === 'observation' ? !!r.is_system_generated : false,
    // What triage still needs from this item — shown as a plain sentence on the
    // card. Never phrased as something the author left out (§6).
    waiting_for: r.converted_to_id ? null
      : (!r.problem_id && !r.owner_id) ? 'Not yet filed against a problem, and no owner yet'
      : (!r.problem_id) ? 'Not yet filed against a problem'
      : (!r.owner_id) ? 'No owner yet'
      : null,
  };
}

/* Turn one history row into something a person can read.
   "owner id set to 10" becomes "given an owner — Maleeha".
   Fields the model cares about get a sentence; everything else gets its own
   name in words. Nothing here changes what is stored — pd_field_history stays
   exactly as written, because it cannot be rewritten (003's triggers) and
   should not be. This is presentation, at the last possible moment. */
const FIELD_WORDS = {
  problem_id: 'the problem it sits under', owner_id: 'its owner', status: 'its state',
  state: 'its state', triaged_by: 'who filed it', product_ref: 'the product it is about',
  complaint_text: 'what the complaint says', text: 'what it says', purpose: 'what it is for',
  requester: 'who asked', recipient: 'who it goes to', buried_claim_text: 'the claim underneath it',
  reported_by_name: 'who reported it', reported_by_contact: 'their contact',
  dispatch_date: 'the dispatch date', return_by: 'the date it is wanted by',
  title: 'its title', nature: 'what kind of question it is', due_date: 'its due date',
  approach: 'the approach', kill_criterion: 'the kill criterion', expected: 'what was expected',
  actual: 'what actually happened', closing_claim_id: 'the result that closed it',
  settled_reason: 'the answer', closed_reason: 'why it closed', converted_to_type: 'what it became',
  delivery_context_id: 'the context it is aimed through',
};
async function nameOf(table, id, col) {
  if (!id) return null;
  try { const [[r]] = [(await pdq(`SELECT ${col} v FROM ${table} WHERE id=?`, [Number(id)]))[0]]; return r ? r.v : null; }
  catch (e) { return null; }
}
async function readableValue(field, v) {
  if (v === null || v === undefined || v === '') return null;
  if (field === 'owner_id' || field === 'triaged_by') return await nameOf('auth_users', v, 'name');
  if (field === 'problem_id') {
    const [[r]] = [(await pdq('SELECT p_number, title FROM pd_problems WHERE id=?', [Number(v)]))[0]];
    return r ? pd.fmt_p(r.p_number) + ' — ' + r.title : null;
  }
  if (field === 'delivery_context_id') return await nameOf('pd_delivery_contexts', v, 'name');
  if (field === 'closing_claim_id') {
    const [[r]] = [(await pdq('SELECT claim_number FROM pd_claims WHERE id=?', [Number(v)]))[0]];
    return r ? pd.fmt_cl(r.claim_number) : null;
  }
  if (field === 'status' || field === 'state') {
    return pd.RUN_STATUSES[v] || pd.BET_STATUSES[v] || pd.QUESTION_STATES[v] || String(v);
  }
  if (field === 'nature') return pd.QUESTION_NATURES[v] || String(v);
  return String(v);
}
async function readableChange(h) {
  return {
    field_words: FIELD_WORDS[h.field] || h.field.replace(/_id$/, '').replace(/_/g, ' '),
    old_words: await readableValue(h.field, h.old_value),
    new_words: await readableValue(h.field, h.new_value),
  };
}

async function loadDoorRow(type, id) {
  const d = DOOR_TABLES[type];
  const [[r]] = [(await pdq(
    `SELECT x.*, au.name author_name, ow.name owner_name,
            CONCAT('P-', LPAD(p.p_number,2,'0'), ' — ', p.title) problem_label
       FROM ${d.table} x
       LEFT JOIN auth_users au ON au.id = x.logged_by
       LEFT JOIN auth_users ow ON ow.id = x.owner_id
       LEFT JOIN pd_problems p ON p.id = x.problem_id
      WHERE x.id = ?`, [id]))[0]];
  return r || null;
}

/* An item is 'triaged' once it has BOTH a Problem to sit under and an owner.
   Either alone leaves it in the intake feed with a plain line saying what is
   still open — RECLASSIFICATION-RULES.md §9's "if everything arrives unsorted
   and stays there, triage has no owner" is a signal the feed has to be able to
   show. pd_requests spells its live state 'open' rather than 'triaged'. */
function settledStatus(type, problemId, ownerId) {
  if (!problemId || !ownerId) return 'unsorted';
  return type === 'request' ? 'open' : 'triaged';
}

/* ---------- The intake screen's data ---------- */
app.get('/api/pd/intake', auth, pdAuth, pdSurface('intake'), async (req, res) => {
  try {
    const me = req.pdUser, triage = mayTriage(me.pd_role);
    /* No `notices` key: this route must never carry one. See the note further
       down — delivery is what marks a notice seen, and this screen shows none. */
    const out = { mine: [], feed: [], problems: [], people: [],
      /* The nine one-line definitions, so the screen can show what its own
         words mean where they are used (23 Sept 2026). Same text the refiling
         notices use, from one place. */
      definitions: pd.OBJECT_DEFINITIONS };

    for (const type of Object.keys(DOOR_TABLES)) {
      const d = DOOR_TABLES[type];
      const [rows] = await pdq(
        `SELECT x.*, au.name author_name, ow.name owner_name,
                CONCAT('P-', LPAD(p.p_number,2,'0'), ' — ', p.title) problem_label
           FROM ${d.table} x
           LEFT JOIN auth_users au ON au.id = x.logged_by
           LEFT JOIN auth_users ow ON ow.id = x.owner_id
           LEFT JOIN pd_problems p ON p.id = x.problem_id
          ORDER BY x.id DESC LIMIT 200`);
      for (const r of rows) {
        const row = doorRow(type, r);
        if (r.logged_by === me.id) out.mine.push(row);   // their own record, in full
        if (triage) {
          // See the note on `moved` in doorRow(): the author stays on rows the
          // moderator may still need to ask about, and comes off the ones that
          // have already been refiled.
          const feedRow = { ...row };
          if (feedRow.moved) { feedRow.author = null; feedRow.logged_by = null; }
          delete feedRow.converted_to_type; delete feedRow.converted_to_id;
          out.feed.push(feedRow);
        }
      }
    }
    const byNewest = (a, b) => new Date(b.created_at) - new Date(a.created_at);
    const byOldest = (a, b) => new Date(a.created_at) - new Date(b.created_at);
    // "Your entries" is a personal log — the thing you just wrote belongs on top.
    out.mine.sort(byNewest);
    /* The queue is the opposite: it is drained, not read, so the OLDEST entry
       goes at the top — it is the one most likely to have gone stale, and it is
       the one that sinks out of sight under a newest-first sort. Unsorted first
       because it is the front of the system, not a naughty list, and never
       grouped by who filed it (§8.4). The screen's own hint says "oldest first";
       until 10 Sept 2026 the sort said otherwise. */
    out.feed.sort((a, b) => (a.moved ? 1 : 0) - (b.moved ? 1 : 0)
      || (a.status === 'unsorted' ? 0 : 1) - (b.status === 'unsorted' ? 0 : 1)
      /* Entries written in the same second must still have ONE order, or the
         list reshuffles between loads. Falling back to the number within the
         series keeps it stable and still reads oldest-first. */
      || byOldest(a, b)
      || (a.type === b.type ? a.id - b.id : String(a.type).localeCompare(String(b.type))));
    out.feed = out.feed.slice(0, 120);

    const [probs] = await pdq(
      `SELECT p.id, p.p_number, p.title, p.kind, p.status, u.name author_name
         FROM pd_problems p LEFT JOIN auth_users u ON u.id = p.added_by
        ORDER BY p.p_number DESC`);
    out.problems = probs.map(p => ({
      id: p.id, label: pd.fmt_p(p.p_number) + ' — ' + p.title, title: p.title,
      kind: p.kind, kind_label: pd.PROBLEM_KINDS[p.kind], status: p.status, author: p.author_name,
    }));

    if (triage) {
      const [people] = await pdq("SELECT id, name, pd_role FROM auth_users WHERE pd_role IS NOT NULL AND active=1 ORDER BY name");
      out.people = people.map(p => ({ id: p.id, name: p.name, role_label: pd.PD_ROLES[p.pd_role] || p.pd_role }));
    }

    /* Notices are delivered by ONE route and marked seen by that same route:
       GET /api/pd/mywork, which is the only screen that renders them.
       RECLASSIFICATION-RULES.md §7 says the author sees one message once, and
       delivery is what marks it seen (an acknowledge button would be a second
       action). That only holds if the route that marks it is the route that
       shows it. This screen fetches on every route change and does not render
       notices, so returning them here would consume a message the author never
       saw. Fixed 10 Sept 2026 after a verification pass caught it. */

    out.doors = pd.DOORS; out.sources = pd.SOURCES; out.problemKinds = pd.PROBLEM_KINDS;
    out.caps = { triage };
    out.me = { id: me.id, name: me.name, role_label: pd.PD_ROLES[me.pd_role] || me.pd_role };
    res.json(out);
  } catch (e) { fail(res, e); }
});

/* ---------- One entry, through whichever door — or none ---------- */
app.post('/api/pd/intake', auth, pdAuth, pdSurface('intake'), async (req, res) => {
  try {
    const b = req.body || {}, me = req.pdUser;
    const text = clean(b.text, 5000);
    if (text.length < 15) {
      return res.status(400).json({ error: 'Write a sentence or two about it, so that whoever reads it later knows what you meant.' });
    }
    const source = pd.SOURCES[b.source] ? b.source : 'team';
    const reporter = clean(b.reported_by_name, 120) || me.name;
    const contact = clean(b.reported_by_contact, 120);

    // No door picked is a valid, ordinary answer, not a missing field.
    const door = isDoor(b.door) ? b.door : '';

    /* RECLASSIFICATION-RULES.md §3: classification is "never a gate on someone
       writing something down." So a door whose own field is missing does NOT
       refuse the entry — it saves as an Observation with door_chosen = 0, and
       what the person said it was is carried into the text so triage picks it
       up. Nothing a person writes is ever turned away for want of a field. */
    const intent = [];
    if (door === 'challenge' && !clean(b.product_ref, 120)) intent.push('They said this is a complaint about something we sell, without naming the product.');
    if (door === 'request' && !clean(b.recipient, 120)) intent.push('They said someone wants a sample made, without naming who it goes to.');
    const softDoor = intent.length ? '' : door;

    if (softDoor === 'challenge') {
      const productRef = fit('product_ref', b.product_ref);
      let newId = 0;
      const n = await pd.insert_numbered(pdq, 'pd_challenges', 'challenge_number', async (n) => {
        const [ins] = await pdq(
          `INSERT INTO pd_challenges (challenge_number, product_ref, complaint_text, buried_claim_text, reported_by_name, reported_by_contact, source, logged_by)
           VALUES (?,?,?,?,?,?,?,?)`,
          [n, productRef, text, fit('buried_claim_text', b.buried_claim_text) || null, reporter, contact || null, source, me.id]);
        newId = ins.insertId;
      });
      return res.json({ ok: true, type: 'challenge', id: newId, label: pd.fmt_ch(n) });
    }

    if (softDoor === 'request') {
      const requester = fit('requester', b.requester) || reporter;
      const recipient = fit('recipient', b.recipient);
      let newId = 0;
      const n = await pd.insert_numbered(pdq, 'pd_requests', 'request_number', async (n) => {
        const [ins] = await pdq(
          `INSERT INTO pd_requests (request_number, requester, purpose, recipient, dispatch_date, return_by, status, logged_by)
           VALUES (?,?,?,?,?,?,'unsorted',?)`,
          [n, requester, text, recipient, dateOrNull(b.dispatch_date), dateOrNull(b.return_by), me.id]);
        newId = ins.insertId;
      });
      return res.json({ ok: true, type: 'request', id: newId, label: pd.fmt_req(n) });
    }

    // Observation — chosen, the default when nobody classified, or the safe
    // landing place for a door whose own field was not filled in (above).
    const obsText = intent.length ? text + '\n\n[' + intent.join(' ') + ']' : text;
    let newId = 0;
    const n = await pd.insert_numbered(pdq, 'pd_observations', 'observation_number', async (n) => {
      const [ins] = await pdq(
        `INSERT INTO pd_observations (observation_number, text, origin, door_chosen, reported_by_name, logged_by)
         VALUES (?,?,'door',?,?,?)`,
        [n, obsText, door === 'observation' ? 1 : 0, reporter, me.id]);
      newId = ins.insertId;
    });
    res.json({ ok: true, type: 'observation', id: newId, label: pd.fmt_o(n),
      door_chosen: door === 'observation',
      note: intent.length ? intent[0] : null });
  } catch (e) { fail(res, e); }
});

/* ---------- One item, with everything that has happened to it ---------- */
app.get('/api/pd/intake/:type/:id', auth, pdAuth, pdSurface('intake'), async (req, res) => {
  try {
    const type = req.params.type;
    if (!isDoor(type)) return res.status(404).json({ error: 'Not found.' });
    const r = await loadDoorRow(type, req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found.' });

    const [hist] = await pdq(
      `SELECT h.*, u.name who FROM pd_field_history h JOIN auth_users u ON u.id = h.changed_by
        WHERE h.object_type = ? AND h.object_id = ? ORDER BY h.id`, [type, req.params.id]);
    for (const h of hist) Object.assign(h, await readableChange(h));
    const [moves] = await pdq(
      `SELECT m.*, mu.name mover, au.name original_author
         FROM pd_reclassifications m
         JOIN auth_users mu ON mu.id = m.moved_by
         JOIN auth_users au ON au.id = m.original_author_id
        WHERE (m.from_type = ? AND m.from_id = ?) OR (m.to_type = ? AND m.to_id = ?)
        ORDER BY m.id`, [type, req.params.id, type, req.params.id]);

    let becameLabel = null;
    if (r.converted_to_type && r.converted_to_id && isDoor(r.converted_to_type)) {
      const d = DOOR_TABLES[r.converted_to_type];
      const [[t]] = [(await pdq(`SELECT ${d.numcol} n FROM ${d.table} WHERE id=?`, [r.converted_to_id]))[0]];
      if (t) becameLabel = d.fmt(t.n);
    }

    res.json({
      item: doorRow(type, r), raw: r,
      became: becameLabel ? { type: r.converted_to_type, id: r.converted_to_id, label: becameLabel } : null,
      history: hist, moves,
      definition: pd.OBJECT_DEFINITIONS[type],
      caps: {
        triage: mayTriage(req.pdUser.pd_role),
        edit: mayTriage(req.pdUser.pd_role) || r.logged_by === req.pdUser.id,
      },
    });
  } catch (e) { fail(res, e); }
});

/* ---------- Editing the content of an entry ----------
   §4: "Content is editable. The record of what it was is not." The author may
   correct their own entry; the moderator group may edit any. Every changed
   field lands in pd_field_history first, and the table itself refuses to let
   that record be altered afterwards. */
app.post('/api/pd/intake/:type/:id/edit', auth, pdAuth, pdSurface('intake'), async (req, res) => {
  try {
    const type = req.params.type, b = req.body || {}, me = req.pdUser;
    if (!isDoor(type)) return res.status(404).json({ error: 'Not found.' });
    const r = await loadDoorRow(type, req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found.' });
    if (!(mayTriage(me.pd_role) || r.logged_by === me.id)) {
      return res.status(403).json({ error: 'This entry is someone else’s to edit. The Data Custodian, the Registrar or the COO can also change it.' });
    }
    // An entry that has been recorded as something else has a live copy
    // elsewhere; editing this row would leave the two saying different things.
    if (r.converted_to_id) return res.status(409).json({ error: 'This entry is now recorded as something else — open what it became and edit it there.' });
    const editable = {
      challenge:   ['product_ref', 'complaint_text', 'buried_claim_text', 'reported_by_name', 'reported_by_contact'],
      observation: ['text', 'reported_by_name'],
      request:     ['requester', 'purpose', 'recipient', 'dispatch_date', 'return_by'],
    }[type];
    const after = {};
    for (const f of editable) {
      if (!(f in b)) continue;
      const v = (f === 'dispatch_date' || f === 'return_by') ? dateOrNull(b[f]) : fit(f, b[f]);
      after[f] = v === '' ? null : v;
    }
    const required = { challenge: ['product_ref', 'complaint_text'], observation: ['text'], request: ['requester', 'purpose', 'recipient'] }[type];
    for (const f of required) if (f in after && !after[f]) return res.status(400).json({ error: `${f.replace(/_/g, ' ')} cannot be emptied — it is what the entry is.` });
    if (!Object.keys(after).length) return res.json({ ok: true, changed: 0 });

    const changed = await pd.record_changes(pdq, type, r.id, r, after, me.id, { note: clean(b.note, 2000) || null });
    if (changed) {
      const sets = Object.keys(after).map(f => `${f}=?`).join(', ');
      try {
        await pdq(`UPDATE ${DOOR_TABLES[type].table} SET ${sets} WHERE id=?`, [...Object.values(after), r.id]);
      } catch (e) {
        // The history was written first, on purpose, so that nothing can change
        // without its history. If the change itself is refused, say so in the
        // log rather than leaving a row claiming a change that never happened —
        // pd_field_history cannot be edited or deleted, by design.
        await pd.record_not_applied(pdq, type, r.id, after, me.id, 'The database refused this change, so the record still reads as it did.');
        throw e;
      }
    }
    res.json({ ok: true, changed });
  } catch (e) { fail(res, e); }
});

/* ---------- Filing an entry: which Problem it sits under, and who owns it ----------
   This is a filing act, not a judgement (§1), so it takes no reason and gives
   no feedback to the author. */
app.post('/api/pd/intake/:type/:id/file', auth, pdAuth, pdSurface('triage'), async (req, res) => {
  try {
    const type = req.params.type, b = req.body || {}, me = req.pdUser;
    if (!isDoor(type)) return res.status(404).json({ error: 'Not found.' });
    const r = await loadDoorRow(type, req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found.' });
    if (r.converted_to_id) return res.status(409).json({ error: 'This entry has already been moved to another type — open what it became.' });

    const after = {};
    if ('problem_id' in b) {
      const pid = Number(b.problem_id) || null;
      if (pid) {
        const [[p]] = [(await pdq('SELECT id FROM pd_problems WHERE id=?', [pid]))[0]];
        if (!p) return res.status(400).json({ error: 'That problem does not exist.' });
      }
      after.problem_id = pid;
    }
    if ('owner_id' in b) {
      const oid = Number(b.owner_id) || null;
      if (oid) {
        const [[u]] = [(await pdq('SELECT id FROM auth_users WHERE id=? AND pd_role IS NOT NULL', [oid]))[0]];
        if (!u) return res.status(400).json({ error: 'That person has no PD role yet, so nothing can be owned by them.' });
      }
      after.owner_id = oid;
    }
    if (!Object.keys(after).length) return res.status(400).json({ error: 'Nothing to file — pick a problem, an owner, or both.' });

    const problemId = 'problem_id' in after ? after.problem_id : r.problem_id;
    const ownerId = 'owner_id' in after ? after.owner_id : r.owner_id;
    after.status = settledStatus(type, problemId, ownerId);
    after.triaged_by = me.id;

    const changed = await pd.record_changes(pdq, type, r.id, r, after, me.id);
    const sets = Object.keys(after).filter(f => f !== 'status').map(f => `${f}=?`).join(', ');
    const settled = type === 'request' ? 'open' : 'triaged';
    try {
      // The status is computed from the row's OWN values inside the same
      // statement, not from the copy this request read a moment ago. Two
      // moderators filing the same entry at the same instant — one setting the
      // problem, the other the owner — used to leave it fully filled in but
      // still sitting in the queue, because each wrote a status derived from a
      // row that no longer existed. Found by review, 9 Sept 2026.
      await pdq(
        `UPDATE ${DOOR_TABLES[type].table}
            SET ${sets}, triaged_at=NOW(),
                status = IF(problem_id IS NOT NULL AND owner_id IS NOT NULL, ?, 'unsorted')
          WHERE id=?`,
        [...Object.keys(after).filter(f => f !== 'status').map(f => after[f]), settled, r.id]);
    } catch (e) {
      await pd.record_not_applied(pdq, type, r.id, after, me.id, 'The database refused this change, so the record still reads as it did.');
      throw e;
    }
    const [[now]] = [(await pdq(`SELECT status, problem_id FROM ${DOOR_TABLES[type].table} WHERE id=?`, [r.id]))[0]];

    /* RECLASSIFICATION-RULES.md §6's own table gives the wording for this act —
       "Refiled under Problem P-04" — and §7 says the author is told when their
       entry is refiled, in the same three parts. Filing under a Problem is the
       commonest refiling there is, so it is told the same way a type change is:
       what it is now, what that means, who did it. Nothing else. */
    if (after.problem_id && after.problem_id !== r.problem_id) {
      const [[prob]] = [(await pdq('SELECT p_number, title FROM pd_problems WHERE id=?', [after.problem_id]))[0]];
      if (prob && r.logged_by && r.logged_by !== me.id) {
        await pdq(`INSERT INTO pd_notices (recipient_id, headline, definition_text, moved_by, link_type, link_id)
                   VALUES (?,?,?,?,?,?)`,
          [r.logged_by, `Your entry is now filed under ${pd.fmt_p(prob.p_number)} — ${prob.title}.`,
           pd.OBJECT_DEFINITIONS.problem, me.id, type, r.id]);
      }
    }
    res.json({ ok: true, changed, status: now ? now.status : after.status });
  } catch (e) { fail(res, e); }
});

/* ---------- Moving an entry to a different door ----------
   §2: no reason, justification or explanation is ever required. §4: what it
   was is kept permanently. §5: authorship never transfers — logged_by is
   carried across, and the mover is recorded as the mover. §7: the author is
   told once, in three parts, with no advice attached. */
app.post('/api/pd/intake/:type/:id/move', auth, pdAuth, pdSurface('triage'), async (req, res) => {
  try {
    const from = req.params.type, b = req.body || {}, me = req.pdUser;
    const to = String(b.to_type || '');
    if (!isDoor(from)) return res.status(404).json({ error: 'Not found.' });
    if (!isDoor(to)) return res.status(400).json({ error: 'Move it to a Challenge, an Observation or a Request.' });
    if (from === to) return res.status(400).json({ error: 'It is already recorded as that.' });
    const r = await loadDoorRow(from, req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found.' });
    if (r.converted_to_id) return res.status(409).json({ error: 'This entry has already been moved — open what it became.' });
    // MODEL.md B16's system-authored Observation has no author to carry, and
    // every door table requires one. Say so plainly rather than letting the
    // database refuse it with its own words.
    if (!r.logged_by) return res.status(400).json({ error: 'This one was raised by the system rather than written by a person, so there is no author to carry across. It cannot be recorded as something else yet.' });

    const body = from === 'challenge' ? r.complaint_text : from === 'request' ? r.purpose : r.text;
    const fromLabel = DOOR_TABLES[from].fmt(r[DOOR_TABLES[from].numcol]);
    // §4: "Content that does not fit the new type is carried, not dropped."
    // The wording is continuity, never repair (§6).
    // Built from every field the destination has no column for, so a column
    // added later cannot be silently dropped the way dispatch_date and
    // reported_by_contact were until review caught them, 9 Sept 2026.
    const KEEPS = {
      challenge: ['product_ref', 'complaint_text', 'reported_by_name', 'reported_by_contact', 'source'],
      observation: ['text', 'reported_by_name'],
      request: ['requester', 'purpose', 'recipient', 'dispatch_date', 'return_by'],
    };
    const SAYS = {
      product_ref: 'product named at the time', buried_claim_text: 'claim underneath it',
      requester: 'asked for by', recipient: 'to go to', dispatch_date: 'was to be dispatched by',
      return_by: 'an answer was wanted by', reported_by_name: 'reported by',
      reported_by_contact: 'contact given', source: 'came in from',
    };
    const carried = [];
    for (const f of Object.keys(SAYS)) {
      if (KEEPS[to].includes(f)) continue;                 // it has a home in the new type
      if (f === 'source' && r[f] === 'team') continue;     // the default, not something a person wrote
      if (r[f] === null || r[f] === undefined || r[f] === '') continue;
      carried.push(SAYS[f] + ': ' + r[f]);
    }
    const carriedNote = carried.length ? `\n\n[Carried over from ${fromLabel} — ${carried.join('; ')}.]` : '';
    const text = body + carriedNote;

    /* Work out, and check, everything the new type needs BEFORE the claim
       below. Validating inside the branches meant a move that could not go
       ahead — a Challenge with no product named — still left the entry claimed
       and unmovable by anyone. Nothing is written until the move is known to
       be possible. */
    const wantProductRef = fit('product_ref', b.product_ref) || (from === 'challenge' ? r.product_ref : '');
    const wantRequester = fit('requester', b.requester) || (from === 'request' ? r.requester : (r.reported_by_name || ''));
    const wantRecipient = fit('recipient', b.recipient) || (from === 'request' ? r.recipient : '');
    if (to === 'challenge' && !wantProductRef) return res.status(400).json({ error: 'A Challenge names the product it is about — add that and it will move.' });
    if (to === 'request' && (!wantRequester || !wantRecipient)) return res.status(400).json({ error: 'A Request names who asked and who it goes to — add those and it will move.' });

    /* Claim the row BEFORE creating anything. Two moderators moving the same
       entry at the same instant used to each create their own permanently
       numbered record, one of which nothing pointed at and neither of which
       could be deleted — and the author got two notices about one entry.
       A single UPDATE ... WHERE converted_to_id IS NULL is what makes only one
       of them win; the drop-box convert route already worked this way.
       Found by review, 9 Sept 2026. */
    const [claim] = await pdq(
      `UPDATE ${DOOR_TABLES[from].table} SET converted_to_type=? WHERE id=? AND converted_to_id IS NULL AND converted_to_type IS NULL`,
      [to, r.id]);
    if (claim.affectedRows === 0) return res.status(409).json({ error: 'Someone else is moving this entry right now — open it again to see where it went.' });

    let newId = 0, newNum = 0;
    try {
    if (to === 'challenge') {
      const productRef = wantProductRef;
      newNum = await pd.insert_numbered(pdq, 'pd_challenges', 'challenge_number', async (n) => {
        const [ins] = await pdq(
          `INSERT INTO pd_challenges (challenge_number, product_ref, complaint_text, reported_by_name, reported_by_contact, source, status, problem_id, owner_id, logged_by, triaged_by, triaged_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,NOW())`,
          [n, productRef, text, r.reported_by_name || null, r.reported_by_contact || null, r.source || 'team',
           settledStatus('challenge', r.problem_id, r.owner_id), r.problem_id || null, r.owner_id || null, r.logged_by, me.id]);
        newId = ins.insertId;
      });
    } else if (to === 'request') {
      const requester = wantRequester, recipient = wantRecipient;
      newNum = await pd.insert_numbered(pdq, 'pd_requests', 'request_number', async (n) => {
        const [ins] = await pdq(
          `INSERT INTO pd_requests (request_number, requester, purpose, recipient, dispatch_date, return_by, status, problem_id, owner_id, logged_by, triaged_by, triaged_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,NOW())`,
          [n, requester, text, recipient, dateOrNull(b.dispatch_date), dateOrNull(b.return_by),
           settledStatus('request', r.problem_id, r.owner_id), r.problem_id || null, r.owner_id || null, r.logged_by, me.id]);
        newId = ins.insertId;
      });
    } else {
      newNum = await pd.insert_numbered(pdq, 'pd_observations', 'observation_number', async (n) => {
        const [ins] = await pdq(
          `INSERT INTO pd_observations (observation_number, text, origin, door_chosen, reported_by_name, status, problem_id, owner_id, logged_by, triaged_by, triaged_at)
           VALUES (?,?,'door',1,?,?,?,?,?,?,NOW())`,
          [n, text, r.reported_by_name || (from === 'request' ? r.requester : null), settledStatus('observation', r.problem_id, r.owner_id),
           r.problem_id || null, r.owner_id || null, r.logged_by, me.id]);
        newId = ins.insertId;
      });
    }
    } catch (e) {
      // The claim above is the only thing written so far. Release it so the
      // entry is not left pointing at a type it never became.
      await pdq(`UPDATE ${DOOR_TABLES[from].table} SET converted_to_type=NULL WHERE id=? AND converted_to_id IS NULL`, [r.id]);
      throw e;
    }
    const newLabel = DOOR_TABLES[to].fmt(newNum);

    const [recl] = await pdq(
      `INSERT INTO pd_reclassifications (from_type, from_id, original_author_id, original_filed_at, to_type, to_id, moved_by, definition_text, free_note)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [from, r.id, r.logged_by, r.created_at, to, newId, me.id, pd.OBJECT_DEFINITIONS[to], clean(b.note, 2000) || null]);
    const reclId = recl.insertId;

    // What it said at the moment it moved — kept, never overwritten (§4).
    await pd.snapshot_on_move(pdq, from, r.id, r, me.id, reclId,
      ['id', 'author_name', 'owner_name', 'problem_label', 'created_at', 'triaged_at']);
    // The old row keeps its number and points at what it became. The type half
    // was written by the claim above; this completes the pointer.
    await pdq(`UPDATE ${DOOR_TABLES[from].table} SET converted_to_type=?, converted_to_id=? WHERE id=?`, [to, newId, r.id]);

    await pd.notify_refiled(pdq, {
      recipientId: r.logged_by, movedById: me.id, newType: to, newLabel,
      linkType: to, linkId: newId, reclassificationId: reclId,
    });

    res.json({ ok: true, type: to, id: newId, label: newLabel, was: fromLabel });
  } catch (e) { fail(res, e); }
});

/* ---------- Undo ----------
   §10: "Any refiling is reversible. The undo is itself recorded, and needs no
   reason either." Nothing is deleted: the row created by the move keeps its
   number and now points back at the original, so both numbers still resolve. */
app.post('/api/pd/reclassifications/:id/undo', auth, pdAuth, pdSurface('triage'), async (req, res) => {
  try {
    const me = req.pdUser;
    const [[m]] = [(await pdq('SELECT * FROM pd_reclassifications WHERE id=? AND reversed=0', [req.params.id]))[0]];
    if (!m) return res.status(404).json({ error: 'Nothing to undo here.' });
    if (!isDoor(m.from_type) || !isDoor(m.to_type)) return res.status(400).json({ error: 'That move is not one this screen can undo.' });

    // Only unpick the pointer if it still points at THIS move's result.
    // Without the id in the WHERE clause, undoing a stale reclassification
    // silently cut the live one loose — leaving two records saying the same
    // thing and the original back in the queue. Found by review, 9 Sept 2026.
    const [rel] = await pdq(
      `UPDATE ${DOOR_TABLES[m.from_type].table} SET converted_to_type=NULL, converted_to_id=NULL WHERE id=? AND converted_to_id=?`,
      [m.from_id, m.to_id]);
    if (rel.affectedRows === 0) {
      return res.status(409).json({ error: 'This entry has moved on since then, so this step cannot be taken back on its own. Open where it is now.' });
    }
    await pdq(`UPDATE ${DOOR_TABLES[m.to_type].table} SET converted_to_type=?, converted_to_id=? WHERE id=?`, [m.from_type, m.from_id, m.to_id]);
    await pdq('UPDATE pd_reclassifications SET reversed=1, reversed_by=?, reversed_at=NOW() WHERE id=?', [me.id, m.id]);
    await pd.record_changes(pdq, m.from_type, m.from_id, { converted_to_type: m.to_type }, { converted_to_type: null }, me.id, { kind: 'undo', reclassification_id: m.id });
    // The author is told the same way they were told about the move: what it
    // is now, what that means, and who did it. No mention of a mistake (§6).
    const d = DOOR_TABLES[m.from_type];
    const [[back]] = [(await pdq(`SELECT ${d.numcol} n FROM ${d.table} WHERE id=?`, [m.from_id]))[0]];
    if (back) await pd.notify_refiled(pdq, {
      recipientId: m.original_author_id, movedById: me.id, newType: m.from_type,
      newLabel: d.fmt(back.n), linkType: m.from_type, linkId: m.from_id, reclassificationId: m.id,
    });
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

/* ---------- The Problem register ----------
   MODEL.md §3: "Registering a Problem (either kind) is a direct action, not a
   fourth door." Open to anyone with a PD role, exactly as the door is — §8.3
   forbids an approval queue in front of someone writing something down. */
app.get('/api/pd/problems', auth, pdAuth, pdSurface('intake'), async (req, res) => {
  try {
    const [rows] = await pdq(
      `SELECT p.*, u.name author_name,
              (SELECT COUNT(*) FROM pd_questions q WHERE q.problem_id = p.id) n_questions,
              (SELECT COUNT(*) FROM pd_challenges c WHERE c.problem_id = p.id AND c.converted_to_id IS NULL) n_challenges,
              (SELECT COUNT(*) FROM pd_observations o WHERE o.problem_id = p.id AND o.converted_to_id IS NULL) n_observations,
              (SELECT COUNT(*) FROM pd_requests r WHERE r.problem_id = p.id AND r.converted_to_id IS NULL) n_requests
         FROM pd_problems p LEFT JOIN auth_users u ON u.id = p.added_by
        ORDER BY p.p_number DESC`);
    res.json({
      problems: rows.map(p => ({ ...p, label: pd.fmt_p(p.p_number), kind_label: pd.PROBLEM_KINDS[p.kind] })),
      kinds: pd.PROBLEM_KINDS,
      caps: { close: mayTriage(req.pdUser.pd_role) },
    });
  } catch (e) { fail(res, e); }
});

/* ==========================================================================
 * A1 — every open Question, so a discipline can find its own work
 * (Tahir's ruling, 11 Sept 2026)
 *
 * WHY. "What I owe" is per-owner and RECLASSIFICATION-RULES.md §8.1 requires
 * it to stay that way. The side-effect nobody had looked at: a person could
 * not find work in their own discipline that somebody else happened to own.
 * A chemistry Question opened by an agronomist stayed with the agronomist
 * until a lead moved it, and the R&D Manager had no screen on which it
 * appeared. `nature` was required on every Question and then did nothing — it
 * was a label, not a way through.
 *
 * WHAT THIS IS NOT. It is not routing and it is not a default owner: a
 * nature→role prefill was considered the same day and rejected, because an
 * owner that is wrong but already filled in gets accepted by someone in a
 * hurry, and work that LOOKS assigned is worse than work that is visibly not.
 * The lead still assigns. This only makes the work findable.
 *
 * WHY IT READS NO PARAMETERS AT ALL. §8.1 again. The filtering is done on the
 * screen, over rows already sent, so there is no query string here to point at
 * a person — no author, no owner, nothing. A route that reads nothing cannot
 * be talked into grouping by anybody. `owner_name` is returned because a
 * reader needs to know who to ask, exactly as the dossier already shows it.
 *
 * It is not a fifth screen either: the list renders as a card on Problems.
 * ========================================================================== */
app.get('/api/pd/questions', auth, pdAuth, pdSurface('intake'), async (req, res) => {
  try {
    const [rows] = await pdq(
      `SELECT q.id, q.q_number, q.title, q.nature, q.state, q.due_date,
              p.id problem_id, p.p_number, p.title problem_title,
              u.name owner_name,
              (SELECT COUNT(*) FROM pd_bets b WHERE b.question_id=q.id AND b.status='active') open_bets
         FROM pd_questions q
         JOIN pd_problems p ON p.id = q.problem_id
         LEFT JOIN auth_users u ON u.id = q.owner_id
        WHERE q.state <> 'settled'
        ORDER BY (q.due_date IS NULL), q.due_date, q.q_number`);
    const today = new Date().toISOString().slice(0, 10);
    res.json({
      natures: pd.QUESTION_NATURES,
      questions: rows.map(q => ({
        id: q.id, label: pd.fmt_q(q.q_number), title: q.title,
        nature: q.nature, nature_label: pd.QUESTION_NATURES[q.nature] || q.nature,
        state_label: pd.QUESTION_STATES[q.state],
        due_date: q.due_date, late: !!q.due_date && q.due_date < today,
        open_bets: q.open_bets, owner_name: q.owner_name || null,
        problem_id: q.problem_id, problem_label: pd.fmt_p(q.p_number),
        problem_title: q.problem_title,
      })),
    });
  } catch (e) { fail(res, e, 'the open questions'); }
});

app.post('/api/pd/problems', auth, pdAuth, pdSurface('intake'), async (req, res) => {
  try {
    const b = req.body || {}, me = req.pdUser;
    const title = clean(b.title, 200), statement = clean(b.statement, 5000);
    const kind = pd.PROBLEM_KINDS[b.kind] ? b.kind : 'field_problem';
    if (title.length < 4) return res.status(400).json({ error: 'Give it a short title that will still be recognisable later.' });
    if (statement.length < 15) return res.status(400).json({ error: kind === 'product_concept' ? 'Say what the product is meant to do, in a sentence or two.' : 'Say what the problem actually is, in a sentence or two.' });
    let newId = 0;
    const n = await pd.insert_numbered(pdq, 'pd_problems', 'p_number', async (n) => {
      const [ins] = await pdq(
        'INSERT INTO pd_problems (p_number, title, statement, context, kind, added_by) VALUES (?,?,?,?,?,?)',
        [n, title, statement, clean(b.context, 5000) || null, kind, me.id]);
      newId = ins.insertId;
    });
    res.json({ ok: true, id: newId, label: pd.fmt_p(n) });
  } catch (e) { fail(res, e); }
});

app.post('/api/pd/problems/:id/close', auth, pdAuth, pdSurface('triage'), async (req, res) => {
  try {
    const b = req.body || {}, me = req.pdUser;
    const status = ['open', 'addressed', 'retired'].includes(b.status) ? b.status : null;
    if (!status) return res.status(400).json({ error: 'A problem is open, addressed, or retired.' });
    const reason = clean(b.closed_reason, 5000);
    if (status !== 'open' && !reason) return res.status(400).json({ error: 'Write what came of this Problem before closing it — pass, fail or parked, and why.' });
    const [[p]] = [(await pdq('SELECT * FROM pd_problems WHERE id=?', [req.params.id]))[0]];
    if (!p) return res.status(404).json({ error: 'Not found.' });
    const after = { status, closed_reason: status === 'open' ? null : reason };
    await pd.record_changes(pdq, 'problem', p.id, p, after, me.id);
    await pdq('UPDATE pd_problems SET status=?, closed_reason=? WHERE id=?', [after.status, after.closed_reason, p.id]);
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

/* ---------- The author's notices (RECLASSIFICATION-RULES.md §7) ---------- */
app.get('/api/pd/notices', auth, pdAuth, async (req, res) => {
  try {
    const [rows] = await pdq(
      `SELECT n.*, u.name mover FROM pd_notices n JOIN auth_users u ON u.id = n.moved_by
        WHERE n.recipient_id = ? ORDER BY n.id DESC LIMIT 50`, [req.pdUser.id]);
    res.json({ notices: rows });
  } catch (e) { fail(res, e); }
});
app.post('/api/pd/notices/:id/seen', auth, pdAuth, async (req, res) => {
  try {
    await pdq('UPDATE pd_notices SET seen_at=NOW() WHERE id=? AND recipient_id=? AND seen_at IS NULL', [req.params.id, req.pdUser.id]);
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});
/* "I meant something else" — returns to the mover as a question, not a
   complaint. §7: correction that cannot be answered is authority, not
   teaching. */
app.post('/api/pd/notices/:id/reply', auth, pdAuth, async (req, res) => {
  try {
    const text = clean((req.body || {}).reply_text, 2000);
    if (!text) return res.status(400).json({ error: 'Say what you meant — it goes back to the person who moved it.' });
    const [r] = await pdq('UPDATE pd_notices SET reply_text=?, replied_at=NOW(), seen_at=COALESCE(seen_at,NOW()) WHERE id=? AND recipient_id=?', [text, req.params.id, req.pdUser.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Not found.' });
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});
/* What the mover sees back: replies on moves they made. Not a queue of
   complaints and never counted — one list, oldest first, so a question does
   not sit unanswered. */
app.get('/api/pd/replies', auth, pdAuth, pdSurface('triage'), async (req, res) => {
  try {
    const [rows] = await pdq(
      `SELECT n.id, n.headline, n.reply_text, n.replied_at, n.link_type, n.link_id, u.name author
         FROM pd_notices n JOIN auth_users u ON u.id = n.recipient_id
        WHERE n.moved_by = ? AND n.reply_text IS NOT NULL ORDER BY n.replied_at`, [req.pdUser.id]);
    res.json({ replies: rows });
  } catch (e) { fail(res, e); }
});


/* ============================================================================
 * PD · THE SCREENS MILESTONE, PART 2 — the spine: Problem → Question → Bet →
 * Run, with the Claims that close them.  ADDED 9 Sept 2026.
 *
 * MODEL.md §0 states the two rules this whole subsystem exists to enforce:
 *
 *   "Nothing gets made until we have written the question it answers.
 *    Nothing gets closed until we have written the result — pass, fail, or
 *    parked, and why."
 *
 * The FIRST is structural, and deliberately not a check in a route: a Run
 * cannot exist without a Bet, a Bet cannot exist without a Question and a
 * written kill_criterion, a Question cannot exist without a Problem. All four
 * are NOT NULL foreign keys in 002, so there is no code path — here or in any
 * route written later — that can make something before its question exists.
 *
 * The SECOND cannot be a foreign key: "status is not 'active' implies
 * closing_claim_id IS NOT NULL" is a cross-table rule, and 002's own comment
 * flags it as an application-layer job so it is not silently skipped. It lives
 * in pd.close_refusal() and in the three close routes below, and the assertion
 * suite pins it. Closing anything here WRITES A CLAIM — the result is not a
 * free-text note on the thing being closed, it is a first-class, gradeable,
 * challengeable Claim, because MODEL.md §3 makes the Claim the atom.
 *
 * Who may do what (Tahir's ruling, 9 Sept 2026 — "open to write, restricted to
 * assign"): anyone with a PD role may OPEN a Question, a Bet or a Run and may
 * record a reading or a Claim. Naming somebody else the owner, settling a
 * Question, and closing a Bet or a Run are the technical leads' and the COO's
 * — except that the owner may always close their own. Gating who may propose
 * work is exactly what stops work being written down; gating who may commit
 * somebody else's time is not.
 * ==========================================================================*/

const SPINE = {
  question: { table: 'pd_questions', numcol: 'q_number', fmt: pd.fmt_q,
              editable: ['title', 'text', 'nature', 'due_date'],
              minimums: { title: 4, text: 10 },
              closedCol: 'state', closedIs: 'settled',
              closedSays: 'That question is settled. Its answer is a claim now — write a new claim, or revise the one that settled it. Changing the question underneath a settled answer leaves the two saying different things.' },
  bet:      { table: 'pd_bets', numcol: 'bet_number', fmt: pd.fmt_b,
              editable: ['approach', 'kill_criterion', 'delivery_context_id'],
              minimums: { approach: 10, kill_criterion: 10 },
              closedCol: 'status', closedIsNot: 'active',
              closedSays: 'That bet is closed. What it came to is a claim now — write a new claim rather than changing the bet underneath it.' },
  run:      { table: 'pd_runs', numcol: 'run_number', fmt: pd.fmt_run,
              editable: ['expected', 'actual'],
              minimums: { expected: 10, actual: 10 },
              closedCol: 'status', closedIs: 'closed',
              closedSays: 'That run is closed. What it showed is a claim now — write a new claim rather than changing what the run says it did.' },
};
const isSpine = t => Object.prototype.hasOwnProperty.call(SPINE, t);
const spineClosed = (type, row) => {
  const s2 = SPINE[type];
  return s2.closedIs ? row[s2.closedCol] === s2.closedIs : row[s2.closedCol] !== s2.closedIsNot;
};

/* Write the Claim that closes something. MODEL.md §0's second rule, and §3's
   "the atom": a result that cannot be graded and cannot be challenged is not a
   result, it is a note. Returns the new claim's id. */
async function writeClosingClaim(userId, { subjectType, subjectId, text, grade, sourceRef, runId }) {
  let claimId = 0;
  await pd.insert_numbered(pdq, 'pd_claims', 'claim_number', async (n) => {
    const [ins] = await pdq(
      `INSERT INTO pd_claims (claim_number, version, is_current, subject_type, subject_id, text, owner_id, grade, source_ref, run_id, created_by)
       VALUES (?,1,1,?,?,?,?,?,?,?,?)`,
      [n, subjectType, subjectId, text, userId, grade, sourceRef || null, runId || null, userId]);
    claimId = ins.insertId;
  });
  return claimId;
}

/* The whole of one Problem, and everything ever aimed at it — MODEL.md §5.3,
   Maleeha's question: "what have we already learned about a problem across
   every bet we have run against it." One screen, assembled here rather than
   left to the browser to stitch from six endpoints. */
app.get('/api/pd/problem/:id', auth, pdAuth, pdSurface('intake'), async (req, res) => {
  try {
    const me = req.pdUser, id = Number(req.params.id);
    const [[p]] = [(await pdq(
      `SELECT p.*, u.name author_name FROM pd_problems p LEFT JOIN auth_users u ON u.id=p.added_by WHERE p.id=?`, [id]))[0]];
    if (!p) return res.status(404).json({ error: 'Not found.' });

    const [questions] = await pdq(
      `SELECT q.*, o.name owner_name, c.name created_by_name
         FROM pd_questions q
         LEFT JOIN auth_users o ON o.id=q.owner_id
         LEFT JOIN auth_users c ON c.id=q.created_by
        WHERE q.problem_id=? ORDER BY q.q_number`, [id]);
    const qIds = questions.map(q => q.id);

    let bets = [], runs = [], readings = [], claims = [];
    if (qIds.length) {
      const qm = qIds.map(() => '?').join(',');
      [bets] = await pdq(
        `SELECT b.*, o.name owner_name, dc.name context_name,
                cl.text closing_text, cl.grade closing_grade, cl.claim_number closing_number
           FROM pd_bets b
           LEFT JOIN auth_users o ON o.id=b.owner_id
           LEFT JOIN pd_delivery_contexts dc ON dc.id=b.delivery_context_id
           LEFT JOIN pd_claims cl ON cl.id=b.closing_claim_id
          WHERE b.question_id IN (${qm}) ORDER BY b.bet_number`, qIds);
      const bIds = bets.map(b => b.id);
      if (bIds.length) {
        const bm = bIds.map(() => '?').join(',');
        [runs] = await pdq(
          `SELECT r.*, o.name owner_name, cl.text closing_text, cl.grade closing_grade,
                  pr.run_number replaced_number, cb.code combination_code
             FROM pd_runs r
             LEFT JOIN auth_users o ON o.id=r.owner_id
             LEFT JOIN pd_claims cl ON cl.id=r.closing_claim_id
             LEFT JOIN pd_runs pr ON pr.id=r.replaces_run_id
             LEFT JOIN pd_combinations cb ON cb.id=r.combination_id
            WHERE r.bet_id IN (${bm}) ORDER BY r.run_number`, bIds);
        const rIds = runs.map(r => r.id);
        if (rIds.length) {
          const rm = rIds.map(() => '?').join(',');
          [readings] = await pdq(
            `SELECT rd.*, u.name who FROM pd_run_readings rd JOIN auth_users u ON u.id=rd.recorded_by
              WHERE rd.run_id IN (${rm}) ORDER BY rd.reading_date, rd.id`, rIds);
        }
      }
      [claims] = await pdq(
        `SELECT c.*, o.name owner_name, w.name written_by_name, ch.claim_number challenges_number
           FROM pd_claims c
           LEFT JOIN auth_users o ON o.id=c.owner_id
           LEFT JOIN auth_users w ON w.id=c.created_by
           LEFT JOIN pd_claims ch ON ch.id=c.challenges_claim_id
          WHERE (c.subject_type='question' AND c.subject_id IN (${qm}))
             OR (c.subject_type='problem' AND c.subject_id=?)
          ORDER BY c.claim_number, c.version`, [...qIds, id]);
    } else {
      [claims] = await pdq(
        `SELECT c.*, o.name owner_name, w.name written_by_name, NULL challenges_number
           FROM pd_claims c
           LEFT JOIN auth_users o ON o.id=c.owner_id
           LEFT JOIN auth_users w ON w.id=c.created_by
          WHERE c.subject_type='problem' AND c.subject_id=? ORDER BY c.claim_number, c.version`, [id]);
    }

    /* What came in against this Problem — the intake side of the same story. */
    const filed = [];
    for (const type of Object.keys(DOOR_TABLES)) {
      const d = DOOR_TABLES[type];
      const [rows] = await pdq(
        `SELECT x.*, au.name author_name FROM ${d.table} x LEFT JOIN auth_users au ON au.id=x.logged_by
          WHERE x.problem_id=? AND x.converted_to_id IS NULL ORDER BY x.id DESC`, [id]);
      for (const r of rows) filed.push(doorRow(type, r));
    }

    const [contexts] = await pdq('SELECT id, name FROM pd_delivery_contexts ORDER BY id');
    const [constraints] = await pdq(
      `SELECT c.*, dc.name context_name, u.name added_by_name FROM pd_constraints c
         JOIN pd_delivery_contexts dc ON dc.id=c.delivery_context_id
         LEFT JOIN auth_users u ON u.id=c.added_by
        WHERE c.active=1 ORDER BY dc.id, c.id`);
    const [people] = await pdq("SELECT id, name, pd_role FROM auth_users WHERE pd_role IS NOT NULL AND active=1 ORDER BY name");

    const byRun = {};
    for (const rd of readings) (byRun[rd.run_id] = byRun[rd.run_id] || []).push(rd);

    res.json({
      problem: { ...p, label: pd.fmt_p(p.p_number), kind_label: pd.PROBLEM_KINDS[p.kind] },
      questions: questions.map(q => ({
        ...q, label: pd.fmt_q(q.q_number), state_label: pd.QUESTION_STATES[q.state],
        nature_label: pd.QUESTION_NATURES[q.nature],
        overdue: q.state !== 'settled' && q.due_date && q.due_date < new Date().toISOString().slice(0, 10),
        bets: bets.filter(b => b.question_id === q.id).map(b => ({
          ...b, label: pd.fmt_b(b.bet_number), status_label: pd.BET_STATUSES[b.status],
          // B7 — "the question the trial answers, and the result that would kill
          // it, ON the trial, not one click away." Carried down onto every Run
          // below for the same reason.
          question_title: q.title, question_label: pd.fmt_q(q.q_number),
          /* B2 (11 Sept 2026). A Bet inherits its own delivery context's
             constraints AND every plant-wide one, because what the plant can
             make binds a product however it is delivered. `plant_wide` is
             carried so the screen can say which is which — "inherited from
             fertigation" and "true of the plant whatever the context" are not
             the same sentence and must not read as one. */
          constraints: constraints.filter(c => c.delivery_context_id === b.delivery_context_id
              || c.delivery_context_id === pd.PLANT_WIDE_CONTEXT_ID)
            .map(c => ({ ...c, kind_label: pd.CONSTRAINT_KINDS[c.kind],
              plant_wide: c.delivery_context_id === pd.PLANT_WIDE_CONTEXT_ID })),
          runs: runs.filter(r => r.bet_id === b.id).map(r => ({
            ...r, label: pd.fmt_run(r.run_number), status_label: pd.RUN_STATUSES[r.status],
            question_title: q.title, kill_criterion: b.kill_criterion,
            readings: (byRun[r.id] || []).map(rd => ({ ...rd, verdict_label: pd.READING_VERDICTS[rd.verdict] })),
            next_observation: (byRun[r.id] || []).slice(-1).map(rd => rd.next_observation_date)[0] || null,
          })),
        })),
      })),
      /* One entry per claim NUMBER, carrying its current text and every
         version it has had. MODEL.md §6 — "versioned; never overwrite in
         place" — is only true of a screen if the earlier versions can be read
         from it. `written_by_name` is who typed THIS version, kept separate
         from `owner_name`, whose claim it is: review found a revision showing
         one person's words under another person's name. */
      claims: claims.filter(c => c.is_current).map(c => ({
        ...c, label: pd.fmt_cl(c.claim_number), grade_label: pd.CLAIM_GRADES[c.grade],
        history: claims.filter(h => h.claim_number === c.claim_number && !h.is_current)
          .map(h => ({ version: h.version, text: h.text, grade: h.grade, written_by_name: h.written_by_name, created_at: h.created_at })),
      })),
      filed,
      constraintRegister: constraints.map(c => ({
        id: c.id, context_id: c.delivery_context_id, context_name: c.context_name,
        kind: c.kind, kind_label: pd.CONSTRAINT_KINDS[c.kind] || c.kind,
        rule_text: c.rule_text, added_by_name: c.added_by_name || null, created_at: c.created_at,
      })),
      vocab: {
        natures: pd.QUESTION_NATURES, grades: pd.CLAIM_GRADES, verdicts: pd.READING_VERDICTS,
        betStatuses: pd.BET_STATUSES, contexts, constraintKinds: pd.CONSTRAINT_KINDS,
        plantWideId: pd.PLANT_WIDE_CONTEXT_ID,
      },
      people: people.map(x => ({ id: x.id, name: x.name, role_label: pd.PD_ROLES[x.pd_role] || x.pd_role })),
      caps: { lead: pd.is_lead(me.pd_role), me: me.id },
    });
  } catch (e) { fail(res, e); }
});

/* ---------- Search ---------------------------------------------------------
 * Tahir's ruling, 10 Sept 2026: search before the Combination Bank.
 *
 * WHY IT EXISTS. PD's whole promise is that a year from now somebody can ask
 * "did we ever try this, and what happened?" and get an answer. Until today
 * there was no way to ask. You could read a Problem's dossier if you already
 * knew which Problem it was — which is precisely what you do not know a year
 * later. An adoption audit called this the biggest single gap in the system
 * and it is hard to argue with: a memory you cannot query is a filing cabinet
 * in a locked room.
 *
 * WHY `LIKE` AND NOT FULLTEXT. This is the one design decision here worth
 * writing down, because the obvious choice is the wrong one. InnoDB's FULLTEXT
 * indexes drop every token shorter than `innodb_ft_min_token_size`, which is 3
 * by default and is a server-wide setting we do not control on HostGator. The
 * things this team actually searches for are chemistry: pH, N, P, K, Zn, B,
 * Fe, Mn, K2O, SOP, MAP, KOH, CRH, ULV. Half of those are one or two
 * characters. A fulltext search would silently return nothing for "pH" — not
 * an error, just an empty list — and people would conclude the system has no
 * memory rather than that the search has a token floor. There is also a
 * stopword list to fight and boolean-mode syntax to escape.
 *
 * `LIKE '%x%'` finds all of them, cannot be tripped by punctuation, and at
 * pilot scale — a few hundred rows per table — costs nothing. It will not
 * scale to a hundred thousand Runs. That is a real limit and it is the right
 * trade today: a search that finds "pH" beats a faster one that does not.
 * When the volume arrives, the fix is a proper index, not a rewrite of this.
 *
 * WHAT IT DOES NOT DO. There is no author filter and no way to search by
 * person, on purpose. RECLASSIFICATION-RULES.md §8.1 bans a per-person count
 * "derivable from the audit log by any screen the system offers", and a search
 * that takes an author is exactly such a screen. The route ignores every
 * parameter but `q`, and the test suite pins that.
 * ------------------------------------------------------------------------ */

/* One snippet, centred on the first match, so a person can see WHY a row came
   back without opening it. Never the whole field: some of these are 5,000
   characters and the list has to stay readable. */
function snippet(text, needle, width = 190) {
  const s = String(text || '');
  if (!s) return '';
  const i = s.toLowerCase().indexOf(String(needle).toLowerCase());
  if (i < 0) return s.length > width ? s.slice(0, width).trimEnd() + '…' : s;
  let start = Math.max(0, i - Math.floor(width / 3));
  let end = Math.min(s.length, start + width);
  /* Snap to word boundaries. "…e, so it should not drive ammonia" reads like
     a defect; "…so it should not drive ammonia" reads like a quotation. */
  if (start > 0) { const sp = s.indexOf(' ', start); if (sp > -1 && sp < i) start = sp + 1; }
  if (end < s.length) { const sp = s.lastIndexOf(' ', end); if (sp > start) end = sp; }
  return (start > 0 ? '…' : '') + s.slice(start, end).trim() + (end < s.length ? '…' : '');
}

/* MySQL's LIKE treats % and _ as wildcards and \ as an escape. A person
   searching for "50%" or "a_b" means those characters literally. */
const likeTerm = (q) => '%' + String(q).replace(/[\\%_]/g, c => '\\' + c) + '%';

app.get('/api/pd/search', auth, pdAuth, pdSurface('intake'), async (req, res) => {
  try {
    /* Only `q` is read. See the note above: no author parameter, ever. */
    const q = String(req.query.q || '').trim();
    if (q.length < 2) {
      return res.json({ q, results: [], groups: [], total: 0,
        hint: 'Type at least two characters. Short ones work — pH, K2O, SOP all find things.' });
    }
    const L = likeTerm(q);
    const hits = [];

    /* Every search is one pass per object, and each row carries the Problem it
       sits under so a result is never orphaned from its context. `field` says
       WHERE the match landed, which is what ranks it below. */
    const add = (rows, kind, cols, link) => {
      for (const r of rows) {
        let field = null, where = null;
        for (const c of cols) {
          if (r[c] && String(r[c]).toLowerCase().includes(q.toLowerCase())) { field = c; where = r[c]; break; }
        }
        hits.push({
          kind, id: r.id, label: r.label, title: r.title || null,
          /* A1 (11 Sept 2026). Questions, Bets and Runs carry the discipline of
             the Question they sit under, so results can be narrowed to one.
             Problems, Claims, entries and constraints have no discipline and
             carry null — the screen says so rather than pretending. */
          nature: r.nature || null, nature_label: r.nature_label || null,
          field, snippet: snippet(where, q),
          problem_id: r.problem_id || null, problem_label: r.problem_label || null,
          problem_title: r.problem_title || null,
          status: r.status_label || null, when: r.created_at || null,
          link: link(r),
        });
      }
    };

    const [problems] = await pdq(
      `SELECT id, p_number, title, statement, context, closed_reason, status, created_at
         FROM pd_problems
        WHERE title LIKE ? ESCAPE '\\\\' OR statement LIKE ? ESCAPE '\\\\'
           OR context LIKE ? ESCAPE '\\\\' OR closed_reason LIKE ? ESCAPE '\\\\'
        ORDER BY p_number DESC LIMIT 40`, [L, L, L, L]);
    add(problems.map(r => ({ ...r, label: pd.fmt_p(r.p_number), problem_id: r.id,
      problem_label: pd.fmt_p(r.p_number), problem_title: r.title })),
      'problem', ['title', 'statement', 'context', 'closed_reason'], r => '#problem/' + r.id);

    const [questions] = await pdq(
      `SELECT q.id, q.q_number, q.title, q.text, q.settled_reason, q.state, q.nature, q.created_at,
              p.id problem_id, p.p_number, p.title problem_title
         FROM pd_questions q JOIN pd_problems p ON p.id = q.problem_id
        WHERE q.title LIKE ? ESCAPE '\\\\' OR q.text LIKE ? ESCAPE '\\\\' OR q.settled_reason LIKE ? ESCAPE '\\\\'
        ORDER BY q.q_number DESC LIMIT 40`, [L, L, L]);
    add(questions.map(r => ({ ...r, label: pd.fmt_q(r.q_number), problem_label: pd.fmt_p(r.p_number),
      nature_label: pd.QUESTION_NATURES[r.nature],
      status_label: pd.QUESTION_STATES[r.state] })),
      'question', ['title', 'text', 'settled_reason'], r => '#problem/' + r.problem_id);

    const [bets] = await pdq(
      `SELECT b.id, b.bet_number, b.approach, b.kill_criterion, b.status, b.created_at, q.nature,
              p.id problem_id, p.p_number, p.title problem_title
         FROM pd_bets b JOIN pd_questions q ON q.id = b.question_id
         JOIN pd_problems p ON p.id = q.problem_id
        WHERE b.approach LIKE ? ESCAPE '\\\\' OR b.kill_criterion LIKE ? ESCAPE '\\\\'
        ORDER BY b.bet_number DESC LIMIT 40`, [L, L]);
    add(bets.map(r => ({ ...r, label: pd.fmt_b(r.bet_number), problem_label: pd.fmt_p(r.p_number),
      nature_label: pd.QUESTION_NATURES[r.nature],
      status_label: pd.BET_STATUSES[r.status] })),
      'bet', ['approach', 'kill_criterion'], r => '#problem/' + r.problem_id);

    const [runs] = await pdq(
      `SELECT r.id, r.run_number, r.expected, r.actual, r.replaces_reason, r.status, r.created_at, q.nature,
              p.id problem_id, p.p_number, p.title problem_title
         FROM pd_runs r JOIN pd_bets b ON b.id = r.bet_id
         JOIN pd_questions q ON q.id = b.question_id JOIN pd_problems p ON p.id = q.problem_id
        WHERE r.expected LIKE ? ESCAPE '\\\\' OR r.actual LIKE ? ESCAPE '\\\\' OR r.replaces_reason LIKE ? ESCAPE '\\\\'
        ORDER BY r.run_number DESC LIMIT 40`, [L, L, L]);
    add(runs.map(r => ({ ...r, label: pd.fmt_run(r.run_number), problem_label: pd.fmt_p(r.p_number),
      nature_label: pd.QUESTION_NATURES[r.nature],
      status_label: pd.RUN_STATUSES[r.status] })),
      'run', ['expected', 'actual', 'replaces_reason'], r => '#problem/' + r.problem_id);

    /* Readings are where an abnormal observation is actually written down —
       "white material settled at the bottom of the bottle" lives here, not on
       the Run. Searching without them would miss the single most useful
       sentence in the system. */
    const [readings] = await pdq(
      `SELECT rd.id, rd.parameters_checked, rd.physical_observation, rd.analytical_result,
              rd.reading_date created_at, r.run_number,
              p.id problem_id, p.p_number, p.title problem_title
         FROM pd_run_readings rd JOIN pd_runs r ON r.id = rd.run_id
         JOIN pd_bets b ON b.id = r.bet_id JOIN pd_questions q ON q.id = b.question_id
         JOIN pd_problems p ON p.id = q.problem_id
        WHERE rd.parameters_checked LIKE ? ESCAPE '\\\\' OR rd.physical_observation LIKE ? ESCAPE '\\\\'
           OR rd.analytical_result LIKE ? ESCAPE '\\\\'
        ORDER BY rd.id DESC LIMIT 40`, [L, L, L]);
    add(readings.map(r => ({ ...r, label: 'on ' + pd.fmt_run(r.run_number),
      problem_label: pd.fmt_p(r.p_number) })),
      'reading', ['physical_observation', 'analytical_result', 'parameters_checked'],
      r => '#problem/' + r.problem_id);

    /* Claims are the answers. Only the CURRENT version of each — an older,
       superseded wording turning up in a search would read as a live answer,
       which is the opposite of what versioning is for. The old version is
       still on the record, under the current one, where its context is. */
    /* A claim's subject is a Question or a Problem (nothing else), so one
       LEFT JOIN pair resolves both to the Problem it belongs under — the same
       shape the Report uses. */
    const [claims] = await pdq(
      `SELECT c.id, c.claim_number, c.text, c.source_ref, c.grade, c.created_at,
              p.id problem_id, p.p_number, p.title problem_title
         FROM pd_claims c
         LEFT JOIN pd_questions q ON c.subject_type = 'question' AND q.id = c.subject_id
         LEFT JOIN pd_problems p ON p.id = COALESCE(q.problem_id,
                    CASE WHEN c.subject_type = 'problem' THEN c.subject_id END)
        WHERE c.is_current = 1
          AND (c.text LIKE ? ESCAPE '\\\\' OR c.source_ref LIKE ? ESCAPE '\\\\')
        ORDER BY c.claim_number DESC LIMIT 40`, [L, L]);
    add(claims.map(r => ({ ...r, label: pd.fmt_cl(r.claim_number),
      problem_label: r.p_number ? pd.fmt_p(r.p_number) : null,
      status_label: pd.CLAIM_GRADES[r.grade] || r.grade })),
      'claim', ['text', 'source_ref'], r => r.problem_id ? '#problem/' + r.problem_id : '#problems');

    /* What came in. These are people's own words, often the only place a
       dealer's actual complaint is written down. */
    for (const type of Object.keys(DOOR_TABLES)) {
      const d = DOOR_TABLES[type];
      const cols = type === 'challenge' ? ['complaint_text', 'buried_claim_text', 'product_ref']
        : type === 'request' ? ['purpose', 'requester', 'recipient'] : ['text'];
      const where = cols.map(c => `x.${c} LIKE ? ESCAPE '\\\\'`).join(' OR ');
      const [rows] = await pdq(
        `SELECT x.*, p.id problem_id, p.p_number, p.title problem_title
           FROM ${d.table} x LEFT JOIN pd_problems p ON p.id = x.problem_id
          WHERE (${where}) AND x.converted_to_id IS NULL
          ORDER BY x.id DESC LIMIT 25`, cols.map(() => L));
      add(rows.map(r => ({ ...r, label: d.fmt(r[d.numcol]),
        problem_label: r.p_number ? pd.fmt_p(r.p_number) : null,
        status_label: r.problem_id ? null : 'not filed yet' })),
        type, cols, r => '#item/' + type + '/' + r.id);
    }

    const [constraints] = await pdq(
      `SELECT c.id, c.rule_text, c.kind, c.created_at, dc.name context_name
         FROM pd_constraints c JOIN pd_delivery_contexts dc ON dc.id = c.delivery_context_id
        WHERE c.active = 1 AND c.rule_text LIKE ? ESCAPE '\\\\'
        ORDER BY c.id DESC LIMIT 20`, [L]);
    add(constraints.map(r => ({ ...r, label: r.context_name + ' · ' + (pd.CONSTRAINT_KINDS[r.kind] || r.kind),
      status_label: 'a rule that kills options' })),
      'constraint', ['rule_text'], () => '#problems');

    /* Ranking, in words rather than a score. A match in something's TITLE or
       in the one sentence that says what it is beats a match buried in a body
       field, and an answer beats a question. Nobody can argue with 82%. */
    const KIND_RANK = { claim: 0, problem: 1, question: 2, bet: 3, run: 4, reading: 5,
      challenge: 6, observation: 7, request: 8, constraint: 9 };
    const NAMING = ['title', 'text', 'approach', 'rule_text', 'complaint_text', 'expected', 'physical_observation'];
    hits.sort((a, b) =>
      (NAMING.includes(a.field) ? 0 : 1) - (NAMING.includes(b.field) ? 0 : 1)
      || (KIND_RANK[a.kind] ?? 99) - (KIND_RANK[b.kind] ?? 99)
      || new Date(b.when || 0) - new Date(a.when || 0));

    const KIND_WORDS = {
      problem: 'Problem', question: 'Question', bet: 'Bet', run: 'Run',
      reading: 'Reading', claim: 'Claim', challenge: 'Challenge',
      observation: 'Observation', request: 'Request', constraint: 'Constraint',
    };
    const results = hits.slice(0, 60).map(h => ({
      ...h, kind_word: KIND_WORDS[h.kind] || h.kind,
      // Some Questions are written with the title and the body the same. Two
      // identical lines under each other reads as a rendering fault.
      snippet: (h.title && h.snippet && h.snippet.replace(/^…|…$/g, '').trim() === h.title.trim()) ? '' : h.snippet,
    }));

    /* A count per kind, so a person can see the shape of the answer before
       reading it — "four Runs and a Claim" is a different answer to "eleven
       things that came in". Counts of THINGS; never of people. */
    const groups = Object.keys(KIND_WORDS)
      .map(k => ({ kind: k, word: KIND_WORDS[k], n: hits.filter(h => h.kind === k).length }))
      .filter(g => g.n);

    res.json({ q, results, groups, total: hits.length, capped: hits.length > 60 });
  } catch (e) { fail(res, e, 'searching'); }
});

/* ---------- Constraints ----------------------------------------------------
 * MODEL.md §3's ninth object. Until 10 Sept 2026 it could be READ (a Bet shows
 * what its delivery context imposes) but never WRITTEN — every constraint in
 * the system arrived through a migration. Tahir's ruling that day: it is
 * written from inside the Problem dossier, next to the Bets that inherit it,
 * rather than from a fifth screen that would cross REUSE-RULES §5's tripwire.
 *
 * Leads only. This is the sharpest edge of "open to write, restricted to
 * assign": a constraint does not describe one trial, it removes options from
 * every product ever aimed through that delivery context. And it is retired
 * with a written reason rather than deleted, because a rule that used to bind
 * and no longer does is exactly the kind of thing people forget and re-argue.
 * ------------------------------------------------------------------------- */
app.post('/api/pd/constraints', auth, pdAuth, pdSurface('intake'), async (req, res) => {
  try {
    const b = req.body || {}, me = req.pdUser;
    if (!pd.is_lead(me.pd_role)) {
      return res.status(403).json({ error: 'A constraint binds every product aimed through that context, so writing one is a technical lead’s or the COO’s.' });
    }
    const ctxId = Number(b.delivery_context_id) || 0;
    const [[ctx]] = [(await pdq('SELECT id, name FROM pd_delivery_contexts WHERE id=?', [ctxId]))[0]];
    if (!ctx) return res.status(400).json({ error: 'Say what this binds: soil broadcast, side-dress band, fertigation, foliar, ULV drone, seed treatment — or plant-wide, for a rule about what we can actually make, which every Bet inherits whatever the context.' });
    const kind = pd.has(pd.CONSTRAINT_KINDS, b.kind) ? b.kind : '';
    if (!kind) return res.status(400).json({ error: 'Say what kind of rule it is: blending, storage / CRH, logistics / freight, regulatory, or what the plant can do.' });
    const rule = clean(b.rule_text, 5000);
    if (rule.length < 10) {
      return res.status(400).json({ error: 'Write the rule out. A constraint nobody can read is a constraint nobody will apply.' });
    }
    const [ins] = await pdq(
      'INSERT INTO pd_constraints (delivery_context_id, kind, rule_text, added_by) VALUES (?,?,?,?)',
      [ctx.id, kind, rule, me.id]);
    res.json({ ok: true, id: ins.insertId, context_name: ctx.name });
  } catch (e) { fail(res, e, 'writing a constraint'); }
});

app.post('/api/pd/constraints/:id/retire', auth, pdAuth, pdSurface('intake'), async (req, res) => {
  try {
    const b = req.body || {}, me = req.pdUser;
    if (!pd.is_lead(me.pd_role)) {
      return res.status(403).json({ error: 'Retiring a constraint is a technical lead’s or the COO’s.' });
    }
    const why = clean(b.retired_reason, 5000);
    if (why.length < 10) {
      return res.status(400).json({ error: 'Say why it no longer binds. A rule that quietly disappears gets re-argued next year.' });
    }
    /* Compare-and-swap on active=1: two people retiring the same constraint at
       once must not both write a reason over each other. */
    const [r] = await pdq(
      'UPDATE pd_constraints SET active=0, retired_reason=? WHERE id=? AND active=1',
      [why, req.params.id]);
    if (!r.affectedRows) return res.status(409).json({ error: 'That constraint has already been retired.' });
    res.json({ ok: true });
  } catch (e) { fail(res, e, 'retiring a constraint'); }
});

/* ---------- Questions ---------- */
app.post('/api/pd/questions', auth, pdAuth, pdSurface('intake'), async (req, res) => {
  try {
    const b = req.body || {}, me = req.pdUser;
    const [[p]] = [(await pdq('SELECT id FROM pd_problems WHERE id=?', [Number(b.problem_id) || 0]))[0]];
    if (!p) return res.status(400).json({ error: 'A Question belongs to a Problem — pick which one.' });
    const title = fit('title', b.title), text = clean(b.text, 5000);
    const nature = pd.has(pd.QUESTION_NATURES, b.nature) ? b.nature : '';
    if (title.length < 4) return res.status(400).json({ error: 'Give the question a short title.' });
    if (text.length < 10) return res.status(400).json({ error: 'Write the question out — what do we need to know?' });
    if (!nature) return res.status(400).json({ error: 'Say what kind of question it is: agronomy, chemistry, production, commercial or regulatory.' });
    // The person who writes it owns it until a lead moves it. Never nobody.
    let newId = 0;
    const n = await pd.insert_numbered(pdq, 'pd_questions', 'q_number', async (n) => {
      const [ins] = await pdq(
        `INSERT INTO pd_questions (q_number, problem_id, title, text, nature, owner_id, due_date, created_by)
         VALUES (?,?,?,?,?,?,?,?)`,
        [n, p.id, title, text, nature, me.id, dateOrNull(b.due_date), me.id]);
      newId = ins.insertId;
    });
    res.json({ ok: true, id: newId, label: pd.fmt_q(n) });
  } catch (e) { fail(res, e); }
});

app.post('/api/pd/questions/:id/settle', auth, pdAuth, pdSurface('intake'), async (req, res) => {
  try {
    const b = req.body || {}, me = req.pdUser;
    const [[q]] = [(await pdq('SELECT * FROM pd_questions WHERE id=?', [req.params.id]))[0]];
    if (!q) return res.status(404).json({ error: 'Not found.' });
    if (!(pd.is_lead(me.pd_role) || q.owner_id === me.id)) {
      return res.status(403).json({ error: 'Settling a question is its owner’s, or a technical lead’s.' });
    }
    /* No early "already closed" guard here. It used to sit above the
       validation, so whether a person who lost the race got their result kept
       as a Claim or silently dropped depended on how many microseconds they
       lost by — two different behaviours for one situation. The claim is
       written first and the state change is a compare-and-swap below, so
       every loser is treated the same way and told the same thing.
       Found 10 Sept 2026 by a test that failed only when the box was slow. */
    const text = clean(b.result_text, 5000);
    const refusal = pd.close_refusal(text, b.grade);
    if (refusal) return res.status(400).json({ error: refusal });
    // The claim is written first, and it stands either way: somebody wrote a
    // result and a result is a claim. Then the state change is made ONLY if
    // the question is still open — four people settling at once used to all
    // succeed, with three graded answers silently dropped from the row.
    const claimId = await writeClosingClaim(me.id, { subjectType: 'question', subjectId: q.id, text, grade: b.grade, sourceRef: clean(b.source_ref, 500) });
    const after = { state: 'settled', settled_reason: text };
    const [w] = await pdq("UPDATE pd_questions SET state='settled', settled_reason=?, settled_at=NOW() WHERE id=? AND state<>'settled'", [text, q.id]);
    if (w.affectedRows === 0) {
      return res.status(409).json({ error: 'Someone settled this a moment before you did. What you wrote is on the record as a claim on the question — nothing is lost, and it can challenge theirs.' });
    }
    await pd.record_changes(pdq, 'question', q.id, q, after, me.id);
    res.json({ ok: true, claim_id: claimId });
  } catch (e) { fail(res, e); }
});

/* ---------- Bets ---------- */
app.post('/api/pd/bets', auth, pdAuth, pdSurface('intake'), async (req, res) => {
  try {
    const b = req.body || {}, me = req.pdUser;
    const [[q]] = [(await pdq('SELECT * FROM pd_questions WHERE id=?', [Number(b.question_id) || 0]))[0]];
    if (!q) return res.status(400).json({ error: 'A Bet tests a Question — pick which one.' });
    // The screen already hides the button on a settled question; the route has
    // to say the same thing, or the rule holds only for people using the screen.
    if (q.state === 'settled') return res.status(409).json({ error: 'That question is settled. If it turns out not to be, write a claim that challenges the answer — a new bet under a settled question reads as if nobody knew.' });
    const approach = clean(b.approach, 5000), kill = clean(b.kill_criterion, 5000);
    if (approach.length < 10) return res.status(400).json({ error: 'Say what the approach is.' });
    // MODEL.md §3 — "carrying the one result that would kill it, written before
    // any bench work." The column is NOT NULL; this is the sentence that says
    // why, in words a person reads.
    if (kill.length < 10) return res.status(400).json({ error: 'Write the kill criterion — the one result that would end this Bet — before any bench work. A Bet without one cannot be lost, so nothing can be learned from it.' });
    let ctx = Number(b.delivery_context_id) || null;
    /* B2 (11 Sept 2026). Plant-wide is a place to write what the plant can
       make, not a way of delivering anything. A Bet aimed through it would
       inherit the plant rules twice and no delivery rules at all, so it is
       refused here rather than quietly accepted — the screen also leaves it out
       of the "Aimed through" list, and this is the guard behind that. */
    if (ctx === pd.PLANT_WIDE_CONTEXT_ID) {
      return res.status(400).json({ error: 'Plant-wide is not a way of delivering anything, so a Bet cannot be aimed through it. Pick the delivery context — every Bet inherits the plant-wide rules anyway.' });
    }
    if (ctx) {
      const [[c]] = [(await pdq('SELECT id FROM pd_delivery_contexts WHERE id=?', [ctx]))[0]];
      if (!c) ctx = null;
    }
    let newId = 0;
    const n = await pd.insert_numbered(pdq, 'pd_bets', 'bet_number', async (n) => {
      const [ins] = await pdq(
        `INSERT INTO pd_bets (bet_number, question_id, delivery_context_id, approach, kill_criterion, owner_id, created_by)
         VALUES (?,?,?,?,?,?,?)`,
        [n, q.id, ctx, approach, kill, me.id, me.id]);
      newId = ins.insertId;
    });
    res.json({ ok: true, id: newId, label: pd.fmt_b(n) });
  } catch (e) { fail(res, e); }
});

app.post('/api/pd/bets/:id/close', auth, pdAuth, pdSurface('intake'), async (req, res) => {
  try {
    const b = req.body || {}, me = req.pdUser;
    const [[bet]] = [(await pdq('SELECT * FROM pd_bets WHERE id=?', [req.params.id]))[0]];
    if (!bet) return res.status(404).json({ error: 'Not found.' });
    if (!(pd.is_lead(me.pd_role) || bet.owner_id === me.id)) {
      return res.status(403).json({ error: 'Closing a bet is its owner’s, or a technical lead’s.' });
    }
    /* No early "already closed" guard here. It used to sit above the
       validation, so whether a person who lost the race got their result kept
       as a Claim or silently dropped depended on how many microseconds they
       lost by — two different behaviours for one situation. The claim is
       written first and the state change is a compare-and-swap below, so
       every loser is treated the same way and told the same thing.
       Found 10 Sept 2026 by a test that failed only when the box was slow. */
    const status = ['killed', 'advanced'].includes(b.status) ? b.status : '';
    if (!status) return res.status(400).json({ error: 'A bet closes as killed or advanced.' });
    const text = clean(b.result_text, 5000);
    const refusal = pd.close_refusal(text, b.grade);
    if (refusal) return res.status(400).json({ error: refusal });
    // The claim first: if writing the result fails, the bet stays open. A bet
    // closed with no result is the exact thing MODEL.md §0 exists to prevent.
    const claimId = await writeClosingClaim(me.id, { subjectType: 'question', subjectId: bet.question_id, text, grade: b.grade, sourceRef: clean(b.source_ref, 500) });
    const [w] = await pdq("UPDATE pd_bets SET status=?, closing_claim_id=?, closed_at=NOW() WHERE id=? AND status='active'", [status, claimId, bet.id]);
    if (w.affectedRows === 0) {
      return res.status(409).json({ error: 'Someone closed this bet a moment before you did. What you wrote is on the record as a claim on the question — nothing is lost.' });
    }
    await pd.record_changes(pdq, 'bet', bet.id, bet, { status, closing_claim_id: claimId }, me.id);
    res.json({ ok: true, claim_id: claimId, status });
  } catch (e) { fail(res, e); }
});

/* ---------- Runs ---------- */
app.post('/api/pd/runs', auth, pdAuth, pdSurface('intake'), async (req, res) => {
  try {
    const b = req.body || {}, me = req.pdUser;
    const [[bet]] = [(await pdq('SELECT * FROM pd_bets WHERE id=?', [Number(b.bet_id) || 0]))[0]];
    if (!bet) return res.status(400).json({ error: 'A Run happens under a Bet — pick which one.' });
    if (bet.status !== 'active') return res.status(409).json({ error: 'That bet is closed. A new line of work is a new bet, under the question it tests.' });
    const expected = clean(b.expected, 5000);
    if (expected.length < 10) return res.status(400).json({ error: 'Write what you expect to happen, before you make it. A Run records what was expected against what happened.' });
    // B14 — "a Run must name the Run it replaced, and why." SOP → KOH →
    // potassium carbonate is one line of investigation, not three unrelated
    // trials, only if this link exists.
    let replaces = Number(b.replaces_run_id) || null, replacesReason = clean(b.replaces_reason, 2000);
    if (replaces) {
      const [[prev]] = [(await pdq('SELECT id FROM pd_runs WHERE id=?', [replaces]))[0]];
      if (!prev) return res.status(400).json({ error: 'That earlier run does not exist.' });
      if (!replacesReason) return res.status(400).json({ error: 'Say why this Run replaces the earlier one, so the two are read together later.' });
    } else { replacesReason = ''; }
    let newId = 0;
    const n = await pd.insert_numbered(pdq, 'pd_runs', 'run_number', async (n) => {
      const [ins] = await pdq(
        `INSERT INTO pd_runs (run_number, bet_id, expected, replaces_run_id, replaces_reason, owner_id, created_by)
         VALUES (?,?,?,?,?,?,?)`,
        [n, bet.id, expected, replaces, replacesReason || null, me.id, me.id]);
      newId = ins.insertId;
    });
    res.json({ ok: true, id: newId, label: pd.fmt_run(n) });
  } catch (e) { fail(res, e); }
});

/* A dated reading. B6 — a long trial is ACTIVE MONITORING, not a waiting
   period: each reading sets its own next observation date, so the schedule is
   a live owned commitment rather than a calendar fixed on day one. A blank
   observation with the row present is a recorded "nothing seen", which is not
   the same as no reading at all. */
app.post('/api/pd/runs/:id/reading', auth, pdAuth, pdSurface('intake'), async (req, res) => {
  try {
    const b = req.body || {}, me = req.pdUser;
    const [[run]] = [(await pdq('SELECT * FROM pd_runs WHERE id=?', [req.params.id]))[0]];
    if (!run) return res.status(404).json({ error: 'Not found.' });
    if (run.status === 'closed') return res.status(409).json({ error: 'That run is closed.' });
    const verdict = ['normal', 'abnormal'].includes(b.verdict) ? b.verdict : '';
    if (!verdict) return res.status(400).json({ error: 'Say whether what you saw was as expected, or abnormal.' });
    const date = dateOrNull(b.reading_date) || new Date().toISOString().slice(0, 10);
    await pdq(
      `INSERT INTO pd_run_readings (run_id, reading_date, parameters_checked, physical_observation, analytical_result, verdict, next_observation_date, recorded_by)
       VALUES (?,?,?,?,?,?,?,?)`,
      [run.id, date, clean(b.parameters_checked, 2000) || null, clean(b.physical_observation, 2000) || null,
       clean(b.analytical_result, 2000) || null, verdict, dateOrNull(b.next_observation_date), me.id]);
    // B15 — "an abnormality opens an investigation mid-trial." Not passed, not
    // failed, not still running: a state of its own, and the run moves into it
    // by itself so nobody has to remember to.
    let opened = false;
    if (verdict === 'abnormal' && run.status === 'running') {
      await pd.record_changes(pdq, 'run', run.id, run, { status: 'abnormal_investigation' }, me.id,
        { note: 'A reading came back abnormal.' });
      await pdq("UPDATE pd_runs SET status='abnormal_investigation' WHERE id=? AND status='running'", [run.id]);
      opened = true;
    }
    res.json({ ok: true, investigation_opened: opened });
  } catch (e) { fail(res, e); }
});

app.post('/api/pd/runs/:id/close', auth, pdAuth, pdSurface('intake'), async (req, res) => {
  try {
    const b = req.body || {}, me = req.pdUser;
    const [[run]] = [(await pdq('SELECT * FROM pd_runs WHERE id=?', [req.params.id]))[0]];
    if (!run) return res.status(404).json({ error: 'Not found.' });
    if (!(pd.is_lead(me.pd_role) || run.owner_id === me.id)) {
      return res.status(403).json({ error: 'Closing a run is its owner’s, or a technical lead’s.' });
    }
    /* No early "already closed" guard here. It used to sit above the
       validation, so whether a person who lost the race got their result kept
       as a Claim or silently dropped depended on how many microseconds they
       lost by — two different behaviours for one situation. The claim is
       written first and the state change is a compare-and-swap below, so
       every loser is treated the same way and told the same thing.
       Found 10 Sept 2026 by a test that failed only when the box was slow. */
    const actual = clean(b.actual, 5000);
    if (actual.length < 10) return res.status(400).json({ error: 'Write what actually happened. A Run records what was expected against what happened — without the second half it records nothing.' });
    const text = clean(b.result_text, 5000);
    const refusal = pd.close_refusal(text, b.grade);
    if (refusal) return res.status(400).json({ error: refusal });
    const [[bet]] = [(await pdq('SELECT question_id FROM pd_bets WHERE id=?', [run.bet_id]))[0]];
    const claimId = await writeClosingClaim(me.id, {
      subjectType: 'question', subjectId: bet.question_id, text, grade: b.grade,
      sourceRef: clean(b.source_ref, 500), runId: run.id,
    });
    const [w] = await pdq("UPDATE pd_runs SET actual=?, status='closed', closing_claim_id=?, closed_at=NOW() WHERE id=? AND status<>'closed'", [actual, claimId, run.id]);
    if (w.affectedRows === 0) {
      return res.status(409).json({ error: 'Someone closed this run a moment before you did. What you wrote is on the record as a claim on the question — nothing is lost.' });
    }
    await pd.record_changes(pdq, 'run', run.id, run, { actual, status: 'closed', closing_claim_id: claimId }, me.id);
    res.json({ ok: true, claim_id: claimId });
  } catch (e) { fail(res, e); }
});

/* B18 — "an Observation can arise INSIDE a Run": settling, ammonia, a seal
   swelling. Generated by the run, not arriving from outside, so it is filed
   with origin='arose_in_run' and carries the run it came from. It goes to the
   same triage queue as anything else that came in. */
app.post('/api/pd/runs/:id/observe', auth, pdAuth, pdSurface('intake'), async (req, res) => {
  try {
    const b = req.body || {}, me = req.pdUser;
    const [[run]] = [(await pdq('SELECT r.*, b.question_id FROM pd_runs r JOIN pd_bets b ON b.id=r.bet_id WHERE r.id=?', [req.params.id]))[0]];
    if (!run) return res.status(404).json({ error: 'Not found.' });
    const text = clean(b.text, 5000);
    if (text.length < 15) return res.status(400).json({ error: 'Write what you saw, in a sentence or two.' });
    const [[q]] = [(await pdq('SELECT problem_id FROM pd_questions WHERE id=?', [run.question_id]))[0]];
    let newId = 0;
    const n = await pd.insert_numbered(pdq, 'pd_observations', 'observation_number', async (n) => {
      const [ins] = await pdq(
        `INSERT INTO pd_observations (observation_number, text, origin, door_chosen, run_id, reported_by_name, problem_id, logged_by)
         VALUES (?,?,'arose_in_run',1,?,?,?,?)`,
        [n, text + `\n\n[Arose inside ${pd.fmt_run(run.run_number)}.]`, run.id, me.name, q ? q.problem_id : null, me.id]);
      newId = ins.insertId;
    });
    res.json({ ok: true, id: newId, label: pd.fmt_o(n) });
  } catch (e) { fail(res, e); }
});

/* ---------- Claims ----------
   MODEL.md §3, the atom: "an assertion with an owner and an honest grade.
   ANYONE may challenge it. This is how tacit team knowledge and the evidence
   base both enter." So creating one, and challenging one, are open to every PD
   role — a claim nobody may contradict is not a claim.
   B17: a Claim may sit directly against a Problem, for a falsified belief that
   outlives one trial ("fermentation should not occur at such a low pH") rather
   than being buried as a footnote on a Run. */
app.post('/api/pd/claims', auth, pdAuth, pdSurface('intake'), async (req, res) => {
  try {
    const b = req.body || {}, me = req.pdUser;
    const subjectType = ['question', 'problem'].includes(b.subject_type) ? b.subject_type : '';
    if (!subjectType) return res.status(400).json({ error: 'A claim answers a question, or stands against a problem.' });
    const subjectId = Number(b.subject_id) || 0;
    const [[subj]] = [(await pdq(
      subjectType === 'question' ? 'SELECT id FROM pd_questions WHERE id=?' : 'SELECT id FROM pd_problems WHERE id=?',
      [subjectId]))[0]];
    if (!subj) return res.status(400).json({ error: 'That is not something a claim can attach to.' });
    const text = clean(b.text, 5000);
    if (text.length < 10) return res.status(400).json({ error: 'Write the claim out.' });
    if (!pd.has(pd.CLAIM_GRADES, b.grade)) return res.status(400).json({ error: 'Grade it honestly: proven, contested, or believed.' });
    let challenges = Number(b.challenges_claim_id) || null;
    if (challenges) {
      const [[c]] = [(await pdq('SELECT id, subject_type, subject_id FROM pd_claims WHERE id=?', [challenges]))[0]];
      if (!c) return res.status(400).json({ error: 'That claim does not exist.' });
      // A challenge across two unrelated problems reads on the screen as
      // "challenges C-001" pointing at something that is not on the page.
      if (c.subject_type !== subjectType || c.subject_id !== subjectId) {
        return res.status(400).json({ error: 'A claim challenges another claim about the same thing. Write it against what that claim is about, and it can challenge it there.' });
      }
    }
    let newId = 0;
    const n = await pd.insert_numbered(pdq, 'pd_claims', 'claim_number', async (n) => {
      const [ins] = await pdq(
        `INSERT INTO pd_claims (claim_number, version, is_current, subject_type, subject_id, text, owner_id, grade, challenges_claim_id, source_ref, created_by)
         VALUES (?,1,1,?,?,?,?,?,?,?,?)`,
        [n, subjectType, subjectId, text, me.id, b.grade, challenges, clean(b.source_ref, 500) || null, me.id]);
      newId = ins.insertId;
    });
    // A challenged question is contested, and says so without anyone
    // remembering to set it (QUESTION_STATES).
    if (challenges && subjectType === 'question') {
      await pdq("UPDATE pd_questions SET state='contested' WHERE id=? AND state='open'", [subjectId]);
    }
    res.json({ ok: true, id: newId, label: pd.fmt_cl(n) });
  } catch (e) { fail(res, e); }
});

/* MODEL.md §6: "correction history (versioned; never overwrite in place)."
   Revising a claim writes a NEW version and supersedes the old one, which
   stays readable forever. The claim keeps its number across every version. */
app.post('/api/pd/claims/:id/revise', auth, pdAuth, pdSurface('intake'), async (req, res) => {
  try {
    const b = req.body || {}, me = req.pdUser;
    const [[c]] = [(await pdq('SELECT * FROM pd_claims WHERE id=? AND is_current=1', [req.params.id]))[0]];
    if (!c) return res.status(404).json({ error: 'Not found, or it has already been superseded.' });
    if (!(pd.is_lead(me.pd_role) || c.owner_id === me.id)) {
      return res.status(403).json({ error: 'Revising a claim is its owner’s, or a technical lead’s.' });
    }
    const text = clean(b.text, 5000);
    if (text.length < 10) return res.status(400).json({ error: 'Write the revised claim out.' });
    const grade = pd.has(pd.CLAIM_GRADES, b.grade) ? b.grade : c.grade;
    let ins;
    try {
      [ins] = await pdq(
        `INSERT INTO pd_claims (claim_number, version, is_current, subject_type, subject_id, text, owner_id, grade, challenges_claim_id, source_ref, run_id, created_by)
         VALUES (?,?,1,?,?,?,?,?,?,?,?,?)`,
        [c.claim_number, c.version + 1, c.subject_type, c.subject_id, text, c.owner_id, grade,
         c.challenges_claim_id, clean(b.source_ref, 500) || c.source_ref, c.run_id, me.id]);
    } catch (e) {
      // 005 makes (claim_number, version) unique, so two people revising the
      // same claim at once collide here instead of forking it into three
      // competing "version 2" rows, all flagged current.
      if (e && e.errno === 1062) return res.status(409).json({ error: 'Someone revised this claim a moment before you did. Open it again and revise what it says now.' });
      throw e;
    }
    await pdq('UPDATE pd_claims SET is_current=0, superseded_by_claim_id=? WHERE id=?', [ins.insertId, c.id]);
    res.json({ ok: true, id: ins.insertId, version: c.version + 1 });
  } catch (e) { fail(res, e); }
});

/* ---------- Assign, and edit ----------
   Assigning is the restricted half of Tahir's ruling: anyone may open the
   work, a lead decides whose it is. Editing follows the same rule the doors
   already follow — content is editable, the record of what it was is not. */
app.post('/api/pd/:type(question|bet|run)/:id/assign', auth, pdAuth, pdSurface('intake'), async (req, res) => {
  try {
    // Express matches route patterns case-insensitively, so /api/pd/QUESTION/1
    // reaches this handler with a type the map does not hold. Confirmed by
    // review as a 500 that leaked a stack-shaped string to the screen.
    const type = String(req.params.type || '').toLowerCase(), me = req.pdUser;
    if (!isSpine(type)) return res.status(404).json({ error: 'Not found.' });
    const id = Number(req.params.id) || 0;
    if (!pd.is_lead(me.pd_role)) return res.status(403).json({ error: 'Naming somebody the owner is a technical lead’s, or the COO’s. Anyone can open the work; deciding whose it is commits their time.' });
    const s = SPINE[type];
    const [[row]] = [(await pdq(`SELECT * FROM ${s.table} WHERE id=?`, [id]))[0]];
    if (!row) return res.status(404).json({ error: 'Not found.' });
    const ownerId = Number((req.body || {}).owner_id) || 0;
    const [[u]] = [(await pdq('SELECT id FROM auth_users WHERE id=? AND pd_role IS NOT NULL AND active=1', [ownerId]))[0]];
    if (!u) return res.status(400).json({ error: 'That person has no PD role yet, so nothing can be owned by them.' });
    await pd.record_changes(pdq, type, row.id, row, { owner_id: ownerId }, me.id);
    await pdq(`UPDATE ${s.table} SET owner_id=? WHERE id=?`, [ownerId, row.id]);
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

app.post('/api/pd/:type(question|bet|run)/:id/edit', auth, pdAuth, pdSurface('intake'), async (req, res) => {
  try {
    const type = String(req.params.type || '').toLowerCase(), b = req.body || {}, me = req.pdUser;
    if (!isSpine(type)) return res.status(404).json({ error: 'Not found.' });
    const s = SPINE[type], id = Number(req.params.id) || 0;
    const [[row]] = [(await pdq(`SELECT * FROM ${s.table} WHERE id=?`, [id]))[0]];
    if (!row) return res.status(404).json({ error: 'Not found.' });
    // Owner or lead — not "whoever created it". Review found a member who had
    // been moved off a bet, and refused by the close route, still able to
    // rewrite its kill criterion through here.
    if (!(pd.is_lead(me.pd_role) || row.owner_id === me.id)) {
      return res.status(403).json({ error: 'This is someone else’s to edit. Its owner, or a technical lead, can change it.' });
    }
    /* Once something is closed, editing it is how the record starts
       contradicting itself. Review confirmed the sequence: close a run with a
       graded claim, then rewrite its `actual` to say the opposite, and the run
       flatly disagrees with the claim that closed it — with nothing on the
       screen saying so. A finished record is corrected by writing a claim, or
       by revising the one that closed it, both of which keep the history. */
    if (spineClosed(type, row)) return res.status(409).json({ error: s.closedSays });

    const after = {};
    for (const f of s.editable) {
      if (!(f in b)) continue;
      if (f === 'due_date') { after[f] = dateOrNull(b[f]); continue; }
      if (f === 'delivery_context_id') { after[f] = Number(b[f]) || null; continue; }
      if (f === 'nature') { if (pd.has(pd.QUESTION_NATURES, b[f])) after[f] = b[f]; continue; }
      const v = fit(f, b[f]);              // the column's real width, not a generic 5000
      after[f] = v === '' ? null : v;
    }
    /* The same minimums the create routes ask for. Without them, a field that
       had to be ten characters to exist could be edited down to one the moment
       after — which is how a kill criterion became "x". */
    for (const f of Object.keys(s.minimums || {})) {
      if (!(f in after)) continue;
      if (f === 'actual' && after[f] === null) continue;      // an unfinished run has none yet
      if (!after[f] || String(after[f]).length < s.minimums[f]) {
        return res.status(400).json({ error: f === 'kill_criterion'
          ? 'A bet keeps a kill criterion someone can act on. You can change what it says; it cannot be reduced to nothing.'
          : 'That needs to say enough to mean something to whoever reads it in a year.' });
      }
    }
    if (!Object.keys(after).length) return res.json({ ok: true, changed: 0 });
    const changed = await pd.record_changes(pdq, type, row.id, row, after, me.id, { note: clean(b.note, 2000) || null });
    if (changed) {
      const sets = Object.keys(after).map(f => `${f}=?`).join(', ');
      try {
        await pdq(`UPDATE ${s.table} SET ${sets} WHERE id=?`, [...Object.values(after), row.id]);
      } catch (e) {
        await pd.record_not_applied(pdq, type, row.id, after, me.id, 'The database refused this change, so the record still reads as it did.');
        throw e;
      }
    }
    res.json({ ok: true, changed });
  } catch (e) { fail(res, e); }
});


/* ============================================================================
 * PD · THE SCREENS MILESTONE, PART 3 — "What I owe" and "The Report".
 * ADDED 9 Sept 2026 (night), out of the adoption audit.
 *
 * WHY THESE TWO, AND WHY NOW. The audit's verdict was one sentence: the system
 * has to give something back before it asks for anything. A chemist wrote six
 * real records — a Problem, a Question, a Bet, a Run, two readings — and his
 * home screen then told him "Nothing yet. The box on the left is the whole of
 * it." The R&D Manager who owns the entire V Germinator Pro chain saw the same
 * empty box. Every person in the pilot was paying a tax and exactly one of
 * them, reading someone else's dossier, was getting anything back.
 *
 * The cause was not subtle: MODEL.md §5 signs off FOUR screens and two were
 * built. The two that were built are the two where people GIVE. The two that
 * were cut are the two where people GET —
 *   §5.2 "What I owe"  — my assigned questions, who waits on each, by when;
 *                        late shows as late. "The only per-person scoreboard."
 *   §5.4 "The Report"  — portfolio KPIs plus a needs-attention feed and a
 *                        recently-closed feed. Aggregate only.
 *
 * THE ONE RULE THAT SHAPES BOTH. RECLASSIFICATION-RULES.md §8.1: "No
 * per-person error count. Not on a dashboard, not in a report, not derivable
 * from the audit log by any screen the system offers." So:
 *   · "What I owe" is ONLY ever about the person asking. It takes no user
 *     parameter and there is no route by which one person reads another's.
 *     That is what §5.2 means by a per-person scoreboard — your own work, in
 *     front of you — and it is the opposite of a league table.
 *   · "The Report" carries no person at all. Not a name, not a count by
 *     name, not a field a screen could group by. Every number below is a
 *     count of THINGS. Whoever is asked to add "and who is behind?" should be
 *     shown this comment and §8.1 first.
 * ==========================================================================*/

/* The next look a Run owes, and whether that date has gone by. B6 — a long
   trial is active monitoring, so the thing that falls due is the next reading,
   not the trial. */
const NEXT_LOOK_SQL = `
  (SELECT rd.next_observation_date FROM pd_run_readings rd
    WHERE rd.run_id = r.id AND rd.next_observation_date IS NOT NULL
    ORDER BY rd.reading_date DESC, rd.id DESC LIMIT 1)`;

app.get('/api/pd/mywork', auth, pdAuth, pdSurface('intake'), async (req, res) => {
  try {
    const me = req.pdUser, today = new Date().toISOString().slice(0, 10);

    const [questions] = await pdq(
      `SELECT q.id, q.q_number, q.title, q.nature, q.state, q.due_date,
              p.id problem_id, p.p_number, p.title problem_title,
              (SELECT COUNT(*) FROM pd_bets b WHERE b.question_id=q.id AND b.status='active') open_bets
         FROM pd_questions q JOIN pd_problems p ON p.id=q.problem_id
        WHERE q.owner_id=? AND q.state<>'settled'
        ORDER BY (q.due_date IS NULL), q.due_date, q.q_number`, [me.id]);

    const [runs] = await pdq(
      `SELECT r.id, r.run_number, r.status, r.expected, ${NEXT_LOOK_SQL} next_look,
              b.id bet_id, b.bet_number, b.kill_criterion,
              q.id question_id, q.q_number, q.title question_title,
              p.id problem_id, p.p_number, p.title problem_title
         FROM pd_runs r
         JOIN pd_bets b ON b.id=r.bet_id
         JOIN pd_questions q ON q.id=b.question_id
         JOIN pd_problems p ON p.id=q.problem_id
        WHERE r.owner_id=? AND r.status<>'closed'
        ORDER BY r.status='abnormal_investigation' DESC, (${NEXT_LOOK_SQL} IS NULL), ${NEXT_LOOK_SQL}`,
      [me.id]);

    const [bets] = await pdq(
      `SELECT b.id, b.bet_number, b.approach, b.kill_criterion,
              q.q_number, q.title question_title, p.id problem_id, p.p_number,
              (SELECT COUNT(*) FROM pd_runs r WHERE r.bet_id=b.id AND r.status<>'closed') open_runs,
              (SELECT COUNT(*) FROM pd_runs r WHERE r.bet_id=b.id) all_runs
         FROM pd_bets b JOIN pd_questions q ON q.id=b.question_id JOIN pd_problems p ON p.id=q.problem_id
        WHERE b.owner_id=? AND b.status='active' ORDER BY b.bet_number`, [me.id]);

    /* Requests are the one door that waits on a person by design — MODEL.md §3
       gives a Request a recipient and a return-by, which is a promise to
       somebody outside PD. §5.2 names them explicitly. */
    const [requests] = await pdq(
      `SELECT id, request_number, requester, recipient, purpose, dispatch_date, return_by, status
         FROM pd_requests WHERE owner_id=? AND status='open' AND converted_to_id IS NULL
        ORDER BY (return_by IS NULL), return_by`, [me.id]);

    /* What this person wrote down, and what became of it. The audit found the
       author's own entries were the one thing they could never see the fate
       of without hunting. */
    const mine = [];
    for (const type of Object.keys(DOOR_TABLES)) {
      const d = DOOR_TABLES[type];
      const [rows] = await pdq(
        `SELECT x.*, CONCAT('P-', LPAD(p.p_number,2,'0'), ' — ', p.title) problem_label, ow.name owner_name, au.name author_name
           FROM ${d.table} x
           LEFT JOIN pd_problems p ON p.id=x.problem_id
           LEFT JOIN auth_users ow ON ow.id=x.owner_id
           LEFT JOIN auth_users au ON au.id=x.logged_by
          WHERE x.logged_by=? ORDER BY x.id DESC LIMIT 25`, [me.id]);
      for (const r of rows) mine.push(doorRow(type, r));
    }
    mine.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    let toFile = 0;
    if (mayTriage(me.pd_role)) {
      for (const type of Object.keys(DOOR_TABLES)) {
        const d = DOOR_TABLES[type];
        const [[c]] = [(await pdq(`SELECT COUNT(*) n FROM ${d.table} WHERE status='unsorted' AND converted_to_id IS NULL`))[0]];
        toFile += Number(c.n);
      }
    }

    /* RECLASSIFICATION-RULES.md §7: "the author sees ONE message, ONCE", three
       parts and ONE action. An acknowledge button would be a second action, so
       delivery marks it seen — and this is the only screen that delivers, so
       nothing else can consume it first. Nothing is lost either way: the
       entry's own card carries where it went, permanently. */
    const [notices] = await pdq(
      `SELECT n.*, u.name mover FROM pd_notices n JOIN auth_users u ON u.id=n.moved_by
        WHERE n.recipient_id=? ORDER BY n.id DESC LIMIT 10`, [me.id]);
    if (notices.some(n => !n.seen_at)) {
      await pdq('UPDATE pd_notices SET seen_at=NOW() WHERE recipient_id=? AND seen_at IS NULL', [me.id]);
    }
    /* A question somebody asked back about a refiling this person made. §7:
       "correction that cannot be answered is authority, not teaching" — so the
       answer has to land somewhere they will see it. */
    const [replies] = await pdq(
      `SELECT n.id, n.headline, n.reply_text, n.replied_at, n.link_type, n.link_id, u.name author
         FROM pd_notices n JOIN auth_users u ON u.id=n.recipient_id
        WHERE n.moved_by=? AND n.reply_text IS NOT NULL ORDER BY n.replied_at DESC LIMIT 10`, [me.id]);

    const late = d => !!d && d < today;
    res.json({
      me: { id: me.id, name: me.name, role_label: pd.PD_ROLES[me.pd_role] || me.pd_role },
      questions: questions.map(q => ({ ...q, label: pd.fmt_q(q.q_number), problem_label: pd.fmt_p(q.p_number),
        nature_label: pd.QUESTION_NATURES[q.nature], state_label: pd.QUESTION_STATES[q.state], late: late(q.due_date) })),
      runs: runs.map(r => ({ ...r, label: pd.fmt_run(r.run_number), bet_label: pd.fmt_b(r.bet_number),
        question_label: pd.fmt_q(r.q_number), problem_label: pd.fmt_p(r.p_number),
        status_label: pd.RUN_STATUSES[r.status], late: late(r.next_look), abnormal: r.status === 'abnormal_investigation' })),
      bets: bets.map(b => ({ ...b, label: pd.fmt_b(b.bet_number), question_label: pd.fmt_q(b.q_number), problem_label: pd.fmt_p(b.p_number) })),
      requests: requests.map(r => ({ ...r, label: pd.fmt_req(r.request_number), late: late(r.return_by) })),
      mine: mine.slice(0, 20),
      toFile, notices, replies,
      caps: { triage: mayTriage(me.pd_role) },
    });
  } catch (e) { fail(res, e, 'mywork'); }
});

/* ---------------------------------------------------------------------------
   The Report — MODEL.md §5.4, signed off in PENDING-DECISIONS.md §B19.
   Aggregate only. Read the §8.1 note at the top of this block before adding
   anything to it.
--------------------------------------------------------------------------- */
app.get('/api/pd/report', auth, pdAuth, pdSurface('intake'), async (req, res) => {
  try {
    const one = async (sql, args) => { const [[r]] = [(await pdq(sql, args || []))[0]]; return Number(r.n); };
    const today = new Date().toISOString().slice(0, 10);

    const problems = {
      field_problem: await one("SELECT COUNT(*) n FROM pd_problems WHERE status='open' AND kind='field_problem'"),
      product_concept: await one("SELECT COUNT(*) n FROM pd_problems WHERE status='open' AND kind='product_concept'"),
      closed: await one("SELECT COUNT(*) n FROM pd_problems WHERE status<>'open'"),
    };
    const questions = {
      open: await one("SELECT COUNT(*) n FROM pd_questions WHERE state='open'"),
      contested: await one("SELECT COUNT(*) n FROM pd_questions WHERE state='contested'"),
      settled: await one("SELECT COUNT(*) n FROM pd_questions WHERE state='settled'"),
      overdue: await one("SELECT COUNT(*) n FROM pd_questions WHERE state<>'settled' AND due_date IS NOT NULL AND due_date < ?", [today]),
    };
    const bets = {
      active: await one("SELECT COUNT(*) n FROM pd_bets WHERE status='active'"),
      killed: await one("SELECT COUNT(*) n FROM pd_bets WHERE status='killed'"),
      advanced: await one("SELECT COUNT(*) n FROM pd_bets WHERE status='advanced'"),
    };
    const runs = {
      running: await one("SELECT COUNT(*) n FROM pd_runs WHERE status='running'"),
      investigating: await one("SELECT COUNT(*) n FROM pd_runs WHERE status='abnormal_investigation'"),
      closed: await one("SELECT COUNT(*) n FROM pd_runs WHERE status='closed'"),
    };
    const claims = {
      proven: await one("SELECT COUNT(*) n FROM pd_claims WHERE is_current=1 AND grade='proven'"),
      contested: await one("SELECT COUNT(*) n FROM pd_claims WHERE is_current=1 AND grade='contested'"),
      believed: await one("SELECT COUNT(*) n FROM pd_claims WHERE is_current=1 AND grade='believed'"),
    };

    /* The COO's own bar for the pilot, in his words: "things get written down
       at all — entries arriving, questions written before samples are made,
       results written when things close." These three rows are that bar, and
       nothing else on this screen is. */
    const since = d => `DATE_SUB(CURDATE(), INTERVAL ${d} DAY)`;
    const written = async (days) => ({
      days,
      arrived: (await one(`SELECT COUNT(*) n FROM pd_challenges WHERE created_at >= ${since(days)}`))
             + (await one(`SELECT COUNT(*) n FROM pd_observations WHERE created_at >= ${since(days)}`))
             + (await one(`SELECT COUNT(*) n FROM pd_requests WHERE created_at >= ${since(days)}`)),
      questions: await one(`SELECT COUNT(*) n FROM pd_questions WHERE created_at >= ${since(days)}`),
      bets: await one(`SELECT COUNT(*) n FROM pd_bets WHERE created_at >= ${since(days)}`),
      runs: await one(`SELECT COUNT(*) n FROM pd_runs WHERE created_at >= ${since(days)}`),
      readings: await one(`SELECT COUNT(*) n FROM pd_run_readings WHERE created_at >= ${since(days)}`),
      results: await one(`SELECT COUNT(*) n FROM pd_claims WHERE created_at >= ${since(days)}`),
    });

    /* Two things worth knowing that a count cannot say. Both are about the
       DISCIPLINE holding, not about anybody's performance. */
    const discipline = {
      // A Bet that has never had a Run is a stated intention nobody has acted on.
      bets_never_run: await one("SELECT COUNT(*) n FROM pd_bets b WHERE b.status='active' AND NOT EXISTS (SELECT 1 FROM pd_runs r WHERE r.bet_id=b.id)"),
      // A Run with no reading in three weeks is a trial nobody is watching (B6).
      runs_unwatched: await one(`SELECT COUNT(*) n FROM pd_runs r WHERE r.status<>'closed'
        AND NOT EXISTS (SELECT 1 FROM pd_run_readings rd WHERE rd.run_id=r.id AND rd.created_at >= ${since(21)})`),
      // Entries that came in and are still nobody's.
      unfiled: await one("SELECT COUNT(*) n FROM pd_challenges WHERE status='unsorted' AND converted_to_id IS NULL")
             + await one("SELECT COUNT(*) n FROM pd_observations WHERE status='unsorted' AND converted_to_id IS NULL")
             + await one("SELECT COUNT(*) n FROM pd_requests WHERE status='unsorted' AND converted_to_id IS NULL"),
      // How many Runs have no recipe recorded against them — the gap the
      // Combination Bank is meant to close. A number, so it stops being a
      // pill on every card and starts being a worklist.
      runs_without_recipe: await one("SELECT COUNT(*) n FROM pd_runs WHERE combination_id IS NULL"),
    };

    /* Needs attention. Things, with the Problem they sit under — never a
       person, and never ordered by whose they are. */
    const [overdueQ] = await pdq(
      `SELECT q.q_number, q.title, q.due_date, p.id problem_id, p.p_number
         FROM pd_questions q JOIN pd_problems p ON p.id=q.problem_id
        WHERE q.state<>'settled' AND q.due_date IS NOT NULL AND q.due_date < ?
        ORDER BY q.due_date LIMIT 12`, [today]);
    const [lateLooks] = await pdq(
      `SELECT r.id, r.run_number, r.status, ${NEXT_LOOK_SQL} next_look,
              q.title question_title, p.id problem_id, p.p_number
         FROM pd_runs r JOIN pd_bets b ON b.id=r.bet_id JOIN pd_questions q ON q.id=b.question_id
         JOIN pd_problems p ON p.id=q.problem_id
        WHERE r.status<>'closed' HAVING next_look IS NOT NULL AND next_look < ? ORDER BY next_look LIMIT 12`, [today]);
    const [investigations] = await pdq(
      `SELECT r.id, r.run_number, q.title question_title, p.id problem_id, p.p_number
         FROM pd_runs r JOIN pd_bets b ON b.id=r.bet_id JOIN pd_questions q ON q.id=b.question_id
         JOIN pd_problems p ON p.id=q.problem_id
        WHERE r.status='abnormal_investigation' ORDER BY r.run_number LIMIT 12`);

    /* What closed recently, with its result. This is the feed that makes the
       screen worth opening: it is the only place the company's answers appear
       together. */
    const [closed] = await pdq(
      `SELECT c.claim_number, c.text, c.grade, c.created_at, c.subject_type, c.subject_id,
              q.q_number, q.title question_title, p.id problem_id, p.p_number, p.title problem_title
         FROM pd_claims c
         LEFT JOIN pd_questions q ON c.subject_type='question' AND q.id=c.subject_id
         LEFT JOIN pd_problems p ON p.id = COALESCE(q.problem_id, CASE WHEN c.subject_type='problem' THEN c.subject_id END)
        WHERE c.is_current=1 ORDER BY c.created_at DESC, c.id DESC LIMIT 12`);

    res.json({
      problems, questions, bets, runs, claims, discipline,
      written: { week: await written(7), month: await written(30) },
      attention: {
        overdueQuestions: overdueQ.map(q => ({ ...q, label: pd.fmt_q(q.q_number), problem_label: pd.fmt_p(q.p_number) })),
        lateLooks: lateLooks.map(r => ({ ...r, label: pd.fmt_run(r.run_number), problem_label: pd.fmt_p(r.p_number) })),
        investigations: investigations.map(r => ({ ...r, label: pd.fmt_run(r.run_number), problem_label: pd.fmt_p(r.p_number) })),
      },
      closed: closed.map(c => ({ ...c, label: pd.fmt_cl(c.claim_number), grade_label: pd.CLAIM_GRADES[c.grade],
        question_label: c.q_number ? pd.fmt_q(c.q_number) : null, problem_label: c.p_number ? pd.fmt_p(c.p_number) : null })),
    });
  } catch (e) { fail(res, e, 'report'); }
});

};
