/* ============================================================================
 * PD · Problem → Question → Bet → Run — API assertion suite.
 *
 * What it is really testing is MODEL.md §0, the two rules the whole subsystem
 * exists to serve:
 *   "Nothing gets made until we have written the question it answers.
 *    Nothing gets closed until we have written the result — pass, fail, or
 *    parked, and why."
 * Everything else here is detail around those two.
 *
 * Usage:  BASE=http://127.0.0.1:4310 node pd/tests/spine.test.js
 * Expects the same accounts as intake.test.js. Local server only.
 * ==========================================================================*/
const BASE = process.env.BASE || 'http://127.0.0.1:4310';
const PW = process.env.PD_TEST_PW || 'van@2026';

let pass = 0, fail = 0;
const ok = (c, what) => { if (c) pass++; else { fail++; console.log('  FAIL  ' + what); } };
const eq = (a, b, what) => ok(a === b, `${what}  (got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)})`);

const BANNED = ['wrong', 'incorrect', 'invalid', 'error', 'mistake', 'misfiled',
  'bad entry', 'fixed', 'corrected by', 'should have been', 'please note for next time'];
function noBannedWords(text, what) {
  const t = String(text || '').toLowerCase();
  const hit = BANNED.find(w => t.includes(w));
  ok(!hit, `${what} uses none of the banned words (found "${hit}")`);
}

const tokens = {};
async function login(u) {
  const r = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: PW }) });
  const j = await r.json();
  if (!j.token) throw new Error('login failed for ' + u);
  tokens[u] = j.token;
}
async function api(user, method, path, body) {
  const r = await fetch(BASE + path, {
    method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tokens[user] },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, body: j };
}

