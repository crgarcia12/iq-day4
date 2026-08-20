// ===========================================================================
// Persona 2 demo narrative.
//
// Maps the story beats onto the Microsoft IQ layers:
//   Work IQ    — internal M365 signal: the campaign brief from Marketing
//   Web IQ     — external grounding: the ENSO / El Nino forecast
//   Fabric IQ  — Operations Agent (monitor + act) and Ontology (reason)
// ===========================================================================

import { DEMAND, PM_DURATION_DAYS, HORIZON_DAYS, planAt, optimalRate, DEGRADATION, damageFactor } from './line.js';

const PRODUCT_NAME = 'Hydration Sunscreen SPF 50';

export const AGENTS = {
  you: { name: 'Production Line Manager', short: 'You', badge: 'YOU', cls: 'you' },
  workiq: {
    name: 'Work IQ', short: 'Work IQ', badge: 'WORK IQ', cls: 'workiq',
    blurb: 'Semantic understanding of your organisation — mail, chats, meetings, documents and the people graph, under existing permissions.',
  },
  webiq: {
    name: 'Web IQ', short: 'Web IQ', badge: 'WEB IQ', cls: 'webiq',
    blurb: 'Grounding in fresh public web information, retrieved and ranked at answer time.',
  },
  ops: {
    name: 'Fabric IQ · Operations Agent', short: 'Operations Agent', badge: 'FABRIC IQ', cls: 'fabric',
    blurb: 'Monitors live operational data against the ontology, detects conditions that matter to the business, and takes or recommends action.',
  },
  onto: {
    name: 'Fabric IQ · Ontology', short: 'Ontology', badge: 'FABRIC IQ', cls: 'onto',
    blurb: 'The governed semantic model: entities, relationships and rules bound to OneLake data, shared by every agent.',
  },
};

// ---------------------------------------------------------------------------
// The asset ontology traversed in step 4.
// ---------------------------------------------------------------------------
export const ONTOLOGY = {
  nodes: [
    { id: 'sku', label: 'Product', sub: 'HS-SPF50-200', kind: 'entity', x: 0.06, y: 0.20 },
    { id: 'demand', label: 'DemandPlan', sub: 'March · 2.62 M units', kind: 'entity', x: 0.06, y: 0.62 },
    { id: 'line', label: 'ProductionLine', sub: 'Suncare Line 3', kind: 'entity', x: 0.30, y: 0.40 },
    { id: 'asset', label: 'Asset', sub: 'FL-02 Servo Filler', kind: 'asset', x: 0.53, y: 0.22 },
    { id: 'comp', label: 'Component', sub: 'Main drive bearing', kind: 'asset', x: 0.53, y: 0.62 },
    { id: 'signal', label: 'ConditionSignal', sub: 'Vibration mm/s RMS', kind: 'signal', x: 0.76, y: 0.13 },
    { id: 'model', label: 'DegradationModel', sub: 'ISO 281 · ISO 20816', kind: 'rule', x: 0.76, y: 0.45 },
    { id: 'policy', label: 'MaintenancePolicy', sub: 'PM-4471 · condition based', kind: 'rule', x: 0.76, y: 0.80 },
    { id: 'cap', label: 'CapacityModel', sub: 'days × rate × OEE', kind: 'rule', x: 0.30, y: 0.82 },
  ],
  edges: [
    ['sku', 'line', 'produced on'],
    ['demand', 'sku', 'requires'],
    ['demand', 'cap', 'constrained by'],
    ['line', 'asset', 'constraint asset'],
    ['line', 'cap', 'has capacity'],
    ['asset', 'comp', 'has component'],
    ['asset', 'signal', 'emits'],
    ['comp', 'model', 'degrades per'],
    ['signal', 'model', 'feeds'],
    ['model', 'policy', 'triggers'],
    ['policy', 'cap', 'removes days from'],
  ],
  // The traversal the agent actually performs, revealed step by step.
  path: ['demand', 'cap', 'line', 'asset', 'comp', 'model', 'policy'],
};

const fmt = n => Math.round(n).toLocaleString('en-GB');
const fmtM = n => (n / 1e6).toFixed(2) + ' M';

