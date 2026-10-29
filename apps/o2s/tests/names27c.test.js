/* BUILD 2026-10-27c. Tahir, 27 Oct 2026: the final recipe of V-Germinator Pro is P 27% + N 4.5% + K 2%.
   The lab template and the CoAs already said N 4.5% and K 2%; the product list said N 1% + K 6%.
   Run: node names27c.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;
const cp = x => JSON.parse(JSON.stringify(x));
const NEWG = 'P 27% + N 4.5% + K 2%';

const sb = { logs: [], applied: 0 };
sb.logAction = m => sb.logs.push(m);
sb.applyCustomProducts = () => { sb.applied++; };
vm.createContext(sb); vm.runInContext(grab('productGenericV1'), sb);
const fix = () => ({ masters: { products: [
  { brand: 'V-Germinator Pro', generic: 'P 27% + N 1% + K 6%', active: true },
  { brand: 'V Germinator Pro', generic: 'Liquid Phosphate 27% + N + K Mg', active: false, aka: 'V-Germinator Pro' },
  { brand: 'Nitro Germinator Pro', generic: 'NPK 8:0:40', active: true },
  { brand: 'Cal-Mag V', generic: 'Ca 6%+Mg 4%+B 1%+N 10%', active: true } ] } });

{ const s = fix(); sb.productGenericV1(s); const g = n => s.masters.products.find(p => p.brand === n).generic;
  eq('V-Germinator Pro now reads the final recipe', g('V-Germinator Pro'), NEWG);
  eq('the retired V Germinator Pro entry agrees', g('V Germinator Pro'), NEWG);
  eq('Nitro Germinator Pro (another product) is untouched', g('Nitro Germinator Pro'), 'NPK 8:0:40');
  eq('Cal-Mag V is untouched', g('Cal-Mag V'), 'Ca 6%+Mg 4%+B 1%+N 10%');
  eq('the flag records 2 changes', s.masters._genericV1.n, 2);
  ok('it was logged and the tables rebuilt', sb.logs.length === 1 && /set to P 27% \+ N 4.5% \+ K 2%/.test(sb.logs[0]) && sb.applied === 1);
  const again = cp(s); sb.logs.length = 0; sb.applied = 0; sb.productGenericV1(again);
  eq('a second run changes nothing', JSON.stringify(again), JSON.stringify(s));
  ok('and logs nothing', sb.logs.length === 0 && sb.applied === 0);
  const t = cp(s); delete t.masters._genericV1; sb.productGenericV1(t); delete t.masters._genericV1; const u = cp(s); delete u.masters._genericV1;
  eq('without the flag the step is still harmless', JSON.stringify(t), JSON.stringify(u)); }
{ /* a text typed by someone since is never replaced */
  const s = fix(); s.masters.products[0].generic = 'P 27% + N 5% + K 2%'; sb.productGenericV1(s);
  eq('a hand-typed text is kept', s.masters.products[0].generic, 'P 27% + N 5% + K 2%');
  eq('the other old text is still updated', s.masters.products[1].generic, NEWG); }
{ /* no product list, no state: no crash and no flag */
  sb.productGenericV1(null); sb.productGenericV1({}); const s = { masters: {} }; sb.productGenericV1(s);
  ok('no product list: no crash, no flag', !s.masters._genericV1); }
{ /* the product is absent: flag set, nothing else */
  const s = { masters: { products: [{ brand: 'Enrich', generic: 'x' }] } }; sb.productGenericV1(s);
  ok('product absent: nothing changed', s.masters.products[0].generic === 'x' && s.masters._genericV1.n === 0); }

ok('it runs in the load chain right after productNamesV1', /productNamesV1\(s\); productGenericV1\(s\); (dataFix27dV1\(s\); )?loadBaseRecipesV2\(s\);/.test(html));
ok('the catalogue in the code no longer carries N 1% + K 6% for V-Germinator Pro', !/"generic": "P 27% \+ N 1% \+ K 6%"/.test(html) && (html.match(/"brand": "V-Germinator Pro", "base": "V-Germinator Pro", "generic": "P 27% \+ N 4\.5% \+ K 2%"/g) || []).length === 4);
ok('build id is 2026-10-27c or later', /BUILD_ID='2026-10-(27[cd]|28[a-z]|29[a-z])'/.test(html));
ok('change log 2026-10-27c exists', /ver:'2026-10-27c'/.test(html) && /V-Germinator Pro: the final recipe/.test(html));
ok('the 27b migration is untouched (it does not set the generic)', !/generic\s*=\s*NEWG/.test(grab('productNamesV1')));
process.exitCode = report('27c: V-Germinator Pro final recipe P 27% + N 4.5% + K 2%') ? 1 : 0;
