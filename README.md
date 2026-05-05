# Wellness Nourish MCP

## Overview

Wellness Nourish is a local MCP server for nutrition search, barcode lookup, meal estimation, intake logging, hydration, goals, exports, and daily or weekly summaries. It runs over stdio by default for MCP clients and can also run a Streamable HTTP endpoint at `POST /mcp`.

The connector uses USDA FoodData Central as the primary food search provider. Open Food Facts is used for packaged-food barcode lookup when enabled. It does not provide hosted sync, photo analysis, recipe generation, or medical advice.

## Install

```bash
npm install
npm run build
```

Run the MCP server over stdio:

```bash
npm start
```

Run Streamable HTTP locally:

```bash
node dist/index.js --http
```

Optional environment:

```bash
FDC_API_KEY=your_usda_key
NOURISH_OFF_ENABLED=1
NOURISH_LOCAL_DIR=~/.wellness-nourish
NOURISH_MCP_PORT=3000
```

Agents should never ask users to paste API keys, tokens, raw health exports, or private food logs into chat. Configure secrets through environment variables or local files.

## CLI Commands

```bash
nourish-mcp status
nourish-mcp doctor
nourish-mcp setup --client claude
nourish-mcp search banana
nourish-mcp barcode 0000000000000
nourish-mcp log --preview --meal breakfast "2 eggs and banana"
nourish-mcp log "2 eggs and banana"
nourish-mcp list 2026-05-05
nourish-mcp edit --entry intake_id --meal snack --notes "corrected"
nourish-mcp today --format markdown
nourish-mcp weekly --format markdown
nourish-mcp goals --set-calories 2200 --set-protein 120 --set-water 2500
nourish-mcp water 500 --date 2026-05-05
nourish-mcp water today --date 2026-05-05
nourish-mcp export --format csv
nourish-mcp clear-day 2026-05-05 --yes
nourish-mcp delete --entry intake_id
```

No arguments start the stdio MCP server. `--http` starts HTTP transport, `--version` prints the package version, and `--help` prints usage.

`log --preview` estimates without writing. Mutating MCP tools require explicit user intent; CLI commands are treated as explicit user actions, while destructive clear-day requires `--yes`.

The local estimator understands common lightweight portions such as `g`, `oz`, `cup`, `tbsp`, `tsp`, `slice`, `piece`, and `serving`. It still reports confidence and warnings because these are conservative tracking estimates, not lab-grade nutrition facts.

## MCP Client Config Examples

Ready-to-use examples live in `examples/`:

- `examples/claude-desktop.json`
- `examples/codex.json`
- `examples/cursor.json`
- `examples/windsurf.json`
- `examples/hermes.md`
- `examples/openclaw.md`

Claude Desktop style:

```json
{
  "mcpServers": {
    "nourish": {
      "command": "npx",
      "args": ["-y", "wellness-nourish"],
      "env": {
        "FDC_API_KEY": "${FDC_API_KEY}",
        "NOURISH_OFF_ENABLED": "1"
      }
    }
  }
}
```

Local build:

```json
{
  "mcpServers": {
    "nourish": {
      "command": "node",
      "args": ["/absolute/path/to/wellness-nourish/dist/index.js"],
      "env": {
        "NOURISH_LOCAL_DIR": "/absolute/path/to/.wellness-nourish"
      }
    }
  }
}
```

## Provider Attribution

USDA FoodData Central is the primary provider for generic food search and nutrient data. USDA data is public domain or otherwise provided by USDA FoodData Central terms; keep provider attribution with derived results.

Open Food Facts barcode data is licensed under the Open Database License (ODbL). Open Food Facts metadata has share-alike obligations, so agents and downstream tools should preserve attribution and license metadata when exporting or reusing packaged-food records.

## Privacy

Intake data is stored locally under `~/.wellness-nourish/intake.jsonl` unless `NOURISH_LOCAL_DIR` is set. Hydration is stored in `hydration.jsonl`, and goals are stored in `goals.json` in the same local directory. The connector does not require hosted accounts and does not send local intake logs to Delx Wellness. Provider lookups may contact USDA FoodData Central or Open Food Facts unless fixture mode is enabled.

Use `nourish-mcp export` to print the local JSONL export, `nourish-mcp export --format csv` for CSV, `nourish-mcp delete --entry <id>` to delete a specific intake entry, or `nourish-mcp clear-day <date> --yes` to delete all intake entries for a day.

## Not Medical Advice

Nutrition estimates are approximate and intended for personal tracking and agent workflow context. They are not diagnosis, treatment, or medical advice. Confirm important nutrition decisions with a qualified professional.

## Development And Tests

```bash
npm run typecheck
npm run build
npm run smoke:http
npm run test:cli-ux
npm run test:agent-readiness
npm test
```

Fixture mode:

```bash
NOURISH_FIXTURE_MODE=1 NOURISH_FIXTURE_DIR=fixtures npm run test:cli-ux
```

## Delx Wellness

Project page: <https://wellness.delx.ai/connectors/nourish>
