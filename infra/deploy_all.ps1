# =============================================================================
# Caldova IQ demo — full environment deployment.
#
#   .\infra\deploy_all.ps1
#   .\infra\deploy_all.ps1 -SkipFoundry          # Fabric only
#   .\infra\deploy_all.ps1 -Reset                # delete and recreate the workspace
#
# Creates, end to end and idempotently:
#   1. Fabric capacity            resumed if paused (F2)
#   2. Fabric workspace           caldova-iq, bound to that capacity
#   3. Lakehouse                  caldova_ops
#   4. Dataset                    generated locally, loaded as 10 Delta tables
#   5. Snapshot                   exported to src/data/fabric-snapshot.json
#   6. Azure AI Foundry           caldova-foundry + a chat model deployment
#
# Requires: az (logged in), python 3.10+, and fabio (installed automatically).
# =============================================================================
[CmdletBinding()]
param(
  [string]$CapacityName   = 'iqfabric423118crgar1',
  [string]$CapacityRg     = 'rg-iq-fabric-capacity',
  [string]$WorkspaceName  = 'caldova-iq',
  [string]$LakehouseName  = 'caldova_ops',
  [string]$FoundryRg      = 'rg-caldova-iq',
  [string]$FoundryName    = 'caldova-foundry',
  [string]$FoundryLocation = 'eastus',
  [string]$ModelName      = 'gpt-4.1-mini',
  [string]$ModelVersion   = '',
  [switch]$SkipFoundry,
  [switch]$SkipData,
  [switch]$Reset
)

$ErrorActionPreference = 'Stop'
$root  = Split-Path -Parent $PSScriptRoot
$fabio = "$env:LOCALAPPDATA\fabio\fabio.exe"

function Step($n, $t) { Write-Host "`n[$n] $t" -ForegroundColor Cyan }
function Ok($m)       { Write-Host "    $m" -ForegroundColor Green }
function Note($m)     { Write-Host "    $m" -ForegroundColor DarkGray }

# ---------------------------------------------------------------- 0. tooling
Step 0 'Tooling'
$acct = az account show --query "{sub:name,id:id}" -o json 2>$null | ConvertFrom-Json
if (-not $acct) { throw "Not logged in. Run: az login" }
Note "subscription  $($acct.sub)"

if (-not (Test-Path $fabio)) {
  Note 'installing fabio (github.com/iemejia/fabio)'
  $dst = "$env:LOCALAPPDATA\fabio"; New-Item -ItemType Directory -Force $dst | Out-Null
  $zip = "$env:TEMP\fabio.zip"
  # the installer script and raw GitHub can be flaky behind proxies; gh is steadier
  if (Get-Command gh -ErrorAction SilentlyContinue) {
    gh release download --repo iemejia/fabio --pattern 'fabio-windows-x64.zip' --output $zip --clobber | Out-Null
  } else {
    Invoke-WebRequest -Uri 'https://github.com/iemejia/fabio/releases/latest/download/fabio-windows-x64.zip' -OutFile $zip -UseBasicParsing
  }
  Expand-Archive -Path $zip -DestinationPath $dst -Force
}
$fabioVer = (& $fabio --version) -join ''
Ok "fabio $fabioVer"

# --------------------------------------------------------------- 1. capacity
Step 1 "Fabric capacity $CapacityName"
$capId = az resource list --resource-type Microsoft.Fabric/capacities `
  --query "[?name=='$CapacityName'].id" -o tsv
if (-not $capId) { throw "Capacity $CapacityName not found. Create one (F2 is enough) and re-run." }
$state = az resource show --ids $capId --query 'properties.state' -o tsv
Note "state $state"
if ($state -ne 'Active') {
  Note 'resuming (billing starts now)'
  az fabric capacity resume --capacity-name $CapacityName --resource-group $CapacityRg | Out-Null
  do { Start-Sleep 10; $state = az resource show --ids $capId --query 'properties.state' -o tsv }
  while ($state -ne 'Active')
}
$capGuid = (& $fabio capacity list --json -q "[?displayName=='$CapacityName'].id | [0]" | ConvertFrom-Json).data
Ok "active, id $capGuid"

# -------------------------------------------------------------- 2. workspace
Step 2 "Workspace $WorkspaceName"
$wsId = (& $fabio workspace list --json -q "[?displayName=='$WorkspaceName'].id | [0]" | ConvertFrom-Json).data
if ($wsId -and $Reset) {
  Note "deleting existing workspace $wsId"
  & $fabio workspace delete --workspace $wsId --force | Out-Null
  $wsId = $null
}
if (-not $wsId) {
  $wsId = (& $fabio workspace create --name $WorkspaceName `
            --description 'Caldova suncare operations - IQ demo (Persona 2)' `
            --capacity-id $capGuid --json | ConvertFrom-Json).data.id
  Ok "created $wsId"
} else { Ok "exists $wsId" }

# -------------------------------------------------------------- 3. lakehouse
Step 3 "Lakehouse $LakehouseName"
$lhId = (& $fabio lakehouse list --workspace $wsId --json -q "[?displayName=='$LakehouseName'].id | [0]" | ConvertFrom-Json).data
if (-not $lhId) {
  $lhId = (& $fabio lakehouse create --workspace $wsId --name $LakehouseName `
            --description 'Caldova Suncare Line 3 operational data' --json | ConvertFrom-Json).data.id
  Ok "created $lhId"
} else { Ok "exists $lhId" }

