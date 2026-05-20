import { getGoals } from "./goals-store.js";
import { buildHydrationSummary } from "./hydration-store.js";
import { listIntakeEntries } from "./intake-store.js";
import { localDate } from "./local-date.js";
import { addNutrients, roundNutrient } from "./nutrients.js";
import { getProfile } from "./profile-store.js";
import type { NutrientMap } from "../types.js";

export type GoalProgressPeriod = "today" | "yesterday" | "last_7_days" | "last_30_days";

interface MacroProgress {
  consumed: number;
  goal: number;
  pct: number;
  delta_to_goal: number;
}

export interface PerDayProgress {
  date: string;
  kcal: MacroProgress;
  protein_g: MacroProgress;
  carb_g: MacroProgress;
  fat_g: MacroProgress;
  water_ml: MacroProgress;
  on_target: boolean;
  entry_count: number;
}

export interface GoalProgressReport {
  period: GoalProgressPeriod;
  window: { start: string; end: string };
  days: PerDayProgress[];
  totals: {
    kcal_consumed: number;
    protein_g_consumed: number;
    carb_g_consumed: number;
    fat_g_consumed: number;
    water_ml_consumed: number;
  };
  averages?: {
    kcal_per_day: number;
    protein_g_per_day: number;
    carb_g_per_day: number;
    fat_g_per_day: number;
    water_ml_per_day: number;
  } | undefined;
  goals_snapshot: {
    kcal: number;
    protein_g: number;
    carb_g: number;
    fat_g: number;
    water_ml: number;
  };
  days_on_target: number;
  days_with_data: number;
  recommendations: string[];
  locale: "en" | "pt-BR";
  notes: string[];
}

const TOLERANCE = 0.10;

export async function buildGoalProgress(period: GoalProgressPeriod = "today"): Promise<GoalProgressReport> {
  const today = localDate();
  const window = resolveWindow(period, today);
  const dates = enumerateDates(window.start, window.end);

  const goals = await getGoals();
  const profile = await getProfile();
  const locale = (profile.profile?.language === "pt-BR" ? "pt-BR" : "en") as "en" | "pt-BR";

  const goalSnapshot = {
    kcal: pickGoal(goals.daily?.calories_kcal),
    protein_g: pickGoal(goals.daily?.protein_g),
    carb_g: pickGoal(goals.daily?.carbohydrates_g),
    fat_g: pickGoal(goals.daily?.fat_g),
    water_ml: pickGoal(goals.hydration_ml),
  };

  const days: PerDayProgress[] = [];
  for (const date of dates) {
    const entries = await listIntakeEntries({ date });
    const hydration = await buildHydrationSummary(date);
    const nutrients = addNutrients(entries.map((entry) => entry.nutrients));

    const dayProgress: PerDayProgress = {
      date,
      kcal: buildMacroProgress(nutrients.calories_kcal ?? 0, goalSnapshot.kcal),
      protein_g: buildMacroProgress(nutrients.protein_g ?? 0, goalSnapshot.protein_g),
      carb_g: buildMacroProgress(nutrients.carbohydrates_g ?? 0, goalSnapshot.carb_g),
      fat_g: buildMacroProgress(nutrients.fat_g ?? 0, goalSnapshot.fat_g),
      water_ml: buildMacroProgress(hydration.total_ml, goalSnapshot.water_ml),
      on_target: false,
      entry_count: entries.length,
    };
    dayProgress.on_target = isDayOnTarget(dayProgress);
    days.push(dayProgress);
  }

  const daysWithData = days.filter((d) => d.entry_count > 0 || d.water_ml.consumed > 0).length;
  const totals = {
    kcal_consumed: roundNutrient(days.reduce((sum, d) => sum + d.kcal.consumed, 0)),
    protein_g_consumed: roundNutrient(days.reduce((sum, d) => sum + d.protein_g.consumed, 0)),
    carb_g_consumed: roundNutrient(days.reduce((sum, d) => sum + d.carb_g.consumed, 0)),
    fat_g_consumed: roundNutrient(days.reduce((sum, d) => sum + d.fat_g.consumed, 0)),
    water_ml_consumed: Math.round(days.reduce((sum, d) => sum + d.water_ml.consumed, 0)),
  };

  let averages: GoalProgressReport["averages"];
  if (days.length > 1) {
    const denom = Math.max(daysWithData, 1);
    averages = {
      kcal_per_day: roundNutrient(totals.kcal_consumed / denom),
      protein_g_per_day: roundNutrient(totals.protein_g_consumed / denom),
      carb_g_per_day: roundNutrient(totals.carb_g_consumed / denom),
      fat_g_per_day: roundNutrient(totals.fat_g_consumed / denom),
      water_ml_per_day: Math.round(totals.water_ml_consumed / denom),
    };
  }

  const daysOnTarget = days.filter((d) => d.on_target).length;
  const recommendations = buildRecommendations(days, goalSnapshot, locale, daysWithData);
  const notes = buildNotes(goalSnapshot, locale);

  return {
    period,
    window,
    days,
    totals,
    averages,
    goals_snapshot: goalSnapshot,
    days_on_target: daysOnTarget,
    days_with_data: daysWithData,
    recommendations,
    locale,
    notes,
  };
}

function resolveWindow(period: GoalProgressPeriod, today: string): { start: string; end: string } {
  switch (period) {
    case "today":
      return { start: today, end: today };
    case "yesterday": {
      const y = addDays(today, -1);
      return { start: y, end: y };
    }
    case "last_7_days":
      return { start: addDays(today, -6), end: today };
    case "last_30_days":
      return { start: addDays(today, -29), end: today };
    default:
      return { start: today, end: today };
  }
}

