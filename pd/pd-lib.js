/* ---------------------------------------------------------------------------
 * PD (Product Development) domain rules.
 *
 * REBUILT 9 Sept 2026 — Tahir's decision that session: "take the old app down
 * now" (docs/pd-model/PENDING-DECISIONS.md, OP-HANDOFF.md). This file used to
 * be a faithful port of the standalone van-rd-app PHP application (idea
 * intake, six gates, candidate cost-scoring). None of that survives —
 * REUSE-RULES.md §2 is the complete list of what may carry into the rebuild,
 * and "everything else... is opened only in order to delete it."
 *
 * What is kept below and why:
 *   - The Library helpers (REUSE-RULES §2 item 2) — untouched.
 *   - SOURCES (used by the Drop box, REUSE-RULES §2 item 3) — untouched.
 *   - next_number / insert_numbered (REUSE-RULES §2 item 2/3's concurrency-
 *     safe numbering engine) — untouched, generic infrastructure, not
 *     domain vocabulary.
 *   - fmt_p (Problem's permanent number formatter) — untouched; the new
 *     pd_problems table keeps the exact p_number column name the old one
 *     had, specifically so this did not need to change.
 *   - PD_ROLES, can_role, can_pd, allowed_surfaces — kept but trimmed: the
 *     only surface any surviving route still gates on is 'library'. The old
 *     BASE_SURFACES / OPERATOR_SURFACES lists named surfaces (ideas.all,
 *     gatelog, samples, trials, candidates...) that no longer exist as
 *     routes; carrying them forward would be dead code pretending to be a
 *     permission model.
 *
 * Everything else — the gate vocabulary (G1-G6), the hypothesis pipeline,
 * STAGES, the candidate cost-scoring engine (cost is OUT of PD, settled
 * 1 Sept 2026, PENDING-DECISIONS.md §D) — is gone. Not renamed, not
 * re-derived under a new name. See REUSE-RULES.md §3, the vocabulary ban.
 * ------------------------------------------------------------------------- */

/* ---- Problem's permanent number (inc/db.php fmt_p, unchanged) ---- */
const fmt_p = n => 'P-' + String(n).padStart(2, '0');

/* PD role vocabulary. Deliberately separate from O2S's own role vocabulary —
   a person's O2S role and PD role are two independent attributes of the same
   account (auth_users.role and auth_users.pd_role). NULL pd_role = no PD
   access at all.
   'registrar' added 9 Sept 2026 (migrations/002_pd_core_rebuild.sql) per
   combination-bank/RULES.md §8.2 and RECLASSIFICATION-RULES.md §10, which
   both name "Custodian, Registrar and COO" as the starting moderator group.
   Nobody is assigned it yet — that is a screens-milestone decision. */
/* Matched to VAN's actual org chart, 10 Sept 2026 (migrations/006_pd_roles.sql).
   Two labels changed and two roles were added:
     - `rta` read "Plant Manager (RTA)" while Himmayat, who holds it, is the
       R&D Manager — and `production` is what the real Plant Manager holds. The
       label named the wrong job AND collided with another role. RTA is also
       never expanded anywhere in the system, so nobody could learn it here.
     - Agronomy was one role for the whole function, so the system could not
       tell the lead from the people who work to her.
   The KEYS are unchanged where a role already existed, so no stored row moves
   and nobody's access changes when the labels do. */
const PD_ROLES = {
  coo: 'COO (chair)', ceo: 'CEO (advisor)', qc_head: 'QC Head',
  rta: 'R&D Manager', production: 'Production Manager',
  agronomy: 'Agronomy Lead',
  field_agronomy: 'Field Agronomist',
  associate_agronomy: 'Associate Agronomist',
  custodian: 'Data Custodian', registrar: 'Registrar',
  member: 'Team member', lab_tech: 'Lab Technician',
  consultant: 'Outside Reviewer (consultant)',
};

/* Drop box source labels (REUSE-RULES §2 item 3). */
const SOURCES = {
  team: 'Team / internal', farmer: 'Farmer', dealer: 'Dealer',
  regulator: 'Regulator', consultant: 'Consultant / outside reviewer',
  management: 'Management', other: 'Other',
};

function can_pd(pd_role, surface) { return allowed_surfaces(pd_role).includes(surface); }
/* Action-level role gate (inc/auth.php can()): the role must be in the
   allowed list, OR be 'coo' (the chair is implicitly allowed every write
   action). Unchanged. */
function can_role(pd_role, roles) { return roles.includes(pd_role) || pd_role === 'coo'; }

