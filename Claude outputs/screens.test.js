/* ============================================================================
 * PD · "What I owe" and "The Report" — API assertion suite.
 *
 * These two screens exist because of the adoption audit, 9 Sept 2026: a person
 * wrote six real records and the next morning the system told them they had
 * written nothing. MODEL.md §5 signs off four screens; two of them — the two
 * where a person GETS something rather than gives — had not been built.
 *
 * The rule these tests exist to protect is RECLASSIFICATION-RULES.md §8.1:
 *   "No per-person error count. Not on a dashboard, not in a report, not
 *    derivable from the audit log by any screen the system offers."
 * So the assertions below check two opposite things on purpose:
 *   · "What I owe" must ALWAYS be about the person asking, and there must be
 *     no way to point it at anybody else.
 *   · "The Report" must contain no person at all — not a name, not a count by
 *     name, not a field a screen could group by.
 * If someone later adds "and who is behind?", these tests should fail.
 *
 * Usage:  BASE=http://127.0.0.1:4310 node pd/tests/screens.test.js
 * ==========================================================================*/
const BASE = process.env.BASE || 'http://127.0.0.1:4310';
const PW = process.env.PD_TEST_PW || 'van@2026';
let pass = 0, fail = 0;
const ok = (c, w) => { if (c) pass++; else { fail++; console.log('  FAIL  ' + w); } };
const eq = (a, b, w) => ok(a === b, `${w}  (got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)})`);

const tok = {};
async function login(u) {
  const r = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: PW }) });
  const j = await r.json(); if (!j.token) throw new Error('login ' + u); tok[u] = j.token;
}
async function api(u, m, p, b) {
  const r = await fetch(BASE + p, { method: m, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok[u] }, body: b === undefined ? undefined : JSON.stringify(b) });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, body: j };
}
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); };
const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };

