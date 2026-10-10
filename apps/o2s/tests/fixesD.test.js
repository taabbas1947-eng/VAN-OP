/* 7 Oct 2026 (07h) — LIST D: screens, wording, design and consistency. Run: node fixesD.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, report, grab, html } = H;
/* D1 Custom report in the shell */
const rb = grab('rbRender');
ok('D1: the Custom report is the shell: steps, qs buttons, the reports table and sentence', /class="rb2"/.test(rb) && /step\('Data'/.test(rb) && /step\('Period'/.test(rb) && /step\('Columns'/.test(rb) && /step\('Show'/.test(rb) && /rpTableHTML\(res,null\)/.test(rb) && /rpSentence\(null,res\)/.test(rb) && !/rb-top|rb-pal|rb-grid|class="card"/.test(rb));
ok('D1: no paper card around it', /if\(c\.kind==='builder'\) return h\+rbRender\(\)\+'<\/div>';/.test(grab('rpReportHTML')));
ok('D1: own dates show in the sentence', /rbFrom\|\|'start'/.test(grab('rpSentence')));
/* D2 Reference */
const ref = grab('guideReference');
ok('D2: the Reference is built from TD_NEXT, TD_LABEL, SCREENS and canView', /gdChain\(\)/.test(ref) && /TD_LABEL/.test(ref) && /SCREENS\.filter/.test(ref) && /gdScreenOpen\(r,s\.id\)/.test(ref));
ok('D2: no old names in the Reference or the Back Office manual', !/My Actions|PO Tracker|New PO Entry|Data Fix|Sent tab|Master Data|Authorisation/.test(ref + grab('backOfficeManualCard')));
ok('D2: the search reads the live Reference', /tabs\.push\(\['ref','Reference',function\(\)\{ try\{ return guideReference\(\);/.test(grab('guideSearchBlocks')));
ok('D2: QCM approval leads to the Pack job', /'Approve':'Pack',/.test(html));
/* D3 names */
ok('D3: no toast names Data Fix, Users & Access or Master Data', !/toast\('You need Edit access to (Data Fix|Users & Access|Master Data)'\)/.test(html));
ok('D3: FOC samples on Today and in the Guide', /title:'FOC sample to approve'/.test(html) && /return 'FOC samples'/.test(grab('acStageOf')) && !/title:'Free sample/.test(html));
ok('D3: the QA screen is QA inspection', /\{id:'qa', name:'QA inspection'/.test(html) && /<h1>QA inspection<\/h1>/.test(html));
ok('D3: report fields say Kg/L', /l:'Output Kg\/L'/.test(html) && !/l:'(Output|Packed|Planned|Produced|Disposed) kg'/.test(html));
ok('D3: certificates keep Kg', /c\.quantity=fmt\(Math\.round\(\+lot\.qty\|\|0\)\)\+' Kg';/.test(html));
/* D4 colours */
ok('D4: a wait is amber 1-6 days, red from 7, on Today and Your people', /g\.days>=7\?'late':'warn'/.test(html) && /g\.days>=7\?' late':\(g\.days>0\?' warn':''\)/.test(html) && /worst>=7\?'st-over':\(worst>=1\?'st-late':'st-ok'\)/.test(html));
ok('D4: the top bar is one line from 900px', /@media \(min-width:900px\)\{\.qs-nav\{grid-row:1;grid-column:2;justify-content:flex-end;flex-wrap:nowrap\}/.test(html));
ok('D4: the paper screens wear the shell colours (no teal left in them)', /\.paperui\{background:#F9F9F6;border:1px solid #C8CCC3;border-radius:3px/.test(html) && !/\.paperui[^{]*\{[^}]*#0f766e/.test(html) && /body \.pdsk\{--pb:#2E5F86/.test(html));
/* D5 notes, phones */
ok('D5: no builder notes on screen', !/hundreds of times in the code|wired in code\)|Tell Tahir\.|\(ruled 23 Sep\)'|deprecated reconLog|\(legacy path\)/.test(html));
ok('D5: boxes fit a phone', !/min-width:300px"/.test(html) && /style="width:100%;max-width:420px"><option value="">Pick a customer/.test(html));
/* D6 the plant's clock */
{ const sb = { console }; vm.createContext(sb); vm.runInContext(grab('localDateOf') + '\n' + grab('localWhenOf'), sb);
  ok('D6: a stamp after 19:00 UTC is the next day on the plant clock', sb.localDateOf('2026-10-07T20:30:00.000Z') === '2026-10-08' && sb.localWhenOf('2026-10-07T20:30:00.000Z') === '2026-10-08 01:30');
  ok('D6: a bare date stays as it is', sb.localDateOf('2026-10-07') === '2026-10-07' && sb.localWhenOf('2026-10-07') === '2026-10-07');
  ok('D6: a stamp is read in local time (format)', /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(sb.localWhenOf('2026-10-07T20:30:00.000Z'))); }
ok('D6: done today and the reports use local dates', /localDateOf\(e\.t\)===day && e\.by===me/.test(grab('tdDoneCount')) && /when:localWhenOf\(x\.t\),date:localDateOf/.test(html) && /date:localDateOf\(c\.at/.test(html) && /date:localDateOf\(m\.at/.test(html));
/* D7 rounding */
{ const sb = { console }; vm.createContext(sb); vm.runInContext(grab('qcFull'), sb);
  ok('D7: 999.6 of 1000 is fully inspected; 999 is not', sb.qcFull(999.6, { ordered: 1000 }) === true && sb.qcFull(999, { ordered: 1000 }) === false);
  ok('D7: a tiny line needs what passed, within 1%', sb.qcFull(0, { ordered: 0.25 }) === false && sb.qcFull(0.25, { ordered: 0.25 }) === true && sb.qcFull(0.2, { ordered: 0.25 }) === false); }
ok('D7: every qcPass decision uses qcFull, none the old 0.001', !/-0\.001\) l+\.qcPass|-0\.001\) ll\.qcPass|-0\.001\) lA\.qcPass|-0\.001&&!lB\.qcPass/.test(html) && (html.match(/qcFull\(/g) || []).length >= 7);
/* audit fixes */
ok('audit: Adjust names the report it limits to, and the rows can be shown all', /rbWhereName=/.test(grab('rpReportHTML')) && /step\('Limited to'/.test(grab('rbRender')) && /rbWhere=null;render\(\)/.test(grab('rbRender')));
ok('audit: a non-money role on the finance data loses its columns too', /rbDS='production'; rbCols=\[\]; rbFilters=\{\}; rbGroup=\[\]; rbWhere=null;/.test(grab('rbRender')));
ok('audit: the plant clock is fixed PKT', /t\+5\*3600000/.test(grab('localDateOf')) && /t\+5\*3600000/.test(grab('localWhenOf')));
ok('audit: the Reference chain follows the lab flow and skips Close batch', /labFlowOn\(\)/.test(grab('gdChain')) && /'Open Production'\) return lab\?'Assign sample':'Lab QC'/.test(grab('gdChain')));
ok('audit: the Guide marks match the chips', /■ waiting 3 d/.test(grab('guideHow')) && !/● due</.test(grab('guideHow')));
ok('BUILD_ID is 07h or later', /var BUILD_ID='(2026-10-07[h-z]|2026-10-(0[89]|[1-3][0-9])[a-z])'/.test(html));
process.exitCode = report('List D: screens, wording, design (07h)') ? 1 : 0;
