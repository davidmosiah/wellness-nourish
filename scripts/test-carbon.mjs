// Regression tests for the carbon-footprint dataset and enrichment service.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

execFileSync("npm", ["run", "build"], { stdio: "inherit" });

const {
  lookupCarbon,
  enrichWithCarbon,
  computeMealCarbon,
  suggestCarbonSwaps,
  carbonDatasetSize,
} = await import("../dist/services/carbon-enrichment.js");

const { searchTacoFoods, tacoDatasetSize } = await import("../dist/providers/taco.js");

// --- Dataset size sanity ---
assert.ok(carbonDatasetSize() >= 50, `carbon dataset should ship >=50 entries (got ${carbonDatasetSize()})`);
assert.ok(tacoDatasetSize() >= 50, `TACO subset should ship >=50 entries (got ${tacoDatasetSize()})`);

// --- lookupCarbon: exact + diacritic-insensitive + token match ---
const beef = lookupCarbon("beef");
assert.ok(beef !== undefined, "beef must match the carbon dataset");
assert.ok(beef.kg_co2e_per_kg > 50, `beef must be >50 kg CO2e/kg; got ${beef.kg_co2e_per_kg}`);
assert.match(beef.source, /^owid_poore_nemecek_2018:/);
assert.match(beef.license, /Our World in Data|CC-BY/i);

// pt-BR variant
const carne = lookupCarbon("carne bovina");
assert.ok(carne !== undefined, "'carne bovina' must match");
assert.equal(carne.kg_co2e_per_kg, beef.kg_co2e_per_kg, "pt-BR alias must point to same row");

// Diacritic-insensitive
const acai = lookupCarbon("açaí");
assert.ok(acai !== undefined, "açaí must match");
const acaiNoAccent = lookupCarbon("acai");
assert.ok(acaiNoAccent !== undefined, "diacritic-stripped version must also match");

// Token match (downgrades confidence)
const peitoFrango = lookupCarbon("peito de frango grelhado");
assert.ok(peitoFrango !== undefined, "compound query must token-match against 'frango' aliases");

// Unknown
assert.equal(lookupCarbon("totally_unknown_food_xyz_abc"), undefined);
assert.equal(lookupCarbon(""), undefined);

// --- enrichWithCarbon: idempotent, preserves existing data ---
const food = {
  id: "test:1",
  source: "manual",
  source_id: "test-1",
  name: "chicken",
  available_portions: [],
  nutrients_per_100g: {},
  data_quality: { completeness: "low", confidence: 0.5, warnings: [] },
  license: { name: "test", attribution: "test", share_alike: false },
};
const enriched = enrichWithCarbon(food);
assert.equal(enriched, food, "enrichWithCarbon returns the same reference");
assert.ok(enriched.carbon !== undefined, "chicken must get carbon attached");
const firstCarbon = enriched.carbon;
enrichWithCarbon(food);
assert.equal(food.carbon, firstCarbon, "enrichWithCarbon must be idempotent");

// --- computeMealCarbon: math + breakdown + unmatched + equivalents ---
const meal = computeMealCarbon([
  { name: "beef", grams: 200 },
  { name: "rice", grams: 150 },
  { name: "fictional_xyz", grams: 100 },
]);
// Beef: 60 kg/kg * 0.2 kg = 12 kg CO2e
// Rice: 4 kg/kg * 0.15 kg = 0.6 kg CO2e
// Total: ~12.6 kg
assert.ok(Math.abs(meal.total_kg_co2e - 12.6) < 0.5, `expected ~12.6 kg CO2e; got ${meal.total_kg_co2e}`);
assert.equal(meal.items.length, 3);
assert.equal(meal.unmatched_count, 1);
assert.equal(meal.items[2].matched, false);
assert.ok(meal.equivalents.km_driven_avg_car > 0);
assert.ok(meal.equivalents.smartphone_charges > 1000); // 12.6 kg / 0.008 ≈ 1575

// --- suggestCarbonSwaps: beef → chicken, savings reported ---
const swaps = suggestCarbonSwaps([{ name: "beef", grams: 200 }], 3);
assert.ok(swaps.length > 0, "beef should trigger at least one swap suggestion");
assert.match(swaps[0].from_name, /beef/i);
assert.equal(swaps[0].to_name, "chicken");
assert.ok(swaps[0].saved_kg_co2e > 5, `beef → chicken on 200g should save >5 kg CO2e; got ${swaps[0].saved_kg_co2e}`);

// --- Low-carbon meals get no swap suggestions ---
const veggieSwaps = suggestCarbonSwaps([
  { name: "rice", grams: 150 },
  { name: "tofu", grams: 100 },
], 3);
assert.equal(veggieSwaps.length, 0, "low-carbon items should not trigger swaps");

// --- TACO provider sanity ---
const tacoRice = await searchTacoFoods("arroz integral", 5);
assert.ok(tacoRice.foods.length > 0, "TACO must find arroz integral");
assert.equal(tacoRice.foods[0].source, "taco");
assert.match(tacoRice.foods[0].name, /Arroz/);
// Auto-enrichment: rice should pick up carbon.
assert.ok(tacoRice.foods[0].carbon !== undefined, "TACO foods should auto-enrich with carbon when matchable");

// Diacritic-insensitive
const tacoFeijao = await searchTacoFoods("feijao carioca", 5);
assert.ok(tacoFeijao.foods.length > 0, "TACO must match 'feijao' (no diacritic) → 'feijão'");

// English alias
const tacoBeans = await searchTacoFoods("black beans", 5);
assert.ok(tacoBeans.foods.length > 0, "TACO English alias 'black beans' must match");

console.log("carbon + TACO tests ok");
