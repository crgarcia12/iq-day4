#!/usr/bin/env python3
"""
Generate the Caldova Suncare Line 3 operational dataset.

Produces CSVs that are loaded into the Fabric lakehouse `caldova_ops`. The
numbers come from the same physics the app models (ISO 281 load-life damage
with a resonance knee, ISO 20816-3 severity zones), so the lakehouse is the
source of truth and the UI is a view over it.

Usage:  python infra/generate_data.py --out infra/data
"""
import argparse, csv, json, math, os, random
from datetime import datetime, timedelta, timezone

random.seed(20260321)  # deterministic: reruns reproduce the same demo

# --------------------------------------------------------------------------
# Line constants — mirror src/line.js
# --------------------------------------------------------------------------
RATED_BPM = 120
SHIFT_HOURS = 16
HORIZON_DAYS = 30
PM_DURATION_DAYS = 5
KNEE_PCT = 92.0
KNEE_WIDTH = 2.0
KNEE_AMP = 4.0
LOAD_EXP = 3.0
BASE_DAMAGE_PER_DAY = 0.406
VIB_BASE = 1.861
VIB_KNEE_RISE = 1.465
DAMAGE_CONSUMED = 76.0

PLAN_MONTH = "2026-03"
PLAN_START = datetime(2026, 3, 1, tzinfo=timezone.utc)

sigmoid = lambda x: 1.0 / (1.0 + math.exp(-x))


def damage_factor(rate_pct: float) -> float:
    load = (rate_pct / 100.0) ** LOAD_EXP
    resonance = 1.0 + KNEE_AMP * sigmoid((rate_pct - KNEE_PCT) / KNEE_WIDTH)
    return load * resonance


def vibration(rate_pct: float) -> float:
    return (VIB_BASE * (rate_pct / 100.0) ** 1.4
            + VIB_KNEE_RISE * sigmoid((rate_pct - KNEE_PCT) / KNEE_WIDTH))


def vib_zone(mmps: float) -> str:
    if mmps < 1.12: return "A"
    if mmps <= 2.80: return "B"
    if mmps <= 7.10: return "C"
    return "D"


def write(path, rows, header):
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(header)
        w.writerows(rows)
    print(f"  {os.path.basename(path):28} {len(rows):6d} rows")


# --------------------------------------------------------------------------
def gen_stations():
    return [
        ("RM-01",  "Raw Material Dispensing",   "Warehouse",    "compounding", 0),
        ("PV-01",  "Oil & Water Phase Vessels", "Compounding",  "compounding", 0),
        ("EM-01",  "Vacuum Emulsifier",         "Compounding",  "compounding", 0),
        ("QC-01",  "Bulk Hold & QC Release",    "Laboratory",   "quality",     0),
        ("FL-02",  "Servo Piston Filler",       "Packing hall", "packing",     1),
        ("CP-01",  "Capper & Induction Sealer", "Packing hall", "packing",     0),
        ("LB-01",  "Wrap Labeller & Coder",     "Packing hall", "packing",     0),
        ("PK-01",  "Cartoner & Palletiser",     "Despatch",     "packing",     0),
        ("CIP-01", "CIP Skid & Utilities",      "Technical",    "utilities",   0),
    ]


def gen_telemetry():
    """90 days of hourly condition monitoring on the constraint asset FL-02.

    The line has been held at 100 % of rated, so the drive sits in ISO 20816-3
    zone C and burns roughly 2 % of the bearing's fatigue budget per day. At
    that rate the 76 % consumed today corresponds to a bearing fitted ~38 days
    ago, so the series carries a visible reset where the previous bearing was
    replaced (PM-4468). That sawtooth is what a real CMMS history looks like.
    """
    rows = []
    start = PLAN_START - timedelta(days=90)
    daily_at_100 = BASE_DAMAGE_PER_DAY * damage_factor(100.0)
    fitted_days_ago = DAMAGE_CONSUMED / daily_at_100          # ~38 days
    reset_hour = int((90 - fitted_days_ago) * 24)
    # the previous bearing was already well used when the window opens
    consumed = 100.0 - reset_hour * (daily_at_100 / 24.0)
    consumed = max(4.0, consumed)
    for h in range(90 * 24):
        ts = start + timedelta(hours=h)
        rate = max(88.0, min(102.0, 100.0 + random.gauss(0, 0.6)))
        v = vibration(rate) + random.gauss(0, 0.045)
        temp = 41.0 + (v - 3.0) * 3.4 + random.gauss(0, 0.7)
        current = 18.4 * (rate / 100.0) + random.gauss(0, 0.25)
        if h == reset_hour:
            consumed = 0.0                                     # bearing replaced
        consumed += (BASE_DAMAGE_PER_DAY * damage_factor(rate)) / 24.0
        rows.append((
            ts.strftime("%Y-%m-%d %H:%M:%S"), "FL-02", "main_drive_bearing",
            round(rate, 2), round(v, 3), vib_zone(v),
            round(temp, 2), round(current, 2), round(min(100.0, consumed), 3),
        ))
    return rows