(async () => {
  console.log('PD spine suite → ' + BASE);
  for (const u of ['admin', 'kam', 'supply', 'production', 'lab', 'qa']) await login(u);
  // admin=coo  kam=member  supply=custodian  production=registrar  lab=qc_head  qa=(none)

  let r = await api('kam', 'POST', '/api/pd/problems', { title: 'P fixation in our soils', statement: 'Applied P is locked up before the crop can use it, across our calcareous soils.' });
  const problemId = r.body.id;

  /* ---- 1. Nothing gets made until the question is written --------------- */
  r = await api('kam', 'POST', '/api/pd/bets', { approach: 'coat the granule with humic acid', kill_criterion: 'no change in available P at 30 days' });
  eq(r.status, 400, 'a Bet with no Question behind it cannot be made');
  r = await api('kam', 'POST', '/api/pd/runs', { expected: 'available P holds above the control at 30 days' });
  eq(r.status, 400, 'a Run with no Bet behind it cannot be made');

  /* ---- 2. Opening work is open to anyone with a PD role ---------------- */
  r = await api('qa', 'POST', '/api/pd/questions', { problem_id: problemId, title: 'x', text: 'y', nature: 'chemistry' });
  eq(r.status, 403, 'an account with no PD role cannot open a question');

  r = await api('kam', 'POST', '/api/pd/questions', { problem_id: problemId, title: 'Does a humic coating slow P fixation?', text: 'We believe the coating occupies the calcium sites. Nobody has measured whether it does.', nature: 'chemistry', due_date: '2026-10-15' });
  eq(r.status, 200, 'a team member may write a question — the structure is the discipline, not a permission');
  eq(r.body.label, 'Q-001', 'and it takes a permanent number');
  const qId = r.body.id;

  r = await api('kam', 'POST', '/api/pd/questions', { problem_id: problemId, title: 'Too short', text: 'no' });
  eq(r.status, 400, 'a question needs writing out');
  r = await api('kam', 'POST', '/api/pd/questions', { problem_id: problemId, title: 'No nature given', text: 'This question has no nature on it at all.' });
  eq(r.status, 400, 'and a nature — agronomy, chemistry, production, commercial or regulatory');

  let dos = (await api('kam', 'GET', `/api/pd/problem/${problemId}`)).body;
  eq(dos.questions[0].owner_name, 'KAM', 'the person who writes a question owns it until someone moves it');

  /* ---- 3. Assigning is the restricted half ----------------------------- */
  const people = dos.people, labP = people.find(p => p.name === 'Lab Rep');
  r = await api('kam', 'POST', `/api/pd/question/${qId}/assign`, { owner_id: labP.id });
  eq(r.status, 403, 'a team member cannot name somebody else the owner');
  noBannedWords(r.body.error, 'the cannot-assign message');
  r = await api('lab', 'POST', `/api/pd/question/${qId}/assign`, { owner_id: labP.id });
  eq(r.status, 200, 'a technical lead can');
  dos = (await api('kam', 'GET', `/api/pd/problem/${problemId}`)).body;
  eq(dos.questions[0].owner_name, 'Lab Rep', 'and the owner moved');
  ok(dos.questions[0].bets.length === 0, 'with no bets on it yet');

  /* ---- 4. A Bet carries the one result that would kill it -------------- */
  r = await api('kam', 'POST', '/api/pd/bets', { question_id: qId, approach: 'Coat MAP granules with humic acid flake at 3% and measure available P against an uncoated control.' });
  eq(r.status, 400, 'a Bet with no kill criterion is refused');
  ok(/kill/i.test(r.body.error), 'and says so in those words');
  noBannedWords(r.body.error, 'the no-kill-criterion message');

  const ctx = dos.vocab.contexts.find(c => c.name === 'soil broadcast');
  r = await api('kam', 'POST', '/api/pd/bets', { question_id: qId,
    approach: 'Coat MAP granules with humic acid flake at 3% and measure available P against an uncoated control.',
    kill_criterion: 'No difference in available P at 30 days against the uncoated control.',
    delivery_context_id: ctx.id });
  eq(r.status, 200, 'with one, the bet is on');
  eq(r.body.label, 'B-001', 'and takes its own permanent number');
  const betId = r.body.id;

  /* ---- 5. A Run records expected against actual ------------------------ */
  r = await api('kam', 'POST', '/api/pd/runs', { bet_id: betId, expected: 'short' });
  eq(r.status, 400, 'a Run with no expectation written is refused');
  ok(/expect/i.test(r.body.error), 'because expected against actual is the point of recording one');

  r = await api('kam', 'POST', '/api/pd/runs', { bet_id: betId, expected: 'Available P at 30 days holds at least 15% above the uncoated control.' });
  eq(r.status, 200, 'a run starts');
  eq(r.body.label, 'R-001', 'with its own permanent number');
  const runId = r.body.id;

  // B14 — a run that replaces another must say why.
  r = await api('kam', 'POST', '/api/pd/runs', { bet_id: betId, expected: 'Same measurement, with the flake ground finer this time.', replaces_run_id: runId });
  eq(r.status, 400, 'a run that replaces an earlier one must say why');
  ok(/unrelated/i.test(r.body.error), 'and the message says what is lost without it');
  r = await api('kam', 'POST', '/api/pd/runs', { bet_id: betId, expected: 'Same measurement, with the flake ground finer this time.', replaces_run_id: runId, replaces_reason: 'The first flake was too coarse to disperse.' });
  eq(r.status, 200, 'with a reason, the lineage is recorded');
  const run2Id = r.body.id;

  /* ---- 6. B7 — the objective is ON the run ----------------------------- */
  dos = (await api('kam', 'GET', `/api/pd/problem/${problemId}`)).body;
  const bet = dos.questions[0].bets[0], run = bet.runs[0];
  eq(run.question_title, 'Does a humic coating slow P fixation?', 'a run carries the question it answers, on the run itself');
  ok(run.kill_criterion.startsWith('No difference'), 'and the result that would kill its bet');
  eq(bet.context_name, 'soil broadcast', 'a bet shows the context it is aimed through');
  ok(Array.isArray(bet.constraints), 'and inherits that context’s constraints rather than re-typing them');
  eq(bet.runs[1].replaced_number, 1, 'the replacing run names the run it replaced');

  /* ---- 7. B6 / B15 — readings, and the investigation state ------------- */
  r = await api('lab', 'POST', `/api/pd/runs/${runId}/reading`, { reading_date: '2026-09-15', verdict: 'normal', next_observation_date: '2026-09-29' });
  eq(r.status, 200, 'a reading with nothing seen is still a reading');
  eq(r.body.investigation_opened, false, 'and opens nothing');
  r = await api('lab', 'POST', `/api/pd/runs/${runId}/reading`, { reading_date: '2026-09-29', verdict: 'abnormal', physical_observation: 'The granules have started to cake in the drum.', next_observation_date: '2026-10-02' });
  eq(r.body.investigation_opened, true, 'an abnormal reading opens an investigation by itself');
  dos = (await api('kam', 'GET', `/api/pd/problem/${problemId}`)).body;
  const runNow = dos.questions[0].bets[0].runs[0];
  eq(runNow.status, 'abnormal_investigation', 'and the run says so — not passed, not failed, not still running');
  eq(runNow.readings.length, 2, 'both looks are kept');
  eq(runNow.next_observation, '2026-10-02', 'and the schedule moved with what was found');

  r = await api('lab', 'POST', `/api/pd/runs/${runId}/reading`, { verdict: 'sideways' });
  eq(r.status, 400, 'a reading has to say whether what was seen was expected or abnormal');

  /* ---- 8. Nothing gets closed until the result is written -------------- */
  r = await api('kam', 'POST', `/api/pd/runs/${runId}/close`, { actual: 'It caked.' });
  eq(r.status, 400, 'a run cannot close on a result too short to mean anything');
  r = await api('kam', 'POST', `/api/pd/runs/${runId}/close`, { actual: 'Available P held 18% above the control, but the granules caked in storage.', result_text: 'The coating does hold available P, and it also caused caking at ambient humidity.' });
  eq(r.status, 400, 'nor without grading the result');
  noBannedWords(r.body.error, 'the grade-it message');

  r = await api('lab', 'POST', `/api/pd/runs/${runId}/close`, { actual: 'Available P held 18% above the control, but the granules caked in storage.', result_text: 'The coating does hold available P, and it also caused caking at ambient humidity.', grade: 'proven' });
  eq(r.status, 200, 'with both, it closes');
  ok(r.body.claim_id > 0, 'and the result is written as a CLAIM, not a note on the run');

  dos = (await api('kam', 'GET', `/api/pd/problem/${problemId}`)).body;
  const closed = dos.questions[0].bets[0].runs[0];
  eq(closed.status, 'closed', 'the run is closed');
  ok(closed.closing_text.startsWith('The coating does hold'), 'and carries its result where it can be read');
  eq(closed.closing_grade, 'proven', 'graded');
  ok(dos.claims.some(c => /caking at ambient humidity/.test(c.text)), 'the claim stands against the question, gradeable and challengeable');

  r = await api('lab', 'POST', `/api/pd/runs/${runId}/reading`, { verdict: 'normal' });
  eq(r.status, 409, 'a closed run takes no more readings');

  /* ---- 9. Closing a Bet, and what that does to its runs ---------------- */
  // 'production' here is the Registrar — a PD role, but neither this bet's
  // owner nor a technical lead.
  r = await api('production', 'POST', `/api/pd/bets/${betId}/close`, { status: 'killed', result_text: 'Caking makes this unshippable regardless of the P result.', grade: 'proven' });
  eq(r.status, 403, 'closing a bet is its owner’s or a lead’s, and nobody else’s');
  noBannedWords(r.body.error, 'the not-yours-to-close message');
  r = await api('lab', 'POST', `/api/pd/bets/${betId}/close`, { status: 'sideways', result_text: 'x'.repeat(30), grade: 'proven' });
  eq(r.status, 400, 'a bet closes as killed or advanced, not anything else');
  r = await api('lab', 'POST', `/api/pd/bets/${betId}/close`, { status: 'killed', result_text: 'Caking makes this unshippable regardless of the P result. Killed on storage, not on chemistry.', grade: 'proven' });
  eq(r.status, 200, 'a lead closes it');
  r = await api('lab', 'POST', `/api/pd/bets/${betId}/close`, { status: 'advanced', result_text: 'x'.repeat(30), grade: 'proven' });
  eq(r.status, 409, 'and it cannot be closed twice');
  r = await api('kam', 'POST', '/api/pd/runs', { bet_id: betId, expected: 'One more measurement under the closed bet, which should not be allowed.' });
  eq(r.status, 409, 'no new run starts under a closed bet — a new line of work is a new bet');
  noBannedWords(r.body.error, 'the closed-bet message');

  /* ---- 10. Claims: the atom ------------------------------------------- */
  r = await api('kam', 'POST', '/api/pd/claims', { subject_type: 'problem', subject_id: problemId, text: 'Fermentation should not occur at a pH this low.', grade: 'believed' });
  eq(r.status, 200, 'a claim can stand directly against a Problem, not only against a question');
  const beliefId = r.body.id;
  r = await api('kam', 'POST', '/api/pd/claims', { subject_type: 'problem', subject_id: problemId, text: 'no grade on this one', grade: 'certain' });
  eq(r.status, 400, 'and it has to be graded honestly — proven, contested or believed');

  const questionClaim = (await api('kam', 'GET', `/api/pd/problem/${problemId}`)).body.claims.find(c => c.subject_type === 'question');
  r = await api('production', 'POST', '/api/pd/claims', { subject_type: 'question', subject_id: qId, text: 'The caking was from the binder, not the humic coating.', grade: 'contested', challenges_claim_id: questionClaim.id });
  eq(r.status, 200, 'anyone with a PD role may challenge a claim — that is what makes it a claim');
  dos = (await api('kam', 'GET', `/api/pd/problem/${problemId}`)).body;
  eq(dos.questions[0].state, 'contested', 'and a challenged question says it is contested, without anyone remembering to set it');
  ok(dos.claims.some(c => c.challenges_number), 'the challenge names what it challenges');

  // MODEL.md §6 — versioned, never overwritten in place.
  r = await api('kam', 'POST', `/api/pd/claims/${beliefId}/revise`, { text: 'Fermentation should not occur at a pH this low — but it did, twice, in the V Germinator line.', grade: 'contested' });
  eq(r.status, 200, 'a claim is revised, not overwritten');
  eq(r.body.version, 2, 'the new version is version 2');
  dos = (await api('kam', 'GET', `/api/pd/problem/${problemId}`)).body;
  const revised = dos.claims.filter(c => /Fermentation should not occur/.test(c.text));
  eq(revised.length, 1, 'only the current version shows');
  eq(revised[0].version, 2, 'and it is the new one');
  ok(/but it did, twice/.test(revised[0].text), 'carrying the correction');

  /* ---- 11. Settling a question ---------------------------------------- */
  r = await api('production', 'POST', `/api/pd/questions/${qId}/settle`, { result_text: 'x'.repeat(30), grade: 'proven' });
  eq(r.status, 403, 'settling is the owner’s or a lead’s');
  r = await api('lab', 'POST', `/api/pd/questions/${qId}/settle`, { result_text: 'short' });
  eq(r.status, 400, 'and nothing is settled without the answer written');
  r = await api('lab', 'POST', `/api/pd/questions/${qId}/settle`, { result_text: 'Yes — a humic coating holds available P about 18% above an uncoated control, and it cakes.', grade: 'proven', source_ref: 'R-001' });
  eq(r.status, 200, 'with the answer written, it settles');
  dos = (await api('kam', 'GET', `/api/pd/problem/${problemId}`)).body;
  eq(dos.questions[0].state, 'settled', 'and the question says so');
  ok(/18%/.test(dos.questions[0].settled_reason), 'carrying the answer');
  r = await api('lab', 'POST', `/api/pd/questions/${qId}/settle`, { result_text: 'x'.repeat(30), grade: 'proven' });
  eq(r.status, 409, 'and it cannot be settled twice');

  /* ---- 12. B18 — an Observation that arose inside a Run ---------------- */
  r = await api('lab', 'POST', `/api/pd/runs/${run2Id}/observe`, { text: 'The second drum smelled of ammonia by day four, which nobody was looking for.' });
  eq(r.status, 200, 'something a run turned up can be written down from the run');
  ok(/^O-\d+$/.test(r.body.label), 'as an Observation with its own number');
  const feed = (await api('supply', 'GET', '/api/pd/intake')).body.feed;
  const raised = feed.find(x => /smelled of ammonia/.test(x.text));
  ok(raised, 'and it lands in the same queue as everything else that came in');
  dos = (await api('kam', 'GET', `/api/pd/problem/${problemId}`)).body;
  ok(dos.filed.some(x => /smelled of ammonia/.test(x.text)), 'already filed against the problem the run sits under');

  /* ---- 13. A finished record is not edited into disagreeing with itself - */
  r = await api('lab', 'POST', `/api/pd/bet/${betId}/edit`, { kill_criterion: 'anything at all' });
  eq(r.status, 409, 'a closed bet is not edited underneath the claim that closed it');
  ok(/claim/i.test(r.body.error), 'and the message points at the move that does keep the history');
  noBannedWords(r.body.error, 'the closed-bet edit message');
  r = await api('lab', 'POST', `/api/pd/run/${runId}/edit`, { actual: 'no fermentation at all, the bet is fine' });
  eq(r.status, 409, 'nor is a closed run — this is how a run ends up contradicting its own result');
  r = await api('lab', 'POST', `/api/pd/question/${qId}/edit`, { title: 'A different question entirely' });
  eq(r.status, 409, 'nor a settled question');
  r = await api('production', 'POST', `/api/pd/run/${run2Id}/edit`, { expected: 'someone else’s run' });
  eq(r.status, 403, 'someone else’s run is not theirs to edit');

  /* ---- 13b. While it is open, content IS editable ---------------------- */
  r = await api('kam', 'POST', '/api/pd/problems', { title: 'A second problem to edit against', statement: 'Somewhere to open a question that is still open when it is edited.' });
  const p2 = r.body.id;
  r = await api('kam', 'POST', '/api/pd/questions', { problem_id: p2, title: 'Is the binder or the coating causing the caking?', text: 'Both changed in the same run, so neither is separated yet.', nature: 'production' });
  const q2 = r.body.id;
  r = await api('kam', 'POST', '/api/pd/bets', { question_id: q2, approach: 'Run the coating without the binder and compare caking at 30 days.', kill_criterion: 'Caking is unchanged with the binder removed.' });
  const b2 = r.body.id;
  r = await api('kam', 'POST', `/api/pd/bet/${b2}/edit`, { kill_criterion: '' });
  eq(r.status, 400, 'a bet cannot have its kill criterion emptied');
  noBannedWords(r.body.error, 'the keeps-its-kill-criterion message');
  r = await api('kam', 'POST', `/api/pd/bet/${b2}/edit`, { kill_criterion: 'x' });
  eq(r.status, 400, 'nor reduced to a single character the day after it had to be ten');
  r = await api('kam', 'POST', `/api/pd/bet/${b2}/edit`, { kill_criterion: 'Caking is unchanged at 30 days with the binder removed entirely.' });
  eq(r.status, 200, 'but it can be corrected while the bet is open');
  eq(r.body.changed, 1, 'and that is one history row');
  r = await api('kam', 'POST', `/api/pd/question/${q2}/edit`, { title: 'X'.repeat(300) });
  eq(r.status, 200, 'a very long title is shortened at the door');
  r = await api('lab', 'POST', `/api/pd/bets`, { question_id: qId, approach: 'A new bet under the settled question.', kill_criterion: 'Something that would kill it.' });
  eq(r.status, 409, 'and no new bet opens under a question that is already settled');

  /* ---- 13c. Two people closing the same thing at the same moment ------- */
  r = await api('kam', 'POST', '/api/pd/runs', { bet_id: b2, expected: 'Caking drops below the control once the binder is out.' });
  const raceRun = r.body.id;
  const closes = await Promise.all([
    api('kam', 'POST', `/api/pd/runs/${raceRun}/close`, { actual: 'Caking dropped to nothing without the binder.', result_text: 'The binder was causing the caking, not the humic coating.', grade: 'proven' }),
    api('lab', 'POST', `/api/pd/runs/${raceRun}/close`, { actual: 'Caking was unchanged without the binder.', result_text: 'The coating is causing the caking after all.', grade: 'contested' }),
  ]);
  eq(closes.filter(x => x.status === 200).length, 1, 'only one of two simultaneous closes takes');
  eq(closes.filter(x => x.status === 409).length, 1, 'the other is told someone got there first');
  ok(/nothing is lost/i.test(closes.find(x => x.status === 409).body.error), 'and told their result is still on the record as a claim');
  noBannedWords(closes.find(x => x.status === 409).body.error, 'the someone-closed-it-first message');

  /* ---- 13d. Two claims written at the same instant get their own numbers */
  const pair = await Promise.all([
    api('kam', 'POST', '/api/pd/claims', { subject_type: 'problem', subject_id: p2, text: 'One of two claims written at the same instant.', grade: 'believed' }),
    api('lab', 'POST', '/api/pd/claims', { subject_type: 'problem', subject_id: p2, text: 'The other of two claims written at the same instant.', grade: 'believed' }),
  ]);
  ok(pair[0].body.label !== pair[1].body.label, 'two claims written at once do not answer to the same number');

  /* ---- 13e. Nothing walks in through Object.prototype ------------------ */
  r = await api('kam', 'POST', '/api/pd/claims', { subject_type: 'problem', subject_id: p2, text: 'A claim graded with a prototype key.', grade: 'constructor' });
  eq(r.status, 400, '"constructor" is not a grade, however truthy the lookup');
  r = await api('kam', 'POST', '/api/pd/questions', { problem_id: p2, title: 'Prototype nature', text: 'A question whose nature is a prototype key.', nature: 'toString' });
  eq(r.status, 400, 'nor a nature');
  r = await api('kam', 'POST', `/api/pd/runs/${raceRun}/close`, { actual: 'Something that happened.', result_text: {}, grade: 'proven' });
  ok(r.status === 400 || r.status === 409, 'and an object is not a written result');

  /* ---- 13f. A crash path that leaked driver text to the screen --------- */
  // Express matches route patterns case-insensitively, so this reaches the
  // handler with a type the map does not hold. It used to crash there and put
  // a stack-shaped string on the screen; now it is simply the same route.
  r = await api('lab', 'POST', `/api/pd/QUESTION/${q2}/assign`, { owner_id: labP.id });
  eq(r.status, 200, 'a route reached by its capitals behaves as itself, rather than crashing');
  r = await api('lab', 'POST', `/api/pd/question/999999/assign`, { owner_id: labP.id });
  eq(r.status, 404, 'and an id that is not there is plainly not found');

  /* ---- 14. The dossier is one screen, not six ------------------------- */
  dos = (await api('kam', 'GET', `/api/pd/problem/${problemId}`)).body;
  ok(dos.problem && dos.questions && dos.claims && dos.filed, 'the dossier carries the problem, its questions, its claims and what came in');
  ok(dos.questions[0].bets[0].runs.length === 2, 'with the whole tree assembled — question, bet, runs');
  eq(dos.caps.lead, false, 'and tells a team member they are not a lead');
  eq((await api('lab', 'GET', `/api/pd/problem/${problemId}`)).body.caps.lead, true, 'while telling a lead they are');
  r = await api('qa', 'GET', `/api/pd/problem/${problemId}`);
  eq(r.status, 403, 'an account with no PD role sees none of it');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
