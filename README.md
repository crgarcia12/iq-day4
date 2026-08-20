# 🏭 Caldova — Suncare Line 3 Operations Command Center

An interactive **3D command center for Caldova's sunscreen production line**, built to demo the
**Persona 2 (Production Line Manager)** half of a two-persona story:

> The Marketing Manager sees unusual demand for Hydration Sunscreen, learns from **Web IQ** that
> El Niño will last longer than forecast, and launches a booster campaign. Their campaign agent
> loads the expected orders into the system.
>
> **This app is what the Production Line Manager sees next.** New demand has landed. They ask the
> operations agent to place the production orders — and it finds a blocker: a five-day maintenance
> window inside the month. Asking Copilot, an **ontology-based query** determines that running the
> line at **90 %** would defer that maintenance by **four weeks**, creating enough capacity to
> fulfil the campaign.

The product is **Hydration Sunscreen SPF 50**, 200 ml bottle, on a nine-station line.

**[▶ Demo script with talking points →](./DEMO.md)**

---

## What it demonstrates

| Microsoft IQ layer | In the demo |
|---|---|
| **Work IQ** | Surfaces the campaign that changed the plan — the Teams approval, the brief, the demand workbook the campaign agent wrote back to. |
| **Web IQ** | Grounds *why* in live public sources: the ENSO / El Niño outlook and weather-elastic suncare demand. |
| **Fabric IQ · Operations Agent** | Monitors the line against the ontology, attempts to place orders, detects the maintenance blocker, then commits the revised plan. |
| **Fabric IQ · Ontology** | The reasoning step — a 7-hop traversal from `DemandPlan` to `DegradationModel` that produces the counter-intuitive answer. |

## The insight the demo lands

Running **slower** produces **more**:

| | 100 % speed | 90 % speed |
|---|---|---|
| Units per day | 88.6 k | 85.3 k ↓ |
| Remaining useful life, FL-02 | 12 days | 39 days ↑ |
| Maintenance window PM-4471 | day 12, **inside** the month | ~day 40, **outside** |
| Production days | 25 | **30** |
| **Monthly output** | **2.21 M** | **2.56 M** ↑ |
| Demand coverage (2.48 M committed) | 89 % ✗ | **103 % ✓** |
| Line OEE | 76.9 % | 74.1 % ↓ |

Note the last row. **OEE goes down while output goes up** — optimising the KPI on the wall gives
the wrong answer, because OEE has no concept of the maintenance calendar. The ontology does.

---

## Run locally

```powershell
node server.js
# → http://localhost:5173
npm test        # 60+ assertions over the model and the narrative
```

Any static file server works — there is nothing to compile.


---

## The line

Nine stations across compounding, packing and despatch, with the building shell, mezzanine,
racking, overhead services and gowned operators.

| Station | Tag | What it is |
|---|---|---|
| Raw Material Dispensing | `RM-01` | Gravimetric dispensing of UV filters, emollients, emulsifiers, thickener |
| Oil & Water Phase Vessels | `PV-01` | Jacketed vessels, both phases to ~78 °C |
| Vacuum Emulsifier | `EM-01` | High-shear rotor-stator homogenisation; droplet size sets SPF delivery |
| Bulk Hold & QC Release | `QC-01` | Viscosity, pH, in-vitro SPF, micro; batch held until released |
| **Servo Piston Filler** | `FL-02` | **The constraint asset** — 12 heads, 120 bpm rated, carries PM-4471 |
| Capper & Induction Sealer | `CP-01` | Flip-top closures to torque, foil seal |
| Wrap Labeller & Coder | `LB-01` | Pressure-sensitive labelling, vision check, batch code |
| Cartoner & Palletiser | `PK-01` | Shelf-ready cases, palletising robot, stretch wrap |
| CIP Skid & Utilities | `CIP-01` | Clean-in-place, changeovers, purified water |

## Interaction

- **Step through the story** with `→` / `←` in the Agent workspace, or jump to any step.
- **Drag the line speed setpoint** and watch the maintenance window physically slide along the
  month plan. At 92 % it snaps back into the month — that cliff is the whole argument.
- **Click any machine** for a drawer with its parameters, normal operating band, live status and
  materials. Everything recomputes as you drag.
- The **output-vs-speed curve** is coloured green where maintenance falls outside the month and
  red where it does not, so the discontinuity is visible at a glance.
- Stations are **dark when healthy** and light only on a real problem, on hover, or when selected.

## What is actually modelled

| Domain | Model |
|---|---|
| Capacity | theoretical × speed × availability × quality, over the production days that survive the maintenance window |
| Availability | Planned downtime from CIP and changeovers, plus micro-stoppages that rise sharply above the resonance knee |
| Asset degradation | Damage ∝ load³ (ISO 281 load–life), amplified by a resonance band modelled as a sigmoid knee at 92 % of rated speed |
| Vibration | Broadband severity mapped to **ISO 20816** zones A/B/C/D |
| Remaining useful life | Fatigue budget consumed at the damage rate; the PM date is an *output*, not a fixed calendar entry |
| Emulsion quality | Droplet size from shear and time; in-vitro SPF delivery against a 92 % release limit |
| Packing quality | Speed-driven rejects, torque window, label placement, fill tolerance |
| Demand | Baseline plan plus campaign uplift, coverage and OTIF risk |

Values are demo-grade approximations from public literature and standards — illustrative,
**not validated for real manufacturing**. The 4-week deferral requires the resonance effect,
not pure load–life scaling alone; `research.md` and `DEMO.md` say so plainly.

## Files

```
index.html                 shell + Three.js import map
src/line.js                the production model (pure, dependency-free, unit-testable)
src/scenario.js            the agent narrative, citations and the ontology graph
src/factory.js             building shell, machines, materials, conveyors
src/app.js                 render loop, agent console, timeline, curves, drawer
src/ui.css                 command-center UI
scripts/test-line.mjs      model + narrative assertions, run in CI
server.js                  dependency-free static server
DEMO.md                    presenter script
research.md                cited research compendium
staticwebapp.config.json   Azure Static Web Apps routing/headers
```

## Deployment

Hosted on **Azure Static Web Apps** (resource group `rg-iq-day4-rlt`, app `swa-iq-day4-rlt`).
Pushes to `main` are published automatically by the GitHub Actions workflow in
`.github/workflows/`. There is no build step — the repository root is served as-is.

## Tech

Three.js r169 (WebGL2), PMREM environment lighting, ACES filmic tone mapping, PCF soft shadows and an
UnrealBloom pass, all loaded from a CDN import map. No bundler, no framework, no dependencies.
