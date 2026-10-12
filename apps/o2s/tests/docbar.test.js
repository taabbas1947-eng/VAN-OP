/* 12 Oct 2026 — a way back from every printable document.
   The team on phones: a DC, gate pass, COA or inspection report opens as a bare
   page in its own window and there was no way back, so the app had to be closed
   and opened again. Every printable now carries a Back / Print bar.
   The bar must never change the paper: it is hidden when printed, it is put in
   only after the opening body tag, and a page with no body tag is left alone.
   Run: node docbar.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;

/* ---- 1. every place that opens a printable goes through the bar ---- */
const SITES = ['printCOA', 'printDoc', 'printDC', 'printGatePass', 'printPSI', 'smpPrint'];
SITES.forEach(n => {
  const src = grab(n);
  ok(n + ' writes its page through _docWithBar', /document\.write\(_docWithBar\(/.test(src));
  ok(n + ' no longer writes the bare page', !/document\.write\(html\)/.test(src) && !/document\.write\('<html>/.test(src));
});
const opens = (html.match(/window\.open\(''\s*,\s*'_blank'\)/g) || []).length;
const wrapped = (html.match(/document\.write\(_docWithBar\(/g) || []).length;
eq('every window.open page in the file is written through the bar (no new one slips past)', wrapped, opens);

/* ---- 2. the wrapper ---- */
const sb = { console, location: { origin: 'https://van-control-tower.onrender.com', pathname: '/o2s' } };
vm.createContext(sb);
vm.runInContext(grab('_docBarHtml') + '\n' + grab('_docWithBar'), sb);
const wrap = sb._docWithBar;
const BAR = sb._docBarHtml();
const PRINT_BODY = '<body onload="setTimeout(function(){try{window.print();}catch(e){}},250)">';
const doc1 = '<!doctype html><html><head><meta charset="utf-8"><title>DC 5231</title><style>body{margin:0}</style></head>' + PRINT_BODY + '<div class="sheet">DC</div></body></html>';
const out1 = wrap(doc1);
ok('the bar sits straight after the opening body tag', out1.indexOf(PRINT_BODY + BAR) > 0);
eq('taking the bar out gives back exactly the original page', out1.replace(BAR, ''), doc1);
ok('the original onload print is untouched', out1.indexOf(PRINT_BODY) > 0);
const doc2 = '<html dir="rtl"><head><title>GP</title></head><body>x</body></html>';
ok('a plain <body> works', wrap(doc2).indexOf('<body>' + BAR) > 0);
ok('the bar forces left-to-right so the right-to-left Gate Pass does not flip it', /direction:ltr/.test(BAR));
eq('a page with no body tag is returned untouched', wrap('<p>no body</p>'), '<p>no body</p>');
eq('an empty page is returned untouched', wrap(''), '');
eq('a missing page does not throw and comes back as it was', wrap(undefined), undefined);
ok('a body tag whose attribute never closes is left alone', wrap('<body onload="x"') === '<body onload="x"');

/* ---- 3. what it looks like on paper and on a phone ---- */
ok('the bar is hidden when printing', /@media print\{#vanDocBar\{display:none!important\}\}/.test(BAR));
ok('the bar scrolls with the page rather than covering it', /position:sticky;top:0/.test(BAR));
ok('the script cannot end the page early (no literal closing script tag inside the script text)', (BAR.match(/<\/script>/g) || []).length === 1 && BAR.endsWith('</script>'));
ok('both buttons are real buttons that do not submit anything', (BAR.match(/<button type="button"/g) || []).length === 2);
ok('it says Back to O2S and Print / Save PDF', /Back to O2S/.test(BAR) && /Print \/ Save PDF/.test(BAR));
ok('it reads and writes no data and calls no server', !/fetch\(|XMLHttpRequest|localStorage|sessionStorage|\/api\//.test(BAR));

/* ---- 4. the script inside the page, run against a pretend window ---- */
const js = /<script>([\s\S]*)<\/script>/.exec(BAR)[1];
ok('the injected script compiles', (() => { try { new vm.Script(js); return true; } catch (e) { return false; } })());
function page(opts) {
  const style = {}; const bar = { style: { setProperty: (k, v) => { style[k] = v; } } };
  const timers = []; const loc = { href: 'about:blank' };
  const w = { closed: false, innerWidth: opts.inner, close() { if (opts.canClose) w.closed = true; } };
  const ctx = { window: w, screen: { width: opts.screen }, location: loc, document: { getElementById: id => id === 'vanDocBar' ? bar : null },
    setTimeout: (f, ms) => timers.push({ f, ms }), String, Math, console };
  ctx.window.window = w; Object.defineProperty(ctx, 'closed', { get: () => w.closed });
  vm.createContext(ctx);
  /* inside the page `window.closed` is read as a property of window */
  vm.runInContext(js, ctx);
  return { ctx, style, timers, loc, w };
}
let p = page({ inner: 980, screen: 390, canClose: true });
ok('on a phone the bar is scaled up to match how far the page is zoomed out (about 2.5)', Math.abs(parseFloat(p.style['--k']) - 980 / 390) < 0.01);
p = page({ inner: 1280, screen: 1920, canClose: true });
ok('on a computer the bar is its normal size', p.style['--k'] === undefined);
p = page({ inner: 3000, screen: 100, canClose: true });
ok('the scale is capped at 3', parseFloat(p.style['--k']) === 3);
p = page({ inner: 0, screen: 0, canClose: true });
ok('unknown screen sizes leave the bar alone', p.style['--k'] === undefined);

/* Back: the window closes -> nothing else happens; it will not close -> go to O2S */
p = page({ inner: 1280, screen: 1920, canClose: true });
vm.runInContext('vanDocBack()', p.ctx);
p.timers.forEach(t => t.f());
eq('Back closes the window when the browser lets it, and does not navigate', p.loc.href, 'about:blank');
p = page({ inner: 980, screen: 390, canClose: false });
vm.runInContext('vanDocBack()', p.ctx);
eq('a phone that will not close the window waits before using the fallback', p.timers.length, 1);
ok('the wait is long enough for a real close to finish first', p.timers[0].ms >= 300);
p.timers.forEach(t => t.f());
eq('...then Back takes the person to O2S itself', p.loc.href, 'https://van-control-tower.onrender.com/o2s');
p = page({ inner: 980, screen: 390, canClose: false });
p.w.close = () => { throw new Error('blocked'); };
ok('a browser that throws on close does not break Back', (() => { try { vm.runInContext('vanDocBack()', p.ctx); p.timers.forEach(t => t.f()); return p.loc.href.indexOf('/o2s') > 0; } catch (e) { return false; } })());

/* ---- 5. the Guide and the build id moved with it ---- */
ok('the Rules tell people about the Back bar', /<h3>Going back from a printed paper<\/h3>/.test(html) && /Back to O2S<\/b> and <b>Print \/ Save PDF/.test(html));
ok('the changelog has the entry', /ver:'2026-10-12a'[^]*?Printed papers have a way back/.test(html));
process.exitCode = report('A way back from every printable (12 Oct)') ? 1 : 0;
