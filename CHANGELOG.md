# Changelog

All notable changes to `wellness-nourish` are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.4] - 2026-05-08

Sprint 2 / resilience release. Layers on top of 0.2.3 with: a centralized
HTTP helper that adds per-attempt timeout + single-retry-with-backoff to all
USDA + OFF calls, graceful degradation when Open Food Facts is down, image
analysis fallback when a barcode lookup fails mid-call, and several new QA
findings (E1, B1, B5) caught by a follow-up audit. No breaking changes.

### Added

- **`services/http.ts`** — single fetch wrapper with `AbortController`-based
  timeout (default 10s, configurable via `NOURISH_PROVIDER_TIMEOUT_MS`),
  one retry on transient failures (`5xx`, `429`, network, timeout) with
  exponential backoff, and a structured `NourishHttpError` exposing
  `kind` (`timeout` | `rate_limit` | `server_error` | `network` | `http`),
  `attempts`, and a `transient` flag. `isTransientHttpError(err)` is the
  recommended predicate for callers deciding between hard failure and
  graceful degradation. Regression tests in
  `scripts/test-http-helper.mjs` (timeout, 503-then-200 retry,
  persistent 503, persistent 429, non-retryable 404).
- **`provider_timeout_ms`** in `nourish_connection_status` so agents can see
  the configured timeout, plus a new top-level `warnings: string[]` array
  and a `usda_using_demo_key: boolean` flag (true when no `FDC_API_KEY` is
  set and we're not in fixture mode — the heavily rate-limited shared key
  many users hit silently).
- Agent-manifest and usage-guide now list `nourish_delete_water` and
  `nourish_clear_hydration_day` (added in 0.2.3 but not surfaced in the
  discovery surfaces, so agents booting cold couldn't find them — fixed
  here as the QA-found "E1" gap).

### Fixed

- **N-007 — Open Food Facts search now degrades gracefully on transient
  failures.** A 503/timeout/network error from `/cgi/search.pl` no longer
  throws. `searchOpenFoodFactsByName` returns
  `{ foods: [], warnings: ["Open Food Facts search …; returning empty
  results."] }`, so partial results from other providers still flow through
  in `provider: "all"` and the agent gets actionable information instead of
  a hard error. Direct `nourish_lookup_barcode` keeps throwing because the
  caller asked for a specific product.
- **N-008 — image-analysis routes now fall back when the barcode lookup
  fails mid-call.** If `nourish_analyze_food_image` is given a barcode AND
  `nutrition_label_text` (or `detected_items`/`image_description`) and OFF is
  unavailable, the call now uses the label/meal hints instead of failing.
  The barcode that was tried surfaces as `barcode_attempted` in the
  response so the agent can explain the fallback.
- **N-009 — nutrition-label OCR with no parseable nutrients no longer emits
  `suggested_log_intake`.** Before, an unparseable label created an empty
  `nutrients_per_serving` and the agent could log it (writing `nutrients: {}`
  — the same class of bug 0.2.3's N-001 just fixed). Now the route is
  `"needs_more_ocr"` with explicit warnings and no logging suggestion.
- **B5 — HTTP transport `close()` errors are no longer unhandled
  rejections.** `transport.close()` and `server.close()` rejections (which
  fire when the response was already cancelled) are now swallowed with a
  comment explaining why.
- **`provider: "all"` fan-out is now parallel** (`Promise.allSettled`
  instead of sequential `for` loop). Every per-provider warning is tagged
  with the provider name (e.g. `open_food_facts: …`) so partial failures
  are attributable. Latency drops from ~3× single-provider to ~1× the
  slowest provider.
- **B1 — Open Food Facts cache is now LRU-bounded.** Was a `Map` that grew
  forever (≈400MB at 100K barcodes in a long-running stdio process). Capped
  at 500 entries with insertion-order LRU eviction.

### New regression coverage

- `scripts/test-http-helper.mjs` — 5 cases for the new helper: timeout,
  503-then-success retry, persistent 503, persistent 429, non-retryable 404.
- `scripts/smoke-tools.mjs` adds:
  - `assertConnectionStatusEnriched` — `provider_timeout_ms`, `warnings[]`,
    `usda_using_demo_key`
  - `assertAgentManifestIncludesHydrationTools` — E1 fix
  - `assertLabelOcrWithoutNutrientsDoesNotSuggestLog` — N-009
  - `assertParallelAllProviderTagsWarnings` — provider-tagged warnings

### Notes

- No changes to the public tool surface (still 34 tools at 0.2.3 + 0.2.4).
- No breaking schema changes. `connection_status` adds optional fields;
  agents reading the old shape continue to work.
- Hermes wrapper update (`wellness-nourish@0.2.3 → @0.2.4`) lands separately
  after this PR is merged + published to npm.

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
