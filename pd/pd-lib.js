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
/* Product-concept gates A–E (portfolio) — a concept is judged on these, distinct from the idea gates G1–G6. */
const CONCEPT_GATES = {
  A: 'Gate A — Rock assay: is local rock a real input or a liability?',
  B: 'Gate B — Mass balance beats DAP on paper (cost per unit P delivered)',
  C: 'Gate C — Bench release curve shows the claimed fast+slow split',
  D: 'Gate D — Freedom to operate (patents; novelty lives in specifics)',
  E: 'Gate E — Field PUE vs DAP demonstrated (the claim that sells)',
};
const PROJECT_STATUS = { open: 'Open — routes running', parked: 'Parked', closed: 'Closed' };
const PROBLEM_STATUS = ['open', 'being_addressed', 'solved', 'retired'];
const PRODUCT_STATUS = ['active', 'parked', 'launched', 'closed'];
const GATE_SLA_DAYS = 15;
/* Committee gates (G3-G6) advance the pipeline stage when the decision is 'advance'
   — ported from gates.php's $advance_map. G1/G2 advance elsewhere (screen / record). */
const GATE_ADVANCE_STAGE = { G3: 'sampled', G4: 'evaluated', G5: 'field_trial', G6: 'validated' };

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
const BASE_SURFACES = ['home', 'ideas.own', 'ideas.new', 'guide', 'library'];
const OPERATOR_SURFACES = ['mywork', 'ideas.all', 'gatelog', 'screen', 'records', 'samples', 'candidates', 'trials', 'registers', 'learnings', 'formulations', 'regulatory'];

function allowed_surfaces(pd_role) {
  switch (pd_role) {
    case 'member': return BASE_SURFACES;
    case 'consultant': return [...BASE_SURFACES, 'ideas.all', 'gatelog', 'records', 'registers'];
    case 'ceo': return [...BASE_SURFACES, 'mywork', 'ideas.all', 'gatelog', 'records', 'candidates', 'trials', 'registers', 'learnings', 'formulations', 'regulatory'];
    case 'lab_tech': return [...BASE_SURFACES, 'mywork', 'samples', 'candidates'];
    case 'coo': case 'custodian': return [...BASE_SURFACES, ...OPERATOR_SURFACES, 'admin', 'audit', 'dropbox'];
    case 'qc_head': case 'rta': case 'production': case 'agronomy':
      return [...BASE_SURFACES, ...OPERATOR_SURFACES];
    default: return []; // no pd_role at all -> no PD access, same as the PHP app
  }
}
function can_pd(pd_role, surface) { return allowed_surfaces(pd_role).includes(surface); }
/* Action-level role gate, ported from inc/auth.php can(): the role must be in the
   allowed list, OR be 'coo' (the chair is implicitly allowed every write action). */
function can_role(pd_role, roles) { return roles.includes(pd_role) || pd_role === 'coo'; }
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

/* ---- Pre-bench candidate screen (faithful port of inc/screen.php) ----
   Pure arithmetic: mass balance, a target window, a landed-cost ceiling, and VAN's
   own compatibility table. No chemistry, no AI. The analysis is computed FROM the
   recipe, so the number stops being a placeholder someone typed in. */
const INCLUSION_TOLERANCE = 0.5;  // tolerance on "the recipe adds up to 100%"
const CONFLICT_MIN_PCT = 1.0;     // below this inclusion, a material is a trace for conflict purposes
const CEILING_MARGIN = 0.05;      // within this fraction of the ceiling -> borderline, not pass
const ASSAY_BASIS = {
  placeholder: 'PLACEHOLDER — not VAN data', standard_grade: 'Standard grade definition',
  supplier_spec: "Supplier's spec sheet", van_assay: 'VAN lab assay',
};
const COST_BASIS = {
  placeholder: 'PLACEHOLDER — not VAN data', quote: 'Supplier quote', invoice: 'VAN purchase invoice',
};
const fmt_c = n => 'C-' + String(n).padStart(2, '0');
const rs_fmt = n => 'Rs ' + Math.round(n).toLocaleString('en-US'); // PHP number_format($n, 0)
const _r3 = x => Math.round(x * 1000) / 1000;
const _r2 = x => Math.round(x * 100) / 100;

/** The whole screen, on numbers only. lines: [{material, pct}]; rs: route_screens row;
    conflicts: the pd_material_conflicts rows (with .ca/.cb codes) applicable to the present materials. */
