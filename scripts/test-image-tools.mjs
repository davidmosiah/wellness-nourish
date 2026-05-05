import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

execFileSync("npm", ["run", "build"], { stdio: "inherit" });

const { decodeBarcodeImage } = await import("../dist/services/image-decoder.js");
const { estimateMealFromPhotoObservation } = await import("../dist/services/photo-meal-estimator.js");

const barcode = "4006381333931";
const decoded = await decodeBarcodeImage({
  image_base64: Buffer.from(ean13Svg(barcode)).toString("base64"),
  image_mime_type: "image/svg+xml",
});

assert.equal(decoded.ok, true);
assert.equal(decoded.barcodes[0]?.text, barcode);
assert.equal(decoded.barcodes[0]?.format, "EAN_13");
assert.equal(decoded.image.source, "base64");
assert.equal(decoded.warnings.length, 0);

const noBarcode = await decodeBarcodeImage({
  image_base64: Buffer.from(blankSvg()).toString("base64"),
  image_mime_type: "image/svg+xml",
});

assert.equal(noBarcode.ok, false);
assert.deepEqual(noBarcode.barcodes, []);
assert.ok(noBarcode.warnings.some((warning) => /No barcode/i.test(warning)));

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
