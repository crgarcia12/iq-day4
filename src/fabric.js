// ===========================================================================
// Fabric data binding.
//
// The lakehouse `caldova_ops` in the Fabric workspace `caldova-iq` is the
// source of truth. `infra/export_snapshot.ps1` runs the SQL analytics endpoint
// queries and writes src/data/fabric-snapshot.json; the browser cannot hold
// Fabric credentials, so it reads that signed snapshot instead of querying
// Fabric directly.
//
// If the snapshot is missing or malformed the app falls back to its built-in
// constants, so the demo can never fail to open.
// ===========================================================================

export const FABRIC = {
  loaded: false,
  source: null,
  raw: null,
};

const num = v => (typeof v === 'number' ? v : parseFloat(v));

export async function loadFabricSnapshot(url = './src/data/fabric-snapshot.json') {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const s = await res.json();
    if (!s || !s.source || !s.demand) throw new Error('snapshot missing required sections');

    FABRIC.raw = s;
    FABRIC.source = s.source;
    FABRIC.loaded = true;

    // ---- demand -----------------------------------------------------------
    FABRIC.demand = {
      baseline: num(s.demand.baseline),
      campaignUplift: num(s.demand.uplift),
      committed: num(s.demand.committed),
      planDays: num(s.demand.plan_days),
      planMonth: s.demand.plan_month,
    };
    FABRIC.demandDaily = (s.demandDaily || []).map(d => ({
      date: d.plan_date,
      baseline: num(d.baseline_units),
      uplift: num(d.campaign_uplift_units),
      committed: num(d.committed_units),
    }));

    // ---- constraint asset and its live condition --------------------------
    FABRIC.asset = {
      id: s.asset.asset_id,
      name: s.asset.asset_name,
      component: s.asset.component_type,
      ratedCapacity: num(s.asset.rated_capacity),
      kneePct: num(s.asset.resonance_knee_pct),
      standard: s.asset.vibration_standard,
      damageConsumed: num(s.condition ? s.condition.damage_consumed_pct : s.asset.damage_consumed_pct),
    };
    FABRIC.condition = s.condition ? {
      ts: s.condition.ts,
      rate: num(s.condition.line_rate_pct),
      vibration: num(s.condition.vibration_mm_s),
      zone: s.condition.iso20816_zone,
      bearingTemp: num(s.condition.bearing_temp_c),
      current: num(s.condition.drive_current_a),
    } : null;
    FABRIC.telemetry = (s.telemetry || []).map(t => ({
      date: t.d, vibration: num(t.vib), damage: num(t.damage),
    }));

    // ---- maintenance ------------------------------------------------------
    FABRIC.maintenance = s.maintenance ? {
      id: s.maintenance.order_id,
      asset: s.maintenance.asset_id,
      trigger: s.maintenance.trigger_type,
      status: s.maintenance.status,
      durationDays: num(s.maintenance.duration_days),
      description: s.maintenance.description,
      basis: s.maintenance.basis,
    } : null;

    // ---- observed performance --------------------------------------------
    FABRIC.oee = s.oee ? {
      oee: num(s.oee.oee),
      availability: num(s.oee.availability),
      quality: num(s.oee.quality),
      rate: num(s.oee.rate),
      goodUnits: num(s.oee.good_units),
      days: num(s.oee.days),
    } : null;

    // ---- the what-if curve computed in the lakehouse ----------------------
    FABRIC.scenarios = (s.scenarios || []).map(r => ({
      rate: num(r.line_rate_pct),
      rul: num(r.rul_days),
      pmStartDay: num(r.pm_start_day),
      lostDays: num(r.lost_days),
      productionDays: num(r.production_days),
      daily: num(r.daily_units),
      monthly: num(r.monthly_units),
      vibration: num(r.vibration_mm_s),
      zone: r.iso20816_zone,
      damageFactor: num(r.damage_factor),
      oee: num(r.oee_pct),
    }));

    // ---- ontology ---------------------------------------------------------
    if (s.ontology && s.ontology.entities) {
      FABRIC.ontology = {
        entities: s.ontology.entities.map(e => ({
          entity: e.entity, instance: e.instance, kind: e.kind,
          table: e.bound_table, column: e.bound_column,
        })),
        edges: (s.ontology.edges || []).map(e => ({
          from: e.from_entity, rel: e.relationship, to: e.to_entity,
        })),
      };
    }

    FABRIC.product = s.product ? {
      sku: s.product.sku,
      name: s.product.product_name,
      pack: s.product.pack,
      unitPrice: num(s.product.unit_price_gbp),
      unitMargin: num(s.product.unit_margin_gbp),
      casePack: num(s.product.case_pack),
      casesPerPallet: num(s.product.cases_per_pallet),
    } : null;

    console.info('[Fabric] snapshot loaded from %s / %s, exported %s',
      s.source.workspace, s.source.lakehouse, s.source.exportedUtc);
    return FABRIC;
  } catch (err) {
    console.warn('[Fabric] snapshot unavailable, using built-in defaults:', err.message);
    FABRIC.loaded = false;
    FABRIC.error = err.message;
    return FABRIC;
  }
}

/** Human-readable provenance line for the UI. */
export function provenance() {
  if (!FABRIC.loaded) return 'Built-in demo data (Fabric snapshot unavailable)';
  const s = FABRIC.source;
  const when = s.exportedUtc ? new Date(s.exportedUtc) : null;
  const ago = when ? `${when.toISOString().slice(0, 16).replace('T', ' ')} UTC` : 'unknown';
  return `Microsoft Fabric · ${s.workspace} / ${s.lakehouse} · exported ${ago}`;
}
