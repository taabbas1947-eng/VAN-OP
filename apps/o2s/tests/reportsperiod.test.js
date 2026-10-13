/* Reports open on All dates (13 Oct 2026, build 2026-10-13c). Run: node reportsperiod.test.js */
const H = require('./harness.js');
const { ok, eq, report, grab, html } = H;
const m = /\nvar RP_CATALOGUE=\[/.exec(html);
const cat = eval('(' + H.matchBlock(m.index + 1, 'RP_CATALOGUE', '[').replace(/^var RP_CATALOGUE=/, '') + ')');
const by = id => cat.filter(c => c.id === id)[0];
['prodshift', 'batches', 'trucks', 'coa', 'lateentries', 'corrections', 'packqa', 'labtat'].forEach(id => eq(id + ' opens on All dates', by(id).period || 'All', 'All'));
ok('no report in the catalogue opens on This month', cat.every(c => c.period !== 'This month'));
eq('Closed short keeps FY to date', by('shortclose').period, 'FY to date');
eq('Invoicing keeps Last month', by('invoicing').period, 'Last month');
ok('a report with no period falls back to All', /rpApplyPeriod\(c\.now\?'All':\(c\.period\|\|'All'\)\)/.test(grab('rpOpen')));
ok('the 4 period buttons are still there', /'This month','Last month','FY to date','All'/.test(grab('rpPeriodChips')));
ok('rows are capped at 500 with a note, so All dates cannot freeze the page', /slice\(0,500\)/.test(grab('rpTableHTML')) && /Showing the first 500 of/.test(grab('rpTableHTML')));
ok('Guide says reports open on All dates', /Reports open on <b>All dates<\/b>/.test(html));
ok('changelog 2026-10-13c exists', /ver:'2026-10-13c'/.test(html));
report();
