/* BUILD_ID and the changelog must move together.
 *
 * 22 Sept 2026. O2S has two ways of telling people a deploy happened, and they
 * depend on different things:
 *
 *   The banner  — an open tab polls /o2s on the sync heartbeat (throttled to
 *                 once per 10 minutes), reads BUILD_ID out of the first few KB
 *                 of the served file, and raises "A newer version of O2S is
 *                 available · Refresh now" when it differs from the BUILD_ID it
 *                 loaded with. If BUILD_ID is not bumped, the two match, the
 *                 banner never fires, and a tab left open across a push keeps
 *                 running yesterday's rules with nothing telling anybody.
 *
 *   The notice  — "What's changed since you last logged in", driven by
 *                 CHANGELOG, shown after a logged-in render.
 *
 * A whole day's work shipped with BUILD_ID still reading 2026-09-04a. Every
 * behavioural change that day was pinned by a test; the one line that decides
 * whether anyone FINDS OUT was pinned by nothing. It is now.
 */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grabTopVar, html } = H;

/* BUILD_ID lives in its own one-line inline block near the top of the file */
const m = /BUILD_ID\s*=\s*'([^']+)'/.exec(html);
ok('BUILD_ID is declared', !!m, m && m[1]);
const buildId = m && m[1];

const box = { console };
box.globalThis = box;
vm.createContext(box);
vm.runInContext(grabTopVar('CHANGELOG', '['), box);
const log = box.CHANGELOG;

ok('CHANGELOG is a non-empty array', Array.isArray(log) && log.length > 0, log && log.length);
const latest = log[log.length - 1];

eq('BUILD_ID matches the newest CHANGELOG entry', buildId, latest.ver);

/* the newest entry must be the newest by date too — appending out of order
   would make "what changed since you last logged in" show the wrong thing */
const dates = log.map(c => String(c.date || ''));
const sorted = dates.slice().sort();
ok('CHANGELOG entries are in date order', JSON.stringify(dates) === JSON.stringify(sorted),
   dates.join(' , '));

ok('every entry has a version, a date, a title and at least one item',
   log.every(c => c.ver && c.date && c.title && Array.isArray(c.items) && c.items.length));
ok('no two entries share a version',
   new Set(log.map(c => c.ver)).size === log.length);

/* the banner has to have something to show and a way to act on it */
ok('the stale-tab banner exists in the markup', /id="buildBanner"/.test(html));
ok('it offers a refresh', /onclick="location\.reload\(\)"/.test(html));
ok('it can be put off rather than forced', /dismissBuildBanner\(\)/.test(html));
ok('the build check runs on the sync heartbeat', /checkForNewBuild\(\);/.test(html));
ok('it compares the served BUILD_ID against the loaded one',
   /m\[1\]\s*!==\s*BUILD_ID/.test(html));
ok('and it is fetched uncached, or it would compare a stale copy to itself',
   /fetch\('\/o2s',\{cache:'no-store'\}\)/.test(html));

report('BUILD_ID and the changelog');
