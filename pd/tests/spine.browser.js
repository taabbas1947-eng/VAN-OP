/* ============================================================================
 * PD · Problem → Question → Bet → Run — BROWSER checks.
 * Same reason intake.browser.js exists: the last PD build shipped a
 * client-side bug the API suite could not see. Anything a person does by
 * clicking gets checked by clicking.
 *
 * Usage:  BASE=http://127.0.0.1:4310 node pd/tests/spine.browser.js
 * ==========================================================================*/
const { chromium } = require('playwright');
const CHROME = process.env.PD_TEST_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:4310';
const PW = process.env.PD_TEST_PW || 'van@2026';

let pass = 0, fail = 0;
const ok = (c, what) => { if (c) pass++; else { fail++; console.log('  FAIL  ' + what); } };

(async () => {
  console.log('PD spine browser checks → ' + BASE);
  const browser = await chromium.launch({ executablePath: require('fs').existsSync(CHROME) ? CHROME : undefined, args: ['--no-sandbox'] });
  const page = await (await browser.newContext()).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });

  async function signIn(user) {
    await page.goto(BASE + '/pd', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.removeItem('van_token'));
    await page.goto(BASE + '/pd', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#u');
    await page.fill('#u', user); await page.fill('#p', PW); await page.click('#go');
    await page.waitForSelector('.side', { timeout: 8000 });
  }
  async function waitForText(re) {
    await page.waitForFunction((src) => new RegExp(src).test(document.querySelector('.main') ? document.querySelector('.main').textContent : ''),
      re.source, { timeout: 8000 });
  }
  const main = () => page.textContent('.main');

  await signIn('lab');   // QC Head — a technical lead

  /* ---- register a problem and open its dossier ---- */
  await page.goto(BASE + '/pd#problems', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#ptitle', { timeout: 8000 });
  await page.fill('#ptitle', 'P fixation in our soils');
  await page.fill('#pstatement', 'Applied P is locked up before the crop can use it, across our calcareous soils.');
  await page.click('#psave');
  await page.waitForSelector('.msg.ok', { timeout: 8000 });
  await page.click('a[href^="#problem/"]');
  await waitForText(/Questions/);
  ok(/P fixation in our soils/.test(await main()), 'a problem opens into its own dossier');
  ok(/Nothing gets made until one is written/.test(await main()), 'and says plainly that a question comes first');

  /* ---- a question, and the draft surviving a re-render ---- */
  await page.click('[data-open="question"]');
  await page.waitForSelector('[id^="q_title_"]');
  const pid = (await page.getAttribute('[id^="q_title_"]', 'id')).split('_').pop();
  const qtext = 'We believe the coating occupies the calcium sites. Nobody has measured whether it does.';
  await page.fill('#q_title_' + pid, 'Does a humic coating slow P fixation?');
  await page.fill('#q_text_' + pid, qtext);
  await page.selectOption('#q_nature_' + pid, 'chemistry');
  await page.click('#q_save');
  await waitForText(/Q-001/);
  ok(/Does a humic coating slow P fixation\?/.test(await main()), 'the question appears on the dossier');
  ok(/owner · Lab Rep/.test(await main()), 'owned by whoever wrote it');

  /* ---- a bet, and the kill criterion it cannot go without ---- */
  await page.click('[data-open^="bet:"]');
  await page.waitForSelector('[id^="b_approach_"]');
  const approachId = await page.getAttribute('[id^="b_approach_"]', 'id');
  const qid = approachId.split('_').pop();
  await page.fill('#b_approach_' + qid, 'Coat MAP granules with humic acid flake at 3% and measure available P against an uncoated control.');
  await page.click('[data-bet="' + qid + '"]');
  await page.waitForSelector('.msg.bad', { timeout: 8000 });
  ok(/kill/i.test(await page.textContent('.msg.bad')), 'a bet with no kill criterion is refused, in those words');
  ok((await page.inputValue('#b_approach_' + qid)).length > 20, 'and the approach the person typed is still there');

  await page.fill('#b_kill_' + qid, 'No difference in available P at 30 days against the uncoated control.');
  await page.selectOption('#b_ctx_' + qid, { label: 'soil broadcast' });
  await page.click('[data-bet="' + qid + '"]');
  await waitForText(/B-001/);
  ok(/Kills it: No difference in available P/.test(await main()), 'the kill criterion is printed on the bet, not hidden behind it');
  ok(/soil broadcast/.test(await main()), 'and the context it is aimed through');

  /* ---- a run, with the objective on it (B7) ---- */
  await page.click('[data-open^="run:"]');
  await page.waitForSelector('[id^="r_exp_"]');
  const bid = (await page.getAttribute('[id^="r_exp_"]', 'id')).split('_').pop();
  await page.fill('#r_exp_' + bid, 'Available P at 30 days holds at least 15% above the uncoated control.');
  await page.click('[data-run="' + bid + '"]');
  await waitForText(/R-001/);
  const runText = await main();
  ok(/Answers: Does a humic coating slow P fixation\?/.test(runText), 'the run says which question it answers, on the run');
  ok(/kills it:/.test(runText), 'and the result that would kill its bet — not one click away');
  ok(/no recipe recorded yet/.test(runText), 'and says plainly that no recipe is recorded against it yet');

  /* ---- a look, and the investigation that opens itself ---- */
  await page.click('[data-open^="reading:"]');
  await page.waitForSelector('[id^="rd_verdict_"]');
  const rid = (await page.getAttribute('[id^="rd_verdict_"]', 'id')).split('_').pop();
  await page.selectOption('#rd_verdict_' + rid, 'abnormal');
  await page.fill('#rd_obs_' + rid, 'The granules have started to cake in the drum.');
  await page.fill('#rd_next_' + rid, '2026-10-02');
  await page.click('[data-reading="' + rid + '"]');
  await page.waitForSelector('.msg.ok', { timeout: 8000 });
  ok(/investigation is open/i.test(await page.textContent('.msg.ok')), 'an abnormal look opens an investigation, and says so');
  ok(/Something abnormal — an investigation is open/.test(await main()), 'and the run carries that state');
  ok(/Next look: 2 Oct 2026/.test(await main()), 'with the next look it set for itself');

  /* ---- closing needs the result written ---- */
  await page.click('[data-open^="closerun:"]');
  await page.waitForSelector('[id^="cr_actual_"]');
  await page.fill('#cr_actual_' + rid, 'It caked.');
  await page.click('[data-closerun="' + rid + '"]');
  await page.waitForSelector('.msg.bad', { timeout: 8000 });
  ok(/without the actual it records nothing/.test(await page.textContent('.msg.bad')), 'a run will not close on an actual too thin to mean anything');
  await page.fill('#cr_actual_' + rid, 'Available P held 18% above the control, but the granules caked in storage.');
  await page.click('[data-closerun="' + rid + '"]');
  await page.waitForFunction(() => /Nothing gets closed/.test(document.querySelector('.msg.bad') ? document.querySelector('.msg.bad').textContent : ''), null, { timeout: 8000 }).catch(() => {});
  ok(/Nothing gets closed until we have written the result/.test(await page.textContent('.msg.bad')), 'and closing without the result quotes the rule back');
  ok((await page.inputValue('#cr_actual_' + rid)).length > 40, 'with what was already typed still in the box');
  await page.fill('#cr_text_' + rid, 'The coating does hold available P, and it also caused caking at ambient humidity.');
  await page.selectOption('#cr_grade_' + rid, 'proven');
  await page.click('[data-closerun="' + rid + '"]');
  await waitForText(/Result:/);
  ok(/Result: The coating does hold available P/.test(await main()), 'with it written, the run closes carrying its result');
  ok(/caking at ambient humidity/.test(await main()), 'and the same words stand as a claim on the problem');

  /* ---- something the run turned up ---- */
  await page.click('[data-open^="observe:"]');
  await page.waitForSelector('[id^="ob_text_"]');
  await page.fill('#ob_text_' + rid, 'The drum smelled of ammonia by day four, which nobody was looking for.');
  await page.click('[data-observe="' + rid + '"]');
  await waitForText(/smelled of ammonia/);
  ok(/queue with everything else/.test(await page.textContent('.msg.ok')), 'something a run turned up goes to the same queue as anything else');
  ok(/smelled of ammonia/.test(await main()), 'and shows against the problem straight away');

  /* ---- a claim, challenged ---- */
  await page.click('[data-open="claim"]');
  await page.waitForSelector('[id^="c_text_"]');
  // Aim it at the question first: the challenge list only offers claims about
  // whatever the claim itself is about.
  const qOpt = await page.$$eval('[id^="c_subject_"] option', os => os.map(o => o.value).filter(v => /^question:/.test(v)));
  await page.selectOption('#c_subject_' + pid, qOpt[0]);
  await page.waitForSelector('#c_text_' + pid);
  await page.fill('#c_text_' + pid, 'The caking came from the binder, not the humic coating.');
  await page.selectOption('#c_grade_' + pid, 'contested');
  const opts = await page.$$eval('[id^="c_against_"] option', os => os.map(o => o.value).filter(Boolean));
  ok(opts.length > 0, 'the claim that closed the run is offered as something to challenge');
  await page.selectOption('#c_against_' + pid, opts[0]);
  await page.click('#c_save');
  await waitForText(/challenges C-/);
  ok(/challenges C-/.test(await main()), 'a claim can challenge another, and says which');
  ok(/contested/.test(await main()), 'and the question it sits under reads as contested');

  /* ---- §6 banned words, across the dossier ---- */
  const BANNED = ['wrong', 'incorrect', 'invalid', 'error', 'mistake', 'misfiled',
    'bad entry', 'fixed', 'corrected by', 'should have been', 'please note for next time'];
  const t = (await page.textContent('#root')).toLowerCase();
  const hit = BANNED.find(w => t.includes(w));
  ok(!hit, '§6: no banned word anywhere on the dossier (found "' + hit + '")');

  /* ---- the screen count did not grow ---- */
  ok((await page.$$('.side .nav a')).length === 2, 'the nav still carries two screens — a Problem is a panel, not a screen');
  ok(await page.isVisible('a[href="#problems"].active') || /Problems/.test(await page.textContent('.side')), 'and Problems is the one highlighted');

  /* ---- a team member can open work, not assign it ---- */
  await signIn('kam');
  await page.goto(BASE + '/pd#problems', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('a[href^="#problem/"]', { timeout: 8000 });
  await page.click('a[href^="#problem/"]');
  await waitForText(/Questions/);
  ok(await page.isVisible('[data-open="question"]'), 'a team member is offered the question form');
  ok(!(await page.isVisible('[data-assign]')), 'but not the control that names somebody else the owner');

  /* ---- a draft does not follow a person from one Problem to another ---- */
  await signIn('lab');
  await page.goto(BASE + '/pd#problems', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#ptitle', { timeout: 8000 });
  await page.fill('#ptitle', 'A second problem entirely');
  await page.fill('#pstatement', 'Somewhere else to open a question, so a stray draft has somewhere to land.');
  await page.click('#psave'); await page.waitForSelector('.msg.ok', { timeout: 8000 });
  const links = await page.$$eval('a[href^="#problem/"]', as => as.map(a => a.getAttribute('href')));
  await page.goto(BASE + '/pd' + links[links.length - 1], { waitUntil: 'domcontentloaded' });
  await waitForText(/Questions/);
  await page.click('[data-open="question"]');
  await page.waitForSelector('[id^="q_title_"]');
  const pidA = (await page.getAttribute('[id^="q_title_"]', 'id')).split('_').pop();
  await page.fill('#q_title_' + pidA, 'DRAFT MEANT FOR THE FIRST PROBLEM');
  await page.click('[data-open="question"]');            // cancel, leaving the draft behind
  await page.goto(BASE + '/pd' + links[0], { waitUntil: 'domcontentloaded' });
  await waitForText(/Questions/);
  await page.click('[data-open="question"]');
  await page.waitForSelector('[id^="q_title_"]');
  const pidB = (await page.getAttribute('[id^="q_title_"]', 'id')).split('_').pop();
  ok(pidA !== pidB, 'the two problems really are different');
  ok((await page.inputValue('#q_title_' + pidB)) === '', 'a draft left on one problem does not follow the person to another');

  ok(errors.length === 0, 'no uncaught page errors anywhere in the run (' + errors.slice(0, 2).join(' | ') + ')');
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
