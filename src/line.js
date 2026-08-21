// ===========================================================================
// Caldova — Hydration Sunscreen SPF 50 production line model
// Persona 2: Production Line Manager
//
// The analytical heart of the demo is the coupling between LINE SPEED and
// MAINTENANCE INTERVAL. Running the filler below the resonance knee slows
// damage accumulation enough to push the planned maintenance window out of
// the month, which wins back more days than the speed loss costs.
// ===========================================================================

export const PRODUCT = {
  sku: 'HS-SPF50-200',
  name: 'Hydration Sunscreen SPF 50',
  pack: '200 ml bottle',
  unitPrice: 8.4,       // GBP wholesale per bottle
  unitMargin: 3.1,
};

export const HORIZON_DAYS = 30;   // planning month
export const PM_DURATION_DAYS = 5; // the maintenance window in the narrative

// ---------------------------------------------------------------------------
// Stations
// ---------------------------------------------------------------------------
export const STATIONS = [
  {
    id: 'dispensing',
    tag: 'RM-01',
    name: 'Raw Material Dispensing & Weighing',
    short: 'Dispensing',
    zone: 'Warehouse · CNC',
    pos: [-34, 0, -12],
    desc: 'Gravimetric dispensing of the UV filter blend (avobenzone, octocrylene, homosalate, octisalate), emollients, emulsifiers, carbomer thickener and preservative system against the batch recipe. Every weighing is reconciled to the batch record.',
    params: [
      { key: 'batchSize', label: 'Batch size', unit: 'kg', min: 500, max: 4000, step: 100, ok: [1500, 3000],
        note: 'Bigger batches amortise changeover and CIP, but increase the quantity at risk if the batch fails QC release.' },
      { key: 'dispenseAccuracy', label: 'Dispensing tolerance', unit: '%', min: 0.1, max: 3, step: 0.1, ok: [0.1, 1.0],
        note: 'UV filter weighing drives SPF. Out-of-tolerance actives are the single most common cause of an SPF release failure.' },
    ],
    supplies: ['UV filter blend', 'Emollients & esters', 'Emulsifier system', 'Carbomer / xanthan', 'Preservative'],
  },
  {
    id: 'phases',
    tag: 'PV-01',
    name: 'Oil & Water Phase Vessels',
    short: 'Phase Vessels',
    zone: 'Compounding',
    pos: [-21, 0, -12],
    desc: 'Jacketed vessels heat the water phase and the oil phase separately to ~75-80 °C. The solid UV filters and waxes must be fully melted and dissolved before the phases are combined, or the emulsion will be unstable.',
    params: [
      { key: 'phaseTemp', label: 'Phase temperature', unit: '°C', min: 50, max: 95, step: 1, ok: [70, 80],
        note: 'Both phases are heated separately to 70-80 °C and must be at matched temperature at the point of emulsification. Below ~70 °C crystalline UV filters do not fully dissolve.' },
      { key: 'holdTime', label: 'Pre-emulsion hold', unit: 'min', min: 5, max: 60, step: 5, ok: [15, 35],
        note: 'Long hot holds waste energy and start to degrade heat-sensitive components.' },
    ],
    supplies: ['Purified water (PW)', 'Steam / hot water', 'Nitrogen blanket'],
  },
  {
    id: 'emulsifier',
    tag: 'EM-01',
    name: 'Vacuum Emulsifier & High-Shear Homogeniser',
    short: 'Emulsifier',
    zone: 'Compounding',
    pos: [-8, 0, -12],
    desc: 'The oil phase is drawn into the water phase under vacuum while a rotor-stator homogeniser applies high shear. Droplet size distribution set here determines SPF delivery, texture and long-term emulsion stability.',
    params: [
      { key: 'shearSpeed', label: 'Homogeniser speed', unit: 'rpm', min: 1000, max: 10000, step: 100, ok: [3000, 8000],
        note: 'Rotor-stator homogenisers run 3 000-10 000 rpm (tip speed 10-40 m/s). Higher shear drives smaller droplets and better SPF uniformity, but over-shearing heats the batch and can break the emulsion.' },
      { key: 'emulsifyTime', label: 'Emulsification time', unit: 'min', min: 2, max: 45, step: 1, ok: [10, 25],
        note: 'Droplet size approaches an asymptote; beyond it you are only adding energy, heat and cycle time.' },
      { key: 'vacuum', label: 'Vessel vacuum', unit: '% full', min: 0, max: 100, step: 5, ok: [60, 100],
        note: 'Vacuum de-aerates the emulsion. Entrained air causes fill-weight variation downstream and visible bubbles in a clear bottle.' },
    ],
    supplies: ['Vacuum / utilities', 'Chilled water', 'Fragrance (post-cool)'],
  },
  {
    id: 'qc',
    tag: 'QC-01',
    name: 'Bulk Hold & QC Release',
    short: 'QC Release',
    zone: 'Laboratory',
    pos: [6, 0, 10],
    desc: 'Bulk is cooled to ~40 °C, fragrance and heat-sensitive actives are added, then the batch is held pending release: viscosity, pH, appearance, in-vitro SPF, microbiological limits and preservative efficacy.',
    params: [
      { key: 'qcHours', label: 'QC release time', unit: 'h', min: 2, max: 72, step: 1, ok: [8, 24],
        note: 'Bulk cannot be filled until released. Release time is pure lead time — it does not consume line capacity but it does consume the month.' },
      { key: 'viscositySpec', label: 'Viscosity release window', unit: '± %', min: 5, max: 40, step: 1, ok: [10, 25],
        note: 'A tight window catches more genuine defects but rejects more borderline batches.' },
    ],
    supplies: ['Viscometer / rheometer', 'In-vitro SPF plates', 'Micro media', 'Retention samples'],
  },
  {
    id: 'filler',
    tag: 'FL-02',
    name: 'Servo Piston Filler',
    short: 'Filling Line',
    zone: 'Packing hall',
    pos: [6, 0, -12],
    critical: true,
    desc: 'Twelve-head servo piston filler dosing 200 ml of lotion per bottle. This is the constraint asset of the line and the one carrying the open maintenance order: its main drive bearing and cam followers are the components approaching end of life.',
    params: [
      { key: 'lineRate', label: 'Line speed', unit: '% of rated', min: 55, max: 105, step: 1, ok: [80, 91],
        note: 'THE lever. Rated speed is 120 bottles/min. Above ~92 % the drive crosses into its resonance band and damage accumulates several times faster.' },
      { key: 'fillTolerance', label: 'Fill volume tolerance', unit: '± %', min: 0.2, max: 5, step: 0.1, ok: [0.2, 1.0],
        note: 'A servo piston filler holds about ±0.5 %. Average-quantity rules mean systematic under-fill is illegal and systematic over-fill is given away free.' },
    ],
    supplies: ['200 ml HDPE bottles', 'Piston seals', 'Product hoses'],
  },
  {
    id: 'capper',
    tag: 'CP-01',
    name: 'Capper & Induction Sealer',
    short: 'Capping',
    zone: 'Packing hall',
    pos: [19, 0, -12],
    desc: 'Flip-top closures applied to torque specification, followed by induction sealing of the foil liner to give tamper evidence and prevent leakage in transit.',
    params: [
      { key: 'torque', label: 'Application torque', unit: 'lbf·in', min: 5, max: 40, step: 1, ok: [12, 26],
        note: 'Typical application torque for a 28-38 mm closure is 12-26 lbf·in. Under-torque leaks in transit; over-torque strips the thread and makes the pack impossible for a consumer to open.' },
      { key: 'sealPower', label: 'Induction seal power', unit: '%', min: 30, max: 100, step: 5, ok: [55, 85],
        note: 'Too little power and the liner does not bond; too much scorches the liner and taints the product.' },
    ],
    supplies: ['Flip-top closures', 'Induction liners'],
  },
  {
    id: 'labeller',
    tag: 'LB-01',
    name: 'Wrap Labeller & Date Coder',
    short: 'Labelling',
    zone: 'Packing hall',
    pos: [32, 0, -12],
    desc: 'Pressure-sensitive wrap labelling with vision verification, then batch code and best-before date. The label carries the SPF claim and the regulated PAO / usage text, so a mislabel is a recall event.',
    params: [
      { key: 'labelAccuracy', label: 'Label placement tolerance', unit: '± mm', min: 0.5, max: 5, step: 0.1, ok: [0.5, 2.0],
        note: 'Skewed or lifted labels are the highest-volume cosmetic reject on a suncare line.' },
      { key: 'visionCheck', label: 'Vision inspection coverage', unit: '%', min: 0, max: 100, step: 5, ok: [95, 100],
        note: 'Verifies the correct label version and a readable code. The escape you care about is right product, wrong SPF label.' },
    ],
    supplies: ['Wrap labels', 'Coding ink / ribbon'],
  },
  {
    id: 'packer',
    tag: 'PK-01',
    name: 'Cartoner & Palletiser',
    short: 'Case Pack',
    zone: 'Despatch',
    pos: [32, 0, 10],
    desc: 'Bottles are collated into shelf-ready cases, cases are palletised, stretch-wrapped and labelled with the pallet licence plate for the distribution centre.',
    params: [
      { key: 'casePack', label: 'Bottles per case', unit: '', min: 6, max: 24, step: 6, ok: [12, 12],
        note: 'Case configuration is fixed by the retailer shelf-ready specification.' },
      { key: 'palletPattern', label: 'Cases per pallet', unit: '', min: 40, max: 120, step: 5, ok: [70, 100],
        note: 'Drives transport cost per unit and the number of despatch movements.' },
    ],
    supplies: ['Shelf-ready cases', 'Pallets', 'Stretch wrap', 'Pallet labels'],
  },
  {
    id: 'cip',
    tag: 'CIP-01',
    name: 'CIP Skid & Utilities',
    short: 'CIP & Utilities',
    zone: 'Technical',
    pos: [-15, 0, 10],
    desc: 'Clean-in-place of vessels and product lines between batches and SKUs, plus purified water generation, chilled water and compressed air. CIP time is planned downtime that comes directly off available production hours.',
    params: [
      { key: 'cipHours', label: 'CIP cycle time', unit: 'h', min: 0.5, max: 8, step: 0.5, ok: [1, 2],
        note: 'Cosmetics CIP runs 0.5-1.5 h; a validated washout for an OTC-drug product runs 1-2 h. A full product changeover needs the validated cycle, a like-for-like batch change needs far less.' },
      { key: 'changeovers', label: 'Changeovers per day', unit: '', min: 0, max: 6, step: 1, ok: [0, 2],
        note: 'Each changeover costs a CIP cycle plus set-up. SMED work here directly buys back capacity.' },
    ],
    supplies: ['Caustic / acid detergent', 'Purified water', 'Compressed air'],
  },
];

