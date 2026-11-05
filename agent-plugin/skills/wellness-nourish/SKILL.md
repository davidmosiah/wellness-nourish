---
name: wellness-nourish
description: >-
  Search foods, estimate and log meals and water, and track nutrition goals with the local nourish MCP server (USDA FoodData Central, Open Food Facts barcodes, local SQLite diary). Use when the user asks about calories, macros, what they ate, logging a meal or barcode, hydration, nutrition goals, or a daily or weekly intake review. Confirms estimates before logging.
---

# Nourish

MCP server `nourish` from the `wellness-nourish@0.9.0` npm package, run locally through `npx`. It reads food search, barcode and photo-assisted meal estimates, meal and water logging, goals and daily/weekly intake. Data source: USDA FoodData Central for food search (free key optional, DEMO_KEY otherwise) and Open Food Facts for barcodes; meals, water and goals are stored only in a local SQLite file.

## Workflow

1. Start with `nourish_connection_status`. Then pick what fits the question: `nourish_daily_summary`, `nourish_search_food`, `nourish_estimate_meal`.
2. Lead with the answer to the user's question and keep supporting detail short.

## Setup (the user runs this in a terminal, not in chat)

```bash
npx -y wellness-nourish@0.9.0 doctor
```

Works without setup. For higher USDA rate limits the user can add a free FoodData Central key (fdc.nal.usda.gov) to their environment as FDC_API_KEY before starting Hermes.

## Safety

- Tools that change local state: nourish_log_intake / nourish_bulk_log_intake / nourish_update_intake, nourish_log_water, nourish_set_goals, nourish_remember_meal, nourish_profile_update. Use them only when the user asks.
- Destructive: nourish_delete_intake, nourish_clear_day, nourish_delete_water, nourish_clear_hydration_day, nourish_forget_memory, nourish_undo_last (local diary only). Confirm with the user first.
- Log a meal only after the user confirms the estimate; show the estimate first with nourish_estimate_meal.
- Photo tools decode images the agent passes in; nothing is uploaded automatically.
- Not medical advice: the data supports personal reflection and planning, not diagnosis or treatment. Point the user to a clinician for symptoms, medication or anything urgent.
