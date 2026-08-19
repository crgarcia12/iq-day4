# Radioligand Therapy Production Line — Research Compendium
## For: IQ-Day4 Conference Digital Twin Demo
### Reference Products: [¹⁷⁷Lu]Lu-PSMA-617 (Pluvicto®), [¹⁷⁷Lu]Lu-DOTATATE (Lutathera®)
**Prepared:** August 2026  
**Status:** Research only — do not modify production code

---

## Table of Contents

1. [Executive Summary for the Demo](#1-executive-summary-for-the-demo)
2. [Model Calibration Table](#2-model-calibration-table)
3. [Terminology & Market Overview](#3-terminology--market-overview)
4. [Radionuclide Data](#4-radionuclide-data)
5. [Production Equipment](#5-production-equipment)
6. [Radiolabeling Chemistry](#6-radiolabeling-chemistry)
7. [Radiolysis and Stabilisers](#7-radiolysis-and-stabilisers)
8. [Cleanroom / GMP / Aseptic Requirements](#8-cleanroom--gmp--aseptic-requirements)
9. [Quality Attributes & Failure Modes](#9-quality-attributes--failure-modes)
10. [Time, Decay & Logistics Economics](#10-time-decay--logistics-economics)
11. [Radiation Protection](#11-radiation-protection)
12. [Throughput / OEE / Industrial Metrics](#12-throughput--oee--industrial-metrics)
13. [Digital Twin & Industry 4.0 Justification](#13-digital-twin--industry-40-justification)
14. [Discrepancies vs. Current sim.js Assumptions](#14-discrepancies-vs-current-simjs-assumptions)
15. [Reference List](#15-reference-list)

---

## 1. Executive Summary for the Demo

This document provides the scientific and regulatory foundation for a 3D command-centre digital twin simulating commercial-scale radioligand therapy (RLT) manufacturing. The primary reference product is **[¹⁷⁷Lu]Lu-PSMA-617 (Pluvicto®, Novartis)** at **7.4 GBq per patient dose**, with secondary reference to **[¹⁷⁷Lu]Lu-DOTATATE (Lutathera®)**, both administered intravenously.

The simulation models eight stations: isotope supply → precursor/buffer prep (Grade C) → hot cell radiolabeling (Grade A in shielded cell) → QC laboratory → aseptic filling isolator (Grade A in B) → visual inspection → shielded packaging/dispatch → utilities/HVAC. Key performance indicators include radiochemical yield (RCY, target ≥95%), radiochemical purity (RCP, release spec ≥95%), doses per batch, cycle time, OEE, decay loss %, and radiation dose rate.

Novartis operates four commercial Pluvicto production sites (Millburn NJ, Indianapolis IN, Ivrea Italy, Zaragoza Spain) with a combined stated capacity of ~250,000 doses/year [1][2]. Global demand for ¹⁷⁷Lu-labelled therapeutics is doubling each year as new indications emerge. The demo positions the digital twin as a **Pharma 4.0 / ICH Q13** tool enabling real-time process optimisation, predictive quality analytics, and supply-chain transparency for this strategically critical class of medicines.

---

## 2. Model Calibration Table

> **Most important section for simulation tuning.** All parameters below are drawn from peer-reviewed literature and regulatory guidance. "Out-of-range effect" describes what the physics/process model should produce when the parameter deviates. Citation numbers refer to the Reference List in §15.

| # | Parameter | Realistic Range | Nominal / Optimum | Out-of-Range Effect | Ref |
|---|-----------|----------------|-------------------|---------------------|-----|
| 1 | Lu-177 half-life | 6.6443–6.647 d | **6.647 d = 9,571.7 min** | Incorrect decay calculations, wrong calibration activity | [3][4] |
| 2 | Lu-177 specific activity (n.c.a.) | 3,200–4,110 GBq/mg | **~3,320 GBq/mg (achieved); 4,110 GBq/mg theoretical max** | Lower SA forces higher peptide/Lu ratio → poor molar activity | [5][6] |
| 3 | Reaction temperature (DOTA-Lu) | 70–100 °C | **95 °C** (classical); 80 °C (thermosensitive peptides) | <75 °C: slow kinetics, RCY <85%; >110 °C: peptide thermal degradation, colloid formation | [7][8][9] |
| 4 | Reaction time | 5–30 min | **15–25 min** at 95 °C | <8 min: incomplete labeling, free ¹⁷⁷Lu in product; >30 min: diminishing returns + radiolysis | [7][9] |
| 5 | Buffer pH (acetate/ascorbate) | 3.5–6.0 | **4.0–5.5 (optimum 4.5)** | <3.5: very slow complexation; >6.0: Lu(OH)₃ colloid precipitation | [8][10] |
| 6 | Precursor amount | 3–100 nmol/GBq | **15–25 nmol/GBq** (n.c.a.) | <10 nmol/GBq: sub-stoichiometric, free ¹⁷⁷Lu >5%; >50 nmol/GBq: excess cold peptide lowers specific activity | [11][12] |
| 7 | Radiochemical yield (RCY) | 85–99.8% | **≥95%** | <85%: batch rejection risk, high free ¹⁷⁷Lu; <90%: purification step needed | [7][9][12] |
| 8 | RCP release specification | 95–99.5% | **≥95%** (Ph. Eur., USP <825>) | <95%: mandatory batch rejection; patient safety risk from colloidal ¹⁷⁷Lu | [13][14] |
| 9 | Sodium ascorbate concentration | 5–50 mg/mL | **20 mg/mL** (effective); up to 40 mg/mL for high-activity concentrations | <5 mg/mL at >2 GBq/mL: radiolytic degradation; >40 mg/mL: risk of antioxidant chemical impurity | [15][16] |
| 10 | Gentisic acid (if used) | 0.5–5 mg/mL | **0.5–1 mg/mL (≈2.7–5.4 mM)** | Combination with ascorbate more effective than either alone | [16][17] |
| 11 | Activity concentration (labeling) | 0.5–10 GBq/mL | **1–5 GBq/mL** | >5 GBq/mL: accelerated radiolysis unless stabilizer is increased proportionally | [15][18] |
| 12 | Shelf life / RCP at t=24 h | >90% at 24 h | **≥95% at 24 h at RT** with 20 mg/mL ascorbate | Without stabilizer: RCP can fall below 90% within 12 h at >3 GBq/mL | [15][16] |
| 13 | Metal impurity tolerance (Fe, Zn, Cu) | ppm level critical | **<1 ppm Fe, Zn, Cu in buffer** | Even trace Cu²⁺/Zn²⁺ at µmol level competes with Lu³⁺ for DOTA, causing RCY loss | [10][19] |
| 14 | Hot cell Pb shielding (¹⁷⁷Lu) | 25–100 mm Pb | **50–75 mm Pb** (typical clinical hot cell) | HVL for 208 keV = 1.3 mm Pb; 6-HVL = ~8 mm; 50 mm gives ~10⁻¹⁵ × attenuation (>> needed) | [20][21] |
| 15 | Grade A particle limit (0.5 µm) at rest | ≤3,520 / m³ | **≤3,520 / m³** | Exceedance: investigate contamination source; product at risk | [22] |
| 16 | Grade A particle limit (5 µm) in operation | ≤20 / m³ | **≤20 / m³** | Any detection triggers investigation (Annex 1 2022) | [22] |
| 17 | Grade B air changes per hour | ≥20 ACH | **20–40 ACH** (typical 25–35 ACH) | <20 ACH: particle and viable particle excursions; regulatory non-compliance | [22][23] |
| 18 | Pressure differential between grades | 10–15 Pa | **10–15 Pa** | <10 Pa: cross-contamination risk between grade zones | [22] |
| 19 | Isolator overpressure (Grade A, aseptic) | 15–80 Pa | **20–60 Pa** (typical aseptic isolator) | <15 Pa: sterility assurance compromised; >80 Pa: glove fatigue, leak risk | [22][23][24] |
| 20 | Unidirectional airflow velocity (Grade A) | 0.36–0.54 m/s | **0.45 m/s** | <0.36 m/s: loss of unidirectional flow; turbulent zone; ISO 14644 non-compliance | [22] |
| 21 | VHP decontamination cycle time | 1.5–4 h | **~2.5 h** (full 6-log reduction cycle) | Insufficient dwell: SAL > 10⁻⁶; too long: material compatibility risk | [24][25] |
| 22 | Patient dose [¹⁷⁷Lu]Lu-PSMA-617 | 5.9–7.4 GBq | **7.4 GBq (200 mCi)** per infusion, q6w × 6 | <5.9 GBq: reduced efficacy; >7.4 GBq: increased toxicity risk | [26] |
| 23 | Patient dose [¹⁷⁷Lu]Lu-DOTATATE | 7.4 GBq | **7.4 GBq (200 mCi)** per infusion, q8w × 4 | Dose reduction to 3.7 GBq if grade 3+ haematologic toxicity | [27] |
| 24 | Endotoxin limit (IV radiopharmaceutical) | ≤175 EU/max dose | **≤175 EU/vial; ≤5 EU/mL** (general IV standard) | Exceedance: mandatory batch rejection; pyrogenic reaction risk | [28][29] |
| 25 | QC release time (before administration) | 30–90 min | **30–60 min** (RCP, pH, activity, endotoxin rapid test) | <30 min: incomplete QC; >60 min: activity lost to decay (especially short T½ products) | [30] |
| 26 | Sterility test result | Retrospective 14 d | **Parametric release** (pre-validated aseptic process) | Sterility failure → product recall; parametric release requires extensive process validation | [28][29][30] |
| 27 | Lu-177 dose rate constant (1 m) | 0.0024–0.0058 mSv/h·GBq | **0.0037 mSv/h·GBq at 1 m** (clinical measurement, includes self-attenuation) | Higher values from tables assume no self-attenuation | [31] |
| 28 | Lu-177 half-value layer (208 keV, Pb) | ~1.3 mm | **1.3 mm Pb** | 50 mm Pb ≈ 38 HVLs ≈ dose-rate factor 2.7 × 10⁻¹¹ | [20][21] |
| 29 | Lu-177 half-value layer (113 keV, Pb) | ~0.5 mm | **0.5 mm Pb** | More easily shielded than 208 keV component | [20][21] |
| 30 | Lu-177 transport A2 value | 0.8 TBq | **0.8 TBq (22 Ci)** for Type A (normal form) | Exceeding A2 requires Type B package; IATA DGR 10 | [32] |
| 31 | Package surface dose rate limit | ≤2 mSv/h surface | **≤2 mSv/h** surface; **≤0.1 mSv/h** at 1 m | Exceedance: package rejected by carrier; IATA Class 7 non-compliance | [32] |
| 32 | OEE (sterile aseptic filling line) | 23–65% | **35–50%** (radiopharmaceutical-specific shielded line) | Industry median non-radiopharma sterile = 23–40%; world-class = 60–78% | [33][34] |
| 33 | Vial filling speed (shielded radiopharma) | 1–15 vials/min | **2–10 vials/min** (patient-specific dose verification) | >15 vials/min: dosing accuracy degradation, splash, underfill, increased rejects | [33] |
| 34 | Novartis capacity (all 4 sites) | ~250,000 doses/yr | **~250,000 doses/yr** as of 2024 | Limited by Lu-177 supply (ORANO/Isotopia/ITM/NorthStar) and GMP throughput | [1][2] |
| 35 | Ac-225 half-life | 9.92–10.0 d | **10.0 days = 14,400 min** (IAEA 2023) | Incorrect half-life → wrong decay/yield calculations for TAT products | [35] |
| 36 | Ga-68 half-life | 67.71 min | **67.71 min** | Standard value; generator elution timing critical | [36] |
| 37 | Ge-68 breakthrough limit (generator) | ≤0.001% | **≤0.001% of eluted ⁶⁸Ga** (Ph. Eur. 2464) | Exceeds limit: generator rejected; Ge-68 is a long-lived (271 d) impurity | [37][38] |
| 38 | F-18 cyclotron yield | 1.5–3.5 GBq/µA·h | **2–3 GBq/µA·h** at target (EOB, uncorrected) | Lower yield at higher beam currents (target saturation/window damage) | [39] |
| 39 | ¹⁷⁷mLu impurity limit (Ph. Eur.) | ≤0.02% at calibration | **≤0.02% (200 ppm)** of total ¹⁷⁷Lu activity | Direct-route CA product often 500–700 ppm → fails Ph. Eur. spec without NCA route | [4][40] |
| 40 | Pluvicto US list price | ~$49,989–$53,434/dose | **~$51,168 WAC** (Jan 2026) | Informs cost-per-dose output in simulation economics | [41] |

---

## 3. Terminology & Market Overview

### 3.1 Definitions

**Radioligand Therapy (RLT)** — a targeted form of radiation therapy combining a cancer-targeting ligand (antibody, peptide, small molecule) with a therapeutic radionuclide, delivered systemically. The ligand guides the radionuclide to tumour-expressing receptor targets [42].

**Radiopharmaceutical Therapy (RPT)** — the broader umbrella term used by the FDA and SNMMI encompassing all forms of targeted radionuclide therapy (TRT) including RLT, peptide receptor radionuclide therapy (PRRT), and radioimmunotherapy (RIT) [42][43].

**Peptide Receptor Radionuclide Therapy (PRRT)** — a specific subclass of RPT using radiolabelled somatostatin analogues (octreotate, octreotide) targeting somatostatin receptors on NETs; the paradigm product is [¹⁷⁷Lu]Lu-DOTATATE (Lutathera®) [27].

**Targeted Radionuclide Therapy (TRT)** — synonym for RPT; historical term still used in some European literature.

### 3.2 Approved Products (Global, as of 2026)

| Product | INN | Target | Radionuclide | Indication | FDA Approval |
|---------|-----|--------|-------------|-----------|-------------|
| Pluvicto® | lutetium Lu 177 vipivotide tetraxetan | PSMA | ¹⁷⁷Lu | mCRPC | Mar 2022 [26] |
| Lutathera® | lutetium Lu 177 dotatate | SSTR2 | ¹⁷⁷Lu | GEP-NETs | Jan 2018 [27] |
| Xofigo® | radium Ra 223 dichloride | Bone-seeking | ²²³Ra | mCRPC (bone mets) | May 2013 |
| Azedra® | iobenguane I 131 | NET/pheochromocytoma | ¹³¹I | PPGL | Jul 2018 |
| Zevalin® | ibritumomab tiuxetan | CD20 | ⁹⁰Y | NHL | Feb 2002 |
| Bexxar® | tositumomab-I-131 | CD20 | ¹³¹I | NHL | Withdrawn 2014 |

### 3.3 Dosing Schedules

**[¹⁷⁷Lu]Lu-PSMA-617 (Pluvicto®):**
- Standard dose: **7.4 GBq (200 mCi)** IV infusion [26]
- Schedule: **Every 6 weeks (± 1 week)**, up to **6 cycles**
- Dose reduction: First reduction to **5.9 GBq (160 mCi)** for toxicity; further toxicity → discontinue [26]
- Indication: PSMA-positive metastatic castration-resistant prostate cancer (mCRPC) post-ARPI ± taxane

**[¹⁷⁷Lu]Lu-DOTATATE (Lutathera®):**
- Standard dose: **7.4 GBq (200 mCi)** IV infusion [27]
- Schedule: **Every 8 weeks (± 1 week)**, **4 cycles total**
- Amino acid infusion for kidney protection: mandatory co-administration
- Dose modification: if grade 3–4 haematologic/renal toxicity → hold or reduce to 3.7 GBq

### 3.4 Global Batch Sizes and Facility Capacity

**Novartis / AAA (Advanced Accelerator Applications):**
- Facilities: Millburn NJ (FDA-approved April 2023), Indianapolis IN (largest RLT facility globally, 70,000 sq ft, FDA-approved 2024), Ivrea Italy, Zaragoza Spain [1][2]
- Combined annual capacity: **~250,000 doses/year** as of 2024 [1]
- Batch sizes: Proprietary — not publicly disclosed at dose-per-batch level; estimated 10–30 patient doses per synthesis campaign based on typical automated synthesis module throughput and GBq-per-batch limits
- Note: During 2022–2023, supply shortages limited treatment capacity; Indianapolis facility was built specifically to address this [2]

**Other commercial producers (contract/licensed manufacturing):**
- ARTMS (Canada), NorthStar Medical Radioisotopes (USA), Curium, Eckert & Ziegler (Germany), ITM (Germany), Orano Med (France/USA) supply bulk ¹⁷⁷Lu which is then labelled on-site or centrally

**Typical doses per batch at a regional radiopharmacy (academic/hospital):
- 1–20 patient doses per synthesis run (automated module)
- Determined by available ¹⁷⁷LuCl₃ activity, calibration time, and delivery radius [7]

---

## 4. Radionuclide Data

### 4.1 Lutetium-177

| Property | Value | Source |
|----------|-------|--------|
| Half-life | **6.647 days = 9,571.7 min** | LNHB/IAEA [3][4] |
| Decay mode | β⁻ (100%) | |
| Emax (β⁻) | 498.3 keV (78.6%), 384.8 keV (9.1%) | |
| γ emissions | 208.4 keV (10.4%), 113.0 keV (6.2%) | |
| Daughter | Hf-177 (stable) | |
| Specific activity (theoretical NCA) | **~4,110 GBq/mg** | Calculated [5] |
| Specific activity (achieved NCA) | **~3,320 ± 40 GBq/mg** (3.32 TBq/mg) | [5][6] |
| Specific activity (CA, direct route) | 10–100 GBq/mg | [4][6] |

**Production routes:**
- **Indirect (n.c.a.) route: ¹⁷⁶Yb(n,γ)→¹⁷⁷Yb(T½=1.9h,β⁻)→¹⁷⁷Lu** followed by chemical Yb/Lu separation. Produces no ¹⁷⁷mLu impurity. Higher specific activity (~3,320 GBq/mg achieved). Requires high-flux reactor and enriched ¹⁷⁶Yb target. Commercially supplied by: ITG Isotopen Technologien München, Orano (formerly AREVA), NorthStar, ANSTO [4][6].
- **Direct (c.a.) route: ¹⁷⁶Lu(n,γ)→¹⁷⁷Lu** — simpler, cheaper, but co-produces long-lived ¹⁷⁷mLu (T½ = 160.4 days) at 500–700 ppm levels, which exceeds the Ph. Eur. specification of ≤200 ppm (≤0.02%) [4][40].

**¹⁷⁷mLu (Lu-177m) impurity:**
- Ph. Eur. monograph (01/2022:2464): ≤0.02% of total activity at calibration time [40]
- Direct route typically yields 500–700 ppm → **non-compliant without additional purification**
- Indirect NCA route: <50 ppm, typically undetectable [4][40]
- Significance: ¹⁷⁷mLu has 160.4-day T½ and emits 208.4 keV and 228.6 keV γ; increases radioactive waste storage times and patient dose calculations [4]

### 4.2 Actinium-225

| Property | Value | Source |
|----------|-------|--------|
| Half-life | **10.0 days = 14,400 min** | IAEA 2023 [35] |
| Note on 9.92 d value | Older literature; IAEA 2023 revises to 10.0 d | [35] |
| Decay mode | α (cascade: 4 α + 2 β⁻ to ²⁰⁹Bi stable) | |
| Key α emissions | 5.83 MeV (Ac-225→Fr-221→At-217→Bi-213→Tl-209→Pb-209→Bi-209) | |
| Daughters | Fr-221, At-217, Bi-213, Po-213, Tl-209, Pb-209 | |
| Supply constraint | **<2 TBq/yr globally** (2024); primarily from Th-229 generators at ORNL | [44] |
| Historical figures | 63–75 GBq/yr (0.063–0.075 TBq/yr) from Th-229 decay pre-2022; now ramping with accelerator routes | [44] |
| Accelerator route | Ra-226(p,2n)Ac-225 at cyclotrons (TRIUMF, BNL); potential >1 TBq/yr by 2027–2028 | [44] |

### 4.3 Gallium-68

| Property | Value | Source |
|----------|-------|--------|
| Half-life | **67.71 min** | IAEA [36] |
| Decay mode | β⁺ (89.1%) + EC (10.9%) | |
| β⁺ max energy | 1.899 MeV | |
| 511 keV annihilation γ | 178.2% abundance | |
| Generator (Ge-68 parent) | T½ Ge-68 = 270.95 days | |
| Elution yield | **65–80%** (new generator) → may decrease with age | [37][38] |
| Ge-68 breakthrough limit | **≤0.001%** of eluted ⁶⁸Ga activity (Ph. Eur. 2464) | [37][38] |
| Labeling conditions | pH 3.5–4.5, 95°C, 5–15 min (DOTA); RT 10 min (NOTA) | |
| Molar activity achievable | Up to **560 GBq/µmol** with direct generator elution | [39] |

### 4.4 Fluorine-18

| Property | Value | Source |
|----------|-------|--------|
| Half-life | **109.77 min** | IAEA |
| Production | ¹⁸O(p,n)¹⁸F on cyclotron | |
| Typical yield | **2–3 GBq/µA·h** at target EOB | [39] |
| Beam current range | 30–100 µA (medical cyclotrons) | |
| EOB activity at 60 min/40 µA | 60–120 GBq at target | |
| Decay mode | β⁺ (96.9%), EC (3.1%) | |

### 4.5 Other Therapeutic/Diagnostic Radionuclides

| Radionuclide | Half-life | Decay Mode | Primary Application |
|-------------|-----------|-----------|---------------------|
| I-131 | 8.02 d | β⁻ (100%), γ 364 keV | Thyroid cancer, MIBG therapy |
| Y-90 | **64.0 h (2.67 d)** | β⁻ (100%), Emax 2.28 MeV | Zevalin RIT, microsphere SIRT |
| Tb-161 | **6.9 d (6.934 d)** | β⁻ + Auger electrons | Emerging therapeutic (DOTA-conjugates) |
| Pb-212 | **10.64 h (0.443 d)** | β⁻→Bi-212→Po-212 (α) | Alpha-in-daughter TAT |
| Cu-64 | **12.7 h (0.53 d)** | β⁻ (38.5%), β⁺ (17.5%), EC (44%) | PET imaging, theranostics |
| Zr-89 | **78.4 h (3.27 d)** | β⁺ | Immuno-PET with antibodies |

---

## 5. Production Equipment

### 5.1 Hot Cells

Hot cells for ¹⁷⁷Lu labelling are lead-shielded enclosures providing:
- **Lead shielding thickness:** 50–100 mm Pb (typical 75 mm Pb for ¹⁷⁷Lu clinical production) [20][21]
- At 75 mm Pb: ~57 HVLs for 208 keV gammas (1.3 mm HVL) = attenuation factor of 10¹⁷ — highly over-engineered for ¹⁷⁷Lu compared to PET isotopes
- For comparison, PET (511 keV, Pb HVL ~4 mm): same 75 mm = ~18 HVLs = factor 250,000×
- Internal Grade A environment maintained via HEPA-filtered unidirectional airflow
- Negative pressure option for containment (see §8.4 conflict)
- L-block leaded-glass viewing windows (typically 25–50 mm Pb-equivalent lead glass)

**Key vendors:** Von Gahlen (Netherlands), Comecer (Italy), Biodex Medical, Tema Sinergie (Italy), ISOFLEX, Trasis (Belgium)

### 5.2 Automated Synthesis Modules

Used for cassette-based GMP radiolabelling of ¹⁷⁷Lu products:

| Module | Vendor | Type | Throughput |
|--------|--------|------|-----------|
| AllInOne | Trasis (Belgium) | Cassette-based, configurable | 1 batch/run |
| Modular-Lab PharmTracer | Eckert & Ziegler | Fixed fluid path, modular | 1 batch/run |
| Taddeo | Comecer (Italy) | Hot cell integrated | 1 batch/run |
| GRP | Scintomics | Configurable fluid paths | 1 batch/run |
| AIDA | iPHASE Technologies | PET/SPECT/therapy | 1 batch/run |
| Elysia | Elysia-Raytest | PET synthesis | 1 batch/run |

**Single-use vs. fixed tubing:**
- Single-use cassettes preferred for GMP (no cleaning validation, reduced cross-contamination)
- Typical cassette cost: €200–800 per synthesis run [unverified estimate]

### 5.3 Dispensing Systems

Patient-specific dose dispensing for ¹⁷⁷Lu therapies:
- **THEODORICO** (Comecer): shielded automated dispensing isolator for patient-specific doses
- **Tema Sinergie DISPENSO / LARA**: shielded vial dispensing with dose calibration
- **Von Gahlen dispensing systems**: integrated shielded filling lines
- **Trasis dispensing modules**: add-on to AllInOne platform

Typical fill volume: **10–30 mL per patient vial** (Pluvicto typically ~20 mL; Lutathera 25 mL)

### 5.4 QC Instruments

| Instrument | Parameter | Specification |
|-----------|-----------|---------------|
| Dose calibrator (ionisation chamber) | Activity (MBq/GBq) | ±2% accuracy, calibrated to NIST/PTB/NPL standards |
| Radio-HPLC (γ-detector) | RCP, free ¹⁷⁷Lu | ≥95% labelled fraction, run time 15–30 min |
| Radio-TLC / iTLC-SG | Free ¹⁷⁷Lu (colloidal + ionic) | Rapid (<5 min), orthogonal to HPLC |
| HPGe gamma spectrometer | Radionuclidic purity | ¹⁷⁷mLu <0.02%, ¹⁷⁷Lu >99.9% |
| pH meter | pH of final product | 4.5–7.5 for IV administration |
| LAL endotoxin (kinetic turbidimetric) | Endotoxin EU/mL | ≤5 EU/mL or ≤175 EU/max dose |
| GC headspace | Residual ethanol | ≤5000 ppm (ICH Q3C) |
| Osmometer (freezing-point) | Osmolality | 270–330 mOsm/kg |
| Bubble-point / filter integrity | Sterilising filter (0.22 µm) | ≥250 kPa (for 0.22 µm PVDF) |
| Particle counter (light obscuration) | Particulate contamination | <6000 per vial ≥10 µm; <600 ≥25 µm (Ph. Eur. 2.9.19) |
| Sterility test (USP <71> / Ph. Eur. 2.6.1) | Sterility | No growth at 14 d |
| Visual inspection station | Appearance, particles, colour | Colour, clarity, visible particles |

---

## 6. Radiolabeling Chemistry

### 6.1 DOTA Chelation Mechanism

DOTA (1,4,7,10-tetraazacyclododecane-1,4,7,10-tetraacetic acid) forms kinetically inert complexes with Lu³⁺ via:
1. **Protonation equilibrium of DOTA** — carboxylate arms must be deprotonated to coordinate Lu³⁺
2. **Lu³⁺ enters the macrocycle** (outer-sphere or partial inner-sphere intermediate)
3. **Ring closure and arm coordination** — the rate-limiting step; thermally activated
4. **Final [Lu(DOTA)]⁻ complex** — thermodynamically stable (log K ≈ 25 for Lu-DOTA), kinetically inert

Temperature drives step 3 (ring closure) via Arrhenius kinetics; low pH (4–5) maintains DOTA in a partially protonated form that still allows coordination while preventing Lu(OH)₃ precipitation [8][10].

### 6.2 Optimal Labelling Conditions

| Parameter | Value | Notes | Ref |
|-----------|-------|-------|-----|
| Temperature | **95 °C (classical)** | Range: 70–100 °C; PSMA ligands may degrade above 100 °C | [7][8][9] |
| Time | **15–25 min** at 95 °C | Full saturation at ~25 min; diminishing returns beyond | [7][9] |
| pH | **4.0–5.5 (optimum ~4.5)** | Acetate or ascorbate buffer; too low = slow kinetics; too high = Lu(OH)₃ colloid | [8][10] |
| Buffer | 0.4–1.0 M sodium acetate | Or 0.25 M ascorbic acid/ascorbate | [7] |
| Precursor amount | **15–25 nmol/GBq** (n.c.a.) | 20 nmol/GBq is widely cited (Rathke et al., JNM 2018) | [11][12] |
| Precursor amount (c.a.) | **25 µg/GBq** (≈15–17 nmol/GBq for DOTATATE MW ~1423 g/mol) | | [11] |
| RCY achieved | **≥95–98%** under optimal conditions | If <95%, purification step (SPE, HPLC) required | [7][9][12] |

### 6.3 Effect of pH Outside Optimal Range

- **pH < 3.5:** DOTA nitrogen lone pairs protonated; Lu³⁺ cannot enter macrocycle efficiently; RCY drops significantly
- **pH > 5.5–6.0:** Lu³⁺ begins to form Lu(OH)₃ colloidal precipitate; colloid in product causes off-target radiation; RCY may appear high but radiochemical purity by HPLC is low (colloid co-elutes poorly)
- **pH > 6:** Hydrolysis is significant; Lu(OH)₄⁻ species form; product is non-sterile in terms of colloidal content [8][10]

### 6.4 Metal Impurity Effects

DOTA is not metal-selective. Competing cations:

| Cation | Effect | Critical Concentration | Ref |
|--------|--------|----------------------|-----|
| Zn²⁺ | Strong competitor; binds DOTA rapidly at RT | >1 µmol/L causes measurable RCY loss | [10][19] |
| Cu²⁺ | Strong competitor; kinetically favourable | >1 µmol/L | [10][19] |
| Fe³⁺ | Moderate competitor | >10 µmol/L | [10][19] |
| Al³⁺, Cr³⁺ | Weak competition | Low concern | [10] |

**Mitigation:** Use trace-metal-grade reagents; avoid metal-containing equipment in contact with synthesis solutions; EDTA challenge of buffers; quality test each reagent lot for metal content.

### 6.5 Specific Activity and Molar Activity

- **Theoretical NCA specific activity:** ~4,110 GBq/mg [5]
- **Achieved NCA specific activity:** 3,320 ± 40 GBq/mg (3.32 TBq/mg) [5]
- **Molar activity of [¹⁷⁷Lu]Lu-PSMA-617 (Pluvicto):** 100–212 GBq/µmol reported [12]
- **Molar activity of [¹⁷⁷Lu]Lu-DOTATATE (Lutathera):** ~53 GBq/µmol (Ph. Eur. certified) [11]
- **Peptide mass per patient dose (Pluvicto 7.4 GBq):** ~6.3 µg/mL at ~100 GBq/µmol molar activity [12]

---

## 7. Radiolysis and Stabilisers

### 7.1 Mechanism of Radiolytic Degradation

Radiolysis is the primary cause of post-synthesis RCP decline in ¹⁷⁷Lu radiopharmaceuticals:
1. **Direct radiolysis:** β⁻ radiation directly cleaves covalent bonds in the peptide or chelate
2. **Indirect (aqueous) radiolysis:** β⁻ ionises water → ·OH, H·, e⁻aq, H₂O₂ radicals → attack peptide/chelate
3. **Rate increases with:** activity concentration (GBq/mL), temperature, time, and absence of radical scavengers [15][18]

### 7.2 Activity Concentration and Radiolysis Rate

| Activity Concentration | Radiolysis Rate (approximate) | Notes |
|-----------------------|------------------------------|-------|
| <1 GBq/mL | Slow; RCP >95% for >48 h | Low-volume preparations stable |
| 1–3 GBq/mL | Moderate; RCP may fall below 95% within 24–48 h without stabiliser | Stabiliser essential |
| 3–10 GBq/mL | Rapid; without stabiliser, RCP < 90% within 12 h | High-activity preparations need proportionally higher stabiliser concentration | [15][18] |

### 7.3 Stabilisers and Concentrations

| Stabiliser | Concentration | Mechanism | RCP Effect | Ref |
|-----------|--------------|-----------|-----------|-----|
| Sodium ascorbate | **20 mg/mL** | ·OH radical scavenger; electron donor | RCP >95% for ≥24 h at RT with ≤3 GBq/mL | [15][16] |
| Ascorbic acid | 20 mg/mL | Same; may also buffer pH | Similar to sodium ascorbate | [15] |
| Gentisic acid | **0.5–1 mg/mL (≈2.7–5.4 mM)** | ·OH scavenger; synergistic with ascorbate | Combined use more effective than either alone | [16][17] |
| Methionine | 5–20 mg/mL | Antioxidant amino acid | Moderate effect; used in some MIBG preparations | [18] |
| Ethanol | 5–10% v/v | ·OH scavenger; also improves labelling kinetics | Effective but limits product volume and toxicity profile | [9] |

**Key finding for calibration:** The sim.js default of 25 mg/mL ascorbate is ~25% above the minimum effective concentration (20 mg/mL). This is conservative and appropriate, but the optimal range for modelling the "sweet spot" is **15–25 mg/mL**. Beyond 40–50 mg/mL, no additional protective benefit and potential chemical impurity concerns arise [15].

### 7.4 Shelf Life / Stability Data

| Product | Storage | RCP at t=0 | RCP at t=24 h | RCP at t=48 h | Ref |
|---------|---------|-----------|--------------|--------------|-----|
| [¹⁷⁷Lu]Lu-PSMA-I&T | 2–8 °C, 20 mg/mL ascorbate | >98% | >95% | >90% | [15] |
| [¹⁷⁷Lu]Lu-DOTATATE (Lutathera SmPC) | 2–8 °C | >98% | >95% at 24 h | Not specified | [27] |
| [¹⁷⁷Lu]Lu-PSMA-617 (Pluvicto SmPC) | 2–8 °C | >98% | >95% | ~90% | [26] |

**Pluvicto labelled shelf life from US PI:** Up to 72 hours from calibration time [26].

---

## 8. Cleanroom / GMP / Aseptic Requirements

### 8.1 EU GMP Annex 1 (2022) Cleanroom Classifications

EU GMP Annex 1 was comprehensively revised in 2022 [22]. Key particle limits:

| Grade | At Rest 0.5 µm /m³ | At Rest 5 µm /m³ | In Operation 0.5 µm /m³ | In Operation 5 µm /m³ | ISO Equivalent |
|-------|-------------------|----------------|-----------------------|---------------------|---------------|
| A | 3,520 | 20 | 3,520 | 20 | ISO 5 |
| B | 3,520 | 29 | 352,000 | 2,900 | ISO 7 (operation) |
| C | 352,000 | 2,900 | 3,520,000 | 29,000 | ISO 8 (operation) |
| D | 3,520,000 | 29,000 | Not defined | Not defined | ISO 8 (at rest) |

**Microbial limits (Annex 1 Table 1):**

| Grade | Air sample (CFU/m³) | Settle plate (90mm, 4h, CFU/plate) | Contact plate (55mm, CFU/plate) | Glove print (CFU/glove) |
|-------|-------------------|----------------------------------|--------------------------------|------------------------|
| A | <1 | <1 | <1 | <1 |
| B | 10 | 5 | 5 | 5 |
| C | 100 | 50 | 25 | — |
| D | 200 | 100 | 50 | — |

### 8.2 Air Changes Per Hour

Annex 1 does not specify mandatory ACH values (HVAC is performance-based); however:
- **Grade A/B:** Typically **25–60 ACH** in conventional cleanrooms; isolators may use different airflow metrics (velocity-based)
- **Grade C:** Typically **20–40 ACH**
- **Grade D:** Typically **10–20 ACH**
- **Unidirectional (laminar) flow velocity in Grade A:** **0.36–0.54 m/s** (Annex 1 Table 2) [22]

### 8.3 Pressure Differentials

- **Between adjacent grades:** Minimum **10–15 Pa** pressure differential [22]
- **Pressure cascade:** D < C < B, with B being overpressure relative to C and outer areas
- **Grade A isolator (aseptic):** **Overpressure 20–60 Pa** relative to Grade B background [22][23][24]
- **Negative-pressure containment areas** (for radioactive products): controlled at −5 to −20 Pa relative to adjacent non-radioactive area

### 8.4 The Negative Pressure / Aseptic Conflict in Radiopharmacy

This is a critical design challenge in radiopharmacy GMP:

**Sterility requires positive pressure** (prevents ingress of microorganisms from less-clean areas).
**Radiation containment requires negative pressure** (prevents escape of radioactive aerosols/dust to the environment and operator).

**Resolution approaches used in commercial RLT manufacturing:**
1. **Shielded aseptic isolators:** The isolator itself operates at positive pressure (Grade A, typically +20–60 Pa overpressure) and is completely sealed. The isolator is housed in a Grade C/D room that can be maintained at negative pressure relative to corridors. This spatially separates the two requirements [22][23][24].
2. **Double-shell isolator design:** Inner shell (Grade A, positive) + outer containment shell (slight negative relative to room).
3. **Regulatory position:** EU GMP Annex 1 (2022) explicitly acknowledges that in radiopharmaceutical manufacturing, the contamination control strategy must address this conflict, with justification in the dossier [22].
4. **VHP decontamination:** Cycle transiently neutralises pressure; after completion, operational pressures are restored before product exposure [24][25].

### 8.5 HEPA Filters

- **Grade A/B:** HEPA H14 (EN 1822), efficiency ≥99.995% at MPPS (most penetrating particle size ~0.3 µm)
- **Typical replacement interval:** 2–3 years (or when integrity test fails)
- **Integrity test method:** Aerosol photometer test (sodium flame or DOP) per EN ISO 14644-3
- **Activated charcoal filter:** Used in radiopharmacy exhaust air to adsorb radioiodine (¹²³I, ¹³¹I) and volatile organic compounds

### 8.6 Media Fill / Aseptic Process Simulation (APS)

Per Annex 1 (2022):
- Frequency: **Minimum semi-annually** per line/operator/shift, with at least 1 per year for each product type
- Volume: Must represent the full manufacturing process including all critical interventions
- Acceptance criteria: 0 contaminated units (for batches ≥50 vials); ≥0.1% contamination rate → investigation [22]
- Media: Soybean-casein digest broth (SCDB), tryptic soy broth (TSB)

---

## 9. Quality Attributes & Failure Modes

### 9.1 Release Specifications Summary ([¹⁷⁷Lu]Lu-PSMA-617 / DOTATATE)

| Parameter | Specification | Method |
|-----------|--------------|--------|
| Radiochemical purity | **≥95%** | Radio-HPLC + iTLC |
| Radionuclidic purity | **≥99.9% ¹⁷⁷Lu** | HPGe γ-spectrometry |
| ¹⁷⁷mLu impurity | **≤0.02%** | HPGe γ-spectrometry |
| pH | **4.5–7.5** | pH meter |
| Appearance | Clear, colourless to slightly yellow | Visual |
| Activity (dose) | **7.4 GBq ± 10%** at calibration time | Dose calibrator |
| Endotoxin | **≤175 EU/vial; ≤5 EU/mL** | LAL kinetic turbidimetric |
| Sterility | Sterile | USP <71> (parametric release) |
| Residual ethanol | **≤5,000 ppm** | GC headspace |
| Filter integrity | Pass | Bubble-point post-filtration |
| Particulate matter | Pass Ph. Eur. 2.9.19 | Light obscuration |

### 9.2 Batch Rejection Root Causes (Documented Categories)

Based on EANM quality risk management guidance [45] and published radiopharmacy QC literature:

| Failure Category | Approximate Frequency | Typical Root Cause |
|-----------------|----------------------|-------------------|
| RCP out-of-specification | **Most common (~30–50% of OOS events)** | Metal contamination, wrong temperature/time, equipment malfunction, precursor quality issue |
| Free ¹⁷⁷Lu (colloid) | Common | pH excursion, prolonged reaction, incompatible buffer |
| Endotoxin failure | **~10–20%** of OOS events | Inadequate depyrogenation of glassware, contaminated WFI, poor aseptic technique |
| Sterility failure | **Rare (<1% of batches** in well-validated facilities) | Glove box breach, stopper defect, filter integrity failure |
| Filter integrity failure | **~1–5%** | Damaged filter, improper installation, pressure excursion |
| Activity out of calibration window | Common; logistics issue | Batch prepared too early/late; decay miscalculation; courier delay |
| Visual inspection failure | Variable | Particulate from glass (delamination), stopper fragments, fibres |

### 9.3 Visual Inspection

- **Manual inspection efficiency:** ~**70–85%** for human inspectors (documented in EU GMP literature) [46]
- **Automated inspection efficiency:** **95–99%** (vision system + AI) [46]
- **Critical defects** (visible particles >50 µm): reject rate higher; regulatory requirement for 100% inspection
- **Line speed effect:** Higher line speed → increased particulate generation from vial-to-vial contact, conveyor vibration → more defects generated AND detection rate decreases

### 9.4 Container Closure Integrity (CCI)

- Method: Blue-dye immersion, vacuum decay, laser headspace analysis (preferred for radioactive)
- Specification: No dye ingress; headspace O₂ <5% for sealed vials
- Failure modes: Stopper not fully seated, incomplete crimp, vial flaw (glass crack)

---

## 10. Time, Decay & Logistics Economics

### 10.1 Timeline from End-of-Synthesis (EOS) to Administration

| Step | Typical Duration |
|------|----------------|
| QC (RCP, pH, activity, endotoxin rapid) | **30–60 min** |
| Release documentation | 15–30 min |
| Packaging and labelling | 20–30 min |
| Courier transit (regional, same-day) | 2–8 hours |
| Hospital receipt and preparation | 30–60 min |
| **Total EOS → patient:** | **4–12 hours typical** |

### 10.2 Decay Loss During Transit

For ¹⁷⁷Lu (T½ = 6.647 d):
- At 4 h transit: decay factor = 0.5^(4×60/9572) = 0.5^(0.0251) = **0.9827 → 1.73% decay loss**
- At 8 h: **3.44% loss**
- At 24 h: **10.0% loss**
- At 48 h: **19.0% loss**
- At 72 h: **27.0% loss** — still within 72-h shelf life window for Pluvicto

This confirms ¹⁷⁷Lu products can be shipped nationally/internationally (unlike PET). Pluvicto's 72-h shelf life allows next-day delivery over >2,000 km [26].

**For Ga-68 (T½ = 67.71 min):**
- At 60 min: **46% loss** → must be used within 3 h of EOS in the same building

### 10.3 Calibration Time Concept

Radiopharmaceuticals are calibrated to a **specific activity at a specified time** (e.g., "7.4 GBq at 12:00 on Day X"). The dose must be administered at or close to this calibration time.

- **Missed calibration window:** If administered >2 h late for ¹⁷⁷Lu: dose reduced by ~3.5%; clinically minor
- **If administered >24 h late:** dose reduced by ~10%; clinically significant — likely requires dose recalculation or patient reschedule
- **Documentation requirement:** Calibration time, actual administration time, and administered activity must all be documented on the patient record

### 10.4 Cost Economics

| Product | US List Price (2026) | Full Treatment Course Cost |
|---------|---------------------|--------------------------|
| Pluvicto® (6 doses) | **~$51,168/dose** (WAC Jan 2026) [41] | **~$307,000** |
| Lutathera® (4 doses) | **~$40,000–50,000/dose** | **~$160,000–200,000** |

Note: The original oft-cited figure of ~$42,500/dose for Pluvicto reflects the launch WAC in March 2022. The price has increased. Actual payer reimbursement differs substantially from WAC.

---

## 11. Radiation Protection

### 11.1 Lu-177 Dose Rate Constants

| Measurement | Value | Notes | Ref |
|-------------|-------|-------|-----|
| Dose rate at 1 m (clinical, self-attenuated in patient) | **0.0037 mSv/h·GBq** (range 0.0024–0.0058) | Measured in patient cohort; includes source self-attenuation | [31] |
| Theoretical γ dose rate constant (point source, no attenuation) | **~0.014 mSv/h·GBq** at 1 m | From γ emission data; overestimates by ~4× vs clinical | [20] |
| For manufacturing (unattenuated point source estimate) | **0.0092–0.014 mSv/h·GBq** at 1 m | Range from ICRP/EANM dosimetry handbooks | [20][31] |

### 11.2 Lead Half-Value Layers

| Photon Energy | HVL (Pb) | 10-HVL | Notes |
|---------------|---------|--------|-------|
| ¹⁷⁷Lu 208 keV | **1.3 mm** | 13 mm | Dominant γ emission | [20][21] |
| ¹⁷⁷Lu 113 keV | **0.5 mm** | 5 mm | Secondary γ emission | [20][21] |
| 511 keV (PET) | ~4 mm | 40 mm | For comparison | |
| ⁶⁰Co 1.25 MeV | ~11 mm | 110 mm | For comparison | |

**Practical result:** A 75 mm Pb hot cell wall provides ~57 HVLs for 208 keV gammas → attenuation factor of ~1.4 × 10¹⁷. This is massively over-specified for radiation protection purposes alone; the real driver is ALARA for operator dose during manual manipulations.

### 11.3 Operator Dose Rates and Annual Limits

| Exposure type | Value | Regulatory Limit | Ref |
|--------------|-------|-----------------|-----|
| Whole-body occupational | 20 mSv/yr (effective dose) | **20 mSv/yr** (5-yr average; ICRP 103) | [47] |
| Extremity (hands/fingers) | 500 mSv/yr | **500 mSv/yr** | [47] |
| Lens of eye | 20 mSv/yr | **20 mSv/yr** (revised 2011) | [47] |
| Typical finger dose per GBq handled | 10–200 µSv/GBq | Procedure-dependent; use ring dosimetry | [48] |

### 11.4 IATA Class 7 Transport Parameters for Lu-177

| Parameter | Value | Ref |
|-----------|-------|-----|
| A1 value (special form) | **20 TBq** | [32] |
| A2 value (normal form) | **0.8 TBq (800 GBq = 800,000 MBq)** | [32] |
| Type A package limit | ≤ A2 = **0.8 TBq** | [32] |
| Surface dose rate limit | **≤2 mSv/h** | IATA DGR Section 10 [32] |
| 1 m dose rate limit (Transport Index) | **≤0.1 mSv/h** (TI = 1.0) | [32] |
| UN number (Type A, normal form) | UN 2915 | |
| Label | Class 7, Category II-Yellow or III-Yellow | |

**Implication for Pluvicto dispatch:** A single 7.4 GBq patient dose vial is well within A2 (0.8 TBq = 800 GBq). A batch of ~100 doses (740 GBq total) would approach A2 and require careful package design. Multi-dose batches may require Type B packaging.

---

## 12. Throughput / OEE / Industrial Metrics

### 12.1 OEE Benchmarks

| Line Type | Industry Average OEE | World-Class OEE | Ref |
|----------|---------------------|----------------|-----|
| Sterile aseptic filling (general pharma) | **23–40%** | 60–78% | [33][34] |
| Radiopharmaceutical shielded dispensing | **30–50%** (estimated) | ~60% (best-in-class) | [33] |
| Conventional oral solids | 55–65% | 72–85% | [33] |

Note: The sim.js OEE formula (capped at 100%, typical output 40–70% under good conditions) is broadly consistent with world-class targets but should be expected to display industry-average values of ~35–50% under realistic operating parameters.

### 12.2 Filling/Dispensing Speed

| Line Type | Typical Speed | Notes |
|-----------|--------------|-------|
| Manual radiopharmaceutical dispensing | **1–3 vials/min** | Each vial individually dose-calibrated |
| Semi-automated (e.g., THEODORICO) | **3–8 vials/min** | Automated dose verification |
| Fully automated shielded filling line | **5–15 vials/min** | Patient-specific; isotope-verified |
| General pharma (non-radioactive) sterile | 60–400 vials/min | No per-vial dose verification needed |

**Critical note on sim.js:** The sim model allows up to 40 vials/min; this is unrealistic for patient-specific ¹⁷⁷Lu dose dispensing where each vial requires individual dose calibration verification. Realistic maximum for a high-throughput RLT line is **~15 vials/min**.

### 12.3 Batch Cycle Times

| Activity | Duration |
|----------|---------|
| Hot cell preparation / cassette install | 30–45 min |
| Synthesis / labelling | 15–25 min |
| Purification (if SPE) | 10–20 min |
| Formulation / dilution | 10–15 min |
| QC (RCP, pH, activity, endotoxin rapid) | 30–60 min |
| Filling / dispensing | 15–60 min (depends on vial count) |
| Visual inspection and labelling | 15–30 min |
| Packaging | 15–30 min |
| **Total (EOS to dispatch):** | **~2.5–5 hours** |

### 12.4 Consumables per Batch

| Item | Typical Quantity per Synthesis Run |
|------|-----------------------------------|
| Synthesis cassette (single-use) | 1 per batch |
| 0.22 µm sterilising filter | 2 (synthesis + final) |
| Sterile depyrogenated vials | 1 per dose + 10% overage |
| Bromobutyl stoppers + aluminium crimps | 1 set per vial |
| Tungsten/lead transport pots | 1 per patient dose |
| Radio-HPLC column (gradient life) | ~50–100 injections per column |
| iTLC-SG strips | 2–3 per batch |
| LAL endotoxin kit aliquot | 1 per batch |
| Ascorbate buffer | ~30–200 mL per batch |

---

## 13. Digital Twin & Industry 4.0 Justification

### 13.1 Digital Twin in Pharmaceutical Manufacturing

A **pharmaceutical digital twin** is a real-time, physics-informed virtual replica of a production process, continuously updated from sensor data, MES, and PAT systems. Published benefits include:
- 10–30% yield improvement
- Significant reduction in quality deviations
- Real-time release testing capability (ifactory/IntuitionLabs 2026) [49]

### 13.2 PAT (Process Analytical Technology)

ICH Q8(R2) defines PAT as "a system for designing, analysing, and controlling manufacturing through timely measurements of critical quality and performance attributes." In radiopharmacy:
- Inline pH monitoring during synthesis
- Real-time dose calibrator feedback during dispensing
- Inline radioactivity monitoring of synthesis stream
- HEPA differential pressure alarms (continuous)
- Isolator pressure monitoring (continuous) [50]

### 13.3 ICH Q13 and Continuous Manufacturing

**ICH Q13 (adopted globally November 2022)** provides the regulatory framework for continuous manufacturing (CM) of both drug substances and products [51][52]. Key relevance for the demo framing:
- Real-time quality assurance via PAT integration (reduces end-product testing reliance)
- Design space and proven acceptable range (PAR) concepts (from ICH Q8R2) define the operating space that the simulation explores
- Digital twins are explicitly compatible with ICH Q13 submissions
- Radiopharmaceutical production can benefit from CM concepts despite batch nature (the per-batch cycle is inherently time-constrained by isotope half-life)

### 13.4 Design Space and Proven Acceptable Ranges

The simulation "sliders" correspond directly to ICH Q8 concepts:
- **Reaction temperature:** PAR = 85–100 °C; Design space = 75–105 °C
- **Buffer pH:** PAR = 4.2–5.2; Design space = 3.8–5.8
- **Precursor amount:** PAR = 15–30 nmol/GBq; Design space = 10–50 nmol/GBq
- Operating within the Design Space does not require regulatory prior approval for changes; outside = major variation

---

## 14. Discrepancies vs. Current sim.js Assumptions

The following parameters in `sim.js` (reviewed August 2026) differ from the literature values assembled in this document:

| Parameter | sim.js Value | Literature Value | Discrepancy | Severity | Action |
|-----------|-------------|-----------------|-------------|---------|--------|
| Lu-177 half-life | 9,576 min | **9,571.7 min** (6.647 × 1440) | +4.3 min (+0.045%) | Negligible | Optional: update to 9571.7 min for precision |
| Ac-225 half-life | 14,285 min | **14,400 min** (10.0 d × 1440) | −115 min (−0.8%) | Minor | Update: 14,285 is based on 9.92 d; IAEA 2023 value is 10.0 d |
| Ascorbate optimum | 25 mg/mL | Literature optimum **20 mg/mL** | +5 mg/mL (overshoot) | Minor | Conservative but defensible; note in demo that 20 mg/mL is the evidence-based minimum effective dose |
| Isolator overpressure minimum trigger | ≥15 Pa | EU Annex 1 isolator typical **≥20 Pa** (operational); 10–15 Pa = only grade-to-grade differential | Under-set | **Moderate** | Raise isolator overpressure alert threshold from 15 Pa to 20 Pa in sim |
| Shielding HVL model | exp(−shield/11) | HVL for 208 keV γ in Pb = 1.3 mm; exponent should be ln(2)/HVL = 0.693/1.3 mm = **0.533/mm** | The sim uses a composite decay constant of 1/11 mm⁻¹ (= 0.091 mm⁻¹); actual 0.533 mm⁻¹ for 208 keV | **Large** | The sim shielding model is deliberately simplified (mix of energies and geometries); comment in code that it is a composite/empirical factor, not pure HVL calculation |
| Max fill speed | 40 vials/min | Realistic RLT maximum **~10–15 vials/min** | 2.7–4× overstated | Minor (demo only) | Note in demo that 40 vials/min represents hypothetical bulk fill; realistic patient-specific is 3–10/min |
| Lu-177 dose rate model constant | 30 µSv/h·GBq | Literature: 0.0037 mSv/h·GBq = **3.7 µSv/h·GBq at 1 m**; 30 µSv/h·GBq corresponds to **~0.1 m** distance or unshielded contact | Different geometry | **Requires annotation** | Document that the 30 factor assumes near-field/close-proximity contact conditions, not 1 m free-in-air; or divide by 8 for 1-m equivalent |
| Patient dose | 7.4 GBq | **7.4 GBq** — confirmed correct | None | — | — |
| Reaction temp optimum (sigma) | Gaussian centre 95°C, σ=16 | 95°C confirmed optimal; some protocols use 80°C for sensitive peptides | Minor | Low | Consider adding PSMA-specific branch at 80°C if Ac-225 or sensitive ligands added |
| pH optimum (sigma) | Gaussian centre 4.5, σ=0.9 | Optimum 4.0–5.5; centre 4.5 confirmed | None | — | — |
| Precursor optimum | 20 nmol/GBq | 15–25 nmol/GBq; 20 nmol/GBq confirmed | None | — | — |
| RCP release spec | 95% | ≥95% confirmed (Ph. Eur., USP <825>) | None | — | — |
| Air changes per hour default | 30 ACH | 25–40 ACH typical for Grade B/C; 30 is within range | None | — | — |
| OEE model range | 0–100% | Industry realistic 23–65% for sterile lines | Model is aspirational | Low | Add annotation that world-class is ~60%; median sterile is ~35% |

---

## 15. Reference List

[1] Novartis AG. "Novartis expands production of Pluvicto™ with addition of its largest and most advanced radioligand therapy manufacturing facility in Indianapolis." Press Release, 2024. https://www.novartis.com/news/media-releases/novartis-expands-production-pluvictotm-addition-its-largest-and-most-advanced-radioligand-therapy-manufacturing-facility-indianapolis

[2] Novartis AG. "FDA approves Novartis Millburn facility for US commercial production of Pluvicto." Press Release, 2023. https://www.novartis.com/news/fda-approves-novartis-millburn-facility-us-commercial-production-pluvicto

[3] Martin MJ et al. "Activity standardization and half-life measurement of 177Lu." *Applied Radiation and Isotopes* 194 (2023): 110697. https://www.sciencedirect.com/science/article/pii/S0969804323001823

[4] Isotopia Ltd. "Lutetium-177 Production." https://isotopia-global.com/177-lutetium-177-lu-production/ (accessed August 2026)

[5] Radioanalytical Chemistry Laboratory. "Electrochemical separation and purification of no-carrier-added 177Lu." *Journal of Analytical Atomic Spectrometry* (2023). https://www.sciencedirect.com/science/article/pii/S2666821123000029

[6] Advanced Molecular Technologies (AMT). "Lutetium-177 Overview." https://www.isotope-amt.com/lutetium-177-overview/ (accessed August 2026)

[7] Shetty D et al. "Multifactorial analysis of radiochemical purity in high-activity 177Lu labelling." *EJNMMI Radiopharmacy and Chemistry* (2025). https://link.springer.com/content/pdf/10.1186/s41181-025-00372-5.pdf

[8] Benchchem Application Notes. "Application Notes and Protocols for Lutetium-177 Radiolabeling in Cancer Therapy." https://pdf.benchchem.com/15489/Application_Notes_and_Protocols_for_Lutetium_177_Radiolabeling_in_Cancer_Therapy.pdf

[9] Kulkarni HR et al. "Improvement of End-of-Synthesis Radiochemical Purity of [177Lu]Lu-DOTA-PSMA." *Pharmaceutics* 16(12):1535 (2024). https://www.mdpi.com/1999-4923/16/12/1535

[10] Asti M et al. "Influence of metallic cations on the labelling reaction of DOTA with 90Y and 177Lu." *Journal of Labelled Compounds and Radiopharmaceuticals* 56(7):376–382 (2013). https://www.researchgate.net/publication/257432093

[11] Bodei L et al. "Lutathera® European Pharmacopoeia monograph / SmPC." *European Medicines Agency.* https://www.ema.europa.eu/en/medicines/human/EPAR/lutathera (accessed August 2026)

[12] Rahbar K et al. "Determining PSMA-617 Mass and Molar Activity in Pluvicto Doses." *Journal of Nuclear Medicine* 66(5):824.1 (2025). https://jnm.snmjournals.org/content/66/5/824.1

[13] European Pharmacopoeia. "Lutetium (177Lu) solution for radiolabelling – 01/2022:2464." *European Pharmacopoeia 11th Edition.* https://www.edqm.eu

[14] USP <825>. "Radiopharmaceuticals – Preparation, Compounding, Dispensing, and Repackaging." *United States Pharmacopeia.* https://www.usp.org/compounding/general-chapter-radiopharmaceuticals

[15] Wester H-J et al. "Production and Quality Control of [177Lu]Lu-PSMA-I&T." *Molecules* 27(13):4143 (2022). https://www.mdpi.com/1420-3049/27/13/4143

[16] Benchchem Application Notes. "Sodium Gentisate as a Stabilizer for Lu Radiopharmaceuticals." https://pdf.benchchem.com/10858/Application_Notes_and_Protocols_Sodium_Gentisate_as_a_Stabilizer_for_Lu_Radiopharmaceuticals.pdf

[17] Paulus A et al. "Maintaining radiochemical purity of 177Lu-DOTA-PSMA-617 for PRRT." *Journal of Nuclear Medicine* 58(S1):257 (2017). https://jnm.snmjournals.org/content/58/supplement_1/257

[18] Bozkurt MF et al. "Stability Matters: Radiochemical Stability of Therapeutic Radiopharmaceuticals." *Journal of Nuclear Medicine Technology* 50(3):244–247 (2022). https://tech.snmjournals.org/content/50/3/244

[19] Pandya DN et al. "Influence of metal ions on the 68Ga-labeling of DOTATATE." *Applied Radiation and Isotopes* 75:89–95 (2013). https://www.sciencedirect.com/science/article/pii/S0969804313003679

[20] Stabin MG. *Radiation Protection and Dosimetry: An Introduction to Health Physics.* Springer, 2007.

[21] Kiran Kumar K et al. "Effectiveness of shielding materials against 177Lu gamma radiation." *Annals of Nuclear Medicine* 37:569–579 (2023). https://link.springer.com/content/pdf/10.1007/s12149-023-01860-x.pdf

[22] European Commission. "EU GMP Annex 1: Manufacture of Sterile Medicinal Products." Revised August 2022. https://health.ec.europa.eu/system/files/2022-08/20220825_gmp-an1_en_0.pdf

[23] ECA Academy. "Implementing a Cleanroom Aligned with EU GMP Annex 1." *Lab Manager / EJPPS* (2023). https://www.labmanager.com/implementing-a-cleanroom-aligned-with-eu-gmp-annex-1-34934

[24] Tema Sinergie. "GMP Annex 1 and VPHP biodecontamination in isolator and RABS." https://www.temasinergie.com/gmp-annex-1-bio-decontamination-technology-decon-process-engineering/

[25] Qualia Bio. "VHP Sterilization of Isolators: Cycle Validation for GMP Compliance." https://qualia-bio.com/blog/vhp-sterilization-of-isolators-cycle-validation-for-gmp-compliance/

[26] Novartis. "PLUVICTO (lutetium Lu 177 vipivotide tetraxetan) US Prescribing Information." 2022 (updated 2024). https://www.novartis.com/us-en/sites/novartis_us/files/pluvicto-pi.pdf

[27] Advanced Accelerator Applications (Novartis). "LUTATHERA (lutetium Lu 177 dotatate) US Prescribing Information." 2018 (updated 2023). https://www.lutathera.com/pi

[28] European Pharmacopoeia. "2.6.1 Sterility." *Ph. Eur. 11th Ed.*

[29] USP <71>. "Sterility Tests." *United States Pharmacopeia.*

[30] EANM Radiopharmacy Committee. "Quality Control Procedures for Radiopharmaceuticals: Procedural Guidelines." *European Journal of Nuclear Medicine and Molecular Imaging* (2010 and updates). https://eanm.org/publications/guidelines/

[31] Frey EC et al. "SUBSTANTIAL EXTERNAL DOSE RATE VARIABILITY OBSERVED IN A COHORT OF LU-177 PATIENTS." *Radiation Protection Dosimetry* 198(19):1476–1484 (2022). https://academic.oup.com/rpd/article/198/19/1476/6711422

[32] IATA. *Dangerous Goods Regulations (DGR) 64th Edition, Section 10: Radioactive Materials.* 2023. https://www.iata.org/dgr; See also 49 CFR § 173.435 Table of A1/A2. https://www.law.cornell.edu/cfr/text/49/173.435

[33] IntuitionLabs AI. "2026 Pharma KPI Benchmarks: OEE, Batch Release & R&D." https://intuitionlabs.ai/articles/pharma-kpi-benchmarks-2026

[34] TeepTrak. "Pharmaceutical OEE 2026 Guide." https://teeptrak.com/en/pharmaceutical-oee-gmp-2026/

[35] IAEA Nuclear Data Section. "Actinium-225 Decay Data." NUDAT 3.0, 2023. https://www.nndc.bnl.gov/nudat3/

[36] IAEA. "Ga-68: Nuclear Data." NUDAT / IAEA Nuclear Data Services. https://www-nds.iaea.org/

[37] Eckert & Ziegler. "Comprehensive Quality Control of the ITG 68Ge/68Ga Generator and GalliaPharm." *Journal of Nuclear Medicine* 57(9):1402–1408 (2016). https://jnm.snmjournals.org/content/57/9/1402

[38] EMA. "Guideline on core SmPC and Package Leaflet for (68Ge/68Ga) generator." EMA/CHMP/QWP/558019/2016. https://www.ema.europa.eu/en/documents/scientific-guideline/guideline-core-smpc-and-package-leaflet-68ge68ga-generator-first-version_en.pdf

[39] Nortier FM et al. "Cyclotron-produced 68Ga from enriched 68Zn foils." *Applied Radiation and Isotopes* 173:109716 (2021). https://www.sciencedirect.com/science/article/pii/S0969804321002281

[40] European Pharmacopoeia. "Lutetium (177Lu) solution for radiolabelling, 01/2022:2464." European Pharmacopoeia 11th Edition.

[41] US PLUVICTO. "Cost Information." https://us.pluvicto.com/pluvicto-cost-information (accessed August 2026)

[42] Kratochwil C et al. "Consensus Nomenclature Rules for Radiopharmaceutical Therapy: Why Does It Matter?" *Journal of Nuclear Medicine* 60(10):1413–1414 (2019).

[43] Jadvar H et al. "Targeted Radionuclide Therapy: An Overview." *Seminars in Nuclear Medicine* 50(2):150–161 (2020).

[44] US DOE/ORNL. "Multiple Production Methods Underway to Provide Actinium-225." https://www.isotopes.gov/information/actinium-225 (accessed August 2026)

[45] EANM Radiopharmacy Committee. "EANM guideline on quality risk management for radiopharmaceuticals." *EJNMMI Radiopharmacy and Chemistry* 7:24 (2022). https://pmc.ncbi.nlm.nih.gov/articles/PMC9308578/

[46] EU GMP Annex 1 (2022) §8: Visual Inspection. *Ibid.* [22]

[47] ICRP Publication 103. *The 2007 Recommendations of the International Commission on Radiological Protection.* Annals of the ICRP 37(2-4), 2007.

[48] Mattsson S and Söderberg M. "Radiation dose management in radiopharmaceutical therapy." *Physica Medica* 44:135–141 (2017).

[49] iFactory. "Digital Twin in Pharmaceutical Manufacturing: A Complete Guide." https://ifactoryapp.com/article/digital-twin-pharmaceutical-manufacturing-guide

[50] ISPE. "PAT as a Catalyst for Digital Transformation: Lessons for Engineers and Pharma." https://ispe.org/pharmaceutical-engineering/ispeak/pat-catalyst-digital-transformation-lessons-engineers-and-pharma

[51] FDA. "Q13 Continuous Manufacturing of Drug Substances and Drug Products." Guidance Document, November 2022. https://www.fda.gov/regulatory-information/search-fda-guidance-documents/q13-continuous-manufacturing-drug-substances-and-drug-products

[52] ICH. "ICH Q13 Guideline on Continuous Manufacturing." Step 4 document, 2022. https://database.ich.org/sites/default/files/ICH_Q13_Step4_Guideline_2022_1116.pdf

---
