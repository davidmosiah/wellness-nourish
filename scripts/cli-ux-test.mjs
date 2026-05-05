import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

execFileSync("npm", ["run", "build"], { stdio: "inherit" });

const env = {
  ...process.env,
  NOURISH_FIXTURE_MODE: "1",
  NOURISH_FIXTURE_DIR: resolve("fixtures"),
  NOURISH_LOCAL_DIR: mkdtempSync(`${tmpdir()}/nourish-cli-ux-`),
};

const status = run(["status"]);
assert.match(status, /Nourish MCP/);
assert.match(status, /open_food_facts_enabled/);

const search = run(["search", "banana"]);
assert.match(search, /Bananas, raw/);
assert.match(search, /usda/);

const version = run(["--version"]);
assert.match(version, /nourish-mcp 0\.1\.0/);

const help = run(["--help"]);
assert.match(help, /usage/i);

console.log("cli ux ok");

function run(args) {
  return execFileSync(process.execPath, ["dist/index.js", ...args], {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
  });
}