def gen_demand_plan():
    baseline_total, uplift_total = 2_120_000, 360_000
    weights = []
    for d in range(HORIZON_DAYS):
        day = PLAN_START + timedelta(days=d)
        w = 0.35 if day.weekday() >= 5 else 1.0        # weekend despatch is light
        w *= 1.0 + 0.12 * math.sin(d / 4.5)            # retailer call-off rhythm
        weights.append(w)
    tot = sum(weights)
    rows = []
    for d in range(HORIZON_DAYS):
        day = PLAN_START + timedelta(days=d)
        base = round(baseline_total * weights[d] / tot)
        up = round(uplift_total * weights[d] / tot)
        rows.append((day.strftime("%Y-%m-%d"), PLAN_MONTH, "HS-SPF50-200",
                     base, up, base + up))
    return rows


def gen_production_history():
    rows = []
    start = PLAN_START - timedelta(days=31)
    for d in range(31):
        day = start + timedelta(days=d)
        rate = 100.0 + random.gauss(0, 0.8)
        theoretical = RATED_BPM * 60 * SHIFT_HOURS
        cip = 2.0 if d % 3 == 0 else 0.0
        planned_avail = (SHIFT_HOURS - cip) / SHIFT_HOURS
        stops = 0.030 + 0.075 * sigmoid((rate - KNEE_PCT) / KNEE_WIDTH) + random.gauss(0, 0.004)
        avail = planned_avail * (1 - max(0.0, stops))
        rejects = 0.004 + 0.014 * sigmoid((rate - KNEE_PCT) / KNEE_WIDTH) + abs(random.gauss(0, 0.001))
        good = round(theoretical * (rate / 100.0) * avail * (1 - rejects))
        rows.append((
            day.strftime("%Y-%m-%d"), "LINE-3", "HS-SPF50-200",
            round(rate, 2), theoretical, good,
            round(theoretical * (rate / 100.0) * avail * rejects),
            round(avail * 100, 2), round((1 - rejects) * 100, 2),
            round(avail * min(1.0, rate / 100.0) * (1 - rejects) * 100, 2),
            round(cip, 1),
        ))
    return rows


def gen_maintenance_orders():
    return [
        ("PM-4471", "FL-02", "main_drive_bearing", "condition_based", "open",
         PM_DURATION_DAYS, 100.0,
         "Main drive bearing and cam follower replacement. Triggered by the "
         "ISO 20816-3 severity zone crossing; line down for the full window.",
         "ISO 281 / ISO 20816-3"),
        ("PM-4468", "EM-01", "homogeniser_seal", "time_based", "closed",
         1, 100.0, "Rotor-stator mechanical seal service, completed last month.",
         "OEM schedule"),
        ("PM-4472", "CP-01", "capping_head", "time_based", "planned",
         1, 100.0, "Capping head torque calibration, due next quarter.",
         "OEM schedule"),
        ("PM-4475", "CIP-01", "dosing_pump", "condition_based", "planned",
         1, 100.0, "Detergent dosing pump diaphragm, monitored on flow deviation.",
         "Condition monitoring"),
    ]


def gen_asset_master():
    return [
        ("FL-02", "Servo Piston Filler", "LINE-3", "packing", RATED_BPM, "bottles/min",
         1, "main_drive_bearing", "6312-C3 deep groove ball", 3,
         KNEE_PCT, "ISO 20816-3 Class II", DAMAGE_CONSUMED),
        ("EM-01", "Vacuum Emulsifier", "LINE-3", "compounding", 2500, "kg/batch",
         0, "homogeniser_seal", "rotor-stator mechanical seal", 3,
         0.0, "ISO 20816-3 Class II", 22.0),
        ("CP-01", "Capper & Induction Sealer", "LINE-3", "packing", RATED_BPM, "bottles/min",
         0, "capping_head", "servo capping spindle", 3,
         0.0, "ISO 20816-3 Class I", 31.0),
    ]


def gen_ontology_bindings():
    return [
        ("Product",           "HS-SPF50-200",            "entity", "dim_product",           "sku"),
        ("DemandPlan",        "March 2026",              "entity", "fact_demand_plan",      "plan_month"),
        ("ProductionLine",    "Caldova Suncare Line 3",  "entity", "dim_station",           "line_id"),
        ("Asset",             "FL-02 Servo Filler",      "asset",  "dim_asset",             "asset_id"),
        ("Component",         "Main drive bearing",      "asset",  "dim_asset",             "component_id"),
        ("ConditionSignal",   "Vibration mm/s RMS",      "signal", "fact_asset_telemetry",  "vibration_mm_s"),
        ("DegradationModel",  "ISO 281 / ISO 20816-3",   "rule",   "fact_asset_telemetry",  "damage_consumed_pct"),
        ("MaintenancePolicy", "PM-4471 condition based", "rule",   "dim_maintenance_order", "order_id"),
        ("CapacityModel",     "days x rate x OEE",       "rule",   "fact_production_daily", "oee_pct"),
    ]


