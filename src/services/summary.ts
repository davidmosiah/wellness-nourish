import type { IntakeEntry, MealType, NutrientMap } from "../types.js";
import { listIntakeEntries } from "./intake-store.js";
import { addNutrients, roundNutrient } from "./nutrients.js";

const MEAL_TYPES: readonly MealType[] = ["breakfast", "lunch", "dinner", "snack", "other"];

type ByMealSummary = Record<MealType, NutrientMap>;

export interface DailySummary {
  date: string;
  entry_count: number;
  total_nutrients: NutrientMap;
  by_meal: ByMealSummary;
  confidence: number;
  source_coverage: string[];
}

export interface WeeklySummary {
  start_date: string;
  end_date: string;
  days: DailySummary[];
  entry_count: number;
  total_nutrients: NutrientMap;
}

export async function buildDailySummary(date = todayDate()): Promise<DailySummary> {
  const entries = await listIntakeEntries({ date });
  const byMeal = emptyByMeal();

  for (const mealType of MEAL_TYPES) {
    byMeal[mealType] = addNutrients(
      entries.filter((entry) => entry.meal_type === mealType).map((entry) => entry.nutrients),
    );
  }

  return {
    date,
    entry_count: entries.length,
    total_nutrients: addNutrients(entries.map((entry) => entry.nutrients)),
    by_meal: byMeal,
    confidence: averageConfidence(entries),
    source_coverage: [...new Set(entries.map((entry) => entry.source_trace))],
  };
}

export async function buildWeeklySummary(startDate = todayDate()): Promise<WeeklySummary> {
  const dates = [...Array(7)].map((_, index) => addDays(startDate, index));
  const days = await Promise.all(dates.map((date) => buildDailySummary(date)));

  return {
    start_date: dates[0] ?? startDate,
    end_date: dates[6] ?? startDate,
    days,
    entry_count: days.reduce((total, day) => total + day.entry_count, 0),
    total_nutrients: addNutrients(days.map((day) => day.total_nutrients)),
  };
}

function emptyByMeal(): ByMealSummary {
  return {
    breakfast: {},
    lunch: {},
    dinner: {},
    snack: {},
    other: {},
  };
}

function averageConfidence(entries: IntakeEntry[]): number {
  if (entries.length === 0) {
    return 0;
  }

  const total = entries.reduce((sum, entry) => sum + entry.confidence, 0);
  return roundNutrient(total / entries.length);
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}
