import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

execFileSync("npm", ["run", "build"], { stdio: "inherit" });

process.env.FDC_API_KEY = "SECRET_SHOULD_NOT_LEAK";

const { buildAgentManifest } = await import("../dist/services/agent-manifest.js");
const { buildConnectionStatus } = await import("../dist/services/connection-status.js");
const { buildPrivacyAudit } = await import("../dist/services/privacy-audit.js");

const output = JSON.stringify([
  buildPrivacyAudit(),
  buildAgentManifest("codex"),
  buildConnectionStatus(),
]);
const status = buildConnectionStatus();

assert.doesNotMatch(output, /SECRET_SHOULD_NOT_LEAK/);
assert.match(output, /raw health exports/);
assert.ok(status.next_steps.some((step) => /nourish_search_food.*generic foods/i.test(step)));
assert.ok(status.next_steps.some((step) => /nourish_lookup_barcode.*packaged foods/i.test(step)));
assert.ok(status.next_steps.some((step) => /confirm.*logging estimated meals/i.test(step)));

delete process.env.FDC_API_KEY;
delete process.env.USDA_FDC_API_KEY;
const noKeyStatus = buildConnectionStatus();
assert.ok(noKeyStatus.next_steps.some((step) => /FDC_API_KEY.*higher USDA FoodData Central quota/i.test(step)));

process.env.NOURISH_OFF_ENABLED = "0";
const offDisabledStatus = buildConnectionStatus();
assert.ok(
  offDisabledStatus.next_steps.some((step) =>
    /Set NOURISH_OFF_ENABLED=1 to enable packaged-food barcode lookup\./i.test(step),
  ),
);
assert.ok(!offDisabledStatus.next_steps.includes("Use nourish_lookup_barcode for packaged foods."));

console.log("privacy redaction ok");
