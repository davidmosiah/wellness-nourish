import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

execFileSync("npm", ["run", "build"], { stdio: "inherit" });

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

  assert.ok(toolNames.includes("nourish_search_food"));
  assert.ok(toolNames.includes("nourish_agent_manifest"));
} finally {
  await client.close();
}

console.log("stdio tool smoke ok");
