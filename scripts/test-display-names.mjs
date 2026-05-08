import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

execFileSync("npm", ["run", "build"], { stdio: "inherit" });

const { listSimpleFoods } = await import("../dist/services/meal-estimator.js");

const foods = listSimpleFoods();
assert.ok(Array.isArray(foods) && foods.length > 0, "listSimpleFoods() must return a non-empty array");

// Heuristic: pt-BR display labels should not contain English-only words.
// We keep this list intentionally short and conservative — only words that
// have NO common pt-BR usage. Cognates like "yogurt"/"chocolate" don't appear
// in display labels and are not flagged here.
const ENGLISH_ONLY_WORDS = [
  "chicken",
  "rice",
  "salad",
  "apple",
  "egg",
  "milk",
  "bread",
  "beans",
  "cheese",
  "fish",
  "oats",
  "oatmeal",
  "sweet potato",
  "yogurt",
  "coffee",
  "ground beef",
  "beef ribs",
  "chocolate truffle",
  "couscous",
  "olive oil",
];
const englishWordPattern = new RegExp(
  String.raw`(?:^|[^\p{L}])(?:${ENGLISH_ONLY_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?:[^\p{L}]|$)`,
  "iu",
);

const offenders = [];
for (const food of foods) {
  const display = food.displayNamePtBr;
  assert.ok(
    typeof display === "string" && display.trim().length > 0,
    `food "${food.canonical}" must have a non-empty displayNamePtBr`,
  );

  if (englishWordPattern.test(display)) {
    offenders.push({ canonical: food.canonical, displayNamePtBr: display });
  }
}

assert.equal(
  offenders.length,
  0,
  `displayNamePtBr should not contain English-only words. Offenders:\n${JSON.stringify(offenders, null, 2)}`,
);

console.log(`display name coverage ok: ${foods.length}/${foods.length} entries have a pt-BR display name`);
