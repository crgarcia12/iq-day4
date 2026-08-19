# ☢ RLT Command Center

An interactive **3D command center / digital twin of a radioligand therapy (RLT) production line** — the
radio-nuclear medicine manufacturing you were thinking of. The industry three-letter acronyms are
**RLT** (Radioligand Therapy) and the broader **RPT** (Radiopharmaceutical Therapy); the closely related
**PRRT** is Peptide Receptor Radionuclide Therapy.

The reference product modelled here is **[¹⁷⁷Lu]Lu-PSMA-617 (Pluvicto®)** at 7.4 GBq per patient dose,
with [¹⁷⁷Lu]Lu-DOTA-TATE (Lutathera®), ²²⁵Ac, ⁶⁸Ga and ¹⁸F selectable as alternatives.

Built as a conference demo: **no build step**, Three.js from a CDN import map, runs from any static host.

All process constants are calibrated against the peer-reviewed and regulatory literature compiled in
**[research.md](./research.md)** (41 cited sources, with a parameter-by-parameter calibration table).

---

## Run locally

```powershell
node server.js
# → http://localhost:5173
```

Any static file server works — there is nothing to compile.

## Live demo

Deployed to Azure Static Web Apps. See [Deployment](#deployment) below.

---

## The facility

A realistic GMP radiopharmacy floorplan: a shielded cyclotron bunker, a cleanroom suite with an
airlocked corridor and a Grade A→D cascade, a QC laboratory, a dispatch dock and a technical plant room —
with cleanroom partitions, vision panels, HEPA ceiling terminals, ducting, transfer lines and gowned
operators.

| Station | Zone | What it is |
|---|---|---|
| **Isotope Supply** | Shielded bunker | Cyclotron, target stations, n.c.a. ¹⁷⁷Lu receipt |
| **Precursor Prep** | Grade C | DOTA-precursor weighing, ascorbate scavenger, acetate buffer |
| **Hot Cell Suite** | Grade A in lead cell | Cassette synthesis module, chelation, SPE, sterile filtration |
| **QC Laboratory** | Grade D | Radio-HPLC, iTLC, dose calibrator, HPGe, LAL endotoxin |
| **Aseptic Filling** | Grade A in B | Shielded dispensing isolator, L-block, vial fill and crimp |
| **Inspect & Label** | Grade D | Particle/closure inspection, serialised GMP labelling |
| **Packaging & Dispatch** | CNC dock | Tungsten pots, IATA Class 7 Type A, transport index |
| **Utilities & Waste** | Technical | HEPA/charcoal HVAC, pressure cascade, decay-in-storage |

## Interaction

- **Click any machine** (or any deviation in the alert list) → a docked drawer opens with the station
  description, its live deviations, its critical process parameters and its consumables.
- **Drag a slider** — reaction temperature, buffer pH, molar excess, ascorbate, fill speed, isolator
  overpressure, QC coverage, shielding, ACH, transfer speed, dispatch lead time — and the **entire line
  reacts instantly**. The KPI panel stays visible while you drag, so the audience sees cause and effect.
- Each slider shows its **validated range** and a short note explaining the underlying science.
- **Colour coding**: every station has a floor halo, a beacon mast and an emissive body tint that shift
  teal → amber → red and pulse faster as risk rises. Product pucks flowing along the shielded transfer
  line redden with the defect rate.
- **Presets**: `Nominal`, `Optimised`, `Stress the line` (batch rejected, 17 deviations, the whole floor
  goes red), plus `Overview`, `Guided tour` (auto-walks all eight stations) and a `Quality` toggle for
  weaker GPUs.

## What is actually modelled

| Domain | Model |
|---|---|
| Decay | Exact half-lives; decay from end-of-synthesis through QC, dispatch and administration |
| Chelation kinetics | **Arrhenius** rate law, Eₐ ≈ 70 kJ/mol, normalised to 95 °C, modulated by molar excess and pH |
| pH window | Protonation below ~3.5, Lu(OH)₃ colloid formation above ~6.0 |
| Radiolysis | Scales with activity concentration (GBq/mL) and is quenched by ascorbate with saturating kinetics |
| Purity | RCP = 99.9 − radiolysis − unreacted − cold impurity − colloid, against the ≥ 95 % release spec |
| Sterility risk | Isolator pressure cascade, air changes per hour, HEPA service age, personnel count |
| Mechanical defects | Over-speed transfer and filling, understaffing |
| QC | Detection vs escape rate from QC coverage and inspection rigour |
| Radiation protection | Combined γ + bremsstrahlung/streaming lead transmission; cell-face dose rate and IATA transport index |
| Throughput | OEE = availability × performance × quality; doses per batch and per day |
| Economics | Dose value released and value destroyed per day, at the published Pluvicto list price |

Values are demo-grade approximations from public literature — illustrative, **not validated for real
manufacturing**. See `research.md` §14 for a frank list of where the model simplifies the physics.

## Files

```
index.html                 shell + Three.js import map
src/sim.js                 the process model (pure, dependency-free, unit-testable)
src/scene.js               facility, machines, materials, airflow, flow path
src/main.js                render loop, post-processing, picking, HUD, drawer
src/style.css              command-center UI
server.js                  dependency-free static server
research.md                cited research compendium + model calibration table
staticwebapp.config.json   Azure Static Web Apps routing/headers
```

## Deployment

Hosted on **Azure Static Web Apps** (resource group `rg-iq-day4-rlt`, app `swa-iq-day4-rlt`).
Pushes to `main` are published automatically by the GitHub Actions workflow in
`.github/workflows/`. There is no build step — the repository root is served as-is.

## Tech

Three.js r169 (WebGL2), PMREM environment lighting, ACES filmic tone mapping, PCF soft shadows and an
UnrealBloom pass, all loaded from a CDN import map. No bundler, no framework, no dependencies.
