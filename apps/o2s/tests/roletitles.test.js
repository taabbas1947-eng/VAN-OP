/* JOB TITLES, SEPARATE FROM ROLE NAMES — 23 September 2026.

   Tahir's ruling, asked as a direct question: HR's titles reach the app as a
   TITLE ON THE ROLE; the code's own role names do not change.

   WHY THAT WAS THE RIGHT ANSWER, in one number: the ten built-in role names are
   spelled out as 523 string literals in o2s.html, across SCREENS.owners,
   RIGHTS[].legacy, FIELD_OWNER and 32 name-matched canEdit gates. A rename that
   misses one leaves a person listed as having access while every button refuses
   him, silently, with no error anywhere. A title layer touches none of it.

   He had already ruled the same shape once without calling it that: C11 says
   Masab Rasheed signs a COA as "Senior QC Analyst" while his role stays AQCM.
   That is a title and a role name being two different things.

   THE TITLE BELONGS TO THE PERSON, NOT ONLY THE ROLE. HR gives Ali Raza
   "Production Associate" and Jawad Naseer "Production Officer", and Tahir ruled
   they hold ONE role with two titles. A role-level title alone cannot express
   that, so there are two layers:

     ROLE_TITLE[role]              the default, in code
     masters.roleTitles[role]      the COO's override of that default
     masters.userTitles[username]  one person's own title

   and personTitle() reads them in that order, falling back to the role's own
   name so nothing is ever blank.

   WHAT THIS FILE GUARDS. A title must never become a join key. Everything that
   decides access still matches on the role name; the title is display only. The
   moment a title is compared to decide what somebody may do, two names for one
   thing stops being a convenience and becomes a second, silent authority table.

   Run: node roletitles.test.js */
const H = require('./harness.js');
const vm = require('vm');

let pass = 0, fail = 0; const fails = [];
function ok(n, c, x) { if (c) pass++; else { fail++; fails.push(n + (x ? '  [' + x + ']' : '')); } }
function eq(n, g, w) { ok(n, g === w, 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w)); }

const box = { console, state: { masters: {} } };
box.globalThis = box;
vm.createContext(box);
vm.runInContext(
  H.grabTopVar('ROLE_TITLE', '{') + '\n' + H.grabTopVar('USER_TITLE', '{') + '\n' +
  ['roleTitle', 'personTitle', 'sigTitle', 'seedTitlesV1'].map(H.grab).join('\n\n'), box);
const { ROLE_TITLE, roleTitle, personTitle, sigTitle, seedTitlesV1 } = box;

/* ================= 1. THE DEFAULTS, FROM HR'S SHEET ================= */
{
  const want = {
    'COO': 'COO', 'CFO': 'CFO', 'Plant Manager': 'Plant Manager', 'KAM': 'KAM',
    'Production': 'Production Officer',
    'Production Manager': 'Lead Planning & Production',
    'Lab Rep': 'QC Analyst',
    'AQCM': 'Senior QC Analyst',
    'QCM': 'Lead Quality Control',
    'QA Inspector': 'QA Officer',
    'Supply Chain': 'Lead Supply Chain',
    'Supply Chain Officer': 'Warehouse Assistant',
    'Finance': 'Invoicing Officer',
    'Finance Desk Officer': 'Procurement Accountant',
    'Warehouse': 'Senior Warehouse Officer',
  };
  Object.keys(want).forEach(r => eq("'" + r + "' is titled", roleTitle(r), want[r]));
  eq('every role name the app knows has a title', Object.keys(ROLE_TITLE).length, 15);
  /* Four of the fourteen are their own title. That is not an oversight - COO,
     CFO, Plant Manager and KAM are what HR calls them too. */
  eq('four roles are their own title',
     Object.keys(ROLE_TITLE).filter(k => ROLE_TITLE[k] === k).sort().join(', '),
     'CFO, COO, KAM, Plant Manager');
  /* Nothing is ever blank: an unknown role answers with its own name rather
     than an empty cell, because a blank on a signature block is worse than a
     plain one. */
  eq('an unknown role falls back to its own name', roleTitle('Invented Role'), 'Invented Role');
  eq('...and so does nothing at all', roleTitle(''), '');
}

/* ================= 2. THE COO CAN OVERRIDE A ROLE'S TITLE ================= */
{
  box.state.masters = { roleTitles: { 'Lab Rep': 'Laboratory Analyst' } };
  eq('a stored role title wins over the code default', roleTitle('Lab Rep'), 'Laboratory Analyst');
  eq('...and the others are untouched', roleTitle('AQCM'), 'Senior QC Analyst');
  box.state.masters = { roleTitles: { 'Lab Rep': '' } };
  eq('a blank override falls back rather than blanking the title', roleTitle('Lab Rep'), 'QC Analyst');
  box.state.masters = {};
}

/* ================= 3. ONE ROLE, TWO TITLES ================= */
/* The case the ruling was made for: Ali Raza and Jawad Naseer hold the same
   Production role and print different titles. */
{
  box.state.masters = { userTitles: { 'aliraza': 'Production Associate' } };
  eq('Ali Raza signs as Production Associate', personTitle('aliraza', 'Production'), 'Production Associate');
  eq('Jawad, same role, signs as Production Officer', personTitle('jawad', 'Production'), 'Production Officer');
  /* And the other real case: Muhammad Ali holds KAM, like Irfan, but is the
     Chief Commercial Officer on paper. */
  box.state.masters.userTitles['mali'] = 'Chief Commercial Officer';
  eq('Muhammad Ali signs as Chief Commercial Officer', personTitle('mali', 'KAM'), 'Chief Commercial Officer');
  eq('Irfan, same role, signs as KAM', personTitle('irfan', 'KAM'), 'KAM');
  eq('no username falls back to the role title', personTitle('', 'AQCM'), 'Senior QC Analyst');
  eq('an unknown person falls back to the role title', personTitle('nobody', 'QCM'), 'Lead Quality Control');
  eq('a blank person title falls back too',
     (box.state.masters.userTitles['x'] = '', personTitle('x', 'Lab Rep')), 'QC Analyst');
  box.state.masters = {};
}

