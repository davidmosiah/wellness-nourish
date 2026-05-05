import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

execFileSync("npm", ["run", "build"], { stdio: "inherit" });

const { ResponseOnlyInputSchema } = await import("../dist/schemas/common.js");
const { bulletList, makeResponse } = await import("../dist/services/format.js");

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

console.log("normalization/schema smoke ok");