/* ---- Concurrency-safe sequential numbering (inc/db.php next_number / insert_numbered) ----
   Two people submitting at the same instant used to crash one of them on a
   duplicate-key error; this retries with the next free number instead.
   Generic infrastructure — not domain vocabulary, REUSE-RULES §2 items 2/3. */
async function next_number(q, table, col) {
  const [rows] = await q(`SELECT COALESCE(MAX(${col}),0)+1 AS n FROM ${table}`);
  return rows[0].n;
}
async function insert_numbered(q, table, col, insertFn, tries = 10) {
  for (let i = 0; i < tries; i++) {
    const n = await next_number(q, table, col);
    try { await insertFn(n); return n; }
    catch (e) { if (e && e.errno === 1062) continue; throw e; } // duplicate key -> retry
  }
  throw new Error(`Could not allocate a free ${col} in ${table} — try again.`);
}

/* ---- The Library (faithful port of inc/library.php constants + helpers, REUSE-RULES §2 item 2) ---- */
const LIB_KINDS = { note: 'Note — written here', link: 'Link — a paper or page elsewhere', document: 'Document — an uploaded file' };
const EVIDENCE = {
  verified: 'VERIFIED — a named source I have actually read',
  validate: 'VALIDATE — mechanism documented, VAN must confirm at the bench',
  open: 'OPEN — an idea or an opinion, not yet backed by a source',
};
const EVIDENCE_SHORT = { verified: 'VERIFIED', validate: 'VALIDATE', open: 'OPEN' };
const LIB_TYPES = {
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv: 'text/csv', txt: 'text/plain', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
};
const LIB_MAX_BYTES = 15 * 1024 * 1024;
const fmt_l = n => 'L-' + String(n).padStart(3, '0');
function human_size(b) { b = Number(b) || 0; if (b >= 1048576) return (Math.round(b / 1048576 * 10) / 10) + ' MB'; if (b >= 1024) return Math.round(b / 1024) + ' KB'; return b + ' bytes'; }
// A link must at least be http(s) and resolve to a host; returns '' if not.
function lib_clean_url(url) {
  url = String(url || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  try { const u = new URL(url); if (!u.hostname) return ''; } catch (e) { return ''; }
  return url.slice(0, 500);
}


/* ---------------------------------------------------------------------------
 * ADDED 9 Sept 2026 — the screens milestone (intake + triage). Everything
 * below serves MODEL.md §3/§5 and RECLASSIFICATION-RULES.md, which is a rules
 * file, not advice: "If code and this document disagree, this document wins."
 * ------------------------------------------------------------------------- */

/* ---- Permanent human-facing numbers (MODEL.md §4: killed and parked things
   keep their number forever). One formatter per object; CH-/O-/REQ- keep the
   exact shapes the drop-box triage already emitted, so no label anyone has
   seen changes meaning. ---- */
const fmt_q   = n => 'Q-'   + String(n).padStart(3, '0');
const fmt_b   = n => 'B-'   + String(n).padStart(3, '0');
const fmt_run = n => 'R-'   + String(n).padStart(3, '0');
const fmt_cl  = n => 'C-'   + String(n).padStart(3, '0');
const fmt_ch  = n => 'CH-'  + String(n).padStart(3, '0');
const fmt_o   = n => 'O-'   + String(n).padStart(3, '0');
const fmt_req = n => 'REQ-' + String(n).padStart(3, '0');

/* The three doors (MODEL.md §3). The order is the order the intake screen
   offers them, and the label is what a person reads — never the table name. */
const DOORS = {
  challenge:   { label: 'Something we sell is being complained about', short: 'Challenge',   table: 'pd_challenges',   numcol: 'challenge_number',   fmt: fmt_ch },
  observation: { label: 'Something arrived, or something was seen',    short: 'Observation', table: 'pd_observations', numcol: 'observation_number', fmt: fmt_o },
  request:     { label: 'Someone wants a sample or a product made',    short: 'Request',     table: 'pd_requests',     numcol: 'request_number',     fmt: fmt_req },
};

/* ---- The model's own glossary ----
   RECLASSIFICATION-RULES.md §2: the "why" recorded against a refiling "is NOT
   the corrector's prose. It is the model's own definition." These lines are
   the model's definitions, taken from MODEL.md §3, and they are what the
   system writes into pd_reclassifications.definition_text and into the
   author's notice. Nobody types them, and they read the same every time so
   they become familiar rather than corrective (§7).

   Changing a line here changes what FUTURE moves record. It never rewrites a
   notice already sent — pd_notices stores the sentence as it was sent. */
const OBJECT_DEFINITIONS = {
  problem:     'A Problem is a real field or market pain, or a stated product concept — the long-lived parent that every Question, Bet and Run aimed at it hangs off.',
  question:    'A Question is something we must know in order to solve a Problem. It has a nature, one owner, and a date it is due.',
  bet:         'A Bet is a specific approach taken because we believe something, carrying the one result that would kill it, written before any bench work.',
  run:         'A Run is one recipe made and measured, recording what was expected against what actually happened.',
  claim:       'A Claim is an assertion with an owner and an honest grade, which anyone may challenge.',
  challenge:   'A Challenge is a complaint about a product we already sell — usually carrying a buried claim that has to be made measurable before it can be answered.',
  observation: 'An Observation is a result or a material that arrived. Not a complaint, and not an idea.',
  request:     'A Request is someone asking for a sample or a product to be made, with a requester, a purpose, a recipient and a date it is needed by.',
  constraint:  'A Constraint is a rule that kills options, inherited by every product aimed through the delivery context it belongs to.',
};

/* Problem kinds (MODEL.md §3 / PENDING-DECISIONS.md §A4). A stated concept is
   a first-class Problem, not a lesser one — the labels say so. */
const PROBLEM_KINDS = {
  field_problem:   'A problem in the field or the market',
  product_concept: 'A product concept we want to build',
};

/* Question natures (MODEL.md §3). */
const QUESTION_NATURES = {
  agronomy: 'Agronomy', chemistry: 'Chemistry', production: 'Production',
  commercial: 'Commercial', regulatory: 'Regulatory',
};

/* ---- Router-level read access ----
   'library'  — anyone with a PD role (unchanged).
   'intake'   — anyone with a PD role. RECLASSIFICATION-RULES.md §3 and §8.3:
                no approval queue and no gate in front of a person trying to
                write something down.
   'triage'   — the moderator group. RECLASSIFICATION-RULES.md §10 asks for
                more than this: "granted like any other PD surface, NOT
                hard-coded to a role." What is below is centralised, which is
                not the same thing — adding one person to the group today
                means editing this array or changing that person's whole PD
                role. Making it a real grant needs a per-user surface table
                and a change to how server.js loads a PD user, which is
                PLATFORM work, not PD's to do (CLAUDE.md §0/§1). Flagged for
                Tahir in OP-HANDOFF.md rather than silently called done. */
const TRIAGE_ROLES = ['custodian', 'registrar', 'coo'];
function allowed_surfaces(pd_role) {
  if (!pd_role) return []; // no PD role at all -> no PD access
  const s = ['library', 'intake'];
  if (TRIAGE_ROLES.includes(pd_role)) s.push('triage');
  return s;
}

/* ---- The append-only field history (003_pd_history_and_notices.sql) ----
   RECLASSIFICATION-RULES.md §4: "Content is editable. The record of what it
   was is not." Call record_changes() with the row as it was and the fields
   being written; it writes one row per field that actually changed and
   returns how many. A field whose value did not change writes nothing — a
   history full of no-op rows is a history nobody reads. */
function _hval(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}
async function record_changes(q, objectType, objectId, before, after, userId, opts = {}) {
  const rows = [];
  for (const field of Object.keys(after)) {
    const o = _hval(before ? before[field] : null), n = _hval(after[field]);
    if (o === n) continue;
    rows.push([objectType, objectId, field, o, n, opts.kind || 'edit', userId, opts.note || null, opts.reclassification_id || null]);
  }
  if (!rows.length) return 0;
  await q(`INSERT INTO pd_field_history
      (object_type, object_id, field, old_value, new_value, change_kind, changed_by, free_note, reclassification_id)
      VALUES ${rows.map(() => '(?,?,?,?,?,?,?,?,?)').join(',')}`, rows.flat());
  return rows.length;
}
/* The compensating row (003's 'not_applied'). record_changes() writes the
   history BEFORE the record is changed, so nothing can change without its
   history — but the two writes are not one transaction, because these routes
   are handed a pooled query function rather than a connection. If the change
   is then refused, this appends a row saying so instead of removing the first
   one, which pd_field_history's triggers correctly forbid. The log stays
   true; it never claims a change that did not happen. */
async function record_not_applied(q, objectType, objectId, after, userId, why) {
  const fields = Object.keys(after || {});
  if (!fields.length) return 0;
  const rows = fields.map(f => [objectType, objectId, f, null, _hval(after[f]), 'not_applied', userId, String(why || '').slice(0, 500), null]);
  await q(`INSERT INTO pd_field_history
      (object_type, object_id, field, old_value, new_value, change_kind, changed_by, free_note, reclassification_id)
      VALUES ${rows.map(() => '(?,?,?,?,?,?,?,?,?)').join(',')}`, rows.flat());
  return rows.length;
}

/* A copy of what a record said at the moment it was refiled (§4, "the field
   values as filed"). Written as old_value only: it is not a change to the
   record, it is what the record was. */
async function snapshot_on_move(q, objectType, objectId, row, userId, reclassificationId, skip = []) {
  const after = {};
  for (const k of Object.keys(row || {})) {
    if (skip.includes(k) || row[k] === null || row[k] === undefined || row[k] === '') continue;
    after[k] = null;                       // new_value NULL — nothing replaced it
  }
  const rows = Object.keys(after).map(f => [objectType, objectId, f, _hval(row[f]), null, 'snapshot_on_move', userId, null, reclassificationId]);
  if (!rows.length) return 0;
  await q(`INSERT INTO pd_field_history
      (object_type, object_id, field, old_value, new_value, change_kind, changed_by, free_note, reclassification_id)
      VALUES ${rows.map(() => '(?,?,?,?,?,?,?,?,?)').join(',')}`, rows.flat());
  return rows.length;
}

/* ---- The author's notice (RECLASSIFICATION-RULES.md §7) ----
   Three parts and nothing else: what it became, the definition of the new
   type, and who moved it. No advice, no count of previous moves, no link to
   training, no apology, nothing shaped like feedback. The wording below is
   the whole message the author will read, and it is checked against §6's
   banned vocabulary by the test suite, not by good intentions. */
async function notify_refiled(q, { recipientId, movedById, newType, newLabel, linkType, linkId, reclassificationId }) {
  if (!recipientId) return 0;                       // a system-authored row has no author to tell
  if (recipientId === movedById) return 0;          // nobody needs a notice about their own filing act
  const headline = `Your entry is now ${DOORS[newType] ? DOORS[newType].short : newType.charAt(0).toUpperCase() + newType.slice(1)} ${newLabel}.`;
  await q(`INSERT INTO pd_notices (recipient_id, headline, definition_text, moved_by, link_type, link_id, reclassification_id)
           VALUES (?,?,?,?,?,?,?)`,
    [recipientId, headline, OBJECT_DEFINITIONS[newType] || '', movedById, linkType || newType, linkId || null, reclassificationId || null]);
  return 1;
}

/* ---------------------------------------------------------------------------
 * ADDED 9 Sept 2026 (later) — the spine: Question, Bet, Run, Claim.
 * MODEL.md §3/§4. The two hard rules from §0 are what the routes enforce:
 *   "Nothing gets made until we have written the question it answers."
 *   "Nothing gets closed until we have written the result — pass, fail, or
 *    parked, and why."
 * The first is structural: a Run needs a Bet, a Bet needs a Question and a
 * written kill criterion, a Question needs a Problem. The database says so
 * (NOT NULL foreign keys, NOT NULL kill_criterion) so no route can forget it.
 * The second cannot be a foreign key — a status column and a claim in another
 * table are not something MySQL can tie together reliably — so it lives in
 * can_close() and in the routes, and the test suite pins it.
 * ------------------------------------------------------------------------- */

/* Who may ASSIGN and CLOSE. Tahir's ruling, 9 Sept 2026: "open to write,
   restricted to assign." Anyone with a PD role may open a Question, a Bet or a
   Run — the structure is the discipline, and gating who may propose work is
   exactly what stops work being written down. Naming somebody else the owner,
   settling a Question and closing a Bet or a Run stay with the technical leads
   and the COO. A person always owns what they opened until a lead moves it,
   and the owner may close their own. */
const LEAD_ROLES = ['qc_head', 'rta', 'production', 'agronomy',
  // Both added 10 Sept 2026 on Tahir's ruling. A lead may name someone else
  // the owner of a Question, Bet or Run, settle a Question, and close work
  // that is not their own. Everyone with any PD role can already write and
  // record freely — this list is only about assigning and closing.
  'field_agronomy', 'associate_agronomy',
  'custodian', 'coo'];
const is_lead = pd_role => LEAD_ROLES.includes(pd_role) || pd_role === 'coo';

/* Labels — the words the screen uses. The stored values are the ENUMs in
   002_pd_core_rebuild.sql; these are never stored, only shown. */
const QUESTION_STATES = {
  open: 'Open — nobody has answered it yet',
  contested: 'Contested — there are claims on both sides',
  settled: 'Settled — we have an answer we stand behind',
};
const BET_STATUSES = {
  active: 'Running',
  killed: 'Killed — the kill criterion was met',
  advanced: 'Advanced — it earned the next step',
};
const RUN_STATUSES = {
  running: 'Running',
  abnormal_investigation: 'Something abnormal — an investigation is open',
  closed: 'Closed',
};
const CLAIM_GRADES = {
  proven: 'Proven — we have evidence we would defend',
  contested: 'Contested — the evidence points both ways',
  believed: 'Believed — held on experience, mechanism unknown',
};
const READING_VERDICTS = { normal: 'Nothing unexpected', abnormal: 'Something abnormal' };
const CONSTRAINT_KINDS = {
  blending: 'Blending', storage_crh: 'Storage / CRH', logistics_freight: 'Logistics / freight',
  regulatory: 'Regulatory', plant_capability: 'What the plant can do',
};

/* ---- The plant-wide context (Tahir's ruling, 11 Sept 2026 — "B2") ----
   MODEL.md §3 lists `plant_capability` above — "what the plant can do" — as a
   kind of Constraint. But every Constraint must name a delivery context, so a
   rule about the PLANT ITSELF ("we cannot crystallise at scale", "the
   granulator will not take material finer than X mesh") had nowhere to live:
   filed under fertigation it is wrong there and invisible to the other five
   contexts; filed six times it is exactly the duplication this register exists
   to prevent. MODEL.md's own sentence gives it away — the register is "the
   no-duplication mechanism on the DELIVERY side". There was no plant side.

   The case that exposed it was the bio-boiler fly-ash potash recovery: the
   bench recovers it, the plant cannot reproduce it, and that fact could not be
   written down anywhere in PD.

   Ruled: ONE more row in the same register, pinned to this id by
   007_plant_wide_context.sql, inherited by EVERY Bet whatever context it is
   aimed through. A second plant-side register was considered and dropped, so
   this row is a permanent member of the vocabulary and not a stopgap — it is
   the only place a plant-capability rule belongs.

   Two things follow, both enforced in pd-routes.js:
     · a Bet may NOT be "aimed through" it — it is not a way of delivering
       anything, and a Bet aimed there would inherit it twice and nothing else;
     · every Bet inherits it in addition to its own context's constraints. */
const PLANT_WIDE_CONTEXT_ID = 90;

/* An enum gate that cannot be walked through Object.prototype. `GRADES[x]`
   is truthy for 'constructor' and 'toString'; hasOwnProperty is not. The
   door and spine table maps already guard this way — the vocabulary lookups
   did not, until review found the gap. */
function has(map, key) { return Object.prototype.hasOwnProperty.call(map, String(key)); }

/* MODEL.md §0, hard rule 2. Returns a sentence when a close must be refused,
   or '' when it may go ahead. A written result is not a formality here: it is
   the whole reason the object exists. */
function close_refusal(resultText, grade) {
  // Only a string counts as a written result. An object arriving here used to
  // stringify to "[object Object]", which is 15 characters and cleared the
  // floor — hard rule 2 satisfied in the letter and nowhere else.
  const t = (typeof resultText === 'string' || typeof resultText === 'number') ? String(resultText).trim() : '';
  if (t.length < 15) return 'Write the result first — what happened, in a sentence or two. Nothing gets closed until we have written the result, pass, fail or parked, and why.';
  if (!has(CLAIM_GRADES, grade)) return 'Grade the result honestly: proven, contested, or believed.';
  return '';
}

module.exports = {
  fmt_p, fmt_q, fmt_b, fmt_run, fmt_cl, fmt_ch, fmt_o, fmt_req,
  PD_ROLES, SOURCES, DOORS, OBJECT_DEFINITIONS, PROBLEM_KINDS, QUESTION_NATURES, TRIAGE_ROLES,
  record_changes, record_not_applied, snapshot_on_move, notify_refiled,
  LEAD_ROLES, is_lead, close_refusal, has,
  QUESTION_STATES, BET_STATUSES, RUN_STATUSES, CLAIM_GRADES, READING_VERDICTS, CONSTRAINT_KINDS,
  PLANT_WIDE_CONTEXT_ID,
  allowed_surfaces, can_pd, can_role,
  next_number, insert_numbered,
  LIB_KINDS, EVIDENCE, EVIDENCE_SHORT, LIB_TYPES, LIB_MAX_BYTES, fmt_l, human_size, lib_clean_url,
};
