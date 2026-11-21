/* C2M tests: the page for the jsdom page tests (push 10k, audit C-27).
 * Since push 10h the page is a shell (c2m.html) with its styles (c2m.css) and script (c2m.js) in their own files. jsdom does not
 * fetch them, so this puts them back inside the shell, as the page was before push 10h, in a file in the system's temp folder.
 * jsdom is not one of the app's packages (package.json is the platform's): without it the page tests say "skipped". */
const fs = require('fs'), path = require('path'), os = require('os');
let JSDOM = null;
try { ({ JSDOM } = require('jsdom')); } catch (e) {
  if (!(e && e.code === 'MODULE_NOT_FOUND' && /'jsdom'/.test(e.message))) { console.log('jsdom is installed but did not load: ' + (e && e.message) + ' (README.md: the version these checks passed with)'); process.exit(1); }
  console.log(path.basename(require.main ? require.main.filename : 'page test') + ': skipped, jsdom is not installed (npm install --no-save jsdom)');
  process.exit(0);
}
const D = path.join(__dirname, '..');
const shell = fs.readFileSync(path.join(D, 'c2m.html'), 'utf8'), css = fs.readFileSync(path.join(D, 'c2m.css'), 'utf8'), js = fs.readFileSync(path.join(D, 'c2m.js'), 'utf8');
const L = /<link rel="stylesheet" href="\/c2m\/c2m\.css">(<!--.*?-->)?/, S = '<script src="/c2m/c2m.js"></script>';
if (!L.test(shell) || !shell.includes(S)) { console.error('c2m.html: the shell no longer names /c2m/c2m.css and /c2m/c2m.js'); process.exit(1); }
const html = path.join(os.tmpdir(), 'c2m-test-page-' + process.pid + '.html');
fs.writeFileSync(html, shell.replace(L, () => '<style>\n' + css + '</style>').replace(S, () => '<script>\n' + js + '</script>'));
process.on('exit', () => { try { fs.unlinkSync(html); } catch (_) {} });
module.exports = { JSDOM, html, fixture: path.join(__dirname, 'fixture-state.js') };
