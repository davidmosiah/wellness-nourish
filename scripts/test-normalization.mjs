import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

execFileSync("npm", ["run", "build"], { stdio: "inherit" });

const { IntakeLogInputSchema, ResponseOnlyInputSchema } = await import("../dist/schemas/common.js");
const { bulletList, makeError, makeResponse } = await import("../dist/services/format.js");
const { roundNutrient, scaleNutrients } = await import("../dist/services/nutrients.js");
const { gramsForQuantity, nutrientsForGrams } = await import("../dist/services/portion-engine.js");

assert.equal(ResponseOnlyInputSchema.parse({}).response_format, "json");
assert.equal(
  ResponseOnlyInputSchema.parse({ response_format: "markdown" }).response_format,
  "markdown",
);

const markdown = bulletList("Nourish", { ok: true, source: "fixture" });
assert.match(markdown, /# Nourish/);
assert.match(markdown, /ok/);

const response = makeResponse({ ok: true }, "json", markdown);
assert.deepEqual(JSON.parse(response.content[0].text), { ok: true });

const errorResponse = makeError("bad");
assert.equal(errorResponse.isError, true);
assert.deepEqual(JSON.parse(errorResponse.content[0].text), {
  ok: false,
  error: { code: "NOURISH_ERROR", message: "bad" },
});
const explicitErrorResponse = makeError("BAD_CODE", "bad");
assert.deepEqual(JSON.parse(explicitErrorResponse.content[0].text), {
  ok: false,
  error: { code: "BAD_CODE", message: "bad" },
});
assert.throws(() => IntakeLogInputSchema.parse({}));
assert.throws(() => IntakeLogInputSchema.parse({ quantity: 1, unit: "serving" }));
assert.equal(IntakeLogInputSchema.parse({ text: "banana", explicit_user_intent: true }).tags.length, 0);
assert.equal(
  IntakeLogInputSchema.parse({
    food_ref: { source: "usda", source_id: "173944", name: "Bananas, raw" },
    explicit_user_intent: true,
  }).food_ref.name,
  "Bananas, raw",
);
assert.equal(
  IntakeLogInputSchema.parse({
    custom_food: {
      source: "manual",
      source_id: "custom-banana",
      name: "Banana",
      nutrients_per_100g: { calories_kcal: 89 },
    },
    explicit_user_intent: true,
  }).custom_food.name,
  "Banana",
);
assert.throws(() => IntakeLogInputSchema.parse({ food: {}, explicit_user_intent: true }));

assert.equal(roundNutrient(12.345), 12.35);
assert.deepEqual(scaleNutrients({ calories_kcal: 100, protein_g: 10 }, 0.5), {
  calories_kcal: 50,
  protein_g: 5,
});
assert.equal(gramsForQuantity(2, "g"), 2);
assert.equal(gramsForQuantity(1, "oz"), 28.35);
assert.deepEqual(nutrientsForGrams({ calories_kcal: 200, protein_g: 20 }, 50), {
  calories_kcal: 100,
  protein_g: 10,
});

console.log("normalization/schema smoke ok");