// ---------------------------------------------------------------------------
// Defaults — the "as found" state at the start of the demo
// ---------------------------------------------------------------------------
export const DEFAULTS = {
  // filler / line
  lineRate: 100,
  fillTolerance: 0.5,
  ratedBpm: 120,
  shiftHours: 16,        // two shifts
  // compounding
  batchSize: 2500,
  dispenseAccuracy: 0.5,
  phaseTemp: 75,
  holdTime: 25,
  shearSpeed: 5000,
  emulsifyTime: 18,
  vacuum: 80,
  // quality
  qcHours: 16,
  viscositySpec: 18,
  // packing
  torque: 16,
  sealPower: 70,
  labelAccuracy: 1.2,
  visionCheck: 100,
  casePack: 12,
  palletPattern: 84,
  // utilities
  cipHours: 2,
  changeovers: 1,
  // asset condition (Fabric IQ ontology binding)
  damageConsumed: 76,    // % of the fatigue budget already used on FL-02
  // demand
  campaignApplied: false,
  maintenanceDeferred: false,
};

// ---------------------------------------------------------------------------
// Demand — baseline forecast and the campaign uplift from Persona 1
// ---------------------------------------------------------------------------
export const DEMAND = {
  baseline: 2_120_000,        // units committed for the month before the campaign
  campaignUplift: 360_000,    // additional units loaded by the campaign agent (+17 %)
  safetyStockDays: 3,
};