// ---------------------------------------------------------------------------
// Steps. Each returns its content from live model numbers so the narrative
// can never drift out of sync with the simulation.
// ---------------------------------------------------------------------------
export function buildSteps(params) {
  const base = { ...params, campaignApplied: false, maintenanceDeferred: false };
  const at100 = planAt(base, 100, false);
  const withCampaign = { ...base, campaignApplied: true };
  const { bestSafe, curve } = optimalRate(withCampaign);
  const at90 = planAt(withCampaign, 90, true);
  const demandTotal = DEMAND.baseline + DEMAND.campaignUplift;
  const shortfall = Math.max(0, demandTotal - at100.monthly);
  const cliff = curve.find(c => c.pmInHorizon && c.rate > 85);

  return [
    // -------------------------------------------------------------- step 0
    {
      id: 'situation',
      agent: 'you',
      nav: 'Situation',
      title: 'Suncare Line 3 is running to plan',
      prompt: null,
      answer: `Line 3 is producing ${PRODUCT_NAME} at 100 % of rated speed — ${fmt(at100.daily)} units a day. ` +
        `The committed demand plan for the month is ${fmtM(DEMAND.baseline)} units and the line covers it. ` +
        `There is one open item: maintenance order PM-4471 on the filler.`,
      bullets: [
        `Line speed 100 % of rated (120 bottles/min)`,
        `Committed demand ${fmtM(DEMAND.baseline)} units`,
        `PM-4471 open against FL-02, ${PM_DURATION_DAYS}-day window`,
      ],
      apply: { campaignApplied: false, maintenanceDeferred: false, lineRate: 100 },
      focus: null,
    },

    // -------------------------------------------------------------- step 1
    {
      id: 'campaign',
      agent: 'workiq',
      nav: 'Campaign lands',
      title: 'Marketing has loaded a booster campaign',
      prompt: 'What has changed on my demand plan this morning?',
      thinking: [
        'Reading the demand planning workbook updated 07:12 today',
        'Correlating with campaign approval thread in Teams',
        'Resolving the campaign agent’s forecast into SKU-level orders',
      ],
      answer: `The Marketing Manager has approved a booster campaign for ${PRODUCT_NAME} and the campaign agent has ` +
        `already loaded the expected orders. Your committed demand for the month rises from ${fmtM(DEMAND.baseline)} ` +
        `to ${fmtM(demandTotal)} units — an uplift of ${fmt(DEMAND.campaignUplift)} units, ${(DEMAND.campaignUplift / DEMAND.baseline * 100).toFixed(0)} %.`,
      bullets: [
        `Campaign uplift +${fmt(DEMAND.campaignUplift)} units`,
        `New committed demand ${fmtM(demandTotal)} units`,
        `Orders already firm-planned in the MPS`,
      ],
      citations: [
        { icon: '💬', src: 'Teams · Suncare S&OP', txt: '“Booster campaign approved for Hydration SPF 50 — loading orders now.”', meta: 'Marketing Manager · today 07:04' },
        { icon: '📄', src: 'Campaign brief — Hydration Booster.docx', txt: 'Uplift modelled at +17 % on the March baseline for the SPF 50 200 ml SKU.', meta: 'SharePoint · Marketing / Campaigns' },
        { icon: '📊', src: 'Demand plan FY26 P03.xlsx', txt: 'Firm planned orders written back by the campaign agent at 07:12.', meta: 'OneLake shortcut · Planning' },
      ],
      apply: { campaignApplied: true },
      focus: null,
      highlight: 'demand',
    },

    // -------------------------------------------------------------- step 2
    {
      id: 'why',
      agent: 'webiq',
      nav: 'Why',
      title: 'The campaign is a response to a longer El Niño',
      prompt: 'Why is Marketing pushing extra volume into an already committed month?',
      thinking: [
        'Retrieving current ENSO advisories and seasonal outlooks',
        'Cross-checking UV index outlook for the campaign regions',
        'Ranking against retail suncare demand studies',
      ],
      answer: `The campaign is grounded in an external signal. The current El Niño is now forecast to persist ` +
        `materially longer than the earlier outlook, extending the high-UV season across the campaign regions. ` +
        `Suncare demand tracks UV and temperature closely, so Marketing pulled volume forward to cover an ` +
        `extended selling window rather than a one-off promotion.`,
      bullets: [
        'El Niño conditions forecast to persist beyond the prior outlook',
        'Extended high-UV season across the campaign regions',
        'Suncare sell-through is strongly weather-elastic',
      ],
      citations: [
        { icon: '🌎', src: 'NOAA Climate Prediction Center — ENSO Diagnostic Discussion', txt: 'El Niño conditions are present and expected to continue, with the transition to neutral now forecast later than previously indicated.', meta: 'Public web · retrieved today' },
        { icon: '☀️', src: 'Seasonal UV index outlook', txt: 'Above-average UV index days forecast for the campaign regions through the planning horizon.', meta: 'Public web' },
        { icon: '📈', src: 'Retail suncare demand analysis', txt: 'Suncare sell-through correlates strongly with temperature and UV index; hot spells produce step changes in weekly volume.', meta: 'Public web · industry analysis' },
      ],
      apply: {},
      focus: null,
    },

    // -------------------------------------------------------------- step 3
    {
      id: 'blocked',
      agent: 'ops',
      nav: 'Orders blocked',
      title: 'Production orders cannot be placed — PM-4471 blocks the month',
      prompt: 'Place the production orders needed to cover the new demand plan.',
      thinking: [
        'Expanding demand plan into a master production schedule',
        'Running capacity requirements planning against Suncare Line 3',
        'Checking the asset calendar for planned outages',
        'Detected condition-based order PM-4471 on FL-02',
      ],
      answer: `I cannot commit the orders. Capacity requirements planning fails for the month. ` +
        `FL-02 reaches its condition limit on day ${at100.pmStartDay}, which opens the ${PM_DURATION_DAYS}-day ` +
        `maintenance window PM-4471 and removes ${at100.lostDays} production days. That leaves ` +
        `${at100.productionDays} production days at ${fmt(at100.daily)} units/day — ${fmtM(at100.monthly)} units ` +
        `against committed demand of ${fmtM(demandTotal)}. You are ${fmt(shortfall)} units short.`,
      bullets: [
        `PM-4471 opens day ${at100.pmStartDay}, runs ${PM_DURATION_DAYS} days`,
        `Production days ${HORIZON_DAYS} → ${at100.productionDays}`,
        `Shortfall ${fmt(shortfall)} units · OTIF at risk`,
      ],
      citations: [
        { icon: '🏭', src: 'Ontology · Asset FL-02', txt: `Condition signal at ${at100.vibration.toFixed(1)} mm/s RMS, ISO 20816 zone ${at100.zone.zone}. Remaining useful life ${at100.rul.toFixed(1)} days at current speed.`, meta: 'Fabric IQ · bound to OneLake asset telemetry' },
        { icon: '🔧', src: 'Maintenance order PM-4471', txt: `Condition-based intervention on the FL-02 main drive. Duration ${PM_DURATION_DAYS} days, line down for the full window.`, meta: 'Fabric IQ · maintenance entity' },
        { icon: '📦', src: 'Capacity requirements planning run', txt: `Requirement ${fmtM(demandTotal)} units exceeds available capacity ${fmtM(at100.monthly)} units.`, meta: 'Fabric IQ · Operations Agent' },
      ],
      apply: { campaignApplied: true, lineRate: 100, maintenanceDeferred: false },
      focus: 'filler',
      highlight: 'blocked',
    },

    // -------------------------------------------------------------- step 4
    {
      id: 'ontology',
      agent: 'onto',
      nav: 'Ontology answer',
      title: 'Run slower, and the maintenance window leaves the month',
      prompt: 'Can I do anything about PM-4471? I need the whole month.',
      thinking: [
        'DemandPlan → CapacityModel → ProductionLine',
        'ProductionLine → Asset FL-02 → Component: main drive bearing',
        'Component → DegradationModel (ISO 281 load-life, ISO 20816 severity)',
        'Evaluating damage rate as a function of line speed',
        'DegradationModel → MaintenancePolicy → earliest compliant PM date',
      ],
      answer: `PM-4471 is condition-based, not calendar-based, so its date is an output of how hard you run the ` +
        `asset. Damage on the drive scales with load cubed, and above ${DEGRADATION.kneePct} % of rated speed the ` +
        `drive enters its resonance band and moves from vibration zone B into zone C, where damage accrues ` +
        `${(damageFactor(100) / damageFactor(90)).toFixed(1)}× faster. ` +
        `At 90 % of rated speed the remaining useful life extends from ${at100.rul.toFixed(0)} days to ` +
        `${at90.rul.toFixed(0)} days, which moves PM-4471 out of this month — a deferral of about ` +
        `${Math.round((at90.rul - at100.rul) / 7)} weeks.\n\n` +
        `You lose 10 % of daily rate but win back ${at100.lostDays} production days. Net monthly output rises from ` +
        `${fmtM(at100.monthly)} to ${fmtM(at90.monthly)} units, which covers the campaign demand of ${fmtM(demandTotal)}.`,
      bullets: [
        `RUL ${at100.rul.toFixed(0)} d → ${at90.rul.toFixed(0)} d at 90 % speed`,
        `Vibration zone ${at100.zone.zone} → ${at90.zone.zone}`,
        `Output ${fmtM(at100.monthly)} → ${fmtM(at90.monthly)} units`,
      ],
      citations: [
        { icon: '🧠', src: 'Ontology traversal', txt: 'DemandPlan → CapacityModel → ProductionLine → Asset → Component → DegradationModel → MaintenancePolicy', meta: 'Fabric IQ · 7 hops, governed definitions' },
        { icon: '📐', src: 'DegradationModel · ISO 281', txt: 'Bearing life scales with the cube of the equivalent dynamic load, so a 10 % reduction in load is a disproportionate gain in life.', meta: 'Rule bound to the Component entity' },
        { icon: '📉', src: 'DegradationModel · ISO 20816', txt: `Severity zones for this machine class: below 4.5 mm/s RMS is acceptable for continuous operation; above 7.1 mm/s is unsatisfactory. FL-02 crosses at ~${DEGRADATION.kneePct} % of rated speed.`, meta: 'Rule bound to the ConditionSignal' },
        { icon: '⚠️', src: 'Sensitivity check', txt: cliff ? `The cliff is sharp: at ${cliff.rate} % the window returns to day ${cliff.pmStartDay}. 90 % keeps a safe margin below it.` : 'Maintenance stays outside the horizon across the recommended band.', meta: 'Fabric IQ · Operations Agent' },
        { icon: '🔬', src: 'Model transparency', txt: 'Deferral assumes the drive operates near structural resonance at 100 % rated speed (ISO 20816-3 zone C, ~3.3 mm/s RMS, Class II). At 90 % vibration drops to zone B (~2.0 mm/s), reducing the Miner\'s-rule damage rate ~3.3×. Pure ISO 281 L10 speed scaling alone would yield only about +11 % service hours.', meta: 'Demo model · stated assumption' },
      ],
      apply: { campaignApplied: true },
      focus: 'filler',
      showOntology: true,
      recommend: { lineRate: bestSafe ? bestSafe.rate : 90 },
    },

    // -------------------------------------------------------------- step 5
    {
      id: 'commit',
      agent: 'ops',
      nav: 'Commit plan',
      title: 'Plan committed — orders released',
      prompt: 'Apply it. Drop the line to 90 % and reschedule PM-4471.',
      thinking: [
        'Writing line speed setpoint to Suncare Line 3',
        'Rescheduling PM-4471 against the revised condition forecast',
        'Re-running capacity requirements planning',
        'Releasing production orders',
      ],
      answer: `Done. Line speed setpoint is 90 % of rated, PM-4471 is rescheduled outside the planning month, ` +
        `and the production orders are released. The month now plans at ${fmtM(at90.monthly)} units against ` +
        `${fmtM(demandTotal)} committed — ${at90.coverage.toFixed(1)} % coverage. Condition monitoring on FL-02 ` +
        `stays live; if vibration deviates from the model the window comes back automatically.`,
      bullets: [
        `Line speed 100 % → 90 % of rated`,
        `PM-4471 deferred ~${Math.round((at90.rul - at100.rul) / 7)} weeks`,
        `Coverage ${at90.coverage.toFixed(1)} % · orders released`,
      ],
      citations: [
        { icon: '✅', src: 'Production orders released', txt: `Firm orders written for ${fmtM(demandTotal)} units across the month.`, meta: 'Fabric IQ · Operations Agent' },
        { icon: '🔁', src: 'PM-4471 rescheduled', txt: 'Condition-based trigger retained; the agent continues to monitor the vibration signal against the degradation model.', meta: 'Fabric IQ · maintenance entity' },
      ],
      apply: { campaignApplied: true, maintenanceDeferred: true, lineRate: bestSafe ? bestSafe.rate : 90 },
      recommend: { lineRate: bestSafe ? bestSafe.rate : 90 },
      focus: null,
      highlight: 'solved',
    },
  ];
}
