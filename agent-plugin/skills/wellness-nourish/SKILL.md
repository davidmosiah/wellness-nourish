---
name: wellness-nourish
description: >-
  Search foods, estimate and log meals and water, and track nutrition goals with the local nourish MCP server (USDA FoodData Central, Open Food Facts barcodes, local JSON/JSONL diary). Use when the user asks about calories, macros, what they ate, logging a meal or barcode, hydration, nutrition goals, or a daily or weekly intake review. Confirms estimates before logging.
---

# Nourish

MCP server `nourish` from the `wellness-nourish@0.9.0` npm package, run locally through `npx`. It reads food search, barcode and photo-assisted meal estimates, meal and water logging, goals and daily/weekly intake. Data source: USDA FoodData Central for food search (free key optional, DEMO_KEY otherwise) and Open Food Facts for barcodes; meals and water are stored in local JSONL files, with goals and meal memory in JSON files under `~/.wellness-nourish/`.

## Workflow

1. Start with `nourish_connection_status`. Then pick what fits the question: `nourish_daily_summary`, `nourish_search_food`, `nourish_estimate_meal`.
2. Lead with the answer to the user's question and keep supporting detail short.

## Setup (the user runs this in a terminal, not in chat)

```bash
npx -y wellness-nourish@0.9.0 doctor
```

Works without setup. Optional `FDC_API_KEY` (or `USDA_FDC_API_KEY`) is resolved by Hermes and explicitly forwarded to this server; Hermes omits empty or unset references, so the runtime uses USDA DEMO_KEY when neither key is supplied. Do not request keys in chat or read credential files.

## Safety

- Tools that change local state: nourish_log_intake / nourish_bulk_log_intake / nourish_update_intake, nourish_log_water, nourish_set_goals, nourish_remember_meal, nourish_profile_update. Use them only when the user asks.
- Destructive: nourish_delete_intake, nourish_clear_day, nourish_delete_water, nourish_clear_hydration_day, nourish_forget_memory, nourish_undo_last (local diary only). Confirm with the user first.
- Log a meal only after the user confirms the estimate; show the estimate first with nourish_estimate_meal.
- Photo tools decode images the agent passes in; nothing is uploaded automatically.
- Not medical advice: the data supports personal reflection and planning, not diagnosis or treatment. Point the user to a clinician for symptoms, medication or anything urgent.

## Data boundaries

Food searches send query text/food IDs to USDA FoodData Central. Product searches and barcode lookups send queries/barcodes to Open Food Facts. Preserve provider attribution, including Open Food Facts ODbL metadata and the bundled Brazilian TACO 4 attribution. Diary contents and images are not uploaded automatically to the food providers. Requested personal tool results return to the host agent and may enter its model context; structured output is the default, and summary privacy mode is optional.

The default JSON/JSONL diary is under `~/.wellness-nourish/`, not `PLUGIN_DATA`. The shared profile is `~/.delx-wellness/profile.json`; profile reads may migrate a legacy non-secret profile from `~/.hermes/profiles/delx-wellness/wellness-profile.json` or `~/.openclaw-delx-wellness/workspace/wellness-profile.json` when the shared profile is missing. Wearable-context reads can access `~/.delx-wellness/wearable-context.json` or its per-source directory. These paths are shared by Hermes profiles under one OS home. Explain these boundaries before using existing personal data; use only data the user authorized. Do not assume a different Hermes profile creates a separate diary.

The portable Git SHA pins this manifest and skill. The external npm runtime is version-pinned separately and downloads its dependencies on first start. See the package README disclosure for all network, file and process behavior.
