import type { MealType, NutrientMap } from "../types.js";
import { buildDailySummary, type DailySummary } from "./summary.js";
import { localDate } from "./local-date.js";
import { getPersonalNutritionMemory } from "./personal-memory.js";
import { estimateMeal } from "./meal-estimator.js";
import { roundNutrient } from "./nutrients.js";

export type CoachMode =
  | "daily_coach"
  | "suggest_next_meal"
  | "after_log_review"
  | "pre_workout_nutrition"
  | "evening_checkin";

export interface CoachInput {
  mode: CoachMode;
  date?: string | undefined;
  locale: string;
  focus?: "balanced" | "protein" | "calories" | "hydration" | "training" | undefined;
  meal_type?: MealType | undefined;
  wearable_context?: Record<string, unknown> | undefined;
  workout_context?: string | undefined;
  recent_intake_id?: string | undefined;
}

export interface CoachOutput {
  mode: CoachMode;
  date: string;
  locale: string;
  focus: string;
  requires_confirmation_to_log: true;
  summary: {
    entry_count: number;
    calories_kcal: number;
    protein_g: number;
    carbohydrates_g: number;
    fat_g: number;
    hydration_ml: number;
    confidence: number;
  };
  gaps: Record<string, {
    actual: number;
    goal: number;
    remaining: number;
    percent: number;
  }>;
  wellness_context: {
    sources: string[];
    wearable_context?: Record<string, unknown>;
    workout_context?: string;
    intake_refs: string[];
  };
  suggested_next_meal: {
    text: string;
    meal_type: MealType;
    reason: string;
    estimated_nutrients: NutrientMap;
    confidence: number;
  };
  next_actions: string[];
  reminders: string[];
  warnings: string[];
}

export async function buildNutritionCoach(input: CoachInput): Promise<CoachOutput> {
  const date = input.date ?? todayDate();
  const summary = await buildDailySummary(date);
  const memory = await getPersonalNutritionMemory();
  const suggestionText = chooseSuggestionText(input, summary);
  const suggestion = await estimateMeal({
    text: suggestionText,
    meal_type: input.meal_type ?? suggestedMealType(input.mode),
    locale: input.locale,
  });

  return {
    mode: input.mode,
    date,
    locale: input.locale,
    focus: input.focus ?? defaultFocus(input.mode),
    requires_confirmation_to_log: true,
    summary: compactSummary(summary),
    gaps: buildGaps(summary),
    wellness_context: buildWellnessContext(input, summary),
    suggested_next_meal: {
      text: suggestionText,
      meal_type: input.meal_type ?? suggestedMealType(input.mode),
      reason: suggestionReason(input, summary),
      estimated_nutrients: suggestion.total_nutrients,
      confidence: suggestion.confidence,
    },
    next_actions: nextActions(input, summary, memory.remembered_meals.length),
    reminders: [
      "Preview and confirm before logging any suggested meal.",
      "Use this as personal tracking context, not medical advice.",
    ],
    warnings: [
      "Nutrition coaching is heuristic and local-first.",
      "Wearable context is used only when the agent provides it explicitly.",
    ],
  };
}

function compactSummary(summary: DailySummary): CoachOutput["summary"] {
  return {
    entry_count: summary.entry_count,
    calories_kcal: summary.total_nutrients.calories_kcal ?? 0,
    protein_g: summary.total_nutrients.protein_g ?? 0,
    carbohydrates_g: summary.total_nutrients.carbohydrates_g ?? 0,
    fat_g: summary.total_nutrients.fat_g ?? 0,
    hydration_ml: summary.hydration.total_ml,
    confidence: summary.confidence,
  };
}

function buildGaps(summary: DailySummary): CoachOutput["gaps"] {
  const gaps: CoachOutput["gaps"] = {};

  for (const [key, progress] of Object.entries(summary.goal_progress)) {
    gaps[key] = {
      actual: progress.actual,
      goal: progress.goal,
      remaining: roundNutrient(Math.max(progress.goal - progress.actual, 0)),
      percent: progress.percent,
    };
  }

  return gaps;
}

function buildWellnessContext(input: CoachInput, summary: DailySummary): CoachOutput["wellness_context"] {
  const wearableSource = sourceFromWearable(input.wearable_context);
  const sources = [
    ...(wearableSource === undefined ? [] : [wearableSource]),
    ...(input.workout_context === undefined ? [] : ["workout_context"]),
    ...summary.source_coverage,
  ];
  const uniqueSources = [...new Set(sources)];
  const context: CoachOutput["wellness_context"] = {
    sources: uniqueSources,
    intake_refs: [],
  };

  if (input.wearable_context !== undefined) {
    context.wearable_context = input.wearable_context;
  }
  if (input.workout_context !== undefined) {
    context.workout_context = input.workout_context;
  }

  return context;
}

