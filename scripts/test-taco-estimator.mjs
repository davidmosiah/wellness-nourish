import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

execFileSync("npm", ["run", "build"], { stdio: "inherit" });

const { estimateMeal } = await import("../dist/services/meal-estimator.js");

// Brazilian foods that USED to fall into `unresolved` with only the 38 curated
// SIMPLE_FOODS and now resolve through the curated TACO 4 (UNICAMP/NEPA) subset.
const tacoOnlyFoods = [
  "lentilha",
  "grão de bico",
  "abacate",
  "tomate",
  "cenoura",
  "brócolis",
  "salmão",
  "tilápia",
  "granola",
  "manga",
  "abacaxi",
  "tofu",
];

let anySodium = false;
for (const food of tacoOnlyFoods) {
  const r = await estimateMeal({ text: food, meal_type: "other", locale: "pt-BR" });
  assert.equal(
    r.items.length,
    1,
    `"${food}" deveria resolver via TACO (itens=${r.items.length}, unresolved=${r.unresolved.join("/")})`,
  );
  assert.deepEqual(r.unresolved, [], `"${food}" não deveria deixar termos sem resolver`);
  assert.ok((r.total_nutrients.calories_kcal ?? 0) > 0, `"${food}" deveria ter calorias`);
  if (typeof r.total_nutrients.sodium_mg === "number") anySodium = true;
}

// The TACO table carries sodium that the 38 curated defaults never had.
assert.ok(anySodium, "pelo menos um alimento TACO deveria trazer sodium_mg");

// Accent-free input must also resolve — pt-BR users on mobile often skip accents.
const noAccent = await estimateMeal({ text: "brocolis e tilapia", meal_type: "lunch", locale: "pt-BR" });
assert.equal(noAccent.items.length, 2, "\"brocolis e tilapia\" sem acento deveria resolver 2 itens");
assert.deepEqual(noAccent.unresolved, []);

// Precedence: a curated food keeps using its hand-tuned entry, not TACO.
const curated = await estimateMeal({ text: "2 ovos cozidos", meal_type: "snack", locale: "pt-BR" });
assert.equal(curated.items.length, 1);
assert.equal(curated.items[0].name, "egg", "ovo deve continuar resolvendo para a entrada curada ('egg')");

// Mixed plate: curated + TACO foods in the same meal.
const mixed = await estimateMeal({
  text: "150g arroz, 100g lentilha, abacate e salada",
  meal_type: "lunch",
  locale: "pt-BR",
});
assert.ok(mixed.items.length >= 4, `refeição mista deveria resolver >=4 itens (veio ${mixed.items.length})`);
assert.deepEqual(mixed.unresolved, []);

console.log("taco estimator tests ok");
