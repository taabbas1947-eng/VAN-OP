'use strict';
/* C2M access: the list of things a role can be allowed to do, and the six roles C2M started with.
 * Module C2M, piece 1 (Tahir, 21 Oct 2026, D-89 and D-90). Pure code: no database, so it can be tested alone.
 * Roles live in the table c2m_role (migration 002). This file is the catalogue the Roles screen draws, and the seed
 * the migration loads, and the fallback used until the migration has been run. Docs: docs/11-access-and-roles.md */

/* group, key, label. The keys are what the routes check (can('key')); the labels are what the Roles screen shows. */
const CATALOGUE = [
  { group: 'Prices and lists', items: [
    ['price.propose', 'Propose a price'],
    ['price.approve', 'Approve or send back a proposed price'],
    ['price.withdraw', 'Withdraw a waiting price'],
    ['list.revise', 'Propose a price list revision'],
    ['list.approve', 'Approve or send back a list revision'],
    ['list.withdraw', 'Withdraw a waiting list revision'],
    ['pricedoc.all', 'Create a price list PDF for any list'],
    ['pricedoc.granted', 'Create a price list PDF for the lists given to this person'],
  ] },
  { group: 'Costs and recipes', items: [
    ['recipe.start', 'Start a new recipe version'],
    ['recipe.edit', 'Edit the lines of a draft recipe'],
    ['recipe.step.draft', 'Send a draft recipe for review (Production step)'],
    ['recipe.step.review', 'Review a recipe (QC step)'],
    ['recipe.step.endorse', 'Endorse a recipe (Plant step)'],
    ['recipe.step.cost', 'Approve a recipe cost (CFO step)'],
    ['reapproval.decide', 'Approve or dismiss a cost re-approval'],
    ['rate.save', 'Save a material rate'],
    ['material.save', 'Add or change a material'],
    ['nutrient.edit', 'Edit nutrient percentages and material class'],
    ['packing.manage', 'Packing items and packing bills'],
    ['labour.manage', 'Labour and overhead rates'],
    ['product.classify', 'Set a product type or mark a product reprocessed'],
  ] },
  { group: 'Setup', items: [
    ['settings.edit', 'Propose a change to settings'],
    ['settings.approve', 'Approve or refuse a settings change'],
    ['targets.propose', 'Propose a margin target'],
    ['targets.approve', 'Approve or refuse a margin target'],
    ['customer.edit', 'Change customer details'],
    ['client.add', 'Add a client, a client product and its packs'],
    ['variant.add', 'Add a variant of a VAN product, or tag a product\'s variant'],
    ['freight.edit', 'Change freight'],
    ['grants.give', 'Give price lists and clients to a person'],
    ['lists.link', 'Link or rename a list row'],
    ['lists.mark', 'Mark a list row as not a C2M pack'],
    ['lists.carry', 'Carry the lists into the master'],
    ['lists.remove', 'Take a pack off a list'],
    ['o2s.sync', 'Pull sales from O2S'],
    ['import.decide', 'Accept or correct an import'],
    ['actuals.enter', 'Enter monthly actual labour and overhead'],
    ['actuals.tiebooks', 'Do the monthly tie to the books'],
    ['actuals.ratecheck', 'Do the monthly rate check (a second person)'],
    ['notices.see', 'See and clear notices'],
  ] },
  { group: 'What this role sees', items: [
    ['see.products', 'Recipes (and the Products list, with Approvals and Margin, if the line below it is ticked)'],
    ['see.cost', 'Costs'],
    ['see.price', 'Prices and margin'],
    ['see.margin', 'The Approvals, Products, Prices, Margin and Setup places, with sales and margin'],
    ['see.settings', 'Settings and targets'],
    ['see.materials', 'Materials and nutrients'],
    ['see.granted_lists', 'The price lists given to this person'],
    ['guide.all', 'The whole Guide (otherwise a short Guide)'],
  ] },
  { group: 'Administration', items: [
    ['roles.manage', 'Create and edit roles'],
  ] },
];
const ALL_KEYS = CATALOGUE.flatMap(g => g.items.map(i => i[0]));
const LABEL = Object.fromEntries(CATALOGUE.flatMap(g => g.items));

const CFO = ['price.propose', 'list.revise', 'pricedoc.all', 'recipe.start', 'recipe.step.cost', 'reapproval.decide', 'rate.save', 'material.save', 'nutrient.edit',
  'packing.manage', 'labour.manage', 'product.classify', 'settings.edit', 'targets.propose', 'customer.edit', 'client.add', 'variant.add', 'freight.edit', 'grants.give', 'lists.link', 'lists.mark',
  'lists.carry', 'lists.remove', 'o2s.sync', 'import.decide', 'actuals.enter', 'actuals.tiebooks', 'notices.see',
  'see.products', 'see.cost', 'see.price', 'see.margin', 'see.settings', 'see.materials', 'guide.all'];

/* The six roles C2M began with (docs/11). coo is the administrator (D-89): every action, locked on. */
const SEED = {
  cfo: { label: 'CFO', admin: false, actions: CFO },
  coo: { label: 'COO', admin: true, actions: ALL_KEYS },
  production: { label: 'Production Manager', admin: false, actions: ['recipe.start', 'variant.add', 'recipe.edit', 'recipe.step.draft', 'see.products', 'see.cost'] },
  qc: { label: 'QC Head', admin: false, actions: ['nutrient.edit', 'recipe.step.review', 'see.products', 'see.materials'] },
  plant: { label: 'Plant Manager', admin: false, actions: ['recipe.step.endorse', 'see.products', 'see.cost'] },
  viewer: { label: 'Price list viewer', admin: false, actions: ['pricedoc.granted', 'see.granted_lists'] },
};
const BUILTIN = Object.keys(SEED);

/* The screens a role gets follow from what it may do, so a new role needs no screen list typed by hand.
 * For the six seeded roles this gives exactly the places they had before (tested). */
function navFor(actions) {
  const a = new Set(actions), has = k => a.has(k);
  if (has('see.margin')) return { nav: ['approvals', 'products', 'prices', 'margin', 'setup'], more: ['reports', 'inputs', 'backoffice', 'guide'] };
  if (!has('see.products') && has('see.granted_lists')) return { nav: ['lists', 'guide'], more: [] };
  const nav = ['today', 'recipes']; if (has('see.materials')) nav.push('inputs'); nav.push('guide');
  return { nav, more: [] };
}

function slug(label) { let k = String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30).replace(/-+$/g, ''); if (k && (k in Object.prototype || k === '__proto__')) k = (k + '-role').slice(0, 30); return k; }

/* A role row as the routes use it. */
function shape(key, row) {
  const actions = row.admin ? ALL_KEYS.slice() : row.actions.filter(k => LABEL[k]);
  const n = navFor(actions);
  return { key, label: row.label, admin: !!row.admin, actions, can: new Set(actions), nav: row.nav || n.nav, more: row.more || n.more, builtin: BUILTIN.includes(key) };
}

module.exports = { CATALOGUE, ALL_KEYS, LABEL, SEED, BUILTIN, navFor, slug, shape };
