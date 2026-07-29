/* ---------------------------------------------------------------------------
 * PD (Product Development) domain rules — ported from the standalone
 * van-rd-app PHP application (inc/db.php + inc/auth.php), which had already
 * gone through several shipped versions and 182 passing test assertions as
 * of v2.2 (2026-07-29). This file keeps those decisions intact rather than
 * re-deriving them: the two-lane screening split, the six gates, the
 * concurrency-safe numbering, and the per-role page/action allow-lists.
 *
 * Source of truth for anything not yet ported here is the original PHP app
 * (kept, un-deployed further, purely as a reference spec — see the handoff
 * notes). This module is intentionally faithful to that source rather than
 * "improved," so behaviour doesn't silently drift during the port.
 * ------------------------------------------------------------------------- */

/* ---- ID formatting helpers (inc/db.php fmt_h / fmt_s / fmt_t / fmt_p / fmt_prj) ---- */
const fmt_h   = n => 'H-' + String(n).padStart(3, '0');
const fmt_s   = n => 'VAN-S-' + String(n).padStart(4, '0');
const fmt_t   = n => 'T-' + String(n).padStart(4, '0');
const fmt_p   = n => 'P-' + String(n).padStart(2, '0');
const fmt_prj = n => 'PRJ-' + String(n).padStart(2, '0');

const STAGES = {
  proposed: 'Proposed', screened: 'Screened', designed: 'Designed',
  sampled: 'Sampled', tested: 'Tested (lab)', evaluated: 'Evaluated',
  field_trial: 'Field trial', validated: 'Validated / Adopted',
  parked: 'Parked', killed: 'Killed',
};

/* PD role vocabulary (10 roles) — deliberately separate from O2S's own
   8-role vocabulary. A person's O2S role (COO, KAM, ...) and PD role
   (coo, member, ...) are two independent attributes of the SAME account,
   stored as auth_users.role and auth_users.pd_role. NULL pd_role = no PD
   access at all, same as "Team members have none" in the PHP app. */
const PD_ROLES = {
  coo: 'COO (chair)', ceo: 'CEO (advisor)', qc_head: 'QC Head',
  rta: 'Plant Manager (RTA)', production: 'Production Manager',
  agronomy: 'Agronomy', custodian: 'Data Custodian', member: 'Team member',
  lab_tech: 'Lab Technician', consultant: 'Outside Reviewer (consultant)',
};

const SOURCES = {
  team: 'Team / internal', farmer: 'Farmer', dealer: 'Dealer',
  regulator: 'Regulator', consultant: 'Consultant / outside reviewer',
  management: 'Management', other: 'Other',
};

const GATES = {
  G1: 'G1 · Screen', G2: 'G2 · Design approval', G3: 'G3 · Beaker gate',
  G4: 'G4 · Bench evaluation', G5: 'G5 · Field trial approval', G6: 'G6 · Scale-up & production',
};
const GATE_SLA_DAYS = 15;

const CHANGE_TYPES = {
  new: 'Brand-new product concept',
  reformulation: 'Improve / re-engineer an existing formulation',
  variant: 'New variant of an existing product',
  process: 'Process / manufacturing improvement',
  challenge: 'Challenge to a product we already make',
};
const HEAVY_TYPES = ['new'];
const LANES = { heavy: 'Heavy — new product concept', light: 'Light — improvement / variant / fix' };
const LIGHT_REVERSAL_DAYS = 7;

function lane_for(change_type) { return HEAVY_TYPES.includes(change_type) ? 'heavy' : 'light'; }

/** Who screens G1 on this lane: [primaryRole, deputyRole, label]. */
function screener_for(lane) {
  return lane === 'light'
    ? ['qc_head', 'rta', "the PD Lead (the QC Head's hat), with the Plant Manager as deputy"]
    : ['coo', 'rta', 'the COO, with the Plant Manager as backup'];
}
function may_screen(pd_role, lane) {
  const [primary, deputy] = screener_for(lane);
  return [primary, deputy, 'coo'].includes(pd_role);
}
function screens_as_deputy(pd_role, lane) {
  const [primary, deputy] = screener_for(lane);
  return pd_role === deputy && pd_role !== primary;
}

/* NOTE on G1: db.php's GATE_OUTCOMES.G1 constant (kept below verbatim, matching
   the PHP source) lists advance/park/kill/reclassify as labels, but the actual
   screening form in hypothesis.php posts a DIFFERENT, older vocabulary —
   screen_decision is one of log/park/kill/merge (schema.sql's ENUM), mapped to
   stage (log->screened, park->parked, kill/merge->killed) and only THEN
   translated into the gate_decisions "engine" value (log->advance, park->park,
   kill/merge->kill). This is a real inconsistency in the source app between
   the constant and the form, not something introduced by this port — ported
   here as PD_SCREEN_DECISIONS to match what the form (and therefore the
   database CHECK/ENUM) actually enforces. */