function sourceFromWearable(context: Record<string, unknown> | undefined): string | undefined {
  if (context === undefined) {
    return undefined;
  }

  const source = context.source;
  return typeof source === "string" && source.trim().length > 0 ? source : "wearable";
}

// C2 fix: previously these strings were hardcoded in pt-BR, regardless of
// the caller-supplied `locale`. An en-US Telegram user got Portuguese meal
// suggestions back AND the text was fed into estimateMeal() which only
// matches pt-BR aliases — so the suggestion was unactionable.
//
// Locale-keyed table covers the two production locales today (pt-BR + en-US).
// Add more keys as needed; falls back to en-US for unknown locales.
const SUGGESTION_TABLE: Record<string, Record<SuggestionKey, string>> = {
  "pt-BR": {
    pre_workout_nutrition: "banana, tapioca e cafezinho",
    evening_low_protein: "iogurte natural, banana e 2 ovos cozidos",
    evening_default: "cafezinho e água",
    low_protein: "150g peito de frango grelhado, arroz branco e salada simples",
    low_calories: "tapioca com queijo minas e banana",
    default: "arroz branco, feijão carioca, frango grelhado e salada simples",
    // Wearable-aware additions (delx-wellness-context/v1).
    wearable_poor_recovery: "sopa de legumes com peito de frango desfiado e gengibre",
    wearable_high_recovery_protein: "200g picanha grelhada, arroz, feijão e salada",
    wearable_pre_workout_high_strain: "tapioca grande com banana e mel, cafezinho",
    wearable_high_training_load: "salmão grelhado, batata doce e brócolis no vapor",
  },
  "en-US": {
    pre_workout_nutrition: "banana, oats and black coffee",
    evening_low_protein: "Greek yogurt, banana and 2 boiled eggs",
    evening_default: "black coffee and water",
    low_protein: "150g grilled chicken breast, white rice and a simple salad",
    low_calories: "oatmeal with peanut butter and banana",
    default: "white rice, black beans, grilled chicken and a simple salad",
    // Wearable-aware additions (delx-wellness-context/v1).
    wearable_poor_recovery: "vegetable soup with shredded chicken breast and ginger",
    wearable_high_recovery_protein: "200g grilled top sirloin, rice, beans and salad",
    wearable_pre_workout_high_strain: "large tapioca with banana and honey, black coffee",
    wearable_high_training_load: "grilled salmon, sweet potato and steamed broccoli",
  },
};

type SuggestionKey =
  | "pre_workout_nutrition"
  | "evening_low_protein"
  | "evening_default"
  | "low_protein"
  | "low_calories"
  | "default"
  | "wearable_poor_recovery"
  | "wearable_high_recovery_protein"
  | "wearable_pre_workout_high_strain"
  | "wearable_high_training_load";

function suggestionFor(locale: string, key: SuggestionKey): string {
  const normalized = normalizeLocale(locale);
  const table = SUGGESTION_TABLE[normalized] ?? SUGGESTION_TABLE["en-US"]!;
  return table[key];
}

function normalizeLocale(locale: string): string {
  const trimmed = locale.trim();
  // Accept "pt-BR", "pt", "pt_BR", "pt-br" and friends.
  if (/^pt(-|_)?(br)?$/i.test(trimmed)) return "pt-BR";
  if (/^en(-|_)?(us)?$/i.test(trimmed)) return "en-US";
  return trimmed;
}

// Wearable-aware reasoning (delx-wellness-context/v1).
//
// The `wearable_context` arg is intentionally typed as `Record<string, unknown>`
// at the schema layer — every connector (whoop/oura/garmin/strava/...) publishes
// the same envelope shape but only some keys overlap. This helper does the
// type-safe extraction so the routing logic below can stay readable.
//
// Thresholds come from the spec in PR #4 of delx-wellness:
//   recovery_score < 50      → "poor recovery"
//   recovery_score >= 75     → "high recovery"
//   body_battery   < 30      → "poor recovery" (Garmin)
//   body_battery   >= 70     → "high recovery" (Garmin)
//   strain_score   > 17      → "high strain"   (WHOOP, 0-21 scale)
//   relative_effort > 200    → "high strain"   (Strava)
interface WearableSignals {
  source: string | undefined;
  recoveryScore: number | undefined;
  hrv: number | undefined;
  strain: number | undefined;
  bodyBattery: number | undefined;
  trainingLoad: "low" | "normal" | "high" | "unknown" | undefined;
  relativeEffort: number | undefined;
  contextType: string | undefined;
  sorenessHint: string | undefined;
}

