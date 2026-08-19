// ===========================================================================
// RLT (Radioligand Therapy) production line — process model
// Reference product: [177Lu]Lu-PSMA-617 / [177Lu]Lu-DOTA-TATE
// Constants are calibrated against the public literature summarised in
// research.md. Demo-grade: illustrative, not validated for manufacturing.
// ===========================================================================

// halfLifeMin  — Lu-177 6.647 d [ref 3,4]; Ac-225 10.0 d (IAEA 2023) [35]; Ga-68 67.71 min [36].
// gamma        — ambient dose-rate constant, µSv/h per GBq at 1 m.
//                Lu-177 3.7 (clinical measurement incl. self-attenuation) [31];
//                positron emitters ~134 (511 keV annihilation pair).
export const ISOTOPES = {
  'Lu-177': { halfLifeMin: 9571.7, label: '¹⁷⁷Lu n.c.a. — PSMA-617 therapy', gbqPerUA: 0.95, gamma: 3.7 },
  'Ac-225': { halfLifeMin: 14400.0, label: '²²⁵Ac — targeted alpha therapy', gbqPerUA: 0.05, gamma: 5.0 },
  'Ga-68':  { halfLifeMin: 67.71,   label: '⁶⁸Ga — PSMA-11 diagnostic', gbqPerUA: 0.30, gamma: 134.0 },
  'F-18':   { halfLifeMin: 109.77,  label: '¹⁸F — FDG diagnostic', gbqPerUA: 2.20, gamma: 134.0 },
};

// Pluvicto / Lutathera administered activity per cycle: 7.4 GBq [26,27].
export const PATIENT_DOSE_GBQ = 7.4;
// Pluvicto US list price, WAC Jan 2026 [41] — used only for the value-at-risk readout.
export const DOSE_VALUE_USD = 51168;
const DOSES_PER_PACKAGE = 4;
const IDEAL_CYCLE_MIN = 180;

