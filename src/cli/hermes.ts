/// <reference types="node" />

import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { NPM_PACKAGE_NAME, PINNED_NPM_PACKAGE } from "../constants.js";

export interface HermesSetupOptions {
  homeDir?: string | undefined;
  localDir?: string | undefined;
  profile?: string | undefined;
}

export interface HermesSetupResult {
  ok: true;
  client: "hermes";
  client_config_path: string;
  hermes_skill_path: string;
  nourish_wrapper_path: string;
  hermes_config_backup_path?: string;
  nourish_local_dir: string;
  personal_telegram_ready: true;
  warnings: string[];
  next_steps: string[];
}

export interface HermesDoctorCheck {
  config_exists: boolean;
  nourish_server_configured: boolean;
  package_pinned: boolean;
  skill_installed: boolean;
  nourish_local_dir?: string;
  nourish_local_dir_exists: boolean;
  recommendations: string[];
}

export function setupHermes(options: HermesSetupOptions = {}): HermesSetupResult {
  const homeDir = expandHome(options.homeDir ?? homedir());
  const profile = normalizeProfile(options.profile ?? "personal");
  const localDir = expandHome(options.localDir ?? join(homeDir, ".hermes", "nourish", profile));
  const configPath = join(homeDir, ".hermes", "config.yaml");
  const skillPath = join(homeDir, ".hermes", "skills", "nourish-mcp", "SKILL.md");
  const wrapperPath = join(homeDir, ".hermes", "scripts", "nourish-mcp-wrapper.sh");

  mkdirSync(localDir, { recursive: true, mode: 0o700 });
  chmodSync(localDir, 0o700);
  mkdirSync(dirname(configPath), { recursive: true, mode: 0o700 });
  mkdirSync(dirname(skillPath), { recursive: true, mode: 0o700 });
  mkdirSync(dirname(wrapperPath), { recursive: true, mode: 0o700 });

  writeFileSync(wrapperPath, `${nourishWrapperScript()}\n`, { mode: 0o700 });
  chmodSync(wrapperPath, 0o700);
  const backupPath = mergeHermesConfig(configPath, localDir, wrapperPath);
  writeFileSync(skillPath, `${hermesSkillMarkdown(localDir)}\n`, { mode: 0o600 });
  chmodSync(skillPath, 0o600);

  const warnings = [
    "After editing Hermes MCP config, use `/reload-mcp` or `hermes mcp test nourish`; do not restart the Hermes gateway for normal Nourish data access.",
    `Hermes config pins ${PINNED_NPM_PACKAGE} to avoid stale npx cache behavior.`,
    "Hermes runs Nourish through a wrapper that sources ~/.hermes/secrets/nourish.env when present, without printing secrets.",
    "Food logs are personal data; keep NOURISH_LOCAL_DIR scoped to the intended Telegram user/profile.",
  ];

  return {
    ok: true,
    client: "hermes",
    client_config_path: configPath,
    hermes_skill_path: skillPath,
    nourish_wrapper_path: wrapperPath,
    ...(backupPath === undefined ? {} : { hermes_config_backup_path: backupPath }),
    nourish_local_dir: localDir,
    personal_telegram_ready: true,
    warnings,
    next_steps: [
      "Run `wellness-nourish doctor --client hermes --json`.",
      "Reload Hermes MCP with `/reload-mcp` or `hermes mcp test nourish`.",
      "From Telegram, ask Hermes to call `nourish_connection_status`, then preview and log a small meal.",
    ],
  };
}

export function inspectHermes(options: HermesSetupOptions = {}): HermesDoctorCheck {
  const homeDir = expandHome(options.homeDir ?? homedir());
  const configPath = join(homeDir, ".hermes", "config.yaml");
  const skillPath = join(homeDir, ".hermes", "skills", "nourish-mcp", "SKILL.md");
  const configExists = existsSync(configPath);
  const config = configExists ? readFileSync(configPath, "utf8") : "";
  const wrapperPath = join(homeDir, ".hermes", "scripts", "nourish-mcp-wrapper.sh");
  const wrapper = existsSync(wrapperPath) ? readFileSync(wrapperPath, "utf8") : "";
  const localDir = parseNourishLocalDir(config);
  const skillInstalled = existsSync(skillPath);

  const check: Omit<HermesDoctorCheck, "recommendations"> = {
    config_exists: configExists,
    nourish_server_configured:
      /^\s*nourish\s*:/m.test(config) && (/wellness-nourish/.test(config) || /nourish-mcp-wrapper\.sh/.test(config)),
    package_pinned: config.includes(PINNED_NPM_PACKAGE) || wrapper.includes(PINNED_NPM_PACKAGE),
    skill_installed: skillInstalled,
    ...(localDir === undefined ? {} : { nourish_local_dir: localDir }),
    nourish_local_dir_exists: localDir === undefined ? false : existsSync(expandHome(localDir)),
  };

  return {
    ...check,
    recommendations: buildHermesRecommendations(check),
  };
}

