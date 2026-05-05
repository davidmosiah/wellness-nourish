import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

execFileSync("npm", ["run", "build"], { stdio: "inherit" });

const expectedTools = [
  "nourish_agent_manifest",
  "nourish_capabilities",
  "nourish_connection_status",
  "nourish_privacy_audit",
  "nourish_search_food",
  "nourish_lookup_barcode",
  "nourish_get_food",
  "nourish_estimate_meal",
  "nourish_log_intake",
  "nourish_update_intake",
  "nourish_delete_intake",
  "nourish_daily_summary",
  "nourish_weekly_summary",
  "nourish_export_data",
];
const fixtureDir = resolve("fixtures");
const client = new Client(
  {
    name: "nourish-smoke-tools",
    version: "0.1.0",
  },
  {
    capabilities: {},
  },
);
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/index.js"],
  cwd: process.cwd(),
  stderr: "pipe",
  env: {
    ...process.env,
    NOURISH_FIXTURE_MODE: "1",
    NOURISH_FIXTURE_DIR: fixtureDir,
  },
});

try {
  await client.connect(transport);
  const result = await client.listTools();
  const toolNames = result.tools.map((tool) => tool.name);
  const missingTools = expectedTools.filter((toolName) => !toolNames.includes(toolName));

  assert.deepEqual(missingTools, [], `Missing tools: ${missingTools.join(", ")}`);
} finally {
  await client.close();
}

console.log("stdio tool smoke ok");