function screen_candidate(lines, rs, conflicts) {
  let total = 0, n = 0, p = 0, s = 0, zn = 0, rm = 0, provisional = false; const prov_why = [];
  for (const l of lines) {
    const m = l.material, pct = Number(l.pct) || 0, f = pct / 100;
    total += pct; n += f * Number(m.n_pct); p += f * Number(m.p2o5_pct); s += f * Number(m.s_pct); zn += f * Number(m.zn_pct); rm += f * Number(m.cost_per_tonne);
    if (m.cost_basis === 'placeholder') { provisional = true; prov_why.push(m.code + ' price'); }
    if (m.assay_basis === 'placeholder') { provisional = true; prov_why.push(m.code + ' assay'); }
  }
  // Ex-works cost, exactly as the cost-parity workbook builds it: (raw materials + conversion) / (1 - process loss).
  const loss = Math.max(0, Math.min(0.95, Number(rs.process_loss_pct) / 100));
  const exworks = (rm + Number(rs.conversion_cost_per_tonne)) / (1 - loss);
  /* FIX A6 — the divide-by-zero guard used zero as its sentinel, and zero is the BEST possible
     value in every ranking in this system. A candidate containing no phosphorus therefore
     scored "cheapest" and headed the make-queue. null sorts last in MySQL's ORDER BY ASC and
     reads as "not applicable" rather than "free". */
  const cost_per_kg_p = p > 0 ? exworks / (10 * p) : null; // 1 t x p% = 10p kg P2O5
  const fails = [], warns = [];
  if (Math.abs(total - 100) > INCLUSION_TOLERANCE) fails.push(`Recipe is not closed: inclusions total ${total.toFixed(2)}%, not 100%.`);
  const ceiling = Number(rs.cost_ceiling_per_tonne);
  if (ceiling > 0) {
    if (exworks > ceiling) fails.push(`Over the ex-works cost ceiling by ${rs_fmt(exworks - ceiling)}/tonne (${rs_fmt(exworks)} vs ${rs_fmt(ceiling)}).`);
    else if (exworks > ceiling * (1 - CEILING_MARGIN)) warns.push(`Within ${Math.round(CEILING_MARGIN * 100)}% of the cost ceiling — no headroom for conversion-cost surprises (${rs_fmt(exworks)} vs ${rs_fmt(ceiling)}).`);
  } else warns.push('No cost ceiling is set for this route, so cost was not judged. Set it from the DAP cost-parity model.');
  /* FIX A6 — a phosphate route whose recipe carries no phosphorus is not a borderline case,
     it is a mistake. Say so outright rather than letting it through on a zero target. */
  if (p <= 0) fails.push('This recipe contains no phosphorus at all. Every route here is a phosphate route — check the materials and their inclusions.');
  else if (p < Number(rs.target_p2o5_min)) fails.push(`P2O5 ${p.toFixed(2)}% is below the route target minimum of ${Number(rs.target_p2o5_min).toFixed(2)}%.`);
  if (Number(rs.target_p2o5_max) < 100 && p > Number(rs.target_p2o5_max)) warns.push(`P2O5 ${p.toFixed(2)}% is above the target maximum of ${Number(rs.target_p2o5_max).toFixed(2)}% — check the grade is still what you meant to make.`);
  if (n < Number(rs.target_n_min)) warns.push(`N ${n.toFixed(2)}% is below the target minimum of ${Number(rs.target_n_min).toFixed(2)}%. The farmer buys the shortfall as urea; that cost sits in the parity model, not here.`);
  if (Number(rs.target_n_max) < 100 && n > Number(rs.target_n_max)) warns.push(`N ${n.toFixed(2)}% is above the target maximum of ${Number(rs.target_n_max).toFixed(2)}%.`);
  if (Number(rs.target_s_min) > 0 && s < Number(rs.target_s_min)) warns.push(`S ${s.toFixed(2)}% is below the target minimum of ${Number(rs.target_s_min).toFixed(2)}% — the sulphur half of the visible farmer win is thin.`);
  if (Number(rs.target_zn_min) > 0 && zn < Number(rs.target_zn_min)) warns.push(`Zn ${zn.toFixed(2)}% is below the target minimum of ${Number(rs.target_zn_min).toFixed(2)}% — dose for the crop, not for the granule.`);
  // Physical compatibility, from VAN's own table. An unconfirmed pair warns but never kills.
  for (const c of (conflicts || [])) {
    const pair = c.ca + ' + ' + c.cb, confirmed = !!c.confirmed_at;
    const txt = pair + ': ' + c.reason + (confirmed ? '' : ' [UNCONFIRMED — advisory only until the QC Head confirms it]');
    if (c.severity === 'avoid' && confirmed) fails.push('Incompatible pair — ' + txt);
    else warns.push((c.severity === 'avoid' ? 'Flagged incompatible — ' : 'Compatibility caution — ') + txt);
  }
  const verdict = fails.length ? 'fail' : (warns.length ? 'borderline' : 'pass');
  const reasons = [...fails.map(f => 'FAIL · ' + f), ...warns.map(w => 'NOTE · ' + w)];
  if (provisional) reasons.push('PROVISIONAL · Priced or assayed on placeholders (' + [...new Set(prov_why)].join(', ') + '). This ranking is a shape, not a costing. Replace with VAN procurement and assay data before it decides anything.');
  if (!reasons.length) reasons.push('Passes on every arithmetic test: recipe closed, inside the target window, under the cost ceiling, no compatibility flags.');
  return { total: _r3(total), n: _r3(n), p2o5: _r3(p), s: _r3(s), zn: _r3(zn), rm_cost: _r2(rm), exworks: _r2(exworks),
           cost_per_kg_p: cost_per_kg_p === null ? null : _r2(cost_per_kg_p),
           provisional: provisional ? 1 : 0, verdict, reasons: reasons.join('\n') };
}
const CONFLICT_MIN_PCT_EXPORT = CONFLICT_MIN_PCT;

