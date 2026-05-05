import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

execFileSync("npm", ["run", "build"], { stdio: "inherit" });

const { IntakeLogInputSchema, ResponseOnlyInputSchema } = await import("../dist/schemas/common.js");
const { bulletList, makeError, makeResponse } = await import("../dist/services/format.js");

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
assert.throws(() => IntakeLogInputSchema.parse({ food: {}, explicit_user_intent: true }));

console.log("normalization/schema smoke ok");
