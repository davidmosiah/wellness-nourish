# Changelog

All notable changes to `wellness-nourish` are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.3] - 2026-05-08

This release lands every P1 finding from the deep QA report: the intake input
pipeline now respects explicit nutrient/custom-food data over text estimates,
custom foods scale correctly by `grams_estimate`, hydration finally has a
delete/clear path, and the meal estimator correctly handles pt-BR decimal
commas and explicit zero/negative quantities.

Each fix ships with a regression test (estimator unit tests + MCP-level smoke
assertions) so the same bug cannot reappear silently.

### Fixed

- **Intake — explicit data wins over text estimate (N-001).** When
  `nourish_log_intake` was called with both `text` and explicit
  `nutrients`/`custom_food`/`food_ref`/`food`, the explicit data was silently
  dropped and the entry was logged with whatever the text estimator inferred
  (often `nutrients: {}` for OCR labels). Explicit nutrient data now always
  wins; the text becomes the food label or note. Regression covered in
  `scripts/smoke-tools.mjs` (`assertExplicitNutrientsBeatText`).
- **Intake — `custom_food.nutrients_per_100g` now scales by
  `grams_estimate` (N-002).** A 60 g portion of a custom food previously
  logged the full 100 g nutrient values. The new
  `nutrientsFromCustomShape` / `gramsForCustomShape` helpers compute the
  correct gram weight (from `grams_estimate`, then `serving.grams × quantity`,
  then `available_portions[0].grams × quantity`) and scale via the existing
  `nutrientsForGrams`. Regression covered in
  `assertCustomFoodScalesByGrams`.
- **Estimator — pt-BR decimal comma is parsed correctly (N-004).**
  `1,5 banana` was being split into two clauses (`1` and `5 banana`) and
  logged as five bananas. The clause splitter now uses negative lookarounds
  (`(?<!\d),(?!\d)`) so commas between digits stay attached, and
  `parseQuantity` normalizes commas to dots before `parseFloat`. Regression in
  `scripts/test-meal-estimator.mjs`.
- **Estimator — zero/negative quantities are rejected, not silently
  defaulted (N-005).** `0g banana` was logged as 1 g of banana and
  `-100g rice` quietly fell back to a default 158 g serving. The quantity
  pattern now matches an optional leading `-` so the negative is detected and
  `parseQuantity` returns `null` for non-positive quantities, causing the food
  match to be skipped (and surfaced via a new
  "Rejected N food item(s) with non-positive quantity" warning). Regression in
  `scripts/test-meal-estimator.mjs`.

### Added

- **Hydration — `nourish_delete_water` and `nourish_clear_hydration_day`
  tools (N-003).** Hydration entries previously had no public delete API;
  `nourish_clear_day` only touched intake, leaving water entries orphaned.
  Both new tools require `explicit_user_intent: true`. The existing
  `nourish_clear_day` also accepts a new `include_hydration: true` flag that
  clears intake and hydration in one call, returning a per-store
  `deleted_entries` summary. Regression in
  `assertHydrationDeleteAndClear` (smoke).
- **`CHANGELOG.md`** (this file). Previous releases (0.1.x → 0.2.2) summarized
  retroactively below.

### Notes

- Tool count increased from 32 → **34** (added `nourish_delete_water` and
  `nourish_clear_hydration_day`). `nourish_clear_day` accepts the new
  optional `include_hydration` flag without a breaking change.

## Earlier history (retroactive summary)

- **0.2.2** — Nourish discovery polish (`nourish_agent_manifest`,
  `nourish://usage-guide` resource, structured validation errors).
- **0.2.1** — Coach mode-specific focus defaults; Beever-Atlas style README.
- **0.2.0** — Personal nutrition memory + nourish coach (`daily_coach`,
  `suggest_next_meal`, `after_log_review`, `pre_workout_nutrition`,
  `evening_checkin`).
- **0.1.x** — Initial nutrition MCP surface: USDA / Open Food Facts /
  Brazilian local provider, intake/hydration stores, barcode + image tools,
  Hermes setup helper.