$env:CALDOVA_WORKSPACE_ID = $wsId
$env:CALDOVA_LAKEHOUSE_ID = $lhId

# ------------------------------------------------------------------- 4. data
if (-not $SkipData) {
  Step 4 'Dataset'
  python "$PSScriptRoot\generate_data.py" --out "$PSScriptRoot\data"
  & "$PSScriptRoot\load_lakehouse.ps1" -WorkspaceId $wsId -LakehouseId $lhId

  Step 5 'Snapshot for the web app'
  # the SQL analytics endpoint lags the Delta write by a minute or two
  Note 'waiting for the SQL endpoint to pick up the new tables'
  $ready = $false
  foreach ($i in 1..20) {
    Start-Sleep 15
    $n = (& $fabio lakehouse query --workspace $wsId --id $lhId `
          --sql "SELECT COUNT(*) AS n FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='dbo'" `
          --json 2>$null | ConvertFrom-Json).data.n
    Note "  visible tables: $n"
    if ($n -ge 10) { $ready = $true; break }
  }
  if (-not $ready) { Write-Warning 'SQL endpoint still syncing; re-run infra\export_snapshot.ps1 shortly.' }
  else { & "$PSScriptRoot\export_snapshot.ps1" -WorkspaceId $wsId -LakehouseId $lhId }
}

# ---------------------------------------------------------------- 6. foundry
if (-not $SkipFoundry) {
  Step 6 "Azure AI Foundry $FoundryName"
  az group create -n $FoundryRg -l $FoundryLocation --only-show-errors | Out-Null
  $exists = az cognitiveservices account list -g $FoundryRg --query "[?name=='$FoundryName'].name" -o tsv
  if (-not $exists) {
    az cognitiveservices account create -n $FoundryName -g $FoundryRg -l $FoundryLocation `
      --kind AIServices --sku S0 --custom-domain $FoundryName --yes --only-show-errors | Out-Null
    Ok 'account created'
  } else { Ok 'account exists' }
  $endpoint = az cognitiveservices account show -n $FoundryName -g $FoundryRg --query 'properties.endpoint' -o tsv
  Note "endpoint $endpoint"

  $dep = az cognitiveservices account deployment list -n $FoundryName -g $FoundryRg `
          --query "[?name=='$ModelName'].name" -o tsv
  if (-not $dep) {
    # Model availability and the SKU each model supports both move over time, so
    # ask the API what is deployable here rather than hardcoding a guess.
    $avail = az cognitiveservices model list -l $FoundryLocation `
      --query "[?kind=='AIServices'].{name:model.name,ver:model.version,sku:model.skus[0].name}" -o json `
      | ConvertFrom-Json
    $wanted = @($ModelName, 'gpt-4.1-mini', 'gpt-5-mini', 'gpt-4o-mini', 'gpt-4o')
    $deployed = $false
    foreach ($w in ($wanted | Select-Object -Unique)) {
      $m = $avail | Where-Object { $_.name -eq $w } | Sort-Object ver -Descending | Select-Object -First 1
      if (-not $m) { Note "  $w not offered in $FoundryLocation"; continue }
      az cognitiveservices account deployment create -n $FoundryName -g $FoundryRg `
        --deployment-name $m.name --model-name $m.name --model-version $m.ver `
        --model-format OpenAI --sku-name $m.sku --sku-capacity 50 --only-show-errors 2>$null | Out-Null
      if ($LASTEXITCODE -eq 0) {
        Ok "model $($m.name) $($m.ver) deployed on $($m.sku)"; $deployed = $true; break
      }
      Note "  $($m.name) $($m.ver)/$($m.sku) rejected (quota?), trying next"
    }
    if (-not $deployed) { Write-Warning 'No chat model could be deployed - check regional availability and quota.' }
  } else { Ok "model $ModelName already deployed" }
}

# ----------------------------------------------------------------- summary
Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host ' Caldova IQ environment ready' -ForegroundColor Cyan
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host "  Workspace   $WorkspaceName   $wsId"
Write-Host "  Lakehouse   $LakehouseName   $lhId"
Write-Host "  Portal      https://app.fabric.microsoft.com/groups/$wsId"
if (-not $SkipFoundry) { Write-Host "  Foundry     $FoundryName ($FoundryRg)" }
Write-Host "`n  Snapshot    src/data/fabric-snapshot.json"
Write-Host "  Next        npm test  &&  git push   (CI deploys to Static Web Apps)`n"

@"
CALDOVA_WORKSPACE_ID=$wsId
CALDOVA_LAKEHOUSE_ID=$lhId
CALDOVA_CAPACITY_ID=$capGuid
"@ | Set-Content "$root\infra\.env" -Encoding utf8
Note "ids written to infra\.env"