function extractWearableSignals(context: Record<string, unknown> | undefined): WearableSignals {
  if (context === undefined) {
    return {
      source: undefined,
      recoveryScore: undefined,
      hrv: undefined,
      strain: undefined,
      bodyBattery: undefined,
      trainingLoad: undefined,
      relativeEffort: undefined,
      contextType: undefined,
      sorenessHint: undefined,
    };
  }

  const source = typeof context.source === "string" ? context.source : undefined;
  const recoveryScore = typeof context.recovery_score === "number" ? context.recovery_score : undefined;
  const hrv = typeof context.hrv_ms === "number" ? context.hrv_ms : undefined;
  const strain = typeof context.strain_score === "number" ? context.strain_score : undefined;
  const bodyBattery = typeof context.body_battery === "number" ? context.body_battery : undefined;
  const relativeEffort = typeof context.relative_effort === "number" ? context.relative_effort : undefined;
  const contextType = typeof context.context_type === "string" ? context.context_type : undefined;
  const sorenessHint = typeof context.soreness_hint === "string" ? context.soreness_hint : undefined;

  const rawLoad = context.recent_training_load;
  const trainingLoad: WearableSignals["trainingLoad"] =
    rawLoad === "low" || rawLoad === "normal" || rawLoad === "high" || rawLoad === "unknown"
      ? rawLoad
      : undefined;

  return {
    source,
    recoveryScore,
    hrv,
    strain,
    bodyBattery,
    trainingLoad,
    relativeEffort,
    contextType,
    sorenessHint,
  };
}

// Tag identifying which wearable rule (1-4) fired, or undefined if none did.
type WearableRuleTag =
  | "poor_recovery"
  | "high_recovery_protein"
  | "pre_workout_high_strain"
  | "high_training_load";

function applyWearableRules(
  input: CoachInput,
  signals: WearableSignals,
): WearableRuleTag | undefined {
  // Rule 1: poor recovery — highest precedence.
  const poorRecovery =
    (signals.recoveryScore !== undefined && signals.recoveryScore < 50) ||
    (signals.bodyBattery !== undefined && signals.bodyBattery < 30);
  if (poorRecovery) {
    return "poor_recovery";
  }

  // Rule 4: recent training load = high — recovery-focused regardless of mode.
  if (signals.trainingLoad === "high") {
    return "high_training_load";
  }

  // Rule 3: pre-workout + high strain → carb bias.
  const highStrain =
    (signals.strain !== undefined && signals.strain > 17) ||
    (signals.relativeEffort !== undefined && signals.relativeEffort > 200);
  if (input.mode === "pre_workout_nutrition" && highStrain) {
    return "pre_workout_high_strain";
  }

  // Rule 2: high recovery + protein focus / post-workout.
  const highRecovery =
    (signals.recoveryScore !== undefined && signals.recoveryScore >= 75) ||
    (signals.bodyBattery !== undefined && signals.bodyBattery >= 70);
  const proteinOrPostWorkout =
    input.focus === "protein" || input.mode === "after_log_review";
  if (highRecovery && proteinOrPostWorkout) {
    return "high_recovery_protein";
  }

  return undefined;
}

function suggestionKeyForRule(rule: WearableRuleTag): SuggestionKey {
  switch (rule) {
    case "poor_recovery":
      return "wearable_poor_recovery";
    case "high_recovery_protein":
      return "wearable_high_recovery_protein";
    case "pre_workout_high_strain":
      return "wearable_pre_workout_high_strain";
    case "high_training_load":
      return "wearable_high_training_load";
  }
}

