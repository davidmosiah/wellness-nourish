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

assert.equal(makeError("x", "failed").isError, true);
assert.throws(() => IntakeLogInputSchema.parse({}));
assert.throws(() => IntakeLogInputSchema.parse({ text: "banana" }));
assert.equal(
  IntakeLogInputSchema.parse({ text: "banana", explicit_user_intent: true }).tags.length,
  0,
);

console.log("normalization/schema smoke ok");
