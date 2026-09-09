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
    const m = String(b.pin || '').match(/^problem:(\d+)$/);
    if (m) await pdq('INSERT IGNORE INTO pd_library_pins (item_id, target_type, target_id, pinned_by) VALUES (?,?,?,?)', [newId, 'problem', Number(m[1]), req.pdUser.id]);
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
  try { // FIX C3 — pinning is curation, not reading. Members and outside reviewers may read the library, not rearrange it.
    if (!pd.can_role(req.pdUser.pd_role, ['qc_head', 'rta', 'production', 'agronomy', 'custodian', 'lab_tech'])) return res.status(403).json({ error: 'Pinning reading to a problem is for the technical team.' });
    const m = String((req.body && req.body.pin) || '').match(/^problem:(\d+)$/);
    if (!m) return res.status(400).json({ error: 'Pick somewhere to pin it.' });
    await pdq('INSERT IGNORE INTO pd_library_pins (item_id, target_type, target_id, pinned_by) VALUES (?,?,?,?)', [req.params.id, 'problem', Number(m[1]), req.pdUser.id]);
    res.json({ ok: true }); } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/pd/library/:id/unpin', auth, pdAuth, pdSurface('library'), async (req, res) => {
  try { // FIX C3 — see /pin above.
    if (!pd.can_role(req.pdUser.pd_role, ['qc_head', 'rta', 'production', 'agronomy', 'custodian', 'lab_tech'])) return res.status(403).json({ error: 'Removing a pin is for the technical team.' });
    await pdq('DELETE FROM pd_library_pins WHERE id=? AND item_id=?', [Number((req.body && req.body.pin_id) || 0), req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/pd/library/:id/archive', auth, pdAuth, pdSurface('library'), async (req, res) => {
  try { if (!pd.can_role(req.pdUser.pd_role, ['custodian'])) return res.status(403).json({ error: 'Archiving a library item is the Data Custodian’s (or the COO’s).' });
    const reason = String((req.body && req.body.reason) || '').trim();
    if (!reason) return res.status(400).json({ error: 'Archiving carries a reason, like everything else here.' });
    const [r] = await pdq('UPDATE pd_library_items SET archived=1, archived_reason=? WHERE id=?', [reason, req.params.id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Not found.' });
    res.json({ ok: true }); } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/pd/library/:id/restore', auth, pdAuth, pdSurface('library'), async (req, res) => {
  try { if (!pd.can_role(req.pdUser.pd_role, ['custodian'])) return res.status(403).json({ error: 'Restoring a library item is the Data Custodian’s (or the COO’s).' });
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
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// Triage (Registrar / COO): list, convert to a Challenge/Observation/Request, or dismiss.
app.get('/api/pd/dropbox', auth, pdAuth, async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['custodian'])) return res.status(403).json({ error: 'Drop-box triage is the Data Custodian’s (or the COO’s).' });
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
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
app.post('/api/pd/dropbox/:id/dismiss', auth, pdAuth, async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['custodian'])) return res.status(403).json({ error: 'Drop-box triage is the Data Custodian’s (or the COO’s).' });
    const [[e]] = [(await pdq("SELECT id FROM pd_dropbox WHERE id=? AND status='new'", [req.params.id]))[0]];
    if (!e) return res.status(404).json({ error: 'Entry not found or already handled.' });
    await pdq("UPDATE pd_dropbox SET status='dismissed', handled_by=?, handled_at=NOW() WHERE id=?", [req.pdUser.id, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
// Convert a drop-box entry into one of the three doors. Each door has its own
// required fields (MODEL.md §3), so the body shape depends on target_type —
// this does not silently default missing fields, the same discipline the old
// convert route used for an idea's title.
app.post('/api/pd/dropbox/:id/convert', auth, pdAuth, async (req, res) => {
  try {
    if (!pd.can_role(req.pdUser.pd_role, ['custodian'])) return res.status(403).json({ error: 'Drop-box triage is the Data Custodian’s (or the COO’s).' });
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
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

};
