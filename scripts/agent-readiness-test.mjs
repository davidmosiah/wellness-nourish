import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";

execFileSync("npm", ["run", "build"], { stdio: "inherit" });
execFileSync("npm", ["run", "prepack"], { stdio: "inherit" });

const { buildAgentManifest } = await import("../dist/services/agent-manifest.js");

const manifest = buildAgentManifest("codex");

assert.equal(manifest.name, "nourish-mcp");
assert.ok(manifest.supported_clients.includes("codex"));
assert.ok(manifest.tools.includes("nourish_search_food"));
assert.ok(manifest.tools.includes("nourish_export_data"));
assert.ok(manifest.tools.includes("nourish_list_intake"));
assert.ok(manifest.tools.includes("nourish_log_water"));
assert.ok(manifest.tools.includes("nourish_set_goals"));
assert.ok(!manifest.tools.includes("nourish_wellness_context"));
assert.ok(manifest.resources.includes("nourish://usage-guide"));
assert.equal(manifest.install.command, "npx");
assert.deepEqual(manifest.install.args, ["-y", "wellness-nourish"]);
assert.deepEqual(manifest.install.optional_env, [
  "FDC_API_KEY",
  "NOURISH_OFF_ENABLED",
  "NOURISH_LOCAL_DIR",
]);
assert.equal(Object.hasOwn(manifest, "optional_env"), false);
assert.ok(manifest.agent_rules.some((rule) => /confirmation/i.test(rule)));
assert.ok(manifest.agent_rules.some((rule) => /medical advice/i.test(rule)));

const examples = [
  "examples/claude-desktop.json",
  "examples/codex.json",
  "examples/cursor.json",
  "examples/windsurf.json",
  "examples/hermes.md",
  "examples/openclaw.md",
];
for (const example of examples) {
  assert.ok(statSync(example).size > 0, `${example} should not be empty`);
}

console.log("agent readiness ok");
