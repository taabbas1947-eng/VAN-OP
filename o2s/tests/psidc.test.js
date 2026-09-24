/* 25d — the pre-shipment report with the DC, and the inspection register.
   Run: node psidc.test.js */
const H = require('./harness.js'); const vm = require('vm'); const { ok, eq, report, grab, html } = H;
const sb = { console, qsEsc: x => String(x == null ? '' : x), fmt: n => String(n), state: { customers: [{ name: 'Syngenta', psiWithDC: true }, { name: 'Other' }], orders: [{ po: 'P1', client: 'Syngenta' }, { po: 'P2', client: 'Other' }] } };
vm.createContext(sb); vm.runInContext(['cssScope', 'psiWithDCFor', 'psiRepNo'].map(grab).join('\n'), sb);
eq('scope a plain rule', sb.cssScope('.sheet{a:1}', '.w'), '.w .sheet{a:1}');
eq('html,body become the wrapper', sb.cssScope('html,body{margin:0}', '.w'), '.w,.w{margin:0}');
eq('* stays inside the wrapper', sb.cssScope('*{box-sizing:border-box}', '.w'), '.w,.w *{box-sizing:border-box}');
eq('@media is scoped inside', sb.cssScope('@media print{.a{b:1}thead{c:2}}', '.w'), '@media print{.w .a{b:1}.w thead{c:2}}');
eq('@page kept', sb.cssScope('@media print{@page{size:A4}}', '.w'), '@media print{@page{size:A4}}');
ok('the customer tick is read by the DC', sb.psiWithDCFor({ pos: ['P1'] }) === true && sb.psiWithDCFor({ pos: ['P2'] }) === false);
eq('report number from the DC', sb.psiRepNo({ dc: '121' }), 'PSI-121');
ok('the customer form has the tick and saves it', /Send the pre-shipment report with the DC/.test(grab('custFormHTML')) && /psiWithDC:!!f\.psiWithDC/.test(grab('custSave')));
ok('printPSI can hand its parts to the DC without opening a window', /if\(_parts\) return \{css:css,inner:inner,repNo:repNo/.test(grab('printPSI')));
const dc = grab('printDC');
ok('the DC appends the report for a ticked customer', /psiWithDCFor\(g\)/.test(dc) && /printPSI\(dispId,\{parts:true\}\)/.test(dc) && /cssScope\(_psi\.css,'\.psiw'\)/.test(dc));
ok('...on its own page', /\.psiw\{page-break-before:always/.test(dc));
ok('...and the DC says so', /Pre-shipment inspection report '\+\(_psi\?\('attached: /.test(dc));
ok('the register is in the Report Center, for everyone', /\{id:'psi', t:'Pre-shipment inspections'[^}]*kind:'psireg', roles:'all'\}/.test(html));
ok('the register opens and prints', /c\.kind==='psireg'\) return h\+psiRegisterHTML\(\)/.test(html) && /printPSI\(/.test(grab('psiRegisterHTML')));
ok('no truck is released without a passed inspection (unchanged)', /qa/.test(grab('approveRelease')));
process.exitCode = report('Pre-shipment report with the DC (25d)') ? 1 : 0;
