/* BUILD 2026-11-27d. Older sheet notes show their colour (D-384).
   Tahir, 27 Nov 2026: "fix the older sheet notes" (the finding left open in build 2026-11-27c).
   Cause: a plain .note is styled only inside .qs pages. On the sheets (#modal) it has no border,
   so a note that set only border-color:var(--amber) or var(--red) showed as plain text, and
   one that set border-left showed a line with no box. The 35 notes that set a colour by hand,
   plus the Pack confirm note, now use the classes from 2026-11-27c (.note.sg warn / bad).
   Plain notes with no colour are not touched. Wording, margins and red text are unchanged.
   Run: node notes1127d.test.js */
const H = require('./harness.js');
const { ok, eq, report, html } = H;

/* 1. No note sets its own border colour any more */
const handSet = html.match(/class="note[^"']*" style="[^"]*border[^"]*"/g) || [];
eq('no note sets its own border colour', handSet.length, 0);
ok('no note colours its border in code', !/class="note" style="[^"]*'\+\([^)]*border-color/.test(html));

/* 2. The colour classes exist and come after the .qs note rule, so they win on the pages too */
const iQs = html.indexOf('.qs .note{'), iSg = html.indexOf('.note.sg{');
ok('.note.sg is declared after .qs .note', iQs > 0 && iSg > iQs, iQs + ' / ' + iSg);
ok('.note.sg.warn is amber', /\.note\.sg\.warn\{background:var\(--amber-50\);border-left-color:var\(--amber\)\}/.test(html));
ok('.note.sg.bad is red', /\.note\.sg\.bad\{background:var\(--red-50\);border-left-color:var\(--red\)\}/.test(html));

/* 3. The named notes from the 27c finding carry their colour */
ok('look-alike batch number note is amber', /class="note sg warn" style="margin-top:6px">'\+bpEsc\(no\)\+' is 1 character different/.test(html));
ok('short close notes are amber', (html.match(/class="note sg warn" style="margin-(bottom|top):10px">(Refused before by|This line was closed short before|You asked for this close)/g) || []).length === 4);
ok('KAM name note is amber and keeps its id', /id="kamNote" class="note sg warn" style="margin:10px 0">Your name, <b>/.test(html));

/* 4. Red notes stay red, and keep their red text where they had it */
ok('tiny close note is red with red text', /class="note sg bad" style="margin-bottom:10px;color:var\(--red\)">'\+_pe\(tcForm\.note\)/.test(html));
ok('complaint hold on Start loading is red', /class="note sg bad"><b>On complaint hold\.<\/b>/.test(html));
ok('complaint hold on the truck sheet is red', /class="note sg bad" style="margin-top:8px"><b>On complaint hold\.<\/b>/.test(html));
ok('held stock on Move stock is red', /class="note sg bad" style="margin-bottom:10px">'\+qsEsc\(lineHeldText/.test(html));
ok('role with no department is red (was --over)', /class="note sg bad" style="margin-top:10px">This role is not in the roles list/.test(html));
ok('PR late move is amber (was --late)', /class="note sg warn">'\+bpEsc\(_mv\.replace/.test(html));

/* 5. Pack confirm: red when refused, amber for a big entry, plain otherwise (as before) */
ok('Pack confirm note colour follows bad / big', html.indexOf(`<div class="note'+(bad?' sg bad':(c.big?' sg warn':''))+'" style="margin-top:8px"><b>'+packFmt(pk)+' packs</b>`) > 0);

/* 5b. Independent review, 27 Nov: the 2 notes that set only a text colour carry their colour class too */
ok('ERP SO # warnings are amber', /'<div class="note sg warn" style="margin-top:4px">'\+x\+'<\/div>'/.test(html));
ok('packing run no longer in the records is red', /class="note sg bad" style="margin-top:8px;color:var\(--red\)">The packing run is no longer in the records\./.test(html));
eq('no plain note sets its own text colour', (html.match(/class="note" style="[^"]*color:/g) || []).length, 0);

/* 6. Counts: 26 amber and 13 red, each including the 1 phase C note of that colour; the Pack confirm note is counted in 5 */
eq('amber notes', (html.match(/class="note sg warn"/g) || []).length, 26);
eq('red notes', (html.match(/class="note sg bad"/g) || []).length, 13);

/* 7. Build and changelog */
ok('BUILD_ID 2026-11-27d or later', /var BUILD_ID='2026-(11-(27[d-z]|2[89][a-z]|30[a-z])|12-\d\d[a-z])';/.test(html));
ok('changelog has 2026-11-27d', /ver:'2026-11-27d'/.test(html));
ok('system documentation carries D-384', /"id":"D-384"/.test(html));

report('notes1127d');
