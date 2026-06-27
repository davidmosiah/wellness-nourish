# Wellness Nourish — CLI reference

Full command-line interface for [`wellness-nourish`](https://www.npmjs.com/package/wellness-nourish). Both `wellness-nourish` and `nourish-mcp` are valid binary names.

With no arguments the binary starts the stdio MCP server. `--http` starts the Streamable HTTP transport (`POST /mcp`), `--version` prints the package version, and `--help` prints usage.

## Commands

```bash
wellness-nourish status
wellness-nourish doctor
wellness-nourish setup --client claude
wellness-nourish search banana
wellness-nourish barcode 0000000000000
wellness-nourish log --preview --meal breakfast "2 eggs and banana"
wellness-nourish log "2 eggs and banana"
wellness-nourish list 2026-05-05
wellness-nourish edit --entry intake_id --meal snack --notes "corrected"
wellness-nourish today --format markdown
wellness-nourish weekly --format markdown
wellness-nourish goals --set-calories 2200 --set-protein 120 --set-water 2500
wellness-nourish water 500 --date 2026-05-05
wellness-nourish water today --date 2026-05-05
wellness-nourish export --format csv
wellness-nourish clear-day 2026-05-05 --yes
wellness-nourish delete --entry intake_id
```

## Behavior notes

- `log --preview` estimates a meal locally **without writing anything**.
- Mutating MCP tools require explicit user intent; CLI commands are treated as explicit user actions, while destructive `clear-day` requires `--yes`.
- The local estimator understands common lightweight portions such as `g`, `oz`, `cup`, `tbsp`, `tsp`, `slice`, `piece`, `serving`, and Brazilian kitchen units (`concha`, `colher`, `xicara`, `fatia`, `unidade`, `prato`). It still reports confidence and warnings because these are conservative tracking estimates, not lab-grade nutrition facts.
- The public pt-BR eval set is in [`docs/evals/pt-br-meal-estimator.json`](evals/pt-br-meal-estimator.json) and is enforced by `npm run test:pt-br-meal-eval`.

## Install / build / run

```bash
npm install
npm run build
npm start                 # stdio MCP server
node dist/index.js --http # Streamable HTTP locally
```

## Optional environment

```bash
FDC_API_KEY=your_usda_key
NOURISH_OFF_ENABLED=1
NOURISH_LOCAL_DIR=~/.wellness-nourish
NOURISH_MCP_PORT=3000
```

Agents should never ask users to paste API keys, tokens, raw health exports, or private food logs into chat. Configure secrets through environment variables or local files.

## ChatGPT App / MCP Apps UI

Nourish also exposes a compact MCP Apps-compatible dashboard for ChatGPT and other compatible hosts:

- Tool: `nourish_chatgpt_dashboard`
- UI resource: `ui://widget/nourish-dashboard-v1.html`
- MIME type: `text/html;profile=mcp-app`

The dashboard shows the daily nutrition summary, hydration progress, profile gaps and next-meal coaching, and it can call `nourish_estimate_meal` from the embedded UI for preview-only estimates. It does not write intake, water or goals; mutating tools still require explicit user confirmation through the normal MCP tools.

## MCP client config examples

Ready-to-use examples live in [`examples/`](../examples):

- `examples/claude-desktop.json`
- `examples/codex.json`
- `examples/cursor.json`
- `examples/windsurf.json`
- `examples/hermes.md`
- `examples/hermes-skill.md`
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

## Development and tests

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
