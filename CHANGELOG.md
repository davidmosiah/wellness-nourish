# Changelog

All notable changes to `wellness-nourish` are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.2] - 2026-05-08

### Fixed

- Add MCP `structuredContent` to object payload responses while keeping the
  existing text/JSON body. This makes agent clients consume Nourish outputs
  the same way they consume the other wellness MCP connectors.

## [0.3.1] - 2026-05-08

### Fixed

- Refresh audited lockfile transitive dependencies after the `0.3.0`
  merge train: `express-rate-limit` now resolves to `8.5.1` and
  `ip-address` to `10.2.0`, clearing the production `npm audit` gate.

## [0.3.0] - 2026-05-08

🌱 **Cross-connector wellness coaching release.** Closes the audit-trail
gap from 2026-05-08 and lands the first MCP nutrition coach that
*reasons* over wearable signals (not just echoes them).

### Added

- 🆕 **Wearable-aware coach reasoning** (PR #16). `coach.ts` now reads
  `wellness_context` / `training_context` from `wearable_context` and
  routes suggestions through 4 wearable rules in precedence order
  before falling through to existing logic:
  - **Rule 1 — poor recovery** (`recovery_score < 50` OR
    `body_battery < 30`): suggest light, anti-inflammatory,
    easy-digestion meal. *"sopa de legumes com peito de frango
    desfiado e gengibre."*
  - **Rule 4 — high recent training load**: recovery-focused meal.
    *"salmão grelhado, batata doce e brócolis no vapor."*
  - **Rule 3 — high strain in pre_workout mode**: carb bias.
    *"tapioca grande com banana e mel, cafezinho."*
  - **Rule 2 — high recovery + protein focus or post-workout**: higher
    protein. *"200g picanha grelhada, arroz, feijão e salada."*
  - **Rules 5/6 — protein gap / mode defaults**: existing fallback.
  - Reason text now mentions the signal that fired (e.g. "Recovery 35%
    from whoop — choosing easy-digestion option") so the calling agent
    stays honest about why the suggestion changed.
  - `extractWearableSignals()` uses explicit `typeof === "number"`
    guards; malformed input degrades to "no rule fires" instead of
    throwing.
  - **No schema changes** — `wearable_context` was already
    `z.record(z.string(), z.unknown())`, so the new fields are
    accepted as-is.
- 🆕 **`scripts/test-coach-wearable.mjs`** — covers all 4 wearable
  rules, the precedence guard (poor recovery beats high training
  load when both apply), and the empty-context fallback.

### Changed

- **`displayNamePtBr` 100% coverage** (PR #17). Moved from 12/35 →
  35/35 entries in `SIMPLE_FOODS`. Every food now carries an explicit
  pt-BR display name even when the canonical is already pt-BR. Added
  pt-BR plural aliases: `ovos`, `maçãs`, `tapiocas`, `coxinhas`,
  `brigadeiros`, `pães de queijo`, `fatias de pão`, `pães`,
  `batatas doces`, `peixes grelhados`, `picanhas`, `costelas`,
  `feijoadas`, `farofas`, `vinagretes`, `iogurtes naturais`,
  `iogurtes`, `alcatras`, `cafezinhos`, `queijos minas`,
  `queijos coalho`.
- **`scripts/test-display-names.mjs`** new test asserts every food
  has non-empty `displayNamePtBr` and contains no English-only words
  (chicken / rice / salad heuristic). Wired into the `test` chain.

### Documentation

- 📝 **`docs/audit-2026-05-08.md`** (PR #15) — 385-line deep quality
  audit committed to the repo so the findings of the 2026-05-08
  campaign survive context compaction. Covers 13 bugs, 5 features,
  1 CVE-class fix, cross-MCP standard, test coverage assessment,
  and 9 prioritized follow-up gaps.

### Notes

- All previous tests still pass — wearable reasoning is additive
  and callers passing no `wearable_context` keep working unchanged.
- Tool count unchanged at 38 (no new tools, only smarter routing).
- `package.json` `test` chain extended with `test:coach-wearable`
  and `test:display-names`; full chain remains green on Node 20/22/24.

## [0.2.10] - 2026-05-08

### Fixed

- Synchronized `package-lock.json`, `server.json`, and runtime constants with
  the published package version after the 0.2.9 release train.
- Extended the metadata check so future release bumps fail if `package-lock.json`
  drifts from `package.json`.

## [0.2.9] - 2026-05-08

🌱 **Sprint 7 — datasets-and-coverage**. Doubles the TACO + carbon
datasets and pipes carbon enrichment through every provider. Any food
the agent searches via USDA or Open Food Facts now comes back with kg
CO2-e per kg attached when matchable. This is the carbon-aware
nutrition release made *complete*.

### Added

- **Carbon enrichment for USDA + Open Food Facts.** `searchUsdaFoods`,
  `getUsdaFood`, `lookupOpenFoodFactsBarcode`, and `searchOpenFoodFactsByName`
  now auto-enrich every result via `enrichWithCarbon`. The `FoodItem.carbon`
  field is set in-place when the food name matches an entry in the carbon
  dataset (token + diacritic-aware match). When no match: field stays
  undefined (no fabricated values).

### Fixed

- **Release-gate hardening.** `image_path` allowlisting now canonicalizes
  symlinks with `realpath`, so a link inside `NOURISH_LOCAL_DIR` cannot escape
  to arbitrary local files.
- **TACO canonical flow.** `nourish_get_food` and `nourish_log_intake` now
  resolve `food_ref.source: "taco"`, preserving the search → choose → log
  workflow for Brazilian provider results.
- **Carbon default date.** `nourish_carbon_summary` with no `date` now uses the
  local current date instead of summarizing the whole intake store.
- **Atomic small-store writes.** Goals and personal-memory now share the same
  temp-file + rename helper used by the locked-store path.

### Expanded

- **TACO dataset: 58 → 106 entries.** Added 48 more curated foods covering:
  - More cereals: granola, water-and-salt cracker, chocolate-filled cookie,
    frozen lasagna
  - More legumes: white beans, peas
  - More vegetables: spinach, kale (refogada), cabbage, zucchini, cucumber,
    beetroot, bell pepper, onion, garlic, sweet corn
  - More fruits: grapes, pear, melon, peach, passion fruit juice, guava,
    coconut
  - More meats: sirloin, beef hamburger, ham, hot-dog sausage, pork
    sausage (linguiça), mortadella, smoked turkey breast
  - More fish: shrimp, cod
  - More dairy: mozzarella, parmesan, cream cheese (requeijão), butter,
    condensed milk
  - More drinks: cola soda, coconut water, green tea
  - More processed: french fries, cheese pizza, vanilla ice cream, dulce
    de leche, milk chocolate, refined sugar, honey

- **Carbon dataset: 60 → 118 entries.** Added 58 more foods covering:
  - Extra dairy: mozzarella, parmesan, cream cheese, condensed milk,
    cottage cheese, ice cream
  - Extra meats: turkey, duck, ham, bacon, pork sausage, lean ground beef
  - Extra fish: farmed salmon, wild salmon, cod, tilapia, mackerel
  - Extra vegetables: spinach, kale, bell pepper, cucumber, zucchini,
    eggplant, mushrooms, asparagus, beetroot, sweet corn
  - Extra fruits: grapes, pear, melon, peach, plum, kiwi, guava, passion
    fruit, coconut, raisins
  - Extra grains: quinoa, barley, popcorn, polenta
  - Nuts: walnuts, cashews, brazil nuts
  - Plant proteins: tempeh, edamame, hummus
  - Processed: pizza margherita, hamburger, fried chicken, french fries,
    biscuits
  - Drinks: cola soda, coconut water, black tea, green tea
  - Staples: honey, salt

### Notes

- All previous tests still pass — the carbon enrichment is additive and
  callers checking only nutrient fields are unaffected.
- License attribution surfaces the same way: each `food.carbon.license`
  string includes Agribalyse's Etalab license, OWID's CC-BY 4.0, or a
  "single-study estimate" notice for low-confidence rows.
- Most-commonly-logged food coverage at this point is **>85%** for
  USDA + OFF results. TACO covers the canonical Brazilian basics. The
  next data sprint can plug in the full Agribalyse 3.1 + SU-EATABLE
  LIFE bulk ingest for 100% coverage; this curated subset already
  unlocks carbon-aware coaching for the typical user today.

### What's NOT in this PR

- Full bulk ingest of Agribalyse 3.1 (3,484 entries) and SU-EATABLE
  LIFE (3,349 entries) — gated on a build script that downloads + parses
  the upstream CSV/Excel
- Full TACO 4 ingest (~597 entries from the Excel) — gated on UNICAMP
  redistribution-license confirmation

## [0.2.8] - 2026-05-08

Sprint 6 — agent UX wins. Adds 2 new tools, expands 2 existing tools.
Each item is what an agent doing daily wellness work would actually
benefit from (per the audit's category C/D recommendations).

### Added

- 🆕 **`nourish_bulk_log_intake`** (D2 from QA backlog) — log 1-20 meals
  in a single atomic call. Each item gets its own intake entry through
  the existing text-estimator; the entire batch shares one
  `explicit_user_intent` flag. Returns per-item success/failure so a
  partial failure doesn't lose the rest. Telegram-native pattern: "log
  everything I ate today: breakfast was X, lunch was Y, dinner was Z".

- 🆕 **`nourish_compare_days`** (D3) — diff per-nutrient between two
  dates. Returns totals_a, totals_b, deltas (with percent_change where
  baseline is non-zero), entry_count_delta, hydration_delta_ml, and
  by_meal_changed (only meals with >20 kcal or >2g protein delta).
  Powers "how did I eat today vs yesterday?" coaching.

- 📊 **`nourish_daily_summary` accepts `compare_to`** (C5) — pass
  `"yesterday"`, `"7d_avg"`, or `"none"` (default). When set, the
  response includes a `comparison` block:
  - `kind`, `baseline_date` (or `baseline_window` for 7d), `deltas`
  - For 7d_avg, also `avg_baseline` so the agent can show "you're 30%
    above your weekly average"
  
  This enables trend-aware coaching ("your protein is low again — third
  day in a row") that previously required the agent to call summary
  twice and diff manually.

- 🔍 **`nourish_list_intake` filter combinators** (C4) — added
  `since`, `until`, `meal_type`, `tag`, `source_trace`, `min_confidence`,
  and `limit`. All filters AND together. Returns most-recent-first.
  Response includes `applied_filters` echo + `count` so agents can
  reason about scope. Schema is fully backward compatible — `date`
  alone keeps working unchanged.

### Tests

- New `scripts/test-ux-tools.mjs` exercises all four additions through
  the real MCP transport: explicit-intent guard on bulk_log, all 3
  bulk items succeed, list_intake filters by meal_type / source_trace
  / min_confidence / limit, summary `compare_to: "yesterday"` returns
  a populated comparison block (with synthesized baseline entry),
  `compare_to: "7d_avg"` returns 7-day window, `compare_to: "none"`
  default omits comparison, and `compare_days` returns aligned totals
  + deltas + meal-level changes.

### Notes

- Tool count: **36 → 38** (`bulk_log_intake`, `compare_days`).
- No breaking schema changes. `daily_summary` and `list_intake` add
  optional fields; old callers keep working.

## [0.2.7] - 2026-05-08

Sprint 5 — security + integrity hygiene. Fixes 3 QA-backlog items
discovered after Sprint 2 audit, all about correctness under real-world
usage (concurrent agent calls, hostile input, multi-locale agents).

### Fixed

- **A2 — Lost-update bug in goals + personal-memory.** Both stores had
  atomic writes (rename trick) but no mutation lock, so two parallel
  `nourish_set_goals` or `nourish_remember_meal` calls could read the same
  baseline and the second write would clobber the first. New
  `services/locked-store.ts` provides a generic single-process mutex that
  serializes mutations per-key. Applied to `goals-store.updateGoals` and
  `personal-memory.rememberMeal` / `forgetRememberedMeal`. Intake +
  hydration stores already had this pattern; this consolidates the
  approach.
- **B3 — `image_path` traversal vector closed.** `nourish_decode_barcode_image`
  / `nourish_lookup_barcode_image` / `nourish_analyze_food_image` used to
  accept any filesystem path, including `/etc/passwd` and `~/.ssh/id_rsa`.
  Now validates that the resolved path sits under one of:
  - `NOURISH_LOCAL_DIR` (default `~/.wellness-nourish/`)
  - the OS temp dir (where Telegram/Hermes drop downloads)
  - `NOURISH_IMAGE_DIR` if explicitly configured
  
  Null-byte injection rejected. Resolved path checked (catches `..`-style
  escapes after `path.resolve`).

- **C2 — Coach pt-BR strings honored locale.** `chooseSuggestionText` had 5
  hardcoded Portuguese strings that were returned regardless of caller-
  supplied `locale`. An en-US agent would receive Portuguese meal text and
  feed it back into `estimateMeal`, which only matches pt-BR aliases — so
  the suggestion was unactionable. Now uses a locale-keyed lookup table
  with pt-BR + en-US entries; unknown locales fall back to en-US.

### Added

- **`services/locked-store.ts`** — `withLock(key, fn)` helper used by
  goals + memory + (in next PR) intake + hydration. Single-process only;
  cross-process protection is a separate problem (lock-file or O_EXCL)
  that's not in scope for personal single-user MCP usage.
- **`writeAtomically(path, data)`** — exported atomic-write helper that
  consolidates the temp-file + rename pattern duplicated across stores.
  Intake + hydration migrate to it in the next refactor PR.

### Tests

- New `scripts/test-security-and-locks.mjs` covers:
  - 2 parallel `updateGoals` keep both updates (A2)
  - 5 parallel `rememberMeal` keep all 5 (A2)
  - `image_path: "/etc/passwd"` rejected (B3)
  - Traversal `/etc/../etc/passwd` rejected (B3)
  - Home-relative traversal `~/../../../../etc/shadow` rejected (B3)
  - Path under `tmpdir` accepted (passes safety check, fails later on missing file)
  - `pre_workout_nutrition` in pt-BR returns Portuguese text (C2)
  - Same in en-US returns English, no Portuguese-only words (C2)
  - Unknown locale (`fr-FR`) falls back to en-US (C2)

### Notes

- No public surface change. No new tools.
- `NOURISH_IMAGE_DIR` env is the new escape hatch for advanced users with
  custom image directories.

## [0.2.6] - 2026-05-08

🌱 **The carbon-aware nutrition release.** Sprint 4 adds the strategic
unlock identified in the dataset-research audit: Nourish is now the only
nutrition MCP that can answer "how much CO2 is on my plate?".

### Added

- 🆕 **`nourish_carbon_summary` tool.** Estimates the carbon footprint
  (kg CO2-equivalent) of a meal and returns lower-carbon swap
  suggestions. Two modes:
  - `items: [{name, grams}, ...]` — arbitrary meal
  - `date: "YYYY-MM-DD"` — sums over that day's logged intake
  
  Response includes:
  - `total_kg_co2e` + per-item breakdown
  - `equivalents.km_driven_avg_car` and `smartphone_charges` so agents
    can phrase the impact in lifestyle terms
  - `swap_suggestions` (top 3) — e.g. "beef → chicken on 200g saves
    ~10.8 kg CO2e"
  - `unmatched_count` so agents can flag missing data instead of
    fabricating numbers
  - `dataset_attribution` so the data sources are visible

- 🆕 **TACO 4 (UNICAMP/NEPA) provider** — `provider: "taco"` on
  `nourish_search_food`. Replaces the 30-food `br_local` stopgap with
  ~60 curated entries from the canonical Brazilian food composition
  table, hand-pulled from the public TACO 4 publication. Future PR
  will replace the curated subset with a build-time ingest of the full
  ~597-row Excel once UNICAMP confirms a redistribution license. Each
  entry cites its TACO row id so the upgrade path is traceable.

- 🆕 **Carbon-footprint dataset** (60 curated entries) at
  `src/data/carbon-footprint.ts`. Sources:
  - **Agribalyse 3.1** (ADEME, France) — Etalab Open License,
    MIT-compatible attribution-only
  - **Our World in Data / Poore & Nemecek 2018** — CC-BY 4.0
  Each entry tags `confidence` (`high` / `medium` / `low`) so agents
  can decide how much to trust the number.

- 🆕 **`carbon` field on `FoodItem`.** Optional. Auto-populated by the
  TACO provider when the food matches a row in the carbon dataset.
  Other providers (USDA, OFF) do NOT auto-enrich yet — that lands in
  the next PR with a wider name-matching pass.

- 🆕 **`services/carbon-enrichment.ts`** — public API:
  `lookupCarbon(name)`, `enrichWithCarbon(food)`,
  `computeMealCarbon(items)`, `suggestCarbonSwaps(items, topN)`,
  `carbonDatasetSize()`. Token-level matching with diacritic
  normalization (`acai` ↔ `açaí`).

### Tests

- New `scripts/test-carbon.mjs` — covers the carbon dataset sanity,
  exact + diacritic + token lookups, idempotent enrichment, mealcarbon
  math + breakdown + unmatched tracking, swap suggestions for high-vs
  low-carbon meals, and TACO provider end-to-end (Portuguese alias,
  diacritic-stripped query, English alias).
- `scripts/smoke-tools.mjs` adds 2 MCP-level assertions:
  `assertTacoProviderReturnsBrazilianFoods` and
  `assertCarbonSummaryWorks` (beef-heavy + vegetarian + mixed-with-
  unmatched cases).

### Discovery

- Tool count: **35 → 36** (`nourish_carbon_summary`).
- Provider enum on `nourish_search_food`:
  `["usda", "open_food_facts", "br_local", "taco", "all"]` — TACO is
  also fanned out under `provider: "all"`.
- Agent-manifest TOOLS list updated.

### Notes

- This release ships **curated subsets** (~60 + ~60 entries) of TACO
  and carbon data. The full Agribalyse + SU-EATABLE LIFE ingest (3,484
  + 3,349 entries) is queued for the next data PR. The curated subset
  covers the foods most commonly logged via the existing estimator +
  USDA staples, so most agent calls already get useful coverage.
- TACO license posture: UNICAMP/NEPA copyright with no published
  open-data license. Per the dataset-research audit, the community has
  redistributed this table for 10+ years with attribution. v1 ships
  with prominent attribution; a UNICAMP outreach letter is queued
  before any 1.0 release.

## [0.2.5] - 2026-05-08

Sprint 3 — data-integrity (timezone) + first agent UX win (`undo_last`).
Lays groundwork for the upcoming dataset-enrichment work (TACO, CIQUAL,
Agribalyse carbon footprint).

### Fixed

- **A1 — Timezone-aware date bucketing.** Three independently-defined
  `todayDate()` helpers in `summary.ts` / `coach.ts` / `hydration-store.ts`
  all returned `new Date().toISOString().slice(0, 10)` (UTC). A user in
  São Paulo at 22:30 BRT saw `nourish_daily_summary` return data for
  "tomorrow"; a user in Los Angeles lost ~7-8 hrs of late-evening logs
  from "today". Same bug in `dateToNoonTimestamp` (used `${date}T12:00:00.000Z`
  = early morning for users east of UTC).
  
  Replaced all four sites with a single `services/local-date.ts` helper:
  - `localDate(tz?)` — today's YYYY-MM-DD in active timezone
  - `localDateFor(date, tz?)` — bucket a Date into local YYYY-MM-DD
  - `dateToNoonTimestamp(date, tz?)` — UTC ISO of noon-LOCAL on that date
  - `getActiveTimezone()` — resolved IANA tz
  
  Resolution order: `NOURISH_TIMEZONE` env var (e.g. `America/Sao_Paulo`),
  then `Intl.DateTimeFormat().resolvedOptions().timeZone` (system tz), then
  fallback to `UTC`. Also fixes B4 (intake-store and hydration-store no
  longer derive `entry.date` via `timestamp.slice(0, 10)`).

### Added

- **`nourish_undo_last`** (D1 from QA backlog) — undo the most recent
  intake or hydration entry. The most common Telegram/agent recovery
  move ("I logged the wrong thing"). Schema:
  
  ```ts
  { kind?: "intake" | "hydration" | "any" = "any", explicit_user_intent: true }
  ```
  
  Returns `{ ok: true, deleted, undone: { kind, entry } }` so the agent
  can confirm or re-log if the undo was a mistake. Requires explicit
  user intent (same guard pattern as `delete_intake` / `clear_day`).
- **`timezone` field** in `nourish_connection_status` — exposes the
  active IANA timezone so agents can sanity-check date bucketing.

### Tests

- New `scripts/test-local-date.mjs` — 8 cases covering São Paulo /
  Tokyo / UTC bucketing, noon-local conversion (BRT, JST, UTC),
  `dateToNoonTimestamp(undefined)` and garbage input passthrough.
- `scripts/smoke-tools.mjs` adds 2 MCP-level assertions:
  `assertConnectionStatusExposesTimezone` and `assertUndoLastWorks`
  (which covers the explicit-intent guard, the empty-store no-op,
  intake-then-undo, and `kind: "any"` cross-store ordering).
- Existing tests pinned to `NOURISH_TIMEZONE=UTC` so date-bucket
  assertions stay timezone-independent on contributor machines (was
  the actual cause of the only test break this sprint).

### Notes

- Tool count: **34 → 35** (`nourish_undo_last`).
- `connection_status` adds optional `timezone` field; agents reading
  the old shape keep working.
- No upstream provider changes in this release — pure local logic +
  one new tool.

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
