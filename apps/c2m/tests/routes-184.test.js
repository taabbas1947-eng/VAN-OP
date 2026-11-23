// D-184 route checks (Tahir, 23 Nov 2026): 1 Remove button on every recipe; what C2M lets each person do with it.
// Run: node apps/c2m/tests/routes-184.test.js (or give a routes file as the first argument). Needs the test database: see README.md.
const path = require('path');
const express = require('express'); const db = require('./_db.js');
const ROUTES = path.resolve(process.argv[2] || path.join(__dirname, '..', 'c2m-routes.js'));
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
(async () => {
  const pool = (await db.fresh(), db.pool(5));
  const pdq = (s, p) => pool.execute(s, p || []);
  const pdqT = (s, p) => pdq(s, p).then(r => { if (!/^\s*SELECT/i.test(s) && global.__c2mForget) global.__c2mForget(); return r; });
  // People: tahir COO (administrator), yawar CFO, majid Production Manager, himayat QC Head, fahim Plant Manager
  await pdqT("INSERT INTO auth_users (username, name) VALUES ('himayat','Himayat'),('fahim','Fahim')");
  await pdqT("DELETE FROM user_module_roles");
  for (const [u, r] of [['tahir', 'coo'], ['yawar', 'cfo'], ['majid', 'production'], ['himayat', 'qc'], ['fahim', 'plant']]) await pdqT('INSERT INTO user_module_roles (username, module, role) VALUES (?,?,?)', [u, 'c2m', r]);
  // Rudolf, Basic 10 kg; Basic Twin follows Basic
  const [c] = await pdqT("INSERT INTO c2m_customer (name, o2s_names, grp, segment) VALUES ('Rudolf','Rudolf','White label','White label')");
  const [p1] = await pdqT("INSERT INTO c2m_client_product (customer_id, channel, brand, o2s_brand) VALUES (?, 'White label', 'Basic', 'Basic')", [c.insertId]); const cp = p1.insertId;
  const [p2] = await pdqT("INSERT INTO c2m_client_product (customer_id, channel, brand, o2s_brand) VALUES (?, 'White label', 'Basic Twin', 'Basic Twin')", [c.insertId]); const cp2 = p2.insertId;
  const [k] = await pdqT("INSERT INTO c2m_client_pack (client_product_id, pack_size) VALUES (?, 10)", [cp]);
  const ver = async (no, state, name, extra) => { const [r] = await pdqT("INSERT INTO c2m_recipe_version (client_product_id, version_no, state, created_by, created_at, sent_back_by, sent_back_state) VALUES (?,?,?,?,NOW(),?,?)", [cp, no, state, (extra && extra.by) || 'majid', (extra && extra.sbBy) || null, (extra && extra.sbState) || null]);
    if (name) await pdqT('INSERT INTO c2m_recipe_name (recipe_version_id, recipe_name) VALUES (?,?)', [r.insertId, name]);
    await pdqT("INSERT INTO c2m_recipe_step (recipe_version_id, action, by_user, at) VALUES (?, 'written', ?, NOW())", [r.insertId, (extra && extra.by) || 'majid']);
    await pdqT("INSERT INTO c2m_recipe_line (recipe_version_id, grade_id, qty) VALUES (?, 1, 0.5)", [r.insertId]); return r.insertId; };
  const vMain = await ver(1, 'approved', null);                       // Main version 1: the Default
  const vBasic = await ver(2, 'approved', 'Basic - Standard Recipe');  // the real case: approved, not the Default, never used
  const vCost = await ver(3, 'approved', 'DAP way');                   // approved, not the Default, but an approved cost was written on it
  const vWasDef = await ver(4, 'approved', 'Old default');             // approved, not the Default, made the Default once
  const vClosed = await ver(5, 'closed', null);
  const vOld = await ver(6, 'old', 'Basic - Standard Recipe');
  const vDraft = await ver(7, 'draft', null);
  const vReview = await ver(8, 'review', null);
  const vSentBack = await ver(9, 'draft', null, { sbBy: 'himayat', sbState: 'review' });
  const vYawarClosed = await ver(10, 'closed', null, { by: 'yawar' });
  await pdqT("INSERT INTO c2m_cost_version (client_pack_id, valid_from, materials, packing, conversion, freight, total, recipe_version_id, cause, approved_by) VALUES (?, NOW(), 1,1,1,0,3, ?, 'test', 'yawar')", [k.insertId, vCost]);
  await pdqT("INSERT INTO c2m_audit (at, by_user, entity, entity_id, action, old_value, new_value, why) VALUES (NOW(), 'yawar', 'recipe', ?, 'default', NULL, NULL, 'test')", [String(vWasDef)]);
  const app = express(); app.use(express.json());
  const auth = (req, res, next) => { req.user = { u: req.get('x-user') || 'tahir' }; next(); };
  require(ROUTES)(app, { pdq, pool, auth, path, fs: require('fs'), crypto: require('crypto'), services: {}, noAutoPull: true });
  global.__c2mForget = app.locals.c2mForgetKept;
  app.use((e, req, res, next) => res.status(e.status || 500).json({ error: e.message }));
  const srv = app.listen(0); const port = srv.address().port;
  const call = async (u, m, p, b) => { const r = await fetch(`http://localhost:${port}${p}`, { method: m, headers: { 'x-user': u, 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); let j = null; try { j = await r.json(); } catch (_) {} return { s: r.status, j }; };
  const uses = (u, id) => call(u, 'GET', `/api/c2m/uses/recipe/${id}`);
  const del = (u, id, why) => call(u, 'POST', '/api/c2m/delete', { kind: 'recipe', id, why });
  const exists = async id => { const [[r]] = await pdq('SELECT COUNT(*) n FROM c2m_recipe_version WHERE id=?', [id]); return Number(r.n) > 0; };

  // The real case: the CFO may delete it; the 4 checks all pass
  let U = await uses('yawar', vBasic);
  ok(U.s === 200 && U.j.action === 'delete' && U.j.checks.length === 4 && U.j.checks.every(x => x.ok), 'CFO: Basic version 2 can be deleted, 4 checks pass: ' + JSON.stringify(U.j));
  ok(U.j && /Not the Default \(Main version 1 is\)/.test(U.j.checks[0].t) && U.j.recipe.defaultName === 'Main' && U.j.recipe.rname === 'Basic - Standard Recipe', 'the first check names the Default: ' + JSON.stringify(U.j && U.j.checks[0]));
  U = await uses('majid', vBasic); ok(U.s === 200 && U.j.action === 'none' && /CFO or the COO/.test(U.j.uses.join(' ')), 'Production Manager cannot delete an approved recipe: ' + JSON.stringify(U.j));
  let D = await del('majid', vBasic, 'Started by mistake'); ok(D.s === 409 && await exists(vBasic), 'Production Manager delete refused: ' + D.s);
  D = await del('yawar', vBasic, ''); ok(D.s === 400 && await exists(vBasic), 'no reason, no delete: ' + D.s);
  U = await uses('himayat', vBasic); ok(U.s === 200 && U.j.action === 'none', 'QC Head sees why, no delete');
  D = await del('yawar', vBasic, 'Wrong name: meant a new version of Main'); ok(D.s === 200 && !(await exists(vBasic)), 'CFO deletes Basic version 2: ' + D.s + ' ' + JSON.stringify(D.j));
  const [[ln]] = await pdq('SELECT COUNT(*) n FROM c2m_recipe_line WHERE recipe_version_id=?', [vBasic]); const [[nm]] = await pdq('SELECT COUNT(*) n FROM c2m_recipe_name WHERE recipe_version_id=?', [vBasic]);
  ok(Number(ln.n) === 0 && Number(nm.n) === 0, 'its lines and name row go with it');
  const [[au]] = await pdq("SELECT old_value, why FROM c2m_audit WHERE entity='recipe' AND entity_id=? AND action='delete'", [String(vBasic)]);
  const old = au && JSON.parse(au.old_value); ok(old && old.state === 'approved' && old.name === 'Basic - Standard Recipe' && old.lines.length === 1 && old.steps.length === 1 && /Wrong name/.test(au.why), 'the change record keeps state, name, lines, steps and the reason: ' + JSON.stringify(au));
  const [nt] = await pdq("SELECT text FROM c2m_notice WHERE for_role='production'"); ok(nt.length === 1 && /Deleted: Basic for Rudolf, recipe "Basic - Standard Recipe" version 2, by yawar\. Reason: Wrong name/i.test(nt[0].text), 'the Production Manager is told: ' + JSON.stringify(nt));
  D = await del('yawar', vBasic, 'again'); ok(D.s === 400 && /no longer in C2M/.test(D.j.error), 'a second delete says it is gone: ' + JSON.stringify(D.j));

  // The Default stays, with the fix named
  U = await uses('yawar', vMain); ok(U.j.action === 'none' && U.j.fix === 'default' && U.j.checks[0].ok === false && /It is the Default/.test(U.j.checks[0].t), 'Default: cannot, fix is Make another the Default: ' + JSON.stringify(U.j));
  ok(U.j.checks[3].ok === true, 'no follower yet');
  await pdqT('INSERT INTO c2m_product_ext (client_product_id, follows_product_id) VALUES (?,?)', [cp2, cp]);
  U = await uses('yawar', vMain); ok(U.j.checks[3].ok === false && /Basic Twin follows it/.test(U.j.checks[3].t), 'a follower is named on the Default: ' + JSON.stringify(U.j.checks[3]));
  D = await del('tahir', vMain, 'Other'); ok(D.s === 409 && await exists(vMain), 'even the COO cannot delete the Default: ' + D.s);
  // A product that follows another keeps its own old approved recipes (Tahir, 23 Nov 2026, m6)
  const [fv] = await pdqT("INSERT INTO c2m_recipe_version (client_product_id, version_no, state, created_by, created_at) VALUES (?, 1, 'approved', 'majid', NOW())", [cp2]);
  U = await uses('tahir', fv.insertId); ok(U.j.action === 'none' && /Basic Twin follows Basic: its own recipes are kept/.test(U.j.checks[0].t), 'a follower keeps its own recipe: ' + JSON.stringify(U.j && U.j.checks));
  D = await del('tahir', fv.insertId, 'Other: x'); ok(D.s === 409 && await exists(fv.insertId), 'and it cannot be deleted');
  // Used before: an approved cost written on it, or made the Default once
  U = await uses('yawar', vCost); ok(U.j.action === 'none' && U.j.checks[1].ok === false && /1 approved pack cost on it/.test(U.j.checks[1].t), 'approved cost on it: stays: ' + JSON.stringify(U.j.checks));
  D = await del('yawar', vCost, 'Not going ahead'); ok(D.s === 409 && await exists(vCost), 'delete refused when a cost was written');
  U = await uses('tahir', vWasDef); ok(U.j.action === 'none' && U.j.checks[2].ok === false, 'made the Default once: stays');
  // Old: never
  U = await uses('tahir', vOld); ok(U.j.action === 'none' && /earlier version/.test(U.j.uses.join(' ')), 'old version stays');
  D = await del('tahir', vOld, 'x'); ok(D.s === 409 && await exists(vOld), 'old version delete refused');
  // Closed: the CFO or the COO deletes it; the Production Manager does not
  U = await uses('majid', vClosed); ok(U.j.action === 'none', 'Production Manager: closed stays for him');
  U = await uses('tahir', vClosed); ok(U.j.action === 'delete', 'COO: closed can be deleted');
  D = await del('tahir', vClosed, 'Not going ahead'); ok(D.s === 200 && !(await exists(vClosed)), 'COO deletes a closed version');
  const [nt2] = await pdq("SELECT text FROM c2m_notice WHERE for_role='production' ORDER BY id"); ok(nt2.length === 2 && /by tahir/i.test(nt2[1].text), 'told again: someone else wrote it');
  D = await del('yawar', vYawarClosed, 'Started by mistake'); ok(D.s === 200, 'CFO deletes a closed version he wrote');
  const [nt3] = await pdq("SELECT text FROM c2m_notice WHERE for_role='production'"); ok(nt3.length === 2, 'no notice when the writer deletes his own');
  // Draft: whoever starts recipes deletes it
  U = await uses('majid', vDraft); ok(U.j.action === 'delete' && U.j.checks.length === 0, 'Production Manager: draft can be deleted');
  U = await uses('fahim', vDraft); ok(U.s === 200 && U.j.action === 'none', 'Plant Manager: draft not his');
  D = await del('majid', vDraft, 'Started by mistake'); ok(D.s === 200 && !(await exists(vDraft)), 'Production Manager deletes his draft');
  const [nt4] = await pdq("SELECT text FROM c2m_notice WHERE for_role='production'"); ok(nt4.length === 2, 'no notice for his own draft');
  // Only the CFO or the administrator deleting someone else's recipe tells the Production Manager (review m2)
  const vY = await ver(11, 'draft', null, { by: 'yawar' }); await pdqT("DELETE FROM c2m_notice");
  D = await del('majid', vY, 'Started by mistake'); ok(D.s === 200, 'Production Manager deletes a draft the CFO started');
  let [ntm] = await pdq("SELECT text FROM c2m_notice"); ok(ntm.length === 0, 'no notice when the Production Manager deletes: ' + JSON.stringify(ntm));
  const [nv] = await pdqT("INSERT INTO c2m_recipe_version (client_product_id, version_no, state, created_by, created_at) VALUES (?, 12, 'closed', 'majid', NOW())", [cp]);
  D = await del('yawar', nv.insertId, 'Not going ahead'); ok(D.s === 200, 'CFO deletes a closed version with no written step');
  [ntm] = await pdq("SELECT text FROM c2m_notice WHERE for_role='production'"); ok(ntm.length === 1, 'the writer is taken from created_by: told');
  // The administrator closes only with the step right ticked (review m1)
  await pdqT("UPDATE c2m_role SET actions_json=? WHERE role_key='coo'", [JSON.stringify(['recipe.start', 'recipe.step.cost', 'see.cost', 'see.products'])]);
  U = await uses('tahir', vReview); ok(U.j.action === 'none' && /tick that step/.test(U.j.uses.join(' ')), 'COO without the QC tick: no Close offered, told how: ' + JSON.stringify(U.j && U.j.uses));
  await pdqT("UPDATE c2m_role SET actions_json='[]' WHERE role_key='coo'");
  // In the workflow: closed by the person at that step, never deleted
  U = await uses('himayat', vReview); ok(U.j.action === 'close', 'QC Head: a version at his step is closed');
  U = await uses('yawar', vReview); ok(U.j.action === 'none' && /with the QC Head/.test(U.j.uses.join(' ')), 'CFO: not his step: ' + JSON.stringify(U.j.uses));
  D = await del('himayat', vReview, 'Not going ahead'); ok(D.s === 409 && /closed instead|QC Head/.test(D.j.error) && await exists(vReview), 'a version in the workflow is never deleted: ' + JSON.stringify(D.j));
  // A draft sent back: its sender closes it, as before
  U = await uses('himayat', vSentBack); ok(U.j.action === 'close', 'the QC Head who sent it back closes it: ' + JSON.stringify(U.j));
  U = await uses('majid', vSentBack); ok(U.j.action === 'delete', 'the Production Manager can still delete it');
  // A role with no recipe right cannot open the check
  await pdqT("INSERT INTO auth_users (username, name) VALUES ('ali2','Ali')"); await pdqT("INSERT INTO user_module_roles (username, module, role) VALUES ('ali2','c2m','viewer')");
  U = await uses('ali2', vMain); ok(U.s === 403, 'a price list viewer cannot open it: ' + U.s);
  D = await del('ali2', vMain, 'x'); ok(D.s === 403, 'nor delete');

  srv.close(); await pool.end();
  console.log(`routes-184: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