/**
 * Rebind the model to values read from the Fabric lakehouse.
 * Called once at startup after the snapshot loads; everything downstream then
 * computes from real data rather than the built-in constants.
 */
export function applyFabric(F) {
  if (!F || !F.loaded) return false;
  if (F.demand) {
    DEMAND.baseline = F.demand.baseline;
    DEMAND.campaignUplift = F.demand.campaignUplift;
  }
  if (F.asset) {
    if (isFinite(F.asset.damageConsumed)) DEFAULTS.damageConsumed = F.asset.damageConsumed;
    if (isFinite(F.asset.kneePct)) DEGRADATION.kneePct = F.asset.kneePct;
    if (isFinite(F.asset.ratedCapacity)) DEFAULTS.ratedBpm = F.asset.ratedCapacity;
  }
  if (F.product) {
    PRODUCT.sku = F.product.sku;
    PRODUCT.name = F.product.name;
    PRODUCT.pack = F.product.pack;
    PRODUCT.unitPrice = F.product.unitPrice;
    PRODUCT.unitMargin = F.product.unitMargin;
    DEFAULTS.casePack = F.product.casePack;
    DEFAULTS.palletPattern = F.product.casesPerPallet;
  }
  if (F.maintenance && isFinite(F.maintenance.durationDays)) {
    PM.durationDays = F.maintenance.durationDays;
    PM.orderId = F.maintenance.id;
  }
  return true;
}

