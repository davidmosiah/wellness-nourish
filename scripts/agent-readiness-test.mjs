import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

execFileSync("npm", ["run", "build"], { stdio: "inherit" });

const { buildAgentManifest } = await import("../dist/services/agent-manifest.js");

const manifest = buildAgentManifest("codex");

assert.equal(manifest.name, "nourish-mcp");
assert.ok(manifest.supported_clients.includes("codex"));
assert.ok(manifest.tools.includes("nourish_search_food"));
assert.ok(manifest.agent_rules.some((rule) => /confirmation/i.test(rule)));
assert.ok(manifest.agent_rules.some((rule) => /medical advice/i.test(rule)));

console.log("agent readiness ok");
