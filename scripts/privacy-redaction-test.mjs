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

console.log("privacy redaction ok");
