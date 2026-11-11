# Handoff: C2M landing page is slow on the first open (for Ahmer)

Written 11 Nov 2026 at Tahir's request. Read this before you touch the speed of /c2m.

## The problem in 1 line
The first open of C2M after a quiet half minute takes about 5 to 8 seconds. A repeat open takes about 0.4 seconds.

## What is already done (3 pushes, all live)
1. Push 8, commit 97ac5f7 (KAM price list access): the answer of GET /api/c2m/state is kept 30 seconds for the same person and role (`stateCache`, `STATE_TTL`, `writeVer` in c2m-routes.js). Any save in C2M drops it at once. A KAM's build skips products and recipes. The page no longer waits on Google Fonts. Repeat opens went from 3.8 to 7.8 seconds to about 0.4 seconds.
2. Commit 1676f84 (check): GET /api/c2m/state now sends a Server-Timing header that splits the build into steps: sweep, build, load_all, admins, apply_due, products, recipes_out, signoffs_notices, sales, margin_misc, tail, json. The marks are the `T('...')` lines inside `build()`.
3. Commit 795a59c (speed change): the reads that need nothing from the others (sign-offs, read notices, people, KAM grants, trucks, region column check, next document number, notices) start together with `loadAll` through `earlyQ` and `earlySoft` at the top of `build()`. Checked on 6 roles against a fake database: same answer, same number of reads.

## What was measured on the live site (as Tahir, COO, cold open)
| Step | Reading 1 | Reading 2 | Reading 3 | Reading 4 |
|---|---|---|---|---|
| load_all | 2,199 | 1,549 | 2,534 | 1,916 |
| signoffs_notices | 1,497 | 1,535 | 136 | 77 |
| sales | 541 | 541 | 1,108 | 848 |
| margin_misc | 1,587 | 785 | 1,322 | 472 |
| tail | 839 | 699 | 762 | 843 |
| admins, apply_due (1 read each) | about 155 | about 155 | about 155 | about 155 |
| build total | 7,245 | 5,598 | 6,373 | 4,649 |

Readings 1 and 2 are before push 795a59c. Readings 3 and 4 are after it. All values are in ms. The database speed changes from minute to minute, so compare patterns, not single numbers.

## The cause (what the numbers say)
- A step with 1 read takes about 155 ms. That is the round trip from Render to the external MySQL, not the query.
- C2M reads go through `pdq`, which is the platform pool in server.js (line 94, `connectionLimit: 5`). A cold open sends about 80 reads (about 27 in `engine.loadAll`, about 25 prefetched with `pq` in `build()`, the rest in the early reads and later steps). With 5 connections they go in rounds of 5, so the whole cold build is about (number of reads / 5) x 150 ms plus the reads that still run one after another.
- Moving the reads earlier (push 795a59c) cut `signoffs_notices` from about 1,500 ms to about 100 ms, but the time moved into `load_all` and `sales`. The pool is the limit, not the order.

## What is left to do (in the order I would do it)
1. **Share `loadAll` between people.** `engine.loadAll(q)` (c2m-engine.js line 65) returns the same data for every person: customers, products, packs, rules, rates, packing, recipes, settings. Keep 1 copy for 30 seconds, dropped by the same `writeVer` rule as `stateCache`. Then only the first person in each half minute pays the 1.5 to 2.5 seconds. Care: `loadAll` returns objects that `build()` may change. Check that nothing mutates `D` (search for assignments such as `D.something =` and `.push(` on D parts), or copy what is mutated. Also check that `applyDueRevisions()` and `nutBackfill()` (they write) run before the copy is taken.
2. **Raise the pool.** server.js line 94, `connectionLimit: 5` to 10. First find the MySQL `max_connections` of the host and what else uses it (O2S, PD, the second C2M pool at line 114 with `connectionLimit: 3`). If the host allows few connections, this can make other modules fail with "too many connections". Do not raise it without that number.
3. **Keep the answer warm.** A background refresh of the state for the COO and CFO every 25 seconds while someone is signed in, so nobody meets a cold open. It adds steady database load.
4. **Reads still one after another** in `build()`: `listMaster()` and `masterOn()`, `wlListData` (2 calls), `monthEndState`, `pendReady` and `applyDue`, the cost pending read, the closed at carry-over read, `savedOf(user)`. Start the ones that do not depend on `applyDueRevisions()` early, the same way as `earlyQ`.
5. **The sales read** (trucks joined to PO lines, no limit) is 0.5 to 1.1 seconds. If the tables grow, add a date limit that the margin screen can live with, or an index on `c2m_o2s_truck.line_id`. Ask Tahir before limiting, because it changes what the screen shows.

## How to measure (do this before and after every change)
1. Sign in to https://van-control-tower.onrender.com/c2m as Tahir or Yawar.
2. Wait 31 seconds without opening or saving anything (the cache lasts 30 seconds).
3. In the browser console, run a fetch to /api/c2m/state with the header `Authorization: Bearer ` plus localStorage `van_token`, and read the `server-timing` response header. The first call is cold and the second call, straight after, is the cache.
4. Compare the `build` figure and the step figures. Take at least 3 readings, because the database speed changes.

## Rules that apply (from Tahir)
- Do not change what any screen shows or does. Speed only.
- Tahir pushes to Render himself. Test before he pushes. The test harness idea that worked: mount c2m-routes.js on a small express app with a fake `pdq` that returns empty rows, run GET /api/c2m/state for each role (coo, cfo, viewer, qc, production, plant), and compare the answer and the number of reads before and after your change.
- Update docs/08-release-notes.md with every change.

## Files
- apps/c2m/c2m-routes.js: `stateCache`, the early reads and `build()`, the GET /api/c2m/state route
- apps/c2m/c2m-engine.js: `loadAll`
- server.js: the pools (lines 94, 109 and 114)
