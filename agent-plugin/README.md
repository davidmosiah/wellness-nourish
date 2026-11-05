# Nourish — Agent Plugins package

Portable [Agent Plugins](https://agent-plugins.org/) v1 package for
[Hermes Agent](https://github.com/NousResearch/hermes-agent) and other Agent Plugins clients:
the `nourish` MCP server (`wellness-nourish@0.9.0` over stdio) plus the `wellness-nourish` workflow skill.

## Install (Hermes Agent)

```bash
hermes plugins install davidmosiah/wellness-nourish/agent-plugin --no-enable
hermes plugins enable wellness-nourish
```

Requires Node.js 20+ (`npx` on PATH). The skill loads as `wellness-nourish:wellness-nourish`.

## Connector setup

```bash
npx -y wellness-nourish@0.9.0 doctor
```

Works without setup. For higher USDA rate limits the user can add a free FoodData Central key (fdc.nal.usda.gov) to their environment as `FDC_API_KEY` (or the supported alias `USDA_FDC_API_KEY`) before starting Hermes. The plugin explicitly forwards these optional credentials; unset or empty values are omitted by Hermes, preserving the default DEMO_KEY fallback. If both are set, `FDC_API_KEY` takes precedence.

## Disclosure

Runs the `wellness-nourish@0.9.0` npm package locally over stdio through `npx` (Node.js 20+ required); the package is downloaded from npm on first start. Data source: USDA FoodData Central for food search (free key optional, DEMO_KEY otherwise) and Open Food Facts for barcodes; meals, water and goals are stored only in a local SQLite file. Tools that change state: nourish_log_intake / nourish_bulk_log_intake / nourish_update_intake; nourish_log_water; nourish_set_goals; nourish_remember_meal; nourish_profile_update; nourish_delete_intake, nourish_clear_day, nourish_delete_water, nourish_clear_hydration_day, nourish_forget_memory, nourish_undo_last (local diary only). Log a meal only after the user confirms the estimate; show the estimate first with nourish_estimate_meal. Photo tools decode images the agent passes in; nothing is uploaded automatically. The tool set comes from the pinned npm version, not from this repository's source tree.