def gen_ontology_edges():
    return [
        ("DemandPlan", "requires", "Product"),
        ("DemandPlan", "constrained by", "CapacityModel"),
        ("Product", "produced on", "ProductionLine"),
        ("ProductionLine", "constraint asset", "Asset"),
        ("ProductionLine", "has capacity", "CapacityModel"),
        ("Asset", "has component", "Component"),
        ("Asset", "emits", "ConditionSignal"),
        ("Component", "degrades per", "DegradationModel"),
        ("ConditionSignal", "feeds", "DegradationModel"),
        ("DegradationModel", "triggers", "MaintenancePolicy"),
        ("MaintenancePolicy", "removes days from", "CapacityModel"),
    ]


def gen_rate_scenarios():
    """The what-if curve: exactly what the ontology query returns."""
    rows = []
    remaining = 100.0 - DAMAGE_CONSUMED
    for r in range(70, 106):
        dmg_day = BASE_DAMAGE_PER_DAY * damage_factor(r)
        rul = remaining / dmg_day
        pm_start = max(1, math.ceil(rul))
        pm_end = pm_start + PM_DURATION_DAYS - 1
        lost = max(0, min(HORIZON_DAYS, pm_end) - max(1, pm_start) + 1)
        days = HORIZON_DAYS - lost
        theoretical = RATED_BPM * 60 * SHIFT_HOURS
        avail = (SHIFT_HOURS - 2.0) / SHIFT_HOURS * (1 - (0.030 + 0.075 * sigmoid((r - KNEE_PCT) / KNEE_WIDTH)))
        qual = 1 - (0.004 + 0.014 * sigmoid((r - KNEE_PCT) / KNEE_WIDTH) + 0.002)
        daily = round(theoretical * (r / 100.0) * avail * qual)
        v = vibration(r)
        rows.append((r, round(rul, 2), pm_start, lost, days, daily, daily * days,
                     round(v, 3), vib_zone(v), round(damage_factor(r), 3),
                     round(avail * min(1.0, r / 100.0) * qual * 100, 2)))
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="infra/data")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    p = lambda n: os.path.join(a.out, n)

    print("Generating Caldova operational dataset")
    write(p("dim_station.csv"), gen_stations(),
          ["station_tag", "station_name", "zone", "area", "is_constraint"])
    write(p("dim_asset.csv"), gen_asset_master(),
          ["asset_id", "asset_name", "line_id", "area", "rated_capacity", "capacity_uom",
           "is_constraint", "component_id", "component_type", "life_exponent",
           "resonance_knee_pct", "vibration_standard", "damage_consumed_pct"])
    write(p("fact_asset_telemetry.csv"), gen_telemetry(),
          ["ts", "asset_id", "component_id", "line_rate_pct", "vibration_mm_s",
           "iso20816_zone", "bearing_temp_c", "drive_current_a", "damage_consumed_pct"])
    write(p("fact_demand_plan.csv"), gen_demand_plan(),
          ["plan_date", "plan_month", "sku", "baseline_units", "campaign_uplift_units", "committed_units"])
    write(p("fact_production_daily.csv"), gen_production_history(),
          ["prod_date", "line_id", "sku", "line_rate_pct", "theoretical_units", "good_units",
           "reject_units", "availability_pct", "quality_pct", "oee_pct", "cip_hours"])
    write(p("dim_maintenance_order.csv"), gen_maintenance_orders(),
          ["order_id", "asset_id", "component_id", "trigger_type", "status",
           "duration_days", "line_down_pct", "description", "basis"])
    write(p("dim_ontology_entity.csv"), gen_ontology_bindings(),
          ["entity", "instance", "kind", "bound_table", "bound_column"])
    write(p("dim_ontology_edge.csv"), gen_ontology_edges(),
          ["from_entity", "relationship", "to_entity"])
    write(p("fact_rate_scenario.csv"), gen_rate_scenarios(),
          ["line_rate_pct", "rul_days", "pm_start_day", "lost_days", "production_days",
           "daily_units", "monthly_units", "vibration_mm_s", "iso20816_zone",
           "damage_factor", "oee_pct"])
    write(p("dim_product.csv"),
          [("HS-SPF50-200", "Hydration Sunscreen SPF 50", "200 ml bottle", 8.40, 3.10, 12, 84)],
          ["sku", "product_name", "pack", "unit_price_gbp", "unit_margin_gbp",
           "case_pack", "cases_per_pallet"])

    meta = {
        "generated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "plan_month": PLAN_MONTH,
        "company": "Caldova",
        "line": "Suncare Line 3",
        "seed": 20260321,
    }
    with open(p("_meta.json"), "w", encoding="utf-8") as fh:
        json.dump(meta, fh, indent=2)
    print(f"\nWritten to {a.out}")


if __name__ == "__main__":
    main()