export const STATIONS = [
  {
    id: 'supply',
    name: 'Radionuclide Supply — Cyclotron & Generator Bunker',
    short: 'Isotope Supply',
    zone: 'Shielded bunker · CNC',
    pos: [-32, 0, -12],
    desc: 'Target irradiation and receipt of no-carrier-added radiometal. n.c.a. ¹⁷⁷Lu is produced by the ¹⁷⁶Yb(n,γ)¹⁷⁷Yb→¹⁷⁷Lu route and delivered as [¹⁷⁷Lu]LuCl₃ in dilute HCl; PET nuclides are produced on the cyclotron and pushed to the hot cells through a shielded transfer line.',
    dwellMin: 30,
    params: [
      { key: 'isotope', label: 'Radionuclide', type: 'enum', options: Object.keys(ISOTOPES),
        note: 'Half-life sets the entire logistics envelope: ¹⁷⁷Lu 6.647 d tolerates overnight shipping, ⁶⁸Ga 67.7 min does not.' },
      { key: 'beamCurrent', label: 'Beam current / source strength', unit: 'µA-eq', min: 10, max: 120, step: 1, ok: [40, 90],
        note: 'Above ~95 µA target windows run hot: foil failure and unplanned bunker entries cut availability.' },
      { key: 'targetAge', label: 'Target / generator age', unit: 'days', min: 0, max: 400, step: 5, ok: [0, 120],
        note: 'Generator ageing lowers elution yield and raises parent breakthrough (⁶⁸Ge limit < 0.001 % of ⁶⁸Ga).' },
    ],
    supplies: ['Enriched ¹⁷⁶Yb / ¹⁸O-H₂O target', 'Helium target cooling', 'Havar foils', 'Shielded Type A transport pots'],
  },
  {
    id: 'prep',
    name: 'Precursor & Buffer Preparation — Grade C',
    short: 'Precursor Prep',
    zone: 'Grade C cleanroom',
    pos: [-19, 0, -13],
    desc: 'GMP weighing of the DOTA-conjugated precursor (PSMA-617 / DOTA-TATE), the sodium-ascorbate or gentisic-acid radical scavenger, and the acetate reaction buffer. Metal-free water and low-ppb reagents are essential — Fe, Zn, Cu and Pb compete with ¹⁷⁷Lu for the DOTA cage.',
    dwellMin: 25,
    params: [
      { key: 'precursor', label: 'Precursor / molar excess', unit: 'nmol/GBq', min: 3, max: 60, step: 1, ok: [15, 25],
        note: 'Literature optimum 15–25 nmol/GBq for n.c.a. ¹⁷⁷Lu. Too little: sub-stoichiometric, free ¹⁷⁷Lu > 5 %. Too much: cold peptide dilutes molar activity and blocks the PSMA receptor.' },
      { key: 'radioprotectant', label: 'Ascorbate radical scavenger', unit: 'mg/mL', min: 0, max: 60, step: 1, ok: [15, 40],
        note: 'Evidence-based minimum effective dose ≈ 20 mg/mL sodium ascorbate; raise it proportionally above ~2 GBq/mL. Gentisic acid 0.5–1 mg/mL works synergistically.' },
      { key: 'bufferPh', label: 'Acetate buffer pH', unit: '', min: 3.0, max: 7.0, step: 0.1, ok: [4.0, 5.5],
        note: 'Below ~3.5 complexation is very slow; above ~6.0 Lu³⁺ precipitates as Lu(OH)₃ colloid. Fe/Zn/Cu must stay below ~1 ppm — they compete for the DOTA cage.' },
    ],
    supplies: ['DOTA-precursor (GMP grade)', 'Sodium ascorbate / gentisic acid', 'Ultrapure acetate buffer', 'Water for injection'],
  },
  {
    id: 'hotcell',
    name: 'Hot Cell Suite — Automated Radiolabeling',
    short: 'Hot Cell / Labeling',
    zone: 'Grade A inside lead cell',
    pos: [-5, 0, -13],
    desc: 'Three lead hot cells with master–slave manipulators and leaded-glass windows. A single-use cassette synthesis module performs the chelation, optional SPE purification, sterile filtration and dilution. Everything is remote-controlled: the operator never sees the vial directly.',
    dwellMin: 45,
    params: [
      { key: 'reactionTemp', label: 'Reaction temperature', unit: '°C', min: 40, max: 130, step: 1, ok: [80, 95],
        note: 'DOTA chelation follows Arrhenius kinetics (Eₐ ≈ 70 kJ/mol). Above ~100 °C the peptide degrades and colloids form.' },
      { key: 'reactionTime', label: 'Reaction / incubation time', unit: 'min', min: 2, max: 60, step: 1, ok: [15, 30],
        note: 'Longer incubation buys yield but costs decay and increases radiolytic exposure of the product.' },
      { key: 'shielding', label: 'Hot cell lead shielding', unit: 'mm Pb', min: 20, max: 100, step: 5, ok: [50, 75],
        note: 'Typical clinical hot cell is 50–75 mm Pb. The 208 keV line has an HVL of only 1.3 mm Pb, so residual dose at the cell face is dominated by bremsstrahlung and streaming through service penetrations — which is what this composite model represents.' },
    ],
    supplies: ['Single-use sterile cassettes', 'tC2 / C18 SPE cartridges', 'Ethanol (elution)', '0.22 µm sterilising filters'],
  },
  {
    id: 'qc',
    name: 'Quality Control Laboratory',
    short: 'QC Laboratory',
    zone: 'Grade D · analytical',
    pos: [4, 0, 9],
    desc: 'Radio-HPLC and radio-iTLC for radiochemical purity, ionisation-chamber dose calibrator for activity, HPGe gamma spectrometry for radionuclidic identity and ¹⁷⁷ᵐLu impurity, GC for residual solvents, LAL for bacterial endotoxin, plus pH, appearance and filter-integrity testing. Sterility runs after release.',
    dwellMin: 0,
    params: [
      { key: 'qcSampleRate', label: 'QC coverage', unit: '% of full panel', min: 1, max: 100, step: 1, ok: [70, 100],
        note: 'Reduced-panel or skip-lot testing releases faster but lets non-conforming batches through.' },
      { key: 'qcDwell', label: 'Analytical release time', unit: 'min', min: 5, max: 90, step: 1, ok: [20, 45],
        note: 'Every minute of testing is decay. Sterility is completed retrospectively under a parametric-release rationale.' },
      { key: 'rcpSpec', label: 'RCP release specification', unit: '%', min: 90, max: 99.5, step: 0.5, ok: [95, 98],
        note: 'Ph. Eur. / product monographs set ≥ 95 % radiochemical purity for ¹⁷⁷Lu radioligands.' },
    ],
    supplies: ['HPLC columns & mobile phase', 'iTLC-SG strips', 'LAL / endotoxin kits', 'HPGe + LN₂', 'Reference standards'],
  },
  {
    id: 'fill',
    name: 'Aseptic Dispensing & Filling Isolator — Grade A in B',
    short: 'Aseptic Filling',
    zone: 'Grade A in Grade B',
    pos: [10, 0, -13],
    desc: 'Shielded dispensing isolator under unidirectional airflow. Patient doses are aliquoted behind a lead L-block into depyrogenated vials, stoppered and crimped. Radiation containment wants negative pressure, sterility wants positive pressure — the isolator resolves that conflict with a positive-pressure chamber inside a negative-pressure room.',
    dwellMin: 30,
    params: [
      { key: 'fillSpeed', label: 'Filling speed', unit: 'vials/min', min: 1, max: 25, step: 1, ok: [3, 10],
        note: 'Patient-specific shielded dispensing realistically runs at 2–10 vials/min. Above ~15 vials/min dosing accuracy degrades — splash, under-fill and stopper misseating.' },
      { key: 'isolatorPressure', label: 'Isolator overpressure', unit: 'Pa', min: 0, max: 80, step: 1, ok: [20, 60],
        note: 'Aseptic positive-pressure isolators typically run 20–60 Pa above the surrounding room; the grade-to-grade room cascade itself is 10–15 Pa (Annex 1 2022). Below 80 Pa avoids glove fatigue and leaks.' },
      { key: 'fillVolume', label: 'Fill volume per dose', unit: 'mL', min: 5, max: 40, step: 1, ok: [15, 30],
        note: 'Fill volume sets activity concentration. Labelling runs at 1–5 GBq/mL; above ~5 GBq/mL radiolysis accelerates unless the scavenger is raised proportionally.' },
    ],
    supplies: ['Depyrogenated Type I glass vials', 'Bromobutyl stoppers + Al crimps', 'Sterile gloves & sleeves', 'VHP decontamination'],
  },
  {
    id: 'inspect',
    name: 'Visual Inspection & Serialised Labelling',
    short: 'Inspect & Label',
    zone: 'Grade D',
    pos: [24, 0, -13],
    desc: '100 % inspection for particulates, cracks, fill level and closure integrity, performed behind leaded glass or by automated vision to keep operator dose down. Labels carry the batch number, the activity and the calibration date/time — the dose is only correct at one instant.',
    dwellMin: 20,
    params: [
      { key: 'inspectRigor', label: 'Inspection detection rate', unit: '%', min: 50, max: 99.9, step: 1, ok: [95, 99.9],
        note: 'Manual human inspection typically detects 70–85 % of defects; automated vision systems reach 95–99 %.' },
      { key: 'staff', label: 'Operators on shift', unit: 'FTE', min: 1, max: 12, step: 1, ok: [4, 8],
        note: 'Each additional person in the clean area adds a particulate and microbial source; too few slows deviation response.' },
    ],
    supplies: ['Serialised GMP labels', 'Leaded viewing glass', 'Electronic dosimeters', 'Reject quarantine bin'],
  },
  {
    id: 'pack',
    name: 'Shielded Packaging & Cold-Chain Dispatch',
    short: 'Packaging & Dispatch',
    zone: 'CNC · dispatch dock',
    pos: [22, 0, 9],
    desc: 'Doses are loaded into tungsten or lead pots, placed in IATA Class 7 Type A packages with the transport index measured and declared, and released to couriers against a patient-specific delivery slot at the nuclear medicine department.',
    dwellMin: 25,
    params: [
      { key: 'potShielding', label: 'Transport pot shielding', unit: 'mm Pb-eq', min: 5, max: 60, step: 1, ok: [15, 45],
        note: 'Type A packages must stay ≤ 2 mSv/h at the surface; the transport index (dose rate at 1 m in mSv/h × 100) drives the shipping category.' },
      { key: 'shipLead', label: 'Dispatch → administration', unit: 'min', min: 30, max: 900, step: 15, ok: [60, 360],
        note: 'The dose must still meet its calibrated activity when the patient is injected — decay during transport is a hard constraint.' },
    ],
    supplies: ['Tungsten dose pots', 'Type A packaging', 'Temperature loggers', 'Class 7 labels & TI declaration'],
  },
  {
    id: 'utilities',
    name: 'Cleanroom Utilities — HVAC, HEPA & Waste Decay',
    short: 'Utilities & Waste',
    zone: 'Technical area',
    pos: [-17, 0, 9],
    desc: 'Air handling with H14 HEPA and activated-charcoal filtration, the pressure cascade between grades, the shielded inter-cell transfer line, and decay-in-storage of radioactive liquid and solid waste until it clears the clearance level.',
    dwellMin: 0,
    params: [
      { key: 'airChanges', label: 'Air changes per hour', unit: 'ACH', min: 5, max: 80, step: 1, ok: [20, 40],
        note: 'Grade B/C non-unidirectional areas are typically designed for 20–40 ACH to meet the required recovery time; Grade A relies on 0.36–0.54 m/s unidirectional airflow instead.' },
      { key: 'hepaAge', label: 'HEPA filter service age', unit: 'months', min: 0, max: 48, step: 1, ok: [0, 24],
        note: 'Filter integrity is re-tested periodically; loaded or leaking filters show up first as viable and non-viable excursions.' },
      { key: 'conveyorSpeed', label: 'Transfer line speed', unit: 'm/min', min: 0.5, max: 12, step: 0.1, ok: [1.5, 4],
        note: 'Over-speeding the shielded transfer conveyor tips vials and misaligns stoppers — a classic mechanical defect source.' },
    ],
    supplies: ['H14 HEPA filters', 'Activated charcoal filters', 'Decay-in-storage drums', 'Delay tanks'],
  },
];

