/* ============================================================================
 * PD · intake + triage — API assertion suite.
 *
 * Runs against a REAL server and a REAL MySQL/MariaDB, not stubs, because the
 * behaviour being checked is mostly database behaviour: numbering under
 * concurrency, the append-only history table, foreign keys, and role gates
 * read fresh from auth_users on every request.
 *
 * Usage:  BASE=http://127.0.0.1:4310 node pd/tests/intake.test.js
 *
 * It expects the accounts below to exist with those PD roles. Nothing here
 * writes to a production database — point BASE at a local server only.
 * ==========================================================================*/
const BASE = process.env.BASE || 'http://127.0.0.1:4310';
const PW = process.env.PD_TEST_PW || 'van@2026';

let pass = 0, fail = 0;
const ok = (cond, what) => { if (cond) { pass++; } else { fail++; console.log('  FAIL  ' + what); } };
const eq = (a, b, what) => ok(a === b, `${what}  (got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)})`);

const tokens = {};
async function login(u) {
  const r = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: PW }) });
  const j = await r.json();
  if (!j.token) throw new Error('login failed for ' + u + ': ' + JSON.stringify(j));
  tokens[u] = j.token;
}
async function api(user, method, path, body) {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tokens[user] },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, body: j };
}

/* RECLASSIFICATION-RULES.md §6 — binding, and checkable. Every word here is
   forbidden anywhere a person can read it: in the interface, in a
   notification, or in a log. The suite checks the strings the API actually
   returns rather than trusting that nobody wrote one. */
const BANNED = ['wrong', 'incorrect', 'invalid', 'error', 'mistake', 'misfiled',
  'bad entry', 'fixed', 'corrected by', 'should have been', 'please note for next time'];
function noBannedWords(text, what) {
  const t = String(text || '').toLowerCase();
  const hit = BANNED.find(w => t.includes(w));
  ok(!hit, `${what} uses none of the banned words (found "${hit}")`);
}

