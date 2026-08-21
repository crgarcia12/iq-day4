# =============================================================================
# Load the Caldova dataset into the Fabric lakehouse.
#
#   .\infra\load_lakehouse.ps1 -WorkspaceId <guid> -LakehouseId <guid>
#
# Uses fabio (https://github.com/iemejia/fabio) — upload + Delta load per table.
# =============================================================================
param(
  [string]$WorkspaceId = $env:CALDOVA_WORKSPACE_ID,
  [string]$LakehouseId = $env:CALDOVA_LAKEHOUSE_ID,
  [string]$DataDir     = "$PSScriptRoot\data",
  [string]$Fabio       = "$env:LOCALAPPDATA\fabio\fabio.exe"
)

$ErrorActionPreference = 'Stop'
if (-not $WorkspaceId) { throw "WorkspaceId required (or set CALDOVA_WORKSPACE_ID)" }
if (-not $LakehouseId) { throw "LakehouseId required (or set CALDOVA_LAKEHOUSE_ID)" }
if (-not (Test-Path $Fabio)) { throw "fabio not found at $Fabio — run infra\deploy_fabric.ps1 first" }

$tables = @(
  'dim_product', 'dim_station', 'dim_asset', 'dim_maintenance_order',
  'dim_ontology_entity', 'dim_ontology_edge',
  'fact_demand_plan', 'fact_production_daily', 'fact_asset_telemetry', 'fact_rate_scenario'
)

Write-Host "Loading $($tables.Count) tables into lakehouse $LakehouseId" -ForegroundColor Cyan
$failed = @()
foreach ($t in $tables) {
  $csv = Join-Path $DataDir "$t.csv"
  if (-not (Test-Path $csv)) { Write-Host "  ! missing $csv" -ForegroundColor Yellow; $failed += $t; continue }
  Write-Host ("  {0,-26}" -f $t) -NoNewline
  $out = & $Fabio lakehouse upload-table `
    --workspace $WorkspaceId --id $LakehouseId `
    --source-path $csv --table $t --mode Overwrite --format Csv 2>&1
  if ($LASTEXITCODE -eq 0) { Write-Host " loaded" -ForegroundColor Green }
  else { Write-Host " FAILED" -ForegroundColor Red; Write-Host "    $out"; $failed += $t }
}

if ($failed.Count) {
  Write-Host "`n$($failed.Count) table(s) failed: $($failed -join ', ')" -ForegroundColor Red
  exit 1
}
Write-Host "`nAll tables loaded." -ForegroundColor Green
