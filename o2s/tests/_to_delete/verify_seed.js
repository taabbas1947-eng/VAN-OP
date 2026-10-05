const H = require('./harness.js');
const fs = require('fs');
const vm = require('vm');
const STATE = JSON.parse(fs.readFileSync(H.STATE, 'utf8')).data;

const src = [H.grabTopVar('RIGHTS','['), H.grab('rightByCode'), H.grab('seedAnswer'),
             H.grab('seedDeptRightsV1'), H.grab('accessLevelOn'), H.grab('accessLevel'),
             H.grab('_canEditOn'), H.grabTopVar('DEPTS','['), H.grabTopVar('ROLE_DEPT','{'),
             H.grab('roleByName'), H.grab('roleIdOf'), H.grab('roleRightsOf'), H.grab('mayLegacyRole'), H.grab('mayRole'),
             H.grab('may'), H.grab('hardRole'), H.grab('whoMayRight'), H.grab('rolesOfState'),
             H.grab('mayHere'), H.grab('rightAnswerToday')].join('\n\n');

const box = { console, state: { role:'COO', screen:'admin', masters: JSON.parse(JSON.stringify(STATE.masters)) } };
box.globalThis = box;
vm.createContext(box);
vm.runInContext(src, box);

// simulate: strip roleRights cells for the 11 production codes (as if never seeded), then flip RIGHTS_LIVE, then reseed
const PROD_CODES = ['batch.open','production.enter','shift.log','packing.pack','packing.reconcile',
                     'byproduct.call','packing.divert','packing.rework','batch.close','batch.close_bulk','production.void'];
Object.keys(box.state.masters.roleRights||{}).forEach(rid => {
  PROD_CODES.forEach(c => delete box.state.masters.roleRights[rid][c]);
});
box.RIGHTS_LIVE = {}; // start unconverted
PROD_CODES.forEach(c => box.RIGHTS_LIVE[c] = true); // flip live, as my code change would

box.seedDeptRightsV1(box.state);

const ALL = (STATE.masters.roles||[]).map(r=>r.name).concat(['COO']);
PROD_CODES.forEach(code => {
  const can = ALL.filter(r => box.mayRole(r, code));
  console.log(code, '->', can.join(', '));
});
