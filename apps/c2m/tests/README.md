# apps/c2m/tests: how the C2M checks are run

Added in push 10k (21 Nov 2026, audit C-27, D-182). Until then the checks lived only in Claude's session folder and could
not be run again by anyone else. Every C2M push from now on adds its checks here.

## Run them

Open a command window in the repo folder first, the one GitHub Desktop opens (on Tahir's PC on 21 Nov 2026:
`cd /d "E:\VAN Systems"`); express and mysql2 are already there.

**Page checks** (no database). They need jsdom, which is not one of the app's packages (package.json is the platform's).
Once, in the repo folder: `npm install --no-save jsdom@31.0.1` (the version these checks passed with; it needs Node
22.22.2 or later). Then:
```
node apps/c2m/tests/run.js
```
Without jsdom the page checks say "skipped", and run.js ends "Nothing ran" when nothing could run.

**Page and route checks.** The route checks **empty the test database and build it again** from C2M's migrations (the
local files, never the .PRODUCTION ones), so it must be a throwaway database on this computer: its name must end in
`_test`, C2M_TEST_DB=throwaway confirms it, and a host other than localhost is refused. Make it once in phpMyAdmin:
`CREATE DATABASE c2m_test;`. Never point it at van_platform or at production.

Command Prompt (no space after a value):
```
set C2M_TEST_DB=throwaway
set C2M_TEST_DATABASE_URL=mysql://root:@127.0.0.1:3306/c2m_test
node apps/c2m/tests/run.js
```
PowerShell:
```
$env:C2M_TEST_DB='throwaway'; $env:C2M_TEST_DATABASE_URL='mysql://root:@127.0.0.1:3306/c2m_test'; node apps/c2m/tests/run.js
```

Each file can also run alone, for example `node apps/c2m/tests/page-10g.test.js`. Each prints
`<name>: <n> pass, <m> fail`; run.js adds them up, shows why a file gave no result, and ends with exit code 1 if any
check failed.

## What they check (26 Nov 2026: 788 checks)

| File | Checks | What |
|---|---|---|
| page-10a.test.js | 18 | Approvals jobs and the go-live review (push 10a) |
| page-10b.test.js | 26 | Page heads: the answer line, Help, the Approvals badge (push 10b) |
| page-10c.test.js | 34 | Products and Costs screens: rows, names, filters (push 10c) |
| page-10d.test.js | 42 | Price lists: issued cards, never issued lists, Make a list (push 10d) |
| page-10e.test.js | 35 | The audit Minors: rounding, blank settings, FED, toasts and more (push 10e) |
| page-10f.test.js | 25 | Focus, open folds and scroll kept after each press; lists worked out once per draw (push 10f) |
| page-10g.test.js | 27 | The page reads its data again when shown, every 2 minutes and on a new day, never while someone is busy (push 10g) |
| page-prod.test.js | 24 | 1 Products place: the switch All, VAN Brands, White label; Clients, VAN Brands with price lists only; Find anything, Back and the address (D-190) |
| page-appr.test.js | 21 | Approvals for the administrator: 4 figures, 3 tabs, Find through all tabs, chart and news on the narrow side, the phone order (D-191) |
| page-192.test.js | 32 | Costs cards: a link per blocker that opens the part on it, Open on each card, Month end progress; the Guide's own jobs as cards (D-192) |
| page-193.test.js | 25 | The new price row: new GP, points, below target: reason needed, the same rows as the send bar; Names to settle with nothing waiting in Setup (D-193) |
| page-194.test.js | 24 | The ••• menu: main button and menu, 1 filled button, Delete in the menu, 1 open at a time, Escape and a click outside, never reopened by a redraw, the Guide's words (D-194) |
| page-196.test.js | 45 | D-196, the VAN look: tokens and fonts, 5 type sizes, 2 heights, table rows, no inner scroll, the top bar, Clients' switch under the title, the facts line in the page head, Today without repeats, Packing cost •••, Inputs values alone |
| page-195.test.js | 23 | B7 Find above 12 rows; B10 newly red only, seen list kept and pruned; B11 due on the 5th, overdue; B12 List prices; B14 Remind (D-195) |
| routes-195.test.js | 14 | The 2 routes of D-195: Remind (COO only, the step's role, once a day, change record) and red clients seen (COO only, bounded, not in the change record) |
| routes-p4.test.js | 58 | Phase 4: a recipe from draft to approved cost (QC nutrient and packing bill blockers, the cost rollup, every step in the change record), a price, a target and a setting through the COO; a rate change to a re-approval item and the new approved cost; an unmatched O2S name settled and its trucks costed |
| page-bar.test.js | 21 | The top bar of 24 Nov: 7 places, the gear and the Guide beside the name, what folds under More, the phone bar, the Guide's wording (D-189) |
| page-ds.test.js | 26 | The design system of 24 Nov: Inter, the 1 colour set, round tags, the buttons, the card shadow, and nothing left of the 4 looks (D-188) |
| page-185.test.js | 21 | Audit fixes of 24 Nov: price for target in 1 place, the 0.05 point allowance everywhere, Take back and Drop it on list revisions (D-186); the certificate's Correct buttons, client-packed packs on a bill (D-187) |
| page-184.test.js | 25 | Remove a recipe: where it shows per role, its box, the 4 reasons, 1 press (D-184, 23 Nov 2026) |
| page-10l.test.js | 22 | A redraw writes only what changed; typed text, changes by code and armed buttons still get a full redraw; folds and sorted tables stay (push 10l) |
| page-idle.test.js | 18 | On every screen, nothing counts as "in progress" after a draw, so the refresh can run |
| page-render.test.js | 3 | Approvals, Costs and the go-live review panel draw |
| routes-185.test.js | 47 | Audit fixes of 24 Nov: take back and drop for prices and list revisions, send back with its record, blank settings, GP target limit, rounding, Edit this product and an out-of-use bill (D-186); a bill on a client-packed pack, correcting a certificate after a reopen, the window close closing re-approval items (D-187) |
| routes-184.test.js | 44 | Remove a recipe: who may delete or close each state, the 4 checks, the notice, the change record (D-184) |
| routes-10a.test.js | 21 | Price list downloads for viewers and the COO, notices (push 10a) |
| routes-10e.test.js | 22 | Price list numbers from the counter, the FED setting, holidays (push 10e) |
| routes-304.test.js | 9 | The state answer's ETag, X-C2M-Built and 304 when nothing is new (push 10l) |
| routes-shell.test.js | 20 | The page shell, its hashed CSS and JS, cache rules, "could not load" (push 10h) |
| routes-gate.test.js | 4 | Plain reads leave 1 database connection free for a save (push 10i) |
| routes-cache.test.js | 9 | Kept read answers: kept, read fresh, forgotten after a C2M save (push 10j) |
| routes-race.test.js | 1 | A save outside a transaction is never hidden by a read sent at the same moment (push 10j) |

The page checks use fixture-state.js: an invented state answer (60 products, 240 packs, 20,000 sales lines). Customer
names are real; every number in it is invented. _page.js puts c2m.css and c2m.js back inside the c2m.html shell for jsdom.
_db.js builds the test database; it holds only the 3 platform tables C2M reads, in their smallest form, and 5 test
people, 4 of them with a C2M role. A migration that names a database (USE, van_platform., jodilkah_...) is refused.

Not tied to today's date: the reviewer ran them under a faked clock up to 29 Feb 2028 (routes-10e, after its fix, on
21 Nov 2026, 1 Jan 2027 at 03:00 and 1 Jun 2027), and with Windows line endings (routes-10a after its fix).
