# Wellness Nourish — providers & attribution

## Data providers

The connector uses **USDA FoodData Central** as the primary food search provider. **Open Food Facts** is used for packaged-food barcode lookup and product-name search when enabled (`NOURISH_OFF_ENABLED=1`). Local barcode image decoding is supported with **ZXing**.

From **0.7.0**, meal estimation for Brazilian Portuguese also routes through a curated subset of **TACO 4** (Tabela Brasileira de Composição de Alimentos, NEPA/UNICAMP). See attribution below and `src/data/taco-foods.ts`.

Meal photos are estimated only from an agent-provided visual observation and always require confirmation before logging. The local estimator includes a pt-BR/Brazilian-food catalog for common meals, kitchen units, and shortcuts such as arroz, feijão, frango, ovos, banana, tapioca, picanha, feijoada and salada.

The public pt-BR meal-estimator eval lives at [`docs/evals/pt-br-meal-estimator.json`](evals/pt-br-meal-estimator.json). It covers breakfast, lunch, snacks, dinner and churrasco-style meals with grams plus Brazilian kitchen units (`concha`, `colher`, `xicara`, `fatia`, `unidade`, `prato`). `npm run test:pt-br-meal-eval` fails if expected foods disappear, unresolved terms change silently, confidence ranges drift, or calorie estimates leave their approximate range.

The connector does **not** provide hosted sync, autonomous photo upload, recipe generation, or medical advice.

## Attribution requirements

USDA FoodData Central is the primary provider for generic food search and nutrient data. USDA data is public domain or otherwise provided by USDA FoodData Central terms; keep provider attribution with derived results.

Open Food Facts barcode data is licensed under the Open Database License (ODbL). Open Food Facts metadata has share-alike obligations, so agents and downstream tools should preserve attribution and license metadata when exporting or reusing packaged-food records.

### TACO 4 (UNICAMP / NEPA)

Brazilian meal estimates may cite nutrients from a curated subset of TACO 4ª edição. Attribution: © UNICAMP / NEPA — [Tabela Brasileira de Composição de Alimentos](https://www.nepa.unicamp.br/tabela-brasileira-de-composicao-de-alimentos-4a-edicao/). Values are reproduced with attribution for reference use; nothing here implies endorsement by NEPA or UNICAMP.

## Privacy (full detail)

Intake data is stored locally under `~/.wellness-nourish/intake.jsonl` unless `NOURISH_LOCAL_DIR` is set. Hydration is stored in `hydration.jsonl`, and goals are stored in `goals.json` in the same local directory. The connector does not require hosted accounts and does not send local intake logs to Delx Wellness. Provider lookups may contact USDA FoodData Central or Open Food Facts unless fixture mode is enabled.

Use `nourish-mcp export` to print the local JSONL export, `nourish-mcp export --format csv` for CSV, `nourish-mcp delete --entry <id>` to delete a specific intake entry, or `nourish-mcp clear-day <date> --yes` to delete all intake entries for a day.
