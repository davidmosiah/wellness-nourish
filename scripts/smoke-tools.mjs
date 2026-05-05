import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
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
const localDir = mkdtempSync(`${tmpdir()}/nourish-smoke-tools-`);
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
    NOURISH_LOCAL_DIR: localDir,
  },
});

try {
  await client.connect(transport);
  const result = await client.listTools();
  const toolNames = result.tools.map((tool) => tool.name);
  const missingTools = expectedTools.filter((toolName) => !toolNames.includes(toolName));

  assert.deepEqual(missingTools, [], `Missing tools: ${missingTools.join(", ")}`);
  assertSearchSchemaHonest(result.tools);
  assertBarcodeSchemaHonest(result.tools);

  const nutrientlessLog = await client.callTool({
    name: "nourish_log_intake",
    arguments: {
      explicit_user_intent: true,
      food_ref: {
        source: "usda",
        source_id: "123",
        name: "Nutrientless food ref",
      },
    },
  });

  assert.equal(nutrientlessLog.isError, true);
  assert.match(textFromToolResult(nutrientlessLog), /nutrient/i);
} finally {
  await client.close();
}

console.log("stdio tool smoke ok");

function assertSearchSchemaHonest(tools) {
  const searchTool = findTool(tools, "nourish_search_food");
  const provider = searchTool.inputSchema?.properties?.provider;

  if (provider !== undefined) {
    assert.deepEqual(provider.enum, ["usda"]);
  }
}

function assertBarcodeSchemaHonest(tools) {
  const barcodeTool = findTool(tools, "nourish_lookup_barcode");

  assert.equal(
    Object.hasOwn(barcodeTool.inputSchema?.properties ?? {}, "fallback_search"),
    false,
  );
}

function findTool(tools, name) {
  const tool = tools.find((entry) => entry.name === name);

  assert.ok(tool, `Missing tool ${name}`);
  return tool;
}

function textFromToolResult(result) {
  return result.content
    .filter((entry) => entry.type === "text")
    .map((entry) => entry.text)
    .join("\n");
}
