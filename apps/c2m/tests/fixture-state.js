(() => {
  const prods = [], sales = [], open = [], customers = [];
  const custs = ['BKK', 'LCI', 'UDPL', 'FMC Pakistan', 'Syngenta Pakistan', 'Maxim Agri'];
  custs.forEach((c, i) => customers.push({ id: i + 1, name: c, grp: 'White label', priceRule: 'time', cycle: 'monthly', o2sNames: c }));
  let pid = 1;
  for (let i = 0; i < 60; i++) { const packs = []; for (let j = 0; j < 4; j++) { const id = 1000 + pid++; packs.push({ id, size: [1, 5, 20, 25][j], cost: { total: 100 + i, materials: 80, packing: 10, conversion: 10, freight: 0 }, approvedCost: 100 + i, costGaps: [], price: 120 + i, priceFrom: '2026-10-01' }); }
    prods.push({ id: i + 1, brand: 'Brand ' + i, customer: custs[i % 6], customerId: (i % 6) + 1, grp: 'White label', channel: 'White label', soldPer: 'kg', packs, target: 25, recipeState: 'approved', approvedVersionId: i + 1, active: true, budgetKg: 12000 }); }
  const P = prods.flatMap(p => p.packs.map(k => [p, k]));
  for (let n = 0; n < 20000; n++) { const [p, k] = P[n % P.length]; const d = new Date(Date.UTC(2026, 6, 1) + (n % 140) * 864e5).toISOString().slice(0, 10); sales.push({ date: d, cust: p.customer, grp: 'White label', cat: 'wl', brand: p.brand, packId: k.id, kg: 25, price: k.price, cost: k.cost.total, target: 25 }); }
  for (let n = 0; n < 500; n++) { const [p, k] = P[n % P.length]; open.push({ packId: k.id, kg: 50, price: k.price, cust: p.customer, target: 25 }); }
  window.__STF = { today: '2026-11-20', me: { role: 'coo', admin: true, label: 'COO', actions: ['see.cost', 'see.margin', 'see.products', 'see.price', 'price.approve', 'pricedoc.all', 'grants.give', 'see.settings', 'settings.edit', 'reapproval.decide'], nav: ['approvals', 'clients', 'margin', 'costs', 'pricelists'], more: ['setup'], user: 'tahir', name: 'Tahir' },
    settings: [{ k: 'reapprove_pct', v: '5' }, { k: 'budget_gp', v: '23.2' }, { k: 'forward_months', v: '3' }, { k: 'red_gap_pts', v: '2' }], golive: { on: true, until: '2026-11-30' }, fedPct: 5,
    products: prods, customers, recipes: [], pending: [], reapprovals: [], proposals: [], listRevisions: [], settingRequests: [], targetRequests: [], checks: [], actuals: [], imports: [], notices: [], sales, open, listItems: [], rates: [], materials: [], packingItems: [], packingBills: [], rules: [], freight: [], people: [], grants: [], wlLists: {}, holidays: [], holidaysReady: true, priceHistory: [] };
})();
