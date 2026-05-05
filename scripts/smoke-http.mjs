import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

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
const port = 3321;
const localDir = mkdtempSync(`${tmpdir()}/nourish-smoke-http-`);
const child = spawn(process.execPath, ["dist/index.js", "--http"], {
  cwd: process.cwd(),
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    NOURISH_FIXTURE_MODE: "1",
    NOURISH_FIXTURE_DIR: resolve("fixtures"),
    NOURISH_LOCAL_DIR: localDir,
    NOURISH_MCP_PORT: String(port),
  },
});

let stderr = "";
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => {
  stderr += chunk;
});

async function waitForHealth() {
  const deadline = Date.now() + 5000;
  let lastError;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`HTTP server exited early with code ${child.exitCode}: ${stderr}`);
    }

    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) {
        return response;
      }
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolvePoll) => setTimeout(resolvePoll, 100));
  }

  throw lastError ?? new Error("Timed out waiting for /health");
}

try {
  const response = await waitForHealth();
  const health = await response.json();

  assert.equal(health.ok, true);
  assert.equal(health.name, "nourish-mcp");

  const client = new Client(
    {
      name: "nourish-smoke-http",
      version: "0.1.0",
    },
    {
      capabilities: {},
    },
  );
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`));

  try {
    await client.connect(transport);
    const tools = await client.listTools();
    const toolNames = tools.tools.map((tool) => tool.name);
    const missingTools = expectedTools.filter((toolName) => !toolNames.includes(toolName));

    assert.deepEqual(missingTools, [], `Missing HTTP tools: ${missingTools.join(", ")}`);

    const status = await client.callTool({
      name: "nourish_connection_status",
      arguments: {},
    });

    assert.notEqual(status.isError, true);
    assert.match(textFromToolResult(status), /"ok":true/);
  } finally {
    await client.close();
  }
} finally {
  if (child.exitCode === null) {
    child.kill("SIGTERM");
    await Promise.race([
      once(child, "exit"),
      new Promise((resolveKill) => setTimeout(resolveKill, 2000)),
    ]);

    if (child.exitCode === null) {
      child.kill("SIGKILL");
      await once(child, "exit");
    }
  }
}

console.log("http smoke ok");

function textFromToolResult(result) {
  return result.content
    .filter((entry) => entry.type === "text")
    .map((entry) => entry.text)
    .join("\n");
}
