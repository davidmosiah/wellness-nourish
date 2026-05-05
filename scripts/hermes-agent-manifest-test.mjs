import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

execFileSync("npm", ["run", "build"], { stdio: "inherit" });

const { buildAgentManifest } = await import("../dist/services/agent-manifest.js");

const manifest = buildAgentManifest("hermes");

assert.equal(manifest.hermes.tool_name_prefix, "mcp_nourish_");
assert.equal(manifest.hermes.use_direct_tools, true);
assert.match(manifest.hermes.reload_after_config_change, /hermes mcp test nourish/);

console.log("hermes manifest ok");
