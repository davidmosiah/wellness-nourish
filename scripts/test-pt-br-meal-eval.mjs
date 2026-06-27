import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

execFileSync("npm", ["run", "build"], { stdio: "inherit" });

const { estimateMeal } = await import("../dist/services/meal-estimator.js");

const evalPath = new URL("../docs/evals/pt-br-meal-estimator.json", import.meta.url);
const cases = JSON.parse(readFileSync(evalPath, "utf8"));

assert.ok(Array.isArray(cases), "pt-BR eval fixture must be an array");
assert.ok(cases.length >= 50, `pt-BR eval fixture must have at least 50 examples, got ${cases.length}`);

const requiredCategories = new Set(["breakfast", "lunch", "snack", "dinner", "churrasco"]);
const seenCategories = new Set();
const requiredUnits = new Map([
  ["grams", /\b\d+\s*g\b/iu],
  ["concha", /\bconcha\b/iu],
  ["colher", /\bcolher\b/iu],
  ["xicara", /\bx[íi]cara\b/iu],
  ["fatia", /\bfatia\b/iu],
  ["unidade", /\bunidade\b/iu],
  ["prato", /\bprato\b/iu],
]);
const seenUnits = new Set();
let largeUnresolvedCases = 0;
let resolvedConfidenceSum = 0;
let resolvedCount = 0;
let unresolvedConfidenceSum = 0;
let unresolvedCount = 0;

for (const entry of cases) {
  assert.equal(typeof entry.id, "string", "eval entry needs id");
  assert.equal(typeof entry.text, "string", `${entry.id}: text must be string`);
  assert.equal(typeof entry.meal_type, "string", `${entry.id}: meal_type must be string`);
  assert.ok(Array.isArray(entry.expected_items), `${entry.id}: expected_items must be an array`);
  assert.ok(Array.isArray(entry.expected_unresolved), `${entry.id}: expected_unresolved must be an array`);
  assertRange(entry, "confidence_range");
  assertRange(entry, "calories_kcal_range");

  seenCategories.add(entry.category);
  for (const [unit, pattern] of requiredUnits) {
    if (pattern.test(entry.text)) seenUnits.add(unit);
  }

  const estimate = await estimateMeal({
    text: entry.text,
    meal_type: entry.meal_type,
    locale: "pt-BR",
  });

  const actualItems = estimate.items.map((item) => item.name);
  assert.deepEqual(
    actualItems,
    entry.expected_items,
    `${entry.id}: matched foods changed for "${entry.text}"`,
  );
  assert.deepEqual(
    estimate.unresolved,
    entry.expected_unresolved,
    `${entry.id}: unresolved terms changed for "${entry.text}"`,
  );

  const calories = estimate.total_nutrients.calories_kcal ?? 0;
  assert.ok(
    calories >= entry.calories_kcal_range.min && calories <= entry.calories_kcal_range.max,
    `${entry.id}: calories ${calories} outside ${entry.calories_kcal_range.min}-${entry.calories_kcal_range.max}`,
  );
  assert.ok(
    estimate.confidence >= entry.confidence_range.min && estimate.confidence <= entry.confidence_range.max,
    `${entry.id}: confidence ${estimate.confidence} outside ${entry.confidence_range.min}-${entry.confidence_range.max}`,
  );

  if (entry.expected_unresolved.length === 0) {
    resolvedConfidenceSum += estimate.confidence;
    resolvedCount += 1;
  } else {
    unresolvedConfidenceSum += estimate.confidence;
    unresolvedCount += 1;
  }

  if (entry.large_unresolved_share === true) {
    largeUnresolvedCases += 1;
    assert.ok(
      estimate.unresolved.length >= estimate.items.length,
      `${entry.id}: large unresolved case must have unresolved terms at least as numerous as matched items`,
    );
    assert.ok(
      estimate.confidence <= 0.4,
      `${entry.id}: large unresolved case should have low confidence, got ${estimate.confidence}`,
    );
  }
}

for (const category of requiredCategories) {
  assert.ok(seenCategories.has(category), `pt-BR eval fixture must include category ${category}`);
}
for (const unit of requiredUnits.keys()) {
  assert.ok(seenUnits.has(unit), `pt-BR eval fixture must include Brazilian kitchen unit ${unit}`);
}

assert.ok(largeUnresolvedCases >= 1, "pt-BR eval fixture must include at least one large unresolved-share case");
assert.ok(unresolvedCount >= 3, "pt-BR eval fixture must include multiple unresolved cases");

const resolvedAverage = resolvedConfidenceSum / resolvedCount;
const unresolvedAverage = unresolvedConfidenceSum / unresolvedCount;
assert.ok(
  unresolvedAverage < resolvedAverage,
  `unresolved cases should lower average confidence (${unresolvedAverage} !< ${resolvedAverage})`,
);

console.log(JSON.stringify({
  ok: true,
  suite: "pt-br-meal-eval",
  examples: cases.length,
  categories: [...seenCategories].sort(),
  units: [...seenUnits].sort(),
  resolved_average_confidence: Number(resolvedAverage.toFixed(3)),
  unresolved_average_confidence: Number(unresolvedAverage.toFixed(3)),
}, null, 2));

function assertRange(entry, key) {
  const range = entry[key];
  assert.equal(typeof range?.min, "number", `${entry.id}: ${key}.min must be number`);
  assert.equal(typeof range?.max, "number", `${entry.id}: ${key}.max must be number`);
  assert.ok(range.min <= range.max, `${entry.id}: ${key}.min must be <= max`);
}
