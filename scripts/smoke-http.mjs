import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";

execFileSync("npm", ["run", "build"], { stdio: "inherit" });

const port = 3321;
const child = spawn(process.execPath, ["dist/index.js", "--http"], {
  cwd: process.cwd(),
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    NOURISH_FIXTURE_MODE: "1",
    NOURISH_FIXTURE_DIR: resolve("fixtures"),
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