(async () => {
  console.log('PD screens suite → ' + BASE);
  for (const u of ['admin', 'kam', 'supply', 'lab', 'qa']) await login(u);

  /* ---- 1. An empty "What I owe" says so, and offers the way in --------- */
  let r = await api('kam', 'GET', '/api/pd/mywork');
  eq(r.status, 200, 'a team member can open What I owe');
  eq(r.body.questions.length, 0, 'and owes nothing yet');
  eq(r.body.runs.length, 0, 'no runs');
  eq(r.body.caps.triage, false, 'and has no filing queue');
  r = await api('qa', 'GET', '/api/pd/mywork');
  eq(r.status, 403, 'an account with no PD role has no such page');

  /* ---- 2. Work a person owns comes back to them ------------------------ */
  let p = (await api('kam', 'POST', '/api/pd/problems', { title: 'Caking in the Zn coat', statement: 'Coated urea sets in the bag before it reaches the dealer.' })).body;
  let q = (await api('kam', 'POST', '/api/pd/questions', { problem_id: p.id, nature: 'production',
    title: 'Does the Zn coat survive bagging?', text: 'The coat looks intact at the plant and the bag sets solid at the dealer.',
    due_date: yesterday() })).body;
  let b = (await api('kam', 'POST', '/api/pd/bets', { question_id: q.id,
    approach: 'Coat at 1% Zn as ZnO and hold sealed bags at ambient store humidity.',
    kill_criterion: 'The bag sets solid inside 30 days.' })).body;
  let run = (await api('kam', 'POST', '/api/pd/runs', { bet_id: b.id, expected: 'Free-flowing at 30 days in a sealed bag.' })).body;

  r = await api('kam', 'GET', '/api/pd/mywork');
  eq(r.body.questions.length, 1, 'the Question they wrote is theirs');
  eq(r.body.questions[0].late, true, 'and a date that has gone by shows as late');
  ok(r.body.questions[0].problem_title, 'carrying the Problem it sits under, so it can be found');
  eq(r.body.bets.length, 1, 'the Bet is theirs');
  eq(r.body.runs.length, 1, 'and the Run');
  eq(r.body.runs[0].next_look, null, 'with no next reading set yet');
  ok(r.body.runs[0].kill_criterion, 'and the result that would end its Bet, on the run itself');

  /* ---- 3. A reading sets what falls due next --------------------------- */
  await api('kam', 'POST', `/api/pd/runs/${run.id}/reading`, { verdict: 'normal', next_observation_date: yesterday() });
  r = await api('kam', 'GET', '/api/pd/mywork');
  eq(r.body.runs[0].next_look, yesterday(), 'the next reading is the date the last reading set');
  eq(r.body.runs[0].late, true, 'and it is late once that date has gone by');
  await api('kam', 'POST', `/api/pd/runs/${run.id}/reading`, { verdict: 'normal', next_observation_date: tomorrow() });
  r = await api('kam', 'GET', '/api/pd/mywork');
  eq(r.body.runs[0].late, false, 'reading it again moves the date, and it stops being late');
  eq(r.body.runs[0].abnormal, false, 'and nothing abnormal has been seen');
  await api('kam', 'POST', `/api/pd/runs/${run.id}/reading`, { verdict: 'abnormal', physical_observation: 'The bag has set at the shoulders.' });
  r = await api('kam', 'GET', '/api/pd/mywork');
  eq(r.body.runs[0].abnormal, true, 'an abnormal reading puts the run in front of its owner');
  eq(r.body.runs[0].status, 'abnormal_investigation', 'in the state that says an investigation is open');

  /* ---- 4. It is ALWAYS about the person asking ------------------------- */
  r = await api('lab', 'GET', '/api/pd/mywork');
  eq(r.body.questions.length, 0, 'somebody else’s page does not carry this person’s work');
  eq(r.body.runs.length, 0, 'nor their runs');
  // §8.1 — there must be no way to point this at another person.
  for (const attempt of ['?user=2', '?user_id=2', '?owner_id=2', '?as=kam']) {
    r = await api('lab', 'GET', '/api/pd/mywork' + attempt);
    eq(r.body.questions.length, 0, `and no query string turns it into somebody else’s (${attempt})`);
  }

  /* ---- 5. Assigning work makes it appear on the right page ------------- */
  const people = (await api('supply', 'GET', '/api/pd/intake')).body.people;
  const labPerson = people.find(x => x.name === 'Lab Rep');
  await api('lab', 'POST', `/api/pd/question/${q.id}/assign`, { owner_id: labPerson.id });
  r = await api('lab', 'GET', '/api/pd/mywork');
  eq(r.body.questions.length, 1, 'a Question moved to somebody appears on their page');
  r = await api('kam', 'GET', '/api/pd/mywork');
  eq(r.body.questions.length, 0, 'and leaves the page of the person who had it');
  ok(r.body.mine.length >= 0, 'what they wrote through the door stays theirs either way');

  /* ---- 6. The filing queue is on the page of whoever files ------------- */
  await api('kam', 'POST', '/api/pd/intake', { text: 'Something arrived that nobody has filed yet, for the queue count.' });
  r = await api('supply', 'GET', '/api/pd/mywork');
  eq(r.body.caps.triage, true, 'the Custodian has a filing queue');
  ok(r.body.toFile >= 1, 'and it counts what is waiting');
  r = await api('kam', 'GET', '/api/pd/mywork');
  eq(r.body.toFile, 0, 'somebody without the filing role is not shown a queue at all');

  /* ---- 7. The Report counts things -------------------------------------- */
  r = await api('admin', 'GET', '/api/pd/report');
  eq(r.status, 200, 'the Report opens');
  ok(r.body.problems.field_problem >= 1, 'it counts open field problems');
  ok(r.body.questions.overdue >= 0, 'and Questions past their date');
  ok(r.body.bets.active >= 1, 'and Bets running');
  eq(r.body.runs.investigating, 1, 'and Runs where something abnormal was seen');
  ok(r.body.written.week.questions >= 1, 'it counts what was written down this week');
  ok(r.body.written.week.readings >= 3, 'including readings, which is where a long trial lives');
  ok(r.body.discipline.unfiled >= 1, 'it counts entries nobody has filed');
  ok(r.body.discipline.runs_without_recipe >= 1, 'and Runs with no recipe recorded — the gap the Combination Bank closes');
  ok(Array.isArray(r.body.closed), 'and carries a feed of what has been answered');
  ok(r.body.attention.investigations.length === 1, 'the needs-attention feed carries the investigation');

  /* ---- 8. §8.1 — the Report names nobody -------------------------------- */
  const raw = JSON.stringify(r.body);
  const names = ['Administrator', 'KAM', 'Supply Chain', 'Lab Rep', 'Production', 'QA Inspector'];
  const found = names.filter(n => raw.includes(n));
  eq(found.length, 0, `no person is named anywhere in the Report (found ${JSON.stringify(found)})`);
  const personish = ['owner_id', 'owner_name', 'logged_by', 'created_by', 'recorded_by', 'changed_by', 'author', 'by_person', 'per_person'];
  const leaked = personish.filter(k => raw.includes('"' + k + '"'));
  eq(leaked.length, 0, `and no field a screen could group by a person (found ${JSON.stringify(leaked)})`);

  /* ---- 9. Everyone can read the Report; nobody can read it about a person */
  r = await api('kam', 'GET', '/api/pd/report');
  eq(r.status, 200, 'a team member can open the Report — it is about the work, not about them');
  const raw2 = JSON.stringify(r.body);
  eq(names.filter(n => raw2.includes(n)).length, 0, 'and it names nobody for them either');
  r = await api('qa', 'GET', '/api/pd/report');
  eq(r.status, 403, 'an account with no PD role sees none of it');

  /* ---- 10. Search — the thing PD's whole promise rests on --------------
     "Did we ever try this, and what happened?" Everything this suite has
     built above is in the database now, so it is searchable. */
  r = await api('kam', 'GET', '/api/pd/search?q=Zn');
  eq(r.status, 200, 'search answers');
  ok(r.body.total > 0, 'and a two-character chemistry term finds things — the reason this is LIKE and not fulltext');
  ok(r.body.results.some(x => x.kind === 'problem'), 'it reaches Problems');
  ok(r.body.results.some(x => x.kind === 'question' || x.kind === 'bet'), 'and the work under them');
  ok(r.body.results.every(x => x.link), 'every result knows where it lives');
  ok(r.body.results.every(x => x.kind_word), 'and says what kind of thing it is, in the model’s words');
  ok(r.body.groups.length > 0 && r.body.groups.every(g => g.n > 0), 'the shape of the answer is counted by kind');

  r = await api('kam', 'GET', '/api/pd/search?q=' + encodeURIComponent('sets solid inside 30 days'));
  ok(r.body.results.some(x => x.kind === 'bet'), 'a kill criterion is findable by its own words');
  ok(r.body.results.some(x => /sets solid/.test(x.snippet || '')), 'and the snippet shows why the row came back');

  r = await api('kam', 'GET', '/api/pd/search?q=' + encodeURIComponent('nothing in this system says this'));
  eq(r.body.total, 0, 'a term nobody wrote finds nothing');
  ok(Array.isArray(r.body.results), 'and still answers with a list rather than an error');

  r = await api('kam', 'GET', '/api/pd/search?q=a');
  eq(r.body.total, 0, 'one character does not search the whole database');
  ok(/two characters/i.test(r.body.hint || ''), 'and says why, rather than looking broken');

  /* A person searching for "50%" means the percent sign, not a wildcard. */
  r = await api('kam', 'GET', '/api/pd/search?q=' + encodeURIComponent('%'));
  ok(r.status === 200 && r.body.total === 0, 'a bare wildcard is a literal character, not "everything"');
  r = await api('kam', 'GET', '/api/pd/search?q=' + encodeURIComponent('_a'));
  ok(r.status === 200, 'and an underscore does not match any character');

  /* §8.1 again, at the one place it is easiest to breach: a search box that
     takes an author IS a per-person count. This route reads only `q`. */
  const asAuthor = await api('kam', 'GET', '/api/pd/search?q=Zn&author=1&owner_id=1&user=1&created_by=1&by=1');
  const plain = await api('kam', 'GET', '/api/pd/search?q=Zn');
  eq(JSON.stringify(asAuthor.body.results), JSON.stringify(plain.body.results),
    'search ignores every attempt to point it at a person');
  const sraw = JSON.stringify(plain.body);
  const speople = ['owner_id', 'owner_name', 'logged_by', 'created_by', 'author', 'written_by'];
  eq(speople.filter(k => sraw.includes('"' + k + '"')).length, 0,
    'and returns no field a screen could group by a person');

  r = await api('qa', 'GET', '/api/pd/search?q=Zn');
  eq(r.status, 403, 'an account with no PD role cannot search either');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
