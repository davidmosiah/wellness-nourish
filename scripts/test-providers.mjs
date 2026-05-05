import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();

execFileSync("npm", ["run", "build"], { stdio: "inherit" });

process.env.NOURISH_FIXTURE_MODE = "1";
process.env.NOURISH_FIXTURE_DIR = join(root, "fixtures");

const { searchUsdaFoods, getUsdaFood } = await import("../dist/providers/usda.js");

const search = await searchUsdaFoods("banana", 5);
assert.equal(search.foods.length, 1);
assert.equal(search.foods[0].source, "usda");
assert.equal(search.foods[0].name, "Bananas, raw");
assert.equal(search.foods[0].nutrients_per_100g.calories_kcal, 89);

const detail = await getUsdaFood("173944");
assert.equal(detail.source_id, "173944");
assert.equal(detail.license.share_alike, false);

console.log("provider fixture tests ok");
