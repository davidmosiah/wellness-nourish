import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { lookupOpenFoodFactsBarcode } from "../providers/open-food-facts.js";
import { searchUsdaFoods } from "../providers/usda.js";
import { NPM_PACKAGE_NAME, SERVER_VERSION } from "../constants.js";
import { runToolCall } from "./tool-calls.js";
import {
  getOnboardingFlow,
  getProfile,
  getProfilePath,
  missingCriticalFields,
} from "../services/profile-store.js";

/**
 * Print a one-time community CTA to stderr (so it doesn't pollute the JSON
 * stdout that agents parse). Suppressed when NOURISH_QUIET=1 or when output
 * is not a TTY (CI / agent stdio).
 */
function printCommunityCTA(): void {
  if (process.env.NOURISH_QUIET === "1") return;
  if (process.env.NOURISH_NO_CTA === "1") return;
  // Skip in non-interactive contexts (agent stdio, CI) so we don't spam logs.
  if (!process.stderr.isTTY) return;
  process.stderr.write(
    `\n✨ wellness-nourish v${SERVER_VERSION} — if this helps your agent, a star ⚭ makes the project visible to other AI builders.\n` +
      `   ⭐  https://github.com/davidmosiah/wellness-nourish\n` +
      `   💬  Issues & ideas: https://github.com/davidmosiah/wellness-nourish/issues\n` +
      `   🐦  Updates:        https://x.com/delx369\n` +
      `   (silence with NOURISH_QUIET=1)\n\n`,
  );
}
import { inspectHermes, setupHermes } from "./hermes.js";
import { buildConnectionStatus } from "../services/connection-status.js";
import { getGoals, updateGoals } from "../services/goals-store.js";
import { buildHydrationSummary, logWater } from "../services/hydration-store.js";
import {
  addIntakeEntry,
  clearIntakeDay,
  deleteIntakeEntry,
  exportIntakeCsvData,
  exportIntakeData,
  listIntakeEntries,
  updateIntakeEntry,
} from "../services/intake-store.js";
import { estimateMeal } from "../services/meal-estimator.js";
import { buildDailySummary, buildWeeklySummary, type DailySummary, type WeeklySummary } from "../services/summary.js";
import type { IntakeEntry, MealType, NourishGoals, NutrientMap } from "../types.js";

const COMMANDS = new Set(["call", 
  "status",
  "doctor",
  "setup",
  "search",
  "barcode",
  "log",
  "list",
  "edit",
  "today",
  "weekly",
  "export",
  "delete",
  "clear-day",
  "goals",
  "water",
  "onboarding",
]);
const MEAL_TYPES: readonly MealType[] = ["breakfast", "lunch", "dinner", "snack", "other"];

type CliOptions = Record<string, string | true>;

interface ParsedArgs {
  options: CliOptions;
  positionals: string[];
}

export function isCliCommand(args: string[]): boolean {
  const command = args[0];
  return command !== undefined && COMMANDS.has(command);
}

export function isUnknownCliCommand(args: string[]): boolean {
  const command = args[0];
  return command !== undefined && !command.startsWith("-") && !COMMANDS.has(command);
}

