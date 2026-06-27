import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

execFileSync("npm", ["run", "build"], { stdio: "inherit" });

const { decodeBarcodeImage } = await import("../dist/services/image-decoder.js");
const { analyzeFoodImage } = await import("../dist/services/food-image-analysis.js");
const { estimateMealFromPhotoObservation } = await import("../dist/services/photo-meal-estimator.js");

const barcode = "4006381333931";
const barcodeSvg = ean13Svg(barcode);
const decoded = await decodeBarcodeImage({
  image_base64: Buffer.from(barcodeSvg).toString("base64"),
  image_mime_type: "image/svg+xml",
});

assert.equal(decoded.ok, true);
assert.equal(decoded.barcodes[0]?.text, barcode);
assert.equal(decoded.barcodes[0]?.format, "EAN_13");
assert.equal(decoded.image.source, "base64");
assert.equal(decoded.warnings.length, 0);

const dataUriDecoded = await decodeBarcodeImage({
  image_data_uri: `data:image/svg+xml;base64,${Buffer.from(barcodeSvg).toString("base64")}`,
});

assert.equal(dataUriDecoded.ok, true);
assert.equal(dataUriDecoded.barcodes[0]?.text, barcode);
assert.equal(dataUriDecoded.image.source, "data_uri");

const imagePath = join(tmpdir(), `wellness-nourish-barcode-${process.pid}.svg`);
await writeFile(imagePath, barcodeSvg);
try {
  const pathDecoded = await decodeBarcodeImage({
    image_path: imagePath,
    image_mime_type: "image/svg+xml",
  });

  assert.equal(pathDecoded.ok, true);
  assert.equal(pathDecoded.barcodes[0]?.text, barcode);
  assert.equal(pathDecoded.image.source, "path");
} finally {
  await unlink(imagePath);
}

const noBarcode = await decodeBarcodeImage({
  image_base64: Buffer.from(blankSvg()).toString("base64"),
  image_mime_type: "image/svg+xml",
});

assert.equal(noBarcode.ok, false);
assert.deepEqual(noBarcode.barcodes, []);
assert.ok(noBarcode.warnings.some((warning) => /No barcode/i.test(warning)));
assert.equal(noBarcode.fallback?.reason, "barcode_not_decoded");
assert.ok(noBarcode.next_actions?.some((action) => /type the digits/i.test(action)));
assert.ok(noBarcode.fallback?.accepted_alternatives.includes("product_name plus nutrition_label_text"));

await assert.rejects(
  () => decodeBarcodeImage({
    image_base64: Buffer.from("not an image").toString("base64"),
    image_mime_type: "image/png",
  }),
  /could not be decoded as an image/i,
);

const blurryBarcode = await analyzeFoodImage({
  barcode_observation: "barcode appears on the package but is blurry and the digits are unreadable",
  locale: "pt-BR",
  meal_type: "snack",
});

assert.equal(blurryBarcode.route, "needs_more_detail");
assert.equal(blurryBarcode.requires_confirmation, true);
assert.equal(blurryBarcode.suggested_log_intake, undefined);
assert.ok(Array.isArray(blurryBarcode.next_actions));
assert.ok(blurryBarcode.next_actions.some((action) => /type the digits/i.test(action)));
assert.ok(blurryBarcode.fallback_options.includes("product_name plus nutrition_label_text"));

const labelOnly = await analyzeFoodImage({
  product_name: "Iogurte Proteico",
  nutrition_label_text: "Porção 170g Valor energético 120 kcal Carboidratos 8g Proteínas 15g Gorduras totais 2g",
  locale: "pt-BR",
  meal_type: "snack",
});

assert.equal(labelOnly.route, "nutrition_label");
assert.equal(labelOnly.requires_confirmation, true);
assert.equal(labelOnly.label_food.name, "Iogurte Proteico");
assert.equal(labelOnly.label_food.nutrients_per_serving.protein_g, 15);
assert.equal(labelOnly.suggested_log_intake.explicit_user_intent, false);
assert.ok(labelOnly.next_actions.some((action) => /confirm/i.test(action)));

