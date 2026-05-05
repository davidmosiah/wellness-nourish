import { lookupOpenFoodFactsBarcode } from "../providers/open-food-facts.js";
import { searchUsdaFoods } from "../providers/usda.js";
import { buildConnectionStatus } from "../services/connection-status.js";
import { addIntakeEntry, deleteIntakeEntry, exportIntakeData } from "../services/intake-store.js";
import { estimateMeal } from "../services/meal-estimator.js";
import { buildDailySummary } from "../services/summary.js";
import type { IntakeEntry } from "../types.js";

const COMMANDS = new Set(["status", "search", "barcode", "log", "today", "export", "delete", "setup"]);

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
      case "setup":
        return printStatus();
      case "search":
        return await searchCommand(rest);
      case "barcode":
        return await barcodeCommand(rest);
      case "log":
        return await logCommand(rest);
      case "today":
        return await todayCommand();
      case "export":
        return await exportCommand();
      case "delete":
        return await deleteCommand(rest);
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
  const text = args.join(" ").trim();
  if (text.length === 0) {
    console.error("Usage: nourish-mcp log <text...>");
    return 1;
  }

  const estimate = await estimateMeal({
    text,
    meal_type: "other",
    locale: "en-US",
  });
  const entryInput: Parameters<typeof addIntakeEntry>[0] = {
    meal_type: "other",
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
  const gramsEstimate = sumGrams(estimate.items);
  if (gramsEstimate !== undefined) {
    entryInput.grams_estimate = gramsEstimate;
  }
  const entry: IntakeEntry = await addIntakeEntry(entryInput);

  console.log(JSON.stringify(entry, null, 2));
  return 0;
}

async function todayCommand(): Promise<number> {
  console.log(JSON.stringify(await buildDailySummary(), null, 2));
  return 0;
}

async function exportCommand(): Promise<number> {
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

function parseDeleteId(args: string[]): string | undefined {
  if (args[0] === "--entry") {
    return args[1];
  }

  return args[0];
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
