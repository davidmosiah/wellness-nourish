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

const wordQuantityBreakfast = await estimateMeal({
  text: "pão de queijo, café preto e uma banana",
  meal_type: "breakfast",
  locale: "pt-BR",
});

assert.deepEqual(wordQuantityBreakfast.items.map((item) => item.name), ["pão de queijo", "black coffee", "banana"]);
assert.equal(wordQuantityBreakfast.items.find((item) => item.name === "banana")?.quantity, 1);
assert.deepEqual(wordQuantityBreakfast.unresolved, []);
assert.ok(wordQuantityBreakfast.confidence >= 0.7);

const pluralWordQuantity = await estimateMeal({
  text: "duas bananas e três ovos cozidos",
  meal_type: "snack",
  locale: "pt-BR",
});

assert.equal(pluralWordQuantity.items.find((item) => item.name === "banana")?.quantity, 2);
assert.equal(pluralWordQuantity.items.find((item) => item.name === "egg")?.quantity, 3);
assert.deepEqual(pluralWordQuantity.unresolved, []);

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

// abacate + atum now resolve via the TACO 4 subset (they used to be unresolved).
const tacoCoveredFoods = await estimateMeal({
  text: "abacate e atum",
  meal_type: "snack",
  locale: "pt-BR",
});

assert.equal(tacoCoveredFoods.items.length, 2, "abacate e atum devem resolver via TACO");
assert.deepEqual(tacoCoveredFoods.unresolved, []);

// Regression for the quantity-letter parse: a STILL-unknown food that begins
// with a quantity letter ("a"/"um") must not lose its first letter during
// unresolved cleanup (turning "acerola"/"umbu" into "cerola"/"mbu").
const unknownQuantityLetterFood = await estimateMeal({
  text: "acerola e umbu",
  meal_type: "snack",
  locale: "pt-BR",
});

assert.deepEqual(unknownQuantityLetterFood.items, []);
assert.deepEqual(unknownQuantityLetterFood.unresolved, ["acerola", "umbu"]);

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

// pt-BR plural coverage: ovos / maçãs / tapiocas / coxinhas / brigadeiros
const threeEggsPortuguese = await estimateMeal({
  text: "3 ovos cozidos",
  meal_type: "snack",
  locale: "pt-BR",
});
assert.equal(threeEggsPortuguese.items.length, 1, "3 ovos cozidos should resolve to a single egg item");
assert.equal(threeEggsPortuguese.items[0].name, "egg");
assert.equal(threeEggsPortuguese.items[0].quantity, 3);
assert.equal(threeEggsPortuguese.items[0].grams, 150);

const twoApples = await estimateMeal({
  text: "2 maçãs",
  meal_type: "snack",
  locale: "pt-BR",
});
assert.equal(twoApples.items.length, 1, "'2 maçãs' should resolve apple");
assert.equal(twoApples.items[0].name, "apple");
assert.equal(twoApples.items[0].quantity, 2);

const twoSmallTapiocas = await estimateMeal({
  text: "duas tapiocas pequenas",
  meal_type: "breakfast",
  locale: "pt-BR",
});
assert.ok(
  twoSmallTapiocas.items.some((item) => item.name === "tapioca"),
  "'duas tapiocas pequenas' should resolve tapioca",
);
const tapiocaItem = twoSmallTapiocas.items.find((item) => item.name === "tapioca");
assert.equal(tapiocaItem.quantity, 2);

const threeCoxinhas = await estimateMeal({
  text: "3 coxinhas",
  meal_type: "snack",
  locale: "pt-BR",
});
assert.equal(threeCoxinhas.items.length, 1, "'3 coxinhas' should resolve coxinha");
assert.equal(threeCoxinhas.items[0].name, "coxinha");
assert.equal(threeCoxinhas.items[0].quantity, 3);

const fourBrigadeiros = await estimateMeal({
  text: "4 brigadeiros",
  meal_type: "snack",
  locale: "pt-BR",
});
assert.equal(fourBrigadeiros.items.length, 1, "'4 brigadeiros' should resolve brigadeiro");
assert.equal(fourBrigadeiros.items[0].name, "brigadeiro");
assert.equal(fourBrigadeiros.items[0].quantity, 4);

// --- N-004: pt-BR decimal comma should NOT split clauses ---
const decimalComma = await estimateMeal({
  text: "1,5 banana e 200g arroz cozido",
  meal_type: "snack",
  locale: "pt-BR",
});
assert.equal(
  decimalComma.items.length,
  2,
  `pt-BR decimal comma should produce 2 items, got ${decimalComma.items.length}`,
);
const bananaItem = decimalComma.items.find((item) => item.name === "banana");
assert.ok(bananaItem, "banana should be present");
assert.equal(bananaItem.quantity, 1.5, `banana quantity should be 1.5, got ${bananaItem.quantity}`);
assert.ok(bananaItem.grams < 200, "1.5 bananas should weigh less than 200g");

const decimalCommaSolo = await estimateMeal({
  text: "1,5 banana",
  meal_type: "snack",
  locale: "pt-BR",
});
assert.equal(decimalCommaSolo.items.length, 1, "1,5 banana solo should be a single item");
assert.equal(decimalCommaSolo.items[0].quantity, 1.5);

// --- N-005: zero/negative quantities should be rejected, not silently
//             fall back to a default serving ---
const zeroQuantity = await estimateMeal({
  text: "0g banana",
  meal_type: "snack",
  locale: "en-US",
});
assert.equal(
  zeroQuantity.items.length,
  0,
  `0g banana should produce no items (got ${zeroQuantity.items.length})`,
);
assert.match(
  zeroQuantity.warnings.join(" "),
  /non-positive|rejected/i,
  "warning should mention rejected non-positive quantity",
);

const negativeQuantity = await estimateMeal({
  text: "-100g rice",
  meal_type: "lunch",
  locale: "en-US",
});
assert.equal(
  negativeQuantity.items.length,
  0,
  `-100g rice should produce no items (got ${negativeQuantity.items.length})`,
);
assert.match(
  negativeQuantity.warnings.join(" "),
  /non-positive|rejected/i,
  "warning should mention rejected negative quantity",
);

// Sanity: a normal quantity in the same family must still work.
const positiveControl = await estimateMeal({
  text: "100g rice",
  meal_type: "lunch",
  locale: "en-US",
});
assert.equal(positiveControl.items.length, 1);
assert.equal(positiveControl.items[0].grams, 100);

console.log("meal estimator tests ok");