export async function runCliCommand(args: string[]): Promise<number> {
  const [command, ...rest] = args;

  try {
    switch (command) {
      case "call":
        return runToolCall(rest);
      case "status":
        return printStatus();
      case "doctor":
        return doctorCommand(rest);
      case "setup":
        return setupCommand(rest);
      case "search":
        return await searchCommand(rest);
      case "barcode":
        return await barcodeCommand(rest);
      case "log":
        return await logCommand(rest);
      case "list":
        return await listCommand(rest);
      case "edit":
        return await editCommand(rest);
      case "today":
        return await todayCommand(rest);
      case "weekly":
        return await weeklyCommand(rest);
      case "export":
        return await exportCommand(rest);
      case "delete":
        return await deleteCommand(rest);
      case "clear-day":
        return await clearDayCommand(rest);
      case "goals":
        return await goalsCommand(rest);
      case "water":
        return await waterCommand(rest);
      case "onboarding":
        return await onboardingCommand(rest);
      default:
        console.error("Unknown command");
        return 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}


function safeConnectionStatus(status: ReturnType<typeof buildConnectionStatus>): unknown {
  return {
    ok: status.ok,
    fixture_mode: status.fixture_mode,
    local_storage: status.local_dir ? "configured" : "missing",
    intake_store_exists: status.intake_store_exists,
    usda_provider: status.usda_mode,
    usda_using_demo_key: status.usda_using_demo_key,
    open_food_facts_enabled: status.open_food_facts_enabled,
    cache_ttl_seconds: status.cache_ttl_seconds,
    max_results: status.max_results,
    provider_timeout_ms: status.provider_timeout_ms,
    timezone: status.timezone,
    warnings: status.warnings,
    next_steps: status.next_steps,
  };
}

function printStatus(): number {
  console.log("Nourish MCP");
  console.log(JSON.stringify(safeConnectionStatus(buildConnectionStatus()), null, 2));
  printCommunityCTA();
  return 0;
}

function doctorCommand(args: string[]): number {
  const parsed = parseArgs(args);
  const status = buildConnectionStatus();
  const client = optionString(parsed, "client");
  const hermes = client === "hermes" ? inspectHermes({ homeDir: optionString(parsed, "home-dir") }) : undefined;

  console.log(
    JSON.stringify(
      {
        ok: true,
        ...(client === undefined ? {} : { client }),
        checks: [
          {
            name: "storage",
            ok: true,
            detail: status.local_dir ? "configured" : "missing",
          },
          {
            name: "mcp",
            ok: true,
            detail: "stdio ready; Streamable HTTP available with --http",
          },
          {
            name: "usda",
            ok: true,
            detail: status.usda_mode,
          },
          {
            name: "open_food_facts",
            ok: status.open_food_facts_enabled,
            detail: status.open_food_facts_enabled ? "enabled" : "disabled",
          },
        ],
        status: safeConnectionStatus(status),
        ...(hermes === undefined ? {} : { client_checks: { hermes } }),
      },
      null,
      2,
    ),
  );
  printCommunityCTA();
  return 0;
}

function nourishConfigSnippet() {
  return {
    command: "npx",
    args: ["-y", NPM_PACKAGE_NAME],
    env: {
      FDC_API_KEY: "${FDC_API_KEY}",
      NOURISH_OFF_ENABLED: "1",
      NOURISH_LOCAL_DIR: "~/.wellness-nourish",
    },
  };
}

/**
 * Resolve the on-disk MCP config path for clients that have a well-known
 * location. Returns undefined for clients we only print config for.
 */
function clientConfigPath(client: string, homeDir: string): string | undefined {
  switch (client) {
    case "cursor":
      return join(homeDir, ".cursor", "mcp.json");
    case "windsurf":
      return join(homeDir, ".codeium", "windsurf", "mcp_config.json");
    case "claude":
      return process.platform === "darwin"
        ? join(homeDir, "Library", "Application Support", "Claude", "claude_desktop_config.json")
        : join(homeDir, ".config", "Claude", "claude_desktop_config.json");
    default:
      return undefined;
  }
}

/**
 * Merge the nourish server block into an existing mcpServers config (or create
 * the file), preserving any other servers the user has configured. Written
 * with mode 0600 since MCP configs can reference secret-bearing env.
 */
function writeClientMcpConfig(path: string): { path: string; merged: boolean } {
  mkdirSync(dirname(path), { recursive: true });
  let existing: Record<string, unknown> = {};
  let merged = false;
  if (existsSync(path)) {
    try {
      existing = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
      merged = true;
    } catch {
      existing = {};
    }
  }
  const mcpServers =
    typeof existing.mcpServers === "object" && existing.mcpServers !== null
      ? (existing.mcpServers as Record<string, unknown>)
      : {};
  const next = {
    ...existing,
    mcpServers: {
      ...mcpServers,
      nourish: nourishConfigSnippet(),
    },
  };
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  return { path, merged };
}

function setupCommand(args: string[]): number {
  const parsed = parseArgs(args);
  const client = optionString(parsed, "client") ?? "generic";
  if (client === "hermes") {
    console.log(
      JSON.stringify(
        setupHermes({
          homeDir: optionString(parsed, "home-dir"),
          localDir: optionString(parsed, "local-dir"),
          profile: optionString(parsed, "profile"),
        }),
        null,
        2,
      ),
    );
    return 0;
  }

  const config = { mcpServers: { nourish: nourishConfigSnippet() } };
  const homeDir = optionString(parsed, "home-dir") ?? homedir();
  const noWrite = hasFlag(parsed, "no-write");
  const targetPath = clientConfigPath(client, homeDir);

  let written: { path: string; merged: boolean } | undefined;
  let writeError: string | undefined;
  if (targetPath !== undefined && !noWrite) {
    try {
      written = writeClientMcpConfig(targetPath);
    } catch (error) {
      writeError = error instanceof Error ? error.message : String(error);
    }
  }

  const nextSteps = [
    "Run wellness-nourish doctor.",
    "In agents, call nourish_connection_status before provider-backed tools.",
    "Use preview before write for food logs.",
  ];
  if (written !== undefined) {
    nextSteps.unshift(
      `Restart ${client} (or reload its MCP servers) so it picks up the nourish server.`,
    );
  }

  console.log(
    JSON.stringify(
      {
        client,
        config,
        ...(targetPath === undefined
          ? {}
          : {
              config_path: targetPath,
              config_written: written !== undefined,
              config_merged: written?.merged ?? false,
              ...(writeError === undefined ? {} : { write_error: writeError }),
            }),
        next_steps: nextSteps,
      },
      null,
      2,
    ),
  );
  printCommunityCTA();
  return 0;
}

async function searchCommand(args: string[]): Promise<number> {
  const query = args.join(" ").trim();
  if (query.length === 0) {
    console.error("Usage: nourish-mcp search <query>");
    return 1;
  }

  const result = await searchUsdaFoods(query, 10);
  for (const food of result.foods) {
    const calories = food.nutrients_per_100g.calories_kcal ?? "unknown";
    console.log(`${food.name}\t${food.source}\t${calories} kcal/100g`);
  }

  return 0;
}

async function barcodeCommand(args: string[]): Promise<number> {
  const barcode = args[0];
  if (barcode === undefined || barcode.trim().length === 0) {
    console.error("Usage: nourish-mcp barcode <barcode>");
    return 1;
  }

  const result = await lookupOpenFoodFactsBarcode(barcode);
  console.log(JSON.stringify(result.food, null, 2));
  return 0;
}

async function logCommand(args: string[]): Promise<number> {
  const parsed = parseArgs(args);
  const text = parsed.positionals.join(" ").trim();
  if (text.length === 0) {
    console.error("Usage: nourish-mcp log [--preview] [--meal breakfast] [--timestamp ISO] <text...>");
    return 1;
  }

  const mealType = parseMealType(optionString(parsed, "meal") ?? "other");
  const estimate = await estimateMeal({
    text,
    meal_type: mealType,
    locale: "en-US",
  });
  const entryInput: Parameters<typeof addIntakeEntry>[0] = {
    meal_type: mealType,
    food_ref: {
      source: "estimate",
      source_id: stableEstimateId(text),
      name: text,
    },
    quantity: 1,
    unit: "meal",
    nutrients: estimate.total_nutrients,
    confidence: estimate.confidence,
    source_trace: "estimate",
    tags: [],
    wellness_context_refs: [],
  };
  const timestamp = optionString(parsed, "timestamp") ?? dateToNoonTimestamp(optionString(parsed, "date"));
  const notes = optionString(parsed, "notes");
  const gramsEstimate = sumGrams(estimate.items);

  if (timestamp !== undefined) {
    entryInput.timestamp = timestamp;
  }
  if (notes !== undefined) {
    entryInput.notes = notes;
  }
  if (gramsEstimate !== undefined) {
    entryInput.grams_estimate = gramsEstimate;
  }

  if (hasFlag(parsed, "preview")) {
    console.log(
      JSON.stringify(
        {
          would_write: false,
          estimate,
          entry_preview: entryInput,
        },
        null,
        2,
      ),
    );
    return 0;
  }

  const entry: IntakeEntry = await addIntakeEntry(entryInput);

  console.log(JSON.stringify(entry, null, 2));
  return 0;
}

async function listCommand(args: string[]): Promise<number> {
  const parsed = parseArgs(args);
  const date = optionString(parsed, "date") ?? parsed.positionals[0];
  const entries = await listIntakeEntries(date === undefined ? {} : { date });

  console.log(JSON.stringify({ entries }, null, 2));
  return 0;
}

async function editCommand(args: string[]): Promise<number> {
  const parsed = parseArgs(args);
  const id = optionString(parsed, "entry") ?? parsed.positionals[0];
  if (id === undefined) {
    console.error("Usage: nourish-mcp edit --entry <id> [--meal snack] [--quantity 2] [--notes text]");
    return 1;
  }

  const patch: Parameters<typeof updateIntakeEntry>[1] = {};
  const meal = optionString(parsed, "meal");
  const quantity = optionString(parsed, "quantity");
  const unit = optionString(parsed, "unit");
  const timestamp = optionString(parsed, "timestamp");
  const notes = optionString(parsed, "notes");

  if (meal !== undefined) {
    patch.meal_type = parseMealType(meal);
  }
  if (quantity !== undefined) {
    patch.quantity = parsePositiveNumber(quantity, "quantity");
  }
  if (unit !== undefined) {
    patch.unit = unit;
  }
  if (timestamp !== undefined) {
    patch.timestamp = timestamp;
  }
  if (notes !== undefined) {
    patch.notes = notes;
  }

  console.log(JSON.stringify(await updateIntakeEntry(id, patch), null, 2));
  return 0;
}

async function todayCommand(args: string[]): Promise<number> {
  const parsed = parseArgs(args);
  const summary = await buildDailySummary(optionString(parsed, "date"));

  printSummary(summary, optionString(parsed, "format"));
  return 0;
}

async function weeklyCommand(args: string[]): Promise<number> {
  const parsed = parseArgs(args);
  const summary = await buildWeeklySummary(optionString(parsed, "start-date"));

  printWeeklySummary(summary, optionString(parsed, "format"));
  return 0;
}

async function exportCommand(args: string[]): Promise<number> {
  const parsed = parseArgs(args);
  const format = optionString(parsed, "format") ?? "jsonl";

  if (format === "csv") {
    process.stdout.write(await exportIntakeCsvData());
    return 0;
  }
  if (format !== "jsonl") {
    throw new Error("export --format must be jsonl or csv.");
  }

  process.stdout.write(await exportIntakeData());
  return 0;
}

async function deleteCommand(args: string[]): Promise<number> {
  const id = parseDeleteId(args);
  if (id === undefined) {
    console.error("Usage: nourish-mcp delete --entry <id>");
    return 1;
  }

  const deleted = await deleteIntakeEntry(id);
  console.log(JSON.stringify({ deleted, id }, null, 2));
  return 0;
}

async function clearDayCommand(args: string[]): Promise<number> {
  const parsed = parseArgs(args);
  const date = optionString(parsed, "date") ?? parsed.positionals[0];
  if (date === undefined || !hasFlag(parsed, "yes")) {
    console.error("Usage: nourish-mcp clear-day <YYYY-MM-DD> --yes");
    return 1;
  }

  console.log(JSON.stringify(await clearIntakeDay(date), null, 2));
  return 0;
}

async function goalsCommand(args: string[]): Promise<number> {
  const parsed = parseArgs(args);
  const daily: NutrientMap = {};
  const calories = optionString(parsed, "set-calories");
  const protein = optionString(parsed, "set-protein");
  const carbs = optionString(parsed, "set-carbs");
  const fat = optionString(parsed, "set-fat");
  const water = optionString(parsed, "set-water");

  if (calories !== undefined) {
    daily.calories_kcal = parsePositiveNumber(calories, "set-calories");
  }
  if (protein !== undefined) {
    daily.protein_g = parsePositiveNumber(protein, "set-protein");
  }
  if (carbs !== undefined) {
    daily.carbohydrates_g = parsePositiveNumber(carbs, "set-carbs");
  }
  if (fat !== undefined) {
    daily.fat_g = parsePositiveNumber(fat, "set-fat");
  }

  if (Object.keys(daily).length === 0 && water === undefined) {
    console.log(JSON.stringify(await getGoals(), null, 2));
    return 0;
  }

  const input: Parameters<typeof updateGoals>[0] = {};
  if (Object.keys(daily).length > 0) {
    input.daily = daily;
  }
  if (water !== undefined) {
    input.hydration_ml = parsePositiveNumber(water, "set-water");
  }

  console.log(JSON.stringify(await updateGoals(input), null, 2));
  return 0;
}

async function onboardingCommand(args: string[]): Promise<number> {
  const parsed = parseArgs(args);
  const localeArg = optionString(parsed, "locale") ?? parsed.positionals[0];
  const locale = localeArg === "pt-BR" ? "pt-BR" : "en";
  const flow = getOnboardingFlow(locale);
  const profile = await getProfile();
  const missing = missingCriticalFields(profile);
  console.log(
    JSON.stringify(
      {
        ...flow,
        current_profile: profile,
        missing_critical: missing,
      },
      null,
      2,
    ),
  );
  if (process.stderr.isTTY && process.env.NOURISH_QUIET !== "1" && process.env.NOURISH_NO_CTA !== "1") {
    process.stderr.write(
      `\n## Delx Wellness shared onboarding (${locale})\n` +
        `\nThe agent will ask these 11 questions next so wellness-nourish (and the rest of\n` +
        `the wellness stack) can personalize responses — non-secret data only, stored at\n` +
        `${getProfilePath()}.\n\n` +
        flow.questions
          .map((q, i) => `${i + 1}. (${q.required ? "required" : "optional"}) ${q.prompt}`)
          .join("\n") +
        `\n\nPrivacy: ${flow.privacy_note}\n\n`,
    );
  }
  return 0;
}

async function waterCommand(args: string[]): Promise<number> {
  const parsed = parseArgs(args);
  const action = parsed.positionals[0];
  const date = optionString(parsed, "date");

  if (action === "today") {
    console.log(JSON.stringify(await buildHydrationSummary(date), null, 2));
    return 0;
  }

  const amount = action === undefined ? undefined : Number.parseFloat(action);
  if (amount === undefined || !Number.isFinite(amount) || amount <= 0) {
    console.error("Usage: nourish-mcp water <amount_ml> [--date YYYY-MM-DD]");
    return 1;
  }

  const waterInput: Parameters<typeof logWater>[0] = {
    amount_ml: amount,
    source: "manual",
  };
  const timestamp = optionString(parsed, "timestamp") ?? dateToNoonTimestamp(date);
  const notes = optionString(parsed, "notes");
  if (timestamp !== undefined) {
    waterInput.timestamp = timestamp;
  }
  if (notes !== undefined) {
    waterInput.notes = notes;
  }

  console.log(JSON.stringify(await logWater(waterInput), null, 2));
  return 0;
}

function parseDeleteId(args: string[]): string | undefined {
  if (args[0] === "--entry") {
    return args[1];
  }

  return args[0];
}

function printSummary(summary: DailySummary, format: string | undefined): void {
  if (format === "markdown") {
    console.log(dailySummaryMarkdown(summary));
    return;
  }

  console.log(JSON.stringify(summary, null, 2));
}

function printWeeklySummary(summary: WeeklySummary, format: string | undefined): void {
  if (format === "markdown") {
    console.log(weeklySummaryMarkdown(summary));
    return;
  }

  console.log(JSON.stringify(summary, null, 2));
}

function dailySummaryMarkdown(summary: DailySummary): string {
  return [
    "# Nourish Daily Summary",
    "",
    `- date: ${summary.date}`,
    `- entries: ${summary.entry_count}`,
    `- calories_kcal: ${summary.total_nutrients.calories_kcal ?? 0}`,
    `- protein_g: ${summary.total_nutrients.protein_g ?? 0}`,
    `- hydration_ml: ${summary.hydration.total_ml}`,
    `- confidence: ${summary.confidence}`,
    "",
    "| meal | calories_kcal | protein_g |",
    "| --- | --- | --- |",
    ...MEAL_TYPES.map(
      (mealType) =>
        `| ${mealType} | ${summary.by_meal[mealType].calories_kcal ?? 0} | ${summary.by_meal[mealType].protein_g ?? 0} |`,
    ),
  ].join("\n");
}

function weeklySummaryMarkdown(summary: WeeklySummary): string {
  return [
    "# Nourish Weekly Summary",
    "",
    `- start_date: ${summary.start_date}`,
    `- end_date: ${summary.end_date}`,
    `- entries: ${summary.entry_count}`,
    `- calories_kcal: ${summary.total_nutrients.calories_kcal ?? 0}`,
    "",
    "| date | entries | calories_kcal | hydration_ml |",
    "| --- | --- | --- | --- |",
    ...summary.days.map(
      (day) =>
        `| ${day.date} | ${day.entry_count} | ${day.total_nutrients.calories_kcal ?? 0} | ${day.hydration.total_ml} |`,
    ),
  ].join("\n");
}

// Flags that never take a value. Without this, a greedy parser treats the
// next token as their value, so `log --preview "2 eggs"` would consume the
// meal text as the value of --preview and leave no positionals. Keeping these
// boolean lets the documented `log --preview "<text>"` form work.
const BOOLEAN_FLAGS = new Set(["preview", "yes", "no-write"]);

function parseArgs(args: string[]): ParsedArgs {
  const options: CliOptions = {};
  const positionals: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) {
      continue;
    }

    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }

    const key = arg.slice(2);
    const next = args[index + 1];
    if (!BOOLEAN_FLAGS.has(key) && next !== undefined && !next.startsWith("--")) {
      options[key] = next;
      index += 1;
    } else {
      options[key] = true;
    }
  }

  return { options, positionals };
}

function optionString(parsed: ParsedArgs, key: string): string | undefined {
  const value = parsed.options[key];
  return typeof value === "string" ? value : undefined;
}

function hasFlag(parsed: ParsedArgs, key: string): boolean {
  return parsed.options[key] === true;
}

function parseMealType(value: string): MealType {
  if ((MEAL_TYPES as readonly string[]).includes(value)) {
    return value as MealType;
  }

  throw new Error(`Invalid meal type: ${value}`);
}

function parsePositiveNumber(value: string, label: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }

  return parsed;
}

// Replaced UTC noon (`${date}T12:00:00.000Z`) with the timezone-aware helper
// from services/local-date.ts. The legacy form put logs into the wrong day
// for any user not on UTC.
import { dateToNoonTimestamp as dateToNoonTimestampLocal } from "../services/local-date.js";
function dateToNoonTimestamp(date: string | undefined): string | undefined {
  return dateToNoonTimestampLocal(date);
}

function sumGrams(items: Array<{ grams: number }>): number | undefined {
  if (items.length === 0) {
    return undefined;
  }

  return items.reduce((total, item) => total + item.grams, 0);
}

function stableEstimateId(text: string): string {
  return `estimate:${Buffer.from(text).toString("base64url").slice(0, 48)}`;
}