/* Seed rows for the materials register, from VAN's "Route Cost Build-up" sheet — whose own
   Sources and Flags tab says none of its prices are VAN data, so every price is a placeholder.
   [code, name, N%, P2O5%, S%, Zn%, Rs/tonne, assay_basis, cost_basis, spec_note] */
const MATERIALS_SEED = [
  ['PA54', 'Merchant phosphoric acid, 54% P2O5', 0, 54, 0, 0, 260000, 'placeholder', 'placeholder', 'P2O5 % and MgO. Low MgO matters for any polyphosphate route.'],
  ['H2SO4', 'Sulphuric acid, 98%', 0, 0, 32.7, 0, 55000, 'standard_grade', 'placeholder', 'Commercial grade. S shown as elemental S in the acid.'],
  ['ROCK28', 'Local rock phosphate, ~28% P2O5', 0, 28, 0, 0, 28000, 'placeholder', 'placeholder', 'Full assay FIRST — P2O5, CaO, MgO, R2O3 (Fe+Al), F, Cd. R2O3 must be low.'],
  ['MAP', 'MAP, granular (11-52-0)', 11, 52, 0, 0, 210000, 'standard_grade', 'placeholder', 'Grade definition. Confirm the delivered assay.'],
  ['AS', 'Ammonium sulphate (21-0-0-24S)', 21, 0, 24, 0, 55000, 'standard_grade', 'placeholder', 'Nitrogen plus sulphur.'],
  ['AMHUM', 'Ammonium humate', 5, 0, 0, 0, 180000, 'placeholder', 'placeholder', 'State humic-acid %, water-solubility %, insolubles/ash and mesh — not just "humate". N ~5% per the Routes memo.'],
  ['ZNSO4', 'Zinc sulphate monohydrate, ~33% Zn', 0, 0, 17.8, 33, 700000, 'standard_grade', 'placeholder', 'Monohydrate ~33% Zn, heptahydrate ~21%. Confirm WHICH hydrate VAN buys — it changes the Zn cost by about half.'],
  ['SULPH', 'Elemental sulphur', 0, 0, 90, 0, 60000, 'placeholder', 'placeholder', 'Particle size controls oxidation rate — coarse S does nothing in-season.'],
  ['BINDER', 'Binder / coating aid', 0, 0, 0, 0, 150000, 'placeholder', 'placeholder', 'Must survive Pakistani storage humidity without caking.'],
  ['FILLER', 'Filler / conditioner', 0, 0, 0, 0, 20000, 'placeholder', 'placeholder', 'Weight, not function. A large number here is a design flag.'],
];

/* ---- The Library (faithful port of inc/library.php constants + helpers) ---- */
const LIB_KINDS = { note: 'Note — written here', link: 'Link — a paper or page elsewhere', document: 'Document — an uploaded file' };
const EVIDENCE = {
  verified: 'VERIFIED — a named source I have actually read',
  validate: 'VALIDATE — mechanism documented, VAN must confirm at the bench',
  open: 'OPEN — a hypothesis or an opinion',
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
  fmt_h, fmt_s, fmt_t, fmt_p, fmt_prj,
  STAGES, PD_ROLES, SOURCES, GATES, GATE_SLA_DAYS, GATE_ADVANCE_STAGE,
  CONCEPT_GATES, PROJECT_STATUS, PROBLEM_STATUS, PRODUCT_STATUS,
  CHANGE_TYPES, HEAVY_TYPES, LANES, LIGHT_REVERSAL_DAYS,
  lane_for, screener_for, may_screen, screens_as_deputy, GATE_OUTCOMES,
  PD_SCREEN_DECISIONS, SCREEN_TO_STAGE, SCREEN_TO_GATE_DECISION,
  allowed_surfaces, can_pd, can_role, may_see_all_ideas, landing_for_pd,
  next_number, insert_numbered,
  screen_candidate, ASSAY_BASIS, COST_BASIS, fmt_c, rs_fmt, MATERIALS_SEED, CONFLICT_MIN_PCT,
  LIB_KINDS, EVIDENCE, EVIDENCE_SHORT, LIB_TYPES, LIB_MAX_BYTES, fmt_l, human_size, lib_clean_url,
};
