/* BUILD 2026-10-29a. Today: a job waiting 1 to 6 days (class "tdcard warn") took the look of the unrelated red warning box
   (.warn: pink, red border, laid out side by side), so it looked more urgent than a late one. The card's own warn rule now
   sets every property .warn sets, so the box can never leak into the card again (found on the trial, 29 Oct 2026).
   Run: node tdcardwarn.test.js */
const H = require('./harness.js');
const { ok, report, html } = H;
const decls = sel => { const re = new RegExp('(^|\\n)' + sel.replace(/\./g, '\\.') + '\\{([^}]*)\\}', 'g'); const out = []; let m; while ((m = re.exec(html))) out.push(m[2]); return out; };
const props = body => body.split(';').map(x => x.split(':')[0].trim()).filter(Boolean);
const box = decls('.warn'), card = decls('.tdcard.warn');
ok('the warning box rule is there (the one that leaked)', box.length >= 1);
const last = card[card.length - 1] || '';
const cardProps = props(last);
const boxProps = [...new Set(box.flatMap(props))];
const missing = boxProps.filter(p => !cardProps.some(c => c === p || (p.startsWith('border') && c === 'border')));
ok('the card\'s warn rule sets every property the warning box sets (' + boxProps.join(', ') + ')', missing.length === 0, 'missing: ' + missing.join(', '));
ok('the card keeps a plain background and the card border', /background:var\(--surface\)/.test(last) && /border:1px solid var\(--qline\)/.test(last));
ok('the 1-to-6-days edge is the amber one, the late edge stays red', /border-left:5px solid var\(--late\)/.test(last) && /\.tdcard\.late\{border-left-color:var\(--over\)/.test(html));
ok('the card is laid out as a card, not side by side', /display:block/.test(last));
ok('the ages are as before: 7 days or more late, 1 to 6 warn', /g\.days>=7\?' late':\(g\.days>0\?' warn'/.test(html));
report('29a: a 1-to-6-day job looks like a card');
