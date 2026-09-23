#!/usr/bin/env node
/* preflight — the gate that must pass before any edit to o2s.html is committed.
 *
 * Every defect introduced on 23 September 2026 had one cause: work built on a
 * copy of the file staged earlier in the session, while the file on disk had
 * moved on. It cost the handoff entry twice, wiped another session's work once,
 * and nearly wiped the Gate Pass fix. Each time it was caught by luck or by a
 * test, and each time the response was to promise more care. Promises do not
 * survive a long session. This does.
 *
 *   node preflight.js base   <fresh> <working>   before editing
 *   node preflight.js verify <fresh> <candidate> before committing
 *
 * base   — refuses unless the working copy is byte-identical to the file just
 *          re-staged from disk. Run it AFTER staging and BEFORE the first edit.
 * verify — refuses unless every marker the base file carried is still present in
 *          the candidate. Catches a rebuild that silently dropped earlier work.
 *
 * Exit 0 = go. Exit 1 = stop, do not commit.
 */
const fs = require('fs');
const crypto = require('crypto');

const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const die = m => { console.error('PREFLIGHT FAILED\n  ' + m); process.exit(1); };
const ok  = m => { console.log('preflight ok — ' + m); process.exit(0); };

/* Markers: the load-bearing facts a rebuild must not lose. Each is a string that
   must appear in the file, with the count it must appear at. Add one line here
   for every change that ships; that is what makes the check grow teeth. */
const MARKERS = [
  ["var BUILD_ID='2026-09-23",            1, 'the build id'],
  ['function entryPrintEffective(',        1, 'FOC price-on-pack (23a)'],
  ['no Gate Pass. Correct it and re-inspect', 1, 'Gate Pass needs inspection (23b)'],
  ['function shortCloseRefusal(',          1, 'the short-close guard'],
  ["'Closed short'",                       2, 'the short-close stage'],
  ['function qaRequiredOn(',               1, 'the QA cut-over'],
  ["var QA_GO_LIVE='2026-09-23'",          1, 'the QA go-live date'],
  ['function evStamp(',                    1, 'the entry stamp'],
  ['function requestShortClose(',          1, 'short close: request'],
  ['function approveShortClose(',          1, 'short close: approve'],
  ['function reopenShortClose(',           1, 'short close: reopen'],
  ["code:'po.shortclose_request'",         1, 'short close: the rights'],
];

const [, , mode, freshPath, otherPath] = process.argv;
if (!mode || !freshPath || !otherPath) die('usage: preflight.js base|verify <fresh> <other>');
for (const p of [freshPath, otherPath]) if (!fs.existsSync(p)) die('missing file: ' + p);

if (mode === 'base') {
  const a = sha(freshPath), b = sha(otherPath);
  if (a !== b) die(
    'the working copy is NOT the file on disk.\n' +
    '  disk    ' + a.slice(0, 16) + '  ' + fs.statSync(freshPath).size + ' bytes\n' +
    '  working ' + b.slice(0, 16) + '  ' + fs.statSync(otherPath).size + ' bytes\n' +
    '  Someone changed it, or you are holding a stale stage. Re-stage and start again.');
  ok('working copy matches disk (' + a.slice(0, 16) + ')');
}

if (mode === 'verify') {
  const base = fs.readFileSync(freshPath, 'utf8');
  const cand = fs.readFileSync(otherPath, 'utf8');
  const lost = [];
  for (const [needle, want, what] of MARKERS) {
    const inBase = base.split(needle).length - 1;
    const inCand = cand.split(needle).length - 1;
    if (inBase === 0) continue;                       // not in this baseline yet
    if (inCand < Math.min(inBase, want)) lost.push(`${what}: base ${inBase}, candidate ${inCand}`);
  }
  if (lost.length) die('the candidate has LOST work that is on disk:\n  - ' + lost.join('\n  - '));
  if (cand.length < base.length * 0.98) die(
    'the candidate is ' + (base.length - cand.length) + ' bytes smaller than the file on disk. ' +
    'An edit adds; a rebuild from a stale copy shrinks. Check before committing.');
  ok('candidate keeps every marker the disk file carries');
}

die('unknown mode: ' + mode);
