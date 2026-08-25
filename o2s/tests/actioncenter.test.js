/* Two changes, 22 August 2026.

   1. Print-on-pack is opened to whoever can create a PO, by asking the access
      matrix about the 'entry' screen rather than naming roles in code.

   2. My Actions can say "blocking now", not only "waiting a long time".
      Before this, urgency came purely from how long an item had waited, and
      actTiming clamps a future date to 0 days — so a printing slip due tomorrow
      scored as the LEAST urgent thing on the screen, below a five-day-old
      inspection. Now an item may declare `due`, and is judged on how soon it is
      needed. Nothing that exists today declares one, so nothing changes for the
      team until the slip lands.

   Run: node actioncenter.test.js */
const H = require('./harness.js');
const fs = require('fs');
const vm = require('vm');

const STATE = JSON.parse(fs.readFileSync(H.STATE, 'utf8')).data;

/* Real source, pulled out of the shipping file. */
const src = ['accessOv', '_ownerEdit', 'accessLevelOn', 'accessLevel', 'canView', 'screenEditOK',
             'actOverdue', 'actTiming', 'actUrg', 'actSort', 'acRiskOf', 'acWaitTxt']
            .map(H.grab).join('\n\n')
          + '\n' + (function(){
              /* SCREENS is declared `const`, which grabObj (var-only) will not find.
                 Pull it with the harness's bracket matcher instead of loosening
                 grabObj — a shared helper that quietly matches more is how the
                 array-vs-object bug got in last time. */
              const i = H.html.indexOf('const SCREENS=');
              if (i < 0) throw new Error('SCREENS not found in o2s.html');
              /* `const` at the top of a vm script is a lexical binding and never
                 appears on the sandbox object, so the test could not see it.
                 Only the declaration keyword is rewritten, for the sandbox — the
                 array itself is the real one out of o2s.html, untouched. */
              return H.matchBlock(i, 'SCREENS', '[').replace(/^const /, 'var ') + ';';
            })();

/* TODAY is built with the APP'S OWN expression, not a convenient midnight.
   The first version of this test used new Date('2026-08-22T00:00:00Z') — exact
   UTC midnight, which the app produces for one millisecond a day. Every deadline
   assertion passed only because of that choice, and hid a real bug: the app's
   TODAY carries a time of day, so a clock-to-clock subtraction flipped at noon
   and "due today" read as "1d past due" all afternoon.
   `at(h)` reproduces the app's expression at a chosen local hour so the suite
   runs the same checks morning AND afternoon. */
function appTODAY(now){ return new Date(now.getTime() - now.getTimezoneOffset()*60000); }
function at(hourLocal){ const n=new Date(2026,7,22,hourLocal,0,0); return appTODAY(n); }
let TODAY = at(9);
const box = {
  console, Date,
  get TODAY(){ return TODAY; },
  state: { role: 'COO', masters: STATE.masters },
  scr: id => box.SCREENS.find(s => s.id === id),
  attentionOf: () => ({ hot: false }),
  isOverdue: () => false,
  daysOver: () => 0,
};
box.globalThis = box;
vm.createContext(box);
vm.runInContext(src, box);
const { screenEditOK, accessLevel, actUrg, actTiming, actSort, acRiskOf, acWaitTxt } = box;

