'use strict';
/* O2S roles service for the platform's Roles by app screen (Tahir, 28 Oct 2026; platform docs/ROLES-DESIGN.md §4, trial).
 * MODULE: O2S. Only a System Administrator designs O2S's roles. O2S keeps its roles where they always were, in its own
 * data (masters.roles, masters.roleRights, masters.roleRightsSet), and this file edits them on the server through the
 * same revision-guarded save the app uses, so an O2S screen that is open merges the change at its next sync.
 * The rights list, which rights are in force and the separation of duties are read from o2s.html itself, so the
 * platform screen and the app can never disagree about them. A role is keyed by its NAME, as user_module_roles holds it.
 * Mounted by one guarded line in server.js. */
const vm = require('vm');

module.exports = function mountO2sRolesvc(app, deps) {
  const { store, pdq, auth, fs, path } = deps, SV = deps.services || {};
  let L = null, loadError = null;
  try {
    const html = fs.readFileSync(path.join(__dirname, 'o2s.html'), 'utf8');
    const cut = (start, end) => { const a = html.indexOf(start); if (a < 0) throw new Error(start + ' not found in o2s.html'); const b = html.indexOf(end, a); if (b < 0) throw new Error('end of ' + start + ' not found'); return html.slice(a, b + end.length); };
    const ctx = {};
    vm.runInNewContext(cut('var RIGHTS=[', '\n];') + '\n' + cut('var RIGHTS_LIVE={', '\n};') + '\n' + cut('var SEPARATION=[', '\n];') + '\n' + cut('var SIGNOFF_ROLES={', '};') + '\n' + cut('var SIGNOFF_NAMES={', '};')
      + '\n' + cut('var TRUCK_REVIEW_ROLES=', ';') + '\n' + cut('var SIGNOFF_RULES={', '\n};')
      + '\nthis.L={RIGHTS:RIGHTS,RIGHTS_LIVE:RIGHTS_LIVE,SEPARATION:SEPARATION,SIGNOFF_ROLES:SIGNOFF_ROLES,SIGNOFF_NAMES:SIGNOFF_NAMES,SIGNOFF_RULES:SIGNOFF_RULES};', ctx, { timeout: 1000 });
    L = ctx.L; if (!Array.isArray(L.RIGHTS) || !L.RIGHTS.length) throw new Error('no rights read');
    // Each screen's owners (who may edit it when the access matrix says nothing), for the rights still decided by screen access.
    L.OWNERS = {}; html.replace(/\{id:'([a-z0-9_-]+)'[^{}]*?owners:\[([^\]]*)\]/gi, (m, id, list) => { if (!L.OWNERS[id]) L.OWNERS[id] = (list.match(/'([^']+)'/g) || []).map(x => x.slice(1, -1)); return m; });
    // The screens a role may be given (o2s.html SCREENS), without the 5 every role always sees, as O2S's own role editor (roleScreens) leaves them out.
    { const a = html.search(/const SCREENS\s*=\s*\[/); if (a < 0) throw new Error('SCREENS not found in o2s.html'); const blk = html.slice(a, html.indexOf('\n];', a));
      L.SCREENS = []; L.ALLSCREENS = []; const re = /\{id:'([a-z0-9_-]+)', name:'([^']+)'/g; let m; while ((m = re.exec(blk))) { L.ALLSCREENS.push(m[1]); if (['today', 'approvals', 'dash', 'backoffice', 'plant'].indexOf(m[1]) < 0) L.SCREENS.push({ id: m[1], name: m[2] }); }
      if (!L.SCREENS.length) throw new Error('no screens read'); }
  } catch (e) { loadError = 'The O2S roles service could not read its rights list: ' + e.message; console.error('[o2s rolesvc] ' + loadError); }
  const CODES = L ? L.RIGHTS.map(r => r.code) : [];
  /* Review of 28 Oct 2026: only the rights IN FORCE (RIGHTS_LIVE) are answered from the grant table, so only those can be set
     here. The others O2S still decides itself, by role name in its code ('hard') or from screen access ('screen'); they are
     shown read only with O2S's answer today and never written, so they cannot drift from what O2S does. */
  const LIVE = L ? CODES.filter(c => L.RIGHTS_LIVE[c] === true) : [];
  const byCode = c => L.RIGHTS.find(r => r.code === c) || {};
  function todayAnswer(M, name, code) {   // the same answer as mayLegacyRole in o2s.html
    const lg = byCode(code).legacy || {};
    if (lg.kind === 'all') return true;
    if (lg.kind === 'hard') return name === 'COO' || (lg.roles || []).indexOf(name) >= 0;   // fixed by role name in O2S's code (mayLegacyRole), the COO included
    if (lg.kind === 'screen') { const m = M.accessMatrix || {}, o = Object.prototype.hasOwnProperty.call(m, name) && m[name] ? m[name][lg.scr] : null;
      return (o && o.e !== undefined) ? !!o.e : (L.OWNERS[lg.scr] || []).indexOf(name) >= 0; }
    return false;
  }
  const LEVELS = ['none', 'view', 'edit'];
  function levelOf(M, name, id) {
    const m = M.accessMatrix || {}, o = Object.prototype.hasOwnProperty.call(m, name) && m[name] ? m[name][id] : null;
    const v = (o && o.v !== undefined) ? !!o.v : true, e = (o && o.e !== undefined) ? !!o.e : (L.OWNERS[id] || []).indexOf(name) >= 0;
    return e ? 'edit' : (v ? 'view' : 'none');
  }
  const CELL = { none: { v: false, e: false }, view: { v: true, e: false }, edit: { v: true, e: true } };
  const whyNot = code => { const lg = byCode(code).legacy || {};
    return lg.kind === 'hard' ? 'Not in force yet: O2S decides this by role name in its own code, so it cannot be set here.'
      : lg.kind === 'screen' ? 'Not in force yet: O2S decides this from edit access to the ' + lg.scr + ' screen (O2S access matrix).' : 'Not in force yet.'; };
  // 29 Oct 2026 (D-351): the COO is an ordinary O2S role; nothing in O2S is locked here any more.
  const LOCKED_NOTE = '';

  function cooUnlock(st) {   // the same as cooUnlockV1 in o2s.html
    const M = st && st.masters; if (!M || M._cooUnlockV1) return false;
    const r = (M.roles || []).find(x => x && x.name === 'COO'); if (!r) return false;
    M.roleRights = M.roleRights || {}; M.roleRightsSet = M.roleRightsSet || {}; M.accessMatrix = M.accessMatrix || {};
    const row = M.roleRights[r.id] || {}, set = M.roleRightsSet[r.id] || {}; LIVE.forEach(c => { row[c] = true; set[c] = true; }); M.roleRights[r.id] = row; M.roleRightsSet[r.id] = set;
    const cells = Object.prototype.hasOwnProperty.call(M.accessMatrix, 'COO') && M.accessMatrix.COO ? M.accessMatrix.COO : {};
    L.ALLSCREENS.forEach(id => { cells[id] = { v: true, e: true }; }); M.accessMatrix.COO = cells;
    M._cooUnlockV1 = { at: new Date().toISOString(), by: 'ruling of 29 Oct 2026 (D-351), roles service', rights: LIVE.length, screens: L.ALLSCREENS.length };
    return true;
  }
  if (!loadError && store) (async () => { try { const st = await store.getState(); if (st && st.data && !st.data.masters._cooUnlockV1) { await change(d => { cooUnlock(d); }); console.log('[o2s rolesvc] the COO now holds its rights and screens as ticks (D-351)'); } } catch (e) { console.error('[o2s rolesvc] COO step not run: ' + e.message); } })();
  const sysAdmin = async (req, res, next) => {
    try {
      if (loadError) return res.status(503).json({ error: loadError });
      if (SV.isSystemAdmin && await SV.isSystemAdmin(req.user.u)) return next();
      res.status(403).json({ error: 'Only a System Administrator designs roles.' });
    } catch (e) { res.status(500).json({ error: String(e) }); }
  };
  const bad = (status, error) => Object.assign(new Error(error), { status });
  const wrap = fn => async (req, res) => { try { await fn(req, res); } catch (e) { res.status(e.status || 500).json({ error: e.status ? e.message : String(e) }); } };
  // subject 'role:<name>', so a role's log rows never mix with a person's history (a role and a login can share a name).
  const log = (action, subject, before, after) => { try { if (SV.logAccess) return SV.logAccess({ action, subject: 'role:' + subject, module: 'o2s', before, after, via: 'roles' }); } catch (e) {} };

  /* Sign-offs (Tahir, 29 Oct 2026, D-353): who may sign is a list per sign-off, kept in masters.signoffs; with no entry
     O2S's default list (SIGNOFF_RULES) stands. The same reading as signoffRoles in o2s.html. */
  const SO = L ? Object.keys(L.SIGNOFF_RULES) : [];
  const soDefault = a => { const r = L.SIGNOFF_RULES[a]; return (typeof r.roles === 'function' ? r.roles() : r.roles).slice(); };
  const soList = (M, a) => { const d = M.signoffs; return d && Object.prototype.hasOwnProperty.call(d, a) && Array.isArray(d[a]) ? d[a].slice() : soDefault(a); };
  const soNote = a => { const r = L.SIGNOFF_RULES[a];
    return r.how === 'edit' ? 'Also needs Edit on the screen where it is done (the COO does not).'
      : r.cover ? 'The named leave cover for the ' + r.cover + ' also signs while covering.' : ''; };
  const cleanSO = v => { if (v == null) return null; if (!Array.isArray(v)) throw bad(400, 'Tick what this role signs.'); const set = [...new Set(v.map(String))]; const u = set.find(a => !SO.includes(a)); if (u) throw bad(400, 'Unknown sign-off: ' + u + '.'); return SO.filter(a => set.includes(a)); };
  // The sign-offs among these that no switched-on person can sign any more (a warning, never a refusal: the role may be given next).
  async function nobodySigns(M, actions) {
    if (!SV.holdersOf || !actions.length) return [];
    const out = [];
    for (const a of actions) { let n = 0; for (const role of soList(M, a)) { try { n += ((await SV.holdersOf('o2s', role)) || []).length; } catch (e) { n++; } if (n) break; } if (!n) out.push(L.SIGNOFF_RULES[a].name); }
    return out;
  }
  const rightsOf = (M, role) => LIVE.filter(c => ((M.roleRights || {})[role.id] || {})[c] === true);
  const todayOf = (M, role) => CODES.filter(c => !LIVE.includes(c) && todayAnswer(M, role.name, c));
  const deptName = (M, id) => ((M.departments || []).find(d => d && d.id === id) || {}).name || id || '';
  // The same 5 pairs O2S checks when a right is ticked (separationRefusal in o2s.html). A sign-off code is held through the lists.
  function separation(M, roleName, set, added, lists) {
    if (roleName === 'COO') return '';   // as separationRefusal in o2s.html
    const signs = c => SO.some(a => L.SIGNOFF_RULES[a].code === c && (lists && lists[a] ? lists[a] : soList(M, a)).indexOf(roleName) >= 0);
    const has = c => LIVE.includes(c) ? set.includes(c) : CODES.includes(c) ? todayAnswer(M, roleName, c) : !!L.SIGNOFF_ROLES[c] && signs(c);
    const known = c => CODES.includes(c) || !!L.SIGNOFF_ROLES[c];
    const name = c => ((L.RIGHTS.find(r => r.code === c) || {}).name) || L.SIGNOFF_NAMES[c] || c;
    for (const [a, b, why] of L.SEPARATION) {
      if (!known(a) || !known(b)) continue;
      if ((added.includes(a) || added.includes(b)) && has(a) && has(b)) return `${roleName} cannot hold both "${name(a)}" and "${name(b)}": ${why}.`;
    }
    return '';
  }
  // Read, change, save with the revision guard; try again if someone saved in between.
  async function change(fn) {
    for (let i = 0; i < 4; i++) {
      const st = await store.getState(); if (!st || !st.data || !st.data.masters) throw bad(409, 'O2S has no data yet.');
      const out = fn(st.data);
      const r = await store.setStateGuarded(st.rev, st.data);
      if (!r.conflict) return out;
    }
    throw bad(409, 'O2S was being saved by someone else at the same moment. Try again.');
  }
  function applySignoffs(M, name, want, seen) {
    const now = SO.filter(a => soList(M, a).indexOf(name) >= 0), from = seen || now;
    const add = want.filter(a => !from.includes(a) && !now.includes(a)), take = from.filter(a => !want.includes(a) && now.includes(a));
    const lists = {};
    add.forEach(a => { lists[a] = soList(M, a).concat([name]); });
    take.forEach(a => { lists[a] = soList(M, a).filter(x => x !== name);
      if (!lists[a].length) throw bad(400, '"' + L.SIGNOFF_RULES[a].name + '" would have no role left to sign it. Give it to another role first.'); });
    return { add, take, lists };
  }
  const soCodes = acts => [...new Set(acts.map(a => L.SIGNOFF_RULES[a].code).filter(Boolean))];
  const actionLine = (s, who, what) => { (s.actionLog = s.actionLog || []).unshift({ id: 'AL' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), t: new Date().toISOString(), role: 'System Administrator', by: who, what }); };
  const cleanRights = r => { if (!Array.isArray(r)) throw bad(400, 'Tick what this role may do.'); const set = [...new Set(r.map(String))]; const unknown = set.find(c => !CODES.includes(c)); if (unknown) throw bad(400, 'Unknown right: ' + unknown + '.'); return LIVE.filter(c => set.includes(c)); };   // rights not in force are never written

  app.get('/api/o2s/rolesvc/catalogue', auth, sysAdmin, wrap(async (req, res) => {
    const st = await store.getState(); const M = (st && st.data && st.data.masters) || {};
    const depts = (M.departments || []).filter(d => d && !d.archived);
    const order = depts.map(d => d.id).concat([...new Set(L.RIGHTS.map(r => r.dept))].filter(d => !depts.some(x => x.id === d)));
    const groups = order.map(d => ({ name: deptName(M, d), items: L.RIGHTS.filter(r => r.dept === d).map(r => ({ key: r.code, label: r.name,
      inForce: LIVE.includes(r.code), note: LIVE.includes(r.code) ? (r.note || '') : whyNot(r.code) })) })).filter(g => g.items.length);
    res.json({ groups, count: LIVE.length, rename: false, departments: depts.map(d => ({ key: d.id, name: d.name })), lockedNote: LOCKED_NOTE,
      signoffs: SO.map(a => ({ key: a, label: L.SIGNOFF_RULES[a].name, note: soNote(a) })),
      screens: L.SCREENS.map(x => ({ key: x.id, label: x.name })), levels: [['none', 'No access'], ['view', 'View'], ['edit', 'Edit']], leads: true, restore: true });
  }));
  app.get('/api/o2s/rolesvc/roles', auth, sysAdmin, wrap(async (req, res) => {
    const st = await store.getState(); const M = (st && st.data && st.data.masters) || {};
    // signoffs: what the role signs, from the lists (D-353); replaces the read-only "fixed" line of D-352.
    res.json({ roles: (M.roles || []).filter(r => r && r.name).map(r => ({ key: r.name, label: r.name, department: r.deptId || null, builtin: !!r.builtin, archived: !!r.archived, locked: false, rights: rightsOf(M, r), today: todayOf(M, r), signoffs: SO.filter(a => soList(M, a).indexOf(r.name) >= 0),
      screens: Object.fromEntries(L.SCREENS.map(x => [x.id, levelOf(M, r.name, x.id)])), lead: (M.departments || []).some(d => d && d.leadRoleId === r.id) })) });
  }));
  app.post('/api/o2s/rolesvc/roles', auth, sysAdmin, wrap(async (req, res) => {
    const b = req.body || {}, name = String(b.label || '').trim().replace(/\s+/g, ' '), dept = String(b.department || ''), rights = cleanRights(b.rights), signs = cleanSO(b.signoffs) || [];
    if (name.length < 2 || name.length > 60) throw bad(400, 'Give the role a name of 2 to 60 letters.');
    if (name in Object.prototype || name === '__proto__') throw bad(400, 'Choose another name for this role.');
    const who = req.user.n || req.user.u;
    await change(s => {
      const M = s.masters; M.roles = M.roles || [];
      if (!(M.departments || []).some(d => d && d.id === dept && !d.archived)) throw bad(400, 'Pick the department this role belongs to.');
      if (M.roles.some(r => r && String(r.name).toLowerCase() === name.toLowerCase())) throw bad(400, 'A role with this name already exists.');
      // As O2S's own Add a role: a fresh, locked row, never a leftover one of the same name (review 28 Oct: old matrix rows exist).
      // Set first, so the 2-person check below never reads a leftover row (review 29 Oct); a refusal discards this copy.
      M.accessMatrix = M.accessMatrix || {}; M.accessMatrix[name] = { users: { v: false, e: false }, admin: { v: false, e: false }, datafix: { v: false, e: false } };
      const so = applySignoffs(M, name, signs, []);
      const why = separation(M, name, rights, rights.concat(soCodes(so.add)), so.lists); if (why) throw bad(400, why);
      if (so.add.length) { M.signoffs = M.signoffs || {}; so.add.forEach(a => { M.signoffs[a] = so.lists[a]; }); }
      const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'role'; let id = base, i = 2;
      while (M.roles.some(r => r && r.id === id)) id = base + '-' + (i++);
      M.roles.push({ id, name, deptId: dept, builtin: false, archived: false, createdBy: 'System Administrator ' + who + ' (platform Roles screen)' });
      M.roleRights = M.roleRights || {}; M.roleRightsSet = M.roleRightsSet || {};
      // Only the rights in force are written and marked decided; O2S seeds the others itself, so they follow its screen access.
      M.roleRights[id] = Object.fromEntries(LIVE.map(c => [c, rights.includes(c)])); M.roleRightsSet[id] = Object.fromEntries(LIVE.map(c => [c, true]));
      actionLine(s, who, 'Role added from the platform Roles screen: ' + name + ' in ' + deptName(M, dept) + ' with ' + rights.length + ' right(s)' + (signs.length ? '; signs ' + signs.map(a => L.SIGNOFF_RULES[a].name).join(', ') : ''));
    });
    await log('role.create', name, null, { department: dept, rights, signoffs: signs.length ? signs : undefined });
    res.json({ ok: true, role: { key: name, label: name } });
  }));
  app.put('/api/o2s/rolesvc/roles/:key', auth, sysAdmin, wrap(async (req, res) => {
    const key = req.params.key, b = req.body || {}, rights = cleanRights(b.rights), who = req.user.n || req.user.u; let before = null, after = null;
    const seen = Array.isArray(b.base) ? cleanRights(b.base) : null;   // the rights the admin's screen started from
    const scr = b.screens && typeof b.screens === 'object' ? b.screens : {}, scrBase = b.baseScreens && typeof b.baseScreens === 'object' ? b.baseScreens : {};
    for (const id of Object.keys(scr)) { if (!L.SCREENS.some(x => x.id === id)) throw bad(400, 'Unknown screen: ' + id + '.'); if (LEVELS.indexOf(scr[id]) < 0) throw bad(400, 'A screen is No access, View or Edit.'); }
    const signs = cleanSO(b.signoffs), signsSeen = cleanSO(b.baseSignoffs);
    let screenChanges = [], deptChange = null, leadChange = null, soChange = null, soBefore = null, soMaster = null;
    await change(s => {
      const M = s.masters, r = (M.roles || []).find(x => x && x.name === key);
      if (!r) throw bad(404, 'O2S has no role called ' + key + '.');
      if (r.archived) throw bad(400, 'This role is archived.');
      if (b.label != null && String(b.label).trim() !== r.name) throw bad(400, 'O2S roles are added, never renamed.');
      before = rightsOf(M, r);
      // Review 28 Oct: apply only the admin's own changes, measured from what their screen showed, onto the rights as they are now.
      const from = seen || before;
      const added = rights.filter(c => !from.includes(c) && !before.includes(c)), removed = from.filter(c => !rights.includes(c) && before.includes(c));
      after = before.filter(c => !removed.includes(c)).concat(added);
      soBefore = SO.filter(a => soList(M, a).indexOf(r.name) >= 0);
      const so = signs ? applySignoffs(M, r.name, signs, signsSeen) : { add: [], take: [], lists: {} };
      const why = separation(M, r.name, after, added.concat(soCodes(so.add)), so.lists); if (why) throw bad(400, why);
      if (so.add.length || so.take.length) { M.signoffs = M.signoffs || {}; Object.keys(so.lists).forEach(a => { M.signoffs[a] = so.lists[a]; }); soChange = { add: so.add, take: so.take }; }
      soMaster = M;
      M.roleRights = M.roleRights || {}; M.roleRightsSet = M.roleRightsSet || {};
      const row = M.roleRights[r.id] || {}, set = M.roleRightsSet[r.id] || {};
      added.concat(removed).forEach(c => { row[c] = rights.includes(c); set[c] = true; });
      M.roleRights[r.id] = row; M.roleRightsSet[r.id] = set;
      // screens: only the cells this admin changed
      M.accessMatrix = M.accessMatrix || {};
      for (const id of Object.keys(scr)) { if (scrBase[id] === scr[id]) continue; const was = levelOf(M, r.name, id); if (was === scr[id]) continue;
        if (!Object.prototype.hasOwnProperty.call(M.accessMatrix, r.name)) M.accessMatrix[r.name] = {};
        M.accessMatrix[r.name][id] = Object.assign({}, CELL[scr[id]]); screenChanges.push({ screen: id, from: was, to: scr[id] }); }
      // department (O2S's setRoleDept rule: a department's lead cannot move out of it)
      if (b.department != null && b.department !== '' && b.department !== (b.baseDepartment != null ? b.baseDepartment : r.deptId) && b.department !== r.deptId) {
        const to = (M.departments || []).find(d => d && d.id === b.department && !d.archived); if (!to) throw bad(400, 'Pick a department.');
        const leads = (M.departments || []).find(d => d && d.leadRoleId === r.id && d.id === r.deptId);
        if (leads) throw bad(400, r.name + ' leads ' + leads.name + '. Give that department a new lead first.');
        deptChange = { from: r.deptId || null, to: to.id }; r.deptId = to.id; }
      // lead: a role becomes the lead of its own department (there is no "no lead": another role takes over instead)
      if (b.lead === true && b.baseLead !== true) {
        const d = (M.departments || []).find(x => x && x.id === r.deptId); if (!d) throw bad(400, r.name + ' has no department, so it cannot lead one.');
        if (d.leadRoleId !== r.id) { leadChange = { department: d.name, from: ((M.roles || []).find(x => x && x.id === d.leadRoleId) || {}).name || null, to: r.name }; d.leadRoleId = r.id; } }
      if (b.lead === false && b.baseLead === true && (M.departments || []).some(d => d && d.leadRoleId === r.id)) throw bad(400, 'A department always has a lead: make another role in it the lead instead.');
      if (screenChanges.length) actionLine(s, who, 'Screens changed from the platform Roles screen for ' + r.name + ': ' + screenChanges.map(c => c.screen + ' ' + c.from + ' → ' + c.to).join(', '));
      if (deptChange) actionLine(s, who, 'Role ' + r.name + ' filed under ' + deptName(M, deptChange.to) + ' from the platform Roles screen');
      if (leadChange) actionLine(s, who, 'Department lead: ' + leadChange.department + ' — ' + (leadChange.from || 'none') + ' → ' + leadChange.to + ' (platform Roles screen)');
      if (soChange) actionLine(s, who, 'Sign-offs changed from the platform Roles screen for ' + r.name + ': ' + (soChange.add.length ? 'now signs ' + soChange.add.map(a => L.SIGNOFF_RULES[a].name).join(', ') : '') + (soChange.add.length && soChange.take.length ? '; ' : '') + (soChange.take.length ? 'no longer signs ' + soChange.take.map(a => L.SIGNOFF_RULES[a].name).join(', ') : ''));
      if (added.length || removed.length) actionLine(s, who, 'Rights changed from the platform Roles screen for ' + r.name + ': ' + (added.length ? 'granted ' + added.join(', ') : '') + (added.length && removed.length ? '; ' : '') + (removed.length ? 'removed ' + removed.join(', ') : ''));
    });
    await log('role.rights', key, { rights: before, signoffs: soChange ? soBefore : undefined }, { rights: after, screens: screenChanges.length ? screenChanges : undefined, department: deptChange || undefined, lead: leadChange || undefined,
      signoffs: soChange ? SO.filter(a => soList(soMaster, a).indexOf(key) >= 0) : undefined });
    // A sign-off taken from this role whose other roles nobody holds: said once, as a warning (the save stands).
    const empty = soChange ? await nobodySigns(soMaster, soChange.take) : [];
    res.json({ ok: true, role: { key, label: key }, warn: empty.length ? 'Nobody holds a role that signs ' + empty.map(x => '"' + x + '"').join(', ') + ' now. Give one of its roles to a person on the People tab.' : undefined });
  }));
  app.post('/api/o2s/rolesvc/roles/:key/restore', auth, sysAdmin, wrap(async (req, res) => {
    const key = req.params.key, who = req.user.n || req.user.u;
    await change(s => { const r = (s.masters.roles || []).find(x => x && x.name === key); if (!r) throw bad(404, 'O2S has no role called ' + key + '.'); if (!r.archived) throw bad(400, 'This role is not archived.'); r.archived = false; actionLine(s, who, 'Role restored from the platform Roles screen: ' + r.name); });
    await log('role.restore', key, null, null);
    res.json({ ok: true });
  }));
  app.post('/api/o2s/rolesvc/roles/:key/archive', auth, sysAdmin, wrap(async (req, res) => {
    const key = req.params.key, who = req.user.n || req.user.u;
    if (pdq) { const [h] = await pdq("SELECT COUNT(*) AS n FROM user_module_roles WHERE module='o2s' AND role=?", [key]); if (Number(h[0].n)) throw bad(400, `${h[0].n} ${Number(h[0].n) === 1 ? 'person holds' : 'people hold'} this role. Give them another role on the People tab first.`); }
    await change(s => {
      const M = s.masters, r = (M.roles || []).find(x => x && x.name === key);
      if (!r) throw bad(404, 'O2S has no role called ' + key + '.');
      if (r.builtin) throw bad(400, 'Built-in O2S roles are not archived.');
      const lead = (M.departments || []).find(d => d && d.leadRoleId === r.id); if (lead) throw bad(400, r.name + ' leads ' + lead.name + '. Give that department a new lead first.');
      r.archived = true; actionLine(s, who, 'Role archived from the platform Roles screen: ' + r.name);
    });
    await log('role.archive', key, null, null);
    res.json({ ok: true });
  }));
};
