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

## What they check (21 Nov 2026: 305 checks)

| File | Checks | What |
|---|---|---|
| page-10a.test.js | 18 | Approvals jobs and the go-live review (push 10a) |
| page-10b.test.js | 26 | Page heads: the answer line, Help, the Approvals badge (push 10b) |
| page-10c.test.js | 34 | Products and Costs screens: rows, names, filters (push 10c) |
| page-10d.test.js | 42 | Price lists: issued cards, never issued lists, Make a list (push 10d) |
| page-10e.test.js | 35 | The audit Minors: rounding, blank settings, FED, toasts and more (push 10e) |
| page-10f.test.js | 25 | Focus, open folds and scroll kept after each press; lists worked out once per draw (push 10f) |
| page-10g.test.js | 27 | The page reads its data again when shown, every 2 minutes and on a new day, never while someone is busy (push 10g) |
| page-idle.test.js | 18 | On every screen, nothing counts as "in progress" after a draw, so the refresh can run |
| page-render.test.js | 3 | Approvals, Costs and the go-live review panel draw |
| routes-10a.test.js | 21 | Price list downloads for viewers and the COO, notices (push 10a) |
| routes-10e.test.js | 22 | Price list numbers from the counter, the FED setting, holidays (push 10e) |
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
