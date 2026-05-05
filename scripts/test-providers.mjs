import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();

execFileSync("npm", ["run", "build"], { stdio: "inherit" });

process.env.NOURISH_FIXTURE_MODE = "1";
process.env.NOURISH_FIXTURE_DIR = join(root, "fixtures");

const { searchUsdaFoods, getUsdaFood } = await import("../dist/providers/usda.js");

const search = await searchUsdaFoods("banana", 5);
assert.equal(search.foods.length, 2);
assert.equal(search.foods[0].source, "usda");
assert.equal(search.foods[0].name, "Bananas, raw");
assert.equal(search.foods[0].nutrients_per_100g.calories_kcal, 89);
assert.equal(search.foods[1].name, "BANANA");

const detail = await getUsdaFood(search.foods[0].source_id);
assert.equal(detail.source_id, "173944");
assert.equal(detail.license.share_alike, false);
await assert.rejects(() => getUsdaFood("999999"), /fixture not found/i);

const { lookupOpenFoodFactsBarcode } = await import("../dist/providers/open-food-facts.js");
const off = await lookupOpenFoodFactsBarcode("737628064502");
assert.equal(off.food.source, "open_food_facts");
assert.equal(off.food.barcode, "737628064502");
assert.equal(off.food.license.share_alike, true);
assert.match(off.food.license.attribution, /Open Food Facts/);
await assert.rejects(() => lookupOpenFoodFactsBarcode("999999"), /fixture not found/i);

process.env.NOURISH_FIXTURE_MODE = "0";
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => ({
  ok: false,
  status: 429,
  statusText: "Too Many Requests",
});

try {
  await assert.rejects(
    () => lookupOpenFoodFactsBarcode("999888777666"),
    /Open Food Facts is rate limiting requests.*try again/i,
  );
} finally {
  globalThis.fetch = originalFetch;
  process.env.NOURISH_FIXTURE_MODE = "1";
}

process.env.NOURISH_FIXTURE_MODE = "0";
let fetchCalls = 0;
globalThis.fetch = async () => {
  fetchCalls += 1;
  if (fetchCalls === 1) {
    return {
      ok: true,
      async json() {
        return {
          code: "1234567890123",
          status: 1,
          product: {
            code: "1234567890123",
            product_name: "Cached Test Food",
            nutriments: {
              "energy-kcal_100g": 100,
              proteins_100g: 10,
              carbohydrates_100g: 5,
              fat_100g: 2,
            },
          },
        };
      },
    };
  }

  return {
    ok: false,
    status: 429,
    statusText: "Too Many Requests",
  };
};

try {
  const first = await lookupOpenFoodFactsBarcode("1234567890123");
  const second = await lookupOpenFoodFactsBarcode("1234567890123");
  assert.equal(first.food.name, "Cached Test Food");
  assert.equal(second.food.name, "Cached Test Food");
  assert.ok(second.food.data_quality.warnings.some((warning) => /cached/i.test(warning)));
} finally {
  globalThis.fetch = originalFetch;
  process.env.NOURISH_FIXTURE_MODE = "1";
}

console.log("provider fixture tests ok");
