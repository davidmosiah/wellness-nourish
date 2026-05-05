import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

execFileSync("npm", ["run", "build"], { stdio: "inherit" });

const { estimateMeal } = await import("../dist/services/meal-estimator.js");

const estimate = await estimateMeal({
  text: "2 eggs and 1 banana",
  meal_type: "breakfast",
  locale: "en-US",
});

assert.equal(estimate.items.length, 2);
assert.equal(estimate.meal_type, "breakfast");
assert.ok(estimate.total_nutrients.calories_kcal > 200);
assert.ok(estimate.confidence < 1);
assert.match(estimate.warnings.join(" "), /estimate/i);

const halfBanana = await estimateMeal({
  text: "1/2 banana",
  meal_type: "snack",
  locale: "en-US",
});

assert.equal(halfBanana.items.length, 1);
assert.equal(halfBanana.items[0].name, "banana");
assert.equal(halfBanana.items[0].quantity, 0.5);
assert.ok(halfBanana.total_nutrients.calories_kcal < 89 * 1.18);

const bananaBread = await estimateMeal({
  text: "banana-bread",
  meal_type: "snack",
  locale: "en-US",
});

assert.equal(bananaBread.items.length, 0);

const portionEstimate = await estimateMeal({
  text: "1 cup rice and 4 oz chicken",
  meal_type: "lunch",
  locale: "en-US",
});

assert.equal(portionEstimate.items.length, 2);
assert.equal(portionEstimate.items[0].name, "rice");
assert.equal(portionEstimate.items[0].grams, 240);
assert.equal(portionEstimate.items[1].name, "chicken");
assert.equal(portionEstimate.items[1].grams, 113.4);
assert.ok(portionEstimate.total_nutrients.protein_g > 30);

console.log("meal estimator tests ok");