/** Mutable maintenance-order facts, bound from the lakehouse when available. */
export const PM = { orderId: 'PM-4471', durationDays: PM_DURATION_DAYS };

// ---------------------------------------------------------------------------
// Degradation model for FL-02 (this is what the ontology query walks)
// ---------------------------------------------------------------------------
export const DEGRADATION = {
  // ISO 281 bearing life scales with load^3; here load/stress tracks line speed.
  loadExponent: 3,
  // Measured resonance band of the filler main drive. Above this the machine
  // moves from ISO 20816 vibration zone B into zone C and damage accelerates.
  kneePct: 92,
  kneeWidth: 2,
  kneeAmplification: 4,
  // Scaling so the fatigue budget is consumed at a realistic rate.
  baseDamagePerDay: 0.406,
  // Vibration severity, mm/s RMS. Calibrated so the filler drive reads ~3.3 mm/s
  // (ISO 20816-3 Class II zone C) at rated speed and ~2.0 mm/s (zone B) at 90 %.
  vibBase: 1.861,
  vibKneeRise: 1.465,
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sigmoid = x => 1 / (1 + Math.exp(-x));

/** Relative damage rate on FL-02 at a given % of rated line speed. */
export function damageFactor(ratePct) {
  const load = Math.pow(ratePct / 100, DEGRADATION.loadExponent);
  const resonance = 1 + DEGRADATION.kneeAmplification *
    sigmoid((ratePct - DEGRADATION.kneePct) / DEGRADATION.kneeWidth);
  return load * resonance;
}

/** Broadband vibration severity (mm/s RMS) at a given line speed. */
export function vibration(ratePct) {
  return DEGRADATION.vibBase * Math.pow(ratePct / 100, 1.4)
    + DEGRADATION.vibKneeRise * sigmoid((ratePct - DEGRADATION.kneePct) / DEGRADATION.kneeWidth);
}

/**
 * ISO 20816-3 evaluation zones for a Class II machine (15-300 kW, rigid mount),
 * which is the right class for a bottle-filler main drive.
 */
export function vibZone(mmps) {
  if (mmps < 1.12) return { zone: 'A', label: 'newly commissioned', cls: 'good' };
  if (mmps <= 2.80) return { zone: 'B', label: 'acceptable for long-term operation', cls: 'good' };
  if (mmps <= 7.10) return { zone: 'C', label: 'unsatisfactory — restricted operation', cls: 'warn' };
  return { zone: 'D', label: 'damaging — risk of failure', cls: 'bad' };
}

// ---------------------------------------------------------------------------
// Main simulation
// ---------------------------------------------------------------------------
export function simulate(p) {
  const issues = {};
  const add = (id, sev, ref, text) => (issues[id] = issues[id] || []).push({ sev, ref, text });

  const rate = p.lineRate / 100;

  // ---- 1. Nominal line capability -----------------------------------------
  const theoreticalPerDay = p.ratedBpm * 60 * p.shiftHours;   // bottles/day at rated speed

  // ---- 2. Availability -----------------------------------------------------
  // Planned downtime: CIP and changeovers come straight off the shift.
  const plannedDownH = p.cipHours * Math.max(1, p.changeovers) * (p.changeovers > 0 ? 1 : 0.5);
  const plannedAvail = clamp((p.shiftHours - plannedDownH) / p.shiftHours, 0.3, 1);

  // Unplanned stops: micro-stoppages rise steeply once the filler is pushed
  // into its resonance band — jams, mis-feeds and drive faults.
  const stopFrac = clamp(
    0.030 + 0.075 * sigmoid((p.lineRate - DEGRADATION.kneePct) / DEGRADATION.kneeWidth),
    0.01, 0.4);
  const availability = clamp(plannedAvail * (1 - stopFrac), 0.1, 1);

  // ---- 3. Quality ----------------------------------------------------------
  const speedRejects = 0.004 + 0.014 * sigmoid((p.lineRate - DEGRADATION.kneePct) / DEGRADATION.kneeWidth);
  const labelRejects = 0.002 + Math.max(0, (p.labelAccuracy - 2)) * 0.004;
  const capRejects = (p.torque < 12 ? (12 - p.torque) * 0.002 : 0) +
                     (p.torque > 26 ? (p.torque - 26) * 0.002 : 0) +
                     (p.sealPower < 55 ? (55 - p.sealPower) * 0.0008 : 0);
  const fillRejects = Math.max(0, (p.fillTolerance - 2)) * 0.003;
  const rejectRate = clamp(speedRejects + labelRejects + capRejects + fillRejects, 0, 0.4);
  const quality = 1 - rejectRate;

  // ---- 4. Batch / formulation quality (does the bulk pass release?) --------
  const tempOk = p.phaseTemp >= 70 && p.phaseTemp <= 85;
  const shearOk = p.shearSpeed >= 2500;
  // Target D50 for a sunscreen emulsion is 2-5 µm; coarser droplets form an
  // uneven film and cost SPF delivery.
  const dropletUm = clamp(4.2 * Math.pow(5000 / Math.max(800, p.shearSpeed), 0.75) *
    Math.pow(18 / Math.max(2, p.emulsifyTime), 0.35), 0.4, 40);
  const spfDelivery = clamp(100 - Math.max(0, dropletUm - 6) * 3.2 -
    (tempOk ? 0 : 12) - p.dispenseAccuracy * 4.5, 40, 100);
  const batchRelease = spfDelivery >= 92 && tempOk && shearOk;

  if (!tempOk) {
    add('phases', 0.75, 'Emulsion stability',
      `Phase temperature ${p.phaseTemp} °C is outside the 72-82 °C window — crystalline UV filters will not fully dissolve and the emulsion will separate on stability.`);
  }
  if (dropletUm > 6) {
    add('emulsifier', clamp((dropletUm - 6) / 12, 0.3, 1), 'SPF uniformity',
      `Mean droplet size ${dropletUm.toFixed(1)} µm is coarse. Uneven film formation costs SPF delivery — in-vitro SPF tracking at ${spfDelivery.toFixed(0)} % of label.`);
  }
  if (!batchRelease) {
    add('qc', 1, 'Batch release',
      `Bulk would FAIL QC release: in-vitro SPF at ${spfDelivery.toFixed(0)} % of the label claim against a 92 % release limit.`);
  }
  if (p.dispenseAccuracy > 1.0) {
    add('dispensing', clamp(p.dispenseAccuracy / 3, 0.3, 0.9), 'cGMP 21 CFR 211',
      `Dispensing tolerance ±${p.dispenseAccuracy} % on the UV filter blend puts the SPF claim at risk; sunscreen is a regulated OTC drug in the US.`);
  }

  // ---- 5. Output -----------------------------------------------------------
  const dailyOutput = Math.round(theoreticalPerDay * rate * availability * quality * (batchRelease ? 1 : 0));
  // Standard OEE caps the performance factor at rated speed — running over-speed
  // is not "better than perfect", it just wears the asset out faster.
  const oee = availability * Math.min(1, rate) * quality * 100;

  // ---- 6. Asset degradation and the maintenance window ---------------------
  const dmgFactor = damageFactor(p.lineRate);
  const damagePerDay = DEGRADATION.baseDamagePerDay * dmgFactor;
  const remainingBudget = Math.max(0, 100 - p.damageConsumed);
  const rulDays = damagePerDay > 0 ? remainingBudget / damagePerDay : 999;
  const vib = vibration(p.lineRate);
  const zone = vibZone(vib);

  // The PM window opens when the asset reaches its condition limit. This is a
  // pure consequence of how hard the line has been run — no override flag — so
  // moving the speed setpoint visibly moves the maintenance window on the plan.
  const pmStartDay = Math.max(1, Math.ceil(rulDays));
  const pmEndDay = pmStartDay + PM.durationDays - 1;
  const lostDays = Math.max(0,
    Math.min(HORIZON_DAYS, pmEndDay) - Math.max(1, pmStartDay) + 1);
  const pmInHorizon = lostDays > 0;
  const productionDays = HORIZON_DAYS - lostDays;

  if (zone.zone === 'C' || zone.zone === 'D') {
    add('filler', zone.zone === 'D' ? 0.9 : 0.45, 'ISO 20816 zone ' + zone.zone,
      `FL-02 drive vibration ${vib.toFixed(1)} mm/s RMS — ${zone.label}. Damage is accumulating ${dmgFactor.toFixed(1)}× the reference rate, so the maintenance window pulls forward to day ${pmStartDay}.`);
  }

  // ---- 7. Demand vs capacity ----------------------------------------------
  const demand = DEMAND.baseline + (p.campaignApplied ? DEMAND.campaignUplift : 0);
  const monthlyOutput = dailyOutput * productionDays;
  const coverage = demand > 0 ? (monthlyOutput / demand) * 100 : 100;
  const gap = monthlyOutput - demand;
  const shortfallUnits = Math.max(0, -gap);
  const shortfallDays = dailyOutput > 0 ? shortfallUnits / dailyOutput : 0;
  const otif = clamp(coverage, 0, 100);

  // The maintenance window only becomes critical once it costs you the month.
  if (pmInHorizon) {
    add('filler', gap < 0 ? 0.9 : 0.5, 'PM-4471',
      `Planned maintenance PM-4471 falls on days ${pmStartDay}-${Math.min(HORIZON_DAYS, pmEndDay)} of the plan and removes ${lostDays} production day${lostDays > 1 ? 's' : ''} from the month.`);
  }

  if (gap < 0) {
    add('packer', clamp(shortfallUnits / 400000, 0.4, 1), 'OTIF at risk',
      `Committed demand exceeds plan capacity by ${Math.round(shortfallUnits).toLocaleString()} units (${(100 - coverage).toFixed(1)} %). At ${dailyOutput.toLocaleString()} units/day that is ${shortfallDays.toFixed(1)} production days short.`);
  }

  // ---- 8. Materials and cost ----------------------------------------------
  const bulkKgPerUnit = 0.21;
  const consumables = {
    'Bulk emulsion': { qty: Math.round(monthlyOutput * bulkKgPerUnit / 1000), unit: 't/month' },
    'UV filter blend': { qty: Math.round(monthlyOutput * bulkKgPerUnit * 0.18 / 1000), unit: 't/month' },
    'Bottles (200 ml)': { qty: Math.round(monthlyOutput / 1000), unit: 'k/month' },
    'Closures & liners': { qty: Math.round(monthlyOutput / 1000), unit: 'k/month' },
    'Wrap labels': { qty: Math.round(monthlyOutput * (1 + rejectRate) / 1000), unit: 'k/month' },
    'Shelf-ready cases': { qty: Math.round(monthlyOutput / p.casePack / 1000), unit: 'k/month' },
    'Pallets despatched': { qty: Math.round(monthlyOutput / p.casePack / p.palletPattern), unit: '/month' },
    'CIP water': { qty: Math.round(p.cipHours * Math.max(1, p.changeovers) * productionDays * 2.4), unit: 'm³/month' },
  };

  const revenue = monthlyOutput * PRODUCT.unitPrice;
  const marginValue = monthlyOutput * PRODUCT.unitMargin;
  const lostRevenue = shortfallUnits * PRODUCT.unitPrice;
  const scrapUnits = Math.round(theoreticalPerDay * rate * availability * rejectRate * productionDays);

  // ---- 9. Station health ---------------------------------------------------
  const health = {};
  for (const st of STATIONS) {
    health[st.id] = clamp((issues[st.id] || []).reduce((m, i) => Math.max(m, i.sev), 0), 0, 1);
  }

  const util = {
    dispensing: clamp(monthlyOutput / 2_800_000, 0, 1.3),
    phases: clamp(p.batchSize / 3000, 0, 1.3),
    emulsifier: clamp(p.shearSpeed / 3000, 0, 1.3),
    qc: clamp(p.qcHours / 24, 0, 1.3),
    filler: clamp(rate, 0, 1.3),
    capper: clamp(rate * 0.98, 0, 1.3),
    labeller: clamp(rate * 0.97, 0, 1.3),
    packer: clamp(monthlyOutput / 2_800_000, 0, 1.3),
    cip: clamp(p.cipHours * Math.max(1, p.changeovers) / 6, 0, 1.3),
  };

  return {
    issues, health, util, consumables,
    kpi: {
      dailyOutput, monthlyOutput, productionDays, lostDays,
      availability: availability * 100, performance: rate * 100,
      quality: quality * 100, oee, rejectRate: rejectRate * 100,
      demand, coverage, gap, shortfallUnits, shortfallDays, otif,
      rulDays, pmStartDay, pmEndDay, pmInHorizon, damagePerDay, dmgFactor,
      vibration: vib, vibZone: zone, damageConsumed: p.damageConsumed,
      dropletUm, spfDelivery, batchRelease,
      bph: Math.round(p.ratedBpm * rate * 60),
      bpm: +(p.ratedBpm * rate).toFixed(0),
      revenue, marginValue, lostRevenue, scrapUnits,
      theoreticalPerDay,
    },
  };
}

// ---------------------------------------------------------------------------
// Plan comparison used by the ontology answer and the rate/output curve
// ---------------------------------------------------------------------------
export function planAt(p, ratePct, deferred) {
  const r = simulate({ ...p, lineRate: ratePct, maintenanceDeferred: deferred });
  return {
    rate: ratePct,
    daily: r.kpi.dailyOutput,
    monthly: r.kpi.monthlyOutput,
    productionDays: r.kpi.productionDays,
    lostDays: r.kpi.lostDays,
    rul: r.kpi.rulDays,
    pmStartDay: r.kpi.pmStartDay,
    pmInHorizon: r.kpi.pmInHorizon,
    vibration: r.kpi.vibration,
    zone: r.kpi.vibZone,
    coverage: r.kpi.coverage,
    oee: r.kpi.oee,
  };
}

/** Sweep line speed to find where the maintenance window leaves the month. */
export function rateCurve(p, from = 60, to = 105, step = 1) {
  const pts = [];
  for (let r = from; r <= to; r += step) pts.push(planAt(p, r, false));
  return pts;
}

/** The rate that maximises monthly output — the answer the ontology returns. */
export function optimalRate(p) {
  const curve = rateCurve(p, 70, 105, 1);
  let best = curve[0];
  for (const c of curve) if (c.monthly > best.monthly) best = c;
  // Prefer a defensible margin below the resonance knee rather than sitting on it:
  // 91 % is marginally higher output but leaves no headroom before the cliff.
  const safe = curve.filter(c => !c.pmInHorizon && c.rate <= DEGRADATION.kneePct - 2);
  const bestSafe = safe.length ? safe.reduce((a, b) => (b.monthly > a.monthly ? b : a)) : best;
  return { best, bestSafe, curve };
}
