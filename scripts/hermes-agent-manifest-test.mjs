import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

execFileSync("npm", ["run", "build"], { stdio: "inherit" });

const { buildAgentManifest } = await import("../dist/services/agent-manifest.js");
const packageVersion = JSON.parse(readFileSync("package.json", "utf8")).version;
const pinnedPackage = `wellness-nourish@${packageVersion}`;

const manifest = buildAgentManifest("hermes");

assert.equal(manifest.hermes.tool_name_prefix, "mcp_nourish_");
assert.equal(manifest.hermes.use_direct_tools, true);
assert.match(manifest.hermes.reload_after_config_change, /hermes mcp test nourish/);
assert.equal(manifest.hermes.no_gateway_restart_for_data_access, true);
assert.ok(manifest.hermes.common_tool_names.includes("mcp_nourish_nourish_connection_status"));
assert.ok(JSON.stringify(manifest.hermes.recommended_config).includes(pinnedPackage));

const dir = mkdtempSync(join(tmpdir(), "nourish-mcp-hermes-agent-"));
const mergeDir = mkdtempSync(join(tmpdir(), "nourish-mcp-hermes-merge-"));

try {
  const setup = spawnSync(process.execPath, [
    "dist/index.js",
    "setup",
    "--client",
    "hermes",
    "--profile",
    "david",
    "--home-dir",
    dir,
    "--json",
  ], {
    encoding: "utf8",
    env: { ...process.env, HOME: dir },
  });
  assert.equal(setup.status, 0, setup.stderr);
  const setupPayload = JSON.parse(setup.stdout);
  assert.equal(setupPayload.client, "hermes");
  assert.equal(setupPayload.personal_telegram_ready, true);
  assert.ok(setupPayload.hermes_skill_path.endsWith(".hermes/skills/nourish-mcp/SKILL.md"));
  assert.ok(existsSync(setupPayload.hermes_skill_path), "Hermes setup should write the packaged Hermes skill.");
  assert.ok(setupPayload.nourish_wrapper_path.endsWith(".hermes/scripts/nourish-mcp-wrapper.sh"));
  assert.ok(existsSync(setupPayload.nourish_wrapper_path), "Hermes setup should write a wrapper that can source local secrets.");

  const hermesConfig = readFileSync(setupPayload.client_config_path, "utf8");
  assert.match(hermesConfig, /nourish:/);
  assert.match(hermesConfig, /nourish-mcp-wrapper\.sh/);
  assert.match(hermesConfig, /NOURISH_LOCAL_DIR/);
  const wrapper = readFileSync(setupPayload.nourish_wrapper_path, "utf8");
  assert.match(wrapper, /nourish\.env/);
  assert.match(wrapper, new RegExp(pinnedPackage.replace(".", "\\.")));
  assert.match(wrapper, /exec npx -y/);
  assert.match(readFileSync(setupPayload.hermes_skill_path, "utf8"), /mcp_nourish_nourish_connection_status/);
  assert.match(readFileSync(setupPayload.hermes_skill_path, "utf8"), /Telegram Meal Logging/);

  const doctor = spawnSync(process.execPath, [
    "dist/index.js",
    "doctor",
    "--client",
    "hermes",
    "--home-dir",
    dir,
    "--json",
  ], {
    encoding: "utf8",
    env: { ...process.env, HOME: dir },
  });
  assert.equal(doctor.status, 0, doctor.stderr);
  const doctorPayload = JSON.parse(doctor.stdout);
  assert.equal(doctorPayload.client, "hermes");
  assert.equal(doctorPayload.client_checks.hermes.config_exists, true);
  assert.equal(doctorPayload.client_checks.hermes.nourish_server_configured, true);
  assert.equal(doctorPayload.client_checks.hermes.package_pinned, true);
  assert.equal(doctorPayload.client_checks.hermes.skill_installed, true);
  assert.equal(doctorPayload.client_checks.hermes.nourish_local_dir_exists, true);
  assert.ok(doctorPayload.client_checks.hermes.recommendations.some((item) => item.includes("/reload-mcp")));

  mkdirSync(join(mergeDir, ".hermes"), { recursive: true, mode: 0o700 });
  writeFileSync(join(mergeDir, ".hermes", "config.yaml"), [
    "mcp_servers:",
    "  whoop:",
    "    command: npx",
    "    args:",
    "      - -y",
    "      - whoop-mcp-unofficial",
    "",
  ].join("\n"), { mode: 0o600 });
  const mergeSetup = spawnSync(process.execPath, [
    "dist/index.js",
    "setup",
    "--client",
    "hermes",
    "--home-dir",
    mergeDir,
    "--json",
  ], {
    encoding: "utf8",
    env: { ...process.env, HOME: mergeDir },
  });
  assert.equal(mergeSetup.status, 0, mergeSetup.stderr);
  const mergedConfig = readFileSync(join(mergeDir, ".hermes", "config.yaml"), "utf8");
  assert.equal((mergedConfig.match(/^mcp_servers:/gm) ?? []).length, 1, "Hermes setup should merge into an existing mcp_servers block instead of duplicating it.");
  assert.match(mergedConfig, /whoop:/);
  assert.match(mergedConfig, /nourish:/);
  assert.match(mergedConfig, /nourish-mcp-wrapper\.sh/);
} finally {
  rmSync(dir, { recursive: true, force: true });
  rmSync(mergeDir, { recursive: true, force: true });
}

console.log("hermes manifest ok");
