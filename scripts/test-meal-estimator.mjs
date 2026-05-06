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

const explicitGrams = await estimateMeal({
  text: "200g cooked white rice, 120g cooked pinto beans, 150g grilled chicken breast and simple salad",
  meal_type: "lunch",
  locale: "en-US",
});

assert.deepEqual(explicitGrams.items.map((item) => item.name), ["rice", "pinto beans", "chicken", "salad"]);
assert.equal(explicitGrams.items[0].grams, 200);
assert.equal(explicitGrams.items[1].grams, 120);
assert.equal(explicitGrams.items[2].grams, 150);
assert.ok((explicitGrams.total_nutrients.calories_kcal ?? 0) > 550);
assert.ok((explicitGrams.total_nutrients.protein_g ?? 0) > 55);

const brazilianLunch = await estimateMeal({
  text: "200g arroz branco cozido, 120g feijão carioca, 150g peito de frango grelhado e salada simples",
  meal_type: "lunch",
  locale: "pt-BR",
});

assert.deepEqual(brazilianLunch.items.map((item) => item.name), ["rice", "pinto beans", "chicken", "salad"]);
assert.equal(brazilianLunch.items[0].grams, 200);
assert.equal(brazilianLunch.items[1].grams, 120);
assert.equal(brazilianLunch.items[2].grams, 150);
assert.ok((brazilianLunch.total_nutrients.calories_kcal ?? 0) > 550);
assert.ok((brazilianLunch.total_nutrients.protein_g ?? 0) > 55);

const brazilianBreakfast = await estimateMeal({
  text: "pão de queijo, café preto, banana",
  meal_type: "breakfast",
  locale: "pt-BR",
});

assert.deepEqual(brazilianBreakfast.items.map((item) => item.name), ["pão de queijo", "black coffee", "banana"]);
assert.equal(brazilianBreakfast.unresolved.length, 0);
assert.equal(brazilianBreakfast.items.some((item) => item.name === "toast"), false);
assert.ok((brazilianBreakfast.total_nutrients.calories_kcal ?? 0) > 250);
assert.ok(brazilianBreakfast.confidence >= 0.7);

const partialBrazilianBreakfast = await estimateMeal({
  text: "pão de queijo, café preto, banana, suco verde misterioso",
  meal_type: "breakfast",
  locale: "pt-BR",
});

assert.deepEqual(partialBrazilianBreakfast.items.map((item) => item.name), [
  "pão de queijo",
  "black coffee",
  "banana",
]);
assert.deepEqual(partialBrazilianBreakfast.unresolved, ["suco verde misterioso"]);
assert.ok(partialBrazilianBreakfast.confidence < brazilianBreakfast.confidence);
assert.ok(partialBrazilianBreakfast.confidence <= 0.65);
assert.ok(partialBrazilianBreakfast.warnings.some((warning) => /unresolved/i.test(warning)));

const unknownBrazilianBread = await estimateMeal({
  text: "pão de batata, banana",
  meal_type: "snack",
  locale: "pt-BR",
});

assert.deepEqual(unknownBrazilianBread.items.map((item) => item.name), ["banana"]);
assert.deepEqual(unknownBrazilianBread.unresolved, ["pão de batata"]);
assert.ok(unknownBrazilianBread.confidence <= 0.45);

const brazilianSnack = await estimateMeal({
  text: "1 tapioca com queijo minas, 1 coxinha, 1 brigadeiro e açaí",
  meal_type: "snack",
  locale: "pt-BR",
});

assert.deepEqual(brazilianSnack.items.map((item) => item.name), [
  "tapioca",
  "queijo minas",
  "coxinha",
  "brigadeiro",
  "açaí",
]);
assert.equal(brazilianSnack.unresolved.length, 0);
assert.ok((brazilianSnack.total_nutrients.calories_kcal ?? 0) > 700);

const brazilianKitchenUnits = await estimateMeal({
  text: "1 xícara de arroz branco, 1 colher de sopa de azeite, 1 fatia de pão",
  meal_type: "breakfast",
  locale: "pt-BR",
});

assert.deepEqual(brazilianKitchenUnits.items.map((item) => item.name), ["rice", "olive oil", "pão francês"]);
assert.deepEqual(brazilianKitchenUnits.unresolved, []);
assert.equal(brazilianKitchenUnits.items[0].grams, 240);
assert.equal(brazilianKitchenUnits.items[1].grams, 15);
assert.equal(brazilianKitchenUnits.items[2].grams, 50);

const brazilianChurrasco = await estimateMeal({
  text: "150g picanha, 120g feijoada, farofa, couve refogada e vinagrete",
  meal_type: "lunch",
  locale: "pt-BR",
});

assert.deepEqual(brazilianChurrasco.items.map((item) => item.name), [
  "picanha",
  "feijoada",
  "farofa",
  "couve refogada",
  "vinagrete",
]);
assert.deepEqual(brazilianChurrasco.unresolved, []);
assert.ok((brazilianChurrasco.total_nutrients.calories_kcal ?? 0) > 700);

const twoEggsEnglish = await estimateMeal({
  text: "2 boiled eggs",
  meal_type: "snack",
  locale: "en-US",
});

assert.equal(twoEggsEnglish.items.length, 1);
assert.equal(twoEggsEnglish.items[0].name, "egg");
assert.equal(twoEggsEnglish.items[0].quantity, 2);
assert.equal(twoEggsEnglish.items[0].grams, 100);

const twoEggsPortuguese = await estimateMeal({
  text: "2 ovos cozidos",
  meal_type: "snack",
  locale: "pt-BR",
});

assert.equal(twoEggsPortuguese.items.length, 1);
assert.equal(twoEggsPortuguese.items[0].name, "egg");
assert.equal(twoEggsPortuguese.items[0].quantity, 2);
assert.equal(twoEggsPortuguese.items[0].grams, 100);

console.log("meal estimator tests ok");
