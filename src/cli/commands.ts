import { lookupOpenFoodFactsBarcode } from "../providers/open-food-facts.js";
import { searchUsdaFoods } from "../providers/usda.js";
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

const COMMANDS = new Set([
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
      case "status":
        return printStatus();
      case "doctor":
        return doctorCommand();
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
      default:
        console.error("Unknown command");
        return 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

function printStatus(): number {
  console.log("Nourish MCP");
  console.log(JSON.stringify(buildConnectionStatus(), null, 2));
  return 0;
}

function doctorCommand(): number {
  const status = buildConnectionStatus();
  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: [
          {
            name: "storage",
            ok: true,
            detail: status.local_dir,
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
        status,
      },
      null,
      2,
    ),
  );
  return 0;
}

function setupCommand(args: string[]): number {
  const parsed = parseArgs(args);
  const client = optionString(parsed, "client") ?? "generic";
  const config = {
    mcpServers: {
      nourish: {
        command: "npx",
        args: ["-y", "wellness-nourish"],
        env: {
          FDC_API_KEY: "${FDC_API_KEY}",
          NOURISH_OFF_ENABLED: "1",
          NOURISH_LOCAL_DIR: "~/.wellness-nourish",
        },
      },
    },
  };

  console.log(
    JSON.stringify(
      {
        client,
        config,
        next_steps: [
          "Run nourish-mcp doctor.",
          "In agents, call nourish_connection_status before provider-backed tools.",
          "Use preview before write for food logs.",
        ],
      },
      null,
      2,
    ),
  );
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
    if (next !== undefined && !next.startsWith("--")) {
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

function dateToNoonTimestamp(date: string | undefined): string | undefined {
  return date === undefined ? undefined : `${date}T12:00:00.000Z`;
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