function reasonForWearableRule(rule: WearableRuleTag, signals: WearableSignals): string {
  const sourceLabel = signals.source ?? "wearable";
  switch (rule) {
    case "poor_recovery": {
      if (signals.recoveryScore !== undefined) {
        return `Recovery ${signals.recoveryScore}% from ${sourceLabel} — choosing easy-digestion, anti-inflammatory option.`;
      }
      if (signals.bodyBattery !== undefined) {
        return `Body Battery ${signals.bodyBattery} from ${sourceLabel} — choosing easy-digestion, anti-inflammatory option.`;
      }
      return `Recovery indicators are low — choosing easy-digestion, anti-inflammatory option.`;
    }
    case "high_recovery_protein": {
      const detail =
        signals.recoveryScore !== undefined
          ? `recovery ${signals.recoveryScore}%`
          : signals.bodyBattery !== undefined
            ? `Body Battery ${signals.bodyBattery}`
            : "high recovery";
      return `High recovery and protein focus (${sourceLabel}, ${detail}) — supporting muscle synthesis.`;
    }
    case "pre_workout_high_strain": {
      const detail =
        signals.strain !== undefined
          ? `strain ${signals.strain}`
          : signals.relativeEffort !== undefined
            ? `relative effort ${signals.relativeEffort}`
            : "elevated strain";
      return `Pre-workout with elevated strain (${sourceLabel}, ${detail}) — bias to carbohydrate availability.`;
    }
    case "high_training_load":
      return `Recent training load is high (${sourceLabel}) — supporting glycogen and protein recovery.`;
  }
}

function chooseSuggestionText(input: CoachInput, summary: DailySummary): string {
  const signals = extractWearableSignals(input.wearable_context);
  const wearableRule = applyWearableRules(input, signals);
  if (wearableRule !== undefined) {
    return suggestionFor(input.locale, suggestionKeyForRule(wearableRule));
  }

  if (input.mode === "pre_workout_nutrition") {
    return suggestionFor(input.locale, "pre_workout_nutrition");
  }

  if (input.mode === "evening_checkin") {
    const lowProtein = (summary.goal_progress.protein_g?.percent ?? 100) < 85;
    return suggestionFor(input.locale, lowProtein ? "evening_low_protein" : "evening_default");
  }

  if ((summary.goal_progress.protein_g?.percent ?? 100) < 70 || input.focus === "protein") {
    return suggestionFor(input.locale, "low_protein");
  }

  if ((summary.goal_progress.calories_kcal?.percent ?? 100) < 60 || input.focus === "calories") {
    return suggestionFor(input.locale, "low_calories");
  }

  return suggestionFor(input.locale, "default");
}

function suggestionReason(input: CoachInput, summary: DailySummary): string {
  const signals = extractWearableSignals(input.wearable_context);
  const wearableRule = applyWearableRules(input, signals);
  if (wearableRule !== undefined) {
    return reasonForWearableRule(wearableRule, signals);
  }

  if (input.mode === "pre_workout_nutrition") {
    return "Light carbohydrate-focused option for training context.";
  }

  if (input.mode === "evening_checkin") {
    return "Late-day option chosen to close protein or hydration gaps without assuming a full meal.";
  }

  if ((summary.goal_progress.protein_g?.percent ?? 100) < 70) {
    return "Protein progress is behind the daily goal.";
  }

  return "Balanced Brazilian meal pattern with trackable portions.";
}

function nextActions(
  input: CoachInput,
  summary: DailySummary,
  rememberedMealCount: number,
): string[] {
  const actions = [
    "Ask the user whether they want to log the suggested meal before calling nourish_log_intake.",
  ];

  const signals = extractWearableSignals(input.wearable_context);
  const wearableRule = applyWearableRules(input, signals);
  if (wearableRule !== undefined) {
    const sourceLabel = signals.source ?? "wearable";
    actions.push(
      `Wearable signals were used in this suggestion (source: ${sourceLabel}); confirm before logging.`,
    );
  }

  if (Object.keys(summary.goal_progress).length === 0) {
    actions.push("Set calorie, protein, and hydration goals for better coaching.");
  }
  if (rememberedMealCount === 0) {
    actions.push("Remember frequent meals so Telegram voice logs can use personal shortcuts.");
  }
  if (input.mode === "after_log_review") {
    actions.push("Show what changed in daily totals and ask whether any portion needs correction.");
  }
  if (input.mode === "evening_checkin" && summary.hydration.total_ml === 0) {
    actions.push("Ask whether the user wants to log water for today.");
  }

  return actions;
}

function suggestedMealType(mode: CoachMode): MealType {
  if (mode === "pre_workout_nutrition" || mode === "evening_checkin") {
    return "snack";
  }

  return "lunch";
}

function defaultFocus(mode: CoachMode): string {
  if (mode === "pre_workout_nutrition") {
    return "training";
  }
  if (mode === "evening_checkin") {
    return "hydration";
  }

  return "balanced";
}

// Was UTC — see services/local-date.ts. A São Paulo user at 22:00 BRT used
// to see coach output for "tomorrow" instead of today.
function todayDate(): string {
  return localDate();
}