export function hermesSkillMarkdown(localDir = "~/.wellness-nourish"): string {
  return [
    "# Nourish MCP",
    "",
    "Use this skill whenever a user asks Hermes, including through Telegram, to search foods, estimate meals, log intake, log water, manage nutrition goals, or summarize nutrition through the Nourish MCP.",
    "",
    "## Runtime Contract",
    "",
    "- Prefer direct MCP tools exposed by Hermes.",
    "- Start nutrition tasks with `mcp_nourish_nourish_connection_status` unless the user only asks for installation help.",
    "- Use `mcp_nourish_nourish_capabilities` or `mcp_nourish_nourish_agent_manifest` when you need the machine-readable workflow contract.",
    "- Do not use terminal, Python, curl or npm as a workaround for normal nutrition data access when MCP tools are available.",
    "- After editing `/root/.hermes/config.yaml` or `~/.hermes/config.yaml`, reload MCP with `/reload-mcp` or `hermes mcp test nourish`.",
    "- Do not restart the Hermes gateway for normal Nourish MCP config/data access. Restart only when Hermes itself is unhealthy.",
    "- Never ask the user to paste provider API keys, tokens, raw health exports or private food logs into Telegram.",
    "- Food logs, hydration and goals are personal data. Treat the configured local store as sensitive.",
    "- Nutrition estimates are approximate context, not medical advice, diagnosis or treatment.",
    "",
    "## Telegram Meal Logging",
    "",
    "- If the user says `registra`, `anota`, `log`, `salva`, or otherwise clearly asks to save a meal, call `mcp_nourish_nourish_log_intake` with `explicit_user_intent: true`.",
    "- If the user only says what they ate, first call `mcp_nourish_nourish_estimate_meal`, return a compact preview with calories, protein, confidence and warnings, then ask whether to save it.",
    "- If the user sends a barcode photo and Hermes has an image path, base64 image, or data URI, call `mcp_nourish_nourish_lookup_barcode_image`; if only visible digits are available, call `mcp_nourish_nourish_lookup_barcode`.",
    "- If a food image could be a barcode, nutrition label, or meal photo, call `mcp_nourish_nourish_analyze_food_image` with the visual/OCR observations and follow its route.",
    "- If the user sends a meal photo, describe the visible food and portions as `detected_items`, call `mcp_nourish_nourish_estimate_meal_photo`, then ask the user to confirm portions before logging.",
    "- If the user asks what to eat next, call `mcp_nourish_nourish_daily_coach` or `mcp_nourish_nourish_suggest_next_meal`, passing WHOOP/Garmin/Oura/Eight Sleep context if already available.",
    "- If the user asks Hermes to remember a recurring meal, call `mcp_nourish_nourish_remember_meal` with `explicit_user_intent: true`.",
    "- For Portuguese/Brazilian meals, preserve explicit quantities such as `200g arroz`, `120g feijão`, `150g frango`, call estimate with `locale: pt-BR`, and ask one concise clarification only for unresolved foods.",
    "- If a tool returns `USER_ACTION_REQUIRED`, treat it as a normal confirmation guard, not as a server outage.",
    "- Preserve uncertainty. Include confidence and unresolved items instead of pretending estimates are exact.",
    "- Use `response_format: markdown` for Telegram-facing summaries when available.",
    "",
    "## First Calls",
    "",
    "1. `mcp_nourish_nourish_connection_status`",
    "2. `mcp_nourish_nourish_capabilities`",
    "3. `mcp_nourish_nourish_estimate_meal` for natural-language meals",
    "4. `mcp_nourish_nourish_lookup_barcode_image` for barcode photos",
    "5. `mcp_nourish_nourish_estimate_meal_photo` for meal photo previews",
    "6. `mcp_nourish_nourish_analyze_food_image` for mixed image routing",
    "7. `mcp_nourish_nourish_daily_coach` for what-to-eat-next questions",
    "8. `mcp_nourish_nourish_log_intake` only after explicit save intent",
    "9. `mcp_nourish_nourish_daily_summary` for today's Telegram summary",
    "",
    "## Personal Store",
    "",
    `Configured local store: \`${localDir}\`.`,
  ].join("\n");
}

function mergeHermesConfig(configPath: string, localDir: string, wrapperPath: string): string | undefined {
  const snippet = `mcp_servers:\n${nourishServerBlock(localDir, wrapperPath)}\n`;
  if (!existsSync(configPath)) {
    writeFileSync(configPath, ensureReloadHint(snippet), { mode: 0o600 });
    chmodSync(configPath, 0o600);
    return undefined;
  }

  const backupPath = backupConfig(configPath);
  const existing = readFileSync(configPath, "utf8");
  const next = existing.trimEnd().length ? upsertNourishBlock(existing, localDir, wrapperPath) : snippet;

  writeFileSync(configPath, ensureReloadHint(next), { mode: 0o600 });
  chmodSync(configPath, 0o600);
  return backupPath;
}

