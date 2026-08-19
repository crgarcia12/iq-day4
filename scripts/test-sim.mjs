// Smoke test for the RLT process model. Run: node scripts/test-sim.mjs
import { simulate, DEFAULTS, PRESETS, STATIONS, ISOTOPES } from '../src/sim.js';

let failed = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  ok   ${name}`);
  else { console.log(`  FAIL ${name} ${detail}`); failed++; }
};

const run = over => simulate({ ...DEFAULTS, ...over });

console.log('\nStructure');
check('8 stations defined', STATIONS.length === 8, `got ${STATIONS.length}`);
check('every station has params', STATIONS.every(s => s.params.length > 0));
check('every station has supplies', STATIONS.every(s => s.supplies.length > 0));
check('every numeric param has a validated band and a note',
  STATIONS.every(s => s.params.every(p => p.type === 'enum' || (p.ok && p.note))));
check('every param key exists in DEFAULTS',
  STATIONS.flatMap(s => s.params.map(p => p.key)).every(k => k in DEFAULTS));

console.log('\nNominal operation');
const nom = run(PRESETS.nominal);
check('no deviations at nominal setpoints', Object.keys(nom.issues).length === 0,
  JSON.stringify(Object.keys(nom.issues)));
check('batch is releasable', nom.kpi.rcpFail === false);
check('RCP >= 95 % release spec', nom.kpi.rcp >= 95, nom.kpi.rcp.toFixed(2));
check('labeling yield >= 95 %', nom.kpi.rcy >= 95, nom.kpi.rcy.toFixed(2));
check('OEE in the realistic 35-70 % band', nom.kpi.oee > 35 && nom.kpi.oee < 70, nom.kpi.oee.toFixed(1));
check('doses/day plausible (40-250)', nom.kpi.dosesPerDay > 40 && nom.kpi.dosesPerDay < 250,
  nom.kpi.dosesPerDay.toFixed(0));
check('cell-face dose rate under the ALARA trigger', nom.kpi.doseRate < 7.5, nom.kpi.doseRate.toFixed(2));
check('transport index below yellow-II', nom.kpi.tiPot < 1, nom.kpi.tiPot.toFixed(3));

console.log('\nOptimised setpoints');
const opt = run(PRESETS.optimum);
check('no deviations', Object.keys(opt.issues).length === 0, JSON.stringify(Object.keys(opt.issues)));
check('beats nominal on doses/day', opt.kpi.dosesPerDay > nom.kpi.dosesPerDay);
check('beats nominal on OEE', opt.kpi.oee > nom.kpi.oee);
check('beats nominal on purity', opt.kpi.rcp > nom.kpi.rcp);

console.log('\nStress test');
const str = run(PRESETS.stress);
const strIssues = Object.values(str.issues).flat();
check('raises many deviations', strIssues.length >= 10, `${strIssues.length}`);
check('every deviation carries a reference tag', strIssues.every(i => !!i.ref));
check('every deviation has a severity in (0,1]', strIssues.every(i => i.sev > 0 && i.sev <= 1));
check('batch is rejected', str.kpi.rcpFail === true);
check('no doses released', str.kpi.dosesPerDay === 0);
check('affects at least 5 stations', Object.keys(str.issues).length >= 5,
  Object.keys(str.issues).join(','));

console.log('\nPhysics behaviour');
check('cold reaction destroys yield', run({ reactionTemp: 55 }).kpi.rcy < 50);
check('hot reaction degrades the peptide', run({ reactionTemp: 125 }).kpi.rcp < nom.kpi.rcp);
check('alkaline buffer causes colloid loss', run({ bufferPh: 6.6 }).kpi.rcp < nom.kpi.rcp);
check('no scavenger increases radiolysis',
  run({ radioprotectant: 0 }).kpi.radiolysis > run({ radioprotectant: 40 }).kpi.radiolysis);
check('smaller fill volume concentrates activity and radiolysis',
  run({ fillVolume: 6 }).kpi.radiolysis > run({ fillVolume: 30 }).kpi.radiolysis);
check('thinner shielding raises the cell dose rate',
  run({ shielding: 25 }).kpi.doseRate > run({ shielding: 90 }).kpi.doseRate * 3);
check('faster transfer creates mechanical defects',
  run({ conveyorSpeed: 10 }).kpi.grossErrorRate > nom.kpi.grossErrorRate);
check('lower QC coverage lets more defects escape',
  run({ qcSampleRate: 10, conveyorSpeed: 9 }).kpi.escapedDefects >
  run({ qcSampleRate: 100, conveyorSpeed: 9 }).kpi.escapedDefects);
check('short half-life nuclide loses far more to decay',
  run({ isotope: 'Ga-68' }).kpi.decayLossPct > run({ isotope: 'Lu-177' }).kpi.decayLossPct * 10);
check('longer shipping increases decay loss',
  run({ shipLead: 800 }).kpi.decayLossPct > run({ shipLead: 60 }).kpi.decayLossPct);
check('more precursor lowers molar activity',
  run({ precursor: 50 }).kpi.molarActivity < run({ precursor: 10 }).kpi.molarActivity);

console.log('\nNumerical safety');
const bad = [];
for (const st of STATIONS) {
  for (const p of st.params) {
    const values = p.type === 'enum' ? p.options : [p.min, (p.min + p.max) / 2, p.max];
    for (const v of values) {
      const r = run({ [p.key]: v });
      if (Object.values(r.kpi).some(x => typeof x === 'number' && !isFinite(x))) bad.push(`nan ${p.key}=${v}`);
      if (r.kpi.dosesPerDay < 0 || r.kpi.rcp < 0 || r.kpi.oee < 0 || r.kpi.oee > 100) bad.push(`range ${p.key}=${v}`);
    }
  }
}
check('all parameter extremes produce finite, in-range KPIs', bad.length === 0, bad.join(', '));
check('every isotope has a positive half-life',
  Object.values(ISOTOPES).every(i => i.halfLifeMin > 0 && isFinite(i.halfLifeMin)));

console.log(failed ? `\n${failed} check(s) FAILED\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
