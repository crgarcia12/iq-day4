# Demo script — Persona 2: the Production Line Manager

**Runtime: about 4 minutes.** Everything is driven from the *Agent workspace* on the right.
`→` / `←` step through, `⟲` restarts. Each step changes the live model, so the 3D line,
the KPIs, the month plan and the output curve all move with the story.

The scenario picks up immediately after Persona 1 (the Marketing Manager) has approved a
booster campaign for **Hydration Sunscreen SPF 50** and their campaign agent has loaded the
expected orders.

---

## What this demonstrates

| Layer | Where it appears | What it does here |
|---|---|---|
| **Work IQ** | Step 1 | Surfaces the campaign that landed on the plan — the Teams approval, the campaign brief and the demand workbook the campaign agent wrote back to. |
| **Web IQ** | Step 2 | Explains *why*, grounded in live public sources: El Niño is forecast to persist longer than the earlier outlook, extending the high-UV season. |
| **Fabric IQ · Operations Agent** | Steps 3 and 5 | Monitors the line against the ontology, tries to place the orders, detects the maintenance blocker, and finally commits the plan. |
| **Fabric IQ · Ontology** | Step 4 | The reasoning step. A 7-hop traversal from the demand plan to the degradation model produces the counter-intuitive answer. |

---

## Step 0 — Situation

> "This is Suncare Line 3. Nine stations, from raw material dispensing through to palletising."

- Line runs at **100 % of rated speed** — 120 bottles/min.
- Committed demand **2.12 M units**, capacity **2.21 M** — comfortable.
- Note the **filler FL-02 is already amber**. There is an open condition-based maintenance
  order against it. Click the machine to see it.

*Talking point: the plan is fine. Nothing is wrong yet.*

---

## Step 1 — Campaign lands · **Work IQ**

> "I come in Monday morning and my demand plan has changed underneath me."

- Demand jumps **2.12 M → 2.48 M** (+360 k, +17 %).
- Watch the **amber demand line** on the month plan jump above the production curve.
- The grounding is internal: a Teams thread, the campaign brief in SharePoint, and the
  firm planned orders the campaign agent wrote at 07:12.

*Talking point: Work IQ is not searching documents. It understands that a campaign
approval and a demand workbook write-back are the same event.*

---

## Step 2 — Why · **Web IQ**

> "Before I spend money reacting to this, I want to know if it is real."

- El Niño forecast to persist longer than previously indicated → extended high-UV season.
- Suncare sell-through is strongly weather-elastic, so this is a season extension, not a
  one-week promotion.

*Talking point: the internal signal came from Work IQ; the reason it is credible comes from
Web IQ. Same conversation, two different knowledge boundaries.*

---

## Step 3 — Orders blocked · **Fabric IQ Operations Agent**

> "Fine. Place the orders."

- The agent runs the schedule and **refuses**.
- **PM-4471** opens on **day 12** and takes **5 days** out of the month.
- 30 production days → **25**. Capacity **2.21 M** against **2.48 M** committed.
- **Short by ~266 k units.**
- The filler goes red; the andon stack light on the machine turns red.

*Talking point: this is the Operations Agent doing its actual job — it monitored a condition
signal, related it to a business concept (a maintenance window), and refused to commit
something it knew would fail.*

---

## Step 4 — The answer · **Fabric IQ Ontology** ⭐

> "Can I do anything about that maintenance window? I need the whole month."

**This is the moment of the demo.** Watch the ontology graph build hop by hop:

```
DemandPlan → CapacityModel → ProductionLine → Asset FL-02
           → Component (main drive bearing) → DegradationModel → MaintenancePolicy
```

The answer:

- PM-4471 is **condition-based, not calendar-based** — its date is an *output* of how hard
  you run the asset.
- Bearing damage scales with **load cubed** (ISO 281), and above **92 % of rated speed** the
  drive enters its **resonance band**, crossing from ISO 20816-3 **zone B (~2.0 mm/s RMS) into
  zone C (~3.3 mm/s)**. Damage then accrues **3.3× faster**.
- At 90 % speed: remaining life **12 days → 39 days**. PM-4471 moves **~4 weeks** out — into
  next month.
- You lose 10 % of daily rate, but win back **5 production days**.
- Monthly output **2.21 M → 2.56 M**. Demand covered.

Click **Apply recommendation**.

*Talking point: no single dashboard would have told you this. The relationship that mattered
was between a demand plan and a bearing. That relationship lives in the ontology.*

---

## Step 5 — Commit

- Setpoint written, PM-4471 rescheduled, orders released.
- Coverage **103 %**. The month plan turns green and the curve crosses the demand line.
- Condition monitoring stays live — if the vibration deviates from the model, the window
  comes back automatically.

---

## The best interactive moment

**Drag the "Line speed setpoint" slider** at the bottom right, slowly, from 85 % upward.

- The **PM window** slides along the month plan as remaining useful life changes.
- At **92 %** it snaps back into the month and 5 days go red. That is the cliff.
- The **output-vs-speed curve** shows it directly: the green segment is where maintenance
  falls outside the month, the red segment is where it does not. The discontinuity between
  91 % and 92 % is worth more than 10 % of line speed.

This is the whole argument in one gesture: **the fastest setpoint is not the most productive one.**

---

## Questions you will get

**"Is the 4-week deferral realistic?"**
It is defensible, but it rests on one assumption and the app states it on screen: that the drive
runs near structural resonance at rated speed. At 100 % it reads ~3.3 mm/s RMS — **ISO 20816-3
zone C** for a Class II machine; at 90 % it drops to ~2.0 mm/s, **zone B**. With Miner's-rule
damage scaling on vibration amplitude that is roughly a 3.3× lower damage rate, which is what
turns 12 days of remaining life into ~39.

Pure **ISO 281** scaling alone would not get you there: at constant load, 90 % speed gives only
**×1.11** on life-hours (12 → ~13 days), and even a 10 % load reduction gives just **×1.37**.
So the honest position is: *this is a machine-specific result that depends on measured vibration,
not a universal rule* — which is precisely why the recommendation stays condition-based rather
than becoming a new fixed setpoint.

**"Why not just run at 91 %? The curve is slightly higher."**
It is, by about 0.1 %. It also sits one percentage point from a cliff that costs five
production days. The agent recommends 90 % for the margin, not the maximum.

**"OEE went down. Isn't that bad?"**
Yes — and that is the point. OEE falls from 76.9 % to 74.1 % while monthly output rises
by 15.7 %. Optimising the KPI on the wall would have given you the wrong answer, because
OEE has no concept of the maintenance calendar. The ontology does.

**"What if the model is wrong?"**
The trigger stays condition-based. The agent keeps watching the real vibration signal; if
the asset degrades faster than modelled, the window returns and the plan is re-cut.

---

## Also worth showing

- **Click any machine** for its parameters, normal operating band and live status.
- Drop the **emulsifier shear speed** below ~1 500 rpm: droplet size goes coarse, in-vitro
  SPF drops below the 92 % release limit, and the batch fails QC — output goes to zero.
  A good reminder that this is a regulated product (OTC drug in the US, ISO 22716 in the EU).
- Add **changeovers** on the CIP station to watch planned downtime eat the capacity you just
  won back.
