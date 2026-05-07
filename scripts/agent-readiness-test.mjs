import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

execFileSync("npm", ["run", "build"], { stdio: "inherit" });
execFileSync("npm", ["run", "prepack"], { stdio: "inherit" });

const { buildAgentManifest } = await import("../dist/services/agent-manifest.js");
const packageVersion = JSON.parse(readFileSync("package.json", "utf8")).version;

const manifest = buildAgentManifest("codex");

assert.equal(manifest.name, "nourish-mcp");
assert.ok(manifest.supported_clients.includes("codex"));
assert.ok(manifest.tools.includes("nourish_search_food"));
assert.ok(manifest.tools.includes("nourish_decode_barcode_image"));
assert.ok(manifest.tools.includes("nourish_lookup_barcode_image"));
assert.ok(manifest.tools.includes("nourish_estimate_meal_photo"));
assert.ok(manifest.tools.includes("nourish_analyze_food_image"));
assert.ok(manifest.tools.includes("nourish_daily_coach"));
assert.ok(manifest.tools.includes("nourish_suggest_next_meal"));
assert.ok(manifest.tools.includes("nourish_remember_meal"));
assert.ok(manifest.tools.includes("nourish_list_memory"));
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
assert.ok(manifest.agent_rules.some((rule) => /coach tools/i.test(rule)));
assert.ok(manifest.agent_rules.some((rule) => /personal memory/i.test(rule)));
assert.ok(manifest.agent_rules.some((rule) => /medical advice/i.test(rule)));
assert.ok(manifest.hermes.common_tool_names.includes("mcp_nourish_nourish_daily_summary"));
assert.ok(manifest.hermes.common_tool_names.includes("mcp_nourish_nourish_daily_coach"));
assert.ok(JSON.stringify(manifest.hermes.recommended_config).includes(`wellness-nourish@${packageVersion}`));

const examples = [
  "examples/claude-desktop.json",
  "examples/codex.json",
  "examples/cursor.json",
  "examples/windsurf.json",
  "examples/hermes.md",
  "examples/hermes-skill.md",
  "examples/openclaw.md",
];
for (const example of examples) {
  assert.ok(statSync(example).size > 0, `${example} should not be empty`);
}

console.log("agent readiness ok");