export const DEFAULTS = {
  isotope: 'Lu-177',
  beamCurrent: 65, targetAge: 40,
  precursor: 20, radioprotectant: 22, bufferPh: 4.5,
  reactionTemp: 90, reactionTime: 22, shielding: 75,
  qcSampleRate: 85, qcDwell: 35, rcpSpec: 95,
  fillSpeed: 8, isolatorPressure: 35, fillVolume: 20,
  inspectRigor: 97, staff: 6,
  potShielding: 30, shipLead: 240,
  airChanges: 32, hepaAge: 10, conveyorSpeed: 2.5,
};

export const PRESETS = {
  nominal: {},
  optimum: {
    beamCurrent: 90, targetAge: 5,
    precursor: 20, radioprotectant: 38, bufferPh: 4.5,
    reactionTemp: 95, reactionTime: 20, shielding: 75,
    qcSampleRate: 100, qcDwell: 26, rcpSpec: 95,
    fillSpeed: 10, isolatorPressure: 50, fillVolume: 24,
    inspectRigor: 99, staff: 7,
    potShielding: 42, shipLead: 90,
    airChanges: 38, hepaAge: 1, conveyorSpeed: 3.6,
  },
  stress: {
    beamCurrent: 112, targetAge: 320,
    precursor: 5, radioprotectant: 1, bufferPh: 6.4,
    reactionTemp: 62, reactionTime: 5, shielding: 25,
    qcSampleRate: 10, qcDwell: 8, rcpSpec: 98,
    fillSpeed: 24, isolatorPressure: 4, fillVolume: 6,
    inspectRigor: 62, staff: 2,
    potShielding: 6, shipLead: 780,
    airChanges: 9, hepaAge: 44, conveyorSpeed: 10,
  },
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const gauss = (x, mu, s) => Math.exp(-((x - mu) ** 2) / (2 * s * s));

// Arrhenius rate for DOTA chelation, normalised to 95 °C.
const R_GAS = 8.314, EA = 70000, T_REF = 368.15, K_REF = 0.35;
const chelationRate = (tempC) =>
  K_REF * Math.exp(-(EA / R_GAS) * (1 / (tempC + 273.15) - 1 / T_REF));

// Combined transmission through lead. The 208 keV gamma has an HVL of ~1.3 mm Pb,
// so at realistic hot-cell thicknesses the residual field is entirely bremsstrahlung
// and streaming through service penetrations — the second term is that composite,
// empirical contribution, not a pure HVL calculation.
const leadTransmission = (mm, streamAmp = 1.2e-2, streamHVL = 16, gammaHVL = 1.3) =>
  Math.pow(2, -mm / gammaHVL) + streamAmp * Math.pow(2, -mm / streamHVL);

export function simulate(p) {
  const iso = ISOTOPES[p.isotope];
  const issues = {};
  const add = (id, sev, ref, text) => (issues[id] = issues[id] || []).push({ sev, ref, text });

  // ---- 1. Activity available at start of synthesis ------------------------
  const targetDecay = Math.exp(-p.targetAge / 260);
  const activityEOB = p.beamCurrent * iso.gbqPerUA * targetDecay * 3.4;
  if (p.targetAge > 150) {
    add('supply', clamp((p.targetAge - 150) / 250, 0.35, 0.9), 'Ph. Eur. 2464',
      `Target / generator age ${p.targetAge} d — elution yield down ${(100 * (1 - targetDecay)).toFixed(0)} % and parent breakthrough climbing toward the 0.001 % limit.`);
  }
  if (p.beamCurrent > 95) {
    add('supply', clamp((p.beamCurrent - 95) / 40, 0.3, 0.75), 'OEE / availability',
      `Beam current ${p.beamCurrent} µA above the qualified window — target foil thermal stress, unplanned bunker entries and lost availability.`);
  }

  // ---- 2. Radiolabeling chemistry ----------------------------------------
  const kT = chelationRate(p.reactionTemp);
  const precFactor = p.precursor / (p.precursor + 6);
  const phFactor = gauss(p.bufferPh, 4.5, 0.62);
  const kEff = kT * precFactor * phFactor;
  const incorporation = 1 - Math.exp(-kEff * p.reactionTime);
  const thermalDegrad = p.reactionTemp > 100 ? (p.reactionTemp - 100) * 0.012 : 0;
  const rcy = clamp(incorporation * (1 - thermalDegrad), 0, 0.999);

  if (p.reactionTemp < 80) {
    add('hotcell', clamp((80 - p.reactionTemp) / 40, 0.35, 1), 'Arrhenius Eₐ ≈ 70 kJ/mol',
      `Reaction at ${p.reactionTemp} °C: chelation rate constant is only ${(100 * kT / K_REF).toFixed(0)} % of the 95 °C value — incorporation ${(incorporation * 100).toFixed(1)} %.`);
  }
  if (p.reactionTemp > 102) {
    add('hotcell', clamp((p.reactionTemp - 102) / 28, 0.4, 1), 'Peptide stability',
      `Reaction at ${p.reactionTemp} °C: thermal degradation of the DOTA-peptide and colloid formation, losing ${(thermalDegrad * 100).toFixed(1)} % of product.`);
  }
  if (p.reactionTime < 12 && incorporation < 0.97) {
    add('hotcell', clamp((12 - p.reactionTime) / 12, 0.35, 0.9), 'Incomplete labelling',
      `${p.reactionTime} min incubation gives only ${(incorporation * 100).toFixed(1)} % incorporation — unbound ¹⁷⁷Lu³⁺ will appear in the final vial.`);
  }
  if (p.bufferPh < 3.8 || p.bufferPh > 5.2) {
    add('prep', clamp(Math.abs(p.bufferPh - 4.5) / 2, 0.35, 1), 'Chelation window pH 4.0–5.0',
      p.bufferPh > 5.2
        ? `Buffer pH ${p.bufferPh.toFixed(1)}: Lu³⁺ hydrolyses to colloidal hydroxide instead of entering the DOTA cage (pH factor ${(phFactor * 100).toFixed(0)} %).`
        : `Buffer pH ${p.bufferPh.toFixed(1)}: the chelator is protonated, complexation kinetics collapse (pH factor ${(phFactor * 100).toFixed(0)} %).`);
  }
  if (p.precursor < 10) {
    add('prep', clamp((10 - p.precursor) / 8, 0.4, 1), 'Molar excess',
      `Precursor ${p.precursor} nmol/GBq is sub-stoichiometric — trace Fe/Zn/Cu compete for the chelator and free ¹⁷⁷Lu ends up in the product.`);
  }

  // ---- 3. Radiolysis and purity ------------------------------------------
  const activityConc = PATIENT_DOSE_GBQ / p.fillVolume;
  const protect = p.radioprotectant / (p.radioprotectant + 8);
  const radiolysis = clamp(8.0 * activityConc * (1 - protect) * (0.65 + p.reactionTime / 60), 0, 22);
  const unreacted = (1 - rcy) * 100;
  const coldImpurity = clamp((p.precursor - 30) * 0.05, 0, 2.5);
  const colloid = thermalDegrad * 45 + (p.bufferPh > 5.5 ? (p.bufferPh - 5.5) * 3.2 : 0);
  const rcp = clamp(99.9 - radiolysis - unreacted - coldImpurity - colloid, 45, 99.9);
  const molarActivity = p.precursor > 0 ? 1000 / p.precursor : 0;

  if (radiolysis > 1.2) {
    add('prep', clamp(radiolysis / 8, 0.35, 1), 'Radiolytic degradation',
      `Radiolysis is costing ${radiolysis.toFixed(1)} % purity: ${activityConc.toFixed(2)} GBq/mL with only ${p.radioprotectant} mg/mL ascorbate. Dilute the dose or add scavenger.`);
  }
  if (coldImpurity > 0.6) {
    add('prep', 0.35, 'Molar activity',
      `${p.precursor} nmol/GBq of cold precursor drops molar activity to ${molarActivity.toFixed(0)} GBq/µmol — unlabelled peptide competes for the PSMA receptor.`);
  }

  // ---- 4. Line timing and decay ------------------------------------------
  const transferMin = 140 / p.conveyorSpeed;
  const stationMin = STATIONS.reduce((s, st) => s + st.dwellMin, 0);
  const fillMin = (PATIENT_DOSE_GBQ > 0 ? 1 : 1) * (60 / p.fillSpeed) * 4;
  const cycleMin = transferMin + stationMin + p.qcDwell + p.reactionTime + fillMin;
  const totalMin = cycleMin + p.shipLead;
  const decayRetained = Math.pow(0.5, totalMin / iso.halfLifeMin);
  const decayLossPct = 100 * (1 - decayRetained);

  if (decayLossPct > 15) {
    add('pack', clamp(decayLossPct / 55, 0.3, 1), 'Calibration window',
      `${decayLossPct.toFixed(1)} % of the activity decays between end of synthesis and administration (${(totalMin / 60).toFixed(1)} h against a ${(iso.halfLifeMin / 60).toFixed(1)} h half-life). Doses risk missing their calibrated activity.`);
  }
  if (iso.halfLifeMin < 200 && p.shipLead > 180) {
    add('pack', 0.85, 'Distribution radius',
      `A ${iso.halfLifeMin.toFixed(0)} min half-life nuclide cannot absorb a ${p.shipLead} min dispatch leg — this product must be made on site.`);
  }

  // ---- 5. Defect generation ----------------------------------------------
  const speedStress = p.conveyorSpeed > 4 ? Math.pow(p.conveyorSpeed - 4, 1.55) * 1.5 : 0;
  const fillStress = p.fillSpeed > 15 ? Math.pow(p.fillSpeed - 15, 1.4) * 0.85 : 0;
  const staffStress = p.staff < 4 ? (4 - p.staff) * 2.4 : 0;
  const crowding = p.staff > 8 ? (p.staff - 8) * 0.8 : 0;

  const pressureFail = p.isolatorPressure < 20 ? (20 - p.isolatorPressure) * 0.85 : 0;
  const achFail = p.airChanges < 20 ? (20 - p.airChanges) * 0.55 : 0;
  const hepaFail = p.hepaAge > 24 ? (p.hepaAge - 24) * 0.3 : 0;
  const contamination = clamp(pressureFail + achFail + hepaFail + crowding * 0.6, 0, 45);

  const mechanical = clamp(0.35 + speedStress + fillStress + staffStress + crowding, 0, 60);
  const chemical = clamp((99.9 - rcp) * 0.5, 0, 45);
  const grossErrorRate = clamp(mechanical + chemical * 0.55 + contamination * 0.5, 0, 94);

  if (speedStress > 0.8) {
    add('utilities', clamp(speedStress / 12, 0.3, 1), 'Validated 4 m/min',
      `Transfer speed ${p.conveyorSpeed.toFixed(1)} m/min exceeds the validated 4 m/min — vial tipping and stopper misalignment add ${speedStress.toFixed(1)} % defects.`);
  }
  if (fillStress > 0.8) {
    add('fill', clamp(fillStress / 10, 0.3, 1), 'Dosing accuracy',
      `Filling at ${p.fillSpeed} vials/min: shielded dispensing loses dosing accuracy above ~15 vials/min — splash and under-fill add ${fillStress.toFixed(1)} % rejects.`);
  }
  if (pressureFail > 0) {
    add('fill', clamp(pressureFail / 12, 0.45, 1), 'EU GMP Annex 1',
      `Isolator overpressure only ${p.isolatorPressure} Pa — a positive-pressure Grade A isolator needs a demonstrable cascade (typically 20–60 Pa). Sterility assurance is compromised.`);
  }
  if (achFail + hepaFail > 0) {
    add('utilities', clamp((achFail + hepaFail) / 10, 0.3, 1), 'EU GMP Annex 1',
      `Air handling out of spec — ${p.airChanges} ACH and HEPA filters ${p.hepaAge} months in service. Recovery time and viable-particle limits will not hold.`);
  }
  if (staffStress > 0) {
    add('inspect', clamp(staffStress / 7, 0.3, 0.95), 'Manual handling',
      `Only ${p.staff} FTE on shift — manual handling errors rise and deviation response slows.`);
  }
  if (crowding > 0) {
    add('inspect', clamp(crowding / 3, 0.25, 0.6), 'Personnel as contamination source',
      `${p.staff} operators in the clean area: every additional gowned person is a particulate and microbial source.`);
  }

  // ---- 6. QC detection ----------------------------------------------------
  const detection = clamp((p.qcSampleRate / 100) * 0.7 + (p.inspectRigor / 100) * 0.3, 0, 0.995);
  const escapedDefects = grossErrorRate * (1 - detection);
  const scrapRate = grossErrorRate * detection;
  const rcpFail = rcp < p.rcpSpec;

  if (rcpFail) {
    add('qc', 1, 'Ph. Eur. RCP ≥ 95 %',
      `BATCH REJECTED — radiochemical purity ${rcp.toFixed(1)} % is below the ${p.rcpSpec} % release specification. Whole batch to decay-in-storage.`);
  }
  if (escapedDefects > 0.5) {
    add('qc', clamp(escapedDefects / 6, 0.4, 1), 'Detection capability',
      `QC coverage ${p.qcSampleRate} % and ${p.inspectRigor} % inspection let ${escapedDefects.toFixed(2)} % of defective doses reach release — a patient-safety and regulatory exposure.`);
  }
  if (p.qcDwell > 50 && iso.halfLifeMin < 400) {
    add('qc', 0.7, 'Decay during release',
      `${p.qcDwell} min of analytical release burns ${(100 * (1 - Math.pow(0.5, p.qcDwell / iso.halfLifeMin))).toFixed(0)} % of a short-lived batch.`);
  }
  if (p.qcSampleRate < 50) {
    add('qc', clamp((50 - p.qcSampleRate) / 50, 0.35, 0.9), 'ICH Q9 risk',
      `QC coverage reduced to ${p.qcSampleRate} % of the full release panel — identity, RCP, endotoxin and residual solvent testing are not all being performed.`);
  }

  // ---- 7. Output ----------------------------------------------------------
  const usable = activityEOB * rcy * decayRetained * (1 - scrapRate / 100);
  const dosesPerBatch = rcpFail ? 0 : Math.max(0, Math.floor(usable / PATIENT_DOSE_GBQ));
  const batchesPerDay = clamp((24 * 60) / Math.max(90, cycleMin), 0.2, 8);
  const dosesPerDay = dosesPerBatch * batchesPerDay;

  // OEE = availability × performance × quality
  const availability = clamp(0.96
    - (p.beamCurrent > 95 ? (p.beamCurrent - 95) * 0.004 : 0)
    - (p.hepaAge > 24 ? (p.hepaAge - 24) * 0.004 : 0)
    - (p.staff < 4 ? (4 - p.staff) * 0.05 : 0), 0.25, 0.98);
  const performance = clamp(IDEAL_CYCLE_MIN / Math.max(IDEAL_CYCLE_MIN, cycleMin), 0.15, 1);
  const qualityRate = clamp((1 - grossErrorRate / 100) * rcy * (rcpFail ? 0.03 : 1), 0, 1);
  const oee = clamp(availability * performance * qualityRate * 100, 0, 100);

  // Value realised vs value destroyed by scrap, rejected batches and decay.
  const idealDoses = activityEOB / PATIENT_DOSE_GBQ * batchesPerDay;
  const revenuePerDay = dosesPerDay * DOSE_VALUE_USD;
  const valueLostPerDay = Math.max(0, idealDoses - dosesPerDay) * DOSE_VALUE_USD;

  // ---- 8. Consumables -----------------------------------------------------
  const rework = 1 + (grossErrorRate / 100) * 1.7;
  const consumables = {
    'Synthesis cassettes': { qty: Math.ceil(batchesPerDay * rework), unit: '/day' },
    'Sterile vials': { qty: Math.ceil(dosesPerDay * rework * 1.06), unit: '/day' },
    '0.22 µm filters': { qty: Math.ceil(batchesPerDay * 2 * rework), unit: '/day' },
    'HPLC / iTLC runs': { qty: Math.ceil(batchesPerDay * (p.qcSampleRate / 100) * 7), unit: '/day' },
    'Ascorbate scavenger': { qty: +((p.radioprotectant * p.fillVolume * dosesPerDay) / 1000).toFixed(1), unit: 'g/day' },
    'Tungsten dose pots': { qty: Math.ceil(dosesPerDay), unit: '/day' },
    'Radioactive waste': { qty: +(batchesPerDay * (2.2 + grossErrorRate / 10)).toFixed(1), unit: 'L/day' },
    'HEPA / charcoal load': { qty: Math.round(p.airChanges * 1.9), unit: '% of design' },
  };

  // ---- 9. Radiation protection -------------------------------------------
  const contactGeom = iso.gamma / 0.09; // µSv/h per GBq at 0.3 m
  const doseRate = clamp(activityEOB * contactGeom * leadTransmission(p.shielding), 0, 50000);
  if (doseRate > 7.5) {
    add('hotcell', clamp(doseRate / 120, 0.35, 1), 'ALARA / 20 mSv per year',
      `Contact dose rate ${doseRate.toFixed(1)} µSv/h at the cell face with ${p.shielding} mm Pb — operators would exceed their ALARA budget within a shift.`);
  }
  const pkgActivity = DOSES_PER_PACKAGE * PATIENT_DOSE_GBQ * decayRetained;
  const potAt1m = pkgActivity * iso.gamma * leadTransmission(p.potShielding, 0.25, 9);
  const tiPot = potAt1m / 10; // µSv/h at 1 m → mSv/h × 100
  const surfaceDose = potAt1m * 11;
  if (tiPot > 1) {
    add('pack', clamp(tiPot / 10, 0.35, 1), 'IATA DGR Class 7',
      `Transport index ${tiPot.toFixed(2)} (surface ${surfaceDose.toFixed(0)} µSv/h) at ${p.potShielding} mm Pb-eq — above the yellow-II category limit of TI 1.0. Limits are 2 mSv/h at the surface and 0.1 mSv/h at 1 m.`);
  }

  // ---- 10. Station utilisation -------------------------------------------
  const util = {
    supply: clamp(p.beamCurrent / 100, 0, 1.3),
    prep: clamp(batchesPerDay / 5, 0, 1.3),
    hotcell: clamp((p.reactionTime + 45) / 90, 0, 1.3),
    qc: clamp((p.qcSampleRate / 100) * (p.qcDwell / 32), 0, 1.4),
    fill: clamp(dosesPerBatch / (p.fillSpeed * 25), 0, 1.4),
    inspect: clamp(dosesPerDay / (p.staff * 22), 0, 1.4),
    pack: clamp(dosesPerDay / 90, 0, 1.3),
    utilities: clamp(p.airChanges / 55, 0, 1.3),
  };

  const health = {};
  for (const st of STATIONS) {
    health[st.id] = clamp((issues[st.id] || []).reduce((m, i) => Math.max(m, i.sev), 0), 0, 1);
  }

  return {
    issues, health, util, consumables,
    kpi: {
      activityEOB, rcy: rcy * 100, rcp, molarActivity, activityConc,
      decayLossPct, cycleMin, transferMin, totalMin,
      grossErrorRate, escapedDefects, scrapRate, contamination,
      dosesPerBatch, dosesPerDay, batchesPerDay,
      oee, availability: availability * 100, performance: performance * 100, qualityRate: qualityRate * 100,
      doseRate, tiPot, surfaceDose, rcpFail, detection: detection * 100,
      radiolysis, incorporation: incorporation * 100,
      revenuePerDay, valueLostPerDay,
    },
  };
}
