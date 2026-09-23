/* THE BACK OFFICE MANUAL — R15, the night of 23 September 2026.
   "Make a back office / admin manual very smartly and very clearly, easily:
   product definition (base attached to the brand), customer addition, budget
   allocation, access management." It lives on the Instructions screen, first
   card, and in docs/O2S Back Office Manual.md. Run: node manual.test.js */
const H = require('./harness.js');
const fs = require('fs'); const path = require('path');
const { ok, report, grab, html } = H;
const card = grab('backOfficeManualCard');
ok('the manual card exists', card.length > 2000);
ok('the Instructions screen opens with it', /\$\('view'\)\.innerHTML=`\s*\$\{backOfficeManualCard\(\)\}/.test(html));
['The 3 places', 'brand', 'base', 'who buys it', 'Customers', 'Pending approval', 'Budget', 'Channel budgets', 'Farmer', 'roles only', 'One login per person', 'one reason per order']
  .forEach(k => ok('it covers: ' + k, new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(card)));
ok('it says a brand not in the master cannot be ordered', /cannot be ordered/.test(card));
ok('it spells no number in words', !/\b(one|two|three|four|five|six|seven|eight|nine|ten) (places|roles|login|reason)\b/i.test(card.replace(/one line|one row|one button|one product master|one segment|one role|one reason per order|One login per person|one base/gi, '')));
const md = path.join(__dirname, '..', '..', 'docs', 'O2S Back Office Manual.md');
ok('the full manual is in the repo', fs.existsSync(md) && fs.readFileSync(md, 'utf8').length > 5000);
ok('and names what was found wrong and what was done', fs.existsSync(md) && /What was poorly designed/.test(fs.readFileSync(md, 'utf8')));
process.exitCode = report('The Back Office manual') ? 1 : 0;
