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
const PD_ROLES = {
  coo: 'COO (chair)', ceo: 'CEO (advisor)', qc_head: 'QC Head',
  rta: 'Plant Manager (RTA)', production: 'Production Manager',
  agronomy: 'Agronomy', custodian: 'Data Custodian', registrar: 'Registrar',
  member: 'Team member', lab_tech: 'Lab Technician',
  consultant: 'Outside Reviewer (consultant)',
};

/* Drop box source labels (REUSE-RULES §2 item 3). */
const SOURCES = {
  team: 'Team / internal', farmer: 'Farmer', dealer: 'Dealer',
  regulator: 'Regulator', consultant: 'Consultant / outside reviewer',
  management: 'Management', other: 'Other',
};

/* ---- Router-level read access ----
   Trimmed 9 Sept 2026: 'library' is the only surface any surviving route
   still checks. A person with any PD role at all may read the Library —
   same effective behaviour as the old BASE_SURFACES list, minus every
   surface whose route no longer exists. */
function allowed_surfaces(pd_role) {
  if (!pd_role) return []; // no PD role at all -> no PD access
  return ['library'];
}
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

module.exports = {
  fmt_p, PD_ROLES, SOURCES,
  allowed_surfaces, can_pd, can_role,
  next_number, insert_numbered,
  LIB_KINDS, EVIDENCE, EVIDENCE_SHORT, LIB_TYPES, LIB_MAX_BYTES, fmt_l, human_size, lib_clean_url,
};
