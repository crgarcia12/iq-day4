// Validates the Persona 2 demo flow end to end.  Run: node scripts/test-line.mjs
import {
  STATIONS, DEFAULTS, DEMAND, HORIZON_DAYS, PM_DURATION_DAYS,
  simulate, planAt, optimalRate, rateCurve, damageFactor, vibration, vibZone, DEGRADATION,
} from '../src/line.js';
import { buildSteps, ONTOLOGY, AGENTS } from '../src/scenario.js';

let failed = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  ok   ${name}${detail ? '  (' + detail + ')' : ''}`);
  else { console.log(`  FAIL ${name} ${detail}`); failed++; }
};
const run = over => simulate({ ...DEFAULTS, ...over });
const fmt = n => Math.round(n).toLocaleString('en-GB');

console.log('\n── Structure ──');
check('9 stations defined', STATIONS.length === 9, `${STATIONS.length}`);
check('every station has a tag, params and supplies',
  STATIONS.every(s => s.tag && s.params.length && s.supplies.length));
check('every parameter has a normal band and an explanation',
  STATIONS.every(s => s.params.every(p => p.ok && p.note)));
check('every parameter key exists in DEFAULTS',
  STATIONS.flatMap(s => s.params.map(p => p.key)).every(k => k in DEFAULTS));
check('the filler is flagged as the constraint asset',
  STATIONS.find(s => s.id === 'filler')?.critical === true);

console.log('\n── Baseline: before the campaign ──');
const base = run({ campaignApplied: false });
check('bulk passes QC release at nominal settings', base.kpi.batchRelease === true,
  `SPF ${base.kpi.spfDelivery.toFixed(0)} %, droplet ${base.kpi.dropletUm.toFixed(1)} µm`);
check('baseline demand is covered', base.kpi.gap > 0,
  `${fmt(base.kpi.monthlyOutput)} vs ${fmt(base.kpi.demand)}`);
check('the maintenance window is already in the month', base.kpi.pmInHorizon === true,
  `PM opens day ${base.kpi.pmStartDay}`);
check('PM removes exactly 5 days', base.kpi.lostDays === PM_DURATION_DAYS, `${base.kpi.lostDays}`);
check('OEE is realistic for a personal-care packing line',
  base.kpi.oee > 55 && base.kpi.oee < 90, `${base.kpi.oee.toFixed(1)} %`);

console.log('\n── Step 3: campaign lands, orders blocked ──');
const at100 = planAt({ ...DEFAULTS, campaignApplied: true }, 100, false);
const demandTotal = DEMAND.baseline + DEMAND.campaignUplift;
check('campaign uplift is ~17 % of baseline',
  Math.abs(DEMAND.campaignUplift / DEMAND.baseline * 100 - 17) < 1.5,
  `${(DEMAND.campaignUplift / DEMAND.baseline * 100).toFixed(1)} %`);
check('at 100 % the month is SHORT of campaign demand', at100.monthly < demandTotal,
  `${fmt(at100.monthly)} vs ${fmt(demandTotal)}, short ${fmt(demandTotal - at100.monthly)}`);
check('PM-4471 opens around day 12', at100.pmStartDay >= 11 && at100.pmStartDay <= 13,
  `day ${at100.pmStartDay}`);
check('production days drop to 25', at100.productionDays === 25, `${at100.productionDays}`);
check('vibration is in ISO 20816 zone C at 100 %', at100.zone.zone === 'C',
  `${at100.vibration.toFixed(2)} mm/s`);

console.log('\n── Step 4: the ontology answer ──');
const at90 = planAt({ ...DEFAULTS, campaignApplied: true }, 90, true);
const deferralDays = at90.rul - at100.rul;
check('RUL at 100 % is about 12 days', Math.abs(at100.rul - 12) < 1.5, `${at100.rul.toFixed(1)} d`);
check('RUL at 90 % is about 39 days', Math.abs(at90.rul - 39) < 3, `${at90.rul.toFixed(1)} d`);
check('maintenance defers by ~4 weeks', Math.round(deferralDays / 7) === 4,
  `${deferralDays.toFixed(1)} days = ${(deferralDays / 7).toFixed(1)} weeks`);
check('vibration reads ~3.3 mm/s at rated speed', Math.abs(at100.vibration - 3.3) < 0.2,
  `${at100.vibration.toFixed(2)} mm/s`);
check('vibration reads ~2.0 mm/s at 90 %', Math.abs(at90.vibration - 2.0) < 0.2,
  `${at90.vibration.toFixed(2)} mm/s`);
check('90 % drops vibration to zone B', at90.zone.zone === 'B', `${at90.vibration.toFixed(2)} mm/s`);
check('damage accrues >3x faster at 100 % than at 90 %',
  damageFactor(100) / damageFactor(90) > 3,
  `${(damageFactor(100) / damageFactor(90)).toFixed(2)}×`);
check('at 90 % the PM leaves the planning month', at90.pmInHorizon === false,
  `PM would open day ${Math.ceil(at90.rul)}`);
check('90 % gives a full 30 production days', at90.productionDays === HORIZON_DAYS);

console.log('\n── The counter-intuitive result ──');
check('90 % produces MORE per month than 100 %', at90.monthly > at100.monthly,
  `${fmt(at90.monthly)} vs ${fmt(at100.monthly)}  (+${fmt(at90.monthly - at100.monthly)})`);
check('90 % covers the campaign demand', at90.monthly >= demandTotal,
  `coverage ${at90.coverage.toFixed(1)} %`);
check('daily rate really is lower at 90 %', at90.daily < at100.daily,
  `${fmt(at90.daily)} vs ${fmt(at100.daily)} per day`);
check('OEE alone would mislead you (it does not rise)', at90.oee < at100.oee,
  `OEE ${at90.oee.toFixed(1)} % vs ${at100.oee.toFixed(1)} % — the gain is in DAYS, not OEE`);

console.log('\n── Recommendation & sensitivity ──');
const { bestSafe, curve } = optimalRate({ ...DEFAULTS, campaignApplied: true });
check('recommended setpoint is 90 %', bestSafe.rate === 90, `${bestSafe.rate} %`);
check('recommendation clears demand', bestSafe.monthly >= demandTotal,
  `${fmt(bestSafe.monthly)}`);
const cliff = curve.find(c => c.pmInHorizon && c.rate > 85);
check('there is a sharp cliff just above the recommendation',
  cliff && cliff.rate >= 91 && cliff.rate <= 93, cliff ? `cliff at ${cliff.rate} %` : 'none found');
check('91 % still escapes the PM window',
  !curve.find(c => c.rate === 91).pmInHorizon);
check('every point on the curve is finite',
  curve.every(c => isFinite(c.monthly) && c.monthly >= 0));

console.log('\n── Physics behaviour ──');
check('damage rises monotonically with speed',
  [70, 80, 90, 95, 100].every((r, i, a) => i === 0 || damageFactor(r) > damageFactor(a[i - 1])));
check('vibration rises monotonically with speed',
  [70, 80, 90, 95, 100].every((r, i, a) => i === 0 || vibration(r) > vibration(a[i - 1])));
check('ISO 20816-3 Class II zones map correctly',
  vibZone(0.9).zone === 'A' && vibZone(2.0).zone === 'B' &&
  vibZone(5.0).zone === 'C' && vibZone(8.0).zone === 'D');
check('slower running always extends remaining life',
  planAt(DEFAULTS, 80, false).rul > planAt(DEFAULTS, 95, false).rul);
check('cold phase vessels fail the emulsion', run({ phaseTemp: 55 }).kpi.batchRelease === false);
check('low shear makes droplets coarse and fails SPF',
  run({ shearSpeed: 700 }).kpi.dropletUm > 6 && run({ shearSpeed: 700 }).kpi.batchRelease === false);
check('more changeovers reduce available capacity',
  run({ changeovers: 4 }).kpi.dailyOutput < run({ changeovers: 0 }).kpi.dailyOutput);
check('running over the knee increases rejects',
  run({ lineRate: 100 }).kpi.rejectRate > run({ lineRate: 85 }).kpi.rejectRate);

console.log('\n── Narrative integrity ──');
const steps = buildSteps(DEFAULTS);
check('6 narrative steps', steps.length === 6, `${steps.length}`);
check('every step has a title and an answer', steps.every(s => s.title && s.answer));
check('every agent referenced exists', steps.every(s => AGENTS[s.agent]));
check('all four IQ surfaces are demonstrated',
  ['workiq', 'webiq', 'ops', 'onto'].every(a => steps.some(s => s.agent === a)));
check('steps 1-5 carry grounding citations',
  steps.slice(1).every(s => (s.citations || []).length > 0));
check('the ontology step reveals the graph', steps.some(s => s.showOntology === true));
check('the ontology recommends 90 %',
  steps.find(s => s.id === 'ontology').recommend.lineRate === 90);
check('ontology path nodes all exist in the graph',
  ONTOLOGY.path.every(id => ONTOLOGY.nodes.some(n => n.id === id)));
check('ontology edges reference real nodes',
  ONTOLOGY.edges.every(([a, b]) => ONTOLOGY.nodes.some(n => n.id === a) && ONTOLOGY.nodes.some(n => n.id === b)));
check('narrative numbers match the model',
  steps.find(s => s.id === 'blocked').answer.includes(String(at100.productionDays)));

console.log('\n── Numerical safety ──');
const bad = [];
for (const st of STATIONS) {
  for (const p of st.params) {
    for (const v of [p.min, (p.min + p.max) / 2, p.max]) {
      const r = run({ [p.key]: v, campaignApplied: true });
      const nums = Object.values(r.kpi).filter(x => typeof x === 'number');
      if (nums.some(x => !isFinite(x))) bad.push(`NaN at ${p.key}=${v}`);
      if (r.kpi.dailyOutput < 0 || r.kpi.oee < 0 || r.kpi.oee > 100) bad.push(`range at ${p.key}=${v}`);
    }
  }
}
for (let r = 55; r <= 105; r++) {
  const k = run({ lineRate: r, campaignApplied: true }).kpi;
  if (!isFinite(k.monthlyOutput) || !isFinite(k.rulDays)) bad.push(`rate ${r}`);
}
check('all parameter extremes stay finite and in range', bad.length === 0, bad.slice(0, 4).join('; '));

console.log('\n── Fabric snapshot ──');
import { readFileSync, existsSync } from 'node:fs';
const snapPath = new URL('../src/data/fabric-snapshot.json', import.meta.url);
if (!existsSync(snapPath)) {
  check('fabric snapshot exists', false, 'run infra/export_snapshot.ps1');
} else {
  const snap = JSON.parse(readFileSync(snapPath, 'utf8'));
  check('snapshot names its Fabric source',
    snap.source?.system === 'Microsoft Fabric' && !!snap.source.workspaceId && !!snap.source.lakehouseId,
    `${snap.source?.workspace}/${snap.source?.lakehouse}`);
  check('snapshot carries an export timestamp', !!snap.source?.exportedUtc, snap.source?.exportedUtc);
  check('demand totals reconcile',
    Math.abs((+snap.demand.baseline + +snap.demand.uplift) - +snap.demand.committed) < 5,
    `${snap.demand.baseline} + ${snap.demand.uplift} = ${snap.demand.committed}`);
  check('lakehouse demand matches the model within 1 %',
    Math.abs(+snap.demand.committed - (DEMAND.baseline + DEMAND.campaignUplift)) / +snap.demand.committed < 0.01,
    `${(+snap.demand.committed).toLocaleString()}`);
  check('constraint asset is FL-02 in ISO 20816 zone C',
    snap.asset.asset_id === 'FL-02' && snap.condition.iso20816_zone === 'C',
    `${snap.condition.vibration_mm_s} mm/s`);
  check('asset damage matches the model default within 1 pt',
    Math.abs(+snap.condition.damage_consumed_pct - DEFAULTS.damageConsumed) < 1,
    `${snap.condition.damage_consumed_pct} % vs ${DEFAULTS.damageConsumed} %`);
  check('90 days of telemetry present', snap.telemetry.length >= 88, `${snap.telemetry.length} days`);
  check('telemetry shows a bearing replacement reset',
    Math.min(...snap.telemetry.map(t => +t.damage)) < 10, 'sawtooth present');
  check('open maintenance order is condition based',
    snap.maintenance.order_id === 'PM-4471' && snap.maintenance.trigger_type === 'condition_based');
  check('rate scenarios span 70-105 %', snap.scenarios.length === 36, `${snap.scenarios.length} points`);
  const s90 = snap.scenarios.find(r => +r.line_rate_pct === 90);
  const s100 = snap.scenarios.find(r => +r.line_rate_pct === 100);
  check('lakehouse agrees: 90 % beats 100 % on monthly output',
    +s90.monthly_units > +s100.monthly_units,
    `${(+s90.monthly_units).toLocaleString()} vs ${(+s100.monthly_units).toLocaleString()}`);
  check('lakehouse agrees: PM leaves the month at 90 %',
    +s90.lost_days === 0 && +s100.lost_days === 5);
  check('lakehouse RUL matches the model at 90 %',
    Math.abs(+s90.rul_days - 39.1) < 1.5, `${s90.rul_days} d`);
  check('ontology has 9 entities and 11 edges',
    snap.ontology.entities.length === 9 && snap.ontology.edges.length === 11);
  check('every ontology entity is bound to a lakehouse table',
    snap.ontology.entities.every(e => e.bound_table && e.bound_column));
}

console.log(failed ? `\n${failed} check(s) FAILED\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