const meal = await estimateMealFromPhotoObservation({
  image_description: "Telegram photo appears to show a lunch plate with white rice and grilled chicken.",
  detected_items: [
    { name: "rice", quantity: 1, unit: "cup", confidence: 0.7 },
    { name: "chicken", grams_estimate: 120, confidence: 0.65 },
  ],
  meal_type: "lunch",
  locale: "en-US",
});

assert.equal(meal.source, "agent_vision_observation");
assert.equal(meal.requires_confirmation, true);
assert.equal(meal.can_log_without_confirmation, false);
assert.match(meal.estimate.text, /rice/);
assert.match(meal.estimate.text, /chicken/);
assert.ok((meal.estimate.total_nutrients.calories_kcal ?? 0) > 300);
assert.ok(meal.estimate.confidence < 0.55);
assert.ok(meal.warnings.some((warning) => /photo/i.test(warning)));

const brazilianPhotoMeal = await estimateMealFromPhotoObservation({
  image_description: "Foto do Telegram mostra arroz branco cozido, feijão carioca, peito de frango grelhado e salada simples.",
  detected_items: [
    { name: "arroz branco cozido", grams_estimate: 200, confidence: 0.7 },
    { name: "feijão carioca", grams_estimate: 120, confidence: 0.65 },
    { name: "peito de frango grelhado", grams_estimate: 150, confidence: 0.7 },
    { name: "salada simples", quantity: 1, unit: "serving", confidence: 0.55 },
  ],
  meal_type: "lunch",
  locale: "pt-BR",
});

assert.equal(brazilianPhotoMeal.requires_confirmation, true);
assert.equal(brazilianPhotoMeal.can_log_without_confirmation, false);
assert.match(brazilianPhotoMeal.estimate.text, /arroz/);
assert.ok((brazilianPhotoMeal.estimate.total_nutrients.calories_kcal ?? 0) > 550);
assert.ok((brazilianPhotoMeal.estimate.total_nutrients.protein_g ?? 0) > 55);

console.log("image tools ok");

function ean13Svg(code) {
  const digits = code.split("").map((char) => Number.parseInt(char, 10));
  assert.equal(digits.length, 13);

  const leftOdd = [
    "0001101",
    "0011001",
    "0010011",
    "0111101",
    "0100011",
    "0110001",
    "0101111",
    "0111011",
    "0110111",
    "0001011",
  ];
  const leftEven = [
    "0100111",
    "0110011",
    "0011011",
    "0100001",
    "0011101",
    "0111001",
    "0000101",
    "0010001",
    "0001001",
    "0010111",
  ];
  const right = [
    "1110010",
    "1100110",
    "1101100",
    "1000010",
    "1011100",
    "1001110",
    "1010000",
    "1000100",
    "1001000",
    "1110100",
  ];
  const parity = [
    "OOOOOO",
    "OOEOEE",
    "OOEEOE",
    "OOEEEO",
    "OEOOEE",
    "OEEOOE",
    "OEEEOO",
    "OEOEOE",
    "OEOEEO",
    "OEEOEO",
  ];

  const pattern = [
    "101",
    ...digits.slice(1, 7).map((digit, index) => (parity[digits[0]][index] === "O" ? leftOdd[digit] : leftEven[digit])),
    "01010",
    ...digits.slice(7).map((digit) => right[digit]),
    "101",
  ].join("");

  const moduleWidth = 4;
  const quiet = 14 * moduleWidth;
  const height = 180;
  const width = pattern.length * moduleWidth + quiet * 2;
  const bars = [];
  for (let index = 0; index < pattern.length; index += 1) {
    if (pattern[index] === "1") {
      bars.push(`<rect x="${quiet + index * moduleWidth}" y="16" width="${moduleWidth}" height="136" fill="#000"/>`);
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fff"/>${bars.join("")}</svg>`;
}

function blankSvg() {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="128"><rect width="100%" height="100%" fill="#fff"/></svg>';
}