(async () => {
  console.log('PD intake + triage suite → ' + BASE);
  for (const u of ['admin', 'kam', 'supply', 'production', 'lab', 'qa']) await login(u);
  // admin=coo  kam=member  supply=custodian  production=registrar  lab=qc_head  qa=(no PD role)

  /* ---- 1. Who can open what ------------------------------------------- */
  let r = await api('admin', 'GET', '/api/pd/me');
  eq(r.status, 200, 'COO can read /me');
  ok(r.body.surfaces.includes('triage'), 'COO has the triage surface');
  ok(r.body.surfaces.includes('intake'), 'COO has the intake surface');

  r = await api('kam', 'GET', '/api/pd/me');
  ok(r.body.surfaces.includes('intake'), 'a team member has the intake surface');
  ok(!r.body.surfaces.includes('triage'), 'a team member does NOT have triage');

  r = await api('production', 'GET', '/api/pd/me');
  eq(r.body.pd_role, 'registrar', 'the registrar role loads (added by 002, wired here for the first time)');
  ok(r.body.surfaces.includes('triage'), 'the Registrar has triage — the role and the message finally agree');

  // /me answers for an account with no PD role too, on purpose: it is how the
  // screen learns to say "you have no PD access yet" instead of showing a
  // broken page. The refusal happens at every surface behind it.
  r = await api('qa', 'GET', '/api/pd/me');
  eq(r.body.pd_role, null, 'an account with no PD role has none');
  eq(r.body.surfaces.length, 0, 'and no surfaces at all');

  r = await api('qa', 'GET', '/api/pd/intake');
  eq(r.status, 403, 'no PD role -> no intake');

  r = await api('kam', 'GET', '/api/pd/intake');
  eq(r.status, 200, 'a team member can open intake');
  eq(r.body.caps.triage, false, 'a team member sees no triage powers');
  eq(r.body.feed.length, 0, 'a team member is given no triage feed at all');

  /* ---- 2. Registering a Problem (a direct action, not a fourth door) --- */
  r = await api('kam', 'POST', '/api/pd/problems', { title: 'P fixation in our soils', statement: 'Applied P is locked up before the crop can use it, across our calcareous soils.', kind: 'field_problem' });
  eq(r.status, 200, 'any PD role may register a Problem — no approval queue in front of writing something down');
  eq(r.body.label, 'P-01', 'the Problem takes the next permanent number');
  const problemId = r.body.id;

  r = await api('lab', 'POST', '/api/pd/problems', { title: 'V Germinator Pro', statement: 'A germination product carrying full nutrition including Fe and Mn.', kind: 'product_concept' });
  eq(r.body.label, 'P-02', 'a product concept is a first-class Problem, numbered the same way');
  const conceptId = r.body.id;

  r = await api('kam', 'POST', '/api/pd/problems', { title: 'x', statement: 'too short' });
  eq(r.status, 400, 'a Problem needs a title someone will recognise');

  /* ---- 3. The three doors -------------------------------------------- */
  r = await api('kam', 'POST', '/api/pd/intake', { text: 'short' });
  eq(r.status, 400, 'an entry of five characters is refused');
  noBannedWords(r.body.error, 'the too-short message');

  // (a) no door picked at all — the ordinary case
  r = await api('kam', 'POST', '/api/pd/intake', { text: 'A boiler fly-ash sample turned up from the mill at Rahim Yar Khan, nobody asked for it.' });
  eq(r.status, 200, 'an entry saves with no door picked — nobody has to classify');
  eq(r.body.type, 'observation', 'an unclassified entry is filed as an Observation');
  eq(r.body.door_chosen, false, 'and it is marked as NOT the author’s choice of type');
  const unclassifiedId = r.body.id;
  eq(r.body.label, 'O-001', 'the Observation takes the next permanent number');

  // (b) a door picked
  r = await api('kam', 'POST', '/api/pd/intake', { door: 'challenge', product_ref: 'NP 11-44', text: 'Dealer in Sadiqabad says the crop response is behind the competitor at the same bag rate.', buried_claim_text: 'that the competitor delivers more at the same loading' });
  eq(r.status, 200, 'a Challenge saves through its own door');
  eq(r.body.label, 'CH-001', 'the Challenge takes the next permanent number');
  const challengeId = r.body.id;

  // RECLASSIFICATION-RULES.md §3: classification is "never a gate on someone
  // writing something down." A door whose own field is missing does not turn
  // the entry away — it lands as an Observation carrying what they said it was.
  r = await api('kam', 'POST', '/api/pd/intake', { door: 'challenge', text: 'Something we sell is not doing what it should, and I cannot remember the pack name.' });
  eq(r.status, 200, 'a Challenge with no product named still saves — nothing written down is turned away');
  eq(r.type === undefined ? r.body.type : r.body.type, 'observation', 'it lands as an Observation');
  eq(r.body.door_chosen, false, 'not recorded as the author’s choice of type');
  ok(/complaint/.test(r.body.note || ''), 'and what they said it was comes back to them in a sentence');
  noBannedWords(r.body.note, 'the it-landed-here sentence');

  r = await api('lab', 'POST', '/api/pd/intake', { door: 'request', requester: 'Sheikh Arshad', recipient: 'Sheikh Arshad, Multan', text: 'Wants a 50 kg trial pack of the fulvate-coated MAP for his own field.', dispatch_date: '2026-09-20', return_by: '2026-11-30' });
  eq(r.status, 200, 'a Request saves with requester, purpose, recipient and dates');
  eq(r.body.label, 'REQ-001', 'the Request takes the next permanent number');
  const requestId = r.body.id;

  r = await api('lab', 'POST', '/api/pd/intake', { door: 'request', requester: 'Someone', text: 'Somebody in Lahore asked for a trial pack; I will find out who it goes to.' });
  eq(r.status, 200, 'a Request with no recipient still saves, the same way');
  eq(r.body.door_chosen, false, 'and is held as an Observation until someone can complete it');

  // (c) observation explicitly chosen — distinct from the default above
  r = await api('lab', 'POST', '/api/pd/intake', { door: 'observation', text: 'Rudolf sent two variants of the humic flake, both settled in the drum within a week.' });
  eq(r.body.door_chosen, true, 'choosing Observation is recorded as a choice, not a default');
  const chosenObsId = r.body.id;

  /* ---- 4. Everything arrives unsorted, and that is the normal front --- */
  r = await api('supply', 'GET', '/api/pd/intake');
  eq(r.status, 200, 'the Custodian can open intake');
  eq(r.body.caps.triage, true, 'and has triage');
  eq(r.body.feed.length, 6, 'the feed carries every entry across the three doors');
  ok(r.body.feed.every(x => x.status === 'unsorted'), 'every entry is unsorted until someone files it');
  ok(r.body.feed[0].waiting_for, 'each unfiled entry says plainly what is still open');
  noBannedWords(r.body.feed.map(x => x.waiting_for).join(' '), 'the waiting-for lines');
  ok(r.body.problems.length === 2, 'both Problems are offered to file against');
  ok(r.body.people.length >= 4, 'the people with a PD role are offered as owners');

  r = await api('kam', 'GET', '/api/pd/intake');
  eq(r.body.mine.length, 3, 'a person sees their own three entries');
  ok(r.body.mine.every(x => x.author === 'KAM'), 'and they are theirs');

  /* ---- 5. Filing — a filing act, no reason asked --------------------- */
  r = await api('kam', 'POST', `/api/pd/intake/observation/${unclassifiedId}/file`, { problem_id: problemId });
  eq(r.status, 403, 'a team member cannot file someone’s entry against a problem');

  r = await api('supply', 'POST', `/api/pd/intake/observation/${unclassifiedId}/file`, { problem_id: problemId });
  eq(r.status, 200, 'the Custodian files it against a Problem — no reason required');
  eq(r.body.status, 'unsorted', 'a Problem alone does not settle it — it still has no owner');

  r = await api('supply', 'POST', `/api/pd/intake/observation/${unclassifiedId}/file`, { owner_id: 999999 });
  eq(r.status, 400, 'an owner with no PD role is refused');

  const people = (await api('supply', 'GET', '/api/pd/intake')).body.people;
  const labPerson = people.find(p => p.name === 'Lab Rep');
  r = await api('supply', 'POST', `/api/pd/intake/observation/${unclassifiedId}/file`, { owner_id: labPerson.id });
  eq(r.body.status, 'triaged', 'with a Problem AND an owner it is triaged');

  r = await api('production', 'POST', `/api/pd/intake/request/${requestId}/file`, { problem_id: conceptId, owner_id: labPerson.id });
  eq(r.status, 200, 'the Registrar can file too');
  eq(r.body.status, 'open', 'a settled Request reads "open", not "triaged" — its own live state');

  /* ---- 6. The history is written, and cannot be rewritten ------------ */
  r = await api('supply', 'GET', `/api/pd/intake/observation/${unclassifiedId}`);
  eq(r.status, 200, 'an item opens with its own history');
  const fields = r.body.history.map(h => h.field);
  ok(fields.includes('problem_id'), 'filing against a Problem is in the history');
  ok(fields.includes('owner_id'), 'giving it an owner is in the history');
  ok(fields.includes('status'), 'the status change is in the history');
  ok(r.body.history.every(h => h.who), 'every history row names who, so a reader knows whom to ask');

  /* ---- 7. Content is editable; what it was is not -------------------- */
  r = await api('kam', 'POST', `/api/pd/intake/challenge/${challengeId}/edit`, { complaint_text: 'Dealer in Sadiqabad says the crop response is behind the competitor at the same bag rate. He compared 50 kg against 50 kg.' });
  eq(r.status, 200, 'the author may correct their own entry');
  eq(r.body.changed, 1, 'one field changed, so one history row');

  r = await api('lab', 'POST', `/api/pd/intake/challenge/${challengeId}/edit`, { complaint_text: 'someone else’s entry' });
  eq(r.status, 403, 'someone else’s entry is not theirs to edit');
  noBannedWords(r.body.error, 'the not-yours-to-edit message');

  r = await api('supply', 'POST', `/api/pd/intake/challenge/${challengeId}/edit`, { product_ref: 'NP 11-44 (granular)' });
  eq(r.status, 200, 'the moderator group may edit any entry');

  r = await api('kam', 'POST', `/api/pd/intake/challenge/${challengeId}/edit`, { product_ref: '' });
  eq(r.status, 400, 'the field that makes it a Challenge cannot be emptied');

  r = await api('supply', 'GET', `/api/pd/intake/challenge/${challengeId}`);
  const edits = r.body.history.filter(h => h.change_kind === 'edit');
  eq(edits.length, 2, 'both edits are kept, in order');
  ok(edits[0].old_value.startsWith('Dealer in Sadiqabad says'), 'the first edit kept what the text used to say');
  ok(edits[0].new_value.includes('50 kg against 50 kg'), 'and what it became');

  /* ---- 8. Moving between doors --------------------------------------- */
  r = await api('kam', 'POST', `/api/pd/intake/observation/${chosenObsId}/move`, { to_type: 'challenge' });
  eq(r.status, 403, 'a team member cannot refile someone else’s entry');

  r = await api('supply', 'POST', `/api/pd/intake/observation/${chosenObsId}/move`, { to_type: 'challenge' });
  eq(r.status, 400, 'moving to a Challenge asks for the product, because a Challenge names one');
  noBannedWords(r.body.error, 'the needs-a-product message');

  r = await api('supply', 'POST', `/api/pd/intake/observation/${chosenObsId}/move`, { to_type: 'challenge', product_ref: 'Humic flake (Rudolf)' });
  eq(r.status, 200, 'and moves once it has it — no reason asked for, at any point');
  eq(r.body.label, 'CH-002', 'the new type issues its own number');
  eq(r.body.was, 'O-004', 'and the old number is named, not erased');
  const movedToId = r.body.id;

  r = await api('supply', 'GET', `/api/pd/intake/observation/${chosenObsId}`);
  eq(r.body.became.label, 'CH-002', 'the old number still resolves, and points at what it became');
  const snaps = r.body.history.filter(h => h.change_kind === 'snapshot_on_move');
  ok(snaps.length >= 3, 'what it said at the moment it moved is kept, field by field');
  ok(snaps.some(h => h.field === 'text' && h.old_value.includes('Rudolf')), 'including the text as filed');
  eq(r.body.moves.length, 1, 'the move itself is recorded');
  eq(r.body.moves[0].original_author, 'Lab Rep', 'the ORIGINAL author is kept, permanently');
  eq(r.body.moves[0].mover, 'Supply Chain', 'and the mover is recorded as the mover, separately');
  ok(r.body.moves[0].definition_text.startsWith('A Challenge is'), 'the "why" is the model’s own definition, not the mover’s prose');
  noBannedWords(r.body.moves[0].definition_text, 'the recorded definition');

  r = await api('supply', 'GET', `/api/pd/intake/challenge/${movedToId}`);
  eq(r.body.item.author, 'Lab Rep', 'authorship never transfers — the new record is still theirs');
  ok(r.body.item.text.includes('Rudolf'), 'the text a person wrote survives the move intact');
  ok(!/Carried over/.test(r.body.item.text), 'and nothing is appended when every field found a home in the new type');
  eq(r.body.raw.reported_by_name, 'Lab Rep', 'a field that HAS a home in the new type is carried in its own column');
  noBannedWords(r.body.item.text, 'the moved record’s text');

  r = await api('supply', 'POST', `/api/pd/intake/observation/${chosenObsId}/move`, { to_type: 'request' });
  eq(r.status, 409, 'an entry that has already moved cannot be moved twice from the old row');

  /* ---- 9. The author is told once, in three parts -------------------- */

  /* Delivery marks a notice seen, so exactly ONE route may return an unseen
     one: /api/pd/mywork, the only screen that renders it. What came in fetches
     on every route change and shows nothing, so if it ever returns notices it
     silently eats a message the author never read. That shipped twice; this
     pins it. */
  r = await api('lab', 'GET', '/api/pd/intake');
  eq(r.status, 200, 'What came in still loads');
  ok(r.body.notices === undefined, 'and What came in never carries a notice, so it can never consume one');
  r = await api('lab', 'GET', '/api/pd/mywork');
  ok((r.body.notices || []).some(n => !n.seen_at), 'the unseen notice is still there for What I owe');

  r = await api('lab', 'GET', '/api/pd/notices');
  const notice = r.body.notices.find(n => /Challenge/.test(n.headline));
  ok(notice, 'the author is told their entry became a Challenge');
  ok(r.body.notices.some(n => /filed under P-/.test(n.headline)), 'and was told, separately, when an entry of theirs was filed under a Problem');
  ok(r.body.notices.length === 2, 'one notice per refiling, and no more');
  eq(notice.headline, 'Your entry is now Challenge CH-002.', 'part one: what it became');
  ok(notice.definition_text.startsWith('A Challenge is'), 'part two: the one-line definition of the new type');
  eq(notice.mover, 'Supply Chain', 'part three: who moved it');
  noBannedWords(notice.headline + ' ' + notice.definition_text, 'the notice');
  ok(!/next time|training|sorry|apolog/i.test(notice.headline + notice.definition_text), 'and nothing shaped like feedback');

  r = await api('supply', 'GET', '/api/pd/notices');
  eq(r.body.notices.length, 0, 'the mover is not notified about their own filing act');

  r = await api('lab', 'POST', `/api/pd/notices/${notice.id}/reply`, { reply_text: 'I meant it as something that just arrived, not a complaint.' });
  eq(r.status, 200, 'the author can answer back');
  r = await api('supply', 'GET', '/api/pd/replies');
  eq(r.body.replies.length, 1, 'and the reply reaches the person who moved it');
  eq(r.body.replies[0].author, 'Lab Rep', 'as a question from a named colleague');

  r = await api('kam', 'GET', '/api/pd/replies');
  eq(r.status, 403, 'the replies list is part of triage, not a public feed');

  /* ---- 10. Undo ------------------------------------------------------ */
  const moveId = (await api('supply', 'GET', `/api/pd/intake/observation/${chosenObsId}`)).body.moves[0].id;
  r = await api('kam', 'POST', `/api/pd/reclassifications/${moveId}/undo`);
  eq(r.status, 403, 'undo is part of triage');

  r = await api('supply', 'POST', `/api/pd/reclassifications/${moveId}/undo`);
  eq(r.status, 200, 'any refiling is reversible, and the undo needs no reason either');

  r = await api('supply', 'GET', `/api/pd/intake/observation/${chosenObsId}`);
  eq(r.body.became, null, 'the original is live again');
  eq(r.body.moves[0].reversed, 1, 'the undo is itself recorded');

  r = await api('supply', 'GET', `/api/pd/intake/challenge/${movedToId}`);
  eq(r.body.became.label, 'O-004', 'and the row the move created still resolves, pointing back');

  r = await api('supply', 'POST', `/api/pd/reclassifications/${moveId}/undo`);
  eq(r.status, 404, 'an undo cannot be undone twice');

  /* ---- 11. Closing a Problem needs the result written ---------------- */
  r = await api('supply', 'POST', `/api/pd/problems/${problemId}/close`, { status: 'retired' });
  eq(r.status, 400, 'nothing gets closed until we have written the result');
  r = await api('supply', 'POST', `/api/pd/problems/${problemId}/close`, { status: 'retired', reason: 'x' });
  eq(r.status, 400, 'and the reason has to actually be there');
  r = await api('supply', 'POST', `/api/pd/problems/${problemId}/close`, { status: 'retired', closed_reason: 'Folded into P-02 — the same soil chemistry, one parent is enough.' });
  eq(r.status, 200, 'with the result written, it closes');
  r = await api('kam', 'POST', `/api/pd/problems/${conceptId}/close`, { status: 'retired', closed_reason: 'no' });
  eq(r.status, 403, 'closing a Problem is not open to everyone the way registering one is');

  /* ---- 12. Nothing here can count a person -------------------------- */
  r = await api('admin', 'GET', '/api/pd/intake');
  const grouped = JSON.stringify(r.body).match(/per_person|by_author|error_count|accuracy|score/i);
  ok(!grouped, 'no response carries a per-person count, score or accuracy field');

  /* ---- 13. What the 9 Sept review found, so it cannot come back ------- */

  // (a) Two people moving the same entry at the same instant. This used to
  //     create two permanently numbered records, one of which nothing pointed
  //     at, and send the author two notices about one entry.
  r = await api('kam', 'POST', '/api/pd/intake', { text: 'Two moderators are about to reach for this one at the same moment.' });
  const raceId = r.body.id;
  const both = await Promise.all([
    api('supply', 'POST', `/api/pd/intake/observation/${raceId}/move`, { to_type: 'challenge', product_ref: 'Maxim' }),
    api('production', 'POST', `/api/pd/intake/observation/${raceId}/move`, { to_type: 'challenge', product_ref: 'NP 11-44' }),
  ]);
  eq(both.filter(x => x.status === 200).length, 1, 'exactly one of two simultaneous moves goes through');
  eq(both.filter(x => x.status === 409).length, 1, 'the other is told someone got there first');
  noBannedWords(both.find(x => x.status === 409).body.error, 'the someone-got-there-first message');
  r = await api('supply', 'GET', `/api/pd/intake/observation/${raceId}`);
  ok(r.body.became, 'the entry points at exactly one thing');
  eq(r.body.moves.filter(m => !m.reversed).length, 1, 'and only one move was recorded');

  // (b) A move that cannot go ahead must not leave the entry claimed.
  r = await api('kam', 'POST', '/api/pd/intake', { text: 'A move will be attempted on this one without the field it needs.' });
  const stuckId = r.body.id;
  r = await api('supply', 'POST', `/api/pd/intake/observation/${stuckId}/move`, { to_type: 'challenge' });
  eq(r.status, 400, 'a move with nothing to name the product is refused');
  r = await api('supply', 'POST', `/api/pd/intake/observation/${stuckId}/move`, { to_type: 'challenge', product_ref: 'Maxim' });
  eq(r.status, 200, 'and the entry is still movable afterwards, not stuck');

  // (c) Editing an entry that has already been recorded as something else.
  r = await api('kam', 'POST', `/api/pd/intake/observation/${stuckId}/edit`, { text: 'trying to edit the one that moved' });
  eq(r.status, 409, 'an entry that became something else is edited where it now lives');
  noBannedWords(r.body.error, 'the edit-it-there message');

  // (d) A long value is shortened at the door, not refused by the database
  //     after the history has already been written.
  const longRef = 'X'.repeat(300);
  const movedCh = (await api('supply', 'GET', `/api/pd/intake/observation/${stuckId}`)).body.became;
  r = await api('supply', 'POST', `/api/pd/intake/challenge/${movedCh.id}/edit`, { product_ref: longRef });
  eq(r.status, 200, 'a 300-character product name is accepted');
  r = await api('supply', 'GET', `/api/pd/intake/challenge/${movedCh.id}`);
  eq(r.body.raw.product_ref.length, 120, 'stored at the column’s own width');
  ok(!r.body.history.some(h => h.change_kind === 'not_applied'), 'and no change is recorded that did not happen');

  // (e) Two moderators filing the same entry at once — one setting the
  //     problem, the other the owner — must not leave it filled in but stuck.
  r = await api('kam', 'POST', '/api/pd/intake', { text: 'Two moderators will file this one at the same moment, from two directions.' });
  const bothFileId = r.body.id;
  const owner2 = people.find(p => p.name === 'Administrator');
  await Promise.all([
    api('supply', 'POST', `/api/pd/intake/observation/${bothFileId}/file`, { problem_id: conceptId }),
    api('production', 'POST', `/api/pd/intake/observation/${bothFileId}/file`, { owner_id: owner2.id }),
  ]);
  r = await api('supply', 'GET', `/api/pd/intake/observation/${bothFileId}`);
  eq(r.body.item.status, 'triaged', 'the entry ends up filed, not sitting in the queue with both fields set');

  // (f) A Request carries what a Challenge or an Observation has no column for,
  //     and can be moved back again.
  r = await api('lab', 'POST', '/api/pd/intake', { door: 'request', requester: 'Rudolf', recipient: 'Rudolf, Lahore', text: 'Two drums of the fulvate liquid, for his own trial.', dispatch_date: '2026-10-01', return_by: '2026-12-15' });
  const roundTripId = r.body.id;
  r = await api('supply', 'POST', `/api/pd/intake/request/${roundTripId}/move`, { to_type: 'observation', note: 'Keeping it as what arrived for now.' });
  eq(r.status, 200, 'a Request moves to an Observation');
  const asObs = r.body;
  r = await api('supply', 'GET', `/api/pd/intake/observation/${asObs.id}`);
  ok(/was to be dispatched by/.test(r.body.item.text), 'the dispatch date is carried onto the record, not dropped');
  ok(/an answer was wanted by/.test(r.body.item.text), 'and so is the date an answer was wanted');
  eq(r.body.moves[0].free_note, 'Keeping it as what arrived for now.', 'an optional note is kept when one is offered');
  r = await api('supply', 'POST', `/api/pd/intake/observation/${asObs.id}/move`, { to_type: 'request', recipient: 'Rudolf, Lahore' });
  eq(r.status, 200, 'and it can be moved back to a Request without retyping who asked');

  // (g) Undo, then move somewhere else, then undo again.
  const firstMove = (await api('supply', 'GET', `/api/pd/intake/observation/${raceId}`)).body.moves.find(m => !m.reversed);
  r = await api('supply', 'POST', `/api/pd/reclassifications/${firstMove.id}/undo`);
  eq(r.status, 200, 'the move is taken back');
  r = await api('supply', 'POST', `/api/pd/intake/observation/${raceId}/move`, { to_type: 'request', requester: 'Someone', recipient: 'Somewhere' });
  eq(r.status, 200, 'and the entry can then be recorded as something else again');
  r = await api('supply', 'POST', `/api/pd/reclassifications/${firstMove.id}/undo`);
  eq(r.status, 404, 'while the move already taken back cannot be taken back twice');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
