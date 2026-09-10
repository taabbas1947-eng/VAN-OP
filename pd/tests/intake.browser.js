/* ============================================================================
 * PD · intake + triage — BROWSER checks.
 *
 * Why this file exists, and why it is not optional. The last PD build shipped
 * a bug the API suite could not see: signing out raced the hash-change router,
 * so the previous session's page repainted over the login form. It was a
 * client-side timing bug, invisible to curl. PORTING_STATUS.md's own ruling
 * after that: "Browser-level checks should stay part of testing each new
 * piece, not just API calls." This is that, for the intake screens.
 *
 * Usage:  BASE=http://127.0.0.1:4310 node pd/tests/intake.browser.js
 * ==========================================================================*/
const { chromium } = require('playwright');
// The sandbox ships one Chromium build; pin to it rather than letting
// Playwright look for the version it was packaged against.
const CHROME = process.env.PD_TEST_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:4310';
const PW = process.env.PD_TEST_PW || 'van@2026';

let pass = 0, fail = 0;
const ok = (c, what) => { if (c) pass++; else { fail++; console.log('  FAIL  ' + what); } };

(async () => {
  console.log('PD intake browser checks → ' + BASE);
  const browser = await chromium.launch({ executablePath: require('fs').existsSync(CHROME) ? CHROME : undefined, args: ['--no-sandbox'] });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  // A failed resource load is not a page error: this sandbox has no route to
  // fonts.googleapis.com, and a 401 is a real answer the page handles. What
  // this is watching for is an uncaught exception in the page's own code.
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });

  // Changing only the hash is a SAME-DOCUMENT navigation: page.goto returns
  // before the router has repainted, so waiting on a selector that already
  // exists on the previous screen proves nothing. Wait for the words the new
  // screen actually says.
  async function waitForText(re) {
    await page.waitForFunction(
      (src) => new RegExp(src).test(document.querySelector('.main') ? document.querySelector('.main').textContent : ''),
      re.source, { timeout: 8000 });
  }

  async function signIn(user) {
    await page.goto(BASE + '/pd', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#u');
    await page.fill('#u', user); await page.fill('#p', PW);
    await page.click('#go');
    await page.waitForSelector('.side', { timeout: 8000 });
  }
  // "What I owe" is the landing page; most of these checks are about the door.
  async function signInAtDoor(user) {
    await signIn(user);
    await page.goto(BASE + '/pd#intake', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#text', { timeout: 8000 });
  }

  /* ---- the page actually renders ---- */
  await page.goto(BASE + '/pd', { waitUntil: 'domcontentloaded' });
  ok(await page.isVisible('#u'), 'signed out, /pd shows the sign-in form');
  ok(!(await page.isVisible('.side')), 'and no part of the app is visible behind it');

  await page.fill('#u', 'admin'); await page.fill('#p', 'not-the-password'); await page.click('#go');
  await page.waitForSelector('.msg.bad', { timeout: 8000 });
  ok(await page.isVisible('#u'), 'a refused sign-in leaves the form up');
  const badLogin = await page.textContent('.msg.bad');
  ok(/did not match/.test(badLogin), 'and says so in PD’s own words');
  ok(!/incorrect/i.test(badLogin), 'without the platform’s banned word reaching a PD screen');

  await signInAtDoor('supply');   // Custodian
  ok((await page.textContent('.side .foot b')) === 'Supply Chain', 'the shell names who is signed in');
  ok(!(await page.isVisible('a[href="#triage"]')), 'there is no separate triage screen — filing lives on What came in');
  ok((await page.$$('.side .nav a')).length === 4, 'the nav carries the four screens MODEL.md §5 signs off, and no more');

  /* ---- writing something down, with no type chosen ---- */
  const text = 'Browser check ' + Date.now() + ' — a drum of the fulvate liquid arrived without paperwork.';
  await page.fill('#text', text);
  await page.click('#save');
  await page.waitForSelector('.msg.ok', { timeout: 8000 });
  const okmsg = await page.textContent('.msg.ok');
  ok(/Saved as O-\d+/.test(okmsg), 'it saves with no type chosen and says what number it got');
  ok(/Observation/.test(okmsg), 'and says plainly it is held as an Observation for now');
  ok((await page.textContent('.main')).includes(text.slice(0, 40)), 'and it appears in "Your entries" straight away');

  /* ---- the door fields appear only for the door that needs them ---- */
  ok(!(await page.isVisible('#product_ref')), 'no product field until a complaint is chosen');
  await page.click('[data-door="challenge"]');
  await page.waitForSelector('#product_ref');
  ok(await page.isVisible('#product_ref'), 'choosing "a complaint" asks which product');
  await page.click('[data-door="request"]');
  await page.waitForSelector('#recipient');
  ok(await page.isVisible('#recipient') && !(await page.isVisible('#product_ref')), 'choosing "a sample request" swaps to who it goes to');

  await page.fill('#text', 'Browser check — Sheikh Arshad wants a 25 kg pack of the coated MAP for his own plot.');
  await page.fill('#recipient', 'Sheikh Arshad, Multan');
  await page.click('#save');
  await page.waitForSelector('.msg.ok', { timeout: 8000 });
  ok(/Saved as REQ-\d+/.test(await page.textContent('.msg.ok')), 'a Request saves through its own door');

  /* ---- an entry that cannot save says so, and does not lose what was typed ---- */
  /* A door whose own field is empty does not turn the entry away — §3 says
     classification is never a gate on someone writing something down. */
  await page.click('[data-door="challenge"]');
  await page.fill('#text', 'Browser check — a complaint whose product name I cannot remember.');
  await page.click('#save');
  await page.waitForSelector('.msg.ok', { timeout: 8000 });
  ok(/complaint/i.test(await page.textContent('.msg.ok')), 'a complaint with no product named still saves, and says where it landed');

  /* The draft survives a re-render. Clicking a door button repaints the page;
     it used to empty the box the person had just written in. */
  const kept = 'Browser check — this sentence must survive a click on a door button.';
  await page.fill('#text', kept);
  await page.click('[data-door="request"]');
  await page.waitForSelector('#recipient');
  ok((await page.inputValue('#text')) === kept, 'what the person typed survives choosing a door');
  await page.fill('#text', 'too short');
  await page.click('#save');
  await page.waitForSelector('.msg.bad', { timeout: 8000 });
  ok((await page.inputValue('#text')) === 'too short', 'and survives a message coming back from the server');
  await page.fill('#text', '');

  /* ---- triage ---- */
  await page.goto(BASE + '/pd#problems', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#ptitle', { timeout: 8000 });
  await page.fill('#ptitle', 'Browser check problem');
  await page.fill('#pstatement', 'A problem registered by the browser check, so triage has something to file against.');
  await page.click('#psave');
  await page.waitForSelector('.msg.ok', { timeout: 8000 });
  ok(/Registered as P-\d+/.test(await page.textContent('.msg.ok')), 'a Problem registers directly, not through a door');

  await page.goto(BASE + '/pd#intake', { waitUntil: 'domcontentloaded' });
  await waitForText(/Waiting to be filed/);
  const triageText = await page.textContent('.main');
  if (process.env.PD_DEBUG) console.log('DEBUG intake main >>>', triageText.slice(0, 500));
  ok(/Waiting to be filed/.test(triageText), 'the filing list is a section of What came in, on the same screen as the door');
  ok(/Write down what happened/.test(triageText), 'and the door is still right there above it');

  const firstFile = await page.$('[data-file]');
  const key = await firstFile.getAttribute('data-file');
  await page.selectOption('[data-p="' + key + '"]', { index: 1 });
  await page.selectOption('[data-o="' + key + '"]', { index: 1 });
  await page.click('[data-file="' + key + '"]');
  await page.waitForSelector('.msg.ok', { timeout: 8000 });
  ok(/Filed/.test(await page.textContent('.msg.ok')), 'filing an entry works from the screen');

  /* ---- one item, and moving it ---- */
  await page.click('a[href^="#item/"]');
  await page.waitForSelector('#domove', { timeout: 8000 });
  ok((await page.textContent('.page-h .sub')).length > 30, 'an item page leads with the model’s own definition of what it is');
  ok(await page.isVisible('#m_note'), 'the move box offers the optional note §2 says is always available');
  ok(!(await page.textContent('.main')).includes('required'), 'and does not mark it as needed');
  await page.selectOption('#to_type', 'challenge');
  await page.fill('#m_product_ref', 'Fulvate-coated MAP');
  await page.click('#domove');
  await page.waitForSelector('.msg.ok', { timeout: 8000 });
  ok(/is now CH-\d+/.test(await page.textContent('.msg.ok')), 'moving it to another door works, and names both numbers');

  /* ---- the author is told, once, in three parts ---- */
  await page.click('#signout');
  await page.waitForSelector('#u', { timeout: 8000 });
  await signInAtDoor('supply');
  await page.goto(BASE + '/pd#intake', { waitUntil: 'domcontentloaded' });
  await waitForText(/Write down what happened/);
  ok(!(await page.isVisible('.notice')), 'the person who moved it is not notified about their own filing act');

  /* ---- THE SIGN-OUT RACE (the bug this file exists for) ---- */
  await page.goto(BASE + '/pd#triage', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.side', { timeout: 8000 });
  await page.click('#signout');
  await page.waitForTimeout(600);              // long enough for a late hashchange to repaint
  ok(await page.isVisible('#u'), 'signing out from a hash route leaves the sign-in form up');
  ok(!(await page.isVisible('.side')), 'and nothing from the old session repaints over it');
  ok(!(await page.evaluate(() => !!localStorage.getItem('van_token'))), 'and the token is gone');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#u', { timeout: 8000 });
  ok(await page.isVisible('#u'), 'reloading after sign-out still shows the sign-in form');

  /* ---- an account with no PD role gets a sentence, not a broken page ---- */
  await page.fill('#u', 'qa'); await page.fill('#p', PW); await page.click('#go');
  await page.waitForFunction(() => /No PD access yet/.test(document.querySelector('.signin') ? document.querySelector('.signin').textContent : ''), null, { timeout: 8000 }).catch(() => {});
  ok(/No PD access yet/.test(await page.textContent('.signin')), 'an account with no PD role is told so plainly');
  ok(!(await page.isVisible('.side')), 'and gets no navigation it cannot use');

  /* ---- a member sees intake, and no triage ---- */
  await page.evaluate(() => localStorage.removeItem('van_token'));
  await page.goto(BASE + '/pd', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#u');
  await signInAtDoor('kam');
  await waitForText(/Write down what happened/);
  ok(!(await page.textContent('.main')).includes('Waiting to be filed'), 'a team member sees the door but not the filing list');
  ok(!(await page.textContent('.main')).includes('Already filed'), 'and none of the moderator sections at all');

  /* ---- RECLASSIFICATION-RULES.md §6, swept over every screen ----
     "Never used, anywhere in the interface, in a notification, or in a log."
     Eleven exact strings, checked against the rendered app (#root), on every
     screen a person can reach. The earlier version of this check ran on one
     screen with a shortened list, which is how "going wrong" survived on the
     Problems screen until a compliance audit read it. */
  const BANNED = ['wrong', 'incorrect', 'invalid', 'error', 'mistake', 'misfiled',
    'bad entry', 'fixed', 'corrected by', 'should have been', 'please note for next time'];
  async function sweep(where) {
    const t = (await page.textContent('#root')).toLowerCase();
    const hit = BANNED.find(w => t.includes(w));
    ok(!hit, '§6: no banned word on ' + where + ' (found "' + hit + '")');
  }
  await page.evaluate(() => localStorage.removeItem('van_token'));
  await page.goto(BASE + '/pd', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#u'); await sweep('the sign-in screen');
  await signInAtDoor('supply');
  await waitForText(/Write down what happened/); await sweep('What came in');
  await page.goto(BASE + '/pd#problems', { waitUntil: 'domcontentloaded' });
  await waitForText(/Register one/); await sweep('Problems');
  await page.goto(BASE + '/pd#intake', { waitUntil: 'domcontentloaded' });
  await waitForText(/Waiting to be filed/); await sweep('the filing list');
  await page.click('a[href^="#item/"]');
  await page.waitForSelector('#domove', { timeout: 8000 }); await sweep('one entry');

  /* §7: the notice carries three parts and ONE action. An acknowledge button
     would be a second one. Written by one person, refiled by another, so there
     is an author to tell. */
  await page.goto(BASE + '/pd', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.removeItem('van_token'));
  await signInAtDoor('lab');
  await waitForText(/Write down what happened/);
  await page.fill('#text', 'Browser check — an entry written by one person and filed by another, so there is somebody to tell.');
  await page.click('#save'); await page.waitForSelector('.msg.ok', { timeout: 8000 });

  await page.goto(BASE + '/pd', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.removeItem('van_token'));
  await signInAtDoor('supply');
  await page.goto(BASE + '/pd#intake', { waitUntil: 'domcontentloaded' });
  await waitForText(/Waiting to be filed/);
  /* Pick the row this test wrote, by its words — not the first row on screen.
     The queue is drained oldest-first, so position is not identity. */
  const k2 = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('#root .item'));
    const row = rows.find(r => /an entry written by one person and filed by another/.test(r.textContent));
    const btn = row && row.querySelector('[data-file]');
    return btn ? btn.getAttribute('data-file') : null;
  });
  ok(!!k2, 'the entry just written is in the filing queue');
  await page.selectOption('[data-p="' + k2 + '"]', { index: 1 });
  await page.selectOption('[data-o="' + k2 + '"]', { index: 1 });
  await page.click('[data-file="' + k2 + '"]');
  await page.waitForSelector('.msg.ok', { timeout: 8000 });

  await page.goto(BASE + '/pd', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.removeItem('van_token'));
  // The author's message is delivered on What I owe, and only there, and only
  // once — so it is read on the first render after signing in, not by
  // navigating back to the screen a second time.
  await signIn('lab');
  await waitForText(/What I owe/);
  if (await page.isVisible('.notice')) {
    const n = await page.textContent('.notice');
    ok(!/got it/i.test(n), 'the notice offers no acknowledgement button');
    ok(await page.isVisible('[data-reply]'), 'and does offer "I meant something else"');
    ok(/moved by/.test(n), 'and names who moved it');
  } else { ok(false, 'the author saw a notice at all'); }

  ok(errors.length === 0, 'no uncaught page errors anywhere in the run (' + errors.slice(0, 2).join(' | ') + ')');

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
