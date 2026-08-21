# Infrastructure

Everything the Caldova demo runs on, and how to rebuild it from nothing.

```powershell
.\infra\deploy_all.ps1
```

That single command is idempotent — safe to re-run, it detects what already
exists and only creates what is missing.

---

## What gets deployed

| # | Resource | Name | Where |
|---|---|---|---|
| 1 | Fabric capacity | `iqfabric423118crgar1` (F2) | `rg-iq-fabric-capacity`, Central US |
| 2 | Fabric workspace | `caldova-iq` | on that capacity |
| 3 | Lakehouse | `caldova_ops` | in the workspace |
| 4 | 10 Delta tables | see below | in the lakehouse |
| 5 | Snapshot | `src/data/fabric-snapshot.json` | in the repo, read by the web app |
| 6 | Azure AI Foundry | `caldova-foundry` + `gpt-4.1-mini` | `rg-caldova-iq`, East US |

The web app itself is on **Azure Static Web Apps** (`swa-iq-day4-rlt`,
`rg-iq-day4-rlt`), deployed by GitHub Actions on push to `main`.

## Scripts

| Script | Does |
|---|---|
| `deploy_all.ps1` | Orchestrates everything below. Flags: `-SkipData`, `-SkipFoundry`, `-Reset` |
| `generate_data.py` | Builds the dataset from the same physics the app models |
| `load_lakehouse.ps1` | Uploads each CSV and loads it as a Delta table |
| `export_snapshot.ps1` | Queries the SQL analytics endpoint, writes the app's snapshot |

Resource IDs land in `infra/.env` after a run.

## Tooling

Deployment into Fabric uses **[fabio](https://github.com/iemejia/fabio)** — an
open-source, agent-native Rust CLI for the Fabric REST APIs. `deploy_all.ps1`
installs it automatically to `%LOCALAPPDATA%\fabio`. It authenticates off the
existing `az login` credential, so there is nothing extra to configure.

Useful once deployed:

```powershell
$f = "$env:LOCALAPPDATA\fabio\fabio.exe"
& $f lakehouse list-tables --workspace $env:CALDOVA_WORKSPACE_ID --id $env:CALDOVA_LAKEHOUSE_ID
& $f lakehouse query --workspace $env:CALDOVA_WORKSPACE_ID --id $env:CALDOVA_LAKEHOUSE_ID `
     --sql "SELECT TOP 5 * FROM dbo.fact_rate_scenario ORDER BY monthly_units DESC"
```

## The data model

| Table | Rows | Contents |
|---|---|---|
| `dim_product` | 1 | SKU, pack, price, margin, case/pallet configuration |
| `dim_station` | 9 | The nine line stations and which one is the constraint |
| `dim_asset` | 3 | Assets, their components, life exponent, resonance knee, fatigue consumed |
| `dim_maintenance_order` | 4 | Maintenance orders including the open condition-based **PM-4471** |
| `dim_ontology_entity` | 9 | Ontology entities and the table/column each is bound to |
| `dim_ontology_edge` | 11 | The relationships the traversal walks |
| `fact_demand_plan` | 30 | Daily demand: baseline, campaign uplift, committed |
| `fact_production_daily` | 31 | Last month's actual output, availability, quality, OEE |
| `fact_asset_telemetry` | 2 160 | 90 days of hourly vibration, temperature, current, cumulative damage |
| `fact_rate_scenario` | 36 | The what-if curve: RUL, PM date and output for every line speed 70–105 % |

`fact_asset_telemetry` carries a deliberate sawtooth: the bearing was replaced
~38 days before the plan month, and has since accumulated 76 % of its fatigue
budget at 100 % line speed. That is what makes PM-4471 fall inside the month.

## How the app reads it

A browser cannot hold Fabric credentials, so the app does **not** query Fabric
directly. Instead:

```
Fabric lakehouse  →  export_snapshot.ps1  →  src/data/fabric-snapshot.json  →  app
   (SQL endpoint)      (runs as you)            (committed, ~30 KB)
```

`src/fabric.js` loads that snapshot at startup and rebinds the model
(`applyFabric` in `src/line.js`) so demand, asset condition, maintenance and the
rate-scenario curve all come from the lakehouse. The header shows a live
provenance badge naming the workspace, lakehouse and export time. If the
snapshot is missing the app falls back to its built-in constants and the badge
turns amber — the demo can never fail to open.

`scripts/test-line.mjs` asserts the lakehouse and the in-app model agree,
including that the lakehouse independently reproduces the headline result:
90 % speed yields more monthly output than 100 %.

To refresh after changing data:

```powershell
python infra\generate_data.py --out infra\data
.\infra\load_lakehouse.ps1
.\infra\export_snapshot.ps1     # wait ~1 min for the SQL endpoint to sync
npm test
git add -A; git commit -m "Refresh Fabric data"; git push
```

## Cost

The F2 capacity is the only meaningful cost and it bills while **Active**.
Pause it between demos:

```powershell
az fabric capacity suspend --capacity-name iqfabric423118crgar1 --resource-group rg-iq-fabric-capacity
```

`deploy_all.ps1` resumes it automatically on the next run. The Static Web App is
Free tier, and the Foundry deployment bills per token.

## Gotchas

- **The SQL analytics endpoint lags the Delta write** by 1–2 minutes. `deploy_all.ps1`
  polls for it; `export_snapshot.ps1` will error with `Invalid object name` if you
  run it too early. Just re-run.
- **Model availability and SKUs move.** The script asks the API which models are
  offered in the region and which SKU each supports, rather than hardcoding —
  `gpt-4.1-mini` is `Standard` in East US, not `GlobalStandard`.
- **A paused capacity makes every Fabric call fail** with confusing errors. Check
  state first.
