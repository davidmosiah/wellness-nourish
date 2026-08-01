/**
 * Contract gate for `nourish_demo`.
 *
 * The demo tool exists so agents see the payload shape before any real call. A
 * hand-written example nobody compares against reality drifts silently, and an
 * agent that trusts it writes a parser for fields that never arrive — or, worse,
 * emits a confident wrong answer (the old demo advertised
 * `goals_met: { calories: true, ... }` while the real summary returns
 * `goal_progress.calories_kcal: { actual, goal, percent }`).
 *
 * This gate runs the REAL pipelines offline — fixture mode plus a throwaway
 * local store — and compares key sets against the demo payload, failing in both
 * directions:
 *
 *   - a key in the demo that the real pipeline never emits -> invented contract
 *   - a key the pipeline emits that the demo omits          -> incomplete contract
 *
 * Arrays are compared as the union of their elements' key paths, because a real
 * meal contains items with and without fiber and either alone under-describes
 * the shape.
 *
 * The synthetic day below stands in for a real user's day. It must be written
 * from the DOMAIN (a plausible Brazilian day: four meals, water, nutrient goals),
 * never trimmed to whatever the demo happens to say — trimming it is how the
 * gate becomes decorative.
 */
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

const DEMO_DATE = '2026-05-05';
const TIMEZONE = 'America/Fortaleza';

const localDir = await mkdtemp(path.join(tmpdir(), 'nourish-demo-contract-'));
process.env.NOURISH_LOCAL_DIR = localDir;
process.env.NOURISH_FIXTURE_MODE = '1';
process.env.NOURISH_FIXTURE_DIR = path.join(root, 'fixtures');
process.env.NOURISH_TIMEZONE = TIMEZONE;

/**
 * Keys a pipeline only emits when the underlying data happens to contain them
 * (a provider that carries a barcode, a goal the user never set). The demo may
 * show them because they are part of the contract an agent can encounter, even
 * though this synthetic day does not produce them. Each entry needs a reason.
 *
 * This is deliberately narrow. Adding a key here to silence the gate defeats the
 * gate — only list fields that are genuinely conditional on stored data.
 */
const OPTIONAL_IN_REAL = new Map([
  // No allowances needed today: the synthetic day exercises every field the
  // demo shows. Kept as the explicit, reviewable place to record one if that
  // ever changes.
]);

function keyPaths(value, prefix = '', out = new Set()) {
  if (Array.isArray(value)) {
    // Union across elements: a meal has items with and without fiber.
    for (const item of value) keyPaths(item, `${prefix}[]`, out);
    return out;
  }
  if (value === null || typeof value !== 'object') return out;
  for (const key of Object.keys(value)) {
    const p = prefix ? `${prefix}.${key}` : key;
    out.add(p);
    keyPaths(value[key], p, out);
  }
  return out;
}

function diff(demoSet, realSet) {
  const invented = [...demoSet].filter((k) => !realSet.has(k)).sort();
  const missing = [...realSet]
    .filter((k) => !demoSet.has(k) && !OPTIONAL_IN_REAL.has(k))
    .sort();
  return { invented, missing };
}

function report(name, invented, missing) {
  const lines = [];
  if (invented.length > 0) {
    lines.push(
      `\n  ${name}: ${invented.length} key(s) in the demo that the real pipeline NEVER returns.`,
      `  An agent trusting these writes a parser for data that never arrives:`,
      ...invented.map((k) => `    - ${k}`)
    );
  }
  if (missing.length > 0) {
    lines.push(
      `\n  ${name}: ${missing.length} key(s) the real pipeline returns but the demo omits.`,
      `  Agents reading the demo will not know these exist:`,
      ...missing.map((k) => `    + ${k}`)
    );
  }
  return lines.join('\n');
}

/** A plausible Brazilian day: four meals, three glasses of water, three goals. */
const SYNTHETIC_DAY = [
  {
    meal_type: 'breakfast',
    timestamp: `${DEMO_DATE}T10:20:00.000Z`,
    quantity: 1,
    unit: 'serving',
    confidence: 0.75,
    source_trace: 'estimate',
    nutrients: {
      calories_kcal: 412,
      protein_g: 14.2,
      carbohydrates_g: 48.6,
      fat_g: 17.1,
      fiber_g: 2.4,
      sodium_mg: 486,
    },
  },
  {
    meal_type: 'lunch',
    timestamp: `${DEMO_DATE}T15:10:00.000Z`,
    quantity: 380,
    unit: 'g',
    confidence: 0.82,
    source_trace: 'taco',
    nutrients: {
      calories_kcal: 631,
      protein_g: 42.8,
      carbohydrates_g: 71.4,
      fat_g: 15.3,
      fiber_g: 9.7,
      sodium_mg: 704,
    },
  },
  {
    meal_type: 'snack',
    timestamp: `${DEMO_DATE}T19:05:00.000Z`,
    quantity: 1,
    unit: 'serving',
    confidence: 0.7,
    source_trace: 'estimate',
    nutrients: {
      calories_kcal: 218,
      protein_g: 4.1,
      carbohydrates_g: 29.8,
      fat_g: 9.6,
      fiber_g: 3.5,
      sodium_mg: 12,
    },
  },
  {
    meal_type: 'dinner',
    timestamp: `${DEMO_DATE}T23:15:00.000Z`,
    quantity: 320,
    unit: 'g',
    confidence: 0.78,
    source_trace: 'taco',
    nutrients: {
      calories_kcal: 487,
      protein_g: 31.6,
      carbohydrates_g: 44.2,
      fat_g: 18.4,
      fiber_g: 8.1,
      sodium_mg: 892,
    },
  },
];

