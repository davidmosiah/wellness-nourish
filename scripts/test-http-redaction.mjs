import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// --source is dependency-free on Node 24: only this newly authored pure module
// is evaluated. Default mode tests the built artifact on the supported Node matrix.
const modulePath = process.argv.includes("--source")
  ? "../src/services/http-redaction.ts" : "../dist/services/http-redaction.js";
const { sanitizeHttpDiagnostics } = await import(new URL(modulePath, import.meta.url));
const key = "SYNTHETIC_ONLY_KEY_6cc5+/=?";
const url = new URL("https://provider.invalid/foods/search");
url.searchParams.set("api_key", key);
url.searchParams.set("query", "banana");
for (const status of [400, 401, 403, 404, 408, 429, 500, 503]) {
  const nested = new Error(`outer: ${JSON.stringify({ cause: { message: `HTTP ${status}: ${url}`, echoed_key: key } })}`);
  const result = sanitizeHttpDiagnostics(String(url), nested.message);
  for (const output of [result.url, result.message, JSON.stringify(result)]) {
    assert.ok(!output.includes(key), "raw synthetic credential must be absent");
    assert.ok(!output.includes(encodeURIComponent(key)), "encoded credential must be absent");
  }
  assert.match(result.message, new RegExp(`HTTP ${status}`));
  assert.equal(new URL(result.url).searchParams.get("api_key"), "REDACTED");
  assert.equal(new URL(result.url).searchParams.get("query"), "banana");
}
for (const parameter of ["API_KEY", "api-key", "key", "access_token", "refresh_token", "client_secret", "password"]) {
  const input = `https://provider.invalid/path?${parameter}=SYNTHETIC_SECRET&${parameter}=SECOND_SYNTHETIC`;
  const result = sanitizeHttpDiagnostics(input, `403: ${input}`);
  assert.ok(!JSON.stringify(result).includes("SYNTHETIC"));
}
const basic = sanitizeHttpDiagnostics("https://syntheticuser:syntheticpass@provider.invalid/path#private", "syntheticpass request failed");
assert.ok(!JSON.stringify(basic).includes("syntheticpass"));
assert.ok(!basic.url.includes("#"));
// A nested diagnostic can JSON-escape credentials rather than echo raw text.
const quotedKey = 'SYNTHETIC"QUOTE\\KEY';
const quotedUrl = new URL("https://provider.invalid/path");
quotedUrl.searchParams.set("api_key", quotedKey);
for (const message of [
  JSON.stringify({ cause: { echoed_key: quotedKey, status: 403 } }),
  JSON.stringify({ cause: JSON.stringify({ echoed_key: quotedKey, status: 403 }) }),
]) {
  const result = sanitizeHttpDiagnostics(String(quotedUrl), message);
  assert.ok(!result.message.includes("SYNTHETIC"));
  assert.match(result.message, /403/);
}
const bad = sanitizeHttpDiagnostics("not a URL", "do not echo any of this");
assert.equal(bad.message, "Provider request failed (invalid URL).");
// Static wiring checks: no provider call or existing application code executed.
const helper = await readFile(new URL("../src/services/http.ts", import.meta.url), "utf8");
assert.match(helper, /sanitizeHttpDiagnostics\(input\.url, input\.message\)/);
assert.match(helper, /super\(safe\.message\)/);
assert.match(helper, /this\.url = safe\.url/);
const provider = await readFile(new URL("../src/providers/usda.ts", import.meta.url), "utf8");
assert.ok(!provider.includes("${err.status} ${err.message}"));
console.log("HTTP credential-redaction tests passed (pure module and static wiring only).");
