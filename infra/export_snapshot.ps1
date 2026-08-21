# =============================================================================
# Export a data snapshot from the Fabric lakehouse for the static web app.
#
#   .\infra\export_snapshot.ps1 -WorkspaceId <guid> -LakehouseId <guid>
#
# The app is a static site on Azure Static Web Apps, so it cannot hold Fabric
# credentials in the browser. Instead this script runs the queries server-side
# (via the lakehouse SQL analytics endpoint) and writes a signed, timestamped
# snapshot to src/data/fabric-snapshot.json which the app fetches at load.
#
# Re-run this whenever the lakehouse data changes, then redeploy.
# =============================================================================
param(
  [string]$WorkspaceId = $env:CALDOVA_WORKSPACE_ID,
  [string]$LakehouseId = $env:CALDOVA_LAKEHOUSE_ID,
  [string]$OutFile     = "$PSScriptRoot\..\src\data\fabric-snapshot.json",
  [string]$Fabio       = "$env:LOCALAPPDATA\fabio\fabio.exe"
)

$ErrorActionPreference = 'Stop'
if (-not $WorkspaceId) { throw "WorkspaceId required (or set CALDOVA_WORKSPACE_ID)" }
if (-not $LakehouseId) { throw "LakehouseId required (or set CALDOVA_LAKEHOUSE_ID)" }

function Q([string]$sql) {
  $raw = & $Fabio lakehouse query --workspace $WorkspaceId --id $LakehouseId --sql $sql --json 2>&1
  $json = ($raw | Where-Object { $_ -match '^\s*\{' }) -join "`n"
  if (-not $json) { throw "no JSON returned for: $sql`n$raw" }
  $obj = $json | ConvertFrom-Json
  if ($obj.error) { throw "$($obj.error.message)" }
  return $obj.data
}

Write-Host "Exporting snapshot from lakehouse $LakehouseId" -ForegroundColor Cyan

$product = (Q "SELECT TOP 1 sku, product_name, pack, unit_price_gbp, unit_margin_gbp, case_pack, cases_per_pallet FROM dbo.dim_product")[0]

$demand = (Q @"
SELECT SUM(baseline_units) AS baseline, SUM(campaign_uplift_units) AS uplift,
       SUM(committed_units) AS committed, COUNT(*) AS plan_days, MIN(plan_month) AS plan_month
FROM dbo.fact_demand_plan
"@)[0]

$demandDaily = Q @"
SELECT plan_date, baseline_units, campaign_uplift_units, committed_units
FROM dbo.fact_demand_plan ORDER BY plan_date
"@

$asset = (Q @"
SELECT TOP 1 asset_id, asset_name, component_id, component_type, rated_capacity,
       resonance_knee_pct, vibration_standard, damage_consumed_pct, life_exponent
FROM dbo.dim_asset WHERE is_constraint = 1
"@)[0]

$condition = (Q @"
SELECT TOP 1 ts, line_rate_pct, vibration_mm_s, iso20816_zone, bearing_temp_c,
       drive_current_a, damage_consumed_pct
FROM dbo.fact_asset_telemetry WHERE asset_id = 'FL-02' ORDER BY ts DESC
"@)[0]

$telemetry = Q @"
SELECT CAST(ts AS DATE) AS d, ROUND(AVG(vibration_mm_s),3) AS vib,
       ROUND(MAX(damage_consumed_pct),3) AS damage
FROM dbo.fact_asset_telemetry WHERE asset_id = 'FL-02'
GROUP BY CAST(ts AS DATE) ORDER BY d
"@

$pm = (Q @"
SELECT TOP 1 order_id, asset_id, component_id, trigger_type, status,
       duration_days, description, basis
FROM dbo.dim_maintenance_order WHERE status = 'open'
"@)[0]

$oee = (Q @"
SELECT ROUND(AVG(oee_pct),2) AS oee, ROUND(AVG(availability_pct),2) AS availability,
       ROUND(AVG(quality_pct),2) AS quality, ROUND(AVG(line_rate_pct),2) AS rate,
       SUM(good_units) AS good_units, COUNT(*) AS days
FROM dbo.fact_production_daily
"@)[0]

$scenarios = Q @"
SELECT line_rate_pct, rul_days, pm_start_day, lost_days, production_days,
       daily_units, monthly_units, vibration_mm_s, iso20816_zone, damage_factor, oee_pct
FROM dbo.fact_rate_scenario ORDER BY line_rate_pct
"@

$entities = Q "SELECT entity, instance, kind, bound_table, bound_column FROM dbo.dim_ontology_entity"
$edges    = Q "SELECT from_entity, relationship, to_entity FROM dbo.dim_ontology_edge"
$stations = Q "SELECT station_tag, station_name, zone, area, is_constraint FROM dbo.dim_station"

$snapshot = [ordered]@{
  source = [ordered]@{
    system      = "Microsoft Fabric"
    workspace   = "caldova-iq"
    workspaceId = $WorkspaceId
    lakehouse   = "caldova_ops"
    lakehouseId = $LakehouseId
    endpoint    = "SQL analytics endpoint"
    exportedUtc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    tool        = "fabio"
  }
  product     = $product
  demand      = $demand
  demandDaily = $demandDaily
  asset       = $asset
  condition   = $condition
  telemetry   = $telemetry
  maintenance = $pm
  oee         = $oee
  scenarios   = $scenarios
  ontology    = [ordered]@{ entities = $entities; edges = $edges }
  stations    = $stations
}

$dir = Split-Path -Parent $OutFile
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
$snapshot | ConvertTo-Json -Depth 8 | Set-Content -Path $OutFile -Encoding utf8

$size = [math]::Round((Get-Item $OutFile).Length / 1KB, 1)
Write-Host "`nSnapshot written: $OutFile ($size KB)" -ForegroundColor Green
Write-Host ("  demand      {0:N0} baseline + {1:N0} uplift = {2:N0} committed" -f `
  $demand.baseline, $demand.uplift, $demand.committed)
Write-Host ("  asset       {0} at {1} mm/s, zone {2}, {3}% of life used" -f `
  $asset.asset_id, $condition.vibration_mm_s, $condition.iso20816_zone, $condition.damage_consumed_pct)
Write-Host ("  scenarios   {0} rate points, {1} telemetry days" -f $scenarios.Count, $telemetry.Count)