function upsertNourishBlock(existing: string, localDir: string, wrapperPath: string): string {
  const lines = existing.trimEnd().split("\n");
  const block = nourishServerBlock(localDir, wrapperPath).split("\n");
  const mcpIndex = lines.findIndex((line) => /^mcp_servers:\s*$/.test(line));

  if (mcpIndex === -1) {
    return `${lines.join("\n")}\n\n# Added by ${NPM_PACKAGE_NAME} setup.\nmcp_servers:\n${block.join("\n")}\n`;
  }

  const start = lines.findIndex((line, index) => index > mcpIndex && /^  nourish:\s*$/.test(line));
  if (start === -1) {
    lines.splice(mcpIndex + 1, 0, ...block);
    return `${lines.join("\n")}\n`;
  }

  let end = start + 1;
  while (end < lines.length) {
    const line = lines[end] ?? "";
    if (/^  [A-Za-z0-9_-]+:\s*$/.test(line) || /^[A-Za-z0-9_-]+:\s*$/.test(line)) {
      break;
    }
    end += 1;
  }

  lines.splice(start, end - start, ...block);
  return `${lines.join("\n")}\n`;
}

function nourishServerBlock(localDir: string, wrapperPath: string): string {
  return [
    "  nourish:",
    `    command: ${wrapperPath}`,
    "    env:",
    `      NOURISH_LOCAL_DIR: ${localDir}`,
    '      NOURISH_OFF_ENABLED: "1"',
  ].join("\n");
}

function nourishWrapperScript(): string {
  return [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    'SECRET_FILE="${NOURISH_ENV_FILE:-${HERMES_HOME:-$HOME/.hermes}/secrets/nourish.env}"',
    'if [ -f "$SECRET_FILE" ]; then',
    "  set -a",
    '  . "$SECRET_FILE"',
    "  set +a",
    "fi",
    'export NOURISH_OFF_ENABLED="${NOURISH_OFF_ENABLED:-1}"',
    `exec npx -y ${PINNED_NPM_PACKAGE} "$@"`,
  ].join("\n");
}

function backupConfig(path: string): string {
  const backupPath = `${path}.bak-nourish-mcp-${new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z")}`;
  renameSync(path, backupPath);
  chmodSync(backupPath, 0o600);
  writeFileSync(path, readFileSync(backupPath, "utf8"), { mode: 0o600 });
  chmodSync(path, 0o600);
  return backupPath;
}

function ensureReloadHint(text: string): string {
  if (/mcp_reload_confirm\s*:\s*false/.test(text)) {
    return text.endsWith("\n") ? text : `${text}\n`;
  }

  if (/^approvals:\s*$/m.test(text)) {
    return `${text.trimEnd()}\n  mcp_reload_confirm: false\n`;
  }

  return `${text.trimEnd()}\n\napprovals:\n  mcp_reload_confirm: false\n`;
}

function buildHermesRecommendations(check: Omit<HermesDoctorCheck, "recommendations">): string[] {
  const recommendations: string[] = [];

  if (!check.config_exists || !check.nourish_server_configured) {
    recommendations.push("Run `wellness-nourish setup --client hermes --profile personal` to create a Hermes MCP config and local Hermes skill.");
  }
  if (check.nourish_server_configured && !check.package_pinned) {
    recommendations.push(`Pin the Hermes MCP command to \`${PINNED_NPM_PACKAGE}\` to avoid stale npx cache behavior.`);
  }
  if (!check.skill_installed) {
    recommendations.push("Install the Hermes skill at `~/.hermes/skills/nourish-mcp/SKILL.md` so Telegram flows use preview-before-write.");
  }
  if (check.nourish_local_dir !== undefined && !check.nourish_local_dir_exists) {
    recommendations.push(`Create the configured Nourish local store directory: \`${check.nourish_local_dir}\`.`);
  }

  recommendations.push("After config changes, use `/reload-mcp` or `hermes mcp test nourish`; do not restart the Hermes gateway for normal Nourish data access.");
  recommendations.push("For Telegram, preview estimates first and only log intake after explicit save intent.");
  return recommendations;
}

function parseNourishLocalDir(config: string): string | undefined {
  const lines = config.split("\n");
  const nourishIndex = lines.findIndex((line) => /^  nourish:\s*$/.test(line));
  if (nourishIndex === -1) {
    return undefined;
  }

  for (let index = nourishIndex + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (/^  [A-Za-z0-9_-]+:\s*$/.test(line) || /^[A-Za-z0-9_-]+:\s*$/.test(line)) {
      return undefined;
    }
    const match = line.match(/^\s+NOURISH_LOCAL_DIR:\s*(.+?)\s*$/);
    if (match?.[1]) {
      return unquoteYamlScalar(match[1]);
    }
  }

  return undefined;
}

function unquoteYamlScalar(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function expandHome(path: string): string {
  if (path === "~") {
    return homedir();
  }

  if (path.startsWith("~/")) {
    return join(homedir(), path.slice(2));
  }

  return path;
}

function normalizeProfile(profile: string): string {
  return profile.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "personal";
}
