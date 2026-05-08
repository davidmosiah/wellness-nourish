import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

execFileSync("npm", ["run", "build"], { stdio: "inherit" });

// Isolate intake/goals/hydration storage so this test can run idempotently
// and not depend on state left over from other tests in the same workspace.
const localDir = await mkdtemp(join(tmpdir(), "nourish-coach-wearable-"));
process.env.NOURISH_LOCAL_DIR = localDir;

try {
  const { buildNutritionCoach } = await import("../dist/services/coach.js");

  // ---------------------------------------------------------------------------
  // Rule 1 — WHOOP recovery=35 → poor recovery → easy-digestion / sopa.
  // ---------------------------------------------------------------------------
  const poorRecovery = await buildNutritionCoach({
    mode: "daily_coach",
    locale: "pt-BR",
    wearable_context: {
      source: "whoop",
      context_type: "wellness_context",
      recovery_score: 35,
      hrv_ms: 28,
    },
  });

  const poorText = poorRecovery.suggested_next_meal.text.toLowerCase();
  assert.match(poorText, /sopa/, `rule 1: expected "sopa" in suggestion, got: ${poorText}`);
  assert.match(poorText, /frango/, `rule 1: expected "frango" in suggestion, got: ${poorText}`);
  assert.match(poorText, /gengibre/, `rule 1: expected "gengibre" in suggestion, got: ${poorText}`);
  assert.match(
    poorRecovery.suggested_next_meal.reason,
    /35.*whoop|whoop.*35|recovery 35%/i,
    `rule 1: reason should mention whoop and 35, got: ${poorRecovery.suggested_next_meal.reason}`,
  );
  assert.ok(
    poorRecovery.next_actions.some((a) => a.includes("Wearable signals were used")),
    `rule 1: next_actions should advertise wearable signal usage; got: ${JSON.stringify(poorRecovery.next_actions)}`,
  );

  // ---------------------------------------------------------------------------
  // Rule 2 — Garmin body_battery=82 + focus=protein → high recovery / picanha.
  // ---------------------------------------------------------------------------
  const highRecoveryProtein = await buildNutritionCoach({
    mode: "daily_coach",
    locale: "pt-BR",
    focus: "protein",
    wearable_context: {
      source: "garmin",
      context_type: "wellness_context",
      body_battery: 82,
    },
  });

  const proteinText = highRecoveryProtein.suggested_next_meal.text.toLowerCase();
  assert.match(proteinText, /picanha/, `rule 2: expected "picanha" in suggestion, got: ${proteinText}`);
  assert.match(proteinText, /200g/, `rule 2: expected "200g" in suggestion, got: ${proteinText}`);
  assert.match(
    highRecoveryProtein.suggested_next_meal.reason,
    /muscle synthesis|protein focus/i,
    `rule 2: reason should mention muscle synthesis / protein focus, got: ${highRecoveryProtein.suggested_next_meal.reason}`,
  );

  // ---------------------------------------------------------------------------
  // Rule 3 — WHOOP strain=19, mode=pre_workout_nutrition → carb bias / tapioca.
  // ---------------------------------------------------------------------------
  const preWorkoutHighStrain = await buildNutritionCoach({
    mode: "pre_workout_nutrition",
    locale: "pt-BR",
    wearable_context: {
      source: "whoop",
      context_type: "training_context",
      strain_score: 19,
    },
  });

  const preWorkoutText = preWorkoutHighStrain.suggested_next_meal.text.toLowerCase();
  assert.match(preWorkoutText, /tapioca/, `rule 3: expected "tapioca" in suggestion, got: ${preWorkoutText}`);
  assert.match(preWorkoutText, /banana/, `rule 3: expected "banana" in suggestion, got: ${preWorkoutText}`);
  assert.match(preWorkoutText, /mel/, `rule 3: expected "mel" in suggestion, got: ${preWorkoutText}`);
  assert.match(
    preWorkoutHighStrain.suggested_next_meal.reason,
    /strain|carbohydrate availability/i,
    `rule 3: reason should mention strain / carbohydrate availability, got: ${preWorkoutHighStrain.suggested_next_meal.reason}`,
  );

  // ---------------------------------------------------------------------------
  // Rule 4 — recent_training_load=high + mode=daily_coach → recovery / salmão.
  // ---------------------------------------------------------------------------
  const highTrainingLoad = await buildNutritionCoach({
    mode: "daily_coach",
    locale: "pt-BR",
    wearable_context: {
      source: "whoop",
      context_type: "wellness_context",
      recovery_score: 60, // not poor — make sure rule 1 does NOT short-circuit.
      recent_training_load: "high",
    },
  });

  const trainingLoadText = highTrainingLoad.suggested_next_meal.text.toLowerCase();
  assert.match(trainingLoadText, /salmão/, `rule 4: expected "salmão" in suggestion, got: ${trainingLoadText}`);
  assert.match(trainingLoadText, /batata doce/, `rule 4: expected "batata doce" in suggestion, got: ${trainingLoadText}`);
  assert.match(
    highTrainingLoad.suggested_next_meal.reason,
    /training load is high|glycogen/i,
    `rule 4: reason should mention training load / glycogen, got: ${highTrainingLoad.suggested_next_meal.reason}`,
  );

  // ---------------------------------------------------------------------------
  // Rule 5/6 — empty wearable_context falls back to existing default behavior.
  // ---------------------------------------------------------------------------
  const fallback = await buildNutritionCoach({
    mode: "daily_coach",
    locale: "pt-BR",
  });

  const fallbackText = fallback.suggested_next_meal.text.toLowerCase();
  // No goals set in this isolated tmpdir → goal_progress is empty → falls into
  // the locale "default" suggestion (arroz, feijão, frango, salada).
  assert.match(fallbackText, /arroz/, `fallback: expected "arroz" in default suggestion, got: ${fallbackText}`);
  assert.match(fallbackText, /feijão/, `fallback: expected "feijão" in default suggestion, got: ${fallbackText}`);
  assert.equal(
    fallback.suggested_next_meal.reason,
    "Balanced Brazilian meal pattern with trackable portions.",
    `fallback: reason should be the existing default, got: ${fallback.suggested_next_meal.reason}`,
  );
  assert.ok(
    !fallback.next_actions.some((a) => a.includes("Wearable signals were used")),
    `fallback: next_actions should NOT advertise wearable usage when no signals were applied; got: ${JSON.stringify(fallback.next_actions)}`,
  );

  // ---------------------------------------------------------------------------
  // Precedence — poor-recovery (rule 1) MUST beat training-load=high (rule 4)
  // when both apply. This guards the precedence order documented in coach.ts.
  // ---------------------------------------------------------------------------
  const precedence = await buildNutritionCoach({
    mode: "daily_coach",
    locale: "pt-BR",
    wearable_context: {
      source: "whoop",
      context_type: "wellness_context",
      recovery_score: 30,
      recent_training_load: "high",
    },
  });
  assert.match(
    precedence.suggested_next_meal.text.toLowerCase(),
    /sopa/,
    `precedence: poor-recovery must beat high-training-load; got: ${precedence.suggested_next_meal.text}`,
  );

  console.log("test-coach-wearable: all 5 rules + precedence guard pass");
} finally {
  await rm(localDir, { recursive: true, force: true });
}
