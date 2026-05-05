import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

execFileSync("npm", ["run", "build"], { stdio: "inherit" });

const { buildAgentManifest } = await import("../dist/services/agent-manifest.js");

const manifest = buildAgentManifest("codex");

assert.equal(manifest.name, "nourish-mcp");
assert.ok(manifest.supported_clients.includes("codex"));
assert.ok(manifest.tools.includes("nourish_search_food"));
assert.ok(manifest.tools.includes("nourish_export_data"));
assert.ok(!manifest.tools.includes("nourish_wellness_context"));
assert.ok(!manifest.tools.includes("nourish_usage_guide"));
assert.deepEqual(manifest.install.optional_env, [
  "FDC_API_KEY",
  "NOURISH_OFF_ENABLED",
  "NOURISH_LOCAL_DIR",
]);
assert.equal(Object.hasOwn(manifest, "optional_env"), false);
assert.ok(manifest.agent_rules.some((rule) => /confirmation/i.test(rule)));
assert.ok(manifest.agent_rules.some((rule) => /medical advice/i.test(rule)));

console.log("agent readiness ok");