/* ================= 4. THE SIGNATURE BLOCK ================= */
/* C11: the COA prints QC Analyst / Senior QC Analyst / Lead Quality Control, so
   the verification signature is visibly distinct from the four analysts. */
{
  eq('an unsigned block still shows the function', sigTitle(null, 'AQCM'), 'Senior QC Analyst');
  eq('a signature carries its own role', sigTitle({ role: 'QCM', user: 'himayat' }, 'AQCM'), 'Lead Quality Control');
  box.state.masters = { userTitles: { 'masab': 'Senior QC Analyst' } };
  eq('...and the person\'s own title when there is one',
     sigTitle({ role: 'AQCM', user: 'masab' }, 'Lab Rep'), 'Senior QC Analyst');
  box.state.masters = {};

  /* The three hard-coded strings on the COA must be gone, replaced by the layer.
     Grepping for their absence is the point: while 'AQCM' is printed as a
     literal, C11 is not implemented however good the functions are. */
  /* Checked across the WHOLE file, not a slice. The first attempt windowed 1400
     characters from the first `<div class="signs">` and so only saw one of the
     two COA renderers - the printed document was converted and the on-screen
     form was not. There are five signature blocks in o2s.html; a literal that
     should exist nowhere is asserted nowhere. */
  ok('the COA no longer prints the literal AQCM as a title', !/<br>AQCM</.test(H.html));
  ok('...nor the literal QCM', !/<br>QCM</.test(H.html));
  /* "Nowhere" has to mean nowhere it is USED. The changelog entry announcing the
     change quotes the old string, and rightly so - the note that says what
     stopped being printed has to name it. The first version of this check said
     the file must not contain it at all and went red the moment the changelog
     was written, AFTER the suite had been run. Which is its own lesson: run the
     whole suite again after the changelog, not before it. */
  {
    const hits = [...H.html.matchAll(/Assistant Analyst\/Analyst/g)].map(m => m.index);
    eq('"Assistant Analyst/Analyst" survives in one place only', hits.length, 1);
    const cl = H.html.indexOf('var CHANGELOG'), clEnd = H.html.indexOf('</script>', cl);
    ok('...and that place is the changelog entry that retired it',
       hits[0] > cl && hits[0] < clEnd);
  }
  eq('...and both COA renderers ask sigTitle — three signatures each',
     (H.html.match(/(?<!function )sigTitle\(/g) || []).length, 6);
}

/* ================= 5. SEEDING IS IDEMPOTENT AND NEVER OVERWRITES ================= */
{
  const s = { masters: {} };
  seedTitlesV1(s);
  ok('seeding creates both maps', !!s.masters.roleTitles && !!s.masters.userTitles);
  eq('...role titles seeded from the code defaults', s.masters.roleTitles['AQCM'], 'Senior QC Analyst');
  /* The two people whose title differs from their role's are seeded by name,
     because they are the whole reason the person layer exists. */
  eq('Ali Raza is seeded as Production Associate', s.masters.userTitles['aliraza'], 'Production Associate');
  eq('Muhammad Ali is seeded as Chief Commercial Officer', s.masters.userTitles['mali'], 'Chief Commercial Officer');

  s.masters.roleTitles['AQCM'] = 'Whatever The COO Says';
  s.masters.userTitles['aliraza'] = 'Something Else';
  seedTitlesV1(s);
  eq('a second run never overwrites the COO', s.masters.roleTitles['AQCM'], 'Whatever The COO Says');
  eq('...nor a person he has retitled', s.masters.userTitles['aliraza'], 'Something Else');
  /* A role added to the code later must still get its default on an install
     that was seeded before it existed. */
  delete s.masters.roleTitles['QCM'];
  seedTitlesV1(s);
  eq('a newly added role picks up its default on the next run', s.masters.roleTitles['QCM'], 'Lead Quality Control');
}

/* ================= 6. A TITLE IS NEVER A JOIN KEY ================= */
/* The one way this design can go wrong. Access is decided on the role name; the
   title is display only. If a title is ever compared to decide what somebody may
   do, there are two authority tables and only one of them is tested. */
{
  ['may', 'mayRole', 'mayHere', 'canEdit', 'hardRole', 'accessLevelOn', 'rightAnswerToday']
    .forEach(fn => {
      let src = null; try { src = H.grab(fn); } catch (e) {}
      if (!src) { ok(fn + ' — not found, skipped', true); return; }
      ok(fn + ' never consults a title', !/roleTitle\(|personTitle\(|ROLE_TITLE/.test(src));
    });
  /* And the reverse: the title functions must not be able to grant anything.
     They return strings and read two maps, nothing else. */
  ['roleTitle', 'personTitle', 'sigTitle'].forEach(fn =>
    ok(fn + ' cannot decide access', !/\bmay\(|hardRole\(|canEdit\(|accessLevel/.test(H.grab(fn))));
}

console.log('\nRole titles — display, never authority: ' + pass + ' passed, ' + fail + ' failed');
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fail ? 1 : 0);