const PD_SCREEN_DECISIONS = {
  log: 'LOG — worth designing (advance)', park: 'PARK — not now (set re-look condition)',
  kill: 'KILL — with reason, kept forever', merge: 'MERGE — into an existing hypothesis',
};
const SCREEN_TO_STAGE = { log: 'screened', park: 'parked', kill: 'killed', merge: 'killed' };
const SCREEN_TO_GATE_DECISION = { log: 'advance', park: 'park', kill: 'kill', merge: 'kill' };

const GATE_OUTCOMES = {
  G1: [['advance', 'LOG — worth designing (opens a route)'], ['park', 'PARK — good, not now'], ['kill', 'CLOSE — not viable, reason kept'], ['reclassify', 'RECLASSIFY — really a Problem or Product Challenge']],
  G2: [['advance', 'SIGN — design approved, bench may open'], ['return', 'RETURN — send back to fix the record (not a kill)'], ['kill', 'REJECT — unsound on paper, closed with reason']],
  G3: [['advance', 'ADVANCE — fund the bench, runs may begin'], ['iterate', 'ITERATE — tighten the route before spending'], ['park', 'PARK — budget/priority hold'], ['kill', 'KILL — close before materials are committed']],
  G4: [['advance', 'ADVANCE — a run met the criteria, promote it to Formulation v1'], ['iterate', 'ITERATE — near miss, another combination is worth a run'], ['park', 'PARK — shelve for later'], ['kill', 'KILL — no run met the bar, closed with reason']],
  G5: [['advance', 'ADVANCE — beat the DAP control, move toward launch'], ['iterate', 'REPEAT — inconclusive, run another season/site'], ['park', 'PARK — hold'], ['kill', 'KILL — did not perform in the field']],
  G6: [['advance', 'LAUNCH — make it at the agreed margin, hand to Production'], ['park', 'HOLD — registration/costing/supply must clear first'], ['kill', 'STOP — not commercially viable']],
};

/* ---- Router-level read access (inc/auth.php BASE_PAGES / OPERATOR_PAGES / allowed_pages) ----
   Ported as API "surfaces" rather than PHP page names. Every /api/pd/* route
   declares which surface it belongs to; pdRequireSurface() below enforces it
   the same way the PHP router did: a hidden button is never the only lock. */
const BASE_SURFACES = ['home', 'ideas.own', 'ideas.new', 'guide'];
const OPERATOR_SURFACES = ['mywork', 'ideas.all', 'gatelog', 'screen'];

function allowed_surfaces(pd_role) {
  switch (pd_role) {
    case 'member': return BASE_SURFACES;
    case 'consultant': return [...BASE_SURFACES, 'ideas.all', 'gatelog'];
    case 'ceo': return [...BASE_SURFACES, 'mywork', 'ideas.all', 'gatelog'];
    case 'lab_tech': return [...BASE_SURFACES, 'mywork'];
    case 'coo': case 'custodian': return [...BASE_SURFACES, ...OPERATOR_SURFACES, 'admin'];
    case 'qc_head': case 'rta': case 'production': case 'agronomy':
      return [...BASE_SURFACES, ...OPERATOR_SURFACES];
    default: return []; // no pd_role at all -> no PD access, same as the PHP app
  }
}
function can_pd(pd_role, surface) { return allowed_surfaces(pd_role).includes(surface); }
function may_see_all_ideas(pd_role) { return pd_role !== 'member' && !!pd_role; }
function landing_for_pd(pd_role) {
  if (['member', 'consultant'].includes(pd_role)) return 'home';
  if (pd_role === 'ceo') return 'index';
  return 'mywork';
}

/* ---- Concurrency-safe sequential numbering (inc/db.php next_number / insert_numbered) ----
   Two people submitting at the same instant used to crash one of them on a
   duplicate-key error; this retries with the next free number instead. */
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

module.exports = {
  fmt_h, fmt_s, fmt_t, fmt_p, fmt_prj,
  STAGES, PD_ROLES, SOURCES, GATES, GATE_SLA_DAYS,
  CHANGE_TYPES, HEAVY_TYPES, LANES, LIGHT_REVERSAL_DAYS,
  lane_for, screener_for, may_screen, screens_as_deputy, GATE_OUTCOMES,
  PD_SCREEN_DECISIONS, SCREEN_TO_STAGE, SCREEN_TO_GATE_DECISION,
  allowed_surfaces, can_pd, may_see_all_ideas, landing_for_pd,
  next_number, insert_numbered,
};
