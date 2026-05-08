import type { IntakeEntry, MealType, NutrientMap } from "../types.js";
import { getGoals } from "./goals-store.js";
import { buildHydrationSummary } from "./hydration-store.js";
import { listIntakeEntries } from "./intake-store.js";
import { localDate } from "./local-date.js";
import { addNutrients, roundNutrient } from "./nutrients.js";

const MEAL_TYPES: readonly MealType[] = ["breakfast", "lunch", "dinner", "snack", "other"];

type ByMealSummary = Record<MealType, NutrientMap>;

export interface DailySummary {
  date: string;
  entry_count: number;
  total_nutrients: NutrientMap;
  by_meal: ByMealSummary;
  hydration: Awaited<ReturnType<typeof buildHydrationSummary>>;
  goal_progress: Record<string, GoalProgressEntry>;
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

interface GoalProgressEntry {
  actual: number;
  goal: number;
  percent: number;
}

export async function buildDailySummary(date = todayDate()): Promise<DailySummary> {
  const entries = await listIntakeEntries({ date });
  const byMeal = emptyByMeal();
  const totalNutrients = addNutrients(entries.map((entry) => entry.nutrients));
  const hydration = await buildHydrationSummary(date);
  const goals = await getGoals();

  for (const mealType of MEAL_TYPES) {
    byMeal[mealType] = addNutrients(
      entries.filter((entry) => entry.meal_type === mealType).map((entry) => entry.nutrients),
    );
  }

  return {
    date,
    entry_count: entries.length,
    total_nutrients: totalNutrients,
    by_meal: byMeal,
    hydration,
    goal_progress: buildGoalProgress(totalNutrients, hydration.total_ml, goals.daily, goals.hydration_ml),
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

function buildGoalProgress(
  nutrients: NutrientMap,
  hydrationMl: number,
  nutrientGoals: NutrientMap,
  hydrationGoalMl: number | undefined,
): Record<string, GoalProgressEntry> {
  const progress: Record<string, GoalProgressEntry> = {};

  for (const key of Object.keys(nutrientGoals) as Array<keyof NutrientMap>) {
    const goal = nutrientGoals[key];
    if (goal === undefined || goal <= 0) {
      continue;
    }

    const actual = nutrients[key] ?? 0;
    progress[key] = {
      actual,
      goal,
      percent: roundNutrient((actual / goal) * 100),
    };
  }

  if (hydrationGoalMl !== undefined && hydrationGoalMl > 0) {
    progress.hydration_ml = {
      actual: hydrationMl,
      goal: hydrationGoalMl,
      percent: roundNutrient((hydrationMl / hydrationGoalMl) * 100),
    };
  }

  return progress;
}

// Was UTC — silently bucketed late-evening logs into "tomorrow" for any user
// east of UTC. Now timezone-aware via services/local-date.ts.
function todayDate(): string {
  return localDate();
}

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}