let exitCode = 0;

try {
  // Imported AFTER the env vars above: config.ts reads them at module load.
  const { searchFoods } = await import('../dist/tools/nourish-tools.js');
  const { estimateMeal } = await import('../dist/services/meal-estimator.js');
  const { expandMealTextWithMemory } = await import('../dist/services/personal-memory.js');
  const { addIntakeEntry } = await import('../dist/services/intake-store.js');
  const { logWater } = await import('../dist/services/hydration-store.js');
  const { updateGoals } = await import('../dist/services/goals-store.js');
  const { buildDailySummary } = await import('../dist/services/summary.js');
  const { redactSummaryForPrivacy, resolvePrivacyMode } = await import(
    '../dist/services/privacy.js'
  );
  const { buildDemoPayload } = await import('../dist/services/demo.js');

  const payload = buildDemoPayload();
  const demo = payload.sample;
  const inputs = payload.inputs;

  // --- nourish_search_food: the exact helper the tool handler calls.
  const realSearch = await searchFoods(
    inputs.nourish_search_food.query,
    inputs.nourish_search_food.limit,
    inputs.nourish_search_food.provider
  );
  assert.ok(
    realSearch.foods.length > 0,
    'search fixture returned no foods — the gate would pass vacuously'
  );

  // --- nourish_estimate_meal: mirrors the handler composition in
  // src/tools/nourish-tools.ts (expand from memory, estimate, then attach
  // requested_text + personal_memory). Keep the two in sync.
  const mealText = inputs.nourish_estimate_meal.text;
  const expanded = await expandMealTextWithMemory(mealText);
  const estimate = await estimateMeal({
    text: expanded.text,
    meal_type: inputs.nourish_estimate_meal.meal_type,
    locale: inputs.nourish_estimate_meal.locale,
  });
  const realEstimate = {
    ...estimate,
    requested_text: mealText,
    personal_memory: { expanded: expanded.matches.length > 0, matches: expanded.matches },
  };
  assert.ok(
    realEstimate.items.length > 0,
    'meal estimator resolved nothing — the gate would pass vacuously'
  );

  // --- nourish_daily_summary: build a real day in a throwaway store, then run
  // the same two calls the handler runs on the default (no compare_to) path.
  for (const entry of SYNTHETIC_DAY) {
    await addIntakeEntry({ ...entry, tags: [], wellness_context_refs: [] });
  }
  await logWater({ timestamp: `${DEMO_DATE}T11:00:00.000Z`, amount_ml: 600 });
  await logWater({ timestamp: `${DEMO_DATE}T17:30:00.000Z`, amount_ml: 750 });
  await logWater({ timestamp: `${DEMO_DATE}T22:00:00.000Z`, amount_ml: 500 });
  await updateGoals({
    daily: { calories_kcal: 2200, protein_g: 130, fiber_g: 30 },
    hydration_ml: 3000,
  });
  const summary = await buildDailySummary(DEMO_DATE);
  assert.equal(
    summary.entry_count,
    SYNTHETIC_DAY.length,
    'synthetic day did not land on the expected date — check NOURISH_TIMEZONE'
  );
  const realSummary = redactSummaryForPrivacy(summary, resolvePrivacyMode(undefined));

  const real = {
    nourish_search_food: realSearch,
    nourish_estimate_meal: realEstimate,
    nourish_daily_summary: realSummary,
  };

  const failures = [];
  let checked = 0;

  for (const [name, realPayload] of Object.entries(real)) {
    assert.ok(demo[name], `demo payload is missing the ${name} sample entirely`);
    const demoSet = keyPaths(demo[name]);
    const realSet = keyPaths(realPayload);
    const { invented, missing } = diff(demoSet, realSet);
    checked += demoSet.size;
    if (invented.length > 0 || missing.length > 0) {
      failures.push(report(name, invented, missing));
    } else {
      console.log(`PASS ${name} — ${demoSet.size} key paths match the real pipeline`);
    }
  }

  // The demo must stay honest about being synthetic, whatever the shape says.
  assert.equal(payload.is_demo, true, 'demo payload must be tagged is_demo=true');
  assert.ok(
    Array.isArray(payload.notes) && payload.notes.length > 0,
    'demo payload must carry notes'
  );
  console.log('PASS demo payload is tagged synthetic');

  // Every sample must declare the call that produced it, or the gate cannot
  // reproduce it and the next reader cannot verify it by hand.
  for (const name of Object.keys(real)) {
    assert.ok(inputs?.[name], `demo payload must declare inputs.${name}`);
  }
  console.log('PASS every sample declares the call that produced it');

  if (failures.length > 0) {
    console.error('\nFAIL demo contract drifted from the real pipelines:');
    console.error(failures.join('\n'));
    console.error(
      '\nFix src/services/demo.ts so the examples match what the tools return.' +
        '\nDo not widen OPTIONAL_IN_REAL to silence this — that is how the drift got here.\n'
    );
    exitCode = 1;
  } else {
    console.log(`\ndemo-contract: ${checked} key paths verified against the real pipelines`);
    console.log(
      JSON.stringify({ ok: true, suite: 'demo-contract', samples: Object.keys(real).length })
    );
  }
} finally {
  await rm(localDir, { recursive: true, force: true });
}

process.exit(exitCode);