function enumerateDates(start: string, end: string): string[] {
  const result: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    result.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return result;
}

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function pickGoal(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function buildMacroProgress(consumed: number, goal: number): MacroProgress {
  const safeConsumed = Number.isFinite(consumed) ? consumed : 0;
  const pct = goal > 0 ? Math.round((safeConsumed / goal) * 1000) / 10 : 0;
  const delta = roundNutrient(safeConsumed - goal);
  return {
    consumed: roundNutrient(safeConsumed),
    goal,
    pct,
    delta_to_goal: delta,
  };
}

function isDayOnTarget(day: PerDayProgress): boolean {
  // A day is on-target if every macro/kcal with a configured goal is within ±10%.
  // Days with no configured goals never count as on-target (no signal).
  const macros: Array<MacroProgress> = [day.kcal, day.protein_g, day.carb_g, day.fat_g, day.water_ml];
  const configured = macros.filter((m) => m.goal > 0);
  if (configured.length === 0) return false;
  return configured.every((m) => Math.abs(m.pct - 100) <= TOLERANCE * 100);
}

function buildRecommendations(
  days: PerDayProgress[],
  goals: GoalProgressReport["goals_snapshot"],
  locale: "en" | "pt-BR",
  daysWithData: number,
): string[] {
  const recommendations: string[] = [];

  const noGoals = goals.kcal === 0 && goals.protein_g === 0 && goals.water_ml === 0;
  if (noGoals) {
    recommendations.push(
      locale === "pt-BR"
        ? "Defina metas diárias com nourish_set_goals (calorias, proteína, hidratação) para que este relatório fique mais útil."
        : "Set daily goals with nourish_set_goals (calories, protein, hydration) so this report becomes more useful."
    );
    return recommendations;
  }

  if (daysWithData === 0) {
    recommendations.push(
      locale === "pt-BR"
        ? "Nenhum registro de ingestão encontrado no período. Use nourish_log_intake (com explicit_user_intent=true) para começar."
        : "No intake found for this period. Use nourish_log_intake (with explicit_user_intent=true) to start tracking."
    );
    return recommendations;
  }

  const latest = days[days.length - 1];
  if (latest && goals.protein_g > 0 && latest.protein_g.delta_to_goal < -goals.protein_g * TOLERANCE) {
    const gap = Math.abs(latest.protein_g.delta_to_goal);
    recommendations.push(
      locale === "pt-BR"
        ? `Hoje faltam ${Math.round(gap)} g de proteína para bater a meta — considere ovos, iogurte grego ou frango magro no próximo lanche.`
        : `You are ${Math.round(gap)} g short of your protein goal today — consider eggs, Greek yogurt, or lean chicken at the next snack.`
    );
  }

  if (latest && goals.water_ml > 0 && latest.water_ml.delta_to_goal < -goals.water_ml * TOLERANCE) {
    const gap = Math.abs(latest.water_ml.delta_to_goal);
    recommendations.push(
      locale === "pt-BR"
        ? `Hidratação ${Math.round(gap)} ml abaixo da meta hoje — beba ${Math.round(gap / 250)} copo(s) de água nas próximas horas.`
        : `Hydration is ${Math.round(gap)} ml below target today — drink ${Math.round(gap / 250)} more cup(s) of water in the next few hours.`
    );
  }

  if (latest && goals.kcal > 0 && latest.kcal.delta_to_goal > goals.kcal * TOLERANCE) {
    const over = latest.kcal.delta_to_goal;
    recommendations.push(
      locale === "pt-BR"
        ? `Hoje você passou ${Math.round(over)} kcal da meta — caminhar 20 min adiciona ~80 kcal de gasto e fecha parte do gap.`
        : `You are ${Math.round(over)} kcal over today's goal — a 20-minute walk adds ~80 kcal of expenditure and closes part of the gap.`
    );
  }

  if (days.length > 1) {
    const lowProteinDays = days.filter(
      (d) => goals.protein_g > 0 && d.protein_g.delta_to_goal < -goals.protein_g * TOLERANCE && d.entry_count > 0
    ).length;
    if (lowProteinDays >= 3) {
      recommendations.push(
        locale === "pt-BR"
          ? `${lowProteinDays} dias com proteína abaixo da meta no período — vale revisar o café da manhã e o lanche da tarde.`
          : `${lowProteinDays} days below protein goal in this period — worth reviewing breakfast and the afternoon snack.`
      );
    }
  }

  if (recommendations.length === 0) {
    recommendations.push(
      locale === "pt-BR"
        ? "Macros e hidratação dentro da faixa — manter consistência por mais alguns dias."
        : "Macros and hydration are within range — keep this consistency for a few more days."
    );
  }

  return recommendations;
}

function buildNotes(goals: GoalProgressReport["goals_snapshot"], locale: "en" | "pt-BR"): string[] {
  const notes: string[] = [];
  const missing: string[] = [];
  if (goals.kcal === 0) missing.push(locale === "pt-BR" ? "calorias" : "calories");
  if (goals.protein_g === 0) missing.push(locale === "pt-BR" ? "proteína" : "protein");
  if (goals.water_ml === 0) missing.push(locale === "pt-BR" ? "hidratação" : "hydration");
  if (missing.length > 0) {
    notes.push(
      locale === "pt-BR"
        ? `Metas ausentes: ${missing.join(", ")}. Use nourish_set_goals para defini-las.`
        : `Missing goals: ${missing.join(", ")}. Use nourish_set_goals to define them.`
    );
  }
  notes.push(
    locale === "pt-BR"
      ? "Relatório baseado nos registros locais; não é orientação médica."
      : "Report based on local logs; this is not medical advice."
  );
  return notes;
}
