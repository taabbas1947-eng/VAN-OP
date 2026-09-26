/* A NEW CUSTOMER IS APPROVED BEFORE ITS FIRST ORDER — R9, the night of 23 Sep 2026.

   Tahir: "Yes — CFO approves; COO can also. Ismaeel adds the customer, the CFO
   confirms it, then an order can be raised. Shows as a job on the CFO's Today."

   A customer saved by anyone but the CFO or COO is born 'Pending approval'.
   While pending it does not appear in New PO Entry's client list. actionItems
   raises 'Approve customer' to the CFO; approveCustomer(code) sets it Active,
   stamps who and when, logs. Customers that existed before tonight are
   untouched: no status means Active, as it always has.

   Run: node customerapproval.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;

ok("custSave makes a new customer 'Pending approval' unless the CFO or COO adds it",
   /status:\(state\.role==='CFO'\|\|state\.role==='COO'\)\?\(f\.status\|\|'Active'\):'Pending approval'/.test(grab('custSave')));
ok('an edited customer keeps its status', /if\(f\.editing\)\{[^\n]*rec\.status=\(state\.customers\[i\]\.status\|\|'Active'\)/.test(grab('custSave')) || /keeps its status/.test(grab('custSave')));
ok("New PO Entry's client list leaves a pending customer out", /st!=='Pending approval'/.test(grab('clientsForChannel')) /* 25m: any status but pending or inactive */);
ok('actionItems raises the pending customers (through pendingCustomerItems)', /pendingCustomerItems\(\)\.forEach/.test(grab('actionItems')));
ok('...and those items are addressed to the CFO with the approval as the action', /role:'CFO'/.test(grab('pendingCustomerItems')) && /openCustSheet\(/.test(grab('pendingCustomerItems')));
ok('Today has plain words for it', /'Approve customer':\s*\{title:/.test(html));
ok('Today addresses it by role, not by a right code (customer.create is not approval)', !/'Approve customer':'customer/.test(html));

/* the approval itself */
{
  const b = { console, logged: [], toasts: [], saved: 0, rendered: 0, TODAY: new Date('2026-09-23T10:00:00'),
    logAction: m => b.logged.push(m), toast: m => b.toasts.push(m), save: () => b.saved++, render: () => b.rendered++,
    state: { role: 'Production', currentUser: { name: 'Yawar Hussain' }, customers: [ { code: 'WL-NEW-26-109', name: 'New Co', status: 'Pending approval' }, { code: 'WL-OLD-26-100', name: 'Old Co' } ] } };
  vm.createContext(b); vm.runInContext(grab('custReturnOpen') + '\n' + grab('approveCustomer'), b);
  b.approveCustomer('WL-NEW-26-109');
  eq('a role that is not CFO or COO is refused', b.state.customers[0].status, 'Pending approval');
  ok('...and told', b.toasts.some(t => /CFO/.test(t)), JSON.stringify(b.toasts));
  b.state.role = 'CFO'; b.approveCustomer('WL-NEW-26-109');
  eq('the CFO approves', b.state.customers[0].status, 'Active');
  eq('...stamped by', b.state.customers[0].approvedBy, 'Yawar Hussain');
  ok('...and dated', !!b.state.customers[0].approvedAt);
  ok('...and logged', b.logged.some(l => /Approved customer WL-NEW-26-109/.test(l)));
  ok('saved and rendered', b.saved === 1 && b.rendered === 1);
  b.approveCustomer('WL-OLD-26-100');
  eq('an already-active customer is left alone', b.state.customers[1].approvedBy, undefined);
}
/* the job on Today */
{
  const b = { console, state: { customers: [ { code: 'A', name: 'A Co', status: 'Pending approval', segment: 'White-label' }, { code: 'B', name: 'B Co' } ] } };
  vm.createContext(b); vm.runInContext(grab('custReturnOpen') + '\n' + grab('pendingCustomerItems'), b);
  const items = b.pendingCustomerItems();
  eq('one job per pending customer', items.length, 1);
  eq('addressed to the CFO', items[0].role, 'CFO');
  eq('with the approval sheet as its action (26a: see before you approve)', items[0].act, "openCustSheet('A')");
  ok('and says who it is', /A Co/.test(items[0].what) && /White-label/.test(items[0].what));
}

process.exitCode = report('Customer approval') ? 1 : 0;
