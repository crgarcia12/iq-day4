# Research compendium — Caldova suncare line digital twin

Sources and calibration behind **Suncare Line 3 — Operations Command Center**
(Persona 2, Production Line Manager). Every constant in `src/line.js` traces back here.

Demo-grade approximations for a conference demonstration — **not validated for real
manufacturing**.

---

## 1. The central claim, honestly stated

The demo asserts: **dropping the filler from 100 % to 90 % of rated speed extends remaining
useful life from ~12 days to ~39 days, deferring a 5-day maintenance window by about 4 weeks.**

**Verdict: defensible, but conditional on one assumption — which the app prints on screen.**

| Mechanism | Life multiplier at 90 % | Enough on its own? |
|---|---|---|
| ISO 281 speed scaling, constant load | **×1.11** | No — 12 d → ~13 d |
| ISO 281 load scaling, 10 % less load | **×1.37** | No |
| Combined, load ∝ n² (centrifugal-dominant) | ×2.06 | Not quite |
| **Leaving the resonance band (modelled here)** | **×3.26** | **Yes — 12 d → ~39 d** |

The gain therefore comes from the drive dropping out of a **structural resonance band**, not
from load–life scaling. At 100 % the drive reads ~3.3 mm/s RMS — **ISO 20816-3 zone C** for a
Class II machine; at 90 % it reads ~2.0 mm/s — **zone B**. With Miner's-rule cumulative damage
scaling on vibration amplitude, that is roughly a 3.3× lower damage rate.

This is **machine-specific and depends on measured vibration**. Without condition data
confirming near-resonance operation at rated speed, the claim overstates L10 theory by ~3×.
That is exactly why the recommendation in the demo stays *condition-based* rather than becoming
a new fixed setpoint — if the signal deviates from the model, the window returns.

**Caveat printed in the app (step 4, "Model transparency"):**

> Deferral assumes the drive operates near structural resonance at 100 % rated speed
> (ISO 20816-3 zone C, ~3.3 mm/s RMS, Class II). At 90 % vibration drops to zone B
> (~2.0 mm/s), reducing the Miner's-rule damage rate ~3.3×. Pure ISO 281 L10 speed scaling
> alone would yield only about +11 % service hours.

---

## 2. ISO 281 — bearing rating life

```
L10h = (10^6 / 60n) · (C/P)^p
```

- `n` = speed in rpm, `C` = basic dynamic load rating, `P` = equivalent dynamic bearing load
- `p = 3` for ball bearings, `p = 10/3` for roller bearings
- Life in **revolutions** converts to life in **hours** by dividing by speed — this is why
  slowing a machine extends calendar life even at constant load [1][2][3]

Worked multipliers at 90 %:

| Change | Multiplier |
|---|---|
| 90 % load, constant speed | (1/0.9)³ = **×1.372** |
| 90 % speed, constant load | 1/0.9 = **×1.111** |
| 90 % speed with load ∝ n² | ×1.111 × (1/0.81)³ = **×2.06** |

## 3. ISO 20816-3 — vibration severity zones

A bottle-filler main drive (15–300 kW, rigid mounting) is a **Class II** machine [4].

| Zone | Class II boundary (mm/s RMS) | Meaning |
|---|---|---|
| A | < 1.12 | newly commissioned |
| B | 1.12 – 2.80 | acceptable for long-term operation |
| C | 2.80 – 7.10 | unsatisfactory — restricted operation |
| D | > 7.10 | damaging — risk of failure |

Cumulative damage toward the maintenance threshold uses **Miner's linear damage rule** [18].

## 4. Model calibration

| Parameter | Realistic range | Used in the demo | Ref |
|---|---|---|---|
| Filler speed, personal-care lotion | 30–120 bpm | 120 bpm rated | [5] |
| Fill volume tolerance, servo piston filler | ±0.5 % | ±0.5 % nominal | [5] |
| OEE, cosmetics / personal-care packaging | 55–70 % typical, 85 % world-class | 76.9 % at 100 %, 74.1 % at 90 % | [7] |
| CIP cycle time | 0.5–1.5 h cosmetics; 1–2 h validated OTC | 2 h, normal band 1–2 h | [8] |
| Emulsification temperature | 70–80 °C, both phases separately | 75 °C, band 70–80 °C | [10] |
| Homogeniser speed | 3 000–10 000 rpm (tip speed 10–40 m/s) | 5 000 rpm, band 3 000–8 000 | [12] |
| Target emulsion droplet D50 | 2–5 µm | 4.2 µm at nominal | [12] |
| Sunscreen emulsion pH | 5.5–7.0 | not modelled | [13] |
| Capping torque, 28–38 mm closure | 12–26 lbf·in | 16, band 12–26 | [16] |
| Case pack | 24 × 100 ml typical | 12 × 200 ml *[unverified]* | — |

## 5. Regulatory framing

Sunscreen is regulated differently by market, which is why the line is run to drug-grade
discipline:

- **United States** — an **OTC monograph drug**, manufactured under cGMP, 21 CFR parts 210/211
- **European Union** — a **cosmetic** under Regulation (EC) No 1223/2009
- **Both** — **ISO 22716** cosmetics GMP is the common manufacturing baseline

SPF is verified by **in-vitro** testing for routine batch release, with **in-vivo** testing
reserved for label-claim substantiation rather than per-batch release. The demo models an
in-vitro SPF release limit at 92 % of label claim.

## 6. Demand side — El Niño and suncare

ENSO status is published by the **NOAA Climate Prediction Center** in a monthly *ENSO
Diagnostic Discussion*, phrased as advisories such as "El Niño conditions are present and are
expected to continue, with a transition to ENSO-neutral now favoured later than previously
indicated." A forecast extension of El Niño implies a longer high-UV season, and suncare
sell-through is strongly weather- and UV-elastic — which is the external signal Web IQ surfaces
in step 2 and the justification for the campaign uplift.

Specific published sales-per-degree or sales-per-UV-index elasticity figures were **not
verified** to a citable primary source in this pass; the demo therefore states the relationship
qualitatively rather than quoting a number. *[unverified]*

---

## 7. References

1. ISO 281:2007 — Rolling bearings, dynamic load ratings and rating life — https://www.iso.org/standard/38102.html
2. SKF — Bearing rating life — https://www.skf.com/uk/products/rolling-bearings/principles-of-rolling-bearing-selection/bearing-rating-life
3. PIB Sales — Life calculations for bearings — https://pibsales.com/tutorials/life-calculations-for-bearings/
4. ISO 20816-3:2022, vibration severity zones — https://vibromera.eu/calculators/vibration-severity-chart/
5. Cozzoli — personal-care filling machines — https://www.cozzoli.com/type/personal-care-filling-machines/
7. TeepTrak — OEE benchmark — https://teeptrak.com/en/oee-benchmark-2026/
8. Clean-in-place system guide — https://processnavigation.com/insights/clean-in-place-system/
10. Quadro Liquids — manufacturing of sunblocks and creams — https://www.quadroliquids.com/blog/manufacturing-of-sunblocks-and-creams
12. Silverson — high-shear homogenisers — https://www.silverson.com/us/products/homogenizers/
13. Nanoemulsion sunscreen study (PMC) — https://pmc.ncbi.nlm.nih.gov/articles/PMC7048364/
16. Kinex Cappers — closure torque guidelines — https://www.kinexcappers.com/faq/torque-guidelines.htm
18. Miner's rule, linear damage — https://www.engineersedge.com/material_science/miners_rule_linear_damage_rule_15356.htm

---