let pass = 0, fail = 0; const fails = [];
function ok(n, c, x) { if (c) pass++; else { fail++; fails.push(n + (x ? '  [' + x + ']' : '')); } }
function eq(n, got, want) { ok(n, got === want, 'got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want)); }

const asRole = r => { box.state.role = r; };
const day = n => { const d = new Date(TODAY.toISOString().slice(0,10)); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/* Run a block of checks at several times of day. Anything that depends on the
   hand position rather than the date shows up here and nowhere else. */
function atEveryHour(label, fn){ [0,9,12,13,18,23].forEach(function(h){ TODAY=at(h); fn(h+':00 \u00b7 '+label); }); TODAY=at(9); }

/* ================= 1. who may answer print-on-pack ================= */

/* The three the COO named: anyone who can create a PO. */
['COO', 'KAM', 'Plant Manager'].forEach(r => {
  asRole(r); ok('CAN answer print-on-pack: ' + r, screenEditOK('entry') === true,
                'accessLevel=' + accessLevel(r, 'entry'));
});

/* Everyone else is refused. These are the roles the access matrix explicitly
   denies the entry screen, plus the CFO who has view but not edit. */
['Supply Chain', 'Supply Chain Officer', 'Production', 'QA Inspector',
 'QCM', 'AQCM', 'Lab Rep', 'CFO', 'Finance'].forEach(r => {
  asRole(r); ok('CANNOT answer print-on-pack: ' + r, screenEditOK('entry') === false,
                'accessLevel=' + accessLevel(r, 'entry'));
});

/* The point of using the matrix rather than a role list: a future PO-entry grant
   carries this with it, with no second code change. */
{
  const m = box.state.masters.accessMatrix;
  const saved = m['Supply Chain'].entry;
  m['Supply Chain'].entry = { v: true, e: true };
  asRole('Supply Chain');
  ok('a NEW entry grant opens print-on-pack with no code change', screenEditOK('entry') === true);
  m['Supply Chain'].entry = saved;
  asRole('Supply Chain');
  ok('and removing the grant closes it again', screenEditOK('entry') === false);
}

/* It must ask about the ENTRY screen, not whatever screen the person is on.
   canEdit() consults the override for state.screen, which is why it is wrong
   here: QA Inspector holds prod:{e:true}, so standing on Production would have
   let them through. */
{
  asRole('QA Inspector');
  box.state.screen = 'prod';
  eq('QA Inspector has edit on the Production screen (the trap)',
     accessLevel('QA Inspector', 'prod'), 'edit');
  ok('but still cannot answer print-on-pack while standing there',
     screenEditOK('entry') === false);
  delete box.state.screen;
}
asRole('COO');

/* The gate must be asked in BOTH places. The first cut of this change moved the
   check on the opener and left the writer on the old role list, so a permitted
   person could answer 21 POs and lose them all at the Save. Source guard, not
   proof of behaviour — but it is the shape of the fault, so it is worth pinning. */
{
  const open = /function openBulkPrintDecision\(\)\{[\s\S]{0,200}?\}/.exec(H.html);
  const save = /function saveBulkPrintDecision\(\)\{[\s\S]{0,200}?;/.exec(H.html);
  ok('GUARD: the opener asks bulkPDMayAnswer()', !!open && /bulkPDMayAnswer\(\)/.test(open[0]),
     open ? open[0].slice(0, 110) : 'opener not found');
  ok('GUARD: the WRITER asks the same predicate', !!save && /bulkPDMayAnswer\(\)/.test(save[0]),
     save ? save[0].slice(0, 110) : 'writer not found');
  ok('GUARD: no hardcoded COO/KAM role check left in either',
     !/state\.role==='COO'\|\|state\.role==='KAM'/.test((open?open[0]:'') + (save?save[0]:'')));
}

/* ================= 2. a deadline outranks a long wait ================= */

/* The exact case that started this: a slip due tomorrow against an inspection
   that has been sitting for five days. */
const slipTomorrow = { label: 'Sign slip', due: day(1) };
const oldInspection = { label: 'Inspect', batch: { openedDate: day(-5) } };

eq('BEFORE-style item: a five-day-old inspection scores 1 (7+) or 2 (3+)', actUrg(oldInspection), 2);
eq('a slip due TOMORROW now scores 1, not 3', actUrg(slipTomorrow), 1);
ok('so the slip sorts ABOVE the five-day-old inspection',
   actSort([oldInspection, slipTomorrow])[0] === slipTomorrow);

/* The whole band — checked at six times of day, because the bug this replaces
   only appeared after lunch. */
atEveryHour('urgency band', function(when){
  eq(when+' due today  -> 0', actUrg({ label: 'x', due: day(0) }), 0);
  eq(when+' due tomorrow -> 1', actUrg({ label: 'x', due: day(1) }), 1);
  eq(when+' due in 2 days -> 2', actUrg({ label: 'x', due: day(2) }), 2);
  eq(when+' due in 5 days -> 3', actUrg({ label: 'x', due: day(5) }), 3);
  eq(when+' PAST due -> 0', actUrg({ label: 'x', due: day(-3) }), 0);
});

/* Nearest deadline first inside one band, and a deadline beats no deadline. */
{
  const a = { label: 'a', due: day(4) }, b = { label: 'b', due: day(6) };
  const none = { label: 'c', batch: { openedDate: day(-1) } };
  const order = actSort([b, none, a]).map(x => x.label).join('');
  eq('sorted: nearest deadline, then the rest', order, 'abc');
}

/* What the chip says. "0d waiting" on something due today is the opposite of
   the truth, which is what this replaces. */
atEveryHour('chip text', function(when){
  eq(when+' chip: due today',    acWaitTxt({ label: 'x', due: day(0) }),  'due today');
  eq(when+' chip: due tomorrow', acWaitTxt({ label: 'x', due: day(1) }),  'due tomorrow');
  eq(when+' chip: due in 3d',    acWaitTxt({ label: 'x', due: day(3) }),  'due in 3d');
  eq(when+' chip: past due',     acWaitTxt({ label: 'x', due: day(-2) }), '2d past due');
  eq(when+' risk past due = late', acRiskOf({ label: 'x', due: day(-2) }), 'late');
  eq(when+' risk due today = today', acRiskOf({ label: 'x', due: day(0) }), 'today');
});

/* ================= 3. nothing that exists today changes ================= */

/* No live action item declares `due`, so every one of them keeps the exact
   behaviour it had. This is the check that says the change is safe to ship. */
{
  const cases = [
    ['a batch opened 9 days ago',  { label: 'Lab QC', batch: { openedDate: day(-9) } }, 1],
    ['a batch opened 4 days ago',  { label: 'Lab QC', batch: { openedDate: day(-4) } }, 2],
    ['a batch opened today',       { label: 'Lab QC', batch: { openedDate: day(0) } },  3],
    ['a PR raised 3 days ago',     { label: 'Approve PR', pr: { date: day(-3) } },      2],
  ];
  cases.forEach(([name, it, want]) => eq('unchanged: ' + name, actUrg(it), want));
  eq('unchanged: the wait chip still reads in days',
     acWaitTxt({ label: 'Lab QC', batch: { openedDate: day(-4) } }), '4d waiting');
  ok('unchanged: dueIn is null when no deadline is declared',
     actTiming({ label: 'Lab QC', batch: { openedDate: day(-4) } }).dueIn === null);
}

/* The clamp that caused the original bug is deliberately still there for
   `created`, because an event date really is always in the past. */
eq('a future created date still clamps to 0 days',
   actTiming({ label: 'Lab QC', batch: { openedDate: day(3) } }).days, 0);

/* A malformed due date must not poison the item. */
{
  const bad = { label: 'x', due: 'not-a-date' };
  ok('a malformed due date falls back to the old behaviour', actTiming(bad).dueIn === null);
  eq('and still scores as an ordinary item', actUrg(bad), 3);
}

console.log('\nAction Center + print-on-pack access: ' + pass + ' passed, ' + fail + ' failed');
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fail ? 1 : 0);
